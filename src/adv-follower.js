// The lead Pokemon that trails you (Adventure): breadcrumb follow + chase maths, the mood model behind "talk to it", the idle behaviour menu. Pure logic so tools/adv-check.mjs can run it in node; the scene (adv-scene.js) owns drawing and the world queries.
// Lines live in data/adv/follower-moods.js (ADV_FOLLOWER). Events are kept on the save as save.f.events (a ring of the last EV_KEEP, each { k, t (ms), ...detail }).
'use strict';
const ADVF = {
  FD: 1.75, MIN: 1.1,      // trail this many tiles behind; never closer than MIN tiles (the push-out in chase)
  EV_KEEP: 10, rnd: Math.random,
  KINDS: ['win', 'lose', 'faint', 'level', 'evolve', 'move', 'catch', 'heal', 'town'],

  // ---------- save ----------
  // a save from before the follower has no save.f: give it the defaults (also trims junk out of a hand-edited file)
  fix(sv) {
    if (!sv.f || typeof sv.f !== 'object' || Array.isArray(sv.f)) sv.f = {};
    sv.f.events = (Array.isArray(sv.f.events) ? sv.f.events : []).filter(e => e && this.KINDS.includes(e.k) && Number.isFinite(e.t)).slice(-this.EV_KEEP);
    return sv.f;
  },
  note(sv, k, o = {}, now = Date.now()) { const f = this.fix(sv); f.events.push({ ...o, k, t: now }); if (f.events.length > this.EV_KEEP) f.events.splice(0, f.events.length - this.EV_KEEP); },
  // events still worth feeling, newest first, each with its weight (halves every `half` seconds, gone after 3 half-lives)
  live(events, now, half = window.ADV_FOLLOWER?.half || 600) {
    return (events || []).map(e => ({ e, w: Math.pow(0.5, Math.max(0, now - e.t) / 1000 / half) })).filter(x => x.w >= 0.125).reverse();
  },

  // ---------- mood ----------
  // m = { hpf 0..1, status, friend, level, types: ['Fire', ...] }, env = { weather: rain|snow|sun|'', night, indoors, cave, water, grass, snow, town }.
  // Returns { tone, emo: portrait fallback list, src: { kind, key, ev } } where src names what drove it most (picks the line pool).
  mood(m, events, env, now = Date.now()) {
    const T = new Set((m.types || []).map(t => String(t).toLowerCase())), has = (...a) => a.some(t => T.has(t));
    const sc = {}, why = {};
    const add = (tone, v, kind, key, ev) => { sc[tone] = (sc[tone] || 0) + v; if (!why[tone] || v > why[tone].v) why[tone] = { v, kind, key, ev }; };
    add('calm', 0.4, 'base');
    const hpf = m.hpf ?? 1;
    if (hpf <= 0.25) add('hurt', 3.4, 'state', 'hp_low'); else if (hpf < 0.5) add('worried', 1.7, 'state', 'hp_mid');
    if (['psn', 'brn', 'par', 'tox'].includes(m.status)) add('hurt', 2.2, 'state', 'status');
    for (const { e, w } of this.live(events, now)) {
      if (e.k === 'win') { add('proud', 2.3 * w, 'ev', e.k, e); add('happy', 0.8 * w, 'ev', e.k, e); }
      else if (e.k === 'level') add('joy', 3 * w, 'ev', e.k, e);
      else if (e.k === 'evolve') add('joy', 3.4 * w, 'ev', e.k, e);
      else if (e.k === 'move') add('proud', 1.6 * w, 'ev', e.k, e);
      else if (e.k === 'catch') add('happy', 1.9 * w, 'ev', e.k, e);
      else if (e.k === 'heal') add('happy', 1.5 * w, 'ev', e.k, e);
      else if (e.k === 'town') add('curious', 1.8 * w, 'ev', e.k, e);
      else if (e.k === 'lose') { add('sad', 3.2 * w, 'ev', e.k, e); add('worried', 1 * w, 'ev', e.k, e); }
      else if (e.k === 'faint') { add('sad', 2.1 * w, 'ev', e.k, e); add('worried', 1.2 * w, 'ev', e.k, e); }
    }
    const wx = env.weather || (env.snow ? 'snow' : '');
    if (wx === 'rain') {
      if (has('fire')) add('uneasy', 2.6, 'env', 'rain_fire'); else if (has('water')) add('happy', 2, 'env', 'rain_water'); else add('calm', 0.5, 'env', 'rain');
    } else if (wx === 'snow') {
      if (has('ice')) add('happy', 2.6, 'env', 'snow_ice'); else if (has('fire')) add('uneasy', 1.9, 'env', 'snow_fire'); else add('curious', 0.9, 'env', 'snow');
    } else if (wx === 'sun') {
      if (has('fire', 'grass')) add('happy', 1.6, 'env', 'sun_fire'); else if (has('ice')) add('uneasy', 1.9, 'env', 'sun_ice');
    }
    if (env.night) { if (has('ghost', 'dark')) add('playful', 2.2, 'env', 'night_ghost'); else add('sleepy', 1.5, 'env', 'night'); }
    if (env.water && has('water')) add('happy', 2.1, 'env', 'water_near');
    if (env.grass && has('grass', 'bug')) add('playful', 1.3, 'env', 'grass');
    if (env.cave) { if (has('rock', 'ground', 'dark', 'ghost', 'bug', 'poison')) add('curious', 1, 'env', 'cave_ok'); else add('worried', 2, 'env', 'cave_bad'); }
    if (env.indoors && !env.cave) add('calm', 0.6, 'env', 'indoors');
    else if (env.town && !env.indoors) add('curious', 0.4, 'env', 'town');
    const fr = m.friend ?? 70, k = fr >= 200 ? 1.2 : fr < 70 ? 0.75 : 1;   // a bonded mon feels everything more, a new one holds back
    for (const t of ['joy', 'happy', 'playful', 'proud']) if (sc[t]) sc[t] *= fr < 70 ? 0.75 : k;
    if (fr >= 200) for (const t of ['sad', 'hurt']) if (sc[t]) sc[t] *= 1.2;
    if ((m.level | 0) >= 50 && sc.playful) sc.playful *= 0.7;
    let tone = 'calm'; for (const t in sc) if (sc[t] > sc[tone] + 1e-9) tone = t;
    return { tone, emo: (window.ADV_FOLLOWER?.tones[tone] || { emo: ['Normal'] }).emo, src: why[tone] || { kind: 'base' }, score: sc };
  },
  // the first emotion in the list the species has a portrait for, else Normal
  emotion(list, P) { return (list || []).find(e => P && P[e]) || 'Normal'; },

  // ---------- words ----------
  fill(s, v) { return String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? '')); },
  // v = { n, sp, lv }; doing = what it is up to ('sleep', 'eat', ...) or ''. Returns one short line.
  line(mood, v, doing = '', rnd = this.rnd) {
    const D = window.ADV_FOLLOWER, pick = a => a[Math.floor(rnd() * a.length) % a.length], s = mood.src || {};
    let pool;
    if (doing === 'sleep') pool = D.doing.sleep;
    else if (doing && D.doing[doing] && rnd() < 0.45) pool = D.doing[doing];
    else if (s.kind === 'ev' && D.events[s.key]) { pool = D.events[s.key]; v = { ...v, ...this.evVars(s.ev) }; }
    else if (s.kind === 'env' && D.env[s.key]) pool = D.env[s.key];
    else if (s.kind === 'state' && D.state[s.key]) pool = D.state[s.key];
    else { pool = D.tones[mood.tone].lines; if (v.friend >= 200 && rnd() < 0.25) pool = D.bond.high; else if (v.friend < 70 && rnd() < 0.25) pool = D.bond.low; }
    return this.fill(pick(pool), v);
  },
  evVars: e => ({ foe: e.foe || 'that fight', town: e.town || 'town', mv: e.mv || 'a new move', to: e.to || 'something new', who: e.who || 'a teammate', nm: e.nm || 'Pokemon', lv: e.lv || '' }),

  // ---------- follow maths (px, world space) ----------
  // breadcrumbs: { x, y, z, sz, s } with s = path length so far. The goal is the point D behind the newest crumb along the path.
  trailPush(L, p) { const last = L[L.length - 1], d = Math.hypot(p.x - last.x, p.y - last.y); if (d >= 2) L.push({ x: p.x, y: p.y, z: p.z, sz: p.sz, s: last.s + d }); },
  trailGoal(L, D) {
    const goal = L[L.length - 1].s - D;
    while (L.length > 2 && L[1].s <= goal - 8) L.shift();
    let i = 0; while (i < L.length - 2 && L[i + 1].s < goal) i++;
    const a = L[i], b = L[i + 1], u = b.s > a.s ? Math.min(1, Math.max(0, (goal - a.s) / (b.s - a.s))) : 1;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, sz: a.sz + (b.sz - a.sz) * u };
  },
  // one chase step of f toward (gx, gy): speed eases with the gap (so it brakes when you stop), capped at `cap` px/s, and f is never left closer than `min` px to p.
  // Sets f.vx / f.vy (smoothed velocity) and f.sp (smoothed speed); returns the distance moved.
  chase(f, gx, gy, p, dt, cap = 420, min = 64, K = 7) {
    const x0 = f.x, y0 = f.y, gd = Math.hypot(gx - p.x, gy - p.y);
    if (gd < min) { const fx = f.x - p.x, fy = f.y - p.y, fd = Math.hypot(fx, fy) || 1, ux = gd > 0.01 ? (gx - p.x) / gd : fx / fd, uy = gd > 0.01 ? (gy - p.y) / gd : fy / fd; gx = p.x + ux * min; gy = p.y + uy * min; }   // a goal inside the keep-out circle (a U-turn) is pushed out to its edge
    const dx = gx - f.x, dy = gy - f.y, d = Math.hypot(dx, dy);
    if (d > 0.4) { const s = Math.min(cap * dt, d * Math.min(1, K * dt)); f.x += dx / d * s; f.y += dy / d * s; } else { f.x = gx; f.y = gy; }
    this.sep(f, p, min);
    return this.vel(f, f.x - x0, f.y - y0, dt);
  },
  // never leave f closer than `min` px to p: you walking into it just pushes it along
  sep(f, p, min) {
    let dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
    if (d >= min) return;
    if (d < 0.01) { dx = 0; dy = 1; d = 1; }
    f.x = p.x + dx / d * min; f.y = p.y + dy / d * min;
  },
  // smoothed velocity and speed from a real displacement
  vel(f, mx, my, dt) {
    const k = 1 - Math.exp(-12 * dt), vx = mx / dt, vy = my / dt;
    f.vx = (f.vx || 0) + (vx - (f.vx || 0)) * k; f.vy = (f.vy || 0) + (vy - (f.vy || 0)) * k;
    f.sp = (f.sp || 0) + (Math.hypot(vx, vy) - (f.sp || 0)) * k;
    return Math.hypot(mx, my);
  },
  // walk vs idle with hysteresis: enter Walk above 22 px/s, leave below 10 px/s, and only after the opposite state held for 0.15 s. Returns true when the state flipped.
  loco(f, dt) {
    const walk = f.loco === 'Walk', want = walk ? f.sp > 10 : f.sp > 22;
    if (want === walk) { f.locoT = 0; return false; }
    if ((f.locoT = (f.locoT || 0) + dt) < 0.15) return false;
    f.loco = want ? 'Walk' : 'Idle'; f.locoT = 0; return true;
  },
  // facing: the target is the direction of the smoothed velocity (ignored under 20 px/s and while within 31 degrees of the current facing, so a wobbling path cannot flick it),
  // then f.face turns one 45 degree step at a time, at most every 70 ms
  aim(f, dt) {
    if (f.sp > 20) {
      const v = DIR_VEC[f.face], a = Math.atan2(f.vy, f.vx), b = Math.atan2(v[1], v[0]), d = Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d > 0.55) f.want = dirFromVec(f.vx, f.vy);
    }
    this.turn(f, dt);
  },
  turn(f, dt) {
    if (f.want === undefined || f.want === f.face) { f.turnT = 0; return; }
    if ((f.turnT = (f.turnT || 0) + dt) < 0.07) return;
    f.turnT = 0; const d = (f.want - f.face + 8) % 8; f.face = (f.face + (d <= 4 ? 1 : 7)) % 8;
  },
};
