import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Modal, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, pkr } from '../lib/api';
import { colors, s } from '../lib/theme';

export default function ProductsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [stock, setStock] = useState('');
  const [priceRs, setPriceRs] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/merchant/products?pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => setItems(r.items ?? []))
      .catch(() => undefined);
  }, [q]);

  useFocusEffect(load);

  const update = async (id: string, body: any) => {
    try {
      await api.put(`/merchant/products/${id}`, body);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openEditor = (mp: any) => {
    setEditing(mp);
    setStock(String(mp.stockQuantity));
    setPriceRs(String(Math.round(mp.pricePaisa / 100)));
  };

  const saveEditor = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.put(`/merchant/products/${editing.id}`, {
        stockQuantity: Math.max(0, Number(stock) || 0),
        pricePaisa: Math.max(100, Math.round((Number(priceRs) || 1) * 100)),
      });
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={[s.pad, { paddingBottom: 8 }]}>
        <Text style={s.h1}>Products & stock</Text>
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
        ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 24 }]}>No products listed yet.</Text>}
        renderItem={({ item: mp }) => {
          const low = mp.stockQuantity <= mp.lowStockThreshold;
          return (
            <View style={s.card}>
              <View style={s.spread}>
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
                  <Text style={{ color: low ? colors.danger : colors.muted, fontWeight: '700', fontSize: 12 }}>
                    {low ? '⚠️ ' : ''}Stock: {mp.stockQuantity} · edit ✎
                  </Text>
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
      </Modal>
    </SafeAreaView>
  );
}
