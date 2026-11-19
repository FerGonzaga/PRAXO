// src/screens/PerfilPrestadorScreen.js
// PRESTADOR: resumen, disponibilidad, precio base, reseñas y cuenta.
// Los cambios se guardan en el mismo perfil que ve la web (y los clientes en su búsqueda).

import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { useAuth } from '../context/AuthContext';
import { Aviso, Avatar, Boton, Campo, Cargando, Estrellas, Tarjeta } from '../components/ui';
import { colores } from '../theme';
import { formatoMXN, mesAnio } from '../utils/formato';
import { abrirWeb } from '../utils/web';

const UNIDADES = [
  { id: 'servicio', texto: 'Por servicio' },
  { id: 'hora', texto: 'Por hora' },
  { id: 'dia', texto: 'Por día' }
];

export default function PerfilPrestadorScreen({ navigation }) {
  const { usuario, cerrarSesion, cerrarEnTodos } = useAuth();
  const [datos, setDatos] = useState(null);
  const [resenas, setResenas] = useState([]);
  const [error, setError] = useState('');
  const [refrescando, setRefrescando] = useState(false);

  const [disponible, setDisponible] = useState(false);
  const [guardandoDisp, setGuardandoDisp] = useState(false);

  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('servicio');
  const [nota, setNota] = useState('');
  const [sinPrecio, setSinPrecio] = useState(false);
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError('');
      const [d, r] = await Promise.all([api('/prestador/perfil'), api('/prestador/resenas')]);
      setDatos(d);
      setResenas(r.resenas);
      setDisponible(d.perfil.disponibleAhora);
      setPrecio(d.perfil.precioBase ? String(d.perfil.precioBase) : '');
      setUnidad(d.perfil.unidadPrecio || 'servicio');
      setNota(d.perfil.precioNota || '');
      setSinPrecio(d.perfil.precioBase === null || d.perfil.precioBase === undefined);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  async function cambiarDisponible(valor) {
    setDisponible(valor);
    setGuardandoDisp(true);
    try {
      const r = await api('/prestador/disponibilidad', { metodo: 'POST', cuerpo: { disponible: valor } });
      setDisponible(r.disponible);
    } catch (e) {
      setDisponible(!valor);
      Alert.alert('No se guardó', e.message);
    } finally {
      setGuardandoDisp(false);
    }
  }

  async function guardarPrecio() {
    setGuardandoPrecio(true);
    try {
      const r = await api('/prestador/precio', {
        metodo: 'POST',
        cuerpo: { precio: Number(String(precio).replace(',', '.')), unidad, nota, sinPrecio }
      });
      Alert.alert('Precio guardado', r.mensaje);
      cargar();
    } catch (e) {
      Alert.alert('No se guardó', e.message);
    } finally {
      setGuardandoPrecio(false);
    }
  }

  const salirDeTodos = () => Alert.alert('Cerrar sesión en todos los dispositivos', 'Tendrás que volver a iniciar sesión en cada teléfono.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cerrar en todos', style: 'destructive', onPress: () => cerrarEnTodos() }
  ]);

  if (!datos && !error) return <Cargando />;

  const p = datos ? datos.perfil : null;
  const r = datos ? datos.resumen : null;
  const comision = datos ? datos.comisionPorcentaje : 10;
  const iva = datos ? datos.ivaPorcentaje : 16;
  const valorPrecio = Number(String(precio).replace(',', '.')) || 0;
  const totalCliente = Math.round((valorPrecio * (1 + (comision / 100) * (1 + iva / 100))) * 100) / 100;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}>
      <Aviso texto={error} />

      {p ? (
        <>
          <Tarjeta estilo={{ alignItems: 'center' }}>
            <Avatar nombre={p.nombre} url={p.fotoUrl} tamano={80} />
            <Text style={st.nombre}>{p.nombre}</Text>
            <Text style={st.gris}>{p.oficio}{p.ciudad ? ` · ${p.ciudad}` : ''}</Text>
            <View style={[st.fila, { marginTop: 8 }]}>
              {p.calificacion !== null ? (
                <><Estrellas valor={p.calificacion} tamano={16} /><Text style={st.gris}> {p.calificacion.toFixed(1)} · {p.totalResenas} reseña(s)</Text></>
              ) : <Text style={st.gris}>Sin reseñas aún</Text>}
            </View>
            <Pressable onPress={() => navigation.navigate('Trabajador', { id: p.id })} style={{ marginTop: 10 }}>
              <Text style={st.enlace}>Ver mi perfil público</Text>
            </Pressable>
          </Tarjeta>

          {/* RESUMEN */}
          <View style={st.resumen}>
            <Dato numero={r.pendientes} texto="Por cotizar" color={colores.naranjaOscuro} />
            <Dato numero={r.enCurso} texto="En curso" color={colores.azul500} />
            <Dato numero={r.completados} texto="Completados" color={colores.verde} />
          </View>
          <Tarjeta estilo={{ marginTop: 12 }}>
            <Text style={st.gris}>Total recibido por servicios pagados</Text>
            <Text style={st.dinero}>{formatoMXN(r.totalRecibido)}</Text>
          </Tarjeta>

          {/* DISPONIBILIDAD */}
          <Tarjeta estilo={{ marginTop: 12 }}>
            <View style={st.filaEntre}>
              <View style={{ flex: 1 }}>
                <Text style={st.subtitulo}>{disponible ? '🟢 Disponible ahora' : '⚪ No disponible'}</Text>
                <Text style={st.gris}>Los clientes verán una insignia "Disponible ahora" en tu perfil.</Text>
              </View>
              <Switch value={disponible} onValueChange={cambiarDisponible} disabled={guardandoDisp} trackColor={{ true: colores.verde }} />
            </View>
          </Tarjeta>

          {/* PRECIO BASE */}
          <Tarjeta estilo={{ marginTop: 12 }}>
            <Text style={st.subtitulo}>Mi precio base</Text>
            <View style={[st.filaEntre, { marginBottom: 12 }]}>
              <Text style={{ color: colores.texto, flex: 1 }}>Prefiero cotizar cada trabajo (sin precio base)</Text>
              <Switch value={sinPrecio} onValueChange={setSinPrecio} trackColor={{ true: colores.naranja }} />
            </View>
            {!sinPrecio ? (
              <>
                <Campo etiqueta="Precio (MXN) — tú recibes el 100%" value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" placeholder="Ej. 350" />
                <View style={[st.fila, { gap: 8, marginBottom: 12 }]}>
                  {UNIDADES.map((u) => (
                    <Pressable key={u.id} onPress={() => setUnidad(u.id)} style={[st.chip, unidad === u.id && st.chipActivo]}>
                      <Text style={[st.chipTexto, unidad === u.id && { color: colores.blanco }]}>{u.texto}</Text>
                    </Pressable>
                  ))}
                </View>
                {valorPrecio > 0 ? (
                  <Text style={[st.gris, { marginBottom: 12 }]}>
                    Los clientes verán: <Text style={{ fontWeight: '800', color: colores.texto }}>Desde {formatoMXN(totalCliente)}</Text> (incluye comisión PRAXO {comision}% e IVA)
                  </Text>
                ) : null}
              </>
            ) : null}
            <Campo etiqueta="Nota (opcional)" value={nota} onChangeText={setNota} maxLength={140} placeholder="Ej. Incluye revisión y diagnóstico" />
            <Boton titulo="Guardar precio" icono="pricetag-outline" onPress={guardarPrecio} cargando={guardandoPrecio} />
          </Tarjeta>

          {/* RESEÑAS */}
          <Text style={[st.subtitulo, { marginTop: 20, marginBottom: 8 }]}>Mis reseñas</Text>
          {resenas.length === 0 ? <Text style={st.gris}>Aún no tienes reseñas.</Text> : resenas.map((x, i) => (
            <Tarjeta key={i} estilo={{ marginBottom: 10 }}>
              <View style={st.filaEntre}>
                <Text style={{ fontWeight: '700', color: colores.texto }}>{x.cliente}</Text>
                <Text style={[st.gris, { fontSize: 12 }]}>{mesAnio(x.fecha)}</Text>
              </View>
              <Estrellas valor={x.calificacion} />
              {x.comentario ? <Text style={{ color: colores.texto, marginTop: 4 }}>{x.comentario}</Text> : null}
            </Tarjeta>
          ))}
        </>
      ) : null}

      {/* CUENTA */}
      <Tarjeta estilo={{ marginTop: 16, padding: 0 }}>
        {[
          { icono: 'shield-checkmark-outline', texto: 'Centro de privacidad', ruta: '/perfil/privacidad' },
          { icono: 'bag-check-outline', texto: 'Políticas', ruta: '/politicas' },
          { icono: 'document-text-outline', texto: 'Términos y condiciones', ruta: '/terminos' }
        ].map((e, i) => (
          <Pressable key={e.ruta} onPress={() => abrirWeb(e.ruta)} style={[st.enlaceFila, i > 0 && st.separador]}>
            <Ionicons name={e.icono} size={20} color={colores.azul} />
            <Text style={{ flex: 1, marginLeft: 12, color: colores.texto }}>{e.texto}</Text>
            <Ionicons name="open-outline" size={16} color={colores.gris} />
          </Pressable>
        ))}
      </Tarjeta>
      <Text style={[st.gris, { textAlign: 'center', marginTop: 16 }]}>{usuario.correo}</Text>
      <Boton titulo="Cerrar sesión" variante="oscuro" icono="log-out-outline" onPress={cerrarSesion} estilo={{ marginTop: 10 }} />
      <Boton titulo="Cerrar sesión en todos los dispositivos" variante="peligro" onPress={salirDeTodos} estilo={{ marginTop: 10 }} />
    </ScrollView>
  );
}

function Dato({ numero, texto, color }) {
  return (
    <Tarjeta estilo={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color }}>{numero}</Text>
      <Text style={{ color: colores.gris, fontSize: 12 }}>{texto}</Text>
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 20, fontWeight: '800', color: colores.texto, marginTop: 10 },
  gris: { color: colores.gris },
  enlace: { color: colores.naranjaOscuro, fontWeight: '700' },
  subtitulo: { fontSize: 16, fontWeight: '800', color: colores.texto, marginBottom: 4 },
  resumen: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dinero: { fontSize: 24, fontWeight: '800', color: colores.verde, marginTop: 2 },
  chip: { borderWidth: 1, borderColor: colores.borde, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  chipActivo: { backgroundColor: colores.azul, borderColor: colores.azul },
  chipTexto: { color: colores.azul, fontWeight: '600' },
  enlaceFila: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  separador: { borderTopWidth: 1, borderTopColor: colores.borde }
});
