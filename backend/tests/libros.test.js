const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Usuario = require('../models/Usuario');
const Libro = require('../models/Libro');
const EncryptionService = require('../middleware/encryption');

describe('📚 Pruebas de Gestión de Libros', () => {
  let adminToken;
  let userToken;
  let testLibro;
  let adminUser;
  let regularUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/biblioteca-digital-test');
  });

  beforeEach(async () => {
    // Limpiar base de datos
    await Usuario.deleteMany({});
    await Libro.deleteMany({});

    // Crear usuario administrador
    adminUser = new Usuario({
      nombre: EncryptionService.encrypt('Administrador'),
      email: 'admin@test.com',
      password: 'Admin123!',
      rol: 'admin'
    });
    await adminUser.save();

    // Crear usuario regular
    regularUser = new Usuario({
      nombre: EncryptionService.encrypt('Usuario Regular'),
      email: 'user@test.com',
      password: 'User123!',
      rol: 'usuario'
    });
    await regularUser.save();

    // Crear libro de prueba
    testLibro = new Libro({
      titulo: 'Libro de Prueba',
      autor: 'Autor de Prueba',
      isbn: '9781234567890',
      editorial: 'Editorial Prueba',
      año: 2024,
      genero: 'Ficción',
      descripcion: 'Descripción del libro de prueba',
      ejemplares: 5,
      ejemplaresDisponibles: 5
    });
    await testLibro.save();

    // Obtener tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin123!' });
    adminToken = adminLogin.body.data.token;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'User123!' });
    userToken = userLogin.body.data.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/libros', () => {
    test('debería listar libros con paginación', async () => {
      const response = await request(app)
        .get('/api/libros')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('libros');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.libros)).toBe(true);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('limit', 10);
    });

    test('debería filtrar libros por búsqueda', async () => {
      const response = await request(app)
        .get('/api/libros?search=prueba')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.libros.length).toBeGreaterThan(0);
      expect(response.body.data.libros[0].titulo).toContain('Prueba');
    });

    test('debería fallar sin autenticación', async () => {
      const response = await request(app)
        .get('/api/libros')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/libros/buscar', () => {
    test('debería buscar libros con múltiples criterios', async () => {
      const response = await request(app)
        .get('/api/libros/buscar?q=prueba&genero=Ficción')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('libros');
      expect(response.body.data).toHaveProperty('total');
    });

    test('debería filtrar por disponibilidad', async () => {
      const response = await request(app)
        .get('/api/libros/buscar?disponible=true')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.libros.forEach(libro => {
        expect(libro.ejemplaresDisponibles).toBeGreaterThan(0);
      });
    });
  });

  describe('GET /api/libros/:id', () => {
    test('debería obtener un libro por ID', async () => {
      const response = await request(app)
        .get(`/api/libros/${testLibro._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.libro._id).toBe(testLibro._id.toString());
      expect(response.body.data.libro.titulo).toBe(testLibro.titulo);
    });

    test('debería fallar con ID inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/libros/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no encontrado');
    });

    test('debería fallar con ID inválido', async () => {
      const response = await request(app)
        .get('/api/libros/id-invalido')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ID no válido');
    });
  });

  describe('POST /api/libros', () => {
    test('debería crear un nuevo libro (admin)', async () => {
      const nuevoLibro = {
        titulo: 'Nuevo Libro de Test',
        autor: 'Autor Test',
        isbn: '9789876543210',
        editorial: 'Editorial Test',
        año: 2024,
        genero: 'Ciencia Ficción',
        descripcion: 'Descripción del nuevo libro',
        ejemplares: 3
      };

      const response = await request(app)
        .post('/api/libros')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(nuevoLibro)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.libro.titulo).toBe(nuevoLibro.titulo);
      expect(response.body.data.libro.ejemplaresDisponibles).toBe(nuevoLibro.ejemplares);
    });

    test('debería fallar sin permisos de admin', async () => {
      const nuevoLibro = {
        titulo: 'Libro No Autorizado',
        autor: 'Autor',
        isbn: '9781111111111',
        ejemplares: 1
      };

      const response = await request(app)
        .post('/api/libros')
        .set('Authorization', `Bearer ${userToken}`)
        .send(nuevoLibro)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Permisos insuficientes');
    });

    test('debería fallar con ISBN duplicado', async () => {
      const libroDuplicado = {
        titulo: 'Libro Duplicado',
        autor: 'Autor',
        isbn: testLibro.isbn, // ISBN ya existe
        ejemplares: 1
      };

      const response = await request(app)
        .post('/api/libros')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(libroDuplicado)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ISBN ya existe');
    });

    test('debería fallar con datos inválidos', async () => {
      const libroInvalido = {
        titulo: '', // Título vacío
        autor: 'A',
        isbn: '123', // ISBN inválido
        ejemplares: -1 // Ejemplares negativos
      };

      const response = await request(app)
        .post('/api/libros')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(libroInvalido)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details.errors).toBeDefined();
    });
  });

  describe('PUT /api/libros/:id', () => {
    test('debería actualizar un libro existente (admin)', async () => {
      const updates = {
        titulo: 'Título Actualizado',
        ejemplares: 10,
        descripcion: 'Descripción actualizada'
      };

      const response = await request(app)
        .put(`/api/libros/${testLibro._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.libro.titulo).toBe(updates.titulo);
      expect(response.body.data.libro.ejemplares).toBe(updates.ejemplares);
    });

    test('debería ajustar ejemplares disponibles al actualizar', async () => {
      // Primero prestar un ejemplar
      testLibro.ejemplaresDisponibles = 3;
      await testLibro.save();

      const updates = {
        ejemplares: 8 // Aumentar ejemplares totales
      };

      const response = await request(app)
        .put(`/api/libros/${testLibro._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.libro.ejemplares).toBe(8);
      expect(response.body.data.libro.ejemplaresDisponibles).toBe(6); // 3 + (8-5)
    });

    test('debería fallar al actualizar libro inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/libros/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ titulo: 'Actualizado' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/libros/:id', () => {
    test('debería eliminar (soft delete) un libro (admin)', async () => {
      const response = await request(app)
        .delete(`/api/libros/${testLibro._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar que el libro sigue en la base de datos pero marcado como inactivo
      const libroEliminado = await Libro.findById(testLibro._id);
      expect(libroEliminado).toBeDefined();
      expect(libroEliminado.activo).toBe(false);
    });

    test('debería fallar al eliminar libro con préstamos activos', async () => {
      // Simular préstamos activos estableciendo ejemplares prestados
      testLibro.ejemplaresDisponibles = 0;
      await testLibro.save();

      const response = await request(app)
        .delete(`/api/libros/${testLibro._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('préstamos activos');
    });

    test('debería fallar sin permisos de admin', async () => {
      const response = await request(app)
        .delete(`/api/libros/${testLibro._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/libros/:id/disponibilidad', () => {
    test('debería verificar disponibilidad del libro', async () => {
      const response = await request(app)
        .get(`/api/libros/${testLibro._id}/disponibilidad`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.disponibilidad).toHaveProperty('disponible', true);
      expect(response.body.data.disponibilidad).toHaveProperty('ejemplaresDisponibles', 5);
      expect(response.body.data.disponibilidad).toHaveProperty('puedePrestar', true);
    });

    test('debería mostrar no disponible cuando no hay ejemplares', async () => {
      testLibro.ejemplaresDisponibles = 0;
      await testLibro.save();

      const response = await request(app)
        .get(`/api/libros/${testLibro._id}/disponibilidad`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data.disponibilidad.disponible).toBe(false);
      expect(response.body.data.disponibilidad.puedePrestar).toBe(false);
    });
  });

  describe('GET /api/libros/estadisticas/generos', () => {
    test('debería obtener estadísticas por género', async () => {
      // Crear más libros de diferentes géneros
      await Libro.create([
        {
          titulo: 'Libro Ficción 1',
          autor: 'Autor 1',
          isbn: '9781111111111',
          genero: 'Ficción',
          ejemplares: 2,
          ejemplaresDisponibles: 2
        },
        {
          titulo: 'Libro Ciencia 1',
          autor: 'Autor 2',
          isbn: '9782222222222',
          genero: 'Ciencia',
          ejemplares: 3,
          ejemplaresDisponibles: 1
        }
      ]);

      const response = await request(app)
        .get('/api/libros/estadisticas/generos')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.estadisticas.length).toBeGreaterThan(0);
      
      const ficcionStats = response.body.data.estadisticas.find(s => s.genero === 'Ficción');
      expect(ficcionStats).toBeDefined();
      expect(ficcionStats.totalLibros).toBe(2); // TestLibro + nuevo libro
    });
  });

  describe('Validación y Sanitización', () => {
    test('debería sanitizar entrada contra XSS', async () => {
      const libroConXSS = {
        titulo: 'Libro <script>alert("xss")</script>',
        autor: 'Autor <img src=x onerror=alert(1)>',
        isbn: '9783333333333',
        ejemplares: 1
      };

      const response = await request(app)
        .post('/api/libros')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(libroConXSS)
        .expect(201);

      // El script debería ser escapado/sanitizado
      expect(response.body.data.libro.titulo).not.toContain('<script>');
      expect(response.body.data.libro.autor).not.toContain('<img');
    });

    test('debería validar formato de ISBN', async () => {
      const libroISBNInvalido = {
        titulo: 'Libro ISBN Inválido',
        autor: 'Autor',
        isbn: '123', // ISBN muy corto
        ejemplares: 1
      };

      const response = await request(app)
        .post('/api/libros')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(libroISBNInvalido)
        .expect(400);

      expect(response.body.details.errors[0].msg).toContain('ISBN');
    });
  });

  describe('Pruebas de Rendimiento', () => {
    test('debería manejar grandes volúmenes de libros', async () => {
      // Crear 50 libros de prueba
      const libros = [];
      for (let i = 0; i < 50; i++) {
        libros.push({
          titulo: `Libro de Prueba ${i}`,
          autor: `Autor ${i}`,
          isbn: `9780000000${i.toString().padStart(3, '0')}`,
          genero: i % 2 === 0 ? 'Ficción' : 'No Ficción',
          ejemplares: Math.floor(Math.random() * 10) + 1,
          ejemplaresDisponibles: Math.floor(Math.random() * 10) + 1
        });
      }
      await Libro.insertMany(libros);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/libros?limit=50')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.libros).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Debería responder en menos de 1 segundo
    });
  });
});