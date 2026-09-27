import "server-only";
import Stripe from "stripe";
import { count, eq } from "drizzle-orm";
import { db, schema as s } from "./db";

/** Free: 1 property. Beyond that a host needs the Pro plan. */
export const FREE_PROPERTY_LIMIT = 1;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

let client: Stripe | undefined;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

export async function propertyCount(organizationId: string): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(s.properties).where(eq(s.properties.organizationId, organizationId));
  return n;
}

/** Throws with a host-facing message when adding one more property would exceed the Free plan. */
export async function assertCanAddProperty(org: { id: string; plan: string }): Promise<void> {
  if (org.plan === "PRO") return;
  if ((await propertyCount(org.id)) >= FREE_PROPERTY_LIMIT) {
    throw new Error(`Planul gratuit include ${FREE_PROPERTY_LIMIT} proprietate. Treci la Pro din pagina Abonament pentru mai multe.`);
  }
}
