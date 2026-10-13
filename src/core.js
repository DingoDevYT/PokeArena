// Canvas, loop, input, audio, image cache, small helpers.
'use strict';

const cv = document.getElementById('game');
const screenCtx = cv.getContext('2d');
let ctx = screenCtx;
let VW = 0, VH = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  cv.style.width = VW + 'px'; cv.style.height = VH + 'px';
}
window.addEventListener('resize', resize); resize();

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// PMD sheet rows: 0 Down, 1 DownRight, 2 Right, 3 UpRight, 4 Up, 5 UpLeft, 6 Left, 7 DownLeft
const dirFromVec = (x, y) => [2, 1, 0, 7, 6, 5, 4, 3][(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8];
const DIR_VEC = [[0, 1], [0.707, 0.707], [1, 0], [0.707, -0.707], [0, -1], [-0.707, -0.707], [-1, 0], [-0.707, 0.707]];

// ---------- images ----------
const IMG = {};
function img(src) {
  if (!src) return null;
  let i = IMG[src];
  if (!i) { i = IMG[src] = new Image(); i.src = src; }
  return i.complete && i.naturalWidth ? i : null;
}
function preload(srcs) {
  return Promise.all(srcs.filter(Boolean).map(s => new Promise(res => {
    const i = IMG[s] || (IMG[s] = new Image());
    if (i.complete && i.naturalWidth) return res();
    i.onload = i.onerror = res; if (!i.src) i.src = s;
  })));
}

// Kenney prompt icons (data/ui-icons.js), drawn at a whole-number scale so pixels stay crisp.
function iconW(name, h) { const i = img(window.UI_ICONS && UI_ICONS[name]); return i ? i.naturalWidth * Math.max(1, Math.round(h / i.naturalHeight)) : 0; }
function icon(name, x, y, h = 32, align = 'center') {
  const i = img(window.UI_ICONS && UI_ICONS[name]); if (!i) return 0;
  const k = Math.max(1, Math.round(h / i.naturalHeight)), w = i.naturalWidth * k, hh = i.naturalHeight * k;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(i, Math.round(align === 'left' ? x : align === 'right' ? x - w : x - w / 2), Math.round(y - hh / 2), w, hh);
  return w;
}
// Row of icons and text: parts like ['xbox_lb', ' DODGE'] (known icon names draw as icons). Returns width.
function iconRow(parts, x, y, h, size, color, align = 'left', measureOnly) {
  ctx.font = `${size}px Bungee, "Arial Black", sans-serif`;
  const isIcon = p => window.UI_ICONS && UI_ICONS[p];
  const w = parts.reduce((a, p) => a + (isIcon(p) ? iconW(p, h) + 3 : ctx.measureText(p).width), 0);
  if (measureOnly) return w;
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const p of parts) {
    if (isIcon(p)) cx += icon(p, cx, y, h, 'left') + 3;
    else { text(p, cx, y, size, color, 'left', null); ctx.font = `${size}px Bungee, "Arial Black", sans-serif`; cx += ctx.measureText(p).width; }
  }
  return w;
}

// ---------- audio ----------
const AUDIO = {
  music: null, musicSrc: '', vol: { music: 0.45, sfx: 0.7 }, pool: {},
  // x = world x of the sound's source: it pans toward where it is on screen, never past 70% either way. No x = centred (menus).
  // Panning needs Web Audio, which plays silence for media on file://, so it only runs when served over http(s).
  ac: null,
  panFor(x) {
    if (x === undefined || typeof B === 'undefined' || !B || !B.cam) return 0;
    return clamp((x - B.cam.x) / (VW / 2 / B.cam.z), -1, 1) * 0.7;
  },
  play(src, vol = 1, rate = 1, x) {
    if (!src) return;
    const pool = this.pool[src] || (this.pool[src] = []);
    let a = pool.find(x => x.paused || x.ended);
    if (!a) { if (pool.length > 5) return; a = new Audio(src); pool.push(a); }
    a.volume = clamp(vol * this.vol.sfx, 0, 1); a.preservesPitch = false; a.playbackRate = rate; a.currentTime = 0; // rate changes pitch as well as speed
    if (location.protocol.startsWith('http')) {
      try {
        if (!a._pan) { this.ac ||= new AudioContext(); a._pan = this.ac.createStereoPanner(); this.ac.createMediaElementSource(a).connect(a._pan).connect(this.ac.destination); }
        a._pan.pan.value = this.panFor(x); if (this.ac.state === 'suspended') this.ac.resume();
      } catch {}
    }
    a.play().catch(() => {});
  },
  sfx(name, vol, x) { const s = window.VFX && VFX.sounds[name]; if (s) this.play(s, vol, 1, x); },
  // Game SFX from data/sfx.js: move(id) for attacks, gen('hit' | 'faint' | 'statUp' ...) for battle events.
  move(id, vol, x) { const s = window.MOVE_SFX && MOVE_SFX.moves[id]; if (s) this.play(s, vol, 1, x); return !!s; },
  gen(k, vol, x) { const s = window.MOVE_SFX && MOVE_SFX.generic[k]; if (s) this.play(s, vol, 1, x); return !!s; },
  cry(speciesId, vol = 0.8, x, rate = 1) { this.play('assets/cry/' + speciesId + '.mp3', vol, rate, x); },
  playMusic(src) {
    if (this.musicSrc === src) { if (this.music && this.music.paused) this.music.play().catch(() => {}); return; }
    if (this.music) this.music.pause();
    this.musicSrc = src; this.music = null;
    if (!src) return;
    this.music = new Audio(src); this.music.loop = true; this.music.volume = this.vol.music;
    this.music.play().catch(() => {});
  },
};

// ---------- input ----------
// Merges the first connected gamepad and keyboard/mouse into one per-frame state.
const KEYS = {}, KEYS_HIT = {};
window.addEventListener('keydown', e => { if (!KEYS[e.code]) KEYS_HIT[e.code] = true; KEYS[e.code] = true; INPUT.usingPad = false; if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault(); unlockAudio(); });
window.addEventListener('keyup', e => { KEYS[e.code] = false; });
const MOUSE = { x: 0, y: 0, down: false, hit: false, hitR: false, downR: false, moved: 0, wheel: 0 };
cv.addEventListener('mousemove', e => { MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.moved = performance.now(); });
cv.addEventListener('mousedown', e => { if (e.button === 2) { MOUSE.downR = true; MOUSE.hitR = true; } else { MOUSE.down = true; MOUSE.hit = true; } INPUT.usingPad = false; unlockAudio(); });
window.addEventListener('mouseup', e => { if (e.button === 2) MOUSE.downR = false; else MOUSE.down = false; });
cv.addEventListener('wheel', e => { MOUSE.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
function unlockAudio() { if (AUDIO.music && AUDIO.music.paused) AUDIO.music.play().catch(() => {}); }

// Shown on the Controls page so a "no controller" report says why.
const PAD_EVENTS = { n: 0, last: '' };
window.addEventListener('gamepadconnected', e => { PAD_EVENTS.n++; PAD_EVENTS.last = e.gamepad.id; INPUT.usingPad = true; });
window.addEventListener('gamepaddisconnected', e => { PAD_EVENTS.last = 'disconnected: ' + e.gamepad.id; });

const PAD_BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const INPUT = {
  prev: {}, cur: {}, pad: null, usingPad: false,
  mx: 0, my: 0, ax: 0, ay: 0, aimActive: false, mouseAim: false,
  menuRepeat: 0, menuDir: '',
  poll(dt) {
    // Merge every pad the browser reports. Windows often lists phantom HID devices first, so prefer standard-mapped pads.
    const all = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
    const std = all.filter(p => p.mapping === 'standard'), pads = std.length ? std : all;
    this.pads = all; this.pad = pads[0] || null;
    const pb = i => pads.some(p => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const axis = i => { let v = 0; for (const p of pads) { const a = p.axes[i] || 0; if (Math.abs(a) > Math.abs(v)) v = a; } return v; };
    const b = {};
    for (const k in PAD_BTN) b[k] = pb(PAD_BTN[k]);
    const padActive = Object.values(b).some(Boolean) || [0, 1, 2, 3].some(i => Math.abs(axis(i)) > 0.5);
    if (padActive) { this.usingPad = true; unlockAudio(); }
    // battle actions: pad, or PC layout (LMB / RMB / Q / E, Space dodge, 1-6 swap, F mega)
    b.M1 = b.A || MOUSE.down; b.M2 = b.B || MOUSE.downR; b.M3 = b.X || KEYS.KeyQ; b.M4 = b.Y || KEYS.KeyE;
    b.DODGE = b.LB || KEYS.Space || KEYS.ShiftLeft;
    b.MEGA = (b.LT && b.RT) || KEYS.KeyF;
    for (let k = 1; k <= 6; k++) b['S' + k] = KEYS['Digit' + k] || KEYS['Numpad' + k];
    // menus
    b.START ||= KEYS.Escape || KEYS.KeyP;
    b.OK = b.A || KEYS.Enter || KEYS.Space;
    b.BACKK = b.B || KEYS.Escape || KEYS.Backspace || MOUSE.downR;
    b.UP ||= KEYS.ArrowUp || KEYS.KeyW; b.DOWN ||= KEYS.ArrowDown || KEYS.KeyS; b.LEFT ||= KEYS.ArrowLeft || KEYS.KeyA; b.RIGHT ||= KEYS.ArrowRight || KEYS.KeyD;
    b.DEL = KEYS.Delete; b.REN = KEYS.F2;
    b.TABL = b.LB || KEYS.KeyQ || KEYS.PageUp; b.TABR = b.RB || KEYS.KeyE || KEYS.PageDown;
    this.prev = this.cur; this.cur = b;

    const dz = v => Math.abs(v) < 0.22 ? 0 : v;
    let mx = dz(axis(0)), my = dz(axis(1));
    if (KEYS.KeyA) mx -= 1; if (KEYS.KeyD) mx += 1; if (KEYS.KeyW) my -= 1; if (KEYS.KeyS) my += 1;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    this.mx = mx; this.my = my;
    const ax = dz(axis(2)), ay = dz(axis(3));
    this.aimActive = Math.hypot(ax, ay) > 0.35;
    if (this.aimActive) { const l = Math.hypot(ax, ay); this.ax = ax / l; this.ay = ay / l; }
    this.mouseAim = !this.usingPad;

    // menu navigation with repeat
    const dir = (b.UP || (this.usingPad && my < -0.6)) ? 'up' : (b.DOWN || (this.usingPad && my > 0.6)) ? 'down' : (b.LEFT || (this.usingPad && mx < -0.6)) ? 'left' : (b.RIGHT || (this.usingPad && mx > 0.6)) ? 'right' : '';
    this.menu = '';
    if (dir !== this.menuDir) { this.menuDir = dir; this.menu = dir; this.menuRepeat = 0.35; }
    else if (dir) { this.menuRepeat -= dt; if (this.menuRepeat <= 0) { this.menu = dir; this.menuRepeat = 0.08; } }
    for (const k in KEYS_HIT) delete KEYS_HIT[k];
  },
  hit(k) { return this.cur[k] && !this.prev[k]; },
  held(k) { return !!this.cur[k]; },
  released(k) { return !this.cur[k] && this.prev[k]; },
};

// ---------- mouse hotspots ----------
// Draw code calls hot() for clickable rects; the next frame resolves hover/click against them.
let HOT = [], lastMouse = '';
function hot(x, y, w, h, o) { HOT.push({ x, y, w, h, ...o }); }
function resolveHot() {
  const hs = HOT; HOT = [];
  if (INPUT.usingPad) return;
  const moved = lastMouse !== MOUSE.x + ',' + MOUSE.y; lastMouse = MOUSE.x + ',' + MOUSE.y;
  for (let i = hs.length - 1; i >= 0; i--) {
    const h = hs[i];
    if (MOUSE.x < h.x || MOUSE.x > h.x + h.w || MOUSE.y < h.y || MOUSE.y > h.y + h.h) continue;
    if (moved && h.hover) h.hover();
    if (MOUSE.hit && h.click) { MOUSE.hit = false; h.click((MOUSE.x - h.x) / h.w); }
    if (MOUSE.wheel && h.wheel) { h.wheel(MOUSE.wheel); MOUSE.wheel = 0; }
    cv.style.cursor = h.click ? 'pointer' : 'default';
    return;
  }
  cv.style.cursor = SCENE && SCENE.battle ? 'crosshair' : 'default';
}

// ---------- loop ----------
let SCENE = null;
function setScene(s) { if (SCENE && SCENE.exit) SCENE.exit(); SCENE = s; if (s.enter) s.enter(); }
let lastT = performance.now();
function frame(t) {
  const dt = clamp((t - lastT) / 1000, 0, 0.05); lastT = t;
  INPUT.poll(dt);
  resolveHot();
  ctx = screenCtx;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (SCENE) { SCENE.update(dt); SCENE.draw(); }
  MOUSE.hit = MOUSE.hitR = false; MOUSE.wheel = 0;
  requestAnimationFrame(frame);
}

// ---------- persistence (per-browser convenience only) ----------
const STORE = {
  get(k, d) { try { const v = localStorage.getItem('pokearena.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pokearena.' + k, JSON.stringify(v)); } catch {} },
};

// ---------- text ----------
function text(s, x, y, size = 16, color = '#fff', align = 'left', stroke = '#000', font = 'Bungee') {
  ctx.font = `${size}px ${font}, "Arial Black", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function rrect(x, y, w, h, r, fill, stroke, lw = 2) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
const TYPE_COLOR = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C', Ice: '#96D9D6',
  Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A',
  Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD',
};
