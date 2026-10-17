// Adventure online world, transport-agnostic core (docs/ONLINE-ADV.md). One star: the host owns the clock, the player list and the wild spawner; guests mirror what is near them.
// Pure logic over ADV + ADVW (no DOM, no network): everything talks through env = { id, send(peer, 'ctl' | 'fast', msg), now(), connect(peer), drop(peer), onEvent(e), profile() }.
// Adapters: src/adv-peer.js (PeerJS + MQTT in the browser) and tools/adv-net-check.mjs (in memory, with latency and loss). Offline play is a host with nobody connected: same code.
// Wire (plain objects, like src/online.js): p = my state (guest to host, fast), ps = player batch, w = wild batch, claim / grant / bend = a wild fight, bv = battle view, chat, succ = host successors.
'use strict';
const ADVNET = (() => {
  const T = 32, MAX = 16, AOI = 60 * ADV.T, aoi = x => 60 * ADV.Tp(x), NEAR = 13 * T, MID = 28 * T, PS_DT = 0.1, W_DT = 0.125, KEYFRAME = 2, SUCC_DT = 5, LOST = 6000, TRY = 2500, JIT = 800, VERSION = 2, SAY_MAX = 80;

  // ---------- small helpers ----------
  const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const ri = (v, a, b) => Math.round(Math.min(b, Math.max(a, fin(v))));
  const cleanName = n => String(n ?? '').replace(/[^\w .'-]/g, '').trim().slice(0, 12) || 'Player';
  const cleanId = s => String(s ?? '').replace(/[^\w-]/g, '').slice(0, 40);
  const cleanO = a => (Array.isArray(a) ? a.slice(0, 12).map(v => ri(v, 0, 63)) : []);   // the outfit: 12 small ints (src/adv-outfit.js decides what they mean)
  const ids = a => (Array.isArray(a) ? a : []).slice(0, 32).map(cleanId).filter(Boolean);
  // chat word filter: slurs are masked with * (kept rot13 so the source stays readable), tolerant of leetspeak, repeats and separators
  const rot = s => s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + 13) % 26 + 97));
  const LEET = { a: '[a4@]', e: '[e3]', i: '[i1!|]', o: '[o0]', s: '[s5$]', g: '[g9]', l: '[l1]' };
  const BAD = 'avttre avttn snttbg ergneq xvxr puvax fcvp genaal pbba'.split(' ').map(w => { const p = rot(w); return new RegExp((p.length < 5 ? '\\b' : '') + [...p].map(c => (LEET[c] || c) + '+').join('[\\W_]*') + (p.length < 5 ? '\\b' : ''), 'gi'); });
  const filter = s => BAD.reduce((t, r) => t.replace(r, m => '*'.repeat(m.length)), String(s ?? '')).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, SAY_MAX);
  // a mon coming from another player (a trade): shape and ranges checked, species / moves must exist when the dex is loaded
  const MON_STATUS = new Set(['', 'par', 'brn', 'psn', 'slp', 'frz', 'tox']);
  const cleanMon = m => {
    if (!m || typeof m !== 'object') return null;
    const D = typeof DEX !== 'undefined' ? DEX : null, sp = String(m.species ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!sp || (D && !D.species[sp])) return null;
    const moves = (Array.isArray(m.moves) ? m.moves : []).slice(0, 4).map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, '')).filter(x => x && (!D || D.moves[x]));
    if (!moves.length) return null;
    return { species: sp, level: ri(m.level, 1, 100), moves, ability: String(m.ability ?? '').slice(0, 40), item: String(m.item ?? '').slice(0, 40), nature: String(m.nature ?? 'Hardy').replace(/[^A-Za-z]/g, '').slice(0, 12) || 'Hardy',
      status: MON_STATUS.has(m.status) ? m.status : '', exp: ri(m.exp, 0, 2e6), friend: ri(m.friend, 0, 255), ball: cleanId(m.ball) || 'pokeball', nickname: m.nickname ? cleanName(m.nickname) : '', ot: m.ot ? cleanName(m.ot) : '', hp: ri(m.hp, 0, 9999) };
  };
  const cleanTeam = t => (Array.isArray(t) ? t : []).slice(0, 6).map(cleanMon).filter(Boolean);
  const engaged = w => w.st === 'fight' || w.st === 'wait';   // a mon this player is fighting or has queued: not the host's to move

  // host = null: I host (offline, or a server I started); host = peer id: I join that host. opts (host only): { sid, name, epoch, off, online }
  function make(env, host, opts = {}) {
    const ev = e => env.onEvent && env.onEvent(e), now = () => env.now(), tx = (peer, m, fast) => env.send(peer, fast ? 'fast' : 'ctl', m);
    const N = { env, id: env.id, role: 'guest', hostId: host || env.id, pid: -1, welcomed: false, sid: '', name: '', epoch: 0, off: 0, online: false, roster: new Map(), vis: new Map(), fights: new Map(), bubbles: new Map(), mons: new Map(),
      succ: [], order: [], ping: 0, me: {}, mig: null, tr: null, pv: null, q: { p: 0, w: 0 }, pend: new Map(), rq: 0, sq: 0, onPv: null };
    const pl = new Map(), byPeer = new Map(); // host: pid -> player, peer -> pid
    const acc = { p: 0, w: 0, s: 0, ping: 0, prof: 0, sent: -1e9, kf: 0 };
    let lastHost = now(), lastSent = '', nextPid = 1, wtick = 0, ptick = 0, helloT = 0, profSig = '';
    const row = o => ({ pid: o.pid, peer: o.peer, name: o.name, av: o.av, lead: o.lead, b: o.b, o: o.o });
    const wire = r => [r.pid, r.peer, r.name, r.av, r.lead, r.b, r.o];
    const unwire = a => (Array.isArray(a) ? { pid: ri(a[0], 0, 99), peer: cleanId(a[1]), name: cleanName(a[2]), av: cleanId(a[3]), lead: cleanId(a[4]), b: ri(a[5], 0, 8), o: cleanO(a[6]) } : null);
    const pidOf = peer => { for (const r of N.roster.values()) if (r.peer === peer) return r.pid; };
    const nameOf = peer => { for (const r of N.roster.values()) if (r.peer === peer) return r.name; return 'Someone'; };
    N.serverNow = () => now() + N.off;
    N.hour = () => (((N.serverNow() - N.epoch) / 60000) % 24 + 24) % 24;   // 24 real minutes = 1 game day, the same for everyone on the server
    N.hourTotal = () => (N.serverNow() - N.epoch) / 60000;   // the same clock as a running count of game hours (never wraps): the weather slots read it
    N.peerOf = pid => N.roster.get(pid)?.peer;
    N.count = () => (N.role === 'host' ? pl.size : N.roster.size);
    N.listing = () => ({ v: VERSION, name: N.name, n: pl.size, max: MAX, host: env.id, succ: N.order.slice(), players: [...pl.values()].map(o => o.name), t: env.wall ? env.wall() : Date.now() });

    // ---------- host ----------
    const mkPl = (pid, peer, p = {}) => ({ pid, peer, name: cleanName(p.name), av: cleanId(p.av), lead: cleanId(p.lead), b: ri(p.b, 0, 8), o: cleanO(p.o), x: 0, y: 0, z: 0, fc: 0, mv: 0, room: 0, e: [pid, 0, 0, 0, 0], sig: '', last: now(), sq: 0, say: -1e9,
      kp: new Map(), kw: new Map(), kf: 0, wt: 0, fightT: -1e9, P: { x: 0, y: 0, z: 0, lv: 0, face: 0, badges: 0, busy: false, view: null } });
    function initHost(o = {}) {
      Object.assign(N, { role: 'host', hostId: env.id, pid: 0, welcomed: true, mig: null, online: !!o.online });
      N.sid = o.sid || N.sid || 'local'; N.name = o.name || N.name || 'Local'; N.epoch = o.epoch ?? N.epoch; N.off = o.off ?? N.off; N.order = ids(o.order).filter(p => p !== env.id);
      pl.clear(); byPeer.clear(); nextPid = 1; N.vis.clear(); N.fights.clear();
      const me = mkPl(0, env.id, env.profile()); pl.set(0, me); byPeer.set(env.id, 0); N.roster = new Map([[0, row(me)]]);
      // the mirror of an old host's world is dropped (except what I am fighting) and the spawner starts fresh, with ids that cannot clash with any mirrored one
      let top = ADVW.gid; for (const w of [...N.mons.values()]) { top = Math.max(top, w.nid >> 5); N.mons.delete(w.nid); if (!engaged(w)) ADVW.kill(w); }
      ADVW.gid = top + 1000; ADVW.mirror = false; ADVW.clock = N.online ? N.hour : null; ADVW.clockTotal = N.online ? N.hourTotal : null;
      if (N.me.x !== undefined) setState(me, N.me);
    }
    function setState(o, m) {
      o.x = ri(m.x, 0, 4e5); o.y = ri(m.y, 0, 4e5); o.z = ri(m.z, 0, 4e3); o.fc = ri(m.fc ?? m.face, 0, 7); o.mv = ri(m.mv, 0, 2);
      o.room = m.room ? cleanId(m.room) : 0; if (m.b !== undefined) o.b = ri(m.b, 0, 8);
      o.e = [o.pid, o.x, o.y, o.z, o.fc + 8 * o.mv]; o.sig = o.e.join();   // the follower is not sent: every screen trails it behind the player the way the scene does
      if (o.pid) Object.assign(o.P, { x: o.x, y: o.y, z: o.z, lv: Math.round(o.z / ADV.Tp(o.x)), face: o.fc, badges: o.b, view: { x0: o.x - 480, x1: o.x + 480, y0: o.y - 300, y1: o.y + 300 } });
    }
    const inB = id => !!(id && ADV.bldById && ADV.bldById.has(id));
    const near = (a, b) => a.room ? a.room === b.room : (!b.room || inB(b.room)) && Math.hypot(a.x - b.x, a.y - b.y) <= aoi(a.x);   // near(a, b): b sees a. Somebody in a room (the cave, a building) is seen by that room only; outside, everyone within 60 tiles, and the open world shows through a building's cutaway to whoever is inside one (tiles, not px: the spawner works in tiles too; NEAR / MID below are screen distances in px)
    const toAll = (m, fast, but) => { for (const o of pl.values()) if (o.pid && o.pid !== but) tx(o.peer, m, fast); };
    function onHello(from, m) {
      let o = pl.get(byPeer.get(from));
      if (!o) {
        if (m.v !== VERSION) return tx(from, { t: 'deny', why: 'You are on a different game version. Refresh the page.' });
        if (pl.size >= MAX) return tx(from, { t: 'deny', why: 'full' });
        o = mkPl(nextPid++, from, m.prof); pl.set(o.pid, o); byPeer.set(from, o.pid); if (!N.order.includes(from)) N.order.push(from);
        N.roster.set(o.pid, row(o)); toAll({ t: 'join', r: wire(o) }, false, o.pid); ev({ k: 'join', pid: o.pid, name: o.name }); ev({ k: 'count', n: pl.size });
      } else { Object.assign(o, { name: cleanName(m.prof?.name), av: cleanId(m.prof?.av), lead: cleanId(m.prof?.lead), o: cleanO(m.prof?.o) }); N.roster.set(o.pid, row(o)); }
      o.last = now(); o.sq = 0; o.kp.clear(); o.kw.clear(); o.kf = o.wt = 0; if (m.st) setState(o, m.st);
      tx(from, { t: 'welcome', v: VERSION, sid: N.sid, name: N.name, epoch: N.epoch, hn: N.serverNow(), you: o.pid, host: env.id, succ: N.order, roster: [...pl.values()].map(r => wire(r)) });
      broadcastSucc();
    }
    function broadcastSucc() { toAll({ t: 'succ', s: N.order, n: pl.size }); }
    function dropPlayer(peer, why) {
      const pid = byPeer.get(peer), o = pl.get(pid); if (!o || !pid) return;
      for (const g of ADVW.groups) if (g.claimed === pid) release(g, pid, []);
      pl.delete(pid); byPeer.delete(peer); N.order = N.order.filter(p => p !== peer); N.roster.delete(pid); N.vis.delete(pid); N.fights.delete(pid);
      toAll({ t: 'left', pid }); broadcastSucc(); ev({ k: 'left', pid, name: o.name, why }); ev({ k: 'count', n: pl.size });
      if (N.tr?.peer === peer || N.pv?.peer === peer) endDirect('left');
    }
    // players near each receiver, only what changed (everything on a keyframe), plus the ids that left its range
    function buildPs(g, kf) {
      const p = [], seen = new Set();
      for (const o of pl.values()) {
        if (o === g || !near(o, g)) continue; seen.add(o.pid);
        if ((kf || g.kp.get(o.pid) !== o.sig) && (kf || ptick % (o.room || Math.hypot(o.x - g.x, o.y - g.y) < 30 * T ? 1 : 2) === 0)) { p.push(o.e); g.kp.set(o.pid, o.sig); }
      }
      const gone = []; for (const id of [...g.kp.keys()]) if (!seen.has(id)) { gone.push(id); g.kp.delete(id); }
      return { p, gone };
    }
    // wild mons within 60 tiles of the receiver; a known one sends [nid, x, y, face, anim] (rarely when far), a new one or a keyframe sends the whole [nid, species, x, y, face, anim, level]
    function buildW(g, kf) {
      const out = [], seen = new Set();
      if (!g.room || ADV.rooms[g.room]?.live) for (const grp of ADVW.groups) {   // a live room (the Route 4 cave) has wild mons of its own, seen only by whoever is inside
        if (grp.claimed != null || grp.local) continue;
        for (const w of grp.m) {
          const e = w.e, d = Math.hypot(e.x - g.x, e.y - g.y); if (d > aoi(g.x)) continue;
          seen.add(w.nid);
          const x = Math.round(e.x), y = Math.round(e.y), an = w.moving ? 1 : 0, sig = x + ',' + y + ',' + w.face + ',' + an, old = g.kw.get(w.nid);
          if (kf || old === undefined) out.push([w.nid, w.id, x, y, w.face, an, w.level]);
          else if (old !== sig && g.wt % (w.st === 'charge' || w.st === 'flee' ? 1 : d < NEAR ? 2 : d < MID ? 4 : 8) === 0) out.push([w.nid, x, y, w.face, an]);
          else continue;
          g.kw.set(w.nid, sig);
        }
      }
      const gone = []; for (const id of [...g.kw.keys()]) if (!seen.has(id)) { gone.push(id); g.kw.delete(id); }
      return { out, gone };
    }
    function hostTick(dt, t) {
      acc.p += dt; acc.w += dt; acc.s += dt;
      if (acc.p >= PS_DT) {
        acc.p = 0; ptick++; const kfs = (acc.kf += PS_DT) >= KEYFRAME; if (kfs) acc.kf = 0;
        for (const g of pl.values()) {
          const { p, gone } = buildPs(g, kfs); if (!p.length && !gone.length) continue;
          if (!g.pid) { applyPs(p, gone); continue; }
          const m = { t: 'ps', q: ++N.q.p }; if (p.length) m.p = p; if (gone.length) m.gone = gone; if (kfs) m.k = 1; tx(g.peer, m, true);
        }
        for (const g of [...pl.values()]) if (g.pid && t - g.last > 10000) { env.drop(g.peer); dropPlayer(g.peer, 'timeout'); }
      }
      if (acc.w >= W_DT) {
        acc.w = 0; wtick++;
        for (const g of pl.values()) {
          if (!g.pid) continue; g.wt = wtick; g.kf += W_DT; const kfs = g.kf >= KEYFRAME; if (kfs) g.kf = 0;
          const { out, gone } = buildW(g, kfs); if (!out.length && !gone.length) continue;
          const m = { t: 'w', q: ++N.q.w }; if (out.length) m.g = out; if (gone.length) m.gone = gone; if (kfs) m.k = 1; tx(g.peer, m, true);
        }
      }
      if (N.pruneAt && t > N.pruneAt) { N.pruneAt = 0; N.order = N.order.filter(p => byPeer.has(p)); }   // successors that never reconnected after a migration are dead
      if (acc.s >= SUCC_DT) { acc.s = 0; broadcastSucc(); }
    }
    // wild groups: simulated around every player outside a building, including the host's own
    function hostWorld(dt) {
      const U = [], t = now(), more = [];
      for (const o of pl.values()) {
        const P = o.pid ? o.P : N.me.ent; if (!P) continue;
        if (o.pid) { P.busy = t - o.fightT < 1200; P.nospawn = P.busy; } else Object.assign(P, { busy: !!N.me.busy, nospawn: !!N.me.busy, view: N.me.view, badges: N.me.b ?? P.badges });
        if (o.room && !ADV.rooms[o.room]?.live) continue;   // wild mons stay out of buildings, not out of the cave
        U.push(P); if (o.pid && !o.room) more.push([Math.floor(o.x / (ADV.Tp(o.x) * ADV.CH)), Math.floor(o.y / (ADV.Tp(o.x) * ADV.CH))]);
      }
      ADV.more = more;
      if (!U.length) return;
      ADVW.tick(dt, U, N.me.view); ADVW.update(dt, U, 'walk');
    }
    function claimGroup(g, pid, remote) {
      if (!g || g.claimed != null || g.local || !ADVW.groups.includes(g)) return false;
      g.claimed = pid;
      if (remote) for (const w of g.m) { w.st = 'fight'; w.moving = false; }
      return true;
    }
    function release(g, pid, dead) {
      if (!g || g.claimed !== pid) return;
      g.claimed = null; const set = new Set(dead);
      for (const w of [...g.m]) { if (set.has(w.nid)) ADVW.kill(w); else if (engaged(w)) Object.assign(w, { st: 'wander', cool: 4, wait: 2, go: null, spot: null, watch: null }); }
    }
    function bvRelay(o, mons) {
      o.fightT = mons.length ? now() : -1e9;
      for (const r of pl.values()) { if (r === o || !near(o, r)) continue; if (!r.pid) applyBv(o.pid, mons); else tx(r.peer, { t: 'bv', i: o.pid, mons }, true); }
    }
    function onSay(o, s) {
      const t = now(); if (t - o.say < 500) return; o.say = t;
      s = filter(s); if (!s) return;
      applySay(o.pid, s); toAll({ t: 'chat', i: o.pid, s });
    }
    function hostRecv(from, m) {
      if (m.t === 'hello') return onHello(from, m);
      const o = pl.get(byPeer.get(from)); if (!o) return;
      o.last = now();
      switch (m.t) {
        case 'p': if (fin(m.q) > o.sq) { o.sq = m.q; setState(o, m); } break;
        case 'claim': { const g = ADVW.groups.find(q => q.gid === m.g && !q.local); tx(from, { t: 'grant', r: m.r, g: m.g, ok: claimGroup(g, o.pid, true) ? 1 : 0 }); break; }
        case 'bend': { const g = ADVW.groups.find(q => q.gid === m.g); release(g, o.pid, (Array.isArray(m.dead) ? m.dead : []).slice(0, 32).map(x => ri(x, 0, 1e9))); break; }
        case 'bv': bvRelay(o, (Array.isArray(m.mons) ? m.mons : []).slice(0, 12).map(a => (Array.isArray(a) ? [cleanId(a[0]), ri(a[1], 0, 4e5), ri(a[2], 0, 4e5), ri(a[3], 0, 4e3), ri(a[4], 0, 7), ri(a[5], 0, 7), ri(a[6], 0, 100)] : null)).filter(Boolean)); break;
        case 'chat': onSay(o, m.s); break;
        case 'prof': Object.assign(o, { name: cleanName(m.name), av: cleanId(m.av), lead: cleanId(m.lead), b: ri(m.b, 0, 8), o: cleanO(m.o) }); N.roster.set(o.pid, row(o)); toAll({ t: 'prof', r: wire(o) }, false, o.pid); break;
        case 'ping': tx(from, { t: 'pong', n: m.n }, true); break;
      }
    }

    // ---------- both: applying what arrives ----------
    function applyPs(p, gone) {
      const t = now();
      for (const e of p || []) {
        if (!Array.isArray(e)) continue;
        const pid = ri(e[0], 0, 99), x = fin(e[1]), y = fin(e[2]), z = fin(e[3]), a = ri(e[4], 0, 31); if (pid === N.pid) continue;
        let v = N.vis.get(pid);
        if (!v) { v = { pid, x, y, z, fx: x, fy: y, fz: z, walkD: 0, fwalk: 0 }; N.vis.set(pid, v); }
        Object.assign(v, { tx: x, ty: y, tz: z, face: a & 7, mv: a >> 3, ff: a & 7, fm: a >> 3, t });
      }
      for (const id of gone || []) N.vis.delete(id);
    }
    function applyBv(pid, mons) { if (mons.length) N.fights.set(pid, { mons, t: now() }); else N.fights.delete(pid); }
    function applySay(pid, s) { N.bubbles.set(pid, { s, t: now() }); ev({ k: 'chat', pid, name: N.roster.get(pid)?.name || 'Player', s }); }
    function mirrorMove(e, t) {
      const w = N.mons.get(e[0]); if (!w || w.dead) return;
      w.buf.push({ t, x: fin(e[e.length === 7 ? 2 : 1]), y: fin(e[e.length === 7 ? 3 : 2]) }); if (w.buf.length > 4) w.buf.shift();
      w.face = ri(e[e.length === 7 ? 4 : 3], 0, 7); w.moving = e[e.length === 7 ? 5 : 4] === 1;
    }
    function mirrorAdd(e, t) {
      const nid = ri(e[0], 1, 1e9), sp = cleanId(e[1]); if (!sp) return;
      if (!N.mons.has(nid)) {
        const gid = nid >> 5, x = fin(e[2]), y = fin(e[3]); let g = ADVW.groups.find(q => q.gid === gid && !q.local);
        if (!g) { g = { id: sp, home: { x, y }, m: [], gid }; ADVW.groups.push(g); }
        const en = ADV.entity(x, y); en.r = 8;
        const w = { e: en, g, id: sp, nid, level: ri(e[6], 1, 100), key: typeof DEX !== 'undefined' ? DEX.species[sp]?.sprite : undefined, tm: ADVW.tm(sp), st: 'wander', t: 0, wait: 0, go: null, cool: 0, stuck: 0, animT: Math.random() * 3, face: 0, moving: false, buf: [] };
        g.m.push(w); N.mons.set(nid, w); ADVW.load && ADVW.load(sp);
      }
      mirrorMove([nid, 0, fin(e[2]), fin(e[3]), e[4], e[5], e[6]], t);
    }
    function mirrorDrop(nid) { const w = N.mons.get(nid); if (w) { N.mons.delete(nid); if (!engaged(w)) ADVW.kill(w); } }
    function applyW(m) {
      if (!(fin(m.q) > N.q.w)) return; N.q.w = m.q;
      const t = now(), have = new Set();
      for (const e of Array.isArray(m.g) ? m.g : []) { if (!Array.isArray(e)) continue; have.add(e[0]); if (e.length === 7) mirrorAdd(e, t); else if (e.length === 5) mirrorMove(e, t); }
      for (const id of Array.isArray(m.gone) ? m.gone : []) mirrorDrop(id);
      if (m.k) for (const nid of [...N.mons.keys()]) if (!have.has(nid)) mirrorDrop(nid);   // a keyframe lists everything in range: what it lacks is gone (covers lost messages)
    }
    // guests draw wild mons 150 ms in the past, between the two samples around that moment
    function interp(dt) {
      const rt = now() - 150, k = 1 - Math.exp(-dt * 12);
      for (const w of N.mons.values()) {
        const b = w.buf, e = w.e; w.animT += dt; if (!b.length || engaged(w)) continue;
        const L = b[b.length - 1]; let x = L.x, y = L.y;
        if (rt < L.t && b.length > 1) { if (rt <= b[0].t) { x = b[0].x; y = b[0].y; } else { let i = 1; while (b[i].t < rt) i++; const a = b[i - 1], c = b[i], u = (rt - a.t) / (c.t - a.t || 1); x = a.x + (c.x - a.x) * u; y = a.y + (c.y - a.y) * u; } }
        if (Math.hypot(x - e.x, y - e.y) > 160) { e.x = x; e.y = y; } else { e.x += (x - e.x) * k; e.y += (y - e.y) * k; }
        const h = ADV.h(Math.floor(e.x / ADV.Tp(e.x)), Math.floor(e.y / ADV.Tp(e.x))); if (h >= 0) { e.lv = h; e.z = e.sz = ADV.heightAt(e.x, e.y, h); }
      }
    }
    function smoothVis(dt) {
      const k = 1 - Math.exp(-dt * 16), t = now();
      for (const [id, v] of N.vis) {
        if (t - v.t > 15000) { N.vis.delete(id); continue; }
        const ox = v.x, oy = v.y, fx = v.fx, fy = v.fy;
        if (Math.hypot(v.tx - v.x, v.ty - v.y) > 160) { v.x = v.tx; v.y = v.ty; } else { v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; }
        if (v.mv) v.hd = DIR_VEC[v.face] || v.hd;
        const h = v.hd || [0, 1], gx = v.x - h[0] * 28, gy = v.y - h[1] * 28;   // the lead mon trails 28 px behind along the heading
        if (Math.hypot(gx - v.fx, gy - v.fy) > 160) { v.fx = gx; v.fy = gy; } else { v.fx += (gx - v.fx) * k * 0.7; v.fy += (gy - v.fy) * k * 0.7; }
        v.z += (v.tz - v.z) * k; v.fz = v.z; v.walkD += Math.hypot(v.x - ox, v.y - oy); v.fwalk += Math.hypot(v.fx - fx, v.fy - fy);
      }
      for (const [id, f] of N.fights) if (t - f.t > 1200) N.fights.delete(id);
      for (const [id, b] of N.bubbles) if (t - b.t > 5000) N.bubbles.delete(id);
    }

    // ---------- guest ----------
    const stateMsg = () => { const s = N.me, m = { t: 'p', q: ++N.sq, x: Math.round(fin(s.x)), y: Math.round(fin(s.y)), z: Math.round(fin(s.z)), fc: s.face | 0, mv: s.mv | 0, b: s.b | 0 }; if (s.room) m.room = s.room; return m; };
    function sendHello() { helloT = now(); tx(N.hostId, { t: 'hello', v: VERSION, prof: env.profile(), st: stateMsg() }); }
    function onWelcome(m) {
      if (m.v !== VERSION) return;
      Object.assign(N, { welcomed: true, mig: null, pid: ri(m.you, 0, 99), sid: cleanId(m.sid), name: cleanName(m.name), epoch: fin(m.epoch), off: fin(m.hn) - now(), succ: ids(m.succ), online: true, hostId: N.hostId });
      N.roster = new Map(); for (const a of Array.isArray(m.roster) ? m.roster : []) { const r = unwire(a); if (r) N.roster.set(r.pid, r); }
      N.vis.clear(); N.fights.clear(); N.q.p = N.q.w = 0; lastHost = now(); lastSent = ''; acc.sent = -1e9;
      for (const w of [...N.mons.values()]) { N.mons.delete(w.nid); if (!engaged(w)) ADVW.kill(w); }   // a new host: its world replaces the old mirror
      ADVW.mirror = true; ADVW.clock = N.hour; ADVW.clockTotal = N.hourTotal;
      ev({ k: 'welcome', name: N.name, host: N.hostId }); ev({ k: 'count', n: N.roster.size });
    }
    function guestRecv(from, m) {
      if (m.t === 'hello') { // another guest thinks the host is gone: if it is one of my successors, so do I
        if (!N.succ.includes(from)) return tx(from, { t: 'deny', why: 'notHost' });
        hostLost(); return tx(from, { t: 'deny', why: 'retry' });
      }
      if (from !== N.hostId) return;
      lastHost = now();
      switch (m.t) {
        case 'welcome': onWelcome(m); break;
        case 'deny': if (m.why === 'retry' && N.mig) N.mig.retry = now() + 400; else if (!N.welcomed && !N.mig) ev({ k: 'denied', why: String(m.why || '').slice(0, 80) }); break;
        case 'ps': if (fin(m.q) > N.q.p) { N.q.p = m.q; applyPs(m.p, m.gone); } break;
        case 'w': applyW(m); break;
        case 'grant': { const p = N.pend.get(m.r); if (p) { N.pend.delete(m.r); p.cb(m.ok === 1); } break; }
        case 'bv': applyBv(ri(m.i, 0, 99), (Array.isArray(m.mons) ? m.mons : []).slice(0, 12).filter(Array.isArray)); break;
        case 'chat': applySay(ri(m.i, 0, 99), filter(m.s)); break;
        case 'join': { const r = unwire(m.r); if (r) { N.roster.set(r.pid, r); ev({ k: 'join', pid: r.pid, name: r.name }); ev({ k: 'count', n: N.roster.size }); } break; }
        case 'prof': { const r = unwire(m.r); if (r) N.roster.set(r.pid, r); break; }
        case 'left': { const pid = ri(m.pid, 0, 99), r = N.roster.get(pid); N.roster.delete(pid); N.vis.delete(pid); N.fights.delete(pid); ev({ k: 'left', pid, name: r?.name }); ev({ k: 'count', n: N.roster.size }); if (r && (N.tr?.peer === r.peer || N.pv?.peer === r.peer)) endDirect('left'); break; }
        case 'succ': N.succ = ids(m.s); break;
        case 'merge': { const h = cleanId(m.host), old = N.hostId; if (h && h !== env.id && !N.mig) { N.mig = { c: [h], i: -1, t: now(), retry: 0 }; ev({ k: 'merge' }); migNext(); env.drop(old); } break; }
        case 'pong': N.ping = Math.max(0, now() - fin(m.n)); break;
      }
    }
    function guestTick(dt, t) {
      if (N.mig) { const m = N.mig; if (m.at) { if (t >= m.at) becomeHost(); return; } if (t - m.t > TRY) { env.drop(N.hostId); migNext(); } else if (m.retry && t >= m.retry) { m.retry = 0; sendHello(); } return; }
      if (!N.welcomed) { if (t - helloT > 8000 && helloT) ev({ k: 'denied', why: 'no answer' }); return; }
      if (t - lastHost > LOST) return hostLost();
      acc.p += dt; acc.ping += dt;
      if (acc.p >= PS_DT) {
        acc.p = 0; const m = stateMsg(); delete m.q; const sig = JSON.stringify(m); m.q = N.sq;
        if (sig !== lastSent || t - acc.sent > 500) { lastSent = sig; acc.sent = t; tx(N.hostId, m, true); }
      }
      if (acc.ping >= 2) { acc.ping = 0; tx(N.hostId, { t: 'ping', n: t }, true); }
      for (const [r, p] of N.pend) if (t - p.t > 3000) { N.pend.delete(r); p.cb(false); }
    }

    // ---------- host migration: the successor list is the host's guests in join order; the first one still alive hosts, the rest reconnect to it ----------
    function hostLost() {
      if (N.role !== 'guest' || N.mig || !N.welcomed) return;
      for (const [r, p] of N.pend) { N.pend.delete(r); p.cb(false); }
      N.mig = { c: N.succ.filter(p => p !== N.hostId), i: -1, t: now(), retry: 0 }; ev({ k: 'lost' }); migNext();
    }
    function migNext() {
      const m = N.mig; if (!m || m.at) return; m.i++; m.t = now(); m.retry = 0;
      const peer = m.c[m.i];
      if (peer === undefined || peer === env.id) { if (m.i > 0) { m.at = now() + Math.random() * JIT; return; } return becomeHost(); }   // earlier successors looked dead: wait a random moment so two guests do not both promote
      N.hostId = peer; N.welcomed = false; env.connect(peer);
    }
    function becomeHost() {
      const m = N.mig, old = N.hostId; env.drop(old);
      initHost({ order: m ? m.c.slice(m.i + 1) : [], sid: N.sid, name: N.name, epoch: N.epoch, off: N.off, online: true });
      acc.p = acc.w = 0; acc.s = SUCC_DT; N.pruneAt = now() + 10000; ev({ k: 'role', role: 'host' });
    }
    // split brain: two hosts of one server. The adapter calls N.rival(listing of the other host) when it hears of one. The bigger server wins (lower peer id on a tie);
    // the loser drops its wild world, tells its guests and joins the winner like a migrating guest, each keeping its own player state.
    // ponytail: counts come from the listing (up to 10 s old); if both sides read each other as bigger the attempt times out and both stay hosts until the next listing
    N.rival = e => {
      const h = cleanId(e?.host); if (N.role !== 'host' || !h || h === env.id) return;
      const n = ri(e.n, 0, MAX); if (n > pl.size || (n === pl.size && h < env.id)) merge(h);
    };
    function merge(to) {
      toAll({ t: 'merge', host: to });
      for (const g of [...ADVW.groups]) if (!g.local && g.claimed !== 0) for (const w of [...g.m]) ADVW.kill(w);
      pl.clear(); byPeer.clear(); N.order = []; N.succ = []; N.roster = new Map(); N.vis.clear(); N.fights.clear(); N.pid = -1; N.role = 'guest'; N.welcomed = false;
      N.mig = { c: [to], i: -1, t: now(), retry: 0 }; ev({ k: 'role', role: 'guest' }); ev({ k: 'merge' }); migNext();
    }
    N.peerUp = peer => { if (N.role === 'guest' && peer === N.hostId && !N.welcomed) sendHello(); };
    N.peerFail = peer => { if (N.role === 'guest' && peer === N.hostId) { if (N.mig) migNext(); else ev({ k: 'denied', why: 'Could not connect' }); } };
    N.peerDown = peer => {
      if (N.role === 'host') dropPlayer(peer, 'closed');
      else if (peer === N.hostId) { if (N.mig) migNext(); else if (N.welcomed) hostLost(); else ev({ k: 'denied', why: 'Connection lost' }); }
      else if (N.tr?.peer === peer || N.pv?.peer === peer) endDirect('left');
    };

    // ---------- what the game calls ----------
    // my own state every frame: { x, y, z, face, mv (0 still, 1 walk, 2 run), room, b (badges), busy, view, ent (my entity, for the wild sim) }
    N.local = s => {
      N.me = s;
      if (N.role === 'host') { const o = pl.get(0); setState(o, s); o.P = s.ent || o.P; }
    };
    N.tick = dt => {
      const t = now();
      for (const k of ['tr', 'pv']) if (N[k] && (N[k].st === 'ask' || N[k].st === 'asked') && t - (N[k].t0 ??= t) > 20000) { if (N[k].st === 'ask') tx(N[k].peer, { t: k === 'tr' ? 'trade' : 'pvp', k: 'x' }); N[k] = null; ev({ k: 'directEnd', why: 'had no answer' }); }   // a request nobody answers lapses
      if (N.role === 'host') hostTick(dt, t); else guestTick(dt, t);
      smoothVis(dt);
      if ((acc.prof += dt) >= 1) { // my name, portrait, lead mon or badges changed
        acc.prof = 0; const p = env.profile(), sig = JSON.stringify(p);
        if (sig !== profSig) { const first = !profSig; profSig = sig; if (!first) { if (N.role === 'host') { const o = pl.get(0); Object.assign(o, { name: cleanName(p.name), av: cleanId(p.av), lead: cleanId(p.lead), b: ri(p.b, 0, 8), o: cleanO(p.o) }); N.roster.set(0, row(o)); toAll({ t: 'prof', r: wire(o) }); } else if (N.welcomed) tx(N.hostId, { t: 'prof', name: p.name, av: p.av, lead: p.lead, b: p.b, o: p.o }); } }
      }
    };
    N.world = dt => { if (N.role === 'host') hostWorld(dt); else { interp(dt); if (N.me.ent) ADVW.update(dt, N.me.ent, 'battle'); } };
    // touching a wild group starts a fight only if the host grants it: cb(true) at once for the host (and offline), after a round trip for a guest
    N.claim = (w, cb) => {
      const g = w.g;
      if (g.local) return cb(true);   // an ambush out of the grass is yours alone
      if (N.role === 'host') return cb(claimGroup(g, 0, false));
      if (!N.welcomed || N.mig) return cb(false);
      const r = ++N.rq; N.pend.set(r, { cb, t: now() }); tx(N.hostId, { t: 'claim', r, g: g.gid });
    };
    // the fight is over: result 'won' | 'caught' | 'fled' | 'lost', dead = nids of the members that are gone for good; the rest of the group goes back to the world
    N.bend = (w, result, dead = []) => {
      const g = w.g; if (g.local) return;
      if (N.role === 'host') return release(g, 0, dead);
      tx(N.hostId, { t: 'bend', g: g.gid, result, dead });
      for (const m of [...g.m]) { N.mons.delete(m.nid); ADVW.kill(m); }   // the host sends what is left again
    };
    N.bv = mons => { if (N.role === 'host') bvRelay(pl.get(0), mons); else if (N.welcomed) tx(N.hostId, { t: 'bv', mons }, true); };
    N.say = s => {
      s = filter(s); if (!s) return;
      if (N.role === 'host') onSay(pl.get(0), s); else if (N.welcomed) tx(N.hostId, { t: 'chat', s });
    };
    // the visible player in front of p (facing cone), for the player menu
    N.target = p => {
      const v = DIR_VEC[p.face] || [0, 1]; let best = null, bd = 1e9;
      for (const o of N.vis.values()) { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy); if (d < 44 && d < bd && (d < 14 || (dx * v[0] + dy * v[1]) / d > 0.35)) { best = o; bd = d; } }
      return best;
    };
    // the scene moved me far away (a blackout): a guest drops its mirror to be sent again, a host that shares the world keeps it
    N.reset = () => {
      if (N.role === 'host' && N.count() > 1) { for (const g of ADVW.groups) if (g.claimed === 0) release(g, 0, []); ADVW.groups = ADVW.groups.filter(g => !g.local); return; }
      N.mons.clear(); ADVW.reset();
    };
    // a fight within 3 tiles of p that is not mine
    N.fightNear = p => { for (const f of N.fights.values()) for (const m of f.mons) if (Math.hypot(m[1] - p.x, m[2] - p.y) < 3 * ADV.Tp(p.x)) return true; return false; };
    N.leave = () => { if (N.role === 'host') { for (const o of pl.values()) if (o.pid) env.drop(o.peer); } else env.drop(N.hostId); ADVW.clock = null; ADVW.clockTotal = null; ADVW.mirror = false; ADV.more = []; };

    // ---------- direct peer to peer: trading and PvP ----------
    function endDirect(why) { const was = N.tr || N.pv; N.tr = N.pv = null; if (was) ev({ k: 'directEnd', why }); }
    // trade: both pick a mon, both confirm, both confirm again (the offer each saw is checked by version), then each swaps its slot
    N.trade = {
      ask(pid) { const peer = N.peerOf(pid); if (!peer || N.tr || N.pv) return false; N.tr = { peer, st: 'ask', vm: 0, vt: 0, mine: null, theirs: null, c1: [0, 0], c2: [0, 0] }; tx(peer, { t: 'trade', k: 'ask' }); return true; },
      reply(ok) { const tr = N.tr; if (!tr || tr.st !== 'asked') return; tx(tr.peer, { t: 'trade', k: ok ? 'ok' : 'no' }); if (ok) { tr.st = 'pick'; ev({ k: 'tradeOpen' }); } else N.tr = null; },
      pick(i, mon) { const tr = N.tr; if (!tr || (tr.st !== 'pick' && tr.st !== 'final')) return; tr.mine = { i, m: mon }; tr.vm++; tr.st = 'pick'; tr.c1 = [0, 0]; tr.c2 = [0, 0]; tx(tr.peer, { t: 'trade', k: 'pick', v: tr.vm, m: mon }); },
      confirm() {
        const tr = N.tr; if (!tr || !tr.mine || !tr.theirs) return;
        const k = tr.st === 'pick' ? 'c1' : tr.st === 'final' ? 'c2' : ''; if (!k || tr[k][0]) return;
        tr[k][0] = 1; tx(tr.peer, { t: 'trade', k, a: tr.vm, b: tr.vt }); tradeCheck();
      },
      cancel() { const tr = N.tr; if (tr) { tx(tr.peer, { t: 'trade', k: 'x' }); N.tr = null; } },
    };
    function tradeCheck() {
      const tr = N.tr; if (!tr) return;
      if (tr.st === 'pick' && tr.c1[0] && tr.c1[1]) tr.st = 'final';
      if (tr.st === 'final' && tr.c2[0] && tr.c2[1]) { N.tr = null; ev({ k: 'tradeDone', idx: tr.mine.i, mon: tr.theirs }); } else ev({ k: 'trade' });
    }
    function tradeRecv(from, m) {
      const tr = N.tr, k = m.k;
      if (k === 'ask') { if (tr || N.pv) return tx(from, { t: 'trade', k: 'no' }); N.tr = { peer: from, st: 'asked', vm: 0, vt: 0, mine: null, theirs: null, c1: [0, 0], c2: [0, 0] }; return ev({ k: 'tradeAsk', peer: from, name: nameOf(from) }); }
      if (!tr || tr.peer !== from) return;
      if (k === 'no' || k === 'x') { N.tr = null; return ev({ k: 'directEnd', why: k === 'no' ? 'declined' : 'cancelled' }); }
      if (k === 'ok' && tr.st === 'ask') { tr.st = 'pick'; return ev({ k: 'tradeOpen' }); }
      if (tr.st !== 'pick' && tr.st !== 'final') return;
      if (k === 'pick') { const mon = cleanMon(m.m); if (!mon) return; tr.theirs = mon; tr.vt = ri(m.v, 0, 1e6); tr.st = 'pick'; tr.c1 = [0, 0]; tr.c2 = [0, 0]; ev({ k: 'trade' }); }
      else if ((k === 'c1' && tr.st === 'pick' || k === 'c2' && tr.st === 'final') && m.a === tr.vt && m.b === tr.vm && tr.mine && tr.theirs) { tr[k][1] = 1; tradeCheck(); }
    }
    // PvP: the challenged player accepts, the challenger hosts the fight (arena netcode through { t: 'pv', m } over the same direct link); the scene builds the battle
    N.pvp = {
      ask(pid, team) { const peer = N.peerOf(pid); if (!peer || N.tr || N.pv) return false; N.pv = { peer, pid, st: 'ask' }; tx(peer, { t: 'pvp', k: 'ask', team }); return true; },
      reply(ok, team) { const pv = N.pv; if (!pv || pv.st !== 'asked') return; tx(pv.peer, { t: 'pvp', k: ok ? 'ok' : 'no', team }); if (ok) pv.st = 'accepted'; else N.pv = null; },
      start(m) { const pv = N.pv; if (pv) { pv.st = 'run'; tx(pv.peer, { t: 'pvp', k: 'start', ...m }); } },
      end() { const pv = N.pv; if (pv) { tx(pv.peer, { t: 'pvp', k: 'end' }); N.pv = null; } },
    };
    N.sendPv = (m, fast) => { if (N.pv) tx(N.pv.peer, { t: 'pv', m }, fast); };
    function pvpRecv(from, m) {
      const pv = N.pv, k = m.k;
      if (k === 'ask') { if (pv || N.tr) return tx(from, { t: 'pvp', k: 'no' }); N.pv = { peer: from, pid: pidOf(from), st: 'asked', team: cleanTeam(m.team) }; return ev({ k: 'pvpAsk', peer: from, name: nameOf(from) }); }
      if (!pv || pv.peer !== from) return;
      if (k === 'no' || k === 'end') { N.pv = null; ev({ k: 'pvpEnd', why: k === 'no' ? 'declined' : 'over' }); }
      else if (k === 'ok' && pv.st === 'ask') { pv.st = 'run'; pv.team = cleanTeam(m.team); ev({ k: 'pvpGo', peer: from }); }
      else if (k === 'start' && pv.st === 'accepted') { pv.st = 'run'; ev({ k: 'pvpStart', m, peer: from }); }
    }

    N.recv = (from, m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'trade') return tradeRecv(from, m);
      if (m.t === 'pvp') return pvpRecv(from, m);
      if (m.t === 'pv') return N.onPv && N.onPv(from, m.m);
      if (N.role === 'host') hostRecv(from, m); else guestRecv(from, m);
    };

    N.initHost = initHost;
    if (host) { N.hostId = host; N.role = 'guest'; } else initHost(opts);
    profSig = JSON.stringify(env.profile());
    return N;
  }
  return { make, filter, cleanMon, cleanName, VERSION, MAX, AOI };
})();
