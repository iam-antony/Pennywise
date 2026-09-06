import { describe, it, expect } from "vitest";
import {
  STORAGE_KEYS, DATA_VER, KNOWN_VERSIONS, classifyVersion,
  buildBackup, parseBackup, backupFilename,
} from "./storage.js";

// P4-03: a version mismatch used to discard every stored figure on load, with
// no prompt and no way back. classifyVersion is what replaces that: only a
// version this build has never heard of is treated as untouchable, and even
// then the app asks rather than deleting.
describe("classifyVersion", () => {
  it("reports an unsaved profile as empty", () => {
    expect(classifyVersion(null, false)).toBe("empty");
    expect(classifyVersion(DATA_VER, false)).toBe("empty");
  });

  it("recognises a profile written by this build", () => {
    expect(classifyVersion(DATA_VER, true)).toBe("current");
  });

  it("migrates an older known version forward rather than discarding it", () => {
    expect(classifyVersion("pennywise.public.v1", true)).toBe("upgrade");
  });

  it("treats a profile predating the version stamp as the oldest version", () => {
    expect(classifyVersion(null, true)).toBe("upgrade");
    expect(classifyVersion(undefined, true)).toBe("upgrade");
  });

  it("refuses to guess at a version it does not know", () => {
    expect(classifyVersion("pennywise.public.v9", true)).toBe("unknown");
    expect(classifyVersion("something-else", true)).toBe("unknown");
  });

  it("lists the current version among the known ones", () => {
    expect(KNOWN_VERSIONS).toContain(DATA_VER);
    expect(KNOWN_VERSIONS[KNOWN_VERSIONS.length - 1]).toBe(DATA_VER);
  });
});

describe("buildBackup", () => {
  const when = new Date("2026-09-02T20:15:00.000Z");

  it("wraps the stored values in an identifiable envelope", () => {
    const b = buildBackup({ name: "Antony", dver: DATA_VER, goal: 12000 }, when);
    expect(b.kind).toBe("pennywise-backup");
    expect(b.version).toBe(DATA_VER);
    expect(b.exportedAt).toBe("2026-09-02T20:15:00.000Z");
    expect(b.data).toEqual({ name: "Antony", dver: DATA_VER, goal: 12000 });
  });

  it("drops keys holding nothing rather than writing a file full of nulls", () => {
    const b = buildBackup({ name: "Antony", goal: null, mo: undefined }, when);
    expect(Object.keys(b.data)).toEqual(["name"]);
  });

  it("keeps falsy values that are real data", () => {
    const b = buildBackup({ goal: 0, done: false, fy: 0 }, when);
    expect(b.data).toEqual({ goal: 0, done: false, fy: 0 });
  });

  it("records the version the profile was written by, not the build's", () => {
    const b = buildBackup({ dver: "pennywise.public.v1" }, when);
    expect(b.version).toBe("pennywise.public.v1");
  });
});

describe("parseBackup", () => {
  const good = JSON.stringify(buildBackup({ name: "Antony", dver: DATA_VER, goal: 12000 }));

  it("round-trips a file it wrote", () => {
    const r = parseBackup(good);
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ name: "Antony", dver: DATA_VER, goal: 12000 });
    expect(r.count).toBe(3);
  });

  it("accepts a backup from an older known version", () => {
    const older = JSON.stringify(buildBackup({ name: "A", dver: "pennywise.public.v1" }));
    const r = parseBackup(older);
    expect(r.ok).toBe(true);
    expect(r.version).toBe("pennywise.public.v1");
  });

  it("refuses a backup from a version this build cannot read", () => {
    const newer = JSON.stringify({ kind: "pennywise-backup", version: "pennywise.public.v9", data: { name: "A" } });
    const r = parseBackup(newer);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/newer version/);
  });

  it("explains itself rather than throwing on rubbish input", () => {
    for (const bad of ["", "not json", "[1,2,3]", "null", '{"kind":"something-else"}']) {
      const r = parseBackup(bad);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
      expect(typeof r.error).toBe("string");
      expect(r.error.length).toBeGreaterThan(10);
    }
  });

  it("rejects a backup-shaped file with no usable fields", () => {
    const r = parseBackup(JSON.stringify({ kind: "pennywise-backup", data: { nonsense: 1 } }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/recognisable/);
  });

  it("ignores unknown keys instead of importing them wholesale", () => {
    const r = parseBackup(JSON.stringify({
      kind: "pennywise-backup", version: DATA_VER,
      data: { name: "Antony", evil: "payload", __proto__: "x" },
    }));
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ name: "Antony" });
  });
});

describe("backupFilename", () => {
  const when = new Date("2026-09-02T20:15:00.000Z");

  it("names the file after the profile and the moment", () => {
    expect(backupFilename("Antony", when)).toBe("yo-cent-e-antony-2026-09-02-2015.json");
  });

  it("copes with an awkward or missing name", () => {
    expect(backupFilename("", when)).toBe("yo-cent-e-2026-09-02-2015.json");
    expect(backupFilename(null, when)).toBe("yo-cent-e-2026-09-02-2015.json");
    expect(backupFilename("Ann-Marie O'Neill", when)).toBe("yo-cent-e-ann-marie-o-neill-2026-09-02-2015.json");
  });
});

describe("the key list", () => {
  it("is the single source of truth and has no duplicates", () => {
    expect(new Set(STORAGE_KEYS).size).toBe(STORAGE_KEYS.length);
  });

  it("covers every field the app persists", () => {
    for (const k of ["fy","tm","curr","cats","savTypes","epoch","bInc","bSav","bExp",
                     "incAct","savFc","savWk","expFc","expWk","nw","nwCats","mo",
                     "expN","incN","dver","name","goal","done"]) {
      expect(STORAGE_KEYS, k).toContain(k);
    }
  });
});
