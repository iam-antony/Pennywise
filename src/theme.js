// Palette, chart colours and the global stylesheet
// Extracted from App.jsx — pure logic, no React, so it can be unit tested.

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg:"#0d1b2a", card:"#152236", border:"#1e3350", accent:"#d4a853",
  text:"#e8edf2", sub:"#7a92aa", success:"#52c47a", danger:"#f06464",
  warning:"#f5a623", inputBg:"#0a1520", blue:"#7eb3f5", modal:"#0d1b2ae0",
  purple:"#a87fd4",
};
const CC = ["#d4a853","#7eb3f5","#52c47a","#f5a623","#a87fd4","#5cc8d4","#f06464","#f5c842","#8093f1","#e07070","#7ab87a","#f09d6a","#c4d4a0","#a0c4d4"];

const STYLES = `
/* Fonts are served from this app, not fetched from Google. The README says
   nothing leaves the browser, and a third-party font request would have made
   that untrue — it discloses the reader's IP and referrer on every load.
   Latin subsets only; see public/fonts. */
@font-face{font-family:'DM Sans';font-style:normal;font-weight:300;font-display:swap;
  src:url('/fonts/dm-sans-300.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:400;font-display:swap;
  src:url('/fonts/dm-sans-400.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:500;font-display:swap;
  src:url('/fonts/dm-sans-500.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:600;font-display:swap;
  src:url('/fonts/dm-sans-600.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:500;font-display:swap;
  src:url('/fonts/playfair-display-500.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:600;font-display:swap;
  src:url('/fonts/playfair-display-600.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
@font-face{font-family:'Playfair Display';font-style:normal;font-weight:700;font-display:swap;
  src:url('/fonts/playfair-display-700.woff2') format('woff2');
  unicode-range:U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg};color:${T.text};font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
input[type=number]{-moz-appearance:textfield} input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}
.fade{animation:fi .22s ease} @keyframes fi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.card{background:${T.card};border:1px solid ${T.border};border-radius:12px}
.nav-item{cursor:pointer;display:flex;align-items:center;gap:9px;padding:9px 14px;border-radius:8px;font-size:13px;font-weight:500;color:${T.sub};transition:all .18s;width:100%;text-align:left;background:transparent;border:none;font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.nav-item:hover{color:${T.text};background:${T.border}} .nav-item.active{color:${T.accent};background:rgba(212,168,83,.1)}
/* Keyboard focus has to be visible — the app was previously unusable without a
   mouse, and an invisible focus ring is only half a fix. */
:focus-visible{outline:2px solid ${T.accent};outline-offset:2px;border-radius:4px}
.modal:focus{outline:none}
@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}
.btn{cursor:pointer;border:none;border-radius:8px;font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-weight:500;font-size:13px;transition:all .18s;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:${T.accent};color:#0d1b2a;padding:8px 18px} .btn-primary:hover{background:#e8c070;transform:translateY(-1px)}
.btn-ghost{background:transparent;border:1px solid ${T.border};color:${T.sub};padding:7px 14px} .btn-ghost:hover{border-color:${T.accent};color:${T.accent}}
.btn-sm{padding:5px 12px;font-size:12px} .btn-xs{padding:3px 8px;font-size:11px}
.btn-icon{background:transparent;border:none;cursor:pointer;color:${T.sub};padding:4px 6px;border-radius:4px;font-size:14px;transition:all .15s} .btn-icon:hover{color:${T.text};background:${T.border}}
.inp{background:${T.inputBg};border:1px solid ${T.border};color:${T.text};font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;border-radius:6px;padding:6px 10px;transition:border-color .15s}
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
/* A card that leads somewhere should look like it does, and say where on hover. */
.stat-card-link{position:relative;transition:border-color .15s, transform .15s}
.stat-card-link:hover{border-color:${T.accent};transform:translateY(-2px)}
.stat-card-go{position:absolute;top:16px;right:16px;color:${T.border};font-size:15px;transition:color .15s}
.stat-card-link:hover .stat-card-go{color:${T.accent}}

/* Pace bars — the dashboard's progress section. Fixed height per row, so the
   section stays the same size however many categories a profile has. */
.pace-row{margin-bottom:16px}
.pace-row:last-child{margin-bottom:0}
.pace-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;margin-bottom:6px}
.pace-label{font-weight:600}
.pace-track{position:relative;height:10px;border-radius:5px;background:${T.inputBg};border:1px solid ${T.border};overflow:hidden}
.pace-fill{height:100%;border-radius:4px;transition:width .35s ease}
/* Past the end of the track: a cap in the warning colour, since the fill has
   nowhere left to grow. */
.pace-over{position:absolute;top:0;right:0;width:5px;height:100%}
/* Where you should be by now. Drawn over the fill, so it reads whether you are
   short of it or past it. */
.pace-mark{position:absolute;top:-2px;width:2px;height:14px;background:${T.text};opacity:.85;border-radius:1px}
@media (prefers-reduced-motion: reduce){.pace-fill{transition:none}}

/* "only" — isolate one category without unticking every other one. */
.pick-only{background:none;border:0;color:${T.sub};font-size:10px;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;padding:2px 4px;border-radius:4px;flex-shrink:0}
.pick-only:hover{color:${T.accent};background:rgba(255,255,255,.05)}
.fy-tab{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid ${T.border};color:${T.sub};background:transparent;transition:all .15s;white-space:nowrap}
.fy-tab.active{background:rgba(212,168,83,.15);border-color:${T.accent};color:${T.accent};font-weight:600}
.view-toggle{display:flex;background:${T.inputBg};border:1px solid ${T.border};border-radius:8px;padding:3px;gap:2px}
.vt-btn{padding:5px 14px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;border:none;background:transparent;color:${T.sub};transition:all .15s}
.vt-btn.active{background:${T.card};color:${T.accent};box-shadow:0 1px 4px rgba(0,0,0,.3)}
.bl-cell{width:68px;text-align:right;background:${T.inputBg};border:1px solid transparent;color:${T.text};font-size:12px;border-radius:4px;padding:3px 6px;transition:border-color .15s}
.bl-cell:focus{outline:none;border-color:${T.accent}}

/* ─── FROZEN EDGE COLUMNS ──────────────────────────────────────────────────
   Excel's split with fixed panes, on both edges: the category is pinned left
   and the FY total pinned right, so the months scroll between them and you can
   always see which row you are on and what it adds up to.

   Each frozen cell needs an opaque background of its own, or the scrolling
   columns show straight through it. The three surfaces are different colours,
   and the header corners have to outrank both the sticky row and the sticky
   column so nothing overlaps them at the intersections. */
.sticky-col td:first-child,
.sticky-col th:first-child{position:sticky;left:0;z-index:3;
  box-shadow:1px 0 0 ${T.border}, 5px 0 7px -5px rgba(0,0,0,.5)}
.sticky-col td:last-child,
.sticky-col th:last-child{position:sticky;right:0;z-index:3;
  box-shadow:-1px 0 0 ${T.border}, -5px 0 7px -5px rgba(0,0,0,.5)}
.sticky-col tbody td:first-child,
.sticky-col tbody td:last-child{background:${T.card}}
.sticky-col thead th:first-child,
.sticky-col thead th:last-child{background:${T.bg};z-index:4}
/* The totals row tints itself with a translucent accent over the card. Both
   frozen cells need that colour flattened, or months slide visibly beneath. */
.sticky-col .total-row td:first-child,
.sticky-col .total-row td:last-child{background:#1d2737}

/* Two frozen columns, for the baseline editor: "Fill All" is used once per row
   alongside the category, so it stays put with it rather than scrolling away.
   The 160px offset is the category column's locked width — the header sets a
   fixed width so a long category name cannot shift this out of alignment. */
.sticky-col-2 td:nth-child(2),
.sticky-col-2 th:nth-child(2){position:sticky;left:160px;z-index:3;
  box-shadow:1px 0 0 ${T.border}, 5px 0 7px -5px rgba(0,0,0,.5)}
.sticky-col-2 tbody td:nth-child(2){background:${T.card}}
.sticky-col-2 thead th:nth-child(2){background:${T.bg};z-index:4}
.sticky-col-2 .total-row td:nth-child(2){background:#1d2737}
/* With two columns frozen the divider belongs after the second, not the first. */
.sticky-col-2 td:first-child,
.sticky-col-2 th:first-child{box-shadow:none}

/* ─── SHELL ────────────────────────────────────────────────────────────────
   The shell was laid out with inline styles, which a media query cannot
   reach, so there was no way to adapt it to a narrow screen. It is class-based
   now, and collapses to a single column with the navigation along the bottom. */
.app-header{background:${T.card};border-bottom:1px solid ${T.border};padding:0 20px;display:flex;
  align-items:center;justify-content:space-between;gap:12px;height:52px;position:sticky;top:0;z-index:100}
.app-shell{display:flex}
.app-sidebar{width:176px;background:${T.card};border-right:1px solid ${T.border};
  min-height:calc(100vh - 52px);padding:14px 8px;position:sticky;top:52px;flex-shrink:0}
.app-main{flex:1;padding:22px;overflow-x:hidden;min-width:0}

@media (max-width:900px){
  .app-header{padding:0 12px;gap:8px}
  .app-main{padding:16px 12px 84px}
  /* Navigation becomes a bar pinned to the bottom, where a thumb can reach it. */
  .app-sidebar{position:fixed;bottom:0;left:0;right:0;top:auto;width:auto;min-height:0;
    display:flex;gap:4px;overflow-x:auto;padding:8px;z-index:90;
    border-right:none;border-top:1px solid ${T.border}}
  .app-sidebar .nav-item{width:auto;flex:0 0 auto;white-space:nowrap;padding:8px 12px}
  /* The FY config summary is desktop-only detail; the bar has no room for it. */
  .app-sidebar .sidebar-meta{display:none}
  .stat-card{min-width:calc(50% - 6px)}
  /* Financial-year tabs scroll sideways rather than stacking into a column
     that pushes the whole dashboard down the page. */
  .fy-tabs{flex-wrap:nowrap !important;overflow-x:auto;padding-bottom:2px}
  .modal{padding:20px}
}

@media (max-width:560px){
  .app-header{height:auto;padding:8px 12px;flex-wrap:wrap;position:static}
  .app-header .header-actions{width:100%;justify-content:space-between}
  .gauge-grid{grid-template-columns:1fr !important}
  .gauge-grid > div:first-child{border-right:none !important;padding-right:0 !important;
    border-bottom:1px solid ${T.border};padding-bottom:18px;margin-bottom:18px}
  .gauge-grid > div:last-child{padding-left:0 !important}
  .networth-grid{grid-template-columns:1fr !important}
  .stat-card{min-width:100%}
}
`;

export { T, CC, STYLES };
