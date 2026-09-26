export const TZ = "Europe/Bucharest";

/** Offset (ms) of `tz` from UTC at instant `ts`. */
function tzOffset(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - (ts - (ts % 1000));
}

/** Wall-clock `day` (YYYY-MM-DD) + `time` (HH:mm) in `tz` → UTC Date. DST-safe. */
export function zonedToUtc(day: string, time: string, tz = TZ): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - tzOffset(guess, tz);
  ts = guess - tzOffset(ts, tz);
  return new Date(ts);
}

/** Calendar day (YYYY-MM-DD) of instant `date` as seen in `tz`. */
export function dayInTz(date: Date, tz = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function fmtTime(date: Date, tz = TZ): string {
  return new Intl.DateTimeFormat("ro-RO", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function fmtDay(date: Date, tz = TZ): string {
  return new Intl.DateTimeFormat("ro-RO", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(date);
}
