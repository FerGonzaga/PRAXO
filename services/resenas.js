// services/resenas.js
// Consultas de reseñas compartidas por la página principal y la app móvil.

const Resena = require('../models/Resena');

// ---------------------------------------------------------------
// MEJORES RESEÑAS PARA EL CARRUSEL DE LA PÁGINA PRINCIPAL
// Se consultan en cada visita: si alguien deja una reseña mejor
// (más estrellas o igual de buena pero más reciente), entra sola.
// ---------------------------------------------------------------
const MAX_RESENAS_CARRUSEL = 9;

// "Ana López Hernández" -> "Ana L." (protege la identidad del cliente)
function nombrePublico(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Cliente PRAXO';
  return partes.length > 1 ? `${partes[0]} ${partes[1].charAt(0).toUpperCase()}.` : partes[0];
}

async function obtenerMejoresResenas() {
  const resenas = await Resena.find({
    calificacion: { $gte: 4 },                 // solo reseñas buenas (4 y 5 estrellas)
    comentario: { $exists: true, $ne: '' }     // con texto escrito por el cliente
  })
    .sort({ calificacion: -1, createdAt: -1 }) // primero las mejores; a empate, las más nuevas
    .limit(MAX_RESENAS_CARRUSEL * 2)
    .populate('clienteId', 'nombre')
    .populate('trabajadorId', 'nombre oficio fotoUrl')
    .lean();

  return resenas
    .filter((r) => r.trabajadorId) // descarta reseñas de prestadores que ya no existen
    .slice(0, MAX_RESENAS_CARRUSEL)
    .map((r) => ({
      calificacion: r.calificacion,
      comentario: r.comentario.length > 220 ? r.comentario.slice(0, 217).trim() + '…' : r.comentario,
      cliente: nombrePublico(r.clienteId && r.clienteId.nombre),
      fecha: r.createdAt,
      trabajador: {
        id: String(r.trabajadorId._id),
        nombre: r.trabajadorId.nombre,
        oficio: r.trabajadorId.oficio,
        fotoUrl: r.trabajadorId.fotoUrl || null
      }
    }));
}

module.exports = { obtenerMejoresResenas, nombrePublico };
