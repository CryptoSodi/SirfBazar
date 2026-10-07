import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CategoryChips, Notice, PageHeading, SearchField, ShopCard, StatePanel, usePageInset } from '../components/CustomerUI';
import { api, getConfirmedLocation } from '../lib/api';
import { useTheme } from '../lib/theme';

export default function ShopsScreen() {
  const { s } = useTheme(); const navigation = useNavigation<any>(); const inset = usePageInset();
  const [shops, setShops] = useState<any[]>([]); const [categories, setCategories] = useState<any[]>([]); const [selected, setSelected] = useState('');
  const [query, setQuery] = useState(''); const [located, setLocated] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [page, setPage] = useState(1); const [loadedPage, setLoadedPage] = useState(0); const [pages, setPages] = useState(1); const revision = useRef(0);
  const load = useCallback(() => {
    const current = ++revision.current; setLoading(true);
    void (async () => {
      const location = await getConfirmedLocation();
      const params = new URLSearchParams({ page: String(page), pageSize: '24' });
      if (location) { params.set('latitude', String(location.latitude)); params.set('longitude', String(location.longitude)); }
      if (selected) params.set('categoryId', selected);
      const [result, nextCategories] = await Promise.all([api.get(`/merchants/nearby?${params}`), api.get(`/products/categories${location ? `?latitude=${location.latitude}&longitude=${location.longitude}` : ''}`)]);
      if (current !== revision.current) return;
      setShops((old) => page === 1 ? result.items ?? [] : [...new Map([...old, ...(result.items ?? [])].map((shop) => [shop.id, shop])).values()]);
      setCategories(nextCategories ?? []); setLocated(!!location); setPages(result.totalPages ?? 1); setLoadedPage(page); setError('');
    })().catch((cause: any) => { if (current === revision.current) setError(cause.message || 'Unable to load shops. Try again.'); }).finally(() => { if (current === revision.current) setLoading(false); });
  }, [page, selected]);
  useFocusEffect(useCallback(() => { load(); return () => { revision.current++; }; }, [load]));
  const shown = shops.filter((shop) => !query.trim() || shop.shopName?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <ScrollView style={s.screen} contentContainerStyle={{ padding: inset, paddingTop: 12, paddingBottom: 24 }}>
    <PageHeading title={'Local shops.\nFamiliar choices.'} subtitle={located ? 'Shops for your selected delivery area.' : 'Choose an area to check which shops can deliver.'} />
    <View style={{ marginTop: 20 }}><SearchField value={query} onChangeText={setQuery} placeholder="Find a shop in these results" /></View>
    <CategoryChips items={categories} selected={selected} onSelect={(id) => { setSelected(id); setPage(1); setShops([]); setLoadedPage(0); }} />
    {!!error && shops.length > 0 && <><Notice danger>{error} Previously loaded shops are still shown.</Notice><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginVertical: 12 }]} onPress={load}><Text style={s.btnGhostText}>Retry shops</Text></TouchableOpacity></>}
    {loading && !shops.length ? <StatePanel loading title="Loading shops…" /> : error && !shops.length ? <StatePanel icon="wifi" title="Couldn’t load your shops." message={`${error} Your basket has not been cleared.`} action="Try again" onPress={load} /> : shown.length ? shown.map((shop) => <ShopCard key={shop.id} shop={shop} onPress={() => navigation.navigate('Shop', { merchantId: shop.id })} />) : <StatePanel icon={query ? 'search' : 'pin'} title={query ? 'No matching shops.' : 'Not here just yet.'} message={query ? `No loaded shop matches “${query}”. Try fewer words or load more results.` : 'No shop was found within delivery range. Change your area, or keep exploring the catalogue.'} action={query ? 'Clear search' : 'Change area'} onPress={query ? () => setQuery('') : () => navigation.navigate('DeliveryLocation')} secondaryAction="Browse catalogue" onSecondary={() => navigation.navigate('GlobalCatalog')} />}
    {loadedPage > 0 && loadedPage < pages && <TouchableOpacity accessibilityRole="button" disabled={loading} onPress={() => { if (error) load(); else setPage(loadedPage + 1); }} style={[s.btnGhost, { marginTop: 16, justifyContent: 'center' }]}><Text style={s.btnGhostText}>{loading ? 'Loading…' : error ? 'Retry loading shops' : 'Load more shops'}</Text></TouchableOpacity>}
    <View style={{ marginTop: 16 }}><Notice tone="blue">Delivery estimates require location. Actual fees appear in your basket.</Notice></View>
  </ScrollView>;
}
