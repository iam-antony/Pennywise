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

export { T, CC, STYLES };
