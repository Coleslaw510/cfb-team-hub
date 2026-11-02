(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const COLORS = ['#ff6b2c', '#3aa0ff', '#2ecc8f', '#c77dff'];
const CONF = {American: 'American', acc: 'ACC', big12: 'Big 12', big10: 'Big Ten', usa: 'C-USA', ind: 'Independent', midam: 'MAC', mwest: 'Mountain West', pac12: 'Pac-12', sec: 'SEC', belt: 'Sun Belt'};
const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#1d2840"/></svg>');
let D, T, BY, BYSLUG, N, ST, charts = {}, TAB;
const logo = t => t ? (t.dark || t.logo || PH) : PH;
document.addEventListener('error', e => { const im = e.target; if (im && im.tagName === 'IMG' && !im.dataset.fb) { im.dataset.fb = 1; im.src = im.src.includes('500-dark') ? im.src.replace('500-dark', '500') : PH; } }, true);
document.addEventListener('error', e => { const im = e.target; if (im.tagName === 'IMG' && !im.dataset.fb) { im.dataset.fb = 1; im.src = im.src.includes('500-dark') ? im.src.replace('500-dark', '500') : PH; } }, true);
const logoId = id => `https://a.espncdn.com/i/teamlogos/ncaa/500-dark/${id}.png`;
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const slug = t => norm(t.loc || t.short).replace(/ /g, '-');
const ord = n => n == null ? '—' : n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
const pctColor = p => `hsl(${Math.round(p * 1.25)},75%,52%)`;
const pctOf = rk => rk == null ? null : Math.round(100 * (N - rk) / (N - 1));
const sign = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 1800); }
function fmt(f, v) { if (v == null || Number.isNaN(v)) return '—';
  switch (f) { case 'int': return Math.round(v).toLocaleString(); case 'f1': return v.toFixed(1); case 'f2': return v.toFixed(2); case 'pct': return v.toFixed(1) + '%';
    case 'p0': return Math.round(v) + '%'; case 'sgn1': return (v > 0 ? '+' : '') + v.toFixed(1); case 'sgn': return (v > 0 ? '+' : '') + Math.round(v);
    case 'mmss': { const m = Math.floor(v), s = Math.round((v - m) * 60); return `${m}:${String(s).padStart(2, '0')}`; } case 'rk': return ord(v); default: return String(v); } }

// ---------- metrics (ratings + stats) ----------
const RATING_METRICS = [
  {k: 'fpi', l: 'FPI', c: 'FPI (ESPN)', f: 'sgn1', hb: 1, v: t => t.fpi?.fpi, rk: t => t.fpi?.rk},
  {k: 'fpi_off', l: 'FPI offense', c: 'FPI (ESPN)', f: 'sgn1', hb: 1, v: t => t.fpi?.off, rk: t => t.fpi?.offrk},
  {k: 'fpi_def', l: 'FPI defense', c: 'FPI (ESPN)', f: 'sgn1', hb: 1, v: t => t.fpi?.dfn, rk: t => t.fpi?.dfnrk},
  {k: 'fpi_st', l: 'FPI special teams', c: 'FPI (ESPN)', f: 'sgn1', hb: 1, v: t => t.fpi?.st, rk: t => t.fpi?.strk},
  {k: 'eff', l: 'Total efficiency (0-100)', c: 'FPI (ESPN)', f: 'f1', hb: 1, v: t => t.fpi?.eff, rk: t => t.fpi?.effrk},
  {k: 'offeff', l: 'Offensive efficiency', c: 'FPI (ESPN)', f: 'f1', hb: 1, v: t => t.fpi?.offeff, rk: t => t.fpi?.offeffrk},
  {k: 'defeff', l: 'Defensive efficiency', c: 'FPI (ESPN)', f: 'f1', hb: 1, v: t => t.fpi?.defeff, rk: t => t.fpi?.defeffrk},
  {k: 'steff', l: 'Special teams efficiency', c: 'FPI (ESPN)', f: 'f1', hb: 1, v: t => t.fpi?.steff, rk: t => t.fpi?.steffrk},
  {k: 'sp', l: 'SP+ rating', c: 'SP+ (ESPN, Connelly)', f: 'sgn1', hb: 1, v: t => t.sp?.r, rk: t => t.sp?.rk},
  {k: 'sp_off', l: 'SP+ offense', c: 'SP+ (ESPN, Connelly)', f: 'f1', hb: 1, v: t => t.sp?.o, rk: t => t.sp?.ork},
  {k: 'sp_def', l: 'SP+ defense (lower = better)', c: 'SP+ (ESPN, Connelly)', f: 'f1', hb: 0, v: t => t.sp?.d, rk: t => t.sp?.drk},
  {k: 'sp_st', l: 'SP+ special teams', c: 'SP+ (ESPN, Connelly)', f: 'sgn1', hb: 1, v: t => t.sp?.st, rk: t => t.sp?.strk},
  {k: 'sor', l: 'Strength of record rank', c: 'Résumé (ESPN)', f: 'rk', hb: 0, v: t => t.fpi?.sorrk, rk: t => t.fpi?.sorrk},
  {k: 'sos', l: 'SOS rank (played)', c: 'Résumé (ESPN)', f: 'rk', hb: 0, v: t => t.fpi?.sosrk, rk: t => t.fpi?.sosrk},
  {k: 'remsos', l: 'Remaining SOS rank', c: 'Résumé (ESPN)', f: 'rk', hb: 0, v: t => t.fpi?.remsosrk, rk: t => t.fpi?.remsosrk},
  {k: 'gc', l: 'Game control rank', c: 'Résumé (ESPN)', f: 'rk', hb: 0, v: t => t.fpi?.gcrk, rk: t => t.fpi?.gcrk},
  {k: 'projw', l: 'Projected wins', c: 'Projections (ESPN FPI)', f: 'f1', hb: 1, v: t => t.fpi?.projw},
  {k: 'playoff', l: 'CFP chance', c: 'Projections (ESPN FPI)', f: 'p0', hb: 1, v: t => t.fpi?.playoff},
  {k: 'winconf', l: 'Win conference chance', c: 'Projections (ESPN FPI)', f: 'p0', hb: 1, v: t => t.fpi?.winconf},
  {k: 'tough', l: 'Path so far: avg opp. FPI (site-adj.)', c: 'Path difficulty (this site)', f: 'sgn1', hb: 1, v: t => t.path?.avg_ofpi, rk: t => t.path?.tough_rk},
  {k: 'tough_rem', l: 'Path remaining: avg opp. FPI', c: 'Path difficulty (this site)', f: 'sgn1', hb: 1, v: t => t.path?.avg_ofpi_rem, rk: t => t.path?.tough_rem_rk},
  {k: 'avg_ork', l: 'Avg opponent FPI rank (played)', c: 'Path difficulty (this site)', f: 'f1', hb: 0, v: t => t.path?.avg_ork},
  {k: 't25', l: 'FPI top-25 opponents faced', c: 'Path difficulty (this site)', f: 'int', hb: 1, v: t => t.path?.t25},
];
let METRICS, MK;
function buildMetrics() {
  METRICS = RATING_METRICS.concat(D.meta.stats.map(s => ({k: s.k, l: s.l, c: 'Stats · ' + s.c, f: s.f, hb: s.hb, v: t => t.s?.[s.k], rk: t => t.r?.[s.k]?.[0]})));
  MK = Object.fromEntries(METRICS.map(m => [m.k, m]));
}
const mval = (k, t) => MK[k].v(t);
const mrk = (k, t) => MK[k].rk ? MK[k].rk(t) : null;
function mpct(k, t) { const m = MK[k]; if (m.k in (t.r || {})) return t.r[m.k][1]; const r = mrk(k, t); return r == null ? null : pctOf(r); }

// ---------- load ----------
async function load() {
  D = await fetch('data/teams.json').then(r => r.json()); T = D.teams; N = T.length;
  BY = Object.fromEntries(T.map(t => [t.id, t])); BYSLUG = {};
  T.forEach(t => { t._n = norm([t.display, t.loc, t.short, t.abbr].join(' ')); t._slug = slug(t); BYSLUG[t._slug] = t; BYSLUG[norm(t.abbr)] = BYSLUG[norm(t.abbr)] || t; });
  buildMetrics();
  const m = D.meta;
  $('#asof').textContent = `${m.season} FBS · results through ${throughDate()} · FPI ${shortDate(m.fpi_updated)}`;
}
const shortDate = s => s ? new Date(s).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York'}) : '—';
const throughDate = () => new Date(D.meta.last_final).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York'});
function resolve(tok) { if (!tok) return null; tok = decodeURIComponent(tok); if (BY[tok]) return BY[tok]; const n = norm(tok.replace(/-/g, ' ')).replace(/ /g, '-');
  if (BYSLUG[n]) return BYSLUG[n]; const s = searchTeams(tok.replace(/-/g, ' '), 1); return s[0] || null; }
function searchTeams(q, n = 8) { const k = norm(q); if (!k) return [];
  const sc = t => { if (norm(t.loc) === k || norm(t.short) === k || norm(t.abbr) === k) return 0; if (norm(t.loc).startsWith(k) || norm(t.short).startsWith(k)) return 1; if (t._n.split(' ').some(w => w.startsWith(k))) return 2; if (t._n.includes(k)) return 3; return 9; };
  return T.map(t => [sc(t), t]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || (a[1].fpi?.rk || 999) - (b[1].fpi?.rk || 999)).slice(0, n).map(x => x[1]); }
function typeahead(input, box, onPick) {
  let items = [], sel = 0;
  const render = () => { box.innerHTML = items.map((t, i) => `<div class="it ${i === sel ? 'sel' : ''}" data-i="${i}"><img src="${logo(t)}" alt="" style="border-radius:6px;object-fit:contain"><div><div class="nm">${t.poll?.ap ? `<span class="rkb">${t.poll.ap}</span>` : ''}${t.display}</div><div class="sub">${CONF[t.conf] || t.conf} · ${t.rec.o} · FPI #${t.fpi?.rk ?? '—'}</div></div></div>`).join(''); box.classList.toggle('on', items.length > 0); };
  input.addEventListener('input', () => { items = searchTeams(input.value); sel = 0; render(); });
  input.addEventListener('keydown', e => { if (!items.length) return; if (e.key === 'ArrowDown') { sel = (sel + 1) % items.length; render(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = (sel - 1 + items.length) % items.length; render(); e.preventDefault(); } else if (e.key === 'Enter') { pick(items[sel]); e.preventDefault(); } else if (e.key === 'Escape') { box.classList.remove('on'); } });
  box.addEventListener('mousedown', e => { const it = e.target.closest('.it'); if (it) { pick(items[+it.dataset.i]); e.preventDefault(); } });
  input.addEventListener('blur', () => setTimeout(() => box.classList.remove('on'), 150));
  function pick(t) { box.classList.remove('on'); input.value = ''; items = []; input.blur(); onPick(t); }
}
const rkb = t => t.poll?.ap ? `<span class="rkb" title="AP Top 25">${t.poll.ap}</span>` : '';
const confOpts = (all = 'All conferences') => `<option value="">${all}</option>` + Object.entries(CONF).filter(([k]) => T.some(t => t.conf === k)).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

// ---------- routing ----------
function go(h) { if (location.hash !== h) location.hash = h; else route(); }
function showTab(t) { TAB = t; $$('.tab').forEach(s => s.hidden = s.id !== 'tab-' + t); $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === t)); }
function route() {
  const h = decodeURIComponent(location.hash.slice(1)); const [tab, arg] = (h || 'teams').split('=');
  const t = ['teams', 'team', 'compare', 'path', 'charts', 'glossary'].includes(tab) ? tab : 'teams';
  showTab(t);
  if (t === 'teams') drawTable();
  if (t === 'team') renderTeam(arg ? resolve(arg) : null);
  if (t === 'compare') { if (arg) cmpIds = arg.split(',').map(resolve).filter(Boolean).map(x => x.id).slice(0, 4); renderCompare(); }
  if (t === 'path') drawPath();
  if (t === 'charts') { drawScatter(); drawLeaders(); }
  window.scrollTo(0, 0);
}

// ---------- teams table ----------
const VIEWS = {
  ratings: ['fpi', 'fpi_off', 'fpi_def', 'fpi_st', 'sp', 'sp_off', 'sp_def', 'sp_st', 'eff'],
  resume: ['fpi', 'sor', 'sos', 'remsos', 'gc', 'projw', 'playoff', 'winconf', 'tough', 'avg_ork', 't25'],
  offense: ['ppg', 'ypg', 'ypp', 'pass_ypg', 'rush_ypg', 'ypc', 'pass_eff', 'third_pct', 'rz_pct', 'sacks_allowed_pg'],
  defense: ['opp_ppg', 'opp_ypg', 'opp_ypp', 'opp_pass_ypg', 'opp_rush_ypg', 'opp_ypc', 'opp_pass_eff', 'opp_third_pct', 'opp_rz_pct', 'sacks', 'tfl_pg'],
  misc: ['margin_pg', 'to_margin', 'takeaways', 'giveaways', 'fourth_pct', 'pen_pg', 'pen_yds_pg', 'top', 'net_punt'],
};
const SHORT = {fpi: 'FPI', fpi_off: 'Off', fpi_def: 'Def', fpi_st: 'ST', sp: 'SP+', sp_off: 'SP+ Off', sp_def: 'SP+ Def', sp_st: 'SP+ ST', eff: 'Eff.', sor: 'SOR rk', sos: 'SOS rk', remsos: 'Rem. SOS rk', gc: 'Game ctrl rk', projw: 'Proj W', playoff: 'CFP %', winconf: 'Conf %', tough: 'Path so far', avg_ork: 'Avg opp FPI rk', t25: 'Top-25 opp',
  ppg: 'PPG', ypg: 'YPG', ypp: 'Y/Play', pass_ypg: 'Pass YPG', rush_ypg: 'Rush YPG', ypc: 'Y/Carry', pass_eff: 'Pass eff', third_pct: '3rd %', rz_pct: 'RZ %', sacks_allowed_pg: 'Sacks allowed/g',
  opp_ppg: 'Opp PPG', opp_ypg: 'Opp YPG', opp_ypp: 'Opp Y/Play', opp_pass_ypg: 'Opp Pass YPG', opp_rush_ypg: 'Opp Rush YPG', opp_ypc: 'Opp Y/Carry', opp_pass_eff: 'Opp pass eff', opp_third_pct: 'Opp 3rd %', opp_rz_pct: 'Opp RZ %', sacks: 'Sacks', tfl_pg: 'TFL/g',
  margin_pg: 'Margin/g', to_margin: 'TO margin', takeaways: 'Takeaways', giveaways: 'Giveaways', fourth_pct: '4th %', pen_pg: 'Pen/g', pen_yds_pg: 'Pen yds/g', top: 'TOP', net_punt: 'Net punt'};
let tbSort = 'fpi', tbAsc = false;
function filtered(conf, rank, q) {
  return T.filter(t => (!conf || t.conf === conf) && (!rank || (rank === 'ap' ? t.poll?.ap : rank === 'unr' ? !t.poll?.ap : (t.fpi?.rk || 999) <= 25)) && (!q || t._n.includes(norm(q))));
}
function cellVal(k, t) { const v = mval(k, t), r = mrk(k, t), m = MK[k];
  if (v == null) return '<span class="muted">—</span>';
  const rkHtml = r != null && m.f !== 'rk' ? `<span class="rk" style="color:${pctColor(pctOf(r))}">${r}</span>` : '';
  return `${fmt(m.f, v)}${rkHtml}`; }
function drawTable() {
  const view = $('#tb-view').value, conf = $('#tb-conf').value, rank = $('#tb-rank').value, q = $('#tb-q').value;
  const cols = VIEWS[view]; if (!cols.includes(tbSort) && !['team', 'rec', 'ap'].includes(tbSort)) { tbSort = cols[0]; tbAsc = MK[tbSort].hb === 0; }
  const rows = filtered(conf, rank, q);
  const key = tbSort === 'team' ? t => t.loc : tbSort === 'rec' ? t => winPct(t.rec.o) : tbSort === 'ap' ? t => t.poll?.ap ?? 99 : t => mval(tbSort, t);
  rows.sort((a, b) => { const x = key(a), y = key(b); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (tbAsc ? 1 : -1); });
  $('#tb-note').innerHTML = `${rows.length} teams. Small colored numbers are FBS ranks (green = best). Click a header to sort, a row to open the team. ${view === 'ratings' ? 'FPI and its components are in points vs an average FBS team; SP+ offense/defense are points per game equivalents (defense: lower is better).' : view === 'resume' ? 'SOR/SOS/game control ranks are ESPN\'s; "Path so far" is this site\'s average site-adjusted opponent FPI (see Glossary).' : 'Stats: NCAA.com official FBS team statistics; ranks among all ' + N + ' FBS teams.'}`;
  const th = (k, l, cls = '') => `<th data-k="${k}" class="${cls} ${k === tbSort ? 'sorted' + (tbAsc ? ' asc' : '') : ''}" title="${MK[k]?.l || l}">${l}</th>`;
  $('#tb thead').innerHTML = `<tr><th class="l">#</th>${th('team', 'Team', 'l')}${th('rec', 'W-L')}<th>Conf</th>${th('ap', 'AP')}${cols.map(k => th(k, SHORT[k] || k)).join('')}</tr>`;
  $('#tb tbody').innerHTML = rows.map((t, i) => `<tr data-id="${t.id}"><td class="l muted">${i + 1}</td><td class="l"><div class="pn"><img loading="lazy" src="${logo(t)}" alt="" class="tl">${rkb(t)}<b>${t.loc}</b> <span class="muted small">${CONF[t.conf] || ''}</span></div></td><td>${t.rec.o}</td><td class="muted">${t.conf === 'ind' ? '—' : t.rec.c}</td><td>${t.poll?.ap ?? '<span class="muted">—</span>'}</td>${cols.map(k => `<td>${cellVal(k, t)}</td>`).join('')}</tr>`).join('');
  $$('#tb th[data-k]').forEach(h => h.onclick = () => { const k = h.dataset.k; if (tbSort === k) tbAsc = !tbAsc; else { tbSort = k; tbAsc = k === 'team' || k === 'ap' || MK[k]?.hb === 0; } drawTable(); });
}
const winPct = r => { const m = /(\d+)-(\d+)/.exec(r || ''); return m ? (+m[1] + 0.001 * +m[1]) / (+m[1] + +m[2] || 1) : 0; };
function quick() {
  const top = (k, rev) => [...T].filter(t => mval(k, t) != null).sort((a, b) => (mval(k, b) - mval(k, a)) * (rev ? -1 : 1))[0];
  const cards = [['fpi', 'Top FPI'], ['fpi_off', 'Best FPI offense'], ['fpi_def', 'Best FPI defense'], ['sp', 'Top SP+'], ['tough', 'Toughest path so far'], ['ppg', 'Most points / game']];
  $('#quick').innerHTML = cards.map(([k, l]) => { const t = top(k); return `<div class="qc" data-id="${t.id}"><img src="${logo(t)}" alt="" style="border-radius:8px;object-fit:contain;background:transparent"><div><div class="l">${l}</div><div class="n">${t.loc}</div></div><div class="v" style="margin-left:auto">${fmt(MK[k].f, mval(k, t))}</div></div>`; }).join('');
}

// ---------- team page ----------
const DIFF_CLS = {Elite: 'd5', 'Very hard': 'd4', Hard: 'd3', Medium: 'd2', Easy: 'd1', 'Very easy': 'd0', FCS: 'd0'};
function tile(k, t, opts = {}) { const m = MK[k], v = mval(k, t), r = mrk(k, t), p = mpct(k, t);
  return `<div class="sg"><div class="l"><span>${opts.label || m.l}</span></div><div class="v">${fmt(m.f, v)}</div><div class="rk">${r != null ? `<b>#${r}</b> of ${N} FBS` : '&nbsp;'}${p != null && m.f !== 'rk' ? ` · ${ord(p)} pct` : ''}</div>${p != null ? `<div class="bar"><i style="width:${p}%;background:${pctColor(p)}"></i></div>` : ''}</div>`; }
function renderTeam(t) {
  if (!t) { $('#tcard').innerHTML = `<div class="card"><p class="muted">Search for any FBS team above, or click one in the Teams table.</p><div class="quick">${T.slice(0, 8).map(t => `<div class="qc" onclick="location.hash='#team=${t._slug}'"><img src="${logo(t)}" style="border-radius:8px;object-fit:contain;background:transparent"><div><div class="l">FPI #${t.fpi?.rk} · ${t.rec.o}</div><div class="n">${t.display}</div></div></div>`).join('')}</div></div>`; return; }
  const f = t.fpi || {}, p = t.path, sp = t.sp;
  const fmtDate = d => new Date(d).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'America/New_York'});
  const fmtTime = d => new Date(d).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'}) + ' ET';
  const sched = t.sched.map(g => { const o = BY[g.o];
    const site = g.ha === 'h' ? 'vs' : g.ha === 'a' ? '@' : 'vs*';
    const res = g.canc ? '<span class="muted">Canceled</span>' : g.done ? `<b class="${g.res === 'W' ? 'good' : 'bad'}">${g.res}</b> ${g.us}–${g.them}` : `<span class="muted">${g.tbd ? 'Time TBA' : fmtTime(g.d)}</span>`;
    const opp = o ? `<a href="#team=${o._slug}" class="pn"><img src="${logo(o)}" class="tl" alt="">${g.orank ? `<span class="rkb" title="AP rank at game time">${g.orank}</span>` : ''}<b>${o.loc}</b></a>` : `<span class="pn"><img src="${logoId(g.o)}" class="tl" onerror="this.src='${PH}'" alt="">${g.os || g.on} <span class="tag">FCS</span></span>`;
    return `<tr class="${g.done ? '' : 'up'}"><td class="l muted">${g.st === 3 ? 'Post' : g.wk ?? ''}</td><td class="l">${fmtDate(g.d)}</td><td class="l muted">${site}</td><td class="l">${opp}${g.cg ? ' <span class="tag">conf</span>' : ''}${g.note ? ` <span class="tag">${g.note}</span>` : ''}</td>
      <td>${o ? o.rec.o : '—'}</td><td>${o ? '#' + o.fpi.rk : '—'}</td><td>${o ? fmt('sgn1', o.fpi.fpi) : '—'}</td><td>${o ? '#' + o.fpi.offrk : '—'}</td><td>${o ? '#' + o.fpi.dfnrk : '—'}</td>
      <td><span class="diff ${DIFF_CLS[g.diff]}" title="Site-adjusted opponent FPI ${fmt('sgn1', g.adj)} ≈ the #${g.erk} FBS team">${g.diff}</span></td><td class="l">${res}</td></tr>`; }).join('');
  const cats = {}; D.meta.stats.forEach(s => (cats[s.c] ??= []).push(s.k));
  const v25 = p.v25, v50 = p.v50;
  $('#tcard').innerHTML = `<div class="card team-hero" style="--tc:#${t.color || '333'};--ta:#${t.alt || '555'}">
    <div class="pc-head"><img src="${logo(t)}" alt="" class="tlogo"><div style="flex:1;min-width:220px"><h1>${t.poll?.ap ? `<span class="rkb big">${t.poll.ap}</span>` : ''}${t.display}</h1>
      <div class="pills"><span class="pill"><b>${t.rec.o}</b> overall</span>${t.conf === 'ind' ? '<span class="pill">FBS Independent</span>' : `<span class="pill"><b>${t.rec.c}</b> ${CONF[t.conf] || t.conf}</span>`}<span class="pill">Home ${t.rec.h} · Away ${t.rec.a}</span><span class="pill">Streak <b>${t.rec.stk || '—'}</b></span>
        <span class="pill">AP <b>${t.poll?.ap ?? 'NR'}</b> · Coaches <b>${t.poll?.coaches ?? 'NR'}</b>${t.poll?.cfp ? ` · CFP <b>${t.poll.cfp}</b>` : ''}</span><span class="pill">FPI <b>#${f.rk}</b>${f.chg ? ` (${f.chg > 0 ? '▲' : '▼'}${Math.abs(f.chg)})` : ''}</span>${sp ? `<span class="pill">SP+ <b>#${sp.rk}</b></span>` : ''}<span class="pill">Points ${t.rec.pf ?? '—'}–${t.rec.pa ?? '—'}</span></div></div>
      <div class="ctrls"><button class="btn" id="tc-cmp">Compare ⇄</button><a class="btn ghost" target="_blank" rel="noopener" href="https://www.espn.com/college-football/team/_/id/${t.id}">ESPN ↗</a></div></div></div>
    <div class="grid2">
      <div class="card"><div class="card-head"><h2>Ratings</h2><span class="muted small">FPI ${shortDate(D.meta.fpi_updated)}${D.meta.sp ? ' · SP+ ' + shortDate(D.meta.sp.modified || D.meta.sp.published) : ''}</span></div>
        <div class="statgrid s2">${['fpi', 'fpi_off', 'fpi_def', 'fpi_st'].map(k => tile(k, t)).join('')}</div>
        <div class="cat-h">SP+</div><div class="statgrid s2">${sp ? ['sp', 'sp_off', 'sp_def', 'sp_st'].map(k => tile(k, t)).join('') : '<p class="muted">Not in SP+ table.</p>'}</div>
        <div class="cat-h">FPI efficiencies (0–100)</div><div class="statgrid s2">${['eff', 'offeff', 'defeff', 'steff'].map(k => tile(k, t)).join('')}</div></div>
      <div class="card"><div class="card-head"><h2>Résumé &amp; outlook</h2><span class="muted small">ESPN FPI</span></div>
        <div class="statgrid s2">${['sor', 'sos', 'remsos', 'gc'].map(k => tile(k, t)).join('')}</div>
        <div class="cat-h">Projections</div>
        <div class="facts"><div><span>Projected record</span><b>${fmt('f1', f.projw)}–${fmt('f1', f.projl)}</b></div><div><span>Make CFP</span><b>${fmt('p0', f.playoff)}</b></div><div><span>Win conference</span><b>${fmt('p0', f.winconf)}</b></div><div><span>Win out</span><b>${fmt('p0', f.winout)}</b></div><div><span>Win national title</span><b>${fmt('p0', f.title)}</b></div><div><span>6+ wins</span><b>${fmt('p0', f.six)}</b></div></div>
        <div class="cat-h">Path difficulty</div>
        <div class="path">
          <div><span>Avg opponent FPI rank</span><b>${fmt('f1', p.avg_ork)}</b><em>played</em><b>${fmt('f1', p.avg_ork_rem)}</b><em>remaining</em></div>
          <div><span>Avg site-adjusted opp. FPI</span><b>${fmt('sgn1', p.avg_ofpi)}</b><em>#${p.tough_rk} toughest</em><b>${fmt('sgn1', p.avg_ofpi_rem)}</b><em>${p.tough_rem_rk ? '#' + p.tough_rem_rk + ' toughest' : '—'}</em></div>
          <div><span>FPI top-25 opponents</span><b>${p.t25}</b><em>faced</em><b>${p.t25_rem}</b><em>left</em></div>
          <div><span>Record vs FPI top 25 / top 50</span><b>${v25[0]}–${v25[1]}</b><em>top 25</em><b>${v50[0]}–${v50[1]}</b><em>top 50</em></div>
          <div><span>FCS opponents</span><b>${p.fcs}</b><em>played</em><b>${p.fcs_rem}</b><em>left</em></div>
          <div><span>ESPN SOS rank</span><b>${ord(f.sosrk)}</b><em>played</em><b>${ord(f.remsosrk)}</b><em>remaining</em></div>
        </div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Full schedule</h2><span class="muted small">Opponent ranks are current (FPI ${shortDate(D.meta.fpi_updated)}); the badge by a name is the AP rank at game time. vs* = neutral site. Times ET.</span></div>
      <div class="table-wrap nomax"><table class="tbl sched"><thead><tr><th class="l">Wk</th><th class="l">Date</th><th class="l"></th><th class="l">Opponent</th><th>Opp W-L</th><th>Opp FPI rk</th><th>Opp FPI</th><th>Opp off rk</th><th>Opp def rk</th><th>Difficulty</th><th class="l">Result</th></tr></thead><tbody>${sched}</tbody></table></div></div>
    <div class="card"><div class="card-head"><h2>Team stats &amp; FBS ranks</h2><span class="muted small">NCAA.com official statistics · ${t.s?.g_ncaa ?? t.g} games</span></div>
      ${Object.entries(cats).map(([c, ks]) => `<div class="cat-h">${c}</div><div class="statgrid">${ks.map(k => tile(k, t)).join('')}</div>`).join('')}</div>`;
  $('#tc-cmp').onclick = () => { cmpIds = [t.id]; go('#compare=' + t._slug); };
}

// ---------- compare ----------
let cmpIds = [];
const RADAR = ['fpi_off', 'fpi_def', 'fpi_st', 'ppg', 'opp_ppg', 'ypp', 'opp_ypp', 'third_pct', 'to_margin', 'sos'];
const RLAB = {fpi_off: 'FPI off', fpi_def: 'FPI def', fpi_st: 'FPI ST', ppg: 'Pts/g', opp_ppg: 'Pts allowed', ypp: 'Yds/play', opp_ypp: 'Yds/play allowed', third_pct: '3rd down %', to_margin: 'TO margin', sos: 'SOS played'};
const CMP_ROWS = ['fpi', 'fpi_off', 'fpi_def', 'fpi_st', 'eff', 'sp', 'sp_off', 'sp_def', 'sp_st', 'sor', 'sos', 'remsos', 'gc', 'projw', 'playoff', 'winconf', 'tough', 'tough_rem', 'avg_ork', 't25'];
function cmpHash() { return '#compare=' + cmpIds.map(id => BY[id]._slug).join(','); }
function renderCompare() {
  const ts = cmpIds.map(id => BY[id]).filter(Boolean);
  const slots = [0, 1, 2, 3].map(i => { const t = ts[i];
    if (t) return `<div class="slot filled" style="--c:${COLORS[i]}"><button class="x" data-i="${i}" aria-label="Remove">✕</button><div class="who"><img src="${logo(t)}" style="border-radius:8px;object-fit:contain;background:transparent"><div><div class="nm"><span class="dot"></span>${t.poll?.ap ? t.poll.ap + ' ' : ''}${t.loc}</div><div class="sub">${t.rec.o} · ${CONF[t.conf] || ''} · FPI #${t.fpi?.rk}</div></div></div></div>`;
    if (i > ts.length) return `<div class="slot"></div>`;
    return `<div class="slot"><div class="search"><input id="cs${i}" type="search" placeholder="${i < 2 ? 'Add a team…' : 'Add another (optional)…'}" autocomplete="off"><div class="ta" id="cs${i}-ta"></div></div></div>`; }).join('');
  $('#cmp-pick').innerHTML = slots;
  $$('#cmp-pick .x').forEach(b => b.onclick = () => { cmpIds.splice(+b.dataset.i, 1); history.replaceState(null, '', cmpIds.length ? cmpHash() : '#compare'); renderCompare(); });
  const inp = $(`#cs${ts.length}`); if (inp) typeahead(inp, $(`#cs${ts.length}-ta`), t => { if (!cmpIds.includes(t.id)) cmpIds.push(t.id); history.replaceState(null, '', cmpHash()); renderCompare(); });
  if (ts.length < 2) { $('#cmp-table').innerHTML = '<p class="muted">Pick at least two teams. Try <a href="#compare=miami,notre-dame">Miami vs Notre Dame</a> or <a href="#compare=georgia,ohio-state,indiana">Georgia vs Ohio State vs Indiana</a>.</p>'; $('#cmp-score').innerHTML = ''; if (charts.radar) { charts.radar.destroy(); charts.radar = null; } return; }
  const rows = CMP_ROWS.concat(D.meta.stats.map(s => s.k)); let lastCat = null; const wins = ts.map(() => 0); let counted = 0;
  const body = rows.map(k => { const m = MK[k]; const vals = ts.map(t => mval(k, t)); let best = null;
    if (m.hb != null && vals.filter(v => v != null).length >= 2) { const good = vals.map(v => v == null ? null : (m.hb ? v : -v)); const mx = Math.max(...good.filter(v => v != null)); const idx = good.map((v, i) => v === mx ? i : -1).filter(i => i >= 0); if (idx.length === 1) { best = idx[0]; wins[best]++; } counted++; }
    const cat = m.c !== lastCat ? `<tr class="cat"><td colspan="${ts.length + 1}">${m.c}</td></tr>` : ''; lastCat = m.c;
    return cat + `<tr><td>${m.l}</td>${ts.map((t, i) => { const r = mrk(k, t); return `<td class="${best === i ? 'win' : ''}"><span class="v">${fmt(m.f, vals[i])}</span>${r != null && m.f !== 'rk' ? `<span class="rk">#${r} FBS</span>` : ''}</td>`; }).join('')}</tr>`; }).join('');
  $('#cmp-table').innerHTML = `<div class="table-wrap nomax"><table class="cmp-tbl"><thead><tr><th>Metric</th>${ts.map((t, i) => `<th style="color:${COLORS[i]}"><a href="#team=${t._slug}" style="color:inherit;text-decoration:none">${t.loc}</a><div class="muted small">${t.rec.o} · ${t.rec.c} conf</div></th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  $('#cmp-score').innerHTML = ts.map((t, i) => `<div class="hh"><div class="hh-n" style="color:${COLORS[i]}"><img src="${logo(t)}" alt="">${t.loc}</div><div class="hh-bar"><i style="width:${Math.round(100 * wins[i] / Math.max(1, counted))}%;background:${COLORS[i]}"></i></div><div class="hh-v"><b>${wins[i]}</b> / ${counted}</div></div>`).join('') +
    `<p class="note" style="margin-top:12px">Rows won among the ${counted} ratings and stats where at least two teams have a value and there's a clear better direction (ties count for no one). Volume-free metrics only: every stat is per game, a rate or a rank.</p>
     <div class="facts">${ts.map((t, i) => `<div><span style="color:${COLORS[i]}">${t.loc}: path so far</span><b>#${t.path.tough_rk}</b></div>`).join('')}</div>`;
  if (charts.radar) charts.radar.destroy();
  charts.radar = new Chart($('#cmp-radar'), {type: 'radar', data: {labels: RADAR.map(k => RLAB[k]), datasets: ts.map((t, i) => ({label: t.loc, data: RADAR.map(k => mpct(k, t) ?? 0), borderColor: COLORS[i], backgroundColor: COLORS[i] + '22', pointBackgroundColor: COLORS[i], borderWidth: 2}))},
    options: {maintainAspectRatio: false, scales: {r: {min: 0, max: 100, ticks: {display: false, stepSize: 25}, grid: {color: '#26314a'}, angleLines: {color: '#26314a'}, pointLabels: {color: '#b8c3d9', font: {size: 11}}}}, plugins: {legend: {labels: {color: '#eaf0fa'}}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${ord(Math.round(c.raw))} pct`}}}}});
}

// ---------- toughest path ----------
let ptSort = 'tough', ptAsc = false;
function drawPath() {
  const conf = $('#pt-conf').value, q = $('#pt-q').value;
  const rows = filtered(conf, '', q);
  const cols = [['tough', 'Avg opp FPI (adj.)', t => t.path.avg_ofpi, 'sgn1'], ['avg_ork', 'Avg opp FPI rk', t => t.path.avg_ork, 'f1'], ['t25', 'FPI top-25 faced', t => t.path.t25, 'int'],
    ['v25', 'vs top 25', t => t.path.v25[0] + t.path.v25[1] ? t.path.v25[0] / (t.path.v25[0] + t.path.v25[1]) : null, 'rec25'], ['v50', 'vs top 50', t => t.path.v50[0] + t.path.v50[1] ? t.path.v50[0] / (t.path.v50[0] + t.path.v50[1]) : null, 'rec50'],
    ['fcs', 'FCS games', t => t.path.fcs, 'int'], ['sos', 'ESPN SOS rk', t => t.fpi?.sosrk, 'int'], ['tough_rem', 'Remaining: avg opp FPI', t => t.path.avg_ofpi_rem, 'sgn1'], ['remsos', 'ESPN rem. SOS rk', t => t.fpi?.remsosrk, 'int'], ['fpi', 'Own FPI rk', t => t.fpi?.rk, 'int']];
  const c = cols.find(x => x[0] === ptSort) || cols[0];
  rows.sort((a, b) => { const x = c[2](a), y = c[2](b); if (x == null) return 1; if (y == null) return -1; return (x - y) * (ptAsc ? 1 : -1); });
  $('#pt-note').innerHTML = `Ranked by the average FPI of opponents already played, adjusted ±${D.meta.hfa} points for home/road (FCS opponents count as the lowest-rated FBS team, FPI ${fmt('sgn1', D.meta.fcs_floor)}). ESPN's own SOS rank (from the view of an average Top 25 team) is shown alongside. Click headers to sort.`;
  $('#pt thead').innerHTML = `<tr><th class="l">#</th><th class="l">Team</th><th>W-L</th>${cols.map(([k, l]) => `<th data-k="${k}" class="${k === ptSort ? 'sorted' + (ptAsc ? ' asc' : '') : ''}">${l}</th>`).join('')}</tr>`;
  $('#pt tbody').innerHTML = rows.map((t, i) => `<tr data-id="${t.id}"><td class="l muted">${i + 1}</td><td class="l"><div class="pn"><img src="${logo(t)}" class="tl" alt="">${rkb(t)}<b>${t.loc}</b> <span class="muted small">${CONF[t.conf]}</span></div></td><td>${t.rec.o}</td>${cols.map(([k, , g, f]) => { const v = g(t);
    if (f === 'rec25') return `<td>${t.path.v25.join('–')}</td>`; if (f === 'rec50') return `<td>${t.path.v50.join('–')}</td>`; return `<td>${v == null ? '—' : fmt(f, v)}</td>`; }).join('')}</tr>`).join('');
  $$('#pt th[data-k]').forEach(h => h.onclick = () => { const k = h.dataset.k; if (ptSort === k) ptAsc = !ptAsc; else { ptSort = k; ptAsc = ['avg_ork', 'sos', 'remsos', 'fpi', 'fcs'].includes(k); } drawPath(); });
}

// ---------- charts ----------
const imgCache = {};
let scRedraw = null;
function logoImg(t, size) {
  const k = t.id + ':' + size;
  if (!imgCache[k]) {
    const im = new Image(size, size);
    im.onload = () => { clearTimeout(scRedraw); scRedraw = setTimeout(() => charts.sc && charts.sc.update('none'), 60); };
    im.onerror = () => { if (!im.dataset.fb) { im.dataset.fb = 1; im.src = t.logo || PH; } };
    im.src = logo(t); imgCache[k] = im;
  }
  return imgCache[k];
}
function drawScatter() {
  const conf = $('#sc-conf').value, sys = $('#sc-sys').value;
  const pick = {fpi: [t => t.fpi?.off, t => t.fpi?.dfn, 'FPI offense (pts vs avg)', 'FPI defense (pts vs avg)'], sp: [t => t.sp?.o, t => t.sp?.d, 'SP+ offense', 'SP+ defense (lower = better)'], stats: [t => t.s?.ypp, t => t.s?.opp_ypp, 'Yards per play', 'Yards per play allowed']}[sys];
  const ts = T.filter(t => (!conf || t.conf === conf) && pick[0](t) != null && pick[1](t) != null);
  const size = conf ? 34 : 24;
  $('#sc-note').innerHTML = `${ts.length} teams. Up and right = better on both sides${sys !== 'fpi' ? ' (defense axis flipped so up is better)' : ''}. Hover for details; click a logo to open the team.`;
  if (charts.sc) charts.sc.destroy();
  const rev = sys !== 'fpi';
  charts.sc = new Chart($('#sc-chart'), {type: 'scatter', data: {datasets: [{data: ts.map(t => ({x: pick[0](t), y: pick[1](t), t})), pointStyle: ts.map(t => logoImg(t, size)), pointRadius: size / 2, pointHoverRadius: size / 2 + 3}]},
    options: {maintainAspectRatio: false, animation: false, onClick: (e, els) => { if (els.length) go('#team=' + ts[els[0].index]._slug); },
      plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => { const t = c.raw.t; return `${t.loc} (${t.rec.o}) · ${pick[2]} ${c.raw.x.toFixed(1)} · ${pick[3]} ${c.raw.y.toFixed(1)}`; }}}},
      scales: {x: {title: {display: true, text: pick[2]}, grid: {color: '#1d2638'}}, y: {reverse: rev, title: {display: true, text: pick[3]}, grid: {color: '#1d2638'}}}}});
}
function drawLeaders() {
  const k = $('#ld-stat').value, conf = $('#ld-conf').value, n = +$('#ld-n').value, rev = $('#ld-rev').checked, m = MK[k];
  let ts = T.filter(t => (!conf || t.conf === conf) && mval(k, t) != null);
  const good = (a, b) => (m.hb === 0 ? mval(k, a) - mval(k, b) : mval(k, b) - mval(k, a));
  ts.sort(good); if (rev) ts.reverse(); ts = ts.slice(0, n);
  $('#ld-title').textContent = `${rev ? 'Bottom' : 'Top'} ${n}: ${m.l}`;
  $('#ld-note').textContent = `${m.c}. ${m.hb === 0 ? 'Lower is better.' : ''} Click a bar to open the team.`;
  $('#ld-box').style.height = Math.max(320, ts.length * 26 + 60) + 'px';
  if (charts.ld) charts.ld.destroy();
  charts.ld = new Chart($('#ld-chart'), {type: 'bar', data: {labels: ts.map(t => (t.poll?.ap ? `#${t.poll.ap} ` : '') + t.loc), datasets: [{data: ts.map(t => mval(k, t)), backgroundColor: ts.map(t => '#' + (t.color && t.color !== '000000' ? t.color : '3aa0ff')), borderRadius: 6}]},
    options: {indexAxis: 'y', maintainAspectRatio: false, onClick: (e, els) => { if (els.length) go('#team=' + ts[els[0].index]._slug); }, plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${fmt(m.f, c.raw)} · ${ts[c.dataIndex].rec.o}`}}},
      scales: {x: {grid: {color: '#1d2638'}}, y: {grid: {display: false}, ticks: {color: '#dfe6f3'}}}}});
}

// ---------- glossary / footer ----------
function glossary() { const m = D.meta;
  $('#gl-ratings').innerHTML = `<p><b>FPI (Football Power Index, ESPN Analytics)</b> is ESPN's predictive rating: how many points better or worse a team is than an average FBS team on a neutral field. It's built from schedule-adjusted per-play efficiency on offense, defense and special teams, plus recruiting, returning production and coaching tenure early in the year. The <b>offense / defense / special teams</b> columns are ESPN's FPI components (points each unit adds); for defense, higher is better. Ranks for the components are computed here among the ${N} FBS teams. The <b>efficiencies</b> are ESPN's separate 0–100 per-play ratings. Source: <a href="${m.sources.fpi}" target="_blank" rel="noopener">ESPN FPI</a> (updated ${shortDate(m.fpi_updated)}).</p>
  <p><b>SP+ (Bill Connelly, ESPN)</b> is a tempo- and opponent-adjusted efficiency rating that's predictive, not a résumé. The overall rating is points better than average; <b>offense</b> and <b>defense</b> are points-per-game-style figures (for defense, <b>lower is better</b>); special teams adds a small amount. Source: <a href="${m.sp?.url}" target="_blank" rel="noopener">${m.sp?.title || 'ESPN SP+ rankings'}</a>${m.sp?.modified ? ` (updated ${shortDate(m.sp.modified)})` : ''}. SP+ comes from ESPN's article because the CollegeFootballData.com API requires a key.</p>
  <p><b>Strength of schedule (SOS, ESPN)</b>: the rank of how hard a team's schedule has been, from the view of an average Top 25 team (games played), and of its remaining games from the view of an average FBS team. <b>Strength of record (SOR)</b>: the chance an average Top 25 team would have this record or better against this schedule; it rewards wins, not margins. <b>Game control</b>: how consistently a team controlled games from start to finish (in-game win probability), adjusted for schedule. <b>Projections</b> (projected W-L, CFP chance, win conference, win out) come from ESPN's season simulations using FPI.</p>
  <p><b>Polls</b>: ${Object.values(m.polls).map(p => `${p.name} (${p.week || ''}, ${shortDate(p.date)})`).join('; ')}. ${m.polls.cfp ? '' : 'The first College Football Playoff committee rankings of 2026 hadn\'t been released as of this build, so the CFP column will fill in once they are.'}</p>`;
  $('#gl-path').innerHTML = `<p>For each game, the opponent's current FPI is adjusted by a ${m.hfa}-point home-field factor: +${m.hfa} when on the road, −${m.hfa} at home, 0 at neutral sites. The result is mapped to the FBS team with that FPI ("equivalent rank"), which gives the difficulty label: <b>Elite</b> (like a top-10 team), <b>Very hard</b> (11–25), <b>Hard</b> (26–50), <b>Medium</b> (51–85), <b>Easy</b> (86–115), <b>Very easy</b> (116+). FCS opponents have no FPI, so they're labeled FCS and count as the lowest-rated FBS team (FPI ${fmt('sgn1', m.fcs_floor)}) in averages, and as rank ${N + 1} in average-opponent-rank figures.</p>
  <p><b>Toughest path so far</b> ranks teams by the average adjusted opponent FPI of games already played. It uses current FPI, so an opponent's rating today (not on game day) defines how hard the game was. <b>Record vs FPI top 25 / top 50</b> uses current FPI ranks. ESPN's SOS rank is shown next to it; it's computed differently (from a Top 25 team's perspective), so the two can disagree. The ${m.hfa}-point home edge is a common rule of thumb, not an ESPN figure.</p>`;
  $('#gl-stats').innerHTML = `<p class="note">Team stats are NCAA.com's official FBS team statistics (all games, including against FCS opponents), ranked here among all ${N} FBS teams. Point margin per game is computed from ESPN final scores (regular season).</p><div class="gl">${D.meta.stats.map(s => `<div><b>${s.l}</b><span class="muted">${s.c}. ${s.hb === 0 ? 'Lower is better.' : s.hb == null ? 'Not ranked.' : 'Higher is better.'}</span></div>`).join('')}</div>`;
}
function footer() { const m = D.meta;
  $('#footer').innerHTML = `<p><b>Data through games of ${throughDate()}, ${m.season}</b> (last final game). FPI updated ${shortDate(m.fpi_updated)}; SP+ ${m.sp ? shortDate(m.sp.modified || m.sp.published) : 'n/a'}; ${Object.values(m.polls).map(p => p.name + ' ' + (p.week || '')).join(', ')}. Built ${m.built.replace('T', ' ').slice(0, 16)} UTC. ${N} FBS teams.</p>
  <p><b>Sources:</b> <a href="${m.sources.fpi}">ESPN FPI</a> (power index API), <a href="${m.sources.standings}">ESPN standings &amp; schedules</a>, <a href="${m.sources.polls}">AP &amp; Coaches polls</a>, <a href="${m.sources.ncaa}">NCAA.com official team statistics</a>, <a href="${m.sp?.url}">SP+ by Bill Connelly (ESPN)</a>. Logos © their schools. Not affiliated with ESPN, the NCAA or CFBD. <a href="https://github.com/Coleslaw510/cfb-team-hub">Source &amp; refresh script</a>.</p>`; }

// ---------- init ----------
(async () => {
  Chart.defaults.font.family = 'Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif'; Chart.defaults.color = '#8b97ad';
  await load();
  ['#tb-conf', '#pt-conf', '#sc-conf', '#ld-conf'].forEach(s => $(s).innerHTML = confOpts());
  $('#ld-stat').innerHTML = [...new Set(METRICS.map(m => m.c))].map(c => `<optgroup label="${c}">${METRICS.filter(m => m.c === c && m.hb != null).map(m => `<option value="${m.k}">${m.l}</option>`).join('')}</optgroup>`).join('');
  $('#ld-stat').value = 'fpi';
  quick(); glossary(); footer();
  typeahead($('#gsearch'), $('#gsearch-ta'), t => go('#team=' + t._slug));
  typeahead($('#tsearch'), $('#tsearch-ta'), t => go('#team=' + t._slug));
  ['#tb-view', '#tb-conf', '#tb-rank'].forEach(s => $(s).onchange = drawTable); $('#tb-q').oninput = drawTable;
  $('#tb tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) go('#team=' + BY[tr.dataset.id]._slug); };
  $('#pt tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) go('#team=' + BY[tr.dataset.id]._slug); };
  $('#pt-conf').onchange = drawPath; $('#pt-q').oninput = drawPath;
  ['#sc-conf', '#sc-sys'].forEach(s => $(s).onchange = drawScatter);
  ['#ld-stat', '#ld-conf', '#ld-n', '#ld-rev'].forEach(s => $(s).onchange = drawLeaders);
  $('#quick').onclick = e => { const c = e.target.closest('.qc'); if (c) go('#team=' + BY[c.dataset.id]._slug); };
  $('#cmp-share').onclick = () => { const u = location.origin + location.pathname + cmpHash(); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('Share link copied'), () => toast(u)); };
  window.addEventListener('hashchange', route);
  route();
})();
})();
