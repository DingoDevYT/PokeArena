// Battle simulation: stats, damage, moves, status, field, abilities, items, CPU brain.
'use strict';

// Tuning knobs. Every number that decides game feel lives here.
const TUNE = {
  SPRITE_SCALE: 2,       // mons and their VFX are drawn this many times larger than the arena tiles
  HP_MULT: 7,            // displayed HP = real HP x this
  FIGHT_SCALE: 0.13,     // fraction of real damage dealt; even 1v1 KO lands around 45-60 s
  TILE: 24,
  RANGE_MULT: 2.2,       // PMDO ranges are in tiles for a grid game; stretch them for the arena
  STATUS_TURN: 10,       // seconds that stand in for one game "turn" for chip damage and healing
  LASER_TICK: 0.12, BEAM_CLASH_SPEED: 320,
  LASER: {
    FLOW_SPEED: 620,     // px/s the aim travels down a beam; slower = the far end lags further behind the aim
    LAG_STREAM: 0.45,    // flamethrower, water, ice...: fraction of the old lag (was 1.0, too hard to hit with)
    LAG_BEAM: 0.07,      // hyper / solar / electric / the rest: only a slight bend
    SHOOT: 1100 * 1.25,  // px/s a beam extends when fired (was 1100)
    WIDTH: 1.25,         // hitbox and drawn width multiplier (was 1)
  },
  FIELD_TIME: 30,        // weather / terrain / screens duration (5 turns)
  FIELD_TIME_EXT: 48,    // with Heat Rock, Light Clay, etc. (8 turns)
  SWAP_CD: 8, SWAP_IFRAMES: 0.7, ENTRY_IFRAMES: 1.0,
  DODGE_DIST: 135, DODGE_TIME: 0.33, DODGE_IFRAMES: 0.34,
  DODGE_SPEED_TIME: 0.35, // roll duration and i-frames scale by 1 + this * (speedFactor - 1): fast mons roll longer, slow ones shorter
  DODGE_CD_MULT: 0.7, CD_MULT: 0.85, // dodge cooldown and every move cooldown are scaled by these
  CHARGE_MAX: 1.2, CHARGE_DMG: 0.8, CHARGE_SIZE: 1.2, // hold-to-charge shots: time to full, extra damage and size at full
  STATUS_MOVE_MIN_CD: 7, FIELD_MOVE_MIN_CD: 14,
  HEAL_MULT: 0.5, RECOVER_MIN_CD: 12, // every heal (moves, items, drain, abilities) is scaled by this; recovery moves get a long cooldown
  SLEEP_TIME: [2.5, 4], FREEZE_TIME: 2.5, CONFUSE_TIME: 6, REST_SLEEP: 4,
  // Melee-style moves (melee / dash / lunge / leap, plus their charge-up versions). A swing is not one frame: it stays live for ACTIVE seconds,
  // steps toward the foe, and locks on if they are roughly in front. Dodging at the right moment still beats it; a dodge started too early or late does not.
  MELEE: {
    REACH: 26,          // px added to every swing's reach
    CONE: 1.35,         // half-angle (rad) a swing covers
    SNAP_CONE: 0.95,    // aim assist: a foe within this angle of the aim at swing time gets aimed at
    SNAP_RANGE: 1.7,    // ...and within this many reaches
    ACTIVE: 0.2, TICKS: 4, // seconds a swing keeps hitting, and how many times it re-tests in that time
    STEP: 230,          // px/s the user steps toward the foe while a swing is live
    DASH_REACH: 18, LUNGE_REACH: 40, // extra px on top of body contact for dash / lunge
    HOME: 3.2, HOME_CONE: 0.9, HOME_RANGE: 300, // dash / lunge steer toward a foe in front: rad/s, half-angle, max distance
    TAIL: 60,           // px a dash / lunge keeps going (at half speed) when it ends near a foe it has not hit
    ARMOR: 0.3,         // a wind-up survives hits below this fraction of max HP (normal wind-ups break at 0.12)
    CHARGE_SIZE: 1.3,   // charge-up moves (two-turn, Focus Punch) get this much more reach
    FAST_WIND: 0.7,     // wind-up multiplier for weak (BP 60 or less) non-charge melee
  },
};
const SS = TUNE.SPRITE_SCALE;
const toId = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const STAGE_MULT = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
const STAT_NAMES = { atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE', accuracy: 'ACC', evasion: 'EVA' };

// ---------- sprites ----------
function spriteOf(key) { return (window.SPRITES && SPRITES[key]) || null; }
function animOf(key, name, fallbacks = []) {
  const s = spriteOf(key); if (!s) return null;
  for (const n of [name, ...fallbacks, 'Attack', 'Idle', 'Walk']) if (n && s.anims[n]) return s.anims[n];
  return null;
}
const animLen = a => a ? a.durations.reduce((x, y) => x + y, 0) / 60 : 0.4;
function animTimeTo(a, frame) { if (!a || frame < 0) return -1; let t = 0; for (let i = 0; i < frame && i < a.durations.length; i++) t += a.durations[i]; return t / 60; }
function animFrame(a, t, loop) {
  if (!a) return 0;
  let tick = t * 60; const total = a.durations.reduce((x, y) => x + y, 0);
  if (loop) tick %= total; else if (tick >= total) return a.durations.length - 1;
  for (let i = 0; i < a.durations.length; i++) { tick -= a.durations[i]; if (tick < 0) return i; }
  return a.durations.length - 1;
}
function bodyRadius(key) { const w = animOf(key, 'Walk'); if (spriteOf(key)?.body) return spriteOf(key).body * SS; return (w ? clamp(w.fw * 0.3, 8, 22) : 12) * SS; }

// ---------- mons ----------
function natureMod(nat, stat) { const n = DEX.natures[nat]; if (!n) return 1; return n.plus === stat && n.minus !== stat ? 1.1 : n.minus === stat && n.plus !== stat ? 0.9 : 1; }
// Displayed HP = real HP x HP_MULT x a level curve: low levels get more (fights don't end in seconds), lv100 gets less (they don't drag on).
// lv5 x1.6, lv20 x1.55, lv50 x1.07, lv100 x0.82
const hpScale = L => TUNE.HP_MULT * clamp(Math.pow(60 / L, 0.4), 0.7, 1.6);
function calcStats(sp, L, nat) {
  const b = sp.baseStats, s = {};
  if (sp.fixedStats) { const v = sp.fixedStats; return { hp: v / hpScale(L), atk: v, def: v, spa: v, spd: v, spe: v }; } // joke species: every shown stat (and max HP) is exactly this
  s.hp = sp.id === 'shedinja' ? 1 : Math.floor((2 * b.hp + 31) * L / 100) + L + 10;
  for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) s[k] = Math.floor((Math.floor((2 * b[k] + 31) * L / 100) + 5) * natureMod(nat, k));
  return s;
}
const blankStages = () => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, accuracy: 0, evasion: 0, crit: 0 });
function legalMoves(sp) {
  const base = sp.isMega ? DEX.species[sp.baseSpecies] : sp;
  return (base.learnset || []).filter(id => DEX.moves[id] && !DEX.moves[id].banned);
}
function makeMon(set) {
  const sp = DEX.species[toId(set.species)];
  if (!sp) throw new Error('Unknown species ' + set.species);
  const nat = toId(set.nature) || 'hardy';
  const legal = new Set(legalMoves(sp));
  let moves = (set.moves || []).map(toId).filter(id => legal.has(id)).map(id => DEX.moves[id]).slice(0, 4);
  if (!moves.length) moves = legalMoves(sp).map(id => DEX.moves[id]).filter(m => m.category !== 'Status').sort((a, b) => b.basePower - a.basePower).slice(0, 4);
  if (!moves.length) moves = legalMoves(sp).map(id => DEX.moves[id]).slice(0, 4);
  const abil = toId(set.ability) || toId(sp.abilities[0]);
  const m = {
    set, sp, baseSp: sp, level: clamp(set.level | 0 || 50, 1, 100), nature: nat,
    ability: abil, baseAbility: abil, item: toId(set.item), moves, cds: [0, 0, 0, 0],
    status: '', statusT: 0, toxN: 0, tickT: 0, stages: blankStages(), vol: {}, fainted: false, megaed: false,
  };
  m.stats = calcStats(sp, m.level, nat);
  m.maxHp = Math.round(m.stats.hp * hpScale(m.level)); m.hp = m.maxHp;
  return m;
}
const typesOf = m => m.vol.types || m.sp.types;
const hasType = (m, t) => typesOf(m).includes(t);
const abil = (m, id) => m.ability === id && !m.vol.abilityGone;
const item = (m, id) => m.item === id;
function grounded(m) { return !(hasType(m, 'Flying') || abil(m, 'levitate') || (item(m, 'airballoon') && !m.vol.balloonPopped)); }
function spriteKey(m) { return m.vol.sprite || m.sp.sprite; }
function speedStat(m, side) {
  let s = m.stats.spe * STAGE_MULT(m.stages.spe);
  if (m.status === 'par') s *= 0.5;
  if (item(m, 'choicescarf')) s *= 1.5;
  const w = effWeather();
  if ((w === 'rain' && abil(m, 'swiftswim')) || (w === 'sun' && abil(m, 'chlorophyll')) || (w === 'sand' && abil(m, 'sandrush')) || (w === 'snow' && abil(m, 'slushrush'))) s *= 2;
  if (side && side.screens.tailwind > 0) s *= 2;
  if (m.vol.quickClaw > 0) s *= 1.3;
  return s;
}
// ~1.5x the old pace, and Speed matters much more: base 40 Spe walks ~120 px/s, base 190 ~260 px/s.
const moveSpeed = (m, side) => clamp(80 + speedStat(m, side) * 0.95, 90, 380);
const speedFactor = (m, side) => clamp(0.75 + speedStat(m, side) / 400, 0.8, 1.45);
const projSpeed = move => clamp((move.fx?.speed || 10) * 50, 400, 860);

// ---------- cooldowns ----------
function cooldownFor(move, m, foe) {
  if (behaviour(move).cdExact) return behaviour(move).cdExact; // custom moves (Flowery): owner-set seconds, skips the PP table and CD_MULT
  const pp = move.pp || 10;
  let cd = pp <= 5 ? 10 : pp <= 8 ? 8 : pp <= 10 ? 6.5 : pp <= 15 ? 5 : pp <= 20 ? 4 : pp <= 25 ? 3.5 : pp <= 30 ? 3 : 2.5;
  if (move.category === 'Status') cd = Math.max(cd, TUNE.STATUS_MOVE_MIN_CD);
  if (move.heal || ['synthesis', 'morningsun', 'moonlight', 'shoreup', 'rest'].includes(move.id)) cd = Math.max(cd, TUNE.RECOVER_MIN_CD);
  cd = Math.max(cd, behaviour(move).cd || 0); // arena sweeps etc. carry their own floor
  if (move.weather || move.terrain || move.sideCondition) cd = Math.max(cd, TUNE.FIELD_MOVE_MIN_CD);
  if (m.status === 'par') cd *= 1.25;
  if (foe && abil(foe, 'pressure')) cd *= 1.1;
  return cd * TUNE.CD_MULT;
}

// ---------- the battle ----------
let B = null;
function effWeather() {
  if (!B || !B.field.weather) return '';
  for (const s of B.sides) { const m = activeMon(s); if (m && !m.fainted && (abil(m, 'cloudnine') || abil(m, 'airlock'))) return ''; }
  return B.field.weather;
}
const activeMon = s => s.team[s.cur];
const meIdx = () => B.me ?? B.sides.findIndex(s => !s.cpu && !s.remote); // the side this screen plays
const foeOf = s => B.sides[1 - s.idx];

function newEnt(x, y, face) {
  return { x, y, vx: 0, vy: 0, kx: 0, ky: 0, face, aimX: face === 2 ? 1 : -1, aimY: 0, aimIdle: 9, anim: 'Idle', animT: 0, animOnce: false,
    act: null, lock: 0, stun: 0, iframes: 0, flash: 0, dodge: null, dash: null, hidden: 0, protect: 0, hurtT: 0, z: 0, enterT: 0 };
}
function makeSide(idx, cfg) {
  return {
    idx, name: cfg.name, cpu: !!cfg.cpu, remote: !!cfg.remote, tier: cfg.tier || 'normal', trainerSprite: cfg.sprite, music: cfg.music,
    team: cfg.team.map(makeMon), cur: 0, ent: null, swapCd: 0, dodgeCd: 0, megaUsed: false, choice: -1, koT: 0,
    screens: { reflect: 0, lightscreen: 0, auroraveil: 0, safeguard: 0, tailwind: 0, mist: 0 },
    wheel: null, ai: { thinkT: 0, moveSlot: -1, strafe: 1, strafeT: 0, lastSwap: 0, dodged: new Set(), wantDist: 80 },
    intent: { mx: 0, my: 0, use: -1, dodge: false, mega: false }, hits: 0, dealt: 0,
  };
}
function startBattle(cfg) {
  const ar = cfg.arena;
  B = {
    me: cfg.me, guest: !!cfg.guest, // online: me = this client's side index, guest = renders host snapshots instead of simulating
    arena: ar, time: 0, hitstop: 0, over: false, winner: -1, paused: false, endT: 0, choose: null,
    field: { weather: cfg.weather || '', weatherT: cfg.weather ? 1e9 : 0, terrain: '', terrainT: 0 },
    sides: [makeSide(0, cfg.player), makeSide(1, cfg.cpu)],
    proj: [], gusts: [], areas: [], beams: [], marks: [], hazards: [], traps: [], waves: [], sweeps: [], soakT: 0, timers: [], fx: [], decals: [], floats: [], callouts: [],
    rocks: ar.obstacles.filter(o => o.kind === 'rock').map(o => ({ ...o, hp: 3 })),
    puddles: ar.obstacles.filter(o => o.kind === 'puddle').map(o => ({ ...o })),
    grass: ar.obstacles.filter(o => o.kind === 'grass').map(o => ({ ...o })),
    cam: { x: ar.w / 2, y: ar.h / 2, z: 2, shake: 0, punch: 0 },
  };
  B.sides.forEach((s, i) => { const [x, y] = ar.spawns[i]; s.ent = newEnt(x, y, i ? 6 : 2); });
  B.sides.forEach(s => sendOut(s, 0, true));
  B.sides.forEach(s => { const m = activeMon(s); if (s.cpu && megaTarget(m)) after(1.2, () => tryMega(s)); });
  return B;
}
function after(t, fn) { B.timers.push({ t, fn }); }

// ---------- feedback ----------
// Damage numbers landing on the same spot in quick succession (laser ticks, multi-hits) add up into one growing number.
function floatText(x, y, s, color = '#fff', size = 14) {
  const num = /^\d+$/.test(s) ? +s : 0;
  if (num) {
    const f = B.floats.find(f => f.num && f.t < 0.4 && Math.hypot(f.x - x, f.y - y) < 40);
    if (f) { f.num += num; f.s = String(f.num); f.t = 0; f.size = Math.max(f.size, size); f.color = color === '#fff' ? f.color : color; return; }
  } else {
    // repeated labels ("Super effective!" every laser tick) refresh one label instead of stacking
    const f = B.floats.find(f => f.s === s && f.t < 0.6 && Math.hypot(f.x - x, f.y - y) < 40);
    if (f) { f.t = Math.min(f.t, 0.15); return; }
  }
  B.floats.push({ x, y, s, color, size, t: 0, num });
}
function callout(side, s) { B.callouts.push({ side: side.idx, s, t: 0 }); if (B.callouts.length > 4) B.callouts.shift(); }
function spawnFx(name, x, y, opts = {}) {
  const p = window.VFX && VFX.particles[name];
  if (!p) return false;
  B.fx.push({ p, name, x, y, t: 0, ft: opts.ft || 3, loops: opts.loops || 1, dir: opts.dir || 0, scale: opts.scale || SS, z: opts.z || 0, follow: opts.follow, alpha: opts.alpha || 1, flip: opts.flip });
  return true;
}
// Every effect is a PMDO pixel-art sheet; colours map to the sheet variants that exist.
const TYPE_FX = { Normal: 'White', Fire: 'Red', Water: 'Blue', Electric: 'Yellow', Grass: 'Green', Ice: 'Blue', Fighting: 'Red', Poison: 'Purple', Ground: 'Brown', Flying: 'White',
  Psychic: 'Pink', Bug: 'Green', Rock: 'Brown', Ghost: 'Purple', Dragon: 'Purple', Dark: 'Black', Steel: 'White', Fairy: 'Pink' };
function fxColor(c) {
  if (TYPE_FX[c]) return TYPE_FX[c];
  for (const t in TYPE_COLOR) if (TYPE_COLOR[t] === c) return TYPE_FX[t];
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c || '');
  if (!m) return 'White';
  const [r, g, bl] = m.slice(1).map(h => parseInt(h, 16) / 255), mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), l = (mx + mn) / 2;
  if (mx - mn < 0.15) return l > 0.4 ? 'White' : 'Black';
  const h = (mx === r ? (g - bl) / (mx - mn) : mx === g ? 2 + (bl - r) / (mx - mn) : 4 + (r - g) / (mx - mn)) * 60 % 360;
  return h < 0 || h >= 330 || h < 30 ? (l < 0.45 ? 'Brown' : 'Red') : h < 70 ? (l < 0.5 ? 'Brown' : 'Yellow') : h < 170 ? 'Green' : h < 255 ? 'Blue' : h < 290 ? 'Purple' : 'Pink';
}
const CIRCLE_OK = new Set(['White', 'Blue', 'Red', 'Green', 'Pink', 'Purple', 'Yellow']);
function burst(x, y, color, n = 10) { spawnFx('Puff_' + fxColor(color), x, y, { scale: n >= 25 ? SS * 1.5 : n >= 14 ? SS : 1 }); }
function ring(x, y, r, color = '#fff') { const c = fxColor(color); spawnFx('Circle_' + (CIRCLE_OK.has(c) ? c : 'White') + '_Out', x, y, { scale: Math.max(0.5, Math.round(r / 16) / 2) }); }
function decal(kind, x, y, r) { B.decals.push({ kind, x, y, r, t: 0, seed: Math.random() * 1e4 }); if (B.decals.length > 50) B.decals.shift(); }
function shake(a) { B.cam.shake = Math.max(B.cam.shake, a); }
function flash(t, col = '#fff') { if (t >= (B.flashT || 0)) { B.flashT = t; B.flashCol = col; } }
// Impact frames: the world freezes and strobes high-contrast black/white with speed lines bursting from the hit.
function impact(x, y, t = 0.12) {
  B.impact = { x, y, t, seed: Math.random() * 1e4 };
  B.hitstop = Math.max(B.hitstop, t + 0.05); shake(12); B.cam.punch = Math.max(B.cam.punch, 0.35);
}

// ---------- type maths ----------
function typeEff(atkType, m, move) {
  let e = 1;
  for (const t of typesOf(m)) {
    let x = (DEX.typeChart[atkType] || {})[t];
    if (x === undefined) x = 1;
    if (x === 0 && t === 'Ghost' && move && (atkType === 'Normal' || atkType === 'Fighting') && move._scrappy) x = 1;
    if (move && move.id === 'freezedry' && t === 'Water') x = 2;
    e *= x;
  }
  return e;
}
function moveType(move, m) {
  if (move.id === 'weatherball') return { sun: 'Fire', rain: 'Water', sand: 'Rock', snow: 'Ice' }[effWeather()] || 'Normal';
  if (move.id === 'terrainblast' && B.field.terrain && grounded(m)) return { electric: 'Electric', grassy: 'Grass', psychic: 'Psychic', misty: 'Fairy' }[B.field.terrain];
  if (move.type === 'Normal' && abil(m, 'aerilate')) return 'Flying';
  if (move.type === 'Normal' && abil(m, 'refrigerate')) return 'Ice';
  if (move.type === 'Normal' && abil(m, 'pixilate')) return 'Fairy';
  if (move.type === 'Normal' && abil(m, 'galvanize')) return 'Electric';
  return move.type;
}
// Returns null if the target absorbs/ignores the move outright, else a reason string for immunity text.
function immunity(att, def, move, type) {
  if (abil(att, 'moldbreaker')) return '';
  if (type === 'Ground' && move.category !== 'Status' && !grounded(def) && move.id !== 'thousandarrows') return abil(def, 'levitate') ? 'Levitate' : item(def, 'airballoon') ? 'Air Balloon' : '';
  const absorb = { waterabsorb: 'Water', voltabsorb: 'Electric', dryskin: 'Water', stormdrain: 'Water', lightningrod: 'Electric', flashfire: 'Fire', sapsipper: 'Grass', motordrive: 'Electric' };
  for (const a in absorb) if (abil(def, a) && type === absorb[a] && (move.category !== 'Status' || move.target !== 'self')) return a;
  if (move.flags && move.flags.powder && (hasType(def, 'Grass') || abil(def, 'overcoat'))) return 'powder';
  if (move.flags && move.flags.sound && abil(def, 'soundproof')) return 'soundproof';
  if (move.flags && move.flags.bullet && abil(def, 'bulletproof')) return 'bulletproof';
  return '';
}

// ---------- damage ----------
function basePowerOf(move, att, def) {
  const id = move.id; let bp = move.basePower || 0;
  const hpr = att.hp / att.maxHp;
  if (id === 'reversal' || id === 'flail') bp = hpr <= 0.0417 ? 200 : hpr <= 0.104 ? 150 : hpr <= 0.208 ? 100 : hpr <= 0.354 ? 80 : hpr <= 0.688 ? 40 : 20;
  else if (id === 'eruption' || id === 'waterspout') bp = Math.max(1, Math.floor(150 * hpr));
  else if (id === 'lowkick' || id === 'grassknot') { const w = def.sp.weightkg; bp = w >= 200 ? 120 : w >= 100 ? 100 : w >= 50 ? 80 : w >= 25 ? 60 : w >= 10 ? 40 : 20; }
  else if (id === 'heavyslam' || id === 'heatcrash') { const r = att.sp.weightkg / def.sp.weightkg; bp = r >= 5 ? 120 : r >= 4 ? 100 : r >= 3 ? 80 : r >= 2 ? 60 : 40; }
  else if (id === 'gyroball') bp = clamp(Math.floor(25 * speedStat(def) / Math.max(1, speedStat(att))) + 1, 1, 150);
  else if (id === 'electroball') { const r = speedStat(att) / Math.max(1, speedStat(def)); bp = r >= 4 ? 150 : r >= 3 ? 120 : r >= 2 ? 80 : r >= 1 ? 60 : 40; }
  else if (id === 'return' || id === 'frustration') bp = 102;
  else if (id === 'facade' && att.status) bp = 140;
  else if (id === 'hex' && def.status) bp = 130;
  else if (id === 'venoshock' && (def.status === 'psn' || def.status === 'tox')) bp = 130;
  else if (id === 'brine' && def.hp <= def.maxHp / 2) bp = 130;
  else if (id === 'acrobatics' && !att.item) bp = 110;
  else if (id === 'knockoff' && def.item && !DEX.items[def.item]?.megaStone) bp = 97;
  else if (id === 'storedpower' || id === 'powertrip') bp = 20 + 20 * Object.entries(att.stages).filter(([k, v]) => k !== 'crit' && v > 0).reduce((a, [, v]) => a + v, 0);
  else if (id === 'weatherball' && effWeather()) bp = 100;
  else if (id === 'solarbeam' || id === 'solarblade') { const w = effWeather(); if (w && w !== 'sun') bp /= 2; }
  else if (id === 'wakeupslap' && def.status === 'slp') bp = 140;
  else if (id === 'smellingsalts' && def.status === 'par') bp = 140;
  else if (id === 'present') bp = pick([40, 80, 120]);
  else if (id === 'magnitude') bp = pick([10, 30, 50, 70, 90, 110, 150]);
  if (!bp) bp = 60;
  return bp;
}
function calcDamage(att, def, move, opts = {}) {
  const type = moveType(move, att);
  let eff = typeEff(type, def, { ...move, _scrappy: abil(att, 'scrappy') });
  if (immunity(att, def, move, type)) eff = 0;
  if (eff === 0) return { dmg: 0, eff, crit: false, type };
  // fixed-damage moves
  if (move.damage === 'level' || move.id === 'seismictoss' || move.id === 'nightshade') return { dmg: Math.round(att.level * TUNE.HP_MULT * TUNE.FIGHT_SCALE * 1.4), eff: 1, crit: false, type };
  if (typeof move.damage === 'number') return { dmg: Math.round(move.damage * TUNE.HP_MULT * TUNE.FIGHT_SCALE * 1.4), eff: 1, crit: false, type };
  if (['superfang', 'naturesmadness', 'ruination'].includes(move.id)) return { dmg: Math.max(1, Math.round(def.hp * 0.5 * TUNE.FIGHT_SCALE * 1.6)), eff: 1, crit: false, type };
  if (move.id === 'endeavor') return { dmg: Math.max(0, Math.round((def.hp - att.hp) * 0.5)), eff: 1, crit: false, type };

  const phys = move.category === 'Physical';
  const offMon = move.overrideOffensivePokemon === 'target' ? def : att;
  const offStat = move.overrideOffensiveStat || (phys ? 'atk' : 'spa');
  const defStat = move.overrideDefensiveStat || (phys ? 'def' : 'spd');
  const critStage = (move.critRatio || 1) - 1 + att.stages.crit + (abil(att, 'superluck') ? 1 : 0) + (item(att, 'scopelens') || item(att, 'razorclaw') ? 1 : 0)
    + (item(att, 'leek') && ['farfetchd', 'sirfetchd'].includes(att.baseSp.id) ? 2 : 0) + (item(att, 'luckypunch') && att.baseSp.id === 'chansey' ? 2 : 0);
  let crit = !opts.noCrit && (move.willCrit || Math.random() < [1 / 24, 1 / 8, 1 / 2, 1, 1][clamp(critStage, 0, 4)]);
  if (abil(def, 'battlearmor') || abil(def, 'shellarmor')) crit = false;

  const ignoreStages = abil(def, 'unaware');
  let aSt = offMon.stats[offStat] * (ignoreStages ? 1 : STAGE_MULT(crit ? Math.max(0, offMon.stages[offStat]) : offMon.stages[offStat]));
  let dSt = def.stats[defStat] * (abil(att, 'unaware') ? 1 : STAGE_MULT(crit ? Math.min(0, def.stages[defStat]) : def.stages[defStat]));
  // attack-side stat modifiers
  if (phys && (abil(att, 'hugepower') || abil(att, 'purepower'))) aSt *= 2;
  if (phys && abil(att, 'hustle')) aSt *= 1.5;
  if (phys && abil(att, 'guts') && att.status) aSt *= 1.5;
  if (!phys && abil(att, 'solarpower') && effWeather() === 'sun') aSt *= 1.5;
  if (phys && item(att, 'choiceband')) aSt *= 1.5;
  if (!phys && item(att, 'choicespecs')) aSt *= 1.5;
  if (item(att, 'lightball') && att.baseSp.id === 'pikachu') aSt *= 2;
  if (phys && item(att, 'thickclub') && ['cubone', 'marowak'].includes(att.baseSp.id)) aSt *= 2;
  if (att.vol.flashFire && type === 'Fire') aSt *= 1.5;
  const pinch = att.hp <= att.maxHp / 3;
  if (pinch && ((abil(att, 'blaze') && type === 'Fire') || (abil(att, 'torrent') && type === 'Water') || (abil(att, 'overgrow') && type === 'Grass') || (abil(att, 'swarm') && type === 'Bug'))) aSt *= 1.5;
  // defence-side stat modifiers
  if (!phys && item(def, 'assaultvest')) dSt *= 1.5;
  if (item(def, 'eviolite') && def.baseSp.id !== def.sp.id === false && ['chansey', 'porygon', 'scyther', 'onix', 'magmar', 'electabuzz', 'rhydon', 'tangela', 'lickitung'].includes(def.sp.id)) dSt *= 1.5;
  if (item(def, 'metalpowder') && def.baseSp.id === 'ditto' && phys) dSt *= 2;
  if (phys && abil(def, 'marvelscale') && def.status) dSt *= 1.5;
  if (phys && abil(def, 'furcoat')) dSt *= 2;
  if (!phys && effWeather() === 'sand' && hasType(def, 'Rock')) dSt *= 1.5;
  if (phys && effWeather() === 'snow' && hasType(def, 'Ice')) dSt *= 1.5;

  let bp = basePowerOf(move, att, def);
  if (abil(att, 'technician') && bp <= 60) bp *= 1.5;
  if (move.flags?.punch && abil(att, 'ironfist')) bp *= 1.2;
  if (move.flags?.bite && abil(att, 'strongjaw')) bp *= 1.5;
  if (move.flags?.pulse && abil(att, 'megalauncher')) bp *= 1.5;
  if (move.flags?.sound && abil(att, 'punkrock')) bp *= 1.3;
  if (move.flags?.sound && abil(def, 'punkrock')) bp *= 0.5;
  if (move.flags?.contact && abil(att, 'toughclaws')) bp *= 1.3;
  if ((move.recoil || move.hasCrashDamage) && abil(att, 'reckless')) bp *= 1.2;
  if (abil(att, 'sheerforce') && (move.secondary || move.secondaries)) bp *= 1.3;
  if (abil(att, 'sandforce') && effWeather() === 'sand' && ['Rock', 'Ground', 'Steel'].includes(type)) bp *= 1.3;
  if (move.type === 'Normal' && type !== 'Normal') bp *= 1.2;
  if (abil(def, 'thickfat') && (type === 'Fire' || type === 'Ice')) bp *= 0.5;
  if (abil(def, 'heatproof') && type === 'Fire') bp *= 0.5;
  if (abil(def, 'dryskin') && type === 'Fire') bp *= 1.25;
  if (phys && item(att, 'muscleband')) bp *= 1.1;
  if (!phys && item(att, 'wiseglasses')) bp *= 1.1;
  const TYPE_ITEM = { charcoal: 'Fire', mysticwater: 'Water', miracleseed: 'Grass', magnet: 'Electric', nevermeltice: 'Ice', blackbelt: 'Fighting', poisonbarb: 'Poison', softsand: 'Ground', sharpbeak: 'Flying', twistedspoon: 'Psychic', silverpowder: 'Bug', hardstone: 'Rock', spelltag: 'Ghost', dragonfang: 'Dragon', blackglasses: 'Dark', metalcoat: 'Steel', silkscarf: 'Normal', fairyfeather: 'Fairy' };
  if (TYPE_ITEM[att.item] === type) bp *= 1.2;
  const t = B.field.terrain;
  if (t && grounded(att)) { if ((t === 'electric' && type === 'Electric') || (t === 'grassy' && type === 'Grass') || (t === 'psychic' && type === 'Psychic')) bp *= 1.3; }
  if (t === 'misty' && grounded(def) && type === 'Dragon') bp *= 0.5;
  if (t === 'grassy' && ['earthquake', 'bulldoze', 'magnitude'].includes(move.id) && grounded(def)) bp *= 0.5;
  if (att.vol.metronome) bp *= 1 + 0.2 * Math.min(5, att.vol.metronome);
  if (opts.puddleBoost) bp *= 1.25;

  let d = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * bp * aSt / Math.max(1, dSt)) / 50) + 2;
  const w = effWeather();
  if (w === 'rain') d *= type === 'Water' ? 1.5 : type === 'Fire' ? 0.5 : 1;
  if (w === 'sun') d *= type === 'Fire' ? 1.5 : type === 'Water' ? 0.5 : 1;
  if (crit) d *= abil(att, 'sniper') ? 2.25 : 1.5;
  d *= opts.avg ? 0.925 : rand(0.85, 1);
  if (typesOf(att).includes(type)) d *= abil(att, 'adaptability') ? 2 : 1.5;
  d *= eff;
  if (phys && att.status === 'brn' && !abil(att, 'guts')) d *= 0.5;
  const sideD = B.sides.find(s => activeMon(s) === def);
  if (sideD && !crit && (sideD.screens.auroraveil > 0 || (phys ? sideD.screens.reflect : sideD.screens.lightscreen) > 0)) d *= 0.5;
  if (eff > 1 && (abil(def, 'filter') || abil(def, 'solidrock'))) d *= 0.75;
  if (eff < 1 && abil(att, 'tintedlens')) d *= 2;
  if (abil(def, 'multiscale') && def.hp >= def.maxHp) d *= 0.5;
  if (item(att, 'lifeorb')) d *= 1.3;
  if (item(att, 'expertbelt') && eff > 1) d *= 1.2;
  if (opts.parental) d *= 0.25;
  return { dmg: Math.max(1, Math.round(d * TUNE.HP_MULT * TUNE.FIGHT_SCALE)), eff, crit, type };
}

// ---------- HP changes ----------
function heal(m, amt, x, y) {
  if (m.fainted || amt <= 0) return 0;
  const before = m.hp; m.hp = Math.min(m.maxHp, m.hp + Math.round(amt * TUNE.HEAL_MULT));
  const g = m.hp - before;
  if (g > 0 && x !== undefined) floatText(x, y - 30, '+' + g, '#7dff8a', 13);
  return g;
}
// Indirect damage (status, weather, recoil, hazards). Magic Guard blocks all of it.
function chip(side, m, amt, why) {
  if (m.fainted || amt <= 0) return;
  if (abil(m, 'magicguard') && why !== 'self') return;
  m.hp = Math.max(0, m.hp - Math.round(amt));
  const e = side.ent; if (activeMon(side) === m) floatText(e.x + rand(-6, 6), e.y - 34 * SS, '-' + Math.round(amt), why === 'psn' ? '#d38cff' : why === 'brn' ? '#ffa860' : '#ddd', 11);
  if (m.hp <= 0) faint(side, m);
}

// ---------- status ----------
function statusImmune(m, st, side) {
  if (m.status || m.fainted) return true;
  if (side && side.screens.safeguard > 0) return true;
  const t = B.field.terrain;
  if (grounded(m) && (t === 'misty' || (t === 'electric' && st === 'slp'))) return true;
  if (abil(m, 'comatose') || (abil(m, 'leafguard') && effWeather() === 'sun')) return true;
  switch (st) {
    case 'brn': return hasType(m, 'Fire') || abil(m, 'waterveil') || abil(m, 'waterbubble');
    case 'par': return hasType(m, 'Electric') || abil(m, 'limber');
    case 'psn': case 'tox': return hasType(m, 'Poison') || hasType(m, 'Steel') || abil(m, 'immunity');
    case 'slp': return abil(m, 'insomnia') || abil(m, 'vitalspirit') || abil(m, 'sweetveil');
    case 'frz': return hasType(m, 'Ice') || abil(m, 'magmaarmor') || effWeather() === 'sun';
  }
  return false;
}
const STATUS_LABEL = { brn: 'BRN', par: 'PAR', psn: 'PSN', tox: 'TOX', slp: 'SLP', frz: 'FRZ' };
function inflict(side, m, st, src) {
  if (statusImmune(m, st, side)) return false;
  m.status = st; m.toxN = 0;
  if (st === 'slp') m.statusT = rand(...TUNE.SLEEP_TIME) * (abil(m, 'earlybird') ? 0.5 : 1);
  if (st === 'frz') m.statusT = TUNE.FREEZE_TIME;
  if (st === 'slp' || st === 'frz') { const e = side.ent; e.act = null; e.dash = null; }
  const e = side.ent; floatText(e.x, e.y - 44 * SS, STATUS_LABEL[st], '#ffe66b', 13); AUDIO.gen(st === 'tox' ? 'psn' : st, 0.6, e.x);
  if (abil(m, 'synchronize') && src && ['brn', 'par', 'psn', 'tox'].includes(st)) inflict(foeOf(side), activeMon(foeOf(side)), st === 'tox' ? 'psn' : st);
  if (item(m, 'lumberry')) after(0.4, () => { if (m.status) { m.status = ''; m.item = ''; floatText(side.ent.x, side.ent.y - 44 * SS, 'Lum Berry!', '#9f9', 12); } });
  return true;
}
function confuse(side, m) {
  if (m.vol.confused > 0 || abil(m, 'owntempo') || abil(m, 'oblivious') || (B.field.terrain === 'misty' && grounded(m))) return;
  m.vol.confused = TUNE.CONFUSE_TIME; floatText(side.ent.x, side.ent.y - 44 * SS, 'Confused', '#ffe66b', 12);
}
function boost(side, m, boosts, fromFoe) {
  let any = false;
  for (const k in boosts) {
    let n = boosts[k];
    if (fromFoe && n < 0) {
      if (abil(m, 'clearbody') || abil(m, 'whitesmoke') || abil(m, 'fullmetalbody') || side.screens.mist > 0) continue;
      if ((k === 'def' && abil(m, 'bigpecks')) || (k === 'atk' && abil(m, 'hypercutter')) || (k === 'accuracy' && abil(m, 'keeneye'))) continue;
    }
    if (abil(m, 'simple')) n *= 2;
    if (abil(m, 'contrary')) n = -n;
    const before = m.stages[k]; m.stages[k] = clamp(before + n, -6, 6);
    const d = m.stages[k] - before; if (!d) continue;
    any = true;
    spawnFx(d > 0 ? 'Stat_Blue_Ring' : 'Stat_Red_Ring', side.ent.x, side.ent.y - 4 * SS, { ft: 2 }); AUDIO.gen(d > 0 ? 'statUp' : 'statDown', 0.5, side.ent.x);
    floatText(side.ent.x + rand(-10, 10), side.ent.y - 50 * SS, `${STAT_NAMES[k] || k}${d > 0 ? '+' : ''}${d}`, d > 0 ? '#8fd3ff' : '#ff9a9a', 12);
    if (fromFoe && d < 0) {
      if (abil(m, 'defiant')) boost(side, m, { atk: 2 });
      if (abil(m, 'competitive')) boost(side, m, { spa: 2 });
    }
    if (fromFoe && d < 0 && item(m, 'whiteherb')) { for (const s in m.stages) if (m.stages[s] < 0) m.stages[s] = 0; m.item = ''; }
  }
  return any;
}

// ---------- field ----------
function setWeather(w, m) {
  if (B.field.weather === w) return;
  const ext = { sun: 'heatrock', rain: 'damprock', sand: 'smoothrock', snow: 'icyrock' }[w];
  B.field.weather = w; B.field.weatherT = m && item(m, ext) ? TUNE.FIELD_TIME_EXT : TUNE.FIELD_TIME;
  B.field.hail = w === 'snow' && !!m && m.vol.lastMove === 'hail';
  callout({ idx: -1 }, { sun: 'The sunlight turned harsh!', rain: 'It started to rain!', sand: 'A sandstorm kicked up!', snow: 'It started to snow!' }[w]);
}
function setTerrain(t, m) {
  B.field.terrain = t; B.field.terrainT = m && item(m, 'terrainextender') ? TUNE.FIELD_TIME_EXT : TUNE.FIELD_TIME;
  callout({ idx: -1 }, t[0].toUpperCase() + t.slice(1) + ' Terrain!');
}

// ---------- entry / exit ----------
function sendOut(side, idx, first) {
  side.cur = idx;
  const m = activeMon(side), e = side.ent, foe = foeOf(side);
  Object.assign(e, { act: null, dash: null, dodge: null, lock: 0.35, stun: 0, hidden: 0, protect: 0, hurtT: 0, iframes: first ? TUNE.ENTRY_IFRAMES : TUNE.SWAP_IFRAMES, enterT: 0.35, anim: 'Idle', animT: 0, kx: 0, ky: 0 });
  side.choice = -1; m.tickT = 0;
  AUDIO.cry(m.sp.isMega ? m.sp.baseSpecies : m.sp.id, 0.55, e.x);
  ring(e.x, e.y, 26, '#fff', 0.4, 2); burst(e.x, e.y - 10 * SS, '#fff', 14, 140, 0.35, 2);
  if (!first) callout(side, `Go! ${m.sp.name}!`);
  entryAbility(side, m);
}
function transformInto(side, m, fm) {
  const mv = fm.moves.filter(x => x.id !== 'transform'); if (!mv.length) return false;
  m.vol.transformed = true; m.vol.sprite = spriteKey(fm); m.vol.types = [...typesOf(fm)]; m.vol.as = fm.sp.name;
  const hp = m.stats.hp; m.stats = { ...calcStats(fm.sp, m.level, m.nature), hp }; m.ability = fm.ability;
  m.origMoves = m.origMoves || m.moves; m.moves = mv; m.cds = [0, 0, 0, 0];
  m.stages = { ...fm.stages }; callout(side, `${m.sp.name} transformed into ${fm.sp.name}!`);
  const e = side.ent; flash(0.25); ring(e.x, e.y - 10 * SS, 30, '#fff'); burst(e.x, e.y - 10 * SS, '#fff', 14);
  return true;
}
function entryAbility(side, m) {
  const foe = foeOf(side), fm = foe && activeMon(foe);
  if (!fm) return;
  if (abil(m, 'imposter') && !fm.fainted && !fm.vol.transformed) transformInto(side, m, fm);
  if (abil(m, 'intimidate') && !fm.fainted) {
    if (abil(fm, 'innerfocus') || abil(fm, 'oblivious') || abil(fm, 'owntempo') || abil(fm, 'scrappy')) floatText(foe.ent.x, foe.ent.y - 50, 'Unaffected', '#ccc', 11);
    else boost(foe, fm, { atk: -1 }, true);
  }
  if (abil(m, 'drought')) setWeather('sun', m);
  if (abil(m, 'drizzle')) setWeather('rain', m);
  if (abil(m, 'sandstream')) setWeather('sand', m);
  if (abil(m, 'snowwarning')) setWeather('snow', m);
  if (abil(m, 'electricsurge')) setTerrain('electric', m);
  if (abil(m, 'grassysurge')) setTerrain('grassy', m);
  if (abil(m, 'psychicsurge')) setTerrain('psychic', m);
  if (abil(m, 'mistysurge')) setTerrain('misty', m);
  if (abil(m, 'download') && !fm.fainted) boost(side, m, fm.stats.def < fm.stats.spd ? { atk: 1 } : { spa: 1 });
  if (abil(m, 'trace') && !fm.fainted && !['trace', 'imposter', 'multitype'].includes(fm.ability)) { m.ability = fm.ability; floatText(side.ent.x, side.ent.y - 50 * SS, 'Traced ' + (DEX.abilities[fm.ability]?.name || fm.ability), '#fff', 11); entryAbility(side, m); }
}
function swapOut(side) {
  const m = activeMon(side);
  if (abil(m, 'naturalcure')) m.status = '';
  if (abil(m, 'regenerator') && !m.fainted) heal(m, m.maxHp * 0.2);
  m.stages = blankStages(); m.toxN = 0;
  const keep = { transformed: undefined };
  if (m.vol.transformed) { m.stats = calcStats(m.sp, m.level, m.nature); m.moves = m.origMoves; m.cds = [0, 0, 0, 0]; }
  m.vol = {}; Object.assign(m.vol, keep);
  m.ability = m.megaed ? toId(m.sp.abilities[0]) : m.baseAbility;
}
function trapped(side) {
  const m = activeMon(side), fm = activeMon(foeOf(side));
  if (fm.fainted || hasType(m, 'Ghost')) return false;
  return abil(fm, 'shadowtag') || (abil(fm, 'arenatrap') && grounded(m)) || (abil(fm, 'magnetpull') && hasType(m, 'Steel'));
}
function doSwap(side, idx, free) {
  const t = side.team[idx];
  if (!t || t.fainted || idx === side.cur) return false;
  if (!free && (side.swapCd > 0 || trapped(side))) { if (!side.cpu && !side.remote) uiBlip(160); return false; }
  const e = side.ent;
  burst(e.x, e.y - 10 * SS, '#ff6060', 10, 100, 0.3, 2); AUDIO.gen('recall', 0.6, e.x);
  swapOut(side);
  side.swapCd = TUNE.SWAP_CD;
  sendOut(side, idx);
  return true;
}
function megaTarget(m) {
  if (m.megaed) return null;
  // Rayquaza-style megas need a move (Dragon Ascent) instead of a stone
  const byMove = (m.sp.megas || []).map(id => DEX.species[id]).find(ms => ms && ms.requiredMove && m.moves.some(mv => mv.id === toId(ms.requiredMove)));
  if (byMove) return byMove;
  const it = DEX.items[m.item];
  if (!it || !it.megaStone) return null;
  const ms = DEX.species[it.megaStone];
  return ms && ms.baseSpecies === m.sp.id ? ms : null;
}
// Mega Evolution is a short cinematic: time freezes, the arena darkens, rainbow motes pull into the mon under a
// light pillar, then a white flash reveals the mega form with a starburst and shockwaves.
const MEGA_CHARGE = 1.1, RAINBOW = ['#ff5a5a', '#ffb347', '#ffe36b', '#6bff8a', '#6bd8ff', '#b98bff', '#ff6bd6'];
function tryMega(side) {
  const m = activeMon(side), ms = megaTarget(m), e = side.ent;
  if (side.megaUsed || !ms || m.fainted || B.mega) return false;
  side.megaUsed = true;
  e.act = null; e.dash = null; e.iframes = Math.max(e.iframes, MEGA_CHARGE + 0.6);
  B.mega = { side, m, ms, t: 0 };
  B.hitstop = Math.max(B.hitstop, MEGA_CHARGE);
  spawnFx('Charge_Up', e.x, e.y - 12 * SS, { scale: SS, loops: 2 });
  uiBlip(330, 0.35);
  return true;
}
function megaTick(dt) {
  const g = B.mega, e = g.side.ent, cy = e.y - 14 * SS - e.z;
  g.t += dt;
  if (!g.done) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2, R = rand(60, 110), L = 0.3;
      B.fx.push({ spark: true, home: true, x: e.x + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.7, vx: -Math.cos(a) * R / L, vy: -Math.sin(a) * R * 0.7 / L, t: 0, life: L, col: RAINBOW[Math.random() * 7 | 0] });
    }
    if (g.t >= 0.4 && !g.col) { g.col = true; B.fx.push({ column: 'Column_Pink', x: e.x, y: e.y, t: 0, life: MEGA_CHARGE - 0.3 }); }
    if (g.t >= MEGA_CHARGE) megaFlash(g);
  }
  if (g.t > MEGA_CHARGE + 1.2) B.mega = null;
}
function megaFlash(g) {
  g.done = true;
  const { side, m, ms } = g, e = side.ent, cy = e.y - 14 * SS - e.z;
  if (activeMon(side) !== m || m.fainted) { side.megaUsed = false; B.mega = null; return; }
  m.megaed = true; m.sp = ms;
  const hp = m.maxHp; m.stats = calcStats(ms, m.level, m.nature); m.maxHp = hp;
  m.ability = toId(ms.abilities[0]);
  e.lock = 0.6; e.anim = 'Pose'; e.animT = 0; e.animOnce = true;
  impact(e.x, cy, 0.16); flash(0.15);
  spawnFx('Mega_Background_Yellow', e.x, cy, { ft: 3, scale: SS * 0.75 });
  spawnFx('Mega_Background_Red', e.x, cy, { ft: 4, scale: SS * 1.25 });
  for (let i = 0; i < 4; i++) after(i * 0.08, () => ring(e.x, e.y - 12 * SS, 24 + i * 18, ['#ff6bd6', '#6bd8ff', '#ffe36b', '#fff'][i]));
  for (const c of RAINBOW) sparks(e.x, cy, 0, Math.PI, 5, c, 340, 0.6);
  AUDIO.cry(m.sp.baseSpecies, 0.9, e.x); uiBlip(880, 0.25);
  callout(side, `${m.sp.name.replace('-Mega', ' Mega')} Evolved!`);
  entryAbility(side, m);
}
// Pixel shards flung from a point, fanned around an angle (white mixed in so they read on any type colour).
function sparks(x, y, ang, spread, n, col, spd = 200, life = 0.35) {
  for (let i = 0; i < n; i++) {
    const a = ang + rand(-spread, spread), v = spd * rand(0.5, 1.2);
    B.fx.push({ spark: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * rand(0.6, 1.2), col: Math.random() < 0.4 ? '#fff' : col });
  }
}

// ---------- faint / end ----------
function faint(side, m) {
  if (m.fainted) return;
  m.fainted = true; m.hp = 0; m.status = '';
  const e = side.ent;
  if (activeMon(side) === m) {
    e.act = null; e.dash = null; e.anim = 'Faint'; e.animT = 0; e.animOnce = true;
    AUDIO.cry(m.sp.isMega ? m.sp.baseSpecies : m.sp.id, 0.7, e.x); after(0.5, () => AUDIO.gen('faint', 0.7, e.x));
    B.hitstop = 0.18; B.cam.punch = 0.3; shake(6);
    callout(side, `${m.sp.name} fainted!`);
    side.koT = 1.6;
  }
}
function remaining(side) { return side.team.filter(m => !m.fainted).length; }
function afterKO(side) {
  if (!remaining(side)) { B.over = true; B.winner = 1 - side.idx; B.endT = 0; return; }
  if (side.cpu) sendOut(side, cpuPickSwap(side, true));
  else B.choose = { side: side.idx, sel: side.team.findIndex(m => !m.fainted), t: 8 };
}

// ---------- move archetypes ----------
// Per-move real-time behaviour lives in data/move-behaviour.js (decided from what each move IS); PMDO hitboxes are only the fallback.
const behaviour = move => (window.MOVE_BEHAVIOUR && MOVE_BEHAVIOUR[move.id]) || {};
const SELF_TARGETS = new Set(['self', 'allySide', 'all', 'adjacentAllyOrSelf', 'allies', 'adjacentAlly']);
const PROTECTS = new Set(['protect', 'detect', 'kingsshield', 'spikyshield', 'banefulbunker', 'endure', 'obstruct', 'silktrap', 'burningbulwark']);
// Channelled lasers: dur s, turn rad/s (stiff = low), w px, len px, mv = move speed while firing, total = damage x if every tick lands.
const LASERS = {
  solarbeam: { dur: 1.7, turn: 0.8, w: 48, len: 430, mv: 0, total: 1.8 },
  hyperbeam: { dur: 1.5, turn: 1.0, w: 42, len: 430, mv: 0, total: 1.7 },
  blastburn: { dur: 1.4, turn: 1.1, w: 40, len: 360, mv: 0, total: 1.7 },
  frenzyplant: { dur: 1.4, turn: 1.1, w: 40, len: 360, mv: 0, total: 1.7 },
  hydrocannon: { dur: 1.4, turn: 1.1, w: 44, len: 360, mv: 0, total: 1.7 },
  zapcannon: { dur: 1.2, turn: 1.2, w: 34, len: 360, mv: 0, total: 1.6 },
  hydropump: { dur: 0.9, turn: 6, w: 36, len: 260, mv: 0, total: 1.2 },
  flamethrower: { dur: 1.0, turn: 3.2, w: 24, len: 240, mv: 0.3, total: 1.25 },
  icebeam: { dur: 1.0, turn: 3.2, w: 24, len: 280, mv: 0.3, total: 1.25 },
  thunderbolt: { dur: 1.0, turn: 3.2, w: 24, len: 280, mv: 0.3, total: 1.25 },
  flashcannon: { dur: 1.0, turn: 2.5, w: 26, len: 280, mv: 0.2, total: 1.25 },
  meteorbeam: { dur: 1.3, turn: 1.2, w: 36, len: 380, mv: 0, total: 1.6 },
  steelbeam: { dur: 1.2, turn: 1.4, w: 32, len: 340, mv: 0, total: 1.6 },
  aurorabeam: { dur: 0.8, turn: 3.6, w: 20, len: 260, mv: 0.35, total: 1.2 },
  psybeam: { dur: 0.8, turn: 3.6, w: 20, len: 260, mv: 0.35, total: 1.2 },
  bubblebeam: { dur: 0.8, turn: 3.6, w: 20, len: 240, mv: 0.35, total: 1.2 },
  signalbeam: { dur: 0.8, turn: 3.6, w: 20, len: 260, mv: 0.35, total: 1.2 },
  chargebeam: { dur: 0.8, turn: 3.6, w: 20, len: 260, mv: 0.35, total: 1.2 },
  dragonbreath: { dur: 0.8, turn: 3.6, w: 20, len: 220, mv: 0.35, total: 1.2 },
  watergun: { dur: 0.6, turn: 5, w: 16, len: 190, mv: 0.5, total: 1.2 },
};
// Round 5 balance: lasers hit far harder (total = damage if every tick lands, as a multiple of one normal hit) and the slow ones
// track much faster. Solar Beam's drawback is its forced charge-up, not a beam that can't turn onto anyone.
for (const L of Object.values(LASERS)) { L.total = +(L.total * 1.7 * 2.2).toFixed(2); if (L.turn < 2) L.turn = +(L.turn * 2.5).toFixed(1); }
// Every laser bends: the far end shows where the user was aiming a moment ago (see flowPts). Streams lag a lot (LAG_STREAM), rigid beams only a touch (LAG_BEAM).
// Lag is a multiplier on the travel time along the beam: 1 = the old stream lag, 0.45 = under half as far behind the aim at the same sweep speed.
const LASER_STREAMS = ['flamethrower', 'hydropump', 'watergun', 'bubblebeam', 'dragonbreath', 'blastburn', 'icebeam'];
for (const [k, L] of Object.entries(LASERS)) {
  L.flow = true; L.lag = LASER_STREAMS.includes(k) ? TUNE.LASER.LAG_STREAM : TUNE.LASER.LAG_BEAM;
  L.w *= TUNE.LASER.WIDTH; // hitbox; the drawn beam is b.w * BFX_VIS, so art and hitbox stay in step
  L.len *= 2; // reach: walls, rocks and dodging are the limits, not range
  L.histT = L.len / TUNE.LASER.FLOW_SPEED * L.lag + 0.1; // seconds of aim history worth keeping
}
LASERS.solarbeam.turn = 3.4; LASERS.solarbeam.total = 10;
function archetype(move) {
  if (move._arch) return move._arch;
  const hb = move.fx && move.fx.hitbox;
  let a = behaviour(move).arch;
  if (a) { if (a === 'laser' && !LASERS[move.id]) a = 'beam'; }
  else if (LASERS[move.id]) a = 'laser';
  // Psychic-style throws become tracking reticles instead of blind lobs
  else if (hb === 'Throw' && (move.type === 'Psychic' || move.type === 'Ghost') && move.category !== 'Status') a = 'strike';
  else if (move.category === 'Status') {
    if (move.target === 'foeSide') a = 'hazard';
    else if (SELF_TARGETS.has(move.target) || PROTECTS.has(move.id)) a = 'self';
    else a = hb === 'Area' || hb === 'Self' ? 'area' : hb === 'Attack' ? 'melee' : hb === 'Wave' ? 'beam' : 'projectile';
  } else a =({ Projectile: 'projectile', Throw: 'lob', Wave: 'beam', Area: 'area', Self: 'area', Attack: 'melee', Dash: 'dash', Offset: 'strike' })[hb]
    || (move.target === 'allAdjacent' || move.target === 'allAdjacentFoes' ? 'area' : move.flags?.contact ? 'melee' : 'projectile');
  return (move._arch = a);
}
const isChargeMove = move => !!(move.flags?.charge || move.id === 'focuspunch');
const isMeleeStyle = move => { const a = archetype(move); return a === 'melee' || a === 'dash' || a === 'lunge' || a === 'leap'; };
function rangePx(move, min = 60) {
  const r = move.fx ? Math.max(move.fx.range || 0, 1) : 4;
  return Math.max(min, r * TUNE.TILE * TUNE.RANGE_MULT);
}
const areaRadius = move => behaviour(move).r || clamp(Math.max(move.fx?.explosionRange || 0, move.fx?.range || 1) * TUNE.TILE * 1.5, 40, 150);
// Accuracy becomes hitbox size instead of a dice roll.
function hitScale(move, m) {
  const acc = move.accuracy === true || !move.accuracy ? 100 : move.accuracy;
  let s = 0.45 + 0.55 * acc / 100;
  s *= clamp(1 + 0.15 * m.stages.accuracy, 0.4, 1.9);
  if (abil(m, 'compoundeyes')) s *= 1.3;
  if (abil(m, 'noguard')) s *= 1.5;
  if (abil(m, 'hustle') && move.category === 'Physical') s *= 0.85;
  if (effWeather() === 'rain' && ['thunder', 'hurricane'].includes(move.id)) s *= 1.4;
  if (effWeather() === 'snow' && move.id === 'blizzard') s *= 1.4;
  return s;
}
function hurtRadius(side) { const m = activeMon(side); let r = bodyRadius(spriteKey(m)); r *= clamp(1 - 0.1 * m.stages.evasion, 0.5, 1.5); if (abil(activeMon(foeOf(side)), 'noguard')) r *= 1.3; return r; }
function windupFor(move, m, key) {
  const a = animOf(key, move.fx?.charAnim, move.fx?.charAnimFallbacks || []);
  let w = a ? (a.hit >= 0 ? animTimeTo(a, a.hit) : animLen(a) * 0.5) : 0.25;
  w = clamp(w, 0.1, 0.55);
  const arch = archetype(move);
  if (arch === 'dash' || arch === 'lunge') w = Math.min(w, 0.12);
  if (arch === 'melee' && !isChargeMove(move) && move.basePower <= 60) w = Math.max(0.1, w * TUNE.MELEE.FAST_WIND);
  if (move.priority > 0) w *= 0.45; if (move.priority < 0) w *= 1.5;
  if (move.flags?.charge && arch !== 'leap' && !((move.id === 'solarbeam' || move.id === 'solarblade') && effWeather() === 'sun')) w += item(m, 'powerherb') ? 0 : 1.1;
  if (move.id === 'focuspunch') w += 1.1;
  return w;
}
function canUse(side, slot) {
  const m = activeMon(side), e = side.ent, move = m.moves[slot];
  if (!move || m.fainted || m.cds[slot] > 0 || e.act || e.lock > 0 || e.stun > 0 || e.dodge || e.dash || e.hidden > 0) return false;
  if (m.status === 'slp' || m.status === 'frz') return false;
  if (side.choice >= 0 && side.choice !== slot) return false;
  if (move.category === 'Status' && (m.vol.taunt > 0 || item(m, 'assaultvest'))) return false;
  if (m.vol.recharge > 0) return false;
  return true;
}
function useMove(side, slot) {
  if (!canUse(side, slot)) return false;
  const m = activeMon(side), e = side.ent, move = m.moves[slot], foe = foeOf(side);
  m.cds[slot] = cooldownFor(move, m, activeMon(foe));
  if (item(m, 'choiceband') || item(m, 'choicespecs') || item(m, 'choicescarf')) side.choice = slot;
  m.vol.metronome = m.vol.lastMove === move.id ? (m.vol.metronome || 0) + 1 : 0; if (!item(m, 'metronome')) m.vol.metronome = 0;
  m.vol.lastMove = move.id; e.tickDmg = 0;
  const key = spriteKey(m);
  const a = animOf(key, move.fx?.charAnim, move.fx?.charAnimFallbacks || []);
  const wind = windupFor(move, m, key);
  e.act = { move, slot, t: 0, wind, recover: clamp(animLen(a) - wind, 0.08, 0.35), fired: false, animName: a ? Object.keys(spriteOf(key).anims).find(k => spriteOf(key).anims[k] === a) : 'Attack', charging: wind > 0.7 };
  // single damaging shots can be held to charge: a tap fires almost at once, holding grows damage and size
  const bh = behaviour(move);
  // tracking strikes charge too: longer hold = bigger reticle that chases faster (no orb at the mouth)
  const ar = archetype(move);
  if ((ar === 'projectile' && !(bh.n > 1) && !move.multihit || ar === 'strike') && move.category !== 'Status' && !e.act.charging) { e.act.canCharge = true; e.act.noOrb = ar === 'strike'; e.act.wind = Math.min(e.act.wind, 0.12); }
  e.anim = e.act.charging ? 'Charge' : e.act.animName; e.animT = 0; e.animOnce = true;
  callout(side, move.name + '!');
  if (e.act.charging) { burst(e.x, e.y - 12 * SS, TYPE_COLOR[move.type], 8, 50, 0.6, 2); }
  return true;
}
function aimOf(side) { const e = side.ent; return { x: e.aimX, y: e.aimY }; }
function fireMove(side) {
  const e = side.ent, act = e.act, move = act.move, m = activeMon(side), foe = foeOf(side);
  act.fired = true;
  if (act.charging) { e.anim = act.animName; e.animT = 0; }
  const fx = move.fx || {};
  if (!AUDIO.move(move.id, 0.8, e.x)) { if (fx.sound) AUDIO.sfx(fx.sound, 0.8, e.x); else uiBlip(300 + Math.random() * 100, 0.06, 'square'); }
  const arch = archetype(move);
  if (behaviour(move).voice) { const v = behaviour(move).voice; AUDIO.play(Array.isArray(v) ? pick(v) : v, 0.9, 1, e.x); }
  // attacks shout: most damaging moves play the cry, pitched and sped by how the move is used (quick physical = short and high, beams and waves = long and low)
  if (move.category !== 'Status' && B.time - (side.cryT ?? -9) > 1.4 && Math.random() < 0.7) {
    side.cryT = B.time;
    const rate = { melee: 1.3, dash: 1.35, lunge: 1.4, leap: 1.2, projectile: 1.05, strike: 0.95, laser: 0.8, beam: 0.85, wave: 0.8, sweep: 0.75, area: 0.8 }[arch] ?? 1;
    AUDIO.cry(m.sp.isMega ? m.sp.baseSpecies : m.sp.id, 0.5, e.x, rate * (move.category === 'Special' ? 0.95 : 1.05));
  }
  const ax = e.aimX, ay = e.aimY, ang = Math.atan2(ay, ax);
  e.face = dirFromVec(ax, ay);
  if (move.self && move.self.boosts && move.category === 'Status') boost(side, m, move.self.boosts);
  const hits = move.multihit ? (Array.isArray(move.multihit) ? (abil(m, 'skilllink') ? move.multihit[1] : pick([2, 2, 3, 3, 4, 5].filter(n => n >= move.multihit[0] && n <= move.multihit[1]))) : move.multihit) : 1;
  const parental = abil(m, 'parentalbond') && move.category !== 'Status' && hits === 1;
  const bh = behaviour(move);
  // status moves are easier to land: bigger hitboxes all round
  const sc = hitScale(move, m) * (move.category === 'Status' ? 1.4 : 1), pow = act.pow || 0;
  // big moves announce themselves: type-colour screen flash, shake, camera punch
  if (move.basePower >= 100 || pow >= 1) { flash(0.12, TYPE_COLOR[move.type]); shake(6); B.cam.punch = Math.max(B.cam.punch, 0.15); }
  switch (arch) {
    case 'self': selfEffect(side, move); break;
    case 'projectile': {
      // each hit is a volley of bh.n shots fanned bh.spread apart; the first shot of a volley to connect deals the damage
      const n = parental ? 2 : hits, fan = bh.n || 1;
      const spd = projSpeed(move) * (bh.spd || 1);
      const cn = e.cancelN | 0;
      for (let i = 0; i < n; i++) after(i * 0.09, () => {
        if ((e.cancelN | 0) !== cn) return;
        const sp = n > 1 ? (Math.random() - 0.5) * 0.12 : 0, vol = { hit: false };
        for (let j = 0; j < fan; j++) {
          const a2 = ang + sp + (j - (fan - 1) / 2) * (bh.spread || 0.2);
          B.proj.push({ side: side.idx, move, x: e.x + Math.cos(a2) * 14, y: e.y - 10 * SS + Math.sin(a2) * 8, vx: Math.cos(a2) * spd, vy: Math.sin(a2) * spd, r: 14 * sc * (bh.r || 1) * (1 + TUNE.CHARGE_SIZE * pow), t: 0, life: rangePx(move, 120) / spd * (bh.spd || 1), ang: a2, parental: parental && i === 1, vol, home: bh.home || 0, pow });
        }
      });
      break;
    }
    case 'gust': {
      // Prism Blow: a cone of petals that follows the user, ticks small damage and shoves the target along the wind
      B.gusts.push({ side: side.idx, move, mon: m, ang, t: 0, dur: bh.dur, len: bh.len, half: bh.half, ticks: 0, tickT: 0, fxT: 0, mul: 1 / bh.ticks, push: bh.push });
      shake(2);
      break;
    }
    case 'orange': {
      // Ja-orange!: hop back out of the way (brief i-frames), then Orange flies out doing his own Jarona
      e.iframes = Math.max(e.iframes, 0.4); e.kx -= ax * 560; e.ky -= ay * 560; e.hopT = 0.32;
      spawnFx('Puff_White', e.x, e.y - 4 * SS, { scale: SS });
      const spd = bh.spd || 800;
      B.proj.push({ side: side.idx, move, x: e.x + ax * 22, y: e.y - 10 * SS + ay * 8, vx: ax * spd, vy: ay * spd, r: 20 * Math.max(sc, 1), t: 0, life: 1.6, ang, vol: { hit: false }, home: 0, pow: 0, orange: true });
      break;
    }
    case 'sweep': startSweep(side, move, ax, ay, sc); B.cam.punch = Math.max(B.cam.punch, 0.15); break;
    case 'wave': {
      // a wide front that rolls forward and hits once (Surf, Icy Wind, Whirlwind, sound waves)
      B.waves.push({ side: side.idx, move, x: e.x, y: e.y, ang, w: (bh.w || 90) * Math.max(sc, 0.8), len: bh.len || 260, spd: bh.spd || 460, push: bh.push || 0, pushOnly: !!bh.pushOnly, t: 0, hit: false, fxT: 0, rocks: new Set() });
      if (bh.w >= 140) shake(3);
      break;
    }
    case 'beam': {
      const len = rayLen(e.x, e.y - 8 * SS, ax, ay, rangePx(move, 160));
      B.beams.push({ side: side.idx, move, x: e.x + ax * 10, y: e.y - 8 * SS + ay * 6, ang, len, w: (bh.w || 14) * sc * (move.basePower >= 120 ? 1.5 : 1), t: 0, dur: 0.35, hit: false });
      if (move.basePower >= 100) shake(3);
      break;
    }
    case 'laser': {
      const L = LASERS[move.id], ox = e.x + ax * 10, oy = e.y - 8 * SS + ay * 6;
      act.recover = L.dur + 0.12;
      B.beams.push({ side: side.idx, move, laser: L, x: ox, y: oy, ang, len: 0, w: L.w * (0.85 + 0.15 * sc), t: 0, dur: L.dur, tickT: 0, ticks: 0 });
      if (move.basePower >= 110) { shake(3); B.cam.punch = Math.max(B.cam.punch, 0.12); }
      break;
    }
    case 'area': {
      const r = areaRadius(move) * (move.category === 'Status' ? 1.2 : 1);
      B.areas.push({ side: side.idx, move, x: e.x, y: e.y, r, t: 0, dur: bh.huge ? 0.55 : 0.4, hit: false, ground: moveType(move, m) === 'Ground', mul: bh.mul, big: bh.huge });
      if (bh.huge) { shake(9); flash(0.2, TYPE_COLOR[move.type]); B.cam.punch = Math.max(B.cam.punch, 0.25); burst(e.x, e.y - 10 * SS, TYPE_COLOR[move.type], 46, r * 1.6, 0.7, 4); burst(e.x, e.y - 10 * SS, '#fff', 18, r, 0.4, 3); }
      if (moveType(move, m) === 'Ground') { decal('crack', e.x, e.y, r * 0.5); shake(5); }
      if (move.id === 'explosion' || move.id === 'selfdestruct' || move.id === 'mistyexplosion') { shake(10); B.cam.punch = 0.3; burst(e.x, e.y, '#ffb347', 40, 260, 0.7, 4); }
      break;
    }
    case 'melee': {
      const reach = (22 + bodyRadius(spriteKey(m)) + (fx.range > 1 ? 18 : 0) + (bh.reach || 0) + TUNE.MELEE.REACH) * (isChargeMove(move) ? TUNE.MELEE.CHARGE_SIZE : 1);
      snapAim(side, reach * TUNE.MELEE.SNAP_RANGE + hurtRadius(foe));
      e.kx += e.aimX * 90; e.ky += e.aimY * 90;
      const n = parental ? 2 : hits;
      const cn = e.cancelN | 0;
      for (let i = 0; i < n; i++) after(i * 0.12, () => { if ((e.cancelN | 0) === cn) meleeHit(side, move, reach, i, parental && i === 1); });
      break;
    }
    case 'dash': case 'lunge': {
      // full-length dash: Speed sets both distance and pace; on pad with the aim stick idle it goes where you're walking.
      // A lunge is the short, fast version that cuts anything within reach in front instead of needing body contact.
      snapAim(side, TUNE.MELEE.HOME_RANGE);
      let dx = e.aimX, dy = e.aimY;
      if (!side.cpu && !side.remote && INPUT.usingPad && !INPUT.aimActive && Math.hypot(INPUT.mx, INPUT.my) > 0.3) { const l = Math.hypot(INPUT.mx, INPUT.my); dx = INPUT.mx / l; dy = INPUT.my / l; e.aimX = dx; e.aimY = dy; e.face = dirFromVec(dx, dy); }
      const k = speedFactor(m, side), prio = move.priority > 0, lunge = arch === 'lunge';
      const roll = !!bh.roll;
      e.dash = { move, dx, dy, spd: (prio || lunge ? 820 : 560) * k * (bh.spd || 1), left: (lunge ? 150 : prio ? 230 : 190) * k * (bh.dist || 1), hit: false, parental, roll, noHome: !!bh.noHome, wall: !!bh.wall, afterimage: !!bh.afterimage, t: roll ? 1.6 : 0, hitCd: 0, hits: 0, reach: (lunge ? 30 + TUNE.MELEE.LUNGE_REACH : 4 + TUNE.MELEE.DASH_REACH + (bh.reach || 0)) * (isChargeMove(move) ? TUNE.MELEE.CHARGE_SIZE : 1), lunge, mul: bh.mul, fast: !!bh.spd };
      if (roll) { e.dash.left = 1e9; if (spriteOf(spriteKey(m))?.anims.Rotate) { e.anim = 'Rotate'; e.animT = 0; } }
      if (prio) e.iframes = Math.max(e.iframes, e.dash.left / e.dash.spd + 0.05);
      burst(e.x, e.y, '#ddd', 6, 80, 0.25, 1);
      break;
    }
    case 'lob': case 'strike': case 'hazard': case 'trap': {
      const rng = arch === 'trap' ? (bh.range || 240) : rangePx(move, 120);
      const foeE = foe.ent;
      let tx = e.x + ax * rng, ty = e.y + ay * rng;
      // land where the stick points, but no further than range, and snap to the foe if the aim is close to them
      const fd = Math.hypot(foeE.x - e.x, foeE.y - e.y), fang = Math.atan2(foeE.y - e.y, foeE.x - e.x);
      if (fd < rng && Math.abs(angDiff(fang, ang)) < 0.35) { tx = foeE.x; ty = foeE.y; }
      [tx, ty] = clampToArena(tx, ty, 6);
      if (arch === 'strike') {
        // tracking reticle: starts on the foe if in range, chases them, then locks briefly before it lands
        if (fd < rng * 1.15) { tx = foeE.x; ty = foeE.y; }
        const r = (bh.r || clamp((fx.explosionRange || 1) * TUNE.TILE * 1.4, 38, 80)) * Math.max(sc, 0.85) * (1 + TUNE.CHARGE_SIZE * pow);
        B.marks.push({ side: side.idx, move, kind: arch, sx: e.x, sy: e.y - 12 * SS, x: tx, y: ty, r, t: 0, delay: bh.delay || 0.95, track: bh.track || 0.65, chase: 170 * (1 + pow * 1.2) });
        break;
      }
      // traps fly out like a lob, then stay on the field (placeTrap); generous radius so status moves are easy to land
      const r = arch === 'hazard' ? 26 : arch === 'trap' ? (bh.r || 70) * Math.max(hitScale(move, m), 0.9) : (bh.r || clamp(((fx.explosionRange || 1) * TUNE.TILE) * sc, 30, 70));
      // n scattered drops (Rock Slide, Draco Meteor): each lands on its own and deals a share of the damage
      const n = bh.n || 1;
      for (let i = 0; i < n; i++) {
        const a2 = i / n * Math.PI * 2 + Math.random(), d2 = n > 1 ? rand(r * 0.4, r * 1.3) : 0;
        const [mx, my] = clampToArena(tx + Math.cos(a2) * d2, ty + Math.sin(a2) * d2 * 0.7, 6);
        B.marks.push({ side: side.idx, move, kind: arch, sx: e.x, sy: e.y - 12 * SS, x: mx, y: my, r, t: 0, delay: arch === 'trap' ? 0.4 : 0.55 + i * 0.12, mul: n > 1 ? 1.4 / n : 0, multi: i > 0 });
      }
      break;
    }
    case 'leap': {
      if (move.id !== 'dig') {
        // Fly, Bounce, Sky Drop, Phantom Force: squash-and-stretch takeoff, then a homing reticle (same tell as Psychic) and a fast, wide landing
        const F = bh.fly || {};
        e.hidden = F.hide || 0.62; e.flying = true; e.flySpd = F.spd || 1.5; e.flyT0 = B.time; e.iframes = Math.max(e.iframes, (F.hide || 0.62) + 0.03);
        B.marks.push({ side: side.idx, move, kind: 'strike', sx: e.x, sy: e.y - 12 * SS, x: e.x, y: e.y, r: 76 * Math.max(sc, 0.9), t: 0, delay: (F.hide || 0.62) - 0.02, chase: F.hide ? 900 : 340, land: true, mon: m, fly: F.hide ? F : null });
        ring(e.x, e.y, 22, '#fff', 0.3, 2);
        break;
      }
      e.flying = false;
      e.hidden = 0.85; e.iframes = Math.max(e.iframes, 0.9);
      ring(e.x, e.y, 22, move.id === 'dig' ? '#c9a46b' : '#fff', 0.3, 2);
      if (move.id === 'dig') decal('hole', e.x, e.y, 12);
      after(0.85, () => {
        if (activeMon(side) !== m || m.fainted) return;
        B.areas.push({ side: side.idx, move, x: e.x, y: e.y, r: 62, t: 0, dur: 0.3, hit: false });
        shake(4); burst(e.x, e.y, '#fff', 16, 160, 0.4, 3);
      });
      break;
    }
  }
  if (move.flags?.recharge) m.vol.recharge = 1.3 + (LASERS[move.id]?.dur || 0);
  if (['explosion', 'selfdestruct', 'mistyexplosion', 'memento', 'finalgambit'].includes(move.id) || move.selfdestruct === 'always') after(0.05, () => chip(side, m, m.hp, 'self'));
  if (move.id === 'mindblown' || move.mindBlownRecoil) chip(side, m, m.maxHp / 2 * TUNE.FIGHT_SCALE * 3, 'self');
}
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
function clampToArena(x, y, pad = 0) { const ar = B.arena, w = ar.wall + pad; return [clamp(x, w, ar.w - w), clamp(y, w, ar.h - w)]; }
function rayLen(x, y, dx, dy, max) {
  for (let d = 0; d < max; d += 6) {
    const px = x + dx * d, py = y + dy * d;
    const [cx, cy] = clampToArena(px, py);
    if (cx !== px || cy !== py) return d;
    for (const r of B.rocks) if (Math.hypot(px - r.x, py - r.y) < r.r) return d + 4;
  }
  return max;
}
function meleeHit(side, move, reach, i, parental) {
  const e = side.ent, foe = foeOf(side), fe = foe.ent, m = activeMon(side);
  if (activeMon(side) !== m || m.fainted || !B) return;
  const ang = Math.atan2(e.aimY, e.aimX), ax = e.aimX, ay = e.aimY;
  const hx = e.x + ax * reach * 0.6, hy = e.y + ay * reach * 0.6;
  if (move.fx?.anims?.[0]) spawnFx(move.fx.anims[0], hx, hy - 8, { dir: e.face }); else slashFx(hx, hy - 8, ang, TYPE_COLOR[move.type]);
  for (const r of B.rocks) if (Math.hypot(r.x - hx, r.y - hy) < reach * 0.6 + r.r) hitRock(r, move);
  // the swing stays live for MELEE.ACTIVE seconds: it re-tests, and the user steps into a foe who is in front but just out of reach
  const sw = { done: false }, M = TUNE.MELEE, cn = e.cancelN | 0;
  const test = () => {
    if (sw.done || !B || activeMon(side) !== m || m.fainted || (e.cancelN | 0) !== cn) return;
    const dx = fe.x - e.x, dy = fe.y - e.y, d = Math.hypot(dx, dy), hr = hurtRadius(foe);
    const inFront = d < hr + 12 || Math.abs(angDiff(Math.atan2(dy, dx), ang)) < M.CONE;
    if (!inFront) return;
    if (d < reach + hr) {
      if (!canHit(foe)) { if (fe.iframes > 0 && fe.dodge && !sw.dodged) { sw.dodged = true; floatText(fe.x, fe.y - 40 * SS, 'Dodged!', '#bdf', 11); } return; }
      sw.done = true; hitFoe(side, move, { x: fe.x - ax * 8, y: fe.y }, { parental, multi: i > 0 });
    } else if (d < reach * 1.8 + hr && !e.dodge && e.hidden <= 0) { const st = Math.min(M.STEP * M.ACTIVE / M.TICKS, d - reach * 0.5); e.x += dx / d * st; e.y += dy / d * st; }
  };
  test();
  for (let k = 1; k <= M.TICKS; k++) after(k * M.ACTIVE / M.TICKS, test);
}
// aim assist for melee-style moves: a foe roughly in front of the aim, and near enough, gets aimed at
function snapAim(side, range) {
  const e = side.ent, fe = foeOf(side).ent, dx = fe.x - e.x, dy = fe.y - e.y, d = Math.hypot(dx, dy);
  if (d > range || d < 1 || Math.abs(angDiff(Math.atan2(dy, dx), Math.atan2(e.aimY, e.aimX))) > TUNE.MELEE.SNAP_CONE) return;
  e.aimX = dx / d; e.aimY = dy / d; e.face = dirFromVec(e.aimX, e.aimY);
}
function slashFx(x, y, ang) { spawnFx('Cut', x, y, { dir: dirFromVec(Math.cos(ang), Math.sin(ang)), scale: SS * 0.75, ft: 2 }); }

// ---------- applying a hit ----------
function canHit(foe) {
  const e = foe.ent, m = activeMon(foe);
  return !m.fainted && e.iframes <= 0 && e.hidden <= 0 && e.enterT <= 0;
}
function hitFoe(side, move, at, opts = {}) {
  const foe = foeOf(side), fe = foe.ent, m = activeMon(side), fm = activeMon(foe);
  if (!canHit(foe)) { if (fe.iframes > 0 && fe.dodge) floatText(fe.x, fe.y - 40 * SS, 'Dodged!', '#bdf', 11); return false; }
  // protection
  if (fe.protect > 0 && !move.breaksProtect) {
    floatText(fe.x, fe.y - 40 * SS, 'Protected!', '#9cf', 12); ring(fe.x, fe.y - 10 * SS, 24, '#9cf', 0.25, 3);
    const pid = fm.vol.protectId;
    if (move.flags?.contact) {
      if (pid === 'kingsshield') boost(side, m, { atk: -1 }, true);
      if (pid === 'spikyshield') chip(side, m, m.maxHp / 8 * TUNE.FIGHT_SCALE * 3);
      if (pid === 'banefulbunker') inflict(side, m, 'psn');
      if (pid === 'burningbulwark') inflict(side, m, 'brn');
    }
    return false;
  }
  // Magic Bounce sends status moves back
  if (move.category === 'Status' && abil(fm, 'magicbounce') && move.target !== 'self') {
    floatText(fe.x, fe.y - 40 * SS, 'Bounced!', '#f9c', 12); statusOnTarget(foe, side, move); return false;
  }
  const type = moveType(move, m);
  const imm = immunity(m, fm, move, type);
  if (imm) return absorbHit(foe, fm, imm, type);
  if (move.category === 'Status') return statusOnTarget(side, foe, move);

  const inPuddle = (B.puddles.some(p => Math.hypot(p.x - fe.x, p.y - fe.y) < p.r) || (B.soakT > 0 && grounded(fm))) && type === 'Electric';
  const userPuddle = B.puddles.some(p => Math.hypot(p.x - side.ent.x, p.y - side.ent.y) < p.r) && type === 'Water';
  const r = calcDamage(m, fm, move, { parental: opts.parental, puddleBoost: inPuddle || userPuddle });
  if (r.eff === 0) { floatText(fe.x, fe.y - 40 * SS, 'No effect', '#aaa', 12); return false; }
  let dmg = opts.mul ? Math.max(1, Math.round(r.dmg * opts.mul)) : r.dmg;
  // survive-at-1 effects
  if (dmg >= fm.hp && fm.hp === fm.maxHp && (abil(fm, 'sturdy') || (item(fm, 'focussash') && !fm.vol.sashUsed))) { dmg = fm.hp - 1; if (item(fm, 'focussash')) { fm.vol.sashUsed = true; fm.item = ''; } floatText(fe.x, fe.y - 54 * SS, 'Hung on!', '#fff', 12); }
  if (dmg >= fm.hp && fm.vol.endure > 0) { dmg = fm.hp - 1; floatText(fe.x, fe.y - 54 * SS, 'Endured!', '#fff', 12); }
  if (move.id === 'falseswipe' || move.id === 'holdback') dmg = Math.min(dmg, fm.hp - 1);
  fm.hp = Math.max(0, fm.hp - dmg);
  side.dealt += dmg; side.hits++;
  if (fm.sp.id === 'flowery' && B.time - (foe.huhT ?? -9) > 3) { foe.huhT = B.time; AUDIO.play(window.FLOWERY_HUH, 0.9, 1, fe.x); }
  // feedback
  const frac = dmg / fm.maxHp;
  fe.flash = 0.12; fe.hurtT = 0.25;
  // melee-style wind-ups (and charge-ups, bar Focus Punch) have armor: a small hit does not interrupt, stun or shove them
  const am = fe.act && !fe.act.fired && fe.act.move.id !== 'focuspunch' && isMeleeStyle(fe.act.move) && frac < TUNE.MELEE.ARMOR && !abil(fm, 'innerfocus') ? (opts.tick ? 1 : 0.25) : 1;
  const tick = opts.tick, kb = (tick ? (opts.kb ?? 40) : 110 + 700 * frac) * am, dx = fe.x - (at?.ox ?? side.ent.x), dy = fe.y - (at?.oy ?? side.ent.y), dl = Math.hypot(dx, dy) || 1;
  fe.kx += dx / dl * kb; fe.ky += dy / dl * kb;
  if (tick) { fe.beamSlow = 0.2; shake(1.5); }
  else {
    if (am === 1) fe.stun = Math.max(fe.stun, clamp(0.08 + frac * 1.2, 0.08, 0.32));
    B.hitstop = Math.max(B.hitstop, clamp(0.03 + frac * 0.6, 0.03, 0.11));
    shake(clamp(frac * 40, 1, 8));
  }
  const col = r.crit ? '#ffef5a' : r.eff > 1 ? '#ff7a59' : r.eff < 1 ? '#bbb' : '#fff';
  floatText(fe.x + rand(-8, 8), fe.y - 36 * SS, String(dmg), col, r.crit || r.eff > 1 ? 18 : 14);
  if (r.crit) { floatText(fe.x, fe.y - 56 * SS, 'Critical!', '#ffef5a', 12); B.cam.punch = Math.max(B.cam.punch, 0.18); }
  if (r.eff > 1) floatText(fe.x, fe.y - 66 * SS, 'Super effective!', '#ff9a59', 12);
  else if (r.eff < 1) floatText(fe.x, fe.y - 66 * SS, 'Not very effective', '#bbb', 11);
  const hitAnim = move.fx?.hitAnim, loud = !tick || tick % 3 === 1;
  if (!tick || tick % 2) spawnFx(r.eff > 1 ? 'Hit_Super_Effective' : 'Hit_Neutral', fe.x + (tick ? rand(-6, 6) : 0), fe.y - 12 * SS - fe.z, { ft: 2, scale: tick ? SS * 0.6 : SS });
  if (hitAnim && loud) spawnFx(hitAnim, fe.x, fe.y - 12 * SS - fe.z);
  // shards fly out along the hit; solid hits add a shockwave and an impact star, the biggest flash the screen
  const tc = TYPE_COLOR[type] || '#fff', hy = fe.y - 12 * SS - fe.z;
  sparks(fe.x, hy, Math.atan2(dy, dx), tick ? 0.6 : 0.9, tick ? 2 : Math.min(18, 6 + Math.round(frac * 60)), tc, tick ? 140 : 180 + frac * 400);
  if (!tick && (frac >= 0.08 || r.crit || r.eff > 1)) { ring(fe.x, hy, 20 + frac * 120, tc); spawnFx('Mega_Background_White', fe.x, hy, { ft: 2, scale: frac >= 0.2 || r.crit ? SS * 0.5 : SS * 0.35 }); }
  if (!tick && (opts.charged || frac >= 0.22 || fm.hp <= 0 || (r.crit && frac >= 0.1) || (r.eff > 1 && move.basePower >= 90))) impact(fe.x, hy, frac >= 0.35 || opts.charged ? 0.16 : 0.1);
  else if (!tick && r.crit) flash(0.07);
  if (!tick) for (const col of move.fx?.columns || []) if (VFX.beams[col]) B.fx.push({ column: col, x: fe.x, y: fe.y, t: 0, life: 0.35 });
  if (loud) hitSound(tick ? frac * 3 : frac, r.eff, fe.x);
  if (type === 'Fire') decal('scorch', fe.x, fe.y, 14); if (type === 'Water') decal('wet', fe.x, fe.y, 14);
  if (fm.status === 'frz' && (type === 'Fire' || move.thawsTarget)) { fm.status = ''; floatText(fe.x, fe.y - 44 * SS, 'Thawed', '#fff', 11); }
  if (fm.status === 'slp' && !fm.vol.restSleep) { fm.status = ''; floatText(fe.x, fe.y - 44 * SS, 'Woke up!', '#fff', 11); }
  if (fm.status === 'frz') { fm.status = ''; floatText(fe.x, fe.y - 44 * SS, 'Thawed', '#fff', 11); }
  if (item(fm, 'airballoon') && !fm.vol.balloonPopped) { fm.vol.balloonPopped = true; fm.item = ''; floatText(fe.x, fe.y - 54 * SS, 'Balloon popped!', '#fff', 11); }
  // interrupt windups: big hits or flinch
  const armorLim = fe.act && !fe.act.fired && fe.act.move.id !== 'focuspunch' && isMeleeStyle(fe.act.move) ? TUNE.MELEE.ARMOR : 0.12;
  const interrupts = fe.act && !fe.act.fired && ((tick ? fe.tickDmg = (fe.tickDmg || 0) + frac : frac) >= armorLim || fe.act.move.id === 'focuspunch');
  if (interrupts && !abil(fm, 'innerfocus')) { fe.act = null; floatText(fe.x, fe.y - 76 * SS, 'Interrupted', '#ffd', 11); }
  // after-hit effects
  afterHit(side, foe, move, dmg, r, opts.multi);
  if (fm.hp <= 0) faint(foe, fm);
  else {
    if (r.eff > 1 && item(fm, 'weaknesspolicy')) { fm.item = ''; boost(foe, fm, { atk: 2, spa: 2 }); }
    if (item(fm, 'sitrusberry') && fm.hp <= fm.maxHp / 2) { fm.item = ''; heal(fm, fm.maxHp / 4, fe.x, fe.y); }
    if (r.crit && abil(fm, 'angerpoint')) { fm.stages.atk = 6; floatText(fe.x, fe.y - 50 * SS, 'ATK maxed!', '#f88', 12); }
    if (abil(fm, 'weakarmor') && move.category === 'Physical') boost(foe, fm, { def: -1, spe: 2 });
    if (abil(fm, 'justified') && type === 'Dark') boost(foe, fm, { atk: 1 });
    if (abil(fm, 'steamengine') && (type === 'Fire' || type === 'Water')) boost(foe, fm, { spe: 6 });
  }
  return true;
}
function absorbHit(foe, fm, imm, type) {
  const fe = foe.ent;
  if (['waterabsorb', 'voltabsorb', 'dryskin'].includes(imm)) heal(fm, fm.maxHp / 4 * TUNE.FIGHT_SCALE * 2, fe.x, fe.y);
  else if (imm === 'flashfire') fm.vol.flashFire = true;
  else if (imm === 'stormdrain' || imm === 'lightningrod') boost(foe, fm, { spa: 1 });
  else if (imm === 'sapsipper') boost(foe, fm, { atk: 1 });
  else if (imm === 'motordrive') boost(foe, fm, { spe: 1 });
  floatText(fe.x, fe.y - 44 * SS, (DEX.abilities[imm]?.name || ({ Levitate: 'Levitate', powder: 'Immune', soundproof: 'Soundproof', bulletproof: 'Bulletproof' })[imm] || 'Immune'), '#ccf', 12);
  return false;
}
// multi = a follow-up hit or laser tick: once-per-move effects (Life Orb, secondaries, switches) only fire on the first.
function afterHit(side, foe, move, dmg, r, multi) {
  const m = activeMon(side), fm = activeMon(foe), e = side.ent, fe = foe.ent;
  if (move.drain) heal(m, dmg * move.drain[0] / move.drain[1] * (item(m, 'bigroot') ? 1.3 : 1), e.x, e.y);
  if (move.recoil && !abil(m, 'rockhead')) chip(side, m, dmg * move.recoil[0] / move.recoil[1], 'recoil');
  if (multi) return;
  if (item(m, 'lifeorb') && !abil(m, 'sheerforce')) chip(side, m, m.maxHp / 10 * TUNE.FIGHT_SCALE * 2, 'recoil');
  if (item(m, 'shellbell')) heal(m, dmg / 8, e.x, e.y);
  if (move.self && move.self.boosts && move.category !== 'Status') boost(side, m, move.self.boosts);
  if (move.id === 'knockoff' && fm.item && !DEX.items[fm.item]?.megaStone) { floatText(fe.x, fe.y - 54 * SS, 'Knocked off ' + (DEX.items[fm.item]?.name || 'item'), '#fff', 11); fm.item = ''; }
  if (['rapidspin', 'mortalspin', 'tidyup'].includes(move.id)) clearHazards(side.idx === 0 ? 1 : 0, side.idx);
  if (move.forceSwitch && !fm.fainted && fm.hp > 0) forceSwitch(foe);
  if (move.selfSwitch && remaining(side) > 1) { if (side.cpu) after(0.25, () => doSwap(side, cpuPickSwap(side), true)); else side.freeSwap = 2.5; }
  // secondary effects
  const secs = abil(m, 'sheerforce') ? [] : (move.secondaries || (move.secondary ? [move.secondary] : []));
  for (const s of secs) {
    const ch = (s.chance || 100) * (abil(m, 'serenegrace') ? 2 : 1);
    if (Math.random() * 100 >= ch || fm.hp <= 0) continue;
    if (abil(fm, 'shielddust') && !s.self) continue;
    if (s.status) inflict(foe, fm, s.status, side);
    if (s.boosts) boost(foe, fm, s.boosts, true);
    if (s.volatileStatus === 'confusion') confuse(foe, fm);
    if (s.volatileStatus === 'flinch' && fe.act && !fe.act.fired && !abil(fm, 'innerfocus')) { fe.act = null; floatText(fe.x, fe.y - 76 * SS, 'Flinched', '#ffd', 11); if (abil(fm, 'steadfast')) boost(foe, fm, { spe: 1 }); }
    if (s.self && s.self.boosts) boost(side, m, s.self.boosts);
  }
  if ((item(m, 'kingsrock') || abil(m, 'stench')) && Math.random() < 0.1 && fe.act && !fe.act.fired) fe.act = null;
  // contact abilities / items
  if (move.flags?.contact && !fm.fainted) {
    const roll = Math.random() < 0.3;
    if (roll && abil(fm, 'static')) inflict(side, m, 'par');
    if (roll && abil(fm, 'flamebody')) inflict(side, m, 'brn');
    if (roll && abil(fm, 'poisonpoint')) inflict(side, m, 'psn');
    if (roll && abil(fm, 'effectspore') && !hasType(m, 'Grass')) inflict(side, m, pick(['slp', 'par', 'psn']));
    if (roll && abil(fm, 'cutecharm')) confuse(side, m);
    if (abil(fm, 'roughskin') || abil(fm, 'ironbarbs')) chip(side, m, m.maxHp / 8 * TUNE.FIGHT_SCALE * 3);
    if (item(fm, 'rockyhelmet')) chip(side, m, m.maxHp / 6 * TUNE.FIGHT_SCALE * 3);
    if (abil(fm, 'cursedbody') && roll) { const s = m.moves.findIndex(x => x === move); if (s >= 0) m.cds[s] += 4; }
    if (abil(fm, 'poisontouch') && roll) inflict(foe, fm, 'psn');
  }
  if (abil(m, 'poisontouch') && move.flags?.contact && Math.random() < 0.3) inflict(foe, fm, 'psn');
}
function forceSwitch(side) {
  const opts = side.team.map((m, i) => i).filter(i => i !== side.cur && !side.team[i].fainted);
  if (!opts.length || abil(activeMon(side), 'suctioncups')) return;
  const prev = side.swapCd; doSwap(side, pick(opts), true); side.swapCd = prev;
  floatText(side.ent.x, side.ent.y - 60 * SS, 'Dragged out!', '#fff', 12);
}
function statusOnTarget(side, foe, move) {
  const fm = activeMon(foe), m = activeMon(side), fe = foe.ent;
  let did = false;
  if (move.status) did = inflict(foe, fm, move.status, side) || did;
  if (move.boosts) did = boost(foe, fm, move.boosts, true) || did;
  const v = move.volatileStatus;
  if (v === 'confusion') { confuse(foe, fm); did = true; }
  if (v === 'leechseed' && !hasType(fm, 'Grass') && !fm.vol.seeded) { fm.vol.seeded = side.idx + 1; floatText(fe.x, fe.y - 44 * SS, 'Seeded', '#9f9', 12); did = true; }
  if (v === 'taunt') { fm.vol.taunt = 8; floatText(fe.x, fe.y - 44 * SS, 'Taunted', '#f99', 12); did = true; }
  if (v === 'yawn' && !fm.status) { floatText(fe.x, fe.y - 44 * SS, 'Drowsy...', '#ccf', 12); after(3, () => { if (activeMon(foe) === fm) inflict(foe, fm, 'slp'); }); did = true; }
  if (move.forceSwitch) { forceSwitch(foe); did = true; }
  if (move.id === 'painsplit') { const avg = (m.hp + fm.hp) / 2; m.hp = Math.min(m.maxHp, avg); fm.hp = Math.min(fm.maxHp, avg); did = true; }
  if (move.id === 'defog') { clearHazards(0, -1); clearHazards(1, -1); for (const k in foe.screens) if (k !== 'tailwind') foe.screens[k] = 0; did = true; }
  const hitAnim = move.fx?.hitAnim; if (hitAnim) spawnFx(hitAnim, fe.x, fe.y - 12 * SS); else ring(fe.x, fe.y - 10 * SS, 18, TYPE_COLOR[move.type], 0.3, 2);
  if (!did) floatText(fe.x, fe.y - 44 * SS, 'No effect', '#aaa', 11);
  return did;
}
function selfEffect(side, move) {
  const m = activeMon(side), e = side.ent, id = move.id;
  const anim = move.fx?.anims?.[0]; if (anim) spawnFx(anim, e.x, e.y - 12 * SS, { follow: side.idx }); else ring(e.x, e.y - 10 * SS, 22, TYPE_COLOR[move.type], 0.4, 2);
  if (PROTECTS.has(id)) {
    m.vol.protectId = id;
    if (id === 'endure') m.vol.endure = 2.5; else e.protect = 0.9;
    return;
  }
  if (move.boosts) boost(side, m, move.boosts);
  if (move.self?.boosts) boost(side, m, move.self.boosts);
  if (id === 'bellydrum') { if (m.hp > m.maxHp / 2) { chip(side, m, m.maxHp / 2, 'self'); m.stages.atk = 6; floatText(e.x, e.y - 50 * SS, 'ATK maxed!', '#f88', 12); } }
  if (id === 'transform') { const fm = activeMon(foeOf(side)); if (!fm.fainted) transformInto(side, m, fm); }
  if (id === 'haze') for (const s of B.sides) activeMon(s).stages = blankStages();
  if (id === 'focusenergy') m.stages.crit = Math.max(m.stages.crit, 2);
  if (id === 'rest' && !statusImmune({ ...m, status: '' }, 'slp', side)) {
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.5); m.status = 'slp'; m.statusT = TUNE.REST_SLEEP; m.vol.restSleep = true; floatText(e.x, e.y - 44 * SS, 'Slept & healed!', '#9f9', 12);
  } else if (move.heal || ['synthesis', 'morningsun', 'moonlight', 'shoreup'].includes(id)) {
    let f = move.heal ? move.heal[0] / move.heal[1] : 0.5;
    const w = effWeather();
    if (['synthesis', 'morningsun', 'moonlight'].includes(id)) f = w === 'sun' ? 2 / 3 : w ? 0.25 : 0.5;
    heal(m, m.maxHp * f * TUNE.FIGHT_SCALE * 2.2, e.x, e.y);
  }
  const wx = move.weather && { sunnyday: 'sun', raindance: 'rain', sandstorm: 'sand', hail: 'snow', snow: 'snow', snowscape: 'snow' }[toId(move.weather)];
  if (wx) setWeather(wx, m);
  if (move.terrain) setTerrain(toId(move.terrain).replace('terrain', ''), m);
  if (move.sideCondition) {
    const sc = toId(move.sideCondition);
    if (sc in side.screens) {
      if (sc === 'auroraveil' && effWeather() !== 'snow') { floatText(e.x, e.y - 44 * SS, 'Needs snow', '#aaa', 11); return; }
      side.screens[sc] = (['reflect', 'lightscreen', 'auroraveil'].includes(sc) && item(m, 'lightclay')) ? TUNE.FIELD_TIME_EXT : sc === 'tailwind' ? 20 : TUNE.FIELD_TIME;
      floatText(e.x, e.y - 50 * SS, (DEX.moves[sc]?.name || move.name) + ' up!', '#9cf', 12);
    }
  }
}
function hitRock(r, move) {
  if (r.hp <= 0) return;
  r.hp -= (['Fighting', 'Ground', 'Rock', 'Steel'].includes(move.type) ? 2 : 1) * (move.basePower >= 90 ? 2 : 1);
  r.flash = 0.1; burst(r.x, r.y - 8 * SS, '#b9a98a', 6, 90, 0.3, 2);
  if (r.hp <= 0) { burst(r.x, r.y - 8 * SS, '#8c7c63', 20, 160, 0.5, 3); shake(3); uiBlip(90, 0.12, 'sawtooth'); }
}
function clearHazards(ownerIdx, byIdx) {
  const n = B.hazards.length;
  B.hazards = B.hazards.filter(h => h.owner !== ownerIdx);
  if (B.hazards.length < n) callout(byIdx >= 0 ? B.sides[byIdx] : { idx: -1 }, 'Hazards cleared!');
}

// ---------- per-frame update ----------
function updateBattle(dt) {
  if (!B) return;
  updateFxOnly(dt);
  if (B.paused) return;
  if (B.over) { B.endT += dt; return; }
  if (B.choose) { B.choose.t -= dt; if (B.choose.t <= 0) confirmChoose(); return; }
  if (B.hitstop > 0) { B.hitstop -= dt; return; }
  B.time += dt;
  const F = B.field;
  if (F.weather && (F.weatherT -= dt) <= 0) { F.weather = ''; callout({ idx: -1 }, 'The weather cleared.'); }
  if (F.terrain && (F.terrainT -= dt) <= 0) { F.terrain = ''; callout({ idx: -1 }, 'The terrain faded.'); }
  for (let i = B.timers.length - 1; i >= 0; i--) { const tm = B.timers[i]; if ((tm.t -= dt) <= 0) { B.timers.splice(i, 1); tm.fn(); } }
  for (const s of B.sides) { if (s.script) s.script(s, dt); else if (s.cpu) cpuThink(s, dt); else playerIntent(s, dt); } // script: team builder move preview
  for (const s of B.sides) updateSide(s, dt);
  separate();
  updateProjectiles(dt); updateGusts(dt); updateBeams(dt); updateAreas(dt); updateMarks(dt); updateHazards(dt); updateTraps(dt); updateWaves(dt); updateSweeps(dt);
  for (const s of B.sides) if (s.koT > 0 && (s.koT -= dt) <= 0) afterKO(s);
  B.rocks = B.rocks.filter(r => r.hp > 0);
}
function updateFxOnly(dt) {
  for (const f of B.fx) { f.t += dt; if (f.spark) { f.x += f.vx * dt; f.y += f.vy * dt; if (!f.home) { f.vy += 300 * dt; f.vx *= 0.96; } } }
  if (B.flashT > 0) B.flashT -= dt;
  if (B.impact && (B.impact.t -= dt) <= 0) B.impact = null;
  if (B.mega && !B.paused && !B.guest) megaTick(dt);
  B.fx = B.fx.filter(f => f.p ? f.t < (f.p.frames * f.ft / 60) * f.loops : f.t < f.life);
  for (const f of B.floats) f.t += dt; B.floats = B.floats.filter(f => f.t < (f.num ? 0.9 : 1.3));
  for (const c of B.callouts) c.t += dt; B.callouts = B.callouts.filter(c => c.t < 1.6);
  for (const d of B.decals) d.t += dt; B.decals = B.decals.filter(d => d.t < 20);
  for (const r of B.rocks) if (r.flash > 0) r.flash -= dt;
}
function playerIntent(side, dt) {
  const e = side.ent, I = side.intent;
  I.mx = INPUT.mx; I.my = INPUT.my;
  if (INPUT.usingPad) {
    if (INPUT.aimActive) { e.aimX = INPUT.ax; e.aimY = INPUT.ay; e.aimIdle = 0; }
    else { e.aimIdle += dt; if (e.aimIdle > 1 && Math.hypot(I.mx, I.my) > 0.3) { const l = Math.hypot(I.mx, I.my); e.aimX = I.mx / l; e.aimY = I.my / l; } }
  } else {
    // PC: the cursor is always the aim
    const w = screenToWorld(MOUSE.x, MOUSE.y), dx = w.x - e.x, dy = w.y - (e.y - 12 * SS), l = Math.hypot(dx, dy);
    if (l > 4) { e.aimX = dx / l; e.aimY = dy / l; } e.aimIdle = 0;
  }
  // Press fires; holding keeps firing as soon as the cooldown ends; a press slightly early is buffered.
  const keys = ['M1', 'M2', 'M3', 'M4'];
  I.use = keys.findIndex(k => INPUT.hit(k));
  if (I.use >= 0) side.buffer = { slot: I.use, t: 0.3 };
  else if (side.buffer && (side.buffer.t -= dt) > 0 && canUse(side, side.buffer.slot)) I.use = side.buffer.slot;
  else { const h = keys.findIndex((k, i) => INPUT.held(k) && canUse(side, i)); if (h >= 0) I.use = h; }
  if (I.use >= 0 && canUse(side, I.use)) side.buffer = null;
  I.hold = e.act && INPUT.held(keys[e.act.slot]) ? e.act.slot : -1;
  I.dodge = INPUT.hit('DODGE');
  I.mega = INPUT.hit('MEGA');
  // PC: number keys swap straight to that party slot
  for (let k = 1; k <= 6; k++) if (INPUT.hit('S' + k)) { if (doSwap(side, k - 1, side.freeSwap > 0)) side.freeSwap = 0; }
  // Pad: hold RB, point either stick at a mon, release to swap
  if (INPUT.usingPad && INPUT.held('RB')) {
    if (!side.wheel) side.wheel = { sel: -1 };
    const vx = INPUT.aimActive ? INPUT.ax : INPUT.mx, vy = INPUT.aimActive ? INPUT.ay : INPUT.my;
    if (Math.hypot(vx, vy) > 0.4) { const w = side.wheel, o = wheelOpts(side), k = wheelPick(o.length, Math.atan2(vy, vx)); w.ang = Math.atan2(vy, vx); w.sel = k >= 0 && !side.team[o[k]].fainted ? o[k] : -1; }
    I.mx = I.my = 0; I.use = -1;
  } else if (side.wheel) {
    const sel = side.wheel.sel; side.wheel = null;
    if (sel >= 0 && doSwap(side, sel, side.freeSwap > 0)) side.freeSwap = 0;
  }
}
// swap wheel: the active mon sits in the centre, every other team index gets a spoke (top, clockwise); wheel.sel is a team index
const wheelOpts = side => side.team.map((_, i) => i).filter(i => i !== side.cur);
const wheelPick = (n, ang) => n ? ((Math.round((ang + Math.PI / 2) / (Math.PI * 2 / n)) % n) + n) % n : -1;
const wheelAng = (k, n) => -Math.PI / 2 + k * Math.PI * 2 / n;

// Ends whatever attack the side is in the middle of. The move keeps its cooldown. Pending swing / volley callbacks see cancelN change and stop.
function cancelAttack(side) {
  const e = side.ent, m = activeMon(side);
  if (e.act || e.dash || e.laser) e.lock = 0;
  e.cancelN = (e.cancelN | 0) + 1; e.act = null; e.dash = null; e.laser = null;
  for (const b of B.beams) if (b.side === side.idx && b.laser) b.dead = true; // updateClash drops the clash, the foe's beam carries on
  if (m.vol.recharge > 1.3) m.vol.recharge = 1.3;
}

function updateSide(side, dt) {
  const m = activeMon(side), e = side.ent, I = side.intent, foe = foeOf(side);
  e.animT += dt;
  for (let i = 0; i < 4; i++) if (m.cds[i] > 0) m.cds[i] -= dt;
  side.swapCd -= dt; side.dodgeCd -= dt; if (side.freeSwap > 0) side.freeSwap -= dt;
  for (const k in side.screens) if (side.screens[k] > 0) side.screens[k] -= dt;
  e.iframes -= dt; e.flash -= dt; e.protect -= dt; e.hurtT -= dt; e.enterT -= dt; e.lock -= dt;
  for (const k of ['confused', 'taunt', 'endure', 'recharge', 'quickClaw']) if (m.vol[k] > 0) m.vol[k] -= dt;
  if (e.hidden > 0) e.hidden -= dt;
  e.z = grounded(m) ? 0 : (7 + Math.sin(B.time * 3 + side.idx) * 2) * SS;
  if (e.hopT > 0) { e.z += Math.sin((1 - e.hopT / 0.32) * Math.PI) * 10 * SS; e.hopT -= dt; }
  if (e.dodge) e.z += Math.sin((1 - e.dodge.t / (e.dodge.T || TUNE.DODGE_TIME)) * Math.PI) * 14 * SS;
  if (m.fainted) { e.vx = e.vy = 0; return; }

  // status timers and chip damage
  statusTick(side, m, dt);
  if (m.status === 'slp' || m.status === 'frz') {
    if ((m.statusT -= dt) <= 0) { m.status = ''; m.vol.restSleep = false; floatText(e.x, e.y - 44 * SS, m.status === 'frz' ? 'Thawed' : 'Woke up!', '#fff', 11); }
  }
  const incap = m.status === 'slp' || m.status === 'frz';
  if (I.mega && !incap) tryMega(side);

  // dodge
  if (I.dodge && side.dodgeCd <= 0 && !incap && e.stun <= 0 && e.hidden <= 0) {
    let dx = I.mx, dy = I.my; if (Math.hypot(dx, dy) < 0.2) { dx = -e.aimX; dy = -e.aimY; }
    const l = Math.hypot(dx, dy) || 1;
    cancelAttack(side); // dodge cancels any own attack: windup, charge, swing, dash, laser (cooldown stays spent)
    const dk = clamp(1 + TUNE.DODGE_SPEED_TIME * (speedFactor(m, side) - 1), 0.75, 1.35);
    e.dodge = { t: TUNE.DODGE_TIME * dk, T: TUNE.DODGE_TIME * dk, dx: dx / l, dy: dy / l }; e.iframes = Math.max(e.iframes, TUNE.DODGE_IFRAMES * dk);
    side.dodgeCd = clamp(2.2 - speedStat(m, side) / 250, 0.9, 2.2) * TUNE.DODGE_CD_MULT;
    spawnFx('Puff_White', e.x, e.y - 4 * SS, { scale: SS }); uiBlip(520, 0.04, 'triangle'); // dust cloud where it left from
  }
  // move execution
  if (I.use >= 0) useMove(side, I.use);
  if (e.act) {
    const act = e.act; act.t += dt;
    if (!act.fired && act.t >= act.wind) {
      // held chargeable shot: keep charging (aura rises, pow climbs) until released or held too long past full
      const held = act.canCharge && side.intent.hold === act.slot && act.t - act.wind < TUNE.CHARGE_MAX + 0.6;
      if (held) {
        act.pow = Math.min(1, (act.t - act.wind) / TUNE.CHARGE_MAX);
        B.fx.push({ spark: true, home: true, x: e.x + rand(-10, 10) * SS, y: e.y, vx: 0, vy: -rand(80, 180) * (0.5 + act.pow), t: 0, life: 0.35, col: Math.random() < 0.3 ? '#fff' : TYPE_COLOR[act.move.type] });
        if (act.pow >= 1 && !act.full) { act.full = true; ring(e.x, e.y - 12 * SS, 30, TYPE_COLOR[act.move.type]); uiBlip(990, 0.08, 'square'); }
      } else { if (act.pow) act.wind = act.t; fireMove(side); }
    }
    if (act.fired && act.t >= act.wind + act.recover && !e.dash) e.act = null;
  }
  // movement
  let vx = 0, vy = 0;
  if (e.dodge) {
    const sp = TUNE.DODGE_DIST / TUNE.DODGE_TIME * speedFactor(m, side); vx = e.dodge.dx * sp; vy = e.dodge.dy * sp;
    if ((e.dodge.t -= dt) <= 0) e.dodge = null;
  } else if (e.dash) {
    const d = e.dash;
    if (d.roll) {
      // Rollout / Ice Ball: a steerable roll that hits again every pass, harder each time
      const want = Math.hypot(I.mx, I.my) > 0.3 ? Math.atan2(I.my, I.mx) : Math.atan2(e.aimY, e.aimX), cur = Math.atan2(d.dy, d.dx);
      const na = cur + clamp(angDiff(want, cur), -4 * dt, 4 * dt); d.dx = Math.cos(na); d.dy = Math.sin(na);
      d.hitCd -= dt; if ((d.t -= dt) <= 0) d.left = 0;
    }
    const fe = foe.ent;
    if (!d.roll && !d.hit && !d.noHome) { // light homing: steers toward a foe who is in front, slowly enough that a well-timed sidestep or roll still beats it
      const fdx = fe.x - e.x, fdy = fe.y - e.y, cur = Math.atan2(d.dy, d.dx), df = angDiff(Math.atan2(fdy, fdx), cur);
      if (Math.hypot(fdx, fdy) < TUNE.MELEE.HOME_RANGE && Math.abs(df) < TUNE.MELEE.HOME_CONE) { const na = cur + clamp(df, -TUNE.MELEE.HOME * dt, TUNE.MELEE.HOME * dt); d.dx = Math.cos(na); d.dy = Math.sin(na); }
    }
    vx = d.dx * d.spd; vy = d.dy * d.spd; d.left -= d.spd * dt;
    if ((d.lunge || d.fast) && (d.trailT = (d.trailT || 0) - dt) <= 0) { d.trailT = 0.025; spawnFx('Puff_White', e.x - d.dx * 10, e.y - 6 * SS, { scale: 1 }); }
    if ((d.roll ? d.hitCd <= 0 : !d.hit) && Math.hypot(fe.x - e.x, fe.y - e.y) < bodyRadius(spriteKey(m)) + hurtRadius(foe) + (d.reach || 4)) {
      d.hit = true;
      if (d.roll) { d.hitCd = 0.45; hitFoe(side, d.move, { x: fe.x, y: fe.y }, { mul: Math.min(4, Math.pow(1.5, d.hits++)), multi: d.hits > 1 }); }
      else {
        // a lunge cuts as it arrives: the move's own slash sheet on the foe
        if (d.lunge) { const ang = Math.atan2(d.dy, d.dx); if (!spawnFx(d.move.fx?.anims?.[0], fe.x, fe.y - 12 * SS, { dir: e.face })) slashFx(fe.x, fe.y - 12 * SS, ang); }
        if (d.fast) { shake(8); flash(0.1, TYPE_COLOR[d.move.type]); slashFx(fe.x, fe.y - 12 * SS, Math.atan2(d.dy, d.dx)); }
        hitFoe(side, d.move, { x: fe.x, y: fe.y }, { parental: d.parental, mul: d.mul }); d.left = Math.min(d.left, 10);
      }
    }
    // overshoot: a dash that ended without connecting keeps going a little, slower, if the foe is still close (punishes a roll started too early)
    if (d.left <= 0 && !d.hit && !d.roll && !d.tailed && Math.hypot(fe.x - e.x, fe.y - e.y) < d.reach + bodyRadius(spriteKey(m)) + hurtRadius(foe) + TUNE.MELEE.TAIL) { d.tailed = true; d.left = TUNE.MELEE.TAIL; d.spd *= 0.5; }
    if (d.left <= 0) { if (d.lunge && !d.hit) slashFx(e.x + d.dx * 24, e.y - 10 * SS + d.dy * 12, Math.atan2(d.dy, d.dx)); e.dash = null; e.lock = 0.12; }
  } else if (!incap && e.stun <= 0) {
    let mx = I.mx, my = I.my;
    if (m.vol.confused > 0) { const a = Math.sin(B.time * 2.3) * 1.2; const c = Math.cos(a), s = Math.sin(a); [mx, my] = [mx * c - my * s, mx * s + my * c]; }
    let sp = moveSpeed(m, side);
    if (e.act && !e.act.fired) sp *= e.act.charging ? 0.2 : 0.4;
    else if (e.laser) sp *= e.laser.laser.mv;
    else if (e.act) sp *= 0.6;
    if (e.beamSlow > 0) { sp *= 0.6; e.beamSlow -= dt; }
    if (e.lock > 0) sp *= 0.3;
    if (grounded(m) && B.hazards.some(h => h.kind === 'stickyweb' && h.owner !== side.idx && Math.hypot(h.x - e.x, h.y - e.y) < h.r) && !item(m, 'heavydutyboots')) sp *= 0.5;
    for (const t of B.traps) if (t.slow && t.side !== side.idx && inTrap(t, e)) sp *= t.slow;
    if (e.hidden > 0) sp *= e.flying ? (e.flySpd || 1.5) : 1.25; // a flier steers in the sky and lands where it is
    vx = mx * sp; vy = my * sp;
  }
  e.vx = vx; e.vy = vy;
  e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
  const f = Math.pow(0.0008, dt); e.kx *= f; e.ky *= f;
  if (e.stun > 0) e.stun -= dt;
  // collide with arena edges and rocks
  const r = bodyRadius(spriteKey(m));
  const px0 = e.x, py0 = e.y;
  [e.x, e.y] = clampToArena(e.x, e.y, r * 0.6);
  if (e.dash?.wall && (Math.abs(px0 - e.x) > 0.5 || Math.abs(py0 - e.y) > 0.5)) e.dash.left = 0; // Jarona stops at walls
  if (e.hidden <= 0 || m.vol.lastMove !== 'dig') for (const rk of B.rocks) {
    const dx = e.x - rk.x, dy = e.y - rk.y, d = Math.hypot(dx, dy), min = rk.r + r * 0.7;
    if (d < min && d > 0.01) { e.x = rk.x + dx / d * min; e.y = rk.y + dy / d * min; if (e.dash) { e.dash.left = 0; hitRock(rk, e.dash.move); } }
  }
  // facing + anim
  const moving = Math.hypot(vx, vy) > 5;
  if (e.laser) e.face = dirFromVec(Math.cos(e.laser.ang), Math.sin(e.laser.ang));
  else if (e.act || e.aimIdle < 1 || INPUT.mouseAim && !side.cpu && !side.remote) e.face = dirFromVec(e.aimX, e.aimY);
  else if (moving && !e.dodge) e.face = dirFromVec(vx, vy);
  if (side.cpu && !e.act && !e.laser) e.face = moving && side.ai.faceMove ? dirFromVec(vx, vy) : dirFromVec(e.aimX, e.aimY);
  let want = 'Idle';
  if (m.status === 'slp') want = 'Sleep';
  else if (e.act) want = e.anim;
  else if (e.dodge) want = spriteOf(spriteKey(m))?.anims.Dodge ? 'Dodge' : 'Idle'; // the sheets' Hop frames move the sprite around; the hop arc is drawn from e.z instead
  else if (e.hurtT > 0) want = 'Hurt';
  else if (moving) want = 'Walk';
  else if (e.animOnce && e.animT < animLen(animOf(spriteKey(m), e.anim))) want = e.anim;
  if (want !== e.anim) { e.anim = want; e.animT = 0; e.animOnce = !['Idle', 'Walk', 'Sleep'].includes(want); }
}
function statusTick(side, m, dt) {
  m.tickT += dt;
  if (m.tickT < 2) return;
  m.tickT -= 2;
  const share = 2 / TUNE.STATUS_TURN, e = side.ent, w = effWeather();
  if (m.status === 'brn') chip(side, m, m.maxHp / 16 * share, 'brn');
  if (m.status === 'psn') { if (abil(m, 'poisonheal')) heal(m, m.maxHp / 8 * share, e.x, e.y); else chip(side, m, m.maxHp / 8 * share, 'psn'); }
  if (m.status === 'tox') { m.toxN = Math.min(15, m.toxN + share); chip(side, m, m.maxHp * Math.ceil(m.toxN) / 16 * share, 'psn'); }
  if (m.fainted) return;
  if (w === 'sand' && !['Rock', 'Ground', 'Steel'].some(t => hasType(m, t)) && !abil(m, 'sandveil') && !abil(m, 'sandrush') && !abil(m, 'sandforce') && !abil(m, 'overcoat') && !item(m, 'safetygoggles')) chip(side, m, m.maxHp / 16 * share, 'weather');
  if (w === 'snow' && B.field.hail && !hasType(m, 'Ice') && !abil(m, 'icebody') && !abil(m, 'snowcloak') && !abil(m, 'overcoat')) chip(side, m, m.maxHp / 16 * share, 'weather');
  if (w === 'sun' && abil(m, 'solarpower')) chip(side, m, m.maxHp / 8 * share, 'weather');
  if (w === 'sun' && abil(m, 'dryskin')) chip(side, m, m.maxHp / 8 * share, 'weather');
  if (w === 'rain' && (abil(m, 'raindish') || abil(m, 'dryskin'))) heal(m, m.maxHp / (abil(m, 'dryskin') ? 8 : 16) * share, e.x, e.y);
  if (w === 'snow' && abil(m, 'icebody')) heal(m, m.maxHp / 16 * share, e.x, e.y);
  if (w === 'rain' && abil(m, 'hydration') && m.status) m.status = '';
  if (abil(m, 'shedskin') && m.status && Math.random() < 0.33 * share) { m.status = ''; floatText(e.x, e.y - 44 * SS, 'Shed Skin!', '#fff', 11); }
  if (item(m, 'leftovers') || (item(m, 'blacksludge') && hasType(m, 'Poison'))) heal(m, m.maxHp / 16 * share, e.x, e.y);
  if (item(m, 'blacksludge') && !hasType(m, 'Poison')) chip(side, m, m.maxHp / 8 * share, 'item');
  if (B.field.terrain === 'grassy' && grounded(m)) heal(m, m.maxHp / 16 * share, e.x, e.y);
  if (m.vol.seeded) { const by = B.sides[m.vol.seeded - 1], amt = m.maxHp / 8 * share; chip(side, m, amt, 'seed'); const bm = activeMon(by); if (!bm.fainted) heal(bm, amt, by.ent.x, by.ent.y); }
  if (abil(m, 'speedboost')) { m.vol.sb = (m.vol.sb || 0) + share; if (m.vol.sb >= 1) { m.vol.sb = 0; boost(side, m, { spe: 1 }); } }
  if (item(m, 'flameorb') && !m.status) inflict(side, m, 'brn');
  if (item(m, 'toxicorb') && !m.status) inflict(side, m, 'tox');
  if (item(m, 'mentalherb') && m.vol.taunt > 0) { m.vol.taunt = 0; m.item = ''; }
  if (item(m, 'quickclaw') && Math.random() < 0.2 * share * 5) m.vol.quickClaw = 2;
}
function separate() {
  const [a, b] = B.sides.map(s => s.ent), ma = activeMon(B.sides[0]), mb = activeMon(B.sides[1]);
  if (ma.fainted || mb.fainted || a.hidden > 0 || b.hidden > 0) return;
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = (bodyRadius(spriteKey(ma)) + bodyRadius(spriteKey(mb))) * 0.8;
  if (d < min) { const p = (min - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
}
function explodeAt(side, move, x, y, r, opts) {
  ring(x, y, r, TYPE_COLOR[move.type], 0.35, 3);
  burst(x, y - 6, TYPE_COLOR[move.type], 16, 160, 0.4, 3);
  if (move.fx?.hitAnim) spawnFx(move.fx.hitAnim, x, y - 8);
  const foe = foeOf(side), fe = foe.ent;
  if (Math.hypot(fe.x - x, fe.y - y) < r + hurtRadius(foe)) hitFoe(side, move, { x: fe.x, y: fe.y, ox: x, oy: y }, opts);
  for (const rk of B.rocks) if (Math.hypot(rk.x - x, rk.y - y) < r + rk.r) hitRock(rk, move);
  burnGrass(move, x, y, r);
}
function burnGrass(move, x, y, r) {
  if (move.type !== 'Fire') return;
  for (const g of B.grass) if (!g.burnt && Math.hypot(g.x - x, g.y - y) < g.r + r) { g.burnt = true; burst(g.x, g.y, '#ff8a3a', 20, 100, 0.6, 3); decal('scorch', g.x, g.y, g.r * 0.8); }
}
function updateProjectiles(dt) {
  for (const p of B.proj) {
    const side = B.sides[p.side], foe = foeOf(side), fe = foe.ent;
    // sure-hit moves (Swift, Magical Leaf, Shock Wave) bend gently toward the foe
    if (p.home) { const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx), want = Math.atan2(fe.y - 10 * SS - p.y, fe.x - p.x), na = a + clamp(angDiff(want, a), -p.home * dt, p.home * dt); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const [cx, cy] = clampToArena(p.x, p.y);
    let done = p.t >= p.life || cx !== p.x || cy !== p.y;
    for (const rk of B.rocks) if (!done && Math.hypot(p.x - rk.x, p.y - rk.y) < rk.r + p.r * 0.5) { hitRock(rk, p.move); done = true; }
    burnGrass(p.move, p.x, p.y, p.r);
    if (!done && Math.hypot(p.x - fe.x, p.y - (fe.y - 10 * SS - fe.z)) < p.r + hurtRadius(foe) && canHit(foe)) {
      p.dead = true;
      // the rest of a fanned volley just pops once one shot has landed
      if (p.vol) { if (p.vol.hit) { burst(p.x, p.y, TYPE_COLOR[p.move.type], 5, 60, 0.25, 2); continue; } p.vol.hit = true; }
      if (p.move.fx?.explosionRange) explodeAt(side, p.move, p.x, p.y, p.move.fx.explosionRange * TUNE.TILE * 1.2);
      else hitFoe(side, p.move, { x: p.x, y: p.y, ox: p.x - p.vx * 0.1, oy: p.y - p.vy * 0.1 }, { parental: p.parental, mul: p.pow ? 1 + TUNE.CHARGE_DMG * p.pow : 0, charged: p.pow >= 1 });
      p.dead = true; continue;
    }
    if (done) { p.dead = true; if (p.move.fx?.explosionRange) explodeAt(side, p.move, p.x, p.y, p.move.fx.explosionRange * TUNE.TILE * 1.2); else burst(p.x, p.y, TYPE_COLOR[p.move.type], 5, 60, 0.25, 2); }
  }
  B.proj = B.proj.filter(p => !p.dead);
}
// Flowing streams (fire, water, ...): each part of the stream keeps the direction the user was aiming when it was emitted,
// so turning bends the stream and the far end lags behind. Points are 16 px apart; ang[i] is the direction of segment i.
const FLOW_SEG = 16;
function flowPts(b) {
  if (b._ptsT === B.time && b._ptsLen === b.len) return b._pts;
  const h = b.hist || [], pts = [{ x: b.x, y: b.y }], ang = [], n = Math.ceil(b.len / FLOW_SEG), lagK = b.laser.lag / TUNE.LASER.FLOW_SPEED;
  for (let i = 0; i < n; i++) {
    const want = B.time - (i + 0.5) * FLOW_SEG * lagK; let a = h.length ? h[0].a : b.ang;
    for (let j = h.length - 1; j >= 0; j--) if (h[j].t <= want) { a = h[j].a; break; }
    const sl = Math.min(FLOW_SEG, b.len - i * FLOW_SEG); // last piece stops exactly at the beam's end
    ang.push(a); const p = pts[i]; pts.push({ x: p.x + Math.cos(a) * sl, y: p.y + Math.sin(a) * sl });
  }
  b._pts = { pts, ang }; b._ptsT = B.time; b._ptsLen = b.len; return b._pts;
}
// distance along the stream to the first point within rad of (px, py), or -1
function flowHit(b, px, py, rad) {
  const { pts } = flowPts(b);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1], dx = c.x - a.x, dy = c.y - a.y, t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
    if (Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t)) < rad) return (i + t) * FLOW_SEG;
  }
  return -1;
}
function segDist(px, py, x, y, ang, len) {
  const dx = Math.cos(ang), dy = Math.sin(ang), t = clamp((px - x) * dx + (py - y) * dy, 0, len);
  return Math.hypot(px - (x + dx * t), py - (y + dy * t));
}
function updateBeams(dt) {
  for (const b of B.beams) {
    b.t += dt;
    const side = B.sides[b.side], foe = foeOf(side), fe = foe.ent;
    if (b.laser) { updateLaser(b, side, foe, dt); continue; }
    if (!b.hit && b.t < b.dur * 0.7 && segDist(fe.x, fe.y - 10 * SS - fe.z, b.x, b.y, b.ang, b.len) < b.w / 2 + hurtRadius(foe) && canHit(foe)) { b.hit = true; hitFoe(side, b.move, { x: fe.x, y: fe.y, ox: b.x, oy: b.y }); }
    if (!b.rocked) { b.rocked = true; const ex = b.x + Math.cos(b.ang) * (b.len + 6), ey = b.y + Math.sin(b.ang) * (b.len + 6); for (const rk of B.rocks) if (Math.hypot(rk.x - ex, rk.y - ey) < rk.r + 10) hitRock(rk, b.move); burnGrass(b.move, ex, ey, 20); }
  }
  updateClash(dt);
  for (const b of B.beams) if (b.dead || b.t >= b.dur) { b.dead = true; if (B.sides[b.side].ent.laser === b) B.sides[b.side].ent.laser = null; }
  B.beams = B.beams.filter(b => !b.dead);
}
// A channelled laser follows its user, turns toward the aim at its own turn rate, grows out to full length and ticks damage.
function updateLaser(b, side, foe, dt) {
  const e = side.ent, m = activeMon(side), fe = foe.ent, L = b.laser;
  if (b.mon === undefined) b.mon = m;
  if (activeMon(side) !== b.mon || m.fainted || m.status === 'slp' || m.status === 'frz' || !e.act || e.act.move !== b.move) { b.dead = true; return; }
  e.laser = b;
  b.ang += clamp(angDiff(Math.atan2(e.aimY, e.aimX), b.ang), -L.turn * dt, L.turn * dt);
  (b.hist ||= []).push({ t: B.time, a: b.ang }); while (b.hist.length > 2 && b.hist[1].t < B.time - L.histT) b.hist.shift();
  const ax = Math.cos(b.ang), ay = Math.sin(b.ang);
  b.x = e.x + ax * 10; b.y = e.y - 8 * SS + ay * 6;
  const max = rayLen(b.x, b.y, ax, ay, L.len);
  if (!b.clash) b.len = Math.min(max, b.len + TUNE.LASER.SHOOT * dt);
  if ((b.tickT -= dt) > 0) return;
  b.tickT = TUNE.LASER_TICK;
  const ex = b.x + ax * b.len, ey = b.y + ay * b.len;
  for (const rk of B.rocks) if (Math.hypot(rk.x - ex, rk.y - ey) < rk.r + 10 && b.ticks % 3 === 0) hitRock(rk, b.move);
  burnGrass(b.move, ex, ey, 16);
  if (b.clash) return;
  const touching = L.flow ? flowHit(b, fe.x, fe.y - 10 * SS - fe.z, b.w / 2 + hurtRadius(foe)) >= 0 : segDist(fe.x, fe.y - 10 * SS - fe.z, b.x, b.y, b.ang, b.len) < b.w / 2 + hurtRadius(foe);
  if (touching && canHit(foe)) {
    b.ticks++;
    hitFoe(side, b.move, { x: fe.x, y: fe.y, ox: b.x, oy: b.y }, { mul: L.total * TUNE.LASER_TICK / L.dur, tick: b.ticks, multi: b.ticks > 1, kb: 130 });
  }
}
// Two lasers meeting head-on push a contact point toward the weaker side; type matchup (move type vs move type) decides who wins fast.
function beamPower(b) {
  const m = activeMon(B.sides[b.side]), t = moveType(b.move, m), other = B.beams.find(o => o !== b && o.laser && o.clash === b.clash);
  const ot = other ? moveType(other.move, activeMon(B.sides[other.side])) : t;
  let eff = (DEX.typeChart[t] || {})[ot]; if (eff === undefined) eff = 1;
  const stat = b.move.category === 'Physical' ? m.stats.atk * STAGE_MULT(m.stages.atk) : m.stats.spa * STAGE_MULT(m.stages.spa);
  return Math.max(1, b.move.basePower * stat * (hasType(m, t) ? 1.5 : 1) * Math.max(eff, 0.25));
}
function updateClash(dt) {
  const ls = B.beams.filter(b => b.laser && !b.dead);
  const [a, c] = [ls.find(b => b.side === 0), ls.find(b => b.side === 1)];
  if (!a || !c) { for (const b of ls) b.clash = null; return; }
  const head = b => ({ x: b.x + Math.cos(b.ang) * b.len, y: b.y + Math.sin(b.ang) * b.len });
  if (!a.clash) {
    const ha = head(a), hc = head(c), touch = (a.w + c.w) / 2 + 4;
    const hit = segDist(ha.x, ha.y, c.x, c.y, c.ang, c.len) < touch ? ha : segDist(hc.x, hc.y, a.x, a.y, a.ang, a.len) < touch ? hc : null;
    if (!hit) return;
    a.clash = c.clash = { x: hit.x, y: hit.y, fxT: 0 };
    // the moment of impact: freeze-frame, colour flash, shockwave rings and a spray of sparks in both beams' colours
    const ca = TYPE_COLOR[a.move.type], cc = TYPE_COLOR[c.move.type];
    floatText(hit.x, hit.y - 28, 'CLASH!', '#fff', 26); impact(hit.x, hit.y, 0.14); flash(0.18, ca); shake(11); B.cam.punch = Math.max(B.cam.punch, 0.4);
    for (let i = 0; i < 3; i++) after(i * 0.07, () => ring(hit.x, hit.y, 36 + i * 30, [ca, cc, '#fff'][i]));
    sparks(hit.x, hit.y, 0, Math.PI, 14, ca, 420, 0.7); sparks(hit.x, hit.y, 0, Math.PI, 14, cc, 420, 0.7);
  }
  const k = a.clash;
  // a beam swung more than ~30 degrees off the contact point breaks the clash
  if ([a, c].some(b => Math.abs(angDiff(b.ang, Math.atan2(k.y - b.y, k.x - b.x))) > 0.55)) { a.clash = c.clash = null; return; }
  const pa = beamPower(a), pc = beamPower(c), dx = c.x - a.x, dy = c.y - a.y, dl = Math.hypot(dx, dy) || 1;
  const v = (pa - pc) / (pa + pc) * TUNE.BEAM_CLASH_SPEED + Math.sin(B.time * 7) * 12;
  k.x += dx / dl * v * dt; k.y += dy / dl * v * dt;
  for (const b of [a, c]) { b.len = Math.hypot(k.x - b.x, k.y - b.y); b.ang += clamp(angDiff(Math.atan2(k.y - b.y, k.x - b.x), b.ang), -3 * dt, 3 * dt); }
  if ((k.fxT -= dt) <= 0) { k.fxT = 0.07; clashFx(a, c, k); }
  // sustained: constant rumble, sparks thrown out of the contact point, a shockwave ring every beat
  shake(3.5); k.waveT = (k.waveT ?? 0) - dt;
  if (k.waveT <= 0) { k.waveT = 0.28; const col = TYPE_COLOR[(k.alt = !k.alt) ? a.move.type : c.move.type]; ring(k.x, k.y, 34 + Math.random() * 20, col); flash(0.05, col); sparks(k.x, k.y, Math.random() * 6.28, 0.5, 6, col, 380, 0.5); }
  // pushed all the way back: the loser's beam collapses and the winner's carries on into them
  for (const [w, l] of [[a, c], [c, a]]) if (l.len < bodyRadius(spriteKey(activeMon(B.sides[l.side]))) * 0.5 + 6) {
    l.dead = true; w.clash = l.clash = null; B.sides[l.side].ent.act = null;
    burst(k.x, k.y, TYPE_COLOR[w.move.type], 24, 220, 0.5, 3); impact(k.x, k.y, 0.16); flash(0.25, TYPE_COLOR[w.move.type]); shake(16);
    for (let i = 0; i < 3; i++) after(i * 0.06, () => ring(k.x, k.y, 40 + i * 34, i ? TYPE_COLOR[w.move.type] : '#fff')); sparks(k.x, k.y, Math.atan2(l.y - w.y, l.x - w.x), 0.9, 30, TYPE_COLOR[w.move.type], 520, 0.8);
  }
}
// Type pairs get their own pixel effect at the contact point; anything else alternates both moves' hit sprites.
const CLASH_FX = { 'Fire|Water': ['Puff_White', 1.5], 'Electric|Water': ['Spark', 0.6], 'Fire|Grass': ['Puff_Red', 1], 'Fire|Ice': ['Puff_White', 1.2], 'Ice|Water': ['Ice_Pieces', 2] };
function clashFx(a, c, k) {
  const ta = a.move.type, tc = c.move.type, key = [ta, tc].sort().join('|'), sp = CLASH_FX[key];
  if (sp && Math.random() < 0.6) spawnFx(sp[0], k.x + rand(-8, 8), k.y + rand(-8, 8), { scale: SS * sp[1] / 2 });
  else spawnFx((Math.random() < 0.5 ? a : c).move.fx?.hitAnim || 'Hit_Neutral', k.x + rand(-6, 6), k.y + rand(-6, 6), { scale: SS * 0.7 });
  burst(k.x, k.y, TYPE_COLOR[Math.random() < 0.5 ? ta : tc], 3, 140, 0.3, 1);
  if (Math.random() < 0.35) uiBlip(200 + Math.random() * 300, 0.05, 'square', 0.05);
  shake(1.5);
}
function updateAreas(dt) {
  for (const a of B.areas) {
    a.t += dt;
    const side = B.sides[a.side], foe = foeOf(side), fe = foe.ent, m = activeMon(foe);
    const cur = a.r * clamp(a.t / a.dur, 0, 1);
    const d = Math.hypot(fe.x - a.x, fe.y - a.y);
    if (!a.hit && d < cur + hurtRadius(foe)) {
      a.hit = true;
      if (a.ground && !grounded(m)) floatText(fe.x, fe.y - 44 * SS, 'Floating!', '#ccf', 11);
      else if (canHit(foe)) hitFoe(side, a.move, { x: fe.x, y: fe.y, ox: a.x, oy: a.y }, { mul: a.mul });
    }
    if (!a.rocked && a.t >= a.dur) { a.rocked = true; for (const rk of B.rocks) if (Math.hypot(rk.x - a.x, rk.y - a.y) < a.r + rk.r) hitRock(rk, a.move); burnGrass(a.move, a.x, a.y, a.r); }
  }
  B.areas = B.areas.filter(a => a.t < a.dur + 0.15);
}
// Prism Blow (arch 'gust'): the cone follows the user; every tick the foe inside it takes a share of the damage, and the wind shoves it away continuously.
function updateGusts(dt) {
  for (const g of B.gusts) {
    g.t += dt;
    const side = B.sides[g.side], foe = foeOf(side), fe = foe.ent, e = side.ent;
    if (g.t >= g.dur || activeMon(side) !== g.mon || g.mon.fainted || g.mon.status === 'slp' || g.mon.status === 'frz') { g.dead = true; continue; }
    const c = Math.cos(g.ang), s = Math.sin(g.ang), ox = e.x, oy = e.y;
    if ((g.fxT -= dt) <= 0) {
      g.fxT = 0.035;
      for (let i = 0; i < 2; i++) {
        const d = rand(24, g.len), a = g.ang + rand(-g.half, g.half) * Math.min(1, d / 120);
        spawnFx(Math.random() < 0.5 ? 'Petal_Dance_Flower_Pink' : 'Petal_Dance_Flower_Yellow', ox + Math.cos(a) * d, oy - 10 * SS + Math.sin(a) * d * 0.8, { scale: SS, ft: 3 });
      }
      if (Math.random() < 0.3) spawnFx('Gust_Wind', ox + c * rand(40, g.len), oy - 10 * SS + s * rand(40, g.len), { scale: 1, ft: 3 });
    }
    const dx = fe.x - ox, dy = fe.y - oy, d = Math.hypot(dx, dy), hr = hurtRadius(foe);
    const inCone = d < g.len + hr && (d < hr + 20 || Math.abs(angDiff(Math.atan2(dy, dx), g.ang)) < g.half + Math.atan2(hr, Math.max(d, 1)));
    if (!inCone || foe.ent.hidden > 0) continue;
    if (fe.protect <= 0 && canHit(foe)) { fe.kx += c * g.push * 7 * dt; fe.ky += s * g.push * 7 * dt; } // steady shove (kx decays ~7x/s)
    if ((g.tickT -= dt) <= 0) {
      g.tickT = g.dur / 12;
      if (canHit(foe)) { g.ticks++; hitFoe(side, g.move, { x: fe.x, y: fe.y, ox, oy }, { mul: g.mul, tick: g.ticks, multi: g.ticks > 1, kb: 0 }); }
    }
  }
  B.gusts = B.gusts.filter(g => !g.dead);
}
function updateMarks(dt) {
  for (const k of B.marks) {
    k.t += dt;
    if (k.fly && (k.petalT = (k.petalT || 0) - dt) <= 0) { k.petalT = 0.05; spawnFx(Math.random() < 0.5 ? 'Petal_Dance_Flower_Pink' : 'Petal_Dance_Flower_Yellow', k.x + rand(-40, 40), k.y + rand(-30, 20), { scale: SS, ft: 3 }); }
    if (k.land) {
      // Fly's reticle only looks like the homing tell: it glides to wherever the flier is, and the flier lands where the player steers it
      const ue = B.sides[k.side].ent, dx = ue.x - k.x, dy = ue.y - k.y, d = Math.hypot(dx, dy), step = Math.max(k.chase, d * 8) * dt;
      if (d > 0.5) { k.x += dx / d * Math.min(d, step); k.y += dy / d * Math.min(d, step); }
    } else if (k.track && k.t < k.track) {
      const fe = foeOf(B.sides[k.side]).ent, dx = fe.x - k.x, dy = fe.y - k.y, d = Math.hypot(dx, dy), step = k.chase * dt;
      if (d > 0.5) { k.x += dx / d * Math.min(d, step); k.y += dy / d * Math.min(d, step); }
    }
    if (k.t < k.delay) continue;
    k.dead = true;
    const side = B.sides[k.side];
    if (k.kind === 'hazard') placeHazard(side, k.move, k.x, k.y);
    else if (k.kind === 'trap') placeTrap(side, k.move, k.x, k.y, k.r);
    else { explodeAt(side, k.move, k.land ? side.ent.x : k.x, k.land ? side.ent.y : k.y, k.r, k.mul ? { mul: k.mul, multi: k.multi } : undefined); if (k.move.type === 'Electric') { shake(4); spawnFx('Discharge_Hit', k.x, k.y - 10 * SS); } }
    if (k.land && activeMon(side) === k.mon) {
      const e = side.ent; e.hidden = 0; e.flying = false; e.landT = B.time; shake(5); burst(k.x, k.y, '#fff', 16, 160, 0.4, 3);
      if (k.fly) { // Mysterious Wind: gust ring and a hard shove on landing
        const fe = foeOf(side).ent, dx = fe.x - e.x, dy = fe.y - e.y, d = Math.hypot(dx, dy) || 1;
        for (let i = 0; i < 3; i++) after(i * 0.07, () => ring(e.x, e.y - 8 * SS, 40 + i * 30, '#dff'));
        spawnFx('Gust_Wind', e.x, e.y - 10 * SS, { scale: SS * 2 }); sparks(e.x, e.y - 10 * SS, 0, Math.PI, 18, '#bff', 360, 0.6);
        if (d < k.r + hurtRadius(foeOf(side)) + 20 && fe.protect <= 0) { fe.kx += dx / d * k.fly.push; fe.ky += dy / d * k.fly.push; }
      }
    }
  }
  B.marks = B.marks.filter(k => !k.dead);
}
const HAZARD_KIND = { stealthrock: 'stealthrock', spikes: 'spikes', toxicspikes: 'toxicspikes', stickyweb: 'stickyweb', gmaxsteelsurge: 'stealthrock' };
function placeHazard(side, move, x, y) {
  const kind = HAZARD_KIND[toId(move.sideCondition)] || HAZARD_KIND[move.id];
  if (!kind) return;
  const mine = B.hazards.filter(h => h.owner === side.idx && h.kind === kind);
  const cap = kind === 'stealthrock' ? 6 : 3;
  if (kind === 'stealthrock') {
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + Math.random(); B.hazards.push({ owner: side.idx, kind, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 12, r: 9, cd: 0, seed: Math.random() }); }
  } else B.hazards.push({ owner: side.idx, kind, x, y, r: kind === 'stickyweb' ? 40 : 30, cd: 0, seed: Math.random() });
  const all = B.hazards.filter(h => h.owner === side.idx && h.kind === kind);
  while (all.length > cap) { const old = all.shift(); B.hazards.splice(B.hazards.indexOf(old), 1); }
  ring(x, y, 24, TYPE_COLOR[move.type], 0.3, 2);
}
function updateHazards(dt) {
  for (const s of B.sides) {
    const m = activeMon(s), e = s.ent;
    if (m.fainted || e.hidden > 0 || item(m, 'heavydutyboots')) continue;
    for (const h of B.hazards) {
      if (h.owner === s.idx || h.dead) continue;
      h.cd -= dt;
      if (Math.hypot(h.x - e.x, h.y - e.y) > h.r + 4 || h.cd > 0) continue;
      if (h.kind === 'stealthrock') { chip(s, m, m.maxHp * 0.06 * typeEff('Rock', m), 'hazard'); h.dead = true; burst(h.x, h.y - 8 * SS, '#a89070', 10, 120, 0.4, 3); uiBlip(140, 0.08, 'square'); }
      else if (!grounded(m)) continue;
      else if (h.kind === 'spikes') { chip(s, m, m.maxHp * 0.04, 'hazard'); h.cd = 1.5; burst(e.x, e.y, '#bbb', 5, 70, 0.3, 2); }
      else if (h.kind === 'toxicspikes') { if (hasType(m, 'Poison')) { h.dead = true; floatText(e.x, e.y - 44 * SS, 'Absorbed spikes', '#d8f', 11); } else { inflict(s, m, 'psn'); h.cd = 1; } }
    }
  }
  B.hazards = B.hazards.filter(h => !h.dead);
}

// ---------- field traps (arch 'trap', drawn by src/fieldfx.js) ----------
// A lingering patch at the aimed spot (powders, gas, smoke, seeds, webs, fire/sand/water vortexes). Its effect lands on a foe
// the moment it steps in and again every `every` s while it stays. A status cloud collapses once its status lands.
const TRAP_COL = { slp: '#7d8cff', par: '#ffe14a', psn: '#d070ff', tox: '#b45cff', brn: '#ff7a2a', confusion: '#ff8ad8', leechseed: '#6fe36f' };
const inTrap = (t, e) => Math.hypot((e.x - t.x) / t.r, (e.y - t.y) / (t.r * 0.62)) < 1;
function placeTrap(side, move, x, y, r) {
  const bh = behaviour(move), dmg = move.category !== 'Status';
  const col = dmg ? TYPE_COLOR[move.type] : TRAP_COL[move.status || move.volatileStatus] || (move.boosts ? '#ff6b6b' : TYPE_COLOR[move.type]);
  // one live trap per move per side: recasting moves it
  B.traps = B.traps.filter(t => !(t.side === side.idx && t.move === move));
  B.traps.push({ side: side.idx, move, x, y, r, t: 0, dur: bh.dur || 5, every: bh.every || 2, mul: dmg ? (bh.mul || 1) : 0, pull: bh.pull || 0, slow: bh.slow || 0,
    ground: moveType(move, activeMon(side)) === 'Ground' || ['grassknot', 'stringshot', 'electroweb', 'toxic', 'leechseed'].includes(move.id),
    fx: bh.fx || [move.fx?.anims?.[0] || 'Puff_' + fxColor(col)], big: bh.huge || '', col, cd: 0, n: 0, seed: Math.random() * 1e4, fxT: 0 });
  ring(x, y, r, col); burst(x, y, col, 14); shake(1.5);
}
function updateTraps(dt) {
  for (const t of B.traps) {
    t.t += dt; if (t.flashT > 0) t.flashT -= dt;
    const side = B.sides[t.side], foe = foeOf(side), fe = foe.ent, fm = activeMon(foe);
    // bits drift up out of the patch, drawn over the mons, so it still reads when someone stands in it
    if ((t.fxT -= dt) <= 0) { t.fxT = 0.12; const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * t.r * 0.85; spawnFx(t.fx[0], t.x + Math.cos(a) * d, t.y + Math.sin(a) * d * 0.62 - rand(4, 14) * SS, { scale: sheetScale(t.fx[0]), ft: 4 }); }
    if (fm.fainted || fe.hidden > 0 || (t.ground && !grounded(fm)) || !inTrap(t, fe)) { t.inside = false; continue; }
    if (t.pull) { const dx = t.x - fe.x, dy = t.y - fe.y, l = Math.hypot(dx, dy) || 1; fe.x += dx / l * Math.min(l, t.pull * dt); fe.y += dy / l * Math.min(l, t.pull * dt); }
    if (!t.inside || (t.cd -= dt) <= 0) { t.inside = true; t.cd = t.every; trapTouch(t, side, foe); }
  }
  B.traps = B.traps.filter(t => t.t < t.dur);
}
function trapTouch(t, side, foe) {
  const mv = t.move, m = activeMon(side), fm = activeMon(foe), fe = foe.ent, type = moveType(mv, m);
  if (!canHit(foe)) return;
  // immune or nothing left to do: stay quiet instead of spamming "No effect" every tick
  if (immunity(m, fm, mv, type) || (t.mul && typeEff(type, fm, mv) === 0)) { if (!t.told) { t.told = true; floatText(fe.x, fe.y - 44 * SS, 'Immune', '#ccf', 11); } return; }
  if (!t.mul && ((mv.status && statusImmune(fm, mv.status, foe)) || (mv.volatileStatus === 'confusion' && fm.vol.confused > 0) || (mv.volatileStatus === 'leechseed' && (fm.vol.seeded || hasType(fm, 'Grass'))))) return;
  t.n++; t.flashT = 0.22;
  const landed = hitFoe(side, mv, { x: fe.x, y: fe.y, ox: t.x, oy: t.y }, t.mul ? { mul: t.mul, tick: t.every < 1 ? t.n : 0, multi: t.every < 1 && t.n > 1 } : {});
  if (landed && !t.mul && (mv.status || mv.volatileStatus)) t.dur = Math.min(t.dur, t.t + 0.5);
}

// ---------- waves (arch 'wave', drawn by src/fieldfx.js) ----------
// A wide front that rolls forward from the user and hits once: Surf, Muddy Water, Icy Wind, Heat Wave, sound waves. Some shove.
function waveSheet(move) { const n = move.fx?.anims?.[0], p = n && VFX.particles[n]; return p && p.fw <= 48 ? n : 'Puff_' + fxColor(TYPE_COLOR[move.type]); }
const sheetScale = name => (VFX.particles[name]?.fw || 32) <= 20 ? SS : 1;
function waveBow(w, u) { const q = u / (w.w / 2); return -q * q * w.w * 0.3; } // wave front is an arc: the middle leads (used by the hitbox and src/fieldfx.js)
function updateWaves(dt) {
  for (const w of B.waves) {
    w.t += dt;
    const side = B.sides[w.side], foe = foeOf(side), fe = foe.ent, fm = activeMon(foe);
    const c = Math.cos(w.ang), s = Math.sin(w.ang), front = Math.min(w.len, w.spd * w.t);
    if (w.spd * w.t >= w.len + 40) { w.dead = true; continue; }
    if ((w.fxT -= dt) <= 0) { w.fxT = 0.07; const k = rand(-0.5, 0.5) * w.w, nm = waveSheet(w.move), f = front + waveBow(w, k); spawnFx(nm, w.x + c * f - s * k, w.y + s * f + c * k - 8 * SS, { scale: sheetScale(nm), ft: 3 }); }
    for (const rk of B.rocks) if (!w.rocks.has(rk) && Math.abs((rk.x - w.x) * c + (rk.y - w.y) * s - front) < 12 && Math.abs(-(rk.x - w.x) * s + (rk.y - w.y) * c) < w.w / 2) { w.rocks.add(rk); hitRock(rk, w.move); }
    burnGrass(w.move, w.x + c * front, w.y + s * front, w.w / 3);
    const rx = fe.x - w.x, ry = fe.y - w.y, along = rx * c + ry * s, u = -rx * s + ry * c, perp = Math.abs(u), hr = hurtRadius(foe), arc = front + waveBow(w, clamp(u, -w.w / 2, w.w / 2));
    if (w.hit || along < arc - 34 - hr || along > arc + hr || perp > w.w / 2 + hr || !canHit(foe)) continue;
    w.hit = true;
    if (moveType(w.move, activeMon(side)) === 'Ground' && !grounded(fm)) { floatText(fe.x, fe.y - 44 * SS, 'Floating!', '#ccf', 11); continue; }
    if (w.push && fe.protect <= 0) { fe.kx += c * w.push; fe.ky += s * w.push; }
    if (w.pushOnly) { floatText(fe.x, fe.y - 44 * SS, 'Blown away!', '#fff', 12); burst(fe.x, fe.y - 10 * SS, '#fff', 14); }
    else hitFoe(side, w.move, { x: fe.x, y: fe.y, ox: fe.x - c * 60, oy: fe.y - s * 60 });
  }
  B.waves = B.waves.filter(w => !w.dead);
}

// ---------- arena sweeps (arch 'sweep', drawn by src/fieldfx.js) ----------
// A whole-arena front (Surf, Earthquake, Heat Wave, ...) that enters from beyond the edge behind the aim, after a warning
// band on that edge, and sweeps the full fighting area along the aim (snapped to the 4 axes so the pixels stay square).
// Some leave safe gaps; solid ones must be rolled through (i-frames) or Protected. Hits the caster's foe once, never the caster.
// Combos: water/mud douses Fire traps and soaks the floor (Electric hits harder for a while); quakes shatter rocks;
// heat burns tall grass and dries the floor; every sweep shoves the foe along, into whatever traps or hazards lie ahead.
const WET_SWEEPS = new Set(['water', 'mud']);
function startSweep(side, move, ax, ay, sc) {
  const bh = behaviour(move), ar = B.arena, horiz = Math.abs(ax) >= Math.abs(ay), dir = (horiz ? Math.sign(ax) : Math.sign(ay)) || 1;
  const lo = ar.wall, hi = horiz ? ar.w - ar.wall : ar.h - ar.wall, plo = ar.wall, phi = horiz ? ar.h - ar.wall : ar.w - ar.wall;
  const n = bh.gaps || 0, gw = (bh.gapW || 80) / Math.max(sc, 0.6), gaps = [];
  // one gap per equal slice of the span, randomised inside it, so gaps never overlap
  for (let i = 0; i < n; i++) { const c = plo + (phi - plo) / n * (i + rand(0.25, 0.75)); gaps.push([c - gw / 2, c + gw / 2]); }
  const depth = bh.depth || 90;
  B.sweeps.push({ side: side.idx, move, kind: bh.kind || 'water', horiz, dir, u: dir > 0 ? lo - 24 : hi + 24, end: dir > 0 ? hi + depth + 24 : lo - depth - 24, entry: dir > 0 ? lo : hi,
    gaps, spd: bh.spd || 300, thick: bh.thick || 30, depth, push: bh.push || 0, warn: bh.warn || 0.8, t: 0, hit: false, fxT: 0 });
}
// Earthquake leaves fissures that stay behind the front and rocks that are thrown up and bounce; both are drawn analytically from their spawn time (see fieldfx.js)
function quakeDebris(w) {
  const wall = B.arena.wall, span = w.horiz ? B.arena.h : B.arena.w, cr = w.cr ||= [], rk = w.rk ||= [];
  for (let i = 0; i < 2; i++) {
    const p = rand(wall, span - wall); if (inSweepGap(w, p)) continue;
    const x = w.horiz ? w.u - w.dir * rand(0, 30) : p, y = w.horiz ? p : w.u - w.dir * rand(0, 30);
    cr.push({ x, y, ts: B.time, seed: Math.random() * 1e4, len: rand(46, 110) });
    if (Math.random() < 0.7) rk.push({ x, y, ts: B.time, seed: Math.random() * 1e4, vx: (w.horiz ? w.dir : 0) * rand(40, 120) + rand(-50, 50), vy: (w.horiz ? 0 : w.dir) * rand(40, 120) + rand(-50, 50) });
  }
  while (cr.length > 50) cr.shift(); while (rk.length > 44) rk.shift();
}
const inSweepGap = (w, p) => w.gaps.some(([a, b]) => p > a + 4 && p < b - 4);
function updateSweeps(dt) {
  if (B.soakT > 0) B.soakT -= dt;
  for (const w of B.sweeps) {
    if (w.dead) continue;
    w.t += dt;
    if (w.t < w.warn) continue;
    const prev = w.u; w.u += w.dir * w.spd * dt;
    if ((w.u - w.end) * w.dir >= 0) { w.dead = true; if (WET_SWEEPS.has(w.kind)) B.soakT = 7; continue; }
    shake(w.kind === 'quake' ? 3.5 : 2);
    const side = B.sides[w.side], foe = foeOf(side), fe = foe.ent, fm = activeMon(foe);
    const along = o => w.horiz ? o.x : o.y, across = o => w.horiz ? o.y : o.x;
    const passed = o => (along(o) - prev) * w.dir >= -6 && (along(o) - w.u) * w.dir < 6 && !inSweepGap(w, across(o));
    // spray / debris along the crest
    if ((w.fxT -= dt) <= 0) {
      w.fxT = 0.05;
      const p = rand(B.arena.wall, w.horiz ? B.arena.h - B.arena.wall : B.arena.w - B.arena.wall);
      if (!inSweepGap(w, p)) { const nm = { water: 'Puff_White', mud: 'Puff_Brown', sludge: 'Bubbles_Purple', quake: 'Rock_Pieces', heat: 'Lava_Plume_Fire' }[w.kind] || 'Puff_White', x = w.horiz ? w.u : p, y = w.horiz ? p : w.u; spawnFx(nm, x, y - 10 * SS, { scale: sheetScale(nm), ft: 3 }); if (w.kind === 'quake') { if (Math.random() < 0.3) decal('crack', x, y, 30); spawnFx('Puff_Brown', x, y - 4 * SS, { scale: SS }); } }
      if (w.kind === 'quake') quakeDebris(w);
    }
    // field combos as the front passes
    for (const rk of B.rocks) if (w.kind === 'quake' && passed(rk)) { hitRock(rk, w.move); hitRock(rk, w.move); }
    for (const g of B.grass) if (w.kind === 'heat' && !g.burnt && passed(g)) { g.burnt = true; burst(g.x, g.y, '#ff8a3a', 20); decal('scorch', g.x, g.y, g.r * 0.8); }
    if (w.kind === 'heat') B.soakT = 0;
    if (WET_SWEEPS.has(w.kind)) for (const t of B.traps) if (t.move.type === 'Fire' && passed(t)) { t.dur = 0; burst(t.x, t.y, '#fff', 25); floatText(t.x, t.y - 20, 'Doused!', '#bfe8ff', 12); }
    // the foe: once, unless it is in a gap, floating over a quake, or rolling through on i-frames
    if (w.hit || fm.fainted) continue;
    const d = (w.u - along(fe)) * w.dir;
    if (d < 0 || d > w.thick || inSweepGap(w, across(fe))) continue;
    if (w.kind === 'quake' && !grounded(fm)) { w.hit = true; floatText(fe.x, fe.y - 44 * SS, 'Floating!', '#ccf', 11); continue; }
    if (!canHit(foe)) { if (fe.dodge && !w.dodged) { w.dodged = true; floatText(fe.x, fe.y - 40 * SS, 'Dodged!', '#bdf', 11); } continue; }
    w.hit = true;
    const ux = w.horiz ? w.dir : 0, uy = w.horiz ? 0 : w.dir;
    if (hitFoe(side, w.move, { x: fe.x, y: fe.y, ox: fe.x - ux * 60, oy: fe.y - uy * 60 }) && w.push) { fe.kx += ux * w.push; fe.ky += uy * w.push; }
  }
  for (const w of B.sweeps) if (w.cr) { w.cr = w.cr.filter(c => B.time - c.ts < 4); w.rk = w.rk.filter(r => B.time - r.ts < 2.4); }
  B.sweeps = B.sweeps.filter(w => !w.dead || ((w.cr?.length || w.rk?.length) && B.time - (w.endT ??= B.time) < 4));
}
function confirmChoose() {
  if (B.guest) { NETSYNC.send({ t: 'pick', sel: B.choose.sel }); B.choose = null; return; }
  const c = B.choose, side = B.sides[c.side];
  if (!side.team[c.sel] || side.team[c.sel].fainted) c.sel = side.team.findIndex(m => !m.fainted);
  B.choose = null; sendOut(side, c.sel);
}

// ---------- CPU ----------
const AI_TIERS = {
  easy: { react: 0.6, aimErr: 0.4, lead: 0, dodge: 0.08, iq: 0.3, swap: 0, strafe: 0.3 },
  normal: { react: 0.38, aimErr: 0.2, lead: 0.5, dodge: 0.3, iq: 0.65, swap: 0.35, strafe: 0.6 },
  hard: { react: 0.22, aimErr: 0.09, lead: 0.85, dodge: 0.6, iq: 0.9, swap: 0.7, strafe: 0.85 },
  champion: { react: 0.13, aimErr: 0.04, lead: 1, dodge: 0.82, iq: 1, swap: 0.9, strafe: 1 },
};
function expectedFrac(att, def, move) {
  if (move.category === 'Status') return 0;
  const r = calcDamage(att, def, move, { avg: true, noCrit: true });
  return r.dmg / def.maxHp;
}
function moveValue(side, slot) {
  const m = activeMon(side), foe = foeOf(side), fm = activeMon(foe), mv = m.moves[slot], arch = archetype(mv), bh = behaviour(mv);
  // a trap of this move is already out: let it work instead of recasting it
  const trapOut = arch === 'trap' && B.traps.some(t => t.side === side.idx && t.move === mv && t.dur - t.t > 1);
  // damaging traps tick several times on a foe that stays in them
  const trapMul = arch === 'trap' ? (trapOut ? 0.2 : (bh.mul || 1) * Math.min(4, 1 + 1.6 / (bh.every || 2))) : 1;
  if (mv.category !== 'Status') return expectedFrac(m, fm, mv) * (mv.multihit ? 2.5 : 1) / Math.max(1, cooldownFor(mv, m) / 4) * (arch === 'area' || arch === 'wave' ? 1.2 : arch === 'sweep' ? 2.2 : 1) * trapMul; // a sweep reaches anywhere, which pays for its long cooldown
  const hp = m.hp / m.maxHp;
  if (mv.heal || ['synthesis', 'morningsun', 'moonlight', 'rest'].includes(mv.id)) return hp < 0.5 ? 0.12 : 0;
  if (PROTECTS.has(mv.id)) return 0;
  if (mv.id === 'transform') return fm.moves.some(x => x.id !== 'transform' && x.category !== 'Status') ? 0.5 : 0;
  if (trapOut) return 0.005;
  // trap clouds are big and linger, so they land far more often than a plain status shot
  if (mv.status) return fm.status || statusImmune(fm, mv.status, foe) ? 0 : arch === 'trap' ? 0.1 : 0.07;
  if (arch === 'trap' && mv.boosts) return 0.05;
  if (mv.target === 'foeSide') return B.hazards.filter(h => h.owner === side.idx).length < 3 ? 0.05 : 0;
  if (mv.boosts && SELF_TARGETS.has(mv.target)) return hp > 0.6 && Object.keys(mv.boosts).some(k => m.stages[k] < 2) ? 0.08 : 0;
  if (mv.boosts) return 0.03;
  if (mv.weather) return B.field.weather ? 0 : 0.04;
  if (mv.terrain) return B.field.terrain ? 0 : 0.04;
  if (mv.sideCondition) return side.screens[toId(mv.sideCondition)] > 0 ? 0 : 0.05;
  if (mv.volatileStatus === 'confusion') return fm.vol.confused > 0 ? 0 : 0.04;
  return 0.02;
}
function effRange(move) {
  const a = archetype(move);
  if (a === 'laser') return LASERS[move.id].len * 0.85;
  if (a === 'strike') return rangePx(move, 120) * 1.1;
  const bh = behaviour(move);
  if (bh.range) return bh.range;
  if (a === 'trap') return (bh.range || 240) * 0.85;
  if (a === 'wave') return (bh.len || 260) * 0.8;
  if (a === 'sweep') return 9999;
  if (a === 'lunge') return 150 * (bh.dist || 1) + 20;
  if (a === 'melee') return 34 + TUNE.MELEE.REACH * 0.6 + (bh.reach || 0);
  return a === 'area' ? areaRadius(move) * 0.8 : a === 'dash' ? rangePx(move, 90) * 0.9 : a === 'self' ? 9999 : rangePx(move, 120) * 0.85;
}
function cpuPickSwap(side, forced) {
  const foe = foeOf(side), fm = activeMon(foe);
  // default to any healthy bench mon so a NaN score can never leave a forced swap with nobody
  let best = side.team.findIndex((m, i) => !m.fainted && i !== side.cur), bs = -1e9;
  side.team.forEach((m, i) => {
    if (m.fainted || i === side.cur) return;
    let s = Math.max(...m.moves.map(mv => expectedFrac(m, fm, mv)), 0);
    const threat = Math.max(...fm.moves.map(mv => expectedFrac(fm, m, mv)), 0);
    s = s - threat * 0.8 + m.hp / m.maxHp * 0.2;
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}
function cpuThink(side, dt) {
  const T = AI_TIERS[side.tier] || AI_TIERS.normal, ai = side.ai, e = side.ent, m = activeMon(side), I = side.intent;
  const foe = foeOf(side), fe = foe.ent, fm = activeMon(foe);
  I.use = -1; I.dodge = false; I.mega = false;
  if (m.fainted) return;
  const dx = fe.x - e.x, dy = fe.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.hidden > 0 && e.flying) { I.mx = dx / d; I.my = dy / d; return; } // a CPU in the sky flies straight at the foe
  // CPU charges shots from range, where the telegraph matters less
  const ca = e.act; I.hold = -1;
  if (ca?.canCharge) { if (ca.cpuHold === undefined) ca.cpuHold = d > 260 && Math.random() < 0.3 + T.iq * 0.5 ? rand(0.3, TUNE.CHARGE_MAX) : 0; if (ca.t - ca.wind < ca.cpuHold) I.hold = ca.slot; }
  // threats: dodge on reaction
  for (const p of B.proj) {
    if (p.side === side.idx || ai.dodged.has(p)) continue;
    const rx = e.x - p.x, ry = e.y - p.y, closing = rx * p.vx + ry * p.vy > 0, tti = Math.hypot(rx, ry) / Math.hypot(p.vx, p.vy);
    if (closing && tti < 0.35 + T.react * 0.3 && segDist(e.x, e.y, p.x, p.y, Math.atan2(p.vy, p.vx), 200) < 26) {
      ai.dodged.add(p);
      if (Math.random() < T.dodge) { I.dodge = true; I.mx = -p.vy; I.my = p.vx; const l = Math.hypot(I.mx, I.my) || 1; I.mx /= l; I.my /= l; return; }
    }
  }
  for (const k of B.marks) {
    if (k.side === side.idx || ai.dodged.has(k) || Math.hypot(k.x - e.x, k.y - e.y) > k.r + 14) continue;
    // tracking reticles: run while it chases, roll out right after it locks
    if (k.track) { if (k.t < k.track) { ai.flee = { x: e.x - k.x || 1, y: e.y - k.y, t: 0.15 }; continue; } ai.dodged.add(k); if (Math.random() < T.dodge && k.delay - k.t > 0.08) { I.dodge = true; I.mx = e.x - k.x || 1; I.my = e.y - k.y; return; } continue; }
    ai.dodged.add(k); if (Math.random() < T.dodge + 0.2) ai.flee = { x: e.x - k.x, y: e.y - k.y, t: 0.5 };
  }
  // step out of an enemy laser's line
  for (const b of B.beams) {
    if (!b.laser || b.side === side.idx || segDist(e.x, e.y - 10 * SS, b.x, b.y, b.ang, b.len + 40) > b.w / 2 + 30) continue;
    const px = -Math.sin(b.ang), py = Math.cos(b.ang), sgn = (e.x - b.x) * px + (e.y - b.y) * py >= 0 ? 1 : -1;
    ai.flee = { x: px * sgn, y: py * sgn, t: 0.25 };
    if (!ai.dodged.has(b)) { ai.dodged.add(b); if (Math.random() < T.dodge * 0.7) { I.dodge = true; I.mx = px * sgn; I.my = py * sgn; return; } }
  }
  // roll through an incoming wave front
  for (const w of B.waves) {
    if (w.side === side.idx || w.hit || ai.dodged.has(w)) continue;
    const c = Math.cos(w.ang), s = Math.sin(w.ang), rx = e.x - w.x, ry = e.y - w.y, gap = rx * c + ry * s - w.spd * w.t;
    if (gap > 0 && gap < 30 + T.react * 60 && Math.abs(-rx * s + ry * c) < w.w / 2 + 20) { ai.dodged.add(w); if (Math.random() < T.dodge) { I.dodge = true; I.mx = -c; I.my = -s; return; } }
  }
  // walk out of enemy trap clouds
  for (const t of B.traps) if (t.side !== side.idx && inTrap({ x: t.x, y: t.y, r: t.r + 10 }, e)) { ai.flee = { x: e.x - t.x || 1, y: e.y - t.y, t: 0.2 }; break; }
  // arena sweeps: hold still in a gap, run to one if it can be reached in time, else roll into the front just before it lands
  for (const w of B.sweeps) {
    // one roll per sweep against the tier's dodge skill decides whether this CPU reacts at all
    if (w.side === side.idx || w.hit || (w.kind === 'quake' && !grounded(m)) || (w.cpuRoll ??= Math.random()) > T.dodge) continue;
    const pos = w.horiz ? e.y : e.x, dist = ((w.horiz ? e.x : e.y) - w.u) * w.dir, tta = dist / w.spd + Math.max(0, w.warn - w.t);
    if (dist < -w.thick) continue;
    if (inSweepGap(w, pos)) { ai.flee = { x: 0, y: 0, t: 0.1 }; continue; }
    const g = w.gaps.map(([a, b]) => (a + b) / 2).sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos))[0];
    if (g !== undefined && Math.abs(g - pos) / moveSpeed(m, side) < tta - 0.1) { const sg = Math.sign(g - pos); ai.flee = { x: w.horiz ? 0 : sg, y: w.horiz ? sg : 0, t: 0.1 }; continue; }
    if (dist > 0 && tta < 0.14 && !ai.dodged.has(w)) { ai.dodged.add(w); if (side.dodgeCd <= 0) { I.dodge = true; I.mx = w.horiz ? -w.dir : 0; I.my = w.horiz ? 0 : -w.dir; return; } }
  }
  if (fe.act && !fe.act.fired && !ai.dodged.has(fe.act) && d < effRange(fe.act.move) + 20) { ai.dodged.add(fe.act); if (Math.random() < T.dodge * 0.8 && fe.act.wind - fe.act.t < 0.25) { I.dodge = true; I.mx = -dy / d; I.my = dx / d; } }
  if (ai.dodged.size > 60) ai.dodged.clear();

  ai.thinkT -= dt;
  if (ai.thinkT <= 0) {
    ai.thinkT = T.react * rand(0.7, 1.3);
    // swap out of bad matchups
    if (Math.random() < T.swap && side.swapCd <= 0 && B.time - ai.lastSwap > 12 && m.hp / m.maxHp > 0.3 && !trapped(side)) {
      const threat = Math.max(...fm.moves.map(mv => expectedFrac(fm, m, mv)), 0), mine = Math.max(...m.moves.map(mv => expectedFrac(m, fm, mv)), 0);
      if (threat > mine * 1.8 && threat > 0.06) { const i = cpuPickSwap(side); if (i >= 0) { ai.lastSwap = B.time; doSwap(side, i); return; } }
    }
    // choose the move to work towards
    let best = -1, bv = 0;
    m.moves.forEach((mv, i) => {
      if (!canUse(side, i) && m.cds[i] > 1.5) return;
      let v = moveValue(side, i) * (1 + (Math.random() - 0.5) * (1 - T.iq) * 2);
      if (m.cds[i] > 0) v *= 0.5;
      if (v > bv) { bv = v; best = i; }
    });
    ai.moveSlot = best;
    ai.wantDist = best >= 0 ? clamp(effRange(m.moves[best]) * 0.75, 26, 220) : 120;
    if (Math.random() < 0.15) ai.strafe = -ai.strafe;
  }
  // aim with lead and error
  const mv = m.moves[ai.moveSlot];
  const spd = mv ? projSpeed(mv) : 400;
  const lead = archetype(mv || {}) === 'projectile' ? T.lead * d / spd : T.lead * 0.3;
  let tx = fe.x + fe.vx * lead - e.x, ty = fe.y + fe.vy * lead - e.y;
  const err = (ai.errSeed = (ai.errSeed || 0) + dt * 0.7, Math.sin(ai.errSeed * 3.1) * T.aimErr);
  const a = Math.atan2(ty, tx) + err;
  e.aimX = Math.cos(a); e.aimY = Math.sin(a); e.aimIdle = 0;
  // movement: hold preferred distance and strafe
  let mx = 0, my = 0;
  if (ai.flee && (ai.flee.t -= dt) > 0) { const l = Math.hypot(ai.flee.x, ai.flee.y) || 1; mx = ai.flee.x / l; my = ai.flee.y / l; }
  else {
    const want = ai.wantDist, k = clamp((d - want) / 60, -1, 1);
    mx = dx / d * k + (-dy / d) * ai.strafe * T.strafe * 0.7;
    my = dy / d * k + (dx / d) * ai.strafe * T.strafe * 0.7;
    // avoid walls
    const ar = B.arena, mgn = ar.wall + 40;
    if (e.x < mgn) mx += 1; if (e.x > ar.w - mgn) mx -= 1; if (e.y < mgn) my += 1; if (e.y > ar.h - mgn) my -= 1;
    // avoid enemy hazards
    for (const h of B.hazards) if (h.owner !== side.idx && Math.hypot(h.x - e.x, h.y - e.y) < h.r + 24) { mx += (e.x - h.x) / 30; my += (e.y - h.y) / 30; }
    // ...and steer around enemy trap clouds before walking into them
    for (const t of B.traps) if (t.side !== side.idx && inTrap({ x: t.x, y: t.y, r: t.r + 40 }, e)) { const l = Math.hypot(e.x - t.x, e.y - t.y) || 1; mx += (e.x - t.x) / l * 1.5; my += (e.y - t.y) / l * 1.5; }
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  }
  if (I.dodge) return;
  I.mx = mx; I.my = my; ai.faceMove = !mv;
  // fire when in range
  if (mv && canUse(side, ai.moveSlot) && d < effRange(mv) + 10 && Math.random() < 0.6 + T.iq * 0.4) I.use = ai.moveSlot;
  else if (!mv || !canUse(side, ai.moveSlot)) {
    // opportunistic: any ready damaging move in range
    for (let i = 0; i < m.moves.length; i++) if (canUse(side, i) && m.moves[i].category !== 'Status' && d < effRange(m.moves[i]) && Math.random() < T.iq * 0.25) { I.use = i; break; }
  }
  if (!side.megaUsed && megaTarget(m) && Math.random() < 0.02) I.mega = true;
}

// Old synth blips now play real game SFX, picked by the pitch the caller asked for (no generated sounds).
function uiBlip(freq = 440, len, type, vol = 0.12) { AUDIO.gen(len <= 0.05 || freq === 700 ? 'uiBlip' : freq >= 600 ? 'statUp' : freq < 200 ? 'hit' : 'hitWeak', Math.min(1, vol * 4)); }
function hitSound(frac, eff, x) { AUDIO.gen(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit', 0.45 + frac, x); }
