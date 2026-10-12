import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase, Role } from './supabase';
import { Dashboard } from './views/Dashboard';
import { Reports } from './views/Reports';
import { Users } from './views/Users';
import { Appeals } from './views/Appeals';
import { Audit } from './views/Audit';

type Me = { id: string; display_name: string; role: Role; status: string };
type Tab = 'dashboard' | 'reports' | 'users' | 'appeals' | 'audit';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('reports');

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMe(null); return; }
    supabase.from('profiles').select('id,display_name,role,status').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setMe((data as Me | null) ?? null));
  }, [session]);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  if (!configured) return <div className="shell"><div className="card"><h2>Not configured</h2><p>Copy <code>.env.example</code> to <code>.env</code> and set your Supabase URL and anon key.</p></div></div>;
  if (!ready) return <div className="shell">Loading…</div>;
  if (!session) return <Login />;
  if (!me) return <div className="shell">Checking your access…</div>;
  if (!(me.role === 'moderator' || me.role === 'admin') || me.status !== 'active') {
    return <div className="shell"><div className="card"><h2>No access</h2><p>This area is for LICKD moderators and admins only.</p><button onClick={signOut}>Sign out</button></div></div>;
  }
  const tabs: [Tab, string][] = [['reports', 'Reports'], ['users', 'Members'], ['appeals', 'Appeals'], ['dashboard', 'Metrics'], ['audit', 'Audit log']];
  return (
    <div className="shell">
      <div className="bar" role="tablist">
        <span className="brand">LICKD moderation</span>
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>{l}</button>)}
        <span className="muted">{me.display_name} · {me.role}</span>
        <button onClick={signOut}>Sign out</button>
      </div>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'reports' && <Reports />}
      {tab === 'users' && <Users isAdmin={me.role === 'admin'} myId={me.id} />}
      {tab === 'appeals' && <Appeals />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr('Email or password is wrong.');
    setBusy(false);
  };
  return (
    <div className="shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <form className="card" onSubmit={submit}>
        <h1>LICKD moderation</h1>
        <p className="muted">Staff sign-in. Accounts without a moderator or admin role are turned away.</p>
        <p><label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label></p>
        <p><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label></p>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
