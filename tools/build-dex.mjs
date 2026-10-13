// Builds data/dex.js + data/vfx.js and downloads the PMDO particles/beams/sounds they reference.
// Run from project root: node tools/build-dex.mjs
import { Dex, toID } from '@pkmn/dex';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const d = Dex.forGen(9);
const CACHE = 'tools/.cache';
const RAW_DUMP = 'https://raw.githubusercontent.com/audinowho/DumpAsset/master';
const RAW_ASSET = 'https://raw.githubusercontent.com/PMDCollab/RawAsset/master';
const API = 'https://api.github.com/repos';
fs.mkdirSync(`${CACHE}/skill`, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, file, binary = false) {
  if (file && fs.existsSync(file)) return binary ? fs.readFileSync(file) : fs.readFileSync(file, 'utf8');
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'pokearena-build' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      const body = binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
      if (file) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); }
      return body;
    } catch (e) {
      if (i >= 4) throw e;
      await sleep(500 * 2 ** i);
    }
  }
}
async function pool(items, fn, n = 6) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}
const json = async (url, file) => JSON.parse(await get(url, file));
const short = (t) => t.split(',')[0].split('.').pop();

// ---------- species ----------
// Every species plus the forms that change stats, types or abilities. Megas/primals hang off their base.
const tracker = await json('https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/tracker.json', `${CACHE}/tracker.json`);
const SKIP_NS = new Set(['CAP', 'Custom', 'LGPE']);
const KEEP_BATTLE_ONLY = new Set(['zaciancrowned', 'zamazentacrowned']); // hold-item forms, picked like any other species
const SKIP_FORMS = /^(pikachu(cosplay|rockstar|belle|popstar|phd|libre)|pichuspikyeared|eternatuseternamax)$/;
const isMegaForm = (s) => /(^|-)(Mega|Primal)/.test(s.forme);
const sameAsBase = (s, b) => JSON.stringify([s.baseStats, s.types, s.abilities]) === JSON.stringify([b.baseStats, b.types, b.abilities]);
const dex4 = (n) => String(n).padStart(4, '0');
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
// @pkmn forme (or species id) -> SpriteCollab subgroup name, where they differ
const FORM_ALIAS = { paldeacombat: 'paldea', sandy: 'sand', mmega: 'mega', curlymega: 'mega', bluestriped: 'blue', whitestriped: 'white',
  zaciancrowned: 'crownedsword', zamazentacrowned: 'crownedshield', calyrexice: 'icerider', calyrexshadow: 'shadowrider' };
const report = { noTrackerForm: [], femaleUsesBase: [], megaSkipped: [] };
function spriteKeyOf(s) {
  const dex = dex4(s.num);
  if (!s.forme) return dex;
  if (/^F$|-F$/.test(s.forme) || s.forme === 'F-Mega') { report.femaleUsesBase.push(s.id); return dex; }
  const want = norm(s.forme), subs = Object.entries(tracker[dex]?.subgroups || {});
  const hit = subs.find(([, g]) => norm(g.name) === want) || subs.find(([, g]) => norm(g.name) === (FORM_ALIAS[s.id] || FORM_ALIAS[want]));
  if (!hit) { report.noTrackerForm.push(s.id); return dex; }
  return `${dex}-${parseInt(hit[0], 10)}`;
}
const pool0 = d.species.all().filter((s) => s.num >= 1 && !SKIP_NS.has(s.isNonstandard) && !s.isGigantamax && !s.isTotem);
const bases = new Map(pool0.filter((s) => !s.forme).map((s) => [s.id, s]));
const forms = pool0.filter((s) => s.forme && !isMegaForm(s) && !SKIP_FORMS.test(s.id) && !/Totem|Gmax/.test(s.forme)
  && (!s.battleOnly || KEEP_BATTLE_ONLY.has(s.id)) && !sameAsBase(s, bases.get(toID(s.baseSpecies))));
const megaList = pool0.filter((s) => s.forme && isMegaForm(s));
const species = {};
const learners = {}; // move id -> Set of species ids (bases + forms, not megas)

// Own learnset + prevo chain; forms that only tweak their base (appliances, Therian, Origin...) also get the base's moves.
async function learnsetOf(s) {
  const out = new Set(), seen = new Set();
  async function visit(c) {
    for (; c && !seen.has(c.id); c = c.prevo ? d.species.get(c.prevo) : null) {
      seen.add(c.id);
      const l = (await d.learnsets.get(c.id))?.learnset || {};
      for (const m in l) out.add(m);
      if (c.forme && (c.changesFrom || c.battleOnly || !Object.keys(l).length)) await visit(d.species.get(c.changesFrom || c.baseSpecies));
    }
  }
  await visit(s);
  return [...out].sort();
}
const entry = (s) => ({ id: s.id, num: s.num, name: s.name, types: [...s.types], baseStats: { ...s.baseStats }, abilities: { ...s.abilities },
  weightkg: s.weightkg, learnset: [], megas: [], sprite: spriteKeyOf(s) });
for (const s of [...bases.values(), ...forms].sort((a, b) => a.num - b.num)) {
  const learnset = await learnsetOf(s);
  for (const m of learnset) (learners[m] ||= new Set()).add(s.id);
  species[s.id] = { ...entry(s), learnset };
}
const megaStones = {}; // item id -> mega id
for (const s of megaList) {
  const base = species[toID(s.changesFrom || s.baseSpecies)];
  const stone = s.requiredItem ? toID(s.requiredItem) : '';
  if (!base) { report.megaSkipped.push(`${s.id} (base form not in roster)`); continue; }
  if (!stone && !s.requiredMove) { report.megaSkipped.push(`${s.id} (no stone or move)`); continue; }
  if (stone && megaStones[stone]) { report.megaSkipped.push(`${s.id} (shares ${s.requiredItem} with ${megaStones[stone]})`); continue; }
  if (stone) megaStones[stone] = s.id;
  base.megas.push(s.id);
  species[s.id] = { ...entry(s), isMega: true, baseSpecies: base.id, ...(stone ? { requiredItem: s.requiredItem } : { requiredMove: s.requiredMove }) };
}

// ---------- banned rules ----------
const BAN_DAMAGING = {
  counter: 'Reflects damage taken back (needs damage history)', mirrorcoat: 'Reflects damage taken back (needs damage history)',
  metalburst: 'Reflects damage taken back (needs damage history)', bide: 'Stores damage over turns, then releases it',
  snore: 'Only works while asleep (no sleep-acting)', struggle: 'Not a real move (used when out of PP)',
  naturalgift: 'Depends on held Berry', fling: 'Depends on held item', beatup: 'Depends on the whole party',
  lastresort: 'Needs every other move used first', spitup: 'Needs Stockpile', belch: 'Needs a Berry eaten first',
  shelltrap: 'Needs a turn-order trap trigger', comeuppance: 'Reflects damage taken back (needs damage history)',
};
const CALLS = ['metronome', 'mirrormove', 'assist', 'copycat', 'mefirst', 'naturepower', 'sleeptalk'];
const ALLOW_STATUS = new Set(['recover', 'softboiled', 'milkdrink', 'roost', 'slackoff', 'synthesis', 'morningsun',
  'moonlight', 'rest', 'yawn', 'protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'endure', 'haze',
  'defog', 'leechseed', 'focusenergy', 'taunt', 'roar', 'whirlwind', 'bellydrum', 'painsplit',
  'transform', 'obstruct', 'silktrap', 'burningbulwark', 'shoreup']); // Protect variants battle.js already knows (PROTECTS)
const BAN_STATUS = {
  wish: 'Delayed heal on a later turn', substitute: 'Needs a decoy HP system',
  mimic: 'Copies a move (not supported)', sketch: 'Copies a move permanently (not supported)',
  encore: 'Forces move repeats (not supported)', disable: 'Disables a move (not supported)',
  perishsong: 'Faint countdown (not supported)', destinybond: 'Faint-linked effect (not supported)',
  batonpass: 'Passes boosts on switch (not supported)', swallow: 'Needs Stockpile', stockpile: 'Stockpile system not supported',
  curse: 'Does different things for Ghost types (not supported)', attract: 'Infatuation not supported',
  helpinghand: 'Doubles-only move', followme: 'Doubles-only move', ragepowder: 'Doubles-only move', afteryou: 'Doubles-only move',
  allyswitch: 'Doubles-only move', wideguard: 'Doubles-only move', quickguard: 'Doubles-only move', spotlight: 'Doubles-only move',
  holdhands: 'Doubles-only move', splash: 'Does nothing', celebrate: 'Does nothing', healbell: 'Cures the whole team (not supported)',
  aromatherapy: 'Cures the whole team (not supported)', refresh: 'Cures own status (not supported)',
  trick: 'Swaps held items (not supported)', switcheroo: 'Swaps held items (not supported)', recycle: 'Restores used items (not supported)',
  meanlook: 'Trapping not supported', block: 'Trapping not supported', lockon: 'Sure-hit lock-on not supported',
  mindreader: 'Sure-hit lock-on not supported', psychup: 'Copies stat changes (not supported)', healpulse: 'Heals the target (opponent in 1v1)',
  // Gens 2-9 roster
  floralhealing: 'Heals the target (opponent in 1v1)', purify: 'Heals the target (opponent in 1v1)',
  aromaticmist: 'Doubles-only move', decorate: 'Doubles-only move (would boost the foe in 1v1)', coaching: 'Doubles-only move',
  clangoroussoul: 'Pays HP for its boosts (HP cost not supported)', filletaway: 'Pays HP for its boosts (HP cost not supported)',
  spiderweb: 'Trapping not supported', octolock: 'Trapping not supported',
  junglehealing: 'Heals the whole team (not supported)', lunarblessing: 'Heals the whole team (not supported)',
  takeheart: 'Cures own status (not supported)', revivalblessing: 'Revives a fainted teammate (not supported)',
  courtchange: 'Swaps field effects between sides (not supported)', doodle: 'Copies an ability (not supported)',
  instruct: 'Makes the target repeat its move (not supported)', topsyturvy: 'Inverts stat changes (not supported)',
  magicpowder: "Changes the target's type (not supported)", forestscurse: "Changes the target's type (not supported)",
  trickortreat: "Changes the target's type (not supported)", stuffcheeks: 'Needs a Berry (not supported)', teatime: 'Needs Berries (not supported)',
  tidyup: 'Clears hazards and boosts in one (not supported)', heartswap: 'Swaps stat changes (not supported)',
};
const SIDES = new Set(['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'reflect', 'lightscreen', 'auroraveil', 'safeguard', 'tailwind', 'mist']);

function banOf(m) {
  if (m.ohko) return 'One-hit KO move';
  if (BAN_DAMAGING[m.id]) return BAN_DAMAGING[m.id];
  if (CALLS.includes(m.id)) return m.id === 'sleeptalk' ? 'Only works while asleep (no sleep-acting)' : 'Calls another move';
  if (BAN_STATUS[m.id]) return BAN_STATUS[m.id];
  if (m.category !== 'Status') return '';
  if (ALLOW_STATUS.has(m.id)) return '';
  if (m.selfdestruct) return 'User faints (sacrifice move)';
  if (m.selfSwitch) return 'Switch-out move (not supported)';
  if (m.boosts || m.self?.boosts || m.heal || m.status || m.volatileStatus === 'confusion' || m.weather || m.terrain) return '';
  if (m.sideCondition) return SIDES.has(m.sideCondition) ? '' : `Side effect '${m.sideCondition}' not supported`;
  if (m.slotCondition) return 'Delayed slot effect not supported';
  if (m.pseudoWeather) return `Field effect '${m.pseudoWeather}' not supported`;
  if (m.volatileStatus) return `'${m.volatileStatus}' effect not supported`;
  if (m.self?.volatileStatus) return `'${m.self.volatileStatus}' effect not supported`;
  return 'Custom effect not supported';
}

// ---------- PMDO skill files ----------
const listing = await json(`${API}/audinowho/DumpAsset/contents/Data/Skill`, `${CACHE}/skilllist.json`);
const pmdoFile = new Map();
for (const { name } of listing) {
  if (!name.endsWith('.json')) continue;
  const mv = d.moves.get(name.slice(0, -5));
  if (mv.exists && !pmdoFile.has(mv.id)) pmdoFile.set(mv.id, name);
}
const gfx = await get(`${RAW_DUMP}/Base/GFXParams.xml`, `${CACHE}/GFXParams.xml`);
const ACTIONS = [...gfx.match(/<Actions>([\s\S]*?)<\/Actions>/)[1].matchAll(/<Action>([\s\S]*?)<\/Action>/g)].map(([, b]) => ({
  name: b.match(/<Name>(.*?)<\/Name>/)[1],
  dash: /<Dash>true<\/Dash>/.test(b),
  fallbacks: [...b.matchAll(/<Fallback>(.*?)<\/Fallback>/g)].map((x) => x[1]),
}));
const COVER = { Attack: ['Front', 'FrontAndCorners', 'Wide', 'Around'], Dash: ['Front', 'FrontAndCorners', 'Wide'] };
const AREA = { Area: ['Full', 'Cone', 'Cross', 'Sides'], Offset: ['Tile', 'Sides', 'Cross', 'Area'] };
const RAYS = ['One', 'Three', 'FourCross', 'Five', 'Eight'];
const ARC = ['Single', 'Line', 'WideAngle'];
const PROCESS = ['None', 'Spin', 'Drop', 'Fly', 'Kidnap'];
const APPEAR = ['Normal', 'DropDown', 'Invisible', 'Kidnap', 'Leap'];

// ColumnAnim -> Beam folder, FiniteOverlayEmitter -> full-screen BG overlay; everything else is a particle sheet.
function anims(node, out = [], skip = null, side = null, kind = '') {
  if (!node || typeof node !== 'object' || node === skip) return out;
  const t = node.$type ? short(node.$type) : '';
  if (t === 'ColumnAnim') kind = 'columns';
  if (t === 'FiniteOverlayEmitter') kind = 'overlays';
  const a = node.AnimIndex;
  if (typeof a === 'string' && a) {
    const list = kind && side ? side[kind] : out;
    if (!list.includes(a)) list.push(a);
  }
  for (const v of Object.values(node)) anims(v, out, skip, side, kind);
  return out;
}
const okSound = (s) => s && s !== '-';
const sounds = (fxs) => fxs.flat().map((f) => f?.Sound).find(okSound) || '';

function extractFx(o) {
  const h = o.HitboxAction;
  const hitbox = short(h.$type).replace(/Action$/, '').replace(/^WaveMotion$/, 'Wave');
  const fx = { hitbox, range: h.Range ?? (hitbox === 'Attack' ? 1 : 0), speed: h.Speed ?? 0 };
  if (hitbox === 'Attack' || hitbox === 'Dash') fx.shape = COVER[hitbox][h.WideAngle];
  if (hitbox === 'Area' || hitbox === 'Offset') fx.shape = AREA[hitbox][h.HitArea];
  if (hitbox === 'Throw') fx.shape = ARC[h.Coverage];
  if (hitbox === 'Projectile') { fx.shape = RAYS[h.Rays]; fx.boomerang = h.Boomerang; }
  if (hitbox === 'Wave') { fx.wide = h.Wide; fx.linger = h.Linger; }
  if (hitbox === 'Dash') fx.appearance = APPEAR[h.AppearanceMod];
  if ('StopAtHit' in h) fx.stopAtHit = h.StopAtHit;
  if ('StopAtWall' in h) fx.stopAtWall = h.StopAtWall;
  fx.explosionRange = o.Explosion?.Range || 0;
  const side = { columns: [], overlays: [] };
  fx.anims = anims(h, [], hitbox === 'Wave' ? h.Anim : null, side);
  fx.explosionAnims = anims(o.Explosion, [], null, side);
  fx.columns = side.columns;
  fx.overlays = side.overlays;
  fx.hitAnim = anims(o.Data?.HitFX)[0] || '';
  fx.beam = hitbox === 'Wave' ? h.Anim?.AnimIndex || '' : '';
  fx.sound = sounds([h.ActionFX, h.PreActions, o.Data?.IntroFX, o.Explosion?.ExplodeFX]);
  fx.hitSound = sounds([o.Data?.HitFX]);
  fx.shake = h.ActionFX?.ScreenMovement?.MaxShake || 0;
  let type = h.CharAnim, cad = h.CharAnimData;
  if (cad && cad.$type.includes('CharAnimFrameType')) type = cad.ActionType;
  if (type === undefined && cad) { fx.charProcess = PROCESS[cad.Process]; type = cad.AnimOverride || 0; }
  const act = ACTIONS[type] || ACTIONS[0];
  fx.charAnim = act.name;
  fx.charAnimFallbacks = act.fallbacks;
  fx.charDash = act.dash;
  return fx;
}

// ---------- moves ----------
const COPY = ['secondary', 'secondaries', 'self', 'boosts', 'status', 'volatileStatus', 'drain', 'recoil', 'heal', 'multihit',
  'critRatio', 'weather', 'terrain', 'sideCondition', 'selfSwitch', 'ohko', 'shortDesc', 'forceSwitch', 'selfdestruct',
  'damage', 'overrideDefensiveStat', 'overrideOffensiveStat', 'overrideOffensivePokemon', 'hasCrashDamage', 'willCrit',
  'thawsTarget', 'breaksProtect', 'pseudoWeather', 'ignoreImmunity', 'mindBlownRecoil', 'struggleRecoil'];
const isZMax = (id) => { const m = d.moves.get(id); return !m.exists || m.isZ || m.isMax || SKIP_NS.has(m.isNonstandard); };
for (const id of Object.keys(learners)) if (isZMax(id)) delete learners[id];
for (const s of Object.values(species)) if (!s.isMega) s.learnset = s.learnset.filter((id) => learners[id]);
for (const s of Object.values(species)) if (s.isMega) s.learnset = species[s.baseSpecies].learnset;
const moveIds = Object.keys(learners).sort();
const moves = {};
const fxMisses = [];
await pool(moveIds, async (id) => {
  const m = d.moves.get(id);
  const out = {
    id: m.id, name: m.name, type: m.type, category: m.category, basePower: m.basePower, accuracy: m.accuracy,
    pp: m.pp, priority: m.priority, target: m.target, flags: { ...m.flags },
  };
  for (const k of COPY) if (m[k] !== undefined && m[k] !== null && m[k] !== false) out[k] = m[k];
  out.bannedReason = banOf(m);
  out.banned = !!out.bannedReason;
  const f = pmdoFile.get(id);
  const raw = f && (await get(`${RAW_DUMP}/Data/Skill/${f}`, `${CACHE}/skill/${f}`));
  out.fx = raw ? extractFx(JSON.parse(raw).Object) : null;
  if (!raw) fxMisses.push(id);
  moves[id] = out;
});
const movesSorted = Object.fromEntries(moveIds.map((id) => [id, moves[id]]));

// ---------- abilities, items, natures, type chart ----------
const abilities = {};
for (const s of Object.values(species)) for (const a of Object.values(s.abilities)) {
  const ab = d.abilities.get(a);
  abilities[ab.id] = { name: ab.name, shortDesc: ab.shortDesc };
}
const ITEMS = ['Leftovers', 'Black Sludge', 'Life Orb', 'Choice Band', 'Choice Specs', 'Choice Scarf', 'Focus Sash',
  'Assault Vest', 'Rocky Helmet', 'Expert Belt', 'Muscle Band', 'Wise Glasses', 'Charcoal', 'Mystic Water', 'Miracle Seed',
  'Magnet', 'Never-Melt Ice', 'Black Belt', 'Poison Barb', 'Soft Sand', 'Sharp Beak', 'Twisted Spoon', 'Silver Powder',
  'Hard Stone', 'Spell Tag', 'Dragon Fang', 'Black Glasses', 'Metal Coat', 'Silk Scarf', 'Fairy Feather', 'Sitrus Berry',
  'Lum Berry', 'Heavy-Duty Boots', 'Eviolite', 'Light Ball', 'Thick Club', 'Leek', 'Lucky Punch', 'Metal Powder',
  'Air Balloon', 'Flame Orb', 'Toxic Orb', 'Shell Bell', "King's Rock", 'Scope Lens', 'Razor Claw', 'White Herb',
  'Mental Herb', 'Weakness Policy', 'Light Clay', 'Damp Rock', 'Heat Rock', 'Smooth Rock', 'Icy Rock', 'Terrain Extender',
  'Big Root', 'Metronome', 'Quick Claw'];
const items = {};
for (const n of ITEMS) {
  const it = d.items.get(n);
  if (!it.exists) throw new Error(`unknown item ${n}`);
  items[it.id] = { name: it.name, shortDesc: it.shortDesc };
}
for (const [stone, id] of Object.entries(megaStones)) {
  const it = d.items.get(stone);
  items[it.id] = { name: it.name, shortDesc: it.shortDesc || it.desc || `Lets ${species[species[id].baseSpecies].name} Mega Evolve.`, megaStone: id };
}
const natures = Object.fromEntries(d.natures.all().map((n) => [n.id, { name: n.name, plus: n.plus || '', minus: n.minus || '' }]));
const TYPES = d.types.all().filter((t) => t.name !== 'Stellar' && !t.isNonstandard).map((t) => t.name);
const typeChart = Object.fromEntries(TYPES.map((t) => [t, {}]));
const MULT = [1, 2, 0.5, 0];
for (const def of TYPES) for (const atk of TYPES) {
  const v = MULT[d.types.get(def).damageTaken[atk]];
  if (v !== 1) typeChart[atk][def] = v;
}

// ---------- VFX assets ----------
const ptree = await json(`${API}/PMDCollab/RawAsset/git/trees/master`, `${CACHE}/rawroot.json`);
const sha = (p) => ptree.tree.find((x) => x.path === p).sha;
const particleTree = await json(`${API}/PMDCollab/RawAsset/git/trees/${sha('Particle')}`, `${CACHE}/particletree.json`);
const beamTree = await json(`${API}/PMDCollab/RawAsset/git/trees/${sha('Beam')}?recursive=1`, `${CACHE}/beamtree.json`);
const bgTree = await json(`${API}/PMDCollab/RawAsset/git/trees/${sha('BG')}`, `${CACHE}/bgtree.json`);
const particleFiles = new Map();
for (const x of particleTree.tree) particleFiles.set(x.path.split('.')[0], x.type === 'tree' ? { dir: x.sha } : x.path);
const bgFiles = new Map(bgTree.tree.map((x) => [x.path.split('.')[0], x.path]));
const beamNames = new Set(beamTree.tree.filter((x) => x.type === 'tree').map((x) => x.path));
const DIV = { Dir2: 2, Dir5: 5, Dir8: 8 };

const want = { particles: new Set(), overlays: new Set(), beams: new Set(), sounds: new Set() };
for (const m of Object.values(movesSorted)) {
  if (!m.fx) continue;
  [...m.fx.anims, ...m.fx.explosionAnims, m.fx.hitAnim].filter(Boolean).forEach((a) => want.particles.add(a));
  [m.fx.beam, ...m.fx.columns].filter(Boolean).forEach((b) => want.beams.add(b));
  m.fx.overlays.forEach((a) => want.overlays.add(a));
  [m.fx.sound, m.fx.hitSound].filter(Boolean).forEach((s) => want.sounds.add(s));
}
// Generic pixel-art effects the engine uses for hits, rings, dust, hazards, status and stat changes.
const GENERIC = ['Hit_Neutral', 'Hit_Super_Effective', 'Circle_White_Out', 'Circle_White_In', 'Circle_Small_White_Out', 'Circle_Blue_Out', 'Circle_Red_Out', 'Circle_Green_Out',
  'Circle_Pink_Out', 'Circle_Purple_Out', 'Circle_Yellow_Out', 'Circle_Small_Yellow_Out', 'Cut', 'Slash', 'Scratch', 'Puff_White', 'Puff_Brown', 'Puff_Black', 'Puff_Red', 'Puff_Blue', 'Puff_Green',
  'Puff_Yellow', 'Puff_Purple', 'Puff_Pink', 'Smoke_White', 'Smoke_Black', 'Spikes_RSE', 'Spikes_Purple_RSE', 'Stealth_Rock_Front', 'Stealth_Rock_Back', 'String_Shot_Web',
  'Stat_Blue_Ring', 'Stat_Red_Ring', 'Stat_Green_Ring', 'Stat_Yellow_Ring', 'Stat_Pink_Ring', 'Stat_Purple_Ring', 'Stat_White_Ring', 'Light_Ball_Blue', 'Light_Ball_Brown', 'Light_Ball_Green',
  'Light_Ball_Pink', 'Light_Ball_Purple', 'Light_Ball_White', 'Light_Ball_Yellow', 'Spark', 'Explosion', 'Rock_Pieces', 'Sparkle_RSE', 'Charge_Up', 'Emote_Shock', 'Shock_Wave', 'Discharge_Hit',
  'Wave_Circle_White', 'Mega_Background_White', 'Fire_Fang_Hit', 'Ice_Shard_Hit', 'Poison_Trap_Spike', 'Leaf_Storm_Hit_Mark', 'Mud_Bomb_Hit'];
GENERIC.forEach((a) => want.particles.add(a));
const VFX = { particles: {}, beams: {}, sounds: {} };
const missing = { particles: [], beams: [], sounds: [] };
let bytes = 0;
const fileSize = (p) => (bytes += fs.statSync(p).size);

// Folder particles (one PNG per frame + DirData.xml) get stitched into a horizontal strip.
async function stitchFolder(name, dir, dest) {
  const t = await json(`${API}/PMDCollab/RawAsset/git/trees/${dir}`, `${CACHE}/tree_${name}.json`);
  const n = t.tree.filter((x) => /^\d+\.png$/.test(x.path)).length;
  if (fs.existsSync(dest)) return `${name}.${n}`;
  const xml = await get(`${RAW_ASSET}/Particle/${name}/DirData.xml`, `${CACHE}/dir_${name}.xml`);
  const type = xml.match(/<DirType>(\w+)<\/DirType>/)[1];
  if (type !== 'None') throw new Error(`folder particle ${name} is ${type}`);
  const frames = [];
  for (let i = 0; i < n; i++) frames.push(PNG.sync.read(await get(`${RAW_ASSET}/Particle/${name}/${i}.png`, `${CACHE}/frames/${name}/${i}.png`, true)));
  const { width: w, height: h } = frames[0];
  const out = new PNG({ width: w * n, height: h });
  frames.forEach((f, i) => PNG.bitblt(f, out, 0, 0, w, h, i * w, 0));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, PNG.sync.write(out));
  return `${name}.${n}`;
}
const particleJobs = [...[...want.particles].map((n) => [n, false]), ...[...want.overlays].map((n) => [n, true])];
await pool(particleJobs, async ([name, overlay]) => {
  let src = (overlay ? bgFiles : particleFiles).get(name);
  if (!src) return missing.particles.push(name);
  const dest = overlay ? `assets/particle/bg/${name}.png` : `assets/particle/${name}.png`;
  if (src.dir) src = await stitchFolder(name, src.dir, dest);
  const buf = await get(`${RAW_ASSET}/${overlay ? 'BG' : 'Particle'}/${encodeURIComponent(src)}`, dest, true);
  if (!buf) return missing.particles.push(name);
  const { width, height } = PNG.sync.read(buf);
  const kind = src.split('.')[1];
  let rec;
  if (/^\d+$/.test(kind)) rec = { fw: width / +kind, fh: height, frames: +kind, dirs: 1 };
  else { const fw = height / (DIV[kind] || 1); rec = { fw, fh: fw, frames: width / fw, dirs: DIV[kind] || 1 }; }
  if (!Number.isInteger(rec.fw) || !Number.isInteger(rec.frames)) console.warn(`odd particle size ${src} ${width}x${height}`);
  VFX.particles[name] = { file: dest, ...rec, ...(overlay ? { overlay: true } : {}), ...(kind !== 'None' && kind !== 'Dir8' && !/^\d+$/.test(kind) ? { rot: kind } : {}) };
  fileSize(dest);
});
await pool([...want.beams], async (name) => {
  if (!beamNames.has(name)) return missing.beams.push(name);
  const rec = {};
  for (const part of ['Head', 'Body', 'Tail']) {
    const dest = `assets/beam/${name}/${part}.png`;
    await get(`${RAW_ASSET}/Beam/${name}/${part}.png`, dest, true);
    rec[part.toLowerCase()] = dest;
    fileSize(dest);
  }
  const xml = await get(`${RAW_ASSET}/Beam/${name}/BeamData.xml`, `${CACHE}/beam/${name}.xml`);
  rec.frames = +xml.match(/<TotalFrames>(\d+)<\/TotalFrames>/)[1];
  VFX.beams[name] = rec;
});
await pool([...want.sounds], async (name) => {
  const dest = `assets/sfx/${name}.ogg`;
  const buf = await get(`${RAW_DUMP}/Content/Sound/Battle/${name}.ogg`, dest, true);
  if (!buf) return missing.sounds.push(name);
  VFX.sounds[name] = dest;
  fileSize(dest);
});
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

// ---------- write ----------
// Compact for file:// load: drop fx fields the game never reads, store each learnset as 2-char base-36 indexes into
// the move list (megas reuse their base's), and expand both back into the documented shape when the script runs.
const DROP_FX = ['boomerang', 'stopAtHit', 'stopAtWall', 'explosionAnims', 'overlays', 'hitSound', 'shake', 'charDash', 'appearance', 'wide', 'linger', 'charProcess'];
for (const m of Object.values(movesSorted)) if (m.fx) for (const k of DROP_FX) delete m.fx[k];
if (moveIds.length > 36 * 36) throw new Error('too many moves for 2-char learnset codes');
const moveIndex = new Map(moveIds.map((id, i) => [id, i.toString(36).padStart(2, '0')]));
const speciesOut = Object.fromEntries(Object.entries(species).map(([id, s]) =>
  [id, { ...s, learnset: s.isMega ? '' : s.learnset.map((m) => moveIndex.get(m)).join('') }]));
const DEX = { species: speciesOut, moves: movesSorted, abilities: sortObj(abilities), items, natures, typeChart };
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/dex.js', `window.DEX = ${JSON.stringify(DEX)};
(D => { const ids = Object.keys(D.moves), S = D.species;
  for (const k in S) if (!S[k].isMega) S[k].learnset = (S[k].learnset.match(/../g) || []).map(c => ids[parseInt(c, 36)]);
  for (const k in S) if (S[k].isMega) S[k].learnset = S[S[k].baseSpecies].learnset; })(window.DEX);
`);
fs.writeFileSync('data/vfx.js', `window.VFX = ${JSON.stringify({ particles: sortObj(VFX.particles), beams: sortObj(VFX.beams), sounds: sortObj(VFX.sounds) })};\n`);

const banned = Object.values(movesSorted).filter((m) => m.banned)
  .map((m) => ({ name: m.name, n: learners[m.id].size, why: m.bannedReason }))
  .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
const total = moveIds.length;
fs.writeFileSync('docs/BANNED_MOVES.md', `# Banned moves

PokeArena only runs moves whose effects the real-time engine understands. Everything else is switched off.
Banned moves stay in each Pokemon's learnset in \`data/dex.js\`; the team builder just hides them.

- Moves any Pokemon in the roster can learn (all generations): **${total}**
- Allowed: **${total - banned.length}**
- Banned: **${banned.length}**

The rule: attacking moves are allowed unless they are one-hit KOs, bounce damage back, call other moves, or depend on
items, sleep, or the rest of the team. Status moves are allowed only when they raise or lower stats, heal, cause a status
condition or confusion, set weather or terrain, lay a supported hazard or screen, or are one of a short list of
hand-picked moves (Protect and friends, Haze, Defog, Leech Seed, Taunt, Roar, Belly Drum, Pain Split and so on).

"Learned by" counts how many of the ${Object.values(species).filter((x) => !x.isMega).length} species and forms in the roster can learn the move (megas not counted), so the top rows are the biggest losses.

| Move | Learned by | Why it is banned |
|---|---:|---|
${banned.map((b) => `| ${b.name} | ${b.n} | ${b.why} |`).join('\n')}
`);

console.log(JSON.stringify({
  species: Object.keys(species).length, moves: total, banned: banned.length,
  movesWithFx: Object.values(movesSorted).filter((m) => m.fx).length,
  particles: Object.keys(VFX.particles).length, beams: Object.keys(VFX.beams).length, sounds: Object.keys(VFX.sounds).length,
  assetMB: +(bytes / 1048576).toFixed(2), dexKB: Math.round(fs.statSync('data/dex.js').size / 1024), fxMisses: fxMisses.length, missing, ...report,
}, null, 1));
