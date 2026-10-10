export interface OperatingHours {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  closesNextDay: boolean;
}

const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function timeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PAKISTAN_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: WEEKDAY_INDEX[values.weekday], minute: Number(values.hour) * 60 + Number(values.minute) };
}

function minutes(value: string | null | undefined) {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

/** Merchant hours are local Pakistan wall-clock values, independent of server TZ. */
export function isWithinOperatingHours(schedule: OperatingHours[], now = new Date()) {
  const { day, minute } = timeParts(now);
  const byDay = new Map(schedule.map((entry) => [entry.dayOfWeek, entry]));
  const today = byDay.get(day);
  const previousDay = byDay.get((day + 6) % 7);

  if (today && !today.isClosed) {
    const start = minutes(today.opensAt);
    const end = minutes(today.closesAt);
    if (start !== null && end !== null && (today.closesNextDay ? minute >= start : minute >= start && minute < end)) return true;
  }

  if (previousDay && !previousDay.isClosed && previousDay.closesNextDay) {
    const end = minutes(previousDay.closesAt);
    if (end !== null && minute < end) return true;
  }
  return false;
}

export function merchantSchedule(
  schedule: OperatingHours[] | undefined,
  openingTime: string,
  closingTime: string,
): OperatingHours[] {
  if (schedule?.length) return schedule;
  const closesNextDay = minutes(closingTime) !== null && minutes(openingTime) !== null && minutes(closingTime)! <= minutes(openingTime)!;
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: false,
    opensAt: openingTime,
    closesAt: closingTime,
    closesNextDay,
  }));
}

export function isMerchantOpenAt(
  schedule: OperatingHours[] | undefined,
  openingTime: string,
  closingTime: string,
  now = new Date(),
) {
  if (!schedule?.length && (minutes(openingTime) === null || minutes(closingTime) === null)) return true;
  return isWithinOperatingHours(merchantSchedule(schedule, openingTime, closingTime), now);
}
