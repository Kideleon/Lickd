import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

type L = { id: string; action: string; target_type: string | null; reason: string | null; created_at: string; moderator: { username: string } | null; target_user: { username: string } | null };

export function Audit() {
  const [rows, setRows] = useState<L[]>([]); const [err, setErr] = useState('');
  useEffect(() => {
    supabase.from('mod_actions').select('id,action,target_type,reason,created_at,moderator:moderator_id(username),target_user:target_user_id(username)').order('created_at', { ascending: false }).limit(100)
      .then(({ data, error }) => error ? setErr(error.message) : setRows((data ?? []) as unknown as L[]));
  }, []);
  return (<div className="card">{err && <p className="err">{err}</p>}
    <table><thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Member</th><th>Reason</th></tr></thead><tbody>
      {rows.map((l) => <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>@{l.moderator?.username ?? '—'}</td><td>{l.action}{l.target_type ? ` (${l.target_type})` : ''}</td><td>{l.target_user ? `@${l.target_user.username}` : '—'}</td><td>{l.reason}</td></tr>)}
    </tbody></table>{rows.length === 0 && !err && <p className="muted">No actions logged yet.</p>}</div>);
}
