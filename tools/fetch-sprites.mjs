// Fetches PMD body sprites + Normal portraits from SpriteCollab for every sprite key in data/dex.js, plus Showdown cries.
// Run after tools/build-dex.mjs. Writes data/sprites.js, data/sprite-keys.json, assets/sprite/**, assets/cry/**.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Dex, toID } from '@pkmn/dex';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const CRY = 'https://play.pokemonshowdown.com/audio/cries/';
const CACHE = path.join(os.tmpdir(), 'pokearena-spritecollab');

let active = 0;
const waiting = [];
async function limited(fn) {
  if (active >= 6) await new Promise(r => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}

// Returns a Buffer, or null on 404. Retries other failures (429s included) with backoff.
async function get(url) {
  return limited(async () => {
    for (let i = 1; ; i++) {
      try {
        const res = await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (e) {
        if (i >= 5) throw new Error(`${url}: ${e.message}`);
        await new Promise(r => setTimeout(r, 1000 * 2 ** i));
      }
    }
  });
}

// Cached download: returns the file path, or null if the source 404s. Same file requested twice shares one fetch.
const inflight = new Map();
function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return Promise.resolve(file);
  if (!inflight.has(file)) inflight.set(file, (async () => {
    const miss = path.join(CACHE, '404', encodeURIComponent(url));
    if (fs.existsSync(miss)) return null;
    const buf = await get(url);
    if (!buf) { fs.mkdirSync(path.dirname(miss), { recursive: true }); fs.writeFileSync(miss, ''); return null; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', buf); // tmp + rename so a killed run never leaves a half file in the cache
    fs.renameSync(file + '.tmp', file);
    return file;
  })());
  return inflight.get(file);
}

const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];

function parseAnimData(xml) {
  const anims = {};
  for (const [, body] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const num = n => (tag(body, n) === undefined ? -1 : +tag(body, n));
    anims[tag(body, 'Name')] = {
      copyOf: tag(body, 'CopyOf'),
      fw: num('FrameWidth'), fh: num('FrameHeight'),
      durations: [...body.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m => +m[1]),
      hit: num('HitFrame'), ret: num('ReturnFrame'), rush: num('RushFrame'),
    };
  }
  return anims;
}

export function footYFromShadow(png, fw, fh) {
  let sum = 0, n = 0;
  for (let y = 0; y < fh && y < png.height; y++)
    for (let x = 0; x < fw && x < png.width; x++)
      if (png.data[(y * png.width + x) * 4 + 3] > 0) { sum += y; n++; }
  return n ? Math.round(sum / n) : Math.round(fh / 2 + fh / 4);
}

const dex4 = n => String(n).padStart(4, '0');
// '0006' -> '0006', '0006-2' -> '0006/0002'
const dirOf = key => { const [d, f] = key.split('-'); return f ? `${d}/${f.padStart(4, '0')}` : d; };

async function main() {
  const trackerFile = await download(RAW + 'tracker.json', path.join(CACHE, 'tracker.json'));
  const tracker = JSON.parse(fs.readFileSync(trackerFile, 'utf8'));
  const win = {};
  new Function('window', fs.readFileSync('data/dex.js', 'utf8'))(win);
  const SPECIES = win.DEX.species;
  const groupOf = key => { const [d, f] = key.split('-'); return f ? tracker[d]?.subgroups?.[f.padStart(4, '0')] : tracker[d]; };

  const log = { fallback: [], missingAnims: [], badShadow: [], cryFallback: [], cryMissing: [] };

  async function buildBody(key) {
    const group = groupOf(key);
    if (!Object.keys(group?.sprite_files || {}).length) return null;
    const url = `${RAW}sprite/${dirOf(key)}/`, cache = path.join(CACHE, 'sprite', dirOf(key));
    const xmlFile = await download(url + 'AnimData.xml', path.join(cache, 'AnimData.xml'));
    if (!xmlFile) return null;
    const data = parseAnimData(fs.readFileSync(xmlFile, 'utf8'));
    const anims = {};
    await Promise.all(Object.entries(data).map(async ([name, a]) => {
      let src = name, seen = 0;
      while (data[src]?.copyOf && seen++ < 10) src = data[src].copyOf;
      const s = data[src];
      if (!s) { log.missingAnims.push(`${key}:${name}`); return; }
      const file = `assets/sprite/${key}/${src}-Anim.png`;
      const [ok, shadow] = await Promise.all([
        download(url + `${src}-Anim.png`, file),
        download(url + `${src}-Shadow.png`, path.join(cache, `${src}-Shadow.png`)),
      ]);
      if (!ok) { log.missingAnims.push(`${key}:${name}`); return; }
      let footY = Math.round(s.fh * 0.75);
      try { if (shadow) footY = footYFromShadow(PNG.sync.read(fs.readFileSync(shadow)), s.fw, s.fh); } catch { log.badShadow.push(`${key}:${src}`); }
      anims[name] = { sheet: src, fw: s.fw, fh: s.fh, durations: s.durations, footY, hit: s.hit, ret: s.ret, rush: s.rush };
    }));
    // Keep AnimData order rather than download-completion order.
    const out = Object.fromEntries(Object.keys(data).filter(n => anims[n]).map(n => [n, anims[n]]));
    return Object.keys(out).length ? out : null;
  }

  async function portrait(key) {
    // Tracker values are lock flags; key presence means the file exists.
    if (!('Normal' in (groupOf(key)?.portrait_files || {}))) return null;
    const file = `assets/sprite/${key}/portrait.png`;
    return (await download(`${RAW}portrait/${dirOf(key)}/Normal.png`, file)) ? file : null;
  }

  // Showdown cry names: base id, or '<base>-<forme id>' for forms and megas. Forms without one reuse the base cry.
  async function cry(id) {
    const s = Dex.species.get(id), base = toID(s.baseSpecies), file = `assets/cry/${id}.mp3`;
    if (await download(CRY + (s.forme ? `${base}-${toID(s.forme)}` : id) + '.mp3', file)) return;
    if (s.forme && (await download(CRY + base + '.mp3', `assets/cry/${base}.mp3`))) { fs.copyFileSync(`assets/cry/${base}.mp3`, file); log.cryFallback.push(id); }
    else log.cryMissing.push(id);
  }

  const keyUsers = {}; // sprite key -> species ids using it
  for (const s of Object.values(SPECIES)) (keyUsers[s.sprite] ||= []).push(s.id);
  const keys = Object.keys(keyUsers).sort();
  const own = {}, ports = {};
  let done = 0;
  await Promise.all(keys.map(async key => {
    [own[key], ports[key]] = await Promise.all([buildBody(key), portrait(key)]);
    if (++done % 100 === 0) console.log(`${done}/${keys.length} keys`);
  }));
  await Promise.all(Object.keys(SPECIES).map(cry));

  // Keys with no body art borrow the closest key that has it: base form, then the evolution family, then the '?' placeholder.
  async function closest(key) {
    const [d, f] = key.split('-');
    if (f && own[d]) return d;
    const s = Dex.species.get(keyUsers[key].find(id => !SPECIES[id].isMega) || keyUsers[key][0]);
    const fam = [], seen = new Set();
    const walk = x => { if (!x?.exists || seen.has(x.id)) return; seen.add(x.id); fam.push(x); walk(Dex.species.get(x.prevo)); x.evos.forEach(e => walk(Dex.species.get(e))); };
    walk(Dex.species.get(s.baseSpecies));
    const hit = fam.map(x => dex4(x.num)).find(k => own[k]);
    if (hit) return hit;
    own['0000'] ||= await buildBody('0000');
    ports['0000'] ||= await portrait('0000');
    return '0000';
  }
  const aliases = [];
  for (const key of keys) {
    if (own[key]) continue;
    const to = await closest(key);
    aliases.push([key, to, ports[key] || null]);
    log.fallback.push(`${key} (${keyUsers[key].join(', ')}) -> ${to}`);
  }

  // Compact on disk, expanded to the documented SPRITES shape when the script runs.
  const R = {};
  for (const key of Object.keys(own).filter(k => own[k]).sort()) {
    const p = ports[key] === `assets/sprite/${key}/portrait.png` ? 1 : ports[key] || null;
    R[key] = { p, a: Object.entries(own[key]).map(([n, a]) => [n, a.sheet === n ? 0 : a.sheet, a.fw, a.fh, a.footY, a.hit, a.ret, a.rush, ...a.durations]) };
  }
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/sprites.js', `// Generated by tools/fetch-sprites.mjs
window.SPRITES = ((R, A) => {
  const S = {};
  for (const k in R) {
    const anims = {};
    for (const [n, sh, fw, fh, footY, hit, ret, rush, ...durations] of R[k].a) anims[n] = { file: \`assets/sprite/\${k}/\${sh || n}-Anim.png\`, fw, fh, durations, footY, hit, ret, rush };
    S[k] = { portrait: R[k].p === 1 ? \`assets/sprite/\${k}/portrait.png\` : R[k].p, anims };
  }
  // keys without body art: own portrait if any, a copy of the closest key's anims (copy so custom sheets can override per key)
  for (const [k, b, p] of A) S[k] = { portrait: p || S[b].portrait, anims: { ...S[b].anims } };
  return S;
})(${JSON.stringify(R)}, ${JSON.stringify(aliases)});
`);
  fs.writeFileSync('data/sprite-keys.json', JSON.stringify(Object.fromEntries(Object.keys(SPECIES).sort().map(id => [id, SPECIES[id].sprite])), null, 1) + '\n');

  const animCount = {}, ownKeys = Object.keys(R);
  for (const k of ownKeys) for (const [n] of R[k].a) animCount[n] = (animCount[n] || 0) + 1;
  console.log(`species: ${Object.keys(SPECIES).length}, sprite keys: ${keys.length}, with own sheets: ${ownKeys.length}, borrowed: ${aliases.length}`);
  console.log(`anims in all: ${Object.keys(animCount).filter(n => animCount[n] === ownKeys.length).join(' ')}`);
  console.log(`data/sprites.js: ${Math.round(fs.statSync('data/sprites.js').size / 1024)} KB`);
  for (const [k, v] of Object.entries(log)) console.log(`${k} (${v.length}): ${v.join(' | ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
