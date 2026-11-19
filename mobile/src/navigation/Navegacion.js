// src/navigation/Navegacion.js
// Sin sesión: Login / Registro.
// Cliente:   Inicio · Buscar · Carrito · Mis servicios · Perfil
// Prestador: Solicitudes · Mi perfil
// Ambos:     detalle del servicio con chat (Servicio), perfil público (Trabajador)

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
import ServicioScreen from '../screens/ServicioScreen';
import PagoSimuladoScreen from '../screens/PagoSimuladoScreen';
import BandejaScreen from '../screens/BandejaScreen';
import PerfilPrestadorScreen from '../screens/PerfilPrestadorScreen';

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
  Perfil: 'person-circle',
  Bandeja: 'file-tray-full',
  MiPerfil: 'construct'
};

function opcionesPestanas({ route }) {
  return {
    ...encabezado,
    tabBarActiveTintColor: colores.naranjaOscuro,
    tabBarInactiveTintColor: colores.gris,
    tabBarIcon: ({ color, size, focused }) => (
      <Ionicons name={focused ? ICONOS[route.name] : `${ICONOS[route.name]}-outline`} size={size} color={color} />
    )
  };
}

function PestanasCliente() {
  const { cantidad } = useCarrito();
  return (
    <Pestanas.Navigator screenOptions={opcionesPestanas}>
      <Pestanas.Screen name="Inicio" component={InicioScreen} options={{ title: 'PRAXO' }} />
      <Pestanas.Screen name="Buscar" component={BuscarScreen} options={{ title: 'Buscar' }} />
      <Pestanas.Screen name="Carrito" component={CarritoScreen}
        options={{ title: 'Carrito', tabBarBadge: cantidad > 0 ? cantidad : undefined }} />
      <Pestanas.Screen name="MisServicios" component={MisServiciosScreen} options={{ title: 'Mis servicios' }} />
      <Pestanas.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil' }} />
    </Pestanas.Navigator>
  );
}

function PestanasPrestador() {
  return (
    <Pestanas.Navigator screenOptions={opcionesPestanas}>
      <Pestanas.Screen name="Bandeja" component={BandejaScreen} options={{ title: 'Solicitudes' }} />
      <Pestanas.Screen name="MiPerfil" component={PerfilPrestadorScreen} options={{ title: 'Mi perfil' }} />
    </Pestanas.Navigator>
  );
}

export default function Navegacion() {
  const { usuario, iniciando } = useAuth();

  if (iniciando) return <Cargando texto="Abriendo PRAXO…" />;

  const esPrestador = usuario && usuario.tipoUsuario === 'prestador';

  return (
    <NavigationContainer theme={tema}>
      <Pila.Navigator screenOptions={encabezado}>
        {usuario ? (
          <>
            <Pila.Screen name="Principal" component={esPrestador ? PestanasPrestador : PestanasCliente} options={{ headerShown: false }} />
            <Pila.Screen name="Servicio" component={ServicioScreen} options={{ title: 'Servicio' }} />
            <Pila.Screen name="Trabajador" component={TrabajadorScreen} options={{ title: 'Profesional' }} />
            {!esPrestador ? (
              <>
                <Pila.Screen name="Solicitar" component={SolicitarScreen} options={{ title: 'Solicitar servicio' }} />
                <Pila.Screen name="PagoSimulado" component={PagoSimuladoScreen} options={{ title: 'Pago' }} />
              </>
            ) : null}
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
