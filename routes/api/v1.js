// routes/api/v1.js
// API JSON para la app móvil de PRAXO (versión 1) — CLIENTES y PRESTADORES.
// Se monta en app.js como: app.use('/api/v1', ...)
//
// La app y la web comparten la MISMA base de datos y la misma lógica
// (services/), por eso lo que se haga en una se ve en la otra.
//
// Este archivo: salud, configuración, inicio, catálogo, autenticación y carrito.
// El ciclo del servicio (chat, cotizar, pagar, completar, reseñar, perfil del
// prestador) está en ./v1Servicios.js.

const express = require('express');
const router = express.Router();

const Trabajador = require('../../models/Trabajador');
const Resena = require('../../models/Resena');
const SolicitudServicio = require('../../models/SolicitudServicio');
const Usuario = require('../../models/Usuarios_Praxo');

const tarifas = require('../../config/tarifas');
const { crearToken } = require('../../services/jwt');
const { verificarCredenciales } = require('../../services/auth');
const { obtenerMejoresResenas, nombrePublico } = require('../../services/resenas');
const carrito = require('../../services/carrito');
const { requiereClienteApi, requiereCualquierUsuarioApi } = require('../../middlewares/apiAuth');
const stripe = require('../../services/stripe');
const { subirEvidencia } = require('../../middlewares/subidas');
const { limitadores } = require('../../middlewares/seguridad');
const authRouter = require('../auth');

const VERSION_API = '1.0.0';

const { urlBase, urlAbsoluta, trabajadorPublico, usuarioPublico } = require('./util');

// Todas las respuestas de la API son JSON y no se guardan en caché
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ===========================================================
// PÚBLICAS
// ===========================================================

// GET /api/v1/salud  -> la app comprueba que el servidor responde
router.get('/salud', (req, res) => {
  res.json({ ok: true, version: VERSION_API, hora: new Date().toISOString() });
});

// GET /api/v1/config  -> datos que la app necesita mostrar
router.get('/config', (req, res) => {
  const base = urlBase(req);
  res.json({
    comisionPorcentaje: tarifas.COMISION_PORCENTAJE,
    ivaPorcentaje: tarifas.IVA_PORCENTAJE,
    pagos: { stripe: stripe.activo() }, // false = pago simulado
    oficios: ['Electricista', 'Plomero', 'Cerrajero', 'Albañil', 'Pintor'],
    urls: {
      terminos: `${base}/terminos`,
      privacidad: `${base}/aviso-privacidad`,
      politicas: `${base}/politicas`,
      centroPrivacidad: `${base}/perfil/privacidad`,
      contacto: `${base}/contacto`
    }
  });
});

// GET /api/v1/inicio  -> pantalla de inicio: destacados, reseñas y oficios
router.get('/inicio', async (req, res) => {
  try {
    const [destacados, resenas, oficios] = await Promise.all([
      Trabajador.find().sort({ calificacionPromedio: -1, totalResenas: -1 }).limit(6).lean(),
      obtenerMejoresResenas().catch(() => []),
      Trabajador.distinct('oficio')
    ]);

    res.json({
      destacados: destacados.map((t) => trabajadorPublico(req, t)),
      mejoresResenas: resenas.map((r) => ({
        ...r,
        trabajador: { ...r.trabajador, fotoUrl: urlAbsoluta(req, r.trabajador.fotoUrl) }
      })),
      oficios: oficios.filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
    });
  } catch (error) {
    console.error('API /inicio:', error.message);
    res.status(500).json({ mensaje: 'No se pudo cargar el inicio.' });
  }
});

// GET /api/v1/trabajadores?oficio=Plomero&ciudad=Tula
router.get('/trabajadores', async (req, res) => {
  try {
    const filtro = {};
    if (typeof req.query.oficio === 'string' && req.query.oficio) {
      filtro.oficio = req.query.oficio.slice(0, 60);
    }
    if (typeof req.query.ciudad === 'string' && req.query.ciudad) {
      const ciudad = req.query.ciudad.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filtro.ciudad = { $regex: ciudad, $options: 'i' };
    }

    const lista = await Trabajador.find(filtro)
      .sort({ disponibleAhora: -1, calificacionPromedio: -1 })
      .limit(100)
      .lean();

    res.json({ trabajadores: lista.map((t) => trabajadorPublico(req, t)) });
  } catch (error) {
    console.error('API /trabajadores:', error.message);
    res.status(500).json({ mensaje: 'No se pudieron cargar los profesionales.' });
  }
});

// GET /api/v1/trabajadores/:id  -> perfil + reseñas
router.get('/trabajadores/:id', async (req, res) => {
  try {
    const t = await Trabajador.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ mensaje: 'Profesional no encontrado.' });

    const resenas = await Resena.find({ trabajadorId: t._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('clienteId', 'nombre')
      .lean();

    res.json({
      trabajador: trabajadorPublico(req, t),
      resenas: resenas.map((r) => ({
        calificacion: r.calificacion,
        comentario: r.comentario || '',
        cliente: nombrePublico(r.clienteId && r.clienteId.nombre),
        fecha: r.createdAt
      }))
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ mensaje: 'Profesional no encontrado.' });
    console.error('API /trabajadores/:id:', error.message);
    res.status(500).json({ mensaje: 'No se pudo cargar el perfil.' });
  }
});

// ===========================================================
// AUTENTICACIÓN
// ===========================================================

// POST /api/v1/auth/login  { correo, password } -> { token, usuario }
router.post('/auth/login', limitadores.loginPorIp, limitadores.loginPorCuenta, async (req, res) => {
  try {
    const resultado = await verificarCredenciales(req.body.correo, req.body.password);
    if (resultado.error) {
      return res.status(resultado.status).json({ mensaje: resultado.error });
    }

    const usuario = resultado.usuario;
    limitadores.loginPorCuenta.reiniciar(req);
    const token = crearToken({ sub: String(usuario._id), ver: usuario.tokenVersion || 0 });
    res.json({ token, usuario: usuarioPublico(usuario) });
  } catch (error) {
    console.error('API login:', error.message);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// POST /api/v1/auth/registro  -> mismo registro que la web (cliente o prestador).
// Requiere aceptaTerminos y aceptaPrivacidad; el prestador además oficio, teléfono y ciudad.
router.post('/auth/registro', limitadores.registro, (req, res, next) => {
  const tipoUsuario = req.body && req.body.tipoUsuario === 'prestador' ? 'prestador' : 'cliente';
  req.body = { ...req.body, tipoUsuario };
  req.url = '/registro';
  authRouter(req, res, next);
});

// GET /api/v1/auth/yo
router.get('/auth/yo', requiereCualquierUsuarioApi, (req, res) => {
  res.json({ usuario: req.usuario });
});

// POST /api/v1/auth/cerrar-sesiones -> invalida los tokens de TODOS los dispositivos
router.post('/auth/cerrar-sesiones', requiereCualquierUsuarioApi, async (req, res) => {
  await Usuario.updateOne({ _id: req.usuario.id }, { $inc: { tokenVersion: 1 } });
  res.json({ ok: true });
});

// ===========================================================
// CARRITO (con token)
// ===========================================================

router.get('/carrito', requiereClienteApi, async (req, res) => {
  try {
    const { items, resumen } = await carrito.obtenerCarrito(req.usuario.id);
    res.json({
      resumen,
      items: items.map((i) => ({
        id: i.id,
        trabajadorId: String(i.trabajadorId && i.trabajadorId._id ? i.trabajadorId._id : i.trabajadorId),
        trabajador: i.trabajador,
        servicio: i.servicio,
        fecha: i.fecha,
        hora: i.hora,
        ubicacion: i.ubicacion,
        referenciasUbicacion: i.referenciasUbicacion || '',
        descripcion: i.descripcion,
        urgencia: i.urgencia,
        requiereCotizacion: Boolean(i.requiereCotizacion),
        imagenUrl: urlAbsoluta(req, i.imagenEvidencia),
        unidadReferencia: i.unidadReferencia,
        estimado: i.estimado
      }))
    });
  } catch (error) {
    console.error('API GET carrito:', error.message);
    res.status(500).json({ mensaje: 'No se pudo cargar tu carrito.' });
  }
});

// POST /api/v1/carrito  (multipart/form-data; foto opcional en "imagenEvidencia")
router.post('/carrito', requiereClienteApi, subirEvidencia('json'), async (req, res) => {
  try {
    const rutaImagen = req.file ? '/uploads/solicitudes/' + req.file.filename : null;
    const resultado = await carrito.agregarAlCarrito(req.usuario.id, req.body, rutaImagen);
    if (!resultado.ok) {
      return res.status(resultado.status).json({ mensaje: resultado.error });
    }
    const cantidad = await SolicitudServicio.countDocuments({ clienteId: req.usuario.id });
    res.status(201).json({ mensaje: 'Servicio agregado a tu carrito.', id: String(resultado.item._id), cantidad });
  } catch (error) {
    console.error('API POST carrito:', error.message);
    res.status(500).json({ mensaje: 'No se pudo agregar el servicio.' });
  }
});

router.delete('/carrito/:id', requiereClienteApi, async (req, res) => {
  try {
    await SolicitudServicio.findOneAndDelete({ _id: req.params.id, clienteId: req.usuario.id });
    const cantidad = await SolicitudServicio.countDocuments({ clienteId: req.usuario.id });
    res.json({ ok: true, cantidad });
  } catch (error) {
    res.status(400).json({ mensaje: 'No se pudo eliminar el servicio.' });
  }
});

// POST /api/v1/carrito/confirmar  { aceptaPoliticas: true }
router.post('/carrito/confirmar', requiereClienteApi, async (req, res) => {
  try {
    if (req.body.aceptaPoliticas !== true) {
      return res.status(400).json({ mensaje: 'Debes aceptar las políticas de compra para continuar.' });
    }
    const { creadas } = await carrito.confirmarCarrito(req.usuario.id);
    if (creadas === 0) {
      return res.status(400).json({ mensaje: 'Tu carrito está vacío.' });
    }
    res.json({ mensaje: `Enviamos ${creadas} solicitud(es). Los prestadores te enviarán su cotización.`, creadas });
  } catch (error) {
    console.error('API confirmar carrito:', error.message);
    res.status(500).json({ mensaje: 'No se pudo confirmar la contratación.' });
  }
});

// ===========================================================
// CICLO DEL SERVICIO (cliente y prestador) -> ./v1Servicios.js
// ===========================================================
router.use(require('./v1Servicios'));

// -----------------------------------------------------------
// Rutas inexistentes y errores: siempre JSON
// -----------------------------------------------------------
router.use((req, res) => res.status(404).json({ mensaje: 'Ruta de la API no encontrada.' }));
// eslint-disable-next-line no-unused-vars
router.use((error, req, res, next) => {
  console.error('Error en API v1:', error);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

module.exports = router;
