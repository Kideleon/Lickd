import React, { useState } from 'react';
import { Dimensions, Pressable, ScrollView, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { fonts, radius, space, useTheme } from '../theme';
import { Avatar, Sticker, Text } from './ui';
import { MediaView } from './MediaView';
import { useSafety, useToast } from './feedback';
import { useUid } from '../lib/auth';
import { deletePost, toggleReaction } from '../lib/api';
import { errMessage, formatEventDate, timeAgo } from '../lib/util';
import type { EventItem, Group, PersonCard, Post } from '../lib/types';

const W = Dimensions.get('window').width;

/** Text with tappable #hashtags. */
export function RichText({ text }: { text: string }) {
  const router = useRouter();
  const parts = text.split(/(#[A-Za-z0-9_]{2,30})/g);
  return (
    <Text variant="body">
      {parts.map((p, i) => p.startsWith('#') && p.length > 2 ? (
        <Text key={i} tone="primary" bold onPress={() => router.push(`/tag/${p.slice(1).toLowerCase()}`)}>{p}</Text>
      ) : p)}
    </Text>
  );
}

export function PostCard({ post, detail }: { post: Post; detail?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const me = useUid();
  const qc = useQueryClient();
  const safety = useSafety();
  const toast = useToast();
  const [reaction, setReaction] = useState(post.my_reaction);
  const [likes, setLikes] = useState(post.like_count);
  const [page, setPage] = useState(0);
  const mediaW = Math.min(W, 560) - space.lg * 2 - 8;

  const like = async () => {
    const prev = reaction; const prevLikes = likes;
    setReaction(prev ? null : 'like'); setLikes(prev ? Math.max(0, likes - 1) : likes + 1);
    try { await toggleReaction(me, 'post', post.id, prev, 'like'); }
    catch (e) { setReaction(prev); setLikes(prevLikes); toast.show(errMessage(e)); }
  };
  const share = () => Share.share({ message: `${post.display_name} on LICKD: ${post.body.slice(0, 120)}\nlickd://post/${post.id}` }).catch(() => {});
  const open = () => { if (!detail) router.push(`/post/${post.id}`); };
  const more = () => safety.open({
    type: 'post', id: post.id, userId: post.author_id, username: post.username,
    extra: post.author_id === me ? [{
      label: 'Delete post', icon: 'trash-outline', destructive: true,
      onPress: async () => { try { await deletePost(post.id); await qc.invalidateQueries(); toast.show('Post deleted'); if (detail) router.back(); } catch (e) { toast.show(errMessage(e)); } },
    }] : [],
  });

  return (
    <Sticker style={{ marginBottom: space.lg }}>
      <View style={{ padding: space.md, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar path={post.avatar_path} name={post.display_name} size={42} onPress={() => router.push(`/user/${post.author_id}`)} />
          <Pressable style={{ flex: 1 }} onPress={() => router.push(`/user/${post.author_id}`)} accessibilityRole="link">
            <Text variant="body" bold numberOfLines={1}>{post.display_name}</Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              @{post.username} · {timeAgo(post.created_at)}
              {post.audience === 'friends' ? ' · friends' : ''}
            </Text>
          </Pressable>
          <Pressable onPress={more} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
          </Pressable>
        </View>

        {post.group_name || post.location ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {post.group_name ? (
              <Pressable onPress={() => post.group_id && router.push(`/group/${post.group_id}`)} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Ionicons name="people" size={14} color={c.teal} /><Text variant="caption" tone="teal" bold>{post.group_name}</Text>
              </Pressable>
            ) : null}
            {post.location ? (
              <Pressable onPress={() => router.push(`/place/${encodeURIComponent(post.location!)}`)} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <Ionicons name="location" size={14} color={c.primary} /><Text variant="caption" tone="primary" bold>{post.location}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {post.body ? <Pressable onPress={open}><RichText text={post.body} /></Pressable> : null}

        {post.media_paths.length > 0 ? (
          <View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / mediaW))}>
              {post.media_paths.map((p, i) => (
                <Pressable key={p} onPress={open} style={{ width: mediaW }}>
                  <MediaView path={p} type={post.media_types[i]} style={{ width: mediaW, height: mediaW * 1.1, borderRadius: radius.md }} />
                </Pressable>
              ))}
            </ScrollView>
            {post.media_paths.length > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                {post.media_paths.map((p, i) => (
                  <View key={p} style={{ width: i === page ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? c.primary : c.line }} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, paddingTop: 2 }}>
          <Pressable onPress={like} hitSlop={8} accessibilityRole="button" accessibilityLabel={reaction ? 'Unlike' : 'Like'}
            accessibilityState={{ selected: !!reaction }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={reaction ? 'heart' : 'heart-outline'} size={24} color={reaction ? c.primary : c.text} />
            <Text variant="small" bold>{likes}</Text>
          </Pressable>
          <Pressable onPress={open} hitSlop={8} accessibilityRole="button" accessibilityLabel="Comments" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-outline" size={22} color={c.text} />
            <Text variant="small" bold>{post.comment_count}</Text>
          </Pressable>
          <Pressable onPress={share} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share">
            <Ionicons name="paper-plane-outline" size={22} color={c.text} />
          </Pressable>
        </View>
      </View>
    </Sticker>
  );
}

export function PersonRow({ person, right, onPress, subtitle }: {
  person: PersonCard; right?: React.ReactNode; onPress?: () => void; subtitle?: string;
}) {
  const router = useRouter();
  const sub = subtitle ?? [person.pronouns, person.city].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress ?? (() => router.push(`/user/${person.id}`))} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Avatar path={person.avatar_path} name={person.display_name} size={50} />
      <View style={{ flex: 1 }}>
        <Text variant="body" bold numberOfLines={1}>{person.display_name}</Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>@{person.username}{sub ? ` · ${sub}` : ''}</Text>
        {person.mutual_count ? <Text variant="caption" tone="teal">{person.mutual_count} mutual friend{person.mutual_count > 1 ? 's' : ''}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function PersonTile({ person }: { person: PersonCard }) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/user/${person.id}`)} accessibilityRole="button" style={{ width: 112, alignItems: 'center', marginRight: 14 }}>
      <Avatar path={person.avatar_path} name={person.display_name} size={84} />
      <Text variant="small" bold numberOfLines={1} style={{ marginTop: 8 }}>{person.display_name}</Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>{person.city ?? `@${person.username}`}</Text>
    </Pressable>
  );
}

export function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/group/${group.id}`)} accessibilityRole="button" style={{ marginBottom: space.md }}>
      <Sticker>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.md }}>
          <MediaView path={group.cover_path} bucket="avatars" style={{ width: 62, height: 62, borderRadius: 20 }} />
          <View style={{ flex: 1 }}>
            <Text variant="body" bold numberOfLines={1}>{group.name}</Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>{group.description || 'No description yet'}</Text>
            <Text variant="caption" tone="teal" bold style={{ marginTop: 2 }}>
              {group.member_count} member{group.member_count === 1 ? '' : 's'}{group.privacy === 'private' ? ' · private' : ''}
            </Text>
          </View>
          {group.my_status === 'active' ? <Ionicons name="checkmark-circle" size={22} color={c.success} />
            : group.my_status === 'pending' ? <Text variant="caption" tone="muted">Requested</Text> : null}
        </View>
      </Sticker>
    </Pressable>
  );
}

export function EventCard({ event }: { event: EventItem }) {
  const router = useRouter();
  const { c } = useTheme();
  const d = new Date(event.starts_at);
  return (
    <Pressable onPress={() => router.push(`/event/${event.id}`)} accessibilityRole="button" style={{ marginBottom: space.md }}>
      <Sticker>
        <View style={{ flexDirection: 'row', gap: 12, padding: space.md, alignItems: 'center' }}>
          <View style={{ width: 62, alignItems: 'center', backgroundColor: c.primary, borderRadius: 16, paddingVertical: 8 }}>
            <Text variant="caption" style={{ color: c.onPrimary, fontFamily: fonts.bold }}>{d.toLocaleDateString(undefined, { month: 'short' })}</Text>
            <Text style={{ color: c.onPrimary, fontFamily: fonts.heavy, fontSize: 26, lineHeight: 28 }}>{d.getDate()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" bold numberOfLines={2}>{event.title}</Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>{formatEventDate(event.starts_at)}</Text>
            {event.location ? <Text variant="caption" tone="muted" numberOfLines={1}>{event.location}</Text> : null}
            <Text variant="caption" tone="teal" bold>{event.going_count} going · {event.interested_count} interested</Text>
          </View>
        </View>
      </Sticker>
    </Pressable>
  );
}
