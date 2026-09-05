import { describe, it, expect } from "vitest";
import { MAX_MONTHS } from "./calendar.js";
import {
  blankWeekly, weeklyTotal, allStreamsWeekly, monthlyVal, allMonthly,
  applyStreams, applyNotes, fyElapsed,
} from "./data.js";

const weeklyWith = (mi, weeks) => {
  const w = blankWeekly();
  w[mi] = { ...w[mi], ...weeks };
  return w;
};

describe("weeklyTotal", () => {
  it("sums all five weeks of a month", () => {
    const data = { Groceries: weeklyWith(3, { 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 }) };
    expect(weeklyTotal(data, "Groceries", 3)).toBe(300);
  });

  it("returns zero for a month, stream or dataset with nothing in it", () => {
    const data = { Groceries: blankWeekly() };
    expect(weeklyTotal(data, "Groceries", 3)).toBe(0);
    expect(weeklyTotal(data, "Missing", 3)).toBe(0);
    expect(weeklyTotal(undefined, "Groceries", 3)).toBe(0);
  });

  it("does not bleed across months", () => {
    const data = { Groceries: weeklyWith(3, { 1: 100 }) };
    expect(weeklyTotal(data, "Groceries", 4)).toBe(0);
  });
});

describe("totals across streams", () => {
  const weekly = {
    Groceries: weeklyWith(0, { 1: 100 }),
    Transport: weeklyWith(0, { 1: 50, 2: 25 }),
  };
  const monthly = {
    "Pay check": Array(MAX_MONTHS).fill(4200),
    "Extra Income": Array(MAX_MONTHS).fill(0),
  };

  it("adds the selected streams only", () => {
    expect(allStreamsWeekly(["Groceries", "Transport"], weekly, 0)).toBe(175);
    expect(allStreamsWeekly(["Groceries"], weekly, 0)).toBe(100);
    expect(allStreamsWeekly([], weekly, 0)).toBe(0);
  });

  it("reads monthly values by index", () => {
    expect(monthlyVal(monthly, "Pay check", 5)).toBe(4200);
    expect(monthlyVal(monthly, "Nope", 5)).toBe(0);
    expect(allMonthly(["Pay check", "Extra Income"], monthly, 5)).toBe(4200);
  });
});

describe("applyStreams", () => {
  const history = () => ({ Groceries: Array(MAX_MONTHS).fill(0).map((_, i) => (i < 3 ? 100 : 0)) });

  // P1-02: renaming a category used to orphan its history — the data stayed in
  // localStorage under the old key and vanished from every view. This is the guard.
  it("carries a renamed category's history across", () => {
    const out = applyStreams(history(), ["Food"], { Food: "Groceries" }, "array");
    expect(out.Food.slice(0, 3)).toEqual([100, 100, 100]);
    expect(out.Groceries).toBeUndefined();
  });

  it("moves weekly data on rename too", () => {
    const before = { Groceries: weeklyWith(0, { 1: 40 }) };
    const out = applyStreams(before, ["Food"], { Food: "Groceries" }, "weekly");
    expect(weeklyTotal(out, "Food", 0)).toBe(40);
    expect(out.Groceries).toBeUndefined();
  });

  it("gives a genuinely new category empty scaffolding", () => {
    const out = applyStreams(history(), ["Groceries", "Fuel"], { Groceries: "Groceries" }, "array");
    expect(out.Fuel).toHaveLength(MAX_MONTHS);
    expect(out.Fuel.every(v => v === 0)).toBe(true);
    expect(out.Groceries.slice(0, 3)).toEqual([100, 100, 100]);
  });

  it("builds weekly scaffolding when asked for it", () => {
    const out = applyStreams({}, ["Fuel"], {}, "weekly");
    expect(Object.keys(out.Fuel)).toHaveLength(MAX_MONTHS);
    expect(out.Fuel[0]).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it("keeps a removed category's data so re-adding the name restores it", () => {
    const out = applyStreams(history(), [], {}, "array");
    expect(out.Groceries.slice(0, 3)).toEqual([100, 100, 100]);
  });

  it("leaves untouched categories exactly as they were", () => {
    const before = history();
    const out = applyStreams(before, ["Groceries"], { Groceries: "Groceries" }, "array");
    expect(out.Groceries).toEqual(before.Groceries);
  });

  it("does not mutate the object it is given", () => {
    const before = history();
    applyStreams(before, ["Food"], { Food: "Groceries" }, "array");
    expect(before.Groceries).toBeDefined();
  });
});

describe("applyNotes", () => {
  it("moves notes with a renamed category", () => {
    const notes = { Groceries: { 0: { 1: "big shop" } } };
    const out = applyNotes(notes, ["Food"], { Food: "Groceries" });
    expect(out.Food[0][1]).toBe("big shop");
    expect(out.Groceries).toBeUndefined();
  });

  it("does not invent empty note maps for new categories", () => {
    const out = applyNotes({}, ["Fuel"], {});
    expect(out.Fuel).toBeUndefined();
  });
});

describe("fyElapsed", () => {
  const fy = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];   // Apr–Mar of one year

  it("counts months up to the cursor in the year you are in", () => {
    expect(fyElapsed(fy, 8, 2026, 2026)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("treats a past year as complete", () => {
    expect(fyElapsed(fy, 8, 2025, 2026)).toEqual(fy);
  });

  it("treats a future year as not started", () => {
    expect(fyElapsed(fy, 8, 2027, 2026)).toEqual([]);
  });

  it("counts the first month once the cursor reaches it", () => {
    expect(fyElapsed(fy, 3, 2026, 2026)).toEqual([3]);
    expect(fyElapsed(fy, 2, 2026, 2026)).toEqual([]);
  });
});
