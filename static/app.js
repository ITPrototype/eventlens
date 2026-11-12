(() => {
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fmtN = n => Number(n).toLocaleString('en-US').replace(/,/g, ' ');
const p2 = n => String(n).padStart(2, '0');
const store = {
  get(k, d) { try { const v = localStorage.getItem('ev.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ev.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const LV = {
  1: { n: 'Critical', c: 'C', k: 'crit' }, 2: { n: 'Error', c: 'E', k: 'err' }, 3: { n: 'Warning', c: 'W', k: 'warn' },
  4: { n: 'Information', c: 'I', k: 'info' }, 5: { n: 'Verbose', c: 'V', k: 'verb' },
};
const ALL = 'Application,System,Security';
const CHUNK = 250;

function fmtTime(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
function fmtShort(t, span) {
  const d = new Date(t);
  return span < 2 * 864e5 ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}h`;
}
function rel(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' d ago';
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 1600);
}

/* ---------- knowledge base: [id, source-substring, title, why, watch] ---------- */
const HINTS = [
  // System
  [41, 'kernel-power', 'Unexpected reboot', 'The system restarted without a clean shutdown: power loss, a crash (BSOD) or a hard reset. Look at nearby 6008 and BugCheck 1001.', 1],
  [6008, 'eventlog', 'Unexpected shutdown', 'The previous shutdown was not clean. Correlate with Kernel-Power 41 and BugCheck 1001.', 1],
  [1001, 'bugcheck', 'Blue screen (BugCheck)', 'Windows recovered from a bugcheck. Note the stop code; the dump is usually C:\\Windows\\MEMORY.DMP.', 1],
  [1001, 'systemerrorreporting', 'Blue screen (BugCheck)', 'Windows recovered from a bugcheck. Note the stop code; the dump is usually C:\\Windows\\MEMORY.DMP.', 1],
  [1074, 'user32', 'Restart / shutdown initiated', 'A user or process requested a restart or shutdown. The message tells who and why.', 1],
  [6005, 'eventlog', 'Boot marker', 'Event Log service started — logged on every boot.', 0],
  [6006, 'eventlog', 'Clean shutdown marker', 'Event Log service stopped cleanly.', 0],
  [6013, 'eventlog', 'System uptime', 'Periodic uptime report.', 0],
  [104, 'eventlog', 'Event log cleared', 'A log was cleared. Verify who did it and why.', 1],
  [7000, 'service control', 'Service failed to start', 'Check the service account, dependencies and the binary path.', 1],
  [7001, 'service control', 'Service dependency failed', 'A service this one depends on failed to start.', 1],
  [7009, 'service control', 'Service start timeout', 'The service did not answer within the timeout (default 30 s).', 1],
  [7011, 'service control', 'Service request timeout', 'The service did not respond to a control request in time.', 1],
  [7023, 'service control', 'Service terminated with error', 'The service stopped and reported an error.', 1],
  [7031, 'service control', 'Service crashed (recovery ran)', 'The service crashed and a recovery action was taken.', 1],
  [7034, 'service control', 'Service crashed', 'The service terminated unexpectedly.', 1],
  [7036, 'service control', 'Service state change', 'A service entered the running/stopped state. Very chatty — usually safe to exclude.', 0],
  [7040, 'service control', 'Service start type changed', 'Start type was changed (auto/manual/disabled). Check who changed it.', 1],
  [7045, 'service control', 'New service installed', 'Normal for installers, but also a common persistence technique. Check the binary path.', 1],
  [7, 'disk', 'Bad block on disk', 'The disk reported a bad block — an early sign of a failing drive.', 1],
  [11, 'disk', 'Disk controller error', 'Controller error: cable, controller or a failing drive.', 1],
  [15, 'disk', 'Disk not ready', 'The device was not ready for access.', 1],
  [51, 'disk', 'Paging error on disk', 'An error occurred during paging I/O: failing disk or controller.', 1],
  [153, 'disk', 'Disk I/O retried', 'I/O had to be retried — flaky disk, cable or driver.', 1],
  [55, 'ntfs', 'File system corruption', 'NTFS found corruption. Schedule chkdsk and check disk health.', 1],
  [129, 'stor', 'Storage device reset', 'A reset was issued to the storage device — timeouts or failing hardware.', 1],
  [219, 'kernel-pnp', 'Driver failed to load', 'A driver could not be loaded for a device.', 1],
  [4101, 'display', 'Display driver recovered', 'The display driver stopped responding and recovered (TDR).', 1],
  [10016, 'distributedcom', 'DCOM permission error', 'COM activation permission warning. Very common and usually harmless noise.', 0],
  [10010, 'distributedcom', 'DCOM server did not register', 'A COM server did not register in time.', 0],
  [5719, 'netlogon', 'No domain controller available', 'Secure channel to a DC could not be set up — check network and DNS.', 1],
  [1129, 'grouppolicy', 'Group Policy failed', 'GP processing failed, usually for lack of connectivity to a DC.', 1],
  [36887, 'schannel', 'TLS fatal alert received', 'A remote peer sent a TLS fatal alert (46 = certificate unknown).', 0],
  [36888, 'schannel', 'TLS fatal alert', 'A fatal alert was generated for the TLS session.', 0],
  [20, 'windowsupdate', 'Update install failed', 'A Windows update failed to install. See the error code in the message.', 1],
  [19, 'windowsupdate', 'Update installed', 'An update was installed successfully.', 0],
  [43, 'windowsupdate', 'Update install started', 'Windows started installing an update.', 0],
  // Application
  [1000, 'application error', 'Application crash', 'Faulting application and module are in the message; the exception code tells the type.', 1],
  [1002, 'application hang', 'Application hang', 'The program stopped responding and was closed.', 1],
  [1026, '.net runtime', '.NET unhandled exception', 'A .NET process crashed with an unhandled exception — see Exception Info.', 1],
  [1001, 'error reporting', 'Error report details', 'Windows Error Reporting detail for a crash.', 0],
  [11707, 'msiinstaller', 'Install completed', 'An MSI product was installed.', 0],
  [11724, 'msiinstaller', 'Removal completed', 'An MSI product was removed.', 0],
  [1116, 'defender', 'Malware detected', 'Microsoft Defender detected malware.', 1],
  [1117, 'defender', 'Malware action taken', 'Defender took action against malware.', 1],
  [5007, 'defender', 'Defender settings changed', 'A Defender configuration changed. Verify it was intended.', 1],
  [8193, 'vss', 'VSS error', 'Volume Shadow Copy error — backups and snapshots may be failing.', 1],
  // Security
  [4624, '', 'Logon success', 'Logon type: 2 interactive · 3 network · 4 batch · 5 service · 7 unlock · 10 RDP.', 0],
  [4625, '', 'Logon failed', 'Bad password or unknown user. Many from one IP in a short time = brute force.', 1],
  [4634, '', 'Logoff', 'An account logged off.', 0],
  [4648, '', 'Logon with explicit credentials', 'RunAs or a mapped drive with different credentials.', 0],
  [4672, '', 'Special privileges assigned', 'An admin-level logon.', 0],
  [4688, '', 'Process created', 'A new process started (needs process auditing).', 0],
  [4697, '', 'Service installed', 'A service was installed (Security log).', 1],
  [4698, '', 'Scheduled task created', 'A scheduled task was created. Check the action it runs.', 1],
  [4719, '', 'Audit policy changed', 'System audit policy was modified.', 1],
  [4720, '', 'User account created', 'A new local/domain account was created.', 1],
  [4722, '', 'User account enabled', 'An account was enabled.', 1],
  [4723, '', 'Password change attempt', 'A user tried to change a password.', 0],
  [4724, '', 'Password reset', 'Someone reset an account password.', 1],
  [4725, '', 'User account disabled', 'An account was disabled.', 1],
  [4726, '', 'User account deleted', 'An account was deleted.', 1],
  [4728, '', 'Added to global group', 'A member was added to a security-enabled global group.', 1],
  [4732, '', 'Added to local group', 'A member was added to a local group — check whether it is Administrators.', 1],
  [4740, '', 'Account locked out', 'An account was locked out by repeated bad passwords.', 1],
  [4768, '', 'Kerberos TGT requested', 'A Kerberos ticket-granting ticket was requested.', 0],
  [4769, '', 'Kerberos service ticket', 'A Kerberos service ticket was requested.', 0],
  [4771, '', 'Kerberos pre-auth failed', 'Wrong password for a Kerberos logon.', 1],
  [4776, '', 'NTLM credential validation', 'The DC validated NTLM credentials. Error 0x0 = success.', 0],
  [4798, '', 'Local groups enumerated', 'A user\'s local group membership was enumerated.', 0],
  [5156, '', 'Network connection allowed', 'Windows Filtering Platform permitted a connection. Extremely chatty.', 0],
  [1102, '', 'Audit log cleared', 'Someone cleared the Security log — a classic tampering signal.', 1],
];
const HINT_BY_ID = new Map();
for (const [id, src, title, why, w] of HINTS) {
  if (!HINT_BY_ID.has(id)) HINT_BY_ID.set(id, []);
  HINT_BY_ID.get(id).push({ src, title, why, w });
}
function hintFor(e) {
  const list = HINT_BY_ID.get(e.id);
  if (!list) return null;
  const s = (e.src || '').toLowerCase();
  return list.find(h => h.src && s.includes(h.src)) || list.find(h => !h.src) || null;
}

/* ---------- state ---------- */
const S = {
  info: {}, extraLogs: [],
  logs: store.get('logs', ALL), hours: store.get('hours', 24), max: store.get('max', 2000), live: store.get('live', false),
  levels: new Set(store.get('levels', [1, 2, 3, 4, 5])),
  q: '', terms: [], hlRe: null, brush: null, sort: { k: 't', d: -1 },
  events: [], qEvents: [], base: [], view: [], seen: new Set(), newKeys: new Set(),
  shown: 0, selKey: null, cur: null, loadedAt: 0, took: 0, truncated: false, warnings: [],
  loading: false, tl: null, liveTimer: null,
};

/* ---------- data load ---------- */
function prep(e) {
  const kw = e.kw || '';
  e.fail = /audit failure/i.test(kw);
  e.lv = e.lvl >= 1 && e.lvl <= 5 ? e.lvl : (e.fail ? 2 : 4);
  e.msg = e.msg || '';
  e.src = e.src || '';
  e.k = e.log + ':' + e.rec;
  e._h = `${e.id} ${e.src} ${e.task || ''} ${e.user || ''} ${kw} ${e.msg}`.toLowerCase();
  return e;
}

async function load(silent) {
  if (S.loading) return;
  S.loading = true;
  const t0 = performance.now();
  const btn = $('#refresh');
  btn.classList.add('spin');
  let tick = null;
  if (!silent) {
    $('#loading').hidden = false;
    $('#loadtxt').textContent = 'Loading events…';
    tick = setInterval(() => { $('#loadtxt').textContent = `Loading events… ${((performance.now() - t0) / 1000).toFixed(0)}s`; }, 500);
  }
  try {
    const r = await fetch(`/api/events?logs=${encodeURIComponent(S.logs)}&hours=${S.hours}&max=${S.max}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.statusText);
    const prev = S.seen;
    S.events = j.events.map(prep);
    S.newKeys = new Set();
    if (prev.size) for (const e of S.events) if (!prev.has(e.k)) S.newKeys.add(e.k);
    S.seen = new Set(S.events.map(e => e.k));
    S.warnings = j.warnings || [];
    S.truncated = !!j.truncated;
    S.took = j.took;
    S.loadedAt = j.now || Date.now();
    showBanner(S.warnings.length ? 'Some logs could not be read — ' + S.warnings.join(' · ') : '', false);
    refresh(true);
  } catch (ex) {
    showBanner('Failed to load events: ' + ex.message, true);
  } finally {
    S.loading = false;
    clearInterval(tick);
    $('#loading').hidden = true;
    btn.classList.remove('spin');
  }
}
function showBanner(msg, isErr) {
  const b = $('#banner');
  b.hidden = !msg; b.textContent = msg; b.classList.toggle('error', !!isErr);
}

/* ---------- query language ---------- */
const KEYS = new Set(['id', 'src', 'source', 'provider', 'msg', 'message', 'user', 'host', 'log', 'level', 'lvl', 'kw', 'task', 'pid', 'rec']);
function parseQuery(s) {
  const out = [];
  const re = /(-?)(?:([a-z]+):)?(?:"([^"]*)"|\/((?:\\.|[^\/\\])+)\/|([^\s"]+))/gi;
  let m;
  while ((m = re.exec(s))) {
    const neg = !!m[1];
    let key = (m[2] || '').toLowerCase();
    let val = m[3] ?? m[5];
    if (m[4] !== undefined) {
      try { out.push({ neg, key: KEYS.has(key) ? key : '', re: new RegExp(m[4], 'i') }); } catch { /* bad regex: ignore */ }
      continue;
    }
    if (key && !KEYS.has(key)) { val = key + ':' + val; key = ''; }
    if (val === undefined || val === '') continue;
    out.push({ neg, key, val: val.toLowerCase() });
  }
  return out;
}
const LVNAMES = { crit: 1, critical: 1, err: 2, error: 2, warn: 3, warning: 3, info: 4, information: 4, verbose: 5, verb: 5 };
function idMatch(id, v) {
  return v.split(',').some(p => {
    const r = p.match(/^(\d+)-(\d+)$/);
    return r ? id >= +r[1] && id <= +r[2] : String(id) === p.trim();
  });
}
function lvMatch(e, v) {
  return v.split(',').some(p => {
    p = p.trim();
    if (p === 'fail' || p === 'failure') return e.fail;
    return (LVNAMES[p] ?? +p) === e.lv;
  });
}
function field(e, k) {
  switch (k) {
    case 'src': case 'source': case 'provider': return e.src;
    case 'msg': case 'message': return e.msg;
    case 'user': return e.user || '';
    case 'host': return e.host || '';
    case 'log': return e.log;
    case 'kw': return e.kw || '';
    case 'task': return e.task || '';
    case 'pid': return String(e.pid ?? '');
    case 'rec': return String(e.rec);
    default: return '';
  }
}
function testTerm(e, t) {
  let r;
  if (t.re) r = t.re.test(t.key ? field(e, t.key) : e.msg + '\n' + e.src);
  else if (!t.key) r = e._h.includes(t.val);
  else if (t.key === 'id') r = idMatch(e.id, t.val);
  else if (t.key === 'level' || t.key === 'lvl') r = lvMatch(e, t.val);
  else if (t.key === 'pid' || t.key === 'rec') r = field(e, t.key) === t.val;
  else r = field(e, t.key).toLowerCase().includes(t.val);
  return t.neg ? !r : r;
}

/* ---------- pipeline ---------- */
function compute() {
  S.terms = parseQuery(S.q);
  const words = S.terms.filter(t => !t.neg && !t.re && (!t.key || t.key === 'msg' || t.key === 'message')).map(t => escRe(t.val));
  S.hlRe = words.length ? new RegExp('(' + words.join('|') + ')', 'gi') : null;
  const b = S.brush;
  S.qEvents = S.events.filter(e => (!b || (e.t >= b[0] && e.t <= b[1])) && S.terms.every(t => testTerm(e, t)));
  S.base = S.qEvents.filter(e => S.levels.has(e.lv));
  const { k, d } = S.sort;
  const cmp = {
    t: (a, c) => (a.t - c.t) * d,
    lv: (a, c) => (a.lv - c.lv) * -d || c.t - a.t,
    id: (a, c) => (a.id - c.id) * d || c.t - a.t,
    src: (a, c) => a.src.localeCompare(c.src) * d || c.t - a.t,
    log: (a, c) => a.log.localeCompare(c.log) * d || c.t - a.t,
  }[k];
  S.view = S.base.slice().sort(cmp);
}
function refresh(fromLoad) {
  compute();
  $('#tbl').classList.toggle('single', !S.logs.includes(','));
  renderChips();
  renderTimeline();
  renderSide();
  renderTable(fromLoad);
  renderStatus();
  renderBrushChip();
  $$('#tbl thead th[data-sort]').forEach(th => {
    th.querySelector('i').textContent = th.dataset.sort === S.sort.k ? (S.sort.d > 0 ? '▲' : '▼') : '';
  });
}

/* ---------- chips ---------- */
function renderChips() {
  const cnt = {};
  for (const e of S.qEvents) cnt[e.lv] = (cnt[e.lv] || 0) + 1;
  $('#chips').innerHTML = [1, 2, 3, 4, 5].map(l => {
    const v = LV[l];
    return `<div class="chip ${S.levels.has(l) ? '' : 'off'}" data-lv="${l}" title="${v.n} — click to toggle, Shift-click to show only this">
      <span class="lv ${v.k}">${v.c}</span><b>${fmtN(cnt[l] || 0)}</b></div>`;
  }).join('');
}

/* ---------- timeline ---------- */
function renderTimeline() {
  const el = $('#tl');
  const svg = $('#tlsvg');
  const W = el.clientWidth || 800, H = 84, plotH = 66;
  if (!S.events.length) { svg.innerHTML = ''; S.tl = null; $('#tlbrush').hidden = true; return; }
  let minT = Infinity, maxT = -Infinity;
  for (const e of S.events) { if (e.t < minT) minT = e.t; if (e.t > maxT) maxT = e.t; }
  const now = S.loadedAt || Date.now();
  const lo = (S.truncated || !S.hours) ? minT : Math.min(minT, now - S.hours * 3600e3);
  const hi = S.hours ? Math.max(now, maxT) : maxT;
  const span = Math.max(hi - lo, 1000);
  const n = Math.max(24, Math.min(180, Math.floor(W / 7)));
  const bw = span / n;
  const b = Array.from({ length: n }, () => [0, 0, 0, 0]); // crit, err, warn, info+verbose
  for (const e of S.base) {
    const i = Math.max(0, Math.min(n - 1, Math.floor((e.t - lo) / bw)));
    b[i][e.lv === 1 ? 0 : e.lv === 2 ? 1 : e.lv === 3 ? 2 : 3]++;
  }
  const maxC = Math.max(1, ...b.map(x => x[0] + x[1] + x[2] + x[3]));
  const colW = W / n;
  let out = '';
  for (let i = 0; i < n; i++) {
    const tot = b[i][0] + b[i][1] + b[i][2] + b[i][3];
    const x = i * colW;
    const t0 = lo + i * bw;
    const title = `${fmtTime(t0)} · ${tot} events` + (tot ? ` (${b[i][0]} crit, ${b[i][1]} err, ${b[i][2]} warn)` : '');
    out += `<rect x="${x}" y="0" width="${colW}" height="${plotH}" fill="transparent"><title>${esc(title)}</title></rect>`;
    if (!tot) continue;
    const h = Math.max(2, Math.sqrt(tot / maxC) * (plotH - 4));
    let y = plotH;
    [['b-crit', 0], ['b-err', 1], ['b-warn', 2], ['b-info', 3]].forEach(([cls, j]) => {
      if (!b[i][j]) return;
      const hh = Math.max(1.5, h * b[i][j] / tot);
      y -= hh;
      out += `<rect class="${cls}" x="${x + 0.5}" y="${y}" width="${Math.max(1, colW - 1)}" height="${hh}" rx="1" pointer-events="none"/>`;
    });
  }
  out += `<line x1="0" x2="${W}" y1="${plotH + .5}" y2="${plotH + .5}" stroke="var(--line)"/>`;
  const ticks = Math.max(2, Math.min(8, Math.floor(W / 120)));
  for (let i = 0; i <= ticks; i++) {
    const x = (i / ticks) * W;
    const anchor = i === 0 ? 'start' : i === ticks ? 'end' : 'middle';
    out += `<text x="${x}" y="${H - 6}" text-anchor="${anchor}">${esc(fmtShort(lo + (i / ticks) * span, span))}</text>`;
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = out;
  S.tl = { lo, hi: lo + span, W };
  const br = $('#tlbrush');
  if (S.brush) {
    const x0 = Math.max(0, (S.brush[0] - lo) / span * W), x1 = Math.min(W, (S.brush[1] - lo) / span * W);
    br.style.left = x0 + 'px'; br.style.width = Math.max(2, x1 - x0) + 'px'; br.hidden = false;
  } else br.hidden = true;
}
function bindTimeline() {
  const tl = $('#tl'), sel = $('#tlsel');
  let drag = null;
  const X = ev => Math.max(0, Math.min(tl.clientWidth, ev.clientX - tl.getBoundingClientRect().left));
  const show = () => {
    sel.hidden = false;
    sel.style.left = Math.min(drag.x0, drag.x1) + 'px';
    sel.style.width = Math.abs(drag.x1 - drag.x0) + 'px';
  };
  tl.addEventListener('pointerdown', ev => {
    if (!S.tl || ev.button !== 0) return;
    drag = { x0: X(ev), x1: X(ev) };
    tl.setPointerCapture(ev.pointerId);
    show();
  });
  tl.addEventListener('pointermove', ev => { if (drag) { drag.x1 = X(ev); show(); } });
  tl.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag; drag = null; sel.hidden = true;
    if (Math.abs(d.x1 - d.x0) < 4) { if (S.brush) { S.brush = null; refresh(); } return; }
    const { lo, hi, W } = S.tl;
    const a = lo + Math.min(d.x0, d.x1) / W * (hi - lo), z = lo + Math.max(d.x0, d.x1) / W * (hi - lo);
    S.brush = [a, z];
    refresh();
  });
}
function renderBrushChip() {
  const c = $('#brushchip');
  if (!S.brush) { c.hidden = true; return; }
  const span = S.brush[1] - S.brush[0];
  const f = t => { const d = new Date(t); return span < 864e5 ? `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` : fmtTime(t).slice(5, 16); };
  c.hidden = false;
  c.innerHTML = `⏱ ${f(S.brush[0])} → ${f(S.brush[1])}<button title="Clear time zoom">×</button>`;
}

/* ---------- side panels ---------- */
function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, n);
}
function qHas(tok) { return S.q.includes(tok); }
function renderSide() {
  // top IDs / sources from the current view
  const ids = new Map(), srcs = new Map();
  for (const e of S.view) {
    let o = ids.get(e.id); if (!o) ids.set(e.id, o = { n: 0, e }); o.n++;
    let s = srcs.get(e.src); if (!s) srcs.set(e.src, s = { n: 0 }); s.n++;
  }
  const idTop = topN(ids, 14);
  const maxI = idTop.length ? idTop[0][1].n : 1;
  $('#topIds').innerHTML = idTop.length ? idTop.map(([id, o]) => {
    const h = hintFor(o.e);
    const tok = `id:${id}`;
    return `<li data-tok="${tok}" class="${qHas(tok) ? 'on' : ''}" title="${esc(h ? h.title + ' — ' : '')}click to filter · Alt-click to exclude">
      <span class="bar-fill" style="width:${o.n / maxI * 100}%"></span>
      <span class="k">${id}</span><span class="t">${esc(h ? h.title : o.e.src)}</span><span class="n">${fmtN(o.n)}</span></li>`;
  }).join('') : '<div class="none">—</div>';

  const sTop = topN(srcs, 12);
  const maxS = sTop.length ? sTop[0][1].n : 1;
  $('#topSrc').innerHTML = sTop.length ? sTop.map(([src, o]) => {
    const tok = src.includes(' ') ? `src:"${src}"` : `src:${src}`;
    return `<li data-tok="${esc(tok)}" class="${qHas(tok) ? 'on' : ''}" title="click to filter · Alt-click to exclude">
      <span class="bar-fill" style="width:${o.n / maxS * 100}%"></span>
      <span class="t">${esc(src.replace(/^Microsoft-Windows-/, ''))}</span><span class="n">${fmtN(o.n)}</span></li>`;
  }).join('') : '<div class="none">—</div>';

  renderFindings();
}
function renderFindings() {
  const b = S.brush;
  const evs = b ? S.events.filter(e => e.t >= b[0] && e.t <= b[1]) : S.events;
  const m = new Map();
  for (const e of evs) {
    const h = hintFor(e);
    if (!h || !h.w) continue;
    const key = e.id + '|' + h.title;
    let o = m.get(key);
    if (!o) m.set(key, o = { id: e.id, h, n: 0, lv: 9, last: 0, ips: new Map(), accts: new Map() });
    o.n++; o.lv = Math.min(o.lv, e.lv); if (e.t > o.last) o.last = e.t;
    if (e.id === 4625) {
      const ip = e.msg.match(/Source Network Address:\s*([^\s]+)/);
      const ac = e.msg.match(/Account For Which Logon Failed:[\s\S]*?Account Name:\s*(\S+)/);
      if (ip && ip[1] !== '-') o.ips.set(ip[1], (o.ips.get(ip[1]) || 0) + 1);
      if (ac) o.accts.set(ac[1], (o.accts.get(ac[1]) || 0) + 1);
    }
  }
  const list = [...m.values()].sort((a, b) => a.lv - b.lv || b.n - a.n).slice(0, 12);
  $('#find-sub').textContent = list.length ? `· ${list.length}` : '';
  $('#finds').innerHTML = list.length ? list.map(o => {
    const q = `id:${o.id}`;
    let sub = `last ${rel(o.last)}`;
    const top = (mp, mk) => { const t = [...mp.entries()].sort((a, c) => c[1] - a[1])[0]; return t ? mk(t) : ''; };
    if (o.id === 4625) {
      sub += top(o.ips, ([ip, c]) => ` · top IP <span data-q='id:4625 "${esc(ip)}"'>${esc(ip)}</span> ×${c}`);
      sub += top(o.accts, ([a, c]) => ` · acct <span data-q='id:4625 "${esc(a)}"'>${esc(a)}</span> ×${c}`);
    }
    return `<li data-q="${q}" class="${S.q === q ? 'on' : ''}" title="${esc(o.h.why)}">
      <i class="dot ${LV[Math.min(o.lv, 4)].k}"></i><span class="t">${esc(o.h.title)} <small>${o.id}</small></span><span class="n">${fmtN(o.n)}</span>
      <span class="sub">${sub}</span></li>`;
  }).join('') : '<div class="none">Nothing suspicious in this window.</div>';
}

/* ---------- table ---------- */
function firstLine(s) {
  const i = s.search(/\r?\n/);
  return (i < 0 ? s : s.slice(0, i)).trim() || (s.trim().split(/\r?\n/).find(Boolean) || '');
}
function hl(s) {
  if (!S.hlRe) return esc(s);
  return s.split(S.hlRe).map((p, i) => (i % 2 ? `<mark>${esc(p)}</mark>` : esc(p))).join('');
}
function rowHTML(e, i) {
  const lv = LV[e.lv];
  const cls = (e.lv <= 3 ? 'r-' + lv.k : '') + (S.selKey === e.k ? ' sel' : '') + (S.newKeys.has(e.k) ? ' new' : '');
  const line = firstLine(e.msg);
  return `<tr data-i="${i}" class="${cls}"><td class="c-t" title="${esc(rel(e.t))}">${fmtTime(e.t)}</td>` +
    `<td class="c-l"><span class="lv ${lv.k}" title="${lv.n}${e.fail ? ' · Audit Failure' : ''}">${lv.c}</span></td>` +
    `<td class="c-i">${e.id}</td><td class="c-s" title="${esc(e.src)}">${hl(e.src)}</td>` +
    `<td class="c-g">${esc(e.log)}</td><td class="c-m" title="${esc(line)}">${hl(line)}</td></tr>`;
}
function appendChunk() {
  if (S.shown >= S.view.length) return;
  const end = Math.min(S.view.length, S.shown + CHUNK);
  let h = '';
  for (let i = S.shown; i < end; i++) h += rowHTML(S.view[i], i);
  $('#tbody').insertAdjacentHTML('beforeend', h);
  S.shown = end;
}
function renderTable(keepScroll) {
  const tw = $('#tw');
  const top = keepScroll ? tw.scrollTop : 0;
  $('#tbody').innerHTML = '';
  S.shown = 0;
  appendChunk();
  if (keepScroll) { while (S.shown < S.view.length && tw.scrollTop + tw.clientHeight > 0 && S.shown * 26 < top + tw.clientHeight + 400) appendChunk(); tw.scrollTop = top; }
  else tw.scrollTop = 0;
  $('#empty').hidden = S.view.length > 0 || S.loading;
}
function renderStatus() {
  const t = new Date(S.loadedAt || Date.now());
  const trunc = S.truncated ? ' · limit reached (newest first) — narrow the range or raise the limit' : '';
  $('#st-left').textContent = `${fmtN(S.view.length)} shown · ${fmtN(S.events.length)} loaded${trunc} · ${S.took}s · ${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`;
}

/* ---------- detail drawer ---------- */
function openDetail(e) {
  S.selKey = e.k; S.cur = e;
  const lv = LV[e.lv], h = hintFor(e);
  const same = S.events.reduce((n, x) => n + (x.id === e.id && x.src === e.src ? 1 : 0), 0);
  $('#drawer').innerHTML = `
    <div class="d-head"><span class="lv ${lv.k}">${lv.c}</span>
      <div class="d-title"><b>Event ${e.id}</b>${h ? ` · ${esc(h.title)}` : ''}<div class="s">${esc(e.src)}</div></div>
      <button class="d-x" data-act="close" title="Close (Esc)">×</button></div>
    <div class="d-body">
      ${h ? `<div class="hint ${h.w ? 'watch' : ''}"><b>${esc(h.title)}</b><span>${esc(h.why)}</span></div>` : ''}
      <dl class="kv">
        <dt>Time</dt><dd>${fmtTime(e.t)} <span class="dim">(${esc(rel(e.t))})</span></dd>
        <dt>Level</dt><dd>${lv.n}${e.fail ? ' · Audit Failure' : ''}${e.kw && !e.fail ? ' · ' + esc(e.kw) : ''}</dd>
        <dt>Log</dt><dd>${esc(e.log)}</dd>
        <dt>Computer</dt><dd>${esc(e.host || '')}</dd>
        <dt>Record ID</dt><dd>${e.rec}</dd>
        ${e.task && e.task !== 'None' ? `<dt>Task</dt><dd>${esc(e.task)}</dd>` : ''}
        ${e.pid ? `<dt>Process ID</dt><dd>${e.pid}</dd>` : ''}
        ${e.user ? `<dt>User SID</dt><dd>${esc(e.user)}</dd>` : ''}
        <dt>Occurrences</dt><dd>${fmtN(same)} in loaded range</dd>
      </dl>
      <div class="acts">
        <button class="btn" data-act="copy">Copy</button>
        <button class="btn" data-act="fid">Only this ID</button>
        <button class="btn" data-act="xid">Hide this ID</button>
        <button class="btn" data-act="xsrc">Hide source</button>
        <button class="btn" data-act="web">Search web ↗</button>
      </div>
      <div class="t2"><button class="on" data-tab="msg">Message</button><button data-tab="xml">XML</button></div>
      <pre class="msg" id="d-msg"></pre>
      <pre class="msg" id="d-xml" hidden></pre>
    </div>`;
  $('#d-msg').textContent = e.msg || '(no message text — provider metadata not available)';
  $('#drawer').classList.add('open');
  $$('#tbody tr.sel').forEach(r => r.classList.remove('sel'));
  const i = S.view.indexOf(e);
  const row = $('#tbody').children[i];
  if (row) row.classList.add('sel');
}
function closeDetail() {
  $('#drawer').classList.remove('open');
  S.selKey = null; S.cur = null;
  $$('#tbody tr.sel').forEach(r => r.classList.remove('sel'));
}
async function showXml() {
  const e = S.cur; if (!e) return;
  const box = $('#d-xml');
  if (e._xml == null) {
    box.textContent = 'Loading…';
    try {
      const q = new URLSearchParams({ log: e.log, rec: e.rec, id: e.id, src: e.src, t: e.t, lvl: e.lvl ?? '' });
      const r = await fetch('/api/xml?' + q);
      const j = await r.json();
      e._xml = j.xml || ('Error: ' + (j.error || 'unavailable'));
    } catch (ex) { e._xml = 'Error: ' + ex.message; }
  }
  if (S.cur === e) box.textContent = e._xml;
}
function selectIndex(i) {
  if (i < 0 || i >= S.view.length) return;
  while (S.shown <= i) appendChunk();
  openDetail(S.view[i]);
  const row = $('#tbody').children[i];
  if (row) row.scrollIntoView({ block: 'nearest' });
}

/* ---------- query helpers ---------- */
function setQuery(q, replace = true) {
  S.q = q; $('#q').value = q; refresh();
  if (replace) $('#tw').scrollTop = 0;
}
function toggleToken(tok, exclude) {
  const t = exclude ? '-' + tok : tok;
  const parts = S.q.trim() ? S.q.trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/) : [];
  const idx = parts.indexOf(t);
  if (idx >= 0) parts.splice(idx, 1); else parts.push(t);
  setQuery(parts.join(' '), false);
}
function exportRows(kind) {
  const rows = S.view;
  if (!rows.length) return toast('Nothing to export');
  let blob, name;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  if (kind === 'json') {
    const data = rows.map(e => ({ time: new Date(e.t).toISOString(), level: LV[e.lv].n, id: e.id, source: e.src, log: e.log, computer: e.host, record: e.rec, task: e.task, user: e.user, message: e.msg }));
    blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }); name = `events-${stamp}.json`;
  } else {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['Time,Level,ID,Source,Log,Computer,Record,Task,User,Message'];
    for (const e of rows) lines.push([new Date(e.t).toISOString(), LV[e.lv].n, e.id, q(e.src), q(e.log), q(e.host), e.rec, q(e.task), q(e.user), q(e.msg)].join(','));
    blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }); name = `events-${stamp}.csv`;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Exported ${fmtN(rows.length)} rows`);
}

/* ---------- wiring ---------- */
function syncTabs() {
  let match = false;
  $$('#tabs button').forEach(b => { const on = b.dataset.logs === S.logs; b.classList.toggle('on', on); match = match || on; });
  $('#more').value = match ? '' : S.logs;
  if (!match && $('#more').value !== S.logs) $('#more').value = '';
}
function reloadFresh() { S.seen = new Set(); S.brush = null; closeDetail(); load(); }
function setLive() {
  clearInterval(S.liveTimer);
  if (S.live) S.liveTimer = setInterval(() => { if (!document.hidden) load(true); }, 15000);
}

function wire() {
  $$('#tabs button').forEach(b => b.addEventListener('click', () => {
    S.logs = b.dataset.logs; store.set('logs', S.logs); syncTabs(); reloadFresh();
  }));
  $('#more').addEventListener('change', ev => {
    if (!ev.target.value) return;
    S.logs = ev.target.value; store.set('logs', S.logs); syncTabs(); reloadFresh();
  });
  $('#range').value = String(S.hours);
  $('#range').addEventListener('change', ev => { S.hours = +ev.target.value; store.set('hours', S.hours); reloadFresh(); });
  $('#max').value = String(S.max);
  $('#max').addEventListener('change', ev => { S.max = +ev.target.value; store.set('max', S.max); reloadFresh(); });
  $('#live').checked = S.live;
  $('#live').addEventListener('change', ev => { S.live = ev.target.checked; store.set('live', S.live); setLive(); });
  $('#refresh').addEventListener('click', () => load());

  let deb;
  $('#q').addEventListener('input', ev => { clearTimeout(deb); deb = setTimeout(() => { S.q = ev.target.value; refresh(); }, 120); });
  $('#help').addEventListener('click', () => { $('#help-pop').hidden = !$('#help-pop').hidden; });
  $('#clear').addEventListener('click', () => {
    S.levels = new Set([1, 2, 3, 4, 5]); store.set('levels', [...S.levels]); S.brush = null; setQuery('');
  });
  $('#csv').addEventListener('click', () => exportRows('csv'));
  $('#json').addEventListener('click', () => exportRows('json'));
  $('#brushchip').addEventListener('click', ev => { if (ev.target.tagName === 'BUTTON') { S.brush = null; refresh(); } });

  $('#chips').addEventListener('click', ev => {
    const c = ev.target.closest('.chip'); if (!c) return;
    const l = +c.dataset.lv;
    if (ev.shiftKey) S.levels = new Set([l]);
    else if (S.levels.has(l)) S.levels.delete(l); else S.levels.add(l);
    store.set('levels', [...S.levels]);
    refresh();
  });

  $$('#tbl thead th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    S.sort = S.sort.k === k ? { k, d: -S.sort.d } : { k, d: k === 't' || k === 'lv' ? -1 : 1 };
    refresh();
  }));
  $('#tbody').addEventListener('click', ev => {
    const tr = ev.target.closest('tr'); if (!tr) return;
    openDetail(S.view[+tr.dataset.i]);
  });
  $('#tw').addEventListener('scroll', () => {
    const tw = $('#tw');
    if (tw.scrollTop + tw.clientHeight > tw.scrollHeight - 500) appendChunk();
  }, { passive: true });

  const side = ev => {
    const q = ev.target.closest('[data-q]');
    if (q) { ev.stopPropagation(); setQuery(S.q === q.dataset.q ? '' : q.dataset.q); return; }
    const li = ev.target.closest('li[data-tok]');
    if (li) toggleToken(li.dataset.tok, ev.altKey);
  };
  $('.side').addEventListener('click', side);

  $('#drawer').addEventListener('click', ev => {
    const tab = ev.target.closest('[data-tab]');
    if (tab) {
      $$('.t2 button').forEach(b => b.classList.toggle('on', b === tab));
      $('#d-msg').hidden = tab.dataset.tab !== 'msg';
      $('#d-xml').hidden = tab.dataset.tab !== 'xml';
      if (tab.dataset.tab === 'xml') showXml();
      return;
    }
    const a = ev.target.closest('[data-act]'); if (!a || !S.cur) return;
    const e = S.cur;
    switch (a.dataset.act) {
      case 'close': closeDetail(); break;
      case 'copy': {
        const txt = `[${fmtTime(e.t)}] ${LV[e.lv].n} · ${e.log} · ${e.src} · ID ${e.id} · record ${e.rec}\n\n${e.msg}`;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copied'), () => toast('Copy failed'));
        break;
      }
      case 'fid': setQuery(`id:${e.id}`); break;
      case 'xid': toggleToken(`id:${e.id}`, true); break;
      case 'xsrc': toggleToken(e.src.includes(' ') ? `src:"${e.src}"` : `src:${e.src}`, true); break;
      case 'web': window.open('https://www.google.com/search?q=' + encodeURIComponent(`windows event id ${e.id} ${e.src}`), '_blank', 'noopener'); break;
    }
  });

  document.addEventListener('keydown', ev => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (ev.key === 'Escape') {
      if (typing) document.activeElement.blur();
      else if (S.cur) closeDetail();
      else if (!$('#help-pop').hidden) $('#help-pop').hidden = true;
      return;
    }
    if (typing || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === '/') { ev.preventDefault(); $('#q').focus(); $('#q').select(); }
    else if (ev.key === 'r') load();
    else if (ev.key === 'j' || ev.key === 'ArrowDown') { ev.preventDefault(); const i = S.selKey ? S.view.findIndex(x => x.k === S.selKey) : -1; selectIndex(i + 1); }
    else if (ev.key === 'k' || ev.key === 'ArrowUp') { ev.preventDefault(); const i = S.selKey ? S.view.findIndex(x => x.k === S.selKey) : S.view.length; selectIndex(i - 1); }
  });

  let rs;
  window.addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(renderTimeline, 150); });
  bindTimeline();
}

async function init() {
  wire();
  syncTabs();
  setLive();
  load();
  fetch('/api/info').then(r => r.json()).then(i => {
    S.info = i;
    $('#host').textContent = i.host || '';
    $('#pill-demo').hidden = !i.demo;
    const p = $('#pill-admin');
    if (i.windows) {
      p.hidden = false;
      p.textContent = i.admin ? 'administrator' : 'not elevated';
      p.className = 'pill ' + (i.admin ? 'ok' : 'warn');
      p.title = i.admin ? 'Security log is readable' : 'Run run_admin.bat to read the Security log';
    }
  }).catch(() => {});
  fetch('/api/logs').then(r => r.json()).then(j => {
    const main = new Set(['Application', 'System', 'Security']);
    const sel = $('#more');
    for (const l of j.logs || []) {
      if (main.has(l.name)) continue;
      const o = document.createElement('option');
      o.value = l.name; o.textContent = `${l.name} (${fmtN(l.n)})`;
      sel.appendChild(o);
    }
    syncTabs();
  }).catch(() => {});
}
init();
})();
