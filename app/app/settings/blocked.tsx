import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, Header, Loading, Screen } from '../../src/components/ui';
import { PersonRow } from '../../src/components/cards';
import { getBlockedUsers, unblockUser } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { useToast } from '../../src/components/feedback';
import { errMessage } from '../../src/lib/util';

export default function Blocked() {
  const me = useUid(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['blocked'], queryFn: getBlockedUsers });
  return (
    <Screen scroll>
      <Header title="Blocked people" />
      {q.isLoading ? <Loading /> : (q.data ?? []).length === 0 ? <Empty icon="ban-outline" title="No one blocked" body="People you block can't see your profile or message you." /> :
        q.data!.map((p) => <PersonRow key={p.id} person={p} onPress={() => {}} subtitle=""
          right={<Button title="Unblock" small full={false} variant="secondary" onPress={async () => { try { await unblockUser(me, p.id); await qc.invalidateQueries(); } catch (e) { toast.show(errMessage(e)); } }} />} />)}
    </Screen>
  );
}
