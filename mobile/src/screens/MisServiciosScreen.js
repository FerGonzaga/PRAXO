// src/screens/MisServiciosScreen.js
// Solicitudes del cliente con su estado. Se actualiza al entrar a la pestaña:
// si el prestador cotiza desde la web, aquí aparece la cotización.
// (Fase 1: chat, pago y reseña se abren en la web; en la fase 2 serán nativos.)

import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { Aviso, Avatar, Boton, Cargando, EstadoVacio, Insignia, Tarjeta } from '../components/ui';
import { colores, coloresEstado } from '../theme';
import { fechaLarga, formatoMXN } from '../utils/formato';
import { abrirWeb } from '../utils/web';

const ACCIONES = {
  Pendiente: { texto: 'Esperando la cotización del prestador', boton: 'Abrir chat' },
  Cotizada: { texto: '¡Ya tienes cotización! Revísala y acéptala.', boton: 'Ver cotización y chat' },
  Aceptada: { texto: 'Cotización aceptada. Falta el pago.', boton: 'Pagar' },
  Rechazada: { texto: 'Rechazaste la cotización.', boton: 'Ver chat' },
  Pagada: { texto: 'Pagado. El prestador realizará el trabajo.', boton: 'Ver chat y comprobante' },
  Completada: { texto: 'Servicio terminado. ¡Califícalo!', boton: 'Calificar servicio' }
};

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
      ListHeaderComponent={
        <>
          <Aviso texto={error} />
          {lista.length > 0 ? (
            <Text style={st.nota}>
              <Ionicons name="information-circle-outline" /> Por ahora el chat, el pago y las reseñas se abren en la página web de PRAXO.
            </Text>
          ) : null}
        </>
      }
      ListEmptyComponent={error ? null : (
        <EstadoVacio icono="receipt-outline" titulo="Aún no tienes servicios"
          texto="Cuando confirmes tu carrito, tus solicitudes aparecerán aquí."
          accion={<Boton titulo="Buscar profesionales" onPress={() => navigation.navigate('Buscar')} />} />
      )}
      renderItem={({ item: s }) => {
        const c = coloresEstado[s.estado] || coloresEstado.Pendiente;
        const a = ACCIONES[s.estado] || ACCIONES.Pendiente;
        return (
          <Tarjeta estilo={{ marginBottom: 12 }}>
            <View style={st.filaEntre}>
              <Insignia texto={s.estado} fondo={c.fondo} color={c.texto} />
              <Text style={st.gris}>{new Date(s.fechaCreacion).toLocaleDateString('es-MX')}</Text>
            </View>
            <View style={[st.filaEntre, { marginTop: 12, justifyContent: 'flex-start' }]}>
              {s.prestador ? <Avatar nombre={s.prestador.nombre} url={s.prestador.fotoUrl} tamano={42} /> : null}
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={st.servicio}>{s.servicio}</Text>
                <Text style={st.gris}>{s.prestador ? s.prestador.nombre : 'Profesional PRAXO'}</Text>
              </View>
            </View>
            {s.fecha ? <Text style={st.dato}><Ionicons name="calendar-outline" /> {fechaLarga(s.fecha)} · {s.hora}</Text> : null}

            {s.cotizacion ? (
              <View style={st.cotizacion}>
                <Text style={{ color: colores.verde, fontWeight: '800' }}>
                  {s.pago ? 'Total pagado' : 'Total de la cotización'}: {formatoMXN(s.pago ? s.pago.monto : s.cotizacion.desglose.total)}
                </Text>
                {s.cotizacion.mensaje ? <Text style={[st.gris, { marginTop: 4 }]} numberOfLines={2}>“{s.cotizacion.mensaje}”</Text> : null}
                {s.pago ? <Text style={[st.gris, { marginTop: 4 }]}>Referencia: {s.pago.referencia}</Text> : null}
              </View>
            ) : null}

            <Text style={[st.dato, { color: colores.texto }]}>{a.texto}</Text>
            <Boton titulo={a.boton} variante={['Cotizada', 'Aceptada', 'Completada'].includes(s.estado) ? 'primario' : 'contorno'}
              icono="open-outline" onPress={() => abrirWeb(s.urlWeb)} estilo={{ marginTop: 12, height: 44 }} />
          </Tarjeta>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicio: { fontSize: 16, fontWeight: '800', color: colores.texto },
  gris: { color: colores.gris },
  dato: { color: colores.gris, marginTop: 8 },
  cotizacion: { backgroundColor: colores.verdeSuave, borderRadius: 10, padding: 10, marginTop: 10 },
  nota: { color: colores.gris, fontSize: 12, marginBottom: 12 }
});
