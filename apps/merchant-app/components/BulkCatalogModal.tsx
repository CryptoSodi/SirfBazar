import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ToastHost, useToast } from './Toast';
import { api } from '../lib/api';
import { colors, s } from '../lib/theme';

export type CatalogProduct = { productId: string; name: string; imageUrl?: string; brand?: string; size?: string; unit?: string; alreadyListed?: boolean };
type Pick = { product: CatalogProduct; price: string; stock: string };
type Payload = { requestId: string; mode: 'ADD_MISSING'; items: { rowId: string; productId: string; pricePaisa: number; stockQuantity: number }[] };

function uuidV4() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => { const n = Math.floor(Math.random() * 16); return (value === 'x' ? n : (n & 3) | 8).toString(16); }); }
function validPrice(value: string) { const paisa = Math.round(Number(value) * 100); return /^\d+(?:\.\d{1,2})?$/.test(value.trim()) && Number.isSafeInteger(paisa) && paisa >= 100 && paisa <= 2147483647; }
function validStock(value: string) { const quantity = Number(value); return /^\d+$/.test(value.trim()) && Number.isSafeInteger(quantity) && quantity <= 2147483647; }

export default function BulkCatalogModal({ products, onClose, onComplete }: { products: CatalogProduct[]; onClose: () => void; onComplete: (completed: string[]) => void }) {
  const toast = useToast();
  const [picks, setPicks] = useState<Record<string, Pick>>(() => Object.fromEntries(products.map((product) => [product.productId, { product, price: '', stock: '0' }])));
  const [busy, setBusy] = useState(false);
  const pending = useRef<Payload | null>(null);
  const rows = Object.entries(picks);
  const update = (id: string, patch: Partial<Pick>) => setPicks((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const close = () => { if (pending.current) toast('Retry the same selection to confirm whether it was saved.', false); else onClose(); };

  const submit = async () => {
    if (busy) return;
    if (!pending.current) {
      const invalid = rows.find(([, pick]) => !validPrice(pick.price) || !validStock(pick.stock));
      if (invalid) return toast(`Set a valid sale price and whole-number stock for ${invalid[1].product.name}.`, false);
      pending.current = { requestId: uuidV4(), mode: 'ADD_MISSING', items: rows.map(([id, pick]) => ({ rowId: id, productId: id, pricePaisa: Math.round(Number(pick.price) * 100), stockQuantity: Number(pick.stock) })) };
    }
    setBusy(true);
    try {
      const result = await api.post('/merchant/products/bulk-upload', pending.current);
      const completed: string[] = (result.rows ?? []).filter((row: any) => row.status === 'CREATED' || row.status === 'SKIPPED').map((row: any) => row.rowId);
      onComplete(completed);
      const finished = new Set(completed);
      setPicks((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !finished.has(id))));
      pending.current = null;
      if (!result.failed?.length) { toast(`${result.created ?? 0} products added to your shop.`); onClose(); }
      else toast(`${result.created ?? 0} added. ${result.failed.length} need attention; review their values and try again.`, false);
    } catch (error: any) { toast(`${error.message || 'Unable to confirm this selection.'} Retry the same selection to check its result.`, false); }
    finally { setBusy(false); }
  };

  return <Modal visible transparent animationType="slide" onRequestClose={close}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}><View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', padding: 16 }}>
    <Text style={s.h2}>Ready for your shop</Text><Text style={[s.muted, { marginTop: 4 }]}>Set a sale price and stock for each product.</Text>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
      {rows.map(([id, pick]) => <View key={id} style={[s.card, { marginTop: 12 }]}><View style={s.spread}><Text style={[s.body, { fontWeight: '700', flex: 1 }]}>{pick.product.name}</Text><TouchableOpacity disabled={!!pending.current} onPress={() => setPicks((current) => { const next = { ...current }; delete next[id]; return next; })}><Text style={{ color: colors.danger }}>Remove</Text></TouchableOpacity></View>
        <View style={[s.row, { gap: 8, marginTop: 10 }]}><View style={{ flex: 1 }}><Text style={s.muted}>Sale price (Rs)</Text><TextInput accessibilityLabel={`Sale price for ${pick.product.name}`} style={[s.input, { minHeight: 48 }]} keyboardType="decimal-pad" value={pick.price} editable={!pending.current} onChangeText={(value) => update(id, { price: value })} /></View>
        <View style={{ flex: 1 }}><Text style={s.muted}>Stock quantity</Text><TextInput accessibilityLabel={`Stock for ${pick.product.name}`} style={[s.input, { minHeight: 48 }]} keyboardType="number-pad" value={pick.stock} editable={!pending.current} onChangeText={(value) => update(id, { stock: value })} /></View></View>
      </View>)}
    </ScrollView>
    {!!pending.current && <Text style={[s.muted, { marginBottom: 8 }]}>This selection is locked until its saved result is checked.</Text>}
    <TouchableOpacity style={[s.btn, { minHeight: 48 }]} disabled={busy || rows.length === 0} onPress={() => void submit()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{pending.current ? 'Retry same selection' : `Add ${rows.length} products to shop`}</Text>}</TouchableOpacity>
    <TouchableOpacity style={[s.btnGhost, { minHeight: 48, marginTop: 8 }]} onPress={close}><Text style={s.btnGhostText}>Close</Text></TouchableOpacity>
  </View></View><ToastHost active /></Modal>;
}
