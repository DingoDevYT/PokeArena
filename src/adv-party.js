// Party, growth and catching (W1c): EXP curves, Gen 5 EXP gain, Gen 3+ catch formula, new mons, level-up moves, evolutions, bag items.
// Pure logic over DEX + ADV_DEX (+ makeMon / hpScale from battle.js) so tools/adv-check.mjs can run it in node; screens live in adv-ui.js, the flow in adv-scene.js.
// A party mon is a team-builder set plus { hp, status, exp, friend, ball, nickname, ot }; hp is in battle units (the sim's maxHp), 0 = fainted.
'use strict';
const ADVP = {
  rnd: Math.random, mc: {},
  info: id => window.ADV_DEX?.[id] || {},
  cap: s => s[0].toUpperCase() + s.slice(1),
  name: s => s.nickname || DEX.species[toId(s.species)]?.name || s.species,

  // ---------- growth ----------
  CURVE: {
    fast: n => 4 * n ** 3 / 5, mediumfast: n => n ** 3, slow: n => 5 * n ** 3 / 4,
    mediumslow: n => 6 * n ** 3 / 5 - 15 * n * n + 100 * n - 140,
    erratic: n => n ** 3 * (n <= 50 ? (100 - n) / 50 : n <= 68 ? (150 - n) / 100 : n <= 98 ? (1274 + (n % 3) ** 2 - 9 * (n % 3) - 20 * Math.floor(n / 3)) / 1000 : (160 - n) / 100),
    fluctuating: n => n ** 3 * (n <= 15 ? Math.floor((n + 1) / 3) + 24 : n <= 35 ? n + 14 : Math.floor(n / 2) + 32) / 50,
  },
  rate(id) { return this.info(id).growthRate || 'mediumfast'; },
  expFor(rate, n) { return n <= 1 ? 0 : Math.max(0, Math.floor(this.CURVE[rate](n))); }, // total EXP a mon of this growth rate has at level n
  levelFor(rate, exp) { for (let n = 100; n > 1; n--) if (exp >= this.expFor(rate, n)) return n; return 1; },
  // Gen 5 scaled formula; split = number of mons sharing it, a trainer fight pays 1.5x
  PACE: 1.5,   // a real-time fight takes longer than a turn, so each one is worth half again the mainline EXP (applied where it is awarded, adv-scene.js)
  expGain(base, foeLv, myLv, split = 1, trainer = false) { return Math.floor((trainer ? 1.5 : 1) * base * foeLv / (5 * split) * ((2 * foeLv + 10) / (foeLv + myLv + 10)) ** 2.5 + 1); },

  // ---------- catching ----------
  STATUS_MULT: { slp: 2, frz: 2, par: 1.5, psn: 1.5, tox: 1.5, brn: 1.5 },
  // a = (3 maxHP - 2 HP) * rate * ball / (3 maxHP) * status, 255 and up always catches
  catchA(maxHp, hp, rate, ball = 1, status = '') {
    if (ball >= 255) return 255;
    return Math.max(1, Math.min(255, Math.floor(Math.floor((3 * maxHp - 2 * hp) * rate * ball / (3 * maxHp)) * (this.STATUS_MULT[status] || 1))));
  },
  shakeB: a => a >= 255 ? 65536 : Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a)))))),
  catchProb(a) { return a >= 255 ? 1 : (this.shakeB(a) / 65536) ** 4; },
  // four shake checks; the ball visibly wiggles 0..3 times and the 4th check is the click
  throwBall(a) {
    if (a >= 255) return { shakes: 3, caught: true };
    const b = this.shakeB(a); let n = 0;
    while (n < 4 && Math.floor(this.rnd() * 65536) < b) n++;
    return { shakes: Math.min(3, n), caught: n === 4 };
  },

  // ---------- mons ----------
  legalSet: id => new Set(legalMoves(DEX.species[id])),
  // the 4 latest level-up moves at or below lv
  moves(id, lv) {
    const ok = this.legalSet(id), out = [];
    for (const [l, m] of this.info(id).levelMoves || []) if (l <= lv && ok.has(m)) { const i = out.indexOf(m); if (i >= 0) out.splice(i, 1); out.push(m); }
    return out.slice(-4);
  },
  ability(id) { const a = DEX.species[id].abilities, k = [0, 1].filter(i => a[i]); return a[k.length ? k[Math.floor(this.rnd() * k.length)] : 'H'] || a[0]; },
  mon(id, lv, o = {}) {
    const sp = DEX.species[id], nat = Object.keys(DEX.natures);
    const s = { species: id, level: lv, moves: this.moves(id, lv), ability: this.ability(id), item: '', nature: this.cap(nat[Math.floor(this.rnd() * nat.length)]),
      status: '', exp: this.expFor(this.rate(id), lv), friend: 70, ball: 'pokeball', nickname: '', ot: '', ...o };
    if (!s.moves.length) s.moves = makeMon({ species: id, level: lv }).moves.map(m => m.id); // no level-up moves in the data: the sim's default pick
    s.hp = s.hp ?? this.max(s);
    return s;
  },
  // battle-unit max HP and the real-game HP behind it (memoised: makeMon sorts the learnset)
  maxes(s) { const k = s.species + '|' + s.level + '|' + s.nature; if (!this.mc[k]) { const m = makeMon({ species: s.species, level: s.level, nature: s.nature }); this.mc[k] = { max: m.maxHp, real: m.stats.hp }; } return this.mc[k]; },
  max(s) { return this.maxes(s).max; },
  heal(s) { s.hp = this.max(s); s.status = ''; },
  fainted: s => !(s.hp > 0),
  // hp to carry over when max HP changes: same fraction, alive stays alive
  rescale(s, oldMax) { if (s.hp > 0) s.hp = Math.max(1, Math.min(this.max(s), Math.round(s.hp / oldMax * this.max(s)))); },

  // ---------- level ups ----------
  // adds EXP and applies the levels; returns the event pages the screen plays: { t: 'lv' | 'learn' | 'forget' | 'evo' }
  gain(s, n, ctx = {}) {
    const rate = this.rate(s.species), ev = [], from = s.level;
    s.exp = Math.min(this.expFor(rate, 100), (s.exp ?? this.expFor(rate, s.level)) + n);
    const to = Math.min(100, this.levelFor(rate, s.exp));
    if (to > from) {
      const old = this.maxes(s), oldStats = this.stats(s); s.level = to; s.friend = Math.min(255, (s.friend | 0) + 2 * (to - from));
      const m0 = old.max; this.rescale(s, m0);
      ev.push({ t: 'lv', s, from, to, before: oldStats, after: this.stats(s) });
      for (let l = from + 1; l <= to; l++) for (const mv of this.learnAt(s, l)) ev.push(...this.learn(s, mv));
    }
    const e = this.evoFor(s, ctx); if (e && to > from) ev.push({ t: 'evo', s, to: e });
    return ev;
  },
  stats(s) { const m = makeMon({ species: s.species, level: s.level, nature: s.nature }); return { hp: m.stats.hp, atk: m.stats.atk, def: m.stats.def, spa: m.stats.spa, spd: m.stats.spd, spe: m.stats.spe }; },
  // level-up moves a mon learns exactly at level l that it does not know yet
  learnAt(s, l) { const ok = this.legalSet(s.species); return (this.info(s.species).levelMoves || []).filter(([x, m]) => x === l && ok.has(m) && !s.moves.includes(m)).map(x => x[1]); },
  // fills a free slot at once, otherwise asks (the screen calls replace or skips)
  learn(s, mv) {
    if (s.moves.includes(mv)) return [];
    if (s.moves.length < 4) { s.moves.push(mv); return [{ t: 'learn', s, mv }]; }
    return [{ t: 'forget', s, mv }];
  },
  replace(s, i, mv) { s.moves[i] = mv; },

  // ---------- evolution ----------
  // plain level evolutions, friendship ones (220+, with their time of day) and level + time ones; items are evoItem, trade / location / move conditions are not handled
  evoFor(s, ctx = {}) {
    for (const e of this.info(s.species).evos || []) {
      if (e.item || e.trade || e.other || !DEX.species[e.to]) continue;
      if (e.level ? s.level < e.level : !e.friendship) continue;
      if (e.friendship && (s.friend | 0) < 220) continue;
      if (e.time && e.time !== ctx.time) continue;
      return e.to;
    }
    return null;
  },
  evoItem(s, item) { return (this.info(s.species).evos || []).find(e => e.item === item && !e.trade && !e.other && DEX.species[e.to])?.to || null; },
  evolve(s, to) {
    const old = DEX.species[s.species], m0 = this.max(s), slot = Object.keys(old.abilities).find(k => toId(old.abilities[k]) === toId(s.ability));
    if (s.nickname && toId(s.nickname) === toId(old.name)) s.nickname = '';
    s.species = to; s.ability = DEX.species[to].abilities[slot] || DEX.species[to].abilities[0];
    this.rescale(s, m0); return s;
  },

  // ---------- bag ----------
  ITEMS: {
    pokeball: { name: 'Poke Ball', cat: 'ball', ball: 1, info: 'A plain ball for catching wild Pokemon.' },
    greatball: { name: 'Great Ball', cat: 'ball', ball: 1.5, info: 'Catches better than a Poke Ball.' },
    ultraball: { name: 'Ultra Ball', cat: 'ball', ball: 2, info: 'Catches twice as well as a Poke Ball.' },
    masterball: { name: 'Master Ball', cat: 'ball', ball: 255, info: 'Never fails.' },
    potion: { name: 'Potion', cat: 'med', heal: 20, info: 'Restores 20 HP.' },
    superpotion: { name: 'Super Potion', cat: 'med', heal: 60, info: 'Restores 60 HP.' },
    hyperpotion: { name: 'Hyper Potion', cat: 'med', heal: 120, info: 'Restores 120 HP.' },
    maxpotion: { name: 'Max Potion', cat: 'med', heal: 9999, info: 'Restores all HP.' },
    fullrestore: { name: 'Full Restore', cat: 'med', heal: 9999, cure: 'all', info: 'Restores all HP and cures any status.' },
    antidote: { name: 'Antidote', cat: 'med', cure: ['psn', 'tox'], info: 'Cures poison.' },
    paralyzeheal: { name: 'Paralyze Heal', cat: 'med', cure: ['par'], info: 'Cures paralysis.' },
    awakening: { name: 'Awakening', cat: 'med', cure: ['slp'], info: 'Wakes a sleeping Pokemon.' },
    burnheal: { name: 'Burn Heal', cat: 'med', cure: ['brn'], info: 'Cures a burn.' },
    iceheal: { name: 'Ice Heal', cat: 'med', cure: ['frz'], info: 'Thaws a frozen Pokemon.' },
    fullheal: { name: 'Full Heal', cat: 'med', cure: 'all', info: 'Cures any status.' },
    revive: { name: 'Revive', cat: 'med', revive: 0.5, info: 'Revives a fainted Pokemon with half its HP.' },
    maxrevive: { name: 'Max Revive', cat: 'med', revive: 1, info: 'Revives a fainted Pokemon with all its HP.' },
    fishingrod: { name: 'Fishing Rod', cat: 'key', info: 'Face the water and press F (X on a pad) to cast. Needs the Fishing skill.' },
    bike: { name: 'Bike', cat: 'key', info: 'Press V (Select on a pad) to get on or off. Much faster than running. Not indoors, not through tall grass, not on water.' },
    rarecandy: { name: 'Rare Candy', cat: 'grow', candy: true, info: 'Raises a Pokemon by one level.' },
  },
  STONES: ['firestone', 'waterstone', 'thunderstone', 'leafstone', 'moonstone', 'sunstone', 'shinystone', 'duskstone', 'dawnstone', 'icestone', 'ovalstone'],
  item(id) {
    if (this.ITEMS[id]) return this.ITEMS[id];
    if (id.startsWith('tm_')) return { name: 'TM ' + (DEX.moves[id.slice(3)]?.name || id.slice(3)), cat: 'tm', tm: id.slice(3), info: 'Teaches ' + (DEX.moves[id.slice(3)]?.name || 'a move') + ' to a Pokemon that can learn it.' };
    if (this.STONES.includes(id)) return { name: DEX.items?.[id]?.name || this.cap(id.replace('stone', ' Stone')), cat: 'grow', stone: true, info: 'Makes certain Pokemon evolve.' };
    return { name: id, cat: 'key', info: '' };
  },
  CATS: [['ball', 'Balls'], ['med', 'Medicine'], ['grow', 'Growth'], ['tm', 'TMs'], ['key', 'Key items']],
  startBag: () => ({ pokeball: 20, greatball: 3, potion: 10, superpotion: 2, antidote: 3, paralyzeheal: 2, awakening: 2, burnheal: 2, iceheal: 2, revive: 2 }),
  // ---------- Skills (no HMs): taught by NPCs, stored in save.skills ----------
  SKILLS: { fishing: { name: 'Fishing', info: 'Face water and cast the rod to hook a wild Pokemon from the zone fishing table.' }, surf: { name: 'Surf', info: 'Walk across water on a raft, or riding a lead that can learn Surf.' },
    rough: { name: 'Rough Riding', info: 'Ride Tauros, Mudsdale, Rhyhorn and other heavy mounts over rocky ground without slowing.' }, canter: { name: 'Cantering Riding', info: 'Ride Rapidash, Ponyta, Zebstrika, Arcanine and other runners: the fastest on open land.' },
    boulder: { name: 'Bouldering Riding', info: 'Ride Gogoat, Skiddo, Rhydon and other climbers up marked rock faces.' }, snow: { name: 'Snow Riding', info: 'Ride Mamoswine, Piloswine and other snow mounts across deep snow without slowing.' },
    dune: { name: 'Dune Riding', info: 'Ride Hippowdon, Sandaconda and Camerupt across deep sand without slowing.' }, fly: { name: 'Fly', info: 'Fly freely over the map on a lead that can learn Fly. Land on clear outdoor ground.' },
    sense: { name: 'Sensing Shadow Pokemon', info: 'Know when a Shadow Pokemon is near. Taught at Quiet Plain, to anyone who walks there.' } },
  // ---------- Travel (docs/TRAVEL.md): running shoes from the start, the Bike (a key item), riding a lead (per-kind skills), free flight, the supply mount ----------
  PACE: { walk: 120, run: 200, bike: 300, fly: 400, lent: 300 },   // px/s at scale 1 (+25% on 2026-10-15, his playtest)
  // ride skills: speed on land, and the terrain it crosses without slowing (everyone else is slowed to 60 percent there, see TERRAIN)
  RIDE: { rough: { speed: 288, terrain: 'rough' }, canter: { speed: 350 }, boulder: { speed: 262 }, snow: { speed: 275, terrain: 'snow' }, dune: { speed: 275, terrain: 'dune' } },
  // every way each mount can be ridden (his rule 2026-10-15: a mount does every riding kind that makes sense for it, e.g. Rapidash canters, rides rough ground and snow)
  RIDERS: { tauros: ['rough', 'canter'], taurospaldeacombat: ['rough', 'canter'], taurospaldeablaze: ['rough', 'canter'], taurospaldeaaqua: ['rough', 'canter'], bouffalant: ['rough'],
    mudbray: ['rough', 'dune'], mudsdale: ['rough', 'dune', 'boulder'], rhyhorn: ['rough', 'boulder'], rhydon: ['rough', 'boulder'], rhyperior: ['rough', 'boulder'], donphan: ['rough', 'dune'], copperajah: ['rough'], torterra: ['rough', 'boulder'],
    ponyta: ['canter', 'rough'], rapidash: ['canter', 'rough', 'snow'], ponytagalar: ['canter', 'rough'], rapidashgalar: ['canter', 'rough', 'snow'], blitzle: ['canter', 'rough'], zebstrika: ['canter', 'rough'],
    arcanine: ['canter', 'rough'], arcaninehisui: ['canter', 'rough', 'snow', 'boulder'], stantler: ['canter', 'rough', 'snow'], wyrdeer: ['canter', 'rough', 'snow'], sawsbuck: ['canter', 'rough', 'boulder'],
    houndoom: ['canter', 'rough'], mightyena: ['canter', 'rough'], luxray: ['canter', 'rough'], lycanroc: ['canter', 'rough', 'boulder'], lycanrocmidnight: ['canter', 'rough', 'boulder'], lycanrocdusk: ['canter', 'rough', 'boulder'],
    dodrio: ['canter', 'dune'], cyclizar: ['canter', 'rough', 'dune'], stoutland: ['rough', 'snow'], ursaring: ['rough', 'boulder'], ursaluna: ['rough', 'boulder', 'snow'],
    skiddo: ['boulder', 'rough'], gogoat: ['boulder', 'rough', 'snow'], graveler: ['boulder'], golem: ['boulder', 'rough'],
    piloswine: ['snow', 'rough'], mamoswine: ['snow', 'rough', 'boulder'], avalugg: ['snow'], abomasnow: ['snow', 'rough'],
    camerupt: ['dune', 'rough'], hippowdon: ['dune', 'rough'], sandaconda: ['dune'], krookodile: ['dune', 'rough'], flygon: ['dune'] },
  TERRAIN: { ashGround: 'rough', snow: 'snow', duneSand: 'dune' },   // the materials the generator has for them (mud and rock faces are not built yet)
  rideable: s => !!s && !!ADVP.RIDERS[toId(s.species)],
  flies: s => !!s && ADVP.legalSet(toId(s.species)).has('fly'),
  rideKnown: (sv, s) => s ? (ADVP.RIDERS[toId(s.species)] || []).filter(k => sv.skills[k]) : [],
  rideBest(sv, s) { return this.rideKnown(sv, s).sort((a, b) => this.RIDE[b].speed - this.RIDE[a].speed)[0] || ''; },
  // a mount's land speed: its fastest known kind, scaled by its real Speed stat against a base-80 mon of the same level (0.88x to 1.12x)
  // and by level (0.94x at 1 up to 1.02x from 50), so two Rapidash differ a little and a raised one is quicker. 0 = cannot ride.
  rideSpeed(sv, s) {
    const k = this.rideBest(sv, s); if (!k) return 0;
    const spe = this.stats(s).spe, ref = Math.floor((2 * 80 + 31) * s.level / 100) + 5;
    return Math.round(this.RIDE[k].speed * Math.max(0.88, Math.min(1.12, 1 + 0.3 * (spe / ref - 1))) * (0.94 + 0.08 * Math.min(1, s.level / 50)));
  },
  // the speed factor of a material for a rider with these ride skills
  ground(mat, can) { const k = this.TERRAIN[mat]; return k && !can.some(c => this.RIDE[c].terrain === k) ? 0.6 : 1; },
  // px/s on foot (run is always available), or the mount's speed when it is given
  pace: (run, fast) => fast || (run ? ADVP.PACE.run : ADVP.PACE.walk),
  // why kind ('bike' | 'ride' | 'fly') cannot be used here, or '' when it can. e = { room, grass, wet, lead }
  mountNo(sv, kind, e) {
    if (e.room) return kind === 'fly' ? 'You cannot fly indoors.' : 'You cannot ride indoors.';
    if (kind === 'bike') return !sv.bag.bike ? 'You do not have a Bike.' : e.grass ? 'You cannot ride a Bike in tall grass.' : e.wet ? 'You cannot ride a Bike on water.' : '';
    if (kind === 'fly') return !sv.skills.fly ? 'You have not learned to fly yet.' : this.flies(e.lead) ? '' : `${this.name(e.lead)} cannot fly.`;
    if (!this.rideable(e.lead)) return `${this.name(e.lead)} is not built for riding.`;
    return this.rideBest(sv, e.lead) ? '' : `You have not learned ${this.RIDERS[toId(e.lead.species)].map(k => this.SKILLS[k].name).join(', ').replace(/, ([^,]*)$/, ' or $1')}.`;
  },
  // what a mount can be done with right now, for the key that has no kind: the first of Bike, ride, fly that applies to this save ('' = nothing to ride)
  mountKind: (sv, lead) => sv.bag.bike ? 'bike' : ADVP.rideable(lead) ? 'ride' : sv.skills.fly && ADVP.flies(lead) ? 'fly' : '',
  // ---------- lessons: a bar with a moving marker; stop it inside the zone N times (3 misses end it) ----------
  LESSON: { easy: { zone: 0.3, hits: 3, speed: 0.8 }, hard: { zone: 0.14, hits: 6, speed: 1.3 } }, MISSES: 3,
  FEE: { class: 1500, fly: 2000, surf: 800, coachPay: 6000, coachHard: 500 },
  marker: (t, speed) => { const u = (t * speed) % 2; return u < 1 ? u : 2 - u; },   // triangle wave 0..1..0
  lesson(level, rnd = Math.random) {
    const L = this.LESSON[level], m = this.MISSES;
    return { level, need: L.hits, zone: L.zone, speed: L.speed, hits: 0, miss: 0, done: '', c: 0.5, next() { this.c = this.zone / 2 + rnd() * (1 - this.zone); return this; },
      press(x) { if (this.done) return this.done; if (Math.abs(x - this.c) <= this.zone / 2) { if (++this.hits >= this.need) return this.done = 'won'; this.next(); return 'hit'; } return ++this.miss >= m ? this.done = 'lost' : 'miss'; } }.next();
  },
  // a timed ride along a marked course: pts (tile points) in order, r tiles to count, t seconds left; call once a frame with the rider's tile: '' | 'done' | 'late'
  courseStep(c, tx, ty, dt) {
    c.t -= dt; if (Math.hypot(tx - c.pts[c.i][0], ty - c.pts[c.i][1]) <= c.r) c.i++;
    return c.i >= c.pts.length ? 'done' : c.t <= 0 ? 'late' : '';
  },
  // ---------- the supply path (world.supply, tile points from tools/adv-gen-region.py): 'path' within S.w tiles of it, 'town' within an end town's disc, else '' ----------
  SUPPLY_FEE: 200, LENT: { supply: 'mudsdale', rough: 'mudsdale', canter: 'rapidash', boulder: 'gogoat' },
  supplyAt(S, tx, ty) {
    if (S.ends.some(e => Math.hypot(tx - e.x, ty - e.y) <= e.r + 3)) return 'town';
    for (let i = 1; i < S.pts.length; i++) {
      const [ax, ay] = S.pts[i - 1], [bx, by] = S.pts[i], dx = bx - ax, dy = by - ay, u = Math.max(0, Math.min(1, ((tx - ax) * dx + (ty - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(tx - ax - dx * u, ty - ay - dy * u) <= S.w) return 'path';
    }
    return '';
  },
  // teaches skill id on save sv (the rod comes with fishing); returns the pages to say, or [] when it was known already
  teach(sv, id) {
    const k = this.SKILLS[id]; if (!k || sv.skills[id]) return [];
    sv.skills[id] = 1; const p = [`${sv.name} learned ${k.name}!`];
    if (id === 'fishing' && !sv.bag.fishingrod) { this.add(sv.bag, 'fishingrod'); p.push(`${sv.name} got a Fishing Rod!`); }
    return p;
  },
  // can this lead ride for surfing (its learnset has Surf); otherwise the trainer paddles a raft
  rides: s => !!s && ADVP.legalSet(toId(s.species)).has('surf'),
  // ---------- the Mart (S1b) ----------
  // price per item; selling pays half. STOCK[b] is what a clerk adds once you hold b badges (stock(b) is everything up to b).
  PRICE: { bike: 4000, pokeball: 200, greatball: 600, ultraball: 1200, potion: 300, superpotion: 700, hyperpotion: 1200, maxpotion: 2500, fullrestore: 3000, antidote: 100, paralyzeheal: 200, awakening: 250, burnheal: 250, iceheal: 250, fullheal: 600, revive: 1500, maxrevive: 4000 },
  STOCK: [['bike', 'pokeball', 'potion', 'antidote', 'paralyzeheal', 'awakening', 'burnheal', 'iceheal'], ['greatball', 'superpotion'], ['fullheal'], ['revive'], ['hyperpotion'], ['ultraball'], ['maxpotion'], ['fullrestore', 'maxrevive']],
  stock(badges) { return this.STOCK.slice(0, Math.max(0, Math.min(7, badges | 0)) + 1).flat(); },
  sellPrice(id) { return this.item(id).cat === 'key' ? 0 : Math.floor((this.PRICE[id] || 0) / 2); },
  // buy / sell n of id on save sv: { ok, s }
  buy(sv, id, n = 1, day) {   // day given = the Tradeway market's stock and prices for that day instead of a Mart's
    const mk = day !== undefined, p = mk ? this.marketPrice(id, day) : this.PRICE[id], nm = this.item(id).name;
    if (!p || !(mk ? this.marketList(day).includes(id) : this.stock(sv.badges).includes(id)) || !(n >= 1)) return { ok: false, s: mk ? 'The trader does not have that today.' : 'The Mart does not sell that yet.' };
    if (this.item(id).cat === 'key' && (sv.bag[id] | 0) + n > 1) return { ok: false, s: 'You already have one.' };
    if (sv.money < p * n) return { ok: false, s: 'You do not have enough money.' };
    sv.money -= p * n; this.add(sv.bag, id, n); return { ok: true, s: `Bought ${n} ${nm} for $${p * n}.` };
  },
  sell(sv, id, n = 1) {
    const p = this.sellPrice(id), nm = this.item(id).name;
    if (!p) return { ok: false, s: 'The clerk cannot take that.' };
    if (!(n >= 1) || !(sv.bag[id] >= n)) return { ok: false, s: 'You do not have that many.' };
    for (let i = 0; i < n; i++) this.take(sv.bag, id);
    sv.money += p * n; return { ok: true, s: `Sold ${n} ${nm} for $${p * n}.` };
  },
  // ---------- the Tradeway market (T4): independent trade, not Cherimart's. Rare stock no Mart sells, wild prices (the best in the region), an inventory that is random and changes by the day, and barter ----------
  MARKET: { firestone: 2100, waterstone: 2100, thunderstone: 2100, leafstone: 2100, moonstone: 2100, sunstone: 2100, shinystone: 2400, duskstone: 2400, dawnstone: 2400, icestone: 2400, ovalstone: 1500, rarecandy: 4800 },
  BARTER: [{ give: ['potion', 6], get: ['greatball', 3] }, { give: ['superpotion', 3], get: ['ultraball', 1] }, { give: ['antidote', 5], get: ['fullheal', 2] }, { give: ['pokeball', 15], get: ['greatball', 6] },
    { give: ['revive', 2], get: ['rarecandy', 1] }, { give: ['greatball', 5], get: ['ultraball', 3] }, { give: ['fullheal', 3], get: ['maxrevive', 1] }, { give: ['hyperpotion', 2], get: ['revive', 2] }],
  day: () => Math.floor(Date.now() / 864e5),
  hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h ^ h >>> 15) >>> 0; },
  marketList(day) { return Object.keys(this.MARKET).sort((a, b) => this.hash(day + a) - this.hash(day + b)).slice(0, 6); },                              // six of the twelve, a different six each day
  marketPrice(id, day) { return this.MARKET[id] ? Math.round(this.MARKET[id] * (45 + this.hash(day + 'p' + id) % 41) / 100 / 10) * 10 : 0; },             // 45 to 85 percent of the usual price, again by the day
  barterOffers(day) { return this.BARTER.map((o, i) => [this.hash(day + 'b' + i), o]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(x => x[1]); },        // three of the eight swaps today
  swap(sv, i, day) {
    const o = this.barterOffers(day)[i]; if (!o) return { ok: false, s: 'There is no such offer.' };
    const [g, gn] = o.give, [t, tn] = o.get; if (!(sv.bag[g] >= gn)) return { ok: false, s: `You need ${gn} ${this.item(g).name}.` };
    for (let k = 0; k < gn; k++) this.take(sv.bag, g); this.add(sv.bag, t, tn); return { ok: true, s: `Swapped ${gn} ${this.item(g).name} for ${tn} ${this.item(t).name}.` };
  },
  take(bag, id) { if (!(bag[id] > 0)) return false; if (--bag[id] <= 0) delete bag[id]; return true; },
  add(bag, id, n = 1) { bag[id] = (bag[id] | 0) + n; },
  // heal / cure / revive on t = { hp, status, fainted? }; maxHp and realHp give the battle-units-per-HP scale. Returns what happened or '' when it would do nothing.
  useOn(t, id, maxHp, realHp) {
    const it = this.item(id), dead = !(t.hp > 0) || t.fainted;
    if (it.revive) { if (!dead) return ''; t.hp = Math.max(1, Math.round(maxHp * it.revive)); if ('fainted' in t) t.fainted = false; return 'revived'; }
    if (dead) return '';
    let did = '';
    if (it.heal && t.hp < maxHp) { const n = Math.min(maxHp - t.hp, it.heal >= 9999 ? maxHp : Math.round(it.heal * maxHp / realHp)); t.hp += n; did = 'healed'; }
    if (it.cure && t.status && (it.cure === 'all' || it.cure.includes(t.status))) { t.status = ''; did = did || 'cured'; }
    return did;
  },
};
