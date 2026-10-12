import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Chip, Header, Input, Screen, Segmented, Text } from '../src/components/ui';
import { PostCard } from '../src/components/cards';
import { useAuth } from '../src/lib/auth';
import { createPost, getMyGroups, trackEvent } from '../src/lib/api';
import { Picked, captureMedia, pickMedia, uploadMedia } from '../src/lib/media';
import { errMessage } from '../src/lib/util';
import { useTheme } from '../src/theme';
import type { Post } from '../src/lib/types';

type Aud = 'public' | 'friends' | 'group';

export default function Compose() {
  const { groupId, checkin } = useLocalSearchParams<{ groupId?: string; checkin?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { profile } = useAuth();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<Picked[]>([]);
  const [location, setLocation] = useState('');
  const [showLoc, setShowLoc] = useState(checkin === '1');
  const [audience, setAudience] = useState<Aud>(groupId ? 'group' : 'public');
  const [group, setGroup] = useState<string | null>(groupId ?? null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = useQuery({ queryKey: ['my-groups'], queryFn: () => getMyGroups(profile!.id), enabled: !!profile });

  useEffect(() => { if (audience === 'group' && !group && groups.data?.length) setGroup(groups.data[0].id); }, [audience, group, groups.data]);

  const add = async (fn: () => Promise<Picked[]>) => {
    const items = await fn();
    setMedia((m) => [...m, ...items].slice(0, 10));
  };
  const canPost = (body.trim().length > 0 || media.length > 0) && (audience !== 'group' || !!group);

  const publish = async () => {
    if (!profile) return;
    setBusy(true); setError(null);
    try {
      const paths: string[] = [];
      for (const m of media) paths.push(await uploadMedia(profile.id, m));
      await createPost({
        uid: profile.id, body, mediaPaths: paths, mediaTypes: media.map((m) => m.type),
        audience, groupId: audience === 'group' ? group : null, location: showLoc ? location : null,
      });
      trackEvent('post_created', { media: media.length, audience });
      await qc.invalidateQueries({ queryKey: ['feed'] });
      await qc.invalidateQueries({ queryKey: ['user-posts'] });
      await qc.invalidateQueries({ queryKey: ['group-posts'] });
      setDone(true);
    } catch (e) { setError(errMessage(e)); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Ionicons name="checkmark-circle" size={72} color={c.success} />
          <Text variant="title">Posted</Text>
          <Text tone="muted" style={{ textAlign: 'center' }}>Your post is live{audience === 'friends' ? ' for your friends' : audience === 'group' ? ' in your group' : ''}.</Text>
          <Button title="Back to Home" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </Screen>
    );
  }

  if (preview && profile) {
    const draft: Post = {
      id: 'preview', author_id: profile.id, username: profile.username, display_name: profile.display_name, avatar_path: profile.avatar_path,
      body, media_paths: media.map((m) => m.uri), media_types: media.map((m) => m.type), audience, group_id: group, group_name: null,
      location: showLoc && location ? location : null, like_count: 0, comment_count: 0, my_reaction: null, created_at: new Date().toISOString(),
    };
    return (
      <Screen scroll>
        <Header title="Preview" back={false} right={<Pressable onPress={() => setPreview(false)}><Text tone="primary" bold>Edit</Text></Pressable>} />
        <View pointerEvents="none"><PreviewCard post={draft} /></View>
        {error ? <Text tone="danger" variant="small" style={{ marginBottom: 8 }}>{error}</Text> : null}
        <Button title="Post it" onPress={publish} loading={busy} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="New post" right={<Button title="Preview" small full={false} disabled={!canPost} onPress={() => setPreview(true)} />} />
      <Input value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="Say something. Use #hashtags to be found." autoFocus style={{ minHeight: 130, fontSize: 18 }} />

      {media.length > 0 ? (
        <ScrollView horizontal style={{ marginBottom: 16 }} showsHorizontalScrollIndicator={false}>
          {media.map((m, i) => (
            <View key={m.uri} style={{ marginRight: 10 }}>
              <MediaViewLocal item={m} />
              <Pressable onPress={() => setMedia(media.filter((_, j) => j !== i))} accessibilityLabel="Remove" hitSlop={8}
                style={{ position: 'absolute', top: 6, right: 6, backgroundColor: c.overlay, borderRadius: 14, padding: 3 }}>
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip icon="image-outline" label="Photo / video" onPress={() => add(() => pickMedia({ video: true, multiple: true, max: 10 - media.length }))} />
        <Chip icon="camera-outline" label="Camera" onPress={() => add(() => captureMedia(true))} />
        <Chip icon="location-outline" label="Check in" selected={showLoc} onPress={() => setShowLoc(!showLoc)} />
      </View>
      {showLoc ? <Input value={location} onChangeText={setLocation} placeholder="Where are you?" maxLength={120} /> : null}

      <Text variant="small" bold style={{ marginBottom: 8, marginTop: 4 }}>Who can see this?</Text>
      <Segmented value={audience} onChange={(a) => setAudience(a)}
        options={[{ key: 'public', label: 'Public' }, { key: 'friends', label: 'Friends' }, ...(groups.data?.length ? [{ key: 'group' as const, label: 'Group' }] : [])]} />
      {audience === 'group' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          {(groups.data ?? []).map((g) => <Chip key={g.id} label={g.name} selected={group === g.id} onPress={() => setGroup(g.id)} />)}
        </View>
      ) : null}
      {error ? <Text tone="danger" variant="small" style={{ marginTop: 12 }}>{error}</Text> : null}
    </Screen>
  );
}

function MediaViewLocal({ item }: { item: Picked }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 120, height: 120, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      {item.type === 'image' ? <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        : <Ionicons name="videocam" size={34} color={c.muted} />}
    </View>
  );
}

/** Preview uses local URIs, so render the card body without hitting storage. */
function PreviewCard({ post }: { post: Post }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="body" bold>{post.display_name} <Text tone="muted" variant="small">@{post.username} · now</Text></Text>
      {post.location ? <Text variant="caption" tone="primary" bold>{post.location}</Text> : null}
      {post.body ? <Text style={{ marginVertical: 8 }}>{post.body}</Text> : null}
      <ScrollView horizontal>
        {post.media_paths.map((u, i) => post.media_types[i] === 'image'
          ? <Image key={u} source={{ uri: u }} style={{ width: 260, height: 300, borderRadius: 14, marginRight: 8 }} contentFit="cover" />
          : <View key={u} style={{ width: 260, height: 300, borderRadius: 14, backgroundColor: c.surface2, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="videocam" size={40} color={c.muted} /></View>)}
      </ScrollView>
      <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
        Visible to {post.audience === 'public' ? 'everyone' : post.audience === 'friends' ? 'your friends' : 'your group'}
      </Text>
    </View>
  );
}
