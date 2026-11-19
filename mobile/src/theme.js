// src/theme.js
// Colores y estilos base de PRAXO (los mismos de la web: azul marino + naranja).

export const colores = {
  azul: '#0b1f3a',
  azul700: '#163258',
  azul500: '#28507f',
  naranja: '#f7931e',
  naranjaOscuro: '#b45f06',
  fondo: '#f4f6fa',
  blanco: '#ffffff',
  texto: '#1d2736',
  gris: '#667085',
  borde: '#e3e8ef',
  verde: '#198754',
  verdeSuave: '#e8f6ee',
  rojo: '#dc3545',
  amarillo: '#ffc107',
  azulSuave: '#e8f0fb'
};

export const radio = 14;

export const sombra = {
  shadowColor: '#0b1f3a',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3
};

// Colores de cada estado de la solicitud (iguales a la web)
export const coloresEstado = {
  Pendiente: { fondo: '#fff3cd', texto: '#856404' },
  Cotizada: { fondo: '#d1e7dd', texto: '#0f5132' },
  Aceptada: { fondo: '#cff4fc', texto: '#055160' },
  Rechazada: { fondo: '#e2e3e5', texto: '#41464b' },
  Pagada: { fondo: '#cfe2ff', texto: '#084298' },
  Completada: { fondo: '#d3d3d4', texto: '#141619' }
};
