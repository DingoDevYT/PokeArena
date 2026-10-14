// Headless online check: a host sim streams snapshots to a guest battle over a simulated link; they must agree and the traffic must stay small.
// Real wire path: guest input -> link -> host, host snapshots/fx/teams -> link -> guest, every message JSON round-tripped and sized like PeerJS would.
// Usage: node tools/net-check.mjs [battles=4]
// Profiles: clean (no latency); bad = 80 ms one way, 5% loss on the fast channel, 1 Mbit/s upload cap each way; awful = 150 ms, 15% loss, 320 kbit/s.
// All must end "in sync" with identical snapshot trees on both sides.
// NET_DRIVER=<module> swaps the protocol under test (used to measure the pre-v3 code for the before/after table in docs/ONLINE.md).
import fs from 'fs';
import vm from 'vm';
import { pathToFileURL } from 'url';

const N = +(process.argv[2] || 4);
const PROFILES = { clean: { lat: 0, jit: 0, loss: 0, bw: Infinity }, bad: { lat: 0.08, jit: 0.01, loss: 0.05, bw: 125000 }, awful: { lat: 0.15, jit: 0.04, loss: 0.15, bw: 40000 } };
const OVERHEAD = 60; // bytes of SCTP/DTLS/UDP/IP framing per message
const DT = 1 / 60;
// the protocol under test: scheduling + dispatch on top of netsync.js (online.js does the same with real connections)
const DRIVER = process.env.NET_DRIVER ? (await import(pathToFileURL(process.env.NET_DRIVER).href)).default : {
  src: 'src/netsync.js', begin: NS => NS.begin(), rematch: NS => NS.rematch(), hostTick: (NS, dt) => NS.hostTick(dt), guestTick: (NS, dt) => NS.guestTick(dt),
  hostRecv: (NS, m) => NS.recv(m), guestRecv: (NS, m) => NS.recv(m),
};
const mk = seed => {
  const ctx = {
    window: {}, console, performance, setTimeout,
    AUDIO: { play() {}, sfx() {}, cry() {}, move() { return true; }, gen() { return true; }, vol: { sfx: 0 } },
    INPUT: { hit: k => ctx.PRESS === k && !(ctx.PRESS = null), held: () => false, mouseAim: false, mx: 0, my: 0 }, MOUSE: {}, KEYS: {}, SS: 2,
    screenToWorld: () => ctx.AIM, AIM: { x: 600, y: 400 }, PRESS: null,
    TYPE_COLOR: new Proxy({}, { get: () => '#fff' }),
  };
  vm.createContext(ctx);
  // helpers + a seeded Math.random live inside the context, so the host sim is identical whatever the guest or the link does
  vm.runInContext(`{ let a = ${seed}; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    var clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
    var dirFromVec = (x, y) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];`, ctx);
  for (const f of ['data/dex.js', 'data/move-behaviour.js', 'data/vfx.js', 'data/sprites.js', 'data/sprites-custom.js', 'data/custom-species.js', 'data/world.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
  for (const k of ['DEX', 'VFX', 'SPRITES', 'ARENAS', 'TRAINERS', 'MOVE_BEHAVIOUR']) ctx[k] = ctx.window[k];
  vm.runInContext(fs.readFileSync('src/battle.js', 'utf8') + '\n' + fs.readFileSync(DRIVER.src, 'utf8') + '\n;this.X={startBattle,updateBattle,updateFxOnly,getB:()=>B,confirmChoose,NETSYNC,playerIntent};', ctx);
  return ctx;
};
// a one-way link: FIFO upload queue with a bandwidth cap, fixed latency + jitter, loss on the fast (unordered) channel only
const rng = (() => { let a = 12345; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
const mkLink = P => {
  const L = { now: 0, free: 0, ctlAt: 0, q: [], kinds: {}, lost: 0, qd: [], age: [], top: {} };
  L.send = (m, fast) => {
    const s = JSON.stringify(m), bytes = s.length + OVERHEAD, k = (L.kinds[m.t] ||= { n: 0, bytes: 0, max: 0 });
    k.n++; k.bytes += s.length; k.max = Math.max(k.max, s.length);
    if (m.t === 's') for (const f in m.d) L.top[f] = (L.top[f] || 0) + JSON.stringify(m.d[f]).length + f.length + 4; // where the snapshot bytes go
    const start = Math.max(L.now, L.free); L.free = start + bytes / P.bw;
    if (m.t === 's' || m.t === 'snap') L.qd.push(start - L.now); // time the message waited in the sender's buffer
    if (fast && rng() < P.loss) { L.lost++; return; }
    let at = L.free + P.lat + (fast ? rng() * P.jit : 0);
    if (!fast) at = L.ctlAt = Math.max(at, L.ctlAt); // the reliable channel is ordered
    L.q.push({ at, m: JSON.parse(s), sent: L.now });
  };
  L.backlog = () => (P.bw === Infinity ? 0 : Math.max(0, L.free - L.now) * P.bw); // what RTCDataChannel.bufferedAmount would read
  L.take = now => { L.now = now; const out = L.q.filter(x => x.at <= now).sort((a, b) => a.at - b.at); if (out.length) L.q = L.q.filter(x => x.at > now); for (const x of out) if (x.m.t === 's' || x.m.t === 'snap') L.age.push(now - x.sent); return out.map(x => x.m); };
  return L;
};
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function run(name, P) {
  const H = mk(1), G = mk(2); // reused across battles, so rematch / reset paths run too
  const up = mkLink(P), down = mkLink(P); // up: guest -> host, down: host -> guest
  const tick = [], err = { own: [], foe: [] };
  let errors = 0, simT = 0, applied = 0;
  const NH = H.X.NETSYNC, NG = G.X.NETSYNC;
  NH.send = m => down.send(m, false); NH.sendFast = m => down.send(m, true); NH.backlog = NH.ctlBacklog = () => down.backlog();
  NG.send = m => up.send(m, false); NG.sendFast = m => up.send(m, true); NG.backlog = () => up.backlog();
  for (let i = 0; i < N; i++) {
    try {
      const T = H.TRAINERS, a = T[i % T.length], b = T[(i * 5 + 2) % T.length], arena = H.ARENAS[i % H.ARENAS.length];
      H.X.startBattle({ arena, player: { name: 'H', team: a.team }, cpu: { name: 'G', remote: true, team: b.team } });
      G.X.startBattle({ arena: G.ARENAS[i % G.ARENAS.length], player: { name: 'H', team: a.team }, cpu: { name: 'G', team: b.team }, me: 1, guest: true });
      const hb = H.X.getB(), gb = G.X.getB();
      hb.sides[0].cpu = true; // CPU drives the host side so something happens
      DRIVER.begin(NH); if (i) DRIVER.rematch(NG);
      let t = 0;
      const frame = (live) => {
        simT += DT; up.now = down.now = simT;
        for (const m of down.take(simT)) {
          DRIVER.guestRecv(NG, m);
          if (m.t === 's' && NG.trees) { // every snapshot the guest applied must be rebuilt exactly as the host sent it, deltas included
            const mine = NG.trees().got.get(m.q), sent = NH.trees().sent.get(m.q);
            if (mine && sent && canon(mine) !== canon(sent)) throw new Error(`snapshot ${m.q} (base ${m.b}) rebuilt differently on the guest`);
            if (mine) applied++;
          }
        }
        for (const m of up.take(simT)) DRIVER.hostRecv(NH, m);
        // the guest "player": wanders, aims at the foe, taps a move now and then
        if (live) {
          G.INPUT.mx = Math.cos(t * 1.3); G.INPUT.my = Math.sin(t * 0.9); if (t % 2 < 0.3) G.INPUT.mx = G.INPUT.my = 0;
          const fe = gb.sides[0].ent; G.AIM = { x: fe.x, y: fe.y - 24 }; G.PRESS = rng() < 0.03 ? ['M1', 'M2', 'M3', 'M4'][rng() * 4 | 0] : rng() < 0.005 ? 'DODGE' : null;
        } else { G.INPUT.mx = G.INPUT.my = 0; G.PRESS = null; }
        DRIVER.guestTick(NG, DT);
        if (live) { H.X.updateBattle(DT); NH.harvest(); if (hb.choose) H.X.confirmChoose(); }
        const t0 = performance.now(); DRIVER.hostTick(NH, DT); tick.push(performance.now() - t0);
        for (const idx of [0, 1]) { const h = hb.sides[idx].ent, g = gb.sides[idx].ent; if (live && simT > 1) err[idx === 1 ? 'own' : 'foe'].push(Math.hypot(h.x - g.x, h.y - g.y)); }
        t += DT;
      };
      while (!hb.over && t < 120) frame(true);
      hb.paused = true; // freeze the sim, keep the link running so the guest can settle
      for (let k = 0; k < 4 * 60; k++) frame(false);
      for (const idx of [0, 1]) {
        const hm = hb.sides[idx].team.map(m => Math.round(m.hp)).join(), gm = gb.sides[idx].team.map(m => Math.round(m.hp)).join();
        if (hm !== gm) throw new Error(`side ${idx} hp mismatch host ${hm} guest ${gm}`);
      }
      if (gb.over !== hb.over || gb.winner !== hb.winner) throw new Error('result mismatch');
      if (Math.hypot(gb.sides[0].ent.x - hb.sides[0].ent.x, gb.sides[0].ent.y - hb.sides[0].ent.y) > 3) throw new Error('opponent position mismatch after settling'); // own mon keeps its unacked moves while the host sim is frozen
      console.log(`  ${name}: ${a.name} vs ${b.name}: ${hb.time.toFixed(0)}s over=${hb.over} in sync`);
    } catch (e) { errors++; console.log('ERROR', e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
  const K = k => down.kinds[k] || up.kinds[k] || { n: 0, bytes: 0, max: 0 };
  const snap = K('s').n ? K('s') : K('snap'), secs = simT;
  const row = (k, l) => `${l} ${(K(k).bytes / secs / 1024).toFixed(1)} KB/s`;
  console.log(`[${name}] ${N} battles, ${errors} errors, ${secs.toFixed(0)}s simulated${applied ? `, ${applied} snapshots rebuilt identically` : ''}`);
  console.log(`  snapshot: avg ${(snap.bytes / Math.max(1, snap.n)).toFixed(0)} B, max ${snap.max} B, ${(snap.n / secs).toFixed(1)}/s = ${(snap.bytes / secs / 1024).toFixed(1)} KB/s, split into parts: ${K('part').n}`);
  console.log(`  host upload total ${(Object.values(down.kinds).reduce((s, k) => s + k.bytes, 0) / secs / 1024).toFixed(1)} KB/s (${row('fx', 'fx')}, ${row('teams', 'teams')}, ${row('part', 'parts')}), biggest fx msg ${K('fx').max} B, biggest teams msg ${K('teams').max} B; guest upload ${row('in', 'input')}, ${row('act', 'presses')}`);
  console.log(`  host send buffer wait: avg ${(avg(down.qd) * 1000).toFixed(0)} ms, p95 ${(pct(down.qd, 0.95) * 1000).toFixed(0)} ms, max ${(Math.max(0, ...down.qd) * 1000).toFixed(0)} ms; snapshot send->arrive avg ${(avg(down.age) * 1000).toFixed(0)} ms, p95 ${(pct(down.age, 0.95) * 1000).toFixed(0)} ms, max ${(Math.max(0, ...down.age) * 1000).toFixed(0)} ms; lost ${down.lost}`);
  console.log(`  guest position error vs host (px): own mon avg ${avg(err.own).toFixed(1)} p95 ${pct(err.own, 0.95).toFixed(1)} max ${Math.max(0, ...err.own).toFixed(0)}; opponent avg ${avg(err.foe).toFixed(1)} p95 ${pct(err.foe, 0.95).toFixed(1)} max ${Math.max(0, ...err.foe).toFixed(0)}`);
  if (snap.n && down.kinds.s) console.log(`  snapshot bytes by field (avg per snapshot): ${Object.entries(down.top).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, v]) => `${f} ${(v / snap.n).toFixed(0)}`).join(', ')}`);
  console.log(`  host tick (snapshot+fx+teams build) avg ${avg(tick).toFixed(3)} ms, p99 ${pct(tick, 0.99).toFixed(3)} ms, max ${Math.max(...tick).toFixed(2)} ms`);
  return { errors, snap, parts: K('part').n };
}
let bad = 0, worst = 0, parts = 0;
for (const [name, P] of Object.entries(PROFILES)) { const r = run(name, P); bad += r.errors; worst = Math.max(worst, r.snap.max); parts += r.parts; }
if (worst > 6000) console.log('WARNING: a snapshot is over 6000 B');
if (parts) console.log('WARNING: messages were split into parts');
if (bad) process.exit(1);
