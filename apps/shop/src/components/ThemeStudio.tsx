import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ReferenceIcon } from './ReferenceIcon';

export type ThemeMode = 'light' | 'dark' | 'system';
type ThemeContextValue = { mode: ThemeMode; setMode: (mode: ThemeMode) => void; dark: boolean };
const STORAGE_KEY = 'sirfbazar.merchant.theme';
const Context = createContext<ThemeContextValue>({ mode: 'system', setMode: () => {}, dark: false });

export const useThemeStudio = () => useContext(Context);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [mode, dark]);

  const value = useMemo(() => ({ mode, setMode, dark }), [mode, dark]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function ThemeControl() {
  const { mode, setMode } = useThemeStudio();
  return <div className="theme-control" role="group" aria-label="Appearance">
    <button type="button" aria-label="Use light appearance" aria-pressed={mode === 'light'} onClick={() => setMode('light')}><ReferenceIcon name="sun" /></button>
    <button type="button" aria-label="Use dark appearance" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}><ReferenceIcon name="moon" /></button>
    <button type="button" aria-label="Follow device appearance" aria-pressed={mode === 'system'} onClick={() => setMode('system')}><ReferenceIcon name="monitor" /></button>
  </div>;
}
