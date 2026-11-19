// routes/api/v1Servicios.js
// API v1 — ciclo completo de un servicio para CLIENTES y PRESTADORES.
// Se monta dentro de routes/api/v1.js. Toda la lógica está en services/,
// la misma que usa la página web: lo que se hace en la app se ve en la web y al revés.
//
//  Ambos:      GET  /solicitudes, /solicitudes/:id, /solicitudes/:id/mensajes?despues=
//              POST /solicitudes/:id/mensajes, /solicitudes/:id/comprobante-url
//              GET  /comprobantes/:id?t=<token temporal>          (PDF)
//  Cliente:    POST /solicitudes/:id/aceptar | rechazar | resena
//              POST /solicitudes/:id/pago/stripe | pago/simulado
//              GET  /pagos/stripe/retorno | cancelado             (páginas que ve el navegador)
//  Prestador:  GET  /prestador/perfil, /prestador/resenas
//              POST /prestador/disponibilidad, /prestador/precio
//              POST /solicitudes/:id/cotizar | completar

const express = require('express');
const router = express.Router();

const Solicitud = require('../../models/Solicitud');
const Mensaje = require('../../models/Mensaje');
const Resena = require('../../models/Resena');
const Trabajador = require('../../models/Trabajador');

const tarifas = require('../../config/tarifas');
const { crearToken, verificarToken } = require('../../services/jwt');
const { nombrePublico } = require('../../services/resenas');
const srv = require('../../services/solicitudes');
const prestador = require('../../services/prestador');
const stripe = require('../../services/stripe');
const { registrarPago, confirmarSesionStripe, centavos, TARJETA_RECHAZADA, validarTarjeta } = require('../../services/pagos');
const { puedeVerComprobante, generarComprobante } = require('../../services/comprobante');
const { requiereCualquierUsuarioApi, requiereClienteApi, requierePrestadorApi } = require('../../middlewares/apiAuth');
const { limitadores } = require('../../middlewares/seguridad');
const { urlBase, urlAbsoluta, trabajadorPublico } = require('./util');

// -----------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------

// Convierte { error: 'codigo' } del servicio en respuesta JSON
const ESTADOS_HTTP = {
  'no-encontrada': 404, 'sin-perfil': 404, 'sin-permiso': 403, 'solo-cliente': 403, 'solo-prestador': 403,
  'no-aceptable': 409, 'no-completable': 409, 'no-calificable': 409, 'ya-calificada': 409, 'ya-cotizada': 409
};
function responderError(res, codigo) {
  return res.status(ESTADOS_HTTP[codigo] || 400).json({ codigo, mensaje: srv.MENSAJES[codigo] || 'No se pudo completar la acción.' });
}

// Envuelve un handler async para no repetir try/catch
const manejar = (nombre, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ mensaje: 'No encontrado.' });
    console.error(`API ${nombre}:`, error);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
};

function mensajePublico(m, usuarioId) {
  return {
    id: String(m._id),
    texto: m.texto,
    fecha: m.fecha,
    mio: String(m.emisorId && m.emisorId._id ? m.emisorId._id : m.emisorId) === String(usuarioId),
    autor: m.emisorId && m.emisorId.nombre ? m.emisorId.nombre : null
  };
}

// Qué botones puede ver cada rol en cada estado
function accionesDisponibles(s, rol, tieneResena) {
  const a = [];
  if (rol === 'cliente') {
    if (s.estado === 'Cotizada') a.push('aceptar', 'rechazar');
    if (s.estado === 'Aceptada') a.push('pagar');
    if (s.estado === 'Completada' && !tieneResena) a.push('resena');
  } else {
    if (s.estado === 'Pendiente') a.push('cotizar');
    if (s.estado === 'Pagada') a.push('completar');
  }
  if (s.pago && s.pago.referencia) a.push('comprobante');
  return a;
}

function solicitudResumen(req, s, rol) {
  const tienePrecio = typeof s.precioAcordado === 'number' && s.precioAcordado > 0;
  const t = s.trabajadorId && s.trabajadorId._id ? s.trabajadorId : null;
  const c = s.clienteId && s.clienteId._id ? s.clienteId : null;
  return {
    id: String(s._id),
    servicio: s.servicio,
    estado: s.estado,
    fecha: s.fecha,
    hora: s.hora,
    ubicacion: s.ubicacion,
    urgencia: s.urgencia,
    fechaCreacion: s.fechaCreacion,
    prestador: t ? { id: String(t._id), nombre: t.nombre, oficio: t.oficio, fotoUrl: urlAbsoluta(req, t.fotoUrl) } : null,
    cliente: c ? { nombre: rol === 'prestador' ? c.nombre : undefined } : null,
    total: tienePrecio
      ? (rol === 'prestador' ? s.precioAcordado : (s.pago && s.pago.monto) || tarifas.desgloseDeSolicitud(s).total)
      : null,
    pagado: Boolean(s.pago && s.pago.referencia)
  };
}

async function cargarSolicitudConRol(req, res) {
  const s = await Solicitud.findById(req.params.id)
    .populate('clienteId', 'nombre')
    .populate('trabajadorId', 'nombre oficio fotoUrl usuarioId telefono');
  if (!s) {
    res.status(404).json({ mensaje: 'La solicitud no existe.' });
    return {};
  }
  const rol = await srv.rolEnSolicitud(s, req.usuario);
  if (!rol) {
    res.status(403).json({ mensaje: 'No tienes permiso para ver este servicio.' });
    return {};
  }
  return { s, rol };
}

// ===========================================================
// AMBOS ROLES
// ===========================================================

// GET /solicitudes  -> cliente: las que pidió · prestador: las que recibió
router.get('/solicitudes', requiereCualquierUsuarioApi, manejar('solicitudes', async (req, res) => {
  let filtro;
  if (req.usuario.tipoUsuario === 'prestador') {
    const t = await srv.trabajadorDeUsuario(req.usuario.id);
    if (!t) return res.status(404).json({ mensaje: 'No se encontró tu perfil de prestador.' });
    filtro = { trabajadorId: t._id };
  } else {
    filtro = { clienteId: req.usuario.id };
  }

  const lista = await Solicitud.find(filtro)
    .populate('trabajadorId', 'nombre oficio fotoUrl')
    .populate('clienteId', 'nombre')
    .sort({ fechaCreacion: -1 })
    .limit(200)
    .lean();

  res.json({ solicitudes: lista.map((s) => solicitudResumen(req, s, req.usuario.tipoUsuario)) });
}));

// GET /solicitudes/:id  -> detalle + cotización + pago + reseña + mensajes + acciones
router.get('/solicitudes/:id', requiereCualquierUsuarioApi, manejar('detalle', async (req, res) => {
  const { s, rol } = await cargarSolicitudConRol(req, res);
  if (!s) return;

  const [mensajes, resena] = await Promise.all([
    Mensaje.find({ solicitudId: s._id }).sort({ fecha: 1 }).limit(500).populate('emisorId', 'nombre').lean(),
    Resena.findOne({ solicitudId: s._id }).lean()
  ]);

  const tienePrecio = typeof s.precioAcordado === 'number' && s.precioAcordado > 0;
  const t = s.trabajadorId;

  res.json({
    rol,
    solicitud: {
      ...solicitudResumen(req, s, rol),
      descripcion: s.descripcion,
      referenciasUbicacion: s.referenciasUbicacion || '',
      requiereCotizacion: Boolean(s.requiereCotizacion),
      imagenUrl: urlAbsoluta(req, s.imagenEvidencia),
      // El teléfono del prestador solo se comparte con su cliente cuando ya pagó
      contactoPrestador: rol === 'cliente' && s.pago && s.pago.referencia && t ? { telefono: t.telefono || null } : null
    },
    cotizacion: tienePrecio ? { mensaje: s.mensajeCotizacion || '', desglose: tarifas.desgloseDeSolicitud(s) } : null,
    pago: s.pago && s.pago.referencia ? {
      referencia: s.pago.referencia,
      monto: s.pago.monto,
      precioPrestador: s.pago.precioPrestador,
      marca: s.pago.marca,
      ultimos4: s.pago.ultimos4,
      proveedor: s.pago.proveedor,
      fecha: s.pago.fecha
    } : null,
    resena: resena ? { calificacion: resena.calificacion, comentario: resena.comentario || '', fecha: resena.createdAt } : null,
    acciones: accionesDisponibles(s, rol, Boolean(resena)),
    mensajes: mensajes.map((m) => mensajePublico(m, req.usuario.id))
  });
}));

// GET /solicitudes/:id/mensajes?despues=ISO  -> solo los nuevos (la app pregunta cada pocos segundos)
router.get('/solicitudes/:id/mensajes', requiereCualquierUsuarioApi, manejar('mensajes', async (req, res) => {
  const { s } = await cargarSolicitudConRol(req, res);
  if (!s) return;

  const filtro = { solicitudId: s._id };
  const despues = new Date(String(req.query.despues || ''));
  if (!Number.isNaN(despues.getTime())) filtro.fecha = { $gt: despues };

  const mensajes = await Mensaje.find(filtro).sort({ fecha: 1 }).limit(200).populate('emisorId', 'nombre').lean();
  res.json({ estado: s.estado, mensajes: mensajes.map((m) => mensajePublico(m, req.usuario.id)) });
}));

// POST /solicitudes/:id/mensajes  { texto }
router.post('/solicitudes/:id/mensajes', requiereCualquierUsuarioApi, limitadores.mensajes, manejar('enviar mensaje', async (req, res) => {
  const r = await srv.enviarMensaje(req.params.id, req.usuario, req.body.texto);
  if (!r.ok) return responderError(res, r.error);
  const m = await Mensaje.findById(r.mensaje._id).populate('emisorId', 'nombre').lean();
  res.status(201).json({ mensaje: mensajePublico(m, req.usuario.id) });
}));

// POST /solicitudes/:id/comprobante-url  -> enlace temporal (10 min) para abrir el PDF en el navegador
router.post('/solicitudes/:id/comprobante-url', requiereCualquierUsuarioApi, manejar('comprobante-url', async (req, res) => {
  const { s } = await cargarSolicitudConRol(req, res);
  if (!s) return;
  if (!s.pago || !s.pago.referencia) return res.status(404).json({ mensaje: 'Este servicio aún no tiene un pago registrado.' });

  const t = crearToken({ sub: req.usuario.id, sol: String(s._id), uso: 'comprobante' }, 10 * 60);
  res.json({ url: `${urlBase(req)}/api/v1/comprobantes/${s._id}?t=${encodeURIComponent(t)}` });
}));

// GET /comprobantes/:id?t=...  -> PDF (lo abre el navegador, por eso el token va en la URL)
router.get('/comprobantes/:id', manejar('comprobante', async (req, res) => {
  const datos = verificarToken(String(req.query.t || ''));
  if (!datos || datos.uso !== 'comprobante' || datos.sol !== String(req.params.id)) {
    return res.status(401).send('El enlace del comprobante expiró. Vuelve a abrirlo desde la app.');
  }

  const s = await Solicitud.findById(req.params.id)
    .populate('clienteId', 'nombre')
    .populate('trabajadorId', 'nombre oficio usuarioId');
  const Usuario = require('../../models/Usuarios_Praxo');
  const u = await Usuario.findById(datos.sub).select('tipoUsuario').lean();
  if (!s || !u || !puedeVerComprobante(s, { id: datos.sub, tipoUsuario: u.tipoUsuario })) {
    return res.status(403).send('No tienes permiso para ver este comprobante.');
  }

  const c = generarComprobante(s);
  if (!c) return res.status(404).send('Este servicio aún no tiene un pago registrado.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${c.nombre}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(c.pdf);
}));

// ===========================================================
// CLIENTE
// ===========================================================

const accionCliente = (nombre, fn) => manejar(nombre, async (req, res) => {
  const r = await fn(req);
  if (!r.ok) return responderError(res, r.error);
  res.json({ ok: true, estado: r.solicitud.estado });
});

router.post('/solicitudes/:id/aceptar', requiereClienteApi,
  accionCliente('aceptar', (req) => srv.aceptarCotizacion(req.params.id, req.usuario)));

router.post('/solicitudes/:id/rechazar', requiereClienteApi,
  accionCliente('rechazar', (req) => srv.rechazarCotizacion(req.params.id, req.usuario)));

router.post('/solicitudes/:id/resena', requiereClienteApi,
  accionCliente('reseña', (req) => srv.dejarResena(req.params.id, req.usuario, req.body)));

// ---------- PAGO CON STRIPE (página segura de Stripe en el navegador del teléfono) ----------
router.post('/solicitudes/:id/pago/stripe', requiereClienteApi, manejar('pago stripe', async (req, res) => {
  if (!stripe.activo()) return res.status(400).json({ mensaje: 'Stripe no está configurado en el servidor.' });

  const s = await Solicitud.findOne({ _id: req.params.id, clienteId: req.usuario.id });
  if (!s) return res.status(404).json({ mensaje: 'La solicitud no existe.' });
  if (s.estado !== 'Aceptada') return res.status(409).json({ mensaje: 'Primero acepta la cotización para poder pagar.' });

  const d = tarifas.desgloseDeSolicitud(s);
  if (d.total < 10) return res.status(400).json({ mensaje: 'El monto mínimo para pagar con tarjeta es de $10.00 MXN.' });

  const base = urlBase(req);
  const sesion = await stripe.crearSesionCheckout({
    solicitudId: String(s._id),
    clienteId: req.usuario.id,
    totalCentavos: centavos(d.total),
    nombre: `${s.servicio} · PRAXO`,
    descripcion: `Prestador ${tarifas.formatoMXN(d.precioPrestador)} + comisión ${tarifas.formatoMXN(d.comision)} + IVA ${tarifas.formatoMXN(d.ivaComision)}`,
    urlExito: `${base}/api/v1/pagos/stripe/retorno?session_id={CHECKOUT_SESSION_ID}`,
    urlCancelar: `${base}/api/v1/pagos/stripe/cancelado`
  });
  res.json({ url: sesion.url });
}));

// Página sencilla que ve el cliente en el navegador al terminar
function paginaPago(titulo, texto, ok) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo} - PRAXO</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0b1f3a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">
<div><div style="font-size:64px">${ok ? '✅' : 'ℹ️'}</div><h1 style="margin:8px 0">${titulo}</h1>
<p style="color:#c7d2e3;max-width:340px;margin:0 auto 24px">${texto}</p>
<p style="background:#f7931e;color:#0b1f3a;display:inline-block;padding:12px 20px;border-radius:12px;font-weight:700">Cierra esta ventana para volver a PRAXO</p></div></body></html>`;
}

// GET /pagos/stripe/retorno?session_id=...  -> confirma con Stripe (no confía en la URL)
router.get('/pagos/stripe/retorno', manejar('retorno stripe', async (req, res) => {
  if (!stripe.activo() || !req.query.session_id) return res.status(400).send(paginaPago('Pago no encontrado', 'Vuelve a la app e inténtalo de nuevo.', false));
  const sesion = await stripe.obtenerSesion(String(req.query.session_id));
  const r = await confirmarSesionStripe(sesion);
  if (r.estado === 'pagada' || r.estado === 'ya-pagada') {
    return res.send(paginaPago('¡Pago realizado!', 'Tu pago quedó registrado y el prestador ya fue notificado. Tu comprobante está en la app.', true));
  }
  res.send(paginaPago('Pago pendiente', 'Stripe aún no confirma tu pago. Revisa el servicio en la app en unos segundos.', false));
}));

router.get('/pagos/stripe/cancelado', (req, res) => {
  res.send(paginaPago('Pago cancelado', 'No se realizó ningún cargo. Puedes intentarlo de nuevo desde la app.', false));
});

// ---------- PAGO SIMULADO (solo si Stripe no está configurado) ----------
router.post('/solicitudes/:id/pago/simulado', requiereClienteApi, limitadores.pagos, manejar('pago simulado', async (req, res) => {
  if (stripe.activo()) return res.status(400).json({ mensaje: 'Este servidor usa Stripe: paga con la página segura de Stripe.' });

  const s = await Solicitud.findOne({ _id: req.params.id, clienteId: req.usuario.id });
  if (!s) return res.status(404).json({ mensaje: 'La solicitud no existe.' });
  if (s.estado !== 'Aceptada') return res.status(409).json({ mensaje: 'Primero acepta la cotización para poder pagar.' });

  const tarjeta = validarTarjeta(req.body);
  if (!tarjeta.ok) return res.status(400).json({ mensaje: tarjeta.error });
  if (tarjeta.numero === TARJETA_RECHAZADA) return res.status(402).json({ mensaje: 'Pago rechazado por el banco: fondos insuficientes.' });

  const pagada = await registrarPago({
    solicitud: s,
    desglose: tarifas.desgloseDeSolicitud(s),
    datosPago: { proveedor: 'simulado', metodo: 'Tarjeta (simulado)', marca: tarjeta.marca, ultimos4: tarjeta.ultimos4 }
  });
  if (!pagada) return res.status(409).json({ mensaje: 'Este servicio ya está pagado.' });
  res.json({ ok: true, referencia: pagada.pago.referencia });
}));

// ===========================================================
// PRESTADOR
// ===========================================================

router.post('/solicitudes/:id/cotizar', requierePrestadorApi, manejar('cotizar', async (req, res) => {
  const r = await srv.cotizarSolicitud(req.params.id, req.usuario, { precio: req.body.precio, mensaje: req.body.mensaje });
  if (!r.ok) return responderError(res, r.error);
  res.json({ ok: true, estado: r.solicitud.estado, desglose: r.solicitud.desglose });
}));

router.post('/solicitudes/:id/completar', requierePrestadorApi, manejar('completar', async (req, res) => {
  const r = await srv.completarServicio(req.params.id, req.usuario);
  if (!r.ok) return responderError(res, r.error);
  res.json({ ok: true, estado: r.solicitud.estado });
}));

// GET /prestador/perfil  -> datos del perfil, precio, disponibilidad y resumen
router.get('/prestador/perfil', requierePrestadorApi, manejar('perfil prestador', async (req, res) => {
  const t = await Trabajador.findOne({ usuarioId: req.usuario.id }).lean();
  if (!t) return res.status(404).json({ mensaje: 'No se encontró tu perfil de prestador.' });

  const conteo = await Solicitud.aggregate([
    { $match: { trabajadorId: t._id } },
    { $group: { _id: '$estado', n: { $sum: 1 } } }
  ]);
  const porEstado = {};
  conteo.forEach((c) => { porEstado[c._id] = c.n; });

  const pagadas = await Solicitud.find({ trabajadorId: t._id, 'pago.referencia': { $ne: null } }).select('pago').lean();
  const ganado = pagadas.reduce((suma, s) => suma + (typeof s.pago.precioPrestador === 'number' ? s.pago.precioPrestador : s.pago.monto || 0), 0);

  res.json({
    perfil: {
      ...trabajadorPublico(req, t),
      telefono: t.telefono,
      precioBase: t.precioBase,
      unidadPrecio: t.unidadPrecio || 'servicio',
      precioNota: t.precioNota || '',
      historialPrecios: (t.historialPrecios || []).slice(-10).reverse()
    },
    resumen: {
      porEstado,
      pendientes: porEstado.Pendiente || 0,
      enCurso: (porEstado.Cotizada || 0) + (porEstado.Aceptada || 0) + (porEstado.Pagada || 0),
      completados: porEstado.Completada || 0,
      totalRecibido: Math.round(ganado * 100) / 100
    },
    comisionPorcentaje: tarifas.COMISION_PORCENTAJE,
    ivaPorcentaje: tarifas.IVA_PORCENTAJE
  });
}));

router.post('/prestador/disponibilidad', requierePrestadorApi, manejar('disponibilidad', async (req, res) => {
  const r = await prestador.cambiarDisponibilidad(req.usuario.id, req.body.disponible);
  if (!r.ok) return res.status(r.status).json({ mensaje: r.error });
  res.json({ disponible: r.disponible, mensaje: r.mensaje });
}));

router.post('/prestador/precio', requierePrestadorApi, manejar('precio', async (req, res) => {
  const r = await prestador.actualizarPrecio(req.usuario.id, req.body);
  if (!r.ok) return res.status(r.status).json({ mensaje: r.error });
  res.json({ mensaje: r.mensaje, precio: r.precio, unidad: r.unidad });
}));

router.get('/prestador/resenas', requierePrestadorApi, manejar('reseñas prestador', async (req, res) => {
  const t = await srv.trabajadorDeUsuario(req.usuario.id);
  if (!t) return res.status(404).json({ mensaje: 'No se encontró tu perfil de prestador.' });
  const resenas = await Resena.find({ trabajadorId: t._id }).sort({ createdAt: -1 }).limit(50).populate('clienteId', 'nombre').lean();
  res.json({
    resenas: resenas.map((r) => ({
      calificacion: r.calificacion,
      comentario: r.comentario || '',
      cliente: nombrePublico(r.clienteId && r.clienteId.nombre),
      fecha: r.createdAt
    }))
  });
}));

module.exports = router;
