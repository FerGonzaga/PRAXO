// routes/pago.js
// PASARELA DE PAGO SIMULADA (modo demo).
// No se conecta a ningún banco ni guarda datos de tarjeta:
// solo se conservan la marca y los últimos 4 dígitos.
//
// Tarjetas de prueba:
//   4242 4242 4242 4242  -> pago aprobado
//   4000 0000 0000 0002  -> pago rechazado (fondos insuficientes)
//   Cualquier otra tarjeta válida (Luhn) -> aprobado

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const requiereSesion = require('../middlewares/requiereSesion');
const { desgloseDeSolicitud, formatoMXN } = require('../config/tarifas');
const { puedeVerComprobante, generarComprobante } = require('../services/comprobante');
const stripe = require('../services/stripe');
const ES_PRODUCCION = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
const { registrarPago, confirmarSesionStripe, centavos } = require('../services/pagos');

router.use(requiereSesion);

// ===========================================================
// GET /pago/:id/comprobante  -> ticket PDF del pago
// Lo pueden descargar el cliente y el prestador de la solicitud.
// Agrega ?descargar=1 para forzar la descarga.
// ===========================================================
router.get('/:id/comprobante', async (req, res) => {
  try {
    const solicitud = await Solicitud.findById(req.params.id)
      .populate('clienteId', 'nombre')
      .populate('trabajadorId', 'nombre oficio usuarioId');

    if (!solicitud || !solicitud.pago || !solicitud.pago.referencia) {
      return res.status(404).send('Este servicio aún no tiene un pago registrado.');
    }

    if (!puedeVerComprobante(solicitud, req.session.usuario)) {
      return res.status(403).send('No tienes permiso para ver este comprobante.');
    }

    const { pdf, nombre } = generarComprobante(solicitud);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Content-Disposition', `${req.query.descargar ? 'attachment' : 'inline'}; filename="${nombre}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf);

  } catch (error) {
    console.error('Error al generar el comprobante:', error);
    res.status(500).send('No se pudo generar el comprobante.');
  }
});

// Solo clientes pueden pagar
router.use((req, res, next) => {
  if (req.session.usuario.tipoUsuario !== 'cliente') {
    return res.status(403).send('Solo los clientes pueden realizar pagos.');
  }
  next();
});

const { TARJETA_RECHAZADA, validarTarjeta } = require('../services/pagos');

// Busca una solicitud del cliente en sesión
function buscarSolicitudDelCliente(req) {
  return Solicitud.findOne({
    _id: req.params.id,
    clienteId: req.session.usuario.id
  }).populate({
    path: 'trabajadorId',
    select: 'nombre oficio usuarioId'
  });
}

// ===========================================================
// GET /pago/:id  -> pantalla de pago (checkout)
// ===========================================================
router.get('/:id', async (req, res) => {
  try {
    const solicitud = await buscarSolicitudDelCliente(req);

    if (!solicitud) {
      return res.status(404).send('Solicitud no encontrada.');
    }

    // Si ya está pagada, lo mandamos al chat a ver su comprobante
    if (solicitud.estado === 'Pagada' || solicitud.estado === 'Completada') {
      return res.redirect(`/chat/${solicitud._id}?aviso=ya-pagada`);
    }

    if (solicitud.estado !== 'Aceptada') {
      return res.redirect(`/chat/${solicitud._id}?aviso=no-pagable`);
    }

    res.render('pago', {
      titulo: 'Pago seguro',
      solicitud,
      error: null,
      datos: {},
      stripeActivo: stripe.activo(),
      aviso: req.query.aviso || null,
      detalle: req.query.detalle ? String(req.query.detalle).slice(0, 300) : null
    });

  } catch (error) {
    console.error('Error al cargar el pago:', error);
    res.status(500).send('No se pudo cargar la pantalla de pago.');
  }
});

// ===========================================================
// POST /pago/:id  -> procesar pago simulado
// Aceptada -> Pagada
// ===========================================================
router.post('/:id', async (req, res) => {
  try {
    const solicitud = await buscarSolicitudDelCliente(req);

    if (!solicitud) {
      return res.status(404).send('Solicitud no encontrada.');
    }
    if (solicitud.estado !== 'Aceptada') {
      return res.redirect(`/chat/${solicitud._id}?aviso=no-pagable`);
    }

    // Con Stripe activo, los datos de tarjeta NO deben llegar a nuestro servidor
    if (stripe.activo()) {
      return res.redirect(`/pago/${solicitud._id}`);
    }

    const { numero, titular, vencimiento } = req.body;
    // Para volver a llenar el formulario si hay error (NUNCA regresamos el CVV)
    const datos = { titular, vencimiento, numero };

    const tarjeta = validarTarjeta(req.body);
    if (!tarjeta.ok) {
      return res.status(400).render('pago', {
        titulo: 'Pago seguro', solicitud, error: tarjeta.error, datos, stripeActivo: false, aviso: null
      });
    }

    // Simulamos el "banco" rechazando la tarjeta de prueba
    if (tarjeta.numero === TARJETA_RECHAZADA) {
      return res.status(402).render('pago', {
        titulo: 'Pago seguro',
        solicitud,
        error: 'Pago rechazado por el banco: fondos insuficientes. Intenta con otra tarjeta.',
        datos,
        stripeActivo: false,
        aviso: null
      });
    }

    const pagada = await registrarPago({
      solicitud,
      desglose: desgloseDeSolicitud(solicitud), // el monto sale de la BD, nunca del formulario
      datosPago: {
        proveedor: 'simulado',
        metodo: 'Tarjeta (simulado)',
        marca: tarjeta.marca,
        ultimos4: tarjeta.ultimos4
      }
    });

    if (!pagada) {
      return res.redirect(`/chat/${solicitud._id}?aviso=ya-pagada`);
    }

    res.redirect(`/chat/${pagada._id}?aviso=pagada`);

  } catch (error) {
    console.error('Error al procesar el pago:', error);
    res.status(500).send('No se pudo procesar el pago.');
  }
});

// ===========================================================
// STRIPE CHECKOUT (modo prueba)
// ===========================================================

// POST /pago/:id/stripe  -> crea la sesión y redirige a la página segura de Stripe
router.post('/:id/stripe', async (req, res) => {
  try {
    if (!stripe.activo()) {
      return res.redirect(`/pago/${req.params.id}`);
    }

    const solicitud = await buscarSolicitudDelCliente(req);
    if (!solicitud) {
      return res.status(404).send('Solicitud no encontrada.');
    }
    if (solicitud.estado !== 'Aceptada') {
      return res.redirect(`/chat/${solicitud._id}?aviso=no-pagable`);
    }

    const d = desgloseDeSolicitud(solicitud);
    if (d.total < 10) {
      return res.redirect(`/pago/${solicitud._id}?aviso=monto-minimo`); // mínimo de Stripe: $10 MXN
    }

    const base = `${req.protocol}://${req.get('host')}`;
    const sesion = await stripe.crearSesionCheckout({
      solicitudId: String(solicitud._id),
      clienteId: String(req.session.usuario.id),
      totalCentavos: centavos(d.total),
      nombre: `${solicitud.servicio} · PRAXO`,
      descripcion: `Prestador ${formatoMXN(d.precioPrestador)} + comisión ${formatoMXN(d.comision)} + IVA ${formatoMXN(d.ivaComision)}`,
      urlExito: `${base}/pago/${solicitud._id}/stripe/exito?session_id={CHECKOUT_SESSION_ID}`,
      urlCancelar: `${base}/pago/${solicitud._id}?aviso=cancelado`
    });

    return res.redirect(303, sesion.url);

  } catch (error) {
    console.error('Error creando sesión de Stripe:', error.message, error.stripe || '');
    const detalle = ES_PRODUCCION ? '' : `&detalle=${encodeURIComponent(error.message)}`;
    return res.redirect(`/pago/${req.params.id}?aviso=stripe-error${detalle}`);
  }
});

// GET /pago/:id/stripe/exito?session_id=...  -> Stripe regresa aquí tras pagar
router.get('/:id/stripe/exito', async (req, res) => {
  try {
    const solicitud = await buscarSolicitudDelCliente(req);
    if (!solicitud || !stripe.activo() || !req.query.session_id) {
      return res.status(404).send('Pago no encontrado.');
    }

    // Consultamos a Stripe directamente: no confiamos en la URL
    const sesion = await stripe.obtenerSesion(String(req.query.session_id));

    if (!sesion.metadata || sesion.metadata.solicitudId !== String(solicitud._id)) {
      return res.status(400).send('La sesión de pago no corresponde a este servicio.');
    }

    const resultado = await confirmarSesionStripe(sesion);

    if (resultado.estado === 'pagada') {
      return res.redirect(`/chat/${solicitud._id}?aviso=pagada`);
    }
    if (resultado.estado === 'ya-pagada') {
      return res.redirect(`/chat/${solicitud._id}?aviso=pagada`); // el webhook pudo llegar primero
    }
    return res.redirect(`/pago/${solicitud._id}?aviso=${resultado.estado}`);

  } catch (error) {
    console.error('Error confirmando pago de Stripe:', error.message, error.stripe || '');
    const detalle = ES_PRODUCCION ? '' : `&detalle=${encodeURIComponent(error.message)}`;
    return res.redirect(`/pago/${req.params.id}?aviso=stripe-error${detalle}`);
  }
});

module.exports = router;
