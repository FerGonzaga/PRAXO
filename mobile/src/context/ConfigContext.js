// src/context/ConfigContext.js
// Configuración que manda el servidor: comisión, IVA, tipo de pago (Stripe o simulado),
// oficios disponibles y enlaces a páginas legales.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/cliente';

const ConfigContext = createContext({ config: null });

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    api('/config').then(setConfig).catch(() => {
      // Valores por defecto si el servidor aún está despertando
      setConfig({ comisionPorcentaje: 10, ivaPorcentaje: 16, pagos: { stripe: false }, oficios: ['Electricista', 'Plomero', 'Cerrajero', 'Albañil', 'Pintor'] });
    });
  }, []);

  const valor = useMemo(() => ({ config }), [config]);
  return <ConfigContext.Provider value={valor}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  return useContext(ConfigContext);
}
