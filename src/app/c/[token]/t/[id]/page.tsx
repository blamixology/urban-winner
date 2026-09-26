import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireCleaner } from "@/lib/cleaner";
import { fmtDay, fmtTime } from "@/lib/time";
import { StatusBadge } from "@/app/app/status";
import { finishTurnover, startTurnover, toggleCheck, uploadPhotos } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function TurnoverPage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const cleaner = await requireCleaner(token);
  const t = await db.query.turnovers.findFirst({
    where: and(eq(s.turnovers.id, id), eq(s.turnovers.cleanerId, cleaner.id)),
    with: {
      property: { with: { checklist: { orderBy: asc(s.checklistItems.position) } } },
      checks: true,
      photos: { orderBy: asc(s.photos.createdAt) },
    },
  });
  if (!t) notFound();

  const checked = new Set(t.checks.map((c) => c.itemId));
  const open = t.status === "PENDING" || t.status === "IN_PROGRESS";
  const allChecked = t.property.checklist.every((c) => checked.has(c.id));

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-6">
      <Link href={`/c/${token}`} className="text-sm text-neutral-500">← Înapoi</Link>
      <div>
        <div className="flex items-center justify-between">
          <h1 className="h1">{t.property.name}</h1>
          <StatusBadge status={t.status} />
        </div>
        {t.property.address && <p className="text-sm text-neutral-500">{t.property.address}</p>}
        <p className="mt-1 text-sm">{fmtDay(t.dueFrom)}, {fmtTime(t.dueFrom)} → gata până la <b>{fmtTime(t.dueBy)}</b></p>
      </div>

      {t.status === "PENDING" && (
        <form action={startTurnover.bind(null, token, t.id)}><button className="btn w-full py-3 text-base">Încep curățenia</button></form>
      )}

      {t.status !== "PENDING" && (
        <>
          <section className="card space-y-1">
            <h2 className="h2 mb-2">Checklist</h2>
            {t.property.checklist.map((item) => (
              <form key={item.id} action={toggleCheck.bind(null, token, t.id, item.id)}>
                <button disabled={!open} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-50">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked.has(item.id) ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300"}`}>
                    {checked.has(item.id) ? "✓" : ""}
                  </span>
                  <span className={checked.has(item.id) ? "text-neutral-400 line-through" : ""}>{item.label}</span>
                </button>
              </form>
            ))}
          </section>

          <section className="card space-y-3">
            <h2 className="h2">Poze</h2>
            <div className="grid grid-cols-3 gap-2">
              {t.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={`/api/photos/${p.id}?t=${token}`} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
            {open && (
              <form action={uploadPhotos.bind(null, token, t.id)} className="flex gap-2">
                <input name="photos" type="file" accept="image/*" capture="environment" multiple className="input" />
                <button className="btn-ghost shrink-0">Încarcă</button>
              </form>
            )}
          </section>

          {open ? (
            <form action={finishTurnover.bind(null, token, t.id)} className="card space-y-3">
              <textarea name="notes" placeholder="Observații (ex. lipsește hârtie igienică)" className="input min-h-20" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="issue" /> Raportez o problemă</label>
              <button className="btn w-full py-3 text-base">{allChecked ? "Gata!" : "Termin (checklist incomplet)"}</button>
            </form>
          ) : (
            t.notes && <p className="card text-sm">{t.notes}</p>
          )}
        </>
      )}
    </main>
  );
}
