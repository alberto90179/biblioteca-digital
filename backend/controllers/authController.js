const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const securityConfig = require('../config/security');
const { successResponse, errorResponse } = require('../middleware/responseHandler');
const EncryptionService = require('../middleware/encryption');
const SecurityAudit = require('../utils/securityAudit');

class AuthController {
  // Registro con seguridad mejorada
  async registro(req, res) {
    try {
      const { nombre, email, password, rol = 'usuario' } = req.body;

      // Auditoría
      SecurityAudit.logSecurityEvent('REGISTRO_ATTEMPT', {
        email,
        ip: req.clientInfo.ip,
        userAgent: req.clientInfo.userAgent
      });

      // Verificar si el usuario ya existe
      const usuarioExistente = await Usuario.findOne({ email });
      if (usuarioExistente) {
        SecurityAudit.logSecurityEvent('REGISTRO_DUPLICATE', { email });
        return errorResponse(res, 'El usuario ya existe', 400);
      }

      // Crear nuevo usuario con contraseña encriptada
      const usuario = new Usuario({
        nombre: EncryptionService.encrypt(nombre),
        email,
        password,
        rol
      });

      await usuario.save();

      // Generar tokens
      const token = this.generateToken(usuario);
      const refreshToken = this.generateRefreshToken(usuario);

      // Guardar refresh token encriptado
      usuario.refreshToken = EncryptionService.encrypt(refreshToken);
      await usuario.save();

      SecurityAudit.logSecurityEvent('REGISTRO_SUCCESS', {
        userId: usuario._id,
        email
      }, usuario._id);

      successResponse(res, 'Usuario registrado exitosamente', {
        token,
        refreshToken,
        usuario: {
          id: usuario._id,
          nombre,
          email: usuario.email,
          rol: usuario.rol
        }
      }, 201);

    } catch (error) {
      console.error('Error en registro:', error);
      SecurityAudit.logSecurityBreach({
        error: error.message,
        endpoint: '/api/auth/registro'
      });
      errorResponse(res, 'Error en el servidor');
    }
  }

  // Login con protección contra fuerza bruta
  async login(req, res) {
    try {
      const { email, password } = req.body;

      SecurityAudit.logLoginAttempt(email, false, {
        ip: req.clientInfo.ip,
        userAgent: req.clientInfo.userAgent
      });

      // Verificar si el usuario existe
      const usuario = await Usuario.findOne({ email }).select('+password');
      if (!usuario) {
        await this.simulateDelay(); // Prevenir timing attacks
        return errorResponse(res, 'Credenciales inválidas', 401);
      }

      // Verificar si la cuenta está bloqueada
      if (usuario.isBlocked()) {
        return errorResponse(res, 'Cuenta temporalmente bloqueada. Intente más tarde.', 423);
      }

      // Verificar contraseña con comparación de tiempo constante
      const esPasswordValido = await bcrypt.compare(password, usuario.password);
      if (!esPasswordValido) {
        await usuario.incrementFailedAttempts();
        await this.simulateDelay(); // Prevenir timing attacks
        return errorResponse(res, 'Credenciales inválidas', 401);
      }

      // Resetear intentos fallidos
      await usuario.resetFailedAttempts();

      // Generar nuevos tokens
      const token = this.generateToken(usuario);
      const refreshToken = this.generateRefreshToken(usuario);

      // Actualizar refresh token encriptado
      usuario.refreshToken = EncryptionService.encrypt(refreshToken);
      usuario.ultimoAcceso = new Date();
      await usuario.save();

      SecurityAudit.logLoginAttempt(email, true, {
        userId: usuario._id,
        ip: req.clientInfo.ip
      }, usuario._id);

      successResponse(res, 'Login exitoso', {
        token,
        refreshToken,
        usuario: {
          id: usuario._id,
          nombre: EncryptionService.decrypt(usuario.nombre),
          email: usuario.email,
          rol: usuario.rol
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      SecurityAudit.logSecurityBreach({
        error: error.message,
        endpoint: '/api/auth/login'
      });
      errorResponse(res, 'Error en el servidor');
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return errorResponse(res, 'Refresh token requerido', 400);
      }

      // Verificar refresh token
      const decoded = jwt.verify(refreshToken, securityConfig.jwt.refreshSecret);
      const usuario = await Usuario.findById(decoded.id).select('+refreshToken');

      if (!usuario || !usuario.refreshToken) {
        return errorResponse(res, 'Refresh token inválido', 401);
      }

      // Verificar que el refresh token coincida
      const storedToken = EncryptionService.decrypt(usuario.refreshToken);
      if (storedToken !== refreshToken) {
        SecurityAudit.logSecurityBreach({
          event: 'REFRESH_TOKEN_MISMATCH',
          userId: usuario._id
        }, usuario._id);
        return errorResponse(res, 'Refresh token inválido', 401);
      }

      // Generar nuevos tokens
      const newToken = this.generateToken(usuario);
      const newRefreshToken = this.generateRefreshToken(usuario);

      // Actualizar refresh token
      usuario.refreshToken = EncryptionService.encrypt(newRefreshToken);
      await usuario.save();

      SecurityAudit.logSecurityEvent('TOKEN_REFRESHED', {
        userId: usuario._id
      }, usuario._id);

      successResponse(res, 'Token actualizado', {
        token: newToken,
        refreshToken: newRefreshToken
      });

    } catch (error) {
      console.error('Error en refresh token:', error);
      SecurityAudit.logSecurityBreach({
        error: error.message,
        endpoint: '/api/auth/refresh'
      });
      errorResponse(res, 'Refresh token inválido', 401);
    }
  }

  // Logout con invalidación de token
  async logout(req, res) {
    try {
      const usuario = await Usuario.findById(req.auth.id);
      if (usuario) {
        usuario.refreshToken = undefined;
        await usuario.save();

        SecurityAudit.logSecurityEvent('LOGOUT', {
          userId: usuario._id
        }, usuario._id);
      }

      successResponse(res, 'Logout exitoso');

    } catch (error) {
      console.error('Error en logout:', error);
      errorResponse(res, 'Error en el servidor');
    }
  }

  // Generar token JWT
  generateToken(usuario) {
    return jwt.sign(
      { 
        id: usuario._id, 
        rol: usuario.rol,
        email: usuario.email
      },
      securityConfig.jwt.secret,
      { 
        expiresIn: securityConfig.jwt.expiresIn,
        issuer: securityConfig.jwt.issuer,
        audience: securityConfig.jwt.audience
      }
    );
  }

  // Generar refresh token
  generateRefreshToken(usuario) {
    return jwt.sign(
      { 
        id: usuario._id,
        type: 'refresh'
      },
      securityConfig.jwt.refreshSecret,
      { 
        expiresIn: securityConfig.jwt.refreshExpiresIn,
        issuer: securityConfig.jwt.issuer,
        audience: securityConfig.jwt.audience
      }
    );
  }

  // Simular delay para prevenir timing attacks
  async simulateDelay() {
    const delay = 500 + Math.random() * 500; // 500-1000ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // Obtener perfil con datos desencriptados
  async getPerfil(req, res) {
    try {
      const usuario = await Usuario.findById(req.auth.id);
      if (!usuario) {
        return errorResponse(res, 'Usuario no encontrado', 404);
      }

      const perfil = {
        id: usuario._id,
        nombre: EncryptionService.decrypt(usuario.nombre),
        email: usuario.email,
        rol: usuario.rol,
        fechaRegistro: usuario.fechaRegistro,
        ultimoAcceso: usuario.ultimoAcceso
      };

      SecurityAudit.logDataAccess(req.auth.id, 'PERFIL', 'READ', {
        ip: req.clientInfo.ip
      });

      successResponse(res, 'Perfil obtenido', { usuario: perfil });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      errorResponse(res, 'Error obteniendo perfil');
    }
  }

  // Actualizar perfil con validación de seguridad
  async actualizarPerfil(req, res) {
    try {
      const { nombre, email } = req.body;
      const usuario = await Usuario.findById(req.auth.id);

      if (!usuario) {
        return errorResponse(res, 'Usuario no encontrado', 404);
      }

      // Verificar que el email no esté en uso
      if (email && email !== usuario.email) {
        const emailExistente = await Usuario.findOne({ email });
        if (emailExistente) {
          return errorResponse(res, 'El email ya está en uso', 400);
        }
        usuario.email = email;
      }

      if (nombre) {
        usuario.nombre = EncryptionService.encrypt(nombre);
      }

      await usuario.save();

      SecurityAudit.logDataAccess(req.auth.id, 'PERFIL', 'UPDATE', {
        ip: req.clientInfo.ip,
        camposActualizados: Object.keys(req.body)
      });

      successResponse(res, 'Perfil actualizado', {
        usuario: {
          id: usuario._id,
          nombre,
          email: usuario.email,
          rol: usuario.rol
        }
      });

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      SecurityAudit.logSecurityBreach({
        error: error.message,
        endpoint: '/api/auth/perfil',
        userId: req.auth.id
      }, req.auth.id);
      errorResponse(res, 'Error actualizando perfil');
    }
  }
}

module.exports = new AuthController();