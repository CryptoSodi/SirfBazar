import { useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
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
  brand: '#009966',
  action: '#007A52',
  primary: '#007A52',
  primaryDark: '#006442',
  bg: '#F7F8F5',
  canvas: '#F0F4F0',
  card: '#ffffff',
  text: '#071F18',
  muted: '#52695D',
  faint: '#607369',
  border: '#DCE4DC',
  control: '#7E9387',
  blue: '#2659A2',
  blueBg: '#EAF2FF',
  warningBg: '#FFF4DF',
  focus: '#4762CC',
  overlay: 'rgba(6,24,17,.48)',
  imageStage: '#F6F6F0',
  danger: '#AE362D',
  dangerSolid: '#B84238',
  dangerBg: '#FFF0ED',
  amber: '#86530B',
  emeraldBg: '#E2F6EB',
  hero: '#07563E',
  heroMuted: '#CAD3D0',
  onHero: '#FFFFFF',
};

// Exact customer reference tokens. Accent text and solid actions are distinct:
// white button labels retain the darker action fill in both themes.
const darkColors: typeof lightColors = {
  brand: '#009966',
  action: '#007A52',
  primary: '#73DEAD',
  primaryDark: '#73DEAD',
  bg: '#101614',
  canvas: '#233027',
  card: '#19221E',
  text: '#F0F6F1',
  muted: '#B0C2B7',
  faint: '#A4BBAE',
  border: '#374A3E',
  control: '#789486',
  blue: '#A5C7FF',
  blueBg: '#1C304A',
  warningBg: '#3C2E16',
  focus: '#A7BAFF',
  overlay: 'rgba(0,0,0,.65)',
  imageStage: '#F6F6F0',
  danger: '#FFB4A8',
  dangerSolid: '#A33832',
  dangerBg: '#412823',
  amber: '#FFD385',
  emeraldBg: '#183F2C',
  hero: '#134D39',
  heroMuted: '#CAD3D0',
  onHero: '#FFFFFF',
};

export type Palette = typeof lightColors;

function buildStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    pad: { padding: 20 },
    card: {
      backgroundColor: c.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 17,
    },
    h1: { fontSize: 28, lineHeight: 33, letterSpacing: -0.9, fontWeight: '700', color: c.text },
    h2: { fontSize: 19, lineHeight: 24, letterSpacing: -0.4, fontWeight: '700', color: c.text },
    body: { fontSize: 14, lineHeight: 21, color: c.text },
    muted: { fontSize: 12, lineHeight: 18, color: c.muted },
    faint: { fontSize: 11, color: c.faint },
    btn: {
      backgroundColor: c.action,
      borderRadius: 13,
      minHeight: 52,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
    btnGhost: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 13,
      minHeight: 52,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      backgroundColor: c.card,
      justifyContent: 'center',
    },
    btnGhostText: { color: c.primary, fontWeight: '700', fontSize: 15, textAlign: 'center' },
    input: {
      borderWidth: 1,
      borderColor: c.control,
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 16,
      minHeight: 50,
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
let modeVersion = 0;
let modeWrites: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

function publish() {
  for (const l of listeners) l();
}

export function getThemeMode(): ThemeMode {
  return mode;
}

export function setThemeMode(next: ThemeMode) {
  if (next === mode) return;
  modeVersion++;
  mode = next;
  modeWrites = modeWrites.catch(() => undefined).then(() => AsyncStorage.setItem(STORE_KEY, next));
  modeWrites.catch(() => undefined);
  publish();
}

/** Restore the persisted choice on app start. Call once from App. */
export async function loadThemeMode(): Promise<void> {
  const version = modeVersion;
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (version === modeVersion && (raw === 'light' || raw === 'dark' || raw === 'system')) {
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
  const nativeSystem = useColorScheme();
  const [webSystem, setWebSystem] = useState<Scheme>(() =>
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    // Subscribe directly on Expo web: explicit appearance choices must not leave
    // the browser's system preference stale when switching back to System.
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setWebSystem(query.matches ? 'dark' : 'light');
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const system = Platform.OS === 'web' ? webSystem : nativeSystem;
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
