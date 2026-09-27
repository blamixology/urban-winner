import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanerLink, whatsappShare } from "@/lib/cleaner";
import { cleanerStats } from "@/lib/stats";
import { fmtMinutes } from "@/lib/time";
import { createCleaner, rotateCleanerLink, toggleCleaner } from "../actions";

export default async function Cleaners() {
  const user = await requireUser();
  const [cleaners, stats] = await Promise.all([
    db.query.cleaners.findMany({
      where: eq(s.cleaners.organizationId, user.organizationId),
      orderBy: [desc(s.cleaners.active), asc(s.cleaners.name)],
    }),
    cleanerStats(user.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="h1">Echipă</h1>
      <form action={createCleaner} className="card flex flex-wrap gap-2">
        <input name="name" required placeholder="Nume" className="input flex-1" />
        <input name="phone" placeholder="Telefon (07…)" className="input flex-1" />
        <button className="btn">Adaugă</button>
      </form>
      <p className="text-sm text-neutral-500">Fiecare persoană primește un link personal. Nu are nevoie de cont sau aplicație.</p>
      <div className="space-y-3">
        {cleaners.map((c) => {
          const link = cleanerLink(c.token);
          return (
            <div key={c.id} className={`card space-y-2 ${c.active ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="text-sm text-neutral-500">{c.phone}</span>}
                <div className="ml-auto flex gap-2">
                  {c.phone && (
                    <a className="btn-ghost" target="_blank" rel="noreferrer"
                      href={whatsappShare(c.phone, `Salut ${c.name}! Aici vezi curățeniile programate: ${link}`)}>
                      Trimite pe WhatsApp
                    </a>
                  )}
                  <form action={rotateCleanerLink.bind(null, c.id)}><button className="btn-ghost">Link nou</button></form>
                  <form action={toggleCleaner.bind(null, c.id)}><button className="btn-ghost">{c.active ? "Dezactivează" : "Activează"}</button></form>
                </div>
              </div>
              <input readOnly value={link} className="input font-mono text-xs" />
            </div>
          );
        })}
      </div>

      {stats.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Performanță (ultimele 90 de zile)</h2>
          <table className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="p-3">Persoană</th>
                <th className="p-3 text-right">Finalizate</th>
                <th className="p-3 text-right">Probleme</th>
                <th className="p-3 text-right">Durată medie</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.cleanerId} className="border-t border-neutral-100">
                  <td className="p-3">{row.name}</td>
                  <td className="p-3 text-right">{row.completed}</td>
                  <td className="p-3 text-right">{row.issues}</td>
                  <td className="p-3 text-right">{fmtMinutes(row.avgMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
