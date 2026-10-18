// Online play. Matches run peer to peer over WebRTC (PeerJS cloud brokers the handshake; the join code is the peer id).
// The lobby browser is a retained-message topic on a public MQTT broker. No accounts, no servers of ours. See docs/ONLINE.md.
// Two data channels per match: 'ctl' (reliable, ordered) for presses, team data, effects and match flow; 'fast' (unordered)
// for snapshots and analog input, so one lost packet never holds up the newer ones behind it.
const ONLINE = {
  PEER: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', MQTT: 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
  BROKER: 'wss://broker.emqx.io:8084/mqtt', TOPIC: 'pokearena/v1/lobby/', CHARS: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', VERSION: 3, // 3: diffed snapshots, object messages (see netsync.js)
  MAX_MSG: 15000, // PeerJS JSON channels refuse messages of 16300 bytes or more; only reliable-channel messages can hit this, snapshots are built to fit
};
const libs = {};
const loadLib = (url, name) => libs[url] ||= new Promise((ok, no) => {
  if (window[name]) return ok(window[name]);
  const s = document.createElement('script'); s.src = url; s.onload = () => ok(window[name]); s.onerror = () => { delete libs[url]; no(new Error('Could not load ' + name)); };
  document.head.appendChild(s);
});

// ---------- transport ----------
let partId = 0;
const parts = new Map();
function rawSend(conn, m) {
  if (!conn || !conn.open) return false;
  const str = JSON.stringify(m);
  try {
    if (str.length <= ONLINE.MAX_MSG) { conn.send(m); return true; }
    // too big for one JSON message: split it over the reliable channel and stitch it back together on arrival
    const id = ++partId, n = Math.ceil(str.length / 12000), ctl = NET.conn && NET.conn.open ? NET.conn : conn;
    for (let i = 0; i < n; i++) ctl.send({ t: 'part', id, i, n, d: str.slice(i * 12000, (i + 1) * 12000) });
    return true;
  } catch { return false; }
}
NETSYNC.send = m => rawSend(NET.conn, m);
// snapshots and input are small objects by construction: no size check, no splitting; without the fast channel they fall back to the reliable one
NETSYNC.sendFast = m => { if (!(NET.fast && NET.fast.open)) return rawSend(NET.conn, m); try { NET.fast.send(m); return true; } catch { return false; } };
// bytes still queued in the browser for a channel; the sender skips a snapshot instead of queueing it behind a backlog
const backlogOf = c => (c && c.open && c.dataChannel ? c.dataChannel.bufferedAmount : 0);
NETSYNC.backlog = () => backlogOf(NET.fast && NET.fast.open ? NET.fast : NET.conn);
NETSYNC.ctlBacklog = () => backlogOf(NET.conn);

// ---------- what a peer may tell us: everything is re-validated, nothing is trusted as code or a URL ----------
const cleanTeam = t => (Array.isArray(t) ? t : []).slice(0, 6).map(s => ({
  species: String(s?.species || '').slice(0, 40), level: clamp(+s?.level || 50, 1, 100), moves: (Array.isArray(s?.moves) ? s.moves : []).slice(0, 4).map(m => String(m).slice(0, 40)),
  ability: String(s?.ability || '').slice(0, 40), item: String(s?.item || '').slice(0, 40), nature: String(s?.nature || 'Hardy').slice(0, 20),
})).filter(s => DEX.species[toId(s.species)]);
const cleanName = n => String(n || 'Player').replace(/[^\w .'-]/g, '').slice(0, 16) || 'Player';
// a peer's avatar id is only ever looked up in our own list; an old client sends none, so its old sprite field is used
const cleanPeer = (p, team) => { const avatar = cleanAvatar(p?.avatar); return { name: cleanName(p?.name), avatar, sprite: avatar ? avatarSprite(avatar) : cleanSprite(p?.sprite), team }; };
const cleanSprite = p => ((window.PLAYER_SPRITES || []).find(x => x.sprite === p) || (window.PLAYER_SPRITES || [])[0] || {}).sprite || '';
const me = () => {
  const st = OnlineScene.st, teams = savedTeams(), t = teams[clamp(st.team, 0, teams.length - 1)];
  const avatar = profileAvatar();
  return { name: cleanName(profileName()), sprite: avatarSprite(avatar), avatar, team: cleanTeam(leadFirst(t.mons, st.lead)) };
};
const newCode = () => Array.from({ length: 5 }, () => ONLINE.CHARS[Math.random() * ONLINE.CHARS.length | 0]).join('');
const joinLink = code => location.origin + location.pathname + '?join=' + code;

// ---------- connection lifecycle ----------
function netLeave(msg = '') {
  NETSYNC.end();
  for (const k of ['conn', 'fast', 'peer']) { try { NET[k] && (k === 'peer' ? NET[k].destroy() : NET[k].close()); } catch {} NET[k] = null; }
  lobbyStop(true);
  NET.role = ''; NET.cfg = null; NET.guestReady = false; NET.peerLoad = 0; OnlineScene.msg = msg;
  B = null;
  setScene(OnlineScene);
}
function wireConn(conn, fast) {
  if (fast) NET.fast = conn; else NET.conn = conn;
  conn.on('data', m => { try { onData(m); } catch (e) { console.warn('net', e); } });
  if (fast) { conn.on('close', () => { if (NET.fast === conn) NET.fast = null; }); conn.on('error', () => {}); return; } // the reliable channel carries on alone
  conn.on('close', () => { if (NET.conn === conn) netLeave(NET.role === 'host' ? 'Your opponent left.' : 'The host left.'); });
  conn.on('error', e => { if (NET.conn === conn && e?.type !== 'message-too-big') netLeave('Connection lost.'); });
}
function onData(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'part') { // stitch split messages back together
    const p = parts.get(m.id) || { n: m.n | 0, got: 0, d: [] }; if (p.n > 64) return;
    if (p.d[m.i] === undefined) { p.d[m.i] = String(m.d); p.got++; } parts.set(m.id, p);
    if (p.got === p.n) { parts.delete(m.id); try { onData(JSON.parse(p.d.join(''))); } catch {} }
    if (parts.size > 20) parts.delete(parts.keys().next().value);
    return;
  }
  if (m.t === 'load') { NET.peerLoad = clamp(+m.p || 0, 0, 1); return; }
  if (NET.role === 'host') {
    if (m.t === 'hello' && !NET.cfg) {
      const team = cleanTeam(m.team);
      if (m.v !== ONLINE.VERSION || !team.length) { NETSYNC.send({ t: 'deny', why: m.v !== ONLINE.VERSION ? 'You are on a different game version. Refresh the page.' : 'Empty team.' }); return; }
      hostStart(cleanPeer(m, team));
    } else if (m.t === 'ready') NET.guestReady = true;
    else if (m.t === 'in') NETSYNC.onInput(m);
    else if (m.t === 'act') NETSYNC.onPress(m);
    else if (m.t === 'pause' && B && !B.paused && !B.over) { B.paused = true; B.pausedBy = 1; }
    else if (m.t === 'resume' && B && B.paused && B.pausedBy === 1) B.paused = false;
    else if (m.t === 'pick' && B && B.choose && B.sides[B.choose.side].remote) { B.choose.sel = clamp(m.sel | 0, 0, 5); confirmChoose(); }
  } else if (NET.role === 'guest') {
    if (m.t === 'start') {
      const arena = ARENAS[m.ai | 0] || ARENAS[0], host = cleanPeer(m.host, cleanTeam(m.host?.team));
      const mine = cleanPeer(m.guest, cleanTeam(m.guest?.team));
      if (!host.team.length || !mine.team.length) return netLeave('Bad match data.');
      NETSYNC.reset();
      NET.cfg = { arena, weather: '', music: arena.music, player: host, cpu: mine, me: 1, guest: true };
      setScene(LoadingScene(NET.cfg));
    } else if (m.t === 's') NETSYNC.apply(m);
    else if (m.t === 'teams') NETSYNC.applyTeams(m);
    else if (m.t === 'fx') NETSYNC.applyFx(m);
    else if (m.t === 'rematch' && NET.cfg) { NETSYNC.rematch(); startBattleA(NET.cfg); AUDIO.playMusic(NET.cfg.music); }
    else if (m.t === 'deny') netLeave(String(m.why || 'The host refused.').slice(0, 80));
  }
}

// ---------- host ----------
function hostStart(guest) {
  const arena = pick(ARENAS), h = me();
  NET.cfg = { arena, weather: '', music: arena.music, player: h, cpu: { ...guest, remote: true } };
  NET.guestReady = false; NET.peerLoad = 0; NET.guestName = guest.name; NET.waitT = 0;
  NETSYNC.lastIn = 0; NETSYNC.ack = 0;
  lobbyStop(true); // a full lobby leaves the list
  NETSYNC.send({ t: 'start', ai: ARENAS.indexOf(arena), host: h, guest });
  setScene(LoadingScene(NET.cfg));
}
async function hostGame(isPublic) {
  OnlineScene.msg = '';
  setScene(StatusScene('Opening a lobby', 'Getting a join code...', () => netLeave(), true));
  try {
    const Peer = await loadLib(ONLINE.PEER, 'Peer');
    for (let tries = 0; tries < 5; tries++) {
      const code = newCode();
      const ok = await new Promise((res, rej) => {
        const p = new Peer('pokearena-' + code, { debug: 0 });
        p.on('open', () => res(p)); p.on('error', e => { try { p.destroy(); } catch {} if (e.type === 'unavailable-id') res(null); else rej(e); });
      });
      if (!ok) continue;
      if (SCENE && SCENE.cancelled) { try { ok.destroy(); } catch {} return; }
      NET.peer = ok; NET.role = 'host'; NET.code = code; NET.cfg = null; NET.conn = NET.fast = null;
      ok.on('connection', conn => {
        const fast = conn.label === 'fast';
        const busy = fast ? NET.fast || (NET.conn && NET.conn.peer !== conn.peer) : NET.conn || (NET.fast && NET.fast.peer !== conn.peer);
        if (busy) { conn.on('open', () => conn.close()); return; }
        wireConn(conn, fast);
      });
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
  setScene(StatusScene('Joining ' + code, 'Connecting to the host...', () => fail(''), true));
  try {
    const Peer = await loadLib(ONLINE.PEER, 'Peer'), peer = new Peer({ debug: 0 });
    NET.peer = peer; NET.role = 'guest'; NET.conn = NET.fast = null;
    const timer = setTimeout(() => fail('Could not connect. The code may be wrong, or a network is blocking peer-to-peer.'), 15000);
    peer.on('error', e => { clearTimeout(timer); fail(e.type === 'peer-unavailable' ? 'No lobby with that code.' : 'Connection error: ' + e.type); });
    peer.on('open', () => {
      const id = 'pokearena-' + code;
      const ctl = peer.connect(id, { serialization: 'json', reliable: true, label: 'ctl' });
      const fast = peer.connect(id, { serialization: 'json', reliable: false, label: 'fast' });
      fast.on('open', () => wireConn(fast, true));
      ctl.on('open', () => {
        clearTimeout(timer); done = true; wireConn(ctl, false);
        const m = me(); NETSYNC.send({ t: 'hello', v: ONLINE.VERSION, name: m.name, sprite: m.sprite, avatar: m.avatar, team: m.team });
        setScene(StatusScene('Connected', 'The host is starting the match...', () => netLeave(), true));
      });
    });
  } catch (e) { fail('Could not join: ' + (e.message || 'network error')); }
}

// ---------- lobby list (MQTT retained messages) ----------
async function lobbyStart(code) {
  try {
    const mqtt = await loadLib(ONLINE.MQTT, 'mqtt'), topic = ONLINE.TOPIC + code, m = me();
    const c = mqtt.connect(ONLINE.BROKER, { reconnectPeriod: 4000, will: { topic, payload: '', retain: true, qos: 0 } });
    const pub = () => c.publish(topic, JSON.stringify({ code, name: m.name, av: m.avatar, lead: leadName(m.team, 0), lid: toId(m.team[0]?.species || ''), n: m.team.length, v: ONLINE.VERSION, t: Date.now() }), { retain: true });
    c.on('connect', pub); c.on('error', () => {});
    NET.mq = c; NET.mqTopic = topic; NET.mqT = setInterval(pub, 30000);
  } catch { /* the code still works without the list */ }
}
function lobbyStop(clear) {
  if (NET.mqT) clearInterval(NET.mqT); NET.mqT = 0;
  if (NET.mq) { try { if (clear) NET.mq.publish(NET.mqTopic, '', { retain: true }); NET.mq.end(); } catch {} NET.mq = null; }
}

// ---------- widget kit: buttons register while drawing; mouse hovers/clicks them, pad/keys move focus between them spatially ----------
function uiBtn(sc, id, x, y, w, h, o, act) {
  const s = S(), dis = !!o.disabled, foc = sc.focus === id && !dis;
  sc.reg.push({ id, x, y, w, h, act, dis });
  if (!dis) hot(x, y, w, h, { hover: () => { sc.focus = id; }, click: () => { uiBlip(880, 0.05); act(); }, wheel: o.wheel });
  const sel = !!o.selected, accent = o.color || '#ffde3b';
  const fill = dis ? '#ffffff08' : sel ? accent : foc ? '#ffffff2e' : (o.fill || '#ffffff12');
  rrect(x, y, w, h, o.r ?? Math.min(12 * s, h / 3), fill, foc ? '#ffffff' : sel ? '#ffffffcc' : '#ffffff38', foc ? 3 : 2);
  if (foc && !sel) { ctx.globalAlpha = 0.18 + 0.1 * Math.sin(performance.now() / 160); rrect(x, y, w, h, o.r ?? Math.min(12 * s, h / 3), accent); ctx.globalAlpha = 1; }
  const tc = dis ? '#ffffff55' : sel ? '#16161e' : '#fff';
  if (o.draw) o.draw(x, y, w, h, tc, sel, foc);
  else if (o.label) {
    text(o.label, x + w / 2, y + h / 2 + (o.sub ? -10 * s : 1), o.size || 20 * s, tc, 'center', null);
    if (o.sub) text(o.sub, x + w / 2, y + h / 2 + 15 * s, 12 * s, sel ? '#333' : '#aab4c8', 'center', null, 'Silkscreen');
  }
}
function uiNav(sc) {
  const reg = (sc.reg || []).filter(w => !w.dis); if (!reg.length) return;
  const cur = reg.find(w => w.id === sc.focus), dir = INPUT.menu;
  if (!cur) { if (dir || okHit()) sc.focus = reg[0].id; return; }
  if (dir) {
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2; let best = null, bs = Infinity;
    for (const w of reg) {
      if (w === cur) continue;
      const dx = w.x + w.w / 2 - cx, dy = w.y + w.h / 2 - cy;
      const [main, side] = dir === 'left' ? [-dx, dy] : dir === 'right' ? [dx, dy] : dir === 'up' ? [-dy, dx] : [dy, dx];
      if (main <= 4) continue;
      const score = main + Math.abs(side) * 2.2; if (score < bs) { bs = score; best = w; }
    }
    if (best) { sc.focus = best.id; uiBlip(600, 0.03); }
  }
  if (okHit()) { uiBlip(880, 0.05); cur.act(); }
}
function panel(x, y, w, h, title, right) {
  const s = S();
  rrect(x, y, w, h, 16 * s, '#0b1020cc', '#ffffff26', 2);
  if (title) text(title, x + 20 * s, y + 24 * s, 15 * s, '#ffde3b', 'left', null);
  if (right) text(right, x + w - 20 * s, y + 24 * s, 12 * s, '#9aa6c0', 'right', null, 'Silkscreen');
}
// a mon's portrait, square, pixel-crisp; falls back to a dark tile while it loads
function portraitTile(id, x, y, sz, ring) {
  const im = portrait(id);
  rrect(x, y, sz, sz, Math.max(4, sz / 8), '#00000066', ring || null, ring ? 2 : 0);
  if (im) ctx.drawImage(im, x + 2, y + 2, sz - 4, sz - 4);
}
// two trainers side by side with a VS between; a missing one shows a question mark
function vsCards(cx, cy, size, a, b) {
  const gap = size * 1.2;
  [[a, cx - gap / 2 - size, '#7be07b'], [b, cx + gap / 2, '#7fd0e8']].forEach(([p, x, col]) => {
    if (p) avatarTile(p.avatar || AVATAR_DEFAULT, x, cy, size, col);
    else { rrect(x, cy, size, size, Math.max(4, size / 8), '#00000066', '#ffffff55', 2); text('?', x + size / 2, cy + size / 2 + 2, size * 0.5, '#ffffff77', 'center', null); }
    const nm = p ? String(p.name).toUpperCase() : 'WAITING'; text(nm.length > 12 ? nm.slice(0, 11) + '.' : nm, x + size / 2, cy + size + size * 0.2, Math.max(9, size * 0.15), p ? '#fff' : '#9aa6c0', 'center', null);
  });
  text('VS', cx, cy + size / 2, size * 0.32, '#ffde3b', 'center', '#1a2a6c');
}
// design space is 1320 x 800, scaled to fit and centred
function layout() { const s = Math.min(VW / 1360, VH / 840), ox = (VW - 1320 * s) / 2, oy = Math.max(0, (VH - 800 * s) / 2); return { s, X: v => ox + v * s, Y: v => oy + v * s, L: v => v * s }; }

// ---------- scenes ----------
function spinner(cx, cy, r) { const t = performance.now() / 1000; for (let i = 0; i < 8; i++) { ctx.globalAlpha = 0.15 + 0.85 * (((i - t * 10) % 8 + 8) % 8) / 8; rrect(cx + Math.cos(i / 8 * 6.283) * r - 4, cy + Math.sin(i / 8 * 6.283) * r - 4, 8, 8, 2, '#ffde3b'); } ctx.globalAlpha = 1; }
function StatusScene(title, sub, cancel, showMe) {
  const sc = { reg: [], focus: 'cancel' };
  return Object.assign(sc, {
    update() { uiNav(sc); if (backHit()) { sc.cancelled = true; cancel(); } },
    draw() {
      bgFill('#101830', '#2c1838'); sc.reg = [];
      const { X, Y, L } = layout();
      panel(X(360), Y(220), L(600), L(340));
      if (showMe) vsCards(X(660), Y(236), L(84), me(), null); else spinner(X(660), Y(320), L(26));
      text(title.toUpperCase(), X(660), Y(400), L(34), '#fff', 'center', null);
      if (sub) text(sub, X(660), Y(445), L(16), '#aab4c8', 'center', null);
      uiBtn(sc, 'cancel', X(560), Y(485), L(200), L(52), { label: 'CANCEL', size: L(18) }, () => { sc.cancelled = true; cancel(); });
    },
  });
}
function WaitScene(code, isPublic) {
  const sc = { reg: [], focus: 'copy', copied: 0 };
  const copy = (t, what) => { try { navigator.clipboard.writeText(t); sc.copied = performance.now(); sc.what = what; } catch {} };
  return Object.assign(sc, {
    update() { uiNav(sc); if (backHit()) netLeave(); },
    draw() {
      bgFill('#101830', '#2c1838'); sc.reg = [];
      const { X, Y, L } = layout(), m = me();
      text('LOBBY OPEN', X(660), Y(70), L(44), '#ffde3b', 'center', '#1a2a6c');
      panel(X(260), Y(120), L(800), L(560), 'SHARE THIS CODE', isPublic ? 'PUBLIC: ALSO IN THE LOBBY LIST' : 'PRIVATE: CODE ONLY');
      code.split('').forEach((ch, i) => { const bx = X(660 - 2.5 * 120 + i * 120 + 8); rrect(bx, Y(175), L(104), L(130), L(14), '#ffffff10', '#ffde3b', 3); text(ch, bx + L(52), Y(244), L(84), '#fff', 'center', '#1a2a6c'); });
      const recent = performance.now() - sc.copied < 1500;
      uiBtn(sc, 'copy', X(400), Y(330), L(250), L(56), { label: recent && sc.what === 'code' ? 'COPIED!' : 'COPY CODE', size: L(18) }, () => copy(code, 'code'));
      uiBtn(sc, 'link', X(670), Y(330), L(250), L(56), { label: recent && sc.what === 'link' ? 'COPIED!' : 'COPY INVITE LINK', size: L(18) }, () => copy(joinLink(code), 'link'));
      text('A friend can open the invite link, or pick JOIN WITH A CODE.', X(660), Y(415), L(15), '#aab4c8', 'center', null);
      spinner(X(320), Y(480), L(16));
      text('Waiting for an opponent' + '.'.repeat(Math.floor(performance.now() / 400) % 4), X(350), Y(480), L(22), '#fff', 'left', null);
      vsCards(X(900), Y(440), L(62), m, null);
      text('YOUR TEAM', X(300), Y(560), L(13), '#9aa6c0', 'left', null);
      m.team.forEach((t, i) => portraitTile(toId(t.species), X(300 + i * 76), Y(578), L(66), i === 0 ? '#ffde3b' : '#ffffff40'));
      uiBtn(sc, 'cancel', X(810), Y(590), L(220), L(56), { label: 'CLOSE LOBBY', size: L(18) }, () => netLeave());
    },
  });
}
const OnlineScene = {
  st: { team: 0, lead: 0 }, msg: '', reg: [], focus: null, tOff: 0, lOff: 0, code: '', typing: false,
  enter() {
    AUDIO.playMusic(MUSIC.menu);
    const st = STORE.get('online', null); if (st) Object.assign(this.st, { team: st.team | 0, lead: st.lead | 0 });
    this.code = ''; this.typing = false; this.lobbies = new Map(); this.lstatus = 'Connecting to the lobby list...';
    this.keyFn = e => this.onKey(e); this.pasteFn = e => this.onPaste(e);
    window.addEventListener('keydown', this.keyFn); window.addEventListener('paste', this.pasteFn);
    this.watch();
  },
  exit() { window.removeEventListener('keydown', this.keyFn); window.removeEventListener('paste', this.pasteFn); this.unwatch(); this.typing = false; },
  save() { STORE.set('online', this.st); },
  onKey(e) {
    if (!this.typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { if (this.code.length === 5) joinGame(this.code); }
    else if (e.key === 'Escape') { this.typing = false; this.ate = true; }
    else if (e.key === 'Backspace') this.code = this.code.slice(0, -1);
    else if (/^[a-z0-9]$/i.test(e.key) && this.code.length < 5) this.code += e.key.toUpperCase();
    else return;
    e.preventDefault();
  },
  onPaste(e) { const t = (e.clipboardData?.getData('text') || '').toUpperCase().replace(/.*JOIN=/, '').replace(/[^A-Z0-9]/g, '').slice(0, 5); if (t) { this.code = t; this.typing = true; } },
  editCode() { if (INPUT.usingPad) { const c = window.prompt('Join code (5 letters/numbers)', this.code); if (c) { this.code = c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); if (this.code.length === 5) joinGame(this.code); } } else { this.typing = true; if (window.TOUCH?.on) TOUCH.kbd(); }  },
  watch() {
    const L = this.lobbies;
    loadLib(ONLINE.MQTT, 'mqtt').then(mqtt => {
      if (SCENE !== this) return;
      const c = this.client = mqtt.connect(ONLINE.BROKER, { reconnectPeriod: 4000 });
      c.on('connect', () => { this.lstatus = ''; c.subscribe(ONLINE.TOPIC + '+'); });
      c.on('error', () => { this.lstatus = 'Lobby list unreachable right now. Codes still work.'; });
      c.on('message', (topic, buf) => {
        const code = topic.slice(ONLINE.TOPIC.length);
        if (!buf.length) return void L.delete(code);
        try {
          const l = JSON.parse(buf.toString());
          if (l && l.v === ONLINE.VERSION && /^[A-Z0-9]{5}$/.test(code)) L.set(code, { code, name: cleanName(l.name), av: cleanAvatar(l.av) || AVATAR_DEFAULT, lead: String(l.lead || '').slice(0, 24), lid: DEX.species[toId(l.lid || '')] ? toId(l.lid) : '', n: clamp(l.n | 0, 1, 6), t: +l.t || 0 });
        } catch {}
      });
    }).catch(() => { this.lstatus = 'Lobby list unreachable right now. Codes still work.'; });
  },
  unwatch() { try { this.client && this.client.end(); } catch {} this.client = null; },
  update(dt) {
    if (this.typing) { if (backHit() && !this.ate) this.typing = false; this.ate = false; return; }
    this.ate = false;
    uiNav(this);
    if (backHit()) setScene(MenuScene);
  },
  draw() {
    bgFill('#101830', '#2c1838'); this.reg = [];
    const { X, Y, L } = layout(), st = this.st, teams = savedTeams(); st.team = clamp(st.team, 0, teams.length - 1);
    const team = teams[st.team]; st.lead = clamp(st.lead, 0, team.mons.length - 1);
    text('PLAY ONLINE', X(660), Y(50), L(44), '#ffde3b', 'center', '#1a2a6c');
    backButton(() => setScene(MenuScene));
    profileChip(X(1010), Y(14), L(310), L(56), OnlineScene);

    // ----- left: team + lead -----
    panel(X(0), Y(96), L(440), L(660), 'YOUR TEAM', teams.length > 4 ? `${st.team + 1} / ${teams.length}` : '');
    const vis = 4; this.tOff = clamp(this.tOff, 0, Math.max(0, teams.length - vis));
    if (st.team < this.tOff) this.tOff = st.team; if (st.team >= this.tOff + vis) this.tOff = st.team - vis + 1;
    const wheel = d => { this.tOff = clamp(this.tOff + d, 0, Math.max(0, teams.length - vis)); };
    for (let i = this.tOff; i < Math.min(teams.length, this.tOff + vis); i++) {
      const t = teams[i], y = Y(140 + (i - this.tOff) * 96);
      uiBtn(this, 'team' + i, X(20), y, L(400), L(86), { selected: i === st.team, wheel, draw: (x, y2, w, h, tc, sel) => {
        text(t.name.length > 22 ? t.name.slice(0, 21) + '.' : t.name, x + L(16), y2 + L(20), L(17), tc, 'left', null);
        avatarTile(profileAvatar(), x + w - L(40), y2 + L(6), L(28));
        t.mons.slice(0, 6).forEach((mn, k) => portraitTile(toId(mn.species), x + L(14 + k * 62), y2 + L(36), L(44), sel ? '#16161e55' : null));
      } }, () => { st.team = i; st.lead = 0; this.save(); });
    }
    if (teams.length > vis) {
      uiBtn(this, 'tup', X(300), Y(104), L(56), L(30), { label: '^', size: L(16), disabled: this.tOff === 0 }, () => wheel(-1));
      uiBtn(this, 'tdn', X(362), Y(104), L(56), L(30), { label: 'v', size: L(16), disabled: this.tOff >= teams.length - vis }, () => wheel(1));
    }
    uiBtn(this, 'edit', X(20), Y(530), L(400), L(46), { label: 'EDIT TEAMS', size: L(16) }, () => setScene(TeamsScene));
    text('GOES OUT FIRST', X(20), Y(605), L(14), '#ffde3b', 'left', null);
    team.mons.slice(0, 6).forEach((mn, k) => {
      const id = toId(mn.species);
      uiBtn(this, 'lead' + k, X(20 + k * 68), Y(622), L(62), L(62), { selected: k === st.lead, draw: (x, y2, w, h) => portraitTile(id, x + L(5), y2 + L(5), w - L(10)) }, () => { st.lead = k; this.save(); });
    });
    const lm = team.mons[st.lead]; if (lm) text(`${DEX.species[toId(lm.species)]?.name || lm.species}  Lv ${lm.level || 50}`, X(20), Y(712), L(18), '#fff', 'left', null);
    text(`${team.mons.length} Pokemon`, X(420), Y(712), L(13), '#9aa6c0', 'right', null, 'Silkscreen');

    // ----- right top: host -----
    panel(X(470), Y(96), L(850), L(150), 'HOST A MATCH');
    uiBtn(this, 'hostpub', X(490), Y(136), L(400), L(92), { label: 'PUBLIC LOBBY', sub: 'Anyone can join from the list below', size: L(22) }, () => hostGame(true));
    uiBtn(this, 'hostpriv', X(900), Y(136), L(400), L(92), { label: 'PRIVATE MATCH', sub: 'Only friends with your code', size: L(22) }, () => hostGame(false));

    // ----- right middle: join by code -----
    panel(X(470), Y(262), L(850), L(130), 'JOIN WITH A CODE', this.typing ? 'TYPE OR PASTE  -  ENTER TO JOIN' : 'CLICK THE BOXES, THEN TYPE OR PASTE');
    uiBtn(this, 'code', X(490), Y(300), L(5 * 74 + 10), L(76), { r: L(12), fill: this.typing ? '#ffffff22' : undefined, draw: (x, y2) => {
      for (let i = 0; i < 5; i++) {
        const bx = x + L(10 + i * 74), cur = this.typing && i === this.code.length && Math.floor(performance.now() / 450) % 2;
        rrect(bx, y2 + L(8), L(62), L(60), L(10), '#00000055', i < this.code.length ? '#ffde3b' : '#ffffff33', 2);
        if (this.code[i]) text(this.code[i], bx + L(31), y2 + L(39), L(36), '#fff', 'center', null);
        else if (cur) rrect(bx + L(18), y2 + L(54), L(26), L(4), 1, '#ffde3b');
      }
    } }, () => this.editCode());
    uiBtn(this, 'join', X(900), Y(300), L(200), L(76), { label: 'JOIN', size: L(24), disabled: this.code.length !== 5, color: '#5ad25a', selected: this.code.length === 5 }, () => joinGame(this.code));
    uiBtn(this, 'paste', X(1110), Y(300), L(190), L(76), { label: 'PASTE', size: L(18) }, async () => {
      try { const t = (await navigator.clipboard.readText()).toUpperCase().replace(/.*JOIN=/, '').replace(/[^A-Z0-9]/g, '').slice(0, 5); if (t) { this.code = t; this.typing = true; } } catch { this.typing = true; }
    });

    // ----- right bottom: lobby browser -----
    const open = [...this.lobbies.values()].filter(l => Date.now() - l.t < 120000).sort((a, b) => b.t - a.t);
    panel(X(470), Y(408), L(850), L(348), 'OPEN LOBBIES', this.lstatus ? '' : `${open.length} OPEN`);
    const rows = 4; this.lOff = clamp(this.lOff, 0, Math.max(0, open.length - rows));
    const lwheel = d => { this.lOff = clamp(this.lOff + d, 0, Math.max(0, open.length - rows)); };
    if (!open.length) {
      if (this.lstatus.startsWith('Connecting')) spinner(X(895), Y(560), L(18));
      text(this.lstatus || 'No open lobbies right now. Host one and share the code!', X(895), Y(this.lstatus.startsWith('Connecting') ? 610 : 590), L(16), '#aab4c8', 'center', null);
    }
    open.slice(this.lOff, this.lOff + rows).forEach((l, k) => {
      const y = Y(448 + k * 78);
      rrect(X(490), y, L(810), L(68), L(12), '#ffffff0c', '#ffffff22', 2);
      avatarTile(l.av, X(500), y + L(6), L(56), '#ffffff66');
      if (l.lid) portraitTile(l.lid, X(566), y + L(6), L(56), '#ffffff40');
      text(l.name, X(638), y + L(24), L(20), '#fff', 'left', null);
      text(`${l.lead ? 'leads with ' + l.lead + '  -  ' : ''}${l.n} Pokemon`, X(638), y + L(48), L(12), '#9aa6c0', 'left', null, 'Silkscreen');
      text(l.code, X(1060), y + L(35), L(18), '#ffde3b', 'right', null);
      uiBtn(this, 'lob' + l.code, X(1080), y + L(10), L(206), L(48), { label: 'JOIN', size: L(20), color: '#5ad25a', wheel: lwheel }, () => { this.unwatch(); joinGame(l.code); });
    });
    if (open.length > rows) {
      uiBtn(this, 'lup', X(1180), Y(412), L(56), L(28), { label: '^', size: L(14), disabled: this.lOff === 0 }, () => lwheel(-1));
      uiBtn(this, 'ldn', X(1244), Y(412), L(56), L(28), { label: 'v', size: L(14), disabled: this.lOff >= open.length - rows }, () => lwheel(1));
    }
    if (this.msg) { rrect(X(360), Y(784), L(600), L(36), L(10), '#5a1a1aee', '#ff9a9a', 2); text(this.msg, X(660), Y(802), L(15), '#ffd0d0', 'center', null); }
    else hint(padUI() ? 'D-pad move   A select   B back' : 'Click to select   Esc back');
  },
};

// ---------- the match itself (called from BattleScene while NET.role is set) ----------
// Pausing is the host's B.paused, so it stops the sim (and the clock) for both players. Choosing a replacement and the mega cinematic
// already stop the sim through B.choose / B.hitstop, so the guest sees the same freeze.
const netPause = () => { if (NET.role === 'host') { B.paused = true; B.pausedBy = 0; } else NETSYNC.send({ t: 'pause' }); };
const netResume = () => { if (NET.role === 'host') B.paused = false; else NETSYNC.send({ t: 'resume' }); };
function onlineBattleUpdate(sc, dt) {
  const guest = NET.role === 'guest', mi = meIdx();
  if (!guest && !NET.guestReady) { // still waiting for the guest's art to finish loading
    NET.waitT = (NET.waitT || 0) + dt;
    if (backHit()) netLeave('');
    else if (NET.waitT > 120) netLeave('Your opponent could not finish loading the match.');
    return;
  }
  if (sc.guard > 0) sc.guard -= dt;
  if (INPUT.hit('START') && !B.over && !(sc.guard > 0)) { sc.guard = 0.5; if (!B.paused) netPause(); else if (B.pausedBy === mi) netResume(); }
  if (B.paused) {
    const items = sc.pauseItems(); sc.pause.sel = clamp(sc.pause.sel, 0, items.length - 1); runMenu(sc.pause, items, dt);
    if (backHit() && B.pausedBy === mi && !(sc.guard > 0)) { sc.guard = 0.5; netResume(); }
  }
  if (guest) {
    NETSYNC.guestTick(dt); // input read + sent at its own rate, screen advanced
  } else {
    if (B.paused) NETSYNC.clearInput();
    updateBattle(dt); NETSYNC.harvest();
    NETSYNC.hostTick(dt); // snapshots (skipped while the link is backed up), effects, team changes
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
// drawn over the battle while the host waits for the guest to load
function onlineOverlay() {
  if (NET.role !== 'host' || NET.guestReady) return;
  const { X, Y, L } = layout();
  ctx.fillStyle = '#000000cc'; ctx.fillRect(0, 0, VW, VH);
  panel(X(360), Y(250), L(600), L(300));
  vsCards(X(660), Y(262), L(70), NET.cfg?.player, NET.cfg?.cpu);
  text(`WAITING FOR ${(NET.guestName || 'YOUR OPPONENT').toUpperCase()}`, X(660), Y(395), L(26), '#fff', 'center', null);
  text('Loading the arena and sprites...', X(660), Y(430), L(15), '#aab4c8', 'center', null);
  rrect(X(440), Y(460), L(440), L(18), L(9), '#ffffff18', '#ffffff55', 2);
  rrect(X(442), Y(462), L(436) * NET.peerLoad, L(14), L(7), '#ffde3b');
  text(Math.round(NET.peerLoad * 100) + '%', X(660), Y(505), L(15), '#fff', 'center', null);
  hint('Esc / B leave');
}
function onlineRematch() { startBattleA(NET.cfg); NETSYNC.begin(); NETSYNC.send({ t: 'rematch' }); AUDIO.playMusic(NET.cfg.music); }

// invite links: ?join=CODE opens straight into joining that lobby
const AUTOJOIN = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
if (AUTOJOIN.length === 5) setTimeout(() => { if (window.DEX && !NET.role) { setScene(OnlineScene); joinGame(AUTOJOIN); history.replaceState(null, '', location.pathname); } }, 600);
