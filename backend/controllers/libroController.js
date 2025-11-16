const Libro = require('../models/Libro');
const Prestamo = require('../models/Prestamo');
const { successResponse, errorResponse } = require('../middleware/responseHandler');
const SecurityAudit = require('../utils/securityAudit');

class LibroController {
  // Obtener todos los libros con paginación
  async getLibros(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search;
      
      const skip = (page - 1) * limit;
      
      let query = { activo: true };
      
      // Búsqueda por texto
      if (search) {
        query.$text = { $search: search };
      }
      
      const [libros, total] = await Promise.all([
        Libro.find(query)
          .sort({ titulo: 1 })
          .skip(skip)
          .limit(limit)
          .select('-__v'),
        Libro.countDocuments(query)
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      SecurityAudit.logDataAccess(req.auth.id, 'LIBROS', 'READ', {
        page,
        limit,
        search: search || 'none',
        totalResults: total
      });
      
      successResponse(res, 'Libros obtenidos exitosamente', {
        libros,
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
      console.error('Error obteniendo libros:', error);
      errorResponse(res, 'Error obteniendo libros');
    }
  }

  // Búsqueda avanzada de libros
  async buscarLibros(req, res) {
    try {
      const criterios = {
        query: req.query.q,
        genero: req.query.genero,
        autor: req.query.autor,
        añoDesde: req.query.añoDesde,
        añoHasta: req.query.añoHasta,
        disponible: req.query.disponible ? req.query.disponible === 'true' : undefined,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortBy: req.query.sortBy || 'titulo',
        sortOrder: req.query.sortOrder || 'asc'
      };
      
      const libros = await Libro.buscarAvanzada(criterios);
      const total = await Libro.countDocuments({ activo: true });
      
      SecurityAudit.logDataAccess(req.auth.id, 'LIBROS', 'SEARCH', {
        criterios,
        totalResults: libros.length
      });
      
      successResponse(res, 'Búsqueda completada', { libros, total });
      
    } catch (error) {
      console.error('Error buscando libros:', error);
      errorResponse(res, 'Error en la búsqueda');
    }
  }

  // Obtener libro por ID
  async getLibroById(req, res) {
    try {
      const libro = await Libro.findById(req.params.id)
        .populate('prestamosActivos');
      
      if (!libro) {
        return errorResponse(res, 'Libro no encontrado', 404);
      }
      
      if (!libro.activo) {
        return errorResponse(res, 'Libro no disponible', 404);
      }
      
      SecurityAudit.logDataAccess(req.auth.id, 'LIBRO', 'READ', {
        libroId: req.params.id,
        titulo: libro.titulo
      });
      
      successResponse(res, 'Libro obtenido exitosamente', { libro });
      
    } catch (error) {
      console.error('Error obteniendo libro:', error);
      errorResponse(res, 'Error obteniendo libro');
    }
  }

  // Crear nuevo libro
  async crearLibro(req, res) {
    try {
      const {
        titulo,
        autor,
        isbn,
        editorial,
        año,
        genero,
        descripcion,
        ejemplares,
        imagen,
        ubicacion,
        tags
      } = req.body;
      
      // Verificar si el ISBN ya existe
      const libroExistente = await Libro.findOne({ isbn, activo: true });
      if (libroExistente) {
        return errorResponse(res, 'Ya existe un libro con este ISBN', 400);
      }
      
      const libro = new Libro({
        titulo,
        autor,
        isbn,
        editorial,
        año,
        genero,
        descripcion,
        ejemplares: ejemplares || 1,
        imagen,
        ubicacion,
        tags: tags || []
      });
      
      await libro.save();
      
      SecurityAudit.logDataAccess(req.auth.id, 'LIBRO', 'CREATE', {
        libroId: libro._id,
        titulo: libro.titulo,
        isbn: libro.isbn
      });
      
      successResponse(res, 'Libro creado exitosamente', { libro }, 201);
      
    } catch (error) {
      console.error('Error creando libro:', error);
      
      if (error.code === 11000) {
        return errorResponse(res, 'El ISBN ya existe en el sistema', 400);
      }
      
      errorResponse(res, 'Error creando libro');
    }
  }

  // Actualizar libro
  async actualizarLibro(req, res) {
    try {
      const libro = await Libro.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedAt: new Date() },
        { 
          new: true, 
          runValidators: true,
          context: 'query'
        }
      );
      
      if (!libro) {
        return errorResponse(res, 'Libro no encontrado', 404);
      }
      
      SecurityAudit.logDataAccess(req.auth.id, 'LIBRO', 'UPDATE', {
        libroId: libro._id,
        titulo: libro.titulo,
        camposActualizados: Object.keys(req.body)
      });
      
      successResponse(res, 'Libro actualizado exitosamente', { libro });
      
    } catch (error) {
      console.error('Error actualizando libro:', error);
      
      if (error.code === 11000) {
        return errorResponse(res, 'El ISBN ya existe en el sistema', 400);
      }
      
      errorResponse(res, 'Error actualizando libro');
    }
  }

  // Eliminar libro (soft delete)
  async eliminarLibro(req, res) {
    try {
      const libro = await Libro.findById(req.params.id);
      
      if (!libro) {
        return errorResponse(res, 'Libro no encontrado', 404);
      }
      
      // Verificar si hay préstamos activos
      const prestamosActivos = await Prestamo.countDocuments({
        libroId: req.params.id,
        estado: 'activo'
      });
      
      if (prestamosActivos > 0) {
        return errorResponse(res, 'No se puede eliminar un libro con préstamos activos', 400);
      }
      
      // Soft delete
      libro.activo = false;
      await libro.save();
      
      SecurityAudit.logDataAccess(req.auth.id, 'LIBRO', 'DELETE', {
        libroId: libro._id,
        titulo: libro.titulo
      });
      
      successResponse(res, 'Libro eliminado exitosamente');
      
    } catch (error) {
      console.error('Error eliminando libro:', error);
      errorResponse(res, 'Error eliminando libro');
    }
  }

  // Verificar disponibilidad
  async verificarDisponibilidad(req, res) {
    try {
      const libro = await Libro.findById(req.params.id);
      
      if (!libro || !libro.activo) {
        return errorResponse(res, 'Libro no encontrado', 404);
      }
      
      const disponibilidad = {
        disponible: libro.estaDisponible(),
        ejemplaresDisponibles: libro.ejemplaresDisponibles,
        ejemplaresTotales: libro.ejemplares,
        estado: libro.estado,
        puedePrestar: libro.estaDisponible() && libro.ejemplaresDisponibles > 0
      };
      
      successResponse(res, 'Disponibilidad verificada', { disponibilidad });
      
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      errorResponse(res, 'Error verificando disponibilidad');
    }
  }

  // Obtener estadísticas por género
  async getEstadisticasGeneros(req, res) {
    try {
      const estadisticas = await Libro.aggregate([
        { $match: { activo: true } },
        {
          $group: {
            _id: '$genero',
            totalLibros: { $sum: 1 },
            totalEjemplares: { $sum: '$ejemplares' },
            totalDisponibles: { $sum: '$ejemplaresDisponibles' }
          }
        },
        {
          $project: {
            genero: '$_id',
            totalLibros: 1,
            totalEjemplares: 1,
            totalDisponibles: 1,
            porcentajeDisponible: {
              $multiply: [
                { $divide: ['$totalDisponibles', '$totalEjemplares'] },
                100
              ]
            }
          }
        },
        { $sort: { totalLibros: -1 } }
      ]);
      
      SecurityAudit.logDataAccess(req.auth.id, 'ESTADISTICAS', 'READ', {
        tipo: 'generos'
      });
      
      successResponse(res, 'Estadísticas por género', { estadisticas });
      
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      errorResponse(res, 'Error obteniendo estadísticas');
    }
  }

  // Obtener libros más populares
  async getLibrosPopulares(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const librosPopulares = await Prestamo.aggregate([
        { $match: { activo: true } },
        {
          $group: {
            _id: '$libroId',
            totalPrestamos: { $sum: 1 }
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
            'libro.imagen': 1,
            totalPrestamos: 1
          }
        }
      ]);
      
      successResponse(res, 'Libros más populares', { librosPopulares });
      
    } catch (error) {
      console.error('Error obteniendo libros populares:', error);
      errorResponse(res, 'Error obteniendo libros populares');
    }
  }
}

module.exports = new LibroController();