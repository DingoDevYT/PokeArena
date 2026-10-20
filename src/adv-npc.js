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
  // Every person is drawn in the Pokemon Ranger style: a Ranger sheet when the def names one, otherwise a look built with the character creator (adv-outfit.js) for the role,
  // its colours varied per person so two fishermen are not twins. ROLE: hair, hat (0 none, else index + 1), top, bot, body by sprite name of the older sheets.
  ROLE: { fishing: { hat: 4, top: 4, bot: 4 }, fishing2: { hat: 1, top: 2, bot: 1 }, delivery: { hat: 2, top: 3, bot: 3 }, cowgirl: { body: 1, hair: 1, hat: 3, top: 3, bot: 1 },
    shopm2: { top: 0, bot: 4 }, sportsman: { hat: 1, top: 2, bot: 3 }, doctor: { body: 3, hair: 4, top: 2, bot: 4, topC: 15 } },
  // the older (HGSS / gen 8) sheets by the Ranger person who plays the same part
  ALIAS: { workman: 'npc2-jumpsuit-man', gswoman1: 'npc2-purple-top-woman', gsoldman: 'npc2-old-man', nurse: 'npc3-apron-woman-blue', shopm: 'npc2-blue-jumpsuit-man', shopm2: 'npc2-yellow-suit-man',
    gsboy2: 'npc1-backwards-cap-boy', oldwoman: 'npc3-old-woman-cane', gsmiddleman: 'npc3-dark-haired-man', woman3: 'npc2-dark-hair-woman', boy1: 'npc1-blue-cap-boy', gsmama: 'npc3-apron-woman',
    gsman1: 'npc1-green-shirt-man', gsman2: 'npc2-striped-shirt-man', farmer: 'npc3-man-green-shirt', gsgirl2: 'npc1-ponytail-girl', seaman: 'npc4-sailor', gsman3: 'npc2-bearded-man',
    delivery: 'npc2-yellow-shirt-boy', boy3: 'npc1-red-jacket-boy', gsgirl3: 'npc1-striped-dress-girl', middlewoman: 'npc2-yellow-jacket-woman', bigman: 'npc3-bearded-man',
    gsoldwoman: 'npc3-old-woman-purple', whitney: 'npc4-ponytail-girl-pink', lady: 'npc2-red-jacket-woman', picnicgirl: 'npc4-blonde-girl', sportsman: 'north-headband-brawler', doctor: 'npc5-oak' },
  look(n) {
    const s = n.def.sprite, R = window.TRAINER_OW_RANGER || {}; if (s == null) return null; if (R[s]) return R[s]; if (R[this.ALIAS[s]]) return R[this.ALIAS[s]];
    if (!n.outfit) {
      let h = 2166136261; for (const c of String(n.id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
      const r = k => (h = Math.imul(h ^ k, 2246822519) >>> 0) % 997, role = this.ROLE[s] || {}, N = ADVO.n();
      const o = { body: r(1) % 4, hair: r(2) % N.hair, hairC: r(3) % N.hairC, hat: 0, hatC: r(4) % N.hatC, top: r(5) % N.top, topC: r(6) % N.topC, bot: r(7) % N.bot, botC: r(8) % N.botC, bag: 0, bagC: 0, skin: r(9) % N.skin, ...role };
      n.outfit = ADVO.clean(o);
    }
    return ADVO.sheet(n.outfit);
  },
  files() { const R = window.TRAINER_OW_RANGER || {}, O = window.TRAINER_OW8 || window.TRAINER_OW || {}; return [...new Set(this.list.map(n => (R[n.def.sprite] || R[this.ALIAS[n.def.sprite]])?.file).filter(Boolean)), ...(this.list.some(n => n.def.sprite != null && !R[n.def.sprite] && !R[this.ALIAS[n.def.sprite]]) ? ADVO.files() : [])]; },
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
    let l0 = a, h1 = z; const top = ADVW.partyTop(); if (!t.gym && top > 0 && h1 > top + ADVW.UP) { h1 = Math.max(2, top + ADVW.UP); l0 = Math.min(l0, Math.max(2, h1 - 3)); }   // route trainers: held near the party like the wild; gym trainers keep the band
    return t.team.slice(0, n).map(([sp, rel]) => { const lv = Math.min(h1, l0 + rel); return { species: ADVW.evolve(sp, lv), level: lv }; });
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
      n.animT += dt; n.moving = false; if (n.bub && (n.bub.t += dt) > 2.4) n.bub = null;
      if (n.busy) continue;
      this.life(n, dt, P);
      if (n.def.move === 'still' && !n.pot) continue;
      this.wander(n, dt, P);
    }
  },
  // people are alive: someone close turns to face you, villagers who stand still look about now and then, some outdoors potter round their spot, and now and then
  // one shows a mood bubble. Trainers keep the way they face (it is their line of sight); people inside buildings stay at their posts.
  BUBS: ['...', '\u266a', '!', '?', '\u2665'],
  life(n, dt, P) {
    const e = n.e, d = n.def, T = ADV.Tp(e.x), near = e.lv === P.lv && Math.hypot(e.x - P.x, e.y - P.y) < 2.2 * T, h = this.hash(n.id);
    const fresh = d.trainer && !this.beaten(n);   // a trainer still waiting for a battle
    if (near && !n.go && !fresh) { n.face = dirFromVec(P.x - e.x, P.y - e.y); n.look = 2; return; }
    if (fresh) { if (h % 2 === 0 && (n.look = (n.look ?? 2 + h % 3) - dt) <= 0) { n.look = 2.5 + Math.random() * 3; n.face = n.face === (d.face | 0) ? ((d.face | 0) + (h % 4 < 2 ? 2 : 6)) % 8 : d.face | 0; } return; }   // half of them glance a quarter turn and back, like the classic trainers
    if (d.trainer) return;
    if (d.move === 'still' && !d.room && h % 3 === 0 && n.pot === undefined) n.pot = true;   // a third of the outdoor villagers potter about (d.r 1)
    if (d.move === 'still' && !n.pot && (n.look = (n.look ?? 2 + h % 4) - dt) <= 0) { n.look = 3 + Math.random() * 5; n.face = Math.random() < 0.4 ? (d.face | 0) : [0, 2, 4, 6][Math.floor(Math.random() * 4)]; }
    if (!n.bub && Math.hypot(e.x - P.x, e.y - P.y) < 7 * T && Math.random() < dt * 0.025) n.bub = { s: this.BUBS[Math.floor(Math.random() * this.BUBS.length)], t: 0 };
  },
  wander(n, dt, P) {
    const e = n.e, T = ADV.Tp(e.x), d = n.def;
    if (!n.go) {
      if ((n.wait -= dt) > 0) return;
      let x, y;
      if (d.move === 'path' && d.path) { const w = d.path[n.wp++ % d.path.length]; x = (w[0] + 0.5) * T; y = (w[1] + 0.5) * T; }
      else { const R = (n.pot ? 1 : d.r || 3) * T; x = n.home.x + (Math.random() * 2 - 1) * R; y = n.home.y + (Math.random() * 2 - 1) * R; }
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
