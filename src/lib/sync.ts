import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "./db";
import { parseIcs, planSync } from "./ical";
import { planTurnovers } from "./turnovers";

const DAY = 24 * 60 * 60 * 1000;

export async function syncFeed(feedId: string): Promise<void> {
  const feed = await db.query.calendarFeeds.findFirst({ where: eq(s.calendarFeeds.id, feedId) });
  if (!feed) return;
  try {
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(20_000), cache: "no-store", redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const events = parseIcs(await res.text(), feed.source);
    const existing = await db
      .select({ uid: s.reservations.uid, end: s.reservations.end, cancelled: s.reservations.cancelled })
      .from(s.reservations)
      .where(eq(s.reservations.feedId, feedId));
    const plan = planSync(existing, events);

    await db.transaction(async (tx) => {
      if (plan.upsert.length) {
        await tx
          .insert(s.reservations)
          .values(plan.upsert.map((e) => ({ feedId, uid: e.uid, start: e.start, end: e.end, summary: e.summary })))
          .onConflictDoUpdate({
            target: [s.reservations.feedId, s.reservations.uid],
            set: {
              start: sql`excluded.start`,
              end: sql`excluded."end"`,
              summary: sql`excluded.summary`,
              cancelled: false,
              updatedAt: new Date(),
            },
          });
      }
      if (plan.cancelUids.length) {
        await tx
          .update(s.reservations)
          .set({ cancelled: true })
          .where(and(eq(s.reservations.feedId, feedId), inArray(s.reservations.uid, plan.cancelUids)));
      }
      await tx.update(s.calendarFeeds).set({ lastSyncedAt: new Date(), lastError: null }).where(eq(s.calendarFeeds.id, feedId));
    });
  } catch (err) {
    await db.update(s.calendarFeeds).set({ lastError: String(err).slice(0, 500) }).where(eq(s.calendarFeeds.id, feedId));
  }
}

/** Recompute turnovers for a property from its reservations. Only touches PENDING/CANCELLED ones. */
export async function rebuildTurnovers(propertyId: string): Promise<void> {
  const property = await db.query.properties.findFirst({ where: eq(s.properties.id, propertyId) });
  if (!property) return;

  const rows = await db
    .select({ r: s.reservations, source: s.calendarFeeds.source, t: s.turnovers })
    .from(s.reservations)
    .innerJoin(s.calendarFeeds, eq(s.reservations.feedId, s.calendarFeeds.id))
    .leftJoin(s.turnovers, eq(s.turnovers.reservationId, s.reservations.id))
    .where(and(eq(s.calendarFeeds.propertyId, propertyId), gte(s.reservations.end, new Date(Date.now() - DAY))));

  const plan = planTurnovers(
    rows.map(({ r, source }) => ({ id: r.id, start: r.start, end: r.end, cancelled: r.cancelled, source })),
    property,
  );
  const planned = new Set(plan.map((p) => p.reservationId));
  const byRes = new Map(rows.map((row) => [row.r.id, row]));

  await db.transaction(async (tx) => {
    for (const p of plan) {
      const t = byRes.get(p.reservationId)!.t;
      if (!t) {
        await tx.insert(s.turnovers).values({
          propertyId,
          reservationId: p.reservationId,
          cleanerId: property.defaultCleanerId,
          dueFrom: p.dueFrom,
          dueBy: p.dueBy,
          feeRon: property.feeRon,
        });
      } else if (t.status === "PENDING" || t.status === "CANCELLED") {
        await tx
          .update(s.turnovers)
          .set({ dueFrom: p.dueFrom, dueBy: p.dueBy, status: "PENDING", cleanerId: t.cleanerId ?? property.defaultCleanerId })
          .where(eq(s.turnovers.id, t.id));
      }
    }

    // Reservations that no longer produce a turnover (cancelled, deduped away).
    const orphaned = rows.filter(({ r, t }) => t && t.status === "PENDING" && !planned.has(r.id)).map(({ t }) => t!.id);
    if (orphaned.length) await tx.update(s.turnovers).set({ status: "CANCELLED" }).where(inArray(s.turnovers.id, orphaned));
  });
}

export async function syncProperty(propertyId: string): Promise<void> {
  const feeds = await db.select({ id: s.calendarFeeds.id }).from(s.calendarFeeds).where(eq(s.calendarFeeds.propertyId, propertyId));
  for (const f of feeds) await syncFeed(f.id);
  await rebuildTurnovers(propertyId);
}

export async function syncAll(ownerId?: string): Promise<number> {
  const props = await db
    .select({ id: s.properties.id })
    .from(s.properties)
    .where(ownerId ? eq(s.properties.ownerId, ownerId) : undefined);
  for (const p of props) await syncProperty(p.id);
  return props.length;
}
