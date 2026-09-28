// services/emailService.js
// Envia el correo de verificacion DESDE EL SERVIDOR usando la API REST de EmailJS.
// Asi el codigo nunca pasa por el navegador antes de llegar al correo del usuario.
// Usa fetch, que ya viene incluido en Node (no requiere instalar nada).

async function enviarCorreoVerificacion({ correo, nombre, codigo }) {
  const {
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_VERIFICACION_ID,
    EMAILJS_PUBLIC_KEY,
    EMAILJS_PRIVATE_KEY,
  } = process.env;

  if (
    !EMAILJS_SERVICE_ID ||
    !EMAILJS_TEMPLATE_VERIFICACION_ID ||
    !EMAILJS_PUBLIC_KEY ||
    !EMAILJS_PRIVATE_KEY
  ) {
    throw new Error('Faltan variables de EmailJS en el archivo .env');
  }

  const respuesta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_VERIFICACION_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      // Estos nombres deben coincidir con las variables de la plantilla:
      // {{nombre}}, {{correo}} y {{codigo}}
      template_params: { nombre, correo, codigo },
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`EmailJS respondio ${respuesta.status}: ${detalle}`);
  }
}

module.exports = { enviarCorreoVerificacion };