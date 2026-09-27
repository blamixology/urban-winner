"use server";

import { and, eq, inArray, max, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertCanAddProperty } from "@/lib/billing";
import { newCleanerToken } from "@/lib/cleaner";
import { rebuildTurnovers, syncAll, syncProperty } from "@/lib/sync";
import { randomToken } from "@/lib/token";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

async function ownProperty(id: string) {
  const user = await requireUser();
  const p = await db.query.properties.findFirst({ where: and(eq(s.properties.id, id), eq(s.properties.organizationId, user.organizationId)) });
  if (!p) throw new Error("Not found");
  return { user, property: p };
}

async function ownCleaner(organizationId: string, id: string) {
  return db.query.cleaners.findFirst({ where: and(eq(s.cleaners.id, id), eq(s.cleaners.organizationId, organizationId)) });
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
  await assertCanAddProperty(user.organization);
  const name = z.string().trim().min(1).max(120).parse(form.get("name"));
  const id = await db.transaction(async (tx) => {
    const [p] = await tx.insert(s.properties).values({ organizationId: user.organizationId, name }).returning({ id: s.properties.id });
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
  if (cleanerId && !(await ownCleaner(user.organizationId, cleanerId))) throw new Error("Bad cleaner");
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
  await db.insert(s.cleaners).values({ organizationId: user.organizationId, name, phone: phone || null, token: newCleanerToken() });
  revalidatePath("/app/cleaners");
}

export async function toggleCleaner(id: string) {
  const user = await requireUser();
  await db
    .update(s.cleaners)
    .set({ active: not(s.cleaners.active) })
    .where(and(eq(s.cleaners.id, id), eq(s.cleaners.organizationId, user.organizationId)));
  revalidatePath("/app/cleaners");
}

/** Revoke a leaked link by issuing a fresh token. */
export async function rotateCleanerLink(id: string) {
  const user = await requireUser();
  await db.update(s.cleaners).set({ token: newCleanerToken() }).where(and(eq(s.cleaners.id, id), eq(s.cleaners.organizationId, user.organizationId)));
  revalidatePath("/app/cleaners");
}

/** Which cleaners a property's team draws from. An empty selection means "anyone active" (back to the old behaviour). */
export async function setPropertyTeam(propertyId: string, form: FormData) {
  const { user } = await ownProperty(propertyId);
  const cleanerIds = form.getAll("cleanerIds").map(String);
  await db.transaction(async (tx) => {
    await tx.delete(s.propertyCleaners).where(eq(s.propertyCleaners.propertyId, propertyId));
    if (cleanerIds.length) {
      const owned = await tx.query.cleaners.findMany({ where: and(eq(s.cleaners.organizationId, user.organizationId), inArray(s.cleaners.id, cleanerIds)) });
      if (owned.length) await tx.insert(s.propertyCleaners).values(owned.map((c) => ({ propertyId, cleanerId: c.id })));
    }
  });
  revalidatePath(`/app/properties/${propertyId}`);
}

export async function assignTurnover(turnoverId: string, form: FormData) {
  const user = await requireUser();
  const cleanerId = String(form.get("cleanerId") || "") || null;
  const [t] = await db
    .select({ id: s.turnovers.id, propertyId: s.turnovers.propertyId })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .where(and(eq(s.turnovers.id, turnoverId), eq(s.properties.organizationId, user.organizationId)));
  if (!t) return;
  if (cleanerId) {
    if (!(await ownCleaner(user.organizationId, cleanerId))) return;
    const team = await db.select({ cleanerId: s.propertyCleaners.cleanerId }).from(s.propertyCleaners).where(eq(s.propertyCleaners.propertyId, t.propertyId));
    if (team.length > 0 && !team.some((m) => m.cleanerId === cleanerId)) return;
  }
  await db.update(s.turnovers).set({ cleanerId }).where(eq(s.turnovers.id, turnoverId));
  revalidatePath("/app");
}

/** A host clears a cleaner-reported issue after following up. */
export async function resolveIssue(turnoverId: string) {
  const user = await requireUser();
  const [t] = await db
    .select({ id: s.turnovers.id })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .where(and(eq(s.turnovers.id, turnoverId), eq(s.properties.organizationId, user.organizationId)));
  if (!t) return;
  await db.update(s.turnovers).set({ issueResolvedAt: new Date() }).where(eq(s.turnovers.id, turnoverId));
  revalidatePath("/app");
  revalidatePath("/app/issues");
}

export async function syncNow() {
  const user = await requireUser();
  await syncAll(user.organizationId);
  revalidatePath("/app");
}

/** Generates (or replaces) the organization's one pending invite link for a new teammate. */
export async function createInvite() {
  const user = await requireUser();
  await db.transaction(async (tx) => {
    await tx.delete(s.teamInvites).where(eq(s.teamInvites.organizationId, user.organizationId));
    await tx.insert(s.teamInvites).values({ organizationId: user.organizationId, token: randomToken() });
  });
  revalidatePath("/app/account");
}

export async function revokeInvite() {
  const user = await requireUser();
  await db.delete(s.teamInvites).where(eq(s.teamInvites.organizationId, user.organizationId));
  revalidatePath("/app/account");
}

export async function updateAccountPhone(form: FormData) {
  const user = await requireUser();
  const phone = z.string().trim().max(30).optional().parse(form.get("phone") || undefined);
  await db.update(s.users).set({ phone: phone || null }).where(eq(s.users.id, user.id));
  revalidatePath("/app/account");
}

/** Manual guest-identity entry for the SITUR register — iCal carries none of this. */
export async function saveGuestRegistration(turnoverId: string, form: FormData) {
  const user = await requireUser();
  const [t] = await db
    .select({ id: s.turnovers.id })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .where(and(eq(s.turnovers.id, turnoverId), eq(s.properties.organizationId, user.organizationId)));
  if (!t) return;
  const data = z
    .object({ guestName: z.string().trim().max(200).optional(), guestIdDoc: z.string().trim().max(64).optional(), guestCount: z.coerce.number().int().min(1).max(50).default(1) })
    .parse(Object.fromEntries(form));
  await db
    .insert(s.guestRegistrations)
    .values({ turnoverId, guestName: data.guestName || null, guestIdDoc: data.guestIdDoc || null, guestCount: data.guestCount })
    .onConflictDoUpdate({
      target: s.guestRegistrations.turnoverId,
      set: { guestName: data.guestName || null, guestIdDoc: data.guestIdDoc || null, guestCount: data.guestCount },
    });
  revalidatePath("/app/compliance");
}
