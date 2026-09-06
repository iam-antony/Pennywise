import { describe, it, expect } from "vitest";
import { MAX_MONTHS, LEGACY_EPOCH, makeCalendar, fyLabel, epochForNewProfile } from "./calendar.js";

// These all pin the behaviour of a profile created before the timeline could
// move. The epoch is now configurable (see timeline.test.js), but anyone who
// already has data must keep seeing exactly what they saw before.
const { MONTHS, getFYYear, getAllFYs, getFYMonths } = makeCalendar(LEGACY_EPOCH);

describe("the month table", () => {
  it("runs from January 2026 for ten years", () => {
    expect(MAX_MONTHS).toBe(120);
    expect(MONTHS).toHaveLength(120);
    expect(MONTHS[0].absMonth).toBe(0);
    expect(MONTHS[0].absYear).toBe(2026);
    expect(MONTHS[119].absMonth).toBe(11);
    expect(MONTHS[119].absYear).toBe(2035);
  });

  it("keeps index, month and year in step", () => {
    expect(MONTHS[8].absMonth).toBe(8);   // Sep 2026
    expect(MONTHS[8].absYear).toBe(2026);
    expect(MONTHS[12].absMonth).toBe(0);  // Jan 2027
    expect(MONTHS[12].absYear).toBe(2027);
  });
});

describe("getFYYear", () => {
  it("puts months before the FY start into the previous financial year", () => {
    expect(getFYYear(0, 3)).toBe(2025);
    expect(getFYYear(2, 3)).toBe(2025);
    expect(getFYYear(3, 3)).toBe(2026);
    expect(getFYYear(14, 3)).toBe(2026); // Mar 2027
    expect(getFYYear(15, 3)).toBe(2027); // Apr 2027
  });

  it("matches the calendar year when the FY starts in January", () => {
    expect(getFYYear(0, 0)).toBe(2026);
    expect(getFYYear(11, 0)).toBe(2026);
    expect(getFYYear(12, 0)).toBe(2027);
  });
});

describe("getFYMonths", () => {
  it("returns twelve consecutive months for a complete financial year", () => {
    const fy = getFYMonths(2026, 3, 48);
    expect(fy).toHaveLength(12);
    expect(fy[0]).toBe(3);    // Apr 2026
    expect(fy[11]).toBe(14);  // Mar 2027
  });

  it("returns an empty list for a year outside the tracked range", () => {
    expect(getFYMonths(2040, 3, 48)).toEqual([]);
  });

  // P3-03: an existing April-year profile still has a three-month first tab,
  // because its window starts in January. It is now flagged as partial so the
  // UI can label it, and its targets are pro-rated, rather than it reading as
  // a year that missed by nine months. New profiles start on their FY boundary
  // and have no stub at all — see timeline.test.js.
  it("still produces the legacy three-month first year", () => {
    expect(getFYMonths(2025, 3, 48)).toEqual([0, 1, 2]);
    expect(getAllFYs(3, 48)[0].partial).toBe(true);
  });
});

describe("getAllFYs", () => {
  it("covers only the months currently in range", () => {
    const fys = getAllFYs(3, 48);
    expect(fys.map(f => f.year)).toEqual([2025, 2026, 2027, 2028, 2029]);
    expect(fys.reduce((n, f) => n + f.indices.length, 0)).toBe(48);
  });

  it("gives twelve clean years when the FY starts in January", () => {
    const fys = getAllFYs(0, 48);
    expect(fys.map(f => f.year)).toEqual([2026, 2027, 2028, 2029]);
    expect(fys.every(f => f.indices.length === 12)).toBe(true);
    expect(fys.every(f => !f.partial)).toBe(true);
  });
});

describe("fyLabel", () => {
  it("spans two years unless the FY is the calendar year", () => {
    expect(fyLabel(2026, 3)).toBe("FY 2026/27");
    expect(fyLabel(2029, 3)).toBe("FY 2029/30");
    // A January year is just the year; calling it "FY 2026" teaches a term to
    // someone who has no use for it.
    expect(fyLabel(2026, 0)).toBe("2026");
  });

  it("still names a non-January year as a financial year", () => {
    expect(fyLabel(2026, 3)).toBe("FY 2026/27");
  });
});

describe("epochForNewProfile", () => {
  it("starts a new profile at January of the current year", () => {
    expect(epochForNewProfile(new Date(2026, 8, 15))).toEqual({ year: 2026, month: 0 });
  });

  it("does not move with the financial year the user picks", () => {
    // The old behaviour aligned the epoch to the FY start, so an April year
    // began the timeline in April and January to March did not exist.
    const inApril = epochForNewProfile(new Date(2026, 3, 1));
    const inDecember = epochForNewProfile(new Date(2026, 11, 31));
    expect(inApril).toEqual({ year: 2026, month: 0 });
    expect(inDecember).toEqual({ year: 2026, month: 0 });
  });

  it("gives every month of the current year, whatever the financial year", () => {
    const { MONTHS, getFYMonths } = makeCalendar(epochForNewProfile(new Date(2026, 8, 1)));
    expect(MONTHS[0].label).toMatch(/^Jan 2026/);
    // April's financial year is still derivable, and still twelve months long.
    expect(getFYMonths(2026, 3, 24)).toHaveLength(12);
  });
});
