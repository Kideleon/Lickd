import React, { useState } from 'react';
import { supabase, Role } from '../supabase';

type U = { id: string; username: string; display_name: string; role: Role; status: string; suspended_until: string | null; created_at: string; last_active_at: string };

export function Users({ isAdmin, myId }: { isAdmin: boolean; myId: string }) {
  const [q, setQ] = useState(''); const [rows, setRows] = useState<U[]>([]); const [err, setErr] = useState(''); const [note, setNote] = useState('');
  const search = async (e?: React.FormEvent) => {
    e?.preventDefault(); setErr('');
    const term = q.trim().replace(/[%,()]/g, '');
    let query = supabase.from('profiles').select('id,username,display_name,role,status,suspended_until,created_at,last_active_at').order('created_at', { ascending: false }).limit(30);
    if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
    const { data, error } = await query;
    if (error) setErr(error.message); else setRows((data ?? []) as U[]);
  };
  const setStatus = async (u: U, status: string) => {
    const reason = window.prompt(`Reason for setting @${u.username} to ${status}? (logged)`);
    if (!reason?.trim()) return;
    const days = status === 'suspended' ? Number(window.prompt('Suspend for how many days?', '3')) || 3 : null;
    if (status === 'banned' && !window.confirm(`Permanently ban @${u.username}?`)) return;
    const { error } = await supabase.rpc('mod_set_user_status', { p_user: u.id, p_status: status, p_days: days, p_reason: reason.trim() });
    if (error) setErr(error.message); else { setNote(`@${u.username} is now ${status}.`); search(); }
  };
  const setRole = async (u: U, role: string) => {
    const { error } = await supabase.rpc('admin_set_role', { p_user: u.id, p_role: role });
    if (error) setErr(error.message); else { setNote(`@${u.username} is now ${role}.`); search(); }
  };
  return (<>
    <form className="row" onSubmit={search} style={{ marginBottom: 12 }}>
      <input className="grow" aria-label="Search members" placeholder="Search username or name" value={q} onChange={(e) => setQ(e.target.value)} /><button className="primary">Search</button>
    </form>
    {err && <p className="err" role="alert">{err}</p>}{note && <p>{note}</p>}
    <div className="card"><table><thead><tr><th>Member</th><th>Status</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
      {rows.map((u) => (
        <tr key={u.id}>
          <td><b>{u.display_name}</b><br /><span className="muted">@{u.username}</span></td>
          <td>{u.status}{u.suspended_until ? <><br /><span className="muted">until {new Date(u.suspended_until).toLocaleDateString()}</span></> : null}</td>
          <td>{isAdmin && u.id !== myId ? <select aria-label={`Role for ${u.username}`} value={u.role} onChange={(e) => setRole(u, e.target.value)}><option>user</option><option>moderator</option><option>admin</option></select> : u.role}</td>
          <td>{new Date(u.created_at).toLocaleDateString()}</td>
          <td className="row">
            {u.id !== myId && u.status === 'active' && <button onClick={() => setStatus(u, 'suspended')}>Suspend</button>}
            {u.id !== myId && u.status === 'active' && isAdmin && <button className="danger" onClick={() => setStatus(u, 'banned')}>Ban</button>}
            {u.id !== myId && (u.status === 'suspended' || u.status === 'banned') && <button onClick={() => setStatus(u, 'active')}>Reinstate</button>}
          </td>
        </tr>))}
    </tbody></table>{rows.length === 0 && <p className="muted">Search to find members.</p>}</div>
  </>);
}
