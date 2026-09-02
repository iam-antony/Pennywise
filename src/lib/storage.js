// localStorage read/write
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// ─── STORAGE ─────────────────────────────────────────────────────────────────
async function load(key, fb) {
  try { const r = localStorage.getItem(key); return r != null ? JSON.parse(r) : fb; } catch { return fb; }
}
async function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

export { load, save };
