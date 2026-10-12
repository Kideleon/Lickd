import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorState, Header, IconButton, Loading, OptionSheet, Screen, Text } from '../../src/components/ui';
import { MediaView } from '../../src/components/MediaView';
import { useSafety, useToast } from '../../src/components/feedback';
import { addAlbumMedia, deleteAlbum, deleteAlbumMedia, getAlbum, getAlbumMedia, updateAlbum } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { pickMedia, uploadMedia } from '../../src/lib/media';
import { errMessage } from '../../src/lib/util';
import type { Album } from '../../src/lib/types';

const NEXT: Record<Album['privacy'], Album['privacy']> = { public: 'friends', friends: 'private', private: 'public' };
const LABEL: Record<Album['privacy'], string> = { public: 'Public', friends: 'Friends', private: 'Only me' };

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUid(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const safety = useSafety();
  const [sel, setSel] = useState<{ id: string; path: string } | null>(null); const [busy, setBusy] = useState(false);
  const album = useQuery({ queryKey: ['album', id], queryFn: () => getAlbum(id!) });
  const media = useQuery({ queryKey: ['album-media', id], queryFn: () => getAlbumMedia(id!), enabled: !!album.data });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['album', id] }), qc.invalidateQueries({ queryKey: ['album-media', id] }), qc.invalidateQueries({ queryKey: ['albums'] })]);

  if (album.isLoading) return <Screen><Header /><Loading /></Screen>;
  if (album.isError) return <Screen><Header /><ErrorState error={album.error} onRetry={album.refetch} /></Screen>;
  const a = album.data;
  if (!a) return <Screen><Header /><Empty icon="lock-closed-outline" title="Album not available" body="It may be private or deleted." /></Screen>;
  const mine = a.owner_id === me;

  const add = async () => {
    const items = await pickMedia({ multiple: true, max: 20 });
    if (!items.length) return;
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const it of items) paths.push(await uploadMedia(me, it));
      await addAlbumMedia(a.id, paths, media.data?.length ?? 0);
      if (!a.cover_path) await updateAlbum(a.id, { cover_path: paths[0] });
      await refresh();
    } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Screen scroll>
      <Header title={a.title} right={<IconButton name="ellipsis-horizontal" label="Album options" onPress={() => safety.open({
        type: 'album', id: a.id, userId: a.owner_id, username: 'album owner',
        extra: mine ? [
          { label: `Privacy: ${LABEL[a.privacy]} (tap to change)`, icon: 'eye-outline', onPress: async () => { try { await updateAlbum(a.id, { privacy: NEXT[a.privacy] }); await refresh(); toast.show(`Now ${LABEL[NEXT[a.privacy]].toLowerCase()}`); } catch (e) { toast.show(errMessage(e)); } } },
          { label: 'Delete album', icon: 'trash-outline', destructive: true, onPress: () => Alert.alert('Delete album?', 'The photos in it will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteAlbum(a.id); await qc.invalidateQueries({ queryKey: ['albums'] }); router.back(); } catch (e) { toast.show(errMessage(e)); } } }]) },
        ] : [],
      })} />} />
      {a.description ? <Text tone="muted" style={{ marginBottom: 8 }}>{a.description}</Text> : null}
      <Text variant="caption" tone="muted" style={{ marginBottom: 12 }}>{LABEL[a.privacy]} · {media.data?.length ?? 0} photos</Text>
      {mine ? <Button title="Add photos" icon="add" small full={false} onPress={add} loading={busy} style={{ marginBottom: 14 }} /> : null}
      {media.isLoading ? <Loading /> : (media.data ?? []).length === 0 ? <Empty icon="images-outline" title="No photos yet" /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {media.data!.map((m) => (
            <Pressable key={m.id} style={{ width: '32%' }} onLongPress={() => mine && setSel({ id: m.id, path: m.path })} accessibilityRole="image">
              <MediaView path={m.path} style={{ aspectRatio: 1, borderRadius: 10 }} />
            </Pressable>
          ))}
        </View>
      )}
      <OptionSheet visible={!!sel} onClose={() => setSel(null)} options={sel ? [
        { label: 'Use as cover', icon: 'image-outline', onPress: async () => { try { await updateAlbum(a.id, { cover_path: sel.path }); await refresh(); } catch (e) { toast.show(errMessage(e)); } } },
        { label: 'Delete photo', icon: 'trash-outline', destructive: true, onPress: async () => { try { await deleteAlbumMedia(sel.id); await refresh(); } catch (e) { toast.show(errMessage(e)); } } },
      ] : []} />
    </Screen>
  );
}
