// Online sync, host-authoritative: the host runs the real sim and streams snapshots; the guest only renders them and sends its input.
// Pure data (no DOM, no network) so tools/net-check.mjs can run it headless. Transport lives in online.js.
const NETSYNC = (() => {
  const DROP = new Set(['ai', 'intent', 'buffer', 'wheel', 'script', 'timers', 'mon', 'p', 'set', 'baseSp', 'tickDmg', 'hpShow']);
  const lasersId = L => Object.keys(LASERS).find(k => LASERS[k] === L);
  // moves, species, laser tables and sides are shared tables: send their id, never the data
  const replacer = (k, v) => {
    if (DROP.has(k) || k[0] === '_') return undefined;
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
  const N = { on: false, tick: 0, send: () => {}, rin: { mx: 0, my: 0, ax: 1, ay: 0, use: -1, hold: -1, dodge: false, mega: false, swap: -1 }, menuOpen: false };
  const out = { ev: [], dc: [], snd: [] };
  let realPlay = null;

  // ----- host -----
  N.begin = () => { // call after startBattle on the host
    N.on = true; N.tick = 0; out.ev = []; out.dc = []; out.snd = [];
    Object.assign(N.rin, { use: -1, hold: -1, swap: -1, dodge: false, mega: false });
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
  }
  // collect what the sim created this frame (particles, decals) so the guest can replay it
  N.harvest = () => {
    for (const f of B.fx) if (f.t === 0 && !f._s) { f._s = 1; if (f.p && !f.name) continue; const { p, ...r } = f; out.ev.push(r); }
    for (const d of B.decals) if (d.t === 0 && !d._s) { d._s = 1; out.dc.push(d); }
  };
  N.snap = () => {
    const full = N.tick++ % 5 === 0, ev = out.ev.splice(0).slice(-120), dc = out.dc.splice(0), snd = out.snd.splice(0);
    return JSON.stringify({
      time: B.time, paused: B.paused, pausedBy: B.pausedBy, hitstop: B.hitstop, over: B.over, winner: B.winner, endT: B.endT, field: B.field,
      choose: B.choose, mega: B.mega && { side: B.mega.side.idx, t: B.mega.t, done: B.mega.done },
      flashT: B.flashT, flashCol: B.flashCol, impact: B.impact, shake: B.cam.shake, punch: B.cam.punch,
      sides: B.sides.map(s => ({ ...s, team: undefined, T: full ? s.team : { [s.cur]: s.team[s.cur] } })), // team renamed T so the replacer does not mistake the side for a side reference
      proj: B.proj, areas: B.areas, beams: B.beams, marks: B.marks, hazards: B.hazards, traps: B.traps, waves: B.waves, sweeps: B.sweeps,
      rocks: B.rocks, floats: B.floats, callouts: B.callouts, grass: full ? B.grass : undefined, puddles: full ? B.puddles : undefined,
      ev, dc, snd,
    }, replacer);
  };

  // ----- guest -----
  const ARR = ['proj', 'areas', 'beams', 'marks', 'hazards', 'traps', 'waves', 'sweeps', 'rocks', 'floats', 'callouts'];
  N.apply = text => {
    if (!B || !B.guest) return;
    const S = JSON.parse(text, reviver);
    for (const k of ['time', 'paused', 'pausedBy', 'hitstop', 'over', 'winner', 'endT', 'field']) B[k] = S[k];
    B.choose = S.choose && { ...S.choose, sel: B.choose && B.choose.side === S.choose.side ? B.choose.sel : S.choose.sel }; // the guest's own pick stays local
    B.mega = S.mega && { side: B.sides[S.mega.side], t: S.mega.t, done: S.mega.done };
    if (S.flashT > (B.flashT || 0)) { B.flashT = S.flashT; B.flashCol = S.flashCol; }
    if (S.impact && !B.impact) B.impact = S.impact;
    B.cam.shake = Math.max(B.cam.shake, S.shake || 0); B.cam.punch = Math.max(B.cam.punch, S.punch || 0);
    S.sides.forEach((o, i) => {
      const { ent, T, ...rest } = o, sd = B.sides[i], e = sd.ent, mine = i === B.me;
      Object.assign(sd, rest);
      const keep = mine ? { aimX: e.aimX, aimY: e.aimY, aimIdle: e.aimIdle } : {}, x0 = e.x, y0 = e.y;
      Object.assign(e, ent, keep);
      e._tx = ent.x; e._ty = ent.y;
      if (Math.hypot(ent.x - x0, ent.y - y0) < 140) { e.x = x0; e.y = y0; } // glide to the new spot; far jumps (teleports) snap
      for (const k in T) Object.assign(sd.team[k], T[k]);
    });
    for (const k of ARR) B[k] = S[k] || [];
    if (S.grass) { B.grass = S.grass; B.puddles = S.puddles; }
    for (const ev of S.ev) { if (ev.name) spawnFx(ev.name, ev.x, ev.y, ev); else B.fx.push(ev); }
    for (const d of S.dc) { B.decals.push(d); if (B.decals.length > 50) B.decals.shift(); }
    for (const [src, vol, rate, x] of S.snd) AUDIO.play(src, vol, rate, x);
  };
  // between snapshots: keep time, animation, cooldowns, glides and projectiles moving so 20 snapshots/s looks smooth
  N.step = dt => {
    if (!B || !B.guest) return;
    // time only runs when the host's does: paused, choosing a replacement, impact/mega freezes and the end screen all hold it
    const live = !B.paused && !B.choose && B.hitstop <= 0 && !B.over;
    if (live) B.time += dt;
    const k = 1 - Math.exp(-dt * 24);
    for (const s of B.sides) {
      const e = s.ent, m = s.team[s.cur];
      if (live) e.animT += dt;
      if (e._tx !== undefined) { e.x += (e._tx - e.x) * k; e.y += (e._ty - e.y) * k; }
      if (m && live) for (let i = 0; i < 4; i++) if (m.cds[i] > 0) m.cds[i] -= dt;
    }
    if (live) for (const p of B.proj) { p.x += p.vx * dt; p.y += p.vy * dt; p.t += dt; }
    if (B.mega && !B.paused) B.mega.t += dt;
    updateFxOnly(dt);
  };
  // the guest's own input, read exactly like a local player's, sent to the host instead of acted on
  N.input = dt => {
    const me = B.sides[B.me], e = me.ent, I = me.intent;
    if (B.paused || B.over || B.choose) return { mx: 0, my: 0, ax: e.aimX, ay: e.aimY, use: -1, hold: -1, dodge: false, mega: false, swap: -1 };
    let swap = -1; const real = doSwap;
    doSwap = (s, i) => { swap = i; return false; };
    try { playerIntent(me, dt); } finally { doSwap = real; }
    return { mx: I.mx, my: I.my, ax: e.aimX, ay: e.aimY, use: I.use, hold: I.hold, dodge: !!I.dodge, mega: !!I.mega, swap };
  };
  N.clearInput = () => Object.assign(N.rin, { use: -1, dodge: false, mega: false, swap: -1 });
  // host side: take a message from the guest
  N.onInput = m => {
    const r = N.rin, num = v => (Number.isFinite(v) ? v : 0);
    r.mx = clamp(num(m.mx), -1, 1); r.my = clamp(num(m.my), -1, 1);
    const l = Math.hypot(num(m.ax), num(m.ay)) || 1; r.ax = num(m.ax) / l; r.ay = num(m.ay) / l;
    r.hold = m.hold | 0; if ((m.use | 0) >= 0 && (m.use | 0) < 4) r.use = m.use | 0;
    if (m.dodge) r.dodge = true; if (m.mega) r.mega = true; if ((m.swap | 0) >= 0 && (m.swap | 0) < 6) r.swap = m.swap | 0;
  };
  return N;
})();

// shared online state; online.js fills it in
const NET = { role: '', conn: null, peer: null, mq: null, mqT: 0, cfg: null, guestReady: false };
