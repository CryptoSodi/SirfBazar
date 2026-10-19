import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/Toast';
import { api, uploadImage } from '../lib/api';
import { colors, s } from '../lib/theme';

type Category = { id: string; name: string; children?: Category[]; isActive?: boolean };
const UNITS = ['piece', 'kg', 'g', 'litre', 'ml', 'pack', 'dozen'];

function leafCategories(nodes: Category[], parents: string[] = []): { id: string; label: string }[] {
  return nodes.flatMap((node) => {
    if (node.isActive === false) return [];
    const path = [...parents, node.name];
    return node.children?.length ? leafCategories(node.children, path) : [{ id: node.id, label: path.join(' › ') }];
  });
}

function rupees(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount >= 100 ? amount : null;
}

export default function CreateProductScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [categoryError, setCategoryError] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [unit, setUnit] = useState('piece');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [photoUri, setPhotoUri] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/products/categories').then((rows: Category[]) => {
      if (active) setCategories(leafCategories(rows));
    }).catch(() => { if (active) setCategoryError('Categories could not be loaded. Try opening this page again.'); });
    return () => { active = false; };
  }, []);

  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
      if (!result.canceled && result.assets?.[0]) setPhotoUri(result.assets[0].uri);
    } catch { toast('Could not open your photos. Try again.', false); }
  };

  const save = async () => {
    if (busy) return;
    if (!name.trim()) return toast('Enter a product name.', false);
    if (!categoryId) return toast('Choose a category.', false);
    const pricePaisa = rupees(price);
    if (pricePaisa === null) return toast('Enter a selling price of at least Rs 1, using no more than two decimal places.', false);
    if (!/^\d+$/.test(stock.trim()) || !Number.isSafeInteger(Number(stock))) return toast('Enter a whole-number stock quantity.', false);
    setBusy(true);
    try {
      const imageUrl = photoUri ? await uploadImage(photoUri) : undefined;
      await api.post('/merchant/products', {
        newProduct: {
          name: name.trim(), categoryId, unit,
          ...(brand.trim() ? { brand: brand.trim() } : {}),
          ...(size.trim() ? { size: size.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        },
        pricePaisa, stockQuantity: Number(stock),
        ...(sku.trim() ? { merchantSku: sku.trim() } : {}),
      });
      toast('Product added to your shop.');
      navigation.goBack();
    } catch (error: any) { toast(error.message || 'Unable to add this product. Try again.', false); }
    finally { setBusy(false); }
  };

  const field = (label: string, value: string, onChangeText: (value: string) => void, options: any = {}) => (
    <View style={{ marginTop: 14 }}><Text style={[s.body, { fontWeight: '700', marginBottom: 6 }]}>{label}</Text>
      <TextInput accessibilityLabel={label} style={[s.input, { minHeight: 48 }, options.multiline && { minHeight: 92, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholderTextColor={colors.muted} {...options} />
    </View>
  );

  return <SafeAreaView style={s.screen} edges={['bottom']}><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
    <Text style={s.h1}>Add a new product</Text>
    <Text style={[s.muted, { fontSize: 14, lineHeight: 21, marginTop: 6 }]}>Your shop can sell this item now. It enters the shared catalogue only after admin review.</Text>
    {field('Product name', name, setName, { placeholder: 'e.g. Fresh apples', maxLength: 240 })}
    <Text style={[s.body, { fontWeight: '700', marginTop: 18, marginBottom: 8 }]}>Category</Text>
    {!!categoryError && <Text style={{ color: colors.danger }}>{categoryError}</Text>}
    <View style={{ maxHeight: 188, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card }}>
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {categories.map((category) => <TouchableOpacity key={category.id} accessibilityRole="radio" accessibilityState={{ selected: categoryId === category.id }} onPress={() => setCategoryId(category.id)} style={{ padding: 12, backgroundColor: categoryId === category.id ? colors.emeraldBg : colors.card }}><Text style={[s.body, categoryId === category.id && { color: colors.primary, fontWeight: '700' }]}>{category.label}</Text></TouchableOpacity>)}
      </ScrollView>
    </View>
    {field('Brand (optional)', brand, setBrand, { maxLength: 160 })}
    {field('Pack size (optional)', size, setSize, { placeholder: 'e.g. 500 g', maxLength: 80 })}
    <Text style={[s.body, { fontWeight: '700', marginTop: 18, marginBottom: 8 }]}>Unit</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{UNITS.map((value) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ selected: unit === value }} onPress={() => setUnit(value)} style={[s.btnGhost, { borderColor: unit === value ? colors.primary : colors.border, backgroundColor: unit === value ? colors.emeraldBg : colors.card }]}><Text style={s.btnGhostText}>{value}</Text></TouchableOpacity>)}</View>
    {field('Shop SKU (optional)', sku, setSku, { maxLength: 160 })}
    <Text style={[s.body, { fontWeight: '700', marginTop: 18, marginBottom: 8 }]}>Product photo (optional)</Text>
    {photoUri ? <Image source={{ uri: photoUri }} style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.card }} resizeMode="contain" accessibilityLabel="Selected product photo" /> : <Text style={s.muted}>No photo selected</Text>}
    <TouchableOpacity style={[s.btnGhost, { marginTop: 8, minHeight: 48 }]} onPress={choosePhoto}><Text style={s.btnGhostText}>{photoUri ? 'Change photo' : 'Choose photo'}</Text></TouchableOpacity>
    {field('Selling price (Rs)', price, setPrice, { keyboardType: 'decimal-pad', placeholder: '0.00' })}
    {field('Stock quantity', stock, setStock, { keyboardType: 'number-pad' })}
    {field('Description (optional)', description, setDescription, { multiline: true, maxLength: 2000 })}
    <TouchableOpacity style={[s.btn, { minHeight: 48, marginTop: 22 }]} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy || !categories.length} onPress={save}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Add to my shop</Text>}</TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
