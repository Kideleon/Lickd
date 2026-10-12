import React, { useState } from 'react';
import * as Linking from 'expo-linking';
import { Button, Header, Input, Screen, Text } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { errMessage } from '../../src/lib/util';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter the email you signed up with.'); return; }
    setBusy(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: Linking.createURL('/reset-password'),
    });
    setBusy(false);
    if (e) setError(errMessage(e)); else setSent(true);
  };

  return (
    <Screen scroll>
      <Header title="Reset password" />
      <Text variant="title" style={{ marginVertical: 16 }}>Get back in</Text>
      {sent ? (
        <Text tone="muted">If an account exists for {email.trim()}, a reset link is on its way. Open it on this phone.</Text>
      ) : (
        <>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
    </Screen>
  );
}
