/**
 * South African Standard Time (SAST, Africa/Johannesburg, UTC+2) utilities.
 * Ensures all agricultural logs, schedules, weather windows, and daily metrics
 * align with South African calendar dates rather than UTC midnight.
 */

export const SA_TIMEZONE = 'Africa/Johannesburg';

const sastDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const sastDateTimePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function getSastDateString(date: Date | number | string = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return sastDateFormatter.format(new Date());
  }
  return sastDateFormatter.format(d);
}

export function getSastDateTimeParts(date: Date | number | string = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const d = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = sastDateTimePartsFormatter.formatToParts(safe);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: map.year || '1970',
    month: map.month || '01',
    day: map.day || '01',
    hour: map.hour === '24' ? '00' : map.hour || '00',
    minute: map.minute || '00',
    second: map.second || '00',
  };
}

export function getSastIsoMinute(date: Date | number | string = new Date()): string {
  const p = getSastDateTimeParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}+02:00`;
}

export function getSastDatetimeLocalInput(date: Date | number | string = new Date()): string {
  const p = getSastDateTimeParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function sastDaysAgo(days: number, from: Date = new Date()): string {
  const todayStr = getSastDateString(from);
  const anchor = new Date(`${todayStr}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - Math.trunc(days));
  return anchor.toISOString().slice(0, 10);
}

export function sastDaysAhead(days: number, from: Date = new Date()): string {
  return sastDaysAgo(-days, from);
}

export function getSastMonth(date: Date | number | string = new Date()): number {
  const p = getSastDateTimeParts(date);
  return Number(p.month);
}

export function formatSastCompactStamp(date: Date | number | string = new Date()): string {
  const p = getSastDateTimeParts(date);
  return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}
