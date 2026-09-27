import { requireUser } from "@/lib/auth";
import { FREE_PROPERTY_LIMIT, propertyCount, stripeConfigured } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function Billing({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const user = await requireUser();
  const { checkout } = await searchParams;
  const properties = await propertyCount(user.organizationId);
  const configured = stripeConfigured();
  const org = user.organization;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="h1">Abonament</h1>

      {checkout === "success" && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">Plată confirmată — mulțumim!</div>
      )}
      {checkout === "cancelled" && (
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">Plata a fost anulată.</div>
      )}

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Plan curent</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${org.plan === "PRO" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-700"}`}>
            {org.plan === "PRO" ? "Pro" : "Gratuit"}
          </span>
        </div>
        <div className="text-sm text-neutral-500">
          {properties} {properties === 1 ? "proprietate" : "proprietăți"} {org.plan === "FREE" && `din ${FREE_PROPERTY_LIMIT} inclusă`}
        </div>

        {!configured && (
          <p className="text-sm text-neutral-500">Plățile online nu sunt încă activate pentru acest cont.</p>
        )}
        {configured && org.plan === "FREE" && (
          <form action="/api/billing/checkout" method="POST">
            <button className="btn w-full">Treci la Pro — 25 lei/proprietate/lună</button>
          </form>
        )}
        {configured && org.plan === "PRO" && org.stripeCustomerId && (
          <form action="/api/billing/portal" method="POST">
            <button className="btn-ghost w-full">Gestionează abonamentul</button>
          </form>
        )}
      </div>
    </div>
  );
}
