// config/tarifas.js
// Reglas de cobro de PRAXO.
//
//   Precio del prestador (lo que él recibe íntegro)
// + Comisión PRAXO (COMISION_PORCENTAJE % del precio)
// + IVA 16 % sobre la comisión (el IVA se traslada al SAT)
// = Total que paga el cliente
//
// Para cambiar la comisión sin tocar código: COMISION_PORCENTAJE=12 en el .env

const COMISION_PORCENTAJE = Number(process.env.COMISION_PORCENTAJE || 10);
const IVA_PORCENTAJE = 16;

function redondear(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function calcularDesglose(precioPrestador) {
  const precio = redondear(Number(precioPrestador) || 0);
  const comision = redondear(precio * COMISION_PORCENTAJE / 100);
  const ivaComision = redondear(comision * IVA_PORCENTAJE / 100);

  return {
    precioPrestador: precio,
    comisionPorcentaje: COMISION_PORCENTAJE,
    comision,
    ivaPorcentaje: IVA_PORCENTAJE,
    ivaComision,
    total: redondear(precio + comision + ivaComision)
  };
}

// Usa el desglose guardado en la solicitud (el que se pactó al cotizar).
// Las solicitudes antiguas no lo tienen: se calcula al vuelo.
function desgloseDeSolicitud(solicitud) {
  if (solicitud && solicitud.desglose && typeof solicitud.desglose.total === 'number') {
    return solicitud.desglose;
  }
  return calcularDesglose(solicitud ? solicitud.precioAcordado : 0);
}

const _fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
function formatoMXN(n) {
  return _fmt.format(Number(n) || 0);
}

module.exports = {
  COMISION_PORCENTAJE,
  IVA_PORCENTAJE,
  calcularDesglose,
  desgloseDeSolicitud,
  formatoMXN
};
