// models/Trabajador.js

// Define la forma que debe tener cada documento de la coleccion "trabajadores".

const mongoose = require('mongoose');

const trabajadorSchema = new mongoose.Schema(
  {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
    },

    nombre: {
      type: String,
      required: true,
    },

    oficio: {
      type: String,
      required: true,
    },

    telefono: {
      type: String,
      required: true,
    },

    ciudad: {
      type: String,
      required: true,
    },

    descripcion: {
      type: String,
    },

    calificacionPromedio: {
      type: Number,
      default: 0,
    },

    disponibleAhora: {
      type: Boolean,
      default: false,
    },

    fotoUrl: {
      type: String,
    },
  },
  {
    timestamps: true, // agrega createdAt y updatedAt automaticamente
  }
);

module.exports = mongoose.model(
  'Trabajador',
  trabajadorSchema,
  'trabajadores'
);