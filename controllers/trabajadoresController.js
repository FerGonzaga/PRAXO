// controllers/trabajadoresController.js
// Contiene la logica de que hacer cuando llega una peticion a /trabajadores.

const Trabajador = require('../models/Trabajador');

// Lista trabajadores, opcionalmente filtrados por oficio y/o ciudad
// (estos vienen del buscador tipo Uber Eats en la pagina de inicio)
exports.listarTrabajadores = async (req, res) => {
  try {
    const filtro = {};

    if (req.query.oficio) {
      filtro.oficio = req.query.oficio;
    }

    if (req.query.ciudad) {
      // "regex" con "i" para que no distinga mayusculas/minusculas
      // y encuentre coincidencias parciales (ej: "Pachuca" encuentra "Pachuca de Soto")
      filtro.ciudad = { $regex: req.query.ciudad, $options: 'i' };
    }

    const trabajadores = await Trabajador.find(filtro);

    res.render('trabajadores', {
      titulo: 'Trabajadores disponibles',
      trabajadores,
    });
  } catch (error) {
    console.error('Error al obtener trabajadores:', error.message);
    res.status(500).send('Ocurrio un error al cargar los trabajadores.');
  }
};

// Muestra el perfil de UN trabajador especifico, buscado por su _id de Mongo
exports.verPerfil = async (req, res) => {
  try {
    const trabajador = await Trabajador.findById(req.params.id);

    if (!trabajador) {
      return res.status(404).send('Trabajador no encontrado.');
    }

    res.render('perfil', {
      titulo: trabajador.nombre,
      trabajador,
    });
  } catch (error) {
    console.error('Error al obtener el perfil:', error.message);
    res.status(500).send('Ocurrio un error al cargar el perfil.');
  }
};