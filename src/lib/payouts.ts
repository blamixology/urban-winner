import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, schema as s } from "./db";
import { monthRange } from "./time";

export async function payouts(organizationId: string, month?: string) {
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
        eq(s.properties.organizationId, organizationId),
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
