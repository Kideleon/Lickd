import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LICKD design tokens.
 * Sticker look: thick edges + hard offset shadows (the MySpace-era "stuck on" feel),
 * black and gold in dark, ivory and deep gold in light.
 */
export interface Palette {
  bg: string; surface: string; surface2: string; line: string; edge: string; shadow: string;
  text: string; muted: string; primary: string; onPrimary: string; teal: string; honey: string;
  danger: string; success: string; overlay: string;
}

export const darkPalette: Palette = {
  bg: '#0D0C0A', surface: '#171410', surface2: '#231E16', line: '#3A3220', edge: '#6B5521', shadow: '#2A220F',
  text: '#F5EEDC', muted: '#B3A98F', primary: '#E8B84A', onPrimary: '#14110A', teal: '#7FD1B9', honey: '#F2D37A',
  danger: '#FF7A70', success: '#6FD99A', overlay: 'rgba(5,4,2,0.75)',
};
export const lightPalette: Palette = {
  bg: '#F7F1E3', surface: '#FFFBF1', surface2: '#EBE2CC', line: '#D3C7A8', edge: '#14110A', shadow: '#14110A',
  text: '#14110A', muted: '#665D49', primary: '#9A6B00', onPrimary: '#FFFFFF', teal: '#17695A', honey: '#E0A82E',
  danger: '#B3261E', success: '#1E7F4A', overlay: 'rgba(20,17,10,0.55)',
};

export const fonts = {
  regular: 'BricolageGrotesque_400Regular',
  medium: 'BricolageGrotesque_500Medium',
  semibold: 'BricolageGrotesque_600SemiBold',
  bold: 'BricolageGrotesque_700Bold',
  heavy: 'BricolageGrotesque_800ExtraBold',
};

/** Profile font choices (members can pick one on their own page). */
export const PROFILE_FONTS: Record<string, string | undefined> = {
  default: undefined,
  display: 'Georgia-BoldItalic',
  mono: 'Courier',
  script: 'SnellRoundhand-Bold',
};

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };

/** One-tap looks for a member's own profile. */
export const PROFILE_THEMES: Record<string, { label: string; accent: string; background: string }> = {
  noir: { label: 'Noir', accent: '#E8B84A', background: '#0D0C0A' },
  ivory: { label: 'Ivory', accent: '#9A6B00', background: '#F7F1E3' },
  jade: { label: 'Jade', accent: '#7FD1B9', background: '#07130F' },
  ember: { label: 'Ember', accent: '#E07A3F', background: '#170D07' },
  rose: { label: 'Rose', accent: '#E58FA6', background: '#1A0D12' },
  indigo: { label: 'Indigo', accent: '#9DB0FF', background: '#0B0E1C' },
};
export const ACCENTS = ['#E8B84A', '#9A6B00', '#7FD1B9', '#17695A', '#E07A3F', '#E58FA6', '#9DB0FF', '#C9A7EB', '#F5EEDC'];
export const BACKGROUNDS = ['#0D0C0A', '#07130F', '#170D07', '#1A0D12', '#0B0E1C', '#14110A', '#F7F1E3', '#FFF4E0'];

export type ThemeMode = 'system' | 'light' | 'dark';
export interface Theme { c: Palette; isDark: boolean; mode: ThemeMode; setMode: (m: ThemeMode) => void; toggle: () => void; }

const KEY = 'lickd.theme';
const Ctx = createContext<Theme>({
  c: darkPalette, isDark: true, mode: 'system', setMode: () => {}, toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    }).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const toggle = useCallback(() => setMode(isDark ? 'light' : 'dark'), [isDark, setMode]);

  const value = useMemo<Theme>(
    () => ({ c: isDark ? darkPalette : lightPalette, isDark, mode, setMode, toggle }),
    [isDark, mode, setMode, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** Builds a StyleSheet that re-computes only when the theme changes. */
export function useStyles<T>(factory: (t: Theme) => T): T {
  const t = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(t), [t.isDark]);
}
