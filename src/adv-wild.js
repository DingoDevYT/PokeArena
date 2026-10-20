// Living wild Pokemon (W1b): zone tables, day/night, badge-band levels, spawner, groups, temperament behaviours, pile-on queue.
// Pure logic over ADV + ADV_ENC / ADV_TEMPER / ADV_DEX / ADV_ZONES so tools/adv-check.mjs can run it in node; drawing and fights live in adv-scene.js.
// A group is one species (evolved to match the level); members share a home and wander as a loose herd. w.st: wander | alert | charge | flee | wait (queued behind a fight) | fight (the sim owns it).
'use strict';
const ADVW = {
  CAPS: [15, 19, 24, 29, 34, 38, 42, 46, 52], LV: null, // Appendix A level cap per badge count (8 badges = the True Team cap); LV = the wild range cap-8..cap-4, set below
  BW: { common: 45, uncommon: 30, rare: 20, nat20: 5 }, BONUS: { rare: 1, nat20: 2 },
  CAP: 13, NEAR: 40, FAR: 60, MIN: 12, SIM: 50, JOIN: 10, // tiles: groups kept alive within NEAR, none spawn closer than MIN, despawn past FAR, only entities within SIM think, pile-on reach
  groups: [], fx: [], rnd: Math.random, hourSet: null, acc: 0, gd: 0, P: null, gid: 0, clock: null, clockTotal: null, mirror: false, // clock, clockTotal: server hour and running game-hour total online (adv-net.js); mirror: a guest only animates the mons it fights, the host's sim is the truth
 
  reset() { this.groups = []; this.fx = []; this.gd = 0; this.acc = 0; },
  pk(a) { return a[Math.floor(this.rnd() * a.length)]; },
  has(id) { return typeof DEX === 'undefined' || !!(DEX.species[id] && spriteOf(DEX.species[id].sprite)); }, // only species the engine can draw
  tm(id) { return window.ADV_TEMPER?.[id] || { t: 'passive', group: [1, 1] }; },
  // 24 real minutes = 1 game day on the local clock (W2 swaps in the server clock); night is 20:00 to 06:00
  // a running count of game hours that never wraps (weather slots): hour() is its value mod 24; pinned, the real day count stays and the hour is the pinned one
  totalHours() { const t = this.clock && this.clockTotal ? this.clockTotal() : (Date.now() - new Date().getTimezoneOffset() * 60000) / 60000; return this.hourSet !== null ? Math.floor(t / 24) * 24 + this.hourSet : t; },
  hour() { if (this.hourSet !== null) return this.hourSet; if (this.clock) return this.clock(); const d = new Date(); return ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000) / 60) % 24; },
  night() { const h = this.hour(); return h < 6 || h >= 20; },
  zone(x, y) { for (const r of ADV.live || []) if (r.zone && x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return r.zone; /* a live room (the Route 4 cave) is its own zone */ const Z = window.ADV_ZONES; if (!Z) return ''; const rows = Z.rows ||= Z.cells.map(ADV.rle), s = ADV.Tp(x) * Z.cell; return Z.ids[rows[Math.floor(y / s)]?.[Math.floor(x / s)]] || ''; },
  table(zone) { const e = window.ADV_ENC?.[zone]; return e && (this.night() ? e.night : e.day) || null; },
  // band by weight, then uniformly inside it (a route has one species per band, a town several)
  roll(tab) {
    const by = {}; for (const e of tab) (by[e[1]] ||= []).push(e);
    const bs = Object.keys(by); let r = this.rnd() * bs.reduce((a, b) => a + (this.BW[b] || 0), 0);
    for (const b of bs) if ((r -= this.BW[b] || 0) < 0) return this.pk(by[b]);
    return tab[0];
  },
  // the band for a badge count, held to at most UP levels over the player's strongest party member (top), so a fresh starter meets fair fights and the band is reached by training
  UP: 2,
  band(badges, top) { let [a, b] = this.LV[Math.max(0, Math.min(8, badges | 0))]; if (top > 0 && b > top + this.UP) { b = Math.max(2, top + this.UP); a = Math.min(a, Math.max(2, b - 4)); } return [a, b]; },
  partyTop(sv = ADV.player) { return sv?.party?.length ? Math.max(...sv.party.map(m => m.level | 0)) : 0; },
  level(band, badges = ADV.player?.badges | 0, top = this.partyTop()) { const [a, b] = this.band(badges, top); return a + Math.floor(this.rnd() * (b - a + 1)) + (this.BONUS[band] || 0); },
  top(band, badges = ADV.player?.badges | 0, top = this.partyTop()) { return this.band(badges, top)[1] + (this.BONUS[band] || 0); }, // highest level of the band
  // a Wooloo at 30 is a Dubwool: follow plain level evolutions (no item / trade / friendship / time) while the level allows
  evolve(id, lv) {
    for (;;) {
      const ev = (window.ADV_DEX?.[id]?.evos || []).filter(e => e.level <= lv && Object.keys(e).length === 2 && this.has(e.to));
      if (!ev.length) return id; id = this.pk(ev).to;
    }
  },
  // is (x, y) a legal standing spot for this temperament; lv (optional) = the level it must be on
  ok(x, y, tm, lv) {
    const T = ADV.Tp(x), c = Math.floor(x / T), r = Math.floor(y / T), h = ADV.h(c, r), k = ADV.kind(c, r);
    if (h < 0 || k >= 1 && k <= 8 || (lv !== undefined && h !== lv) || ADV.bldAt(x, y)) return false; // stairs, ledges, decks, the inside of a building
    if (tm.swims) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!ADV.isWater(Math.floor((x + dx * 6) / T), Math.floor((y + dy * 6) / T))) return false; return true; }
    if (tm.flies) return !ADV.propHit(x, y, 8, h * T);
    const m = ADV.palette[ADV.mat(c, r)], g = window.ADV_WORLD?.towns?.G7;   // Goldacre's own table spawns only in the fields and pastures: not on paving, its dirt lanes or the village green
    if (m === 'pavingStone' || m === 'boardwalk' || m === 'path' && (z => z === 'goldacre' || z === 'pinegrove' || z === 'spindlewood' || z === 'sporehaven' || z === 'duskmoss')(this.zone(x, y))) return false;   // Pinegrove's and Spindlewood's streets likewise, and no wild mon stands on a pier
    if (g && Math.abs(x - g.x) < 17 * T && y > g.y - 13 * T && y < g.y + 11 * T && this.zone(x, y) === 'goldacre') return false;
    return !ADV.isWater(c, r) && !ADV.blocked(x, y, h * T, 8);
  },
  seen(x, y, v) { return !!v && x > v.x0 - 48 && x < v.x1 + 48 && y > v.y0 - 24 && y < v.y1 + 96; }, // feet position inside the view plus a sprite's margin
  // one spawn attempt at a random spot MIN..NEAR tiles from the player, never in view
  spawnTry(P, view, Q = [P]) {
    const T = ADV.Tp(P.x), a = this.rnd() * 6.2832, d = (this.MIN + this.rnd() * (this.NEAR - this.MIN)) * T, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
    const r = this.pickSpecies(this.zone(x, y)); if (!r) return null;
    const pt = P.top !== undefined ? P.top : this.partyTop(), lv = this.level(r[1], P.badges, pt), id = this.evolve(r[0], lv), tm = this.tm(id), n = tm.group[0] + Math.floor(this.rnd() * (tm.group[1] - tm.group[0] + 1));
    const spot = (cx, cy, rad) => {
      const small = (window.DEX?.species[id]?.weightkg ?? 99) < 12; let any = null;
      for (let i = 0; i < 6; i++) {
        const px = i ? cx + (this.rnd() - 0.5) * rad * 2 : cx, py = i ? cy + (this.rnd() - 0.5) * rad * 2 : cy;
        if (!this.ok(px, py, tm) || Q.some(q => this.seen(px, py, q.view || view) || Math.hypot(px - q.x, py - q.y) < this.MIN * T)) continue;
        if (!small || ADV.palette[ADV.over(Math.floor(px / T), Math.floor(py / T))] === 'tallgrass') return { x: px, y: py }; // small species like tall grass
        any ||= { x: px, y: py };
      }
      return any;
    };
    const home = spot(x, y, 3 * T); if (!home) return null;
    const pts = [home]; for (let i = 1; i < n; i++) { const q = spot(home.x, home.y, 36); if (q) pts.push(q); }
    return this.group(id, lv, home, pts, this.top(r[1], P.badges, pt));
  },
  pickSpecies(zone) {
    const tab = this.table(zone); if (!tab) return null;
    for (let i = 0; i < 4; i++) { const r = this.roll(tab); if (this.has(r[0])) return r; }
    return null;
  },
  // members share the species and sit at lv..hi (never under the level that decided the evolution, never over the band)
  group(id, lv, home, pts, hi = lv) {
    const tm = this.tm(id), key = window.DEX?.species[id]?.sprite, g = { id, home, m: [], gid: ++this.gid };
    for (const p of pts) {
      const e = ADV.entity(p.x, p.y); e.r = 8;
      g.m.push({ e, g, id, nid: g.gid * 32 + g.m.length, level: Math.min(Math.max(lv, hi), lv + Math.floor(this.rnd() * 3)), key, tm, st: 'wander', t: 0, wait: this.rnd() * 3, go: null, cool: 0, stuck: 0, animT: this.rnd() * 3, face: Math.floor(this.rnd() * 8), moving: false });
    }
    this.groups.push(g); this.load?.(id);
    return g;
  },
  // every 0.25 s: drop groups past FAR, top up to CAP within NEAR
  // P = one player or a list of them (online: everyone in the world; q.nospawn = keeps groups alive but spawns none, q.view = its screen, q.badges = its level band)
  tick(dt, P, view) {
    if ((this.acc += dt) < 0.25) return; this.acc = 0;
    const Q = [].concat(P), dist = (g, q) => Math.hypot(g.m[0].e.x - q.x, g.m[0].e.y - q.y);
    this.groups = this.groups.filter(g => {
      if (!g.m.length) return false;
      if (g.m.some(w => w.st === 'fight' || w.st === 'wait')) return true;
      return Q.some(q => dist(g, q) <= this.FAR * ADV.Tp(q.x));
    });
    for (const q of Q) {
      if (q.nospawn) continue;
      let n = this.groups.reduce((a, g) => a + (!g.local && g.m.length && dist(g, q) < this.NEAR * ADV.Tp(q.x) ? 1 : 0), 0);
      for (let i = 0; i < 4 && n < this.CAP; i++) if (this.spawnTry(q, q.view || view, Q)) n++;
    }
  },
  fill(P, view) { for (let i = 0; i < 80 && this.groups.length < this.CAP; i++) this.spawnTry(P, view); },

  // ---------- behaviour ----------
  // flies cross water at their level; swims stay in water; everyone else walks with ADV.move
  mv(w, dx, dy) {
    const e = w.e, tm = w.tm; if (!tm.swims && !tm.flies) return ADV.move(e, dx, dy);
    const T = ADV.Tp(e.x), can = (x, y) => tm.swims ? this.ok(x, y, tm) : (c => ADV.h(c[0], c[1]) === e.lv && !ADV.STAIR[ADV.kind(c[0], c[1])] && !ADV.propHit(x, y, e.r, e.z))([Math.floor(x / T), Math.floor(y / T)]);
    for (const [ax, ay] of [[dx, dy], [dx, 0], [0, dy]]) if ((ax || ay) && can(e.x + ax, e.y + ay)) { e.x += ax; e.y += ay; return; }
  },
  // walk toward (tx, ty) at sp px/s with separation from the rest of the group; returns the distance left
  go(w, g, tx, ty, sp, dt) {
    const e = w.e, d = Math.hypot(tx - e.x, ty - e.y) || 1, ux = (tx - e.x) / d, uy = (ty - e.y) / d; let vx = ux * sp, vy = uy * sp;
    for (const o of g.m) if (o !== w && o.st !== 'fight') { const ox = e.x - o.e.x, oy = e.y - o.e.y, od = Math.hypot(ox, oy); if (od < 20) { vx += ox / (od || 1) * 40; vy += oy / (od || 1) * 40; } }
    const x0 = e.x, y0 = e.y; this.mv(w, vx * dt, vy * dt);
    w.moving = Math.hypot(e.x - x0, e.y - y0) > 0.05; if (w.moving) w.face = dirFromVec(ux, uy);
    return d;
  },
  setAll(g, st, t) { g.m.forEach((w, i) => { if (w.st === 'fight' || w.st === 'wait') return; w.st = st; w.t = st === 'alert' ? t + i * 0.1 : t; w.stuck = 0; w.go = null; if (st === 'alert') this.fx.push({ k: '!', w, t: -i * 0.1, life: 0.8 }); }); return true; },
  // advances every wild mon within SIM tiles; mode 'walk' lets them notice / flee / charge, 'battle' only lets the queue walk to its spots
  update(dt, P, mode) {
    const Q = [].concat(P);
    for (const f of this.fx) f.t += dt;
    if (this.fx.some(f => f.t >= f.life)) this.fx = this.fx.filter(f => f.t < f.life);
    for (const g of this.groups) {
      let cx = 0, cy = 0; for (const w of g.m) { cx += w.e.x; cy += w.e.y; } g.cx = cx / g.m.length; g.cy = cy / g.m.length;
      for (const w of g.m) {
        if (w.st === 'fight' || this.mirror && w.st !== 'wait') continue;
        let q = Q[0], d2 = 1e18; for (const o of Q) { const e2 = (o.x - w.e.x) ** 2 + (o.y - w.e.y) ** 2; if (e2 < d2) { d2 = e2; q = o; } }
        if (d2 > (this.SIM * ADV.Tp(q.x)) ** 2) continue;
        this.P = q; this.think(w, g, dt, q.x - w.e.x, q.y - w.e.y, Math.sqrt(d2), mode === 'walk' && !q.busy);
      }
    }
  },
  think(w, g, dt, dx, dy, d, walk) {
    const e = w.e, T = ADV.Tp(e.x), tt = w.tm.t, P = this.P, same = e.lv === P.lv;
    ADV.update(e, dt); w.animT += dt; w.moving = false; w.cool -= dt;
    if (e.hop) { w.moving = true; return; }
    if (!walk && (w.st === 'alert' || w.st === 'charge')) { w.st = 'wander'; w.cool = 4; }
    switch (w.st) {
      case 'wander':
        if (walk && w.cool <= 0 && same) {
          const hd = Math.hypot(P.x - g.home.x, P.y - g.home.y);
          if (tt === 'skittish' && d < 5 * T) return this.setAll(g, 'flee', 2);
          if (tt === 'aggressive' && d < 6 * T && (d < 40 || (DIR_VEC[w.face][0] * dx + DIR_VEC[w.face][1] * dy) / d > 0.5)) return this.setAll(g, 'alert', 0.6);
          if (tt === 'territorial' && hd < 3 * T) return this.setAll(g, 'alert', 0.6);
        }
        if (w.go) { if (this.go(w, g, w.go.x, w.go.y, 40, dt) < 4 || (w.go.t -= dt) <= 0) { w.go = null; w.wait = 1 + this.rnd() * 3; } }
        else if ((w.wait -= dt) <= 0) { // drift around the average of the group centre and home
          const x = (g.cx + g.home.x) / 2 + (this.rnd() - 0.5) * 120, y = (g.cy + g.home.y) / 2 + (this.rnd() - 0.5) * 120;
          if (this.ok(x, y, w.tm, e.lv)) w.go = { x, y, t: 3 }; else w.wait = 0.5;
        }
        return;
      case 'alert': w.face = dirFromVec(dx, dy); if ((w.t -= dt) <= 0) { w.st = 'charge'; w.t = 8; } return;
      case 'charge':
        this.go(w, g, P.x, P.y, 120, dt); w.stuck = w.moving ? 0 : w.stuck + dt;
        if ((w.t -= dt) <= 0 || w.stuck > 1.5 || d > 16 * T || !same || (tt === 'territorial' && Math.hypot(P.x - g.home.x, P.y - g.home.y) > 8 * T)) { w.st = 'wander'; w.cool = 5; w.wait = 1; }
        return;
      case 'flee':
        if (d < 7 * T) w.t = Math.max(w.t, 1.2);
        this.go(w, g, e.x - dx, e.y - dy, 105, dt); if (!w.moving) this.go(w, g, e.x - dy, e.y + dx, 105, dt); // cornered: slide sideways
        if ((w.t -= dt) <= 0) { w.st = 'wander'; w.wait = 1; g.home = { x: e.x, y: e.y }; }
        return;
      case 'wait': // queued behind a fight: walk to the spot at the edge and watch
        if (w.spot && this.go(w, g, w.spot.x, w.spot.y, 70, dt) < 4) w.moving = false;
        if (!w.moving && w.watch) w.face = dirFromVec(w.watch.x - e.x, w.watch.y - e.y);
        return;
    }
  },

  // ---------- fights ----------
  // the target first, then its group mates of the same species within JOIN tiles, nearest first; those are the wild side's team in order
  queue(w) {
    const e = w.e, d = o => Math.hypot(o.e.x - e.x, o.e.y - e.y);
    return [w, ...w.g.m.filter(o => o !== w && o.id === w.id && o.st !== 'fight' && d(o) <= this.JOIN * 32).sort((a, b) => d(a) - d(b))];
  },
  // where a queued mon waits: out along its own bearing from the fight centre, 7..8 legacy tiles (224..256 px, the picture and the fight box keep their world px size) away
  edge(w, cx, cy) {
    const T = 32, a = Math.atan2(w.e.y - cy, w.e.x - cx), R = Math.max(7 * T, Math.min(8 * T, Math.hypot(w.e.x - cx, w.e.y - cy)));
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  },
  kill(w) { if (w.dead) return; const g = w.g; w.dead = true; g.m.splice(g.m.indexOf(w), 1); if (!g.m.length) this.groups.splice(this.groups.indexOf(g), 1); },

  // ---------- tall grass ----------
  // the player walked d px: every 32 px in tall grass at ground level has a 3 % chance to pop an aggressive mon 1.5 tiles ahead (null or the new wild mon)
  grass(P, d) {
    const T = ADV.Tp(P.x), c = Math.floor(P.x / T), r = Math.floor(P.y / T);
    if (ADV.palette[ADV.over(c, r)] !== 'tallgrass' || Math.abs(P.z - ADV.h(c, r) * T) > 1) { this.gd = 0; return null; }
    let hit = null; this.gd += d;
    while (this.gd >= 32) { this.gd -= 32; if (!hit && this.rnd() < 0.03) hit = this.pop(P); }
    return hit;
  },
  pop(P) {
    const T = ADV.Tp(P.x), tab = this.table(this.zone(P.x, P.y)); if (!tab) return null;
    const ag = tab.filter(e => this.tm(e[0]).t === 'aggressive' && this.has(e[0])), r = ag.length ? this.pk(ag) : this.pickSpecies(this.zone(P.x, P.y)); if (!r) return null;
    const lv = this.level(r[1]), id = this.evolve(r[0], lv), tm = this.tm(id), v = DIR_VEC[P.face];
    for (const k of [1.5, 1]) {
      const x = P.x + v[0] * k * T, y = P.y + v[1] * k * T; if (!this.ok(x, y, tm, P.lv)) continue;
      const w = this.group(id, lv, { x, y }, [{ x, y }], this.top(r[1])).m[0]; w.st = 'pop'; w.tm = { ...tm, t: 'aggressive' };
      this.fx.push({ k: 'rustle', x, y, t: 0, life: 0.6 }, { k: '!', w, t: 0, life: 0.9 });
      return w;
    }
    return null;
  },

  // ---------- fishing (Skills) ----------
  // the zone's fishing table (shore water only): a roll { id, lv, top, band } with the species evolved to the level, or null when the zone has none
  fishRoll(zone, badges = ADV.player?.badges | 0) {
    const tab = window.ADV_ENC?.[zone]?.fish; if (!tab) return null;
    for (let i = 0; i < 4; i++) { const r = this.roll(tab); if (this.has(r[0])) { const lv = this.level(r[1], badges); return { id: this.evolve(r[0], lv), lv, top: this.top(r[1], badges), band: r[1] }; } }
    return null;
  },
  // dry standing spot for a hooked mon: 2..4 tiles from P on its level, nearest the water at (tx, ty), clear of walls and props
  fishSpot(P, tx, ty) {
    const T = ADV.Tp(P.x); let best = null, bd = 1e9;
    for (const d of [2, 3, 4]) for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, x = P.x + Math.cos(a) * d * T, y = P.y + Math.sin(a) * d * T, c = Math.floor(x / T), r = Math.floor(y / T), h = ADV.h(c, r);
      if (h !== P.lv || ADV.kind(c, r) || ADV.deck(c, r) >= 0 || ADV.isWater(c, r) || ADV.blocked(x, y, h * T, 9)) continue;
      const e = Math.hypot(x - tx, y - ty); if (e < bd) { bd = e; best = { x, y }; }
    }
    return best;
  },
  // the fish bites: a lone wild mon (its own group, local to this player) stands on the shore at the spot
  fishMake(P, ro, tx, ty) {
    const spot = this.fishSpot(P, tx, ty); if (!spot) return null;
    const w = this.group(ro.id, ro.lv, spot, [spot], ro.top).m[0]; w.st = 'pop'; w.g.local = true; w.tm = { ...w.tm, t: 'passive' };
    this.fx.push({ k: '!', w, t: 0, life: 0.9 });
    return w;
  },
};
ADVW.LV = ADVW.CAPS.map(c => [c - 8, c - 4]);
