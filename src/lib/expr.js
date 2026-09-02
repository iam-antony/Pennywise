// The inline formula parser
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// ─── EXPRESSION PARSER ───────────────────────────────────────────────────────
// Safe recursive-descent parser — only digits, . + - * / ( ) allowed
function evalExpr(raw) {
  const s = String(raw).replace(/\s/g, "");
  if (!s || !/[+\-*\/()]/.test(s)) return parseFloat(s) ?? null;
  if (!/^[0-9.()+\-*/]+$/.test(s)) return null;
  let p = 0;
  const peek = () => s[p];
  const eat  = () => s[p++];
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = eat(); v = op === "+" ? v + term() : v - term();
    }
    return v;
  }
  function term() {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = eat(); const r = factor(); v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function factor() {
    if (peek() === "(") { eat(); const v = expr(); if (peek() === ")") eat(); return v; }
    if (peek() === "-") { eat(); return -factor(); }
    let n = "";
    while (peek() && /[0-9.]/.test(peek())) n += eat();
    return n === "" ? 0 : parseFloat(n);
  }
  try {
    const v = expr();
    return isFinite(v) ? Math.round(v * 100) / 100 : null;
  } catch { return null; }
}

// Whether a raw string looks like a formula (not just a plain number or negative)
const isFormula = s => /[+*\/\(]/.test(s) || /\d-/.test(s);

const DEFAULT_SEPARATORS = { group: ",", decimal: "." };

// Read a plain amount, tolerating the grouping the app itself displays.
// "1,200" used to reach parseFloat intact and come back as 1, silently
// storing the wrong number; anything still unreadable now returns null so the
// caller can reject it rather than coerce it to zero.
function parseAmount(raw, seps = DEFAULT_SEPARATORS) {
  let s = String(raw).replace(/\s/g, "");
  if (!s) return 0;
  const { group, decimal } = { ...DEFAULT_SEPARATORS, ...seps };
  const esc = c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const G = esc(group), D = esc(decimal);

  // Check the shape before stripping anything. Stripping first is what lets
  // "1,200.50" slip through a comma-decimal locale as 1.2005 — the separators
  // have to sit where that locale would actually put them.
  const grouped   = new RegExp(`^-?\\d{1,3}(${G}\\d{3})+(${D}\\d+)?$`);
  const ungrouped = new RegExp(`^-?(\\d+(${D}\\d+)?|${D}\\d+)$`);
  if (!grouped.test(s) && !ungrouped.test(s)) return null;

  if (group) s = s.split(group).join("");
  if (decimal && decimal !== ".") s = s.split(decimal).join(".");
  const v = parseFloat(s);
  return isFinite(v) ? v : null;
}

// Whatever the user typed in an amount field: an arithmetic expression, or a
// plain amount. Returns null when it cannot be read.
function parseEntry(raw, seps = DEFAULT_SEPARATORS) {
  const s = String(raw).trim();
  if (!s) return 0;
  return isFormula(s) ? evalExpr(s) : parseAmount(s, seps);
}

export { evalExpr, isFormula, parseAmount, parseEntry };
