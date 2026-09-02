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

// ─── SAVINGS CATEGORY KINDS ───────────────────────────────────────────────────
// A savings category is either a pot (cash set aside) or an investment. This
// used to be decided by looking for "investment" in the name, so anyone who
// called theirs "Stocks & Shares ISA" got an Investments gauge stuck at zero
// forever. The kind is now stored explicitly and editable.
//
// inferSavingsKind reproduces the old name test exactly, and is used only to
// migrate existing data and to guess a sensible default for a new category —
// never to override a kind the user has actually chosen.
const inferSavingsKind = name => String(name).toLowerCase().includes("invest") ? "investment" : "pot";
const savingsKind = (name, types) => types?.[name] ?? inferSavingsKind(name);
const isInvestment = (name, types) => savingsKind(name, types) === "investment";

// Fill in a kind for every category that lacks one, leaving existing choices be.
function withSavingsKinds(streams, types = {}) {
  const out = { ...types };
  streams.forEach(s => { if (out[s] !== "pot" && out[s] !== "investment") out[s] = inferSavingsKind(s); });
  return out;
}

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

// ─── EXTENDING THE TIMELINE BACKWARDS ─────────────────────────────────────────
// Every series is indexed by months since the epoch, so moving the epoch back
// means sliding all of the stored data forward by the same number of months.
// The window is fixed at MAX_MONTHS, so anything pushed off the far end is
// dropped — the callers below refuse the move when that would lose real data.

// A monthly series: [v0, v1, …] → n zeros, then the old values.
const shiftArray = (arr, n) =>
  [...Array(n).fill(0), ...(arr || [])].slice(0, MAX_MONTHS);

// A weekly series: { [monthIdx]: {1..5} } → the same weeks, n months later.
function shiftWeekly(weeks, n) {
  const out = blankWeekly();
  Object.entries(weeks || {}).forEach(([mi, w]) => {
    const to = Number(mi) + n;
    if (to < MAX_MONTHS) out[to] = { ...w };
  });
  return out;
}

// A notes map: { [stream]: { [monthIdx]: … } }, month keys moved by n.
function shiftNotes(notes, n) {
  const out = {};
  Object.entries(notes || {}).forEach(([stream, byMonth]) => {
    const moved = {};
    Object.entries(byMonth || {}).forEach(([mi, v]) => {
      const to = Number(mi) + n;
      if (to < MAX_MONTHS) moved[to] = v;
    });
    out[stream] = moved;
  });
  return out;
}

const shiftAllArrays = (data, n) =>
  Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, shiftArray(v, n)]));
const shiftAllWeekly = (data, n) =>
  Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, shiftWeekly(v, n)]));

// True when sliding forward by n months would push a non-zero value off the end.
function wouldLoseData(series, n) {
  return Object.values(series || {}).some(v => {
    if (Array.isArray(v)) return v.slice(MAX_MONTHS - n).some(x => x > 0);
    return Object.entries(v || {}).some(([mi, w]) =>
      Number(mi) >= MAX_MONTHS - n && WEEKS.some(k => (w?.[k] || 0) > 0));
  });
}

export { shiftArray, shiftWeekly, shiftNotes, shiftAllArrays, shiftAllWeekly, wouldLoseData,
  inferSavingsKind, savingsKind, isInvestment, withSavingsKinds, DEFAULT_INCOME_STREAMS, DEFAULT_SAVINGS_STREAMS, DEFAULT_EXP_STREAMS, makeBaselineIncome, makeBaselineSavings, makeBaselineExp, NET_WORTH_ASSETS, DEFAULT_NET_WORTH, blankWeekly, weeklyTotal, allStreamsWeekly, monthlyVal, allMonthly, applyStreams, applyNotes };
