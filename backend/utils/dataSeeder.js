const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');
const Libro = require('../models/Libro');
const Prestamo = require('../models/Prestamo');
const EncryptionService = require('../middleware/encryption');
require('dotenv').config();

class DataSeeder {
  constructor() {
    this.usuarios = [];
    this.libros = [];
    this.prestamos = [];
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Conectado a MongoDB para seeding');
    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error);
      process.exit(1);
    }
  }

  async clearDatabase() {
    try {
      await Usuario.deleteMany({});
      await Libro.deleteMany({});
      await Prestamo.deleteMany({});
      console.log('🗑️  Base de datos limpiada');
    } catch (error) {
      console.error('❌ Error limpiando base de datos:', error);
    }
  }

  async seedUsuarios() {
    const usuariosData = [
      {
        nombre: 'Administrador Principal',
        email: 'admin@biblioteca.com',
        password: 'Admin123!',
        rol: 'admin'
      },
      {
        nombre: 'Juan Pérez',
        email: 'juan.perez@email.com',
        password: 'Usuario123!',
        rol: 'usuario'
      },
      {
        nombre: 'María García',
        email: 'maria.garcia@email.com',
        password: 'Usuario123!',
        rol: 'usuario'
      },
      {
        nombre: 'Carlos López',
        email: 'carlos.lopez@email.com',
        password: 'Usuario123!',
        rol: 'usuario'
      },
      {
        nombre: 'Ana Martínez',
        email: 'ana.martinez@email.com',
        password: 'Usuario123!',
        rol: 'usuario'
      }
    ];

    try {
      for (const userData of usuariosData) {
        const usuario = new Usuario({
          ...userData,
          nombre: EncryptionService.encrypt(userData.nombre)
        });
        await usuario.save();
        this.usuarios.push(usuario);
      }
      console.log(`✅ ${this.usuarios.length} usuarios creados`);
    } catch (error) {
      console.error('❌ Error creando usuarios:', error);
    }
  }

  async seedLibros() {
    const librosData = [
      {
        titulo: 'Cien años de soledad',
        autor: 'Gabriel García Márquez',
        isbn: '9788437604947',
        editorial: 'Sudamericana',
        año: 1967,
        genero: 'Realismo mágico',
        descripcion: 'Una obra maestra de la literatura latinoamericana que narra la historia de la familia Buendía en el pueblo ficticio de Macondo.',
        ejemplares: 5,
        imagen: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400',
        tags: ['clásico', 'latinoamericano', 'magia']
      },
      {
        titulo: '1984',
        autor: 'George Orwell',
        isbn: '9780451524935',
        editorial: 'Secker & Warburg',
        año: 1949,
        genero: 'Ciencia ficción',
        descripcion: 'Una distopía que explora los peligros del totalitarismo y la vigilancia masiva.',
        ejemplares: 3,
        imagen: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        tags: ['distopía', 'política', 'clásico']
      },
      {
        titulo: 'El Principito',
        autor: 'Antoine de Saint-Exupéry',
        isbn: '9780156012195',
        editorial: 'Reynal & Hitchcock',
        año: 1943,
        genero: 'Fábula',
        descripcion: 'Una conmovedora historia sobre la amistad, el amor y la pérdida de la inocencia.',
        ejemplares: 4,
        imagen: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?w=400',
        tags: ['infantil', 'filosófico', 'aventura']
      },
      {
        titulo: 'Don Quijote de la Mancha',
        autor: 'Miguel de Cervantes',
        isbn: '9788467034267',
        editorial: 'Francisco de Robles',
        año: 1605,
        genero: 'Novela',
        descripcion: 'Considerada la primera novela moderna y una de las mejores obras de la literatura universal.',
        ejemplares: 2,
        tags: ['clásico', 'español', 'aventura']
      },
      {
        titulo: 'Harry Potter y la piedra filosofal',
        autor: 'J.K. Rowling',
        isbn: '9788478884452',
        editorial: 'Salamandra',
        año: 1997,
        genero: 'Fantasía',
        descripcion: 'El primer libro de la serie que sigue las aventuras del joven mago Harry Potter.',
        ejemplares: 6,
        imagen: 'https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?w=400',
        tags: ['fantasía', 'magia', 'aventura']
      },
      {
        titulo: 'Orgullo y prejuicio',
        autor: 'Jane Austen',
        isbn: '9780141439518',
        editorial: 'T. Egerton',
        año: 1813,
        genero: 'Romance',
        descripcion: 'Una comedia romántica que explora las costumbres de la sociedad británica del siglo XIX.',
        ejemplares: 3,
        tags: ['romance', 'clásico', 'británico']
      },
      {
        titulo: 'Crónica de una muerte anunciada',
        autor: 'Gabriel García Márquez',
        isbn: '9788437604948',
        editorial: 'La Oveja Negra',
        año: 1981,
        genero: 'Novela',
        descripcion: 'Una novela basada en un hecho real ocurrido en Colombia en 1951.',
        ejemplares: 4,
        tags: ['realismo', 'drama', 'colombiano']
      },
      {
        titulo: 'El nombre del viento',
        autor: 'Patrick Rothfuss',
        isbn: '9788401337208',
        editorial: 'Plaza & Janés',
        año: 2007,
        genero: 'Fantasía',
        descripcion: 'La historia de Kvothe, un personaje legendario que relata su propia vida.',
        ejemplares: 3,
        tags: ['fantasía', 'aventura', 'magia']
      }
    ];

    try {
      for (const libroData of librosData) {
        const libro = new Libro(libroData);
        await libro.save();
        this.libros.push(libro);
      }
      console.log(`✅ ${this.libros.length} libros creados`);
    } catch (error) {
      console.error('❌ Error creando libros:', error);
    }
  }

  async seedPrestamos() {
    try {
      // Crear algunos préstamos de ejemplo
      const prestamosData = [
        {
          libroId: this.libros[0]._id,
          usuarioId: this.usuarios[1]._id,
          fechaPrestamo: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 días atrás
          fechaDevolucion: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 días en futuro
          estado: 'activo'
        },
        {
          libroId: this.libros[1]._id,
          usuarioId: this.usuarios[2]._id,
          fechaPrestamo: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 días atrás
          fechaDevolucion: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 días atrás (vencido)
          estado: 'vencido'
        },
        {
          libroId: this.libros[2]._id,
          usuarioId: this.usuarios[3]._id,
          fechaPrestamo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
          fechaDevolucion: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 días atrás
          fechaDevolucionReal: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 días atrás
          estado: 'devuelto'
        }
      ];

      for (const prestamoData of prestamosData) {
        const prestamo = new Prestamo(prestamoData);
        await prestamo.save();
        this.prestamos.push(prestamo);
      }
      console.log(`✅ ${this.prestamos.length} préstamos creados`);
    } catch (error) {
      console.error('❌ Error creando préstamos:', error);
    }
  }

  async seedAll() {
    try {
      await this.connectDB();
      await this.clearDatabase();
      
      await this.seedUsuarios();
      await this.seedLibros();
      await this.seedPrestamos();
      
      console.log('\n🎉 Seeding completado exitosamente!');
      console.log('📊 Resumen:');
      console.log(`   👥 Usuarios: ${this.usuarios.length}`);
      console.log(`   📚 Libros: ${this.libros.length}`);
      console.log(`   🔄 Préstamos: ${this.prestamos.length}`);
      
      console.log('\n🔑 Credenciales de prueba:');
      console.log('   Admin: admin@biblioteca.com / Admin123!');
      console.log('   Usuario: juan.perez@email.com / Usuario123!');
      
    } catch (error) {
      console.error('❌ Error en el seeding:', error);
    } finally {
      await mongoose.connection.close();
      console.log('\n📋 Conexión a MongoDB cerrada');
    }
  }
}

// Ejecutar seeding si se llama directamente
if (require.main === module) {
  const seeder = new DataSeeder();
  seeder.seedAll();
}

module.exports = DataSeeder;