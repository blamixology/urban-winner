import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanerLink, whatsappShare } from "@/lib/cleaner";
import { createCleaner, rotateCleanerLink, toggleCleaner } from "../actions";

export default async function Cleaners() {
  const user = await requireUser();
  const cleaners = await db.query.cleaners.findMany({
    where: eq(s.cleaners.ownerId, user.id),
    orderBy: [desc(s.cleaners.active), asc(s.cleaners.name)],
  });

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
    </div>
  );
}
