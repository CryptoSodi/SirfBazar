import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, getLocation, pkr, setLocation, SbLocation } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loc, setLoc] = useState<SbLocation | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const location = await getLocation();
    setLoc(location);
    const lq = `latitude=${location.latitude}&longitude=${location.longitude}`;
    const [c, sh, p] = await Promise.allSettled([
      api.get('/products/categories'),
      api.get(`/merchants/nearby?${lq}`),
      api.get(`/products/nearby?${lq}&pageSize=20`),
    ]);
    if (c.status === 'fulfilled') setCategories(c.value ?? []);
    if (sh.status === 'fulfilled') setShops(sh.value.items ?? []);
    if (p.status === 'fulfilled') setProducts(p.value.items ?? []);
  }, []);

  useEffect(() => {
    load();
    // Quietly upgrade to GPS if the user grants permission (no blocking prompt flow).
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const detected = await api
          .post('/location/detect', { latitude: pos.coords.latitude, longitude: pos.coords.longitude })
          .catch(() => null);
        await setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: detected?.area ? `${detected.area}, ${detected.city}` : 'Current location',
        });
        load();
      } catch {
        /* keep fallback */
      }
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addToCart = async (merchantProductId: string) => {
    try {
      const loggedIn = await import('../lib/api').then((m) => m.isLoggedIn());
      await api.post(`${loggedIn ? '/cart' : '/guest/cart'}/items`, { merchantProductId, quantity: 1 });
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Location + brand */}
        <View style={s.spread}>
          <View>
            <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 20 }}>SirfBazar</Text>
            <Text style={s.muted}>📍 {loc?.label ?? 'Detecting…'}</Text>
          </View>
        </View>

        {/* Categories */}
        <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[s.card, { marginRight: 8, alignItems: 'center', width: 84, padding: 10 }]}
              onPress={() => navigation.navigate('Search' as never)}
            >
              <Text style={{ fontSize: 22 }}>{c.iconUrl || '🛍️'}</Text>
              <Text style={[s.faint, { textAlign: 'center', marginTop: 4 }]} numberOfLines={2}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Shops */}
        <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Shops near you</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {shops.map((shop) => (
            <TouchableOpacity
              key={shop.id}
              style={[s.card, { marginRight: 8, width: 180 }]}
              onPress={() => navigation.navigate('Shop', { merchantId: shop.id })}
            >
              <Text style={{ fontSize: 22 }}>🏪</Text>
              <Text style={[s.body, { fontWeight: '700', marginTop: 4 }]} numberOfLines={1}>
                {shop.shopName}
              </Text>
              <Text style={s.faint}>
                ⭐ {shop.ratingAverage?.toFixed?.(1) ?? '–'} · {shop.distanceKm != null ? `${shop.distanceKm} km` : shop.city}
              </Text>
              <Text style={[s.faint, { color: shop.isOnline && shop.isOpen ? colors.primary : colors.faint }]}>
                {shop.isOnline && shop.isOpen ? '● Open now' : 'Closed'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        <Text style={[s.h2, { marginTop: 16, marginBottom: 8 }]}>Popular near you</Text>
        <FlatList
          data={products}
          numColumns={2}
          scrollEnabled={false}
          keyExtractor={(p) => p.merchantProductId}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, { flex: 1 }]}
              onPress={() => navigation.navigate('Product', { productId: item.productId })}
            >
              <View style={{ height: 64, borderRadius: 10, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 26 }}>🛍️</Text>
              </View>
              <Text style={[s.body, { fontWeight: '600', marginTop: 6 }]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={s.faint} numberOfLines={1}>{item.merchant?.shopName}</Text>
              <View style={[s.spread, { marginTop: 6 }]}>
                <Text style={{ fontWeight: '800', color: colors.text }}>
                  {pkr(item.discountPricePaisa ?? item.pricePaisa)}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                  onPress={() => addToCart(item.merchantProductId)}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
