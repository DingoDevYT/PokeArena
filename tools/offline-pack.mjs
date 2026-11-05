// The offline pack: every file Adventure mode can need, so a phone that has saved it plays with no connection (sw.js caches the list).
// Run: node tools/offline-pack.mjs   (serves the repo, opens the game headless and asks the game's own data; writes offline.json)
// What goes in: the page, all code and data, the Adventure art, sounds and music, and for every species the player can meet (wild tables, every trainer
// and leader team, the starters) and everything they evolve into: battle sprites, portraits, cries, and the effects and sounds of the moves they can learn.
// Other modes' extras (every other species, arenas) are fetched and kept the first time they are used online.
import crypto from 'crypto'; import fs from 'fs'; import http from 'http'; import path from 'path'; import { createRequire } from 'module';
const req = createRequire(import.meta.url); let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }   // a global install will do
const { chromium } = pw;
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); }).listen(0);
const port = srv.address().port;
const br = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const pg = await br.newPage(); await pg.goto(`http://localhost:${port}/index.html?mute`); await pg.waitForFunction(() => window.DEX && window.ADV_DEX && window.ADV_ENC, null, { timeout: 60000 });
const fromGame = await pg.evaluate(() => {
  const ids = new Set(), isSp = s => typeof s === 'string' && DEX.species[s];
  const walk = (o, d = 0) => { if (!o || d > 12) return; if (typeof o === 'string') { if (isSp(o)) ids.add(o); return; } if (typeof o === 'object') for (const k in o) walk(o[k], d + 1); };
  walk(window.ADV_ENC); walk(window.ADV_ROSTERS); walk(window.ADV_WORLD?.buildings); walk(window.ADV_NPCS); walk(window.ADVUI?.STARTERS);
  for (const f in window) if (/^ADV_(NPC|TRAINER|ROUTE)/.test(f)) walk(window[f]);
  const grow = id => { for (const e of ADV_DEX[id]?.evos || []) { const to = e.to || e; if (isSp(to) && !ids.has(to)) { ids.add(to); grow(to); } } };
  [...ids].forEach(grow);
  const moves = new Set(Object.keys(window.ADV_TMS || {}).map(k => ADV_TMS[k]?.move || k));
  for (const id of ids) for (const m of ADV_DEX[id]?.levelMoves || []) moves.add(Array.isArray(m) ? m[1] : m.move || m);
  const files = new Set();
  for (const id of ids) {
    for (const s of assetSrcs({ arena: {}, player: { team: [{ species: id, moves: [] }] }, cpu: { team: [] } })) files.add(s);
    files.add('assets/cry/' + id + '.mp3');
  }
  for (const s of assetSrcs({ arena: {}, player: { team: [{ species: 'bulbasaur', moves: [...moves].filter(m => DEX.moves[m]) }] }, cpu: { team: [] } })) files.add(s);
  const S = window.MOVE_SFX || { moves: {}, generic: {} };
  for (const m of moves) if (S.moves[m]) files.add(S.moves[m]);
  for (const k in S.generic) files.add(S.generic[k]);
  const music = []; const wm = o => { if (typeof o === 'string') { if (/\.(mp3|ogg)$/.test(o)) music.push(o); } else if (o && typeof o === 'object') for (const k in o) wm(o[k]); }; wm(window.ADV_MUSIC); music.push(FLOWERY_MUSIC);
  music.forEach(f => files.add(f));
  return { species: ids.size, moves: moves.size, files: [...files] };
});
await br.close(); srv.close();
const tree = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? tree(d + '/' + e.name) : [d + '/' + e.name]);
const ALL = ['src', 'data', 'assets/adv', 'assets/ui', 'assets/items', 'assets/particle', 'assets/beam', 'assets/trainer-ow', 'assets/trainer-ow8', 'assets/trainer-ow-ranger', 'assets/outfits', 'assets/trainer', 'assets/trainers', 'assets/sfx'];
const files = [...new Set(['index.html', 'manifest.webmanifest', ...ALL.flatMap(tree).filter(f => !/(^|\/)(adv-test|\.cache)\//.test(f) && !/\.(md|map)$/.test(f)), ...fromGame.files.map(f => f.replace(/^\.?\//, ''))])]
  .filter(f => fs.existsSync(path.join(ROOT, f))).sort();
const bytes = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
const list = files.map(f => [f, crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8)]);   // a fingerprint per file: an update downloads only what changed
const version = crypto.createHash('md5').update(JSON.stringify(list)).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'offline.json'), JSON.stringify({ version, bytes, files: list }) + '\n');
console.log(`offline.json: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB (${fromGame.species} species, ${fromGame.moves} moves)`);
