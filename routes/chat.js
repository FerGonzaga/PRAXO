const express = require('express');
const router = express.Router();
const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const Trabajador = require('../models/Trabajador');
const requiereSesion = require('../middlewares/requiereSesion');

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

    const usuarioActualId = req.session.usuario.id;
    const tipoUsuario = req.session.usuario.tipoUsuario;

    // Verificar que la persona que entra sea el Cliente o el Prestador de esta solicitud
    let autorizado = false;
    
    if (tipoUsuario === 'cliente' && solicitud.clienteId._id.toString() === usuarioActualId) {
      autorizado = true;
    } else if (tipoUsuario === 'prestador') {
      const trabajador = await Trabajador.findOne({ usuarioId: usuarioActualId });
      if (trabajador && trabajador._id.toString() === solicitud.trabajadorId._id.toString()) {
        autorizado = true;
      }
    }

    if (!autorizado) {
      return res.status(403).send('No tienes permiso para ver este chat de servicio.');
    }

    // Obtener los mensajes ordenados del más viejo al más nuevo
    const mensajes = await Mensaje.find({ solicitudId: solicitud._id })
      .sort({ fecha: 1 })
      .populate('emisorId', 'nombre tipoUsuario');

    res.render('chat', {
      titulo: 'Sala de Acuerdos',
      solicitud,
      mensajes,
      usuarioLogueado: req.session.usuario
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

    const nuevoMensaje = new Mensaje({
      solicitudId: req.params.id,
      emisorId: req.session.usuario.id,
      texto: texto.trim()
    });

    await nuevoMensaje.save();

    res.redirect(`/chat/${req.params.id}`);

  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).send('No se pudo enviar el mensaje.');
  }
});

module.exports = router;