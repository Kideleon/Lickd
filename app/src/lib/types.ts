export type Audience = 'public' | 'friends' | 'group';
export type StoryAudience = 'everyone' | 'friends' | 'close_friends';
export type AccountStatus = 'active' | 'suspended' | 'banned' | 'deactivated';
export type Relationship = 'self' | 'friends' | 'request_sent' | 'request_received' | 'none';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  cover_path: string | null;
  bio: string;
  city: string | null;
  show_city: boolean;
  pronouns: string | null;
  interests: string[];
  intents: string[];
  dating_enabled: boolean;
  dating_headline: string | null;
  dating_looking_for: string[];
  discoverability: 'everyone' | 'unlisted' | 'friends';
  who_can_message: 'everyone' | 'friends' | 'nobody';
  who_can_friend: 'everyone' | 'nobody';
  role: 'user' | 'moderator' | 'admin';
  status: AccountStatus;
  suspended_until: string | null;
  onboarded: boolean;
}

export interface Customization {
  user_id: string;
  theme: string;
  background_color: string | null;
  background_path: string | null;
  accent_color: string | null;
  font: 'default' | 'display' | 'mono' | 'script';
  layout: 'classic' | 'compact' | 'showcase';
  music_title: string | null;
  music_artist: string | null;
  music_url: string | null;
  featured_paths: string[];
}

export interface Top8Entry {
  position: number;
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
}

export interface ProfileSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  cover_path: string | null;
  bio: string;
  city: string | null;
  pronouns: string | null;
  interests: string[];
  intents: string[];
  dating_enabled: boolean;
  created_at: string;
  follower_count: number;
  following_count: number;
  friend_count: number;
  post_count: number;
  relationship: Relationship;
  friendship_id: string | null;
  following: boolean;
  muted: boolean;
  can_message: boolean;
  can_friend: boolean;
  customization: Customization | null;
  top8: Top8Entry[];
}

export interface PersonCard {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  city: string | null;
  pronouns?: string | null;
  bio?: string;
  interests?: string[];
  mutual_count?: number;
}

export interface Post {
  id: string;
  author_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  body: string;
  media_paths: string[];
  media_types: string[];
  audience: Audience;
  group_id: string | null;
  group_name: string | null;
  location: string | null;
  like_count: number;
  comment_count: number;
  my_reaction: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { username: string; display_name: string; avatar_path: string | null } | null;
}

export interface StoryTrayItem {
  author_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  story_count: number;
  has_unseen: boolean;
  latest_at: string;
}

export interface Story {
  id: string;
  author_id: string;
  media_path: string;
  media_type: 'image' | 'video';
  caption: string | null;
  audience: StoryAudience;
  created_at: string;
  expires_at: string;
}

export interface Conversation {
  id: string;
  status: 'active' | 'request' | 'declined';
  initiator_id: string;
  source: 'direct' | 'match' | 'story';
  other_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  last_body?: string | null;
  last_has_media?: boolean;
  last_sender_id?: string | null;
  last_message_at: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  media_path: string | null;
  media_type: 'image' | 'video' | null;
  story_id: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  cover_path: string | null;
  privacy: 'public' | 'private';
  member_count: number;
  my_status?: 'active' | 'pending' | 'banned' | null;
  owner_id?: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned';
  profile: { id: string; username: string; display_name: string; avatar_path: string | null } | null;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  cover_path: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  city: string | null;
  privacy: 'public' | 'private';
  going_count: number;
  interested_count: number;
  creator_id: string;
  organizer?: string;
  group_id: string | null;
  my_status?: 'interested' | 'going' | null;
}

export interface Album {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  cover_path: string | null;
  privacy: 'public' | 'friends' | 'private';
  created_at: string;
}

export interface AlbumMedia {
  id: string;
  album_id: string;
  path: string;
  sort_order: number;
}

export interface NotificationItem {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string | null;
  target_id: string | null;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
  actor: { username: string; display_name: string; avatar_path: string | null } | null;
}

export interface DatingCandidate {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  city: string | null;
  pronouns: string | null;
  bio: string;
  headline: string | null;
  looking_for: string[];
  interests: string[];
  age: number;
  liked_me: boolean;
}

export interface MatchItem {
  match_id: string;
  conversation_id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
  mutual_count: number;
}

export interface MyReport {
  id: string;
  target_type: string;
  reason: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
  resolved_at: string | null;
}

export type ReportTarget =
  | 'user' | 'post' | 'comment' | 'message' | 'conversation' | 'story' | 'group' | 'event' | 'album';

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'explicit', label: 'Explicit or unwanted sexual content' },
  { key: 'spam', label: 'Spam' },
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'underage', label: 'Someone under 18' },
  { key: 'self_harm', label: 'Self-harm or danger' },
  { key: 'other', label: 'Something else' },
];

export const INTERESTS = [
  'Music', 'Art', 'Fashion', 'Gaming', 'Fitness', 'Travel', 'Food', 'Books', 'Film', 'Photography',
  'Dancing', 'Poetry', 'Faith', 'Tech', 'Outdoors', 'Nightlife', 'Wellness', 'Activism', 'Sports', 'Comedy',
];

export const INTENTS = ['Friends', 'Community', 'Dating', 'Events', 'Networking'];
export const LOOKING_FOR = ['Relationship', 'Something casual', 'New friends', 'Not sure yet'];
