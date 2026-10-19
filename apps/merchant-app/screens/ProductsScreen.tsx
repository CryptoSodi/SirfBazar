import { useToast, ToastHost } from '../components/Toast';
import { IconLabel } from '../components/IconLabel';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { api, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function ProductsScreen() {
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [stock, setStock] = useState('');
  const [priceRs, setPriceRs] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nextPage, setNextPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestVersion = useRef(0);
  const pageBusy = useRef(false);

  const load = useCallback(async (page = 1) => {
    if (page > 1 && pageBusy.current) return;
    const version = page === 1 ? ++requestVersion.current : requestVersion.current;
    pageBusy.current = true;
    setLoading(true);
    try {
      const response = await api.get(`/merchant/products?page=${page}&pageSize=24${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
      if (version !== requestVersion.current) return;
      setItems((current) => page === 1 ? response.items ?? [] : [...current, ...(response.items ?? [])]);
      setNextPage(page + 1);
      setTotalPages(response.totalPages ?? 1);
    } catch (error: any) {
      if (version === requestVersion.current) toast(error.message || 'Unable to load your products.', false);
    } finally {
      if (version === requestVersion.current) {
        pageBusy.current = false;
        setLoading(false);
      }
    }
  }, [q, toast]);

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => { void load(1); }, 250);
    return () => { clearTimeout(timer); requestVersion.current += 1; };
  }, [load]));

  const update = async (id: string, body: any) => {
    try {
      await api.put(`/merchant/products/${id}`, body);
      setItems((current) => current.map((item) => item.id === id ? { ...item, ...body } : item));
    } catch (e: any) {
      toast(e.message, false);
    }
  };

  const openEditor = (mp: any) => {
    setEditing(mp);
    setStock(String(mp.stockQuantity));
    setPriceRs(String(Math.round(mp.pricePaisa / 100)));
  };

  const saveEditor = async () => {
    if (!editing) return;
    if (!/^\d+$/.test(stock.trim()) || !Number.isSafeInteger(Number(stock))) return toast('Enter a whole-number stock quantity.', false);
    if (!/^\d+(?:\.\d{1,2})?$/.test(priceRs.trim()) || Math.round(Number(priceRs) * 100) < 100) return toast('Enter a selling price of at least Rs 1.', false);
    setBusy(true);
    try {
      const changes = {
        stockQuantity: Number(stock),
        pricePaisa: Math.round(Number(priceRs) * 100),
      };
      await api.put(`/merchant/products/${editing.id}`, changes);
      setItems((current) => current.map((item) => item.id === editing.id ? { ...item, ...changes } : item));
      setEditing(null);
    } catch (e: any) {
      toast(e.message, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <Text style={s.h1}>Products & stock</Text>
        <View style={[s.row, { gap: 8, marginTop: 12 }]}>
          <TouchableOpacity style={[s.btn, { flex: 1, minHeight: 48 }]} onPress={() => navigation.navigate('Catalog')}><Text style={s.btnText}>Browse catalog</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btnGhost, { flex: 1, minHeight: 48 }]} onPress={() => navigation.navigate('CreateProduct')}><Text style={s.btnGhostText}>Add new product</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={[s.btnGhost, { marginTop: 8, minHeight: 44 }]} onPress={() => void Linking.openURL('https://shop.sirfbazar.com/products')}><Text style={s.btnGhostText}>Import CSV or Excel on web</Text></TouchableOpacity>
        <TextInput
          style={[s.input, { marginTop: 10 }]}
          placeholder="Search your products…"
          value={q}
          onChangeText={setQ}
        />
      </View>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}
        data={items}
        keyExtractor={(mp) => mp.id}
        onEndReached={() => { if (!loading && nextPage <= totalPages) void load(nextPage); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={loading ? null : <Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No products listed yet.</Text>}
        ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.primary} /> : null}
        renderItem={({ item: mp }) => {
          const low = mp.stockQuantity <= mp.lowStockThreshold;
          return (
            <View style={s.card}>
              <View style={s.spread}>
                {mp.product.imageUrl ? <Image source={{ uri: mp.product.imageUrl }} style={{ width: 56, height: 56, borderRadius: 10, marginRight: 10, backgroundColor: colors.bg }} resizeMode="contain" accessibilityLabel={`${mp.product.name} photo`} /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={[s.body, { fontWeight: '700' }]} numberOfLines={1}>{mp.product.name}</Text>
                  <Text style={s.faint}>
                    {[mp.product.brand, mp.product.size ?? mp.product.unit].filter(Boolean).join(' · ')}
                    {' · '}{mp.product.category?.name}
                  </Text>
                </View>
                <Switch
                  value={mp.isAvailable}
                  onValueChange={(v) => update(mp.id, { isAvailable: v })}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              <View style={[s.spread, { marginTop: 8 }]}>
                <Text style={{ fontWeight: '800' }}>
                  {pkr(mp.discountPricePaisa ?? mp.pricePaisa)}
                  {mp.discountPricePaisa != null && (
                    <Text style={{ color: colors.faint, fontSize: 11 }}>  was {pkr(mp.pricePaisa)}</Text>
                  )}
                </Text>
                <TouchableOpacity onPress={() => openEditor(mp)}>
                  <IconLabel icon={low ? "warning" : "edit"} style={{ color: low ? colors.danger : colors.muted, fontWeight: '700', fontSize: 12 }}>
                    {low ? 'Low stock: ' : 'Stock: '}{mp.stockQuantity} · Edit
                  </IconLabel>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={s.h2}>{editing?.product?.name}</Text>
            <View style={[s.row, { gap: 8, marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.faint}>Price (Rs)</Text>
                <TextInput style={s.input} keyboardType="numeric" value={priceRs} onChangeText={setPriceRs} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.faint}>Stock quantity</Text>
                <TextInput style={s.input} keyboardType="numeric" value={stock} onChangeText={setStock} />
              </View>
            </View>
            <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={saveEditor} disabled={busy}>
              <Text style={s.btnText}>{busy ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setEditing(null)}>
              <Text style={s.muted}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      <ToastHost active={!!editing} /></Modal>
    </SafeAreaView>
  );
}
