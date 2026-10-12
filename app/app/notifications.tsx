import React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Empty, ErrorState, Header, Loading, Screen, Text } from '../src/components/ui';
import { PAGE, getNotifications, markAllNotificationsRead, markNotificationRead } from '../src/lib/api';
import { useUid } from '../src/lib/auth';
import { timeAgo } from '../src/lib/util';
import { useTheme } from '../src/theme';
import type { NotificationItem } from '../src/lib/types';

function describe(n: NotificationItem): { text: string; icon: keyof typeof Ionicons.glyphMap; to: string | null } {
  const who = n.actor?.display_name ?? 'Someone';
  switch (n.type) {
    case 'like': return { text: `${who} liked your ${n.target_type === 'comment' ? 'comment' : 'post'}`, icon: 'heart', to: `/post/${n.data?.post_id ?? n.target_id}` };
    case 'comment': return { text: `${who} commented: "${n.data?.preview ?? ''}"`, icon: 'chatbubble', to: `/post/${n.target_id}` };
    case 'follow': return { text: `${who} followed you`, icon: 'person-add', to: `/user/${n.actor_id}` };
    case 'friend_request': return { text: `${who} sent you a friend request`, icon: 'people', to: '/friends' };
    case 'friend_accept': return { text: `${who} accepted your friend request`, icon: 'checkmark-circle', to: `/user/${n.actor_id}` };
    case 'message': return { text: `${who}: ${n.data?.has_media && !n.data?.preview ? 'sent a photo' : n.data?.preview ?? 'sent a message'}`, icon: 'chatbubble-ellipses', to: `/chat/${n.target_id}` };
    case 'group_activity': return {
      text: n.data?.kind === 'join_request' ? `${who} asked to join your group` : n.data?.kind === 'approved' ? 'Your request to join a group was approved' : `${who} joined your group`,
      icon: 'people-circle', to: `/group/${n.target_id}` };
    case 'event_reminder': return { text: `Coming up soon: ${n.data?.title ?? 'an event'}`, icon: 'calendar', to: `/event/${n.target_id}` };
    case 'event_activity': return { text: `${who} is going to your event`, icon: 'calendar', to: `/event/${n.target_id}` };
    case 'match': return { text: `You matched with ${who}! Say hi.`, icon: 'heart-circle', to: `/chat/${n.target_id}` };
    case 'moderation': return { text: n.data?.kind === 'content_removed' ? `We removed your content: ${n.data?.reason ?? 'it broke the Community Guidelines'}` : `Moderation notice: ${n.data?.reason ?? n.data?.kind ?? ''}`, icon: 'shield', to: '/legal/guidelines' };
    case 'report_update': return { text: 'A report you sent has been reviewed. Thank you.', icon: 'flag', to: '/settings/reports' };
    default: return { text: 'New activity', icon: 'notifications', to: null };
  }
}

export default function Notifications() {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const uid = useUid();
  const q = useInfiniteQuery({
    queryKey: ['notifications'], queryFn: ({ pageParam }) => getNotifications(pageParam), initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE ? undefined : all.length * PAGE),
  });
  const items = q.data?.pages.flat() ?? [];
  const open = async (n: NotificationItem, to: string | null) => {
    if (!n.read_at) { await markNotificationRead(n.id); qc.invalidateQueries({ queryKey: ['unread-notifications'] }); q.refetch(); }
    if (to) router.push(to as any);
  };
  const readAll = async () => { await markAllNotificationsRead(uid); qc.invalidateQueries({ queryKey: ['unread-notifications'] }); q.refetch(); };

  return (
    <Screen>
      <Header title="Notifications" right={items.some((i) => !i.read_at) ? <Pressable onPress={readAll} accessibilityRole="button"><Text variant="small" tone="primary" bold>Mark all read</Text></Pressable> : undefined} />
      <FlatList data={items} keyExtractor={(n) => n.id} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />}
        onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Empty icon="notifications-outline" title="You're all caught up" body="Likes, comments, friend requests and event reminders show up here." />}
        renderItem={({ item }) => {
          const d = describe(item);
          return (
            <Pressable onPress={() => open(item, d.to)} accessibilityRole="button" accessibilityLabel={`${d.text}${item.read_at ? '' : ', unread'}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: item.read_at ? 0.7 : 1 }}>
              <View>
                <Avatar path={item.actor?.avatar_path} name={item.actor?.display_name ?? '!'} size={48} />
                <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
                  <Ionicons name={d.icon} size={12} color={c.onPrimary} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="small" numberOfLines={3} bold={!item.read_at}>{d.text}</Text>
                <Text variant="caption" tone="muted">{timeAgo(item.created_at)}</Text>
              </View>
              {!item.read_at ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
            </Pressable>
          );
        }} />
    </Screen>
  );
}
