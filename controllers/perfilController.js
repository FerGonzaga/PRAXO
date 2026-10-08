// controllers/perfilController.js
// Controlador para visualizar el perfil del usuario.

const Usuario = require('../models/Usuarios_Praxo');
const Trabajador = require('../models/Trabajador');


// ==========================================
// MOSTRAR PERFIL
// ==========================================

exports.mostrarPerfil = async (req, res) => {

  try {

    // ID del usuario que inició sesión
    const usuarioId =
      req.session.usuario.id;


    // ======================================
    // BUSCAR USUARIO
    // ======================================

    const usuario =
      await Usuario
        .findById(usuarioId)
        .select('-passwordHash')
        .lean();


    if (!usuario) {

      return res
        .status(404)
        .send('Usuario no encontrado.');

    }


    // ======================================
    // SI ES PRESTADOR, BUSCAR SUS DATOS
    // ======================================

    let trabajador = null;


    if (usuario.tipoUsuario === 'prestador') {

      trabajador =
        await Trabajador
          .findOne({
            usuarioId: usuario._id
          })
          .lean();

    }


    // ======================================
    // MOSTRAR VISTA
    // ======================================

    return res.render(
      'perfil',
      {

        titulo:
          'Mi perfil',

        usuario,

        trabajador

      }
    );


  } catch (error) {

    console.error(
      'Error al cargar perfil:',
      error
    );


    return res
      .status(500)
      .send(
        'Ocurrió un error al cargar el perfil.'
      );

  }

};