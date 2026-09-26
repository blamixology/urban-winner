import { describe, expect, it } from "vitest";
import { toE164Ro } from "./notify";

describe("toE164Ro", () => {
  it("converts a local 07xx number to +407xx", () => {
    expect(toE164Ro("0722334455")).toBe("+40722334455");
  });
  it("normalises separators", () => {
    expect(toE164Ro("0722 334 455")).toBe("+40722334455");
  });
  it("leaves an already-international number alone", () => {
    expect(toE164Ro("+40722334455")).toBe("+40722334455");
  });
  it("adds + to a bare-40 number", () => {
    expect(toE164Ro("40722334455")).toBe("+40722334455");
  });
});
