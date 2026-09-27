import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addChecklistItem, addFeed, removeChecklistItem, removeFeed, setPropertyTeam, updateProperty } from "../../actions";

const SOURCE_LABEL = { AIRBNB: "Airbnb", BOOKING: "Booking.com", OTHER: "Alt calendar" } as const;

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [p, cleaners] = await Promise.all([
    db.query.properties.findFirst({
      where: and(eq(s.properties.id, id), eq(s.properties.organizationId, user.organizationId)),
      with: { feeds: true, checklist: { orderBy: asc(s.checklistItems.position) }, cleaners: true },
    }),
    db.query.cleaners.findMany({ where: and(eq(s.cleaners.organizationId, user.organizationId), eq(s.cleaners.active, true)), orderBy: asc(s.cleaners.name) }),
  ]);
  if (!p) notFound();
  const teamIds = new Set(p.cleaners.map((pc) => pc.cleanerId));

  return (
    <div className="space-y-8">
      <h1 className="h1">{p.name}</h1>

      <section className="card">
        <h2 className="h2 mb-4">Detalii</h2>
        <form action={updateProperty.bind(null, p.id)} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Nume</label><input className="input" name="name" defaultValue={p.name} required /></div>
          <div><label className="label">Adresă</label><input className="input" name="address" defaultValue={p.address ?? ""} /></div>
          <div><label className="label">Check-out</label><input className="input" name="checkOutTime" type="time" defaultValue={p.checkOutTime} required /></div>
          <div><label className="label">Check-in</label><input className="input" name="checkInTime" type="time" defaultValue={p.checkInTime} required /></div>
          <div><label className="label">Tarif curățenie (lei)</label><input className="input" name="feeRon" type="number" min={0} defaultValue={p.feeRon} /></div>
          <div>
            <label className="label">Persoană implicită</label>
            <select className="input" name="defaultCleanerId" defaultValue={p.defaultCleanerId ?? ""}>
              <option value="">— niciuna —</option>
              {cleaners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Cod unic SITUR (opțional)</label><input className="input" name="siturCode" defaultValue={p.siturCode ?? ""} /></div>
          <div className="flex items-end"><button className="btn">Salvează</button></div>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">Calendare iCal</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Airbnb: Calendar → Disponibilitate → Export calendar. Booking: Tarife și disponibilitate → Sincronizare calendare → Export.
        </p>
        <ul className="mt-4 space-y-2">
          {p.feeds.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{SOURCE_LABEL[f.source]}</span>
              <span className="max-w-xs truncate text-neutral-500">{f.url}</span>
              <span className={f.lastError ? "text-red-600" : "text-neutral-400"}>
                {f.lastError ? `Eroare: ${f.lastError}` : f.lastSyncedAt ? `sincronizat ${f.lastSyncedAt.toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}` : "nesincronizat"}
              </span>
              <form action={removeFeed.bind(null, p.id, f.id)} className="ml-auto"><button className="text-red-600 hover:underline">Șterge</button></form>
            </li>
          ))}
        </ul>
        <form action={addFeed.bind(null, p.id)} className="mt-4 flex flex-wrap gap-2">
          <select name="source" className="input w-36"><option value="AIRBNB">Airbnb</option><option value="BOOKING">Booking</option><option value="OTHER">Altul</option></select>
          <input name="url" type="url" required placeholder="https://…/calendar.ics" className="input flex-1" />
          <button className="btn">Adaugă</button>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">Checklist curățenie</h2>
        <ul className="mt-4 space-y-1">
          {p.checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <span>☐ {c.label}</span>
              <form action={removeChecklistItem.bind(null, p.id, c.id)} className="ml-auto"><button className="text-neutral-400 hover:text-red-600">×</button></form>
            </li>
          ))}
        </ul>
        <form action={addChecklistItem.bind(null, p.id)} className="mt-4 flex gap-2">
          <input name="label" required placeholder="ex. Verifică stocul de cafea" className="input" />
          <button className="btn-ghost shrink-0">Adaugă</button>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">Echipa proprietății</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Restrânge cine poate fi alocat aici. Fără nicio bifă, orice persoană activă poate fi aleasă (comportamentul de dinainte).
        </p>
        <form action={setPropertyTeam.bind(null, p.id)} className="mt-4 space-y-2">
          {cleaners.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="cleanerIds" value={c.id} defaultChecked={teamIds.has(c.id)} />
              {c.name}
            </label>
          ))}
          {cleaners.length === 0 && <p className="text-sm text-neutral-500">Adaugă persoane în pagina Echipă mai întâi.</p>}
          <button className="btn-ghost">Salvează echipa</button>
        </form>
      </section>
    </div>
  );
}
