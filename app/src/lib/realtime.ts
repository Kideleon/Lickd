import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Live-updates inbox, chat and notification badges. RLS still filters what each user receives. */
export function useRealtime(uid: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid) return;
    const channel = supabase.channel(`lickd-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        const conv = (payload.new as any)?.conversation_id;
        if (conv) qc.invalidateQueries({ queryKey: ['messages', conv] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` }, () => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['unread-notifications'] });
        qc.invalidateQueries({ queryKey: ['friend-requests'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc]);
}
