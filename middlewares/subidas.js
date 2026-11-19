// middlewares/subidas.js
// Subida segura de fotos de evidencia (web y app móvil).
// Solo JPG, PNG o WEBP de máximo 5 MB; la extensión la decide el servidor
// según el tipo real del archivo, nunca el nombre que manda el usuario.

const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');

const TIPOS_PERMITIDOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/solicitudes'),
  filename: (req, file, cb) =>
    cb(null, 'praxo_foto_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex') + TIPOS_PERMITIDOS[file.mimetype])
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 20 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      const err = new Error('Solo se permiten imágenes JPG, PNG o WEBP.');
      err.code = 'TIPO_NO_PERMITIDO';
      return cb(err);
    }
    cb(null, true);
  }
});

// Revisa la "firma" real del archivo (primeros bytes) para confirmar que es imagen
function esImagenReal(rutaArchivo) {
  try {
    const fd = fs.openSync(rutaArchivo, 'r');
    const b = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 12, 0);
    fs.closeSync(fd);
    const jpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
    const png = b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    const webp = b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
    return jpg || png || webp;
  } catch (e) {
    return false;
  }
}

// formato: 'texto' (web) o 'json' (API de la app)
function subirEvidencia(formato = 'texto') {
  const responder = (res, mensaje) =>
    formato === 'json' ? res.status(400).json({ mensaje }) : res.status(400).send(mensaje);

  return (req, res, next) => {
    upload.single('imagenEvidencia')(req, res, (err) => {
      if (err) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen pesa más de 5 MB.'
          : (err.code === 'TIPO_NO_PERMITIDO' ? err.message : 'No se pudo subir la imagen.');
        return responder(res, mensaje);
      }
      if (req.file && !esImagenReal(req.file.path)) {
        fs.unlink(req.file.path, () => {});
        return responder(res, 'El archivo no es una imagen válida.');
      }
      next();
    });
  };
}

module.exports = { subirEvidencia, esImagenReal };
