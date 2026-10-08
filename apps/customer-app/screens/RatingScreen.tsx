import { ToastMessage } from '../components/Toast';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ActionDock, Field, Icon, Notice, StatePanel, usePageInset } from '../components/CustomerUI';
import { api } from '../lib/api';
import { publishCustomerEvent } from '../lib/customer-events';
import { orderDeliveries, useOrderPresentation } from '../lib/order-presentation';
import { useTheme } from '../lib/theme';
import { OrderArt } from './OrderSentScreen';

export default function RatingScreen() {
  const navigation = useNavigation<any>(); const route = useRoute<any>();
  const { colors, s } = useTheme(); const inset = usePageInset();
  const { order, error, load } = useOrderPresentation(route.params.orderId);
  const [stars, setStars] = useState(0); const [review, setReview] = useState(''); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [actionError, setActionError] = useState('');
  const submitting = useRef(false);
  useEffect(() => { setStars(0); setReview(''); setSaved(false); setActionError(''); }, [route.params.orderId]);
  const openOrder = () => navigation.navigate('OrderDetail', { orderId: route.params.orderId, mode: 'details' });
  const submit = async () => {
    if (submitting.current) return;
    if (!stars) { setActionError('Choose a star rating before submitting your review.'); return; }
    if (!order || order.isParent || order.status !== 'DELIVERED') { setActionError('A review is available after this shop’s delivery is complete. Refresh the order to check.'); return; }
    submitting.current = true; setBusy(true); setActionError('');
    try { await api.post(`/orders/${order.id}/rate`, { merchantRating: stars, ...(review.trim() ? { reviewText: review.trim() } : {}) }); setSaved(true); publishCustomerEvent('orders'); }
    catch (cause: any) { setActionError(`${cause.message} Your review has not been confirmed. You can try submitting it again.`); }
    finally { submitting.current = false; setBusy(false); }
  };
  const eligible = order && !order.isParent && order.status === 'DELIVERED';
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={58}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
      {saved ? <StatePanel icon="check" title="Thanks for your review." message="Your review was saved." action="View order details" onPress={openOrder} /> : !order ? <StatePanel icon="star" loading={!error} title={error ? 'Couldn’t load this order' : 'Loading order…'} message={error || undefined} action={error ? 'Try again' : undefined} onPress={load} /> : order.isParent ? <><StatePanel icon="star" title="Choose a delivered shop." message="Each shop’s delivery can be reviewed separately." />{orderDeliveries(order).filter((delivery) => delivery.status === 'DELIVERED').map((delivery) => <TouchableOpacity key={delivery.id} accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={() => navigation.replace('Rating', { orderId: delivery.id })}><Text style={s.btnGhostText}>{delivery.merchant?.shopName ?? 'Review delivery'}</Text></TouchableOpacity>)}</> : !eligible ? <StatePanel icon="star" title="Your review can wait." message="You can rate this shop after your order is delivered." action="View order details" onPress={openOrder} /> : <>
        <OrderArt icon="star" />
        <Text accessibilityRole="header" style={[s.h1, { textAlign: 'center' }]}>{'How was\nyour order?'}</Text>
        <Text style={[s.muted, { textAlign: 'center', marginTop: 12 }]}>{order.merchant?.shopName ?? 'Your shop'} · Delivered</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Order rating" style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 20, marginHorizontal: 5 }}>{[1, 2, 3, 4, 5].map((value) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityLabel={`Rate ${value} ${value === 1 ? 'star' : 'stars'}`} accessibilityState={{ checked: stars === value, disabled: busy }} disabled={busy} onPress={() => { setStars(value); setActionError(''); }} style={{ width: 47, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: value <= stars ? colors.emeraldBg : 'transparent' }}><Icon name="star" size={29} color={value <= stars ? colors.primary : colors.control} /></TouchableOpacity>)}</View>
        <Field label="Tell us more · optional" value={review} onChangeText={setReview} editable={!busy} multiline placeholder="What went well? What could improve?" maxLength={4000} />
        <Text style={[s.faint, { lineHeight: 17, marginTop: 16 }]}>Reviews are optional. Your review is saved only after you submit and receive confirmation.</Text>
      </>}
      {!!actionError && <View style={{ marginTop: 16 }}><ToastMessage>{actionError}</ToastMessage></View>}
      {!!error && order && <View style={{ marginTop: 16 }}><ToastMessage>{error} Refresh to check this delivery’s status.</ToastMessage><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12 }]} onPress={load}><Text style={s.btnGhostText}>Refresh order</Text></TouchableOpacity></View>}
    </ScrollView>
    {eligible && !saved && <ActionDock><TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void submit()} style={[s.btn, { justifyContent: 'center' }]}><Text style={s.btnText}>{busy ? 'Submitting review…' : 'Submit review'}</Text></TouchableOpacity></ActionDock>}
  </KeyboardAvoidingView>;
}
