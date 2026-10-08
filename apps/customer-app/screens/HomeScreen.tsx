import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { api, getConfirmedLocation, type SbLocation } from '../lib/api';
import { useTheme } from '../lib/theme';
import { Icon, IconButton, SectionTitle, ProductCard, ShopCard, StatePanel, CatalogSkeleton, goTab, usePageInset } from '../components/CustomerUI';
import { categoryIconName } from '../lib/category-icons';
import { decorativeGroceries } from '../assets/design/decorative-groceries';

export default function HomeScreen() {
  const { colors, s, isDark, setMode } = useTheme(); const inset = usePageInset(); const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const [loc, setLoc] = useState<SbLocation | null>(null);
  const [categories, setCategories] = useState<any[]>([]); const [shops, setShops] = useState<any[]>([]); const [products, setProducts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const location = await getConfirmedLocation();
      const lq = location ? `latitude=${location.latitude}&longitude=${location.longitude}&` : '';
      const [c, sh, p] = await Promise.all([api.get(`/products/categories?${lq}`), api.get(`/merchants/nearby?${lq}`), api.get(`/products/nearby?${lq}pageSize=20`)]);
      if (request !== sequence.current) return;
      setLoc(location); setCategories(c ?? []); setShops(sh.items ?? []); setProducts(p.items ?? []); setError('');
    } catch (e: any) { if (request === sequence.current) setError(e.message ?? 'Check your connection and try again.'); }
    finally { if (request === sequence.current) { setLoading(false); setRefreshing(false); } }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { sequence.current++; }; }, [load]));
  const categoryArt = (name: string) => /dairy|milk/i.test(name) ? 'milk' : /fruit|fresh|veget/i.test(name) ? 'banana' : /bread|bakery/i.test(name) ? 'bread' : /pantry|rice|grain/i.test(name) ? 'rice' : null;
  return <SafeAreaView style={[s.screen, { backgroundColor: colors.card }]} edges={['top']}>
    <View style={{ minHeight: 58, paddingHorizontal: inset, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Image source={isDark ? require('../assets/design/sirfbazar-horizontal-no-slogan-dark.png') : require('../assets/design/sirfbazar-horizontal-no-slogan-light.png')} style={{ width: 119, height: 31 }} resizeMode="contain" accessibilityLabel="SirfBazar" />
      <IconButton name={isDark ? 'moon' : 'sun'} label="Change appearance" onPress={() => setMode(isDark ? 'light' : 'dark')} />
      <IconButton name="bell" label="Order updates" onPress={() => goTab(navigation, 'ProfileTab', { screen: 'Notifications' })} />
    </View>
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('DeliveryLocation')} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 13, minHeight: 52 }}>
        <Icon name="pin" size={19} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ color: colors.faint, fontSize: 10, lineHeight: 15 }}>DELIVER TO</Text><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 19 }}>{loc?.label ?? 'Choose your delivery area'}</Text></View><Icon name="chevron" color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search products" onPress={() => navigation.navigate('Search')} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 49, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.card, paddingHorizontal: 13 }}><Icon name="search" size={19} /><Text style={{ color: colors.muted, fontSize: 14, flexShrink: 1 }}>Search milk, bread, groceries…</Text></TouchableOpacity>
      <View style={{ minHeight: 126, borderRadius: 20, backgroundColor: colors.emeraldBg, padding: 16, marginTop: 14, marginBottom: 17, overflow: 'hidden', justifyContent: 'center' }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, lineHeight: 26, letterSpacing: -0.7, fontWeight: '700', maxWidth: 195 }}>Your daily shop.{'\n'}Made simple.</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17.4, marginTop: 8, maxWidth: 175 }}>Everyday essentials,{'\n'}from your local shops.</Text>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', right: width <= 360 ? -14 : -4, bottom: 5, width: 122, height: 117 }}><SvgXml xml={decorativeGroceries.milk} width={100} height={100} style={{ position: 'absolute', right: 32, bottom: 0, transform: [{ rotate: '-7deg' }] }} /><SvgXml xml={decorativeGroceries.bread} width={115} height={110} style={{ position: 'absolute', right: -20, bottom: 4, transform: [{ rotate: '8deg' }] }} /></View>
      </View>
      {loading ? <CatalogSkeleton /> : error ? <StatePanel title="Couldn’t load your shops." icon="wifi" message={`${error} Your basket has not been cleared.`} action="Try again" onPress={() => void load()} /> : <>
        <View style={{ flexDirection: 'row', gap: 8 }}>{categories.slice(0,4).map(c => { return <TouchableOpacity key={c.id} accessibilityRole="button" accessibilityLabel={c.name} onPress={() => navigation.navigate('Category', { categoryId: c.id, name: c.name })} style={{ flex: 1, minWidth: 0 }}><View style={{ height: 58, borderRadius: 15, marginBottom: 7, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><Icon name={categoryIconName(c.slug, c.iconUrl)} size={28} color={colors.primary} /></View><Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center' }}>{c.name}</Text></TouchableOpacity>; })}</View>
        <SectionTitle title="Everyday essentials" action="See all" onPress={() => navigation.navigate('Browse')} />
        {products.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{products.slice(0,4).map(item => <View key={item.merchantProductId} style={{ width: (width - inset * 2 - 12) / 2 }}><ProductCard item={item} onPress={() => navigation.navigate('Product', { productId: item.productId, merchantProductId: item.merchantProductId })} /></View>)}</View> : <StatePanel icon="pin" title="Not here just yet." message="No shop was found within delivery range. Change your area, or keep exploring the catalogue." action="Change area" onPress={() => navigation.navigate('DeliveryLocation')} secondaryAction="Browse catalogue" onSecondary={() => navigation.navigate('GlobalCatalog')} />}
        <SectionTitle title="Shops to explore" action="See all" onPress={() => navigation.navigate('Shops')} />
        {shops.slice(0,2).map(shop => <ShopCard key={shop.id} shop={shop} onPress={() => navigation.navigate('Shop', { merchantId: shop.id })} />)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
