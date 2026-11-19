// src/screens/PerfilScreen.js

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Avatar, Boton, Tarjeta } from '../components/ui';
import { colores } from '../theme';
import { abrirWeb } from '../utils/web';

const ENLACES = [
  { icono: 'time-outline', texto: 'Historial completo', ruta: '/historial' },
  { icono: 'shield-checkmark-outline', texto: 'Centro de privacidad', ruta: '/perfil/privacidad' },
  { icono: 'document-lock-outline', texto: 'Aviso de privacidad', ruta: '/aviso-privacidad' },
  { icono: 'bag-check-outline', texto: 'Políticas de compra', ruta: '/politicas' },
  { icono: 'document-text-outline', texto: 'Términos y condiciones', ruta: '/terminos' },
  { icono: 'chatbubbles-outline', texto: 'Contacto', ruta: '/contacto' }
];

export default function PerfilScreen() {
  const { usuario, cerrarSesion, cerrarEnTodos } = useAuth();

  const salirDeTodos = () =>
    Alert.alert('Cerrar sesión en todos los dispositivos', 'Tendrás que volver a iniciar sesión en cada teléfono donde uses PRAXO.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar en todos', style: 'destructive', onPress: () => cerrarEnTodos() }
    ]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Tarjeta estilo={{ alignItems: 'center' }}>
        <Avatar nombre={usuario.nombre} tamano={80} />
        <Text style={st.nombre}>{usuario.nombre}</Text>
        <Text style={st.gris}>{usuario.correo}</Text>
        <Text style={st.tipo}>Cliente</Text>
      </Tarjeta>

      <Tarjeta estilo={{ marginTop: 14, padding: 0 }}>
        {ENLACES.map((e, i) => (
          <Pressable key={e.ruta} onPress={() => abrirWeb(e.ruta)}
            style={({ pressed }) => [st.enlace, i > 0 && st.separador, pressed && { backgroundColor: colores.fondo }]}>
            <Ionicons name={e.icono} size={20} color={colores.azul} />
            <Text style={st.enlaceTexto}>{e.texto}</Text>
            <Ionicons name="open-outline" size={16} color={colores.gris} />
          </Pressable>
        ))}
      </Tarjeta>

      <Boton titulo="Cerrar sesión" variante="oscuro" icono="log-out-outline" onPress={cerrarSesion} estilo={{ marginTop: 20 }} />
      <Boton titulo="Cerrar sesión en todos los dispositivos" variante="peligro" onPress={salirDeTodos} estilo={{ marginTop: 10 }} />

      <Text style={st.version}>PRAXO para clientes · versión 1.0.0</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  nombre: { fontSize: 20, fontWeight: '800', color: colores.texto, marginTop: 10 },
  gris: { color: colores.gris, marginTop: 2 },
  tipo: { marginTop: 8, backgroundColor: colores.azulSuave, color: colores.azul, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, overflow: 'hidden' },
  enlace: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde },
  enlaceTexto: { flex: 1, marginLeft: 12, fontSize: 15, color: colores.texto },
  version: { textAlign: 'center', color: colores.gris, fontSize: 12, marginTop: 24 }
});
