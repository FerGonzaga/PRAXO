// routes/auth.js
// Rutas relacionadas con autenticación de usuarios.

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const Usuario = require('../models/Usuarios_Praxo');
const Trabajador = require('../models/Trabajador');
const TokenVerificacion = require('../models/TokenVerificacion');
const { enviarCorreoVerificacion } = require('../services/brevo');

const router = express.Router();

const HORAS_EXPIRACION_TOKEN = 24;


// POST /api/auth/registro
router.post('/registro', async (req, res) => {

  try {

    const {
      nombre,
      correo,
      password,
      tipoUsuario,
      oficio,
      telefono,
      ciudad,
      descripcion
    } = req.body;


    // -----------------------------------------
    // VALIDACIONES GENERALES
    // -----------------------------------------

    if (!nombre || !correo || !password || !tipoUsuario) {

      return res.status(400).json({
        mensaje: 'Completa todos los campos obligatorios.'
      });

    }


    if (!['cliente', 'prestador'].includes(tipoUsuario)) {

      return res.status(400).json({
        mensaje: 'Tipo de usuario no válido.'
      });

    }


    if (password.length < 8) {

      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres.'
      });

    }


    if (tipoUsuario === 'prestador') {

      if (!oficio || !telefono || !ciudad) {

        return res.status(400).json({
          mensaje: 'Completa la información de tu servicio.'
        });

      }

    }


    const correoNormalizado = correo.trim().toLowerCase();


    const usuarioExistente = await Usuario.findOne({
      correo: correoNormalizado
    });

    if (usuarioExistente) {

      return res.status(409).json({
        mensaje: 'El correo ya está registrado.'
      });

    }


    const passwordHash = await bcrypt.hash(password, 10);


    // -----------------------------------------
    // CREAR USUARIO (todavia sin verificar)
    // -----------------------------------------

    const nuevoUsuario = new Usuario({
      nombre: nombre.trim(),
      correo: correoNormalizado,
      passwordHash,
      tipoUsuario,
      emailVerificado: false
    });

    await nuevoUsuario.save();


    if (tipoUsuario === 'prestador') {

      try {

        const nuevoTrabajador = new Trabajador({
          usuarioId: nuevoUsuario._id,
          nombre: nombre.trim(),
          oficio: oficio.trim(),
          telefono: telefono.trim(),
          ciudad: ciudad.trim(),
          descripcion: descripcion ? descripcion.trim() : undefined
        });

        await nuevoTrabajador.save();

      } catch (errorTrabajador) {

        await Usuario.findByIdAndDelete(nuevoUsuario._id);
        throw errorTrabajador;
      }

    }


    // -----------------------------------------
    // GENERAR TOKEN Y ENVIAR CORREO CON BREVO
    // -----------------------------------------

    const token = crypto.randomBytes(32).toString('hex');

    await TokenVerificacion.create({
      usuarioId: nuevoUsuario._id,
      token,
      expiraEn: new Date(Date.now() + HORAS_EXPIRACION_TOKEN * 60 * 60 * 1000)
    });

    try {

      await enviarCorreoVerificacion({
        nombre: nuevoUsuario.nombre,
        correo: nuevoUsuario.correo,
        token
      });

    } catch (errorCorreo) {

      // La cuenta ya quedo creada; si el correo falla, lo registramos
      // pero no tumbamos el registro (el usuario puede reenviarlo despues).
      console.error('Error al enviar correo de verificacion:', errorCorreo.message);

    }


    return res.status(201).json({

      mensaje:
        'Cuenta creada. Revisa tu correo y da clic en el enlace para verificarla.',

      tipoUsuario

    });


  } catch (error) {

    console.error('Error al registrar usuario:', error);

    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });

  }

});


// GET /api/auth/verificar-email?token=...
// A esto apunta el enlace del correo de Brevo.
router.get('/verificar-email', async (req, res) => {

  try {

    const { token } = req.query;

    if (!token) {
      return res.status(400).send('Falta el token de verificación.');
    }

    const registro = await TokenVerificacion.findOne({ token });

    if (!registro || registro.expiraEn < new Date()) {
      return res.status(400).send(
        'El enlace no es válido o ya expiró. Pide uno nuevo iniciando sesión.'
      );
    }

    await Usuario.findByIdAndUpdate(registro.usuarioId, {
      emailVerificado: true
    });

    await registro.deleteOne();

    // Redirige al login con un aviso de exito
    return res.redirect('/login?verificado=1');

  } catch (error) {

    console.error('Error al verificar correo:', error);
    return res.status(500).send('Ocurrió un error al verificar tu correo.');

  }

});


// POST /api/auth/login
router.post('/login', async (req, res) => {

  try {

    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({
        mensaje: 'Completa correo y contraseña.'
      });
    }

    const correoNormalizado = correo.trim().toLowerCase();

    const usuario = await Usuario.findOne({ correo: correoNormalizado });

    // Mensaje generico a proposito: no decimos si fallo el correo o la
    // contraseña, para no ayudar a alguien a adivinar cuentas existentes.
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }

    const passwordCorrecta = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordCorrecta) {
      return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos.' });
    }

    if (!usuario.emailVerificado) {
      return res.status(403).json({
        mensaje: 'Verifica tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.'
      });
    }

    // Guarda en la sesion solo lo necesario, nunca el passwordHash
    req.session.usuario = {
      id: usuario._id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      tipoUsuario: usuario.tipoUsuario
    };

    return res.json({
      mensaje: `Bienvenido, ${usuario.nombre}.`,
      tipoUsuario: usuario.tipoUsuario
    });

  } catch (error) {

    console.error('Error al iniciar sesión:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });

  }

});


// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ mensaje: 'Sesión cerrada.' });
  });
});


module.exports = router;