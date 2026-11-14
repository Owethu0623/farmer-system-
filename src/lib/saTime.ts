/**
 * Client-side South African Standard Time (Africa/Johannesburg, UTC+2) date/time helpers.
 */

export const SA_TIMEZONE = 'Africa/Johannesburg';

const sastDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const sastPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function getSastDateString(date: Date | number | string = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return sastDateFormatter.format(new Date());
  }
  return sastDateFormatter.format(d);
}

export function getSastDatetimeLocalInput(date: Date | number | string = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = sastPartsFormatter.formatToParts(safe);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const hour = map.hour === '24' ? '00' : map.hour || '00';
  return `${map.year || '1970'}-${map.month || '01'}-${map.day || '01'}T${hour}:${map.minute || '00'}`;
}

export function sastDaysAgo(days: number, from: Date = new Date()): string {
  const todayStr = getSastDateString(from);
  const anchor = new Date(`${todayStr}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() - Math.trunc(days));
  return anchor.toISOString().slice(0, 10);
}
