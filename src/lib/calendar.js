// Calendar and financial-year helpers
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// ─── CALENDAR ────────────────────────────────────────────────────────────────
// Pre-generate 120 months (10 years): Jan 2026 → Dec 2035
// totalMonths state controls how many are actually visible/navigable
const MAX_MONTHS = 120;
const MONTHS = [];
for (let i = 0; i < MAX_MONTHS; i++) {
  const d = new Date(2026, 0 + i, 1);
  MONTHS.push({
    label: d.toLocaleString("default", { month: "short", year: "numeric" }),
    short: d.toLocaleString("default", { month: "short" }),
    absMonth: (0 + i) % 12,           // 0=Jan … 11=Dec
    absYear: 2026 + Math.floor((0 + i) / 12),
    date: d,
  });
}
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKS = [1, 2, 3, 4, 5];

// ─── FY HELPERS ───────────────────────────────────────────────────────────────
// fyStartMonth: 0=Jan, 1=Feb, … 3=Apr (default)
function getFYYear(monthIdx, fyStart) {
  const { absMonth, absYear } = MONTHS[monthIdx];
  return absMonth >= fyStart ? absYear : absYear - 1;
}
function getAllFYs(fyStart, totalMonths = MAX_MONTHS) {
  const map = {};
  for (let i = 0; i < totalMonths; i++) {
    const y = getFYYear(i, fyStart);
    if (!map[y]) map[y] = [];
    map[y].push(i);
  }
  return Object.entries(map)
    .sort((a, b) => +a[0] - +b[0])
    .map(([year, indices]) => ({ year: +year, indices }));
}
function fyLabel(year, fyStart) {
  if (fyStart === 3) return `FY ${year}/${String(year + 1).slice(2)}`;
  if (fyStart === 0) return `FY ${year}`;
  return `FY ${year}/${String(year + 1).slice(2)}`;
}
function getFYMonths(fyYear, fyStart, totalMonths = MAX_MONTHS) {
  return getAllFYs(fyStart, totalMonths).find(f => f.year === fyYear)?.indices || [];
}

export { MAX_MONTHS, MONTHS, MONTH_NAMES, WEEKS, getFYYear, getAllFYs, fyLabel, getFYMonths };
