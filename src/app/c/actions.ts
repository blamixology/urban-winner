"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema as s } from "@/lib/db";
import { requireCleaner } from "@/lib/cleaner";
import { savePhoto } from "@/lib/photos";

async function ownTurnover(token: string, turnoverId: string) {
  const cleaner = await requireCleaner(token);
  const t = await db.query.turnovers.findFirst({ where: and(eq(s.turnovers.id, turnoverId), eq(s.turnovers.cleanerId, cleaner.id)) });
  if (!t) throw new Error("Not found");
  return t;
}

const refresh = (token: string, id: string) => revalidatePath(`/c/${token}/t/${id}`);

export async function startTurnover(token: string, id: string) {
  const t = await ownTurnover(token, id);
  if (t.status === "PENDING") await db.update(s.turnovers).set({ status: "IN_PROGRESS", startedAt: new Date() }).where(eq(s.turnovers.id, id));
  refresh(token, id);
}

export async function toggleCheck(token: string, id: string, itemId: string) {
  const t = await ownTurnover(token, id);
  const item = await db.query.checklistItems.findFirst({
    where: and(eq(s.checklistItems.id, itemId), eq(s.checklistItems.propertyId, t.propertyId)),
  });
  if (!item) return;
  const where = and(eq(s.turnoverChecks.turnoverId, id), eq(s.turnoverChecks.itemId, itemId));
  const deleted = await db.delete(s.turnoverChecks).where(where).returning();
  if (!deleted.length) await db.insert(s.turnoverChecks).values({ turnoverId: id, itemId }).onConflictDoNothing();
  refresh(token, id);
}

export async function uploadPhotos(token: string, id: string, form: FormData) {
  await ownTurnover(token, id);
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
  for (const f of files) {
    const path = await savePhoto(id, f);
    await db.insert(s.photos).values({ turnoverId: id, path });
  }
  refresh(token, id);
}

export async function finishTurnover(token: string, id: string, form: FormData) {
  await ownTurnover(token, id);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 2000) || null;
  const issue = form.get("issue") === "on";
  await db.update(s.turnovers).set({ status: issue ? "ISSUE" : "DONE", notes, completedAt: new Date() }).where(eq(s.turnovers.id, id));
  refresh(token, id);
}
