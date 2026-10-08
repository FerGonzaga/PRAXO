// routes/trabajadores.js
// Rutas relacionadas con los trabajadores registrados en PRAXO.

const express = require('express');
const router = express.Router();

const trabajadoresController =
  require('../controllers/trabajadoresController');


// ==========================================
// LISTAR TRABAJADORES
// ==========================================
//
// GET /trabajadores
//
// Esta ruta es PUBLICA.
// Cualquier persona puede consultar
// los profesionales disponibles.
//
// También acepta filtros:
//
// /trabajadores?oficio=Electricista
// /trabajadores?ciudad=Mixquiahuala
//

router.get(
  '/',
  trabajadoresController.listarTrabajadores
);


// ==========================================
// PERFIL PUBLICO DE UN TRABAJADOR
// ==========================================
//
// GET /trabajadores/:id
//
// Esta ruta también es PUBLICA.
//
// No requiere iniciar sesión porque los
// clientes necesitan consultar los perfiles
// antes de decidir a quién contratar.
//

router.get(
  '/:id',
  trabajadoresController.verPerfil
);


// ==========================================
// EXPORTAR ROUTER
// ==========================================

module.exports = router;