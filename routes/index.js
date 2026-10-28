// routes/index.js
// Rutas de las paginas generales del sitio.

const express = require('express');
const router = express.Router();
const Trabajador = require('../models/Trabajador');
const Solicitud = require('../models/Solicitud');
const { requireTipo } = require('../middlewares/auth');

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

// GET /contacto -> pagina de contacto (con las llaves de EmailJS, unificada)
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

// GET /inicio-cliente -> panel de opciones para clientes (requiere sesion de cliente)
// routes/index.js
// Rutas de las paginas generales del sitio.


// ... (tus otras rutas de /, /contacto, /login, etc. déjalas igual) ...

// GET /inicio-cliente -> panel de opciones para clientes (requiere sesion de cliente)
router.get('/inicio-cliente', requireTipo('cliente'), async (req, res) => {
  try {
    const clienteId = req.session.usuario.id;
    
    // 🟢 2. Buscar todas las solicitudes que hizo este cliente y poblar los datos del trabajador
    const solicitudes = await Solicitud.find({ clienteId })
      .populate({
        path: 'trabajadorId',
        populate: { path: 'usuarioId', select: 'nombre' }
      })
      .sort({ fechaCreacion: -1 })
      .lean();

    res.render('inicio-cliente', {
      titulo: 'Inicio',
      usuario: req.session.usuario,
      solicitudes // 🟢 3. Pasamos las solicitudes a la vista
    });
  } catch (error) {
    console.error('Error al cargar solicitudes del cliente:', error);
    res.render('inicio-cliente', {
      titulo: 'Inicio',
      usuario: req.session.usuario,
      solicitudes: []
    });
  }
});

// GET /inicio-prestador -> panel de opciones para prestadores (requiere sesion de prestador)
router.get('/inicio-prestador', requireTipo('prestador'), async (req, res) => {
  let disponible = false;
  try {
    const trabajador = await Trabajador.findOne({ usuarioId: req.session.usuario.id })
      .select('disponibleAhora')
      .lean();
    disponible = Boolean(trabajador && trabajador.disponibleAhora);
  } catch (error) {
    console.error('Error al leer disponibilidad:', error.message);
  }

  res.render('inicio-prestador', {
    titulo: 'Inicio',
    usuario: req.session.usuario,
    disponible,
  });
});

// GET /revisa-correo -> pagina mostrada justo despues de registrarse
router.get('/revisa-correo', (req, res) => {
  res.render('revisa-correo', {
    titulo: 'Revisa tu correo',
    correo: req.query.correo || '',
    tipoUsuario: req.query.tipoUsuario || '',
  });
});

// ==========================================
// POLÍTICAS DE COMPRA (precios, pagos, cancelaciones y garantía)
// ==========================================
router.get('/politicas', (req, res) => {
  res.render('politicas', { titulo: 'Políticas de compra' });
});

// ==========================================
// AVISO DE PRIVACIDAD INTEGRAL
// ==========================================
router.get('/aviso-privacidad', (req, res) => {
  res.render('aviso-privacidad', {
    titulo: 'Aviso de Privacidad',
    privacidad: require('../config/privacidad')
  });
});

// ==========================================
// TÉRMINOS Y CONDICIONES (NUEVA RUTA)
// ==========================================
router.get('/terminos', (req, res) => {
  res.render('terminos', { 
    titulo: 'Términos y Condiciones',
    usuarioAutenticado: req.session && req.session.usuario ? true : false,
    usuarioActual: req.session ? req.session.usuario : null
  });
});

module.exports = router;