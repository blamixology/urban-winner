import ical from "node-ical";
import { isBlock, type FeedSourceT } from "./turnovers";

export interface ParsedEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string | null;
}

/** Date-only iCal values → noon UTC of that calendar day, so the day survives any TZ. */
function normalise(d: Date & { dateOnly?: boolean }): Date {
  if (d.dateOnly) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
  return d;
}

export function parseIcs(text: string, source: FeedSourceT): ParsedEvent[] {
  const data = ical.sync.parseICS(text);
  const out: ParsedEvent[] = [];
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== "VEVENT") continue;
    const summary = typeof ev.summary === "string" ? ev.summary : null;
    if (isBlock(source, summary)) continue;
    if (!ev.start || !ev.end) continue;
    out.push({
      uid: String(ev.uid ?? `${ev.start.toISOString()}-${ev.end.toISOString()}`),
      start: normalise(ev.start as Date & { dateOnly?: boolean }),
      end: normalise(ev.end as Date & { dateOnly?: boolean }),
      summary,
    });
  }
  return out;
}

export interface SyncPlan {
  upsert: ParsedEvent[];
  cancelUids: string[];
}

/** Anything we knew about that's gone from the feed (and not in the past) is cancelled. */
export function planSync(existing: { uid: string; end: Date; cancelled: boolean }[], incoming: ParsedEvent[], now = new Date()): SyncPlan {
  const seen = new Set(incoming.map((e) => e.uid));
  const cancelUids = existing.filter((r) => !r.cancelled && !seen.has(r.uid) && r.end > now).map((r) => r.uid);
  return { upsert: incoming, cancelUids };
}
