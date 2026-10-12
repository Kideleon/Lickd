import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sticker, Text } from '../src/components/ui';
import { useTheme } from '../src/theme';

const ITEMS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; to: string; tone: 'p' | 't' | 'h' }[] = [
  { icon: 'create', title: 'Post', sub: 'Text, photos or video', to: '/compose', tone: 'p' },
  { icon: 'location', title: 'Check in', sub: 'Tell people where you are', to: '/compose?checkin=1', tone: 't' },
  { icon: 'aperture', title: 'Story', sub: 'Disappears in 24 hours', to: '/create-story', tone: 'h' },
  { icon: 'calendar', title: 'Event', sub: 'Plan something', to: '/event/new', tone: 'p' },
  { icon: 'images', title: 'Photo album', sub: 'Collect your photos', to: '/album/new', tone: 't' },
  { icon: 'people', title: 'Group', sub: 'Start a community', to: '/group/new', tone: 'h' },
];

export default function Create() {
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const tint = (t: 'p' | 't' | 'h') => (t === 'p' ? c.primary : t === 't' ? c.teal : c.honey);
  return (
    <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
      <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20, borderTopWidth: 2, borderColor: c.line }}>
        <Text variant="title" style={{ marginBottom: 14 }}>Make something</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {ITEMS.map((i) => (
            <Pressable key={i.title} style={{ width: '47%' }} accessibilityRole="button" accessibilityLabel={`${i.title}. ${i.sub}`}
              onPress={() => { router.back(); setTimeout(() => router.push(i.to as any), 120); }}>
              <Sticker fill={c.surface}>
                <View style={{ padding: 14, gap: 8 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: tint(i.tone), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={i.icon} size={24} color={i.tone === 'h' ? '#1B1305' : c.onPrimary} />
                  </View>
                  <Text variant="body" bold>{i.title}</Text>
                  <Text variant="caption" tone="muted">{i.sub}</Text>
                </View>
              </Sticker>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
