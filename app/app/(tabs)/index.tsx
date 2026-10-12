import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Avatar, Empty, ErrorState, IconButton, Loading, Screen, Segmented, Sticker, Text, Wordmark } from '../../src/components/ui';
import { PostCard } from '../../src/components/cards';
import { StoryTray } from '../../src/features/StoryTray';
import { useTheme, space } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { PAGE, getFeed, unreadNotificationCount } from '../../src/lib/api';

type Tab = 'for_you' | 'following' | 'trending';

export default function Home() {
  const router = useRouter();
  const { c, isDark, toggle } = useTheme();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('for_you');

  const feed = useInfiniteQuery({
    queryKey: ['feed', tab],
    queryFn: ({ pageParam }) => getFeed(tab, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PAGE ? undefined : all.length * PAGE),
  });
  const unread = useQuery({ queryKey: ['unread-notifications'], queryFn: () => unreadNotificationCount(profile!.id), enabled: !!profile });
  const posts = feed.data?.pages.flat() ?? [];
  const refresh = useCallback(() => feed.refetch(), [feed]);

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 8 }}>
        <Wordmark size={32} />
        <View style={{ flexDirection: 'row' }}>
          <IconButton name={isDark ? 'sunny-outline' : 'moon-outline'} label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggle} />
          <IconButton name="notifications-outline" label="Notifications" badge={unread.data} onPress={() => router.push('/notifications')} />
        </View>
      </View>

      <StoryTray />

      <Pressable onPress={() => router.push('/compose')} accessibilityRole="button" accessibilityLabel="Create a post" style={{ marginBottom: space.lg }}>
        <Sticker>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.md }}>
            <Avatar path={profile?.avatar_path} name={profile?.display_name} size={44} />
            <Text tone="muted" style={{ flex: 1 }}>What's happening, {profile?.display_name.split(' ')[0]}?</Text>
            <Ionicons name="image-outline" size={22} color={c.teal} />
            <Ionicons name="location-outline" size={22} color={c.primary} />
          </View>
        </Sticker>
      </Pressable>

      <View style={{ marginBottom: space.lg }}>
        <Segmented value={tab} onChange={setTab} options={[
          { key: 'for_you', label: 'For you' }, { key: 'following', label: 'Following' }, { key: 'trending', label: 'Trending' }]} />
      </View>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={feed.isLoading ? <Loading /> : feed.isError ? <ErrorState error={feed.error} onRetry={refresh} /> : (
          <Empty icon="chatbubbles-outline"
            title={tab === 'following' ? 'Nothing from your people yet' : 'No posts yet'}
            body={tab === 'following' ? 'Follow people or add friends and their posts will land here.' : 'Be the first to post, or check out Discover to find your people.'}
            action={tab === 'following' ? 'Find people' : 'Write a post'}
            onAction={() => router.push(tab === 'following' ? '/discover' : '/compose')} />
        )}
        onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage(); }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : <View style={{ height: 24 }} />}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={refresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
