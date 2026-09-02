import { describe, it, expect } from "vitest";
import {
  MAX_MONTHS, LEGACY_EPOCH, makeCalendar, makeMonths, fyLabel,
  epochForNewProfile, monthIndexOf, shiftEpoch,
} from "./calendar.js";
import {
  shiftArray, shiftWeekly, shiftNotes, shiftAllArrays, wouldLoseData,
  blankWeekly, weeklyTotal, inferSavingsKind, isInvestment, withSavingsKinds,
  netWorthAt, netWorthTotalAt, migrateNetWorth,
} from "./data.js";

// ─── P3-02: the timeline is no longer pinned to January 2026 ─────────────────
describe("epoch", () => {
  it("still behaves exactly as before for existing profiles", () => {
    const { MONTHS } = makeCalendar(LEGACY_EPOCH);
    expect(MONTHS[0].absYear).toBe(2026);
    expect(MONTHS[0].absMonth).toBe(0);
    expect(MONTHS[119].absYear).toBe(2035);
    expect(MONTHS[119].absMonth).toBe(11);
  });

  it("can start anywhere, including before 2026", () => {
    const { MONTHS } = makeCalendar({ year: 2023, month: 3 });
    expect(MONTHS[0].absYear).toBe(2023);
    expect(MONTHS[0].absMonth).toBe(3);      // April 2023
    expect(MONTHS[11].absMonth).toBe(2);     // March 2024
    expect(MONTHS[12].absYear).toBe(2024);
  });

  it("starts a new profile at the beginning of the user's current FY", () => {
    // September, April financial year → the year started this April
    expect(epochForNewProfile(3, new Date(2026, 8, 15))).toEqual({ year: 2026, month: 3 });
    // February, April financial year → the year started last April
    expect(epochForNewProfile(3, new Date(2026, 1, 15))).toEqual({ year: 2025, month: 3 });
    // calendar year
    expect(epochForNewProfile(0, new Date(2026, 8, 15))).toEqual({ year: 2026, month: 0 });
  });

  it("locates today's month relative to the epoch", () => {
    expect(monthIndexOf({ year: 2026, month: 3 }, new Date(2026, 8, 1))).toBe(5);
    expect(monthIndexOf({ year: 2026, month: 3 }, new Date(2027, 3, 1))).toBe(12);
    // before the epoch reads negative rather than clamping silently to 0
    expect(monthIndexOf({ year: 2026, month: 3 }, new Date(2025, 8, 1))).toBe(-7);
  });

  it("moves an epoch by whole months, wrapping the year", () => {
    expect(shiftEpoch({ year: 2026, month: 3 }, -12)).toEqual({ year: 2025, month: 3 });
    expect(shiftEpoch({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftEpoch({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });
});

// ─── P3-03: a clipped financial year is labelled, not silently short ─────────
describe("partial financial years", () => {
  it("marks a year clipped by the start of the window", () => {
    const { getAllFYs } = makeCalendar(LEGACY_EPOCH);
    const fys = getAllFYs(3, 48);
    expect(fys[0]).toMatchObject({ year: 2025, partial: true });
    expect(fys[0].indices).toEqual([0, 1, 2]);   // Jan–Mar 2026 only
    expect(fys[1]).toMatchObject({ year: 2026, partial: false });
  });

  it("produces no partial years when the epoch lines up with the FY start", () => {
    const { getAllFYs } = makeCalendar({ year: 2026, month: 3 });
    const fys = getAllFYs(3, 48);
    expect(fys).toHaveLength(4);
    expect(fys.some(f => f.partial)).toBe(false);
  });
});

describe("financial-year maths against a moved epoch", () => {
  it("groups months into the right years", () => {
    const { getFYYear, getFYMonths } = makeCalendar({ year: 2026, month: 3 });
    expect(getFYYear(0, 3)).toBe(2026);      // Apr 2026
    expect(getFYYear(11, 3)).toBe(2026);     // Mar 2027
    expect(getFYYear(12, 3)).toBe(2027);     // Apr 2027
    expect(getFYMonths(2026, 3, 48)).toHaveLength(12);
  });

  it("labels a calendar year without the slash", () => {
    expect(fyLabel(2026, 0)).toBe("FY 2026");
    expect(fyLabel(2026, 3)).toBe("FY 2026/27");
  });

  it("generates exactly the window size", () => {
    expect(makeMonths(LEGACY_EPOCH)).toHaveLength(MAX_MONTHS);
  });
});

// ─── Sliding stored data when the window grows backwards ────────────────────
describe("shifting series", () => {
  it("moves a monthly series forward and keeps the window size", () => {
    const arr = [100, 200, 300, ...Array(MAX_MONTHS - 3).fill(0)];
    const out = shiftArray(arr, 12);
    expect(out).toHaveLength(MAX_MONTHS);
    expect(out.slice(0, 12).every(v => v === 0)).toBe(true);
    expect(out.slice(12, 15)).toEqual([100, 200, 300]);
  });

  it("moves weekly entries to their new month", () => {
    const w = blankWeekly();
    w[0] = { 1: 50, 2: 25, 3: 0, 4: 0, 5: 0 };
    const out = shiftWeekly(w, 12);
    expect(weeklyTotal({ x: out }, "x", 0)).toBe(0);
    expect(weeklyTotal({ x: out }, "x", 12)).toBe(75);
  });

  it("moves notes with their month", () => {
    const out = shiftNotes({ Groceries: { 0: { 1: "big shop" } } }, 12);
    expect(out.Groceries[12][1]).toBe("big shop");
    expect(out.Groceries[0]).toBeUndefined();
  });

  it("shifts every stream in one go", () => {
    const before = { A: [5, ...Array(MAX_MONTHS - 1).fill(0)], B: [7, ...Array(MAX_MONTHS - 1).fill(0)] };
    const out = shiftAllArrays(before, 3);
    expect(out.A[3]).toBe(5);
    expect(out.B[3]).toBe(7);
    expect(out.A[0]).toBe(0);
  });

  it("refuses to lose real data off the far end", () => {
    const empty = { A: Array(MAX_MONTHS).fill(0) };
    expect(wouldLoseData(empty, 12)).toBe(false);

    const late = Array(MAX_MONTHS).fill(0);
    late[MAX_MONTHS - 1] = 42;
    expect(wouldLoseData({ A: late }, 12)).toBe(true);

    const lateWeekly = blankWeekly();
    lateWeekly[MAX_MONTHS - 1] = { 1: 10, 2: 0, 3: 0, 4: 0, 5: 0 };
    expect(wouldLoseData({ A: lateWeekly }, 12)).toBe(true);
  });
});

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

// ─── P3-06: net worth keeps a history instead of one overwritten snapshot ───
describe("net worth", () => {
  it("migrates an old single-figure profile onto the month it is read", () => {
    const out = migrateNetWorth({ Property: 320000, Equities: 48000 }, ["Property", "Equities"], 8);
    expect(out.Property[8]).toBe(320000);
    expect(out.Property[7]).toBe(0);
    expect(out.Property).toHaveLength(MAX_MONTHS);
  });

  it("leaves an already-migrated profile alone", () => {
    const arr = Array(MAX_MONTHS).fill(0); arr[3] = 1000;
    const out = migrateNetWorth({ Cash: arr }, ["Cash"], 8);
    expect(out.Cash[3]).toBe(1000);
    expect(out.Cash[8]).toBe(0);
  });

  it("keeps assets that are in storage but not in the current list", () => {
    const out = migrateNetWorth({ Gold: 500 }, ["Property"], 0);
    expect(out.Gold).toBeDefined();
    expect(out.Property).toBeDefined();
  });

  it("carries the last recorded figure forward between checks", () => {
    const arr = Array(MAX_MONTHS).fill(0);
    arr[2] = 1000; arr[6] = 1200;
    const series = { Cash: arr };
    expect(netWorthAt(series, "Cash", 1)).toBe(0);
    expect(netWorthAt(series, "Cash", 2)).toBe(1000);
    expect(netWorthAt(series, "Cash", 5)).toBe(1000);  // no entry, inherits
    expect(netWorthAt(series, "Cash", 6)).toBe(1200);
    expect(netWorthAt(series, "Cash", 40)).toBe(1200);
  });

  it("totals the carried-forward figures across assets", () => {
    const a = Array(MAX_MONTHS).fill(0); a[0] = 100;
    const b = Array(MAX_MONTHS).fill(0); b[3] = 50;
    expect(netWorthTotalAt({ a, b }, ["a", "b"], 0)).toBe(100);
    expect(netWorthTotalAt({ a, b }, ["a", "b"], 3)).toBe(150);
  });

  it("returns zero for an asset with no data at all", () => {
    expect(netWorthAt({}, "Nope", 5)).toBe(0);
  });
});
