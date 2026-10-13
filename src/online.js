// Online play. Matches run peer to peer over WebRTC (PeerJS cloud brokers the handshake; the join code is the peer id).
// The lobby browser is a retained-message topic on a public MQTT broker. No accounts, no servers of ours. See docs/ONLINE.md.
const ONLINE = {
  PEER: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', MQTT: 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
  BROKER: 'wss://broker.emqx.io:8084/mqtt', TOPIC: 'pokearena/v1/lobby/', CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', VERSION: 1,
};
const libs = {};
const loadLib = (url, name) => libs[url] ||= new Promise((ok, no) => {
  if (window[name]) return ok(window[name]);
  const s = document.createElement('script'); s.src = url; s.onload = () => ok(window[name]); s.onerror = () => { delete libs[url]; no(new Error('Could not load ' + name)); };
  document.head.appendChild(s);
});
NETSYNC.send = m => { try { if (NET.conn && NET.conn.open) NET.conn.send(m); } catch {} };

// ---------- what a peer may tell us: everything is re-validated, nothing is trusted as code or a URL ----------
const cleanTeam = t => (Array.isArray(t) ? t : []).slice(0, 6).map(s => ({
  species: String(s?.species || '').slice(0, 40), level: clamp(+s?.level || 50, 1, 100), moves: (Array.isArray(s?.moves) ? s.moves : []).slice(0, 4).map(m => String(m).slice(0, 40)),
  ability: String(s?.ability || '').slice(0, 40), item: String(s?.item || '').slice(0, 40), nature: String(s?.nature || 'Hardy').slice(0, 20),
})).filter(s => DEX.species[toId(s.species)]);
const cleanName = n => String(n || 'Player').replace(/[^\w .'-]/g, '').slice(0, 16) || 'Player';
const cleanSprite = p => ((window.PLAYER_SPRITES || []).find(x => x.sprite === p) || (window.PLAYER_SPRITES || [])[0] || {}).sprite || '';
const me = () => {
  const st = OnlineScene.st, teams = savedTeams(), t = teams[clamp(st.team, 0, teams.length - 1)];
  return { name: cleanName(STORE.get('playerName', 'You')), sprite: cleanSprite(STORE.get('playerSprite', '')), team: cleanTeam(leadFirst(t.mons, st.lead)) };
};
const newCode = () => Array.from({ length: 5 }, () => ONLINE.CHARS[Math.random() * ONLINE.CHARS.length | 0]).join('');

// ---------- connection lifecycle ----------
function netLeave(msg = '') {
  NETSYNC.end(); NETSYNC.menuOpen = false;
  for (const k of ['conn', 'peer']) { try { NET[k] && (k === 'conn' ? NET[k].close() : NET[k].destroy()); } catch {} NET[k] = null; }
  lobbyStop(true);
  NET.role = ''; NET.cfg = null; OnlineScene.msg = msg;
  B = null;
  setScene(OnlineScene);
}
function wireConn(conn) {
  NET.conn = conn;
  conn.on('data', m => { try { onData(m); } catch (e) { console.warn('net', e); } });
  conn.on('close', () => { if (NET.conn === conn) netLeave(NET.role === 'host' ? 'Your opponent left.' : 'The host left.'); });
  conn.on('error', () => { if (NET.conn === conn) netLeave('Connection lost.'); });
}
function onData(m) {
  if (!m || typeof m !== 'object') return;
  if (NET.role === 'host') {
    if (m.t === 'hello' && !NET.cfg) {
      const team = cleanTeam(m.team);
      if (m.v !== ONLINE.VERSION || !team.length) { NETSYNC.send({ t: 'deny', why: m.v !== ONLINE.VERSION ? 'Different game version.' : 'Empty team.' }); return; }
      hostStart({ name: cleanName(m.name), sprite: cleanSprite(m.sprite), team });
    } else if (m.t === 'ready') NET.guestReady = true;
    else if (m.t === 'in') NETSYNC.onInput(m);
    else if (m.t === 'pause' && B && !B.paused && !B.over) { B.paused = true; B.pausedBy = 1; }
    else if (m.t === 'resume' && B && B.paused && B.pausedBy === 1) B.paused = false;
    else if (m.t === 'pick' && B && B.choose && B.sides[B.choose.side].remote) { B.choose.sel = clamp(m.sel | 0, 0, 5); confirmChoose(); }
  } else if (NET.role === 'guest') {
    if (m.t === 'start') {
      const arena = ARENAS[m.ai | 0] || ARENAS[0], host = { name: cleanName(m.host?.name), sprite: cleanSprite(m.host?.sprite), team: cleanTeam(m.host?.team) };
      const mine = { name: cleanName(m.guest?.name), sprite: cleanSprite(m.guest?.sprite), team: cleanTeam(m.guest?.team) };
      if (!host.team.length || !mine.team.length) return netLeave('Bad match data.');
      NET.cfg = { arena, weather: '', music: arena.music, player: host, cpu: mine, me: 1, guest: true };
      setScene(LoadingScene(NET.cfg));
    } else if (m.t === 'snap') NETSYNC.apply(m.s);
    else if (m.t === 'rematch' && NET.cfg) { startBattle(NET.cfg); AUDIO.playMusic(NET.cfg.music); }
    else if (m.t === 'deny') netLeave(String(m.why || 'The host refused.').slice(0, 60));
  }
}

// ---------- host ----------
function hostStart(guest) {
  const arena = pick(ARENAS), h = me();
  NET.cfg = { arena, weather: '', music: arena.music, player: h, cpu: { ...guest, remote: true } };
  NET.guestReady = false;
  lobbyStop(true); // a full lobby leaves the list
  NETSYNC.send({ t: 'start', ai: ARENAS.indexOf(arena), host: h, guest });
  setScene(LoadingScene(NET.cfg));
}
async function hostGame(isPublic) {
  OnlineScene.msg = '';
  setScene(StatusScene('Connecting...', '', () => netLeave()));
  try {
    const Peer = await loadLib(ONLINE.PEER, 'Peer');
    for (let tries = 0; tries < 5; tries++) {
      const code = newCode();
      const ok = await new Promise(res => {
        const p = new Peer('pokearena-' + code, { debug: 0 });
        p.on('open', () => res(p)); p.on('error', e => { try { p.destroy(); } catch {} res(e.type === 'unavailable-id' ? null : Promise.reject(e)); });
      });
      if (!ok) continue;
      NET.peer = ok; NET.role = 'host'; NET.code = code; NET.cfg = null;
      ok.on('connection', conn => { if (NET.conn) { conn.on('open', () => conn.close()); return; } wireConn(conn); });
      ok.on('disconnected', () => { try { ok.reconnect(); } catch {} });
      ok.on('error', () => {});
      if (isPublic) lobbyStart(code);
      return setScene(WaitScene(code, isPublic));
    }
    throw new Error('No free code, try again.');
  } catch (e) { netLeave('Could not host: ' + (e.message || e.type || 'network error')); }
}

// ---------- guest ----------
async function joinGame(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { OnlineScene.msg = 'Codes are 5 letters/numbers.'; return; }
  OnlineScene.msg = '';
  let done = false;
  const fail = m => { if (!done) { done = true; netLeave(m); } };
  setScene(StatusScene('Joining ' + code + '...', 'Esc to cancel', () => fail('')));
  try {
    const Peer = await loadLib(ONLINE.PEER, 'Peer'), peer = new Peer({ debug: 0 });
    NET.peer = peer; NET.role = 'guest';
    const timer = setTimeout(() => fail('Could not connect (blocked network or no such lobby).'), 15000);
    peer.on('error', e => { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? 'No lobby with that code.' : 'Connection error: ' + e.type); });
    peer.on('open', () => {
      const conn = peer.connect('pokearena-' + code, { serialization: 'json', reliable: true });
      conn.on('open', () => { clearTimeout(timer); done = true; wireConn(conn); const m = me(); NETSYNC.send({ t: 'hello', v: ONLINE.VERSION, name: m.name, sprite: m.sprite, team: m.team }); setScene(StatusScene('Connected', 'Waiting for the host to start...', () => netLeave())); });
    });
  } catch (e) { fail('Could not join: ' + (e.message || 'network error')); }
}

// ---------- lobby list (MQTT retained messages) ----------
async function lobbyStart(code) {
  try {
    const mqtt = await loadLib(ONLINE.MQTT, 'mqtt'), topic = ONLINE.TOPIC + code, m = me();
    const c = mqtt.connect(ONLINE.BROKER, { reconnectPeriod: 4000, will: { topic, payload: '', retain: true, qos: 0 } });
    const pub = () => c.publish(topic, JSON.stringify({ code, name: m.name, lead: leadName(m.team, 0), n: m.team.length, v: ONLINE.VERSION, t: Date.now() }), { retain: true });
    c.on('connect', pub); c.on('error', () => {});
    NET.mq = c; NET.mqTopic = topic; NET.mqT = setInterval(pub, 30000);
  } catch { /* the code still works without the list */ }
}
function lobbyStop(clear) {
  if (NET.mqT) clearInterval(NET.mqT); NET.mqT = 0;
  if (NET.mq) { try { if (clear) NET.mq.publish(NET.mqTopic, '', { retain: true }); NET.mq.end(); } catch {} NET.mq = null; }
}

// ---------- scenes ----------
function StatusScene(title, sub, cancel) {
  return {
    update() { if (backHit()) cancel(); },
    draw() { bgFill(); const s = S(); text(title, VW / 2, VH * 0.4, 40 * s, '#ffde3b', 'center'); if (sub) text(sub, VW / 2, VH * 0.4 + 56 * s, 20 * s, '#fff', 'center'); hint('B / Esc cancel'); backButton(cancel); },
  };
}
function WaitScene(code, isPublic) {
  return {
    update() { if (backHit()) netLeave(); },
    draw() {
      bgFill(); const s = S();
      text('YOUR JOIN CODE', VW / 2, VH * 0.28, 24 * s, '#fff', 'center');
      text(code.split('').join(' '), VW / 2, VH * 0.42, 100 * s, '#ffde3b', 'center', '#1a2a6c');
      text(isPublic ? 'Listed in the lobby browser' : 'Private: only people with the code can join', VW / 2, VH * 0.56, 18 * s, '#9ab', 'center');
      text('Waiting for an opponent...' + '.'.repeat(Math.floor(performance.now() / 400) % 4), VW / 2, VH * 0.66, 24 * s, '#fff', 'center');
      const bw = 200 * s, bx = VW / 2 - bw / 2, by = VH * 0.74;
      rrect(bx, by, bw, 46 * s, 12 * s, '#ffffff22', '#fff', 2); text('COPY CODE', VW / 2, by + 23 * s, 18 * s, '#fff', 'center', null);
      hot(bx, by, bw, 46 * s, { click: () => { try { navigator.clipboard.writeText(code); } catch {} } });
      hint('B / Esc cancel'); backButton(() => netLeave());
    },
  };
}
const OnlineScene = {
  st: { sel: 0, team: 0, lead: 0 }, msg: '',
  enter() { AUDIO.playMusic(MUSIC.menu); const st = STORE.get('online', null); if (st) Object.assign(this.st, st, { sel: 0 }); },
  items() {
    const st = this.st, teams = savedTeams(); st.team = clamp(st.team, 0, teams.length - 1);
    return [
      { label: 'Host a public lobby', act: () => hostGame(true) },
      { label: 'Host a private lobby', act: () => hostGame(false) },
      { label: 'Join with a code', act: () => { const c = window.prompt('Join code (5 letters/numbers)'); if (c) joinGame(c); } },
      { label: 'Lobby browser', act: () => setScene(BrowseScene()) },
      { label: 'Your team', value: teams[st.team].name, cycle: d => { st.team = (st.team + d + teams.length) % teams.length; STORE.set('online', st); } },
      { label: 'Lead Pokemon', value: leadName(teams[st.team].mons, st.lead), cycle: d => { const n = teams[st.team].mons.length; st.lead = (clamp(st.lead, 0, n - 1) + d + n) % n; STORE.set('online', st); } },
      { label: 'Back', act: () => setScene(MenuScene) },
    ];
  },
  update(dt) { runMenu(this.st, this.items(), dt); if (backHit()) setScene(MenuScene); },
  draw() {
    bgFill(); const s = S(); text('ONLINE', VW / 2, 80 * s, 52 * s, '#ffde3b', 'center', '#1a2a6c');
    drawMenu(this.items(), this.st, VW / 2, 140 * s, 560 * s, 60);
    if (this.msg) text(this.msg, VW / 2, VH - 70 * s, 18 * s, '#ff9a9a', 'center');
    hint('Share the 5 character code with a friend, or pick a public lobby'); backButton(() => setScene(MenuScene));
  },
};
function BrowseScene() {
  const lobbies = new Map(), st = { sel: 0 };
  let client = null, status = 'Connecting to the lobby list...';
  loadLib(ONLINE.MQTT, 'mqtt').then(mqtt => {
    client = mqtt.connect(ONLINE.BROKER, { reconnectPeriod: 4000 });
    client.on('connect', () => { status = 'Searching...'; client.subscribe(ONLINE.TOPIC + '+'); });
    client.on('error', () => { status = 'Lobby list unreachable. Join with a code instead.'; });
    client.on('message', (topic, buf) => {
      const code = topic.slice(ONLINE.TOPIC.length);
      if (!buf.length) return void lobbies.delete(code);
      try { const l = JSON.parse(buf.toString()); if (l && l.v === ONLINE.VERSION && /^[A-Z0-9]{5}$/.test(code)) lobbies.set(code, { code, name: cleanName(l.name), lead: String(l.lead || '').slice(0, 24), n: l.n | 0, t: +l.t || 0 }); } catch {}
    });
  }).catch(() => { status = 'Lobby list unreachable. Join with a code instead.'; });
  const stop = () => { try { client && client.end(); } catch {} };
  const items = () => [...[...lobbies.values()].filter(l => Date.now() - l.t < 120000).map(l => ({ label: `${l.name}  (leads ${l.lead}, ${l.n} mons)`, value: l.code, act: () => { stop(); joinGame(l.code); } })), { label: 'Back', act: () => { stop(); setScene(OnlineScene); } }];
  return {
    update(dt) { const it = items(); st.sel = clamp(st.sel, 0, it.length - 1); runMenu(st, it, dt); if (backHit()) { stop(); setScene(OnlineScene); } },
    draw() {
      bgFill(); const s = S(), it = items(); text('LOBBIES', VW / 2, 70 * s, 48 * s, '#ffde3b', 'center', '#1a2a6c');
      drawMenu(it, st, VW / 2, 130 * s, 760 * s, 58);
      if (it.length === 1) text(status === 'Searching...' ? 'No open lobbies right now. Host one!' : status, VW / 2, 130 * s + 90 * s, 18 * s, '#9ab', 'center');
      hint('Click a lobby to join'); backButton(() => { stop(); setScene(OnlineScene); });
    },
  };
}

// ---------- the match itself (called from BattleScene while NET.role is set) ----------
// Pausing is the host's B.paused, so it stops the sim (and the clock) for both players. Choosing a replacement and the mega cinematic
// already stop the sim through B.choose / B.hitstop, so the guest sees the same freeze.
const netPause = () => { if (NET.role === 'host') { B.paused = true; B.pausedBy = 0; } else NETSYNC.send({ t: 'pause' }); };
const netResume = () => { if (NET.role === 'host') B.paused = false; else NETSYNC.send({ t: 'resume' }); };
function onlineBattleUpdate(sc, dt) {
  const guest = NET.role === 'guest', mi = meIdx();
  if (sc.guard > 0) sc.guard -= dt;
  if (INPUT.hit('START') && !B.over && !(sc.guard > 0)) { sc.guard = 0.5; if (!B.paused) netPause(); else if (B.pausedBy === mi) netResume(); }
  if (B.paused) {
    const items = sc.pauseItems(); sc.pause.sel = clamp(sc.pause.sel, 0, items.length - 1); runMenu(sc.pause, items, dt);
    if (backHit() && B.pausedBy === mi && !(sc.guard > 0)) { sc.guard = 0.5; netResume(); }
  }
  if (guest) {
    NETSYNC.step(dt);
    NETSYNC.send({ t: 'in', ...NETSYNC.input(dt) });
  } else {
    if (!NET.guestReady) return;
    if (B.paused) NETSYNC.clearInput();
    updateBattle(dt); NETSYNC.harvest();
    if ((sc.snapT = (sc.snapT || 0) + dt) >= 0.05) { sc.snapT = 0; NETSYNC.send({ t: 'snap', s: NETSYNC.snap() }); }
  }
  if (B.paused) return;
  if (B.choose && B.choose.side === mi) {
    const c = B.choose, side = B.sides[c.side], n = side.team.length;
    if (INPUT.menu === 'right' || INPUT.menu === 'down') { do c.sel = (c.sel + 1) % n; while (side.team[c.sel].fainted); uiBlip(600, 0.03); }
    if (INPUT.menu === 'left' || INPUT.menu === 'up') { do c.sel = (c.sel + n - 1) % n; while (side.team[c.sel].fainted); uiBlip(600, 0.03); }
    if (okHit()) confirmChoose();
  }
  if (B.over && B.endT > 1.5) {
    if (!guest && okHit()) onlineRematch();
    else if (backHit()) netLeave('');
  }
}
function onlineRematch() { startBattle(NET.cfg); NETSYNC.begin(); NETSYNC.send({ t: 'rematch' }); AUDIO.playMusic(NET.cfg.music); }
