const pendingKey = (shopId: string, userId: string) => `sb:merchant-tour:pending:${shopId}:${userId}`;
const seenKey = (shopId: string, userId: string) => `sb:merchant-tour:seen:${shopId}:${userId}`;
const progressKey = (shopId: string, userId: string) => `sb:merchant-tour:progress:${shopId}:${userId}`;

export type MerchantTourProgress = { step: number; paused: boolean };

/** Keep an in-progress tour through route remounts, but not across browser sessions. */
export function readMerchantTourProgress(shopId: string, userId: string): MerchantTourProgress | null {
  try {
    const value = sessionStorage.getItem(progressKey(shopId, userId));
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const progress = parsed as Partial<MerchantTourProgress>;
    if (!Number.isInteger(progress.step) || (progress.step ?? -1) < 0 || typeof progress.paused !== 'boolean') return null;
    return { step: progress.step!, paused: progress.paused };
  } catch { return null; }
}

export function saveMerchantTourProgress(shopId: string, userId: string, progress: MerchantTourProgress) {
  try { sessionStorage.setItem(progressKey(shopId, userId), JSON.stringify(progress)); } catch { /* Storage is optional. */ }
}

export function clearMerchantTourProgress(shopId: string, userId: string) {
  try { sessionStorage.removeItem(progressKey(shopId, userId)); } catch { /* Storage is optional. */ }
}

/** Only a completed shop signup queues the automatic, one-time tour. */
export function queueFirstMerchantTour(shopId: string, userId: string) {
  try { localStorage.setItem(pendingKey(shopId, userId), '1'); } catch { /* Replay remains available. */ }
}

export function consumeFirstMerchantTour(shopId: string, userId: string) {
  try {
    if (localStorage.getItem(seenKey(shopId, userId)) || localStorage.getItem(pendingKey(shopId, userId)) !== '1') return false;
    localStorage.setItem(seenKey(shopId, userId), '1');
    localStorage.removeItem(pendingKey(shopId, userId));
    return true;
  } catch { return false; }
}
