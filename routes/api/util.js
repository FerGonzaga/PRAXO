// routes/api/util.js
// Utilidades compartidas por las rutas de la API v1.

const tarifas = require('../../config/tarifas');
const { precioReferencia } = require('../../services/carrito');

function urlBase(req) {
  return process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : `${req.protocol}://${req.get('host')}`;
}

// Convierte rutas locales ("/uploads/x.jpg") en URLs completas para la app
function urlAbsoluta(req, ruta) {
  if (!ruta) return null;
  const limpia = String(ruta).replace(/\\/g, '/');
  if (/^https?:\/\//i.test(limpia)) return limpia;
  return urlBase(req) + (limpia.startsWith('/') ? '' : '/') + limpia;
}

// Forma pública de un prestador (sin teléfono ni datos privados)
function trabajadorPublico(req, t) {
  const ref = precioReferencia(t);
  const estimado = ref ? tarifas.calcularDesglose(ref.precio) : null;
  return {
    id: String(t._id),
    nombre: t.nombre,
    oficio: t.oficio,
    ciudad: t.ciudad || '',
    descripcion: t.descripcion || '',
    fotoUrl: urlAbsoluta(req, t.fotoUrl),
    calificacion: t.totalResenas > 0 ? Number(t.calificacionPromedio || 0) : null,
    totalResenas: t.totalResenas || 0,
    disponibleAhora: Boolean(t.disponibleAhora),
    precio: estimado
      ? { desde: estimado.total, prestador: estimado.precioPrestador, unidad: ref.unidad }
      : null // "a cotizar"
  };
}

function usuarioPublico(u) {
  return { id: String(u._id || u.id), nombre: u.nombre, correo: u.correo, tipoUsuario: u.tipoUsuario };
}

module.exports = { urlBase, urlAbsoluta, trabajadorPublico, usuarioPublico };
