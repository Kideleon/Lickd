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
