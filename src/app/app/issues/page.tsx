import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDay, fmtTime } from "@/lib/time";
import { resolveIssue } from "../actions";

export const dynamic = "force-dynamic";

export default async function Issues() {
  const user = await requireUser();
  const rows = await db
    .select({
      id: s.turnovers.id,
      dueFrom: s.turnovers.dueFrom,
      notes: s.turnovers.notes,
      propertyName: s.properties.name,
      cleanerName: s.cleaners.name,
    })
    .from(s.turnovers)
    .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
    .leftJoin(s.cleaners, eq(s.turnovers.cleanerId, s.cleaners.id))
    .where(and(eq(s.properties.organizationId, user.organizationId), eq(s.turnovers.status, "ISSUE"), isNull(s.turnovers.issueResolvedAt)))
    .orderBy(asc(s.turnovers.dueFrom));

  return (
    <div className="space-y-6">
      <h1 className="h1">Probleme raportate</h1>
      {rows.length === 0 && <p className="text-neutral-500">Nicio problemă deschisă. Bravo!</p>}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.propertyName}</span>
              <span className="text-sm text-neutral-500">
                {fmtDay(r.dueFrom)}, {fmtTime(r.dueFrom)} · {r.cleanerName ?? "nealocat"}
              </span>
              <form action={resolveIssue.bind(null, r.id)} className="ml-auto">
                <button className="btn-ghost">Rezolvat</button>
              </form>
            </div>
            {r.notes && <p className="text-sm text-neutral-700">{r.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
