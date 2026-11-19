// src/screens/CarritoScreen.js
// Es el MISMO carrito de la web: lo que agregues aquí aparece allá y al revés.

import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { useCarrito } from '../context/CarritoContext';
import { Aviso, Boton, Cargando, Casilla, EstadoVacio, Tarjeta } from '../components/ui';
import { colores } from '../theme';
import { fechaLarga, formatoMXN } from '../utils/formato';
import { abrirWeb } from '../utils/web';

export default function CarritoScreen({ navigation }) {
  const { setCantidad } = useCarrito();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError('');
      const d = await api('/carrito');
      setDatos(d);
      setCantidad(d.items.length);
    } catch (e) {
      setError(e.message);
    }
  }, [setCantidad]);

  // Se recarga cada vez que entras a la pestaña (por si cambiaste algo en la web)
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  function eliminar(item) {
    Alert.alert('Eliminar servicio', `¿Quitar ${item.servicio} con ${item.trabajador} de tu carrito?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await api(`/carrito/${item.id}`, { metodo: 'DELETE' });
            await cargar();
          } catch (e) {
            Alert.alert('No se pudo eliminar', e.message);
          }
        }
      }
    ]);
  }

  async function confirmar() {
    setConfirmando(true);
    try {
      const r = await api('/carrito/confirmar', { metodo: 'POST', cuerpo: { aceptaPoliticas: true } });
      setAcepta(false);
      await cargar();
      Alert.alert('¡Solicitudes enviadas!', r.mensaje, [
        { text: 'Ver mis servicios', onPress: () => navigation.navigate('MisServicios') }
      ]);
    } catch (e) {
      Alert.alert('No se pudo confirmar', e.message);
    } finally {
      setConfirmando(false);
    }
  }

  if (!datos && !error) return <Cargando />;

  const items = datos ? datos.items : [];
  const r = datos ? datos.resumen : null;

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      ListHeaderComponent={<Aviso texto={error} />}
      ListEmptyComponent={error ? null : (
        <EstadoVacio icono="bag-outline" titulo="Tu carrito está vacío"
          texto="Busca un profesional y solicita el servicio que necesitas."
          accion={<Boton titulo="Buscar profesionales" onPress={() => navigation.navigate('Buscar')} />} />
      )}
      renderItem={({ item }) => (
        <Tarjeta estilo={{ marginBottom: 12 }}>
          <View style={st.filaEntre}>
            <Text style={st.servicio}>{item.servicio}</Text>
            <Ionicons name="trash-outline" size={22} color={colores.rojo} onPress={() => eliminar(item)} accessibilityLabel="Eliminar" />
          </View>
          <Text style={st.gris}>con {item.trabajador}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {item.urgencia === 'Urgencia' ? <Text style={[st.etiqueta, { backgroundColor: '#fdecee', color: colores.rojo }]}>Emergencia</Text> : null}
            {item.requiereCotizacion ? <Text style={[st.etiqueta, { backgroundColor: colores.azulSuave, color: colores.azul }]}>Requiere cotización</Text> : null}
          </View>
          <Text style={st.dato}><Ionicons name="calendar-outline" /> {fechaLarga(item.fecha)} · {item.hora}</Text>
          <Text style={st.dato}><Ionicons name="location-outline" /> {item.ubicacion}</Text>
          <Text style={[st.dato, { color: colores.texto }]} numberOfLines={3}>{item.descripcion}</Text>
          {item.imagenUrl ? <Image source={{ uri: item.imagenUrl }} style={st.foto} /> : null}

          <View style={st.precio}>
            {item.estimado ? (
              <>
                <Fila etiqueta={`Prestador (${item.unidadReferencia})`} valor={formatoMXN(item.estimado.precioPrestador)} />
                <Fila etiqueta={`Comisión PRAXO ${item.estimado.comisionPorcentaje}%`} valor={formatoMXN(item.estimado.comision)} />
                <Fila etiqueta={`IVA ${item.estimado.ivaPorcentaje}% s/comisión`} valor={formatoMXN(item.estimado.ivaComision)} />
                <Fila etiqueta="Total estimado" valor={formatoMXN(item.estimado.total)} fuerte />
              </>
            ) : (
              <Text style={st.gris}><Ionicons name="chatbubble-ellipses-outline" /> Precio a cotizar por el prestador.</Text>
            )}
          </View>
        </Tarjeta>
      )}
      ListFooterComponent={items.length > 0 && r ? (
        <Tarjeta estilo={{ marginTop: 4 }}>
          <Text style={st.resumenTitulo}>Resumen</Text>
          <Fila etiqueta="Servicios" valor={String(r.servicios)} />
          <Fila etiqueta="Precio de los prestadores" valor={formatoMXN(r.precioPrestador)} />
          <Fila etiqueta="Comisión PRAXO" valor={formatoMXN(r.comision)} />
          <Fila etiqueta="IVA sobre la comisión" valor={formatoMXN(r.ivaComision)} />
          <Fila etiqueta="Total estimado" valor={formatoMXN(r.total)} fuerte />
          {r.aCotizar > 0 ? <Text style={[st.gris, { marginTop: 6 }]}>{r.aCotizar} servicio(s) se sumarán cuando el prestador cotice.</Text> : null}
          <Text style={[st.gris, { marginTop: 6, marginBottom: 14 }]}>No se cobra nada al confirmar: pagas después de aceptar la cotización.</Text>

          <Casilla marcada={acepta} onCambiar={setAcepta}>
            <Text style={{ color: colores.texto, lineHeight: 20 }}>
              He leído y acepto las <Text style={st.enlace} onPress={() => abrirWeb('/politicas')}>Políticas de compra</Text> (precios,
              comisión, cancelaciones y reembolsos).
            </Text>
          </Casilla>
          <Boton titulo="Confirmar contratación" icono="send-outline" onPress={confirmar} cargando={confirmando} deshabilitado={!acepta} />
        </Tarjeta>
      ) : null}
    />
  );
}

function Fila({ etiqueta, valor, fuerte }) {
  return (
    <View style={[st.filaEntre, { marginTop: fuerte ? 8 : 3 }, fuerte && { borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: 8 }]}>
      <Text style={fuerte ? st.fuerte : st.gris}>{etiqueta}</Text>
      <Text style={fuerte ? [st.fuerte, { color: colores.verde }] : { color: colores.texto }}>{valor}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicio: { fontSize: 17, fontWeight: '800', color: colores.texto },
  gris: { color: colores.gris },
  etiqueta: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  dato: { color: colores.gris, marginTop: 6 },
  foto: { width: 90, height: 90, borderRadius: 10, marginTop: 10 },
  precio: { backgroundColor: colores.fondo, borderRadius: 10, padding: 10, marginTop: 12 },
  fuerte: { fontWeight: '800', color: colores.texto, fontSize: 15 },
  resumenTitulo: { fontSize: 17, fontWeight: '800', color: colores.texto, marginBottom: 6 },
  enlace: { color: colores.naranjaOscuro, fontWeight: '700', textDecorationLine: 'underline' }
});
