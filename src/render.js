// Battle rendering. The arena is drawn into a low-res canvas at 1 canvas pixel = 1 world pixel, then
// scaled up with nearest-neighbour, so every sprite, effect and shape sits on the same pixel grid.
'use strict';

const worldCv = document.createElement('canvas'), worldCtx = worldCv.getContext('2d');
let view = { x: 0, y: 0, w: 0, h: 0 };
function screenToWorld(sx, sy) { const c = B.cam; return { x: c.x + (sx - VW / 2) / c.z, y: c.y + (sy - VH / 2) / c.z }; }
function worldToScreen(wx, wy) { const c = B.cam; return { x: (wx - c.x) * c.z + VW / 2, y: (wy - c.y) * c.z + VH / 2 }; }
function updateCamera(dt) {
  const c = B.cam, ar = B.arena, [a, b] = B.sides.map(s => s.ent);
  let mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 12 * SS;
  const ck = B.beams.find(q => q.clash)?.clash; // a laser clash pulls the camera onto the contact point
  if (ck) { mx = lerp(mx, ck.x, 0.55); my = lerp(my, ck.y, 0.55); }
  // zoom limits come from the fighting area plus a 48px rim, not the decorated border around it
  const zMin = Math.max(VW / (ar.w - ar.wall * 2 + 96), VH / (ar.h - ar.wall * 2 + 96)), zMax = zMin * 1.7;
  let z = Math.min(VW / (Math.abs(a.x - b.x) + 420), VH / (Math.abs(a.y - b.y) + 360));
  z = ar.world ? ADVR.zoomFor() : clamp(z, zMin, zMax) * (1 + c.punch * 0.6) * (ck ? 1.3 : 1);
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
// ell on the arena art's own pixel grid (SS world px per art pixel), for floor decals like traps and hazard rings
const snap2 = v => Math.round(v / SS) * SS;
function ell2(x, y, rx, ry, fill, stroke, lw = SS) { const c = ellipseSprite(rx / SS, ry / SS, fill, stroke, lw / SS); ctx.drawImage(c, snap2(x) - (c.width >> 1) * SS, snap2(y) - (c.height >> 1) * SS, c.width * SS, c.height * SS); }
function pline(x0, y0, x1, y1, color, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  while (n++ < 2000) { ctx.fillRect(x0 - (w >> 1), y0 - (w >> 1), w, w); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
// pline on the arena art's pixel grid (SS world px per art pixel)
function pline2(x0, y0, x1, y1, color, w = SS) { ctx.save(); ctx.scale(SS, SS); pline(x0 / SS, y0 / SS, x1 / SS, y1 / SS, color, Math.max(1, Math.round(w / SS))); ctx.restore(); }
function seeded(seed) { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

// ---------- sprite caches: outlined mon sheets, dimmed arena art ----------
// Outline is built one frame cell at a time, clipped to the cell, so it can't bleed into the neighbouring frame.
const OUTLINE = new Map();
// ring=true gives just the white 1px ring (sprite cut out), drawn tinted as a coloured outline for attack tells.
function outlined(im, fw = im.naturalWidth, fh = im.naturalHeight, ring = false) {
  const key = im.src + '|' + fw + 'x' + fh + (ring ? '|ring' : '');
  let c = OUTLINE.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;   // outfit sheets are canvases (src = their key)
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
  const a = animOf(key, animName), sc = (opts.scale ?? SS) * (spriteOf(key)?.scale || 1);
  const im = a && img(a.file); if (!im) return false;
  const rows = Math.round(im.naturalHeight / a.fh), f = animFrame(a, t, opts.loop ?? true), row = rows >= 8 ? face : 0;
  const k = 0.3, dh = Math.max(2, Math.round(a.fh * sc * k)), lift = Math.min(1, (opts.z || 0) / (40 * SS));
  ctx.globalAlpha = (opts.alpha ?? 1) * 0.42 * (1 - lift * 0.5);
  ctx.drawImage(silhouette(im), f * a.fw, row * a.fh, a.fw, a.fh, ADVR.fq(x) - Math.round(a.fw * sc / 2), ADVR.fq(y) - Math.round(a.footY * sc * k), a.fw * sc, dh);
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
  const dw = sw * scale * scaleX, dh = sh * scale * scaleY; // scaleX/Y = squash and stretch about the feet (dx/dy are for the unstretched frame)
  dx += (sw * scale - dw) / 2; dy += (sh * scale - dh) * 0.7;
  const wl = ADVWA.on && (ctx === ADVR.g || ADVR.rec) ? ADVWA.line(im, sx, sy, sw, sh, dx, dy, dw, dh) : 0;   // an Adventure person or mon in open water: its waterline
  if (ADVR.rec) { if (ADVR.rf && !ADVR.rf.ring) ADVR.rec.push([im, sx, sy, sw, sh, dx, dy, dw, dh, ADVR.rf[0], ADVR.rf[1], wl]); return; }   // the pre-pass only records Adventure sprites (adv-render.js: sun shadows, water reflections)
  ctx.globalAlpha = alpha;
  const draw = () => {
    ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh);
    if (ADVR.shadeE && !tint && ADVR.rf) ADVR.shadeSprite(im, sx, sy, sw, sh, dx, dy, dw, dh);   // an Adventure person or mon standing in a sun shadow
    if (tint) {
      tintCv.width = sw; tintCv.height = sh;
      tintCtx.globalCompositeOperation = 'source-over'; tintCtx.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
      tintCtx.globalCompositeOperation = 'source-atop'; tintCtx.fillStyle = tint; tintCtx.fillRect(0, 0, sw, sh);
      ctx.drawImage(tintCv, dx, dy, dw, dh);
    }
  };
  if (wl) ADVWA.sub(ctx, im, sx, sy, sw, sh, dx, dy, dw, dh, wl, draw); else draw();   // half submerged: cut at the waterline, the rest faint under the water
  ctx.globalAlpha = 1;
}
function drawMonSprite(key, animName, t, face, x, y, opts = {}) {
  const a = animOf(key, animName), sc = (opts.scale ?? SS) * (spriteOf(key)?.scale || 1); // sprite.scale: per-sprite size (Flowery 0.75), still nearest-neighbour
  if (!a) return;
  const im = img(a.file); if (!im) return;
  const rows = Math.round(im.naturalHeight / a.fh);
  const loop = opts.loop ?? ['Idle', 'Walk', 'Sleep', 'Hop', 'Charge', 'Rotate'].includes(animName);
  const f = animFrame(a, t, loop), row = rows >= 8 ? face : 0, dx = ADVR.fq(x) - Math.round(a.fw * sc / 2), dy = ADVR.fq(y) - Math.round(a.footY * sc) - ADVR.fq(opts.z || 0);   // foot rounded once (to the art px grid in the Adventure world), offsets whole: the locked camera rounds the same way
  const [kx, ky] = opts.stretch || [1, 1]; ADVR.rf = [ADVR.fq(y), ADVR.fq(opts.z || 0)];
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

// Ambient light, per arena: slanted god rays through the openings and a soft vignette. Both are pre-rendered once into small
// canvases from a 4x4 ordered dither with hard bands, so they stay pixel art and cost one drawImage per layer per frame.
// rays: count, colour, strength, half width (art px), lean (px sideways per px down). Arenas not listed get no rays.
const ARENA_LIGHT = {
  field: { rays: 5, col: [255, 244, 196], a: 0.24, hw: 10, lean: 0.5, vig: 0.8 },
  forest: { rays: 6, col: [255, 238, 168], a: 0.26, hw: 8, lean: 0.55, vig: 0.9 },
  viridian: { rays: 4, col: [236, 255, 204], a: 0.22, hw: 9, lean: 0.5, vig: 0.8 },
  cave: { rays: 3, col: [222, 234, 255], a: 0.2, hw: 6, lean: 0.4, vig: 1 },
  beach: { rays: 3, col: [208, 240, 255], a: 0.2, hw: 7, lean: 0.45, vig: 0.9 },
  pewter: { rays: 3, col: [255, 236, 186], a: 0.16, hw: 5, lean: 0.35, vig: 0.7 },
  volcano: { vig: 0.8 }, gym: { vig: 0.7 }, lorelei: { vig: 0.6 }, bruno: { vig: 0.6 }, agatha: { vig: 0.6 },
};
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LIGHT_CACHE = new Map();
// Two canvases at half resolution (one art pixel = 2 world px); rays alternate between them so they can shimmer out of phase.
function buildRays(ar, L) {
  const W = ar.w >> 1, H = ar.h >> 1, wall = ar.wall >> 1, rnd = seeded(ar.id.length * 7919 + L.rays);
  const x0 = wall - 12, x1 = W - wall + 12, y0 = wall - 16, y1 = H - wall + 12;
  const sMin = x0 - L.lean * y1, sMax = x1 - L.lean * y0, rays = [];
  for (let k = 0; k < L.rays; k++) rays.push({ s: sMin + (sMax - sMin) * ((k + 0.5 + (rnd() - 0.5) * 0.5) / L.rays), hw: L.hw * (0.6 + rnd() * 0.8), len: (y1 - y0) * (0.55 + rnd() * 0.45), layer: k & 1 });
  const cvs = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; });
  const ids = cvs.map(c => c.getContext('2d').createImageData(W, H)), alpha = [0, 0.35, 0.68, 1];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const s = x - L.lean * y; let v = 0, layer = 0;
    for (const r of rays) {
      const t = (1 - Math.abs(s - r.s) / r.hw) * clamp(1 - (y - y0) / r.len, 0, 1) * clamp((y - y0) / 10, 0, 1) * clamp((x - x0) / 8, 0, 1) * clamp((x1 - x) / 8, 0, 1);
      if (t > v) { v = t; layer = r.layer; }
    }
    if (v <= 0) continue;
    const lvl = Math.min(3, Math.floor(v * 3 + (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16));
    if (!lvl) continue;
    const d = ids[layer].data, o = (y * W + x) * 4;
    d[o] = L.col[0]; d[o + 1] = L.col[1]; d[o + 2] = L.col[2]; d[o + 3] = Math.round(255 * alpha[lvl] * L.a);
  }
  cvs.forEach((c, i) => c.getContext('2d').putImageData(ids[i], 0, 0));
  return cvs;
}
// Dark navy corners in 4 hard dithered bands, rebuilt only when the view size crosses a 32px bucket.
function buildVignette(w, h, strength) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), id = g.createImageData(w, h), alpha = [0, 0.07, 0.14, 0.22];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5) / w * 2 - 1, ny = (y + 0.5) / h * 2 - 1, d = Math.hypot(nx, ny), v = clamp((d - 0.7) / 0.75, 0, 1);
    const lvl = Math.min(3, Math.floor(v * 3 + (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16));
    if (lvl) { const o = (y * w + x) * 4; id.data[o] = 8; id.data[o + 1] = 6; id.data[o + 2] = 20; id.data[o + 3] = Math.round(255 * alpha[lvl] * strength); }
  }
  g.putImageData(id, 0, 0); return c;
}
function lightFor(ar) {
  let e = LIGHT_CACHE.get(ar.id);
  if (!e) { const L = ARENA_LIGHT[ar.id] || {}; e = { L, rays: L.rays ? buildRays(ar, L) : null, vig: null, vw: 0, vh: 0 }; LIGHT_CACHE.set(ar.id, e); }
  return e;
}
const isPreviewBattle = () => typeof PV !== 'undefined' && PV.B === B;
function drawRays() {
  const ar = B.arena, e = lightFor(ar), w = B.field.weather;
  if (!e.rays || isPreviewBattle() || w === 'rain' || (B.mega && !B.mega.done)) return;
  const k = w === 'sun' ? 1.5 : w ? 0.7 : 1;
  const x0 = Math.max(0, view.x & ~1), y0 = Math.max(0, view.y & ~1), x1 = Math.min(ar.w, (view.x + view.w + 1) & ~1), y1 = Math.min(ar.h, (view.y + view.h + 1) & ~1);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.globalCompositeOperation = 'lighter';
  e.rays.forEach((c, i) => {
    ctx.globalAlpha = Math.min(1, k * (0.55 + 0.15 * Math.round((0.5 + 0.5 * Math.sin(B.time * 0.7 + i * 2.4)) * 3)));
    ctx.drawImage(c, x0 / 2, y0 / 2, (x1 - x0) / 2, (y1 - y0) / 2, x0, y0, x1 - x0, y1 - y0);
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawVignette() {
  const e = lightFor(B.arena), s = e.L.vig ?? 0.8;
  if (isPreviewBattle()) return;
  const bw = Math.ceil(view.w / 32) * 32, bh = Math.ceil(view.h / 32) * 32;
  if (!e.vig || e.vw !== bw || e.vh !== bh) { e.vig = buildVignette(bw, bh, s); e.vw = bw; e.vh = bh; }
  ctx.drawImage(e.vig, view.x + ((view.w - bw) >> 1), view.y + ((view.h - bh) >> 1));
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
// Entry hazards: every one gets a pulsing ring in its owner's HUD colour on the floor (so it's clear whose it is on any
// background), a 1px dark outline round the art, and a short idle effect (glints on metal, purple bubbles, shimmer on web).
const HAZARD_SIDE = ['#f08a8a', '#7fd0e8'];
const hazardPulse = (h, rate = 2.2) => Math.round((0.5 + 0.5 * Math.sin(B.time * rate + h.seed * 6)) * 3) / 3; // 4 steps, no smooth fade
function hazardRing(h) {
  const col = HAZARD_SIDE[h.owner] || '#fff', k = hazardPulse(h);
  const rx = (h.kind === 'stealthrock' ? 13 : h.kind === 'stickyweb' ? h.r : Math.round(h.r * 0.95)) + 3, ry = Math.round(rx * 0.5) + 1;
  ctx.globalAlpha = 0.26 + 0.16 * k; ell2(h.x, h.y, rx, ry, col);
  ctx.globalAlpha = 0.9 + 0.1 * k; ell2(h.x, h.y, rx + 2, ry + 2, null, '#0c0a14', 6); ell2(h.x, h.y, rx, ry, null, col, 4);
  ctx.globalAlpha = 1;
}
// Particle sheet frame with a 1px dark outline (cached outlined sheet, same as the mons).
function hazardSprite(name, x, y, scale, frame = 0, alpha = 1) {
  const p = VFX.particles[name], im = p && img(p.file); if (!im) return false;
  const w = p.fw * scale, h = p.fh * scale;
  ctx.globalAlpha = alpha; ctx.drawImage(outlined(im, p.fw, p.fh), frame * p.fw, 0, p.fw, p.fh, snap2(x - w / 2), snap2(y - h / 2), w, h); ctx.globalAlpha = 1;
  return true;
}
// Plus-shaped sparkle that grows and fades over phase 0..1.
function glint(x, y, phase) {
  const n = Math.round((phase < 0.5 ? phase : 1 - phase) * 2 * 3); if (n < 1) return;
  x = snap2(x); y = snap2(y); const p = SS; ctx.fillStyle = '#fff'; ctx.fillRect(x - n * p, y, (n * 2 + 1) * p, p); ctx.fillRect(x, y - n * p, p, (n * 2 + 1) * p);
}
function drawHazard(h) {
  if (h.kind === 'stealthrock') {
    const bob = Math.round(Math.sin(B.time * 3 + h.seed * 9) * 2);
    ell2(h.x, h.y + 3, 6, 2, 'rgba(0,0,0,0.3)');
    if (!hazardSprite('Stealth_Rock_Front', h.x, h.y - 10 + bob, SS)) ell2(h.x, h.y - 8 + bob, 6, 6, '#8a7a66', '#3b3128');
    const ph = (B.time * 0.7 + h.seed * 5) % 1; if (ph < 0.3) glint(h.x - 4 + Math.floor(h.seed * 9), h.y - 14 + bob, ph / 0.3);
  } else if (h.kind === 'spikes' || h.kind === 'toxicspikes') {
    const r = seeded(Math.floor(h.seed * 1e4)), name = h.kind === 'spikes' ? 'Spikes_RSE' : 'Spikes_Purple_RSE', pts = [];
    for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = r() * h.r * 0.8; pts.push([h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.5]); }
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of pts) hazardSprite(name, x, y, SS);
    if (h.kind === 'spikes') { const ph = (B.time * 0.9 + h.seed * 7) % 1; if (ph < 0.3) glint(pts[Math.floor(h.seed * 70) % 7][0], pts[Math.floor(h.seed * 70) % 7][1] - 6, ph / 0.3); }
    else for (let i = 0; i < 3; i++) { // purple bubbles rising off the poison
      const q = (B.time * 0.5 + h.seed * 3 + i / 3) % 1, bx = snap2(h.x + Math.sin(h.seed * 40 + i * 2.3) * h.r * 0.7), by = snap2(h.y - 4 - q * 18), p = SS, s = (q < 0.7 ? 2 : 1) * p;
      ctx.globalAlpha = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3; ctx.fillStyle = '#2a0a3a'; ctx.fillRect(bx - p, by - p, s + 2 * p, s + 2 * p); ctx.fillStyle = '#d9a0ff'; ctx.fillRect(bx, by, s, s);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, p, p); ctx.globalAlpha = 1;
    }
  } else if (h.kind === 'stickyweb') {
    const p = VFX.particles.String_Shot_Web;
    if (p) { const sc = Math.max(SS, Math.round(h.r * 2 / p.fw / SS) * SS); hazardSprite('String_Shot_Web', h.x, h.y, sc, p.frames - 1, 0.8 + 0.2 * hazardPulse(h, 1.4));
      const ph = (B.time * 0.8 + h.seed * 4) % 1; if (ph < 0.3) glint(h.x + Math.cos(h.seed * 50) * h.r * 0.5, h.y + Math.sin(h.seed * 50) * h.r * 0.25, ph / 0.3); }
  }
}
const WEATHER_TINT = { sun: 'rgba(255,190,90,0.07)', rain: 'rgba(40,60,120,0.1)', sand: 'rgba(190,150,80,0.1)', snow: 'rgba(210,230,255,0.07)' };
const TERRAIN_TINT = { electric: '#ffe34d', grassy: '#5fd35f', psychic: '#e05cd0', misty: '#ffc6f0' };
// Weather particles live in view space (0..1 of the screen). Counts and speeds per kind; everything is hard pixels.
let weatherParts = [], rainSplash = [], sandBand = null;
// One dithered gust streak (cached): dense in the middle, tapering to scattered pixels at both ends and edges.
function sandBandTex() {
  if (sandBand) return sandBand;
  const W = 200, H = 10, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), id = g.createImageData(W, H), col = rgbaOf('#d6b26e');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = Math.sin(x / W * Math.PI) * (1 - Math.abs(y - (H - 1) / 2) / (H / 2)), lvl = Math.floor(v * 3 + (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16);
    if (lvl > 0) { id.data.set(col, (y * W + x) * 4); id.data[(y * W + x) * 4 + 3] = lvl >= 3 ? 210 : lvl === 2 ? 150 : 90; }
  }
  g.putImageData(id, 0, 0); return (sandBand = c);
}
function drawWeather(dt) {
  const w = B.field.weather;
  if (!w) { weatherParts.length = 0; rainSplash.length = 0; return; }
  ctx.fillStyle = WEATHER_TINT[w]; ctx.fillRect(view.x, view.y, view.w, view.h);
  const want = Math.round(({ rain: 150, sand: 100, snow: 130, sun: 24 }[w] ?? 25) * clamp(view.w * view.h / 230000, 0.6, 3)), T = B.time; // density follows the visible area
  while (weatherParts.length < want) weatherParts.push({ x: Math.random(), y: Math.random(), s: rand(0.6, 1.2) });
  weatherParts.length = want;
  const gust = 0.5 + 0.5 * Math.sin(T * 0.5) * Math.sin(T * 0.23 + 1); // slow gusts: 0..1, mostly mid
  if (w === 'sand') { // wind-blown bands of grit drifting across at different heights and speeds
    const tex = sandBandTex();
    for (let i = 0; i < 7; i++) {
      const spd = 90 + i * 35 + gust * 120, x = Math.round(view.x + ((T * spd + i * 211) % (view.w + 400)) - 200), y = Math.round(view.y + ((i * 0.21 + 0.07 + Math.sin(T * 0.2 + i) * 0.03) % 1) * view.h);
      ctx.globalAlpha = 0.45 + 0.5 * gust; ctx.drawImage(tex, x, y, tex.width * (1 + i % 2), tex.height * (1 + (i >> 1) % 2));
    }
    ctx.globalAlpha = 1;
  }
  for (const p of weatherParts) {
    if (w === 'rain') { p.x -= 0.15 * dt * p.s; p.y += 0.9 * dt * p.s; }
    else if (w === 'sand') { p.x += (0.35 + 0.7 * gust) * dt * p.s; p.y += 0.04 * dt * p.s + Math.sin(T * 2 + p.s * 20) * 0.01 * dt; }
    else if (w === 'snow') { p.x += (Math.sin(T * 0.4) * 0.025 + Math.sin(T + p.s * 9) * 0.03) * dt; p.y += 0.09 * dt * p.s * p.s; }
    else { p.x += Math.sin(T * 0.6 + p.s * 12) * 0.006 * dt; p.y -= 0.012 * dt * p.s; if (p.y < 0) p.y += 1; }
    if (p.y > 1) { p.y -= 1; p.x = Math.random(); if (w === 'rain' && rainSplash.length < 40 && Math.random() < 0.5) rainSplash.push({ x: Math.random(), y: 0.35 + Math.random() * 0.65, t: 0 }); }
    if (p.x > 1) p.x -= 1; if (p.x < 0) p.x += 1;
    const x = Math.round(view.x + p.x * view.w), y = Math.round(view.y + p.y * view.h);
    if (w === 'rain') { const far = p.s < 0.9; pline(x, y, x + (far ? 1 : 2), y - (far ? 5 : 9), far ? 'rgba(170,200,245,0.55)' : 'rgba(225,238,255,0.9)'); if (!far) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 2, y - 9, 1, 2); } }
    else if (w === 'sand') { ctx.fillStyle = p.s > 1 ? 'rgba(232,200,130,0.85)' : 'rgba(205,168,100,0.65)'; ctx.fillRect(x, y, p.s > 1 ? 3 : 2, 1); }
    else if (w === 'snow') {
      const sz = p.s > 1.05 ? 3 : p.s > 0.8 ? 2 : 1; ctx.fillStyle = sz === 1 ? 'rgba(235,245,255,0.9)' : '#fff';
      if (sz === 3) { ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1); } else ctx.fillRect(x, y, sz, sz);
    }
    else { const tw = Math.round(Math.sin(T * 1.6 + p.s * 10) * 1.5 + 1.5); if (tw > 0) { ctx.fillStyle = 'rgba(255,238,170,' + (0.25 * tw) + ')'; ctx.fillRect(x, y, p.s > 1 ? 2 : 1, p.s > 1 ? 2 : 1); } }
  }
  // rain splashes: small pixel crowns that pop on the ground and spread over a third of a second
  for (let i = rainSplash.length - 1; i >= 0; i--) {
    const s = rainSplash[i]; s.t += dt; if (s.t > 0.3) { rainSplash.splice(i, 1); continue; }
    const x = Math.round(view.x + s.x * view.w), y = Math.round(view.y + s.y * view.h), k = Math.floor(s.t / 0.1);
    ctx.fillStyle = k < 2 ? 'rgba(220,235,255,0.85)' : 'rgba(190,215,250,0.5)';
    if (k === 0) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x - 1, y, 3, 1); }
    else if (k === 1) { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); }
    else { ctx.fillRect(x - 3, y, 1, 1); ctx.fillRect(x + 3, y, 1, 1); ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); }
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
  if (B.field.weather !== 'sun') { ctx.fillStyle = B.field.weather === 'rain' ? 'rgba(10,16,40,0.14)' : 'rgba(18,10,40,0.12)'; ctx.fillRect(view.x, view.y, view.w, view.h); }
  if (B.mega && !B.mega.done) { ctx.fillStyle = `rgba(4,0,16,${0.6 * Math.min(1, B.mega.t / 0.3)})`; ctx.fillRect(view.x, view.y, view.w, view.h); }
  if (B.field.terrain) { ctx.globalAlpha = 0.12 + 0.05 * Math.sin(B.time * 2); ctx.fillStyle = TERRAIN_TINT[B.field.terrain]; ctx.fillRect(ar.wall, ar.wall, ar.w - ar.wall * 2, ar.h - ar.wall * 2); ctx.globalAlpha = 1; }
  drawFloor();
  battleSortItems().sort((a, b) => a.y - b.y).forEach(o => o.f());
  drawOver(dt);
}
// everything lying on the ground under the fight: decals, puddles, hazards, field fx, telegraphs, shadows
function drawFloor() {
  const props = B.arena.props || {};
  for (const d of B.decals) drawDecal(d);
  for (const p of B.puddles) blob(props.puddle, p.x, p.y, p.r * 1.1, p.r * 0.8, '#3d64a8', p.x);
  for (const g of B.grass) if (g.burnt) ell(g.x, g.y, g.r * 0.8, g.r * 0.45, 'rgba(40,30,20,0.4)');
  if (!B.arena.world) drawRays(); // light shafts lie on the floor: everything that matters in a fight (traps, telegraphs, mons) is drawn over them
  for (const h of B.hazards) hazardRing(h);
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
  // projectile and sideline trainer shadows are floor decals, so they live here and never paint over a mon standing behind them
  for (const p of B.proj) ell(p.x, p.y + 10 * SS, p.r * 0.8, p.r * 0.35, 'rgba(0,0,0,0.25)');
  for (const s of B.sides) { const ca = s.ent.act; if (ca?.pow && !ca.noOrb && !ca.fired && (ca.pow < 1 || Math.floor(B.time * 16) % 2)) ell(s.ent.x + s.ent.aimX * (26 + 26 * ca.pow), s.ent.y + s.ent.aimY * 14, (6 + 17 * ca.pow) * 0.8, (6 + 17 * ca.pow) * 0.35, 'rgba(0,0,0,0.25)'); }
  for (const t of sideTrainers()) ell(t.x, t.y, 7 * SS, 3 * SS, 'rgba(0,0,0,0.42)');
}
// the sideline trainers of an arena (none in the world: the player's trainer is a world item there)
function sideTrainers() {
  const ar = B.arena; if (ar.world) return [];
  return B.sides.map((s, i) => {
    const id = (s.trainerSprite || '').split('/').pop().replace(/^player-|\.png$/g, '');
    const ow = window.TRAINER_OW && (TRAINER_OW[id] || TRAINER_OW[{ chase: 'ethan', elaine: 'lyra' }[id]]);
    return ow && { ow, i, x: i ? ar.w - ar.wall - 18 : ar.wall + 18, y: ar.h / 2 };
  }).filter(Boolean);
}
// depth-sorted things of the fight: { y, x?, f } in battle coordinates (world rocks are drawn by the world)
function battleSortItems() {
  const props = B.arena.props || {}, list = [];
  for (const s of B.sides) list.push({ y: s.ent.y, x: s.ent.x, f: () => drawSideMon(s) });
  for (const r of B.rocks) if (!r.world) list.push({ y: r.y + r.r * 0.5, x: r.x, f: () => { const im = dimmed(props.rock); if (im) drawFrame(im, 0, 0, im.width, im.height, Math.round((r.x - im.width / 2) / 2) * 2, Math.round((r.y - im.height + r.r * 0.5) / 2) * 2, r.flash > 0 ? '#fff' : null); else ell(r.x, r.y, r.r, r.r * 0.6, '#7d7266', '#3e352c'); } });
  for (const h of B.hazards) if (h.kind === 'stealthrock') list.push({ y: h.y, x: h.x, f: () => drawHazard(h) });
  for (const p of B.proj) list.push({ y: p.y + 10 * SS, x: p.x, f: () => drawProjectile(p) }); // same ground anchor as its shadow, so a shot never slips behind the mon that fired it
  // tall grass sorts by the near edge of its footprint: mons inside it are covered, mons in front of it stand over it
  for (const g of B.grass) if (!g.burnt) list.push({ y: g.y + g.r * 0.7, f: () => { ctx.globalAlpha = 0.92; blob(props.grass, g.x, g.y - 4, g.r * 1.1, g.r * 0.85, '#3f8a37', g.y, true); ctx.globalAlpha = 1; } });
  // HGSS overworld trainers on the sidelines, facing the arena (data/trainer-ow.js; id taken from the battle sprite file name)
  for (const { ow, i, x, y } of sideTrainers()) list.push({ y, f: () => { const raw = img(ow.file); if (!raw) return; drawFrame(outlined(raw, ow.fw, ow.fh), 0, ow.rows.indexOf(i ? 'left' : 'right') * ow.fh, ow.fw, ow.fh, Math.round(x - ow.fw * SS / 2), Math.round(y - ow.footY * SS), null, 1, SS); } });
  return list;
}
function drawOver(dt) {
  const ar = B.arena;
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
  if (!ar.world) { drawLighting(); drawVignette(); }
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
// Ja-orange!: Orange's two flying frames (fist leads, trail behind), flipped to the travel direction, with a short orange afterimage trail
function drawOrange(p) {
  const o = window.ORANGE_SPRITE, im = img(o.file); if (!im) return;
  const sc = SS, right = p.vx > 0, fi = Math.floor(p.t * 14) % o.frames;
  const draw = (x, y, a, tint) => {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (right) ctx.scale(-1, 1);
    ctx.globalAlpha = a; ctx.drawImage(im, fi * o.fw, 0, o.fw, o.fh, -o.fw * sc / 2, -o.fh * sc / 2, o.fw * sc, o.fh * sc);
    if (tint) { tintCv.width = o.fw; tintCv.height = o.fh; tintCtx.globalCompositeOperation = 'source-over'; tintCtx.clearRect(0, 0, o.fw, o.fh); tintCtx.drawImage(im, fi * o.fw, 0, o.fw, o.fh, 0, 0, o.fw, o.fh); tintCtx.globalCompositeOperation = 'source-atop'; tintCtx.fillStyle = tint; tintCtx.fillRect(0, 0, o.fw, o.fh); ctx.drawImage(tintCv, -o.fw * sc / 2, -o.fh * sc / 2, o.fw * sc, o.fh * sc); }
    ctx.restore(); ctx.globalAlpha = 1;
  };
  const l = Math.hypot(p.vx, p.vy) || 1;
  for (let i = 4; i >= 1; i--) draw(p.x - p.vx / l * i * 22, p.y - p.vy / l * i * 22, 0.5 - i * 0.1, 'rgba(255,150,40,0.7)');
  draw(p.x, p.y, 1, null);
}
function drawProjectile(p) {
  if (p.orange) return drawOrange(p);
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
  const tr = e.trail || (e.trail = []), jar = !!e.dash?.afterimage; // Jarona: long blue afterimages of himself
  if ((e.dodge || jar) && (!tr.length || Math.hypot(tr[tr.length - 1].x - e.x, tr[tr.length - 1].y - e.y) > (jar ? 26 : 22))) tr.push({ x: e.x, y: e.y, z: e.z, anim: e.anim, animT: e.animT, face: e.face, t: B.time, life: jar ? 0.55 : 0.22, blue: jar });
  while (tr.length && B.time - tr[0].t > tr[0].life) tr.shift();
  for (const g of tr) drawMonSprite(key, g.anim, g.animT, g.face, g.x, g.y, { z: g.z, alpha: (g.blue ? 0.7 : 0.22) * (1 - (B.time - g.t) / g.life), tint: g.blue ? 'rgba(40,120,255,0.8)' : 'rgba(190,225,255,0.45)', noOutline: true });
  drawMonSprite(key, e.anim, e.animT, e.face, e.x, e.y, { z: e.z, stretch: e.dodge ? (a => [1 - 0.12 * a, 1 + 0.2 * a])(Math.sin((1 - e.dodge.t / (e.dodge.T || TUNE.DODGE_TIME)) * Math.PI)) : undefined, tint, alpha, loop: !e.animOnce, scale: SS * (grow < 1 ? Math.max(0.25, Math.round(grow * 4) / 4) : 1), outline: outlineTell(s, e, m) });
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
  const e = s.ent, R = 30 * SS, cy = e.y - 14 * SS, cx = Math.round(e.x), w = s.wheel, o = wheelOpts(s), n = o.length;
  // portrait in a framed round tile; fainted = greyscale at 75% opacity
  const tile = (m, x, y, r, ring) => {
    ell(x, y, r + 2, r + 2, ring, '#000', 2);
    const im = img(spriteOf(m.sp.sprite)?.portrait);
    if (!im) return;
    ctx.save(); if (m.fainted) { ctx.globalAlpha = 0.75; ctx.filter = 'grayscale(1)'; }
    ctx.drawImage(im, x - 20, y - 20, 40, 40); ctx.restore();
  };
  ell(cx, cy, R + 30, R + 30, 'rgba(0,0,0,0.4)');
  if (w.ang !== undefined && Math.hypot(INPUT.aimActive ? INPUT.ax : INPUT.mx, INPUT.aimActive ? INPUT.ay : INPUT.my) > 0.4) pline(cx, cy, cx + Math.cos(w.ang) * (R - 6), cy + Math.sin(w.ang) * (R - 6), w.sel >= 0 ? '#ffe36b' : '#888', 3);
  tile(s.team[s.cur], cx, Math.round(cy), 20, '#7fb5ff');
  o.forEach((ti, k) => {
    const m = s.team[ti], a = wheelAng(k, n), x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R);
    tile(m, x, y, 20, w.sel === ti ? '#ffe36b' : '#e8e8f0');
    ctx.fillStyle = '#000'; ctx.fillRect(x - 16, y + 23, 32, 4);
    ctx.fillStyle = m.fainted ? '#555' : m.hp / m.maxHp > 0.5 ? '#4cd964' : m.hp / m.maxHp > 0.2 ? '#ffcc00' : '#ff3b30';
    ctx.fillRect(x - 15, y + 24, Math.round(30 * m.hp / m.maxHp), 2);
  });
}

// ---------- frame ----------
const FLOWERY_MUSIC = 'assets/music/flower-man.mp3';
function drawBattle(dt) {
  // anyone fielding Flowery takes over the music for the rest of the fight (runs on host, guest and offline alike)
  if (!B.demo && AUDIO.musicSrc !== FLOWERY_MUSIC && B.sides.some(s => activeMon(s)?.sp.id === 'flowery')) AUDIO.playMusic(FLOWERY_MUSIC);
  updateCamera(dt);
  if (B.arena.world) drawBattleWorld(dt); else drawBattleArena(dt);
  drawBattleOverlay();
}
function drawBattleArena(dt) {
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
}
// World mode: the adventure renderer draws the fight. Battle (x, y) sits at world (x + ox, y + oy) on a floor lv levels up, so it draws at screen y - lv * ar.T (the map's tile).
function drawBattleWorld(dt) {
  const ar = B.arena, c = B.cam, lift = ar.lv * ar.T, k = c.shake / c.z * 2, sh = () => Math.round((Math.random() - 0.5) * k);
  const at = f => () => {
    const v = ADVR.view; view = { x: v.ox - ar.ox, y: v.oy - ar.oy + lift, w: v.vw, h: v.vh };
    ctx.save(); ctx.translate(ar.ox, ar.oy - lift); f(); ctx.restore();
  };
  const items = battleSortItems().map(o => ({ x: ar.ox + (o.x ?? ar.w / 2), y: ar.oy + o.y, z: lift, f: at(o.f) }));
  ar.t += dt;
  ADVR.draw({ x: ar.ox + c.x + sh(), y: ar.oy + c.y - lift + sh() }, [...(ar.extra ? ar.extra() : []), ...items], ar.t, { lv: ar.lv, floor: at(drawFloor), over: at(() => drawOver(dt)) });
}
// flash, floating numbers and HUD, in screen space
function drawBattleOverlay() {
  const c = B.cam;
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
// ---------- trainer avatars (data/trainer-avatars.js): Pokemon Showdown 80x80 sprites shown as a head-and-shoulders crop ----------
const AVATAR_DEFAULT = 'red';
let AVATAR_MAP = null;
const avatarById = id => (AVATAR_MAP ||= new Map((window.TRAINER_AVATARS || []).map(a => [a.id, a]))).get(id) || null;
const cleanAvatar = id => (avatarById(String(id || '')) ? String(id) : ''); // trust boundary: only ids from our own list ever become a file path
// the sideline overworld sprite (data/trainer-ow.js) that goes with an avatar, or '' when there is none
function avatarSprite(id) {
  const k = String(id || '').replace(/-lgpe$/, ''); if (!window.TRAINER_OW?.[k]) return '';
  return (window.PLAYER_SPRITES || []).find(p => p.id === k)?.sprite || `assets/trainer/${k}.png`;
}
// pixel-crisp square crop; returns false while the PNG is still loading
function drawAvatar(id, x, y, size) {
  const a = avatarById(id) || avatarById(AVATAR_DEFAULT), im = a && img(a.file); if (!im) return false;
  const [cx, cy, cs] = a.crop || [8, 0, 64], was = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, cx, cy, cs, cs, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  ctx.imageSmoothingEnabled = was; return true;
}
// framed avatar tile used by the HUD, the lobby and the cards
function avatarTile(id, x, y, size, ring) {
  const r = Math.max(4, size / 8);
  rrect(x, y, size, size, r, '#b9d3f0', ring || '#fff', 2);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x + 2, y + 2, size - 4, size - 4, Math.max(2, r - 2)); ctx.clip();
  drawAvatar(id, x + 2, y + 2, size - 4); ctx.restore();
}
function drawSideHUD(s, right) {
  const m = activeMon(s), S = Math.min(1, VW / 1500), pad = 14 * S;
  const dir = right ? -1 : 1, P = 74 * S;
  const px = right ? VW - pad - P : pad;
  rrect(px, pad, P, P, 8 * S, right ? '#7fd0e8' : '#f08a8a', '#fff', 3);
  const pe = portraitEmotion(s, m), pkey = spriteKey(m);
  const pim = img(window.PORTRAITS?.[pkey]?.[pe.emo]) || img(spriteOf(pkey)?.portrait);
  if (pim) {
    // fill the box exactly; a whole-number scale left a gap on small windows
    const inner = P - 8, k = inner / pim.naturalWidth, D = inner;
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
  text(`${Math.ceil(m.hp)} / ${Math.ceil(m.maxHp)}`, right ? bx + bw - 10 * S : bx + 10 * S, by + bh / 2 + 1, 15 * S, '#fff', right ? 'right' : 'left', '#000');
  const ty = pad + P + 10 * S, T = 52 * S;
  if (s.avatar) avatarTile(s.avatar, px + (right ? P - T : 0), ty, T);
  else { // CPU trainers without a Showdown match keep their old battle sprite
    const tim = img(s.trainerSprite);
    rrect(px + (right ? P - T : 0), ty, T, T, 6 * S, '#b9d3f0', '#fff', 2);
    if (tim) ctx.drawImage(tim, 0, 0, tim.naturalWidth, tim.naturalHeight * 0.7, px + (right ? P - T : 0) + 2, ty + 2, T - 4, (T - 4) * 0.92);
  }
  const bx2 = right ? px + P - T - 18 * S : px + T + 20 * S;
  s.team.forEach((tm, i) => {
    // portrait tile per team slot: current mon gold-ringed, fainted greyscale at 75%
    const q = Math.round(28 * S), step = Math.round(32 * S), x = Math.round(bx2 + dir * i * step), qx = x - (q >> 1), qy = Math.round(ty + T / 2 - 8 * S) - (q >> 1);
    rrect(qx, qy, q, q, 3 * S, '#b9d3f0', i === s.cur && !tm.fainted ? '#ffcf3f' : '#fff', i === s.cur ? 3 : 2);
    const tim = img(spriteOf(tm.sp.sprite)?.portrait);
    if (tim) {
      ctx.save(); if (tm.fainted) { ctx.globalAlpha = 0.75; ctx.filter = 'grayscale(1)'; }
      ctx.imageSmoothingEnabled = false; ctx.drawImage(tim, qx + 2, qy + 2, q - 4, q - 4); ctx.restore();
    }
    if (s.idx === meIdx() && !INPUT.usingPad) text(String(i + 1), x, qy + q + 8 * S, 10 * S, '#fff', 'center');
  });
  text(s.name.toUpperCase(), bx2 + dir * 6 * Math.round(32 * S) + (right ? -4 : 4), ty + T / 2 - 8 * S, 16 * S, right ? '#7fd0e8' : '#7be07b', right ? 'right' : 'left', '#000');
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
  // field effects sit in dark-backed pills so they read over any arena; timed ones end in "s"
  const fieldPill = (lbl, col) => { const h = 20 * S; ctx.font = `${h * 0.62}px Bungee, "Arial Black", sans-serif`; const w = ctx.measureText(lbl).width + h * 0.9; hudChip(VW / 2 - w / 2, fy - h / 2, lbl, col, h); fy += h + 5 * S; };
  if (B.field.weather) { const lbl = { sun: 'HARSH SUN', rain: 'RAIN', sand: 'SANDSTORM', snow: 'SNOW' }[B.field.weather]; fieldPill(B.field.weatherT > 1e6 ? lbl : `${lbl} ${Math.ceil(B.field.weatherT)}s`, { sun: '#c8641c', rain: '#2f64b8', sand: '#9a7e34', snow: '#4a9cb8' }[B.field.weather] || '#555'); }
  if (B.field.terrain) fieldPill(`${B.field.terrain.toUpperCase()} TERRAIN ${Math.ceil(B.field.terrainT)}s`, { electric: '#a8870a', grassy: '#378a37', psychic: '#a63a93', misty: '#b85f9c' }[B.field.terrain] || '#555');
  B.callouts.filter(c => c.side === -1).forEach((c, i) => { ctx.globalAlpha = clamp((1.6 - c.t) * 3, 0, 1); text(c.s, VW / 2, fy + 10 * S + i * 22 * S, 16 * S, '#fff', 'center'); ctx.globalAlpha = 1; });
  const me = B.sides[meIdx()]; if (!me) return;
  const m = activeMon(me), W = 210 * S, H = 46 * S, gap = 10 * S, total = 4 * W + 3 * gap, pad = padUI();
  const y = VH - H - 18 * S; let x = VW / 2 - total / 2;
  m.moves.forEach((mv, i) => {
    const ready = canUse(me, i), cd = m.cds[i], tc = TYPE_COLOR[mv.type] || '#888';
    // a card that just came off cooldown flashes once, so you can look at the fight instead of the bar
    const rdy = me.hudRdy || (me.hudRdy = []); if (cd > 0) rdy[i] = 0; else if (rdy[i] === 0) rdy[i] = B.time;
    rrect(x, y, W, H, 10 * S, ready ? '#1c1f26ee' : '#13151acc', ready ? tc : '#555', 3);
    ctx.globalAlpha = cd > 0 ? 0.45 : 1; icon((pad ? PAD_ICONS : PC_ICONS)[i], x + 25 * S, y + H / 2, H >= 34 ? 32 : 16); ctx.globalAlpha = 1;
    const room = W - 50 * S - (cd > 0 ? 46 * S : 8 * S); ctx.font = `${15 * S}px Bungee, "Arial Black", sans-serif`;
    const nsz = 15 * S * Math.min(1, room / Math.max(1, ctx.measureText(mv.name).width));
    text(mv.name, x + 50 * S, y + H / 2 - 7 * S, nsz, ready ? '#fff' : '#9a9aa4', 'left');
    text(`${mv.type.toUpperCase()} ${mv.category === 'Status' ? 'STATUS' : (mv.category === 'Physical' ? 'PHY ' : 'SPC ') + (mv.basePower || '-')}`, x + 50 * S, y + H / 2 + 9 * S, 10 * S, tc, 'left', null);
    if (cd > 0) {
      // recharge strip along the bottom edge fills as the move comes back; the countdown turns yellow in its last second
      const max = cooldownFor(mv, m), sx = x + 10 * S, sw = W - 20 * S;
      ctx.fillStyle = '#000c'; ctx.fillRect(sx, y + H - 8 * S, sw, 4 * S);
      ctx.fillStyle = tc; ctx.fillRect(sx, y + H - 8 * S, sw * (1 - clamp(cd / max, 0, 1)), 4 * S);
      text(cd.toFixed(1), x + W - 24 * S, y + H / 2 - 4 * S, 20 * S, cd < 1 ? '#ffde3b' : '#fff', 'center');
    } else if (rdy[i] > 0 && B.time - rdy[i] < 0.3) { ctx.globalAlpha = 0.55 * (1 - (B.time - rdy[i]) / 0.3); rrect(x, y, W, H, 10 * S, '#fff'); ctx.globalAlpha = 1; }
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
