// Battle rendering. The arena is drawn into a low-res canvas at 1 canvas pixel = 1 world pixel, then
// scaled up with nearest-neighbour, so every sprite, effect and shape sits on the same pixel grid.
'use strict';

const worldCv = document.createElement('canvas'), worldCtx = worldCv.getContext('2d');
let view = { x: 0, y: 0, w: 0, h: 0 };
function screenToWorld(sx, sy) { const c = B.cam; return { x: c.x + (sx - VW / 2) / c.z, y: c.y + (sy - VH / 2) / c.z }; }
function worldToScreen(wx, wy) { const c = B.cam; return { x: (wx - c.x) * c.z + VW / 2, y: (wy - c.y) * c.z + VH / 2 }; }
function updateCamera(dt) {
  const c = B.cam, ar = B.arena, [a, b] = B.sides.map(s => s.ent);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 12 * SS;
  // zoom limits come from the fighting area plus a 48px rim, not the decorated border around it
  const zMin = Math.max(VW / (ar.w - ar.wall * 2 + 96), VH / (ar.h - ar.wall * 2 + 96)), zMax = zMin * 1.7;
  let z = Math.min(VW / (Math.abs(a.x - b.x) + 420), VH / (Math.abs(a.y - b.y) + 360));
  z = clamp(z, zMin, zMax) * (1 + c.punch * 0.6);
  c.punch = Math.max(0, c.punch - dt * 0.8);
  c.z = lerp(c.z, z, 1 - Math.pow(0.02, dt));
  c.x = lerp(c.x, mx, 1 - Math.pow(0.01, dt)); c.y = lerp(c.y, my, 1 - Math.pow(0.01, dt));
  const hw = VW / 2 / c.z, hh = VH / 2 / c.z;
  c.x = ar.w > hw * 2 ? clamp(c.x, hw, ar.w - hw) : ar.w / 2;
  c.y = ar.h > hh * 2 ? clamp(c.y, hh, ar.h - hh) : ar.h / 2;
  c.shake = Math.max(0, c.shake - dt * 30);
}

// ---------- pixel primitives (hard edges, no anti-aliasing) ----------
const PCACHE = new Map();
const colCv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function rgbaOf(col) { colCv.clearRect(0, 0, 1, 1); colCv.fillStyle = col; colCv.fillRect(0, 0, 1, 1); return colCv.getImageData(0, 0, 1, 1).data; }
function ellipseSprite(rx, ry, fill, stroke, lw) {
  rx = Math.max(1, Math.round(rx)); ry = Math.max(1, Math.round(ry)); lw = Math.max(1, Math.round(lw));
  const key = `${rx}|${ry}|${fill}|${stroke}|${lw}`;
  let c = PCACHE.get(key); if (c) return c;
  if (PCACHE.size > 800) PCACHE.clear();
  c = document.createElement('canvas'); c.width = rx * 2 + 1; c.height = ry * 2 + 1;
  const g = c.getContext('2d'), id = g.createImageData(c.width, c.height), f = fill && rgbaOf(fill), s = stroke && rgbaOf(stroke);
  const irx = Math.max(0.5, rx - lw), iry = Math.max(0.5, ry - lw * (ry / rx));
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const dx = x - rx, dy = y - ry, o = (dx * dx) / ((rx + 0.5) ** 2) + (dy * dy) / ((ry + 0.5) ** 2);
    if (o > 1) continue;
    const inner = (dx * dx) / ((irx + 0.5) ** 2) + (dy * dy) / ((iry + 0.5) ** 2) <= 1;
    const col = !inner && s ? s : f; if (!col) continue;
    id.data.set(col, (y * c.width + x) * 4);
  }
  g.putImageData(id, 0, 0); PCACHE.set(key, c); return c;
}
function ell(x, y, rx, ry, fill, stroke, lw = 1) { const c = ellipseSprite(rx, ry, fill, stroke, lw); ctx.drawImage(c, Math.round(x) - (c.width >> 1), Math.round(y) - (c.height >> 1)); }
function pline(x0, y0, x1, y1, color, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  while (n++ < 2000) { ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function seeded(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

// ---------- sprite caches: outlined mon sheets, dimmed arena art ----------
// Outline is built one frame cell at a time, clipped to the cell, so it can't bleed into the neighbouring frame.
const OUTLINE = new Map();
// ring=true gives just the white 1px ring (sprite cut out), drawn tinted as a coloured outline for attack tells.
function outlined(im, fw = im.naturalWidth, fh = im.naturalHeight, ring = false) {
  const key = im.src + '|' + fw + 'x' + fh + (ring ? '|ring' : '');
  let c = OUTLINE.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d');
  for (let cy = 0; cy < c.height; cy += fh) for (let cx = 0; cx < c.width; cx += fw) {
    g.save(); g.beginPath(); g.rect(cx, cy, fw, fh); g.clip();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(im, cx, cy, fw, fh, cx + dx, cy + dy, fw, fh);
    g.restore();
  }
  g.globalCompositeOperation = 'source-in'; g.fillStyle = ring ? '#fff' : '#0c0a14'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = ring ? 'destination-out' : 'source-over'; g.drawImage(im, 0, 0);
  OUTLINE.set(key, c); return c;
}
// Solid black copy of a sheet, for sprite-shaped ground shadows.
const SILHOUETTE = new Map();
function silhouette(im) {
  let c = SILHOUETTE.get(im.src); if (c) return c;
  c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  SILHOUETTE.set(im.src, c); return c;
}
// The current frame squashed flat onto the ground at the feet, so the shadow matches the pose.
function drawMonShadow(key, animName, t, face, x, y, opts = {}) {
  const a = animOf(key, animName), sc = opts.scale ?? SS;
  const im = a && img(a.file); if (!im) return false;
  const rows = Math.round(im.naturalHeight / a.fh), f = animFrame(a, t, opts.loop ?? true), row = rows >= 8 ? face : 0;
  const k = 0.3, dh = Math.max(2, Math.round(a.fh * sc * k)), lift = Math.min(1, (opts.z || 0) / (40 * SS));
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.42 * (1 - lift * 0.5);
  ctx.drawImage(silhouette(im), f * a.fw, row * a.fh, a.fw, a.fh, Math.round(x - a.fw * sc / 2), Math.round(y - a.footY * sc * k), a.fw * sc, dh);
  ctx.globalAlpha = 1;
  return true;
}
const DIMMED = new Map();
function dimmed(src) {
  const im = img(src); if (!im) return null;
  let c = DIMMED.get(src); if (c) return c;
  c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.filter = 'saturate(1.15) brightness(0.95) contrast(1.04)'; g.drawImage(im, 0, 0);
  DIMMED.set(src, c); return c;
}
const tintCv = document.createElement('canvas'), tintCtx = tintCv.getContext('2d');
function drawFrame(im, sx, sy, sw, sh, dx, dy, tint, alpha = 1, scale = 1, scaleX = 1, scaleY = 1) {
  ctx.globalAlpha = alpha;
  const dw = sw * scale * scaleX, dh = sh * scale * scaleY; // scaleX/Y = squash and stretch about the feet (dx/dy are for the unstretched frame)
  dx += (sw * scale - dw) / 2; dy += (sh * scale - dh) * 0.7;
  ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
  if (tint) {
    tintCv.width = sw; tintCv.height = sh;
    tintCtx.globalCompositeOperation = 'source-over'; tintCtx.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    tintCtx.globalCompositeOperation = 'source-atop'; tintCtx.fillStyle = tint; tintCtx.fillRect(0, 0, sw, sh);
    ctx.drawImage(tintCv, dx, dy, dw, dh);
  }
  ctx.globalAlpha = 1;
}
function drawMonSprite(key, animName, t, face, x, y, opts = {}) {
  const a = animOf(key, animName), sc = opts.scale ?? SS;
  if (!a) return;
  const im = img(a.file); if (!im) return;
  const rows = Math.round(im.naturalHeight / a.fh);
  const loop = opts.loop ?? ['Idle', 'Walk', 'Sleep', 'Hop', 'Charge', 'Rotate'].includes(animName);
  const f = animFrame(a, t, loop), row = rows >= 8 ? face : 0, dx = Math.round(x - a.fw * sc / 2), dy = Math.round(y - a.footY * sc - (opts.z || 0));
  const [kx, ky] = opts.stretch || [1, 1];
  if (opts.outline) drawFrame(outlined(im, a.fw, a.fh, true), f * a.fw, row * a.fh, a.fw, a.fh, dx, dy, opts.outline, 1, sc, kx, ky);
  drawFrame(opts.noOutline || opts.outline ? im : outlined(im, a.fw, a.fh), f * a.fw, row * a.fh, a.fw, a.fh, dx, dy, opts.tint, opts.alpha ?? 1, sc, kx, ky);
}
// Coloured outline as a tell: type colour while winding up / charging / channelling, rainbow while mega evolving,
// white on a hit, a red blink at low HP.
function outlineTell(s, e, m) {
  if (B.mega?.side === s) return RAINBOW[Math.floor(B.mega.t * 20) % 7];
  const mv = e.laser?.move || (e.act && (!e.act.fired || e.act.charging) ? e.act.move : null);
  if (mv) return Math.floor(B.time * 10) % 4 ? TYPE_COLOR[mv.type] || '#fff' : '#fff';
  if (e.hurtT > 0.12) return '#fff';
  if (m.hp / m.maxHp < 0.25 && B.time % 1.2 < 0.15) return '#ff3b30';
  return null;
}
function drawParticle(f) {
  const p = f.p, im = img(p.file); if (!im) return;
  const fi = Math.min(p.frames - 1, Math.floor((f.t * 60) / f.ft) % p.frames);
  const row = p.dirs > 1 ? Math.min(p.dirs - 1, f.dir % 8) : 0;
  let x = f.x, y = f.y;
  if (f.follow !== undefined) { const e = B.sides[f.follow].ent; x = e.x; y = e.y - 12 * SS - e.z; }
  const w = p.fw * f.scale, h = p.fh * f.scale;
  ctx.globalAlpha = f.alpha;
  if (f.flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(im, fi * p.fw, row * p.fh, p.fw, p.fh, Math.round(-w / 2), Math.round(y - h / 2 - f.z), w, h); ctx.restore(); }
  else ctx.drawImage(im, fi * p.fw, row * p.fh, p.fw, p.fh, Math.round(x - w / 2), Math.round(y - h / 2 - f.z), w, h);
  ctx.globalAlpha = 1;
}
const particle = (name, x, y, t, opts = {}) => { const p = name && VFX.particles[name]; if (p) drawParticle({ p, x, y, t, ft: opts.ft || 3, dir: opts.dir || 0, scale: opts.scale || SS, z: 0, alpha: opts.alpha ?? 1 }); return !!p; };
// PMDO beams are vertical strips: tail at the source, a 1px body slice stretched, head at the far end.
// Rotation is snapped to 8 directions so the pixels stay square-ish.
function drawBeam(name, x, y, ang, len, t, widthScale = 1, snap = true) {
  const b = window.VFX && VFX.beams[name];
  const head = b && img(b.head), body = b && img(b.body), tail = b && img(b.tail);
  if (!head || !body || !tail) return false;
  const fr = Math.floor(t * 20) % b.frames;
  const bw = body.naturalWidth / b.frames, hw = head.naturalWidth / b.frames, tw = tail.naturalWidth / b.frames;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate((snap ? Math.round(ang / (Math.PI / 4)) * (Math.PI / 4) : ang) - Math.PI / 2); ctx.scale(widthScale, 1);
  ctx.drawImage(body, fr * bw, 0, bw, body.naturalHeight, -bw / 2, 0, bw, len);
  ctx.drawImage(tail, fr * tw, 0, tw, tail.naturalHeight, -tw / 2, -tail.naturalHeight / 2, tw, tail.naturalHeight);
  ctx.drawImage(head, fr * hw, 0, hw, head.naturalHeight, -hw / 2, len - head.naturalHeight / 2, hw, head.naturalHeight);
  ctx.restore();
  return true;
}

// Channelled lasers: one continuous, animated pixel-art beam per move (src/beamfx.js).
function drawLaser(b) { drawBeamFx(b); }
// Tracking reticle: a crosshair that chases the target, then blinks white once it locks.
function drawReticle(k, col) {
  const locked = k.t >= k.track, c = locked && Math.floor(k.t * 20) % 2 ? '#fff' : col, rx = k.r, ry = k.r * 0.55;
  ell(k.x, k.y, rx, ry, col + (locked ? '55' : '25'), c, 2);
  const q = clamp((k.t - k.track) / (k.delay - k.track), 0, 1);
  if (locked) ell(k.x, k.y, rx * q, ry * q, col + '60');
  const g = 6 + (1 - clamp(k.t / k.track, 0, 1)) * 10;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pline(k.x + dx * (rx + g), k.y + dy * (ry + g * 0.55), k.x + dx * (rx - 4), k.y + dy * (ry - 2), c, 2);
}
// Laser windup tell: the line it will fire along, flickering, with edges as wide as the beam.
function drawLaserTell(side) {
  const e = side.ent, act = e.act; if (!act || act.fired || !LASERS[act.move.id]) return;
  const L = LASERS[act.move.id], ax = e.aimX, ay = e.aimY, x = e.x + ax * 10, y = e.y - 8 * SS + ay * 6, len = rayLen(x, y, ax, ay, L.len), col = TYPE_COLOR[act.move.type];
  const px = -ay * L.w * BFX_VIS / 2, py = ax * L.w * BFX_VIS / 2;
  ctx.globalAlpha = 0.35 + 0.35 * (Math.floor(B.time * 16) % 2) * clamp(act.t / act.wind, 0.3, 1);
  for (let d = 0; d < len; d += 10) pline(x + ax * d, y + ay * d, x + ax * Math.min(len, d + 6), y + ay * Math.min(len, d + 6), col, 1);
  pline(x + px, y + py, x + px + ax * len, y + py + ay * len, col, 1); pline(x - px, y - py, x - px + ax * len, y - py + ay * len, col, 1);
  ctx.globalAlpha = 1;
}

// Lighting: a light ambient shade, then additive stepped glow pools (hard-edged rings, so still pixel art)
// around anything bright: projectiles, lasers, hit sparks, and the sun.
function drawLighting() {
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, col, a) => {
    r = Math.max(4, Math.round(r / 2) * 2);
    for (let i = 3; i >= 1; i--) { ctx.globalAlpha = a * 0.22; ell(x, y, r * i / 3, Math.round(r * i / 3 * 0.62), col); }
  };
  for (const p of B.proj) glow(p.x, p.y + 6, 26 + p.r, TYPE_COLOR[p.move.type] || '#fff', 0.8);
  // lasers light themselves (src/beamfx.js); an additive pool on top washes their colours out
  for (const b of B.beams) {
    if (b.laser) continue;
    const col = TYPE_COLOR[b.move.type] || '#fff';
    for (let d = 0; d <= b.len; d += 32) glow(b.x + Math.cos(b.ang) * d, b.y + Math.sin(b.ang) * d + 8, 22 + (b.w || 12), col, 0.5);
  }
  for (const f of B.fx) if (f.p && /^Hit_|Discharge|Spark|Flame|Fire|Explosion/.test(f.p.file.split('/').pop())) glow(f.x, f.y + 8, 40, '#fff4d0', clamp(1 - f.t * 3, 0, 1));
  for (const a of B.areas) if (a.t < a.dur) glow(a.x, a.y, a.r * 0.9, TYPE_COLOR[a.move.type] || '#fff', 0.35 * (1 - a.t / a.dur));
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ---------- world layers ----------
function drawDecal(d) {
  const r = seeded(Math.floor(d.seed)), a = clamp(1 - d.t / 20, 0, 1);
  ctx.globalAlpha = a;
  if (d.kind === 'crack') {
    for (let i = 0; i < 9; i++) {
      let x = d.x, y = d.y, ang = r() * Math.PI * 2;
      for (let k = 0; k < 5; k++) { ang += (r() - 0.5) * 1.2; const l = d.r / 5 * (0.6 + r()), nx = x + Math.cos(ang) * l, ny = y + Math.sin(ang) * l * 0.6; pline(x, y, nx, ny, 'rgba(30,22,22,0.75)', k < 2 ? 2 : 1); x = nx; y = ny; }
    }
    ell(d.x, d.y, d.r * 0.3, d.r * 0.18, 'rgba(40,30,30,0.4)');
  } else if (d.kind === 'scorch') { for (let i = 0; i < 5; i++) ell(d.x + (r() - 0.5) * d.r, d.y + (r() - 0.5) * d.r * 0.5, d.r * (0.4 + r() * 0.5), d.r * 0.3, 'rgba(25,15,10,0.35)'); }
  else if (d.kind === 'wet') { for (let i = 0; i < 4; i++) ell(d.x + (r() - 0.5) * d.r, d.y + (r() - 0.5) * d.r * 0.5, d.r * (0.3 + r() * 0.4), d.r * 0.22, 'rgba(60,110,200,0.35)'); }
  else if (d.kind === 'hole') ell(d.x, d.y, d.r, d.r * 0.55, 'rgba(30,20,10,0.7)');
  ctx.globalAlpha = 1;
}
function drawHazard(h) {
  if (h.kind === 'stealthrock') {
    const bob = Math.round(Math.sin(B.time * 3 + h.seed * 9) * 2);
    ell(h.x, h.y + 3, 6, 2, 'rgba(0,0,0,0.3)');
    if (!particle('Stealth_Rock_Front', h.x, h.y - 10 + bob, 0.15 + h.seed * 0.1, { ft: 999, scale: 1 })) ell(h.x, h.y - 8 + bob, 5, 5, '#8a7a66', '#3b3128');
  } else if (h.kind === 'spikes' || h.kind === 'toxicspikes') {
    const r = seeded(Math.floor(h.seed * 1e4)), name = h.kind === 'spikes' ? 'Spikes_RSE' : 'Spikes_Purple_RSE';
    for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = r() * h.r * 0.8; particle(name, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.5, 0.05 * i, { ft: 999, scale: SS }); }
  } else if (h.kind === 'stickyweb') {
    const p = VFX.particles.String_Shot_Web;
    if (p) drawParticle({ p, x: h.x, y: h.y, t: (p.frames - 1) * 3 / 60, ft: 3, dir: 0, scale: Math.max(1, Math.round(h.r * 2 / p.fw)), z: 0, alpha: 0.8 });
  }
}
const WEATHER_TINT = { sun: 'rgba(255,190,90,0.13)', rain: 'rgba(40,60,120,0.18)', sand: 'rgba(190,150,80,0.2)', snow: 'rgba(210,230,255,0.15)' };
const TERRAIN_TINT = { electric: '#ffe34d', grassy: '#5fd35f', psychic: '#e05cd0', misty: '#ffc6f0' };
let weatherParts = [];
function drawWeather(dt) {
  const w = B.field.weather;
  if (!w) { weatherParts.length = 0; return; }
  ctx.fillStyle = WEATHER_TINT[w]; ctx.fillRect(view.x, view.y, view.w, view.h);
  const want = w === 'sun' ? 25 : 120;
  while (weatherParts.length < want) weatherParts.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.2) });
  weatherParts.length = want;
  for (const p of weatherParts) {
    if (w === 'rain') { p.x -= 0.15 * dt * p.s; p.y += 0.9 * dt * p.s; }
    else if (w === 'sand') { p.x += 0.6 * dt * p.s; p.y += 0.08 * dt * p.s; }
    else if (w === 'snow') { p.x += Math.sin(B.time + p.s * 9) * 0.03 * dt; p.y += 0.08 * dt * p.s; }
    else p.y += 0.02 * dt;
    if (p.y > 1) { p.y -= 1; p.x = Math.random(); } if (p.x > 1) p.x -= 1; if (p.x < 0) p.x += 1;
    const x = Math.round(view.x + p.x * view.w), y = Math.round(view.y + p.y * view.h);
    if (w === 'rain') pline(x, y, x + 2, y - 7, 'rgba(170,200,255,0.6)');
    else if (w === 'sand') { ctx.fillStyle = 'rgba(214,178,110,0.75)'; ctx.fillRect(x, y, 2, 1); }
    else if (w === 'snow') { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, p.s > 0.9 ? 2 : 1, p.s > 0.9 ? 2 : 1); }
    else if (Math.sin(B.time * 3 + p.s * 10) > 0.4) { ctx.fillStyle = 'rgba(255,240,180,0.7)'; ctx.fillRect(x, y, 1, 1); }
  }
}
function insideGrass(e) { return B.grass.some(g => !g.burnt && Math.hypot((e.x - g.x) / g.r, (e.y - g.y) / (g.r * 0.7)) < 1); }
const LIGHT_BALL = { White: 'White', Blue: 'Blue', Green: 'Green', Yellow: 'Yellow', Purple: 'Purple', Pink: 'Pink', Brown: 'Brown', Red: 'Pink', Black: 'Purple' };
const lightBall = type => LIGHT_BALL[fxColor(type)] || 'White';

function drawWorld(dt) {
  const ar = B.arena, props = ar.props || {};
  const bg = dimmed(ar.bg);
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#4a4752'; ctx.fillRect(0, 0, ar.w, ar.h); }
  // ambient shade on the floor only (mons are drawn after it, so they stay bright); glows come later in drawLighting
  if (B.field.weather !== 'sun') { ctx.fillStyle = B.field.weather === 'rain' ? 'rgba(10,16,40,0.2)' : 'rgba(18,10,40,0.12)'; ctx.fillRect(view.x, view.y, view.w, view.h); }
  if (B.mega && !B.mega.done) { ctx.fillStyle = `rgba(4,0,16,${0.6 * Math.min(1, B.mega.t / 0.3)})`; ctx.fillRect(view.x, view.y, view.w, view.h); }
  if (B.field.terrain) { ctx.globalAlpha = 0.12 + 0.05 * Math.sin(B.time * 2); ctx.fillStyle = TERRAIN_TINT[B.field.terrain]; ctx.fillRect(ar.wall, ar.wall, ar.w - ar.wall * 2, ar.h - ar.wall * 2); ctx.globalAlpha = 1; }
  for (const d of B.decals) drawDecal(d);
  for (const p of B.puddles) blob(props.puddle, p.x, p.y, p.r * 1.1, p.r * 0.8, '#3d64a8', p.x);
  for (const g of B.grass) if (g.burnt) ell(g.x, g.y, g.r * 0.8, g.r * 0.45, 'rgba(40,30,20,0.4)');
  for (const h of B.hazards) if (h.kind !== 'stealthrock') drawHazard(h);
  if (window.drawFieldFx) drawFieldFx(); // field traps + waves (src/fieldfx.js)
  // telegraphs: hard-edged rings that fill up before the hit lands
  for (const k of B.marks) {
    const p = clamp(k.t / k.delay, 0, 1), col = TYPE_COLOR[k.move.type];
    if (k.track) { drawReticle(k, col); continue; }
    ell(k.x, k.y, k.r, k.r * 0.55, col + '30', col, 1);
    ell(k.x, k.y, k.r * p, k.r * 0.55 * p, col + '50');
    if (k.kind !== 'strike') {
      const x = lerp(k.sx, k.x, p), y = lerp(k.sy, k.y, p) - Math.sin(p * Math.PI) * 60;
      ell(x, lerp(k.sy + 12 * SS, k.y, p), 4, 2, 'rgba(0,0,0,0.35)');
      if (!particle(k.move.fx?.anims?.[0], x, y, k.t)) particle('Light_Ball_' + lightBall(k.move.type), x, y, k.t, { scale: 0.5 });
    }
  }
  // ground waves (Earthquake-style ripples)
  for (const a of B.areas) {
    const p = clamp(a.t / a.dur, 0, 1), col = a.ground ? '#f2e6c8' : (TYPE_COLOR[a.move.type] || '#fff');
    for (let i = 0; i < 3; i++) { const q = clamp(p - i * 0.15, 0, 1); if (q <= 0) continue; ctx.globalAlpha = (1 - q) * 0.9; ell(a.x, a.y, a.r * q, a.r * q * 0.55, null, col, 3 - i); }
    ctx.globalAlpha = 1;
  }
  // shadows
  for (const s of B.sides) {
    const e = s.ent, m = activeMon(s), key = spriteKey(m), r = bodyRadius(key);
    if (m.fainted && e.animT > 1.2) continue;
    if (e.hidden > 0 || m.fainted || !drawMonShadow(key, e.anim, e.animT, e.face, e.x, e.y, { z: e.z, loop: !e.animOnce })) ell(e.x, e.y, r * (e.hidden > 0 ? 0.6 : 0.95), r * 0.42, 'rgba(0,0,0,0.42)');
  }
  // depth-sorted things
  const list = [];
  for (const s of B.sides) list.push({ y: s.ent.y, f: () => drawSideMon(s) });
  for (const r of B.rocks) list.push({ y: r.y, f: () => { const im = dimmed(props.rock); if (im) drawFrame(im, 0, 0, im.width, im.height, Math.round((r.x - im.width / 2) / 2) * 2, Math.round((r.y - im.height + r.r * 0.5) / 2) * 2, r.flash > 0 ? '#fff' : null); else ell(r.x, r.y, r.r, r.r * 0.6, '#7d7266', '#3e352c'); } });
  for (const h of B.hazards) if (h.kind === 'stealthrock') list.push({ y: h.y, f: () => drawHazard(h) });
  for (const p of B.proj) list.push({ y: p.y + 10, f: () => drawProjectile(p) });
  // HGSS overworld trainers on the sidelines, facing the arena (data/trainer-ow.js; id taken from the battle sprite file name)
  B.sides.forEach((s, i) => {
    const id = (s.trainerSprite || '').split('/').pop().replace(/^player-|\.png$/g, '');
    const ow = window.TRAINER_OW && (TRAINER_OW[id] || TRAINER_OW[{ chase: 'ethan', elaine: 'lyra' }[id]]);
    const x = i ? ar.w - ar.wall - 18 : ar.wall + 18, y = ar.h / 2;
    if (ow) list.push({ y, f: () => { const raw = img(ow.file); if (!raw) return; ell(x, y, 7 * SS, 3 * SS, 'rgba(0,0,0,0.42)'); drawFrame(outlined(raw, ow.fw, ow.fh), 0, ow.rows.indexOf(i ? 'left' : 'right') * ow.fh, ow.fw, ow.fh, Math.round(x - ow.fw * SS / 2), Math.round(y - ow.footY * SS), null, 1, SS); } });
  });
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const g of B.grass) if (!g.burnt) { ctx.globalAlpha = 0.92; blob(props.grass, g.x, g.y - 4, g.r * 1.1, g.r * 0.85, '#3f8a37', g.y, true); ctx.globalAlpha = 1; }
  // beams, particles
  for (const b of B.beams) {
    if (b.laser) { drawLaser(b); continue; }
    ctx.globalAlpha = 1 - clamp((b.t - b.dur * 0.6) / (b.dur * 0.4), 0, 1);
    if (!drawBeam(b.move.fx?.beam || '', b.x, b.y, b.ang, b.len, b.t, b.w / 14 * SS / 2)) {
      const name = b.move.fx?.anims?.[0] || 'Light_Ball_' + lightBall(b.move.type);
      for (let d = 0; d < b.len; d += 14) particle(name, b.x + Math.cos(b.ang) * d, b.y + Math.sin(b.ang) * d, b.t + d / 400, { scale: name.startsWith('Light_Ball') ? 0.4 : SS * 0.75 });
    }
    ctx.globalAlpha = 1;
  }
  for (const f of B.fx) {
    if (f.p) drawParticle(f);
    else if (f.spark) pline(f.x - f.vx * 0.025, f.y - f.vy * 0.025, f.x, f.y, f.col, 2);
    else if (f.column) { const q = f.t / f.life; ctx.globalAlpha = 1 - q * q; drawBeam(f.column, f.x, f.y - 200, Math.PI / 2, 200, f.t); ctx.globalAlpha = 1; }
  }
  drawLighting();
  if (B.impact) {
    // impact frame: black void, white speed lines bursting from the hit, both mons as white silhouettes
    const k = B.impact, rr = seeded(Math.floor(k.seed));
    ctx.fillStyle = '#000'; ctx.fillRect(view.x, view.y, view.w, view.h);
    for (let i = 0; i < 48; i++) { const a = rr() * Math.PI * 2, r0 = 24 + rr() * 60, r1 = r0 + 160 + rr() * 400; pline(k.x + Math.cos(a) * r0, k.y + Math.sin(a) * r0, k.x + Math.cos(a) * r1, k.y + Math.sin(a) * r1, '#fff', 1 + (i % 3)); }
    for (const s of B.sides) { const e = s.ent, m = activeMon(s); if (!m.fainted && !(e.hidden > 0)) drawMonSprite(spriteKey(m), e.anim, e.animT, e.face, e.x, e.y, { z: e.z, tint: '#fff', loop: !e.animOnce }); }
  }
  for (const s of B.sides) drawLaserTell(s);
  // aim chevron + swap wheel for the human side
  const me = B.sides[meIdx()];
  if (me && !activeMon(me).fainted && me.ent.hidden <= 0) {
    const e = me.ent, cx = e.x + e.aimX * 22 * SS, cy = e.y - 10 * SS + e.aimY * 16 * SS, a = Math.atan2(e.aimY, e.aimX);
    const tip = [cx + Math.cos(a) * 6, cy + Math.sin(a) * 6];
    for (const s of [-1, 1]) { const b = a + Math.PI - s * 0.6; pline(tip[0] + 1, tip[1] + 1, tip[0] + Math.cos(b) * 8 + 1, tip[1] + Math.sin(b) * 8 + 1, '#000', 2); pline(tip[0], tip[1], tip[0] + Math.cos(b) * 8, tip[1] + Math.sin(b) * 8, '#fff', 2); }
    if (me.wheel) drawWheel(me);
  }
  drawWeather(dt);
}
function drawProjectile(p) {
  ell(p.x, p.y + 10 * SS, p.r * 0.8, p.r * 0.35, 'rgba(0,0,0,0.25)');
  const fx = p.move.fx || {}, name = fx.anims?.[0] || fx.hitAnim || (p.move.type === 'Electric' ? 'Spark' : '');
  // whole-number scales only (2x or 3x) so projectile pixels stay square
  const k = p.r >= 22 ? 2 : p.r >= 11 ? 1.5 : 1;
  if (!particle(name, p.x, p.y, p.t, { dir: dirFromVec(p.vx, p.vy), scale: SS * k }))
    particle('Light_Ball_' + lightBall(p.move.type), p.x, p.y, p.t, { scale: k / 2 });
}
// Arena prop (puddle / grass patch, already shaped and pixel-doubled by tools/build-world.mjs) drawn 1:1, centred,
// snapped to the 2px art grid so its pixels line up with the arena and the 2x mons. Without art: a wobbly blob.
function blob(src, x, y, rx, ry, fallback, seed, tufts) {
  const im = dimmed(src), rr = seeded(Math.floor(seed * 13) + 7);
  if (im) { ctx.drawImage(im, Math.round((x - im.width / 2) / 2) * 2, Math.round((y - im.height / 2) / 2) * 2); return; }
  ctx.save(); ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, k = (tufts ? (i % 2 ? 0.86 : 1.06) : 1) * (0.92 + rr() * 0.12); const px = Math.round(x + Math.cos(a) * rx * k), py = Math.round(y + Math.sin(a) * ry * k); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.clip();
  ctx.fillStyle = fallback; ctx.fillRect(x - rx - 4, y - ry - 4, rx * 2 + 8, ry * 2 + 8);
  ctx.restore();
}
function drawSideMon(s) {
  const e = s.ent, m = activeMon(s), key = spriteKey(m);
  if (m.fainted) { if (e.animT < 1.2) drawMonSprite(key, spriteOf(key)?.anims.Faint ? 'Faint' : 'Hurt', e.animT, e.face, e.x, e.y, { alpha: clamp(1.2 - e.animT, 0, 1), loop: false }); return; }
  if (e.hidden > 0) {
    if (m.vol.lastMove === 'dig') ell(e.x, e.y, 10 * SS, 5 * SS, 'rgba(90,60,30,0.6)');
    else if (e.flying && B.time - e.flyT0 < 0.18) { // takeoff: squash, then a tall stretch as it shoots off the top
      const p = (B.time - e.flyT0) / 0.18;
      drawMonSprite(key, e.anim, e.animT, e.face, e.x, e.y, { z: p * p * 90 * SS, alpha: 1 - p * p, stretch: p < 0.3 ? [1 + 0.25 * (1 - p / 0.3), 1 - 0.3 * (1 - p / 0.3)] : [1 - 0.35 * p, 1 + 0.9 * p] });
    }
    return;
  }
  const blink = e.iframes > 0 && !e.dodge && Math.floor(B.time * 20) % 2 === 0;
  const tint = e.flash > 0 ? '#ffffff' : m.status === 'frz' ? 'rgba(150,220,255,0.55)' : (m.status === 'psn' || m.status === 'tox') && Math.sin(B.time * 6) > 0.6 ? 'rgba(170,60,200,0.35)' : null;
  const grow = e.enterT > 0 ? 1 - e.enterT / 0.35 : 1;
  const alpha = blink ? 0.45 : insideGrass(e) ? 0.6 : 1;
  // dodge afterimage: a fading trail of the sprite at its recent positions
  const tr = e.trail || (e.trail = []);
  if (e.dodge && (!tr.length || Math.hypot(tr[tr.length - 1].x - e.x, tr[tr.length - 1].y - e.y) > 22)) tr.push({ x: e.x, y: e.y, z: e.z, anim: e.anim, animT: e.animT, face: e.face, t: B.time });
  while (tr.length && B.time - tr[0].t > 0.22) tr.shift();
  for (const g of tr) drawMonSprite(key, g.anim, g.animT, g.face, g.x, g.y, { z: g.z, alpha: 0.22 * (1 - (B.time - g.t) / 0.22), tint: 'rgba(190,225,255,0.45)', noOutline: true });
  drawMonSprite(key, e.anim, e.animT, e.face, e.x, e.y, { z: e.z, stretch: e.dodge ? (a => [1 - 0.12 * a, 1 + 0.2 * a])(Math.sin((1 - e.dodge.t / TUNE.DODGE_TIME) * Math.PI)) : undefined, tint, alpha, loop: !e.animOnce, scale: SS * (grow < 1 ? Math.max(0.25, Math.round(grow * 4) / 4) : 1), outline: outlineTell(s, e, m) });
  const top = e.y - 30 * SS - e.z;
  if (e.protect > 0) ell(e.x, e.y - 14 * SS - e.z, 22 * SS, 22 * SS, 'rgba(120,200,255,0.25)', '#bfe8ff', 2);
  if (m.status === 'slp' && Math.floor(B.time * 2) % 2 === 0) { ctx.fillStyle = '#fff'; pixelZ(e.x + 12 * SS, top + 4 - (B.time * 8 % 8)); }
  if (m.vol.confused > 0) for (let i = 0; i < 3; i++) { const a = B.time * 4 + i * 2.1; ctx.fillStyle = '#ffe56b'; ctx.fillRect(Math.round(e.x + Math.cos(a) * 12), Math.round(top + Math.sin(a) * 3), 2, 2); }
  if (m.status === 'brn' && Math.random() < 0.04) spawnFx('Puff_Red', e.x + rand(-8, 8) * SS, e.y - rand(5, 20) * SS, { scale: 1 });
  if (m.status === 'par' && Math.random() < 0.03) spawnFx('Spark', e.x + rand(-8, 8) * SS, e.y - rand(5, 20) * SS, { scale: 1 });
  if (e.act && e.act.charging && !e.act.fired && Math.random() < 0.08) spawnFx('Charge_Up', e.x, e.y - 12 * SS, { scale: SS * 0.75 });
  // held shot: the orb grows at the mouth, flickering once full
  const ca = e.act; if (ca?.pow && !ca.noOrb && !ca.fired && (ca.pow < 1 || Math.floor(B.time * 16) % 2)) drawProjectile({ x: e.x + e.aimX * (26 + 26 * ca.pow), y: e.y - 10 * SS - e.z + e.aimY * 14, r: 6 + 17 * ca.pow, move: ca.move, vx: e.aimX, vy: e.aimY, t: B.time });
  if (s.cpu && e.act && !e.act.fired && !e.act._emote) { e.act._emote = true; spawnFx('Emote_Shock', e.x + 10 * SS, top - 6, { scale: 1 }); }
}
function pixelZ(x, y) { x = Math.round(x); y = Math.round(y); ctx.fillRect(x, y, 5, 1); ctx.fillRect(x + 3, y + 1, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1); ctx.fillRect(x + 1, y + 3, 1, 1); ctx.fillRect(x, y + 4, 5, 1); }
function drawWheel(s) {
  const e = s.ent, R = 30 * SS, cy = e.y - 14 * SS;
  ell(e.x, cy, R + 26, R + 26, 'rgba(0,0,0,0.4)');
  s.team.forEach((m, i) => {
    const a = wheelAng(i), x = Math.round(e.x + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R);
    const sel = s.wheel.sel === i, cur = s.cur === i;
    ell(x, y, 22, 22, sel ? '#ffe36b' : cur ? '#7fb5ff' : '#e8e8f0', '#000', 2);
    const im = img(spriteOf(m.sp.sprite)?.portrait);
    if (im) { ctx.globalAlpha = m.fainted ? 0.3 : 1; ctx.drawImage(im, x - 20, y - 20, 40, 40); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#000'; ctx.fillRect(x - 16, y + 23, 32, 4);
    ctx.fillStyle = m.fainted ? '#555' : m.hp / m.maxHp > 0.5 ? '#4cd964' : m.hp / m.maxHp > 0.2 ? '#ffcc00' : '#ff3b30';
    ctx.fillRect(x - 15, y + 24, Math.round(30 * m.hp / m.maxHp), 2);
  });
}

// ---------- frame ----------
function drawBattle(dt) {
  updateCamera(dt);
  const c = B.cam;
  // world canvas covers the view in world pixels; the camera's fractional offset is applied when scaling up
  const vw = Math.ceil(VW / c.z) + 3, vh = Math.ceil(VH / c.z) + 3;
  if (worldCv.width !== vw || worldCv.height !== vh) { worldCv.width = vw; worldCv.height = vh; }
  const sx = Math.round((Math.random() - 0.5) * c.shake / c.z * 2), sy = Math.round((Math.random() - 0.5) * c.shake / c.z * 2);
  const left = c.x - VW / 2 / c.z, top = c.y - VH / 2 / c.z, ox = Math.floor(left), oy = Math.floor(top);
  view = { x: ox, y: oy, w: vw, h: vh };
  ctx = worldCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, vw, vh);
  ctx.translate(-ox + sx, -oy + sy);
  drawWorld(dt);
  ctx = screenCtx;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  // impact frames strobe between a hard black/white frame and its negative
  if (B.impact && Math.floor(B.impact.t * 30) % 2) ctx.filter = 'invert(1)';
  ctx.drawImage(worldCv, -(left - ox) * c.z, -(top - oy) * c.z, vw * c.z, vh * c.z);
  ctx.filter = 'none';
  if (B.flashT > 0) { ctx.globalAlpha = Math.min(0.85, B.flashT * 3); ctx.fillStyle = B.flashCol || '#fff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  // Damage numbers are big and pop in; "Super effective!" / "Critical!" are loud too; other labels stay smaller.
  const placed = [];
  for (const f of B.floats) {
    const q = f.t / (f.num ? 0.9 : 1.3), p = worldToScreen(f.x, f.y), Z = clamp(c.z / 2, 0.7, 1.6);
    const pop = f.t < 0.12 ? 1 + (1 - f.t / 0.12) * 0.7 : 1;
    // every label (status, no effect, boosts, ...) is big Bungee like the damage numbers; labels hang a bit longer than numbers
    const size = Math.round((f.num ? 16 + f.size * 1.6 : 13 + f.size * 1.4) * Z * pop), x = Math.round(p.x), hw = f.s.length * size * 0.32;
    let y = Math.round(p.y - q * (f.num ? 46 : 30));
    // older labels keep their spot; newer ones slide up until they clear every label they would overlap
    for (let n = 0; n < 8 && placed.some(o => Math.abs(o.x - x) < o.hw + hw && Math.abs(o.y - y) < (o.size + size) * 0.55); n++) y -= size * 0.9;
    placed.push({ x, y, hw, size });
    ctx.globalAlpha = q < 0.65 ? 1 : 1 - (q - 0.65) / 0.35;
    text(f.s, x, y, size, f.color, 'center', '#000', 'Bungee');
    ctx.globalAlpha = 1;
  }
  if (!B.demo) drawHUD();
}

// ---------- HUD ----------
function hudChip(x, y, label, color, h = 22) {
  ctx.font = `${h * 0.62}px Bungee, "Arial Black", sans-serif`;
  const w = ctx.measureText(label).width + h * 0.9;
  rrect(x, y, w, h, h / 2, color);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + h * 0.45, y + h / 2 + 1);
  return w + 5;
}
function pokeball(x, y, r, state) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = state === 'fainted' ? '#555' : '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fillStyle = state === 'fainted' ? '#333' : '#e8342c'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
  if (state === 'active') { ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
}
// HUD portrait emotion from live state. Each reaction is a fallback list (first one the species has wins)
// with a priority and a minimum hold: a stronger reaction cuts in at once, a weaker one waits out the hold.
const PORTRAIT_BUMP = [1, -1, 1, -1, 0];
function portraitEmotion(s, m) {
  const e = s.ent, foe = B.sides[1 - s.idx], fr = m.hp / m.maxHp;
  const st = s.pf || (s.pf = { mon: null, list: null, prio: 0, until: 0, hp: 0, bumpT: -9 });
  if (st.mon !== m) Object.assign(st, { mon: m, list: null, prio: 0, until: 0, hp: m.hp });
  const drop = (st.hp - m.hp) / m.maxHp; st.hp = m.hp;
  // ambient faces (prio 0) have no hold so they never block anything
  let list = ['Normal'], prio = 0, hold = 0, hit = false;
  if (m.fainted) [list, prio, hold] = [['Crying', 'Dizzy', 'Sad', 'Pain', 'Stunned'], 9, 99];
  else if (drop >= 0.2) [list, prio, hold, hit] = [['Shouting', 'Stunned', 'Pain'], 5, 0.6, true];
  else if (e.hurtT > 0 || drop > 0.005) [list, prio, hold, hit] = [['Pain', 'Stunned', 'Shouting'], 4, 0.4, true];
  else if ((m.megaed && e.anim === 'Pose') || foe.koT > 0) [list, prio, hold] = [['Joyous', 'Happy', 'Inspired', 'Determined'], 3, 0.8];
  else if (e.laser || e.act?.charging) [list, prio, hold] = [['Shouting', 'Inspired', 'Determined', 'Angry'], 2, 0.3];
  else if (e.act) [list, prio, hold] = [['Determined', 'Angry'], 2, 0.3];
  else if (e.dodge) [list, prio, hold] = [['Surprised', 'Worried'], 1, 0.3];
  else if (m.status === 'slp') list = ['Sigh', 'Dizzy'];
  else if (e.stun > 0 || m.vol.confused > 0) list = ['Dizzy', 'Stunned'];
  else if (fr < 0.25) list = ['Teary-Eyed', 'Worried', 'Sad', 'Pain'];
  else if (fr < 0.5) list = ['Worried'];
  if (list[0] === st.list?.[0]) st.until = Math.max(st.until, B.time + hold);
  else if (B.time >= st.until || prio > st.prio) {
    if (hit && st.prio < 4) st.bumpT = B.time;
    Object.assign(st, { list, prio, until: B.time + hold });
  }
  const P = window.PORTRAITS?.[spriteKey(m)] || {};
  const emo = (st.list || ['Normal']).find(n => P[n]) || 'Normal';
  return { emo, bump: PORTRAIT_BUMP[Math.floor((B.time - st.bumpT) / 0.03)] || 0 };
}
function drawSideHUD(s, right) {
  const m = activeMon(s), S = Math.min(1, VW / 1500), pad = 14 * S;
  const dir = right ? -1 : 1, P = 74 * S;
  const px = right ? VW - pad - P : pad;
  rrect(px, pad, P, P, 8 * S, right ? '#7fd0e8' : '#f08a8a', '#fff', 3);
  const pe = portraitEmotion(s, m), pkey = spriteKey(m);
  const pim = img(window.PORTRAITS?.[pkey]?.[pe.emo]) || img(spriteOf(pkey)?.portrait);
  if (pim) {
    // whole-number scale of the 40px source, centred and clipped to the box, so pixels stay square
    const inner = P - 8, k = Math.max(1, Math.round(inner / pim.naturalWidth)), D = pim.naturalWidth * k;
    ctx.save(); ctx.beginPath(); ctx.rect(px + 4, pad + 4, inner, inner); ctx.clip();
    ctx.drawImage(pim, Math.round(px + 4 + (inner - D) / 2 + pe.bump * k), Math.round(pad + 4 + (inner - D) / 2), D, D);
    ctx.restore();
  }
  const nx = right ? px - 12 * S : px + P + 12 * S;
  const name = (m.sp.name + (m.vol.as ? ` (${m.vol.as})` : '')).toUpperCase(), lv = `Lv${m.level}`;
  text(name, nx, pad + 17 * S, 26 * S, '#fff', right ? 'right' : 'left', '#000');
  ctx.font = `${26 * S}px Bungee, "Arial Black", sans-serif`; const nw = ctx.measureText(name).width + 10 * S;
  text(lv, nx + (right ? -nw : nw), pad + 19 * S, 18 * S, '#ffe36b', right ? 'right' : 'left', '#000');
  const chips = [...typesOf(m).map(t => [t.toUpperCase(), TYPE_COLOR[t]])];
  for (const k of ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion']) if (m.stages[k]) chips.push([`${STAT_NAMES[k]}${m.stages[k] > 0 ? '+' : ''}${m.stages[k]}`, m.stages[k] > 0 ? '#3a7bd5' : '#c0392b']);
  if (m.status) chips.push([STATUS_LABEL[m.status], { brn: '#e2621b', par: '#c9a800', psn: '#9b3fb5', tox: '#7a1f9a', slp: '#7d7d9a', frz: '#40b4d8' }[m.status]]);
  if (m.vol.confused > 0) chips.push(['CNF', '#b08a2a']);
  const ch = 20 * S;
  if (right) { let x = nx; for (const [l, c] of chips) { ctx.font = `${ch * 0.62}px Bungee, "Arial Black", sans-serif`; x -= ctx.measureText(l).width + ch * 0.9; hudChip(x, pad + 34 * S, l, c, ch); x -= 5; } }
  else { let x = nx; for (const [l, c] of chips) x += hudChip(x, pad + 34 * S, l, c, ch); }
  const bw = 330 * S, bh = 24 * S, bx = right ? nx - bw : nx, by = pad + 60 * S;
  rrect(bx, by, bw, bh, 5 * S, '#22252b', '#fff', 2);
  const fr = m.hp / m.maxHp; s.hpShow = s.hpShow === undefined ? fr : lerp(s.hpShow, fr, 0.08);
  const col = fr > 0.5 ? '#5ad25a' : fr > 0.2 ? '#f5c518' : '#ee3b3b';
  if (s.hpShow > fr) rrect(right ? bx + bw - (bw - 4) * s.hpShow - 2 : bx + 2, by + 2, Math.max(0, (bw - 4) * s.hpShow), bh - 4, 4 * S, '#ffffff99');
  rrect(right ? bx + bw - (bw - 4) * fr - 2 : bx + 2, by + 2, Math.max(0, (bw - 4) * fr), bh - 4, 4 * S, col);
  text(String(Math.ceil(m.hp)), right ? bx + bw - 10 * S : bx + 10 * S, by + bh / 2 + 1, 15 * S, '#fff', right ? 'right' : 'left', '#000');
  const ty = pad + P + 10 * S, T = 40 * S;
  const tim = img(s.trainerSprite);
  rrect(px + (right ? P - T - 6 : 6), ty, T + 6, T, 6 * S, '#b9d3f0', '#fff', 2);
  if (tim) ctx.drawImage(tim, 0, 0, tim.naturalWidth, tim.naturalHeight * 0.7, px + (right ? P - T - 4 : 8), ty + 2, T, T * 0.92);
  const bx2 = right ? px + P - T - 22 * S : px + T + 24 * S;
  s.team.forEach((tm, i) => {
    const x = bx2 + dir * i * 24 * S;
    pokeball(x, ty + T / 2, 8 * S, tm.fainted ? 'fainted' : i === s.cur ? 'active' : 'ok');
    if (s.idx === meIdx() && !INPUT.usingPad) text(String(i + 1), x, ty + T / 2 + 17 * S, 10 * S, '#fff', 'center');
  });
  text(s.name.toUpperCase(), bx2 + dir * 6 * 24 * S + (right ? -4 : 4), ty + T / 2, 16 * S, right ? '#7fd0e8' : '#7be07b', right ? 'right' : 'left', '#000');
  Object.entries(s.screens).filter(([, v]) => v > 0).forEach(([k, v], i) => text(`${DEX.moves[k]?.name || k} ${Math.ceil(v)}`, right ? VW - pad : pad, ty + T + 22 * S + i * 15 * S, 11 * S, '#bfe8ff', right ? 'right' : 'left'));
  B.callouts.filter(c => c.side === s.idx).forEach((c, i) => {
    const a = clamp(Math.min(c.t * 8, (1.6 - c.t) * 4), 0, 1), y = ty + T + 40 * S + i * 36 * S;
    ctx.globalAlpha = a; ctx.font = `italic 20px Bungee, "Arial Black", sans-serif`;
    const w = ctx.measureText(c.s).width * S + 34 * S, x = right ? VW - pad - w : pad;
    rrect(x, y, w, 30 * S, 15 * S, '#fff6dd', '#2a2010', 3);
    text(c.s, x + w / 2, y + 15 * S + 1, 18 * S, '#111', 'center', null);
    ctx.globalAlpha = 1;
  });
}
const PAD_ICONS = ['xbox_a', 'xbox_b', 'xbox_x', 'xbox_y'], PC_ICONS = ['mouse_left', 'mouse_right', 'key_q', 'key_e'];
function drawHUD() {
  const S = Math.min(1, VW / 1500);
  drawSideHUD(B.sides[0], false); drawSideHUD(B.sides[1], true);
  const t = Math.floor(B.time), clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  rrect(VW / 2 - 55 * S, 14 * S, 110 * S, 38 * S, 19 * S, '#111a', null);
  text(clock, VW / 2, 33 * S, 22 * S, '#fff', 'center', null);
  let fy = 66 * S;
  if (B.field.weather) { const lbl = { sun: 'HARSH SUN', rain: 'RAIN', sand: 'SANDSTORM', snow: 'SNOW' }[B.field.weather]; text(B.field.weatherT > 1e6 ? lbl : `${lbl} ${Math.ceil(B.field.weatherT)}`, VW / 2, fy, 13 * S, '#ffe7a8', 'center'); fy += 18 * S; }
  if (B.field.terrain) { text(`${B.field.terrain.toUpperCase()} TERRAIN ${Math.ceil(B.field.terrainT)}`, VW / 2, fy, 13 * S, TERRAIN_TINT[B.field.terrain], 'center'); fy += 18 * S; }
  B.callouts.filter(c => c.side === -1).forEach((c, i) => { ctx.globalAlpha = clamp((1.6 - c.t) * 3, 0, 1); text(c.s, VW / 2, fy + 10 * S + i * 22 * S, 16 * S, '#fff', 'center'); ctx.globalAlpha = 1; });
  const me = B.sides[meIdx()]; if (!me) return;
  const m = activeMon(me), W = 210 * S, H = 46 * S, gap = 10 * S, total = 4 * W + 3 * gap, pad = INPUT.usingPad;
  const y = VH - H - 18 * S; let x = VW / 2 - total / 2;
  m.moves.forEach((mv, i) => {
    const ready = canUse(me, i), cd = m.cds[i], tc = TYPE_COLOR[mv.type] || '#888';
    rrect(x, y, W, H, 10 * S, ready ? '#1c1f26ee' : '#1c1f26aa', ready ? tc : '#555', 3);
    icon((pad ? PAD_ICONS : PC_ICONS)[i], x + 25 * S, y + H / 2, H >= 34 ? 32 : 16);
    text(mv.name, x + 50 * S, y + H / 2 - 6 * S, 15 * S, ready ? '#fff' : '#999', 'left');
    text(`${mv.type.toUpperCase()} ${mv.category === 'Status' ? 'STATUS' : mv.basePower || '-'}`, x + 50 * S, y + H / 2 + 11 * S, 10 * S, tc, 'left', null);
    if (cd > 0) {
      const max = cooldownFor(mv, m);
      ctx.fillStyle = '#000a'; ctx.beginPath(); ctx.roundRect(x, y, W * clamp(cd / max, 0, 1), H, 10 * S); ctx.fill();
      text(cd.toFixed(1), x + W - 22 * S, y + H / 2, 15 * S, '#fff', 'center');
    }
    if (me.choice >= 0 && me.choice !== i) text('LOCKED', x + W - 40 * S, y + 10 * S, 9 * S, '#ff9a9a', 'center');
    x += W + gap;
  });
  const sy = y - 30 * S;
  const ih = 16, pw = 150 * S;
  const pill = (px, ic, label, cd, ok, fill) => {
    rrect(px, sy, pw, 26 * S, 13 * S, fill || (ok ? '#2b3340dd' : '#2b334088'), ok ? '#cfe3ff' : '#555', 2);
    iconRow([...ic, ' ' + (cd > 0 ? `${label} ${cd.toFixed(1)}` : label)], px + pw / 2, sy + 13 * S, ih, 11 * S, ok ? '#fff' : '#999', 'center');
  };
  pill(VW / 2 - total / 2, [pad ? 'xbox_lb' : 'key_space'], 'DODGE', Math.max(0, me.dodgeCd), me.dodgeCd <= 0);
  pill(VW / 2 - total / 2 + pw + 8 * S, pad ? ['xbox_rb'] : ['key_1', '-', 'key_6'], 'SWAP', me.freeSwap > 0 ? 0 : Math.max(0, me.swapCd), me.swapCd <= 0 || me.freeSwap > 0);
  if (megaTarget(m) && !me.megaUsed) pill(VW / 2 + total / 2 - pw, pad ? ['xbox_lt', '+', 'xbox_rt'] : ['key_f'], 'MEGA', 0, true, `hsl(${B.time * 120 % 360},80%,45%)`);
  if (me.freeSwap > 0) text(pad ? 'Hold RB to switch out!' : 'Press 1-6 to switch out!', VW / 2, sy - 18 * S, 13 * S, '#9cf', 'center');
  if (m.vol.recharge > 0) text('Recharging...', VW / 2, sy - 18 * S, 13 * S, '#ff9a9a', 'center');
}
