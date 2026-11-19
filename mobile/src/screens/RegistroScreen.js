// src/screens/RegistroScreen.js
// Registro de CLIENTE o PRESTADOR con el mismo consentimiento y las mismas
// reglas de contraseña que la web. Al terminar se verifica el correo.

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/cliente';
import { useConfig } from '../context/ConfigContext';
import { Aviso, Boton, Campo, Casilla, EstadoVacio } from '../components/ui';
import MedidorPassword from '../components/MedidorPassword';
import { colores, radio } from '../theme';
import { evaluarPassword } from '../utils/password';
import { abrirWeb } from '../utils/web';

export default function RegistroScreen({ navigation }) {
  const { config } = useConfig();
  const oficios = (config && config.oficios) || ['Electricista', 'Plomero', 'Cerrajero', 'Albañil', 'Pintor'];

  const [tipo, setTipo] = useState('cliente');
  const [f, setF] = useState({
    nombre: '', correo: '', password: '', confirmar: '',
    oficio: '', telefono: '', ciudad: '', descripcion: '', conceptoPrecio: '', tarifaPrecio: ''
  });
  const [terminos, setTerminos] = useState(false);
  const [privacidad, setPrivacidad] = useState(false);
  const [promociones, setPromociones] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  const cambiar = (campo) => (valor) => setF((x) => ({ ...x, [campo]: valor }));
  const evaluacion = evaluarPassword(f.password, f.nombre, f.correo);
  const coinciden = f.confirmar.length > 0 && f.confirmar === f.password;
  const esPrestador = tipo === 'prestador';

  async function registrar() {
    setError('');
    if (!f.nombre.trim() || !f.correo.trim() || !f.password) return setError('Completa todos los campos.');
    if (!evaluacion.todos) return setError('Tu contraseña aún no cumple los requisitos marcados abajo del campo.');
    if (!evaluacion.valida) return setError(evaluacion.aviso);
    if (f.password !== f.confirmar) return setError('Las contraseñas no coinciden.');
    if (esPrestador && (!f.oficio || !f.telefono.trim() || !f.ciudad.trim())) {
      return setError('Completa tu oficio, teléfono y ciudad.');
    }
    if (!terminos) return setError('Debes aceptar los Términos y Condiciones.');
    if (!privacidad) return setError('Debes aceptar el Aviso de Privacidad.');

    const cuerpo = {
      tipoUsuario: tipo,
      nombre: f.nombre.trim(),
      correo: f.correo.trim(),
      password: f.password,
      aceptaTerminos: true,
      aceptaPrivacidad: true,
      aceptaPromociones: promociones
    };
    if (esPrestador) {
      Object.assign(cuerpo, {
        oficio: f.oficio,
        telefono: f.telefono.trim(),
        ciudad: f.ciudad.trim(),
        descripcion: f.descripcion.trim(),
        conceptoPrecio: f.conceptoPrecio.trim(),
        tarifaPrecio: f.tarifaPrecio.trim()
      });
    }

    setCargando(true);
    try {
      await api('/auth/registro', { metodo: 'POST', cuerpo });
      setListo(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  if (listo) {
    return (
      <EstadoVacio
        icono="mail-unread-outline"
        titulo="¡Revisa tu correo!"
        texto={`Enviamos un enlace de verificación a ${f.correo.trim()}. Ábrelo y después inicia sesión.`}
        accion={<Boton titulo="Ir a iniciar sesión" onPress={() => navigation.navigate('Login')} estilo={{ alignSelf: 'stretch' }} />}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* TIPO DE CUENTA */}
        <Text style={st.etiqueta}>¿Cómo usarás PRAXO?</Text>
        <View style={st.tipos}>
          {[
            { id: 'cliente', icono: 'person-outline', titulo: 'Busco servicios', texto: 'Cliente' },
            { id: 'prestador', icono: 'construct-outline', titulo: 'Ofrezco servicios', texto: 'Prestador' }
          ].map((t) => (
            <Pressable key={t.id} onPress={() => setTipo(t.id)} style={[st.tipo, tipo === t.id && st.tipoActivo]}>
              <Ionicons name={t.icono} size={24} color={tipo === t.id ? colores.blanco : colores.azul} />
              <Text style={[st.tipoTitulo, tipo === t.id && { color: colores.blanco }]}>{t.titulo}</Text>
              <Text style={[st.tipoTexto, tipo === t.id && { color: '#c7d2e3' }]}>{t.texto}</Text>
            </Pressable>
          ))}
        </View>

        <Aviso texto={error} />

        <Campo etiqueta="Nombre completo" value={f.nombre} onChangeText={cambiar('nombre')} placeholder="Ana López" autoComplete="name" />
        <Campo etiqueta="Correo electrónico" value={f.correo} onChangeText={cambiar('correo')} placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Campo etiqueta="Contraseña" value={f.password} onChangeText={cambiar('password')} placeholder="Crea una contraseña segura"
          secureTextEntry autoComplete="new-password" textContentType="newPassword" maxLength={72} />
        <MedidorPassword evaluacion={evaluacion} />
        <Campo etiqueta="Confirmar contraseña" value={f.confirmar} onChangeText={cambiar('confirmar')} secureTextEntry
          autoComplete="new-password" textContentType="newPassword" maxLength={72}
          error={f.confirmar && !coinciden ? 'Las contraseñas no coinciden.' : ''} />

        {/* DATOS DEL PRESTADOR */}
        {esPrestador ? (
          <View style={st.seccion}>
            <Text style={st.seccionTitulo}>Información de tu servicio</Text>
            <Text style={st.etiqueta}>Oficio</Text>
            <View style={st.chips}>
              {oficios.map((o) => (
                <Pressable key={o} onPress={() => cambiar('oficio')(o)} style={[st.chip, f.oficio === o && st.chipActivo]}>
                  <Text style={[st.chipTexto, f.oficio === o && { color: colores.blanco }]}>{o}</Text>
                </Pressable>
              ))}
            </View>
            <Campo etiqueta="Teléfono" value={f.telefono} onChangeText={cambiar('telefono')} keyboardType="phone-pad" placeholder="Ej. 7711234567" />
            <Campo etiqueta="Ciudad" value={f.ciudad} onChangeText={cambiar('ciudad')} placeholder="Ej. Mixquiahuala de Juárez" />
            <Campo etiqueta="Descripción de tus servicios (opcional)" value={f.descripcion} onChangeText={cambiar('descripcion')} multilinea
              placeholder="Describe brevemente lo que ofreces" />
            <Text style={st.etiqueta}>Tarifa de referencia (opcional)</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.3 }}>
                <Campo value={f.conceptoPrecio} onChangeText={cambiar('conceptoPrecio')} placeholder="Ej. Por hora" maxLength={50} />
              </View>
              <View style={{ flex: 1 }}>
                <Campo value={f.tarifaPrecio} onChangeText={cambiar('tarifaPrecio')} placeholder="$ 250" keyboardType="number-pad" />
              </View>
            </View>
          </View>
        ) : null}

        <View style={st.aviso}>
          <Text style={st.avisoTexto}>
            <Text style={{ fontWeight: '700' }}>Aviso de privacidad simplificado: </Text>
            PRAXO usará tus datos para crear tu cuenta, conectarte con clientes o prestadores y gestionar tus servicios, pagos y reseñas.
          </Text>
        </View>

        <Casilla marcada={terminos} onCambiar={setTerminos}>
          <Text style={st.texto}>
            Acepto los <Text style={st.enlace} onPress={() => abrirWeb('/terminos')}>Términos y Condiciones</Text>
            <Text style={{ color: colores.rojo }}> *</Text>
          </Text>
        </Casilla>
        <Casilla marcada={privacidad} onCambiar={setPrivacidad}>
          <Text style={st.texto}>
            He leído el <Text style={st.enlace} onPress={() => abrirWeb('/aviso-privacidad')}>Aviso de Privacidad</Text> y otorgo
            mi consentimiento expreso para el tratamiento de mis datos personales.
            <Text style={{ color: colores.rojo }}> *</Text>
          </Text>
        </Casilla>
        <Casilla marcada={promociones} onCambiar={setPromociones}>
          <Text style={[st.texto, { color: colores.gris }]}>(Opcional) Quiero recibir promociones, novedades y encuestas de PRAXO.</Text>
        </Casilla>

        <Boton titulo={esPrestador ? 'Crear cuenta de prestador' : 'Crear cuenta'} onPress={registrar} cargando={cargando}
          icono="person-add-outline" estilo={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  etiqueta: { fontSize: 13, fontWeight: '600', color: colores.texto, marginBottom: 6 },
  tipos: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tipo: { flex: 1, alignItems: 'center', padding: 14, borderRadius: radio, borderWidth: 1.5, borderColor: colores.borde, backgroundColor: colores.blanco },
  tipoActivo: { backgroundColor: colores.azul, borderColor: colores.azul },
  tipoTitulo: { fontWeight: '800', color: colores.texto, marginTop: 6 },
  tipoTexto: { color: colores.gris, fontSize: 12 },
  seccion: { borderTopWidth: 1, borderTopColor: colores.borde, paddingTop: 16, marginTop: 4, marginBottom: 6 },
  seccionTitulo: { fontSize: 16, fontWeight: '800', color: colores.texto, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderColor: colores.borde, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colores.blanco },
  chipActivo: { backgroundColor: colores.azul, borderColor: colores.azul },
  chipTexto: { color: colores.azul, fontWeight: '600' },
  aviso: { backgroundColor: colores.azulSuave, borderRadius: 12, padding: 12, marginBottom: 14 },
  avisoTexto: { color: colores.azul700, fontSize: 13, lineHeight: 19 },
  texto: { color: colores.texto, lineHeight: 20 },
  enlace: { color: colores.naranjaOscuro, fontWeight: '700', textDecorationLine: 'underline' }
});
