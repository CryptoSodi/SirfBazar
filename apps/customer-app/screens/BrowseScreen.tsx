import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { categoryIconName } from '../lib/category-icons';
import { Icon, PageHeading, SectionTitle, StatePanel, usePageInset } from '../components/CustomerUI';
import { api, getConfirmedLocation } from '../lib/api';
import { useTheme } from '../lib/theme';


export default function BrowseScreen() {
  const navigation = useNavigation<any>(); const { colors, s } = useTheme(); const inset = usePageInset(); const { width } = useWindowDimensions();
  const [categories, setCategories] = useState<any[] | null>(null); const [error, setError] = useState(''); const revision = useRef(0);
  const load = useCallback(() => {
    const current = ++revision.current;
    void (async () => {
      const location = await getConfirmedLocation();
      const result = await api.get(`/products/categories${location ? `?latitude=${location.latitude}&longitude=${location.longitude}` : ''}`);
      if (current === revision.current) { setCategories(result ?? []); setError(''); }
    })().catch((cause: any) => { if (current === revision.current) setError(cause.message || 'Unable to load categories. Try again.'); });
  }, []);
  useFocusEffect(useCallback(() => { load(); return () => { revision.current++; }; }, [load]));
  return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
    <PageHeading title={'What’s on\nyour list?'} subtitle="Explore everyday essentials by category." />
    {error ? <StatePanel icon="wifi" title="Couldn’t load categories." message={`${error} Your basket has not been cleared.`} action="Try again" onPress={load} /> : !categories ? <View style={{ marginTop: 20 }}><StatePanel loading title="Loading categories…" /></View> : categories.length === 0 ? <StatePanel icon="grid" title="Explore the catalogue." message="No categories are available for this area. You can still browse the catalogue." action="Browse catalogue" onPress={() => navigation.navigate('GlobalCatalog')} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 }}>{categories.map((category) => {

      return <TouchableOpacity key={category.id} accessibilityRole="button" accessibilityLabel={`Browse ${category.name}`} onPress={() => navigation.navigate('Category', { categoryId: category.id, name: category.name })} style={[s.card, { width: (width - inset * 2 - 12) / 2, padding: 10, alignItems: 'center' }]}>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 108, alignItems: 'center', justifyContent: 'center', width: '100%' }}><Icon name={categoryIconName(category.slug, category.iconUrl)} color={colors.primary} size={48} /></View>
        <Text style={[s.body, { fontWeight: '700', textAlign: 'center', marginTop: 4 }]}>{category.name}</Text>
      </TouchableOpacity>;
    })}</View>}
    <SectionTitle title="All products" action="Browse catalogue" onPress={() => navigation.navigate('GlobalCatalog')} />
    <Text style={s.muted}>Browse the catalogue even before choosing a delivery area. Select a shop to see an actual offer.</Text>
  </ScrollView>;
}
