// services/comprobante.js
// Comprobante de pago (ticket PDF). Compartido por la web y la app.

const { generarTicketPdf } = require('./ticketPdf');

// solicitud debe venir con populate('clienteId','nombre') y populate('trabajadorId','nombre oficio usuarioId')
function puedeVerComprobante(solicitud, usuario) {
  const esCliente = usuario.tipoUsuario === 'cliente' &&
    solicitud.clienteId && String(solicitud.clienteId._id) === String(usuario.id);
  const esPrestador = usuario.tipoUsuario === 'prestador' &&
    solicitud.trabajadorId && String(solicitud.trabajadorId.usuarioId) === String(usuario.id);
  return esCliente || esPrestador;
}

// Devuelve { pdf (Buffer), nombre } o null si la solicitud no tiene pago
function generarComprobante(solicitud) {
  if (!solicitud || !solicitud.pago || !solicitud.pago.referencia) return null;

  const p = solicitud.pago;
  // Pagos hechos antes de existir la comisión: se muestran tal cual se cobraron
  const desglose = typeof p.precioPrestador === 'number'
    ? {
        precioPrestador: p.precioPrestador, comisionPorcentaje: p.comisionPorcentaje,
        comision: p.comision, ivaPorcentaje: p.ivaPorcentaje, ivaComision: p.ivaComision, total: p.monto
      }
    : { precioPrestador: p.monto, comisionPorcentaje: 0, comision: 0, ivaPorcentaje: 16, ivaComision: 0, total: p.monto };

  const fechaMx = (f) => new Date(f).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const pdf = generarTicketPdf({
    referencia: p.referencia,
    fechaPago: fechaMx(p.fecha),
    estado: solicitud.estado === 'Completada' ? 'PAGADO / COMPLETADO' : 'PAGADO',
    cliente: solicitud.clienteId ? solicitud.clienteId.nombre : 'Cliente PRAXO',
    prestador: solicitud.trabajadorId ? solicitud.trabajadorId.nombre : 'Profesional PRAXO',
    oficio: solicitud.trabajadorId ? solicitud.trabajadorId.oficio : '',
    servicio: solicitud.servicio,
    fechaServicio: [solicitud.fecha, solicitud.hora].filter(Boolean).join(' '),
    ubicacion: solicitud.ubicacion,
    desglose,
    metodo: `${p.marca || 'Tarjeta'} **** ${p.ultimos4 || '----'} (${p.proveedor === 'stripe' ? 'Stripe test' : 'simulado'})`
  });

  return { pdf, nombre: `Comprobante-${p.referencia}.pdf` };
}

module.exports = { puedeVerComprobante, generarComprobante };
