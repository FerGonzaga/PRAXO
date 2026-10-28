// services/calificaciones.js
// Recalcula la calificación promedio de un prestador a partir de sus reseñas.

const mongoose = require('mongoose');
const Resena = require('../models/Resena');
const Trabajador = require('../models/Trabajador');

async function recalcularCalificacion(trabajadorId) {
  const [resultado] = await Resena.aggregate([
    { $match: { trabajadorId: new mongoose.Types.ObjectId(String(trabajadorId)) } },
    {
      $group: {
        _id: '$trabajadorId',
        promedio: { $avg: '$calificacion' },
        total: { $sum: 1 }
      }
    }
  ]);

  const promedio = resultado ? Math.round(resultado.promedio * 10) / 10 : 0; // 1 decimal
  const total = resultado ? resultado.total : 0;

  await Trabajador.updateOne(
    { _id: trabajadorId },
    { $set: { calificacionPromedio: promedio, totalResenas: total } }
  );

  return { promedio, total };
}

module.exports = { recalcularCalificacion };
