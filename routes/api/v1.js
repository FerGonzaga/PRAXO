// routes/api/v1.js
// API JSON para la app móvil de PRAXO (versión 1, solo clientes).
// Se monta en app.js como: app.use('/api/v1', ...)
//
// La app y la web comparten la MISMA base de datos y la misma lógica
// (services/), por eso lo que se haga en una se ve en la otra.
//
// Públicas:  GET  /salud, /config, /inicio, /trabajadores, /trabajadores/:id
//            POST /auth/login, /auth/registro
// Con token: GET  /auth/yo, /carrito, /solicitudes
//            POST /auth/cerrar-sesiones, /carrito, /carrito/confirmar
//            DELETE /carrito/:id

const express = require('express');
const router = express.Router();

const Trabajador = require('../../models/Trabajador');
const Resena = require('../../models/Resena');
const Solicitud = require('../../models/Solicitud');
const SolicitudServicio = require('../../models/SolicitudServicio');
const Usuario = require('../../models/Usuarios_Praxo');

const tarifas = require('../../config/tarifas');
const { crearToken } = require('../../services/jwt');
const { verificarCredenciales } = require('../../services/auth');
const { obtenerMejoresResenas, nombrePublico } = require('../../services/resenas');
const carrito = require('../../services/carrito');
const { requiereClienteApi } = require('../../middlewares/apiAuth');
const { subirEvidencia } = require('../../middlewares/subidas');
const { limitadores } = require('../../middlewares/seguridad');
const authRouter = require('../auth');

const VERSION_API = '1.0.0';

// -----------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------
function urlBase(req) {
  return process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : `${req.protocol}://${req.get('host')}`;
}

// Convierte rutas locales ("/uploads/x.jpg") en URLs completas para la app
function urlAbsoluta(req, ruta) {
  if (!ruta) return null;
  const limpia = String(ruta).replace(/\\/g, '/');
  if (/^https?:\/\//i.test(limpia)) return limpia;
  return urlBase(req) + (limpia.startsWith('/') ? '' : '/') + limpia;
}

// Forma pública de un prestador (sin teléfono ni datos privados)
function trabajadorPublico(req, t) {
  const ref = carrito.precioReferencia(t);
  const estimado = ref ? tarifas.calcularDesglose(ref.precio) : null;
  return {
    id: String(t._id),
    nombre: t.nombre,
    oficio: t.oficio,
    ciudad: t.ciudad || '',
    descripcion: t.descripcion || '',
    fotoUrl: urlAbsoluta(req, t.fotoUrl),
    calificacion: t.totalResenas > 0 ? Number(t.calificacionPromedio || 0) : null,
    totalResenas: t.totalResenas || 0,
    disponibleAhora: Boolean(t.disponibleAhora),
    precio: estimado
      ? { desde: estimado.total, prestador: estimado.precioPrestador, unidad: ref.unidad }
      : null // "a cotizar"
  };
}

function solicitudPublica(req, s) {
  const d = tarifas.desgloseDeSolicitud(s);
  const tienePrecio = typeof s.precioAcordado === 'number' && s.precioAcordado > 0;
  return {
    id: String(s._id),
    servicio: s.servicio,
    estado: s.estado,
    fecha: s.fecha,
    hora: s.hora,
    ubicacion: s.ubicacion,
    urgencia: s.urgencia,
    fechaCreacion: s.fechaCreacion,
    prestador: s.trabajadorId && s.trabajadorId._id
      ? { id: String(s.trabajadorId._id), nombre: s.trabajadorId.nombre, oficio: s.trabajadorId.oficio, fotoUrl: urlAbsoluta(req, s.trabajadorId.fotoUrl) }
      : null,
    cotizacion: tienePrecio ? { mensaje: s.mensajeCotizacion || '', desglose: d } : null,
    pago: s.pago && s.pago.referencia
      ? { referencia: s.pago.referencia, monto: s.pago.monto, fecha: s.pago.fecha, comprobanteUrl: `${urlBase(req)}/pago/${s._id}/comprobante` }
      : null,
    // Mientras la app no tenga chat/pago propios, abre estas pantallas en la web
    urlWeb: `${urlBase(req)}/chat/${s._id}`
  };
}

function usuarioPublico(u) {
  return { id: String(u._id || u.id), nombre: u.nombre, correo: u.correo, tipoUsuario: u.tipoUsuario };
}

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
    if (usuario.tipoUsuario !== 'cliente') {
      return res.status(403).json({ mensaje: 'Por ahora la app de PRAXO es solo para clientes. Los prestadores pueden usar la página web.' });
    }

    limitadores.loginPorCuenta.reiniciar(req);
    const token = crearToken({ sub: String(usuario._id), ver: usuario.tokenVersion || 0 });
    res.json({ token, usuario: usuarioPublico(usuario) });
  } catch (error) {
    console.error('API login:', error.message);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// POST /api/v1/auth/registro  -> mismo registro que la web, siempre como cliente.
// Requiere aceptaTerminos y aceptaPrivacidad (consentimiento expreso).
router.post('/auth/registro', limitadores.registro, (req, res, next) => {
  req.body = { ...req.body, tipoUsuario: 'cliente' };
  req.url = '/registro';
  authRouter(req, res, next);
});

// GET /api/v1/auth/yo
router.get('/auth/yo', requiereClienteApi, (req, res) => {
  res.json({ usuario: req.usuario });
});

// POST /api/v1/auth/cerrar-sesiones -> invalida los tokens de TODOS los dispositivos
router.post('/auth/cerrar-sesiones', requiereClienteApi, async (req, res) => {
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
// MIS SERVICIOS (con token)
// ===========================================================

router.get('/solicitudes', requiereClienteApi, async (req, res) => {
  try {
    const lista = await Solicitud.find({ clienteId: req.usuario.id })
      .populate('trabajadorId', 'nombre oficio fotoUrl')
      .sort({ fechaCreacion: -1 })
      .limit(100)
      .lean();
    res.json({ solicitudes: lista.map((s) => solicitudPublica(req, s)) });
  } catch (error) {
    console.error('API solicitudes:', error.message);
    res.status(500).json({ mensaje: 'No se pudieron cargar tus servicios.' });
  }
});

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
