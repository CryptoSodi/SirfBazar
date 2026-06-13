import { RouteProp, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, getLocation, isLoggedIn, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function ProductScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Product'>>();
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const loc = await getLocation();
      api
        .get(`/products/${route.params.productId}?latitude=${loc.latitude}&longitude=${loc.longitude}`)
        .then(setProduct)
        .catch((e) => setError(e.message));
    })();
  }, [route.params.productId]);

  const add = async (merchantProductId: string) => {
    try {
      await api.post(`${(await isLoggedIn()) ? '/cart' : '/guest/cart'}/items`, { merchantProductId, quantity: 1 });
      alert('Added to cart');
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (error) return <Text style={[s.muted, s.pad]}>{error}</Text>;
  if (!product) return <Text style={[s.muted, s.pad]}>Loading…</Text>;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <View style={{ height: 200, borderRadius: 16, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Text style={{ fontSize: 52 }}>🛍️</Text>
        )}
      </View>
      <Text style={[s.h1, { marginTop: 12 }]}>{product.name}</Text>
      <Text style={s.muted}>{[product.brand, product.size ?? product.unit].filter(Boolean).join(' · ')}</Text>
      {product.description && <Text style={[s.body, { marginTop: 8, color: colors.muted }]}>{product.description}</Text>}

      <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Available from</Text>
      {(product.offers ?? []).map((o: any) => (
        <View key={o.merchantProductId} style={[s.card, s.spread, { marginBottom: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.body, { fontWeight: '700' }]}>{o.merchant.shopName}</Text>
            <Text style={s.faint}>
              ⭐ {o.merchant.ratingAverage?.toFixed?.(1) ?? '–'}
              {o.merchant.distanceKm != null && ` · ${o.merchant.distanceKm} km`}
              {o.merchant.estimatedDeliveryMinutes && ` · ~${o.merchant.estimatedDeliveryMinutes} min`}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontWeight: '800' }}>{pkr(o.discountPricePaisa ?? o.pricePaisa)}</Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              onPress={() => add(o.merchantProductId)}
              disabled={!o.isAvailable || o.stockQuantity === 0}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                {o.stockQuantity === 0 ? 'Out' : '+ Add'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
      {(product.offers ?? []).length === 0 && (
        <Text style={s.muted}>No shop near you currently stocks this item.</Text>
      )}
    </ScrollView>
  );
}
