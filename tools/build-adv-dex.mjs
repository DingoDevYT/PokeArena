// Builds data/adv/pokedata.js (window.ADV_DEX) for every non-mega species in data/dex.js.
// Reads the installed @pkmn packages, plus three PokeAPI CSVs (catch rate, growth rate, base exp) downloaded once into tools/.cache. Run from project root: node tools/build-adv-dex.mjs
import { Dex, toID } from '@pkmn/dex';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/adv/pokedata.js');
const d = Dex.forGen(9);
const LEGEND = new Set(['Restricted Legendary', 'Sub-Legendary', 'Mythical']);
const CACHE = path.join(ROOT, 'tools/.cache');
const GROWTH = { 1: 'slow', 2: 'mediumfast', 3: 'fast', 4: 'mediumslow', 5: 'erratic', 6: 'fluctuating' }; // PokeAPI growth_rate_id
const LEVEL_SRC = /^(\d*)L(\d+)$/; // "9L15" = gen 9, level 15; "L1" has no gen digit

// dex.js is a browser script (window.DEX = ...), so run it with window aliased to the global object.
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'data/dex.js'), 'utf8'), { filename: 'data/dex.js' });
const DEX = globalThis.DEX;
const ids = Object.keys(DEX.species).filter((id) => !DEX.species[id].isMega);

// Level-up moves from the newest generation that has any level-up entry. Level 0 (evolution moves) counts as 1.
async function levelUpOf(id) {
  const learnset = (await d.learnsets.get(id)).learnset || {};
  const byGen = new Map();
  for (const [move, sources] of Object.entries(learnset)) for (const src of sources) {
    const m = LEVEL_SRC.exec(src);
    if (!m) continue;
    const gen = m[1] ? +m[1] : 0;
    if (!byGen.has(gen)) byGen.set(gen, new Map());
    byGen.get(gen).set(`${Math.max(1, +m[2])}|${move}`, [Math.max(1, +m[2]), move]);
  }
  if (!byGen.size) return [];
  const latest = byGen.get(Math.max(...byGen.keys()));
  return [...latest.values()].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
}

// Evolution data lives on the target species (evoLevel, evoType, evoItem, evoCondition, evoMove).
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function evoStep(t) {
  const e = { to: t.id };
  if (t.evoLevel) e.level = t.evoLevel;
  if (t.evoItem) e.item = toID(t.evoItem);
  if (t.evoType === 'trade') e.trade = true;
  if (t.evoType === 'levelFriendship') e.friendship = true;
  const cond = t.evoCondition || '';
  const time = /\bnight\b/i.test(cond) ? 'night' : /\bday\b/i.test(cond) ? 'day' : null;
  if (time) e.time = time;
  const notes = [];
  if (cond && !time) notes.push(cond);
  if (t.evoType === 'levelMove' && t.evoMove) notes.push(`knows ${d.moves.get(t.evoMove).name}`);
  if (notes.length) e.other = cap(notes.join(', '));
  return e;
}

// PokeAPI CSVs (raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv), fetched once
async function csv(name) {
  const f = path.join(CACHE, `pokeapi-${name}.csv`);
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/${name}.csv`);
    assert.ok(r.ok, `${name}.csv: HTTP ${r.status}`);
    fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, await r.text());
  }
  const [head, ...rows] = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map((l) => l.split(','));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
// species by national dex number (DEX num); a form has the base species' catch and growth rate. base_experience by exact form identifier (hyphens dropped), else the species' default form.
const apiSpecies = new Map((await csv('pokemon_species')).map((r) => [+r.id, r]));
const apiMons = await csv('pokemon');
const expById = new Map(apiMons.map((r) => [r.identifier.replace(/-/g, ''), +r.base_experience]));
const expDefault = new Map(apiMons.filter((r) => r.is_default === '1').map((r) => [+r.species_id, +r.base_experience]));
const apiMiss = [];
function apiOf(id) {
  const num = DEX.species[id].num, sp = apiSpecies.get(num);
  if (!sp) { apiMiss.push(id); return { catchRate: null, baseExp: null, growthRate: null }; }
  return { catchRate: +sp.capture_rate, baseExp: expById.get(id) ?? expDefault.get(num) ?? null, growthRate: GROWTH[sp.growth_rate_id] };
}

const out = {};
const dropped = { evoTargets: 0, prevo: 0, notInPkmn: [] };
for (const id of ids) {
  const s = d.species.get(id);
  if (!s.exists) { // project-only dummy (Substitute Doll): nothing to bake
    out[id] = { levelMoves: [], evos: [], prevo: null, baseStage: true, catchRate: null, baseExp: null, growthRate: null,
      genderRatio: null, eggGroups: [], legendary: false };
    dropped.notInPkmn.push(id);
    continue;
  }
  let moves = await levelUpOf(id);
  if (!moves.length && s.baseSpecies && d.species.get(s.baseSpecies).id !== id) moves = await levelUpOf(d.species.get(s.baseSpecies).id);
  const levelMoves = moves.filter(([, m]) => DEX.moves[m] && !DEX.moves[m].banned);

  const evos = [];
  for (const name of s.evos || []) {
    const t = d.species.get(name);
    if (DEX.species[t.id] && !DEX.species[t.id].isMega) evos.push(evoStep(t));
    else dropped.evoTargets++;
  }
  let prevo = s.prevo ? d.species.get(s.prevo).id : null;
  if (prevo && !DEX.species[prevo]) { dropped.prevo++; prevo = null; }

  out[id] = {
    levelMoves,
    evos,
    prevo,
    baseStage: prevo === null,
    ...apiOf(id),
    genderRatio: s.gender === 'N' ? 'N' : { M: s.genderRatio.M, F: s.genderRatio.F },
    eggGroups: [...s.eggGroups],
    legendary: s.tags.some((t) => LEGEND.has(t)),
  };
}

const body = Object.entries(out).map(([id, v]) => `${JSON.stringify(id)}: ${JSON.stringify(v)}`).join(',\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `window.ADV_DEX = {\n${body}\n};\n`);

// ---------- self-check (reads back the file as written) ----------
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(OUT, 'utf8'), sandbox);
const ADV = JSON.parse(JSON.stringify(sandbox.window.ADV_DEX)); // plain objects (the sandbox has its own realm)
assert.ok(ADV, 'ADV_DEX missing from written file');
assert.equal(Object.keys(ADV).length, ids.length, 'species count mismatch');
assert.deepEqual(ADV.bulbasaur.evos.find((e) => e.to === 'ivysaur'), { to: 'ivysaur', level: 16 });
assert.ok(ADV.eevee.evos.length >= 3 && ADV.eevee.evos.some((e) => e.item), 'eevee evos');
assert.equal(ADV.wooloo.baseStage, true);
assert.deepEqual(ADV.dubwool.prevo, 'wooloo');
assert.deepEqual(ADV.wooloo.evos.find((e) => e.to === 'dubwool'), { to: 'dubwool', level: 24 });
assert.equal(ADV.mewtwo.legendary, true);
assert.deepEqual([ADV.wooloo.catchRate, ADV.wooloo.baseExp, ADV.wooloo.growthRate], [255, 122, 'mediumfast']);
assert.deepEqual([ADV.bulbasaur.catchRate, ADV.bulbasaur.baseExp, ADV.bulbasaur.growthRate], [45, 64, 'mediumslow']);
assert.deepEqual([ADV.mewtwo.catchRate, ADV.gengar.growthRate, ADV.pikachu.growthRate, ADV.charizard.growthRate], [3, 'mediumslow', 'mediumfast', 'mediumslow']);
assert.equal(ADV.raichualola.catchRate, 75); assert.equal(ADV.raichualola.baseExp, 243); assert.equal(ADV.raichualola.growthRate, 'mediumfast');
assert.equal(ADV.gyarados.growthRate, 'slow'); assert.equal(ADV.dragonite.growthRate, 'slow'); assert.equal(ADV.nincada.growthRate, 'erratic'); assert.equal(ADV.chansey.growthRate, 'fast');
assert.equal(ADV.ralts.growthRate, 'slow'); assert.equal(ADV.togepi.growthRate, 'fast'); assert.equal(ADV.arcanine.growthRate, 'slow');
for (const s of Object.values(ADV)) for (const [, m] of s.levelMoves) {
  assert.ok(DEX.moves[m], `levelMoves id ${m} not in DEX.moves`);
  assert.ok(!DEX.moves[m].banned, `banned move ${m} in levelMoves`);
}

const nulls = ['catchRate', 'baseExp', 'growthRate'].filter((k) => Object.values(ADV).some((v) => v[k] === null)).map((k) => `${k}: ${Object.entries(ADV).filter(([, v]) => v[k] === null).map(([i]) => i).join(' ')}`);
console.log(JSON.stringify({
  species: ids.length, bytes: fs.statSync(OUT).size, dropped, noApiSpecies: apiMiss, nullFields: nulls,
  noLevelMoves: Object.keys(ADV).filter((k) => !ADV[k].levelMoves.length).length,
}, null, 1));
console.log('self-check passed');
