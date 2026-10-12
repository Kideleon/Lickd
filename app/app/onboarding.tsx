import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Chip, Header, Input, Screen, Segmented, Text, Avatar, Wordmark } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { registerProfile, updateProfile, usernameAvailable, trackEvent } from '../src/lib/api';
import { pickMedia, uploadMedia } from '../src/lib/media';
import { INTENTS, INTERESTS } from '../src/lib/types';
import { errMessage } from '../src/lib/util';
import { useTheme } from '../src/theme';
import { useRouter } from 'expo-router';

const STEPS = ['Name', 'You', 'Interests', 'Purpose', 'Safety'];

export default function Onboarding() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const { c } = useTheme();
  const uid = session?.user.id ?? '';
  const [step, setStep] = useState(profile ? 1 : 0);
  const [username, setUsername] = useState(profile?.username ?? '');
  const [display, setDisplay] = useState(profile?.display_name ?? '');
  const [avail, setAvail] = useState<'idle' | 'checking' | 'yes' | 'no'>('idle');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_path ?? null);
  const [city, setCity] = useState(profile?.city ?? '');
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [intents, setIntents] = useState<string[]>(profile?.intents ?? []);
  const [discoverability, setDiscoverability] = useState<'everyone' | 'unlisted' | 'friends'>(profile?.discoverability ?? 'everyone');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (profile || step !== 0) return;
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,24}$/.test(u)) { setAvail('idle'); return; }
    setAvail('checking');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { setAvail((await usernameAvailable(u)) ? 'yes' : 'no'); } catch { setAvail('idle'); }
    }, 400);
  }, [username, step, profile]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const run = async (fn: () => Promise<void>, next?: () => void) => {
    setError(null); setBusy(true);
    try { await fn(); next?.(); } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  };

  const pickAvatar = async () => {
    const [item] = await pickMedia({ square: true });
    if (!item) return;
    await run(async () => { setAvatar(await uploadMedia(uid, item, 'avatars')); });
  };

  const stepContent = () => {
    switch (step) {
      case 0: return (
        <>
          <Text variant="title" style={{ marginBottom: 6 }}>Pick your name</Text>
          <Text tone="muted" style={{ marginBottom: 20 }}>Your username is how people find you. You can change your display name any time.</Text>
          <Input label="Display name" value={display} onChangeText={setDisplay} maxLength={50} />
          <Input label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} maxLength={24}
            hint={avail === 'checking' ? 'Checking…' : avail === 'yes' ? 'Available' : avail === 'no' ? undefined : '3–24 letters, numbers, _ or .'}
            error={avail === 'no' ? 'That username is taken or not allowed.' : null} />
          <Button title="Continue" disabled={avail !== 'yes' || !display.trim()}
            onPress={() => run(() => registerProfile(username.trim(), display.trim()).then(refreshProfile), () => setStep(1))} loading={busy} />
        </>
      );
      case 1: return (
        <>
          <Text variant="title" style={{ marginBottom: 6 }}>Show us you</Text>
          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <Avatar path={avatar} name={display || username} size={112} onPress={pickAvatar} />
            <Pressable onPress={pickAvatar} accessibilityRole="button"><Text tone="primary" bold style={{ marginTop: 10 }}>{avatar ? 'Change photo' : 'Add a photo'}</Text></Pressable>
          </View>
          <Input label="City (optional)" value={city} onChangeText={setCity} placeholder="Atlanta" />
          <Input label="Pronouns (optional)" value={pronouns} onChangeText={setPronouns} placeholder="she/her, they/them…" maxLength={30} />
          <Input label="Bio" value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="A few words about you" />
          <Button title="Continue" onPress={() => run(() => updateProfile(uid, { avatar_path: avatar, city: city.trim() || null, pronouns: pronouns.trim() || null, bio: bio.trim() }), () => setStep(2))} loading={busy} />
        </>
      );
      case 2: return (
        <>
          <Text variant="title" style={{ marginBottom: 6 }}>What are you into?</Text>
          <Text tone="muted" style={{ marginBottom: 16 }}>Pick a few. We use them to suggest people, groups and events.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {INTERESTS.map((i) => <Chip key={i} label={i} selected={interests.includes(i)} onPress={() => toggle(interests, setInterests, i)} />)}
          </View>
          <Button title="Continue" style={{ marginTop: 16 }} onPress={() => run(() => updateProfile(uid, { interests }), () => setStep(3))} loading={busy} />
        </>
      );
      case 3: return (
        <>
          <Text variant="title" style={{ marginBottom: 6 }}>What are you here for?</Text>
          <Text tone="muted" style={{ marginBottom: 16 }}>Choose any. Dating is optional and off unless you turn it on.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
            {INTENTS.map((i) => <Chip key={i} label={i} selected={intents.includes(i)} onPress={() => toggle(intents, setIntents, i)} />)}
          </View>
          <Text variant="small" bold style={{ marginBottom: 8 }}>Who can find you in Discover?</Text>
          <Segmented value={discoverability} onChange={setDiscoverability}
            options={[{ key: 'everyone', label: 'Everyone' }, { key: 'friends', label: 'Friends' }, { key: 'unlisted', label: 'Link only' }]} />
          <Text variant="caption" tone="muted" style={{ marginTop: 8, marginBottom: 16 }}>
            {discoverability === 'everyone' ? 'Anyone on LICKD can find your profile.'
              : discoverability === 'friends' ? 'Only your friends can see your profile.'
              : 'You stay out of search, but people with your link can still visit.'}
          </Text>
          <Button title="Continue" onPress={() => run(() => updateProfile(uid, { intents, discoverability, dating_enabled: false }), () => setStep(4))} loading={busy} />
        </>
      );
      default: return (
        <>
          <Text variant="title" style={{ marginBottom: 6 }}>House rules</Text>
          <Text tone="muted" style={{ marginBottom: 12 }}>LICKD works because people look out for each other.</Text>
          {['Be kind. No harassment, hate or bullying.', 'Respect consent. No unwanted sexual content.', 'Be real. No impersonation, scams or spam.', 'You are always in control: block, mute and report are one tap away.'].map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <Ionicons name="checkmark-circle" size={20} color={c.teal} /><Text variant="small" style={{ flex: 1 }}>{t}</Text>
            </View>
          ))}
          <Text variant="small" tone="primary" bold onPress={() => router.push('/legal/guidelines')} style={{ marginVertical: 8 }}>Read the full Community Guidelines</Text>
          <Pressable onPress={() => setAck(!ack)} accessibilityRole="checkbox" accessibilityState={{ checked: ack }} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginVertical: 12 }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: ack ? c.primary : c.line, backgroundColor: ack ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {ack ? <Ionicons name="checkmark" size={18} color={c.onPrimary} /> : null}
            </View>
            <Text style={{ flex: 1 }}>I'll follow the Community Guidelines.</Text>
          </Pressable>
          <Button title="Finish and go to Home" disabled={!ack}
            onPress={() => run(async () => { await updateProfile(uid, { onboarded: true }); trackEvent('onboarding_complete'); await refreshProfile(); })} loading={busy} />
        </>
      );
    }
  };

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
        <Wordmark size={26} />
        <Pressable onPress={signOut} accessibilityRole="button"><Text variant="small" tone="muted">Sign out</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? c.primary : c.line }} />)}
      </View>
      <Text variant="caption" tone="muted" style={{ marginBottom: 20 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</Text>
      {stepContent()}
      {error ? <Text variant="small" tone="danger" style={{ marginTop: 12 }} accessibilityLiveRegion="polite">{error}</Text> : null}
      {step > 1 ? <Pressable onPress={() => setStep(step - 1)} style={{ paddingVertical: 16 }} accessibilityRole="button"><Text tone="muted" style={{ textAlign: 'center' }}>Back</Text></Pressable> : null}
    </Screen>
  );
}
