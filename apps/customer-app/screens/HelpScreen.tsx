import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../lib/theme';
import { Icon, IconName, goTab, usePageInset } from '../components/CustomerUI';

/** C28: help entry. Ticket composition is a separate deliberate submission. */
export default function HelpScreen() {
  const { colors, s } = useTheme();
  const inset = usePageInset();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const rows: { icon: IconName; title: string; description: string; action: () => void }[] = [
    { icon: 'bag', title: 'Help with an order', description: 'Missing item, delay or delivery question', action: () => route.params?.orderId ? navigation.navigate('SupportRequest', { orderId: route.params.orderId, category: 'ORDER' }) : goTab(navigation, 'OrdersTab') },
    { icon: 'user', title: 'Account & app help', description: 'Ask a question or report a problem', action: () => navigation.navigate('SupportRequest', { category: 'GENERAL' }) },
    { icon: 'history', title: 'Your support requests', description: 'Replies and the latest ticket status', action: () => goTab(navigation, 'ProfileTab', { screen: 'SupportTickets' }) },
  ];
  return <ScrollView style={s.screen} contentContainerStyle={{ paddingHorizontal: inset, paddingTop: 12, paddingBottom: 26 }}>
    <Text accessibilityRole="header" style={s.h1}>How can{'\n'}we help?</Text>
    <Text style={[s.body, { color: colors.muted, marginTop: 8 }]}>Start with the order you need help with.</Text>
    <View style={[s.card, { padding: 0, marginTop: 24, overflow: 'hidden' }]}>
      {rows.map((item, index) => <TouchableOpacity key={item.title} accessibilityRole="button" onPress={item.action} style={[s.row, { paddingVertical: 15, paddingHorizontal: 14, minHeight: 61, gap: 12, borderBottomWidth: index < rows.length - 1 ? 1 : 0, borderColor: colors.border }]}>
        <Icon name={item.icon} size={21} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[s.body, { fontWeight: '700' }]}>{item.title}</Text><Text style={[s.muted, { fontSize: 11, lineHeight: 16.5, marginTop: 3 }]}>{item.description}</Text></View><Icon name="chevron" size={21} />
      </TouchableOpacity>)}
    </View>
    <View style={[s.card, { marginTop: 20 }]}>
      <Text accessibilityRole="header" style={[s.h2, { fontSize: 17, lineHeight: 23 }]}>Buying from local shops</Text>
      <Text style={[s.muted, { marginTop: 12 }]}>Each shop prepares its own products and manages its own riders. Multi-shop baskets can arrive separately.</Text>
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 15 }} />
      <Text accessibilityRole="header" style={[s.h2, { fontSize: 17, lineHeight: 23 }]}>Before you place an order</Text>
      <Text style={[s.muted, { marginTop: 12 }]}>Check the seller, pack size, delivery address and final charges. You sign in only when needed.</Text>
    </View>
  </ScrollView>;
}
