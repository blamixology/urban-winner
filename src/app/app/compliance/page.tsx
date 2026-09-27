import { requireUser } from "@/lib/auth";
import { occupancyReport } from "@/lib/situr";
import { fmtDay } from "@/lib/time";
import { saveGuestRegistration } from "../actions";

export const dynamic = "force-dynamic";

export default async function Compliance({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const { month, occupancy, totals } = await occupancyReport(user.organizationId, (await searchParams).month);
  const missingCode = totals.some((t) => !t.siturCode);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="h1">Raport ocupare (SITUR)</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sosiri și nopți cazate pe lună, pe cod unic SITUR. De la 20 mai 2026, hotărârea UE 2024/1028 impune codul SITUR pe unitate și evidența
            oaspeților — feed-urile iCal nu conțin identitatea oaspetelui, deci registrul de oaspeți rămâne de completat manual.
          </p>
        </div>
        <form className="ml-auto flex gap-2">
          <input type="month" name="month" defaultValue={month} className="input" />
          <button className="btn-ghost">Arată</button>
        </form>
        <a href={`/api/situr?month=${month}`} className="btn-ghost">Export CSV</a>
      </div>

      {missingCode && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Unele proprietăți nu au cod SITUR completat — adaugă-l în pagina proprietății înainte de depunerea raportului.
        </div>
      )}

      <table className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-500">
          <tr>
            <th className="p-3">Proprietate</th>
            <th className="p-3">Cod SITUR</th>
            <th className="p-3 text-right">Sosiri</th>
            <th className="p-3 text-right">Nopți cazate</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => (
            <tr key={t.propertyId} className="border-t border-neutral-100">
              <td className="p-3">{t.propertyName}</td>
              <td className="p-3">{t.siturCode ?? <span className="text-amber-700">lipsă</span>}</td>
              <td className="p-3 text-right">{t.stays}</td>
              <td className="p-3 text-right">{t.nights}</td>
            </tr>
          ))}
          {totals.length === 0 && <tr><td colSpan={4} className="p-3 text-neutral-500">Nicio sosire în {month}.</td></tr>}
        </tbody>
      </table>

      <div className="card">
        <h2 className="h2 mb-3">Registru oaspeți</h2>
        <p className="mb-3 text-sm text-neutral-500">
          Nume și document de identitate, completate manual — iCal nu trimite identitatea oaspetelui.
        </p>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-1 pr-3">Proprietate</th>
              <th className="py-1 pr-3">Sosire</th>
              <th className="py-1 pr-3">Plecare</th>
              <th className="py-1 pr-3 text-right">Nopți</th>
              <th className="py-1 pr-3">Nume oaspete</th>
              <th className="py-1 pr-3">CI/Pașaport</th>
              <th className="py-1 pr-3 text-right">Nr. pers.</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {occupancy.map((o) => {
              const formId = `gr-${o.turnoverId}`;
              return (
                <tr key={o.turnoverId} className="border-t border-neutral-100">
                  <td className="py-1 pr-3">{o.propertyName}</td>
                  <td className="py-1 pr-3">{fmtDay(new Date(o.arrival))}</td>
                  <td className="py-1 pr-3">{fmtDay(new Date(o.departure))}</td>
                  <td className="py-1 pr-3 text-right">{o.nights}</td>
                  <td className="py-1 pr-3"><input form={formId} name="guestName" defaultValue={o.guestName ?? ""} className="input py-1 text-xs" /></td>
                  <td className="py-1 pr-3"><input form={formId} name="guestIdDoc" defaultValue={o.guestIdDoc ?? ""} className="input py-1 text-xs" /></td>
                  <td className="py-1 pr-3"><input form={formId} name="guestCount" type="number" min={1} defaultValue={o.guestCount} className="input w-16 py-1 text-right text-xs" /></td>
                  <td className="py-1">
                    <button form={formId} className="btn-ghost px-2 py-1 text-xs">Salvează</button>
                    <form id={formId} action={saveGuestRegistration.bind(null, o.turnoverId)} />
                  </td>
                </tr>
              );
            })}
            {occupancy.length === 0 && <tr><td colSpan={8} className="py-2 text-neutral-500">Nicio sosire în {month}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
