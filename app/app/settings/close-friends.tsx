import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Empty, Header, Loading, Screen, ToggleRow } from '../../src/components/ui';
import { Avatar } from '../../src/components/ui';
import { View } from 'react-native';
import { getCloseFriends, getFriends, setCloseFriend } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { useToast } from '../../src/components/feedback';
import { errMessage } from '../../src/lib/util';

export default function CloseFriends() {
  const me = useUid(); const qc = useQueryClient(); const toast = useToast();
  const friends = useQuery({ queryKey: ['friends', me], queryFn: () => getFriends(me) });
  const close = useQuery({ queryKey: ['close-friends'], queryFn: () => getCloseFriends(me) });
  const toggle = async (id: string, on: boolean) => {
    try { await setCloseFriend(me, id, on); await qc.invalidateQueries({ queryKey: ['close-friends'] }); } catch (e) { toast.show(errMessage(e)); }
  };
  return (
    <Screen scroll>
      <Header title="Close friends" />
      {friends.isLoading ? <Loading /> : (friends.data ?? []).length === 0 ? <Empty icon="star-outline" title="Add friends first" body="Close friends are picked from your friends list." /> :
        friends.data!.map((f) => (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar path={f.avatar_path} name={f.display_name} size={44} />
            <View style={{ flex: 1 }}><ToggleRow title={f.display_name} subtitle={`@${f.username}`} value={!!close.data?.includes(f.id)} onChange={(v) => toggle(f.id, v)} /></View>
          </View>
        ))}
    </Screen>
  );
}
