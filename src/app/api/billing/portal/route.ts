import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe, stripeConfigured } from "@/lib/billing";

export async function POST() {
  if (!stripeConfigured()) return new NextResponse("Billing not configured", { status: 501 });
  const user = await requireUser();
  if (!user.stripeCustomerId) return new NextResponse("No subscription", { status: 400 });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${base}/app/billing`,
  });

  return NextResponse.redirect(session.url, { status: 303 });
}
