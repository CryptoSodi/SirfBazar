import { api, ApiError } from './api';
import { readProfile } from './merchant-contracts';

type SavedAvailability = { isOnline: boolean; isOpen: boolean };

function confirmed(value: unknown): SavedAvailability {
  if (!value || typeof value !== 'object' || typeof (value as SavedAvailability).isOnline !== 'boolean' || typeof (value as SavedAvailability).isOpen !== 'boolean') {
    throw new ApiError('contract', 'The saved shop availability could not be confirmed.');
  }
  return value as SavedAvailability;
}

/** The fallback keeps local clients compatible until the matching API is deployed. */
export async function setShopAvailability(open: boolean): Promise<SavedAvailability> {
  try {
    return confirmed(await api.post('/merchant/availability', { open }));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  // An older API has two independent flags. Keep the shop unavailable until
  // the second write succeeds, then confirm the persisted state from profile.
  if (open) {
    await api.post('/merchant/open');
    await api.post('/merchant/online');
  } else {
    await api.post('/merchant/offline');
    await api.post('/merchant/close');
  }
  return confirmed(await api.getParsed('/merchant/profile', readProfile));
}
