import React, { useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Chip, Empty, ErrorState, Loading, Screen, SectionTitle, Text } from '../../src/components/ui';
import { EventCard, GroupCard, PersonRow, PersonTile } from '../../src/components/cards';
import { discoverEvents, discoverGroups, discoverPeople, discoverPlaces, trendingTags } from '../../src/lib/api';
import { INTENTS } from '../../src/lib/types';
import { fonts, radius, space, useTheme } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';

type Cat = 'people' | 'dating' | 'friends' | 'groups' | 'events' | 'places';
const CATS: { key: Cat; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'people', label: 'People', icon: 'person-outline' }, { key: 'dating', label: 'Dating', icon: 'heart-outline' },
  { key: 'friends', label: 'Friends', icon: 'happy-outline' }, { key: 'groups', label: 'Groups', icon: 'people-outline' },
  { key: 'events', label: 'Events', icon: 'calendar-outline' }, { key: 'places', label: 'Places', icon: 'location-outline' },
];

export default function Discover() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile } = useAuth();
  const [cat, setCat] = useState<Cat>('people');
  const [q, setQ] = useState('');
  const [intent, setIntent] = useState<string | undefined>();
  const [city, setCity] = useState('');
  const searching = q.trim().length > 0;

  const nearby = useQuery({ queryKey: ['d-nearby'], queryFn: () => discoverPeople({ mode: 'nearby', limit: 12 }), enabled: cat === 'people' && !searching });
  const fresh = useQuery({ queryKey: ['d-new'], queryFn: () => discoverPeople({ mode: 'new', limit: 12 }), enabled: cat === 'people' && !searching });
  const tags = useQuery({ queryKey: ['d-tags'], queryFn: trendingTags, enabled: cat === 'people' && !searching });
  const popular = useQuery({ queryKey: ['d-groups-pop'], queryFn: () => discoverGroups(undefined, 0, 5), enabled: cat === 'people' && !searching });
  const upcoming = useQuery({ queryKey: ['d-events-up'], queryFn: () => discoverEvents(undefined, undefined, 0, 3), enabled: cat === 'people' && !searching });

  const people = useQuery({
    queryKey: ['d-people', q, intent, city, cat],
    queryFn: () => discoverPeople({ q, intent, city, mode: cat === 'friends' ? 'friends' : 'search', limit: 40 }),
    enabled: (cat === 'people' && (searching || !!intent || !!city)) || cat === 'friends',
  });
  const groups = useQuery({ queryKey: ['d-groups', q], queryFn: () => discoverGroups(q, 0, 40), enabled: cat === 'groups' });
  const events = useQuery({ queryKey: ['d-events', q, city], queryFn: () => discoverEvents(q, city, 0, 40), enabled: cat === 'events' });
  const places = useQuery({ queryKey: ['d-places', q], queryFn: () => discoverPlaces(q), enabled: cat === 'places' });

  const searchBar = (
    <View>
      <Text variant="title" style={{ paddingTop: 8, paddingBottom: 12 }}>Discover</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: c.line, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 48 }}>
        <Ionicons name="search" size={20} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${cat}`} placeholderTextColor={c.muted} returnKeyType="search"
          accessibilityLabel="Search" style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: c.text }} />
        {q ? <Ionicons name="close-circle" size={20} color={c.muted} onPress={() => setQ('')} accessibilityLabel="Clear search" /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
        {CATS.map((x) => (
          <Chip key={x.key} icon={x.icon} label={x.label} selected={cat === x.key}
            onPress={() => { if (x.key === 'dating') router.push('/dating'); else setCat(x.key); }} />
        ))}
      </ScrollView>
    </View>
  );

  const header = (extra?: React.ReactNode) => <View>{searchBar}{extra}</View>;

  const list = <T,>(q: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void; data?: T[] }, render: (x: T) => React.ReactElement, empty: string, extra?: React.ReactNode, key?: (x: T) => string) => (
    <FlatList
      data={q.data ?? []} keyExtractor={(x, i) => (key ? key(x) : String(i))} renderItem={({ item }) => render(item)}
      ListHeaderComponent={header(extra)} showsVerticalScrollIndicator={false}
      ListEmptyComponent={q.isLoading ? <Loading /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : <Empty icon="search-outline" title={empty} />}
    />
  );

  return (
    <Screen>
      {cat === 'people' && !searching && !intent && !city ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {searchBar}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
            {INTENTS.filter((i) => i !== 'Dating').map((i) => <Chip key={i} label={i} selected={intent === i} onPress={() => setIntent(intent === i ? undefined : i)} />)}
          </View>

          <SectionTitle title={profile?.city ? `People near ${profile.city}` : 'People near you'} />
          {profile?.city ? (nearby.data?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>{nearby.data.map((p) => <PersonTile key={p.id} person={p} />)}</ScrollView>
          ) : nearby.isLoading ? <Loading /> : <Text tone="muted" variant="small">No one else in {profile.city} yet. Invite a friend!</Text>)
            : <Text tone="muted" variant="small">Add your city in Edit profile to see people close to you.</Text>}

          {tags.data?.length ? (
            <>
              <SectionTitle title="Trending on LICKD" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {tags.data.map((t) => <Chip key={t.tag} label={`#${t.tag} · ${t.post_count}`} onPress={() => router.push(`/tag/${t.tag}`)} />)}
              </View>
            </>
          ) : null}

          <SectionTitle title="New to LICKD" />
          {fresh.data?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{fresh.data.map((p) => <PersonTile key={p.id} person={p} />)}</ScrollView>
            : fresh.isLoading ? <Loading /> : <Text tone="muted" variant="small">New members will show up here.</Text>}

          <SectionTitle title="Popular groups" action="See all" onAction={() => setCat('groups')} />
          {(popular.data ?? []).map((g) => <GroupCard key={g.id} group={g} />)}
          {!popular.isLoading && !popular.data?.length ? <Empty icon="people-outline" title="No groups yet" body="Start the first one." action="Create a group" onAction={() => router.push('/group/new')} /> : null}

          <SectionTitle title="Coming up" action="See all" onAction={() => setCat('events')} />
          {(upcoming.data ?? []).map((e) => <EventCard key={e.id} event={e} />)}
          {!upcoming.isLoading && !upcoming.data?.length ? <Text tone="muted" variant="small">No upcoming events nearby.</Text> : null}
        </ScrollView>
      ) : cat === 'people' || cat === 'friends' ? list(people, (p) => <PersonRow person={p} />, 'No one matches yet',
        cat === 'people' ? (
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {INTENTS.filter((i) => i !== 'Dating').map((i) => <Chip key={i} label={i} selected={intent === i} onPress={() => setIntent(intent === i ? undefined : i)} />)}
            </View>
            <TextInput value={city} onChangeText={setCity} placeholder="Filter by city" placeholderTextColor={c.muted} accessibilityLabel="City filter"
              style={{ fontFamily: fonts.regular, fontSize: 15, color: c.text, borderWidth: 2, borderColor: c.line, borderRadius: radius.md, paddingHorizontal: 12, minHeight: 44, backgroundColor: c.surface }} />
          </View>
        ) : <Text tone="muted" variant="small" style={{ marginBottom: 8 }}>People who are here to make friends.</Text>, (p) => p.id)
      : cat === 'groups' ? list(groups, (g) => <GroupCard group={g} />, 'No groups found',
          <Button title="Create a group" icon="add" small full={false} onPress={() => router.push('/group/new')} style={{ marginBottom: 12 }} />, (g) => g.id)
      : cat === 'events' ? list(events, (e) => <EventCard event={e} />, 'No upcoming events',
          <Button title="Create an event" icon="add" small full={false} onPress={() => router.push('/event/new')} style={{ marginBottom: 12 }} />, (e) => e.id)
      : list(places, (p) => (
          <PlaceRow name={p.location} count={p.post_count} />), 'No check-ins yet. Post with a location to start one.', undefined, (p) => p.location)}
    </Screen>
  );
}

function PlaceRow({ name, count }: { name: string; count: number }) {
  const router = useRouter();
  const { c } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/place/${encodeURIComponent(name)}`)} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="location" size={22} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body" bold numberOfLines={1}>{name}</Text>
        <Text variant="caption" tone="muted">{count} recent check-in{count === 1 ? '' : 's'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}
