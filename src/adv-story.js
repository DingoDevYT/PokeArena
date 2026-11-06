// The story (data/adv/story.js, written up in docs/STORY.md). A beat opens when the player has `stage` badges (and no more than `maxBadges`) and the beats
// in its `after` are done. It happens in a place: 'home' (the hometown), 'any' (whatever gym city or town you are in, or reach next), 'away' (the same but not
// home), a place code (G5, T6, L1) or { zone }. A 'talk' beat puts its first speaker by that town's Pokemon Center with a "!" over them and runs when you talk
// to them; an 'enter' beat runs when you arrive (or the moment it opens while you are there). Scripts are steps: say, battle (then win / lose branches),
// give, heal, flag, leave. Story state lives in the save (save.story = { done, flags }), per player. The next open main-line beat's `goal` leads the NEXT GOAL
// panel (adv-map.js). The cast stand only while their beat needs them; a blackout drops the beat, which starts again from its first step.
const ADVSTORY = {
  run: null, cast: new Map(), wait: 0,
  st(sv = ADV.player) { if (!sv) return { done: {}, flags: {} }; if (!sv.story || typeof sv.story !== 'object') sv.story = { done: {}, flags: {} }; sv.story.done ||= {}; sv.story.flags ||= {}; return sv.story; },
  beats() { return window.ADV_STORY?.beats || []; },
  castOf(id) { return window.ADV_STORY?.cast?.[id] || { name: id }; },
  open(sv) { const s = this.st(sv), b = sv.badges | 0; return this.beats().filter(x => !s.done[x.id] && b >= x.stage && (x.maxBadges === undefined || b <= x.maxBadges) && (x.after || []).every(a => s.done[a])); },
  main(sv) { return this.open(sv).find(x => !x.optional); },
  fill(s, sv = ADV.player) { const lead = sv?.party?.find(m => m.hp > 0) || sv?.party?.[0]; return String(s).replace(/\{player\}/g, sv?.name || 'you').replace(/\{partner\}/g, lead ? ADVP.name(lead) : 'your partner').replace(/\{home\}/g, ADVS.town(sv?.home)?.name || 'home'); },
  // the place code the player is in: a gym city or town (its 28 tile disc), or a landmark (24 tiles round its centre), or ''
  place(sc) {
    const p = sc.p, t = ADVS.inTown(p.x, p.y); if (t) return t;
    const W = window.ADV_WORLD?.towns || {}; for (const k in W) if (/^L/.test(k) && W[k].center && Math.hypot(p.x - W[k].center.x, p.y - W[k].center.y) < 24 * ADV.T) return k;
    return '';
  },
  here(b, code, sc) {
    const w = b.where || {}, sv = sc.save;
    if (w.zone) return ADVW.zone(sc.p.x, sc.p.y) === w.zone;
    if (w.town === 'home') return code === sv.home;
    if (w.town === 'any') return /^[GT]/.test(code);
    if (w.town === 'away') return /^[GT]/.test(code) && code !== sv.home;
    return code === w.town;
  },
  // NEXT GOAL: the next main-line beat's goal (tokens filled), pinned on its place when it has a fixed one
  goal(sc) {
    const b = this.main(sc.save); if (!b || !b.goal) return null;
    const w = b.where || {}, t = w.town && !['home', 'any', 'away'].includes(w.town) ? ADVS.town(w.town) : w.town === 'home' ? ADVS.town(sc.save.home) : null;
    const who = b.trigger === 'talk' && (b.who || b.script.find(s => s.say && s.say !== 'player')?.say), n = who && this.cast.get(who);
    if (this.cool?.id === b.id && this.cool.who && t?.center) return { line: `${this.cool.who} is still in ${t.name}. Train up, step out of town, then come back.`, story: b, x: t.center.x, y: t.center.y };   // after a lost must-win fight (it said "Go to Spindlewood" while you stood in it)
    if (n?.e) return { line: this.fill(b.goal, sc.save).replace('the next Pokemon Center', 'the Pokemon Center'), story: b, x: n.e.x, y: n.e.y };   // they are here now, not at the next one   // the cast member is standing there now: the pin and bearing point at them, not at the town
    return { line: this.fill(b.goal, sc.save), story: b, ...(t?.center ? { x: t.center.x, y: t.center.y } : {}) };
  },

  // ---------- each frame in walk mode ----------
  update(sc, dt) {
    if (!window.ADV_STORY || !sc.save || sc.net?.N?.online) return;
    for (const [k, n] of this.cast) if (!ADVN.list.includes(n)) this.cast.delete(k);   // ADVN.load (a new save, a blackout) cleared them
    if (this.run) {   // a beat whose text box or battle was cut off (a warp, a blackout) would wait for ever: drop it, it starts again from its first step
      if (!sc.dlg && !sc.inB && !this.run.fighting && sc.mode === 'walk' && !sc.uis.length) { if ((this.run.idle = (this.run.idle || 0) + dt) > 1) this.abort(); } else this.run.idle = 0;
      return;
    }
    if ((this.wait -= dt) > 0) return; this.wait = 0.4;
    if (!sc.ready || sc.mode !== 'walk' || sc.uis.length || sc.dlg || sc.inB) return;
    const code = this.place(sc), open = this.open(sc.save), want = new Set();
    if (this.cool) { if (this.cool.code === undefined) this.cool.code = code; else if (this.cool.code !== code) this.cool = null; }
    for (const b of open) {
      if (!this.here(b, code, sc) || b.id === this.cool?.id) continue;
      if (b.trigger === 'enter') { if (!sc.room) return this.start(sc, b); continue; }
      const who = b.who || b.script.find(s => s.say && s.say !== 'player')?.say; if (!who || !/^[GT]/.test(code)) continue;
      want.add(who); const n = this.cast.get(who);
      if (!n) { const t = ADVS.town(code), f = ADVS.front(t), sp = b.spot || { dx: 2, dy: 1 }, at = this.free(f.x + sp.dx * ADV.T, f.y + sp.dy * ADV.T); this.spawn(who, at.x, at.y, b.id); }
      else { n.def.story = b.id; if (!n.busy) n.bub = { s: '!', t: 0 }; }
    }
    for (const [k, n] of this.cast) if (!want.has(k) && !n.busy) this.drop(k);   // you left town, or the beat closed
  },
  // the nearest free, walkable spot to (x, y) on the ground there
  free(x, y) {
    const T = ADV.T, ok = (px, py) => { const c = Math.floor(px / T), r = Math.floor(py / T), h = ADV.h(c, r); return h >= 0 && !ADV.blocked(px, py, ADV.heightAt ? ADV.heightAt(px, py, h) : 0, 12) && !ADV.isWater(c, r) && !this.hidden(px, py); };
    for (let rr = 0; rr <= 6; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue; const px = x + dx * T * 0.5, py = y + dy * T * 0.5; if (ok(px, py)) return { x: px, y: py }; }
    return { x, y };
  },
  // would a tall prop just south of (x, y) be drawn over someone standing there (Ethan spoke from behind a tree at the Spindlewood docks)
  hidden(x, y) {
    const T = ADV.T, c = Math.floor(x / T), r = Math.floor(y / T), seen = new Set();
    for (const [dc, dr] of [[-1, 0], [0, 0], [1, 0], [-1, 2], [0, 2], [1, 2]]) {
      const ch = ADV.chunkAt?.(c + dc, r + dr); if (!ch || seen.has(ch)) continue; seen.add(ch);
      for (const p of ch.props) {
        if (p.y <= y || p.y > y + 2.5 * T) continue;
        const pd = ADV.propDef(p.n); if (!pd || !pd.sh) continue;
        const k = ADV.dk ? ADV.dk(pd, p.x) : 1, top = p.y - (pd.ay ?? pd.sh) * k, l = p.x - (pd.ax ?? pd.sw / 2) * k, rr = l + pd.sw * k;
        if (pd.sh * k > 1.2 * T && top < y - 24 && l < x + 10 && rr > x - 10) return true;
      }
    }
    return false;
  },
  spawn(who, x, y, beat) {
    const c = this.castOf(who), d = { id: 'story-' + who, sprite: c.sprite || 'normal-normal', face: 0, move: 'still', name: this.label(c, who), lines: ['...'], script: 'story', story: beat, cast: who };
    const n = { id: d.id, def: d, e: null, face: 0, home: { x, y }, busy: false, moving: false, walkD: 0, animT: 0, wait: 1, go: null, wp: 0, stuck: 0, bub: { s: '!', t: 0 } };
    ADVN.list.push(n); ADVN.place(n); this.cast.set(who, n); return n;
  },
  // a speaker left far away (a fight moved you off): they step up beside you so the scene plays on screen
  near(sc, n) { const p = sc.p, k = [...this.cast.values()].indexOf(n), at = this.free(p.x + (k % 2 ? 1 : -1) * ADV.T * (1.4 + 0.5 * k), p.y - ADV.T * 0.4); n.home = { x: at.x, y: at.y }; n.go = null; n.e = null; ADVN.place(n); },
  label(c, who) {
    const nm = c.name || who, met = 'met-' + who;
    if (this.beats().some(b => b.script.some(s => s.flag === met)) && !this.st().flags[met]) return nm;   // no 'Rival' on Ethan's plate before he has introduced himself (the story flags met-ethan)
    return c.cls && !nm.toLowerCase().includes(c.cls.toLowerCase().slice(0, 4)) ? c.cls + ' ' + nm : nm;
  },   // 'Rival Ethan', but 'Prof. Linden' not 'Professor Prof. Linden'
  drop(who) { const n = this.cast.get(who); if (n) { const i = ADVN.list.indexOf(n); if (i >= 0) ADVN.list.splice(i, 1); } this.cast.delete(who); },
  // a speaker for an 'enter' beat (or one who has not appeared yet) steps up near you
  speaker(sc, who) {
    if (who === 'player') return null;
    let n = this.cast.get(who); if (n) return n;
    const p = sc.p, v = DIR_VEC[p.face] || [0, 1], k = this.cast.size, side = k % 2 ? 1 : -1, at = this.free(p.x + v[0] * ADV.T * 1.6 - v[1] * side * k * ADV.T * 0.6, p.y + v[1] * ADV.T * 1.6 + v[0] * side * k * ADV.T * 0.6);
    n = this.spawn(who, at.x, at.y, this.run?.beat.id); n.bub = null; return n;
  },

  // ---------- running a beat ----------
  talk(sc, n) { const b = this.beats().find(x => x.id === n.def.story); if (!b || !this.open(sc.save).includes(b)) return sc.dialog([this.castOf(n.def.cast).name + ' is lost in thought.'], n, () => { n.busy = false; }); this.start(sc, b, n); },
  start(sc, b) { const nb = this.lost?.[b.id] || 0, at = b.script.map((s, i) => s.battle ? i : -1).filter(i => i >= 0), k = nb ? (at[nb - 1] ?? -1) : -1;   // the battle you lost (Jet, not the grunt you had beaten)
    this.run = { beat: b, steps: b.script.slice(), i: k > 0 ? k - 1 : 0, bn: k > 0 ? nb - 1 : 0 }; sc.p.moving = false; this.next(sc); },   // a retry after a lost must-win fight starts at the line before the battle, not the whole scene
  next(sc) {
    const r = this.run; if (!r) return; const sv = sc.save;
    while (r.i < r.steps.length) {
      const s = r.steps[r.i++];
      if (s.say) { const n = this.speaker(sc, s.say); if (n) { n.busy = true; n.bub = null; if (n.e && Math.hypot(n.e.x - sc.p.x, n.e.y - sc.p.y) > 5 * ADV.T) this.near(sc, n); if (n.e) { n.face = dirFromVec(sc.p.x - n.e.x, sc.p.y - n.e.y); sc.p.face = dirFromVec(n.e.x - sc.p.x, n.e.y - sc.p.y); } }
        return sc.dialog([].concat(s.lines).map(l => this.fill(l, sv)), n || (s.say === 'player' ? { def: { name: sv.name } } : null), () => this.next(sc)); }   // your own lines carry your name plate
      if (s.battle) return this.fight(sc, s);
      if (s.win || s.lose) continue;   // only reached right after a battle (after() takes the branch)
      if (s.give) { const it = ADVP.item(s.give), n = s.n || 1; ADVP.add(sv.bag, s.give, n); uiBlip(880, 0.05); return sc.dialog([`${sv.name} received ${n > 1 ? n + ' x ' : /^[AEIOU]/i.test(it.name) ? 'an ' : 'a '}${it.name}!`], null, () => this.next(sc)); }
      if (s.heal) { sv.party.forEach(m => ADVP.heal(m)); sc.flash = 0.5; continue; }
      if (s.flag) { this.st(sv).flags[s.flag] = 1; continue; }
      if (s.leave) { this.drop(s.leave); continue; }
    }
    this.finish(sc);
  },
  finish(sc) {
    const r = this.run; this.run = null; if (!r) return;
    this.st(sc.save).done[r.beat.id] = 1; if (this.lost) delete this.lost[r.beat.id];
    for (const k of [...this.cast.keys()]) this.drop(k);
    sc.persist(); this.wait = 0.2; sc.mode = 'walk';
  },
  // a story battle: the cast member's roster for the challenger's band (or a named list), the ace last; hold keeps it near the party like a route trainer, max sends the last n
  fight(sc, s) {
    const sv = sc.save, c = this.castOf(s.battle), n = this.speaker(sc, s.battle), R = window.ADV_ROSTERS?.[s.battle], st = this.run.beat.stage;
    const bb = typeof st === 'number' ? Math.min(sv.badges | 0, st) : sv.badges | 0;   // the team of the stage the beat opened at: winning a gym while a boss waits for a retry made the boss bigger (Jet went from 4 mons at Lv22-24 to 5 at Lv27-29)
    let team = Array.isArray(s.team) ? ADVN.team({ team: s.team, cls: c.cls || '' }, 'story-' + this.run.beat.id, bb)   // an inline route-trainer team (grunts), held near the party
      : s.team && R?.[s.team] ? R[s.team].map(m => ({ species: m.species, level: m.level, moves: m.moves, ace: !!m.ace })) : ADVN.leaderTeam(s.battle, bb);
    if (!team.length) return this.next(sc);
    if (s.mustWin || sv.party.reduce((s, m) => s + Math.max(0, m.hp | 0), 0) < 0.5 * sv.party.reduce((s, m) => s + ADVP.max(m), 0)) { sv.party.forEach(m => ADVP.heal(m)); sc.flash = 0.5; }   // a worn-out team is patched up before a story battle, and always before one you must win (Soot's came straight after the survey)
    if (s.hold) { const cap = Math.max(5, ADVW.partyTop(sv) + ((sv.badges | 0) ? ADVW.UP : 0)); team = team.map(m => ({ ...m, level: Math.min(m.level, cap), moves: m.level > cap ? undefined : m.moves })); }   // the very first fight meets your level; later held fights may be 2 over
    if (s.max) team = team.slice(-s.max);
    if (s.minus) team = team.map(m => ({ ...m, level: Math.max(2, m.level - s.minus), moves: undefined }));   // a softer first meeting (moves follow the new level)
    this.run.bn = (this.run.bn || 0) + 1;
    n.def.trainer = { cls: c.cls && !(c.name || '').toLowerCase().includes(c.cls.toLowerCase()) ? c.cls : '', name: c.name || s.battle,   // no 'Grunt Umbra Grunt' on the plate
      avatar: c.avatar, money: 50, story: true, mustWin: !!s.mustWin, fixed: team, say: '', lose: [] };
    n.busy = true; this.run.fighting = true; sc.startTrainer(n);
  },
  // the scene calls this when a story battle ends: won, or lost without mustWin (a mustWin loss is a blackout: abort())
  after(sc, won) {
    const r = this.run; if (!r) return; r.fighting = false;
    for (const n of this.cast.values()) if (n.def.trainer) n.def.trainer = null;
    const s = r.steps[r.i]; if (s && (s.win || s.lose)) r.steps.splice(r.i, 1, ...((won ? s.win : s.lose) || []));
    this.next(sc);
  },
  abort() {
    if (this.run?.fighting) { const r = this.run, who = r.steps[r.i - 1]?.battle || r.steps[r.i]?.battle; (this.lost ||= {})[r.beat.id] = r.bn || 1; this.cool = { id: r.beat.id, who: (who && this.castOf(who)?.name) || '' }; }   // a must-win loss: that beat waits until you have left town and come back (it restarted the moment you woke at that town's Center, with no way out to train)
    this.run = null; for (const k of [...this.cast.keys()]) this.drop(k); },   // a must-win fight lost: the retry skips the scene before it
};
