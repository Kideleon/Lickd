import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, Header, Loading, Screen } from '../../src/components/ui';
import { PersonRow } from '../../src/components/cards';
import { getMutedUsers, unmuteUser } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { useToast } from '../../src/components/feedback';
import { errMessage } from '../../src/lib/util';

export default function Muted() {
  const me = useUid(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['muted'], queryFn: () => getMutedUsers(me) });
  return (
    <Screen scroll>
      <Header title="Muted people" />
      {q.isLoading ? <Loading /> : (q.data ?? []).length === 0 ? <Empty icon="volume-mute-outline" title="No one muted" body="Muted people's posts and stories are hidden from your feeds. They aren't told." /> :
        q.data!.map((p) => <PersonRow key={p.id} person={p}
          right={<Button title="Unmute" small full={false} variant="secondary" onPress={async () => { try { await unmuteUser(me, p.id); await qc.invalidateQueries(); } catch (e) { toast.show(errMessage(e)); } }} />} />)}
    </Screen>
  );
}
