// routes/prestador.js
// Rutas exclusivas de prestadores. Se montan en app.js como: app.use('/prestador', ...)

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Trabajador = require('../models/Trabajador');
const SolicitudServicio = require('../models/SolicitudServicio');
const Solicitud = require('../models/Solicitud'); // 🟢 IMPORTAMOS LA NUEVA MÁQUINA DE ESTADOS
const Usuario = require('../models/Usuarios_Praxo');
const { cotizarSolicitud } = require('../services/solicitudes');
const { actualizarPrecio, cambiarDisponibilidad } = require('../services/prestador');

const UNIDADES = ['servicio', 'hora', 'dia'];
const PRECIO_MAXIMO = 1000000;
const MAX_TEXTO = 140;
const MAX_HISTORIAL = 20;            // cambios del precio base que se conservan
const MAX_HISTORIAL_SOLICITUD = 30;  // movimientos de precio por solicitud


// -----------------------------------------------------------
// ACCESO: solo prestadores con sesion iniciada.
// -----------------------------------------------------------
function requierePrestador(req, res, next) {
  const usuario = req.session && req.session.usuario;
  const esPagina = req.method === 'GET';

  if (!usuario) {
    return esPagina
      ? res.redirect('/login')
      : res.status(401).json({ mensaje: 'Inicia sesión para continuar.' });
  }

  if (usuario.tipoUsuario !== 'prestador') {
    return esPagina
      ? res.status(403).send('Esta página es solo para prestadores de servicios.')
      : res.status(403).json({ mensaje: 'Solo los prestadores pueden hacer esto.' });
  }

  next();
}

router.use(requierePrestador);


// -----------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------
function obtenerUsuarioId(req) {
  const u = req.session && req.session.usuario;
  return u ? (u.id || u._id || null) : null;
}

async function buscarPerfil(req) {
  const usuarioId = obtenerUsuarioId(req);
  if (!usuarioId) {
    return null;
  }
  return Trabajador.findOne({ usuarioId });
}

function leerPrecio(valorCrudo) {
  const texto = String(
    valorCrudo === undefined || valorCrudo === null ? '' : valorCrudo
  ).trim();

  const valor = Number(texto);

  if (texto === '' || !Number.isFinite(valor) || valor <= 0 || valor > PRECIO_MAXIMO) {
    return { ok: false };
  }

  return { ok: true, valor: Math.round(valor * 100) / 100 };
}


// ===========================================================
// PRECIO BASE DEL PERFIL
// ===========================================================

// GET /prestador/precio
router.get('/precio', async (req, res) => {
  try {
    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    const historial = [...(trabajador.historialPrecios || [])]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);

    return res.render('prestador-precio', {
      titulo: 'Mi precio',
      trabajador,
      historial
    });

  } catch (error) {
    console.error('Error al cargar la pagina de precio:', error);
    return res.status(500).send('Ocurrió un error al cargar tu precio.');
  }
});


// POST /prestador/precio
router.post('/precio', async (req, res) => {
  try {
    const r = await actualizarPrecio(obtenerUsuarioId(req), req.body); // services/prestador.js
    if (!r.ok) return res.status(r.status).json({ mensaje: r.error });
    return res.json({ mensaje: r.mensaje, precio: r.precio, unidad: r.unidad });
  } catch (error) {
    console.error('Error al guardar el precio:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});


// ===========================================================
// BANDEJA DE SOLICITUDES (MÁQUINA DE ESTADOS)
// ===========================================================

// GET /prestador/solicitudes
router.get('/solicitudes', async (req, res) => {
  try {
    const trabajador = await buscarPerfil(req);

    if (!trabajador) {
      return res.status(404).send('No se encontró tu perfil de prestador.');
    }

    // 🟢 BUSCAMOS EN LA NUEVA COLECCIÓN 'Solicitud'
    const solicitudes = await Solicitud.find({ trabajadorId: trabajador._id })
      .populate('clienteId', 'nombre') 
      .sort({ fechaCreacion: -1 })
      .lean();

    return res.render('prestador-solicitudes', {
      titulo: 'Solicitudes recibidas',
      trabajador,
      solicitudes // Pasamos la data directa a la vista
    });

  } catch (error) {
    console.error('Error al cargar las solicitudes:', error);
    return res.status(500).send('No se pudieron cargar tus solicitudes.');
  }
});


// 🟢 NUEVA RUTA: RESPONDER Y COTIZAR SOLICITUD
// POST /prestador/responder-solicitud/:id
router.post('/responder-solicitud/:id', async (req, res) => {
  try {
    // services/solicitudes.js: mismas reglas que la app (solo Pendiente, precio válido)
    const r = await cotizarSolicitud(req.params.id, req.session.usuario, {
      precio: req.body.precioAcordado,
      mensaje: req.body.mensajeCotizacion
    });

    if (!r.ok) {
      const estados = { 'precio-invalido': 400, 'no-encontrada': 404, 'sin-perfil': 404, 'ya-cotizada': 409 };
      const textos = {
        'precio-invalido': 'Debes ingresar un precio válido.',
        'no-encontrada': 'La solicitud no existe.',
        'sin-perfil': 'No se encontró tu perfil de prestador.',
        'ya-cotizada': 'Esta solicitud ya fue cotizada y no puede modificarse.'
      };
      return res.status(estados[r.error] || 400).send(textos[r.error] || 'No se pudo cotizar.');
    }

    // Regresamos a la bandeja
    return res.redirect('/prestador/solicitudes');

  } catch (error) {
    console.error('Error al cotizar solicitud:', error);
    return res.status(500).send('Error interno del servidor.');
  }
});


// ===========================================================
// DISPONIBILIDAD ("Disponible ahora")
// POST /prestador/disponibilidad   body: { disponible: true|false }
// ===========================================================
router.post('/disponibilidad', async (req, res) => {
  try {
    const r = await cambiarDisponibilidad(obtenerUsuarioId(req), req.body.disponible); // services/prestador.js
    if (!r.ok) return res.status(r.status).json({ mensaje: r.error });
    return res.json({ disponible: r.disponible, mensaje: r.mensaje });
  } catch (error) {
    console.error('Error al actualizar disponibilidad:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});


module.exports = router;