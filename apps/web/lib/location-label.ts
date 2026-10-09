/** Coordinate labels from earlier releases are display fallbacks, not addresses. */
export function isUnnamedLocation(label: string | null | undefined): boolean {
  return !label?.trim() || /^Pinned location(?:\s*\([^)]*\))?$/i.test(label.trim());
}

export function manualLocationLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').slice(0, 160);
}

export interface AddressResult {
  formatted_address: string;
  types: string[];
}

/** Prefer an address to a plus-code-only result. Never invent a house number. */
export function readableGeocodeResult(results: AddressResult[]): string | null {
  const address = results.find(result => result.formatted_address?.trim() && !result.types.includes('plus_code'));
  return address?.formatted_address.trim() || null;
}
