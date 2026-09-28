// models/CodigoVerificacion.js
// Guarda el codigo de verificacion enviado a un correo.
// Por seguridad NO se guarda el codigo en claro, solo su hash (SHA-256).

const mongoose = require('mongoose');

const codigoVerificacionSchema = new mongoose.Schema({
  correo: {
    type: String,
    required: true,
    unique: true, // un solo codigo activo por correo
    lowercase: true,
    trim: true,
  },
  codigoHash: {
    type: String,
    required: true,
  },
  intentos: {
    type: Number,
    default: 0, // intentos fallidos de validacion
  },
  creadoEn: {
    type: Date,
    default: Date.now,
  },
  expiraEn: {
    type: Date,
    required: true,
    // Indice TTL: Mongo borra el documento solo cuando llega esta fecha
    // (el borrado automatico puede tardar hasta ~1 minuto).
    index: { expires: 0 },
  },
});

module.exports = mongoose.model(
  'CodigoVerificacion',
  codigoVerificacionSchema,
  'codigosVerificacion'
);