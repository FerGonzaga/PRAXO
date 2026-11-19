// src/utils/password.js
// Reglas de contraseña: IGUALES a la web (public/js/auth.js) y al servidor (services/password.js).

export const REQUISITOS = [
  { id: 'longitud', texto: '8 caracteres o más', cumple: (p) => p.length >= 8 },
  { id: 'mayuscula', texto: 'Una mayúscula', cumple: (p) => /\p{Lu}/u.test(p) },
  { id: 'numero', texto: 'Un número', cumple: (p) => /\p{N}/u.test(p) },
  { id: 'especial', texto: 'Un carácter especial (!@#$%&*?)', cumple: (p) => /[^\p{L}\p{N}\s]/u.test(p) }
];

const COMUNES = [
  'password', 'contraseña', 'contrasena', '12345678', '123456789', '1234567890', 'qwerty', 'qwertyuiop',
  'abc12345', 'admin', 'administrador', 'iloveyou', 'teamo', 'praxo', 'mexico', 'bienvenido', 'welcome'
];

export const NIVELES = [
  { texto: 'Muy débil', color: '#dc3545', ancho: 15 },
  { texto: 'Débil', color: '#fd7e14', ancho: 35 },
  { texto: 'Regular', color: '#e0a800', ancho: 60 },
  { texto: 'Buena', color: '#5cb85c', ancho: 80 },
  { texto: 'Fuerte', color: '#198754', ancho: 100 }
];

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function esComun(p) {
  const n = normalizar(p);
  const nucleo = n.replace(/[^a-zñ]/g, '');
  return COMUNES.some((c) => n === c || (nucleo.length >= 4 && nucleo === normalizar(c)));
}

function tieneDatosPersonales(p, nombre, correo) {
  const n = normalizar(p);
  const piezas = [];
  String(nombre || '').split(/\s+/).forEach((x) => { if (x.length >= 4) piezas.push(normalizar(x)); });
  const local = String(correo || '').split('@')[0];
  if (local.length >= 4) piezas.push(normalizar(local));
  return piezas.some((x) => n.includes(x));
}

// { cumple: {id: bool}, todos, nivel (-1 a 4), aviso, valida }
export function evaluarPassword(p, nombre, correo) {
  const cumple = {};
  REQUISITOS.forEach((r) => { cumple[r.id] = r.cumple(p); });
  const cuantos = Object.values(cumple).filter(Boolean).length;
  const todos = cuantos === 4;

  if (!p) return { cumple, todos: false, nivel: -1, aviso: '', valida: false };
  if (esComun(p)) return { cumple, todos, nivel: 0, aviso: 'Es una contraseña muy común: elige otra.', valida: false };
  if (tieneDatosPersonales(p, nombre, correo)) {
    return { cumple, todos, nivel: Math.min(1, cuantos), aviso: 'No uses tu nombre ni tu correo en la contraseña.', valida: false };
  }
  if (!todos) return { cumple, todos, nivel: cuantos <= 2 ? 0 : 1, aviso: '', valida: false };

  let nivel = 2;
  if (p.length >= 12) nivel++;
  if (p.length >= 14 && /\p{Ll}/u.test(p)) nivel++;
  if (/(.)\1\1/.test(p) || /(0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/i.test(p)) nivel--;
  nivel = Math.max(1, Math.min(4, nivel));
  const aviso = nivel < 4 ? 'Tip: con 14 caracteres o más (o una frase) será todavía más segura.' : '';
  return { cumple, todos, nivel, aviso, valida: true };
}
