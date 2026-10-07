import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { Icon, IconName } from './CustomerUI';
import { useBadges } from '../lib/badges';
const tabs: { name: string; label: string; icon: IconName }[] = [
  { name: 'HomeTab', label: 'Home', icon: 'home' },
  { name: 'CartTab', label: 'Basket', icon: 'basket' },
  { name: 'OrdersTab', label: 'Orders', icon: 'orders' },
  { name: 'ProfileTab', label: 'Account', icon: 'user' },
];
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const badges = useBadges();
  const active = state.routes[state.index];
  const focusedScreen = getFocusedRouteNameFromRoute(active) ?? ({ HomeTab: 'Home', CartTab: 'Cart', OrdersTab: 'Orders', ProfileTab: 'Profile' } as Record<string, string>)[active.name];
  // Focused flows own their action dock; tabs remain only on the four roots.
  if (!['Home', 'Cart', 'Orders', 'Profile'].includes(focusedScreen ?? '') || (focusedScreen === 'Cart' && badges.cart > 0)) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderColor: colors.border,
        paddingTop: 8,
        paddingBottom: insets.bottom + 10,
        paddingHorizontal: 10,
        minHeight: (width <= 360 ? 68 : 72) + insets.bottom,
      }}
    >
      {tabs.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        const focused = state.routes[state.index]?.name === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            aria-selected={focused}
            onPress={() => {
              if (!route) return;
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented) navigation.navigate(tab.name);
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, gap: 3 }}
          >
            {focused && <View style={{ position: 'absolute', top: -8, width: 38, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.brand }} />}
            <View
              style={{
                position: 'relative',
              }}
            >
              <Icon name={tab.icon} size={22} color={focused ? colors.primary : colors.muted} />
              {tab.name === 'CartTab' && badges.cart > 0 && <Text style={{ position: 'absolute', top: -5, right: -15, backgroundColor: colors.action, color: '#fff', borderRadius: 9, minWidth: 17, paddingHorizontal: 4, fontSize: 10, textAlign: 'center' }}>{badges.cart}</Text>}
            </View>
            <Text
              style={{
                color: focused ? colors.primary : colors.muted,
                fontSize: 11,
                fontWeight: focused ? '700' : '500',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
