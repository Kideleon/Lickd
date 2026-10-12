import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Empty, ErrorState, Loading, Screen, Segmented, Text } from '../../src/components/ui';
import { getConversations, getMatches } from '../../src/lib/api';
import { timeAgo } from '../../src/lib/util';
import { fonts, radius, useTheme } from '../../src/theme';
import { useUid } from '../../src/lib/auth';
import type { Conversation } from '../../src/lib/types';

export default function Messages() {
  const router = useRouter();
  const { c } = useTheme();
  const uid = useUid();
  const [tab, setTab] = useState<'inbox' | 'requests'>('inbox');
  const [q, setQ] = useState('');
  const inbox = useQuery({ queryKey: ['conversations', 'inbox'], queryFn: () => getConversations(false) });
  const requests = useQuery({ queryKey: ['conversations', 'requests'], queryFn: () => getConversations(true) });
  const matches = useQuery({ queryKey: ['matches'], queryFn: getMatches });
  const active = tab === 'inbox' ? inbox : requests;
  const rows = (active.data ?? []).filter((x) => !q.trim() ||
    x.display_name.toLowerCase().includes(q.toLowerCase()) || x.username.toLowerCase().includes(q.toLowerCase()));

  const render = ({ item }: { item: Conversation }) => {
    const unread = (item.unread_count ?? 0) > 0;
    const preview = item.last_has_media && !item.last_body ? 'Sent a photo' : item.last_body || 'Say hi';
    return (
      <Pressable onPress={() => router.push(`/chat/${item.id}`)} accessibilityRole="button"
        accessibilityLabel={`${item.display_name}${unread ? `, ${item.unread_count} unread` : ''}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <Avatar path={item.avatar_path} name={item.display_name} size={54} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body" bold numberOfLines={1} style={{ flex: 1 }}>{item.display_name}</Text>
            <Text variant="caption" tone={unread ? 'primary' : 'muted'} bold={unread}>{timeAgo(item.last_message_at)}</Text>
          </View>
          <Text variant="small" tone={unread ? 'default' : 'muted'} numberOfLines={1} style={{ fontFamily: unread ? fonts.semibold : fonts.regular }}>
            {item.last_sender_id === uid ? 'You: ' : ''}{preview}
          </Text>
        </View>
        {unread ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
          <Text variant="caption" style={{ color: c.onPrimary, fontFamily: fonts.bold, fontSize: 11 }}>{item.unread_count}</Text></View> : null}
      </Pressable>
    );
  };

  return (
    <Screen>
      <Text variant="title" style={{ paddingTop: 8, paddingBottom: 12 }}>Messages</Text>
      <Segmented value={tab} onChange={setTab} options={[
        { key: 'inbox', label: 'Inbox' }, { key: 'requests', label: 'Requests', badge: requests.data?.length || undefined }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: c.line, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 44, marginVertical: 12 }}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search conversations" placeholderTextColor={c.muted} accessibilityLabel="Search conversations"
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.text }} />
      </View>
      {tab === 'inbox' && matches.data?.length && !q ? (
        <View style={{ marginBottom: 8 }}>
          <Text variant="small" bold style={{ marginBottom: 8 }}>New matches</Text>
          <FlatList horizontal data={matches.data} keyExtractor={(m) => m.match_id} showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/chat/${item.conversation_id}`)} style={{ alignItems: 'center', marginRight: 14, width: 66 }} accessibilityRole="button" accessibilityLabel={`Match: ${item.display_name}`}>
                <Avatar path={item.avatar_path} name={item.display_name} size={58} ring={c.primary} />
                <Text variant="caption" numberOfLines={1} style={{ marginTop: 4 }}>{item.display_name.split(' ')[0]}</Text>
              </Pressable>)} />
        </View>
      ) : null}
      <FlatList data={rows} keyExtractor={(x) => x.id} renderItem={render} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} tintColor={c.primary} />}
        ListEmptyComponent={active.isLoading ? <Loading /> : active.isError ? <ErrorState error={active.error} onRetry={() => active.refetch()} /> : (
          <Empty icon={tab === 'inbox' ? 'chatbubbles-outline' : 'mail-unread-outline'}
            title={tab === 'inbox' ? 'No conversations yet' : 'No message requests'}
            body={tab === 'inbox' ? 'Find someone in Discover and say hi.' : 'When someone you don\'t know messages you, it lands here first.'}
            action={tab === 'inbox' ? 'Go to Discover' : undefined} onAction={() => router.push('/discover')} />
        )} />
    </Screen>
  );
}
