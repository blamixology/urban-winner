import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema as s } from "@/lib/db";
import { cleanerLink } from "@/lib/cleaner";
import { sendSms } from "@/lib/notify";
import { fmtDay, fmtTime } from "@/lib/time";
import { needsReminder } from "@/lib/turnovers";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Call every 30 min alongside /api/cron/sync: sends each cleaner a same-day-before SMS reminder, once. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await db
    .select({
      id: s.turnovers.id,
      status: s.turnovers.status,
      dueFrom: s.turnovers.dueFrom,
      remindedAt: s.turnovers.remindedAt,
      propertyName: s.properties.name,
      cleanerPhone: s.cleaners.phone,
      cleanerName: s.cleaners.name,
      cleanerToken: s.cleaners.token,
    })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .innerJoin(s.cleaners, eq(s.turnovers.cleanerId, s.cleaners.id))
    .where(and(eq(s.turnovers.status, "PENDING"), isNull(s.turnovers.remindedAt), eq(s.cleaners.active, true)));

  let sent = 0;
  const now = new Date();
  for (const t of rows) {
    if (!needsReminder(t, now) || !t.cleanerPhone) continue;
    const text = `Salut ${t.cleanerName}! Ai o curățenie mâine la ${t.propertyName}, ${fmtDay(t.dueFrom)} ora ${fmtTime(t.dueFrom)}. Detalii: ${cleanerLink(t.cleanerToken)}`;
    const ok = await sendSms(t.cleanerPhone, text);
    if (ok) {
      await db.update(s.turnovers).set({ remindedAt: now }).where(eq(s.turnovers.id, t.id));
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent });
}
