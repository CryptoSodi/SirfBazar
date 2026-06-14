import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Theming with light/dark support.
 *
 * A StyleSheet snapshots its colour values at creation time, so we cannot just
 * mutate `colors` to switch themes — the styles must be rebuilt per scheme.
 * Instead, components read `const { colors, s } = useTheme()`; the hook returns
 * the palette + a pre-built StyleSheet for the active scheme and re-renders the
 * subscriber whenever the user's choice (or the OS setting) changes.
 *
 * The mode (light/dark/system) lives in a tiny global store mirroring
 * lib/badges.ts and is persisted to AsyncStorage.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

const lightColors = {
  primary: '#059669',
  primaryDark: '#047857',
  bg: '#fafaf9',
  card: '#ffffff',
  text: '#1c1917',
  muted: '#78716c',
  faint: '#a8a29e',
  border: '#e7e5e4',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  amber: '#d97706',
  emeraldBg: '#ecfdf5',
};

// Dark palette: warm-neutral (stone) surfaces to match the light theme's tone,
// brighter emerald/danger/amber so accents stay legible on dark backgrounds.
const darkColors: typeof lightColors = {
  primary: '#34d399',
  primaryDark: '#10b981',
  bg: '#0c0a09',
  card: '#1c1917',
  text: '#f5f5f4',
  muted: '#a8a29e',
  faint: '#78716c',
  border: '#292524',
  danger: '#f87171',
  dangerBg: '#450a0a',
  amber: '#fbbf24',
  emeraldBg: '#0f3d2e',
};

export type Palette = typeof lightColors;

function buildStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    pad: { padding: 16 },
    card: {
      backgroundColor: c.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    h1: { fontSize: 22, fontWeight: '800', color: c.text },
    h2: { fontSize: 17, fontWeight: '700', color: c.text },
    body: { fontSize: 14, color: c.text },
    muted: { fontSize: 12, color: c.muted },
    faint: { fontSize: 11, color: c.faint },
    btn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    btnGhost: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      backgroundColor: c.card,
    },
    btnGhostText: { color: c.text, fontWeight: '600', fontSize: 14 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      backgroundColor: c.card,
      color: c.text,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chip: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 3,
      fontSize: 11,
      overflow: 'hidden',
    },
  });
}

export type Styles = ReturnType<typeof buildStyles>;

// Pre-build once per scheme; the hook just picks the right one each render.
const palettes: Record<Scheme, Palette> = { light: lightColors, dark: darkColors };
const stylesCache: Record<Scheme, Styles> = {
  light: buildStyles(lightColors),
  dark: buildStyles(darkColors),
};

/* ---------- mode store (mirrors lib/badges.ts) ---------- */

const STORE_KEY = 'sb.themeMode';
let mode: ThemeMode = 'system';
const listeners = new Set<() => void>();

function publish() {
  for (const l of listeners) l();
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return;
  mode = next;
  AsyncStorage.setItem(STORE_KEY, next).catch(() => undefined);
  publish();
}

/** Restore the persisted choice on app start. Call once from App. */
export async function loadThemeMode(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      mode = raw;
      publish();
    }
  } catch {
    /* keep default 'system' */
  }
}

/* ---------- hook ---------- */

export interface Theme {
  colors: Palette;
  s: Styles;
  mode: ThemeMode;
  scheme: Scheme;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
}

export function useTheme(): Theme {
  // Re-renders on OS appearance change (matters when mode === 'system').
  const system = useColorScheme();
  // Re-renders on explicit mode changes.
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  return {
    colors: palettes[scheme],
    s: stylesCache[scheme],
    mode,
    scheme,
    isDark: scheme === 'dark',
    setMode: setThemeMode,
  };
}

/* ---------- backward-compatible static exports ----------
 * Light-theme snapshots so module-level code (and any not-yet-migrated file)
 * keeps compiling. Components should prefer useTheme() to react to changes. */
export const colors = lightColors;
export const s = stylesCache.light;
