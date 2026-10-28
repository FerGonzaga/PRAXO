// models/Usuarios_Praxo.js
// Define la estructura de los usuarios de PRAXO.

const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    correo: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    tipoUsuario: {
      type: String,
      enum: ['cliente', 'prestador'],
      required: true,
    },

    emailVerificado: {
      type: Boolean,
      default: false,
    },

    tokenVerificacion: {
      type: String,
      default: null,
    },

    tokenExpiracion: {
      type: Date,
      default: null,
    },

    // Registro del consentimiento (evidencia de cuándo y qué aceptó)
    consentimiento: {
      terminos: {
        aceptado: { type: Boolean, default: false },
        fecha: { type: Date, default: null },
      },
      privacidad: {
        aceptado: { type: Boolean, default: false },
        fecha: { type: Date, default: null },
        version: { type: String, default: null },
      },
      // Finalidades secundarias (promociones, encuestas): opt-in, apagado por defecto
      promociones: {
        aceptado: { type: Boolean, default: false },
        fecha: { type: Date, default: null },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Nombre exacto de la colección en MongoDB Atlas.
module.exports = mongoose.model(
  'Usuario',
  usuarioSchema,
  'usuariospraxo'
);