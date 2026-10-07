import { AppIcon } from './AppIcon';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRiderTheme } from '../lib/appearance';
import type { RiderPalette } from '../lib/appearance';
import { RiderReferenceIcon } from './RiderReferenceIcon';
import type { RiderReferenceIconName } from './RiderReferenceIcon';
import { api } from '../lib/api';

export type TabName = 'Deliveries' | 'History' | 'Help' | 'Profile';
export const tabs: { name: TabName; icon: RiderReferenceIconName }[] = [
  { name: 'Deliveries', icon: 'box' }, { name: 'History', icon: 'history' },
  { name: 'Help', icon: 'help' }, { name: 'Profile', icon: 'user' },
];
export function Icon({ name, size = 22, color }: { name: RiderReferenceIconName; size?: number; color?: string }) {
  const { palette } = useRiderTheme();
  return <RiderReferenceIcon name={name} size={size} color={color ?? palette.ink} />;
}
export function Label({ children, color, style }: { children: ReactNode; color?: string; style?: any }) {
  const { palette } = useRiderTheme();
  return <Text style={[{ fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', color: color ?? palette.muted }, style]}>{children}</Text>;
}
export function H1({ children, center = false, style }: { children: ReactNode; center?: boolean; style?: any }) {
  const { palette } = useRiderTheme();
  return <Text accessibilityRole="header" style={[{ fontSize: 28, lineHeight: 33, letterSpacing: -1, fontWeight: '700', color: palette.ink, textAlign: center ? 'center' : 'left' }, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: ReactNode; style?: any }) {
  const { palette } = useRiderTheme();
  return <Text accessibilityRole="header" style={[{ fontSize: 21, lineHeight: 27, letterSpacing: -0.6, fontWeight: '700', color: palette.ink }, style]}>{children}</Text>;
}
export function Body({ children, muted = false, small = false, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: any }) {
  const { palette } = useRiderTheme();
  return <Text style={[{ fontSize: small ? 12 : 14, lineHeight: small ? 18 : 21, color: muted ? palette.muted : palette.ink }, style]}>{children}</Text>;
}
export function Badge({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'amber' | 'blue' | 'red' }) {
  const { palette } = useRiderTheme();
  const pair = tone === 'amber' ? [palette.amberBg, palette.amber] : tone === 'blue' ? [palette.blueBg, palette.blue] : tone === 'red' ? [palette.redBg, palette.red] : [palette.mint, palette.accent];
  return <View style={{ backgroundColor: pair[0], paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, alignSelf: 'flex-start' }}><Text style={{ color: pair[1], fontSize: 11, lineHeight: 14, fontWeight: '700' }}>{children}</Text></View>;
}
export function IconBox({ name, tone = 'green', size = 44 }: { name: RiderReferenceIconName; tone?: 'green' | 'amber' | 'red'; size?: number }) {
  const { palette } = useRiderTheme();
  const bg = tone === 'amber' ? palette.amberBg : tone === 'red' ? palette.redBg : palette.mint;
  const color = tone === 'amber' ? palette.amber : tone === 'red' ? palette.red : palette.accent;
  return <View style={{ width: size, height: size, backgroundColor: bg, borderRadius: size > 60 ? 22 : 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}><Icon name={name} color={color} size={size > 60 ? 34 : 22} /></View>;
}
export function Card({ children, style }: { children: ReactNode; style?: any }) {
  const { palette } = useRiderTheme();
  return <View style={[{ backgroundColor: palette.surface, borderColor: palette.line, borderWidth: 1, borderRadius: 20, padding: 18 }, style]}>{children}</View>;
}
export function Note({ children, icon = 'info', tone = 'neutral', style }: { children: ReactNode; icon?: RiderReferenceIconName; tone?: 'neutral' | 'green' | 'amber' | 'red'; style?: any }) {
  const { palette } = useRiderTheme();
  const bg = tone === 'green' ? palette.mint : tone === 'amber' ? palette.amberBg : tone === 'red' ? palette.redBg : palette.surface2;
  const fg = tone === 'green' ? palette.accent : tone === 'amber' ? palette.amber : tone === 'red' ? palette.red : palette.muted;
  return <View style={[{ flexDirection: 'row', gap: 10, backgroundColor: bg, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'flex-start' }, style]}><Icon name={icon} color={fg} size={19} /><Text style={{ flex: 1, color: fg, fontSize: 12, lineHeight: 18 }}>{children}</Text></View>;
}
export function Button({ children, onPress, icon, variant = 'primary', disabled = false, style, accessibilityLabel }: { children: ReactNode; onPress?: () => void; icon?: RiderReferenceIconName; variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'hero'; disabled?: boolean; style?: any; accessibilityLabel?: string }) {
  const { palette } = useRiderTheme();
  const bg = variant === 'primary' ? palette.action : variant === 'quiet' ? palette.mint : variant === 'danger' ? palette.redBg : variant === 'hero' ? '#FFFFFF' : palette.surface;
  const fg = variant === 'primary' ? palette.onAction : variant === 'quiet' ? palette.accent : variant === 'danger' ? palette.red : variant === 'hero' ? '#074C35' : palette.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[{ minHeight: variant === 'hero' ? 50 : 54, borderRadius: variant === 'hero' ? 12 : 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: bg, borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0, borderColor: variant === 'danger' ? palette.red : palette.control, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, opacity: disabled ? 0.48 : 1 }, style]}><Text style={{ color: fg, fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'center' }}>{children}</Text>{icon && <Icon name={icon} color={fg} size={20} />}</Pressable>;
}
export function LinkButton({ children, onPress, icon, style }: { children: ReactNode; onPress: () => void; icon?: RiderReferenceIconName; style?: any }) {
  const { palette } = useRiderTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} style={[{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }, style]}>{icon && <Icon name={icon} size={16} color={palette.accent} />}<Text style={{ color: palette.accent, fontSize: 14, fontWeight: '700' }}>{children}</Text></Pressable>;
}
export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, maxLength, secureTextEntry, style }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: any; multiline?: boolean; maxLength?: number; secureTextEntry?: boolean; style?: any }) {
  const { palette } = useRiderTheme();
  return <View style={[{ marginTop: 16, gap: 7 }, style]}><Text style={{ fontSize: 13, fontWeight: '700', color: palette.ink }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.quiet} keyboardType={keyboardType} multiline={multiline} maxLength={maxLength} secureTextEntry={secureTextEntry} style={{ minHeight: multiline ? 108 : 54, paddingHorizontal: 14, paddingVertical: 14, textAlignVertical: multiline ? 'top' : 'center', borderRadius: 12, borderWidth: 1, borderColor: palette.control, backgroundColor: palette.surface, color: palette.ink, fontSize: 16 }} /></View>;
}
export function CheckRow({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: ReactNode }) {
  const { palette } = useRiderTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 13, borderRadius: 13, backgroundColor: palette.surface2 }}><View style={{ height: 21, width: 21, borderWidth: 1.5, borderColor: checked ? palette.action : palette.control, borderRadius: 3, backgroundColor: checked ? palette.action : palette.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{checked && <AppIcon name="check" size={16} color="#FFFFFF" />}</View><Text style={{ flex: 1, color: palette.ink, fontSize: 13, lineHeight: 20 }}>{children}</Text></Pressable>;
}
export function Header({ title, back, backLabel = 'Back', help, notifications = false }: { title?: string; back?: () => void; backLabel?: string; help?: () => void; notifications?: boolean }) {
  const { palette, mode } = useRiderTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [items, setItems] = useState<{ id: string; title?: string; body?: string; createdAt?: string }[]>([]);
  const [noticeError, setNoticeError] = useState('');
  const brand = mode === 'dark' ? require('../assets/brand/rider-wordmark-dark.png') : require('../assets/brand/rider-wordmark-light.png');
  const openNotifications = async () => {
    setShowNotifications(true);
    setNoticeError('');
    try {
      const data = await api.get('/notifications');
      if (!Array.isArray(data)) throw new Error('Notifications were not returned.');
      setItems(data);
    } catch (e: any) { setNoticeError(e?.message ?? 'Could not load notifications. Try again.'); }
  };
  return <View style={{ height: 68, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    {back ? <Pressable onPress={back} accessibilityRole="button" accessibilityLabel={backLabel} style={styles.iconButtonPlain}><Icon name="back" /></Pressable> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Image source={brand} resizeMode="contain" style={{ width: 124, height: 32 }} accessibilityLabel="SirfBazar" /><Text style={{ paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: palette.line, color: palette.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.6 }}>RIDER</Text></View>}
    {title ? <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: palette.ink, fontWeight: '700', fontSize: 15 }}>{title}</Text> : <View style={{ flex: 1 }} />}
    {help || notifications ? <Pressable accessibilityRole="button" accessibilityLabel={back ? 'Get help' : 'Notifications'} onPress={back ? help : () => void openNotifications()} style={{ width: 44, height: 44, borderWidth: back ? 0 : 1, borderColor: palette.line, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: back ? 'transparent' : palette.surface }}><Icon name={back ? 'help' : 'bell'} /></Pressable> : <View style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><Icon name={back ? 'help' : 'bell'} /></View>}
    <Sheet visible={showNotifications} title="Notifications" onClose={() => setShowNotifications(false)}>{noticeError ? <Note tone="red">{noticeError}</Note> : items.length === 0 ? <Body muted>No notifications yet.</Body> : items.map((item) => <View key={item.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line }}><Text style={{ color: palette.ink, fontWeight: '700', fontSize: 14 }}>{item.title ?? 'Update'}</Text><Body muted small style={{ marginTop: 4 }}>{item.body ?? ''}</Body></View>)}</Sheet>
  </View>;
}
export function Progress({ count }: { count: number }) {
  const { palette } = useRiderTheme();
  return <View style={{ flexDirection: 'row', gap: 7, marginBottom: 20 }}>{[0, 1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: 4, backgroundColor: i < count ? palette.action : palette.line, borderRadius: 3 }} />)}</View>;
}
export function BottomNav({ active, onTab }: { active: TabName; onTab: (name: TabName) => void }) {
  const { palette } = useRiderTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ minHeight: 74 + insets.bottom, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 5, paddingHorizontal: 10, backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.line, flexDirection: 'row' }}>{tabs.map(({ name, icon }) => <Pressable key={name} accessibilityRole="tab" accessibilityState={{ selected: active === name }} accessibilityLabel={name} onPress={() => onTab(name)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4, padding: 5, borderRadius: 12 }}><View style={{ width: 45, height: 27, borderRadius: 10, backgroundColor: active === name ? palette.mint : 'transparent', justifyContent: 'center', alignItems: 'center' }}><Icon name={icon} color={active === name ? palette.accent : palette.muted} /></View><Text style={{ fontSize: 10, fontWeight: '600', color: active === name ? palette.accent : palette.muted }}>{name}</Text></Pressable>)}</View>;
}
export function Dock({ label, onPress, hint, disabled, icon = 'arrow' }: { label: string; onPress: () => void; hint?: string; disabled?: boolean; icon?: RiderReferenceIconName }) {
  const { palette } = useRiderTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 18 + insets.bottom, borderTopWidth: 1, borderTopColor: palette.line, backgroundColor: palette.surface }}><Button onPress={onPress} disabled={disabled} icon={icon}>{label}</Button>{hint && <Body muted small style={{ textAlign: 'center', marginTop: 7 }}>{hint}</Body>}</View>;
}
export function Page({ title, back, backLabel, help, children, activeTab, onTab, dock, keyboard = false, contentStyle }: { title?: string; back?: () => void; backLabel?: string; help?: () => void; children: ReactNode; activeTab?: TabName; onTab?: (tab: TabName) => void; dock?: ReactNode; keyboard?: boolean; contentStyle?: any }) {
  const { palette } = useRiderTheme();
  const inner = <View style={{ flex: 1, backgroundColor: palette.bg }}><Header title={title} back={back} backLabel={backLabel} help={help} notifications={!!activeTab && !back} /><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 22, flexGrow: 1 }, contentStyle]}>{children}</ScrollView>{dock}{activeTab && onTab && <BottomNav active={activeTab} onTab={onTab} />}</View>;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.bg }}>{keyboard ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{inner}</KeyboardAvoidingView> : inner}</SafeAreaView>;
}
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { palette } = useRiderTheme();
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#071F1899', justifyContent: 'flex-end' }}><Pressable accessibilityLabel="Close dialog" onPress={onClose} style={{ flex: 1 }} /><View style={{ maxHeight: '88%', backgroundColor: palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 9, paddingHorizontal: 22, paddingBottom: 25 + insets.bottom }}><View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 3, backgroundColor: palette.control, marginBottom: 18 }} /><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}><H2>{title}</H2><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={styles.iconButtonPlain}><Icon name="close" /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView></View></View></Modal>;
}
export function Divider() {
  const { palette } = useRiderTheme();
  return <View style={{ height: 1, backgroundColor: palette.line, marginVertical: 16 }} />;
}
export function CashCard({ amount }: { amount: string }) {
  const { palette } = useRiderTheme();
  return <View style={{ backgroundColor: palette.amberBg, borderColor: palette.amber, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 22 }}><Body style={{ color: palette.amber }}>Cash to collect at delivery</Body><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: palette.amber, fontWeight: '700', fontSize: 28 }}>{amount}</Text><Icon name="cash" color={palette.amber} /></View><Body small style={{ color: palette.amber }}>Customer payment · not your earnings</Body></View>;
}
const styles = StyleSheet.create({ iconButtonPlain: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' } });
