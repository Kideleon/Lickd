import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Chip, Header, Input, Screen, Text } from '../src/components/ui';
import { MediaView } from '../src/components/MediaView';
import { useToast } from '../src/components/feedback';
import { useAuth } from '../src/lib/auth';
import { updateProfile } from '../src/lib/api';
import { pickMedia, uploadMedia } from '../src/lib/media';
import { INTENTS, INTERESTS } from '../src/lib/types';
import { errMessage } from '../src/lib/util';
import { useTheme } from '../src/theme';

export default function EditProfile() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { c } = useTheme();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar_path ?? null);
  const [cover, setCover] = useState(profile?.cover_path ?? null);
  const [interests, setInterests] = useState(profile?.interests ?? []);
  const [intents, setIntents] = useState(profile?.intents ?? []);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  const toggle = (l: string[], s: (v: string[]) => void, v: string) => s(l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const pick = async (kind: 'avatar' | 'cover') => {
    const [item] = await pickMedia({ square: kind === 'avatar' });
    if (!item) return;
    try { const path = await uploadMedia(profile.id, item, 'avatars'); kind === 'avatar' ? setAvatar(path) : setCover(path); }
    catch (e) { toast.show(errMessage(e)); }
  };
  const save = async () => {
    if (!name.trim()) { toast.show('Add a display name'); return; }
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) { toast.show('Username: 3–24 letters, numbers, _ or .'); return; }
    setBusy(true);
    try {
      await updateProfile(profile.id, {
        display_name: name.trim(), username, bio: bio.trim(), city: city.trim() || null, pronouns: pronouns.trim() || null,
        avatar_path: avatar, cover_path: cover, interests, intents,
      });
      await refreshProfile(); await qc.invalidateQueries({ queryKey: ['profile', profile.id] });
      toast.show('Profile saved'); router.back();
    } catch (e) {
      const m = errMessage(e);
      toast.show(m.includes('profiles_username_key') ? 'That username is taken' : m);
    } finally { setBusy(false); }
  };

  return (
    <Screen scroll>
      <Header title="Edit profile" right={<Button title="Save" small full={false} onPress={save} loading={busy} />} />
      <Pressable onPress={() => pick('cover')} accessibilityRole="button" accessibilityLabel="Change cover photo">
        <MediaView path={cover} bucket="avatars" style={{ height: 130, borderRadius: 18, backgroundColor: c.primary }} />
        <Text variant="caption" bold style={{ position: 'absolute', right: 10, bottom: 8, color: '#fff', backgroundColor: c.overlay, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>Change cover</Text>
      </Pressable>
      <View style={{ alignItems: 'center', marginTop: -40, marginBottom: 14 }}>
        <Avatar path={avatar} name={name} size={92} onPress={() => pick('avatar')} />
        <Text variant="small" tone="primary" bold onPress={() => pick('avatar')} style={{ marginTop: 6 }}>Change photo</Text>
      </View>
      <Input label="Display name" value={name} onChangeText={setName} maxLength={50} />
      <Input label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" maxLength={24} />
      <Input label="Pronouns" value={pronouns} onChangeText={setPronouns} maxLength={30} />
      <Input label="City" value={city} onChangeText={setCity} />
      <Input label="Bio" value={bio} onChangeText={setBio} multiline maxLength={500} />
      <Text variant="small" bold style={{ marginBottom: 8 }}>Interests</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>{INTERESTS.map((i) => <Chip key={i} label={i} selected={interests.includes(i)} onPress={() => toggle(interests, setInterests, i)} />)}</View>
      <Text variant="small" bold style={{ marginBottom: 8 }}>Here for</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{INTENTS.map((i) => <Chip key={i} label={i} selected={intents.includes(i)} onPress={() => toggle(intents, setIntents, i)} />)}</View>
    </Screen>
  );
}
