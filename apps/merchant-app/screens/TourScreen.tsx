import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../App';
import { completeMobileTour } from '../lib/api';
import { colors, s } from '../lib/theme';
import { AppIcon } from '../components/AppIcon';

const STEPS = [
  { title: 'Your shop at a glance', body: 'The overview shows incoming orders, today’s sales and products running low.', icon: 'overview' as const, section: 'Dashboard' },
  { title: 'Manage incoming orders', body: 'Open an order, accept it, prepare it and assign a rider from the same order screen.', icon: 'box' as const, section: 'Orders' },
  { title: 'Keep your listings current', body: 'Products shows your prices, stock, availability and product photos. Add a new shop-only product here.', icon: 'tag' as const, section: 'Products' },
  { title: 'Add from the catalogue', body: 'Select several products, set each sale price and stock, then add them together.', icon: 'bag' as const, section: 'Catalog' },
  { title: 'Get riders ready', body: 'Add a rider or approve a request. Eligible riders appear in the order assignment screen.', icon: 'bike' as const, section: 'Riders' },
  { title: 'Give your team access', body: 'Only the shop owner can add staff, choose permissions and change their passwords.', icon: 'team' as const, section: 'Team' },
  { title: 'Review shop settings', body: 'Set your opening hours, delivery area, fee and minimum order. You can replay this tour from More.', icon: 'settings' as const, section: 'ShopSettings' },
];

export default function TourScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const finish = async () => { await completeMobileTour(); navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] }); };
  return <SafeAreaView style={s.screen} edges={['top', 'bottom']}><ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}>
    <Text style={[s.muted, { color: colors.primary, fontWeight: '800', letterSpacing: 1 }]}>YOUR MERCHANT APP</Text>
    <Text style={[s.h1, { fontSize: 28, marginTop: 8 }]}>A quick tour of your shop</Text>
    <View style={[s.card, { marginTop: 24, padding: 24, minHeight: 300, justifyContent: 'space-between' }]}>
      <View style={{ width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.emeraldBg }}><AppIcon name={step.icon} size={34} color={colors.primary} /></View>
      <View><Text style={[s.muted, { marginTop: 20 }]}>Step {index + 1} of {STEPS.length} · {step.section}</Text>
        <Text style={[s.h1, { marginTop: 8 }]}>{step.title}</Text>
        <Text style={[s.body, { marginTop: 10, lineHeight: 22 }]}>{step.body}</Text></View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 24 }}>{STEPS.map((_, stepIndex) => <View key={stepIndex} accessibilityLabel={`Step ${stepIndex + 1}${index === stepIndex ? ', current' : ''}`} style={{ flex: 1, height: 5, borderRadius: 4, backgroundColor: stepIndex <= index ? colors.primary : colors.border }} />)}</View>
    </View>
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: index === 0 }} style={[s.btnGhost, { flex: 1, minHeight: 48, opacity: index === 0 ? 0.5 : 1 }]} disabled={index === 0} onPress={() => setIndex(index - 1)}><Text style={s.btnGhostText}>Back</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={[s.btn, { flex: 1, minHeight: 48 }]} onPress={() => index === STEPS.length - 1 ? void finish() : setIndex(index + 1)}><Text style={s.btnText}>{index === STEPS.length - 1 ? 'Finish tour' : 'Next'}</Text></TouchableOpacity>
    </View>
    <TouchableOpacity accessibilityRole="button" style={{ minHeight: 48, marginTop: 10, alignItems: 'center', justifyContent: 'center' }} onPress={() => void finish()}><Text style={s.muted}>Skip tour</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
