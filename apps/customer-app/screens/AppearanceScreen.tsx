import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Icon, usePageInset } from '../components/CustomerUI';
import { ThemeMode, useTheme } from '../lib/theme';

/** C27 changes only the persistent preference, never navigation or shopping state. */
export default function AppearanceScreen() {
  const { colors, s, mode, setMode } = useTheme();
  const inset = usePageInset();
  return <ScrollView style={s.screen} contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
    <Text accessibilityRole="header" style={s.h1}>Make it yours.</Text>
    <Text style={[s.body, { color: colors.muted, marginTop: 8 }]}>Choose a comfortable look for your shopping.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={{ gap: 12, marginTop: 24 }}>
      {(['light', 'dark', 'system'] as ThemeMode[]).map((option) => {
        const selected = mode === option;
        const title = option[0].toUpperCase() + option.slice(1);
        return <TouchableOpacity key={option} accessibilityRole="radio" accessibilityLabel={`${title} appearance`} accessibilityState={{ checked: selected }} aria-checked={selected} onPress={() => setMode(option)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 13, minHeight: 74, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.emeraldBg : colors.card }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 49, height: 43, borderRadius: 9, padding: 7, gap: 5, overflow: 'hidden', borderWidth: 1, borderColor: option === 'dark' ? '#3F5146' : '#C8D4C7', backgroundColor: option === 'dark' ? '#101614' : '#F7F8F5' }}>
            {option === 'system' && <View style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', right: 0, backgroundColor: '#101614' }} />}
            {[{ width: 26, color: '#009966' }, { width: 32, color: '#9DAF9F' }, { width: 22, color: '#BFCFBE' }].map((bar, i) => <View key={i} style={{ width: bar.width, height: 4, borderRadius: 2, backgroundColor: bar.color }} />)}
          </View>
          <View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>{title}</Text><Text style={s.muted}>{option === 'light' ? 'Bright and easy to browse' : option === 'dark' ? 'Soft contrast for darker spaces' : 'Follow your device setting'}</Text></View>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>{selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}</View>
        </TouchableOpacity>;
      })}
    </View>
    <View style={[s.card, { marginTop: 24 }]}><View style={[s.row, { gap: 8 }]}><Icon name="basket" size={17} color={colors.primary} /><Text style={[s.body, { fontSize: 13, fontWeight: '700', flex: 1 }]}>Your basket stays with you</Text></View><Text style={[s.muted, { marginTop: 12 }]}>Changing appearance won’t reset your basket, checkout details or selected delivery.</Text></View>
  </ScrollView>;
}
