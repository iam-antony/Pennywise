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
  // Compact label for chart axes. Picks its unit from the magnitude actually
  // being plotted: monthly figures are hundreds, so rounding everything to
  // thousands produced axes reading "£0k £0k £1k £1k £1k".
  const fmtAxis = v => {
    if (typeof v !== "number" || isNaN(v)) return "";
    const a = Math.abs(v);
    const round1 = n => Number(n.toFixed(1)).toLocaleString(loc);
    const body = a >= 1000000 ? `${round1(a / 1000000)}M`
               : a >= 10000   ? `${round1(a / 1000)}k`
               : Math.round(a).toLocaleString(loc);
    return `${v < 0 ? "−" : ""}${curr.symbol}${body}`;
  };

  // The locale's own grouping and decimal marks, so an amount typed into an
  // input can be read back the same way it is displayed.
  const parts = new Intl.NumberFormat(loc).formatToParts(12345.6);
  const separators = {
    group: parts.find(p => p.type === "group")?.value ?? ",",
    decimal: parts.find(p => p.type === "decimal")?.value ?? ".",
  };

  return { fmt, fmtS, fmtAxis, separators, curr };
}

export { currencyDecimals, makeFormatters };
