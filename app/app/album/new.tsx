import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Header, Input, Screen, Segmented, Text } from '../../src/components/ui';
import { useToast } from '../../src/components/feedback';
import { createAlbum } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { Picked, pickMedia, uploadMedia } from '../../src/lib/media';
import { errMessage } from '../../src/lib/util';

export default function NewAlbum() {
  const me = useUid(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const [title, setTitle] = useState(''); const [desc, setDesc] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('friends');
  const [photos, setPhotos] = useState<Picked[]>([]); const [busy, setBusy] = useState(false);
  const add = async () => { const items = await pickMedia({ multiple: true, max: 20 }); setPhotos((p) => [...p, ...items].slice(0, 20)); };
  const create = async () => {
    if (!title.trim()) { toast.show('Name your album'); return; }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const p of photos) paths.push(await uploadMedia(me, p));
      const id = await createAlbum(me, { title, description: desc, privacy, paths });
      await qc.invalidateQueries({ queryKey: ['albums'] }); router.replace(`/album/${id}`);
    } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen scroll>
      <Header title="New album" />
      <Input label="Title" value={title} onChangeText={setTitle} maxLength={80} />
      <Input label="Description (optional)" value={desc} onChangeText={setDesc} multiline maxLength={500} />
      <Text variant="small" bold style={{ marginBottom: 8 }}>Who can see this album</Text>
      <Segmented value={privacy} onChange={setPrivacy} options={[{ key: 'public', label: 'Public' }, { key: 'friends', label: 'Friends' }, { key: 'private', label: 'Only me' }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 16 }}>
        {photos.map((p, i) => (
          <Pressable key={p.uri} onPress={() => setPhotos(photos.filter((_, j) => j !== i))} accessibilityLabel="Remove photo" style={{ width: '32%' }}>
            <Image source={{ uri: p.uri }} style={{ aspectRatio: 1, borderRadius: 10 }} contentFit="cover" />
          </Pressable>
        ))}
      </View>
      <Button title={photos.length ? 'Add more photos' : 'Add photos'} icon="images" variant="secondary" onPress={add} />
      <Button title="Create album" onPress={create} loading={busy} style={{ marginTop: 12 }} />
    </Screen>
  );
}
