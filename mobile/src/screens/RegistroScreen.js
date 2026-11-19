// src/screens/RegistroScreen.js
// Registro de CLIENTE con el mismo consentimiento que la web (términos + aviso de privacidad).

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/cliente';
import { Aviso, Boton, Campo, Casilla, EstadoVacio } from '../components/ui';
import { colores } from '../theme';
import { abrirWeb } from '../utils/web';

export default function RegistroScreen({ navigation }) {
  const [f, setF] = useState({ nombre: '', correo: '', password: '', confirmar: '' });
  const [terminos, setTerminos] = useState(false);
  const [privacidad, setPrivacidad] = useState(false);
  const [promociones, setPromociones] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);

  const cambiar = (campo) => (valor) => setF((x) => ({ ...x, [campo]: valor }));

  async function registrar() {
    setError('');
    if (!f.nombre.trim() || !f.correo.trim() || !f.password) return setError('Completa todos los campos.');
    if (f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (f.password !== f.confirmar) return setError('Las contraseñas no coinciden.');
    if (!terminos) return setError('Debes aceptar los Términos y Condiciones.');
    if (!privacidad) return setError('Debes aceptar el Aviso de Privacidad.');

    setCargando(true);
    try {
      await api('/auth/registro', {
        metodo: 'POST',
        cuerpo: {
          nombre: f.nombre.trim(),
          correo: f.correo.trim(),
          password: f.password,
          aceptaTerminos: true,
          aceptaPrivacidad: true,
          aceptaPromociones: promociones
        }
      });
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
        <Aviso texto={error} />

        <Campo etiqueta="Nombre completo" value={f.nombre} onChangeText={cambiar('nombre')} placeholder="Ana López" autoComplete="name" />
        <Campo etiqueta="Correo electrónico" value={f.correo} onChangeText={cambiar('correo')} placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Campo etiqueta="Contraseña" value={f.password} onChangeText={cambiar('password')} placeholder="Mínimo 8 caracteres" secureTextEntry />
        <Campo etiqueta="Confirmar contraseña" value={f.confirmar} onChangeText={cambiar('confirmar')} secureTextEntry />

        <View style={st.aviso}>
          <Text style={st.avisoTexto}>
            <Text style={{ fontWeight: '700' }}>Aviso de privacidad simplificado: </Text>
            PRAXO usará tus datos para crear tu cuenta, conectarte con prestadores y gestionar tus servicios, pagos y reseñas.
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

        <Boton titulo="Crear cuenta" onPress={registrar} cargando={cargando} icono="person-add-outline" estilo={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  aviso: { backgroundColor: colores.azulSuave, borderRadius: 12, padding: 12, marginBottom: 14 },
  avisoTexto: { color: colores.azul700, fontSize: 13, lineHeight: 19 },
  texto: { color: colores.texto, lineHeight: 20 },
  enlace: { color: colores.naranjaOscuro, fontWeight: '700', textDecorationLine: 'underline' }
});
