import { trackEvent } from './api';

/**
 * Single choke point for crash/error reporting. Today it logs and records a
 * lightweight analytics event. To add Sentry: `npx expo install @sentry/react-native`,
 * call Sentry.init() in app/_layout.tsx and forward errors from captureError().
 */
export function captureError(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  if (__DEV__) console.warn('[error]', context ?? '', message);
  trackEvent('client_error', { context, message: message.slice(0, 200) });
}

export const track = trackEvent;
