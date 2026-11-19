// src/screens/MisServiciosScreen.js
// Servicios del CLIENTE. Al tocar uno se abre su detalle con chat, cotización, pago y reseña.
// Se actualiza al entrar a la pestaña: lo que haga el prestador (en la app o en la web) aparece aquí.

import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { Aviso, Avatar, Boton, Cargando, EstadoVacio, Insignia, Tarjeta } from '../components/ui';
import { colores, coloresEstado } from '../theme';
import { fechaLarga, formatoMXN } from '../utils/formato';

const SIGUIENTE_PASO = {
  Pendiente: 'Esperando la cotización del prestador',
  Cotizada: '¡Ya tienes cotización! Revísala y acéptala.',
  Aceptada: 'Cotización aceptada. Falta el pago.',
  Rechazada: 'Rechazaste la cotización.',
  Pagada: 'Pagado. El prestador realizará el trabajo.',
  Completada: 'Servicio terminado.'
};
const DESTACADOS = ['Cotizada', 'Aceptada'];

export default function MisServiciosScreen({ navigation }) {
  const [lista, setLista] = useState(null);
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

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  if (lista === null) return <Cargando />;

  return (
    <FlatList
      data={lista}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      ListHeaderComponent={<Aviso texto={error} />}
      ListEmptyComponent={error ? null : (
        <EstadoVacio icono="receipt-outline" titulo="Aún no tienes servicios"
          texto="Cuando confirmes tu carrito, tus solicitudes aparecerán aquí."
          accion={<Boton titulo="Buscar profesionales" onPress={() => navigation.navigate('Buscar')} />} />
      )}
      renderItem={({ item: s }) => {
        const c = coloresEstado[s.estado] || coloresEstado.Pendiente;
        const destacado = DESTACADOS.includes(s.estado);
        return (
          <Pressable onPress={() => navigation.navigate('Servicio', { id: s.id })}>
            <Tarjeta estilo={[{ marginBottom: 12 }, destacado && { borderWidth: 2, borderColor: colores.naranja }]}>
              <View style={st.filaEntre}>
                <Insignia texto={s.estado} fondo={c.fondo} color={c.texto} />
                <Text style={st.gris}>{new Date(s.fechaCreacion).toLocaleDateString('es-MX')}</Text>
              </View>
              <View style={[st.fila, { marginTop: 12 }]}>
                {s.prestador ? <Avatar nombre={s.prestador.nombre} url={s.prestador.fotoUrl} tamano={42} /> : null}
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={st.servicio}>{s.servicio}</Text>
                  <Text style={st.gris}>{s.prestador ? s.prestador.nombre : 'Profesional PRAXO'}</Text>
                </View>
                {s.total ? <Text style={st.total}>{formatoMXN(s.total)}</Text> : null}
              </View>
              {s.fecha ? <Text style={st.dato}><Ionicons name="calendar-outline" /> {fechaLarga(s.fecha)} · {s.hora}</Text> : null}
              <View style={[st.filaEntre, { marginTop: 10 }]}>
                <Text style={[st.paso, destacado && { color: colores.naranjaOscuro, fontWeight: '700' }]}>{SIGUIENTE_PASO[s.estado]}</Text>
                <Ionicons name="chevron-forward" size={18} color={colores.gris} />
              </View>
            </Tarjeta>
          </Pressable>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicio: { fontSize: 16, fontWeight: '800', color: colores.texto },
  gris: { color: colores.gris },
  total: { fontWeight: '800', color: colores.verde },
  dato: { color: colores.gris, marginTop: 8 },
  paso: { color: colores.texto, flex: 1 }
});
