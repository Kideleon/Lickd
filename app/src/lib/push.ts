import React from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { savePushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

/** Asks permission (once) and stores the Expo push token for server-side delivery. */
export async function registerForPush(uid: string): Promise<void> {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#E8B84A',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || String(projectId).startsWith('REPLACE')) return; // EAS project not configured yet
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await savePushToken(uid, token.data);
}

/** Opens the screen named in a tapped push notification. Only in-app paths are accepted. */
export function usePushNavigation(go: (route: string) => void): void {
  const handle = (r: Notifications.NotificationResponse) => {
    const route = (r.notification.request.content.data as { route?: unknown } | undefined)?.route;
    if (typeof route === 'string' && route.startsWith('/') && !route.startsWith('//')) go(route);
  };
  React.useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((r) => { if (r) handle(r); }).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
