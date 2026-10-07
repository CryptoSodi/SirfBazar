/** Portable v5 design-review theme. No business state or browser APIs live here. */
export type SirfBazarTheme = {
  version: 1;
  color: string;
  mode: 'light' | 'dark' | 'system';
  sidebar: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  radius: 'square' | 'soft' | 'rounded';
  previewLogo: boolean;
};

export const THEME_KEY = 'sirfbazar.ui-theme.v5';
export const MAX_THEME_BYTES = 32 * 1024;
export const originalTheme: SirfBazarTheme = {
  version: 1,
  color: '#009966',
  mode: 'light',
  sidebar: 'light',
  density: 'comfortable',
  radius: 'soft',
  previewLogo: false,
};

export const presets = [
  ['Original', '#009966'], ['Cobalt', '#2563EB'], ['Iris', '#7C3AED'],
  ['Teal', '#0D9488'], ['Terracotta', '#D96735'], ['Rose', '#DB3B6D'],
  ['Amber', '#D89B20'], ['Slate', '#475569'],
] as const;

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let s = value.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = `#${[...s.slice(1)].map((c) => c + c).join('')}`;
  return /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : null;
}

export function validateTheme(input: unknown): SirfBazarTheme {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choose a SirfBazar theme JSON object.');
  const data = input as Record<string, unknown>;
  if (data.version !== 1) throw new Error('Unsupported theme version. Import a v1 theme.');
  const color = normalizeHex(data.color);
  if (!color) throw new Error('Theme colour must be a valid 3- or 6-digit hex value.');
  const allowed = {
    mode: ['light', 'dark', 'system'],
    sidebar: ['light', 'dark'],
    density: ['comfortable', 'compact'],
    radius: ['square', 'soft', 'rounded'],
  } as const;
  for (const [key, values] of Object.entries(allowed)) {
    if (!values.includes(data[key] as never)) throw new Error(`Invalid ${key} option.`);
  }
  if (typeof data.previewLogo !== 'boolean') throw new Error('previewLogo must be true or false.');
  return {
    version: 1, color,
    mode: data.mode as SirfBazarTheme['mode'],
    sidebar: data.sidebar as SirfBazarTheme['sidebar'],
    density: data.density as SirfBazarTheme['density'],
    radius: data.radius as SirfBazarTheme['radius'],
    previewLogo: data.previewLogo,
  };
}

export function parseThemeJSON(text: string): SirfBazarTheme {
  if (new TextEncoder().encode(text).length > MAX_THEME_BYTES) throw new Error('Theme file is larger than 32 KiB.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Choose a valid JSON theme file.'); }
  return validateTheme(value);
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => `#${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const luminance = (color: string) => rgb(color).map((v) => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function adjustForContrast(color: string, bg: string, target = 4.6) {
  if (contrast(color, bg) >= target) return color;
  const destination = contrast('#FFFFFF', bg) > contrast('#000000', bg) ? '#FFFFFF' : '#000000';
  for (let i = 1; i <= 100; i++) { const value = mix(color, destination, i / 100); if (contrast(value, bg) >= target) return value; }
  return destination;
}

export function deriveTheme(config: SirfBazarTheme, systemDark: boolean) {
  const dark = config.mode === 'dark' || (config.mode === 'system' && systemDark);
  const base = config.color;
  const panel = dark ? '#1A1E22' : '#FFFFFF';
  const canvas = dark ? '#111417' : '#F6F7F9';
  const text = dark ? '#EDF1F4' : '#172321';
  const secondary = dark ? '#AAB5BE' : '#63716E';
  const action = base === '#009966' ? '#007A52' : adjustForContrast(base, '#FFFFFF', 5);
  const tint = dark ? mix(panel, base, 0.19) : mix('#FFFFFF', base, 0.085);
  const accentText = adjustForContrast(base, tint, 4.6);
  const border = dark ? '#30383E' : '#E4E8E7';
  const radius = { square: [4, 7, 12], soft: [9, 14, 24], rounded: [13, 21, 30] }[config.radius];
  const hero = mix(base, '#112219', 0.81);
  const tokens: Record<string, string> = {
    '--sb-accent': base, '--sb-action': action, '--sb-action-hover': mix(action, '#000000', 0.15),
    '--sb-accent-text': accentText, '--sb-on-action': '#FFFFFF',
    '--sb-canvas': canvas, '--sb-panel': panel, '--sb-panel-2': dark ? '#242B31' : '#F0F2F5',
    '--sb-panel-3': dark ? '#35414B' : '#E8EBEF', '--sb-text': text, '--sb-secondary': secondary,
    '--sb-border': border, '--sb-tint': tint,
    '--sb-tint-strong': dark ? mix(panel, base, 0.33) : mix('#FFFFFF', base, 0.2),
    '--sb-hero': hero, '--sb-on-hero': '#FFFFFF',
    '--sb-warning': dark ? '#E9C273' : '#986316', '--sb-warning-bg': dark ? '#3E3320' : '#FFF6E3',
    '--sb-danger': dark ? '#F19B91' : '#B84238', '--sb-danger-bg': dark ? '#422A27' : '#FDF0EE',
    '--sb-info': dark ? '#9FBCE9' : '#3B65A7', '--sb-info-bg': dark ? '#26344C' : '#EDF3FE',
    '--sb-success': dark ? '#82D5AD' : '#167754', '--sb-success-bg': dark ? '#203C2C' : '#E9F7F0',
    '--sb-control-radius': `${radius[0]}px`, '--sb-card-radius': `${radius[1]}px`, '--sb-feature-radius': `${radius[2]}px`,
    '--sb-focus': accentText,
  };
  return { dark, tokens, actionContrast: contrast(action, '#FFFFFF') };
}
