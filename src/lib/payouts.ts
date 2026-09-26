import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, schema as s } from "./db";
import { dayInTz, zonedToUtc } from "./time";

export function monthRange(month: string | undefined): { month: string; from: Date; to: Date } {
  const m = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : dayInTz(new Date()).slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { month: m, from: zonedToUtc(`${m}-01`, "00:00"), to: zonedToUtc(`${next}-01`, "00:00") };
}

export async function payouts(ownerId: string, month?: string) {
  const range = monthRange(month);
  const done = await db
    .select({
      completedAt: s.turnovers.completedAt,
      feeRon: s.turnovers.feeRon,
      cleanerId: s.cleaners.id,
      cleanerName: s.cleaners.name,
      propertyName: s.properties.name,
    })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .leftJoin(s.cleaners, eq(s.turnovers.cleanerId, s.cleaners.id))
    .where(
      and(
        eq(s.properties.ownerId, ownerId),
        eq(s.turnovers.status, "DONE"),
        gte(s.turnovers.completedAt, range.from),
        lt(s.turnovers.completedAt, range.to),
      ),
    )
    .orderBy(asc(s.turnovers.completedAt));

  const perCleaner = new Map<string, { name: string; count: number; totalRon: number }>();
  for (const t of done) {
    const key = t.cleanerId ?? "-";
    const row = perCleaner.get(key) ?? { name: t.cleanerName ?? "Nealocat", count: 0, totalRon: 0 };
    row.count += 1;
    row.totalRon += t.feeRon;
    perCleaner.set(key, row);
  }
  return { ...range, rows: [...perCleaner.values()].sort((a, b) => a.name.localeCompare(b.name)), done };
}
