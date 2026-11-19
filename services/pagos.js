// services/pagos.js
// Lógica común para registrar un pago (simulado o con Stripe).

const crypto = require('crypto');
const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const { desgloseDeSolicitud, formatoMXN } = require('../config/tarifas');
const { cifrar } = require('./cifrado');

const MARCAS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', jcb: 'JCB', diners: 'Diners', unionpay: 'UnionPay' };

function generarReferencia() {
  return 'PRX-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function centavos(monto) {
  return Math.round(Number(monto) * 100);
}

// Pasa la solicitud de Aceptada a Pagada de forma ATÓMICA (nunca dos veces).
async function registrarPago({ solicitud, desglose, datosPago }) {
  const referencia = generarReferencia();

  const pagada = await Solicitud.findOneAndUpdate(
    { _id: solicitud._id, estado: 'Aceptada' },
    {
      $set: {
        estado: 'Pagada',
        desglose,
        pago: {
          referencia,
          moneda: 'MXN',
          fecha: new Date(),
          monto: desglose.total,
          precioPrestador: desglose.precioPrestador,
          comisionPorcentaje: desglose.comisionPorcentaje,
          comision: desglose.comision,
          ivaPorcentaje: desglose.ivaPorcentaje,
          ivaComision: desglose.ivaComision,
          ...datosPago
        }
      }
    },
    { new: true }
  );

  if (pagada) {
    await Mensaje.create({
      solicitudId: pagada._id,
      emisorId: pagada.clienteId,
      texto: `💳 Pago realizado por ${formatoMXN(pagada.pago.monto)} MXN (${pagada.pago.marca} •••• ${pagada.pago.ultimos4}). Referencia: ${referencia}`
    });
  }
  return pagada;
}

// Confirma una sesión de Stripe Checkout (desde la página de éxito o el webhook).
// Valida TODO con los datos de Stripe, nunca con lo que mande el navegador.
async function confirmarSesionStripe(sesion) {
  const solicitudId = sesion && sesion.metadata ? sesion.metadata.solicitudId : null;
  if (!solicitudId) return { estado: 'invalida' };

  const solicitud = await Solicitud.findById(solicitudId);
  if (!solicitud) return { estado: 'invalida' };

  if (solicitud.estado === 'Pagada' || solicitud.estado === 'Completada') {
    return { estado: 'ya-pagada', solicitud };
  }
  if (solicitud.estado !== 'Aceptada') return { estado: 'invalida', solicitud };
  if (sesion.payment_status !== 'paid') return { estado: 'no-pagada', solicitud };

  const desglose = desgloseDeSolicitud(solicitud);
  if (sesion.currency !== 'mxn' || sesion.amount_total !== centavos(desglose.total)) {
    console.error('Monto de Stripe no coincide con la solicitud', solicitudId, sesion.amount_total);
    return { estado: 'monto-invalido', solicitud };
  }

  const pi = sesion.payment_intent && typeof sesion.payment_intent === 'object' ? sesion.payment_intent : null;
  const tarjeta = pi && pi.latest_charge && pi.latest_charge.payment_method_details
    ? pi.latest_charge.payment_method_details.card
    : null;

  const pagada = await registrarPago({
    solicitud,
    desglose,
    datosPago: {
      proveedor: 'stripe',
      metodo: 'Stripe (modo prueba)',
      marca: tarjeta ? (MARCAS[tarjeta.brand] || tarjeta.brand) : 'Tarjeta',
      ultimos4: tarjeta ? tarjeta.last4 : '----',
      // Identificadores de la transacción, cifrados en reposo (AES-256-GCM)
      idExterno: cifrar(pi ? pi.id : sesion.payment_intent),
      sesionExterna: cifrar(sesion.id)
    }
  });

  return pagada ? { estado: 'pagada', solicitud: pagada } : { estado: 'ya-pagada', solicitud };
}

// -----------------------------------------------------------
// PAGO SIMULADO: validación de tarjeta (sin guardar el número)
// 4242 4242 4242 4242 aprobada · 4000 0000 0000 0002 rechazada
// -----------------------------------------------------------
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

module.exports = { registrarPago, confirmarSesionStripe, centavos, generarReferencia, TARJETA_RECHAZADA, validarTarjeta };
