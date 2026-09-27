import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe, stripeConfigured } from "@/lib/billing";

export async function POST() {
  if (!stripeConfigured()) return new NextResponse("Billing not configured", { status: 501 });
  const user = await requireUser();
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: user.organizationId,
    customer: user.organization.stripeCustomerId ?? undefined,
    customer_email: user.organization.stripeCustomerId ? undefined : user.email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${base}/app/billing?checkout=success`,
    cancel_url: `${base}/app/billing?checkout=cancelled`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
