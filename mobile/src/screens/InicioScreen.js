// src/screens/InicioScreen.js
// Saludo, buscador, oficios, carrusel de mejores reseñas y profesionales destacados.
// Los datos vienen del mismo servidor que la web: una reseña nueva en la web aparece aquí.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { useCarrito } from '../context/CarritoContext';
import { Aviso, Avatar, Cargando, Estrellas } from '../components/ui';
import TarjetaTrabajador from '../components/TarjetaTrabajador';
import { colores, radio, sombra } from '../theme';
import { mesAnio } from '../utils/formato';

const ANCHO = Dimensions.get('window').width;
const ANCHO_RESENA = ANCHO - 48;

export default function InicioScreen({ navigation }) {
  const { usuario } = useAuth();
  const { refrescarCantidad } = useCarrito();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [ciudad, setCiudad] = useState('');

  const cargar = useCallback(async () => {
    try {
      setError('');
      setDatos(await api('/inicio'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useFocusEffect(useCallback(() => { refrescarCantidad(); }, [refrescarCantidad]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const buscar = (oficio) => navigation.navigate('Buscar', { oficio: oficio || '', ciudad: ciudad.trim() });

  if (!datos && !error) return <Cargando texto="Cargando PRAXO…" />;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
    >
      <View style={st.hero}>
        <Text style={st.hola}>Hola, {usuario.nombre.split(' ')[0]} 👋</Text>
        <Text style={st.heroTitulo}>¿Qué servicio necesitas hoy?</Text>
        <View style={st.buscador}>
          <Ionicons name="location-outline" size={20} color={colores.gris} />
          <TextInput
            style={st.buscadorInput}
            placeholder="Tu ciudad (opcional)"
            placeholderTextColor="#98a2b3"
            value={ciudad}
            onChangeText={setCiudad}
            onSubmitEditing={() => buscar('')}
            returnKeyType="search"
          />
          <Pressable onPress={() => buscar('')} style={st.botonBuscar}>
            <Ionicons name="search" size={18} color={colores.azul} />
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Aviso texto={error} />
      </View>

      {datos ? (
        <>
          {/* OFICIOS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
            {datos.oficios.map((o) => (
              <Pressable key={o} onPress={() => buscar(o)} style={st.chip}>
                <Text style={st.chipTexto}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* CARRUSEL DE RESEÑAS */}
          <Text style={st.seccion}>Lo que dicen nuestros clientes</Text>
          {datos.mejoresResenas.length === 0 ? (
            <Text style={st.vacio}>Aún no hay reseñas. ¡Contrata un servicio y sé el primero en opinar!</Text>
          ) : (
            <CarruselResenas resenas={datos.mejoresResenas} alAbrir={(id) => navigation.navigate('Trabajador', { id })} />
          )}

          {/* DESTACADOS */}
          <View style={st.encabezadoSeccion}>
            <Text style={[st.seccion, { marginTop: 0, marginBottom: 0, paddingHorizontal: 0 }]}>Mejor calificados</Text>
            <Pressable onPress={() => buscar('')}><Text style={st.verTodos}>Ver todos</Text></Pressable>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            {datos.destacados.map((t) => (
              <TarjetaTrabajador key={t.id} trabajador={t} onPress={() => navigation.navigate('Trabajador', { id: t.id })} />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function CarruselResenas({ resenas, alAbrir }) {
  const lista = useRef(null);
  const [indice, setIndice] = useState(0);
  const tocando = useRef(false);

  // Avanza solo cada 6 segundos (se pausa mientras el usuario desliza)
  useEffect(() => {
    if (resenas.length < 2) return undefined;
    const t = setInterval(() => {
      if (tocando.current) return;
      setIndice((i) => {
        const siguiente = (i + 1) % resenas.length;
        lista.current?.scrollToIndex({ index: siguiente, animated: true });
        return siguiente;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [resenas.length]);

  return (
    <View>
      <FlatList
        ref={lista}
        data={resenas}
        horizontal
        pagingEnabled={false}
        snapToInterval={ANCHO_RESENA + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18 }}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: ANCHO_RESENA + 12, offset: (ANCHO_RESENA + 12) * i, index: i })}
        onScrollBeginDrag={() => { tocando.current = true; }}
        onMomentumScrollEnd={(e) => {
          tocando.current = false;
          setIndice(Math.round(e.nativeEvent.contentOffset.x / (ANCHO_RESENA + 12)));
        }}
        renderItem={({ item: r }) => (
          <View style={[st.resena, { width: ANCHO_RESENA }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Estrellas valor={r.calificacion} tamano={16} />
              <Ionicons name="chatbox-ellipses-outline" size={20} color={colores.naranja} />
            </View>
            <Text style={st.resenaTexto} numberOfLines={5}>“{r.comentario}”</Text>
            <Text style={st.resenaCliente}>
              <Ionicons name="checkmark-circle" size={13} color={colores.verde} /> {r.cliente} · {mesAnio(r.fecha)}
            </Text>
            <Pressable onPress={() => alAbrir(r.trabajador.id)} style={st.resenaPrestador}>
              <Avatar nombre={r.trabajador.nombre} url={r.trabajador.fotoUrl} tamano={36} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colores.texto }}>{r.trabajador.nombre}</Text>
                <Text style={{ color: colores.gris, fontSize: 12 }}>{r.trabajador.oficio} · Ver perfil</Text>
              </View>
            </Pressable>
          </View>
        )}
      />
      {resenas.length > 1 ? (
        <View style={st.puntos}>
          {resenas.map((_, i) => <View key={i} style={[st.punto, i === indice && st.puntoActivo]} />)}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: colores.azul, padding: 20, paddingBottom: 26, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  hola: { color: '#c7d2e3', fontSize: 15 },
  heroTitulo: { color: colores.blanco, fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 16 },
  buscador: { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.blanco, borderRadius: radio, paddingLeft: 12, height: 50 },
  buscadorInput: { flex: 1, marginLeft: 8, fontSize: 15, color: colores.texto },
  botonBuscar: { backgroundColor: colores.naranja, height: 50, width: 52, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radio, borderBottomRightRadius: radio },
  chips: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  chip: { backgroundColor: colores.blanco, borderWidth: 1, borderColor: colores.borde, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipTexto: { color: colores.azul, fontWeight: '600' },
  seccion: { fontSize: 18, fontWeight: '800', color: colores.texto, paddingHorizontal: 16, marginTop: 22, marginBottom: 12 },
  encabezadoSeccion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  verTodos: { color: colores.naranjaOscuro, fontWeight: '700' },
  vacio: { color: colores.gris, paddingHorizontal: 16 },
  resena: { backgroundColor: colores.blanco, borderRadius: 18, padding: 18, marginRight: 12, minHeight: 210, ...sombra },
  resenaTexto: { color: colores.texto, fontSize: 15, lineHeight: 22, marginTop: 10, flex: 1 },
  resenaCliente: { color: colores.gris, fontSize: 12, marginTop: 10 },
  resenaPrestador: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: 12, marginTop: 12 },
  puntos: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  punto: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c9d1dc', marginHorizontal: 3 },
  puntoActivo: { backgroundColor: colores.azul, width: 18 }
});
