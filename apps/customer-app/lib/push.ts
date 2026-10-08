import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api, API_URL, getAuthVersion, getUser } from './api';

/**
 * Expo push registration. Requires a development/production build —
 * Expo Go cannot receive remote pushes, so everything is silently best-effort.
 */

let registeredToken: { token: string; owner: string; generation: number } | null = null;
let unregistering = false;

// Show incoming alerts while the app is open (banner + notification centre).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const allowed = await canReceivePush(notification.request.content.data);
    return { shouldShowBanner: allowed, shouldShowList: allowed, shouldPlaySound: allowed, shouldSetBadge: false };
  },
});

export async function canReceivePush(data: any): Promise<boolean> {
  const generation = getAuthVersion();
  const user = await getUser();
  if (generation !== getAuthVersion() || !user?.id) return false;
  return data?.scopeId === user.id && ['CUSTOMER', 'ACCOUNT'].includes(data?.audience);
}

async function deviceToken(): Promise<string | null> {
  const projectId: string | undefined = (Constants.expoConfig as any)?.extra?.eas?.projectId;
  const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return res.data ?? null;
}

/** Ask permission and register this device for order alerts. Idempotent per app session. */
export async function registerForPush(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    // Never re-register mid-logout: a refresh triggered by the remove call would
    // otherwise resubscribe the outgoing user and pin the token to them.
    const generation = getAuthVersion();
    const owner = (await getUser())?.id;
    if (!owner || generation !== getAuthVersion()) return false;
    if (registeredToken?.owner === owner && registeredToken?.generation === generation) return true;
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
    if (status !== 'granted') return false;
    const token = await deviceToken();
    if (!token) return false;
    if (generation !== getAuthVersion() || (await getUser())?.id !== owner) return false;
    const result = await api.post('/notifications/push-token', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (!result.ok) return false;
    if (generation !== getAuthVersion() || (await getUser())?.id !== owner) return false;
    registeredToken = { token, owner, generation };
    return true;
  } catch {
    // No push in Expo Go / permission denied / offline — never break the app.
    return false;
  }
}

/** Stop alerts to this device (call while still authenticated, before clearing tokens). */
export async function unregisterPush(access?: string | null, generation?: number): Promise<void> {
  if (Platform.OS === 'web') return;
  // Re-entrancy guard: if our remove call itself 401s, request() calls clearAuth()
  // which calls back into unregisterPush — without this, that loops forever.
  if (unregistering) return;
  unregistering = true;
  try {
    const outgoing = generation == null || registeredToken?.generation === generation ? registeredToken : null;
    const token = outgoing?.token ?? (await deviceToken());
    if (outgoing && registeredToken === outgoing) registeredToken = null;
    if (!token) return;
    if (access) await fetch(`${API_URL}/notifications/push-token/remove`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${access}` },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Best-effort — the server prunes dead tokens on delivery failures anyway.
  } finally {
    unregistering = false;
  }
}
