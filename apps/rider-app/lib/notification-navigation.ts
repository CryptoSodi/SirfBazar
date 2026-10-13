import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api, getAuthVersion, getUser } from './api';
import { canReceivePush } from './push';

type Destination = { data: any; owner: string; generation: number; key: string };
const orderTypes = new Set(["RIDER_ASSIGNED","ORDER_CANCELLED"]);

export function createOrderPushNavigation(navigation: { isReady(): boolean; openOrder(id: string): void }) {
  let pending: Destination | null = null;
  let disposed = false;
  let sequence = 0;
  const handled = new Set<string>();

  async function flush() {
    const item = pending;
    const current = sequence;
    if (disposed || !item || !navigation.isReady()) return;
    pending = null;
    try {
      if (item.generation !== getAuthVersion() || (await getUser())?.id !== item.owner ||
          !await canReceivePush(item.data)) return;
      // Confirm current assignment/ownership on the API, not from the push payload.
      const order = await api.get(`/rider/orders/${encodeURIComponent(item.data.referenceId)}`);
      if (disposed || current !== sequence || item.generation !== getAuthVersion() || (await getUser())?.id !== item.owner ||
          !await canReceivePush(item.data) || !navigation.isReady() || order?.id !== item.data.referenceId) return;
      if (handled.has(item.key)) return;
      handled.add(item.key);
      if (handled.size > 50) handled.delete(handled.values().next().value!);
      navigation.openOrder(order.id);
    } catch {
      // Offline, expired or reassigned orders remain accessible through the normal list.
    }
  }

  async function receive(response: any) {
    const request = response?.notification?.request;
    const data = request?.content?.data;
    if (disposed || data?.audience !== 'RIDER' || !orderTypes.has(data?.type) ||
        typeof data.referenceId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.referenceId)) return;
    const current = ++sequence;
    const generation = getAuthVersion();
    const user = await getUser();
    if (!user?.id || !await canReceivePush(data) || disposed || sequence !== current || generation !== getAuthVersion()) return;
    const key = `${generation}:${request.identifier ?? data.type + ':' + data.referenceId}`;
    if (handled.has(key)) return;
    pending = { data, owner: user.id, generation, key };
    await flush();
  }

  function start() {
    if (Platform.OS === 'web') return () => undefined;
    disposed = false;
    const subscription = Notifications.addNotificationResponseReceivedListener(response => { void receive(response).catch(() => undefined); });
    void Notifications.getLastNotificationResponseAsync().then(async response => {
      if (response && !disposed) {
        await receive(response);
        if (!disposed) await Notifications.clearLastNotificationResponseAsync();
      }
    }).catch(() => undefined);
    return () => { disposed = true; pending = null; sequence++; subscription.remove(); };
  }

  return { start, receive, flush };
}
