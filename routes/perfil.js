// routes/perfil.js

const express = require('express');

const router = express.Router();


const perfilController =
  require('../controllers/perfilController');


const requiereSesion =
  require('../middlewares/requiereSesion');


// ==========================================
// TODA LA RUTA REQUIERE SESION
// ==========================================

router.use(requiereSesion);


// ==========================================
// GET /perfil
// ==========================================

router.get(
  '/',
  perfilController.mostrarPerfil
);


// ==========================================
// CENTRO DE PRIVACIDAD (derechos ARCO y consentimiento)
// ==========================================

// GET /perfil/privacidad
router.get('/privacidad', perfilController.centroPrivacidad);

// POST /perfil/privacidad/aceptar   (cuentas creadas antes del aviso)
router.post('/privacidad/aceptar', perfilController.aceptarAviso);

// POST /perfil/privacidad/promociones   (dar o revocar el opt-in)
router.post('/privacidad/promociones', perfilController.cambiarPromociones);

// GET /perfil/privacidad/mis-datos   (derecho de ACCESO: descarga JSON)
router.get('/privacidad/mis-datos', perfilController.descargarMisDatos);


module.exports = router;