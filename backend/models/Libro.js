const mongoose = require('mongoose');

const libroSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
    maxlength: [255, 'El título no puede tener más de 255 caracteres'],
    index: true
  },
  autor: {
    type: String,
    required: [true, 'El autor es requerido'],
    trim: true,
    maxlength: [100, 'El autor no puede tener más de 100 caracteres'],
    index: true
  },
  isbn: {
    type: String,
    required: [true, 'El ISBN es requerido'],
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^(?:\d{10}|\d{13})$/.test(v);
      },
      message: 'ISBN debe ser de 10 o 13 dígitos'
    },
    index: true
  },
  editorial: {
    type: String,
    trim: true,
    maxlength: [100, 'La editorial no puede tener más de 100 caracteres']
  },
  año: {
    type: Number,
    min: [1000, 'El año debe ser mayor a 1000'],
    max: [new Date().getFullYear(), 'El año no puede ser futuro'],
    validate: {
      validator: Number.isInteger,
      message: 'El año debe ser un número entero'
    }
  },
  genero: {
    type: String,
    trim: true,
    maxlength: [50, 'El género no puede tener más de 50 caracteres'],
    index: true
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [1000, 'La descripción no puede tener más de 1000 caracteres']
  },
  ejemplares: {
    type: Number,
    required: [true, 'El número de ejemplares es requerido'],
    min: [0, 'Los ejemplares no pueden ser negativos'],
    default: 1
  },
  ejemplaresDisponibles: {
    type: Number,
    required: true,
    min: [0, 'Los ejemplares disponibles no pueden ser negativos'],
    validate: {
      validator: function(v) {
        return v <= this.ejemplares;
      },
      message: 'Ejemplares disponibles no pueden ser mayores que ejemplares totales'
    }
  },
  imagen: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Opcional
        return /^https?:\/\/.+\..+/.test(v);
      },
      message: 'URL de imagen no válida'
    }
  },
  ubicacion: {
    type: String,
    trim: true,
    maxlength: [100, 'La ubicación no puede tener más de 100 caracteres']
  },
  estado: {
    type: String,
    enum: ['disponible', 'prestado', 'mantenimiento', 'retirado'],
    default: 'disponible'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Cada tag no puede tener más de 30 caracteres']
  }],
  fechaAdquisicion: {
    type: Date,
    default: Date.now
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

// Índices compuestos para mejor performance
libroSchema.index({ titulo: 'text', autor: 'text', genero: 'text' });
libroSchema.index({ estado: 1, ejemplaresDisponibles: -1 });
libroSchema.index({ genero: 1, año: -1 });
libroSchema.index({ activo: 1, estado: 1 });

// Virtual para préstamos activos
libroSchema.virtual('prestamosActivos', {
  ref: 'Prestamo',
  localField: '_id',
  foreignField: 'libroId',
  match: { estado: 'activo' },
  count: true
});

// Middleware para sincronizar ejemplares disponibles
libroSchema.pre('save', function(next) {
  if (this.isNew) {
    this.ejemplaresDisponibles = this.ejemplares;
  }
  
  // Validar que ejemplaresDisponibles no sea mayor que ejemplares
  if (this.ejemplaresDisponibles > this.ejemplares) {
    this.ejemplaresDisponibles = this.ejemplares;
  }
  
  // Actualizar estado basado en disponibilidad
  if (this.ejemplaresDisponibles === 0) {
    this.estado = 'prestado';
  } else if (this.estado === 'prestado' && this.ejemplaresDisponibles > 0) {
    this.estado = 'disponible';
  }
  
  next();
});

// Método de instancia para verificar disponibilidad
libroSchema.methods.estaDisponible = function() {
  return this.ejemplaresDisponibles > 0 && this.estado === 'disponible' && this.activo;
};

// Método de instancia para prestar libro
libroSchema.methods.prestarEjemplar = async function() {
  if (!this.estaDisponible()) {
    throw new Error('El libro no está disponible para préstamo');
  }
  
  this.ejemplaresDisponibles -= 1;
  if (this.ejemplaresDisponibles === 0) {
    this.estado = 'prestado';
  }
  
  return await this.save();
};

// Método de instancia para devolver libro
libroSchema.methods.devolverEjemplar = async function() {
  if (this.ejemplaresDisponibles >= this.ejemplares) {
    throw new Error('No se pueden devolver más ejemplares de los prestados');
  }
  
  this.ejemplaresDisponibles += 1;
  if (this.estado === 'prestado' && this.ejemplaresDisponibles > 0) {
    this.estado = 'disponible';
  }
  
  return await this.save();
};

// Método estático para búsqueda avanzada
libroSchema.statics.buscarAvanzada = function(criterios) {
  const {
    query,
    genero,
    autor,
    añoDesde,
    añoHasta,
    disponible,
    page = 1,
    limit = 10,
    sortBy = 'titulo',
    sortOrder = 'asc'
  } = criterios;
  
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
  const filtro = { activo: true };
  
  // Búsqueda por texto
  if (query) {
    filtro.$text = { $search: query };
  }
  
  // Filtros adicionales
  if (genero) filtro.genero = new RegExp(genero, 'i');
  if (autor) filtro.autor = new RegExp(autor, 'i');
  if (añoDesde || añoHasta) {
    filtro.año = {};
    if (añoDesde) filtro.año.$gte = parseInt(añoDesde);
    if (añoHasta) filtro.año.$lte = parseInt(añoHasta);
  }
  
  if (disponible !== undefined) {
    if (disponible) {
      filtro.ejemplaresDisponibles = { $gt: 0 };
      filtro.estado = 'disponible';
    } else {
      filtro.$or = [
        { ejemplaresDisponibles: 0 },
        { estado: { $ne: 'disponible' } }
      ];
    }
  }
  
  return this.find(filtro)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate('prestamosActivos');
};

// Método estático para obtener estadísticas
libroSchema.statics.obtenerEstadisticas = async function() {
  const stats = await this.aggregate([
    { $match: { activo: true } },
    {
      $group: {
        _id: null,
        totalLibros: { $sum: 1 },
        totalEjemplares: { $sum: '$ejemplares' },
        totalDisponibles: { $sum: '$ejemplaresDisponibles' },
        porGenero: { $push: '$genero' }
      }
    },
    {
      $project: {
        totalLibros: 1,
        totalEjemplares: 1,
        totalDisponibles: 1,
        totalPrestados: { $subtract: ['$totalEjemplares', '$totalDisponibles'] },
        porcentajeDisponible: {
          $multiply: [
            { $divide: ['$totalDisponibles', '$totalEjemplares'] },
            100
          ]
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalLibros: 0,
    totalEjemplares: 0,
    totalDisponibles: 0,
    totalPrestados: 0,
    porcentajeDisponible: 0
  };
};

module.exports = mongoose.model('Libro', libroSchema);