import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Chip, Empty, Header, IconButton, Input, Loading, Screen, Segmented, Sticker, Text, ToggleRow } from '../src/components/ui';
import { MediaView } from '../src/components/MediaView';
import { useSafety, useToast } from '../src/components/feedback';
import { useAuth } from '../src/lib/auth';
import { datingCandidates, datingSwipe, getMatches, updateProfile } from '../src/lib/api';
import { LOOKING_FOR } from '../src/lib/types';
import { errMessage } from '../src/lib/util';
import { fonts, radius, space, useTheme } from '../src/theme';

type View_ = 'suggested' | 'nearby' | 'new' | 'likes';

export default function Dating() {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const safety = useSafety();
  const [view, setView] = useState<View_>('suggested');
  const [headline, setHeadline] = useState(profile?.dating_headline ?? '');
  const [looking, setLooking] = useState<string[]>(profile?.dating_looking_for ?? []);
  const [match, setMatch] = useState<{ name: string; conv: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const on = !!profile?.dating_enabled;

  const cands = useQuery({ queryKey: ['dating', view], queryFn: () => datingCandidates(view), enabled: on });
  const matches = useQuery({ queryKey: ['matches'], queryFn: getMatches, enabled: on });
  const top = cands.data?.[0];

  const enable = async () => {
    if (!profile) return;
    setBusy(true);
    try { await updateProfile(profile.id, { dating_enabled: true, dating_headline: headline.trim() || null, dating_looking_for: looking }); await refreshProfile(); }
    catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  const disable = async () => {
    if (!profile) return;
    try { await updateProfile(profile.id, { dating_enabled: false }); await refreshProfile(); } catch (e) { toast.show(errMessage(e)); }
  };
  const swipe = async (kind: 'like' | 'pass') => {
    if (!top) return;
    setBusy(true);
    try {
      const r = await datingSwipe(top.id, kind);
      if (r.matched && r.conversation_id) setMatch({ name: top.display_name, conv: r.conversation_id });
      await cands.refetch(); qc.invalidateQueries({ queryKey: ['matches'] });
    } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };

  if (!on) {
    return (
      <Screen scroll>
        <Header title="Dating" />
        <Text variant="title" style={{ marginVertical: 12 }}>Dating is optional</Text>
        <Text tone="muted" style={{ marginBottom: 16 }}>Turn it on to see and be seen by other members who've opted in. Only mutual likes can message each other. You can switch it off any time and your dating profile disappears.</Text>
        <Input label="Your headline" value={headline} onChangeText={setHeadline} maxLength={140} placeholder="A line that sounds like you" />
        <Text variant="small" bold style={{ marginBottom: 8 }}>Looking for</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
          {LOOKING_FOR.map((l) => <Chip key={l} label={l} selected={looking.includes(l)} onPress={() => setLooking(looking.includes(l) ? looking.filter((x) => x !== l) : [...looking, l])} />)}
        </View>
        <Button title="Turn on dating" onPress={enable} loading={busy} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="Dating" right={<IconButton name="settings-outline" label="Dating settings" onPress={() => router.push('/settings/privacy')} />} />
      {matches.data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {matches.data.map((m) => (
            <Pressable key={m.match_id} onPress={() => router.push(`/chat/${m.conversation_id}`)} style={{ alignItems: 'center', marginRight: 12, width: 66 }} accessibilityRole="button" accessibilityLabel={`Message ${m.display_name}`}>
              <Avatar path={m.avatar_path} name={m.display_name} size={58} ring={c.primary} /><Text variant="caption" numberOfLines={1}>{m.display_name.split(' ')[0]}</Text>
            </Pressable>))}
        </ScrollView>
      ) : null}
      <Segmented<View_> value={view} onChange={setView} options={[{ key: 'suggested', label: 'Suggested' }, { key: 'nearby', label: 'Nearby' }, { key: 'new', label: 'New' }, { key: 'likes', label: 'Likes' }]} />

      <View style={{ marginTop: 16 }}>
        {cands.isLoading ? <Loading /> : cands.isError ? <Text tone="danger">{errMessage(cands.error)}</Text> : !top ? (
          <Empty icon="heart-dislike-outline" title={view === 'likes' ? 'No new likes yet' : 'You\'re all caught up'}
            body={view === 'nearby' && !profile?.city ? 'Add your city to see people near you.' : 'Check back soon. New people join every day.'} />
        ) : (
          <Sticker>
            <MediaView path={top.avatar_path} bucket="avatars" style={{ height: 380 }} />
            <View style={{ padding: space.lg, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>{top.display_name}, {top.age}</Text>
                <Pressable hitSlop={10} accessibilityLabel="Report or block" onPress={() => safety.open({ type: 'user', id: top.id, userId: top.id, username: top.username })}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={c.muted} /></Pressable>
              </View>
              <Text variant="small" tone="muted">{[top.pronouns, top.city].filter(Boolean).join(' · ')}</Text>
              {top.liked_me ? <Text variant="small" tone="primary" bold>They liked you</Text> : null}
              {top.headline ? <Text variant="body" bold style={{ marginTop: 4 }}>{top.headline}</Text> : null}
              {top.bio ? <Text variant="small" tone="muted" numberOfLines={3}>{top.bio}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                {[...top.looking_for, ...top.interests.slice(0, 4)].map((t) => <Chip key={t} label={t} />)}
              </View>
              <Pressable onPress={() => router.push(`/user/${top.id}`)} accessibilityRole="link"><Text variant="small" tone="primary" bold>View full profile</Text></Pressable>
            </View>
          </Sticker>
        )}
      </View>

      {top ? (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
          <View style={{ flex: 1 }}><Button title="Pass" icon="close" variant="secondary" onPress={() => swipe('pass')} disabled={busy} /></View>
          <View style={{ flex: 1 }}><Button title="Like" icon="heart" onPress={() => swipe('like')} disabled={busy} /></View>
        </View>
      ) : null}

      <Button title="Turn off dating" variant="ghost" onPress={disable} style={{ marginTop: 24 }} />

      {match ? (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: c.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 } as any}>
          <Card style={{ width: '100%' }}>
            <Text variant="display" style={{ textAlign: 'center' }}>It's a match</Text>
            <Text tone="muted" style={{ textAlign: 'center', marginVertical: 12 }}>You and {match.name} liked each other.</Text>
            <Button title="Say hi" icon="chatbubble" onPress={() => { const m = match; setMatch(null); router.push(`/chat/${m.conv}`); }} />
            <Button title="Keep looking" variant="ghost" onPress={() => setMatch(null)} />
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
