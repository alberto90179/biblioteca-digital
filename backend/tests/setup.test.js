// Configuración global para las pruebas
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Configuración antes de todas las pruebas
beforeAll(async () => {
  // Usar MongoDB en memoria para pruebas
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Configurar variables de entorno para pruebas
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI_TEST = mongoUri;
  process.env.JWT_SECRET = 'test-jwt-secret-very-secure-for-testing-only';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-very-secure-for-testing';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';

  // Conectar a MongoDB en memoria
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log('✅ MongoDB en memoria iniciado para pruebas');
});

// Limpieza después de todas las pruebas
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('✅ MongoDB en memoria detenido');
});

// Configuración global para Jest
jest.setTimeout(30000); // 30 segundos timeout para pruebas

// Mocks globales
global.console = {
  ...console,
  // Silenciar console.log durante las pruebas, pero mantener errores
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Utilidades de testing
global.testUtils = {
  // Generar datos de prueba
  generateTestUser: (overrides = {}) => ({
    nombre: 'Usuario Test',
    email: `test${Date.now()}@test.com`,
    password: 'Test123!',
    rol: 'usuario',
    ...overrides
  }),

  generateTestBook: (overrides = {}) => ({
    titulo: 'Libro Test',
    autor: 'Autor Test',
    isbn: `978${Date.now().toString().slice(-9)}`,
    editorial: 'Editorial Test',
    año: 2024,
    genero: 'Ficción',
    descripcion: 'Descripción de prueba',
    ejemplares: 5,
    ejemplaresDisponibles: 5,
    ...overrides
  }),

  generateTestLoan: (overrides = {}) => ({
    libroId: new mongoose.Types.ObjectId(),
    usuarioId: new mongoose.Types.ObjectId(),
    fechaPrestamo: new Date(),
    fechaDevolucion: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 días después
    estado: 'activo',
    ...overrides
  }),

  // Esperar con timeout personalizado
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Verificar estructura de respuesta API
  validateApiResponse: (response, expectedStructure) => {
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('message');
    
    if (expectedStructure.data) {
      expect(response.body).toHaveProperty('data');
      
      Object.keys(expectedStructure.data).forEach(key => {
        expect(response.body.data).toHaveProperty(key);
        
        if (expectedStructure.data[key] === 'array') {
          expect(Array.isArray(response.body.data[key])).toBe(true);
        } else if (typeof expectedStructure.data[key] === 'object') {
          expect(typeof response.body.data[key]).toBe('object');
        }
      });
    }
  }
};

// Custom matchers para Jest
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    return {
      message: () => `expected ${received} to be a valid MongoDB ObjectId`,
      pass
    };
  },

  toBeApiSuccess(received) {
    const pass = received.body && received.body.success === true;
    return {
      message: () => `expected API response to be successful`,
      pass
    };
  },

  toBeApiError(received, expectedStatus) {
    const statusPass = expectedStatus ? received.status === expectedStatus : true;
    const bodyPass = received.body && received.body.success === false;
    const pass = statusPass && bodyPass;
    
    return {
      message: () => `expected API response to be an error${expectedStatus ? ` with status ${expectedStatus}` : ''}`,
      pass
    };
  },

  toHavePagination(received) {
    const pass = received.body.data && 
                 received.body.data.pagination && 
                 typeof received.body.data.pagination === 'object';
    return {
      message: () => `expected API response to have pagination data`,
      pass
    };
  }
});

// Extender los tipos de TypeScript para los custom matchers
// (Este archivo es JavaScript; las declaraciones de TypeScript se han eliminado.
// Si usas TypeScript, coloca estas declaraciones en un archivo .d.ts separado.)

// Mock para servicios externos
jest.mock('../services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
  sendLoanCreatedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendLoanReminderEmail: jest.fn().mockResolvedValue({ success: true }),
  sendOverdueNoticeEmail: jest.fn().mockResolvedValue({ success: true }),
  getStatus: jest.fn().mockReturnValue({ initialized: true, canSend: true })
}));

jest.mock('../services/notificationService', () => ({
  sendWelcomeNotification: jest.fn().mockResolvedValue({ success: true }),
  sendLoanCreatedNotification: jest.fn().mockResolvedValue({ success: true }),
  sendLoanReminderNotification: jest.fn().mockResolvedValue({ success: true }),
  sendOverdueNotification: jest.fn().mockResolvedValue({ success: true }),
  processAutomaticReminders: jest.fn().mockResolvedValue({ success: true, remindersSent: 0 }),
  getStatus: jest.fn().mockReturnValue({ emailService: { initialized: true }, preferences: {} })
}));

jest.mock('../services/backupService', () => ({
  createBackup: jest.fn().mockResolvedValue({ success: true, backupId: 'test-backup' }),
  restoreBackup: jest.fn().mockResolvedValue({ success: true }),
  getBackupList: jest.fn().mockReturnValue([]),
  getStatus: jest.fn().mockReturnValue({ backupDir: '/tmp', exists: true })
}));

// Configuración para supertest
const request = require('supertest');
const app = require('../server');

global.request = request;
global.app = app;

// Helper para autenticación en tests
global.getAuthToken = async (email = 'admin@test.com', password = 'Admin123!') => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  
  return response.body.data.token;
};

// Helper para crear usuario de prueba
global.createTestUser = async (userData = {}) => {
  const User = require('../models/Usuario');
  const EncryptionService = require('../middleware/encryption');
  
  const user = new User({
    nombre: EncryptionService.encrypt(userData.nombre || 'Test User'),
    email: userData.email || `test${Date.now()}@test.com`,
    password: userData.password || 'Test123!',
    rol: userData.rol || 'usuario',
    ...userData
  });
  
  return await user.save();
};

// Helper para crear libro de prueba
global.createTestBook = async (bookData = {}) => {
  const Book = require('../models/Libro');
  
  const book = new Book({
    titulo: bookData.titulo || 'Test Book',
    autor: bookData.autor || 'Test Author',
    isbn: bookData.isbn || `978${Date.now().toString().slice(-9)}`,
    editorial: bookData.editorial || 'Test Publisher',
    año: bookData.año || 2024,
    genero: bookData.genero || 'Fiction',
    descripcion: bookData.descripcion || 'Test description',
    ejemplares: bookData.ejemplares || 5,
    ejemplaresDisponibles: bookData.ejemplaresDisponibles || 5,
    ...bookData
  });
  
  return await book.save();
};

console.log('✅ Configuración de pruebas completada');