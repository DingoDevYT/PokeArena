// People in the world (S1a): villagers and trainers placed from data/adv/npcs.js. Pure logic over ADV / ADVW so tools/adv-check.mjs can run it in node; drawing, talking and the trainer fights live in adv-scene.js.
// An NPC: { id, def, e (ADV entity, made once its chunk is loaded), face (0..7, 0 down 2 right 4 up 6 left), home, busy, ... }. A trainer def carries { cls, name, team: [[species, rel]], sight, money, say, lose }.
'use strict';
const ADVN = {
  list: [], SIM: 40, SPEED: 40, TALK: 40, NEAR: 3.2,  // tiles an NPC thinks within the player, wander speed px/s, talk reach px, a spotting trainer stops this many tiles from you
  SIZE: [[1, 2], [1, 2], [2, 3], [2, 3], [3, 4], [3, 4], [4, 6], [4, 6], [4, 6]],   // trainer team size by badges (min, max)
  AVATAR: { youngster: 'youngster', lass: 'lass', picnicker: 'picnicker', hiker: 'hiker', fisherman: 'fisherman', rancher: 'cowgirl', farmer: 'cowgirl' },
  reset() { this.list = []; },
  load(defs = [...(window.ADV_NPCS || []), ...ADV.roomNpcs()]) {
    this.list = defs.map(d => ({ id: d.id, def: d, e: null, face: d.face | 0, home: { x: (d.x + 0.5) * ADV.Tc(d.x), y: (d.y + 0.5) * ADV.Tc(d.x) }, busy: false, moving: false, walkD: 0, animT: 0, wait: 1 + (d.x * 7 + d.y * 3) % 5, go: null, wp: 0, stuck: 0 }));
  },
  files() { const R = window.TRAINER_OW_RANGER || {}, O = window.TRAINER_OW8 || window.TRAINER_OW || {}; return [...new Set(this.list.map(n => (R[n.def.sprite] || O[n.def.sprite])?.file).filter(Boolean))]; },
  beaten: n => !!ADV.player?.beat?.[n.id],
  // S2: somebody inside a building (def.room = its id) is seen, talked to and spotted by only while the building is cut away
  vis(n) { const b = n.def.room && ADV.bldById.get(n.def.room); return !b || b.k > 0; },

  // ---------- level bands (Appendix A caps, keyed by badge count; 8 badges = the True Team cap) ----------
  // wild: cap-8..cap-4, route trainers: cap-5..cap-2, gym trainers: cap-3..cap-1
  range(kind, badges) { const c = ADVW.CAPS[Math.max(0, Math.min(8, badges | 0))], o = { wild: [8, 4], route: [5, 2], gym: [3, 1] }[kind]; return [c - o[0], c - o[1]]; },
  bandKey: badges => badges >= 8 ? 'true' : 'b' + (badges + 1),   // a leader's roster for a challenger with this many badges
  hash(s) { let h = 7; for (const ch of String(s)) h = Math.imul(h, 31) + ch.charCodeAt(0) | 0; return h >>> 0; },
  // the trainer's team for a challenger: first N of its list (N by band, fixed per trainer), levels from the band, species evolved to match
  // a leader's team for a challenger with this many badges: its Appendix A roster for that band (data/adv/rosters.js), the ace sent out last
  leaderTeam(who, badges = ADV.player?.badges | 0) {
    const r = window.ADV_ROSTERS?.[who]?.[this.bandKey(badges)] || [];
    return [...r.filter(m => !m.ace), ...r.filter(m => m.ace)].map(m => ({ species: m.species, level: m.level, moves: m.moves, ace: !!m.ace }));
  },
  // beating trainer n: pays, remembers it, and a leader hands out the badge and the TM the first time only. Returns { pay, badge?, tm? }
  win(sv, n, team) {
    const t = n.def.trainer, first = !sv.beat[n.id], pay = this.pay(t, team), r = { pay };
    sv.money += pay; sv.beat[n.id] = 1;
    if (t.leader && first) { sv.badges = Math.min(8, (sv.badges | 0) + 1); (sv.medals ||= []).push(t.badge); r.badge = t.badge; if (t.tm) { ADVP.add(sv.bag, t.tm); r.tm = t.tm; } }
    return r;
  },
  team(t, id, badges = ADV.player?.badges | 0) {
    if (t.leader) return this.leaderTeam(t.leader, badges);
    const b = Math.max(0, Math.min(8, badges | 0)), [lo, hi] = this.SIZE[b], n = Math.min(t.team.length, lo + this.hash(id) % (hi - lo + 1)), [a, z] = this.range(t.gym ? 'gym' : 'route', b);
    return t.team.slice(0, n).map(([sp, rel]) => { const lv = Math.min(z, a + rel); return { species: ADVW.evolve(sp, lv), level: lv }; });
  },
  pay: (t, team) => t.money * Math.max(...team.map(m => m.level)),
  avatar: t => t.avatar || ADVN.AVATAR[t.cls.toLowerCase()] || 'youngster',

  // ---------- line of sight ----------
  // does trainer n see a foot at (x, y) on level lv: inside its facing line (cardinal) within `sight` tiles, same level, nothing solid in between
  sees(n, x, y, lv) {
    const t = n.def.trainer, e = n.e; if (!t || !e || e.lv !== lv) return false;
    const T = ADV.Tp(e.x), v = DIR_VEC[n.face], dx = x - e.x, dy = y - e.y, along = dx * v[0] + dy * v[1], lat = Math.abs(dx * v[1] - dy * v[0]);
    if (along < 6 || along > t.sight * T || lat > 14) return false;
    for (let s = 8; s < along; s += 8) {
      const px = e.x + v[0] * s, py = e.y + v[1] * s, c = Math.floor(px / T), r = Math.floor(py / T);
      if (ADV.h(c, r) !== lv || ADV.propHit(px, py, 2, e.z)) return false;   // a cliff, a gap in the world or a wall / hedge / tree
    }
    return true;
  },
  // the first undefeated trainer that sees the player
  spot(P) { for (const n of this.list) if (n.def.trainer && !n.busy && !this.beaten(n) && n.e && this.vis(n) && this.sees(n, P.x, P.y, P.lv)) return n; return null; },

  // ---------- behaviour ----------
  place(n) {
    if (n.e) return true;
    const T = ADV.Tp(n.home.x), h = ADV.h(Math.floor(n.home.x / T), Math.floor(n.home.y / T)); if (h < 0) return false;
    n.e = ADV.entity(n.home.x, n.home.y, h); return true;
  },
  // advances every NPC within SIM tiles of the player P; busy ones (talking, spotted you) stand still
  update(dt, P) {
    const S2 = (this.SIM * ADV.Tp(P.x)) ** 2;
    for (const n of this.list) {
      if (Math.hypot(n.home.x - P.x, n.home.y - P.y) ** 2 > S2 || !this.place(n)) continue;
      n.animT += dt; n.moving = false;
      if (n.busy || n.def.move === 'still') continue;
      this.wander(n, dt, P);
    }
  },
  wander(n, dt, P) {
    const e = n.e, T = ADV.Tp(e.x), d = n.def;
    if (!n.go) {
      if ((n.wait -= dt) > 0) return;
      let x, y;
      if (d.move === 'path' && d.path) { const w = d.path[n.wp++ % d.path.length]; x = (w[0] + 0.5) * T; y = (w[1] + 0.5) * T; }
      else { const R = (d.r || 3) * T; x = n.home.x + (Math.random() * 2 - 1) * R; y = n.home.y + (Math.random() * 2 - 1) * R; }
      if (this.okSpot(x, y, e)) n.go = { x, y, t: 6 }; else n.wait = 0.5;
      return;
    }
    const g = n.go, dx = g.x - e.x, dy = g.y - e.y, dist = Math.hypot(dx, dy), x0 = e.x, y0 = e.y;
    if (dist < 3 || (g.t -= dt) <= 0 || n.stuck > 0.8) { n.go = null; n.stuck = 0; n.wait = 1.5 + Math.random() * 3.5; return; }
    ADV.move(e, dx / dist * this.SPEED * dt, dy / dist * this.SPEED * dt);
    if (Math.hypot(e.x - P.x, e.y - P.y) < 15 && e.lv === P.lv) { e.x = x0; e.y = y0; }   // never walks into the player
    const m = Math.hypot(e.x - x0, e.y - y0); n.moving = m > 0.01; n.walkD += m; n.stuck = m > 0.01 ? 0 : n.stuck + dt;
    if (n.moving) n.face = dirFromVec(dx, dy);
  },
  okSpot(x, y, e) { const T = ADV.Tp(x), c = Math.floor(x / T), r = Math.floor(y / T); return ADV.h(c, r) === e.lv && !ADV.blocked(x, y, e.z, 9) && !ADV.kind(c, r); },
  // NPCs are solid like props: push the player out of any NPC circle
  push(p) {
    for (const n of this.list) {
      const e = n.e; if (!e || e.lv !== p.lv) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy); if (d >= 13 || d < 0.01) continue;
      ADV.move(p, dx / d * (13 - d), dy / d * (13 - d));
    }
  },
  // the NPC the player is facing and touching (within TALK px, in front of the face direction)
  target(p) {
    const v = DIR_VEC[p.face]; let best = null, bd = 1e9;
    for (const n of this.list) {
      const e = n.e; if (!e || e.lv !== p.lv || !this.vis(n)) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d < (n.def.reach || this.TALK) && d < bd && (d < 14 || (dx * v[0] + dy * v[1]) / d > 0.35)) { best = n; bd = d; }
    }
    return best;
  },
};
