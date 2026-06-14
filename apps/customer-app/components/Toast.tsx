import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useTheme } from '../lib/theme';

/**
 * Lightweight global toast. Call `toast('message')` from anywhere; a single
 * <ToastHost/> mounted at the app root renders it. Replaces blocking alert()s.
 */
let show: ((msg: string) => void) | null = null;
export function toast(message: string) {
  show?.(message);
}

export function ToastHost() {
  const { isDark } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Invert the pill so it reads on either background.
  const pillBg = isDark ? '#f5f5f4' : '#1c1917';
  const pillFg = isDark ? '#1c1917' : '#fff';

  useEffect(() => {
    show = (m: string) => {
      setMsg(m);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setMsg(null),
        );
      }, 2200);
    };
    return () => {
      show = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!msg) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity, backgroundColor: pillBg }]}>
      <Text style={[styles.text, { color: pillFg }]}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: '#1c1917',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: '85%',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
