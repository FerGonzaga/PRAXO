// src/screens/BuscarScreen.js

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { Aviso, Cargando, EstadoVacio } from '../components/ui';
import TarjetaTrabajador from '../components/TarjetaTrabajador';
import { colores, radio } from '../theme';

export default function BuscarScreen({ navigation, route }) {
  const [oficio, setOficio] = useState(route.params?.oficio || '');
  const [ciudad, setCiudad] = useState(route.params?.ciudad || '');
  const [oficios, setOficios] = useState([]);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  // Si llegan filtros desde Inicio, aplicarlos
  useEffect(() => {
    if (route.params) {
      setOficio(route.params.oficio || '');
      setCiudad(route.params.ciudad || '');
    }
  }, [route.params]);

  useEffect(() => {
    api('/inicio').then((d) => setOficios(d.oficios)).catch(() => {});
  }, []);

  const buscar = useCallback(async () => {
    try {
      setError('');
      const q = new URLSearchParams();
      if (oficio) q.append('oficio', oficio);
      if (ciudad.trim()) q.append('ciudad', ciudad.trim());
      const { trabajadores } = await api(`/trabajadores?${q.toString()}`);
      setLista(trabajadores);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }, [oficio, ciudad]);

  // Busca al cambiar el oficio y 0.5 s después de dejar de escribir la ciudad
  useEffect(() => {
    const t = setTimeout(buscar, 500);
    return () => clearTimeout(t);
  }, [buscar]);

  const refrescar = async () => {
    setRefrescando(true);
    await buscar();
    setRefrescando(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={st.filtros}>
        <View style={st.campo}>
          <Ionicons name="location-outline" size={18} color={colores.gris} />
          <TextInput style={st.input} placeholder="Filtrar por ciudad" placeholderTextColor="#98a2b3" value={ciudad} onChangeText={setCiudad} />
          {ciudad ? <Ionicons name="close-circle" size={18} color={colores.gris} onPress={() => setCiudad('')} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
          {['', ...oficios].map((o) => (
            <Pressable key={o || 'todos'} onPress={() => setOficio(o)} style={[st.chip, oficio === o && st.chipActivo]}>
              <Text style={[st.chipTexto, oficio === o && { color: colores.blanco }]}>{o || 'Todos'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {lista === null ? (
        <Cargando texto="Buscando profesionales…" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
          ListHeaderComponent={
            <>
              <Aviso texto={error} />
              {lista.length > 0 ? <Text style={st.conteo}>{lista.length} profesional(es)</Text> : null}
            </>
          }
          ListEmptyComponent={error ? null : (
            <EstadoVacio icono="search-outline" titulo="Sin resultados" texto="Prueba con otro oficio o quita el filtro de ciudad." />
          )}
          renderItem={({ item }) => (
            <TarjetaTrabajador trabajador={item} onPress={() => navigation.navigate('Trabajador', { id: item.id })} />
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  filtros: { backgroundColor: colores.blanco, padding: 16, borderBottomWidth: 1, borderBottomColor: colores.borde },
  campo: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colores.borde, borderRadius: radio, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, marginLeft: 8, fontSize: 15, color: colores.texto },
  chip: { borderWidth: 1, borderColor: colores.borde, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipActivo: { backgroundColor: colores.azul, borderColor: colores.azul },
  chipTexto: { color: colores.azul, fontWeight: '600' },
  conteo: { color: colores.gris, marginBottom: 10 }
});
