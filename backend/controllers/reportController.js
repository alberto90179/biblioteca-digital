const Libro = require('../models/Libro');
const Usuario = require('../models/Usuario');
const Prestamo = require('../models/Prestamo');
const { successResponse, errorResponse } = require('../middleware/responseHandler');
const SecurityAudit = require('../utils/securityAudit');

class ReportController {
  // Obtener estadísticas generales del sistema
  async getEstadisticasGenerales(req, res) {
    try {
      const [
        estadisticasLibros,
        totalUsuarios,
        totalPrestamos,
        prestamosActivos,
        prestamosVencidos,
        usuariosActivos
      ] = await Promise.all([
        Libro.obtenerEstadisticas(),
        Usuario.countDocuments({ activo: true }),
        Prestamo.countDocuments({ activo: true }),
        Prestamo.countDocuments({ estado: 'activo', activo: true }),
        Prestamo.countDocuments({ estado: 'vencido', activo: true }),
        Prestamo.distinct('usuarioId', { estado: 'activo', activo: true })
      ]);

      const estadisticas = {
        libros: estadisticasLibros,
        usuarios: {
          total: totalUsuarios,
          activos: usuariosActivos.length,
          inactivos: totalUsuarios - usuariosActivos.length
        },
        prestamos: {
          total: totalPrestamos,
          activos: prestamosActivos,
          vencidos: prestamosVencidos,
          devueltos: totalPrestamos - prestamosActivos - prestamosVencidos
        },
        sistema: {
          uptime: process.uptime(),
          memoria: process.memoryUsage(),
          version: process.version
        }
      };

      SecurityAudit.logDataAccess(req.auth.id, 'REPORTES', 'READ', {
        tipo: 'estadisticas-generales'
      });

      successResponse(res, 'Estadísticas generales obtenidas', { estadisticas });

    } catch (error) {
      console.error('Error obteniendo estadísticas generales:', error);
      errorResponse(res, 'Error obteniendo estadísticas generales');
    }
  }

  // Obtener reporte de préstamos activos
  async getPrestamosActivos(req, res) {
    try {
      const prestamos = await Prestamo.find({ estado: 'activo', activo: true })
        .populate('libroId', 'titulo autor isbn')
        .populate('usuarioId', 'nombre email')
        .sort({ fechaDevolucion: 1 });

      SecurityAudit.logDataAccess(req.auth.id, 'REPORTES', 'READ', {
        tipo: 'prestamos-activos',
        total: prestamos.length
      });

      successResponse(res, 'Préstamos activos obtenidos', { prestamos });

    } catch (error) {
      console.error('Error obteniendo préstamos activos:', error);
      errorResponse(res, 'Error obteniendo préstamos activos');
    }
  }

  // Obtener reporte de préstamos vencidos
  async getPrestamosVencidos(req, res) {
    try {
      const prestamos = await Prestamo.find({ estado: 'vencido', activo: true })
        .populate('libroId', 'titulo autor isbn')
        .populate('usuarioId', 'nombre email')
        .sort({ fechaDevolucion: 1 });

      // Calcular multas pendientes
      const multasPendientes = prestamos.reduce((total, prestamo) => {
        return total + (prestamo.multa && !prestamo.multa.pagada ? prestamo.multa.monto : 0);
      }, 0);

      SecurityAudit.logDataAccess(req.auth.id, 'REPORTES', 'READ', {
        tipo: 'prestamos-vencidos',
        total: prestamos.length,
        multasPendientes
      });

      successResponse(res, 'Préstamos vencidos obtenidos', {
        prestamos,
        resumen: {
          total: prestamos.length,
          multasPendientes
        }
      });

    } catch (error) {
      console.error('Error obteniendo préstamos vencidos:', error);
      errorResponse(res, 'Error obteniendo préstamos vencidos');
    }
  }

  // Obtener reporte de usuarios más activos
  async getUsuariosActivos(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;

      const usuariosActivos = await Prestamo.aggregate([
        { $match: { activo: true } },
        {
          $group: {
            _id: '$usuarioId',
            totalPrestamos: { $sum: 1 },
            prestamosActivos: {
              $sum: { $cond: [{ $eq: ['$estado', 'activo'] }, 1, 0] }
            },
            prestamosVencidos: {
              $sum: { $cond: [{ $eq: ['$estado', 'vencido'] }, 1, 0] }
            },
            ultimoPrestamo: { $max: '$fechaPrestamo' }
          }
        },
        { $sort: { totalPrestamos: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'usuarios',
            localField: '_id',
            foreignField: '_id',
            as: 'usuario'
          }
        },
        { $unwind: '$usuario' },
        {
          $project: {
            'usuario.nombre': 1,
            'usuario.email': 1,
            'usuario.rol': 1,
            'usuario.fechaRegistro': 1,
            totalPrestamos: 1,
            prestamosActivos: 1,
            prestamosVencidos: 1,
            ultimoPrestamo: 1
          }
        }
      ]);

      // Desencriptar nombres
      const usuariosConNombre = usuariosActivos.map(item => ({
        ...item,
        usuario: {
          ...item.usuario,
          nombre: EncryptionService.decrypt(item.usuario.nombre)
        }
      }));

      SecurityAudit.logDataAccess(req.auth.id, 'REPORTES', 'READ', {
        tipo: 'usuarios-activos',
        limit
      });

      successResponse(res, 'Usuarios más activos obtenidos', { usuarios: usuariosConNombre });

    } catch (error) {
      console.error('Error obteniendo usuarios activos:', error);
      errorResponse(res, 'Error obteniendo usuarios activos');
    }
  }

  // Obtener reporte de libros más populares
  async getLibrosPopulares(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const periodo = req.query.periodo || 'all'; // all, month, year

      let matchStage = { activo: true };

      if (periodo === 'month') {
        matchStage.fechaPrestamo = {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        };
      } else if (periodo === 'year') {
        matchStage.fechaPrestamo = {
          $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        };
      }

      const librosPopulares = await Prestamo.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$libroId',
            totalPrestamos: { $sum: 1 },
            prestamosActivos: {
              $sum: { $cond: [{ $eq: ['$estado', 'activo'] }, 1, 0] }
            },
            ratingPromedio: { $avg: '$rating' }
          }
        },
        { $sort: { totalPrestamos: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'libros',
            localField: '_id',
            foreignField: '_id',
            as: 'libro'
          }
        },
        { $unwind: '$libro' },
        {
          $project: {
            'libro.titulo': 1,
            'libro.autor': 1,
            'libro.genero': 1,
            'libro.isbn': 1,
            'libro.ejemplares': 1,
            'libro.ejemplaresDisponibles': 1,
            totalPrestamos: 1,
            prestamosActivos: 1,
            ratingPromedio: 1,
            porcentajePrestamo: {
              $multiply: [
                { $divide: ['$totalPrestamos', '$libro.ejemplares'] },
                100
              ]
            }
          }
        }
      ]);

      SecurityAudit.logDataAccess(req.auth.id, 'REPORTES', 'READ', {
        tipo: 'libros-populares',
        limit,
        periodo
      });

      successResponse(res, 'Libros más populares obtenidos', { libros: librosPopulares });

    } catch (error) {
      console.error('Error obteniendo libros populares:', error);
      errorResponse(res, 'Error obteniendo libros populares');
    }
  }

  // Obtener reporte de tendencias por género
  async getTendenciasGenero(req, res) {
    try {
      const tendencias = await Prestamo.aggregate([
        {
          $lookup: {
            from: 'libros',
            localField: 'libroId',
            foreignField: '_id',
            as: 'libro'
          }
        },
        { $unwind: '$libro' },
        {
          $group: {
            _id: '$libro.genero',
            totalPrestamos: { $sum: 1 },
            librosUnicos: { $addToSet: '$libroId' },
            promedioDias: { $avg: '$diasPrestamo' }
          }
        },
        {
          $project: {
            genero: '$_id',
            totalPrestamos: 1,
            totalLibros: { $size: '$librosUnicos' },
            promedioDias: 1,
            popularidad: {
              $divide: ['$totalPrestamos', { $size: '$librosUnicos' }]
            }
          }
        },
        { $sort: { totalPrestamos: -1 } }
      ]);

      SecurityAudit.logDataAccess(req.auth.id, 'REPORTES', 'READ', {
        tipo: 'tendencias-genero'
      });

      successResponse(res, 'Tendencias por género obtenidas', { tendencias });

    } catch (error) {
      console.error('Error obteniendo tendencias por género:', error);
      errorResponse(res, 'Error obteniendo tendencias por género');
    }
  }
}

module.exports = new ReportController();