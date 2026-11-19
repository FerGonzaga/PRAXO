// src/utils/web.js
// Abre páginas de la web de PRAXO dentro de la app (términos, chat, pago...).

import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '../config';
import { colores } from '../theme';

export function abrirWeb(urlORuta) {
  const url = /^https?:\/\//.test(urlORuta) ? urlORuta : `${API_URL}${urlORuta}`;
  return WebBrowser.openBrowserAsync(url, {
    toolbarColor: colores.azul,
    controlsColor: colores.naranja,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET
  });
}
