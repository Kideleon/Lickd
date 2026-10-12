import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, Header, Loading, Screen, Segmented, Text } from '../src/components/ui';
import { PersonRow } from '../src/components/cards';
import { useToast } from '../src/components/feedback';
import { getFriendRequests, getFriends, removeFriend, respondFriendRequest } from '../src/lib/api';
import { useUid } from '../src/lib/auth';
import { errMessage } from '../src/lib/util';

export default function Friends() {
  const me = useUid();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'requests' | 'friends'>('requests');
  const reqs = useQuery({ queryKey: ['friend-requests'], queryFn: getFriendRequests });
  const list = useQuery({ queryKey: ['friends', me], queryFn: () => getFriends(me) });

  const respond = async (id: string, accept: boolean) => {
    try { await respondFriendRequest(id, accept); await qc.invalidateQueries(); } catch (e) { toast.show(errMessage(e)); }
  };
  return (
    <Screen scroll>
      <Header title="Friends" />
      <Segmented value={tab} onChange={setTab} options={[{ key: 'requests', label: 'Requests', badge: reqs.data?.length || undefined }, { key: 'friends', label: `Friends${list.data ? ` (${list.data.length})` : ''}` }]} />
      <View style={{ height: 12 }} />
      {tab === 'requests' ? (
        reqs.isLoading ? <Loading /> : (reqs.data ?? []).length === 0 ? <Empty icon="person-add-outline" title="No pending requests" body="When someone asks to be your friend, you'll see it here." /> :
          reqs.data!.map((r) => (
            <PersonRow key={r.id} person={{ id: r.requester_id, username: r.username, display_name: r.display_name, avatar_path: r.avatar_path, city: null, mutual_count: r.mutual_count }}
              right={<View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Accept" small full={false} onPress={() => respond(r.id, true)} />
                <Button title="Decline" small full={false} variant="secondary" onPress={() => respond(r.id, false)} />
              </View>} />
          ))
      ) : list.isLoading ? <Loading /> : (list.data ?? []).length === 0 ? <Empty icon="people-outline" title="No friends yet" body="Find people in Discover and send a request." /> :
        list.data!.map((f) => <PersonRow key={f.id} person={f}
          right={<Button title="Remove" small full={false} variant="ghost" onPress={async () => { try { await removeFriend(f.id); await qc.invalidateQueries(); } catch (e) { toast.show(errMessage(e)); } }} />} />)}
    </Screen>
  );
}
