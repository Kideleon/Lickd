import React from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Card, Header, Screen, Segmented, Text, ToggleRow } from '../../src/components/ui';
import { useToast } from '../../src/components/feedback';
import { useAuth } from '../../src/lib/auth';
import { updateProfile } from '../../src/lib/api';
import { errMessage } from '../../src/lib/util';
import type { Profile } from '../../src/lib/types';

export default function Privacy() {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  if (!profile) return null;
  const save = async (patch: Partial<Profile>) => {
    try { await updateProfile(profile.id, patch); await refreshProfile(); qc.invalidateQueries({ queryKey: ['profile'] }); }
    catch (e) { toast.show(errMessage(e)); }
  };
  return (
    <Screen scroll>
      <Header title="Privacy" />
      <Card style={{ marginBottom: 16 }}>
        <Text variant="h2" style={{ marginBottom: 4 }}>Who can find your profile</Text>
        <Text variant="small" tone="muted" style={{ marginBottom: 10 }}>Controls Discover and search.</Text>
        <Segmented value={profile.discoverability} onChange={(v) => save({ discoverability: v })}
          options={[{ key: 'everyone', label: 'Everyone' }, { key: 'friends', label: 'Friends' }, { key: 'unlisted', label: 'Link only' }]} />
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
          {profile.discoverability === 'everyone' ? 'Anyone can find and view your profile.' : profile.discoverability === 'friends' ? 'Only friends can see your profile at all.' : 'Hidden from search, but people with a link can view it.'}
        </Text>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <Text variant="h2" style={{ marginBottom: 10 }}>Who can message you</Text>
        <Segmented value={profile.who_can_message} onChange={(v) => save({ who_can_message: v })}
          options={[{ key: 'everyone', label: 'Everyone' }, { key: 'friends', label: 'Friends' }, { key: 'nobody', label: 'No one' }]} />
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Messages from people who aren't friends arrive as requests you can accept or decline.</Text>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <Text variant="h2" style={{ marginBottom: 10 }}>Who can friend or follow you</Text>
        <Segmented value={profile.who_can_friend} onChange={(v) => save({ who_can_friend: v })}
          options={[{ key: 'everyone', label: 'Everyone' }, { key: 'nobody', label: 'No one' }]} />
      </Card>
      <Card>
        <ToggleRow title="Show my city" subtitle="Off hides it from your profile and from Nearby lists" value={profile.show_city} onChange={(v) => save({ show_city: v })} />
        <ToggleRow title="Dating profile" subtitle="Appear in Dating. You can turn this off any time." value={profile.dating_enabled} onChange={(v) => save({ dating_enabled: v })} />
      </Card>
      <View style={{ height: 8 }} />
    </Screen>
  );
}
