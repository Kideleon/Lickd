import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Header, Input, Screen, Segmented, Text } from '../../src/components/ui';
import { DateField } from '../../src/components/DateField';
import { MediaView } from '../../src/components/MediaView';
import { useToast } from '../../src/components/feedback';
import { createEvent } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { pickMedia, uploadMedia } from '../../src/lib/media';
import { errMessage } from '../../src/lib/util';
import { useTheme } from '../../src/theme';

export default function NewEvent() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { profile } = useAuth(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const { c } = useTheme();
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');
  const [starts, setStarts] = useState<Date | null>(null); const [ends, setEnds] = useState<Date | null>(null);
  const [location, setLocation] = useState(''); const [city, setCity] = useState(profile?.city ?? '');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [cover, setCover] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const pick = async () => { const [it] = await pickMedia(); if (it && profile) { try { setCover(await uploadMedia(profile.id, it, 'avatars')); } catch (e) { toast.show(errMessage(e)); } } };
  const create = async () => {
    if (!profile) return;
    if (title.trim().length < 3) { toast.show('Add an event title'); return; }
    if (!starts) { toast.show('Choose when it starts'); return; }
    if (starts.getTime() < Date.now() - 60_000) { toast.show('Start time is in the past'); return; }
    if (ends && ends < starts) { toast.show('End time is before the start'); return; }
    setBusy(true);
    try {
      const id = await createEvent(profile.id, { title, description: desc, startsAt: starts, endsAt: ends, location, city, privacy, groupId: groupId ?? null, coverPath: cover });
      await qc.invalidateQueries(); router.replace(`/event/${id}`);
    } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen scroll>
      <Header title="New event" />
      <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="Choose event image" style={{ marginBottom: 16 }}>
        <MediaView path={cover} bucket="avatars" style={{ height: 150, borderRadius: 18, backgroundColor: c.surface2 }} />
        <Text variant="small" tone="primary" bold style={{ marginTop: 6 }}>{cover ? 'Change image' : 'Add an image'}</Text>
      </Pressable>
      <Input label="Title" value={title} onChangeText={setTitle} maxLength={100} />
      <DateField label="Starts" mode="datetime" value={starts} onChange={setStarts} minimumDate={new Date()} />
      <DateField label="Ends (optional)" mode="datetime" value={ends} onChange={setEnds} minimumDate={starts ?? new Date()} />
      <Input label="Where" value={location} onChangeText={setLocation} placeholder="Venue or address" maxLength={200} />
      <Input label="City" value={city} onChangeText={setCity} />
      <Input label="Details" value={desc} onChangeText={setDesc} multiline maxLength={2000} />
      <Text variant="small" bold style={{ marginBottom: 8 }}>Who can see it</Text>
      <Segmented value={privacy} onChange={setPrivacy} options={[{ key: 'public', label: 'Public' }, { key: 'private', label: 'Friends and invited' }]} />
      <Button title="Create event" onPress={create} loading={busy} style={{ marginTop: 24 }} />
    </Screen>
  );
}
