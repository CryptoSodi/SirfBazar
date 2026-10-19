import { useToast, ToastHost } from '../components/Toast';
import { AppIcon } from '../components/AppIcon';
import { IconLabel } from '../components/IconLabel';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';
import BulkCatalogModal, { type CatalogProduct } from '../components/BulkCatalogModal';

type Category = { id: string; name: string; children?: Category[] };
const containsCategory = (category: Category, id: string): boolean => category.id === id || !!category.children?.some((child) => containsCategory(child, id));

/**
 * Browse the shared SirfBazar catalog and add products to this shop.
 * Images come from the catalog, so the merchant only sets price + stock.
 */
export default function CatalogScreen() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [unlistedOnly, setUnlistedOnly] = useState(true);
  const [selected, setSelected] = useState<Record<string, CatalogProduct>>({});
  const [review, setReview] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const requestVersion = useRef(0);
  const loadingMore = useRef(false);

  useEffect(() => { api.get('/products/categories').then(setCategories).catch(() => toast('Categories could not be loaded. Try opening this page again.', false)); }, [toast]);

  const load = useCallback(
    async (reset: boolean, requestedPage = 1) => {
      if (!reset && loadingMore.current) return;
      const version = reset ? ++requestVersion.current : requestVersion.current;
      if (!reset) loadingMore.current = true;
      setLoading(true);
      const nextPage = reset ? 1 : requestedPage;
      try {
        const qs = new URLSearchParams({
          page: String(nextPage),
          pageSize: '20',
          unlistedOnly: String(unlistedOnly),
        });
        if (q.trim()) qs.set('q', q.trim());
        if (categoryId) qs.set('categoryId', categoryId);
        const res = await api.get(`/merchant/catalog?${qs.toString()}`);
        if (version !== requestVersion.current) return;
        setItems((current) => reset ? res.items ?? [] : [...current, ...(res.items ?? [])]);
        setTotalPages(res.totalPages ?? 1);
        setPage(nextPage + 1);
      } catch (e: any) {
        if (version === requestVersion.current) toast(e.message, false);
      } finally {
        loadingMore.current = false;
        if (version === requestVersion.current) setLoading(false);
      }
    },
    [q, unlistedOnly, categoryId, toast],
  );

  // Reload from scratch when the search term or filter changes (debounced).
  useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, unlistedOnly, categoryId]);

  const toggle = (product: CatalogProduct) => setSelected((current) => {
    const next = { ...current };
    if (next[product.productId]) delete next[product.productId];
    else next[product.productId] = product;
    return next;
  });
  const categoryButtons = (nodes: Category[], depth = 0): React.ReactNode => nodes.map((category) => <View key={category.id}>
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: categoryId === category.id }} style={{ paddingVertical: 10, paddingHorizontal: 12 + depth * 14, backgroundColor: categoryId === category.id ? colors.emeraldBg : colors.card }} onPress={() => setCategoryId(category.id)}><Text style={[s.body, categoryId === category.id && { color: colors.primary, fontWeight: '700' }]}>{category.name}</Text></TouchableOpacity>
    {containsCategory(category, categoryId) ? categoryButtons(category.children ?? [], depth + 1) : null}
  </View>);

  return (
    <View style={s.screen}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <TextInput
          style={s.input}
          placeholder="Search the catalog (e.g. milk, oil, soap)…"
          value={q}
          onChangeText={setQ}
        />
        <View style={[s.row, { gap: 8, marginTop: 10 }]}>
          <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: unlistedOnly }} style={[s.btnGhost, { flex: 1, backgroundColor: unlistedOnly ? colors.emeraldBg : colors.card }]} onPress={() => setUnlistedOnly(true)}><Text style={s.btnGhostText}>Products to add</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: !unlistedOnly }} style={[s.btnGhost, { flex: 1, backgroundColor: !unlistedOnly ? colors.emeraldBg : colors.card }]} onPress={() => setUnlistedOnly(false)}><Text style={s.btnGhostText}>All products</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          <TouchableOpacity style={[s.btnGhost, { borderColor: categoryId ? colors.border : colors.primary }]} onPress={() => setCategoryId('')}><Text style={s.btnGhostText}>All categories</Text></TouchableOpacity>
          {categories.map((category) => <TouchableOpacity key={category.id} style={[s.btnGhost, { borderColor: categoryId === category.id ? colors.primary : colors.border }]} onPress={() => setCategoryId(category.id)}><Text style={s.btnGhostText}>{category.name}</Text></TouchableOpacity>)}
        </ScrollView>
        {!!categoryId && <ScrollView style={{ maxHeight: 140, marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} nestedScrollEnabled>{categoryButtons(categories)}</ScrollView>}
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        data={items}
        keyExtractor={(p) => p.productId}
        onEndReached={() => { if (!loading && page <= totalPages) void load(false, page); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={loading ? null : <View style={{ alignItems: 'center', gap: 12, marginTop: 24 }}>
          <Text style={[s.muted, { textAlign: 'center' }]}>{unlistedOnly ? 'No products to add in this selection.' : 'No catalogue products found.'}</Text>
          {unlistedOnly && <TouchableOpacity accessibilityRole="button" style={s.btnGhost} onPress={() => setUnlistedOnly(false)}><Text style={s.btnGhostText}>See all products</Text></TouchableOpacity>}
        </View>}
        ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
        renderItem={({ item: p }) => (
          <View style={[s.card, s.row, { gap: 12 }]}>
            {p.imageUrl ? (
              <Image source={{ uri: p.imageUrl }} style={{ width: 52, height: 52, borderRadius: 10 }} />
            ) : (
              <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' }}>
                <AppIcon name="bag" size={22} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={2}>{p.name}</Text>
              <Text style={s.faint}>
                {[p.brand, p.size ?? p.unit, p.category?.name].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {p.alreadyListed ? (
              <IconLabel icon="check" style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Added</IconLabel>
            ) : (
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!selected[p.productId] }}
                style={{ backgroundColor: selected[p.productId] ? colors.emeraldBg : colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}
                onPress={() => toggle(p)}
              >
                <Text style={{ color: selected[p.productId] ? colors.primary : '#fff', fontWeight: '800', fontSize: 12 }}>{selected[p.productId] ? 'Selected' : 'Select'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {Object.keys(selected).length > 0 && <TouchableOpacity style={[s.btn, { position: 'absolute', bottom: 16, left: 16, right: 16, minHeight: 50 }]} onPress={() => setReview(true)}><Text style={s.btnText}>Review {Object.keys(selected).length} products</Text></TouchableOpacity>}
      {review && <BulkCatalogModal products={Object.values(selected)} onClose={() => setReview(false)} onComplete={(completed) => {
        const done = new Set(completed);
        setSelected((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !done.has(id))));
        setItems((current) => current.map((item) => done.has(item.productId) ? { ...item, alreadyListed: true } : item).filter((item) => !unlistedOnly || !item.alreadyListed));
      }} />}
    </View>
  );
}

function AddModal({ product, onClose, onAdded }: any) {
  const toast = useToast();
  const [priceRs, setPriceRs] = useState('');
  const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const pricePaisa = Math.round((Number(priceRs) || 0) * 100);
    const stockQuantity = Math.max(0, Math.floor(Number(stock) || 0));
    if (pricePaisa < 100) return toast('Enter a valid price', false);
    setBusy(true);
    try {
      await api.post('/merchant/products', {
        productId: product.productId,
        pricePaisa,
        stockQuantity,
      });
      onAdded();
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
          <View style={[s.row, { gap: 12, marginBottom: 12 }]}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={{ width: 48, height: 48, borderRadius: 10 }} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { fontWeight: '700' }]}>{product.name}</Text>
              <Text style={s.faint}>{[product.brand, product.size ?? product.unit].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <View style={[s.row, { gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.faint}>Your price (Rs)</Text>
              <TextInput style={s.input} keyboardType="numeric" value={priceRs} onChangeText={setPriceRs} autoFocus />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.faint}>Stock quantity</Text>
              <TextInput style={s.input} keyboardType="numeric" value={stock} onChangeText={setStock} />
            </View>
          </View>
          <TouchableOpacity style={[s.btn, { marginTop: 14 }]} onPress={save} disabled={busy}>
            <Text style={s.btnText}>{busy ? 'Adding…' : 'Add to my shop'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={onClose}>
            <Text style={s.muted}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    <ToastHost active={true} /></Modal>
  );
}
