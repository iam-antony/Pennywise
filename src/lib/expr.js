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

export { evalExpr, isFormula };
