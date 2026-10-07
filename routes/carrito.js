// routes/carrito.js
// Manejo del carrito de servicios de PRAXO.

const express = require('express');
const { randomUUID } = require('crypto');

const router = express.Router();

const Trabajador = require('../models/Trabajador');

// Middleware para proteger el carrito
const requiereSesion =
  require('../middlewares/requiereSesion');


// ==========================================
// PROTEGER TODAS LAS RUTAS DEL CARRITO
// ==========================================

router.use(requiereSesion);


// ==========================================
// FUNCION AUXILIAR
// ==========================================

// Limpia textos recibidos desde formularios.
function limpiarTexto(valor) {

  if (typeof valor !== 'string') {
    return '';
  }

  return valor.trim();

}


// ==========================================
// MOSTRAR CARRITO
// GET /carrito
// ==========================================

router.get('/', (req, res) => {

  const carrito =
    req.session.carrito || [];

  res.render('carrito', {

    titulo: 'Mis servicios',

    carrito

  });

});


// ==========================================
// AGREGAR SERVICIO
// POST /carrito/agregar
// ==========================================

router.post('/agregar', async (req, res) => {

  try {

    const {

      trabajadorId,
      fecha,
      hora,
      ubicacion,
      descripcion

    } = req.body;


    // --------------------------------------
    // VALIDAR ID DEL TRABAJADOR
    // --------------------------------------

    if (!trabajadorId) {

      return res
        .status(400)
        .send(
          'No se recibió el prestador del servicio.'
        );

    }


    // --------------------------------------
    // VALIDAR DATOS DEL SERVICIO
    // --------------------------------------

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


    // --------------------------------------
    // VALIDAR QUE LA FECHA NO SEA ANTERIOR
    // --------------------------------------

    const hoy = new Date();

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


    // --------------------------------------
    // BUSCAR TRABAJADOR EN MONGODB
    // --------------------------------------

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


    // --------------------------------------
    // CREAR CARRITO SI NO EXISTE
    // --------------------------------------

    if (
      !Array.isArray(
        req.session.carrito
      )
    ) {

      req.session.carrito = [];

    }


    // --------------------------------------
    // DATOS DEL TRABAJADOR
    // --------------------------------------

    const nombreTrabajador =

      trabajador.nombre ||

      trabajador.nombreCompleto ||

      'Profesional PRAXO';


    const nombreServicio =

      trabajador.oficio ||

      trabajador.servicio ||

      trabajador.categoria ||

      'Servicio profesional';


    // --------------------------------------
    // CREAR SERVICIO DEL CARRITO
    // --------------------------------------

    const nuevoServicio = {

      // ID propio del elemento del carrito.
      id: randomUUID(),

      trabajadorId:
        trabajador._id.toString(),

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

    };


    // --------------------------------------
    // AGREGAR AL CARRITO
    // --------------------------------------

    req.session.carrito.push(
      nuevoServicio
    );


    // --------------------------------------
    // GUARDAR SESION
    // --------------------------------------

    req.session.save(
      (error) => {

        if (error) {

          console.error(
            'Error guardando el carrito:',
            error
          );

          return res
            .status(500)
            .send(
              'No se pudo guardar el servicio.'
            );

        }


        // Después de agregar,
        // mandar al usuario al carrito.

        res.redirect(
          '/carrito'
        );

      }
    );


  } catch (error) {

    console.error(
      'Error al agregar servicio al carrito:',
      error
    );


    // Si MongoDB recibe un ID incorrecto.

    if (
      error.name === 'CastError'
    ) {

      return res
        .status(400)
        .send(
          'El prestador seleccionado no es válido.'
        );

    }


    res
      .status(500)
      .send(
        'Ocurrió un error al agregar el servicio.'
      );

  }

});


// ==========================================
// ELIMINAR SERVICIO
// POST /carrito/eliminar/:id
// ==========================================

router.post(
  '/eliminar/:id',
  (req, res) => {

    const carrito =
      req.session.carrito || [];


    req.session.carrito =
      carrito.filter(
        (item) =>
          item.id !== req.params.id
      );


    req.session.save(
      (error) => {

        if (error) {

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


        res.redirect(
          '/carrito'
        );

      }
    );

  }
);


// ==========================================
// VACIAR TODO EL CARRITO
// POST /carrito/vaciar
// ==========================================

router.post(
  '/vaciar',
  (req, res) => {

    req.session.carrito = [];


    req.session.save(
      (error) => {

        if (error) {

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


        res.redirect(
          '/carrito'
        );

      }
    );

  }
);


// ==========================================
// OBTENER CANTIDAD DEL CARRITO
// GET /carrito/cantidad
// ==========================================

router.get(
  '/cantidad',
  (req, res) => {

    const carrito =
      req.session.carrito || [];


    res.json({

      cantidad:
        carrito.length

    });

  }
);


// ==========================================
// EXPORTAR ROUTER
// ==========================================

module.exports = router;