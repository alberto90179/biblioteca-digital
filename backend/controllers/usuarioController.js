const Usuario = require('../models/Usuario');
const Prestamo = require('../models/Prestamo');
const { successResponse, errorResponse } = require('../middleware/responseHandler');
const EncryptionService = require('../middleware/encryption');
const SecurityAudit = require('../utils/securityAudit');

class UsuarioController {
  // Obtener todos los usuarios (solo admin)
  async getUsuarios(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const [usuarios, total] = await Promise.all([
        Usuario.find({ activo: true })
          .select('-password -refreshToken')
          .sort({ fechaRegistro: -1 })
          .skip(skip)
          .limit(limit),
        Usuario.countDocuments({ activo: true })
      ]);

      // Desencriptar nombres
      const usuariosConNombre = usuarios.map(usuario => ({
        ...usuario.toObject(),
        nombre: EncryptionService.decrypt(usuario.nombre)
      }));

      const totalPages = Math.ceil(total / limit);

      SecurityAudit.logDataAccess(req.auth.id, 'USUARIOS', 'READ', {
        page,
        limit,
        totalResults: total
      });

      successResponse(res, 'Usuarios obtenidos exitosamente', {
        usuarios: usuariosConNombre,
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
      console.error('Error obteniendo usuarios:', error);
      errorResponse(res, 'Error obteniendo usuarios');
    }
  }

  // Obtener usuario por ID (solo admin)
  async getUsuarioById(req, res) {
    try {
      const usuario = await Usuario.findById(req.params.id)
        .select('-password -refreshToken');

      if (!usuario || !usuario.activo) {
        return errorResponse(res, 'Usuario no encontrado', 404);
      }

      // Desencriptar nombre
      const usuarioConNombre = {
        ...usuario.toObject(),
        nombre: EncryptionService.decrypt(usuario.nombre)
      };

      SecurityAudit.logDataAccess(req.auth.id, 'USUARIO', 'READ', {
        usuarioId: req.params.id,
        email: usuario.email
      });

      successResponse(res, 'Usuario obtenido exitosamente', { usuario: usuarioConNombre });

    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      errorResponse(res, 'Error obteniendo usuario');
    }
  }

  // Actualizar usuario (solo admin)
  async actualizarUsuario(req, res) {
    try {
      const { nombre, email, rol } = req.body;
      const usuario = await Usuario.findById(req.params.id);

      if (!usuario || !usuario.activo) {
        return errorResponse(res, 'Usuario no encontrado', 404);
      }

      // Verificar que el email no esté en uso
      if (email && email !== usuario.email) {
        const emailExistente = await Usuario.findOne({ email, activo: true });
        if (emailExistente) {
          return errorResponse(res, 'El email ya está en uso', 400);
        }
        usuario.email = email;
      }

      if (nombre) {
        usuario.nombre = EncryptionService.encrypt(nombre);
      }

      if (rol && ['admin', 'usuario'].includes(rol)) {
        usuario.rol = rol;
      }

      await usuario.save();

      SecurityAudit.logDataAccess(req.auth.id, 'USUARIO', 'UPDATE', {
        usuarioId: usuario._id,
        email: usuario.email,
        camposActualizados: Object.keys(req.body)
      });

      successResponse(res, 'Usuario actualizado exitosamente', {
        usuario: {
          id: usuario._id,
          nombre: nombre || EncryptionService.decrypt(usuario.nombre),
          email: usuario.email,
          rol: usuario.rol
        }
      });

    } catch (error) {
      console.error('Error actualizando usuario:', error);
      errorResponse(res, 'Error actualizando usuario');
    }
  }

  // Eliminar usuario (soft delete, solo admin)
  async eliminarUsuario(req, res) {
    try {
      const usuario = await Usuario.findById(req.params.id);

      if (!usuario || !usuario.activo) {
        return errorResponse(res, 'Usuario no encontrado', 404);
      }

      // Verificar si el usuario tiene préstamos activos
      const prestamosActivos = await Prestamo.countDocuments({
        usuarioId: req.params.id,
        estado: 'activo'
      });

      if (prestamosActivos > 0) {
        return errorResponse(res, 'No se puede eliminar un usuario con préstamos activos', 400);
      }

      // Soft delete
      usuario.activo = false;
      await usuario.save();

      SecurityAudit.logDataAccess(req.auth.id, 'USUARIO', 'DELETE', {
        usuarioId: usuario._id,
        email: usuario.email
      });

      successResponse(res, 'Usuario eliminado exitosamente');

    } catch (error) {
      console.error('Error eliminando usuario:', error);
      errorResponse(res, 'Error eliminando usuario');
    }
  }

  // Obtener estadísticas de usuarios
  async getEstadisticasUsuarios(req, res) {
    try {
      const estadisticas = await Usuario.aggregate([
        { $match: { activo: true } },
        {
          $group: {
            _id: '$rol',
            total: { $sum: 1 },
            ultimoMes: {
              $sum: {
                $cond: [
                  { $gte: ['$fechaRegistro', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const totalUsuarios = await Usuario.countDocuments({ activo: true });
      const usuariosActivos = await Prestamo.distinct('usuarioId', { estado: 'activo' });

      const resultado = {
        totalUsuarios,
        usuariosActivos: usuariosActivos.length,
        porRol: estadisticas.reduce((acc, curr) => {
          acc[curr._id] = curr.total;
          return acc;
        }, {})
      };

      SecurityAudit.logDataAccess(req.auth.id, 'ESTADISTICAS', 'READ', {
        tipo: 'usuarios'
      });

      successResponse(res, 'Estadísticas de usuarios', { estadisticas: resultado });

    } catch (error) {
      console.error('Error obteniendo estadísticas de usuarios:', error);
      errorResponse(res, 'Error obteniendo estadísticas');
    }
  }
}

module.exports = new UsuarioController();