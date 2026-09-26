import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, schema as s } from "@/lib/db";
import { stripe, stripeConfigured } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function setPlan(subscription: Stripe.Subscription) {
  const active = subscription.status === "active" || subscription.status === "trialing";
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  await db
    .update(s.users)
    .set({ plan: active ? "PRO" : "FREE", stripeSubscriptionId: active ? subscription.id : null })
    .where(eq(s.users.stripeCustomerId, customerId));
}

export async function POST(req: NextRequest) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) return new NextResponse("Billing not configured", { status: 501 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new NextResponse(`Bad signature: ${err}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (userId && customerId) {
        await db
          .update(s.users)
          .set({ plan: "PRO", stripeCustomerId: customerId, stripeSubscriptionId: (session.subscription as string) ?? null })
          .where(eq(s.users.id, userId));
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await setPlan(event.data.object as Stripe.Subscription);
      break;
  }

  return NextResponse.json({ received: true });
}
