import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, Component } from "react";
import { ComposedChart, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { MAX_MONTHS, MONTH_NAMES, WEEKS, LEGACY_EPOCH, makeCalendar, fyLabel,
  epochForNewProfile, monthIndexOf, shiftEpoch } from "./lib/calendar.js";
import { CURRENCIES, flagEmoji } from "./lib/currencies.js";
import { makeFormatters } from "./lib/money.js";
import { isInvestment, inferSavingsKind, withSavingsKinds, netWorthAt, netWorthTotalAt, migrateNetWorth, shiftAllArrays, shiftAllWeekly, shiftNotes, wouldLoseData, DEFAULT_INCOME_STREAMS, DEFAULT_SAVINGS_STREAMS, DEFAULT_EXP_STREAMS, makeBaselineIncome, makeBaselineSavings, makeBaselineExp, NET_WORTH_ASSETS, blankWeekly, weeklyTotal, allStreamsWeekly, monthlyVal, allMonthly, fyElapsed, applyStreams, applyNotes } from "./lib/data.js";
import { save, readAll, writeAll, clearAll, classifyVersion, parseBackup, downloadBackupFile, DATA_VER } from "./lib/storage.js";
import { isFormula, parseEntry, evalExpr } from "./lib/expr.js";
import { T, CC, STYLES } from "./theme.js";

const CurrencyContext = createContext(makeFormatters(CURRENCIES[0]));
const useMoney = () => useContext(CurrencyContext);

// The month table and the financial-year maths depend on where the user's
// timeline starts, so they are built once per epoch and passed down rather
// than being module-level constants pinned to January 2026.
// The app calls it a financial year only when it actually differs from the
// calendar year. On January the two are the same thing, so it is just "the
// year" — a beginner never meets a term they have no use for, while anyone who
// set a tax year still sees theirs named properly.
const yearNoun = fyStart => (fyStart === 0 ? "year" : "financial year");

const CalendarContext = createContext(makeCalendar(LEGACY_EPOCH));
const useCalendar = () => useContext(CalendarContext);

// Typing "70+30" into a cell stored 100 and threw the working away, so coming
// back to add another receipt meant remembering what the 100 was made of. The
// expression is now kept beside the figure, keyed by cell, and handed back when
// the cell is focused. One flat map rather than a parallel copy of every data
// shape - the cells that take formulas sit in six different structures.
const FormulaContext = createContext({ map: {}, set: () => {} });
const useFormulas = () => useContext(FormulaContext);

// Dialog behaviour every modal needs and none of them had: Escape closes it,
// focus moves inside on open and is kept there while it is up, and it returns
// to whatever opened it on close. Spread the returned props onto the dialog.
function useDialog(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const box = ref.current;
    const focusable = () => [...(box?.querySelectorAll(
      'button,[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])') || [])]
      .filter(el => !el.disabled && el.offsetParent !== null);

    (focusable()[0] || box)?.focus?.();

    const onKey = e => {
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    box?.addEventListener("keydown", onKey);
    return () => {
      box?.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return { ref, role: "dialog", "aria-modal": "true", tabIndex: -1 };
}

// Local state that follows a value derived from props, while still letting the
// user override it until that derived value next changes. This is React's
// "adjust state during render" pattern: a synchronising effect renders once
// with the stale value and then again with the corrected one, which is both
// slower and, for the financial-year selector below, visibly wrong for a frame.
// `token` is an optional second trigger: when it changes the state snaps back
// to `derived` even though `derived` itself has not moved. "Today" needs this.
// Jumping to the current month only re-derives the financial year when the
// month actually changes, so someone already sitting on today's month who had
// clicked through to a different FY tab stayed there — the button looked dead.
function useSyncedState(derived, token) {
  const [value, setValue] = useState(derived);
  const [seen, setSeen] = useState(derived);
  const [seenToken, setSeenToken] = useState(token);
  if (seen !== derived || seenToken !== token) {
    setSeen(derived); setSeenToken(token); setValue(derived);
  }
  return [value, setValue];
}

// ─── REUSABLE ATOMS ───────────────────────────────────────────────────────────
function NumInput({ value, onChange, className = "inp inp-num", disabled, label, cellId }) {
  const { separators } = useMoney();
  const formulas = useFormulas();
  const display = value != null && value !== 0 ? String(value) : "";
  const [raw, setRaw]       = useState(display);
  const [focused, setFocus] = useState(false);
  // Adopt an external change once the field is no longer being edited.
  const [seen, setSeen] = useState(display);
  if (!focused && seen !== display) { setSeen(display); setRaw(display); }

  const formula = isFormula(raw);
  const result  = parseEntry(raw, separators);
  const valid   = result !== null;

  // Working is only offered back while it still adds up to what the cell shows.
  // Anything that moved the figure by another route - a restore, a shifted
  // timeline, a renamed category - leaves it stale, and stale reads worse than
  // nothing at all.
  const saved = cellId ? formulas.map[cellId] : undefined;
  const savedFits = saved != null && evalExpr(saved) === (value || 0);

  // Focusing hands the expression back, so another figure can be added to it.
  const begin = e => {
    setFocus(true);
    if (!savedFits) return;
    setRaw(saved);
    const el = e.currentTarget;
    // After React has painted the restored text, not before.
    requestAnimationFrame(() => {
      // Only if the caret has not been moved or a selection made in the
      // meantime — a fast select-all should not be undone by this.
      if (el.value !== saved || el.selectionStart !== el.selectionEnd) return;
      try { el.setSelectionRange(saved.length, saved.length); } catch { /* not selectable */ }
    });
  };

  const commit = () => {
    setFocus(false);
    // Unreadable input is rejected rather than coerced to 0, which would
    // silently overwrite a real figure.
    if (!valid) {
      setRaw(value != null && value !== 0 ? String(value) : "");
      return;
    }
    // Keep the working only when there is working to keep; typing a plain
    // number over a formula forgets it.
    if (cellId) formulas.set(cellId, formula ? raw.trim() : null);
    setRaw(result === 0 ? "" : String(result));
    onChange(result);
  };

  const borderColor = focused && (formula || !valid)
    ? (valid ? T.accent : T.danger)
    : undefined;

  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <input
        type="text"
        className={className}
        value={raw}
        aria-label={label}
        title={!focused && savedFits ? `= ${saved}` : undefined}
        disabled={disabled}
        onChange={e => setRaw(e.target.value)}
        onFocus={begin}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
        style={{
          ...(disabled ? { opacity:.35, cursor:"not-allowed" } : {}),
          ...(borderColor ? { borderColor, boxShadow:`0 0 0 2px ${borderColor}22` } : {}),
          fontFamily:"'DM Sans',sans-serif",
        }}
      />
      {!focused && savedFits && (
        <span aria-hidden="true" style={{ position:"absolute", top:0, right:3, fontSize:9,
          lineHeight:"14px", color:T.sub, opacity:.8, pointerEvents:"none" }}>ƒ</span>
      )}

      {/* Live preview bubble — shows the result of a formula, or why input is rejected */}
      {focused && (formula || !valid) && (
        <div style={{
          position:"absolute", bottom:"calc(100% + 5px)", right:0, zIndex:60,
          background:T.card, border:`1px solid ${valid ? T.accent : T.danger}`,
          borderRadius:6, padding:"4px 10px", fontSize:11, whiteSpace:"nowrap",
          color: valid ? T.accent : T.danger, pointerEvents:"none",
          boxShadow:"0 3px 12px rgba(0,0,0,.45)",
          display:"flex", alignItems:"center", gap:6,
        }}>
          {valid
            ? <><span style={{ color:T.sub }}>={" "}</span><strong>{String(result)}</strong></>
            : <span>✕ can't read that as an amount</span>}
        </div>
      )}
    </div>
  );
}

// Compact formula-aware cell for the baseline editor grid
function FormulaCell({ value, onCommit, placeholder, style, label, cellId }) {
  const { separators } = useMoney();
  const formulas = useFormulas();
  const display = value != null && value !== "" && value !== 0 ? String(value) : "";
  const [raw, setRaw]       = useState(display);
  const [focused, setFocus] = useState(false);
  const [seen, setSeen] = useState(display);
  if (!focused && seen !== display) { setSeen(display); setRaw(display); }

  const formula = isFormula(raw);
  const result  = parseEntry(raw, separators);
  const valid   = result !== null;

  // Working is only offered back while it still adds up to what the cell shows.
  // Anything that moved the figure by another route - a restore, a shifted
  // timeline, a renamed category - leaves it stale, and stale reads worse than
  // nothing at all.
  const saved = cellId ? formulas.map[cellId] : undefined;
  const savedFits = saved != null && evalExpr(saved) === (value || 0);

  // Focusing hands the expression back, so another figure can be added to it.
  const begin = e => {
    setFocus(true);
    if (!savedFits) return;
    setRaw(saved);
    const el = e.currentTarget;
    // After React has painted the restored text, not before.
    requestAnimationFrame(() => {
      // Only if the caret has not been moved or a selection made in the
      // meantime — a fast select-all should not be undone by this.
      if (el.value !== saved || el.selectionStart !== el.selectionEnd) return;
      try { el.setSelectionRange(saved.length, saved.length); } catch { /* not selectable */ }
    });
  };

  const commit = () => {
    setFocus(false);
    // Reject what cannot be read rather than writing 0 over a real figure.
    if (!valid) {
      setRaw(value != null && value !== "" && value !== 0 ? String(value) : "");
      return;
    }
    if (cellId) formulas.set(cellId, formula ? raw.trim() : null);
    setRaw(result ? String(result) : "");
    onCommit(result);
  };

  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <input className="bl-cell" type="text" value={raw} placeholder={placeholder || ""} aria-label={label}
        title={!focused && savedFits ? `= ${saved}` : undefined}
        style={{ ...style, ...(focused && (formula || !valid) ? { borderColor: valid ? T.accent : T.danger } : {}) }}
        onChange={e => setRaw(e.target.value)}
        onFocus={begin}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} />
      {focused && (formula || !valid) && (
        <div style={{
          position:"absolute", bottom:"calc(100% + 4px)", right:0, zIndex:60,
          background:T.card, border:`1px solid ${valid ? T.accent : T.danger}`,
          borderRadius:5, padding:"3px 8px", fontSize:11, whiteSpace:"nowrap",
          color: valid ? T.accent : T.danger, pointerEvents:"none",
          boxShadow:"0 2px 8px rgba(0,0,0,.45)",
        }}>
          {valid ? <>= <strong>{result}</strong></> : "✕ can't read that"}
        </div>
      )}
    </div>
  );
}

// A card is a button when it leads somewhere. Rendering a clickable div would
// put it out of reach of the keyboard, which is the fault P4-05 fixed for the
// sidebar — not worth reintroducing here.
function StatCard({ icon, label, value, sub, delta, deltaLabel = "vs baseline", posGood = true, valueTone, onOpen, openLabel }) {
  const { fmtS } = useMoney();
  const good = posGood ? T.success : T.danger, bad = posGood ? T.danger : T.success;
  const body = (
    <>
      <div aria-hidden="true" style={{ fontSize:20, marginBottom:5 }}>{icon}</div>
      <div className="sl" style={{ marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display'", fontSize:22, fontWeight:600, color:valueTone || T.accent }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>{sub}</div>}
      {delta !== undefined && <div style={{ fontSize:12, color:delta >= 0 ? good : bad, marginTop:4 }}>{fmtS(delta)} {deltaLabel}</div>}
    </>
  );
  if (!onOpen) return <div className="stat-card">{body}</div>;
  return (
    <button className="stat-card stat-card-link" onClick={onOpen}
      aria-label={openLabel || `${label} — open`}
      style={{ textAlign:"left", cursor:"pointer", font:"inherit", color:"inherit" }}>
      {body}
      <div className="stat-card-go" aria-hidden="true">→</div>
    </button>
  );
}

// ─── YEAR PICKER ──────────────────────────────────────────────────────────────
// A row of year chips cannot survive its own success. Every chip is 59px on a
// calendar year and 97px on a financial one, and the timeline runs to eleven
// years, so the strip needed 1,117px of a 497px bar on a narrow window and
// wrapped onto a second row even at 1440. This is the control already used for
// months in the header: steppers for the adjacent year, which is the common
// move, and a list for anything further.
function YearPicker({ fys, selectedFY, fyStart, onSelectFY }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  const idx = fys.findIndex(f => f.year === selectedFY);
  const current = idx >= 0 ? fys[idx] : null;
  const atFirst = idx <= 0;
  const atLast = idx < 0 || idx >= fys.length - 1;

  useEffect(() => {
    if (!open) return;
    // Show the selected year rather than the top of a list of eleven.
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    const onKey = e => {
      if (e.key === "Escape") { setOpen(false); wrapRef.current?.querySelector("[aria-haspopup]")?.focus(); }
    };
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const step = by => { const n = fys[idx + by]; if (n) onSelectFY(n.year); };
  const choose = y => { onSelectFY(y); setOpen(false); };

  return (
    <div ref={wrapRef} style={{ position:"relative", display:"flex", alignItems:"center", gap:5 }}>
      <button className="month-btn" onClick={() => step(-1)} disabled={atFirst}
        aria-label="Previous year" style={atFirst ? { opacity:.3, cursor:"default" } : undefined}>‹</button>

      <button onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        title={`Choose which ${yearNoun(fyStart)} to show`}
        style={{ fontSize:13, fontWeight:600, minWidth:118, cursor:"pointer", background:T.inputBg,
          border:`1px solid ${open ? T.accent : T.border}`, color:T.accent, fontFamily:"'DM Sans'",
          padding:"6px 12px", borderRadius:8, display:"flex", alignItems:"center",
          justifyContent:"center", gap:7, transition:"border-color .15s" }}>
        {fyLabel(selectedFY, fyStart)}
        {current?.partial && <span title={`Only ${current.indices.length} of 12 months`}
          style={{ fontSize:9, color:T.sub, fontWeight:400 }}>part</span>}
        <span aria-hidden="true" style={{ fontSize:9, color:T.sub }}>▼</span>
      </button>

      <button className="month-btn" onClick={() => step(1)} disabled={atLast}
        aria-label="Next year" style={atLast ? { opacity:.3, cursor:"default" } : undefined}>›</button>

      {open && (
        <div ref={listRef} role="listbox" aria-label={`Choose a ${yearNoun(fyStart)}`}
          style={{ position:"absolute", top:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)",
            background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:6, zIndex:150,
            minWidth:190, maxHeight:264, overflowY:"auto", boxShadow:"0 10px 30px rgba(0,0,0,.5)" }}>
          {fys.map(f => {
            const active = f.year === selectedFY;
            return (
              <button key={f.year} role="option" aria-selected={active} data-active={active}
                onClick={() => choose(f.year)}
                style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10,
                  width:"100%", textAlign:"left", padding:"7px 10px", borderRadius:8, cursor:"pointer",
                  fontFamily:"'DM Sans'", fontSize:13, border:"1px solid transparent",
                  background: active ? "rgba(212,168,83,.15)" : "transparent",
                  borderColor: active ? T.accent : "transparent",
                  color: active ? T.accent : T.text, fontWeight: active ? 600 : 400 }}>
                <span>{fyLabel(f.year, fyStart)}</span>
                {f.partial && <span style={{ fontSize:11, color:T.sub }}>{f.indices.length} of 12</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FY TOOLBAR ───────────────────────────────────────────────────────────────
function FYToolbar({ fyStart, monthIdx, totalMonths = 48, selectedFY, onSelectFY, viewMode, onViewMode, onSettings }) {
  const { getAllFYs } = useCalendar();
  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [getAllFYs, fyStart, totalMonths]);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:18, padding:"10px 14px", background:T.inputBg, borderRadius:10, border:`1px solid ${T.border}` }}>
      <YearPicker fys={fys} selectedFY={selectedFY} fyStart={fyStart} onSelectFY={onSelectFY}/>
      <div style={{ flex:1 }}/>
      <div className="view-toggle">
        <button className={`vt-btn${viewMode === "month" ? " active" : ""}`} onClick={() => onViewMode("month")}>Monthly</button>
        <button className={`vt-btn${viewMode === "fy" ? " active" : ""}`} onClick={() => onViewMode("fy")}>{fyStart === 0 ? "Year" : "FY View"}</button>
      </div>
      <button className="btn btn-ghost btn-xs" onClick={onSettings} title={`Configure your ${yearNoun(fyStart)}`}>⚙ Year</button>
    </div>
  );
}

// ─── FY SETTINGS MODAL ───────────────────────────────────────────────────────
function FYSettingsModal({ fyStart, totalMonths, onSave, onClose, onAddEarlier }) {
  const dialog = useDialog(onClose);
  const { MONTHS, getAllFYs } = useCalendar();
  const [s, setS] = useState(fyStart);
  // Follows the prop, so adding an earlier year updates the open dialog too.
  const [tm, setTm] = useSyncedState(totalMonths);

  const fys = useMemo(() => getAllFYs(s, tm), [getAllFYs, s, tm]);
  const lastFY = fys[fys.length - 1];
  const firstMonth = MONTHS[0];
  const lastMonth = MONTHS[tm - 1];
  const canExtend = tm + 12 <= MAX_MONTHS;

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div {...dialog} aria-label="Year settings" className="modal">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:6 }}>Year Settings</div>
        <div style={{ fontSize:12, color:T.sub, marginBottom:16 }}>
          Most people leave this on January. Change it if you track a tax year or a business year.
        </div>

        <div className="sl" style={{ marginBottom:10 }}>Year starts in</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
          {MONTH_NAMES.map((m, i) => (
            <button key={i} className={`btn ${s===i ? "btn-primary" : "btn-ghost"} btn-sm`} style={{ justifyContent:"center" }} onClick={() => setS(i)}>
              {m}
            </button>
          ))}
        </div>
        <div style={{ padding:"10px 14px", background:"rgba(212,168,83,.06)", borderRadius:8, border:`1px solid rgba(212,168,83,.2)`, fontSize:12, color:T.sub, marginBottom:22 }}>
          Your {yearNoun(s)} runs <strong style={{ color:T.accent }}>{MONTH_NAMES[s]}</strong> → <strong style={{ color:T.accent }}>{MONTH_NAMES[(s+11)%12]}</strong>
          {s === 0 && <span style={{ color:T.success, marginLeft:8 }}>✓ Calendar year</span>}
          {s === 3 && <span style={{ color:T.success, marginLeft:8 }}>✓ UK tax year</span>}
        </div>

        {/* Extend Timeline */}
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:18, marginBottom:18 }}>
          <div className="sl" style={{ marginBottom:10 }}>Timeline Range</div>
          <div style={{ fontSize:13, color:T.sub, marginBottom:14 }}>
            Currently tracking <strong style={{ color:T.text }}>{fys.length} {s === 0 ? "years" : "financial years"}</strong> — {firstMonth?.label} through {lastMonth?.label}.
            Add future years as you go, or an earlier one to enter figures from before you started.
          </div>

          {/* FY chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {onAddEarlier && (
              <button onClick={onAddEarlier}
                title="Move the start of your timeline back a year so you can enter earlier figures"
                style={{ padding:"4px 12px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer",
                  background:"transparent", border:`1px dashed ${T.blue}`, color:T.blue,
                  display:"flex", alignItems:"center", gap:5, transition:"all .15s" }}>
                + Earlier year
              </button>
            )}
            {fys.map(f => (
              <div key={f.year} style={{ padding:"4px 12px", borderRadius:6, fontSize:12, fontWeight:500,
                background: f === lastFY ? "rgba(212,168,83,.15)" : "rgba(255,255,255,.04)",
                border:`1px solid ${f === lastFY ? T.accent : T.border}`,
                color: f === lastFY ? T.accent : T.sub }}>
                {fyLabel(f.year, s)}
                {f.partial && <span style={{ marginLeft:6, fontSize:10, opacity:.7 }}>· {f.indices.length} mo</span>}
                {f === lastFY && <span style={{ marginLeft:6, fontSize:10, opacity:.7 }}>← latest</span>}
              </div>
            ))}
            {canExtend && (
              <button onClick={() => setTm(t => t + 12)}
                style={{ padding:"4px 12px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer",
                  background:"transparent", border:`1px dashed ${T.accent}`, color:T.accent,
                  display:"flex", alignItems:"center", gap:5, transition:"all .15s" }}>
                + Add {fyLabel(lastFY ? lastFY.year + 1 : 2028, s)}
              </button>
            )}
          </div>

          {!canExtend && (
            <div style={{ fontSize:12, color:T.sub, padding:"8px 12px", background:"rgba(255,255,255,.03)", borderRadius:8 }}>
              Maximum timeline reached ({MONTHS[MAX_MONTHS-1]?.label})
            </div>
          )}

          {tm !== totalMonths && (
            <div style={{ fontSize:12, color:T.success, marginTop:4 }}>
              ✓ Timeline will extend to <strong>{MONTHS[tm-1]?.label}</strong> on save
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(s, tm)}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── CURRENCY MODAL ──────────────────────────────────────────────────────────
function CurrencyModal({ current, onSave, onClose }) {
  const dialog = useDialog(onClose);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(current.code);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? CURRENCIES.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.includes(q)) : CURRENCIES;
  }, [search]);
  const chosen = CURRENCIES.find(c => c.code === sel) || CURRENCIES[0];
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div {...dialog} aria-label="Choose currency" className="modal" style={{ width:560 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:6 }}>Choose Currency</div>
        <div style={{ fontSize:13, color:T.sub, marginBottom:16 }}>All amounts across the app will display in the selected currency.</div>
        {/* Search */}
        <input className="inp" placeholder="Search by name, code or symbol…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:"100%", marginBottom:14 }} autoFocus />
        {/* Grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, maxHeight:340, overflowY:"auto", marginBottom:16, paddingRight:4 }}>
          {filtered.map(c => {
            const active = c.code === sel;
            return (
              <button key={c.code} onClick={() => setSel(c.code)}
                style={{ background: active ? "rgba(212,168,83,.15)" : T.inputBg,
                  border:`1px solid ${active ? T.accent : T.border}`,
                  borderRadius:8, padding:"10px 12px", cursor:"pointer", textAlign:"left",
                  transition:"all .15s", display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ fontSize:20, lineHeight:1, color:T.accent }}>{flagEmoji(c.locale)}</span>
                <div style={{ overflow:"hidden" }}>
                  <div style={{ fontSize:12, fontWeight:600, color: active ? T.accent : T.text, whiteSpace:"nowrap" }}>
                    {c.code} <span style={{ color:T.sub, fontWeight:400 }}>{c.symbol}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.sub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:24, color:T.sub, fontSize:13 }}>No currencies match "{search}"</div>
          )}
        </div>
        {/* Preview */}
        <div style={{ padding:"10px 14px", background:"rgba(212,168,83,.06)", border:`1px solid rgba(212,168,83,.2)`, borderRadius:8, fontSize:13, marginBottom:20 }}>
          Preview: <strong style={{ color:T.accent }}>{chosen.symbol}1,234.56</strong>
          <span style={{ color:T.sub, marginLeft:12 }}>{flagEmoji(chosen.locale)} {chosen.name} ({chosen.code})</span>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(chosen)}>Apply</button>
        </div>
      </div>
    </div>
  );
}
// ─── MONTH PICKER ────────────────────────────────────────────────────────────
// One control rather than two selects: pick the year along the top, then the
// month from the grid beneath it. Browsing years inside the panel does not move
// the app — only choosing a month does — so you can look around before landing.
function MonthPicker({ monthIdx, totalMonths, onSelect }) {
  const { MONTHS, epoch } = useCalendar();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(null);
  const [todayIdx, setTodayIdx] = useState(-1);
  const wrapRef = useRef(null);

  // month index by year+month, so the grid can ask "does this cell exist?"
  const lookup = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < totalMonths; i++) {
      const m = MONTHS[i];
      if (m) map.set(m.absYear * 12 + m.absMonth, i);
    }
    return map;
  }, [MONTHS, totalMonths]);

  const years = useMemo(() => {
    const set = new Set();
    for (let i = 0; i < totalMonths; i++) if (MONTHS[i]) set.add(MONTHS[i].absYear);
    return [...set].sort((a, b) => a - b);
  }, [MONTHS, totalMonths]);

  const current = MONTHS[monthIdx];
  const shownYear = viewYear ?? current?.absYear;
  const idxFor = m => lookup.get(shownYear * 12 + m);

  // Opening resets the view to the selected year, and reads the clock here
  // rather than during render.
  const toggle = () => {
    if (!open) { setViewYear(current?.absYear); setTodayIdx(monthIndexOf(epoch)); }
    setOpen(o => !o);
  };
  const choose = i => { onSelect(i); setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") { setOpen(false); wrapRef.current?.querySelector("button")?.focus(); }
    };
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const atFirst = shownYear <= years[0];
  const atLast = shownYear >= years[years.length - 1];

  const yearBtn = disabled => ({
    background: "transparent", border: "none", color: disabled ? T.border : T.sub,
    cursor: disabled ? "default" : "pointer", fontSize: 17, lineHeight: 1,
    padding: "2px 9px", borderRadius: 6,
  });

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button onClick={toggle} aria-haspopup="dialog" aria-expanded={open} title="Jump to a month"
        style={{ fontSize: 14, fontWeight: 600, minWidth: 112, cursor: "pointer", background: T.inputBg,
          border: `1px solid ${open ? T.accent : T.border}`, color: T.text, fontFamily: "'DM Sans'",
          padding: "6px 12px", borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 7, transition: "border-color .15s" }}>
        {current?.label}
        <span aria-hidden="true" style={{ fontSize: 9, color: T.sub }}>▼</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Jump to a month"
          style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, zIndex: 150,
            width: 252, boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>

          {/* Year along the top */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10, paddingBottom: 9, borderBottom: `1px solid ${T.border}` }}>
            <button onClick={() => !atFirst && setViewYear(shownYear - 1)} disabled={atFirst}
              aria-label="Previous year" style={yearBtn(atFirst)}>‹</button>
            <div style={{ fontFamily: "'Playfair Display'", fontSize: 16, fontWeight: 600, color: T.accent }}>
              {shownYear}
            </div>
            <button onClick={() => !atLast && setViewYear(shownYear + 1)} disabled={atLast}
              aria-label="Next year" style={yearBtn(atLast)}>›</button>
          </div>

          {/* Months underneath. Every month keeps its cell so the grid holds its
              shape; the ones outside the tracked timeline are simply not
              selectable, rather than leaving holes in the layout. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
            {MONTH_NAMES.map((label, m) => {
              const i = idxFor(m);
              const exists = i !== undefined;
              const selected = exists && i === monthIdx;
              const isToday = exists && i === todayIdx;
              return (
                <button key={label} disabled={!exists}
                  onClick={() => exists && choose(i)}
                  aria-current={selected ? "true" : undefined}
                  title={!exists ? `${label} ${shownYear} is outside your timeline`
                       : isToday ? `${label} ${shownYear} — the month you are in` : undefined}
                  style={{ padding: "8px 0", borderRadius: 6, fontSize: 12, fontFamily: "'DM Sans'",
                    cursor: exists ? "pointer" : "default",
                    fontWeight: selected ? 700 : 400,
                    background: selected ? "rgba(212,168,83,.16)" : exists ? T.inputBg : "transparent",
                    border: `1px solid ${selected ? T.accent : isToday ? T.blue : "transparent"}`,
                    color: selected ? T.accent : exists ? T.text : T.border,
                    opacity: exists ? 1 : .55 }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CRASH RECOVERY ──────────────────────────────────────────────────────────
// Without this, any render exception unmounted the whole tree to a blank page,
// and because saving is manual it took everything entered since the last save
// with it. React has no hook equivalent for componentDidCatch, so this is the
// one class component in the app.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    this.setState({ stack: info?.componentStack || null });
    // Still worth having in the console for anyone with devtools open.
    console.error("Yo Cent-E crashed:", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <CrashScreen
        scope={this.props.scope}
        error={this.state.error}
        stack={this.state.stack}
        onDismiss={this.props.onDismiss}
        onReset={() => this.setState({ error: null, stack: null })}
      />
    );
  }
}

function CrashScreen({ scope, error, stack, onReset, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const whole = scope === "app";

  const report = [
    `Yo Cent-E ${DATA_VER}`,
    `When: ${new Date().toISOString()}`,
    `Where: ${whole ? "whole app" : "page content"}`,
    `Error: ${error?.message || String(error)}`,
    error?.stack ? `\n${error.stack}` : "",
    stack ? `\nComponent stack:${stack}` : "",
  ].join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { /* clipboard blocked — the details are on screen to select instead */ }
  };
  const backup = async () => {
    try { await downloadBackupFile(); setSaved(true); setTimeout(() => setSaved(false), 2500); }
    catch { /* nothing more we can do from here */ }
  };

  return (
    <div style={{ padding: whole ? "70px 24px" : "40px 24px", display:"flex", justifyContent:"center" }}>
      <div className="card" style={{ padding:28, maxWidth:620, width:"100%" }}>
        <div style={{ fontSize:34, marginBottom:12 }}>🪙</div>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:21, fontWeight:600, marginBottom:8 }}>
          {whole ? "Yo Cent-E ran into a problem" : "This page couldn't be displayed"}
        </div>
        <div style={{ fontSize:14, color:T.sub, marginBottom:6 }}>
          Something went wrong while drawing {whole ? "the app" : "this page"}. This is a fault in Yo Cent-E,
          not something you did.
        </div>
        <div style={{ fontSize:14, color:T.sub, marginBottom:22 }}>
          <strong style={{ color:T.text }}>Your saved data has not been touched.</strong> Anything entered
          in the last second or two may not be, so take a backup before reloading.
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
          <button className="btn btn-primary" style={{ justifyContent:"center", padding:"11px 18px" }} onClick={backup}>
            {saved ? "✓ Backup downloaded" : "↓ Download a backup of my data"}
          </button>
          {!whole && onDismiss && (
            <button className="btn btn-ghost" style={{ justifyContent:"center", padding:"10px 18px" }}
              onClick={() => { onReset(); onDismiss(); }}>
              ← Go back to the Dashboard
            </button>
          )}
          <button className="btn btn-ghost" style={{ justifyContent:"center", padding:"10px 18px" }}
            onClick={() => window.location.reload()}>
            ↻ Reload Yo Cent-E
          </button>
        </div>

        <details style={{ fontSize:12, color:T.sub }}>
          <summary style={{ cursor:"pointer", marginBottom:10 }}>What went wrong (useful if you're reporting this)</summary>
          <pre style={{ background:T.inputBg, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px",
            fontSize:11, lineHeight:1.5, overflowX:"auto", whiteSpace:"pre-wrap", wordBreak:"break-word",
            maxHeight:220, overflowY:"auto", color:T.sub, fontFamily:"monospace" }}>{report}</pre>
          <button className="btn btn-ghost btn-sm" style={{ marginTop:10 }} onClick={copy}>
            {copied ? "✓ Copied" : "Copy report"}
          </button>
        </details>
      </div>
    </div>
  );
}

// ─── SAVE STATUS ─────────────────────────────────────────────────────────────
// Replaces the Save All button. Work is written shortly after you stop making
// it, so the header only has to say where things stand — and stays clickable
// for anyone who wants to force a save before closing the laptop.
function SaveStatus({ state, savedAt, onSaveNow }) {
  // "now" is held in state rather than read during render, so the label stays a
  // pure function of props and state. It resets to the moment of the save — so
  // a fresh save reads "just now" — and the interval carries it forward.
  const [now, setNow] = useSyncedState(savedAt || 0);
  useEffect(() => {
    if (!savedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [savedAt, setNow]);

  const ago = ts => {
    const secs = Math.max(0, Math.round((now - ts) / 1000));
    if (secs < 45) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    return `${Math.round(mins / 60)} hr ago`;
  };

  const look =
    state === "pending" ? { dot: T.warning, text: "Unsaved changes", title: "Saving shortly — click to save now" }
  : state === "saving"  ? { dot: T.blue,    text: "Saving…",         title: "Writing to this browser" }
  : savedAt             ? { dot: T.success, text: `Saved ${ago(savedAt)}`, title: "Click to save again now" }
  :                       { dot: T.border,  text: "All changes saved",     title: "Nothing to save yet" };

  return (
    <button onClick={onSaveNow} title={look.title}
      style={{ display:"flex", alignItems:"center", gap:7, background:"transparent", border:"none",
        cursor:"pointer", fontFamily:"'DM Sans'", fontSize:12, color:T.sub, padding:"6px 4px", minWidth:132 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:look.dot, flexShrink:0,
        transition:"background .2s" }}/>
      {look.text}
    </button>
  );
}

// ─── BACKUP & RESTORE ────────────────────────────────────────────────────────
function DataModal({ userName, onExport, onImport, importState, onClose }) {
  const dialog = useDialog(onClose);
  const fileRef = useRef(null);
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div {...dialog} aria-label="Back up or restore your data" className="modal">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:6 }}>Your Data</div>
        <div style={{ fontSize:13, color:T.sub, marginBottom:18 }}>
          Everything you enter is stored in this browser only — it never reaches a server.
          That keeps it private, but it also means clearing your browser data, or switching
          to another device, starts you from nothing. A backup file is the way across.
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
          <button className="btn btn-primary" style={{ justifyContent:"center", padding:"11px 18px" }} onClick={onExport}>
            ↓ Download a backup
          </button>
          <button className="btn btn-ghost" style={{ justifyContent:"center", padding:"10px 18px" }}
            onClick={() => fileRef.current?.click()}>
            ↑ Restore from a backup file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display:"none" }}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onImport(f); }} />
        </div>

        {importState?.error && (
          <div style={{ padding:"10px 14px", background:"rgba(240,100,100,.08)", border:`1px solid rgba(240,100,100,.3)`,
            borderRadius:8, fontSize:12, color:T.danger, marginBottom:16 }}>{importState.error}</div>
        )}
        {importState?.ok && (
          <div style={{ padding:"10px 14px", background:"rgba(82,196,122,.08)", border:`1px solid rgba(82,196,122,.3)`,
            borderRadius:8, fontSize:12, color:T.success, marginBottom:16 }}>
            Restored {importState.count} fields
            {importState.exportedAt ? ` from the backup saved ${new Date(importState.exportedAt).toLocaleString()}` : ""}.
          </div>
        )}

        <div style={{ fontSize:11, color:T.sub, marginBottom:18 }}>
          The backup is a plain JSON file{userName ? `, named after your profile` : ""}. Restoring replaces
          what is in this browser, and downloads what is there now first.
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Shown when storage holds a profile written by a build this one does not know.
// Previously this case silently discarded everything; nothing is touched now
// until the user chooses, and a backup is written before anything is erased.
function VersionConflictModal({ found, onBackup, onLoadAnyway, onDiscard }) {
  const dialog = useDialog(undefined);
  return (
    <div className="modal-bg">
      <div {...dialog} aria-label="Data from a different version" className="modal">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:6 }}>
          This browser holds data from a different version
        </div>
        <div style={{ fontSize:13, color:T.sub, marginBottom:8 }}>
          The saved profile says it was written by <strong style={{ color:T.accent }}>{String(found)}</strong>,
          which this version of Yo Cent-E does not recognise. Nothing has been changed or deleted.
        </div>
        <div style={{ fontSize:13, color:T.sub, marginBottom:20 }}>
          Download a backup first — that file can be restored into any version that understands it.
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button className="btn btn-primary" style={{ justifyContent:"center", padding:"11px 18px" }} onClick={onBackup}>
            ↓ Download a backup
          </button>
          <button className="btn btn-ghost" style={{ justifyContent:"center", padding:"10px 18px" }} onClick={onLoadAnyway}>
            Try to open it anyway
          </button>
          <button className="btn btn-ghost" style={{ justifyContent:"center", padding:"10px 18px", borderColor:T.danger, color:T.danger }}
            onClick={onDiscard}>
            Start fresh — erases this profile
          </button>
        </div>
      </div>
    </div>
  );
}

// `kinds` is passed for savings only: each category is a pot or an investment,
// and the dashboard's two gauges split on that rather than on the name.
function CategoryModal({ title, streams, kinds, onSave, onClose }) {
  const dialog = useDialog(onClose);
  const [list, setList] = useState([...streams]);
  // Tracks each current label back to the name its data is stored under, so the
  // save handler can move history across a rename.
  const [origin, setOrigin] = useState(() => Object.fromEntries(streams.map(s => [s, s])));
  const [draftKinds, setDraftKinds] = useState(() => ({ ...(kinds || {}) }));
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState({});
  const removed = streams.filter(s => !Object.values(origin).includes(s));
  const showKinds = !!kinds;
  const kindOf = s => draftKinds[s] || inferSavingsKind(s);
  const toggleKind = s => setDraftKinds(k => ({ ...k, [s]: kindOf(s) === "investment" ? "pot" : "investment" }));
  const add = () => { const n = newName.trim(); if (!n || list.includes(n)) return; setList([...list, n]); setNewName(""); };
  const remove = s => {
    setList(list.filter(x => x !== s));
    setOrigin(o => { const c = {...o}; delete c[s]; return c; });
  };
  const rename = (old, nv) => {
    const n = nv.trim();
    if (!n || (list.includes(n) && n !== old)) return;
    setList(list.map(x => x === old ? n : x));
    setOrigin(o => { const c = {...o}; if (old in c) { c[n] = c[old]; delete c[old]; } return c; });
    setDraftKinds(k => { const c = {...k}; if (old in c) { c[n] = c[old]; delete c[old]; } else { c[n] = kindOf(old); } return c; });
    setEditing(e => { const c={...e}; delete c[old]; return c; });
  };
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div {...dialog} aria-label="Manage categories" className="modal">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:18 }}>Manage {title} Categories</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20, maxHeight:300, overflowY:"auto" }}>
          {list.map(s => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
              {editing[s] !== undefined ? (
                <><input className="inp" value={editing[s]} autoFocus style={{ flex:1 }}
                    onChange={e => setEditing(p => ({...p,[s]:e.target.value}))}
                    onKeyDown={e => { if(e.key==="Enter")rename(s,editing[s]); if(e.key==="Escape")setEditing(p=>{const c={...p};delete c[s];return c;}); }} />
                  <button className="btn btn-primary btn-sm" onClick={() => rename(s, editing[s])}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p=>{const c={...p};delete c[s];return c;})} aria-label="Cancel rename">✕</button></>
              ) : (
                <><span style={{ flex:1, fontSize:13 }}>{s}</span>
                  {showKinds && (
                    <button onClick={() => toggleKind(s)}
                      title="Counts towards the Investments gauge instead of Savings"
                      style={{ fontSize:11, padding:"3px 9px", borderRadius:20, cursor:"pointer", fontFamily:"'DM Sans'",
                        background: kindOf(s) === "investment" ? "rgba(126,179,245,.12)" : "rgba(82,196,122,.1)",
                        border:`1px solid ${kindOf(s) === "investment" ? T.blue : T.success}`,
                        color: kindOf(s) === "investment" ? T.blue : T.success }}>
                      {kindOf(s) === "investment" ? "📈 Investment" : "🏦 Pot"}
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => setEditing(p=>({...p,[s]:s}))} aria-label={`Rename ${s}`}>✎</button>
                  <button className="btn-icon" style={{ color:T.danger }} onClick={() => remove(s)} aria-label={`Remove ${s}`}>✕</button></>
              )}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          <input className="inp" style={{ flex:1 }} placeholder="New category…" value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter"&&add()} />
          <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
        </div>
        {removed.length > 0 && (
          <div style={{ padding:"10px 14px", background:"rgba(245,166,35,.08)", border:`1px solid rgba(245,166,35,.3)`,
            borderRadius:8, fontSize:12, color:T.sub, marginBottom:16 }}>
            <strong style={{ color:T.warning }}>Removing {removed.join(", ")}.</strong>{" "}
            Their entries stay hidden from every view and total. Add the same name back to restore them.
          </div>
        )}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(list, origin, showKinds ? draftKinds : undefined)}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── BASELINE EDITOR ─────────────────────────────────────────────────────────
function BaselineEditorModal({ section, streams, data, fyStart, monthIdx, totalMonths, onSave, onClose }) {
  const dialog = useDialog(onClose);
  const { MONTHS, getFYYear, getFYMonths, getAllFYs } = useCalendar();
  const { fmt } = useMoney();
  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [getAllFYs, fyStart, totalMonths]);
  const [selFY, setSelFY] = useState(() => getFYYear(monthIdx, fyStart) ?? fys[0]?.year);
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(data)));
  const [fillVal, setFillVal] = useState({});

  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  const update = (stream, mi, val) => {
    setDraft(prev => {
      const arr = [...(prev[stream] || Array(MAX_MONTHS).fill(0))];
      arr[mi] = parseFloat(val) || 0;
      return { ...prev, [stream]: arr };
    });
  };
  const fillAll = (stream, val) => {
    setDraft(prev => {
      const arr = [...(prev[stream] || Array(MAX_MONTHS).fill(0))];
      fyMonths.forEach(mi => { arr[mi] = parseFloat(val) || 0; });
      return { ...prev, [stream]: arr };
    });
  };
  const copyFromPrev = () => {
    const prevFY = fys.find(f => f.year === selFY - 1);
    if (!prevFY) return;
    setDraft(prev => {
      const next = { ...prev };
      streams.forEach(s => {
        const arr = [...(next[s] || Array(MAX_MONTHS).fill(0))];
        fyMonths.forEach((mi, i) => { arr[mi] = arr[prevFY.indices[i]] || 0; });
        next[s] = arr;
      });
      return next;
    });
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div {...dialog} aria-label="Edit baselines" className="modal modal-wide">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:17, fontWeight:600 }}>Edit {section} Baselines</div>
          <YearPicker fys={fys} selectedFY={selFY} fyStart={fyStart} onSelectFY={setSelFY}/>
        </div>
        <div style={{ fontSize:12, color:T.sub, marginBottom:14 }}>
          Baselines are usually reviewed at the start of your {yearNoun(fyStart)}{fyStart !== 0 && ` (${MONTH_NAMES[fyStart]})`}. Enter monthly values for each category in the selected year.
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={copyFromPrev}>↩ Copy from prev FY</button>
          <div style={{ marginLeft:"auto", fontSize:11, color:T.sub, alignSelf:"center" }}>
            💡 Formulas supported — e.g. <span style={{ color:T.accent, fontFamily:"monospace" }}>45+32+73</span> or <span style={{ color:T.accent, fontFamily:"monospace" }}>(120+80)*0.5</span>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="sticky-col sticky-col-2">
            <thead>
              <tr>
                <th style={{ width:160, minWidth:160, maxWidth:160 }}>Category</th>
                <th style={{ color:T.warning, fontSize:10 }}>Fill All →</th>
                {fyMonths.map(mi => <th key={mi} style={{ fontSize:11 }}>{MONTHS[mi]?.short}</th>)}
                <th style={{ color:T.accent, minWidth:96 }}>{fyStart === 0 ? "Year Total" : "FY Total"}</th>
              </tr>
            </thead>
            <tbody>
              {streams.map(s => {
                const fyTotal = fyMonths.reduce((a, mi) => a + (draft[s]?.[mi] || 0), 0);
                return (
                  <tr key={s}>
                    <td style={{ fontSize:12 }}>{s}</td>
                    <td>
                      <FormulaCell value={fillVal[s] || ""} placeholder="—" style={{ width:60 }}
                        onCommit={v => { setFillVal(p=>({...p,[s]:v})); if(v) fillAll(s, v); }} />
                    </td>
                    {fyMonths.map(mi => (
                      <td key={mi}>
                        <FormulaCell value={draft[s]?.[mi] || ""}
                          cellId={`bl.${section}.${s}.${mi}`}
                          onCommit={v => update(s, mi, v)} />
                      </td>
                    ))}
                    <td style={{ color:T.accent, fontWeight:600, fontSize:12 }}>{fmt(fyTotal)}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>{fyStart === 0 ? "Year Total" : "FY Total"}</td>
                <td></td>
                {fyMonths.map(mi => (
                  <td key={mi} style={{ fontSize:11 }}>{fmt(streams.reduce((a,s)=>a+(draft[s]?.[mi]||0),0))}</td>
                ))}
                <td>{fmt(fyMonths.reduce((a,mi)=>a+streams.reduce((b,s)=>b+(draft[s]?.[mi]||0),0),0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)}>Save Baselines</button>
        </div>
      </div>
    </div>
  );
}

// ─── GAUGE DIAL ───────────────────────────────────────────────────────────────
// `target` is what should have been put aside by now; `annual` is the whole
// year. The ring measures pace against the former — measuring against the full
// year meant someone exactly on plan still read as behind for eleven months.
// A bullet bar: how much of the target is done, and — part-way through a year
// — whether that is where you should be by now. This replaces the pair of gauge
// dials on the dashboard. A dial reads as a speedometer when the thing being
// shown is really a percentage, and two of them already filled the row, so
// there was nowhere to put spending without the section becoming a page of its
// own. Bars stack, so the third fits.
//
// `mark` is the figure to judge against: pro-rata for a year in progress, and
// null for a single month, where the month's own baseline is the comparison.
// The tick is drawn only when the mark sits short of the target, since on a
// finished period the two are the same line.
function PaceBar({ label, icon, actual, target, mark, color, lowerIsBetter = false, sub }) {
  const { fmt } = useMoney();
  const has = target > 0;
  const pct = has ? actual / target : 0;
  const markPct = has && mark != null ? mark / target : null;
  // Settle to the penny before judging, so a rounding tail is not read as "over".
  const raw = mark == null ? actual - target : actual - mark;
  const off = Math.abs(raw) < 0.005 ? 0 : raw;
  const good = off === 0 ? true : lowerIsBetter ? off < 0 : off > 0;
  const tone = !has || off === 0 ? T.sub : good ? T.success : lowerIsBetter ? T.danger : T.warning;
  const status = !has ? "No target set"
    : off === 0 ? "On track"
    : lowerIsBetter ? `${fmt(Math.abs(off))} ${off > 0 ? "over" : "under"}`
    : `${fmt(Math.abs(off))} ${off > 0 ? "ahead" : "behind"}`;
  // Overspending is the one case where the bar's own colour should carry the
  // warning — a full green bar for a blown budget reads as success.
  const fillColor = lowerIsBetter && off > 0 ? T.danger : color;
  const overColor = lowerIsBetter ? T.danger : T.success;

  return (
    <div className="pace-row">
      <div className="pace-head">
        <span className="pace-label">{icon} {label}</span>
        <span>
          <b style={{ color: fillColor }}>{fmt(actual)}</b>
          <span style={{ color:T.sub }}> {has ? `of ${fmt(target)}` : ""}</span>
        </span>
      </div>
      <div className="pace-track" role="progressbar"
        aria-valuemin={0} aria-valuemax={Math.round(target)} aria-valuenow={Math.round(actual)}
        aria-valuetext={`${fmt(actual)}${has ? ` of ${fmt(target)}` : ""} — ${status}`}
        aria-label={label}>
        <div className="pace-fill" style={{ width:`${Math.max(0, Math.min(pct, 1)) * 100}%`, background: fillColor }}/>
        {pct > 1 && <div className="pace-over" title={lowerIsBetter ? "Over target" : "Past target"}
          style={{ background: overColor, boxShadow: `-2px 0 5px ${overColor}` }}/>}
        {markPct != null && markPct > 0.005 && markPct < 0.995 &&
          <div className="pace-mark" style={{ left:`${markPct * 100}%` }} title={`Expected by now: ${fmt(mark)}`}/>}
      </div>
      <div className="pace-head" style={{ marginTop:5 }}>
        <span style={{ color:T.sub, fontSize:11 }}>{sub}</span>
        <span style={{ color:tone, fontWeight:600, fontSize:11 }}>{status}</span>
      </div>
    </div>
  );
}

function GaugeDial({ label, actual, target, annual, color, sub, icon }) {
  const { fmt } = useMoney();
  const raw = target > 0 ? actual/target : 0;
  const ARC = 220, START = 160;
  const toR = d => d * Math.PI / 180;
  const pt = d => ({ x: 110+80*Math.cos(toR(d)), y: 105+80*Math.sin(toR(d)) });
  const arc = (s, sw) => { const a=pt(s),b=pt(s+sw); return `M${a.x} ${a.y}A80 80 0 ${sw>180?1:0} 1 ${b.x} ${b.y}`; };
  const fill = Math.min(raw,1)*ARC;
  const sc = raw>=1?T.success:raw>=.75?T.accent:raw>=.5?T.warning:T.danger;
  const ticks = [0,.25,.5,.75,1].map(t => {
    const d=START+t*ARC, r2=96;
    return { inner:pt(d), outer:{x:110+r2*Math.cos(toR(d)),y:105+r2*Math.sin(toR(d))},
      lbl:{x:110+110*Math.cos(toR(d)),y:105+110*Math.sin(toR(d))}, t };
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width={220} height={155} viewBox="0 0 220 155">
        <path d={arc(START,ARC)} fill="none" stroke="#1e3350" strokeWidth={14} strokeLinecap="round"/>
        {fill>0&&<path d={arc(START,fill)} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"/>}
        {fill>0&&<path d={arc(START,fill)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={.3}/>}
        {ticks.map(({inner,outer,lbl,t})=>(
          <g key={t}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={t<=raw?color:"#1e3350"} strokeWidth={t===0||t===1?2:1.5}/>
            <text x={lbl.x} y={lbl.y+3} textAnchor="middle" fill="#4a6070" fontSize={8} fontFamily="DM Sans">
              {t===0?"0":t===1?"100%":`${t*100}%`}
            </text>
          </g>
        ))}
        <text x={110} y={79} textAnchor="middle" fontSize={18}>{icon}</text>
        <text x={110} y={104} textAnchor="middle" fill={sc} fontSize={23} fontFamily="Playfair Display" fontWeight={700}>{Math.round(raw*100)}%</text>
        <text x={110} y={122} textAnchor="middle" fill={T.text} fontSize={13} fontFamily="DM Sans" fontWeight={600}>{fmt(actual)}</text>
        <text x={110} y={136} textAnchor="middle" fill={T.sub} fontSize={10} fontFamily="DM Sans">
          {target > 0 ? `of ${fmt(target)} due by now` : annual > 0 ? `${fmt(annual)} planned for the year` : "no target set"}
        </text>
      </svg>
      <div style={{ fontFamily:"'Playfair Display'", fontSize:14, fontWeight:600, marginTop:-4 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:T.sub, marginTop:2, textAlign:"center", maxWidth:200 }}>{sub}</div>}
    </div>
  );
}

// ─── COMBO CHART (bar + cumulative line + projection) ────────────────────────
function AnnotatedTooltip({ active, payload, label }) {
  const { fmt } = useMoney();
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", fontSize:12, minWidth:180 }}>
      <div style={{ fontWeight:600, marginBottom:6 }}>{label}</div>
      {payload.map((p,i)=>p.value!=null&&(
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:16, color:p.color, marginBottom:2 }}>
          <span>{p.name}</span><span style={{ fontWeight:600 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Savings and expenditure record actuals per week; income records them per
// month. The chart takes whichever shape it is given rather than assuming one.
// `showForecast` is off for income, which has no forecast series — drawing one
// would duplicate the baseline bar and its cumulative line.
// A funnel, drawn rather than borrowed from a font. There is no unicode funnel
// that renders the same across platforms, and the geometric glyphs used
// elsewhere all read as "grid" or "shape" rather than "filter".
function FilterIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true"
      style={{ display:"block", flexShrink:0 }}>
      <path d="M1.9 2.7h12.2a.55.55 0 0 1 .42.9l-4.43 5.22v4.3a.55.55 0 0 1-.3.49l-2.6 1.32a.55.55 0 0 1-.8-.49V8.82L1.48 3.6a.55.55 0 0 1 .42-.9z"
        fill="currentColor"/>
    </svg>
  );
}

// Which categories a chart or dial is showing: all of them to begin with, and
// kept in step as categories are added or removed without discarding what the
// user had already unticked.
function useStreamSelection(streams) {
  const [sel, setSel] = useState(streams);
  const [seen, setSeen] = useState(streams);
  if (seen !== streams) {
    setSeen(streams);
    setSel(prev => [...prev.filter(x => streams.includes(x)), ...streams.filter(x => !prev.includes(x))]);
  }
  return [sel, setSel];
}

// The funnel button and its dropdown. Shared by the charts and the savings
// dial so the same control does the same thing everywhere.
function StreamFilter({ streams, sel, setSel, color, label = "Included categories" }) {
  const [open, setOpen] = useState(false);
  const filtered = sel.length !== streams.length;
  const toggle = s => setSel(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  return (
    <div style={{ position:"relative" }}>
      <button className="btn btn-ghost btn-sm" style={{ gap:6 }} onClick={()=>setOpen(o=>!o)}
        aria-expanded={open} aria-haspopup="true"
        title={filtered ? `Filtered to ${sel.length} of ${streams.length} categories` : "Filter categories"}>
        <FilterIcon/>{sel.length}/{streams.length}
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:T.card,
          border:`1px solid ${T.border}`, borderRadius:10, padding:14, zIndex:50, minWidth:210,
          maxHeight:280, overflowY:"auto", boxShadow:"0 8px 24px rgba(0,0,0,.4)", textAlign:"left" }}>
          <div className="sl" style={{ marginBottom:8 }}>{label}</div>
          {streams.map(sname => (
            <div key={sname} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 2px", fontSize:13 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1, minWidth:0 }}>
                <input type="checkbox" checked={sel.includes(sname)} onChange={()=>toggle(sname)}
                  style={{ accentColor:color, flexShrink:0 }}/>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sname}</span>
              </label>
              {/* Isolating one category out of a long list should not mean
                  unticking every other one. */}
              <button className="pick-only" onClick={()=>setSel([sname])} title={`Show only ${sname}`}>only</button>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex:1 }} disabled={!filtered}
              onClick={()=>setSel(streams)}>All</button>
            <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComboChart({ title, streams, weeklyData, monthlyData, forecastData, baselineData,
  fyMonths, color, type, showForecast = true }) {
  const { MONTHS } = useCalendar();
  const { fmt, fmtAxis } = useMoney();
  const actualAt = (s, mi) => monthlyData ? monthlyVal(monthlyData, s, mi) : weeklyTotal(weeklyData, s, mi);
  const [sel, setSel] = useStreamSelection(streams);

  // Built with reduce rather than accumulators mutated inside a map, so nothing
  // is reassigned mid-render — the pattern the React Compiler rejects.
  const { rows: raw, lastActIdx } = fyMonths.reduce((acc, mi) => {
    const baseline = sel.reduce((a,s)=>a+(baselineData[s]?.[mi]||0),0);
    const forecast = showForecast ? sel.reduce((a,s)=>a+(forecastData[s]?.[mi]||0),0) : 0;
    const actual   = sel.reduce((a,s)=>a+actualAt(s,mi),0);
    const hasAct   = actual > 0;
    const cb = acc.cb + baseline, cf = acc.cf + forecast, ca = acc.ca + (hasAct ? actual : 0);
    acc.rows.push({ name:MONTHS[mi]?.short, mi, baseline, forecast,
      actual, cumBaseline:cb, cumForecast:cf, cumActual: hasAct || ca > 0 ? ca : null });
    return { ...acc, cb, cf, ca, lastActIdx: hasAct ? mi : acc.lastActIdx };
  }, { rows: [], cb: 0, cf: 0, ca: 0, lastActIdx: -1 });

  const monthsWithData = raw.filter(d=>d.actual>0);
  const avgMonthly = monthsWithData.length>1 ? monthsWithData.reduce((a,d)=>a+d.actual,0)/monthsWithData.length : 0;
  const lastCum = monthsWithData.length>0 ? monthsWithData[monthsWithData.length-1].cumActual : 0;
  const data = raw.map(d => {
    let projection = null;
    if (lastActIdx >= 0 && avgMonthly > 0) {
      if (d.mi === lastActIdx) projection = d.cumActual;
      // months since the last actual, each adding one month of the rolling average
      else if (d.mi > lastActIdx) {
        const stepsAhead = raw.filter(r => r.mi > lastActIdx && r.mi <= d.mi).length;
        projection = lastCum + avgMonthly * stepsAhead;
      }
    }
    return { ...d, projection };
  });
  const projEnd = data[data.length-1]?.projection;
  const basEnd  = data[data.length-1]?.cumBaseline;

  const BC={baseline:"#344d68",forecast:type==="savings"?"#3a8a5e":"#8a6a3a",actual:color};
  // Distinct line palettes — savings uses cool greens/teals, expenditure uses warm oranges/reds
  const LC = type === "savings"
    ? { cumBaseline:"#5b8db8", cumForecast:"#2dd4a0", cumActual:"#52c47a", projection:"#a8d4b8" }
    : { cumBaseline:"#c4896a", cumForecast:"#f5c842", cumActual:"#f06464", projection:"#d4a0a0" };

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:16, fontWeight:600 }}>{title}</div>
          <div style={{ fontSize:11, color:T.sub, marginTop:1 }}>Bars = monthly · Lines = cumulative · Dashed = projection</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {projEnd&&<div style={{ fontSize:11, background:"rgba(255,255,255,.04)", border:`1px solid ${T.border}`, borderRadius:6, padding:"4px 10px", color:T.sub }}>
            Proj. year-end: <strong style={{ color:T.text }}>{fmt(projEnd)}</strong>
          </div>}
          <StreamFilter streams={streams} sel={sel} setSel={setSel} color={color}/>
        </div>
      </div>
      <div style={{ display:"flex", gap:12, margin:"10px 0", flexWrap:"wrap" }}>
        {[{k:"baseline",l:"Baseline",t:"bar",c:BC.baseline},
          ...(showForecast?[{k:"forecast",l:"Forecast",t:"bar",c:BC.forecast}]:[]),
          {k:"actual",l:"Actual",t:"bar",c:BC.actual},
          {k:"cumBaseline",l:"Cum. Baseline",t:"line",c:LC.cumBaseline,d:true},
          ...(showForecast?[{k:"cumForecast",l:"Cum. Forecast",t:"line",c:LC.cumForecast}]:[]),
          {k:"cumActual",l:"Cum. Actual",t:"line",c:LC.cumActual},
          ...(avgMonthly>0?[{k:"projection",l:"Projected",t:"line",c:LC.projection,d:true}]:[])
        ].map(({k,l,t,c,d})=>(
          <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:T.sub }}>
            {t==="bar"?<div style={{ width:9,height:9,borderRadius:2,background:c }}/>:<svg width={20} height={6}><line x1={0} y1={3} x2={20} y2={3} stroke={c} strokeWidth={2} strokeDasharray={d?"4 3":"none"}/></svg>}
            {l}
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
          <XAxis dataKey="name" tick={{fill:T.sub,fontSize:11}} axisLine={false} tickLine={false}/>
          <YAxis yAxisId="m" orientation="left" tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={40}/>
          <YAxis yAxisId="c" orientation="right" tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={40}/>
          <Tooltip content={<AnnotatedTooltip/>}/>
          <Bar yAxisId="m" dataKey="baseline" name="Baseline" fill={BC.baseline} radius={[3,3,0,0]} barSize={8}/>
          {showForecast && <Bar yAxisId="m" dataKey="forecast" name="Forecast" fill={BC.forecast} radius={[3,3,0,0]} barSize={8}/>}
          <Bar yAxisId="m" dataKey="actual" name="Actual" fill={BC.actual} radius={[3,3,0,0]} barSize={8}/>
          <Line yAxisId="c" type="monotone" dataKey="cumBaseline" name="Cum. Baseline" stroke={LC.cumBaseline} strokeWidth={1.5} dot={false} strokeDasharray="5 4" connectNulls/>
          {showForecast && <Line yAxisId="c" type="monotone" dataKey="cumForecast" name="Cum. Forecast" stroke={LC.cumForecast} strokeWidth={1.5} dot={false} connectNulls/>}
          <Line yAxisId="c" type="monotone" dataKey="cumActual" name="Cum. Actual" stroke={LC.cumActual} strokeWidth={2.5} dot={false} connectNulls/>
          {avgMonthly>0&&<Line yAxisId="c" type="monotone" dataKey="projection" name="Projected" stroke={LC.projection} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls/>}
        </ComposedChart>
      </ResponsiveContainer>
      {avgMonthly>0&&(
        <div style={{ marginTop:8, padding:"8px 12px", background:"rgba(255,255,255,.03)", borderRadius:8, fontSize:12, color:T.sub, display:"flex", gap:20, flexWrap:"wrap" }}>
          <span>Rolling avg: <strong style={{color:T.text}}>{fmt(avgMonthly)}/mo</strong></span>
          <span>Data points: <strong style={{color:T.text}}>{monthsWithData.length}</strong></span>
          <span>Total to date: <strong style={{color}}>{fmt(monthsWithData.reduce((a,d)=>a+d.actual,0))}</strong></span>
          {projEnd&&<span>Year-end: <strong style={{color:T.text}}>{fmt(projEnd)}</strong> vs <strong style={{color:"#4a6a88"}}>{fmt(basEnd)}</strong> baseline</span>}
        </div>
      )}
    </div>
  );
}

// ─── FY SUMMARY TABLE (used in Income / Savings / Expenditure FY view) ────────
function FYSummaryTable({ streams, fyMonths, baselineData, forecastData, weeklyData, incomeActual, type, fyStart }) {
  const { MONTHS } = useCalendar();
  const { fmt, fmtS } = useMoney();
  const isWeekly = !!weeklyData;
  const getVal = (s, mi) => isWeekly ? weeklyTotal(weeklyData, s, mi) : monthlyVal(incomeActual, s, mi);
  const getBl   = (s, mi) => monthlyVal(baselineData, s, mi);
  const good = type === "savings";

  return (
    <div style={{ overflowX:"auto" }}>
      <table className="sticky-col">
        <thead>
          <tr>
            <th style={{ width:150, minWidth:150 }}>Category</th>
            {fyMonths.map(mi=><th key={mi} style={{ fontSize:10 }}>{MONTHS[mi]?.short}</th>)}
            <th style={{ color:T.accent, minWidth:96 }}>{fyStart === 0 ? "Year Total" : "FY Total"}</th>
          </tr>
        </thead>
        <tbody>
          {streams.map(s => {
            const actuals = fyMonths.map(mi => getVal(s, mi));
            const total = actuals.reduce((a,v)=>a+v,0);
            const blTotal = fyMonths.reduce((a,mi)=>a+getBl(s,mi),0);
            const v = total - blTotal;
            return (
              <tr key={s}>
                <td style={{ fontSize:12 }}>{s}</td>
                {fyMonths.map((mi,i)=>{
                  const a=actuals[i], b=getBl(s,mi);
                  const isOver = good ? a < b : a > b;
                  return <td key={mi} style={{ fontSize:12, color: a===0?T.sub : isOver?T.danger:T.text }}>{a===0?"—":fmt(a)}</td>;
                })}
                <td>
                  <div style={{ fontWeight:600 }}>{fmt(total)}</div>
                  <div style={{ fontSize:10, color:good?(v>=0?T.success:T.danger):(v<=0?T.success:T.danger) }}>{fmtS(v)} bl</div>
                </td>
              </tr>
            );
          })}
          <tr className="total-row">
            <td>Total</td>
            {fyMonths.map(mi=><td key={mi} style={{ fontSize:12 }}>{fmt(streams.reduce((a,s)=>a+getVal(s,mi),0))}</td>)}
            <td>{fmt(fyMonths.reduce((a,mi)=>a+streams.reduce((b,s)=>b+getVal(s,mi),0),0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── WEEKLY ENTRY TABLE ───────────────────────────────────────────────────────
function WeeklyEntryTable({ streams, weeklyData, baselineData, forecastData, monthIdx, onUpdateWeekly, onUpdateForecast, type, notes, onUpdateNote }) {
  const { MONTHS } = useCalendar();
  const { fmt, fmtS } = useMoney();
  // Opens on the month's summary. Week one is where you enter, but the whole
  // month is what you come back to look at, and starting a week in hid the
  // baseline and forecast columns behind a tab nobody had reason to leave.
  const [activeWeek, setActiveWeek] = useState(0);
  const [expandedNote, setExpandedNote] = useState(null); // stream key for expanded note row
  const color = type === "savings" ? T.success : T.danger;
  const showNotes = type === "expenditure";
  const rows = streams.map(s => ({
    s, baseline:monthlyVal(baselineData,s,monthIdx),
    forecast:monthlyVal(forecastData,s,monthIdx), actual:weeklyTotal(weeklyData,s,monthIdx)
  }));
  const totBl=rows.reduce((a,r)=>a+r.baseline,0), totFc=rows.reduce((a,r)=>a+r.forecast,0), totAct=rows.reduce((a,r)=>a+r.actual,0);

  const getNote = (s, w) => notes?.[s]?.[monthIdx]?.[w] || "";
  const hasNote = (s, w) => !!getNote(s, w);

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        <button className={`wtab${activeWeek===0?" active":""}`} onClick={()=>setActiveWeek(0)}>Monthly Summary</button>
        {WEEKS.map(w=><button key={w} className={`wtab${activeWeek===w?" active":""}`} onClick={()=>setActiveWeek(w)}>Week {w}</button>)}
      </div>

      {activeWeek === 0 ? (
        <div style={{ overflowX:"auto" }}>
          <table>
            <thead><tr>
              <th style={{ width:180 }}>Category</th>
              <th style={{ color:T.sub }}>Baseline</th><th style={{ color:T.blue }}>Forecast</th>
              <th style={{ color }}>Actual (Σ)</th><th style={{ color:T.sub }}>vs Baseline</th><th style={{ color:T.sub }}>vs Forecast</th>
              {showNotes && <th style={{ color:T.sub, width:60 }}>Notes</th>}
            </tr></thead>
            <tbody>
              {rows.map(({ s, baseline, forecast, actual }) => {
                const vb=actual-baseline, vf=actual-forecast;
                const good = type==="savings";
                const noteCount = showNotes ? WEEKS.filter(w=>hasNote(s,w)).length : 0;
                return (
                  <tr key={s}>
                    <td>{s}</td>
                    <td style={{ color:T.sub }}>{fmt(baseline)}</td>
                    <td style={{ color:T.blue }}>
                      <NumInput value={forecast} className="inp inp-num" cellId={`fc.${type}.${s}.${monthIdx}`} onChange={v => onUpdateForecast(s, monthIdx, v)} />
                    </td>
                    <td style={{ color }}>
                      {WEEKS.some(w=>weeklyData?.[s]?.[monthIdx]?.[w]>0)
                        ? <span style={{ fontWeight:600 }}>{fmt(actual)}</span>
                        : <NumInput value={actual} cellId={`wk.${type}.${s}.${monthIdx}.1`} onChange={v => onUpdateWeekly(s,monthIdx,1,v)} />}
                    </td>
                    <td><span className={good?(vb>=0?"vpos":"vneg"):(vb<=0?"vpos":"vneg")} style={{ fontSize:12 }}>{fmtS(vb)}</span></td>
                    <td><span className={good?(vf>=0?"vpos":"vneg"):(vf<=0?"vpos":"vneg")} style={{ fontSize:12 }}>{fmtS(vf)}</span></td>
                    {showNotes && (
                      <td style={{ textAlign:"center" }}>
                        {noteCount > 0
                          ? <span style={{ fontSize:11, color:T.accent, cursor:"default" }} title={WEEKS.filter(w=>hasNote(s,w)).map(w=>`Wk${w}: ${getNote(s,w)}`).join("\n")}>
                              📝 {noteCount}
                            </span>
                          : <span style={{ fontSize:11, color:T.sub }}>—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total</td><td>{fmt(totBl)}</td><td>{fmt(totFc)}</td><td>{fmt(totAct)}</td>
                <td><span className={type==="savings"?(totAct-totBl>=0?"vpos":"vneg"):(totAct-totBl<=0?"vpos":"vneg")} style={{ fontSize:12 }}>{fmtS(totAct-totBl)}</span></td>
                <td><span className={type==="savings"?(totAct-totFc>=0?"vpos":"vneg"):(totAct-totFc<=0?"vpos":"vneg")} style={{ fontSize:12 }}>{fmtS(totAct-totFc)}</span></td>
                {showNotes && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table>
            <thead><tr>
              <th style={{ width:160 }}>Category</th>
              <th style={{ color:T.sub }}>Baseline</th>
              <th style={{ color }}>Week {activeWeek}</th>
              <th style={{ color:T.sub }}>Running Σ</th>
              <th style={{ color:T.sub }}>Remaining</th>
              {showNotes && <th style={{ color:T.purple, textAlign:"left", minWidth:200 }}>📝 Note</th>}
            </tr></thead>
            <tbody>
              {streams.map(s => {
                const bl=monthlyVal(baselineData,s,monthIdx), fc=monthlyVal(forecastData,s,monthIdx);
                const tw=weeklyData?.[s]?.[monthIdx]?.[activeWeek]||0, run=weeklyTotal(weeklyData,s,monthIdx);
                const rem=fc-run;
                const note = showNotes ? getNote(s, activeWeek) : "";
                const isExpanded = expandedNote === `${s}-${activeWeek}`;
                return (
                  <tr key={s}>
                    <td>{s}</td>
                    <td style={{ color:T.sub }}>{fmt(bl)}</td>
                    <td><NumInput value={tw} cellId={`wk.${type}.${s}.${monthIdx}.${activeWeek}`} onChange={v=>onUpdateWeekly(s,monthIdx,activeWeek,v)} /></td>
                    <td style={{ color, fontWeight:600 }}>{fmt(run)}</td>
                    <td><span style={{ fontSize:12, color:rem>=0?T.sub:T.danger }}>{rem!==0?fmtS(-rem):"—"}</span></td>
                    {showNotes && (
                      <td style={{ textAlign:"left", padding:"6px 10px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          {isExpanded ? (
                            <textarea
                              autoFocus
                              value={note}
                              onChange={e => onUpdateNote(s, monthIdx, activeWeek, e.target.value)}
                              onBlur={() => setExpandedNote(null)}
                              placeholder="Add a note for this item…"
                              style={{ background:T.inputBg, border:`1px solid ${T.accent}`, color:T.text,
                                borderRadius:6, padding:"5px 8px", fontSize:12, fontFamily:"'DM Sans'",
                                resize:"vertical", minHeight:56, width:"100%", outline:"none" }}
                            />
                          ) : (
                            <button
                              onClick={() => setExpandedNote(`${s}-${activeWeek}`)}
                              style={{ background:"transparent", border:`1px solid ${note ? T.purple : T.border}`,
                                borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12,
                                color: note ? T.text : T.sub, fontFamily:"'DM Sans'",
                                maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                                textAlign:"left", transition:"border-color .15s" }}>
                              {note || <span style={{ color:T.sub }}>+ Add note</span>}
                            </button>
                          )}
                          {note && !isExpanded && (
                            <button className="btn-icon" style={{ color:T.sub, fontSize:12 }}
                              onClick={() => onUpdateNote(s, monthIdx, activeWeek, "")} title="Clear note">✕</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total — Wk {activeWeek}</td>
                <td>{fmt(totBl)}</td>
                <td>{fmt(streams.reduce((a,s)=>a+(weeklyData?.[s]?.[monthIdx]?.[activeWeek]||0),0))}</td>
                <td>{fmt(totAct)}</td><td></td>
                {showNotes && <td></td>}
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop:10, padding:"9px 14px", background:T.inputBg, borderRadius:8, fontSize:12, color:T.sub }}>
            💡 Week {activeWeek} · {MONTHS[monthIdx]?.label}. Click any note field to edit — notes are saved with the rest of your data.{" "}
            Tip: enter a formula like <span style={{ color:T.accent, fontFamily:"monospace" }}>12.50+8+6.99</span> to sum multiple items.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SANKEY DIAGRAM ───────────────────────────────────────────────────────────
function SankeyDiagram({ incomeStreams, savingsStreams, expStreams, savingsTypes, incomeActual, savingsWeekly, expWeekly, monthIdx, fyMonths, viewMode }) {
  const { fmt } = useMoney();
  const [hovered, setHovered] = useState(null);

  const getInc = s => viewMode === "fy"
    ? fyMonths.reduce((a,mi) => a + (incomeActual?.[s]?.[mi]||0), 0)
    : (incomeActual?.[s]?.[monthIdx]||0);
  const getSav = s => viewMode === "fy"
    ? fyMonths.reduce((a,mi) => a + weeklyTotal(savingsWeekly, s, mi), 0)
    : weeklyTotal(savingsWeekly, s, monthIdx);
  const getExp = s => viewMode === "fy"
    ? fyMonths.reduce((a,mi) => a + weeklyTotal(expWeekly, s, mi), 0)
    : weeklyTotal(expWeekly, s, monthIdx);

  const totalIncome = incomeStreams.reduce((a,s) => a + getInc(s), 0);
  // Individual breakdown shown as sub-labels under the merged source node
  const incomeBreakdown = incomeStreams.map(s => ({ name:s, value:getInc(s) })).filter(n => n.value > 0);

  const EXP_COLS = ["#f06464","#f5a623","#e07070","#c4896a","#f09d6a","#d4a0a0","#f0b864","#c4706a","#e89464","#d46464","#f5c842","#e8c070"];
  const dstRaw = [
    ...savingsStreams.map(s => ({ name:s, value:getSav(s), color: isInvestment(s, savingsTypes) ? T.blue : T.success })),
    ...expStreams.map((s,i) => ({ name:s, value:getExp(s), color:EXP_COLS[i % EXP_COLS.length] })),
  ];
  const allocated = dstRaw.reduce((a,n) => a + n.value, 0);
  const unalloc = Math.max(0, totalIncome - allocated);
  const dstNodes = dstRaw.filter(n => n.value > 0);
  if (unalloc > 0.5) dstNodes.push({ name:"Unallocated", value:unalloc, color:T.sub });

  if (totalIncome < 1) return (
    <div style={{ textAlign:"center", padding:"28px 0", color:T.sub, fontSize:13 }}>
      No income data for this period. Add income on the Income page to see the flow diagram.
    </div>
  );

  // SVG layout constants
  const W = 620, PAD_L = 160, PAD_R = 168, nodeW = 13, gapY = 7;
  const srcX = PAD_L, dstX = W - PAD_R;
  const H = Math.max(320, dstNodes.length * 36 + 20);

  // Single merged source node spans the full height
  const srcH = H;

  // Geometry is scaled against whichever is larger, income or what has been
  // allocated out of it. Dividing by income alone meant that in an overspent
  // month the flows summed past 100% and spilled out of the source bar —
  // which is exactly the month worth looking at. Percentages stay relative to
  // income, so "114% of income" still reads as the true figure.
  const overspend = Math.max(0, allocated - totalIncome);
  const scale = Math.max(totalIncome, allocated);

  // Lay the destination nodes out proportionally, but give even the smallest a
  // visible bar, then normalise so the minimum-height floor cannot push the
  // stack past the height it has to fit in.
  const fitHeights = (values, total, min) => {
    let hs = values.map(v => Math.max(min, (v / scale) * total));
    const sum = hs.reduce((a, h) => a + h, 0);
    return sum > total ? hs.map(h => h * (total / sum)) : hs;
  };

  const avail = H - (dstNodes.length - 1) * gapY;
  const heights = fitHeights(dstNodes.map(n => n.value), avail, 10);
  let dy = 0;
  const dstLayout = dstNodes.map((n, i) => {
    const node = { ...n, x:dstX, y:dy, h:heights[i] };
    dy += heights[i] + gapY;
    return node;
  });

  // One flow per destination — all originate from the single source bar, which
  // they tile without gaps, so their heights are scaled against its full height.
  const flowHeights = fitHeights(dstNodes.map(n => n.value), srcH, 1);
  let srcOff = 0;
  const flows = dstLayout.map((dst, i) => {
    const flow = { dst, y1:srcOff, y2:dst.y, fh:flowHeights[i], dh:dst.h };
    srcOff += flowHeights[i];
    return flow;
  });

  // A ribbon is thicker where it leaves than where it lands: the source bar is
  // solid over its full height, while the destination stack loses room to a gap
  // between every node and to the minimum height small categories are given.
  // Drawing both ends at the source thickness made every ribbon overshoot the
  // bar it flows into, so each now tapers to its destination's exact height.
  const bezier = (y1, y2, fh, dh) => {
    const mx = (srcX + dstX) / 2;
    return `M${srcX+nodeW} ${y1} C${mx} ${y1},${mx} ${y2},${dstX} ${y2} L${dstX} ${y2+dh} C${mx} ${y2+dh},${mx} ${y1+fh},${srcX+nodeW} ${y1+fh} Z`;
  };
  const trunc = (s, n=22) => s.length > n ? s.slice(0, n-1)+"\u2026" : s;

  const hf = hovered !== null ? flows[hovered] : null;

  // Vertical centre of the source label block
  const labelLines = 2 + incomeBreakdown.length; // "Total Income" + amount + breakdown items
  const labelBlockH = labelLines * 14;
  const labelY = H / 2 - labelBlockH / 2;

  return (
    <div>
      <svg width="100%" viewBox={`0 -28 ${W} ${H+28}`} style={{ display:"block", overflow:"visible" }}>
        {/* Flows */}
        {flows.map((f, i) => (
          <path key={i} d={bezier(f.y1, f.y2, f.fh, f.dh)}
            fill={f.dst.color} fillOpacity={hovered === i ? 0.55 : 0.18}
            style={{ cursor:"default", transition:"fill-opacity .13s" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}

        {/* Single source node */}
        <rect x={srcX} y={0} width={nodeW} height={srcH} fill={T.accent} rx={3}/>

        {/* Source labels — centred vertically */}
        <text x={srcX - 10} y={labelY + 12}
          textAnchor="end" fontSize={13} fontWeight="700" fill={T.accent} fontFamily="'DM Sans'">
          Total Income
        </text>
        <text x={srcX - 10} y={labelY + 27}
          textAnchor="end" fontSize={11} fill={T.sub} fontFamily="'DM Sans'">
          {fmt(totalIncome)}
        </text>
        {incomeBreakdown.map((s, i) => (
          <text key={s.name} x={srcX - 10} y={labelY + 43 + i * 14}
            textAnchor="end" fontSize={10} fill={T.sub} fontFamily="'DM Sans'" opacity={0.75}>
            {trunc(s.name, 16)}: {fmt(s.value)}
          </text>
        ))}

        {/* Dest nodes + labels. A short node puts its name and amount on one
            line rather than dropping the amount, which used to make small
            categories read as though they were zero. */}
        {dstLayout.map(n => {
          const pct = Math.round(n.value / totalIncome * 100);
          const roomy = n.h > 22;
          return (
            <g key={n.name}>
              <rect x={n.x} y={n.y} width={nodeW} height={n.h} fill={n.color} rx={2}/>
              {roomy ? (
                <>
                  <text x={n.x + nodeW + 10} y={n.y + n.h/2 - 2}
                    textAnchor="start" fontSize={11} fontWeight="600" fill={T.text} fontFamily="'DM Sans'">
                    {trunc(n.name, 20)}
                  </text>
                  <text x={n.x + nodeW + 10} y={n.y + n.h/2 + 11}
                    textAnchor="start" fontSize={10} fill={T.sub} fontFamily="'DM Sans'">
                    {fmt(n.value)} · {pct}%
                  </text>
                </>
              ) : (
                <text x={n.x + nodeW + 10} y={n.y + n.h/2 + 3.5}
                  textAnchor="start" fontSize={10} fill={T.text} fontFamily="'DM Sans'">
                  <tspan fontWeight="600">{trunc(n.name, 16)}</tspan>
                  <tspan fill={T.sub}> {fmt(n.value)} · {pct}%</tspan>
                </text>
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hf && (
          <text x={W/2} y={-10} textAnchor="middle" fontSize={11} fill={T.accent} fontFamily="'DM Sans'" fontWeight="600">
            {hf.dst.name}: {fmt(hf.dst.value)} — {Math.round(hf.dst.value / totalIncome * 100)}% of income
          </text>
        )}
      </svg>

      {/* Overspend notice — the diagram alone cannot say that outgoings
          exceeded income, only that the bars are full. */}
      {overspend > 0.5 && (
        <div style={{ marginTop:10, padding:"9px 14px", background:"rgba(240,100,100,.08)",
          border:`1px solid rgba(240,100,100,.3)`, borderRadius:8, fontSize:12, color:T.sub }}>
          <strong style={{ color:T.danger }}>Spent and saved {fmt(overspend)} more than came in.</strong>{" "}
          Outgoings are {Math.round(allocated / totalIncome * 100)}% of income this period, so the flows
          below are scaled against the larger figure.
        </div>
      )}

      {/* Legend */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:10, paddingLeft:PAD_L }}>
        {[{label:"Income",color:T.accent},{label:"Savings",color:T.success},{label:"Investments",color:T.blue},{label:"Expenditure",color:"#f06464"},
          ...(overspend > 0.5 ? [] : [{label:"Unallocated",color:T.sub}])]
          .map(({label,color}) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:T.sub }}>
              <div style={{ width:9, height:9, borderRadius:2, background:color }}/>{label}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── PAGES ───────────────────────────────────────────────────────────────────

function Dashboard({ monthIdx, viewEpoch, fyStart, totalMonths, incomeStreams, savingsStreams, expStreams,
  baselineIncome, baselineSavings, baselineExp, incomeActual, savingsForecast, savingsWeekly, expForecast, expWeekly,
  onFYSettings, savingsTypes, netWorth, netWorthAssets, moneyOwed, onOpenPage }) {
  const { MONTHS, getFYYear, getFYMonths } = useCalendar();
  const { fmt, fmtS } = useMoney();
  const sankeyRef = useRef(null);

  const [selFY, setSelFY] = useSyncedState(getFYYear(monthIdx, fyStart), viewEpoch);
  const [viewMode, setViewMode] = useState("month");

  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  // Current month stats
  const actInc = allMonthly(incomeStreams, incomeActual, monthIdx);
  const basInc = allMonthly(incomeStreams, baselineIncome, monthIdx);
  const actSav = allStreamsWeekly(savingsStreams, savingsWeekly, monthIdx);
  const basSav = allMonthly(savingsStreams, baselineSavings, monthIdx);
  const fcSav  = allMonthly(savingsStreams, savingsForecast, monthIdx);
  const actExp = allStreamsWeekly(expStreams, expWeekly, monthIdx);
  const basExp = allMonthly(expStreams, baselineExp, monthIdx);
  const fcExp  = allMonthly(expStreams, expForecast, monthIdx);

  // FY totals
  const fyActSav = fyMonths.reduce((a,mi)=>a+allStreamsWeekly(savingsStreams,savingsWeekly,mi),0);
  const fyBasSav = fyMonths.reduce((a,mi)=>a+allMonthly(savingsStreams,baselineSavings,mi),0);
  const fyFcSav  = fyMonths.reduce((a,mi)=>a+allMonthly(savingsStreams,savingsForecast,mi),0);
  const fyActExp = fyMonths.reduce((a,mi)=>a+allStreamsWeekly(expStreams,expWeekly,mi),0);
  const fyBasExp = fyMonths.reduce((a,mi)=>a+allMonthly(expStreams,baselineExp,mi),0);
  const fyFcExp  = fyMonths.reduce((a,mi)=>a+allMonthly(expStreams,expForecast,mi),0);

  // ─── Year-to-date gauges ───────────────────────────────────────────────────
  const investStreams = savingsStreams.filter(s => isInvestment(s, savingsTypes));
  const pureStreams   = savingsStreams.filter(s => !isInvestment(s, savingsTypes));

  // Which months of the selected financial year have actually happened.
  // "index <= monthIdx" alone was wrong whenever the FY tab and the month
  // cursor disagreed: a future year came out as 0% of a full target, and a
  // past year counted only the months below today's index.
  const currentFY = getFYYear(monthIdx, fyStart);
  const fyState = selFY === currentFY ? "current" : selFY < currentFY ? "past" : "future";
  const ytd = fyElapsed(fyMonths, monthIdx, selFY, currentFY);

  const savYTD = ytd.reduce((a,mi)=>a+allStreamsWeekly(pureStreams,savingsWeekly,mi),0);
  const invYTD = ytd.reduce((a,mi)=>a+allStreamsWeekly(investStreams,savingsWeekly,mi),0);
  // Annual targets, and the share of them due by now. Measuring against the
  // full year all year meant someone exactly on plan still read as behind.
  const savTgt = fyMonths.reduce((a,mi)=>a+allMonthly(pureStreams,baselineSavings,mi),0);
  const invTgt = fyMonths.reduce((a,mi)=>a+allMonthly(investStreams,baselineSavings,mi),0);
  const savDue = ytd.reduce((a,mi)=>a+allMonthly(pureStreams,baselineSavings,mi),0);
  const invDue = ytd.reduce((a,mi)=>a+allMonthly(investStreams,baselineSavings,mi),0);
  const expDue = ytd.reduce((a,mi)=>a+allMonthly(expStreams,baselineExp,mi),0);
  // A year clipped by the edge of the timeline rather than a whole one.
  const partialFY = fyMonths.length > 0 && fyMonths.length < 12;
  const frac   = fyMonths.length > 0 ? ytd.length / fyMonths.length : 0;

  // Pace follows the Monthly/FY toggle above it. Reading a month's spending
  // against a year's target — or the reverse — is exactly the mistake a bar
  // makes easy, so both halves of the page always describe the same period.
  // Within a single month there is no pro-rata mark: the app records which
  // week money moved, not which day, so there is no honest "expected by now".
  const fyPace = viewMode === "fy";
  const paceOf = (list, weekly, baseline, ytdActual, ytdTarget, ytdMark) => fyPace
    ? { actual: ytdActual, target: ytdTarget, mark: ytdMark }
    : { actual: allStreamsWeekly(list, weekly, monthIdx),
        target: allMonthly(list, baseline, monthIdx), mark: null };
  const savPace = paceOf(pureStreams,   savingsWeekly, baselineSavings, savYTD,   savTgt,   savDue);
  const invPace = paceOf(investStreams, savingsWeekly, baselineSavings, invYTD,   invTgt,   invDue);
  const expPace = paceOf(expStreams,    expWeekly,     baselineExp,     fyActExp, fyBasExp, expDue);

  // Categories are unlimited, so the caption cannot be a full list — past a
  // few names it would set the height of this section rather than the bars do.
  const catSub = (list, empty) => list.length === 0 ? empty
    : list.length <= 3 ? list.join(" · ")
    : `${list.slice(0, 2).join(" · ")} + ${list.length - 2} more`;
  const netRemaining = actInc - actSav - actExp;

  // Position figures for the second row of cards.
  const netWorthTotal = netWorthTotalAt(netWorth, netWorthAssets, monthIdx);
  const netWorthPrev  = monthIdx > 0 ? netWorthTotalAt(netWorth, netWorthAssets, monthIdx - 1) : 0;
  const netWorthChange = netWorthTotal === 0 && netWorthPrev === 0 ? null : netWorthTotal - netWorthPrev;
  const owedOutstanding = moneyOwed.reduce((a,r) => a + ((r.amount||0) - (r.paid||0)), 0);
  const owedCount = moneyOwed.length;
  const owedToday = new Date().toISOString().slice(0,10);
  const owedOverdue = moneyOwed.filter(r => r.dueBy && r.dueBy < owedToday && (r.amount||0) - (r.paid||0) > 0.005).length;

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Dashboard</div>
      </div>

      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={onFYSettings} />

      {/* Where you stand. A position rather than a flow, kept separate so the
          two are not read as the same kind of figure, and kept first so the
          slowest-moving number is never the one buried at the bottom. */}
      <div className="sl" style={{ marginBottom:9 }}>Where you stand</div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:22 }}>
        <StatCard icon="◆" label="Net Worth" value={fmt(netWorthTotal)}
          sub={netWorthChange === null ? "Nothing recorded yet"
            : `${fmtS(netWorthChange)} on ${MONTHS[monthIdx-1]?.label}`}
          onOpen={()=>onOpenPage("networth")} openLabel="Net worth — open the Net Worth page"/>
        <StatCard icon="◷" label="Owed to You" value={fmt(owedOutstanding)}
          sub={owedOverdue > 0 ? `${owedOverdue} past its due date` : `${owedCount} ${owedCount === 1 ? "loan" : "loans"} tracked`}
          valueTone={owedOverdue > 0 ? T.danger : undefined}
          onOpen={()=>onOpenPage("moneyowed")} openLabel="Owed to you — open the Money Owed page"/>
      </div>

      {/* Money that moved. Every card opens the page behind it. */}
      <div className="sl" style={{ marginBottom:9 }}>{viewMode==="fy" ? fyLabel(selFY, fyStart) : MONTHS[monthIdx]?.label}</div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:22 }}>
        <StatCard icon="💰" label={viewMode==="fy"?(fyStart===0?"Year Income":"FY Income"):"Income"}
          value={fmt(viewMode==="fy"?fyMonths.reduce((a,mi)=>a+allMonthly(incomeStreams,incomeActual,mi),0):actInc)}
          delta={viewMode==="fy"?undefined:actInc-basInc}
          onOpen={()=>onOpenPage("income")} openLabel="Income — open the Income page"/>
        <StatCard icon="🏦" label={viewMode==="fy"?(fyStart===0?"Year Saved":"FY Saved"):"Total Saved"}
          value={fmt(viewMode==="fy"?fyActSav:actSav)}
          sub={`Baseline: ${fmt(viewMode==="fy"?fyBasSav:basSav)} · Forecast: ${fmt(viewMode==="fy"?fyFcSav:fcSav)}`}
          delta={viewMode==="fy"?undefined:actSav-fcSav} deltaLabel="vs forecast"
          onOpen={()=>onOpenPage("savings")} openLabel="Total saved — open the Savings page"/>
        <StatCard icon="🧾" label={viewMode==="fy"?(fyStart===0?"Year Spent":"FY Spent"):"Total Spent"}
          value={fmt(viewMode==="fy"?fyActExp:actExp)}
          sub={`Baseline: ${fmt(viewMode==="fy"?fyBasExp:basExp)} · Forecast: ${fmt(viewMode==="fy"?fyFcExp:fcExp)}`}
          delta={viewMode==="fy"?undefined:actExp-fcExp} deltaLabel="vs forecast" posGood={false}
          onOpen={()=>onOpenPage("expenditure")} openLabel="Total spent — open the Expenditure page"/>
        {/* Net Remaining is derived and has no page of its own; it scrolls to the
            flow diagram, which is the explanation of where the money went. */}
        <StatCard icon="✅" label="Net Remaining" value={fmt(netRemaining)} sub="After savings & spend"
          valueTone={netRemaining < 0 ? T.danger : undefined}
          onOpen={()=>sankeyRef.current?.scrollIntoView({ behavior:"smooth", block:"center" })}
          openLabel="Net remaining — see where the money went"/>
      </div>

      {/* Pace. Three bars, whatever the category count — per-category detail
          lives on the tab behind each one. */}
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:15, fontWeight:600, marginBottom:4 }}>
          {!fyPace ? "This Month's Pace"
            : fyState === "current" ? "Year-to-Date Pace"
            : partialFY ? "Part of a Year"
            : fyState === "past" ? "Full Year Result" : "Planned Year"}
        </div>
        <div style={{ fontSize:11, color:T.sub, marginBottom:18 }}>
          {!fyPace && <>{MONTHS[monthIdx]?.label} against its baseline · switch to {fyStart === 0 ? "Year" : "FY"} for the year's pace</>}
          {fyPace && fyState === "current" && <>{Math.round(frac*100)}% through {fyLabel(selFY, fyStart)} · the tick on each bar is where you should be by now</>}
          {fyPace && partialFY && <>Only {fyMonths.length} of {fyLabel(selFY, fyStart)}&rsquo;s 12 months sit inside your timeline · extend your timeline in Year settings to include the rest</>}
          {fyPace && !partialFY && fyState === "past"    && <>{fyLabel(selFY, fyStart)} is complete · measured against the full year's baseline</>}
          {fyPace && !partialFY && fyState === "future"  && <>{fyLabel(selFY, fyStart)} has not started · showing the plan, with nothing recorded yet</>}
        </div>
        <PaceBar label="Savings" icon="🏦" color={T.success}
          actual={savPace.actual} target={savPace.target} mark={savPace.mark}
          sub={catSub(pureStreams, "No savings pots — mark one in Categories")}/>
        <PaceBar label="Investments" icon="📈" color={T.blue}
          actual={invPace.actual} target={invPace.target} mark={invPace.mark}
          sub={catSub(investStreams, "No investments — mark one in Categories")}/>
        <PaceBar label="Spending" icon="🧾" color={T.warning} lowerIsBetter
          actual={expPace.actual} target={expPace.target} mark={expPace.mark}
          sub={catSub(expStreams, "No spending categories yet")}/>
      </div>      {/* Income Flow Sankey — last, being the most detailed thing here and the
          only one you go looking for rather than glance at. The Net Remaining
          card scrolls down to it. */}
      <div ref={sankeyRef} className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:15, fontWeight:600 }}>Income Distribution</div>
          <div style={{ fontSize:11, color:T.sub }}>{viewMode==="fy" ? fyLabel(selFY, fyStart) : MONTHS[monthIdx]?.label} · hover a flow to inspect</div>
        </div>
        <div style={{ fontSize:12, color:T.sub, marginBottom:16 }}>Where your income is being distributed across savings, investments and expenditure categories.</div>
        <SankeyDiagram
          incomeStreams={incomeStreams} savingsStreams={savingsStreams} expStreams={expStreams} savingsTypes={savingsTypes}
          incomeActual={incomeActual} savingsWeekly={savingsWeekly} expWeekly={expWeekly}
          monthIdx={monthIdx} fyMonths={fyMonths} viewMode={viewMode}/>
      </div>

    </div>
  );
}

function IncomePage({ monthIdx, viewEpoch, fyStart, totalMonths, streams, setStreams, baselineData, actualData, onUpdate, onEditBaseline, incomeNotes, onUpdateIncomeNote, onFYSettings }) {
  const { MONTHS, getFYYear, getFYMonths } = useCalendar();
  const { fmt, fmtS } = useMoney();
  const [catModal, setCatModal] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [selFY, setSelFY] = useSyncedState(getFYYear(monthIdx, fyStart), viewEpoch);
  const [expandedNote, setExpandedNote] = useState(null);
  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  const getNote = (s, mi) => incomeNotes?.[s]?.[mi] || "";

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Income</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEditBaseline("Income", streams, baselineData)}>✎ Edit Baselines</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCatModal(true)}>⊞ Categories</button>
        </div>
      </div>
      {catModal && <CategoryModal title="Income" streams={streams} onSave={(s,o)=>{setStreams(s,o);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}

      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={onFYSettings}/>

      {viewMode === "fy" ? (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{fyLabel(selFY,fyStart)} — All Months (Actual Income)</div>
            <FYSummaryTable fyStart={fyStart} streams={streams} fyMonths={fyMonths} baselineData={baselineData}
              forecastData={baselineData} incomeActual={actualData} type="income"/>
          </div>
          {/* Extra Income notes in FY view */}
          {streams.some(s => fyMonths.some(mi => getNote(s, mi))) && (
            <div className="card" style={{ padding:20 }}>
              <div className="sl" style={{ marginBottom:14 }}>Income Notes &amp; Tags</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {streams.map(s =>
                  fyMonths.filter(mi => getNote(s, mi)).map(mi => {
                    const note = getNote(s, mi);
                    return (
                      <div key={`${s}-${mi}`} style={{ display:"flex", alignItems:"baseline", gap:10, padding:"8px 12px", background:T.inputBg, borderRadius:8 }}>
                        <span style={{ fontSize:12, color:T.sub, minWidth:72 }}>{MONTHS[mi]?.short}</span>
                        <span style={{ fontSize:13, color:T.success, fontWeight:600, minWidth:68 }}>{fmt(monthlyVal(actualData,s,mi))}</span>
                        <span style={{ fontSize:12, color:T.sub, flex:1 }}>{note || <em style={{ color:T.sub }}>No note</em>}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding:20 }}>
          <div className="sl" style={{ marginBottom:14 }}>{MONTHS[monthIdx]?.label} — Actual Income</div>
          <table>
            <thead><tr>
              <th style={{ width:200 }}>Stream</th>
              <th style={{ color:T.sub }}>Baseline</th>
              <th style={{ color:T.blue }}>Actual</th>
              <th style={{ color:T.sub }}>Variance</th>
              <th style={{ color:T.purple, textAlign:"left", minWidth:200 }}>💬 Tag / Note</th>
            </tr></thead>
            <tbody>
              {streams.map(s => {
                const b=monthlyVal(baselineData,s,monthIdx), a=monthlyVal(actualData,s,monthIdx), v=a-b;
                const note = getNote(s, monthIdx);
                const isExpanded = expandedNote === s;
                return (
                  <tr key={s}>
                    <td>{s}</td>
                    <td style={{ color:T.sub }}>{fmt(b)}</td>
                    <td><NumInput value={a} cellId={`inc.${s}.${monthIdx}`} onChange={v=>onUpdate(s,monthIdx,v)}/></td>
                    <td><span className={v>=0?"vpos":"vneg"} style={{ fontSize:12 }}>{fmtS(v)}</span></td>
                    <td style={{ textAlign:"left", padding:"6px 10px" }}>
                      {isExpanded ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          <input
                            autoFocus
                            value={note}
                            onChange={e => onUpdateIncomeNote(s, monthIdx, e.target.value)}
                            onBlur={() => setExpandedNote(null)}
                            onKeyDown={e => e.key === "Enter" && setExpandedNote(null)}
                            placeholder="Add tag or note (e.g. Freelance, Bonus, HMRC…)"
                            style={{ background:T.inputBg, border:`1px solid ${T.accent}`, color:T.text,
                              borderRadius:6, padding:"6px 10px", fontSize:12, fontFamily:"'DM Sans'",
                              outline:"none", width:"100%" }}
                          />
                          {/* Tag suggestions */}
                          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                            {["Freelance","Bonus","HMRC","Refund","Gift","Side hustle","Other"].map(tag => (
                              <button key={tag} onClick={() => { onUpdateIncomeNote(s, monthIdx, note ? `${note}, ${tag}` : tag); }}
                                style={{ padding:"2px 8px", borderRadius:4, fontSize:11, cursor:"pointer",
                                  background:"rgba(212,168,83,.1)", border:`1px solid rgba(212,168,83,.3)`,
                                  color:T.accent, fontFamily:"'DM Sans'" }}>
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <button
                            onClick={() => setExpandedNote(s)}
                            style={{ background:"transparent", border:`1px solid ${note ? T.purple : T.border}`,
                              borderRadius:6, padding:"4px 10px", cursor:"pointer", fontSize:12,
                              color: note ? T.text : T.sub, fontFamily:"'DM Sans'",
                              maxWidth:240, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                              textAlign:"left", transition:"border-color .15s" }}>
                            {note || <span style={{ color:T.sub }}>+ Add tag</span>}
                          </button>
                          {note && (
                            <button className="btn-icon" style={{ color:T.sub, fontSize:12 }}
                              onClick={() => onUpdateIncomeNote(s, monthIdx, "")} title="Clear">✕</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>Total</td>
                <td>{fmt(allMonthly(streams,baselineData,monthIdx))}</td>
                <td>{fmt(allMonthly(streams,actualData,monthIdx))}</td>
                <td><span className={allMonthly(streams,actualData,monthIdx)-allMonthly(streams,baselineData,monthIdx)>=0?"vpos":"vneg"} style={{ fontSize:12 }}>
                  {fmtS(allMonthly(streams,actualData,monthIdx)-allMonthly(streams,baselineData,monthIdx))}
                </span></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop:16 }}>
        <ComboChart title="Income — Monthly vs Cumulative" streams={streams} monthlyData={actualData}
          baselineData={baselineData} forecastData={baselineData} fyMonths={fyMonths}
          color={T.accent} type="income" showForecast={false}/>
      </div>
    </div>
  );
}

function SavingsPage({ monthIdx, viewEpoch, fyStart, totalMonths, streams, setStreams, baselineData, forecastData, weeklyData,
  onUpdateWeekly, onUpdateForecast, onEditBaseline, onFYSettings, savingsTypes }) {
  const { MONTHS, getFYYear, getFYMonths } = useCalendar();
  const { fmt, fmtAxis } = useMoney();
  const [catModal, setCatModal] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [selFY, setSelFY] = useSyncedState(getFYYear(monthIdx, fyStart), viewEpoch);
  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  // Every savings category together by default, pots and investments alike —
  // the split between the two is the dashboard's job. The funnel narrows it,
  // so a single pot can be read on its own without the rest drowning it out.
  const [dialSel, setDialSel] = useStreamSelection(streams);
  const currentFY = getFYYear(monthIdx, fyStart);
  const ytd       = fyElapsed(fyMonths, monthIdx, selFY, currentFY);
  const ytdActual = ytd.reduce((a,mi)=>a+allStreamsWeekly(dialSel, weeklyData, mi), 0);
  const ytdDue    = ytd.reduce((a,mi)=>a+allMonthly(dialSel, baselineData, mi), 0);
  const annual    = fyMonths.reduce((a,mi)=>a+allMonthly(dialSel, baselineData, mi), 0);
  const started   = ytd.length > 0;
  const dialScope = dialSel.length === 0 ? "nothing selected"
    : dialSel.length === streams.length ? "all savings categories together"
    : dialSel.length <= 2 ? dialSel.join(" · ")
    : `${dialSel.length} of ${streams.length} categories`;

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Savings</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEditBaseline("Savings", streams, baselineData)}>✎ Edit Baselines</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCatModal(true)}>⊞ Categories</button>
        </div>
      </div>
      {catModal && <CategoryModal title="Savings" streams={streams} kinds={savingsTypes} onSave={(s,o,k)=>{setStreams(s,o,k);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}
      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={onFYSettings}/>

      {viewMode === "fy" ? (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Actual Savings</div>
            <FYSummaryTable fyStart={fyStart} streams={streams} fyMonths={fyMonths} baselineData={baselineData}
              forecastData={forecastData} weeklyData={weeklyData} type="savings"/>
          </div>
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontFamily:"'Playfair Display'", fontSize:14, fontWeight:600, marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Breakdown Chart</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fyMonths.map(mi => { const r={name:MONTHS[mi]?.short}; streams.forEach(s=>{r[s]=weeklyTotal(weeklyData,s,mi);}); return r; })} barSize={9}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                <XAxis dataKey="name" tick={{fill:T.sub,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={fmtAxis}/>
                <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}} formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                {streams.map((s,i)=><Bar key={s} dataKey={s} stackId="a" fill={CC[i%CC.length]}/>)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:20, marginBottom:16 }}>
          <div className="sl" style={{ marginBottom:14 }}>{MONTHS[monthIdx]?.label}</div>
          <WeeklyEntryTable streams={streams} weeklyData={weeklyData} baselineData={baselineData}
            forecastData={forecastData} monthIdx={monthIdx} onUpdateWeekly={onUpdateWeekly}
            onUpdateForecast={onUpdateForecast} type="savings"/>
        </div>
      )}

      {/* The dial, kept off the dashboard but at home here. */}
      <div className="card" style={{ padding:20, marginBottom:16, display:"flex",
        flexDirection:"column", alignItems:"center" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          gap:12, width:"100%", marginBottom:10 }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display'", fontSize:15, fontWeight:600, marginBottom:4 }}>
              {started ? (ytd.length === fyMonths.length ? "Full Year Result" : "Year-to-Date Progress") : "Planned Year"}
            </div>
            <div style={{ fontSize:11, color:T.sub }}>
              {fyLabel(selFY, fyStart)} · {dialScope}
            </div>
          </div>
          <StreamFilter streams={streams} sel={dialSel} setSel={setDialSel} color={T.success}
            label="Categories in this dial"/>
        </div>
        {dialSel.length === 0
          ? <div style={{ fontSize:12, color:T.sub, padding:"38px 0" }}>
              Pick at least one category from the filter to see the dial.
            </div>
          : <GaugeDial label="Savings" icon="🏦" actual={ytdActual} target={ytdDue} annual={annual}
              color={T.success} sub={dialSel.length === streams.length
                ? `${streams.length} ${streams.length === 1 ? "category" : "categories"}`
                : `${dialSel.length} of ${streams.length} selected`}/>}
        <div style={{ display:"flex", gap:18, marginTop:6, fontSize:12 }}>
          <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>{started ? "YTD Actual" : "Saved"}</div><div style={{ fontWeight:700,color:T.success }}>{fmt(ytdActual)}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>Expected by now</div><div style={{ fontWeight:700 }}>{fmt(ytdDue)}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>Annual Target</div><div style={{ fontWeight:700 }}>{fmt(annual)}</div></div>
        </div>
      </div>

      {/* The year's trajectory, shown in both views — seeing it while entering
          this month's figures is the point of moving it off the dashboard. */}
      <ComboChart title="Savings — Monthly vs Cumulative" streams={streams} weeklyData={weeklyData}
        forecastData={forecastData} baselineData={baselineData} fyMonths={fyMonths}
        color={T.success} type="savings"/>
    </div>
  );
}

function ExpenditurePage({ monthIdx, viewEpoch, fyStart, totalMonths, streams, setStreams, baselineData, forecastData, weeklyData,
  onUpdateWeekly, onUpdateForecast, onEditBaseline, expNotes, onUpdateExpNote, onFYSettings }) {
  const { MONTHS, getFYYear, getFYMonths } = useCalendar();
  const [catModal, setCatModal] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [selFY, setSelFY] = useSyncedState(getFYYear(monthIdx, fyStart), viewEpoch);
  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Expenditure</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEditBaseline("Expenditure", streams, baselineData)}>✎ Edit Baselines</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCatModal(true)}>⊞ Categories</button>
        </div>
      </div>
      {catModal && <CategoryModal title="Expenditure" streams={streams} onSave={(s,o)=>{setStreams(s,o);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}
      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={onFYSettings}/>

      {viewMode === "fy" ? (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Actual Expenditure</div>
            <FYSummaryTable fyStart={fyStart} streams={streams} fyMonths={fyMonths} baselineData={baselineData}
              forecastData={forecastData} weeklyData={weeklyData} type="expenditure"/>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:20 }}>
          <div className="sl" style={{ marginBottom:14 }}>{MONTHS[monthIdx]?.label}</div>
          <WeeklyEntryTable streams={streams} weeklyData={weeklyData} baselineData={baselineData}
            forecastData={forecastData} monthIdx={monthIdx} onUpdateWeekly={onUpdateWeekly}
            onUpdateForecast={onUpdateForecast} type="expenditure"
            notes={expNotes} onUpdateNote={onUpdateExpNote}/>
        </div>
      )}

      <div style={{ marginTop:16 }}>
        <ComboChart title="Expenditure — Monthly vs Cumulative" streams={streams} weeklyData={weeklyData}
          forecastData={forecastData} baselineData={baselineData} fyMonths={fyMonths}
          color={T.danger} type="expenditure"/>
      </div>
    </div>
  );
}

function NetWorthPage({ netWorth, assets, setAssets, monthIdx, fyStart, totalMonths, onUpdate }) {
  const { fmt, fmtS, fmtAxis, curr } = useMoney();
  const { MONTHS, getFYYear, getFYMonths } = useCalendar();
  const [catModal, setCatModal] = useState(false);
  const fyMonths = getFYMonths(getFYYear(monthIdx, fyStart), fyStart, totalMonths);

  // Figures carry forward from the last month they were recorded, so a month
  // you did not check your balances in shows the position, not a hole.
  const valueAt = (k, mi) => netWorthAt(netWorth, k, mi);
  const total = netWorthTotalAt(netWorth, assets, monthIdx);
  const prevTotal = monthIdx > 0 ? netWorthTotalAt(netWorth, assets, monthIdx - 1) : 0;
  const change = total - prevTotal;
  const pie = assets.map((k,i)=>({name:k,value:valueAt(k,monthIdx),color:CC[i%CC.length]})).filter(d=>d.value>0);
  const trend = fyMonths.map(mi => ({ name: MONTHS[mi]?.short, Total: netWorthTotalAt(netWorth, assets, mi) }));
  const everRecorded = assets.some(k => (netWorth[k] || []).some(v => v));

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Net Worth</div>
        <button className="btn btn-ghost btn-sm" onClick={()=>setCatModal(true)}>⊞ Asset Classes</button>
      </div>
      {catModal && <CategoryModal title="Asset Class" streams={assets}
        onSave={(a,o)=>{setAssets(a,o);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}
      <div style={{ fontSize:12, color:T.sub, marginBottom:16 }}>
        Showing <strong style={{ color:T.accent }}>{MONTHS[monthIdx]?.label}</strong>. Enter a figure whenever you
        check a balance — months in between carry the last one forward.
      </div>
      <div className="networth-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div className="card" style={{ padding:20 }}>
          <div className="sl" style={{ marginBottom:14 }}>{MONTHS[monthIdx]?.label}</div>
          <table>
            <thead><tr><th>Class</th><th style={{ color:T.accent }}>Value ({curr.symbol})</th></tr></thead>
            <tbody>
              {assets.map(k=>(
                <tr key={k}>
                  <td>{k}</td>
                  <td><NumInput value={netWorth[k]?.[monthIdx] || 0} cellId={`nw.${k}.${monthIdx}`} onChange={v=>onUpdate(k,monthIdx,v)}/></td>
                </tr>
              ))}
              <tr className="total-row"><td>Total Net Worth</td><td>{fmt(total)}</td></tr>
            </tbody>
          </table>
          {monthIdx > 0 && prevTotal > 0 && (
            <div style={{ marginTop:12, fontSize:12, color:T.sub }}>
              Change on {MONTHS[monthIdx-1]?.label}:{" "}
              <strong style={{ color: change >= 0 ? T.success : T.danger }}>{fmtS(change)}</strong>
            </div>
          )}
        </div>
        <div className="card" style={{ padding:20 }}>
          <div style={{ textAlign:"center", margin:"18px 0 8px" }}>
            <div style={{ fontFamily:"'Playfair Display'", fontSize:30, fontWeight:600, color:T.accent }}>{fmt(total)}</div>
            <div style={{ fontSize:12, color:T.sub }}>Total Net Worth</div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart><Pie data={pie} cx="50%" cy="50%" outerRadius={72} dataKey="value" stroke="none">
              {pie.map((d,i)=><Cell key={i} fill={d.color}/>)}
            </Pie>
            <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}} formatter={v=>fmt(v)}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
            {pie.map((d,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:T.sub }}>
                <div style={{ width:8,height:8,borderRadius:2,background:d.color }}/>
                {d.name.replace("Cash (","").replace(")","")} ({total?((d.value/total)*100).toFixed(0):0}%)
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend — the point of keeping a history rather than one snapshot */}
      <div className="card" style={{ padding:20, marginTop:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:14, fontWeight:600, marginBottom:4 }}>
          Net Worth Over {fyLabel(getFYYear(monthIdx, fyStart), fyStart)}
        </div>
        <div style={{ fontSize:11, color:T.sub, marginBottom:14 }}>
          Each month shows the most recent figure recorded on or before it.
        </div>
        {everRecorded ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
              <XAxis dataKey="name" tick={{fill:T.sub,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={54}/>
              <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}} formatter={v=>fmt(v)}/>
              <Line type="monotone" dataKey="Total" stroke={T.accent} strokeWidth={2.5} dot={{r:3,fill:T.accent}}/>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign:"center", padding:"34px 0", color:T.sub, fontSize:13 }}>
            No figures recorded yet. Enter what each asset class is worth above and the trend builds from there.
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyOwedPage({ rows, onUpdate }) {
  const { fmt } = useMoney();
  const total=rows.reduce((a,r)=>a+(r.amount||0),0), paid=rows.reduce((a,r)=>a+(r.paid||0),0);
  const upd=(i,k,v)=>{const r=[...rows];r[i]={...r[i],[k]:v};onUpdate(r);};
  const inp={background:T.inputBg,border:`1px solid ${T.border}`,color:T.text,borderRadius:6,padding:"5px 8px",fontSize:13,fontFamily:"'DM Sans'"};
  const today = new Date().toISOString().slice(0, 10);
  // "amex" was a private-build leftover that meant nothing to anyone else.
  // Old rows carry it across into the free-text Method field on first read.
  const methodOf = r => r.method ?? (r.amex ? "Amex" : "");
  const outstanding = r => (r.amount||0) - (r.paid||0);
  const isOverdue = r => r.dueBy && r.dueBy < today && outstanding(r) > 0.005;
  const overdueCount = rows.filter(isOverdue).length;
  return (
    <div className="fade">
      <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600, marginBottom:20 }}>Money Owed</div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <StatCard icon="📋" label="Total Loaned" value={fmt(total)}/>
        <StatCard icon="✅" label="Received" value={fmt(paid)}/>
        <StatCard icon="⏳" label="Outstanding" value={fmt(total-paid)}
          sub={overdueCount ? `${overdueCount} past its due date` : undefined}
          valueTone={overdueCount ? T.danger : undefined}/>
      </div>
      <div className="card" style={{ padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div className="sl">Loans Tracker</div>
          <button className="btn btn-primary btn-sm" onClick={()=>onUpdate([...rows,{name:"",amount:0,reason:"",method:"",lentOn:today,dueBy:"",paid:0}])}>+ Add</button>
        </div>
        {rows.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:T.sub, fontSize:13 }}>
            Nothing lent out yet. Use <strong style={{ color:T.accent }}>+ Add</strong> to record the first one.
          </div>
        ) : (
        <div style={{ overflowX:"auto" }}>
          <table>
            <thead><tr>
              <th style={{ textAlign:"left",width:120 }}>Name</th><th>Amount</th>
              <th style={{ textAlign:"left" }}>Reason</th>
              <th style={{ textAlign:"left" }}>Method</th>
              <th>Lent on</th><th>Due by</th>
              <th>Paid</th><th>Balance</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i}>
                  <td><input value={r.name||""} onChange={e=>upd(i,"name",e.target.value)} style={{...inp,width:110}}/></td>
                  <td><NumInput value={r.amount} cellId={`owed.${i}.amount`} onChange={v=>upd(i,"amount",v)}/></td>
                  <td style={{ textAlign:"left" }}><input value={r.reason||""} onChange={e=>upd(i,"reason",e.target.value)} style={{...inp,width:150}}/></td>
                  <td style={{ textAlign:"left" }}><input value={methodOf(r)} placeholder="Bank transfer…"
                    onChange={e=>upd(i,"method",e.target.value)} style={{...inp,width:120}}/></td>
                  <td><input type="date" value={r.lentOn||""} onChange={e=>upd(i,"lentOn",e.target.value)}
                    style={{...inp,width:132,colorScheme:"dark"}}/></td>
                  <td><input type="date" value={r.dueBy||""} onChange={e=>upd(i,"dueBy",e.target.value)}
                    style={{...inp,width:132,colorScheme:"dark",borderColor:isOverdue(r)?T.danger:T.border}}/></td>
                  <td><NumInput value={r.paid} cellId={`owed.${i}.paid`} onChange={v=>upd(i,"paid",v)}/></td>
                  <td><span style={{color:outstanding(r)<=0?T.success:isOverdue(r)?T.danger:T.warning,fontWeight:600,fontSize:13}}>
                    {fmt(outstanding(r))}{isOverdue(r) && <span title="Past its due date"> ⚠</span>}
                  </span></td>
                  <td><button className="btn-icon" style={{color:T.danger}} onClick={()=>onUpdate(rows.filter((_,j)=>j!==i))} aria-label={`Remove ${r.name || "this loan"}`}>✕</button></td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td><td>{fmt(total)}</td><td></td><td></td><td></td><td></td><td>{fmt(paid)}</td>
                <td style={{color:total-paid>0?T.warning:T.success}}>{fmt(total-paid)}</td><td></td>
              </tr>
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

function BaselinePage({ monthIdx, viewEpoch, fyStart, totalMonths, incomeStreams, savingsStreams, expStreams,
  baselineIncome, baselineSavings, baselineExp, onUpdateBaseline, onEditBaseline }) {
  const { MONTHS, getFYYear, getFYMonths, getAllFYs } = useCalendar();
  const { fmt } = useMoney();
  const [selFY, setSelFY] = useSyncedState(getFYYear(monthIdx, fyStart), viewEpoch);
  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [getAllFYs, fyStart, totalMonths]);
  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Baselines</div>
      </div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:18 }}>
        Reference values, usually reviewed at the start of your {yearNoun(fyStart)}{fyStart !== 0 && <> (<strong style={{color:T.accent}}>{MONTH_NAMES[fyStart]}</strong>)</>}. Click <strong style={{color:T.accent}}>✎ Edit</strong> to update any section for the selected year.
      </div>
      <div style={{ display:"flex", marginBottom:20 }}>
        <YearPicker fys={fys} selectedFY={selFY} fyStart={fyStart} onSelectFY={setSelFY}/>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {[
          ["Income", incomeStreams, baselineIncome],
          ["Savings", savingsStreams, baselineSavings],
          ["Expenditure", expStreams, baselineExp],
        ].map(([title, streams, data]) => (
          <div className="card" style={{ padding:20 }} key={title}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div className="sl">{title} — {fyLabel(selFY,fyStart)}</div>
              <button className="btn btn-ghost btn-sm" onClick={()=>onEditBaseline(title,streams,data)}>✎ Edit {title} Baselines</button>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="sticky-col">
                <thead><tr>
                  <th style={{ width:160, minWidth:160 }}>Category</th>
                  {fyMonths.map(mi=><th key={mi} style={{ fontSize:10 }}>{MONTHS[mi]?.short}</th>)}
                  <th style={{ color:T.accent, minWidth:96 }}>{fyStart === 0 ? "Year Total" : "FY Total"}</th>
                </tr></thead>
                <tbody>
                  {streams.map(s=>(
                    <tr key={s}>
                      <td style={{ fontSize:12 }}>{s}</td>
                      {fyMonths.map(mi=><td key={mi} style={{ color:T.sub, fontSize:12 }}>{fmt(data[s]?.[mi]||0)}</td>)}
                      <td style={{ color:T.accent, fontWeight:600, fontSize:12 }}>{fmt(fyMonths.reduce((a,mi)=>a+(data[s]?.[mi]||0),0))}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total</td>
                    {fyMonths.map(mi=><td key={mi} style={{ fontSize:11 }}>{fmt(streams.reduce((a,s)=>a+(data[s]?.[mi]||0),0))}</td>)}
                    <td>{fmt(fyMonths.reduce((a,mi)=>a+streams.reduce((b,s)=>b+(data[s]?.[mi]||0),0),0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────
const SUGGESTED_SAVINGS = [
  { label:"Emergency Fund", icon:"🛡️" },
  { label:"Personal Savings", icon:"🏦" },
  { label:"Investments", icon:"📈" },
  { label:"Retirement", icon:"🌅" },
  { label:"Travel Fund", icon:"✈️" },
  { label:"House Deposit", icon:"🏡" },
  { label:"Wedding Fund", icon:"💍" },
  { label:"Education", icon:"🎓" },
  { label:"Car Fund", icon:"🚗" },
  { label:"Business Fund", icon:"💼" },
];
const SUGGESTED_EXP = [
  { label:"Rent / Mortgage", icon:"🏠" },
  { label:"Groceries", icon:"🛒" },
  { label:"Subscriptions", icon:"📱" },
  { label:"Dining & Entertainment", icon:"🍽️" },
  { label:"Transport", icon:"🚌" },
  { label:"Travel & Holidays", icon:"🌍" },
  { label:"Shopping", icon:"🛍️" },
  { label:"Healthcare", icon:"💊" },
  { label:"Utilities", icon:"💡" },
  { label:"Fitness", icon:"🏋️" },
  { label:"Charity / Church", icon:"⛪" },
  { label:"Childcare", icon:"👶" },
  { label:"Insurance", icon:"🔒" },
  { label:"Other", icon:"📋" },
];

function Onboarding({ onComplete, onRestore, importState }) {
  const restoreRef = useRef(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencySearch, setCurrencySearch] = useState("");
  // January unless the user says otherwise, so the default needs no explaining.
  const [fyStart, setFYStart] = useState(0);
  const [customYear, setCustomYear] = useState(false);
  const [yearHint, setYearHint] = useState(null);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  // Held as a monthly figure. A year's worth is a daunting number to name
  // before you have entered anything, and the app stores an annual goal, so
  // the twelve is applied on the way out rather than asked of the user.
  const [monthlyGoal, setMonthlyGoal] = useState("");
  // null until asked. Only reached when no goal was set.
  const [wantsSavings, setWantsSavings] = useState(null);
  const [savingsCats, setSavingsCats] = useState(["Emergency Fund","Personal Savings","Investments"]);
  const [expCats, setExpCats] = useState(["Rent / Mortgage","Groceries","Subscriptions","Transport"]);
  const [customSav, setCustomSav] = useState("");
  const [customExp, setCustomExp] = useState("");
  const [dir, setDir] = useState(1);

  // The clock is read here, on the click, never during render.
  const hintFor = start => {
    const now = new Date();
    const y = now.getMonth() >= start ? now.getFullYear() : now.getFullYear() - 1;
    return { start: y, end: start === 0 ? y : y + 1 };
  };
  const pickYearStart = start => { setFYStart(start); setYearHint(hintFor(start)); };
  const pickYearMode = custom => {
    setCustomYear(custom);
    if (custom) pickYearStart(fyStart === 0 ? 3 : fyStart);   // April is the common reason to be here
    else { setFYStart(0); setYearHint(null); }
  };

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.toLowerCase();
    return q ? CURRENCIES.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.includes(q)) : CURRENCIES;
  }, [currencySearch]);

  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); };
  const next = () => go(step + 1);
  const back = () => go(step - 1);

  const toggleCat = (arr, setArr, label) => {
    setArr(prev => prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]);
  };
  const addCustom = (val, arr, setArr, setCustom) => {
    const v = val.trim();
    if (v && !arr.includes(v)) setArr(prev => [...prev, v]);
    setCustom("");
  };

  const handleFinish = () => {
    onComplete({ name, currency, fyStart, monthlyIncome: parseFloat(monthlyIncome) || 0,
      savingsGoal: (parseFloat(monthlyGoal) || 0) * 12, savingsCats, expCats });
  };

  const TOTAL_STEPS = 7;

  // Income and the goal are the two steps a new user may simply not have an
  // answer for. Continuing past a blank field already worked, but nothing said
  // so, and an empty box with a Continue button reads as an unfinished task.
  const goalSet = parseFloat(monthlyGoal) > 0;
  const showSavingsNudge = !goalSet && wantsSavings === null;
  const stepSkippable = [false, false, true, true, false, false, false];
  const skipStep = () => {
    if (step === 2) setMonthlyIncome("");
    if (step === 3) setMonthlyGoal("");
    next();
  };
  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const stepValid = [
    name.trim().length > 0,           // 0 name
    true,                              // 1 currency (always valid)
    true,                              // 2 monthly income
    true,                              // 3 savings goal
    // Nothing is assumed for someone who skipped the goal: they answer the
    // nudge, and "not right now" is a complete answer.
    showSavingsNudge ? false : wantsSavings === false ? true : savingsCats.length > 0,  // 4 savings
    expCats.length > 0,                // 5 exp cats
    true,                              // 6 your year
  ];

  const stepContent = [
    // ── STEP 0: Welcome + Name ──
    <div key={0} style={{ textAlign:"center" }}>
      <div style={{ fontSize:60, marginBottom:24, lineHeight:1 }}>👋</div>
      <h1 style={{ fontFamily:"'Playfair Display'", fontSize:32, fontWeight:700, color:T.text, marginBottom:12 }}>
        Welcome to Yo Cent-E
      </h1>
      <p style={{ fontSize:15, color:T.sub, maxWidth:400, margin:"0 auto 40px" }}>
        Your personal finance tracker. Let's take two minutes to set things up exactly how you want them.
      </p>
      <div style={{ maxWidth:340, margin:"0 auto", textAlign:"left" }}>
        <label style={{ fontSize:12, fontWeight:600, color:T.sub, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:8 }}>
          What should we call you?
        </label>
        <input className="inp" autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key==="Enter" && name.trim() && next()}
          placeholder="Your first name…"
          style={{ width:"100%", fontSize:18, padding:"14px 18px", borderRadius:10,
            border:`1.5px solid ${name.trim() ? T.accent : T.border}`, background:T.inputBg }} />
        {name.trim() && (
          <div style={{ marginTop:12, fontSize:13, color:T.sub }}>
            Nice to meet you, <strong style={{ color:T.accent }}>{name}</strong> 👋
          </div>
        )}

        {/* Someone arriving on a new device with a backup had to finish the whole
            wizard before they could reach the restore button, then watch the
            restore overwrite the profile they had just created. */}
        {onRestore && (
          <div style={{ marginTop:28, paddingTop:20, borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:13, color:T.sub, marginBottom:10 }}>
              Used Yo Cent-E before? Your data lives in the browser you set it up in, so on a new
              device you start from a backup file.
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => restoreRef.current?.click()}
              style={{ width:"100%", justifyContent:"center" }}>
              ↑ Restore from a backup file
            </button>
            <input ref={restoreRef} type="file" accept="application/json,.json" style={{ display:"none" }}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onRestore(f); }} />
            {importState?.error && (
              <div style={{ marginTop:10, padding:"9px 12px", background:"rgba(240,100,100,.08)",
                border:`1px solid rgba(240,100,100,.3)`, borderRadius:8, fontSize:12, color:T.danger }}>
                {importState.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,

    // ── STEP 1: Currency ──
    <div key={1}>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ fontSize:44, marginBottom:12 }}>💱</div>
        <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Choose your currency</h2>
        <p style={{ fontSize:14, color:T.sub }}>All your figures will be displayed in this currency throughout the app.</p>
      </div>
      <input className="inp" placeholder="Search currency…" value={currencySearch} onChange={e=>setCurrencySearch(e.target.value)}
        style={{ width:"100%", marginBottom:14, padding:"10px 14px" }} autoFocus />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, maxHeight:280, overflowY:"auto", paddingRight:4 }}>
        {filteredCurrencies.map(c => {
          const active = c.code === currency.code;
          return (
            <button key={c.code} onClick={() => setCurrency(c)}
              style={{ background: active ? "rgba(212,168,83,.15)" : T.inputBg,
                border:`1.5px solid ${active ? T.accent : T.border}`, borderRadius:10, padding:"10px 12px",
                cursor:"pointer", textAlign:"left", transition:"all .15s", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:22, color:T.accent }}>{flagEmoji(c.locale)}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color: active ? T.accent : T.text }}>{c.code} <span style={{ color:T.sub, fontWeight:400 }}>{c.symbol}</span></div>
                <div style={{ fontSize:10, color:T.sub, marginTop:1 }}>{c.name}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop:14, padding:"10px 14px", background:"rgba(212,168,83,.06)", border:`1px solid rgba(212,168,83,.2)`, borderRadius:8, fontSize:13, color:T.sub }}>
        Selected: <strong style={{ color:T.accent }}>{flagEmoji(currency.locale)} {currency.name}</strong> — amounts will show as <strong style={{ color:T.accent }}>{currency.symbol}1,234.56</strong>
      </div>
    </div>,

    // ── STEP 2: Monthly Income ──
    <div key={2} style={{ textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>💷</div>
      <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Monthly income</h2>
      <p style={{ fontSize:14, color:T.sub, maxWidth:420, margin:"0 auto 28px" }}>
        Roughly how much do you bring home each month after tax? This seeds your income baseline — you can refine it per-month later.
      </p>
      <div style={{ maxWidth:300, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", background:T.inputBg, border:`1.5px solid ${monthlyIncome ? T.accent : T.border}`, borderRadius:12, overflow:"hidden", transition:"border-color .2s" }}>
          <span style={{ padding:"16px 16px", fontSize:22, color:T.accent, fontWeight:700, borderRight:`1px solid ${T.border}` }}>{currency.symbol}</span>
          <input type="number" autoFocus value={monthlyIncome} onChange={e=>setMonthlyIncome(e.target.value)}
            placeholder="0"
            style={{ background:"transparent", border:"none", outline:"none", color:T.text, fontSize:28, fontWeight:600, fontFamily:"'DM Sans'", padding:"16px 18px", width:"100%" }} />
        </div>
        {monthlyIncome && parseFloat(monthlyIncome) > 0 && (
          <div style={{ marginTop:16, padding:"10px 16px", background:"rgba(126,179,245,.08)", border:`1px solid rgba(126,179,245,.25)`, borderRadius:8, fontSize:13, color:T.blue }}>
            ✓ That's {currency.symbol}{(parseFloat(monthlyIncome)*12).toLocaleString()} per year
          </div>
        )}
        <p style={{ marginTop:14, fontSize:12, color:T.sub }}>Don't worry about being exact — this is just a starting point.</p>
      </div>
    </div>,

    // ── STEP 3: Savings Goal ──
    // Asked monthly. "Save £6,000 this year" is a number people flinch at;
    // "£500 a month" is the same commitment in a shape they can picture, and
    // the year's total is shown back to them anyway.
    <div key={3} style={{ textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>🎯</div>
      <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Monthly savings goal</h2>
      <p style={{ fontSize:14, color:T.sub, maxWidth:400, margin:"0 auto 28px" }}>
        Roughly how much would you like to put aside each month, across savings and investments? You can change this any time.
      </p>
      <div style={{ maxWidth:300, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", background:T.inputBg, border:`1.5px solid ${monthlyGoal ? T.accent : T.border}`, borderRadius:12, overflow:"hidden", transition:"border-color .2s" }}>
          <span style={{ padding:"16px 16px", fontSize:22, color:T.accent, fontWeight:700, borderRight:`1px solid ${T.border}` }}>{currency.symbol}</span>
          <input type="number" value={monthlyGoal} onChange={e=>setMonthlyGoal(e.target.value)}
            placeholder="0"
            style={{ background:"transparent", border:"none", outline:"none", color:T.text, fontSize:28, fontWeight:600, fontFamily:"'DM Sans'", padding:"16px 18px", width:"100%" }} />
        </div>
        {monthlyGoal && parseFloat(monthlyGoal) > 0 && (
          <div style={{ marginTop:16, padding:"10px 16px", background:"rgba(82,196,122,.08)", border:`1px solid rgba(82,196,122,.25)`, borderRadius:8, fontSize:13, color:T.success }}>
            ✓ That's {currency.symbol}{(parseFloat(monthlyGoal)*12).toLocaleString()} per year
            {monthlyIncome && parseFloat(monthlyIncome) > 0 && (
              <span> · {Math.round(parseFloat(monthlyGoal)/parseFloat(monthlyIncome)*100)}% of income</span>
            )}
          </div>
        )}
        <p style={{ marginTop:14, fontSize:12, color:T.sub }}>No idea yet? Skip it — the app works just as well without one.</p>
      </div>
    </div>,

    // ── STEP 4: Savings Categories ──
    // Someone who named a goal has already said they want to save, so they go
    // straight to choosing categories. Someone who skipped it used to be handed
    // three pre-ticked ones, which quietly decided for them; they are asked.
    <div key={4}>
      {showSavingsNudge ? (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>🌱</div>
          <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Would you like to start saving?</h2>
          <p style={{ fontSize:14, color:T.sub, maxWidth:430, margin:"0 auto 24px" }}>
            You skipped the goal, which is completely fine. Saving is easier to start
            small than to start perfectly — even a little each month counts.
          </p>
          <div style={{ display:"grid", gap:10, maxWidth:440, margin:"0 auto" }}>
            <button onClick={() => setWantsSavings(true)}
              style={{ textAlign:"left", padding:"14px 16px", borderRadius:12, cursor:"pointer",
                background:T.inputBg, border:`1.5px solid ${T.border}`, font:"inherit", transition:"all .15s" }}>
              <span style={{ display:"block", fontSize:14, fontWeight:600, color:T.text }}>Yes, let&rsquo;s set something up</span>
              <span style={{ display:"block", fontSize:12, color:T.sub, marginTop:2 }}>We&rsquo;ll suggest a few categories to choose from</span>
            </button>
            <button onClick={() => { setWantsSavings(false); setSavingsCats([]); }}
              style={{ textAlign:"left", padding:"14px 16px", borderRadius:12, cursor:"pointer",
                background:T.inputBg, border:`1.5px solid ${T.border}`, font:"inherit", transition:"all .15s" }}>
              <span style={{ display:"block", fontSize:14, fontWeight:600, color:T.text }}>Not right now</span>
              <span style={{ display:"block", fontSize:12, color:T.sub, marginTop:2 }}>You can add savings any time from the Savings page</span>
            </button>
          </div>
        </div>
      ) : wantsSavings === false ? (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>👍</div>
          <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>No problem</h2>
          <p style={{ fontSize:14, color:T.sub, maxWidth:400, margin:"0 auto 20px" }}>
            We&rsquo;ll leave savings out for now. Everything else still works, and you can
            add it whenever you are ready.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => setWantsSavings(null)}>Actually, let me pick some</button>
        </div>
      ) : (
        <>
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🏦</div>
            <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Savings categories</h2>
            <p style={{ fontSize:14, color:T.sub }}>What are you saving for? Select all that apply and add your own.</p>
          </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:14 }}>
        {SUGGESTED_SAVINGS.map(({ label, icon }) => {
          const on = savingsCats.includes(label);
          return (
            <button key={label} onClick={() => toggleCat(savingsCats, setSavingsCats, label)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
                background: on ? "rgba(212,168,83,.12)" : T.inputBg,
                border:`1.5px solid ${on ? T.accent : T.border}`, borderRadius:10, cursor:"pointer",
                transition:"all .15s", textAlign:"left" }}>
              <span style={{ fontSize:20 }}>{icon}</span>
              <span style={{ fontSize:13, fontWeight: on ? 600 : 400, color: on ? T.accent : T.sub, fontFamily:"'DM Sans'" }}>{label}</span>
              {on && <span style={{ marginLeft:"auto", color:T.accent, fontSize:16 }}>✓</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input className="inp" value={customSav} onChange={e=>setCustomSav(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addCustom(customSav,savingsCats,setSavingsCats,setCustomSav)}
          placeholder="+ Add custom category…" style={{ flex:1 }} />
        <button className="btn btn-ghost" onClick={()=>addCustom(customSav,savingsCats,setSavingsCats,setCustomSav)}>Add</button>
      </div>
      {savingsCats.filter(c=>!SUGGESTED_SAVINGS.find(s=>s.label===c)).map(c=>(
        <div key={c} style={{ display:"inline-flex", alignItems:"center", gap:6, margin:"6px 4px 0 0", padding:"4px 10px", background:"rgba(212,168,83,.1)", border:`1px solid ${T.accent}`, borderRadius:20, fontSize:12, color:T.accent }}>
          {c} <button onClick={()=>setSavingsCats(p=>p.filter(x=>x!==c))} style={{ background:"none",border:"none",cursor:"pointer",color:T.accent,lineHeight:1 }}>✕</button>
        </div>
      ))}
      {/* These are a starting point, not a commitment. Saying so here stops
          people agonising over wording they can change in a minute. */}
      <p style={{ marginTop:16, fontSize:12, color:T.sub, textAlign:"center" }}>
        These are only a starting point — you can rename, add or remove any of them
        once you are set up, so they do not have to be the final names.
      </p>
          {/* Someone who arrived here through the nudge can still change their
              mind. Without this, unticking everything left Continue disabled
              with no way back to the answer they had already been offered. */}
          {!goalSet && (
            <div style={{ textAlign:"center", marginTop:10 }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setWantsSavings(false); setSavingsCats([]); }}>Actually, not right now</button>
            </div>
          )}
        </>
      )}
    </div>,

    // ── STEP 5: Expenditure Categories ──
    <div key={5}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:44, marginBottom:12 }}>🧾</div>
        <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Expenditure categories</h2>
        <p style={{ fontSize:14, color:T.sub }}>What do you spend money on? Pick everything that applies.</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:14, maxHeight:320, overflowY:"auto", paddingRight:4 }}>
        {SUGGESTED_EXP.map(({ label, icon }) => {
          const on = expCats.includes(label);
          return (
            <button key={label} onClick={() => toggleCat(expCats, setExpCats, label)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px",
                background: on ? "rgba(212,168,83,.12)" : T.inputBg,
                border:`1.5px solid ${on ? T.accent : T.border}`, borderRadius:10, cursor:"pointer",
                transition:"all .15s", textAlign:"left" }}>
              <span style={{ fontSize:20 }}>{icon}</span>
              <span style={{ fontSize:13, fontWeight: on ? 600 : 400, color: on ? T.accent : T.sub, fontFamily:"'DM Sans'" }}>{label}</span>
              {on && <span style={{ marginLeft:"auto", color:T.accent, fontSize:16 }}>✓</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input className="inp" value={customExp} onChange={e=>setCustomExp(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addCustom(customExp,expCats,setExpCats,setCustomExp)}
          placeholder="+ Add custom category…" style={{ flex:1 }} />
        <button className="btn btn-ghost" onClick={()=>addCustom(customExp,expCats,setExpCats,setCustomExp)}>Add</button>
      </div>
      {expCats.filter(c=>!SUGGESTED_EXP.find(s=>s.label===c)).map(c=>(
        <div key={c} style={{ display:"inline-flex", alignItems:"center", gap:6, margin:"6px 4px 0 0", padding:"4px 10px", background:"rgba(212,168,83,.1)", border:`1px solid ${T.accent}`, borderRadius:20, fontSize:12, color:T.accent }}>
          {c} <button onClick={()=>setExpCats(p=>p.filter(x=>x!==c))} style={{ background:"none",border:"none",cursor:"pointer",color:T.accent,lineHeight:1 }}>✕</button>
        </div>
      ))}
      {/* These are a starting point, not a commitment. Saying so here stops
          people agonising over wording they can change in a minute. */}
      <p style={{ marginTop:16, fontSize:12, color:T.sub, textAlign:"center" }}>
        These are only a starting point — you can rename, add or remove any of them
        once you are set up, so they do not have to be the final names.
      </p>
    </div>,

    // ── STEP 6: Your year ──
    // Last, and done in one click by anyone who does not need it. Testers told
    // us they did not know what a financial year was; asking them to name one
    // before they had entered a single figure was the wrong question at the
    // wrong time. Neither option here asks what they know — both describe a
    // situation, and the common one is already chosen.
    <div key={6} style={{ textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>📅</div>
      <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Your year</h2>
      <p style={{ fontSize:14, color:T.sub, maxWidth:430, margin:"0 auto 24px" }}>
        Most people track their money by the calendar year. If you file a tax return
        or run a business, yours might start in a different month.
      </p>
      <div style={{ display:"grid", gap:10, maxWidth:440, margin:"0 auto" }}>
        {[
          { custom:false, title:"January to December", sub:"The calendar year" },
          { custom:true,  title:"My year starts another month", sub:"For a tax year or a business year" },
        ].map(o => (
          <button key={String(o.custom)} onClick={() => pickYearMode(o.custom)}
            aria-pressed={customYear === o.custom}
            style={{ textAlign:"left", padding:"14px 16px", borderRadius:12, cursor:"pointer",
              background: customYear === o.custom ? "rgba(212,168,83,.12)" : T.inputBg,
              border:`1.5px solid ${customYear === o.custom ? T.accent : T.border}`,
              transition:"all .15s", font:"inherit", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ width:16, height:16, borderRadius:"50%", flexShrink:0,
              border:`2px solid ${customYear === o.custom ? T.accent : T.border}`,
              background: customYear === o.custom ? T.accent : "transparent" }}/>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:"block", fontSize:14, fontWeight:600,
                color: customYear === o.custom ? T.accent : T.text }}>{o.title}</span>
              <span style={{ display:"block", fontSize:12, color:T.sub, marginTop:2 }}>{o.sub}</span>
            </span>
            {!o.custom && <span style={{ fontSize:10, color:T.sub, textTransform:"uppercase",
              letterSpacing:".06em", flexShrink:0 }}>Most people</span>}
          </button>
        ))}
      </div>

      {customYear && (
        <div style={{ marginTop:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, maxWidth:440, margin:"0 auto 16px" }}>
            {MONTH_NAMES.map((m, mi) => (
              <button key={mi} onClick={() => pickYearStart(mi)}
                style={{ background: fyStart===mi ? "rgba(212,168,83,.15)" : T.inputBg,
                  border:`1.5px solid ${fyStart===mi ? T.accent : T.border}`, borderRadius:10,
                  padding:"12px 8px", cursor:"pointer", transition:"all .15s",
                  color: fyStart===mi ? T.accent : T.sub, fontWeight: fyStart===mi ? 700 : 400,
                  fontFamily:"'DM Sans'", fontSize:13 }}>
                {m}
              </button>
            ))}
          </div>
          {/* The answer in plain terms, so someone half-sure can check it
              rather than having to trust the word "financial year". */}
          {yearHint && (
            <div style={{ padding:"12px 20px", background:"rgba(212,168,83,.06)",
              border:`1px solid rgba(212,168,83,.2)`, borderRadius:10, fontSize:13,
              color:T.sub, display:"inline-block" }}>
              Your year will run <strong style={{ color:T.accent }}>{MONTH_NAMES[fyStart]} {yearHint.start}</strong>
              {" → "}<strong style={{ color:T.accent }}>{MONTH_NAMES[(fyStart+11)%12]} {yearHint.end}</strong>
              {fyStart===3 && <span style={{ color:T.success, marginLeft:8 }}>✓ UK tax year</span>}
            </div>
          )}
        </div>
      )}
    </div>,
  ];

  const stepLabels = ["Welcome","Currency","Income","Goal","Savings","Spending","Your year"];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{STYLES}</style>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(${dir*40}px); } to { opacity:1; transform:none; } }
        .ob-slide { animation: slideIn .28s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* Header logo */}
      <div style={{ marginBottom:32, textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:22, fontWeight:700, color:T.accent, letterSpacing:2 }}>YO CENT-E</div>
        <div style={{ fontSize:11, color:T.sub, letterSpacing:3, marginTop:2 }}>PERSONAL FINANCE</div>
      </div>

      {/* Progress bar */}
      <div style={{ width:"100%", maxWidth:600, marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          {stepLabels.map((l,i) => (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, transition:"all .25s",
                background: i < step ? T.accent : i===step ? T.accent : T.border,
                color: i <= step ? "#0d1b2a" : T.sub, cursor: i < step ? "pointer" : "default" }}
                onClick={() => i < step && go(i)}>
                {i < step ? "✓" : i+1}
              </div>
              <div style={{ fontSize:10, color: i===step ? T.accent : T.sub, fontWeight: i===step ? 600 : 400, letterSpacing:"0.04em" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", background:`linear-gradient(90deg, ${T.accent}, #e8c070)`, width:`${progress}%`, transition:"width .4s cubic-bezier(.22,1,.36,1)", borderRadius:2 }}/>
        </div>
      </div>

      {/* Card */}
      <div className="card ob-slide" key={step} style={{ width:"100%", maxWidth:600, padding:36, minHeight:420, display:"flex", flexDirection:"column" }}>
        <div style={{ flex:1 }}>
          {stepContent[step]}
        </div>

        {/* Navigation */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:32, paddingTop:24, borderTop:`1px solid ${T.border}` }}>
          <button className="btn btn-ghost" onClick={back} style={{ visibility: step===0 ? "hidden" : "visible" }}>← Back</button>
          <div style={{ fontSize:12, color:T.sub }}>{step+1} of {TOTAL_STEPS}</div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {stepSkippable[step] && (
            <button className="btn btn-ghost" onClick={skipStep}>Skip for now</button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button className="btn btn-primary" onClick={next} disabled={!stepValid[step]}
              style={{ opacity: stepValid[step] ? 1 : 0.4, cursor: stepValid[step] ? "pointer" : "not-allowed" }}>
              Continue →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} disabled={!stepValid[step]}
              style={{ opacity: stepValid[step] ? 1 : 0.4, background:`linear-gradient(135deg, ${T.accent}, #e8c070)` }}>
              Start my journey 🚀
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
// The outermost boundary. A fault in the header, the providers or the loading
// path would otherwise leave a blank page with no way to rescue unsaved work.
export default function App() {
  return (
    <ErrorBoundary scope="app">
      <YoCentEApp />
    </ErrorBoundary>
  );
}

function YoCentEApp() {
  const [onboarded, setOnboarded] = useState(false);  // gated until loaded
  const [onboardLoading, setOnboardLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [page, setPage] = useState("dashboard");
  // Where this profile's timeline starts. Profiles created before the timeline
  // could move carry no epoch, and fall back to the original January 2026.
  const [epoch, setEpoch] = useState(LEGACY_EPOCH);
  const [monthIdx, setMonthIdx] = useState(() =>
    Math.max(0, Math.min(monthIndexOf(LEGACY_EPOCH), MAX_MONTHS - 1)));
  // Bumped by "Today". Every page's FY tab strip watches it, so one click
  // returns the whole app to the present rather than just the month header.
  const [viewEpoch, setViewEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  // "idle" before anything changes, then pending -> saving -> saved.
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [fyStart, setFYStart] = useState(0); // calendar year; a stored profile overrides it
  const [totalMonths, setTotalMonths] = useState(48); // starts at 48, user can extend
  const [fySettingsOpen, setFYSettingsOpen] = useState(false);
  const [currency, setCurrency] = useState(CURRENCIES[0]); // GBP default
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Baseline editor modal state
  const [blModal, setBLModal] = useState(null); // { section, streams, data }

  // Categories
  const [incomeStreams, setIncomeStreams] = useState(DEFAULT_INCOME_STREAMS);
  const [savingsStreams, setSavingsStreams] = useState(DEFAULT_SAVINGS_STREAMS);
  // { [category]: "pot" | "investment" } — replaces guessing from the name
  const [savingsTypes, setSavingsTypes] = useState(() => withSavingsKinds(DEFAULT_SAVINGS_STREAMS));
  const [expStreams, setExpStreams] = useState(DEFAULT_EXP_STREAMS);

  // Baselines
  const [baselineIncome, setBaselineIncome] = useState(makeBaselineIncome);
  const [baselineSavings, setBaselineSavings] = useState(makeBaselineSavings);
  const [baselineExp, setBaselineExp] = useState(makeBaselineExp);

  // Actual / transactional data — pre-seeded with real historical values
  const [incomeActual, setIncomeActual] = useState(() => ({}));
  const [savingsForecast, setSavingsForecast] = useState(() => ({}));
  const [savingsWeekly, setSavingsWeekly] = useState(() => ({}));
  const [expForecast, setExpForecast] = useState(() => ({}));
  const [expWeekly, setExpWeekly] = useState(() => ({}));

  // Notes: expNotes[stream][monthIdx][week] = string; incomeNotes[stream][monthIdx] = string
  const [expNotes, setExpNotes] = useState({});
  // Working behind a figure: { [cellId]: "70+30" }. Flat, because the cells it
  // covers belong to six different data shapes.
  const [formulas, setFormulas] = useState({});
  // Writing null forgets an entry, so a plain number typed over a formula does
  // not leave the old working behind it.
  const setFormula = useCallback((id, expr) => setFormulas(prev => {
    if (!expr) {
      if (!(id in prev)) return prev;
      const next = { ...prev }; delete next[id]; return next;
    }
    return prev[id] === expr ? prev : { ...prev, [id]: expr };
  }), []);
  const [incomeNotes, setIncomeNotes] = useState({});

  const [netWorthAssets, setNetWorthAssets] = useState(NET_WORTH_ASSETS);
  const [netWorth, setNetWorth] = useState(() => migrateNetWorth({}, NET_WORTH_ASSETS));
  const [moneyOwed, setMoneyOwed] = useState([]);
  const [savingsGoal, setSavingsGoal] = useState(0);

  // Backup / restore, and the prompt shown when storage holds a version this
  // build does not recognise.
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [versionConflict, setVersionConflict] = useState(null);

  // Adopt a set of stored values into React state. Shared by the initial load
  // and by restoring a backup, so both go through exactly the same migrations.
  const adoptStored = useCallback(v => {
    if (v.done) setOnboarded(true);
    if (v.name) setUserName(v.name);
    if (v.goal !== null && v.goal !== undefined) setSavingsGoal(v.goal);

    const ep = v.epoch && Number.isInteger(v.epoch.year) ? v.epoch : LEGACY_EPOCH;
    const here = Math.max(0, Math.min(monthIndexOf(ep), MAX_MONTHS - 1));
    setEpoch(ep);
    setMonthIdx(here);
    if (v.fy !== null && v.fy !== undefined) setFYStart(v.fy);
    if (v.tm !== null && v.tm !== undefined) setTotalMonths(v.tm);
    if (v.curr) { const found = CURRENCIES.find(c => c.code === v.curr); if (found) setCurrency(found); }
    if (v.cats) { if(v.cats.income)setIncomeStreams(v.cats.income); if(v.cats.savings)setSavingsStreams(v.cats.savings); if(v.cats.exp)setExpStreams(v.cats.exp); }
    // v1 profiles have no stored kinds; derive them once from the old name test
    // so behaviour is unchanged, then keep them explicit.
    setSavingsTypes(withSavingsKinds(v.cats?.savings || DEFAULT_SAVINGS_STREAMS, v.savTypes || {}));
    if (v.bInc)   setBaselineIncome(v.bInc);
    if (v.bSav)   setBaselineSavings(v.bSav);
    if (v.bExp)   setBaselineExp(v.bExp);
    if (v.incAct) setIncomeActual(v.incAct);
    if (v.savFc)  setSavingsForecast(v.savFc);
    if (v.savWk)  setSavingsWeekly(v.savWk);
    if (v.expFc)  setExpForecast(v.expFc);
    if (v.expWk)  setExpWeekly(v.expWk);
    // v1 profiles hold one net worth figure per asset; convert to a series.
    const nwAssets = Array.isArray(v.nwCats) && v.nwCats.length ? v.nwCats : NET_WORTH_ASSETS;
    setNetWorthAssets(nwAssets);
    setNetWorth(migrateNetWorth(v.nw || {}, nwAssets, here));
    if (v.mo)    setMoneyOwed(v.mo);
    if (v.expN)  setExpNotes(v.expN);
    if (v.fx)    setFormulas(v.fx);
    if (v.incN)  setIncomeNotes(v.incN);
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await readAll();
      // A version this build does not recognise used to mean "silently throw
      // every figure away". Now nothing is touched until the user has been
      // asked, and they are offered a backup before anything is discarded.
      if (classifyVersion(stored.dver, stored.done) === "unknown") {
        setVersionConflict({ found: stored.dver, values: stored });
        setLoading(false);
        setOnboardLoading(false);
        return;
      }
      adoptStored(stored);
      setLoading(false);
      setOnboardLoading(false);
    })();
  }, [adoptStored]);

  // Called when user completes onboarding
  const handleOnboardingComplete = useCallback(async ({ name, currency: c, fyStart: fy, monthlyIncome: mInc, savingsGoal: goal, savingsCats, expCats }) => {
    const newEpoch = epochForNewProfile();
    setUserName(name);
    setCurrency(c);
    setFYStart(fy);
    setEpoch(newEpoch);
    setMonthIdx(Math.max(0, Math.min(monthIndexOf(newEpoch), MAX_MONTHS - 1)));
    setSavingsGoal(goal);
    setSavingsStreams(savingsCats);
    setExpStreams(expCats);

    // Seed the income baseline from the stated monthly figure. Actuals stay
    // empty — nothing has been received yet, least of all in future months.
    const incStreams = ["Pay check", "Extra Income"];
    const blankArr = () => Array(MAX_MONTHS).fill(0);
    const newBaselineIncome = { "Pay check": Array(MAX_MONTHS).fill(mInc || 0), "Extra Income": blankArr() };
    const newIncomeActual   = { "Pay check": blankArr(), "Extra Income": blankArr() };
    setIncomeStreams(incStreams);
    setBaselineIncome(newBaselineIncome);
    setIncomeActual(newIncomeActual);

    // Spread the annual savings goal evenly across the chosen categories, so the
    // dashboard gauges have a real target to measure against from the first visit.
    // Any rounding remainder goes to the first category, so the monthly targets
    // still add up to exactly a twelfth of the stated goal.
    const monthlyGoal = Math.round(((goal || 0) / 12) * 100) / 100;
    const nCats = savingsCats.length;
    const perCat = nCats ? Math.floor((monthlyGoal / nCats) * 100) / 100 : 0;
    const firstCat = nCats ? Math.round((monthlyGoal - perCat * (nCats - 1)) * 100) / 100 : 0;
    const goalArrFor = i => Array(MAX_MONTHS).fill(i === 0 ? firstCat : perCat);
    const newBaselineSavings = Object.fromEntries(savingsCats.map((s, i) => [s, goalArrFor(i)]));
    const newForecastSavings = Object.fromEntries(savingsCats.map((s, i) => [s, goalArrFor(i)]));
    const newSavingsWeekly   = Object.fromEntries(savingsCats.map(s => [s, blankWeekly()]));
    const newBaselineExp     = Object.fromEntries(expCats.map(s => [s, blankArr()]));
    const newForecastExp     = Object.fromEntries(expCats.map(s => [s, blankArr()]));
    const newExpWeekly       = Object.fromEntries(expCats.map(s => [s, blankWeekly()]));
    setBaselineSavings(newBaselineSavings);
    setSavingsForecast(newForecastSavings);
    setSavingsWeekly(newSavingsWeekly);
    setBaselineExp(newBaselineExp);
    setExpForecast(newForecastExp);
    setExpWeekly(newExpWeekly);

    setOnboarded(true);

    // Immediately persist
    await Promise.all([
      save("bt3-name", name),
      save("bt3-curr", c.code),
      save("bt3-fy", fy),
      save("bt3-epoch", newEpoch),
      save("bt3-goal", goal),
      save("bt3-cats", { income: incStreams, savings: savingsCats, exp: expCats }),
      save("bt3-bInc", newBaselineIncome),
      save("bt3-incAct", newIncomeActual),
      save("bt3-bSav", newBaselineSavings), save("bt3-savFc", newForecastSavings), save("bt3-savWk", newSavingsWeekly),
      save("bt3-bExp", newBaselineExp), save("bt3-expFc", newForecastExp), save("bt3-expWk", newExpWeekly),
      save("bt3-done", true),
      save("bt3-dver", DATA_VER),
    ]);
  }, []);

  // Growing the window backwards moves the epoch back a year and slides every
  // stored series forward to match, so existing entries stay on their months.
  const addEarlierYear = useCallback(() => {
    const N = 12;
    // Only the actuals are guarded. Baselines and forecasts repeat a plan
    // across the whole window by design, so their tail is not recorded data —
    // treating it as such made this refuse every time.
    const recorded = [incomeActual, savingsWeekly, expWeekly];
    if (recorded.some(d => wouldLoseData(d, N))) {
      window.alert(
        "Adding an earlier year would push your most recent 12 months off the end of the timeline, " +
        "which only holds 10 years. Nothing has been changed."
      );
      return;
    }
    setEpoch(e => shiftEpoch(e, -N));
    setMonthIdx(i => Math.min(i + N, MAX_MONTHS - 1));
    setTotalMonths(t => Math.min(t + N, MAX_MONTHS));
    setBaselineIncome(d => shiftAllArrays(d, N));
    setBaselineSavings(d => shiftAllArrays(d, N));
    setBaselineExp(d => shiftAllArrays(d, N));
    setIncomeActual(d => shiftAllArrays(d, N));
    setSavingsForecast(d => shiftAllArrays(d, N));
    setExpForecast(d => shiftAllArrays(d, N));
    setSavingsWeekly(d => shiftAllWeekly(d, N));
    setExpWeekly(d => shiftAllWeekly(d, N));
    setExpNotes(n => shiftNotes(n, N));
    setIncomeNotes(n => shiftNotes(n, N));
  }, [incomeActual, savingsWeekly, expWeekly]);

  // ─── Backup and restore ──────────────────────────────────────────────────
  // Everything lives in this browser's storage, so a backup file is the only
  // thing standing between a cleared cache and starting again from nothing.

  // Write whatever is currently in storage out as a file. Returns the values
  // written, so callers that are about to destroy something can back it up
  // first and know it succeeded.
  const downloadBackup = useCallback(values => downloadBackupFile(values), []);

  const [importState, setImportState] = useState(null); // { error } | { ok, count, exportedAt }

  // Restore from a file the user picked. The current profile is exported first,
  // because this overwrites it.
  const restoreBackup = useCallback(async file => {
    setImportState(null);
    let text;
    try { text = await file.text(); }
    catch { setImportState({ error: "That file could not be read." }); return; }

    const parsed = parseBackup(text);
    if (!parsed.ok) { setImportState({ error: parsed.error }); return; }

    const current = await readAll();
    if (current.done) {
      if (!window.confirm(
        `Restoring will replace the profile in this browser with the backup (${parsed.count} fields` +
        `${parsed.exportedAt ? ", saved " + new Date(parsed.exportedAt).toLocaleString() : ""}).\n\n` +
        `Your current profile will be downloaded as a backup first. Continue?`)) return;
      await downloadBackup(current);
    }

    clearAll();
    await writeAll({ ...parsed.values, dver: DATA_VER });
    adoptStored(parsed.values);
    setImportState({ ok: true, count: parsed.count, exportedAt: parsed.exportedAt });
  }, [adoptStored, downloadBackup]);

  // Deliberately discard the profile in storage — only ever reached from the
  // version-conflict prompt, and only after a backup has been written.
  const discardStored = useCallback(async values => {
    await downloadBackup(values);
    if (!window.confirm(
      "A backup has been downloaded. Starting fresh will now erase the profile in this browser. Continue?")) return;
    clearAll();
    window.location.reload();
  }, [downloadBackup]);

  // Writes everything to storage. Free of UI state, so the autosave and the
  // manual "save now" go through exactly the same path.
  const persist = useCallback(async () => {
    await Promise.all([
      save("bt3-fy", fyStart),
      save("bt3-tm", totalMonths),
      save("bt3-curr", currency.code),
      save("bt3-dver", DATA_VER),
      save("bt3-name", userName),
      save("bt3-goal", savingsGoal),
      save("bt3-done", true),
      save("bt3-cats", { income:incomeStreams, savings:savingsStreams, exp:expStreams }),
      save("bt3-savTypes", savingsTypes),
      save("bt3-epoch", epoch),
      save("bt3-bInc", baselineIncome), save("bt3-bSav", baselineSavings), save("bt3-bExp", baselineExp),
      save("bt3-incAct", incomeActual), save("bt3-savFc", savingsForecast), save("bt3-savWk", savingsWeekly),
      save("bt3-expFc", expForecast), save("bt3-expWk", expWeekly),
      save("bt3-nw", netWorth), save("bt3-nwCats", netWorthAssets), save("bt3-mo", moneyOwed),
      save("bt3-expN", expNotes), save("bt3-incN", incomeNotes),
      save("bt3-fx", formulas),
    ]);
  }, [fyStart,totalMonths,currency,userName,savingsGoal,savingsTypes,epoch,netWorthAssets,incomeStreams,savingsStreams,expStreams,baselineIncome,baselineSavings,baselineExp,
      incomeActual,savingsForecast,savingsWeekly,expForecast,expWeekly,netWorth,moneyOwed,expNotes,incomeNotes,formulas]);

  // ─── Autosave ────────────────────────────────────────────────────────────
  // Saving used to be a button you had to remember to press, so an evening of
  // entering receipts could be lost by closing the tab. Changes are now written
  // shortly after you stop making them, and the window in between is guarded.
  const armed = useRef(false);
  useEffect(() => {
    if (loading || !onboarded) return;
    // The first run after loading is the freshly-read profile settling into
    // state, not something the user did — arm on it rather than saving it back.
    if (!armed.current) { armed.current = true; return; }

    setSaveState("pending");
    const t = setTimeout(async () => {
      setSaveState("saving");
      await persist();
      setSavedAt(Date.now());
      setSaveState("saved");
    }, 1200);
    return () => clearTimeout(t);
  }, [loading, onboarded, persist]);

  // Only warn while a change is actually outstanding. A guard that fires on
  // every close is one people learn to dismiss without reading.
  useEffect(() => {
    if (saveState !== "pending" && saveState !== "saving") return;
    const warn = e => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const saveNow = useCallback(async () => {
    setSaveState("saving");
    await persist();
    setSavedAt(Date.now());
    setSaveState("saved");
  }, [persist]);

  // Category handlers — ensure data structures when streams change
  const handleSetInc = useCallback((ns, origin) => {
    setIncomeStreams(ns);
    setIncomeActual(p => applyStreams(p, ns, origin, "array"));
    setBaselineIncome(p => applyStreams(p, ns, origin, "array"));
    setIncomeNotes(p => applyNotes(p, ns, origin));
  }, []);
  const handleSetSav = useCallback((ns, origin, kinds) => {
    setSavingsStreams(ns);
    setSavingsForecast(p => applyStreams(p, ns, origin, "array"));
    setSavingsWeekly(p => applyStreams(p, ns, origin, "weekly"));
    setBaselineSavings(p => applyStreams(p, ns, origin, "array"));
    // Carry each kind across a rename, then fill in anything new.
    setSavingsTypes(prev => {
      const moved = { ...prev };
      ns.forEach(s => {
        const from = origin?.[s];
        if (from && from !== s && from in moved) { moved[s] = moved[from]; delete moved[from]; }
      });
      return withSavingsKinds(ns, { ...moved, ...(kinds || {}) });
    });
  }, []);
  const handleSetExp = useCallback((ns, origin) => {
    setExpStreams(ns);
    setExpForecast(p => applyStreams(p, ns, origin, "array"));
    setExpWeekly(p => applyStreams(p, ns, origin, "weekly"));
    setBaselineExp(p => applyStreams(p, ns, origin, "array"));
    setExpNotes(p => applyNotes(p, ns, origin));
  }, []);

  // Baseline edit handler — opens the modal for the right section
  const openBaselineEditor = useCallback((section, streams, data) => {
    setBLModal({ section, streams, data });
  }, []);

  const saveBaseline = useCallback((section, newData) => {
    if (section === "Income") setBaselineIncome(newData);
    else if (section === "Savings") setBaselineSavings(newData);
    else if (section === "Expenditure") setBaselineExp(newData);
    setBLModal(null);
  }, []);

  // Transaction update handlers
  const updIncAct  = useCallback((s,mi,v)=>setIncomeActual(p=>{const a=[...(p[s]||Array(MAX_MONTHS).fill(0))];a[mi]=v;return{...p,[s]:a};}), []);
  const updSavFc   = useCallback((s,mi,v)=>setSavingsForecast(p=>{const a=[...(p[s]||Array(MAX_MONTHS).fill(0))];a[mi]=v;return{...p,[s]:a};}), []);
  const updSavWk   = useCallback((s,mi,w,v)=>setSavingsWeekly(p=>{const ex=p[s]||blankWeekly();const md={...(ex[mi]||{1:0,2:0,3:0,4:0,5:0}),[w]:v};return{...p,[s]:{...ex,[mi]:md}};}), []);
  const updExpFc   = useCallback((s,mi,v)=>setExpForecast(p=>{const a=[...(p[s]||Array(MAX_MONTHS).fill(0))];a[mi]=v;return{...p,[s]:a};}), []);
  const updExpWk   = useCallback((s,mi,w,v)=>setExpWeekly(p=>{const ex=p[s]||blankWeekly();const md={...(ex[mi]||{1:0,2:0,3:0,4:0,5:0}),[w]:v};return{...p,[s]:{...ex,[mi]:md}};}), []);

  // Notes update handlers
  // expNotes: { [stream]: { [monthIdx]: { [week]: string } } }
  const updExpNote = useCallback((s,mi,w,text) => setExpNotes(p => ({
    ...p, [s]: { ...(p[s]||{}), [mi]: { ...(p[s]?.[mi]||{}), [w]: text } }
  })), []);
  // incomeNotes: { [stream]: { [monthIdx]: string } }
  const updIncomeNote = useCallback((s,mi,text) => setIncomeNotes(p => ({
    ...p, [s]: { ...(p[s]||{}), [mi]: text }
  })), []);

  // Formatters for the selected currency, handed to the tree via context so no
  // module-level state has to be written during render.
  const money = useMemo(() => makeFormatters(currency), [currency]);
  const calendar = useMemo(() => makeCalendar(epoch), [epoch]);

  const navItems = [
    {key:"dashboard",icon:"◈",label:"Dashboard"},
    {key:"networth",icon:"◆",label:"Net Worth"},
    {key:"income",icon:"↗",label:"Income"},
    {key:"savings",icon:"◎",label:"Savings"},
    {key:"expenditure",icon:"◉",label:"Expenditure"},
    {key:"moneyowed",icon:"◷",label:"Money Owed"},
    {key:"baseline",icon:"⊞",label:"Baselines"},
  ];

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:24, color:T.accent, marginBottom:8 }}>Yo Cent-E</div>
        <div style={{ color:T.sub, fontSize:13 }}>Loading your data…</div>
      </div>
    </div>
  );

  // Show onboarding for brand-new users (wait until storage check completes)
  if (onboardLoading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{STYLES}</style>
      <div style={{ color:T.sub, fontSize:14 }}>Loading…</div>
    </div>
  );
  // Storage holds a version this build does not know. Ask before doing
  // anything — in particular, do not drop the user into onboarding as though
  // they had no data, which is what silently discarding it used to look like.
  if (versionConflict) return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <style>{STYLES}</style>
      <VersionConflictModal
        found={versionConflict.found}
        onBackup={() => downloadBackup(versionConflict.values)}
        onLoadAnyway={() => { adoptStored(versionConflict.values); setVersionConflict(null); }}
        onDiscard={() => discardStored(versionConflict.values)}
      />
    </div>
  );

  if (!onboarded) return <Onboarding onComplete={handleOnboardingComplete}
    onRestore={restoreBackup} importState={importState} />;

  return (
    <CurrencyContext.Provider value={money}>
    <CalendarContext.Provider value={calendar}>
    <FormulaContext.Provider value={{ map: formulas, set: setFormula }}>
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <style>{STYLES}</style>

      {/* FY Settings Modal */}
      {fySettingsOpen && <FYSettingsModal fyStart={fyStart} totalMonths={totalMonths} onAddEarlier={addEarlierYear}
        onSave={(newFy, newTm)=>{setFYStart(newFy);setTotalMonths(newTm);setFYSettingsOpen(false);}} onClose={()=>setFYSettingsOpen(false)}/>}

      {/* Backup & restore */}
      {dataModalOpen && <DataModal userName={userName} importState={importState}
        onExport={()=>downloadBackup()} onImport={restoreBackup} onClose={()=>setDataModalOpen(false)}/>}

      {/* Currency Modal */}
      {currencyOpen && <CurrencyModal current={currency} onSave={c=>{setCurrency(c);setCurrencyOpen(false);}} onClose={()=>setCurrencyOpen(false)}/>}

      {/* Baseline Editor Modal */}
      {blModal && (
        <BaselineEditorModal
          section={blModal.section}
          streams={blModal.section==="Income"?incomeStreams:blModal.section==="Savings"?savingsStreams:expStreams}
          data={blModal.section==="Income"?baselineIncome:blModal.section==="Savings"?baselineSavings:baselineExp}
          fyStart={fyStart}
          monthIdx={monthIdx}
          totalMonths={totalMonths}
          onSave={d => saveBaseline(blModal.section, d)}
          onClose={()=>setBLModal(null)}
        />
      )}

      {/* Header */}
      <header className="app-header">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:17, fontWeight:600, color:T.accent }}>◈ Yo Cent-E
          {userName && <span style={{ fontFamily:"'DM Sans'", fontSize:12, fontWeight:400, color:T.sub, marginLeft:10 }}>· {userName}</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button className="month-btn" onClick={()=>setMonthIdx(Math.max(0,monthIdx-1))} aria-label="Previous month">‹</button>
          <MonthPicker monthIdx={monthIdx} totalMonths={totalMonths} onSelect={setMonthIdx}/>
          <button className="month-btn" onClick={()=>setMonthIdx(Math.min(totalMonths-1,monthIdx+1))} aria-label="Next month">›</button>
          {/* Reading the clock happens on the click, never during render.
              Clamped, so it still lands somewhere sensible if the real month
              falls outside the tracked timeline. */}
          <button className="btn btn-ghost btn-xs" title="Jump to the current month"
            onClick={()=>{
              setMonthIdx(Math.max(0, Math.min(monthIndexOf(calendar.epoch), totalMonths-1)));
              setViewEpoch(v => v + 1);
            }}>
            Today
          </button>
        </div>
        <div className="header-actions" style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCurrencyOpen(true)} title="Change currency" style={{ gap:5 }}>
            <span>{flagEmoji(currency.locale)}</span> {currency.code}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setFYSettingsOpen(true)} title={`Your ${yearNoun(fyStart)}, and how far the timeline runs`}>⚙ Year</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setImportState(null);setDataModalOpen(true);}} title="Back up or restore your data">⇅ Backup</button>
          <SaveStatus state={saveState} savedAt={savedAt} onSaveNow={saveNow}/>
        </div>
      </header>

      <div className="app-shell">
        {/* Sidebar */}
        <nav className="app-sidebar" aria-label="Sections">
          {navItems.map(n=>(
            <button key={n.key} className={`nav-item${page===n.key?" active":""}`} onClick={()=>setPage(n.key)}
              aria-current={page===n.key ? "page" : undefined}>
              <span aria-hidden="true" style={{ fontSize:14, width:18, textAlign:"center" }}>{n.icon}</span>{n.label}
            </button>
          ))}
          <div className="sidebar-meta" style={{ margin:"16px 6px 0", borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
            <div style={{ fontSize:10, color:T.sub, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:8, paddingLeft:8 }}>Settings</div>
            {fyStart !== 0 && <>
              <div style={{ fontSize:11, color:T.sub, padding:"3px 8px" }}>FY start: <span style={{ color:T.accent }}>{MONTH_NAMES[fyStart]}</span></div>
              <div style={{ fontSize:11, color:T.sub, padding:"3px 8px" }}>FY end: <span style={{ color:T.accent }}>{MONTH_NAMES[(fyStart+11)%12]}</span></div>
            </>}
            <div style={{ fontSize:11, color:T.sub, padding:"3px 8px" }}>Currency: <span style={{ color:T.accent }}>{flagEmoji(currency.locale)} {currency.code}</span></div>
            <div style={{ margin:"12px 6px 0", borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
              <div style={{ fontSize:10, color:T.sub, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:6, paddingLeft:2 }}>Categories</div>
              {[["Income",incomeStreams],["Savings",savingsStreams],["Exp.",expStreams]].map(([l,arr])=>(
                <div key={l} style={{ fontSize:11, color:T.sub, padding:"3px 2px", display:"flex", justifyContent:"space-between" }}>
                  <span>{l}</span><span style={{ color:T.sub }}>{arr.length}</span>
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* Main. Keyed on the page so switching away from a broken one clears
            the error, and scoped so the header and sidebar survive it. */}
        <main className="app-main">
          <ErrorBoundary key={page} scope="page" onDismiss={()=>setPage("dashboard")}>
          {page==="dashboard"&&<Dashboard monthIdx={monthIdx} viewEpoch={viewEpoch} fyStart={fyStart} totalMonths={totalMonths} incomeStreams={incomeStreams} savingsStreams={savingsStreams} expStreams={expStreams}
            baselineIncome={baselineIncome} baselineSavings={baselineSavings} baselineExp={baselineExp}
            incomeActual={incomeActual} savingsForecast={savingsForecast} savingsWeekly={savingsWeekly}
            expForecast={expForecast} expWeekly={expWeekly} onFYSettings={()=>setFYSettingsOpen(true)} savingsTypes={savingsTypes}
            netWorth={netWorth} netWorthAssets={netWorthAssets} moneyOwed={moneyOwed} onOpenPage={setPage}/>}

          {page==="income"&&<IncomePage monthIdx={monthIdx} viewEpoch={viewEpoch} fyStart={fyStart} totalMonths={totalMonths} streams={incomeStreams} setStreams={handleSetInc}
            baselineData={baselineIncome} actualData={incomeActual} onUpdate={updIncAct}
            onEditBaseline={openBaselineEditor} incomeNotes={incomeNotes} onUpdateIncomeNote={updIncomeNote}
            onFYSettings={()=>setFYSettingsOpen(true)}/>}

          {page==="savings"&&<SavingsPage monthIdx={monthIdx} viewEpoch={viewEpoch} fyStart={fyStart} totalMonths={totalMonths} streams={savingsStreams} setStreams={handleSetSav}
            baselineData={baselineSavings} forecastData={savingsForecast} weeklyData={savingsWeekly}
            onUpdateWeekly={updSavWk} onUpdateForecast={updSavFc} onEditBaseline={openBaselineEditor} savingsTypes={savingsTypes}
            onFYSettings={()=>setFYSettingsOpen(true)}/>}

          {page==="expenditure"&&<ExpenditurePage monthIdx={monthIdx} viewEpoch={viewEpoch} fyStart={fyStart} totalMonths={totalMonths} streams={expStreams} setStreams={handleSetExp}
            baselineData={baselineExp} forecastData={expForecast} weeklyData={expWeekly}
            onUpdateWeekly={updExpWk} onUpdateForecast={updExpFc} onEditBaseline={openBaselineEditor}
            expNotes={expNotes} onUpdateExpNote={updExpNote}
            onFYSettings={()=>setFYSettingsOpen(true)}/>}

          {page==="networth"&&<NetWorthPage netWorth={netWorth} assets={netWorthAssets} monthIdx={monthIdx}
            fyStart={fyStart} totalMonths={totalMonths}
            setAssets={(a,o)=>{setNetWorthAssets(a);setNetWorth(p=>applyStreams(p,a,o,"array"));}}
            onUpdate={(k,mi,v)=>setNetWorth(p=>{const arr=[...(p[k]||Array(MAX_MONTHS).fill(0))];arr[mi]=v;return{...p,[k]:arr};})}/>}
          {page==="moneyowed"&&<MoneyOwedPage rows={moneyOwed} onUpdate={setMoneyOwed}/>}
          {page==="baseline"&&<BaselinePage monthIdx={monthIdx} viewEpoch={viewEpoch} fyStart={fyStart} totalMonths={totalMonths}
            incomeStreams={incomeStreams} savingsStreams={savingsStreams} expStreams={expStreams}
            baselineIncome={baselineIncome} baselineSavings={baselineSavings} baselineExp={baselineExp}
            onEditBaseline={openBaselineEditor}/>}
          </ErrorBoundary>
        </main>
      </div>
    </div>
    </FormulaContext.Provider>
    </CalendarContext.Provider>
    </CurrencyContext.Provider>
  );
}
