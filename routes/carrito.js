// routes/carrito.js
// Carrito persistente de servicios de PRAXO.

const express = require('express');

const router =
  express.Router();

const Trabajador =
  require('../models/Trabajador');

const SolicitudServicio =
  require('../models/SolicitudServicio');

const requiereSesion =
  require('../middlewares/requiereSesion');


// ==========================================
// PROTEGER TODO EL CARRITO
// ==========================================

router.use(requiereSesion);


// ==========================================
// FUNCION AUXILIAR
// ==========================================

function limpiarTexto(valor) {

  if (
    typeof valor !== 'string'
  ) {

    return '';

  }

  return valor.trim();

}


// ==========================================
// MOSTRAR CARRITO
// GET /carrito
// ==========================================

router.get(
  '/',
  async (req, res) => {

    try {

      const clienteId =
        req.session.usuario.id;


      const solicitudes =
        await SolicitudServicio
          .find({
            clienteId
          })
          .sort({
            createdAt: -1
          })
          .lean();


      // Tu carrito.ejs actualmente utiliza item.id.
      // Convertimos _id de MongoDB a id
      // para no tener que cambiar toda la vista.

      const carrito =
        solicitudes.map(
          (solicitud) => ({

            ...solicitud,

            id:
              solicitud._id.toString()

          })
        );


      res.render(
        'carrito',
        {

          titulo:
            'Mis servicios',

          carrito

        }
      );


    } catch (error) {

      console.error(
        'Error al cargar el carrito:',
        error
      );


      res
        .status(500)
        .send(
          'No se pudieron cargar tus servicios.'
        );

    }

  }
);


// ==========================================
// AGREGAR SERVICIO
// POST /carrito/agregar
// ==========================================

router.post(
  '/agregar',
  async (req, res) => {

    try {

      const {

        trabajadorId,
        fecha,
        hora,
        ubicacion,
        descripcion

      } = req.body;


      // ======================================
      // USUARIO ACTUAL
      // ======================================

      const clienteId =
        req.session.usuario.id;


      // ======================================
      // VALIDAR TRABAJADOR
      // ======================================

      if (!trabajadorId) {

        return res
          .status(400)
          .send(
            'No se recibió el prestador del servicio.'
          );

      }


      // ======================================
      // LIMPIAR DATOS
      // ======================================

      const fechaLimpia =
        limpiarTexto(fecha);

      const horaLimpia =
        limpiarTexto(hora);

      const ubicacionLimpia =
        limpiarTexto(ubicacion);

      const descripcionLimpia =
        limpiarTexto(descripcion);


      if (
        !fechaLimpia ||
        !horaLimpia ||
        !ubicacionLimpia ||
        !descripcionLimpia
      ) {

        return res
          .status(400)
          .send(
            'Completa todos los datos del servicio.'
          );

      }


      // ======================================
      // VALIDAR FECHA
      // ======================================

      const hoy =
        new Date();

      hoy.setHours(
        0,
        0,
        0,
        0
      );


      const fechaSeleccionada =
        new Date(
          `${fechaLimpia}T00:00:00`
        );


      if (
        Number.isNaN(
          fechaSeleccionada.getTime()
        )
      ) {

        return res
          .status(400)
          .send(
            'La fecha seleccionada no es válida.'
          );

      }


      if (
        fechaSeleccionada < hoy
      ) {

        return res
          .status(400)
          .send(
            'No puedes contratar un servicio para una fecha anterior.'
          );

      }


      // ======================================
      // BUSCAR PRESTADOR EN MONGODB
      // ======================================

      const trabajador =
        await Trabajador.findById(
          trabajadorId
        );


      if (!trabajador) {

        return res
          .status(404)
          .send(
            'El prestador seleccionado no existe.'
          );

      }


      // ======================================
      // DATOS DEL SERVICIO
      // ======================================

      const nombreTrabajador =

        trabajador.nombre ||

        trabajador.nombreCompleto ||

        'Profesional PRAXO';


      const nombreServicio =

        trabajador.oficio ||

        trabajador.servicio ||

        trabajador.categoria ||

        'Servicio profesional';


      // ======================================
      // GUARDAR EN MONGODB
      // ======================================

      await SolicitudServicio.create({

        clienteId,

        trabajadorId:
          trabajador._id,

        trabajador:
          nombreTrabajador,

        servicio:
          nombreServicio,

        fecha:
          fechaLimpia,

        hora:
          horaLimpia,

        ubicacion:
          ubicacionLimpia,

        descripcion:
          descripcionLimpia,

        ciudad:
          trabajador.ciudad || '',

        estado:
          'Pendiente'

      });


      // ======================================
      // IR AL CARRITO
      // ======================================

      return res.redirect(
        '/carrito'
      );


    } catch (error) {

      console.error(
        'Error al agregar servicio:',
        error
      );


      if (
        error.name === 'CastError'
      ) {

        return res
          .status(400)
          .send(
            'El prestador seleccionado no es válido.'
          );

      }


      return res
        .status(500)
        .send(
          'Ocurrió un error al agregar el servicio.'
        );

    }

  }
);


// ==========================================
// ELIMINAR SERVICIO
// POST /carrito/eliminar/:id
// ==========================================

router.post(
  '/eliminar/:id',
  async (req, res) => {

    try {

      const clienteId =
        req.session.usuario.id;


      // Muy importante:
      // buscamos por _id Y clienteId.
      //
      // Así un usuario no puede borrar
      // servicios de otra cuenta.

      await SolicitudServicio
        .findOneAndDelete({

          _id:
            req.params.id,

          clienteId

        });


      return res.redirect(
        '/carrito'
      );


    } catch (error) {

      console.error(
        'Error eliminando servicio:',
        error
      );


      return res
        .status(500)
        .send(
          'No se pudo eliminar el servicio.'
        );

    }

  }
);


// ==========================================
// VACIAR CARRITO
// POST /carrito/vaciar
// ==========================================

router.post(
  '/vaciar',
  async (req, res) => {

    try {

      const clienteId =
        req.session.usuario.id;


      // Borra solamente los servicios
      // pertenecientes al usuario actual.

      await SolicitudServicio.deleteMany({
        clienteId
      });


      return res.redirect(
        '/carrito'
      );


    } catch (error) {

      console.error(
        'Error vaciando carrito:',
        error
      );


      return res
        .status(500)
        .send(
          'No se pudo vaciar el carrito.'
        );

    }

  }
);


// ==========================================
// CANTIDAD DEL CARRITO
// GET /carrito/cantidad
// ==========================================

router.get(
  '/cantidad',
  async (req, res) => {

    try {

      const clienteId =
        req.session.usuario.id;


      const cantidad =
        await SolicitudServicio.countDocuments({
          clienteId
        });


      return res.json({
        cantidad
      });


    } catch (error) {

      console.error(
        'Error contando servicios:',
        error
      );


      return res.status(500).json({
        cantidad:
          0
      });

    }

  }
);


// ==========================================
// EXPORTAR
// ==========================================

module.exports =
  router;