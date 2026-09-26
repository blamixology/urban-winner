import Link from "next/link";
import { and, asc, eq, gte, ne } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireCleaner } from "@/lib/cleaner";
import { dayInTz, fmtDay, fmtTime, zonedToUtc } from "@/lib/time";
import { StatusBadge } from "@/app/app/status";

export const dynamic = "force-dynamic";

export default async function CleanerHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cleaner = await requireCleaner(token);
  const from = zonedToUtc(dayInTz(new Date()), "00:00");
  const turnovers = await db.query.turnovers.findMany({
    where: and(eq(s.turnovers.cleanerId, cleaner.id), gte(s.turnovers.dueFrom, from), ne(s.turnovers.status, "CANCELLED")),
    with: { property: { columns: { name: true, address: true } } },
    orderBy: asc(s.turnovers.dueFrom),
    limit: 30,
  });

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="h1">Salut, {cleaner.name}!</h1>
      <p className="mt-1 text-sm text-neutral-500">Curățeniile tale programate</p>
      <div className="mt-6 space-y-3">
        {turnovers.length === 0 && <p className="text-neutral-500">Nimic programat momentan.</p>}
        {turnovers.map((t) => (
          <Link key={t.id} href={`/c/${token}/t/${t.id}`} className="card block active:bg-neutral-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{fmtDay(t.dueFrom)}</div>
                <div className="mt-1 font-medium">{t.property.name}</div>
                {t.property.address && <div className="text-sm text-neutral-500">{t.property.address}</div>}
                <div className="mt-1 text-sm">{fmtTime(t.dueFrom)} – {fmtTime(t.dueBy)}</div>
              </div>
              <StatusBadge status={t.status} />
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
