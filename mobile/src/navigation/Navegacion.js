// src/navigation/Navegacion.js
// Sin sesión: Login / Registro. Con sesión: pestañas + pantallas de detalle.

import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useCarrito } from '../context/CarritoContext';
import { colores } from '../theme';
import { Cargando } from '../components/ui';

import LoginScreen from '../screens/LoginScreen';
import RegistroScreen from '../screens/RegistroScreen';
import InicioScreen from '../screens/InicioScreen';
import BuscarScreen from '../screens/BuscarScreen';
import TrabajadorScreen from '../screens/TrabajadorScreen';
import SolicitarScreen from '../screens/SolicitarScreen';
import CarritoScreen from '../screens/CarritoScreen';
import MisServiciosScreen from '../screens/MisServiciosScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Pila = createNativeStackNavigator();
const Pestanas = createBottomTabNavigator();

const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colores.naranja, background: colores.fondo, card: colores.blanco, text: colores.texto }
};

const encabezado = {
  headerStyle: { backgroundColor: colores.azul },
  headerTintColor: colores.blanco,
  headerTitleStyle: { fontWeight: '700' }
};

const ICONOS = {
  Inicio: 'home',
  Buscar: 'search',
  Carrito: 'bag-handle',
  MisServicios: 'receipt',
  Perfil: 'person-circle'
};

function PestanasPrincipales() {
  const { cantidad } = useCarrito();
  return (
    <Pestanas.Navigator
      screenOptions={({ route }) => ({
        ...encabezado,
        tabBarActiveTintColor: colores.naranjaOscuro,
        tabBarInactiveTintColor: colores.gris,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? ICONOS[route.name] : `${ICONOS[route.name]}-outline`} size={size} color={color} />
        )
      })}
    >
      <Pestanas.Screen name="Inicio" component={InicioScreen} options={{ title: 'PRAXO' }} />
      <Pestanas.Screen name="Buscar" component={BuscarScreen} options={{ title: 'Buscar' }} />
      <Pestanas.Screen
        name="Carrito"
        component={CarritoScreen}
        options={{ title: 'Carrito', tabBarBadge: cantidad > 0 ? cantidad : undefined }}
      />
      <Pestanas.Screen name="MisServicios" component={MisServiciosScreen} options={{ title: 'Mis servicios' }} />
      <Pestanas.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil' }} />
    </Pestanas.Navigator>
  );
}

export default function Navegacion() {
  const { usuario, iniciando } = useAuth();

  if (iniciando) return <Cargando texto="Abriendo PRAXO…" />;

  return (
    <NavigationContainer theme={tema}>
      <Pila.Navigator screenOptions={encabezado}>
        {usuario ? (
          <>
            <Pila.Screen name="Principal" component={PestanasPrincipales} options={{ headerShown: false }} />
            <Pila.Screen name="Trabajador" component={TrabajadorScreen} options={{ title: 'Profesional' }} />
            <Pila.Screen name="Solicitar" component={SolicitarScreen} options={{ title: 'Solicitar servicio' }} />
          </>
        ) : (
          <>
            <Pila.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Pila.Screen name="Registro" component={RegistroScreen} options={{ title: 'Crear cuenta' }} />
          </>
        )}
      </Pila.Navigator>
    </NavigationContainer>
  );
}
