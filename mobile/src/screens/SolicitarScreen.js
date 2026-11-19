// src/screens/SolicitarScreen.js
// Mismo formulario que el modal "Solicitar servicio" de la web.
// El servicio se agrega al MISMO carrito: también aparece en la web.

import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { useCarrito } from '../context/CarritoContext';
import { Aviso, Boton, Campo } from '../components/ui';
import { colores, radio } from '../theme';
import { aHora, aIsoDia, fechaLarga } from '../utils/formato';

function manana() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export default function SolicitarScreen({ route, navigation }) {
  const { trabajador } = route.params;
  const { setCantidad } = useCarrito();

  const [fecha, setFecha] = useState(manana());
  const [hora, setHora] = useState(manana());
  const [ubicacion, setUbicacion] = useState('');
  const [referencias, setReferencias] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState(false);
  const [cotizacion, setCotizacion] = useState(true);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // ---------- Fecha y hora ----------
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  function elegir(modo) {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: modo === 'date' ? fecha : hora,
        mode: modo,
        is24Hour: true,
        minimumDate: modo === 'date' ? hoy : undefined,
        onChange: (evento, valor) => {
          if (evento.type !== 'set' || !valor) return;
          modo === 'date' ? setFecha(valor) : setHora(valor);
        }
      });
    }
  }

  // ---------- Foto de evidencia ----------
  async function elegirFoto(desdeCamara) {
    const permiso = desdeCamara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', desdeCamara ? 'Activa el permiso de cámara para tomar la foto.' : 'Activa el permiso de fotos para elegir una imagen.');
      return;
    }
    const opciones = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true };
    const r = desdeCamara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (!r.canceled && r.assets && r.assets[0]) {
      const a = r.assets[0];
      if (a.fileSize && a.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Imagen muy pesada', 'La foto debe pesar menos de 5 MB.');
        return;
      }
      setFoto(a);
    }
  }

  // ---------- Enviar ----------
  async function agregar() {
    setError('');
    if (!ubicacion.trim() || !descripcion.trim()) {
      setError('Escribe la ubicación y describe el problema.');
      return;
    }
    if (aIsoDia(fecha) < aIsoDia(new Date())) {
      setError('Elige una fecha de hoy en adelante.');
      return;
    }

    const datos = new FormData();
    datos.append('trabajadorId', trabajador.id);
    datos.append('fecha', aIsoDia(fecha));
    datos.append('hora', aHora(hora));
    datos.append('ubicacion', ubicacion.trim());
    datos.append('referenciasUbicacion', referencias.trim());
    datos.append('descripcion', descripcion.trim());
    datos.append('urgencia', urgencia ? 'Urgencia' : 'Programado');
    datos.append('requiereCotizacion', cotizacion ? 'true' : 'false');
    if (foto) {
      const tipo = foto.mimeType || 'image/jpeg';
      datos.append('imagenEvidencia', {
        uri: foto.uri,
        name: foto.fileName || `evidencia.${tipo.split('/')[1] || 'jpg'}`,
        type: tipo
      });
    }

    setEnviando(true);
    try {
      const r = await api('/carrito', { metodo: 'POST', formulario: datos });
      setCantidad(r.cantidad);
      Alert.alert('¡Agregado!', `${trabajador.oficio} con ${trabajador.nombre} está en tu carrito.`, [
        { text: 'Seguir buscando', onPress: () => navigation.goBack() },
        { text: 'Ir al carrito', onPress: () => navigation.navigate('Principal', { screen: 'Carrito' }) }
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={st.prestador}>
          <Ionicons name="construct" size={20} color={colores.azul} />
          <Text style={st.prestadorTexto}>{trabajador.oficio} · {trabajador.nombre}</Text>
        </View>

        <Aviso texto={error} />

        <Text style={st.etiqueta}>¿Cuándo lo necesitas?</Text>
        {Platform.OS === 'ios' ? (
          <View style={[st.fila, { marginBottom: 14 }]}>
            <DateTimePicker value={fecha} mode="date" display="compact" minimumDate={hoy} locale="es-MX"
              onChange={(_, v) => v && setFecha(v)} />
            <DateTimePicker value={hora} mode="time" display="compact" locale="es-MX"
              onChange={(_, v) => v && setHora(v)} />
          </View>
        ) : (
          <View style={[st.fila, { marginBottom: 14 }]}>
            <Pressable style={[st.selector, { flex: 1.6 }]} onPress={() => elegir('date')}>
              <Ionicons name="calendar-outline" size={18} color={colores.azul} />
              <Text style={st.selectorTexto}>{fechaLarga(aIsoDia(fecha))}</Text>
            </Pressable>
            <Pressable style={[st.selector, { flex: 1 }]} onPress={() => elegir('time')}>
              <Ionicons name="time-outline" size={18} color={colores.azul} />
              <Text style={st.selectorTexto}>{aHora(hora)}</Text>
            </Pressable>
          </View>
        )}

        <Campo etiqueta="Ubicación del servicio" value={ubicacion} onChangeText={setUbicacion}
          placeholder="Calle, número y colonia" maxLength={150} />
        <Campo etiqueta="Referencias (opcional)" value={referencias} onChangeText={setReferencias}
          placeholder="Ej. Casa azul junto a la tienda" maxLength={250} />
        <Campo etiqueta="Describe el problema" value={descripcion} onChangeText={setDescripcion}
          placeholder="Cuéntale al profesional qué necesitas" multilinea maxLength={500} />

        <View style={st.interruptor}>
          <View style={{ flex: 1 }}>
            <Text style={st.interruptorTitulo}>Es una emergencia</Text>
            <Text style={st.interruptorTexto}>El prestador verá tu solicitud como urgente.</Text>
          </View>
          <Switch value={urgencia} onValueChange={setUrgencia} trackColor={{ true: colores.naranja }} />
        </View>
        <View style={st.interruptor}>
          <View style={{ flex: 1 }}>
            <Text style={st.interruptorTitulo}>Quiero cotización previa</Text>
            <Text style={st.interruptorTexto}>El prestador te enviará el precio antes de confirmar.</Text>
          </View>
          <Switch value={cotizacion} onValueChange={setCotizacion} trackColor={{ true: colores.naranja }} />
        </View>

        <Text style={[st.etiqueta, { marginTop: 8 }]}>Foto del problema (opcional)</Text>
        {foto ? (
          <View style={st.fotoCaja}>
            <Image source={{ uri: foto.uri }} style={st.foto} />
            <Pressable onPress={() => setFoto(null)} style={st.quitarFoto}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={[st.fila, { marginBottom: 18 }]}>
            <Boton titulo="Cámara" variante="contorno" icono="camera-outline" onPress={() => elegirFoto(true)} estilo={{ flex: 1 }} />
            <Boton titulo="Galería" variante="contorno" icono="images-outline" onPress={() => elegirFoto(false)} estilo={{ flex: 1 }} />
          </View>
        )}

        <Boton titulo="Agregar al carrito" icono="bag-add-outline" onPress={agregar} cargando={enviando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  prestador: { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.azulSuave, padding: 12, borderRadius: 12, marginBottom: 16 },
  prestadorTexto: { marginLeft: 8, fontWeight: '700', color: colores.azul, flex: 1 },
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.texto, marginBottom: 6 },
  fila: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  selector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colores.borde, backgroundColor: colores.blanco, borderRadius: 12, height: 48, paddingHorizontal: 12 },
  selectorTexto: { marginLeft: 8, color: colores.texto, fontSize: 15 },
  interruptor: { flexDirection: 'row', alignItems: 'center', backgroundColor: colores.blanco, borderRadius: radio, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colores.borde },
  interruptorTitulo: { fontWeight: '700', color: colores.texto },
  interruptorTexto: { color: colores.gris, fontSize: 12, marginTop: 2 },
  fotoCaja: { marginBottom: 18, alignSelf: 'flex-start' },
  foto: { width: 140, height: 140, borderRadius: 12 },
  quitarFoto: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,.6)', borderRadius: 14, padding: 4 }
});
