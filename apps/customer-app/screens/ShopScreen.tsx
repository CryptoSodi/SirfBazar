import { RouteProp, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { FlatList, Image, Text, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, getLocation, pkr } from '../lib/api';
import { useTheme } from '../lib/theme';
import { AddButton } from '../components/AddButton';

export default function ShopScreen() {
  const { colors, s } = useTheme();
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
        <View style={[s.card, s.row, { gap: 12 }]}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              backgroundColor: colors.emeraldBg,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {mp.product.imageUrl ? (
              <Image source={{ uri: mp.product.imageUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{ fontSize: 22 }}>🛍️</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={2}>{mp.product.name}</Text>
            <Text style={s.faint}>{[mp.product.brand, mp.product.size ?? mp.product.unit].filter(Boolean).join(' · ')}</Text>
            <Text style={{ fontWeight: '800', marginTop: 2, color: colors.text }}>{pkr(mp.discountPricePaisa ?? mp.pricePaisa)}</Text>
          </View>
          <AddButton
            merchantProductId={mp.merchantProductId ?? mp.id}
            outOfStock={!mp.isAvailable || mp.stockQuantity === 0}
          />
        </View>
      )}
    />
  );
}
