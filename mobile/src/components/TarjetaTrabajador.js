// src/components/TarjetaTrabajador.js

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Estrellas } from './ui';
import { colores, radio, sombra } from '../theme';
import { formatoMXN } from '../utils/formato';

export default function TarjetaTrabajador({ trabajador: t, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.tarjeta, pressed && { opacity: 0.9 }]}>
      <Avatar nombre={t.nombre} url={t.fotoUrl} tamano={58} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={st.fila}>
          <Text style={st.nombre} numberOfLines={1}>{t.nombre}</Text>
          {t.disponibleAhora ? (
            <View style={st.disponible}><View style={st.punto} /><Text style={st.disponibleTexto}>Disponible</Text></View>
          ) : null}
        </View>
        <Text style={st.oficio}>{t.oficio}{t.ciudad ? ` · ${t.ciudad}` : ''}</Text>
        <View style={[st.fila, { marginTop: 6 }]}>
          {t.calificacion !== null ? (
            <View style={st.fila}>
              <Estrellas valor={t.calificacion} tamano={12} />
              <Text style={st.resenas}> {t.calificacion.toFixed(1)} ({t.totalResenas})</Text>
            </View>
          ) : (
            <Text style={st.resenas}>Nuevo en PRAXO</Text>
          )}
          <Text style={st.precio}>
            {t.precio ? `Desde ${formatoMXN(t.precio.desde)}` : 'A cotizar'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colores.gris} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  tarjeta: { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.blanco, borderRadius: radio, padding: 14, marginBottom: 12, ...sombra },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nombre: { fontSize: 16, fontWeight: '700', color: colores.texto, flexShrink: 1 },
  oficio: { color: colores.gris, marginTop: 2 },
  resenas: { color: colores.gris, fontSize: 12 },
  precio: { fontWeight: '700', color: colores.azul, fontSize: 13 },
  disponible: { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.verdeSuave, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginLeft: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colores.verde, marginRight: 4 },
  disponibleTexto: { color: colores.verde, fontSize: 11, fontWeight: '700' }
});
