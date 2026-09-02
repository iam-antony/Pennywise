import { describe, it, expect } from "vitest";
import { inferSavingsKind, isInvestment, withSavingsKinds } from "./data.js";

// ─── P3-01: investments are a stored kind, not a guess from the name ────────
describe("savings kinds", () => {
  it("reproduces the old name test when migrating", () => {
    expect(inferSavingsKind("Investments")).toBe("investment");
    expect(inferSavingsKind("Emergency Fund")).toBe("pot");
    expect(inferSavingsKind("Personal Savings")).toBe("pot");
  });

  it("respects a kind the user has actually chosen", () => {
    const types = { "Stocks & Shares ISA": "investment", "Investments": "pot" };
    expect(isInvestment("Stocks & Shares ISA", types)).toBe(true);
    expect(isInvestment("Investments", types)).toBe(false);
  });

  it("falls back to the name only when nothing is stored", () => {
    expect(isInvestment("Stocks & Shares ISA", {})).toBe(false);
    expect(isInvestment("My Investments", {})).toBe(true);
  });

  it("fills gaps without overwriting existing choices", () => {
    const out = withSavingsKinds(["Emergency Fund", "ISA"], { "ISA": "investment" });
    expect(out).toEqual({ "Emergency Fund": "pot", "ISA": "investment" });
  });
});
