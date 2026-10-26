const mongoose = require('mongoose');

const MensajeSchema = new mongoose.Schema({
  solicitudId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Solicitud', 
    required: true 
  },
  emisorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  texto: { 
    type: String, 
    required: true 
  },
  fecha: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Mensaje', MensajeSchema);