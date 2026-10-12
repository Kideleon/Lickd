import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getMyProfile, touchActive } from './api';
import { clearMediaCache } from './media';
import { registerForPush } from './push';
import type { Profile } from './types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  loading: true, session: null, profile: null, refreshProfile: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const pushDone = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    try {
      await touchActive(); // lifts expired suspensions, bumps last_active_at
      setProfile(await getMyProfile(uid));
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') { setProfile(null); qc.clear(); clearMediaCache(); }
      // Don't await Supabase calls inside this callback (deadlock risk); defer.
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile, qc]);

  useEffect(() => {
    const uid = profile?.id;
    if (uid && profile?.status === 'active' && pushDone.current !== uid) {
      pushDone.current = uid;
      registerForPush(uid).catch(() => {});
    }
  }, [profile?.id, profile?.status]);

  const refreshProfile = useCallback(async () => { await loadProfile(session?.user.id); }, [loadProfile, session?.user.id]);
  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  const value = useMemo(() => ({ loading, session, profile, refreshProfile, signOut }),
    [loading, session, profile, refreshProfile, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
/** The signed-in user's id. Only call inside authenticated screens. */
export function useUid(): string {
  const { session } = useAuth();
  return session?.user.id ?? '';
}
