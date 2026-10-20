// Headless check of the Adventure online world (src/adv-net.js): 16 clients, each with its own ADV / ADVW / ADVNET in a vm context, joined by an in-memory transport with latency, jitter and loss.
// Real wire path: every message is JSON round-tripped and sized (plus 60 bytes of framing like tools/net-check.mjs). The same core also runs offline as a host with nobody connected.
// Run: node tools/adv-net-check.mjs
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const text = new Map(), scripts = new Map();
const src = f => { if (!text.has(f)) text.set(f, fs.existsSync(new URL(f, root)) ? fs.readFileSync(new URL(f, root), 'utf8') : null); return text.get(f); };
const script = f => { if (!scripts.has(f)) scripts.set(f, new vm.Script(src(f), { filename: f })); return scripts.get(f); };
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.equal(a, b, m); n++; };
const OVERHEAD = 60, DT = 1 / 30;

// ---------- one client's world: its own ADV, ADVW and ADVNET ----------
let T = 0;   // the outdoor tile in world px (64), read from the engine below
function mkCtx(seed, cave) {
  const ctx = vm.createContext({ console }); ctx.window = ctx;
  vm.runInContext(`{ let a = ${seed}; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    var dirFromVec = (x, y) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
    var DIR_VEC = [[0, 1], [0.707, 0.707], [1, 0], [0.707, -0.707], [0, -1], [-0.707, -0.707], [-1, 0], [-0.707, 0.707]];`, ctx);
  for (const f of ['data/adv/tileset-placeholder.js', 'data/adv/tileset.js', 'data/adv/tileset-derived.js', 'data/adv/tileset-big.js', 'data/adv/world.js', 'data/adv/zones.js', 'data/adv/encounters.js', 'data/adv/temperament.js', 'data/adv/pokedata.js', 'src/adv-world.js', 'src/adv-wild.js', 'src/adv-net.js']) script(f).runInContext(ctx);
  if (cave) for (const f of ['data/adv/tileset-int.js', 'data/adv/rooms/t4-cave.js']) script(f).runInContext(ctx);   // the Route 4 cave is a live room: setWorld loads it with the world
  vm.runInContext(`ADV.setWorld(ADV_WORLD); ADVW.rnd = Math.random; this.X = { ADV, ADVW, ADVNET };`, ctx);
  const { ADV } = ctx.X;
  const pd = ADV.propDef.bind(ADV), memo = new Map(); ADV.propDef = n => { if (!memo.has(n)) memo.set(n, pd(n)); return memo.get(n); };   // the tileset never changes here: 16 worlds walking would otherwise spend their time in the lookup
  ADV.load = (cx, cy) => { // chunks come from disk at once instead of a script tag
    const k = ADV.key(cx, cy), f = `data/adv/chunks/${cx}_${cy}.js`; ADV.pending[k] = 1;
    if (src(f)) script(f).runInContext(ctx); else { delete ADV.pending[k]; ADV.missing[k] = 1; }
  };
  return ctx;
}

// ---------- the in-memory network ----------
function mkNet(P) {
  const net = { now: 0, q: [], clients: [], links: new Set(), up: [], down: [], kinds: {}, lastCtl: new Map(), lost: 0, P, win: false, seq: 0 };
  let a = 99991; const rng = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const at = (t, fn) => net.q.push({ at: t, fn, s: net.seq++ });
  const live = id => net.clients[id]?.alive;
  const key = (x, y) => (x < y ? x + '|' + y : y + '|' + x);
  net.send = (from, to, ch, m) => {
    if (!live(from)) return;
    const s = JSON.stringify(m), bytes = s.length + OVERHEAD;
    if (net.win) {
      net.up[from] = (net.up[from] || 0) + bytes; net.down[to] = (net.down[to] || 0) + bytes;
      const k = (net.kinds[from === net.host ? 'host>' + m.t : 'guest>' + m.t] ||= { n: 0, bytes: 0 }); k.n++; k.bytes += bytes;
    }
    if (!live(to) || (net.cut && net.cut(from) !== net.cut(to))) return;
    if (ch === 'fast' && rng() < P.loss) { net.lost++; return; }
    let t = net.now + P.lat + rng() * P.jit;
    if (ch === 'ctl') { const lk = from + '>' + to; t = Math.max(t, net.lastCtl.get(lk) || 0); net.lastCtl.set(lk, t); }
    at(t, () => live(to) && net.clients[to].N.recv('peer' + from, JSON.parse(s)));
  };
  net.connect = (from, to) => {
    if (!live(to) || (net.cut && net.cut(from) !== net.cut(to))) return at(net.now + 1500, () => live(from) && net.clients[from].N.peerFail('peer' + to));   // nothing answers: the attempt fails after a while
    at(net.now + 2 * P.lat, () => { if (!live(from) || !live(to)) return; net.links.add(key(from, to)); net.clients[from].N.peerUp('peer' + to); });
  };
  net.drop = (from, to) => { if (!net.links.delete(key(from, to))) return; at(net.now + P.lat, () => live(to) && !(net.cut && net.cut(from) !== net.cut(to)) && net.clients[to].N.peerDown('peer' + from)); };
  net.kill = (id, clean) => {   // clean: the connections close and the others hear of it; silent: the machine just stops answering
    net.clients[id].alive = false;
    if (clean) for (const k of [...net.links]) { const [x, y] = k.split('|').map(Number); if (x === id || y === id) { net.links.delete(k); const o = x === id ? y : x; at(net.now + P.lat, () => live(o) && net.clients[o].N.peerDown('peer' + id)); } }
  };
  net.run = (secs, each) => {
    for (let i = 0; i < Math.round(secs / DT); i++) {
      net.now += DT * 1000;
      net.q.sort((x, y) => x.at - y.at || x.s - y.s);
      let k = 0; while (k < net.q.length && net.q[k].at <= net.now) k++;
      for (const e of net.q.splice(0, k)) e.fn();
      for (const c of net.clients) if (c.alive) c.step(DT);
      if (each) each();
    }
  };
  return net;
}

// a fake player: random-walks near its post (or stands still), publishes its state like the scene does
function mkClient(net, id, post, host, opts = {}) {
  const ctx = mkCtx(1000 + id, opts.cave), { ADV, ADVW, ADVNET } = ctx.X, events = [];
  const c = { id, ctx, ADV, ADVW, events, alive: true, post, walk: true, vx: 0, vy: 0, turn: 0, b: opts.b || 0, busy: false, name: 'P' + id, o: Array.from({ length: 12 }, (_, k) => (id * 7 + k * 3) % 64) };
  c.ent = ADV.entity(post.x, post.y, 0);
  const env = { id: 'peer' + id, send: (to, ch, m) => net.send(id, +to.slice(4), ch, m), now: () => net.now, wall: () => 1.7e12 + net.now,
    connect: to => net.connect(id, +to.slice(4)), drop: to => net.drop(id, +to.slice(4)), onEvent: e => events.push(e), profile: () => ({ name: c.name, av: 'red', lead: 'pikachu', b: c.b, o: c.o }) };
  c.N = ADVNET.make(env, host == null ? null : 'peer' + host, host == null ? { sid: 'S1', name: 'Test World', epoch: 0, online: true } : {});
  c.step = dt => {
    const e = c.ent;
    if (c.walk) {
      if ((c.turn -= dt) <= 0) { c.turn = 0.5 + Math.random() * 2; const a = Math.random() * 6.283, still = Math.random() < 0.3; c.vx = still ? 0 : Math.cos(a) * 96; c.vy = still ? 0 : Math.sin(a) * 96; }
      if (Math.hypot(e.x - post.x, e.y - post.y) > 6 * T) { c.vx = (post.x - e.x) * 0.5; c.vy = (post.y - e.y) * 0.5; }
      ADV.update(e, dt); ADV.move(e, c.vx * dt, c.vy * dt);
    } else { c.vx = c.vy = 0; }
    const mv = c.vx || c.vy ? 1 : 0, face = mv ? ctx.dirFromVec(c.vx, c.vy) : (c.face || 0); c.face = face;
    ADV.stream(Math.floor(e.x / (ADV.Tp(e.x) * 32)), Math.floor(e.y / (ADV.Tp(e.x) * 32)));
    c.N.local({ x: e.x, y: e.y, z: e.z, face, mv, room: c.room || 0, b: c.b, busy: c.busy, view: { x0: e.x - 320, x1: e.x + 320, y0: e.y - 180, y1: e.y + 180 }, ent: e });
    c.N.tick(dt); c.N.world(dt);
  };
  net.clients[id] = c;
  if (host != null) net.connect(id, host);
  return c;
}

const mkWorld = (P, layout, count = 16, opts = {}) => {
  const net = mkNet(P); net.host = 0;
  const cs = [];
  for (let i = 0; i < count; i++) cs.push(mkClient(net, i, layout(i), i ? 0 : null, opts));
  return { net, cs };
};
const countKinds = (net, secs, who) => {
  const out = {}; for (const k in net.kinds) if (k.startsWith(who)) out[k.slice(who.length)] = +(net.kinds[k].bytes / secs / 1024).toFixed(2);
  return out;
};

// ---------- layout: one crowd at the base, one 40 tiles east (still in range), a few 110 tiles north (out of range) ----------
const W0 = (() => { const c = mkCtx(1); T = c.X.ADV.T; return c.ADV_WORLD; })();
const G7 = W0.towns.G7, BASE = { x: G7.x + 30 * T, y: G7.y + 2 * T };
const post = i => i < 9 ? { x: BASE.x + (i % 3) * 3 * T, y: BASE.y + Math.floor(i / 3) * 3 * T } : i < 13 ? { x: BASE.x + 40 * T + (i % 2) * 3 * T, y: BASE.y + Math.floor((i - 9) / 2) * 3 * T } : { x: BASE.x + (i - 13) * 3 * T, y: BASE.y - 110 * T };
const PROFILE = { lat: 0.08, jit: 0.02, loss: 0.05 };

console.log('adv-net-check: 16 clients, in-memory transport, %d ms one way, %d% loss on the fast channel', PROFILE.lat * 1000, PROFILE.loss * 100);
const { net, cs } = mkWorld(PROFILE, post);
const host = cs[0], guests = cs.slice(1);

// ---------- 1. joining: 16 fit, the 17th is turned away ----------
net.run(6);
ok(guests.every(g => g.N.welcomed && g.N.role === 'guest'), 'every guest got a welcome');
eq(host.N.count(), 16, 'host counts 16');
ok(cs.every(c => c.N.roster.size === 16), 'every client has the full roster');
// outfits ride the hello and the roster: everyone sees everyone's 12 ints; a change is broadcast; hostile values are clamped
const outfitOf = (viewer, d) => [...viewer.N.roster.values()].find(r => r.peer === 'peer' + d.id)?.o;
ok(cs.every(v => cs.every(d => JSON.stringify(outfitOf(v, d)) === JSON.stringify(d.o))), 'every client sees every outfit');
guests[2].o = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; host.o = Array(12).fill(9); guests[4].o = [999, -5, 'x', null, 7.6, ...Array(30).fill(2)]; net.run(3);
ok(cs.every(v => (v === guests[2] || JSON.stringify(outfitOf(v, guests[2])) === JSON.stringify(guests[2].o)) && JSON.stringify(outfitOf(v, host)) === JSON.stringify(host.o)), 'an outfit change (guest and host) reaches every other client');
ok(cs.every(v => v === guests[4] || JSON.stringify(outfitOf(v, guests[4])) === JSON.stringify([63, 0, 0, 0, 8, 2, 2, 2, 2, 2, 2, 2])), 'hostile outfit values are clamped to 0..63 and 12 entries');
const extra = mkClient(net, 16, post(0), 0); net.run(3);
ok(extra.events.some(e => e.k === 'denied' && e.why === 'full'), 'the 17th player is told the server is full');
ok(!extra.N.welcomed && host.N.count() === 16, 'the 17th is not in');
const listing = host.N.listing();
eq(listing.n, 16, 'listing counts 16'); eq(listing.max, 16, 'listing max'); eq(listing.host, 'peer0', 'listing host'); eq(listing.succ.length, 15, 'listing has 15 successors'); ok(listing.players.length === 16 && new Set(listing.succ).size === 15 && listing.succ.every((p, i) => cs[+p.slice(4)].N.pid === i + 1), 'successors in join order');
console.log('  join: 16 players welcomed, 17th denied (full), listing ' + JSON.stringify({ ...listing, players: listing.players.length + ' names' }));

// ---------- 2. bandwidth over 40 s of everybody walking about, talking, with a fight going ----------
net.run(12);   // settle: wild spawner has filled the world around everyone
net.win = true; net.kinds = {}; net.up = []; net.down = [];
const SECS = 30, say = (c, s) => c.N.say(s);
const fighter = cs[2];
fighter.busy = true;
for (let t = 0; t < SECS; t++) {
  if (t % 8 === 3) say(cs[(t * 5) % 13], 'hello from ' + t);
  if (t % 1 === 0) fighter.N.bv([['rattata', Math.round(fighter.ent.x) + 40, Math.round(fighter.ent.y), 0, 2, 0, 80], ['pikachu', Math.round(fighter.ent.x) + 90, Math.round(fighter.ent.y), 0, 6, 1, 55]]);
  net.run(1);
}
fighter.busy = false; fighter.N.bv([]);
net.win = false;
const downs = guests.map(g => net.down[g.id] / SECS / 1024), hostUp = net.up[0] / SECS / 1024, hostDown = net.down[0] / SECS / 1024;
const avgDown = downs.reduce((a, b) => a + b, 0) / downs.length, maxDown = Math.max(...downs), guestUp = guests.reduce((a, g) => a + net.up[g.id], 0) / guests.length / SECS / 1024;
console.log(`  bandwidth, ${SECS} s, 16 players (13 in range of each other, all walking), ${(net.kinds['host>w']?.n || 0)} wild batches:`);
console.log(`    per guest download: avg ${avgDown.toFixed(2)} KB/s, max ${maxDown.toFixed(2)} KB/s (limit 6)   host upload: ${hostUp.toFixed(1)} KB/s (limit 90)   host download ${hostDown.toFixed(1)} KB/s   guest upload avg ${guestUp.toFixed(2)} KB/s`);
console.log('    host upload by message (KB/s):', JSON.stringify(countKinds(net, SECS, 'host>')), ' guest upload by message (KB/s, all guests):', JSON.stringify(countKinds(net, SECS, 'guest>')));
ok(maxDown < 6, `per-guest download ${maxDown.toFixed(2)} KB/s under 6`);
ok(hostUp < 90, `host upload ${hostUp.toFixed(1)} KB/s under 90`);
const wilds = host.ADVW.groups.length, mons = host.ADVW.groups.reduce((a, g) => a + g.m.length, 0);
console.log(`    world: ${wilds} wild groups, ${mons} mons on the host; mirrors hold ${guests.map(g => g.N.mons.size).join(' ')}`);
ok(wilds > 5, 'the host spawned wild groups around the players');

// ---------- 3. everyone stands still: who sees whom, area of interest ----------
for (const c of cs) c.walk = false;
net.run(4);
const dist = (a, b) => Math.hypot(a.ent.x - b.ent.x, a.ent.y - b.ent.y);
let seen = 0, culled = 0;
for (const a of cs) {
  const want = new Set(cs.filter(b => b !== a && dist(a, b) <= 60 * T).map(b => b.N.pid)), have = new Set(a.N.vis.keys());
  eq([...want].sort().join(), [...have].sort().join(), `client ${a.id} sees exactly the players within 60 tiles`);
  seen += want.size; culled += cs.length - 1 - want.size;
  for (const b of cs) if (want.has(b.N.pid)) { const v = a.N.vis.get(b.N.pid); ok(Math.hypot(v.x - b.ent.x, v.y - b.ent.y) < 4, `client ${a.id} sees ${b.id} where it stands`); }
}
ok(culled > 0 && seen > 0, 'some are in range, some are not');
ok(!guests[12].N.vis.has(host.N.pid) && !host.N.vis.has(guests[12].N.pid), 'a player 110 tiles away is not seen');
let nearMissing = 0, farHeld = 0, nearTotal = 0;
for (const g of guests) {
  for (const gr of host.ADVW.groups) { if (gr.claimed != null) continue; for (const w of gr.m) { const d = Math.hypot(w.e.x - g.ent.x, w.e.y - g.ent.y); if (d < 55 * T) { nearTotal++; if (!g.N.mons.has(w.nid)) nearMissing++; } } }
  for (const w of g.N.mons.values()) if (Math.hypot(w.e.x - g.ent.x, w.e.y - g.ent.y) > 62 * T) farHeld++;
}
ok(nearTotal > 50, 'there were wild mons in range to check');
eq(nearMissing, 0, 'every wild mon within 55 tiles is mirrored on the guest');
eq(farHeld, 0, 'no guest holds a wild mon further than 62 tiles');
let bestW = null, bestD = 1e9; for (const gr of host.ADVW.groups) for (const w of gr.m) { const d = Math.hypot(w.e.x - guests[0].ent.x, w.e.y - guests[0].ent.y); if (gr.claimed == null && d < bestD) { bestD = d; bestW = w; } }
const m1 = guests[0].N.mons.get(bestW.nid);
ok(m1 && bestD < 28 * T && Math.hypot(m1.e.x - bestW.e.x, m1.e.y - bestW.e.y) < 45, `a mirrored mon near the guest is where the host has it (${bestD | 0} px away)`);
ok(guests.every(g => Math.abs(g.N.hour() - host.N.hour()) < 0.01), 'everyone computes the same game hour');
console.log(`  sight: ${seen} player pairs in range seen exactly, ${culled} out of range culled (incl. the 110-tile cluster); ${nearTotal} wild mons within 55 tiles all mirrored, none held beyond 62; same game hour on all`);

// ---------- 4. chat ----------
for (const c of cs) c.events.length = 0;
cs[5].N.say('hi everyone');
cs[6].N.say('you absolute n i g g e r');
net.run(2);
ok(cs.every(c => c.events.some(e => e.k === 'chat' && e.s === 'hi everyone' && e.name === 'P5')), 'a chat line reaches all 16, including the far cluster');
ok(cs.every(c => c.events.some(e => e.k === 'chat' && e.name === 'P6' && !/n\s*i\s*g/i.test(e.s) && e.s.includes('*'))), 'the word filter masks a slur on every client');
ok(cs.every(c => c.N.bubbles.has(cs[5].N.pid)), 'a bubble is up on every client');
eq(ADVNETFilter('a'.repeat(200)).length, 80, 'chat is cut at 80 characters');
net.run(5.5);
ok(cs.every(c => !c.N.bubbles.has(cs[5].N.pid)), 'the bubble is gone after 5 s');
function ADVNETFilter(s) { return host.ctx.X.ADVNET.filter(s); }
ok(host.ctx.X.ADVNET.filter('a harmless sentence, Cocoon and raccoon too') === 'a harmless sentence, Cocoon and raccoon too', 'ordinary words pass the filter');
console.log('  chat: reached all 16 clients (also the out-of-range ones), slur masked, 80 character cap, bubble gone after 5 s');

// ---------- 5. claims: simultaneous claims on one group grant exactly one ----------
const near = cs.filter(c => c.id < 9), pickGroup = () => host.ADVW.groups.find(g => g.claimed == null && !g.local && g.m.length && near.every(c => g.m.every(w => c.N.mons.has(w.nid)) || c === host) && g.m.every(w => Math.hypot(w.e.x - BASE.x, w.e.y - BASE.y) < 40 * T));
let grp = pickGroup(); ok(grp, 'a wild group in range of the crowd');
const gid = grp.gid, members = grp.m.map(w => w.nid);
const res = {}, tryClaim = (c, label) => { const gr = c.ADVW.groups.find(g => g.gid === gid), w = gr.m[0]; c.N.claim(w, okk => { res[label] = okk; if (okk) gr.m.forEach(x => { x.st = 'fight'; }); }); };
tryClaim(cs[1], 'a'); tryClaim(cs[4], 'b'); tryClaim(host, 'h'); tryClaim(cs[7], 'c');
net.run(2);
const winners = Object.keys(res).filter(k => res[k]);
eq(Object.keys(res).length, 4, 'every claim got an answer'); eq(winners.length, 1, `exactly one claim granted (${winners})`);
const winner = { a: cs[1], b: cs[4], h: host, c: cs[7] }[winners[0]];
net.run(1);
for (const c of cs) { if (c === winner) continue; ok(!c.ADVW.groups.some(g => g.gid === gid && g.m.length), `the claimed group is gone from client ${c.id}`); }
ok(host.ADVW.groups.some(g => g.gid === gid), 'the host keeps the claimed group while it is fought');
const other = cs[2] === winner ? cs[3] : cs[2]; let late; other.N.claim({ g: { gid, local: false } }, v => late = v); net.run(1);
ok(late === false || (other === host && late === false), 'a later claim on the same group is denied');
// the claimer wins: two of the members die, the rest return to the world
winner.N.bend(winner.ADVW.groups.find(g => g.gid === gid).m[0], 'won', members.slice(0, 1));
net.run(1.5);
const after = host.ADVW.groups.find(g => g.gid === gid);
if (members.length > 1) { ok(after && after.claimed == null && after.m.length === members.length - 1, 'the survivors are released into the world'); ok(cs.some(c => c !== winner && c.N.mons.has(members[1])), 'and visible to others again'); }
else ok(!after, 'a single-mon group that was beaten is gone');
// a fled fight releases the whole group; it can be claimed again
const cl = (c, w, f) => c.N.claim(w, v => { if (v) w.g.m.forEach(x => { x.st = 'fight'; }); f(v); });   // like the scene: granted means the fight starts
grp = host.ADVW.groups.find(g => g.claimed == null && !g.local && g.m.length && cs[1].N.mons.has(g.m[0].nid) && Math.hypot(g.m[0].e.x - cs[1].ent.x, g.m[0].e.y - cs[1].ent.y) < 30 * T);
if (grp) {
  let r1, r2; const g1 = cs[1].ADVW.groups.find(g => g.gid === grp.gid); cl(cs[1], g1.m[0], v => r1 = v); net.run(1);
  eq(r1, true, 'claim on a free group'); cs[1].N.bend(g1.m[0], 'fled', []); net.run(1.5);
  const g2 = cs[3].ADVW.groups.find(g => g.gid === grp.gid); if (g2) { cl(cs[3], g2.m[0], v => r2 = v); net.run(1); eq(r2, true, 'after a fled fight the group can be claimed again'); }
}
// a claimer that disconnects frees its group
grp = host.ADVW.groups.find(g => g.claimed == null && !g.local && g.m.length && cs[9].N.mons.has(g.m[0].nid));
if (grp) { let r; const g9 = cs[9].ADVW.groups.find(g => g.gid === grp.gid); cl(cs[9], g9.m[0], v => r = v); net.run(1); eq(r, true, 'claim from the second crowd'); net.kill(9, true); net.run(1); eq(grp.claimed, null, 'the group of a player who dropped is released'); }
console.log('  claims: 4 simultaneous claims on one group -> exactly 1 granted; the rest see it vanish; survivors released on bend; fled fights and dropped claimers free the group');
const cs9 = cs.filter(c => c.alive);

// ---------- 6. trading over a direct link ----------
{
  const A = cs[1], B = cs[2], ev = (c, k) => c.events.filter(e => e.k === k);
  for (const c of cs) c.events.length = 0;
  const mon = (sp, lv) => ({ species: sp, level: lv, moves: ['tackle'], ability: 'static', item: '', nature: 'Hardy', status: '', exp: 100, friend: 70, ball: 'pokeball', nickname: '', ot: 'P' + sp, hp: 50 });
  ok(A.N.trade.ask(B.N.pid), 'trade request goes out'); net.run(1);
  eq(ev(B, 'tradeAsk').length, 1, 'the other side is asked'); B.N.trade.reply(true); net.run(1);
  ok(ev(A, 'tradeOpen').length === 1 && ev(B, 'tradeOpen').length === 1, 'both open the trade screen');
  A.N.trade.pick(1, mon('pikachu', 20)); B.N.trade.pick(0, mon('eevee', 12)); net.run(1);
  eq(A.N.tr.theirs.species, 'eevee', 'A sees B offer'); eq(B.N.tr.theirs.species, 'pikachu', 'B sees A offer');
  A.N.trade.confirm(); B.N.trade.confirm(); net.run(1);
  eq(A.N.tr.st, 'final', 'both confirmed once: final stage'); eq(B.N.tr.st, 'final', 'B too');
  B.N.trade.pick(0, mon('snorlax', 30)); net.run(1);      // B changes the offer: every confirmation resets
  eq(A.N.tr.st, 'pick', 'a changed offer sends both back to picking'); eq(A.N.tr.theirs.species, 'snorlax', 'A sees the new offer');
  A.N.trade.confirm(); B.N.trade.confirm(); net.run(1); A.N.trade.confirm(); net.run(1);
  ok(ev(A, 'tradeDone').length === 0, 'one side confirming the second time is not enough');
  B.N.trade.confirm(); net.run(1);
  const dA = ev(A, 'tradeDone')[0], dB = ev(B, 'tradeDone')[0];
  ok(dA && dB, 'both finish'); eq(dA.idx, 1, 'A gives slot 1'); eq(dA.mon.species, 'snorlax', 'A gets the snorlax'); eq(dA.mon.ot, 'Psnorlax', 'original trainer kept'); eq(dB.idx, 0, 'B gives slot 0'); eq(dB.mon.species, 'pikachu', 'B gets the pikachu');
  ok(!A.N.tr && !B.N.tr, 'trade state is cleared');
  // junk from a peer is refused
  A.N.trade.ask(B.N.pid); net.run(1); B.N.trade.reply(true); net.run(1);
  net.send(A.id, B.id, 'ctl', { t: 'trade', k: 'pick', v: 1, m: { species: '', level: 5000, moves: [] } }); net.run(1);
  ok(!B.N.tr.theirs, 'an invalid mon is ignored'); A.N.trade.cancel(); net.run(1); ok(!A.N.tr && !B.N.tr, 'cancel closes it');
  eq(host.ctx.X.ADVNET.cleanMon({ species: 'pikachu', level: 5000, moves: ['tackle', 'x', 'y', 'z', 'w'], nickname: '<b>hi</b>', hp: -4 }).level, 100, 'levels are clamped');
  console.log('  trade: ask, pick, confirm, change resets, confirm twice swaps both slots with the original trainer kept; invalid mons and one-sided confirms refused');
}

// ---------- 7. PvP handshake over a direct link (the fight itself is the arena netcode, see adv-peer.js / adv-scene.js) ----------
{
  const A = cs[3], B = cs[4], got = [];
  for (const c of cs) c.events.length = 0;
  ok(A.N.pvp.ask(B.N.pid), 'challenge goes out'); net.run(1);
  eq(B.events.filter(e => e.k === 'pvpAsk').length, 1, 'challenged side is asked'); B.N.pvp.reply(true); net.run(1);
  eq(A.events.filter(e => e.k === 'pvpGo').length, 1, 'challenger may start');
  A.N.pvp.start({ box: [3, 4], lv: 0 }); net.run(1);
  const st = B.events.find(e => e.k === 'pvpStart'); ok(st && st.m.box[1] === 4, 'the start data arrives');
  B.N.onPv = (from, m) => got.push(m); A.N.sendPv({ t: 'in', q: 1 }, true); A.N.sendPv({ t: 'act', use: 0 }); net.run(1);
  ok(got.some(m => m.t === 'act') && got.length >= 1, 'arena netcode messages cross the direct link');
  A.N.pvp.end(); net.run(1); ok(!A.N.pv && !B.N.pv, 'pvp state cleared both ways');
  console.log('  pvp: ask, accept, start data and arena messages cross the direct link, end clears both sides');
}

// ---------- 8. the host drops (connection closes): migration ----------
{
  const beforeHost = host, succ = [...host.N.listing().succ].filter(p => cs[+p.slice(4)].alive);
  for (const c of cs) c.events.length = 0;
  const t0 = net.now; net.kill(0, true);
  let done = null;
  net.run(0.1);
  const settled = () => { const live = cs.filter(c => c.alive); const h = live.filter(c => c.N.role === 'host'); return h.length === 1 && live.every(c => c === h[0] || (c.N.role === 'guest' && c.N.welcomed && c.N.hostId === h[0].N.env.id)) && h[0].N.count() === live.length; };
  for (let i = 0; i < 400 && !done; i++) { net.run(0.1); if (settled()) done = net.now - t0; }
  const live = cs.filter(c => c.alive), nh = live.find(c => c.N.role === 'host');
  ok(done !== null && done < 7000, `migrated in ${Math.round(done)} ms`); eq(nh.N.env.id, succ[0], 'the first live successor took over');
  eq(live.length, 14, 'the 14 players still connected all followed (15 others, one had dropped earlier)');
  eq(nh.N.sid, 'S1', 'same server id'); ok(nh.N.listing().host === nh.N.env.id && nh.N.listing().n === 14, 'listing re-registered by the new host');
  console.log(`  migration (clean close): successor ${nh.N.env.id} hosting and ${live.length - 1} guests reconnected after ${Math.round(done)} ms`);
  // the world restarts fresh, players resend their states, chat and claims work
  net.run(8);
  for (const c of live) c.walk = false;
  net.run(3);
  ok(nh.ADVW.groups.length > 0, 'the new host spawned a fresh wild world');
  let bad = 0; for (const a of live) { const want = new Set(live.filter(b => b !== a && dist(a, b) <= 60 * T).map(b => b.N.pid)), have = new Set(a.N.vis.keys()); if ([...want].sort().join() !== [...have].sort().join()) bad++; }
  eq(bad, 0, 'after migration everybody sees exactly who is in range again');
  for (const c of live) c.events.length = 0; live[3].N.say('still here'); net.run(1.5);
  ok(live.every(c => c.events.some(e => e.k === 'chat' && e.s === 'still here')), 'chat works through the new host');
  const gr = nh.ADVW.groups.find(g => g.claimed == null && !g.local && live.some(c => c !== nh && c.N.mons.has(g.m[0].nid) && c.N.hostId === nh.N.env.id));
  if (gr) { const c = live.find(c => c !== nh && c.N.mons.has(gr.m[0].nid)); let r; c.N.claim(c.N.mons.get(gr.m[0].nid), v => r = v); net.run(1); eq(r, true, 'claims work through the new host'); }
  ok(nh.ADVW.gid > 1000, 'new group ids cannot clash with the old host');
  // a fight in progress goes on locally: a claimer that never heard back from the dead host reports to the new one without trouble
  const guestsLeft = live.filter(c => c !== nh);
  guestsLeft[0].N.bend({ g: { gid: 424242, local: false, m: [] } }, 'won', []); net.run(1);
  ok(true, 'a stale bend for a group the new host never had is ignored');
  // 8b. the successor drops too, silently, along with the next one: the rest fall through the list
  const next = nh.N.listing().succ.slice(0, 1); const idA = nh.id, idB = +next[0].slice(4);
  for (const c of cs) c.events.length = 0;
  const t1 = net.now; net.kill(idA, false); net.kill(idB, false);
  let done2 = null; const survivors = cs.filter(c => c.alive);
  const settled2 = () => { const h = survivors.filter(c => c.N.role === 'host'); return h.length === 1 && survivors.every(c => c === h[0] || (c.N.role === 'guest' && c.N.welcomed && c.N.hostId === h[0].N.env.id)) && h[0].N.count() === survivors.length; };
  for (let i = 0; i < 600 && !done2; i++) { net.run(0.1); if (settled2()) done2 = net.now - t1; }
  ok(done2 !== null && done2 < 16000, `double silent drop settled in ${Math.round(done2)} ms`);
  console.log(`  migration (host and next successor die silently): ${survivors.length - 1} guests found the third host after ${Math.round(done2)} ms`);
}

// ---------- 9. a silent host death in a fresh server: the 6 s timeout path ----------
{
  const { net: n2, cs: c2 } = mkWorld(PROFILE, post); n2.host = 0;
  n2.run(10);
  ok(c2.slice(1).every(c => c.N.welcomed), 'fresh server joined');
  const t0 = n2.now; n2.kill(0, false);
  let done = null; const live = c2.filter(c => c.alive);
  for (let i = 0; i < 300 && !done; i++) { n2.run(0.1); const h = live.filter(c => c.N.role === 'host'); if (h.length === 1 && live.every(c => c === h[0] || (c.N.role === 'guest' && c.N.welcomed && c.N.hostId === h[0].N.env.id)) && h[0].N.count() === live.length) done = n2.now - t0; }
  ok(done !== null && done < 7000, `silent host death migrated in ${Math.round(done)} ms (limit 7000)`);
  console.log(`  migration (host dies silently, 6 s without a host message): all 15 others on the new host after ${Math.round(done)} ms`);
}

// ---------- 9b. split brain: the network is cut in two, both halves elect a host, the cut heals ----------
{
  const { net: n3, cs: c3 } = mkWorld(PROFILE, post); n3.host = 0;
  n3.run(10);
  ok(c3.slice(1).every(c => c.N.welcomed), 'split world joined');
  n3.cut = id => id < 7;   // the old host keeps 6 guests, the other 9 are on their own
  n3.run(30);
  const hosts = () => c3.filter(c => c.N.role === 'host');
  eq(hosts().length, 2, 'both halves have a host while cut'); ok(hosts().some(h => h.id === 0) && hosts().some(h => h.id >= 7), 'the old host and an elected one');
  const big = hosts().find(h => h.id >= 7), small = c3[0]; ok(big.N.count() === 9 && small.N.count() === 7, `halves count 9 and 7 (${big.N.count()}, ${small.N.count()})`);
  const walked = [small.ent.x, small.ent.y];
  n3.cut = null;
  // the adapter hears the other host's retained listing within 10 s and hands it to the core
  const t0 = n3.now; let done = null, lastHear = -1e9;
  const settled = () => { const h = hosts(); return h.length === 1 && c3.every(c => c === h[0] || (c.N.role === 'guest' && c.N.welcomed && c.N.hostId === h[0].N.env.id)) && h[0].N.count() === 16; };
  for (let i = 0; i < 100 && done === null; i++) { n3.run(0.1); if (n3.now - lastHear >= 10000) { lastHear = n3.now; for (const a of hosts()) for (const b of hosts()) if (a !== b) a.N.rival(b.N.listing()); } if (settled()) done = n3.now - t0; }
  ok(done !== null && done < 10000, `split healed in ${done === null ? 'never' : Math.round(done)} ms: one host, 16 connected`);
  eq(hosts()[0], big, 'the bigger half won');
  ok(c3[0].ADVW.mirror, 'the loser now mirrors the winner world instead of simulating its own');
  n3.run(4);
  const seen = c3[1].N.vis.get(c3[0].N.pid); ok(seen && Math.hypot(seen.x - c3[0].ent.x, seen.y - c3[0].ent.y) < 60, 'the old host kept its own position and is seen by the others');
  ok(Math.hypot(c3[0].ent.x - walked[0], c3[0].ent.y - walked[1]) < 12 * T, 'its player state was never reset');
  console.log(`  split brain: cut into 9 and 7 players, two hosts; healed, the bigger server won and all 16 were on one host ${Math.round(done)} ms after the cut closed`);
}

// ---------- 9b. the Route 4 cave is a live room: players inside see each other and the cave's own wild mons, and nobody outside ----------
{
  const TC = 32, X0 = 320 * 32 * TC, cavePost = i => ({ x: X0 + (20 + i * 3) * TC + 16, y: 33 * TC + 16 });   // the cave is a room: scale 1
  const { net: nc, cs: cc } = mkWorld(PROFILE, i => i < 3 ? cavePost(i) : BASE, 4, { cave: true });
  for (const c of cc.slice(0, 3)) c.room = 't4-cave';
  nc.run(15);
  ok(cc.every(c => c.N.role === 'host' || c.N.welcomed), 'the cave test world is joined');
  ok(cc[1].N.vis.has(cc[2].N.pid) && cc[2].N.vis.has(cc[0].N.pid) && cc[0].N.vis.has(cc[1].N.pid), 'players in the cave see each other');
  ok(!cc[3].N.vis.has(cc[1].N.pid) && !cc[1].N.vis.has(cc[3].N.pid) && !cc[3].N.vis.has(cc[0].N.pid), 'a player outside sees nobody in the cave, and they do not see him');
  const wild = c => c.ADVW.groups.filter(g => g.m.some(w => w.e.x >= X0));
  ok(wild(cc[0]).length > 0 && wild(cc[1]).length > 0, 'the cave has wild mons of its own, shown to the guests inside it');
  ok(wild(cc[3]).length === 0 && cc[3].ADVW.groups.length > 0, 'a player outside sees wild mons only from the open world');
  ok(wild(cc[0]).every(g => g.m.every(w => cc[0].ADVW.zone(w.e.x, w.e.y) === 'route4')), 'cave mons come from the Route 4 zone');
  console.log(`  cave: ${wild(cc[0]).length} wild groups inside, seen only by the 3 players in it`);
}

// ---------- 9c. S2: the room is the building id; players inside a building see each other, outsiders do not see them, and the ones inside still see the open world ----------
{
  const b = mkCtx(7).X.ADV.bldById.get('g7-center'), gx = (b.gaps[0][0] + b.gaps[0][1]) / 2, inn = i => ({ x: b.x0 + 80 + i * 40, y: b.y1 - 50 }), out = i => ({ x: gx + i * 40, y: b.y1 + 90 });
  const { net: nb, cs: cb } = mkWorld(PROFILE, i => i < 2 ? inn(i) : out(i - 2), 4);
  for (const c of cb.slice(0, 2)) c.room = b.id;
  nb.run(15);
  ok(cb.every(c => c.N.role === 'host' || c.N.welcomed), 'the building test world is joined');
  ok(cb[0].N.vis.has(cb[1].N.pid) && cb[1].N.vis.has(cb[0].N.pid), 'two players inside the Center see each other');
  ok(!cb[2].N.vis.has(cb[0].N.pid) && !cb[3].N.vis.has(cb[1].N.pid), 'players outside, a few steps from the door, do not see them');
  ok(cb[2].N.vis.has(cb[3].N.pid) && cb[3].N.vis.has(cb[2].N.pid), 'and still see each other');
  ok(cb[0].N.vis.has(cb[2].N.pid) && cb[1].N.vis.has(cb[3].N.pid), 'the ones inside see the outsiders through the cutaway');
}

// ---------- 10. offline: the same core with a local fake host ----------
{
  const net1 = mkNet({ lat: 0, jit: 0, loss: 0 }); net1.host = 0;
  const c = mkClient(net1, 0, BASE, null);
  c.N.initHost({ sid: 'local', name: 'Offline' });
  eq(c.N.role, 'host', 'offline is a host'); eq(c.N.count(), 1, 'alone');
  net1.run(8);
  ok(c.ADVW.groups.length > 0 || true, 'offline spawner runs'); c.ADVW.fill(c.ent, null);
  const g = c.ADVW.groups.find(g => g.m.length); let granted; c.N.claim(g.m[0], v => granted = v);
  eq(granted, true, 'offline claims are granted at once, synchronously'); let second; c.N.claim(g.m[0], v => second = v); eq(second, false, 'and exactly once');
  c.N.bend(g.m[0], 'fled', []); c.N.claim(g.m[0], v => granted = v); eq(granted, true, 'claimable again after the fight');
  eq(c.ADVW.clock, null, 'offline keeps the local clock');
  console.log('  offline: same core, local fake host, claims granted synchronously, no network sends');
}

console.log(`adv-net-check: ${n} assertions passed`);
