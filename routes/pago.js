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
const { generarTicketPdf } = require('../services/ticketPdf');

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

    const u = req.session.usuario;
    const esCliente = u.tipoUsuario === 'cliente' &&
      solicitud.clienteId && String(solicitud.clienteId._id) === String(u.id);
    const esPrestador = u.tipoUsuario === 'prestador' &&
      solicitud.trabajadorId && String(solicitud.trabajadorId.usuarioId) === String(u.id);

    if (!esCliente && !esPrestador) {
      return res.status(403).send('No tienes permiso para ver este comprobante.');
    }

    const p = solicitud.pago;
    // Pagos hechos antes de existir la comisión: se muestran tal cual se cobraron
    const desglose = typeof p.precioPrestador === 'number'
      ? {
          precioPrestador: p.precioPrestador, comisionPorcentaje: p.comisionPorcentaje,
          comision: p.comision, ivaPorcentaje: p.ivaPorcentaje, ivaComision: p.ivaComision, total: p.monto
        }
      : { precioPrestador: p.monto, comisionPorcentaje: 0, comision: 0, ivaPorcentaje: 16, ivaComision: 0, total: p.monto };

    const fechaMx = (f) => new Date(f).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const pdf = generarTicketPdf({
      referencia: p.referencia,
      fechaPago: fechaMx(p.fecha),
      estado: solicitud.estado === 'Completada' ? 'PAGADO / COMPLETADO' : 'PAGADO',
      cliente: solicitud.clienteId ? solicitud.clienteId.nombre : 'Cliente PRAXO',
      prestador: solicitud.trabajadorId ? solicitud.trabajadorId.nombre : 'Profesional PRAXO',
      oficio: solicitud.trabajadorId ? solicitud.trabajadorId.oficio : '',
      servicio: solicitud.servicio,
      fechaServicio: [solicitud.fecha, solicitud.hora].filter(Boolean).join(' '),
      ubicacion: solicitud.ubicacion,
      desglose,
      metodo: `${p.marca || 'Tarjeta'} **** ${p.ultimos4 || '----'} (simulado)`
    });

    const nombre = `Comprobante-${p.referencia}.pdf`;
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

const TARJETA_RECHAZADA = '4000000000000002';

// -----------------------------------------------------------
// VALIDACIONES DE TARJETA
// -----------------------------------------------------------
function soloDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

// Algoritmo de Luhn (el que usan los bancos para validar el número)
function luhnValido(numero) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

function detectarMarca(numero) {
  if (/^4/.test(numero)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(numero)) return 'Mastercard';
  if (/^3[47]/.test(numero)) return 'American Express';
  return 'Tarjeta';
}

function validarTarjeta({ numero, titular, vencimiento, cvv }) {
  const num = soloDigitos(numero);
  const codigo = soloDigitos(cvv);
  const nombre = String(titular || '').trim();

  if (num.length < 13 || num.length > 19 || !luhnValido(num)) {
    return { error: 'El número de tarjeta no es válido.' };
  }
  if (nombre.length < 3) {
    return { error: 'Escribe el nombre como aparece en la tarjeta.' };
  }

  const m = String(vencimiento || '').match(/^\s*(\d{2})\s*\/\s*(\d{2})\s*$/);
  if (!m) {
    return { error: 'La fecha de vencimiento debe tener el formato MM/AA.' };
  }
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) {
    return { error: 'El mes de vencimiento no es válido.' };
  }
  // La tarjeta vale hasta el último día del mes de vencimiento
  if (new Date(anio, mes, 1) <= new Date()) {
    return { error: 'La tarjeta está vencida.' };
  }

  const marca = detectarMarca(num);
  const largoCvv = marca === 'American Express' ? 4 : 3;
  if (codigo.length !== largoCvv) {
    return { error: `El CVV debe tener ${largoCvv} dígitos.` };
  }

  return { ok: true, numero: num, marca, ultimos4: num.slice(-4) };
}

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
      datos: {}
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

    const { numero, titular, vencimiento } = req.body;
    // Para volver a llenar el formulario si hay error (NUNCA regresamos el CVV)
    const datos = { titular, vencimiento, numero };

    const tarjeta = validarTarjeta(req.body);
    if (!tarjeta.ok) {
      return res.status(400).render('pago', {
        titulo: 'Pago seguro', solicitud, error: tarjeta.error, datos
      });
    }

    // Simulamos el "banco" rechazando la tarjeta de prueba
    if (tarjeta.numero === TARJETA_RECHAZADA) {
      return res.status(402).render('pago', {
        titulo: 'Pago seguro',
        solicitud,
        error: 'Pago rechazado por el banco: fondos insuficientes. Intenta con otra tarjeta.',
        datos
      });
    }

    const desglose = desgloseDeSolicitud(solicitud);

    const referencia =
      'PRX-' + Date.now().toString(36).toUpperCase() + '-' +
      crypto.randomBytes(3).toString('hex').toUpperCase();

    // Actualización atómica: solo pasa a Pagada si sigue Aceptada
    // (evita cobrar dos veces por doble clic). El monto sale de la BD,
    // nunca del formulario.
    const pagada = await Solicitud.findOneAndUpdate(
      { _id: solicitud._id, clienteId: req.session.usuario.id, estado: 'Aceptada' },
      {
        $set: {
          estado: 'Pagada',
          desglose,
          pago: {
            referencia,
            metodo: 'Tarjeta (simulado)',
            marca: tarjeta.marca,
            ultimos4: tarjeta.ultimos4,
            monto: desglose.total, // total = prestador + comisión + IVA
            precioPrestador: desglose.precioPrestador,
            comisionPorcentaje: desglose.comisionPorcentaje,
            comision: desglose.comision,
            ivaPorcentaje: desglose.ivaPorcentaje,
            ivaComision: desglose.ivaComision,
            moneda: 'MXN',
            fecha: new Date()
          }
        }
      },
      { new: true }
    );

    if (!pagada) {
      return res.redirect(`/chat/${solicitud._id}?aviso=ya-pagada`);
    }

    await Mensaje.create({
      solicitudId: pagada._id,
      emisorId: req.session.usuario.id,
      texto: `💳 Pago realizado por ${formatoMXN(pagada.pago.monto)} MXN (${tarjeta.marca} •••• ${tarjeta.ultimos4}). Referencia: ${referencia}`
    });

    res.redirect(`/chat/${pagada._id}?aviso=pagada`);

  } catch (error) {
    console.error('Error al procesar el pago:', error);
    res.status(500).send('No se pudo procesar el pago.');
  }
});

module.exports = router;
