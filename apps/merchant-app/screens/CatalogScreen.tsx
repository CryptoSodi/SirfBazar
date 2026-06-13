import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';

/**
 * Browse the shared SirfBazar catalog and add products to this shop.
 * Images come from the catalog, so the merchant only sets price + stock.
 */
export default function CatalogScreen() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [unlistedOnly, setUnlistedOnly] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const load = useCallback(
    async (reset: boolean) => {
      if (loading) return;
      setLoading(true);
      const nextPage = reset ? 1 : page;
      try {
        const qs = new URLSearchParams({
          page: String(nextPage),
          pageSize: '20',
          unlistedOnly: String(unlistedOnly),
        });
        if (q.trim()) qs.set('q', q.trim());
        const res = await api.get(`/merchant/catalog?${qs.toString()}`);
        setItems(reset ? res.items : [...items, ...res.items]);
        setTotalPages(res.totalPages ?? 1);
        setPage(nextPage + 1);
      } catch (e: any) {
        alert(e.message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, page, items, loading, unlistedOnly],
  );

  // Reload from scratch when the search term or filter changes (debounced).
  useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, unlistedOnly]);

  return (
    <View style={s.screen}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <TextInput
          style={s.input}
          placeholder="Search the catalog (e.g. milk, oil, soap)…"
          value={q}
          onChangeText={setQ}
        />
        <TouchableOpacity
          style={[s.row, { marginTop: 10, gap: 8 }]}
          onPress={() => setUnlistedOnly((v) => !v)}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: unlistedOnly ? colors.primary : 'transparent',
            }}
          />
          <Text style={s.muted}>Hide products already in my shop</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        data={items}
        keyExtractor={(p) => p.productId}
        onEndReached={() => page <= totalPages && load(false)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? null : (
            <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>
              No catalog products found.
            </Text>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
        renderItem={({ item: p }) => (
          <View style={[s.card, s.row, { gap: 12 }]}>
            {p.imageUrl ? (
              <Image source={{ uri: p.imageUrl }} style={{ width: 52, height: 52, borderRadius: 10 }} />
            ) : (
              <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>🛍️</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { fontWeight: '600' }]} numberOfLines={2}>{p.name}</Text>
              <Text style={s.faint}>
                {[p.brand, p.size ?? p.unit, p.category?.name].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {p.alreadyListed ? (
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>✓ Added</Text>
            ) : (
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                onPress={() => setSelected(p)}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {selected && (
        <AddModal
          product={selected}
          onClose={() => setSelected(null)}
          onAdded={() => {
            // Mark as listed in place so the button flips to ✓ Added.
            setItems((prev) =>
              unlistedOnly
                ? prev.filter((x) => x.productId !== selected.productId)
                : prev.map((x) => (x.productId === selected.productId ? { ...x, alreadyListed: true } : x)),
            );
            setSelected(null);
          }}
        />
      )}
    </View>
  );
}

function AddModal({ product, onClose, onAdded }: any) {
  const [priceRs, setPriceRs] = useState('');
  const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const pricePaisa = Math.round((Number(priceRs) || 0) * 100);
    const stockQuantity = Math.max(0, Math.floor(Number(stock) || 0));
    if (pricePaisa < 100) return alert('Enter a valid price');
    setBusy(true);
    try {
      await api.post('/merchant/products', {
        productId: product.productId,
        pricePaisa,
        stockQuantity,
      });
      onAdded();
    } catch (e: any) {
      alert(e.message);
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
    </Modal>
  );
}
