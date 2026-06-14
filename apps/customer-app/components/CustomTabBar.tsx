import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { Animated, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../lib/theme';
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

const SVG_H = 56; // background height
const TOP = 14; // y of the flat top edge
const DEPTH = 38; // how far the top edge dips DOWN at the active tab
const BW = 60; // half-width of the notch (wider = more rounded, gentler curve)
const BLOB = 52; // selector blob (bigger)

// Shared top edge: flat at y=TOP, curving DOWN into a smooth rounded notch at
// the active center. Symmetric bezier handles keep the scoop nicely rounded.
function topEdge(cx: number, w: number) {
  return [
    `M0 ${TOP}`,
    `H ${cx - BW}`,
    `C ${cx - BW * 0.5} ${TOP}, ${cx - BW * 0.5} ${TOP + DEPTH}, ${cx} ${TOP + DEPTH}`,
    `C ${cx + BW * 0.5} ${TOP + DEPTH}, ${cx + BW * 0.5} ${TOP}, ${cx + BW} ${TOP}`,
    `H ${w}`,
  ].join(' ');
}

function bgPath(cx: number, w: number) {
  return `${topEdge(cx, w)} V ${SVG_H} H 0 Z`;
}

function topEdgePath(cx: number, w: number) {
  return topEdge(cx, w);
}

function Badge({ count }: { count: number }) {
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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

  // Opaque page-colored container so the headroom above the curved bar never
  // shows the native window through (which can be white if the OS is in light
  // mode while the app is forced to dark).
  return (
    <View style={{ height: SVG_H + insets.bottom + 14, backgroundColor: colors.bg }}>
      <Svg width={width} height={SVG_H} style={{ position: 'absolute', bottom: insets.bottom, left: 0 }}>
        {/* Curved bar surface + hairline top edge, both themed. */}
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
