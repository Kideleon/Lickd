import React from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Chip, Divider, Header, ListRow, Screen, Segmented, SectionTitle, Text } from '../../src/components/ui';
import { ThemeMode, useTheme } from '../../src/theme';
import { useAuth } from '../../src/lib/auth';
import { deactivateAccount, deleteAccount } from '../../src/lib/api';
import { useToast } from '../../src/components/feedback';
import { errMessage } from '../../src/lib/util';

export default function Settings() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const { session, profile, signOut } = useAuth();
  const toast = useToast();

  const deactivate = () => Alert.alert('Deactivate account?', 'Your profile will be hidden until you sign in and reactivate.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Deactivate', style: 'destructive', onPress: async () => { try { await deactivateAccount(); await signOut(); } catch (e) { toast.show(errMessage(e)); } } },
  ]);
  const remove = () => Alert.alert('Delete account forever?', 'This permanently deletes your profile, posts, messages and photos. It cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete everything', style: 'destructive', onPress: async () => { try { await deleteAccount(); await signOut(); } catch (e) { toast.show(errMessage(e)); } } },
  ]);

  return (
    <Screen scroll>
      <Header title="Settings" />
      <SectionTitle title="Appearance" />
      <Card>
        <Segmented<ThemeMode> value={mode} onChange={setMode} options={[{ key: 'system', label: 'Match phone' }, { key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }]} />
        <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>You can also tap the sun or moon on Home and your profile.</Text>
      </Card>

      <SectionTitle title="Privacy and safety" />
      <Card pad={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow icon="eye-outline" title="Privacy" subtitle="Who can find, message and friend you" onPress={() => router.push('/settings/privacy')} />
          <Divider />
          <ListRow icon="heart-outline" title="Dating" subtitle={profile?.dating_enabled ? 'On' : 'Off'} onPress={() => router.push('/dating')} />
          <Divider />
          <ListRow icon="star-outline" title="Close friends" subtitle="Who sees your Close Friends stories" onPress={() => router.push('/settings/close-friends')} />
          <Divider />
          <ListRow icon="ban-outline" title="Blocked people" onPress={() => router.push('/settings/blocked')} />
          <Divider />
          <ListRow icon="volume-mute-outline" title="Muted people" onPress={() => router.push('/settings/muted')} />
          <Divider />
          <ListRow icon="flag-outline" title="Report history" subtitle="Status of reports you've sent" onPress={() => router.push('/settings/reports')} />
        </View>
      </Card>

      <SectionTitle title="About" />
      <Card pad={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow icon="shield-checkmark-outline" title="Community Guidelines" onPress={() => router.push('/legal/guidelines')} />
          <Divider />
          <ListRow icon="document-text-outline" title="Terms of Service" onPress={() => router.push('/legal/terms')} />
          <Divider />
          <ListRow icon="lock-closed-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        </View>
      </Card>

      <SectionTitle title="Account" />
      <Card pad={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow icon="mail-outline" title="Email" subtitle={session?.user.email} />
          <Divider />
          <ListRow icon="log-out-outline" title="Sign out" onPress={signOut} />
          <Divider />
          <ListRow icon="pause-circle-outline" title="Deactivate account" subtitle="Hide your profile for now" onPress={deactivate} />
          <Divider />
          <ListRow icon="trash-outline" title="Delete account" subtitle="Permanently remove your data" danger onPress={remove} />
        </View>
      </Card>
    </Screen>
  );
}
