import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

type Report = {
  id: string; target_type: string; target_id: string; target_user_id: string | null; reason: string; details: string | null;
  snapshot: { text?: string; media_paths?: string[]; [k: string]: unknown }; status: string; created_at: string;
  reporter: { username: string } | null; target_user: { username: string; status: string } | null;
};

function Media({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { supabase.storage.from('media').createSignedUrl(path, 600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [path]);
  if (!url) return <span className="muted">media unavailable</span>;
  return /\.(mp4|mov|webm)$/i.test(path) ? <video src={url} controls /> : <img src={url} alt="Reported media" />;
}

export function Reports() {
  const [filter, setFilter] = useState<'open' | 'reviewing' | 'closed'>('open');
  const [rows, setRows] = useState<Report[]>([]); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('reports').select('id,target_type,target_id,target_user_id,reason,details,snapshot,status,created_at,reporter:reporter_id(username),target_user:target_user_id(username,status)')
      .order('created_at', { ascending: true }).limit(100);
    q = filter === 'closed' ? q.in('status', ['resolved', 'dismissed']) : q.eq('status', filter);
    const { data, error } = await q;
    if (error) setErr(error.message); else { setErr(''); setRows((data ?? []) as unknown as Report[]); }
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (<>
    <div className="row" style={{ marginBottom: 12 }}>
      {(['open', 'reviewing', 'closed'] as const).map((f) => <button key={f} className="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}
      <button onClick={load}>Refresh</button>
    </div>
    {err && <p className="err">{err}</p>}
    {loading ? <p>Loading…</p> : rows.length === 0 ? <div className="card">Nothing here. Queue is clear.</div> : rows.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
  </>);
}

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const [action, setAction] = useState('none'); const [days, setDays] = useState(3); const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const closed = r.status === 'resolved' || r.status === 'dismissed';

  const review = async () => { const { error } = await supabase.rpc('mod_mark_reviewing', { p_report: r.id }); if (error) setErr(error.message); else onDone(); };
  const resolve = async (outcome: 'resolved' | 'dismissed') => {
    if (!reason.trim()) { setErr('Write a short reason. It goes in the audit log.'); return; }
    if (outcome === 'resolved' && action === 'ban' && !window.confirm('Permanently ban this member?')) return;
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('mod_resolve_report', { p_report: r.id, p_outcome: outcome, p_action: outcome === 'dismissed' ? 'none' : action, p_reason: reason.trim(), p_suspend_days: days });
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  };

  return (
    <div className="card">
      <div className="row"><span className="pill">{r.target_type}</span><span className="pill">{r.reason}</span><span className="pill">{r.status}</span>
        <span className="muted grow">{new Date(r.created_at).toLocaleString()} · reported by @{r.reporter?.username ?? 'deleted'} · against @{r.target_user?.username ?? 'unknown'}{r.target_user && r.target_user.status !== 'active' ? ` (${r.target_user.status})` : ''}</span></div>
      {r.details && <p><b>Reporter says:</b> {r.details}</p>}
      <div className="snap">{r.snapshot?.text ? String(r.snapshot.text) : <span className="muted">No text captured. Snapshot: {JSON.stringify(r.snapshot)}</span>}</div>
      {r.snapshot?.media_paths?.length ? <div className="thumbs">{r.snapshot.media_paths.map((p) => <Media key={p} path={p} />)}</div> : null}
      {!closed && (<>
        <div className="row" style={{ marginTop: 10 }}>
          {r.status === 'open' && <button onClick={review}>Claim for review</button>}
          <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)} style={{ width: 'auto' }}>
            <option value="none">No action (mark resolved)</option><option value="remove_content">Remove content</option><option value="warn">Warn member</option>
            <option value="suspend">Suspend member</option><option value="ban">Ban member (admin only)</option>
          </select>
          {action === 'suspend' && <label className="row">Days <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 80 }} /></label>}
        </div>
        <p><input aria-label="Reason" placeholder="Reason (logged and shown to the member)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></p>
        <div className="row"><button className="primary" disabled={busy} onClick={() => resolve('resolved')}>Resolve</button><button disabled={busy} onClick={() => resolve('dismissed')}>Dismiss: no violation</button></div>
      </>)}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
