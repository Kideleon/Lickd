// Sends an Expo push notification when a row is inserted into public.notifications.
// Wire it up as a Database Webhook (INSERT on notifications) with the header
//   x-webhook-secret: <PUSH_WEBHOOK_SECRET>
// Secrets: PUSH_WEBHOOK_SECRET. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type Notification = { id: string; recipient_id: string; actor_id: string | null; type: string; target_type: string | null; target_id: string | null; data: Record<string, unknown> };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET');

// Lock-screen text is deliberately generic: message bodies and post text never go through the push provider.
function copy(n: Notification, actor: string): { title: string; body: string } {
  switch (n.type) {
    case 'like': return { title: 'LICKD', body: `${actor} liked your post` };
    case 'comment': return { title: 'LICKD', body: `${actor} commented on your post` };
    case 'follow': return { title: 'LICKD', body: `${actor} started following you` };
    case 'friend_request': return { title: 'LICKD', body: `${actor} sent you a friend request` };
    case 'friend_accept': return { title: 'LICKD', body: `${actor} accepted your friend request` };
    case 'message': return { title: 'LICKD', body: `New message from ${actor}` };
    case 'match': return { title: "It's a match", body: `You and ${actor} liked each other` };
    case 'event_reminder': return { title: 'Event reminder', body: 'An event you\'re going to starts soon' };
    case 'event_activity': return { title: 'LICKD', body: `${actor} is going to your event` };
    case 'group_activity': return { title: 'LICKD', body: 'There\'s news in one of your groups' };
    case 'moderation': return { title: 'LICKD', body: 'You have a message from the LICKD team' };
    default: return { title: 'LICKD', body: 'You have a new notification' };
  }
}

function route(n: Notification): string {
  switch (n.target_type) {
    case 'post': return `/post/${n.target_id}`;
    case 'event': return `/event/${n.target_id}`;
    case 'group': return `/group/${n.target_id}`;
    case 'conversation': return `/chat/${n.target_id}`;
    case 'user': return `/user/${n.target_id}`;
    default: return '/notifications';
  }
}

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-webhook-secret') !== SECRET) return new Response('Unauthorized', { status: 401 });
  const payload = await req.json().catch(() => null);
  const n = payload?.record as Notification | undefined;
  if (!n?.recipient_id) return new Response('Bad payload', { status: 400 });

  const [{ data: priv }, { data: actor }] = await Promise.all([
    admin.from('profile_private').select('push_token').eq('user_id', n.recipient_id).maybeSingle(),
    n.actor_id ? admin.from('profiles').select('display_name').eq('id', n.actor_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const token = priv?.push_token as string | undefined;
  if (!token || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) return new Response('No token', { status: 200 });

  const { count } = await admin.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', n.recipient_id).is('read_at', null);
  const { title, body } = copy(n, (actor?.display_name as string | undefined) ?? 'Someone');
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default', badge: count ?? 0, data: { route: route(n), notificationId: n.id } }),
  });
  const out = await res.json().catch(() => ({}));
  // A dead token (app uninstalled) is cleared so we stop sending to it.
  if (out?.data?.status === 'error' && out.data.details?.error === 'DeviceNotRegistered') {
    await admin.from('profile_private').update({ push_token: null }).eq('user_id', n.recipient_id);
  }
  return new Response(JSON.stringify({ ok: res.ok }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
