import { ToastMessage, ToastHost } from './Toast';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, getConfirmedLocation, pkr } from '../lib/api';
import { subscribeCustomerEvent } from '../lib/customer-events';
import { useTheme } from '../lib/theme';
import { findCategoryName } from '../lib/category-tree';
import { CategoryChips, Field, Icon, IconButton, Notice, PageHeading, ProductCard, SearchField, SectionTitle, StatePanel, goTab, usePageInset } from './CustomerUI';

type Filters = { sort: 'relevance' | 'price_asc' | 'price_desc' | 'rating'; brand: string; min: string; max: string };
const emptyFilters: Filters = { sort: 'relevance', brand: '', min: '', max: '' };
const sortOptions: [Filters['sort'], string][] = [['relevance', 'Relevance'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Shop rating']];
function pricePaisa(value: string): number | undefined { return value.trim() ? Math.round(Number(value) * 100) : undefined; }
function listingKey(item: any) { return String(item.merchantProductId ?? item.productId ?? item.id); }

export function CatalogScreen({ merchantId, initialCategory = '', initialQuery = '', globalCatalog = false }: { merchantId?: string; initialCategory?: string; initialQuery?: string; globalCatalog?: boolean }) {
  const { colors, s } = useTheme(); const navigation = useNavigation<any>(); const inset = usePageInset(); const width = useWindowDimensions().width;
  const [categories, setCategories] = useState<any[]>([]); const [shop, setShop] = useState<any>(null); const [metaError, setMetaError] = useState('');
  const [selected, setSelected] = useState(initialCategory); const [q, setQ] = useState(initialQuery); const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1); const [loadedPage, setLoadedPage] = useState(0); const [pages, setPages] = useState(1); const [total, setTotal] = useState<number>();
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState<Filters>(emptyFilters); const [draft, setDraft] = useState<Filters>(emptyFilters); const [draftCategory, setDraftCategory] = useState(initialCategory); const [filterError, setFilterError] = useState('');
  const [sheet, setSheet] = useState<'filters' | 'shop' | null>(null); const sequence = useRef(0);
  const retry = () => { sequence.current++; setReload((value) => value + 1); };
  const choose = (id: string) => { sequence.current++; setSelected(id); setPage(1); };
  useEffect(() => { setSelected(initialCategory); setQ(initialQuery); setPage(1); setFilters(emptyFilters); setShop(null); }, [initialCategory, initialQuery, merchantId, globalCatalog]);
  useFocusEffect(useCallback(() => subscribeCustomerEvent('location', () => { sequence.current++; setPage(1); setReload((value) => value + 1); }), []));
  useEffect(() => {
    let active = true;
    void (async () => {
      const location = globalCatalog ? null : await getConfirmedLocation();
      const lq = location ? `?latitude=${location.latitude}&longitude=${location.longitude}` : '';
      const [nextCategories, nextShop] = await Promise.all([api.get(`/products/categories${lq}`), merchantId ? api.get(`/merchants/${merchantId}${lq}`) : Promise.resolve(null)]);
      if (active) { setCategories(nextCategories ?? []); setShop(nextShop); setMetaError(''); }
    })().catch((cause: any) => { if (active) setMetaError(cause.message || 'Shop or category details are unavailable.'); });
    return () => { active = false; };
  }, [merchantId, globalCatalog, reload]);
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setError('');
    if (page === 1) { setItems([]); setLoadedPage(0); setTotal(undefined); }
    const timer = setTimeout(() => { void (async () => {
      const location = globalCatalog || merchantId ? null : await getConfirmedLocation();
      const params = new URLSearchParams({ page: String(page), pageSize: '24' });
      if (location) { params.set('latitude', String(location.latitude)); params.set('longitude', String(location.longitude)); }
      if (selected) params.set('categoryId', selected);
      if (q.trim()) params.set('q', q.trim());
      if (!merchantId && !globalCatalog) {
        params.set('sort', filters.sort);
        if (filters.brand.trim()) params.set('brand', filters.brand.trim());
        const min = pricePaisa(filters.min), max = pricePaisa(filters.max);
        if (min !== undefined) params.set('minPricePaisa', String(min));
        if (max !== undefined) params.set('maxPricePaisa', String(max));
      }
      const response = await api.get(`${merchantId ? `/merchants/${merchantId}/products` : `/products/${globalCatalog ? 'catalog' : 'search'}`}?${params}`);
      const next = merchantId ? (response.items ?? []).map((entry: any) => ({ ...entry.product, ...entry, productId: entry.product?.id ?? entry.productId, merchantProductId: entry.merchantProductId ?? entry.id, name: entry.product?.name ?? entry.name, imageUrl: entry.product?.imageUrl ?? entry.imageUrl, size: entry.product?.size ?? entry.size, unit: entry.product?.unit ?? entry.unit })) : (response.items ?? []).map((entry: any) => globalCatalog ? { ...entry, merchantProductId: undefined, pricePaisa: undefined, discountPricePaisa: undefined } : entry);
      if (request !== sequence.current) return;
      setItems((old) => page === 1 ? next : [...new Map([...old, ...next].map((item) => [listingKey(item), item])).values()]);
      setLoadedPage(page); setPages(response.totalPages ?? 1); setTotal(response.total);
    })().catch((cause: any) => { if (request === sequence.current) setError(cause.message || 'Unable to load products. Try again.'); }).finally(() => { if (request === sequence.current) setLoading(false); }); }, 250);
    return () => { sequence.current++; clearTimeout(timer); };
  }, [merchantId, globalCatalog, selected, q, page, filters, reload]);
  const applyFilters = () => {
    const validPrice = (value: string) => !value.trim() || /^\d+(?:\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(pricePaisa(value));
    const min = pricePaisa(draft.min), max = pricePaisa(draft.max);
    if (!validPrice(draft.min) || !validPrice(draft.max)) { setFilterError('Enter a non-negative price in rupees, with up to two decimal places.'); return; }
    if (min !== undefined && max !== undefined && min > max) { setFilterError('Maximum price must be at least the minimum price.'); return; }
    sequence.current++; setSelected(draftCategory); setFilters({ ...draft }); setPage(1); setSheet(null); setFilterError('');
  };
  const filterCount = Number(filters.sort !== 'relevance') + Number(!!filters.brand.trim()) + Number(!!filters.min.trim()) + Number(!!filters.max.trim());
  const emptyMessage = q.trim() ? `No listings match “${q.trim()}”. Try fewer words or another category.` : 'Try another category or adjust your filters.';
  return <View style={s.screen}>
    <FlatList data={items} numColumns={2} keyExtractor={listingKey} columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ padding: inset, paddingTop: 12, gap: 12, paddingBottom: 28 }}
      ListHeaderComponent={<View>
        {globalCatalog && <><PageHeading title={'The everyday\ncatalogue.'} subtitle="Explore products, then find a shop that sells them." /><View style={{ marginTop: 16, marginBottom: 4 }}><Notice>These are catalogue products, not priced shop listings. Choose a seller before adding.</Notice></View></>}
        {!!merchantId && shop && <>
          <View style={[s.card, { backgroundColor: colors.emeraldBg }]}><View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.emeraldBg }}><Icon name="shop" size={25} color={colors.primary} /></View><Text accessibilityRole="header" style={[s.h1, { fontSize: 25, lineHeight: 30, marginTop: 12 }]}>{shop.shopName}</Text><Text style={[s.muted, { marginTop: 8 }]}>{[shop.area, shop.city].filter(Boolean).join(', ')}</Text><View style={[s.row, { marginTop: 12, gap: 7, flexWrap: 'wrap' }]}><Text style={[s.chip, { borderRadius: 7, color: shop.isOnline && shop.isOpen ? colors.primary : colors.muted, backgroundColor: colors.card, fontWeight: '700' }]}>{shop.isOnline && shop.isOpen ? 'Open' : 'Closed'}</Text><Text style={[s.chip, { borderRadius: 7, color: colors.muted, backgroundColor: colors.card }]}>Fee in basket</Text></View></View>
          <View style={[s.spread, { gap: 12, marginTop: 12, marginBottom: 16 }]}><Text style={[s.muted, { flex: 1 }]}>Prepared by this shop.{ '\n' }Delivered by their own rider.</Text><TouchableOpacity accessibilityRole="button" onPress={() => setSheet('shop')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Shop details</Text></TouchableOpacity></View>
        </>}
        {!globalCatalog && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><View style={{ flex: 1 }}><SearchField value={q} onChangeText={(value) => { sequence.current++; setQ(value); setPage(1); }} placeholder={merchantId ? 'Search this shop' : 'What do you need?'} /></View>{!merchantId && <IconButton name="filter" label={filterCount ? `Filters, ${filterCount} applied` : 'Filters'} onPress={() => { setDraft({ ...filters }); setDraftCategory(selected); setFilterError(''); setSheet('filters'); }} />}</View>}
        {!merchantId && !globalCatalog && <CategoryChips items={categories} selected={selected} onSelect={choose} />}
        {!globalCatalog && <><SectionTitle title={merchantId ? 'Shop products' : q.trim() ? `Results for “${q.trim()}”` : findCategoryName(categories, selected) ?? 'Find your essentials'} />{!merchantId && typeof total === 'number' && !loading && <Text style={[s.muted, { marginBottom: 4 }]}>{total} {total === 1 ? 'listing' : 'listings'} · prices by shop{filterCount ? ` · ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'} applied` : ''}</Text>}</>}
        {!!metaError && <View style={{ marginBottom: 12 }}><ToastMessage>{metaError} Product results may still be available.</ToastMessage><TouchableOpacity accessibilityRole="button" style={[s.btnGhost, { marginTop: 10 }]} onPress={retry}><Text style={s.btnGhostText}>Retry details</Text></TouchableOpacity></View>}
        {!!error && items.length > 0 && <ToastMessage>{error} Loaded products are still shown. Retry below for the next page.</ToastMessage>}
      </View>}
      ListEmptyComponent={<StatePanel loading={loading} icon={error ? 'wifi' : 'search'} title={error ? 'Couldn’t load products.' : 'Let’s try\nanother search.'} message={error ? `${error} Your basket has not been cleared.` : emptyMessage} action={error ? 'Try again' : 'Search again'} onPress={error ? retry : () => { setQ(''); setSelected(''); setFilters(emptyFilters); setPage(1); retry(); }} secondaryAction={error ? undefined : 'Browse categories'} onSecondary={() => goTab(navigation, 'HomeTab', { screen: 'Browse' })} />}
      renderItem={({ item }) => <View style={{ width: (width - inset * 2 - 12) / 2 }}><ProductCard item={merchantId ? { ...item, merchant: shop ?? item.merchant } : item} onPress={() => navigation.navigate('Product', { productId: item.productId ?? item.id, ...(globalCatalog ? {} : { merchantProductId: item.merchantProductId }) })} /></View>}
      ListFooterComponent={loadedPage > 0 && loadedPage < pages ? <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => { if (error) retry(); else setPage(loadedPage + 1); }} style={[s.btnGhost, { marginTop: 16, justifyContent: 'center' }]}><Text style={s.btnGhostText}>{loading ? 'Loading…' : error ? 'Retry loading products' : 'Load more products'}</Text></TouchableOpacity> : null}
    />
    <Modal visible={sheet !== null} transparent animationType="none" onRequestClose={() => setSheet(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <View accessibilityViewIsModal onAccessibilityEscape={() => setSheet(null)} style={{ backgroundColor: colors.card, borderTopStartRadius: 27, borderTopEndRadius: 27, maxHeight: '93%' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 9, paddingBottom: 25 }}>
            <View style={{ width: 34, height: 4, borderRadius: 4, backgroundColor: colors.control, opacity: 0.7, alignSelf: 'center', marginBottom: 17 }} />
            <View style={[s.spread, { gap: 12 }]}><Text accessibilityRole="header" style={[s.h2, { fontSize: 23, lineHeight: 28, letterSpacing: -0.6, flex: 1 }]}>{sheet === 'filters' ? 'Find the right thing.' : shop?.shopName ?? 'Shop details'}</Text><IconButton name="close" label="Close details" onPress={() => setSheet(null)} /></View>
            {sheet === 'filters' ? <>
              <Text style={[s.muted, { marginTop: 10 }]}>Choose the listings and prices you want to see.</Text>
              <Text style={[s.body, { fontWeight: '600', marginTop: 16 }]}>Category</Text><CategoryChips items={categories} selected={draftCategory} onSelect={setDraftCategory} />
              <Text style={[s.body, { fontWeight: '600' }]}>Sort by</Text><View accessibilityRole="radiogroup" accessibilityLabel="Sort products" style={{ gap: 8, marginTop: 8 }}>{sortOptions.map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: draft.sort === value }} onPress={() => setDraft({ ...draft, sort: value })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 44, borderColor: draft.sort === value ? colors.primary : colors.border, backgroundColor: draft.sort === value ? colors.emeraldBg : colors.card }}><Icon name={draft.sort === value ? 'check' : 'filter'} color={draft.sort === value ? colors.primary : colors.muted} size={18} /><Text style={s.body}>{label}</Text></TouchableOpacity>)}</View>
              <Field label="Brand · optional" value={draft.brand} onChangeText={(brand) => setDraft({ ...draft, brand })} placeholder="Brand name" />
              <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Field label="Minimum price · Rs" value={draft.min} onChangeText={(min) => setDraft({ ...draft, min })} placeholder="0" keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Maximum price · Rs" value={draft.max} onChangeText={(max) => setDraft({ ...draft, max })} placeholder="Any" keyboardType="decimal-pad" /></View></View>
              {!!filterError && <View style={{ marginTop: 12 }}><ToastMessage>{filterError}</ToastMessage></View>}
              <TouchableOpacity accessibilityRole="button" onPress={applyFilters} style={[s.btn, { marginTop: 20, justifyContent: 'center' }]}><Text style={s.btnText}>Apply filters</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => { setDraft({ ...emptyFilters }); setDraftCategory(''); setFilterError(''); }} style={{ minHeight: 44, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>Clear filters</Text></TouchableOpacity>
            </> : <>
              {!!shop?.description && <Text style={[s.body, { marginTop: 16 }]}>{shop.description}</Text>}
              <Text style={[s.muted, { marginTop: 16 }]}>{[shop?.address, shop?.area, shop?.city].filter(Boolean).join(', ') || 'Address not provided'}</Text>
              {Number.isFinite(shop?.minimumOrderValuePaisa) && <Text style={[s.body, { marginTop: 12 }]}>Minimum order {pkr(shop.minimumOrderValuePaisa)}</Text>}
              {!!shop?.openingTime && !!shop?.closingTime && <Text style={[s.body, { marginTop: 12 }]}>Hours: {shop.openingTime}–{shop.closingTime}</Text>}
              {shop?.estimatedDeliveryMinutes != null && <Text style={[s.muted, { marginTop: 12 }]}>Estimated delivery {shop.estimatedDeliveryMinutes} min. Final fees appear in your basket.</Text>}
              {!!shop?.phoneNumber && <Text selectable style={[s.body, { marginTop: 12 }]}>Shop contact: {shop.phoneNumber}</Text>}
              <View style={{ marginTop: 20 }}><Notice>This shop prepares its own products and manages its own riders.</Notice></View>
              <TouchableOpacity accessibilityRole="button" onPress={() => setSheet(null)} style={[s.btn, { marginTop: 20, justifyContent: 'center' }]}><Text style={s.btnText}>Back to shop</Text></TouchableOpacity>
            </>}
          </ScrollView><SafeAreaView edges={['bottom']} />
        </View>
      </KeyboardAvoidingView>
    <ToastHost active={sheet !== null} /></Modal>
  </View>;
}
