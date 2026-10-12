import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StatusBar, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, OptionSheet, Text } from '../../src/components/ui';
import { MediaView } from '../../src/components/MediaView';
import { PersonRow } from '../../src/components/cards';
import { useSafety, useToast } from '../../src/components/feedback';
import { deleteStory, getProfileSummary, getStoryViewers, getUserStories, markStoryViewed, replyToStory } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { errMessage, timeAgo } from '../../src/lib/util';
import { fonts } from '../../src/theme';

const IMAGE_MS = 5500;

export default function StoryViewer() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter(); const qc = useQueryClient(); const me = useUid(); const insets = useSafeAreaInsets();
  const toast = useToast(); const safety = useSafety();
  const [i, setI] = useState(0);
  const [reply, setReply] = useState('');
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const mine = userId === me;

  const stories = useQuery({ queryKey: ['stories', userId], queryFn: () => getUserStories(userId!) });
  const author = useQuery({ queryKey: ['profile', userId], queryFn: () => getProfileSummary(userId!) });
  const list = stories.data ?? [];
  const cur = list[i];
  const vw = useQuery({ queryKey: ['story-viewers', cur?.id], queryFn: () => getStoryViewers(cur!.id), enabled: !!cur && mine });

  const close = useCallback(() => { qc.invalidateQueries({ queryKey: ['story-tray'] }); router.back(); }, [qc, router]);
  const next = useCallback(() => { if (i < list.length - 1) setI(i + 1); else close(); }, [i, list.length, close]);
  const prev = () => { if (i > 0) setI(i - 1); else progress.setValue(0); };

  useEffect(() => {
    if (!cur) return;
    if (!mine) markStoryViewed(cur.id, me);
    progress.setValue(0);
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cur || paused || cur.media_type === 'video') return;
    const a = Animated.timing(progress, { toValue: 1, duration: IMAGE_MS, easing: Easing.linear, useNativeDriver: false });
    progress.setValue(0);
    a.start(({ finished }) => { if (finished) next(); });
    return () => a.stop();
  }, [cur?.id, paused, i]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!cur || !reply.trim()) return;
    try { await replyToStory(cur.id, reply); setReply(''); toast.show('Reply sent'); } catch (e) { toast.show(errMessage(e)); }
  };

  if (stories.isLoading) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  if (!cur) return (
    <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff' }}>No active stories</Text>
      <Pressable onPress={close} style={{ padding: 20 }}><Text style={{ color: '#fff' }} bold>Close</Text></Pressable>
    </View>
  );

  const a = author.data;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar hidden />
      <MediaView path={cur.media_path} type={cur.media_type} fit="contain" autoplay loop={false} style={{ flex: 1, backgroundColor: '#000' }} />
      {/* tap zones */}
      <View style={{ position: 'absolute', top: 90, bottom: 110, left: 0, right: 0, flexDirection: 'row' }}>
        <Pressable style={{ flex: 1 }} onPress={prev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Previous" />
        <Pressable style={{ flex: 2 }} onPress={next} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel="Next" />
      </View>
      <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {list.map((s, idx) => (
            <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <Animated.View style={{ height: 3, backgroundColor: '#fff', width: idx < i ? '100%' : idx === i ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <Avatar path={a?.avatar_path} name={a?.display_name} size={36} />
          <Text variant="small" bold style={{ color: '#fff', flex: 1 }}>{a?.display_name} <Text variant="caption" style={{ color: '#ddd' }}>{timeAgo(cur.created_at)}</Text></Text>
          {!mine ? <Pressable hitSlop={10} accessibilityLabel="Story options" onPress={() => safety.open({ type: 'story', id: cur.id, userId: userId!, username: a?.username ?? 'member' })}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" /></Pressable> : null}
          <Pressable hitSlop={10} onPress={close} accessibilityLabel="Close"><Ionicons name="close" size={28} color="#fff" /></Pressable>
        </View>
      </View>
      {cur.caption ? <Text style={{ position: 'absolute', bottom: insets.bottom + 90, left: 20, right: 20, color: '#fff', textAlign: 'center', fontFamily: fonts.semibold, fontSize: 18, textShadowColor: '#000', textShadowRadius: 6 }}>{cur.caption}</Text> : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 10, paddingHorizontal: 14 }}>
        {mine ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={() => { setPaused(true); setViewers(true); }} accessibilityRole="button" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="eye" size={22} color="#fff" /><Text style={{ color: '#fff' }} bold>{vw.data?.length ?? 0} views</Text>
            </Pressable>
            <Pressable onPress={async () => { try { await deleteStory(cur.id); await stories.refetch(); if (list.length <= 1) close(); else setI(0); } catch (e) { toast.show(errMessage(e)); } }} accessibilityLabel="Delete story">
              <Ionicons name="trash-outline" size={24} color="#fff" /></Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={reply} onChangeText={setReply} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} placeholder={`Reply to ${a?.display_name?.split(' ')[0] ?? ''}`}
              placeholderTextColor="#ccc" maxLength={500} accessibilityLabel="Reply to story"
              style={{ flex: 1, color: '#fff', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24, paddingHorizontal: 16, minHeight: 46, fontFamily: fonts.regular, fontSize: 16 }} />
            <Pressable onPress={send} disabled={!reply.trim()} accessibilityLabel="Send reply" style={{ opacity: reply.trim() ? 1 : 0.4 }}><Ionicons name="send" size={26} color="#fff" /></Pressable>
          </View>
        )}
      </View>

      <OptionSheet visible={viewers} onClose={() => { setViewers(false); setPaused(false); }} title="Viewed by" options={[]} />
      {viewers ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '60%', backgroundColor: '#171410', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: insets.bottom + 16 }}>
          <Pressable onPress={() => { setViewers(false); setPaused(false); }} accessibilityLabel="Close viewers"><Text variant="h2" style={{ color: '#fff', marginBottom: 8 }}>Viewed by {vw.data?.length ?? 0}   ✕</Text></Pressable>
          {(vw.data ?? []).map((v) => v.viewer ? <PersonRow key={v.viewer.id} person={v.viewer} onPress={() => { setViewers(false); router.replace(`/user/${v.viewer!.id}`); }} /> : null)}
          {vw.data && vw.data.length === 0 ? <Text style={{ color: '#aaa' }}>No views yet.</Text> : null}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
