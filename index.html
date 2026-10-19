<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Atelier — Planification de production</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    box-sizing: border-box;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);

    /* Coque : toujours sombre, indépendante du thème des cartes */
    --shell-bg: radial-gradient(ellipse 900px 500px at 15% -10%, #16233A 0%, transparent 60%), linear-gradient(160deg, #0A0F1C 0%, #070B14 100%);
    --shell-text: #EAEFF9;
    --shell-line: rgba(255,255,255,0.08);
    --sidebar-bg: #0A0F1D;
    --sidebar-text: #EAEFF9;

    /* Cartes : claires par défaut (bascule possible vers sombre) */
    --paper-raised: #F4F6FA;
    --paper-raised-2: #E9ECF3;
    --field-bg: #E7EAF1;
    --ink-900: #161C2C;
    --ink-700: #4B5468;
    --ink-500: #838BA0;
    --line: #E3E6EE;
    --accent-amber: #F5A623;
    --accent-amber-text: #9A5B0A;
    --accent-amber-soft: #FCEACB;
    --accent-teal: #16B8A6;
    --accent-teal-soft: #D7F3EF;
    --accent-green: #22B573;
    --accent-green-soft: #D8F3E6;
    --danger: #F0564B;
    --danger-text: #C8291F;
    --danger-soft: #FBDBD8;
    --shadow-sm: 0 1px 2px rgba(20,24,40,0.06);
    --shadow-md: 0 8px 24px -6px rgba(20,24,40,0.14), 0 2px 6px rgba(20,24,40,0.08);
    --shadow-lg: 0 24px 60px -16px rgba(10,14,28,0.35), 0 4px 14px rgba(10,14,28,0.18);
    --glow-teal: 0 0 0 1px rgba(22,184,166,0.3), 0 0 20px rgba(22,184,166,0.15);
    --radius-sm: 7px;
    --radius-md: 11px;
    --radius-lg: 16px;
    --ease: cubic-bezier(.2,.7,.3,1);
  }
  /* Cartes sombres — variante bascule (switch dans la sidebar) */
  :root[data-theme="dark"] {
    --paper-raised: #131B2E;
    --paper-raised-2: #1A2438;
    --field-bg: #0E1422;
    --ink-900: #EAEFF9;
    --ink-700: #AEB8CE;
    --ink-500: #7B8499;
    --line: rgba(255,255,255,0.09);
    --accent-amber: #FBBF24;
    --accent-amber-text: #FBBF24;
    --accent-amber-soft: rgba(251,191,36,0.14);
    --accent-teal: #2DD4C7;
    --accent-teal-soft: rgba(45,212,199,0.14);
    --accent-green: #34D399;
    --accent-green-soft: rgba(52,211,153,0.14);
    --danger: #F87171;
    --danger-text: #F87171;
    --danger-soft: rgba(248,113,113,0.14);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 8px 24px -6px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.3);
    --shadow-lg: 0 24px 60px -16px rgba(0,0,0,0.6), 0 4px 14px rgba(0,0,0,0.35);
    --glow-teal: 0 0 0 1px rgba(45,212,199,0.35), 0 0 20px rgba(45,212,199,0.18);
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  html { scroll-padding-top: env(safe-area-inset-top, 0px); }
  body {
    margin: 0;
    background: var(--shell-bg);
    background-attachment: fixed;
    color: var(--shell-text);
    font-family: "IBM Plex Sans", sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  code, .mono { font-family: "IBM Plex Mono", monospace; }
  h1, h2, h3, .display { font-family: "Space Grotesk", sans-serif; font-weight: 600; letter-spacing: -0.01em; }

  /* À l'intérieur d'une carte, le texte redevient celui du thème carte */
  .panel, .modal, .kpi, table, .donut-center { color: var(--ink-900); }

  a { color: inherit; }
  button { font-family: inherit; }

  /* ---- Layout shell ---- */
  .shell {
    display: grid;
    grid-template-columns: 216px 1fr;
    min-height: 100%;
  }
  @media (max-width: 820px) {
    .shell { grid-template-columns: 1fr; }
    .side { display: none; }
    .side.open { display: flex; position: fixed; inset: 0; z-index: 50; width: 260px; box-shadow: 4px 0 24px rgba(0,0,0,.25); }
  }

  .side {
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
    display: flex;
    flex-direction: column;
    padding: 18px 12px;
    gap: 2px;
    padding-top: calc(18px + env(safe-area-inset-top, 0px));
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .brand {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 8px 20px 8px;
  }
  .brand .mark {
    width: 32px; height: 32px; border-radius: 9px;
    background: linear-gradient(145deg, var(--accent-teal), #0E6F65);
    display: flex; align-items: center; justify-content: center;
    color: #06211D; font-family: "Space Grotesk", sans-serif; font-weight: 700; font-size: 15px;
    flex-shrink: 0; box-shadow: var(--glow-teal);
  }
  .brand .txt { line-height: 1.2; }
  .brand .txt .name { font-family: "Space Grotesk", sans-serif; font-size: 15.5px; font-weight: 700; color: var(--sidebar-text); }
  .brand .txt small { display:block; font-family: "IBM Plex Mono", monospace; font-size: 9.5px; letter-spacing: .04em; opacity: .5; font-weight: 400; margin-top: 1px; }
  .navbtn {
    position: relative;
    display: flex; align-items: center; gap: 11px;
    background: transparent; border: none; color: var(--sidebar-text);
    opacity: .62;
    padding: 9px 11px; border-radius: var(--radius-sm); text-align: left;
    font-size: 13.5px; cursor: pointer;
    transition: background .15s var(--ease), opacity .15s var(--ease);
  }
  .navbtn svg { width: 17px; height: 17px; flex-shrink: 0; opacity: .9; }
  .navbtn.active {
    opacity: 1; background: var(--accent-teal-soft); color: var(--accent-teal);
    box-shadow: inset 2.5px 0 0 var(--accent-teal);
  }
  .navbtn.active svg { color: var(--accent-teal); filter: drop-shadow(0 0 6px rgba(45,212,199,0.5)); }
  .navbtn:hover { opacity: 1; background: rgba(255,255,255,0.05); }
  .side-foot { margin-top: auto; padding: 10px 11px 4px; font-size: 10.5px; opacity: .75; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--sidebar-text); }
  .switch { position: relative; width: 34px; height: 18px; border-radius: 999px; background: rgba(255,255,255,0.15); cursor: pointer; flex-shrink: 0; transition: background .18s var(--ease); }
  .switch .knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--sidebar-text); transition: transform .18s var(--ease); }
  .switch[aria-checked="true"] { background: var(--accent-teal); }
  .switch[aria-checked="true"] .knob { transform: translateX(16px); }

  .main { min-width: 0; }
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px; border-bottom: 1px solid var(--shell-line);
    position: sticky; top: env(safe-area-inset-top, 0px); background: rgba(10,15,27,0.55);
    z-index: 5; backdrop-filter: blur(10px);
  }
  .topbar h1 { margin: 0; font-size: 21px; color: var(--shell-text); }
  .topbar .sub { font-size: 12px; color: rgba(234,239,249,0.55); margin-top: 3px; }
  .greeting { font-size: 11.5px; color: var(--accent-teal); font-weight: 600; letter-spacing: .02em; margin-bottom: 2px; }
  .greeting .wave { filter: saturate(1.3); }
  .icon-btn {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--line);
    background: var(--paper-raised); color: var(--ink-700); cursor: pointer;
    transition: background .14s var(--ease), color .14s var(--ease), box-shadow .14s var(--ease);
  }
  .icon-btn:hover { color: var(--accent-teal); box-shadow: var(--glow-teal); }
  .icon-btn-dot { position: absolute; top: 8px; right: 9px; width: 6px; height: 6px; border-radius: 50%; background: var(--danger); box-shadow: 0 0 0 2px var(--paper-raised); }
  .avatar {
    width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg, var(--accent-teal), #189389); color: #06211D;
    font-family: "Space Grotesk", sans-serif; font-weight: 700; font-size: 14px; box-shadow: var(--glow-teal);
  }
  .menubtn { display:none; background: var(--paper-raised); color: var(--ink-900); border:1px solid var(--line); border-radius: var(--radius-sm); width:36px; height:36px; align-items:center; justify-content:center; }
  @media (max-width: 820px) { .menubtn { display:flex; } }

  .content { padding: 22px 24px 64px; max-width: 1180px; }

  /* ---- Common bits ---- */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 12px; margin-bottom: 22px; }
  .kpi {
    background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--radius-md);
    padding: 15px 17px; box-shadow: var(--shadow-sm); transition: box-shadow .18s var(--ease), transform .18s var(--ease);
    border-left: 3px solid var(--accent-teal); position: relative; overflow: hidden;
  }
  .kpi.accent-amber { border-left-color: var(--accent-amber); }
  .kpi.accent-danger { border-left-color: var(--danger); }
  .kpi:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
  .kpi .v { font-family: "Space Grotesk", sans-serif; font-size: 27px; font-weight: 700; }
  .kpi .l { font-size: 11.5px; color: var(--ink-500); margin-top: 2px; }
  .kpi.warn .v, .kpi.accent-danger .v { color: var(--danger-text); }

  .donut-row { display: flex; align-items: center; gap: 28px; padding: 20px; flex-wrap: wrap; }
  .donut-wrap { position: relative; width: 140px; height: 140px; flex-shrink: 0; }
  .donut { width: 140px; height: 140px; border-radius: 50%; }
  .donut-center {
    position: absolute; inset: 18px; border-radius: 50%; background: var(--paper-raised);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .donut-center .v { font-family: "Space Grotesk", sans-serif; font-size: 22px; font-weight: 700; }
  .donut-center .l { font-size: 9.5px; color: var(--ink-500); text-align: center; }
  .donut-legend { display: flex; flex-direction: column; gap: 10px; min-width: 160px; }
  .donut-legend-row { display: flex; align-items: center; gap: 9px; font-size: 13px; }
  .donut-legend-row .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .donut-legend-row .label { flex: 1; color: var(--ink-700); }
  .donut-legend-row .pct { color: var(--ink-500); font-size: 12px; }

  .panel {
    background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--radius-md);
    overflow: hidden; margin-bottom: 20px; box-shadow: var(--shadow-sm);
  }
  .panel-head { display:flex; align-items:center; justify-content:space-between; padding: 15px 18px; border-bottom: 1px solid var(--line); }
  .panel-head h2 { margin: 0; font-size: 15.5px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-weight: 500; color: var(--ink-500); font-size: 11px; padding: 10px 16px; border-bottom: 1px solid var(--line); letter-spacing: .02em; text-transform: uppercase; }
  td { padding: 11px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .12s var(--ease); }
  tbody tr:hover td { background: rgba(62,110,100,0.045); }

  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .tag.ok { background: var(--accent-teal); color: #fff; }
  .tag.warn { background: var(--accent-amber); color: #4A2E00; }
  .tag.danger { background: var(--danger); color: #fff; }
  .statut-btn { background: none; border: none; padding: 0; cursor: pointer; }
  .statut-btn .tag { transition: filter .12s var(--ease); }
  .statut-btn:hover .tag { filter: brightness(0.93); }

  /* ---- Lignes de type "production" (accent + icône + menu ···) ---- */
  .row-icon-cell { width: 46px; }
  tr[class^="row-accent-"] td:nth-child(2) { border-left: 3px solid transparent; padding-left: 13px; }
  tr.row-accent-teal td:nth-child(2) { border-left-color: var(--accent-teal); }
  tr.row-accent-amber td:nth-child(2) { border-left-color: var(--accent-amber); }
  tr.row-accent-danger td:nth-child(2) { border-left-color: var(--danger); }
  tr.row-accent-green td:nth-child(2) { border-left-color: var(--accent-green); }
  .row-icon {
    width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;
  }
  .row-icon svg { width: 15px; height: 15px; }
  .row-icon.teal { background: var(--accent-teal-soft); color: var(--accent-teal); }
  .row-icon.amber { background: var(--accent-amber-soft); color: var(--accent-amber-text); }
  .row-icon.danger { background: var(--danger-soft); color: var(--danger-text); }
  .row-icon.green { background: var(--accent-green-soft); color: var(--accent-green); }
  .row-icon.muted { background: var(--paper-raised-2); color: var(--ink-500); }
  .row-title { font-weight: 600; font-family: "IBM Plex Mono", monospace; font-size: 12px; }
  .row-sub { color: var(--ink-500); font-size: 12px; margin-top: 1px; }
  .chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; background: var(--paper-raised-2); color: var(--ink-700); }
  .etat { font-size: 12.5px; font-weight: 600; }
  .etat-teal { color: var(--accent-teal); }
  .etat-amber { color: var(--accent-amber-text); }
  .etat-danger { color: var(--danger-text); }
  .etat-green { color: var(--accent-green); }
  .etat-muted { color: var(--ink-500); }
  .row-menu-cell { width: 36px; }
  .row-menu-btn {
    width: 28px; height: 28px; border-radius: 50%; border: none; background: transparent; color: var(--ink-500);
    display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .12s var(--ease);
  }
  .row-menu-btn svg { width: 16px; height: 16px; }
  .row-menu-btn:hover { background: var(--paper-raised-2); color: var(--ink-900); }
  .row-menu {
    position: absolute; background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg); z-index: 150; overflow: hidden; min-width: 190px; color: var(--ink-900);
  }
  .row-menu button {
    display: block; width: 100%; text-align: left; padding: 9px 13px; background: none; border: none; cursor: pointer;
    font-size: 12.5px; color: var(--ink-900); transition: background .12s var(--ease);
  }
  .row-menu button:hover { background: var(--paper-raised-2); }
  .row-menu button.danger { color: var(--danger-text); border-top: 1px solid var(--line); }
  .btn.danger-btn { background: var(--danger); color: #fff; border-color: transparent; font-weight: 600; }
  .btn.btn-icon-danger { padding: 8px 10px; color: var(--danger-text); }
  .btn.btn-icon-danger:hover { background: var(--danger-soft); }
  .btn.danger-btn:hover { box-shadow: 0 0 0 1px rgba(240,86,75,0.45), 0 0 22px rgba(240,86,75,0.25), var(--shadow-md); }

  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink-900);
    padding: 8px 15px; border-radius: 999px; font-size: 12.5px; font-weight: 500; cursor: pointer;
    transition: transform .14s var(--ease), box-shadow .14s var(--ease), background .14s var(--ease);
    box-shadow: var(--shadow-sm);
  }
  .btn svg { width: 14px; height: 14px; }
  .btn.primary {
    background: linear-gradient(145deg, var(--accent-teal), #189389); color: #06211D; border-color: transparent;
    box-shadow: var(--glow-teal); font-weight: 600;
  }
  .btn.primary:hover { box-shadow: 0 0 0 1px rgba(45,212,199,0.45), 0 0 26px rgba(45,212,199,0.3), var(--shadow-md); }
  .btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
  .btn:active { transform: translateY(0); }
  .btn:focus-visible, .navbtn:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent-teal); outline-offset: 1px; }

  input, select {
    font-family: inherit; font-size: 13px; padding: 8px 10px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--field-bg);
    color: var(--ink-900); transition: border-color .14s var(--ease), box-shadow .14s var(--ease);
  }
  input:focus, select:focus { border-color: var(--accent-teal); box-shadow: 0 0 0 3px var(--accent-teal-soft); outline: none; }
  label { font-size: 11.5px; color: var(--ink-500); display:block; margin-bottom: 4px; font-weight: 500; }
  .field { display:flex; flex-direction: column; }
  .formgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 12px; padding: 16px; border-top: 1px solid var(--line); }

  /* ---- Gantt ---- */
  .gantt-wrap { overflow-x: auto; padding: 4px 0 16px; }
  .gantt { border-collapse: separate; border-spacing: 0; min-width: 760px; width: 100%; }
  .gantt th.day { text-align: center; font-size: 11px; padding: 9px 4px; border-bottom: 1px solid var(--line); color: var(--ink-500); font-weight: 500; letter-spacing: .02em; }
  .gantt th.day.today { color: var(--accent-teal); position: relative; }
  .gantt th.day.today::after { content: ''; position: absolute; bottom: -1px; left: 50%; transform: translateX(-50%); width: 24px; height: 2px; background: var(--accent-teal); border-radius: 2px; }
  .gantt td.machine-cell {
    padding: 9px 16px 9px 13px; border-bottom: 1px solid var(--line); border-right: 1px solid var(--line);
    font-size: 12.5px; white-space: nowrap; background: var(--paper-raised); position: sticky; left: 0;
    border-left: 3px solid transparent;
  }
  .gantt td.machine-cell.row-accent-teal { border-left-color: var(--accent-teal); }
  .gantt td.machine-cell.row-accent-muted { border-left-color: var(--line); }
  .gantt td.machine-cell .m-row { display: flex; align-items: center; gap: 10px; }
  .gantt td.machine-cell .m-name { font-weight: 600; }
  .gantt td.machine-cell .m-sub { color: var(--ink-500); font-size: 10.5px; font-family: "IBM Plex Mono", monospace; }
  .gantt tbody tr:hover td.machine-cell { background: var(--accent-teal-soft); }
  .gantt td.slot { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); height: 56px; padding: 4px; position: relative; transition: background .12s var(--ease); }
  .bar {
    height: 100%; border-radius: 999px; padding: 5px 6px 5px 11px; font-size: 10.5px; color: #fff;
    display: flex; align-items: center; justify-content: space-between; gap: 6px; overflow: hidden; cursor: default;
    box-shadow: var(--shadow-sm); transition: transform .14s var(--ease), box-shadow .14s var(--ease);
  }
  .bar:hover { transform: translateY(-1px) scale(1.015); box-shadow: var(--shadow-md); }
  .bar .b-text { display: flex; flex-direction: column; justify-content: center; overflow: hidden; min-width: 0; }
  .bar .b-of { font-family: "IBM Plex Mono", monospace; opacity: .85; font-size: 9.5px; }
  .bar .b-pct {
    flex-shrink: 0; background: rgba(255,255,255,0.28); color: #fff; font-weight: 700;
    font-size: 9.5px; padding: 3px 7px; border-radius: 999px;
  }

  .metric-strip { display: flex; }
  .metric { flex: 1; display: flex; align-items: center; gap: 12px; padding: 18px 20px; position: relative; }
  .metric:not(:last-child)::after { content: ''; position: absolute; right: 0; top: 18%; bottom: 18%; width: 1px; background: var(--line); }
  .metric-icon {
    width: 38px; height: 38px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .metric-icon svg { width: 18px; height: 18px; }
  .metric-icon.teal { background: var(--accent-teal-soft); color: var(--accent-teal); }
  .metric-icon.amber { background: var(--accent-amber-soft); color: var(--accent-amber-text); }
  .metric-icon.danger { background: var(--danger-soft); color: var(--danger-text); }
  .metric .v { font-family: "Space Grotesk", sans-serif; font-size: 20px; font-weight: 700; line-height: 1.1; }
  .metric .l { font-size: 11px; color: var(--ink-500); margin-top: 1px; }
  @media (max-width: 700px) {
    .metric-strip { flex-direction: column; }
    .metric:not(:last-child)::after { right: 20px; left: 20px; bottom: 0; top: auto; width: auto; height: 1px; }
  }
  .bar .b-name { font-weight: 500; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }

  .legend { display: flex; gap: 14px; padding: 10px 16px; font-size: 11px; color: var(--ink-500); flex-wrap: wrap; }
  .legend span { display:inline-flex; align-items:center; gap:5px; }
  .legend i { width: 10px; height: 10px; border-radius: 3px; display:inline-block; }

  .empty { padding: 36px 16px; text-align: center; color: var(--ink-500); font-size: 12.5px; }

  .bar-track { background: var(--line); border-radius: 4px; height: 6px; overflow: hidden; margin-top: 4px; }
  .bar-fill { height: 100%; background: var(--accent-teal); transition: width .3s var(--ease); }
  .bar-fill.warn { background: var(--accent-amber); }
  .bar-fill.danger { background: var(--danger); }
  .bar-track.tall { height: 10px; position: relative; margin: 4px 0; }
  .jauge-prevu { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ink-900, #222); opacity: .65; }
  .sp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .co-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .co-tab.active { background: var(--accent-teal); color: #fff; }
  .dv-h { margin: 16px 0 6px; font-size: 14px; }
  .sp-table th { text-align: left; font-size: 11px; color: var(--ink-500); padding: 4px 8px; }
  .sp-table td { padding: 8px; border-top: 1px solid var(--line); vertical-align: top; }

  .hidden { display: none !important; }

  /* ---- Modale ---- */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(20,22,18,0.45); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; z-index: 100;
    padding: 20px; animation: fadeIn .16s var(--ease);
  }
  .modal {
    background: var(--paper-raised); border-radius: var(--radius-lg); border: 1px solid var(--line);
    width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto;
    padding: 22px; box-shadow: var(--shadow-lg);
    animation: popIn .18s var(--ease);
    position: relative;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes popIn { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .modal h3 { margin: 0 0 16px; font-size: 17px; padding-right: 24px; }
  .modal .modal-close {
    position: absolute; top: 18px; right: 18px; width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; background: transparent; border: none;
    color: var(--ink-500); cursor: pointer; transition: background .12s var(--ease);
  }
  .modal .modal-close:hover { background: var(--line); }
  .modal .field { margin-bottom: 13px; }
  .modal .field label { margin-bottom: 4px; }
  .modal .field input, .modal .field select { width: 100%; }
  .modal .op-list { display: flex; flex-direction: column; gap: 7px; max-height: 160px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 9px; background: var(--field-bg); }

  .modal.large { max-width: 780px; }
  .modal.xlarge { max-width: 1000px; }
  .slot .stack { display: flex; flex-direction: column; gap: 2px; min-height: 100%; }
  .bar.compact { border-radius: 7px; padding: 2px 8px; min-height: 17px; flex: 1; gap: 6px; font-size: 10px; align-items: center; }
  .bar.compact .b-name { font-weight: 600; }
  .bar.compact .b-time { font-family: "IBM Plex Mono", monospace; font-size: 9.5px; opacity: .9; flex-shrink: 0; }
  .plan-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px 14px; align-items: end; margin-bottom: 14px; }
  .plan-controls .field { margin-bottom: 0; }
  .plan-check label { display: flex; align-items: center; gap: 7px; font-weight: 400; color: var(--ink-700); margin: 0; }
  .plan-resume { display: flex; flex-wrap: wrap; gap: 8px 28px; align-items: center; background: var(--paper-raised-2); border-radius: var(--radius-md); padding: 11px 15px; margin-bottom: 10px; }
  .plan-resume .plan-k { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-500); }
  .plan-resume strong { font-family: "Space Grotesk", sans-serif; font-size: 15px; }
  .plan-note { font-size: 11.5px; color: var(--ink-500); font-weight: 400; }
  .plan-alt { font-size: 12.5px; color: var(--ink-700); margin: 0 0 10px; padding: 8px 12px; border-left: 3px solid var(--accent-amber); background: var(--accent-amber-soft); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
  .plan-bloquants { font-size: 12.5px; color: var(--danger-text); background: var(--danger-soft); border-radius: var(--radius-sm); padding: 9px 13px; margin-bottom: 10px; }
  .plan-bloquants ul { margin: 4px 0 0; padding-left: 18px; }
  .plan-hint { font-size: 11.5px; color: var(--ink-500); margin: 12px 0 8px; }
  .plan-step { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 11px 14px; margin-bottom: 10px; background: var(--paper-raised); }
  .plan-step.fixe { padding: 8px 14px; background: var(--paper-raised-2); }
  .pl-details summary { cursor: pointer; font-size: 13px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--field-bg); list-style: none; }
  .pl-details[open] summary { margin-bottom: 6px; }
  .gh-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--paper-raised); }
  .gh { position: relative; }
  .gh-head { display: flex; border-bottom: 1px solid var(--line); background: var(--paper-raised-2); }
  .gh-head .gh-label { width: var(--label); flex-shrink: 0; }
  .gh-day { text-align: center; font-size: 11px; font-weight: 600; padding: 7px 0; color: var(--ink-700); border-left: 1px solid var(--line); text-transform: capitalize; flex-shrink: 0; }
  .gh-body { position: relative; }
  .gh-grid { position: absolute; top: 0; bottom: 0; pointer-events: none; }
  .gh-col { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--line); }
  .gh-pause { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, transparent 0 4px, var(--line) 4px 5px); opacity: .7; }
  .gh-row { display: flex; height: 28px; align-items: center; border-bottom: 1px dashed var(--line); position: relative; }
  .gh-row:last-child { border-bottom: none; }
  .gh-label { width: var(--label); flex-shrink: 0; padding: 0 10px; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .gh-label em { font-style: normal; color: var(--ink-500); }
  .gh-track { position: relative; height: 100%; flex-shrink: 0; }
  .gh-bar { position: absolute; top: 5px; height: 18px; border-radius: 5px; font-size: 9.5px; font-family: "IBM Plex Mono", monospace; color: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; box-shadow: var(--shadow-sm); }
  .gh-bar.machine { background: var(--accent-teal); }
  .gh-bar.main { background: var(--accent-amber); color: #4A2E00; }
  .blocage-groupe { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 10px; background: var(--paper-raised-2); }
  .blocage-titre { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
  .blocage-groupe ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--ink-900); }
  .blocage-groupe li { margin-bottom: 3px; }
  .blocage-conseil { margin-top: 8px; font-size: 12px; color: var(--ink-500); padding-top: 7px; border-top: 1px dashed var(--line); }
  .note-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .formule-cell { font-size: 11.5px; color: var(--ink-700); }
  .modal textarea { width: 100%; font-family: "IBM Plex Mono", monospace; font-size: 12.5px; padding: 9px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--field-bg); color: var(--ink-900); resize: vertical; }
  .modal textarea:focus { border-color: var(--accent-teal); box-shadow: 0 0 0 3px var(--accent-teal-soft); outline: none; }
  .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 7px; }
  .chips-label { font-size: 11px; color: var(--ink-500); margin-right: 2px; }
  .chip-btn { border: 1px solid var(--line); background: var(--paper-raised); color: var(--ink-900); border-radius: 999px; padding: 2px 9px; font-size: 11.5px; cursor: pointer; font-family: "IBM Plex Mono", monospace; }
  .chip-btn:hover { border-color: var(--accent-teal); color: var(--accent-teal); }
  .chip-btn.fn { background: var(--paper-raised-2); }
  .chip-btn.ex { font-family: "IBM Plex Sans", sans-serif; font-style: italic; }
  .aide-formule { margin-top: 8px; font-size: 12px; color: var(--ink-700); }
  .aide-formule summary { cursor: pointer; color: var(--ink-500); }
  .aide-formule p { margin: 6px 0 0; }
  .aide-formule code { font-family: "IBM Plex Mono", monospace; font-size: 11.5px; background: var(--paper-raised-2); padding: 1px 5px; border-radius: 4px; }
  .apercu { margin-top: 10px; border: 1px dashed var(--line); border-radius: var(--radius-md); padding: 10px 12px; background: var(--paper-raised-2); }
  .apercu-titre { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-500); margin-bottom: 6px; }
  .apercu-champs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px 12px; }
  .apercu-champ { font-size: 11.5px; color: var(--ink-700); font-weight: 400; margin: 0; }
  .apercu-champ input { width: 100%; margin-top: 3px; padding: 5px 8px; font-size: 12.5px; }
  .apercu-note { font-size: 12px; color: var(--ink-500); margin-top: 6px; }
  .apercu-res { font-size: 15px; margin-top: 8px; font-family: "Space Grotesk", sans-serif; }
  .apercu-res span { font-size: 11.5px; color: var(--ink-500); font-family: "IBM Plex Sans", sans-serif; }
  .produit-box { border: 1px solid var(--accent-teal); background: var(--accent-teal-soft); border-radius: var(--radius-md); padding: 11px 14px; margin-bottom: 12px; }
  .produit-titre { font-weight: 600; font-size: 13px; margin-bottom: 8px; }
  .import-lignes { max-height: 260px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-md); margin-top: 10px; }
  .dispo-strip { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .dispo-chip { font-size: 11.5px; padding: 3px 7px; border-radius: 7px; border: 1px solid var(--line); background: var(--field-bg); color: var(--ink-700); cursor: default; line-height: 1.3; font-family: inherit; }
  .dispo-chip.libre { border-color: var(--accent-teal); color: var(--ink-900); cursor: pointer; }
  .dispo-chip.occupe { background: rgba(214, 69, 65, .12); border-color: rgba(214, 69, 65, .45); text-decoration: line-through; }
  .dispo-chip.maintenance { background: rgba(230, 160, 20, .16); border-color: rgba(230, 160, 20, .5); }
  .dispo-chip.choisi { outline: 2px solid var(--accent-teal); font-weight: 600; }
  .dispo-legende { font-size: 11.5px; color: var(--ink-500); margin-top: 4px; width: 100%; }
  .profil-ligne { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
  .pl-pers-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .pl-heures-wrap { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--ink-500); white-space: nowrap; }
  .pl-heures { width: 110px; padding: 3px 6px; font-size: 12px; }
  .pred-list { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--field-bg); }
  .pred-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  .pred-name { font-size: 12.5px; min-width: 200px; display: inline-flex; align-items: center; justify-content: flex-start; text-align: left; gap: 8px; cursor: pointer; margin: 0; font-weight: 400; color: var(--ink-900); }
  .pred-name input { width: auto; margin: 0; flex: 0 0 auto; }
  .pred-list { align-items: flex-start; }
  .pred-row { justify-content: flex-start; }
  .pred-row select { min-width: 250px; padding: 5px 8px; font-size: 12.5px; }
  .pred-pct { font-size: 12.5px; color: var(--ink-700); display: inline-flex; align-items: center; gap: 5px; }
  .pred-pct input { width: 64px; padding: 4px 6px; font-size: 12.5px; }
  .pred-field { grid-column: 1 / -1; }
  .pred-field small { color: var(--ink-500); font-size: 11px; margin-top: 4px; }
  .crit-dot { color: var(--danger); font-size: 9px; vertical-align: 1px; }
  .plan-ferie { font-size: 12px; color: var(--ink-700); margin: 0 0 10px; padding: 7px 12px; background: var(--paper-raised-2); border-radius: var(--radius-sm); }
  .pert { margin: 14px 0 6px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--paper-raised); }
  .pert summary { cursor: pointer; padding: 10px 14px; font-size: 12.5px; list-style: none; }
  .pert[open] summary { border-bottom: 1px solid var(--line); }
  .pert-wrap { overflow-x: auto; padding: 10px 6px; }
  .pert-note { font-size: 11px; color: var(--ink-500); padding: 0 14px 10px; }
  .pert-edge { fill: none; stroke: var(--ink-500); stroke-width: 1.4; opacity: .7; }
  .pert-edge.crit { stroke: var(--danger); stroke-width: 2.2; opacity: 1; }
  .pert-edge.prog { stroke-dasharray: 5 4; }
  .pert-lien { fill: var(--ink-500); font-size: 10px; font-family: "IBM Plex Sans", sans-serif; }
  .pert-node rect { fill: var(--paper-raised-2); stroke: var(--line); stroke-width: 1.2; }
  .pert-node.crit rect { stroke: var(--danger); stroke-width: 2; }
  .pert-node.fixe rect { stroke-dasharray: 4 3; }
  .pert-node .t1 { fill: var(--ink-900); font-size: 11.5px; font-weight: 600; font-family: "IBM Plex Sans", sans-serif; }
  .pert-node .t2 { fill: var(--ink-500); font-size: 10.5px; font-family: "IBM Plex Sans", sans-serif; }
  .pert-node.crit .t2 { fill: var(--danger-text); }
  .gh-legend { display: flex; gap: 16px; font-size: 11px; color: var(--ink-500); margin: 7px 0 0; }
  .gh-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .gh-legend i.machine { background: var(--accent-teal); }
  .gh-legend i.main { background: var(--accent-amber); }
  .gh-legend i.pause { background: repeating-linear-gradient(135deg, transparent 0 2px, var(--ink-500) 2px 3px); }

  .step-card { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 13px 15px; margin-bottom: 12px; background: var(--paper-raised); }
  .step-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .step-source { font-size: 11.5px; color: var(--ink-500); margin-bottom: 10px; }
  .step-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .step-grid .field { margin-bottom: 0; }
  .phase-list { list-style: none; margin: 10px 0 0; padding: 0; border-top: 1px dashed var(--line); }
  .phase-list li { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 6px 0; font-size: 12.5px; border-bottom: 1px dashed var(--line); }
  .phase-list li:last-child { border-bottom: none; }
  .phase-list li small { grid-column: 1 / -1; color: var(--ink-500); font-size: 11px; }
  .phase-list li em { color: var(--ink-500); font-style: normal; font-size: 11px; }
  .totaux-box { background: var(--paper-raised-2); border-radius: var(--radius-md); padding: 12px 15px; margin-top: 4px; }
  .totaux-box > div { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
  .totaux-box strong { font-family: "Space Grotesk", sans-serif; }
  .totaux-box .totaux-jours { color: var(--ink-700); font-size: 12px; justify-content: flex-start; }
  .totaux-box .totaux-note { color: var(--ink-500); font-size: 11px; display: block; margin-top: 4px; }
  .import-box { margin-bottom: 16px; }
  .import-label {
    display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 1.5px dashed var(--line);
    border-radius: var(--radius-md); cursor: pointer; background: var(--field-bg); transition: border-color .14s var(--ease), background .14s var(--ease);
  }
  .import-label:hover { border-color: var(--accent-teal); background: var(--accent-teal-soft); }
  .import-label svg { width: 22px; height: 22px; color: var(--accent-teal); flex-shrink: 0; }
  .import-label span { font-size: 12px; color: var(--ink-700); line-height: 1.4; }
  .import-label strong { color: var(--ink-900); }
  #import-status { margin-top: 8px; }
  .modal .op-list label { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--ink-900); font-weight: 400; margin: 0; }
  .modal .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
  .modal .msg { font-size: 12px; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
  .modal .msg.error { color: var(--danger-text); }
  .modal .msg.ok { color: var(--accent-teal); }
  .slot.clickable { cursor: pointer; }
  .slot.clickable:hover { background: var(--accent-teal-soft); }
  .slot.clickable:hover::after {
    content: '+'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--accent-teal); font-size: 18px; font-weight: 300; pointer-events: none;
  }

  /* ---- Toasts ---- */
  #toast-root { position: fixed; bottom: 20px; right: 20px; z-index: 200; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
  .toast {
    display: flex; align-items: center; gap: 9px;
    background: var(--sidebar-bg); color: var(--sidebar-text); padding: 11px 16px; border-radius: var(--radius-md);
    font-size: 12.5px; box-shadow: var(--shadow-lg); max-width: 320px; border: 1px solid rgba(255,255,255,0.08);
    animation: toastIn .22s var(--ease);
  }
  .toast.error { background: var(--danger); }
  .toast svg { width: 16px; height: 16px; flex-shrink: 0; }
  .toast.fading { animation: toastOut .18s var(--ease) forwards; }
  @keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes toastOut { to { opacity: 0; transform: translateY(4px) scale(.97); } }
</style>
</head>
<body>
<div class="shell">
  <nav class="side" id="side">
    <div class="brand">
      <div class="mark">A</div>
      <div class="txt"><span class="name">Atelier</span><small>RELIURE INDUSTRIELLE</small></div>
    </div>
    <button class="navbtn active" data-tab="planning">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18"/><path d="M8 2.5v3M16 2.5v3"/></svg>
      Planification
    </button>
    <button class="navbtn" data-tab="ordres">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 12h6M9 17h4"/></svg>
      Ordres de fabrication
    </button>
    <button class="navbtn" data-tab="personnel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><path d="M16.5 4.8a3.2 3.2 0 0 1 0 6.3M21.5 20c0-3-2-5.3-4.8-6"/></svg>
      Personnel
    </button>
    <button class="navbtn" data-tab="machines">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.8 1.8 0 0 0 .36 2l.04.04a2.2 2.2 0 1 1-3.1 3.1l-.04-.04a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65v.1a2.2 2.2 0 1 1-4.4 0v-.06a1.8 1.8 0 0 0-1.17-1.63 1.8 1.8 0 0 0-2 .36l-.04.04a2.2 2.2 0 1 1-3.1-3.1l.04-.04a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.65-1.1h-.1a2.2 2.2 0 1 1 0-4.4h.06a1.8 1.8 0 0 0 1.63-1.17 1.8 1.8 0 0 0-.36-2l-.04-.04a2.2 2.2 0 1 1 3.1-3.1l.04.04a1.8 1.8 0 0 0 2 .36h.1a1.8 1.8 0 0 0 1.1-1.65v-.1a2.2 2.2 0 1 1 4.4 0v.06a1.8 1.8 0 0 0 1.1 1.64h.1a1.8 1.8 0 0 0 2-.36l.04-.04a2.2 2.2 0 1 1 3.1 3.1l-.04.04a1.8 1.8 0 0 0-.36 2v.1a1.8 1.8 0 0 0 1.65 1.1h.1a2.2 2.2 0 1 1 0 4.4h-.06a1.8 1.8 0 0 0-1.64 1.1z"/></svg>
      Machines
    </button>
    <button class="navbtn" data-tab="temps">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      Temps standards
    </button>
    <button class="navbtn" data-tab="stocks">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>
      Stocks &amp; matières
    </button>
    <button class="navbtn" data-tab="reporting">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>
      Reporting
    </button>
    <div class="side-foot">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>
      <span class="switch" id="theme-toggle" role="switch" aria-checked="false" aria-label="Cartes sombres"><span class="knob"></span></span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a7 7 0 0 0 9.5 9.5z"/></svg>
    </div>
  </nav>

  <div class="main">
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:12px;">
        <button class="menubtn" id="menubtn" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <div>
          <div class="greeting">Bonjour, Alain <span class="wave">👋</span></div>
          <h1 id="page-title">Planification</h1>
          <div class="sub" id="page-sub">Chargement de la semaine…</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="icon-btn" title="Rechercher" aria-label="Rechercher">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </button>
        <button class="icon-btn" title="Notifications" aria-label="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          <span class="icon-btn-dot"></span>
        </button>
        <div class="avatar">A</div>
      </div>
    </div>
    <div class="content" id="content"></div>
  </div>
</div>

<div id="modal-root"></div>
<div id="toast-root"></div>


<script>
// Protection générale des appels au serveur : si une fonction répond par une PAGE WEB
// (accès refusé, session expirée, site protégé, panne) au lieu de données, on affiche une
// explication claire à la place de « Unexpected token '<' ... is not valid JSON ».
(function () {
  const original = window.fetch ? window.fetch.bind(window) : null;
  if (!original) return;
  window.fetch = async function (url, options) {
    const res = await original(url, options);
    try {
      const type = (res && res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (String(url).includes('/.netlify/functions/') && type.toLowerCase().includes('text/html')) {
        const code = res.status;
        const message = (code === 401 || code === 403)
          ? `Accès refusé (code ${code}) : le serveur a répondu par une page de connexion ou de protection au lieu de données. Rechargez la page (Ctrl+F5) et réessayez ; si cela se reproduit, vérifiez la protection d'accès du site dans Netlify.`
          : `Réponse inattendue du serveur (code ${code}, une page web au lieu de données). Réessayez dans un instant ; si cela persiste, consultez les journaux de la fonction dans Netlify.`;
        return { ok: false, status: code, headers: res.headers, json: async () => ({ error: message }), text: async () => message };
      }
    } catch (e) { /* en cas de doute, on laisse passer la réponse d'origine */ }
    return res;
  };
})();
(function(){

  // ---------- Données réelles de l'atelier (référentiels validés) ----------
  const state = {
    tab: 'planning',
    machines: [
      { id:'SIGLOCH',   name:'Sigloch',    code:'SIGLOCH',   competence:'Pressure en colle' },
      { id:'KOLBUS',    name:'Kolbus',     code:'KOLBUS',    competence:'Pressure en colle' },
      { id:'BUFFALO',   name:'Buffalo',    code:'BUFFALO',   competence:'Assemblage' },
      { id:'MULTIPLEX', name:'Multiplex',  code:'MULTIPLEX', competence:'Assemblage' },
      { id:'INVENTA_1', name:'Inventa 1',  code:'INVENTA_1', competence:'Assemblage' },
      { id:'INVENTA_2', name:'Inventa 2',  code:'INVENTA_2', competence:'Assemblage' },
      { id:'VENTURIA',  name:'Venturia',   code:'VENTURIA',  competence:'Assemblage' },
      { id:'321D',      name:'321D',       code:'321D',      competence:'Couture' },
      { id:'DA',        name:'DA',         code:'DA',        competence:'Montage de couverture (cartonnés)' },
      { id:'BDM',       name:'BDM',        code:'BDM',       competence:'Montage de couverture (Pléiade)' },
      { id:'INTEGRA',   name:'Intégra',    code:'INTEGRA',   competence:'Montage de couverture' },
      { id:'PL_PL',     name:'PL-PL',      code:'PL_PL',     competence:'Dorure' },
      { id:'PLUJADI',   name:'Plujadi',    code:'PLUJADI',   competence:'Dorure' },
      { id:'CRIF',      name:'Crif',       code:'CRIF',      competence:'Pliure' },
      { id:'MBO2',      name:'MBO2',       code:'MBO2',      competence:'Pliure' },
      { id:'STAHL',     name:'Stahl',      code:'STAHL',     competence:'Pliure' },
    ],
    personnel: [
      { id:'P1',  name:'Corinne',   role:'Opératrice couture', comp:['couture','finition'], statut:'Posté', charge:70 },
      { id:'P2',  name:'Céline',    role:'Opératrice couture', comp:['couture','finition','travaux mains'], statut:'Posté', charge:66 },
      { id:'P3',  name:'Valery',    role:'Opérateur pressure en colle', comp:['pressure en colle','massicot'], statut:'Posté', charge:82 },
      { id:'P4',  name:'Romuald',   role:'Opérateur massicot', comp:['massicot','magasin'], statut:'Posté', charge:58 },
      { id:'P5',  name:'Louka',     role:'Opérateur pressure en colle', comp:['pressure en colle','finition'], statut:'Posté', charge:74 },
      { id:'P6',  name:'Bouba',     role:'Opérateur production pliure', comp:['pliure','finition'], statut:'Posté', charge:69 },
      { id:'P7',  name:'Giacomo',   role:'Opérateur production dorure', comp:['dorure','finition'], statut:'Posté', charge:77 },
      { id:'P8',  name:'Anita',     role:'Opératrice dorure coins ronds', comp:['dorure coins ronds','finition','réparation'], statut:'Posté', charge:63 },
      { id:'P9',  name:'Sarry',     role:'Opératrice contrôle emboîtage', comp:['contrôle emboîtage','réparation'], statut:'Posté', charge:55 },
      { id:'P10', name:'Sam',       role:'Opérateur production dorure', comp:['dorure','finition'], statut:'Posté', charge:71 },
      { id:'P11', name:'Sébastien', role:'Conducteur chaîne emboîtage', comp:['emboîtage 1','emboîtage 2','pressure en colle'], statut:'Posté', charge:85 },
      { id:'P12', name:'Maria',     role:'Opératrice refente peaux', comp:['refente','préparation peaux','finition'], statut:'Posté', charge:60 },
      { id:'P13', name:'Claudine',  role:'Contrôle couvertures pléiade', comp:['contrôle couverture','réparation','finition'], statut:'Posté', charge:52 },
      { id:'P14', name:'Helena',    role:'Opératrice réparation pléiade', comp:['réparation','finition'], statut:'Posté', charge:48 },
      { id:'P15', name:'Alain',     role:'Agent de maîtrise / contremaître', comp:['encadrement'], statut:'Posté', charge:0 },
      { id:'P16', name:'Stéphanie', role:'Opératrice production assemblage', comp:['assemblage','emboîtage 1','emboîtage 2','finition','dorure'], statut:'Posté', charge:80 },
      { id:'P17', name:'Ghislaine', role:'Opératrice réparation', comp:['réparation'], statut:'Posté', charge:45 },
      { id:'P18', name:'Patrick',   role:'Opérateur de finition', comp:['finition','tri peaux'], statut:'Posté', charge:57 },
      { id:'P19', name:'Kevin',     role:'Opérateur de finition', comp:['finition'], statut:'Posté', charge:50 },
      { id:'P20', name:'Stéphane',  role:'Opérateur réparation', comp:['réparation','finition'], statut:'Posté', charge:49 },
      { id:'P21', name:'Fabrice',   role:'Maintenance', comp:['maintenance'], statut:'Posté', charge:40 },
      { id:'P22', name:'Benoit',    role:'Conducteur couverturières (BDM, DA, Intégra)', comp:['montage couverture','découpe matière'], statut:'Posté', charge:83 },
      { id:'P23', name:'Cindy',     role:'Opératrice contrôle emboîtage', comp:['contrôle emboîtage','finition'], statut:'Absent — congé', charge:0 },
      { id:'P24', name:'Sandrine',  role:'Conducteur chaîne emboîtage', comp:['emboîtage 1','emboîtage 2','finition'], statut:'Posté', charge:68 },
    ],
    stocks: [
      { id:'S1', name:'Papier offset 90g (bobine)', unite:'kg', qte:1240, seuil:800, statut:'ok' },
      { id:'S2', name:'Couverture couchée 250g', unite:'feuilles', qte:3200, seuil:3000, statut:'warn' },
      { id:'S3', name:'Colle thermofusible', unite:'kg', qte:64, seuil:80, statut:'danger' },
      { id:'S4', name:'Fil de couture', unite:'bobines', qte:22, seuil:10, statut:'ok' },
      { id:'S5', name:'Carton dos rigide', unite:'feuilles', qte:410, seuil:500, statut:'warn' },
      { id:'S6', name:'Peaux (cuir reliure)', unite:'peaux', qte:86, seuil:100, statut:'warn' },
    ],
    ordres: [
      { id:'OF-2214', produit:'Roi Arthur (GF 29)', client:'Éditions Pléiade', qte:6000, delai:'26/09', priorite:'haute', statut:'en cours', avancement:62 },
      { id:'OF-2215', produit:'Trône de Fer 4', client:'Éditions Pléiade', qte:4500, delai:'29/09', priorite:'normale', statut:'planifié', avancement:0 },
      { id:'OF-2216', produit:'Zola RM2', client:'Éditions Pléiade', qte:2000, delai:'25/09', priorite:'urgente', statut:'en cours', avancement:81 },
      { id:'OF-2217', produit:'Foucault (D030)', client:'France O.', qte:3200, delai:'02/10', priorite:'normale', statut:'planifié', avancement:0 },
      { id:'OF-2218', produit:'Mansfield (D035)', client:'France O.', qte:1500, delai:'30/09', priorite:'haute', statut:'en pause', avancement:34 },
    ],
    // planning: machineId -> liste de créneaux {day(0-6), ofId, statut}
    planning: {
      SIGLOCH:   [ {day:0, of:'OF-2214', statut:'ok'}, {day:1, of:'OF-2214', statut:'ok'} ],
      KOLBUS:    [ {day:0, of:'OF-2216', statut:'ok'}, {day:3, of:'OF-2216', statut:'danger'} ],
      BUFFALO:   [ {day:2, of:'OF-2217', statut:'ok'} ],
      INVENTA_1: [ {day:1, of:'OF-2215', statut:'ok'} ],
      DA:        [ {day:0, of:'OF-2214', statut:'ok'}, {day:4, of:'OF-2218', statut:'warn'} ],
      BDM:       [ {day:2, of:'OF-2216', statut:'ok'} ],
      PL_PL:     [ {day:3, of:'OF-2217', statut:'ok'} ],
      PLUJADI:   [ {day:4, of:'OF-2218', statut:'warn'} ],
      CRIF:      [ {day:1, of:'OF-2214', statut:'ok'}, {day:2, of:'OF-2215', statut:'ok'} ],
      STAHL:     [ {day:0, of:'OF-2216', statut:'ok'} ],
    }
  };

  // ---------- Semaine réelle (calculée), au lieu des libellés fixes de la démo ----------
  function lundiDeLaSemaine(d) {
    const date = new Date(d);
    const jour = date.getUTCDay() || 7; // dimanche -> 7
    date.setUTCDate(date.getUTCDate() - jour + 1);
    return date;
  }
  const JOURS_ABREGES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const AUJOURDHUI_ISO = new Date().toISOString().slice(0, 10);
  let LUNDI, DAYS_ISO, DAYS, TODAY_IDX;
  function libelleSemaine() {
    const a = new Date(DAYS_ISO[0] + 'T00:00:00Z'), b = new Date(DAYS_ISO[6] + 'T00:00:00Z');
    const ja = a.getUTCDate(), jb = b.getUTCDate();
    const fin = `${jb}${jb === 1 ? 'er' : ''} ${MOIS_FR[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
    const debut = a.getUTCMonth() === b.getUTCMonth() ? `${ja}${ja === 1 ? 'er' : ''}` : `${ja}${ja === 1 ? 'er' : ''} ${MOIS_FR[a.getUTCMonth()]}`;
    return `Semaine du ${debut} au ${fin}`;
  }
  // Positionne la semaine affichée sur le lundi donné (Date UTC).
  function definirSemaine(lundi) {
    LUNDI = lundi;
    DAYS_ISO = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lundi);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    DAYS = DAYS_ISO.map((iso, i) => `${JOURS_ABREGES[i]} ${iso.slice(8, 10)}`);
    TODAY_IDX = DAYS_ISO.indexOf(AUJOURDHUI_ISO); // -1 si aujourd'hui n'est pas dans la semaine affichée
    titles.planning[1] = libelleSemaine() + ' — parc machine réel';
  }
  // Semaine initiale : la semaine courante ; le dimanche, on prépare déjà la suivante.
  function lundiInitial() {
    const aujourdhui = new Date(AUJOURDHUI_ISO + 'T00:00:00Z');
    const l = lundiDeLaSemaine(aujourdhui);
    if (aujourdhui.getUTCDay() === 0) l.setUTCDate(l.getUTCDate() + 7);
    return l;
  }
  function changerSemaine(deltaSemaines) {
    const l = deltaSemaines === 0 ? lundiDeLaSemaine(new Date(AUJOURDHUI_ISO + 'T00:00:00Z')) : new Date(LUNDI);
    if (deltaSemaines) l.setUTCDate(l.getUTCDate() + 7 * deltaSemaines);
    definirSemaine(l);
    chargerDonneesReelles();
  }

  const titles = {
    planning: ['Planification', ''],
    ordres: ['Ordres de fabrication', "5 ordres actifs — 2 en cours, 2 planifiés, 1 en pause"],
    personnel: ['Personnel', 'Affectation, compétences et charge par opérateur'],
    machines: ['Machines', 'Parc machine — créer, modifier, rattacher à une opération'],
    temps: ['Temps standards', 'Mise en route, réglages, cadences et nettoyage — par opération et par machine'],
    stocks: ['Stocks & matières', 'Papier, colle, fil, couverture — suivi des seuils'],
    reporting: ['Reporting', 'Indicateurs de production — semaine en cours'],
  };

  definirSemaine(lundiInitial());

  function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
  function svgIcon(inner){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`; }
  function statutTag(s){
    const map = { ok:'ok', warn:'warn', danger:'danger', 'en cours':'warn', 'planifié':'ok', 'en pause':'danger', 'Disponible':'ok', 'En arrêt':'warn', 'Absent(e)':'danger' };
    if (map[s]) return map[s];
    if (s && s.startsWith('Disponible ')) return 'ok'; // "Disponible 9h00–13h00"
    return 'ok';
  }
  function prioColor(p){
    if(p==='urgente') return 'var(--danger-text)';
    if(p==='haute') return 'var(--accent-amber-text)';
    return 'var(--accent-teal)';
  }

  // ---------- Rendus par onglet ----------
  function renderPlanning(){
    const wrap = el(`<div></div>`);

    // ---- Bande de métriques, façon tableau de bord ----
    const machinesEnMarcheAuj = state.machines.filter(m => (state.planning[m.id]||[]).some(s=>s.day===TODAY_IDX)).length;
    const ofEnRetard = state.ordres.filter(o => o.avancement < 100 && o.delai && new Date(o.delai) < new Date()).length;
    const stocksSousSeuil = state.stocks.filter(s => s.statut !== 'ok').length;
    const stripIconMachine = '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>';
    const stripIconAlerte = '<path d="M12 2L2 20h20L12 2z"/><path d="M12 9v5M12 17h.01"/>';
    const stripIconStock = '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>';
    const strip = el(`
      <div class="panel">
        <div class="metric-strip">
          <div class="metric">
            <div class="metric-icon amber">${svgIcon(stripIconAlerte)}</div>
            <div><div class="v">${ofEnRetard}</div><div class="l">OF en retard</div></div>
          </div>
          <div class="metric">
            <div class="metric-icon teal">${svgIcon(stripIconMachine)}</div>
            <div><div class="v">${machinesEnMarcheAuj}</div><div class="l">Machines en marche aujourd'hui</div></div>
          </div>
          <div class="metric">
            <div class="metric-icon danger">${svgIcon(stripIconStock)}</div>
            <div><div class="v">${stocksSousSeuil}</div><div class="l">Matières sous seuil</div></div>
          </div>
        </div>
      </div>
    `);
    wrap.appendChild(strip);

    const legend = el(`
      <div class="panel">
        <div class="panel-head"><h2>Planning atelier — vue machines</h2>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <button class="btn" id="sem-prec" title="Semaine précédente">◀</button>
            <button class="btn" id="sem-auj">Aujourd'hui</button>
            <button class="btn" id="sem-suiv" title="Semaine suivante">▶</button>
            <button class="btn" id="feuille-jour">Feuille du jour (PDF)</button>
            <button class="btn" id="saisie-prod">Saisie de production</button>
          </div>
          <button class="btn primary" id="add-of-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Affecter un OF</button>
        </div>
        <div class="gantt-wrap"><table class="gantt" id="gantt-table"></table></div>
        <div class="legend">
          <span><i style="background:var(--accent-teal)"></i>Dans les temps</span>
          <span><i style="background:var(--accent-amber)"></i>Tension (charge/matière)</span>
          <span><i style="background:var(--danger)"></i>Retard / rupture</span>
        </div>
      </div>
    `);
    wrap.appendChild(legend);

    legend.querySelector('#saisie-prod').addEventListener('click', () => ouvrirModaleSaisieProduction());
    legend.querySelector('#feuille-jour').addEventListener('click', ouvrirModaleFeuilleJournaliere);
    legend.querySelector('#sem-prec').addEventListener('click', () => changerSemaine(-1));
    legend.querySelector('#sem-suiv').addEventListener('click', () => changerSemaine(1));
    legend.querySelector('#sem-auj').addEventListener('click', () => changerSemaine(0));
    const table = legend.querySelector('#gantt-table');
    let thead = '<tr><th class="day" style="text-align:left; position:sticky; left:0; background:var(--paper-raised);">Machine</th>';
    DAYS.forEach((d,i)=> thead += `<th class="day ${i===TODAY_IDX?'today':''}">${d}</th>`);
    thead += '</tr>';
    let rows = '';
    const ICON_MACHINE = '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>';
    state.machines.forEach(m=>{
      const actif = (state.planning[m.id]||[]).length > 0;
      const accent = actif ? 'teal' : 'muted';
      rows += `<tr><td class="machine-cell row-accent-${accent}"><div class="m-row"><span class="row-icon ${accent}">${svgIcon(ICON_MACHINE)}</span><div><div class="m-name">${m.name}</div><div class="m-sub">${m.code}</div></div></div></td>`;
      for(let d=0; d<7; d++){
        const slotsJour = (state.planning[m.id]||[]).filter(s=>s.day===d);
        const slot = slotsJour[0];
        if (slotsJour.length > 1 || (slot && slot.debut)) {
          // Créneaux horaires : une mini-barre par créneau, avec ses heures.
          const barres = slotsJour.map(s => {
            const col = s.statut==='danger' ? 'var(--danger)' : s.statut==='warn' ? 'var(--accent-amber)' : 'var(--accent-teal)';
            const heures = s.debut ? `${s.debut}–${s.fin}` : 'journée';
            const nom = s.phase ? `${s.of} · ${s.phase}` : s.of;
            return `<div class="bar compact clic-tache" data-gamme="${s.gamme||''}" data-date="${s.date||''}" data-of="${esc(s.of)}" style="background:${col};cursor:pointer;" title="Cliquer pour saisir l'avancement — ${esc(nom)} — ${heures}${s.nbPers > 1 ? ' — ' + s.nbPers + ' pers.' : ''}"><span class="b-text"><span class="b-name">${esc(nom)}</span></span><span class="b-time">${heures}</span></div>`;
          }).join('');
          rows += `<td class="slot"><div class="stack">${barres}</div></td>`;
        } else if(slot){
          const of = state.ordres.find(o=>o.id===slot.of);
          const color = slot.statut==='danger' ? 'var(--danger)' : slot.statut==='warn' ? 'var(--accent-amber)' : 'var(--accent-teal)';
          const pctBadge = of ? `<span class="b-pct">${of.avancement}%</span>` : '';
          rows += `<td class="slot"><div class="bar clic-tache" data-gamme="${slot.gamme||''}" data-date="${slot.date||''}" data-of="${esc(slot.of)}" title="Cliquer pour saisir l'avancement" style="background:${color};cursor:pointer;"><span class="b-text"><span class="b-of">${slot.of}${slot.nbPers > 1 ? ` · ${slot.nbPers} pers.` : ''}</span><span class="b-name">${of?of.produit:''}</span></span>${pctBadge}</div></td>`;
        } else {
          rows += `<td class="slot clickable" data-machine-uuid="${m.uuid||''}" data-machine-name="${m.name}" data-day="${d}"></td>`;
        }
      }
      rows += `</tr>`;
    });
    table.innerHTML = thead + rows;

    table.querySelectorAll('.clic-tache').forEach(b=>{
      b.addEventListener('click', (ev)=>{ ev.stopPropagation(); ouvrirModaleTache(b.dataset.gamme, b.dataset.date, b.dataset.of); });
    });
    table.querySelectorAll('.slot.clickable').forEach(td=>{
      td.addEventListener('click', ()=> ouvrirModaleAffectation({
        machineUuid: td.dataset.machineUuid,
        machineName: td.dataset.machineName,
        dayIdx: parseInt(td.dataset.day, 10),
      }));
    });

    return wrap;
  }

  function renderOrdres(){
    const wrap = el(`
      <div class="panel">
        <div class="panel-head"><h2>Ordres de fabrication</h2><div style="display:flex;gap:8px;"><button class="btn" id="couts-btn">Coûts & tarifs</button><button class="btn primary" id="new-of"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Nouvel OF</button></div></div>
        <table class="row-table">
          <thead><tr><th></th><th>Production</th><th>Client</th><th>Qté</th><th>Délai</th><th>État</th><th>Avancement</th><th></th></tr></thead>
          <tbody id="of-tbody"></tbody>
        </table>
      </div>
    `);
    const tbody = wrap.querySelector('#of-tbody');

    const PRIO_ICON = {
      urgente: '<path d="M12 2L2 20h20L12 2z"/><path d="M12 9v5M12 17h.01"/>',
      haute:   '<path d="M12 19V5M5 12l7-7 7 7"/>',
      normale: '<circle cx="12" cy="12" r="8"/>',
    };
    const ROW_ACCENT = { 'en cours': 'amber', 'validé': 'teal', 'planifié': 'teal', 'en attente de validation': 'muted', 'en pause': 'danger', 'terminé': 'green' };
    const ETAT_LABEL = { 'en cours': 'En cours', 'validé': 'Validé', 'planifié': 'Planifié', 'en attente de validation': 'En attente de validation', 'en pause': 'En pause', 'terminé': 'Terminé' };

    state.ordres.forEach(o=>{
      const fillClass = o.avancement>=70?'':(o.avancement>=30?'warn':'danger');
      const accent = ROW_ACCENT[o.statut] || 'teal';
      tbody.appendChild(el(`
        <tr class="row-accent-${accent}">
          <td class="row-icon-cell"><span class="row-icon ${accent}">${svgIcon(PRIO_ICON[o.priorite] || PRIO_ICON.normale)}</span></td>
          <td><div class="row-title">${o.id}</div><div class="row-sub">${o.produit}</div></td>
          <td><span class="chip">${o.client || '—'}</span></td>
          <td>${o.qte.toLocaleString('fr-FR')}</td>
          <td class="mono">${o.delai || '—'}</td>
          <td><span class="etat etat-${accent}">${ETAT_LABEL[o.statut] || o.statut}</span></td>
          <td style="min-width:110px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--ink-500);"><span>${o.avancement}%</span></div>
            <div class="bar-track"><div class="bar-fill ${fillClass}" style="width:${o.avancement}%"></div></div>
          </td>
          <td class="row-menu-cell">
            <button class="row-menu-btn" data-ofid="${o.uuid}" data-ofnum="${o.id}" data-ofstatut="${o.statut}" aria-label="Actions">${svgIcon('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>')}</button>
          </td>
        </tr>
      `));
    });

    tbody.querySelectorAll('.row-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ouvrirMenuOf(btn, btn.dataset.ofid, btn.dataset.ofnum, btn.dataset.ofstatut);
      });
    });

    return wrap;
  }

  // Résultat d'une validation réussie : l'OF a aussi été placé au planning (ou on explique pourquoi pas).
  function afficherResultatValidation(ofUuid, ofNumero, data) {
    const p = data.planification;
    const n = esc(ofNumero);
    const nb = (data.blocages || []).length;
    const forcee = data.forcee ? ` (malgré ${nb} point${nb > 1 ? 's' : ''} bloquant${nb > 1 ? 's' : ''})` : '';
    if (!p) { toast(`${n} validé${forcee}.`); return; }
    if (p.statut === 'rien_a_planifier') { toast(`${n} validé${forcee} — toutes ses étapes sont déjà planifiées.`); return; }

    if (p.statut === 'planifie') {
      if (p.respecte_delai === false) {
        const alt = p.alternative_heures_sup;
        afficherModale(`
          <h3>${n} validé et planifié — délai non tenu</h3>
          <div class="plan-resume">
            <div><span class="plan-k">Début</span><strong>${fmtDateHeure(p.debut)}</strong></div>
            <div><span class="plan-k">Fin prévue</span><strong>${fmtDateHeure(p.fin)}</strong></div>
            <div><span class="plan-k">Délai</span><strong>${fmtDateHeure(p.delai)}</strong></div>
            <div><span class="plan-k">Retard</span><strong style="color:var(--danger-text);">${fmtH(p.retard_min / 60)}</strong></div>
          </div>
          <p style="font-size:13px; color:var(--ink-700); margin:0 0 6px;">Le planning <strong>au plus tôt, en horaires normaux</strong>, a été appliqué : c'est déjà le plus rapide possible, mais il dépasse le délai de l'OF.</p>
          ${alt ? `<p style="font-size:13px; color:var(--ink-700); margin:0 0 6px;">Avec des <strong>heures supplémentaires</strong> : fin le ${fmtDateHeure(alt.fin)} — ${alt.respecte_delai ? '<strong>délai tenu</strong>' : 'délai toujours non tenu'}.</p>` : ''}
          <div class="plan-note">« Ouvrir la planification » permet de replanifier avec les heures supplémentaires.</div>
          <div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn primary" id="m-ouvrir-plan">Ouvrir la planification…</button></div>`);
        document.getElementById('m-cancel').addEventListener('click', fermerModale);
        document.getElementById('m-ouvrir-plan').addEventListener('click', () => ouvrirModalePlanification(ofUuid, ofNumero));
        return;
      }
      toast(`${n} validé${forcee} et planifié : ${fmtDateHeure(p.debut)} → ${fmtDateHeure(p.fin)}${p.respecte_delai ? ' — délai tenu' : ''}.`);
      return;
    }

    if (p.statut === 'bloquee') {
      afficherModale(`
        <h3>${n} validé, mais pas encore planifié</h3>
        <div class="plan-bloquants"><strong>À corriger pour pouvoir le planifier :</strong>
          <ul>${(p.bloquants || []).map(b => `<li><strong>${esc(b.operation)}</strong> : ${esc(b.detail)}</li>`).join('')}</ul></div>
        <div class="plan-note" style="margin-top:8px;">L'OF est bien validé. Corrigez ces points (par exemple chiffrez l'étape), puis lancez « Planifier à l'heure » ou revalidez l'OF.</div>
        <div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn primary" id="m-ouvrir-chiffrage">Ouvrir le chiffrage…</button></div>`);
      document.getElementById('m-cancel').addEventListener('click', fermerModale);
      document.getElementById('m-ouvrir-chiffrage').addEventListener('click', () => ouvrirModaleChiffrage(ofUuid, ofNumero));
      return;
    }
    toast(`${n} validé${forcee}, mais la planification a échoué : ${esc(p.message || 'erreur inconnue')}.`, 'error');
  }

  // Détail d'une validation refusée : chaque blocage, la façon de le lever, et le choix de valider quand même.
  function ouvrirModaleBlocages(ofUuid, ofNumero, data) {
    const GROUPES = [
      ['gamme', 'Gamme', 'Ajoutez des étapes à la gamme de cet OF.'],
      ['machine', 'Machines', 'Reliez l\'opération à une machine active : onglet Machines → Modifier → cochez l\'opération. Vérifiez aussi qu\'aucune maintenance n\'est en cours.'],
      ['matiere', 'Matières', 'Réapprovisionnez le stock (onglet Stocks), ou retirez la matière requise de l\'OF.'],
      ['personnel', 'Personnel', 'Déclarez une compétence : onglet Personnel → Compétences. Ce contrôle tient aussi compte des absences d\'aujourd\'hui.'],
    ];
    const n = data.blocages.length;
    const crit = (ok_, nom) => `<span class="tag ${ok_ ? 'ok' : 'warn'}">${ok_ ? '✓' : '✗'} ${nom}</span>`;
    const blocs = GROUPES.map(([type, titre, conseil]) => {
      const lignes = data.blocages.filter(b => b.type === type);
      if (!lignes.length) return '';
      return `
        <div class="blocage-groupe">
          <div class="blocage-titre">${titre} <span class="plan-note">— ${lignes.length} point${lignes.length > 1 ? 's' : ''}</span></div>
          <ul>${lignes.map(b => `<li>${b.etape ? `<span class="mono">Étape ${b.etape}</span> — ` : ''}${esc(b.detail)}</li>`).join('')}</ul>
          <div class="blocage-conseil">${conseil}</div>
        </div>`;
    }).join('');
    afficherModale(`
      <h3>${esc(ofNumero)} — ${n} point${n > 1 ? 's' : ''} bloquant${n > 1 ? 's' : ''}</h3>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">${crit(data.criteres.machines, 'Machines')}${crit(data.criteres.matieres, 'Matières')}${crit(data.criteres.personnel, 'Personnel')}</div>
      ${blocs}
      <div class="plan-note" style="margin-top:10px;">La validation est pour l'instant <strong>informative</strong> : elle n'empêche pas de planifier l'OF. Vous pouvez le valider malgré ces points si vous savez qu'ils seront levés.</div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn primary" id="m-valider-force">Valider quand même</button></div>`, 'large');
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-valider-force').addEventListener('click', async () => {
      const msg = document.getElementById('m-msg');
      msg.innerHTML = '<div class="msg">Validation…</div>';
      try {
        const res = await fetch(`${API}/valider-of`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ of_id: ofUuid, forcer: true, maintenant: maintenantLocal() }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        fermerModale(); chargerDonneesReelles();
        afficherResultatValidation(ofUuid, ofNumero, d);
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    });
  }

  // ---------- Suivi de production : saisie de fin de journée, jauges, glissement du planning ----------
  function jaugeAvancement(pct, prevu, retard) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const cls = retard ? 'danger' : (prevu != null && p + 2 < prevu ? 'warn' : '');
    const marque = prevu != null ? `<span class="jauge-prevu" style="left:${Math.max(0, Math.min(100, prevu))}%" title="Prévu à ce jour : ${prevu} %"></span>` : '';
    return `<div class="bar-track tall"><div class="bar-fill ${cls}" style="width:${p}%"></div>${marque}</div>`;
  }
  const nbFr = (n) => Number(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
  const dateLocaleIso = () => maintenantLocal().slice(0, 10);

  // Valeurs à pré-remplir quand on coche « Tâche terminée » : le reste à produire, 100 %, la durée planifiée.
  function valeursTerminee(t) {
    const dejaAutres = Math.max(0, (Number(t.quantite_realisee) || 0) - (Number((t.saisie || {}).quantite) || 0));
    const qte = t.quantite_totale ? Math.max(0, Math.round((Number(t.quantite_totale) - dejaAutres) * 100) / 100) : null;
    let h = null;
    if (t.debut && t.fin) {
      const m = (x) => { const [a, b] = x.split(':'); return Number(a) * 60 + Number(b); };
      let min = m(t.fin) - m(t.debut);
      if (m(t.debut) < 720 && m(t.fin) > 750) min -= 30;   // pause méridienne
      if (min > 0) h = Math.round(min / 60 * 100) / 100;
    }
    return { qte, pct: 100, h };
  }
  // Applique ces valeurs à un conteneur ; mémorise ce qui a été rempli automatiquement pour pouvoir l'annuler.
  function remplirTerminee(conteneur, t, coche, sel) {
    const champs = { qte: conteneur.querySelector(sel.qte), pct: conteneur.querySelector(sel.pct), h: conteneur.querySelector(sel.h) };
    if (coche) {
      const v = valeursTerminee(t);
      const auto = {};
      for (const k of ['qte', 'pct', 'h']) {
        if (v[k] === null || !champs[k]) continue;
        if (k === 'h' && champs.h.value !== '') continue;            // heures déjà saisies : on les garde
        champs[k].value = v[k]; auto[k] = String(v[k]);
      }
      conteneur.dataset.auto = JSON.stringify(auto);
      const det = conteneur.querySelector('details'); if (det) det.open = true;
    } else {
      let auto = {}; try { auto = JSON.parse(conteneur.dataset.auto || '{}'); } catch (e) {}
      for (const k of Object.keys(auto)) if (champs[k] && champs[k].value === auto[k]) champs[k].value = '';
      conteneur.dataset.auto = '{}';
    }
  }

  async function ouvrirModaleSaisieProduction(dateInit) {
    afficherModale(`
      <h3>Saisie de production — fin de journée</h3>
      <div class="field" style="max-width:220px;"><label>Journée</label><input id="sp-date" type="date" value="${dateInit || dateLocaleIso()}"></div>
      <div class="field" style="margin-top:6px;"><label>Importer un relevé de production (Excel, CSV, PDF ou photo)</label>
        <input type="file" id="sp-file" accept=".xlsx,.xls,.csv,.pdf,image/*">
        <div id="sp-import-msg" class="plan-note" style="margin-top:4px;">Les quantités lues sont rapprochées des tâches puis pré-remplies ci-dessous : vous vérifiez avant d'enregistrer.</div></div>
      <div id="sp-liste"><div class="msg">Chargement…</div></div>
      <label style="display:flex;gap:8px;align-items:center;margin:12px 0 4px;font-size:13px;"><input type="checkbox" id="sp-recaler" checked> Décaler automatiquement le planning si une tâche n'est pas terminée comme prévu</label>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="sp-go" disabled>Enregistrer</button></div>
    `, 'xlarge');
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    let taches = [];
    let lus = {};   // gamme_id -> proposition issue d'un fichier importé
    function rendreTable() {
      const box = document.getElementById('sp-liste');
      if (!taches.length) { box.innerHTML = `<div class="msg">Aucune tâche planifiée le ${dateCourte(document.getElementById('sp-date').value)}.</div>`; return; }
      box.innerHTML = `<div style="overflow-x:auto;"><table class="sp-table"><thead><tr><th>Tâche</th><th style="min-width:150px;">Avancement</th><th>Produit ce jour</th><th>Terminée</th><th></th></tr></thead><tbody>${taches.map((t, i) => {
        const s = t.saisie || {};
        const l = lus[t.gamme_id];
        const qte = l && l.quantite !== null ? l.quantite : (s.quantite ? s.quantite : '');
        const fini = l ? (l.termine || t.statut === 'terminé') : (s.termine || t.statut === 'terminé');
        const pct = l && l.pct !== null ? l.pct : (s.pct_cumule ?? '');
        const h = l && l.heures_reelles !== null ? l.heures_reelles : (s.heures_reelles ?? '');
        const com = l && l.commentaire ? l.commentaire : (s.commentaire || '');
        const source = l ? `<div class="plan-note" style="color:var(--accent-teal);margin-top:3px;">Lu dans le fichier (${l.confiance === 'haute' ? 'fiable' : l.confiance === 'moyenne' ? 'à vérifier' : 'douteux'}) : ${esc(l.texte_source)}</div>` : '';
        return `<tr data-i="${i}" ${l ? 'style="background:var(--field-bg);"' : ''}>
          <td><strong>${esc(t.operation)}</strong> <span class="plan-note">— ${esc(t.machine)}</span><br>
            <span class="plan-note">${esc(t.of)} · ${esc(t.titre)}${t.client ? ' (' + esc(t.client) + ')' : ''}<br>${t.debut ? esc(t.debut) + '–' + esc(t.fin) + ' · ' : ''}${esc((t.personnel || []).join(', ') || (t.debut ? 'personnel à affecter' : 'non planifiée ce jour'))}</span>${source}</td>
          <td>${jaugeAvancement(t.avancement_pct, null, false)}<div class="plan-note">${t.avancement_pct} % ${t.quantite_totale ? '· ' + nbFr(t.quantite_realisee) + ' / ' + nbFr(t.quantite_totale) : ''}</div></td>
          <td><input class="sp-qte" type="number" min="0" step="any" value="${qte}" placeholder="quantité" style="width:110px;"></td>
          <td style="text-align:center;">${(t.bloquee_par || []).length && t.statut !== 'terminé' ? `<input class="sp-fini" type="checkbox" disabled title="Attend la fin de : ${esc(t.bloquee_par.join(', '))}"><div class="plan-note">attend ${esc(t.bloquee_par.join(', '))}</div>` : `<input class="sp-fini" type="checkbox" ${fini ? 'checked' : ''}>`}</td>
          <td><details ${l && (pct !== '' || h !== '' || com) ? 'open' : ''}><summary class="plan-note" style="cursor:pointer;">+</summary>
            <div class="field"><label>Avancement cumulé (%) — si pas de quantité</label><input class="sp-pct" type="number" min="0" max="100" step="any" value="${pct}"></div>
            <div class="field"><label>Heures réelles</label><input class="sp-h" type="number" min="0" step="0.25" value="${h}"></div>
            <div class="field"><label>Remarque</label><input class="sp-com" type="text" value="${esc(com)}"></div></details></td>
        </tr>`; }).join('')}</tbody></table></div>
        <div class="plan-note" style="margin-top:6px;">Saisissez la quantité réellement produite aujourd'hui (en exemplaires). Les lignes laissées vides sont ignorées. Pour une tâche sans quantité (travail manuel), utilisez « + » pour indiquer l'avancement en %.</div>`;
    }
    // Import d'un relevé : lecture, rapprochement avec les tâches, pré-remplissage à relire.
    document.getElementById('sp-file').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      const info = document.getElementById('sp-import-msg');
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { info.innerHTML = '<span style="color:var(--danger-text);">Fichier trop volumineux (4 Mo maximum).</span>'; return; }
      info.textContent = 'Lecture du relevé en cours…';
      try {
        const nom = file.name.toLowerCase();
        const mime = file.type || (nom.endsWith('.pdf') ? 'application/pdf' : nom.endsWith('.csv') ? 'text/csv' : nom.endsWith('.xls') ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const base64 = await fichierEnBase64(file);
        const res = await fetch(`${API}/extraire-production`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_base64: base64, file_name: file.name, mime_type: mime, date: document.getElementById('sp-date').value }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        // Le document porte sa propre date : on bascule sur cette journée.
        if (d.date && d.date !== document.getElementById('sp-date').value) {
          document.getElementById('sp-date').value = d.date;
          await charger();
        }
        d.propositions.forEach(p => {
          lus[p.gamme_id] = p;
          if (!taches.some(t => t.gamme_id === p.gamme_id)) taches.push(p.tache);   // tâche non planifiée ce jour-là mais citée par le relevé
        });
        rendreTable();
        document.getElementById('sp-go').disabled = !taches.length;
        const ko = d.non_rapprochees.length ? ` <strong style="color:var(--accent-amber-text);">${d.non_rapprochees.length} ligne(s) non rapprochée(s) :</strong> ${d.non_rapprochees.slice(0, 6).map(x => esc(x.texte_source)).join(' ; ')}${d.non_rapprochees.length > 6 ? '…' : ''}.` : '';
        info.innerHTML = `${d.propositions.length} tâche(s) pré-remplie(s)${d.date ? ' pour le ' + dateCourte(d.date) : ''}. Vérifiez les quantités avant d'enregistrer.${ko} ${d.notes ? '<br>' + esc(d.notes) : ''}`;
      } catch (e) { info.innerHTML = `<span style="color:var(--danger-text);">${esc(e.message)}</span>`; }
      ev.target.value = '';
    });
    async function charger() {
      const date = document.getElementById('sp-date').value;
      const box = document.getElementById('sp-liste');
      document.getElementById('sp-go').disabled = true;
      if (!date) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="msg">Chargement…</div>';
      try {
        const res = await fetch(`${API}/lecture-production?date=${date}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        taches = d.taches;
        lus = {};
        rendreTable();
        document.getElementById('sp-go').disabled = !taches.length;
      } catch (e) { box.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    }
    document.getElementById('sp-date').addEventListener('change', charger);
    document.getElementById('sp-liste').addEventListener('change', (ev) => {
      if (!ev.target.classList.contains('sp-fini')) return;
      const tr = ev.target.closest('tr'); if (!tr) return;
      remplirTerminee(tr, taches[Number(tr.dataset.i)], ev.target.checked, { qte: '.sp-qte', pct: '.sp-pct', h: '.sp-h' });
    });
    charger();

    document.getElementById('sp-go').addEventListener('click', async () => {
      const date = document.getElementById('sp-date').value;
      const msg = document.getElementById('m-msg');
      const saisies = Array.from(document.querySelectorAll('.sp-table tbody tr')).map(tr => {
        const t = taches[Number(tr.dataset.i)];
        const val = (c) => tr.querySelector(c).value;
        return { gamme_id: t.gamme_id, quantite: val('.sp-qte'), pct: val('.sp-pct'), termine: tr.querySelector('.sp-fini').checked && t.statut !== 'terminé', heures_reelles: val('.sp-h'), commentaire: val('.sp-com') };
      }).filter(s => s.quantite !== '' || s.pct !== '' || s.termine);
      if (!saisies.length) { msg.innerHTML = '<div class="msg error">Aucune saisie à enregistrer.</div>'; return; }
      msg.innerHTML = '<div class="msg">Enregistrement et recalage du planning…</div>';
      document.getElementById('sp-go').disabled = true;
      try {
        const res = await fetch(`${API}/saisir-production`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, saisies, recaler: document.getElementById('sp-recaler').checked }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        afficherBilanProduction(d);
        chargerDonneesReelles();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; document.getElementById('sp-go').disabled = false; }
    });
  }

  // Saisie d'avancement d'une seule tâche, depuis un clic sur son bloc dans le planning.
  async function ouvrirModaleTache(gammeId, date, ofNumero) {
    if (!gammeId || !date) {
      afficherModale(`<h3>${esc(ofNumero || 'Tâche')}</h3><div class="msg">Ce créneau n'est pas rattaché à une étape de gamme (planifié avant le suivi de production) : replanifiez l'OF pour pouvoir y saisir l'avancement.</div><div class="actions"><button class="btn primary" id="m-cancel">Fermer</button></div>`);
      document.getElementById('m-cancel').addEventListener('click', fermerModale); return;
    }
    afficherModale('<h3>Avancement de la tâche</h3><div class="msg">Chargement…</div>', 'large');
    let t;
    try {
      const res = await fetch(`${API}/lecture-production?date=${date}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      t = d.taches.find(x => x.gamme_id === gammeId);
      if (!t) throw new Error('Tâche introuvable pour ce jour.');
    } catch (e) {
      afficherModale(`<h3>Avancement de la tâche</h3><div class="msg error">${esc(e.message)}</div><div class="actions"><button class="btn primary" id="m-cancel">Fermer</button></div>`);
      document.getElementById('m-cancel').addEventListener('click', fermerModale); return;
    }
    const s = t.saisie || {};
    const fini = t.statut === 'terminé';
    const bloque = !fini && Array.isArray(t.bloquee_par) && t.bloquee_par.length > 0;
    afficherModale(`
      <h3>${esc(t.operation)} <span class="plan-note">— ${esc(t.machine)}</span></h3>
      <div class="plan-note" style="margin-bottom:8px;">${esc(t.of)} · ${esc(t.titre)}${t.client ? ' (' + esc(t.client) + ')' : ''}<br>${dateCourte(date)}${t.debut ? ' · ' + esc(t.debut) + '–' + esc(t.fin) : ''} · ${esc((t.personnel || []).join(', ') || 'personnel à affecter')}</div>
      ${jaugeAvancement(t.avancement_pct, null, false)}
      <div class="plan-note" style="margin:3px 0 10px;">${t.avancement_pct} % ${t.quantite_totale ? '· ' + nbFr(t.quantite_realisee) + ' / ' + nbFr(t.quantite_totale) + ' exemplaires' : ''}${fini ? ' · terminée' : ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="field"><label>Produit ce jour (exemplaires)</label><input id="mt-qte" type="number" min="0" step="any" value="${s.quantite || ''}" placeholder="quantité"></div>
        <div class="field"><label>Ou avancement cumulé (%)</label><input id="mt-pct" type="number" min="0" max="100" step="any" value="${s.pct_cumule ?? ''}"></div>
        <div class="field"><label>Heures réelles</label><input id="mt-h" type="number" min="0" step="0.25" value="${s.heures_reelles ?? ''}"></div>
        <div class="field"><label>Remarque</label><input id="mt-com" type="text" value="${esc(s.commentaire || '')}"></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin:8px 0 2px;font-size:13px;"><input type="checkbox" id="mt-fini" ${fini || s.termine ? 'checked' : ''} ${fini || bloque ? 'disabled' : ''}> Tâche terminée${bloque ? ` <span class="plan-note">— indisponible : attend la fin de ${esc(t.bloquee_par.join(', '))}</span>` : ''}</label>
      <label style="display:flex;gap:8px;align-items:center;margin:2px 0 4px;font-size:13px;"><input type="checkbox" id="mt-recaler" checked> Décaler automatiquement le planning en cas de retard</label>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn" id="mt-of">Avancement de l'OF</button><button class="btn primary" id="mt-go">Enregistrer</button></div>`, 'large');
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    const corps = document.querySelector('.modal');
    document.getElementById('mt-fini').addEventListener('change', (ev) => remplirTerminee(corps, t, ev.target.checked, { qte: '#mt-qte', pct: '#mt-pct', h: '#mt-h' }));
    document.getElementById('mt-of').addEventListener('click', () => ouvrirModaleAvancementOf(t.of_id, t.of));
    document.getElementById('mt-go').addEventListener('click', async () => {
      const msg = document.getElementById('m-msg');
      const saisie = { gamme_id: gammeId, quantite: document.getElementById('mt-qte').value, pct: document.getElementById('mt-pct').value, termine: document.getElementById('mt-fini').checked && !fini, heures_reelles: document.getElementById('mt-h').value, commentaire: document.getElementById('mt-com').value };
      if (saisie.quantite === '' && saisie.pct === '' && !saisie.termine) { msg.innerHTML = '<div class="msg error">Renseignez une quantité, un pourcentage ou cochez « terminée ».</div>'; return; }
      msg.innerHTML = '<div class="msg">Enregistrement et recalage du planning…</div>';
      document.getElementById('mt-go').disabled = true;
      try {
        const res = await fetch(`${API}/saisir-production`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, saisies: [saisie], recaler: document.getElementById('mt-recaler').checked }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        afficherBilanProduction(d);
        chargerDonneesReelles();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; document.getElementById('mt-go').disabled = false; }
    });
  }

  function afficherBilanProduction(d) {
    const erreurs = d.etapes.filter(e => e.erreur).map(e => `<div class="msg error">${esc(e.erreur)}</div>`).join('');
    const blocs = d.ofs.map(o => {
      const r = o.recalage;
      let etat = '<span class="tag ok">Dans les temps</span>';
      let detail = '';
      if (r && r.retard) {
        const lignes = r.retards.map(x => `<li><strong>${esc(x.operation)}</strong> : ${x.reel_pct} % réalisé (prévu ${x.prevu_pct} %) — ${fmtH(x.minutes_manquantes / 60)} de travail en plus à replacer</li>`).join('');
        if (r.applique) {
          etat = '<span class="tag warn">Planning décalé</span>';
          detail = `<ul class="plan-note" style="margin:6px 0;">${lignes}</ul>
            <div class="plan-resume"><div><span class="plan-k">Fin prévue avant</span><strong>${fmtDateHeure(r.ancienne_fin)}</strong></div><div><span class="plan-k">Nouvelle fin</span><strong>${fmtDateHeure(r.nouvelle_fin)}</strong></div>
            <div>${r.delai_tenu === false ? `<span class="tag danger">Délai dépassé</span> <span class="plan-note">(délai ${fmtDateHeure(r.delai)} — ${fmtH(r.retard_delai_min / 60)} de retard${r.alternative_heures_sup ? ' ; avec heures sup : fin ' + fmtDateHeure(r.alternative_heures_sup.fin) + (r.alternative_heures_sup.respecte_delai ? ', délai tenu' : '') : ''})</span>` : (r.delai_tenu ? '<span class="tag ok">Délai tenu</span>' : '')}</div></div>
            <div class="plan-note">Étapes replacées : ${r.etapes_decalees.map(x => esc(x.operation) + ' (' + fmtDateHeure(x.debut) + ' → ' + fmtDateHeure(x.fin) + ')').join(' ; ')}</div>`;
        } else {
          etat = '<span class="tag danger">Retard — planning non recalé</span>';
          detail = `<ul class="plan-note" style="margin:6px 0;">${lignes}</ul><div class="msg error">${esc(r.raison || 'Recalage impossible')}${(r.bloquants || []).map(b => `<br>• ${esc(b.operation)} : ${esc(b.detail)}`).join('')}</div>`;
        }
      }
      return `<div class="panel" style="margin:0 0 10px;padding:12px;"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;"><strong>${esc(o.numero)}</strong>${etat}</div>
        <div class="plan-note" style="margin-top:4px;">Avancement global : <strong>${o.avancement_of ?? '—'} %</strong></div>${jaugeAvancement(o.avancement_of, null, false)}${detail}</div>`;
    }).join('');
    afficherModale(`<h3>Production du ${dateCourte(d.date)} enregistrée</h3>${erreurs}${blocs || '<div class="msg">Rien d\'enregistré.</div>'}
      <div class="actions"><button class="btn primary" id="m-cancel">Fermer</button></div>`, 'large');
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
  }

  // Historique des saisies d'une opération : ajouter, corriger ou supprimer les données de production.
  async function ouvrirModaleSaisiesEtape(gammeId, ofUuid, ofNumero) {
    afficherModale('<h3>Saisies de production</h3><div class="msg">Chargement…</div>', 'xlarge');
    let t, hist;
    try {
      const res = await fetch(`${API}/lecture-production?gamme_id=${gammeId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      t = d.tache; hist = d.historique;
    } catch (e) {
      afficherModale(`<h3>Saisies de production</h3><div class="msg error">${esc(e.message)}</div><div class="actions"><button class="btn primary" id="m-cancel">Fermer</button></div>`);
      document.getElementById('m-cancel').addEventListener('click', fermerModale); return;
    }
    const fini = t.statut === 'terminé';
    const bloque = !fini && (t.bloquee_par || []).length > 0;
    const ligneHtml = (l, i) => `<tr data-i="${i}" data-orig='${l ? esc(JSON.stringify(l)) : ''}'>
      <td><input class="se-date" type="date" value="${l ? l.date : dateLocaleIso()}" style="width:140px;"></td>
      <td><input class="se-qte" type="number" min="0" step="any" value="${l && l.quantite ? l.quantite : ''}" style="width:100px;" placeholder="quantité"></td>
      <td><input class="se-pct" type="number" min="0" max="100" step="any" value="${l && l.pct_cumule !== null && l.pct_cumule !== undefined ? l.pct_cumule : ''}" style="width:80px;"></td>
      <td><input class="se-h" type="number" min="0" step="0.25" value="${l && l.heures_reelles !== null && l.heures_reelles !== undefined ? l.heures_reelles : ''}" style="width:80px;"></td>
      <td><input class="se-com" type="text" value="${l ? esc(l.commentaire || '') : ''}" style="min-width:140px;"></td>
      <td style="text-align:center;"><input class="se-fini" type="checkbox" ${l && l.termine ? 'checked' : ''} ${bloque && !(l && l.termine) ? 'disabled title="Attend la fin de : ' + esc(t.bloquee_par.join(', ')) + '"' : ''}></td>
      <td><button class="btn se-del" title="Supprimer cette saisie" style="padding:2px 9px;">✕</button></td></tr>`;
    afficherModale(`
      <h3>${esc(t.operation)} <span class="plan-note">— ${esc(t.machine)}</span></h3>
      <div class="plan-note" style="margin-bottom:8px;">${esc(t.of)} · ${esc(t.titre)}${t.client ? ' (' + esc(t.client) + ')' : ''}${t.debut_prevu ? ' · prévu du ' + dateCourte(t.debut_prevu) + ' au ' + dateCourte(t.fin_prevue) : ''}</div>
      <div id="se-jauge">${jaugeAvancement(t.avancement_pct, null, false)}</div>
      <div class="plan-note" style="margin:3px 0 10px;">${t.avancement_pct} % ${t.quantite_totale ? '· ' + nbFr(t.quantite_realisee) + ' / ' + nbFr(t.quantite_totale) + ' exemplaires' : ''}${fini ? ' · terminée' : ''}${bloque ? ' · attend la fin de ' + esc(t.bloquee_par.join(', ')) : ''}</div>
      <div style="overflow-x:auto;"><table class="sp-table"><thead><tr><th>Journée</th><th>Quantité produite</th><th>% cumulé</th><th>Heures</th><th>Remarque</th><th>Terminée</th><th></th></tr></thead><tbody id="se-corps">${hist.map((l, i) => ligneHtml(l, i)).join('')}</tbody></table></div>
      <div id="se-vide" class="plan-note" style="margin:6px 0;${hist.length ? 'display:none;' : ''}">Aucune saisie enregistrée pour cette opération.</div>
      <div style="margin:8px 0;"><button class="btn" id="se-add">+ Ajouter une saisie</button></div>
      <div class="plan-note">Quantité = exemplaires produits ce jour-là ; « % cumulé » sert aux tâches sans quantité. Cocher « Terminée » remplit le reste à produire. Supprimer une ligne retire sa production de l'avancement.</div>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0 4px;font-size:13px;"><input type="checkbox" id="se-recaler" checked> Décaler automatiquement le planning en cas de retard</label>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn" id="se-of">Retour à l'OF</button><button class="btn primary" id="se-go">Enregistrer</button></div>`, 'xlarge');
    const corps = document.getElementById('se-corps');
    let prochain = hist.length;
    const supprimes = [];
    const majVide = () => { document.getElementById('se-vide').style.display = corps.children.length ? 'none' : ''; };
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('se-of').addEventListener('click', () => ouvrirModaleAvancementOf(ofUuid || t.of_id, ofNumero || t.of));
    document.getElementById('se-add').addEventListener('click', () => {
      corps.insertAdjacentHTML('beforeend', ligneHtml(null, prochain++)); majVide();
    });
    corps.addEventListener('click', (ev) => {
      if (!ev.target.classList.contains('se-del')) return;
      const tr = ev.target.closest('tr');
      if (tr.dataset.orig) supprimes.push(JSON.parse(tr.dataset.orig));
      tr.remove(); majVide();
    });
    corps.addEventListener('change', (ev) => {
      if (!ev.target.classList.contains('se-fini')) return;
      const tr = ev.target.closest('tr'), q = tr.querySelector('.se-qte'), p = tr.querySelector('.se-pct');
      if (ev.target.checked) {
        const autres = Array.from(corps.querySelectorAll('tr')).filter(x => x !== tr).reduce((a, x) => a + (Number(x.querySelector('.se-qte').value) || 0), 0);
        if (t.quantite_totale) { q.value = Math.max(0, Math.round((t.quantite_totale - autres) * 100) / 100); q.dataset.auto = q.value; }
        p.value = 100; p.dataset.auto = '100';
        const h = tr.querySelector('.se-h');
      } else {
        if (q.dataset.auto !== undefined && q.value === q.dataset.auto) q.value = '';
        if (p.dataset.auto !== undefined && p.value === p.dataset.auto) p.value = '';
        delete q.dataset.auto; delete p.dataset.auto;
      }
    });
    document.getElementById('se-go').addEventListener('click', async () => {
      const msg = document.getElementById('m-msg');
      const saisies = [];
      const dates = new Set();
      for (const tr of Array.from(corps.querySelectorAll('tr'))) {
        const v = (c) => tr.querySelector(c).value;
        const date = v('.se-date');
        if (!date) { msg.innerHTML = '<div class="msg error">Chaque saisie doit avoir une date.</div>'; return; }
        if (dates.has(date)) { msg.innerHTML = `<div class="msg error">Deux saisies portent la date du ${dateCourte(date)} : regroupez-les en une seule ligne.</div>`; return; }
        dates.add(date);
        const orig = tr.dataset.orig ? JSON.parse(tr.dataset.orig) : null;
        const saisie = { gamme_id: gammeId, date, quantite: v('.se-qte'), pct: v('.se-pct'), termine: tr.querySelector('.se-fini').checked, heures_reelles: v('.se-h'), commentaire: v('.se-com') };
        if (saisie.quantite === '' && saisie.pct === '' && !saisie.termine) { if (orig) supprimes.push(orig); continue; }   // ligne vidée = supprimée
        if (orig && orig.date !== date) supprimes.push(orig);   // date changée : l'ancienne journée est supprimée
        saisies.push(saisie);
      }
      supprimes.filter(o => !dates.has(o.date) || !saisies.some(x => x.date === o.date)).forEach(o => saisies.unshift({ gamme_id: gammeId, date: o.date, supprimer: true }));
      if (!saisies.length) { msg.innerHTML = '<div class="msg error">Rien à enregistrer.</div>'; return; }
      msg.innerHTML = '<div class="msg">Enregistrement et recalage du planning…</div>';
      document.getElementById('se-go').disabled = true;
      try {
        const res = await fetch(`${API}/saisir-production`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateLocaleIso(), saisies, recaler: document.getElementById('se-recaler').checked }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        afficherBilanProduction(d);
        chargerDonneesReelles();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; document.getElementById('se-go').disabled = false; }
    });
  }

  async function ouvrirModaleAvancementOf(ofUuid, ofNumero) {
    afficherModale(`<h3>Avancement — ${esc(ofNumero)}</h3><div id="av-corps"><div class="msg">Chargement…</div></div>
      <div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn primary" id="av-saisie">Saisir la production du jour</button></div>`, 'large');
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('av-saisie').addEventListener('click', () => ouvrirModaleSaisieProduction());
    try {
      const res = await fetch(`${API}/lecture-production?of_id=${ofUuid}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      const etapes = d.etapes.slice().sort((a, b) => (a.debut_prevu || '9').localeCompare(b.debut_prevu || '9'));
      document.getElementById('av-corps').innerHTML = `
        <div style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:baseline;"><strong>${esc(d.of.titres ? d.of.titres.nom : '')}</strong><span><strong style="font-size:20px;">${d.avancement_global} %</strong> <span class="plan-note">global${d.of.delai ? ' · délai ' + dateCourte(d.of.delai) : ''}</span></span></div>${jaugeAvancement(d.avancement_global, null, false)}</div>
        ${etapes.map(e => `<div style="padding:8px 0;border-top:1px solid var(--line);">
          <div style="display:flex;justify-content:space-between;gap:10px;"><span><strong>${esc(e.operation)}</strong> <span class="plan-note">${esc(e.machine || 'manuel')}</span></span>
            <span>${e.statut === 'terminé' ? '<span class="tag ok">Terminée</span>' : (e.en_retard ? '<span class="tag danger">En retard</span>' : '')} <strong>${e.avancement_pct} %</strong> <button class="btn av-edit" data-g="${e.gamme_id}" style="padding:2px 10px;font-size:12px;margin-left:6px;">Saisies</button></span></div>
          ${jaugeAvancement(e.avancement_pct, e.statut === 'terminé' ? null : e.prevu_pct, e.en_retard)}
          <div class="plan-note">${e.quantite_totale ? nbFr(e.quantite_realisee) + ' / ' + nbFr(e.quantite_totale) + ' · ' : ''}${e.debut_prevu ? 'prévu du ' + dateCourte(e.debut_prevu) + ' au ' + dateCourte(e.fin_prevue) : 'non planifiée'}${e.fin_reelle ? ' · terminée le ' + dateCourte(e.fin_reelle) : ''}</div></div>`).join('')}
        <div class="plan-note" style="margin-top:8px;">Le trait sur la jauge indique l'avancement prévu à ce jour d'après le planning. « Saisies » permet d'ajouter, corriger ou supprimer les données de production d'une opération.</div>`;
      document.querySelectorAll('.av-edit').forEach(b => b.addEventListener('click', () => ouvrirModaleSaisiesEtape(b.dataset.g, ofUuid, ofNumero)));
    } catch (e) { document.getElementById('av-corps').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
  }

  // ---------- Devis : coûts personnel / machines / matières ----------
  const eur = (n) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ') + ' €';

  async function ouvrirModaleCouts() {
    afficherModale(`<h3>Coûts & tarifs</h3><div id="co-corps"><div class="msg">Chargement…</div></div>
      <div id="m-msg"></div><div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn primary" id="co-save" disabled>Enregistrer</button></div>`, 'xlarge');
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    let d;
    try {
      const res = await fetch(`${API}/gerer-couts`);
      d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
    } catch (e) { document.getElementById('co-corps').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; return; }
    const val = (v) => (v === null || v === undefined ? '' : v);
    document.getElementById('co-corps').innerHTML = `
      <div class="co-tabs"><button class="btn co-tab active" data-t="gen">Réglages</button><button class="btn co-tab" data-t="mac">Machines (amortissement)</button><button class="btn co-tab" data-t="per">Personnel</button><button class="btn co-tab" data-t="mat">Matières</button></div>
      <div class="co-pane" data-p="gen">${d.parametres.map(p => `<div class="field" style="max-width:520px;"><label>${esc(p.libelle)} <span class="plan-note">(${esc(p.unite || '')})</span></label><input class="co-param" data-cle="${esc(p.cle)}" type="number" step="any" min="0" value="${p.valeur}"></div>`).join('')}</div>
      <div class="co-pane hidden" data-p="mac"><p class="plan-note">Coût horaire = prix d'achat ÷ (durée d'amortissement × heures par an) + entretien annuel ÷ heures par an. Vous pouvez aussi imposer directement un coût horaire.</p>
        <div style="overflow-x:auto;"><table class="sp-table"><thead><tr><th>Machine</th><th>Prix d'achat (€)</th><th>Durée (ans)</th><th>Heures / an</th><th>Entretien (€/an)</th><th>Coût horaire imposé</th><th>Coût horaire</th></tr></thead><tbody>
        ${d.machines.map(m => `<tr data-id="${m.id}"><td><strong>${esc(m.nom)}</strong></td>${['prix_achat', 'duree_amortissement_ans', 'heures_an', 'entretien_an', 'cout_horaire_force'].map(k => `<td><input class="co-m" data-k="${k}" type="number" step="any" min="0" style="width:105px;" value="${val(m[k])}"></td>`).join('')}<td class="co-ch"><strong>${m.cout_horaire === null ? '—' : eur(m.cout_horaire) + '/h'}</strong></td></tr>`).join('')}</tbody></table></div></div>
      <div class="co-pane hidden" data-p="per"><p class="plan-note">Salaire chargé par heure. Laissé vide : le coût moyen des réglages est utilisé. Ce coût sert au coût de revient et à la marge, jamais affiché au client.</p>
        <div style="overflow-x:auto;"><table class="sp-table"><thead><tr><th>Personne</th><th>Poste</th><th>Coût horaire (€/h)</th></tr></thead><tbody>
        ${d.personnel.map(p => `<tr data-id="${p.id}"><td><strong>${esc(p.nom)}</strong></td><td class="plan-note">${esc(p.poste || '')}</td><td><input class="co-p" type="number" step="any" min="0" style="width:105px;" value="${val(p.cout_horaire)}"></td></tr>`).join('')}</tbody></table></div></div>
      <div class="co-pane hidden" data-p="mat"><p class="plan-note">Prix par unité de stock. La « consommation type » est une formule (ex. <code>quantite * 0.002</code>, avec les caractéristiques de la fiche) qui pré-remplit la quantité dans le devis.</p>
        <div style="overflow-x:auto;"><table class="sp-table"><thead><tr><th>Matière</th><th>Unité</th><th>Prix unitaire (€)</th><th>Consommation type par OF (formule)</th></tr></thead><tbody>
        ${d.stocks.map(s => `<tr data-id="${s.id}"><td><strong>${esc(s.nom)}</strong></td><td class="plan-note">${esc(s.unite)}</td><td><input class="co-s-prix" type="number" step="any" min="0" style="width:105px;" value="${val(s.prix_unitaire)}"></td><td><input class="co-s-f" type="text" style="width:260px;" value="${esc(s.conso_formule || '')}" placeholder="facultatif"></td></tr>`).join('') || '<tr><td colspan="4" class="plan-note">Aucune matière en stock.</td></tr>'}</tbody></table></div></div>`;
    document.querySelectorAll('.co-tab').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.co-tab').forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('.co-pane').forEach(pn => pn.classList.toggle('hidden', pn.dataset.p !== b.dataset.t));
    }));
    document.getElementById('co-save').disabled = false;
    document.getElementById('co-save').addEventListener('click', async () => {
      const msg = document.getElementById('m-msg');
      const body = { parametres: {}, machines: [], personnel: [], stocks: [] };
      document.querySelectorAll('.co-param').forEach(i => { body.parametres[i.dataset.cle] = i.value; });
      document.querySelectorAll('.co-pane[data-p="mac"] tbody tr').forEach(tr => { const m = { id: tr.dataset.id }; tr.querySelectorAll('.co-m').forEach(i => { m[i.dataset.k] = i.value; }); body.machines.push(m); });
      document.querySelectorAll('.co-p').forEach(i => body.personnel.push({ id: i.closest('tr').dataset.id, cout_horaire: i.value }));
      document.querySelectorAll('.co-pane[data-p="mat"] tbody tr[data-id]').forEach(tr => body.stocks.push({ id: tr.dataset.id, prix_unitaire: tr.querySelector('.co-s-prix').value, conso_formule: tr.querySelector('.co-s-f').value }));
      msg.innerHTML = '<div class="msg">Enregistrement…</div>';
      try {
        const res = await fetch(`${API}/gerer-couts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || 'Erreur inconnue');
        toast('Coûts et tarifs enregistrés.');
        fermerModale();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    });
  }

  async function ouvrirModaleDevis(ofUuid, ofNumero) {
    afficherModale(`<h3>Devis — ${esc(ofNumero)}</h3><div id="dv-corps"><div class="msg">Calcul du devis d'après le chiffrage…</div></div>`, 'xlarge');
    let S, R, info, devisId = null, devisNumero = null;
    const post = async (corps) => {
      const res = await fetch(`${API}/calculer-devis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      return d;
    };
    try {
      const [d, listeRes] = await Promise.all([post({ of_id: ofUuid }), fetch(`${API}/gerer-devis?of_id=${ofUuid}`).then(r => r.json()).catch(() => ({ devis: [] }))]);
      info = { of: d.of, matieres: d.matieres_disponibles, avertissements: d.avertissements, saisis: listeRes.devis || [] };
      S = d.saisie; R = d.resultat;
    } catch (e) { document.getElementById('dv-corps').innerHTML = `<div class="msg error">${esc(e.message)}</div><div class="actions"><button class="btn" id="m-cancel">Fermer</button></div>`; document.getElementById('m-cancel').addEventListener('click', fermerModale); return; }
    let client = info.of.client || '', titre = info.of.titre || '', notes = '', statut = 'brouillon';

    const pf = (k) => S.parametres[k];
    function structure() {
      const dispo = info.matieres;
      document.getElementById('dv-corps').innerHTML = `
        ${info.saisis.length ? `<div class="field" style="max-width:520px;"><label>Devis déjà enregistrés pour cet OF</label><div style="display:flex;gap:8px;"><select id="dv-ouvrir">${info.saisis.map(x => `<option value="${x.id}">${esc(x.numero)} — ${eur(x.total_ht)} HT — ${esc(x.statut)}</option>`).join('')}</select><button class="btn" id="dv-charger">Ouvrir</button></div></div>` : ''}
        ${devisNumero ? `<div class="plan-note" style="margin-bottom:6px;">Devis <strong>${esc(devisNumero)}</strong> — statut : <select id="dv-statut">${['brouillon', 'envoyé', 'accepté', 'refusé'].map(s => `<option ${s === statut ? 'selected' : ''}>${s}</option>`).join('')}</select></div>` : ''}
        ${info.avertissements.length ? `<div class="msg" style="color:var(--accent-amber-text);">${info.avertissements.map(a => '⚠️ ' + esc(a)).join('<br>')} <a href="#" id="dv-couts" style="margin-left:6px;">Ouvrir Coûts & tarifs</a></div>` : ''}
        <div class="step-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));">
          <div class="field"><label>Client</label><input id="dv-client" value="${esc(client)}"></div>
          <div class="field"><label>Titre</label><input id="dv-titre" value="${esc(titre)}"></div>
          <div class="field"><label>Quantité (exemplaires)</label><input id="dv-qte" type="number" min="1" value="${S.quantite}"></div>
          <div class="field"><label>Main d'œuvre facturée (€/h)</label><input class="dv-p" data-k="taux_horaire_client" type="number" step="any" min="0" value="${pf('taux_horaire_client')}"></div>
          <div class="field"><label>Marge matières (%)</label><input class="dv-p" data-k="marge_matiere_pct" type="number" step="any" min="0" value="${pf('marge_matiere_pct')}"></div>
          <div class="field"><label>Marge machines (%)</label><input class="dv-p" data-k="marge_machine_pct" type="number" step="any" min="0" value="${pf('marge_machine_pct')}"></div>
          <div class="field"><label>TVA (%)</label><input class="dv-p" data-k="tva_pct" type="number" step="any" min="0" value="${pf('tva_pct')}"></div>
          <div class="field"><label>Remise (%)</label><input id="dv-remise" type="number" step="any" min="0" max="100" value="${S.remise_pct || 0}"></div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:0 0 10px;"><input type="checkbox" id="dv-fm" ${Number(pf('facturer_machine')) === 1 ? 'checked' : ''}> Facturer l'utilisation des machines en plus de la main d'œuvre (sinon elle est incluse dans le taux horaire)</label>

        <h4 class="dv-h">Main d'œuvre</h4>
        <table class="sp-table"><thead><tr><th>Opération</th><th>Heures</th><th>Coût horaire</th><th>Coût de revient</th><th>Prix de vente</th></tr></thead><tbody>
        ${S.mo.map((l, i) => `<tr><td>${esc(l.operation)}</td><td><input class="dv-l" data-g="mo" data-i="${i}" data-k="heures" type="number" step="any" min="0" style="width:80px;" value="${l.heures}"></td><td>${eur(l.cout_horaire)}</td><td class="dv-c" data-g="mo" data-i="${i}" data-k="cout"></td><td class="dv-c" data-g="mo" data-i="${i}" data-k="vente"></td></tr>`).join('') || '<tr><td colspan="5" class="plan-note">Aucune opération chiffrée.</td></tr>'}</tbody></table>

        <h4 class="dv-h">Utilisation des machines (amortissement)</h4>
        <table class="sp-table"><thead><tr><th>Opération — machine</th><th>Heures</th><th>Coût horaire (€/h)</th><th>Coût de revient</th><th>Prix de vente</th></tr></thead><tbody>
        ${S.machine.map((l, i) => `<tr><td>${esc(l.operation)} — ${esc(l.machine)}</td><td><input class="dv-l" data-g="machine" data-i="${i}" data-k="heures" type="number" step="any" min="0" style="width:80px;" value="${l.heures}"></td><td><input class="dv-l" data-g="machine" data-i="${i}" data-k="cout_horaire" type="number" step="any" min="0" style="width:80px;" value="${l.cout_horaire}"></td><td class="dv-c" data-g="machine" data-i="${i}" data-k="cout"></td><td class="dv-c" data-g="machine" data-i="${i}" data-k="vente"></td></tr>`).join('') || '<tr><td colspan="5" class="plan-note">Aucune utilisation machine.</td></tr>'}</tbody></table>

        <h4 class="dv-h">Matières premières <button class="btn" id="dv-add-mat" style="margin-left:8px;">+ Ajouter</button></h4>
        <table class="sp-table"><thead><tr><th>Matière</th><th>Unité</th><th>Quantité</th><th>Prix unitaire (€)</th><th>Coût d'achat</th><th>Prix de vente</th><th></th></tr></thead><tbody>
        ${S.matieres.map((l, i) => `<tr><td><input class="dv-l" data-g="matieres" data-i="${i}" data-k="nom" list="dv-mats" style="width:190px;" value="${esc(l.nom || '')}"></td><td><input class="dv-l" data-g="matieres" data-i="${i}" data-k="unite" style="width:60px;" value="${esc(l.unite || '')}"></td><td><input class="dv-l" data-g="matieres" data-i="${i}" data-k="quantite" type="number" step="any" min="0" style="width:90px;" value="${l.quantite}"></td><td><input class="dv-l" data-g="matieres" data-i="${i}" data-k="prix_unitaire" type="number" step="any" min="0" style="width:90px;" value="${l.prix_unitaire}"></td><td class="dv-c" data-g="matieres" data-i="${i}" data-k="cout"></td><td class="dv-c" data-g="matieres" data-i="${i}" data-k="vente"></td><td><button class="btn dv-del" data-g="matieres" data-i="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="plan-note">Aucune matière : ajoutez le papier, la colle, le fil, la couverture…</td></tr>'}</tbody></table>
        <datalist id="dv-mats">${dispo.map(m => `<option value="${esc(m.nom)}"></option>`).join('')}</datalist>

        <h4 class="dv-h">Autres frais (transport, sous-traitance…) <button class="btn" id="dv-add-aut" style="margin-left:8px;">+ Ajouter</button></h4>
        <table class="sp-table"><thead><tr><th>Libellé</th><th>Coût (€)</th><th>Prix de vente (€)</th><th></th></tr></thead><tbody>
        ${S.autres.map((l, i) => `<tr><td><input class="dv-l" data-g="autres" data-i="${i}" data-k="libelle" style="width:260px;" value="${esc(l.libelle || '')}"></td><td><input class="dv-l" data-g="autres" data-i="${i}" data-k="cout" type="number" step="any" min="0" style="width:100px;" value="${l.cout}"></td><td><input class="dv-l" data-g="autres" data-i="${i}" data-k="vente" type="number" step="any" min="0" style="width:100px;" value="${l.vente}"></td><td><button class="btn dv-del" data-g="autres" data-i="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="plan-note">Aucun autre frais.</td></tr>'}</tbody></table>

        <div id="dv-totaux"></div>
        <div class="field" style="margin-top:8px;"><label>Notes / conditions</label><input id="dv-notes" value="${esc(notes)}" placeholder="ex. délai de livraison, conditions de paiement"></div>
        <div id="m-msg"></div>
        <div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn" id="dv-pdf-int">PDF interne (marge)</button><button class="btn" id="dv-save">Enregistrer</button><button class="btn primary" id="dv-pdf">PDF client</button></div>`;
      brancher(); majAffichage();
    }

    let minuterie = null;
    function lire() {
      client = document.getElementById('dv-client').value; titre = document.getElementById('dv-titre').value; notes = document.getElementById('dv-notes').value;
      S.quantite = Number(document.getElementById('dv-qte').value) || 0;
      S.remise_pct = Number(document.getElementById('dv-remise').value) || 0;
      document.querySelectorAll('.dv-p').forEach(i => { S.parametres[i.dataset.k] = Number(i.value) || 0; });
      S.parametres.facturer_machine = document.getElementById('dv-fm').checked ? 1 : 0;
      document.querySelectorAll('.dv-l').forEach(i => { S[i.dataset.g][Number(i.dataset.i)][i.dataset.k] = i.type === 'number' ? i.value : i.value; });
    }
    async function recalculer() {
      lire();
      try { R = (await post({ saisie: S })).resultat; majAffichage(); } catch (e) { document.getElementById('m-msg').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    }
    function majAffichage() {
      document.querySelectorAll('.dv-c').forEach(td => { const v = R[td.dataset.g][Number(td.dataset.i)]; td.textContent = v ? eur(v[td.dataset.k]) : ''; });
      const t = R.totaux;
      const ligne = (l, v, cls) => `<tr class="${cls || ''}"><td>${l}</td><td style="text-align:right;">${v}</td></tr>`;
      document.getElementById('dv-totaux').innerHTML = `<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:12px;">
        <table class="sp-table" style="max-width:420px;"><tbody>
          ${ligne(`Main d'œuvre (${t.mo_heures} h)`, eur(t.mo_vente))}${ligne('Utilisation machines', eur(t.machine_vente))}${ligne('Matières premières', eur(t.matieres_vente))}${ligne('Autres frais', eur(t.autres_vente))}
          ${t.remise ? ligne(`Remise (${R.remise_pct} %)`, '− ' + eur(t.remise)) : ''}
          ${ligne('<strong>Total HT</strong>', '<strong>' + eur(t.ht) + '</strong>')}${ligne('TVA ' + R.parametres.tva_pct + ' %', eur(t.tva))}${ligne('<strong>Total TTC</strong>', '<strong>' + eur(t.ttc) + '</strong>')}
          ${t.prix_unitaire_ht !== null ? ligne('Prix par exemplaire HT', (t.prix_unitaire_ht).toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' €') + ligne('Prix pour 1 000 HT', eur(t.prix_mille_ht)) : ''}
        </tbody></table>
        <table class="sp-table" style="max-width:340px;background:var(--field-bg);"><tbody>
          <tr><td colspan="2" class="plan-note"><strong>Interne (jamais montré au client)</strong></td></tr>
          ${ligne('Coût de revient', eur(t.cout_revient))}${ligne('Marge', '<strong style="color:' + (t.marge >= 0 ? 'inherit' : 'var(--danger-text)') + ';">' + eur(t.marge) + '</strong>')}${ligne('Taux de marge', t.marge_pct + ' %')}
        </tbody></table></div>`;
    }
    function planifier() { clearTimeout(minuterie); minuterie = setTimeout(recalculer, 250); }

    async function enregistrer() {
      lire();
      const statutSel = document.getElementById('dv-statut');
      const res = await fetch(`${API}/gerer-devis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: devisId || undefined, of_id: ofUuid, client, titre, notes, statut: statutSel ? statutSel.value : undefined, saisie: S }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      R = d.resultat;
      if (!devisId) { devisId = d.id; devisNumero = d.numero; info.saisis.unshift({ id: d.id, numero: d.numero, total_ht: R.totaux.ht, statut: 'brouillon' }); structure(); }
      return { numero: devisNumero || d.numero };
    }
    function brancher() {
      document.getElementById('m-cancel').addEventListener('click', fermerModale);
      document.querySelectorAll('#dv-corps input:not(#dv-notes), #dv-fm').forEach(i => i.addEventListener('input', planifier));
      document.getElementById('dv-couts') && document.getElementById('dv-couts').addEventListener('click', (e) => { e.preventDefault(); ouvrirModaleCouts(); });
      document.getElementById('dv-add-mat').addEventListener('click', () => { lire(); S.matieres.push({ nom: '', unite: '', quantite: 0, prix_unitaire: 0 }); structure(); recalculer(); });
      document.getElementById('dv-add-aut').addEventListener('click', () => { lire(); S.autres.push({ libelle: '', cout: 0, vente: 0 }); structure(); recalculer(); });
      document.querySelectorAll('.dv-del').forEach(b => b.addEventListener('click', () => { lire(); S[b.dataset.g].splice(Number(b.dataset.i), 1); structure(); recalculer(); }));
      // Choisir une matière du stock : unité, prix et quantité type sont repris.
      document.querySelectorAll('.dv-l[data-k="nom"]').forEach(inp => inp.addEventListener('change', () => {
        const m = info.matieres.find(x => x.nom === inp.value);
        if (!m) return;
        lire();
        const l = S.matieres[Number(inp.dataset.i)];
        l.nom = m.nom; l.unite = m.unite; l.prix_unitaire = m.prix_unitaire ?? 0; if (m.quantite_proposee !== null && !Number(l.quantite)) l.quantite = m.quantite_proposee;
        structure(); recalculer();
      }));
      const ouvrir = document.getElementById('dv-charger');
      if (ouvrir) ouvrir.addEventListener('click', async () => {
        try {
          const d = await (await fetch(`${API}/gerer-devis?id=${document.getElementById('dv-ouvrir').value}`)).json();
          const { totaux, ...saisie } = d.contenu; S = saisie; R = d.contenu;
          client = d.client || ''; titre = d.titre || ''; notes = d.notes || ''; statut = d.statut; devisId = d.id; devisNumero = d.numero;
          structure();
        } catch (e) { document.getElementById('m-msg').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
      });
      document.getElementById('dv-save').addEventListener('click', async () => {
        const msg = document.getElementById('m-msg'); msg.innerHTML = '<div class="msg">Enregistrement…</div>';
        try { const r = await enregistrer(); toast(`Devis ${r.numero} enregistré.`); document.getElementById('m-msg').innerHTML = ''; } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
      });
      const pdf = (interne) => async () => {
        const msg = document.getElementById('m-msg'); msg.innerHTML = '<div class="msg">Génération du PDF…</div>';
        try { const r = await enregistrer(); await genererPdfDevis({ numero: r.numero, client, titre, notes, R, interne }); document.getElementById('m-msg').innerHTML = ''; } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
      };
      document.getElementById('dv-pdf').addEventListener('click', pdf(false));
      document.getElementById('dv-pdf-int').addEventListener('click', pdf(true));
    }
    structure();
  }

  async function genererPdfDevis({ numero, client, titre, notes, R, interne }) {
    await chargerLibsPdf();
    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), M = 14;
    const t = R.totaux, p = R.parametres;
    const ajd = new Date();
    const dateTxt = ajd.toLocaleDateString('fr-FR');
    const fin = new Date(ajd.getTime() + (Number(p.validite_jours) || 30) * 86400000).toLocaleDateString('fr-FR');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('Ateliers Babouot', M, 20);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(110); doc.text('Reliure industrielle et industrie graphique', M, 26); doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(interne ? 'DEVIS - VERSION INTERNE' : 'DEVIS', W - M, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(pdfTxt(`N° ${numero}`), W - M, 26, { align: 'right' });
    doc.text(pdfTxt(`Date : ${dateTxt}`), W - M, 31, { align: 'right' });
    doc.text(pdfTxt(`Valable jusqu'au ${fin}`), W - M, 36, { align: 'right' });
    let y = 46;
    doc.setFont('helvetica', 'bold'); doc.text('Client', M, y); doc.setFont('helvetica', 'normal'); doc.text(pdfTxt(client || '-'), M + 28, y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.text('Ouvrage', M, y); doc.setFont('helvetica', 'normal'); doc.text(pdfTxt(titre || '-'), M + 28, y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.text('Quantite', M, y); doc.setFont('helvetica', 'normal'); doc.text(pdfTxt(`${Number(R.quantite).toLocaleString('fr-FR')} exemplaires`), M + 28, y); y += 8;

    const E = (n) => pdfTxt(eur(n));
    const corps = [];
    const vide = (v) => Number(v) === 0;
    if (interne) {
      R.mo.filter(l => !vide(l.heures)).forEach(l => corps.push([pdfTxt(`Main d'oeuvre - ${l.operation}`), `${l.heures} h`, `${E(l.cout_horaire)}/h`, E(l.cout), E(l.vente)]));
      R.machine.filter(l => !vide(l.heures)).forEach(l => corps.push([pdfTxt(`Machine - ${l.machine} (${l.operation})`), `${l.heures} h`, `${E(l.cout_horaire)}/h`, E(l.cout), E(l.vente)]));
      R.matieres.filter(l => l.nom || l.cout).forEach(l => corps.push([pdfTxt(`Matiere - ${l.nom}`), pdfTxt(`${l.quantite} ${l.unite || ''}`), `${E(l.prix_unitaire)}`, E(l.cout), E(l.vente)]));
      R.autres.filter(l => l.libelle || l.cout || l.vente).forEach(l => corps.push([pdfTxt(l.libelle), '', '', E(l.cout), E(l.vente)]));
      doc.autoTable({ startY: y, margin: { left: M, right: M }, head: [['Poste', 'Quantite', 'Cout unitaire', 'Cout de revient', 'Prix de vente']], body: corps, styles: { fontSize: 8.5, cellPadding: 1.8 }, headStyles: { fillColor: [30, 90, 100] }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } });
    } else {
      // Version client : main d'oeuvre détaillée par opération (heures x taux), machines regroupées, matières, autres frais. Aucun coût de revient.
      R.mo.filter(l => !vide(l.heures)).forEach(l => corps.push([pdfTxt(`Main d'oeuvre - ${l.operation}`), `${l.heures} h`, `${E(p.taux_horaire_client)}/h`, E(l.vente)]));
      if (t.machine_vente > 0) corps.push(['Utilisation des machines', `${t.machine_heures} h`, '', E(t.machine_vente)]);
      R.matieres.filter(l => l.nom || l.vente).forEach(l => corps.push([pdfTxt(`Matiere - ${l.nom}`), pdfTxt(`${l.quantite} ${l.unite || ''}`), '', E(l.vente)]));
      R.autres.filter(l => l.libelle || l.vente).forEach(l => corps.push([pdfTxt(l.libelle), '', '', E(l.vente)]));
      doc.autoTable({ startY: y, margin: { left: M, right: M }, head: [['Designation', 'Quantite', 'Prix unitaire', 'Montant HT']], body: corps, styles: { fontSize: 9, cellPadding: 2 }, headStyles: { fillColor: [30, 90, 100] }, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } });
    }
    y = doc.lastAutoTable.finalY + 6;
    const tot = [];
    if (t.remise) tot.push(['Sous-total HT', E(t.brut_ht)], [`Remise ${R.remise_pct} %`, '- ' + E(t.remise)]);
    tot.push(['Total HT', E(t.ht)], [`TVA ${p.tva_pct} %`, E(t.tva)], ['Total TTC', E(t.ttc)]);
    if (t.prix_unitaire_ht !== null) tot.push(['Prix par exemplaire HT', pdfTxt(t.prix_unitaire_ht.toLocaleString('fr-FR', { minimumFractionDigits: 3 }) + ' EUR')], ['Prix pour 1 000 HT', E(t.prix_mille_ht)]);
    if (interne) tot.push(['Cout de revient', E(t.cout_revient)], ['Marge', E(t.marge)], ['Taux de marge', `${t.marge_pct} %`]);
    doc.autoTable({ startY: y, margin: { left: W - M - 90, right: M }, body: tot, theme: 'plain', styles: { fontSize: 9.5, cellPadding: 1.6 }, columnStyles: { 1: { halign: 'right' } },
      didParseCell: (h) => { if (['Total HT', 'Total TTC'].includes(h.row.raw[0])) h.cell.styles.fontStyle = 'bold'; } });
    y = doc.lastAutoTable.finalY + 8;
    if (notes) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(pdfTxt(notes), W - 2 * M), M, y); y += 10; }
    if (!interne) { doc.setFontSize(8.5); doc.setTextColor(110); doc.text(pdfTxt(`Devis valable ${p.validite_jours} jours. Bon pour accord (date, signature et cachet) :`), M, y + 4); doc.rect(M, y + 7, 80, 24); doc.setTextColor(0); }
    doc.save(`${interne ? 'devis-interne' : 'devis'}-${numero}.pdf`);
  }

  function ouvrirMenuOf(btn, ofUuid, ofNumero, ofStatut) {
    document.querySelectorAll('.row-menu').forEach(m => m.remove());
    const menu = el(`
      <div class="row-menu">
        <button data-action="valider">Valider l'OF</button>
        <button data-action="gamme">Voir la gamme opératoire</button>
        <button data-action="chiffrage">Chiffrage des temps</button>
        <button data-action="planifier">Planifier à l'heure</button>
        <button data-action="affecter">Affecter au planning</button>
        <button data-action="avancement">Avancement / production</button>
        <button data-action="devis">Devis</button>
        <button data-action="deplanifier">Déplanifier l'OF</button>
        <button data-action="supprimer" class="danger">Supprimer l'OF</button>
      </div>
    `);
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    menu.style.top = `${r.bottom + window.scrollY + 4}px`;
    menu.style.left = `${r.right + window.scrollX - menu.offsetWidth}px`;

    menu.querySelector('[data-action="planifier"]').addEventListener('click', () => {
      menu.remove();
      ouvrirModalePlanification(ofUuid, ofNumero);
    });
    menu.querySelector('[data-action="affecter"]').addEventListener('click', () => {
      menu.remove();
      ouvrirModaleAffectation({ ofUuid });
    });
    menu.querySelector('[data-action="devis"]').addEventListener('click', () => {
      menu.remove();
      ouvrirModaleDevis(ofUuid, ofNumero);
    });
    menu.querySelector('[data-action="avancement"]').addEventListener('click', () => {
      menu.remove();
      ouvrirModaleAvancementOf(ofUuid, ofNumero);
    });
    menu.querySelector('[data-action="deplanifier"]').addEventListener('click', () => {
      menu.remove();
      afficherModale(`
        <h3>Déplanifier ${esc(ofNumero)} ?</h3>
        <p style="font-size:13px; color:var(--ink-700); margin:0 0 6px;">Toutes les étapes <strong>planifiées</strong> de cet OF sont retirées du planning (machines, jours et personnel) et repassent « à planifier ». Vous pourrez ensuite les replanifier à la main ou avec « Planifier à l'heure ».</p>
        <p style="font-size:12.5px; color:var(--ink-500); margin:0;">Les étapes déjà démarrées ou terminées sont conservées.</p>
        <div id="m-msg"></div>
        <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-confirm-deplan">Déplanifier</button></div>`);
      document.getElementById('m-cancel').addEventListener('click', fermerModale);
      document.getElementById('m-confirm-deplan').addEventListener('click', async () => {
        const msg = document.getElementById('m-msg');
        msg.innerHTML = '<div class="msg">Déplanification…</div>';
        try {
          const res = await fetch(`${API}/deplanifier-etape`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ of_id: ofUuid }) });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
          toast(d.deplanifiees.length ? `${d.deplanifiees.length} étape(s) déplanifiée(s).${d.conservees.length ? ' ' + d.conservees.length + ' conservée(s) (déjà démarrées).' : ''}` : 'Aucune étape planifiée à retirer.');
          fermerModale(); chargerDonneesReelles();
        } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
      });
    });
    menu.querySelector('[data-action="supprimer"]').addEventListener('click', () => {
      menu.remove();
      const avertissementStatut = (ofStatut === 'en cours' || ofStatut === 'terminé')
        ? `<div class="msg error" style="margin-bottom:10px;">⚠️ Cet OF est <strong>${ofStatut}</strong> : sa production a déjà commencé ou est terminée.</div>`
        : '';
      afficherModale(`
        <h3>Supprimer ${ofNumero} ?</h3>
        ${avertissementStatut}
        <p style="font-size:13px; color:var(--ink-700); margin:0 0 6px;">Cette action est <strong>définitive</strong> et supprime aussi :</p>
        <ul style="font-size:13px; color:var(--ink-700); margin:0 0 4px; padding-left:18px;">
          <li>toutes les étapes de sa gamme opératoire</li>
          <li>toutes ses affectations au planning</li>
        </ul>
        <p style="font-size:12px; color:var(--ink-500); margin:8px 0 0;">L'historique des mouvements de stock est conservé.</p>
        <div id="m-msg"></div>
        <div class="actions">
          <button class="btn" id="m-cancel">Annuler</button>
          <button class="btn danger-btn" id="m-confirm-delete">Supprimer définitivement</button>
        </div>
      `);
      document.getElementById('m-cancel').addEventListener('click', fermerModale);
      document.getElementById('m-confirm-delete').addEventListener('click', async () => {
        const msg = document.getElementById('m-msg');
        msg.innerHTML = `<div class="msg">Suppression en cours…</div>`;
        try {
          const res = await fetch(`${API}/supprimer-ordre?of_id=${ofUuid}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
          const suffixe = data.affectations_supprimees > 0
            ? ` (${data.affectations_supprimees} affectation${data.affectations_supprimees>1?'s':''} planning retirée${data.affectations_supprimees>1?'s':''})`
            : '';
          toast(`${data.numero} supprimé${suffixe}.`);
          fermerModale(); chargerDonneesReelles();
        } catch (e) {
          msg.innerHTML = `<div class="msg error">${e.message}</div>`;
        }
      });
    });
    menu.querySelector('[data-action="valider"]').addEventListener('click', async () => {
      menu.remove();
      try {
        const res = await fetch(`${API}/valider-of`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ of_id: ofUuid, maintenant: maintenantLocal() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        if (data.statut === 'validé') {
          afficherResultatValidation(ofUuid, ofNumero, data);
        } else {
          ouvrirModaleBlocages(ofUuid, ofNumero, data);
        }
        chargerDonneesReelles();
      } catch (e) {
        toast(`Échec de la validation : ${e.message}`, 'error');
      }
    });
    menu.querySelector('[data-action="chiffrage"]').addEventListener('click', () => {
      menu.remove();
      ouvrirModaleChiffrage(ofUuid, ofNumero);
    });
    menu.querySelector('[data-action="gamme"]').addEventListener('click', async () => {
      menu.remove();
      afficherModale(`<h3>Gamme opératoire — ${ofNumero}</h3><div id="gamme-list" class="empty">Chargement…</div>`);
      try {
        const res = await fetch(`${API}/gammes-ordre?of_id=${ofUuid}`);
        const gammes = await res.json();
        const list = document.getElementById('gamme-list');
        const ETAT_LABEL2 = { 'à planifier': 'À planifier', 'planifié': 'Planifié', 'en cours': 'En cours', 'terminé': 'Terminé' };
        list.className = '';
        list.innerHTML = gammes.map(g => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--line); font-size:13px;">
            <span>${g.operation.nom}</span>
            <span class="tag ${g.statut==='terminé'?'ok':g.statut==='à planifier'?'warn':'ok'}">${ETAT_LABEL2[g.statut] || g.statut}</span>
          </div>
        `).join('') || '<div class="empty">Aucune étape.</div>';
      } catch (e) {
        document.getElementById('gamme-list').innerHTML = `Erreur : ${e.message}`;
      }
    });

    setTimeout(() => {
      document.addEventListener('click', function fermer(){ menu.remove(); document.removeEventListener('click', fermer); }, { once: true });
    }, 0);
  }

  function renderPersonnel(){
    const wrap = el(`
      <div class="panel">
        <div class="panel-head"><h2>Équipe atelier</h2></div>
        <table>
          <thead><tr><th>Opérateur</th><th>Poste</th><th>Compétences</th><th>Statut</th><th>Charge de la semaine</th><th></th></tr></thead>
          <tbody id="pers-tbody"></tbody>
        </table>
      </div>
    `);
    const tbody = wrap.querySelector('#pers-tbody');
    state.personnel.forEach(p=>{
      const fillClass = p.charge>=85?'danger':(p.charge>=65?'warn':'');
      tbody.appendChild(el(`
        <tr>
          <td>${p.name}</td>
          <td>${p.role}</td>
          <td>${p.comp.map(c=>`<span class="tag ok" style="margin-right:4px;">${c}</span>`).join('')}</td>
          <td><button class="statut-btn" data-id="${p.id}" data-action="dispo"><span class="tag ${statutTag(p.statut)}">${p.statut}</span></button></td>
          <td style="min-width:110px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--ink-500);"><span>${p.charge}%</span></div>
            <div class="bar-track"><div class="bar-fill ${fillClass}" style="width:${p.charge}%"></div></div>
          </td>
          <td><button class="btn edit-pers" data-id="${p.id}">Compétences</button></td>
        </tr>
      `));
    });
    tbody.querySelectorAll('.edit-pers').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = state.personnel.find(x => x.id === btn.dataset.id);
        ouvrirModaleCompetences(p);
      });
    });
    tbody.querySelectorAll('[data-action="dispo"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = state.personnel.find(x => x.id === btn.dataset.id);
        ouvrirModaleDisponibilite(p);
      });
    });
    return wrap;
  }

  // ---------- Feuille journalière de placement du personnel (PDF) ----------
  function chargerScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Impossible de charger ' + src));
      document.head.appendChild(s);
    });
  }
  async function chargerLibsPdf() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return;
    await chargerScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    await chargerScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }
  const pdfTxt = (v) => String(v == null ? '' : v).replace(/[  ]/g, ' ').replace(/[→≥≤]/g, '-');
  function dateFr(iso) {
    const d = new Date(iso + 'T00:00:00Z');
    const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    return `${jours[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const dateCourte = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';

  async function genererFeuilleJournaliere(date) {
    const res = await fetch(`${API}/feuille-journaliere?date=${date}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
    await chargerLibsPdf();
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('Feuille de placement du personnel', 10, 14);
    doc.setFontSize(12);
    doc.text(pdfTxt(maj(dateFr(date))), W - 10, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
    const nbAff = data.personnes.filter(p => p.creneaux.length).length;
    doc.text(pdfTxt(`Atelier Babouot  -  ${nbAff} personne(s) affectee(s)  -  ${data.nb_creneaux} creneau(x)  -  edite le ${new Date().toLocaleString('fr-FR')}`), 10, 20);
    doc.setTextColor(0);
    let y = 24;

    const absents = data.personnes.filter(p => !p.creneaux.length);
    const absentsTxt = absents.map(p => `${p.nom} (${p.statut}${p.plage ? ' ' + p.plage : ''}${p.commentaire ? ' - ' + p.commentaire : ''})`).join('  ;  ');
    if (absentsTxt) {
      doc.autoTable({ startY: y, theme: 'plain', margin: { left: 10, right: 10 }, styles: { fontSize: 8.5, cellPadding: 1.5, fillColor: [253, 240, 230] },
        body: [[pdfTxt('Indisponibles : ' + absentsTxt)]] });
      y = doc.lastAutoTable.finalY + 3;
    }

    const COLS = ['Horaire', 'Operation', 'Machine', 'OF', 'Titre / Client / Caracteristiques', 'Qte', 'Livraison', 'Equipe', 'Observations', 'Visa'];
    const ligne = (c) => [
      c.debut && c.fin ? `${c.debut}\n${c.fin}` : 'Journee',
      pdfTxt(c.operation),
      pdfTxt(c.machine),
      pdfTxt(c.of + (c.priorite && c.priorite !== 'normale' ? `\n(${c.priorite})` : '')),
      pdfTxt([c.titre, c.client].filter(Boolean).join(' - ') + (c.caracteristiques.length ? '\n' + c.caracteristiques.join('  |  ') : '')),
      c.quantite != null ? pdfTxt(Number(c.quantite).toLocaleString('fr-FR')) : '',
      dateCourte(c.delai),
      pdfTxt(c.equipe.join(', ')),
      '', '',
    ];
    const colStyles = { 0: { cellWidth: 16, fontStyle: 'bold' }, 1: { cellWidth: 32 }, 2: { cellWidth: 34 }, 3: { cellWidth: 22 }, 4: { cellWidth: 58 }, 5: { cellWidth: 14, halign: 'right' }, 6: { cellWidth: 18 }, 7: { cellWidth: 36 }, 8: { cellWidth: 'auto' }, 9: { cellWidth: 14 } };

    data.personnes.filter(p => p.creneaux.length).forEach(p => {
      if (y > 175) { doc.addPage(); y = 12; }
      doc.autoTable({
        startY: y, margin: { left: 10, right: 10 }, theme: 'grid',
        head: [[{ content: pdfTxt(`${p.nom}${p.poste ? '  -  ' + p.poste : ''}${p.plage ? '   (disponible ' + p.plage + ')' : ''}`), colSpan: 10, styles: { fillColor: [30, 90, 100], textColor: 255, fontSize: 10, halign: 'left' } }], COLS],
        body: p.creneaux.map(ligne), showHead: 'everyPage',
        styles: { fontSize: 8, cellPadding: 1.6, valign: 'middle', lineColor: [200, 200, 200] },
        headStyles: { fillColor: [235, 238, 240], textColor: 40, fontStyle: 'bold' },
        columnStyles: colStyles,
        didParseCell: (h) => { if (h.section === 'head' && h.row.index === 0) h.cell.styles.fillColor = [30, 90, 100]; if (h.section === 'head' && h.row.index === 0) h.cell.styles.textColor = 255; },
      });
      y = doc.lastAutoTable.finalY + 5;
    });

    if (data.sans_personnel.length) {
      if (y > 165) { doc.addPage(); y = 12; }
      doc.autoTable({
        startY: y, margin: { left: 10, right: 10 }, theme: 'grid',
        head: [[{ content: 'ATTENTION - Creneaux sans personnel affecte', colSpan: 10, styles: { fillColor: [180, 80, 40], textColor: 255, fontSize: 10, halign: 'left' } }], COLS],
        body: data.sans_personnel.map(ligne),
        styles: { fontSize: 8, cellPadding: 1.6, valign: 'middle' }, headStyles: { fillColor: [235, 238, 240], textColor: 40 }, columnStyles: colStyles,
      });
      y = doc.lastAutoTable.finalY + 5;
    }
    if (data.presents_sans_tache.length) {
      if (y > 185) { doc.addPage(); y = 12; }
      doc.autoTable({ startY: y, theme: 'plain', margin: { left: 10, right: 10 }, styles: { fontSize: 8.5, cellPadding: 1.5, fillColor: [238, 244, 238] },
        body: [[pdfTxt('Presents sans tache planifiee : ' + data.presents_sans_tache.map(p => p.nom).join(', '))]] });
      y = doc.lastAutoTable.finalY + 5;
    }
    if (!data.nb_creneaux) {
      doc.setFontSize(11); doc.text('Aucun creneau planifie ce jour-la.', 10, y + 6);
    }

    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(110);
      doc.text(pdfTxt(`Chef d'atelier : ____________________    Date/visa : ____________________`), 10, 205);
      doc.text(`Page ${i} / ${n}`, W - 10, 205, { align: 'right' });
    }
    doc.save(`placement-personnel-${date}.pdf`);
  }

  // ---------- Affichage collectif : tout le personnel sur une page, en grille horaire ----------
  async function genererAffichageCollectif(date) {
    const res = await fetch(`${API}/feuille-journaliere?date=${date}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
    await chargerLibsPdf();

    const mn = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
    const gens = [
      ...data.personnes.map(p => ({ nom: p.nom, poste: p.poste, statut: p.statut, plage: p.plage, commentaire: p.commentaire, creneaux: p.creneaux })),
      ...data.presents_sans_tache.map(p => ({ nom: p.nom, poste: p.poste, statut: 'présent', plage: '', commentaire: '', creneaux: [] })),
    ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    // Créneaux planifiés mais sans personne : une ligne « NON AFFECTÉ » par machine, pour que rien ne manque sur l'affichage.
    const parMachine = {};
    data.sans_personnel.forEach(c => { (parMachine[c.machine] = parMachine[c.machine] || []).push(c); });
    Object.entries(parMachine).forEach(([mach, cs]) => gens.push({ nom: 'NON AFFECTE', poste: mach.replace(/\s*\(.*\)$/, ''), statut: 'présent', plage: '', commentaire: '', creneaux: cs, sansPers: true }));

    // Axe horaire : 7h-17h au minimum, élargi si besoin
    let h0 = 7 * 60, h1 = 17 * 60;
    gens.forEach(g => g.creneaux.forEach(c => { if (c.debut) h0 = Math.min(h0, mn(c.debut)); if (c.fin) h1 = Math.max(h1, mn(c.fin)); }));
    h0 = Math.floor(h0 / 60) * 60; h1 = Math.ceil(h1 / 60) * 60;

    // Couleur par OF
    const PALETTE = [[200,230,225],[250,220,190],[210,220,245],[245,210,225],[225,240,190],[235,215,250],[255,240,170],[200,235,245],[250,205,200],[215,235,215],[240,225,205],[220,220,235]];
    const ofs = [...new Set(data.personnes.flatMap(p => p.creneaux).concat(data.sans_personnel).map(c => c.of))];
    const couleurOf = Object.fromEntries(ofs.map((o, i) => [o, PALETTE[i % PALETTE.length]]));

    const grand = gens.length > 13;
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: grand ? 'a3' : 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const M = 8, nomW = 42, x0 = M + nomW, gw = W - M - x0;
    const px = (min) => x0 + ((min - h0) / (h1 - h0)) * gw;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(grand ? 24 : 18);
    doc.text('Affectation du personnel', M, 13);
    doc.text(pdfTxt(maj(dateFr(date))), W - M, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100);
    doc.text(pdfTxt(`Atelier Babouot - edite le ${new Date().toLocaleString('fr-FR')}`), M, 18);
    doc.setTextColor(0);

    // Lecture des lignes : lanes si chevauchement
    gens.forEach(g => {
      const tri = g.creneaux.slice().sort((a, b) => (a.debut ? mn(a.debut) : h0) - (b.debut ? mn(b.debut) : h0));
      const fins = [];
      tri.forEach(c => {
        const d = c.debut ? mn(c.debut) : h0, f = c.fin ? mn(c.fin) : h1;
        let l = fins.findIndex(x => x <= d); if (l < 0) { l = fins.length; fins.push(0); }
        fins[l] = f; c._l = l; c._d = d; c._f = f;
      });
      g.lanes = Math.max(1, fins.length);
    });

    const yHead = 22, hHead = 7;
    const legendeH = Math.min(40, 8 + Math.ceil(ofs.length / 2) * 5);
    const dispo = H - yHead - hHead - legendeH - 14;
    const totLanes = gens.reduce((s, g) => s + g.lanes, 0) || 1;
    const hLane = Math.max(11, Math.min(26, dispo / totLanes));

    // En-tête horaire
    doc.setFillColor(30, 90, 100); doc.rect(M, yHead, W - 2 * M, hHead, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text('Personnel', M + 2, yHead + 4.8);
    for (let t = h0; t <= h1; t += 60) {
      const x = px(t);
      if (t < h1) doc.text(`${String(t / 60).padStart(2, '0')}h`, x + 1.5, yHead + 4.8);
    }
    doc.setTextColor(0);

    let y = yHead + hHead;
    gens.forEach((g, i) => {
      const hRow = g.lanes * hLane;
      if (i % 2 === 0) { doc.setFillColor(247, 248, 249); doc.rect(M, y, W - 2 * M, hRow, 'F'); }
      // pause
      doc.setFillColor(232, 232, 232); doc.rect(px(12 * 60), y, px(12 * 60 + 30) - px(12 * 60), hRow, 'F');
      // grille verticale
      doc.setDrawColor(215); doc.setLineWidth(0.15);
      for (let t = h0; t <= h1; t += 60) doc.line(px(t), y, px(t), y + hRow);
      doc.line(M, y + hRow, W - M, y + hRow);

      // nom
      doc.setFont('helvetica', 'bold'); doc.setFontSize(grand ? 11 : 10);
      if (g.sansPers) { doc.setFillColor(253, 232, 224); doc.rect(M, y, nomW, hRow, 'F'); doc.setTextColor(180, 60, 30); }
      doc.text(pdfTxt(g.nom), M + 2, y + hRow / 2 - (g.poste ? 0.5 : -1.2), { maxWidth: nomW - 3 });
      doc.setTextColor(0);
      if (g.poste) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(g.sansPers ? 180 : 100, g.sansPers ? 60 : 100, g.sansPers ? 30 : 100); doc.text(pdfTxt(g.poste), M + 2, y + hRow / 2 + 3.2, { maxWidth: nomW - 3 }); doc.setTextColor(0); }

      if (!g.creneaux.length) {
        const indispo = !['présent', 'disponible'].includes(g.statut);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(indispo ? 180 : 130, indispo ? 60 : 130, indispo ? 40 : 130);
        doc.text(pdfTxt(indispo ? `${g.statut.toUpperCase()}${g.plage ? ' ' + g.plage : ''}${g.commentaire ? ' - ' + g.commentaire : ''}` : 'Disponible - sans affectation'), x0 + 3, y + hRow / 2 + 1);
        doc.setTextColor(0);
      }
      g.creneaux.forEach(c => {
        const bx = px(c._d), bw = px(c._f) - bx - 0.4, by = y + c._l * hLane + 0.8, bh = hLane - 1.6;
        const col = couleurOf[c.of] || [230, 230, 230];
        doc.setFillColor(...col); doc.setDrawColor(90); doc.setLineWidth(0.25);
        if (g.sansPers) { doc.setDrawColor(180, 60, 30); doc.setLineDashPattern([1.2, 0.8], 0); }
        doc.roundedRect(bx + 0.2, by, bw, bh, 1, 1, 'FD');
        doc.setLineDashPattern([], 0);
        const base = grand ? 8.5 : 7.5;
        const grandBloc = bh >= 17;
        const nbL = grandBloc ? 4 : 3;
        const fs = Math.max(5.8, Math.min(base, (bh - 1.2) / (nbL * 0.43)));
        const pas = fs * 0.43;
        const nomMachine = c.machine.replace(/\s*\(.*\)$/, '');
        const horaire = c.debut ? `${c.debut}-${c.fin}` : '';
        const titre = [c.titre, c.client].filter(Boolean).join(' - ') || c.of;
        const items = grandBloc
          ? [['b', c.operation], ['bi', titre], ['n', nomMachine], ['n', `${c.of}  ${horaire}`]]
          : [['b', c.operation], ['bi', titre], ['n', `${nomMachine} | ${c.of} ${horaire}`]];
        doc.setFontSize(fs);
        items.forEach(([st, txt], k) => {
          doc.setFont('helvetica', st === 'b' ? 'bold' : st === 'bi' ? 'bolditalic' : 'normal');
          const l = doc.splitTextToSize(pdfTxt(txt), bw - 2)[0] || '';
          doc.text(l, bx + 1.2, by + 0.8 + (k + 1) * pas);
        });
      });
      y += hRow;
    });
    doc.setDrawColor(150); doc.setLineWidth(0.3); doc.rect(M, yHead, W - 2 * M, y - yHead);

    // Légende des OF
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Ordres de fabrication du jour', M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const detail = {};
    data.personnes.flatMap(p => p.creneaux).concat(data.sans_personnel).forEach(c => { detail[c.of] = c; });
    const colW = (W - 2 * M) / 2;
    ofs.forEach((o, i) => {
      const c = detail[o]; const cx = M + (i % 2) * colW, cy = y + 5 + Math.floor(i / 2) * 5;
      doc.setFillColor(...couleurOf[o]); doc.setDrawColor(90); doc.rect(cx, cy - 3, 6, 3.6, 'FD');
      doc.text(pdfTxt(`${o} - ${c.titre || ''}${c.client ? ' (' + c.client + ')' : ''}${c.quantite != null ? ' - ' + Number(c.quantite).toLocaleString('fr-FR') + ' ex.' : ''}${c.delai ? ' - livraison ' + dateCourte(c.delai) : ''}`), cx + 8, cy, { maxWidth: colW - 10 });
    });
    if (data.sans_personnel.length) {
      doc.setTextColor(180, 60, 30); doc.setFont('helvetica', 'bold');
      doc.text(pdfTxt(`Attention : ${data.sans_personnel.length} creneau(x) planifie(s) sans personnel affecte (lignes NON AFFECTE).`), W - M, H - 7, { align: 'right' });
      doc.setTextColor(0);
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110);
    doc.text('Zone grisee : pause', M, H - 7); doc.setTextColor(0);
    doc.save(`affichage-personnel-${date}.pdf`);
  }

  function ouvrirModaleFeuilleJournaliere() {
    const joursPlanifies = DAYS_ISO.filter((iso, i) => Object.values(state.planning || {}).some(l => l.some(s => s.day === i)));
    const defaut = joursPlanifies.includes(AUJOURDHUI_ISO) ? AUJOURDHUI_ISO : (joursPlanifies[0] || (DAYS_ISO.includes(AUJOURDHUI_ISO) ? AUJOURDHUI_ISO : DAYS_ISO[0]));
    const indice = joursPlanifies.length
      ? `Jours planifiés cette semaine : ${joursPlanifies.map(iso => DAYS[DAYS_ISO.indexOf(iso)]).join(', ')}`
      : 'Aucun créneau planifié sur la semaine affichée.';
    afficherModale(`
      <h3>Feuille de placement du personnel</h3>
      <div class="field"><label>Modèle</label>
        <select id="fj-modele">
          <option value="collectif">Affichage collectif — tout le personnel sur une page (grille horaire)</option>
          <option value="detail">Feuille détaillée — une section par personne (observations, visa)</option>
        </select>
      </div>
      <div class="field"><label>Jour</label><input id="fj-date" type="date" value="${defaut}"><div style="font-size:12px;color:var(--ink-500);margin-top:4px;">${indice}</div></div>
      <div id="m-msg"></div>
      <div class="actions">
        <button class="btn" id="m-cancel">Annuler</button>
        <button class="btn primary" id="fj-go">Télécharger le PDF</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('fj-go').addEventListener('click', async () => {
      const date = document.getElementById('fj-date').value;
      const msg = document.getElementById('m-msg');
      if (!date) { msg.innerHTML = `<div class="msg error">Choisissez un jour.</div>`; return; }
      msg.innerHTML = `<div class="msg">Génération du PDF…</div>`;
      try {
        if (document.getElementById('fj-modele').value === 'collectif') await genererAffichageCollectif(date);
        else await genererFeuilleJournaliere(date);
        toast('Feuille de placement téléchargée.');
        fermerModale();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }

  async function ouvrirModaleDisponibilite(personne) {
    afficherModale(`
      <h3>Disponibilité — ${personne.name}</h3>
      <div class="field"><label>Jour concerné</label><input id="d-date" type="date" value="${AUJOURDHUI_ISO}"></div>
      <div class="field"><label>Statut</label>
        <select id="d-statut">
          <option value="disponible">Disponible</option>
          <option value="en arrêt">En arrêt</option>
          <option value="absent">Absent(e)</option>
        </select>
      </div>
      <div class="field hidden" id="d-horaires-wrap">
        <label><input type="checkbox" id="d-partiel"> Disponible seulement sur une plage horaire</label>
        <div style="display:flex; gap:10px; margin-top:8px;">
          <div class="field"><label>De</label><input id="d-heure-debut" type="time" value="09:00"></div>
          <div class="field"><label>À</label><input id="d-heure-fin" type="time" value="17:00"></div>
        </div>
      </div>
      <div id="m-msg"></div>
      <div class="actions">
        <button class="btn" id="d-reset">Réinitialiser (disponible)</button>
        <button class="btn" id="m-cancel">Annuler</button>
        <button class="btn primary" id="m-submit">Enregistrer</button>
      </div>
    `);

    const statutSelect = document.getElementById('d-statut');
    const horairesWrap = document.getElementById('d-horaires-wrap');
    const partielCheckbox = document.getElementById('d-partiel');
    function majAffichageHoraires() {
      horairesWrap.classList.toggle('hidden', statutSelect.value !== 'disponible');
    }
    statutSelect.addEventListener('change', majAffichageHoraires);
    majAffichageHoraires();

    document.getElementById('m-cancel').addEventListener('click', fermerModale);

    document.getElementById('d-reset').addEventListener('click', async () => {
      const date = document.getElementById('d-date').value;
      const msg = document.getElementById('m-msg');
      msg.innerHTML = `<div class="msg">Réinitialisation…</div>`;
      try {
        const res = await fetch(`${API}/gerer-disponibilite?personnel_id=${personne.id}&date=${date}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Erreur inconnue');
        toast(`${personne.name} remis·e disponible pour le ${date}.`);
        fermerModale(); chargerDonneesReelles();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });

    document.getElementById('m-submit').addEventListener('click', async () => {
      const date = document.getElementById('d-date').value;
      const statut = statutSelect.value;
      const partiel = statut === 'disponible' && partielCheckbox.checked;
      const heure_debut = partiel ? document.getElementById('d-heure-debut').value : null;
      const heure_fin = partiel ? document.getElementById('d-heure-fin').value : null;
      const msg = document.getElementById('m-msg');
      msg.innerHTML = `<div class="msg">Enregistrement…</div>`;
      try {
        const res = await fetch(`${API}/gerer-disponibilite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personnel_id: personne.id, date, statut, heure_debut, heure_fin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        toast(`Disponibilité de ${personne.name} mise à jour pour le ${date}.`);
        fermerModale(); chargerDonneesReelles();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }

  async function ouvrirModaleCompetences(personne) {
    let refs, actuelles;
    try {
      refs = await getReferentiels();
      const res = await fetch(`${API}/gerer-competences?personnel_id=${personne.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      actuelles = (await res.json()).operation_codes;
    } catch (e) {
      afficherModale(`<h3>Compétences</h3><div class="msg error">Backend indisponible. (${e.message})</div>`);
      return;
    }

    const opsHtml = refs.operations.map(o => `
      <label><input type="checkbox" value="${o.code}" ${actuelles.includes(o.code) ? 'checked' : ''}> ${o.nom}</label>
    `).join('');

    afficherModale(`
      <h3>Compétences — ${personne.name}</h3>
      <div class="field"><label>Opérations que cette personne sait réaliser</label><div class="op-list">${opsHtml}</div></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">Enregistrer</button></div>
    `);

    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-submit').addEventListener('click', async () => {
      const operation_codes = Array.from(document.querySelectorAll('.modal .op-list input:checked')).map(i => i.value);
      const msg = document.getElementById('m-msg');
      msg.innerHTML = `<div class="msg">Enregistrement en cours…</div>`;
      try {
        const res = await fetch(`${API}/gerer-competences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personnel_id: personne.id, operation_codes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        toast(`Compétences de ${personne.name} mises à jour.`);
        fermerModale(); chargerDonneesReelles();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }

  function renderMachines(){
    const wrap = el(`
      <div class="panel">
        <div class="panel-head"><h2>Parc machine</h2><button class="btn primary" id="new-machine"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Nouvelle machine</button></div>
        <table>
          <thead><tr><th>Nom</th><th>Code</th><th>Opération principale</th><th>Statut</th><th></th></tr></thead>
          <tbody id="machines-tbody"><tr><td colspan="5" class="empty">Chargement…</td></tr></tbody>
        </table>
      </div>
    `);

    chargerListeMachines(wrap);

    wrap.querySelector('#new-machine').addEventListener('click', () => ouvrirModaleMachine(null));
    return wrap;
  }

  async function chargerListeMachines(wrap) {
    const tbody = wrap.querySelector('#machines-tbody');
    try {
      const res = await fetch(`${API}/gerer-machines`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const machines = await res.json();
      tbody.innerHTML = '';
      machines.forEach(m => {
        tbody.appendChild(el(`
          <tr>
            <td>${m.nom}</td>
            <td class="mono">${m.code}</td>
            <td>${(m.operations && m.operations.length) ? m.operations.map(o=>`<span class="tag ok" style="margin-right:4px;">${o.nom}</span>`).join('') : '<span style="color:var(--ink-500)">— aucune —</span>'}</td>
            <td><span class="tag ${m.actif ? 'ok' : 'danger'}">${m.actif ? 'Active' : 'Inactive'}</span></td>
            <td style="white-space:nowrap;">
              <button class="btn edit-machine" data-id="${m.id}">Modifier</button>
              <button class="btn btn-icon-danger delete-machine" data-id="${m.id}" title="Supprimer cette machine" aria-label="Supprimer ${m.nom}">${svgIcon('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>')}</button>
            </td>
          </tr>
        `));
      });
      tbody.querySelectorAll('.edit-machine').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = machines.find(x => x.id === btn.dataset.id);
          ouvrirModaleMachine(m);
        });
      });
      tbody.querySelectorAll('.delete-machine').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = machines.find(x => x.id === btn.dataset.id);
          ouvrirModaleSuppressionMachine(m);
        });
      });
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">Backend indisponible — impossible de charger le parc machine réel. (${e.message})</td></tr>`;
    }
  }

  function ouvrirModaleSuppressionMachine(machine) {
    afficherModale(`
      <h3>Supprimer ${machine.nom} ?</h3>
      <p style="font-size:13px; color:var(--ink-700); margin:0;">Cette action est <strong>définitive</strong>. La machine sera retirée du parc, de la liste des opérations qu'elle réalise et des compétences machine du personnel.</p>
      <div id="m-msg"></div>
      <div class="actions">
        <button class="btn" id="m-cancel">Annuler</button>
        <button class="btn danger-btn" id="m-confirm-delete">Supprimer</button>
      </div>
    `);
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-confirm-delete').addEventListener('click', () => supprimerMachine(machine, false));
  }

  async function supprimerMachine(machine, force) {
    const msg = document.getElementById('m-msg');
    msg.innerHTML = `<div class="msg">Suppression en cours…</div>`;
    try {
      const res = await fetch(`${API}/gerer-machines?id=${machine.id}${force ? '&force=true' : ''}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.status === 409 && data.utilisee) {
        // Machine encore utilisée : proposer la désactivation, ou la suppression forcée.
        const { affectations, etapes_gamme } = data.utilisee;
        afficherModale(`
          <h3>${machine.nom} est encore utilisée</h3>
          <p style="font-size:13px; color:var(--ink-700); margin:0 0 8px;">
            Elle est référencée par <strong>${affectations} affectation(s) planning</strong>
            et <strong>${etapes_gamme} étape(s) de gamme</strong>.
          </p>
          <p style="font-size:13px; color:var(--ink-700); margin:0 0 4px;"><strong>Désactiver</strong> la machine la retire des plannings sans rien perdre — c'est l'option la plus sûre.</p>
          <p style="font-size:13px; color:var(--ink-700); margin:0;"><strong>Supprimer quand même</strong> retire ses affectations du planning ; les étapes de gamme concernées repasseront « à planifier ».</p>
          <div id="m-msg"></div>
          <div class="actions">
            <button class="btn" id="m-cancel">Annuler</button>
            <button class="btn" id="m-desactiver">Désactiver à la place</button>
            <button class="btn danger-btn" id="m-force-delete">Supprimer quand même</button>
          </div>
        `);
        document.getElementById('m-cancel').addEventListener('click', fermerModale);
        document.getElementById('m-force-delete').addEventListener('click', () => supprimerMachine(machine, true));
        document.getElementById('m-desactiver').addEventListener('click', async () => {
          const m2 = document.getElementById('m-msg');
          try {
            const r = await fetch(`${API}/gerer-machines`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: machine.id, actif: false }),
            });
            if (!r.ok) throw new Error((await r.json()).error || 'Erreur inconnue');
            toast(`${machine.nom} désactivée.`);
            fermerModale(); chargerDonneesReelles();
          } catch (e) { m2.innerHTML = `<div class="msg error">${e.message}</div>`; }
        });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
      const suffixe = data.affectations_retirees > 0 ? ` (${data.affectations_retirees} affectation(s) retirée(s))` : '';
      toast(`${data.nom} supprimée${suffixe}.`);
      fermerModale(); chargerDonneesReelles();
    } catch (e) {
      msg.innerHTML = `<div class="msg error">${e.message}</div>`;
    }
  }

  async function ouvrirModaleMachine(machine) {
    let refs;
    try { refs = await getReferentiels(); }
    catch (e) {
      afficherModale(`<h3>Machine</h3><div class="msg error">Backend indisponible. (${e.message})</div><div class="actions"><button class="btn" id="m-close">Fermer</button></div>`);
      document.getElementById('m-close').addEventListener('click', fermerModale);
      return;
    }

    const estEdition = !!machine;
    const codesActuels = machine ? (machine.operations || []).map(o => o.code) : [];
    const opsHtml = refs.operations.map(o => `
      <label><input type="checkbox" value="${o.code}" ${codesActuels.includes(o.code) ? 'checked' : ''}> ${o.nom}</label>
    `).join('');

    afficherModale(`
      <h3>${estEdition ? 'Modifier la machine' : 'Nouvelle machine'}</h3>
      <div class="field"><label>Code</label><input id="m-code" value="${machine ? machine.code : ''}" placeholder="ex: SIGLOCH"></div>
      <div class="field"><label>Nom</label><input id="m-nom" value="${machine ? machine.nom : ''}" placeholder="ex: Sigloch"></div>
      <div class="field"><label>Opérations (cocher toutes celles que cette machine peut faire)</label><div class="op-list">${opsHtml}</div></div>
      ${estEdition ? `<div class="field"><label><input type="checkbox" id="m-actif" ${machine.actif ? 'checked' : ''}> Machine active</label></div>
      <div class="field"><label>Temps de production de cette machine <span class="plan-note">— mise en route, réglage, cadence, nettoyage (par type de production)</span></label><button class="btn" type="button" id="m-profils">Configurer les temps de production…</button></div>` : ''}
      <div class="field"><label>Notes</label><input id="m-notes" value="${machine && machine.notes ? machine.notes : ''}" placeholder="optionnel"></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">${estEdition ? 'Enregistrer' : 'Créer'}</button></div>
    `);

    if (estEdition) document.getElementById('m-profils').addEventListener('click', () => ouvrirProfilsMachine(machine, refs));
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-submit').addEventListener('click', async () => {
      const code = document.getElementById('m-code').value.trim();
      const nom = document.getElementById('m-nom').value.trim();
      const operation_codes = Array.from(document.querySelectorAll('.modal .op-list input:checked')).map(i => i.value);
      const notes = document.getElementById('m-notes').value.trim();
      const msg = document.getElementById('m-msg');

      if (!code || !nom) {
        msg.innerHTML = `<div class="msg error">Code et nom sont requis.</div>`;
        return;
      }
      msg.innerHTML = `<div class="msg">Enregistrement en cours…</div>`;
      try {
        const payload = estEdition
          ? { id: machine.id, code, nom, operation_codes, notes, actif: document.getElementById('m-actif').checked }
          : { code, nom, operation_codes, notes };
        const res = await fetch(`${API}/gerer-machines`, {
          method: estEdition ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        msg.innerHTML = `<div class="msg ok">Enregistré.</div>`;
        toast(estEdition ? 'Machine mise à jour.' : 'Machine créée.');
        fermerModale(); render();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }


  // ---------- Profils de temps d'une machine (par type de production) ----------
  // Un profil = mise en route + réglage + roulage (cadence en ex./h) + nettoyage.
  // Le chiffrage l'applique automatiquement : MER + réglage + quantité ÷ cadence + nettoyage.
  async function ouvrirProfilsMachine(machine, refs) {
    const codes = (machine.operations || []).map(o => o.code);
    const ops = refs.operations.filter(o => codes.includes(o.code));
    let donnees;
    const charger = async () => {
      const res = await fetch(`${API}/profils-machine?machine_id=${machine.id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      return d;
    };
    try { donnees = await charger(); }
    catch (e) {
      afficherModale(`<h3>Temps de production — ${esc(machine.nom)}</h3><div class="msg error">${esc(e.message)}${/type_production|types_production|relation/i.test(e.message) ? ' — exécutez d\'abord la migration 23 dans Supabase.' : ''}</div><div class="actions"><button class="btn" id="m-close">Fermer</button></div>`);
      document.getElementById('m-close').addEventListener('click', fermerModale);
      return;
    }
    if (!ops.length) {
      afficherModale(`<h3>Temps de production — ${esc(machine.nom)}</h3><div class="msg">Cochez d'abord au moins une opération pour cette machine (et enregistrez), puis revenez ici.</div><div class="actions"><button class="btn" id="m-close">Fermer</button></div>`);
      document.getElementById('m-close').addEventListener('click', fermerModale);
      return;
    }
    const nomType = (c) => c ? ((donnees.types.find(t => t.code === c) || { libelle: c }).libelle) : 'Tous types';
    const nbm = (v) => (v === null || v === undefined ? '—' : `${v} min`);
    const dessiner = () => {
      const lignes = donnees.profils.map((p, i) => `
        <div class="profil-ligne"><div><strong>${esc(p.operation)}</strong> · ${esc(nomType(p.type_production))}<br>
          <span class="plan-note">mise en route ${nbm(p.mise_en_route_min)} · réglage ${nbm(p.reglage_min)} · roulage ${p.cadence_par_h ? p.cadence_par_h + ' ' + (p.unite_cadence || 'ex.') + '/h' : '—'}${p.quantite_formule ? ' (sur ' + esc(p.quantite_formule) + ')' : ''} · nettoyage ${nbm(p.nettoyage_min)}</span></div>
          <span><button class="btn" data-modif="${i}">Modifier</button> <button class="btn" data-suppr="${i}">Supprimer</button></span></div>`).join('');
      $('pf-liste').innerHTML = lignes || '<div class="empty">Aucun profil enregistré pour cette machine.</div>';
      $('pf-liste').querySelectorAll('[data-modif]').forEach(b => b.addEventListener('click', () => {
        const p = donnees.profils[Number(b.dataset.modif)];
        $('pf-op').value = p.operation_id; $('pf-type').value = p.type_production || '';
        $('pf-mer').value = p.mise_en_route_min ?? ''; $('pf-reg').value = p.reglage_min ?? '';
        $('pf-cad').value = p.cadence_par_h ?? ''; $('pf-net').value = p.nettoyage_min ?? ''; $('pf-pers').value = p.nb_personnes || 1;
        $('pf-unite').value = p.unite_cadence || ''; $('pf-formule').value = p.quantite_formule || ''; majUnite();
        calcul();
      }));
      $('pf-liste').querySelectorAll('[data-suppr]').forEach(b => b.addEventListener('click', async () => {
        const p = donnees.profils[Number(b.dataset.suppr)];
        if (!confirm(`Supprimer ce profil (${p.operation} · ${nomType(p.type_production)}) ?`)) return;
        try {
          const res = await fetch(`${API}/profils-machine?machine_id=${machine.id}&operation_id=${p.operation_id}&type_production=${p.type_production || 'tous'}`, { method: 'DELETE' });
          if (!res.ok) throw new Error((await res.json()).error || 'Erreur inconnue');
          donnees = await charger(); dessiner();
        } catch (e) { $('pf-msg').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
      }));
    };
    const $ = (id) => document.getElementById(id);
    afficherModale(`
      <h3>Temps de production — ${esc(machine.nom)}</h3>
      <div id="pf-liste"></div>
      <div class="produit-box">
        <div class="produit-titre">Ajouter ou modifier un profil <span class="plan-note">— un profil par opération et par type de production ; le même enregistrement le remplace</span></div>
        <div class="step-grid">
          <div class="field"><label>Opération</label><select id="pf-op">${ops.map(o => `<option value="${o.id}">${esc(o.nom)}</option>`).join('')}</select></div>
          <div class="field"><label>Type de production</label><select id="pf-type"><option value="">Tous types</option>${donnees.types.map(t => `<option value="${esc(t.code)}">${esc(t.libelle)}</option>`).join('')}</select>
            <button class="btn" type="button" id="pf-newtype" style="margin-top:6px;">+ Nouveau type…</button></div>
          <div class="field"><label>Mise en route (min)</label><input id="pf-mer" type="number" min="0" step="any"></div>
          <div class="field"><label>Réglage (min)</label><input id="pf-reg" type="number" min="0" step="any"></div>
          <div class="field"><label>Cadence portant sur…</label>
            <select id="pf-preset">
              <option value="exemplaires">Des exemplaires (par défaut)</option>
              <option value="cahiers">Des cahiers (couture, pliage)</option>
              <option value="coupes">Des coupes (massicot)</option>
              <option value="autre">Autre unité…</option>
            </select></div>
          <div class="field"><label>Unité de la cadence</label><input id="pf-unite" placeholder="exemplaires"></div>
          <div class="field" style="grid-column: 1 / -1;"><label>Quantité à traiter <span class="plan-note">— formule d'après la fiche ; vide = quantité de l'OF</span></label><input id="pf-formule" class="mono" placeholder="quantite"></div>
          <div class="field"><label id="pf-cad-label">Roulage : cadence moyenne (exemplaires / h)</label><input id="pf-cad" type="number" min="0" step="any"></div>
          <div class="field"><label>Nettoyage (min)</label><input id="pf-net" type="number" min="0" step="any"></div>
          <div class="field"><label>Personnes au roulage</label><input id="pf-pers" type="number" min="1" step="1" value="1"></div>
          <div class="field"><label>Aperçu pour <input id="pf-qte" type="number" min="1" value="1000" style="width:90px; display:inline-block;"> unités à traiter</label><div id="pf-total" class="mono" style="padding:8px 0;">—</div></div>
        </div>
      </div>
      <div id="pf-msg"></div>
      <div class="actions"><button class="btn" id="m-close">Fermer</button><button class="btn primary" id="pf-save">Enregistrer le profil</button></div>
    `, 'large');
    const nv = (id) => { const v = $(id).value; return v === '' ? null : Number(String(v).replace(',', '.')); };
    const PRESETS = {
      exemplaires: { unite: 'exemplaires', formule: '' },
      cahiers: { unite: 'cahiers', formule: 'quantite * nb_cahiers' },
      // Piles de 7 cm maximum : feuilles par pile = 70 mm ÷ épaisseur d'une feuille (≈ 0,00125 mm par g/m²).
      coupes: { unite: 'coupes', formule: 'plafond(nb_feuilles / plancher(70 / (grammage_g * 0.00125); 1); 1) * nb_coupes_pile' },
    };
    function majUnite() {
      const u = $('pf-unite').value.trim() || 'exemplaires';
      $('pf-cad-label').textContent = `Roulage : cadence moyenne (${u} / h)`;
      calcul();
    }
    $('pf-preset').addEventListener('change', () => {
      const pr = PRESETS[$('pf-preset').value];
      if (pr) { $('pf-unite').value = pr.unite === 'exemplaires' ? '' : pr.unite; $('pf-formule').value = pr.formule; }
      majUnite();
    });
    $('pf-unite').addEventListener('input', majUnite);
    function calcul() {
      const q = nv('pf-qte') || 0; const cad = nv('pf-cad');
      const min = (nv('pf-mer') || 0) + (nv('pf-reg') || 0) + (nv('pf-net') || 0) + (cad ? q / cad * 60 : 0);
      const u = $('pf-unite').value.trim() || 'exemplaires';
      $('pf-total').textContent = min ? `${fmtH(min / 60)} au total (${q} ${u} à traiter)` : '—';
    }
    ['pf-mer', 'pf-reg', 'pf-cad', 'pf-net', 'pf-qte'].forEach(id => $(id).addEventListener('input', calcul));
    $('pf-newtype').addEventListener('click', async () => {
      const libelle = prompt('Nom du nouveau type de production (ex. Brochure) :');
      if (!libelle || !libelle.trim()) return;
      try {
        const res = await fetch(`${API}/profils-machine`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ajouter_type', libelle }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        donnees.types.push({ code: d.code, libelle: d.libelle });
        $('pf-type').insertAdjacentHTML('beforeend', `<option value="${esc(d.code)}">${esc(d.libelle)}</option>`);
        $('pf-type').value = d.code;
        referentielsCache = null;
      } catch (e) { $('pf-msg').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    });
    $('m-close').addEventListener('click', fermerModale);
    $('pf-save').addEventListener('click', async () => {
      $('pf-msg').innerHTML = '<div class="msg">Enregistrement…</div>';
      try {
        const res = await fetch(`${API}/profils-machine`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machine_id: machine.id, operation_id: $('pf-op').value, type_production: $('pf-type').value || null,
            mise_en_route_min: nv('pf-mer'), reglage_min: nv('pf-reg'), cadence_par_h: nv('pf-cad'), nettoyage_min: nv('pf-net'), nb_personnes: nv('pf-pers') || 1,
            unite_cadence: $('pf-unite').value.trim() || null, quantite_formule: $('pf-formule').value.trim() || null,
          }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        toast('Profil enregistré.');
        donnees = await charger(); dessiner(); $('pf-msg').innerHTML = '';
      } catch (e) { $('pf-msg').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    });
    dessiner(); calcul();
  }

  // ---------- Temps standards & chiffrage ----------
  function fmtH(h) {
    if (h === null || h === undefined || isNaN(h)) return '—';
    const m = Math.round(h * 60);
    const hh = Math.floor(m / 60), mm = m % 60;
    if (hh === 0) return `${mm} min`;
    return mm === 0 ? `${hh} h` : `${hh} h ${String(mm).padStart(2, '0')}`;
  }
  function decrirePhase(p) {
    if (p.type_calcul === 'fixe') return `Forfait ${fmtH(Number(p.duree_h))}`;
    if (p.type_calcul === 'par_element') return `${fmtH(Number(p.duree_h))} × ${p.element_label || p.element_param}`;
    if (p.type_calcul === 'formule') return `<span class="mono formule-cell" title="${esc(p.formule)}">${esc(tronque(p.formule, 46))}</span>`;
    return `${Number(p.cadence_par_h)} / heure`;
  }
  const etatTS = { phases: [] };   // phases affichées dans « Temps standards » (pour la copie de réglages)

  function renderTempsStandards() {
    const wrap = el(`
      <div>
      <div class="panel">
        <div class="panel-head">
          <h2>Phases de travail standard</h2>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
            <select id="ts-filtre" style="min-width:170px;"><option value="">Toutes les opérations</option></select>
            <button class="btn" id="ts-copie" title="Copier les réglages d'une machine vers d'autres machines">Copier vers…</button>
            <button class="btn" id="ts-export" title="Exporter au format Excel (sert aussi de modèle à remplir)">Exporter Excel</button>
            <button class="btn" id="ts-import" title="Importer un fichier Excel">Importer Excel</button>
            <input type="file" id="ts-import-file" accept=".xlsx" class="hidden">
            <button class="btn primary" id="ts-new">${svgIcon('<path d="M12 5v14M5 12h14"/>')}Nouvelle phase</button>
          </div>
        </div>
        <div style="padding:12px 18px; font-size:12px; color:var(--ink-500); border-bottom:1px solid var(--line);">
          Une phase <strong>sans machine</strong> est le standard de l'opération. Une phase <strong>rattachée à une machine</strong> la remplace pour cette machine. Chaque phase se calcule en <strong>forfait</strong>, <strong>durée × un nombre</strong>, <strong>cadence</strong> ou par <strong>formule</strong> selon les caractéristiques du produit (largeur, nombre de pages, grammage…).
        </div>
        <table>
          <thead><tr><th>Opération</th><th>Machine</th><th>Phase</th><th>Calcul</th><th>Occupe la machine</th><th>Pers.</th><th></th></tr></thead>
          <tbody id="ts-tbody"><tr><td colspan="7" class="empty">Chargement…</td></tr></tbody>
        </table>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Caractéristiques produit <span class="plan-note">— variables utilisables dans les formules</span></h2>
          <button class="btn primary" id="car-new">${svgIcon('<path d="M12 5v14M5 12h14"/>')}Nouvelle caractéristique</button>
        </div>
        <table>
          <thead><tr><th>Clé (dans les formules)</th><th>Libellé</th><th>Type</th><th>Unité</th><th></th></tr></thead>
          <tbody id="car-tbody"><tr><td colspan="5" class="empty">Chargement…</td></tr></tbody>
        </table>
      </div>
      </div>
    `);
    wrap.querySelector('#ts-new').addEventListener('click', () => ouvrirModalePhase(null));
    wrap.querySelector('#ts-copie').addEventListener('click', () => ouvrirModaleCopie());
    wrap.querySelector('#ts-export').addEventListener('click', () => exporterExcel());
    const fichier = wrap.querySelector('#ts-import-file');
    wrap.querySelector('#ts-import').addEventListener('click', () => fichier.click());
    fichier.addEventListener('change', () => { const f = fichier.files[0]; fichier.value = ''; if (f) ouvrirModaleImport(f); });
    wrap.querySelector('#car-new').addEventListener('click', () => ouvrirModaleCaracteristique(null));
    chargerPhases(wrap);
    chargerCaracteristiques(wrap);
    return wrap;
  }

  async function chargerPhases(wrap) {
    const tbody = wrap.querySelector('#ts-tbody');
    const filtre = wrap.querySelector('#ts-filtre');
    try {
      const res = await fetch(`${API}/gerer-temps-standards`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const phases = await res.json();
      etatTS.phases = phases;

      const ops = Array.from(new Map(phases.map(p => [p.operation_id, p.operations.nom])).entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'fr'));
      filtre.innerHTML = `<option value="">Toutes les opérations</option>` + ops.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join('');

      const afficher = () => {
        const sel = filtre.value;
        const lignes = phases.filter(p => !sel || p.operation_id === sel);
        if (lignes.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="empty">${phases.length ? 'Aucune phase pour cette opération.' : 'Aucune phase définie pour l\'instant. Cliquez sur « Nouvelle phase » pour saisir vos premiers temps standards.'}</td></tr>`;
          return;
        }
        tbody.innerHTML = '';
        lignes.forEach(p => {
          tbody.appendChild(el(`
            <tr>
              <td>${p.operations.nom}</td>
              <td>${p.machines ? p.machines.nom : '<span class="chip">Standard</span>'}</td>
              <td><span class="mono" style="color:var(--ink-500); margin-right:6px;">${p.ordre}.</span>${p.nom}</td>
              <td>${decrirePhase(p)}</td>
              <td>${p.occupe_machine ? 'Oui' : '<span style="color:var(--ink-500)">Non</span>'}</td>
              <td>${p.nb_personnes}</td>
              <td style="white-space:nowrap;">
                <button class="btn ts-edit" data-id="${p.id}">Modifier</button>
                <button class="btn btn-icon-danger ts-del" data-id="${p.id}" aria-label="Supprimer">${svgIcon('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>')}</button>
              </td>
            </tr>
          `));
        });
        tbody.querySelectorAll('.ts-edit').forEach(b => b.addEventListener('click', () => ouvrirModalePhase(phases.find(x => x.id === b.dataset.id))));
        tbody.querySelectorAll('.ts-del').forEach(b => b.addEventListener('click', () => {
          const p = phases.find(x => x.id === b.dataset.id);
          afficherModale(`
            <h3>Supprimer cette phase ?</h3>
            <p style="font-size:13px; color:var(--ink-700); margin:0;">« ${p.nom} » — ${p.operations.nom}${p.machines ? ' (' + p.machines.nom + ')' : ' (standard de l\'opération)'}. Les OF déjà chiffrés ne seront recalculés qu'à leur prochain chiffrage.</p>
            <div id="m-msg"></div>
            <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn danger-btn" id="m-confirm-delete">Supprimer</button></div>
          `);
          document.getElementById('m-cancel').addEventListener('click', fermerModale);
          document.getElementById('m-confirm-delete').addEventListener('click', async () => {
            const msg = document.getElementById('m-msg');
            try {
              const r = await fetch(`${API}/gerer-temps-standards?id=${p.id}`, { method: 'DELETE' });
              if (!r.ok) throw new Error((await r.json()).error || 'Erreur inconnue');
              toast('Phase supprimée.');
              fermerModale(); render();
            } catch (e) { msg.innerHTML = `<div class="msg error">${e.message}</div>`; }
          });
        }));
      };
      filtre.addEventListener('change', afficher);
      afficher();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty">Backend indisponible. (${e.message})</td></tr>`;
    }
  }

  async function ouvrirModalePhase(phase) {
    let refs; let catalogue = [];
    try {
      refs = await getReferentiels();
      const rc = await fetch(`${API}/gerer-caracteristiques`);
      if (rc.ok) { const j = await rc.json(); catalogue = Array.isArray(j) ? j : []; }
    } catch (e) { toast(`Backend indisponible : ${e.message}`, 'error'); return; }

    const estEdition = !!phase;
    const opOptions = refs.operations.map(o => `<option value="${o.id}" ${phase && phase.operation_id === o.id ? 'selected' : ''}>${esc(o.nom)}</option>`).join('');
    const machOptions = `<option value="">— Standard de l'opération (toutes machines) —</option>` +
      refs.machines.slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map(m => `<option value="${m.id}" ${phase && phase.machine_id === m.id ? 'selected' : ''}>${esc(m.nom)}</option>`).join('');
    const type = phase ? phase.type_calcul : 'fixe';

    const chipsVariables = [{ cle: 'quantite', libelle: 'Quantité (exemplaires)', unite: null }, ...catalogue]
      .map(v => `<button type="button" class="chip-btn" data-ins="${v.cle}" title="${esc(v.libelle)}${v.unite ? ' (' + esc(v.unite) + ')' : ''}">${v.cle}</button>`).join('');
    const chipsFonctions = [['si(condition; si_vrai; si_faux)', 'si'], ['min(a; b)', 'min'], ['max(a; b)', 'max'], ['arrondi(x; 2)', 'arrondi'], ['plafond(x; 0,25)', 'plafond'], ['plancher(x; 1)', 'plancher']]
      .map(([t, n]) => `<button type="button" class="chip-btn fn" data-ins="${esc(t)}" title="${esc(t)}">${n}( )</button>`).join('');
    const exemples = [['0,5 + 0,002 * largeur_mm', 'forfait + par mm'], ['si(largeur_mm > 300; 1; 0,75)', 'selon une condition'], ['quantite / si(grammage_g > 150; 6000; 9000)', 'cadence variable'], ['max(0,5; quantite / 2000)', 'avec un minimum']]
      .map(([t, n]) => `<button type="button" class="chip-btn ex" data-ex="${esc(t)}" title="${esc(t)}">${n}</button>`).join('');

    afficherModale(`
      <h3>${estEdition ? 'Modifier la phase' : 'Nouvelle phase de travail'}</h3>
      <div class="field"><label>Opération</label><select id="ph-op">${opOptions}</select></div>
      <div class="field"><label>Machine concernée</label><select id="ph-machine">${machOptions}</select></div>
      <div class="field"><label>Nom de la phase</label><input id="ph-nom" value="${esc(phase ? phase.nom : '')}" placeholder="ex: Mise en route, Réglage, Roulage, Nettoyage"></div>
      <div class="field"><label>Ordre dans l'opération</label><input id="ph-ordre" type="number" min="1" value="${phase ? phase.ordre : 1}"></div>
      <div class="field"><label>Mode de calcul</label>
        <select id="ph-type">
          <option value="fixe" ${type === 'fixe' ? 'selected' : ''}>Forfait (durée fixe)</option>
          <option value="par_element" ${type === 'par_element' ? 'selected' : ''}>Durée × un nombre (ex: par fer)</option>
          <option value="cadence" ${type === 'cadence' ? 'selected' : ''}>Cadence (unités par heure)</option>
          <option value="formule" ${type === 'formule' ? 'selected' : ''}>Formule (selon les caractéristiques du produit)</option>
        </select>
      </div>
      <div class="field" id="ph-duree-wrap"><label id="ph-duree-label">Durée (heures)</label><input id="ph-duree" type="number" min="0" step="any" value="${phase && phase.duree_h !== null ? phase.duree_h : ''}" placeholder="ex: 0.5 pour 30 min"></div>
      <div class="field" id="ph-element-wrap"><label>Ce que l'on compte</label><input id="ph-element" value="${esc(phase && phase.element_label ? phase.element_label : '')}" placeholder="ex: Nombre de fers"></div>
      <div class="field" id="ph-cadence-wrap"><label>Cadence (unités par heure)</label><input id="ph-cadence" type="number" min="0" step="any" value="${phase && phase.cadence_par_h !== null ? phase.cadence_par_h : ''}" placeholder="ex: 400"></div>
      <div class="field" id="ph-formule-wrap">
        <label>Formule — le résultat est une durée en <strong>heures</strong></label>
        <textarea id="ph-formule" rows="3" spellcheck="false" placeholder="ex : 0,5 + 0,002 * largeur_mm">${esc(phase && phase.formule ? phase.formule : '')}</textarea>
        <div class="chips"><span class="chips-label">Caractéristiques :</span>${chipsVariables}</div>
        <div class="chips"><span class="chips-label">Fonctions :</span>${chipsFonctions}</div>
        <div class="chips"><span class="chips-label">Exemples :</span>${exemples}</div>
        <details class="aide-formule"><summary>Aide sur les formules</summary>
          <p>Opérateurs <code>+ - * / %</code>, comparaisons <code>== != &lt; &lt;= &gt; &gt;=</code>, logique <code>et ou non</code>. Les arguments se séparent par <code>;</code>. Le texte se met entre guillemets : <code>si(papier == "couché"; 1; 0,5)</code> (casse et accents ignorés).</p>
          <p><code>si(condition; si_vrai; si_faux)</code> · <code>min(…)</code> · <code>max(…)</code> · <code>abs(x)</code> · <code>arrondi(x; décimales)</code> · <code>plafond(x; pas)</code> · <code>plancher(x; pas)</code></p>
          <p>Les caractéristiques (largeur, grammage…) se créent dans le panneau « Caractéristiques produit » ; <code>quantite</code> est le nombre d'exemplaires.</p>
        </details>
        <div class="apercu"><div class="apercu-titre">Aperçu — essayez des valeurs</div><div id="ph-apercu-champs" class="apercu-champs"></div><div id="ph-resultat"></div></div>
      </div>
      <div class="field"><label>Nombre de personnes requises</label><input id="ph-pers" type="number" min="1" value="${phase ? phase.nb_personnes : 1}"></div>
      <div class="field"><label><input type="checkbox" id="ph-occupe" ${!phase || phase.occupe_machine ? 'checked' : ''}> Cette phase occupe la machine</label></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">${estEdition ? 'Enregistrer' : 'Créer'}</button></div>
    `, 'large');

    const $ = (id) => document.getElementById(id);
    const typeSel = $('ph-type');
    const ta = $('ph-formule');
    function majChamps() {
      const t = typeSel.value;
      $('ph-duree-wrap').classList.toggle('hidden', t === 'cadence' || t === 'formule');
      $('ph-element-wrap').classList.toggle('hidden', t !== 'par_element');
      $('ph-cadence-wrap').classList.toggle('hidden', t !== 'cadence');
      $('ph-formule-wrap').classList.toggle('hidden', t !== 'formule');
      $('ph-duree-label').textContent = t === 'par_element' ? 'Durée pour chaque élément (heures)' : 'Durée (heures)';
      if (t === 'formule') planifierApercu();
    }

    // ----- Aperçu en direct de la formule -----
    const valeursApercu = {};
    let clesAffichees = null; let minuterie = null; let compteur = 0;
    function planifierApercu() { clearTimeout(minuterie); minuterie = setTimeout(majApercu, 300); }
    async function majApercu() {
      if (!document.getElementById('ph-formule')) return;
      const f = ta.value.trim();
      const champs = $('ph-apercu-champs'); const resultat = $('ph-resultat');
      if (!f) { champs.innerHTML = ''; clesAffichees = null; resultat.innerHTML = '<div class="apercu-note">Saisissez une formule pour voir le résultat.</div>'; return; }
      const mon = ++compteur;
      let d;
      try {
        const res = await fetch(`${API}/evaluer-formule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formule: f, valeurs: valeursApercu }) });
        d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur');
      } catch (e) { if (mon === compteur) resultat.innerHTML = `<div class="msg error">Aperçu indisponible : ${esc(e.message)}</div>`; return; }
      if (mon !== compteur || !document.getElementById('ph-formule')) return;   // réponse périmée
      const cles = d.variables.map(v => v.cle).join();
      if (cles !== clesAffichees) {
        clesAffichees = cles;
        champs.innerHTML = d.variables.map(v => `
          <label class="apercu-champ">${esc(v.libelle)}${v.unite ? ' (' + esc(v.unite) + ')' : ''}${v.connue ? '' : ' <em>— inconnue</em>'}
            <input data-cle="${v.cle}" type="${v.type === 'texte' ? 'text' : 'text'}" inputmode="${v.type === 'texte' ? 'text' : 'decimal'}" value="${esc(valeursApercu[v.cle] ?? '')}"></label>`).join('');
        champs.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => { valeursApercu[inp.dataset.cle] = inp.value; planifierApercu(); }));
      }
      if (d.erreur) resultat.innerHTML = `<div class="msg error">${esc(d.erreur)}</div>`;
      else if (d.valeur_h === null) resultat.innerHTML = '<div class="apercu-note">Renseignez les valeurs ci-dessus pour voir le résultat.</div>';
      else resultat.innerHTML = `<div class="apercu-res">= <strong>${fmtH(d.valeur_h)}</strong> <span>(${d.valeur_h.toLocaleString('fr-FR')} h)</span></div>`;
    }
    ta.addEventListener('input', planifierApercu);
    document.querySelectorAll('.chip-btn[data-ins]').forEach(b => b.addEventListener('click', () => {
      const t = b.dataset.ins; const d = ta.selectionStart ?? ta.value.length; const f = ta.selectionEnd ?? d;
      ta.value = ta.value.slice(0, d) + t + ta.value.slice(f);
      ta.focus(); ta.selectionStart = ta.selectionEnd = d + t.length; planifierApercu();
    }));
    document.querySelectorAll('.chip-btn[data-ex]').forEach(b => b.addEventListener('click', () => { ta.value = b.dataset.ex; ta.focus(); planifierApercu(); }));

    typeSel.addEventListener('change', majChamps);
    majChamps();

    $('m-cancel').addEventListener('click', fermerModale);
    $('m-submit').addEventListener('click', async () => {
      const msg = $('m-msg');
      const payload = {
        id: phase ? phase.id : undefined,
        operation_id: $('ph-op').value,
        machine_id: $('ph-machine').value || null,
        nom: $('ph-nom').value.trim(),
        ordre: $('ph-ordre').value,
        type_calcul: typeSel.value,
        duree_h: $('ph-duree').value,
        cadence_par_h: $('ph-cadence').value,
        element_label: $('ph-element').value.trim(),
        formule: ta.value.trim(),
        nb_personnes: $('ph-pers').value,
        occupe_machine: $('ph-occupe').checked,
      };
      msg.innerHTML = `<div class="msg">Enregistrement…</div>`;
      try {
        const res = await fetch(`${API}/gerer-temps-standards`, {
          method: estEdition ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        toast(estEdition ? 'Phase mise à jour.' : 'Phase créée.');
        fermerModale(); render();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`;
      }
    });
  }

  // ----- Caractéristiques produit -----
  async function chargerCaracteristiques(wrap) {
    const tbody = wrap.querySelector('#car-tbody');
    try {
      const res = await fetch(`${API}/gerer-caracteristiques`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const liste = await res.json();
      if (liste.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucune caractéristique. Créez-en pour pouvoir les utiliser dans des formules.</td></tr>'; return; }
      tbody.innerHTML = '';
      liste.forEach(c => {
        tbody.appendChild(el(`
          <tr>
            <td class="mono">${esc(c.cle)}</td><td>${esc(c.libelle)}</td>
            <td><span class="chip">${c.type === 'texte' ? 'Texte' : 'Nombre'}</span></td><td>${esc(c.unite || '—')}</td>
            <td style="white-space:nowrap;">
              <button class="btn car-edit" data-cle="${c.cle}">Modifier</button>
              <button class="btn btn-icon-danger car-del" data-cle="${c.cle}" aria-label="Supprimer ${esc(c.libelle)}">${svgIcon('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>')}</button>
            </td>
          </tr>`));
      });
      tbody.querySelectorAll('.car-edit').forEach(b => b.addEventListener('click', () => ouvrirModaleCaracteristique(liste.find(x => x.cle === b.dataset.cle))));
      tbody.querySelectorAll('.car-del').forEach(b => b.addEventListener('click', () => {
        const c = liste.find(x => x.cle === b.dataset.cle);
        afficherModale(`
          <h3>Supprimer « ${esc(c.libelle)} » ?</h3>
          <p style="font-size:13px; color:var(--ink-700); margin:0;">La caractéristique <span class="mono">${esc(c.cle)}</span> sera retirée. Elle ne peut pas être supprimée tant qu'une phase l'utilise.</p>
          <div id="m-msg"></div>
          <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn danger-btn" id="m-confirm-delete">Supprimer</button></div>`);
        document.getElementById('m-cancel').addEventListener('click', fermerModale);
        document.getElementById('m-confirm-delete').addEventListener('click', async () => {
          const msg = document.getElementById('m-msg');
          try {
            const r = await fetch(`${API}/gerer-caracteristiques?cle=${encodeURIComponent(c.cle)}`, { method: 'DELETE' });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Erreur inconnue');
            toast('Caractéristique supprimée.'); fermerModale(); render();
          } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
        });
      }));
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty">Backend indisponible. (${esc(e.message)})</td></tr>`;
    }
  }

  const cleDepuisLibelle = (s) => {
    let k = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[0-9]/.test(k) ? 'c_' + k : k;
  };

  function ouvrirModaleCaracteristique(car) {
    const edition = !!car;
    afficherModale(`
      <h3>${edition ? 'Modifier la caractéristique' : 'Nouvelle caractéristique produit'}</h3>
      <div class="field"><label>Libellé</label><input id="car-libelle" value="${esc(car ? car.libelle : '')}" placeholder="ex : Largeur de couverture"></div>
      <div class="field"><label>Clé — nom utilisé dans les formules</label>
        <input id="car-cle" value="${esc(car ? car.cle : '')}" ${edition ? 'disabled' : ''} placeholder="déduite du libellé (ex : largeur_de_couverture)">
        <small style="color:var(--ink-500); font-size:11px; margin-top:3px;">${edition ? 'La clé ne peut pas être modifiée (des formules peuvent l\'utiliser).' : 'Lettres minuscules, chiffres et « _ ». Laissez vide pour la déduire du libellé.'}</small></div>
      <div class="field"><label>Type</label>
        <select id="car-type"><option value="nombre" ${!car || car.type === 'nombre' ? 'selected' : ''}>Nombre (largeur, pages, grammage…)</option><option value="texte" ${car && car.type === 'texte' ? 'selected' : ''}>Texte (papier, finition…)</option></select></div>
      <div class="field"><label>Unité (facultatif)</label><input id="car-unite" value="${esc(car && car.unite ? car.unite : '')}" placeholder="ex : mm, g, pages"></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">${edition ? 'Enregistrer' : 'Créer'}</button></div>`);
    const lib = document.getElementById('car-libelle'); const cle = document.getElementById('car-cle');
    if (!edition) lib.addEventListener('input', () => { if (!cle.dataset.touche) cle.placeholder = cleDepuisLibelle(lib.value) || 'déduite du libellé'; });
    cle.addEventListener('input', () => { cle.dataset.touche = '1'; });
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-submit').addEventListener('click', async () => {
      const msg = document.getElementById('m-msg');
      const corps = { libelle: lib.value.trim(), type: document.getElementById('car-type').value, unite: document.getElementById('car-unite').value.trim() };
      if (edition) corps.cle = car.cle; else if (cle.value.trim()) corps.cle = cle.value.trim();
      msg.innerHTML = '<div class="msg">Enregistrement…</div>';
      try {
        const res = await fetch(`${API}/gerer-caracteristiques`, { method: edition ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        toast(edition ? 'Caractéristique mise à jour.' : `Caractéristique « ${d.cle} » créée.`); fermerModale(); render();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    });
  }

  // ----- Copier les réglages d'une machine vers d'autres -----
  async function ouvrirModaleCopie() {
    let refs;
    try { refs = await getReferentiels(); } catch (e) { toast(`Backend indisponible : ${e.message}`, 'error'); return; }
    const phases = etatTS.phases;
    if (!phases.length) { toast('Aucune phase à copier : créez d\'abord des phases.', 'error'); return; }
    const ops = Array.from(new Map(phases.map(p => [p.operation_id, p.operations.nom])).entries()).sort((a, b) => a[1].localeCompare(b[1], 'fr'));

    afficherModale(`
      <h3>Copier des réglages vers d'autres machines</h3>
      <p style="font-size:12.5px; color:var(--ink-700); margin:0 0 12px;">Reprend toutes les phases d'une opération pour une machine (ou le standard de l'opération) et les recopie sur les machines choisies, où vous pourrez ensuite les ajuster.</p>
      <div class="field"><label>Opération</label><select id="cp-op">${ops.map(([id, nom]) => `<option value="${id}">${esc(nom)}</option>`).join('')}</select></div>
      <div class="field"><label>Copier les phases de…</label><select id="cp-source"></select></div>
      <div class="field"><label>…vers ces machines</label><div class="op-list" id="cp-cibles"></div></div>
      <div class="field"><label><input type="checkbox" id="cp-remplacer"> Remplacer les phases déjà définies sur les machines de destination</label></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">Copier</button></div>`);
    const $ = (id) => document.getElementById(id);
    const nomMachine = (id) => (refs.machines.find(m => m.id === id) || { nom: '?' }).nom;
    function majSources() {
      const op = $('cp-op').value;
      const ids = Array.from(new Set(phases.filter(p => p.operation_id === op).map(p => p.machine_id || '')));
      $('cp-source').innerHTML = ids.sort().map(id => `<option value="${id}">${id === '' ? 'Standard de l\'opération' : esc(nomMachine(id))}</option>`).join('');
      majCibles();
    }
    function majCibles() {
      const op = $('cp-op').value; const src = $('cp-source').value;
      $('cp-cibles').innerHTML = refs.machines.filter(m => m.id !== src).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(m => {
        const deja = phases.some(p => p.operation_id === op && p.machine_id === m.id);
        return `<label><input type="checkbox" class="cp-cible" value="${m.id}"> ${esc(m.nom)}${deja ? ' <em style="color:var(--ink-500)">— a déjà des phases</em>' : ''}</label>`;
      }).join('');
    }
    $('cp-op').addEventListener('change', majSources);
    $('cp-source').addEventListener('change', majCibles);
    majSources();
    $('m-cancel').addEventListener('click', fermerModale);
    $('m-submit').addEventListener('click', async () => {
      const msg = $('m-msg');
      const cibles = Array.from(document.querySelectorAll('.cp-cible:checked')).map(i => i.value);
      if (!cibles.length) { msg.innerHTML = '<div class="msg error">Choisissez au moins une machine de destination.</div>'; return; }
      msg.innerHTML = '<div class="msg">Copie en cours…</div>';
      try {
        const res = await fetch(`${API}/gerer-temps-standards`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'copier', operation_id: $('cp-op').value, source_machine_id: $('cp-source').value || null, cibles, remplacer: $('cp-remplacer').checked }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        const ign = d.ignorees.length ? ` ${d.ignorees.length} ignorée(s) (déjà des phases : ${d.ignorees.map(x => esc(nomMachine(x.machine_id))).join(', ')}).` : '';
        toast(`Phases copiées vers ${d.copiees.length} machine(s).${ign}`, d.copiees.length ? 'ok' : 'error');
        fermerModale(); render();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    });
  }

  // ----- Export / import Excel -----
  async function exporterExcel() {
    try {
      const res = await fetch(`${API}/exporter-temps-standards`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
      const bin = atob(d.fichier_base64); const octets = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
      const blob = new Blob([octets], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = d.nom;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast(`Fichier « ${d.nom} » téléchargé.`);
    } catch (e) { toast(`Export impossible : ${e.message}`, 'error'); }
  }

  async function ouvrirModaleImport(fichier) {
    afficherModale(`<h3>Import Excel — ${esc(fichier.name)}</h3><div class="empty">Analyse du fichier…</div>`, 'large');
    let base64;
    const appeler = async (options) => {
      const res = await fetch(`${API}/importer-temps-standards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fichier_base64: base64, ...options }) });
      return { ok: res.ok, status: res.status, data: await res.json() };
    };
    try {
      base64 = await fichierEnBase64(fichier);
      const { ok: ok_, data } = await appeler({ appliquer: false });
      if (!ok_) throw new Error(data.error || 'Erreur inconnue');
      const r = data.resume;
      const lignes = [...data.caracteristiques.map(x => ({ ...x, feuille: 'Caractéristiques' })), ...data.phases.map(x => ({ ...x, feuille: 'Phases' }))];
      const enErreur = lignes.filter(x => x.statut === 'erreur');
      const STATUT = { creation: ['ok', 'À créer'], mise_a_jour: ['warn', 'À mettre à jour'], inchangee: ['', 'Inchangée'], erreur: ['danger', 'Erreur'] };
      const aImporter = r.creations + r.mises_a_jour;
      afficherModale(`
        <h3>Import Excel — ${esc(fichier.name)}</h3>
        <div class="plan-resume">
          <div><span class="plan-k">À créer</span><strong>${r.creations}</strong></div>
          <div><span class="plan-k">À mettre à jour</span><strong>${r.mises_a_jour}</strong></div>
          <div><span class="plan-k">Inchangées</span><strong>${r.inchangees}</strong></div>
          <div><span class="plan-k">En erreur</span><strong style="color:${r.erreurs ? 'var(--danger-text)' : 'inherit'}">${r.erreurs}</strong></div>
        </div>
        ${enErreur.length ? `<div class="plan-bloquants"><strong>À corriger dans le fichier :</strong><ul>${enErreur.slice(0, 40).map(x => `<li>${esc(x.feuille)}, ligne ${x.ligne} — ${esc(x.resume)} : ${esc(x.erreur)}</li>`).join('')}</ul>${enErreur.length > 40 ? `<div>… et ${enErreur.length - 40} autre(s).</div>` : ''}</div>` : ''}
        <div class="import-lignes"><table>
          <thead><tr><th>Feuille</th><th>Ligne</th><th>Contenu</th><th>Statut</th></tr></thead>
          <tbody>${lignes.filter(x => x.statut !== 'erreur').slice(0, 60).map(x => `<tr><td>${esc(x.feuille)}</td><td class="mono">${x.ligne}</td><td>${esc(x.resume)}</td><td><span class="tag ${STATUT[x.statut][0]}" ${x.statut === 'inchangee' ? 'style="background:var(--paper-raised-2); color:var(--ink-700);"' : ''}>${STATUT[x.statut][1]}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucune ligne valide.</td></tr>'}</tbody>
        </table></div>
        ${data.phases_tronquees ? '<div class="plan-note" style="margin-top:6px;">Aperçu limité aux 400 premières phases ; le bilan ci-dessus porte sur tout le fichier.</div>' : ''}
        <div class="plan-note" style="margin-top:8px;">Rien n'est supprimé : les phases absentes du fichier restent en place.</div>
        <div id="m-msg"></div>
        <div class="actions">
          <button class="btn" id="m-cancel">Annuler</button>
          ${r.erreurs > 0 && aImporter > 0 ? `<button class="btn" id="imp-valides">Importer seulement les lignes valides (${aImporter})</button>` : ''}
          <button class="btn primary" id="imp-appliquer" ${r.erreurs > 0 || aImporter === 0 ? 'disabled' : ''}>Appliquer l'import</button>
        </div>`, 'large');
      document.getElementById('m-cancel').addEventListener('click', fermerModale);
      const lancer = (options) => async () => {
        const msg = document.getElementById('m-msg');
        msg.innerHTML = '<div class="msg">Import en cours…</div>';
        document.querySelectorAll('.actions .btn').forEach(b => { b.disabled = true; });
        try {
          const rep = await appeler({ appliquer: true, ...options });
          if (!rep.ok) throw new Error(rep.data.error || 'Erreur inconnue');
          toast(`Import terminé : ${rep.data.resume.creations} créée(s), ${rep.data.resume.mises_a_jour} mise(s) à jour.`);
          fermerModale(); render();
        } catch (e) {
          msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`;
          document.querySelectorAll('.actions .btn').forEach(b => { b.disabled = false; });
        }
      };
      document.getElementById('imp-appliquer').addEventListener('click', lancer({}));
      const bv = document.getElementById('imp-valides'); if (bv) bv.addEventListener('click', lancer({ ignorer_erreurs: true }));
    } catch (e) {
      afficherModale(`<h3>Import Excel</h3><div class="msg error">${esc(e.message)}</div><div class="actions"><button class="btn" id="m-cancel">Fermer</button></div>`);
      document.getElementById('m-cancel').addEventListener('click', fermerModale);
    }
  }

  // ---------- Planification à l'heure ----------
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function maintenantLocal() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtDateHeure(isoLocal) {
    if (!isoLocal) return '—';
    const d = new Date(isoLocal);
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' ' + isoLocal.slice(11, 16);
  }
  const minHeure = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
  const tronque = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

  // Réseau PERT : une boîte par étape, rangées par niveau de dépendance ; chemin critique en rouge.
  function reseauPert(plan) {
    if (!plan.pert || !plan.pert.etapes || plan.pert.etapes.length === 0) return '';
    // Les numéros de saisie n'ont aucun sens chronologique : l'ordre d'affichage vient du calcul (début au plus tôt).
    const noeuds = plan.pert.etapes.slice().sort((a, b) => a.es - b.es || a.ef - b.ef);
    const parSeq = new Map(noeuds.map(n => [n.sequence, n]));
    const niveau = new Map();
    const niveauDe = (sq, pile = new Set()) => {
      if (niveau.has(sq)) return niveau.get(sq);
      if (pile.has(sq)) return 0;
      pile.add(sq);
      const n = parSeq.get(sq);
      const v = n && n.predecesseurs.length ? 1 + Math.max(...n.predecesseurs.map(p => niveauDe(p, pile))) : 0;
      niveau.set(sq, v);
      return v;
    };
    noeuds.forEach(n => niveauDe(n.sequence));
    const parNiveau = {};
    noeuds.forEach(n => { (parNiveau[niveau.get(n.sequence)] ??= []).push(n); });
    const NW = 170, NH = 58, GX = 46, GY = 14;
    const nbNiv = Object.keys(parNiveau).length;
    const maxLignes = Math.max(...Object.values(parNiveau).map(a => a.length));
    const W = nbNiv * NW + (nbNiv - 1) * GX + 20;
    const H = maxLignes * NH + (maxLignes - 1) * GY + 20;
    const pos = new Map();
    Object.entries(parNiveau).forEach(([niv, arr]) => arr.forEach((n, i) => pos.set(n.sequence, { x: 10 + Number(niv) * (NW + GX), y: 10 + i * (NH + GY) })));

    const aretes = noeuds.flatMap(n => n.predecesseurs.map(p => {
      const a = pos.get(p); const b = pos.get(n.sequence);
      const pn = noeuds.find(x => x.sequence === p);
      if (!a || !b || !pn) return '';
      const dep = (n.dependances || []).find(d => d.sequence === p);
      const prog = !!dep && dep.mode === 'progressif';
      const decalage = prog ? Math.round(pn.duree_min * (dep.seuil_pct ?? 10) / 100) : 0;
      const crit = pn.critique && n.critique && (prog ? (n.es === pn.es + decalage || n.ef === pn.ef) : pn.ef === n.es);
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
      const trait = `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" class="pert-edge ${crit ? 'crit' : ''} ${prog ? 'prog' : ''}"><title>${prog ? `Démarrage progressif : dès ${dep.seuil_pct} % de « ${pn.operation} »` : `Après la fin de « ${pn.operation} »`}</title></path>`;
      const etiquette = prog ? `<text x="${mx}" y="${(y1 + y2) / 2 - 5}" text-anchor="middle" class="pert-lien">dès ${dep.seuil_pct} %</text>` : '';
      return trait + etiquette;
    })).join('');
    const boites = noeuds.map(n => {
      const p = pos.get(n.sequence);
      const detail = n.fixe ? 'déjà planifiée' : n.critique ? `${fmtH(n.duree_min / 60)} · critique` : `${fmtH(n.duree_min / 60)} · marge ${fmtH(n.marge_min / 60)}`;
      return `<g class="pert-node ${n.critique ? 'crit' : ''} ${n.fixe ? 'fixe' : ''}" transform="translate(${p.x},${p.y})"><title>${esc(n.operation)} — ${detail}</title><rect width="${NW}" height="${NH}" rx="9"/><text x="10" y="23" class="t1">${esc(tronque(n.operation, 24))}</text><text x="10" y="42" class="t2">${detail}</text></g>`;
    }).join('');

    const critiques = noeuds.filter(n => n.critique).map(n => n.operation);
    const enChaine = noeuds.every((n, i) => n.predecesseurs.length === (i === 0 ? 0 : 1) && (i === 0 || n.predecesseurs[0] === noeuds[i - 1].sequence));
    return `
      <details class="pert" ${enChaine ? '' : 'open'}>
        <summary>Réseau PERT — durée minimale <strong>${fmtH(plan.pert.duree_totale_min / 60)}</strong>${critiques.length ? ' · chemin critique : ' + critiques.join(' → ') : ''}</summary>
        <div class="pert-wrap"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${aretes}${boites}</svg></div>
        <div class="pert-note">${enChaine ? 'Toutes les étapes se suivent : elles sont toutes critiques. Indiquez des dépendances dans « Chiffrage des temps » (« Démarre après ») pour en faire avancer certaines en parallèle. ' : ''}Un lien en pointillé est un démarrage progressif (l'étape démarre avant la fin de la précédente). Le chemin critique est la suite d'étapes qui fixe la durée minimale ; une étape avec marge peut glisser sans retarder l'OF. Cette durée ignore le personnel et les machines : le planning réel peut être plus long.</div>
      </details>`;
  }

  // Gantt horaire : un jour par colonne, les heures en abscisse, une ligne par phase.
  function ganttHoraire(plan) {
    const lignes = [];
    plan.etapes.filter(e => !e.fixe).slice().sort((a, b) => (a.debut || '9').localeCompare(b.debut || '9')).forEach(e => e.phases.forEach(ph => lignes.push({ e, ph })));
    const critiques = new Set((plan.pert ? plan.pert.etapes : []).filter(x => x.critique).map(x => x.gamme_id));
    const dates = Array.from(new Set(lignes.flatMap(l => l.ph.tranches.map(t => t.date)))).sort();
    if (dates.length === 0) return '<div class="empty">Aucune phase à afficher.</div>';

    const cal = plan.calendrier;
    const axeDebut = Math.min(420, minHeure(cal.debut));
    const axeFin = Math.max(1050, minHeure(cal.fin));
    const W = 132;                       // largeur d'un jour (px)
    const k = W / (axeFin - axeDebut);   // px par minute
    const LABEL = 210;
    const pauseG = (minHeure(cal.pause_debut) - axeDebut) * k;
    const pauseW = Number(cal.pause_minutes) * k;

    const entete = dates.map(dt => {
      const d = new Date(dt + 'T00:00:00');
      return `<div class="gh-day" style="width:${W}px">${d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</div>`;
    }).join('');
    const grille = dates.map((_, i) => `<div class="gh-col" style="left:${i * W}px; width:${W}px"><i class="gh-pause" style="left:${pauseG}px; width:${pauseW}px"></i></div>`).join('');

    const rangees = lignes.map(({ e, ph }) => {
      const barres = ph.tranches.map(t => {
        const i = dates.indexOf(t.date);
        const g = i * W + (minHeure(t.debut) - axeDebut) * k;
        const l = Math.max(3, (minHeure(t.fin) - minHeure(t.debut)) * k);
        const qui = ph.personnes.map(p => p.nom).join(', ') || 'personnel à affecter';
        return `<div class="gh-bar ${ph.besoin_machine ? 'machine' : 'main'}" style="left:${g}px; width:${l}px" title="${esc(ph.nom)} — ${t.debut}–${t.fin} — ${esc(qui)}">${l > 52 ? `${t.debut}–${t.fin}` : ''}</div>`;
      }).join('');
      return `<div class="gh-row"><div class="gh-label" title="${esc(e.operation + ' — ' + ph.nom)}${critiques.has(e.gamme_id) ? ' (chemin critique)' : ''}">${critiques.has(e.gamme_id) ? '<span class="crit-dot">●</span> ' : ''}${esc(e.operation)} <em>${esc(ph.nom)}</em></div><div class="gh-track" style="width:${dates.length * W}px">${barres}</div></div>`;
    }).join('');

    return `
      <div class="gh-wrap">
        <div class="gh" style="min-width:${LABEL + dates.length * W}px; --label:${LABEL}px">
          <div class="gh-head"><div class="gh-label"></div>${entete}</div>
          <div class="gh-body">
            <div class="gh-grid" style="left:${LABEL}px; width:${dates.length * W}px">${grille}</div>
            ${rangees}
          </div>
        </div>
      </div>
      <div class="gh-legend"><span><i class="machine"></i>Phase sur machine</span><span><i class="main"></i>Phase manuelle (sans machine)</span><span><i class="pause"></i>Pause</span><span><span class="crit-dot">●</span> Étape du chemin critique</span></div>`;
  }

  async function ouvrirModalePlanification(ofUuid, ofNumero, etat) {
    // Date de livraison de la fiche de fabrication : reprise automatiquement comme « fin au plus tard ».
    const ofCourant = (state.ordres || []).find(o => o.uuid === ofUuid);
    const livraison = ofCourant && ofCourant.delai && /^\d{4}-\d{2}-\d{2}/.test(String(ofCourant.delai)) ? String(ofCourant.delai).slice(0, 10) : null;
    etat = etat || { mode: 'avant', debut: maintenantLocal(), fin: livraison ? `${livraison}T16:30` : '', horaires: 'normal', replanifier: false, imposes: {} };
    let refs;
    try { refs = await getReferentiels(); }
    catch (e) { toast(`Backend indisponible : ${e.message}`, 'error'); return; }

    afficherModale(`
      <h3>Planifier ${esc(ofNumero)} à l'heure</h3>
      <div class="plan-controls">
        <div class="field"><label>Mode</label>
          <select id="pl-mode">
            <option value="avant" ${etat.mode === 'avant' ? 'selected' : ''}>Démarrer à partir de…</option>
            <option value="arriere" ${etat.mode === 'arriere' ? 'selected' : ''}>Terminer au plus tard le…</option>
          </select></div>
        <div class="field" id="pl-debut-wrap"><label>Début souhaité</label><input id="pl-debut" type="datetime-local" value="${etat.debut}"></div>
        <div class="field" id="pl-fin-wrap"><label>Fin au plus tard <span style="font-weight:400">${livraison ? `(livraison de la fiche : ${livraison.slice(8)}/${livraison.slice(5, 7)}/${livraison.slice(0, 4)})` : "(vide = délai de l'OF)"}</span></label><input id="pl-fin" type="datetime-local" value="${etat.fin}"></div>
        <div class="field"><label>Horaires</label>
          <select id="pl-horaires">
            <option value="normal" ${etat.horaires === 'normal' ? 'selected' : ''}>Normaux</option>
            <option value="heures_sup" ${etat.horaires === 'heures_sup' ? 'selected' : ''}>Avec heures supplémentaires</option>
          </select></div>
        <div class="field plan-check"><label><input type="checkbox" id="pl-replan" ${etat.replanifier ? 'checked' : ''}> Replanifier aussi les étapes déjà planifiées</label></div>
        <div class="field plan-go"><button class="btn primary" id="pl-calc">Calculer</button></div>
      </div>
      <div id="pl-resultat"><div class="empty">Calcul en cours…</div></div>
      <div id="m-msg"></div>
      <div class="actions">
        <button class="btn" id="m-cancel">Fermer</button>
        <button class="btn primary" id="pl-appliquer" disabled>Appliquer au planning</button>
      </div>
    `, 'xlarge');

    const $ = (id) => document.getElementById(id);
    function majChamps() {
      $('pl-debut-wrap').classList.toggle('hidden', $('pl-mode').value !== 'avant');
      $('pl-fin-wrap').classList.toggle('hidden', $('pl-mode').value !== 'arriere');
    }
    $('pl-mode').addEventListener('change', majChamps);
    majChamps();
    $('m-cancel').addEventListener('click', fermerModale);

    const corps = (appliquer) => {
      const mode = $('pl-mode').value;
      return {
        of_id: ofUuid, mode, appliquer,
        debut_souhaite: mode === 'avant' ? $('pl-debut').value : undefined,
        fin_au_plus_tard: mode === 'arriere' && $('pl-fin').value ? $('pl-fin').value : undefined,
        maintenant: maintenantLocal(),
        horaires: $('pl-horaires').value,
        replanifier: $('pl-replan').checked,
        etapes_imposees: Object.entries(etat.imposes).map(([gamme_id, v]) => ({ gamme_id, ...v })),
      };
    };

    let dernierPlan = null;
    async function calculer() {
      const zone = $('pl-resultat');
      zone.innerHTML = '<div class="empty">Calcul en cours…</div>';
      $('pl-appliquer').disabled = true;
      $('m-msg').innerHTML = '';
      try {
        const res = await fetch(`${API}/planifier-of`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps(false)) });
        const plan = await res.json();
        if (!res.ok) throw new Error(plan.error || 'Erreur inconnue');
        dernierPlan = plan;
        afficherPlan(plan);
      } catch (e) {
        zone.innerHTML = `<div class="msg error">${esc(e.message)}</div>`;
      }
    }

    function afficherPlan(plan) {
      const r = plan.resume;
      let delaiHtml = '';
      if (r.delai) {
        if (r.respecte_delai) {
          delaiHtml = `<span class="tag ok">Délai respecté</span> <span class="plan-note">(${fmtDateHeure(r.delai)}${r.marge_min ? ', marge ' + fmtH(r.marge_min / 60) : ''})</span>`;
        } else if (r.respecte_delai === false) {
          const jours = Math.round(r.retard_min / 1440);
          delaiHtml = `<span class="tag danger">Délai dépassé</span> <span class="plan-note">(${fmtDateHeure(r.delai)} — ${jours >= 1 ? '≈ ' + jours + ' jour(s) de retard' : 'moins d\'une journée de retard'})</span>`;
        }
      }
      const alt = plan.alternative_heures_sup
        ? `<div class="plan-alt">Avec heures supplémentaires : fin ${fmtDateHeure(plan.alternative_heures_sup.fin)} — ${plan.alternative_heures_sup.respecte_delai ? '<strong>le délai serait tenu</strong>' : 'le délai ne serait pas tenu non plus'}.</div>` : '';
      const bloquants = plan.bloquants.length
        ? `<div class="plan-bloquants"><strong>À corriger avant d'appliquer :</strong><ul>${plan.bloquants.map(b => `<li><strong>${esc(b.operation)}</strong> : ${esc(b.detail)}</li>`).join('')}</ul></div>` : '';

      const nomDeSeq = (sq) => { const x = plan.etapes.find(y => y.sequence === sq); return x ? esc(x.operation) : '?'; };
      const etapesHtml = plan.etapes.slice().sort((a, b) => (a.debut || '9').localeCompare(b.debut || '9')).map(e => {
        if (e.fixe) return `<div class="plan-step fixe"><strong>${esc(e.operation)}</strong> <span class="plan-note">— déjà planifiée (cochez « Replanifier » pour la reprendre)</span></div>`;
        // Personnes « de départ » : les remplaçants arrivés en relais ne sont pas imposés (ils sont déduits).
        const choisis = Array.from(new Map(e.phases.flatMap(ph => {
          if (!ph.relais) return ph.personnes;
          const premier = ph.relais.map(r => r.debut).sort()[0];
          const departs = new Set(ph.relais.filter(r => r.debut === premier).map(r => r.id));
          return ph.personnes.filter(p => departs.has(p.id));
        }).map(p => [p.id, p])).keys());
        const imp = etat.imposes[e.gamme_id] || {};
        const selectedPersons = imp.personnel_ids || choisis;
        const machOpts = `<option value="">— Automatique —</option>` + e.machines_possibles.map(m => `<option value="${m.id}" ${(imp.machine_id || '') === m.id ? 'selected' : ''}>${esc(m.nom)}</option>`).join('');
        const heuresImp = imp.personnel_heures || {};
        const persHtml = refs.personnel.map(p => {
          const coche = selectedPersons.includes(p.id);
          return `<div class="pl-pers-row"><label><input type="checkbox" class="pl-pers" value="${p.id}" ${coche ? 'checked' : ''}> ${esc(p.nom)}</label>
            <span class="pl-heures-wrap ${coche ? '' : 'hidden'}"><input class="pl-heures" data-id="${p.id}" type="number" min="0" step="0.25" placeholder="toute la tâche" value="${heuresImp[p.id] ?? ''}" title="Heures de présence sur cette tâche (vide = toute la tâche)"> h</span></div>`;
        }).join('');
        const phasesHtml = e.phases.map(ph => `
          <li><span>${esc(ph.nom)}</span>
              <span class="mono">${ph.tranches.map(t => `${t.date.slice(8)}/${t.date.slice(5, 7)} ${t.debut}–${t.fin}`).join(' · ')}</span>
              <small>${ph.besoin_machine ? 'machine' : 'manuel'} — ${ph.relais
                ? ph.relais.slice().sort((a, b) => a.debut.localeCompare(b.debut)).map(r => r.toute_la_tache ? esc(r.nom) : `${esc(r.nom)} (${fmtH(r.minutes / 60)} ${r.debut === ph.relais.map(x => x.debut).sort()[0] ? 'au début' : 'en relais'})`).join(' → ')
                : (ph.personnes.length ? esc(ph.personnes.map(p => p.nom).join(', ')) : '<em>personnel à affecter</em>')}</small></li>`).join('');
        const alertes = e.problemes.map(p => `<div class="msg ${p.bloquant ? 'error' : ''}" style="margin:4px 0 0; ${p.bloquant ? '' : 'color:var(--accent-amber-text);'}">${p.bloquant ? '⛔' : '⚠️'} ${esc(p.detail)}</div>`).join('');
        return `
          <div class="plan-step" data-gamme="${e.gamme_id}">
            <div class="step-head"><strong>${esc(e.operation)}</strong>
              <span class="plan-note">${e.predecesseurs && e.predecesseurs.length ? 'après : ' + (e.dependances && e.dependances.length ? e.dependances.map(d => (nomDeSeq(d.sequence)) + (d.mode === 'progressif' ? ` (dès ${d.seuil_pct} %)` : '')).join(', ') : e.predecesseurs.map(nomDeSeq).join(', ')) : 'dès le début'} · ${e.debut ? fmtDateHeure(e.debut) + ' → ' + fmtDateHeure(e.fin) : 'non planifiable'}</span></div>
            <div class="step-grid">
              <div class="field"><label>Machine${e.machine ? ' retenue : ' + esc(e.machine.nom) : ''}</label><select class="pl-machine">${machOpts}</select></div>
              <div class="field"><label>Personnel (imposer)</label>
                <details class="pl-details"><summary>${selectedPersons.length ? selectedPersons.length + ' personne(s)' : 'Automatique'}</summary><div class="op-list">${persHtml}</div></details></div>
            </div>
            <ul class="phase-list">${phasesHtml}</ul>${alertes}
          </div>`;
      }).join('');

      $('pl-resultat').innerHTML = `
        <div class="plan-resume">
          <div><span class="plan-k">Début</span><strong>${fmtDateHeure(r.debut)}</strong></div>
          <div><span class="plan-k">Fin</span><strong>${fmtDateHeure(r.fin)}</strong></div>
          <div>${delaiHtml}</div>
        </div>
        ${plan.jours_feries && plan.jours_feries.length ? `<div class="plan-ferie">Jours fériés non travaillés : ${plan.jours_feries.map(j => `${new Date(j.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })} (${esc(j.libelle)})`).join(', ')}.</div>` : ''}
        ${alt}${bloquants}
        ${ganttHoraire(plan)}
        ${reseauPert(plan)}
        <div class="plan-hint">Pour imposer une machine ou du personnel, modifiez-les ci-dessous puis cliquez sur « Calculer ». Pour une personne présente seulement une partie de la tâche, indiquez ses heures : un remplaçant compétent prend automatiquement le relais.</div>
        ${etapesHtml}`;

      // Mémoriser les choix manuels de machine / personnel
      document.querySelectorAll('.plan-step[data-gamme]').forEach(bloc => {
        const g = bloc.dataset.gamme;
        bloc.querySelector('.pl-machine').addEventListener('change', (ev) => {
          etat.imposes[g] = { ...(etat.imposes[g] || {}), machine_id: ev.target.value || undefined };
        });
        const majHeures = () => {
          const h = {};
          bloc.querySelectorAll('.pl-heures').forEach(i => {
            const ligne = i.closest('.pl-pers-row');
            if (i.value !== '' && Number(i.value) > 0 && ligne.querySelector('.pl-pers').checked) h[i.dataset.id] = Number(i.value);
          });
          const ids = Array.from(bloc.querySelectorAll('.pl-pers:checked')).map(x => x.value);
          etat.imposes[g] = { ...(etat.imposes[g] || {}), personnel_ids: ids.length ? ids : undefined, personnel_heures: Object.keys(h).length ? h : undefined };
        };
        bloc.querySelectorAll('.pl-heures').forEach(i => i.addEventListener('change', majHeures));
        bloc.querySelectorAll('.pl-pers').forEach(cb => cb.addEventListener('change', () => {
          cb.closest('.pl-pers-row').querySelector('.pl-heures-wrap').classList.toggle('hidden', !cb.checked);
          const ids = Array.from(bloc.querySelectorAll('.pl-pers:checked')).map(x => x.value);
          etat.imposes[g] = { ...(etat.imposes[g] || {}), personnel_ids: ids.length ? ids : undefined };
          majHeures();
          bloc.querySelector('summary').textContent = ids.length ? `${ids.length} personne(s)` : 'Automatique';
        }));
      });
      const rienAPlanifier = plan.etapes.length > 0 && plan.etapes.every(e => e.fixe);
      $('pl-appliquer').disabled = !(plan.bloquants.length === 0 && r.complet) || rienAPlanifier;
      $('m-msg').innerHTML = '';
      if (rienAPlanifier) {
        // Message bien visible en haut du résultat (et non en bas de la fenêtre) + action directe.
        $('pl-resultat').insertAdjacentHTML('afterbegin', `
          <div class="msg" style="margin:0 0 12px;"><strong>Rien à calculer :</strong> toutes les étapes de cet OF sont déjà planifiées, donc le calcul ne change rien.
            <div class="note-actions"><button class="btn primary" id="pl-tout-replan">Tout replanifier maintenant</button></div>
            <div class="plan-note" style="margin-top:6px;">Cette action recalcule le planning de toutes les étapes à partir du début souhaité (les étapes déjà démarrées ou terminées sont conservées). Vous pouvez aussi cocher « Replanifier aussi les étapes déjà planifiées » puis recalculer.</div></div>`);
        $('pl-tout-replan').addEventListener('click', () => { $('pl-replan').checked = true; calculer(); });
      }
    }

    $('pl-calc').addEventListener('click', calculer);
    $('pl-appliquer').addEventListener('click', async () => {
      const msg = $('m-msg');
      msg.innerHTML = '<div class="msg">Application au planning…</div>';
      $('pl-appliquer').disabled = true;
      try {
        const res = await fetch(`${API}/planifier-of`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps(true)) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        toast(`${ofNumero} planifié : ${data.lignes_creees} ligne(s) de planning créée(s).`);
        fermerModale(); chargerDonneesReelles();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`;
        $('pl-appliquer').disabled = false;
      }
    });

    calculer();
  }

  // Chiffrage d'un OF : durée de chaque étape + total
  async function ouvrirModaleChiffrage(ofUuid, ofNumero, donnees) {
    let data = donnees;
    if (!data) {
      afficherModale(`<h3>Chiffrage — ${ofNumero}</h3><div class="empty">Calcul en cours…</div>`, 'large');
      try {
        const res = await fetch(`${API}/calculer-durees?of_id=${ofUuid}`);
        data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
      } catch (e) {
        afficherModale(`<h3>Chiffrage — ${ofNumero}</h3><div class="msg error">${e.message}</div>`, 'large');
        return;
      }
    }

    const SOURCES = {
      machine: 'Temps spécifiques à la machine',
      operation: 'Temps standard de l\'opération',
      aucune: 'Aucun temps standard défini pour cette opération — renseignez-le dans « Temps standards », ou saisissez une durée manuelle.',
    };

    let catalogueOps = [];
    try { catalogueOps = (await getReferentiels()).operations || []; } catch (_) { /* liste vide : l'ajout est alors indisponible */ }
    // Libellés : nom de l'opération ; si le même nom existe plusieurs fois dans l'OF, on ajoute « (1ʳᵉ) », « (2ᵉ)… ».
    const libelles = new Map();
    data.etapes.forEach(x => {
      const memes = data.etapes.filter(y => y.operation === x.operation);
      libelles.set(x.sequence, memes.length > 1 ? `${x.operation} (${memes.indexOf(x) + 1}/${memes.length})` : x.operation);
    });
    const etapesHtml = data.etapes.map(e => {
      const verrou = e.statut !== 'à planifier';
      const machOptions = `<option value="">— Standard de l'opération —</option>` + e.machines_compatibles
        .map(m => `<option value="${m.id}" ${m.id === e.machine_id ? 'selected' : ''}>${m.nom}${m.temps_specifiques ? ' ✓' : ''}</option>`).join('');
      const valeurProduit = (cle) => { const v = (data.of.caracteristiques || {})[cle]; return v === undefined || v === null ? '' : v; };
      const paramsHtml = e.parametres_requis.filter(p => p.cle !== 'quantite').map(p => `
        <div class="field"><label>${esc(p.libelle)}${p.unite ? ' (' + esc(p.unite) + ')' : ''} <span class="plan-note">— vide = valeur du produit</span></label>
          <input class="s-param" data-cle="${p.cle}" type="${p.type === 'texte' ? 'text' : 'number'}" ${p.type === 'texte' ? '' : 'min="0" step="any"'} placeholder="${esc(valeurProduit(p.cle))}" value="${esc(e.parametres[p.cle] ?? '')}"></div>`).join('');
      const phasesHtml = e.phases.length ? `<ul class="phase-list">${e.phases.map(p => `
        <li><span>${esc(p.nom)}${p.occupe_machine ? '' : ' <em>(sans machine)</em>'}</span><span class="mono">${fmtH(p.duree_h)}</span><small>${esc(p.detail)}</small></li>`).join('')}</ul>` : '';
      // TOUTES les autres opérations de l'OF peuvent être cochées : le numéro de saisie n'est pas un ordre d'exécution.
      const autres = data.etapes.filter(x => x.sequence !== e.sequence);
      const avant = data.etapes.filter(x => x.sequence < e.sequence);
      const actuels = e.predecesseurs ?? (avant.length ? [avant[avant.length - 1].sequence] : []);
      const lignesPred = autres.map(x => {
        const opt = (e.dependances || {})[x.sequence];
        const coche = actuels.includes(x.sequence);
        const mode = opt && opt.mode === 'progressif' ? 'progressif' : 'fin';
        const pct = opt && opt.seuil_pct !== undefined && opt.seuil_pct !== null ? opt.seuil_pct : 10;
        return `<div class="pred-row">
          <label class="pred-name"><input type="checkbox" class="s-pred-check" data-seq="${x.sequence}" ${coche ? 'checked' : ''}> ${esc(libelles.get(x.sequence))}</label>
          <select class="s-pred-mode ${coche ? '' : 'hidden'}" data-seq="${x.sequence}">
            <option value="fin" ${mode === 'fin' ? 'selected' : ''}>Attendre la fin</option>
            <option value="progressif" ${mode === 'progressif' ? 'selected' : ''}>Démarrage progressif</option>
          </select>
          <span class="pred-pct ${coche && mode === 'progressif' ? '' : 'hidden'}">dès <input class="s-pred-pct" type="number" min="0" max="100" step="1" value="${pct}"> % avancé</span>
        </div>`;
      }).join('');
      const predHtml = autres.length ? `
        <div class="field pred-field"><label>Démarre après… <span class="plan-note">(cochez une ou plusieurs opérations ; aucune case cochée = peut démarrer dès le début)</span></label>
          <div class="pred-list">${lignesPred}</div>
          <small>Les opérations sont listées dans l'ordre de saisie de l'OF, ce n'est <strong>pas</strong> l'ordre d'exécution : c'est vous qui définissez ce qui vient après quoi. <strong>Attendre la fin</strong> : l'opération démarre quand la coche est terminée. <strong>Démarrage progressif</strong> : elle démarre dès qu'une part de l'opération cochée est faite (ex. la pliure dès que des feuilles refendues sont prêtes), mais ne peut pas finir avant elle.</small></div>` : '';
      const manquants = e.parametres_manquants.length
        ? `<div class="msg error" style="margin:6px 0 0;">À renseigner : ${e.parametres_requis.filter(p => e.parametres_manquants.includes(p.cle)).map(p => esc(p.libelle)).join(', ')}.</div>` : '';
      const erreursF = (e.erreurs_formule || []).map(x => `<div class="msg error" style="margin:6px 0 0;">Formule « ${esc(x.phase)} » : ${esc(x.message)}</div>`).join('');
      return `
        <div class="step-card" data-gamme="${e.gamme_id}" data-verrou="${verrou ? 1 : 0}">
          <div class="step-head">
            <strong>${e.operation}</strong>
            <span><span class="tag ${e.chiffre ? 'ok' : 'warn'}">${e.chiffre ? fmtH(e.total_h) : 'Non chiffré'}</span>${verrou ? '' : ` <button class="btn s-retirer" type="button" data-gamme="${e.gamme_id}" title="Retirer cette opération de l'OF">Retirer</button>`}</span>
          </div>
          <div class="step-source">${SOURCES[e.source]}${e.duree_manuelle_h !== null ? ' — <strong>durée manuelle appliquée</strong>' : ''}</div>
          <div class="step-grid">
            <div class="field"><label>Machine prévue ${verrou ? '(planifiée — non modifiable ici)' : ''}</label><select class="s-machine" ${verrou ? 'disabled' : ''}>${machOptions}</select></div>
            <div class="field"><label>Quantité de cette opération <span class="plan-note">— reprise de l'OF, corrigeable</span></label><input class="s-qte" type="number" min="1" data-auto="${e.parametres.quantite ? 0 : 1}" value="${e.parametres.quantite ?? data.of.quantite}"></div>
            ${paramsHtml}
            <div class="field"><label>Durée manuelle (h) — remplace le calcul</label><input class="s-manuel" type="number" min="0" step="any" value="${e.duree_manuelle_h ?? ''}"></div>
          </div>
          ${e.type_manquant ? (() => {
            const lib = (c) => esc(((data.types_production || []).find(t => t.code === c) || { libelle: c }).libelle);
            const actuel = data.of.type_production ? lib(data.of.type_production) : 'non précisé';
            const machine = (e.machines_compatibles.find(m => m.id === e.machine_id) || {}).nom;
            return `<div class="msg ${e.duree_manuelle_h !== null ? '' : 'error'}" style="margin:6px 0 0;">Type de production de l'OF : <strong>${actuel}</strong>. ${machine ? 'Pour ' + esc(machine) + ', d' : 'D'}es temps ne sont enregistrés que pour : <strong>${e.types_possibles.map(lib).join(', ')}</strong>. ${e.duree_manuelle_h !== null ? 'La durée manuelle ci-dessous est utilisée à la place.' : 'Deux solutions : changer le type de production de l\'OF (en haut), ou ajouter un profil « ' + actuel + ' » pour cette machine (Machines → modifier → Configurer les temps de production).'}</div>`;
          })() : ''}
          ${predHtml}${manquants}${erreursF}${phasesHtml}
        </div>`;
    }).join('');

    // Caractéristiques du produit : saisies UNE fois ici, reprises par toutes les étapes de l'OF.
    const requisProduit = (data.produit_requis || []).filter(r => r.cle !== 'quantite');
    const produitHtml = requisProduit.length ? `
      <div class="produit-box">
        <div class="produit-titre">Caractéristiques du produit <span class="plan-note">— saisies une fois, utilisées par toutes les étapes</span></div>
        <div class="step-grid">${requisProduit.map(r => `
          <div class="field"><label>${esc(r.libelle)}${r.unite ? ' (' + esc(r.unite) + ')' : ''}</label>
            <input class="s-car" data-cle="${r.cle}" type="${r.type === 'texte' ? 'text' : 'number'}" ${r.type === 'texte' ? '' : 'min="0" step="any"'} value="${esc(r.valeur ?? '')}"></div>`).join('')}</div>
      </div>` : '';

    const t = data.totaux;
    const joursHtml = t.jours_equivalents.map(j => `${j.jours.toLocaleString('fr-FR')} j (${j.libelle.toLowerCase()})`).join(' · ');
    const calHtml = data.calendrier.map(c => `${c.libelle} : ${c.heure_debut}–${c.heure_fin}, ${fmtH(c.heures_utiles_par_jour)} utiles/jour`).join(' — ');

    afficherModale(`
      <h3>Chiffrage — ${ofNumero} <span style="font-weight:400; color:var(--ink-500); font-size:13px;">(${data.of.quantite.toLocaleString('fr-FR')} ex.)</span></h3>
      ${data.avertissements.map(a => `<div class="msg error">${a}</div>`).join('')}
      <div class="produit-box">
        <div class="produit-titre">Production <span class="plan-note">— quantité reprise de la fiche de fabrication, corrigeable ; le type de production choisit les temps de machine</span></div>
        <div class="step-grid">
          <div class="field"><label>Quantité de l'OF (exemplaires)</label><input id="m-of-qte" type="number" min="1" value="${data.of.quantite}"></div>
          <div class="field"><label>Type de production</label>
            <select id="m-type-prod"><option value="">— non précisé —</option>${(data.types_production || []).map(t => `<option value="${esc(t.code)}" ${data.of.type_production === t.code ? 'selected' : ''}>${esc(t.libelle)}</option>`).join('')}</select></div>
        </div>
      </div>
      ${produitHtml}
      <div class="produit-box">
        <div class="produit-titre">Opérations de cet OF <span class="plan-note">— enregistrez vos saisies avant d'ajouter ou de retirer une opération</span></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <select id="m-ajout-op" style="min-width:260px;"><option value="">— Ajouter une opération du catalogue —</option>${(catalogueOps || []).map(o => `<option value="${esc(o.code)}">${esc(o.nom)}</option>`).join('')}</select>
          <button class="btn" type="button" id="m-ajout-btn">Ajouter</button>
        </div>
      </div>
      ${etapesHtml || '<div class="empty">Cet OF n\'a aucune étape de gamme.</div>'}
      <div class="totaux-box">
        <div><span>Temps total (étapes en séquence)</span><strong>${fmtH(t.total_h)}</strong></div>
        <div><span>Heures machine</span><strong>${fmtH(t.heures_machine)}</strong></div>
        <div><span>Heures-personnes</span><strong>${fmtH(t.heures_personnes)}</strong></div>
        <div class="totaux-jours">≈ ${joursHtml}</div>
        ${t.etapes_non_chiffrees > 0 ? `<div class="msg error" style="margin:6px 0 0;">${t.etapes_non_chiffrees} étape(s) non chiffrée(s) : le total est incomplet.</div>` : ''}
        <div class="totaux-note">${calHtml}. Le parallélisme entre étapes n'est pas encore pris en compte (total en séquence).</div>
      </div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Fermer</button><button class="btn primary" id="m-submit">Recalculer et enregistrer</button></div>
    `, 'large');

    // Quantité : la quantité de l'OF se répercute sur les opérations qui n'ont pas de valeur propre.
    document.querySelectorAll('.s-qte').forEach(i => i.addEventListener('input', () => { i.dataset.auto = '0'; }));
    document.getElementById('m-of-qte').addEventListener('input', (ev) => {
      document.querySelectorAll('.s-qte[data-auto="1"]').forEach(i => { i.value = ev.target.value; });
    });
    const majLignePred = (row) => {
      const coche = row.querySelector('.s-pred-check').checked;
      const sel = row.querySelector('.s-pred-mode');
      sel.classList.toggle('hidden', !coche);
      row.querySelector('.pred-pct').classList.toggle('hidden', !coche || sel.value !== 'progressif');
    };
    document.querySelectorAll('.pred-row').forEach(row => {
      row.querySelector('.s-pred-check').addEventListener('change', () => majLignePred(row));
      row.querySelector('.s-pred-mode').addEventListener('change', () => majLignePred(row));
    });
    const modifierGamme = async (corps) => {
      const msg = document.getElementById('m-msg');
      try {
        const res = await fetch(`${API}/modifier-gamme`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ of_id: ofUuid, ...corps }) });
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || 'Erreur inconnue');
        if (r.avertissements && r.avertissements.length) toast(r.avertissements.join(' '));
        ouvrirModaleChiffrage(ofUuid, ofNumero);
      } catch (err) { msg.innerHTML = `<div class="msg error">${esc(err.message)}</div>`; }
    };
    document.getElementById('m-ajout-btn').addEventListener('click', () => {
      const code = document.getElementById('m-ajout-op').value;
      if (code) modifierGamme({ ajouter: [code] });
    });
    document.querySelectorAll('.s-retirer').forEach(b => b.addEventListener('click', () => {
      if (confirm('Retirer cette opération de l\'OF ?')) modifierGamme({ supprimer: [b.dataset.gamme] });
    }));
    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-submit').addEventListener('click', async () => {
      const msg = document.getElementById('m-msg');
      msg.innerHTML = `<div class="msg">Calcul en cours…</div>`;
      const caracteristiques = {};
      document.querySelectorAll('.s-car').forEach(i => { caracteristiques[i.dataset.cle] = i.value.trim(); });   // vide = effacer
      const etapes = Array.from(document.querySelectorAll('.step-card')).map(card => {
        const parametres = {};
        const qIn = card.querySelector('.s-qte');
        if (qIn.dataset.auto === '0' && qIn.value !== '' && qIn.value !== document.getElementById('m-of-qte').value) parametres.quantite = qIn.value;
        card.querySelectorAll('.s-param').forEach(i => { if (i.value !== '') parametres[i.dataset.cle] = i.value; });
        const etape = {
          gamme_id: card.dataset.gamme,
          parametres,
          duree_manuelle_h: card.querySelector('.s-manuel').value,
        };
        if (card.dataset.verrou !== '1') etape.machine_id = card.querySelector('.s-machine').value || null;
        const choixPred = card.querySelectorAll('.pred-row');
        if (choixPred.length) {
          const preds = []; const dependances = {};
          choixPred.forEach(row => {
            if (!row.querySelector('.s-pred-check').checked) return;
            const sel = row.querySelector('.s-pred-mode');
            const seq = Number(sel.dataset.seq);
            preds.push(seq);
            if (sel.value === 'progressif') {
              const pct = row.querySelector('.s-pred-pct').value;
              dependances[seq] = { mode: 'progressif', seuil_pct: pct === '' ? 10 : Number(pct) };
            }
          });
          etape.predecesseurs = preds;
          etape.dependances = dependances;
        }
        return etape;
      });
      try {
        const res = await fetch(`${API}/calculer-durees`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ of_id: ofUuid, caracteristiques, etapes, quantite_of: document.getElementById('m-of-qte').value, type_production: document.getElementById('m-type-prod').value || null }),
        });
        const nouveau = await res.json();
        if (!res.ok) throw new Error(nouveau.error || 'Erreur inconnue');
        toast('Chiffrage enregistré.');
        ouvrirModaleChiffrage(ofUuid, ofNumero, nouveau);
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }

  function renderStocks(){
    const wrap = el(`
      <div class="panel">
        <div class="panel-head"><h2>Stocks matières premières</h2></div>
        <table>
          <thead><tr><th>Matière</th><th>Quantité</th><th>Seuil d'alerte</th><th>Statut</th></tr></thead>
          <tbody id="stock-tbody"></tbody>
        </table>
      </div>
    `);
    const tbody = wrap.querySelector('#stock-tbody');
    state.stocks.forEach(s=>{
      const label = s.statut==='danger' ? 'Rupture proche' : s.statut==='warn' ? 'Sous le seuil cible' : 'Approvisionné';
      tbody.appendChild(el(`
        <tr>
          <td>${s.name}</td>
          <td class="mono">${s.qte.toLocaleString('fr-FR')} ${s.unite}</td>
          <td class="mono">${s.seuil.toLocaleString('fr-FR')} ${s.unite}</td>
          <td><span class="tag ${s.statut}">${label}</span></td>
        </tr>
      `));
    });
    return wrap;
  }

  function renderReporting(){
    const enCours = state.ordres.filter(o=>o.statut==='en cours').length;
    const enRetard = state.stocks.filter(s=>s.statut==='danger').length;
    const personnelActif = state.personnel.filter(p=>p.charge>0);
    const chargeMoy = personnelActif.length > 0
      ? Math.round(personnelActif.reduce((a,p)=>a+p.charge,0) / personnelActif.length)
      : 0;

    const wrap = el(`<div></div>`);
    const kpis = el(`
      <div class="kpis">
        <div class="kpi accent-teal"><div class="v">84%</div><div class="l">TRS moyen atelier (démo)</div></div>
        <div class="kpi accent-amber"><div class="v">${enCours}</div><div class="l">OF en cours</div></div>
        <div class="kpi accent-teal"><div class="v">${chargeMoy}%</div><div class="l">Charge moyenne équipe</div></div>
        <div class="kpi ${enRetard?'accent-danger':'accent-teal'}"><div class="v">${enRetard}</div><div class="l">Matières sous seuil critique</div></div>
      </div>
    `);
    wrap.appendChild(kpis);

    // ---- Donut : répartition des OF par priorité ----
    const parPriorite = { urgente: 0, haute: 0, normale: 0 };
    state.ordres.forEach(o => { if (parPriorite[o.priorite] !== undefined) parPriorite[o.priorite]++; });
    const total = state.ordres.length || 1;
    const segments = [
      { label: 'Urgente', n: parPriorite.urgente, color: 'var(--danger)' },
      { label: 'Haute',   n: parPriorite.haute,   color: 'var(--accent-amber)' },
      { label: 'Normale', n: parPriorite.normale, color: 'var(--accent-teal)' },
    ];
    let cumul = 0;
    const stops = segments.map(s => {
      const pct = (s.n / total) * 100;
      const start = cumul;
      cumul += pct;
      return `${s.color} ${start}% ${cumul}%`;
    }).join(', ');

    const donutPanel = el(`
      <div class="panel">
        <div class="panel-head"><h2>Répartition des OF par priorité</h2></div>
        <div class="donut-row">
          <div class="donut-wrap">
            <div class="donut" style="background: conic-gradient(${stops});"></div>
            <div class="donut-center"><div class="v">${state.ordres.length}</div><div class="l">OF actifs</div></div>
          </div>
          <div class="donut-legend">
            ${segments.map(s => `
              <div class="donut-legend-row">
                <span class="dot" style="background:${s.color}"></span>
                <span class="label">${s.label}</span>
                <span class="pct mono">${total ? Math.round((s.n/total)*100) : 0}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
    wrap.appendChild(donutPanel);

    const trsByMachine = [
      {name:'Relieuse dos carré', trs:88},
      {name:'Plieuse Stahl', trs:91},
      {name:'Massicot trilatéral', trs:76},
      {name:'Encarteuse-piqueuse', trs:82},
      {name:'Presse à chaud', trs:69},
    ];
    const panel = el(`<div class="panel"><div class="panel-head"><h2>TRS par machine — semaine en cours <span style="font-weight:400; color:var(--ink-500); font-size:12px;">(données de démonstration)</span></h2></div></div>`);
    const body = el(`<div style="padding:16px; display:flex; flex-direction:column; gap:12px;"></div>`);
    trsByMachine.forEach(m=>{
      const cls = m.trs>=85?'':(m.trs>=75?'warn':'danger');
      body.appendChild(el(`
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:4px;">
            <span>${m.name}</span><span class="mono">${m.trs}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:${m.trs}%"></div></div>
        </div>
      `));
    });
    panel.appendChild(body);
    wrap.appendChild(panel);
    return wrap;
  }

  const renderers = { planning: renderPlanning, ordres: renderOrdres, personnel: renderPersonnel, machines: renderMachines, temps: renderTempsStandards, stocks: renderStocks, reporting: renderReporting };

  function render(){
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.appendChild(renderers[state.tab]());
    document.getElementById('page-title').textContent = titles[state.tab][0];
    document.getElementById('page-sub').textContent = titles[state.tab][1];
    document.querySelectorAll('.navbtn').forEach(b=> b.classList.toggle('active', b.dataset.tab===state.tab));

    const addOfBtn = document.getElementById('add-of-btn');
    const newOfBtn = document.getElementById('new-of');
    if (addOfBtn) addOfBtn.addEventListener('click', () => ouvrirModaleAffectation({}));
    if (newOfBtn) newOfBtn.addEventListener('click', ouvrirModaleNouvelOf);
    const coutsBtn = document.getElementById('couts-btn');
    if (coutsBtn) coutsBtn.addEventListener('click', ouvrirModaleCouts);
  }

  document.querySelectorAll('.navbtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.tab = btn.dataset.tab;
      document.getElementById('side').classList.remove('open');
      render();
    });
  });

  document.getElementById('menubtn').addEventListener('click', ()=>{
    document.getElementById('side').classList.toggle('open');
  });

  function cartesSombres() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }
  function majSwitchTheme() {
    document.getElementById('theme-toggle').setAttribute('aria-checked', cartesSombres() ? 'true' : 'false');
  }
  majSwitchTheme();

  document.getElementById('theme-toggle').addEventListener('click', ()=>{
    const root = document.documentElement;
    root.setAttribute('data-theme', cartesSombres() ? 'light' : 'dark');
    majSwitchTheme();
  });

  // ---------- Notifications toast ----------
  const TOAST_ICONS = {
    ok: '<path d="M20 6L9 17l-5-5"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  };
  function toast(message, type) {
    type = type || 'ok';
    const root = document.getElementById('toast-root');
    const node = el(`
      <div class="toast ${type==='error'?'error':''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOAST_ICONS[type]}</svg>
        <span>${message}</span>
      </div>
    `);
    root.appendChild(node);
    setTimeout(() => {
      node.classList.add('fading');
      setTimeout(() => node.remove(), 200);
    }, 3200);
  }

  // ---------- Chargement des données réelles (Supabase via Netlify Function) ----------
  // En développement local sans backend branché, ou si l'appel échoue
  // pour toute autre raison, on garde les données de démo ci-dessus
  // plutôt que d'afficher un écran vide.
  //
  // Limites actuelles de ce branchement (à lever plus tard si besoin) :
  //  - la charge du personnel est approximée (créneaux de la semaine
  //    affichée / 5 jours), pas une vraie moyenne glissante.
  async function chargerDonneesReelles() {
    try {
      const url = `/.netlify/functions/lecture-planning?date_debut=${DAYS_ISO[0]}&date_fin=${DAYS_ISO[6]}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      state.machines = data.machines.map(m => ({ id: m.code, uuid: m.id, name: m.nom, code: m.code }));
      // Ligne virtuelle pour les opérations manuelles (aucune machine) : sinon leurs créneaux seraient invisibles.
      if (data.planning.some(c => !c.machine_id)) state.machines.push({ id: 'MANUEL', uuid: null, name: 'Travail manuel (sans machine)', code: 'MANUEL', manuel: true });

      state.personnel = data.personnel.map(p => {
        // Charge = heures affectées / 40 h (5 j × 8 h). Une ligne sans heures = journée entière (8 h).
        const minutesDe = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
        const heuresSemaine = data.planning.filter(c => (c.personnel_ids || []).includes(p.id)).reduce((total, c) => {
          if (!c.heure_debut || !c.heure_fin) return total + 8;
          let min = minutesDe(c.heure_fin) - minutesDe(c.heure_debut);
          if (minutesDe(c.heure_debut) < 720 && minutesDe(c.heure_fin) > 750) min -= 30; // pause du midi comprise dans la plage
          return total + min / 60;
        }, 0);
        const dispoAuj = (data.disponibilites || []).find(d => d.personnel_id === p.id && d.date === AUJOURDHUI_ISO);
        let statutAffiche;
        if (!dispoAuj || dispoAuj.statut === 'disponible') {
          statutAffiche = (dispoAuj && dispoAuj.heure_debut)
            ? `Disponible ${dispoAuj.heure_debut.slice(0,5)}–${dispoAuj.heure_fin.slice(0,5)}`
            : 'Disponible';
        } else if (dispoAuj.statut === 'en arrêt') {
          statutAffiche = 'En arrêt';
        } else {
          statutAffiche = 'Absent(e)';
        }
        return {
          id: p.id, name: p.nom, role: p.poste || '',
          comp: [...(p.competences || []), ...(p.machines_specifiques || []).map(m => `machine: ${m}`)],
          charge: Math.round((heuresSemaine / 40) * 100),
          statut: statutAffiche,
        };
      });

      state.ordres = data.ordres.map(o => ({
        id: o.numero, uuid: o.id,
        produit: o.titres ? o.titres.nom : '(titre non renseigné)',
        client: o.titres ? o.titres.client : '',
        qte: o.quantite, delai: o.delai, priorite: o.priorite,
        statut: o.statut, avancement: o.avancement,
      }));

      state.stocks = data.stocks.map(s => ({
        id: s.id, name: s.nom, unite: s.unite, qte: s.quantite, seuil: s.seuil_alerte,
        statut: s.quantite <= s.seuil_alerte * 0.5 ? 'danger' : (s.quantite <= s.seuil_alerte ? 'warn' : 'ok'),
      }));

      const planningParMachine = {};
      data.planning.forEach(creneau => {
        const machine = creneau.machine_id ? data.machines.find(m => m.id === creneau.machine_id) : { code: 'MANUEL' };
        if (!machine) return;
        const dayIdx = DAYS_ISO.indexOf(creneau.date);
        if (dayIdx === -1) return;
        const of = data.ordres.find(o => o.id === creneau.of_id);
        if (!planningParMachine[machine.code]) planningParMachine[machine.code] = [];
        planningParMachine[machine.code].push({
          day: dayIdx,
          of: of ? of.numero : creneau.of_id,
          statut: creneau.statut === 'retard' ? 'danger' : 'ok',
          nbPers: (creneau.personnel_ids || []).length,
          debut: creneau.heure_debut ? String(creneau.heure_debut).slice(0, 5) : null,
          fin: creneau.heure_fin ? String(creneau.heure_fin).slice(0, 5) : null,
          phase: creneau.phase || null,
          gamme: creneau.gamme_operatoire_id || null,
          date: creneau.date,
        });
      });
      state.planning = planningParMachine;

      render();
    } catch (e) {
      console.warn('Backend indisponible, affichage des données de démonstration.', e);
      render();
    }
  }

  // ---------- Écriture : création d'OF et affectation planning ----------
  const API = '/.netlify/functions';
  let referentielsCache = null;

  async function getReferentiels() {
    if (referentielsCache) return referentielsCache;
    const res = await fetch(`${API}/referentiels`);
    if (!res.ok) throw new Error('Impossible de charger les référentiels.');
    referentielsCache = await res.json();
    return referentielsCache;
  }

  function fermerModale() {
    document.getElementById('modal-root').innerHTML = '';
  }

  function afficherModale(contenuHtml, classe) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal ${classe || ''}"><button class="modal-close" id="modal-x" aria-label="Fermer">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>${contenuHtml}</div></div>`;
    root.querySelector('#modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') fermerModale();
    });
    root.querySelector('#modal-x').addEventListener('click', fermerModale);
  }

  function fichierEnBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Redimensionne/recompresse une image côté navigateur avant envoi :
  // une photo de téléphone brute (10-15 Mo, souvent >4000px de large)
  // peut dépasser la limite de taille des Netlify Functions une fois
  // encodée en base64, et sature inutilement la mémoire de l'appareil
  // pendant la capture/l'upload. On redescend à 1800px de long côté
  // et en JPEG qualité 0.82 — largement suffisant pour que l'IA lise
  // le texte d'une fiche.
  async function compresserImage(file, maxCote = 1800, qualite = 0.82) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    let { width, height } = img;
    if (width > maxCote || height > maxCote) {
      const ratio = Math.min(maxCote / width, maxCote / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const compressedDataUrl = canvas.toDataURL('image/jpeg', qualite);
    return { base64: compressedDataUrl.split(',')[1], mimeType: 'image/jpeg' };
  }

  async function ouvrirModaleNouvelOf() {
    let refs;
    try { refs = await getReferentiels(); }
    catch (e) {
      afficherModale(`<h3>Nouvel OF</h3><div class="msg error">Backend indisponible : impossible de charger les opérations/titres. (${e.message})</div><div class="actions"><button class="btn" id="m-close">Fermer</button></div>`);
      document.getElementById('m-close').addEventListener('click', fermerModale);
      return;
    }

    const opsHtml = refs.operations.map(o => `
      <label><input type="checkbox" value="${o.code}"> ${o.nom}</label>
    `).join('');

    afficherModale(`
      <h3>Nouvel ordre de fabrication</h3>
      <div class="import-box" id="import-box">
        <input type="file" id="m-import" accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx" class="hidden">
        <label for="m-import" class="import-label">
          ${svgIcon('<path d="M12 16V4M12 4l-4 4M12 4l4 4"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>')}
          <span><strong>Importer une fiche</strong> — photo, PDF, Word ou Excel<br>remplit le formulaire automatiquement</span>
        </label>
        <div id="import-status"></div><div id="import-car"></div>
      </div>
      <div class="field"><label>Titre / produit</label><input id="m-titre-nom" placeholder="ex: Trône de Fer 5"></div>
      <div class="field"><label>Client</label><input id="m-titre-client" placeholder="ex: Éditions Pléiade"></div>
      <div class="field"><label>Quantité</label><input id="m-qte" type="number" min="1" placeholder="2000"></div>
      <div class="field"><label>Délai</label><input id="m-delai" type="date"></div>
      <div class="field"><label>Type de production <span class="plan-note">— choisit les temps de machine (Pléiade, Cartonné…)</span></label>
        <select id="m-type"><option value="">— non précisé —</option>${(refs.types_production || []).map(t => `<option value="${esc(t.code)}">${esc(t.libelle)}</option>`).join('')}</select></div>
      <div class="field"><label>Priorité</label>
        <select id="m-priorite"><option value="normale">Normale</option><option value="haute">Haute</option><option value="urgente">Urgente</option></select>
      </div>
      <div class="field"><label>Gamme opératoire (cocher dans l'ordre voulu)</label><div class="op-list">${opsHtml}</div></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">Créer l'OF</button></div>
    `);

    let caracteristiquesFiche = {};
    document.getElementById('m-import').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('import-status');
      statusEl.innerHTML = `<div class="msg">Analyse du document en cours…</div>`;
      try {
        const estImage = file.type.startsWith('image/');
        const { base64, mimeType } = estImage
          ? await compresserImage(file)
          : { base64: await fichierEnBase64(file), mimeType: file.type };
        const res = await fetch(`${API}/analyser-fiche`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_base64: base64, file_name: file.name, mime_type: mimeType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');

        if (data.titre) document.getElementById('m-titre-nom').value = data.titre;
        if (data.client) document.getElementById('m-titre-client').value = data.client;
        if (data.quantite) document.getElementById('m-qte').value = data.quantite;
        if (data.delai) document.getElementById('m-delai').value = data.delai;
        if (data.type_production) document.getElementById('m-type').value = data.type_production;
        caracteristiquesFiche = data.caracteristiques || {};
        const lues = Object.entries(caracteristiquesFiche);
        document.getElementById('import-car').innerHTML = lues.length ? `<div class="plan-note">Caractéristiques lues sur la fiche : ${lues.map(([k, v]) => esc(k) + ' = ' + esc(String(v))).join(' · ')} (modifiables ensuite dans le chiffrage).</div>` : '';
        document.querySelectorAll('.op-list input[type="checkbox"]').forEach(cb => {
          cb.checked = (data.operation_codes || []).includes(cb.value);
        });

        const confianceClasse = data.confiance === 'haute' ? 'ok' : data.confiance === 'basse' ? 'error' : '';
        statusEl.innerHTML = `<div class="msg ${confianceClasse}">Extraction ${data.confiance || ''} — relisez les champs avant de créer l'OF.${data.notes ? ' ' + data.notes : ''}</div>`;
        toast('Fiche analysée — vérifiez les champs pré-remplis.');
      } catch (err) {
        statusEl.innerHTML = `<div class="msg error">Échec de l'analyse : ${err.message}</div>`;
      }
    });

    document.getElementById('m-cancel').addEventListener('click', fermerModale);
    document.getElementById('m-submit').addEventListener('click', async () => {
      const nom = document.getElementById('m-titre-nom').value.trim();
      const client = document.getElementById('m-titre-client').value.trim();
      const quantite = parseInt(document.getElementById('m-qte').value, 10);
      const delai = document.getElementById('m-delai').value || null;
      const priorite = document.getElementById('m-priorite').value;
      const operations = Array.from(document.querySelectorAll('.op-list input:checked')).map(i => i.value);
      const msg = document.getElementById('m-msg');

      if (!nom || !quantite || operations.length === 0) {
        msg.innerHTML = `<div class="msg error">Titre, quantité et au moins une opération sont requis.</div>`;
        return;
      }
      msg.innerHTML = `<div class="msg">Création en cours…</div>`;
      try {
        const res = await fetch(`${API}/creer-ordre`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titre: { nom, client }, quantite, delai, priorite, operations, type_production: document.getElementById('m-type').value || null, caracteristiques: caracteristiquesFiche }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        msg.innerHTML = `<div class="msg ok">OF ${data.numero} créé.</div>`;
        toast(`OF ${data.numero} créé avec succès.`);
        fermerModale(); chargerDonneesReelles();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }

  async function ouvrirModaleAffectation({ machineUuid, machineName, dayIdx, ofUuid }) {
    let refs;
    try { refs = await getReferentiels(); }
    catch (e) {
      afficherModale(`<h3>Affecter un OF</h3><div class="msg error">Backend indisponible. (${e.message})</div><div class="actions"><button class="btn" id="m-close">Fermer</button></div>`);
      document.getElementById('m-close').addEventListener('click', fermerModale);
      return;
    }

    const dateIso = dayIdx != null ? DAYS_ISO[dayIdx] : DAYS_ISO[0];
    const ofOptions = state.ordres.map(o => `<option value="${o.uuid}" ${o.uuid === ofUuid ? 'selected' : ''}>${o.id} — ${o.produit}</option>`).join('');
    const machineOptions = `<option value="">— Aucune machine (opération manuelle) —</option>` + state.machines.filter(m => m.uuid).map(m => `<option value="${m.uuid}" ${m.uuid===machineUuid?'selected':''}>${m.name}</option>`).join('');
    const persCases = refs.personnel.map(p => `<label><input type="checkbox" value="${p.id}"> ${p.nom}${p.poste ? ' <span style="color:var(--ink-500);">— ' + p.poste + '</span>' : ''}</label>`).join('');

    afficherModale(`
      <h3>Affecter un OF au planning</h3>
      <div class="field"><label>Ordre de fabrication</label><select id="m-of">${ofOptions}</select></div>
      <div class="field"><label>Étape de gamme</label><select id="m-etape"><option>Choisir un OF d'abord…</option></select></div>
      <div id="m-etape-note"></div>
      <div class="field"><label>Machine <span class="plan-note">— laissez « Aucune machine » pour un travail manuel</span></label><select id="m-machine">${machineOptions}</select><div id="m-dispo" class="dispo-strip"></div></div>
      <div class="field"><label>Jour de début <span class="plan-note">— proposé automatiquement selon les dépendances</span></label><input id="m-date" type="date" value="${dateIso}"><div id="m-date-note" class="plan-note" style="margin-top:4px;"></div></div>
      <div class="field"><label>Personnel (optionnel — cocher une ou plusieurs personnes)</label><div class="op-list" id="m-personnel-list">${persCases}</div></div>
      <div id="m-msg"></div>
      <div class="actions"><button class="btn" id="m-cancel">Annuler</button><button class="btn primary" id="m-submit">Affecter</button></div>
    `);

    document.getElementById('m-cancel').addEventListener('click', fermerModale);

    const etapeSelect = document.getElementById('m-etape');
    const noteEtape = document.getElementById('m-etape-note');
    const statutChoisi = () => { const o = etapeSelect.selectedOptions[0]; return o ? o.dataset.statut : null; };

    function majNoteEtape(gammes) {
      const st = statutChoisi();
      if (st === 'planifié') {
        noteEtape.innerHTML = `
          <div class="msg" style="margin:-4px 0 12px;">Cette étape est <strong>déjà planifiée</strong>. Pour l'affecter autrement, déplanifiez-la d'abord.
            <div class="note-actions"><button class="btn" id="dp-etape">Déplanifier cette étape</button><button class="btn" id="dp-of">Déplanifier tout l'OF</button></div></div>`;
        document.getElementById('dp-etape').addEventListener('click', () => deplanifier({ gamme_ids: [etapeSelect.value] }));
        document.getElementById('dp-of').addEventListener('click', () => deplanifier({ of_id: document.getElementById('m-of').value }));
      } else if (gammes && !gammes.some(g => g.statut === 'à planifier' || g.statut === 'planifié')) {
        noteEtape.innerHTML = `<div class="msg" style="margin:-4px 0 12px;">Toutes les étapes de cet OF sont démarrées ou terminées : il n'y a plus rien à planifier.</div>`;
      } else {
        noteEtape.innerHTML = '';
      }
    }

    async function deplanifier(corps) {
      const msg = document.getElementById('m-msg');
      msg.innerHTML = `<div class="msg">Déplanification…</div>`;
      try {
        const res = await fetch(`${API}/deplanifier-etape`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Erreur inconnue');
        toast(`${d.deplanifiees.length} étape(s) déplanifiée(s).${d.conservees.length ? ' ' + d.conservees.length + ' conservée(s) (déjà démarrées).' : ''}`);
        msg.innerHTML = '';
        chargerDonneesReelles();
        await chargerEtapes();
      } catch (e) { msg.innerHTML = `<div class="msg error">${esc(e.message)}</div>`; }
    }

    async function chargerEtapes() {
      const ofSel = document.getElementById('m-of').value;
      etapeSelect.innerHTML = `<option>Chargement…</option>`;
      noteEtape.innerHTML = '';
      try {
        const res = await fetch(`${API}/gammes-ordre?of_id=${ofSel}`);
        const gammes = await res.json();
        if (!Array.isArray(gammes) || gammes.length === 0) {
          etapeSelect.innerHTML = `<option value="">Cet OF n'a aucune étape de gamme</option>`;
          return;
        }
        const SUFFIXE = { 'planifié': ' — déjà planifiée', 'en cours': ' — en cours', 'terminé': ' — terminée' };
        etapeSelect.innerHTML = gammes.map(g => `<option value="${g.id}" data-statut="${g.statut}" data-manuel="${g.sans_machine ? 1 : 0}" ${g.statut === 'en cours' || g.statut === 'terminé' ? 'disabled' : ''}>${esc(g.operation.nom)}${SUFFIXE[g.statut] || ''}</option>`).join('');
        const defaut = gammes.find(g => g.statut === 'à planifier') || gammes.find(g => g.statut === 'planifié');
        if (defaut) etapeSelect.value = defaut.id;
        majNoteEtape(gammes);
        ajusterMachine();
        majJourDebut();
      } catch (e) {
        etapeSelect.innerHTML = `<option value="">Erreur de chargement</option>`;
      }
    }
    // Disponibilité de la machine choisie : jours libres / occupés / en maintenance.
    let dateManuelle = false;
    const aujourdhuiLocal = () => new Date().toLocaleDateString('sv-SE');
    async function majDispo(auto) {
      const zone = document.getElementById('m-dispo');
      const machine = document.getElementById('m-machine').value;
      if (!machine) { zone.innerHTML = ''; return; }
      const champ = document.getElementById('m-date');
      const auj = aujourdhuiLocal();
      let du = auj;
      if (champ.value && champ.value > auj) { const d = new Date(champ.value + 'T00:00:00'); d.setDate(d.getDate() - 3); const t = d.toLocaleDateString('sv-SE'); if (t > auj) du = t; }
      zone.innerHTML = '<span class="plan-note">Disponibilités de la machine…</span>';
      try {
        const res = await fetch(`${API}/dispo-machine?machine_id=${machine}&du=${du}&jours=21`);
        const r = await res.json();
        if (!res.ok) throw new Error(r.error || 'Erreur inconnue');
        let note = '';
        const premierLibre = r.jours.find(j => j.etat === 'libre' && j.date >= (champ.value || auj));
        const courant = r.jours.find(j => j.date === champ.value);
        if (auto && !dateManuelle && courant && courant.etat !== 'libre' && premierLibre) {
          note = `La machine est occupée le ${courant.libelle} : premier jour libre proposé (${premierLibre.libelle}).`;
          champ.value = premierLibre.date;
        }
        const choisi = champ.value;
        zone.innerHTML = r.jours.map(j => `<button type="button" class="dispo-chip ${j.etat} ${j.date === choisi ? 'choisi' : ''}" data-date="${j.date}" title="${esc(j.etat === 'libre' ? 'Libre — cliquer pour choisir ce jour' : j.details.join('\n'))}">${esc(j.libelle)}</button>`).join('')
          + `<div class="dispo-legende">${note ? esc(note) + ' · ' : ''}Vert : libre (cliquez pour choisir) · barré : occupé (survolez pour voir par quoi) · orangé : maintenance.</div>`;
        zone.querySelectorAll('.dispo-chip.libre').forEach(b => b.addEventListener('click', () => {
          champ.value = b.dataset.date; dateManuelle = true;
          zone.querySelectorAll('.dispo-chip').forEach(x => x.classList.toggle('choisi', x === b));
        }));
      } catch (e) { zone.innerHTML = `<span class="plan-note">Disponibilités indisponibles (${esc(e.message)}).</span>`; }
    }
    document.getElementById('m-machine').addEventListener('change', () => majDispo(true));
    document.getElementById('m-date').addEventListener('change', () => { dateManuelle = true; majDispo(false); });

    // Jour de début automatique : déduit des dépendances de l'opération choisie.
    let suggestionNum = 0;
    async function majJourDebut() {
      const note = document.getElementById('m-date-note');
      const id = etapeSelect.value;
      if (!id || statutChoisi() === 'planifié') { note.textContent = ''; return; }
      const num = ++suggestionNum;
      note.textContent = 'Calcul du jour de début…';
      try {
        const res = await fetch(`${API}/jour-debut-etape?gamme_id=${id}`);
        const r = await res.json();
        if (num !== suggestionNum) return;   // une autre étape a été choisie entre-temps
        if (!res.ok) throw new Error(r.error || 'Erreur inconnue');
        document.getElementById('m-date').value = r.date;
        majDispo(true);
        if (r.bloques && r.bloques.length) {
          note.innerHTML = `<span style="color:var(--danger);">À planifier d'abord : ${r.bloques.map(esc).join(', ')}.</span>`;
        } else {
          note.textContent = `Début le ${r.libelle} — ${r.raison}.`;
        }
      } catch (e) { if (num === suggestionNum) note.textContent = ''; }
    }
    // Opération manuelle : pas de machine à choisir.
    function ajusterMachine() {
      const opt = etapeSelect.selectedOptions && etapeSelect.selectedOptions[0];
      if (opt && opt.dataset.manuel === '1') document.getElementById('m-machine').value = '';
    }
    etapeSelect.addEventListener('change', () => { dateManuelle = false; majNoteEtape(null); ajusterMachine(); majJourDebut(); });
    document.getElementById('m-of').addEventListener('change', chargerEtapes);
    if (ofOptions) chargerEtapes();

    document.getElementById('m-submit').addEventListener('click', async () => {
      const gamme_operatoire_id = document.getElementById('m-etape').value;
      const machine_id = document.getElementById('m-machine').value;
      const date = document.getElementById('m-date').value;
      const personnel_ids = Array.from(document.querySelectorAll('#m-personnel-list input:checked')).map(i => i.value);
      const msg = document.getElementById('m-msg');

      if (statutChoisi() === 'planifié') {
        msg.innerHTML = `<div class="msg error">Cette étape est déjà planifiée : déplanifiez-la d'abord (boutons ci-dessus).</div>`;
        return;
      }
      if (!gamme_operatoire_id || !date) {
        msg.innerHTML = `<div class="msg error">Étape et jour sont requis.</div>`;
        return;
      }
      const optChoisie = etapeSelect.selectedOptions[0];
      if (!machine_id && optChoisie && optChoisie.dataset.manuel === '0' && !confirm('Cette opération utilise normalement une machine. L\'affecter sans machine ?')) return;
      msg.innerHTML = `<div class="msg">Affectation en cours…</div>`;
      try {
        const res = await fetch(`${API}/affecter-planning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gamme_operatoire_id, machine_id: machine_id || null, date, personnel_ids }),
        });
        let data = await res.json();
        if (res.status === 409 && data.conflit === 'dependance') {
          if (!confirm(`${data.error}\n\nAffecter quand même à la date choisie ?`)) {
            document.getElementById('m-date').value = data.date_suggeree;
            msg.innerHTML = `<div class="msg">Date remplacée par le premier jour possible. Cliquez sur Affecter pour valider.</div>`;
            return;
          }
          const res2 = await fetch(`${API}/affecter-planning`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gamme_operatoire_id, machine_id: machine_id || null, date, personnel_ids, forcer: true }),
          });
          data = await res2.json();
          if (!res2.ok) throw new Error(data.error || 'Erreur inconnue');
        } else if (!res.ok) throw new Error(data.error || 'Erreur inconnue');
        msg.innerHTML = `<div class="msg ok">Affecté.</div>`;
        toast('Affectation enregistrée.');
        fermerModale(); chargerDonneesReelles();
      } catch (e) {
        msg.innerHTML = `<div class="msg error">${e.message}</div>`;
      }
    });
  }

  chargerDonneesReelles();
})();
</script>
</body>
</html>
