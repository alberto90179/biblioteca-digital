const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

// Configuraciones
const securityConfig = require('./config/security');
const {
  securityMiddleware,
  generalLimiter,
  authLimiter,
  apiLimiter,
  requireAuth,
  handleJWTError
} = require('./middleware/security');

const SecurityAudit = require('./utils/securityAudit');

// Inicializar Express
const app = express();

// ==================== MIDDLEWARE GLOBAL ====================

// Compresión GZIP
app.use(compression());

// Middleware de seguridad
app.use(securityMiddleware);

// CORS configurado
app.use(cors(securityConfig.cors));

// Rate limiting global
app.use(generalLimiter);

// Parseo de JSON con límite
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ==================== CONEXIÓN A MONGODB ====================

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB conectado exitosamente');
    console.log(`📊 Base de datos: ${mongoose.connection.db.databaseName}`);
    
    // Eventos de conexión
    mongoose.connection.on('error', err => {
      console.error('❌ Error de MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB desconectado');
    });
    
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

// ==================== DOCUMENTACIÓN SWAGGER ====================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Biblioteca Digital API',
      version: '1.0.0',
      description: 'API RESTful segura para sistema de gestión de biblioteca digital',
      contact: {
        name: 'Soporte API',
        email: 'soporte@biblioteca.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT}`,
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./routes/*.js', './docs/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================== RUTAS PÚBLICAS ====================

// Health check extendido
app.get('/api/health', (req, res) => {
  const healthCheck = {
    success: true,
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  };
  
  res.json(healthCheck);
});

// Información del API
app.get('/api', (req, res) => {
  res.json({
    name: 'Biblioteca Digital API',
    version: '1.0.0',
    description: 'Sistema de gestión de biblioteca digital',
    endpoints: {
      documentation: '/api/docs',
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
        registro: 'POST /api/auth/registro',
        perfil: 'GET /api/auth/perfil',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout'
      },
      libros: 'GET /api/libros',
      prestamos: 'GET /api/prestamos',
      usuarios: 'GET /api/usuarios (admin)',
      reportes: 'GET /api/reports (admin)'
    }
  });
});

// Rate limiting específico para auth
app.use('/api/auth', authLimiter);

// Rutas de autenticación públicas
const authRoutes = require('./routes/auth');
app.post('/api/auth/registro', authRoutes.registro);
app.post('/api/auth/login', authRoutes.login);

// ==================== MIDDLEWARE DE AUTENTICACIÓN ====================

// Protección JWT para rutas siguientes
app.use(requireAuth);

// Manejo de errores de JWT
app.use(handleJWTError);

// Rate limiting para API autenticada
app.use('/api', apiLimiter);

// ==================== RUTAS PROTEGIDAS ====================

// Cargar rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/libros', require('./routes/libros'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/prestamos', require('./routes/prestamos'));
app.use('/api/reports', require('./routes/reports'));

// ==================== MANEJO DE ERRORES ====================

// Ruta no encontrada
app.use('*', (req, res) => {
  SecurityAudit.logSecurityEvent('ROUTE_NOT_FOUND', {
    path: req.originalUrl,
    method: req.method,
    ip: req.clientInfo.ip,
    userAgent: req.clientInfo.userAgent
  });
  
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error global:', err);

  SecurityAudit.logSecurityBreach({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.auth ? req.auth.id : 'anonymous'
  });

  // Respuesta de error segura
  const errorResponse = {
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : err.message
  };

  // Agregar detalles en desarrollo
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err.details;
  }

  res.status(err.status || 500).json(errorResponse);
});

// ==================== INICIALIZACIÓN DEL SERVIDOR ====================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Conectar a la base de datos
    await connectDB();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀  SERVIDOR BIBLIOTECA DIGITAL INICIADO');
      console.log('='.repeat(50));
      console.log(`📍 Puerto: ${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV}`);
      console.log(`🔒 Modo seguro: ${process.env.NODE_ENV === 'production' ? 'ACTIVADO' : 'DESARROLLO'}`);
      console.log(`📊 Base de datos: ${mongoose.connection.db.databaseName}`);
      console.log(`📚 Documentación: http://localhost:${PORT}/api/docs`);
      console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
      console.log('='.repeat(50) + '\n');
      
      // Log de seguridad
      SecurityAudit.logSecurityEvent('SERVER_STARTED', {
        port: PORT,
        environment: process.env.NODE_ENV,
        database: mongoose.connection.db.databaseName
      });
    });

  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

// Manejo graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Recibido SIGTERM, cerrando servidor...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Recibido SIGINT, cerrando servidor...');
  await mongoose.connection.close();
  process.exit(0);
});

// Iniciar aplicación
startServer();

module.exports = app;