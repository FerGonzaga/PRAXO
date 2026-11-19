// routes/carrito.js
// Carrito persistente de servicios de PRAXO.

const express = require('express');
const router = express.Router();
const SolicitudServicio = require('../models/SolicitudServicio');
const requiereSesion = require('../middlewares/requiereSesion');
const {
  validarDatosServicio,
  obtenerCarrito,
  agregarAlCarrito,
  confirmarCarrito
} = require('../services/carrito');
const { subirEvidencia } = require('../middlewares/subidas');

function quiereJson(req) {
  return req.xhr || (req.get('accept') || '').includes('application/json');
}

// ==========================================
// PROTEGER TODO EL CARRITO
// ==========================================
router.use(requiereSesion);

// ==========================================
// MOSTRAR CARRITO
// GET /carrito
// ==========================================
router.get('/', async (req, res) => {
  try {
    const { items: carrito, resumen } = await obtenerCarrito(req.session.usuario.id);

    res.render('carrito', {
      titulo: 'Mis servicios',
      carrito,
      resumen,
      error: req.query.error || null
    });

  } catch (error) {
    console.error('Error al cargar el carrito:', error);
    res.status(500).send('No se pudieron cargar tus servicios.');
  }
});

// ==========================================
// AGREGAR SERVICIO
// POST /carrito/agregar
// ==========================================
router.post('/agregar', subirEvidencia('texto'), async (req, res) => {
  try {
    const rutaImagen = req.file ? '/uploads/solicitudes/' + req.file.filename : null;
    const resultado = await agregarAlCarrito(req.session.usuario.id, req.body, rutaImagen);

    if (!resultado.ok) {
      return res.status(resultado.status).send(resultado.error);
    }
    return res.redirect('/carrito?agregado=1');

  } catch (error) {
    console.error('Error al agregar servicio:', error);
    return res.status(500).send('Ocurrió un error al agregar el servicio.');
  }
});

// ==========================================
// EDITAR SERVICIO (desde el carrito, sin recargar)
// POST /carrito/editar/:id   (JSON)
// ==========================================
router.post('/editar/:id', async (req, res) => {
  try {
    const validacion = validarDatosServicio(req.body || {});
    if (!validacion.ok) {
      return res.status(400).json({ mensaje: validacion.error });
    }

    const actualizado = await SolicitudServicio.findOneAndUpdate(
      { _id: req.params.id, clienteId: req.session.usuario.id },
      { $set: validacion.datos },
      { new: true, runValidators: true }
    ).lean();

    if (!actualizado) {
      return res.status(404).json({ mensaje: 'Ese servicio ya no está en tu carrito.' });
    }

    return res.json({ mensaje: 'Servicio actualizado.', servicio: actualizado });

  } catch (error) {
    console.error('Error editando servicio:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ mensaje: 'Servicio no válido.' });
    }
    return res.status(500).json({ mensaje: 'No se pudo actualizar el servicio.' });
  }
});

// ==========================================
// ELIMINAR SERVICIO
// POST /carrito/eliminar/:id
// ==========================================
router.post('/eliminar/:id', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    await SolicitudServicio.findOneAndDelete({
      _id: req.params.id,
      clienteId
    });

    if (quiereJson(req)) {
      const cantidad = await SolicitudServicio.countDocuments({ clienteId });
      return res.json({ ok: true, cantidad });
    }
    return res.redirect('/carrito');
  } catch (error) {
    console.error('Error eliminando servicio:', error);
    return res.status(500).send('No se pudo eliminar el servicio.');
  }
});

// ==========================================
// VACIAR CARRITO
// POST /carrito/vaciar
// ==========================================
router.post('/vaciar', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    await SolicitudServicio.deleteMany({ clienteId });
    return res.redirect('/carrito');
  } catch (error) {
    console.error('Error vaciando carrito:', error);
    return res.status(500).send('No se pudo vaciar el carrito.');
  }
});

// ==========================================
// CANTIDAD DEL CARRITO
// GET /carrito/cantidad
// ==========================================
router.get('/cantidad', async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    const cantidad = await SolicitudServicio.countDocuments({ clienteId });
    return res.json({ cantidad });
  } catch (error) {
    console.error('Error contando servicios:', error);
    return res.status(500).json({ cantidad: 0 });
  }
});

// ======================================================
// CONFIRMAR CONTRATACIÓN
// POST /carrito/confirmar
// ======================================================
router.post('/confirmar', async (req, res) => {
  try {
    // 🔒 El cliente debe aceptar las políticas de compra antes de contratar
    if (req.body.aceptaPoliticas !== 'on') {
      return res.redirect('/carrito?error=politicas');
    }

    const { creadas } = await confirmarCarrito(req.session.usuario.id);
    if (creadas === 0) {
      return res.redirect('/carrito');
    }
    return res.redirect('/inicio-cliente?exito=solicitud_enviada');

  } catch (error) {
    console.error('Error al confirmar la contratación:', error);
    return res.status(500).send('No se pudo procesar la contratación. Intenta de nuevo.');
  }
});

module.exports = router;