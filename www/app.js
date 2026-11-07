'use strict';
/* =====================================================================
   Hoshi: manga-style anime tracker
   - anime data: AniList public GraphQL API (no key needed)
   - accounts: device accounts by default, optional Supabase cloud sync
   ===================================================================== */

/* ---------- config & storage ---------- */
const CFG = Object.assign({ supabaseUrl: '', supabaseKey: '' }, window.HOSHI_CONFIG || {});
const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey);
const SB = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
const K = { session: 'hoshi.session', users: 'hoshi.users', guest: 'hoshi.guest', seen: 'hoshi.seenAuth', data: 'hoshi.data.', refreshed: 'hoshi.refreshed' };
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- constants ---------- */
const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const D3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const KANJI = ['日', '月', '火', '水', '木', '金', '土'];
const INK = '#1A1633', CREAM = '#FFF4DC';
const ST = [
  { k: 'watching', label: 'Currently watching', short: 'Watching', col: '#FF5C8A', ask: 'You are on episode' },
  { k: 'finished', label: 'Finished', short: 'Finished', col: '#4FD8F0' },
  { k: 'paused', label: 'Paused', short: 'Paused', col: '#FFD83D', ask: 'You paused on episode' },
  { k: 'planned', label: 'Plan to watch', short: 'Plan to watch', col: '#B79CFF' },
  { k: 'dropped', label: 'Dropped', short: 'Dropped', col: '#FFB36B' }
];
const STM = Object.fromEntries(ST.map(s => [s.k, s]));
const MOODS = { 'Cozy': 'Slice of Life', 'Hype fights': 'Action', 'Cry tonight': 'Drama', 'Mind-bend': 'Psychological' };
const META_KEYS = ['title', 'romaji', 'native', 'cover', 'coverXL', 'color', 'banner', 'eps', 'dur', 'fmt', 'astatus', 'year', 'season', 'genres', 'score', 'nx', 'desc'];

const I = {
  back: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1633" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  search: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1633" stroke-width="2.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>',
  filter: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1633" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  check: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="#1A1633"/></svg>',
  bell: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/></svg>',
  share: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>',
  chat: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z"/></svg>',
  dl: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/></svg>',
  close: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1633" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const safeColor = (c, d = '#FF5C8A') => /^#[0-9a-f]{6}$/i.test(c || '') ? c : d;
const safeUrl = u => /^https:\/\//i.test(u || '') ? u : '';
const nowS = () => Date.now() / 1000;
const rid = () => Math.random().toString(36).slice(2, 8);
function mixHex(a, b, t) {
  const p = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const x = p(a), y = p(b);
  return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')';
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function fmtLeft(sec) {
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins >= 1440) return Math.floor(mins / 1440) + 'd ' + Math.floor((mins % 1440) / 60) + 'h';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}
const hhmm = ts => { const d = new Date(ts * 1000); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function weekDates(now) {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mon = new Date(d0); mon.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const te = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

/* ---------- state: session + library ---------- */
let session = ls.get(K.session, null);            // null = guest
let DB = { lib: {}, prefs: { mood: 'Cozy', weekOnly: false } };
const dataKey = () => session ? K.data + session.uid : K.guest;
function loadDB() {
  const d = ls.get(dataKey(), null);
  DB = { lib: (d && d.lib) || {}, prefs: Object.assign({ mood: 'Cozy', weekOnly: false }, d && d.prefs) };
}
function pruneTombstones() {
  const cut = Date.now() - 60 * 864e5;
  Object.keys(DB.lib).forEach(id => { const e = DB.lib[id]; if (e.del && (e.u || 0) < cut) delete DB.lib[id]; });
}
function saveDB() { pruneTombstones(); ls.set(dataKey(), DB); scheduleSync(); scheduleReminders(); }
function mergeInto(target, src) {
  let changed = false;
  for (const [id, e] of Object.entries(src || {})) {
    const t = target[id];
    if (!t || (e.u || 0) > (t.u || 0)) { target[id] = e; changed = true; }
  }
  return changed;
}
const liveEntry = id => { const e = DB.lib[id]; return e && !e.del ? e : null; };
const entries = s => Object.values(DB.lib).filter(e => !e.del && (!s || e.s === s));
const metaOf = m => { const o = {}; META_KEYS.forEach(k => { if (m[k] !== undefined) o[k] = m[k]; }); return o; };

/* ---------- episodes & levels ---------- */
function airedNow(e) { if (!e.nx) return e.eps || 0; return e.nx.at <= nowS() ? e.nx.ep : e.nx.ep - 1; }
function totalEps(e) { return e.eps || (e.nx ? airedNow(e) : 0); }
function maxEp(e) { return e.nx ? Math.max(0, Math.min(airedNow(e), e.eps || Infinity)) : (e.eps || 9999); }
/* Level reward for finishing one title:
   1 season = 12 episodes. Up to 10 seasons you earn 1 level per season.
   Beyond that every 8 more seasons add 1 level, so very long shows still pay well. */
function lvFor(eps) {
  const seasons = Math.max(1, Math.ceil((eps || 0) / 12));
  return seasons <= 10 ? seasons : 10 + Math.floor((seasons - 10) / 8);
}
const lvOf = e => lvFor(Math.max(totalEps(e), e.p || 0));
const levelTotal = () => entries('finished').reduce((n, e) => n + lvOf(e), 0);
const rankFor = lv => lv < 5 ? 'Fresh Recruit' : lv < 12 ? 'Night Watcher' : lv < 25 ? 'Seasoned Otaku' : lv < 50 ? 'Veteran' : 'Legend';
function stats() {
  const all = entries(), level = 1 + levelTotal();
  const hours = Math.round(all.reduce((n, e) => n + (e.p || 0) * (e.dur || 24), 0) / 60);
  const g = {};
  all.forEach(e => (e.genres || []).forEach(x => { g[x] = (g[x] || 0) + (e.p || 0); }));
  const genres = Object.entries(g).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const top = entries('finished').sort((a, b) => lvOf(b) - lvOf(a) || b.p - a.p).slice(0, 3);
  const watching = entries('watching');
  const pending = watching.reduce((n, e) => n + lvOf(e), 0);
  const m = new Date().getMonth();
  const season = (m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL') + ' ' + new Date().getFullYear();
  return { level, rank: rankFor(level), hours, genres, top, pending, watchingN: watching.length, season,
    counts: Object.fromEntries(ST.map(s => [s.k, entries(s.k).length])) };
}
const userName = () => session ? session.name : 'guest';

/* ---------- library operations ---------- */
function setStatus(m, s, cur) {
  const before = levelTotal();
  let e = liveEntry(m.id) || { id: m.id, p: 0, rem: false };
  Object.assign(e, metaOf(m));
  e.s = s; e.u = Date.now(); delete e.del;
  if (s === 'finished') e.p = totalEps(e) || Math.max(e.p, 1);
  else if ((s === 'watching' || s === 'paused') && cur != null) e.p = clamp(cur - 1, 0, Math.max(0, maxEp(e) - 1));
  DB.lib[e.id] = e; saveDB();
  return levelTotal() - before;
}
function removeEntry(id) { DB.lib[id] = { id, del: 1, u: Date.now() }; saveDB(); }
function markNext(e) {
  const before = levelTotal();
  if (e.p >= maxEp(e)) return { blocked: true };
  e.p++; e.u = Date.now();
  if (e.eps && e.p >= e.eps) e.s = 'finished';
  saveDB();
  return { delta: levelTotal() - before, finished: e.s === 'finished' };
}

/* ---------- AniList ---------- */
const F_BASE = 'id title{romaji english native} coverImage{extraLarge large color} bannerImage episodes duration format status season seasonYear genres averageScore nextAiringEpisode{episode airingAt}';
const F_FULL = F_BASE + ' description(asHtml:false)';
async function gql(query, variables) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query, variables }), signal: ctl.signal });
    if (r.status === 429) throw new Error('AniList is asking us to slow down. Try again in a minute.');
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.errors) throw new Error((j && j.errors && j.errors[0] && j.errors[0].message) || 'AniList error (' + r.status + ')');
    return j.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AniList took too long to answer.');
    if (e instanceof TypeError) throw new Error('Cannot reach AniList. Check your connection.');
    throw e;
  } finally { clearTimeout(t); }
}
function cleanDesc(s) {
  if (!s) return '';
  const t = String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return (new DOMParser().parseFromString(t, 'text/html').documentElement.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
function trimDesc(s, n) {
  let o = s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
  if ((o.match(/~!/g) || []).length > (o.match(/!~/g) || []).length) o += '!~';
  return o;
}
function fromMedia(m) {
  const T = m.title || {}, C = m.coverImage || {};
  const o = {
    id: m.id, title: T.english || T.romaji || T.native || 'Untitled', romaji: T.romaji || '', native: T.native || '',
    cover: safeUrl(C.large || C.extraLarge), coverXL: safeUrl(C.extraLarge || C.large), color: C.color || '', banner: safeUrl(m.bannerImage),
    eps: m.episodes || null, dur: m.duration || null, fmt: m.format || '', astatus: m.status || '', year: m.seasonYear || null, season: m.season || '',
    genres: m.genres || [], score: m.averageScore || null,
    nx: m.nextAiringEpisode ? { ep: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt } : null
  };
  if (m.description !== undefined) o.desc = trimDesc(cleanDesc(m.description), 900);
  return o;
}
const mcache = new Map();          // id -> media view (may lack desc)
const qcache = new Map();          // query key -> {t, list, hasNext}
function remember(m) { const old = mcache.get(m.id); mcache.set(m.id, old && old.desc !== undefined && m.desc === undefined ? Object.assign({}, m, { desc: old.desc }) : m); }
async function searchAnime(q, page) {
  const key = 's|' + q + '|' + page, hit = qcache.get(key);
  if (hit && Date.now() - hit.t < 3e5) return hit;
  const data = q
    ? await gql(`query($q:String,$p:Int){Page(page:$p,perPage:20){pageInfo{hasNextPage} media(search:$q,type:ANIME,sort:SEARCH_MATCH,isAdult:false){${F_BASE}}}}`, { q, p: page })
    : await gql(`query($p:Int){Page(page:$p,perPage:20){pageInfo{hasNextPage} media(type:ANIME,sort:TRENDING_DESC,isAdult:false){${F_BASE}}}}`, { p: page });
  const res = { t: Date.now(), list: data.Page.media.map(fromMedia), hasNext: !!data.Page.pageInfo.hasNextPage };
  res.list.forEach(remember); qcache.set(key, res); return res;
}
async function discoverMood(mood) {
  const key = 'm|' + mood, hit = qcache.get(key);
  if (hit && Date.now() - hit.t < 6e5) return hit;
  const data = await gql(`query($g:String){Page(perPage:12){media(type:ANIME,genre:$g,sort:POPULARITY_DESC,isAdult:false,format:TV){${F_BASE}}}}`, { g: MOODS[mood] });
  const res = { t: Date.now(), list: data.Page.media.map(fromMedia) };
  res.list.forEach(remember); qcache.set(key, res); return res;
}
const pending = new Set(), failed = new Map();
async function ensureDetail(id) {
  const have = mcache.get(id);
  if ((have && have.desc !== undefined) || pending.has(id) || failed.has(id)) return;
  pending.add(id);
  try {
    const d = await gql(`query($id:Int){Media(id:$id,type:ANIME){${F_FULL}}}`, { id });
    const m = fromMedia(d.Media); mcache.set(id, m);
    const e = liveEntry(id); if (e) { Object.assign(e, metaOf(m)); ls.set(dataKey(), DB); }
  } catch (err) { failed.set(id, err.message); }
  finally { pending.delete(id); const r = route(); if (r.p === 'a' && +r.id === id) render(true); }
}
async function refreshLibrary() {
  if (Date.now() - (ls.get(K.refreshed, 0)) < 36e5 || !navigator.onLine) return;
  const ids = entries().filter(e => e.s !== 'dropped' && e.astatus !== 'FINISHED' || e.s === 'watching').map(e => e.id).slice(0, 50);
  if (!ids.length) return;
  try {
    const d = await gql(`query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id episodes status nextAiringEpisode{episode airingAt}}}}`, { ids });
    d.Page.media.forEach(m => { const e = liveEntry(m.id); if (!e) return; e.eps = m.episodes || e.eps || null; e.astatus = m.status || e.astatus; e.nx = m.nextAiringEpisode ? { ep: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt } : null; });
    ls.set(dataKey(), DB); ls.set(K.refreshed, Date.now()); scheduleReminders();
    if (['home', 'week', ''].includes(route().p)) render(true);
  } catch (e) { /* offline or rate limited: keep stored data */ }
}
function getM(id) {
  const e = liveEntry(id), f = mcache.get(id);
  if (!e && !f) return null;
  const m = Object.assign({}, e || {}, f || {});
  if (e) { m.s = e.s; m.p = e.p; m.u = e.u; m.rem = e.rem; if (e.nx !== undefined && !f) m.nx = e.nx; }
  return m;
}

/* ---------- accounts ---------- */
const ITERS = 150000;
async function pbkdf2(pw, salt, iters) {
  if (!(window.crypto && crypto.subtle)) throw new Error('Accounts need a secure page. Open Hoshi over https:// or http://localhost.');
  const key = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256);
}
function startSession(s) {
  const guest = ls.get(K.guest, null);
  session = s; ls.set(K.session, s); ls.set(K.seen, 1); loadDB(); revs.clear(); ui.blocks = null; FR.st = 'idle'; FR.list = []; FR.ids = new Set(); FR.res = null; FR.q = ''; FR.cards.clear(); lastCard = '';
  let adopted = 0;
  if (guest && guest.lib && Object.keys(guest.lib).length) { adopted = Object.keys(guest.lib).length; mergeInto(DB.lib, guest.lib); ls.del(K.guest); }
  saveDB(); return adopted;
}
async function localRegister(name, pw) {
  const users = ls.get(K.users, {}), key = name.toLowerCase();
  if (users[key]) throw new Error('That username is already taken on this device.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), hash = await pbkdf2(pw, salt, ITERS);
  const uid = 'l' + Date.now().toString(36) + rid();
  users[key] = { uid, name, salt: b64(salt), hash: b64(hash), iters: ITERS, created: Date.now() };
  ls.set(K.users, users);
  return startSession({ mode: 'local', uid, name });
}
async function localLogin(name, pw) {
  const u = ls.get(K.users, {})[name.toLowerCase()];
  const bad = new Error('Wrong username or password.');
  if (!u) throw bad;
  const hash = b64(await pbkdf2(pw, unb64(u.salt), u.iters));
  if (hash !== u.hash) throw bad;
  return startSession({ mode: 'local', uid: u.uid, name: u.name });
}
async function sb(path, o = {}) {
  const h = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
  // Newer Supabase "publishable" keys (sb_publishable_...) are not JWTs, so send them only in the apikey header.
  const bearer = o.tok || (o.token && session ? session.at : (/^sb_/.test(CFG.supabaseKey) ? '' : CFG.supabaseKey));
  if (bearer) h.Authorization = 'Bearer ' + bearer;
  if (o.prefer) h.Prefer = o.prefer;
  let r;
  try { r = await fetch(SB + path, { method: o.method || 'GET', headers: h, body: o.body ? JSON.stringify(o.body) : undefined }); }
  catch (e) { throw new Error('Cannot reach the server. Check your connection.'); }
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) throw new Error((j && (j.msg || j.error_description || j.message || j.error)) || 'Request failed (' + r.status + ')');
  return j;
}
function startCloud(j) {
  const u = j.user || {};
  const name = (u.user_metadata && u.user_metadata.username) || (u.email || 'user').split('@')[0];
  return startSession({ mode: 'cloud', uid: u.id, name, email: u.email, at: j.access_token, rt: j.refresh_token, exp: Math.floor(Date.now() / 1000) + (j.expires_in || 3600) });
}
async function cloudSignup(email, pw, name) {
  const j = await sb('/auth/v1/signup', { method: 'POST', body: { email, password: pw, data: { username: name } } });
  if (j && j.access_token) { const n = startCloud(j); await syncNow(); return { adopted: n }; }
  return { confirm: true };
}
async function cloudLogin(email, pw) {
  const j = await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: pw } });
  const n = startCloud(j); await syncNow(); return { adopted: n };
}
async function ensureToken() {
  if (!session || session.mode !== 'cloud') return false;
  if (session.exp - Date.now() / 1000 > 60) return true;
  try {
    const j = await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.rt } });
    session.at = j.access_token; session.rt = j.refresh_token || session.rt; session.exp = Math.floor(Date.now() / 1000) + (j.expires_in || 3600);
    ls.set(K.session, session); return true;
  } catch (e) { return false; }
}
async function handleAuthRedirect() {
  if (!CLOUD || !/access_token=/.test(location.hash)) return false;
  const p = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  const at = p.get('access_token'), rt = p.get('refresh_token'), type = p.get('type');
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const u = await sb('/auth/v1/user', { tok: at });
    const j = { access_token: at, refresh_token: rt, expires_in: +p.get('expires_in') || 3600, user: u };
    if (type === 'recovery') { ui.recovery = j; ui.authTab = 'reset'; location.hash = '#/auth'; return true; }
    startCloud(j); location.hash = '#/home'; syncNow(); toast('Email confirmed. You are signed in.');
  } catch (e) { ui.authMsg = { bad: true, t: 'That link has expired. Sign in, or request a new one.' }; ui.authTab = 'login'; location.hash = '#/auth'; }
  return true;
}
async function logout() {
  if (session && session.mode === 'cloud') { try { await syncNow(); } catch (e) {} ls.del(K.data + session.uid); }
  session = null; ls.del(K.session); loadDB(); revs.clear(); ui.blocks = null; FR.st = 'idle'; FR.list = []; FR.ids = new Set(); FR.res = null; FR.q = ''; FR.cards.clear(); lastCard = ''; toast('Signed out'); location.hash = '#/home'; render();
}

/* ---------- cloud sync (Supabase REST, no SDK) ---------- */
let syncT = null, syncing = false, again = false;
const sync = { state: 'idle', at: 0, err: '' };
function scheduleSync() {
  if (!session || session.mode !== 'cloud') return;
  clearTimeout(syncT); syncT = setTimeout(() => syncNow().catch(() => {}), 2500);
}
async function syncNow() {
  if (!session || session.mode !== 'cloud') return;
  if (syncing) { again = true; return; }
  syncing = true; sync.state = 'syncing'; let changed = false;
  try {
    if (!await ensureToken()) throw new Error('Your session expired. Sign in again to keep syncing.');
    const rows = await sb('/rest/v1/libraries?select=data,updated_at&user_id=eq.' + encodeURIComponent(session.uid), { token: true });
    if (rows && rows[0] && rows[0].data) {
      const d = rows[0].data; changed = mergeInto(DB.lib, d.lib);
      if (d.prefs && !ls.get(dataKey())) DB.prefs = Object.assign({}, DB.prefs, d.prefs);
    }
    pruneTombstones(); ls.set(dataKey(), DB);
    await sb('/rest/v1/libraries?on_conflict=user_id', { method: 'POST', token: true, prefer: 'resolution=merge-duplicates,return=minimal',
      body: { user_id: session.uid, data: DB, updated_at: new Date().toISOString() } });
    sync.state = 'ok'; sync.at = Date.now(); sync.err = '';
    await pushProfile();
  } catch (e) { sync.state = 'error'; sync.err = e.message; }
  finally {
    syncing = false;
    if (again) { again = false; scheduleSync(); }
    if (changed || route().p === 'me') render(true);
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (session && session.mode === 'cloud') syncNow(); } else if (session && session.mode === 'cloud') scheduleSync(); });

/* ---------- UI state ---------- */
const ui = { q: '', page: 1, results: null, hasNext: false, loading: false, err: '', trending: null, searchSeq: 0, selDay: null, spoilerOn: true, popId: null,
  authTab: 'register', authMsg: null, authVals: null, busy: false, recovery: null, moodErr: '', blocks: null, revealed: new Set() };
const revs = new Map();            // anime id -> {st:'ok'|'err', list, err, at}
let lastKey = null, lastRoute = '', deferredInstall = null;

/* ---------- small renderers ---------- */
function cv(e, cls = '') {
  const src = e.cover || e.coverXL;
  return `<span class="cv ${cls}" style="background:${esc(safeColor(e.color, '#B79CFF'))}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : ''}</span>`;
}
function badge(e) {
  const s = e && STM[e.s]; if (!s) return '';
  return `<span class="badge" style="background:${s.col}">${esc(s.short)}</span>`;
}
function fmtLine(m) {
  const f = (m.fmt || '').replace(/_/g, ' ');
  const parts = [f, m.year || '', m.eps ? m.eps + ' eps' : (m.astatus === 'RELEASING' ? 'ongoing' : ''), m.score ? '★ ' + (m.score / 10).toFixed(1) : ''].filter(Boolean);
  return parts.join(' · ');
}
const airLabel = m => m.nx ? 'EP ' + m.nx.ep + ' · ' + D3[new Date(m.nx.at * 1000).getDay()] + ' ' + hhmm(m.nx.at)
  : ({ FINISHED: 'Completed run', RELEASING: 'Airing now', NOT_YET_RELEASED: 'Not yet aired', CANCELLED: 'Cancelled', HIATUS: 'On hiatus' }[m.astatus] || 'AniList');
function descHtml(text, shield) {
  return esc(text).replace(/~!([\s\S]*?)!~/g, (_, t) => `<span class="spoil ${shield ? 'on' : ''}">${t}</span>`).replace(/\n/g, '<br>');
}
const skeleton = n => Array.from({ length: n }, () => '<div class="sk"></div>').join('');

/* ---------- views ---------- */
function heroHtml() {
  const w = entries('watching').sort((a, b) => b.u - a.u)[0];
  if (!w) return `<div class="hero empty"><div class="hero-card"><div style="flex:1;min-width:0"><div class="t">Nothing in progress</div><div class="eyebrow" style="margin-top:4px">Search an anime and add it to your library</div></div>
    <a class="play" href="#/search" aria-label="Search anime">${I.search}</a></div></div>`;
  const cur = (w.p || 0) + 1, tot = totalEps(w), left = Math.max(0, tot - (w.p || 0));
  const jp = /[぀-ヿ一-鿿]/.test(w.native || '') ? w.native.slice(0, 8) : '';
  return `<a class="hero" href="#/a/${w.id}" aria-label="Continue ${esc(w.title)}, episode ${cur}" style="background:${esc(safeColor(w.color, '#1A1633'))}">
    <img class="hero-img" src="${esc(w.coverXL || w.cover)}" alt="" decoding="async"><i class="ht"></i>
    ${jp ? `<div class="vtitle outline" aria-hidden="true">${esc(jp)}</div>` : ''}<div class="sfx outline" aria-hidden="true">ドン!</div>
    <div class="hero-card"><div style="flex:1;min-width:0"><div class="eyebrow">EP.${pad(cur)}${tot ? ' · ' + left + ' EPS LEFT' : ''}</div>
      <div class="t">${esc(w.title)}</div><div class="bar"><i style="width:${tot ? Math.round((w.p || 0) / tot * 100) : 0}%"></i></div></div>
      <div class="play">${I.play}</div></div></a>`;
}
function moodHtml() {
  const hit = qcache.get('m|' + DB.prefs.mood);
  if (ui.moodErr) return `<div class="err-panel" role="alert">${esc(ui.moodErr)}<button type="button" class="more" data-action="moodRetry">Try again</button></div>`;
  if (!hit) return skeleton(2);
  const list = hit.list.filter(m => !liveEntry(m.id)).slice(0, 4);
  return list.length ? `<div class="res-list">${list.map(m => `<a class="res" href="#/a/${m.id}">${cv(m)}<div class="res-info"><span class="nm">${esc(m.title)}</span><div class="sub">${esc(fmtLine(m))}</div></div></a>`).join('')}</div>`
    : '<div class="empty-panel">You already have everything popular in this mood. Try another one.</div>';
}
async function loadMood() {
  const mood = DB.prefs.mood;
  if (qcache.get('m|' + mood) || ui.moodErr) return;
  try { await discoverMood(mood); } catch (e) { ui.moodErr = e.message; }
  const box = $('#moodList'); if (box && DB.prefs.mood === mood) box.innerHTML = moodHtml();
}
function viewHome() {
  const now = new Date(), h = now.getHours(), night = h >= 17 || h < 4;
  const initial = esc(userName().charAt(0).toUpperCase() || 'H');
  const today = entries().filter(e => (e.s === 'watching' || e.s === 'planned') && e.nx && sameDay(new Date(e.nx.at * 1000), now)).sort((a, b) => a.nx.at - b.nx.at);
  const airing = today.length ? `<div class="hscroll">${today.map(e => {
    const tag = e.nx.at <= nowS() ? 'Aired' : fmtLeft(e.nx.at - nowS());
    return `<a class="air-card" href="#/a/${e.id}"><div class="poster" style="background:${esc(safeColor(e.color, '#B79CFF'))}"><img class="hero-img" src="${esc(e.cover || e.coverXL)}" alt="" loading="lazy"><span class="time">${esc(tag)}</span></div>
      <div class="air-title">${esc(e.title)}</div><div class="air-ep">EP ${e.nx.ep}</div></a>`; }).join('')}</div>`
    : `<div class="empty-panel"><span class="silent" aria-hidden="true">シーン…</span>${entries('watching').length ? 'Nothing from your library airs today.' : 'Add shows to your library and today\'s episodes show up here.'}</div>`;
  return `<div class="screen">
    <div class="top"><div><div class="tag-row"><span class="kanji-tag" style="background:var(--yellow)">${night ? '今夜' : '今日'}</span><span class="eyebrow">${D3[now.getDay()]} · ${now.getDate()} ${MON[now.getMonth()]}</span></div>
      <h1 class="h1" tabindex="-1">${night ? "Tonight's" : "Today's"} Watch</h1></div>
      <a class="sq lav" href="#/me" aria-label="Open profile">${initial}</a></div>
    ${heroHtml()}
    <section><div class="sec-head"><h2 class="h2">Airing Today</h2><a class="link-u" href="#/week">See week</a></div>${airing}</section>
    <section><h2 class="h2" style="margin-bottom:10px">Pick By Mood</h2>
      <div class="chips" role="group" aria-label="Mood">${Object.keys(MOODS).map(m => `<button type="button" class="chip-btn" data-action="mood" data-arg="${esc(m)}" aria-pressed="${DB.prefs.mood === m}">${esc(m)}</button>`).join('')}</div>
      <div id="moodList" style="margin-top:8px">${moodHtml()}</div></section>
  </div>`;
}

/* search */
function resRow(m) {
  const e = liveEntry(m.id);
  return `<article class="res"><a class="cv-link" href="#/a/${m.id}" tabindex="-1" aria-hidden="true">${cv(m)}</a>
    <div class="res-info"><a class="nm" href="#/a/${m.id}">${esc(m.title)}</a><div class="sub">${esc(fmtLine(m))}</div>${e ? badge(e) : ''}</div>
    <a class="vbtn" href="#/a/${m.id}" aria-label="View ${esc(m.title)}">VIEW</a></article>`;
}
function resultsHtml() {
  if (ui.err) return `<div class="err-panel" role="alert">${esc(ui.err)}<button type="button" class="more" data-action="retrySearch">Try again</button></div>`;
  if (ui.results === null) return skeleton(4);
  const head = ui.q ? `<div class="eyebrow" style="margin-bottom:10px">${ui.results.length ? 'Results for “' + esc(ui.q) + '”' : ''}</div>` : '<div class="eyebrow" style="margin-bottom:10px">Trending now on AniList</div>';
  if (!ui.results.length) return `<div class="empty-panel"><span class="silent" aria-hidden="true">シーン…</span>No anime found for “${esc(ui.q)}”. Try the romaji or English title.</div>`;
  return head + `<div class="res-list">${ui.results.map(resRow).join('')}</div>` +
    (ui.hasNext ? `<div style="display:flex;justify-content:center;margin-top:14px"><button type="button" class="more" data-action="moreResults"${ui.loading ? ' disabled' : ''}>${ui.loading ? 'Loading…' : 'Load more'}</button></div>` : '');
}
async function runSearch(q, page = 1) {
  q = q.trim(); const seq = ++ui.searchSeq;
  ui.q = q; ui.err = ''; ui.loading = true;
  if (page === 1) { ui.results = null; ui.page = 1; }
  paintResults();
  try {
    const r = await searchAnime(q, page);
    if (seq !== ui.searchSeq) return;
    ui.results = page === 1 ? r.list : (ui.results || []).concat(r.list); ui.hasNext = r.hasNext; ui.page = page;
  } catch (e) { if (seq !== ui.searchSeq) return; ui.err = e.message; }
  ui.loading = false; paintResults();
}
function paintResults() { const box = $('#results'); if (box) box.innerHTML = resultsHtml(); }
function viewSearch() {
  return `<div class="screen">
    <div class="top"><div><div class="tag-row"><span class="kanji-tag" style="background:var(--pink)">探す</span><span class="eyebrow">POWERED BY ANILIST</span></div><h1 class="h1" tabindex="-1">Find Anime</h1></div></div>
    <form class="searchbar" role="search" data-form="search"><label class="vh" for="q">Search anime</label>${I.search}
      <input id="q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Try One Piece or Dandadan" value="${esc(ui.q)}"><button type="submit" class="go">GO</button></form>
    <div id="results" aria-live="polite">${resultsHtml()}</div></div>`;
}

/* week */
function slotPill(e, now) {
  if (e.nx.at <= nowS()) return e.s === 'watching' ? `<a class="pill pink" href="#/a/${e.id}">Watch now</a>` : '<span class="pill">Aired</span>';
  const l = fmtLeft(e.nx.at - nowS());
  return e.rem ? `<button type="button" class="pill cyan" data-action="remind" data-arg="${e.id}" aria-pressed="true">${I.bell}Reminder on</button>`
    : `<button type="button" class="pill yellow" data-action="remind" data-arg="${e.id}" aria-pressed="false" aria-label="In ${esc(l)}. Tap to set a reminder">${I.bell}In ${esc(l)}</button>`;
}
function daySection(date, label, now) {
  const list = entries().filter(e => (e.s === 'watching' || (!DB.prefs.weekOnly && e.s === 'planned')) && e.nx && sameDay(new Date(e.nx.at * 1000), date)).sort((a, b) => a.nx.at - b.nx.at);
  const body = list.length ? `<div class="slots">${list.map(e => `<div class="slot"><div class="stamp">${hhmm(e.nx.at)}</div>
    <article class="slot-card"><span class="cv" style="width:56px;height:76px;border-radius:10px;border:2.5px solid var(--ink);background:${esc(safeColor(e.color, '#B79CFF'))}"><img src="${esc(e.cover || e.coverXL)}" alt="" loading="lazy"></span>
      <div style="min-width:0"><a class="nm" href="#/a/${e.id}">${esc(e.title)}</a><div class="ep">EP ${e.nx.ep}</div>${slotPill(e, now)}</div></article></div>`).join('')}</div>`
    : `<div class="empty-panel"><span class="silent" aria-hidden="true">シーン…</span>No episodes from your library on this day.</div>`;
  return `<div style="display:flex;flex-direction:column;gap:12px"><div class="banner">${label}</div>${body}</div>`;
}
function viewWeek() {
  const now = new Date(), dates = weekDates(now);
  if (!ui.selDay || !dates.some(d => dkey(d) === ui.selDay)) ui.selDay = dkey(now);
  const strip = dates.map(d => {
    const k = dkey(d), sel = k === ui.selDay, isT = sameDay(d, now), wd = d.getDay();
    const has = entries().some(e => (e.s === 'watching' || (!DB.prefs.weekOnly && e.s === 'planned')) && e.nx && sameDay(new Date(e.nx.at * 1000), d));
    return `<button type="button" class="day" data-action="day" data-arg="${k}" aria-pressed="${sel}" aria-label="${DAYN[wd]} ${d.getDate()} ${MON[d.getMonth()]}${isT ? ', today' : ''}">
      <span class="k">${KANJI[wd]}</span><span class="n">${d.getDate()}</span><span class="dot" style="background:${has ? (sel ? '#1A1633' : '#FF5C8A') : 'transparent'}"></span></button>`; }).join('');
  const selDate = dates.find(d => dkey(d) === ui.selDay) || now;
  const diff = Math.round((new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  const lab = diff === 0 ? 'TODAY' : diff === 1 ? 'TOMORROW' : DAYN[selDate.getDay()].toUpperCase();
  let sections = daySection(selDate, lab + ' · ' + selDate.getDate() + ' ' + MON[selDate.getMonth()], now);
  if (diff === 0) { const tm = new Date(selDate); tm.setDate(tm.getDate() + 1); sections += daySection(tm, 'TOMORROW', now); }
  const none = !entries().some(e => e.nx && (e.s === 'watching' || e.s === 'planned'));
  return `<div class="screen">
    <div class="top"><div><div class="tag-row"><span class="kanji-tag" style="background:var(--cyan)">今週</span><span class="eyebrow">LOCAL TIME</span></div><h1 class="h1" tabindex="-1">This Week</h1></div>
      <button type="button" class="sq" data-action="weekOnly" aria-pressed="${DB.prefs.weekOnly}" aria-label="Only show titles I am watching">${I.filter}</button></div>
    <div class="days" role="group" aria-label="Day of the week">${strip}</div>
    ${none ? '<div class="empty-panel">Episodes appear here for airing shows in your library. <a class="link-u" href="#/search">Find one</a></div>' : ''}${sections}</div>`;
}

/* detail */
function viewDetail(m) {
  const e = liveEntry(m.id), c = safeColor(m.color), wash = mixHex(c, CREAM, .6);
  const st = e ? STM[e.s] : null, tot = totalEps(m), p = e ? e.p || 0 : 0;
  const reward = lvFor(Math.max(tot, p, 1)), img = m.banner || m.coverXL || m.cover;
  const jp = /[぀-ヿ一-鿿]/.test(m.native || '') ? m.native.slice(0, 8) : '';
  const cap = e ? maxEp(e) : 0;
  const prog = e && (e.s === 'watching' || e.s === 'paused') ? `<div class="panel"><div class="p-head"><div class="l">PROGRESS</div><div class="r">${p} / ${tot || '?'}</div></div>
      <div class="pbar" role="img" aria-label="${p} of ${tot || 'unknown'} episodes watched"><i style="width:${tot ? Math.round(p / tot * 100) : 0}%;background:${c}"></i></div>
      <div class="btnrow" style="margin-top:8px"><button type="button" class="linkbtn" data-action="setEp" data-arg="${m.id}">SET EPISODE</button>${p > 0 ? `<button type="button" class="linkbtn" data-action="undo" data-arg="${m.id}">UNDO LAST EPISODE</button>` : ''}</div></div>` : '';
  const mark = e && e.s === 'watching'
    ? (p >= cap ? `<div class="reward"><span>You are caught up with every aired episode.${m.nx ? ' Next: ' + esc(airLabel(m)) + '.' : ''}</span></div>`
      : `<div class="btn-wrap"><button type="button" class="btn" style="background:${c}" data-action="watchNext" data-arg="${m.id}">${I.check}MARK EP ${p + 1} WATCHED</button><div class="plus ${ui.popId === m.id ? 'pop' : ''}" aria-hidden="true">+1</div></div>`) : '';
  const libBtn = e
    ? `<button type="button" class="lib-btn" style="background:${st.col}" data-action="openLib" data-arg="${m.id}">IN LIBRARY <small>${esc(st.label.toUpperCase())} · CHANGE</small></button>`
    : `<button type="button" class="lib-btn" style="background:var(--pink)" data-action="openLib" data-arg="${m.id}">${I.plus}LIBRARY</button>`;
  const rewardLine = e && e.s === 'finished' ? `<div class="reward"><b>+${lvFor(Math.max(tot, p))} LV</b><span>earned for finishing this title.</span></div>`
    : `<div class="reward"><b>+${reward} LV</b><span>when you finish it${tot ? ' (' + tot + ' eps)' : ''}. <button type="button" class="linkbtn" data-action="levelInfo">How levels work</button></span></div>`;
  const hasSpoil = /~!/.test(m.desc || '');
  const syn = m.desc === undefined ? (failed.has(m.id) ? '<p class="meta">Synopsis unavailable offline.</p>' : '<div class="sk" style="height:70px"></div>')
    : m.desc ? `<p>${descHtml(m.desc, ui.spoilerOn)}</p>` : '<p class="meta">No synopsis on AniList yet.</p>';
  return `<div class="screen detail" style="background:radial-gradient(rgba(26,22,51,.09) 1.3px,transparent 1.8px) 0 0/10px 10px,linear-gradient(180deg,${wash} 0,${CREAM} 320px)">
    <div class="dbar"><a class="sq" href="#/home" data-action="back" aria-label="Back">${I.back}</a><div class="slant">${st ? esc(st.label.toUpperCase()) : 'ANILIST'}</div><a class="sq" href="#/search" aria-label="Search">${I.search}</a></div>
    <div class="pl"><div class="pl-bg" style="background:${c}">${img ? `<img src="${esc(img)}" alt="" decoding="async">` : ''}<i class="ht"></i></div>
      ${jp ? `<div class="vtitle outline" aria-hidden="true" style="left:auto;right:16px;top:12px;font-size:20px">${esc(jp)}</div>` : ''}
      <span class="cv pl-cover">${m.cover || m.coverXL ? `<img src="${esc(m.cover || m.coverXL)}" alt="Poster of ${esc(m.title)}">` : ''}</span>
      <div class="next">${esc(airLabel(m))}</div></div>
    <div class="title-block"><div class="gchips" style="padding-left:124px;min-height:22px">${(m.genres || []).slice(0, 2).map((g, i) => `<span class="gchip" style="background:${['#4FD8F0', '#B79CFF'][i]}">${esc(g)}</span>`).join('')}</div>
      <h1 class="d-title" tabindex="-1" style="margin-top:22px;text-shadow:3px 3px 0 ${c}">${esc(m.title)}</h1>
      <div class="meta">${esc(fmtLine(m))}${m.romaji && m.romaji !== m.title ? '<br>' + esc(m.romaji) : ''}</div></div>
    ${libBtn}${prog}${mark}${rewardLine}
    <div class="panel syn">${hasSpoil ? `<button type="button" class="shield" data-action="shield" aria-pressed="${ui.spoilerOn}">Spoiler shield ${ui.spoilerOn ? 'on' : 'off'}</button>` : '<div class="shield" style="pointer-events:none">Synopsis</div>'}${syn}</div>
    <section id="reviews" class="reviews">${reviewsHtml(m.id)}</section>
    <div class="meta" style="text-align:center">Data from AniList</div></div>`;
}
function viewLoading(id) {
  const msg = failed.get(id);
  return `<div class="screen"><div class="dbar"><a class="sq" href="#/search" aria-label="Back to search">${I.back}</a><div class="slant">ANILIST</div><span style="width:44px"></span></div>
    ${msg ? `<div class="err-panel" role="alert">${esc(msg)}<button type="button" class="more" data-action="retryDetail" data-arg="${id}">Try again</button></div>` : skeleton(3)}</div>`;
}

/* profile */
function accountPanel() {
  const row = (...b) => `<div class="row">${b.join('')}</div>`;
  const btn = (act, label, col, arg = '') => `<button type="button" class="act" style="background:var(--${col})" data-action="${act}" data-arg="${arg}">${label}</button>`;
  const common = row(btn('exportData', 'Download backup', 'cyan'), btn('importData', 'Restore backup', 'yellow'));
  if (!session) return `<div class="panel acct"><div class="lbl">ACCOUNT</div><p>You are a guest. Your list lives only in this browser. Register to keep it under your own name${CLOUD ? ' and sync it across devices' : ''}.</p>
    ${row(btn('goAuth', 'Register', 'pink', 'register'), btn('goAuth', 'Sign in', 'lav', 'login'))}${common}</div>`;
  const where = session.mode === 'cloud'
    ? `<p class="who">${esc(session.email || session.name)}</p><p class="${sync.state === 'error' ? 'pill-err' : sync.state === 'ok' ? 'pill-ok' : ''}">${sync.state === 'syncing' ? 'Syncing…' : sync.state === 'ok' ? 'Synced ' + hhmm(sync.at / 1000) : sync.state === 'error' ? 'Sync problem: ' + esc(sync.err) : 'Cloud account'}</p>`
    : `<p class="who">@${esc(session.name)}</p><p>Device account. Your list is saved on this device only. Download a backup now and then.</p>`;
  return `<div class="panel acct"><div class="lbl">ACCOUNT</div>${where}
    ${row(session.mode === 'cloud' ? btn('syncNow', 'Sync now', 'pink') : '', session.mode === 'cloud' ? btn('blockedList', 'Blocked users', 'cyan') : '', btn('logout', 'Log out', 'lav'))}${common}</div>`;
}
function fanHtml(st, name, own) {
  const initial = esc(String(name || "H").charAt(0).toUpperCase() || "H");
  const max = st.genres[0] ? st.genres[0][1] : 1, gcol = ['#FF5C8A', '#FFB36B', '#B79CFF'];
  const genres = st.genres.length ? st.genres.map((g, i) => `<div class="grow"><div>${esc(g[0])}</div><div class="stripe-bar"><i style="width:${Math.round(18 + 82 * g[1] / max)}%;background:repeating-linear-gradient(90deg,${gcol[i]} 0 10px,#fff 10px 12px)"></i></div></div>`).join('')
    : `<div class="note">${own ? 'Mark some episodes watched and your genres show up here.' : 'No genres yet.'}</div>`;
  const top = [0, 1, 2].map(i => st.top[i] ? `<a href="#/a/${st.top[i].id}" aria-label="${i + 1}. ${esc(st.top[i].title)}">${cv(st.top[i])}<span class="rank">${i + 1}</span></a>` : '<div class="slot-empty" aria-hidden="true">?</div>').join('');
  return `<div class="fan"><div class="fan-head"><div class="fan-id"><div class="fan-av">${initial}</div><div style="min-width:0"><b>@${esc(name)}</b><small>${esc(st.rank)}</small></div></div><div class="lv">LV.${st.level}</div></div>
      <div class="fan-body">
        <div class="big"><div><div class="n">${st.hours}</div><div class="u">HOURS WATCHED</div></div><div class="season">${esc(st.season)}</div></div>
        <div class="stats"><${own ? 'a' : 'div'} class="stat"${own ? ' href="#/list/finished"' : ''} style="background:var(--cyan)"><b>${st.counts.finished}</b><span>finished</span></${own ? 'a' : 'div'}><${own ? 'a' : 'div'} class="stat"${own ? ' href="#/list/watching"' : ''} style="background:var(--lav)"><b>${st.counts.watching}</b><span>watching now</span></${own ? 'a' : 'div'}></div>
        ${st.pending ? `<div class="note">Finish what you are watching for <b>+${st.pending} LV</b>.</div>` : ''}
        <div><div class="lbl">TOP GENRES</div>${genres}</div>
        <div><div class="lbl">ALL-TIME TOP 3</div><div class="top3">${top}</div></div></div></div>`;
}
function viewMe() {
  const st = stats();
  const tiles = [['finished', '--cyan'], ['watching', '--pink'], ['paused', '--yellow'], ['planned', '--lav'], ['dropped', '#FFB36B']].map(([k, col], i, a) =>
    `<a class="tile${i === a.length - 1 && a.length % 2 ? ' wide' : ''}" href="#/list/${k}" style="background:${col.startsWith('--') ? 'var(' + col + ')' : col}"><b>${st.counts[k]}</b><span>${esc(STM[k].label)}</span></a>`).join('');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone, ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const inst = standalone ? '' : deferredInstall ? '<div class="install"><span>Install Hoshi on your home screen to use it like an app.</span><button type="button" data-action="install">INSTALL</button></div>'
    : ios ? '<div class="install"><span>On iPhone: tap the Share button in Safari, then <b>Add to Home Screen</b>.</span></div>' : '';
  return `<div class="screen">
    <div class="top"><div><div class="tag-row"><span class="kanji-tag" style="background:var(--lav)">私</span><span class="eyebrow">PROFILE</span></div><h1 class="h1" tabindex="-1">Fan Card</h1></div>
      <button type="button" class="sq" data-action="levelInfo" aria-label="How levels work">?</button></div>
    ${fanHtml(st, userName(), true)}
    <div class="actions">
      <button type="button" class="act" style="background:var(--pink)" data-action="story">${I.share}Story</button>
      <button type="button" class="act" style="background:var(--cyan)" data-action="discord">${I.chat}Discord</button>
      <button type="button" class="act" style="background:var(--yellow)" data-action="savePng">${I.dl}Save</button></div>
    <section><h2 class="h2" style="margin-bottom:12px">My Lists</h2><div class="tiles">${tiles}</div></section>
    <a class="newsrow" href="#/friends"><span class="kanji-tag" style="background:var(--cyan)">友</span><div><b>Friends</b><small>Find fans and see their Fan Cards</small></div><span aria-hidden="true">›</span></a>
    ${accountPanel()}${inst}</div>`;
}
function viewList(k) {
  const s = STM[k]; if (!s) { location.hash = '#/me'; return ''; }
  const list = entries(k).sort((a, b) => (b.u || 0) - (a.u || 0));
  const phrase = { finished: 'finished', watching: 'currently watching', paused: 'paused', planned: 'on your plan-to-watch list', dropped: 'dropped' }[k];
  const rows = list.map(e => {
    const tot = totalEps(e);
    const sub = k === 'finished' ? `${tot || e.p} episodes` : k === 'planned' ? esc(fmtLine(e)) : `${k === 'paused' ? 'Paused on' : 'On'} EP ${(e.p || 0) + 1}${tot ? ' of ' + tot : ''}`;
    const right = k === 'finished' ? `<span class="stamp-lv">+${lvOf(e)} LV</span>` : '';
    return `<a class="res" href="#/a/${e.id}">${cv(e)}<div class="res-info"><span class="nm">${esc(e.title)}</span><div class="sub">${sub}</div></div>${right}</a>`;
  }).join('');
  return `<div class="screen"><div class="dbar"><a class="sq" href="#/me" aria-label="Back to profile">${I.back}</a><div class="slant" style="background:${s.col};color:var(--ink)">${esc(s.label.toUpperCase())}</div><span style="width:44px"></span></div>
    <div><h1 class="h1" tabindex="-1" style="margin:0">${esc(s.label)}</h1><div class="meta" style="margin-top:6px">${list.length} anime ${phrase}</div></div>
    ${list.length ? `<div class="res-list">${rows}</div>` : `<div class="empty-panel"><span class="silent" aria-hidden="true">シーン…</span>Nothing here yet. <a class="link-u" href="#/search">Find an anime</a></div>`}</div>`;
}

/* auth */
function viewAuth() {
  const tab = ui.authTab, reg = tab === 'register', reset = tab === 'reset';
  const msg = ui.authMsg ? `<div class="msg ${ui.authMsg.bad ? 'bad' : 'good'}" role="${ui.authMsg.bad ? 'alert' : 'status'}">${esc(ui.authMsg.t)}</div>` : '';
  const vals = ui.authVals || {};
  const f = (label, name, type, extra = '') => `<label class="field">${label}<input name="${name}" type="${type}" required ${extra}${vals[name] && type !== 'password' ? ` value="${esc(vals[name])}"` : ''}></label>`;
  let fields;
  if (reset) fields = f('New password', 'password', 'password', 'minlength="8" autocomplete="new-password"');
  else if (CLOUD) fields = (reg ? f('Username', 'username', 'text', 'minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" title="Letters, numbers and underscore"') : '') + f('Email', 'email', 'email', 'autocomplete="email"') + f('Password', 'password', 'password', `minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"`);
  else fields = f('Username', 'username', 'text', 'minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" title="Letters, numbers and underscore"') + f('Password', 'password', 'password', `minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}"`) + (reg ? f('Repeat password', 'password2', 'password', 'minlength="8" autocomplete="new-password"') : '');
  const note = CLOUD ? 'Your list is saved to your cloud account, so it follows you to any phone or browser.' : 'Device accounts keep your list on this device only. Nothing is uploaded. Download a backup from the Me tab to move it.';
  return `<div class="screen"><div class="top"><div><div class="tag-row"><span class="kanji-tag" style="background:var(--yellow)">入口</span><span class="eyebrow">WELCOME TO HOSHI</span></div><h1 class="h1" tabindex="-1">${reset ? 'New Password' : reg ? 'Join Hoshi' : 'Welcome Back'}</h1></div></div>
    ${reset ? '' : `<div class="tabs" role="group" aria-label="Account"><button type="button" class="tab" data-action="authTab" data-arg="register" aria-pressed="${reg}">Register</button><button type="button" class="tab" data-action="authTab" data-arg="login" aria-pressed="${!reg}">Sign in</button></div>`}
    <form class="form" data-form="auth" novalidate>${msg}${fields}<button type="submit" class="big-go"${ui.busy ? ' disabled' : ''}>${ui.busy ? 'ONE MOMENT…' : reset ? 'SAVE PASSWORD' : reg ? 'CREATE ACCOUNT' : 'SIGN IN'}</button>
      ${CLOUD && !reg && !reset ? '<button type="button" class="linkbtn" data-action="forgot" style="align-self:flex-start">Forgot password?</button>' : ''}</form>
    <p class="note">${note}</p>
    <button type="button" class="more" data-action="guest">Continue as guest</button></div>`;
}

/* ---------- reviews (Supabase tables: reviews, reports, blocks) ---------- */
const curId = () => { const r = route(); return r.p === 'a' ? parseInt(r.id, 10) : NaN; };
async function cloudReq(path, o = {}) {
  if (session && session.mode === 'cloud') {
    if (!await ensureToken()) throw new Error('Your session expired. Sign in again.');
    o = Object.assign({ token: true }, o);
  }
  return sb(path, o);
}
async function loadBlocks() {
  if (!(session && session.mode === 'cloud')) { ui.blocks = {}; return; }
  const rows = await cloudReq('/rest/v1/blocks?select=blocked_id,blocked_name');
  ui.blocks = Object.fromEntries((rows || []).map(r => [r.blocked_id, r.blocked_name || 'user']));
}
async function loadReviews(id, force) {
  if (!CLOUD) return;
  const c = revs.get(id);
  if (!force && c && Date.now() - c.at < 60000) return;
  if (c && c.loading) return;
  if (!c) { revs.set(id, { loading: true, at: 0 }); paintReviews(id); }
  try {
    const [rows] = await Promise.all([
      cloudReq(`/rest/v1/reviews?select=id,user_id,username,score,body,spoiler,created_at&anime_id=eq.${id}&order=created_at.desc&limit=100`),
      ui.blocks ? null : loadBlocks().catch(() => { ui.blocks = {}; })
    ]);
    revs.set(id, { st: 'ok', list: rows || [], at: Date.now() });
  } catch (e) { revs.set(id, { st: 'err', err: e.message, list: c && c.list, at: Date.now() - 55000 }); }
  paintReviews(id);
}
function paintReviews(id) { const box = $('#reviews'); if (box && curId() === id) box.innerHTML = reviewsHtml(id); }
function reviewCard(x, me, id) {
  const own = x.user_id === me, hide = x.spoiler && !own && !ui.revealed.has(x.id), d = new Date(x.created_at);
  const acts = own ? `<button type="button" class="linkbtn" data-action="delReview" data-arg="${esc(x.id)}|${id}">DELETE</button>`
    : me ? `<button type="button" class="linkbtn" data-action="reportReview" data-arg="${esc(x.id)}">REPORT</button><button type="button" class="linkbtn" data-action="blockUser" data-arg="${esc(x.user_id)}|${esc(x.username)}">BLOCK</button>` : '';
  return `<article class="rv"><div class="rv-head"><div><b>@${esc(x.username)}</b>${own ? ' <span class="badge" style="background:var(--yellow)">You</span>' : ''}
    <div class="sub">${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}${x.spoiler ? ' · SPOILERS' : ''}</div></div><span class="rv-score">${x.score}<small>/10</small></span></div>
    ${hide ? `<button type="button" class="rv-hide" data-action="reveal" data-arg="${esc(x.id)}">This review has spoilers. Tap to read.</button>` : `<p>${esc(x.body).replace(/\n/g, '<br>')}</p>`}
    ${acts ? `<div class="btnrow">${acts}</div>` : ''}</article>`;
}
function reviewsHtml(id) {
  if (!CLOUD) return '';
  const r = revs.get(id), me = session && session.mode === 'cloud' ? session.uid : null;
  const head = (sum = '') => `<div class="rv-sum"><h2 class="h2">Reviews</h2><span class="meta">${sum}</span></div>`;
  if (!r || r.loading) return head() + skeleton(2);
  if (r.st === 'err' && !r.list) return head() + `<div class="err-panel" role="alert">${esc(r.err)}<button type="button" class="more" data-action="retryReviews" data-arg="${id}">Try again</button></div>`;
  const all = r.list || [], blocked = ui.blocks || {}, list = all.filter(x => !blocked[x.user_id]);
  const avg = all.length ? (all.reduce((n, x) => n + x.score, 0) / all.length).toFixed(1) : null;
  const mine = me && all.find(x => x.user_id === me), e = liveEntry(id);
  const cta = !me ? `<a class="lib-btn" style="background:var(--yellow)" href="#/auth" data-action="goAuth" data-arg="login">Sign in to write a review</a>`
    : !e ? '<p class="hint">Add this anime to your library to review it.</p>'
    : `<button type="button" class="lib-btn" style="background:var(--pink)" data-action="writeReview" data-arg="${id}">${mine ? 'EDIT YOUR REVIEW' : 'WRITE A REVIEW'}</button>`;
  return head(avg ? `★ ${avg} from ${all.length} Hoshi fan${all.length === 1 ? '' : 's'}` : '') + cta +
    (list.length ? list.map(x => reviewCard(x, me, id)).join('') : `<div class="empty-panel"><span class="silent" aria-hidden="true">シーン…</span>${all.length ? 'Everything here is from people you blocked.' : 'No reviews yet. Be the first.'}</div>`) +
    (r.st === 'err' ? `<p class="hint">Could not refresh: ${esc(r.err)}</p>` : '');
}
function openReviewSheet(id) {
  const m = getM(id), r = revs.get(id); if (!m) return;
  const mine = r && r.list && r.list.find(x => x.user_id === session.uid);
  sheet.innerHTML = `<form class="sheet" data-form="review" data-id="${id}" method="dialog">${sheetHead(mine ? 'Edit review' : 'Write a review')}
    <div class="sheet-body"><div class="sheet-cover">${cv(m)}<b>${esc(m.title)}</b></div>
      <fieldset><legend>Your score</legend><div class="opts" role="radiogroup" aria-label="Score from 1 to 10">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n =>
        `<label class="opt num"><input type="radio" name="score" value="${n}"${mine && mine.score === n ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div></fieldset>
      <label class="field">Your review<textarea name="body" maxlength="2000" placeholder="What did you think? Keep it kind.">${esc(mine ? mine.body : '')}</textarea></label>
      <div class="opts"><label class="opt"><input type="checkbox" name="spoiler"${mine && mine.spoiler ? ' checked' : ''}><span>Contains spoilers</span></label></div>
      <p class="hint">Reviews are public. Others can report them, and reviews that break the rules get removed.</p>
      <p id="rvErr" class="msg bad" role="alert" hidden></p></div>
    <div class="sheet-foot"><button type="submit" class="sbtn go">${mine ? 'SAVE REVIEW' : 'POST REVIEW'}</button></div></form>`;
  if (!sheet.open) sheet.showModal();
}
async function submitReview(f) {
  const id = +f.dataset.id, d = new FormData(f), score = parseInt(d.get('score'), 10), body = String(d.get('body') || '').trim();
  const err = $('#rvErr'), bad = t => { err.textContent = t; err.hidden = false; };
  if (!(score >= 1 && score <= 10)) return bad('Pick a score from 1 to 10.');
  if (body.length < 10) return bad('Write at least a sentence (10 characters).');
  const btn = $('button[type=submit]', f); btn.disabled = true;
  try {
    await cloudReq('/rest/v1/reviews?on_conflict=anime_id,user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: { anime_id: id, score, body, spoiler: d.get('spoiler') === 'on' } });
    sheet.close(); await loadReviews(id, true); toast('Review posted');
  } catch (e) { bad(e.message); btn.disabled = false; }
}
function openReport(rid) {
  sheet.innerHTML = `<div class="sheet">${sheetHead('Report review')}<div class="sheet-body"><p class="hint">Why are you reporting this review?</p>
    <div class="optlist">${['Spam or advertising', 'Abusive or hateful', 'Spoilers not marked', 'Something else'].map(t => `<button type="button" class="stbtn" data-action="sendReport" data-arg="${esc(rid)}|${esc(t)}">${esc(t)}</button>`).join('')}</div></div></div>`;
  if (!sheet.open) sheet.showModal();
}
function paintBlocked() {
  const box = $('#blockBody'); if (!box) return; const ids = Object.keys(ui.blocks || {});
  box.innerHTML = ids.length ? `<div class="optlist">${ids.map(id => `<div class="res"><div class="res-info"><span class="nm">@${esc(ui.blocks[id])}</span></div><button type="button" class="vbtn" data-action="unblock" data-arg="${esc(id)}">UNBLOCK</button></div>`).join('')}</div>` : '<p class="hint">You have not blocked anyone.</p>';
}
async function openBlocked() {
  sheet.innerHTML = `<div class="sheet">${sheetHead('Blocked users')}<div class="sheet-body" id="blockBody">${skeleton(1)}</div></div>`;
  if (!sheet.open) sheet.showModal();
  try { await loadBlocks(); paintBlocked(); } catch (e) { const b = $('#blockBody'); if (b) b.innerHTML = `<div class="err-panel" role="alert">${esc(e.message)}</div>`; }
}

/* ---------- friends (Supabase tables: profiles, friends) ---------- */
const FR = { st: 'idle', list: [], ids: new Set(), err: '', at: 0, q: '', res: null, resErr: '', seq: 0, cards: new Map() };
const isCloud = () => !!(CLOUD && session && session.mode === 'cloud');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let lastCard = '';
function cardSnap() {
  const st = stats();
  return { level: st.level, rank: st.rank, hours: st.hours, season: st.season, genres: st.genres, counts: st.counts,
    top: st.top.map(e => ({ id: e.id, title: e.title, cover: e.cover || e.coverXL || '', color: e.color || '' })) };
}
/* Cards come from other people's phones, so every field is re-checked before it is drawn. */
function cleanCard(c) {
  c = c && typeof c === 'object' ? c : {};
  const n = (v, max) => clamp(Math.floor(Number(v)) || 0, 0, max), t = (v, l) => String(v == null ? '' : v).slice(0, l);
  const counts = {}; ST.forEach(x => { counts[x.k] = n(c.counts && c.counts[x.k], 5000); });
  return { level: Math.max(1, n(c.level, 9999)), rank: t(c.rank, 30), hours: n(c.hours, 999999), season: t(c.season, 20), counts, pending: 0,
    genres: (Array.isArray(c.genres) ? c.genres : []).slice(0, 3).map(g => Array.isArray(g) ? [t(g[0], 30), n(g[1], 99999)] : ['', 0]).filter(g => g[0]),
    top: (Array.isArray(c.top) ? c.top : []).slice(0, 3).filter(x => x && n(x.id, 1e8) > 0).map(x => ({ id: n(x.id, 1e8), title: t(x.title, 120),
      cover: /^https:\/\/s4\.anilist\.co\//.test(x.cover) ? String(x.cover) : '', color: safeColor(x.color, '#B79CFF') })) };
}
async function pushProfile(force) {
  if (!isCloud()) return;
  const body = { username: session.name, card: cardSnap(), public: DB.prefs.share !== false }, sig = JSON.stringify(body);
  if (!force && sig === lastCard) return;
  try { await cloudReq('/rest/v1/profiles?on_conflict=user_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body }); lastCard = sig; }
  catch (e) { /* friends tables not set up yet: the rest of the app keeps working */ }
}
const niceErr = e => /relation|schema cache|does not exist|404/i.test(e.message) ? 'Friends are not switched on yet. The app owner needs to run supabase-friends.sql.' : e.message;
async function loadFriends(force) {
  if (!isCloud() || FR.st === 'loading') return;
  if (!force && FR.st === 'ok' && Date.now() - FR.at < 30000) return;
  FR.st = 'loading'; if (!FR.list.length) paintFriends();
  try {
    const rows = await cloudReq('/rest/v1/friends?select=friend_id&order=created_at.desc&limit=200');
    const ids = (rows || []).map(r => r.friend_id).filter(i => UUID.test(i)); let list = [];
    if (ids.length) {
      const ps = await cloudReq('/rest/v1/profiles?select=user_id,username,lvl:card->level&user_id=in.(' + ids.join(',') + ')');
      const m = new Map((ps || []).map(p => [p.user_id, p])); list = ids.map(i => m.get(i)).filter(Boolean);
    }
    FR.ids = new Set(ids); FR.list = list; FR.st = 'ok'; FR.at = Date.now(); FR.err = '';
  } catch (e) { FR.st = 'err'; FR.err = niceErr(e); FR.at = Date.now() - 25000; }
  paintFriends();
}
async function searchUsers(raw) {
  FR.q = String(raw || ''); const q = FR.q.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20), seq = ++FR.seq;
  if (q.length < 2) { FR.res = null; FR.resErr = ''; paintFriends(); return; }
  FR.res = 'loading'; FR.resErr = ''; paintFriends();
  try {
    const rows = await cloudReq(`/rest/v1/profiles?select=user_id,username,lvl:card->level&username_lc=like.${q}*&user_id=neq.${session.uid}&order=username_lc.asc&limit=20`);
    if (seq !== FR.seq) return; FR.res = rows || [];
  } catch (e) { if (seq !== FR.seq) return; FR.res = null; FR.resErr = niceErr(e); }
  paintFriends();
}
function userRow(p) {
  const on = FR.ids.has(p.user_id), lv = Math.max(1, parseInt(p.lvl, 10) || 1);
  return `<div class="res"><a class="res-info" href="#/u/${esc(p.user_id)}" style="flex:1;min-width:0;display:flex;align-items:center;gap:12px"><span class="fan-av">${esc(String(p.username).charAt(0).toUpperCase())}</span>
    <span style="min-width:0"><span class="nm">@${esc(p.username)}</span><span class="sub" style="display:block">LV.${lv}</span></span></a>
    <button type="button" class="vbtn" data-action="${on ? 'removeFriend' : 'addFriend'}" data-arg="${esc(p.user_id)}"${on ? ' style="background:#fff"' : ''}>${on ? 'FRIEND ✓' : 'ADD'}</button></div>`;
}
function friendsBody() {
  const q = FR.q.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const res = FR.res === 'loading' ? skeleton(1) : FR.resErr ? `<div class="err-panel" role="alert">${esc(FR.resErr)}</div>`
    : FR.res === null ? (q.length === 1 ? '<p class="hint">Type at least 2 letters.</p>' : '')
    : FR.res.length ? FR.res.map(userRow).join('') : '<div class="empty-panel"><span class="silent" aria-hidden="true">誰…</span>Nobody found. Check the spelling.</div>';
  const list = FR.st === 'idle' || (FR.st === 'loading' && !FR.list.length) ? skeleton(2)
    : FR.st === 'err' && !FR.list.length ? `<div class="err-panel" role="alert">${esc(FR.err)}<button type="button" class="more" data-action="retryFriends">Try again</button></div>`
    : FR.list.length ? FR.list.map(userRow).join('') : '<div class="empty-panel"><span class="silent" aria-hidden="true">友…</span>No friends yet. Search a username above.</div>';
  return { res, list };
}
function paintFriends() {
  const r = route();
  if (r.p === 'friends') { const b = friendsBody(), a = $('#frRes'), l = $('#frList'); if (a) a.innerHTML = b.res; if (l) l.innerHTML = b.list; }
  else if (r.p === 'u') paintCard(r.id);
}
function viewFriends() {
  const back = `<div class="dbar"><a class="sq" href="#/me" aria-label="Back to profile">${I.back}</a><div class="slant" style="background:var(--cyan);color:var(--ink)">FRIENDS</div><span style="width:44px"></span></div>`;
  if (!isCloud()) return `<div class="screen">${back}<div class="empty-panel"><span class="silent" aria-hidden="true">友…</span>Friends need a cloud account. ${CLOUD ? 'Register or sign in on the Me tab.' : 'Cloud accounts are not set up in this copy of the app.'}</div></div>`;
  const b = friendsBody(), share = DB.prefs.share !== false;
  return `<div class="screen">${back}
    <div><div class="tag-row"><span class="kanji-tag" style="background:var(--cyan)">友</span><span class="eyebrow">FIND FANS</span></div><h1 class="h1" tabindex="-1">Friends</h1></div>
    <form class="searchbar" data-form="usersearch" role="search"><label class="vh" for="frQ">Search usernames</label>${I.search}
      <input id="frQ" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20" placeholder="Search a username" value="${esc(FR.q)}"><button type="submit" class="go">GO</button></form>
    <section id="frRes" class="reviews">${b.res}</section>
    <section><h2 class="h2" style="margin-bottom:12px">My friends</h2><div id="frList" class="reviews">${b.list}</div></section>
    <div class="panel"><div class="lbl">PRIVACY</div><p>${share ? 'Other Hoshi users can find you by username and see your Fan Card (level, hours, top 3). They never see your email or your full list.' : 'You are hidden. Nobody can find you or open your Fan Card.'}</p>
      <div class="row"><button type="button" class="act" style="padding:10px 18px;background:var(--${share ? 'lav' : 'cyan'})" data-action="toggleShare">${share ? 'Hide my Fan Card' : 'Show my Fan Card'}</button></div></div></div>`;
}
async function loadCard(id) {
  if (!isCloud() || !UUID.test(id || '')) return;
  const c = FR.cards.get(id); if (c && (c.st === 'loading' || (c.st === 'ok' && Date.now() - c.at < 30000))) return;
  FR.cards.set(id, { st: 'loading', at: 0 }); paintCard(id);
  try {
    const rows = await cloudReq('/rest/v1/profiles?select=user_id,username,card&user_id=eq.' + id);
    FR.cards.set(id, rows && rows[0] ? { st: 'ok', name: String(rows[0].username).slice(0, 20), card: cleanCard(rows[0].card), at: Date.now() } : { st: 'none', at: Date.now() });
    if (FR.st === 'idle') loadFriends();
  } catch (e) { FR.cards.set(id, { st: 'err', err: niceErr(e), at: 0 }); }
  paintCard(id);
}
function cardBody(id) {
  const c = FR.cards.get(id);
  if (!c || c.st === 'loading') return skeleton(3);
  if (c.st === 'err') return `<div class="err-panel" role="alert">${esc(c.err)}<button type="button" class="more" data-action="retryCard" data-arg="${esc(id)}">Try again</button></div>`;
  if (c.st === 'none') return '<div class="empty-panel"><span class="silent" aria-hidden="true">誰…</span>This Fan Card is private or does not exist.</div>';
  const on = FR.ids.has(id);
  return fanHtml(c.card, c.name, false) + `<button type="button" class="lib-btn" style="background:var(--${on ? 'lav' : 'pink'})" data-action="${on ? 'removeFriend' : 'addFriend'}" data-arg="${esc(id)}">${on ? 'REMOVE FRIEND' : 'ADD FRIEND'}</button>`;
}
function paintCard(id) { const box = $('#fcard'); if (box && route().id === id) box.innerHTML = cardBody(id); }
function viewUser(id) {
  const back = `<div class="dbar"><a class="sq" href="#/friends" aria-label="Back to friends">${I.back}</a><div class="slant" style="background:var(--lav);color:var(--ink)">FAN CARD</div><span style="width:44px"></span></div>`;
  if (!isCloud() || !UUID.test(id || '')) return `<div class="screen">${back}<div class="empty-panel">Sign in with a cloud account to see Fan Cards.</div></div>`;
  return `<div class="screen">${back}<div id="fcard" class="reviews">${cardBody(id)}</div></div>`;
}

/* ---------- router ---------- */
const view = $('#view');
function route() { const h = location.hash.replace(/^#\/?/, '') || 'home'; const [p, id] = h.split('/'); return { p, id: id ? decodeURIComponent(id) : null }; }
function render(keepScroll) {
  const r = route(), key = r.p + '/' + (r.id || ''), changed = key !== lastRoute; lastRoute = key;
  let html = '', nav = r.p, title = 'Hoshi: Anime Tracker';
  if (r.p === 'a') {
    const id = parseInt(r.id, 10), m = Number.isFinite(id) ? getM(id) : null; nav = null;
    if (Number.isFinite(id)) ensureDetail(id);
    html = m ? viewDetail(m) : viewLoading(id); if (m) title = m.title + ' · Hoshi';
  } else if (r.p === 'search') { html = viewSearch(); title = 'Find Anime · Hoshi'; }
  else if (r.p === 'week') { html = viewWeek(); title = 'This Week · Hoshi'; }
  else if (r.p === 'me') { html = viewMe(); title = 'Fan Card · Hoshi'; }
  else if (r.p === 'friends') { html = viewFriends(); nav = 'me'; title = 'Friends · Hoshi'; }
  else if (r.p === 'u') { html = viewUser(r.id); nav = 'me'; title = 'Fan Card · Hoshi'; }
  else if (r.p === 'list') { html = viewList(r.id); nav = 'me'; title = 'My Lists · Hoshi'; if (!html) return; }
  else if (r.p === 'auth') { html = viewAuth(); nav = null; title = 'Account · Hoshi'; }
  else { html = viewHome(); nav = 'home'; }
  view.innerHTML = html; ui.popId = null; document.title = title;
  $('#nav').hidden = nav === null;
  document.querySelectorAll('[data-nav]').forEach(a => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (changed && !keepScroll) { window.scrollTo(0, 0); const h1 = $('h1', view); if (h1) h1.focus({ preventScroll: true }); }
  if (keepScroll && lastKey) { const sel = `[data-action="${lastKey.a}"]` + (lastKey.g ? `[data-arg="${CSS.escape(lastKey.g)}"]` : ''); const el = $(sel, view); if (el) el.focus({ preventScroll: true }); }
  if (r.p === 'search' && changed && ui.results === null && !ui.loading) runSearch(ui.q, 1);
  if (r.p === 'home' || nav === 'home') loadMood();
  if (r.p === 'friends') loadFriends();
  if (r.p === 'u') loadCard(r.id);
  if (r.p === 'a' && CLOUD) { const rid = parseInt(r.id, 10); if (Number.isFinite(rid)) loadReviews(rid); }
}
window.addEventListener('hashchange', () => { lastKey = null; render(); });
document.addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('broken'); }, true);

/* ---------- toast & sheets ---------- */
let tt; function toast(m, lv) { const t = $('#toast'); t.textContent = m; t.className = (lv ? 'lv ' : '') + 'show'; clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), lv ? 4200 : 2600); }
const levelToast = (delta, m) => toast(`LEVEL UP! +${delta} LV · you are now LV.${1 + levelTotal()}`, true);
const sheet = $('#sheet');
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
const sheetHead = t => `<div class="sheet-head"><h2 class="h2" id="sheetTitle">${t}</h2><button type="button" class="sq" data-action="closeSheet" aria-label="Close">${I.close}</button></div>`;

function openLib(id) {
  const m = getM(id); if (!m) return;
  const e = liveEntry(id), can = maxEp(m) >= 1;
  sheet.innerHTML = `<div class="sheet">${sheetHead(e ? 'Move in library' : 'Add to library')}
    <div class="sheet-body"><div class="sheet-cover">${cv(m)}<b>${esc(m.title)}</b></div>
      <div class="optlist" role="group" aria-label="Library status">${ST.map(s => {
        const off = s.ask && !can;
        return `<button type="button" class="stbtn" data-action="pickStatus" data-arg="${id}|${s.k}" aria-pressed="${!!e && e.s === s.k}"${off ? ' disabled' : ''}><i style="background:${s.col}"></i>${esc(s.label)}${off ? '<small>NOT AIRED YET</small>' : ''}</button>`; }).join('')}</div>
      ${e ? `<button type="button" class="linkbtn" data-action="removeLib" data-arg="${id}" style="align-self:flex-start">REMOVE FROM LIBRARY</button>` : ''}</div></div>`;
  if (!sheet.open) sheet.showModal();
}
function openEpStep(id, status) {
  const m = getM(id); if (!m) return;
  const s = STM[status], e = liveEntry(id), cap = Math.max(1, maxEp(m)), tot = totalEps(m);
  const def = clamp(e && e.s !== 'finished' ? (e.p || 0) + 1 : 1, 1, cap);
  sheet.innerHTML = `<form class="sheet" data-form="epstep" data-id="${id}" data-status="${status}" method="dialog">${sheetHead(esc(s.label))}
    <div class="sheet-body"><div class="sheet-cover">${cv(m)}<b>${esc(m.title)}</b></div>
      <label class="field" for="epIn">${esc(s.ask)}</label>
      <div class="stepper"><button type="button" class="sq" data-action="epDelta" data-arg="-1" aria-label="Previous episode">−</button>
        <input id="epIn" name="ep" type="number" inputmode="numeric" min="1" max="${cap}" value="${def}" required><button type="button" class="sq" data-action="epDelta" data-arg="1" aria-label="Next episode">+</button></div>
      <p class="hint">${tot ? 'of ' + tot + ' episodes' + (m.eps && tot < m.eps ? ' (' + (m.eps - tot) + ' not aired yet)' : '') : 'episodes aired so far: ' + cap}. Episodes before this one count as watched.</p></div>
    <div class="sheet-foot"><button type="button" class="sbtn" data-action="openLib" data-arg="${id}" style="flex:none;padding:0 16px;font-family:var(--body);font-size:14px">Back</button><button type="submit" class="sbtn go">SAVE</button></div></form>`;
  if (!sheet.open) sheet.showModal();
  const inp = $('#epIn'); if (inp) { inp.focus(); inp.select(); }
}
function openLevelInfo() {
  const rows = [['Movie or single episode', 1], ['One season (12 episodes)', 12], ['Two seasons (24 episodes)', 24], ['Five seasons (60 episodes)', 60], ['Ten seasons (120 episodes)', 120], ['Naruto-sized (220 episodes)', 220], ['Bleach-sized (366 episodes)', 366], ['One Piece-sized (1100 episodes)', 1100]];
  const st = stats();
  sheet.innerHTML = `<div class="sheet">${sheetHead('How levels work')}<div class="sheet-body">
    <p class="hint">You earn levels when you <b>finish</b> a title. Bigger series pay more. Watching or pausing earns nothing until you finish, and moving a title out of Finished takes its levels back.</p>
    <table class="lvtbl"><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>+${lvFor(r[1])} LV</td></tr>`).join('')}</tbody></table>
    <p class="hint">Rule: one season is 12 episodes and gives 1 level, up to 10 seasons. After that you get 1 more level for every 8 extra seasons. Separate seasons listed as separate titles on AniList each count, so a show with 2 seasons gives at least +2.</p>
    <p class="hint">You are <b>LV.${st.level}</b>, rank <b>${st.rank}</b>.</p></div></div>`;
  if (!sheet.open) sheet.showModal();
}

/* ---------- reminders (fire while the app is open) ---------- */
let timers = [];
function scheduleReminders() {
  timers.forEach(clearTimeout); timers = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  entries().forEach(e => {
    if (!e.rem || !e.nx) return;
    const wait = e.nx.at * 1000 - Date.now();
    if (wait > 0 && wait < 864e5) timers.push(setTimeout(() => { try { new Notification(e.title, { body: 'Episode ' + e.nx.ep + ' is airing now.', icon: 'icons/icon-192.png' }); } catch (x) {} }, wait));
  });
}

/* ---------- fan card image ---------- */
async function cardCanvas() {
  try { await Promise.all([document.fonts.load('60px "Dela Gothic One"'), document.fonts.load('700 30px "Zen Maru Gothic"')]); } catch (e) {}
  const st = stats(), W = 1080, H = 1420, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const D = '"Dela Gothic One","Arial Black",sans-serif', B = '"Zen Maru Gothic",system-ui,sans-serif';
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const dots = (x, y, w, h, a, step) => { g.fillStyle = `rgba(26,22,51,${a})`; for (let j = y; j < y + h; j += step) for (let i = x; i < x + w; i += step) { g.beginPath(); g.arc(i + step / 2, j + step / 2, 3, 0, 7); g.fill(); } };
  const box = (x, y, w, h, r, fill, sh = 0, lw = 8) => { if (sh) { g.fillStyle = INK; rr(x + sh, y + sh, w, h, r); g.fill(); } g.fillStyle = fill; rr(x, y, w, h, r); g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };
  const text = (t, x, y, font, color, align = 'left') => { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(t, x, y); };
  g.fillStyle = CREAM; g.fillRect(0, 0, W, H); dots(0, 0, W, H, .09, 28);
  const cx = 70, cy = 90, cw = 940, ch = 1200;
  box(cx, cy, cw, ch, 44, '#fff', 16, 8);
  g.save(); rr(cx, cy, cw, ch, 44); g.clip(); dots(cx, cy, cw, ch, .08, 28);
  g.save(); g.beginPath(); g.rect(cx, cy, cw, 160); g.clip();
  g.fillStyle = '#FFD83D'; g.fillRect(cx, cy, cw, 160);
  g.fillStyle = '#FFE680'; for (let i = 0; i < 40; i += 2) { g.beginPath(); g.moveTo(cx + cw, cy + 80); g.arc(cx + cw, cy + 80, 1200, Math.PI + i * .122, Math.PI + (i + 1) * .122); g.closePath(); g.fill(); }
  g.restore(); g.restore(); g.fillStyle = INK; g.fillRect(cx, cy + 156, cw, 8);
  box(cx + 40, cy + 30, 100, 100, 22, '#B79CFF', 0, 6);
  text(userName().charAt(0).toUpperCase() || 'H', cx + 90, cy + 98, `52px ${D}`, INK, 'center');
  text('@' + userName(), cx + 164, cy + 74, `700 38px ${B}`, INK); text(st.rank, cx + 164, cy + 116, `700 28px ${B}`, '#3B3550');
  g.save(); g.translate(cx + cw - 110, cy + 80); g.rotate(.05); box(-80, -36, 160, 72, 16, '#FF5C8A', 0, 6); text('LV.' + st.level, 0, 16, `36px ${D}`, INK, 'center'); g.restore();
  text(String(st.hours), cx + 58, cy + 418, `200px ${D}`, '#FF5C8A'); text(String(st.hours), cx + 50, cy + 410, `200px ${D}`, INK);
  g.letterSpacing = '5px'; text('HOURS WATCHED', cx + 50, cy + 470, `700 28px ${B}`, '#5B5675'); g.letterSpacing = '0px';
  box(cx + cw - 300, cy + 330, 250, 54, 12, '#fff', 0, 5); g.letterSpacing = '3px'; text(st.season, cx + cw - 175, cy + 366, `700 24px ${B}`, INK, 'center'); g.letterSpacing = '0px';
  box(cx + 50, cy + 520, 400, 150, 24, '#4FD8F0', 8, 6); text(String(st.counts.finished), cx + 80, cy + 600, `60px ${D}`, INK); text('finished', cx + 80, cy + 645, `700 30px ${B}`, INK);
  box(cx + 490, cy + 520, 400, 150, 24, '#B79CFF', 8, 6); text(String(st.counts.watching), cx + 520, cy + 600, `60px ${D}`, INK); text('watching now', cx + 520, cy + 645, `700 30px ${B}`, INK);
  g.letterSpacing = '4px'; text('TOP GENRES', cx + 50, cy + 740, `700 24px ${B}`, '#5B5675');
  const gm = st.genres[0] ? st.genres[0][1] : 1, gcol = ['#FF5C8A', '#FFB36B', '#B79CFF'];
  st.genres.forEach((e, i) => { const y = cy + 770 + i * 56; g.letterSpacing = '0px'; text(e[0], cx + 50, y + 30, `700 30px ${B}`, INK);
    const bw = 520, w = bw * (.18 + .82 * e[1] / gm); box(cx + 330, y, bw, 40, 10, '#fff', 0, 6); g.save(); rr(cx + 330, y, bw, 40, 10); g.clip();
    for (let x = 0; x < w; x += 24) { g.fillStyle = gcol[i]; g.fillRect(cx + 330 + x, y, 20, 40); } g.restore(); box(cx + 330, y, bw, 40, 10, 'rgba(0,0,0,0)', 0, 6); });
  g.letterSpacing = '4px'; text('ALL-TIME TOP 3', cx + 50, cy + 960, `700 24px ${B}`, '#5B5675'); g.letterSpacing = '0px';
  [0, 1, 2].forEach(i => { const x = cx + 50 + i * 290, y = cy + 990, a = st.top[i];
    if (!a) { box(x, y, 260, 160, 18, 'rgba(255,255,255,.6)', 0, 6); return; }
    const col = safeColor(a.color); box(x, y, 260, 160, 18, col, 8, 6); g.save(); rr(x, y, 260, 160, 18); g.clip();
    g.fillStyle = mixHex(col, '#ffffff', .28); for (let k = 0; k < 24; k += 2) { g.beginPath(); g.moveTo(x + 180, y + 50); g.arc(x + 180, y + 50, 400, k * .26, (k + 1) * .26); g.closePath(); g.fill(); } g.restore();
    box(x, y, 260, 160, 18, 'rgba(0,0,0,0)', 0, 6);
    const t = a.title.length > 16 ? a.title.slice(0, 15) + '…' : a.title; text(t, x + 130, y + 128, `700 24px ${B}`, INK, 'center');
    g.beginPath(); g.arc(x, y, 24, 0, 7); g.fillStyle = INK; g.fill(); text(String(i + 1), x, y + 9, `24px ${D}`, '#fff', 'center'); });
  text('HOSHI · anime tracker', W / 2, 1368, `34px ${D}`, INK, 'center');
  return c;
}
async function cardBlob() { const c = await cardCanvas(); return new Promise(r => c.toBlob(r, 'image/png')); }
function download(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }

/* ---------- forms ---------- */
let searchDebounce;
document.addEventListener('input', e => {
  if (e.target.id === 'frQ') { clearTimeout(searchDebounce); const v = e.target.value; searchDebounce = setTimeout(() => searchUsers(v), 380); return; }
  if (e.target.id === 'q') { clearTimeout(searchDebounce); const v = e.target.value; searchDebounce = setTimeout(() => runSearch(v, 1), 380); }
});
document.addEventListener('submit', async e => {
  const f = e.target, kind = f.dataset && f.dataset.form; if (!kind) return;
  e.preventDefault();
  if (kind === 'search') { clearTimeout(searchDebounce); const q = $('#q').value; if (document.activeElement) document.activeElement.blur(); runSearch(q, 1); return; }
  if (kind === 'epstep') {
    const id = +f.dataset.id, m = getM(id), status = f.dataset.status; if (!m) return;
    const v = clamp(parseInt(new FormData(f).get('ep'), 10) || 1, 1, Math.max(1, maxEp(m)));
    const delta = setStatus(m, status, v); sheet.close(); render(true);
    toast(`${m.title}: ${STM[status].label.toLowerCase()}, episode ${v}`); if (delta > 0) levelToast(delta); return;
  }
  if (kind === 'usersearch') { clearTimeout(searchDebounce); const q = $('#frQ').value; if (document.activeElement) document.activeElement.blur(); searchUsers(q); return; }
  if (kind === 'review') { await submitReview(f); return; }
  if (kind === 'auth') await submitAuth(f);
});
async function submitAuth(f) {
  if (ui.busy) return;
  const d = new FormData(f), tab = ui.authTab, reg = tab === 'register';
  const name = String(d.get('username') || '').trim(), pw = String(d.get('password') || ''), email = String(d.get('email') || '').trim();
  const fail = t => { ui.authMsg = { bad: true, t }; ui.busy = false; render(true); };
  ui.authVals = { username: name, email };
  if (tab === 'reset') { if (pw.length < 8) return fail('Use at least 8 characters.'); }
  else {
    if ((reg || !CLOUD) && !/^[A-Za-z0-9_]{3,20}$/.test(name)) return fail('Username: 3 to 20 letters, numbers or underscores.');
    if (CLOUD && !/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
    if (reg && pw.length < 8) return fail('Use at least 8 characters for your password.');
    if (reg && !CLOUD && pw !== String(d.get('password2') || '')) return fail('The two passwords do not match.');
    if (!reg && !pw) return fail('Enter your password.');
  }
  ui.busy = true; ui.authMsg = null; render(true);
  try {
    let adopted = 0;
    if (tab === 'reset') {
      await sb('/auth/v1/user', { method: 'PUT', tok: ui.recovery.access_token, body: { password: pw } });
      adopted = startCloud(ui.recovery); ui.recovery = null; await syncNow();
    } else if (CLOUD) {
      const r = reg ? await cloudSignup(email, pw, name) : await cloudLogin(email, pw);
      if (r.confirm) { ui.busy = false; ui.authTab = 'login'; ui.authMsg = { t: 'Almost there. Check your email and tap the confirmation link, then sign in.' }; render(true); return; }
      adopted = r.adopted;
    } else adopted = reg ? await localRegister(name, pw) : await localLogin(name, pw);
    ui.busy = false; ui.authMsg = null; ui.results = null; location.hash = '#/home'; render();
    toast(adopted ? `Welcome, @${userName()}. Your guest list moved into your account.` : `Welcome, @${userName()}`);
  } catch (err) { fail(/Invalid login/i.test(err.message) ? 'Wrong email or password.' : /already registered/i.test(err.message) ? 'That email is already registered. Try signing in.' : err.message); }
}

/* ---------- actions ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const act = el.dataset.action, arg = el.dataset.arg || ''; lastKey = { a: act, g: arg };
  switch (act) {
    case 'back': e.preventDefault(); if (history.length > 1) history.back(); else location.hash = '#/home'; break;
    case 'closeSheet': sheet.close(); break;
    case 'mood': DB.prefs.mood = arg; ui.moodErr = ''; saveDB(); render(true); break;
    case 'moodRetry': ui.moodErr = ''; qcache.delete('m|' + DB.prefs.mood); render(true); break;
    case 'day': ui.selDay = arg; render(true); break;
    case 'weekOnly': DB.prefs.weekOnly = !DB.prefs.weekOnly; saveDB(); render(true); break;
    case 'retrySearch': runSearch(ui.q, 1); break;
    case 'moreResults': if (!ui.loading) runSearch(ui.q, ui.page + 1); break;
    case 'retryDetail': failed.delete(+arg); render(true); break;
    case 'shield': ui.spoilerOn = !ui.spoilerOn; render(true); break;
    case 'openLib': openLib(+arg); break;
    case 'levelInfo': openLevelInfo(); break;
    case 'pickStatus': {
      const [id, s] = [+arg.split('|')[0], arg.split('|')[1]], m = getM(id); if (!m) break;
      if (STM[s].ask) { openEpStep(id, s); break; }
      const delta = setStatus(m, s); sheet.close(); render(true);
      toast(s === 'finished' ? `${m.title} finished` : `Added to ${STM[s].label.toLowerCase()}`); if (delta > 0) levelToast(delta); break; }
    case 'epDelta': { const inp = $('#epIn'); if (inp) { inp.value = clamp((parseInt(inp.value, 10) || 1) + parseInt(arg, 10), +inp.min || 1, +inp.max || 9999); } break; }
    case 'removeLib': { const before = levelTotal(); removeEntry(+arg); sheet.close(); render(true); const d = levelTotal() - before; toast(d < 0 ? `Removed from library. ${d} LV, since it was finished.` : 'Removed from library'); break; }
    case 'watchNext': { const e2 = liveEntry(+arg); if (!e2) break; const r = markNext(e2);
      if (r.blocked) { toast('You are caught up with the aired episodes'); break; }
      ui.popId = e2.id; render(true); toast(r.finished ? `${e2.title} finished` : `Episode ${e2.p} watched`); if (r.delta > 0) levelToast(r.delta); break; }
    case 'undo': { const e2 = liveEntry(+arg); if (e2 && e2.p > 0) { e2.p--; e2.u = Date.now(); if (e2.s === 'finished') e2.s = 'watching'; saveDB(); render(true); } break; }
    case 'setEp': { const e2 = liveEntry(+arg); if (e2) openEpStep(e2.id, e2.s === 'paused' ? 'paused' : 'watching'); break; }
    case 'remind': { const e2 = liveEntry(+arg); if (!e2) break; e2.rem = !e2.rem;
      if (e2.rem && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (x) {} }
      saveDB(); render(true);
      toast(e2.rem ? (('Notification' in window && Notification.permission === 'granted') ? 'Reminder on. Alerts fire while Hoshi is open.' : 'Reminder saved. Allow notifications to get alerts.') : 'Reminder off'); break; }
    case 'writeReview': {
      const id = +arg;
      if (!(session && session.mode === 'cloud')) { toast('Sign in to write a review'); location.hash = '#/auth'; break; }
      if (!liveEntry(id)) { toast('Add it to your library first'); break; }
      openReviewSheet(id); break; }
    case 'reveal': ui.revealed.add(arg); paintReviews(curId()); break;
    case 'retryReviews': loadReviews(+arg, true); break;
    case 'delReview': { const [rid, aid] = arg.split('|');
      if (!confirm('Delete your review?')) break;
      try { await cloudReq('/rest/v1/reviews?id=eq.' + encodeURIComponent(rid), { method: 'DELETE' }); await loadReviews(+aid, true); toast('Review deleted'); } catch (x) { toast(x.message); } break; }
    case 'addFriend': if (!UUID.test(arg)) break;
      try { await cloudReq('/rest/v1/friends?on_conflict=user_id,friend_id', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { friend_id: arg } });
        FR.ids.add(arg); toast('Friend added'); await loadFriends(true); } catch (x) { toast(niceErr(x)); } paintFriends(); break;
    case 'removeFriend': if (!UUID.test(arg)) break;
      try { await cloudReq('/rest/v1/friends?friend_id=eq.' + arg, { method: 'DELETE' }); FR.ids.delete(arg); toast('Friend removed'); await loadFriends(true); } catch (x) { toast(niceErr(x)); } paintFriends(); break;
    case 'retryFriends': loadFriends(true); break;
    case 'retryCard': FR.cards.delete(arg); loadCard(arg); break;
    case 'toggleShare': DB.prefs.share = DB.prefs.share === false; saveDB(); await pushProfile(true); render(true); break;
    case 'reportReview': openReport(arg); break;
    case 'sendReport': { const i = arg.indexOf('|'), rid = arg.slice(0, i), reason = arg.slice(i + 1);
      try { await cloudReq('/rest/v1/reports?on_conflict=review_id,reporter_id', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { review_id: rid, reason } }); sheet.close(); toast('Thanks. We will take a look.'); } catch (x) { toast(x.message); } break; }
    case 'blockUser': { const i = arg.indexOf('|'), uid2 = arg.slice(0, i), name = arg.slice(i + 1);
      if (!confirm('Block @' + name + '? You will no longer see their reviews.')) break;
      try { await cloudReq('/rest/v1/blocks?on_conflict=blocker_id,blocked_id', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { blocked_id: uid2, blocked_name: name } });
        ui.blocks = Object.assign(ui.blocks || {}, { [uid2]: name }); paintReviews(curId()); toast('Blocked @' + name + '. Undo it in Me, Blocked users.'); } catch (x) { toast(x.message); } break; }
    case 'blockedList': openBlocked(); break;
    case 'unblock': try { await cloudReq('/rest/v1/blocks?blocked_id=eq.' + encodeURIComponent(arg), { method: 'DELETE' }); if (ui.blocks) delete ui.blocks[arg]; paintBlocked(); paintReviews(curId()); toast('Unblocked'); } catch (x) { toast(x.message); } break;
    case 'goAuth': ui.authTab = arg; ui.authMsg = null; location.hash = '#/auth'; break;
    case 'authTab': ui.authTab = arg; ui.authMsg = null; render(true); break;
    case 'guest': ls.set(K.seen, 1); location.hash = '#/home'; break;
    case 'forgot': {
      const em = $('input[name=email]'); const v = em ? em.value.trim() : '';
      if (!/^\S+@\S+\.\S+$/.test(v)) { ui.authMsg = { bad: true, t: 'Type your email above first, then tap Forgot password.' }; render(true); break; }
      try { await sb('/auth/v1/recover', { method: 'POST', body: { email: v } }); ui.authMsg = { t: 'If that email has an account, a reset link is on its way.' }; } catch (x) { ui.authMsg = { bad: true, t: x.message }; }
      render(true); break; }
    case 'logout': if (confirm(session && session.mode === 'local' ? 'Log out? Your list stays saved on this device under your account.' : 'Log out of Hoshi?')) logout(); break;
    case 'syncNow': syncNow(); toast('Syncing…'); break;
    case 'exportData': { const blob = new Blob([JSON.stringify({ app: 'hoshi', v: 2, exportedAt: new Date().toISOString(), user: userName(), lib: DB.lib, prefs: DB.prefs }, null, 2)], { type: 'application/json' });
      download(blob, `hoshi-backup-${new Date().toISOString().slice(0, 10)}.json`); toast('Backup downloaded'); break; }
    case 'importData': $('#importFile').click(); break;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice.catch(() => {}); deferredInstall = null; render(true); } break;
    case 'savePng': { const b = await cardBlob(); download(b, 'hoshi-fan-card.png'); toast('Fan card saved'); break; }
    case 'story': {
      const b = await cardBlob(), f = new File([b], 'hoshi-fan-card.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'My Hoshi fan card' }); } catch (x) {} }
      else { download(b, 'hoshi-fan-card.png'); toast('Image saved. Post it from your gallery.'); } break; }
    case 'discord': {
      const st = stats(), txt = `@${userName()} · LV.${st.level} ${st.rank}\n${st.hours}h watched · ${st.counts.finished} finished · ${st.counts.watching} watching\nTop: ${st.top.map(x => x.title).join(' / ') || 'nothing yet'}`;
      try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it into Discord.'); } catch (x) { toast('Could not copy on this browser'); } break; }
  }
});
$('#importFile').addEventListener('change', async ev => {
  const file = ev.target.files[0]; ev.target.value = ''; if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    if (!j || j.app !== 'hoshi' || !j.lib || typeof j.lib !== 'object') throw new Error('bad');
    const before = Object.keys(DB.lib).length; mergeInto(DB.lib, j.lib); saveDB(); render(true);
    toast(`Backup restored. ${Object.keys(DB.lib).length - before} new titles added.`);
  } catch (x) { toast('That file is not a Hoshi backup'); }
});

/* ---------- PWA + boot ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (route().p === 'me') render(true); });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('Installed. Find Hoshi on your home screen.'); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
setInterval(() => {
  if (document.hidden || sheet.open || !['home', 'week', ''].includes(route().p)) return;
  if (document.activeElement && document.activeElement !== document.body && view.contains(document.activeElement)) return;
  lastKey = null; render(true);
}, 60000);

(async function boot() {
  loadDB();
  const redirected = await handleAuthRedirect();
  render(); scheduleReminders(); refreshLibrary();
  if (session && session.mode === 'cloud') syncNow();
})();
