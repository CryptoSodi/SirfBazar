import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, API_URL, FALLBACK_LOCATION, getLocation, pkr, setLocation, SbLocation } from '../lib/api';
import { useTheme } from '../lib/theme';
import { AddButton } from '../components/AddButton';

export default function HomeScreen() {
  const { colors, s } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loc, setLoc] = useState<SbLocation | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const fetchFor = async (location: SbLocation) => {
    const lq = `latitude=${location.latitude}&longitude=${location.longitude}`;
    const [c, sh, p] = await Promise.allSettled([
      api.get(`/products/categories?${lq}`),
      api.get(`/merchants/nearby?${lq}`),
      api.get(`/products/nearby?${lq}&pageSize=20`),
    ]);
    return {
      categories: c.status === 'fulfilled' ? c.value ?? [] : null,
      shops: sh.status === 'fulfilled' ? sh.value.items ?? [] : [],
      products: p.status === 'fulfilled' ? p.value.items ?? [] : [],
      categoriesFailed: c.status === 'rejected' ? (c as PromiseRejectedResult).reason : null,
    };
  };

  const load = useCallback(async () => {
    let location = await getLocation();
    let res = await fetchFor(location);

    // Demo fallback: if the active location has no nearby shops/products, show the
    // seeded demo area (Lahore) so the home screen is never empty during testing.
    const isFallback =
      location.latitude === FALLBACK_LOCATION.latitude &&
      location.longitude === FALLBACK_LOCATION.longitude;
    if (!res.categoriesFailed && res.shops.length === 0 && res.products.length === 0 && !isFallback) {
      location = FALLBACK_LOCATION;
      await setLocation(location);
      res = await fetchFor(location);
    }

    setLoc(location);
    if (res.categories) setCategories(res.categories);
    setShops(res.shops);
    setProducts(res.products);
    if (res.categoriesFailed) {
      setError(`Can't reach the server at ${API_URL} — ${(res.categoriesFailed as any)?.message ?? 'network error'}`);
      console.warn('Home load failed:', res.categoriesFailed);
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
        const lq = `latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}`;
        // Only adopt the real GPS location if it actually has nearby shops —
        // otherwise keep showing the demo area instead of an empty screen.
        const nearby = await api.get(`/merchants/nearby?${lq}`).catch(() => null);
        if (!nearby || (nearby.items ?? []).length === 0) return;
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
            placeholderTextColor={colors.faint}
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
              <View style={[s.card, { marginBottom: 12, borderColor: colors.danger, backgroundColor: colors.dangerBg }]}>
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
                        <AddButton merchantProductId={item.merchantProductId} />
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
            onPress={() => navigation.navigate('Category', { categoryId: c.id, name: c.name })}
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
