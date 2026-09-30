// routes/auth.js
// Rutas relacionadas con autenticación de usuarios.

const express = require('express');
const bcrypt = require('bcrypt');

const Usuario = require('../models/Usuarios_Praxo');
const Trabajador = require('../models/Trabajador');

const router = express.Router();


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


    // Validar tipo de usuario
    if (!['cliente', 'prestador'].includes(tipoUsuario)) {

      return res.status(400).json({
        mensaje: 'Tipo de usuario no válido.'
      });

    }


    // Validar contraseña
    if (password.length < 8) {

      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres.'
      });

    }


    // -----------------------------------------
    // VALIDACIONES PARA PRESTADOR
    // -----------------------------------------

    if (tipoUsuario === 'prestador') {

      if (!oficio || !telefono || !ciudad) {

        return res.status(400).json({
          mensaje: 'Completa la información de tu servicio.'
        });

      }

    }


    // -----------------------------------------
    // NORMALIZAR CORREO
    // -----------------------------------------

    const correoNormalizado = correo
      .trim()
      .toLowerCase();


    // -----------------------------------------
    // COMPROBAR CORREO EXISTENTE
    // -----------------------------------------

    const usuarioExistente = await Usuario.findOne({
      correo: correoNormalizado
    });


    if (usuarioExistente) {

      return res.status(409).json({
        mensaje: 'El correo ya está registrado.'
      });

    }


    // -----------------------------------------
    // GENERAR HASH DE CONTRASEÑA
    // -----------------------------------------

    const passwordHash = await bcrypt.hash(
      password,
      10
    );


    // -----------------------------------------
    // CREAR USUARIO
    // -----------------------------------------

    const nuevoUsuario = new Usuario({

      nombre: nombre.trim(),

      correo: correoNormalizado,

      passwordHash,

      tipoUsuario,

      emailVerificado: false

    });


    await nuevoUsuario.save();


    // -----------------------------------------
    // SI ES PRESTADOR, CREAR PERFIL
    // -----------------------------------------

    if (tipoUsuario === 'prestador') {

      try {

        const nuevoTrabajador = new Trabajador({

          usuarioId: nuevoUsuario._id,

          nombre: nombre.trim(),

          oficio: oficio.trim(),

          telefono: telefono.trim(),

          ciudad: ciudad.trim(),

          descripcion: descripcion
            ? descripcion.trim()
            : undefined

        });

        await nuevoTrabajador.save();

      } catch (errorTrabajador) {

        // Si falla la creación del trabajador,
        // eliminamos el usuario para no dejar
        // una cuenta incompleta.

        await Usuario.findByIdAndDelete(
          nuevoUsuario._id
        );

        throw errorTrabajador;
      }

    }


    // -----------------------------------------
    // RESPUESTA EXITOSA
    // -----------------------------------------

    return res.status(201).json({

      mensaje:
        tipoUsuario === 'prestador'
          ? 'Cuenta de prestador creada correctamente.'
          : 'Cuenta de cliente creada correctamente.',

      tipoUsuario

    });


  } catch (error) {

    console.error(
      'Error al registrar usuario:',
      error
    );

    return res.status(500).json({
      mensaje: 'Error interno del servidor.'
    });

  }

});


module.exports = router;