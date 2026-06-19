import { useState, useEffect, useCallback, useMemo } from "react";
import { ComposedChart, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── CALENDAR ────────────────────────────────────────────────────────────────
// Pre-generate 120 months (10 years): Jan 2026 → Dec 2035
// totalMonths state controls how many are actually visible/navigable
const MAX_MONTHS = 120;
const MONTHS = [];
for (let i = 0; i < MAX_MONTHS; i++) {
  const d = new Date(2026, 0 + i, 1);
  MONTHS.push({
    label: d.toLocaleString("default", { month: "short", year: "numeric" }),
    short: d.toLocaleString("default", { month: "short" }),
    absMonth: (0 + i) % 12,           // 0=Jan … 11=Dec
    absYear: 2026 + Math.floor((0 + i) / 12),
    date: d,
  });
}
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKS = [1, 2, 3, 4, 5];

// ─── CURRENCIES ───────────────────────────────────────────────────────────────
const CURRENCIES = [
  {code:"GBP",name:"British Pound",symbol:"£",locale:"en-GB"},
  {code:"USD",name:"US Dollar",symbol:"$",locale:"en-US"},
  {code:"EUR",name:"Euro",symbol:"€",locale:"de-DE"},
  {code:"JPY",name:"Japanese Yen",symbol:"¥",locale:"ja-JP"},
  {code:"CAD",name:"Canadian Dollar",symbol:"CA$",locale:"en-CA"},
  {code:"AUD",name:"Australian Dollar",symbol:"A$",locale:"en-AU"},
  {code:"CHF",name:"Swiss Franc",symbol:"Fr",locale:"de-CH"},
  {code:"CNY",name:"Chinese Yuan",symbol:"¥",locale:"zh-CN"},
  {code:"HKD",name:"Hong Kong Dollar",symbol:"HK$",locale:"en-HK"},
  {code:"NZD",name:"New Zealand Dollar",symbol:"NZ$",locale:"en-NZ"},
  {code:"SEK",name:"Swedish Krona",symbol:"kr",locale:"sv-SE"},
  {code:"NOK",name:"Norwegian Krone",symbol:"kr",locale:"nb-NO"},
  {code:"DKK",name:"Danish Krone",symbol:"kr",locale:"da-DK"},
  {code:"SGD",name:"Singapore Dollar",symbol:"S$",locale:"en-SG"},
  {code:"KRW",name:"South Korean Won",symbol:"₩",locale:"ko-KR"},
  {code:"INR",name:"Indian Rupee",symbol:"₹",locale:"en-IN"},
  {code:"MXN",name:"Mexican Peso",symbol:"$",locale:"es-MX"},
  {code:"BRL",name:"Brazilian Real",symbol:"R$",locale:"pt-BR"},
  {code:"ZAR",name:"South African Rand",symbol:"R",locale:"en-ZA"},
  {code:"TRY",name:"Turkish Lira",symbol:"₺",locale:"tr-TR"},
  {code:"PLN",name:"Polish Złoty",symbol:"zł",locale:"pl-PL"},
  {code:"THB",name:"Thai Baht",symbol:"฿",locale:"th-TH"},
  {code:"MYR",name:"Malaysian Ringgit",symbol:"RM",locale:"ms-MY"},
  {code:"IDR",name:"Indonesian Rupiah",symbol:"Rp",locale:"id-ID"},
  {code:"PHP",name:"Philippine Peso",symbol:"₱",locale:"en-PH"},
  {code:"HUF",name:"Hungarian Forint",symbol:"Ft",locale:"hu-HU"},
  {code:"CZK",name:"Czech Koruna",symbol:"Kč",locale:"cs-CZ"},
  {code:"ILS",name:"Israeli Shekel",symbol:"₪",locale:"he-IL"},
  {code:"AED",name:"UAE Dirham",symbol:"د.إ",locale:"ar-AE"},
  {code:"SAR",name:"Saudi Riyal",symbol:"﷼",locale:"ar-SA"},
  {code:"KWD",name:"Kuwaiti Dinar",symbol:"KD",locale:"ar-KW"},
  {code:"QAR",name:"Qatari Riyal",symbol:"QR",locale:"ar-QA"},
  {code:"BHD",name:"Bahraini Dinar",symbol:"BD",locale:"ar-BH"},
  {code:"OMR",name:"Omani Rial",symbol:"OMR",locale:"ar-OM"},
  {code:"JOD",name:"Jordanian Dinar",symbol:"JD",locale:"ar-JO"},
  {code:"EGP",name:"Egyptian Pound",symbol:"E£",locale:"ar-EG"},
  {code:"MAD",name:"Moroccan Dirham",symbol:"MAD",locale:"ar-MA"},
  {code:"NGN",name:"Nigerian Naira",symbol:"₦",locale:"en-NG"},
  {code:"GHS",name:"Ghanaian Cedi",symbol:"₵",locale:"en-GH"},
  {code:"KES",name:"Kenyan Shilling",symbol:"Ksh",locale:"sw-KE"},
  {code:"UGX",name:"Ugandan Shilling",symbol:"USh",locale:"en-UG"},
  {code:"TZS",name:"Tanzanian Shilling",symbol:"TSh",locale:"sw-TZ"},
  {code:"ETB",name:"Ethiopian Birr",symbol:"Br",locale:"am-ET"},
  {code:"XOF",name:"W. African CFA Franc",symbol:"CFA",locale:"fr-SN"},
  {code:"XAF",name:"C. African CFA Franc",symbol:"FCFA",locale:"fr-CM"},
  {code:"PKR",name:"Pakistani Rupee",symbol:"₨",locale:"ur-PK"},
  {code:"BDT",name:"Bangladeshi Taka",symbol:"৳",locale:"bn-BD"},
  {code:"LKR",name:"Sri Lankan Rupee",symbol:"Rs",locale:"si-LK"},
  {code:"NPR",name:"Nepalese Rupee",symbol:"Rs",locale:"ne-NP"},
  {code:"VND",name:"Vietnamese Dong",symbol:"₫",locale:"vi-VN"},
  {code:"TWD",name:"New Taiwan Dollar",symbol:"NT$",locale:"zh-TW"},
  {code:"KHR",name:"Cambodian Riel",symbol:"៛",locale:"km-KH"},
  {code:"MMK",name:"Myanmar Kyat",symbol:"K",locale:"my-MM"},
  {code:"RUB",name:"Russian Ruble",symbol:"₽",locale:"ru-RU"},
  {code:"UAH",name:"Ukrainian Hryvnia",symbol:"₴",locale:"uk-UA"},
  {code:"KZT",name:"Kazakhstani Tenge",symbol:"₸",locale:"kk-KZ"},
  {code:"GEL",name:"Georgian Lari",symbol:"₾",locale:"ka-GE"},
  {code:"AMD",name:"Armenian Dram",symbol:"֏",locale:"hy-AM"},
  {code:"AZN",name:"Azerbaijani Manat",symbol:"₼",locale:"az-AZ"},
  {code:"UZS",name:"Uzbekistani Som",symbol:"soʻm",locale:"uz-UZ"},
  {code:"RON",name:"Romanian Leu",symbol:"lei",locale:"ro-RO"},
  {code:"BGN",name:"Bulgarian Lev",symbol:"лв",locale:"bg-BG"},
  {code:"RSD",name:"Serbian Dinar",symbol:"din",locale:"sr-RS"},
  {code:"HRK",name:"Croatian Kuna",symbol:"kn",locale:"hr-HR"},
  {code:"ISK",name:"Icelandic Krona",symbol:"kr",locale:"is-IS"},
  {code:"CLP",name:"Chilean Peso",symbol:"$",locale:"es-CL"},
  {code:"ARS",name:"Argentine Peso",symbol:"$",locale:"es-AR"},
  {code:"COP",name:"Colombian Peso",symbol:"$",locale:"es-CO"},
  {code:"PEN",name:"Peruvian Sol",symbol:"S/",locale:"es-PE"},
  {code:"BOB",name:"Bolivian Boliviano",symbol:"Bs",locale:"es-BO"},
  {code:"PYG",name:"Paraguayan Guaraní",symbol:"₲",locale:"es-PY"},
  {code:"UYU",name:"Uruguayan Peso",symbol:"$U",locale:"es-UY"},
  {code:"DZD",name:"Algerian Dinar",symbol:"DA",locale:"ar-DZ"},
  {code:"TND",name:"Tunisian Dinar",symbol:"DT",locale:"ar-TN"},
  {code:"LYD",name:"Libyan Dinar",symbol:"LD",locale:"ar-LY"},
];
// Derive flag emoji from locale country code (e.g. "en-GB" → 🇬🇧)
const flagEmoji = locale => {
  const cc = (locale.split("-")[1] || "").toUpperCase();
  if (cc.length !== 2) return "🌐";
  return String.fromCodePoint(...cc.split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
};
// Module-level currency — updated synchronously before each App render
let CURR = CURRENCIES[0]; // GBP default

// ─── FY HELPERS ───────────────────────────────────────────────────────────────
// fyStartMonth: 0=Jan, 1=Feb, … 3=Apr (default)
function getFYYear(monthIdx, fyStart) {
  const { absMonth, absYear } = MONTHS[monthIdx];
  return absMonth >= fyStart ? absYear : absYear - 1;
}
function getAllFYs(fyStart, totalMonths = MAX_MONTHS) {
  const map = {};
  for (let i = 0; i < totalMonths; i++) {
    const y = getFYYear(i, fyStart);
    if (!map[y]) map[y] = [];
    map[y].push(i);
  }
  return Object.entries(map)
    .sort((a, b) => +a[0] - +b[0])
    .map(([year, indices]) => ({ year: +year, indices }));
}
function fyLabel(year, fyStart) {
  if (fyStart === 3) return `FY ${year}/${String(year + 1).slice(2)}`;
  if (fyStart === 0) return `FY ${year}`;
  return `FY ${year}/${String(year + 1).slice(2)}`;
}
function getFYMonths(fyYear, fyStart, totalMonths = MAX_MONTHS) {
  return getAllFYs(fyStart, totalMonths).find(f => f.year === fyYear)?.indices || [];
}

// ─── HISTORICAL SEED DATA (Apr 2024 – Feb 2026 = indices 0‥22) ────────────
// (Historical seed data removed — public build starts blank)

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
// Seed weekly data from a monthly-total array (store in week 1)
const seedWeekly = (monthlyArr) => {
  const o = blankWeekly();
  monthlyArr.forEach((v, i) => { if (v !== 0) o[i][1] = v; });
  return o;
};
// Pad a historical array to MAX_MONTHS
const pad48 = (arr) => [...arr, ...Array(MAX_MONTHS - arr.length).fill(0)];

function buildSeedIncomeActual() { return {}; }
function buildSeedSavingsForecast() { return {}; }
function buildSeedSavingsWeekly() { return {}; }
function buildSeedExpForecast() { return {}; }
function buildSeedExpWeekly() { return {}; }

const weeklyTotal = (wd, s, mi) => {
  const w = wd?.[s]?.[mi]; if (!w) return 0;
  return WEEKS.reduce((a, k) => a + (w[k] || 0), 0);
};
const allStreamsWeekly = (streams, wd, mi) => streams.reduce((a, s) => a + weeklyTotal(wd, s, mi), 0);
const monthlyVal = (d, s, mi) => d?.[s]?.[mi] || 0;
const allMonthly = (streams, d, mi) => streams.reduce((a, s) => a + monthlyVal(d, s, mi), 0);

function ensureStreams(data, streams, type = "array") {
  const u = { ...data };
  streams.forEach(s => { if (!u[s]) u[s] = type === "array" ? Array(MAX_MONTHS).fill(0) : blankWeekly(); });
  return u;
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
async function load(key, fb) {
  try { const r = localStorage.getItem(key); return r != null ? JSON.parse(r) : fb; } catch { return fb; }
}
async function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg:"#0d1b2a", card:"#152236", border:"#1e3350", accent:"#d4a853",
  text:"#e8edf2", sub:"#7a92aa", success:"#52c47a", danger:"#f06464",
  warning:"#f5a623", inputBg:"#0a1520", blue:"#7eb3f5", modal:"#0d1b2ae0",
  purple:"#a87fd4",
};
const CC = ["#d4a853","#7eb3f5","#52c47a","#f5a623","#a87fd4","#5cc8d4","#f06464","#f5c842","#8093f1","#e07070","#7ab87a","#f09d6a","#c4d4a0","#a0c4d4"];
const fmt = v => typeof v==="number"&&!isNaN(v)?`${CURR.symbol}${Math.abs(v).toLocaleString(CURR.locale,{minimumFractionDigits:0,maximumFractionDigits:2})}`:"—";
const fmtS = v => { if(typeof v!=="number"||isNaN(v))return"—"; return(v>=0?"+":`−`)+`${CURR.symbol}${Math.abs(v).toLocaleString(CURR.locale,{minimumFractionDigits:0,maximumFractionDigits:2})}`; };

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.text};font-family:'DM Sans',sans-serif}
::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
input[type=number]{-moz-appearance:textfield} input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}
.fade{animation:fi .22s ease} @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.card{background:${T.card};border:1px solid ${T.border};border-radius:12px}
.nav-item{cursor:pointer;display:flex;align-items:center;gap:9px;padding:9px 14px;border-radius:8px;font-size:13px;font-weight:500;color:${T.sub};transition:all .18s}
.nav-item:hover{color:${T.text};background:${T.border}} .nav-item.active{color:${T.accent};background:rgba(212,168,83,.1)}
.btn{cursor:pointer;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-weight:500;font-size:13px;transition:all .18s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:${T.accent};color:#0d1b2a;padding:8px 18px} .btn-primary:hover{background:#e8c070;transform:translateY(-1px)}
.btn-ghost{background:transparent;border:1px solid ${T.border};color:${T.sub};padding:7px 14px} .btn-ghost:hover{border-color:${T.accent};color:${T.accent}}
.btn-sm{padding:5px 12px;font-size:12px} .btn-xs{padding:3px 8px;font-size:11px}
.btn-icon{background:transparent;border:none;cursor:pointer;color:${T.sub};padding:4px 6px;border-radius:4px;font-size:14px;transition:all .15s} .btn-icon:hover{color:${T.text};background:${T.border}}
.inp{background:${T.inputBg};border:1px solid ${T.border};color:${T.text};font-family:'DM Sans',sans-serif;font-size:13px;border-radius:6px;padding:6px 10px;transition:border-color .15s}
.inp:focus{outline:none;border-color:${T.accent};box-shadow:0 0 0 2px rgba(212,168,83,.1)}
.inp-num{width:80px;text-align:right;padding:5px 8px} .inp-sm{width:62px;text-align:right;padding:4px 6px;font-size:12px}
table{width:100%;border-collapse:collapse}
th{padding:8px 10px;text-align:right;font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:${T.sub};background:${T.bg};position:sticky;top:0;z-index:2;white-space:nowrap}
th:first-child{text-align:left}
td{padding:7px 10px;text-align:right;border-bottom:1px solid rgba(30,51,80,.7);font-size:13px;vertical-align:middle}
td:first-child{text-align:left;color:${T.text};font-weight:500}
tr:last-child td{border-bottom:none}
.total-row td{border-top:1px solid ${T.border};font-weight:700;color:${T.accent};background:rgba(212,168,83,.04)}
.vpos{color:${T.success};font-weight:500} .vneg{color:${T.danger};font-weight:500}
.month-btn{background:transparent;border:1px solid ${T.border};color:${T.sub};width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.month-btn:hover{border-color:${T.accent};color:${T.accent}}
.modal-bg{position:fixed;inset:0;background:${T.modal};backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center}
.modal{background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:28px;width:480px;max-width:96vw;max-height:90vh;overflow-y:auto}
.modal-wide{width:820px}
.sl{font-size:11px;color:${T.sub};text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.wtab{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid ${T.border};color:${T.sub};background:transparent;transition:all .15s}
.wtab.active{background:rgba(212,168,83,.12);border-color:${T.accent};color:${T.accent}}
.stat-card{background:${T.card};border:1px solid ${T.border};border-radius:12px;padding:18px 20px;flex:1;min-width:140px}
.fy-tab{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid ${T.border};color:${T.sub};background:transparent;transition:all .15s;white-space:nowrap}
.fy-tab.active{background:rgba(212,168,83,.15);border-color:${T.accent};color:${T.accent};font-weight:600}
.view-toggle{display:flex;background:${T.inputBg};border:1px solid ${T.border};border-radius:8px;padding:3px;gap:2px}
.vt-btn{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:${T.sub};transition:all .15s}
.vt-btn.active{background:${T.card};color:${T.accent};box-shadow:0 1px 4px rgba(0,0,0,.3)}
.bl-cell{width:68px;text-align:right;background:${T.inputBg};border:1px solid transparent;color:${T.text};font-size:12px;border-radius:4px;padding:3px 6px;transition:border-color .15s}
.bl-cell:focus{outline:none;border-color:${T.accent}}
`;

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

// ─── REUSABLE ATOMS ───────────────────────────────────────────────────────────
function NumInput({ value, onChange, className = "inp inp-num", disabled }) {
  const [raw, setRaw]       = useState(value != null && value !== 0 ? String(value) : "");
  const [focused, setFocus] = useState(false);

  // Sync external value changes when not actively editing
  useEffect(() => {
    if (!focused) setRaw(value != null && value !== 0 ? String(value) : "");
  }, [value, focused]);

  const formula = isFormula(raw);
  const result  = formula ? evalExpr(raw) : null;
  const valid   = result !== null;

  const commit = () => {
    setFocus(false);
    let v;
    if (formula && valid) {
      v = result;
      setRaw(String(v === 0 ? "" : v));
    } else {
      v = parseFloat(raw) || 0;
      setRaw(v === 0 ? "" : String(v));
    }
    onChange(v);
  };

  const borderColor = focused && formula
    ? (valid ? T.accent : T.danger)
    : undefined;

  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <input
        type="text"
        className={className}
        value={raw}
        disabled={disabled}
        onChange={e => setRaw(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } }}
        style={{
          ...(disabled ? { opacity:.35, cursor:"not-allowed" } : {}),
          ...(borderColor ? { borderColor, boxShadow:`0 0 0 2px ${borderColor}22` } : {}),
          fontFamily:"'DM Sans',sans-serif",
        }}
      />
      {/* Live preview bubble */}
      {focused && formula && (
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
            : <span>✕ invalid</span>}
        </div>
      )}
    </div>
  );
}

// Compact formula-aware cell for the baseline editor grid
function FormulaCell({ value, onCommit, placeholder, style }) {
  const [raw, setRaw]       = useState(value != null && value !== "" && value !== 0 ? String(value) : "");
  const [focused, setFocus] = useState(false);
  useEffect(() => { if (!focused) setRaw(value != null && value !== "" && value !== 0 ? String(value) : ""); }, [value, focused]);

  const formula = isFormula(raw);
  const result  = formula ? evalExpr(raw) : null;
  const valid   = result !== null;

  const commit = () => {
    setFocus(false);
    let v;
    if (formula && valid) { v = result; setRaw(v ? String(v) : ""); }
    else { v = parseFloat(raw) || 0; setRaw(v ? String(v) : ""); }
    onCommit(v);
  };

  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <input className="bl-cell" type="text" value={raw} placeholder={placeholder || ""}
        style={{ ...style, ...(focused && formula ? { borderColor: valid ? T.accent : T.danger } : {}) }}
        onChange={e => setRaw(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }} />
      {focused && formula && (
        <div style={{
          position:"absolute", bottom:"calc(100% + 4px)", right:0, zIndex:60,
          background:T.card, border:`1px solid ${valid ? T.accent : T.danger}`,
          borderRadius:5, padding:"3px 8px", fontSize:11, whiteSpace:"nowrap",
          color: valid ? T.accent : T.danger, pointerEvents:"none",
          boxShadow:"0 2px 8px rgba(0,0,0,.45)",
        }}>
          {valid ? <>= <strong>{result}</strong></> : "✕ invalid"}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, delta, posGood = true }) {
  const good = posGood ? T.success : T.danger, bad = posGood ? T.danger : T.success;
  return (
    <div className="stat-card">
      <div style={{ fontSize:20, marginBottom:5 }}>{icon}</div>
      <div className="sl" style={{ marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display'", fontSize:22, fontWeight:600, color:T.accent }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:T.sub, marginTop:3 }}>{sub}</div>}
      {delta !== undefined && <div style={{ fontSize:12, color:delta >= 0 ? good : bad, marginTop:4 }}>{fmtS(delta)} vs baseline</div>}
    </div>
  );
}

function BudgetBar({ label, actual, budget, color = T.accent }) {
  const pct = budget > 0 ? (actual/budget)*100 : 0, over = actual > budget;
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:12, color:T.sub }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:500, color:over?T.danger:T.text }}>
          {fmt(actual)} <span style={{ color:T.sub, fontWeight:400 }}>/ {fmt(budget)}</span>
        </span>
      </div>
      <div style={{ height:5, background:T.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:over?T.danger:color, borderRadius:3, transition:"width .4s" }} />
      </div>
    </div>
  );
}

// ─── FY TOOLBAR ───────────────────────────────────────────────────────────────
function FYToolbar({ fyStart, monthIdx, totalMonths = 48, selectedFY, onSelectFY, viewMode, onViewMode, onSettings }) {
  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [fyStart, totalMonths]);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:18, padding:"10px 14px", background:T.inputBg, borderRadius:10, border:`1px solid ${T.border}` }}>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", flex:1 }}>
        {fys.map(f => (
          <button key={f.year} className={`fy-tab${selectedFY === f.year ? " active" : ""}`} onClick={() => onSelectFY(f.year)}>
            {fyLabel(f.year, fyStart)}
          </button>
        ))}
      </div>
      <div className="view-toggle">
        <button className={`vt-btn${viewMode === "month" ? " active" : ""}`} onClick={() => onViewMode("month")}>Monthly</button>
        <button className={`vt-btn${viewMode === "fy" ? " active" : ""}`} onClick={() => onViewMode("fy")}>FY View</button>
      </div>
      <button className="btn btn-ghost btn-xs" onClick={onSettings} title="Configure financial year">⚙ FY</button>
    </div>
  );
}

// ─── FY SETTINGS MODAL ───────────────────────────────────────────────────────
function FYSettingsModal({ fyStart, totalMonths, onSave, onClose }) {
  const [s, setS] = useState(fyStart);
  const [tm, setTm] = useState(totalMonths);

  const fys = useMemo(() => getAllFYs(s, tm), [s, tm]);
  const firstFY = fys[0];
  const lastFY = fys[fys.length - 1];
  const firstMonth = MONTHS[0];
  const lastMonth = MONTHS[tm - 1];
  const canExtend = tm + 12 <= MAX_MONTHS;

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:16 }}>Financial Year Settings</div>

        {/* FY Start Month */}
        <div className="sl" style={{ marginBottom:10 }}>FY Start Month</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
          {MONTH_NAMES.map((m, i) => (
            <button key={i} className={`btn ${s===i ? "btn-primary" : "btn-ghost"} btn-sm`} style={{ justifyContent:"center" }} onClick={() => setS(i)}>
              {m}
            </button>
          ))}
        </div>
        <div style={{ padding:"10px 14px", background:"rgba(212,168,83,.06)", borderRadius:8, border:`1px solid rgba(212,168,83,.2)`, fontSize:12, color:T.sub, marginBottom:22 }}>
          FY runs <strong style={{ color:T.accent }}>{MONTH_NAMES[s]}</strong> → <strong style={{ color:T.accent }}>{MONTH_NAMES[(s+11)%12]}</strong>
          {s === 3 && <span style={{ color:T.success, marginLeft:8 }}>✓ UK Tax Year default</span>}
        </div>

        {/* Extend Timeline */}
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:18, marginBottom:18 }}>
          <div className="sl" style={{ marginBottom:10 }}>Timeline Range</div>
          <div style={{ fontSize:13, color:T.sub, marginBottom:14 }}>
            Currently tracking <strong style={{ color:T.text }}>{fys.length} financial years</strong> — {firstMonth?.label} through {lastMonth?.label}.
            Add future years as you go.
          </div>

          {/* FY chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {fys.map(f => (
              <div key={f.year} style={{ padding:"4px 12px", borderRadius:6, fontSize:12, fontWeight:500,
                background: f === lastFY ? "rgba(212,168,83,.15)" : "rgba(255,255,255,.04)",
                border:`1px solid ${f === lastFY ? T.accent : T.border}`,
                color: f === lastFY ? T.accent : T.sub }}>
                {fyLabel(f.year, s)}
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
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(current.code);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? CURRENCIES.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol.includes(q)) : CURRENCIES;
  }, [search]);
  const chosen = CURRENCIES.find(c => c.code === sel) || CURRENCIES[0];
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width:560 }}>
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
                <span style={{ fontSize:20, lineHeight:1 }}>{flagEmoji(c.locale)}</span>
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
function CategoryModal({ title, streams, onSave, onClose }) {
  const [list, setList] = useState([...streams]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState({});
  const add = () => { const n = newName.trim(); if (!n || list.includes(n)) return; setList([...list, n]); setNewName(""); };
  const remove = s => setList(list.filter(x => x !== s));
  const rename = (old, nv) => {
    if (!nv.trim() || (list.includes(nv.trim()) && nv.trim() !== old)) return;
    setList(list.map(x => x === old ? nv.trim() : x));
    setEditing(e => { const c={...e}; delete c[old]; return c; });
  };
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ fontFamily:"'Playfair Display'", fontSize:18, fontWeight:600, marginBottom:18 }}>Manage {title} Categories</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20, maxHeight:300, overflowY:"auto" }}>
          {list.map(s => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:8 }}>
              {editing[s] !== undefined ? (
                <><input className="inp" value={editing[s]} autoFocus style={{ flex:1 }}
                    onChange={e => setEditing(p => ({...p,[s]:e.target.value}))}
                    onKeyDown={e => { if(e.key==="Enter")rename(s,editing[s]); if(e.key==="Escape")setEditing(p=>{const c={...p};delete c[s];return c;}); }} />
                  <button className="btn btn-primary btn-sm" onClick={() => rename(s, editing[s])}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p=>{const c={...p};delete c[s];return c;})}>✕</button></>
              ) : (
                <><span style={{ flex:1, fontSize:13 }}>{s}</span>
                  <button className="btn-icon" onClick={() => setEditing(p=>({...p,[s]:s}))}>✎</button>
                  <button className="btn-icon" style={{ color:T.danger }} onClick={() => remove(s)}>✕</button></>
              )}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          <input className="inp" style={{ flex:1 }} placeholder="New category…" value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter"&&add()} />
          <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(list)}>Apply</button>
        </div>
      </div>
    </div>
  );
}

// ─── BASELINE EDITOR ─────────────────────────────────────────────────────────
function BaselineEditorModal({ section, streams, data, fyStart, totalMonths, onSave, onClose }) {
  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [fyStart, totalMonths]);
  const [selFY, setSelFY] = useState(fys[0]?.year);
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
  const fillAllStreams = (mi, val) => {
    setDraft(prev => {
      const next = { ...prev };
      streams.forEach(s => {
        const arr = [...(next[s] || Array(MAX_MONTHS).fill(0))];
        arr[mi] = parseFloat(val) || 0;
        next[s] = arr;
      });
      return next;
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
      <div className="modal modal-wide">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:17, fontWeight:600 }}>Edit {section} Baselines</div>
          <div style={{ display:"flex", gap:6 }}>
            {fys.map(f => <button key={f.year} className={`fy-tab${selFY===f.year?" active":""}`} onClick={() => setSelFY(f.year)}>{fyLabel(f.year, fyStart)}</button>)}
          </div>
        </div>
        <div style={{ fontSize:12, color:T.sub, marginBottom:14 }}>
          Baselines are typically set each March after pay review. Enter monthly values for each category in the selected FY.
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={copyFromPrev}>↩ Copy from prev FY</button>
          <div style={{ marginLeft:"auto", fontSize:11, color:T.sub, alignSelf:"center" }}>
            💡 Formulas supported — e.g. <span style={{ color:T.accent, fontFamily:"monospace" }}>45+32+73</span> or <span style={{ color:T.accent, fontFamily:"monospace" }}>(120+80)*0.5</span>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width:160 }}>Category</th>
                <th style={{ color:T.warning, fontSize:10 }}>Fill All →</th>
                {fyMonths.map(mi => <th key={mi} style={{ fontSize:11 }}>{MONTHS[mi]?.short}</th>)}
                <th style={{ color:T.accent }}>FY Total</th>
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
                          onCommit={v => update(s, mi, v)} />
                      </td>
                    ))}
                    <td style={{ color:T.accent, fontWeight:600, fontSize:12 }}>{fmt(fyTotal)}</td>
                  </tr>
                );
              })}
              <tr className="total-row">
                <td>FY Total</td>
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
function GaugeDial({ label, actual, target, color, sub, icon }) {
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
        <text x={110} y={136} textAnchor="middle" fill={T.sub} fontSize={10} fontFamily="DM Sans">of {fmt(target)} target</text>
      </svg>
      <div style={{ fontFamily:"'Playfair Display'", fontSize:14, fontWeight:600, marginTop:-4 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:T.sub, marginTop:2, textAlign:"center", maxWidth:200 }}>{sub}</div>}
    </div>
  );
}

// ─── COMBO CHART (bar + cumulative line + projection) ────────────────────────
function AnnotatedTooltip({ active, payload, label }) {
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

function ComboChart({ title, streams, weeklyData, forecastData, baselineData, fyMonths, color, type }) {
  const [sel, setSel] = useState(streams);
  useEffect(() => setSel(prev => {
    const valid = prev.filter(s => streams.includes(s));
    const added = streams.filter(s => !prev.includes(s));
    return [...valid, ...added];
  }), [streams]);
  const [picker, setPicker] = useState(false);

  let cb=0,cf=0,ca=0,runP=0, lastActIdx=-1;
  const raw = fyMonths.map(mi => {
    const baseline = sel.reduce((a,s)=>a+(baselineData[s]?.[mi]||0),0);
    const forecast = sel.reduce((a,s)=>a+(forecastData[s]?.[mi]||0),0);
    const actual   = sel.reduce((a,s)=>a+weeklyTotal(weeklyData,s,mi),0);
    const hasAct   = actual > 0;
    cb+=baseline; cf+=forecast; if(hasAct){ca+=actual; lastActIdx=mi;}
    return { name:MONTHS[mi]?.short, mi, baseline, forecast,
      actual:actual, cumBaseline:cb, cumForecast:cf, cumActual:hasAct||ca>0?ca:null };
  });

  const monthsWithData = raw.filter(d=>d.actual>0);
  const avgMonthly = monthsWithData.length>1 ? monthsWithData.reduce((a,d)=>a+d.actual,0)/monthsWithData.length : 0;
  let rp = monthsWithData.length>0 ? monthsWithData[monthsWithData.length-1].cumActual : 0;
  const data = raw.map((d,i)=>{
    let projection = null;
    if(lastActIdx>=0 && avgMonthly>0){
      if(d.mi===lastActIdx) projection = d.cumActual;
      else if(d.mi>lastActIdx){ rp+=avgMonthly; projection=rp; }
    }
    return {...d, projection};
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
          <div style={{ position:"relative" }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setPicker(p=>!p)}>⊞ {sel.length}/{streams.length}</button>
            {picker&&(
              <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:14, zIndex:50, minWidth:190, maxHeight:250, overflowY:"auto", boxShadow:"0 8px 24px rgba(0,0,0,.4)" }}>
                <div className="sl" style={{ marginBottom:8 }}>Included categories</div>
                {streams.map(s=>(
                  <label key={s} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 2px", cursor:"pointer", fontSize:13 }}>
                    <input type="checkbox" checked={sel.includes(s)} onChange={()=>setSel(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s])} style={{ accentColor:color }}/>
                    {s}
                  </label>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ marginTop:10, width:"100%" }} onClick={()=>setPicker(false)}>Done</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:12, margin:"10px 0", flexWrap:"wrap" }}>
        {[{k:"baseline",l:"Baseline",t:"bar",c:BC.baseline},{k:"forecast",l:"Forecast",t:"bar",c:BC.forecast},{k:"actual",l:"Actual",t:"bar",c:BC.actual},
          {k:"cumBaseline",l:"Cum. Baseline",t:"line",c:LC.cumBaseline,d:true},{k:"cumForecast",l:"Cum. Forecast",t:"line",c:LC.cumForecast},{k:"cumActual",l:"Cum. Actual",t:"line",c:LC.cumActual},
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
          <YAxis yAxisId="m" orientation="left" tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`£${(v/1000).toFixed(0)}k`} width={40}/>
          <YAxis yAxisId="c" orientation="right" tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`£${(v/1000).toFixed(0)}k`} width={40}/>
          <Tooltip content={<AnnotatedTooltip/>}/>
          <Bar yAxisId="m" dataKey="baseline" name="Baseline" fill={BC.baseline} radius={[3,3,0,0]} barSize={8}/>
          <Bar yAxisId="m" dataKey="forecast" name="Forecast" fill={BC.forecast} radius={[3,3,0,0]} barSize={8}/>
          <Bar yAxisId="m" dataKey="actual" name="Actual" fill={BC.actual} radius={[3,3,0,0]} barSize={8}/>
          <Line yAxisId="c" type="monotone" dataKey="cumBaseline" name="Cum. Baseline" stroke={LC.cumBaseline} strokeWidth={1.5} dot={false} strokeDasharray="5 4" connectNulls/>
          <Line yAxisId="c" type="monotone" dataKey="cumForecast" name="Cum. Forecast" stroke={LC.cumForecast} strokeWidth={1.5} dot={false} connectNulls/>
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
function FYSummaryTable({ streams, fyMonths, baselineData, forecastData, weeklyData, incomeActual, type }) {
  const isWeekly = !!weeklyData;
  const getVal = (s, mi) => isWeekly ? weeklyTotal(weeklyData, s, mi) : monthlyVal(incomeActual, s, mi);
  const getFc   = (s, mi) => monthlyVal(forecastData, s, mi);
  const getBl   = (s, mi) => monthlyVal(baselineData, s, mi);
  const good = type === "savings";

  return (
    <div style={{ overflowX:"auto" }}>
      <table>
        <thead>
          <tr>
            <th style={{ width:150 }}>Category</th>
            {fyMonths.map(mi=><th key={mi} style={{ fontSize:10 }}>{MONTHS[mi]?.short}</th>)}
            <th style={{ color:T.accent }}>FY Total</th>
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
  const [activeWeek, setActiveWeek] = useState(1);
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
  const hasAnyNote = (s) => WEEKS.some(w => hasNote(s, w));

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
                      <NumInput value={forecast} className="inp inp-num" onChange={v => onUpdateForecast(s, monthIdx, v)} />
                    </td>
                    <td style={{ color }}>
                      {WEEKS.some(w=>weeklyData?.[s]?.[monthIdx]?.[w]>0)
                        ? <span style={{ fontWeight:600 }}>{fmt(actual)}</span>
                        : <NumInput value={actual} onChange={v => onUpdateWeekly(s,monthIdx,1,v)} />}
                    </td>
                    <td><span className={good?(vb>=0?"vpos":"vneg"):(vb<=0?"vpos":"vneg")} style={{ fontSize:12 }}>{fmtS(vb)}</span></td>
                    <td><span className={good?(vf>=0?"vpos":"vneg"):(vf<=0?"vpos":"vneg")} style={{ fontSize:12 }}>{fmtS(vf)}</span></td>
                    {showNotes && (
                      <td style={{ textAlign:"center" }}>
                        {noteCount > 0
                          ? <span style={{ fontSize:11, color:T.accent, cursor:"default" }} title={WEEKS.filter(w=>hasNote(s,w)).map(w=>`Wk${w}: ${getNote(s,w)}`).join("\n")}>
                              📝 {noteCount}
                            </span>
                          : <span style={{ fontSize:11, color:T.border }}>—</span>}
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
                    <td><NumInput value={tw} onChange={v=>onUpdateWeekly(s,monthIdx,activeWeek,v)} /></td>
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
                              {note || <span style={{ color:T.border }}>+ Add note</span>}
                            </button>
                          )}
                          {note && !isExpanded && (
                            <button className="btn-icon" style={{ color:T.border, fontSize:12 }}
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
function SankeyDiagram({ incomeStreams, savingsStreams, expStreams, incomeActual, savingsWeekly, expWeekly, monthIdx, fyMonths, viewMode }) {
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
    ...savingsStreams.map(s => ({ name:s, value:getSav(s), color: s.toLowerCase().includes("invest") ? T.blue : T.success })),
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

  // Layout dest nodes scaled proportionally
  let dy = 0;
  const dstLayout = dstNodes.map(n => {
    const h = Math.max(10, (n.value / totalIncome) * (H - (dstNodes.length - 1) * gapY));
    const node = { ...n, x:dstX, y:dy, h };
    dy += h + gapY;
    return node;
  });

  // One flow per destination — all originate from the single source bar
  let srcOff = 0;
  const flows = dstLayout.map(dst => {
    const fh = Math.max(1, (dst.value / totalIncome) * srcH);
    const flow = { dst, y1:srcOff, y2:dst.y, fh };
    srcOff += fh;
    return flow;
  });

  const bezier = (y1, y2, fh) => {
    const mx = (srcX + dstX) / 2;
    return `M${srcX+nodeW} ${y1} C${mx} ${y1},${mx} ${y2},${dstX} ${y2} L${dstX} ${y2+fh} C${mx} ${y2+fh},${mx} ${y1+fh},${srcX+nodeW} ${y1+fh} Z`;
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
          <path key={i} d={bezier(f.y1, f.y2, f.fh)}
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

        {/* Dest nodes + labels */}
        {dstLayout.map(n => (
          <g key={n.name}>
            <rect x={n.x} y={n.y} width={nodeW} height={n.h} fill={n.color} rx={2}/>
            <text x={n.x + nodeW + 10} y={n.y + n.h/2 - (n.h > 20 ? 6 : 0)}
              textAnchor="start" fontSize={11} fontWeight="600" fill={T.text} fontFamily="'DM Sans'">
              {trunc(n.name, 20)}
            </text>
            {n.h > 16 && (
              <text x={n.x + nodeW + 10} y={n.y + n.h/2 + 9}
                textAnchor="start" fontSize={10} fill={T.sub} fontFamily="'DM Sans'">
                {fmt(n.value)} · {Math.round(n.value / totalIncome * 100)}%
              </text>
            )}
          </g>
        ))}

        {/* Hover tooltip */}
        {hf && (
          <text x={W/2} y={-10} textAnchor="middle" fontSize={11} fill={T.accent} fontFamily="'DM Sans'" fontWeight="600">
            {hf.dst.name}: {fmt(hf.dst.value)} — {Math.round(hf.dst.value / totalIncome * 100)}% of income
          </text>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:10, paddingLeft:PAD_L }}>
        {[{label:"Income",color:T.accent},{label:"Savings",color:T.success},{label:"Investments",color:T.blue},{label:"Expenditure",color:"#f06464"},{label:"Unallocated",color:T.sub}]
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

function Dashboard({ monthIdx, fyStart, totalMonths, incomeStreams, savingsStreams, expStreams,
  baselineIncome, baselineSavings, baselineExp, incomeActual, savingsForecast, savingsWeekly, expForecast, expWeekly,
  onFYSettings }) {

  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [fyStart, totalMonths]);
  const [selFY, setSelFY] = useState(() => getFYYear(monthIdx, fyStart));
  const [viewMode, setViewMode] = useState("month");
  const [fySettingsOpen, setFYSettingsOpen] = useState(false);

  useEffect(() => setSelFY(getFYYear(monthIdx, fyStart)), [monthIdx, fyStart]);

  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);
  const fyIdxs = viewMode === "fy" ? fyMonths : [monthIdx];

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

  // YTD Gauge data
  const investStreams = savingsStreams.filter(s => s.toLowerCase().includes("investment"));
  const pureStreams   = savingsStreams.filter(s => !s.toLowerCase().includes("investment"));
  const ytd = fyMonths.filter(mi => mi <= monthIdx);
  const savYTD  = ytd.reduce((a,mi)=>a+allStreamsWeekly(pureStreams,savingsWeekly,mi),0);
  const invYTD  = ytd.reduce((a,mi)=>a+allStreamsWeekly(investStreams,savingsWeekly,mi),0);
  const savTgt  = fyMonths.reduce((a,mi)=>a+allMonthly(pureStreams,baselineSavings,mi),0);
  const invTgt  = fyMonths.reduce((a,mi)=>a+allMonthly(investStreams,baselineSavings,mi),0);
  const frac    = fyMonths.length > 0 ? ytd.length / fyMonths.length : 0;

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Dashboard</div>
      </div>

      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={() => onFYSettings()} />

      {/* Stat Cards */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <StatCard icon="💰" label={viewMode==="fy"?"FY Income":"Income"} value={fmt(viewMode==="fy"?fyMonths.reduce((a,mi)=>a+allMonthly(incomeStreams,incomeActual,mi),0):actInc)} delta={viewMode==="fy"?undefined:actInc-basInc}/>
        <StatCard icon="🏦" label={viewMode==="fy"?"FY Saved":"Total Saved"}
          value={fmt(viewMode==="fy"?fyActSav:actSav)}
          sub={`Baseline: ${fmt(viewMode==="fy"?fyBasSav:basSav)} · Forecast: ${fmt(viewMode==="fy"?fyFcSav:fcSav)}`}
          delta={viewMode==="fy"?undefined:actSav-fcSav}/>
        <StatCard icon="🧾" label={viewMode==="fy"?"FY Spent":"Total Spent"}
          value={fmt(viewMode==="fy"?fyActExp:actExp)}
          sub={`Baseline: ${fmt(viewMode==="fy"?fyBasExp:basExp)} · Forecast: ${fmt(viewMode==="fy"?fyFcExp:fcExp)}`}
          delta={viewMode==="fy"?undefined:actExp-fcExp} posGood={false}/>
        <StatCard icon="✅" label="Net Remaining" value={fmt(actInc-actSav-actExp)} sub="After savings & spend"/>
      </div>

      {/* Gauge Dials */}
      <div className="card" style={{ padding:20, marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:15, fontWeight:600, marginBottom:4 }}>Year-to-Date Progress</div>
        <div style={{ fontSize:11, color:T.sub, marginBottom:18 }}>{Math.round(frac*100)}% through {fyLabel(selFY, fyStart)} · Measured against full annual baseline target</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", borderRight:`1px solid ${T.border}`, paddingRight:16 }}>
            <GaugeDial label="Savings" icon="🏦" actual={savYTD} target={savTgt} color={T.success} sub={pureStreams.join(" · ")||"No pure savings streams"}/>
            <div style={{ display:"flex", gap:18, marginTop:6, fontSize:12 }}>
              <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>YTD Actual</div><div style={{ fontWeight:700,color:T.success }}>{fmt(savYTD)}</div></div>
              <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>Annual Target</div><div style={{ fontWeight:700 }}>{fmt(savTgt)}</div></div>
              <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>Remaining</div><div style={{ fontWeight:700,color:savTgt-savYTD>0?T.warning:T.success }}>{fmt(Math.max(0,savTgt-savYTD))}</div></div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingLeft:16 }}>
            <GaugeDial label="Investments" icon="📈" actual={invYTD} target={invTgt} color={T.blue} sub={investStreams.join(" · ")||"Add 'Investment' to stream names"}/>
            <div style={{ display:"flex", gap:18, marginTop:6, fontSize:12 }}>
              <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>YTD Actual</div><div style={{ fontWeight:700,color:T.blue }}>{fmt(invYTD)}</div></div>
              <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>Annual Target</div><div style={{ fontWeight:700 }}>{fmt(invTgt)}</div></div>
              <div style={{ textAlign:"center" }}><div style={{ color:T.sub,fontSize:10,textTransform:"uppercase",letterSpacing:".06em" }}>Remaining</div><div style={{ fontWeight:700,color:invTgt-invYTD>0?T.warning:T.success }}>{fmt(Math.max(0,invTgt-invYTD))}</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Combo Charts */}
      <div style={{ marginBottom:16 }}>
        <ComboChart title="Savings — Monthly vs Cumulative" streams={savingsStreams} weeklyData={savingsWeekly}
          forecastData={savingsForecast} baselineData={baselineSavings} fyMonths={fyMonths} color={T.success} type="savings"/>
      </div>
      <ComboChart title="Expenditure — Monthly vs Cumulative" streams={expStreams} weeklyData={expWeekly}
        forecastData={expForecast} baselineData={baselineExp} fyMonths={fyMonths} color={T.danger} type="expenditure"/>

      {/* Income Flow Sankey */}
      <div className="card" style={{ padding:20, marginTop:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
          <div style={{ fontFamily:"'Playfair Display'", fontSize:15, fontWeight:600 }}>Income Distribution</div>
          <div style={{ fontSize:11, color:T.sub }}>{viewMode==="fy" ? fyLabel(selFY, fyStart) : MONTHS[monthIdx]?.label} · hover a flow to inspect</div>
        </div>
        <div style={{ fontSize:12, color:T.sub, marginBottom:16 }}>Where your income is being distributed across savings, investments and expenditure categories.</div>
        <SankeyDiagram
          incomeStreams={incomeStreams} savingsStreams={savingsStreams} expStreams={expStreams}
          incomeActual={incomeActual} savingsWeekly={savingsWeekly} expWeekly={expWeekly}
          monthIdx={monthIdx} fyMonths={fyMonths} viewMode={viewMode}/>
      </div>
    </div>
  );
}

function IncomePage({ monthIdx, fyStart, totalMonths, streams, setStreams, baselineData, actualData, onUpdate, onEditBaseline, incomeNotes, onUpdateIncomeNote }) {
  const [catModal, setCatModal] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [selFY, setSelFY] = useState(() => getFYYear(monthIdx, fyStart));
  const [fySettingsOpen, setFYSettingsOpen] = useState(false);
  const [expandedNote, setExpandedNote] = useState(null);
  useEffect(()=>setSelFY(getFYYear(monthIdx,fyStart)),[monthIdx,fyStart]);
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
      {catModal && <CategoryModal title="Income" streams={streams} onSave={s=>{setStreams(s);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}

      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={()=>setFYSettingsOpen(true)}/>

      {viewMode === "fy" ? (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{fyLabel(selFY,fyStart)} — All Months (Actual Income)</div>
            <FYSummaryTable streams={streams} fyMonths={fyMonths} baselineData={baselineData}
              forecastData={baselineData} incomeActual={actualData} type="income"/>
          </div>
          {/* Extra Income notes in FY view */}
          {streams.filter(s => s.toLowerCase().includes("extra") || s.toLowerCase().includes("other")).length > 0 && (
            <div className="card" style={{ padding:20 }}>
              <div className="sl" style={{ marginBottom:14 }}>Extra Income — Monthly Notes</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {streams.filter(s => s.toLowerCase().includes("extra") || s.toLowerCase().includes("other")).map(s =>
                  fyMonths.filter(mi => monthlyVal(actualData,s,mi) > 0).map(mi => {
                    const note = getNote(s, mi);
                    return (
                      <div key={`${s}-${mi}`} style={{ display:"flex", alignItems:"baseline", gap:10, padding:"8px 12px", background:T.inputBg, borderRadius:8 }}>
                        <span style={{ fontSize:12, color:T.sub, minWidth:72 }}>{MONTHS[mi]?.short}</span>
                        <span style={{ fontSize:13, color:T.success, fontWeight:600, minWidth:68 }}>{fmt(monthlyVal(actualData,s,mi))}</span>
                        <span style={{ fontSize:12, color:T.sub, flex:1 }}>{note || <em style={{ color:T.border }}>No note</em>}</span>
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
                    <td><NumInput value={a} onChange={v=>onUpdate(s,monthIdx,v)}/></td>
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
                            {note || <span style={{ color:T.border }}>+ Add tag</span>}
                          </button>
                          {note && (
                            <button className="btn-icon" style={{ color:T.border, fontSize:12 }}
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
    </div>
  );
}

function SavingsPage({ monthIdx, fyStart, totalMonths, streams, setStreams, baselineData, forecastData, weeklyData,
  onUpdateWeekly, onUpdateForecast, onEditBaseline }) {
  const [catModal, setCatModal] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [selFY, setSelFY] = useState(() => getFYYear(monthIdx, fyStart));
  useEffect(()=>setSelFY(getFYYear(monthIdx,fyStart)),[monthIdx,fyStart]);
  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Savings</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => onEditBaseline("Savings", streams, baselineData)}>✎ Edit Baselines</button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCatModal(true)}>⊞ Categories</button>
        </div>
      </div>
      {catModal && <CategoryModal title="Savings" streams={streams} onSave={s=>{setStreams(s);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}
      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={()=>{}}/>

      {viewMode === "fy" ? (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Actual Savings</div>
            <FYSummaryTable streams={streams} fyMonths={fyMonths} baselineData={baselineData}
              forecastData={forecastData} weeklyData={weeklyData} type="savings"/>
          </div>
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontFamily:"'Playfair Display'", fontSize:14, fontWeight:600, marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Breakdown Chart</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fyMonths.map(mi => { const r={name:MONTHS[mi]?.short}; streams.forEach(s=>{r[s]=weeklyTotal(weeklyData,s,mi);}); return r; })} barSize={9}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                <XAxis dataKey="name" tick={{fill:T.sub,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`£${v}`}/>
                <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}} formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                {streams.map((s,i)=><Bar key={s} dataKey={s} stackId="a" fill={CC[i%CC.length]}/>)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{MONTHS[monthIdx]?.label}</div>
            <WeeklyEntryTable streams={streams} weeklyData={weeklyData} baselineData={baselineData}
              forecastData={forecastData} monthIdx={monthIdx} onUpdateWeekly={onUpdateWeekly}
              onUpdateForecast={onUpdateForecast} type="savings"/>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenditurePage({ monthIdx, fyStart, totalMonths, streams, setStreams, baselineData, forecastData, weeklyData,
  onUpdateWeekly, onUpdateForecast, onEditBaseline, expNotes, onUpdateExpNote }) {
  const [catModal, setCatModal] = useState(false);
  const [viewMode, setViewMode] = useState("month");
  const [selFY, setSelFY] = useState(() => getFYYear(monthIdx, fyStart));
  useEffect(()=>setSelFY(getFYYear(monthIdx,fyStart)),[monthIdx,fyStart]);
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
      {catModal && <CategoryModal title="Expenditure" streams={streams} onSave={s=>{setStreams(s);setCatModal(false);}} onClose={()=>setCatModal(false)}/>}
      <FYToolbar fyStart={fyStart} monthIdx={monthIdx} totalMonths={totalMonths} selectedFY={selFY} onSelectFY={setSelFY}
        viewMode={viewMode} onViewMode={setViewMode} onSettings={()=>{}}/>

      {viewMode === "fy" ? (
        <div>
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div className="sl" style={{ marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Actual Expenditure</div>
            <FYSummaryTable streams={streams} fyMonths={fyMonths} baselineData={baselineData}
              forecastData={forecastData} weeklyData={weeklyData} type="expenditure"/>
          </div>
          <div className="card" style={{ padding:20 }}>
            <div style={{ fontFamily:"'Playfair Display'", fontSize:14, fontWeight:600, marginBottom:14 }}>{fyLabel(selFY,fyStart)} — Category Trend</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={fyMonths.map(mi=>({name:MONTHS[mi]?.short,Baseline:allMonthly(streams,baselineData,mi),Actual:allStreamsWeekly(streams,weeklyData,mi)}))}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                <XAxis dataKey="name" tick={{fill:T.sub,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.sub,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`£${v}`}/>
                <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}} formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Line type="monotone" dataKey="Baseline" stroke={T.border} strokeDasharray="4 4" dot={false} strokeWidth={2}/>
                <Line type="monotone" dataKey="Actual" stroke={T.danger} strokeWidth={2.5} dot={{r:3,fill:T.danger}}/>
              </LineChart>
            </ResponsiveContainer>
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
    </div>
  );
}

function NetWorthPage({ netWorth, onUpdate }) {
  const total = NET_WORTH_ASSETS.reduce((a,k)=>a+(netWorth[k]||0),0);
  const pie = NET_WORTH_ASSETS.map((k,i)=>({name:k,value:netWorth[k]||0,color:CC[i]})).filter(d=>d.value>0);
  return (
    <div className="fade">
      <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600, marginBottom:20 }}>Net Worth</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div className="card" style={{ padding:20 }}>
          <div className="sl" style={{ marginBottom:14 }}>Asset Classes</div>
          <table>
            <thead><tr><th>Class</th><th style={{ color:T.accent }}>Value (£)</th></tr></thead>
            <tbody>
              {NET_WORTH_ASSETS.map(k=><tr key={k}><td>{k}</td><td><NumInput value={netWorth[k]||0} onChange={v=>onUpdate(k,v)}/></td></tr>)}
              <tr className="total-row"><td>Total Net Worth</td><td>{fmt(total)}</td></tr>
            </tbody>
          </table>
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
    </div>
  );
}

function MoneyOwedPage({ rows, onUpdate }) {
  const total=rows.reduce((a,r)=>a+(r.amount||0),0), paid=rows.reduce((a,r)=>a+(r.paid||0),0);
  const upd=(i,k,v)=>{const r=[...rows];r[i]={...r[i],[k]:v};onUpdate(r);};
  const inp={background:T.inputBg,border:`1px solid ${T.border}`,color:T.text,borderRadius:6,padding:"5px 8px",fontSize:13,fontFamily:"'DM Sans'"};
  return (
    <div className="fade">
      <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600, marginBottom:20 }}>Money Owed</div>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <StatCard icon="📋" label="Total Loaned" value={fmt(total)}/>
        <StatCard icon="✅" label="Received" value={fmt(paid)}/>
        <StatCard icon="⏳" label="Outstanding" value={fmt(total-paid)}/>
      </div>
      <div className="card" style={{ padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div className="sl">Loans Tracker</div>
          <button className="btn btn-primary btn-sm" onClick={()=>onUpdate([...rows,{name:"",amount:0,reason:"",amex:false,paid:0}])}>+ Add</button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table>
            <thead><tr>
              <th style={{ textAlign:"left",width:130 }}>Name</th><th>Amount</th>
              <th style={{ textAlign:"left" }}>Reason</th><th>Amex</th><th>Paid</th><th>Balance</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i}>
                  <td><input value={r.name||""} onChange={e=>upd(i,"name",e.target.value)} style={{...inp,width:120}}/></td>
                  <td><NumInput value={r.amount} onChange={v=>upd(i,"amount",v)}/></td>
                  <td style={{ textAlign:"left" }}><input value={r.reason||""} onChange={e=>upd(i,"reason",e.target.value)} style={{...inp,width:180}}/></td>
                  <td><input type="checkbox" checked={r.amex||false} onChange={e=>upd(i,"amex",e.target.checked)} style={{accentColor:T.accent,width:15,height:15}}/></td>
                  <td><NumInput value={r.paid} onChange={v=>upd(i,"paid",v)}/></td>
                  <td><span style={{color:(r.amount-r.paid)<=0?T.success:T.warning,fontWeight:600,fontSize:13}}>{fmt((r.amount||0)-(r.paid||0))}</span></td>
                  <td><button className="btn-icon" style={{color:T.danger}} onClick={()=>onUpdate(rows.filter((_,j)=>j!==i))}>✕</button></td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td><td>{fmt(total)}</td><td></td><td></td><td>{fmt(paid)}</td>
                <td style={{color:total-paid>0?T.warning:T.success}}>{fmt(total-paid)}</td><td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BaselinePage({ monthIdx, fyStart, totalMonths, incomeStreams, savingsStreams, expStreams,
  baselineIncome, baselineSavings, baselineExp, onUpdateBaseline, onEditBaseline }) {
  const [selFY, setSelFY] = useState(() => getFYYear(monthIdx, fyStart));
  const fys = useMemo(() => getAllFYs(fyStart, totalMonths), [fyStart, totalMonths]);
  useEffect(()=>setSelFY(getFYYear(monthIdx,fyStart)),[monthIdx,fyStart]);
  const fyMonths = getFYMonths(selFY, fyStart, totalMonths);

  return (
    <div className="fade">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:20, fontWeight:600 }}>Baselines</div>
      </div>
      <div style={{ fontSize:13, color:T.sub, marginBottom:18 }}>
        Reference values set each March after pay review. Click <strong style={{color:T.accent}}>✎ Edit</strong> to update any section for the selected FY.
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {fys.map(f=><button key={f.year} className={`fy-tab${selFY===f.year?" active":""}`} onClick={()=>setSelFY(f.year)}>{fyLabel(f.year,fyStart)}</button>)}
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
              <table>
                <thead><tr>
                  <th style={{ width:160 }}>Category</th>
                  {fyMonths.map(mi=><th key={mi} style={{ fontSize:10 }}>{MONTHS[mi]?.short}</th>)}
                  <th style={{ color:T.accent }}>FY Total</th>
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

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [currencySearch, setCurrencySearch] = useState("");
  const [fyStart, setFYStart] = useState(3);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [savingsGoal, setSavingsGoal] = useState("");
  const [savingsCats, setSavingsCats] = useState(["Emergency Fund","Personal Savings","Investments"]);
  const [expCats, setExpCats] = useState(["Rent / Mortgage","Groceries","Subscriptions","Transport"]);
  const [customSav, setCustomSav] = useState("");
  const [customExp, setCustomExp] = useState("");
  const [dir, setDir] = useState(1);

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
    onComplete({ name, currency, fyStart, monthlyIncome: parseFloat(monthlyIncome) || 0, savingsGoal: parseFloat(savingsGoal) || 0, savingsCats, expCats });
  };

  const TOTAL_STEPS = 7;
  const progress = (step / (TOTAL_STEPS - 1)) * 100;

  const stepValid = [
    name.trim().length > 0,           // 0 name
    true,                              // 1 currency (always valid)
    true,                              // 2 FY
    true,                              // 3 monthly income
    true,                              // 4 savings goal
    savingsCats.length > 0,            // 5 savings cats
    expCats.length > 0,                // 6 exp cats
  ];

  const stepContent = [
    // ── STEP 0: Welcome + Name ──
    <div key={0} style={{ textAlign:"center" }}>
      <div style={{ fontSize:60, marginBottom:24, lineHeight:1 }}>👋</div>
      <h1 style={{ fontFamily:"'Playfair Display'", fontSize:32, fontWeight:700, color:T.text, marginBottom:12 }}>
        Welcome to Pennywise
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
              <span style={{ fontSize:22 }}>{flagEmoji(c.locale)}</span>
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

    // ── STEP 2: Financial Year ──
    <div key={2} style={{ textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>📅</div>
      <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Financial year start</h2>
      <p style={{ fontSize:14, color:T.sub, maxWidth:420, margin:"0 auto 28px" }}>
        When does your financial year begin? This controls how the app groups months into FY summaries.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, maxWidth:480, margin:"0 auto 20px" }}>
        {MONTH_NAMES.map((m, i) => (
          <button key={i} onClick={() => setFYStart(i)}
            style={{ background: fyStart===i ? "rgba(212,168,83,.15)" : T.inputBg,
              border:`1.5px solid ${fyStart===i ? T.accent : T.border}`, borderRadius:10,
              padding:"12px 8px", cursor:"pointer", transition:"all .15s",
              color: fyStart===i ? T.accent : T.sub, fontWeight: fyStart===i ? 700 : 400,
              fontFamily:"'DM Sans'", fontSize:13 }}>
            {m}
          </button>
        ))}
      </div>
      <div style={{ padding:"12px 20px", background:"rgba(212,168,83,.06)", border:`1px solid rgba(212,168,83,.2)`, borderRadius:10, fontSize:13, color:T.sub, display:"inline-block" }}>
        Your FY runs <strong style={{ color:T.accent }}>{MONTH_NAMES[fyStart]}</strong> → <strong style={{ color:T.accent }}>{MONTH_NAMES[(fyStart+11)%12]}</strong>
        {fyStart===3 && <span style={{ color:T.success, marginLeft:8 }}>✓ UK Tax Year</span>}
        {fyStart===0 && <span style={{ color:T.success, marginLeft:8 }}>✓ Calendar Year</span>}
      </div>
    </div>,

    // ── STEP 3: Monthly Income ──
    <div key={3} style={{ textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>💷</div>
      <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Monthly take-home income</h2>
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

    // ── STEP 4: Savings Goal ──
    <div key={4} style={{ textAlign:"center" }}>
      <div style={{ fontSize:44, marginBottom:12 }}>🎯</div>
      <h2 style={{ fontFamily:"'Playfair Display'", fontSize:24, fontWeight:600, color:T.text, marginBottom:8 }}>Annual savings goal</h2>
      <p style={{ fontSize:14, color:T.sub, maxWidth:400, margin:"0 auto 28px" }}>
        How much would you like to save this financial year? You can update this anytime.
      </p>
      <div style={{ maxWidth:300, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", background:T.inputBg, border:`1.5px solid ${savingsGoal ? T.accent : T.border}`, borderRadius:12, overflow:"hidden", transition:"border-color .2s" }}>
          <span style={{ padding:"16px 16px", fontSize:22, color:T.accent, fontWeight:700, borderRight:`1px solid ${T.border}` }}>{currency.symbol}</span>
          <input type="number" value={savingsGoal} onChange={e=>setSavingsGoal(e.target.value)}
            placeholder="0"
            style={{ background:"transparent", border:"none", outline:"none", color:T.text, fontSize:28, fontWeight:600, fontFamily:"'DM Sans'", padding:"16px 18px", width:"100%" }} />
        </div>
        {savingsGoal && parseFloat(savingsGoal) > 0 && (
          <div style={{ marginTop:16, padding:"10px 16px", background:"rgba(82,196,122,.08)", border:`1px solid rgba(82,196,122,.25)`, borderRadius:8, fontSize:13, color:T.success }}>
            ✓ That's {currency.symbol}{(parseFloat(savingsGoal)/12).toFixed(0)} per month
            {monthlyIncome && parseFloat(monthlyIncome) > 0 && (
              <span> · {Math.round(parseFloat(savingsGoal)/12/parseFloat(monthlyIncome)*100)}% of income</span>
            )}
          </div>
        )}
        <p style={{ marginTop:14, fontSize:12, color:T.sub }}>Skip this for now — you can set it later in Settings.</p>
      </div>
    </div>,

    // ── STEP 5: Savings Categories ──
    <div key={5}>
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
    </div>,

    // ── STEP 6: Expenditure Categories ──
    <div key={6}>
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
                background: on ? "rgba(240,100,100,.1)" : T.inputBg,
                border:`1.5px solid ${on ? T.danger : T.border}`, borderRadius:10, cursor:"pointer",
                transition:"all .15s", textAlign:"left" }}>
              <span style={{ fontSize:20 }}>{icon}</span>
              <span style={{ fontSize:13, fontWeight: on ? 600 : 400, color: on ? T.danger : T.sub, fontFamily:"'DM Sans'" }}>{label}</span>
              {on && <span style={{ marginLeft:"auto", color:T.danger, fontSize:16 }}>✓</span>}
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
        <div key={c} style={{ display:"inline-flex", alignItems:"center", gap:6, margin:"6px 4px 0 0", padding:"4px 10px", background:"rgba(240,100,100,.1)", border:`1px solid ${T.danger}`, borderRadius:20, fontSize:12, color:T.danger }}>
          {c} <button onClick={()=>setExpCats(p=>p.filter(x=>x!==c))} style={{ background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:1 }}>✕</button>
        </div>
      ))}
    </div>,
  ];

  const stepLabels = ["Welcome","Currency","Fin. Year","Income","Goal","Savings","Spending"];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{STYLES}</style>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(${dir*40}px); } to { opacity:1; transform:none; } }
        .ob-slide { animation: slideIn .28s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* Header logo */}
      <div style={{ marginBottom:32, textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:22, fontWeight:700, color:T.accent, letterSpacing:2 }}>PENNYWISE</div>
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
          {step < TOTAL_STEPS - 1 ? (
            <button className="btn btn-primary" onClick={next} disabled={!stepValid[step]}
              style={{ opacity: stepValid[step] ? 1 : 0.4, cursor: stepValid[step] ? "pointer" : "not-allowed" }}>
              Continue →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} disabled={!stepValid[step]}
              style={{ opacity: stepValid[step] ? 1 : 0.4, background:`linear-gradient(135deg, ${T.accent}, #e8c070)` }}>
              Launch my tracker 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [onboarded, setOnboarded] = useState(false);  // gated until loaded
  const [onboardLoading, setOnboardLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [page, setPage] = useState("dashboard");
  const [monthIdx, setMonthIdx] = useState(() => {
    const now = new Date();
    return Math.max(0, Math.min((now.getFullYear()-2026)*12+(now.getMonth()-0), MAX_MONTHS-1));
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [fyStart, setFYStart] = useState(3); // April default
  const [totalMonths, setTotalMonths] = useState(48); // starts at 48, user can extend
  const [fySettingsOpen, setFYSettingsOpen] = useState(false);
  const [currency, setCurrency] = useState(CURRENCIES[0]); // GBP default
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Baseline editor modal state
  const [blModal, setBLModal] = useState(null); // { section, streams, data }

  // Categories
  const [incomeStreams, setIncomeStreams] = useState(DEFAULT_INCOME_STREAMS);
  const [savingsStreams, setSavingsStreams] = useState(DEFAULT_SAVINGS_STREAMS);
  const [expStreams, setExpStreams] = useState(DEFAULT_EXP_STREAMS);

  // Baselines
  const [baselineIncome, setBaselineIncome] = useState(makeBaselineIncome);
  const [baselineSavings, setBaselineSavings] = useState(makeBaselineSavings);
  const [baselineExp, setBaselineExp] = useState(makeBaselineExp);

  // Actual / transactional data — pre-seeded with real historical values
  const [incomeActual, setIncomeActual] = useState(buildSeedIncomeActual);
  const [savingsForecast, setSavingsForecast] = useState(buildSeedSavingsForecast);
  const [savingsWeekly, setSavingsWeekly] = useState(buildSeedSavingsWeekly);
  const [expForecast, setExpForecast] = useState(buildSeedExpForecast);
  const [expWeekly, setExpWeekly] = useState(buildSeedExpWeekly);

  // Notes: expNotes[stream][monthIdx][week] = string; incomeNotes[stream][monthIdx] = string
  const [expNotes, setExpNotes] = useState({});
  const [incomeNotes, setIncomeNotes] = useState({});

  const [netWorth, setNetWorth] = useState(DEFAULT_NET_WORTH);
  const [moneyOwed, setMoneyOwed] = useState([]);
  const [savingsGoal, setSavingsGoal] = useState(0);

  // Load from storage (overrides seeds if data already saved)
  // DATA_VER: bump this whenever historical seed data is replaced wholesale
  const DATA_VER = "pennywise.public.v1"; // blank slate, Jan 2026 start

  useEffect(() => {
    (async () => {
      const keys = ["fy","tm","curr","cats","bInc","bSav","bExp","incAct","savFc","savWk","expFc","expWk","nw","mo","expN","incN","dver","name","goal","done"];
      const res = await Promise.all(keys.map(k => load(`bt3-${k}`, null)));
      const [fy,tm,curr,cats,bInc,bSav,bExp,incAct,savFc,savWk,expFc,expWk,nw,mo,expN,incN,dver,uname,goal,done] = res;

      // Onboarding flag
      if (done) { setOnboarded(true); }
      if (uname) setUserName(uname);
      if (goal !== null) setSavingsGoal(goal);

      // If data version doesn't match, discard stale transactional data so
      // the fresh seed functions above are used instead.
      const freshSeed = dver !== DATA_VER;

      if (fy !== null) setFYStart(fy);
      if (tm !== null) setTotalMonths(tm);
      if (curr) { const found = CURRENCIES.find(c => c.code === curr); if (found) setCurrency(found); }
      if (cats) { if(cats.income)setIncomeStreams(cats.income); if(cats.savings)setSavingsStreams(cats.savings); if(cats.exp)setExpStreams(cats.exp); }
      if (!freshSeed && bInc) setBaselineIncome(bInc);
      if (!freshSeed && bSav) setBaselineSavings(bSav);
      if (!freshSeed && bExp) setBaselineExp(bExp);
      if (!freshSeed && incAct) setIncomeActual(incAct);
      if (!freshSeed && savFc)  setSavingsForecast(savFc);
      if (!freshSeed && savWk)  setSavingsWeekly(savWk);
      if (!freshSeed && expFc)  setExpForecast(expFc);
      if (!freshSeed && expWk)  setExpWeekly(expWk);
      if (nw)     setNetWorth(nw);
      if (mo)     setMoneyOwed(mo);
      if (!freshSeed && expN)   setExpNotes(expN);
      if (!freshSeed && incN)   setIncomeNotes(incN);
      setLoading(false);
      setOnboardLoading(false);
    })();
  }, []);

  // Called when user completes onboarding
  const handleOnboardingComplete = useCallback(async ({ name, currency: c, fyStart: fy, monthlyIncome: mInc, savingsGoal: goal, savingsCats, expCats }) => {
    setUserName(name);
    setCurrency(c);
    setFYStart(fy);
    setSavingsGoal(goal);
    setSavingsStreams(savingsCats);
    setExpStreams(expCats);

    // Seed income baseline + actuals from the monthly income figure
    const incStreams = ["Pay check", "Extra Income"];
    const payArr = Array(MAX_MONTHS).fill(mInc || 0);
    const zeroArr = Array(MAX_MONTHS).fill(0);
    const newBaselineIncome = { "Pay check": [...payArr], "Extra Income": [...zeroArr] };
    const newIncomeActual   = { "Pay check": [...payArr], "Extra Income": [...zeroArr] };
    setIncomeStreams(incStreams);
    setBaselineIncome(newBaselineIncome);
    setIncomeActual(newIncomeActual);

    // Build blank baseline/forecast/weekly structures for chosen categories
    const blankArr = () => Array(MAX_MONTHS).fill(0);
    const newBaselineSavings = Object.fromEntries(savingsCats.map(s => [s, blankArr()]));
    const newForecastSavings = Object.fromEntries(savingsCats.map(s => [s, blankArr()]));
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

  const handleSave = useCallback(async () => {
    await Promise.all([
      save("bt3-fy", fyStart),
      save("bt3-tm", totalMonths),
      save("bt3-curr", currency.code),
      save("bt3-dver", DATA_VER),
      save("bt3-name", userName),
      save("bt3-goal", savingsGoal),
      save("bt3-done", true),
      save("bt3-cats", { income:incomeStreams, savings:savingsStreams, exp:expStreams }),
      save("bt3-bInc", baselineIncome), save("bt3-bSav", baselineSavings), save("bt3-bExp", baselineExp),
      save("bt3-incAct", incomeActual), save("bt3-savFc", savingsForecast), save("bt3-savWk", savingsWeekly),
      save("bt3-expFc", expForecast), save("bt3-expWk", expWeekly),
      save("bt3-nw", netWorth), save("bt3-mo", moneyOwed),
      save("bt3-expN", expNotes), save("bt3-incN", incomeNotes),
    ]);
    setSaved(true); setTimeout(()=>setSaved(false), 2000);
  }, [fyStart,totalMonths,currency,incomeStreams,savingsStreams,expStreams,baselineIncome,baselineSavings,baselineExp,
      incomeActual,savingsForecast,savingsWeekly,expForecast,expWeekly,netWorth,moneyOwed,expNotes,incomeNotes]);

  // Category handlers — ensure data structures when streams change
  const handleSetInc = useCallback(ns => {
    setIncomeStreams(ns);
    setIncomeActual(p => ensureStreams(p, ns, "array"));
    setBaselineIncome(p => ensureStreams(p, ns, "array"));
  }, []);
  const handleSetSav = useCallback(ns => {
    setSavingsStreams(ns);
    setSavingsForecast(p => ensureStreams(p, ns, "array"));
    setSavingsWeekly(p => ensureStreams(p, ns, "weekly"));
    setBaselineSavings(p => ensureStreams(p, ns, "array"));
  }, []);
  const handleSetExp = useCallback(ns => {
    setExpStreams(ns);
    setExpForecast(p => ensureStreams(p, ns, "array"));
    setExpWeekly(p => ensureStreams(p, ns, "weekly"));
    setBaselineExp(p => ensureStreams(p, ns, "array"));
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

  const navItems = [
    {key:"dashboard",icon:"◈",label:"Dashboard"},
    {key:"income",icon:"↗",label:"Income"},
    {key:"savings",icon:"◎",label:"Savings"},
    {key:"expenditure",icon:"◉",label:"Expenditure"},
    {key:"networth",icon:"◆",label:"Net Worth"},
    {key:"moneyowed",icon:"◷",label:"Money Owed"},
    {key:"baseline",icon:"⊞",label:"Baselines"},
  ];

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:24, color:T.accent, marginBottom:8 }}>Pennywise</div>
        <div style={{ color:T.sub, fontSize:13 }}>Loading your data…</div>
      </div>
    </div>
  );

  // Update module-level CURR before render so fmt/fmtS pick up correct currency
  CURR = currency;

  // Show onboarding for brand-new users (wait until storage check completes)
  if (onboardLoading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{STYLES}</style>
      <div style={{ color:T.sub, fontSize:14 }}>Loading…</div>
    </div>
  );
  if (!onboarded) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      <style>{STYLES}</style>

      {/* FY Settings Modal */}
      {fySettingsOpen && <FYSettingsModal fyStart={fyStart} totalMonths={totalMonths} onSave={(newFy, newTm)=>{setFYStart(newFy);setTotalMonths(newTm);setFYSettingsOpen(false);}} onClose={()=>setFYSettingsOpen(false)}/>}

      {/* Currency Modal */}
      {currencyOpen && <CurrencyModal current={currency} onSave={c=>{setCurrency(c);setCurrencyOpen(false);}} onClose={()=>setCurrencyOpen(false)}/>}

      {/* Baseline Editor Modal */}
      {blModal && (
        <BaselineEditorModal
          section={blModal.section}
          streams={blModal.section==="Income"?incomeStreams:blModal.section==="Savings"?savingsStreams:expStreams}
          data={blModal.section==="Income"?baselineIncome:blModal.section==="Savings"?baselineSavings:baselineExp}
          fyStart={fyStart}
          totalMonths={totalMonths}
          onSave={d => saveBaseline(blModal.section, d)}
          onClose={()=>setBLModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ background:T.card, borderBottom:`1px solid ${T.border}`, padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontFamily:"'Playfair Display'", fontSize:17, fontWeight:600, color:T.accent }}>◈ Pennywise
          {userName && <span style={{ fontFamily:"'DM Sans'", fontSize:12, fontWeight:400, color:T.sub, marginLeft:10 }}>· {userName}</span>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button className="month-btn" onClick={()=>setMonthIdx(Math.max(0,monthIdx-1))}>‹</button>
          <div style={{ fontSize:14, fontWeight:600, minWidth:104, textAlign:"center" }}>{MONTHS[monthIdx]?.label}</div>
          <button className="month-btn" onClick={()=>setMonthIdx(Math.min(totalMonths-1,monthIdx+1))}>›</button>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setCurrencyOpen(true)} title="Change currency" style={{ gap:5 }}>
            <span>{flagEmoji(currency.locale)}</span> {currency.code}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={()=>setFYSettingsOpen(true)} title="Financial year settings">⚙ FY Settings</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ minWidth:88 }}>{saved?"✓ Saved":"Save All"}</button>
        </div>
      </div>

      <div style={{ display:"flex" }}>
        {/* Sidebar */}
        <div style={{ width:176, background:T.card, borderRight:`1px solid ${T.border}`, minHeight:"calc(100vh - 52px)", padding:"14px 8px", position:"sticky", top:52, flexShrink:0 }}>
          {navItems.map(n=>(
            <div key={n.key} className={`nav-item${page===n.key?" active":""}`} onClick={()=>setPage(n.key)}>
              <span style={{ fontSize:14, width:18, textAlign:"center" }}>{n.icon}</span>{n.label}
            </div>
          ))}
          <div style={{ margin:"16px 6px 0", borderTop:`1px solid ${T.border}`, paddingTop:12 }}>
            <div style={{ fontSize:10, color:T.sub, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:8, paddingLeft:8 }}>FY Config</div>
            <div style={{ fontSize:11, color:T.sub, padding:"3px 8px" }}>Start: <span style={{ color:T.accent }}>{MONTH_NAMES[fyStart]}</span></div>
            <div style={{ fontSize:11, color:T.sub, padding:"3px 8px" }}>End: <span style={{ color:T.accent }}>{MONTH_NAMES[(fyStart+11)%12]}</span></div>
            <div style={{ fontSize:11, color:T.sub, padding:"3px 8px" }}>Currency: <span style={{ color:T.accent }}>{flagEmoji(currency.locale)} {currency.code}</span></div>
            <div style={{ margin:"12px 6px 0", borderTop:`1px solid ${T.border}`, paddingTop:10 }}>
              <div style={{ fontSize:10, color:T.sub, textTransform:"uppercase", letterSpacing:".08em", fontWeight:600, marginBottom:6, paddingLeft:2 }}>Categories</div>
              {[["Income",incomeStreams],["Savings",savingsStreams],["Exp.",expStreams]].map(([l,arr])=>(
                <div key={l} style={{ fontSize:11, color:T.sub, padding:"3px 2px", display:"flex", justifyContent:"space-between" }}>
                  <span>{l}</span><span style={{ color:T.border }}>{arr.length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex:1, padding:"22px", overflowX:"hidden" }}>
          {page==="dashboard"&&<Dashboard monthIdx={monthIdx} fyStart={fyStart} totalMonths={totalMonths} incomeStreams={incomeStreams} savingsStreams={savingsStreams} expStreams={expStreams}
            baselineIncome={baselineIncome} baselineSavings={baselineSavings} baselineExp={baselineExp}
            incomeActual={incomeActual} savingsForecast={savingsForecast} savingsWeekly={savingsWeekly}
            expForecast={expForecast} expWeekly={expWeekly} onFYSettings={()=>setFYSettingsOpen(true)}/>}

          {page==="income"&&<IncomePage monthIdx={monthIdx} fyStart={fyStart} totalMonths={totalMonths} streams={incomeStreams} setStreams={handleSetInc}
            baselineData={baselineIncome} actualData={incomeActual} onUpdate={updIncAct}
            onEditBaseline={openBaselineEditor} incomeNotes={incomeNotes} onUpdateIncomeNote={updIncomeNote}/>}

          {page==="savings"&&<SavingsPage monthIdx={monthIdx} fyStart={fyStart} totalMonths={totalMonths} streams={savingsStreams} setStreams={handleSetSav}
            baselineData={baselineSavings} forecastData={savingsForecast} weeklyData={savingsWeekly}
            onUpdateWeekly={updSavWk} onUpdateForecast={updSavFc} onEditBaseline={openBaselineEditor}/>}

          {page==="expenditure"&&<ExpenditurePage monthIdx={monthIdx} fyStart={fyStart} totalMonths={totalMonths} streams={expStreams} setStreams={handleSetExp}
            baselineData={baselineExp} forecastData={expForecast} weeklyData={expWeekly}
            onUpdateWeekly={updExpWk} onUpdateForecast={updExpFc} onEditBaseline={openBaselineEditor}
            expNotes={expNotes} onUpdateExpNote={updExpNote}/>}

          {page==="networth"&&<NetWorthPage netWorth={netWorth} onUpdate={(k,v)=>setNetWorth(p=>({...p,[k]:v}))}/>}
          {page==="moneyowed"&&<MoneyOwedPage rows={moneyOwed} onUpdate={setMoneyOwed}/>}
          {page==="baseline"&&<BaselinePage monthIdx={monthIdx} fyStart={fyStart} totalMonths={totalMonths}
            incomeStreams={incomeStreams} savingsStreams={savingsStreams} expStreams={expStreams}
            baselineIncome={baselineIncome} baselineSavings={baselineSavings} baselineExp={baselineExp}
            onEditBaseline={openBaselineEditor}/>}
        </div>
      </div>
    </div>
  );
}
