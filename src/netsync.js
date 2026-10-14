// Online sync, host-authoritative: the host runs the real sim and streams snapshots; the guest renders them and sends its input.
// Pure data (no DOM, no network) so tools/net-check.mjs can run it headless. Transport lives in online.js.
// Traffic is split by urgency: snapshots + analog input ride an unordered channel (newest wins, stale ones are dropped by seq);
// button presses, team data and one-off effects/sounds ride a reliable channel so they are never lost.
// The guest predicts its own walking from its input and reconciles against the host's position, so its controls feel instant.
const NETSYNC = (() => {
  const DROP = new Set(['ai', 'intent', 'buffer', 'wheel', 'script', 'timers', 'mon', 'p', 'set', 'baseSp', 'tickDmg', 'hpShow']);
  const lasersId = L => Object.keys(LASERS).find(k => LASERS[k] === L);
  // moves, species, laser tables and sides are shared tables: send their id, never the data; numbers are rounded to keep packets small
  const replacer = (k, v) => {
    if (DROP.has(k) || k[0] === '_') return undefined;
    if (typeof v === 'number') return Number.isInteger(v) || !Number.isFinite(v) ? v : Math.round(v * 1000) / 1000;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.basePower !== undefined && v.id) return { $m: v.id };
      if (v.baseStats) return { $s: v.id };
      if (v.turn !== undefined && v.total !== undefined) return { $L: lasersId(v) };
      if (v.team && v.ent) return { $side: v.idx };
    }
    return v;
  };
  const reviver = (k, v) => {
    if (v && typeof v === 'object') {
      if (v.$m) return DEX.moves[v.$m];
      if (v.$s) return DEX.species[v.$s];
      if (v.$L) return LASERS[v.$L];
      if (v.$side !== undefined) return B.sides[v.$side];
    }
    return v;
  };
  const N = { on: false, seq: 0, ack: 0, lastQ: 0, lastIn: 0, send: () => {}, sendFast: () => {}, rin: { mx: 0, my: 0, ax: 1, ay: 0, use: -1, hold: -1, dodge: false, mega: false, swap: -1 } };
  const out = { ev: [], dc: [], snd: [] };
  let realPlay = null;

  // ----- host -----
  N.begin = () => { // call after startBattle on the host
    N.on = true; out.ev = []; out.dc = []; out.snd = [];
    Object.assign(N.rin, { mx: 0, my: 0, use: -1, hold: -1, swap: -1, dodge: false, mega: false });
    B.sides.forEach(s => { if (s.remote) s.script = remoteScript; });
    if (!realPlay) { realPlay = AUDIO.play; AUDIO.play = function (src, vol, rate, x) { if (N.on && out.snd.length < 40) out.snd.push([src, vol, rate, x]); return realPlay.call(this, src, vol, rate, x); }; }
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
    for (const f of B.fx) if (f.t === 0 && !f._s) { f._s = 1; if (f.p && !f.name) continue; const { p, ...r } = f; out.ev.push(r); }
    for (const d of B.decals) if (d.t === 0 && !d._s) { d._s = 1; out.dc.push(d); }
  };
  // one-off effects since the last call (reliable channel); null when nothing happened
  N.fx = () => {
    if (!out.ev.length && !out.dc.length && !out.snd.length) return null;
    return JSON.stringify({ ev: out.ev.splice(0).slice(-120), dc: out.dc.splice(0), snd: out.snd.splice(0) }, replacer);
  };
  // whole teams and field props, a couple of times a second (reliable channel)
  N.teams = () => JSON.stringify({ T: B.sides.map(s => s.team), grass: B.grass, puddles: B.puddles }, replacer);
  // the moving state (unordered channel): only the active mons, everything else comes with teams()
  N.snap = () => JSON.stringify({
    q: ++N.seq, ack: N.ack,
    time: B.time, paused: B.paused, pausedBy: B.pausedBy, hitstop: B.hitstop, over: B.over, winner: B.winner, endT: B.endT, field: B.field,
    choose: B.choose, mega: B.mega && { side: B.mega.side.idx, t: B.mega.t, done: B.mega.done },
    flashT: B.flashT, flashCol: B.flashCol, impact: B.impact, shake: B.cam.shake, punch: B.cam.punch,
    sides: B.sides.map(s => ({ ...s, team: undefined, A: s.team[s.cur] })), // team left out so the replacer does not mistake the side for a side reference
    proj: B.proj, areas: B.areas, beams: B.beams, marks: B.marks, hazards: B.hazards, traps: B.traps, waves: B.waves, sweeps: B.sweeps,
    rocks: B.rocks, floats: B.floats, callouts: B.callouts,
  }, replacer);

  // ----- guest -----
  const ARR = ['proj', 'areas', 'beams', 'marks', 'hazards', 'traps', 'waves', 'sweeps', 'rocks', 'floats', 'callouts'];
  let hist = []; // own predicted moves not yet confirmed by the host: { q, dx, dy }
  N.reset = () => { N.lastQ = 0; N.seq = 0; hist = []; };
  N.apply = text => {
    if (!B || !B.guest) return;
    const S = JSON.parse(text, reviver);
    if (S.q <= N.lastQ) return; // arrived late: a newer one is already applied
    N.lastQ = S.q;
    for (const k of ['time', 'paused', 'pausedBy', 'hitstop', 'over', 'winner', 'endT', 'field']) B[k] = S[k];
    B.choose = S.choose && { ...S.choose, sel: B.choose && B.choose.side === S.choose.side ? B.choose.sel : S.choose.sel }; // the guest's own pick stays local
    B.mega = S.mega && { side: B.sides[S.mega.side], t: S.mega.t, done: S.mega.done };
    if (S.flashT > (B.flashT || 0)) { B.flashT = S.flashT; B.flashCol = S.flashCol; }
    if (S.impact && !B.impact) B.impact = S.impact;
    B.cam.shake = Math.max(B.cam.shake, S.shake || 0); B.cam.punch = Math.max(B.cam.punch, S.punch || 0);
    hist = hist.filter(h => h.q > S.ack);
    S.sides.forEach((o, i) => {
      const { ent, A, ...rest } = o, sd = B.sides[i], e = sd.ent, mine = i === B.me;
      Object.assign(sd, rest);
      const keep = mine ? { aimX: e.aimX, aimY: e.aimY, aimIdle: e.aimIdle } : {}, x0 = e.x, y0 = e.y;
      Object.assign(e, ent, keep);
      // where it should be drawn: the host's spot, plus (for our own mon) the moves the host has not seen yet
      let tx = ent.x, ty = ent.y;
      if (mine) for (const h of hist) { tx += h.dx; ty += h.dy; }
      [e._tx, e._ty] = clampToArena(tx, ty);
      if (Math.hypot(e._tx - x0, e._ty - y0) < 140) { e.x = x0; e.y = y0; } else { e.x = e._tx; e.y = e._ty; } // glide; far jumps (teleports) snap
      if (A) Object.assign(sd.team[sd.cur], A);
    });
    for (const k of ARR) B[k] = S[k] || [];
  };
  N.applyTeams = text => {
    if (!B || !B.guest) return;
    const S = JSON.parse(text, reviver);
    S.T.forEach((team, i) => team.forEach((m, k) => B.sides[i].team[k] && Object.assign(B.sides[i].team[k], m)));
    B.grass = S.grass; B.puddles = S.puddles;
  };
  N.applyFx = text => {
    if (!B || !B.guest) return;
    const S = JSON.parse(text, reviver);
    for (const ev of S.ev) { if (ev.name) spawnFx(ev.name, ev.x, ev.y, ev); else B.fx.push(ev); }
    for (const d of S.dc) { B.decals.push(d); if (B.decals.length > 50) B.decals.shift(); }
    for (const [src, vol, rate, x] of S.snd) AUDIO.play(src, vol, rate, x);
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
    if (live) for (const p of B.proj) { p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; }
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
    const v = live ? predictVel(me) : { x: 0, y: 0 };
    N.pv = v; const q = ++N.seq;
    if (v) hist.push({ q, dx: v.x * dt, dy: v.y * dt }); if (hist.length > 240) hist.shift();
    const press = I.use >= 0 || I.dodge || I.mega || swap >= 0 ? { t: 'act', use: I.use, dodge: !!I.dodge, mega: !!I.mega, swap } : null;
    return { analog: { t: 'in', q, mx: I.mx, my: I.my, ax: e.aimX, ay: e.aimY, hold: I.hold }, press };
  };
  N.clearInput = () => Object.assign(N.rin, { use: -1, dodge: false, mega: false, swap: -1 });
  // host side: messages from the guest
  const num = v => (Number.isFinite(v) ? v : 0);
  N.onInput = m => {
    if ((m.q | 0) <= N.lastIn) return; // stale (unordered channel)
    N.lastIn = m.q | 0;
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
