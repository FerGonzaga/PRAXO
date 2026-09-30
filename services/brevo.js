// services/brevo.js
// Servicio para enviar correos de verificación mediante Brevo.

async function enviarCorreoVerificacion({
  nombre,
  correo,
  token
}) {

  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const appUrl = process.env.APP_URL;

  if (!apiKey || !senderName || !senderEmail || !appUrl) {
    throw new Error(
      'Faltan variables de configuración de Brevo en el archivo .env'
    );
  }

  const urlVerificacion =
    `${appUrl}/api/auth/verificar-email?token=${encodeURIComponent(token)}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Verifica tu cuenta - PRAXO</title>
    </head>

    <body style="font-family: Arial, sans-serif; line-height: 1.6;">

      <div style="max-width: 600px; margin: 0 auto; padding: 30px;">

        <h1>PRAXO</h1>

        <h2>Verifica tu correo electrónico</h2>

        <p>
          Hola, ${nombre}.
        </p>

        <p>
          Gracias por registrarte en PRAXO.
          Para activar tu cuenta, confirma tu dirección de correo
          electrónico utilizando el siguiente botón:
        </p>

        <p style="margin: 30px 0;">

          <a
            href="${urlVerificacion}"
            style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #212529;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Verificar mi correo
          </a>

        </p>

        <p>
          Si no realizaste este registro, puedes ignorar este correo.
        </p>

        <p>
          Este enlace tiene una vigencia limitada.
        </p>

        <hr>

        <p>
          PRAXO
        </p>

      </div>

    </body>
    </html>
  `;

  const respuesta = await fetch(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',

      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },

      body: JSON.stringify({

        sender: {
          name: senderName,
          email: senderEmail
        },

        to: [
          {
            email: correo,
            name: nombre
          }
        ],

        subject: 'Verifica tu cuenta de PRAXO',

        htmlContent

      })
    }
  );


  if (!respuesta.ok) {

    const errorBrevo = await respuesta.text();

    throw new Error(
      `Brevo rechazó el correo: ${errorBrevo}`
    );
  }


  return await respuesta.json();
}


module.exports = {
  enviarCorreoVerificacion
};