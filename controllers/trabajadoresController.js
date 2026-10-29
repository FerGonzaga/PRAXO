// controllers/trabajadoresController.js
// Contiene la logica de que hacer cuando llega una peticion a /trabajadores.

const Trabajador = require('../models/Trabajador');
const Resena = require('../models/Resena');

// Lista trabajadores, opcionalmente filtrados por oficio y/o ciudad
// (estos vienen del buscador tipo Uber Eats en la pagina de inicio)
exports.listarTrabajadores = async (req, res) => {
  try {
    const filtro = {};

    if (typeof req.query.oficio === 'string' && req.query.oficio) {
      filtro.oficio = req.query.oficio.slice(0, 60);
    }

    if (req.query.ciudad) {
      // "regex" con "i" para que no distinga mayusculas/minusculas
      // y encuentre coincidencias parciales (ej: "Pachuca" encuentra "Pachuca de Soto")
      // 🔒 Se escapan los caracteres especiales: el texto del usuario se busca
      // literal y no puede usarse como expresión regular maliciosa (ReDoS)
      const ciudad = String(req.query.ciudad).slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filtro.ciudad = { $regex: ciudad, $options: 'i' };
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

    // Últimas reseñas con el nombre de quien la escribió
    const resenas = await Resena.find({ trabajadorId: trabajador._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('clienteId', 'nombre')
      .lean();

    res.render('perfil-trabajador', {
      titulo: trabajador.nombre,
      trabajador,
      resenas,
    });
  } catch (error) {
    console.error('Error al obtener el perfil:', error.message);
    res.status(500).send('Ocurrio un error al cargar el perfil.');
  }
};