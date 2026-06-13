import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { FlatList, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { RootStackParamList } from '../App';
import { api, getLocation, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';
import { AddButton } from '../components/AddButton';

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Search'>>();
  const [q, setQ] = useState(route.params?.q ?? '');
  const [items, setItems] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setItems([]);
        setSearched(false);
        return;
      }
      const loc = await getLocation();
      try {
        const res = await api.get(
          `/products/search?q=${encodeURIComponent(q.trim())}&latitude=${loc.latitude}&longitude=${loc.longitude}&pageSize=40`,
        );
        setItems(res.items ?? []);
        setSearched(true);
      } catch {
        setItems([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={s.screen}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <TextInput
          style={s.input}
          placeholder="Search milk, bread, medicine…"
          value={q}
          onChangeText={setQ}
          autoFocus={!route.params?.q}
          returnKeyType="search"
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.merchantProductId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        ListEmptyComponent={
          searched ? (
            <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No products found nearby.</Text>
          ) : (
            <Text style={[s.faint, { textAlign: 'center', marginTop: 24 }]}>Type to search nearby shops.</Text>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.card, s.row, { gap: 12 }]}
            onPress={() => navigation.navigate('Product', { productId: item.productId })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={{ fontSize: 20 }}>🛍️</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={1}>{item.name}</Text>
              <Text style={s.faint} numberOfLines={1}>
                {item.merchant?.shopName} {item.merchant?.distanceKm != null && `· ${item.merchant.distanceKm} km`}
              </Text>
              <Text style={{ fontWeight: '800', marginTop: 2 }}>{pkr(item.discountPricePaisa ?? item.pricePaisa)}</Text>
            </View>
            <AddButton
              merchantProductId={item.merchantProductId}
              outOfStock={!item.isAvailable || item.stockQuantity === 0}
            />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
