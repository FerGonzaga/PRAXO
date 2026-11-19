// services/carrito.js
// Lógica del carrito de servicios, COMPARTIDA por la web (routes/carrito.js)
// y la app móvil (routes/api/v1.js). Si cambias una regla aquí, cambia en ambas.

const Trabajador = require('../models/Trabajador');
const SolicitudServicio = require('../models/SolicitudServicio');
const Solicitud = require('../models/Solicitud');
const { calcularDesglose } = require('../config/tarifas');

const UNIDADES = { servicio: 'por servicio', hora: 'por hora', dia: 'por día' };

function limpiarTexto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

// Precio de referencia del prestador (precio base o tarifa de referencia)
function precioReferencia(trabajador) {
  if (!trabajador) return null;
  if (typeof trabajador.precioBase === 'number' && trabajador.precioBase > 0) {
    return { precio: trabajador.precioBase, unidad: UNIDADES[trabajador.unidadPrecio] || 'por servicio' };
  }
  if (typeof trabajador.tarifaPrecio === 'number' && trabajador.tarifaPrecio > 0) {
    return { precio: trabajador.tarifaPrecio, unidad: trabajador.conceptoPrecio ? 'por ' + trabajador.conceptoPrecio.toLowerCase() : 'por servicio' };
  }
  return null;
}

// Valida y limpia los datos de un servicio (al agregarlo o editarlo)
function validarDatosServicio(body) {
  body = body || {};
  const fecha = limpiarTexto(body.fecha);
  const hora = limpiarTexto(body.hora);
  const ubicacion = limpiarTexto(body.ubicacion);
  const descripcion = limpiarTexto(body.descripcion);
  const referenciasUbicacion = limpiarTexto(body.referenciasUbicacion);

  if (!fecha || !hora || !ubicacion || !descripcion) {
    return { error: 'Completa fecha, hora, ubicación y descripción.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return { error: 'La fecha u hora no tienen un formato válido.' };
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(f.getTime()) || f < hoy) {
    return { error: 'Elige una fecha de hoy en adelante.' };
  }
  if (ubicacion.length > 150 || descripcion.length > 500 || referenciasUbicacion.length > 250) {
    return { error: 'Algún campo es demasiado largo.' };
  }

  const cotizacion = body.requiereCotizacion;
  return {
    ok: true,
    datos: {
      fecha, hora, ubicacion, descripcion, referenciasUbicacion,
      urgencia: body.urgencia === 'Urgencia' ? 'Urgencia' : 'Programado',
      requiereCotizacion: cotizacion === true || cotizacion === 'on' || cotizacion === 'true'
    }
  };
}

// Carrito del cliente con precio estimado por servicio y resumen desglosado
async function obtenerCarrito(clienteId) {
  const solicitudes = await SolicitudServicio
    .find({ clienteId })
    .populate('trabajadorId', 'precioBase unidadPrecio tarifaPrecio conceptoPrecio')
    .sort({ createdAt: -1 })
    .lean();

  const resumen = { servicios: solicitudes.length, aCotizar: 0, precioPrestador: 0, comision: 0, ivaComision: 0, total: 0 };

  const items = solicitudes.map((solicitud) => {
    const ref = precioReferencia(solicitud.trabajadorId);
    const estimado = ref ? calcularDesglose(ref.precio) : null;

    if (estimado) {
      resumen.precioPrestador += estimado.precioPrestador;
      resumen.comision += estimado.comision;
      resumen.ivaComision += estimado.ivaComision;
      resumen.total += estimado.total;
    } else {
      resumen.aCotizar += 1;
    }

    return {
      ...solicitud,
      id: solicitud._id.toString(),
      unidadReferencia: ref ? ref.unidad : null,
      estimado
    };
  });

  ['precioPrestador', 'comision', 'ivaComision', 'total'].forEach((k) => {
    resumen[k] = Math.round(resumen[k] * 100) / 100;
  });

  return { items, resumen };
}

// Agrega un servicio. Devuelve { ok, item } o { error, status }
async function agregarAlCarrito(clienteId, body, rutaImagen) {
  const trabajadorId = body && body.trabajadorId;
  if (!trabajadorId || typeof trabajadorId !== 'string') {
    return { error: 'No se recibió el prestador del servicio.', status: 400 };
  }

  const validacion = validarDatosServicio(body);
  if (!validacion.ok) {
    return { error: validacion.error, status: 400 };
  }

  let trabajador;
  try {
    trabajador = await Trabajador.findById(trabajadorId);
  } catch (e) {
    return { error: 'El prestador seleccionado no es válido.', status: 400 };
  }
  if (!trabajador) {
    return { error: 'El prestador seleccionado no existe.', status: 404 };
  }

  const item = await SolicitudServicio.create({
    clienteId,
    trabajadorId: trabajador._id,
    trabajador: trabajador.nombre || 'Profesional PRAXO',
    servicio: trabajador.oficio || 'Servicio profesional',
    ciudad: trabajador.ciudad || '',
    estado: 'Pendiente',
    imagenEvidencia: rutaImagen || null,
    ...validacion.datos
  });

  return { ok: true, item };
}

// Convierte el carrito en solicitudes oficiales (estado Pendiente)
async function confirmarCarrito(clienteId) {
  const carrito = await SolicitudServicio.find({ clienteId }).lean();
  if (carrito.length === 0) {
    return { creadas: 0 };
  }

  const nuevas = await Solicitud.insertMany(carrito.map((item) => ({
    clienteId,
    trabajadorId: item.trabajadorId,
    servicio: item.servicio,
    fecha: item.fecha,
    hora: item.hora,
    ubicacion: item.ubicacion,
    referenciasUbicacion: item.referenciasUbicacion,
    descripcion: item.descripcion,
    urgencia: item.urgencia,
    imagenEvidencia: item.imagenEvidencia,
    requiereCotizacion: item.requiereCotizacion,
    estado: 'Pendiente'
  })));

  // Solo se borran los servicios que sí se convirtieron
  await SolicitudServicio.deleteMany({ _id: { $in: carrito.map((i) => i._id) }, clienteId });

  return { creadas: nuevas.length, solicitudes: nuevas };
}

module.exports = {
  precioReferencia,
  validarDatosServicio,
  obtenerCarrito,
  agregarAlCarrito,
  confirmarCarrito
};
