import { describe, expect, it } from "vitest";
import { isAtRisk, isBlock, planTurnovers, type ResLike } from "./turnovers";
import { parseIcs, planSync } from "./ical";
import { zonedToUtc } from "./time";

const noonUtc = (d: string) => new Date(`${d}T12:00:00Z`);
const res = (id: string, start: string, end: string, extra: Partial<ResLike> = {}): ResLike => ({
  id, start: noonUtc(start), end: noonUtc(end), cancelled: false, source: "AIRBNB", ...extra,
});
const times = { checkInTime: "15:00", checkOutTime: "11:00" };

describe("zonedToUtc", () => {
  it("handles Bucharest summer (UTC+3) and winter (UTC+2)", () => {
    expect(zonedToUtc("2026-07-10", "11:00").toISOString()).toBe("2026-07-10T08:00:00.000Z");
    expect(zonedToUtc("2026-01-10", "11:00").toISOString()).toBe("2026-01-10T09:00:00.000Z");
  });
  it("handles the DST switch day", () => {
    expect(zonedToUtc("2026-10-25", "11:00").toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(zonedToUtc("2026-03-29", "11:00").toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });
});

describe("planTurnovers", () => {
  it("creates a same-day back-to-back window", () => {
    const [t] = planTurnovers([res("a", "2026-10-01", "2026-10-03"), res("b", "2026-10-03", "2026-10-05")], times);
    expect(t.reservationId).toBe("a");
    expect(t.dueFrom.toISOString()).toBe("2026-10-03T08:00:00.000Z"); // 11:00 EEST
    expect(t.dueBy.toISOString()).toBe("2026-10-03T12:00:00.000Z"); // 15:00 EEST
  });

  it("stretches the window to the next check-in when there's a gap", () => {
    const [t] = planTurnovers([res("a", "2026-10-01", "2026-10-03"), res("b", "2026-10-06", "2026-10-08")], times);
    expect(t.dueBy.toISOString()).toBe("2026-10-06T12:00:00.000Z");
  });

  it("defaults to same-day check-in time when no next booking", () => {
    const plan = planTurnovers([res("a", "2026-10-01", "2026-10-03")], times);
    expect(plan).toHaveLength(1);
    expect(plan[0].dueBy.toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });

  it("dedupes the same stay exported by two feeds, preferring Airbnb", () => {
    const plan = planTurnovers([
      res("booking-copy", "2026-10-01", "2026-10-03", { source: "BOOKING" }),
      res("airbnb", "2026-10-01", "2026-10-03", { source: "AIRBNB" }),
    ], times);
    expect(plan.map((p) => p.reservationId)).toEqual(["airbnb"]);
  });

  it("ignores cancelled reservations", () => {
    expect(planTurnovers([res("a", "2026-10-01", "2026-10-03", { cancelled: true })], times)).toEqual([]);
  });

  it("falls back to end of day when check-in time is before check-out time", () => {
    const [t] = planTurnovers([res("a", "2026-10-01", "2026-10-03")], { checkInTime: "10:00", checkOutTime: "11:00" });
    expect(t.dueBy.toISOString()).toBe("2026-10-03T20:59:00.000Z");
  });
});

describe("isBlock / isAtRisk", () => {
  it("skips Airbnb owner blocks only", () => {
    expect(isBlock("AIRBNB", "Airbnb (Not available)")).toBe(true);
    expect(isBlock("AIRBNB", "Reserved")).toBe(false);
    expect(isBlock("BOOKING", "CLOSED - Not available")).toBe(false);
  });
  it("flags pending turnovers within 1h of check-in", () => {
    const now = new Date("2026-10-03T11:30:00Z");
    expect(isAtRisk({ status: "PENDING", dueBy: new Date("2026-10-03T12:00:00Z") }, now)).toBe(true);
    expect(isAtRisk({ status: "IN_PROGRESS", dueBy: new Date("2026-10-03T12:00:00Z") }, now)).toBe(false);
    expect(isAtRisk({ status: "PENDING", dueBy: new Date("2026-10-03T15:00:00Z") }, now)).toBe(false);
  });
});

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261001
DTEND;VALUE=DATE:20261003
UID:res-1@airbnb.com
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261012
UID:block-1@airbnb.com
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

describe("ical", () => {
  it("parses date-only stays and drops Airbnb blocks", () => {
    const ev = parseIcs(ICS, "AIRBNB");
    expect(ev).toHaveLength(1);
    expect(ev[0].uid).toBe("res-1@airbnb.com");
    expect(ev[0].start.toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(ev[0].end.toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });

  it("cancels future reservations that vanished from the feed, keeps past ones", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    const plan = planSync(
      [
        { uid: "gone-future", end: new Date("2026-10-20"), cancelled: false },
        { uid: "gone-past", end: new Date("2026-10-01"), cancelled: false },
        { uid: "still-here", end: new Date("2026-10-20"), cancelled: false },
      ],
      [{ uid: "still-here", start: new Date("2026-10-18"), end: new Date("2026-10-20"), summary: null }],
      now,
    );
    expect(plan.cancelUids).toEqual(["gone-future"]);
  });
});
