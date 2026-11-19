// src/components/MedidorPassword.js
// Barra de seguridad + lista de requisitos (como en la web).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NIVELES, REQUISITOS } from '../utils/password';
import { colores } from '../theme';

export default function MedidorPassword({ evaluacion }) {
  const n = evaluacion.nivel >= 0 ? NIVELES[evaluacion.nivel] : null;
  return (
    <View style={{ marginTop: -6, marginBottom: 14 }} accessibilityLiveRegion="polite">
      <View style={st.fila}>
        <View style={st.pista}>
          <View style={[st.barra, { width: n ? `${n.ancho}%` : '0%', backgroundColor: n ? n.color : 'transparent' }]} />
        </View>
        <Text style={[st.nivel, { color: n ? n.color : colores.gris }]}>{n ? n.texto : ''}</Text>
      </View>
      <View style={st.requisitos}>
        {REQUISITOS.map((r) => {
          const ok = evaluacion.cumple[r.id];
          return (
            <View key={r.id} style={st.requisito}>
              <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ok ? colores.verde : colores.gris} />
              <Text style={[st.requisitoTexto, { color: ok ? colores.verde : colores.gris }]}>{r.texto}</Text>
            </View>
          );
        })}
      </View>
      {evaluacion.aviso ? <Text style={st.aviso}>{evaluacion.aviso}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center' },
  pista: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colores.borde, overflow: 'hidden' },
  barra: { height: 6, borderRadius: 3 },
  nivel: { width: 78, textAlign: 'right', fontWeight: '700', fontSize: 12 },
  requisitos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  requisito: { flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 4 },
  requisitoTexto: { fontSize: 12, marginLeft: 4, flexShrink: 1 },
  aviso: { fontSize: 12, color: colores.gris, marginTop: 2 }
});
