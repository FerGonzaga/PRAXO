const express = require('express');
const router = express.Router();
const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const Resena = require('../models/Resena');
const requiereSesion = require('../middlewares/requiereSesion');
// Lógica compartida con la app móvil (services/solicitudes.js)
const {
  rolEnSolicitud,
  enviarMensaje,
  aceptarCotizacion,
  rechazarCotizacion,
  completarServicio,
  dejarResena
} = require('../services/solicitudes');
 
router.use(requiereSesion);
 
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
// ACCIONES DEL CHAT
// Usan services/solicitudes.js (las mismas reglas que la app móvil).
// Cada error regresa al chat con un ?aviso= que la vista ya sabe mostrar.
// ==========================================

// Convierte el resultado del servicio en la respuesta de la web
function responder(res, req, resultado, avisoExito) {
  const id = req.params.id;
  if (resultado.ok) {
    return res.redirect(`/chat/${resultado.solicitud ? resultado.solicitud._id : id}${avisoExito ? `?aviso=${avisoExito}` : ''}`);
  }
  switch (resultado.error) {
    case 'no-encontrada': return res.status(404).send('Solicitud no encontrada');
    case 'sin-permiso': return res.status(403).send('No tienes permiso para este chat.');
    case 'solo-cliente': return res.status(403).send('Solo el cliente puede hacer esto.');
    case 'solo-prestador': return res.status(403).send('Solo el prestador puede hacer esto.');
    case 'sin-perfil': return res.status(404).send('No se encontró tu perfil de prestador.');
    case 'mensaje-vacio': return res.redirect(`/chat/${id}`);
    default: return res.redirect(`/chat/${id}?aviso=${resultado.error}`);
  }
}

function accion(nombre, fn, avisoExito) {
  return async (req, res) => {
    try {
      const resultado = await fn(req);
      return responder(res, req, resultado, avisoExito);
    } catch (error) {
      console.error(`Error al ${nombre}:`, error);
      return res.status(500).send(`No se pudo ${nombre}.`);
    }
  };
}

// POST /chat/:id/mensaje
router.post('/:id/mensaje', accion('enviar el mensaje',
  (req) => enviarMensaje(req.params.id, req.session.usuario, req.body.texto)));

// POST /chat/:id/aceptar   (cliente)    Cotizada -> Aceptada
router.post('/:id/aceptar', accion('aceptar la cotización',
  (req) => aceptarCotizacion(req.params.id, req.session.usuario), 'aceptada'));

// POST /chat/:id/rechazar  (cliente)    Cotizada -> Rechazada
router.post('/:id/rechazar', accion('rechazar la cotización',
  (req) => rechazarCotizacion(req.params.id, req.session.usuario), 'rechazada'));

// POST /chat/:id/completar (prestador)  Pagada -> Completada
router.post('/:id/completar', accion('marcar el servicio como completado',
  (req) => completarServicio(req.params.id, req.session.usuario), 'completada'));

// POST /chat/:id/resena    (cliente)    solo Completada, una vez
router.post('/:id/resena', accion('guardar la reseña',
  (req) => dejarResena(req.params.id, req.session.usuario, req.body), 'calificada'));

module.exports = router;