// routes/verificacion.js
// Rutas de la verificacion de correo por codigo.

const express = require('express');
const router = express.Router();
const verificacionController = require('../controllers/verificacionController');

// GET /verificacion -> pagina de prueba para probar todo el flujo
router.get('/', (req, res) => {
  res.render('verificar-correo', { titulo: 'Verificar correo' });
});

// POST /verificacion/enviar -> genera y envia el codigo por correo
router.post('/enviar', verificacionController.enviarCodigo);

// POST /verificacion/validar -> comprueba el codigo escrito por el usuario
router.post('/validar', verificacionController.validarCodigo);

module.exports = router;