import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Notice, PageHeading, ProductArtwork, StatePanel, usePageInset } from '../components/CustomerUI';
import { api, pkr } from '../lib/api';
import { publishCustomerEvent } from '../lib/customer-events';
import { pendingReplacements } from '../lib/customer-flow';
import { useOrderPresentation } from '../lib/order-presentation';
import { useTheme } from '../lib/theme';

export default function ReplacementScreen() {
  const navigation = useNavigation<any>(); const route = useRoute<any>();
  const { colors, s } = useTheme(); const inset = usePageInset();
  const { order, error, load } = useOrderPresentation(route.params.orderId);
  const [busy, setBusy] = useState(false); const [decision, setDecision] = useState<boolean | null>(null); const [actionError, setActionError] = useState('');
  const submitting = useRef(false);
  useEffect(() => { setDecision(null); setActionError(''); }, [route.params.orderId, route.params.originalItemId]);
  const replacement = pendingReplacements(order).find((entry: any) => entry.orderId === route.params.orderId && entry.item.replacementForItemId === route.params.originalItemId);
  const openOrder = () => navigation.navigate('OrderDetail', { orderId: route.params.orderId, mode: 'details' });
  const respond = async (accept: boolean) => {
    if (!replacement || submitting.current) return;
    submitting.current = true; setBusy(true); setActionError('');
    try {
      await api.post(`/orders/${replacement.orderId}/items/${replacement.item.replacementForItemId}/replacement`, { accept });
      setDecision(accept); publishCustomerEvent('orders'); load();
    } catch (cause: any) { setActionError(`${cause.message} Refresh the order before trying again to check whether this suggestion is still available.`); }
    finally { submitting.current = false; setBusy(false); }
  };
  const row = (item: any) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.border }}><View style={{ width: 58 }}><ProductArtwork uri={item?.productImageSnapshot} name={item?.productNameSnapshot} size={61} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 3 }}>{item?.productNameSnapshot ?? 'Unavailable item'}{item?.unitSnapshot ? ` · ${item.unitSnapshot}` : ''}</Text><Text style={s.muted}>{item?.quantity ?? '—'} × {Number.isFinite(item?.unitPricePaisa) ? pkr(item.unitPricePaisa) : 'Price unavailable'}</Text></View></View>;
  return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
    {decision !== null ? <StatePanel icon={decision ? 'check' : 'box'} title={decision ? 'Replacement accepted.' : 'Replacement declined.'} message="Your decision was saved. Check the order for its confirmed items and latest total." action="View order details" onPress={openOrder} /> : !order ? <StatePanel icon="box" loading={!error} title={error ? 'Couldn’t load this replacement' : 'Loading replacement…'} message={error || undefined} action={error ? 'Try again' : undefined} onPress={load} /> : !replacement ? <StatePanel icon="box" title="No replacement needs a decision." message="This suggestion may already have been answered or the order status changed. Check the saved order." action="View order details" onPress={openOrder} /> : <>
      <PageHeading title={'The shop suggests\na replacement.'} subtitle="Review before deciding. Nothing is accepted automatically." />
      <View style={[s.card, { marginTop: 20 }]}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: colors.muted }}>UNAVAILABLE</Text>
        {row(replacement.original)}
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.3, color: colors.muted, marginTop: 16 }}>PROPOSED REPLACEMENT</Text>
        {row(replacement.item)}
        <View style={{ marginTop: 12 }}><Notice tone="warning">{Number.isFinite(replacement.item.totalPricePaisa) && Number.isFinite(replacement.original?.totalPricePaisa) ? `Difference: ${replacement.item.totalPricePaisa >= replacement.original.totalPricePaisa ? '+' : '−'}${pkr(Math.abs(replacement.item.totalPricePaisa - replacement.original.totalPricePaisa))}. ` : ''}Final order totals must be confirmed by the server.</Notice></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void respond(false)} style={[s.btnGhost, { flex: 1, justifyContent: 'center', paddingHorizontal: 8 }]}><Text style={s.btnGhostText}>{busy ? 'Please wait…' : 'Decline'}</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void respond(true)} style={[s.btn, { flex: 1, justifyContent: 'center', paddingHorizontal: 8 }]}><Text style={[s.btnText, { fontSize: 12 }]}>{busy ? 'Please wait…' : 'Accept replacement'}</Text></TouchableOpacity></View>
    </>}
    {!!(error || actionError) && order && <View style={{ marginTop: 16 }}><Notice danger>{actionError || `${error} Refresh to check the current suggestion.`}</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12, justifyContent: 'center' }]} onPress={load}><Text style={s.btnGhostText}>Refresh order</Text></TouchableOpacity></View>}
  </ScrollView>;
}
