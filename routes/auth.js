// routes/auth.js
// Rutas relacionadas con autenticación de usuarios.

const express = require('express');
const bcrypt = require('bcrypt');

const Usuario = require('../models/Usuarios_Praxo');

const router = express.Router();


// POST /api/auth/registro
router.post('/registro', async (req, res) => {

  try {

    const {
      nombre,
      correo,
      password
    } = req.body;


    // Validación básica del servidor
    if (!nombre || !correo || !password) {

      return res.status(400).json({
        mensaje: 'Todos los campos son obligatorios.'
      });

    }


    if (password.length < 8) {

      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres.'
      });

    }


    // Convertimos el correo a minúsculas
    const correoNormalizado = correo.trim().toLowerCase();


    // Verificar si ya existe
    const usuarioExistente = await Usuario.findOne({
      correo: correoNormalizado
    });


    if (usuarioExistente) {

      return res.status(409).json({
        mensaje: 'El correo ya está registrado.'
      });

    }


    // Generar hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);


    // Crear usuario
    const nuevoUsuario = new Usuario({

      nombre: nombre.trim(),

      correo: correoNormalizado,

      passwordHash,

      emailVerificado: false

    });


    await nuevoUsuario.save();


    return res.status(201).json({
      mensaje: 'Cuenta creada correctamente.'
    });


  } catch (error) {

    console.error('Error al registrar usuario:', error);

    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });

  }

});

// POST /api/auth/login
router.post('/login', async (req, res) => {

  try {

    const {
      correo,
      password
    } = req.body;


    // Validación básica
    if (!correo || !password) {

      return res.status(400).json({
        mensaje: 'El correo y la contraseña son obligatorios.'
      });

    }


    // Normalizar correo
    const correoNormalizado = correo.trim().toLowerCase();


    // Buscar usuario
    const usuario = await Usuario.findOne({
      correo: correoNormalizado
    });


    // Si no existe
    if (!usuario) {

      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.'
      });

    }


    // Comparar contraseña ingresada
    // contra el passwordHash almacenado en MongoDB
    const passwordCorrecta = await bcrypt.compare(
      password,
      usuario.passwordHash
    );


    if (!passwordCorrecta) {

      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.'
      });

    }


    // Verificar correo electrónico
    if (!usuario.emailVerificado) {

      return res.status(403).json({
        mensaje: 'Debes verificar tu correo electrónico antes de iniciar sesión.'
      });

    }


    // Login correcto
    return res.status(200).json({
      mensaje: 'Inicio de sesión correcto.',
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        correo: usuario.correo
      }
    });


  } catch (error) {

    console.error('Error al iniciar sesión:', error);

    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });

  }

});

module.exports = router;