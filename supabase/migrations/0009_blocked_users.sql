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
