const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: Object, // Almacenado encriptado
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  rol: {
    type: String,
    enum: ['admin', 'usuario'],
    default: 'usuario'
  },
  refreshToken: {
    type: Object, // Almacenado encriptado
    select: false
  },
  fechaRegistro: {
    type: Date,
    default: Date.now
  },
  ultimoAcceso: {
    type: Date
  },
  intentosLogin: {
    type: Number,
    default: 0
  },
  bloqueadoHasta: {
    type: Date
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Índices para mejorar performance y seguridad
usuarioSchema.index({ email: 1 });
usuarioSchema.index({ bloqueadoHasta: 1 });
usuarioSchema.index({ activo: 1 });

// Hash password antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar passwords
usuarioSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para verificar si la cuenta está bloqueada
usuarioSchema.methods.isBlocked = function() {
  return this.bloqueadoHasta && this.bloqueadoHasta > new Date();
};

// Método para incrementar intentos fallidos
usuarioSchema.methods.incrementFailedAttempts = async function() {
  this.intentosLogin += 1;
  
  if (this.intentosLogin >= 5) {
    // Bloquear por 30 minutos después de 5 intentos fallidos
    this.bloqueadoHasta = new Date(Date.now() + 30 * 60 * 1000);
  }
  
  await this.save();
};

// Método para resetear intentos fallidos
usuarioSchema.methods.resetFailedAttempts = async function() {
  this.intentosLogin = 0;
  this.bloqueadoHasta = undefined;
  await this.save();
};

module.exports = mongoose.model('Usuario', usuarioSchema);