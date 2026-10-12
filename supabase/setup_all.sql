-- ===== supabase/migrations/0001_schema.sql =====
-- LICKD MVP schema. Tables, constraints, indexes.
-- Access control lives in 0003_rls.sql; business logic in 0004_functions.sql.

create extension if not exists pgcrypto;

-- ───────────────────────── Identity ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_path text,
  cover_path text,
  bio text not null default '' check (char_length(bio) <= 500),
  city text check (char_length(city) <= 80),
  show_city boolean not null default true,
  pronouns text check (char_length(pronouns) <= 30),
  interests text[] not null default '{}',
  intents text[] not null default '{}',
  dating_enabled boolean not null default false,
  dating_headline text check (char_length(dating_headline) <= 140),
  dating_looking_for text[] not null default '{}',
  discoverability text not null default 'everyone' check (discoverability in ('everyone','unlisted','friends')),
  who_can_message text not null default 'everyone' check (who_can_message in ('everyone','friends','nobody')),
  who_can_friend text not null default 'everyone' check (who_can_friend in ('everyone','nobody')),
  role text not null default 'user' check (role in ('user','moderator','admin')),
  status text not null default 'active' check (status in ('active','suspended','banned','deactivated')),
  suspended_until timestamptz,
  onboarded boolean not null default false,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_city_idx on public.profiles (lower(city));
create index profiles_created_idx on public.profiles (created_at desc);

-- Sensitive per-user data. Owner-only; never joined into public views.
create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birthdate date not null,
  age_status text not null default 'self_declared' check (age_status in ('self_declared','verified')),
  terms_accepted_at timestamptz not null default now(),
  push_token text
);

create table public.profile_customizations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'neon',
  background_color text check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  background_path text,
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  font text not null default 'default' check (font in ('default','display','mono','script')),
  layout text not null default 'classic' check (layout in ('classic','compact','showcase')),
  music_title text check (char_length(music_title) <= 100),
  music_artist text check (char_length(music_artist) <= 100),
  music_url text check (music_url is null or music_url ~ '^https://'),
  featured_paths text[] not null default '{}' check (cardinality(featured_paths) <= 6),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Social graph ─────────────────────────

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index friendships_pair_key on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create table public.close_friends (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table public.top8 (
  user_id uuid not null references public.profiles(id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  friend_id uuid not null references public.profiles(id) on delete cascade,
  primary key (user_id, position),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ───────────────────────── Groups & events ─────────────────────────

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  cover_path text,
  privacy text not null default 'public' check (privacy in ('public','private')),
  member_count integer not null default 0,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index groups_created_idx on public.groups (created_at desc);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  status text not null default 'active' check (status in ('active','pending','banned')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id, status);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  cover_path text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (char_length(location) <= 200),
  city text check (char_length(city) <= 80),
  privacy text not null default 'public' check (privacy in ('public','private')),
  interested_count integer not null default 0,
  going_count integer not null default 0,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at);

create table public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('interested','going')),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_attendees_user_idx on public.event_attendees (user_id);

-- ───────────────────────── Content ─────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  media_paths text[] not null default '{}' check (cardinality(media_paths) <= 10),
  media_types text[] not null default '{}' check (cardinality(media_types) = cardinality(media_paths)),
  audience text not null default 'public' check (audience in ('public','friends','group')),
  group_id uuid references public.groups(id) on delete cascade,
  location text check (char_length(location) <= 120),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (body <> '' or cardinality(media_paths) > 0),
  check ((audience = 'group') = (group_id is not null))
);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index posts_group_idx on public.posts (group_id, created_at desc) where group_id is not null;
create index posts_media_gin on public.posts using gin (media_paths);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  like_count integer not null default 0,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.reactions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','message')),
  target_id uuid not null,
  reaction text not null default 'like' check (reaction in ('like','love','fire','laugh','wow','sad')),
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index reactions_target_idx on public.reactions (target_type, target_id);

-- ───────────────────────── Messaging ─────────────────────────

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','request','declined')),
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'direct' check (source in ('direct','match','story')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conv_part_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  media_path text,
  media_type text check (media_type in ('image','video')),
  story_id uuid,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  check (body <> '' or media_path is not null)
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);

-- ───────────────────────── Stories & albums ─────────────────────────

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null,
  media_type text not null check (media_type in ('image','video')),
  caption text check (char_length(caption) <= 200),
  audience text not null default 'everyone' check (audience in ('everyone','friends','close_friends')),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index stories_author_idx on public.stories (author_id, created_at desc);
create index stories_expires_idx on public.stories (expires_at);

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.messages
  add constraint messages_story_fk foreign key (story_id) references public.stories(id) on delete set null;

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  cover_path text,
  privacy text not null default 'public' check (privacy in ('public','friends','private')),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index albums_owner_idx on public.albums (owner_id, created_at desc);

create table public.album_media (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index album_media_album_idx on public.album_media (album_id, sort_order);
create index album_media_path_idx on public.album_media (path);

-- ───────────────────────── Dating ─────────────────────────

create table public.dating_likes (
  liker_id uuid not null references public.profiles(id) on delete cascade,
  liked_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('like','pass')),
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);
create index dating_likes_liked_idx on public.dating_likes (liked_id, kind);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

-- ───────────────────────── Notifications ─────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow','friend_request','friend_accept','message','group_activity','event_reminder','event_activity','match','moderation','report_update')),
  target_type text,
  target_id uuid,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

-- ───────────────────────── Safety & moderation ─────────────────────────

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('user','post','comment','message','conversation','story','group','event','album')),
  target_id uuid not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('spam','harassment','hate','explicit','scam','impersonation','underage','self_harm','other')),
  details text check (char_length(details) <= 1000),
  snapshot jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  moderator_id uuid references public.profiles(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_user_idx on public.reports (target_user_id);
create unique index reports_open_dupe_key on public.reports (reporter_id, target_type, target_id) where status in ('open','reviewing');

create table public.mod_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  target_user_id uuid references public.profiles(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index mod_actions_user_idx on public.mod_actions (target_user_id, created_at desc);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','upheld','denied')),
  response text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index appeals_one_pending_key on public.appeals (user_id) where status = 'pending';

-- ───────────────────────── Infrastructure ─────────────────────────

create table public.rate_events (
  id bigserial primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_events_lookup_idx on public.rate_events (user_id, action, created_at desc);

create table public.analytics_events (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) <= 60),
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events (name, created_at desc);

-- ===== supabase/migrations/0002_helpers.sql =====
-- Authorization helpers. SECURITY DEFINER so they can read the tables they
-- guard without recursing into those tables' own RLS policies.

create or replace function public.auth_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role in ('moderator','admin') and status = 'active');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- True if either user has blocked the other.
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships
                 where status = 'accepted'
                   and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a)));
$$;

create or replace function public.is_group_member(g uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = u and status = 'active');
$$;

create or replace function public.is_group_mod(g uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members
                 where group_id = g and user_id = u and status = 'active' and role in ('owner','moderator'));
$$;

create or replace function public.is_group_owner(g uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups where id = g and owner_id = u);
$$;

create or replace function public.author_active(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = u and status = 'active');
$$;

-- Can the current user see a post-like object (author, audience, group)?
create or replace function public.can_view_content(p_author uuid, p_audience text, p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    auth.uid() = p_author
    or public.is_staff()
    or (
      public.author_active(p_author)
      and not public.is_blocked(auth.uid(), p_author)
      and case p_audience
        when 'public'  then true
        when 'friends' then public.are_friends(auth.uid(), p_author)
        when 'group'   then exists (
          select 1 from groups g
          where g.id = p_group and g.removed_at is null
            and (g.privacy = 'public' or public.is_group_member(g.id)))
        else false
      end
    );
$$;

create or replace function public.can_view_story(p_author uuid, p_audience text, p_expires timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select
    auth.uid() = p_author
    or (
      p_expires > now()
      and public.author_active(p_author)
      and not public.is_blocked(auth.uid(), p_author)
      and case p_audience
        when 'everyone'      then true
        when 'friends'       then public.are_friends(auth.uid(), p_author)
        when 'close_friends' then exists (select 1 from close_friends
                                          where user_id = p_author and friend_id = auth.uid())
        else false
      end
    );
$$;

create or replace function public.can_view_album(p_owner uuid, p_privacy text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    auth.uid() = p_owner
    or public.is_staff()
    or (
      public.author_active(p_owner)
      and not public.is_blocked(auth.uid(), p_owner)
      and case p_privacy
        when 'public'  then true
        when 'friends' then public.are_friends(auth.uid(), p_owner)
        else false
      end
    );
$$;

create or replace function public.can_view_event(p_creator uuid, p_group uuid, p_privacy text, p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    auth.uid() = p_creator
    or public.is_staff()
    or (
      public.author_active(p_creator)
      and not public.is_blocked(auth.uid(), p_creator)
      and (
        p_privacy = 'public'
        or public.are_friends(auth.uid(), p_creator)
        or (p_group is not null and public.is_group_member(p_group))
        or exists (select 1 from event_attendees where event_id = p_event and user_id = auth.uid())
      )
    );
$$;

-- ── Messaging helpers ──

create or replace function public.other_participant(conv uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from conversation_participants where conversation_id = conv and user_id <> auth.uid() limit 1;
$$;

create or replace function public.is_participant(conv uuid, u uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_participants where conversation_id = conv and user_id = u);
$$;

create or replace function public.is_conversation_visible(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_participant(conv)
     and not public.is_blocked(auth.uid(), public.other_participant(conv));
$$;

create or replace function public.can_send_message(conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations c
    where c.id = conv
      and public.is_participant(conv)
      and (c.status = 'active' or (c.status = 'request' and c.initiator_id = auth.uid()))
  )
  and public.author_active(public.other_participant(conv))
  and not public.is_blocked(auth.uid(), public.other_participant(conv));
$$;

-- Can the current user see the thing a reaction/report points at? (invoker: RLS applies)
create or replace function public.can_view_target(p_type text, p_id uuid) returns boolean
language plpgsql stable set search_path = public as $$
begin
  return case p_type
    when 'post'    then exists (select 1 from posts    where id = p_id)
    when 'comment' then exists (select 1 from comments where id = p_id)
    when 'message' then exists (select 1 from messages where id = p_id)
    else false
  end;
end $$;

-- ── Media access (private bucket) ──
-- Objects are stored at <owner uuid>/<file>. A user may read an object if they
-- own it, or if it is attached to content they are allowed to see.
create or replace function public.can_read_media(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    split_part(p, '/', 1) = auth.uid()::text
    or exists (select 1 from posts x
               where x.media_paths @> array[p] and x.removed_at is null
                 and public.can_view_content(x.author_id, x.audience, x.group_id))
    or exists (select 1 from stories s
               where s.media_path = p and s.removed_at is null
                 and public.can_view_story(s.author_id, s.audience, s.expires_at))
    or exists (select 1 from album_media m join albums a on a.id = m.album_id
               where m.path = p and a.removed_at is null
                 and public.can_view_album(a.owner_id, a.privacy))
    or exists (select 1 from messages m
               where m.media_path = p and m.removed_at is null
                 and public.is_conversation_visible(m.conversation_id))
    or exists (select 1 from profile_customizations c
               where (c.background_path = p or c.featured_paths @> array[p])
                 and not public.is_blocked(auth.uid(), c.user_id)
                 and public.author_active(c.user_id))
    or (public.is_staff() and exists (
          select 1 from reports r where r.snapshot -> 'media_paths' ? p));
$$;

-- ── Rate limiting ──
-- Raises if the current user performed `p_action` more than `p_max` times in `p_seconds`.
create or replace function public.enforce_rate_limit(p_action text, p_max integer, p_seconds integer) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then return; end if;
  select count(*) into n from rate_events
   where user_id = uid and action = p_action
     and created_at > now() - make_interval(secs => p_seconds);
  if n >= p_max then
    raise exception 'Slow down — you''re doing that too often. Try again in a bit.'
      using errcode = 'P0429', detail = p_action;
  end if;
  insert into rate_events (user_id, action) values (uid, p_action);
end $$;

-- ===== supabase/migrations/0003_rls.sql =====
-- Row-level security. Default deny: a table with RLS and no matching policy
-- is invisible to clients. Writes that need business logic go through RPCs.

create or replace function public.owns_path(p text) returns boolean
language sql stable as $$ select p is null or split_part(p, '/', 1) = auth.uid()::text $$;

create or replace function public.owns_paths(p text[]) returns boolean
language sql stable as $$
  select not exists (select 1 from unnest(p) x where split_part(x, '/', 1) <> auth.uid()::text)
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','profile_private','profile_customizations','follows','friendships','blocks','mutes',
    'close_friends','top8','groups','group_members','events','event_attendees','posts','comments',
    'reactions','conversations','conversation_participants','messages','stories','story_views',
    'albums','album_media','dating_likes','matches','notifications','reports','mod_actions',
    'appeals','rate_events','analytics_events']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── profiles ──
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_staff()
  or (status = 'active'
      and not public.is_blocked(auth.uid(), id)
      and (discoverability <> 'friends' or public.are_friends(auth.uid(), id)))
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and public.owns_path(avatar_path) and public.owns_path(cover_path));

create policy profile_private_select on public.profile_private for select to authenticated using (user_id = auth.uid());
create policy profile_private_update on public.profile_private for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy custom_select on public.profile_customizations for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = user_id));
create policy custom_insert on public.profile_customizations for insert to authenticated with check (
  user_id = auth.uid() and public.owns_path(background_path) and public.owns_paths(featured_paths));
create policy custom_update on public.profile_customizations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.owns_path(background_path) and public.owns_paths(featured_paths));
create policy custom_delete on public.profile_customizations for delete to authenticated using (user_id = auth.uid());

create policy top8_select on public.top8 for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = user_id));
create policy top8_write on public.top8 for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── social graph ──
create policy follows_select on public.follows for select to authenticated using (
  follower_id = auth.uid() or following_id = auth.uid()
  or (not public.is_blocked(auth.uid(), follower_id) and not public.is_blocked(auth.uid(), following_id)));
create policy follows_insert on public.follows for insert to authenticated with check (
  follower_id = auth.uid()
  and not public.is_blocked(follower_id, following_id)
  and exists (select 1 from public.profiles p where p.id = following_id and p.who_can_friend = 'everyone'));
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy friendships_select on public.friendships for select to authenticated using (
  requester_id = auth.uid() or addressee_id = auth.uid()
  or (status = 'accepted'
      and not public.is_blocked(auth.uid(), requester_id)
      and not public.is_blocked(auth.uid(), addressee_id)));

create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy mutes_own on public.mutes for all to authenticated
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());
create policy close_friends_own on public.close_friends for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.are_friends(user_id, friend_id));

-- ── groups ──
create policy groups_select on public.groups for select to authenticated using (
  public.is_staff() or owner_id = auth.uid()
  or (removed_at is null and public.author_active(owner_id) and not public.is_blocked(auth.uid(), owner_id)));
create policy groups_insert on public.groups for insert to authenticated with check (
  owner_id = auth.uid() and public.owns_path(cover_path));
create policy groups_update on public.groups for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.owns_path(cover_path));
create policy groups_delete on public.groups for delete to authenticated using (owner_id = auth.uid());

create policy gm_select on public.group_members for select to authenticated using (
  user_id = auth.uid()
  or public.is_group_mod(group_id)
  or (status = 'active'
      and not public.is_blocked(auth.uid(), user_id)
      and (public.is_group_member(group_id)
           or exists (select 1 from public.groups g where g.id = group_id and g.privacy = 'public'))));
create policy gm_insert on public.group_members for insert to authenticated with check (
  user_id = auth.uid() and role = 'member'
  and exists (select 1 from public.groups g where g.id = group_id));
create policy gm_update on public.group_members for update to authenticated
  using (public.is_group_mod(group_id) and role <> 'owner' and user_id <> auth.uid())
  with check (role in ('member','moderator') and (role = 'member' or public.is_group_owner(group_id)));
create policy gm_delete on public.group_members for delete to authenticated using (
  role <> 'owner' and (user_id = auth.uid() or public.is_group_mod(group_id)));

-- ── events ──
create policy events_select on public.events for select to authenticated using (
  (removed_at is null or public.is_staff())
  and public.can_view_event(creator_id, group_id, privacy, id));
create policy events_insert on public.events for insert to authenticated with check (
  creator_id = auth.uid() and public.owns_path(cover_path)
  and (group_id is null or public.is_group_member(group_id)));
create policy events_update on public.events for update to authenticated
  using (creator_id = auth.uid() or (group_id is not null and public.is_group_mod(group_id)))
  with check (public.owns_path(cover_path));
create policy events_delete on public.events for delete to authenticated using (
  creator_id = auth.uid() or (group_id is not null and public.is_group_mod(group_id)));

create policy attendees_select on public.event_attendees for select to authenticated using (
  user_id = auth.uid()
  or (not public.is_blocked(auth.uid(), user_id)
      and exists (select 1 from public.events e where e.id = event_id)));
create policy attendees_insert on public.event_attendees for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id));
create policy attendees_update on public.event_attendees for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy attendees_delete on public.event_attendees for delete to authenticated using (user_id = auth.uid());

-- ── posts / comments / reactions ──
create policy posts_select on public.posts for select to authenticated using (
  (removed_at is null or public.is_staff())
  and public.can_view_content(author_id, audience, group_id));
create policy posts_insert on public.posts for insert to authenticated with check (
  author_id = auth.uid()
  and public.owns_paths(media_paths)
  and (group_id is null or public.is_group_member(group_id)));
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (
  author_id = auth.uid() or (group_id is not null and public.is_group_mod(group_id)));

create policy comments_select on public.comments for select to authenticated using (
  (removed_at is null or public.is_staff())
  and not public.is_blocked(auth.uid(), author_id)
  and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert on public.comments for insert to authenticated with check (
  author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_delete on public.comments for delete to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create policy reactions_select on public.reactions for select to authenticated using (
  user_id = auth.uid() or public.can_view_target(target_type, target_id));
create policy reactions_insert on public.reactions for insert to authenticated with check (
  user_id = auth.uid() and public.can_view_target(target_type, target_id));
create policy reactions_update on public.reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- ── messaging ──
create policy conv_select on public.conversations for select to authenticated using (
  public.is_conversation_visible(id));
create policy cp_select on public.conversation_participants for select to authenticated using (
  user_id = auth.uid() or public.is_participant(conversation_id));
create policy cp_update on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy messages_select on public.messages for select to authenticated using (
  removed_at is null and public.is_conversation_visible(conversation_id));
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.owns_path(media_path) and public.can_send_message(conversation_id));
create policy messages_delete on public.messages for delete to authenticated using (sender_id = auth.uid());

-- ── stories ──
create policy stories_select on public.stories for select to authenticated using (
  (removed_at is null and public.can_view_story(author_id, audience, expires_at)) or public.is_staff());
create policy stories_insert on public.stories for insert to authenticated with check (
  author_id = auth.uid() and public.owns_path(media_path));
create policy stories_delete on public.stories for delete to authenticated using (author_id = auth.uid());

create policy story_views_select on public.story_views for select to authenticated using (
  viewer_id = auth.uid()
  or exists (select 1 from public.stories s where s.id = story_id and s.author_id = auth.uid()));
create policy story_views_insert on public.story_views for insert to authenticated with check (
  viewer_id = auth.uid() and exists (select 1 from public.stories s where s.id = story_id));

-- ── albums ──
create policy albums_select on public.albums for select to authenticated using (
  (removed_at is null or public.is_staff()) and public.can_view_album(owner_id, privacy));
create policy albums_insert on public.albums for insert to authenticated with check (
  owner_id = auth.uid() and public.owns_path(cover_path));
create policy albums_update on public.albums for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.owns_path(cover_path));
create policy albums_delete on public.albums for delete to authenticated using (owner_id = auth.uid());

create policy album_media_select on public.album_media for select to authenticated using (
  exists (select 1 from public.albums a where a.id = album_id));
create policy album_media_write on public.album_media for all to authenticated
  using (exists (select 1 from public.albums a where a.id = album_id and a.owner_id = auth.uid()))
  with check (public.owns_path(path)
              and exists (select 1 from public.albums a where a.id = album_id and a.owner_id = auth.uid()));

-- ── dating (reads only; writes via RPC) ──
create policy matches_select on public.matches for select to authenticated using (
  (user_a = auth.uid() or user_b = auth.uid())
  and not public.is_blocked(user_a, user_b));

-- ── notifications ──
create policy notif_select on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- ── safety ──
create policy reports_select on public.reports for select to authenticated using (
  reporter_id = auth.uid() or public.is_staff());
create policy reports_insert on public.reports for insert to authenticated with check (
  reporter_id = auth.uid() and status = 'open');
create policy mod_actions_select on public.mod_actions for select to authenticated using (public.is_staff());
create policy appeals_select on public.appeals for select to authenticated using (
  user_id = auth.uid() or public.is_staff());
create policy appeals_insert on public.appeals for insert to authenticated with check (
  user_id = auth.uid() and status = 'pending');

create policy analytics_insert on public.analytics_events for insert to authenticated with check (user_id = auth.uid());

-- ── suspended/banned/deactivated accounts are read-only ──
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','profile_customizations','top8','follows','close_friends','groups','group_members',
    'events','event_attendees','posts','comments','reactions','messages','stories','story_views',
    'albums','album_media','mutes']
  loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.auth_active())', 'active_ins_' || t, t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.auth_active()) with check (public.auth_active())', 'active_upd_' || t, t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.auth_active())', 'active_del_' || t, t);
  end loop;
end $$;

-- ===== supabase/migrations/0004_functions.sql =====
-- Business logic: triggers (counters, notifications, rate limits, safety) and RPCs.

-- ───────────────────────── Notifications ─────────────────────────

create or replace function public.notify(
  p_recipient uuid, p_actor uuid, p_type text, p_target_type text, p_target_id uuid, p_data jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null or p_recipient = p_actor then return; end if;
  if p_actor is not null and p_type not in ('moderation','report_update') then
    if public.is_blocked(p_recipient, p_actor) then return; end if;
    if exists (select 1 from mutes where muter_id = p_recipient and muted_id = p_actor) then return; end if;
  end if;
  insert into notifications (recipient_id, actor_id, type, target_type, target_id, data)
  values (p_recipient, p_actor, p_type, p_target_type, p_target_id, coalesce(p_data, '{}'));
end $$;

-- ───────────────────────── Generic triggers ─────────────────────────

create or replace function public.trg_touch_updated() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger posts_touch before update on public.posts
  for each row execute function public.trg_touch_updated();

create or replace function public.trg_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit(tg_argv[0], tg_argv[1]::int, tg_argv[2]::int);
  return new;
end $$;

create trigger posts_rate before insert on public.posts
  for each row execute function public.trg_rate_limit('post', '30', '3600');
create trigger comments_rate before insert on public.comments
  for each row execute function public.trg_rate_limit('comment', '40', '600');
create trigger follows_rate before insert on public.follows
  for each row execute function public.trg_rate_limit('follow', '100', '3600');
create trigger stories_rate before insert on public.stories
  for each row execute function public.trg_rate_limit('story', '40', '3600');
create trigger groups_rate before insert on public.groups
  for each row execute function public.trg_rate_limit('group', '5', '86400');
create trigger events_rate before insert on public.events
  for each row execute function public.trg_rate_limit('event', '10', '86400');

-- Posts can only target groups the author belongs to; non-group posts can't claim a group.
-- ───────────────────────── Reactions & comments ─────────────────────────

create or replace function public.trg_reaction_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; pid uuid;
begin
  if new.target_type = 'post' then
    update posts set like_count = like_count + 1 where id = new.target_id returning author_id into owner;
    pid := new.target_id;
  elsif new.target_type = 'comment' then
    update comments set like_count = like_count + 1 where id = new.target_id returning author_id, post_id into owner, pid;
  end if;
  if owner is not null then
    perform public.notify(owner, new.user_id, 'like', new.target_type, new.target_id,
                          jsonb_build_object('reaction', new.reaction, 'post_id', pid));
  end if;
  return new;
end $$;
create trigger reactions_after_insert after insert on public.reactions
  for each row execute function public.trg_reaction_added();

create or replace function public.trg_reaction_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.target_type = 'post' then
    update posts set like_count = greatest(like_count - 1, 0) where id = old.target_id;
  elsif old.target_type = 'comment' then
    update comments set like_count = greatest(like_count - 1, 0) where id = old.target_id;
  end if;
  return old;
end $$;
create trigger reactions_after_delete after delete on public.reactions
  for each row execute function public.trg_reaction_removed();

create or replace function public.trg_comment_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id); owner uuid;
begin
  update posts set comment_count = (select count(*) from comments where post_id = pid and removed_at is null)
   where id = pid returning author_id into owner;
  if tg_op = 'INSERT' then
    perform public.notify(owner, new.author_id, 'comment', 'post', pid,
                          jsonb_build_object('comment_id', new.id, 'preview', left(new.body, 80)));
  end if;
  return coalesce(new, old);
end $$;
create trigger comments_after after insert or delete or update of removed_at on public.comments
  for each row execute function public.trg_comment_changed();

-- ───────────────────────── Follows ─────────────────────────

create or replace function public.trg_follow_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.following_id, new.follower_id, 'follow', 'user', new.follower_id);
  return new;
end $$;
create trigger follows_after_insert after insert on public.follows
  for each row execute function public.trg_follow_added();

-- ───────────────────────── Blocking ─────────────────────────

create or replace function public.trg_block_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from friendships
   where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
      or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  delete from follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from top8
   where (user_id = new.blocker_id and friend_id = new.blocked_id)
      or (user_id = new.blocked_id and friend_id = new.blocker_id);
  delete from close_friends
   where (user_id = new.blocker_id and friend_id = new.blocked_id)
      or (user_id = new.blocked_id and friend_id = new.blocker_id);
  delete from dating_likes
   where (liker_id = new.blocker_id and liked_id = new.blocked_id)
      or (liker_id = new.blocked_id and liked_id = new.blocker_id);
  delete from matches where user_a = least(new.blocker_id, new.blocked_id)
                        and user_b = greatest(new.blocker_id, new.blocked_id);
  delete from notifications
   where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
      or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end $$;
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function public.trg_block_added();

-- ───────────────────────── Top 8 ─────────────────────────

create or replace function public.trg_top8_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.are_friends(new.user_id, new.friend_id) then
    raise exception 'Top 8 can only include your friends';
  end if;
  return new;
end $$;
create trigger top8_check before insert or update on public.top8
  for each row execute function public.trg_top8_check();

-- Unfriending removes the person from Top 8 / close friends.
create or replace function public.trg_friendship_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from top8 where (user_id = old.requester_id and friend_id = old.addressee_id)
                      or (user_id = old.addressee_id and friend_id = old.requester_id);
  delete from close_friends where (user_id = old.requester_id and friend_id = old.addressee_id)
                               or (user_id = old.addressee_id and friend_id = old.requester_id);
  return old;
end $$;
create trigger friendships_after_delete after delete on public.friendships
  for each row execute function public.trg_friendship_removed();

-- ───────────────────────── Groups ─────────────────────────

create or replace function public.trg_group_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_members (group_id, user_id, role, status) values (new.id, new.owner_id, 'owner', 'active');
  return new;
end $$;
create trigger groups_after_insert after insert on public.groups
  for each row execute function public.trg_group_created();

create or replace function public.trg_group_member_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare priv text; owner uuid;
begin
  select privacy, owner_id into priv, owner from groups where id = new.group_id and removed_at is null;
  if priv is null then raise exception 'Group not found'; end if;
  if new.role = 'member' then
    if public.is_blocked(new.user_id, owner) then raise exception 'You can''t join this group'; end if;
    new.status := case when priv = 'public' then 'active' else 'pending' end;
  end if;
  return new;
end $$;
create trigger group_members_before_insert before insert on public.group_members
  for each row execute function public.trg_group_member_before();

create or replace function public.trg_group_member_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid := coalesce(new.group_id, old.group_id); owner uuid;
begin
  update groups set member_count = (select count(*) from group_members where group_id = gid and status = 'active')
   where id = gid returning owner_id into owner;
  if tg_op = 'INSERT' and new.role = 'member' then
    perform public.notify(owner, new.user_id, 'group_activity', 'group', gid,
                          jsonb_build_object('kind', case when new.status = 'pending' then 'join_request' else 'joined' end));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.notify(new.user_id, owner, 'group_activity', 'group', gid, jsonb_build_object('kind', 'approved'));
  end if;
  return coalesce(new, old);
end $$;
create trigger group_members_after after insert or update or delete on public.group_members
  for each row execute function public.trg_group_member_after();

-- ───────────────────────── Events ─────────────────────────

create or replace function public.trg_attendee_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare eid uuid := coalesce(new.event_id, old.event_id); creator uuid;
begin
  update events set
    interested_count = (select count(*) from event_attendees where event_id = eid and status = 'interested'),
    going_count      = (select count(*) from event_attendees where event_id = eid and status = 'going')
   where id = eid returning creator_id into creator;
  if tg_op in ('INSERT','UPDATE') and new.status = 'going'
     and (tg_op = 'INSERT' or old.status is distinct from 'going') then
    perform public.notify(creator, new.user_id, 'event_activity', 'event', eid, jsonb_build_object('kind', 'going'));
  end if;
  return coalesce(new, old);
end $$;
create trigger attendees_after after insert or update or delete on public.event_attendees
  for each row execute function public.trg_attendee_after();

-- Creator is automatically "going".
create or replace function public.trg_event_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into event_attendees (event_id, user_id, status) values (new.id, new.creator_id, 'going');
  return new;
end $$;
create trigger events_after_insert after insert on public.events
  for each row execute function public.trg_event_created();

-- ───────────────────────── Messages ─────────────────────────

create or replace function public.trg_message_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare st text; init uuid; sent int;
begin
  perform public.enforce_rate_limit('message', 40, 60);
  select status, initiator_id into st, init from conversations where id = new.conversation_id;
  if st = 'request' and init = new.sender_id then
    select count(*) into sent from messages where conversation_id = new.conversation_id and sender_id = new.sender_id;
    if sent >= 3 then
      raise exception 'Wait for them to accept your message request before sending more.';
    end if;
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.trg_message_before();

create or replace function public.trg_message_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare other uuid;
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  update conversation_participants set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  select user_id into other from conversation_participants
   where conversation_id = new.conversation_id and user_id <> new.sender_id;
  perform public.notify(other, new.sender_id, 'message', 'conversation', new.conversation_id,
                        jsonb_build_object('preview', left(new.body, 80), 'has_media', new.media_path is not null));
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.trg_message_after();

-- ───────────────────────── Reports ─────────────────────────

create or replace function public.trg_report_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tu uuid; snap jsonb := '{}'; ctx jsonb;
begin
  perform public.enforce_rate_limit('report', 20, 3600);
  new.reporter_id := uid;
  new.status := 'open';

  if new.target_type = 'user' then
    select id, jsonb_build_object('username', username, 'display_name', display_name, 'bio', bio,
                                  'avatar_path', avatar_path, 'media_paths', to_jsonb(array_remove(array[avatar_path, cover_path], null)))
      into tu, snap from profiles where id = new.target_id;
  elsif new.target_type = 'post' then
    select author_id, jsonb_build_object('body', body, 'media_paths', to_jsonb(media_paths), 'audience', audience, 'location', location)
      into tu, snap from posts where id = new.target_id and public.can_view_content(author_id, audience, group_id);
  elsif new.target_type = 'comment' then
    select c.author_id, jsonb_build_object('body', c.body, 'post_id', c.post_id)
      into tu, snap from comments c
     where c.id = new.target_id and exists (select 1 from posts p where p.id = c.post_id and public.can_view_content(p.author_id, p.audience, p.group_id));
  elsif new.target_type = 'message' then
    select m.sender_id, jsonb_build_object('body', m.body, 'media_paths', to_jsonb(array_remove(array[m.media_path], null)),
                                          'conversation_id', m.conversation_id)
      into tu, snap from messages m
     where m.id = new.target_id and public.is_participant(m.conversation_id, uid);
    if tu is not null then
      select coalesce(jsonb_agg(x order by x->>'at'), '[]') into ctx from (
        select jsonb_build_object('sender_id', sender_id, 'body', body, 'at', created_at) x
          from messages where conversation_id = (snap->>'conversation_id')::uuid and removed_at is null
         order by created_at desc limit 10) q;
      snap := snap || jsonb_build_object('context', ctx);
    end if;
  elsif new.target_type = 'conversation' then
    select cp.user_id into tu from conversation_participants cp
     where cp.conversation_id = new.target_id and cp.user_id <> uid
       and public.is_participant(new.target_id, uid);
    if tu is not null then
      select coalesce(jsonb_agg(x order by x->>'at'), '[]') into ctx from (
        select jsonb_build_object('sender_id', sender_id, 'body', body, 'at', created_at) x
          from messages where conversation_id = new.target_id and removed_at is null
         order by created_at desc limit 20) q;
      snap := jsonb_build_object('context', ctx);
    end if;
  elsif new.target_type = 'story' then
    select author_id, jsonb_build_object('caption', caption, 'media_paths', to_jsonb(array[media_path]))
      into tu, snap from stories where id = new.target_id and public.can_view_story(author_id, audience, expires_at);
  elsif new.target_type = 'group' then
    select owner_id, jsonb_build_object('name', name, 'description', description)
      into tu, snap from groups where id = new.target_id and removed_at is null;
  elsif new.target_type = 'event' then
    select creator_id, jsonb_build_object('title', title, 'description', description)
      into tu, snap from events where id = new.target_id and public.can_view_event(creator_id, group_id, privacy, id);
  elsif new.target_type = 'album' then
    select owner_id, jsonb_build_object('title', title, 'description', description,
             'media_paths', coalesce((select to_jsonb(array_agg(path)) from album_media where album_id = albums.id), '[]'))
      into tu, snap from albums where id = new.target_id and public.can_view_album(owner_id, privacy);
  end if;

  if tu is null then raise exception 'That content isn''t available to report.'; end if;
  if tu = uid then raise exception 'You can''t report yourself.'; end if;
  new.target_user_id := tu;
  new.snapshot := snap;
  return new;
end $$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.trg_report_before();

-- Moderation audit log is append-only (FK null-outs from account deletion are allowed).
create or replace function public.trg_mod_actions_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'mod_actions is append-only'; end if;
  if (new.id, new.action, new.target_type, new.target_id, new.reason, new.created_at)
     is distinct from (old.id, old.action, old.target_type, old.target_id, old.reason, old.created_at) then
    raise exception 'mod_actions is append-only';
  end if;
  return new;
end $$;
create trigger mod_actions_immutable before update or delete on public.mod_actions
  for each row execute function public.trg_mod_actions_immutable();

-- ───────────────────────── Account lifecycle ─────────────────────────

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(p_username) ~ '^[a-z0-9_.]{3,24}$'
     and not exists (select 1 from profiles where lower(username) = lower(p_username));
$$;

-- Called once after sign-up. Age and terms are verified server-side from the
-- sign-up metadata, never trusted from the client's profile payload.
create or replace function public.register_profile(p_username text, p_display_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  meta jsonb; bd date;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from profiles where id = uid) then raise exception 'Profile already exists'; end if;
  select raw_user_meta_data into meta from auth.users where id = uid;
  begin bd := (meta->>'birthdate')::date; exception when others then bd := null; end;
  if bd is null then raise exception 'Birthdate is required.'; end if;
  if bd > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to join LICKD.' using errcode = 'P0403';
  end if;
  if coalesce(meta->>'accepted_terms', '') <> 'true' then
    raise exception 'You must accept the Terms, Privacy Policy and Community Guidelines.';
  end if;
  if not public.username_available(p_username) then
    raise exception 'That username is taken or invalid (3–24 letters, numbers, _ or .).';
  end if;
  insert into profiles (id, username, display_name) values (uid, lower(p_username), btrim(p_display_name));
  insert into profile_private (user_id, birthdate) values (uid, bd);
  insert into profile_customizations (user_id) values (uid);
end $$;

create or replace function public.touch_active() returns text
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  update profiles set status = 'active', suspended_until = null
   where id = auth.uid() and status = 'suspended' and suspended_until is not null and suspended_until <= now();
  update profiles set last_active_at = now() where id = auth.uid() returning status into st;
  return st;
end $$;

create or replace function public.deactivate_my_account() returns void
language sql security definer set search_path = public as $$
  update profiles set status = 'deactivated' where id = auth.uid() and status = 'active';
$$;

create or replace function public.reactivate_my_account() returns void
language sql security definer set search_path = public as $$
  update profiles set status = 'active' where id = auth.uid() and status = 'deactivated';
$$;

-- Permanently deletes the auth user; every row owned by the user cascades.
-- Reports about/by the user keep their snapshot but lose the user link.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

create or replace function public.track_event(p_name text, p_props jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into analytics_events (user_id, name, props) values (auth.uid(), left(p_name, 60), coalesce(p_props, '{}'));
$$;

-- ───────────────────────── Friends ─────────────────────────

create or replace function public.friend_ids(u uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select case when requester_id = u then addressee_id else requester_id end
    from friendships where status = 'accepted' and (requester_id = u or addressee_id = u);
$$;

create or replace function public.send_friend_request(p_target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); existing friendships%rowtype; wfr text; fid uuid;
begin
  if me is null or not public.auth_active() then raise exception 'Not allowed'; end if;
  if p_target = me then raise exception 'You can''t friend yourself'; end if;
  if public.is_blocked(me, p_target) or not public.author_active(p_target) then
    raise exception 'You can''t send a request to this person';
  end if;
  select who_can_friend into wfr from profiles where id = p_target;
  if wfr = 'nobody' then raise exception 'This person isn''t accepting friend requests'; end if;
  perform public.enforce_rate_limit('friend_request', 30, 3600);

  select * into existing from friendships
   where least(requester_id, addressee_id) = least(me, p_target)
     and greatest(requester_id, addressee_id) = greatest(me, p_target);
  if found then
    if existing.status = 'accepted' then return 'friends'; end if;
    if existing.requester_id = me then return 'request_sent'; end if;
    -- they already asked us: accept
    update friendships set status = 'accepted', responded_at = now() where id = existing.id;
    perform public.notify(p_target, me, 'friend_accept', 'user', me);
    return 'friends';
  end if;
  insert into friendships (requester_id, addressee_id) values (me, p_target) returning id into fid;
  perform public.notify(p_target, me, 'friend_request', 'friendship', fid);
  return 'request_sent';
end $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare f friendships%rowtype;
begin
  select * into f from friendships where id = p_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found'; end if;
  if p_accept then
    update friendships set status = 'accepted', responded_at = now() where id = p_id;
    perform public.notify(f.requester_id, f.addressee_id, 'friend_accept', 'user', f.addressee_id);
  else
    delete from friendships where id = p_id;
  end if;
end $$;

-- Cancels a pending request you sent, or removes an existing friend.
create or replace function public.remove_friend(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships
   where (requester_id = auth.uid() and addressee_id = p_user)
      or (requester_id = p_user and addressee_id = auth.uid() and status = 'accepted');
$$;

create or replace function public.get_friends(p_user uuid, p_limit int default 100, p_offset int default 0)
returns table (id uuid, username text, display_name text, avatar_path text, city text)
language sql stable as $$
  select p.id, p.username, p.display_name, p.avatar_path, case when p.show_city then p.city end
    from friendships f
    join profiles p on p.id = case when f.requester_id = p_user then f.addressee_id else f.requester_id end
   where f.status = 'accepted' and (f.requester_id = p_user or f.addressee_id = p_user)
   order by p.display_name
   limit least(p_limit, 200) offset p_offset;
$$;

create or replace function public.get_friend_requests()
returns table (id uuid, requester_id uuid, username text, display_name text, avatar_path text, created_at timestamptz,
               mutual_count int)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.username, p.display_name, p.avatar_path, f.created_at,
         (select count(*)::int from public.friend_ids(p.id) x where x in (select public.friend_ids(auth.uid())))
    from friendships f join profiles p on p.id = f.requester_id
   where f.addressee_id = auth.uid() and f.status = 'pending'
     and p.status = 'active' and not public.is_blocked(auth.uid(), p.id)
   order by f.created_at desc;
$$;

-- ───────────────────────── Profiles ─────────────────────────

create or replace function public.get_profile_summary(p_user uuid) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name,
    'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'bio', p.bio,
    'city', case when p.show_city or p.id = auth.uid() then p.city end,
    'pronouns', p.pronouns, 'interests', p.interests, 'intents', p.intents,
    'dating_enabled', p.dating_enabled, 'created_at', p.created_at,
    'follower_count', (select count(*) from follows where following_id = p.id),
    'following_count', (select count(*) from follows where follower_id = p.id),
    'friend_count', (select count(*) from public.friend_ids(p.id)),
    'post_count', (select count(*) from posts where author_id = p.id and group_id is null and audience = 'public'),
    'relationship', case
        when p.id = auth.uid() then 'self'
        when public.are_friends(auth.uid(), p.id) then 'friends'
        when exists (select 1 from friendships f where f.requester_id = auth.uid() and f.addressee_id = p.id and f.status = 'pending') then 'request_sent'
        when exists (select 1 from friendships f where f.addressee_id = auth.uid() and f.requester_id = p.id and f.status = 'pending') then 'request_received'
        else 'none' end,
    'friendship_id', (select f.id from friendships f
                       where least(f.requester_id, f.addressee_id) = least(auth.uid(), p.id)
                         and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p.id)),
    'following', exists (select 1 from follows where follower_id = auth.uid() and following_id = p.id),
    'muted', exists (select 1 from mutes where muter_id = auth.uid() and muted_id = p.id),
    'can_message', p.id <> auth.uid() and (p.who_can_message = 'everyone'
                     or (p.who_can_message = 'friends' and public.are_friends(auth.uid(), p.id))),
    'can_friend', p.id <> auth.uid() and p.who_can_friend = 'everyone',
    'customization', (select to_jsonb(c) from profile_customizations c where c.user_id = p.id),
    'top8', coalesce((select jsonb_agg(jsonb_build_object('position', t.position, 'id', f.id, 'username', f.username,
                                                          'display_name', f.display_name, 'avatar_path', f.avatar_path)
                                       order by t.position)
                        from top8 t join profiles f on f.id = t.friend_id where t.user_id = p.id), '[]')
  )
  from profiles p where p.id = p_user;
$$;

-- ───────────────────────── Feed ─────────────────────────

create or replace function public.get_feed(p_tab text default 'for_you', p_limit int default 20, p_offset int default 0)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  body text, media_paths text[], media_types text[], audience text, group_id uuid, group_name text,
  location text, like_count int, comment_count int, my_reaction text, created_at timestamptz
) language sql stable as $$
  select p.id, p.author_id, a.username, a.display_name, a.avatar_path,
         p.body, p.media_paths, p.media_types, p.audience, p.group_id, g.name,
         p.location, p.like_count, p.comment_count,
         (select r.reaction from reactions r where r.user_id = auth.uid() and r.target_type = 'post' and r.target_id = p.id),
         p.created_at
    from posts p
    join profiles a on a.id = p.author_id
    left join groups g on g.id = p.group_id
   where p.removed_at is null
     and not exists (select 1 from mutes m where m.muter_id = auth.uid() and m.muted_id = p.author_id)
     and case p_tab
           when 'following' then
             p.author_id = auth.uid()
             or exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.author_id)
             or public.are_friends(auth.uid(), p.author_id)
             or (p.group_id is not null and public.is_group_member(p.group_id))
           when 'trending' then
             p.audience = 'public' and p.created_at > now() - interval '7 days'
           else
             p.group_id is null
             or public.is_group_member(p.group_id)
         end
   order by
     case when p_tab = 'trending'
          then (p.like_count + 2 * p.comment_count + 1)
               / power(extract(epoch from now() - p.created_at) / 3600.0 + 2, 1.5) end desc nulls last,
     case when p_tab = 'for_you'
          then p.created_at + interval '4 hours' * ln(1 + p.like_count + 2 * p.comment_count)
          else p.created_at end desc
   limit least(p_limit, 50) offset p_offset;
$$;

create or replace function public.get_story_tray()
returns table (author_id uuid, username text, display_name text, avatar_path text,
               story_count int, has_unseen boolean, latest_at timestamptz)
language sql stable as $$
  select a.id, a.username, a.display_name, a.avatar_path,
         count(*)::int,
         bool_or(not exists (select 1 from story_views v where v.story_id = s.id and v.viewer_id = auth.uid())),
         max(s.created_at)
    from stories s join profiles a on a.id = s.author_id
   where s.removed_at is null and s.expires_at > now()
     and (s.author_id = auth.uid()
          or exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = s.author_id)
          or public.are_friends(auth.uid(), s.author_id))
     and not exists (select 1 from mutes m where m.muter_id = auth.uid() and m.muted_id = s.author_id)
   group by a.id, a.username, a.display_name, a.avatar_path
   order by (a.id = auth.uid()) desc, 6 desc, 7 desc;
$$;

-- ───────────────────────── Discover ─────────────────────────

create or replace function public.discover_people(
  p_q text default null, p_city text default null, p_intent text default null,
  p_mode text default 'search', p_limit int default 20, p_offset int default 0
) returns table (id uuid, username text, display_name text, avatar_path text, city text, pronouns text,
                 bio text, interests text[], mutual_count int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select id, city from profiles where id = auth.uid())
  select p.id, p.username, p.display_name, p.avatar_path,
         case when p.show_city then p.city end, p.pronouns, p.bio, p.interests,
         (select count(*)::int from public.friend_ids(p.id) x where x in (select public.friend_ids(auth.uid()))),
         p.created_at
    from profiles p, me
   where p.id <> me.id and p.status = 'active' and p.onboarded
     and not public.is_blocked(me.id, p.id)
     and (p.discoverability = 'everyone' or (p.discoverability = 'friends' and public.are_friends(me.id, p.id)))
     and (p_q is null or p_q = '' or p.username ilike '%' || p_q || '%' or p.display_name ilike '%' || p_q || '%')
     and (p_city is null or lower(p.city) = lower(p_city))
     and (p_intent is null or p_intent = any (p.intents))
     and (p_mode <> 'nearby' or (p.show_city and me.city is not null and lower(p.city) = lower(me.city)))
     and (p_mode <> 'friends' or 'Friends' = any (p.intents))
   order by case when p_mode = 'new' then p.created_at end desc nulls last,
            4 desc nulls last, p.last_active_at desc
   limit least(p_limit, 50) offset p_offset;
$$;

create or replace function public.discover_groups(p_q text default null, p_limit int default 20, p_offset int default 0)
returns table (id uuid, name text, description text, cover_path text, privacy text, member_count int, my_status text)
language sql stable as $$
  select g.id, g.name, g.description, g.cover_path, g.privacy, g.member_count,
         (select m.status from group_members m where m.group_id = g.id and m.user_id = auth.uid())
    from groups g
   where g.removed_at is null
     and (p_q is null or p_q = '' or g.name ilike '%' || p_q || '%' or g.description ilike '%' || p_q || '%')
   order by g.member_count desc, g.created_at desc
   limit least(p_limit, 50) offset p_offset;
$$;

create or replace function public.discover_events(p_q text default null, p_city text default null,
                                                  p_limit int default 20, p_offset int default 0)
returns table (id uuid, title text, description text, cover_path text, starts_at timestamptz, ends_at timestamptz,
               location text, city text, privacy text, going_count int, interested_count int,
               creator_id uuid, organizer text, group_id uuid, my_status text)
language sql stable as $$
  select e.id, e.title, e.description, e.cover_path, e.starts_at, e.ends_at, e.location, e.city, e.privacy,
         e.going_count, e.interested_count, e.creator_id, u.display_name, e.group_id,
         (select a.status from event_attendees a where a.event_id = e.id and a.user_id = auth.uid())
    from events e join profiles u on u.id = e.creator_id
   where e.removed_at is null and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
     and (p_q is null or p_q = '' or e.title ilike '%' || p_q || '%' or e.location ilike '%' || p_q || '%')
     and (p_city is null or lower(e.city) = lower(p_city))
   order by e.starts_at
   limit least(p_limit, 50) offset p_offset;
$$;

-- Places = check-in locations people have posted publicly.
create or replace function public.discover_places(p_q text default null, p_limit int default 20)
returns table (location text, post_count int, last_post_at timestamptz)
language sql stable as $$
  select p.location, count(*)::int, max(p.created_at)
    from posts p
   where p.location is not null and p.audience = 'public' and p.removed_at is null
     and p.created_at > now() - interval '90 days'
     and (p_q is null or p_q = '' or p.location ilike '%' || p_q || '%')
   group by p.location
   order by 2 desc, 3 desc
   limit least(p_limit, 50);
$$;

create or replace function public.trending_tags(p_limit int default 10)
returns table (tag text, post_count int)
language sql stable as $$
  select lower(m[1]), count(distinct p.id)::int
    from posts p, regexp_matches(p.body, '#([A-Za-z0-9_]{2,30})', 'g') as m
   where p.audience = 'public' and p.removed_at is null and p.created_at > now() - interval '7 days'
   group by 1 order by 2 desc, 1 limit least(p_limit, 30);
$$;

-- ───────────────────────── Messaging RPCs ─────────────────────────

create or replace function public.find_conversation(a uuid, b uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select c1.conversation_id from conversation_participants c1
    join conversation_participants c2 on c2.conversation_id = c1.conversation_id
   where c1.user_id = a and c2.user_id = b limit 1;
$$;

create or replace function public.open_conversation(p_other uuid, p_source text default 'direct') returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid; wcm text; st text;
begin
  if me is null or not public.auth_active() then raise exception 'Not allowed'; end if;
  if p_other = me then raise exception 'You can''t message yourself'; end if;
  if public.is_blocked(me, p_other) or not public.author_active(p_other) then
    raise exception 'You can''t message this person';
  end if;
  conv := public.find_conversation(me, p_other);
  if conv is not null then return conv; end if;
  select who_can_message into wcm from profiles where id = p_other;
  if wcm = 'nobody' then raise exception 'This person isn''t accepting messages'; end if;
  if wcm = 'friends' and not public.are_friends(me, p_other) then
    raise exception 'This person only accepts messages from friends';
  end if;
  perform public.enforce_rate_limit('conversation', 20, 3600);
  st := case when public.are_friends(me, p_other) then 'active' else 'request' end;
  insert into conversations (status, initiator_id, source) values (st, me, p_source) returning id into conv;
  insert into conversation_participants (conversation_id, user_id) values (conv, me), (conv, p_other);
  return conv;
end $$;

create or replace function public.respond_message_request(p_conversation uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update conversations set status = case when p_accept then 'active' else 'declined' end
   where id = p_conversation and status = 'request' and initiator_id <> auth.uid()
     and public.is_participant(id);
  if not found then raise exception 'Request not found'; end if;
end $$;

create or replace function public.get_conversations(p_requests boolean default false)
returns table (id uuid, status text, initiator_id uuid, source text, other_id uuid, username text, display_name text,
               avatar_path text, last_body text, last_has_media boolean, last_sender_id uuid,
               last_message_at timestamptz, unread_count int)
language sql stable security definer set search_path = public as $$
  select c.id, c.status, c.initiator_id, c.source, o.id, o.username, o.display_name, o.avatar_path,
         lm.body, lm.media_path is not null, lm.sender_id, c.last_message_at,
         (select count(*)::int from messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.removed_at is null
             and m.created_at > me.last_read_at)
    from conversations c
    join conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
    join conversation_participants op on op.conversation_id = c.id and op.user_id <> auth.uid()
    join profiles o on o.id = op.user_id
    left join lateral (select m.body, m.media_path, m.sender_id from messages m
                        where m.conversation_id = c.id and m.removed_at is null
                        order by m.created_at desc limit 1) lm on true
   where not public.is_blocked(auth.uid(), o.id)
     and o.status = 'active'
     and case when p_requests then c.status = 'request' and c.initiator_id <> auth.uid()
              else c.status = 'active' or (c.status = 'request' and c.initiator_id = auth.uid()) end
   order by c.last_message_at desc;
$$;

create or replace function public.reply_to_story(p_story uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); author uuid; conv uuid;
begin
  select author_id into author from stories
   where id = p_story and removed_at is null and public.can_view_story(author_id, audience, expires_at);
  if author is null then raise exception 'Story not available'; end if;
  conv := public.open_conversation(author, 'story');
  insert into messages (conversation_id, sender_id, body, story_id) values (conv, me, p_body, p_story);
  return conv;
end $$;

-- ───────────────────────── Dating ─────────────────────────

create or replace function public.dating_eligible(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p join profile_private pp on pp.user_id = p.id
                  where p.id = u and p.status = 'active' and p.dating_enabled and p.onboarded
                    and pp.birthdate <= current_date - interval '18 years');
$$;

create or replace function public.dating_candidates(p_view text default 'suggested', p_limit int default 20)
returns table (id uuid, username text, display_name text, avatar_path text, city text, pronouns text, bio text,
               headline text, looking_for text[], interests text[], age int, liked_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); my_city text; my_interests text[];
begin
  if not public.dating_eligible(me) then
    raise exception 'Turn on dating in your profile settings to see dating profiles.';
  end if;
  select p.city, p.interests into my_city, my_interests from profiles p where p.id = me;
  return query
    select p.id, p.username, p.display_name, p.avatar_path,
           case when p.show_city then p.city end, p.pronouns, p.bio, p.dating_headline, p.dating_looking_for, p.interests,
           date_part('year', age(pp.birthdate))::int,
           exists (select 1 from dating_likes d where d.liker_id = p.id and d.liked_id = me and d.kind = 'like')
      from profiles p join profile_private pp on pp.user_id = p.id
     where p.id <> me and public.dating_eligible(p.id)
       and p.discoverability = 'everyone'
       and not public.is_blocked(me, p.id)
       and not exists (select 1 from dating_likes d where d.liker_id = me and d.liked_id = p.id)
       and case p_view
             when 'nearby' then my_city is not null and p.show_city and lower(p.city) = lower(my_city)
             when 'new'    then p.created_at > now() - interval '14 days'
             when 'likes'  then exists (select 1 from dating_likes d where d.liker_id = p.id and d.liked_id = me and d.kind = 'like')
             else true end
     order by cardinality(array(select unnest(p.interests) intersect select unnest(my_interests))) desc,
              p.last_active_at desc
     limit least(p_limit, 50);
end $$;

create or replace function public.dating_swipe(p_target uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; conv uuid; mid uuid;
begin
  if p_kind not in ('like','pass') then raise exception 'Invalid action'; end if;
  if not public.dating_eligible(me) or not public.dating_eligible(p_target) then
    raise exception 'This profile isn''t available';
  end if;
  if public.is_blocked(me, p_target) then raise exception 'This profile isn''t available'; end if;
  perform public.enforce_rate_limit('dating_swipe', 300, 86400);

  insert into dating_likes (liker_id, liked_id, kind) values (me, p_target, p_kind)
  on conflict (liker_id, liked_id) do update set kind = excluded.kind, created_at = now();

  if p_kind = 'like' and exists (select 1 from dating_likes where liker_id = p_target and liked_id = me and kind = 'like') then
    a := least(me, p_target); b := greatest(me, p_target);
    select id, conversation_id into mid, conv from matches where user_a = a and user_b = b;
    if mid is null then
      conv := public.find_conversation(me, p_target);
      if conv is null then
        insert into conversations (status, initiator_id, source) values ('active', me, 'match') returning id into conv;
        insert into conversation_participants (conversation_id, user_id) values (conv, me), (conv, p_target);
      else
        update conversations set status = 'active' where id = conv;
      end if;
      insert into matches (user_a, user_b, conversation_id) values (a, b, conv) returning id into mid;
      perform public.notify(p_target, me, 'match', 'conversation', conv);
      perform public.notify(me, p_target, 'match', 'conversation', conv);
    end if;
    return jsonb_build_object('matched', true, 'conversation_id', conv);
  end if;
  return jsonb_build_object('matched', false);
end $$;

create or replace function public.get_matches()
returns table (match_id uuid, conversation_id uuid, user_id uuid, username text, display_name text,
               avatar_path text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.conversation_id, p.id, p.username, p.display_name, p.avatar_path, m.created_at
    from matches m join profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
   where (m.user_a = auth.uid() or m.user_b = auth.uid())
     and p.status = 'active' and not public.is_blocked(auth.uid(), p.id)
   order by m.created_at desc;
$$;

-- ───────────────────────── Scheduled jobs ─────────────────────────

create or replace function public.send_event_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    select a.event_id, a.user_id, e.title, e.starts_at
      from event_attendees a join events e on e.id = a.event_id
     where a.reminded_at is null and e.removed_at is null
       and e.starts_at between now() and now() + interval '24 hours'
  loop
    perform public.notify(r.user_id, null, 'event_reminder', 'event', r.event_id,
                          jsonb_build_object('title', r.title, 'starts_at', r.starts_at));
    update event_attendees set reminded_at = now() where event_id = r.event_id and user_id = r.user_id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.lift_expired_suspensions() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update profiles set status = 'active', suspended_until = null
   where status = 'suspended' and suspended_until is not null and suspended_until <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- Deletes stories (and their rows' references) 1 day after expiry. Storage objects
-- are removed by the purge-media Edge Function / Storage API, not by SQL.
create or replace function public.purge_expired_stories() returns setof text
language plpgsql security definer set search_path = public as $$
begin
  return query delete from stories where expires_at < now() - interval '1 day' returning media_path;
end $$;

create or replace function public.purge_rate_events() returns void
language sql security definer set search_path = public as $$
  delete from rate_events where created_at < now() - interval '2 days';
$$;

-- ───────────────────────── Moderation ─────────────────────────

create or replace function public.log_mod_action(
  p_action text, p_target_type text, p_target_id uuid, p_target_user uuid, p_report uuid, p_reason text
) returns void language sql security definer set search_path = public as $$
  insert into mod_actions (moderator_id, action, target_type, target_id, target_user_id, report_id, reason)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_target_user, p_report, p_reason);
$$;

-- Moderators can act on normal users; only admins can act on staff.
create or replace function public.assert_can_moderate(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select role into r from profiles where id = p_user;
  if r in ('moderator','admin') and not public.is_admin() then
    raise exception 'Only admins can take action on staff accounts' using errcode = '42501';
  end if;
  if p_user = auth.uid() then raise exception 'You can''t take moderation action on yourself'; end if;
end $$;

create or replace function public.apply_content_removal(p_type text, p_id uuid, p_restore boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare owner uuid; ts timestamptz := case when p_restore then null else now() end;
begin
  if p_type = 'post' then update posts set removed_at = ts where id = p_id returning author_id into owner;
  elsif p_type = 'comment' then update comments set removed_at = ts where id = p_id returning author_id into owner;
  elsif p_type = 'message' then update messages set removed_at = ts where id = p_id returning sender_id into owner;
  elsif p_type = 'story' then update stories set removed_at = ts where id = p_id returning author_id into owner;
  elsif p_type = 'group' then update groups set removed_at = ts where id = p_id returning owner_id into owner;
  elsif p_type = 'event' then update events set removed_at = ts where id = p_id returning creator_id into owner;
  elsif p_type = 'album' then update albums set removed_at = ts where id = p_id returning owner_id into owner;
  else raise exception 'This kind of content can''t be removed directly';
  end if;
  if owner is null then raise exception 'Content not found'; end if;
  return owner;
end $$;

create or replace function public.mod_remove_content(p_type text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  owner := public.apply_content_removal(p_type, p_id, false);
  perform public.log_mod_action('remove_content', p_type, p_id, owner, null, p_reason);
  perform public.notify(owner, null, 'moderation', p_type, p_id,
                        jsonb_build_object('kind', 'content_removed', 'reason', p_reason));
end $$;

create or replace function public.mod_restore_content(p_type text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  owner := public.apply_content_removal(p_type, p_id, true);
  perform public.log_mod_action('restore_content', p_type, p_id, owner, null, p_reason);
end $$;

create or replace function public.apply_user_status(p_user uuid, p_status text, p_days int, p_reason text, p_report uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_can_moderate(p_user);
  if p_status = 'banned' and not public.is_admin() then
    raise exception 'Only admins can ban accounts' using errcode = '42501';
  end if;
  if p_status not in ('active','suspended','banned') then raise exception 'Invalid status'; end if;
  update profiles set status = p_status,
         suspended_until = case when p_status = 'suspended' then now() + make_interval(days => greatest(coalesce(p_days, 3), 1)) end
   where id = p_user;
  perform public.log_mod_action(case p_status when 'active' then 'reinstate' when 'suspended' then 'suspend' else 'ban' end,
                                'user', p_user, p_user, p_report, p_reason);
  if p_status <> 'active' then
    perform public.notify(p_user, null, 'moderation', 'user', p_user,
                          jsonb_build_object('kind', p_status, 'reason', p_reason, 'days', p_days));
  end if;
end $$;

create or replace function public.mod_set_user_status(p_user uuid, p_status text, p_days int, p_reason text) returns void
language sql security definer set search_path = public as $$
  select public.apply_user_status(p_user, p_status, p_days, p_reason, null);
$$;

create or replace function public.mod_mark_reviewing(p_report uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  update reports set status = 'reviewing', moderator_id = auth.uid() where id = p_report and status = 'open';
end $$;

-- p_action: none | remove_content | warn | suspend | ban
create or replace function public.mod_resolve_report(
  p_report uuid, p_outcome text, p_action text, p_reason text, p_suspend_days int default 3
) returns void language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_outcome not in ('resolved','dismissed') then raise exception 'Invalid outcome'; end if;
  select * into r from reports where id = p_report and status in ('open','reviewing') for update;
  if not found then raise exception 'Report not found or already closed'; end if;

  if p_outcome = 'resolved' then
    if p_action = 'remove_content' then
      perform public.apply_content_removal(r.target_type, r.target_id, false);
      perform public.log_mod_action('remove_content', r.target_type, r.target_id, r.target_user_id, r.id, p_reason);
      perform public.notify(r.target_user_id, null, 'moderation', r.target_type, r.target_id,
                            jsonb_build_object('kind', 'content_removed', 'reason', p_reason));
    elsif p_action = 'warn' then
      perform public.assert_can_moderate(r.target_user_id);
      perform public.log_mod_action('warn', 'user', r.target_user_id, r.target_user_id, r.id, p_reason);
      perform public.notify(r.target_user_id, null, 'moderation', 'user', r.target_user_id,
                            jsonb_build_object('kind', 'warning', 'reason', p_reason));
    elsif p_action = 'suspend' then
      perform public.apply_user_status(r.target_user_id, 'suspended', p_suspend_days, p_reason, r.id);
    elsif p_action = 'ban' then
      perform public.apply_user_status(r.target_user_id, 'banned', null, p_reason, r.id);
    end if;
  else
    perform public.log_mod_action('dismiss_report', r.target_type, r.target_id, r.target_user_id, r.id, p_reason);
  end if;

  update reports set status = p_outcome, moderator_id = auth.uid(), resolved_at = now(),
         resolution = case when p_outcome = 'dismissed' then 'no_violation' else p_action end
   where id = r.id;
  perform public.notify(r.reporter_id, null, 'report_update', 'report', r.id,
                        jsonb_build_object('outcome', p_outcome));
end $$;

create or replace function public.mod_resolve_appeal(p_appeal uuid, p_decision text, p_response text) returns void
language plpgsql security definer set search_path = public as $$
declare a appeals%rowtype;
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_decision not in ('upheld','denied') then raise exception 'Invalid decision'; end if;
  select * into a from appeals where id = p_appeal and status = 'pending' for update;
  if not found then raise exception 'Appeal not found'; end if;
  if p_decision = 'upheld' then
    perform public.apply_user_status(a.user_id, 'active', null, 'Appeal upheld: ' || coalesce(p_response, ''), null);
  else
    perform public.assert_can_moderate(a.user_id);
  end if;
  update appeals set status = p_decision, response = p_response, reviewed_by = auth.uid(), resolved_at = now()
   where id = a.id;
  perform public.log_mod_action('resolve_appeal', 'appeal', a.id, a.user_id, null, p_decision || ': ' || coalesce(p_response, ''));
  perform public.notify(a.user_id, null, 'moderation', 'appeal', a.id,
                        jsonb_build_object('kind', 'appeal_' || p_decision, 'reason', p_response));
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  if p_role not in ('user','moderator','admin') then raise exception 'Invalid role'; end if;
  if p_user = auth.uid() then raise exception 'You can''t change your own role'; end if;
  update profiles set role = p_role where id = p_user;
  perform public.log_mod_action('set_role', 'user', p_user, p_user, null, p_role);
end $$;

create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users', (select count(*) from profiles),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'onboarded_users', (select count(*) from profiles where onboarded),
    'dau', (select count(*) from profiles where last_active_at > now() - interval '1 day'),
    'wau', (select count(*) from profiles where last_active_at > now() - interval '7 days'),
    'mau', (select count(*) from profiles where last_active_at > now() - interval '30 days'),
    'posts_7d', (select count(*) from posts where created_at > now() - interval '7 days'),
    'comments_7d', (select count(*) from comments where created_at > now() - interval '7 days'),
    'messages_7d', (select count(*) from messages where created_at > now() - interval '7 days'),
    'stories_7d', (select count(*) from stories where created_at > now() - interval '7 days'),
    'groups', (select count(*) from groups where removed_at is null),
    'events_upcoming', (select count(*) from events where removed_at is null and starts_at > now()),
    'matches_7d', (select count(*) from matches where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from reports where status in ('open','reviewing')),
    'reports_7d', (select count(*) from reports where created_at > now() - interval '7 days'),
    'avg_resolution_hours_30d', (select round((avg(extract(epoch from resolved_at - created_at)) / 3600)::numeric, 1)
                                   from reports where resolved_at > now() - interval '30 days'),
    'suspended_users', (select count(*) from profiles where status in ('suspended','banned')),
    'appeals_pending', (select count(*) from appeals where status = 'pending'),
    'signups_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d)
                                  from (select date_trunc('day', created_at)::date d, count(*) c from profiles
                                         where created_at > now() - interval '14 days' group by 1) s), '[]')
  );
end $$;

-- ===== supabase/migrations/0005_storage.sql =====
-- Storage buckets and access rules.
--   avatars : public bucket for avatars, covers, group/event covers (non-sensitive, CDN-cached)
--   media   : PRIVATE bucket for post/story/album/message media; served via signed URLs,
--             readable only when public.can_read_media(path) says the viewer may see the content.
-- Object paths are always  <owner uuid>/<random>.<ext>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('media',   'media',   false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and public.auth_active());
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.can_read_media(name));
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and public.auth_active());
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== supabase/migrations/0006_realtime_cron.sql =====
-- Realtime: RLS still applies to what each subscriber receives.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications,
      public.conversations, public.conversation_participants;
  end if;
exception when duplicate_object then null;
end $$;

-- Scheduled jobs (requires the pg_cron extension: Dashboard → Database → Extensions).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lickd-event-reminders',  '*/15 * * * *', 'select public.send_event_reminders()');
    perform cron.schedule('lickd-lift-suspensions', '*/10 * * * *', 'select public.lift_expired_suspensions()');
    perform cron.schedule('lickd-purge-stories',    '17 * * * *',   'select public.purge_expired_stories()');
    perform cron.schedule('lickd-purge-rate',       '23 3 * * *',   'select public.purge_rate_events()');
  end if;
end $$;

-- ===== supabase/migrations/0007_grants.sql =====
-- Least-privilege grants. Run last. RLS is the real gate; these grants add a
-- second layer so clients can only touch the columns/operations the app needs.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

-- Reads (RLS filters rows)
grant select on all tables in schema public to authenticated;
revoke select on public.dating_likes, public.rate_events, public.analytics_events from authenticated;

-- Inserts (column-restricted where the server owns other columns)
grant insert (author_id, body, media_paths, media_types, audience, group_id, location) on public.posts to authenticated;
grant insert (post_id, author_id, body) on public.comments to authenticated;
grant insert (user_id, target_type, target_id, reaction) on public.reactions to authenticated;
grant insert (conversation_id, sender_id, body, media_path, media_type) on public.messages to authenticated;
grant insert (owner_id, name, description, cover_path, privacy) on public.groups to authenticated;
grant insert (group_id, user_id, role) on public.group_members to authenticated;
grant insert (creator_id, group_id, title, description, cover_path, starts_at, ends_at, location, city, privacy) on public.events to authenticated;
grant insert (event_id, user_id, status) on public.event_attendees to authenticated;
grant insert (author_id, media_path, media_type, caption, audience) on public.stories to authenticated;
grant insert (story_id, viewer_id) on public.story_views to authenticated;
grant insert (owner_id, title, description, cover_path, privacy) on public.albums to authenticated;
grant insert (album_id, path, sort_order) on public.album_media to authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;
grant insert on public.blocks, public.mutes, public.close_friends, public.top8, public.profile_customizations to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;
grant insert (user_id, message) on public.appeals to authenticated;
grant insert (user_id, name, props) on public.analytics_events to authenticated;

-- Updates
grant update (username, display_name, avatar_path, cover_path, bio, city, show_city, pronouns, interests, intents,
              dating_enabled, dating_headline, dating_looking_for, discoverability, who_can_message,
              who_can_friend, onboarded) on public.profiles to authenticated;
grant update (push_token) on public.profile_private to authenticated;
grant update on public.profile_customizations to authenticated;
grant update (position, friend_id) on public.top8 to authenticated;
grant update (body) on public.posts to authenticated;
grant update (reaction) on public.reactions to authenticated;
grant update (last_read_at) on public.conversation_participants to authenticated;
grant update (name, description, cover_path, privacy) on public.groups to authenticated;
grant update (role, status) on public.group_members to authenticated;
grant update (title, description, cover_path, starts_at, ends_at, location, city, privacy) on public.events to authenticated;
grant update (status) on public.event_attendees to authenticated;
grant update (title, description, cover_path, privacy) on public.albums to authenticated;
grant update (sort_order) on public.album_media to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Deletes
grant delete on public.follows, public.blocks, public.mutes, public.close_friends, public.top8,
                public.profile_customizations, public.groups, public.group_members, public.events,
                public.event_attendees, public.posts, public.comments, public.reactions, public.messages,
                public.stories, public.albums, public.album_media, public.notifications to authenticated;

-- Functions: callable by signed-in users…
grant execute on all functions in schema public to authenticated;
-- …except internal ones (called only by triggers, cron, or other definer functions).
revoke execute on function
  public.notify(uuid, uuid, text, text, uuid, jsonb),
  public.apply_content_removal(text, uuid, boolean),
  public.log_mod_action(text, text, uuid, uuid, uuid, text),
  public.find_conversation(uuid, uuid),
  public.dating_eligible(uuid),
  public.send_event_reminders(),
  public.lift_expired_suspensions(),
  public.purge_expired_stories(),
  public.purge_rate_events()
from authenticated;

-- ===== supabase/migrations/0008_conversation_lookup.sql =====
-- Single-conversation lookup for the chat screen header (same shape as get_conversations).
create or replace function public.get_conversation(p_id uuid)
returns table (id uuid, status text, initiator_id uuid, source text, other_id uuid, username text, display_name text,
               avatar_path text, last_message_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.status, c.initiator_id, c.source, o.id, o.username, o.display_name, o.avatar_path, c.last_message_at
    from conversations c
    join conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
    join conversation_participants op on op.conversation_id = c.id and op.user_id <> auth.uid()
    join profiles o on o.id = op.user_id
   where c.id = p_id and not public.is_blocked(auth.uid(), o.id);
$$;
grant execute on function public.get_conversation(uuid) to authenticated;

-- ===== supabase/migrations/0009_blocked_users.sql =====
-- Blocked profiles are hidden from the blocker by RLS (that is the point of a block),
-- so the "Blocked users" settings list needs a definer function to show who they are.
create or replace function public.get_blocked_users()
returns table (id uuid, username text, display_name text, avatar_path text, city text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_path, null::text, b.created_at
    from blocks b join profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;
grant execute on function public.get_blocked_users() to authenticated;

