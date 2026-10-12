import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts, BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import { ThemeProvider, useTheme } from '../src/theme';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { ToastProvider, SafetyProvider } from '../src/components/feedback';
import { Button, Loading, Text, Wordmark } from '../src/components/ui';
import { isConfigured } from '../src/lib/supabase';
import { captureError } from '../src/lib/monitoring';
import { usePushNavigation } from '../src/lib/push';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { onError: (e) => captureError(e, 'mutation') },
  },
});

function Gate({ children }: { children: React.ReactNode }) {
  const { loading, session, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const first = segments[0] as string | undefined;
  const second = (segments as string[])[1];
  usePushNavigation((r) => { if (session && profile?.onboarded) router.push(r as never); });

  useEffect(() => {
    if (loading) return;
    const inAuth = first === '(auth)';
    if (!session) { if (!inAuth) router.replace('/welcome'); return; }
    if (inAuth && second === 'reset-password') return; // recovery link signs the user in temporarily
    if (!profile || !profile.onboarded) { if (first !== 'onboarding') router.replace('/onboarding'); return; }
    if (profile.status !== 'active') { if (first !== 'account-status') router.replace('/account-status'); return; }
    if (inAuth || first === 'onboarding' || first === 'account-status') router.replace('/');
  }, [loading, session, profile, first, second, router]);

  if (loading) return <Loading />;
  return <>{children}</>;
}

function Shell() {
  const { c, isDark } = useTheme();
  if (!isConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 28, justifyContent: 'center', gap: 14 }}>
        <Wordmark size={44} />
        <Text variant="title">Connect your backend</Text>
        <Text tone="muted">Copy .env.example to .env, add your Supabase project URL and anon key, then restart with `npx expo start -c`. Full steps are in docs/SETUP.md.</Text>
      </View>
    );
  }
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Gate>
        <SafetyProvider>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="create" options={{ presentation: 'transparentModal', animation: 'fade' }} />
            <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
            <Stack.Screen name="stories/[userId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          </Stack>
        </SafetyProvider>
      </Gate>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
  });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export { ErrorBoundary } from 'expo-router';
