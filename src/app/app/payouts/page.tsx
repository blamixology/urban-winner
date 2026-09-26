import { requireUser } from "@/lib/auth";
import { payouts } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export default async function Payouts({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const { month, rows } = await payouts(user.id, (await searchParams).month);
  const total = rows.reduce((s, r) => s + r.totalRon, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="h1">Decont</h1>
        <form className="ml-auto flex gap-2">
          <input type="month" name="month" defaultValue={month} className="input" />
          <button className="btn-ghost">Arată</button>
        </form>
        <a href={`/api/payouts?month=${month}`} className="btn-ghost">Export CSV</a>
      </div>
      <table className="w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-500">
          <tr><th className="p-3">Persoană</th><th className="p-3 text-right">Curățenii</th><th className="p-3 text-right">De plată</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-neutral-100">
              <td className="p-3">{r.name}</td><td className="p-3 text-right">{r.count}</td><td className="p-3 text-right">{r.totalRon} lei</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="p-3 text-neutral-500">Nicio curățenie finalizată în {month}.</td></tr>}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="border-t border-neutral-200 font-semibold">
            <tr><td className="p-3">Total</td><td /><td className="p-3 text-right">{total} lei</td></tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
