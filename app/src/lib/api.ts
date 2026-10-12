import { supabase } from './supabase';
import type {
  Album, AlbumMedia, Comment, Conversation, Customization, DatingCandidate, EventItem, FriendRequest, Group,
  GroupMember, MatchItem, Message, MyReport, NotificationItem, PersonCard, Post, Profile, ProfileSummary,
  ReportTarget, Story, StoryAudience, StoryTrayItem,
} from './types';

type Res<T> = { data: T | null; error: { message: string; code?: string } | null };

/** Throws a plain Error carrying the server's (already user-friendly) message. */
function unwrap<T>(res: Res<T>): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
function check(res: { error: { message: string } | null }): void {
  if (res.error) throw new Error(res.error.message);
}

export const PAGE = 20;

// ───────────── account & profile ─────────────

export async function getMyProfile(uid: string): Promise<Profile | null> {
  const res = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  return unwrap<Profile | null>(res as Res<Profile | null>);
}

export async function usernameAvailable(username: string): Promise<boolean> {
  const res = await supabase.rpc('username_available', { p_username: username });
  return unwrap<boolean>(res as Res<boolean>);
}

export async function registerProfile(username: string, displayName: string): Promise<void> {
  check(await supabase.rpc('register_profile', { p_username: username, p_display_name: displayName }));
}

export async function touchActive(): Promise<string | null> {
  const res = await supabase.rpc('touch_active');
  return res.error ? null : (res.data as string | null);
}

export async function updateProfile(uid: string, patch: Partial<Profile>): Promise<void> {
  check(await supabase.from('profiles').update(patch).eq('id', uid));
}

export async function getProfileSummary(id: string): Promise<ProfileSummary | null> {
  const res = await supabase.rpc('get_profile_summary', { p_user: id });
  return unwrap<ProfileSummary | null>(res as Res<ProfileSummary | null>);
}

export async function saveCustomization(uid: string, patch: Partial<Customization>): Promise<void> {
  check(await supabase.from('profile_customizations')
    .upsert({ ...patch, user_id: uid, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
}

export async function setTop8(uid: string, friendIds: string[]): Promise<void> {
  check(await supabase.from('top8').delete().eq('user_id', uid));
  if (friendIds.length) {
    check(await supabase.from('top8').insert(friendIds.slice(0, 8).map((f, i) => ({
      user_id: uid, position: i + 1, friend_id: f,
    }))));
  }
}

export async function savePushToken(uid: string, token: string | null): Promise<void> {
  await supabase.from('profile_private').update({ push_token: token }).eq('user_id', uid);
}

export async function deactivateAccount(): Promise<void> { check(await supabase.rpc('deactivate_my_account')); }
export async function reactivateAccount(): Promise<void> { check(await supabase.rpc('reactivate_my_account')); }
export async function deleteAccount(): Promise<void> { check(await supabase.rpc('delete_my_account')); }

export async function trackEvent(name: string, props: Record<string, unknown> = {}): Promise<void> {
  try { await supabase.rpc('track_event', { p_name: name, p_props: props }); } catch { /* analytics must never break the app */ }
}

// ───────────── feed, posts, comments, reactions ─────────────

const POST_SELECT = '*, author:profiles!author_id(username,display_name,avatar_path), group:groups!group_id(name)';

async function withReactions(rows: any[], uid: string | undefined): Promise<Post[]> {
  let mine = new Map<string, string>();
  if (uid && rows.length) {
    const res = await supabase.from('reactions').select('target_id,reaction')
      .eq('user_id', uid).eq('target_type', 'post').in('target_id', rows.map((r) => r.id));
    for (const r of (res.data ?? []) as { target_id: string; reaction: string }[]) mine.set(r.target_id, r.reaction);
  }
  return rows.map((r) => ({
    id: r.id, author_id: r.author_id,
    username: r.author?.username ?? 'unknown', display_name: r.author?.display_name ?? 'Unknown',
    avatar_path: r.author?.avatar_path ?? null,
    body: r.body, media_paths: r.media_paths ?? [], media_types: r.media_types ?? [],
    audience: r.audience, group_id: r.group_id, group_name: r.group?.name ?? null, location: r.location,
    like_count: r.like_count, comment_count: r.comment_count, my_reaction: mine.get(r.id) ?? null,
    created_at: r.created_at,
  }));
}

export async function getFeed(tab: 'for_you' | 'following' | 'trending', offset: number): Promise<Post[]> {
  const res = await supabase.rpc('get_feed', { p_tab: tab, p_limit: PAGE, p_offset: offset });
  return unwrap<Post[]>(res as Res<Post[]>) ?? [];
}

export async function getUserPosts(userId: string, uid: string, offset: number): Promise<Post[]> {
  const res = await supabase.from('posts').select(POST_SELECT).eq('author_id', userId).is('group_id', null)
    .is('removed_at', null).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
  return withReactions(unwrap<any[]>(res as Res<any[]>) ?? [], uid);
}

export async function getGroupPosts(groupId: string, uid: string, offset: number): Promise<Post[]> {
  const res = await supabase.from('posts').select(POST_SELECT).eq('group_id', groupId)
    .is('removed_at', null).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
  return withReactions(unwrap<any[]>(res as Res<any[]>) ?? [], uid);
}

export async function getPlacePosts(location: string, uid: string, offset: number): Promise<Post[]> {
  const res = await supabase.from('posts').select(POST_SELECT).eq('location', location).eq('audience', 'public')
    .is('removed_at', null).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
  return withReactions(unwrap<any[]>(res as Res<any[]>) ?? [], uid);
}

export async function getTagPosts(tag: string, uid: string, offset: number): Promise<Post[]> {
  const res = await supabase.from('posts').select(POST_SELECT).eq('audience', 'public').ilike('body', `%#${tag}%`)
    .is('removed_at', null).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
  return withReactions(unwrap<any[]>(res as Res<any[]>) ?? [], uid);
}

export async function getPost(id: string, uid: string): Promise<Post | null> {
  const res = await supabase.from('posts').select(POST_SELECT).eq('id', id).is('removed_at', null).maybeSingle();
  const row = unwrap<any | null>(res as Res<any | null>);
  if (!row) return null;
  return (await withReactions([row], uid))[0];
}

export async function createPost(input: {
  uid: string; body: string; mediaPaths: string[]; mediaTypes: string[];
  audience: 'public' | 'friends' | 'group'; groupId?: string | null; location?: string | null;
}): Promise<string> {
  const res = await supabase.from('posts').insert({
    author_id: input.uid, body: input.body.trim(), media_paths: input.mediaPaths, media_types: input.mediaTypes,
    audience: input.audience, group_id: input.audience === 'group' ? input.groupId : null,
    location: input.location?.trim() || null,
  }).select('id').single();
  return unwrap<{ id: string }>(res as Res<{ id: string }>).id;
}

export async function deletePost(id: string): Promise<void> { check(await supabase.from('posts').delete().eq('id', id)); }

/** Adds or removes a reaction. Returns the new reaction (or null when removed). */
export async function toggleReaction(
  uid: string, targetType: 'post' | 'comment' | 'message', targetId: string, current: string | null, reaction = 'like',
): Promise<string | null> {
  if (current && current === reaction) {
    check(await supabase.from('reactions').delete().eq('user_id', uid).eq('target_type', targetType).eq('target_id', targetId));
    return null;
  }
  if (current) {
    check(await supabase.from('reactions').update({ reaction }).eq('user_id', uid).eq('target_type', targetType).eq('target_id', targetId));
    return reaction;
  }
  check(await supabase.from('reactions').insert({ user_id: uid, target_type: targetType, target_id: targetId, reaction }));
  return reaction;
}

export async function getComments(postId: string): Promise<Comment[]> {
  const res = await supabase.from('comments')
    .select('id,post_id,author_id,body,created_at,author:profiles!author_id(username,display_name,avatar_path)')
    .eq('post_id', postId).is('removed_at', null).order('created_at', { ascending: true }).limit(200);
  return (unwrap<any[]>(res as Res<any[]>) ?? []) as Comment[];
}

export async function addComment(postId: string, uid: string, body: string): Promise<void> {
  check(await supabase.from('comments').insert({ post_id: postId, author_id: uid, body: body.trim() }));
}
export async function deleteComment(id: string): Promise<void> { check(await supabase.from('comments').delete().eq('id', id)); }

// ───────────── social graph ─────────────

export async function sendFriendRequest(target: string): Promise<string> {
  return unwrap<string>(await supabase.rpc('send_friend_request', { p_target: target }) as Res<string>);
}
export async function respondFriendRequest(id: string, accept: boolean): Promise<void> {
  check(await supabase.rpc('respond_friend_request', { p_id: id, p_accept: accept }));
}
export async function removeFriend(userId: string): Promise<void> { check(await supabase.rpc('remove_friend', { p_user: userId })); }
export async function getFriends(userId: string): Promise<PersonCard[]> {
  return unwrap<PersonCard[]>(await supabase.rpc('get_friends', { p_user: userId, p_limit: 200, p_offset: 0 }) as Res<PersonCard[]>) ?? [];
}
export async function getFriendRequests(): Promise<FriendRequest[]> {
  return unwrap<FriendRequest[]>(await supabase.rpc('get_friend_requests') as Res<FriendRequest[]>) ?? [];
}
export async function followUser(uid: string, target: string): Promise<void> {
  check(await supabase.from('follows').insert({ follower_id: uid, following_id: target }));
}
export async function unfollowUser(uid: string, target: string): Promise<void> {
  check(await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', target));
}
export async function blockUser(uid: string, target: string): Promise<void> {
  check(await supabase.from('blocks').insert({ blocker_id: uid, blocked_id: target }));
}
export async function unblockUser(uid: string, target: string): Promise<void> {
  check(await supabase.from('blocks').delete().eq('blocker_id', uid).eq('blocked_id', target));
}
export async function muteUser(uid: string, target: string): Promise<void> {
  check(await supabase.from('mutes').insert({ muter_id: uid, muted_id: target }));
}
export async function unmuteUser(uid: string, target: string): Promise<void> {
  check(await supabase.from('mutes').delete().eq('muter_id', uid).eq('muted_id', target));
}
export async function getBlockedUsers(): Promise<PersonCard[]> {
  return unwrap<PersonCard[]>(await supabase.rpc('get_blocked_users') as Res<PersonCard[]>) ?? [];
}
export async function getMutedUsers(uid: string): Promise<PersonCard[]> {
  const res = await supabase.from('mutes').select('muted:profiles!muted_id(id,username,display_name,avatar_path,city)').eq('muter_id', uid);
  return ((unwrap<any[]>(res as Res<any[]>) ?? []).map((r) => r.muted).filter(Boolean)) as PersonCard[];
}
export async function getCloseFriends(uid: string): Promise<string[]> {
  const res = await supabase.from('close_friends').select('friend_id').eq('user_id', uid);
  return ((unwrap<any[]>(res as Res<any[]>) ?? []).map((r) => r.friend_id)) as string[];
}
export async function setCloseFriend(uid: string, friendId: string, on: boolean): Promise<void> {
  if (on) check(await supabase.from('close_friends').insert({ user_id: uid, friend_id: friendId }));
  else check(await supabase.from('close_friends').delete().eq('user_id', uid).eq('friend_id', friendId));
}

// ───────────── discover ─────────────

export async function discoverPeople(p: {
  q?: string; city?: string; intent?: string; mode?: 'search' | 'nearby' | 'new' | 'friends'; offset?: number; limit?: number;
}): Promise<PersonCard[]> {
  const res = await supabase.rpc('discover_people', {
    p_q: p.q || null, p_city: p.city || null, p_intent: p.intent || null,
    p_mode: p.mode ?? 'search', p_limit: p.limit ?? PAGE, p_offset: p.offset ?? 0,
  });
  return unwrap<PersonCard[]>(res as Res<PersonCard[]>) ?? [];
}
export async function discoverGroups(q?: string, offset = 0, limit = PAGE): Promise<Group[]> {
  const res = await supabase.rpc('discover_groups', { p_q: q || null, p_limit: limit, p_offset: offset });
  return unwrap<Group[]>(res as Res<Group[]>) ?? [];
}
export async function discoverEvents(q?: string, city?: string, offset = 0, limit = PAGE): Promise<EventItem[]> {
  const res = await supabase.rpc('discover_events', { p_q: q || null, p_city: city || null, p_limit: limit, p_offset: offset });
  return unwrap<EventItem[]>(res as Res<EventItem[]>) ?? [];
}
export async function discoverPlaces(q?: string): Promise<{ location: string; post_count: number; last_post_at: string }[]> {
  const res = await supabase.rpc('discover_places', { p_q: q || null, p_limit: 30 });
  return unwrap<any[]>(res as Res<any[]>) ?? [];
}
export async function trendingTags(): Promise<{ tag: string; post_count: number }[]> {
  const res = await supabase.rpc('trending_tags', { p_limit: 10 });
  return unwrap<any[]>(res as Res<any[]>) ?? [];
}

// ───────────── messaging ─────────────

export async function getConversations(requests: boolean): Promise<Conversation[]> {
  return unwrap<Conversation[]>(await supabase.rpc('get_conversations', { p_requests: requests }) as Res<Conversation[]>) ?? [];
}
export async function getConversation(id: string): Promise<Conversation | null> {
  const rows = unwrap<Conversation[]>(await supabase.rpc('get_conversation', { p_id: id }) as Res<Conversation[]>) ?? [];
  return rows[0] ?? null;
}
export async function openConversation(otherId: string): Promise<string> {
  return unwrap<string>(await supabase.rpc('open_conversation', { p_other: otherId }) as Res<string>);
}
export async function respondMessageRequest(id: string, accept: boolean): Promise<void> {
  check(await supabase.rpc('respond_message_request', { p_conversation: id, p_accept: accept }));
}
export async function getMessages(conversationId: string, before?: string, limit = 40): Promise<Message[]> {
  let q = supabase.from('messages').select('*').eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(limit);
  if (before) q = q.lt('created_at', before);
  return (unwrap<Message[]>(await q as Res<Message[]>) ?? []);
}
export async function sendMessage(conversationId: string, uid: string, body: string,
  media?: { path: string; type: 'image' | 'video' }): Promise<Message> {
  const res = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: uid, body: body.trim(),
    media_path: media?.path ?? null, media_type: media?.type ?? null,
  }).select('*').single();
  return unwrap<Message>(res as Res<Message>);
}
export async function markConversationRead(conversationId: string, uid: string): Promise<void> {
  await supabase.from('conversation_participants').update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', uid);
}
export async function deleteMessage(id: string): Promise<void> { check(await supabase.from('messages').delete().eq('id', id)); }
export async function getMessageReactions(ids: string[]): Promise<{ target_id: string; user_id: string; reaction: string }[]> {
  if (!ids.length) return [];
  const res = await supabase.from('reactions').select('target_id,user_id,reaction').eq('target_type', 'message').in('target_id', ids);
  return (res.data ?? []) as any[];
}
export async function replyToStory(storyId: string, body: string): Promise<string> {
  return unwrap<string>(await supabase.rpc('reply_to_story', { p_story: storyId, p_body: body }) as Res<string>);
}

// ───────────── notifications ─────────────

export async function getNotifications(offset: number): Promise<NotificationItem[]> {
  const res = await supabase.from('notifications')
    .select('*, actor:profiles!actor_id(username,display_name,avatar_path)')
    .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
  return (unwrap<any[]>(res as Res<any[]>) ?? []) as NotificationItem[];
}
export async function unreadNotificationCount(uid: string): Promise<number> {
  const res = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('recipient_id', uid).is('read_at', null);
  return res.count ?? 0;
}
export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
}
export async function markAllNotificationsRead(uid: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', uid).is('read_at', null);
}

// ───────────── groups ─────────────

export async function getGroup(id: string): Promise<Group | null> {
  const res = await supabase.from('groups').select('*').eq('id', id).is('removed_at', null).maybeSingle();
  return unwrap<Group | null>(res as Res<Group | null>);
}
export async function getMyGroupStatus(groupId: string, uid: string): Promise<{ role: string; status: string } | null> {
  const res = await supabase.from('group_members').select('role,status').eq('group_id', groupId).eq('user_id', uid).maybeSingle();
  return unwrap<any | null>(res as Res<any | null>);
}
export async function getMyGroups(uid: string): Promise<Group[]> {
  const res = await supabase.from('group_members')
    .select('role, group:groups!group_id(id,name,description,cover_path,privacy,member_count,removed_at)')
    .eq('user_id', uid).eq('status', 'active');
  return ((unwrap<any[]>(res as Res<any[]>) ?? []).map((r) => r.group).filter((g) => g && !g.removed_at)) as Group[];
}
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const res = await supabase.from('group_members')
    .select('group_id,user_id,role,status,profile:profiles!user_id(id,username,display_name,avatar_path)')
    .eq('group_id', groupId).order('joined_at', { ascending: true }).limit(300);
  return (unwrap<any[]>(res as Res<any[]>) ?? []) as GroupMember[];
}
export async function createGroup(uid: string, v: { name: string; description: string; privacy: 'public' | 'private'; coverPath?: string | null }): Promise<string> {
  const res = await supabase.from('groups').insert({
    owner_id: uid, name: v.name.trim(), description: v.description.trim(), privacy: v.privacy, cover_path: v.coverPath ?? null,
  }).select('id').single();
  return unwrap<{ id: string }>(res as Res<{ id: string }>).id;
}
export async function joinGroup(groupId: string, uid: string): Promise<void> {
  check(await supabase.from('group_members').insert({ group_id: groupId, user_id: uid, role: 'member' }));
}
export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  check(await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', uid));
}
export async function setMemberStatus(groupId: string, userId: string, status: 'active' | 'banned'): Promise<void> {
  check(await supabase.from('group_members').update({ status }).eq('group_id', groupId).eq('user_id', userId));
}
export async function setMemberRole(groupId: string, userId: string, role: 'member' | 'moderator'): Promise<void> {
  check(await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId));
}
export async function removeMember(groupId: string, userId: string): Promise<void> {
  check(await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId));
}
export async function deleteGroup(id: string): Promise<void> { check(await supabase.from('groups').delete().eq('id', id)); }
export async function getGroupEvents(groupId: string): Promise<EventItem[]> {
  const res = await supabase.from('events').select('*').eq('group_id', groupId).is('removed_at', null)
    .gte('starts_at', new Date(Date.now() - 6 * 3600 * 1000).toISOString()).order('starts_at').limit(30);
  return (unwrap<any[]>(res as Res<any[]>) ?? []) as EventItem[];
}

// ───────────── events ─────────────

export async function getEvent(id: string, uid: string): Promise<(EventItem & { organizer: string }) | null> {
  const res = await supabase.from('events').select('*, creator:profiles!creator_id(display_name,username)')
    .eq('id', id).is('removed_at', null).maybeSingle();
  const row = unwrap<any | null>(res as Res<any | null>);
  if (!row) return null;
  const mine = await supabase.from('event_attendees').select('status').eq('event_id', id).eq('user_id', uid).maybeSingle();
  return { ...row, organizer: row.creator?.display_name ?? 'Organizer', my_status: (mine.data as any)?.status ?? null };
}
export async function getMyEvents(uid: string): Promise<EventItem[]> {
  const res = await supabase.from('event_attendees')
    .select('status, event:events!event_id(*)').eq('user_id', uid);
  return ((unwrap<any[]>(res as Res<any[]>) ?? [])
    .map((r) => (r.event ? { ...r.event, my_status: r.status } : null))
    .filter((e) => e && !e.removed_at && new Date(e.ends_at ?? e.starts_at).getTime() > Date.now() - 6 * 3600 * 1000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))) as EventItem[];
}
export async function getEventAttendees(id: string): Promise<{ status: string; profile: PersonCard | null }[]> {
  const res = await supabase.from('event_attendees')
    .select('status, profile:profiles!user_id(id,username,display_name,avatar_path,city)').eq('event_id', id).limit(200);
  return (unwrap<any[]>(res as Res<any[]>) ?? []) as any[];
}
export async function setAttendance(eventId: string, uid: string, status: 'interested' | 'going' | null, had: boolean): Promise<void> {
  if (status === null) { check(await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', uid)); return; }
  if (had) check(await supabase.from('event_attendees').update({ status }).eq('event_id', eventId).eq('user_id', uid));
  else check(await supabase.from('event_attendees').insert({ event_id: eventId, user_id: uid, status }));
}
export async function createEvent(uid: string, v: {
  title: string; description: string; startsAt: Date; endsAt?: Date | null; location?: string; city?: string;
  privacy: 'public' | 'private'; groupId?: string | null; coverPath?: string | null;
}): Promise<string> {
  const res = await supabase.from('events').insert({
    creator_id: uid, title: v.title.trim(), description: v.description.trim(),
    starts_at: v.startsAt.toISOString(), ends_at: v.endsAt ? v.endsAt.toISOString() : null,
    location: v.location?.trim() || null, city: v.city?.trim() || null, privacy: v.privacy,
    group_id: v.groupId ?? null, cover_path: v.coverPath ?? null,
  }).select('id').single();
  return unwrap<{ id: string }>(res as Res<{ id: string }>).id;
}
export async function deleteEvent(id: string): Promise<void> { check(await supabase.from('events').delete().eq('id', id)); }

// ───────────── stories ─────────────

export async function getStoryTray(): Promise<StoryTrayItem[]> {
  return unwrap<StoryTrayItem[]>(await supabase.rpc('get_story_tray') as Res<StoryTrayItem[]>) ?? [];
}
export async function getUserStories(userId: string): Promise<Story[]> {
  const res = await supabase.from('stories').select('*').eq('author_id', userId).is('removed_at', null)
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });
  return (unwrap<Story[]>(res as Res<Story[]>) ?? []);
}
export async function createStory(uid: string, v: { path: string; type: 'image' | 'video'; caption?: string; audience: StoryAudience }): Promise<void> {
  check(await supabase.from('stories').insert({
    author_id: uid, media_path: v.path, media_type: v.type, caption: v.caption?.trim() || null, audience: v.audience,
  }));
}
export async function deleteStory(id: string): Promise<void> { check(await supabase.from('stories').delete().eq('id', id)); }
export async function markStoryViewed(storyId: string, uid: string): Promise<void> {
  await supabase.from('story_views').insert({ story_id: storyId, viewer_id: uid }); // duplicate-key errors are expected
}
export async function getStoryViewers(storyId: string): Promise<{ viewed_at: string; viewer: PersonCard | null }[]> {
  const res = await supabase.from('story_views')
    .select('viewed_at, viewer:profiles!viewer_id(id,username,display_name,avatar_path,city)')
    .eq('story_id', storyId).order('viewed_at', { ascending: false }).limit(200);
  return (unwrap<any[]>(res as Res<any[]>) ?? []) as any[];
}

// ───────────── albums ─────────────

export async function getAlbums(ownerId: string): Promise<Album[]> {
  const res = await supabase.from('albums').select('*').eq('owner_id', ownerId).is('removed_at', null)
    .order('created_at', { ascending: false });
  return (unwrap<Album[]>(res as Res<Album[]>) ?? []);
}
export async function getAlbum(id: string): Promise<Album | null> {
  const res = await supabase.from('albums').select('*').eq('id', id).is('removed_at', null).maybeSingle();
  return unwrap<Album | null>(res as Res<Album | null>);
}
export async function getAlbumMedia(id: string): Promise<AlbumMedia[]> {
  const res = await supabase.from('album_media').select('*').eq('album_id', id).order('sort_order').order('created_at');
  return (unwrap<AlbumMedia[]>(res as Res<AlbumMedia[]>) ?? []);
}
export async function createAlbum(uid: string, v: { title: string; description: string; privacy: 'public' | 'friends' | 'private'; paths: string[] }): Promise<string> {
  const res = await supabase.from('albums').insert({
    owner_id: uid, title: v.title.trim(), description: v.description.trim(), privacy: v.privacy,
    cover_path: v.paths[0] ?? null,
  }).select('id').single();
  const id = unwrap<{ id: string }>(res as Res<{ id: string }>).id;
  if (v.paths.length) await addAlbumMedia(id, v.paths, 0);
  return id;
}
export async function addAlbumMedia(albumId: string, paths: string[], startOrder: number): Promise<void> {
  check(await supabase.from('album_media').insert(paths.map((p, i) => ({ album_id: albumId, path: p, sort_order: startOrder + i }))));
}
export async function updateAlbum(id: string, patch: Partial<Pick<Album, 'title' | 'description' | 'privacy' | 'cover_path'>>): Promise<void> {
  check(await supabase.from('albums').update(patch).eq('id', id));
}
export async function deleteAlbum(id: string): Promise<void> { check(await supabase.from('albums').delete().eq('id', id)); }
export async function deleteAlbumMedia(id: string): Promise<void> { check(await supabase.from('album_media').delete().eq('id', id)); }

// ───────────── dating ─────────────

export async function datingCandidates(view: 'suggested' | 'nearby' | 'new' | 'likes'): Promise<DatingCandidate[]> {
  return unwrap<DatingCandidate[]>(await supabase.rpc('dating_candidates', { p_view: view, p_limit: 20 }) as Res<DatingCandidate[]>) ?? [];
}
export async function datingSwipe(target: string, kind: 'like' | 'pass'): Promise<{ matched: boolean; conversation_id?: string }> {
  return unwrap<any>(await supabase.rpc('dating_swipe', { p_target: target, p_kind: kind }) as Res<any>);
}
export async function getMatches(): Promise<MatchItem[]> {
  return unwrap<MatchItem[]>(await supabase.rpc('get_matches') as Res<MatchItem[]>) ?? [];
}

// ───────────── safety ─────────────

export async function submitReport(type: ReportTarget, id: string, reason: string, details?: string): Promise<void> {
  check(await supabase.from('reports').insert({ target_type: type, target_id: id, reason, details: details?.trim() || null }));
}
export async function getMyReports(uid: string): Promise<MyReport[]> {
  const res = await supabase.from('reports').select('id,target_type,reason,status,created_at,resolved_at')
    .eq('reporter_id', uid).order('created_at', { ascending: false }).limit(50);
  return (unwrap<MyReport[]>(res as Res<MyReport[]>) ?? []);
}
export async function createAppeal(uid: string, message: string): Promise<void> {
  check(await supabase.from('appeals').insert({ user_id: uid, message: message.trim() }));
}
export async function getMyAppeals(uid: string): Promise<{ id: string; message: string; status: string; response: string | null; created_at: string }[]> {
  const res = await supabase.from('appeals').select('id,message,status,response,created_at').eq('user_id', uid).order('created_at', { ascending: false });
  return (unwrap<any[]>(res as Res<any[]>) ?? []);
}
