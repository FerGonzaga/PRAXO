// src/components/ui.js
// Piezas visuales reutilizables de la app.

import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colores, radio, sombra } from '../theme';
import { avatarUrl } from '../utils/formato';

export function Boton({ titulo, onPress, variante = 'primario', cargando = false, deshabilitado = false, icono, estilo }) {
  const v = estilosBoton[variante] || estilosBoton.primario;
  const inactivo = deshabilitado || cargando;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [s.boton, v.caja, inactivo && { opacity: 0.55 }, pressed && { opacity: 0.85 }, estilo]}
      accessibilityRole="button"
    >
      {cargando ? (
        <ActivityIndicator color={v.texto.color} />
      ) : (
        <View style={s.filaCentro}>
          {icono ? <Ionicons name={icono} size={18} color={v.texto.color} style={{ marginRight: 8 }} /> : null}
          <Text style={[s.botonTexto, v.texto]}>{titulo}</Text>
        </View>
      )}
    </Pressable>
  );
}

const estilosBoton = {
  primario: { caja: { backgroundColor: colores.naranja }, texto: { color: colores.azul } },
  oscuro: { caja: { backgroundColor: colores.azul }, texto: { color: colores.blanco } },
  contorno: { caja: { borderWidth: 1.5, borderColor: colores.azul, backgroundColor: 'transparent' }, texto: { color: colores.azul } },
  peligro: { caja: { borderWidth: 1.5, borderColor: colores.rojo, backgroundColor: 'transparent' }, texto: { color: colores.rojo } }
};

export function Campo({ etiqueta, error, multilinea, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {etiqueta ? <Text style={s.etiqueta}>{etiqueta}</Text> : null}
      <TextInput
        placeholderTextColor="#98a2b3"
        style={[s.campo, multilinea && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }, error && { borderColor: colores.rojo }]}
        multiline={multilinea}
        {...props}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Casilla({ marcada, onCambiar, children }) {
  return (
    <Pressable onPress={() => onCambiar(!marcada)} style={s.casillaFila} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}>
      <View style={[s.casilla, marcada && { backgroundColor: colores.azul, borderColor: colores.azul }]}>
        {marcada ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function Estrellas({ valor = 0, tamano = 14 }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(valor) ? 'star' : 'star-outline'} size={tamano} color={colores.amarillo} style={{ marginRight: 1 }} />
      ))}
    </View>
  );
}

export function Avatar({ nombre, url, tamano = 48 }) {
  const [fallo, setFallo] = React.useState(false);
  return (
    <Image
      source={{ uri: !url || fallo ? avatarUrl(nombre) : url }}
      onError={() => setFallo(true)}
      style={{ width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: colores.borde }}
    />
  );
}

export function Tarjeta({ children, estilo }) {
  return <View style={[s.tarjeta, estilo]}>{children}</View>;
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <View style={s.centro}>
      <ActivityIndicator size="large" color={colores.azul} />
      <Text style={{ marginTop: 10, color: colores.gris }}>{texto}</Text>
    </View>
  );
}

export function EstadoVacio({ icono = 'file-tray-outline', titulo, texto, accion }) {
  return (
    <View style={[s.centro, { paddingVertical: 48 }]}>
      <Ionicons name={icono} size={48} color={colores.gris} />
      <Text style={s.vacioTitulo}>{titulo}</Text>
      {texto ? <Text style={s.vacioTexto}>{texto}</Text> : null}
      {accion}
    </View>
  );
}

export function Aviso({ tipo = 'error', texto }) {
  if (!texto) return null;
  const c = tipo === 'error'
    ? { fondo: '#fdecee', texto: '#842029', icono: 'alert-circle' }
    : { fondo: colores.verdeSuave, texto: '#0f5132', icono: 'checkmark-circle' };
  return (
    <View style={[s.aviso, { backgroundColor: c.fondo }]}>
      <Ionicons name={c.icono} size={18} color={c.texto} style={{ marginRight: 8 }} />
      <Text style={{ color: c.texto, flex: 1 }}>{texto}</Text>
    </View>
  );
}

export function Insignia({ texto, fondo, color }) {
  return (
    <View style={{ backgroundColor: fondo, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  boton: { height: 50, borderRadius: radio, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  botonTexto: { fontSize: 16, fontWeight: '700' },
  filaCentro: { flexDirection: 'row', alignItems: 'center' },
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.texto, marginBottom: 6 },
  campo: {
    borderWidth: 1, borderColor: colores.borde, backgroundColor: colores.blanco, borderRadius: 12,
    paddingHorizontal: 14, minHeight: 48, fontSize: 15, color: colores.texto
  },
  error: { color: colores.rojo, fontSize: 12, marginTop: 4 },
  casillaFila: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  casilla: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colores.gris,
    alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1
  },
  tarjeta: { backgroundColor: colores.blanco, borderRadius: radio, padding: 16, ...sombra },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  vacioTitulo: { fontSize: 17, fontWeight: '700', color: colores.texto, marginTop: 12, textAlign: 'center' },
  vacioTexto: { color: colores.gris, textAlign: 'center', marginTop: 6, marginBottom: 14 },
  aviso: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 14 }
});
