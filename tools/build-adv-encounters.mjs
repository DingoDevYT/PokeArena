// Builds data/adv/encounters.js from the Kenora design bible (plain text).
// Route tables are parsed directly. Town "Encounters - proposed" prose is parsed
// by taking the first species of each chain. Run: node tools/build-adv-encounters.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIBLE = path.join(ROOT, 'tools', '.cache', 'kenora-bible.txt');
const OUT = path.join(ROOT, 'data', 'adv', 'encounters.js');
const TEMPER = path.join(ROOT, 'data', 'adv', 'temperament.js');

global.window = global;
require(path.join(ROOT, 'data', 'dex.js'));
require(path.join(ROOT, 'data', 'adv', 'zones.js'));
require(path.join(ROOT, 'data', 'adv', 'pokedata.js'));

const SPECIES = window.DEX.species;
const ZONES = window.ADV_ZONES.ids;
const ZONE_SET = new Set(ZONES);
const ADV_DEX = window.ADV_DEX;

const EM = String.fromCharCode(0x2014);
const ARROW = '→';
const DOT = '·';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/♀/g, 'f').replace(/♂/g, 'm')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

// Name -> DEX id. Keys are normalised ids and display names.
const NAME2ID = new Map();
for (const id of Object.keys(SPECIES)) {
  NAME2ID.set(norm(id), id);
  if (SPECIES[id].name) NAME2ID.set(norm(SPECIES[id].name), id);
}
// Extra spellings found in the bible that differ from DEX keys (norm -> id).
const ALIAS = {};

const unresolved = [];
function idOf(name) {
  const n = norm(name);
  if (!n) return null;
  if (ALIAS[n]) return ALIAS[n];
  return NAME2ID.get(n) || null;
}

// First species found in a text fragment (multi-word names allowed).
function firstSpecies(text) {
  const toks = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    for (let len = 3; len >= 1; len--) {
      if (i + len > toks.length) continue;
      const id = idOf(toks.slice(i, i + len).join(' '));
      if (id) return id;
    }
  }
  return null;
}

// Splits "Oddish Duskull" or "Mr. Mime Duskull" into two ids.
function splitPair(rest) {
  const toks = rest.split(/\s+/).filter(Boolean);
  for (let k = 1; k < toks.length; k++) {
    const a = idOf(toks.slice(0, k).join(' '));
    const b = idOf(toks.slice(k).join(' '));
    if (a && b) return [a, b];
  }
  return null;
}

const BAND = { 'Common': 'common', 'Uncommon': 'uncommon', 'Rare': 'rare', 'Nat 20': 'nat20' };
const ROW = /^(?:◆\s*)?(Common|Uncommon|Rare|Nat 20)\s+(\d+)%\s+(.+?)\s*$/;

// ---- Route tables ----------------------------------------------------------
const lines = fs.readFileSync(BIBLE, 'utf8').split(/\r?\n/);
const routeTables = {};   // n -> { dn: {day, night}, fish: [...] }
const dupMismatch = [];   // second copy (appendix) that differs from first copy

function storeRoute(n, kind, value) {
  routeTables[n] = routeTables[n] || {};
  if (!routeTables[n][kind]) {
    routeTables[n][kind] = value;
  } else if (JSON.stringify(routeTables[n][kind]) !== JSON.stringify(value)) {
    dupMismatch.push(`route ${n} ${kind}`);
  }
}

let route = null;
let mode = null;     // 'dn' | 'fish' | null
let rows = [];
let tableRoute = null;

function finishTable() {
  if (tableRoute === null) return;
  if (mode === 'dn') {
    const day = [], night = [];
    for (const r of rows) {
      const pair = splitPair(r.rest);
      if (!pair) { unresolved.push(`route ${tableRoute} day/night "${r.rest}"`); return; }
      day.push([pair[0], r.band]);
      night.push([pair[1], r.band]);
    }
    storeRoute(tableRoute, 'dn', { day, night });
  } else if (mode === 'fish') {
    const fish = [];
    for (const r of rows) {
      const id = idOf(r.rest);
      if (!id) { unresolved.push(`route ${tableRoute} fish "${r.rest}"`); return; }
      fish.push([id, r.band]);
    }
    storeRoute(tableRoute, 'fish', fish);
  }
}

for (const line of lines) {
  const l = line.trim();
  const rh = /^Route (\d+) [^\w\s] /.exec(l);
  if (rh) { finishTable(); route = +rh[1]; mode = null; rows = []; tableRoute = null; continue; }
  if (/^(Roll band|Band)\b/.test(l) && /Day Night$/.test(l)) {
    finishTable(); mode = 'dn'; rows = []; tableRoute = route; continue;
  }
  if (/^(Roll band|Band|Fishing)\b/.test(l) && /Catch$/.test(l)) {
    finishTable(); mode = 'fish'; rows = []; tableRoute = route; continue;
  }
  const m = ROW.exec(l);
  if (m && mode && tableRoute !== null) {
    rows.push({ band: BAND[m[1]], rest: m[3] });
    if (rows.length === 4) { finishTable(); mode = null; rows = []; tableRoute = null; }
  }
}
finishTable();

// ---- Town "Encounters - proposed" blocks -----------------------------------
const TOWN_ZONE = {
  'Sprucevale': 'sprucevale',
  'Fernwell Park': 'fernwellpark',
  'Goldacre': 'goldacre',
  'Frostfall': 'frostfall',
  'Hallowmead': 'hallowmead',
  'Tradeway': 'tradeway',
  'Salt Bay': 'saltbay',
  'Spindlewood': 'spindlewood',
  'Longshore': 'longshore',
  'Duskmoss': 'duskmoss',
  'The Statue of Umbra': 'statueofumbra',
  'Fernwell Sanctuary': 'fernwellsanctuary',
  'The Pokémon League': 'pokemonleague',
  'Quiet Plain': 'quietplain',
};

// Rows are joined across PDF line wraps, then split into chains on the dot.
function blockEntries(blockLines) {
  const joined = [];
  let cur = null;
  for (const raw of blockLines) {
    const l = raw.trim();
    if (!l) continue;
    if (cur === null) { cur = l; continue; }
    const openNight = /^Night only/i.test(cur) && !(cur.includes(ARROW) || cur.includes(DOT));
    if (openNight || /(→|·|\/)$/.test(cur) || /^(→|·|\/)/.test(l)) cur += ' ' + l;
    else { joined.push(cur); cur = l; }
  }
  if (cur !== null) joined.push(cur);

  const out = [];
  for (const row of joined) {
    if (!(row.includes(ARROW) || row.includes(DOT))) continue; // prose line
    const rowNight = /^Night only/i.test(row) || /\(night( only)?\)/i.test(row);
    const rowFish = /^Fishing\b/.test(row);
    const body = row.replace(/^Night only\s*/i, '');
    for (const seg of body.split(DOT)) {
      const head = seg.split(EM)[0].split(ARROW)[0];
      for (const piece of head.split(/\s\/\s/)) {
        const id = firstSpecies(piece.split(EM)[0]);
        if (id) out.push({ id, night: rowNight, fish: rowFish });
      }
    }
  }
  return out;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}

// Bands by order: first ones common, then uncommon, then rare (no nat20 for towns).
function bandTown(ids) {
  const n = ids.length;
  const c = Math.ceil(n / 3);
  const u = Math.ceil((n - c) / 2);
  return ids.map((id, i) => [id, i < c ? 'common' : i < c + u ? 'uncommon' : 'rare']);
}

const townTables = {};
{
  let heading = null;
  let block = null;
  const flush = () => {
    if (!block) return;
    const entries = blockEntries(block.lines);
    const zone = block.zone;
    const dayIds = dedupe(entries.filter((e) => !e.fish && !e.night).map((e) => e.id));
    const nightIds = dedupe(entries.filter((e) => !e.fish).map((e) => e.id));
    const fishIds = dedupe(entries.filter((e) => e.fish).map((e) => e.id));
    const t = {};
    if (dayIds.length) t.day = bandTown(dayIds);
    if (nightIds.length) t.night = bandTown(nightIds);
    if (fishIds.length) t.fish = bandTown(fishIds);
    if (zone && (t.day || t.night)) townTables[zone] = t;
    block = null;
  };
  for (const line of lines) {
    const l = line.trim();
    const hd = /^[GTL]\d · (.+)$/.exec(l);
    if (hd) {
      flush();
      const name = hd[1].split(EM)[0].trim();
      heading = TOWN_ZONE[name] || null;
      continue;
    }
    if (/^Encounters [^\w\s] .*proposed$/.test(l)) {
      flush();
      block = { zone: heading, lines: [] };
      continue;
    }
    if (!block) continue;
    if (/^Hooks/.test(l) || /^Route \d/.test(l) || /^\d+\. /.test(l)) { flush(); continue; }
    if (/^=== PAGE/.test(l) || /^Where Pok/.test(l)) continue;
    block.lines.push(l);
  }
  flush();
}

// ---- Assemble ---------------------------------------------------------------
const ENC = {};
const routeReport = [];
let noZone = 0;
for (const n of Object.keys(routeTables)) {
  const zone = `route${n}`;
  const t = routeTables[n];
  if (!ZONE_SET.has(zone)) { noZone++; continue; }
  if (!t.dn) continue;
  const z = { day: t.dn.day, night: t.dn.night };
  if (t.fish) z.fish = t.fish;
  ENC[zone] = z;
  routeReport.push(zone);
}
for (const zone of Object.keys(townTables)) {
  if (!ZONE_SET.has(zone)) { unresolved.push(`town zone ${zone} not in zones.js`); continue; }
  ENC[zone] = townTables[zone];
}

// design override (docs/REGION.md C1): Whitney's ace was a wild Miltank picked out of a field on Route 5, so they graze there as a rare find next to Bouffalant
if (ENC.route5 && !ENC.route5.day.some(([sp]) => sp === 'miltank')) ENC.route5.day.push(['miltank', 'rare']);
// design override (docs/TOWNPASS.md T8): the bible gives Duskmoss no fishing table of its own, only Route 103's (shore and dock), so the town's shore and jetty fish that table
if (ENC.duskmoss && ENC.route103?.fish) ENC.duskmoss.fish = ENC.route103.fish;

// design override (docs/TOWNPASS.md G6): the bible's Pinegrove file points at Route 3 for its wild table, so the town zone rolls Route 3's day and night entries (no nat20, as for every town)
if (ENC.route3 && ZONE_SET.has('pinegrove') && !ENC.pinegrove) ENC.pinegrove = { day: ENC.route3.day.filter(([, b]) => b !== 'nat20'), night: ENC.route3.night.filter(([, b]) => b !== 'nat20') };

// design override (docs/TOWNPASS.md G8): the bible's Sporehaven file gives an encounter identity (Mushroom, Poison, Fairy) but no table, and Route 2 is the same fungal forest, so the town zone rolls Route 2's day and night entries (no nat20, as for every town)
if (ENC.route2 && ZONE_SET.has('sporehaven') && !ENC.sporehaven) ENC.sporehaven = { day: ENC.route2.day.filter(([, b]) => b !== 'nat20'), night: ENC.route2.night.filter(([, b]) => b !== 'nat20') };

// design override (docs/TOWNPASS.md T6): Route 111 fishes from the shore and the dock, and the dock is Spindlewood's wharf, so the town zone fishes Route 111's table (the bible's Spindlewood file lists none)
if (ENC.route111?.fish && ENC.spindlewood && !ENC.spindlewood.fish) ENC.spindlewood.fish = ENC.route111.fish;

const zoneOrder = ZONES.filter((z) => ENC[z]);
const bodyLines = zoneOrder.map((z) => `  ${JSON.stringify(z)}: ${JSON.stringify(ENC[z])},`);
const out = [
  '// Generated by tools/build-adv-encounters.mjs from tools/.cache/kenora-bible.txt. Do not hand-edit.',
  '// Bands: common 45, uncommon 30, rare 20, nat20 5 (percent weights).',
  'window.ADV_ENC = {',
  ...bodyLines,
  '};',
  '',
];
fs.writeFileSync(OUT, out.join('\n'));

// ---- Report -----------------------------------------------------------------
const allIds = new Set();
for (const z of zoneOrder) {
  for (const k of ['day', 'night', 'fish']) for (const [id] of (ENC[z][k] || [])) allIds.add(id);
}
const routeZones = zoneOrder.filter((z) => z.startsWith('route')).length;
const townZones = zoneOrder.length - routeZones;
console.log(`zones with tables: ${zoneOrder.length} (routes ${routeZones}, towns ${townZones}); route tables skipped (no zone id): ${noZone}`);
console.log(`distinct species in encounters: ${allIds.size}`);
console.log(`unresolved: ${unresolved.length ? unresolved.join(' | ') : 'none'}`);
console.log(`appendix copy mismatches: ${dupMismatch.length ? dupMismatch.join(', ') : 'none'}`);

// ---- Self-check -------------------------------------------------------------
const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
need(unresolved.length === 0, 'unresolved names present');
for (const id of allIds) need(!!SPECIES[id], `id not in DEX: ${id}`);
need(ENC.route5 && ENC.route5.day[0][0] === 'wooloo' && ENC.route5.day[0][1] === 'common', 'route5 day common is not wooloo');
need(ENC.route7 && ENC.route7.night[0][0] === 'houndour' && ENC.route7.night[0][1] === 'common', 'route7 night common is not houndour');

if (fs.existsSync(TEMPER)) {
  delete window.ADV_TEMPER;
  require(TEMPER);
  const T = window.ADV_TEMPER || {};
  const want = new Set();
  const addEvo = (id) => {
    if (want.has(id)) return;
    want.add(id);
    for (const e of (ADV_DEX[id] && ADV_DEX[id].evos) || []) addEvo(e.to);
  };
  for (const id of allIds) addEvo(id);
  const missing = [...want].filter((id) => !T[id]);
  need(missing.length === 0, `temperament missing: ${missing.join(',')}`);
  for (const id of want) {
    const e = T[id];
    if (!e) continue;
    need(['aggressive', 'skittish', 'passive', 'territorial'].includes(e.t), `bad t for ${id}`);
    need(Array.isArray(e.group) && e.group.length === 2 && e.group[0] <= e.group[1], `bad group for ${id}`);
  }
  console.log(`temperament entries needed (encounters + evolutions): ${want.size}, missing: ${missing.length}`);
} else {
  fail.push('temperament.js not found');
}

if (fail.length) {
  console.log('SELF-CHECK FAILED:\n  ' + fail.join('\n  '));
  process.exitCode = 1;
} else {
  console.log('SELF-CHECK PASSED');
}
