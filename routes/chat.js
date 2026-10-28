const express = require('express');
const router = express.Router();
const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const Trabajador = require('../models/Trabajador');
const Resena = require('../models/Resena');
const { desgloseDeSolicitud, formatoMXN } = require('../config/tarifas');
const { recalcularCalificacion } = require('../services/calificaciones');
const requiereSesion = require('../middlewares/requiereSesion');
 
router.use(requiereSesion);
 
// ==========================================
// HELPER: ¿El usuario de la sesión participa en esta solicitud?
// Devuelve 'cliente', 'prestador' o null.
// ==========================================
async function rolEnSolicitud(solicitud, usuarioSesion) {
  const usuarioId = usuarioSesion.id.toString();
  const clienteId = (solicitud.clienteId._id || solicitud.clienteId).toString();
  const trabajadorId = (solicitud.trabajadorId._id || solicitud.trabajadorId).toString();
 
  if (usuarioSesion.tipoUsuario === 'cliente' && clienteId === usuarioId) {
    return 'cliente';
  }
 
  if (usuarioSesion.tipoUsuario === 'prestador') {
    const trabajador = await Trabajador.findOne({ usuarioId }).select('_id');
    if (trabajador && trabajador._id.toString() === trabajadorId) {
      return 'prestador';
    }
  }
 
  return null;
}
 
// ==========================================
// VER EL CHAT Y LA COTIZACIÓN
// GET /chat/:id
// ==========================================
router.get('/:id', async (req, res) => {
  try {
    const solicitud = await Solicitud.findById(req.params.id)
      .populate('clienteId', 'nombre correo')
      .populate({
        path: 'trabajadorId',
        populate: { path: 'usuarioId', select: 'nombre' }
      });
 
    if (!solicitud) {
      return res.status(404).send('Solicitud no encontrada');
    }
 
    // Verificar que la persona que entra sea el Cliente o el Prestador de esta solicitud
    const rol = await rolEnSolicitud(solicitud, req.session.usuario);
    if (!rol) {
      return res.status(403).send('No tienes permiso para ver este chat de servicio.');
    }
 
    // Obtener los mensajes ordenados del más viejo al más nuevo
    const mensajes = await Mensaje.find({ solicitudId: solicitud._id })
      .sort({ fecha: 1 })
      .populate('emisorId', 'nombre tipoUsuario');
 
    const resena = await Resena.findOne({ solicitudId: solicitud._id }).lean();

    res.render('chat', {
      titulo: 'Sala de Acuerdos',
      solicitud,
      mensajes,
      resena,
      usuarioLogueado: req.session.usuario,
      aviso: req.query.aviso || null
    });
 
  } catch (error) {
    console.error('Error al cargar el chat:', error);
    res.status(500).send('Hubo un problema al cargar la sala de chat.');
  }
});
 
// ==========================================
// ENVIAR UN MENSAJE
// POST /chat/:id/mensaje
// ==========================================
router.post('/:id/mensaje', async (req, res) => {
  try {
    const { texto } = req.body;
 
    if (!texto || texto.trim() === '') {
      return res.redirect(`/chat/${req.params.id}`);
    }
 
    // 🔒 Solo el cliente o el prestador de esta solicitud pueden escribir
    const solicitud = await Solicitud.findById(req.params.id).select('clienteId trabajadorId');
    if (!solicitud) {
      return res.status(404).send('Solicitud no encontrada');
    }
    const rol = await rolEnSolicitud(solicitud, req.session.usuario);
    if (!rol) {
      return res.status(403).send('No tienes permiso para escribir en este chat.');
    }
 
    await Mensaje.create({
      solicitudId: solicitud._id,
      emisorId: req.session.usuario.id,
      texto: texto.trim().slice(0, 1000)
    });
 
    res.redirect(`/chat/${req.params.id}`);
 
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).send('No se pudo enviar el mensaje.');
  }
});
 
// ==========================================
// ACEPTAR LA COTIZACIÓN (solo el cliente)
// POST /chat/:id/aceptar
// Cotizada -> Aceptada
// ==========================================
router.post('/:id/aceptar', async (req, res) => {
  try {
    const usuario = req.session.usuario;
 
    if (usuario.tipoUsuario !== 'cliente') {
      return res.status(403).send('Solo el cliente puede aceptar una cotización.');
    }
 
    // Actualización atómica: solo cambia si la solicitud es de este cliente
    // y sigue en estado 'Cotizada' (evita dobles clics o aceptar algo ya pagado).
    const solicitud = await Solicitud.findOneAndUpdate(
      { _id: req.params.id, clienteId: usuario.id, estado: 'Cotizada' },
      { $set: { estado: 'Aceptada', fechaAceptacion: new Date() } },
      { new: true }
    );
 
    if (!solicitud) {
      return res.redirect(`/chat/${req.params.id}?aviso=no-aceptable`);
    }
 
    // Dejamos constancia en el chat para ambas partes
    await Mensaje.create({
      solicitudId: solicitud._id,
      emisorId: usuario.id,
      texto: `✅ Acepté la cotización. Total a pagar: ${formatoMXN(desgloseDeSolicitud(solicitud).total)} MXN.`
    });
 
    // Siguiente paso: pasarela de pagos (Aceptada -> Pagada)
    res.redirect(`/chat/${solicitud._id}?aviso=aceptada`);
 
  } catch (error) {
    console.error('Error al aceptar la cotización:', error);
    res.status(500).send('No se pudo aceptar la cotización.');
  }
});
 
// ==========================================
// RECHAZAR LA COTIZACIÓN (solo el cliente)
// POST /chat/:id/rechazar
// Cotizada -> Rechazada
// ==========================================
router.post('/:id/rechazar', async (req, res) => {
  try {
    const usuario = req.session.usuario;
 
    if (usuario.tipoUsuario !== 'cliente') {
      return res.status(403).send('Solo el cliente puede rechazar una cotización.');
    }
 
    const solicitud = await Solicitud.findOneAndUpdate(
      { _id: req.params.id, clienteId: usuario.id, estado: 'Cotizada' },
      { $set: { estado: 'Rechazada' } },
      { new: true }
    );
 
    if (!solicitud) {
      return res.redirect(`/chat/${req.params.id}?aviso=no-aceptable`);
    }
 
    await Mensaje.create({
      solicitudId: solicitud._id,
      emisorId: usuario.id,
      texto: '❌ Rechacé la cotización.'
    });
 
    res.redirect(`/chat/${solicitud._id}?aviso=rechazada`);
 
  } catch (error) {
    console.error('Error al rechazar la cotización:', error);
    res.status(500).send('No se pudo rechazar la cotización.');
  }
});
 
// ==========================================
// MARCAR TRABAJO COMO COMPLETADO (solo el prestador)
// POST /chat/:id/completar
// Pagada -> Completada
// ==========================================
router.post('/:id/completar', async (req, res) => {
  try {
    const usuario = req.session.usuario;

    if (usuario.tipoUsuario !== 'prestador') {
      return res.status(403).send('Solo el prestador puede marcar el trabajo como completado.');
    }

    const trabajador = await Trabajador.findOne({ usuarioId: usuario.id }).select('_id');
    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    // Atómico: solo si es SU solicitud y ya está pagada
    const solicitud = await Solicitud.findOneAndUpdate(
      { _id: req.params.id, trabajadorId: trabajador._id, estado: 'Pagada' },
      { $set: { estado: 'Completada', fechaCompletado: new Date() } },
      { new: true }
    );

    if (!solicitud) {
      return res.redirect(`/chat/${req.params.id}?aviso=no-completable`);
    }

    await Mensaje.create({
      solicitudId: solicitud._id,
      emisorId: usuario.id,
      texto: '🛠️ Terminé el trabajo. ¡Gracias por confiar en PRAXO! Por favor califica el servicio.'
    });

    res.redirect(`/chat/${solicitud._id}?aviso=completada`);

  } catch (error) {
    console.error('Error al completar el servicio:', error);
    res.status(500).send('No se pudo marcar el servicio como completado.');
  }
});

// ==========================================
// DEJAR RESEÑA (solo el cliente, servicio Completado)
// POST /chat/:id/resena
// ==========================================
router.post('/:id/resena', async (req, res) => {
  try {
    const usuario = req.session.usuario;

    if (usuario.tipoUsuario !== 'cliente') {
      return res.status(403).send('Solo el cliente puede calificar el servicio.');
    }

    const calificacion = Number(req.body.calificacion);
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
      return res.redirect(`/chat/${req.params.id}?aviso=resena-invalida`);
    }
    const comentario = String(req.body.comentario || '').trim().slice(0, 500);

    const solicitud = await Solicitud.findOne({
      _id: req.params.id,
      clienteId: usuario.id,
      estado: 'Completada'
    });

    if (!solicitud) {
      return res.redirect(`/chat/${req.params.id}?aviso=no-calificable`);
    }

    try {
      await Resena.create({
        solicitudId: solicitud._id,
        trabajadorId: solicitud.trabajadorId,
        clienteId: usuario.id,
        calificacion,
        comentario
      });
    } catch (err) {
      // 11000 = índice único: este servicio ya tiene reseña
      if (err.code === 11000) {
        return res.redirect(`/chat/${solicitud._id}?aviso=ya-calificada`);
      }
      throw err;
    }

    await recalcularCalificacion(solicitud.trabajadorId);

    await Mensaje.create({
      solicitudId: solicitud._id,
      emisorId: usuario.id,
      texto: `⭐ Califiqué el servicio con ${calificacion} de 5 estrellas.`
    });

    res.redirect(`/chat/${solicitud._id}?aviso=calificada`);

  } catch (error) {
    console.error('Error al guardar la reseña:', error);
    res.status(500).send('No se pudo guardar la reseña.');
  }
});

module.exports = router;