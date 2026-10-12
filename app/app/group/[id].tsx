import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorState, Header, IconButton, Loading, OptionSheet, Screen, TabStrip, Text } from '../../src/components/ui';
import { MediaView } from '../../src/components/MediaView';
import { EventCard, PersonRow, PostCard } from '../../src/components/cards';
import { useSafety, useToast } from '../../src/components/feedback';
import {
  PAGE, deleteGroup, getGroup, getGroupEvents, getGroupMembers, getGroupPosts, getMyGroupStatus, joinGroup, leaveGroup,
  removeMember, setMemberRole, setMemberStatus,
} from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { errMessage } from '../../src/lib/util';
import { radius, space } from '../../src/theme';
import type { GroupMember } from '../../src/lib/types';

type Tab = 'feed' | 'members' | 'events';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUid(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const safety = useSafety();
  const [tab, setTab] = useState<Tab>('feed');
  const [target, setTarget] = useState<GroupMember | null>(null);
  const [busy, setBusy] = useState(false);

  const group = useQuery({ queryKey: ['group', id], queryFn: () => getGroup(id!) });
  const mine = useQuery({ queryKey: ['group-me', id], queryFn: () => getMyGroupStatus(id!, me) });
  const member = mine.data?.status === 'active';
  const isMod = member && (mine.data?.role === 'owner' || mine.data?.role === 'moderator');
  const isOwner = member && mine.data?.role === 'owner';
  const canRead = member || group.data?.privacy === 'public';

  const posts = useInfiniteQuery({
    queryKey: ['group-posts', id], queryFn: ({ pageParam }) => getGroupPosts(id!, me, pageParam), initialPageParam: 0,
    getNextPageParam: (l, a) => (l.length < PAGE ? undefined : a.length * PAGE), enabled: !!group.data && canRead,
  });
  const members = useQuery({ queryKey: ['group-members', id], queryFn: () => getGroupMembers(id!), enabled: tab === 'members' && !!group.data });
  const events = useQuery({ queryKey: ['group-events', id], queryFn: () => getGroupEvents(id!), enabled: tab === 'events' && !!group.data && canRead });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['group', id] }), qc.invalidateQueries({ queryKey: ['group-me', id] }), qc.invalidateQueries({ queryKey: ['group-members', id] }), qc.invalidateQueries({ queryKey: ['my-groups'] }), qc.invalidateQueries({ queryKey: ['group-posts', id] })]);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await refresh(); } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); } };

  if (group.isLoading) return <Screen><Header /><Loading /></Screen>;
  if (group.isError) return <Screen><Header /><ErrorState error={group.error} onRetry={group.refetch} /></Screen>;
  const g = group.data;
  if (!g) return <Screen><Header /><Empty icon="eye-off-outline" title="Group not found" /></Screen>;

  const pending = (members.data ?? []).filter((m) => m.status === 'pending');
  const active = (members.data ?? []).filter((m) => m.status === 'active');

  const memberOptions = target ? [
    ...(isOwner && target.role === 'member' ? [{ label: 'Make moderator', icon: 'shield-outline' as const, onPress: () => act(() => setMemberRole(id!, target.user_id, 'moderator')) }] : []),
    ...(isOwner && target.role === 'moderator' ? [{ label: 'Remove as moderator', icon: 'shield-outline' as const, onPress: () => act(() => setMemberRole(id!, target.user_id, 'member')) }] : []),
    { label: 'Remove from group', icon: 'person-remove-outline' as const, destructive: true, onPress: () => act(() => removeMember(id!, target.user_id)) },
    { label: 'Ban from group', icon: 'ban-outline' as const, destructive: true, onPress: () => act(() => setMemberStatus(id!, target.user_id, 'banned')) },
  ] : [];

  return (
    <Screen scroll padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Header title={g.name} right={<IconButton name="ellipsis-horizontal" label="Group options" onPress={() => safety.open({
          type: 'group', id: g.id, userId: g.owner_id ?? '', username: g.name,
          extra: isOwner ? [{ label: 'Delete group', icon: 'trash-outline', destructive: true, onPress: () => Alert.alert('Delete this group?', 'Posts and events in the group are deleted too.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => act(async () => { await deleteGroup(g.id); router.back(); }) }]) }] : [],
        })} />} />
        <MediaView path={g.cover_path} bucket="avatars" style={{ height: 140, borderRadius: radius.lg }} />
        <Text variant="title" style={{ marginTop: 12 }}>{g.name}</Text>
        <Text variant="small" tone="teal" bold>{g.member_count} member{g.member_count === 1 ? '' : 's'} · {g.privacy === 'private' ? 'Private group' : 'Public group'}</Text>
        {g.description ? <Text tone="muted" style={{ marginTop: 8 }}>{g.description}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {member ? (<>
            <Button title="Post" icon="create" small full={false} onPress={() => router.push(`/compose?groupId=${g.id}`)} />
            {!isOwner ? <Button title="Leave" variant="secondary" small full={false} onPress={() => act(() => leaveGroup(g.id, me))} /> : null}
            <Button title="New event" icon="calendar" variant="secondary" small full={false} onPress={() => router.push(`/event/new?groupId=${g.id}`)} />
          </>) : mine.data?.status === 'pending' ? <Button title="Request sent" variant="secondary" small full={false} onPress={() => act(() => leaveGroup(g.id, me))} />
            : mine.data?.status === 'banned' ? <Text tone="danger" variant="small">You can't join this group.</Text>
            : <Button title={g.privacy === 'private' ? 'Request to join' : 'Join group'} small full={false} loading={busy} onPress={() => act(() => joinGroup(g.id, me))} />}
        </View>
      </View>

      <View style={{ marginTop: space.lg }}>
        <TabStrip value={tab} onChange={setTab} tabs={[{ key: 'feed', label: 'Discussion' }, { key: 'members', label: 'Members' }, { key: 'events', label: 'Events' }]} />
      </View>

      <View style={{ padding: space.lg }}>
        {!canRead ? <Empty icon="lock-closed-outline" title="This group is private" body="Request to join to see posts and events." /> : tab === 'feed' ? (
          posts.isLoading ? <Loading /> : (posts.data?.pages.flat() ?? []).length === 0 ? <Empty icon="chatbubbles-outline" title="No discussions yet" body={member ? 'Start the first one.' : undefined} />
            : <>{posts.data!.pages.flat().map((p) => <PostCard key={p.id} post={p} />)}{posts.hasNextPage ? <Button title="Load more" variant="secondary" onPress={() => posts.fetchNextPage()} /> : null}</>
        ) : tab === 'members' ? (
          members.isLoading ? <Loading /> : (<>
            {isMod && pending.length ? (<>
              <Text variant="h2" style={{ marginBottom: 6 }}>Requests to join</Text>
              {pending.map((m) => m.profile ? <PersonRow key={m.user_id} person={{ ...m.profile, city: null }} right={<View style={{ flexDirection: 'row', gap: 6 }}>
                <Button title="Approve" small full={false} onPress={() => act(() => setMemberStatus(id!, m.user_id, 'active'))} />
                <Button title="Decline" small full={false} variant="secondary" onPress={() => act(() => removeMember(id!, m.user_id))} /></View>} /> : null)}
            </>) : null}
            <Text variant="h2" style={{ marginVertical: 6 }}>Members</Text>
            {active.map((m) => m.profile ? <PersonRow key={m.user_id} person={{ ...m.profile, city: null }} subtitle={m.role === 'member' ? '' : m.role}
              right={isMod && m.role !== 'owner' && m.user_id !== me ? <IconButton name="ellipsis-horizontal" label="Member options" onPress={() => setTarget(m)} /> : undefined} /> : null)}
          </>)
        ) : (
          events.isLoading ? <Loading /> : (events.data ?? []).length === 0 ? <Empty icon="calendar-outline" title="No upcoming events" /> : events.data!.map((e) => <EventCard key={e.id} event={e} />)
        )}
      </View>
      <OptionSheet visible={!!target} title={target?.profile?.display_name} options={memberOptions} onClose={() => setTarget(null)} />
    </Screen>
  );
}
