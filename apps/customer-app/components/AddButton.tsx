import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Text, TouchableOpacity } from 'react-native';
import { api, isLoggedIn } from '../lib/api';
import { colors } from '../lib/theme';
import { toast } from './Toast';

/**
 * Reusable add-to-cart button with inline feedback (no blocking alerts):
 * "+ Add" → spinner → "✓ Added" with a little pop, then reverts. Mirrors the
 * website's behaviour. Errors surface as a toast.
 */
export function AddButton({
  merchantProductId,
  outOfStock,
  onAdded,
}: {
  merchantProductId: string;
  outOfStock?: boolean;
  onAdded?: () => void;
}) {
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const scale = useRef(new Animated.Value(1)).current;

  const add = async () => {
    if (state !== 'idle' || outOfStock) return;
    setState('adding');
    try {
      const base = (await isLoggedIn()) ? '/cart' : '/guest/cart';
      await api.post(`${base}/items`, { merchantProductId, quantity: 1 });
      setState('added');
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]).start();
      onAdded?.();
      setTimeout(() => setState('idle'), 1300);
    } catch (e: any) {
      setState('idle');
      toast(e?.message ?? 'Could not add to cart');
    }
  };

  if (outOfStock) {
    return (
      <TouchableOpacity
        disabled
        style={{ borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.border, minWidth: 64, alignItems: 'center' }}
      >
        <Text style={{ color: colors.faint, fontWeight: '800', fontSize: 12 }}>Out</Text>
      </TouchableOpacity>
    );
  }

  const added = state === 'added';
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={add}
        disabled={state !== 'idle'}
        activeOpacity={0.8}
        style={{
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: added ? colors.emeraldBg : colors.primary,
          minWidth: 64,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state === 'adding' ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: added ? colors.primary : '#fff', fontWeight: '800', fontSize: 12 }}>
            {added ? '✓ Added' : '+ Add'}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
