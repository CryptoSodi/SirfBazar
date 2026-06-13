import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { useBadges } from '../lib/badges';

/**
 * Animated bottom navigation bar: a colored highlight pill glides under the
 * selected tab while the active icon lifts onto it (the style of the linked
 * package), built with React Native's Animated — no native modules.
 */
const TABS = [
  { name: 'HomeTab', icon: '🏠', label: 'Home' },
  { name: 'CartTab', icon: '🛒', label: 'Cart' },
  { name: 'OrdersTab', icon: '📦', label: 'Orders' },
  { name: 'ProfileTab', icon: '👤', label: 'Account' },
] as const;

const CIRCLE = 46;

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -12,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        borderRadius: 8,
        backgroundColor: colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: colors.card,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function TabItem({
  icon,
  label,
  focused,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  focused: boolean;
  badge: number;
  onPress: () => void;
}) {
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 7 }).start();
  }, [focused, a]);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingTop: 9 }}>
      <View style={{ height: CIRCLE, justifyContent: 'center' }}>
        <Animated.Text style={{ fontSize: 20, transform: [{ scale }, { translateY }] }}>{icon}</Animated.Text>
        <Badge count={badge} />
      </View>
      <Text
        style={{
          fontSize: 10,
          marginTop: -1,
          fontWeight: focused ? '800' : '500',
          color: focused ? colors.primary : colors.faint,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const badges = useBadges();
  const { width } = useWindowDimensions();
  const itemWidth = width / TABS.length;

  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.name === activeName),
  );

  const pos = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.spring(pos, { toValue: activeIndex, useNativeDriver: true, friction: 8, tension: 70 }).start();
  }, [activeIndex, pos]);

  // Linear slide between evenly-spaced tab centers.
  const translateX = pos.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [
      itemWidth / 2 - CIRCLE / 2,
      (TABS.length - 1) * itemWidth + itemWidth / 2 - CIRCLE / 2,
    ],
  });

  const navigate = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const focused = activeName === name;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name as never);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
        height: 62 + insets.bottom,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: -2 },
      }}
    >
      {/* Sliding highlight under the active tab */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 9,
          left: 0,
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: CIRCLE / 2,
          backgroundColor: colors.emeraldBg,
          borderWidth: 1.5,
          borderColor: colors.primary,
          transform: [{ translateX }],
        }}
      />
      {TABS.map((t, i) => (
        <TabItem
          key={t.name}
          icon={t.icon}
          label={t.label}
          focused={activeIndex === i}
          badge={t.name === 'CartTab' ? badges.cart : t.name === 'OrdersTab' ? badges.orders : 0}
          onPress={() => navigate(t.name)}
        />
      ))}
    </View>
  );
}
