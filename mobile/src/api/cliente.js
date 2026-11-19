// src/api/cliente.js
// Única puerta de entrada al servidor de PRAXO (el mismo de la página web).

import { API_URL, TIEMPO_ESPERA_MS } from '../config';

let tokenActual = null;
let alExpirarSesion = null;

export function establecerToken(token) {
  tokenActual = token;
}

// AuthContext registra aquí qué hacer si el servidor dice que el token ya no sirve
export function alSesionExpirada(fn) {
  alExpirarSesion = fn;
}

export async function api(ruta, { metodo = 'GET', cuerpo, formulario } = {}) {
  if (!API_URL) {
    throw new Error('Falta configurar EXPO_PUBLIC_API_URL en mobile/.env');
  }

  const headers = { Accept: 'application/json' };
  if (tokenActual) headers.Authorization = `Bearer ${tokenActual}`;

  let body;
  if (formulario) {
    body = formulario; // FormData: fetch pone el Content-Type con su "boundary"
  } else if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_ESPERA_MS);

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}/api/v1${ruta}`, { method: metodo, headers, body, signal: control.signal });
  } catch (e) {
    throw new Error(
      e.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Intenta de nuevo.'
        : 'No hay conexión con PRAXO. Revisa tu internet e intenta de nuevo.'
    );
  } finally {
    clearTimeout(temporizador);
  }

  let datos = {};
  try {
    datos = await respuesta.json();
  } catch (e) {
    // respuesta sin JSON (p. ej. el servidor está iniciando)
  }

  if (respuesta.status === 401 && tokenActual && alExpirarSesion) {
    alExpirarSesion();
  }
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || `Ocurrió un error (${respuesta.status}). Intenta de nuevo.`);
  }
  return datos;
}
