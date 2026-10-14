// Scenes: title, menu, battle setup, team builder, battle, results. Controller-first, keyboard works too.
'use strict';

const S = () => Math.min(1, VW / 1400, VH / 800);
function bgFill(top = '#1b1f3a', bottom = '#3a1f3f') {
  const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}
// Button names in hint strings become Kenney icons.
const HINT_ICONS = { A: 'xbox_a', B: 'xbox_b', X: 'xbox_x', Y: 'xbox_y', LB: 'xbox_lb', RB: 'xbox_rb', 'left/right': 'xbox_dpad', Delete: 'key_delete', F2: 'key_f2', Enter: 'key_enter', Esc: 'key_esc' };
function hint(s, y = VH - 26) {
  const parts = s.split(/(\bleft\/right\b|\b(?:A|B|X|Y|LB|RB|Delete|F2|Enter|Esc)\b)/).filter(Boolean).map(p => HINT_ICONS[p] || p);
  iconRow(parts, VW / 2, y, 32, Math.max(12, 14 * S()), '#ccd', 'center');
}
function backButton(fn) {
  const s = S(), w = 110 * s, h = 36 * s;
  rrect(16 * s, 16 * s, w, h, 10 * s, '#ffffff22', '#ffffff55', 2);
  text('< BACK', 16 * s + w / 2, 16 * s + h / 2 + 1, 15 * s, '#fff', 'center', null);
  hot(16 * s, 16 * s, w, h, { click: fn });
}
// red button for destructive actions; armed = the next click confirms
function dangerButton(x, y, w, h, label, fn, armed, hover) {
  const s = S(), hov = overRect(x, y, w, h);
  rrect(x, y, w, h, 8 * s, armed ? '#e03a2e' : hov ? '#b0372e' : '#8e2a24', '#fff', 2);
  text(label, x + w / 2, y + h / 2 + 1, Math.max(10, 13 * s), '#fff', 'center', null);
  hot(x, y, w, h, { click: fn, hover });
}
const okHit = () => INPUT.hit('OK') || INPUT.hit('A');
const backHit = () => INPUT.hit('BACKK');
const portrait = id => img(spriteOf(DEX.species[id]?.sprite)?.portrait);

// ---------- teams ----------
function savedTeams() { return STORE.get('teams', null) || [{ name: 'Red (copy)', mons: JSON.parse(JSON.stringify(TRAINERS.find(t => t.id === 'red')?.team || TRAINERS[0].team)) }]; }
function saveTeams(t) { STORE.set('teams', t); }
function blankSet(species = 'bulbasaur') {
  const sp = DEX.species[species];
  const moves = legalMoves(sp).map(id => DEX.moves[id]).filter(m => m.category !== 'Status').sort((a, b) => (b.basePower || 0) - (a.basePower || 0));
  const stab = moves.filter(m => sp.types.includes(m.type));
  const pickM = [...new Set([...stab.slice(0, 2), ...moves.slice(0, 4)])].slice(0, 4).map(m => m.id);
  return { species, level: 50, moves: pickM, ability: sp.abilities[0], item: '', nature: 'Hardy' };
}

// ---------- title ----------
// The title screen is a directed cinematic: a versus card (portraits over scrolling speed lines), then the real engine, CPU against CPU.
// Each pair opens with a scripted laser clash from opposite ends of the arena, then fights on its own.
const TITLE_DUOS = [
  [{ species: 'gengar', level: 50, moves: ['thunderbolt', 'shadowball', 'lick', 'nightshade'] }, { species: 'nidorino', level: 50, moves: ['icebeam', 'hornattack', 'doublekick', 'furyattack'] }],
  [{ species: 'charizard', level: 60, moves: ['blastburn', 'flamethrower', 'airslash', 'dragonclaw'] }, { species: 'blastoise', level: 60, moves: ['hydrocannon', 'hydropump', 'icebeam', 'flashcannon'] }],
  [{ species: 'pikachu', level: 60, moves: ['thunderbolt', 'quickattack', 'irontail', 'thunder'] }, { species: 'raichu', level: 60, moves: ['zapcannon', 'thunderbolt', 'quickattack', 'thunder'] }],
  [{ species: 'mew', level: 70, moves: ['meteorbeam', 'psychic', 'aurasphere', 'shadowball'] }, { species: 'mewtwo', level: 70, moves: ['hyperbeam', 'psystrike', 'aurasphere', 'shadowball'] }],
  [{ species: 'kyogre', level: 70, moves: ['hydropump', 'surf', 'icebeam', 'thunder'] }, { species: 'groudon', level: 70, moves: ['flamethrower', 'earthquake', 'eruption', 'rockslide'] }],
];
const demoCfg = (i, arena) => ({ arena: ARENAS[arena % ARENAS.length], weather: '', player: { name: '', cpu: true, tier: 'hard', team: [TITLE_DUOS[i][0]] }, cpu: { name: '', cpu: true, tier: 'hard', team: [TITLE_DUOS[i][1]] } });
// both fighters turn to face each other and open with their first move together; after that the normal CPU takes over
function titleScript(s, dt) {
  if (B.time > 5) { delete s.script; return; }
  const e = s.ent, fe = foeOf(s).ent, d = Math.hypot(fe.x - e.x, fe.y - e.y) || 1, I = s.intent;
  e.aimX = (fe.x - e.x) / d; e.aimY = (fe.y - e.y) / d; e.aimIdle = 0;
  I.mx = I.my = 0; I.dodge = I.mega = false; I.hold = -1; I.use = -1;
  if (B.time > 0.9 && !s.opened && canUse(s, 0)) { s.opened = true; I.use = 0; }
  else if (s.opened && !e.act && !e.laser) cpuThink(s, dt);
}
const CARD_T = 2.2, ease3 = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const TitleScene = {
  t: 0,
  enter() { AUDIO.playMusic(MUSIC.menu); this.t = 0; this.i = -1; this.mode = 'load'; this.fade = 1; this.fadeCol = '#000'; this.base = Math.random() * ARENAS.length | 0; this.prep(); },
  // load the next pair's art while the current one plays
  prep() { this.i = (this.i + 1) % TITLE_DUOS.length; const cfg = this.nextCfg = demoCfg(this.i, this.base + this.i * 3); this.nextReady = false; preload(assetSrcs(cfg)).then(() => { if (this.nextCfg === cfg) this.nextReady = true; }); },
  card() { this.cur = this.nextCfg; this.duo = TITLE_DUOS[this.i]; this.cardT = 0; this.mode = 'card'; this.fade = 0; this.prep(); },
  begin() {
    startBattle(this.cur); B.demo = true;
    for (const sd of B.sides) { sd.script = titleScript; for (const m of sd.team) { m.maxHp *= 2.5; m.hp = m.maxHp; } } // long fights: nobody dies in the first seconds
    this.clock = 0; this.mode = 'in'; this.fade = 1; this.fadeCol = '#fff';
  },
  update(dt) {
    this.t += dt;
    if (okHit() || INPUT.hit('START') || MOUSE.down) { setScene(MenuScene); return; }
    if (this.mode === 'load') { if (this.nextReady) this.card(); return; }
    if (this.mode === 'card') { this.cardT += dt; if (this.cardT > CARD_T) this.begin(); return; }
    this.clock += dt; updateBattle(dt);
    if (this.mode === 'in') { this.fade -= dt * 2.5; if (this.fade <= 0) { this.fade = 0; this.mode = 'play'; } }
    else if (this.mode === 'play' && (this.clock > 18 || (B.over && B.endT > 0.8))) { this.mode = 'out'; this.fadeCol = '#000'; }
    else if (this.mode === 'out') { this.fade += dt * 2; if (this.fade >= 1 && this.nextReady) this.card(); }
  },
  drawCard() {
    const s = S(), t = this.cardT, ids = this.duo.map(m => toId(m.species)), sps = ids.map(id => DEX.species[id]);
    bgFill('#0a0a14', '#14101e');
    const cols = sps.map(sp => TYPE_COLOR[sp.types[0]]), sk = 0.22 * VH;
    // two slanted colour panels meeting at a diagonal
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = cols[k] + '66'; ctx.beginPath();
      if (!k) { ctx.moveTo(0, 0); ctx.lineTo(VW / 2 + sk, 0); ctx.lineTo(VW / 2 - sk, VH); ctx.lineTo(0, VH); }
      else { ctx.moveTo(VW / 2 + sk, 0); ctx.lineTo(VW, 0); ctx.lineTo(VW, VH); ctx.lineTo(VW / 2 - sk, VH); }
      ctx.closePath(); ctx.fill();
    }
    // scrolling speed lines, fast and slightly diagonal, the way anime does a power-up
    ctx.save(); ctx.rotate(-0.16);
    for (let i = 0; i < 46; i++) {
      const sp = 900 + (i * 37 % 500), len = 140 + (i * 71 % 320), y = ((i * 97) % (VH * 1.4)) - 40, x = ((this.t * sp * (i % 2 ? 1 : -1) + i * 211) % (VW + 600) + VW + 600) % (VW + 600) - 300;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.1; ctx.fillStyle = i % 7 === 0 ? cols[i % 2] : '#fff'; ctx.fillRect(x, y, len, (1 + i % 3) * s);
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // portraits slide in from the edges and settle
    const p = ease3(t / 0.4), PW = Math.min(VW * 0.3, VH * 0.5), bob = Math.sin(t * 3) * 3 * s;
    sps.forEach((sp, k) => {
      const im = portrait(sp.id), x = k ? lerp(VW + PW, VW - PW - VW * 0.08, p) : lerp(-PW * 2, VW * 0.08, p), y = VH * 0.43 - PW * 0.5 + bob * (k ? -1 : 1);
      if (im) { ctx.fillStyle = '#00000055'; ctx.fillRect(x + 6 * s, y + 6 * s, PW, PW); ctx.drawImage(im, x, y, PW, PW); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4 * s; ctx.strokeRect(x, y, PW, PW); }
      const nx = x + PW / 2, ny = y + PW + 30 * s;
      text(sp.name.toUpperCase(), nx, ny, 34 * s, '#fff', 'center', '#000');
      let cx = nx - (sp.types.length * 100 * s) / 2 + 6 * s; for (const ty of sp.types) cx += hudChip(cx, ny + 22 * s, ty.toUpperCase(), TYPE_COLOR[ty], 22 * s) + 6 * s;
    });
    // VS slams in between them
    const v = clamp((t - 0.35) / 0.15, 0, 1), vs = (1 + (1 - v) * 3) * (1 + Math.sin(t * 14) * 0.03);
    if (v > 0) { ctx.globalAlpha = v; text('VS', VW / 2, VH * 0.5, 120 * s * vs, '#ffde3b', 'center', '#1a0a00'); ctx.globalAlpha = 1; }
    if (t > 0.35 && t < 0.5) { ctx.globalAlpha = 0.5 * (1 - (t - 0.35) / 0.15); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    const out = clamp((t - (CARD_T - 0.25)) / 0.25, 0, 1); // flash to white into the fight
    if (out > 0) { ctx.globalAlpha = out; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  },
  draw() {
    const s = S();
    if (this.mode === 'card') this.drawCard();
    else if (B && B.demo && this.mode !== 'load') drawBattle(1 / 60); else bgFill('#101830', '#2c1838');
    // letterbox + title
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH * 0.14); ctx.fillRect(0, VH * 0.86, VW, VH * 0.14);
    text('POKEARENA', VW / 2, VH * 0.07, 54 * s, '#ffde3b', 'center', '#1a2a6c');
    if (Math.floor(this.t * 2) % 2 === 0) text(INPUT.pad ? 'PRESS A' : 'PRESS ENTER', VW / 2, VH * 0.93, 26 * s, '#fff', 'center');
    if (this.fade > 0) { ctx.globalAlpha = clamp(this.fade, 0, 1); ctx.fillStyle = this.fadeCol; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  },
};

// ---------- generic vertical menu ----------
function runMenu(state, items, dt) {
  if (INPUT.menu === 'up') { state.sel = (state.sel + items.length - 1) % items.length; uiBlip(600, 0.03); }
  if (INPUT.menu === 'down') { state.sel = (state.sel + 1) % items.length; uiBlip(600, 0.03); }
  const it = items[state.sel];
  if ((INPUT.menu === 'left' || INPUT.menu === 'right') && it.cycle) { it.cycle(INPUT.menu === 'left' ? -1 : 1); uiBlip(700, 0.03); }
  if (okHit() && it.act) { uiBlip(880, 0.05); it.act(); }
}
function drawMenu(items, state, x, y, w, rowH = 54) {
  const s = S(), sel = state.sel;
  items.forEach((it, i) => {
    const yy = y + i * rowH * s, on = i === sel;
    hot(x - w / 2, yy, w, (rowH - 8) * s, { hover: () => state.sel = i, click: fx => { state.sel = i; uiBlip(880, 0.05); if (it.act) it.act(); else if (it.cycle) it.cycle(fx < 0.75 ? -1 : 1); }, wheel: d => it.cycle && it.cycle(d) });
    rrect(x - w / 2, yy, w, (rowH - 8) * s, 12 * s, on ? '#ffde3bee' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
    if (it.value !== undefined) {
      text(it.label, x - w / 2 + 20 * s, yy + (rowH - 8) * s / 2, 18 * s, on ? '#1a1a2a' : '#fff', 'left', null);
      text(`${it.cycle ? '< ' : ''}${it.value}${it.cycle ? ' >' : ''}`, x + w / 2 - 20 * s, yy + (rowH - 8) * s / 2, 18 * s, on ? '#1a1a2a' : '#ffde3b', 'right', null);
    } else text(it.label, x, yy + (rowH - 8) * s / 2, 22 * s, on ? '#1a1a2a' : '#fff', 'center', null);
  });
}

const MenuScene = {
  st: { sel: 0 },
  enter() { AUDIO.playMusic(MUSIC.menu); },
  items() {
    return [
      { label: 'Battle', act: () => setScene(SetupScene) },
      { label: 'Online', act: () => setScene(OnlineScene) },
      { label: 'Profile', value: profileName(), act: () => { ProfileScene.back = null; setScene(ProfileScene); } },
      { label: 'Team Builder', act: () => setScene(TeamsScene) },
      { label: 'Controls', act: () => { ControlsScene.back = null; setScene(ControlsScene); } },
      { label: 'Music Volume', value: Math.round(AUDIO.vol.music * 10), cycle: d => { AUDIO.vol.music = clamp(AUDIO.vol.music + d * 0.1, 0, 1); if (AUDIO.music) AUDIO.music.volume = AUDIO.vol.music; STORE.set('vol', AUDIO.vol); } },
      { label: 'SFX Volume', value: Math.round(AUDIO.vol.sfx * 10), cycle: d => { AUDIO.vol.sfx = clamp(AUDIO.vol.sfx + d * 0.1, 0, 1); STORE.set('vol', AUDIO.vol); uiBlip(700); } },
    ];
  },
  update(dt) { runMenu(this.st, this.items(), dt); if (backHit()) setScene(TitleScene); },
  draw() { bgFill(); const s = S(); text('POKEARENA', VW / 2, 90 * s, 56 * s, '#ffde3b', 'center', '#1a2a6c'); drawMenu(this.items(), this.st, VW / 2, 170 * s, 520 * s, 64); hint(INPUT.usingPad ? 'A select   B back   left/right change' : 'Click to select   right-click back   scroll to change'); backButton(() => setScene(TitleScene)); },
};

// ---------- profile: trainer name + avatar (shown in battle, the online lobby and the team cards) ----------
const profileName = () => String(STORE.get('playerName', '') || '').replace(/[^\w .'-]/g, '').trim().slice(0, 12) || 'You';
const profileAvatar = () => cleanAvatar(STORE.get('playerAvatar', '')) || AVATAR_DEFAULT;
// small clickable "avatar + name" chip that opens the profile and comes back to `from`
function profileChip(x, y, w, h, from) {
  const s = S(), on = overRect(x, y, w, h);
  rrect(x, y, w, h, 10 * s, on ? '#ffffff2e' : '#ffffff14', on ? '#fff' : '#ffffff55', 2);
  avatarTile(profileAvatar(), x + 5 * s, y + 5 * s, h - 10 * s);
  text(profileName(), x + h + 2 * s, y + h / 2 + 1, Math.max(10, 14 * s), '#fff', 'left', null);
  hot(x, y, w, h, { click: () => { ProfileScene.back = from; uiBlip(880, 0.05); setScene(ProfileScene); } });
}
const ProfileScene = {
  back: null, // scene to return to; null = main menu
  st: { sel: 0, off: 0 }, name: '', cur: '', ate: false, follow: true, cols: 10, rows: 7,
  enter() {
    AUDIO.playMusic(MUSIC.menu);
    this.name = String(STORE.get('playerName', '') || '').replace(/[^\w .'-]/g, '').slice(0, 12); this.cur = profileAvatar();
    this.st.sel = Math.max(0, (window.TRAINER_AVATARS || []).findIndex(a => a.id === this.cur)); this.follow = true;
    this.keyFn = e => this.onKey(e); window.addEventListener('keydown', this.keyFn);
  },
  exit() { window.removeEventListener('keydown', this.keyFn); },
  setName(n) { this.name = String(n).replace(/[^\w .'-]/g, '').slice(0, 12); STORE.set('playerName', this.name.trim()); },
  // like the species search box: letters go to the name, so WASD / Space / Backspace stop acting as menu keys while it is open
  onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') this.setName(this.name.slice(0, -1));
    else if (e.key.length === 1 && /[\w .'-]/.test(e.key) && (e.key !== ' ' || this.name) && this.name.length < 12) this.setName(this.name + e.key);
    else return;
    this.ate = true; e.preventDefault();
  },
  choose(i) { const a = (window.TRAINER_AVATARS || [])[i]; if (a) { this.cur = a.id; STORE.set('playerAvatar', a.id); uiBlip(880, 0.05); } },
  rename() { const c = window.prompt('Your name (12 letters max)', this.name); if (c !== null) this.setName(c); },
  update() {
    const n = (window.TRAINER_AVATARS || []).length, st = this.st, c = this.cols;
    const dir = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(k => KEYS[k]) ? '' : INPUT.menu;
    if (dir) {
      const o = st.sel;
      st.sel = dir === 'left' ? Math.max(0, o - 1) : dir === 'right' ? Math.min(n - 1, o + 1) : dir === 'up' ? (o >= c ? o - c : o) : Math.min(n - 1, o + c);
      if (st.sel !== o) { this.follow = true; uiBlip(600, 0.03); }
    }
    if (okHit() && !this.ate) this.choose(st.sel);
    if (INPUT.hit('X')) this.rename();
    if (backHit() && !this.ate) setScene(this.back || MenuScene);
    this.ate = false;
  },
  draw() {
    bgFill('#101830', '#2c1838');
    const { X, Y, L } = layout(), A = window.TRAINER_AVATARS || [], st = this.st, c = this.cols, r = this.rows, pitch = 80, n = A.length;
    text('PROFILE', X(660), Y(50), L(44), '#ffde3b', 'center', '#1a2a6c');
    backButton(() => setScene(this.back || MenuScene));
    // ----- left: preview + name -----
    panel(X(0), Y(96), L(440), L(660), 'YOUR TRAINER');
    avatarTile(this.cur, X(100), Y(150), L(240), '#ffde3b');
    text((avatarById(this.cur)?.name || '').toUpperCase(), X(220), Y(412), L(18), '#aab4c8', 'center', null);
    text('NAME', X(30), Y(470), L(14), '#ffde3b', 'left', null);
    rrect(X(30), Y(486), L(380), L(60), L(12), '#00000066', '#ffde3b', 2);
    const caret = Math.floor(performance.now() / 500) % 2 ? '_' : ' ';
    text(this.name ? this.name + caret : 'You' + caret, X(46), Y(517), L(26), this.name ? '#fff' : '#ffffff66', 'left', null);
    text(`${this.name.length} / 12`, X(410), Y(564), L(12), '#9aa6c0', 'right', null, 'Silkscreen');
    text(INPUT.usingPad ? 'Press X to type a name' : 'Just type. Backspace deletes.', X(30), Y(564), L(12), '#9aa6c0', 'left', null, 'Silkscreen');
    rrect(X(30), Y(590), L(380), L(46), L(10), '#ffffff14', '#ffffff55', 2); text('EDIT NAME', X(220), Y(614), L(16), '#fff', 'center', null);
    hot(X(30), Y(590), L(380), L(46), { click: () => this.rename() });
    // ----- right: avatar grid -----
    panel(X(470), Y(96), L(850), L(660), 'CHOOSE A PORTRAIT', A[st.sel] ? A[st.sel].name.toUpperCase() : '');
    const trows = Math.ceil(n / c), mo = Math.max(0, trows - r), x0 = X(485), y0 = Y(140);
    if (this.follow) { const row = Math.floor(st.sel / c); st.off = row < st.off ? row : row >= st.off + r ? row - r + 1 : st.off; this.follow = false; } // scroll only when the keys leave the view
    st.off = clamp(st.off, 0, mo);
    hot(x0, y0, L(pitch * c), L(pitch * r), { wheel: d => { st.off = clamp(st.off + d, 0, mo); } }); // registered first so the cells sit on top
    for (let i = st.off * c; i < Math.min(n, (st.off + r) * c); i++) {
      const x = x0 + (i % c) * L(pitch), y = y0 + (Math.floor(i / c) - st.off) * L(pitch), sz = L(72), cur = A[i].id === this.cur, on = i === st.sel;
      hot(x, y, sz, sz, { hover: () => { st.sel = i; }, click: () => { st.sel = i; this.choose(i); }, wheel: d => { st.off = clamp(st.off + d, 0, mo); } });
      rrect(x, y, sz, sz, L(10), on ? '#ffffff30' : '#ffffff10', cur ? '#ffde3b' : on ? '#fff' : '#ffffff22', cur ? 4 : on ? 3 : 2);
      drawAvatar(A[i].id, x + L(6), y + L(6), sz - L(12));
    }
    // scrollbar: click or drag the track, or use the wheel
    const bx = x0 + L(pitch * c) + L(4), bw = L(12), th = L(pitch * r - 8);
    ctx.fillStyle = '#ffffff18'; ctx.fillRect(bx, y0, bw, th);
    if (mo > 0) {
      const kh = Math.max(L(24), th * r / trows), ky = y0 + (th - kh) * st.off / mo, jump = () => { st.off = clamp(Math.round((MOUSE.y - y0 - kh / 2) / (th - kh) * mo), 0, mo); };
      ctx.fillStyle = st.drag ? '#fff' : '#ffde3b'; ctx.fillRect(bx, ky, bw, kh);
      hot(bx - 6, y0, bw + 12, th, { click: () => { st.drag = true; jump(); }, wheel: d => { st.off = clamp(st.off + d, 0, mo); } });
      if (st.drag) { if (MOUSE.down) jump(); else st.drag = false; }
    }
    hint(INPUT.usingPad ? 'D-pad browse   A pick   X type a name   B back' : 'Click a portrait   arrows or scroll browse   Enter pick   Esc back');
  },
};

const ControlsScene = {
  back: null, // the scene to return to (the pause menu sets this); null = main menu
  update() { if (backHit() || okHit()) setScene(this.back || MenuScene); },
  draw() {
    bgFill(); const s = S();
    text('CONTROLS', VW / 2, 60 * s, 44 * s, '#ffde3b', 'center');
    const rows = [
      ['Move', ['xbox_ls'], ['key_w', 'key_a', 'key_s', 'key_d']], ['Aim', ['xbox_rs', ' held ~1s after release'], ['mouse', ' cursor, always']],
      ['Move 1', ['xbox_a'], ['mouse_left']], ['Move 2', ['xbox_b'], ['mouse_right']], ['Move 3', ['xbox_x'], ['key_q']], ['Move 4', ['xbox_y'], ['key_e']],
      ['Dodge roll', ['xbox_lb'], ['key_space', ' or ', 'key_shift']], ['Swap', ['xbox_rb', ' hold, point a stick, release'], ['key_1', 'key_2', 'key_3', 'key_4', 'key_5', 'key_6', ' party slot']],
      ['Mega Evolve', ['xbox_lt', ' + ', 'xbox_rt'], ['key_f']], ['Pause', ['xbox_start'], ['key_esc', ' or P']],
    ];
    const RH = Math.max(36, 40 * s), ih = 32;
    text('ACTION', VW / 2 - 400 * s, 110 * s, 16 * s, '#9ab', 'left'); text('CONTROLLER', VW / 2 - 200 * s, 110 * s, 16 * s, '#7fd0e8', 'left'); text('KEYBOARD + MOUSE', VW / 2 + 150 * s, 110 * s, 16 * s, '#7be07b', 'left');
    rows.forEach(([a, p, k], i) => { const y = 145 * s + i * RH; text(a, VW / 2 - 400 * s, y, 16 * s, '#fff', 'left', null); iconRow(p, VW / 2 - 200 * s, y, ih, 13 * s, '#cde'); iconRow(k, VW / 2 + 150 * s, y, ih, 13 * s, '#cde'); });
    text('Hold a move button to fire it the moment its cooldown ends. Pressing a little early is buffered.', VW / 2, 145 * s + rows.length * RH + 6 * s, 14 * s, '#ffe7a8', 'center', null);
    // live controller readout, so a pad that isn't being read is obvious
    const y0 = 145 * s + rows.length * RH + 46 * s, pads = INPUT.pads || [];
    if (!pads.length) {
      const slots = navigator.getGamepads ? [...navigator.getGamepads()] : null;
      text('No controller detected. Press any button on it while this window is focused.', VW / 2, y0, 15 * s, '#ff9a9a', 'center', null);
      text(`Browser check: gamepad API ${slots ? 'yes' : 'NO'}, secure page ${window.isSecureContext ? 'yes' : 'NO'} (${location.protocol}), slots ${slots ? slots.length : '-'} all empty, connect events ${PAD_EVENTS.n}${PAD_EVENTS.last ? ' (' + PAD_EVENTS.last.slice(0, 40) + ')' : ''}`, VW / 2, y0 + 22 * s, 12 * s, '#ccd', 'center', null);
      text('Open hardwaretester.com/gamepad in this same browser. If it sees nothing either, Windows or Steam is hiding the pad from the browser, not the game.', VW / 2, y0 + 42 * s, 12 * s, '#ccd', 'center', null);
    }
    pads.forEach((p, i) => {
      const pressed = p.buttons.map((b, k) => b.pressed || b.value > 0.5 ? k : -1).filter(k => k >= 0);
      text(`Pad ${i + 1}: ${p.id.slice(0, 60)}  [${p.mapping || 'non-standard'}]`, VW / 2, y0 + i * 44 * s, 14 * s, p.mapping === 'standard' ? '#9f9' : '#fc9', 'center', null);
      text(`buttons: ${pressed.join(' ') || '-'}   sticks: ${[...p.axes].slice(0, 4).map(a => a.toFixed(2)).join(' ')}`, VW / 2, y0 + i * 44 * s + 20 * s, 12 * s, '#ccd', 'center', null);
    });
    hint('B / right-click back'); backButton(() => setScene(this.back || MenuScene));
  },
};

// ---------- battle setup ----------
const DIFFS = ['default', 'easy', 'normal', 'hard', 'champion'];
const WEATHERS = ['', 'sun', 'rain', 'sand', 'snow'];
// the chosen lead goes out first; the rest keep their order
const leadFirst = (mons, i) => { i = clamp(i | 0, 0, mons.length - 1); return [mons[i], ...mons.filter((_, k) => k !== i)]; };
const leadName = (mons, i) => { const m = mons[clamp(i | 0, 0, mons.length - 1)]; return m ? DEX.species[toId(m.species)]?.name || m.species : ''; };
const SetupScene = {
  st: { sel: 0, team: 0, opp: 0, diff: 0, arena: -1, weather: 0, lead: 0 },
  enter() { AUDIO.playMusic(MUSIC.menu); const st = STORE.get('setup', null); if (st) Object.assign(this.st, st, { sel: 0 }); },
  items() {
    const st = this.st, teams = savedTeams(), tr = TRAINERS[st.opp];
    st.team = clamp(st.team, 0, teams.length - 1);
    return [
      { label: 'Your team', value: teams[st.team].name, cycle: d => st.team = (st.team + d + teams.length) % teams.length },
      { label: 'Lead Pokemon', value: leadName(teams[st.team].mons, st.lead), cycle: d => { const n = teams[st.team].mons.length; st.lead = (clamp(st.lead, 0, n - 1) + d + n) % n; } },
      { label: 'Opponent', value: `${tr.title} ${tr.name}`, cycle: d => st.opp = (st.opp + d + TRAINERS.length) % TRAINERS.length },
      { label: 'Difficulty', value: st.diff ? DIFFS[st.diff] : `${tr.difficulty} (default)`, cycle: d => st.diff = (st.diff + d + DIFFS.length) % DIFFS.length },
      { label: 'Arena', value: st.arena < 0 ? 'Random' : ARENAS[st.arena].name, cycle: d => st.arena = ((st.arena + 1 + d + ARENAS.length + 1) % (ARENAS.length + 1)) - 1 },
      { label: 'Starting weather', value: st.weather ? WEATHERS[st.weather] : 'None', cycle: d => st.weather = (st.weather + d + WEATHERS.length) % WEATHERS.length },
      { label: 'FIGHT!', act: () => this.go() },
    ];
  },
  go() {
    const st = this.st, team = savedTeams()[st.team], tr = TRAINERS[st.opp];
    STORE.set('setup', st);
    const arena = st.arena < 0 ? pick(ARENAS) : ARENAS[st.arena];
    const cfg = {
      arena, weather: WEATHERS[st.weather],
      player: { name: profileName(), avatar: profileAvatar(), sprite: avatarSprite(profileAvatar()), team: leadFirst(team.mons, st.lead) },
      cpu: { name: tr.name, cpu: true, tier: st.diff ? DIFFS[st.diff] : tr.difficulty, sprite: tr.sprite, avatar: cpuAvatar(tr.id), team: tr.team },
      music: tr.music || arena.music,
    };
    setScene(LoadingScene(cfg));
  },
  update(dt) { runMenu(this.st, this.items(), dt); if (backHit()) setScene(MenuScene); },
  draw() {
    bgFill(); const s = S(); text('BATTLE', VW / 2, 70 * s, 48 * s, '#ffde3b', 'center');
    profileChip(VW - 220 * s, 16 * s, 204 * s, 40 * s, SetupScene);
    drawMenu(this.items(), this.st, VW / 2 - 140 * s, 130 * s, 640 * s, 62);
    // preview both teams: big portraits with names, your lead marked
    const tr = TRAINERS[this.st.opp], mine = savedTeams()[this.st.team], lead = clamp(this.st.lead | 0, 0, mine.mons.length - 1);
    const x0 = VW / 2 - 140 * s + 320 * s + 24 * s, pw = VW - x0 - 20 * s, tw = pw / 3, ps = Math.min(tw - 10 * s, 96 * s), th = ps + 22 * s;
    const tiles = (mons, y, leadI) => mons.forEach((m, i) => {
      const x = x0 + (i % 3) * tw + (tw - ps) / 2, yy = y + Math.floor(i / 3) * th, im = portrait(toId(m.species)), on = i === leadI;
      rrect(x - 3 * s, yy - 3 * s, ps + 6 * s, ps + 6 * s, 6 * s, on ? '#ffde3b44' : '#00000044', on ? '#ffde3b' : '#ffffff33', on ? 3 : 2);
      if (im) ctx.drawImage(im, x, yy, ps, ps);
      const nm = DEX.species[toId(m.species)]?.name || m.species;
      text(nm.length > 11 ? nm.slice(0, 10) + '.' : nm, x + ps / 2, yy + ps + 13 * s, Math.max(9, 10 * s), on ? '#ffde3b' : '#dde', 'center', null, 'Silkscreen');
      if (on) { const bw = 38 * s; rrect(x, yy, bw, 14 * s, 4 * s, '#ffde3b'); text('LEAD', x + bw / 2, yy + 7 * s + 1, Math.max(8, 9 * s), '#111', 'center', null, 'Silkscreen'); }
    });
    text('YOU', x0, 118 * s, 18 * s, '#7be07b', 'left');
    tiles(mine.mons, 134 * s, lead);
    const oy = 134 * s + Math.ceil(mine.mons.length / 3) * th + 22 * s;
    text(tr.name.toUpperCase(), x0, oy, 18 * s, '#7fd0e8', 'left');
    const tim = img(tr.sprite); if (tim) ctx.drawImage(tim, x0 + pw - 56 * s, oy - 28 * s, 56 * s, 56 * s);
    tiles(tr.team, oy + 18 * s, -1);
    hint(INPUT.usingPad ? 'left/right change   A fight   B back' : 'Click a row to change it (left side -, right side +)   scroll also changes'); backButton(() => setScene(MenuScene));
  },
};

// startBattle plus the trainer avatars, which the sim itself does not know about (the HUD reads side.avatar)
function startBattleA(cfg) { startBattle(cfg); B.sides[0].avatar = cfg.player.avatar; B.sides[1].avatar = cfg.cpu.avatar; }
// CPU trainers with a close Showdown match (same id, or the LGPE variant)
const cpuAvatar = id => cleanAvatar(id) || cleanAvatar(id + '-lgpe') || undefined;

// every image/sound a battle will draw, so it can be loaded up front
function assetSrcs(cfg) {
  const srcs = [cfg.arena.bg, ...Object.values(cfg.arena.props || {}), cfg.player.sprite, cfg.cpu.sprite, avatarById(cfg.player.avatar)?.file, avatarById(cfg.cpu.avatar)?.file];
  for (const set of [...cfg.player.team, ...cfg.cpu.team]) {
    const sp = DEX.species[toId(set.species)]; if (!sp) continue;
    const keys = [sp.sprite, ...(sp.megas || []).map(id => DEX.species[id]?.sprite)];
    for (const k of keys) { const s = spriteOf(k); if (s) { srcs.push(s.portrait, ...Object.values(s.anims).map(a => a.file), ...Object.values(window.PORTRAITS?.[k] || {})); } }
    for (const id of set.moves || []) { const mv = DEX.moves[toId(id)]; if (mv?.fx) for (const n of [...(mv.fx.anims || []), mv.fx.hitAnim]) if (n && VFX.particles[n]) srcs.push(VFX.particles[n].file); if (mv?.fx?.beam && VFX.beams[mv.fx.beam]) srcs.push(...['head', 'body', 'tail'].map(k => VFX.beams[mv.fx.beam][k])); }
  }
  return [...new Set(srcs.filter(Boolean))];
}
function LoadingScene(cfg) {
  let done = false;
  let got = 0, total = 1, sentP = -1;
  // online: each side tells the other how far its loading has got
  preload(assetSrcs(cfg), (d, n) => { got = d; total = n; const p = Math.floor(d / n * 20) / 20; if (NET.role && p !== sentP) { sentP = p; NETSYNC.send({ t: 'load', p }); } }).then(() => done = true);
  return {
    t: 0,
    update(dt) {
      this.t += dt;
      if (NET.role && backHit()) return netLeave('');
      if (done && this.t > 0.3) { try { startBattleA(cfg); } catch (e) { if (NET.role) return netLeave('Could not start the match: ' + e.message); throw e; } setScene(BattleScene(cfg)); }
    },
    draw() {
      bgFill('#000', '#111'); const s = S(), f = got / total;
      if (cfg.player.avatar && cfg.cpu.avatar) vsCards(VW / 2, VH / 2 - 210 * s, 90 * s, cfg.player, cfg.cpu);
      text('Loading...', VW / 2, VH / 2 - 40 * s, 30 * s, '#fff', 'center');
      rrect(VW / 2 - 220 * s, VH / 2, 440 * s, 18 * s, 9 * s, '#ffffff18', '#ffffff55', 2); rrect(VW / 2 - 218 * s, VH / 2 + 2 * s, 436 * s * f, 14 * s, 7 * s, '#ffde3b');
      text(Math.round(f * 100) + '%', VW / 2, VH / 2 + 44 * s, 16 * s, '#fff', 'center');
      if (NET.role) text(`Opponent: ${Math.round(NET.peerLoad * 100)}%`, VW / 2, VH / 2 + 76 * s, 15 * s, '#aab4c8', 'center', null);
    },
  };
}

// ---------- battle ----------
function BattleScene(cfg) {
  return {
    pause: { sel: 0, arm: -1 }, res: { sel: 0 },
    enter() { AUDIO.playMusic(cfg.music); if (NET.role === 'host') NETSYNC.begin(); else if (NET.role === 'guest') NETSYNC.send({ t: 'ready' }); },
    update(dt) {
      if (NET.role) return onlineBattleUpdate(this, dt);
      if (B.paused) {
        const items = this.pauseItems();
        if (this.pause.arm !== this.pause.sel) this.pause.arm = -1;
        runMenu(this.pause, items, dt);
        if (INPUT.hit('START') || backHit()) B.paused = false;
        return;
      }
      if (B.over) {
        updateBattle(dt);
        if (B.endT > 1.5) { if (okHit()) { startBattleA(cfg); this.res.sel = 0; AUDIO.playMusic(cfg.music); } else if (backHit() || INPUT.hit('START')) setScene(SetupScene); }
        return;
      }
      if (B.choose) {
        const c = B.choose, side = B.sides[c.side], n = side.team.length;
        if (INPUT.menu === 'right' || INPUT.menu === 'down') { do c.sel = (c.sel + 1) % n; while (side.team[c.sel].fainted); uiBlip(600, 0.03); }
        if (INPUT.menu === 'left' || INPUT.menu === 'up') { do c.sel = (c.sel + n - 1) % n; while (side.team[c.sel].fainted); uiBlip(600, 0.03); }
        if (okHit()) confirmChoose();
        updateBattle(dt); return;
      }
      if (INPUT.hit('START')) { B.paused = true; this.pause.sel = 0; this.pause.arm = -1; return; }
      updateBattle(dt);
    },
    pauseItems() {
      if (NET.role) return [...(B.pausedBy === meIdx() ? [{ label: 'Resume', act: netResume }] : []), { label: 'Leave match', act: () => netLeave('') }];
      // Restart and Quit throw the fight away, so the first press only arms them
      const p = this.pause, ask = (i, label, fn) => ({ label: p.arm === i && p.sel === i ? 'Sure? Press again' : label, act: () => { if (p.arm === i) { p.arm = -1; fn(); } else p.arm = i; } });
      return [
        { label: 'Resume', act: () => B.paused = false },
        { label: 'Controls', act: () => { ControlsScene.back = this; setScene(ControlsScene); } },
        ask(2, 'Restart', () => { startBattleA(cfg); }),
        ask(3, 'Quit to setup', () => setScene(SetupScene)),
      ];
    },
    draw() {
      drawBattle(B.paused ? 0 : 1 / 60);
      if (NET.role === 'host' && !NET.guestReady) { onlineOverlay(); return; }
      const s = S();
      if (B.choose && NET.role && B.choose.side !== meIdx()) text('Opponent is choosing...', VW / 2, VH * 0.3, 28 * s, '#fff', 'center');
      else if (B.choose) {
        const c = B.choose, side = B.sides[c.side];
        ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, VW, VH);
        text('CHOOSE YOUR NEXT POKEMON', VW / 2, VH * 0.3, 32 * s, '#ffde3b', 'center');
        side.team.forEach((m, i) => {
          const x = VW / 2 + (i - 2.5) * 130 * s, y = VH * 0.45, on = i === c.sel;
          if (!m.fainted) hot(x - 55 * s, y - 55 * s, 110 * s, 130 * s, { hover: () => c.sel = i, click: () => { c.sel = i; confirmChoose(); } });
          rrect(x - 55 * s, y - 55 * s, 110 * s, 130 * s, 12 * s, on ? '#ffde3b' : '#ffffff22', '#fff', 2);
          const im = img(spriteOf(m.sp.sprite)?.portrait); if (im) { ctx.globalAlpha = m.fainted ? 0.25 : 1; ctx.drawImage(im, x - 40 * s, y - 45 * s, 80 * s, 80 * s); ctx.globalAlpha = 1; }
          text(m.sp.name, x, y + 50 * s, 12 * s, on ? '#111' : '#fff', 'center', null);
          ctx.fillStyle = m.fainted ? '#444' : '#5ad25a'; ctx.fillRect(x - 40 * s, y + 62 * s, 80 * s * m.hp / m.maxHp, 5 * s);
        });
        text(`Auto-picks in ${Math.ceil(c.t)}`, VW / 2, VH * 0.68, 16 * s, '#ccc', 'center');
      }
      if (B.paused) {
        ctx.fillStyle = '#000b'; ctx.fillRect(0, 0, VW, VH);
        text('PAUSED', VW / 2, VH * 0.25, 48 * s, '#ffde3b', 'center');
        if (NET.role && B.pausedBy !== meIdx()) text(`${B.sides[B.pausedBy]?.name || 'Your opponent'} paused the game`, VW / 2, VH * 0.25 + 50 * s, 20 * s, '#fff', 'center');
        drawMenu(this.pauseItems(), this.pause, VW / 2, VH * 0.35, 380 * s, 60);
        hint(INPUT.usingPad ? 'A select   B resume' : 'Click to select   Esc resume', VH * 0.35 + 4 * 60 * s + 16 * s);
      }
      if (B.over && B.endT > 0.8) {
        const mi = meIdx(), win = B.winner === mi, me = B.sides[mi], foe = B.sides[1 - mi];
        ctx.fillStyle = `rgba(0,0,0,${clamp((B.endT - 0.8) * 1.5, 0, 0.7)})`; ctx.fillRect(0, 0, VW, VH);
        text(win ? 'YOU WIN!' : 'YOU LOST', VW / 2, VH * 0.3, 80 * s, win ? '#ffde3b' : '#ff7a7a', 'center', '#000');
        text(win ? `${foe.name} was defeated!` : `${foe.name} wins.`, VW / 2, VH * 0.3 + 70 * s, 22 * s, '#fff', 'center');
        const t = Math.floor(B.time);
        const cw = 150 * s, ch = 64 * s, cg = 12 * s, cx0 = VW / 2 - (cw * 4 + cg * 3) / 2, cy = VH * 0.42;
        [['TIME', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`], ['HITS', me.hits], ['DAMAGE DEALT', me.dealt], ['MONS LEFT', `${remaining(me)} / ${me.team.length}`]].forEach(([l, v], i) => {
          const bx = cx0 + i * (cw + cg);
          rrect(bx, cy, cw, ch, 10 * s, '#ffffff18', '#ffffff55', 2);
          text(String(v), bx + cw / 2, cy + 24 * s, 24 * s, '#ffde3b', 'center', null);
          text(l, bx + cw / 2, cy + ch - 15 * s, Math.max(10, 13 * s), '#bcd', 'center', null);
        });
        if (B.endT > 1.5) {
          const bw = 220 * s, bh = 50 * s, by = VH * 0.62;
          (NET.role ? [NET.role === 'host' ? ['REMATCH', onlineRematch] : ['WAITING FOR HOST', () => {}], ['LEAVE', () => netLeave('')]] : [['REMATCH', () => { startBattleA(cfg); AUDIO.playMusic(cfg.music); }], ['BACK TO SETUP', () => setScene(SetupScene)]]).forEach(([l, fn], i) => {
            const bx = VW / 2 + (i ? 20 * s : -bw - 20 * s);
            rrect(bx, by, bw, bh, 12 * s, i ? '#ffffff22' : '#ffde3b', '#fff', 2); text(l, bx + bw / 2, by + bh / 2 + 1, 18 * s, i ? '#fff' : '#111', 'center', null);
            hot(bx, by, bw, bh, { click: fn });
          });
          hint(INPUT.usingPad ? 'A rematch    B back to setup' : 'Enter rematch    Esc back to setup');
        }
      }
    },
  };
}

// ---------- team list ----------
const TeamsScene = {
  st: { sel: 0, del: -1 },
  enter() { AUDIO.playMusic(MUSIC.builder || MUSIC.menu); },
  items() {
    const teams = savedTeams();
    return [
      ...teams.map((t, i) => ({ label: t.name.length > 17 ? t.name.slice(0, 16) + '.' : t.name, value: '', act: () => setScene(EditScene(i)) })),
      { label: '+ New team', act: () => { const t = savedTeams(); t.push({ name: `Team ${t.length + 1}`, mons: [blankSet()] }); saveTeams(t); setScene(EditScene(t.length - 1)); } },
      { label: '+ Copy a trainer team', act: () => setScene(CopyScene) },
    ];
  },
  update(dt) {
    const items = this.items(); if (this.st.del !== this.st.sel) this.st.del = -1; runMenu(this.st, items, dt);
    const teams = savedTeams();
    if ((INPUT.hit('X') || INPUT.hit('DEL')) && this.st.sel < teams.length && teams.length > 1) this.del(this.st.sel);
    if (backHit()) setScene(MenuScene);
  },
  // deleting a team takes two presses: the first arms it
  del(i) {
    if (this.st.del !== i) { this.st.del = i; return; }
    const teams = savedTeams(); teams.splice(i, 1); saveTeams(teams); this.st.del = -1; this.st.sel = Math.max(0, i - 1); uiBlip(200, 0.1);
  },
  draw() {
    bgFill('#14283a', '#1b3a2f'); const s = S(); text('TEAMS', VW / 2, 70 * s, 48 * s, '#ffde3b', 'center');
    const items = this.items(), y0 = 130 * s, teams = savedTeams(), rowH = 62 * s, h = 54 * s, ps = Math.min(40 * s, h - 8 * s);
    drawMenu(items, this.st, VW / 2, y0, 640 * s, 62);
    teams.forEach((t, i) => {
      const yy = y0 + i * rowH; let rx = VW / 2 + 320 * s - 10 * s;
      if (teams.length > 1) { const bw = 100 * s; dangerButton(rx - bw, yy + (h - 34 * s) / 2, bw, 34 * s, this.st.del === i ? 'SURE?' : 'DELETE', () => { this.st.sel = i; this.del(i); }, this.st.del === i, () => this.st.sel = i); rx -= bw + 14 * s; }
      t.mons.forEach((m, k) => { const im = portrait(toId(m.species)); if (im) ctx.drawImage(im, rx - (t.mons.length - k) * (ps + 3 * s), yy + (h - ps) / 2, ps, ps); });
    });
    hint(INPUT.usingPad ? 'A edit   X delete team (press twice)   B back' : 'Click a team to edit it   DELETE button or Delete key removes it (press twice)'); backButton(() => setScene(MenuScene));
  },
};
const CopyScene = {
  st: { sel: 0 },
  update(dt) {
    runMenu(this.st, TRAINERS.map(() => ({})), dt);
    if (okHit()) { const tr = TRAINERS[this.st.sel], t = savedTeams(); t.push({ name: `${tr.name} (copy)`, mons: JSON.parse(JSON.stringify(tr.team)) }); saveTeams(t); setScene(TeamsScene); }
    if (backHit()) setScene(TeamsScene);
  },
  draw() {
    bgFill('#14283a', '#1b3a2f'); const s = S(); text('COPY A TRAINER TEAM', VW / 2, 60 * s, 36 * s, '#ffde3b', 'center');
    const per = Math.max(1, Math.floor((VH - 160 * s) / (58 * s))), off = clamp(this.st.sel - Math.floor(per / 2), 0, Math.max(0, TRAINERS.length - per));
    TRAINERS.slice(off, off + per).forEach((tr, j) => {
      const i = j + off, y = 110 * s + j * 58 * s, on = i === this.st.sel;
      hot(VW / 2 - 400 * s, y, 800 * s, 50 * s, { hover: () => this.st.sel = i, click: () => { const tr = TRAINERS[i], t = savedTeams(); t.push({ name: tr.name + ' (copy)', mons: JSON.parse(JSON.stringify(tr.team)) }); saveTeams(t); setScene(TeamsScene); }, wheel: d => this.st.sel = clamp(this.st.sel + d, 0, TRAINERS.length - 1) });
      rrect(VW / 2 - 400 * s, y, 800 * s, 50 * s, 10 * s, on ? '#ffde3b' : '#ffffff18');
      text(`${tr.title} ${tr.name}`, VW / 2 - 380 * s, y + 25 * s, 18 * s, on ? '#111' : '#fff', 'left', null);
      tr.team.forEach((m, k) => { const im = portrait(toId(m.species)); if (im) ctx.drawImage(im, VW / 2 + 60 * s + k * 52 * s, y + 3 * s, 44 * s, 44 * s); });
    });
    hint('A / click copy   B / right-click back'); backButton(() => setScene(TeamsScene));
  },
};

// ---------- team editor: src/teambuilder.js ----------
function wrapText(s, x, y, w, size, color) {
  ctx.font = `${size}px Bungee, "Arial Black", sans-serif`;
  let line = '', yy = y;
  for (const word of s.split(' ')) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > w && line) { text(line, x, yy, size, color, 'left', null); line = word; yy += size * 1.4; } else line = t; }
  if (line) text(line, x, yy, size, color, 'left', null);
}
const GEN_OF = num => [151, 251, 386, 493, 649, 721, 809, 905, Infinity].findIndex(m => num <= m) + 1;
const PICKER_FORMS = ['toxtricitylowkey'];
// Grid of every species + battle form. Generation tabs (LT/RT, Tab, click) and type-to-search by name (keyboard).
function SpeciesPicker(edit, slot) {
  // one entry per real dex number (the base species has the shortest id; forms append a suffix), plus PICKER_FORMS, and only species that have sprites
  const base = {}; for (const id in DEX.species) { const n = DEX.species[id].num; if (n > 0 && (!base[n] || id.length < base[n].length)) base[n] = id; }
  const all = [...Object.values(base), ...PICKER_FORMS].filter(id => SPRITES[DEX.species[id]?.sprite]).sort((a, b) => DEX.species[a].num - DEX.species[b].num);
  const st = { sel: 0, tab: 0, q: '', ate: false, list: all };
  const refilter = () => {
    const q = toId(st.q), hits = all.filter(id => (!st.tab || GEN_OF(DEX.species[id].num) === st.tab) && toId(DEX.species[id].name).includes(q));
    st.list = q ? [...hits.filter(id => toId(DEX.species[id].name).startsWith(q)), ...hits.filter(id => !toId(DEX.species[id].name).startsWith(q))] : hits;
    st.sel = 0;
  };
  const setTab = t => { st.tab = (t + 10) % 10; refilter(); uiBlip(700, 0.03); };
  const choose = id => { if (id) { edit.setSpecies(slot, id); setScene(edit); } };
  // Letters go to the search box, so WASD / Q / E / Space / Backspace / Esc stop acting as menu keys while it's in use.
  const onKey = e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') { setTab(st.tab + (e.shiftKey ? -1 : 1)); st.ate = true; }
    else if (e.key === 'Backspace' && st.q) { st.q = st.q.slice(0, -1); refilter(); st.ate = true; }
    else if (e.key === 'Escape' && st.q) { st.q = ''; refilter(); st.ate = true; }
    else if (e.key.length === 1 && /[a-z0-9.' :-]/i.test(e.key) && (e.key !== ' ' || st.q) && st.q.length < 20) { st.q += e.key; refilter(); st.ate = true; }
  };
  const cols = () => Math.max(4, Math.floor((VW - 80) / (84 * S())));
  const rows = () => Math.max(1, Math.floor((VH - 150 * S() - 105) / (84 * S())));
  return {
    enter() { window.addEventListener('keydown', onKey); },
    exit() { window.removeEventListener('keydown', onKey); },
    update(dt) {
      const n = st.list.length, c = cols(), last = Math.max(0, n - 1);
      const dir = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(k => KEYS[k]) ? '' : INPUT.menu;
      if (dir === 'left') st.sel = Math.max(0, st.sel - 1);
      if (dir === 'right') st.sel = Math.min(last, st.sel + 1);
      if (dir === 'up') st.sel = Math.max(0, st.sel - c);
      if (dir === 'down') st.sel = Math.min(last, st.sel + c);
      if (INPUT.hit('TABL') && !KEYS.KeyQ) st.sel = Math.max(0, st.sel - c * rows());
      if (INPUT.hit('TABR') && !KEYS.KeyE) st.sel = Math.min(last, st.sel + c * rows());
      if (INPUT.hit('LT')) setTab(st.tab - 1);
      if (INPUT.hit('RT')) setTab(st.tab + 1);
      st.sel = clamp(st.sel, 0, last);
      if (okHit() && !st.ate) choose(st.list[st.sel]);
      else if (backHit() && !st.ate) setScene(edit);
      st.ate = false;
    },
    draw() {
      bgFill('#14283a', '#1b3a2f'); const s = S(), sz = 84 * s, ids = st.list;
      const c = cols(), r = rows(), y0 = 150 * s;
      const row = Math.floor(st.sel / c); // scroll only when the selection leaves the view, so hovering an edge row never moves the grid
      st.off = clamp(row < (st.off | 0) ? row : row >= (st.off | 0) + r ? row - r + 1 : (st.off | 0), 0, Math.max(0, Math.ceil(ids.length / c) - r)); const off = st.off;
      text('CHOOSE A POKEMON', VW / 2, 34 * s, 30 * s, '#ffde3b', 'center');
      // generation tabs
      const tw = 86 * s, tx0 = VW / 2 - tw * 5;
      for (let t = 0; t < 10; t++) {
        const x = tx0 + t * tw, on = t === st.tab;
        hot(x, 58 * s, tw - 6 * s, 32 * s, { click: () => setTab(t) });
        rrect(x, 58 * s, tw - 6 * s, 32 * s, 8 * s, on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
        text(t ? 'GEN ' + t : 'ALL', x + (tw - 6 * s) / 2, 75 * s, 13 * s, on ? '#111' : '#fff', 'center', null);
      }
      // search box
      rrect(VW / 2 - 300 * s, 100 * s, 600 * s, 36 * s, 8 * s, '#00000055', st.q ? '#ffde3b' : '#ffffff44', 2);
      const caret = Math.floor(performance.now() / 500) % 2 ? '_' : ' ';
      text(st.q ? st.q + caret : (INPUT.usingPad ? 'LT/RT change generation' : 'Type a name to search'), VW / 2 - 286 * s, 118 * s, 16 * s, st.q ? '#fff' : '#889', 'left', null);
      text(`${ids.length} shown`, VW / 2 + 286 * s, 118 * s, 12 * s, '#9ab', 'right', null);
      for (let i = off * c; i < Math.min(ids.length, (off + r) * c); i++) {
        const x = 40 + (i % c) * sz, y = y0 + (Math.floor(i / c) - off) * sz, on = i === st.sel, sp = DEX.species[ids[i]];
        hot(x, y, sz - 6, sz - 6, { hover: () => st.sel = i, click: () => choose(ids[i]), wheel: d => st.sel = clamp(st.sel + d * c, 0, ids.length - 1) });
        rrect(x, y, sz - 6, sz - 6, 10 * s, on ? '#ffde3b' : '#ffffff12');
        const im = portrait(ids[i]); if (im) ctx.drawImage(im, x + 12 * s, y + 2 * s, sz - 30 * s, sz - 30 * s);
        text(sp.name.length > 11 ? sp.name.slice(0, 10) + '.' : sp.name, x + (sz - 6) / 2, y + sz - 17 * s, 10 * s, on ? '#111' : '#dde', 'center', null, 'Silkscreen');
      }
      // scrollbar: click or drag the track, or use the wheel; moving it never changes which Pokemon is picked except to keep the highlight on screen
      const trows = Math.ceil(ids.length / c), bw = Math.max(8, 10 * s), tx = 40 + c * sz + 6, th = r * sz - 6, mo = Math.max(0, trows - r);
      const scrollTo = o => { st.off = clamp(o, 0, mo); const rw = clamp(Math.floor(st.sel / c), st.off, st.off + r - 1); st.sel = clamp(rw * c + st.sel % c, 0, Math.max(0, ids.length - 1)); };
      ctx.fillStyle = '#ffffff18'; ctx.fillRect(tx, y0, bw, th);
      if (mo > 0) {
        const kh = Math.max(16 * s, th * r / trows), ky = y0 + (th - kh) * off / mo;
        ctx.fillStyle = st.drag ? '#fff' : '#ffde3b'; ctx.fillRect(tx, ky, bw, kh);
        const jump = () => scrollTo(Math.round((MOUSE.y - y0 - kh / 2) / (th - kh) * mo));
        hot(tx - 8, y0, bw + 16, th, { click: () => { st.drag = true; jump(); }, wheel: d => scrollTo(off + d) });
        if (st.drag) { if (MOUSE.down) jump(); else st.drag = false; }
      }
      const sp = DEX.species[ids[st.sel]];
      if (sp) {
        // name and types on one line, base stats under it (the highest stat is gold)
        const nm = `#${sp.num} ${sp.name.toUpperCase()}`, ns = Math.max(14, 22 * s), cy = VH - 92, ch = Math.max(16, 22 * s);
        ctx.font = `${ns}px Bungee, "Arial Black", sans-serif`; const nw = ctx.measureText(nm).width;
        ctx.font = `${ch * 0.62}px Bungee, "Arial Black", sans-serif`; const tw = sp.types.reduce((a, t) => a + ctx.measureText(t.toUpperCase()).width + ch * 0.9 + 5, 0);
        let cx = VW / 2 - (nw + 14 + tw) / 2; text(nm, cx, cy, ns, '#fff', 'left'); cx += nw + 14; for (const t of sp.types) cx += hudChip(cx, cy - ch / 2, t.toUpperCase(), TYPE_COLOR[t], ch);
        const bs = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'], top = Math.max(...bs.map(k => sp.baseStats[k])), fs = Math.max(11, 14 * s), gap = 22;
        const parts = [...bs.map(k => [`${k.toUpperCase()} ${sp.baseStats[k]}`, sp.baseStats[k] === top ? '#ffde3b' : '#dde']), ['BST ' + bs.reduce((a, k) => a + sp.baseStats[k], 0), '#9ab']];
        ctx.font = `${fs}px Bungee, "Arial Black", sans-serif`; const widths = parts.map(p => ctx.measureText(p[0]).width);
        cx = VW / 2 - (widths.reduce((a, b) => a + b) + gap * (parts.length - 1)) / 2; parts.forEach((p, i) => { text(p[0], cx, VH - 62, fs, p[1], 'left', null); cx += widths[i] + gap; });
      }
      else text('No Pokemon match', VW / 2, y0 + 60 * s, 20 * s, '#ccc', 'center');
      hint(INPUT.usingPad ? 'A pick   B back   LB/RB page   LT/RT generation' : 'Type to search   Tab generation   arrows or scroll browse   Enter pick   right-click back'); backButton(() => setScene(edit));
    },
  };
}

// Abilities/items the engine reads somewhere. Everything else shows "does nothing in PokeArena yet".
const WORKING_ABILITIES = new Set(('aerilate refrigerate pixilate galvanize moldbreaker levitate waterabsorb voltabsorb dryskin stormdrain lightningrod flashfire sapsipper motordrive overcoat soundproof bulletproof ' +
  'scrappy superluck battlearmor shellarmor unaware hugepower purepower hustle guts solarpower blaze torrent overgrow swarm marvelscale furcoat technician ironfist strongjaw megalauncher toughclaws reckless sheerforce ' +
  'sandforce thickfat heatproof sniper adaptability filter solidrock tintedlens multiscale parentalbond magicguard waterveil waterbubble limber immunity insomnia vitalspirit sweetveil magmaarmor comatose leafguard ' +
  'earlybird synchronize owntempo oblivious clearbody whitesmoke fullmetalbody bigpecks hypercutter keeneye simple contrary defiant competitive cloudnine airlock imposter intimidate innerfocus drought drizzle sandstream ' +
  'snowwarning electricsurge grassysurge psychicsurge mistysurge download trace naturalcure regenerator shadowtag arenatrap magnetpull compoundeyes noguard pressure swiftswim chlorophyll sandrush slushrush skilllink ' +
  'serenegrace shielddust stench static flamebody poisonpoint effectspore cutecharm roughskin ironbarbs cursedbody poisontouch suctioncups rockhead sturdy angerpoint weakarmor justified steamengine steadfast ' +
  'poisonheal sandveil snowcloak icebody raindish hydration shedskin speedboost magicbounce punkrock').split(' '));
const ABILITY_WORKS = id => WORKING_ABILITIES.has(id);
const WORKING_ITEMS = new Set(('leftovers blacksludge lifeorb choiceband choicespecs choicescarf focussash assaultvest rockyhelmet expertbelt muscleband wiseglasses charcoal mysticwater miracleseed magnet nevermeltice blackbelt ' +
  'poisonbarb softsand sharpbeak twistedspoon silverpowder hardstone spelltag dragonfang blackglasses metalcoat silkscarf fairyfeather sitrusberry lumberry heavydutyboots eviolite lightball thickclub leek luckypunch ' +
  'metalpowder airballoon flameorb toxicorb shellbell kingsrock scopelens razorclaw whiteherb mentalherb weaknesspolicy lightclay damprock heatrock smoothrock icyrock terrainextender bigroot metronome quickclaw powerherb').split(' '));
const ITEM_WORKS = id => WORKING_ITEMS.has(id) || !!DEX.items[id]?.megaStone;

// ---------- boot ----------
function boot() {
  const missing = ['DEX', 'VFX', 'SPRITES', 'ARENAS', 'TRAINERS'].filter(k => !window[k]);
  if (missing.length) {
    setScene({ update() {}, draw() { bgFill('#300', '#100'); text('Missing data: ' + missing.join(', '), VW / 2, VH / 2, 24, '#fff', 'center'); text('Run the build scripts in tools/ (see README)', VW / 2, VH / 2 + 40, 16, '#ccc', 'center'); } });
  } else {
    const v = STORE.get('vol', null); if (v) Object.assign(AUDIO.vol, v);
    if (location.search.includes('mute')) AUDIO.vol = { music: 0, sfx: 0 };
    window.MUSIC = window.MUSIC || {};
    setScene(TitleScene);
  }
  requestAnimationFrame(frame);
}
boot();
