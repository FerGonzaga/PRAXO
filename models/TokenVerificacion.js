// models/TokenVerificacion.js
// Guarda el token de verificacion de correo (el que va en el enlace
// del correo de Brevo), ligado a un usuario, con expiracion automatica.

const mongoose = require('mongoose');

const tokenVerificacionSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Usuario',
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiraEn: {
    type: Date,
    required: true,
    index: { expires: 0 }, // Mongo borra el documento solo al llegar esta fecha
  },
});

module.exports = mongoose.model(
  'TokenVerificacion',
  tokenVerificacionSchema,
  'tokensVerificacion'
);