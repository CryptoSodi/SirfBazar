import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, API_URL, getLocation, isLoggedIn, pkr, setLocation, SbLocation } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loc, setLoc] = useState<SbLocation | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

    if (c.status === 'rejected') {
      setError(`Can't reach the server at ${API_URL} — ${(c.reason as any)?.message ?? 'network error'}`);
      console.warn('Home load failed:', (c as PromiseRejectedResult).reason);
    } else {
      setError(null);
    }
  }, []);

  useEffect(() => {
    load();
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

  const submitSearch = () => {
    const q = query.trim();
    navigation.navigate('Search', q ? { q } : undefined);
  };

  const addToCart = async (merchantProductId: string) => {
    try {
      const base = (await isLoggedIn()) ? '/cart' : '/guest/cart';
      await api.post(`${base}/items`, { merchantProductId, quantity: 1 });
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Fixed header: brand, location, and search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={s.spread}>
          <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 20 }}>SirfBazar</Text>
          <Text style={s.muted} numberOfLines={1}>📍 {loc?.label ?? 'Detecting…'}</Text>
        </View>
        <View style={[s.row, { marginTop: 10, gap: 8 }]}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Search milk, bread, medicine…"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          <TouchableOpacity style={[s.btn, { paddingHorizontal: 16 }]} onPress={submitSearch}>
            <Text style={s.btnText}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable area: shops strip (horizontal) + category grid (vertical, full width) */}
      <FlatList
        data={categories}
        numColumns={3}
        keyExtractor={(c) => c.id}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 6 }}>
            {error && (
              <View style={[s.card, { marginBottom: 12, borderColor: colors.danger, backgroundColor: '#fef2f2' }]}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Couldn’t load content</Text>
                <Text style={[s.faint, { color: colors.danger, marginTop: 2 }]}>{error}</Text>
                <Text style={[s.faint, { marginTop: 6 }]}>Pull down to retry.</Text>
              </View>
            )}

            {shops.length > 0 && (
              <>
                <Text style={[s.h2, { marginBottom: 8 }]}>Shops near you</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -2 }}>
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
                        ⭐ {shop.ratingAverage?.toFixed?.(1) ?? '–'} ·{' '}
                        {shop.distanceKm != null ? `${shop.distanceKm} km` : shop.city}
                      </Text>
                      <Text style={[s.faint, { color: shop.isOnline && shop.isOpen ? colors.primary : colors.faint }]}>
                        {shop.isOnline && shop.isOpen ? '● Open now' : 'Closed'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {products.length > 0 && (
              <>
                <Text style={[s.h2, { marginTop: shops.length > 0 ? 18 : 0, marginBottom: 8 }]}>Popular near you</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -2 }}>
                  {products.map((item) => (
                    <TouchableOpacity
                      key={item.merchantProductId}
                      style={[s.card, { marginRight: 8, width: 150 }]}
                      onPress={() => navigation.navigate('Product', { productId: item.productId })}
                    >
                      <View
                        style={{
                          height: 56,
                          borderRadius: 10,
                          backgroundColor: colors.emeraldBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 6,
                          overflow: 'hidden',
                        }}
                      >
                        {item.imageUrl ? (
                          <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ fontSize: 24 }}>🛍️</Text>
                        )}
                      </View>
                      <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={s.faint} numberOfLines={1}>
                        {item.merchant?.shopName}
                      </Text>
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
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={[s.h2, { marginTop: shops.length > 0 || products.length > 0 ? 18 : 0, marginBottom: 4 }]}>
              Shop by category
            </Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[s.card, { flex: 1, alignItems: 'center', paddingVertical: 16 }]}
            onPress={() => navigation.navigate('Search', { q: c.name })}
          >
            <Text style={{ fontSize: 30 }}>{c.iconUrl || '🛍️'}</Text>
            <Text style={[s.faint, { textAlign: 'center', marginTop: 6 }]} numberOfLines={2}>
              {c.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
