import AsyncStorage from '@react-native-async-storage/async-storage';
export const CHECKOUT_DRAFT_KEY = 'sb.checkoutDraft.v1';
export type DeliveryPoint = {
    latitude: number;
    longitude: number;
};
export type CheckoutDraft = {
    version: 1;
    fullAddress: string;
    city: string;
    contactName: string;
    contactPhone: string;
    instructions: string;
    customerNote: string;
    point: DeliveryPoint | null;
    ownedAddress?: {
        accountId: string;
        addressId: string;
        fingerprint: string;
    };
};
export function emptyCheckoutDraft(): CheckoutDraft {
    return { version: 1, fullAddress: '', city: '', contactName: '', contactPhone: '', instructions: '', customerNote: '', point: null };
}
export function isDeliveryPoint(point: any): point is DeliveryPoint {
    return !!point && typeof point.latitude === 'number' && Number.isFinite(point.latitude) &&
        Math.abs(point.latitude) <= 90 && typeof point.longitude === 'number' &&
        Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}
/** Whitelist persisted fields: authentication codes/tokens never belong in this record. */
export function parseCheckoutDraft(raw: string | null): CheckoutDraft {
    const empty = emptyCheckoutDraft();
    if (!raw)
        return empty;
    try {
        const value = JSON.parse(raw);
        if (value?.version !== 1)
            return empty;
        for (const key of ['fullAddress', 'city', 'contactName', 'contactPhone', 'instructions', 'customerNote'] as const) {
            empty[key] = typeof value[key] === 'string' ? value[key] : '';
        }
        empty.point = isDeliveryPoint(value.point) ? { latitude: value.point.latitude, longitude: value.point.longitude } : null;
        const owned = value.ownedAddress;
        if (owned && ['accountId', 'addressId', 'fingerprint'].every((key) => typeof owned[key] === 'string' && owned[key])) {
            empty.ownedAddress = { accountId: owned.accountId, addressId: owned.addressId, fingerprint: owned.fingerprint };
        }
        return empty;
    }
    catch {
        return empty;
    }
}
let writes: Promise<void> = Promise.resolve();
export async function readCheckoutDraft() {
    await writes.catch(() => undefined);
    return parseCheckoutDraft(await AsyncStorage.getItem(CHECKOUT_DRAFT_KEY));
}
export function writeCheckoutDraft(draft: CheckoutDraft) {
    const serialized = JSON.stringify(parseCheckoutDraft(JSON.stringify(draft)));
    const pending = writes.catch(() => undefined).then(() => AsyncStorage.setItem(CHECKOUT_DRAFT_KEY, serialized));
    writes = pending;
    return pending;
}
export function draftForAccount(draft: CheckoutDraft, accountId: string | null): CheckoutDraft {
    if (!draft.ownedAddress || draft.ownedAddress.accountId === accountId)
        return draft;
    const { ownedAddress: _owned, ...retained } = draft;
    return retained;
}
export function addressPayload(draft: CheckoutDraft) {
    return {
        label: 'Delivery', fullAddress: draft.fullAddress.trim(), city: draft.city.trim(),
        contactName: draft.contactName.trim() || undefined,
        contactPhone: draft.contactPhone.trim() || undefined,
        instructions: draft.instructions.trim() || undefined,
        latitude: draft.point?.latitude, longitude: draft.point?.longitude,
    };
}
export function addressFingerprint(address: any) {
    return JSON.stringify([
        ...['fullAddress', 'city', 'contactName', 'contactPhone', 'instructions'].map((key) => String(address?.[key] ?? '').trim()),
        address?.latitude == null ? null : Number(address.latitude).toFixed(6),
        address?.longitude == null ? null : Number(address.longitude).toFixed(6),
    ]);
}
export function draftFromAddress(address: any, accountId: string, previous = emptyCheckoutDraft()): CheckoutDraft {
    const draft: CheckoutDraft = {
        ...previous, fullAddress: address.fullAddress ?? '', city: address.city ?? '',
        contactName: address.contactName ?? '', contactPhone: address.contactPhone ?? '', instructions: address.instructions ?? '',
        point: isDeliveryPoint(address) ? { latitude: address.latitude, longitude: address.longitude } : null,
    };
    draft.ownedAddress = { accountId, addressId: address.id, fingerprint: addressFingerprint(addressPayload(draft)) };
    return draft;
}
export function validateCheckoutDraft(draft: CheckoutDraft) {
    const errors: Partial<Record<keyof CheckoutDraft, string>> = {};
    if (!draft.fullAddress.trim())
        errors.fullAddress = 'Enter your house, street and area.';
    if (!draft.city.trim())
        errors.city = 'Enter your city.';
    if (!isDeliveryPoint(draft.point))
        errors.point = 'Confirm the delivery pin on the map or use your current location.';
    if (draft.contactPhone.trim() && !/^(?:\+92|92|0)3\d{9}$/.test(draft.contactPhone.replace(/[\s()-]/g, ''))) {
        errors.contactPhone = 'Use a Pakistani mobile number, for example 0300 1234567.';
    }
    return errors;
}
/** Compare every quoted monetary value, destination, seller, item identity/quantity/availability.
 * Ignore timestamps/images so an unchanged refresh never creates a false price-change warning. */
export function quoteFingerprint(cart: any, point?: DeliveryPoint | null): string {
    const monetary = (entry: any) => Object.fromEntries(Object.keys(entry ?? {}).sort()
        .filter((key) => /Paisa$|couponCode|couponError|currency/.test(key))
        .map((key) => [key, entry[key]]));
    return JSON.stringify({
        id: cart?.id, itemCount: cart?.itemCount, ...monetary(cart),
        point: point ? [point.latitude, point.longitude] : null,
        groups: (cart?.groups ?? []).map((group: any) => ({
            merchantId: group.merchantId ?? group.merchant?.id, ...monetary(group),
            items: (group.items ?? []).map((item: any) => ({
                id: item.id, merchantProductId: item.merchantProductId, productId: item.productId,
                quantity: item.quantity, inStock: item.inStock, stockQuantity: item.stockQuantity,
                ...monetary(item),
            })),
        })),
    });
}
/** An incomplete quote must never present an actionable financial commitment. */
export function hasUsableCheckoutQuote(cart: any): boolean {
    const money = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
    return typeof cart?.id === 'string' && !!cart.id && !cart.couponError && Number.isSafeInteger(cart.itemCount) && cart.itemCount > 0 &&
        ['subtotalPaisa', 'deliveryFeePaisa', 'serviceFeePaisa', 'totalPaisa'].every((key) => money(cart[key])) &&
        Array.isArray(cart.groups) && cart.groups.length > 0 && cart.groups.every((group: any) =>
            money(group.deliveryFeePaisa) && Array.isArray(group.items) && group.items.length > 0 &&
            group.items.every((item: any) => Number.isSafeInteger(item.quantity) && item.quantity > 0 && money(item.unitPricePaisa)));
}

/** Timeouts/conflicts may follow a committed write; retain their recovery markers. */
export function isDefinitiveCheckoutRejection(status: unknown) {
    return typeof status === 'number' && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 409;
}

/** Recovery may reuse the payload only for the original cart and unchanged saved address. */
export function checkoutRecoveryProblem(stored: any, cart: any, address: any): string | null {
    if (!stored?.payload?.requestId || !stored.payload.cartId || !stored.payload.deliveryAddressId)
        return 'This checkout has no complete recovery reference. Check order history or contact support before trying again.';
    if (!address || address.id !== stored.payload.deliveryAddressId || !isDeliveryPoint(address) ||
        !stored.addressFingerprint || addressFingerprint(address) !== stored.addressFingerprint)
        return 'The original delivery address could not be confirmed unchanged. Contact support before retrying this checkout. Your reference is retained.';
    if (cart?.id !== stored.payload.cartId)
        return 'The original basket could not be confirmed. Check order history or contact support before trying again. Your reference is retained.';
    if (cart.couponError)
        return 'Your promo code is no longer eligible. Remove it or apply an eligible code in your basket, then check this saved checkout again.';
    if (!hasUsableCheckoutQuote(cart))
        return 'The current basket and charges could not be confirmed. Check your basket before retrying this saved checkout.';
    return null;
}
