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
  return (data?.audience === 'RIDER' && user.rider?.approvalStatus === 'APPROVED' && user.rider?.isActive === true &&
    !!user.rider?.id && data.scopeId === user.rider.id) ||
    (data?.audience === 'ACCOUNT' && data.scopeId === user.id);
}

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
    const generation = getAuthVersion();
    const user = await getUser();
    const owner = user?.rider?.id && user.rider.approvalStatus === 'APPROVED' && user.rider.isActive === true
      ? `${user.id}:RIDER:${user.rider.id}` : null;
    if (!owner || generation !== getAuthVersion()) return;
    if (registeredToken?.owner === owner && registeredToken.generation === generation) return;
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
    if (generation !== getAuthVersion() || (await getUser())?.id !== user.id) return;
    await api.post('/notifications/push-token', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (generation !== getAuthVersion() || (await getUser())?.id !== user.id) return;
    registeredToken = { token, owner, generation };
  } catch {
    // No push in Expo Go / permission denied / offline — never break the app.
  }
}

/** Stop alerts to this device (call while still authenticated, before clearing tokens). */
export async function unregisterPush(access?: string | null, generation?: number): Promise<void> {
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
