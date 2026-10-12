import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LICKD design tokens.
 * Sticker look: thick edges + hard offset shadows (the MySpace-era "stuck on" feel),
 * built on espresso/tangerine/teal in dark and frosted-sky/ink/tomato in light.
 */
export interface Palette {
  bg: string; surface: string; surface2: string; line: string; edge: string; shadow: string;
  text: string; muted: string; primary: string; onPrimary: string; teal: string; honey: string;
  danger: string; success: string; overlay: string;
}

export const darkPalette: Palette = {
  bg: '#17100E', surface: '#241A16', surface2: '#31241E', line: '#4A372E', edge: '#0B0605', shadow: '#000000',
  text: '#F6EDE6', muted: '#B3A096', primary: '#FF6A3D', onPrimary: '#1A0C06', teal: '#2CC9B8', honey: '#FFC857',
  danger: '#FF6B7D', success: '#5BD68E', overlay: 'rgba(8,4,3,0.72)',
};
export const lightPalette: Palette = {
  bg: '#E9EFF5', surface: '#FFFFFF', surface2: '#DCE6F0', line: '#BCCADB', edge: '#141B28', shadow: '#141B28',
  text: '#141B28', muted: '#5A6779', primary: '#F2461B', onPrimary: '#FFFFFF', teal: '#0B8A7E', honey: '#E8A100',
  danger: '#D62F4B', success: '#1E9E5A', overlay: 'rgba(20,27,40,0.55)',
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
  tangerine: { label: 'Tangerine', accent: '#FF6A3D', background: '#17100E' },
  frost: { label: 'Frost', accent: '#F2461B', background: '#E9EFF5' },
  lagoon: { label: 'Lagoon', accent: '#2CC9B8', background: '#08181A' },
  honey: { label: 'Honey', accent: '#FFC857', background: '#1A1405' },
  cherry: { label: 'Cherry', accent: '#FF4D6D', background: '#1E0A10' },
  lime: { label: 'Lime', accent: '#B7F34A', background: '#10160A' },
};
export const ACCENTS = ['#FF6A3D', '#F2461B', '#2CC9B8', '#0B8A7E', '#FFC857', '#FF4D6D', '#B7F34A', '#7C9CFF', '#C792EA'];
export const BACKGROUNDS = ['#17100E', '#08181A', '#1A1405', '#1E0A10', '#10160A', '#0C0C10', '#E9EFF5', '#FFF4E0'];

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
