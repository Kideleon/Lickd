import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { fonts, radius, space, useTheme } from '../theme';
import { Button, Input, OptionSheet, SheetOption, Sticker, Text } from './ui';
import { REPORT_REASONS, ReportTarget } from '../lib/types';
import { blockUser, muteUser, submitReport } from '../lib/api';
import { useUid } from '../lib/auth';
import { errMessage } from '../lib/util';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ───────────── Toast ─────────────
const ToastCtx = createContext<{ show: (m: string) => void }>({ show: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(op, { toValue: 1, duration: 140, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
    }, 2600);
  }, [op]);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
          style={{ position: 'absolute', left: 20, right: 20, bottom: insets.bottom + 84, opacity: op, alignItems: 'center' }}>
          <Sticker r={radius.md} fill={isDark ? c.surface2 : c.text} border={isDark ? c.line : c.edge} offset={3}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text variant="small" style={{ color: isDark ? c.text : c.bg, fontFamily: fonts.semibold }}>{msg}</Text>
            </View>
          </Sticker>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

// ───────────── Safety menu: report / mute / block from anywhere ─────────────
export interface SafetyTarget {
  type: ReportTarget;
  id: string;
  userId: string;          // the person who made the content
  username: string;
  extra?: SheetOption[];   // e.g. Delete for your own content
}

const SafetyCtx = createContext<{ open: (t: SafetyTarget) => void }>({ open: () => {} });
export const useSafety = () => useContext(SafetyCtx);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const me = useUid();
  const qc = useQueryClient();
  const toast = useToast();
  const { c } = useTheme();
  const [target, setTarget] = useState<SafetyTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const open = useCallback((t: SafetyTarget) => { setTarget(t); setMenuOpen(true); }, []);
  const value = useMemo(() => ({ open }), [open]);

  const doBlock = () => {
    if (!target) return;
    Alert.alert(`Block @${target.username}?`,
      "They won't be able to see your profile, posts or message you, and you won't see theirs. They aren't told you blocked them.",
      [{ text: 'Cancel', style: 'cancel' }, {
        text: 'Block', style: 'destructive', onPress: async () => {
          try { await blockUser(me, target.userId); await qc.invalidateQueries(); toast.show(`Blocked @${target.username}`); }
          catch (e) { toast.show(errMessage(e)); }
        },
      }]);
  };
  const doMute = async () => {
    if (!target) return;
    try { await muteUser(me, target.userId); await qc.invalidateQueries(); toast.show(`Muted @${target.username}`); }
    catch (e) { toast.show(errMessage(e)); }
  };
  const startReport = () => { setReason(null); setDetails(''); setSent(false); setReporting(true); };
  const sendReport = async () => {
    if (!target || !reason) return;
    setBusy(true);
    try { await submitReport(target.type, target.id, reason, details); setSent(true); }
    catch (e) { toast.show(errMessage(e)); }
    finally { setBusy(false); }
  };

  const isMine = target?.userId === me;
  const options: SheetOption[] = !target ? [] : [
    ...(target.extra ?? []),
    ...(isMine ? [] : [
      { label: 'Report', icon: 'flag-outline' as const, onPress: startReport, destructive: true },
      ...(target.type === 'conversation' || target.type === 'user' || target.type === 'post' || target.type === 'story'
        ? [{ label: `Mute @${target.username}`, icon: 'volume-mute-outline' as const, onPress: doMute }] : []),
      { label: `Block @${target.username}`, icon: 'ban-outline' as const, onPress: doBlock, destructive: true },
    ]),
  ];

  return (
    <SafetyCtx.Provider value={value}>
      {children}
      <OptionSheet visible={menuOpen} options={options} onClose={() => setMenuOpen(false)} />
      <Modal visible={reporting} animationType="slide" transparent onRequestClose={() => setReporting(false)}>
        <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', padding: space.lg, borderTopWidth: 2, borderColor: c.line }}>
            {sent ? (
              <View style={{ paddingVertical: space.xl, gap: 10 }}>
                <Text variant="title">Report sent</Text>
                <Text tone="muted">Thanks for looking out for the community. Our moderators will review it, and you can follow the status in Settings → Report history.</Text>
                {target && target.userId !== me ? (
                  <Button title={`Block @${target.username}`} variant="secondary" onPress={() => { setReporting(false); doBlock(); }} style={{ marginTop: 8 }} />
                ) : null}
                <Button title="Done" onPress={() => setReporting(false)} />
              </View>
            ) : (
              <>
                <Text variant="title" style={{ marginBottom: 4 }}>What's going on?</Text>
                <Text variant="small" tone="muted" style={{ marginBottom: space.md }}>Reports are private. Pick the closest reason.</Text>
                <ScrollView keyboardShouldPersistTaps="handled">
                  {REPORT_REASONS.map((r) => (
                    <Pressable key={r.key} onPress={() => setReason(r.key)} accessibilityRole="radio" accessibilityState={{ selected: reason === r.key }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: reason === r.key ? c.primary : c.line, alignItems: 'center', justifyContent: 'center' }}>
                        {reason === r.key ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} /> : null}
                      </View>
                      <Text variant="body">{r.label}</Text>
                    </Pressable>
                  ))}
                  <Input label="Anything else we should know? (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} style={{ marginTop: 8 }} />
                </ScrollView>
                <Button title="Send report" onPress={sendReport} loading={busy} disabled={!reason} />
                <Button title="Cancel" variant="ghost" onPress={() => setReporting(false)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafetyCtx.Provider>
  );
}
