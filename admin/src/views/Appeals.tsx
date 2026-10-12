import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

type A = { id: string; user_id: string; message: string; created_at: string; user: { username: string; status: string } | null };

export function Appeals() {
  const [rows, setRows] = useState<A[]>([]); const [err, setErr] = useState(''); const [resp, setResp] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('appeals').select('id,user_id,message,created_at,user:user_id(username,status)').eq('status', 'pending').order('created_at');
    if (error) setErr(error.message); else setRows((data ?? []) as unknown as A[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (a: A, decision: 'upheld' | 'denied') => {
    const response = (resp[a.id] ?? '').trim();
    if (!response) { setErr('Write a response. The member will see it.'); return; }
    const { error } = await supabase.rpc('mod_resolve_appeal', { p_appeal: a.id, p_decision: decision, p_response: response });
    if (error) setErr(error.message); else { setErr(''); load(); }
  };
  return (<>
    {err && <p className="err" role="alert">{err}</p>}
    {rows.length === 0 ? <div className="card">No pending appeals.</div> : rows.map((a) => (
      <div className="card" key={a.id}>
        <div className="row"><b>@{a.user?.username}</b><span className="pill">{a.user?.status}</span><span className="muted">{new Date(a.created_at).toLocaleString()}</span></div>
        <div className="snap">{a.message}</div>
        <p><input aria-label="Response to member" placeholder="Response to the member" value={resp[a.id] ?? ''} onChange={(e) => setResp({ ...resp, [a.id]: e.target.value })} maxLength={1000} /></p>
        <div className="row"><button className="primary" onClick={() => decide(a, 'upheld')}>Uphold: reinstate</button><button onClick={() => decide(a, 'denied')}>Deny</button></div>
      </div>))}
  </>);
}
