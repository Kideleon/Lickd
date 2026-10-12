import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Screen, Text, Wordmark } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { createAppeal, getMyAppeals, reactivateAccount } from '../src/lib/api';
import { errMessage } from '../src/lib/util';
import { useToast } from '../src/components/feedback';

/** Shown when an account is suspended, banned or deactivated. */
export default function AccountStatus() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const uid = session?.user.id ?? '';
  const qc = useQueryClient();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const appeals = useQuery({ queryKey: ['my-appeals'], queryFn: () => getMyAppeals(uid), enabled: !!uid });
  const status = profile?.status;

  const reactivate = async () => {
    setBusy(true);
    try { await reactivateAccount(); await refreshProfile(); } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  const appeal = async () => {
    setBusy(true);
    try { await createAppeal(uid, msg); setMsg(''); await qc.invalidateQueries({ queryKey: ['my-appeals'] }); toast.show('Appeal sent'); }
    catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  const pending = appeals.data?.some((a) => a.status === 'pending');

  return (
    <Screen scroll>
      <View style={{ paddingVertical: 20 }}><Wordmark size={30} /></View>
      {status === 'deactivated' ? (
        <>
          <Text variant="title">Your account is deactivated</Text>
          <Text tone="muted" style={{ marginVertical: 12 }}>Your profile is hidden. Reactivate to bring it back exactly as you left it.</Text>
          <Button title="Reactivate my account" onPress={reactivate} loading={busy} />
        </>
      ) : (
        <>
          <Text variant="title">{status === 'banned' ? 'Your account has been banned' : 'Your account is suspended'}</Text>
          <Text tone="muted" style={{ marginVertical: 12 }}>
            {status === 'banned' ? 'This happened because of a serious or repeated Community Guidelines violation.'
              : `You can't post or message right now.${profile?.suspended_until ? ` Your suspension ends ${new Date(profile.suspended_until).toLocaleString()}.` : ''}`}
            {' '}If you think this was a mistake, send an appeal and a moderator will review it.
          </Text>
          {(appeals.data ?? []).map((a) => (
            <Card key={a.id} style={{ marginBottom: 12 }}>
              <Text variant="small" bold>Appeal · {a.status}</Text>
              <Text variant="small" tone="muted">{a.message}</Text>
              {a.response ? <Text variant="small" style={{ marginTop: 6 }}>Moderator: {a.response}</Text> : null}
            </Card>
          ))}
          {!pending ? (
            <>
              <Input label="Tell us what happened" value={msg} onChangeText={setMsg} multiline maxLength={2000} />
              <Button title="Send appeal" onPress={appeal} loading={busy} disabled={msg.trim().length < 10} />
            </>
          ) : <Text tone="muted">Your appeal is waiting for review.</Text>}
          <Button title="Check my status" variant="secondary" onPress={refreshProfile} style={{ marginTop: 12 }} />
        </>
      )}
      <Button title="Sign out" variant="ghost" onPress={signOut} style={{ marginTop: 12 }} />
    </Screen>
  );
}
