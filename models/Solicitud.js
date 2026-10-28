const mongoose = require('mongoose');

const SolicitudSchema = new mongoose.Schema({
  clienteId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  trabajadorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Trabajador', 
    required: true 
  },
  
  // Datos del servicio solicitado
  servicio: { type: String, required: true }, 
  fecha: { type: String }, 
  hora: { type: String },
  ubicacion: { type: String, required: true },
  referenciasUbicacion: { type: String },
  descripcion: { type: String, required: true },
  urgencia: { type: String, default: 'Programado' }, 
  imagenEvidencia: { type: String, default: null }, 
  requiereCotizacion: { type: Boolean, default: false },
  
  // 🟢 LA MÁQUINA DE ESTADOS (Aquí ocurre la magia)
  estado: { 
    type: String, 
    enum: ['Pendiente', 'Cotizada', 'Aceptada', 'Rechazada', 'Pagada', 'Completada'],
    default: 'Pendiente' 
  },
  
  // 🟢 DATOS DE LA COTIZACIÓN (Lo llenará el prestador después)
  precioAcordado: { type: Number, default: null }, 
  mensajeCotizacion: { type: String, default: '' }, 
  
  // Momento en que el cliente aceptó la cotización
  fechaAceptacion: { type: Date, default: null },

  // Momento en que el prestador marcó el trabajo como terminado
  fechaCompletado: { type: Date, default: null },

  // Datos del pago (simulado). Nunca guardamos el número completo ni el CVV.
  pago: {
    referencia: { type: String, default: null },
    metodo: { type: String, default: null },
    marca: { type: String, default: null },
    ultimos4: { type: String, default: null },
    monto: { type: Number, default: null },
    moneda: { type: String, default: 'MXN' },
    fecha: { type: Date, default: null }
  },

  fechaCreacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Solicitud', SolicitudSchema);
