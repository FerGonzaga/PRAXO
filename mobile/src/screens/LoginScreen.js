// src/screens/LoginScreen.js

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Aviso, Boton, Campo } from '../components/ui';
import { colores } from '../theme';

export default function LoginScreen({ navigation }) {
  const { iniciarSesion } = useAuth();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setError('');
    if (!correo.trim() || !password) {
      setError('Escribe tu correo y contraseña.');
      return;
    }
    setCargando(true);
    try {
      await iniciarSesion(correo, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colores.azul }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.contenido} keyboardShouldPersistTaps="handled">
          <View style={st.marca}>
            <Text style={st.logo}>PRAX<Text style={{ color: colores.naranja }}>O</Text></Text>
            <Text style={st.lema}>Find. Connect. Solve.</Text>
          </View>

          <View style={st.caja}>
            <Text style={st.titulo}>Inicia sesión</Text>
            <Text style={st.subtitulo}>Encuentra profesionales o recibe solicitudes de clientes.</Text>

            <Aviso texto={error} />

            <Campo etiqueta="Correo electrónico" value={correo} onChangeText={setCorreo}
              placeholder="tucorreo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Campo etiqueta="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Tu contraseña" secureTextEntry autoComplete="password" onSubmitEditing={entrar} />

            <Boton titulo="Entrar" onPress={entrar} cargando={cargando} icono="log-in-outline" />

            <Pressable onPress={() => navigation.navigate('Registro')} style={{ marginTop: 18 }}>
              <Text style={st.enlace}>¿No tienes cuenta? <Text style={{ fontWeight: '700' }}>Regístrate</Text></Text>
            </Pressable>
          </View>

          <Text style={st.nota}>Clientes y prestadores de servicios usan la misma cuenta que en la página web.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  marca: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 44, fontWeight: '900', color: colores.blanco, letterSpacing: 2 },
  lema: { color: '#c7d2e3', marginTop: 4 },
  caja: { backgroundColor: colores.blanco, borderRadius: 20, padding: 22 },
  titulo: { fontSize: 22, fontWeight: '800', color: colores.texto },
  subtitulo: { color: colores.gris, marginTop: 4, marginBottom: 18 },
  enlace: { textAlign: 'center', color: colores.naranjaOscuro },
  nota: { color: '#c7d2e3', textAlign: 'center', marginTop: 22, fontSize: 12 }
});
