import React from 'react';
import { Alert, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, ErrorState, Header, IconButton, Loading, Screen, SectionTitle, Text } from '../../src/components/ui';
import { MediaView } from '../../src/components/MediaView';
import { PersonRow } from '../../src/components/cards';
import { useSafety, useToast } from '../../src/components/feedback';
import { deleteEvent, getEvent, getEventAttendees, setAttendance } from '../../src/lib/api';
import { useUid } from '../../src/lib/auth';
import { errMessage, formatEventDate } from '../../src/lib/util';
import { radius, space, useTheme } from '../../src/theme';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUid(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast(); const safety = useSafety(); const { c } = useTheme();
  const ev = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(id!, me) });
  const people = useQuery({ queryKey: ['event-people', id], queryFn: () => getEventAttendees(id!), enabled: !!ev.data });

  if (ev.isLoading) return <Screen><Header /><Loading /></Screen>;
  if (ev.isError) return <Screen><Header /><ErrorState error={ev.error} onRetry={ev.refetch} /></Screen>;
  const e = ev.data;
  if (!e) return <Screen><Header /><Empty icon="eye-off-outline" title="Event not found" body="It may have been removed or made private." /></Screen>;

  const set = async (status: 'interested' | 'going' | null) => {
    try { await setAttendance(e.id, me, status, !!e.my_status); await qc.invalidateQueries({ queryKey: ['event', id] }); qc.invalidateQueries({ queryKey: ['event-people', id] }); qc.invalidateQueries({ queryKey: ['my-events'] }); }
    catch (er) { toast.show(errMessage(er)); }
  };
  const share = () => Share.share({ message: `${e.title} · ${formatEventDate(e.starts_at)}${e.location ? ` · ${e.location}` : ''}\nlickd://event/${e.id}` }).catch(() => {});
  const mine = e.creator_id === me;
  const going = (people.data ?? []).filter((p) => p.status === 'going' && p.profile);

  return (
    <Screen scroll padded={false}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Header right={<IconButton name="ellipsis-horizontal" label="More options" onPress={() => safety.open({
          type: 'event', id: e.id, userId: e.creator_id, username: e.organizer ?? 'organizer',
          extra: mine ? [{ label: 'Cancel event', icon: 'trash-outline', destructive: true, onPress: () => Alert.alert('Cancel this event?', 'Everyone who RSVP\'d will lose it.', [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel event', style: 'destructive', onPress: async () => { try { await deleteEvent(e.id); await qc.invalidateQueries(); router.back(); } catch (er) { toast.show(errMessage(er)); } } }]) }] : [],
        })} />} />
        <MediaView path={e.cover_path} bucket="avatars" style={{ height: 190, borderRadius: radius.lg, backgroundColor: c.primary }} />
        <Text variant="title" style={{ marginTop: 14 }}>{e.title}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Ionicons name="calendar" size={20} color={c.primary} /><Text style={{ flex: 1 }}>{formatEventDate(e.starts_at)}{e.ends_at ? ` – ${new Date(e.ends_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</Text></View>
          {e.location ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Ionicons name="location" size={20} color={c.primary} /><Text style={{ flex: 1 }}>{e.location}{e.city ? `, ${e.city}` : ''}</Text></View> : null}
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Ionicons name="person" size={20} color={c.primary} /><Text style={{ flex: 1 }}>Hosted by {e.organizer}{e.privacy === 'private' ? ' · Private' : ''}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}><Button title={e.my_status === 'going' ? 'Going ✓' : 'Going'} onPress={() => set(e.my_status === 'going' ? null : 'going')} variant={e.my_status === 'going' ? 'secondary' : 'primary'} /></View>
          <View style={{ flex: 1 }}><Button title={e.my_status === 'interested' ? 'Interested ✓' : 'Interested'} variant="secondary" onPress={() => set(e.my_status === 'interested' ? null : 'interested')} /></View>
        </View>
        <Button title="Share" icon="share-outline" variant="ghost" onPress={share} />
        {e.description ? <><SectionTitle title="About" /><Text tone="muted">{e.description}</Text></> : null}
        <SectionTitle title={`${e.going_count} going · ${e.interested_count} interested`} />
        {going.slice(0, 12).map((p) => <PersonRow key={p.profile!.id} person={p.profile!} />)}
      </View>
    </Screen>
  );
}
