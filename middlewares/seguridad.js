// middlewares/seguridad.js
// Medidas de seguridad de PRAXO (sin dependencias externas):
//   1. Cabeceras HTTP de seguridad (equivalente a lo básico de "helmet")
//   2. Limpieza de entradas contra inyección NoSQL ($ne, $gt, etc.)
//   3. Protección CSRF por verificación de origen
//   4. Límite de intentos (rate limiting) contra fuerza bruta y spam

// -----------------------------------------------------------
// 1. CABECERAS DE SEGURIDAD
// -----------------------------------------------------------
function cabecerasSeguridad({ produccion }) {
  const csp = [
    "object-src 'none'",        // sin plugins (Flash, applets)
    "base-uri 'self'",          // evita secuestro de rutas relativas
    "frame-ancestors 'none'"    // nadie puede meter PRAXO en un iframe (clickjacking)
  ];
  if (produccion) csp.push('upgrade-insecure-requests');

  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp.join('; '));
    res.setHeader('X-Content-Type-Options', 'nosniff');            // no adivinar tipos de archivo
    res.setHeader('X-Frame-Options', 'DENY');                      // clickjacking (navegadores viejos)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  };
}

// -----------------------------------------------------------
// 2. INYECCIÓN NoSQL
// Elimina llaves que empiezan con "$" o contienen "." en el cuerpo
// de la petición, p. ej. { "correo": { "$ne": null } }.
// -----------------------------------------------------------
function limpiarObjeto(obj, profundidad = 0) {
  if (!obj || typeof obj !== 'object' || profundidad > 10) return obj;
  for (const llave of Object.keys(obj)) {
    if (llave.startsWith('$') || llave.includes('.') || llave === '__proto__' || llave === 'constructor') {
      delete obj[llave];
    } else {
      limpiarObjeto(obj[llave], profundidad + 1);
    }
  }
  return obj;
}

function sanitizarEntradas(req, res, next) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    limpiarObjeto(req.body);
  }
  if (req.params) limpiarObjeto(req.params);
  next();
}

// -----------------------------------------------------------
// 3. CSRF: las peticiones que modifican datos deben venir de PRAXO
// Los navegadores envían "Origin" en los POST; si viene de otro sitio
// se rechaza. (Además la cookie de sesión es SameSite=Lax.)
// -----------------------------------------------------------
const RUTAS_EXENTAS = ['/pago/stripe/webhook']; // Stripe firma sus peticiones

function verificarOrigen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || RUTAS_EXENTAS.includes(req.path)) {
    return next();
  }
  const origen = req.get('origin') || req.get('referer');
  if (!origen) return next(); // clientes que no son navegador

  let hostOrigen;
  try {
    hostOrigen = new URL(origen).host;
  } catch (e) {
    hostOrigen = null;
  }
  if (hostOrigen !== req.get('host')) {
    console.warn('Petición bloqueada por origen no permitido:', origen, req.method, req.originalUrl);
    return res.status(403).send('Origen no permitido.');
  }
  next();
}

// -----------------------------------------------------------
// 4. LÍMITE DE INTENTOS (en memoria)
// -----------------------------------------------------------
function limitarIntentos({ ventanaMin, maximo, mensaje, clave }) {
  const registros = new Map();
  const ventanaMs = ventanaMin * 60 * 1000;

  // Limpieza periódica para no acumular memoria
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, r] of registros) if (r.reinicio <= ahora) registros.delete(k);
  }, Math.min(ventanaMs, 10 * 60 * 1000)).unref();

  const middleware = (req, res, next) => {
    if (req.method !== 'POST') return next();

    const k = clave ? clave(req) : req.ip;
    const ahora = Date.now();
    let r = registros.get(k);
    if (!r || r.reinicio <= ahora) {
      r = { conteo: 0, reinicio: ahora + ventanaMs };
      registros.set(k, r);
    }
    r.conteo += 1;

    if (r.conteo > maximo) {
      const segundos = Math.ceil((r.reinicio - ahora) / 1000);
      res.setHeader('Retry-After', segundos);
      const texto = `${mensaje} Intenta de nuevo en ${Math.ceil(segundos / 60)} minuto(s).`;
      const quiereJson = req.originalUrl.startsWith('/api/') || (req.get('accept') || '').includes('json') ||
        req.is('application/json');
      return quiereJson
        ? res.status(429).json({ ok: false, mensaje: texto })
        : res.status(429).send(texto);
    }
    next();
  };

  // Permite borrar el contador (p. ej. tras un inicio de sesión correcto)
  middleware.reiniciar = (req) => registros.delete(clave ? clave(req) : req.ip);
  return middleware;
}

// Limitadores ya configurados para PRAXO
const limitadores = {
  // Fuerza bruta de contraseñas: por IP + correo, y por IP en general
  loginPorCuenta: limitarIntentos({
    ventanaMin: 15, maximo: 5,
    mensaje: 'Demasiados intentos fallidos para esta cuenta.',
    clave: (req) => req.ip + '|' + String((req.body && req.body.correo) || '').trim().toLowerCase()
  }),
  loginPorIp: limitarIntentos({ ventanaMin: 15, maximo: 20, mensaje: 'Demasiados intentos de inicio de sesión.' }),
  registro: limitarIntentos({ ventanaMin: 60, maximo: 5, mensaje: 'Demasiados registros desde esta conexión.' }),
  verificacion: limitarIntentos({ ventanaMin: 15, maximo: 10, mensaje: 'Demasiadas solicitudes de verificación.' }),
  mensajes: limitarIntentos({
    ventanaMin: 1, maximo: 20,
    mensaje: 'Estás enviando mensajes demasiado rápido.',
    clave: (req) => (req.session && req.session.usuario ? req.session.usuario.id : req.ip)
  }),
  pagos: limitarIntentos({ ventanaMin: 10, maximo: 10, mensaje: 'Demasiados intentos de pago.' })
};

module.exports = { cabecerasSeguridad, sanitizarEntradas, verificarOrigen, limitarIntentos, limitadores, limpiarObjeto };
