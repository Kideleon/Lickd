import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Chip, Header, Input, Screen, SectionTitle, Text } from '../src/components/ui';
import { MediaView } from '../src/components/MediaView';
import { useToast } from '../src/components/feedback';
import { useAuth } from '../src/lib/auth';
import { getFriends, getProfileSummary, saveCustomization, setTop8 } from '../src/lib/api';
import { pickMedia, uploadMedia } from '../src/lib/media';
import { errMessage } from '../src/lib/util';
import { ACCENTS, BACKGROUNDS, PROFILE_FONTS, PROFILE_THEMES, fonts, radius, useTheme } from '../src/theme';
import type { Customization } from '../src/lib/types';

type Draft = Pick<Customization, 'theme' | 'background_color' | 'background_path' | 'accent_color' | 'font' | 'layout' | 'music_title' | 'music_artist' | 'music_url' | 'featured_paths'>;
const DEFAULT: Draft = { theme: 'tangerine', background_color: null, background_path: null, accent_color: null, font: 'default', layout: 'classic', music_title: null, music_artist: null, music_url: null, featured_paths: [] };

export default function Customize() {
  const { profile } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { c } = useTheme();
  const uid = profile?.id ?? '';
  const [d, setD] = useState<Draft | null>(null);
  const [top, setTop] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const me = useQuery({ queryKey: ['profile', uid], queryFn: () => getProfileSummary(uid), enabled: !!uid });
  const friends = useQuery({ queryKey: ['friends', uid], queryFn: () => getFriends(uid), enabled: !!uid });
  const draft: Draft = d ?? (me.data?.customization ? { ...DEFAULT, ...me.data.customization } : DEFAULT);
  const top8 = top ?? (me.data?.top8.map((t) => t.id) ?? []);
  const set = (patch: Partial<Draft>) => setD({ ...draft, ...patch });

  const accent = draft.accent_color ?? c.primary;
  const bg = draft.background_color ?? c.bg;
  const fam = PROFILE_FONTS[draft.font];
  const lightBg = /^#(?:[ef][0-9a-f]){3}$/i.test(bg) || bg.toLowerCase() === '#fff4e0';

  const moveTop = (i: number, dir: -1 | 1) => {
    const next = [...top8]; const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]]; setTop(next);
  };
  const addFeatured = async () => {
    const items = await pickMedia({ multiple: true, max: 6 - draft.featured_paths.length });
    try {
      const paths: string[] = [];
      for (const it of items) paths.push(await uploadMedia(uid, it));
      set({ featured_paths: [...draft.featured_paths, ...paths].slice(0, 6) });
    } catch (e) { toast.show(errMessage(e)); }
  };
  const pickBackground = async () => {
    const [it] = await pickMedia();
    if (!it) return;
    try { set({ background_path: await uploadMedia(uid, it) }); } catch (e) { toast.show(errMessage(e)); }
  };
  const save = async () => {
    if (draft.music_url && !/^https:\/\//.test(draft.music_url)) { toast.show('Music link must start with https://'); return; }
    setBusy(true);
    try {
      await saveCustomization(uid, { ...draft, music_title: draft.music_title?.trim() || null, music_artist: draft.music_artist?.trim() || null, music_url: draft.music_url?.trim() || null });
      await setTop8(uid, top8);
      await qc.invalidateQueries({ queryKey: ['profile', uid] });
      toast.show('Profile updated'); router.back();
    } catch (e) { toast.show(errMessage(e)); } finally { setBusy(false); }
  };
  const reset = () => { setD({ ...DEFAULT }); setTop(top8); toast.show('Reset to default. Save to apply.'); };

  return (
    <Screen scroll>
      <Header title="Customize profile" right={<Button title="Save" small full={false} onPress={save} loading={busy} />} />

      <Text variant="small" tone="muted" style={{ marginBottom: 8 }}>Preview</Text>
      <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: c.line, backgroundColor: bg }}>
        {draft.background_path ? <View style={{ position: 'absolute', inset: 0, opacity: 0.25 } as any}><MediaView path={draft.background_path} style={{ flex: 1 }} /></View> : null}
        <View style={{ height: draft.layout === 'compact' ? 20 : 64, backgroundColor: accent }} />
        <View style={{ padding: 14 }}>
          <View style={{ marginTop: draft.layout === 'compact' ? 0 : -40 }}><Avatar path={profile?.avatar_path} name={profile?.display_name} size={66} ring={accent} /></View>
          <Text style={{ fontFamily: fam ?? fonts.heavy, fontSize: 22, color: lightBg ? '#141B28' : '#F6EDE6', marginTop: 6 }}>{profile?.display_name}</Text>
          <Text variant="small" style={{ color: lightBg ? '#4B566A' : '#B3A096' }}>@{profile?.username}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {top8.slice(0, 8).map((id) => <View key={id} style={{ width: 22, height: 22, borderRadius: 8, backgroundColor: accent }} />)}
            {top8.length === 0 ? <Text variant="caption" style={{ color: lightBg ? '#4B566A' : '#B3A096' }}>Top 8 appears here</Text> : null}
          </View>
          {draft.music_title ? <Text variant="caption" style={{ color: accent, marginTop: 8 }} bold>♪ {draft.music_title}</Text> : null}
        </View>
      </View>

      <SectionTitle title="Quick looks" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Object.entries(PROFILE_THEMES).map(([k, t]) => (
          <Chip key={k} label={t.label} selected={draft.theme === k && draft.accent_color === t.accent}
            onPress={() => set({ theme: k, accent_color: t.accent, background_color: t.background })} />
        ))}
      </ScrollView>

      <SectionTitle title="Accent color" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {ACCENTS.map((a) => (
          <Pressable key={a} onPress={() => set({ accent_color: a })} accessibilityRole="button" accessibilityLabel={`Accent ${a}`} accessibilityState={{ selected: draft.accent_color === a }}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: a, borderWidth: 3, borderColor: draft.accent_color === a ? c.text : 'transparent' }} />
        ))}
      </View>

      <SectionTitle title="Background" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {BACKGROUNDS.map((b) => (
          <Pressable key={b} onPress={() => set({ background_color: b })} accessibilityRole="button" accessibilityLabel={`Background ${b}`}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: b, borderWidth: 3, borderColor: draft.background_color === b ? c.primary : c.line }} />
        ))}
        <Button title={draft.background_path ? 'Change image' : 'Add image'} icon="image" small full={false} variant="secondary" onPress={pickBackground} />
        {draft.background_path ? <Button title="Remove" small full={false} variant="ghost" onPress={() => set({ background_path: null })} /> : null}
      </View>

      <SectionTitle title="Font" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(['default', 'display', 'mono', 'script'] as const).map((f) => <Chip key={f} label={f === 'default' ? 'Classic' : f === 'display' ? 'Serif' : f === 'mono' ? 'Typewriter' : 'Script'} selected={draft.font === f} onPress={() => set({ font: f })} />)}
      </View>

      <SectionTitle title="Layout" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(['classic', 'compact', 'showcase'] as const).map((l) => <Chip key={l} label={l === 'classic' ? 'Classic' : l === 'compact' ? 'Compact (no cover)' : 'Showcase (photos first)'} selected={draft.layout === l} onPress={() => set({ layout: l })} />)}
      </View>

      <SectionTitle title="My music" />
      <Input label="Song" value={draft.music_title ?? ''} onChangeText={(t) => set({ music_title: t })} maxLength={100} />
      <Input label="Artist" value={draft.music_artist ?? ''} onChangeText={(t) => set({ music_artist: t })} maxLength={100} />
      <Input label="Link to listen (optional)" value={draft.music_url ?? ''} onChangeText={(t) => set({ music_url: t })} autoCapitalize="none" keyboardType="url" placeholder="https://" />

      <SectionTitle title="Featured photos" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {draft.featured_paths.map((fp) => (
          <View key={fp} style={{ marginRight: 10 }}>
            <MediaView path={fp} style={{ width: 90, height: 120, borderRadius: radius.md }} />
            <Pressable onPress={() => set({ featured_paths: draft.featured_paths.filter((x) => x !== fp) })} accessibilityLabel="Remove photo" style={{ position: 'absolute', top: 4, right: 4, backgroundColor: c.overlay, borderRadius: 12, padding: 2 }}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ))}
        {draft.featured_paths.length < 6 ? (
          <Pressable onPress={addFeatured} accessibilityRole="button" accessibilityLabel="Add featured photos"
            style={{ width: 90, height: 120, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={30} color={c.muted} />
          </Pressable>
        ) : null}
      </ScrollView>

      <SectionTitle title="Top 8" />
      <Text variant="small" tone="muted" style={{ marginBottom: 10 }}>Your closest friends, in order. Only friends can be added.</Text>
      {top8.map((id, i) => {
        const f = friends.data?.find((x) => x.id === id) ?? me.data?.top8.find((x) => x.id === id);
        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Text bold style={{ width: 24 }}>{i + 1}</Text>
            <Avatar path={f?.avatar_path} name={f?.display_name} size={40} />
            <Text style={{ flex: 1 }} numberOfLines={1}>{f?.display_name ?? 'Friend'}</Text>
            <Ionicons name="arrow-up" size={22} color={c.text} onPress={() => moveTop(i, -1)} accessibilityLabel="Move up" />
            <Ionicons name="arrow-down" size={22} color={c.text} onPress={() => moveTop(i, 1)} accessibilityLabel="Move down" />
            <Ionicons name="close-circle" size={24} color={c.danger} onPress={() => setTop(top8.filter((x) => x !== id))} accessibilityLabel="Remove from Top 8" />
          </View>
        );
      })}
      {top8.length < 8 ? (
        <>
          <Text variant="small" bold style={{ marginTop: 12, marginBottom: 6 }}>Add a friend</Text>
          {(friends.data ?? []).filter((f) => !top8.includes(f.id)).slice(0, 30).map((f) => (
            <Pressable key={f.id} onPress={() => setTop([...top8, f.id])} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <Avatar path={f.avatar_path} name={f.display_name} size={36} /><Text style={{ flex: 1 }}>{f.display_name}</Text><Ionicons name="add-circle" size={24} color={c.primary} />
            </Pressable>
          ))}
          {friends.data && friends.data.length === 0 ? <Text variant="small" tone="muted">Make some friends first, then pick your Top 8.</Text> : null}
        </>
      ) : null}

      <Button title="Reset to default" variant="ghost" onPress={reset} style={{ marginTop: 24 }} />
    </Screen>
  );
}
