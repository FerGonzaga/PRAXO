// config/privacidad.js
// Datos generales del Aviso de Privacidad de PRAXO.
// Si cambias el contenido del aviso, sube la VERSION: así queda registro
// de qué versión aceptó cada usuario.

module.exports = {
  VERSION_AVISO: '2026-10-28',
  FECHA_ACTUALIZACION: '28 de octubre de 2026',
  CORREO_PRIVACIDAD:
    process.env.CORREO_PRIVACIDAD ||
    process.env.BREVO_SENDER_EMAIL ||
    'el correo publicado en la sección de Contacto',
  DOMICILIO:
    'Paseo del Agrarismo No. 2000, Carr. Mixquiahuala-Tula km 2.5, ' +
    'Mixquiahuala de Juárez, Hidalgo, C.P. 42700'
};
