import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LICKD design tokens.
 * Sticker look: thick edges + hard offset shadows (the MySpace-era "stuck on" feel),
 * black and electric gold in dark, off-white and black with the same gold in light.
 */
export interface Palette {
  bg: string; surface: string; surface2: string; line: string; edge: string; shadow: string;
  text: string; muted: string; primary: string; onPrimary: string; teal: string; honey: string;
  danger: string; success: string; overlay: string;
}

export const darkPalette: Palette = {
  bg: '#0A0A0A', surface: '#151515', surface2: '#222222', line: '#363636', edge: '#FFC629', shadow: '#7A5E10',
  text: '#F7F4EC', muted: '#A39F94', primary: '#FFC629', onPrimary: '#0A0A0A', teal: '#FFD966', honey: '#FFC629',
  danger: '#FF6B5E', success: '#8BD99B', overlay: 'rgba(0,0,0,0.78)',
};
export const lightPalette: Palette = {
  bg: '#F4F2EC', surface: '#FFFFFF', surface2: '#E8E5DB', line: '#CFCABB', edge: '#0A0A0A', shadow: '#0A0A0A',
  text: '#0A0A0A', muted: '#5E5A50', primary: '#FFC629', onPrimary: '#0A0A0A', teal: '#7A5500', honey: '#FFC629',
  danger: '#B3261E', success: '#1E7F4A', overlay: 'rgba(10,10,10,0.55)',
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
  noir: { label: 'Noir', accent: '#FFC629', background: '#0A0A0A' },
  graphite: { label: 'Graphite', accent: '#F7F4EC', background: '#1B1B1B' },
  bronze: { label: 'Bronze', accent: '#E0A84A', background: '#1A1208' },
  paper: { label: 'Paper', accent: '#0A0A0A', background: '#F4F2EC' },
};
export const ACCENTS = ['#FFC629', '#E0A84A', '#F7F4EC', '#0A0A0A'];
export const BACKGROUNDS = ['#0A0A0A', '#1B1B1B', '#1A1208', '#F4F2EC'];

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
