import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const LABELS: Record<string, string> = {
  total_users: 'Members', new_users_7d: 'New (7 days)', onboarded_users: 'Finished onboarding', dau: 'Active today', wau: 'Active this week', mau: 'Active this month',
  posts_7d: 'Posts (7 days)', comments_7d: 'Comments (7 days)', messages_7d: 'Messages (7 days)', stories_7d: 'Stories (7 days)',
  groups: 'Groups', events_upcoming: 'Upcoming events', matches_7d: 'Matches (7 days)', reports_open: 'Open reports', reports_7d: 'Reports (7 days)',
};

export function Dashboard() {
  const [m, setM] = useState<Record<string, number> | null>(null); const [err, setErr] = useState('');
  useEffect(() => { supabase.rpc('admin_metrics').then(({ data, error }) => error ? setErr(error.message) : setM(data as Record<string, number>)); }, []);
  if (err) return <p className="err">{err}</p>;
  if (!m) return <p>Loading…</p>;
  return <div className="grid">{Object.entries(m).map(([k, v]) => <div className="card stat" key={k}><b>{String(v)}</b><span className="muted">{LABELS[k] ?? k}</span></div>)}</div>;
}
