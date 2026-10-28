// services/cifrado.js
// Cifrado simétrico AES-256-GCM para datos sensibles guardados en MongoDB
// (identificadores de transacciones de pago).
//
// Llave: DATA_ENCRYPTION_KEY (64 caracteres hex = 32 bytes).
// Si no existe, se deriva de SESSION_SECRET con scrypt.
// Generar una:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const crypto = require('crypto');

function obtenerLlave() {
  const hex = (process.env.DATA_ENCRYPTION_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  return crypto.scryptSync(process.env.SESSION_SECRET || 'praxo-clave-desarrollo', 'praxo-cifrado-datos', 32);
}

const LLAVE = obtenerLlave();

// Devuelve "v1:iv:tag:texto" en base64
function cifrar(texto) {
  if (texto === undefined || texto === null || texto === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', LLAVE, iv);
  const cifrado = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), cifrado.toString('base64')].join(':');
}

function descifrar(valor) {
  if (!valor || typeof valor !== 'string' || !valor.startsWith('v1:')) return valor || null;
  try {
    const [, iv, tag, datos] = valor.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', LLAVE, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(datos, 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    return null; // llave distinta o dato alterado
  }
}

module.exports = { cifrar, descifrar };
