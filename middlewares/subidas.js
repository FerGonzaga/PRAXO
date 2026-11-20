// middlewares/subidas.js
// Subida segura de fotos de evidencia (web y app móvil).
//
// Acepta JPG, PNG, WEBP y HEIC/HEIF (formato de fotos del iPhone), máximo 5 MB.
// - El tipo se confirma por el CONTENIDO real del archivo (primeros bytes),
//   no por el nombre ni por lo que diga el teléfono.
// - Las fotos HEIC se convierten a JPG al guardarse: Chrome, Edge y Firefox
//   no muestran HEIC, y así la foto se ve en cualquier navegador y en la app.
//   (requiere el paquete "heic-convert": npm install heic-convert)

const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TAMANO_MAXIMO = 5 * 1024 * 1024;

// Tipos que el teléfono/navegador puede declarar
const TIPOS_DECLARADOS = new Set([
  'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp',
  'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'
]);
const EXT_HEIC = /\.(heic|heif)$/i;

let convertirHeic = null;
try {
  convertirHeic = require('heic-convert');
} catch (e) {
  console.warn('⚠️  Falta el paquete "heic-convert": las fotos HEIC se guardarán sin convertir (no se verán en Chrome). Ejecuta: npm install heic-convert');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/solicitudes'),
  // Nombre temporal sin extensión; la extensión final se pone al confirmar el tipo real
  filename: (req, file, cb) => cb(null, 'praxo_foto_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex'))
});

const upload = multer({
  storage,
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 20 },
  fileFilter: (req, file, cb) => {
    // Algunos iPhone mandan HEIC como "application/octet-stream": se acepta si el nombre es .heic/.heif
    const declarado = TIPOS_DECLARADOS.has(String(file.mimetype).toLowerCase()) ||
      (file.mimetype === 'application/octet-stream' && EXT_HEIC.test(file.originalname || ''));
    if (!declarado) {
      const err = new Error('Solo se permiten imágenes JPG, PNG, WEBP o HEIC (iPhone).');
      err.code = 'TIPO_NO_PERMITIDO';
      return cb(err);
    }
    cb(null, true);
  }
});

// Detecta el tipo REAL por los primeros bytes: 'jpg' | 'png' | 'webp' | 'heic' | null
function detectarTipo(rutaArchivo) {
  try {
    const fd = fs.openSync(rutaArchivo, 'r');
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0);
    fs.closeSync(fd);

    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
    // HEIC/HEIF: "ftyp" en el byte 4 y una marca de imagen HEIF
    if (b.subarray(4, 8).toString('latin1') === 'ftyp') {
      const marca = b.subarray(8, 12).toString('latin1');
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(marca)) return 'heic';
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Compatibilidad con código anterior
function esImagenReal(rutaArchivo) {
  return detectarTipo(rutaArchivo) !== null;
}

// Renombra el archivo con su extensión real y actualiza el objeto archivo
function ponerExtension(archivo, extension, mimetype) {
  const destino = archivo.path + extension;
  fs.renameSync(archivo.path, destino);
  archivo.path = destino;
  archivo.filename = path.basename(destino);
  archivo.mimetype = mimetype;
}

// Confirma el tipo real, pone la extensión y convierte HEIC -> JPG.
// Devuelve null si todo bien, o el mensaje de error.
async function procesarArchivo(archivo) {
  const tipo = detectarTipo(archivo.path);
  if (!tipo) return 'El archivo no es una imagen válida.';

  if (tipo !== 'heic') {
    const mimes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    ponerExtension(archivo, '.' + tipo, mimes[tipo]);
    return null;
  }

  // HEIC -> JPG
  if (!convertirHeic) {
    ponerExtension(archivo, '.heic', 'image/heic');
    return null;
  }
  try {
    const original = await fs.promises.readFile(archivo.path);
    const jpg = Buffer.from(await convertirHeic({ buffer: original, format: 'JPEG', quality: 0.8 }));
    const destino = archivo.path + '.jpg';
    await fs.promises.writeFile(destino, jpg);
    // Borrar el HEIC original; si no se puede, la conversión igual es válida
    fs.promises.unlink(archivo.path).catch((e) => console.warn('No se pudo borrar el HEIC original:', e.message));
    archivo.path = destino;
    archivo.filename = path.basename(destino);
    archivo.mimetype = 'image/jpeg';
    archivo.size = jpg.length;
    return null;
  } catch (e) {
    console.error('No se pudo convertir la foto HEIC:', e.message);
    return 'No pudimos procesar la foto. Intenta con otra imagen.';
  }
}

// ---------------------------------------------------------------
// FOTO EN TEXTO (base64) — la usa la app móvil.
// El iPhone envía las peticiones JSON sin problema en cualquier red;
// así evitamos los fallos de "multipart" al subir archivos.
// Devuelve { filename } o { error }
// ---------------------------------------------------------------
async function guardarImagenBase64(base64) {
  if (typeof base64 !== 'string' || !base64) return { error: 'No se recibió la foto.' };

  const limpio = base64.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(limpio)) return { error: 'La foto no tiene un formato válido.' };

  const datos = Buffer.from(limpio, 'base64');
  if (datos.length === 0) return { error: 'La foto está vacía.' };
  if (datos.length > TAMANO_MAXIMO) return { error: 'La imagen pesa más de 5 MB.' };

  const archivo = {
    path: path.join('public/uploads/solicitudes', 'praxo_foto_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex')),
    size: datos.length
  };
  await fs.promises.writeFile(archivo.path, datos);

  const problema = await procesarArchivo(archivo);
  if (problema) {
    fs.unlink(archivo.path, () => {});
    return { error: problema };
  }
  return { filename: archivo.filename };
}

// formato: 'texto' (web) o 'json' (API de la app)
function subirEvidencia(formato = 'texto') {
  const responder = (res, mensaje) =>
    formato === 'json' ? res.status(400).json({ mensaje }) : res.status(400).send(mensaje);

  return (req, res, next) => {
    upload.single('imagenEvidencia')(req, res, async (err) => {
      if (err) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen pesa más de 5 MB.'
          : (err.code === 'TIPO_NO_PERMITIDO' ? err.message : 'No se pudo subir la imagen.');
        console.warn('Subida rechazada:', err.code || err.message, req.originalUrl);

        // Si respondemos mientras el teléfono sigue enviando la foto, la conexión se corta
        // y la app solo ve "sin conexión". Primero terminamos de leer (y descartar) la petición.
        if (req.readableEnded) return responder(res, mensaje);
        let respondido = false;
        const responderUnaVez = () => { if (!respondido) { respondido = true; responder(res, mensaje); } };
        req.on('end', responderUnaVez);
        req.on('error', responderUnaVez);
        setTimeout(responderUnaVez, 15000).unref();
        req.resume();
        return undefined;
      }

      if (!req.file) return next();

      const problema = await procesarArchivo(req.file);
      if (problema) {
        fs.unlink(req.file.path, () => {});
        return responder(res, problema);
      }
      next();
    });
  };
}

module.exports = { subirEvidencia, esImagenReal, detectarTipo, guardarImagenBase64, TAMANO_MAXIMO };
