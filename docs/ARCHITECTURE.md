# Architecture

**Client → Supabase.** The app uses supabase-js with the anon key. There is no custom API server.

**Authorization lives in Postgres.**
- Row Level Security is on for every table with default-deny policies.
- Table and column grants (`0007`) limit what a client can insert or update. Counters, roles, status and timestamps can't be set by clients.
- Anything with business rules is a `SECURITY DEFINER` RPC: registering a profile (age gate), swiping, answering message requests, moderation, account deletion.
- Suspended, banned and deactivated accounts get restrictive policies that make them read-only.

**Media.** `avatars` is public. `media` is private and read through signed URLs; `can_read_media(path)` grants access only to people who may see the post, story, album or message holding the file. Uploads must go under `<uid>/`.

**Messaging.** One-to-one only. First contact is a request; the sender is capped at 3 messages until it's accepted.

**Dating.** Opt-in and adults only. A mutual like creates a match and a conversation.

**Moderation.** Reports store a snapshot of the content at report time. Actions go through RPCs that write to an append-only `mod_actions` log. Moderators can warn, remove content and suspend; only admins ban or change roles. Members can appeal.

**Realtime and jobs.** Realtime `postgres_changes` for chat and notifications. pg_cron for reminders, suspension expiry and data purges. Push goes through the `send-push` Edge Function.

**Theming.** `app/src/theme.tsx` holds the light and dark palettes, a stored preference (system, light, dark), and the profile customization overrides. Components read colors through `useTheme` / `useStyles`; avoid hard-coded colors.
