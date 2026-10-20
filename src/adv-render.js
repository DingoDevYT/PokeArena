// Adventure overworld renderer: terrain, props and entities drawn depth-sorted into an offscreen canvas at 1 ART px per canvas px (a world px is half of one), then upscaled by the whole number zm.
// Everything is positioned in world px as before, but snapG() makes every destination edge land on a whole canvas px, and the camera is one rounded art-px origin, so layers never sit half an art px apart.
// Art is drawn this.S times bigger (the map scale at the camera, ADV.Tp): exterior tiles and props 2x outdoors so their pixels match the trainers' and mons'; this.T = the tile in world px.
'use strict';
const ADVR = {
  cv: document.createElement('canvas'),
  zoom: 2, zm: 4, T: 64, S: 2,   // zoom = last drawn; zm = the player's pick: DEVICE px per ART px, 1 farthest .. 6 closest, 4 = Normal, the default (Settings, mouse wheel, shoulders)
  GRASSY: new Set(['grass', 'rgGrass', 'wetGrass', 'tallgrass', 'dryGrass']),   // grounds whose cliff rims take the lab meadow copy
  ART: 2,   // world px per art px: sprites, interior sheets and the 2x exterior all draw their art pixels 2 world px big
  NAMES: ['Farthest', 'Far', 'Medium', 'Normal', 'Close', 'Closest'], ZMAX: 6, ZDEF: 4,   // his pick 2026-10-15: the old 'Closer' (4) is the perfect default, with room to go further in and out
  frame: 0,
  dark: null,
  t: 0,
  q(v) { return Math.round(v / this.ART) * this.ART; },   // a world coordinate on the art grid
  fq(v) { return ctx === this.g || ctx === this.g2 || this.rec ? this.q(v) : Math.round(v); },   // a sprite's foot: on the art grid in the world, a whole px elsewhere (drawMonSprite / drawOW), so camera and sprite round the same way
  // Wrap the world context so drawImage / fillRect / rect snap their destination to whole canvas px under whatever (unrotated) transform is current: position by the rounded left edge, size rounded (never under 1 px).
  snapG(g) {
    const P = CanvasRenderingContext2D.prototype, di = P.drawImage, fr = P.fillRect, rc = P.rect;
    this.di = di; this.fr = fr;
    const ax = (a, e, x, w) => { let l = a * x + e; const r = a * (x + w) + e, c = Math.max(1, Math.round(Math.abs(r - l))), n = c / Math.abs(a); l = Math.round(Math.min(l, r)); return a > 0 ? [(l - e) / a, n] : [(l - e) / a - n, n]; };
    const fit = (m, x, y, w, h) => { if (!(w > 0 && h > 0) || m.b || m.c) return null; const [fx, fw] = ax(m.a, m.e, x, w), [fy, fh] = ax(m.d, m.f, y, h); return [fx, fy, fw, fh]; };
    g.fillRect = function (x, y, w, h) { const s = fit(this.getTransform(), x, y, w, h); return s ? fr.call(this, ...s) : fr.call(this, x, y, w, h); };
    g.rect = function (x, y, w, h) { const s = fit(this.getTransform(), x, y, w, h); return s ? rc.call(this, ...s) : rc.call(this, x, y, w, h); };
    g.drawImage = function (im, ...a) {
      if (a.length === 2) a.push(im.naturalWidth || im.width, im.naturalHeight || im.height);
      const d = a.length - 4, s = fit(this.getTransform(), a[d], a[d + 1], a[d + 2], a[d + 3]);
      if (s) a.splice(d, 4, ...s);
      return di.call(this, im, ...a);
    };
    return g;
  },
  // Device px per world px for pick zm: 0.5 1 1.5 2 .. 3; an art px is always a whole 1..6 device px (the canvas is art-sized and upscaled by the integer zm, nearest only).
  sc(zm = this.zm) { return clamp(zm | 0 || this.ZDEF, 1, this.ZMAX) / this.ART; },
  zoomFor() { return this.sc() / DPR; },   // the same in CSS px (what the camera maths uses)
  battleZoom() { return this.zoomFor(); },   // draw() uses the same scale in a fight, so the HUD maths (worldToScreen) must too
  load() { const o = STORE.get('advZoom3', null), def = typeof innerWidth !== 'undefined' && Math.min(innerWidth, innerHeight) < 500 ? this.ZDEF - 1 : this.ZDEF; this.zm = o != null ? clamp(o | 0 || def, 1, this.ZMAX) : def; return this.zm; },   // a saved tier keeps its meaning (device px per art px); no save = Normal, one step out on a phone (its short side shows too few tiles at Normal)
  setZoom(z) { z = clamp(z, 1, this.ZMAX); if (z !== this.zm) { this.zm = z; STORE.set('advZoom3', z); } },
  zoomBy(d) { this.setZoom(this.zm + d); },

  // ts = the tileset the id belongs to (real or placeholder)
  // a 32 px sheet tile drawn at 32 x dk world px (density: see ADV.dk); a 2x-art tile is smaller than the cell outdoors, so it repeats 2 x 2 to fill it
  tile(g, id, x, y, ts, dn) {
    ts = ts || ADV.ts(); const sh = ts === ADV.ts() ? this.sh : ADV.sheet(ts); if (!(id >= 0)) return; if (!sh) { this.miss = true; return; }   // miss: a sheet still loading, so gchunk must not cache this bake
    const z = 32 * (this.S === 1 ? 1 : this.S * (dn ?? ts.density ?? 1)), n = Math.max(1, Math.round(this.T / z)), sx = (id % ts.cols) * 32, sy = Math.floor(id / ts.cols) * 32;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.drawImage(sh, sx, sy, 32, 32, x + i * z, y + j * z, z, z);
    if (this.fa) { const tc = this.tinted(sh, sx, sy, 32, 32); g.globalAlpha = this.fa; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.drawImage(tc, x + i * z, y + j * z, z, z); g.globalAlpha = 1; }   // a wall facing away from the sun
  },
  // cliff pieces the real tileset lacks come from the placeholder
  cliff(g, name, role, x, y, c, r) {
    const pick = ts => { const v = ts && ts.cliff && ts.cliff[name]; return role && v !== null && typeof v === 'object' ? v[role] : v; };
    const rg = !ADV.fallback && window.ADV_TILESET_REGION, cb = c !== undefined && rg && rg.cliffBy;
    if (cb) {   // a rim or face top on the generated island: the copy of the cliff art whose grass is the raised cell's own ground (tools/adv_lab_ground.py)
      const m = ADV.palette[ADV.mat(c, r)], key = window.ADV_TILESET_DERIVED?.keys?.[m] || (this.GRASSY.has(m) ? 'grass' : null), v = key && cb[key] && cb[key][name];
      const id = role && v !== null && typeof v === 'object' ? v[role] : v;
      if (id >= 0) return this.tile(g, id, x, y, rg);
    }
    const ts = ADV.ts(), ph = window.ADV_TILESET_PLACEHOLDER;
    if (pick(ts) >= 0) this.tile(g, pick(ts), x, y, ts); else this.tile(g, pick(ph), x, y, ph);
  },
  // a chunk's level-0 ground (tops, stairs, deck shade) baked to one art-px canvas per water frame, so a wide view is a few drawImages, not thousands of tiles; null until build is allowed
  gchunk(ch, build) {
    const T = this.T, CH = ADV.CH, k = T + '|' + (ch.gv | 0); let G = ch.gc;
    if (!G || G.k !== k) {   // L: the frame cycle of every animated material in the chunk (1 if none)
      let L = 1; const gcd = (a, b) => b ? gcd(b, a % b) : a;
      for (let i = 0; i < CH * CH; i++) for (const m of [ch.mat[i], ch.over[i]]) { const d = m && ADV.defOf(ADV.palette[m]); if (d && d.frames) L = L * d.frames.length / gcd(L, d.frames.length); }
      G = ch.gc = { k, L, m: new Map() };
    }
    const f = this.frame % G.L; let c = G.m.get(f); if (c || !build) return c;
    const n = CH * T / this.ART, x0 = ch.cx * CH * T, y0 = ch.cy * CH * T; c = document.createElement('canvas'); c.width = c.height = n;
    const g = this.snapG(c.getContext('2d')); g.imageSmoothingEnabled = false; g.setTransform(1 / this.ART, 0, 0, 1 / this.ART, -x0 / this.ART, -y0 / this.ART);
    this.miss = false; for (let i = 0; i < CH * CH; i++) if (ch.h[i] === 0) this.groundCell(g, ch, i, ch.cx * CH + (i & 31), ch.cy * CH + (i >> 5));
    if (this.miss) return null;   // a sheet was still loading: draw tile by tile this frame, bake again later
    G.m.set(f, c); return c;
  },
  groundCell(g, ch, i, c, r) {
    const T = this.T, x = c * T, y = r * T, k = ch.kind[i];
    this.ground(g, ch, i, c, r, x, y);
    if (ADV.STAIR[k] && !(ch.bake && ch.bake[i] >= 0)) this.cliff(g, 'stairs' + 'NSEW'[k - 1], null, x, y);
    if (ch.deck[i] >= 0) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y, T, T); }
  },
  ground(g, ch, i, c, r, x, y) {
    if (ch.bake && ch.bake[i] >= 0) return this.tile(g, ch.bake[i], x, y, window.ADV_TILESET_REGION);   // a map-lab cell is one region sheet tile whatever its mat (a cave room's mats belong to the interior sheet)
    const def = ADV.defOf(ADV.palette[ch.mat[i]]);
    if (def && def.quad) { const bd = ADV.defOf(ADV.palette[ch.qb[i]]); if (bd) this.tile(g, ADV.pick(bd, 'C', c, r), x, y, ADV.originOf(bd), bd.density); }   // a path cell: the ground under the path layer
    else if (def) {
      if (def.overlay) { const bd = ADV.defOf(def.base || 'grass'); if (bd) this.tile(g, ADV.pick(bd, 'C', c, r), x, y, ADV.originOf(bd), bd.density); }
      this.tile(g, ADV.frameId(def, ch.role[i], ch.tile[i], this.frame), x, y, ADV.originOf(def), def.density);
    }
    if (ch.dq) for (let q = 0; q < 4; q++) { const id = ch.dq[i * 4 + q]; if (id >= 0) this.tile(g, id, x, y, window.ADV_TILESET_REGION); }   // the path layer's quarters (ADV.quadCell)
    if (ch.otile[i] >= 0 && ch.over[i]) {
      const od = ADV.defOf(ADV.palette[ch.over[i]]);
      if (od) this.tile(g, ADV.frameId(od, ch.orole[i], ch.otile[i], this.frame), x, y, ADV.originOf(od), od.density);
    }
  },
  // is the neighbour (c + dc, r + dr) a drop from height h that is not just the stairs leading up to this cell
  lower(c, r, h, dc, dr) {
    const nc = c + dc, nr = r + dr, nh = Math.max(ADV.h(nc, nr), ADV.deck(nc, nr));
    if (nh >= h) return false;
    const st = ADV.STAIR[ADV.kind(nc, nr)];
    return !(st && st[0] === -dc && st[1] === -dr && nh + 1 === h);
  },
  hasFace(c, r) { const h = ADV.h(c, r); return h > 0 && h > Math.max(0, ADV.h(c, r + 1), ADV.deck(c, r + 1)); },
  top(g, ch, i, c, r, h) {
    const T = this.T, x = c * T, y = r * T - h * T, k = ch.kind[i];
    this.ground(g, ch, i, c, r, x, y);
    const baked = ch.bake && ch.bake[i] >= 0;   // a map-lab cell: its tile already carries the rim and the stairs art
    if (ADV.STAIR[k] && !baked) this.cliff(g, 'stairs' + 'NSEW'[k - 1], null, x, y);
    const n = this.lower(c, r, h, 0, -1), e = this.lower(c, r, h, 1, 0), w = this.lower(c, r, h, -1, 0);
    if (!baked && (n || e || w)) {
      const name = n ? (e ? 'rimNE' : w ? 'rimNW' : 'rimN') : e ? (k === 6 ? 'ledgeE' : 'rimE') : (k === 7 ? 'ledgeW' : 'rimW');
      this.cliff(g, name, null, x, y, c, r);
    }
  },
  face(g, ch, i, c, r, h) {
    const T = this.T, hf = Math.max(0, ADV.h(c, r + 1), ADV.deck(c, r + 1)), n = h - hf, fk = ADV.kind(c, r + 1), st = ADV.STAIR[fk];
    if (n <= 0) return;
    if (ch.fbake && ch.fbake[i] >= 0) {   // a map-lab face: one baked tile per level-1 drop, stairs openings included
      this.fa = this.sun ? this.sun.face : 0; this.tile(g, ch.fbake[i], c * T, (r + 1) * T - h * T, window.ADV_TILESET_REGION); this.fa = 0; return;
    }
    const role = !this.hasFace(c - 1, r) ? 'L' : !this.hasFace(c + 1, r) ? 'R' : 'M';
    const special = st && st[1] === -1 && ADV.h(c, r + 1) + 1 === h ? 'stairsN' : ch.kind[i] === 5 ? 'ledgeS' : '';
    this.fa = this.sun && !special ? this.sun.face : 0;
    for (let k = 0; k < n; k++) this.cliff(g, special || (k ? 'face' : 'faceTop'), special ? null : role, c * T, (r + 1) * T - h * T + k * T, c, r);
    this.fa = 0;
  },
  // terrain gets the sprite outline: 1 art px of #0c0a14 just outside the raised silhouette wherever the ground drops (above a rim, beside a side drop, under a face), joined at the corners. The stair opening stays clear.
  // Under a face that lands on higher ground the line belongs to the cell below (its top's first art px), because that cell's strip is drawn after this one.
  outline(g, ch, i, c, r, h) {
    const T = this.T, A = this.ART, x = c * T, ty = r * T - h * T, hs = ADV.h(c, r + 1), hf = Math.max(0, hs, ADV.deck(c, r + 1)), st = ADV.STAIR[ADV.kind(c, r + 1)];
    const n = this.lower(c, r, h, 0, -1), w = this.lower(c, r, h, -1, 0), e = this.lower(c, r, h, 1, 0), s = h > hf && !(st && st[1] === -1 && hs + 1 === h), by = (r + 1) * T - hf * T;
    const hn = ADV.h(c, r - 1), sn = ADV.STAIR[ch.kind[i]], up = hn > Math.max(h, ADV.deck(c, r)) && !(sn && sn[1] === -1 && h + 1 === hn), xa = x - (w ? A : 0), wa = T + (w ? A : 0) + (e ? A : 0);
    g.fillStyle = '#0c0a14';
    if (n) g.fillRect(xa, ty - A, wa, A);
    if (s && !hf) g.fillRect(xa, by, wa, A);
    if (up) g.fillRect(x, ty, T, A);
    const y0 = ty - (n ? A : 0), hh = by + (s ? A : 0) - y0;
    if (w) g.fillRect(x - A, y0, A, hh);
    if (e) g.fillRect(x + T, y0, A, hh);
  },
  stripFn(r, c0, c1) {
    return g => {
      for (let c = c0; c <= c1; c++) {
        const ch = ADV.chunkAt(c, r); if (!ch) continue;
        const i = (r & 31) * 32 + (c & 31), h = ch.h[i];
        if (h > 0) this.top(g, ch, i, c, r, h);
      }
      if (this.fm) {   // sun shadows on this row's raised tops, one run of equal height at a time, before the faces
        const T = this.T, A = this.ART, { ox, oy } = this.view;
        for (let c = c0; c <= c1;) {
          const h = ADV.h(c, r); let e = c; while (e + 1 <= c1 && ADV.h(e + 1, r) === h) e++;
          if (h > 0) this.layShadow(g, h, Math.round((c * T - ox) / A), Math.round((r * T - h * T - oy) / A), Math.round((e + 1 - c) * T / A), T / A);
          c = e + 1;
        }
      }
      for (let c = c0; c <= c1; c++) {
        const ch = ADV.chunkAt(c, r); if (!ch) continue;
        const i = (r & 31) * 32 + (c & 31), h = ch.h[i];
        if (h > 0) this.face(g, ch, i, c, r, h);
      }
      for (let c = c0; c <= c1; c++) {   // the outline last: over the side neighbours' faces, under whatever is sorted after this row
        const ch = ADV.chunkAt(c, r); if (!ch) continue;
        const i = (r & 31) * 32 + (c & 31), h = ch.h[i];
        if (h > 0 && !(ch.bake && ch.bake[i] >= 0)) this.outline(g, ch, i, c, r, h);   // a map-lab cell carries the lab's own outline ring, which hugs the cliff art
      }
    };
  },
  // Bridge deck: sits `deck` levels above its ground; procedural planks unless the tileset has mats.bridge.
  deckFn(r, d, cols) {
    return g => {
      const T = this.T, S = this.S, br = ADV.defOf('bridge'), y = r * T - d * T;
      for (const c of cols) {
        const x = c * T, conn = (cc, rr) => ADV.deck(cc, rr) === d || ADV.h(cc, rr) === d;
        const n = conn(c, r - 1), s = conn(c, r + 1), e = conn(c + 1, r), w = conn(c - 1, r);
        if (br) {
          const v = !n ? 'N' : !s ? 'S' : '', hz = !e ? 'E' : !w ? 'W' : '';
          this.tile(g, ADV.pick(br, v + hz || 'C', c, r), x, y, ADV.originOf(br), br.density);
        } else {
          g.fillStyle = '#a2713f'; g.fillRect(x, y, T, T);
          g.fillStyle = '#7c5228'; for (let k = 0; k < T; k += 8 * S) g.fillRect(x + k, y, S, T);
          if (!n) { g.fillStyle = '#d8b878'; g.fillRect(x, y, T, 4 * S); g.fillStyle = '#5a3a1a'; g.fillRect(x, y + 4 * S, T, S); }
          if (!s) { g.fillStyle = '#d8b878'; g.fillRect(x, y + T - 4 * S, T, 4 * S); g.fillStyle = '#5a3a1a'; g.fillRect(x, y + T - 5 * S, T, S); }
        }
        if (!s) { g.fillStyle = '#3a2410'; g.fillRect(x, y + T, T, 6 * S); }
      }
    };
  },
  // a prop's sheet rect with the house outline (the dark 1 px ring every person and mon sprite gets, see outlined() in render.js), 1 px bigger on each side; cached per rect
  olRect(sh, sx, sy, sw, shh) {
    const m = this.olc || (this.olc = new Map()), k = (sh.src || '') + '|' + sx + '|' + sy + '|' + sw + '|' + shh; let c = m.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = sw + 2; c.height = shh + 2; const g = c.getContext('2d');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(sh, sx, sy, sw, shh, 1 + dx, 1 + dy, sw, shh);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0c0a14'; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'source-over'; g.drawImage(sh, sx, sy, sw, shh, 1, 1, sw, shh);
    m.set(k, c); return c;
  },
  propFn(p, def) {
    const sh = ADV.sheet(ADV.originOf(def)), S = ADV.dk(def, p.x);
    const ph = def.frames ? ((p.x * 7 + p.y * 13) >> 4) & 255 : 0;   // animated props (def.frames, def.fps): frame k = source rect shifted right by k * sw, out of step per instance
    return g => {
      if (!sh) return; const sx = def.sx + (def.frames ? (Math.floor(this.t * def.fps) + ph) % def.frames * def.sw : 0), x = Math.round(p.x - def.ax * S), y = Math.round(p.y - p.z - def.ay * S);
      if (def.noOutline) g.drawImage(sh, sx, def.sy, def.sw, def.sh, x, y, def.sw * S, def.sh * S); else g.drawImage(this.olRect(sh, sx, def.sy, def.sw, def.sh), x - S, y - S, (def.sw + 2) * S, (def.sh + 2) * S);   // outlined like the sprites
      if (!this.sun) return;
      if (this.shade) { const a = g.globalAlpha; g.globalAlpha = a * this.shade; g.drawImage(this.tinted(sh, sx, def.sy, def.sw, def.sh), x, y, def.sw * S, def.sh * S); g.globalAlpha = a; }   // standing in a shadow
      else if (this.sun.face && this.caster(def, p.n) === 'box') {   // a building's front wall faces south, away from a north sun
        const w = this.wallOf(def), r0 = Math.max(0, def.ay - w), a = g.globalAlpha;
        g.globalAlpha = a * this.sun.face; g.drawImage(this.tinted(sh, sx, def.sy, def.sw, def.sh), 0, r0, def.sw, def.sh - r0, x, y + r0 * S, def.sw * S, (def.sh - r0) * S); g.globalAlpha = a;
      }
    };
  },
  shadow(g, x, y, rx, ry, a = 0.32) {   // in art px: radii in world px halved, one art-px row at a time; under a sun it shrinks to a contact shadow (the sun casts the real one)
    if (this.sun && !this.rec) { rx *= 0.7; ry *= 0.7; a *= 0.75; }
    if (ADVWA.on && ADVWA.open(Math.floor(x / this.T), Math.floor(y / this.T))) return;   // on open water the ring round a swimmer stands in for it
    const A = this.ART; x = this.q(x); y = this.q(y); rx = Math.round(rx / A); ry = Math.max(1, Math.round(ry / A)); g.fillStyle = `rgba(0,0,0,${a})`;
    for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry + 1))); if (w > 0) g.fillRect(x - w * A, y + dy * A, w * 2 * A, A); }
  },
  // Tall grass wading: redraw the grass tile over the lower 40% of an entity standing in it.
  wade(e, spriteH) {
    const cl = ADV.cellAt(e.x, e.y), g = ctx; if (!cl || !cl.over || ADV.palette[cl.over] !== 'tallgrass' || Math.abs(e.z - cl.h * this.T) > 1) return;
    const T = this.T, id = cl.ch.otile[cl.i], od = ADV.defOf('tallgrass'), sy = e.y - e.z, top = sy - spriteH * 0.4;
    g.save(); g.beginPath(); g.rect(Math.round(e.x - 20), Math.round(top), 40, Math.round(sy - top) + 3); g.clip();
    if (cl.ch.obake && cl.ch.obake[cl.i] >= 0) {   // a map-lab bed: its own blades from the region sheet (the ground bake already holds the full grass)
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 0; dr++) { const c = cl.c + dc, r = cl.r + dr, ch = ADV.chunkAt(c, r), o = ch && ch.obake ? ch.obake[(r & 31) * 32 + (c & 31)] : -1; if (o >= 0) this.tile(g, o, c * T, r * T - cl.h * T, window.ADV_TILESET_REGION); }
    } else for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 0; dr++) this.tile(g, id, (cl.c + dc) * T, cl.r * T - cl.h * T + dr * T, od && ADV.originOf(od), od && od.density);
    g.restore();
  },

  // The dim light (T4 cave, G8 glow, night veil): a dark veil over the finished picture with a hole for every light; dark = { a (veil alpha), tint 'r,g,b', lights: [{ x, y, r, a, warm? }] } in world px, or null.
  // All light is pixel art: hard-edged concentric rings (RINGS: radius fraction, share of the light) on a 2 world px grid, each ring edged with a 2 px checker dither; no gradients. The veil alpha steps in 0.06 notches.
  RINGS: [[1, 0.15], [0.75, 0.45], [0.5, 0.73], [0.25, 1]], POOL: [[1, 0.2], [0.62, 0.55], [0.3, 0.9]],
  // one stepped light of radius R at (x, y) on k: ring i is a disc whose alpha lifts the running total from rings[i-1] to rings[i] (fill(alpha) sets k's fillStyle)
  steps(k, x, y, R, a, rings, fill) {
    x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2; let prev = 0;
    for (const [fr, sh] of rings) {
      const A = a * sh, d = prev >= 1 ? 0 : 1 - (1 - A) / (1 - prev), r = Math.round(R * fr / 2) * 2; prev = A;
      if (d <= 0.01 || r < 2) continue;
      fill(d);
      for (let j = -r / 2; j < r / 2; j++) {
        const dy = 2 * j + 1, wo = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) / 2) * 2, ws = Math.floor(Math.sqrt(Math.max(0, (r - 2) * (r - 2) - dy * dy)) / 2) * 2;
        if (ws > 0) k.fillRect(x - ws, y + 2 * j, ws * 2, 2);
        for (let u = ws; u < wo; u += 2) if ((((u >> 1) + j) & 1) === 0) { k.fillRect(x + u, y + 2 * j, 2, 2); k.fillRect(x - u - 2, y + 2 * j, 2, 2); }
      }
    }
  },
  darken(g, vw, vh, ox, oy) {
    const D = this.dark, A = this.ART, dk = this.dk || (this.dk = document.createElement('canvas'));
    if (dk.width !== vw / A || dk.height !== vh / A) { dk.width = vw / A; dk.height = vh / A; }
    const k = dk.getContext('2d'); k.setTransform(1 / A, 0, 0, 1 / A, 0, 0); k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, vw, vh);
    k.fillStyle = `rgba(${D.tint},${Math.round(D.a / 0.06) * 0.06})`; k.fillRect(0, 0, vw, vh); k.globalCompositeOperation = 'destination-out';
    const seen = D.lights.filter(L => L.x + L.r > ox && L.x - L.r < ox + vw && L.y + L.r > oy && L.y - L.r < oy + vh);
    for (const L of seen) this.steps(k, Math.round(L.x / 2) * 2 - ox, Math.round(L.y / 2) * 2 - oy, L.r, L.a, this.RINGS, d => { k.fillStyle = `rgba(0,0,0,${d})`; });
    g.setTransform(1, 0, 0, 1, 0, 0); this.di.call(g, dk, 0, 0); g.setTransform(1 / A, 0, 0, 1 / A, 0, 0); g.globalCompositeOperation = 'lighter';
    for (const L of seen) if (L.warm || L.col) { const c = L.col || '255,150,60'; this.steps(g, Math.round(L.x / 2) * 2 - ox, Math.round(L.y / 2) * 2 - oy, L.r * 0.85, L.col ? L.ga : 0.2, this.POOL, d => { g.fillStyle = `rgba(${c},${d})`; }); }
    g.globalCompositeOperation = 'source-over'; g.setTransform(1 / A, 0, 0, 1 / A, -ox / A, -oy / A);
  },

  // A glowing prop (def.glow = [radius, 'r,g,b', strength, height above the foot]) as a light: it pulses by stepping through 3 discrete states with its animation frame (PULSE: radius and strength per state); s = { r, a, g } scales radius, hole and coloured pool (the scene turns them up at night)
  glowOf(p, def, s) {
    const [r, col, a, dy] = def.glow, [pr, pa] = def.frames ? ADVR.PULSE[def.frames][(Math.floor(this.t * def.fps) + (((p.x * 7 + p.y * 13) >> 4) & 255)) % def.frames] : ADVR.PULSE.on;
    const S = ADV.dk(def, p.x); return { x: p.x, y: p.y - p.z - dy * S, fy: p.y, r: r * S * s.r * pr, a: Math.min(0.95, Math.round(a * s.a * pa * 20) / 20), col, ga: Math.round(0.3 * a * s.g * pa * 20) / 20 };
  },
  // lamps the tileset ships without glow data: [radius, 'r,g,b', strength]; the light sits 4 sheet px under the sprite's top
  GLOW: { lampPost: [60, '255,206,130', 0.85], lampPostDouble: [70, '255,206,130', 0.9], lampPostLeft: [60, '255,206,130', 0.85], lampPostRight: [60, '255,206,130', 0.85], torchPost: [54, '255,160,80', 0.85], tripodLamp: [50, '255,196,120', 0.8], mLampDouble: [64, '255,206,130', 0.85] },
  glowDef(def, n) { if (def.glow === undefined) { const g = this.GLOW[n]; def.glow = g ? [g[0], g[1], g[2], def.ay - 4] : null; } return def.glow; },
  PULSE: { on: [1, 1], 3: [[0.88, 0.85], [1, 1], [0.94, 0.93]], 4: [[0.88, 0.85], [0.94, 0.93], [1, 1], [0.94, 0.93]] },

  // ---------- sun shadows (docs/SHADOWS.md) ----------
  // The sun crosses the NORTH sky (southern hemisphere) from 6:00 to 19:30 and its angle steps every 10 game minutes, so shadow pixels never crawl. Returns null when it is down.
  // dx, dy: plan shadow offset per world px of height (dy >= 0: shadows fall down-screen); by: dy for flat cutouts, kept >= 0.3 so a billboard never flattens to a line at sunrise;
  // tx, ty: unit vector toward the sun; a: shadow alpha (fades out when the sun is low); col: the flat shadow colour, cool at midday, warm purple near sunrise and sunset; face: alpha for walls facing south.
  sunOf(h) {
    h = Math.floor(h * 6) / 6; const t = (h - 6) / 13.5; if (t <= 0 || t >= 1) return null;
    const el = 65 * Math.sin(Math.PI * t), az = (90 - 180 * t) * Math.PI / 180, k = Math.min(3, 1 / Math.tan(Math.max(1, el) * Math.PI / 180));
    const a = Math.round(0.34 * clamp((el - 6) / 14, 0, 1) * 20) / 20; if (a < 0.03) return null;
    const m = Math.min(1, Math.abs(h - 12.75) / 6.75) ** 2, col = [20, 28, 60].map((c, i) => Math.round(c + ([48, 20, 56][i] - c) * m)).join(','), sy = -Math.cos(az);
    const dx = -Math.sin(az) * k, dy = Math.cos(az) * k;
    return { key: h, el, az, dx, dy, by: Math.max(dy, 0.3), tx: Math.sin(az), ty: sy, a, col, face: Math.round(a * (sy < -0.6 ? 0.8 : sy < -0.25 ? 0.45 : 0) * 20) / 20 };
  },
  // How a prop casts. 'box': a building (or a CAST entry); 'vol': a squat solid thing (rock, bush, barrel, crate: its collision is most of its width). Both cast their footprint swept along the sun, so the shadow
  // starts flush all round the base. 'cut': tall thin things whose top floats (trees, posts, signs) cast their sprite sheared from its lowest pixel. Flat decor casts nothing.
  // CAST: per prop [kind, wall height in sheet px] where the sprite alone misleads (a fountain's basin is mostly depth, not height)
  CAST: { maFountain: ['box', 18], jWell: ['box', 40] },
  caster(def, n) {
    if (def.cast !== undefined) return def.cast;
    const o = this.CAST[n]; if (o) { def.wall = o[1]; return def.cast = o[0]; }
    const s = def.solid; if (def.door || def.box) return def.cast = 'box';
    return def.cast = s && s[2] - s[0] >= def.sw * 0.5 && def.sw >= def.ay * 0.5 ? 'vol' : s || def.sh >= 24 ? 'cut' : '';
  },
  // wall height (sheet px): a building's is guessed from its anchor height, a squat thing's is half its drawn height (the rest is its top seen from above)
  wallOf(def, hs) { return def.wall ?? (def.cast === 'vol' && hs ? Math.max(2, Math.round((hs.bot - hs.top + 1) * 0.5)) : Math.round(def.ay * 0.45)); },   // ponytail: guessed from the sprite; add a CAST entry where one reads wrong
  baseOf(def, hs) { return def.cast === 'box' ? def.ay : hs.bot; },   // the sheet row the thing stands on: a building's anchor (rows below it are steps and mats), else its lowest pixel
  // a sheet rect as a hard black silhouette (every px fully in or out, so half-alpha art leaves no soft spots in a shadow), cached
  hard(im, sx, sy, sw, sh) {
    const m = this.hc || (this.hc = new Map()), key = (im.src || im.id || (im.id = 'c' + Math.random())) + '|' + sx + '|' + sy + '|' + sw + '|' + sh; let c = m.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = sw; c.height = sh; const k = c.getContext('2d', { willReadFrequently: true }); k.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    const d = k.getImageData(0, 0, sw, sh), u = new Uint32Array(d.data.buffer); let top = sh, bot = -1;
    for (let i = 0; i < u.length; i++) if (u[i] >>> 24 >= 128) { u[i] = 0xff000000; const r = (i / sw) | 0; if (r < top) top = r; bot = r; } else u[i] = 0;
    k.putImageData(d, 0, 0); c.u = u; c.top = top; c.bot = bot; m.set(key, c); return c;   // u: the hard alpha, kept for shade tests; top, bot: first and last opaque rows
  },
  // a box's ground footprint: its sprite moved down by the wall height (the roof or top sits over it), cut at the row it stands on; sheet px, black
  footprint(def, sh) {
    const c = def.fp || (def.fp = document.createElement('canvas')); if (c.done) return c;
    const hs = this.hard(sh, def.sx, def.sy, def.sw, def.sh), w = this.wallOf(def, hs), b = this.baseOf(def, hs); c.width = def.sw; c.height = b + 1;
    if (b + 1 - w > 0) c.getContext('2d').drawImage(hs, 0, 0, def.sw, b + 1 - w, 0, w, def.sw, b + 1 - w); c.done = true; return c;
  },
  // the foot of a cut caster (a tree's trunk, a post): the slice just above its lowest B rows, moved down B rows, so it sits where the trunk meets the ground. Swept like a box it gives the trunk depth,
  // so the shadow hugs the roots on every side instead of starting from one bottom row. B = 8 sheet px.
  trunkFoot(def, hs, b) {
    const c = def.tf || (def.tf = document.createElement('canvas')), B = 8; if (c.done) return c;
    c.width = def.sw; c.height = b + 1; const r0 = Math.max(0, b - 2 * B), n = b - B - r0 + 1;
    const k = c.getContext('2d'), W = def.sw;   // only the trunk's columns: those that reach within B rows of the bottom (a low canopy edge does not)
    for (let x = 0; x < W; x++) { let cb = -1; for (let y = hs.height - 1; y >= 0; y--) if (hs.u[y * W + x]) { cb = y; break; } if (cb >= b - B && n > 0) k.drawImage(hs, x, r0, 1, n, x, r0 + B, 1, n); }
    c.done = true; return c;
  },
  // a sheet rect filled flat with the sun colour (the shade laid over things standing in shadow and walls facing away), cached until the colour steps
  tinted(im, sx, sy, sw, sh) {
    const S = this.sun, m = this.tc || (this.tc = new Map()); if (m.col !== S.col) { m.clear(); m.col = S.col; }
    const key = (im.src || im.id || (im.id = 'c' + Math.random())) + '|' + sx + '|' + sy + '|' + sw + '|' + sh; let c = m.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = sw; c.height = sh; const k = c.getContext('2d');
    k.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh); k.globalCompositeOperation = 'source-in'; k.fillStyle = `rgb(${S.col})`; k.fillRect(0, 0, sw, sh); m.set(key, c); return c;
  },
  // fill a convex polygon (art px points) one whole row at a time: hard pixel-art edges, no anti-aliasing
  poly(k, P) {
    const ys = P.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5; let l = Infinity, r = -Infinity;
      for (let i = 0; i < P.length; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length]; if ((ay <= yc) === (by <= yc)) continue;
        const x = ax + (yc - ay) / (by - ay) * (bx - ax); if (x < l) l = x; if (x > r) r = x;
      }
      if (r > l) { const a = Math.round(l), b = Math.round(r); if (b > a) k.fillRect(a, y, b - a, 1); }
    }
  },
  // a rect (art px) swept by v: the hexagon hull of the rect and its moved copy. A tall block is cheaper as copies of the rect stepped one px along v.
  sweep(k, x0, y0, x1, y1, vx, vy) {
    const n = Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)));
    if (n < y1 - y0 + Math.abs(vy)) { const ax = Math.round(x0), ay = Math.round(y0), w = Math.round(x1) - ax, h = Math.round(y1) - ay; for (let i = 0; i <= n; i++) k.fillRect(ax + Math.round(vx * i / n), ay + Math.round(vy * i / n), w, h); return; }
    const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], Q = P.map(([x, y]) => [x + vx, y + vy]), pts = [...P, ...Q].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
    for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of pts.reverse()) { while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    this.poly(k, [...lo.slice(0, -1), ...hi.slice(0, -1)]);
  },
  // Static shadows (cliffs, props, buildings) for a region around the view, one mask per receiving level L. Mask L holds level-L ground drawn where the screen shows it:
  // plan point (X, Y) on level L sits at mask px ((X - x0) / A, (Y - L T - y0) / A). Something standing on level Lp also casts into every lower mask with its extra height (Lp - L) T;
  // where that lands on higher ground it is hidden, and the gap it skips is always inside the cliff's own shadow, so the union is right without ray tests.
  buildStatic(S, x0, y0, w, h) {
    const A = this.ART, T = this.T, sm = { key: S.key, x0, y0, w, h, lv: [], boxes: [], cuts: [] }, R = 3 * (4 * T + 300);   // R: the farthest a caster outside the region can reach into it
    const c0 = Math.floor((x0 - R) / T), c1 = Math.floor((x0 + w * A + R) / T), r0 = Math.floor((y0 - R) / T), r1 = Math.floor((y0 + h * A + 4 * T) / T);
    let maxL = 0; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = ADV.h(c, r); if (v > maxL) maxL = v; }
    const pool = this.pool || (this.pool = []), mk = L => { let k = pool[L]; if (!k) k = pool[L] = document.createElement('canvas').getContext('2d'); if (k.canvas.width !== w || k.canvas.height !== h) { k.canvas.width = w; k.canvas.height = h; } else k.clearRect(0, 0, w, h); k.fillStyle = '#000'; return sm.lv[L] = k; };   // the mask canvases are reused build to build
    for (let L = 0; L <= maxL; L++) mk(L);
    const px = X => (X - x0) / A, py = (Y, L) => (Y - L * T - y0) / A;
    // cliffs: every run of raised cells of one height is a block (h - L) T tall over level L; equal runs in following rows merge into one block
    const open = new Map(), emit = o => { for (let L = 0; L < o.v; L++) { const n = (o.v - L) * T; this.sweep(sm.lv[L], px(o.c * T), py(o.r0 * T, L), px((o.e + 1) * T), py((o.r + 1) * T, L), S.dx * n / A, S.dy * n / A); } };
    // a map-lab cliff cell with an outline (smask) is swept as that outline, so its shadow follows the rock edge and the rounded corners; it breaks the box runs
    const sil = [], om = (c, r) => { const ch = ADV.chunkAt(c, r); return ch && ch.smask ? ch.smask[(r & 31) * 32 + (c & 31)] : -1; };
    const hb = (c, r) => { const v = ADV.h(c, r); if (v > 0 && om(c, r) >= 0) { sil.push([c, r, v, om(c, r)]); return 0; } return v; };
    const HB = new Map(), hbk = (c, r) => { const k = c + ',' + r; if (!HB.has(k)) HB.set(k, hb(c, r)); return HB.get(k); };
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1;) {
        const v = hbk(c, r); if (v <= 0) { c++; continue; }
        let e = c; while (e + 1 <= c1 && hbk(e + 1, r) === v) e++;
        const key = c * 4096 + e * 8 + v, o = open.get(key);
        if (o && o.r === r - 1) o.r = r; else { if (o) emit(o); open.set(key, { c, e, v, r0: r, r }); }
        c = e + 1;
      }
      for (const [key, o] of open) if (o.r < r) { emit(o); open.delete(key); }
    }
    for (const o of open.values()) emit(o);
    const ms = window.ADV_TILESET_REGION?.cliffMasks || [], mc = this.cmc || (this.cmc = []);
    for (const [c, r, v, mi] of sil) {
      let im = mc[mi];
      if (!im) {   // 32 rows of 32 bits (hex) -> a 32 x 32 white-on-clear canvas
        im = mc[mi] = document.createElement('canvas'); im.width = im.height = 32; const g = im.getContext('2d'), id = g.createImageData(32, 32), hx = ms[mi] || '';
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((parseInt(hx.substr(y * 8 + (x >> 3) * 2, 2), 16) >> (7 - (x & 7))) & 1) id.data.set([255, 255, 255, 255], (y * 32 + x) * 4);
        g.putImageData(id, 0, 0);
      }
      for (let L = 0; L < v; L++) {
        const k = sm.lv[L], n = (v - L) * T, ddx = S.dx * n / A, ddy = S.dy * n / A, N = Math.ceil(Math.max(Math.abs(ddx), Math.abs(ddy))) + 1, X = px(c * T), Y = py(r * T, L);
        for (let s = 0; s <= N; s++) k.drawImage(im, Math.round(X + ddx * s / N), Math.round(Y + ddy * s / N), T / A, T / A);
      }
    }
    // props: buildings and solid blocks as boxes, the rest as their sprite sheared along the sun from the foot
    const X0 = x0 - R, X1 = x0 + w * A + R, Y0 = y0 - R, Y1 = y0 + h * A + 4 * T;
    for (const ch of ADV.chunks.values()) for (const p of ch.props) {
      if (p.x < X0 || p.x > X1 || p.y < Y0 || p.y > Y1) continue;
      const def = ADV.propDef(p.n), kind = def && this.caster(def, p.n), sh = kind && ADV.sheet(ADV.originOf(def)); if (!sh) continue;
      const K = ADV.dk(def, p.x), z = p.z || 0, Lp = Math.max(0, Math.round(z / T));
      for (let L = 0; L <= Math.min(Lp, maxL); L++) {
        const k = sm.lv[L], e = z - L * T;
        const hs = this.hard(sh, def.sx, def.sy, def.sw, def.sh), b = this.baseOf(def, hs), bx = p.x - def.ax * K, byy = p.y - def.ay * K;   // (bx, byy): the sprite's top-left in plan; row b stands at plan y byy + b K
        if (kind !== 'cut') {
          const fp = this.footprint(def, sh), wall = this.wallOf(def, hs) * K, n = Math.ceil(wall * Math.max(Math.abs(S.dx), Math.abs(S.dy)) / A) + 1;
          if (L === 0) sm.boxes.push([bx, byy + wall, bx + def.sw * K, byy + (b + 1) * K, z + wall, p]);   // its plan footprint and top height, for shaded()
          for (let s = 0; s <= n; s++) { const hh = e + wall * s / n; k.drawImage(fp, Math.round(px(bx + hh * S.dx)), Math.round(py(byy + hh * S.dy, L)), def.sw * K / A, (b + 1) * K / A); }
        } else {
          const Yb = byy + (b + 1) * K, fs = Yb - z;   // cast from the lowest pixel, so a trunk's shadow starts where the trunk meets the ground
          k.setTransform(1 / A, 0, -S.dx / A, -S.by / A, (S.dx * (fs + e) - x0) / A, (Yb - L * T + S.by * (fs + e) - y0) / A);
          k.drawImage(hs, Math.round(bx), Math.round(byy - z), def.sw * K, def.sh * K); k.setTransform(1, 0, 0, 1, 0, 0);
          const tf = this.trunkFoot(def, hs, b), tw = 8 * K, tn = Math.ceil(tw * Math.max(Math.abs(S.dx), Math.abs(S.dy)) / A) + 1;   // the trunk as a short volume
          for (let s = 0; s <= tn; s++) { const hh = e + tw * s / tn; k.drawImage(tf, Math.round(px(bx + hh * S.dx)), Math.round(py(byy + hh * S.dy, L)), def.sw * K / A, (b + 1) * K / A); }
          if (L === 0) sm.cuts.push({ p, hs, x0: Math.round(bx), y0: Math.round(byy - z), K, Yb, fs, z, Lp });   // for shaded()
        }
      }
    }
    sm.maxL = maxL; return sm;
  },
  // Is the point at plan (X, Y), hh world px over level L, in a static shadow? Follow the ray from it toward the sun (it rises 1 / k per plan px): it is shaded when that ray passes under a raised cell,
  // through a box, or behind a cut caster's opaque pixel that stands higher than the point (the inverse of the shear that drew the caster's shadow, so what dims always matches what is drawn).
  // self = the prop asking, which never shades itself. Pure maths on the cached hard alpha; cs = the cut casters worth testing (cutsNear), default all.
  shaded(X, Y, L, self, hh = 0, cs) {
    const S = this.sun, sm = this.sm, T = this.T, k = Math.hypot(S?.dx, S?.dy); if (!S || !sm || !(k > 0.01)) return false;
    const gx = X + hh * S.dx;
    for (const c of cs || sm.cuts) {
      if (c.p === self || c.Lp < L || c.Yb >= Y) continue;
      const e = c.z - L * T, hc = (Y - c.Yb) / S.by + hh; if (hc < e || hc > e + c.hs.height * c.K) continue;   // hc: the height the ray meets the caster's plane at
      const col = Math.floor((gx - hc * S.dx - c.x0) / c.K), row = Math.floor((c.fs + e - hc - c.y0) / c.K);
      if (col >= 0 && row >= 0 && col < c.hs.width && row < c.hs.height && c.hs.u[row * c.hs.width + col]) return true;
    }
    const base = L * T + hh, ux = S.tx, uy = S.ty;
    if (sm.maxL * T > base) for (let s = T / 4; s <= (sm.maxL * T - base) * k + T; s += T / 4) if (ADV.h(Math.floor((X + ux * s) / T), Math.floor((Y + uy * s) / T)) * T > base + s / k) return true;
    for (const [x0, y0, x1, y1, top, bp] of sm.boxes) {
      if (bp === self || top <= base || X > x0 && X < x1 && Y > y0 && Y < y1) continue; let a = 8, b = (top - base) * k;   // the ray is under the top for s < b; a: skip the first px
      for (const [o, u, lo, hi] of [[X, ux, x0, x1], [Y, uy, y0, y1]]) { if (Math.abs(u) < 1e-6) { if (o < lo || o > hi) { a = 1; b = 0; } continue; } let t0 = (lo - o) / u, t1 = (hi - o) / u; if (t0 > t1) [t0, t1] = [t1, t0]; a = Math.max(a, t0); b = Math.min(b, t1); }
      if (a < b) return true;
    }
    return false;
  },
  cutsNear(x, Y, r) { return this.sm.cuts.filter(c => Math.abs(c.p.x - x) < r && c.Yb < Y && Y - c.Yb < r); },
  levelAt(x, y) { return Math.max(0, ADV.h(Math.floor(x / this.T), Math.floor(y / this.T))); },
  // this frame's masks: the static ones cropped to the view plus every recorded entity sprite (rec: [im, sx, sy, sw, sh, dx, dy, dw, dh, foot y, z])
  frameMasks(rec, ox, oy, cw, ch) {
    const S = this.sun, sm = this.sm, A = this.ART, T = this.T, fm = this.fmp || (this.fmp = []), mx = (ox - sm.x0) / A, my = (oy - sm.y0) / A;
    for (let L = 0; L <= sm.maxL; L++) {
      let k = fm[L]; if (!k) { const cv = document.createElement('canvas'); k = fm[L] = cv.getContext('2d'); }
      if (k.canvas.width !== cw || k.canvas.height !== ch) { k.canvas.width = cw; k.canvas.height = ch; }
      k.globalCompositeOperation = 'source-over'; k.setTransform(1, 0, 0, 1, 0, 0); k.clearRect(0, 0, cw, ch); k.imageSmoothingEnabled = false;
      k.drawImage(sm.lv[L].canvas, mx, my, cw, ch, 0, 0, cw, ch);
    }
    for (const [im, sx, sy, sw, sh, dx, dy, dw, dh, Y, z] of rec) {
      const fs = Y - z, Lg = Math.min(sm.maxL, this.levelAt(dx + dw / 2, Y));
      for (let L = 0; L <= Lg; L++) { const k = fm[L], e = z - L * T; k.setTransform(1 / A, 0, -S.dx / A, -S.by / A, (S.dx * (fs + e) - ox) / A, (Y - L * T + S.by * (fs + e) - oy) / A); k.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); }
    }
    for (let L = 0; L <= sm.maxL; L++) { const k = fm[L]; k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'source-in'; k.fillStyle = `rgb(${S.col})`; k.fillRect(0, 0, cw, ch); }
    return fm;
  },
  // A person or mon sprite just drawn at (dx, dy, dw, dh) (world px; this.rf = [foot y, z]) darkens wherever it stands in a static shadow, pixel by pixel (2 x 2 art px blocks): each block is a point
  // at its height over the ground, tested with shaded(). A body half in a shadow's edge is half dark, and a short thing south of you never darkens your head. Inside a building (its cutaway) stays lit.
  shadeSprite(im, sx, sy, sw, sh, dx, dy, dw, dh) {
    const S = this.sun, A = this.ART, T = this.T, [Y, z] = this.rf, cx0 = dx + dw / 2; if (ADV.bldAt(cx0, Y)) return;
    const L = this.levelAt(cx0, Y), e = z - L * T, fs = Y - z, w = Math.ceil(dw / A), h = Math.ceil(dh / A), cs = this.cutsNear(cx0, Y, 700);
    const cv = this.ssc || (this.ssc = document.createElement('canvas')); if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, w); cv.height = Math.max(cv.height, h); this.ssd = null; }
    const k = cv.getContext('2d'), d = this.ssd && this.ssd.width === w && this.ssd.height === h ? this.ssd : (this.ssd = k.createImageData(w, h)), u32 = new Uint32Array(d.data.buffer); u32.fill(0);
    let any = false;
    for (let v = 0; v < h; v += 2) {
      const hh = fs + e - (dy + (v + 1) * A); if (hh < 0) continue;   // this row's height over level L
      for (let x = 0; x < w; x += 2) if (this.shaded(dx + (x + 1) * A, Y, L, null, hh, cs)) { any = true; for (let j = v; j < Math.min(h, v + 2); j++) for (let i = x; i < Math.min(w, x + 2); i++) u32[j * w + i] = 0xff000000; }
    }
    if (!any) return;
    k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, cv.width, cv.height); k.imageSmoothingEnabled = false; k.putImageData(d, 0, 0);
    k.globalCompositeOperation = 'destination-in'; k.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    k.globalCompositeOperation = 'source-in'; k.fillStyle = `rgb(${S.col})`; k.fillRect(0, 0, w, h);
    const a = ctx.globalAlpha; ctx.globalAlpha = a * S.a; ctx.drawImage(cv, 0, 0, w, h, dx, dy, dw, dh); ctx.globalAlpha = a;
  },
  // lay mask L (canvas px rect) on the picture at the sun's alpha
  layShadow(g, L, x, y, w, h) {
    const k = this.fm && this.fm[L]; if (!k || w <= 0 || h <= 0) return;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = this.sun.a; this.di.call(g, k.canvas, x, y, w, h, x, y, w, h); g.restore();
  },

  // S2: a building the player has stepped into. While its exterior is fading (b.k > 0, adv-world.js cutTick) its inside is drawn in place at the world's scale: the floor, the wall tops round it (open at the exits), the upright back wall
  // (a depth-sorted drawable behind everything standing on the floor) and the furniture, all interior-sheet art 1:1 (2x art, so its pixel is the size of a sprite's). Returns the building to hole the dark veil round, or null.
  // The exterior sprite fades in 3 hard alpha steps (propFn caller below) and the rest of the world is dimmed one stepped notch per step (veil).
  tileInt(g, id, x, y) { const it = window.ADV_TILESET_INT, sh = it && ADV.sheet(it); if (sh && id >= 0) g.drawImage(sh, (id % it.cols) * 32, Math.floor(id / it.cols) * 32, 32, 32, x, y, 32, 32); },
  cutaway(g, list, ox, oy, vw, vh) {
    let top = null;
    for (const b of ADV.blds) {
      if (!b.k || b.x1 < ox || b.x0 > ox + vw || b.y1 < oy || b.y0 - 160 > oy + vh) continue;
      if (!top || b.k > top.k) top = b;
      const I = b.interior, mid = n => ADV.defOf(n)?.C, fl = mid(I.floor), dk = mid(I.walls + '_dark'), wt = mid(I.walls + '_wallT'), wb = mid(I.walls + '_wallB'), C = b.w * 2 - 2, R = b.d * 2 - 1, W = ADV.BW;
      const open = x => b.gaps.some(([a, z]) => x >= a && x < z);
      for (let j = 0; j <= R; j++) for (let i = -1; i <= C; i++) {
        const x = b.x0 + W + i * 32, y = b.y0 + j * 32, wall = j === R ? !open(x) : i < 0 || i === C;
        this.tileInt(g, wall ? dk : fl, x, y);
      }
      for (const [a, z] of b.gaps) { const d = ADV.propDef('matRed'); if (d) this.propFn({ n: 'matRed', x: (a + z) / 2, y: b.y1 - W + 2, z: 0 }, d)(g); }
      list.push({ type: 2, key: b.y0 - 24, row: Math.floor((b.y0 - 24) / this.T), z: 0, x: b.x0, f: g => { for (let i = -1; i <= C; i++) { this.tileInt(g, wt, b.x0 + W + i * 32, b.y0 - 64); this.tileInt(g, wb, b.x0 + W + i * 32, b.y0 - 32); } } });
      for (const p of b.items) {
        const def = ADV.propDef(p.n); if (!def || p.y < oy - 200 || p.y - 200 > oy + vh) continue;
        list.push({ type: 2, key: p.y, row: Math.floor(p.y / this.T), z: 0, x: p.x, f: this.propFn(p, def) });
      }
    }
    return top;
  },

  // cam = { x, y } world px of the view centre; items = [{ x, y, z, f }] entities drawn depth-sorted with the world
  // opts (battles in the world): floor(g) draws on the ground under everything standing (after the base terrain, or row by row clipped into the strips when the floor is lv > 0 levels up), over(g) after the sorted pass
  // zmW: a smaller zoom for the world alone (a high flier sees the ground fall away); items marked top (a flier) are drawn over everything at the player's own zoom, so they keep their size and never dip behind a roof
  draw(cam, items, t, opts) {
    const zw = this.zmW ? clamp(this.zmW, 1, this.zm) : this.zm, tops = items.filter(i => i.top); if (tops.length) items = items.filter(i => !i.top);
    const T = this.T = ADV.Tp(cam.x), S = this.S = T / 32, sc = this.sc(zw), z = this.zoom = sc / DPR, cv = this.cv, W = screenCtx.canvas.width, H = screenCtx.canvas.height, A = this.ART, zm = sc * A;   // zm whole device px per art px
    const cw = Math.ceil(W / zm) + 1, ch = Math.ceil(H / zm) + 1, vw = cw * A, vh = ch * A;   // the canvas is 1 canvas px per art px; vw, vh = the same view in world px
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = this.g || (this.g = this.snapG(cv.getContext('2d'))), oxa = Math.round(cam.x / A) - Math.round(W / 2 / zm), oya = Math.round(cam.y / A) - Math.round(H / 2 / zm), ox = oxa * A, oy = oya * A;   // one rounded camera: an art-px origin
    this.sh = ADV.sheet(); this.t = t; this.frame = Math.floor(t * 2.5); this.view = { ox, oy, vw, vh }; ctx = g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.fillStyle = '#000'; this.fr.call(g, 0, 0, cw, ch);
    g.setTransform(1 / A, 0, 0, 1 / A, -oxa, -oya);   // world px in, canvas (art) px out
    const c0 = Math.floor(ox / T), c1 = Math.floor((ox + vw - 1) / T), r0 = Math.floor(oy / T), rv = Math.floor((oy + vh - 1) / T), r1 = rv + 8;
    // sun shadows: outdoors only, fading out under a dark veil (canopy gloom); static masks are rebuilt when the sun steps or the view leaves the region they cover
    const SU = this.sun = ADV.S(cam.x) === ADV.OUT && !this.noSun ? this.sunOf(ADVW.hour()) : null; this.fm = null; let sunOn = false;
    const WX = !opts && typeof ADVWX !== 'undefined' ? ADVWX : null;   // overworld weather (src/adv-weather.js): clouds, rain and fog weaken the sun
    ADVWA.on = false; const WA = !opts && ADV.S(cam.x) === ADV.OUT && ADVWA.scan(this, ox, oy, vw, vh) ? ADVWA : null;   // open water in view (src/adv-water.js)
    if (SU) SU.a = Math.round(SU.a * (WX ? WX.light().sun : 1) * clamp(1 - (this.dark ? this.dark.a : 0) / 0.5, 0, 1) * 20) / 20;
    if (SU && SU.a > 0) {
      const sm = this.sm, m = Math.round(vw / 3 / A) * A;
      if (!sm || sm.key !== SU.key || sm.T !== T || sm.n !== ADV.chunks.size || ox < sm.x0 || oy < sm.y0 || ox + vw > sm.x0 + sm.w * A || oy + vh > sm.y0 + sm.h * A) {
        this.sm = this.buildStatic(SU, ox - m, oy - m, cw + 2 * m / A, ch + 2 * m / A); this.sm.T = T; this.sm.n = ADV.chunks.size;
      }
      sunOn = true;
    } else this.sun = null;
    const rec = [];   // every person and mon sprite this frame, recorded in a pre-pass: they cast sun shadows and mirror in water
    if (!opts && (sunOn || WA)) { this.rec = rec; ctx = this.scr || (this.scr = document.createElement('canvas').getContext('2d')); for (const it of items) { try { it.f(); } catch (e) { /* a drawable that needs the real canvas casts nothing */ } } this.rec = null; ctx = g; }
    if (sunOn) this.fm = this.frameMasks(rec, ox, oy, cw, ch);
    // base pass: every level-0 top, unsorted
    const CH = ADV.CH; let bud = 2;   // at most 2 chunk bakes a frame; a chunk not baked yet is drawn tile by tile
    for (let cy = Math.floor(r0 / CH); cy <= Math.floor(rv / CH); cy++) for (let cx = Math.floor(c0 / CH); cx <= Math.floor(c1 / CH); cx++) {
      const ch = ADV.chunkAt(cx * CH, cy * CH); if (!ch) continue;
      const bc = this.gchunk(ch, bud > 0 && bud--);
      if (bc) { g.drawImage(bc, cx * CH * T, cy * CH * T, CH * T, CH * T); continue; }
      for (let r = Math.max(r0, cy * CH); r <= Math.min(rv, cy * CH + CH - 1); r++) for (let c = Math.max(c0, cx * CH); c <= Math.min(c1, cx * CH + CH - 1); c++) {
        const i = (r & 31) * 32 + (c & 31); if (ch.h[i] === 0) this.groundCell(g, ch, i, c, r);
      }
    }
    if (WA) WA.under(g, this, rec, t);   // water: depth, reflections, glints, foam, ripples
    if (this.fm) this.layShadow(g, 0, 0, 0, cw, ch);   // level-0 shadows under everything standing; higher ground gets its own in its row strip

    const list = [], cut = this.cutaway(g, list, ox, oy, vw, vh);   // S2: the inside of a building you are in, under the exterior and over the ground
    const lv = opts?.lv | 0; if (opts?.floor && !lv) opts.floor(g);
    // sorted drawables: one strip per row of elevated tops and faces, one deck per row, props, entities
    const gl = this.dark?.glow ? { lights: this.dark.lights, glow: this.dark.glow } : null;
    for (let r = r0; r <= r1; r++) {
      let any = false; const decks = {};
      for (let c = c0; c <= c1; c++) {
        const ch = ADV.chunkAt(c, r); if (!ch) continue;
        const i = (r & 31) * 32 + (c & 31);
        if (ch.h[i] > 0) any = true;
        if (ch.deck[i] >= 0) (decks[ch.deck[i]] ||= []).push(c);
      }
      if (any) list.push({ type: 0, key: r * T, row: r, z: 0, f: this.stripFn(r, c0, c1) });
      for (const d in decks) { const cols = decks[d]; list.push({ type: 1, key: r * T, row: r, z: d * T, x0: cols[0] * T, x1: (cols[cols.length - 1] + 1) * T, f: this.deckFn(r, +d, cols) }); }
    }
    for (const ch of ADV.chunks.values()) for (const p of ch.props) {
      const def = ADV.propDef(p.n); if (!def) continue;
      const K = ADV.dk(def, p.x), sy = p.y - p.z, gm = gl && this.glowDef(def, p.n) ? def.glow[0] * K : 0;   // glowing props light the dim zones from a bit off screen too
      if (gm && p.x + gm > ox && p.x - gm < ox + vw && sy + gm > oy && sy - gm < oy + vh) gl.lights.push(this.glowOf(p, def, gl.glow));
      if (p.x + def.sw * K < ox || p.x - def.sw * K > ox + vw || sy - def.sh * K > oy + vh || sy + 8 < oy) continue;
      if (p.b && p.b.k > 2) continue;   // a building cut away: its exterior is gone
      const f = this.propFn(p, def);
      list.push({ type: 2, key: p.y, row: Math.floor(p.y / T), z: p.z, x: p.x, pr: p, f: p.b && p.b.k ? g => { g.globalAlpha = 1 - p.b.k / 3; f(g); g.globalAlpha = 1; } : f });
    }
    for (const it of items) list.push({ type: 2, key: it.y, row: Math.floor(it.y / T), z: it.z, x: it.x, it: 1, f: it.f });
    if (opts?.floor && lv) for (let r = r0; r <= rv + lv; r++) list.push({ type: 2, key: r * T, row: r, z: -1, x: ox, f: g => { g.save(); g.beginPath(); g.rect(ox, (r - lv) * T, vw, T); g.clip(); opts.floor(g); g.restore(); } });
    for (const o of ADV.depthSort(list)) {   // things standing in a shadow are dimmed by it: a prop as a whole, a person or mon pixel by pixel (shadeSprite)
      this.shade = o.pr && this.sun && this.shaded(o.x, o.key, this.levelAt(o.x, o.key), o.pr) ? this.sun.a : 0; this.shadeE = !!(o.it && this.sun && this.sm); o.f(g);
    }
    this.shade = 0; this.shadeE = false;
    if (opts?.over) opts.over(g);
    if (WX) WX.drawShade(g, this.view, t);   // cloud shadows over the ground and everything on it
    if (cut) { g.save(); g.beginPath(); g.rect(ox, oy, vw, vh); g.rect(cut.x0, cut.y0 - 64, cut.x1 - cut.x0, cut.y1 - cut.y0 + 64); g.clip('evenodd'); g.fillStyle = `rgba(0,0,0,${0.1 * cut.k})`; g.fillRect(ox, oy, vw, vh); g.restore(); }   // the world outside dims one stepped notch per step
    if (this.dark) this.darken(g, vw, vh, ox, oy);
    if (WA) WA.lamps(g, this, t);   // lamp light streaks on the water at night
    if (WX) WX.drawFx(g, this.view, t);   // rain, snow, sand, fog and lightning over everything
    ctx = screenCtx;
    screenCtx.setTransform(1, 0, 0, 1, 0, 0); screenCtx.imageSmoothingEnabled = false;   // device px, nearest neighbour only: every art px comes out a whole 1-4 device px
    screenCtx.drawImage(cv, 0, 0, cw, ch, 0, 0, cw * zm, ch * zm);
    if (tops.length) {   // the flier over the far-off ground, at the player's zoom, centred on the same camera
      const z2 = this.sc() * A, w2 = Math.ceil(W / z2) + 1, h2 = Math.ceil(H / z2) + 1, c2 = this.cv2 || (this.cv2 = document.createElement('canvas')); if (c2.width !== w2 || c2.height !== h2) { c2.width = w2; c2.height = h2; }
      const g2 = this.g2 || (this.g2 = this.snapG(c2.getContext('2d'))), sun = this.sun;
      g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, w2, h2); g2.imageSmoothingEnabled = false; g2.setTransform(1 / A, 0, 0, 1 / A, -(Math.round(cam.x / A) - Math.round(W / 2 / z2)), -(Math.round(cam.y / A) - Math.round(H / 2 / z2)));
      this.sun = null; ctx = g2; for (const it of tops) it.f(); ctx = screenCtx; this.sun = sun;
      screenCtx.setTransform(1, 0, 0, 1, 0, 0); screenCtx.drawImage(c2, 0, 0, w2, h2, 0, 0, w2 * z2, h2 * z2);
    }
    screenCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  },
};

ADVR.load();
