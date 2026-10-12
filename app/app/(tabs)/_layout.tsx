import React from 'react';
import { Pressable, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../../src/theme';
import { useUid } from '../../src/lib/auth';
import { getConversations } from '../../src/lib/api';
import { useRealtime } from '../../src/lib/realtime';

export default function TabsLayout() {
  const { c, isDark } = useTheme();
  const router = useRouter();
  const uid = useUid();
  const insets = useSafeAreaInsets();
  useRealtime(uid);
  const inbox = useQuery({ queryKey: ['conversations', 'inbox'], queryFn: () => getConversations(false), enabled: !!uid });
  const requests = useQuery({ queryKey: ['conversations', 'requests'], queryFn: () => getConversations(true), enabled: !!uid });
  const unread = (inbox.data ?? []).reduce((n, x) => n + (x.unread_count ?? 0), 0) + (requests.data?.length ?? 0);

  const icon = (on: string, off: string) => ({ focused, color }: { focused: boolean; color: string }) =>
    <Ionicons name={(focused ? on : off) as any} size={25} color={color} />;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: c.muted,
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      tabBarStyle: {
        backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: isDark ? c.line : c.edge,
        height: 58 + insets.bottom, paddingTop: 6,
      },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="create" options={{
        title: 'Create',
        tabBarButton: () => (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Pressable onPress={() => router.push('/create')} accessibilityRole="button" accessibilityLabel="Create"
              style={{ marginTop: -14 }}>
              <View style={{ position: 'absolute', top: 3, left: 3, width: 56, height: 56, borderRadius: 20, backgroundColor: c.shadow }} />
              <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: isDark ? '#000' : c.edge }}>
                <Ionicons name="add" size={34} color={c.onPrimary} />
              </View>
            </Pressable>
          </View>
        ),
      }} />
      <Tabs.Screen name="messages" options={{
        title: 'Messages', tabBarIcon: icon('chatbubbles', 'chatbubbles-outline'),
        tabBarBadge: unread > 0 ? unread : undefined,
        tabBarBadgeStyle: { backgroundColor: c.primary, color: c.onPrimary, fontFamily: fonts.bold },
      }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
