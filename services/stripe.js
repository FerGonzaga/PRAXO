// services/stripe.js
// Integración con Stripe Checkout usando la API REST directamente (sin paquetes extra).
//
// PCI-DSS: el cliente escribe su tarjeta en la página de Stripe (certificada
// PCI DSS Nivel 1). El número de tarjeta NUNCA llega al servidor de PRAXO,
// lo que reduce nuestro alcance PCI al nivel más bajo (SAQ A).
//
// Variables de entorno:
//   STRIPE_SECRET_KEY      sk_test_...  (obligatoria para activar Stripe)
//   STRIPE_WEBHOOK_SECRET  whsec_...    (opcional, confirma pagos vía webhook)

const crypto = require('crypto');

const API = 'https://api.stripe.com/v1';

function clave() {
  return (process.env.STRIPE_SECRET_KEY || '').trim();
}

// Solo se activa con llaves de PRUEBA: en un proyecto académico nunca
// queremos cobrar dinero real por accidente.
function activo() {
  return clave().startsWith('sk_test_');
}

if (clave().startsWith('sk_live_')) {
  console.warn('⚠️  STRIPE_SECRET_KEY es una llave LIVE. PRAXO solo acepta llaves de prueba (sk_test_): Stripe queda desactivado.');
}

// Convierte {a: {b: 1}, c: [{d: 2}]} en a[b]=1&c[0][d]=2 (formato de Stripe)
function aplanar(obj, prefijo = '', salida = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const llave = prefijo ? `${prefijo}[${k}]` : k;
    if (typeof v === 'object') aplanar(v, llave, salida);
    else salida.push([llave, String(v)]);
  }
  return salida;
}

async function llamar(metodo, ruta, params) {
  const opciones = {
    method: metodo,
    headers: { Authorization: `Bearer ${clave()}` }
  };
  let url = API + ruta;
  if (params && metodo === 'POST') {
    opciones.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opciones.body = new URLSearchParams(aplanar(params)).toString();
  } else if (params) {
    url += '?' + new URLSearchParams(aplanar(params)).toString();
  }

  const respuesta = await fetch(url, opciones);
  const datos = await respuesta.json();
  if (!respuesta.ok) {
    const err = new Error(datos.error && datos.error.message ? datos.error.message : 'Error de Stripe');
    err.stripe = datos.error;
    throw err;
  }
  return datos;
}

// Crea la sesión de pago alojada por Stripe
function crearSesionCheckout({ solicitudId, clienteId, totalCentavos, nombre, descripcion, urlExito, urlCancelar }) {
  return llamar('POST', '/checkout/sessions', {
    mode: 'payment',
    locale: 'es-419',
    client_reference_id: solicitudId,
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'mxn',
        unit_amount: totalCentavos,
        product_data: { name: nombre, description: descripcion }
      }
    }],
    metadata: { solicitudId, clienteId },
    payment_intent_data: { metadata: { solicitudId }, description: nombre },
    success_url: urlExito,
    cancel_url: urlCancelar
  });
}

// Recupera la sesión con el cargo (para saber marca y últimos 4 dígitos)
function obtenerSesion(id) {
  return llamar('GET', `/checkout/sessions/${encodeURIComponent(id)}`, {
    expand: ['payment_intent.latest_charge']
  });
}

// Verifica la firma del webhook (encabezado Stripe-Signature)
function verificarFirmaWebhook(cuerpoCrudo, encabezado, secreto, toleranciaSeg = 300) {
  if (!encabezado || !secreto) return false;
  const partes = {};
  const firmas = [];
  encabezado.split(',').forEach((p) => {
    const [k, v] = p.split('=');
    if (k === 'v1') firmas.push(v);
    else partes[k] = v;
  });
  const t = Number(partes.t);
  if (!t || firmas.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranciaSeg) return false;

  const esperada = crypto
    .createHmac('sha256', secreto)
    .update(`${t}.${cuerpoCrudo.toString('utf8')}`)
    .digest('hex');

  return firmas.some((f) =>
    f.length === esperada.length &&
    crypto.timingSafeEqual(Buffer.from(f, 'hex'), Buffer.from(esperada, 'hex'))
  );
}

module.exports = { activo, crearSesionCheckout, obtenerSesion, verificarFirmaWebhook };
