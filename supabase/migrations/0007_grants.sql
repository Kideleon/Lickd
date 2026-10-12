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
