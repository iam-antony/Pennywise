// localStorage read/write, and the backup file format
// Extracted from App.jsx — the parsing and shaping here is pure, so it can be
// unit tested; only readAll/writeAll/clearAll touch the browser.

const PREFIX = "bt3-";

// Every key the app persists. Single source of truth: the load effect, the
// save handler and the backup file all work from this list, so a new field
// cannot be added to one and forgotten in the others.
const STORAGE_KEYS = [
  "fy", "tm", "curr", "cats", "savTypes", "epoch",
  "bInc", "bSav", "bExp", "incAct", "savFc", "savWk", "expFc", "expWk",
  "nw", "nwCats", "mo", "expN", "incN", "fx",
  "dver", "name", "goal", "done",
];

// ─── DATA VERSIONS ────────────────────────────────────────────────────────────
// A stored profile carries the version that wrote it. Versions this build knows
// how to read are listed oldest first; anything outside the list came from a
// different build, and nothing can safely be assumed about its shape.
const DATA_VER = "pennywise.public.v2";
const KNOWN_VERSIONS = [
  "pennywise.public.v1",  // original public build: flat net worth, no epoch or category kinds
  "pennywise.public.v2",  // adds epoch, savings kinds, per-month net worth, editable asset list
];

// What to do with whatever is in storage:
//   "empty"   — no profile saved yet
//   "current" — written by this build
//   "upgrade" — an older version this build can read and migrate forward
//   "unknown" — written by a build this one does not know; leave it alone
function classifyVersion(dver, done) {
  if (!done) return "empty";
  if (dver === DATA_VER) return "current";
  // Profiles predating the version stamp are v1 by definition.
  if (dver == null) return "upgrade";
  if (KNOWN_VERSIONS.includes(dver)) return "upgrade";
  return "unknown";
}

async function load(key, fb) {
  try { const r = localStorage.getItem(key); return r != null ? JSON.parse(r) : fb; } catch { return fb; }
}
async function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ } }

// ─── BACKUP FILE ──────────────────────────────────────────────────────────────
const FILE_KIND = "pennywise-backup";

// Wrap the stored values in a self-describing envelope. Keys holding nothing
// are dropped, so a backup of a fresh profile is not mostly nulls.
function buildBackup(values, now = new Date()) {
  const data = {};
  for (const k of STORAGE_KEYS) if (values[k] !== null && values[k] !== undefined) data[k] = values[k];
  return { kind: FILE_KIND, version: values.dver || DATA_VER, exportedAt: now.toISOString(), data };
}

// Read a backup file back. Returns { ok, values, … } or { ok:false, error } and
// never throws — the input is a file the user picked and could be anything.
function parseBackup(text) {
  let doc;
  try { doc = JSON.parse(text); }
  catch { return { ok: false, error: "That file isn't valid JSON, so it can't be a Yo Cent-E backup." }; }
  if (!doc || typeof doc !== "object" || Array.isArray(doc))
    return { ok: false, error: "That file doesn't contain a Yo Cent-E backup." };
  if (doc.kind !== FILE_KIND)
    return { ok: false, error: "That file isn't a Yo Cent-E backup — it has no identifying header." };
  if (!doc.data || typeof doc.data !== "object" || Array.isArray(doc.data))
    return { ok: false, error: "That backup has no data in it." };
  if (doc.version && !KNOWN_VERSIONS.includes(doc.version))
    return { ok: false, error: `That backup was written by a newer version of Yo Cent-E (${doc.version}). Update the app before restoring it.` };

  const values = {};
  let count = 0;
  for (const k of STORAGE_KEYS) if (k in doc.data) { values[k] = doc.data[k]; count++; }
  if (!count) return { ok: false, error: "That backup has no recognisable Yo Cent-E fields in it." };
  return { ok: true, values, version: doc.version || KNOWN_VERSIONS[0], count, exportedAt: doc.exportedAt || null };
}

// A filename that sorts chronologically and says whose profile it is.
function backupFilename(name, now = new Date()) {
  const stamp = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const who = String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `yo-cent-e-${who ? who + "-" : ""}${stamp}.json`;
}

// ─── BROWSER GLUE ─────────────────────────────────────────────────────────────
const readAll = async () =>
  Object.fromEntries(await Promise.all(STORAGE_KEYS.map(async k => [k, await load(PREFIX + k, null)])));

const writeAll = async values =>
  Promise.all(Object.entries(values).map(([k, v]) => save(PREFIX + k, v)));

const clearAll = () => {
  for (const k of STORAGE_KEYS) {
    try { localStorage.removeItem(PREFIX + k); } catch { /* storage unavailable */ }
  }
};

// Write a backup out as a file. Deliberately standalone rather than a hook, so
// the crash screen can call it: after a render error the React tree is not to
// be trusted, but localStorage still holds everything that was saved.
async function downloadBackupFile(values) {
  const v = values || await readAll();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(buildBackup(v), null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFilename(v.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return v;
}

export {
  PREFIX, STORAGE_KEYS, DATA_VER, KNOWN_VERSIONS, classifyVersion,
  load, save, readAll, writeAll, clearAll,
  buildBackup, parseBackup, backupFilename, downloadBackupFile,
};
