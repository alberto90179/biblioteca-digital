const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const xss = require('xss-clean');
const mongoSanitize = require('mongo-sanitize');
const { expressjwt: jwt } = require('express-jwt');
const securityConfig = require('../config/security');
const { successResponse, errorResponse } = require('./responseHandler');

// Rate Limiting por tipo de endpoint
const generalLimiter = rateLimit({
  ...securityConfig.rateLimit,
  keyGenerator: (req) => req.ip
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos de login por ventana
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación, por favor intenta más tarde'
  }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // Máximo 30 peticiones por minuto por IP
  message: {
    success: false,
    message: 'Límite de peticiones excedido'
  }
});

// JWT Middleware
const requireAuth = jwt({
  secret: securityConfig.jwt.secret,
  algorithms: ['HS256'],
  issuer: securityConfig.jwt.issuer,
  audience: securityConfig.jwt.audience
}).unless({
  path: [
    '/api/auth/login',
    '/api/auth/registro',
    '/api/health',
    '/api/docs',
    '/api'
  ]
});

// Refresh Token Middleware
const requireRefreshAuth = jwt({
  secret: securityConfig.jwt.refreshSecret,
  algorithms: ['HS256'],
  issuer: securityConfig.jwt.issuer,
  audience: securityConfig.jwt.audience
});

// Validación de roles
const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.auth) {
        return errorResponse(res, 'Token de autenticación requerido', 401);
      }

      const userRole = req.auth.rol;
      
      if (!roles.includes(userRole)) {
        return errorResponse(res, 'Permisos insuficientes para esta acción', 403);
      }

      next();
    } catch (error) {
      console.error('Error en validación de roles:', error);
      return errorResponse(res, 'Error de autorización', 500);
    }
  };
};

// Sanitización de datos
const sanitizeInput = (req, res, next) => {
  try {
    // Sanitizar body
    if (req.body) {
      req.body = mongoSanitize(req.body);
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].trim();
        }
      });
    }

    // Sanitizar query params
    if (req.query) {
      req.query = mongoSanitize(req.query);
    }

    // Sanitizar params
    if (req.params) {
      req.params = mongoSanitize(req.params);
    }

    next();
  } catch (error) {
    console.error('Error en sanitización:', error);
    return errorResponse(res, 'Error en procesamiento de datos', 400);
  }
};

// Validación de IP y User-Agent
const requestValidation = (req, res, next) => {
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;

  // Validar User-Agent
  if (!userAgent || userAgent.length < 10) {
    return errorResponse(res, 'User-Agent no válido', 400);
  }

  // Agregar información de la request al objeto req
  req.clientInfo = {
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  };

  next();
};

// Prevención de ataques de timing
const constantTimeComparison = (val1, val2) => {
  if (val1.length !== val2.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < val1.length; i++) {
    result |= val1.charCodeAt(i) ^ val2.charCodeAt(i);
  }
  return result === 0;
};

// Middleware de seguridad completo
const securityMiddleware = [
  helmet(securityConfig.helmet),
  xss(),
  hpp(),
  requestValidation,
  sanitizeInput
];

// Manejo de errores de JWT
const handleJWTError = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return errorResponse(res, 'Token inválido o expirado', 401);
  }
  next(err);
};

module.exports = {
  securityMiddleware,
  generalLimiter,
  authLimiter,
  apiLimiter,
  requireAuth,
  requireRefreshAuth,
  requireRole,
  handleJWTError,
  constantTimeComparison
};