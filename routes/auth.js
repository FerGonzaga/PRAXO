// routes/auth.js
// Rutas relacionadas con autenticación de usuarios.

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const Usuario = require('../models/Usuarios_Praxo');
const Trabajador = require('../models/Trabajador');

const {
  enviarCorreoVerificacion
} = require('../services/brevo');

const router = express.Router();


// ======================================================
// POST /api/auth/registro
// Registro de clientes y prestadores
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
      descripcion
    } = req.body;


    // --------------------------------------------------
    // VALIDACIONES GENERALES
    // --------------------------------------------------

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


    // --------------------------------------------------
    // VALIDACIONES DEL PRESTADOR
    // --------------------------------------------------

    if (tipoUsuario === 'prestador') {

      if (!oficio || !telefono || !ciudad) {

        return res.status(400).json({
          mensaje: 'Completa la información de tu servicio.'
        });

      }

    }


    // --------------------------------------------------
    // NORMALIZAR CORREO
    // --------------------------------------------------

    const correoNormalizado = correo
      .trim()
      .toLowerCase();


    // --------------------------------------------------
    // COMPROBAR SI EL CORREO YA EXISTE
    // --------------------------------------------------

    const usuarioExistente = await Usuario.findOne({
      correo: correoNormalizado
    });


    if (usuarioExistente) {

      return res.status(409).json({
        mensaje: 'El correo ya está registrado.'
      });

    }


    // --------------------------------------------------
    // GENERAR HASH DE CONTRASEÑA
    // --------------------------------------------------

    const passwordHash = await bcrypt.hash(
      password,
      10
    );


    // --------------------------------------------------
    // GENERAR TOKEN DE VERIFICACIÓN
    // --------------------------------------------------

    const tokenVerificacion =
      crypto.randomBytes(32).toString('hex');


    // Token válido durante 30 minutos
    const tokenExpiracion =
      new Date(Date.now() + 30 * 60 * 1000);


    // --------------------------------------------------
    // CREAR USUARIO
    // --------------------------------------------------

    const nuevoUsuario = new Usuario({

      nombre: nombre.trim(),

      correo: correoNormalizado,

      passwordHash,

      tipoUsuario,

      emailVerificado: false,

      tokenVerificacion,

      tokenExpiracion

    });


    await nuevoUsuario.save();


    // --------------------------------------------------
    // CREAR PERFIL DE PRESTADOR
    // --------------------------------------------------

    let nuevoTrabajador = null;


    if (tipoUsuario === 'prestador') {

      try {

        nuevoTrabajador = new Trabajador({

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

        // Si falla el perfil del trabajador,
        // eliminar también el usuario creado.

        await Usuario.findByIdAndDelete(
          nuevoUsuario._id
        );

        throw errorTrabajador;
      }

    }


    // --------------------------------------------------
    // ENVIAR CORREO DE VERIFICACIÓN CON BREVO
    // --------------------------------------------------

    try {

      const resultadoBrevo =
        await enviarCorreoVerificacion({

          nombre: nuevoUsuario.nombre,

          correo: nuevoUsuario.correo,

          token: tokenVerificacion

        });


      console.log(
        'Correo de verificación enviado:',
        resultadoBrevo.messageId
      );


    } catch (errorBrevo) {

      console.error(
        'Error al enviar correo con Brevo:',
        errorBrevo
      );


      // Si Brevo falla, eliminamos lo creado
      // para no dejar una cuenta incompleta.

      if (nuevoTrabajador) {

        await Trabajador.findByIdAndDelete(
          nuevoTrabajador._id
        );

      }


      await Usuario.findByIdAndDelete(
        nuevoUsuario._id
      );


      return res.status(500).json({

        mensaje:
          'La cuenta no pudo completarse porque no fue posible enviar el correo de verificación.'

      });

    }


    // --------------------------------------------------
    // RESPUESTA EXITOSA
    // --------------------------------------------------

    return res.status(201).json({

      mensaje:
        tipoUsuario === 'prestador'
          ? 'Cuenta de prestador creada correctamente. Revisa tu correo para verificarla.'
          : 'Cuenta de cliente creada correctamente. Revisa tu correo para verificarla.',

      tipoUsuario

    });


  } catch (error) {

    console.error(
      'Error al registrar usuario:',
      error
    );


    return res.status(500).json({

      mensaje:
        'Error interno del servidor.'

    });

  }

});


// ======================================================
// POST /api/auth/login
// Inicio de sesión
// ======================================================

router.post('/login', async (req, res) => {

  try {

    const {
      correo,
      password
    } = req.body;


    // --------------------------------------------------
    // VALIDACIONES
    // --------------------------------------------------

    if (!correo || !password) {

      return res.status(400).json({

        mensaje:
          'El correo y la contraseña son obligatorios.'

      });

    }


    const correoNormalizado =
      correo.trim().toLowerCase();


    // --------------------------------------------------
    // BUSCAR USUARIO
    // --------------------------------------------------

    const usuario = await Usuario.findOne({

      correo: correoNormalizado

    });


    if (!usuario) {

      return res.status(401).json({

        mensaje:
          'Correo o contraseña incorrectos.'

      });

    }


    // --------------------------------------------------
    // COMPARAR CONTRASEÑA
    // --------------------------------------------------

    const passwordCorrecta =
      await bcrypt.compare(
        password,
        usuario.passwordHash
      );


    if (!passwordCorrecta) {

      return res.status(401).json({

        mensaje:
          'Correo o contraseña incorrectos.'

      });

    }


    // --------------------------------------------------
    // VERIFICAR CORREO
    // --------------------------------------------------

    if (!usuario.emailVerificado) {

      return res.status(403).json({

        mensaje:
          'Debes verificar tu correo electrónico antes de iniciar sesión.'

      });

    }


    // --------------------------------------------------
    // LOGIN CORRECTO
    // --------------------------------------------------

    return res.status(200).json({

      mensaje:
        'Inicio de sesión correcto.',

      usuario: {

        id: usuario._id,

        nombre: usuario.nombre,

        correo: usuario.correo,

        tipoUsuario: usuario.tipoUsuario

      }

    });


  } catch (error) {

    console.error(
      'Error al iniciar sesión:',
      error
    );


    return res.status(500).json({

      mensaje:
        'Error interno del servidor.'

    });

  }

});


// ======================================================
// GET /api/auth/verificar-email?token=...
// Verificación del correo
// ======================================================

router.get('/verificar-email', async (req, res) => {

  try {

    const { token } = req.query;


    // --------------------------------------------------
    // VALIDAR TOKEN RECIBIDO
    // --------------------------------------------------

    if (!token) {

      return res.status(400).send(`
        <h1>PRAXO</h1>

        <p>
          El enlace de verificación no es válido.
        </p>
      `);

    }


    // --------------------------------------------------
    // BUSCAR USUARIO CON TOKEN VIGENTE
    // --------------------------------------------------

    const usuario = await Usuario.findOne({

      tokenVerificacion: token,

      tokenExpiracion: {
        $gt: new Date()
      }

    });


    if (!usuario) {

      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="es">

        <head>

          <meta charset="UTF-8">

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          >

          <title>Verificación no válida - PRAXO</title>

          <link
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
            rel="stylesheet"
          >

        </head>

        <body>

          <main class="container py-5">

            <div class="row justify-content-center">

              <div class="col-md-6">

                <div class="card border-0 shadow-sm">

                  <div class="card-body text-center p-5">

                    <h1 class="h3 fw-bold">
                      Enlace no válido o expirado
                    </h1>

                    <p class="text-muted">
                      El enlace de verificación ya no es válido.
                    </p>

                    <a
                      href="/login"
                      class="btn btn-dark"
                    >
                      Ir al Login
                    </a>

                  </div>

                </div>

              </div>

            </div>

          </main>

        </body>

        </html>
      `);

    }


    // --------------------------------------------------
    // CONFIRMAR CORREO
    // --------------------------------------------------

    usuario.emailVerificado = true;

    usuario.tokenVerificacion = null;

    usuario.tokenExpiracion = null;


    await usuario.save();


    // --------------------------------------------------
    // MOSTRAR CONFIRMACIÓN
    // --------------------------------------------------

    return res.send(`
      <!DOCTYPE html>

      <html lang="es">

      <head>

        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >

        <title>Correo verificado - PRAXO</title>

        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        >

      </head>


      <body>

        <main class="container py-5">

          <div class="row justify-content-center">

            <div class="col-md-6">

              <div class="card border-0 shadow-sm">

                <div class="card-body text-center p-5">

                  <div class="display-4 mb-3">
                    ✓
                  </div>

                  <h1 class="h3 fw-bold">
                    Correo verificado
                  </h1>

                  <p class="text-muted">
                    Tu cuenta de PRAXO ha sido verificada correctamente.
                  </p>

                  <a
                    href="/login"
                    class="btn btn-dark"
                  >
                    Iniciar sesión
                  </a>

                </div>

              </div>

            </div>

          </div>

        </main>

      </body>

      </html>
    `);


  } catch (error) {

    console.error(
      'Error al verificar correo:',
      error
    );


    return res.status(500).send(`

      <h1>PRAXO</h1>

      <p>
        Ocurrió un error al verificar el correo.
      </p>

    `);

  }

});


module.exports = router;