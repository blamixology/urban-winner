const LABELS: Record<string, [string, string]> = {
  PENDING: ["De făcut", "bg-neutral-100 text-neutral-700"],
  IN_PROGRESS: ["În lucru", "bg-amber-100 text-amber-800"],
  DONE: ["Gata", "bg-emerald-100 text-emerald-800"],
  ISSUE: ["Problemă", "bg-red-100 text-red-800"],
  CANCELLED: ["Anulat", "bg-neutral-100 text-neutral-400 line-through"],
};

export function StatusBadge({ status, atRisk }: { status: string; atRisk?: boolean }) {
  const [label, cls] = LABELS[status] ?? [status, ""];
  return (
    <span className="inline-flex gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
      {atRisk && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Risc</span>}
    </span>
  );
}
