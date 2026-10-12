import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Header, Input, Screen, Segmented, Text } from '../../src/components/ui';
import { MediaView } from '../../src/components/MediaView';
import { useToast } from '../../src/components/feedback';
import { createGroup } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { pickMedia, uploadMedia } from '../../src/lib/media';
import { errMessage } from '../../src/lib/util';
import { useTheme } from '../../src/theme';

export default function NewGroup() {
  const me = useUid(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const { c } = useTheme();
  const [name, setName] = useState(''); const [desc, setDesc] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async () => { const [it] = await pickMedia(); if (it) { try { setCover(await uploadMedia(me, it, 'avatars')); } catch (e) { toast.show(errMessage(e)); } } };
  const create = async () => {
    if (name.trim().length < 3) { toast.show('Give your group a name (3+ characters)'); return; }
    setBusy(true);
    try { const id = await createGroup(me, { name, description: desc, privacy, coverPath: cover }); await qc.invalidateQueries(); router.replace(`/group/${id}`); }
    catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen scroll>
      <Header title="New group" />
      <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="Choose cover image" style={{ marginBottom: 16 }}>
        <MediaView path={cover} bucket="avatars" style={{ height: 150, borderRadius: 18, backgroundColor: c.surface2 }} />
        <Text variant="small" tone="primary" bold style={{ marginTop: 6 }}>{cover ? 'Change cover' : 'Add a cover image'}</Text>
      </Pressable>
      <Input label="Group name" value={name} onChangeText={setName} maxLength={60} />
      <Input label="What's it about?" value={desc} onChangeText={setDesc} multiline maxLength={1000} />
      <Text variant="small" bold style={{ marginBottom: 8 }}>Privacy</Text>
      <Segmented value={privacy} onChange={setPrivacy} options={[{ key: 'public', label: 'Public' }, { key: 'private', label: 'Private' }]} />
      <Text variant="caption" tone="muted" style={{ marginTop: 8, marginBottom: 20 }}>
        {privacy === 'public' ? 'Anyone can join and read the posts.' : 'People ask to join and you approve them. Only members read the posts.'}
      </Text>
      <Button title="Create group" onPress={create} loading={busy} />
    </Screen>
  );
}
