import React from 'react';
import { FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Empty, ErrorState, Header, Loading, Screen } from '../../src/components/ui';
import { PostCard } from '../../src/components/cards';
import { PAGE, getTagPosts } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';

export default function TagPage() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const me = useUid();
  const q = useInfiniteQuery({
    queryKey: ['tag', tag], queryFn: ({ pageParam }) => getTagPosts(tag!, me, pageParam), initialPageParam: 0,
    getNextPageParam: (l, a) => (l.length < PAGE ? undefined : a.length * PAGE),
  });
  return (
    <Screen>
      <Header title={`#${tag}`} />
      <FlatList data={q.data?.pages.flat() ?? []} keyExtractor={(p) => p.id} renderItem={({ item }) => <PostCard post={item} />}
        onEndReached={() => { if (q.hasNextPage) q.fetchNextPage(); }}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : <Empty title="No posts with this tag yet" />} />
    </Screen>
  );
}
