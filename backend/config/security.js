const crypto = require('crypto');

// Generar claves seguras si no existen
const generateSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  // Configuración de JWT
  jwt: {
    secret: process.env.JWT_SECRET || generateSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || generateSecret(),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'biblioteca-digital-api',
    audience: 'biblioteca-digital-app'
  },

  // Configuración de Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
      success: false,
      message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde'
    },
    standardHeaders: true,
    legacyHeaders: false
  },

  // Configuración de CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  },

  // Configuración de Helmet
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"]
      }
    },
    crossOriginEmbedderPolicy: false
  },

  // Encriptación
  encryption: {
    algorithm: 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY || generateSecret(),
    ivLength: 16,
    saltLength: 64,
    tagLength: 16
  },

  // Validación de contraseñas
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    blockCommon: true
  }
};