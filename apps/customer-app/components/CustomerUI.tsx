import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../lib/theme';
import { useBadges } from '../lib/badges';
import { pkr } from '../lib/api';
import { AddButton } from './AddButton';
import { CustomerReferenceIcon, type CustomerIconName } from './CustomerReferenceIcon';

export type IconName = CustomerIconName | 'browse' | 'orders' | 'package';
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  const resolved = name === 'browse' ? 'grid' : name === 'orders' ? 'bag' : name === 'package' ? 'box' : name;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"><CustomerReferenceIcon name={resolved} size={size} color={color ?? colors.muted} /></View>;
}
export function goTab(navigation: any, name: string, params?: any) {
  if (name === 'BrowseTab') { name = 'HomeTab'; params = { screen: 'Browse' }; }
  if (name === 'CartTab' && !params) params = { screen: 'Cart' };
  let nav = navigation;
  while (nav) {
    if (nav.getState()?.routeNames?.includes(name)) { nav.navigate(name, params); return; }
    nav = nav.getParent();
  }
}
export function usePageInset() { return useWindowDimensions().width <= 360 ? 16 : 20; }
export function ScreenHeader({ title, navigation, back = true, basket = true }: { title: string; navigation?: any; back?: boolean; basket?: boolean }) {
  const fallback = useNavigation<any>();
  const nav = navigation ?? fallback;
  const { colors } = useTheme();
  const badges = useBadges();
  const inset = usePageInset();
  return <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
    <View style={{ minHeight: 58, paddingHorizontal: inset, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {back && <IconButton name="back" label="Go back" onPress={() => nav.canGoBack() ? nav.goBack() : goTab(nav, 'HomeTab')} />}
      <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '700' }}>{title}</Text>
      {basket && <IconButton name="basket" label={`Basket, ${badges.cart} items`} onPress={() => goTab(nav, 'CartTab')} />}
      {basket && badges.cart > 0 && <Text style={{ backgroundColor: colors.emeraldBg, color: colors.primary, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, fontSize: 11, fontWeight: '700' }}>{badges.cart}</Text>}
    </View>
  </SafeAreaView>;
}
export function IconButton({ name, label, onPress }: { name: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={20} color={colors.text} /></TouchableOpacity>;
}
export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const { s, colors } = useTheme();
  return <View><Text accessibilityRole="header" style={s.h1}>{title}</Text>{!!subtitle && <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 }}>{subtitle}</Text>}</View>;
}
export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 11, marginTop: 19 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4, flex: 1 }}>{title}</Text>
    {!!action && onPress && <TouchableOpacity accessibilityRole="button" hitSlop={{ top: 9, bottom: 10, left: 4, right: 4 }} onPress={onPress} style={{ minHeight: 25, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{action}</Text></TouchableOpacity>}
  </View>;
}
export function SearchField({ value, onChangeText, placeholder = 'Search products', onSubmitEditing }: { value: string; onChangeText: (v: string) => void; placeholder?: string; onSubmitEditing?: () => void }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 13, minHeight: 49, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 13 }}>
    <Icon name="search" size={19} /><TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={colors.faint} value={value} onChangeText={onChangeText} onSubmitEditing={onSubmitEditing} returnKeyType="search" style={{ flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 16, color: colors.text }} />
  </View>;
}
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const { colors, s } = useTheme();
  return <View style={{ marginTop: 16, flexGrow: 1 }}>
    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 7 }}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.faint} {...props} style={[s.input, props.multiline && { minHeight: 86, textAlignVertical: 'top' }, props.style]} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{error}</Text>}
  </View>;
}
export function ActionDock({ children }: { children: ReactNode }) {
  const { colors } = useTheme(); const safe = useSafeAreaInsets(); const inset = usePageInset();
  return <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, paddingHorizontal: inset, paddingBottom: 16 + safe.bottom }}>{children}</View>;
}
export function Choice({ title, subtitle, icon, selected, onPress, disabled = false }: { title: string; subtitle?: string; icon?: IconName; selected?: boolean; onPress?: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: !!selected, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 62, borderRadius: 14, padding: 14, gap: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.emeraldBg : colors.card }}>
    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>{selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
    {icon && <Icon name={icon} color={colors.primary} />}
    <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{title}</Text>{!!subtitle && <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{subtitle}</Text>}</View>
  </TouchableOpacity>;
}
export function CategoryChips({ items, selected, onSelect }: { items: any[]; selected: string; onSelect: (id: string) => void }) {
  const { colors } = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>{[{ id: '', name: 'All' }, ...items].map(c => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: selected === c.id }} key={c.id} onPress={() => onSelect(c.id)} style={{ paddingHorizontal: 13, minHeight: 44, justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: selected === c.id ? colors.action : colors.border, backgroundColor: selected === c.id ? colors.action : colors.card }}><Text style={{ color: selected === c.id ? '#fff' : colors.muted, fontSize: 12 }}>{c.name}</Text></TouchableOpacity>)}</ScrollView>;
}
export function ProductArtwork({ uri, size = 103, name }: { uri?: string; size?: number; name?: string }) {
  const { colors } = useTheme(); const [failedUri, setFailedUri] = useState<string>();
  return <View style={{ height: size, backgroundColor: colors.imageStage, borderRadius: size > 180 ? 22 : 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {uri && uri !== failedUri ? <Image source={{ uri }} accessibilityLabel={name} onError={() => setFailedUri(uri)} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : <><Icon name="package" size={size > 180 ? 56 : 28} color="#52695D" />{size > 90 && <Text style={{ color: '#52695D', fontSize: 10, marginTop: 9 }}>Image unavailable</Text>}</>}
  </View>;
}
export function ProductCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { colors } = useTheme(); const { width } = useWindowDimensions();
  const priced = !!item.merchantProductId && Number.isFinite(item.discountPricePaisa ?? item.pricePaisa);
  return <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: width <= 360 ? 9 : 10 }}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${item.name}`} onPress={onPress}>
      <ProductArtwork uri={item.imageUrl} name={item.name} size={103} />
      <Text style={{ color: colors.text, fontSize: width <= 360 ? 13 : 14, fontWeight: '700', lineHeight: 18, minHeight: 36, marginTop: 10, marginBottom: 3 }} numberOfLines={2}>{item.name}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{item.size ?? item.unit ?? item.brand ?? 'View pack details'}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, lineHeight: 15, marginVertical: 7 }}>{priced ? item.merchant?.shopName ?? 'View selected shop' : 'Choose a local seller'}</Text>
    </TouchableOpacity>
    {priced ? <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 5 }}><Text style={{ color: colors.text, fontSize: width <= 360 ? 16 : 17, letterSpacing: -0.4, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(item.discountPricePaisa ?? item.pricePaisa)}</Text><AddButton productId={item.productId ?? item.id} merchantProductId={item.merchantProductId} outOfStock={item.isAvailable === false || item.stockQuantity === 0 || item.isRestricted || item.requiresPrescription} /></View> : <TouchableOpacity accessibilityRole="button" onPress={onPress} style={{ backgroundColor: colors.emeraldBg, padding: 8, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>Check availability</Text></TouchableOpacity>}
  </View>;
}
export function ShopCard({ shop, onPress }: { shop: any; onPress: () => void }) {
  const { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 14, marginVertical: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
    <View style={{ backgroundColor: colors.emeraldBg, borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="shop" size={25} color={colors.primary} /></View>
    <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 5 }}>{shop.shopName}</Text><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{[shop.area, shop.city].filter(Boolean).join(', ') || 'Independent local shop'}</Text><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 }}><Text style={{ color: colors.primary }}>{shop.isOnline && shop.isOpen ? 'Open' : 'Closed'}</Text> · {shop.estimatedDeliveryMinutes != null ? `Est. ${shop.estimatedDeliveryMinutes} min · ` : ''}Fee in basket</Text></View><Icon name="chevron" />
  </TouchableOpacity>;
}
export function Notice({ children, danger = false, tone = 'info', icon = 'info' }: { children: ReactNode; danger?: boolean; tone?: 'info' | 'warning' | 'blue'; icon?: IconName }) {
  const { colors } = useTheme();
  const text = danger ? colors.danger : tone === 'warning' ? colors.amber : tone === 'blue' ? colors.blue : colors.primary;
  const bg = danger ? colors.dangerBg : tone === 'warning' ? colors.warningBg : tone === 'blue' ? colors.blueBg : colors.emeraldBg;
  return <View accessibilityRole={danger ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 9, padding: 12, backgroundColor: bg, borderRadius: 12 }}><Icon name={icon} size={18} color={text} /><Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: text }}>{children}</Text></View>;
}
export function CatalogSkeleton() {
  const { colors } = useTheme();
  return <View accessibilityLabel="Loading shopping options" accessibilityRole="progressbar" style={{ gap: 16 }}><View style={{ width: '60%', height: 20, borderRadius: 13, backgroundColor: colors.canvas }} /><View style={{ height: 49, borderRadius: 13, backgroundColor: colors.canvas }} /><View style={{ height: 143, borderRadius: 13, backgroundColor: colors.canvas }} /><View style={{ width: '60%', height: 20, borderRadius: 13, backgroundColor: colors.canvas, marginTop: 8 }} /><View style={{ gap: 12 }}>{[0, 1].map(row => <View key={row} style={{ flexDirection: 'row', gap: 12 }}>{[0, 1].map(column => <View key={column} style={{ flex: 1, minWidth: 0, height: 172, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }} />)}</View>)}</View></View>;
}
export function StatePanel({ title, message, loading, action, onPress, icon = 'basket', secondaryAction, onSecondary }: { title: string; message?: string; loading?: boolean; action?: string; onPress?: () => void; icon?: IconName; secondaryAction?: string; onSecondary?: () => void }) {
  const { colors, s } = useTheme();
  if (loading) return <CatalogSkeleton />;
  return <View style={{ alignItems: 'center', paddingVertical: 23, paddingHorizontal: 8 }}>
    <View style={{ marginTop: 28, marginBottom: 24, width: 90, height: 90, borderRadius: 28, backgroundColor: colors.emeraldBg, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={40} color={colors.primary} /></View>
    <Text accessibilityRole="header" style={[s.h1, { fontSize: 25, lineHeight: 30, textAlign: 'center' }]}>{title}</Text>
    {!!message && <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22.4, textAlign: 'center', marginTop: 13, marginBottom: 23 }}>{message}</Text>}
    {!!action && onPress && <TouchableOpacity accessibilityRole="button" style={[s.btn, { alignSelf: 'stretch' }]} onPress={onPress}><Text style={s.btnText}>{action}</Text></TouchableOpacity>}
    {!!secondaryAction && onSecondary && <TouchableOpacity accessibilityRole="button" onPress={onSecondary} style={{ minHeight: 44, justifyContent: 'center', marginTop: 12 }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{secondaryAction}</Text></TouchableOpacity>}
  </View>;
}
export const RecoveryState = StatePanel;
export function OrderSummary({ cart, title = 'Order summary', bare = false }: { cart: any; title?: string; bare?: boolean }) {
  const { colors, s } = useTheme();
  const lines: [string, number | undefined][] = [[`Items (${cart.itemCount ?? '—'})`, cart.subtotalPaisa], [`Shop deliveries (${cart.groups?.length ?? '—'})`, cart.deliveryFeePaisa]];
  if (cart.serviceFeePaisa != null) lines.push(['Service fee', cart.serviceFeePaisa]);
  if (cart.smallOrderFeePaisa) lines.push(['Small order fee', cart.smallOrderFeePaisa]);
  if (cart.discountPaisa) lines.push(['Discount', -cart.discountPaisa]);
  return <View style={[!bare && s.card, { gap: 9 }]}>{!!title && <Text style={[s.h2, { marginBottom: 7 }]}>{title}</Text>}{lines.map(([label, value]) => <View key={label} style={[s.spread, { alignItems: 'flex-start' }]}><Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, flexShrink: 1 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(value)}</Text></View>)}<View style={[s.spread, { paddingTop: 12, marginTop: 3, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.control }]}><Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>Total</Text><Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{pkr(cart.totalPaisa ?? cart.totalAmountPaisa)}</Text></View></View>;
}
