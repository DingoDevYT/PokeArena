// Adventure online, browser adapter: PeerJS (WebRTC, same cloud as the arena) carries the ADVNET core's messages, retained MQTT messages on the public EMQX broker list the servers.
// Every link is two data channels like src/online.js: 'ctl' reliable + ordered, 'fast' unordered (position and wild batches; skipped when the browser's send buffer is behind).
// ADVPEER.start(mode, o) returns a controller { N, status, stop() }. N is an offline host at once (same code path) and swaps to the real server once it is joined or hosted.
// Discovery: retained `pokearena/adv1/servers/<serverId>` = ADVNET listing, refreshed every 10 s by the host, cleared on close (last will on a crash), ignored when older than 30 s.
'use strict';
const ADVPEER = (() => {
  const TOPIC = 'pokearena/adv1/servers/', ID = 'pokearena-adv-', BACKLOG = 6000, STALE = 30000;
  const rid = n => Array.from({ length: n }, () => ONLINE.CHARS[Math.random() * ONLINE.CHARS.length | 0]).join('');
  const hourNow = () => { const d = new Date(); return ((d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000) / 60) % 24; };   // the local game clock (adv-wild.js hour()), so a new server starts at the time you were seeing
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const idOk = s => /^[\w-]{4,40}$/.test(String(s));

  // ---------- server list ----------
  // st.list() = live servers, fullest first; cb() on every change
  function servers(cb) {
    const st = { map: new Map(), status: 'Connecting to the server list...', client: null, close() { try { st.client && st.client.end(); } catch {} st.client = null; },
      list() { return [...st.map.values()].filter(e => Date.now() - e.t < STALE).sort((a, b) => b.n - a.n); } };
    loadLib(ONLINE.MQTT, 'mqtt').then(mqtt => {
      if (st.closed) return;
      const c = st.client = mqtt.connect(ONLINE.BROKER, { reconnectPeriod: 4000 });
      c.on('connect', () => { st.status = ''; c.subscribe(TOPIC + '+'); cb(); });
      c.on('error', () => { st.status = 'The server list is unreachable right now.'; cb(); });
      c.on('message', (topic, buf) => {
        const sid = topic.slice(TOPIC.length); if (!/^[A-Z0-9]{4,12}$/.test(sid)) return;
        if (!buf.length) { st.map.delete(sid); return cb(); }
        try {
          const l = JSON.parse(buf.toString());
          if (l && l.v === ADVNET.VERSION && idOk(l.host)) st.map.set(sid, { sid, name: String(l.name || 'Server').replace(/[^\w .'-]/g, '').slice(0, 24), n: Math.max(0, Math.min(ADVNET.MAX, l.n | 0)), max: ADVNET.MAX, host: l.host, succ: (Array.isArray(l.succ) ? l.succ : []).filter(idOk).slice(0, 16),
            players: (Array.isArray(l.players) ? l.players : []).slice(0, 16).map(ADVNET.cleanName), t: +l.t || 0 });
        } catch {}
        cb();
      });
    }).catch(() => { st.status = 'The server list is unreachable right now.'; cb(); });
    return st;
  }

  // ---------- one node: a PeerJS peer, its links and the core on top ----------
  async function openPeer() {
    const Peer = await loadLib(ONLINE.PEER, 'Peer');
    for (let tries = 0; tries < 5; tries++) {
      const p = await new Promise((res, rej) => { const q = new Peer(ID + rid(8), { debug: 0 }); q.on('open', () => res(q)); q.on('error', e => { try { q.destroy(); } catch {} if (e.type === 'unavailable-id') res(null); else rej(e); }); });
      if (p) return p;
    }
    throw new Error('No free peer id');
  }
  // make: (env) => core. Resolves with { N, S }
  async function node(ctl, make) {
    const peer = await openPeer(), S = { peer, conns: new Map(), mq: null, mqT: 0, dead: false, N: null };
    peer.on('disconnected', () => { if (!S.dead) try { peer.reconnect(); } catch {} });
    peer.on('error', e => { const m = /peer ([\w-]+)/.exec(e.message || ''); if (e.type === 'peer-unavailable' && m) { S.conns.delete(m[1]); S.N && S.N.peerFail(m[1]); } });
    const wire = (conn, out) => {
      const to = conn.peer, fast = conn.label === 'fast';
      let c = S.conns.get(to); if (!c) S.conns.set(to, c = { ctl: null, fast: null, q: [], out, up: false });
      c[fast ? 'fast' : 'ctl'] = conn;
      conn.on('data', m => { try { S.N.recv(to, m); } catch (e) { console.warn('adv net', e); } });
      const open = () => { if (fast) return; c.up = true; for (const m of c.q.splice(0)) try { conn.send(m); } catch {} if (c.out) S.N.peerUp(to); };
      conn.open ? open() : conn.on('open', open);
      conn.on('close', () => { if (fast) { if (c.fast === conn) c.fast = null; return; } if (S.conns.get(to) === c) { S.conns.delete(to); S.N.peerDown(to); } });
      conn.on('error', () => {});
    };
    peer.on('connection', conn => wire(conn, false));
    const openTo = to => {
      const c = { ctl: null, fast: null, q: [], out: true, up: false };
      S.conns.set(to, c);
      wire(peer.connect(to, { serialization: 'json', reliable: true, label: 'ctl' }), true); wire(peer.connect(to, { serialization: 'json', reliable: false, label: 'fast' }), true);
      setTimeout(() => { if (!c.up && S.conns.get(to) === c && !S.dead) { S.conns.delete(to); S.N.peerFail(to); } }, 10000);   // strict NATs: nothing answers
      return c;
    };
    const env = { id: peer.id, now: () => performance.now(), wall: () => Date.now(), profile: ctl.o.profile, onEvent: e => ctl.event(e, S),
      send(to, ch, m) {
        const c = S.conns.get(to) || openTo(to);
        if (!c.up) { if (c.q.length < 60) c.q.push(m); return; }
        const f = ch === 'fast' && c.fast && c.fast.open ? c.fast : c.ctl;
        if (f !== c.ctl && f.dataChannel && f.dataChannel.bufferedAmount > BACKLOG) return;   // behind: the next one is newer anyway
        try { f.send(m); } catch {}
      },
      connect(to) { if (!S.conns.has(to)) openTo(to); },
      drop(to) { const c = S.conns.get(to); S.conns.delete(to); if (c) for (const k of ['ctl', 'fast']) try { c[k] && c[k].close(); } catch {} },
    };
    S.N = make(env);
    S.stop = () => {
      S.dead = true; try { S.N.leave(); } catch {}
      listingStop(S, true); for (const c of S.conns.values()) for (const k of ['ctl', 'fast']) try { c[k] && c[k].close(); } catch {}
      try { peer.destroy(); } catch {}
    };
    return S;
  }
  // the host registers its server (and re-registers after a migration)
  async function listingStart(S) {
    if (S.mq || S.dead) return;
    try {
      const mqtt = await loadLib(ONLINE.MQTT, 'mqtt'), topic = TOPIC + S.N.sid;
      if (S.mq || S.dead) return;
      const c = S.mq = mqtt.connect(ONLINE.BROKER, { reconnectPeriod: 4000, will: { topic, payload: '', retain: true, qos: 0 } }), pub = () => { if (S.N.role === 'host') c.publish(topic, JSON.stringify(S.N.listing()), { retain: true }); };
      c.on('connect', () => { c.subscribe(topic); pub(); }); c.on('error', () => {}); S.mqTopic = topic; S.mqT = setInterval(pub, 10000);
      c.on('message', (t, buf) => {   // the same topic holds the other host's entry when a server has split in two: the core decides who yields
        try { const l = buf.length && JSON.parse(buf.toString()); if (l && l.v === ADVNET.VERSION && l.host !== S.N.id && idOk(l.host) && Date.now() - (+l.t || 0) < STALE) S.N.rival(l); } catch {}
      });
    } catch { /* the server still works without the list */ }
  }
  function listingStop(S, clear) {
    if (S.mqT) clearInterval(S.mqT); S.mqT = 0;
    if (S.mq) { try { if (clear) S.mq.publish(S.mqTopic, '', { retain: true }); S.mq.end(); } catch {} S.mq = null; }
  }

  // ---------- starting ----------
  const swap = (ctl, S) => { const old = ctl.S; ctl.S = S; ctl.N = S.N; ctl.status = ''; ctl.o.onSwap && ctl.o.onSwap(S.N); if (old) old.stop(); };
  async function host(ctl) {
    ctl.status = 'Starting a server...';
    const S = await node(ctl, env => ADVNET.make(env, null, { sid: rid(6), name: (ctl.o.profile().name + "'s world").slice(0, 24), epoch: performance.now() - hourNow() * 60000, online: true }));
    if (ctl.dead) return S.stop();
    listingStart(S); swap(ctl, S);
  }
  // resolves when the server's welcome arrives; rejects with a plain reason
  async function join(ctl, e) {
    ctl.status = 'Joining ' + e.name + '...';
    let done, fail; const p = new Promise((a, b) => { done = a; fail = b; });
    const S = await node(ctl, env => ADVNET.make(env, e.host));
    if (ctl.dead) { S.stop(); throw new Error('cancelled'); }
    S.waiter = ev => { if (ev.k === 'welcome') done(); else if (ev.k === 'denied') fail(new Error(ev.why === 'full' ? 'That server is full.' : ev.why)); };
    const t = setTimeout(() => fail(new Error('Could not connect. A network may be blocking peer-to-peer.')), 14000);
    S.N.env.connect(e.host);
    try { await p; } catch (err) { S.waiter = null; S.stop(); throw err; } finally { clearTimeout(t); }
    S.waiter = null; swap(ctl, S);
  }
  async function fill(ctl, pick) {   // look at the list for a moment, then try servers in order
    const sv = servers(() => {}); ctl.status = 'Looking for servers...';
    for (let i = 0; i < 40 && !sv.list().length && !ctl.dead; i++) await wait(100);
    if (sv.list().length) await wait(600);
    const all = sv.list(); sv.close();
    return pick(all);
  }
  async function run(ctl, mode) {
    try {
      let cands = [];
      if (mode.kind === 'auto') cands = await fill(ctl, all => all.filter(e => e.n < e.max));
      else if (mode.kind === 'server') cands = [mode.entry];
      else if (mode.kind === 'friend') {
        cands = await fill(ctl, all => all.filter(e => e.players.some(n => n.toLowerCase() === mode.name.toLowerCase())));
        if (!cands.length) throw new Error('No server lists a player called ' + mode.name + '.');
      }
      for (const e of cands.slice(0, 3)) { if (ctl.dead) return; try { await join(ctl, e); return; } catch (err) { if (mode.kind !== 'auto') throw err; } }
      if (mode.kind === 'auto' && !ctl.dead) await host(ctl);
    } catch (err) { ctl.status = ''; ctl.event({ k: 'netfail', why: err.message || 'Could not connect.' }); }
  }
  function start(mode, o) {
    const ctl = { N: null, S: null, status: '', dead: false, o, mode: mode.kind,
      event(e, S) { if (S && S !== ctl.S && !S.waiter) return; if (S && S.waiter) S.waiter(e); if (e.k === 'role' && S) { if (e.role === 'host') listingStart(S); else listingStop(S, false); } o.onEvent(e); },
      stop() { ctl.dead = true; if (ctl.S) ctl.S.stop(); else ctl.N && ctl.N.leave(); } };
    ctl.N = ADVNET.make({ id: 'local', send() {}, now: () => performance.now(), wall: () => Date.now(), connect() {}, drop() {}, onEvent: e => o.onEvent(e), profile: o.profile }, null, { sid: 'local', name: 'Offline', epoch: 0 });   // offline: a host nobody can reach
    if (mode.kind !== 'off') run(ctl, mode);
    return ctl;
  }
  window.addEventListener('pagehide', () => { if (typeof AdventureScene !== 'undefined' && AdventureScene.net) AdventureScene.net.stop(); });
  return { start, servers };
})();
