// routes/auth.js
// Rutas relacionadas con autenticación de usuarios.

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const Usuario = require('../models/Usuarios_Praxo');
const Trabajador = require('../models/Trabajador');
const TokenVerificacion = require('../models/TokenVerificacion');

const { enviarCorreoVerificacion } = require('../services/brevo');
const { VERSION_AVISO } = require('../config/privacidad');
const { limitadores } = require('../middlewares/seguridad');
const router = express.Router();
const HORAS_EXPIRACION_TOKEN = 24;

// ======================================================
// REGISTRO
// POST /api/auth/registro
// ======================================================

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
      descripcion,
      // 🟢 NUEVOS CAMPOS A ATRAPAR
      aceptaTerminos,
      aceptaPrivacidad,   // consentimiento expreso (obligatorio)
      aceptaPromociones,  // finalidades secundarias (opcional)
      conceptoPrecio,
      tarifaPrecio
    } = req.body;

    // --------------------------------------------------
    // 🟢 VALIDACIÓN DE TÉRMINOS Y CONDICIONES (NIVEL BACKEND)
    // --------------------------------------------------
    if (aceptaTerminos !== true) {
      return res.status(400).json({
        mensaje: 'Debes aceptar los Términos y Condiciones para registrarte.'
      });
    }

    // 🔒 CONSENTIMIENTO EXPRESO DEL AVISO DE PRIVACIDAD (LFPDPPP)
    if (aceptaPrivacidad !== true) {
      return res.status(400).json({
        mensaje: 'Debes leer y aceptar el Aviso de Privacidad para registrarte.'
      });
    }

    // --------------------------------------------------
    // VALIDACIONES GENERALES
    // --------------------------------------------------
    if (!nombre || !correo || !password || !tipoUsuario ||
        typeof nombre !== 'string' || typeof correo !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ mensaje: 'Completa todos los campos obligatorios.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) || nombre.trim().length > 80) {
      return res.status(400).json({ mensaje: 'Revisa tu nombre y correo.' });
    }

    // bcrypt solo usa los primeros 72 bytes de la contraseña
    if (Buffer.byteLength(password) > 72) {
      return res.status(400).json({ mensaje: 'La contraseña es demasiado larga (máximo 72 caracteres).' });
    }

    if (!['cliente', 'prestador'].includes(tipoUsuario)) {
      return res.status(400).json({ mensaje: 'Tipo de usuario no válido.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    // Datos adicionales para prestadores
    if (tipoUsuario === 'prestador') {
      if (!oficio || !telefono || !ciudad) {
        return res.status(400).json({ mensaje: 'Completa la información de tu servicio.' });
      }
    }

    // --------------------------------------------------
    // NORMALIZAR CORREO
    // --------------------------------------------------
    const correoNormalizado = correo.trim().toLowerCase();

    // --------------------------------------------------
    // VERIFICAR SI YA EXISTE
    // --------------------------------------------------
    const usuarioExistente = await Usuario.findOne({ correo: correoNormalizado });
    if (usuarioExistente) {
      return res.status(409).json({ mensaje: 'El correo ya está registrado.' });
    }

    // --------------------------------------------------
    // CIFRAR CONTRASEÑA
    // --------------------------------------------------
    const passwordHash = await bcrypt.hash(password, 10);

    // --------------------------------------------------
    // CREAR USUARIO
    // --------------------------------------------------
    const nuevoUsuario = new Usuario({
      nombre: nombre.trim(),
      correo: correoNormalizado,
      passwordHash,
      tipoUsuario,
      emailVerificado: false,
      consentimiento: {
        terminos: { aceptado: true, fecha: new Date() },
        privacidad: { aceptado: true, fecha: new Date(), version: VERSION_AVISO },
        promociones: {
          aceptado: aceptaPromociones === true,
          fecha: aceptaPromociones === true ? new Date() : null
        }
      }
    });

    await nuevoUsuario.save();

    // --------------------------------------------------
    // CREAR PERFIL DE PRESTADOR
    // --------------------------------------------------
    if (tipoUsuario === 'prestador') {
      try {
        const nuevoTrabajador = new Trabajador({
          usuarioId: nuevoUsuario._id,
          nombre: nombre.trim(),
          oficio: oficio.trim(),
          telefono: telefono.trim(),
          ciudad: ciudad.trim(),
          descripcion: descripcion ? descripcion.trim() : undefined,
          // 🟢 GUARDAMOS LOS NUEVOS DATOS DEL PRECIO
          conceptoPrecio: conceptoPrecio ? conceptoPrecio.trim() : '',
          tarifaPrecio: tarifaPrecio ? Number(tarifaPrecio) : 0
        });

        await nuevoTrabajador.save();

      } catch (errorTrabajador) {
        // Si falla la creación del trabajador, eliminamos también el usuario
        await Usuario.findByIdAndDelete(nuevoUsuario._id);
        throw errorTrabajador;
      }
    }

    // --------------------------------------------------
    // CREAR TOKEN DE VERIFICACION
    // --------------------------------------------------
    const token = crypto.randomBytes(32).toString('hex');

    await TokenVerificacion.create({
      usuarioId: nuevoUsuario._id,
      token,
      expiraEn: new Date(Date.now() + HORAS_EXPIRACION_TOKEN * 60 * 60 * 1000)
    });

    // --------------------------------------------------
    // ENVIAR CORREO
    // --------------------------------------------------
    try {
      await enviarCorreoVerificacion({
        nombre: nuevoUsuario.nombre,
        correo: nuevoUsuario.correo,
        token
      });
    } catch (errorCorreo) {
      console.error('Error al enviar correo de verificación:', errorCorreo.message);
    }

    // --------------------------------------------------
    // RESPUESTA
    // --------------------------------------------------
    return res.status(201).json({
      mensaje: 'Cuenta creada. Revisa tu correo y da clic en el enlace para verificarla.',
      tipoUsuario
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// ======================================================
// VERIFICAR CORREO
// GET /api/auth/verificar-email?token=...
// ======================================================
router.get('/verificar-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('Falta el token de verificación.');
    }

    const registro = await TokenVerificacion.findOne({ token });

    if (!registro || registro.expiraEn < new Date()) {
      return res.status(400).send('El enlace no es válido o ya expiró. Pide uno nuevo iniciando sesión.');
    }

    // Marcar cuenta como verificada
    await Usuario.findByIdAndUpdate(registro.usuarioId, { emailVerificado: true });

    // Eliminar token ya utilizado
    await registro.deleteOne();

    // Volver al login
    return res.redirect('/login?verificado=1');

  } catch (error) {
    console.error('Error al verificar correo:', error);
    return res.status(500).send('Ocurrió un error al verificar tu correo.');
  }
});

// ======================================================
// LOGIN
// POST /api/auth/login
// ======================================================
router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;

    // 🔒 Solo texto: evita objetos como { "$ne": null }
    if (typeof correo !== 'string' || typeof password !== 'string' || !correo || !password) {
      return res.status(400).json({ mensaje: 'Completa correo y contraseña.' });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const usuario = await Usuario.findOne({ correo: correoNormalizado });

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

    // Inicio correcto: se limpia el contador de intentos de esta cuenta
    limitadores.loginPorCuenta.reiniciar(req);

    // --------------------------------------------------
    // CREAR SESION
    // 🔒 Se regenera el ID de sesión al iniciar sesión (evita "session fixation")
    // --------------------------------------------------
    const redireccionGuardada = req.session.redirectDespuesLogin;

    req.session.regenerate((errorRegenerar) => {
      if (errorRegenerar) {
        console.error('Error al regenerar la sesión:', errorRegenerar);
        return res.status(500).json({ mensaje: 'No se pudo iniciar la sesión.' });
      }

      req.session.usuario = {
        id: usuario._id.toString(),
        nombre: usuario.nombre,
        correo: usuario.correo,
        tipoUsuario: usuario.tipoUsuario
      };

      // Solo rutas internas (evita redirecciones a otros sitios)
      const redireccion = (typeof redireccionGuardada === 'string' && /^\/(?!\/)/.test(redireccionGuardada))
        ? redireccionGuardada
        : (usuario.tipoUsuario === 'prestador' ? '/inicio-prestador' : '/inicio-cliente');

      req.session.save(() => {
        return res.json({
          mensaje: `Bienvenido, ${usuario.nombre}.`,
          tipoUsuario: usuario.tipoUsuario,
          usuario: {
            id: usuario._id.toString(),
            nombre: usuario.nombre
          },
          redireccion
        });
      });
    });

  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// ======================================================
// SABER SI HAY SESION ACTIVA
// GET /api/auth/sesion
// ======================================================
router.get('/sesion', (req, res) => {
  if (!req.session.usuario) {
    return res.json({ autenticado: false });
  }
  return res.json({
    autenticado: true,
    usuario: req.session.usuario
  });
});

// ======================================================
// LOGOUT
// POST /api/auth/logout
// ======================================================
router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Error al cerrar sesión:', error);
      return res.status(500).json({ mensaje: 'No se pudo cerrar la sesión.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ mensaje: 'Sesión cerrada correctamente.' });
  });
});

module.exports = router;