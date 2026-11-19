// src/context/CarritoContext.js
// Número de servicios en el carrito (para el globo de la pestaña).

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../api/cliente';

const CarritoContext = createContext(null);

export function CarritoProvider({ children }) {
  const [cantidad, setCantidad] = useState(0);

  // Solo los clientes tienen carrito; para prestadores no se consulta
  const refrescarCantidad = useCallback(async (tipoUsuario) => {
    if (tipoUsuario && tipoUsuario !== 'cliente') return;
    try {
      const { items } = await api('/carrito');
      setCantidad(items.length);
    } catch (e) {
      // no es crítico
    }
  }, []);

  const valor = useMemo(() => ({ cantidad, setCantidad, refrescarCantidad }), [cantidad, refrescarCantidad]);
  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  return useContext(CarritoContext);
}
