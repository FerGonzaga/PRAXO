// src/screens/ServicioScreen.js
// Detalle de un servicio + chat en vivo. La usan CLIENTE y PRESTADOR.
// Las acciones disponibles las decide el servidor según el rol y el estado:
//   cliente:   aceptar / rechazar · pagar · reseña · comprobante
//   prestador: cotizar · completar · comprobante
// El chat pregunta por mensajes nuevos cada 4 s mientras la pantalla está abierta,
// así los mensajes escritos en la web aparecen aquí y al revés.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform,
  Pressable, StyleSheet, Text, TextInput, View
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../api/cliente';
import { useConfig } from '../context/ConfigContext';
import { Aviso, Avatar, Boton, Campo, Cargando, Estrellas, Insignia, Tarjeta } from '../components/ui';
import { colores, coloresEstado } from '../theme';
import { fechaLarga, formatoMXN } from '../utils/formato';

const INTERVALO_CHAT_MS = 4000;

export default function ServicioScreen({ route, navigation }) {
  const { id } = route.params;
  const { config } = useConfig();
  const alturaEncabezado = useHeaderHeight();

  const [datos, setDatos] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState('');

  const lista = useRef(null);
  const ultimaFecha = useRef(null);
  const estadoActual = useRef(null);

  // ---------- Cargar detalle completo ----------
  const cargar = useCallback(async () => {
    try {
      setError('');
      const d = await api(`/solicitudes/${id}`);
      setDatos(d);
      setMensajes(d.mensajes);
      ultimaFecha.current = d.mensajes.length ? d.mensajes[d.mensajes.length - 1].fecha : null;
      estadoActual.current = d.solicitud.estado;
      navigation.setOptions({ title: d.solicitud.servicio });
    } catch (e) {
      setError(e.message);
    }
  }, [id, navigation]);

  useEffect(() => { cargar(); }, [cargar]);

  // ---------- Chat en vivo (polling) ----------
  useFocusEffect(useCallback(() => {
    const t = setInterval(async () => {
      try {
        const q = ultimaFecha.current ? `?despues=${encodeURIComponent(ultimaFecha.current)}` : '';
        const r = await api(`/solicitudes/${id}/mensajes${q}`);
        if (r.mensajes.length) {
          setMensajes((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            return [...prev, ...r.mensajes.filter((m) => !ids.has(m.id))];
          });
          ultimaFecha.current = r.mensajes[r.mensajes.length - 1].fecha;
        }
        // Si la otra persona cambió el estado (p. ej. cotizó desde la web), recargar
        if (r.estado !== estadoActual.current) cargar();
      } catch (e) {
        // sin conexión momentánea: se reintenta en el siguiente ciclo
      }
    }, INTERVALO_CHAT_MS);
    return () => clearInterval(t);
  }, [id, cargar]));

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio) return;
    setEnviando(true);
    try {
      const r = await api(`/solicitudes/${id}/mensajes`, { metodo: 'POST', cuerpo: { texto: limpio } });
      setTexto('');
      setMensajes((prev) => (prev.some((m) => m.id === r.mensaje.id) ? prev : [...prev, r.mensaje]));
      ultimaFecha.current = r.mensaje.fecha;
      setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('No se envió', e.message);
    } finally {
      setEnviando(false);
    }
  }

  // ---------- Acciones ----------
  async function ejecutar(nombre, ruta, cuerpo, exito) {
    setOcupado(nombre);
    try {
      await api(`/solicitudes/${id}/${ruta}`, { metodo: 'POST', cuerpo });
      await cargar();
      if (exito) Alert.alert('Listo', exito);
    } catch (e) {
      Alert.alert('No se pudo completar', e.message);
    } finally {
      setOcupado('');
    }
  }

  const aceptar = () => Alert.alert(
    'Aceptar cotización',
    `¿Aceptas la cotización? Total a pagar: ${formatoMXN(datos.cotizacion.desglose.total)} MXN`,
    [{ text: 'Cancelar', style: 'cancel' }, { text: 'Aceptar', onPress: () => ejecutar('aceptar', 'aceptar', undefined, 'Cotización aceptada. Ahora puedes pagar.') }]
  );

  const rechazar = () => Alert.alert('Rechazar cotización', '¿Seguro que quieres rechazarla?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Rechazar', style: 'destructive', onPress: () => ejecutar('rechazar', 'rechazar') }
  ]);

  const completar = () => Alert.alert('Marcar como completado', '¿Confirmas que el trabajo está terminado?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Sí, terminé', onPress: () => ejecutar('completar', 'completar', undefined, 'Servicio completado. El cliente ya puede calificarte.') }
  ]);

  async function pagar() {
    if (!config || !config.pagos || !config.pagos.stripe) {
      navigation.navigate('PagoSimulado', { id, total: datos.cotizacion.desglose.total, servicio: datos.solicitud.servicio });
      return;
    }
    setOcupado('pagar');
    try {
      const { url } = await api(`/solicitudes/${id}/pago/stripe`, { metodo: 'POST' });
      // Página segura de Stripe: la tarjeta nunca pasa por PRAXO (PCI-DSS)
      await WebBrowser.openBrowserAsync(url, { toolbarColor: colores.azul, controlsColor: colores.naranja });
      await cargar(); // al cerrar el navegador revisamos si ya quedó pagado
    } catch (e) {
      Alert.alert('No se pudo iniciar el pago', e.message);
    } finally {
      setOcupado('');
    }
  }

  async function verComprobante() {
    setOcupado('comprobante');
    try {
      const { url } = await api(`/solicitudes/${id}/comprobante-url`, { metodo: 'POST' });
      await WebBrowser.openBrowserAsync(url, { toolbarColor: colores.azul, controlsColor: colores.naranja });
    } catch (e) {
      Alert.alert('No se pudo abrir el comprobante', e.message);
    } finally {
      setOcupado('');
    }
  }

  if (error && !datos) return <View style={{ padding: 16 }}><Aviso texto={error} /><Boton titulo="Reintentar" onPress={cargar} /></View>;
  if (!datos) return <Cargando />;

  const { rol, solicitud: s, cotizacion, pago, resena, acciones } = datos;
  const color = coloresEstado[s.estado] || coloresEstado.Pendiente;
  const puede = (a) => acciones.includes(a);

  const encabezado = (
    <View>
      <Tarjeta estilo={{ marginBottom: 12 }}>
        <View style={st.filaEntre}>
          <Insignia texto={s.estado} fondo={color.fondo} color={color.texto} />
          {s.urgencia === 'Urgencia' ? <Insignia texto="Emergencia" fondo="#fdecee" color={colores.rojo} /> : null}
        </View>
        <View style={[st.fila, { marginTop: 12 }]}>
          {rol === 'cliente' && s.prestador ? <Avatar nombre={s.prestador.nombre} url={s.prestador.fotoUrl} tamano={44} /> : (
            <View style={st.iconoCliente}><Ionicons name="person" size={22} color={colores.azul} /></View>
          )}
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={st.titulo}>{s.servicio}</Text>
            <Text style={st.gris}>
              {rol === 'cliente' ? `Prestador: ${s.prestador ? s.prestador.nombre : 'PRAXO'}` : `Cliente: ${s.cliente && s.cliente.nombre ? s.cliente.nombre : 'Cliente'}`}
            </Text>
          </View>
        </View>
        {s.fecha ? <Text style={st.dato}><Ionicons name="calendar-outline" /> {fechaLarga(s.fecha)} · {s.hora}</Text> : null}
        <Text style={st.dato}><Ionicons name="location-outline" /> {s.ubicacion}{s.referenciasUbicacion ? ` (${s.referenciasUbicacion})` : ''}</Text>
        <Text style={[st.dato, { color: colores.texto }]}>{s.descripcion}</Text>
        {s.imagenUrl ? (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(s.imagenUrl)}>
            <Image source={{ uri: s.imagenUrl }} style={st.foto} />
          </Pressable>
        ) : null}
        {s.contactoPrestador && s.contactoPrestador.telefono ? (
          <Text style={[st.dato, { color: colores.verde }]}><Ionicons name="call-outline" /> Teléfono del prestador: {s.contactoPrestador.telefono}</Text>
        ) : null}
      </Tarjeta>

      {/* COTIZACIÓN */}
      {cotizacion ? (
        <Tarjeta estilo={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colores.verde }}>
          <Text style={st.subtitulo}><Ionicons name="document-text-outline" /> Cotización</Text>
          {cotizacion.mensaje ? <Text style={[st.gris, { marginBottom: 8 }]}>“{cotizacion.mensaje}”</Text> : null}
          <Desglose d={cotizacion.desglose} rol={rol} />
          {puede('aceptar') ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Boton titulo="Rechazar" variante="peligro" onPress={rechazar} cargando={ocupado === 'rechazar'} estilo={{ flex: 1 }} />
              <Boton titulo="Aceptar" icono="checkmark" onPress={aceptar} cargando={ocupado === 'aceptar'} estilo={{ flex: 1.4 }} />
            </View>
          ) : null}
          {puede('pagar') ? (
            <Boton titulo={`Pagar ${formatoMXN(cotizacion.desglose.total)}`} icono="card-outline" onPress={pagar}
              cargando={ocupado === 'pagar'} estilo={{ marginTop: 12 }} />
          ) : null}
          {s.estado === 'Aceptada' && rol === 'prestador' ? <Text style={[st.gris, { marginTop: 8 }]}>El cliente aceptó. Esperando su pago.</Text> : null}
          {s.estado === 'Cotizada' && rol === 'prestador' ? <Text style={[st.gris, { marginTop: 8 }]}>Esperando que el cliente acepte tu cotización.</Text> : null}
        </Tarjeta>
      ) : null}

      {/* PRESTADOR: COTIZAR */}
      {puede('cotizar') ? <FormularioCotizacion id={id} alTerminar={cargar} /> : null}
      {rol === 'cliente' && s.estado === 'Pendiente' ? (
        <Aviso tipo="ok" texto="Esperando la cotización del prestador. Puedes escribirle por el chat." />
      ) : null}

      {/* PAGO */}
      {pago ? (
        <Tarjeta estilo={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colores.azul500 }}>
          <Text style={st.subtitulo}><Ionicons name="receipt-outline" /> Pago</Text>
          <Text style={st.gris}>Total pagado: <Text style={st.fuerte}>{formatoMXN(pago.monto)}</Text></Text>
          {rol === 'prestador' && typeof pago.precioPrestador === 'number' ? (
            <Text style={st.gris}>Tú recibes: <Text style={[st.fuerte, { color: colores.verde }]}>{formatoMXN(pago.precioPrestador)}</Text></Text>
          ) : null}
          <Text style={st.gris}>{pago.marca} •••• {pago.ultimos4} · {pago.proveedor === 'stripe' ? 'Stripe (prueba)' : 'simulado'}</Text>
          <Text style={st.gris}>Referencia: {pago.referencia}</Text>
          <Boton titulo="Ver comprobante (PDF)" variante="contorno" icono="document-outline" onPress={verComprobante}
            cargando={ocupado === 'comprobante'} estilo={{ marginTop: 10, height: 44 }} />
          {puede('completar') ? (
            <Boton titulo="Marcar como completado" variante="oscuro" icono="checkmark-done" onPress={completar}
              cargando={ocupado === 'completar'} estilo={{ marginTop: 10 }} />
          ) : null}
          {s.estado === 'Pagada' && rol === 'cliente' ? <Text style={[st.gris, { marginTop: 8 }]}>Servicio en curso. Cuando el prestador lo termine podrás calificarlo.</Text> : null}
        </Tarjeta>
      ) : null}

      {/* RESEÑA */}
      {resena ? (
        <Tarjeta estilo={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colores.amarillo }}>
          <Text style={st.subtitulo}>Reseña del servicio</Text>
          <Estrellas valor={resena.calificacion} tamano={18} />
          {resena.comentario ? <Text style={[st.gris, { marginTop: 6 }]}>“{resena.comentario}”</Text> : null}
        </Tarjeta>
      ) : null}
      {puede('resena') ? <FormularioResena id={id} alTerminar={cargar} /> : null}
      {s.estado === 'Completada' && rol === 'prestador' && !resena ? <Aviso tipo="ok" texto="Trabajo completado. Esperando la reseña del cliente." /> : null}

      <Text style={[st.subtitulo, { marginTop: 4, marginBottom: 8 }]}><Ionicons name="chatbubbles-outline" /> Chat</Text>
      {mensajes.length === 0 ? <Text style={[st.gris, { marginBottom: 8 }]}>Aún no hay mensajes. ¡Escribe el primero!</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={alturaEncabezado}>
      <FlatList
        ref={lista}
        data={mensajes}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={encabezado}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => { if (mensajes.length) lista.current?.scrollToEnd({ animated: false }); }}
        renderItem={({ item: m }) => (
          <View style={[st.burbuja, m.mio ? st.mia : st.otra]}>
            {!m.mio && m.autor ? <Text style={st.autor}>{m.autor}</Text> : null}
            <Text style={{ color: m.mio ? '#fff' : colores.texto }}>{m.texto}</Text>
            <Text style={[st.hora, { color: m.mio ? '#dbe4f0' : colores.gris }]}>
              {new Date(m.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      />
      <SafeAreaView edges={['bottom']} style={st.barra}>
        <TextInput
          style={st.entrada}
          value={texto}
          onChangeText={setTexto}
          placeholder="Escribe un mensaje…"
          placeholderTextColor="#98a2b3"
          multiline
          maxLength={1000}
        />
        <Pressable onPress={enviar} disabled={enviando || !texto.trim()} style={[st.enviar, (!texto.trim() || enviando) && { opacity: 0.5 }]}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </Pressable>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ---------- Desglose del precio ----------
function Desglose({ d, rol }) {
  const fila = (a, b, fuerte) => (
    <View style={[st.filaEntre, { marginTop: 3 }, fuerte && { borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: 6, marginTop: 6 }]}>
      <Text style={fuerte ? st.fuerte : st.gris}>{a}</Text>
      <Text style={fuerte ? [st.fuerte, { color: colores.verde }] : { color: colores.texto }}>{b}</Text>
    </View>
  );
  return (
    <View>
      {fila('Servicio del prestador', formatoMXN(d.precioPrestador))}
      {fila(`Comisión PRAXO (${d.comisionPorcentaje}%)`, formatoMXN(d.comision))}
      {fila(`IVA ${d.ivaPorcentaje}% sobre la comisión`, formatoMXN(d.ivaComision))}
      {fila(rol === 'cliente' ? 'Total a pagar' : 'Total que paga el cliente', formatoMXN(d.total), true)}
      {rol === 'prestador' ? <Text style={{ color: colores.verde, marginTop: 6, fontWeight: '700' }}>Tú recibes {formatoMXN(d.precioPrestador)} (100% de tu cotización)</Text> : null}
    </View>
  );
}

// ---------- Prestador: enviar cotización ----------
function FormularioCotizacion({ id, alTerminar }) {
  const { config } = useConfig();
  const [precio, setPrecio] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);

  const comision = config ? config.comisionPorcentaje : 10;
  const iva = config ? config.ivaPorcentaje : 16;
  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const p = r2(Number(precio.replace(',', '.')) || 0);
  const c = r2((p * comision) / 100);
  const i = r2((c * iva) / 100);

  async function enviar() {
    if (!(p > 0)) return Alert.alert('Precio inválido', 'Escribe cuánto cobrarás por el trabajo.');
    setCargando(true);
    try {
      await api(`/solicitudes/${id}/cotizar`, { metodo: 'POST', cuerpo: { precio: p, mensaje } });
      Alert.alert('Cotización enviada', 'El cliente la verá en la app y en la web.');
      alTerminar();
    } catch (e) {
      Alert.alert('No se envió', e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta estilo={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colores.naranja }}>
      <Text style={st.subtitulo}><Ionicons name="cash-outline" /> Responder con tu cotización</Text>
      <Campo etiqueta="Tu precio (MXN) — recibes el 100%" value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" placeholder="Ej. 850" />
      {p > 0 ? (
        <Text style={[st.gris, { marginTop: -8, marginBottom: 12 }]}>
          Comisión {formatoMXN(c)} · IVA {formatoMXN(i)} · El cliente pagará <Text style={st.fuerte}>{formatoMXN(r2(p + c + i))}</Text>
        </Text>
      ) : null}
      <Campo etiqueta="Mensaje para el cliente" value={mensaje} onChangeText={setMensaje} multilinea maxLength={1000}
        placeholder="Ej. Puedo visitarte el día acordado; el trabajo toma 2 horas e incluye material." />
      <Boton titulo="Enviar cotización" icono="send-outline" onPress={enviar} cargando={cargando} />
    </Tarjeta>
  );
}

// ---------- Cliente: reseña ----------
const ETIQUETAS = { 1: 'Muy malo', 2: 'Malo', 3: 'Regular', 4: 'Bueno', 5: '¡Excelente!' };

function FormularioResena({ id, alTerminar }) {
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    if (!estrellas) return Alert.alert('Elige una calificación', 'Toca de 1 a 5 estrellas.');
    setCargando(true);
    try {
      await api(`/solicitudes/${id}/resena`, { metodo: 'POST', cuerpo: { calificacion: estrellas, comentario } });
      Alert.alert('¡Gracias!', 'Tu reseña ya aparece en el perfil del prestador.');
      alTerminar();
    } catch (e) {
      Alert.alert('No se guardó', e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta estilo={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colores.amarillo }}>
      <Text style={st.subtitulo}>¡Servicio completado! ¿Cómo te fue?</Text>
      <View style={{ flexDirection: 'row', marginVertical: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setEstrellas(n)} hitSlop={6} accessibilityLabel={`${n} estrellas`}>
            <Ionicons name={n <= estrellas ? 'star' : 'star-outline'} size={36} color={colores.amarillo} style={{ marginRight: 6 }} />
          </Pressable>
        ))}
      </View>
      <Text style={[st.gris, { marginBottom: 10 }]}>{estrellas ? `${estrellas} de 5 · ${ETIQUETAS[estrellas]}` : 'Toca las estrellas'}</Text>
      <Campo value={comentario} onChangeText={setComentario} multilinea maxLength={500} placeholder="Cuéntanos cómo te fue (opcional)" />
      <Boton titulo="Enviar reseña" icono="star-outline" onPress={enviar} cargando={cargando} />
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 17, fontWeight: '800', color: colores.texto },
  subtitulo: { fontSize: 16, fontWeight: '800', color: colores.texto, marginBottom: 6 },
  gris: { color: colores.gris, marginTop: 2 },
  fuerte: { fontWeight: '800', color: colores.texto },
  dato: { color: colores.gris, marginTop: 8 },
  foto: { width: 120, height: 120, borderRadius: 10, marginTop: 10 },
  iconoCliente: { width: 44, height: 44, borderRadius: 22, backgroundColor: colores.azulSuave, alignItems: 'center', justifyContent: 'center' },
  burbuja: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  mia: { alignSelf: 'flex-end', backgroundColor: colores.azul, borderBottomRightRadius: 4 },
  otra: { alignSelf: 'flex-start', backgroundColor: colores.blanco, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colores.borde },
  autor: { fontSize: 12, fontWeight: '700', color: colores.naranjaOscuro, marginBottom: 2 },
  hora: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  barra: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: colores.blanco, borderTopWidth: 1, borderTopColor: colores.borde },
  entrada: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderColor: colores.borde, borderRadius: 22, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colores.texto, backgroundColor: colores.fondo },
  enviar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colores.naranjaOscuro, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }
});
