// src/screens/TrabajadorScreen.js
// Perfil público del prestador + reseñas + botón para solicitar.

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { Aviso, Avatar, Boton, Cargando, Estrellas, Tarjeta } from '../components/ui';
import { colores } from '../theme';
import { formatoMXN, mesAnio } from '../utils/formato';

export default function TrabajadorScreen({ route, navigation }) {
  const { id } = route.params;
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/trabajadores/${id}`)
      .then((d) => {
        setDatos(d);
        navigation.setOptions({ title: d.trabajador.nombre });
      })
      .catch((e) => setError(e.message));
  }, [id, navigation]);

  if (error) return <View style={{ padding: 16 }}><Aviso texto={error} /></View>;
  if (!datos) return <Cargando />;

  const { trabajador: t, resenas } = datos;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
        <Tarjeta estilo={{ alignItems: 'center' }}>
          <Avatar nombre={t.nombre} url={t.fotoUrl} tamano={96} />
          <Text style={st.nombre}>{t.nombre}</Text>
          <Text style={st.oficio}><Ionicons name="construct-outline" size={14} /> {t.oficio}{t.ciudad ? ` · ${t.ciudad}` : ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
            {t.calificacion !== null ? (
              <>
                <Estrellas valor={t.calificacion} tamano={16} />
                <Text style={{ color: colores.gris }}>{t.calificacion.toFixed(1)} · {t.totalResenas} reseña(s)</Text>
              </>
            ) : <Text style={{ color: colores.gris }}>Sin reseñas aún</Text>}
          </View>
          {t.disponibleAhora ? (
            <View style={st.disponible}><Ionicons name="ellipse" size={8} color={colores.verde} /><Text style={st.disponibleTexto}> Disponible ahora</Text></View>
          ) : null}
        </Tarjeta>

        <Tarjeta estilo={{ marginTop: 14 }}>
          <Text style={st.titulo}>Precio</Text>
          {t.precio ? (
            <>
              <Text style={st.precio}>Desde {formatoMXN(t.precio.desde)} <Text style={st.unidad}>{t.precio.unidad}</Text></Text>
              <Text style={st.notaPrecio}>
                Precio final: incluye la tarifa del prestador ({formatoMXN(t.precio.prestador)}), la comisión de PRAXO y el IVA.
                El precio exacto lo confirma el prestador en su cotización.
              </Text>
            </>
          ) : (
            <Text style={st.notaPrecio}>Este profesional cotiza cada trabajo. Te enviará su precio después de revisar tu solicitud.</Text>
          )}
        </Tarjeta>

        {t.descripcion ? (
          <Tarjeta estilo={{ marginTop: 14 }}>
            <Text style={st.titulo}>Sobre su trabajo</Text>
            <Text style={st.descripcion}>{t.descripcion}</Text>
          </Tarjeta>
        ) : null}

        <Tarjeta estilo={{ marginTop: 14, backgroundColor: colores.verdeSuave }}>
          <Text style={[st.titulo, { color: colores.verde }]}><Ionicons name="shield-checkmark" size={16} /> Garantía PRAXO</Text>
          {[
            'Comprobante de pago en PDF por cada servicio.',
            'Precio final sin sorpresas: ves el desglose antes de pagar.',
            'Pago seguro: no guardamos los datos de tu tarjeta.',
            'Reseñas solo de clientes que contrataron y pagaron.'
          ].map((g) => <Text key={g} style={st.garantia}>• {g}</Text>)}
        </Tarjeta>

        <Text style={[st.titulo, { marginTop: 22, marginBottom: 10 }]}>Reseñas de clientes</Text>
        {resenas.length === 0 ? (
          <Text style={{ color: colores.gris }}>Este profesional aún no tiene reseñas.</Text>
        ) : resenas.map((r, i) => (
          <Tarjeta key={i} estilo={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colores.texto }}>{r.cliente}</Text>
              <Text style={{ color: colores.gris, fontSize: 12 }}>{mesAnio(r.fecha)}</Text>
            </View>
            <Estrellas valor={r.calificacion} />
            {r.comentario ? <Text style={st.descripcion}>{r.comentario}</Text> : null}
          </Tarjeta>
        ))}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={st.barra}>
        <Boton titulo="Solicitar servicio" icono="calendar-outline"
          onPress={() => navigation.navigate('Solicitar', { trabajador: { id: t.id, nombre: t.nombre, oficio: t.oficio } })} />
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  nombre: { fontSize: 22, fontWeight: '800', color: colores.texto, marginTop: 12 },
  oficio: { color: colores.gris, marginTop: 4 },
  disponible: { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.verdeSuave, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 10 },
  disponibleTexto: { color: colores.verde, fontWeight: '700' },
  titulo: { fontSize: 16, fontWeight: '800', color: colores.texto, marginBottom: 6 },
  precio: { fontSize: 22, fontWeight: '800', color: colores.azul },
  unidad: { fontSize: 14, fontWeight: '400', color: colores.gris },
  notaPrecio: { color: colores.gris, fontSize: 13, marginTop: 6, lineHeight: 19 },
  descripcion: { color: colores.texto, lineHeight: 21, marginTop: 4 },
  garantia: { color: '#0f5132', marginTop: 4, lineHeight: 20 },
  barra: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colores.blanco, padding: 16, borderTopWidth: 1, borderTopColor: colores.borde }
});
