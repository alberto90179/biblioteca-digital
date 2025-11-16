const Prestamo = require('../models/Prestamo');
const Libro = require('../models/Libro');
const Usuario = require('../models/Usuario');
const { successResponse, errorResponse } = require('../middleware/responseHandler');
const SecurityAudit = require('../utils/securityAudit');

class PrestamoController {
  // Obtener todos los préstamos
  async getPrestamos(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const estado = req.query.estado;
      const skip = (page - 1) * limit;

      let query = { activo: true };

      // Filtrar por estado si se proporciona
      if (estado && ['activo', 'devuelto', 'vencido', 'perdido'].includes(estado)) {
        query.estado = estado;
      }

      // Si no es admin, solo mostrar préstamos del usuario
      if (req.auth.rol !== 'admin') {
        query.usuarioId = req.auth.id;
      }

      const [prestamos, total] = await Promise.all([
        Prestamo.find(query)
          .populate('libroId', 'titulo autor isbn imagen')
          .populate('usuarioId', 'nombre email')
          .sort({ fechaPrestamo: -1 })
          .skip(skip)
          .limit(limit),
        Prestamo.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMOS', 'READ', {
        page,
        limit,
        estado: estado || 'all',
        totalResults: total
      });

      successResponse(res, 'Préstamos obtenidos exitosamente', {
        prestamos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Error obteniendo préstamos:', error);
      errorResponse(res, 'Error obteniendo préstamos');
    }
  }

  // Obtener préstamo por ID
  async getPrestamoById(req, res) {
    try {
      let query = { _id: req.params.id, activo: true };

      // Si no es admin, solo puede ver sus propios préstamos
      if (req.auth.rol !== 'admin') {
        query.usuarioId = req.auth.id;
      }

      const prestamo = await Prestamo.findOne(query)
        .populate('libroId', 'titulo autor isbn imagen descripcion')
        .populate('usuarioId', 'nombre email');

      if (!prestamo) {
        return errorResponse(res, 'Préstamo no encontrado', 404);
      }

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMO', 'READ', {
        prestamoId: prestamo._id,
        libro: prestamo.libroId.titulo
      });

      successResponse(res, 'Préstamo obtenido exitosamente', { prestamo });

    } catch (error) {
      console.error('Error obteniendo préstamo:', error);
      errorResponse(res, 'Error obteniendo préstamo');
    }
  }

  // Crear nuevo préstamo (solo admin)
  async crearPrestamo(req, res) {
    try {
      const { libroId, usuarioId, fechaDevolucion, observaciones } = req.body;

      // Verificar si el libro existe y está disponible
      const libro = await Libro.findById(libroId);
      if (!libro || !libro.activo) {
        return errorResponse(res, 'Libro no encontrado', 404);
      }

      if (!libro.estaDisponible()) {
        return errorResponse(res, 'El libro no está disponible para préstamo', 400);
      }

      // Verificar si el usuario existe
      const usuario = await Usuario.findById(usuarioId);
      if (!usuario || !usuario.activo) {
        return errorResponse(res, 'Usuario no encontrado', 404);
      }

      // Verificar si el usuario ya tiene préstamos activos (límite de 3)
      const prestamosActivos = await Prestamo.countDocuments({
        usuarioId,
        estado: 'activo',
        activo: true
      });

      if (prestamosActivos >= 3) {
        return errorResponse(res, 'El usuario ya tiene el máximo de préstamos activos (3)', 400);
      }

      // Calcular días de préstamo
      const fechaPrestamo = new Date();
      const fechaDev = new Date(fechaDevolucion);
      const diasPrestamo = Math.ceil((fechaDev - fechaPrestamo) / (1000 * 60 * 60 * 24));

      if (diasPrestamo < 1 || diasPrestamo > 90) {
        return errorResponse(res, 'El período de préstamo debe ser entre 1 y 90 días', 400);
      }

      // Crear préstamo
      const prestamo = new Prestamo({
        libroId,
        usuarioId,
        fechaPrestamo,
        fechaDevolucion: fechaDev,
        diasPrestamo,
        observaciones
      });

      await prestamo.save();

      // Actualizar disponibilidad del libro
      await libro.prestarEjemplar();

      // Populate para respuesta
      await prestamo.populate('libroId', 'titulo autor isbn');
      await prestamo.populate('usuarioId', 'nombre email');

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMO', 'CREATE', {
        prestamoId: prestamo._id,
        libro: libro.titulo,
        usuario: usuario.email
      });

      successResponse(res, 'Préstamo creado exitosamente', { prestamo }, 201);

    } catch (error) {
      console.error('Error creando préstamo:', error);
      errorResponse(res, 'Error creando préstamo');
    }
  }

  // Devolver libro (solo admin)
  async devolverLibro(req, res) {
    try {
      const { observaciones } = req.body;
      const prestamo = await Prestamo.findById(req.params.id)
        .populate('libroId');

      if (!prestamo || !prestamo.activo) {
        return errorResponse(res, 'Préstamo no encontrado', 404);
      }

      if (prestamo.estado === 'devuelto') {
        return errorResponse(res, 'El libro ya fue devuelto', 400);
      }

      // Devolver libro
      await prestamo.devolver(observaciones);

      // Actualizar disponibilidad del libro
      if (prestamo.libroId) {
        await prestamo.libroId.devolverEjemplar();
      }

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMO', 'UPDATE', {
        prestamoId: prestamo._id,
        accion: 'devolucion',
        libro: prestamo.libroId.titulo
      });

      successResponse(res, 'Libro devuelto exitosamente', { prestamo });

    } catch (error) {
      console.error('Error devolviendo libro:', error);
      errorResponse(res, 'Error devolviendo libro');
    }
  }

  // Renovar préstamo
  async renovarPrestamo(req, res) {
    try {
      const { diasAdicionales = 15 } = req.body;
      let query = { _id: req.params.id, activo: true };

      // Si no es admin, solo puede renovar sus propios préstamos
      if (req.auth.rol !== 'admin') {
        query.usuarioId = req.auth.id;
      }

      const prestamo = await Prestamo.findOne(query);

      if (!prestamo) {
        return errorResponse(res, 'Préstamo no encontrado', 404);
      }

      // Renovar préstamo
      await prestamo.renovar(diasAdicionales);

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMO', 'UPDATE', {
        prestamoId: prestamo._id,
        accion: 'renovacion',
        diasAdicionales
      });

      successResponse(res, 'Préstamo renovado exitosamente', { prestamo });

    } catch (error) {
      console.error('Error renovando préstamo:', error);
      
      if (error.message.includes('Solo se pueden renovar préstamos activos')) {
        return errorResponse(res, error.message, 400);
      }
      
      if (error.message.includes('Límite de renovaciones alcanzado')) {
        return errorResponse(res, error.message, 400);
      }
      
      if (error.message.includes('No se pueden renovar préstamos vencidos')) {
        return errorResponse(res, error.message, 400);
      }
      
      errorResponse(res, 'Error renovando préstamo');
    }
  }

  // Eliminar préstamo (solo admin)
  async eliminarPrestamo(req, res) {
    try {
      const prestamo = await Prestamo.findById(req.params.id);

      if (!prestamo || !prestamo.activo) {
        return errorResponse(res, 'Préstamo no encontrado', 404);
      }

      // Si el préstamo está activo, devolver el libro primero
      if (prestamo.estado === 'activo' && prestamo.libroId) {
        const libro = await Libro.findById(prestamo.libroId);
        if (libro) {
          await libro.devolverEjemplar();
        }
      }

      // Soft delete
      prestamo.activo = false;
      await prestamo.save();

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMO', 'DELETE', {
        prestamoId: prestamo._id
      });

      successResponse(res, 'Préstamo eliminado exitosamente');

    } catch (error) {
      console.error('Error eliminando préstamo:', error);
      errorResponse(res, 'Error eliminando préstamo');
    }
  }

  // Obtener préstamos por usuario
  async getPrestamosPorUsuario(req, res) {
    try {
      const usuarioId = req.params.usuarioId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Verificar permisos (solo admin o el propio usuario)
      if (req.auth.rol !== 'admin' && req.auth.id !== usuarioId) {
        return errorResponse(res, 'No tienes permisos para ver estos préstamos', 403);
      }

      const [prestamos, total] = await Promise.all([
        Prestamo.find({ usuarioId, activo: true })
          .populate('libroId', 'titulo autor isbn imagen')
          .sort({ fechaPrestamo: -1 })
          .skip(skip)
          .limit(limit),
        Prestamo.countDocuments({ usuarioId, activo: true })
      ]);

      const totalPages = Math.ceil(total / limit);

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMOS_USUARIO', 'READ', {
        usuarioId,
        page,
        limit,
        totalResults: total
      });

      successResponse(res, 'Préstamos del usuario obtenidos exitosamente', {
        prestamos,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('Error obteniendo préstamos del usuario:', error);
      errorResponse(res, 'Error obteniendo préstamos del usuario');
    }
  }

  // Obtener préstamos vencidos (solo admin)
  async getPrestamosVencidos(req, res) {
    try {
      const prestamos = await Prestamo.prestamosVencidos();

      SecurityAudit.logDataAccess(req.auth.id, 'PRESTAMOS_VENCIDOS', 'READ', {
        total: prestamos.length
      });

      successResponse(res, 'Préstamos vencidos obtenidos', { prestamos });

    } catch (error) {
      console.error('Error obteniendo préstamos vencidos:', error);
      errorResponse(res, 'Error obteniendo préstamos vencidos');
    }
  }

  // Obtener estadísticas de préstamos
  async getEstadisticasPrestamos(req, res) {
    try {
      const estadisticas = await Prestamo.obtenerEstadisticas();

      SecurityAudit.logDataAccess(req.auth.id, 'ESTADISTICAS', 'READ', {
        tipo: 'prestamos'
      });

      successResponse(res, 'Estadísticas de préstamos', { estadisticas });

    } catch (error) {
      console.error('Error obteniendo estadísticas de préstamos:', error);
      errorResponse(res, 'Error obteniendo estadísticas');
    }
  }
}

module.exports = new PrestamoController();