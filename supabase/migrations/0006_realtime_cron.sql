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
