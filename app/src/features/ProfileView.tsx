import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Chip, Empty, ErrorState, Header, IconButton, Loading, OptionSheet, Screen, Sticker, TabStrip, Text } from '../components/ui';
import { MediaView } from '../components/MediaView';
import { PersonRow, PostCard } from '../components/cards';
import { useSafety, useToast } from '../components/feedback';
import { useUid } from '../lib/auth';
import {
  PAGE, followUser, getAlbums, getFriends, getProfileSummary, getUserPosts, openConversation, removeFriend,
  respondFriendRequest, sendFriendRequest, unfollowUser, unmuteUser,
} from '../lib/api';
import { errMessage } from '../lib/util';
import { PROFILE_FONTS, fonts, radius, space, useTheme } from '../theme';
import type { ProfileSummary } from '../lib/types';

type Tab = 'posts' | 'photos' | 'friends' | 'about';

export function ProfileView({ userId, isTab }: { userId: string; isTab?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { c: base, isDark, toggle } = useTheme();
  const me = useUid();
  const safety = useSafety();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('posts');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const isSelf = userId === me;

  const prof = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfileSummary(userId), enabled: !!userId });
  const posts = useInfiniteQuery({
    queryKey: ['user-posts', userId], queryFn: ({ pageParam }) => getUserPosts(userId, me, pageParam), initialPageParam: 0,
    getNextPageParam: (l, a) => (l.length < PAGE ? undefined : a.length * PAGE), enabled: !!prof.data,
  });
  const albums = useQuery({ queryKey: ['albums', userId], queryFn: () => getAlbums(userId), enabled: tab === 'photos' && !!prof.data });
  const friends = useQuery({ queryKey: ['friends', userId], queryFn: () => getFriends(userId), enabled: tab === 'friends' && !!prof.data });

  if (prof.isLoading) return <Screen><Loading /></Screen>;
  if (prof.isError) return <Screen><Header back={!isTab} /><ErrorState error={prof.error} onRetry={prof.refetch} /></Screen>;
  const p = prof.data as ProfileSummary | null;
  if (!p) return <Screen><Header back={!isTab} /><Empty icon="eye-off-outline" title="Profile not available" body="This person may have left, or you can't view this profile." /></Screen>;

  const cu = p.customization;
  const accent = cu?.accent_color ?? base.primary;
  const pageBg = cu?.background_color ?? base.bg;
  const fam = PROFILE_FONTS[cu?.font ?? 'default'];
  // Text color flips if the member picked a light page background.
  const light = /^#(?:[ef][0-9a-f]){3}$/i.test(pageBg) || pageBg.toLowerCase() === '#fff4e0';
  const ink = light ? '#141B28' : '#F6EDE6';
  const sub = light ? '#4B566A' : '#B3A096';
  const layout = cu?.layout ?? 'classic';

  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['profile', userId] }); await qc.invalidateQueries({ queryKey: ['friend-requests'] }); };
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await refresh(); } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };

  const friendButton = () => {
    if (isSelf || !p.can_friend && p.relationship === 'none') return null;
    switch (p.relationship) {
      case 'friends': return <Button title="Friends" icon="checkmark" variant="secondary" small full={false} onPress={() => setSheet(true)} />;
      case 'request_sent': return <Button title="Requested" variant="secondary" small full={false} onPress={() => act(() => removeFriend(userId))} />;
      case 'request_received': return <Button title="Accept request" small full={false} onPress={() => act(() => respondFriendRequest(p.friendship_id!, true))} />;
      default: return <Button title="Add friend" icon="person-add" small full={false} onPress={() => act(() => sendFriendRequest(userId))} />;
    }
  };
  const message = () => act(async () => { const id = await openConversation(userId); router.push(`/chat/${id}`); });
  const menu = () => safety.open({ type: 'user', id: userId, userId, username: p.username });

  const top8 = p.top8.length > 0 || isSelf ? (
    <View style={{ marginTop: space.lg }}>
      <Text variant="h2" style={{ color: ink, fontFamily: fam ?? fonts.semibold }}>{isSelf ? 'My Top 8' : `${p.display_name.split(' ')[0]}'s Top 8`}</Text>
      {p.top8.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 12 }}>
          {p.top8.map((t) => (
            <Pressable key={t.id} onPress={() => router.push(`/user/${t.id}`)} style={{ width: '22%', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={`Top ${t.position}: ${t.display_name}`}>
              <Avatar path={t.avatar_path} name={t.display_name} size={64} ring={t.position <= 3 ? accent : undefined} />
              <Text variant="caption" numberOfLines={1} style={{ color: ink, marginTop: 4 }}>{t.display_name.split(' ')[0]}</Text>
            </Pressable>
          ))}
        </View>
      ) : <Text variant="small" style={{ color: sub, marginTop: 6 }}>Pick your favorite friends in Customize.</Text>}
    </View>
  ) : null;

  const music = cu?.music_title ? (
    <Pressable onPress={() => cu.music_url && Linking.openURL(cu.music_url).catch(() => {})} disabled={!cu.music_url} accessibilityRole="button"
      style={{ marginTop: space.lg }}>
      <Sticker fill={isDark || !light ? base.surface : '#fff'} border={accent} shadow={accent} r={radius.md} offset={3}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="musical-notes" size={24} color="#111" /></View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" tone="muted">On repeat</Text>
            <Text variant="body" bold numberOfLines={1} style={{ color: light ? '#141B28' : base.text }}>{cu.music_title}</Text>
            {cu.music_artist ? <Text variant="small" tone="muted" numberOfLines={1}>{cu.music_artist}</Text> : null}
          </View>
          {cu.music_url ? <Ionicons name="play-circle" size={32} color={accent} /> : null}
        </View>
      </Sticker>
    </Pressable>
  ) : null;

  const featured = cu?.featured_paths?.length ? (
    <View style={{ marginTop: space.lg }}>
      <Text variant="h2" style={{ color: ink, fontFamily: fam ?? fonts.semibold, marginBottom: 10 }}>Featured</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {cu.featured_paths.map((fp) => <MediaView key={fp} path={fp} style={{ width: 140, height: 180, borderRadius: radius.md, marginRight: 10 }} />)}
      </ScrollView>
    </View>
  ) : null;

  const allPosts = posts.data?.pages.flat() ?? [];
  const photoPosts = allPosts.flatMap((x) => x.media_paths.map((m, i) => ({ path: m, type: x.media_types[i], id: x.id }))).filter((m) => m.type === 'image');

  return (
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      {cu?.background_path ? <View style={{ position: 'absolute', inset: 0, opacity: 0.22 } as any}><MediaView path={cu.background_path} style={{ flex: 1 }} /></View> : null}
      <Screen scroll padded={false} edges={isTab ? ['top'] : ['top']} style={{ backgroundColor: 'transparent' }}>
        {layout !== 'compact' ? (
          <View>
            <MediaView path={p.cover_path} bucket="avatars" style={{ height: 150, backgroundColor: accent }} />
            {!isTab ? <View style={{ position: 'absolute', top: 6, left: 6 }}><IconButton name="chevron-back" label="Go back" color="#fff" onPress={() => router.back()} /></View> : null}
          </View>
        ) : <View style={{ paddingHorizontal: 8 }}>{!isTab ? <Header /> : <View style={{ height: 8 }} />}</View>}

        <View style={{ paddingHorizontal: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: layout === 'compact' ? 0 : -42 }}>
            <Avatar path={p.avatar_path} name={p.display_name} size={92} ring={accent} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isSelf ? (<>
                <IconButton name={isDark ? 'sunny-outline' : 'moon-outline'} label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} color={ink} onPress={toggle} />
                <IconButton name="settings-outline" label="Settings" color={ink} onPress={() => router.push('/settings')} />
              </>) : <IconButton name="ellipsis-horizontal" label="More options" color={ink} onPress={menu} />}
            </View>
          </View>

          <Text style={{ fontFamily: fam ?? fonts.heavy, fontSize: 28, lineHeight: 32, color: ink, marginTop: 10 }} accessibilityRole="header">{p.display_name}</Text>
          <Text variant="small" style={{ color: sub }}>@{p.username}{p.pronouns ? ` · ${p.pronouns}` : ''}{p.city ? ` · ${p.city}` : ''}</Text>
          {p.bio ? <Text style={{ color: ink, marginTop: 10, fontFamily: fam }}>{p.bio}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 22, marginTop: 14 }}>
            {[[p.friend_count, 'friends'], [p.follower_count, 'followers'], [p.following_count, 'following']].map(([n, l]) => (
              <Text key={l as string} variant="small" style={{ color: sub }}><Text variant="body" bold style={{ color: ink }}>{n as number}</Text> {l as string}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
            {isSelf ? (<>
              <Button title="Edit profile" small full={false} onPress={() => router.push('/edit-profile')} />
              <Button title="Customize" icon="color-palette" variant="secondary" small full={false} onPress={() => router.push('/customize')} />
              <Button title="Friends" icon="people" variant="secondary" small full={false} onPress={() => router.push('/friends')} />
            </>) : (<>
              {friendButton()}
              <Button title={p.following ? 'Following' : 'Follow'} variant="secondary" small full={false} disabled={busy || (!p.can_friend && !p.following)}
                onPress={() => act(() => (p.following ? unfollowUser(me, userId) : followUser(me, userId)))} />
              {p.can_message ? <Button title="Message" icon="chatbubble" variant="secondary" small full={false} onPress={message} /> : null}
              {p.muted ? <Button title="Unmute" variant="ghost" small full={false} onPress={() => act(() => unmuteUser(me, userId))} /> : null}
            </>)}
          </View>

          {layout === 'showcase' ? <>{featured}{top8}{music}</> : <>{top8}{music}{featured}</>}
        </View>

        <View style={{ marginTop: space.xl }}>
          <TabStrip value={tab} onChange={setTab} tabs={[{ key: 'posts', label: 'Posts' }, { key: 'photos', label: 'Photos' }, { key: 'friends', label: 'Friends' }, { key: 'about', label: 'About' }]} />
        </View>

        <View style={{ padding: space.lg }}>
          {tab === 'posts' ? (
            posts.isLoading ? <Loading /> : allPosts.length === 0 ? (
              <Empty icon="document-text-outline" title={isSelf ? 'Share your first post' : 'No posts yet'} body={isSelf ? 'Say hi to your new community.' : undefined}
                action={isSelf ? 'Write a post' : undefined} onAction={() => router.push('/compose')} />
            ) : (<>
              {allPosts.map((x) => <PostCard key={x.id} post={x} />)}
              {posts.hasNextPage ? <Button title="Load more" variant="secondary" loading={posts.isFetchingNextPage} onPress={() => posts.fetchNextPage()} /> : null}
            </>)
          ) : tab === 'photos' ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text variant="h2" style={{ color: ink }}>Albums</Text>
                {isSelf ? <Button title="New album" icon="add" small full={false} onPress={() => router.push('/album/new')} /> : null}
              </View>
              {albums.isLoading ? <Loading /> : (albums.data ?? []).length === 0 ? <Text variant="small" style={{ color: sub }}>{isSelf ? 'Group your photos into albums and choose who sees each one.' : 'No albums to show.'}</Text> : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {albums.data!.map((a) => (
                    <Pressable key={a.id} style={{ width: '47%' }} onPress={() => router.push(`/album/${a.id}`)} accessibilityRole="button" accessibilityLabel={`Album ${a.title}`}>
                      <MediaView path={a.cover_path} style={{ height: 150, borderRadius: radius.md }} />
                      <Text variant="small" bold numberOfLines={1} style={{ color: ink, marginTop: 6 }}>{a.title}</Text>
                      <Text variant="caption" style={{ color: sub }}>{a.privacy === 'public' ? 'Public' : a.privacy === 'friends' ? 'Friends' : 'Only me'}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {photoPosts.length ? <Text variant="h2" style={{ color: ink, marginTop: 20, marginBottom: 10 }}>From posts</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {photoPosts.map((m) => <Pressable key={m.path} onPress={() => router.push(`/post/${m.id}`)} style={{ width: '32%' }}><MediaView path={m.path} style={{ aspectRatio: 1, borderRadius: 10 }} /></Pressable>)}
              </View>
            </View>
          ) : tab === 'friends' ? (
            friends.isLoading ? <Loading /> : (friends.data ?? []).length === 0 ? <Empty icon="people-outline" title="No friends to show yet" /> :
              friends.data!.map((f) => <PersonRow key={f.id} person={f} />)
          ) : (
            <View style={{ gap: 14 }}>
              {p.interests.length ? <View><Text variant="h2" style={{ color: ink, marginBottom: 8 }}>Into</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{p.interests.map((i) => <Chip key={i} label={i} />)}</View></View> : null}
              {p.intents.length ? <View><Text variant="h2" style={{ color: ink, marginBottom: 8 }}>Here for</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{p.intents.map((i) => <Chip key={i} label={i} />)}</View></View> : null}
              <Text variant="small" style={{ color: sub }}>Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
            </View>
          )}
        </View>
      </Screen>

      <OptionSheet visible={sheet} onClose={() => setSheet(false)} title={p.display_name}
        options={[{ label: 'Unfriend', icon: 'person-remove-outline', destructive: true, onPress: () => act(() => removeFriend(userId)) }]} />
    </View>
  );
}
