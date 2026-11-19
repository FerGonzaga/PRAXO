// src/screens/BandejaScreen.js
// PRESTADOR: solicitudes recibidas (las mismas que ve en la web en "Solicitudes recibidas").

import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { Aviso, Cargando, EstadoVacio, Insignia, Tarjeta } from '../components/ui';
import { colores, coloresEstado } from '../theme';
import { fechaLarga, formatoMXN } from '../utils/formato';

const FILTROS = [
  { id: 'todas', texto: 'Todas', estados: null },
  { id: 'nuevas', texto: 'Por cotizar', estados: ['Pendiente'] },
  { id: 'curso', texto: 'En curso', estados: ['Cotizada', 'Aceptada', 'Pagada'] },
  { id: 'hechas', texto: 'Completadas', estados: ['Completada'] },
  { id: 'rechazadas', texto: 'Rechazadas', estados: ['Rechazada'] }
];

const SIGUIENTE_PASO = {
  Pendiente: 'Responde con tu cotización',
  Cotizada: 'Esperando que el cliente acepte',
  Aceptada: 'El cliente aceptó · esperando su pago',
  Rechazada: 'El cliente rechazó la cotización',
  Pagada: '¡Pagado! Realiza el trabajo y márcalo como completado',
  Completada: 'Trabajo terminado'
};
const REQUIEREN_ACCION = ['Pendiente', 'Pagada'];

export default function BandejaScreen({ navigation }) {
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError('');
      const { solicitudes } = await api('/solicitudes');
      setLista(solicitudes);
    } catch (e) {
      setError(e.message);
      setLista((l) => l || []);
    }
  }, []);

  // Se recarga al entrar y cada 15 s mientras la bandeja está abierta
  useFocusEffect(useCallback(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const visibles = useMemo(() => {
    if (!lista) return [];
    const f = FILTROS.find((x) => x.id === filtro);
    return f.estados ? lista.filter((s) => f.estados.includes(s.estado)) : lista;
  }, [lista, filtro]);

  if (lista === null) return <Cargando />;

  const pendientes = lista.filter((s) => REQUIEREN_ACCION.includes(s.estado)).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={st.filtros}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {FILTROS.map((f) => {
            const n = f.estados ? lista.filter((s) => f.estados.includes(s.estado)).length : lista.length;
            const activo = filtro === f.id;
            return (
              <Pressable key={f.id} onPress={() => setFiltro(f.id)} style={[st.chip, activo && st.chipActivo]}>
                <Text style={[st.chipTexto, activo && { color: colores.blanco }]}>{f.texto} ({n})</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={visibles}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
        ListHeaderComponent={
          <>
            <Aviso texto={error} />
            {pendientes > 0 ? <Aviso tipo="ok" texto={`Tienes ${pendientes} solicitud(es) que requieren tu acción.`} /> : null}
          </>
        }
        ListEmptyComponent={error ? null : (
          <EstadoVacio icono="file-tray-outline" titulo="Sin solicitudes aquí"
            texto="Cuando un cliente te contrate, su solicitud aparecerá en esta bandeja." />
        )}
        renderItem={({ item: s }) => {
          const c = coloresEstado[s.estado] || coloresEstado.Pendiente;
          const accion = REQUIEREN_ACCION.includes(s.estado);
          return (
            <Pressable onPress={() => navigation.navigate('Servicio', { id: s.id })}>
              <Tarjeta estilo={[{ marginBottom: 12 }, accion && { borderWidth: 2, borderColor: colores.naranja }]}>
                <View style={st.filaEntre}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Insignia texto={s.estado} fondo={c.fondo} color={c.texto} />
                    {s.urgencia === 'Urgencia' ? <Insignia texto="Emergencia" fondo="#fdecee" color={colores.rojo} /> : null}
                  </View>
                  <Text style={st.gris}>{new Date(s.fechaCreacion).toLocaleDateString('es-MX')}</Text>
                </View>
                <Text style={st.cliente}>{s.cliente && s.cliente.nombre ? s.cliente.nombre : 'Cliente'}</Text>
                <Text style={st.gris}>{s.servicio}</Text>
                {s.fecha ? <Text style={st.dato}><Ionicons name="calendar-outline" /> {fechaLarga(s.fecha)} · {s.hora}</Text> : null}
                <Text style={st.dato} numberOfLines={1}><Ionicons name="location-outline" /> {s.ubicacion}</Text>
                <View style={[st.filaEntre, { marginTop: 10 }]}>
                  <Text style={[st.paso, accion && { color: colores.naranjaOscuro, fontWeight: '700' }]}>{SIGUIENTE_PASO[s.estado]}</Text>
                  {s.total ? <Text style={st.total}>{formatoMXN(s.total)}</Text> : <Ionicons name="chevron-forward" size={18} color={colores.gris} />}
                </View>
              </Tarjeta>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  filtros: { backgroundColor: colores.blanco, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colores.borde },
  chip: { borderWidth: 1, borderColor: colores.borde, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipActivo: { backgroundColor: colores.azul, borderColor: colores.azul },
  chipTexto: { color: colores.azul, fontWeight: '600' },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cliente: { fontSize: 17, fontWeight: '800', color: colores.texto, marginTop: 10 },
  gris: { color: colores.gris },
  dato: { color: colores.gris, marginTop: 6 },
  paso: { color: colores.texto, flex: 1, marginRight: 8 },
  total: { fontWeight: '800', color: colores.verde }
});
