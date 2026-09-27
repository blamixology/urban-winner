import { and, eq, gte, inArray } from "drizzle-orm";
import { db, schema as s } from "./db";

export interface CleanerStat {
  cleanerId: string;
  name: string;
  completed: number;
  issues: number;
  avgMinutes: number | null;
}

/** Completed/issue counts and average turnaround (start→done) per cleaner, over the last `sinceDays`. */
export async function cleanerStats(organizationId: string, sinceDays = 90): Promise<CleanerStat[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      cleanerId: s.cleaners.id,
      name: s.cleaners.name,
      status: s.turnovers.status,
      startedAt: s.turnovers.startedAt,
      completedAt: s.turnovers.completedAt,
    })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .innerJoin(s.cleaners, eq(s.turnovers.cleanerId, s.cleaners.id))
    .where(and(eq(s.properties.organizationId, organizationId), gte(s.turnovers.createdAt, since), inArray(s.turnovers.status, ["DONE", "ISSUE"])));

  const byCleaner = new Map<string, { name: string; completed: number; issues: number; minutes: number[] }>();
  for (const r of rows) {
    const row = byCleaner.get(r.cleanerId) ?? { name: r.name, completed: 0, issues: 0, minutes: [] };
    if (r.status === "DONE") row.completed += 1;
    if (r.status === "ISSUE") row.issues += 1;
    if (r.startedAt && r.completedAt) row.minutes.push((r.completedAt.getTime() - r.startedAt.getTime()) / 60_000);
    byCleaner.set(r.cleanerId, row);
  }

  return [...byCleaner.entries()]
    .map(([cleanerId, v]) => ({
      cleanerId,
      name: v.name,
      completed: v.completed,
      issues: v.issues,
      avgMinutes: v.minutes.length ? Math.round(v.minutes.reduce((a, b) => a + b, 0) / v.minutes.length) : null,
    }))
    .sort((a, b) => b.completed - a.completed);
}
