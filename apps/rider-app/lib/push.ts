import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';

/**
 * Expo push registration. Requires a development/production build —
 * Expo Go cannot receive remote pushes, so everything is silently best-effort.
 */

let registeredToken: string | null = null;
let unregistering = false;

// Show incoming alerts while the app is open (banner + notification centre).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function deviceToken(): Promise<string | null> {
  const projectId: string | undefined = (Constants.expoConfig as any)?.extra?.eas?.projectId;
  const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return res.data ?? null;
}

/** Ask permission and register this device for order alerts. Idempotent per app session. */
export async function registerForPush(): Promise<void> {
  try {
    // Never re-register mid-logout: a refresh triggered by the remove call would
    // otherwise resubscribe the outgoing user and pin the token to them.
    if (unregistering || registeredToken) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Order alerts',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;
    const token = await deviceToken();
    if (!token) return;
    await api.post('/notifications/push-token', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    registeredToken = token;
  } catch {
    // No push in Expo Go / permission denied / offline — never break the app.
  }
}

/** Stop alerts to this device (call while still authenticated, before clearing tokens). */
export async function unregisterPush(): Promise<void> {
  // Re-entrancy guard: if our remove call itself 401s, request() calls clearAuth()
  // which calls back into unregisterPush — without this, that loops forever.
  if (unregistering) return;
  unregistering = true;
  try {
    const token = registeredToken ?? (await deviceToken());
    registeredToken = null;
    if (!token) return;
    await api.post('/notifications/push-token/remove', { token });
  } catch {
    // Best-effort — the server prunes dead tokens on delivery failures anyway.
  } finally {
    unregistering = false;
  }
}
