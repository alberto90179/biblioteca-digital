const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/security');

/**
 * @swagger
 * components:
 *   schemas:
 *     ReporteEstadisticas:
 *       type: object
 *       properties:
 *         libros:
 *           type: object
 *           properties:
 *             totalLibros:
 *               type: integer
 *             totalEjemplares:
 *               type: integer
 *             totalDisponibles:
 *               type: integer
 *             totalPrestados:
 *               type: integer
 *             porcentajeDisponible:
 *               type: number
 *         usuarios:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             activos:
 *               type: integer
 *             inactivos:
 *               type: integer
 *         prestamos:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             activos:
 *               type: integer
 *             vencidos:
 *               type: integer
 *             devueltos:
 *               type: integer
 */

/**
 * @swagger
 * /api/reports/estadisticas-generales:
 *   get:
 *     summary: Obtener estadísticas generales del sistema (Solo administradores)
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estadísticas generales obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReporteEstadisticas'
 */
router.get('/estadisticas-generales', requireAuth, requireRole(['admin']), reportController.getEstadisticasGenerales);

/**
 * @swagger
 * /api/reports/prestamos-activos:
 *   get:
 *     summary: Obtener reporte de préstamos activos (Solo administradores)
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de préstamos activos
 */
router.get('/prestamos-activos', requireAuth, requireRole(['admin']), reportController.getPrestamosActivos);

/**
 * @swagger
 * /api/reports/prestamos-vencidos:
 *   get:
 *     summary: Obtener reporte de préstamos vencidos (Solo administradores)
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de préstamos vencidos
 */
router.get('/prestamos-vencidos', requireAuth, requireRole(['admin']), reportController.getPrestamosVencidos);

/**
 * @swagger
 * /api/reports/usuarios-activos:
 *   get:
 *     summary: Obtener reporte de usuarios más activos (Solo administradores)
 *     tags: [Reportes]
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
 *         description: Lista de usuarios activos
 */
router.get('/usuarios-activos', requireAuth, requireRole(['admin']), reportController.getUsuariosActivos);

/**
 * @swagger
 * /api/reports/libros-populares:
 *   get:
 *     summary: Obtener reporte de libros más populares (Solo administradores)
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Límite de resultados
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           enum: [all, month, year]
 *         description: Período de tiempo
 *     responses:
 *       200:
 *         description: Lista de libros populares
 */
router.get('/libros-populares', requireAuth, requireRole(['admin']), reportController.getLibrosPopulares);

/**
 * @swagger
 * /api/reports/tendencias-genero:
 *   get:
 *     summary: Obtener reporte de tendencias por género (Solo administradores)
 *     tags: [Reportes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tendencias por género literario
 */
router.get('/tendencias-genero', requireAuth, requireRole(['admin']), reportController.getTendenciasGenero);

module.exports = router;