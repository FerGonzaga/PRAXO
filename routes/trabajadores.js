// routes/trabajadores.js
// Rutas relacionadas con los trabajadores registrados en PRAXO.

const express = require('express');
const router = express.Router();

const trabajadoresController =
  require('../controllers/trabajadoresController');


// ==========================================
// LISTAR TRABAJADORES
// ==========================================

// GET /trabajadores
//
// Muestra todos los profesionales registrados.
// También puede recibir filtros desde la URL:
//
// /trabajadores?oficio=Electricista
// /trabajadores?ciudad=Mixquiahuala
//
router.get(
  '/',
  trabajadoresController.listarTrabajadores
);


// ==========================================
// PERFIL DE UN TRABAJADOR
// ==========================================

// GET /trabajadores/:id
//
// Muestra la información completa de
// un profesional específico.
//
// Ejemplo:
// /trabajadores/670000000000000000000001
//
router.get(
  '/:id',
  trabajadoresController.verPerfil
);


// ==========================================
// EXPORTAR ROUTER
// ==========================================

module.exports = router;