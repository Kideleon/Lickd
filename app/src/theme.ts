import { Platform } from 'react-native';

export const colors = {
  bg: '#09060F',
  surface: '#150F20',
  surface2: '#1E1630',
  border: '#2A2040',
  text: '#F7F3FF',
  muted: '#9A8FB5',
  pink: '#FF2E93',
  violet: '#8B5CF6',
  danger: '#FF4D6D',
  success: '#3DDC97',
  warn: '#FFC53D',
};
export const gradient: [string, string] = ['#FF2E93', '#8B5CF6'];
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const fonts: Record<string, string | undefined> = {
  default: undefined,
  display: Platform.select({ ios: 'Georgia-BoldItalic', android: 'serif', default: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  script: Platform.select({ ios: 'SnellRoundhand-Bold', android: 'cursive', default: 'cursive' }),
};

export const THEMES: Record<string, { label: string; accent: string; background: string }> = {
  neon: { label: 'Neon', accent: '#FF2E93', background: '#09060F' },
  midnight: { label: 'Midnight', accent: '#6E8BFF', background: '#060A18' },
  sunset: { label: 'Sunset', accent: '#FF7A45', background: '#1A0B10' },
  mint: { label: 'Mint', accent: '#3DDC97', background: '#06130F' },
  y2k: { label: 'Y2K', accent: '#00E5FF', background: '#120626' },
  gold: { label: 'Gold', accent: '#FFC53D', background: '#120E04' },
};
export const ACCENTS = ['#FF2E93', '#8B5CF6', '#6E8BFF', '#00E5FF', '#3DDC97', '#C6FF3D', '#FFC53D', '#FF7A45', '#FF4D6D'];
export const BACKGROUNDS = ['#09060F', '#060A18', '#1A0B10', '#06130F', '#120626', '#120E04', '#000000', '#1B1B1B'];
