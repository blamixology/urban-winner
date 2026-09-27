import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { db, schema as s } from "./db";
import { dayInTz, monthRange } from "./time";

/**
 * Monthly occupancy per property, for the SITUR unique-code declaration
 * (EU Reg. 2024/1028, in force from 20 May 2026). A stay is one non-cancelled
 * turnover's reservation — turnovers already dedupe the same booking synced
 * from two feeds down to a single row, so this can't double-count a guest.
 *
 * This reports arrivals/nights, not guest identity: iCal feeds don't carry
 * a guest name or ID document, so the mandatory guest register itself still
 * needs a manual entry point (or a PMS integration) — out of scope here.
 */
export interface OccupancyRow {
  turnoverId: string;
  propertyId: string;
  propertyName: string;
  siturCode: string | null;
  arrival: string; // YYYY-MM-DD, Europe/Bucharest
  departure: string;
  nights: number;
  guestName: string | null;
  guestIdDoc: string | null;
  guestCount: number;
}

function dayToUtcMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function nightsBetween(arrival: string, departure: string): number {
  return Math.round((dayToUtcMs(departure) - dayToUtcMs(arrival)) / (24 * 60 * 60 * 1000));
}

export async function occupancyReport(organizationId: string, month?: string) {
  const range = monthRange(month);
  const rows = await db
    .select({
      turnoverId: s.turnovers.id,
      propertyId: s.properties.id,
      propertyName: s.properties.name,
      siturCode: s.properties.siturCode,
      start: s.reservations.start,
      end: s.reservations.end,
      guestName: s.guestRegistrations.guestName,
      guestIdDoc: s.guestRegistrations.guestIdDoc,
      guestCount: s.guestRegistrations.guestCount,
    })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .innerJoin(s.reservations, eq(s.turnovers.reservationId, s.reservations.id))
    .leftJoin(s.guestRegistrations, eq(s.guestRegistrations.turnoverId, s.turnovers.id))
    .where(
      and(
        eq(s.properties.organizationId, organizationId),
        ne(s.turnovers.status, "CANCELLED"),
        gte(s.reservations.start, range.from),
        lt(s.reservations.start, range.to),
      ),
    )
    .orderBy(asc(s.properties.name), asc(s.reservations.start));

  const occupancy: OccupancyRow[] = rows.map((r) => {
    const arrival = dayInTz(r.start);
    const departure = dayInTz(r.end);
    return {
      turnoverId: r.turnoverId,
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      siturCode: r.siturCode,
      arrival,
      departure,
      nights: nightsBetween(arrival, departure),
      guestName: r.guestName,
      guestIdDoc: r.guestIdDoc,
      guestCount: r.guestCount ?? 1,
    };
  });

  const byProperty = new Map<string, { propertyName: string; siturCode: string | null; stays: number; nights: number }>();
  for (const o of occupancy) {
    const row = byProperty.get(o.propertyId) ?? { propertyName: o.propertyName, siturCode: o.siturCode, stays: 0, nights: 0 };
    row.stays += 1;
    row.nights += o.nights;
    byProperty.set(o.propertyId, row);
  }

  return { ...range, occupancy, totals: [...byProperty.entries()].map(([propertyId, v]) => ({ propertyId, ...v })) };
}
