import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { FREE_PROPERTY_LIMIT } from "@/lib/billing";
import { createProperty } from "../actions";

export default async function Properties() {
  const user = await requireUser();
  const properties = await db
    .select({
      id: s.properties.id,
      name: s.properties.name,
      feeRon: s.properties.feeRon,
      cleanerName: s.cleaners.name,
      feeds: count(s.calendarFeeds.id),
    })
    .from(s.properties)
    .leftJoin(s.cleaners, eq(s.properties.defaultCleanerId, s.cleaners.id))
    .leftJoin(s.calendarFeeds, eq(s.calendarFeeds.propertyId, s.properties.id))
    .where(eq(s.properties.organizationId, user.organizationId))
    .groupBy(s.properties.id, s.cleaners.name)
    .orderBy(asc(s.properties.name));

  const atLimit = user.organization.plan === "FREE" && properties.length >= FREE_PROPERTY_LIMIT;

  return (
    <div className="space-y-6">
      <h1 className="h1">Proprietăți</h1>
      {atLimit ? (
        <div className="card border-amber-300 bg-amber-50 text-sm text-amber-900">
          Ai atins limita planului gratuit ({FREE_PROPERTY_LIMIT} proprietate).{" "}
          <Link href="/app/billing" className="underline">Treci la Pro</Link> pentru proprietăți nelimitate.
        </div>
      ) : (
        <form action={createProperty} className="card flex gap-2">
          <input name="name" required placeholder="ex. Ap. 2 camere Floreasca" className="input" />
          <button className="btn shrink-0">Adaugă</button>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {properties.map((p) => (
          <Link key={p.id} href={`/app/properties/${p.id}`} className="card hover:border-neutral-400">
            <div className="font-medium">{p.name}</div>
            <div className="mt-1 text-sm text-neutral-500">
              {p.feeds} calendar{p.feeds === 1 ? "" : "e"} · {p.cleanerName ?? "fără persoană implicită"} · {p.feeRon} lei/curățenie
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
