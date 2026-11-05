// Offline play (src/offline.js asks for it). Everything the game fetches is kept in one cache, keyed by path (the ?mute and similar query strings ignored).
// Code (html, js, json) is fetched fresh while online and falls back to the cache offline; art and sound come from the cache first.
// 'pack' downloads offline.json's list (tools/offline-pack.mjs: all of Adventure mode) so a phone can go a whole flight with no connection.
// Audio elements ask for byte ranges (Safari always does), so a cached file answers those with a 206 slice.
const CACHE = 'pokearena', FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, CODE = /\.(html|js|json|webmanifest)$|\/$/;
const key = u => { const x = new URL(u, self.location.href); return x.origin + x.pathname; };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function ranged(req, res) {
  const r = req.headers.get('range'); if (!r || !res || res.status !== 200) return res;
  const buf = await res.arrayBuffer(), n = buf.byteLength, m = /bytes=(\d*)-(\d*)/.exec(r) || [], a = m[1] ? +m[1] : Math.max(0, n - +m[2]), b = m[1] && m[2] ? Math.min(+m[2], n - 1) : n - 1;
  return new Response(buf.slice(a, b + 1), { status: 206, statusText: 'Partial Content', headers: { 'content-type': res.headers.get('content-type') || '', 'content-range': `bytes ${a}-${b}/${n}`, 'content-length': String(b - a + 1), 'accept-ranges': 'bytes' } });
}
async function keep(k, res) { if (res && res.ok && res.status === 200) { const c = await caches.open(CACHE); await c.put(k, res.clone()); } return res; }
const timeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONTS.test(req.url)) { e.respondWith(caches.match(req.url).then(hit => hit || fetch(req).then(r => keep(req.url, r)))); return; }
  if (url.origin !== self.location.origin) return;
  const k = key(req.url), plain = new Request(k);
  if (CODE.test(url.pathname) || req.mode === 'navigate') {   // fresh while online (a slow network gives up after 4 s), the cache when offline
    const nk = req.mode === 'navigate' && url.pathname.endsWith('/') ? k + 'index.html' : k;
    e.respondWith(timeout(fetch(plain, { cache: 'no-cache' }), 4000).then(r => keep(nk, r)).catch(() => caches.match(nk).then(hit => hit || caches.match(key('index.html'))).then(hit => hit || new Response('Offline and not saved yet', { status: 503 }))));
    return;
  }
  // art and sound: from the cache first once the pack is saved (an update refreshes what changed); before that the network first, the cache if offline
  const net = () => fetch(plain).then(r => keep(k, r)).then(r => ranged(req, r.clone()));
  e.respondWith((saved === null ? status() : Promise.resolve()).then(() => saved ? caches.match(k).then(hit => hit ? ranged(req, hit) : net()) : net().catch(() => caches.match(k).then(hit => hit && ranged(req, hit))))
    .then(r => r || new Response('', { status: 504 })).catch(() => new Response('', { status: 504 })));
});

// ---------- the offline pack ----------
let packing = null, saved = null;
const tell = async m => { for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(m); };
async function status() {
  const c = await caches.open(CACHE), v = await c.match(key('__pack')); saved = !!v; if (!v) return { t: 'status', saved: false };
  const { index, ...rest } = await v.json(); return { t: 'status', saved: true, ...rest };
}
async function pack() {
  const c = await caches.open(CACHE), list = await (await fetch(key('offline.json'), { cache: 'no-cache' })).json(), prev = await c.match(key('__pack'));
  const pj = prev ? await prev.json() : {}, index = pj.index || {};   // path -> fingerprint of the copy in the cache
  if (pj.version === list.version) { tell(await status()); return; }
  const have = new Set((await c.keys()).map(r => r.url)), base = new URL('./', self.location.href).href;
  const todo = list.files.filter(([f, h]) => !have.has(base + f) || index[f] !== h);
  const total = list.files.length; let done = total - todo.length, failed = 0, last = -1;
  const one = async ([f, h]) => { for (let t = 0; t < 3; t++) { try { const r = await fetch(base + f, { cache: 'no-cache' }); if (r.ok) { await c.put(base + f, r); index[f] = h; return; } } catch {} } failed++; };
  for (const [f, h] of list.files) if (have.has(base + f) && !(f in index)) index[f] = h;   // kept while playing online: trust it unless its fingerprint changes
  const work = async () => { while (todo.length) { await one(todo.pop()); done++; const p = Math.floor(done / total * 100); if (p !== last) { last = p; tell({ t: 'progress', p, done, total }); } } };
  await Promise.all(Array.from({ length: 6 }, work));
  try {   // the two fonts (Bungee, Silkscreen): their stylesheet and the font files it names
    const css = 'https://fonts.googleapis.com/css2?family=Bungee&family=Silkscreen:wght@400;700&display=swap', r = await fetch(css); await keep(css, r.clone());
    for (const u of (await r.text()).match(/https:\/\/fonts\.gstatic\.com\/[^)'"]+/g) || []) if (!(await caches.match(u))) await keep(u, await fetch(u));
  } catch {}
  const rec = v => c.put(key('__pack'), new Response(JSON.stringify({ version: v, bytes: list.bytes, files: total, index }), { headers: { 'content-type': 'application/json' } }));
  if (failed) { if (prev) await rec('partial'); tell({ t: 'failed', failed, total }); return; }   // a retry picks up where it stopped
  await rec(list.version);
  tell(await status());
}
self.addEventListener('message', e => {
  const m = e.data || {};
  if (m.t === 'status') e.waitUntil(status().then(tell));
  if (m.t === 'pack') { packing ||= pack().catch(err => tell({ t: 'failed', error: String(err) })).finally(() => packing = null); e.waitUntil(packing); }
});
