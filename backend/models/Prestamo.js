const mongoose = require('mongoose');

const prestamoSchema = new mongoose.Schema({
  libroId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Libro',
    required: [true, 'El libro es requerido'],
    index: true
  },
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: [true, 'El usuario es requerido'],
    index: true
  },
  fechaPrestamo: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  fechaDevolucion: {
    type: Date,
    required: [true, 'La fecha de devolución es requerida'],
    validate: {
      validator: function(v) {
        return v > this.fechaPrestamo;
      },
      message: 'La fecha de devolución debe ser posterior a la fecha de préstamo'
    }
  },
  fechaDevolucionReal: {
    type: Date
  },
  estado: {
    type: String,
    enum: {
      values: ['activo', 'devuelto', 'vencido', 'perdido'],
      message: 'Estado no válido'
    },
    default: 'activo',
    index: true
  },
  diasPrestamo: {
    type: Number,
    min: [1, 'El préstamo debe ser de al menos 1 día'],
    max: [90, 'El préstamo no puede exceder 90 días'],
    default: 15
  },
  renovaciones: {
    type: Number,
    default: 0,
    max: [2, 'Máximo 2 renovaciones permitidas']
  },
  observaciones: {
    type: String,
    trim: true,
    maxlength: [500, 'Las observaciones no pueden tener más de 500 caracteres']
  },
  multa: {
    monto: { type: Number, default: 0, min: 0 },
    motivo: { type: String, trim: true },
    fechaPago: { type: Date },
    pagada: { type: Boolean, default: false }
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compuestos
prestamoSchema.index({ usuarioId: 1, estado: 1 });
prestamoSchema.index({ libroId: 1, estado: 1 });
prestamoSchema.index({ fechaPrestamo: -1 });
prestamoSchema.index({ fechaDevolucion: 1 });

// Virtual para días de retraso
prestamoSchema.virtual('diasRetraso').get(function() {
  if (this.estado === 'devuelto' && this.fechaDevolucionReal) {
    const diff = this.fechaDevolucionReal - this.fechaDevolucion;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  } else if (this.estado === 'activo') {
    const diff = new Date() - this.fechaDevolucion;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  return 0;
});

// Virtual para verificar si está vencido
prestamoSchema.virtual('estaVencido').get(function() {
  return this.estado === 'activo' && new Date() > this.fechaDevolucion;
});

// Middleware para validaciones
prestamoSchema.pre('save', function(next) {
  // Actualizar estado si está vencido
  if (this.estado === 'activo' && new Date() > this.fechaDevolucion) {
    this.estado = 'vencido';
  }
  
  // Calcular días de préstamo si no está establecido
  if (!this.diasPrestamo && this.fechaPrestamo && this.fechaDevolucion) {
    const diff = this.fechaDevolucion - this.fechaPrestamo;
    this.diasPrestamo = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
  
  next();
});

// Método de instancia para renovar préstamo
prestamoSchema.methods.renovar = async function(diasAdicionales = 15) {
  if (this.estado !== 'activo') {
    throw new Error('Solo se pueden renovar préstamos activos');
  }
  
  if (this.renovaciones >= 2) {
    throw new Error('Límite de renovaciones alcanzado');
  }
  
  if (this.estaVencido) {
    throw new Error('No se pueden renovar préstamos vencidos');
  }
  
  this.fechaDevolucion = new Date(this.fechaDevolucion.getTime() + diasAdicionales * 24 * 60 * 60 * 1000);
  this.renovaciones += 1;
  this.diasPrestamo += diasAdicionales;
  
  return await this.save();
};

// Método de instancia para devolver libro
prestamoSchema.methods.devolver = async function(observaciones = '') {
  if (this.estado !== 'activo' && this.estado !== 'vencido') {
    throw new Error('El préstamo no está activo');
  }
  
  this.estado = 'devuelto';
  this.fechaDevolucionReal = new Date();
  this.observaciones = observaciones;
  
  // Calcular multa si hay retraso
  const diasRetraso = this.diasRetraso;
  if (diasRetraso > 0) {
    this.multa = {
      monto: diasRetraso * 5, // $5 por día de retraso
      motivo: `Retraso de ${diasRetraso} días`,
      pagada: false
    };
  }
  
  return await this.save();
};

// Método estático para préstamos activos por usuario
prestamoSchema.statics.prestamosActivosPorUsuario = function(usuarioId) {
  return this.find({
    usuarioId,
    estado: 'activo',
    activo: true
  })
  .populate('libroId', 'titulo autor isbn imagen')
  .sort({ fechaDevolucion: 1 });
};

// Método estático para préstamos vencidos
prestamoSchema.statics.prestamosVencidos = function() {
  return this.find({
    estado: 'vencido',
    activo: true
  })
  .populate('libroId', 'titulo autor isbn')
  .populate('usuarioId', 'nombre email')
  .sort({ fechaDevolucion: 1 });
};

// Método estático para estadísticas de préstamos
prestamoSchema.statics.obtenerEstadisticas = async function() {
  const stats = await this.aggregate([
    { $match: { activo: true } },
    {
      $facet: {
        totalPrestamos: [{ $count: 'count' }],
        porEstado: [
          { $group: { _id: '$estado', count: { $sum: 1 } } }
        ],
        porMes: [
          {
            $group: {
              _id: {
                year: { $year: '$fechaPrestamo' },
                month: { $month: '$fechaPrestamo' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 12 }
        ],
        promedioDias: [
          {
            $group: {
              _id: null,
              promedio: { $avg: '$diasPrestamo' }
            }
          }
        ],
        multas: [
          {
            $group: {
              _id: null,
              totalMultas: { $sum: '$multa.monto' },
              multasPagadas: {
                $sum: { $cond: ['$multa.pagada', '$multa.monto', 0] }
              }
            }
          }
        ]
      }
    }
  ]);
  
  return stats[0];
};

module.exports = mongoose.model('Prestamo', prestamoSchema);