// src/screens/PagoSimuladoScreen.js
// Pago de prueba cuando el servidor NO tiene Stripe configurado.
// Con Stripe activo, la app usa la página segura de Stripe y esta pantalla no se usa.

import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/cliente';
import { Aviso, Boton, Campo, Tarjeta } from '../components/ui';
import { colores } from '../theme';
import { formatoMXN } from '../utils/formato';

export default function PagoSimuladoScreen({ route, navigation }) {
  const { id, total, servicio } = route.params;
  const [numero, setNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const formatearNumero = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const formatearVence = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  async function pagar() {
    setError('');
    setCargando(true);
    try {
      const r = await api(`/solicitudes/${id}/pago/simulado`, { metodo: 'POST', cuerpo: { numero, titular, vencimiento, cvv } });
      Alert.alert('¡Pago realizado!', `Referencia: ${r.referencia}`, [{ text: 'Ver servicio', onPress: () => navigation.goBack() }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <View style={st.aviso}>
          <Text style={st.avisoTexto}>
            <Text style={{ fontWeight: '800' }}>Modo simulación: </Text>
            no se realiza ningún cargo real. Usa 4242 4242 4242 4242 (aprobada) o 4000 0000 0000 0002 (rechazada),
            cualquier fecha futura y cualquier CVV.
          </Text>
        </View>

        <Tarjeta estilo={{ marginBottom: 14 }}>
          <Text style={{ color: colores.gris }}>{servicio}</Text>
          <Text style={st.total}>{formatoMXN(total)} <Text style={{ fontSize: 14, color: colores.gris }}>MXN</Text></Text>
        </Tarjeta>

        <Aviso texto={error} />
        <Campo etiqueta="Número de tarjeta" value={numero} onChangeText={(v) => setNumero(formatearNumero(v))} keyboardType="number-pad" placeholder="1234 5678 9012 3456" />
        <Campo etiqueta="Nombre del titular" value={titular} onChangeText={setTitular} placeholder="Como aparece en la tarjeta" autoCapitalize="characters" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Campo etiqueta="Vencimiento" value={vencimiento} onChangeText={(v) => setVencimiento(formatearVence(v))} keyboardType="number-pad" placeholder="MM/AA" />
          </View>
          <View style={{ flex: 1 }}>
            <Campo etiqueta="CVV" value={cvv} onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry placeholder="123" />
          </View>
        </View>
        <Boton titulo={`Pagar ${formatoMXN(total)}`} icono="lock-closed-outline" onPress={pagar} cargando={cargando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  aviso: { backgroundColor: '#fff3cd', borderRadius: 12, padding: 12, marginBottom: 14 },
  avisoTexto: { color: '#856404', fontSize: 13, lineHeight: 19 },
  total: { fontSize: 26, fontWeight: '800', color: colores.verde, marginTop: 4 }
});
