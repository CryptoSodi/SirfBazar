import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { AddButton } from '../components/AddButton';
import { ActionDock, Notice, ProductArtwork, ProductCard, SectionTitle, StatePanel, usePageInset } from '../components/CustomerUI';
import { api, getConfirmedLocation, pkr } from '../lib/api';
import { subscribeCustomerEvent } from '../lib/customer-events';
import { useTheme } from '../lib/theme';

export default function ProductScreen() {
  const { colors, s } = useTheme(); const inset = usePageInset(); const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Product'>>();
  const [product, setProduct] = useState<any>(null); const [error, setError] = useState(''); const [selectedId, setSelectedId] = useState<string | undefined>(route.params.merchantProductId);
  const [located, setLocated] = useState(false); const revision = useRef(0);
  useEffect(() => { setProduct(null); setError(''); setSelectedId(route.params.merchantProductId); return () => { revision.current++; }; }, [route.params.productId, route.params.merchantProductId]);
  const load = useCallback(() => {
    const current = ++revision.current;
    void (async () => {
      const location = await getConfirmedLocation();
      const query = location ? `?latitude=${location.latitude}&longitude=${location.longitude}` : '';
      const data = await api.get(`/products/${route.params.productId}${query}`);
      if (current !== revision.current) return;
      setProduct(data); setLocated(!!location); setError('');
      // Never replace an explicit seller, including one that disappeared on refresh.
      setSelectedId((previous) => previous ?? route.params.merchantProductId ?? data.offers?.find((offer: any) => offer.isAvailable && offer.stockQuantity > 0)?.merchantProductId ?? data.offers?.[0]?.merchantProductId);
    })().catch((cause: any) => { if (current === revision.current) { setError(cause.message || 'Unable to load the product. Try again.'); if (cause.status === 404) setProduct(null); } });
  }, [route.params.productId, route.params.merchantProductId]);
  useFocusEffect(useCallback(() => { load(); const unsubscribe = subscribeCustomerEvent('location', load); return () => { revision.current++; unsubscribe(); }; }, [load]));
  if (!product) return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset, paddingTop: 12 }}><StatePanel icon="box" title={error ? 'Couldn’t load this product' : 'Loading product…'} loading={!error} message={error || undefined} action={error ? 'Try again' : undefined} onPress={load} /></ScrollView>;
  const offer = product.offers?.find((entry: any) => entry.merchantProductId === selectedId);
  const price = offer?.discountPricePaisa ?? offer?.pricePaisa;
  const restricted = product.isRestricted || product.requiresPrescription;
  const available = !!offer?.isAvailable && offer.stockQuantity > 0 && Number.isFinite(price) && !restricted;
  const similar: any[] = (product.similar ?? []).slice(0, 2);
  return <View style={s.screen}>
    <ScrollView contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
      <View style={{ height: 216, borderRadius: 22, backgroundColor: colors.imageStage, alignItems: 'center', justifyContent: 'center', marginTop: 2, marginBottom: 18 }}><View style={{ width: 235, maxWidth: '100%' }}><ProductArtwork uri={product.imageUrl} name={product.name} size={201} /></View></View>
      <Text style={{ color: colors.muted, textTransform: 'uppercase', fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>{product.category?.name ?? product.brand ?? 'Product details'}</Text>
      <Text accessibilityRole="header" style={[s.h1, { marginTop: 8 }]}>{product.name}</Text>
      <Text style={[s.body, { color: colors.muted, marginTop: 8 }]}>{product.size ?? product.unit ?? 'Pack size not provided'}</Text>
      <Text style={[s.muted, { marginTop: 16 }]}>{product.description || 'Check the seller and pack size before adding.'}</Text>
      <SectionTitle title="Choose your shop" />
      <View accessibilityRole="radiogroup" accessibilityLabel="Shop selling this product">
        {(product.offers ?? []).map((entry: any) => {
          const selected = selectedId === entry.merchantProductId; const inStock = !!entry.isAvailable && entry.stockQuantity > 0; const entryPrice = entry.discountPricePaisa ?? entry.pricePaisa;
          return <TouchableOpacity key={entry.merchantProductId} accessibilityRole="radio" accessibilityLabel={`${entry.merchant?.shopName ?? 'Shop'}, ${Number.isFinite(entryPrice) ? pkr(entryPrice) : 'price unavailable'}, ${inStock ? 'in stock' : 'unavailable'}`} accessibilityState={{ checked: selected }} onPress={() => setSelectedId(entry.merchantProductId)} style={{ marginTop: 10, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, borderRadius: 15, padding: 14, minHeight: 69, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: selected ? colors.emeraldBg : colors.card }}>
            <View style={{ width: 18, height: 18, borderWidth: 1.5, borderColor: colors.control, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>{selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{entry.merchant?.shopName ?? 'Shop details unavailable'}</Text><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{inStock ? `In stock · ${entry.stockQuantity} ${entry.stockQuantity === 1 ? 'pack' : 'packs'} listed` : 'Currently unavailable'}</Text></View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1, fontVariant: ['tabular-nums'] }}>{Number.isFinite(entryPrice) ? pkr(entryPrice) : 'Price unavailable'}</Text>
          </TouchableOpacity>;
        })}
      </View>
      {!product.offers?.length && <Notice tone="warning">{located ? 'No shop in your selected area currently lists this product.' : 'No shop currently lists this product. Try another product or choose a delivery area.'}</Notice>}
      {!!selectedId && !offer && product.offers?.length > 0 && <View style={{ marginTop: 12 }}><Notice tone="warning">Your selected shop is no longer available for this product. Choose a shop before adding.</Notice></View>}
      <Text style={[s.muted, { marginTop: 12 }]}>Sold and delivered by the selected shop. Delivery charges are shown in your basket.</Text>
      {restricted && <View style={{ marginTop: 12 }}><Notice tone="warning">{product.requiresPrescription ? 'This product requires a prescription and cannot be added through this checkout.' : 'This restricted product cannot be added through this checkout.'}</Notice></View>}
      {!!error && <View style={{ marginTop: 16 }}><Notice danger>{error} Refresh this product to check its latest price and stock before adding.</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 12, justifyContent: 'center' }]} onPress={load}><Text style={s.btnGhostText}>Refresh product</Text></TouchableOpacity></View>}
      {similar.length > 0 && <><SectionTitle title="You may also need" /><View style={{ flexDirection: 'row', gap: 12 }}>{similar.map((item) => <ProductCard key={item.productId ?? item.id} item={item} onPress={() => navigation.push('Product', { productId: item.productId ?? item.id, merchantProductId: item.merchantProductId })} />)}</View></>}
    </ScrollView>
    <ActionDock>{offer && available && !error ? <View style={{ flexDirection: 'row' }}><AddButton key={offer.merchantProductId} full productId={route.params.productId} merchantProductId={offer.merchantProductId} outOfStock={!available} label={`Add to basket · ${pkr(price)}`} /></View> : <TouchableOpacity disabled accessibilityRole="button" accessibilityState={{ disabled: true }} style={[s.btnGhost, { justifyContent: 'center', opacity: 0.8 }]}><Text style={[s.btnGhostText, { color: colors.muted }]}>{error ? 'Refresh product to continue' : restricted ? 'Unavailable for checkout' : offer ? 'Currently unavailable' : 'Choose an available shop'}</Text></TouchableOpacity>}</ActionDock>
  </View>;
}
