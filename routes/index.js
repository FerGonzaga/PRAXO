// routes/index.js
// Rutas de las paginas generales del sitio.

const express = require('express');
const router = express.Router();
const Trabajador = require('../models/Trabajador');

// GET / -> pagina principal, con trabajadores destacados
router.get('/', async (req, res) => {
  try {
    const destacados = await Trabajador.find()
      .sort({ calificacionPromedio: -1 }) // los mejor calificados primero
      .limit(4);

    res.render('index', {
      titulo: 'Inicio',
      destacados,
    });
  } catch (error) {
    console.error('Error al cargar destacados:', error.message);
    res.render('index', {
      titulo: 'Inicio',
      destacados: [],
    });
  }
});

// GET /contacto -> pagina de contacto
router.get('/contacto', (req, res) => {
  res.render('contacto', {
    titulo: 'Contacto',
  });
});

// GET /registro -> formulario para que un trabajador se anuncie
router.get('/registro', (req, res) => {
  res.render('registro', {
    titulo: 'Regístrate como profesional',
  });
});

module.exports = router;