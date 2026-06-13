import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';
import { useBadges } from '../lib/badges';

/**
 * Animated bottom navigation bar:
 *  - a short white background whose top edge curves up into a bump under the
 *    selected tab (drawn with react-native-svg, animated as you switch tabs),
 *  - an emerald "blob" that glides under the active tab (the selector),
 *  - the active icon rendered larger and lifted onto the bump.
 */
const TABS = [
  { name: 'HomeTab', icon: '🏠', label: 'Home' },
  { name: 'CartTab', icon: '🛒', label: 'Cart' },
  { name: 'OrdersTab', icon: '📦', label: 'Orders' },
  { name: 'ProfileTab', icon: '👤', label: 'Account' },
] as const;

const SVG_H = 48; // background height (≈ half the old bar)
const TOP = 14; // y of the flat top edge
const DEPTH = 26; // how far the top edge dips DOWN at the active tab (concave notch)
const BW = 44; // half-width of the notch
const BLOB = 52; // selector blob (bigger)

function bgPath(cx: number, w: number) {
  // Filled background: flat top at y=TOP, curving DOWN into a notch at the
  // active center so the blob sits cradled in the dip.
  return [
    `M0 ${TOP}`,
    `H ${cx - BW}`,
    `C ${cx - BW * 0.5} ${TOP}, ${cx - BW * 0.55} ${TOP + DEPTH}, ${cx} ${TOP + DEPTH}`,
    `C ${cx + BW * 0.55} ${TOP + DEPTH}, ${cx + BW * 0.5} ${TOP}, ${cx + BW} ${TOP}`,
    `H ${w}`,
    `V ${SVG_H}`,
    `H 0`,
    'Z',
  ].join(' ');
}

function topEdgePath(cx: number, w: number) {
  // Just the curved (dipping) top edge, for a crisp border line.
  return [
    `M0 ${TOP}`,
    `H ${cx - BW}`,
    `C ${cx - BW * 0.5} ${TOP}, ${cx - BW * 0.55} ${TOP + DEPTH}, ${cx} ${TOP + DEPTH}`,
    `C ${cx + BW * 0.55} ${TOP + DEPTH}, ${cx + BW * 0.5} ${TOP}, ${cx + BW} ${TOP}`,
    `H ${w}`,
  ].join(' ');
}

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
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }); // active icon noticeably bigger
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }); // settle into the notch/blob
  const labelOpacity = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }); // hide label when active

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingTop: 10 }}>
      <View style={{ height: 28, justifyContent: 'center' }}>
        <Animated.Text style={{ fontSize: 22, transform: [{ scale }, { translateY }] }}>{icon}</Animated.Text>
        <Badge count={badge} />
      </View>
      <Animated.Text
        style={{
          fontSize: 10,
          marginTop: 1,
          fontWeight: '600',
          color: colors.faint,
          opacity: labelOpacity,
        }}
      >
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
}

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const badges = useBadges();
  const { width } = useWindowDimensions();
  const itemWidth = width / TABS.length;
  const centerOf = (i: number) => i * itemWidth + itemWidth / 2;

  const activeName = state.routes[state.index]?.name;
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.name === activeName),
  );

  const pos = useRef(new Animated.Value(activeIndex)).current;
  const [bumpX, setBumpX] = useState(centerOf(activeIndex));

  // Recompute the bump center each animation frame (JS-driven so we can read it).
  useEffect(() => {
    const id = pos.addListener(({ value }) => setBumpX(centerOf(value)));
    return () => pos.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, itemWidth]);

  useEffect(() => {
    Animated.spring(pos, { toValue: activeIndex, useNativeDriver: false, friction: 9, tension: 80 }).start();
  }, [activeIndex, pos]);

  const blobX = pos.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [centerOf(0) - BLOB / 2, centerOf(TABS.length - 1) - BLOB / 2],
  });

  const navigate = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const focused = activeName === name;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name as never);
  };

  return (
    <View style={{ height: SVG_H + insets.bottom + 14, backgroundColor: 'transparent' }}>
      {/* Curved background */}
      <Svg width={width} height={SVG_H} style={{ position: 'absolute', bottom: insets.bottom, left: 0 }}>
        <Path d={bgPath(bumpX, width)} fill={colors.card} />
        <Path d={topEdgePath(bumpX, width)} stroke={colors.border} strokeWidth={1} fill="none" />
      </Svg>

      {/* Gliding emerald blob (the selector) sitting in the bump */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: insets.bottom + SVG_H - BLOB + 6,
          left: 0,
          width: BLOB,
          height: BLOB,
          borderRadius: BLOB / 2,
          backgroundColor: colors.emeraldBg,
          borderWidth: 1.5,
          borderColor: colors.primary,
          transform: [{ translateX: blobX }],
        }}
      />

      {/* Tab items */}
      <View style={{ flexDirection: 'row', position: 'absolute', bottom: insets.bottom, left: 0, right: 0, height: SVG_H }}>
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
    </View>
  );
}
