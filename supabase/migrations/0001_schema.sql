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
