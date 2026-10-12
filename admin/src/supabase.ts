import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configured = !!url && !!key;
// Only the public anon key ever ships here. Every action is enforced by Postgres (RLS + staff-checked RPCs).
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', { auth: { persistSession: true, autoRefreshToken: true } });
export type Role = 'user' | 'moderator' | 'admin';
