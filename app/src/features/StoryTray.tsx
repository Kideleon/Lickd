import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Text } from '../components/ui';
import { useTheme } from '../theme';
import { useAuth } from '../lib/auth';
import { getStoryTray } from '../lib/api';

export function StoryTray() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile } = useAuth();
  const { data } = useQuery({ queryKey: ['story-tray'], queryFn: getStoryTray, refetchInterval: 60_000 });
  const mine = data?.find((s) => s.author_id === profile?.id);
  const others = (data ?? []).filter((s) => s.author_id !== profile?.id);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ paddingRight: 16 }}>
      <Pressable onPress={() => router.push(mine ? `/stories/${profile?.id}` : '/create-story')} accessibilityRole="button"
        accessibilityLabel={mine ? 'View your story' : 'Add to your story'} style={{ alignItems: 'center', width: 76, marginRight: 12 }}>
        <View>
          <Avatar path={profile?.avatar_path} name={profile?.display_name} size={64} ring={mine ? c.teal : undefined} />
          <Pressable onPress={() => router.push('/create-story')} hitSlop={6} accessibilityLabel="Add a story"
            style={{ position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={18} color={c.onPrimary} />
          </Pressable>
        </View>
        <Text variant="caption" bold numberOfLines={1} style={{ marginTop: 6 }}>Your story</Text>
      </Pressable>
      {others.map((s) => (
        <Pressable key={s.author_id} onPress={() => router.push(`/stories/${s.author_id}`)} accessibilityRole="button"
          accessibilityLabel={`${s.display_name}'s story${s.has_unseen ? ', new' : ''}`} style={{ alignItems: 'center', width: 76, marginRight: 12 }}>
          <Avatar path={s.avatar_path} name={s.display_name} size={64} ring={s.has_unseen ? c.primary : c.line} />
          <Text variant="caption" bold={s.has_unseen} numberOfLines={1} tone={s.has_unseen ? 'default' : 'muted'} style={{ marginTop: 6 }}>{s.display_name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
