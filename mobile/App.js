// App.js — punto de entrada de la app móvil de PRAXO (solo clientes).

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CarritoProvider } from './src/context/CarritoContext';
import Navegacion from './src/navigation/Navegacion';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CarritoProvider>
          <StatusBar style="light" />
          <Navegacion />
        </CarritoProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
