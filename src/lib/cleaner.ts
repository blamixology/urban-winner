import "server-only";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema as s } from "./db";
import { randomToken } from "./token";

export const newCleanerToken = randomToken;

/** Cleaners authenticate by the unguessable token in their link. */
export async function requireCleaner(token: string) {
  const cleaner = await db.query.cleaners.findFirst({ where: eq(s.cleaners.token, token) });
  if (!cleaner || !cleaner.active) notFound();
  return cleaner;
}

export function cleanerLink(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/c/${token}`;
}

/** wa.me share link — the zero-cost "notification" until we wire the WhatsApp API. */
export function whatsappShare(phone: string | null, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^0/, "40");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
