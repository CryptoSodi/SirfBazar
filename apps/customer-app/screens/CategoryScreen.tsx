import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, getLocation, pkr } from '../lib/api';
import { useTheme } from '../lib/theme';
import { AddButton } from '../components/AddButton';

/** Products in a category, from shops near the user (dynamic/hyperlocal) — mirrors
 *  the website's category page. Tap a product to view it; quick-add to cart. */
export default function CategoryScreen() {
  const { colors, s } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Category'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ title: route.params.name ?? 'Category' });
  }, [navigation, route.params.name]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const loc = await getLocation();
      try {
        const res = await api.get(
          `/products/nearby?categoryId=${route.params.categoryId}&pageSize=60&latitude=${loc.latitude}&longitude=${loc.longitude}`,
        );
        setItems(res.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [route.params.categoryId]);

  if (loading) {
    return (
      <View style={[s.screen, { paddingTop: 40 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={s.screen}
      data={items}
      numColumns={2}
      keyExtractor={(p) => p.merchantProductId}
      columnWrapperStyle={{ gap: 8 }}
      contentContainerStyle={{ padding: 16, gap: 8 }}
      ListEmptyComponent={
        <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>
          No shops near you stock this category yet.
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[s.card, { flex: 1 }]}
          onPress={() => navigation.navigate('Product', { productId: item.productId })}
        >
          <View
            style={{
              height: 96,
              borderRadius: 10,
              backgroundColor: colors.emeraldBg,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{ fontSize: 30 }}>🛍️</Text>
            )}
          </View>
          <Text style={[s.body, { fontWeight: '600', marginTop: 6 }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={s.faint} numberOfLines={1}>
            {item.merchant?.shopName}
          </Text>
          <View style={[s.spread, { marginTop: 6 }]}>
            <Text style={{ fontWeight: '800', color: colors.text }}>
              {pkr(item.discountPricePaisa ?? item.pricePaisa)}
            </Text>
            <AddButton
              merchantProductId={item.merchantProductId}
              outOfStock={!item.isAvailable || item.stockQuantity === 0}
            />
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
