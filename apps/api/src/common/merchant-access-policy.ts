/** Informational trial only: elapsed time never disables merchant access. */
export function merchantTrial(createdAt: Date | string, now = new Date()) {
  const startedAt = new Date(createdAt);
  const endsAt = new Date(startedAt);
  const day = endsAt.getUTCDate();
  endsAt.setUTCDate(1);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(endsAt.getUTCFullYear(), endsAt.getUTCMonth() + 1, 0)).getUTCDate();
  endsAt.setUTCDate(Math.min(day, lastDay));
  return {
    startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString(),
    isInTrial: now >= startedAt && now < endsAt,
    accessContinuesAfterTrial: true,
  };
}
