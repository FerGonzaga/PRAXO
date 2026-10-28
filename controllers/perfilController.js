// controllers/perfilController.js
// Controlador para visualizar el perfil del usuario.

const Usuario = require('../models/Usuarios_Praxo');
const Trabajador = require('../models/Trabajador');
const Solicitud = require('../models/Solicitud');
const Mensaje = require('../models/Mensaje');
const Resena = require('../models/Resena');
const privacidad = require('../config/privacidad');


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


// ==========================================
// CENTRO DE PRIVACIDAD
// ==========================================

exports.centroPrivacidad = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.session.usuario.id)
      .select('-passwordHash -tokenVerificacion -tokenExpiracion')
      .lean();

    if (!usuario) {
      return res.status(404).send('Usuario no encontrado.');
    }

    res.render('privacidad', {
      titulo: 'Centro de privacidad',
      usuario,
      consentimiento: usuario.consentimiento || {},
      privacidad,
      aviso: req.query.aviso || null
    });
  } catch (error) {
    console.error('Error al cargar el centro de privacidad:', error);
    res.status(500).send('No se pudo cargar el centro de privacidad.');
  }
};


exports.aceptarAviso = async (req, res) => {
  try {
    await Usuario.updateOne(
      { _id: req.session.usuario.id },
      {
        $set: {
          'consentimiento.privacidad.aceptado': true,
          'consentimiento.privacidad.fecha': new Date(),
          'consentimiento.privacidad.version': privacidad.VERSION_AVISO
        }
      }
    );
    res.redirect('/perfil/privacidad?aviso=aceptado');
  } catch (error) {
    console.error('Error al aceptar el aviso:', error);
    res.status(500).send('No se pudo guardar tu consentimiento.');
  }
};


exports.cambiarPromociones = async (req, res) => {
  try {
    const acepta = req.body.promociones === 'si';
    await Usuario.updateOne(
      { _id: req.session.usuario.id },
      {
        $set: {
          'consentimiento.promociones.aceptado': acepta,
          'consentimiento.promociones.fecha': new Date()
        }
      }
    );
    res.redirect('/perfil/privacidad?aviso=' + (acepta ? 'promo-on' : 'promo-off'));
  } catch (error) {
    console.error('Error al cambiar promociones:', error);
    res.status(500).send('No se pudo guardar tu preferencia.');
  }
};


// Derecho de ACCESO: el usuario descarga todos sus datos en JSON.
exports.descargarMisDatos = async (req, res) => {
  try {
    const id = req.session.usuario.id;

    const usuario = await Usuario.findById(id)
      .select('-passwordHash -tokenVerificacion -tokenExpiracion -__v')
      .lean();
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado.');
    }

    const trabajador = usuario.tipoUsuario === 'prestador'
      ? await Trabajador.findOne({ usuarioId: id }).select('-__v').lean()
      : null;

    const filtroSolicitudes = trabajador ? { trabajadorId: trabajador._id } : { clienteId: id };
    const solicitudes = await Solicitud.find(filtroSolicitudes).select('-__v').lean();
    const mensajes = await Mensaje.find({ emisorId: id }).select('solicitudId texto fecha').lean();
    const resenas = await Resena.find(trabajador ? { trabajadorId: trabajador._id } : { clienteId: id })
      .select('-__v').lean();

    const exportacion = {
      generado: new Date().toISOString(),
      nota: 'Copia de tus datos personales en PRAXO (derecho de acceso, LFPDPPP). ' +
            'Por seguridad no se incluye tu contraseña (solo guardamos un hash cifrado) ' +
            'ni datos completos de tarjetas (nunca los almacenamos).',
      cuenta: usuario,
      perfilPrestador: trabajador,
      solicitudes,
      mensajesEnviados: mensajes,
      resenas
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-praxo.json"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(JSON.stringify(exportacion, null, 2));
  } catch (error) {
    console.error('Error al exportar datos:', error);
    res.status(500).send('No se pudieron exportar tus datos.');
  }
};
