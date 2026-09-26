import { dayInTz, zonedToUtc } from "./time";

export type FeedSourceT = "AIRBNB" | "BOOKING" | "OTHER";

export interface ResLike {
  id: string;
  start: Date;
  end: Date;
  cancelled: boolean;
  source: FeedSourceT;
}

export interface PropertyTimes {
  checkInTime: string; // HH:mm
  checkOutTime: string; // HH:mm
}

export interface PlannedTurnover {
  reservationId: string;
  dueFrom: Date;
  dueBy: Date;
}

// When the same stay shows up in several feeds (e.g. Booking re-exports an
// imported Airbnb booking as "CLOSED - Not available"), keep the richest source.
const SOURCE_PRIORITY: Record<FeedSourceT, number> = { AIRBNB: 0, OTHER: 1, BOOKING: 2 };

/**
 * One turnover per checkout day per property.
 * Window: checkout day @ checkOutTime → next check-in day @ checkInTime.
 * With no next booking known, the unit must be ready by the same day's check-in
 * time (so last-minute bookings are safe).
 */
export function planTurnovers(reservations: ResLike[], p: PropertyTimes): PlannedTurnover[] {
  const active = reservations.filter((r) => !r.cancelled);

  const byCheckoutDay = new Map<string, ResLike>();
  for (const r of active) {
    const day = dayInTz(r.end);
    const cur = byCheckoutDay.get(day);
    if (!cur || SOURCE_PRIORITY[r.source] < SOURCE_PRIORITY[cur.source]) byCheckoutDay.set(day, r);
  }

  const checkInDays = [...new Set(active.map((r) => dayInTz(r.start)))].sort();

  const out: PlannedTurnover[] = [];
  for (const [day, r] of [...byCheckoutDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const nextIn = checkInDays.find((d) => d >= day) ?? day;
    const dueFrom = zonedToUtc(day, p.checkOutTime);
    let dueBy = zonedToUtc(nextIn, p.checkInTime);
    if (dueBy <= dueFrom) dueBy = zonedToUtc(day, "23:59");
    out.push({ reservationId: r.id, dueFrom, dueBy });
  }
  return out;
}

/** Airbnb exports owner blocks as "Airbnb (Not available)" — those aren't stays. */
export function isBlock(source: FeedSourceT, summary: string | undefined | null): boolean {
  return source === "AIRBNB" && /not available/i.test(summary ?? "");
}

/** Turnover is at risk when not started and the next check-in is within 1h. */
export function isAtRisk(t: { status: string; dueBy: Date }, now = new Date()): boolean {
  return t.status === "PENDING" && t.dueBy.getTime() - now.getTime() < 60 * 60 * 1000;
}
