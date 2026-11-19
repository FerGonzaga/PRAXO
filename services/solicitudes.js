// services/solicitudes.js
// Máquina de estados de una solicitud, COMPARTIDA por la web y la app móvil:
//   Pendiente -> Cotizada -> Aceptada -> Pagada -> Completada (+ reseña)
//                        \-> Rechazada
//
// Cada función recibe el usuario que actúa ({ id, tipoUsuario }) y devuelve
//   { ok: true, ... }  o  { error: '<codigo>' }
// La web convierte el código en un aviso (?aviso=...) y la API en un mensaje JSON.

const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const Trabajador = require('../models/Trabajador');
const Resena = require('../models/Resena');
const { calcularDesglose, desgloseDeSolicitud, formatoMXN } = require('../config/tarifas');
const { recalcularCalificacion } = require('./calificaciones');

const PRECIO_MAXIMO = 1000000;

// Textos para la API (la web usa sus propios avisos)
const MENSAJES = {
  'no-encontrada': 'La solicitud no existe.',
  'sin-permiso': 'No tienes permiso para ver este servicio.',
  'solo-cliente': 'Solo el cliente puede hacer esto.',
  'solo-prestador': 'Solo el prestador puede hacer esto.',
  'sin-perfil': 'No se encontró tu perfil de prestador.',
  'mensaje-vacio': 'Escribe un mensaje.',
  'no-aceptable': 'Esta cotización ya no puede modificarse (quizá ya fue aceptada o rechazada).',
  'no-completable': 'Solo puedes completar servicios que ya fueron pagados.',
  'resena-invalida': 'Elige de 1 a 5 estrellas.',
  'no-calificable': 'Solo puedes calificar servicios completados.',
  'ya-calificada': 'Este servicio ya fue calificado.',
  'precio-invalido': 'Ingresa un precio válido (mayor a $0 y hasta $1,000,000).',
  'ya-cotizada': 'Esta solicitud ya fue cotizada y no puede modificarse.'
};

async function trabajadorDeUsuario(usuarioId) {
  return Trabajador.findOne({ usuarioId }).select('_id usuarioId nombre');
}

// ¿El usuario participa en esta solicitud? -> 'cliente' | 'prestador' | null
async function rolEnSolicitud(solicitud, usuario) {
  const usuarioId = String(usuario.id);
  const clienteId = String(solicitud.clienteId && solicitud.clienteId._id ? solicitud.clienteId._id : solicitud.clienteId);
  const trabajadorId = String(solicitud.trabajadorId && solicitud.trabajadorId._id ? solicitud.trabajadorId._id : solicitud.trabajadorId);

  if (usuario.tipoUsuario === 'cliente' && clienteId === usuarioId) return 'cliente';
  if (usuario.tipoUsuario === 'prestador') {
    const t = await trabajadorDeUsuario(usuarioId);
    if (t && String(t._id) === trabajadorId) return 'prestador';
  }
  return null;
}

// -----------------------------------------------------------
// CHAT
// -----------------------------------------------------------
async function enviarMensaje(solicitudId, usuario, texto) {
  const limpio = typeof texto === 'string' ? texto.trim().slice(0, 1000) : '';
  if (!limpio) return { error: 'mensaje-vacio' };

  const solicitud = await Solicitud.findById(solicitudId).select('clienteId trabajadorId');
  if (!solicitud) return { error: 'no-encontrada' };
  if (!(await rolEnSolicitud(solicitud, usuario))) return { error: 'sin-permiso' };

  const mensaje = await Mensaje.create({ solicitudId: solicitud._id, emisorId: usuario.id, texto: limpio });
  return { ok: true, mensaje };
}

// -----------------------------------------------------------
// PRESTADOR: COTIZAR (Pendiente -> Cotizada)
// -----------------------------------------------------------
async function cotizarSolicitud(solicitudId, usuario, { precio, mensaje }) {
  if (usuario.tipoUsuario !== 'prestador') return { error: 'solo-prestador' };
  const trabajador = await trabajadorDeUsuario(usuario.id);
  if (!trabajador) return { error: 'sin-perfil' };

  const valor = Math.round(Number(precio) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0 || valor > PRECIO_MAXIMO) return { error: 'precio-invalido' };

  const solicitud = await Solicitud.findOne({ _id: solicitudId, trabajadorId: trabajador._id });
  if (!solicitud) return { error: 'no-encontrada' };
  // 🔒 Solo se cotiza una solicitud Pendiente (no se cambia el precio tras aceptar o pagar)
  if (solicitud.estado !== 'Pendiente') return { error: 'ya-cotizada' };

  solicitud.estado = 'Cotizada';
  solicitud.precioAcordado = valor;               // lo que recibe el prestador
  solicitud.desglose = calcularDesglose(valor);   // + comisión PRAXO + IVA
  solicitud.mensajeCotizacion = typeof mensaje === 'string' ? mensaje.trim().slice(0, 1000) : '';
  await solicitud.save();

  return { ok: true, solicitud };
}

// -----------------------------------------------------------
// CLIENTE: ACEPTAR / RECHAZAR COTIZACIÓN
// -----------------------------------------------------------
async function aceptarCotizacion(solicitudId, usuario) {
  if (usuario.tipoUsuario !== 'cliente') return { error: 'solo-cliente' };

  // Atómico: solo si es de este cliente y sigue Cotizada (evita dobles clics)
  const solicitud = await Solicitud.findOneAndUpdate(
    { _id: solicitudId, clienteId: usuario.id, estado: 'Cotizada' },
    { $set: { estado: 'Aceptada', fechaAceptacion: new Date() } },
    { new: true }
  );
  if (!solicitud) return { error: 'no-aceptable' };

  await Mensaje.create({
    solicitudId: solicitud._id,
    emisorId: usuario.id,
    texto: `✅ Acepté la cotización. Total a pagar: ${formatoMXN(desgloseDeSolicitud(solicitud).total)} MXN.`
  });
  return { ok: true, solicitud };
}

async function rechazarCotizacion(solicitudId, usuario) {
  if (usuario.tipoUsuario !== 'cliente') return { error: 'solo-cliente' };

  const solicitud = await Solicitud.findOneAndUpdate(
    { _id: solicitudId, clienteId: usuario.id, estado: 'Cotizada' },
    { $set: { estado: 'Rechazada' } },
    { new: true }
  );
  if (!solicitud) return { error: 'no-aceptable' };

  await Mensaje.create({ solicitudId: solicitud._id, emisorId: usuario.id, texto: '❌ Rechacé la cotización.' });
  return { ok: true, solicitud };
}

// -----------------------------------------------------------
// PRESTADOR: COMPLETAR (Pagada -> Completada)
// -----------------------------------------------------------
async function completarServicio(solicitudId, usuario) {
  if (usuario.tipoUsuario !== 'prestador') return { error: 'solo-prestador' };
  const trabajador = await trabajadorDeUsuario(usuario.id);
  if (!trabajador) return { error: 'sin-perfil' };

  const solicitud = await Solicitud.findOneAndUpdate(
    { _id: solicitudId, trabajadorId: trabajador._id, estado: 'Pagada' },
    { $set: { estado: 'Completada', fechaCompletado: new Date() } },
    { new: true }
  );
  if (!solicitud) return { error: 'no-completable' };

  await Mensaje.create({
    solicitudId: solicitud._id,
    emisorId: usuario.id,
    texto: '🛠️ Terminé el trabajo. ¡Gracias por confiar en PRAXO! Por favor califica el servicio.'
  });
  return { ok: true, solicitud };
}

// -----------------------------------------------------------
// CLIENTE: RESEÑA (solo servicios Completados, una por servicio)
// -----------------------------------------------------------
async function dejarResena(solicitudId, usuario, { calificacion, comentario }) {
  if (usuario.tipoUsuario !== 'cliente') return { error: 'solo-cliente' };

  const estrellas = Number(calificacion);
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) return { error: 'resena-invalida' };
  const texto = typeof comentario === 'string' ? comentario.trim().slice(0, 500) : '';

  const solicitud = await Solicitud.findOne({ _id: solicitudId, clienteId: usuario.id, estado: 'Completada' });
  if (!solicitud) return { error: 'no-calificable' };

  try {
    await Resena.create({
      solicitudId: solicitud._id,
      trabajadorId: solicitud.trabajadorId,
      clienteId: usuario.id,
      calificacion: estrellas,
      comentario: texto
    });
  } catch (err) {
    if (err.code === 11000) return { error: 'ya-calificada' }; // índice único por solicitud
    throw err;
  }

  await recalcularCalificacion(solicitud.trabajadorId);
  await Mensaje.create({
    solicitudId: solicitud._id,
    emisorId: usuario.id,
    texto: `⭐ Califiqué el servicio con ${estrellas} de 5 estrellas.`
  });
  return { ok: true, solicitud };
}

module.exports = {
  MENSAJES,
  PRECIO_MAXIMO,
  trabajadorDeUsuario,
  rolEnSolicitud,
  enviarMensaje,
  cotizarSolicitud,
  aceptarCotizacion,
  rechazarCotizacion,
  completarServicio,
  dejarResena
};
