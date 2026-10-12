import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Header, Input, Screen, Text } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';
import { errMessage } from '../../src/lib/util';

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (e) setError(e.message === 'Invalid login credentials' ? 'That email and password don\'t match.' : errMessage(e));
  };

  return (
    <Screen scroll>
      <Header title="Sign in" />
      <Text variant="title" style={{ marginVertical: 16 }}>Welcome back</Text>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
        keyboardType="email-address" textContentType="emailAddress" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
        textContentType="password" error={error} onSubmitEditing={submit} />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Pressable onPress={() => router.push('/forgot')} style={{ paddingVertical: 18 }} accessibilityRole="link">
        <Text tone="primary" bold style={{ textAlign: 'center' }}>Forgot your password?</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/sign-up')} accessibilityRole="link">
        <Text tone="muted" style={{ textAlign: 'center' }}>New here? <Text tone="primary" bold>Create an account</Text></Text>
      </Pressable>
    </Screen>
  );
}
