import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Chip, Header, Input, Screen, Text } from '../src/components/ui';
import { useToast } from '../src/components/feedback';
import { createStory } from '../src/lib/api';
import { useUid } from '../src/lib/auth';
import { Picked, captureMedia, pickMedia, uploadMedia } from '../src/lib/media';
import { errMessage } from '../src/lib/util';
import { useTheme } from '../src/theme';
import type { StoryAudience } from '../src/lib/types';

export default function CreateStory() {
  const me = useUid(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const { c } = useTheme();
  const [item, setItem] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<StoryAudience>('everyone');
  const [busy, setBusy] = useState(false);
  const post = async () => {
    if (!item) return;
    setBusy(true);
    try {
      const path = await uploadMedia(me, item);
      await createStory(me, { path, type: item.type, caption, audience });
      await qc.invalidateQueries({ queryKey: ['story-tray'] }); toast.show('Story shared. It disappears in 24 hours.'); router.back();
    } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Screen scroll>
      <Header title="New story" />
      {item ? (
        <View style={{ height: 420, borderRadius: 22, overflow: 'hidden', backgroundColor: c.surface2, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
          {item.type === 'image' ? <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text tone="muted">Video ready</Text>}
        </View>
      ) : (
        <View style={{ gap: 12, marginVertical: 20 }}>
          <Button title="Take a photo or video" icon="camera" onPress={async () => { const [x] = await captureMedia(true); if (x) setItem(x); }} />
          <Button title="Choose from library" icon="images" variant="secondary" onPress={async () => { const [x] = await pickMedia({ video: true }); if (x) setItem(x); }} />
        </View>
      )}
      {item ? (<>
        <Input label="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={200} />
        <Text variant="small" bold style={{ marginBottom: 8 }}>Who can see it</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip label="Everyone" selected={audience === 'everyone'} onPress={() => setAudience('everyone')} />
          <Chip label="Friends" selected={audience === 'friends'} onPress={() => setAudience('friends')} />
          <Chip label="Close friends" icon="star" selected={audience === 'close_friends'} onPress={() => setAudience('close_friends')} />
        </View>
        <Button title="Share story" onPress={post} loading={busy} style={{ marginTop: 12 }} />
        <Button title="Choose a different one" variant="ghost" onPress={() => setItem(null)} />
      </>) : null}
    </Screen>
  );
}
