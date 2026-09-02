// Money formatting
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// ─── MONEY FORMATTING ─────────────────────────────────────────────────────────
// Formatters are built from the selected currency and passed down through
// context. Components read them with useMoney() rather than reaching for a
// module-level variable, so nothing has to be mutated during render.
// Decimal places a currency actually uses — 0 for JPY, 3 for KWD, 2 for most.
// Asked of Intl once per code and cached; unknown codes fall back to 2.
const DECIMALS = new Map();
function currencyDecimals(code) {
  if (!DECIMALS.has(code)) {
    let d = 2;
    try { d = new Intl.NumberFormat("en", { style:"currency", currency:code }).resolvedOptions().maximumFractionDigits; } catch {}
    DECIMALS.set(code, d);
  }
  return DECIMALS.get(code);
}

function makeFormatters(curr) {
  const dp = currencyDecimals(curr.code);
  // Keep the currency's own grouping and decimal marks, but force Latin digits.
  // Locales like ar-KW and bn-BD would otherwise render ٩٦٠ / ৯৬০ beside the
  // Latin numerals used everywhere else in the interface.
  const loc = `${curr.locale}-u-nu-latn`;
  const abs = v => `${curr.symbol}${Math.abs(v).toLocaleString(loc,{minimumFractionDigits:0,maximumFractionDigits:dp})}`;
  // Plain amount — keeps the sign, so an overspend reads as a loss.
  const fmt = v => {
    if (typeof v !== "number" || isNaN(v)) return "—";
    return v < 0 ? `−${abs(v)}` : abs(v);
  };
  // Signed amount — always carries an explicit + or −, for variance columns.
  const fmtS = v => {
    if (typeof v !== "number" || isNaN(v)) return "—";
    return (v >= 0 ? "+" : "−") + abs(v);
  };
  return { fmt, fmtS, curr };
}

export { currencyDecimals, makeFormatters };
