import { RouteProp, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, getLocation, isLoggedIn, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function ShopScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Shop'>>();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const loc = await getLocation();
      api.get(`/merchants/${route.params.merchantId}?latitude=${loc.latitude}&longitude=${loc.longitude}`).then(setShop).catch(() => undefined);
      api.get(`/merchants/${route.params.merchantId}/products?pageSize=60`).then((r) => setProducts(r.items ?? [])).catch(() => undefined);
    })();
  }, [route.params.merchantId]);

  const add = async (merchantProductId: string) => {
    try {
      await api.post(`${(await isLoggedIn()) ? '/cart' : '/guest/cart'}/items`, { merchantProductId, quantity: 1 });
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (!shop) return <Text style={[s.muted, s.pad]}>Loading…</Text>;

  return (
    <FlatList
      style={s.screen}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      data={products}
      keyExtractor={(mp) => mp.merchantProductId ?? mp.id}
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <Text style={s.h1}>{shop.shopName}</Text>
          <Text style={s.muted}>
            ⭐ {shop.ratingAverage?.toFixed?.(1) ?? '–'} ({shop.ratingCount ?? 0})
            {shop.distanceKm != null && ` · ${shop.distanceKm} km`} · {shop.openingTime}–{shop.closingTime}
          </Text>
          <Text style={[s.faint, { marginTop: 2 }]}>{shop.address}</Text>
          <Text style={{ color: shop.isOnline && shop.isOpen ? colors.primary : colors.faint, fontSize: 12, marginTop: 4, fontWeight: '700' }}>
            {shop.isOnline && shop.isOpen ? '● Open now' : 'Closed'}
            {shop.minimumOrderValuePaisa ? `  ·  Min order ${pkr(shop.minimumOrderValuePaisa)}` : ''}
          </Text>
        </View>
      }
      renderItem={({ item: mp }) => (
        <View style={[s.card, s.spread]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={1}>{mp.product.name}</Text>
            <Text style={s.faint}>{[mp.product.brand, mp.product.size ?? mp.product.unit].filter(Boolean).join(' · ')}</Text>
            <Text style={{ fontWeight: '800', marginTop: 2 }}>{pkr(mp.discountPricePaisa ?? mp.pricePaisa)}</Text>
          </View>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
            onPress={() => add(mp.merchantProductId ?? mp.id)}
            disabled={!mp.isAvailable || mp.stockQuantity === 0}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
              {mp.stockQuantity === 0 ? 'Out' : '+ Add'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}
