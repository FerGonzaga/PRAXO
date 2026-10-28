// models/Resena.js
// Reseña que deja un cliente sobre un prestador al terminar un servicio.
// Solo puede existir UNA reseña por solicitud.

const mongoose = require('mongoose');

const ResenaSchema = new mongoose.Schema(
  {
    solicitudId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Solicitud',
      required: true,
      unique: true // una reseña por servicio
    },
    trabajadorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trabajador',
      required: true,
      index: true
    },
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    calificacion: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comentario: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resena', ResenaSchema, 'resenas');
