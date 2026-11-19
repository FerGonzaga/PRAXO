// App.js — punto de entrada de la app móvil de PRAXO (clientes y prestadores).

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CarritoProvider } from './src/context/CarritoContext';
import { ConfigProvider } from './src/context/ConfigContext';
import Navegacion from './src/navigation/Navegacion';

export default function App() {
  return (
    <SafeAreaProvider>
      <ConfigProvider>
        <AuthProvider>
          <CarritoProvider>
            <StatusBar style="light" />
            <Navegacion />
          </CarritoProvider>
        </AuthProvider>
      </ConfigProvider>
    </SafeAreaProvider>
  );
}
