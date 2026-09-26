"use server";

import { and, eq, max, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertCanAddProperty } from "@/lib/billing";
import { newCleanerToken } from "@/lib/cleaner";
import { rebuildTurnovers, syncAll, syncProperty } from "@/lib/sync";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

async function ownProperty(id: string) {
  const user = await requireUser();
  const p = await db.query.properties.findFirst({ where: and(eq(s.properties.id, id), eq(s.properties.ownerId, user.id)) });
  if (!p) throw new Error("Not found");
  return { user, property: p };
}

async function ownCleaner(ownerId: string, id: string) {
  return db.query.cleaners.findFirst({ where: and(eq(s.cleaners.id, id), eq(s.cleaners.ownerId, ownerId)) });
}

const DEFAULT_CHECKLIST = [
  "Lenjerie schimbată",
  "Prosoape curate",
  "Baie dezinfectată",
  "Bucătărie curată, vase spălate",
  "Gunoiul scos",
  "Consumabile completate (hârtie, săpun, cafea)",
  "Aspirat și spălat pe jos",
  "Poze finale făcute",
];

export async function createProperty(form: FormData) {
  const user = await requireUser();
  await assertCanAddProperty(user);
  const name = z.string().trim().min(1).max(120).parse(form.get("name"));
  const id = await db.transaction(async (tx) => {
    const [p] = await tx.insert(s.properties).values({ ownerId: user.id, name }).returning({ id: s.properties.id });
    await tx.insert(s.checklistItems).values(DEFAULT_CHECKLIST.map((label, position) => ({ propertyId: p.id, label, position })));
    return p.id;
  });
  redirect(`/app/properties/${id}`);
}

export async function updateProperty(id: string, form: FormData) {
  const { user } = await ownProperty(id);
  const data = z
    .object({
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(250).optional(),
      checkInTime: hhmm,
      checkOutTime: hhmm,
      feeRon: z.coerce.number().int().min(0).max(100_000),
      siturCode: z.string().trim().max(64).optional(),
      defaultCleanerId: z.string().optional(),
    })
    .parse(Object.fromEntries(form));
  const cleanerId = data.defaultCleanerId || null;
  if (cleanerId && !(await ownCleaner(user.id, cleanerId))) throw new Error("Bad cleaner");
  await db
    .update(s.properties)
    .set({ ...data, address: data.address || null, siturCode: data.siturCode || null, defaultCleanerId: cleanerId })
    .where(eq(s.properties.id, id));
  await rebuildTurnovers(id);
  revalidatePath(`/app/properties/${id}`);
}

export async function addFeed(propertyId: string, form: FormData) {
  await ownProperty(propertyId);
  const { url, source } = z
    .object({
      url: z.string().trim().url().refine((u) => u.startsWith("https://"), "https only"),
      source: z.enum(["AIRBNB", "BOOKING", "OTHER"]),
    })
    .parse(Object.fromEntries(form));
  await db.insert(s.calendarFeeds).values({ propertyId, url, source });
  await syncProperty(propertyId);
  revalidatePath(`/app/properties/${propertyId}`);
}

export async function removeFeed(propertyId: string, feedId: string) {
  await ownProperty(propertyId);
  await db.delete(s.calendarFeeds).where(and(eq(s.calendarFeeds.id, feedId), eq(s.calendarFeeds.propertyId, propertyId)));
  await rebuildTurnovers(propertyId);
  revalidatePath(`/app/properties/${propertyId}`);
}

export async function addChecklistItem(propertyId: string, form: FormData) {
  await ownProperty(propertyId);
  const label = z.string().trim().min(1).max(200).parse(form.get("label"));
  const [{ m }] = await db.select({ m: max(s.checklistItems.position) }).from(s.checklistItems).where(eq(s.checklistItems.propertyId, propertyId));
  await db.insert(s.checklistItems).values({ propertyId, label, position: (m ?? -1) + 1 });
  revalidatePath(`/app/properties/${propertyId}`);
}

export async function removeChecklistItem(propertyId: string, itemId: string) {
  await ownProperty(propertyId);
  await db.delete(s.checklistItems).where(and(eq(s.checklistItems.id, itemId), eq(s.checklistItems.propertyId, propertyId)));
  revalidatePath(`/app/properties/${propertyId}`);
}

export async function createCleaner(form: FormData) {
  const user = await requireUser();
  const { name, phone } = z
    .object({ name: z.string().trim().min(1).max(100), phone: z.string().trim().max(30).optional() })
    .parse(Object.fromEntries(form));
  await db.insert(s.cleaners).values({ ownerId: user.id, name, phone: phone || null, token: newCleanerToken() });
  revalidatePath("/app/cleaners");
}

export async function toggleCleaner(id: string) {
  const user = await requireUser();
  await db
    .update(s.cleaners)
    .set({ active: not(s.cleaners.active) })
    .where(and(eq(s.cleaners.id, id), eq(s.cleaners.ownerId, user.id)));
  revalidatePath("/app/cleaners");
}

/** Revoke a leaked link by issuing a fresh token. */
export async function rotateCleanerLink(id: string) {
  const user = await requireUser();
  await db.update(s.cleaners).set({ token: newCleanerToken() }).where(and(eq(s.cleaners.id, id), eq(s.cleaners.ownerId, user.id)));
  revalidatePath("/app/cleaners");
}

export async function assignTurnover(turnoverId: string, form: FormData) {
  const user = await requireUser();
  const cleanerId = String(form.get("cleanerId") || "") || null;
  const [t] = await db
    .select({ id: s.turnovers.id })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .where(and(eq(s.turnovers.id, turnoverId), eq(s.properties.ownerId, user.id)));
  if (!t) return;
  if (cleanerId && !(await ownCleaner(user.id, cleanerId))) return;
  await db.update(s.turnovers).set({ cleanerId }).where(eq(s.turnovers.id, turnoverId));
  revalidatePath("/app");
}

export async function syncNow() {
  const user = await requireUser();
  await syncAll(user.id);
  revalidatePath("/app");
}
