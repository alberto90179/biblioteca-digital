const { body, validationResult, param, query } = require('express-validator');
const validator = require('validator');
const securityConfig = require('../config/security');
const { errorResponse } = require('./responseHandler');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(res, 'Errores de validación', 400, {
      errors: errors.array()
    });
  }
  next();
};

// Validaciones de seguridad mejoradas
const validateEmail = body('email')
  .isEmail().withMessage('Email inválido')
  .normalizeEmail()
  .isLength({ max: 255 }).withMessage('Email demasiado largo');

const validatePassword = body('password')
  .isLength({ min: securityConfig.passwordPolicy.minLength })
  .withMessage(`La contraseña debe tener al menos ${securityConfig.passwordPolicy.minLength} caracteres`)
  .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una mayúscula')
  .matches(/[a-z]/).withMessage('La contraseña debe contener al menos una minúscula')
  .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
  .matches(/[!@#$%^&*(),.?":{}|<>]/)
  .withMessage('La contraseña debe contener al menos un carácter especial')
  .not().matches(/(123456|password|admin|qwerty)/i)
  .withMessage('La contraseña es demasiado común');

const validateObjectId = param('id')
  .isMongoId().withMessage('ID no válido');

const validateISBN = body('isbn')
  .isISBN().withMessage('ISBN no válido')
  .isLength({ min: 10, max: 13 }).withMessage('ISBN debe tener entre 10 y 13 caracteres');

const validateInputLength = (field, max = 255) => 
  body(field)
    .isLength({ max }).withMessage(`El campo ${field} es demasiado largo`)
    .trim()
    .escape();

// Validaciones específicas
const validateRegistro = [
  validateInputLength('nombre', 100),
  validateEmail,
  validatePassword,
  handleValidationErrors
];

const validateLogin = [
  validateEmail,
  body('password').notEmpty().withMessage('La contraseña es requerida'),
  handleValidationErrors
];

const validateLibro = [
  validateInputLength('titulo', 255),
  validateInputLength('autor', 100),
  validateISBN,
  validateInputLength('editorial', 100),
  body('año')
    .optional()
    .isInt({ min: 1000, max: new Date().getFullYear() })
    .withMessage('Año de publicación no válido'),
  body('ejemplares')
    .isInt({ min: 0 })
    .withMessage('Los ejemplares deben ser un número positivo'),
  body('ejemplaresDisponibles')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Los ejemplares disponibles deben ser un número positivo'),
  handleValidationErrors
];

const validatePrestamo = [
  validateObjectId.withMessage('libroId debe ser un ID válido'),
  validateObjectId.withMessage('usuarioId debe ser un ID válido'),
  body('fechaDevolucion')
    .isISO8601().withMessage('Fecha de devolución debe ser una fecha válida')
    .custom((value) => {
      const devolutionDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return devolutionDate > today;
    }).withMessage('La fecha de devolución debe ser futura'),
  handleValidationErrors
];

// Validación de búsqueda para prevenir inyecciones
const validateSearch = [
  query('q')
    .optional()
    .isLength({ max: 100 }).withMessage('Término de búsqueda demasiado largo')
    .matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-.,]+$/).withMessage('Término de búsqueda contiene caracteres no permitidos'),
  handleValidationErrors
];

module.exports = {
  validateRegistro,
  validateLogin,
  validateLibro,
  validatePrestamo,
  validateSearch,
  handleValidationErrors,
  validateObjectId,
  validateEmail,
  validatePassword
};