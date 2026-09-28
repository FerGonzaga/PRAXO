// controllers/verificacionController.js
// Logica para enviar un codigo por correo y para validarlo.
// Pieza independiente: el login y el registro solo tendran que llamar
// a estas dos acciones (enviar y validar).

const crypto = require('crypto');
const CodigoVerificacion = require('../models/CodigoVerificacion');
const { enviarCorreoVerificacion } = require('../services/emailService');

const MINUTOS_EXPIRACION = 10;
const SEGUNDOS_ENTRE_ENVIOS = 60;
const MAX_INTENTOS = 5;

function hashCodigo(codigo) {
  return crypto.createHash('sha256').update(codigo).digest('hex');
}

function correoValido(correo) {
  return typeof correo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// POST /verificacion/enviar   body: { correo, nombre }
exports.enviarCodigo = async (req, res) => {
  try {
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const nombre = String(req.body.nombre || '').trim() || 'usuario';

    if (!correoValido(correo)) {
      return res.status(400).json({ ok: false, mensaje: 'Correo no válido.' });
    }

    // Evita que alguien pida codigos sin parar (y gaste tus 200 correos al mes)
    const existente = await CodigoVerificacion.findOne({ correo });
    if (existente) {
      const segundos = (Date.now() - existente.creadoEn.getTime()) / 1000;
      if (segundos < SEGUNDOS_ENTRE_ENVIOS) {
        return res.status(429).json({
          ok: false,
          mensaje: `Espera ${Math.ceil(SEGUNDOS_ENTRE_ENVIOS - segundos)} segundos para pedir otro código.`,
        });
      }
    }

    // Codigo de 6 digitos generado de forma segura
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

    await CodigoVerificacion.findOneAndUpdate(
      { correo },
      {
        correo,
        codigoHash: hashCodigo(codigo),
        intentos: 0,
        creadoEn: new Date(),
        expiraEn: new Date(Date.now() + MINUTOS_EXPIRACION * 60 * 1000),
      },
      { upsert: true }
    );

    try {
      await enviarCorreoVerificacion({ correo, nombre, codigo });
    } catch (errorEnvio) {
      // Si el correo no salio, borramos el codigo para poder reintentar de inmediato
      await CodigoVerificacion.deleteOne({ correo });
      throw errorEnvio;
    }

    // IMPORTANTE: nunca se devuelve el codigo en la respuesta
    res.json({ ok: true, mensaje: 'Te enviamos un código a tu correo.' });
  } catch (error) {
    console.error('Error al enviar codigo:', error.message);
    res.status(500).json({ ok: false, mensaje: 'No se pudo enviar el código.' });
  }
};

// POST /verificacion/validar   body: { correo, codigo }
exports.validarCodigo = async (req, res) => {
  try {
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const codigo = String(req.body.codigo || '').trim();

    const registro = await CodigoVerificacion.findOne({ correo });

    if (!registro || registro.expiraEn < new Date()) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No hay un código activo para este correo o ya expiró. Pide uno nuevo.',
      });
    }

    if (registro.intentos >= MAX_INTENTOS) {
      await registro.deleteOne();
      return res.status(429).json({
        ok: false,
        mensaje: 'Demasiados intentos. Pide un código nuevo.',
      });
    }

    if (registro.codigoHash !== hashCodigo(codigo)) {
      registro.intentos += 1;
      await registro.save();
      return res.status(400).json({ ok: false, mensaje: 'Código incorrecto.' });
    }

    // Codigo correcto: se borra para que no pueda usarse dos veces
    await registro.deleteOne();
    res.json({ ok: true, mensaje: 'Correo verificado correctamente.' });
  } catch (error) {
    console.error('Error al validar codigo:', error.message);
    res.status(500).json({ ok: false, mensaje: 'No se pudo validar el código.' });
  }
};