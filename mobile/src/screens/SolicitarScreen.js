// src/screens/SolicitarScreen.js
// Mismo formulario que el modal "Solicitar servicio" de la web.
// El servicio se agrega al MISMO carrito: también aparece en la web.

import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { useCarrito } from '../context/CarritoContext';
import { Aviso, Boton, Campo } from '../components/ui';
import { colores, radio } from '../theme';
import { aHora, aIsoDia, fechaLarga } from '../utils/formato';

// Convierte cualquier foto (incluido HEIC del iPhone) a un JPG de máximo 1600 px.
// Así siempre se sube rápido, pesa poco y se ve en cualquier navegador.
const ANCHO_MAXIMO = 1600;

async function prepararFoto(asset) {
  const contexto = ImageManipulator.manipulate(asset.uri);
  if (asset.width && asset.height && Math.max(asset.width, asset.height) > ANCHO_MAXIMO) {
    contexto.resize(asset.width >= asset.height ? { width: ANCHO_MAXIMO } : { height: ANCHO_MAXIMO });
  }
  const imagen = await contexto.renderAsync();
  // base64: la foto viaja como texto dentro de una petición JSON normal (funciona en cualquier red)
  const resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { uri: resultado.uri, width: resultado.width, height: resultado.height, mimeType: 'image/jpeg', base64: resultado.base64 };
}

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
  const [procesandoFoto, setProcesandoFoto] = useState(false);
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
    const opciones = {
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      // El iPhone guarda en HEIC; "Compatible" lo entrega como JPG (más ligero y rápido de subir).
      // Si aun así llega HEIC, el servidor lo acepta y lo convierte a JPG.
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
    };
    const r = desdeCamara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
    if (!r.canceled && r.assets && r.assets[0]) {
      const a = r.assets[0];
      setProcesandoFoto(true);
      try {
        setFoto(await prepararFoto(a));
      } catch (e) {
        // Si no se pudo convertir, se manda la original: el servidor también convierte HEIC a JPG
        console.warn('No se pudo convertir la foto en el teléfono:', e && e.message);
        setFoto(a);
      } finally {
        setProcesandoFoto(false);
      }
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

    const campos = {
      trabajadorId: trabajador.id,
      fecha: aIsoDia(fecha),
      hora: aHora(hora),
      ubicacion: ubicacion.trim(),
      referenciasUbicacion: referencias.trim(),
      descripcion: descripcion.trim(),
      urgencia: urgencia ? 'Urgencia' : 'Programado',
      requiereCotizacion: cotizacion
    };

    // Con foto ya convertida a JPG: se manda en JSON (base64).
    // Si no se pudo convertir en el teléfono: se manda como archivo (el servidor convierte HEIC).
    let peticion;
    if (foto && foto.base64) {
      peticion = { metodo: 'POST', cuerpo: { ...campos, imagenBase64: foto.base64 } };
    } else if (foto) {
      const datos = new FormData();
      Object.entries(campos).forEach(([k, v]) => datos.append(k, String(v)));
      const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
      const tipo = EXTENSIONES[foto.mimeType] ? foto.mimeType : 'image/jpeg';
      datos.append('imagenEvidencia', { uri: foto.uri, name: `evidencia.${EXTENSIONES[tipo]}`, type: tipo });
      peticion = { metodo: 'POST', formulario: datos };
    } else {
      peticion = { metodo: 'POST', cuerpo: campos };
    }

    setEnviando(true);
    try {
      const r = await api('/carrito', peticion);
      setCantidad(r.cantidad);
      Alert.alert('¡Agregado!', `${trabajador.oficio} con ${trabajador.nombre} está en tu carrito.`, [
        { text: 'Seguir buscando', onPress: () => navigation.goBack() },
        { text: 'Ir al carrito', onPress: () => navigation.navigate('Principal', { screen: 'Carrito' }) }
      ]);
    } catch (e) {
      // Si falla con foto, lo más probable es la imagen: decirlo claro
      setError(foto && /conexión/i.test(e.message)
        ? 'No se pudo enviar la foto. Intenta con otra imagen o quítala y vuelve a enviar.'
        : e.message);
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
            <Boton titulo="Cámara" variante="contorno" icono="camera-outline" onPress={() => elegirFoto(true)} estilo={{ flex: 1 }} cargando={procesandoFoto} />
            <Boton titulo="Galería" variante="contorno" icono="images-outline" onPress={() => elegirFoto(false)} estilo={{ flex: 1 }} cargando={procesandoFoto} />
          </View>
        )}

        <Boton titulo="Agregar al carrito" icono="bag-add-outline" onPress={agregar} cargando={enviando || procesandoFoto} />
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
