import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, IconButton, Loading, OptionSheet, Screen, Text } from '../../src/components/ui';
import { MediaView } from '../../src/components/MediaView';
import { useSafety, useToast } from '../../src/components/feedback';
import { useUid } from '../../src/lib/auth';
import {
  deleteMessage, getConversation, getMessageReactions, getMessages, markConversationRead, respondMessageRequest, sendMessage, toggleReaction,
} from '../../src/lib/api';
import { pickMedia, uploadMedia } from '../../src/lib/media';
import { errMessage, timeAgo } from '../../src/lib/util';
import { fonts, radius, space, useTheme } from '../../src/theme';
import type { Message } from '../../src/lib/types';

const EMOJI: Record<string, string> = { like: '❤️', love: '😍', fire: '🔥', laugh: '😂', wow: '😮', sad: '😢' };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const me = useUid();
  const safety = useSafety();
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<Message | null>(null);

  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => getConversation(id!) });
  const msgs = useInfiniteQuery({
    queryKey: ['messages', id],
    queryFn: ({ pageParam }) => getMessages(id!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length < 40 ? undefined : last[last.length - 1].created_at),
  });
  const list = useMemo(() => msgs.data?.pages.flat() ?? [], [msgs.data]);
  const reacts = useQuery({
    queryKey: ['message-reactions', id, list.length],
    queryFn: () => getMessageReactions(list.map((m) => m.id)), enabled: list.length > 0,
  });

  const markRead = useCallback(() => { if (id && me) markConversationRead(id, me).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })); }, [id, me, qc]);
  useEffect(() => { markRead(); }, [markRead, list.length]);

  const other = conv.data;
  const isRequestForMe = other?.status === 'request' && other.initiator_id !== me;
  const canSend = other && (other.status === 'active' || (other.status === 'request' && other.initiator_id === me));

  const send = async (media?: { path: string; type: 'image' | 'video' }) => {
    const body = text.trim();
    if (!id || (!body && !media)) return;
    setSending(true); setText('');
    try { await sendMessage(id, me, body, media); await msgs.refetch(); qc.invalidateQueries({ queryKey: ['conversations'] }); }
    catch (e) { setText(body); toast.show(errMessage(e)); } finally { setSending(false); }
  };
  const attach = async () => {
    const [item] = await pickMedia({ video: false });
    if (!item) return;
    setSending(true);
    try { const path = await uploadMedia(me, item); await send({ path, type: 'image' }); } catch (e) { toast.show(errMessage(e)); setSending(false); }
  };
  const respond = async (accept: boolean) => {
    try { await respondMessageRequest(id!, accept); await qc.invalidateQueries({ queryKey: ['conversation', id] }); qc.invalidateQueries({ queryKey: ['conversations'] }); if (!accept) router.back(); }
    catch (e) { toast.show(errMessage(e)); }
  };
  const react = async (m: Message, key: string) => {
    const existing = (reacts.data ?? []).find((r) => r.target_id === m.id && r.user_id === me)?.reaction ?? null;
    try { await toggleReaction(me, 'message', m.id, existing, key); await reacts.refetch(); } catch (e) { toast.show(errMessage(e)); }
  };

  const menu = () => other && safety.open({ type: 'conversation', id: other.id, userId: other.other_id, username: other.username });

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.sender_id === me;
    const rs = (reacts.data ?? []).filter((r) => r.target_id === item.id);
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginVertical: 3 }}>
        <Pressable onLongPress={() => setPicked(item)} accessibilityHint="Long press for reactions and options"
          style={{ maxWidth: '78%', backgroundColor: mine ? c.primary : c.surface2, borderRadius: 20,
            borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6, padding: item.media_path ? 4 : 0, overflow: 'hidden' }}>
          {item.media_path ? <MediaView path={item.media_path} type={item.media_type ?? 'image'} style={{ width: 220, height: 260, borderRadius: 16 }} /> : null}
          {item.story_id ? <Text variant="caption" style={{ paddingHorizontal: 14, paddingTop: 8, color: mine ? c.onPrimary : c.muted }}>Replied to a story</Text> : null}
          {item.body ? <Text style={{ paddingHorizontal: 14, paddingVertical: 10, color: mine ? c.onPrimary : c.text }}>{item.body}</Text> : null}
        </Pressable>
        {rs.length ? <View style={{ flexDirection: 'row', marginTop: -6, marginHorizontal: 8, backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 6, borderWidth: 1.5, borderColor: c.line }}>
          {rs.map((r) => <Text key={r.user_id} style={{ fontSize: 14 }}>{EMOJI[r.reaction] ?? '❤️'}</Text>)}</View> : null}
        <Text variant="caption" tone="muted" style={{ marginHorizontal: 6, marginTop: 2 }}>{timeAgo(item.created_at)}</Text>
      </View>
    );
  };

  if (conv.isLoading) return <Screen><Loading /></Screen>;
  if (!other) return <Screen><IconButton name="chevron-back" label="Back" onPress={() => router.back()} /><Text style={{ padding: 20 }} tone="muted">This conversation isn't available.</Text></Screen>;

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: c.line, gap: 6 }}>
          <IconButton name="chevron-back" label="Back" onPress={() => router.back()} />
          <Pressable onPress={() => router.push(`/user/${other.other_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }} accessibilityRole="button">
            <Avatar path={other.avatar_path} name={other.display_name} size={38} />
            <View style={{ flex: 1 }}>
              <Text variant="body" bold numberOfLines={1}>{other.display_name}</Text>
              <Text variant="caption" tone="muted">@{other.username}{other.source === 'match' ? ' · match' : ''}</Text>
            </View>
          </Pressable>
          <IconButton name="ellipsis-horizontal" label="Safety options" onPress={menu} />
        </View>

        <FlatList inverted data={list} keyExtractor={(m) => m.id} renderItem={renderItem}
          contentContainerStyle={{ padding: space.lg }}
          onEndReached={() => { if (msgs.hasNextPage && !msgs.isFetchingNextPage) msgs.fetchNextPage(); }} onEndReachedThreshold={0.4}
          ListEmptyComponent={msgs.isLoading ? <Loading /> : <Text tone="muted" style={{ textAlign: 'center', transform: [{ scaleY: -1 }], padding: 30 }}>Say hi to {other.display_name.split(' ')[0]} 👋</Text>} />

        {isRequestForMe ? (
          <View style={{ padding: space.lg, gap: 10, borderTopWidth: 2, borderTopColor: c.line }}>
            <Text variant="small" tone="muted">{other.display_name} isn't a friend yet. Accept to reply, or decline to ignore them.</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><Button title="Decline" variant="secondary" onPress={() => respond(false)} /></View>
              <View style={{ flex: 1 }}><Button title="Accept" onPress={() => respond(true)} /></View>
            </View>
          </View>
        ) : canSend ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: 2, borderTopColor: c.line }}>
            <IconButton name="image-outline" label="Attach a photo" onPress={attach} />
            <TextInput value={text} onChangeText={setText} placeholder={other.status === 'request' ? 'Send a message request…' : 'Message'} placeholderTextColor={c.muted}
              multiline maxLength={2000} accessibilityLabel="Message"
              style={{ flex: 1, maxHeight: 120, minHeight: 44, fontFamily: fonts.regular, fontSize: 16, color: c.text, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 }} />
            <Pressable onPress={() => send()} disabled={sending || !text.trim()} accessibilityRole="button" accessibilityLabel="Send"
              style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: text.trim() ? c.primary : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-up" size={24} color={text.trim() ? c.onPrimary : c.muted} />
            </Pressable>
          </View>
        ) : (
          <Text tone="muted" variant="small" style={{ padding: space.lg, textAlign: 'center' }}>
            {other.status === 'declined' ? 'This request was declined.' : 'Waiting for them to accept your request.'}
          </Text>
        )}
      </KeyboardAvoidingView>

      <OptionSheet visible={!!picked} onClose={() => setPicked(null)} title="React"
        options={picked ? [
          ...Object.entries(EMOJI).map(([k, e]) => ({ label: `${e}  ${k === 'like' ? 'Love' : k[0].toUpperCase() + k.slice(1)}`, onPress: () => react(picked, k) })),
          ...(picked.sender_id === me ? [{ label: 'Unsend', destructive: true, icon: 'trash-outline' as const,
            onPress: async () => { try { await deleteMessage(picked.id); await msgs.refetch(); } catch (e) { toast.show(errMessage(e)); } } }]
            : [{ label: 'Report message', destructive: true, icon: 'flag-outline' as const,
              onPress: () => safety.open({ type: 'message', id: picked.id, userId: picked.sender_id, username: other.username }) }]),
        ] : []} />
    </Screen>
  );
}
