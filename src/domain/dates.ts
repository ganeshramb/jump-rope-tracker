// All dates in the app are local calendar dates as 'YYYY-MM-DD' strings.
// Never use toISOString() for these: it returns the UTC date, which is "yesterday"
// for the first hours of the day in timezones east of UTC (e.g. 00:00–05:30 in IST).

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return toISO(now);
}

/** Local midnight of the given date. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Day arithmetic goes through UTC so DST shifts can't produce 23h/25h "days".
function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function fromUtcDay(day: number): string {
  const d = new Date(day * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: string, n: number): string {
  return fromUtcDay(utcDay(iso) + n);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return utcDay(b) - utcDay(a);
}

/** Monday of the week containing iso. */
export function mondayOf(iso: string): string {
  const dow = new Date(utcDay(iso) * 86_400_000).getUTCDay(); // 0 = Sun
  return addDays(iso, -((dow + 6) % 7));
}

/** Excel stores dates as days since 1899-12-30 (this epoch absorbs Excel's fake 1900-02-29). */
export function excelSerialToISO(serial: number): string {
  return fromUtcDay(utcDay('1899-12-30') + Math.floor(serial));
}

const fmtWeekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const fmtDayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export const weekdayShort = (iso: string) => fmtWeekday.format(parseISO(iso));
export const dayMonth = (iso: string) => fmtDayMonth.format(parseISO(iso));
/** "Fri 27 Nov" */
export const longDate = (iso: string) => `${weekdayShort(iso)} ${dayMonth(iso)}`;
