// src/context/AuthContext.js
// Sesión del cliente: el token se guarda cifrado en el teléfono (SecureStore).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, establecerToken, alSesionExpirada } from '../api/cliente';

const LLAVE_TOKEN = 'praxo_token';
const LLAVE_USUARIO = 'praxo_usuario';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [iniciando, setIniciando] = useState(true);

  const cerrarSesion = useCallback(async () => {
    establecerToken(null);
    setUsuario(null);
    await SecureStore.deleteItemAsync(LLAVE_TOKEN);
    await SecureStore.deleteItemAsync(LLAVE_USUARIO);
  }, []);

  // Al abrir la app: recuperar la sesión guardada y validarla con el servidor
  useEffect(() => {
    alSesionExpirada(() => { cerrarSesion(); });

    (async () => {
      try {
        const token = await SecureStore.getItemAsync(LLAVE_TOKEN);
        const guardado = await SecureStore.getItemAsync(LLAVE_USUARIO);
        if (token) {
          establecerToken(token);
          if (guardado) setUsuario(JSON.parse(guardado));
          try {
            const { usuario: u } = await api('/auth/yo');
            setUsuario(u);
          } catch (e) {
            // Sin internet se conserva la sesión guardada; si el token
            // ya no es válido, alSesionExpirada la cierra.
          }
        }
      } finally {
        setIniciando(false);
      }
    })();
  }, [cerrarSesion]);

  const iniciarSesion = useCallback(async (correo, password) => {
    const { token, usuario: u } = await api('/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correo.trim(), password }
    });
    establecerToken(token);
    await SecureStore.setItemAsync(LLAVE_TOKEN, token);
    await SecureStore.setItemAsync(LLAVE_USUARIO, JSON.stringify(u));
    setUsuario(u);
  }, []);

  const cerrarEnTodos = useCallback(async () => {
    try {
      await api('/auth/cerrar-sesiones', { metodo: 'POST' });
    } finally {
      await cerrarSesion();
    }
  }, [cerrarSesion]);

  const valor = useMemo(
    () => ({ usuario, iniciando, iniciarSesion, cerrarSesion, cerrarEnTodos }),
    [usuario, iniciando, iniciarSesion, cerrarSesion, cerrarEnTodos]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
