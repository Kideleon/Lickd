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
