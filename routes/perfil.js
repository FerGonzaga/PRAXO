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


module.exports = router;