import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, clearAuth, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [earnings, setEarnings] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);

  const load = useCallback(() => {
    api.get('/merchant/earnings').then(setEarnings).catch(() => undefined);
    api.get('/merchant/settlements').then((r) => setSettlements(Array.isArray(r) ? r : r.items ?? [])).catch(() => undefined);
  }, []);

  useFocusEffect(load);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1}>Earnings & more</Text>

        {earnings && (
          <View style={[s.card, { marginTop: 14 }]}>
            <Text style={s.h2}>Last 30 days</Text>
            <Row label="Gross sales" value={pkr(earnings.grossSalesPaisa)} />
            <Row label="Commission" value={`−${pkr(earnings.commissionPaisa)}`} />
            <Row label="Refund deductions" value={`−${pkr(earnings.refundDeductionsPaisa)}`} />
            <View style={{ borderTopWidth: 1, borderColor: colors.border, marginVertical: 8 }} />
            <Row label="Net payable" value={pkr(earnings.netPayablePaisa)} bold />
            <Text style={[s.faint, { marginTop: 6 }]}>{earnings.deliveredOrders} delivered orders</Text>
          </View>
        )}

        <View style={[s.card, { marginTop: 12 }]}>
          <Text style={s.h2}>Settlements</Text>
          {settlements.length === 0 && <Text style={[s.muted, { marginTop: 6 }]}>No settlements yet.</Text>}
          {settlements.slice(0, 10).map((st) => (
            <View key={st.id} style={[s.spread, { marginTop: 8 }]}>
              <View>
                <Text style={s.body}>{pkr(st.amountPaisa)}</Text>
                <Text style={s.faint}>
                  {new Date(st.startDate).toLocaleDateString()} → {new Date(st.endDate).toLocaleDateString()}
                </Text>
              </View>
              <Text
                style={{
                  color: st.status === 'PAID' ? colors.primary : colors.amber,
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                {st.status}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[s.btnGhost, { marginTop: 16 }]}
          onPress={async () => {
            await clearAuth();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        >
          <Text style={s.btnGhostText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[s.spread, { marginTop: 6 }]}>
      <Text style={s.muted}>{label}</Text>
      <Text style={[s.body, bold && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}
