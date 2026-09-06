// Calendar and financial-year helpers
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// The app tracks a fixed window of 120 months. Where that window *starts* used
// to be hardcoded to January 2026, which meant nobody could enter last year's
// figures, anyone opening the app before 2026 was clamped to month zero, and
// the whole thing ran out of calendar in 2036. The start is now an epoch stored
// with the profile, and the window can be extended backwards as well as
// forwards.
const MAX_MONTHS = 120;
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKS = [1, 2, 3, 4, 5];

// The epoch used by every profile created before the timeline was movable.
const LEGACY_EPOCH = { year: 2026, month: 0 };

function makeMonths(epoch, count = MAX_MONTHS) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(epoch.year, epoch.month + i, 1);
    out.push({
      label: d.toLocaleString("default", { month: "short", year: "numeric" }),
      short: d.toLocaleString("default", { month: "short" }),
      absMonth: d.getMonth(),
      absYear: d.getFullYear(),
      date: d,
    });
  }
  return out;
}

// fyStart: 0=Jan, 1=Feb, … 3=Apr (the UK tax year, and the default)
function fyLabel(year, fyStart) {
  return fyStart === 0 ? String(year) : `FY ${year}/${String(year + 1).slice(2)}`;
}

// Everything below depends on where the window starts, so it is built against a
// given epoch rather than a module-level table.
function makeCalendar(epoch = LEGACY_EPOCH) {
  const MONTHS = makeMonths(epoch);

  const getFYYear = (monthIdx, fyStart) => {
    const m = MONTHS[monthIdx];
    if (!m) return null;
    return m.absMonth >= fyStart ? m.absYear : m.absYear - 1;
  };

  const getAllFYs = (fyStart, totalMonths = MAX_MONTHS) => {
    const map = new Map();
    for (let i = 0; i < totalMonths; i++) {
      const y = getFYYear(i, fyStart);
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(i);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      // A year clipped by the edge of the window is marked partial, so the UI
      // can say so rather than showing it as a year that missed its target.
      .map(([year, indices]) => ({ year, indices, partial: indices.length < 12 }));
  };

  const getFYMonths = (fyYear, fyStart, totalMonths = MAX_MONTHS) =>
    getAllFYs(fyStart, totalMonths).find(f => f.year === fyYear)?.indices || [];

  return { epoch, MONTHS, getFYYear, getAllFYs, getFYMonths, fyLabel };
}

// The epoch a new profile starts from: January of the year they are in, so the
// timeline is always whole calendar years and every month of this year exists
// whatever they later choose their financial year to be.
function epochForNewProfile(now = new Date()) {
  return { year: now.getFullYear(), month: 0 };
}

// How far `date` sits from the epoch, in months. Negative means before it.
function monthIndexOf(epoch, date = new Date()) {
  return (date.getFullYear() - epoch.year) * 12 + (date.getMonth() - epoch.month);
}

// Move an epoch by a whole number of months, normalising the month field.
function shiftEpoch(epoch, months) {
  const total = epoch.year * 12 + epoch.month + months;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export {
  MAX_MONTHS, MONTH_NAMES, WEEKS, LEGACY_EPOCH,
  makeMonths, makeCalendar, fyLabel, epochForNewProfile, monthIndexOf, shiftEpoch,
};
