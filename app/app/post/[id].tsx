import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Empty, ErrorState, Header, Loading, Screen, Text } from '../../src/components/ui';
import { PostCard } from '../../src/components/cards';
import { useSafety, useToast } from '../../src/components/feedback';
import { addComment, deleteComment, getComments, getPost } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { errMessage, timeAgo } from '../../src/lib/util';
import { fonts, radius, useTheme } from '../../src/theme';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUid();
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const safety = useSafety();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const post = useQuery({ queryKey: ['post', id], queryFn: () => getPost(id!, me) });
  const comments = useQuery({ queryKey: ['comments', id], queryFn: () => getComments(id!) });

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await addComment(id!, me, text); setText(''); await comments.refetch(); qc.invalidateQueries({ queryKey: ['post', id] }); }
    catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };

  if (post.isLoading) return <Screen><Header /><Loading /></Screen>;
  if (post.isError) return <Screen><Header /><ErrorState error={post.error} onRetry={post.refetch} /></Screen>;
  if (!post.data) return <Screen><Header /><Empty icon="eye-off-outline" title="This post isn't available" body="It may have been deleted or made private." /></Screen>;

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingHorizontal: 16 }}><Header title="Post" /></View>
        <FlatList data={comments.data ?? []} keyExtractor={(x) => x.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListHeaderComponent={<View><PostCard post={post.data} detail /><Text variant="h2" style={{ marginBottom: 8 }}>Comments</Text></View>}
          ListEmptyComponent={comments.isLoading ? <Loading /> : <Text tone="muted" variant="small">No comments yet. Start the conversation.</Text>}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
              <Avatar path={item.author?.avatar_path} name={item.author?.display_name} size={36} onPress={() => router.push(`/user/${item.author_id}`)} />
              <View style={{ flex: 1 }}>
                <Text variant="small"><Text variant="small" bold>{item.author?.display_name ?? 'Member'}</Text>  <Text variant="caption" tone="muted">{timeAgo(item.created_at)}</Text></Text>
                <Text variant="body">{item.body}</Text>
              </View>
              <Pressable hitSlop={10} accessibilityLabel="Comment options" accessibilityRole="button"
                onPress={() => safety.open({
                  type: 'comment', id: item.id, userId: item.author_id, username: item.author?.username ?? 'member',
                  extra: (item.author_id === me || post.data!.author_id === me) ? [{
                    label: 'Delete comment', icon: 'trash-outline', destructive: true,
                    onPress: async () => { try { await deleteComment(item.id); await comments.refetch(); qc.invalidateQueries({ queryKey: ['post', id] }); } catch (e) { toast.show(errMessage(e)); } },
                  }] : [],
                })}>
                <Ionicons name="ellipsis-horizontal" size={18} color={c.muted} />
              </Pressable>
            </View>
          )} />
        <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 2, borderTopColor: c.line, alignItems: 'flex-end' }}>
          <TextInput value={text} onChangeText={setText} placeholder="Add a comment" placeholderTextColor={c.muted} maxLength={1000} multiline accessibilityLabel="Add a comment"
            style={{ flex: 1, maxHeight: 110, minHeight: 44, fontFamily: fonts.regular, fontSize: 16, color: c.text, backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 2, borderColor: c.line, paddingHorizontal: 14, paddingVertical: 10 }} />
          <Pressable onPress={send} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Post comment"
            style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: text.trim() ? c.primary : c.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-up" size={24} color={text.trim() ? c.onPrimary : c.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
