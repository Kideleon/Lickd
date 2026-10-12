import React, { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Button, Header, Input, Screen, Text } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { errMessage } from '../../src/lib/util';

/** Opened from the emailed recovery link; signs the user in just long enough to set a new password. */
export default function ResetPassword() {
  const router = useRouter();
  const url = Linking.useURL();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) { setReady(true); return; }
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code;
        if (typeof code === 'string') {
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) setError(e.message); else setReady(true);
          return;
        }
        const frag = url.split('#')[1];
        if (frag) {
          const p = new URLSearchParams(frag);
          const access_token = p.get('access_token'); const refresh_token = p.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
            if (e) setError(e.message); else setReady(true);
          }
        }
      } catch (e) { setError(errMessage(e)); }
    })();
  }, [url]);

  const save = async () => {
    setError(null);
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) setError(e.message); else router.replace('/');
  };

  return (
    <Screen scroll>
      <Header title="New password" back={false} />
      {ready ? (
        <>
          <Text variant="title" style={{ marginVertical: 16 }}>Choose a new password</Text>
          <Input label="New password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" error={error} />
          <Button title="Save password" onPress={save} loading={busy} />
        </>
      ) : (
        <Text tone="muted" style={{ marginTop: 24 }}>{error ?? 'Open the reset link from your email on this phone to continue.'}</Text>
      )}
    </Screen>
  );
}
