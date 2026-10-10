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

export function addCalendarMonthUtc(start: Date) {
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export function merchantPosTrialView(
  trial: { optedIn: boolean; startedAt: Date | null; endsAt: Date | null } | null,
  now = new Date(),
) {
  if (!trial) return { status: 'LEGACY', optedIn: null, salesEnabled: true, startedAt: null, endsAt: null, remainingMilliseconds: null };
  if (!trial.optedIn) return { status: 'DECLINED', optedIn: false, salesEnabled: false, startedAt: trial.startedAt?.toISOString() ?? null, endsAt: trial.endsAt?.toISOString() ?? null, remainingMilliseconds: 0 };
  const startedAt = trial.startedAt?.toISOString() ?? null;
  const endsAt = trial.endsAt?.toISOString() ?? null;
  const salesEnabled = !!trial.startedAt && !!trial.endsAt && now >= trial.startedAt && now < trial.endsAt;
  return {
    status: salesEnabled ? 'ACTIVE' : 'EXPIRED',
    optedIn: true,
    salesEnabled,
    startedAt,
    endsAt,
    remainingMilliseconds: trial.endsAt ? Math.max(0, trial.endsAt.getTime() - now.getTime()) : 0,
  };
}
