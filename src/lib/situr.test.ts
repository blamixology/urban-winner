import { describe, expect, it } from "vitest";
import { nightsBetween } from "./situr";
import { monthRange } from "./time";

describe("nightsBetween", () => {
  it("counts whole nights between two days", () => {
    expect(nightsBetween("2026-10-01", "2026-10-03")).toBe(2);
  });
  it("is zero for a same-day arrival and departure", () => {
    expect(nightsBetween("2026-10-01", "2026-10-01")).toBe(0);
  });
  it("crosses a month boundary correctly", () => {
    expect(nightsBetween("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("monthRange", () => {
  it("defaults to the current month when unset", () => {
    const { month } = monthRange(undefined);
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });
  it("ignores a malformed month and falls back", () => {
    const { month } = monthRange("not-a-month");
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });
  it("spans a full calendar month across the December→January rollover", () => {
    const { from, to } = monthRange("2026-12");
    expect(from.toISOString()).toBe("2026-11-30T22:00:00.000Z"); // 2026-12-01 00:00 EET
    expect(to.toISOString()).toBe("2026-12-31T22:00:00.000Z"); // 2027-01-01 00:00 EET
  });
});
