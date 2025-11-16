const express = require('express');
const router = express.Router();
const libroController = require('../controllers/libroController');
const { requireAuth, requireRole } = require('../middleware/security');
const { validateLibro, validateObjectId, validateSearch, handleValidationErrors } = require('../middleware/validation');

/**
 * @swagger
 * components:
 *   schemas:
 *     Libro:
 *       type: object
 *       required:
 *         - titulo
 *         - autor
 *         - isbn
 *         - ejemplares
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único del libro
 *         titulo:
 *           type: string
 *           description: Título del libro
 *         autor:
 *           type: string
 *           description: Autor del libro
 *         isbn:
 *           type: string
 *           description: ISBN del libro
 *         editorial:
 *           type: string
 *           description: Editorial del libro
 *         año:
 *           type: integer
 *           description: Año de publicación
 *         genero:
 *           type: string
 *           description: Género literario
 *         descripcion:
 *           type: string
 *           description: Descripción del libro
 *         ejemplares:
 *           type: integer
 *           description: Número total de ejemplares
 *         ejemplaresDisponibles:
 *           type: integer
 *           description: Número de ejemplares disponibles
 *         imagen:
 *           type: string
 *           description: URL de la imagen del libro
 *         estado:
 *           type: string
 *           enum: [disponible, prestado, mantenimiento, retirado]
 *           description: Estado actual del libro
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Etiquetas del libro
 */

/**
 * @swagger
 * /api/libros:
 *   get:
 *     summary: Obtener todos los libros
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Límite de resultados por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *     responses:
 *       200:
 *         description: Lista de libros obtenida exitosamente
 *       401:
 *         description: No autorizado
 */
router.get('/', requireAuth, validateSearch, libroController.getLibros);

/**
 * @swagger
 * /api/libros/buscar:
 *   get:
 *     summary: Búsqueda avanzada de libros
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Término de búsqueda
 *       - in: query
 *         name: genero
 *         schema:
 *           type: string
 *         description: Filtrar por género
 *       - in: query
 *         name: autor
 *         schema:
 *           type: string
 *         description: Filtrar por autor
 *       - in: query
 *         name: disponible
 *         schema:
 *           type: boolean
 *         description: Filtrar por disponibilidad
 *     responses:
 *       200:
 *         description: Resultados de búsqueda
 */
router.get('/buscar', requireAuth, libroController.buscarLibros);

/**
 * @swagger
 * /api/libros/{id}:
 *   get:
 *     summary: Obtener libro por ID
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del libro
 *     responses:
 *       200:
 *         description: Libro encontrado
 *       404:
 *         description: Libro no encontrado
 */
router.get('/:id', requireAuth, validateObjectId, libroController.getLibroById);

/**
 * @swagger
 * /api/libros:
 *   post:
 *     summary: Crear nuevo libro (Solo administradores)
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Libro'
 *     responses:
 *       201:
 *         description: Libro creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Permisos insuficientes
 */
router.post('/', requireAuth, requireRole(['admin']), validateLibro, libroController.crearLibro);

/**
 * @swagger
 * /api/libros/{id}:
 *   put:
 *     summary: Actualizar libro (Solo administradores)
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del libro
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Libro'
 *     responses:
 *       200:
 *         description: Libro actualizado exitosamente
 *       404:
 *         description: Libro no encontrado
 */
router.put('/:id', requireAuth, requireRole(['admin']), validateObjectId, validateLibro, libroController.actualizarLibro);

/**
 * @swagger
 * /api/libros/{id}:
 *   delete:
 *     summary: Eliminar libro (Solo administradores)
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del libro
 *     responses:
 *       200:
 *         description: Libro eliminado exitosamente
 *       404:
 *         description: Libro no encontrado
 */
router.delete('/:id', requireAuth, requireRole(['admin']), validateObjectId, libroController.eliminarLibro);

/**
 * @swagger
 * /api/libros/{id}/disponibilidad:
 *   get:
 *     summary: Verificar disponibilidad de libro
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del libro
 *     responses:
 *       200:
 *         description: Estado de disponibilidad
 */
router.get('/:id/disponibilidad', requireAuth, validateObjectId, libroController.verificarDisponibilidad);

/**
 * @swagger
 * /api/libros/estadisticas/generos:
 *   get:
 *     summary: Obtener estadísticas por género
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas por género
 */
router.get('/estadisticas/generos', requireAuth, libroController.getEstadisticasGeneros);

/**
 * @swagger
 * /api/libros/estadisticas/populares:
 *   get:
 *     summary: Obtener libros más populares
 *     tags: [Libros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Límite de resultados
 *     responses:
 *       200:
 *         description: Lista de libros populares
 */
router.get('/estadisticas/populares', requireAuth, libroController.getLibrosPopulares);

module.exports = router;