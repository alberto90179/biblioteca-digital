const express = require('express');
const router = express.Router();
const prestamoController = require('../controllers/prestamoController');
const { requireAuth, requireRole } = require('../middleware/security');
const { validatePrestamo, validateObjectId } = require('../middleware/validation');

/**
 * @swagger
 * components:
 *   schemas:
 *     Prestamo:
 *       type: object
 *       required:
 *         - libroId
 *         - usuarioId
 *         - fechaDevolucion
 *       properties:
 *         _id:
 *           type: string
 *           description: ID único del préstamo
 *         libroId:
 *           type: string
 *           description: ID del libro prestado
 *         usuarioId:
 *           type: string
 *           description: ID del usuario
 *         fechaPrestamo:
 *           type: string
 *           format: date-time
 *           description: Fecha del préstamo
 *         fechaDevolucion:
 *           type: string
 *           format: date-time
 *           description: Fecha de devolución estimada
 *         fechaDevolucionReal:
 *           type: string
 *           format: date-time
 *           description: Fecha real de devolución
 *         estado:
 *           type: string
 *           enum: [activo, devuelto, vencido, perdido]
 *           description: Estado del préstamo
 *         diasPrestamo:
 *           type: integer
 *           description: Días de préstamo
 *         renovaciones:
 *           type: integer
 *           description: Número de renovaciones
 *         observaciones:
 *           type: string
 *           description: Observaciones del préstamo
 */

/**
 * @swagger
 * /api/prestamos:
 *   get:
 *     summary: Obtener todos los préstamos
 *     tags: [Préstamos]
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
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activo, devuelto, vencido, perdido]
 *         description: Filtrar por estado
 *     responses:
 *       200:
 *         description: Lista de préstamos obtenida exitosamente
 *       401:
 *         description: No autorizado
 */
router.get('/', requireAuth, prestamoController.getPrestamos);

/**
 * @swagger
 * /api/prestamos/{id}:
 *   get:
 *     summary: Obtener préstamo por ID
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del préstamo
 *     responses:
 *       200:
 *         description: Préstamo encontrado
 *       404:
 *         description: Préstamo no encontrado
 */
router.get('/:id', requireAuth, validateObjectId, prestamoController.getPrestamoById);

/**
 * @swagger
 * /api/prestamos:
 *   post:
 *     summary: Crear nuevo préstamo (Solo administradores)
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Prestamo'
 *     responses:
 *       201:
 *         description: Préstamo creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/', requireAuth, requireRole(['admin']), validatePrestamo, prestamoController.crearPrestamo);

/**
 * @swagger
 * /api/prestamos/{id}/devolver:
 *   put:
 *     summary: Devolver libro (Solo administradores)
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del préstamo
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               observaciones:
 *                 type: string
 *     responses:
 *       200:
 *         description: Libro devuelto exitosamente
 *       400:
 *         description: Error en la devolución
 */
router.put('/:id/devolver', requireAuth, requireRole(['admin']), validateObjectId, prestamoController.devolverLibro);

/**
 * @swagger
 * /api/prestamos/{id}/renovar:
 *   put:
 *     summary: Renovar préstamo
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del préstamo
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               diasAdicionales:
 *                 type: integer
 *                 default: 15
 *     responses:
 *       200:
 *         description: Préstamo renovado exitosamente
 *       400:
 *         description: Error en la renovación
 */
router.put('/:id/renovar', requireAuth, validateObjectId, prestamoController.renovarPrestamo);

/**
 * @swagger
 * /api/prestamos/{id}:
 *   delete:
 *     summary: Eliminar préstamo (Solo administradores)
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del préstamo
 *     responses:
 *       200:
 *         description: Préstamo eliminado exitosamente
 *       404:
 *         description: Préstamo no encontrado
 */
router.delete('/:id', requireAuth, requireRole(['admin']), validateObjectId, prestamoController.eliminarPrestamo);

/**
 * @swagger
 * /api/prestamos/usuario/{usuarioId}:
 *   get:
 *     summary: Obtener préstamos por usuario
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: usuarioId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
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
 *     responses:
 *       200:
 *         description: Préstamos del usuario obtenidos exitosamente
 *       403:
 *         description: No autorizado para ver estos préstamos
 */
router.get('/usuario/:usuarioId', requireAuth, validateObjectId, prestamoController.getPrestamosPorUsuario);

/**
 * @swagger
 * /api/prestamos/estadisticas/vencidos:
 *   get:
 *     summary: Obtener préstamos vencidos (Solo administradores)
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de préstamos vencidos
 */
router.get('/estadisticas/vencidos', requireAuth, requireRole(['admin']), prestamoController.getPrestamosVencidos);

/**
 * @swagger
 * /api/prestamos/estadisticas/generales:
 *   get:
 *     summary: Obtener estadísticas de préstamos (Solo administradores)
 *     tags: [Préstamos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas de préstamos
 */
router.get('/estadisticas/generales', requireAuth, requireRole(['admin']), prestamoController.getEstadisticasPrestamos);

module.exports = router;