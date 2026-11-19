// services/prestador.js
// Perfil del prestador: precio base y disponibilidad. Compartido por web y app.

const Trabajador = require('../models/Trabajador');

const UNIDADES = ['servicio', 'hora', 'dia'];
const PRECIO_MAXIMO = 1000000;
const MAX_TEXTO = 140;
const MAX_HISTORIAL = 20; // cambios del precio base que se conservan

function leerPrecio(valorCrudo) {
  const texto = String(valorCrudo === undefined || valorCrudo === null ? '' : valorCrudo).trim();
  const valor = Number(texto);
  if (texto === '' || !Number.isFinite(valor) || valor <= 0 || valor > PRECIO_MAXIMO) return { ok: false };
  return { ok: true, valor: Math.round(valor * 100) / 100 };
}

// Devuelve { ok, mensaje, precio, unidad } o { error, status }
async function actualizarPrecio(usuarioId, { precio, unidad, nota, motivo, sinPrecio }) {
  if (!UNIDADES.includes(unidad)) return { error: 'Elige una unidad de cobro válida.', status: 400 };

  let nuevoPrecio = null;
  if (sinPrecio !== true) {
    const lectura = leerPrecio(precio);
    if (!lectura.ok) return { error: 'Ingresa un precio mayor a 0 (máximo $1,000,000).', status: 400 };
    nuevoPrecio = lectura.valor;
  }

  const notaLimpia = String(nota || '').trim().slice(0, MAX_TEXTO);
  const motivoLimpio = String(motivo || '').trim().slice(0, MAX_TEXTO);

  const trabajador = await Trabajador.findOne({ usuarioId });
  if (!trabajador) return { error: 'No se encontró tu perfil de prestador.', status: 404 };
  if (!Array.isArray(trabajador.historialPrecios)) {
    return { error: 'Falta actualizar el modelo Trabajador (campos de precio).', status: 500 };
  }

  const eraPrimerPrecio = trabajador.precioBase === null || trabajador.precioBase === undefined;
  const cambioElPrecio = trabajador.precioBase !== nuevoPrecio || trabajador.unidadPrecio !== unidad;

  trabajador.precioBase = nuevoPrecio;
  trabajador.unidadPrecio = unidad;
  trabajador.precioNota = notaLimpia;

  if (cambioElPrecio) {
    const fecha = new Date();
    trabajador.precioActualizadoEn = fecha;
    trabajador.historialPrecios.push({
      precio: nuevoPrecio,
      unidad,
      motivo: motivoLimpio || (eraPrimerPrecio ? 'Precio inicial' : 'Actualización de precio'),
      fecha
    });
    if (trabajador.historialPrecios.length > MAX_HISTORIAL) {
      trabajador.historialPrecios = trabajador.historialPrecios.slice(-MAX_HISTORIAL);
    }
  }

  await trabajador.save();
  return {
    ok: true,
    mensaje: cambioElPrecio ? 'Precio actualizado. Tus clientes ya lo ven en tu perfil.' : 'Se guardaron tus cambios.',
    precio: trabajador.precioBase,
    unidad: trabajador.unidadPrecio
  };
}

async function cambiarDisponibilidad(usuarioId, disponible) {
  if (typeof disponible !== 'boolean') return { error: 'Valor de disponibilidad inválido.', status: 400 };

  const trabajador = await Trabajador.findOneAndUpdate(
    { usuarioId },
    { $set: { disponibleAhora: disponible } },
    { new: true }
  );
  if (!trabajador) return { error: 'No se encontró tu perfil de prestador.', status: 404 };

  return {
    ok: true,
    disponible: trabajador.disponibleAhora,
    mensaje: trabajador.disponibleAhora ? 'Ahora apareces como disponible para los clientes.' : 'Ya no apareces como disponible.'
  };
}

module.exports = { UNIDADES, actualizarPrecio, cambiarDisponibilidad };
