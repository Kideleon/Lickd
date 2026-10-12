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
