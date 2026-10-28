// services/ticketPdf.js
// Genera el comprobante de pago (ticket) en PDF SIN librerías externas.
// Formato de ticket de 80 mm con tipografía Courier (como una impresora térmica).

const ANCHO = 227;          // 80 mm en puntos
const MARGEN = 12;
const ANCHO_UTIL = ANCHO - MARGEN * 2;
const ANCHO_CARACTER = 0.6; // Courier: cada carácter mide 0.6 × tamaño de letra

// ---------- Texto en WinAnsi (acentos y ñ) ----------
const ESPECIALES = { '€': 0x80, '•': 0x95, '–': 0x96, '—': 0x97, '“': 0x93, '”': 0x94, '‘': 0x91, '’': 0x92 };

function aWinAnsi(texto) {
  let salida = '';
  for (const ch of String(texto == null ? '' : texto)) {
    const code = ch.codePointAt(0);
    let b;
    if (ESPECIALES[ch]) b = ESPECIALES[ch];
    else if (code >= 32 && code < 127) b = code;
    else if (code >= 160 && code <= 255) b = code;
    else b = 63; // '?' (emojis y otros símbolos)
    const c = String.fromCharCode(b);
    salida += (c === '(' || c === ')' || c === '\\') ? '\\' + c : c;
  }
  return salida;
}

function partirTexto(texto, maxChars) {
  const palabras = String(texto || '').replace(/\s+/g, ' ').trim().split(' ');
  const lineas = [];
  let actual = '';
  for (let p of palabras) {
    while (p.length > maxChars) { // palabras larguísimas
      if (actual) { lineas.push(actual); actual = ''; }
      lineas.push(p.slice(0, maxChars));
      p = p.slice(maxChars);
    }
    if (!actual) actual = p;
    else if ((actual + ' ' + p).length <= maxChars) actual += ' ' + p;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [''];
}

// ---------- Código de barras Code 39 (decorativo, con la referencia) ----------
const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw', 'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn', 'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww', 'O': 'wnnnwnnwn',
  'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn', 'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn',
  'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw', 'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn', '-': 'nwnnnnwnw', '*': 'nwnnwnwnn'
};

function barrasCode39(texto) {
  const limpio = '*' + String(texto).toUpperCase().replace(/[^0-9A-Z-]/g, '') + '*';
  const barras = []; // [inicio, ancho] en módulos
  let x = 0;
  for (const ch of limpio) {
    const patron = CODE39[ch];
    for (let i = 0; i < 9; i++) {
      const w = patron[i] === 'w' ? 2.5 : 1;
      if (i % 2 === 0) barras.push([x, w]);
      x += w;
    }
    x += 1; // separación entre caracteres
  }
  return { barras, modulos: x - 1 };
}

// ---------- Construcción del ticket ----------
function generarTicketPdf(datos) {
  const d = datos.desglose;
  const fmt = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Cada elemento: {tipo, ...}; primero se calcula la altura total.
  const items = [];
  const texto = (t, o = {}) => items.push({ tipo: 'texto', t, size: o.size || 8, bold: !!o.bold, align: o.align || 'left', alto: (o.size || 8) + 3 });
  const parrafo = (t, o = {}) => {
    const size = o.size || 8;
    const max = Math.floor(ANCHO_UTIL / (size * ANCHO_CARACTER));
    partirTexto(t, max).forEach(l => texto(l, o));
  };
  const etiquetaValor = (etiqueta, valor, o = {}) => {
    const size = o.size || 8;
    const max = Math.floor(ANCHO_UTIL / (size * ANCHO_CARACTER));
    const lineas = partirTexto(valor, max - 2);
    texto(etiqueta, { size: 7, bold: true });
    lineas.forEach(l => texto('  ' + l, { size }));
  };
  const fila = (izq, der, o = {}) => items.push({ tipo: 'fila', izq, der, size: o.size || 8, bold: !!o.bold, alto: (o.size || 8) + 4 });
  const linea = (estilo = 'guiones') => items.push({ tipo: 'linea', estilo, alto: 9 });
  const espacio = (h = 6) => items.push({ tipo: 'espacio', alto: h });

  texto('PRAXO', { size: 22, bold: true, align: 'center' });
  espacio(2);
  texto('Find. Connect. Solve.', { size: 7, align: 'center' });
  texto('Marketplace de servicios', { size: 7, align: 'center' });
  espacio(4);
  texto('COMPROBANTE DE PAGO', { size: 10, bold: true, align: 'center' });
  linea();
  fila('Referencia:', datos.referencia, { bold: true });
  fila('Fecha de pago:', datos.fechaPago);
  fila('Estado:', datos.estado);
  linea();
  etiquetaValor('CLIENTE', datos.cliente);
  etiquetaValor('PRESTADOR', datos.prestador + (datos.oficio ? ' (' + datos.oficio + ')' : ''));
  etiquetaValor('SERVICIO', datos.servicio);
  if (datos.fechaServicio) etiquetaValor('FECHA DEL SERVICIO', datos.fechaServicio);
  etiquetaValor('UBICACIÓN', datos.ubicacion);
  linea();
  fila('Servicio (prestador)', fmt(d.precioPrestador));
  fila('Comisión PRAXO ' + d.comisionPorcentaje + '%', fmt(d.comision));
  fila('IVA ' + d.ivaPorcentaje + '% s/comisión', fmt(d.ivaComision));
  linea('doble');
  fila('TOTAL MXN', fmt(d.total), { size: 11, bold: true });
  linea();
  fila('Método:', datos.metodo);
  linea();
  texto('GARANTÍA PRAXO', { size: 9, bold: true, align: 'center' });
  espacio(2);
  parrafo('Este comprobante ampara el pago del servicio descrito por el monto indicado. Consérvalo: es tu respaldo para cualquier aclaración, cancelación o reclamo ante PRAXO.', { size: 7 });
  espacio(4);
  items.push({ tipo: 'barras', alto: 44 });
  texto(datos.referencia, { size: 7, align: 'center' });
  espacio(4);
  parrafo('Comprobante con fines académicos. No es un CFDI ni tiene validez fiscal.', { size: 6, align: 'center' });
  espacio(4);
  texto('¡Gracias por usar PRAXO!', { size: 8, bold: true, align: 'center' });

  const ALTO = MARGEN * 2 + items.reduce((s, i) => s + i.alto, 0);

  // ---------- Dibujar (coordenadas PDF: origen abajo a la izquierda) ----------
  const ops = [];
  let y = ALTO - MARGEN;
  const fuente = (bold) => (bold ? '/F2' : '/F1');
  const anchoTexto = (t, size) => String(t).length * size * ANCHO_CARACTER;
  const escribir = (t, x, yBase, size, bold) =>
    ops.push(`BT ${fuente(bold)} ${size} Tf ${x.toFixed(2)} ${yBase.toFixed(2)} Td (${aWinAnsi(t)}) Tj ET`);

  for (const it of items) {
    if (it.tipo === 'texto') {
      const base = y - it.size;
      let x = MARGEN;
      if (it.align === 'center') x = (ANCHO - anchoTexto(it.t, it.size)) / 2;
      escribir(it.t, x, base, it.size, it.bold);
    } else if (it.tipo === 'fila') {
      const base = y - it.size;
      escribir(it.izq, MARGEN, base, it.size, it.bold);
      escribir(it.der, ANCHO - MARGEN - anchoTexto(it.der, it.size), base, it.size, it.bold);
    } else if (it.tipo === 'linea') {
      const ly = y - it.alto / 2;
      if (it.estilo === 'doble') {
        ops.push(`[] 0 d 0.8 w ${MARGEN} ${ly + 1.2} m ${ANCHO - MARGEN} ${ly + 1.2} l S ${MARGEN} ${ly - 1.2} m ${ANCHO - MARGEN} ${ly - 1.2} l S`);
      } else {
        ops.push(`[2 2] 0 d 0.6 w ${MARGEN} ${ly} m ${ANCHO - MARGEN} ${ly} l S [] 0 d`);
      }
    } else if (it.tipo === 'barras') {
      const { barras, modulos } = barrasCode39(datos.referencia);
      const modulo = Math.min(1, ANCHO_UTIL / modulos);
      const x0 = (ANCHO - modulos * modulo) / 2;
      const alto = it.alto - 6;
      const rects = barras.map(([bx, bw]) => `${(x0 + bx * modulo).toFixed(2)} ${(y - alto - 3).toFixed(2)} ${(bw * modulo).toFixed(2)} ${alto} re`).join(' ');
      ops.push(`0 g ${rects} f`);
    }
    y -= it.alto;
  }

  const contenido = ops.join('\n');

  // ---------- Ensamblar el archivo PDF ----------
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(contenido, 'latin1')} >>\nstream\n${contenido}\nendstream`,
    `<< /Title (${aWinAnsi('Comprobante ' + datos.referencia)}) /Producer (PRAXO) /Creator (PRAXO) >>`
  ];

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objetos.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info ${objetos.length} 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

module.exports = { generarTicketPdf };
