import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Header, Input, Screen, Text } from '../../src/components/ui';
import { DateField } from '../../src/components/DateField';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/lib/supabase';
import { ageFromDate, errMessage, isoDate } from '../../src/lib/util';

export default function SignUp() {
  const router = useRouter();
  const { c } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (!birthdate) { setError('Enter your date of birth.'); return; }
    if (ageFromDate(birthdate) < 18) { setError('You must be 18 or older to join LICKD.'); return; }
    if (!agree) { setError('Please accept the Terms, Privacy Policy and Community Guidelines.'); return; }
    setBusy(true);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { birthdate: isoDate(birthdate), accepted_terms: 'true' } },
    });
    setBusy(false);
    if (e) { setError(errMessage(e)); return; }
    if (!data.session) setCheckEmail(true); // email confirmation is on
  };

  if (checkEmail) {
    return (
      <Screen scroll>
        <Header title="Almost there" />
        <View style={{ paddingTop: 32, gap: 12 }}>
          <Ionicons name="mail-open" size={48} color={c.primary} />
          <Text variant="title">Check your email</Text>
          <Text tone="muted">We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.</Text>
          <Button title="Go to sign in" onPress={() => router.replace('/sign-in')} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  const max = new Date(); max.setFullYear(max.getFullYear() - 18);
  return (
    <Screen scroll>
      <Header title="Create account" />
      <Text variant="title" style={{ marginVertical: 16 }}>Let's get you in</Text>
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" hint="At least 8 characters." />
      <DateField label="Date of birth" value={birthdate} onChange={setBirthdate} maximumDate={new Date()} placeholder="Select your birthday" />
      <Text variant="caption" tone="muted" style={{ marginTop: -8, marginBottom: 16 }}>Your birthday stays private. We only use it to confirm you're 18 or older.</Text>

      <Pressable onPress={() => setAgree(!agree)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: agree ? c.primary : c.line, backgroundColor: agree ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {agree ? <Ionicons name="checkmark" size={18} color={c.onPrimary} /> : null}
        </View>
        <Text variant="small" style={{ flex: 1 }}>
          I'm 18 or older and I agree to the{' '}
          <Text variant="small" tone="primary" bold onPress={() => router.push('/legal/terms')}>Terms</Text>,{' '}
          <Text variant="small" tone="primary" bold onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text> and{' '}
          <Text variant="small" tone="primary" bold onPress={() => router.push('/legal/guidelines')}>Community Guidelines</Text>.
        </Text>
      </Pressable>

      {error ? <Text variant="small" tone="danger" style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
