import React from 'react';
import { FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Empty, ErrorState, Header, Loading, Screen } from '../../src/components/ui';
import { PostCard } from '../../src/components/cards';
import { PAGE, getPlacePosts } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';

export default function PlacePage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const me = useUid();
  const q = useInfiniteQuery({
    queryKey: ['place', name], queryFn: ({ pageParam }) => getPlacePosts(decodeURIComponent(name!), me, pageParam), initialPageParam: 0,
    getNextPageParam: (l, a) => (l.length < PAGE ? undefined : a.length * PAGE),
  });
  return (
    <Screen>
      <Header title={decodeURIComponent(name ?? '')} />
      <FlatList data={q.data?.pages.flat() ?? []} keyExtractor={(p) => p.id} renderItem={({ item }) => <PostCard post={item} />}
        onEndReached={() => { if (q.hasNextPage) q.fetchNextPage(); }}
        ListEmptyComponent={q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : <Empty title="No check-ins here yet" />} />
    </Screen>
  );
}
