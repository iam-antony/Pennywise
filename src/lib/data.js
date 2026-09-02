import { MAX_MONTHS, WEEKS } from "./calendar.js";

// Category defaults and the shape of stored data
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// ─── DEFAULT SEEDS (baseline) ─────────────────────────────────────────────────
const DEFAULT_INCOME_STREAMS = ["Pay check","Extra Income"];
const DEFAULT_SAVINGS_STREAMS = ["Emergency Fund","Personal Savings","Investments"];
const DEFAULT_EXP_STREAMS = ["Rent / Mortgage","Groceries","Subscriptions","Transport"];

const makeBaselineIncome = () => ({
  "Pay check":    Array(MAX_MONTHS).fill(0),
  "Extra Income": Array(MAX_MONTHS).fill(0),
});
const makeBaselineSavings = () => ({
  "Emergency Fund":   Array(MAX_MONTHS).fill(0),
  "Personal Savings": Array(MAX_MONTHS).fill(0),
  "Investments":      Array(MAX_MONTHS).fill(0),
})
const makeBaselineExp = () => ({
  "Rent / Mortgage": Array(MAX_MONTHS).fill(0),
  "Groceries":       Array(MAX_MONTHS).fill(0),
  "Subscriptions":   Array(MAX_MONTHS).fill(0),
  "Transport":       Array(MAX_MONTHS).fill(0),
})

const NET_WORTH_ASSETS = ["Property","Equities","Bonds","Commodities","Cash (Savings)","Cash (Emergency Fund)","Cash (Pension)"];
const DEFAULT_NET_WORTH = { Property:0,Equities:0,Bonds:0,Commodities:0,"Cash (Savings)":0,"Cash (Emergency Fund)":0,"Cash (Pension)":0 };

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
const blankWeekly = () => {
  const o = {};
  for (let m = 0; m < MAX_MONTHS; m++) o[m] = {1:0,2:0,3:0,4:0,5:0};
  return o;
};


const weeklyTotal = (wd, s, mi) => {
  const w = wd?.[s]?.[mi]; if (!w) return 0;
  return WEEKS.reduce((a, k) => a + (w[k] || 0), 0);
};
const allStreamsWeekly = (streams, wd, mi) => streams.reduce((a, s) => a + weeklyTotal(wd, s, mi), 0);
const monthlyVal = (d, s, mi) => d?.[s]?.[mi] || 0;
const allMonthly = (streams, d, mi) => streams.reduce((a, s) => a + monthlyVal(d, s, mi), 0);

// Apply a category-list change to a data object.
// `origin` maps each current label to the label its data is stored under, so a
// rename carries the history across instead of orphaning it. Data belonging to
// removed categories is left in place — re-adding the same name brings it back.
function applyStreams(data, streams, origin = {}, type = "array") {
  const u = { ...data };
  streams.forEach(s => {
    const from = origin[s];
    if (from && from !== s && from in u) { u[s] = u[from]; delete u[from]; }
    if (u[s] === undefined) u[s] = type === "array" ? Array(MAX_MONTHS).fill(0) : blankWeekly();
  });
  return u;
}
// Same rename handling for the notes maps, which need no blank scaffolding.
function applyNotes(notes, streams, origin = {}) {
  const u = { ...notes };
  streams.forEach(s => {
    const from = origin[s];
    if (from && from !== s && from in u) { u[s] = u[from]; delete u[from]; }
  });
  return u;
}

export { DEFAULT_INCOME_STREAMS, DEFAULT_SAVINGS_STREAMS, DEFAULT_EXP_STREAMS, makeBaselineIncome, makeBaselineSavings, makeBaselineExp, NET_WORTH_ASSETS, DEFAULT_NET_WORTH, blankWeekly, weeklyTotal, allStreamsWeekly, monthlyVal, allMonthly, applyStreams, applyNotes };
