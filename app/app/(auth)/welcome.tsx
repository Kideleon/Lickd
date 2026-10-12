import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Screen, Sticker, Text, Wordmark } from '../../src/components/ui';
import { fonts, space, useTheme } from '../../src/theme';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; tilt: string }[] = [
  { icon: 'color-palette', title: 'A profile that looks like you', body: 'Pick your colors, your music, your Top 8.', tilt: '-1.5deg' },
  { icon: 'people', title: 'Groups and events nearby', body: 'Find your crew and what is happening this weekend.', tilt: '1deg' },
  { icon: 'shield-checkmark', title: 'Safety is built in', body: 'Block, mute, report, and decide who can reach you.', tilt: '-0.5deg' },
];

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Screen scroll>
      <View style={{ paddingTop: space.xl, paddingBottom: space.lg }}>
        <View style={{ transform: [{ rotate: '-3deg' }], alignSelf: 'flex-start' }}><Wordmark size={64} /></View>
        <Text variant="display" style={{ marginTop: space.lg }}>Your people.{'\n'}Your space.{'\n'}Your vibe.</Text>
        <Text tone="muted" style={{ marginTop: space.md, maxWidth: 340 }}>
          A social network made for Black queer women, lesbians, and queer women. Free to join.
        </Text>
      </View>

      <View style={{ gap: space.lg, marginVertical: space.lg }}>
        {POINTS.map((p, i) => (
          <Sticker key={p.title} fill={i === 0 ? c.honey : undefined} style={{ transform: [{ rotate: p.tilt }] }}>
            <View style={{ flexDirection: 'row', gap: 14, padding: space.md, alignItems: 'center' }}>
              <Ionicons name={p.icon} size={28} color={i === 0 ? '#1B1305' : c.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontFamily: fonts.bold, color: i === 0 ? '#1B1305' : c.text }}>{p.title}</Text>
                <Text variant="small" style={{ color: i === 0 ? '#3A2B08' : c.muted }}>{p.body}</Text>
              </View>
            </View>
          </Sticker>
        ))}
      </View>

      <View style={{ gap: space.md, marginTop: space.md }}>
        <Button title="Create account" onPress={() => router.push('/sign-up')} />
        <Button title="I already have an account" variant="secondary" onPress={() => router.push('/sign-in')} />
        <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>LICKD is for people 18 and older.</Text>
      </View>
    </Screen>
  );
}
