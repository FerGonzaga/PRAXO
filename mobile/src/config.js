// src/config.js
// La URL del servidor se lee de mobile/.env (EXPO_PUBLIC_API_URL).

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');

// Render gratuito "duerme": la primera petición puede tardar ~50 s
export const TIEMPO_ESPERA_MS = 60000;
