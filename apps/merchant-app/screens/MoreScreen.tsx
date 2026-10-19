import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, clearAuth, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';
import { GoogleAccountLink } from '../components/GoogleAccountLink';
import { AccountPolicies } from '../components/AccountPolicies';

export default function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [earnings, setEarnings] = useState<any>(null);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [canEditStore, setCanEditStore] = useState(false);

  const load = useCallback(() => {
    api.get('/merchant/earnings').then(setEarnings).catch(() => undefined);
    api.get('/merchant/settlements').then((r) => setSettlements(Array.isArray(r) ? r : r.items ?? [])).catch(() => undefined);
    api.get('/merchant/profile').then((profile) => { setIsOwner(!!profile.isOwner); setCanEditStore(!!profile.isOwner || (profile.permissions ?? []).includes('STORE')); }).catch(() => undefined);
  }, []);

  useFocusEffect(load);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1}>Earnings & more</Text>

        <TouchableOpacity style={[s.btnGhost, { marginTop: 16, minHeight: 48 }]} onPress={() => navigation.navigate('Notifications')}><Text style={s.btnGhostText}>Notifications</Text></TouchableOpacity>
        {canEditStore && <TouchableOpacity style={[s.btnGhost, { marginTop: 16, minHeight: 48 }]} onPress={() => navigation.navigate('ShopSettings')}><Text style={s.btnGhostText}>Shop settings</Text></TouchableOpacity>}
        <TouchableOpacity style={[s.btnGhost, { marginTop: 8, minHeight: 48 }]} onPress={() => navigation.navigate('Tour')}><Text style={s.btnGhostText}>Replay app tour</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btnGhost, { marginTop: 8, minHeight: 48 }]} onPress={() => void Linking.openURL('https://shop.sirfbazar.com/ipos')}><Text style={s.btnGhostText}>Open iPOS in browser</Text></TouchableOpacity>
        <TouchableOpacity style={[s.btnGhost, { marginTop: 8, minHeight: 48 }]} onPress={() => void Linking.openURL('https://shop.sirfbazar.com/products')}><Text style={s.btnGhostText}>Import CSV or Excel on web</Text></TouchableOpacity>
        {isOwner && <TouchableOpacity style={[s.btnGhost, { marginTop: 16, minHeight: 48 }]} onPress={() => navigation.navigate('Team')}><Text style={s.btnGhostText}>Manage your team</Text></TouchableOpacity>}

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

        <GoogleAccountLink />
        <AccountPolicies color={colors.primary} textColor={colors.muted} />
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
