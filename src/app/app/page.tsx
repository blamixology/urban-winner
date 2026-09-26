import Link from "next/link";
import { and, asc, count, eq, gte, lt, ne } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dayInTz, fmtDay, fmtTime, zonedToUtc } from "@/lib/time";
import { isAtRisk } from "@/lib/turnovers";
import { assignTurnover, syncNow } from "./actions";
import { StatusBadge } from "./status";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const from = zonedToUtc(dayInTz(new Date()), "00:00");
  const to = new Date(from.getTime() + 8 * 24 * 60 * 60 * 1000);

  const [turnovers, cleaners, [{ n: propertyCount }]] = await Promise.all([
    db
      .select({
        id: s.turnovers.id,
        dueFrom: s.turnovers.dueFrom,
        dueBy: s.turnovers.dueBy,
        status: s.turnovers.status,
        cleanerId: s.turnovers.cleanerId,
        propertyName: s.properties.name,
      })
      .from(s.turnovers)
      .innerJoin(s.properties, eq(s.turnovers.propertyId, s.properties.id))
      .where(and(eq(s.properties.ownerId, user.id), gte(s.turnovers.dueFrom, from), lt(s.turnovers.dueFrom, to), ne(s.turnovers.status, "CANCELLED")))
      .orderBy(asc(s.turnovers.dueFrom)),
    db.query.cleaners.findMany({ where: and(eq(s.cleaners.ownerId, user.id), eq(s.cleaners.active, true)), orderBy: asc(s.cleaners.name) }),
    db.select({ n: count() }).from(s.properties).where(eq(s.properties.ownerId, user.id)),
  ]);

  const byDay = new Map<string, typeof turnovers>();
  for (const t of turnovers) {
    const k = dayInTz(t.dueFrom);
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  const unassigned = turnovers.filter((t) => !t.cleanerId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="h1">Următoarele 7 zile</h1>
        <form action={syncNow} className="ml-auto"><button className="btn-ghost">Sincronizează calendarele</button></form>
      </div>

      {propertyCount === 0 && (
        <div className="card">
          Începe prin a <Link className="underline" href="/app/properties">adăuga o proprietate</Link> și linkul iCal din Airbnb sau Booking.
        </div>
      )}
      {unassigned > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {unassigned} curățeni{unassigned === 1 ? "e" : "i"} fără persoană alocată.
        </div>
      )}
      {propertyCount > 0 && turnovers.length === 0 && <p className="text-neutral-500">Nicio curățenie programată.</p>}

      {[...byDay.entries()].map(([day, list]) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">{fmtDay(list[0].dueFrom)}</h2>
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {list.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-40 flex-1">
                  <div className="font-medium">{t.propertyName}</div>
                  <div className="text-sm text-neutral-500">{fmtTime(t.dueFrom)} → gata până la {fmtTime(t.dueBy)}{dayInTz(t.dueBy) !== day ? ` (${fmtDay(t.dueBy)})` : ""}</div>
                </div>
                <StatusBadge status={t.status} atRisk={isAtRisk(t)} />
                <form action={assignTurnover.bind(null, t.id)} className="flex gap-2">
                  <select name="cleanerId" defaultValue={t.cleanerId ?? ""} className="input w-40">
                    <option value="">— nealocat —</option>
                    {cleaners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button className="btn-ghost">Salvează</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
