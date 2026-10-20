const ADV_DIRS8 = ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft'];   // face index order
// Adventure mode: walk the streamed overworld, lead Pokemon trailing behind, living wild mons (adv-wild.js) that start a fight on the spot (battle.js with a world arena, see ADVB).
// W1c: the party, bag and money live in ADV.save (adv-save.js); screens are in adv-ui.js. Modes: walk | battle | fade | talk | spot; this.uis is a stack of screens that freezes the world while open.
// S1a: NPCs (adv-npc.js) talk in a text box (mode talk) and trainers that see you walk up and fight (mode spot, then a world battle with this.tr set).
// Debug query: ?at=<tileX>,<tileY> starts there, ?time=night|day|<hour 0-24> pins the clock.
'use strict';
const ANIMS = ['Idle', 'Walk', 'Attack', 'Charge', 'Hurt', 'Pose', 'Faint', 'Rotate', 'Sleep', 'Shoot', 'Strike', 'Swing'];   // battle animation names as they travel in battle views (adv-net.js bv)
const ADV_ALT = 70, ADV_STEP_PX = 14, ADV_TOUCH = 26, ADV_FLEE = 12 * 32, ADV_FLEE_T = 1.5, ADV_KEEP = 4, ADV_EDGE = 48, ADV_EDGE_T = 0.8;   // a fight: the trainer keeps ADV_KEEP tiles behind its mon; running at the box edge for ADV_EDGE_T s (ADV_EDGE px in) gets away
// Adventure music (data/adv/music.js): the zone you stand in (night table after dark), rooms, fights and win fanfares, with 1.2 s crossfades between Audio elements.
// AUDIO.vol.music scales it, so ?mute keeps it silent and nothing plays. The arena's AUDIO.playMusic track is cleared on entry; arena code is otherwise unchanged.
const ADV_FADE = 1.2;
const ADVM = {
  list: [], want: '',
  // crossfade to the named track ('' = silence); once = a fanfare that does not loop. Returns the fanfare's entry.
  to(name, once = false) {
    if (name === this.want && !once) return null;
    this.want = name;
    const src = name && window.ADV_MUSIC?.tracks[name];
    for (const x of this.list) if (!(x.name === name && !once && !x.once)) x.to = 0;
    let e = src && !once ? this.list.find(x => x.name === name && !x.once) : null;
    if (!e && src) { e = { name, a: new Audio(src), v: 0, to: 0, once, retry: 0, dead: false }; e.a.loop = !once; this.list.push(e); }
    if (e) e.to = 1;
    return e || null;
  },
  tick(dt) {
    const vol = clamp(AUDIO.vol.music, 0, 1), step = dt / ADV_FADE;
    for (const e of this.list) {
      if (e.once && e.a.ended) e.to = 0;
      e.v = e.v < e.to ? Math.min(e.to, e.v + step) : Math.max(e.to, e.v - step);
      e.a.volume = clamp(e.v * vol, 0, 1);
      if (e.to === 0 && e.v <= 0) { e.a.pause(); e.dead = true; }
      else if (e.to > 0 && vol > 0 && e.a.paused && !e.a.ended && (e.retry -= dt) <= 0) { e.retry = 0.5; e.a.play().catch(() => {}); } // retried while autoplay is blocked
    }
    this.list = this.list.filter(e => !e.dead);
  },
  stop() { for (const e of this.list) e.a.pause(); this.list = []; this.want = ''; },
};
const AdventureScene = {
  enter() {
    ADVM.stop(); AUDIO.playMusic(null); this.vic = null; ADVR.load();
    ADV.reset(); ADVW.reset(); ADVN.reset(); const W = window.ADV_WORLD;
    this.dlg = this.sp = this.tr = this.bang = this.room = this.heal = this.warpTo = null; this.t = 0; this.ready = false; this.save = null; this.mode = 'start'; this.net = null; this.log = []; this.typing = null; this.tst = null; this.pv = null; this.rem = new Map(); this.want = null; this.uis = []; this.inB = false; this.wh = null; this.cs = this.iu = null; this.msg = null; this.err = !W ? 'No world data' : '';
    ADVW.load = id => preload(assetSrcs({ arena: {}, player: { team: [] }, cpu: { team: [{ species: id }] } })); // a wild species loads when it spawns, so its fight is ready
    this.wx = new URLSearchParams(location.search).get('weather') || '';   // the world has no weather yet: ?weather=rain|snow|sun is a debug pin the follower's mood reads
    const tm = new URLSearchParams(location.search).get('time');
    ADVW.hourSet = tm ? (tm === 'night' ? 23 : tm === 'day' ? 12 : +tm) : null;
    if (W) { this.open(this.resume || ADVUI.start(this)); this.resume = null; }
  },
  exit() { ADVR.dark = null; this.persist(); this.closeChat(); this.stopNet(); this.uis.forEach(u => u.exit && u.exit()); this.uis = []; ADV.reset(); ADVW.reset(); ADVN.reset(); ADV.player = null; if (this.inB) B = null; ADVM.stop(); this.vic = null; },
  // the track this moment wants: a fight, a win fanfare still playing, a room, else the zone (the night table after dark); '' = silence
  musicName() {
    const M = window.ADV_MUSIC, p = this.p;
    if (!M) return '';
    if (this.mode === 'battle' || this.mode === 'pvp') {
      if (AUDIO.musicSrc === FLOWERY_MUSIC) return '';   // Flowery's own fight theme (render.js) takes over
      return this.mode === 'pvp' ? M.battle.trainer : !this.tr ? M.battle.wild : this.tr.t.leader ? M.battle.leader : M.battle.trainer;
    }
    if (this.vic && !this.vic.a.ended) return this.vic.name;
    if (this.room) return M.rooms[this.room.id.split('-').pop()] || M.zones[this.room.door.town] || '';
    const z = ADVW.zone(p.x, p.y) || 'wild';
    if (ADVW.night() && M.night[z]) return M.night[z];
    return M.zones[z] || '';
  },
  // ---------- screens and the save ----------
  open(ui) { this.uis.push(ui); this.noTap = true; if (ui.enter) ui.enter(); },
  close() { const u = this.uis.pop(); if (u && u.exit) u.exit(); this.noTap = true; if (!this.uis.length) this.persist(); },
  slot() { try { return ADVS.check(STORE.get('advSave', null)); } catch { return null; } },
  persist() { if (!this.save || !this.ready) return; const r = this.room?.d.bld ? null : this.room, q = r ? { x: r.door.x, y: r.door.y + 30 } : this.p; this.save.pos = { x: Math.round(q.x), y: Math.round(q.y) }; STORE.set('advSave', this.save); },
  async saveFile(say) {
    this.persist();
    try {
      const txt = await ADVS.seal(this.save), name = ADVS.fileName(this.save), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      say('Saved ' + name);
    } catch (e) { say(e.message, true); }
  },
  loadFile(say) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.sav';
    i.onchange = async () => { const f = i.files[0]; if (f) this.loadText(await f.text(), say); };
    i.click();
  },
  async loadText(txt, say) { try { this.begin(await ADVS.open(txt)); } catch (e) { say(e.message); } },
  // a save was chosen: pick how to play it first (online, server list, friend, offline); loading a file in the middle of a game keeps the way you are playing
  begin(save) { if (this.save) this.go(save, this.want || { kind: 'off' }); else this.open(ADVUI.mode(this, save)); },
  // start (or restart) the world from a save
  go(save, want) {
    const W = window.ADV_WORLD; this.uis.forEach(u => u.exit && u.exit()); this.uis = []; B = null;
    this.save = ADV.save = ADV.player = save; ADVF.fix(save); ADV.reset(); ADV.setWorld(W); ADV.fallback = false; ADVW.reset(); ADVN.load(); this.dlg = this.sp = this.tr = this.bang = this.room = this.heal = this.warpTo = null;
    this.startNet(want); this.ready = false; this.mode = 'walk'; this.inB = false; this.msg = null; this.back = false; this.fadeT = 9; this.step = null; this.bHeld = 0; this.wh = null; this.cs = this.iu = null; this.itemCd = 0; this.inDoor = ''; this.flash = 0; this.late = null; this.mount = ''; this.lent = null; this.alt = 0; this.landing = false; this.running = false;
    const ow = this.ow = this.pickOW(), files = [ow.file]; this.key = this.leadKey();
    const sp = spriteOf(this.key); if (sp) for (const a of ['Walk', 'Idle']) if (sp.anims[a]) files.push(sp.anims[a].file);
    files.push(...assetSrcs({ arena: {}, player: { avatar: save.avatar, team: save.party }, cpu: { team: [] } }), ...ADVN.files(), ...ADVO.files());
    if (!save.sc) { if (save.pos) save.pos = { x: Math.round(save.pos.x * ADV.OUT), y: Math.round(save.pos.y * ADV.OUT) }; save.sc = ADV.OUT; }   // a save from before the 2x outdoor scale holds its spot in the old px
    const ws = W?.scale || 1; if ((save.ws || 1) !== ws) { const t = ADVS.town(save.last) || ADVS.town(save.home); if (t) save.pos = ADVS.front(t); save.waypoints = []; save.ws = ws; }   // plan B: the island was redrawn at another scale, so a spot (and a map waypoint) from the old one means nothing: wake at the last Center
    const at = new URLSearchParams(location.search).get('at')?.split(',').map(Number);
    const ts = ADV.ts(); if (ts && ts.file) files.push(ts.file); if (window.ADV_TILESET_INT) files.push(window.ADV_TILESET_INT.file);
    this.loaded = false; const me = this;
    preload(files).then(() => { if (SCENE !== me) return; const t = window.ADV_TILESET; if (t && t.file && !img(t.file)) ADV.fallback = true; me.loaded = true; });
    const qs = new URLSearchParams(location.search); for (const k of (qs.get('skills') || '').split(',')) if (ADVP.SKILLS[k]) save.skills[k] = 1;   // debug: ?skills=ride,fly grants a skill nobody teaches yet
    this.spawn(at ? { x: (at[0] + 0.5) * ADV.T, y: (at[1] + 0.5) * ADV.T } : save.pos || W.spawn); this.skillSync();
    this.cam = { x: this.p.x, y: this.p.y - 16 };
    ADV.stream(this.cx(), this.cy());
  },
  pickOW() { return this.owFor(this.save.avatar); },
  owFor(av) {
    const k = String(av || '').replace(/-lgpe$/, ''), O = window.TRAINER_OW || {}, id = [k, { chase: 'ethan', elaine: 'lyra' }[k], 'red'].find(i => O[i]);
    return O[id];
  },
  // the lead is the first healthy party mon; the follower trails it
  leadIdx() { const i = this.save.party.findIndex(m => !ADVP.fainted(m)); return Math.max(0, i); },
  leadKey() { return DEX.species[toId(this.save.party[this.leadIdx()].species)].sprite; },
  refreshLead() { this.key = this.leadKey(); this.warm(); },
  warm() { preload(assetSrcs({ arena: {}, player: { avatar: this.save.avatar, team: this.save.party }, cpu: { team: [] } })); },
  grow(ev, done) { this.refreshLead(); this.open(ADVUI.grow(this, ev, done)); },
  cx() { return Math.floor(this.cam.x / (ADV.Tp(this.cam.x) * ADV.CH)); },
  cy() { return Math.floor(this.cam.y / (ADV.Tp(this.cam.x) * ADV.CH)); },
  spawn(s) {
    const p = this.p = ADV.entity(s.x, s.y, 0);
    p.face = 0; p.walkD = 0; p.moving = false; p.placed = false;
    this.f = {}; this.folReset(p.x, p.y, 0, 0);
  },
  // (re)starts the follower a trail-length behind a spot, standing still and facing face
  folReset(x, y, z, face) {
    const D = ADVF.FD * ADV.Tp(x);
    this.trail = [{ x, y: y + D, z, sz: z, s: 0 }, { x, y, z, sz: z, s: D }];
    Object.assign(this.f, { x, y: y + D, z, sz: z, face, want: face, moving: false, animT: 0, at: 0, walkD: 0, vx: 0, vy: 0, sp: 0, loco: 'Idle', locoT: 0, turnT: 0, anim: 'Idle', beh: 'follow', bt: 0, idleT: 0, free: false, r: 6, hop: null, lv: 0, hopT: 0, plan: null, doing: '', lookT: 0, stall: 0 });
    this.back = false;
  },
  // Skills (save.skills): a surfer's entity walks on water (ADV.step), a cast line is dropped, the fight box goes back to treating water as a wall
  skillSync() { this.p.surf = !!this.save.skills?.surf; this.cast = null; ADV.swim = false; },
  // standing on open water at ground level (not on a bridge deck, not in a room)
  wet() { const p = this.p, T = ADV.Tp(p.x), c = Math.floor(p.x / T), r = Math.floor(p.y / T); return !this.room && p.lv === 0 && ADV.deck(c, r) < 0 && ADV.isWater(c, r); },
  // S2: the building the foot stands in (its interior shows through the fading exterior, adv-render.js cutaway); this.room says "indoors" for it too, as { id: the building id, door: { town }, d: { bld, mach } }. A legacy room map (other towns) is left alone.
  inside(dt) {
    const p = this.p, legacy = this.room && !this.room.d.bld, fly = this.mount === 'fly';
    ADV.cutTick(dt, legacy || fly ? null : p); if (legacy) return;
    const b = fly ? null : ADV.bldAt(p.x, p.y);
    if (!b) this.room = null; else if (this.room?.d.bld !== b) this.room = { id: b.id, door: { town: b.town }, d: { bld: b, mach: b.mach } };
  },
  // placed once the spawn chunk exists so the starting height is real
  place() {
    const p = this.p, T = ADV.Tp(p.x), c = Math.floor(p.x / T), r = Math.floor(p.y / T), h = ADV.h(c, r);
    if (h < 0) return false;
    p.lv = h; p.z = p.sz = ADV.heightAt(p.x, p.y, h); p.placed = true;
    this.trail[0].z = this.trail[1].z = this.f.z = p.z; this.trail[0].sz = this.trail[1].sz = this.f.sz = p.z;
    return true;
  },
  update(dt) {
    this.t += dt; ADVM.tick(dt);
    const c = !!KEYS.KeyC || !!INPUT.cur.ITEM; this.cHit = c && !this.cPrev; this.cPrev = c;   // ITEM: touch.js's BAG button
    const fk = !!KEYS.KeyF; this.fHit = fk && !this.fPrev; this.fPrev = fk;
    const vk = !!KEYS.KeyV, rk = !!KEYS.KeyR, gk = !!KEYS.KeyG; this.vHit = vk && !this.vPrev; this.vPrev = vk; this.rHit = rk && !this.rPrev; this.rPrev = rk; this.gHit = gk && !this.gPrev; this.gPrev = gk;
    const sk = !!KEYS.Space; this.spHit = sk && !this.spPrev; this.spPrev = sk;   // Space: the flap / buck press while mounted (adv-mount.js)
    this.dbgHit = ADVDBG.hit();   // F9: the test panel (src/adv-debug.js)
    const ui = this.uis[this.uis.length - 1];
    if (!this.save) { if (ui) ui.update(dt); return; }
    ADV.stream(this.cx(), this.cy(), this.mount === 'fly' && ADVR.zmW && ADVR.zmW <= 2 ? 2 : 1);   // a high flier sees past the 3 x 3 chunks round it
    if (this.ready) { if (this.mode !== 'battle' && this.mode !== 'pvp' && AUDIO.musicSrc) AUDIO.playMusic(null); ADVM.to(this.musicName()); }
    if (this.fadeT < 2) { this.fadeT += dt * (this.mode === 'warp' ? 2.5 : 1); if (this.mode === 'fade' && this.fadeT >= 1) this.blackout(); if (this.mode === 'warp' && this.fadeT >= 1 && this.warpTo) this.doWarp(); }
    if (this.mode === 'warp') this.walkThrough(dt);
    if (!this.ready) {
      const sk = ADV.key(Math.floor(this.p.x / (ADV.Tp(this.p.x) * ADV.CH)), Math.floor(this.p.y / (ADV.Tp(this.p.x) * ADV.CH)));
      if (ADV.missing[sk]) this.err = 'Missing world data';
      if (this.loaded && ADV.chunks.has(sk) && this.place()) { this.ready = true; this.px = this.p.x; this.py = this.p.y; this.cam = { x: this.p.x, y: this.p.y - this.p.z - 16 }; ADVW.fill(this.p, this.view()); if (this.late) { const l = this.late; this.late = null; this.grow(l); } else if (!this.save.intro && !this.net?.N?.online) this.intro(); }
      return;
    }
    const en = !!KEYS.Enter; this.enterHit = en && !this.enterPrev; this.enterPrev = en;
    this.inside(dt); this.netStep(dt);
    if (this.typing) return;
    const padB = INPUT.cur.B;
    if (padB) this.bHeld += dt;
    const tapB = INPUT.released('B') && this.bHeld < 0.25 && !this.noTap;
    if (!padB) { this.bHeld = 0; this.noTap = false; }
    if (ui) { ui.update(dt); return; }
    const p = this.p;
    ADV.update(p, dt);
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (this.flash > 0) this.flash -= dt;
    if (this.itemCd > 0) this.itemCd -= dt;
    if (this.mode === 'battle') { this.battleStep(dt); return; }
    if (this.mode === 'pvp') { this.pvpStep(dt); return; }
    if (this.mode === 'fade' || this.mode === 'warp') return;
    if (this.mode === 'fish') { this.fishStep(dt); return; }
    if (this.mode === 'talk' || this.mode === 'spot' || this.mode === 'heal') { this.peopleStep(dt); return; }
    const zd = window.TOUCH?.on ? 0 : MOUSE.wheel ? (MOUSE.wheel < 0 ? 1 : -1) : (INPUT.hit('RB') ? 1 : 0) - (INPUT.hit('LB') ? 1 : 0); if (zd) ADVR.zoomBy(zd);   // mouse wheel / shoulders: overworld zoom tiers 1-6 (Farthest to Closest)
    if (this.skipStart) this.skipStart = false;
    else if (INPUT.hit('START') || (INPUT.hit('BACKK') && !padB) || tapB) { this.open(ADVUI.pause(this)); return; }
    else if (this.dbgHit) { this.open(ADVDBG.panel(this)); return; }
    if (this.enterHit && this.chatOn() && !this.dlg) return this.openChat();
    if (typeof ADVMAP !== 'undefined' && ADVMAP.hit(this)) return;   // M: the world map (src/adv-map.js)
    if ((this.fHit || INPUT.hit('X')) && !p.hop && !this.room) return this.fish();
    ADV.swim = p.surf && this.wet();
    if (this.mount) this.mountStep(dt);
    if (this.vHit || this.rHit || this.gHit || INPUT.hit('BACK')) { const no = this.mountKey(this.vHit ? 'bike' : this.rHit ? 'ride' : this.gHit ? 'fly' : ''); if (no) this.msg = { s: no, t: 2.5 }; }
    let mx = (INPUT.held('RIGHT') ? 1 : 0) - (INPUT.held('LEFT') ? 1 : 0), my = (INPUT.held('DOWN') ? 1 : 0) - (INPUT.held('UP') ? 1 : 0);
    if (!mx) mx = INPUT.mx; if (!my) my = INPUT.my;
    let ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; ml = 1; }   // diagonals are unit length: ml stays the stick fraction, never the pre-normalised length
    const run = KEYS.ShiftLeft || KEYS.ShiftRight || this.bHeld > 0.25, mt = this.mountSpeed(), mat = ADV.palette[ADV.mat(Math.floor(p.x / ADV.Tp(p.x)), Math.floor(p.y / ADV.Tp(p.x)))];
    const gnd = mat === 'ford' && !p.hop ? 0.55 : this.mount === 'fly' ? 1 : ADVP.ground(mat, this.mount === 'ride' ? ADVP.rideKnown(this.save, this.save.party[this.leadIdx()]) : []);   // wading a ford is slow; deep snow, sand and rough ground slow everyone but a mount trained for it
    const sp = ADVP.pace(run, mt) * Math.min(1, ml) * gnd;
    this.running = mt > 0 || run;
    p.moving = false;
    const act = this.spHit || INPUT.hit('A');   // flight and riding have momentum and the timing meter (src/adv-mount.js)
    if (this.mount === 'fly') ADVMT.flyStep(this, dt, mx, my, ml, act);
    else if ((this.mount === 'ride' || this.mount === 'lent') && mt > 0) ADVMT.rideStep(this, dt, mx, my, ml, act, mt * gnd);
    else if (!p.hop && ml > 0.1) {
      const x0 = p.x, y0 = p.y;
      p.face = dirFromVec(mx, my);
      if (this.mount === 'fly') { if (!this.landing) this.flyMove((mx / (ml || 1)) * sp * dt, (my / (ml || 1)) * sp * dt); } else ADV.move(p, (mx / (ml || 1)) * sp * dt, (my / (ml || 1)) * sp * dt);
      const d = Math.hypot(p.x - x0, p.y - y0); p.walkD += d; p.moving = d > 0.01;
    }
    if (p.hop) { p.moving = true; p.walkD += 100 * dt; }
    this.follow(dt);
    if (this.mount === 'fly') { this.px = p.x; this.py = p.y; this.camStep(dt); return; }   // in the air: no doors, no talking, nothing touches you
    const town = ADVS.inTown(p.x, p.y); if (town) { if (town !== this.save.last) ADVF.note(this.save, 'town', { town: ADVS.town(town).name }); this.save.last = town; }
    const rm = this.room?.d.bld ? null : this.room?.d, pc = Math.floor(p.x / ADV.Tp(p.x)), pr = Math.floor(p.y / ADV.Tp(p.x)), ex = rm && (rm.exits || [rm.exit]).find(e => pc >= e.c0 && pc <= e.c1 && pr >= (e.r0 ?? e.r) && pr <= (e.r1 ?? e.r));
    if (ex && !p.hop) { const dr = ADV.doorFor(this.room.id, ex.end); return this.warp({ x: dr.x, y: dr.y + 30 }); }   // stepping onto a cave exit leaves, just below the mouth it is at (the cave has two)
    const rd = !this.room && ADV.doorAt(p.x, p.y), door = !this.room && !rd && ADVS.atDoor(p.x, p.y); // pushing up into a door enters its room; towns without rooms still heal at the Center door
    if (!rd && !door) this.inDoor = ''; else if (!this.inDoor && my < -0.3 && !p.hop) { this.inDoor = rd ? rd.room : door; if (rd) return this.warp(rd); this.center(door); }
    let pop = null;
    if (!this.room) pop = ADVW.grass(p, p.moving ? Math.hypot(p.x - this.px, p.y - this.py) : 0);
    this.px = p.x; this.py = p.y;
    if (pop) { pop.g.local = true; return this.startFight(pop); }   // an ambush out of the grass is yours alone
    if (!this.room || this.room.d.live) this.touch();   // wild mons live in the cave too
    if (this.mode === 'walk') this.people(dt);
    this.camStep(dt);
  },
  // The camera is LOCKED to the player's whole-px position (the rounding drawOW / drawMonSprite use), so the player never moves against the screen.
  // Only a jump of the target (a deck, coming back from a fight) leaves an offset, and that offset eases out in whole px. camStep(1) snaps.
  camStep(dt) {
    const p = this.p, c = this.cam, k = 1 - Math.pow(0.0005, dt), b = this.room?.d.box, z = ADVR.zoomFor(), zz = p.hop ? p.sz : p.z;
    const A = ADVR.ART, q = v => ADVR.q(v);   // the camera moves in whole art px, the grid the world canvas is drawn on
    let tx = q(p.x), ty = q(p.y) - q(zz) - q(ADVMT.vis(this.alt)) - 16;   // a flier is centred where it is drawn
    if (b) { const cl = (v, a, e, h) => e - a <= 2 * h ? (a + e) / 2 : Math.max(a + h, Math.min(e - h, v)); tx = q(cl(tx, b[0], b[2], VW / 2 / z)); ty = q(cl(ty, b[1], b[3], VH / 2 / z)); }   // a room smaller than the view sits centred
    const ease = (cur, old, t) => { let o = k > 0.99 ? 0 : q(cur - (old ?? t)); if (o) { const n = q(o * (1 - k)); o = n === o ? o - Math.sign(o) * A : n; } return t + o; };
    c.x = ease(c.x, c.tx, tx); c.y = ease(c.y, c.ty, ty); c.tx = tx; c.ty = ty;
  },
  // ---------- online (adv-net.js core, adv-peer.js adapter; offline is the same core as a host nobody can reach) ----------
  profile() { const s = this.save, m = s.party[this.leadIdx()]; return { name: s.name, av: s.avatar, lead: m ? toId(m.species) : '', b: s.badges | 0, o: ADVO.arr(ADVO.clean(s.outfit)) }; },
  startNet(want) {
    this.stopNet(); this.want = want = want || { kind: 'off' }; this.log = []; this.tst = null; this.rem = new Map();
    this.net = ADVPEER.start(want, { profile: () => this.profile(), onEvent: e => this.netEvent(e), onSwap: N => this.netSwap(N) });
  },
  stopNet() { if (this.net) this.net.stop(); this.net = null; ADVW.clock = null; ADVW.mirror = false; ADV.more = []; },
  // the server was joined or opened: its world replaces the local one
  netSwap(N) {
    ADVW.groups = []; ADVW.fx = []; this.msg = { s: N.role === 'host' ? 'You opened ' + N.name : 'Joined ' + N.name, t: 3 };
    if (this.ready) ADVW.fill(this.p, this.view());
  },
  toast(s, t = 3) { this.tst = { s, t }; },
  chatOn() { return !!(this.net && this.net.N.online); },
  netEvent(e) {
    const N = this.net && this.net.N, k = e.k, idle = this.mode === 'walk' && !this.uis.length && !this.dlg;
    if (k === 'chat') { this.log.push({ s: e.name + ': ' + e.s, t: this.t }); if (this.log.length > 8) this.log.shift(); }
    else if (k === 'join') this.toast(e.name + ' joined');
    else if (k === 'left') this.toast((e.name || 'A player') + ' left');
    else if (k === 'lost') this.toast('The host is gone, finding a new one...', 4);
    else if (k === 'role') { if (e.role === 'host') this.toast('You are the host now', 4); }
    else if (k === 'merge') this.toast('Two servers found each other, joining the bigger one...', 4);
    else if (k === 'netfail' || k === 'denied') this.toast((e.why || 'Could not connect') + ' Playing offline.', 6);
    else if (k === 'tradeAsk') idle ? this.open(ADVUI.ask(this, e.name + ' wants to trade. Accept?', () => N.trade.reply(true), () => N.trade.reply(false))) : N.trade.reply(false);
    else if (k === 'tradeOpen') { if (!this.uis.some(u => u.isTrade)) this.open(ADVUI.trade(this)); }
    else if (k === 'tradeDone') {
      const sv = this.save, m = e.mon; m.hp = Math.min(m.hp, ADVP.max(m)); sv.party[e.idx] = m; this.refreshLead(); this.persist();
      while (this.uis.length && this.uis[this.uis.length - 1].isTrade) this.close();
      this.msg = { s: 'Trade complete! ' + ADVP.name(m) + ' joined your party. Game saved.', t: 4 };
    }
    else if (k === 'pvpAsk') idle ? this.open(ADVUI.ask(this, e.name + ' challenges you to a battle. Accept?', () => N.pvp.reply(true, this.pvTeam()), () => N.pvp.reply(false))) : N.pvp.reply(false);
    else if (k === 'pvpGo') this.pvpBegin(true, e);
    else if (k === 'pvpStart') this.pvpBegin(false, e);
    else if (k === 'pvpEnd') { if (this.pv) this.pvEnd('The match ended.'); else this.toast('Challenge ' + e.why); }
    else if (k === 'directEnd') {
      while (this.uis.length && this.uis[this.uis.length - 1].isTrade) this.close();
      if (this.pv) this.pvEnd('The match ended.'); else this.toast('Trade ' + e.why);
    }
  },
  netStep(dt) {
    const n = this.net; if (!n) return;
    const N = n.N, p = this.p, mv = p.moving ? (this.running ? 2 : 1) : 0, busy = this.mode !== 'walk' || !!this.uis.length || !!this.dlg;
    N.local({ x: p.x, y: p.y, z: p.z, face: p.face, mv, room: this.room ? this.room.id : 0, b: this.save.badges | 0, busy, view: this.view(), ent: p });
    N.tick(dt); N.world(dt);
    if (this.tst && (this.tst.t -= dt) <= 0) this.tst = null;
  },
  // the host says the wild fight is over: who is gone for good, what goes back into the world
  endClaim(result, dead) {
    const w = this.w; this.w = null; if (!this.net) return;
    if (w) { this.net.N.bend(w, result, dead); if (w.g.local) w.g.m.slice().forEach(m => ADVW.kill(m)); }
    this.net.N.bv([]);
  },
  // Enter opens the chat line (80 characters), Enter sends, Esc cancels
  openChat() {
    if (this.typing) return; this.typing = { s: '' };
    this.kf = e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { const s = this.typing.s.trim(); this.closeChat(); if (s && this.net) this.net.N.say(s); }
      else if (e.key === 'Escape') this.closeChat();
      else if (e.key === 'Backspace') this.typing.s = this.typing.s.slice(0, -1);
      else if (e.key.length === 1 && this.typing.s.length < 80) this.typing.s += e.key;
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', this.kf, true);
  },
  closeChat() { if (this.kf) window.removeEventListener('keydown', this.kf, true); this.kf = null; this.typing = null; this.skipStart = true; this.noTap = true; this.enterPrev = true; },
  // A / E facing another player: the player menu; near somebody else's fight: co-op is not built yet
  playerAct() {
    const n = this.net; if (!n || this.room && !n.N.vis.size) return;
    const v = n.N.target(this.p);
    if (v) this.open(ADVUI.player(this, v)); else if (n.N.fightNear(this.p)) this.msg = { s: 'Co-op joining comes later', t: 2.5 };
  },
  tradeAsk(v) { if (this.net.N.trade.ask(v.pid)) this.toast('Trade request sent...', 5); else this.toast('They are busy.'); },
  pvTeam() { return this.save.party.map(m => ({ species: m.species, level: m.level, moves: m.moves, ability: m.ability, item: m.item, nature: m.nature, ot: m.ot })); },
  pvpAsk(v) { if (this.mode === 'walk' && this.net.N.pvp.ask(v.pid, this.pvTeam())) this.toast('Challenge sent...', 5); else this.toast('They are busy.'); },
  // ---------- PvP: a direct link between the two, the arena netcode (netsync.js) over it, in the W1a world box around them; nothing is won or lost ----------
  pvpBegin(host, e) {
    const N = this.net.N, pv = N.pv, f = this.f, T = ADV.Tp(f.x); if (!pv) return;
    const o = N.vis.get(pv.pid), r = N.roster.get(pv.pid) || {}; let a, b, lv, at;
    if (host) {
      if (!o || this.mode !== 'walk' || this.room) { N.pvp.end(); return this.toast('Too far away to battle.'); }
      a = { x: f.x, y: f.y }; b = { x: o.fx, y: o.fy }; lv = Math.round(f.z / T);
      if (Math.hypot(a.x - b.x, a.y - b.y) > 18 * T || Math.abs(o.z - f.z) > 8) { N.pvp.end(); return this.toast('Too far away to battle.'); }
      const ar = ADVB.box(a, b, lv); at = [ar.col, ar.row];
      N.pvp.start({ box: at, lv, a: [Math.round(a.x), Math.round(a.y)], b: [Math.round(b.x), Math.round(b.y)] });
    } else {
      const m = e.m, num = v => (Number.isFinite(v) ? v : 0);
      if (this.mode !== 'walk' || !Array.isArray(m.a) || !Array.isArray(m.b) || !Array.isArray(m.box)) { N.pvp.end(); return; }
      a = { x: num(m.a[0]), y: num(m.a[1]) }; b = { x: num(m.b[0]), y: num(m.b[1]) }; lv = num(m.lv) | 0; at = [num(m.box[0]) | 0, num(m.box[1]) | 0];
    }
    const ar = ADVB.box(a, b, lv, at), mine = { name: this.save.name, avatar: this.save.avatar, team: this.pvTeam() }, theirs = { name: r.name || 'Rival', avatar: cleanAvatar(r.av) || AVATAR_DEFAULT, team: pv.team };
    const cfg = host ? { arena: ar, weather: '', player: mine, cpu: { ...theirs, remote: true } } : { arena: ar, weather: '', player: theirs, cpu: mine, me: 1, guest: true };
    ar.extra = () => [{ x: this.p.x, y: this.p.y, z: this.p.z, f: () => { this.drawPlayer(); this.drawBusy(); } }, ...this.remoteItems()];
    this.nsOld = { send: NETSYNC.send, sendFast: NETSYNC.sendFast, backlog: NETSYNC.backlog, ctlBacklog: NETSYNC.ctlBacklog };
    NETSYNC.send = m => N.sendPv(m); NETSYNC.sendFast = m => N.sendPv(m, true); NETSYNC.backlog = NETSYNC.ctlBacklog = () => 0;
    N.onPv = (from, m) => this.pvRecv(m);
    this.pv = { host, cfg, ar, lv, oppPid: pv.pid, st: 'load', gready: !host, wt: 0 }; this.mode = 'pvp'; this.wh = this.cs = null;
    const me = this.pv; this.p.moving = false; this.p.face = dirFromVec((a.x + b.x) / 2 - this.p.x, (a.y + b.y) / 2 - this.p.y);
    preload(assetSrcs(cfg)).then(() => {
      if (this.pv !== me) return;
      if (host) { startBattleA(cfg); NETSYNC.begin(); } else { NETSYNC.reset(); startBattleA(cfg); N.sendPv({ t: 'ready' }); }
      Object.assign(B.cam, { x: this.cam.x - ar.ox, y: this.cam.y - ar.oy + lv * ar.T, z: ADVR.battleZoom() });
      me.st = 'run'; this.inB = true;
    });
  },
  pvRecv(m) {
    const pv = this.pv; if (!pv || !m) return;
    if (pv.host) {
      if (m.t === 'ready') pv.gready = true;
      else if (m.t === 'in') NETSYNC.onInput(m); else if (m.t === 'act') NETSYNC.onPress(m);
      else if (m.t === 'pick' && B && B.choose && B.sides[B.choose.side].remote) { B.choose.sel = clamp(m.sel | 0, 0, 5); confirmChoose(); }
    } else if (B && B.guest) { if (m.t === 's') NETSYNC.apply(m); else if (m.t === 'teams') NETSYNC.applyTeams(m); else if (m.t === 'fx') NETSYNC.applyFx(m); }
  },
  pvpStep(dt) {
    const pv = this.pv; if (!pv) return; if (pv.st !== 'run') return;
    const ar = pv.ar, mi = meIdx();
    if (pv.host) {
      if (!pv.gready) { if ((pv.wt += dt) > 60) this.pvEnd('Your opponent could not load the match.'); return; }
      updateBattle(dt); NETSYNC.harvest(); NETSYNC.hostTick(dt);
    } else NETSYNC.guestTick(dt);
    if (!this.pv) return;
    if (B.choose && B.choose.side === mi) {
      const c = B.choose, side = B.sides[c.side], n = side.team.length;
      if (INPUT.menu === 'right' || INPUT.menu === 'down') { do c.sel = (c.sel + 1) % n; while (side.team[c.sel].fainted); uiBlip(600, 0.03); }
      if (INPUT.menu === 'left' || INPUT.menu === 'up') { do c.sel = (c.sel + n - 1) % n; while (side.team[c.sel].fainted); uiBlip(600, 0.03); }
      if (okHit()) confirmChoose();
    }
    this.cam.x = ar.ox + B.cam.x; this.cam.y = ar.oy + B.cam.y - ar.lv * ar.T;
    if (pv.host) this.bvTick(dt);
    if (B.over && B.endT > 2.2) this.pvEnd('');
  },
  pvEnd(msg) {
    const pv = this.pv; if (!pv) return; this.pv = null;
    const N = this.net.N, won = B && B.over && B.winner === meIdx(); NETSYNC.end(); Object.assign(NETSYNC, this.nsOld);
    N.onPv = null; N.pvp.end(); N.bv([]); B = null; this.inB = false; this.mode = 'walk';
    this.msg = { s: msg || (won ? 'You won the match!' : 'You lost the match.'), t: 3.5 };
  },
  // others see a fight through the mons in it: what is on the field at 8 Hz (the host relays it to everyone within 60 tiles)
  bvTick(dt) {
    if (!this.net || (this.bvT = (this.bvT || 0) + dt) < 0.125) return; this.bvT = 0;
    const ar = B.arena, T = ar.T, out = [];
    B.sides.forEach(s => { const e = s.ent, m = s.team[s.cur]; if (m && !m.fainted && !(e.hidden > 0)) out.push([m.sp.id, Math.round(ar.ox + e.x), Math.round(ar.oy + e.y), Math.round(ar.lv * T + (e.z || 0)), e.face & 7, Math.max(0, ANIMS.indexOf(e.anim)), Math.round(100 * m.hp / m.maxHp)]); });
    for (const w of this.q || []) if (w.st === 'wait' && w.id && !w.dead) out.push([w.id, Math.round(w.e.x), Math.round(w.e.y), Math.round(w.e.z), w.face & 7, w.moving ? 1 : 0, 100]);
    this.net.N.bv(out);
  },
  warmRemote(r, ow) {
    const k = r.av + '|' + r.lead; if (this.rem.has(k)) return; this.rem.set(k, 1);
    const files = ow.cv ? [] : [ow.file], sp = spriteOf(DEX.species[r.lead]?.sprite); if (sp) for (const a of ['Walk', 'Idle']) if (sp.anims[a]) files.push(sp.anims[a].file);
    preload(files);
  },
  // the other players in view (with their lead mon behind them, a name tag and a chat bubble), and the mons of fights around you
  remoteItems() {
    const n = this.net, N = n && n.N; if (!N || !this.ready) return [];
    const out = [], cx = this.cam.x, cy = this.cam.y, opp = this.pv && this.pv.oppPid;
    for (const v of N.vis.values()) {
      if (Math.abs(v.x - cx) > 700 || Math.abs(v.y - cy) > 600) continue;
      const r = N.roster.get(v.pid), ow = r && ((r.o && r.o.length && ADVO.sheet(ADVO.obj(r.o))) || this.owFor(r.av)); if (!ow) continue;
      this.warmRemote(r, ow);
      out.push({ x: v.x, y: v.y, z: v.z, f: () => { this.drawOW(ow, v.face, v.mv > 0, v.walkD, { x: v.x, y: v.y, z: v.z, sz: v.z }); this.tag(r.name, v.x, v.y - v.z - 66); const b = N.bubbles.get(v.pid); if (b) this.drawBubble(v, b.s); } });
      const key = DEX.species[r.lead]?.sprite;
      if (key) out.push({ x: v.fx, y: v.fy, z: v.fz, f: () => { ADVR.shadow(ctx, v.fx, v.fy - v.fz, 10, 4); drawMonSprite(key, v.mv ? 'Walk' : 'Idle', this.t, v.face, v.fx, v.fy, { z: v.fz }); } });
    }
    for (const [pid, fv] of N.fights) {
      if (pid === opp) continue;
      for (const m of fv.mons) {
        const sp = DEX.species[m[0]]; if (!sp || Math.abs(m[1] - cx) > 700 || Math.abs(m[2] - cy) > 600) continue;
        out.push({ x: m[1], y: m[2], z: m[3], f: () => {
          ADVR.shadow(ctx, m[1], m[2] - m[3], 10, 4); drawMonSprite(sp.sprite, ANIMS[m[5]] || 'Idle', this.t, m[4], m[1], m[2], { z: m[3], loop: true });
          const y = Math.round(m[2] - m[3] - 52); ctx.fillStyle = '#000'; ctx.fillRect(m[1] - 15, y, 30, 5); ctx.fillStyle = m[6] > 50 ? '#4cd964' : m[6] > 20 ? '#ffcc00' : '#ff3b30'; ctx.fillRect(m[1] - 14, y + 1, Math.round(28 * m[6] / 100), 3);
        } });
      }
    }
    return out;
  },
  // world-space text above a head: small, drawn into the world canvas (1 px = 1 world px)
  tag(s, x, y) { x = Math.round(x); y = Math.round(y); text(s, x + 1, y + 1, 8, '#000', 'center', null, 'Silkscreen'); text(s, x, y, 8, '#fff', 'center', null, 'Silkscreen'); },
  drawBubble(e, s) {
    const g = ctx; g.font = '8px Bungee, "Arial Black", sans-serif';
    const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > 110 && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    const w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + 10, h = lines.length * 11 + 6, x = Math.round(e.x), y = Math.round(e.y - (e.z || 0) - 76);
    rrect(x - w / 2, y - h, w, h, 3, '#fffffff2', '#222', 1);
    g.fillStyle = '#fffffff2'; g.beginPath(); g.moveTo(x - 3, y - 0.5); g.lineTo(x + 3, y - 0.5); g.lineTo(x, y + 4); g.closePath(); g.fill();
    lines.forEach((l, i) => text(l, x, y - h + 9 + i * 11, 8, '#111', 'center', null));
  },
  // screen-space: server line, chat log, the chat field, notices
  drawNet() {
    const n = this.net; if (!n || !this.save) return;
    const N = n.N, { X, Y, L } = layout(), s = S();
    const st = n.status || (N.online ? `${N.role === 'host' ? 'HOST' : 'GUEST'}   ${N.name}   ${N.count()}/16` + (N.role === 'guest' ? `   ${Math.round(N.ping)} ms` : '') : n.mode !== 'off' ? 'OFFLINE' : '');
    if (st) { ctx.font = `${12 * s}px Silkscreen`; const w = ctx.measureText(st).width + 24 * s; rrect(8 * s, 8 * s, w, 26 * s, 8 * s, '#000a'); text(st, 20 * s, 22 * s, 12 * s, N.online ? '#7be07b' : '#ffde3b', 'left', null, 'Silkscreen'); }
    this.log.forEach((l, i) => {
      const age = this.t - l.t; if (age > 11) return;
      ctx.globalAlpha = age < 8 ? 1 : 1 - (age - 8) / 3; text(l.s, 14 * s, VH - (70 + (this.log.length - 1 - i) * 22) * s, 14 * s, '#fff', 'left', '#000', 'Bungee'); ctx.globalAlpha = 1;
    });
    if (this.typing) {
      rrect(14 * s, VH - 56 * s, Math.min(VW - 28 * s, 640 * s), 38 * s, 10 * s, '#000c', '#ffde3b', 2);
      text('> ' + this.typing.s + (Math.floor(performance.now() / 450) % 2 ? '_' : ''), 28 * s, VH - 36 * s, 16 * s, '#fff', 'left', null);
      text(`${this.typing.s.length}/80`, Math.min(VW - 42 * s, 640 * s - 4 * s), VH - 36 * s, 11 * s, '#9aa6c0', 'right', null, 'Silkscreen');
    }
    if (this.tst) ADVUI.notice(this.tst.s, this.msg && !this.dlg && !this.uis.length ? 1 : 0);
  },

  // ---------- people (S1a) ----------
  talkHit() { if (this.mount && this.mount !== 'bike') return INPUT.hit('M4'); return (okHit() && !(this.chatOn() && KEYS.Enter)) || INPUT.hit('M4'); },
  // walking: NPCs move and push the player out of their circle, a trainer that sees you spots you, A / E talks to the one in front
  people(dt) {
    const p = this.p; ADVN.update(dt, p); ADVN.push(p);
    if (p.hop || !this.loaded) return;
    const n = ADVN.spot(p); if (n) return this.spotted(n);
    if (this.talkHit()) { const t = ADVN.target(p); if (t) this.talk(t); else if (this.folNear()) this.talkFollower(); else this.playerAct(); }
  },
  // while talking or spotted the world idles and the dialogue / approach runs
  peopleStep(dt) {
    const p = this.p; p.moving = false; this.follow(dt); ADVN.update(dt, p);
    if (this.mode === 'talk') this.talkStep(dt); else if (this.mode === 'heal') this.healStep(dt); else this.spotStep(dt);
    this.camStep(dt);
  },
  talk(n) {
    const e = n.e, p = this.p;
    const t = n.def.trainer;
    if (t && !ADVN.beaten(n)) {   // not beaten yet: talking to a trainer is a challenge (a leader wants her ranch hands beaten first)
      if (t.after && !t.after.every(id => this.save.beat[id])) { n.busy = true; n.face = dirFromVec(p.x - e.x, p.y - e.y); p.face = dirFromVec(e.x - p.x, e.y - p.y); p.moving = false; return this.dialog(t.wait, n); }
      return this.spotted(n);
    }
    n.busy = true; n.face = dirFromVec(p.x - e.x, p.y - e.y); p.face = dirFromVec(e.x - p.x, e.y - p.y); p.moving = false;
    if (n.def.script) return this.script(n);
    this.dialog(n.def.lines, n);
  },
  // ---------- fishing (Skills): face water, F casts the rod, the zone's fishing table decides the bite ----------
  fish() {
    const p = this.p, sv = this.save, T = ADV.Tp(p.x), v = DIR_VEC[p.face], no = s => { this.msg = { s, t: 2.5 }; };
    if (this.mount) return no('Get off first.');
    if (!sv.skills.fishing || !sv.bag.fishingrod) return no(sv.skills.fishing ? 'You have no Fishing Rod.' : 'Someone has to teach you to fish first.');
    if (this.wet()) return no('You cannot fish from the water.');
    if (ADV.deck(Math.floor(p.x / T), Math.floor(p.y / T)) >= 0) return no('Fish from the shore.');
    let tx = 0, ty = 0;
    for (const k of [0.8, 1.4, 2]) { const x = p.x + v[0] * k * T, y = p.y + v[1] * k * T; if (ADV.isWater(Math.floor(x / T), Math.floor(y / T))) { tx = x; ty = y; break; } }
    if (!tx) return no('There is no water to fish in here.');
    const ro = ADVW.fishRoll(ADVW.zone(p.x, p.y)); if (!ro) return no('Nothing bites here.');
    ADVW.load && ADVW.load(ro.id);   // the fish is warmed up while the line is out
    p.moving = false; this.cast = { ro, tx, ty, t: 0, wait: 1.6 + Math.random() * 2.2, ph: 'wait' }; this.mode = 'fish'; uiBlip(520, 0.04);
  },
  fishStep(dt) {
    const p = this.p, c = this.cast; p.moving = false; this.follow(dt); ADVN.update(dt, p); c.t += dt; ADVW.update(dt, p, 'battle');
    if (c.ph === 'wait' && (INPUT.hit('B') || INPUT.hit('BACKK') || KEYS_HIT.Escape)) { this.cast = null; this.mode = 'walk'; this.msg = { s: 'You reeled the line in.', t: 2 }; return; }
    if (c.ph === 'wait' && c.t >= c.wait) { c.ph = 'bite'; c.t = 0; uiBlip(880, 0.06); }
    else if (c.ph === 'bite' && c.t >= 0.9) {
      this.cast = null; this.mode = 'walk';
      const w = ADVW.fishMake(p, c.ro, c.tx, c.ty); if (!w) return void (this.msg = { s: 'It got away...', t: 2.5 });
      this.startFight(w);
    }
    this.camStep(dt);
  },
  // the line from the rod tip to the bobber, the bobber riding ripples; it dips when something bites
  castItems() {
    const c = this.cast; if (!c) return [];
    return [{ x: c.tx, y: c.ty, z: 0, f: () => {
      const g = ctx, p = this.p, x = Math.round(c.tx), bite = c.ph === 'bite', dip = bite ? Math.round(Math.sin(c.t * 38) * 2 + 2) : Math.round(Math.sin(this.t * 3));
      const y = Math.round(c.ty) + dip, hx = Math.round(p.x + DIR_VEC[p.face][0] * 12), hy = Math.round(p.y - p.z - 30);
      g.strokeStyle = '#f2f2f2'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo((hx + x) / 2, Math.min(hy, y) - 6, x, y - 2); g.stroke();
      g.strokeStyle = '#ffffff90'; for (let i = 0; i < 2; i++) { const r = 4 + ((this.t * 9 + i * 5) % 10); g.beginPath(); g.ellipse(x, Math.round(c.ty) + 2, r, r * 0.45, 0, 0, 6.283); g.stroke(); }
      g.fillStyle = '#fff'; g.fillRect(x - 2, y - 3, 5, 3); g.fillStyle = '#e03030'; g.fillRect(x - 2, y - 6, 5, 3); g.fillStyle = '#000'; g.fillRect(x - 2, y, 5, 1);
    } }, ...(c.ph === 'bite' ? [{ x: this.p.x, y: this.p.y + 2, z: this.p.z, f: () => this.drawFx({ k: '!', t: c.t }, this.p) }] : [])];
  },
  // people with a job: the nurse heals (a short ball animation on the machine), the clerk opens the shop, the PC opens the box
  script(n) {
    const s = n.def.script;
    if (s === 'nurse') return this.dialog(['Welcome to our Pokemon Center!', 'Let me take your Pokemon and heal them up.'], n, () => { this.heal = { t: 0, n }; this.mode = 'heal'; });
    if (s === 'clerk') return this.dialog(n.def.market ? n.def.lines : ['Welcome! How may I help you?'], n, () => this.open(ADVUI.shop(this, !!n.def.market)));   // market: the Tradeway trader, rare stock that changes by the day
    if (s === 'barter') return this.dialog(n.def.lines, n, () => this.open(ADVUI.barter(this)));
    if (s === 'pc') return this.dialog(['You booted up the PC.'], n, () => this.open(ADVUI.box(this)));
    if (s === 'class' || s === 'coach') return this.lessonTalk(n);
    if (s === 'rent') return this.dialog(n.def.lines, n, () => this.open(ADVUI.ask(this, 'Rent a supply mount for ' + ADVUI.money(ADVP.SUPPLY_FEE) + '?', () => this.rent(), () => {})));
    if (s === 'teach') {   // a Skill teacher: the offer, then the skill (and the rod with fishing); once known she only chats
      const sv = this.save, id = n.def.skill; if (sv.skills[id]) return this.dialog(n.def.known, n);
      return this.dialog(n.def.lines, n, () => { const pg = ADVP.teach(sv, id); this.skillSync(); this.persist(); uiBlip(880, 0.05); this.dialog(pg, n); });
    }
  },
  healStep(dt) {
    const h = this.heal; h.t += dt; if (h.t < 3.4) return;
    const sv = this.save; sv.party.forEach(m => ADVP.heal(m)); sv.last = this.room?.door.town || sv.last; ADVF.note(sv, 'heal'); this.flash = 0.5; uiBlip(880, 0.05); this.heal = null; this.mode = 'walk'; this.persist();
    this.dialog(['Thank you for waiting. Your Pokemon are fully healed!', 'We hope to see you again!'], h.n);
  },
  // the party's balls sit on the machine and light up one by one
  drawHeal() {
    const h = this.heal, m = this.room.d.mach, n = this.save.party.length; if (!h || !m) return;
    for (let i = 0; i < n; i++) {
      const x = Math.round(m.x - (n - 1) * 7 + i * 14), y = Math.round(m.y - 98), lit = h.t > 0.5 + i * 0.35, g = ctx;
      ADVUI.icon('pokeball', x, y, 6);
      if (lit) { g.fillStyle = Math.floor(h.t * 8) % 2 ? '#fff6a8' : '#ffd84a'; g.fillRect(x - 1, y - 11, 3, 3); g.fillRect(x - 6, y - 8, 2, 2); g.fillRect(x + 5, y - 8, 2, 2); }
    }
  },
  // ---------- doors (S1b) ----------
  // fade out, switch, fade in: to = { room, x, y } (a world door: enter it) or { x, y } (leave to that world spot)
  // A cave mouth is walked through, not cut to: you keep stepping on into the dark while the world fades out round you (an iris that closes on you,
  // drawn in draw()), and on the far side you take the last steps in while the new place fades in round you. Input waits until the step is done.
  warp(to) { this.warpTo = to; this.mode = 'warp'; this.fadeT = 0; const walk = !!(to.room || this.room); this.iris = walk; this.thru = walk ? { d: DIR_VEC[this.p.face] || [0, -1], from: null } : null; uiBlip(520, 0.04); },
  walkThrough(dt) {
    const p = this.p, t = this.thru; if (!t) return;
    const D = ADV.Tp(p.x) * 0.6, [vx, vy] = t.d;   // the walk on each side of the door: 0.6 of a tile, over the 0.4 s of each half of the fade
    if (this.fadeT < 1) { const k = this.fadeT; p.x = (t.from ||= { x: p.x, y: p.y }).x + vx * D * k; p.y = t.from.y + vy * D * k; }
    else { const k = Math.min(1, this.fadeT - 1); p.x = t.to.x - vx * D * (1 - k); p.y = t.to.y - vy * D * (1 - k); }
    p.moving = true; p.walkD += ADV.Tp(p.x) * 1.5 * dt; this.follow(dt);
    if (this.fadeT >= 2) { p.x = t.to.x; p.y = t.to.y; p.moving = false; this.thru = null; this.iris = false; this.mode = 'walk'; }
  },
  doWarp() {
    const w = this.warpTo; this.warpTo = null; this.inDoor = '';
    this.dismount();
    if (w.room) { const d = ADV.openRoom(w.room), sp = d.spawns?.[w.end] || d.spawn; this.room = { id: w.room, door: w, d }; this.put(sp.x, sp.y, w.end === 'w' ? 2 : w.end === 'e' ? 6 : 4); }   // the cave drops you at the end you came in by, facing in
    else { this.room = null; ADV.closeRoom(); this.put(w.x, w.y, 0); ADV.stream(this.cx(), this.cy()); }
    const p = this.p; if (this.thru) { this.thru.d = DIR_VEC[p.face] || this.thru.d; this.thru.to = { x: p.x, y: p.y }; }   // the last steps, toward where put() stood you
    else this.mode = 'walk';
    this.persist();
  },
  // ---------- travel (docs/TRAVEL.md): nothing teleports ----------
  // V the Bike, R a ridden lead, G flight, Select on a pad whichever applies; pressing again gets off (or lands). Returns why it cannot, or ''
  mountKey(kind) {
    if (this.mount === 'fly') { if (this.landing) return ''; const no = this.landOK(); if (!no) this.landing = true; return no; }
    if (this.mount) { this.dismount(this.mount === 'lent' ? 'You gave the mount back.' : 'You got off.'); return ''; }
    kind ||= ADVP.mountKind(this.save, this.save.party[this.leadIdx()]); if (!kind) return 'You have nothing to ride.';
    const no = ADVP.mountNo(this.save, kind, this.mountEnv()); if (no) return no;
    this.mount = kind; this.alt = 0; this.landing = false; ADVMT.start(this, kind); uiBlip(660, 0.04);
    this.msg = { s: kind === 'bike' ? 'You got on your Bike.' : kind === 'fly' ? 'You took off. Space flaps, G lands.' : 'You hopped on ' + ADVP.name(this.save.party[this.leadIdx()]) + '.', t: 1.5 };
    return '';
  },
  dismount(s) { this.mount = ''; this.lent = null; this.alt = 0; this.landing = false; this.fly = this.ride = this.mt = null; if (s) this.msg = { s, t: 2.5 }; },
  mountEnv() { const p = this.p, T = ADV.Tp(p.x); return { room: !!this.room, grass: !this.room && ADV.palette[ADV.over(Math.floor(p.x / T), Math.floor(p.y / T))] === 'tallgrass', wet: this.wet(), lead: this.save.party[this.leadIdx()] }; },
  // px/s of the current mount (0 = on foot); a Bike or a ridden lead gives no boost on water
  mountSpeed() {
    const m = this.mount; if (!m) return 0; if (m === 'fly') return ADVP.PACE.fly; if (m === 'lent') return ADVP.PACE.lent; if (this.wet()) return 0;
    return m === 'bike' ? ADVP.PACE.bike : ADVP.rideSpeed(this.save, this.save.party[this.leadIdx()]);
  },
  // every frame while mounted: the mount must still be usable here; flight climbs and descends; lent mounts follow their own rules
  mountStep(dt) {
    const m = this.mount; if (m === 'lent') return this.lentStep(dt);
    const no = ADVP.mountNo(this.save, m, this.mountEnv()); if (no) return this.dismount(no);
  },
  // flight ignores the ground: it only stops at the edge of the loaded world
  flyMove(dx, dy) {
    const p = this.p, x = p.x + dx, y = p.y + dy, T = ADV.Tp(x), h = ADV.h(Math.floor(x / T), Math.floor(y / T)); if (h < 0) return;
    p.x = x; p.y = y; p.lv = h; p.z = ADV.heightAt(x, y, h);
  },
  // a flight can land on clear outdoor ground only: not on water, a bridge, stairs or a wall / tree
  landOK() {
    const p = this.p, T = ADV.Tp(p.x), c = Math.floor(p.x / T), r = Math.floor(p.y / T), h = ADV.h(c, r);
    return this.room || ADV.bldAt(p.x, p.y) || h < 0 || ADV.isWater(c, r) || ADV.kind(c, r) || ADV.blocked(p.x, p.y, ADV.heightAt(p.x, p.y, h), 9) ? 'There is no clear ground to land on.' : '';
  },
  // lent mounts: the supply mount works on the supply path between Sailsport and Aldermere only (leaving it, or arriving, sends it home); a course mount is a timed ride through markers that teaches a skill
  lentStep(dt) {
    const L = this.lent, p = this.p, T = ADV.Tp(p.x), tx = p.x / T, ty = p.y / T;
    if (this.room) return this.dismount('The mount went home.');
    if (L.kind === 'supply') {
      const at = ADVS.inTown(p.x, p.y) ? 'town' : ADVP.supplyAt(window.ADV_WORLD.supply, tx, ty);
      if (at === 'path') L.left = true;
      else if (at === 'town') { if (L.left) this.dismount('You arrived. The mount went home.'); }
      else this.dismount('You left the path. Mount sent home.');
      return;
    }
    const r = ADVP.courseStep(L, tx, ty, dt);
    if (r === 'late') return this.dismount('Time is up. The mount went home.');
    if (r === 'done') { const sv = this.save, pg = ADVP.teach(sv, L.skill), n = L.n; this.dismount(); this.skillSync(); this.persist(); uiBlip(880, 0.05); this.dialog(['You made it!', ...pg], n); }
  },
  // a lesson (a class, or an impromptu teacher): fee taken only when it is passed
  study(id, level, fee) {
    const sv = this.save; if (sv.money < fee) return void (this.msg = { s: 'You need ' + ADVUI.money(fee) + '.', t: 2.5 });
    const done = () => { sv.money -= fee; const pg = ADVP.teach(sv, id); this.skillSync(); this.persist(); uiBlip(880, 0.05); this.dialog(pg, null); };
    if (!level) return done();
    this.open(ADVUI.lesson(this, level, ADVP.SKILLS[id].name, ok => ok ? done() : void (this.msg = { s: 'Not quite. Come back and try again.', t: 3 })));
  },
  // script class: a town teacher, money plus the easy lesson. script coach: a route trainer (once beaten): a lot more money, the hard lesson, or a timed course ride
  lessonTalk(n) {
    const d = n.def, sv = this.save, id = d.skill, nm = ADVP.SKILLS[id].name, F = ADVP.FEE; if (sv.skills[id]) return this.dialog(d.known, n);
    if (d.script === 'class') { const fee = d.fee ?? F.class; return this.dialog(d.lines, n, () => this.open(ADVUI.ask(this, 'Learn ' + nm + ' for ' + ADVUI.money(fee) + '?', () => this.study(id, 'easy', fee), () => {}))); }
    const opts = [{ label: 'Pay ' + ADVUI.money(F.coachPay), act: () => this.study(id, '', F.coachPay) }, { label: 'Hard lesson, ' + ADVUI.money(F.coachHard), act: () => this.study(id, 'hard', F.coachHard) },
      ...(d.course ? [{ label: 'Timed course ride, free', act: () => this.course(n) }] : []), { label: 'Not now', act: () => {} }];
    this.dialog(d.coach, n, () => this.open(ADVUI.choose(this, 'Learn ' + nm + '?', opts)));
  },
  course(n) {
    const d = n.def, sp = ADVP.LENT[d.skill]; ADVW.load && ADVW.load(sp); this.dismount();
    this.mount = 'lent'; this.lent = { kind: 'course', skill: d.skill, pts: d.course.map(q => [...q]), i: 0, t: d.time, r: 2.5, sp, n }; this.msg = { s: 'Ride through every marker in time.', t: 3 };
  },
  // the supply mount handlers at Sailsport and Aldermere: a paid rental, one trip
  rent() {
    const sv = this.save, fee = ADVP.SUPPLY_FEE, sp = ADVP.LENT.supply; if (sv.money < fee) return void (this.msg = { s: 'The fee is ' + ADVUI.money(fee) + '.', t: 2.5 });
    sv.money -= fee; ADVW.load && ADVW.load(sp); this.dismount(); this.mount = 'lent'; this.lent = { kind: 'supply', sp, left: false }; this.persist();
    this.msg = { s: 'Supply mount rented. Stay on the path.', t: 3.5 };
  },
  // rings on the next marker of a course ride
  courseItems() {
    const L = this.lent; if (this.mount !== 'lent' || L.kind !== 'course') return [];
    const T = ADV.Tp(this.p.x), q = L.pts[L.i], x = (q[0] + 0.5) * T, y = (q[1] + 0.5) * T, z = ADV.heightAt(x, y, Math.max(0, ADV.h(q[0], q[1])));
    return [{ x, y, z, f: () => { const g = ctx, k = (Math.sin(this.t * 5) + 1) / 2; g.strokeStyle = '#ffde3b'; g.lineWidth = 3; g.beginPath(); g.ellipse(Math.round(x), Math.round(y - z), L.r * T * 0.9, L.r * T * 0.45, 0, 0, 6.283); g.stroke(); g.fillStyle = '#ffde3b'; g.fillRect(Math.round(x) - 2, Math.round(y - z) - 40 - Math.round(k * 4), 5, 40); g.fillRect(Math.round(x) + 3, Math.round(y - z) - 40 - Math.round(k * 4), 14, 10); } }];
  },
  // puts the player (and the lead mon behind) on a spot, on the ground level there; the camera snaps
  put(x, y, face) {
    const p = this.p, T = ADV.Tp(x); p.x = x; p.y = y; p.face = face; p.hop = null; p.moving = false; p.lv = Math.max(0, ADV.h(Math.floor(x / T), Math.floor(y / T))); p.z = p.sz = ADV.heightAt(x, y, p.lv);
    this.folReset(x, y, p.z, face);
    this.px = x; this.py = y; this.cam = { x, y: y - p.z - 16 }; this.camStep(1);
  },
  // the text box: boxes of 2 lines, typewriter, A / E / click to advance; done() runs after the last box
  // a new trainer's first moments: where they are, what they are after, and the two things on screen that always show the way (once per save)
  intro() {
    const sv = this.save, m = sv.party[0], mon = m ? ADVP.name(m) : 'your partner', home = ADVS.town(sv.home)?.name || 'home', touch = !!window.TOUCH?.on; sv.intro = 1;
    this.dialog([`Welcome to Kenora, ${sv.name}! You and ${mon} are setting out from ${home}.`,
      'Gym Leaders across the region award Badges to trainers who beat them. The NEXT GOAL panel at the top left always says where to go next, and what to do first.',
      `The minimap shows the way: the red pin is your goal and the orange dots are trainers waiting to battle. ${touch ? 'Tap' : 'Click'} it for the full map. Good luck!`], null);
  },
  dialog(pages, n, done) {
    const boxes = []; for (const s of pages) boxes.push(...this.box(s));
    this.dlg = { pages: boxes, i: 0, t: 0, n, done }; this.mode = 'talk';
  },
  box(s) { return ADVUI.pages(s); },
  talkStep(dt) {
    const d = this.dlg; d.t += dt * (INPUT.held('B') || INPUT.held('BACKK') || KEYS.Escape ? 4 : 1);
    if (!(this.talkHit() || MOUSE.hit && d.t > 0.15)) return;
    uiBlip(700, 0.03);
    if (d.t * 50 < d.pages[d.i].chars) { d.t = 1e3; return; }
    if (++d.i < d.pages.length) { d.t = 0; return; }
    this.dlg = null; this.mode = 'walk'; if (d.n) d.n.busy = false; if (d.done) d.done();
  },
  // a trainer saw you: "!", it walks up along its line of sight to NEAR tiles, says its line, then the fight
  spotted(n) {
    const p = this.p, e = n.e, t = n.def.trainer;
    n.busy = true; p.moving = false; p.face = dirFromVec(e.x - p.x, e.y - p.y); this.mode = 'spot'; this.sp = { n, t: 0, ph: 'bang', stall: 0 }; this.bang = { n, t: 0 };
    ADVN.team(t, n.id, this.save.badges).forEach(m => ADVW.load && ADVW.load(m.species)); preload(assetSrcs({ arena: {}, player: { team: [] }, cpu: { avatar: ADVN.avatar(t), team: [] } }));
  },
  spotStep(dt) {
    const s = this.sp, n = s.n, e = n.e, p = this.p, t = n.def.trainer; s.t += dt; if (this.bang) this.bang.t = s.t; n.moving = false;
    if (s.ph === 'bang') { if (s.t > 0.9) { s.ph = 'walk'; this.bang = null; } return; }
    const dx = p.x - e.x, dy = p.y - e.y, v = DIR_VEC[n.def.face];
    if (Math.hypot(dx, dy) <= ADVN.NEAR * ADV.Tp(e.x) || s.stall > 0.4) { n.face = dirFromVec(dx, dy); this.sp = null; const say = [].concat(t.say2 && this.save.met[n.id] ? t.say2 : t.say); this.save.met[n.id] = 1; return this.dialog(say, n, () => this.open(ADVUI.card(this, n, () => this.startTrainer(n)))); }
    const x0 = e.x, y0 = e.y; ADV.move(e, v[0] * 110 * dt, v[1] * 110 * dt);
    const m = Math.hypot(e.x - x0, e.y - y0); n.moving = m > 0.01; n.walkD += m; n.animT += dt; s.stall = m > 0.01 ? 0 : s.stall + dt;
  },
  // the trainer stays out of the fight like the player: its first mon steps out 1.5 tiles toward you, the rest follow from the same spot; no catching, no fleeing
  startTrainer(n) {
    this.dismount();
    const T = ADV.Tp(this.f.x), p = this.p, f = this.f, e = n.e, t = n.def.trainer, lv = Math.round(f.z / T), mons = this.save.party, b = this.save.badges | 0, team = ADVN.team(t, n.id, b);
    const dx = p.x - e.x, dy = p.y - e.y, dl = Math.hypot(dx, dy) || 1, sx = e.x + dx / dl * 48, sy = e.y + dy / dl * 48;
    const order = mons.map((_, i) => i).sort((a, c) => ADVP.fainted(mons[a]) - ADVP.fainted(mons[c])), ar = ADVB.box(f, { x: sx, y: sy }, lv), cx = (f.x + sx) / 2, cy = (f.y + sy) / 2;
    n.busy = true;
    ar.extra = () => [{ x: p.x, y: p.y, z: p.z, f: () => this.drawFighter() }, ...this.npcItems(), ...this.itemFx(), ...this.wildItems(), ...this.remoteItems()];
    startBattleA({ arena: ar, weather: '', player: { name: this.save.name, avatar: this.save.avatar, team: order.map(i => mons[i]) },
      cpu: { name: t.cls + ' ' + t.name, cpu: true, tier: b < 3 ? 'normal' : b < 6 ? 'hard' : 'champion', avatar: ADVN.avatar(t), team: team.map(m => ADVP.mon(m.species, m.level, m.moves ? { moves: [...m.moves] } : {})) } });
    order.forEach((i, k) => { const s = mons[i], m = B.sides[0].team[k]; m.hp = Math.min(m.maxHp, s.hp); m.status = s.status || ''; if (!(s.hp > 0)) { m.fainted = true; m.hp = 0; } });
    Object.assign(B.cam, { x: this.cam.x - ar.ox, y: this.cam.y - ar.oy + lv * T, z: ADVR.battleZoom() });
    B.sides[1].queue = true; callout({ idx: -1 }, `${t.cls} ${t.name} wants to battle!`);
    this.step = { side: 1, dg: null, cd: 0 };
    this.tr = { n, t, team, sx, sy }; this.q = B.sides[1].team.map(() => ({ st: '' })); this.qi = 0; this.order = order; this.w = null; this.far = this.edge = this.runSaid = 0; this.mode = 'battle'; this.inB = true; this.gain = {}; this.part = new Set(); this.wh = null; this.cs = this.iu = null;
    p.moving = false; p.face = dirFromVec(cx - p.x, cy - p.y);
  },
  center(id) {
    this.save.party.forEach(m => ADVP.heal(m)); this.save.last = id; this.flash = 0.6; uiBlip(880, 0.05); ADVF.note(this.save, 'heal');
    this.msg = { s: 'Welcome to the Pokemon Center! Your Pokemon are fully healed.', t: 3.5 }; this.persist();
  },
  // The lead mon trails the player's path ADVF.FD tiles behind. Following eases toward that spot (so it brakes when you stop and never closer than ADVF.MIN tiles); walk vs idle comes from its real
  // speed with hysteresis and its facing turns in 45 degree steps (ADVF.loco / aim). After 2 s of standing still it has a life of its own (folIdle); the moment you move it snaps back to following.
  follow(dt) {
    const p = this.p, f = this.f, T = ADV.Tp(p.x), g = (ADVF.trailPush(this.trail, p), ADVF.trailGoal(this.trail, ADVF.FD * T));
    const act = this.mode === 'walk' && !this.uis.length && !this.dlg && !this.mount && !this.inB && !p.hop;
    const x0 = f.x, y0 = f.y;
    f.animT += dt; f.at += dt; if (f.hopT > 0) f.hopT -= dt;
    f.idleT = act && !p.moving ? f.idleT + dt : 0;
    if (p.moving && !f.free && f.beh !== 'follow') { f.beh = 'follow'; f.doing = ''; f.hopT = 0; }   // a sleeper wakes, a looker stops looking
    if (f.free) this.folFree(dt, g, T, act);
    else {
      ADVF.chase(f, g.x, g.y, p, dt, this.back ? 200 : 420, ADVF.MIN * T);
      f.z = g.z; f.sz = g.sz;
      if (this.back && Math.hypot(g.x - f.x, g.y - f.y) < 4) this.back = false;
      if (act && f.idleT > 2) this.folIdle(dt, T);
    }
    f.walkD += Math.hypot(f.x - x0, f.y - y0);
    if (ADVF.loco(f, dt)) f.at = 0;
    ADVF.aim(f, dt); f.moving = f.loco === 'Walk';
    this.folAnim();
  },
  // what to draw: sleeping and a plan's pose win, then a one-shot hop, then walk or idle (falling back to what the sheet has)
  folAnim() {
    const f = this.f, A = spriteOf(this.key)?.anims || {};
    let an = f.beh === 'sleep' ? 'Sleep' : f.beh === 'act' && f.plan ? f.plan.anim : f.hopT > 0 ? 'Hop' : f.loco;
    if (!A[an]) an = A[f.loco] ? f.loco : 'Idle';
    if (an !== f.anim) { f.anim = an; f.at = 0; }
  },
  // the mood inputs: the lead's health and bond, what the world is doing around it
  folState(m) { const sp = DEX.species[toId(m.species)]; return { hpf: ADVP.fainted(m) ? 0 : m.hp / ADVP.max(m), status: m.status, friend: m.friend | 0, level: m.level, types: sp.types }; },
  envNow() {
    const p = this.p, T = ADV.Tp(p.x), c = Math.floor(p.x / T), r = Math.floor(p.y / T), z = ADVW.zone(p.x, p.y) || '';
    let water = false; for (let dr = -2; dr <= 2 && !water; dr++) for (let dc = -2; dc <= 2; dc++) if (ADV.isWater(c + dc, r + dr)) { water = true; break; }
    return { weather: this.wx || (typeof ADVWX === 'undefined' ? '' : { storm: 'rain' }[ADVWX.cur.kind] ?? ADVWX.cur.kind), night: ADVW.night(), indoors: !!this.room, cave: !!(this.room && !this.room.d.bld && this.room.d.dark), water: water && !this.room, grass: !this.room && ADV.palette[ADV.over(c, r)] === 'tallgrass', snow: z === 'frostfall', town: !!ADVS.inTown(p.x, p.y) };
  },
  folMood() { const m = this.save.party[this.leadIdx()]; return ADVF.mood(this.folState(m), this.save.f.events, this.envNow()); },
  // idle life, on the trail and at rest: look around, now and then sleep (long idle or night) or go exploring
  folIdle(dt, T) {
    const f = this.f, A = spriteOf(this.key)?.anims || {};
    if (f.beh === 'sleep') return;
    if (f.beh !== 'look') { f.beh = 'look'; f.bt = 0; f.next = 2 + Math.random() * 2; f.doing = 'look'; f.lookT = 0.5; }
    f.bt += dt;
    if ((f.lookT -= dt) <= 0) { f.lookT = 0.9 + Math.random() * 1.4; f.want = Math.random() < 0.25 ? dirFromVec(this.p.x - f.x, this.p.y - f.y) : (f.face + [-3, -2, -1, 1, 2, 3][Math.floor(Math.random() * 6)] + 8) % 8; }
    if (f.bt < f.next) return;
    f.bt = 0; f.next = 2.5 + Math.random() * 3;
    if (A.Sleep && (f.idleT > 25 || (ADVW.night() && f.idleT > 10))) { f.beh = 'sleep'; f.doing = 'sleep'; return; }
    const happy = ['joy', 'happy', 'playful', 'proud'].includes(this.folMood().tone);
    if (Math.random() < 0.7) { const pl = this.folPlan(happy); if (pl) { Object.assign(f, { beh: 'go', plan: pl, free: true, stall: 0, lv: Math.round(f.sz / T), doing: pl.doing }); return; } }
    if (happy && A.Hop && Math.random() < 0.5) { f.hopT = animLen(A.Hop); f.at = 0; f.doing = 'hop'; }
  },
  // somewhere worth a look near the player: { x, y (where to stand), lx, ly (what to look at), kind, anim, doing, dur } or null. Never off the player's level, into a wall, into water or out of the building the player is in.
  folPlan(happy) {
    const p = this.p, f = this.f, T = ADV.Tp(p.x), z = f.sz, A = spriteOf(this.key)?.anims || {}, lvl = Math.round(z / T), pc = Math.floor(p.x / T), pr = Math.floor(p.y / T), R = 5;
    if (this.room && !this.room.d.bld) return null;   // a cave or an old room map: stay put
    if (Math.abs(z - lvl * T) > 1) return null;
    const bp = ADV.bldAt(p.x, p.y), by = {}, vw = this.view();   // it only strolls where you can see it
    const ok = (x, y) => { const c = Math.floor(x / T), r = Math.floor(y / T), d = Math.hypot(x - p.x, y - p.y); return x > vw.x0 + 24 && x < vw.x1 - 24 && y > vw.y0 + 70 && y < vw.y1 - 64 && d >= 1.4 * T && d <= R * T && ADV.bldAt(x, y) === bp && ADV.h(c, r) === lvl && !ADV.STAIR[ADV.kind(c, r)] && !ADV.blocked(x, y, z, 9); };
    const add = (kind, x, y, lx, ly) => { if (ok(x, y)) (by[kind] ||= []).push({ x, y, lx, ly, kind }); };
    if (!bp) for (let r = pr - R; r <= pr + R; r++) for (let c = pc - R; c <= pc + R; c++) {
      if (ADV.isWater(c, r)) { for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!ADV.isWater(c + dc, r + dr)) add('water', (c + dc + 0.5) * T, (r + dr + 0.5) * T, (c + 0.5) * T, (r + 0.5) * T); }
      else if (ADV.palette[ADV.over(c, r)] === 'tallgrass') add('grass', (c + 0.5) * T, (r + 0.5) * T, (c + 0.5) * T, (r + 0.5) * T + 8);
    }
    const CH = T * ADV.CH;
    for (let cy = Math.floor((p.y - R * T) / CH); cy <= Math.floor((p.y + R * T) / CH); cy++) for (let cx = Math.floor((p.x - R * T) / CH); cx <= Math.floor((p.x + R * T) / CH); cx++) {
      const ch = ADV.chunks.get(ADV.key(cx, cy)); if (!ch) continue;
      for (const o of ch.props) {
        const kind = /flower|rose|blossom|mushroom/i.test(o.n) ? 'flower' : /sign|infopost/i.test(o.n) ? 'sign' : ''; if (!kind || Math.abs(o.x - p.x) > R * T || Math.abs(o.y - p.y) > R * T || Math.abs(o.z - z) > T * 0.75) continue;
        for (const [dx, dy] of [[0, 0.9], [-0.9, 0], [0.9, 0], [0, -0.9]]) if (ok(o.x + dx * T, o.y + dy * T)) { add(kind, o.x + dx * T, o.y + dy * T, o.x, o.y); break; }
      }
    }
    for (const n of ADVN.list) { const e = n.e; if (!e || !ADVN.vis(n) || Math.hypot(e.x - p.x, e.y - p.y) > R * T) continue; const d = Math.hypot(p.x - e.x, p.y - e.y) || 1; add('npc', e.x + (p.x - e.x) / d * 1.1 * T, e.y + (p.y - e.y) / d * 1.1 * T, e.x, e.y); }
    const kinds = Object.keys(by), w = { flower: 3, water: 3, grass: 2, sign: 2, npc: 2 }, tot = kinds.reduce((s, k) => s + w[k], 0);
    let kind = 'roam', c, pick = Math.random() * tot;
    for (const k of kinds) if ((pick -= w[k]) < 0) { kind = k; break; }
    if (kind !== 'roam') c = by[kind][Math.floor(Math.random() * by[kind].length)];
    else for (let i = 0; i < 8 && !c; i++) { const a = Math.random() * 6.283, d = (1.6 + Math.random() * 1.6) * T, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d; if (ok(x, y)) c = { x, y, lx: x + Math.cos(a) * T, ly: y + Math.sin(a) * T, kind }; }
    if (!c) return null;
    const eat = (kind === 'flower' || kind === 'grass') && A.Eat, hop = happy && A.Hop && (kind === 'water' || kind === 'npc');
    return { ...c, anim: eat ? 'Eat' : hop ? 'Hop' : 'Idle', doing: eat ? 'eat' : { water: 'water', sign: 'sign', npc: 'npc' }[kind] || 'wander', dur: 2.5 + Math.random() * 2 };
  },
  // one step of a free (off-trail, collision-checked) stroll: go to the spot, enjoy it, walk back to the trail; the player moving or a screen opening sends it back at once
  folFree(dt, g, T, act) {
    const f = this.f, p = this.p, pl = f.plan;
    if (f.beh !== 'back' && (p.moving || !act || !pl || Math.hypot(f.x - p.x, f.y - p.y) > 7 * T)) f.beh = 'back';
    if (f.beh === 'go') {
      const d = Math.hypot(pl.x - f.x, pl.y - f.y); f.bt += dt;
      if (d < 5) { f.beh = 'act'; f.bt = 0; f.want = dirFromVec(pl.lx - f.x, pl.ly - f.y); f.at = 0; if (pl.anim === 'Hop') f.hopT = 0; }
      else if (f.stall > 0.7 || f.bt > 9) f.beh = 'back';
      else this.folWalk(pl.x, pl.y, 85, dt, 1.2 * T);
    } else if (f.beh === 'act') {
      f.bt += dt; ADVF.vel(f, 0, 0, dt);
      if (f.bt > pl.dur) { f.beh = 'back'; f.plan = null; }
    }
    if (f.beh === 'back') {
      f.doing = ''; const d = Math.hypot(g.x - f.x, g.y - f.y);
      if (d < 6 || f.stall > 0.5) { f.free = false; f.x = d < 6 ? f.x : g.x; f.y = d < 6 ? f.y : g.y; f.z = g.z; f.sz = g.sz; f.beh = 'follow'; f.plan = null; f.bt = 0; }
      else this.folWalk(g.x, g.y, p.moving ? 280 : 130, dt, 1.0 * T);
    }
  },
  // walk f toward a point with the world's collisions; tracks how long it has been stuck
  folWalk(tx, ty, speed, dt, min) {
    const f = this.f, d = Math.hypot(tx - f.x, ty - f.y), s = Math.min(speed * dt, d), x0 = f.x, y0 = f.y;
    if (d > 0.01) ADV.move(f, (tx - f.x) / d * s, (ty - f.y) / d * s);
    f.hop = null;
    ADVF.sep(f, this.p, min);
    const m = Math.hypot(f.x - x0, f.y - y0); ADVF.vel(f, f.x - x0, f.y - y0, dt);
    f.stall = m < s * 0.3 ? f.stall + dt : 0;
  },
  view() { const z = ADVR.zoomFor(), c = this.cam; return { x0: c.x - VW / 2 / z, x1: c.x + VW / 2 / z, y0: c.y - VH / 2 / z, y1: c.y + VH / 2 / z }; },
  // touching a wild mon (or being touched) starts the fight
  touch() {
    const p = this.p, f = this.f, T = ADV.Tp(p.x), flat = (x, y) => !ADV.STAIR[ADV.kind(Math.floor(x / T), Math.floor(y / T))];
    if (!this.loaded || p.hop || !flat(p.x, p.y) || !flat(f.x, f.y) || Math.abs(f.z - Math.round(f.z / T) * T) > 1) return;
    for (const g of ADVW.groups) for (const w of g.m) {
      const e = w.e; if (w.st === 'fight' || w.st === 'wait' || w.cool > 0 || e.hop || e.lv !== p.lv || Math.abs(e.x - p.x) > 80 || Math.abs(e.y - p.y) > 80 || !flat(e.x, e.y)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < ADV_TOUCH || Math.hypot(e.x - f.x, e.y - f.y) < ADV_TOUCH + 4) {
        if (w.claiming) return; w.claiming = true;   // online the host decides who gets the group: the fight starts when it says yes
        return this.net.N.claim(w, ok => {
          w.claiming = false;
          if (!ok) return void (w.cool = 4);
          if (this.mode === 'walk' && !this.inB && !w.dead) this.startFight(w); else this.net.N.bend(w, 'fled', []);
        });
      }
    }
  },
  // the species portrait stands in for the wild side's trainer tile (HUD avatars are looked up by id)
  wildAvatar(id) {
    const a = 'wild-' + id, s = spriteOf(DEX.species[id].sprite); avatarById('red');
    AVATAR_MAP.set(a, { id: a, file: s.portrait, get crop() { const i = img(s.portrait); return [0, 0, i ? Math.min(i.naturalWidth, i.naturalHeight) : 40]; } });
    return a;
  },
  // the party is side 0 (alive mons first, hp and status carried over from the save); the wild side's team is the pile-on queue (target first, group mates behind it), one on the field at a time
  startFight(w) {
    this.dismount();
    const T = ADV.Tp(this.f.x), p = this.p, f = this.f, e = w.e, lv = Math.round(f.z / T), mons = this.save.party, lvl = w.level, q = ADVW.queue(w);
    const order = mons.map((_, i) => i).sort((a, b) => ADVP.fainted(mons[a]) - ADVP.fainted(mons[b])), ar = ADVB.box(f, e, lv), cx = (f.x + e.x) / 2, cy = (f.y + e.y) / 2;
    q.forEach(m => m.set ||= ADVP.mon(m.id, m.level)); // a wild mon has its nature, ability and level-up moves from the start, so a catch is that same mon
    ar.extra = () => [{ x: p.x, y: p.y, z: p.z, f: () => this.drawFighter() }, ...this.ballItems(), ...this.itemFx(), ...this.wildItems(), ...this.remoteItems()]; // the trainer stays out of the fight and watches
    startBattleA({ arena: ar, weather: '', player: { name: this.save.name, avatar: this.save.avatar, team: order.map(i => mons[i]) },
      cpu: { name: 'Wild ' + DEX.species[w.id].name, cpu: true, tier: lvl <= 15 ? 'easy' : lvl <= 35 ? 'normal' : lvl <= 60 ? 'hard' : 'champion', team: q.map(m => m.set) } });
    order.forEach((i, k) => { const s = mons[i], m = B.sides[0].team[k]; m.hp = Math.min(m.maxHp, s.hp); m.status = s.status || ''; if (!(s.hp > 0)) { m.fainted = true; m.hp = 0; } });
    Object.assign(B.cam, { x: this.cam.x - ar.ox, y: this.cam.y - ar.oy + lv * T, z: ADVR.battleZoom() });
    B.sides[1].queue = true; B.sides[1].avatar = this.wildAvatar(w.id);
    q.forEach((m, k) => {
      m.go = null; if (!k) { m.st = 'fight'; return; }
      const s = ADVW.edge(m, cx, cy), ok = ADVW.ok(s.x, s.y, m.tm, m.e.lv) && !ADVB.solidAt(ar, s.x - ar.ox, s.y - ar.oy, 14);
      Object.assign(m, { st: 'wait', spot: ok ? s : { x: m.e.x, y: m.e.y }, watch: { x: cx, y: cy } }); // the others wait at the edge, watching
    });
    this.step = { side: 1, dg: null, cd: 0 };   // the trainer walks back out of the fight (trainerStep)
    this.q = q; this.qi = 0; this.order = order; this.w = w; this.far = this.edge = this.runSaid = 0; this.mode = 'battle'; this.inB = true; this.gain = {}; this.part = new Set(); this.wh = null; this.cs = this.iu = null;
    p.moving = false; p.face = dirFromVec(cx - p.x, cy - p.y);
  },
  // The trainer stays in the world during a fight (this.step): it walks to a spot ADV_KEEP tiles behind its own mon, a little off to one side, facing the fight, and sidesteps out of any
  // attack that is about to cover it (sidestepFrom in battle.js). It never takes damage: the sim does not know it exists. Walking uses ADV.move, so walls and props stop it like they stop you.
  trainerStep(dt) {
    const s = this.step, p = this.p, ar = B.arena, [a, b] = B.sides.map(q => q.ent), ox = ar.ox, oy = ar.oy, T = ar.T;
    if (!s) return;
    s.cd -= dt;
    const fx = ox + (a.x + b.x) / 2, fy = oy + (a.y + b.y) / 2; p.face = dirFromVec(fx - p.x, fy - p.y);
    const x0 = p.x, y0 = p.y;
    if (s.dg) {   // mid-dodge: a quick run to the side with a hop
      const d = s.dg, sp = TUNE.DODGE_DIST / TUNE.DODGE_TIME; ADV.move(p, d.x * sp * dt, d.y * sp * dt);
      if ((d.t -= dt) <= 0) { s.dg = null; s.cd = 0.45; }
    } else {
      const sd = s.cd <= 0 && sidestepFrom(p.x - ox, p.y - oy);
      if (sd) {   // the side that is open (the other way if a wall is in the way)
        const k = 2 * T, ok = v => !ADV.blocked(p.x + v.x * k, p.y + v.y * k, p.z, 9), v = ok(sd) ? sd : ok({ x: -sd.x, y: -sd.y }) ? { x: -sd.x, y: -sd.y } : sd;
        s.dg = { x: v.x, y: v.y, t: TUNE.DODGE_TIME, T: TUNE.DODGE_TIME }; spawnFx('Puff_White', p.x - ox, p.y - oy - 4, { scale: SS });
      } else {
        let bx = a.x - b.x, by = a.y - b.y; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;   // away from the foe, behind own mon
        const lat = (p.x - ox - a.x) * -by + (p.y - oy - a.y) * bx; if (Math.abs(lat) > 12) s.side = lat > 0 ? 1 : -1;   // keep to the side it is already on
        const tx = ox + a.x + bx * ADV_KEEP * T - by * s.side * 1.5 * T, ty = oy + a.y + by * ADV_KEEP * T + bx * s.side * 1.5 * T;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), go = d > (s.go ? 0.3 : 1) * T;   // starts walking past a tile off the spot, stops when it is close
        s.go = go; if (go) { const sp = Math.min(200, 60 + d * 1.6) * dt; ADV.move(p, dx / d * sp, dy / d * sp); }
      }
    }
    const m = Math.hypot(p.x - x0, p.y - y0); p.moving = m > 0.01; p.walkD += m;
  },
  // the trainer sprite, lifted off the ground (its shadow stays) while it hops out of the way
  drawFighter() {
    const p = this.p, dg = this.step?.dg, z = p.z; if (dg) p.z = z + Math.round(Math.sin((1 - dg.t / dg.T) * Math.PI) * 16 / ADVR.ART) * ADVR.ART;
    try { this.drawPlayer(); } finally { p.z = z; }
    this.drawBusy();
  },
  battleStep(dt) {
    const ar = B.arena, [a, b] = B.sides.map(s => s.ent), s0 = B.sides[0], s1 = B.sides[1];
    if (B.choose) confirmChoose();
    if (s1.cur !== this.qi) { this.q[this.qi = s1.cur].st = 'fight'; this.part = new Set(); } // the sim sent the next queued mon in
    if (this.tr?.t.sorry) this.apologise(s0, s1);
    this.q.forEach((m, k) => { if (m.st === 'wait') { const [x, y] = ADVB.clamp(ar, m.e.x - ar.ox, m.e.y - ar.oy, 14); s1.team[k].at = { x, y }; } }); // it runs in from where it stands
    if (this.tr) { const [x, y] = ADVB.clamp(ar, this.tr.sx - ar.ox, this.tr.sy - ar.oy, 14); s1.team.forEach((m, k) => { if (k !== s1.cur && !m.fainted) m.at = { x, y }; }); } // the next mon enters from beside its trainer
    this.trainerStep(dt); if (this.iu && (this.iu.t += dt) > 1) this.iu = null;
    if (this.cs) { this.catchStep(dt); if (B) updateFxOnly(dt); if (B) { this.cam.x = ar.ox + B.cam.x; this.cam.y = ar.oy + B.cam.y - ar.lv * ar.T; } return; } // the sim waits for the ball
    const was = !!this.wh; // C or Y opens it; once open, the same keys close it
    if (!was && !B.over && !B.choose && (this.cHit || INPUT.hit('Y')) && ADVUI.wheelItems(this).length) this.wh = { sel: 0 };
    s0.itemWheel = !!this.wh; if (was) ADVUI.wheelUpdate(this, dt); s0.itemWheel = !!this.wh;
    updateBattle(this.wh ? dt * 0.2 : dt); // slow motion while the item wheel is open
    if (!s0.team[s0.cur].fainted) this.part.add(s0.cur);
    s1.team.forEach((m, k) => { if (m.fainted && !m.paid) { m.paid = true; this.award(m); } });
    this.cam.x = ar.ox + B.cam.x; this.cam.y = ar.oy + B.cam.y - ar.lv * ar.T; // streaming follows the fight
    this.bvTick(dt);
    if (B.over) { if (B.winner === 0 ? B.endT > 0.3 : B.endT > 1.2) { if (B.winner === 0) this.endFight(''); else { this.late = this.settle(); this.wh = null; this.mode = 'fade'; this.fadeT = 0; } } return; }
    // running away (wild fights only): the wild mon keeps up with you, so besides gaining ADV_FLEE px on it for ADV_FLEE_T s you can run out through the edge of the fight box (ADV_EDGE px in, held ADV_EDGE_T s)
    const I = s0.intent, out = a.x < ADV_EDGE && I.mx < -0.3 || a.x > ar.w - ADV_EDGE && I.mx > 0.3 || a.y < ADV_EDGE && I.my < -0.3 || a.y > ar.h - ADV_EDGE && I.my > 0.3;
    this.far = Math.hypot(a.x - b.x, a.y - b.y) > ADV_FLEE ? this.far + dt : 0; this.edge = out ? this.edge + dt : 0;
    if (this.tr) { if (this.edge > ADV_EDGE_T) { this.edge = -2; this.say("No! You can't run from a trainer battle!"); } return; }
    if (this.far > ADV_FLEE_T || this.edge > ADV_EDGE_T) return this.endFight('Got away safely!');
    if ((this.far > 0.3 || this.edge > 0.25) && !this.runSaid) { this.runSaid = 1; this.say('Keep running to get away!'); }
  },

  // a leader who apologises sweetly: once when the ace comes out, once when the ace first flattens one of yours
  apologise(s0, s1) {
    const tr = this.tr, say = tr.t.sorry, ace = s1.team.length - 1, down = s0.team.filter(m => m.fainted).length;
    if (s1.cur === ace && !tr.s1) { tr.s1 = 1; callout({ idx: -1 }, say[0]); }
    if (s1.cur === ace && !tr.s2 && down > (tr.down0 ??= down)) { tr.s2 = 1; callout({ idx: -1 }, say[1]); }
  },

  // ---------- EXP ----------
  // the mons that fought this wild one (alive now) split its EXP equally; the levels are applied when the fight ends
  award(m) {
    const s0 = B.sides[0], alive = [...this.part].filter(k => !s0.team[k].fainted); if (!alive.length) return;
    const base = ADVP.info(m.sp.id).baseExp ?? 100;
    alive.forEach(k => { const i = this.order[k], n = Math.round(ADVP.expGain(base, m.level, this.save.party[i].level, alive.length, !!this.tr) * ADVP.PACE); this.gain[i] = (this.gain[i] | 0) + n; if (k === s0.cur) callout({ idx: -1 }, `${ADVP.name(this.save.party[i])} +${n} EXP`); });
  },
  // writes the fight back into the party (hp, status) and turns the EXP into the level-up pages
  settle() {
    const s0 = B.sides[0], party = this.save.party, ev = [], time = ADVW.night() ? 'night' : 'day';
    this.order.forEach((i, k) => { const m = s0.team[k], s = party[i], was = s.hp > 0; s.hp = m.fainted ? 0 : Math.max(1, Math.round(m.hp)); s.status = { par: 'par', brn: 'brn', psn: 'psn', tox: 'psn' }[m.status] || ''; if (was && m.fainted) ADVF.note(this.save, 'faint', { who: ADVP.name(s) }); });
    for (const i in this.gain) { const s = party[i]; ev.push({ t: 'msg', s: `${ADVP.name(s)} gained ${this.gain[i]} EXP!` }, ...ADVP.gain(s, this.gain[i], { time })); }
    this.noteGrow(ev);
    return ev;
  },
  // level ups, moves and evolutions of the lead mon become mood events (the follower is the lead)
  noteGrow(ev) {
    const lead = this.save.party[this.leadIdx()];
    for (const e of ev) {
      if (e.s !== lead) continue;
      if (e.t === 'lv') ADVF.note(this.save, 'level', { lv: e.to });
      else if (e.t === 'learn') ADVF.note(this.save, 'move', { mv: DEX.moves[e.mv]?.name || e.mv });
      else if (e.t === 'evo') ADVF.note(this.save, 'evolve', { to: DEX.species[e.to]?.name || e.to });
    }
  },

  // ---------- items in battle ----------
  say(s) { callout({ idx: -1 }, s); },
  useItem(id) {
    const it = ADVP.item(id), s0 = B.sides[0], bag = this.save.bag;
    if (this.cs || B.over || !(bag[id] > 0)) return;
    if (this.itemCd > 0) return this.say(`The bag is busy for ${Math.ceil(this.itemCd)} s`);
    if (it.ball) { this.wh = null; return this.tr ? this.say("You can't catch another trainer's Pokemon!") : this.throwBall(id, it); }
    const e = s0.ent, m = it.revive ? s0.team.find((x, k) => x.fainted && k !== s0.cur) : s0.team[s0.cur];
    if (!m) return this.say('No fainted Pokemon to revive');
    const r = ADVP.useOn(m, id, m.maxHp, m.stats.hp); if (!r) return this.say(`It would have no effect on ${m.sp.name}`);
    ADVP.take(bag, id); this.itemCd = 6; this.wh = null; const pm = this.save.party[this.order[s0.team.indexOf(m)]]; if (pm) pm.friend = Math.min(255, (pm.friend | 0) + 2);
    this.iu = { id, t: 0, tr: !!it.revive }; ADVUI.sprite(id);
    this.say(`${m.sp.name} ${r === 'healed' ? 'was healed' : r === 'cured' ? 'was cured' : 'was revived'}!`); if (m === s0.team[s0.cur]) floatText(e.x, e.y - 40 * SS, r === 'healed' ? 'HEAL' : 'CURED', '#7dff8a', 13);
  },
  // the ball arcs from the trainer to the active wild mon on its own, then shakes up to 3 times (the sim waits)
  throwBall(id, it) {
    const s1 = B.sides[1], m = s1.team[s1.cur], e = s1.ent, ar = B.arena; if (m.fainted) return;
    ADVP.take(this.save.bag, id); this.itemCd = 6;
    const a = ADVP.catchA(m.maxHp, m.hp, ADVP.info(m.sp.id).catchRate ?? 45, it.ball, m.status), r = ADVP.throwBall(a);
    const p = this.p; this.cs = { id, a, ...r, k: s1.cur, t: 0, hit: false, x0: p.x, y0: p.y, z0: p.z + 34, x1: ar.ox + e.x, y1: ar.oy + e.y, z1: ar.lv * ar.T + 14 * SS + e.z };
  },
  // timeline: fly 0.65 s, hit, drop, then one wiggle per shake (1.1 s each), a pause, the result
  TH: 0.65, TD: 0.85, TS: 1.35, TW: 1.1,
  catchStep(dt) {
    const c = this.cs, s1 = B.sides[1], e = s1.ent; c.t += dt;
    if (!c.hit && c.t >= this.TH) { c.hit = true; e.hidden = 99; flash(0.12); burst(e.x, e.y - 10 * SS, '#fff', 14); AUDIO.gen('recall', 0.6, e.x); }
    if (c.t < this.TS + c.shakes * this.TW + 0.9) return;
    if (c.caught) return this.catchDone();
    e.hidden = 0; e.enterT = 0.35; e.iframes = 0.8; burst(e.x, e.y - 10 * SS, '#fff', 14); this.say('Oh no! It broke free!'); this.cs = null;
  },
  catchDone() {
    const c = this.cs, m = B.sides[1].team[c.k], w = this.q[c.k], st = { par: 'par', brn: 'brn', psn: 'psn', tox: 'psn' }[m.status] || '';
    const set = { ...w.set, ball: c.id, ot: this.save.name, hp: Math.max(1, Math.round(m.hp)), status: st, friend: 70 };
    this.cs = null; this.endFight(`Gotcha! ${m.sp.name} was caught!`, c.k, set);
  },
  // world items for the ball in flight / shaking on the ground (c.x0, c.y0 and c.x1, c.y1 are world coordinates from the throw). The ball is the bag's real item icon (ADVUI.thing): it spins in quarter turns
  // while it flies and rocks a pixel or two from side to side when it shakes
  ballItems() {
    const c = this.cs; if (!c) return [];
    const g = B.arena.lv * B.arena.T, t = c.t, fly = Math.min(1, t / this.TH), end = this.TS + c.shakes * this.TW + 0.2, done = c.caught && t > end, rest = g + 15;
    let z, turns = 0, rock = 0;
    if (t < this.TH) { z = c.z0 + (c.z1 - c.z0) * fly + Math.sin(fly * Math.PI) * 46; turns = Math.floor(t * 14); }
    else if (t < this.TD) z = c.z1;
    else if (t < this.TS) { const u = (t - this.TD) / (this.TS - this.TD); z = rest + (c.z1 - rest) * (1 - u) * (1 - u) * Math.abs(Math.cos(u * Math.PI * 1.5)); }
    else { z = rest; const k = Math.floor((t - this.TS) / this.TW), u = (t - this.TS) % this.TW; rock = k < c.shakes && u < 0.6 ? Math.round(Math.sin(u / 0.6 * Math.PI * 2) * 3) * (k % 2 ? -1 : 1) : 0; }
    const x = t < this.TH ? c.x0 + (c.x1 - c.x0) * fly : c.x1, y = t < this.TH ? c.y0 + (c.y1 - c.y0) * fly : c.y1;
    return [{ x, y, z: g, f: () => {
      ADVR.shadow(ctx, x, y, 11, 4);
      ADVUI.thing(c.id, x + rock * 2, y - z, turns);
      if (done) { ctx.fillStyle = '#ffe36b'; for (let i = 0; i < 6; i++) { const a = i * 1.05 + t * 3, d = 14 + (t - end) * 24; ctx.fillRect(Math.round(x + Math.cos(a) * d) - 1, Math.round(y - z + Math.sin(a) * d) - 1, 3, 3); } }
    } }];
  },
  // an item used on a mon in a fight: its icon rises over the target for a moment (this.iu = { id, t, tr }); a revive shows over the trainer, since the mon it wakes is on the bench
  itemFx() {
    const u = this.iu; if (!u || !B) return [];
    const s0 = B.sides[0], ar = B.arena, p = this.p, e = s0.ent, x = u.tr ? p.x : ar.ox + e.x, y = u.tr ? p.y : ar.oy + e.y, g = ar.lv * ar.T;
    return [{ x, y: y + 1, z: g, f: () => {
      const k = Math.min(1, u.t / 0.3), z = (u.tr ? p.z - g : e.z) + 50 + k * 14, a = u.t > 0.75 ? Math.max(0, 1 - (u.t - 0.75) / 0.25) : 1;
      ctx.globalAlpha = a; ADVUI.thing(u.id, x, y - g - z, 0); ctx.globalAlpha = 1;
    } }];
  },
  // the bag is busy for 6 s after any item: a ring fills over the trainer's head
  drawBusy() {
    if (!(this.itemCd > 0)) return;
    const p = this.p, x = Math.round(p.x), y = Math.round(p.y - p.z - 62), g = ctx;
    g.beginPath(); g.arc(x, y, 7, 0, 6.283); g.fillStyle = '#000a'; g.fill(); g.beginPath(); g.moveTo(x, y); g.arc(x, y, 6, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - this.itemCd / 6)); g.closePath(); g.fillStyle = '#ffde3b'; g.fill();
  },

  // back to walking: the partner stays where it stood and walks back to the trail; beaten (and caught) wild mons are gone, the rest go back to wandering.
  // caught = queue index of the mon that was caught, set = its new party mon
  endFight(msg, caught = -1, set) {
    const ar = B.arena, s0 = B.sides[0], s1 = B.sides[1], we = s1.ent, f = this.f, party = this.save.party, ev = this.settle();
    f.x = ar.ox + s0.ent.x; f.y = ar.oy + s0.ent.y; this.back = true;
    const tr = this.tr; this.tr = null; const dead = [];
    if (set) ADVF.note(this.save, 'catch', { nm: DEX.species[toId(set.species)]?.name || set.species });
    else if (msg !== 'Got away safely!') ADVF.note(this.save, 'win', { foe: tr ? tr.t.cls + ' ' + tr.t.name : 'the wild ' + (DEX.species[this.w?.id]?.name || 'Pokemon') });
    Object.assign(f, { free: false, beh: 'follow', plan: null, hopT: 0, doing: '', idleT: 0 });
    if (!tr) this.q.forEach((m, k) => {
      if (s1.team[k].fainted || k === caught) { dead.push(m.nid); return ADVW.kill(m); }
      if (m.st === 'fight') { m.e.x = ar.ox + we.x; m.e.y = ar.oy + we.y; }
      Object.assign(m, { st: 'wander', cool: 4, wait: 2, spot: null, watch: null });
    });
    this.step = null; if (!tr) this.endClaim(msg === 'Got away safely!' ? 'fled' : caught >= 0 ? 'caught' : 'won', dead); else this.net.N.bv([]);
    if (msg !== 'Got away safely!' && window.ADV_MUSIC) this.vic = ADVM.to(tr ? ADV_MUSIC.battle.winTrainer : ADV_MUSIC.battle.winWild, true);   // the win fanfare plays over the zone, which resumes after it
    if (set) { const box = party.length >= 6; (box ? this.save.box : party).push(set); if (box) msg += ' Sent to the PC box.'; }
    this.msg = msg && { s: msg, t: 3 }; this.mode = 'walk'; this.inB = false; B = null; this.wh = null; this.cs = this.iu = null;
    this.refreshLead(); this.persist();
    if (ev.length) this.grow(ev);
    if (tr) { // won: it pays, remembers the defeat, says its goodbye
      const sv = this.save, r = ADVN.win(sv, tr.n, tr.team); this.persist();
      this.dialog([...[].concat(tr.t.lose), `${sv.name} got ${ADVUI.money(r.pay)} for winning!`, ...(r.badge ? [`${sv.name} received the ${r.badge}!`] : []), ...(r.tm ? [`${sv.name} got ${ADVP.item(r.tm).name}!`] : [])], tr.n);
    }
  },
  // whole party down: wake at the Pokemon Center of the last town visited (the hometown to begin with) with a healed party, minus half the money
  blackout() {
    const sv = this.save, lost = Math.floor(sv.money / 2), t = ADVS.town(sv.last || sv.home), at = ADVS.front(t);
    sv.money -= lost; sv.party.forEach(m => ADVP.heal(m)); ADVF.note(sv, 'lose'); sv.pos = at; this.room = null; ADV.closeRoom(); this.heal = this.warpTo = null; this.endClaim('lost', []);
    B = null; this.inB = false; this.back = false; this.mode = 'walk'; this.dismount(); this.wh = null; this.cs = this.iu = null; this.step = null; this.tr = this.sp = this.dlg = this.bang = null; this.net.N.reset(); ADVN.load();
    this.spawn(at); this.skillSync(); this.cam = { x: this.p.x, y: this.p.y - 16 }; this.ready = false; this.key = this.leadKey(); ADV.stream(this.cx(), this.cy());
    this.msg = { s: `You blacked out! Lost ${ADVUI.money(lost)}. You woke up at ${t.name}.`, t: 5 };
  },
  // out-of-battle item use from the bag (target = party index): { ok, s, ev? }
  useBag(id, i) {
    const sv = this.save, s = sv.party[i], it = ADVP.item(id), nm = ADVP.name(s), no = { ok: false, s: `It won't have any effect on ${nm}.` }, time = ADVW.night() ? 'night' : 'day';
    const yes = ev => (this.noteGrow(ev), { ok: true, s: '', ev });
    if (it.stone) { const to = ADVP.evoItem(s, id); if (!to) return no; ADVP.take(sv.bag, id); return yes([{ t: 'evo', s, to }]); }
    if (it.candy) { if (s.level >= 100) return no; ADVP.take(sv.bag, id); return yes(ADVP.gain(s, ADVP.expFor(ADVP.rate(s.species), s.level + 1) - s.exp, { time })); }
    if (it.tm) { if (!ADVP.legalSet(toId(s.species)).has(it.tm) || s.moves.includes(it.tm)) return no; return yes(ADVP.learn(s, it.tm)); } // TMs are not used up
    const mx = ADVP.maxes(s), r = ADVP.useOn(s, id, mx.max, mx.real); if (!r) return no;
    ADVP.take(sv.bag, id); s.friend = Math.min(255, (s.friend | 0) + 2); this.refreshLead();
    return { ok: true, s: r === 'healed' ? `${nm} was healed.` : r === 'cured' ? `${nm} was cured.` : `${nm} was revived.` };
  },
  // everything wild the world draws: roaming mons (not the one in the sim), plus emotes and grass rustles
  wildItems() {
    const out = [], cx = this.cam.x, cy = this.cam.y;
    for (const g of ADVW.groups) for (const w of g.m) { const e = w.e; if (w.st !== 'fight' && Math.abs(e.x - cx) < 700 && Math.abs(e.y - cy) < 600) out.push({ x: e.x, y: e.y, z: e.z, f: () => this.drawWild(w) }); }
    for (const fx of ADVW.fx) {
      if (fx.t < 0) continue;
      const w = fx.w, e = w && (w.st === 'fight' && B ? { x: B.arena.ox + B.sides[1].ent.x, y: B.arena.oy + B.sides[1].ent.y, z: B.arena.lv * B.arena.T } : w.e) || fx;
      out.push({ x: e.x, y: e.y + 2, z: e.z || 0, f: () => this.drawFx(fx, e) });
    }
    return out;
  },
  // a villager's mood bubble (ADVN.life): a small speech balloon with a mark in it, popping in and fading out
  drawBub(n) {
    const g = ctx, e = n.e, b = n.bub, x = Math.round(e.x), a = clamp(Math.min(b.t / 0.15, (2.4 - b.t) / 0.3), 0, 1), y = Math.round(e.y - (e.z || 0)) - 62 - Math.round((1 - Math.min(1, b.t / 0.15)) * 4);
    g.globalAlpha = a; g.fillStyle = '#101428'; g.fillRect(x - 13, y - 11, 26, 20); g.fillRect(x - 3, y + 9, 6, 4);
    g.fillStyle = '#fff'; g.fillRect(x - 12, y - 10, 24, 18); g.fillRect(x - 2, y + 8, 4, 3);
    text(b.s, x, y - 1, 12, b.s === '\u2665' ? '#e03a6a' : b.s === '!' ? '#e03030' : '#101428', 'center', null); g.globalAlpha = 1;
  },
  drawFx(fx, e) {
    const g = ctx, x = Math.round(e.x), y = Math.round(e.y - (e.z || 0));
    if (fx.k === '!') {
      const by = y - 64 - Math.round(Math.sin(Math.min(1, fx.t / 0.15) * Math.PI) * 5);
      g.fillStyle = '#000'; g.fillRect(x - 8, by - 10, 16, 21); g.fillRect(x - 2, by + 11, 5, 3);
      g.fillStyle = '#fff'; g.fillRect(x - 7, by - 9, 14, 19); g.fillRect(x - 1, by + 10, 3, 2);
      g.fillStyle = '#e03030'; g.fillRect(x - 1, by - 6, 3, 9); g.fillRect(x - 1, by + 5, 3, 3);
    } else for (let i = 0; i < 9; i++) { // leaves thrown up by the grass
      const a = i * 0.7 + 0.3, t = fx.t, px = x + Math.cos(a) * t * 60 * (1 + i % 3 * 0.3), py = y - 6 - t * 70 + t * t * 160 + Math.sin(a) * 4;
      g.fillStyle = i % 2 ? '#5fb04a' : '#9ad65e'; g.fillRect(Math.round(px), Math.round(py), 3, 5);
    }
  },
  drawWild(w) {
    const e = w.e; ADVR.shadow(ctx, e.x, e.y - e.sz, 10, 4);
    drawMonSprite(w.key, w.moving ? 'Walk' : 'Idle', w.animT, w.face, e.x, e.y, { z: e.z });
    ADVR.wade(e, 36);
  },
  // an overworld sprite sheet for entity e facing face (0..7). Ranger sheets (ow.anims) carry walk.<dir> and idle.<dir> rows for all 8 facings;
  // HGSS sheets draw only the 4 cardinal rows (diagonals face sideways: generated diagonals looked awful)
  drawOW(ow, face, moving, walkD, e, seat, bike) {   // seat: riding a mon, so no walk cycle, sat lower with the legs hidden in the mount; bike: on the Bike (a sheet with a bike.<dir> row: frame 0 stopped, 1..n-1 the pedal cycle)
    const raw = ow.cv || img(ow.file); if (!raw) return;
    const d8 = ADV_DIRS8[face] || 'down', ride = seat && ow.anims && ow.anims['ride.' + d8], bk = bike && !seat && ow.anims && ow.anims['bike.' + d8];   // ride: a sheet with a seated row per facing (the outfit sheets): no clip, no lowering
    const cut = seat && !ride ? Math.round(ow.footY * SS * 0.3 / ADVR.ART) * ADVR.ART : 0, clipY = ADVR.fq(e.y) - ADVR.fq(e.z); if (seat) { moving = false; e = { ...e, z: e.z - cut }; }
    ADVR.shadow(ctx, e.x, e.y - e.sz, 9, 4);
    let row, f;
    if (ride) { row = ride.row; f = 0; }
    else if (bk) { row = bk.row; f = moving ? 1 + Math.floor(walkD / (ADV_STEP_PX * 2)) % (bk.n - 1) : 0; }   // a pedal stroke per two walk strides: the Bike is 2.5 x a walk
    else if (ow.anims) {
      const d = d8, a = (!moving && ow.anims['idle.' + d]) || ow.anims['walk.' + d] || ow.anims['idle.' + d] || ow.anims['idle.down'];
      row = a.row; f = moving ? Math.floor(walkD / ADV_STEP_PX) % a.n : Math.floor(this.t * a.fps) % a.n;
    } else {
      const rows = ow.rows, rid = n => Math.max(0, rows.indexOf(n));
      row = rid(['down', 'right', 'right', 'right', 'up', 'left', 'left', 'left'][face] || 'down');
      f = moving ? [0, 1, 2, 3][Math.floor(walkD / ADV_STEP_PX) % 4] : 0;
    }
    ADVR.rf = [ADVR.fq(e.y), ADVR.fq(e.z)];
    if (cut) { ctx.save(); ctx.beginPath(); ctx.rect(e.x - 100, clipY - 300, 200, 300); ctx.clip(); }
    drawFrame(outlined(raw, ow.fw, ow.fh), f * ow.fw, row * ow.fh, ow.fw, ow.fh, ADVR.fq(e.x) - Math.round(ow.fw * SS / 2), ADVR.fq(e.y) - ADVR.fq(e.z) - Math.round(ow.footY * SS), null, 1, SS);
    if (cut) ctx.restore();
    ADVR.wade(e, ow.footY * SS);
  },
  // surfing: on a lead that can learn Surf (the follower is the ride, drawn under the trainer) or on a plain raft with the lead swimming behind
  riding() { return !this.inB && (this.mount === 'ride' || this.mount === 'lent' || this.mount === 'fly' || this.p.surf && this.wet() && ADVP.rides(this.save.party[this.leadIdx()])); },   // a ridden lead (or a surf ride) is drawn under the trainer; the Bike is the trainer's own bike.<dir> row
  // z of a rider's seat on mon mk's drawn frame: the rider's legs overlap the mount's back (its opaque top), so the torso neither sinks into a big body nor floats over a small one
  seatZ(mk, an, t, face, loop) {
    const a = animOf(mk, an), im = a && img(a.file); if (!im) return 16;
    const sc = SS * (spriteOf(mk)?.scale || 1), f = animFrame(a, t, loop), row = Math.round(im.naturalHeight / a.fh) >= 8 ? face : 0, hs = ADVR.hard(im, f * a.fw, row * a.fh, a.fw, a.fh);
    return hs.bot < 0 ? 16 : Math.max(12, Math.round(((a.footY - hs.top) - Math.min(11, (hs.bot - hs.top + 1) * 0.6)) * sc));   // the rider's legs (11 sheet rows, a ride row's boots to its knees) sink into the back, at most 60% of a small mount
  },
  drawPlayer() {
    const p = this.p, fl = this.mount === 'fly' && !this.inB, sf = p.surf && this.wet() && !this.inB && !fl, rd = !sf && !fl && (this.mount === 'ride' || this.mount === 'lent') && !this.inB, ow = ADVO.sheet(this.save.outfit) || this.ow, g = ctx; let e = p;
    if (sf) {
      const bob = Math.round(Math.sin(this.t * 3) * 1.5), x = Math.round(p.x), y = Math.round(p.y - p.z);
      if (this.riding()) { const an = p.moving ? 'Walk' : 'Idle', mt = p.moving ? p.walkD / 150 : this.f.animT; ADVR.shadow(g, p.x, p.y - p.sz, 12, 5, 0.2); drawMonSprite(this.key, an, mt, p.face, p.x, p.y + bob, { z: p.z }); e = { x: p.x, y: p.y, z: p.z + this.seatZ(this.key, an, mt, p.face) + bob, sz: p.z + 30 }; }
      else { ADVWA.ripple(x, y + 2, 16); g.fillStyle = '#4a2f18'; g.fillRect(x - 14, y - 3 + bob, 28, 9); g.fillStyle = '#9a6a34'; g.fillRect(x - 13, y - 4 + bob, 26, 7); g.fillStyle = '#c28c4a'; for (let i = -12; i < 12; i += 5) g.fillRect(x + i, y - 4 + bob, 4, 2); g.fillStyle = '#6b4522'; g.fillRect(x - 13, y + 2 + bob, 26, 1); e = { x: p.x, y: p.y, z: p.z + 4 + bob, sz: p.z + 30 }; }
    } else if (rd) { const mk = this.mount === 'lent' ? DEX.species[this.lent.sp].sprite : this.key; const an = p.moving ? 'Walk' : 'Idle', mt = p.moving ? p.walkD / 150 : this.f.animT; ADVR.shadow(g, p.x, p.y - p.sz, 12, 5, 0.2); drawMonSprite(mk, an, mt, p.face, p.x, p.y, { z: p.z }); e = { x: p.x, y: p.y, z: p.z + this.seatZ(mk, an, mt, p.face), sz: p.z + 30 }; }
    else if (fl) { const al = ADVMT.vis(this.alt), bob = Math.round(Math.sin(this.t * 6) * 1.5), fp = this.flyPose(this.key, this.t); ADVR.shadow(g, p.x, p.y - p.z, Math.max(6, 13 - al / 10), Math.max(3, 5 - al / 30), 0.3); const dz = fp.dz ?? bob; drawMonSprite(this.key, fp.anim, fp.t, p.face, p.x, p.y, { z: p.z + al + dz, loop: true, stretch: fp.stretch }); e = { x: p.x, y: p.y, z: p.z + al + this.seatZ(this.key, fp.anim, fp.t, p.face, true) + dz, sz: p.z + al + 30 }; }   // the shadow stays on the ground
    this.seatH = e === p ? 0 : e.z - p.z;   // how high the rider sits (the mount meter floats above it, adv-mount.js)
    this.drawOW(ow, p.face, p.moving && !sf && !fl, p.walkD, e, (sf && this.riding()) || rd || fl, this.mount === 'bike' && !sf && !this.inB); const b = this.net && this.net.N.bubbles.get(this.net.N.pid); if (b) this.drawBubble(p, b.s); },
  // the anim that reads as flight for a mon: PMD Hover, then FlapAround, then a pick by eye (data/adv/fly-anims.js), else Walk
  canClimb() { return this.mount === 'ride' && ADVP.rideKnown(this.save, this.save.party[this.leadIdx()]).includes('boulder'); },   // Bouldering Riding: a rider that knows it climbs rock faces with the meter (adv-mount.js)
  flyAnim(key) { const a = spriteOf(key)?.anims || {}, p = (window.ADV_FLY_ANIM || {})[key], pick = p && p.anim || p; return a.Hover ? 'Hover' : a.FlapAround ? 'FlapAround' : pick && a[pick] ? pick : 'Walk'; },
  // How a Fly mount is posed: a plain entry in data/adv/fly-anims.js only names the anim; an object entry adds a style (bound / float / glide / flap), all from the mon's own PMD frames. dz (whole art px) replaces the default bob when set.
  flyPose(key, t) {
    const p = (window.ADV_FLY_ANIM || {})[key], anim = this.flyAnim(key);
    if (anim === 'FlapAround') return { anim, t: (Math.floor(t * 5) % 2 ? 1.5 : 0.5) / 30 };   // PMD FlapAround spins a full circle at 2 ticks a frame; its first two frames (wings in, wings out) face the row's way, so they alternate as a steady flap
    if (!p || typeof p !== 'object') return { anim, t };
    const a = animOf(key, anim), rate = f => a ? f * (a.durations.reduce((x, y) => x + y, 0) / 60) / a.durations.length : 1;   // fps to a time scale for this anim
    if (p.style === 'glide') return { anim, t: p.at || 0, dz: Math.round(Math.sin(t * 1.5) * 0.9) * 2 };
    if (p.style === 'float') return { anim, t: t * rate(p.fps || 4), dz: Math.round(Math.sin(t * 2) * 1.4) * 2 };
    if (p.style === 'bound') { const T = p.T || 0.6, ph = (t % T) / T, land = ph < 0.1 || ph > 0.9; return { anim, t: t * rate(p.fps || 10), dz: Math.round(4 * ph * (1 - ph) * (p.h || 20) / 2) * 2, stretch: land ? [1.12, 0.88] : ph > 0.25 && ph < 0.75 ? [0.96, 1.05] : undefined }; }
    return { anim, t: t * rate(p.fps || 12) };   // flap
  },
  drawNPC(n) { const ow = ADVN.look(n); if (ow) this.drawOW(ow, n.face, n.moving, n.walkD, n.e); },   // Ranger sheets, or a character-creator look (ADVN.look)
  // every NPC near the view, plus the "!" over a trainer that just spotted you
  npcItems() {
    const out = [], cx = this.cam.x, cy = this.cam.y;
    for (const n of ADVN.list) { const e = n.e; if (e && Math.abs(e.x - cx) < 700 && Math.abs(e.y - cy) < 600 && ADVN.vis(n)) out.push({ x: e.x, y: e.y, z: e.z, f: () => this.drawNPC(n) }); }
    const b = this.bang, e = b && b.n.e; if (e) out.push({ x: e.x, y: e.y + 2, z: e.z, f: () => this.drawFx({ k: '!', t: b.t }, e) });
    for (const n of ADVN.list) if (n.bub && n.e && n !== b?.n && Math.abs(n.e.x - cx) < 700 && Math.abs(n.e.y - cy) < 600 && ADVN.vis(n)) out.push({ x: n.e.x, y: n.e.y + 2, z: n.e.z, f: () => this.drawBub(n) });
    return out;
  },
  drawDlg() {
    const d = this.dlg, pg = d.pages[d.i], vis = Math.floor(d.t * 50), t = d.n && d.n.def.trainer, who = t ? t.cls + ' ' + t.name : d.n && d.n.def.name;
    ADVUI.say(pg, vis, who, vis >= pg.chars);
    if (d.fol) this.drawFolPortrait(d.fol);
  },
  drawFollower() {
    const f = this.f; if (this.riding()) return; ADVR.shadow(ctx, f.x, f.y - f.sz, 10, 4);   // foot and shadow round to whole px the way the player's do, off the same locked camera
    drawMonSprite(this.key, f.anim, f.anim === 'Walk' ? f.walkD / 150 : f.at, f.face, f.x, f.y, { z: f.z, loop: !(f.hopT > 0) });
    ADVR.wade(f, 36);
  },
  // the mood portrait above the right end of the talk box (the box itself is ADVUI.say, untouched)
  drawFolPortrait(o) {
    const d = ADVUI.dlg(), sz = Math.round(d.fs * 4.4), x = d.x + d.w - sz, y = d.y - sz - Math.round(d.g * 0.6), P = window.PORTRAITS?.[o.key];
    const im = img(P && P[o.emo]) || img(spriteOf(o.key)?.portrait);
    rrect(x, y, sz, sz, d.r, '#0b1020ee', '#ffffff40', 2); if (im) ctx.drawImage(im, x + 4, y + 4, sz - 8, sz - 8);
  },
  // is the lead mon in front of you, close enough to talk to?
  folNear() {
    const p = this.p, f = this.f, T = ADV.Tp(p.x), dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy), v = DIR_VEC[p.face];
    return !this.mount && !this.riding() && d <= 2.6 * T && Math.abs(f.z - p.z) < T * 0.6 && (dx * v[0] + dy * v[1]) / (d || 1) > 0.5;
  },
  // A on the lead mon: a line about how it feels or what it is doing, with the portrait for that mood
  talkFollower() {
    const sv = this.save, m = sv.party[this.leadIdx()], sp = DEX.species[toId(m.species)], f = this.f, p = this.p, mood = this.folMood();
    const P = window.PORTRAITS?.[sp.sprite], emo = f.beh === 'sleep' ? ADVF.emotion(['Sigh', 'Normal'], P) : ADVF.emotion(mood.emo, P);
    const s = ADVF.line(mood, { n: ADVP.name(m), sp: sp.name, lv: m.level, friend: m.friend | 0 }, f.doing);
    if (P && P[emo]) preload([P[emo]]);
    p.moving = false; f.want = f.face = dirFromVec(p.x - f.x, p.y - f.y);
    this.dialog([s], { def: { name: ADVP.name(m) }, busy: true });
    this.dlg.fol = { key: sp.sprite, emo };
  },
  draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    const ui = this.uis[this.uis.length - 1];
    if (this.save && !this.ready && this.mode !== 'fade' && this.fadeT >= 2) text(this.err || 'LOADING', VW / 2, VH / 2, 28, '#fff', 'center');
    if (this.ready) this.drawWorld();
    TEXT_MIN = 11;
    if (this.ready) ADVMT.hud(this);   // the flap / buck meter while mounted
    if (this.wh && this.mode === 'battle') ADVUI.wheelDraw(this);
    if (ui) ui.draw();
    else if (this.dlg) this.drawDlg();
    else if (this.msg) ADVUI.notice(this.msg.s);
    if (this.mount === 'lent' && this.lent.kind === 'course' && !ui) ADVUI.notice(`${this.lent.i} / ${this.lent.pts.length}    ${Math.max(0, Math.ceil(this.lent.t))} s`, this.msg ? 1 : 0);
    this.drawNet();
    if (typeof ADVMAP !== 'undefined') ADVMAP.hud(this);
    TEXT_MIN = 0;
    const fa = this.fadeT < 1 ? this.fadeT : this.fadeT < 2 ? 2 - this.fadeT : 0;
    if (fa > 0 && this.save && this.iris && this.p) {   // walking through a cave mouth: the world darkens in hard steps round a closing (then opening) circle of light on you
      const v = this.view(), z = ADVR.zoomFor(), sx = (this.p.x - v.x0) * z, sy = (this.p.y - (this.p.z || 0) - 20 - v.y0) * z;
      const st = Math.min(4, Math.ceil(fa * 4)) / 4, r = Math.max(0, (1 - st) * Math.hypot(VW, VH) * 0.42 + (st < 1 ? 26 * z : 0));
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, 0.35 + 0.65 * st)})`; ctx.beginPath(); ctx.rect(0, 0, VW, VH);
      if (r > 0) ctx.arc(sx, sy, r, 0, Math.PI * 2, true); ctx.fill('evenodd');
    } else if (fa > 0 && this.save) { ctx.fillStyle = `rgba(0,0,0,${fa})`; ctx.fillRect(0, 0, VW, VH); }
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, this.flash * 1.6)})`; ctx.fillRect(0, 0, VW, VH); }
  },
  // the cave is dim: a soft radius of light around you (around the fight while one is on), your lead, every torch and crystal near, daylight at both mouths
  // the glowing zones (G8 Sporehaven and its routes) lie under a dim canopy, darker at night; Route 101's fungus thins toward Duskmoss. The level eases in and out as you cross a zone edge.
  GLOOM: { sporehaven: 1, route2: 1, route101: 0.7 },
  gloom() {
    const p = this.p, z = ADVW.zone(p.x, p.y) || '', g = this.GLOOM[z] || 0, W = window.ADV_WORLD;
    const k = z === 'route101' ? g * clamp(1 - (p.x - W.towns.G8.x - 1400 * ADV.OUT) / (2800 * ADV.OUT), 0.2, 1) : g, dt = Math.min(0.1, this.t - (this.glT ?? this.t));
    this.glT = this.t; return this.gl = this.gl === undefined ? k : this.gl + (k - this.gl) * Math.min(1, dt * 1.5);
  },
  lights() {
    const d = this.room?.d.bld ? null : this.room?.d, p = this.p, f = this.f, out = [];
    if (!d) {
      const h = ADVW.hour(), nf = h < 5 || h >= 21 ? 1 : h < 7 ? (7 - h) / 2 : h >= 19 ? (h - 19) / 2 : 0;
      const W = typeof ADVWX !== 'undefined' ? ADVWX.light() : { veil: 0, lamps: 0 }, lit = Math.max(nf, W.lamps);   // lit: how strongly lamps glow (night, or dim weather)
      const k = Math.max(this.gloom(), 0.78 * nf, W.veil / 0.46) * (this.room?.d.bld ? 1 - this.room.d.bld.k / 3 : 1);   // canopy gloom, night anywhere outdoors, or rain and storm dimming the day; inside a building it fades out with the cutaway
      if (k < 0.02) return { a: 0, tint: '14,6,34', lights: [], glow: { r: 0.6, a: 0, g: 0.25 } };   // a bright day: no veil, just a faint glow pool round each lamp
      out.push({ x: p.x, y: p.y - p.z - 22, r: 84, a: 0.55 }, { x: f.x, y: f.y - f.z - 8, r: 42, a: 0.3 });
      if (this.inB) out.push({ x: this.cam.x, y: this.cam.y, r: 300, a: 0.9 });
      return { a: k * (0.46 + 0.32 * nf), tint: W.veil > 0.78 * nf && W.tint ? W.tint : '14,6,34', lights: out, glow: { r: 1 + 0.15 * lit, a: 0.55 + 0.45 * lit, g: 0.5 + 0.6 * lit } };
    }
    if (!d || !d.dark) return null;
    if (this.inB) out.push({ x: this.cam.x, y: this.cam.y, r: 330, a: 1 }); else out.push({ x: p.x, y: p.y - p.z - 22, r: 150, a: 1 }, { x: f.x, y: f.y - f.z - 8, r: 64, a: 0.5 });
    for (const [x, y, r, warm] of d.lamps || []) out.push({ x, y, r, a: warm ? 0.92 : 0.6, warm: !!warm });
    for (const e of d.exits || []) { const T = ADV.Tc(e.c0); out.push({ x: (e.c0 + e.c1 + 1) / 2 * T, y: ((e.r0 ?? e.r) + (e.r1 ?? e.r) + 1) / 2 * T, r: 210, a: 0.96 }); }
    return { a: d.dark, tint: d.tint || '7,9,20', lights: out, ...(d.glow ? { glow: { r: 1, a: 1, g: 1 } } : {}) };
  },
  drawWorld() {
    const p = this.p, f = this.f;
    if (typeof ADVWX !== 'undefined') ADVWX.update(this.t, p.x, p.y);
    ADVR.dark = this.lights();
    if (this.inB) drawBattle(this.cs || this.uis.length ? 0 : 1 / 60);
    else {
      ADVR.zmW = this.mount === 'fly' ? ADVMT.zoomFor(this.alt, ADVR.zm) : 0;   // the higher you fly, the further away the ground (the flier keeps its size)
      const items = [{ x: p.x, y: p.y, z: p.z + (this.mount === 'fly' ? ADVMT.vis(this.alt) : 0), top: this.mount === 'fly', f: () => this.drawPlayer() }, { x: f.x, y: f.y, z: f.z, f: () => this.drawFollower() }];
      items.push(...this.wildItems(), ...this.npcItems(), ...this.remoteItems(), ...this.castItems(), ...this.courseItems());
      if (this.heal && this.room?.d.mach) items.push({ x: this.room.d.mach.x, y: this.room.d.mach.y + 2, z: 0, f: () => this.drawHeal() });
      ADVR.draw(this.cam, items, this.t);
      if (!this.uis.length && !this.dlg && this.mode === 'walk') { const sv = this.save, rod = sv.skills?.fishing, ld = sv.party[this.leadIdx()], mk = ADVP.mountKind(sv, ld), fy = sv.skills.fly && ADVP.flies(ld); hint(window.TOUCH?.on ? 'hold B run   A talk' + (rod ? '   X cast' : '') : padUI() ? 'stick move   hold B run   A talk   ' + (rod ? 'X cast   ' : '') + (this.mount ? (window.TOUCH?.on ? 'RIDE ' : 'Select ') + (this.mount === 'fly' ? 'land' : 'get off') + '   ' : mk ? (window.TOUCH?.on ? 'RIDE ' : 'Select ') + { bike: 'bike', ride: 'ride', fly: 'fly' }[mk] + '   ' : '') + (window.TOUCH?.on ? 'tap B or MENU for the menu' : 'tap B menu') : 'WASD move   Shift run   E talk   M map   ' + (rod ? 'F cast rod   ' : '') + (this.mount ? (this.mount === 'fly' ? 'G land   ' : 'V / R / G get off   ') : (sv.bag.bike ? 'V bike   ' : '') + (ADVP.rideable(ld) ? 'R ride   ' : '') + (fy ? 'G fly   ' : '')) + (this.chatOn() ? 'Enter chat   ' : '') + 'Esc menu'); }
    }
  },
};
if (location.hash === '#adv') setScene(AdventureScene);
