// services/jwt.js
// Tokens JWT (HS256) para la app móvil, implementados con "crypto" de Node.
// La web sigue usando la sesión con cookie; la app usa este token.
//
// Llave: JWT_SECRET en el .env / Render. Si no existe, se deriva de SESSION_SECRET.
// Generar una:  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

const crypto = require('crypto');

const DURACION_SEG = 60 * 60 * 24 * 30; // 30 días

const SECRETO = process.env.JWT_SECRET
  ? Buffer.from(process.env.JWT_SECRET)
  : crypto.scryptSync(process.env.SESSION_SECRET || 'praxo-clave-desarrollo', 'praxo-jwt', 32);

if (!process.env.JWT_SECRET && (process.env.NODE_ENV === 'production' || process.env.RENDER)) {
  console.warn('⚠️  Falta JWT_SECRET en producción: los tokens de la app usan una llave derivada.');
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const firmar = (datos) => crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url');

function crearToken(datos) {
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64({ alg: 'HS256', typ: 'JWT' });
  const cuerpo = b64({ ...datos, iat: ahora, exp: ahora + DURACION_SEG });
  return `${cabecera}.${cuerpo}.${firmar(`${cabecera}.${cuerpo}`)}`;
}

// Devuelve el contenido del token o null si es inválido / expiró
function verificarToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [cabecera, cuerpo, firma] = partes;
  const esperada = firmar(`${cabecera}.${cuerpo}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const cab = JSON.parse(Buffer.from(cabecera, 'base64url').toString());
    if (cab.alg !== 'HS256') return null; // nunca aceptar "alg: none" u otros
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
    if (!datos.exp || datos.exp < Math.floor(Date.now() / 1000)) return null;
    return datos;
  } catch (e) {
    return null;
  }
}

module.exports = { crearToken, verificarToken, DURACION_SEG };
