// routes/stripeWebhook.js
// POST /pago/stripe/webhook
// Stripe avisa aquí cuando un pago se completa, aunque el cliente cierre
// la pestaña antes de regresar a PRAXO. Se monta en app.js con express.raw()
// porque la firma se verifica sobre el cuerpo SIN procesar.

const stripe = require('../services/stripe');
const { confirmarSesionStripe } = require('../services/pagos');

module.exports = async function webhookStripe(req, res) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe.activo() || !secreto) {
    return res.status(404).send('Webhook no configurado.');
  }

  if (!stripe.verificarFirmaWebhook(req.body, req.get('stripe-signature'), secreto)) {
    return res.status(400).send('Firma inválida.');
  }

  let evento;
  try {
    evento = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    return res.status(400).send('JSON inválido.');
  }

  try {
    // completed: pago con tarjeta inmediato
    // async_payment_succeeded: métodos diferidos (p. ej. OXXO) que se pagan después
    if (evento.type === 'checkout.session.completed' ||
        evento.type === 'checkout.session.async_payment_succeeded') {
      // Volvemos a pedir la sesión a Stripe para obtener los datos del cargo
      const sesion = await stripe.obtenerSesion(evento.data.object.id);
      const resultado = await confirmarSesionStripe(sesion);
      console.log('Webhook Stripe:', evento.type, resultado.estado);
    }
    res.json({ recibido: true });
  } catch (error) {
    console.error('Error procesando webhook de Stripe:', error.message);
    res.status(500).send('Error interno.');
  }
};
