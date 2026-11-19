// src/utils/formato.js

const _mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function formatoMXN(n) {
  return _mxn.format(Number(n) || 0);
}

// "2026-11-25" -> "25 de noviembre de 2026"
export function fechaLarga(isoDia) {
  if (!isoDia) return '';
  const d = new Date(`${isoDia}T00:00:00`);
  return Number.isNaN(d.getTime()) ? isoDia : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function mesAnio(fecha) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

// Date -> "YYYY-MM-DD" (fecha local, no UTC)
export function aIsoDia(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

// Date -> "HH:MM"
export function aHora(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(fecha.getHours())}:${p(fecha.getMinutes())}`;
}

export function avatarUrl(nombre) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre || 'P')}&background=0b1f3a&color=fff&size=200`;
}
