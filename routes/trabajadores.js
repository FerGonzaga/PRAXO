// routes/trabajadores.js
// Rutas relacionadas con los trabajadores registrados.

const express = require('express');
const router = express.Router();
const trabajadoresController = require('../controllers/trabajadoresController');

// GET /trabajadores -> lista todos los trabajadores
router.get('/', trabajadoresController.listarTrabajadores);

// GET /trabajadores/:id -> perfil de un trabajador especifico
router.get('/:id', trabajadoresController.verPerfil);

module.exports = router;