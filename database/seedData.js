const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Función para encriptar datos (simulada para el seed)
function encryptData(text) {
    return {
        iv: crypto.randomBytes(16).toString('hex'),
        data: text,
        tag: crypto.randomBytes(8).toString('hex')
    };
}

// Función para generar IDs consistentes
function generateId(prefix) {
    return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

// Datos de semilla
const seedData = async () => {
    try {
        console.log('🌱 Iniciando población de datos de prueba...');

        // Obtener modelos
        const Usuario = mongoose.model('Usuario');
        const Libro = mongoose.model('Libro');
        const Prestamo = mongoose.model('Prestamo');
        const Tag = mongoose.model('Tag');
        const AuditoriaSeguridad = mongoose.model('AuditoriaSeguridad');
        const Notificacion = mongoose.model('Notificacion');

        // Limpiar colecciones existentes
        console.log('🧹 Limpiando colecciones existentes...');
        await Usuario.deleteMany({});
        await Libro.deleteMany({});
        await Prestamo.deleteMany({});
        await Tag.deleteMany({});
        await AuditoriaSeguridad.deleteMany({});
        await Notificacion.deleteMany({});

        // =============================================
        // TAGS
        // =============================================
        console.log('🏷️ Creando tags...');
        const tags = [
            { nombre: 'ficción' },
            { nombre: 'no-ficción' },
            { nombre: 'ciencia-ficción' },
            { nombre: 'fantasía' },
            { nombre: 'romance' },
            { nombre: 'terror' },
            { nombre: 'misterio' },
            { nombre: 'biografía' },
            { nombre: 'historia' },
            { nombre: 'ciencia' },
            { nombre: 'tecnología' },
            { nombre: 'autoayuda' },
            { nombre: 'negocios' },
            { nombre: 'poesía' },
            { nombre: 'teatro' }
        ];

        const tagsCreados = await Tag.insertMany(tags);
        console.log(`✅ ${tagsCreados.length} tags creados`);

        // =============================================
        // USUARIOS
        // =============================================
        console.log('👥 Creando usuarios...');
        
        // Usuario administrador
        const adminPassword = await bcrypt.hash('Admin123!', 12);
        const adminUser = new Usuario({
            _id: 'admin-001',
            nombre: encryptData('Administrador Principal'),
            email: 'admin@biblioteca.com',
            password: adminPassword,
            rol: 'admin',
            fechaRegistro: new Date('2024-01-01'),
            ultimoAcceso: new Date(),
            activo: true
        });
        await adminUser.save();

        // Usuarios regulares
        const usuariosData = [
            {
                nombre: 'María González López',
                email: 'maria.gonzalez@email.com',
                password: 'Usuario123!',
                fechaRegistro: new Date('2024-02-15')
            },
            {
                nombre: 'Carlos Rodríguez Pérez',
                email: 'carlos.rodriguez@email.com',
                password: 'Usuario123!',
                fechaRegistro: new Date('2024-03-10')
            },
            {
                nombre: 'Ana Martínez Sánchez',
                email: 'ana.martinez@email.com',
                password: 'Usuario123!',
                fechaRegistro: new Date('2024-01-20')
            },
            {
                nombre: 'David Fernández García',
                email: 'david.fernandez@email.com',
                password: 'Usuario123!',
                fechaRegistro: new Date('2024-04-05')
            },
            {
                nombre: 'Laura Jiménez Ruiz',
                email: 'laura.jimenez@email.com',
                password: 'Usuario123!',
                fechaRegistro: new Date('2024-02-28')
            }
        ];

        for (let userData of usuariosData) {
            const hashedPassword = await bcrypt.hash(userData.password, 12);
            const usuario = new Usuario({
                nombre: encryptData(userData.nombre),
                email: userData.email,
                password: hashedPassword,
                rol: 'usuario',
                fechaRegistro: userData.fechaRegistro,
                ultimoAcceso: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Último acceso aleatorio en los últimos 30 días
                activo: true
            });
            await usuario.save();
        }

        const usuariosCreados = await Usuario.find({});
        console.log(`✅ ${usuariosCreados.length} usuarios creados`);

        // =============================================
        // LIBROS
        // =============================================
        console.log('📚 Creando libros...');
        
        const librosData = [
            {
                titulo: 'Cien Años de Soledad',
                autor: 'Gabriel García Márquez',
                isbn: '978-8437604947',
                editorial: 'Cátedra',
                año: 1967,
                genero: 'ficción',
                descripcion: 'Una obra maestra del realismo mágico que narra la historia de la familia Buendía en el pueblo ficticio de Macondo.',
                ejemplares: 5,
                ejemplaresDisponibles: 3,
                imagen: '/images/cien-anos-soledad.jpg',
                ubicacion: 'Estantería A-1',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-05-15'),
                tags: ['ficción', 'realismo mágico']
            },
            {
                titulo: '1984',
                autor: 'George Orwell',
                isbn: '978-8499890944',
                editorial: 'Debolsillo',
                año: 1949,
                genero: 'ciencia-ficción',
                descripcion: 'Una distopía que explora temas de vigilancia masiva y control social en un futuro totalitario.',
                ejemplares: 3,
                ejemplaresDisponibles: 1,
                imagen: '/images/1984.jpg',
                ubicacion: 'Estantería B-2',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-06-20'),
                tags: ['ciencia-ficción', 'distopía']
            },
            {
                titulo: 'El Quijote de la Mancha',
                autor: 'Miguel de Cervantes',
                isbn: '978-8467031456',
                editorial: 'Real Academia Española',
                año: 1605,
                genero: 'ficción',
                descripcion: 'La obra cumbre de la literatura española que narra las aventuras de Don Quijote y Sancho Panza.',
                ejemplares: 4,
                ejemplaresDisponibles: 4,
                imagen: '/images/quijote.jpg',
                ubicacion: 'Estantería A-3',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-01-10'),
                tags: ['ficción', 'clásico']
            },
            {
                titulo: 'Sapiens: De Animales a Dioses',
                autor: 'Yuval Noah Harari',
                isbn: '978-8499926223',
                editorial: 'Debate',
                año: 2014,
                genero: 'historia',
                descripcion: 'Un recorrido por la historia de la humanidad desde la evolución del Homo sapiens hasta la actualidad.',
                ejemplares: 6,
                ejemplaresDisponibles: 2,
                imagen: '/images/sapiens.jpg',
                ubicacion: 'Estantería C-1',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-08-12'),
                tags: ['historia', 'no-ficción']
            },
            {
                titulo: 'Harry Potter y la Piedra Filosofal',
                autor: 'J.K. Rowling',
                isbn: '978-8478884456',
                editorial: 'Salamandra',
                año: 1997,
                genero: 'fantasía',
                descripcion: 'El primer libro de la serie que sigue las aventuras del joven mago Harry Potter en Hogwarts.',
                ejemplares: 8,
                ejemplaresDisponibles: 0,
                imagen: '/images/harry-potter.jpg',
                ubicacion: 'Estantería D-1',
                estado: 'prestado',
                fechaAdquisicion: new Date('2023-03-25'),
                tags: ['fantasía', 'aventura']
            },
            {
                titulo: 'El Principito',
                autor: 'Antoine de Saint-Exupéry',
                isbn: '978-8498381498',
                editorial: 'Salamandra',
                año: 1943,
                genero: 'ficción',
                descripcion: 'Una fábula poética sobre la amistad, el amor y la pérdida, con profundas reflexiones sobre la vida.',
                ejemplares: 7,
                ejemplaresDisponibles: 5,
                imagen: '/images/principito.jpg',
                ubicacion: 'Estantería A-2',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-04-18'),
                tags: ['ficción', 'filosófico']
            },
            {
                titulo: 'Crimen y Castigo',
                autor: 'Fyodor Dostoevsky',
                isbn: '978-8420664265',
                editorial: 'Alianza Editorial',
                año: 1866,
                genero: 'misterio',
                descripcion: 'Una exploración psicológica de la culpa y la redención a través de la historia de Raskólnikov.',
                ejemplares: 2,
                ejemplaresDisponibles: 2,
                imagen: '/images/crimen-castigo.jpg',
                ubicacion: 'Estantería B-1',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-07-30'),
                tags: ['misterio', 'psicológico']
            },
            {
                titulo: 'Breves Respuestas a las Grandes Preguntas',
                autor: 'Stephen Hawking',
                isbn: '978-8491990449',
                editorial: 'Crítica',
                año: 2018,
                genero: 'ciencia',
                descripcion: 'El último libro de Hawking que aborda las grandes cuestiones sobre el universo y nuestro lugar en él.',
                ejemplares: 4,
                ejemplaresDisponibles: 4,
                imagen: '/images/hawking.jpg',
                ubicacion: 'Estantería C-3',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-09-05'),
                tags: ['ciencia', 'cosmología']
            },
            {
                titulo: 'Los Juegos del Hambre',
                autor: 'Suzanne Collins',
                isbn: '978-8427202122',
                editorial: 'Molino',
                año: 2008,
                genero: 'ciencia-ficción',
                descripcion: 'Una trilogía distópica donde jóvenes deben competir en un juego televisado a muerte.',
                ejemplares: 5,
                ejemplaresDisponibles: 1,
                imagen: '/images/juegos-hambre.jpg',
                ubicacion: 'Estantería D-2',
                estado: 'disponible',
                fechaAdquisicion: new Date('2023-10-15'),
                tags: ['ciencia-ficción', 'distopía']
            },
            {
                titulo: 'El Alquimista',
                autor: 'Paulo Coelho',
                isbn: '978-8408043643',
                editorial: 'Planeta',
                año: 1988,
                genero: 'ficción',
                descripcion: 'Una fábula espiritual sobre seguir los sueños y escuchar al corazón.',
                ejemplares: 6,
                ejemplaresDisponibles: 0,
                imagen: '/images/alquimista.jpg',
                ubicacion: 'Estantería A-4',
                estado: 'prestado',
                fechaAdquisicion: new Date('2023-02-28'),
                tags: ['ficción', 'espiritual']
            }
        ];

        // Asignar tags a los libros
        for (let libroData of librosData) {
            const tagIds = [];
            for (let tagNombre of libroData.tags) {
                const tag = tagsCreados.find(t => t.nombre === tagNombre);
                if (tag) {
                    tagIds.push(tag._id);
                }
            }
            
            const libro = new Libro({
                ...libroData,
                tags: tagIds
            });
            await libro.save();
        }

        const librosCreados = await Libro.find({});
        console.log(`✅ ${librosCreados.length} libros creados`);

        // =============================================
        // PRÉSTAMOS
        // =============================================
        console.log('📖 Creando préstamos...');
        
        const usuarios = await Usuario.find({ rol: 'usuario' });
        const libros = await Libro.find({});

        const prestamosData = [
            {
                usuario: usuarios[0], // María
                libro: libros[4], // Harry Potter
                fechaPrestamo: new Date('2024-05-01'),
                fechaDevolucion: new Date('2024-05-16'),
                estado: 'activo',
                diasPrestamo: 15,
                renovaciones: 0
            },
            {
                usuario: usuarios[1], // Carlos
                libro: libros[9], // El Alquimista
                fechaPrestamo: new Date('2024-05-03'),
                fechaDevolucion: new Date('2024-05-18'),
                estado: 'activo',
                diasPrestamo: 15,
                renovaciones: 1
            },
            {
                usuario: usuarios[2], // Ana
                libro: libros[1], // 1984
                fechaPrestamo: new Date('2024-04-20'),
                fechaDevolucion: new Date('2024-05-05'),
                fechaDevolucionReal: new Date('2024-05-04'),
                estado: 'devuelto',
                diasPrestamo: 15,
                renovaciones: 0
            },
            {
                usuario: usuarios[3], // David
                libro: libros[3], // Sapiens
                fechaPrestamo: new Date('2024-04-25'),
                fechaDevolucion: new Date('2024-05-10'),
                estado: 'activo',
                diasPrestamo: 15,
                renovaciones: 0
            },
            {
                usuario: usuarios[0], // María
                libro: libros[8], // Los Juegos del Hambre
                fechaPrestamo: new Date('2024-04-15'),
                fechaDevolucion: new Date('2024-04-30'),
                fechaDevolucionReal: new Date('2024-05-02'),
                estado: 'vencido',
                diasPrestamo: 15,
                renovaciones: 0,
                multaMonto: 10.00,
                multaMotivo: 'Retraso de 2 días',
                multaPagada: false
            },
            {
                usuario: usuarios[4], // Laura
                libro: libros[0], // Cien Años de Soledad
                fechaPrestamo: new Date('2024-04-10'),
                fechaDevolucion: new Date('2024-04-25'),
                fechaDevolucionReal: new Date('2024-04-24'),
                estado: 'devuelto',
                diasPrestamo: 15,
                renovaciones: 0
            }
        ];

        for (let prestamoData of prestamosData) {
            const prestamo = new Prestamo(prestamoData);
            await prestamo.save();
        }

        const prestamosCreados = await Prestamo.find({});
        console.log(`✅ ${prestamosCreados.length} préstamos creados`);

        // =============================================
        // AUDITORÍA DE SEGURIDAD
        // =============================================
        console.log('🔒 Creando registros de auditoría...');
        
        const eventosAuditoria = [
            {
                tipoEvento: 'login_exitoso',
                severidad: 'info',
                usuario: usuarios[0]._id,
                detalles: {
                    metodo: 'email_password',
                    dispositivo: 'Chrome 112, Windows 10'
                },
                ip: '192.168.1.100',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            {
                tipoEvento: 'libro_prestado',
                severidad: 'info',
                usuario: usuarios[1]._id,
                detalles: {
                    libroId: libros[4]._id,
                    libroTitulo: 'Harry Potter y la Piedra Filosofal',
                    diasPrestamo: 15
                },
                ip: '192.168.1.101',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            {
                tipoEvento: 'intento_login_fallido',
                severidad: 'warning',
                usuario: usuarios[2]._id,
                detalles: {
                    motivo: 'password_incorrecto',
                    intentos: 2
                },
                ip: '192.168.1.102',
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
            },
            {
                tipoEvento: 'libro_devuelto',
                severidad: 'info',
                usuario: usuarios[3]._id,
                detalles: {
                    libroId: libros[1]._id,
                    libroTitulo: '1984',
                    diasRetraso: 0
                },
                ip: '192.168.1.103',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        ];

        // Crear eventos de auditoría en diferentes fechas
        for (let i = 0; i < eventosAuditoria.length; i++) {
            const evento = eventosAuditoria[i];
            const fechaEvento = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)); // Días diferentes
            
            const auditoria = new AuditoriaSeguridad({
                ...evento,
                timestamp: fechaEvento
            });
            await auditoria.save();
        }

        console.log(`✅ ${eventosAuditoria.length} registros de auditoría creados`);

        // =============================================
        // NOTIFICACIONES
        // =============================================
        console.log('📧 Creando notificaciones...');
        
        const notificacionesData = [
            {
                tipo: 'email',
                subtipo: 'recordatorio_devolucion',
                usuario: usuarios[0]._id,
                prestamo: prestamosCreados[0]._id,
                libro: libros[4]._id,
                exito: true,
                mensajeId: 'msg_001',
                detalles: {
                    asunto: 'Recordatorio de devolución',
                    destinatario: 'maria.gonzalez@email.com',
                    libro: 'Harry Potter y la Piedra Filosofal'
                }
            },
            {
                tipo: 'email',
                subtipo: 'bienvenida',
                usuario: usuarios[4]._id,
                exito: true,
                mensajeId: 'msg_002',
                detalles: {
                    asunto: 'Bienvenida a la Biblioteca Digital',
                    destinatario: 'laura.jimenez@email.com'
                }
            },
            {
                tipo: 'sms',
                subtipo: 'alerta_multa',
                usuario: usuarios[0]._id,
                prestamo: prestamosCreados[4]._id,
                exito: false,
                error: 'Número de teléfono no válido',
                detalles: {
                    monto: 10.00,
                    diasRetraso: 2
                }
            }
        ];

        // Crear notificaciones en diferentes fechas
        for (let i = 0; i < notificacionesData.length; i++) {
            const notificacion = notificacionesData[i];
            const fechaNotificacion = new Date(Date.now() - (i * 2 * 24 * 60 * 60 * 1000)); // Cada 2 días
            
            const nuevaNotificacion = new Notificacion({
                ...notificacion,
                timestamp: fechaNotificacion
            });
            await nuevaNotificacion.save();
        }

        console.log(`✅ ${notificacionesData.length} notificaciones creadas`);

        // =============================================
        // RESUMEN FINAL
        // =============================================
        console.log('\n🎉 POBLACIÓN DE DATOS COMPLETADA');
        console.log('================================');
        console.log(`👥 Usuarios: ${usuariosCreados.length}`);
        console.log(`📚 Libros: ${librosCreados.length}`);
        console.log(`📖 Préstamos: ${prestamosCreados.length}`);
        console.log(`🏷️ Tags: ${tagsCreados.length}`);
        console.log(`🔒 Registros de auditoría: ${eventosAuditoria.length}`);
        console.log(`📧 Notificaciones: ${notificacionesData.length}`);
        console.log('\n💡 Datos de acceso:');
        console.log('   Admin: admin@biblioteca.com / Admin123!');
        console.log('   Usuarios: [cualquier usuario] / Usuario123!');
        console.log('\n✅ Base de datos lista para usar!');

    } catch (error) {
        console.error('❌ Error durante la población de datos:', error);
        throw error;
    }
};

module.exports = seedData;