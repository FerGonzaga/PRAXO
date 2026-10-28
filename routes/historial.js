// routes/historial.js
// Historial de servicios del usuario (cliente o prestador).
// GET /historial?estado=Pagada

const express = require('express');
const router = express.Router();

const Solicitud = require('../models/Solicitud');
const Trabajador = require('../models/Trabajador');
const Resena = require('../models/Resena');
const requiereSesion = require('../middlewares/requiereSesion');
const { desgloseDeSolicitud } = require('../config/tarifas');

const ESTADOS = ['Pendiente', 'Cotizada', 'Aceptada', 'Rechazada', 'Pagada', 'Completada'];

router.use(requiereSesion);

router.get('/', async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const esPrestador = usuario.tipoUsuario === 'prestador';

    // Filtro base: solo SUS solicitudes
    const filtro = {};
    if (esPrestador) {
      const trabajador = await Trabajador.findOne({ usuarioId: usuario.id }).select('_id');
      if (!trabajador) {
        return res.status(404).send('No se encontró tu perfil de prestador.');
      }
      filtro.trabajadorId = trabajador._id;
    } else {
      filtro.clienteId = usuario.id;
    }

    const todas = await Solicitud.find(filtro)
      .populate('clienteId', 'nombre')
      .populate('trabajadorId', 'nombre oficio')
      .sort({ fechaCreacion: -1 })
      .lean();

    // Reseñas de estas solicitudes (para mostrar estrellas en el historial)
    const resenas = await Resena.find({ solicitudId: { $in: todas.map(s => s._id) } })
      .select('solicitudId calificacion')
      .lean();
    const resenaPorSolicitud = {};
    resenas.forEach(r => { resenaPorSolicitud[String(r.solicitudId)] = r.calificacion; });

    // Resumen (sobre TODAS, no solo las filtradas)
    const conteo = {};
    ESTADOS.forEach(e => { conteo[e] = 0; });
    let montoMovido = 0;
    todas.forEach(s => {
      conteo[s.estado] = (conteo[s.estado] || 0) + 1;
      if (s.pago && typeof s.pago.monto === 'number') {
        montoMovido += esPrestador
          ? (typeof s.pago.precioPrestador === 'number' ? s.pago.precioPrestador : s.pago.monto)
          : s.pago.monto;
      }
    });

    const estadoFiltro = ESTADOS.includes(req.query.estado) ? req.query.estado : null;
    const solicitudes = (estadoFiltro ? todas.filter(s => s.estado === estadoFiltro) : todas)
      .map(s => ({
        ...s,
        totalMostrar: esPrestador ? s.precioAcordado : desgloseDeSolicitud(s).total,
        calificacion: resenaPorSolicitud[String(s._id)] || null
      }));

    res.render('historial', {
      titulo: 'Historial de servicios',
      esPrestador,
      solicitudes,
      total: todas.length,
      conteo,
      montoMovido,
      estados: ESTADOS,
      estadoFiltro
    });

  } catch (error) {
    console.error('Error al cargar el historial:', error);
    res.status(500).send('No se pudo cargar tu historial.');
  }
});

module.exports = router;
