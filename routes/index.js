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

// GET /quienes-somos -> pagina de quienes somos
router.get('/quienes-somos', (req, res) => {
  res.render('quienes-somos', {
    titulo: 'Quiénes somos',
  });
});

// GET /registro -> formulario de registro general (redirige a cliente o prestador)
router.get('/registro', (req, res) => {
  res.render('registro', {
    titulo: 'Crear cuenta',
  });
});

// GET/ registro/cliente -> formulario para que un cliente se registre
router.get('/registro/cliente', (req, res) => {
  res.render('registro-cliente', {
    titulo: 'Registro de cliente',
  });
});

// GET /registro/prestador -> formulario para que un prestador se registre
router.get('/registro/prestador', (req, res) => {
  res.render('registro-prestador', {
    titulo: 'Registro de prestador',
  });
});

// GET /login -> formulario de inicio de sesión
router.get('/login', (req, res) => {
  res.render('login', {
    titulo: 'Iniciar sesión',
  });
});

// Llaves de templates para MailJS
router.get('/contacto', (req, res) => {
  res.render('contacto', {
    titulo: 'Contacto',
    emailjs: {
      publicKey: process.env.EMAILJS_PUBLIC_KEY,
      serviceId: process.env.EMAILJS_SERVICE_ID,
      templateId: process.env.EMAILJS_CONTACTO_TEMPLATE_ID,
    },
  });
});

module.exports = router;