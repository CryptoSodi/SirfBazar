import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { useBadges } from '../lib/badges';

/**
 * Custom animated bottom navigation bar with a raised Cart FAB.
 * Rendered by the Tab.Navigator, so it stays visible on every screen
 * (including nested detail screens) and reserves layout space for them.
 *
 * Layout:  [Home] [Orders]   (●Cart FAB)   [Profile]
 */
const SIDE = [
  { name: 'HomeTab', icon: '🏠', label: 'Home' },
  { name: 'OrdersTab', icon: '📦', label: 'Orders' },
  { name: 'ProfileTab', icon: '👤', label: 'Account' },
] as const;

function Badge({ count, floating }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: floating ? -4 : -6,
        right: floating ? -6 : -12,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        borderRadius: 8,
        backgroundColor: floating ? '#fff' : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: floating ? 1.5 : 0,
        borderColor: colors.primary,
      }}
    >
      <Text style={{ color: floating ? colors.primary : '#fff', fontSize: 9, fontWeight: '800' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

function SideItem({
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
    Animated.spring(a, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 6 }).start();
  }, [focused, a]);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingTop: 8 }}>
      <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
        <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
        <Badge count={badge} />
      </Animated.View>
      <Text
        style={{
          fontSize: 10,
          marginTop: 2,
          fontWeight: focused ? '800' : '500',
          color: focused ? colors.primary : colors.faint,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CartFab({ focused, badge, onPress }: { focused: boolean; badge: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: -26, alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start()}
          onPressOut={() =>
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 120 }).start()
          }
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: focused ? colors.primaryDark : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: colors.bg,
            elevation: 8,
            shadowColor: colors.primary,
            shadowOpacity: 0.4,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ fontSize: 24 }}>🛒</Text>
          <Badge count={badge} floating />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const badges = useBadges();
  const activeName = state.routes[state.index]?.name;

  const navigate = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const focused = activeName === name;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name as never);
  };

  const side = (name: string) => SIDE.find((s) => s.name === name)!;

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
        height: 60 + insets.bottom,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: -2 },
      }}
    >
      {/* Left group: Home, Orders */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {['HomeTab', 'OrdersTab'].map((n) => {
          const item = side(n);
          return (
            <SideItem
              key={n}
              icon={item.icon}
              label={item.label}
              focused={activeName === n}
              badge={n === 'OrdersTab' ? badges.orders : 0}
              onPress={() => navigate(n)}
            />
          );
        })}
      </View>

      {/* Center spacer reserving room for the FAB */}
      <View style={{ width: 64 }} />

      {/* Right group: Profile */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <SideItem
          icon={side('ProfileTab').icon}
          label={side('ProfileTab').label}
          focused={activeName === 'ProfileTab'}
          badge={0}
          onPress={() => navigate('ProfileTab')}
        />
      </View>

      {/* Raised Cart FAB (centered) */}
      <CartFab focused={activeName === 'CartTab'} badge={badges.cart} onPress={() => navigate('CartTab')} />
    </View>
  );
}
