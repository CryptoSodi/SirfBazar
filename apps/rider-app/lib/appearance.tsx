import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import type { ReactNode } from 'react';

export type Appearance = 'light' | 'dark' | 'system';
export const light = {
  brand: '#009966', action: '#007A52', actionHover: '#006442', onAction: '#FFFFFF',
  bg: '#F7F8F5', surface: '#FFFFFF', surface2: '#F0F4F0', ink: '#071F18',
  muted: '#52695D', quiet: '#64796D', line: '#DDE5DF', control: '#7E9387',
  accent: '#007A52', mint: '#E7F6ED', amber: '#85540D', amberBg: '#FFF2D9',
  red: '#AC382B', redBg: '#FFF0EC', blue: '#315BA5', blueBg: '#EBF1FF',
  focus: '#4762CC', map: '#E8EFE6', mapBlock: '#DCE5D9', mapRoad: '#FFFFFF',
  hero: '#07563E', heroQuiet: '#C5EADB', heroLine: '#378169',
};
export type RiderPalette = typeof light;
export const dark: RiderPalette = {
  brand: '#009966', action: '#007A52', actionHover: '#006442', onAction: '#FFFFFF',
  bg: '#101614', surface: '#19221E', surface2: '#233027', ink: '#F0F6F1',
  muted: '#B0C2B7', quiet: '#A5B9AD', line: '#35463A', control: '#789486',
  accent: '#73DEAD', mint: '#1D392B', amber: '#F6CC77', amberBg: '#3F311A',
  red: '#FFAFA4', redBg: '#422923', blue: '#B4CEFF', blueBg: '#273750',
  focus: '#A7BAFF', map: '#1D2A24', mapBlock: '#293A30', mapRoad: '#43534A',
  hero: '#134D39', heroQuiet: '#C5EADB', heroLine: '#3E7961',
};

const storageKey = 'sirfbazar.rider.appearance.v1';
const AppearanceContext = createContext<{
  appearance: Appearance;
  setAppearance: (value: Appearance) => void;
  mode: 'light' | 'dark';
  palette: RiderPalette;
}>({ appearance: 'system', setAppearance: () => undefined, mode: 'light', palette: light });

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, update] = useState<Appearance>('system');
  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') update(saved);
    }).catch(() => undefined);
  }, []);
  const setAppearance = (value: Appearance) => {
    if (!['light', 'dark', 'system'].includes(value)) return;
    update(value);
    void AsyncStorage.setItem(storageKey, value).catch(() => undefined);
  };
  const mode = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  const value = useMemo(() => ({
    appearance, setAppearance, mode, palette: mode === 'dark' ? dark : light,
  }), [appearance, mode]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useRiderTheme = () => useContext(AppearanceContext);
