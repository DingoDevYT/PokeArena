// Online sync, host-authoritative: the host runs the real sim and streams snapshots; the guest renders them and sends its input.
// Pure data (no DOM, no network) so tools/net-check.mjs can run it headless. Transport lives in online.js.
// Traffic is split by urgency: snapshots + analog input ride an unordered channel (newest wins, stale ones are dropped by seq);
// button presses, team data and one-off effects/sounds ride a reliable channel so they are never lost.
// The guest predicts its own walking from its input and reconciles against the host's position, so its controls feel instant.
// Wire format v3 (docs/ONLINE.md): messages are plain objects (PeerJS stringifies once). A snapshot is the full state tree on the first send
// and a diff against the last tree the guest acknowledged after that; teams are diffed against the previous send. Cosmetics (floats,
// callouts, quake debris, beam trails) are rebuilt on the guest instead of being streamed.
const NETSYNC = (() => {
  const SNAP_DT = 0.05, IN_DT = 1 / 30, KEEP_DT = 0.1, TEAMS_DT = 0.5, BACKLOG = 6000, FX_BACKLOG = 24000, MAX_SNAP = 12000, RING = 30, GRING = 64;
  // render-only caches and host-only bookkeeping never travel; cr/rk (quake debris) and trail are rebuilt on the guest
  const DROP = new Set(['ai', 'intent', 'buffer', 'wheel', 'script', 'timers', 'mon', 'p', 'set', 'baseSp', 'tickDmg', 'hpShow', 'pf', 'trail', 'cr', 'rk']);
  // countdowns decay below zero forever on the host and are only ever read as "> 0": clamping them keeps idle values from changing every snapshot
  const TIMER = new Set(['lock', 'stun', 'iframes', 'flash', 'protect', 'hurtT', 'enterT', 'beamSlow', 'swapCd', 'dodgeCd', 'koT', 'hitstop', 'flashT', 'cds', 'cd', 'statusT', 'tickT']);
  const laserIds = new Map();
  const lasersId = L => { if (!laserIds.size) for (const k of Object.keys(LASERS)) laserIds.set(LASERS[k], k); return laserIds.get(L); };
  const q = v => (Number.isInteger(v) ? v : Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100); // ints from 100 up, hundredths below
  const r3 = v => Math.round(v * 1000) / 1000;
  // game state -> plain JSON-safe tree: moves, species, laser tables and sides are shared tables, so only their id travels; numbers are quantized
  function P(v, k) {
    if (v === null) return null;
    switch (typeof v) {
      case 'number': return Number.isFinite(v) ? q(v < 0 && TIMER.has(k) ? 0 : v) : null;
      case 'string': case 'boolean': return v;
      case 'object': break;
      default: return undefined;
    }
    if (Array.isArray(v)) return v.map(x => { const r = P(x, k); return r === undefined ? null : r; });
    if (Object.prototype.toString.call(v) !== '[object Object]') return undefined; // Set, Map, ...
    if (v.basePower !== undefined && v.id) return { $m: v.id };
    if (v.baseStats) return { $s: v.id };
    if (v.turn !== undefined && v.total !== undefined) return { $L: lasersId(v) };
    if (v.team && v.ent) return { $side: v.idx };
    const o = {};
    for (const key in v) { if (DROP.has(key) || key[0] === '_') continue; const r = P(v[key], key); if (r !== undefined) o[key] = r; }
    return o;
  }
  // plain tree -> live game objects (fresh copies, so the cached tree is never mutated by the game)
  function revive(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(revive);
    if (v.$m) return DEX.moves[v.$m];
    if (v.$s) return DEX.species[v.$s];
    if (v.$L) return LASERS[v.$L];
    if (v.$side !== undefined) return B.sides[v.$side];
    const o = {};
    for (const k in v) o[k] = revive(v[k]);
    return o;
  }
  // diff/patch of plain trees. diff() is undefined when nothing changed; an object patches an object (or an array by index), anything else replaces.
  // $del lists removed keys, $r wraps an object that replaces an array.
  const isO = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function diff(a, b) {
    if (a === b) return undefined;
    if (Array.isArray(b)) {
      if (!Array.isArray(a) || a.length !== b.length) return b;
      let d;
      for (let i = 0; i < b.length; i++) { const x = diff(a[i], b[i]); if (x !== undefined) (d ||= {})[i] = x; }
      return d;
    }
    if (isO(b)) {
      if (Array.isArray(a)) return { $r: b };
      if (!isO(a)) return b;
      let d;
      for (const k in b) { const x = diff(a[k], b[k]); if (x !== undefined) (d ||= {})[k] = x; }
      for (const k in a) if (!(k in b)) (d ||= {}).$del = [...(d?.$del || []), k];
      return d;
    }
    return b;
  }
  function patch(base, d) {
    if (!isO(d)) return d;
    if (d.$r !== undefined) return d.$r;
    if (Array.isArray(base)) { const o = base.slice(); for (const k in d) o[k] = patch(base[k], d[k]); return o; }
    if (isO(base)) {
      const o = { ...base };
      for (const k in d) if (k !== '$del') o[k] = patch(base[k], d[k]);
      if (d.$del) for (const k of d.$del) delete o[k];
      return o;
    }
    return d;
  }
  const N = { on: false, seq: 0, ack: 0, sa: 0, lastQ: 0, lastIn: 0, skipped: 0, send: () => {}, sendFast: () => {}, backlog: () => 0, ctlBacklog: () => 0, rin: { mx: 0, my: 0, ax: 1, ay: 0, use: -1, hold: -1, dodge: false, mega: false, swap: -1 } };
  const out = { ev: [], dc: [], snd: [] };
  let realPlay = null;

  // ----- host -----
  const ring = new Map(); // snapshot seq -> tree sent, so a diff can be taken against whatever the guest last acknowledged
  let lastTeams = null, snapT = 0, teamT = 0;
  N.trees = () => ({ sent: ring, got: gring }); // for tools/net-check.mjs: what the host sent must equal what the guest rebuilt
  N.begin = () => { // call after startBattle on the host
    N.on = true; out.ev = []; out.dc = []; out.snd = []; ring.clear(); lastTeams = null; N.sa = 0; N.skipped = 0; snapT = teamT = 0;
    Object.assign(N.rin, { mx: 0, my: 0, use: -1, hold: -1, swap: -1, dodge: false, mega: false });
    B.sides.forEach(s => { if (s.remote) s.script = remoteScript; });
    if (!realPlay) {
      realPlay = AUDIO.play;
      AUDIO.play = function (src, vol, rate, x) {
        if (N.on && out.snd.length < 40) { const a = [src]; if (vol != null || rate != null || x != null) a.push(q(vol ?? 1)); if (rate != null || x != null) a.push(q(rate ?? 1)); if (x != null) a.push(Math.round(x)); out.snd.push(a); }
        return realPlay.call(this, src, vol, rate, x);
      };
    }
  };
  N.end = () => { N.on = false; if (realPlay) { AUDIO.play = realPlay; realPlay = null; } };
  // the remote player's input drives its side like playerIntent does for a local one
  function remoteScript(side) {
    const e = side.ent, I = side.intent, r = N.rin;
    I.mx = r.mx; I.my = r.my; e.aimX = r.ax; e.aimY = r.ay; e.aimIdle = 0;
    I.use = r.use; I.dodge = r.dodge; I.mega = r.mega; I.hold = r.hold;
    r.use = -1; r.dodge = false; r.mega = false;
    if (r.swap >= 0) { if (doSwap(side, r.swap, side.freeSwap > 0)) side.freeSwap = 0; r.swap = -1; }
    N.ack = N.lastIn; // the newest analog input has now been applied
  }
  // collect what the sim created this frame (particles, decals) so the guest can replay it
  N.harvest = () => {
    for (const f of B.fx) {
      if (f.t !== 0 || f._s) continue;
      f._s = 1;
      if (f.name) { // a sheet effect: only the options that differ from spawnFx's defaults travel
        const o = {};
        if (f.ft !== 3) o.ft = f.ft; if (f.loops !== 1) o.loops = f.loops; if (f.dir) o.dir = q(f.dir); if (f.scale !== SS) o.scale = q(f.scale);
        if (f.z) o.z = q(f.z); if (f.follow !== undefined) o.follow = f.follow; if (f.alpha !== 1) o.alpha = q(f.alpha); if (f.flip) o.flip = f.flip;
        out.ev.push(Object.keys(o).length ? [f.name, Math.round(f.x), Math.round(f.y), o] : [f.name, Math.round(f.x), Math.round(f.y)]);
      } else if (!f.p) { const { t, ...r } = f; out.ev.push(P(r, '')); } // sparks and columns
    }
    for (const d of B.decals) if (d.t === 0 && !d._s) { d._s = 1; out.dc.push([d.kind, Math.round(d.x), Math.round(d.y), q(d.r), Math.round(d.seed)]); }
  };
  // one-off effects since the last call (reliable channel); null when nothing happened
  N.fxMsg = () => {
    if (!out.ev.length && !out.dc.length && !out.snd.length) return null;
    const m = { t: 'fx' };
    if (out.ev.length) m.e = out.ev.splice(0).slice(-120);
    if (out.dc.length) m.c = out.dc.splice(0);
    if (out.snd.length) m.s = out.snd.splice(0);
    return m;
  };
  // team data and field props. The active mon travels in snapshots instead, so its slot is null here and cooldown ticks never make this message dirty.
  const teamsState = () => P({ T: B.sides.map(s => s.team.map((m, i) => (i === s.cur ? null : m))), grass: B.grass, puddles: B.puddles }, '');
  N.teamsMsg = () => { // reliable + ordered, so each message is a diff against the previous one; null when nothing changed
    const st = teamsState(), prev = lastTeams;
    if (!prev) { lastTeams = st; return { t: 'teams', k: 1, d: st }; }
    const d = diff(prev, st);
    if (d === undefined) return null;
    lastTeams = st;
    return { t: 'teams', d };
  };
  // the moving state. lean drops the cosmetic lists, used when a busy frame would not fit in one message
  function snapState(lean) {
    const sides = B.sides.map(s => {
      const ent = { ...s.ent, laser: s.ent.laser ? B.beams.indexOf(s.ent.laser) : -1 }; // the beam itself travels once, in beams
      if (s.remote) { delete ent.aimX; delete ent.aimY; delete ent.aimIdle; } // the guest keeps its own aim
      return { ...s, team: undefined, ent, A: s.team[s.cur] }; // team left out so P does not mistake the side for a side reference
    });
    const st = P({
      paused: B.paused, pausedBy: B.pausedBy, hitstop: B.hitstop, over: B.over, winner: B.winner, endT: B.endT, field: B.field,
      choose: B.choose, mega: B.mega && { side: B.mega.side.idx, t: B.mega.t, done: B.mega.done },
      flashT: B.flashT, flashCol: B.flashCol, impact: B.impact, shake: B.cam.shake, punch: B.cam.punch, sides,
      proj: B.proj, areas: B.areas, marks: B.marks, hazards: B.hazards, traps: B.traps, waves: B.waves, sweeps: B.sweeps, rocks: B.rocks,
      // beam trails are sent as [age in 1/100 s, angle] about every 40 ms, the guest turns them back into points
      beams: B.beams.map(b => ({ ...b, hist: b.hist && thin(b.hist) })),
      // floats and callouts leave out their age: the guest keeps the age of one it already shows
      floats: lean ? [] : B.floats.map(f => [Math.round(f.x), Math.round(f.y), f.s, f.color, f.size, f.num]), callouts: lean ? [] : B.callouts.map(c => [c.side, c.s]),
    }, '');
    st.time = r3(B.time);
    return st;
  }
  function thin(h) {
    const o = []; let last = Infinity;
    for (let i = h.length - 1; i >= 0; i--) if (last - h[i].t >= 0.04 || i === 0) { o.push([Math.round((B.time - h[i].t) * 100), h[i].a]); last = h[i].t; }
    return o.reverse();
  }
  // one snapshot message, or null when even the lean form would not fit
  N.snapMsg = () => {
    const sq = ++N.seq, base = N.sa && sq - N.sa <= RING ? ring.get(N.sa) : null;
    for (const lean of [false, true]) {
      const st = snapState(lean), m = { t: 's', q: sq, a: N.ack, b: base ? N.sa : 0, d: base ? diff(base, st) || {} : st };
      if (JSON.stringify(m).length > MAX_SNAP) continue;
      ring.set(sq, st); ring.delete(sq - RING - 1);
      return m;
    }
    return null;
  };
  // host, once per frame after updateBattle: snapshot (unordered), effects and team changes (reliable), on their own clocks
  N.hostTick = dt => {
    if (!N.on) return;
    if ((snapT += dt) >= SNAP_DT - 0.001) {
      snapT = Math.max(0, snapT - SNAP_DT);
      if (N.backlog() > BACKLOG) N.skipped++; // the link is behind: skip, the next one is newer anyway
      else { const m = N.snapMsg(); if (m) N.sendFast(m); }
      const fx = N.fxMsg(); if (fx && N.ctlBacklog() < FX_BACKLOG) N.send(fx); // effects are cosmetic: dropped rather than queued behind a clogged link
    }
    if ((teamT -= dt) <= 0) { teamT = TEAMS_DT; const m = N.teamsMsg(); if (m) N.send(m); }
  };

  // ----- guest -----
  const ARR = ['proj', 'areas', 'marks', 'hazards', 'traps', 'waves', 'sweeps', 'rocks'];
  let hist = []; // own predicted moves not yet confirmed by the host: { q, dx, dy }
  const gring = new Map(); // snapshot seq -> tree applied, the base the host may diff against
  let tTree = null; // last teams tree
  N.reset = () => { N.lastQ = 0; N.seq = 0; N.rematch(); }; // a new match
  N.rematch = () => { hist = []; gring.clear(); tTree = null; N.sa = 0; sent = null; }; // same peer, fresh battle: sequence numbers carry on, trees do not
  N.apply = m => {
    if (!B || !B.guest || !(m.q > N.lastQ)) return; // arrived late: a newer one is already applied
    let S;
    if (m.b) { const base = gring.get(m.b); if (!base) return; S = patch(base, m.d); } else S = m.d; // no base: wait for the host to notice and send a full one
    N.lastQ = N.sa = m.q;
    gring.set(m.q, S); if (gring.size > GRING) gring.delete(gring.keys().next().value);
    const R = revive(S);
    for (const k of ['time', 'paused', 'pausedBy', 'hitstop', 'over', 'winner', 'endT', 'field']) B[k] = R[k];
    B.choose = R.choose && { ...R.choose, sel: B.choose && B.choose.side === R.choose.side ? B.choose.sel : R.choose.sel }; // the guest's own pick stays local
    B.mega = R.mega && { side: B.sides[R.mega.side], t: R.mega.t, done: R.mega.done };
    if (R.flashT > (B.flashT || 0)) { B.flashT = R.flashT; B.flashCol = R.flashCol; }
    if (R.impact && !B.impact) B.impact = R.impact;
    B.cam.shake = Math.max(B.cam.shake, R.shake || 0); B.cam.punch = Math.max(B.cam.punch, R.punch || 0);
    hist = hist.filter(h => h.q > m.a);
    R.sides.forEach((o, i) => {
      const { ent, A, ...rest } = o, { laser, ...entRest } = ent, sd = B.sides[i], e = sd.ent, mine = i === B.me;
      Object.assign(sd, rest);
      const keep = mine ? { aimX: e.aimX, aimY: e.aimY, aimIdle: e.aimIdle } : {}, x0 = e.x, y0 = e.y;
      Object.assign(e, entRest, keep);
      // where it should be drawn: the host's spot, plus (for our own mon) the moves the host has not seen yet
      let tx = ent.x, ty = ent.y;
      if (mine) for (const h of hist) { tx += h.dx; ty += h.dy; }
      [e._tx, e._ty] = clampToArena(tx, ty);
      if (Math.hypot(e._tx - x0, e._ty - y0) < 140) { e.x = x0; e.y = y0; } else { e.x = e._tx; e.y = e._ty; } // glide; far jumps (teleports) snap
      if (A) Object.assign(sd.team[sd.cur], A);
      sd.ent.laser = laser;
    });
    const oldSweeps = B.sweeps;
    for (const k of ARR) B[k] = R[k] || [];
    B.beams =(R.beams || []).map(b => ({ ...b, hist: (b.hist || []).map(([age, a]) => ({ t: R.time - age / 100, a })) }));
    R.sides.forEach((o, i) => { const l = B.sides[i].ent.laser; B.sides[i].ent.laser = l >= 0 ? B.beams[l] || null : null; });
    // quake debris is cosmetic and drawn from its own spawn time: keep what this screen already made for the same sweep
    B.sweeps = B.sweeps.map((w, i) => { const o = oldSweeps[i]; return o && o.side === w.side && o.move === w.move && o.kind === w.kind ? Object.assign(w, { cr: o.cr, rk: o.rk, _dT: o._dT }) : w; });
    // a float or callout this screen already shows keeps its age, a new one starts at zero
    const oldF = B.floats, oldC = B.callouts;
    B.floats = (R.floats || []).map(([x, y, s, color, size, num]) => { const o = oldF.find(f => f.s === s && f.x === x && f.y === y); return { x, y, s, color, size, num, t: o ? o.t : 0 }; });
    B.callouts = (R.callouts || []).map(([side, s]) => { const o = oldC.find(c => c.side === side && c.s === s); return { side, s, t: o ? o.t : 0 }; });
  };
  N.applyTeams = m => {
    const tree = m.k ? m.d : tTree && patch(tTree, m.d);
    if (!tree) return;
    tTree = tree;
    if (!B || !B.guest) return; // the stored tree is complete, so the next message still applies everything
    const S = revive(tree);
    S.T.forEach((team, i) => team.forEach((mon, k) => B.sides[i].team[k] && Object.assign(B.sides[i].team[k], mon)));
    B.grass = S.grass; B.puddles = S.puddles;
  };
  N.applyFx = m => {
    if (!B || !B.guest) return;
    for (const ev of m.e || []) { if (Array.isArray(ev)) spawnFx(ev[0], ev[1], ev[2], ev[3] || {}); else B.fx.push({ ...ev, t: 0 }); }
    for (const [kind, x, y, r, seed] of m.c || []) { B.decals.push({ kind, x, y, r, t: 0, seed }); if (B.decals.length > 50) B.decals.shift(); }
    for (const [src, vol, rate, x] of m.s || []) AUDIO.play(src, vol ?? undefined, rate ?? undefined, x ?? undefined);
  };
  // our own walking, worked out the same way updateSide does, so it can be shown before the host confirms it
  function predictVel(side) {
    const e = side.ent, m = side.team[side.cur], I = side.intent;
    if (e.dodge || e.dash) return null; // host-driven bursts: dead-reckon from the host's velocity instead
    if (!m || m.fainted || m.status === 'slp' || m.status === 'frz' || e.stun > 0) return { x: 0, y: 0 };
    let sp = moveSpeed(m, side);
    if (e.act && !e.act.fired) sp *= e.act.charging ? 0.2 : 0.4; else if (e.laser) sp *= e.laser.laser.mv; else if (e.act) sp *= 0.6;
    if (e.beamSlow > 0) sp *= 0.6; if (e.lock > 0) sp *= 0.3;
    if (e.hidden > 0) sp *= e.flying ? (e.flySpd || 1.5) : 1.25;
    return { x: I.mx * sp, y: I.my * sp };
  }
  // between snapshots: keep time, animation, cooldowns, movement and projectiles going so it looks smooth
  N.step = dt => {
    if (!B || !B.guest) return;
    // time only runs when the host's does: paused, choosing a replacement, impact/mega freezes and the end screen all hold it
    const live = !B.paused && !B.choose && B.hitstop <= 0 && !B.over;
    if (live) B.time += dt;
    const k = 1 - Math.exp(-dt * 18), kOwn = 1 - Math.exp(-dt * 10), f = Math.pow(0.0008, dt);
    for (const s of B.sides) {
      const e = s.ent, m = s.team[s.cur], mine = s.idx === B.me;
      if (live) e.animT += dt;
      if (e._tx === undefined) continue;
      if (live) {
        const pv = mine ? N.pv : null;
        if (pv) { // our own input moves us at once; the correction toward the host's answer is gentle
          e._tx += pv.x * dt; e._ty += pv.y * dt; e.x += pv.x * dt; e.y += pv.y * dt;
        } else { // dead reckoning: carry on at the last known speed and knockback
          e._tx += ((e.vx || 0) + (e.kx || 0)) * dt; e._ty += ((e.vy || 0) + (e.ky || 0)) * dt;
        }
        e.kx = (e.kx || 0) * f; e.ky = (e.ky || 0) * f;
        [e._tx, e._ty] = clampToArena(e._tx, e._ty);
      }
      const kk = mine && N.pv ? kOwn : k;
      e.x += (e._tx - e.x) * kk; e.y += (e._ty - e.y) * kk;
      if (m && live) for (let i = 0; i < 4; i++) if (m.cds[i] > 0) m.cds[i] -= dt;
    }
    if (live) {
      for (const p of B.proj) { p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; }
      // timers of the things on the field keep running between snapshots, held at their own limit so nothing overshoots before the host removes it
      for (const k of ['areas', 'beams', 'traps', 'waves']) for (const o of B[k]) if (o.dur) o.t = Math.min(o.dur, o.t + dt);
      for (const o of B.marks) if (o.delay) o.t = Math.min(o.delay, o.t + dt);
      for (const w of B.sweeps) {
        if (!w.dead) { w.t += dt; if (w.t >= w.warn) w.u += w.dir * w.spd * dt; }
        if (w.kind === 'quake' && !w.dead && w.t >= w.warn && ((w._dT = (w._dT ?? 0) - dt) <= 0)) { w._dT = 0.05; quakeDebris(w); } // debris is cosmetic, made here instead of streamed
        if (w.cr) { w.cr = w.cr.filter(c => B.time - c.ts < 4); w.rk = w.rk.filter(r => B.time - r.ts < 2.4); }
      }
    }
    if (B.mega && !B.paused) B.mega.t += dt;
    updateFxOnly(dt);
  };
  // the guest's own input, read exactly like a local player's: analog state for the fast channel, presses for the reliable one
  N.input = dt => {
    const me = B.sides[B.me], e = me.ent, I = me.intent;
    const live = !B.paused && !B.over && !B.choose && B.hitstop <= 0;
    let swap = -1;
    if (live) { const real = doSwap; doSwap = (s, i) => { swap = i; return false; }; try { playerIntent(me, dt); } finally { doSwap = real; } }
    else { I.mx = I.my = 0; I.use = -1; I.dodge = I.mega = false; I.hold = -1; }
    I.mx = q(I.mx); I.my = q(I.my); // predict with exactly what the host will be told
    const v = live ? predictVel(me) : { x: 0, y: 0 };
    N.pv = v; const sq = ++N.seq;
    if (v) hist.push({ q: sq, dx: v.x * dt, dy: v.y * dt }); if (hist.length > 240) hist.shift();
    const press = I.use >= 0 || I.dodge || I.mega || swap >= 0 ? { t: 'act', use: I.use, dodge: !!I.dodge, mega: !!I.mega, swap } : null;
    return { analog: { t: 'in', q: sq, sa: N.sa, mx: I.mx, my: I.my, ax: q(e.aimX), ay: q(e.aimY), hold: I.hold }, press };
  };
  // guest, once per frame: read input, advance the screen, send input at its own pace (30 Hz, at once when movement starts or stops or a button is pressed, 10 Hz when idle)
  let inT = 0, sent = null;
  N.guestTick = dt => {
    const { analog: a, press } = N.input(dt);
    N.step(dt);
    inT += dt;
    const moving = v => v.mx !== 0 || v.my !== 0;
    const edge = !sent || moving(a) !== moving(sent), changed = !sent || a.mx !== sent.mx || a.my !== sent.my || a.ax !== sent.ax || a.ay !== sent.ay || a.hold !== sent.hold;
    if (press || edge || inT >= KEEP_DT - 0.001 || (changed && inT >= IN_DT - 0.001)) { inT = 0; sent = a; N.sendFast(a); }
    if (press) N.send(press);
  };
  N.clearInput = () => Object.assign(N.rin, { use: -1, dodge: false, mega: false, swap: -1 });
  // host side: messages from the guest
  const num = v => (Number.isFinite(v) ? v : 0);
  N.recv = m => {
    if (m.t === 'in') N.onInput(m); else if (m.t === 'act') N.onPress(m);
    else if (m.t === 's') N.apply(m); else if (m.t === 'teams') N.applyTeams(m); else if (m.t === 'fx') N.applyFx(m);
  };
  N.onInput = m => {
    if ((m.q | 0) <= N.lastIn) return; // stale (unordered channel)
    N.lastIn = m.q | 0; N.sa = m.sa | 0; // sa: the newest snapshot the guest has applied, the base for the next diff
    const r = N.rin;
    r.mx = clamp(num(m.mx), -1, 1); r.my = clamp(num(m.my), -1, 1);
    const l = Math.hypot(num(m.ax), num(m.ay)) || 1; r.ax = num(m.ax) / l; r.ay = num(m.ay) / l;
    r.hold = clamp(m.hold | 0, -1, 3);
  };
  N.onPress = m => {
    const r = N.rin;
    if ((m.use | 0) >= 0 && (m.use | 0) < 4) r.use = m.use | 0;
    if (m.dodge) r.dodge = true; if (m.mega) r.mega = true; if ((m.swap | 0) >= 0 && (m.swap | 0) < 6) r.swap = m.swap | 0;
  };
  return N;
})();

// shared online state; online.js fills it in
const NET = { role: '', conn: null, fast: null, peer: null, mq: null, mqT: 0, cfg: null, guestReady: false, peerLoad: 0 };
