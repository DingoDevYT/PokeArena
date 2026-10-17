// Adventure overworld water (outdoors, level-0 open water, not under a bridge deck). adv-render.js calls scan() before its passes, under() after the ground pass and lamps() after the dark veil;
// render.js drawFrame asks line() whether a person or mon stands in water and draws it half submerged.
// All of it is pixel art on the art grid (1 art px = 2 world px): hard masks, whole-px row shifts, stepped alphas, no blur, no gradients.
// - mask: the water pixels of every water tile (its colours matched against the material's centre tile), so shore art drawn inside an edge tile is never painted over
// - depth: the mask eroded on a half-res grid, darker the further from the shore
// - reflections: sky colour for the hour and weather, drifting clouds, props and people mirrored about their foot line; the layer is tinted to the water and its rows shift sideways in a slow wave
// - sun glints on open water, an animated foam line along every shore, rings round anything swimming, and lamp light streaks on the water at night
'use strict';
const ADVWA = {
  on: false, rp: [],   // on: open water in view this frame (drawFrame submerges only then); rp: extra ripple sources recorded this frame [x, y, rx] (a raft)
  M: 24,   // margin round the view in art px, so the shore erosion never eats the screen edge
  SKY: [[0, [18, 28, 58]], [5, [18, 28, 58]], [6.2, [232, 166, 140]], [8, [140, 186, 236]], [17, [140, 186, 236]], [18.8, [238, 150, 110]], [20.3, [18, 28, 58]], [24, [18, 28, 58]]],
  GREY: { cloudy: [150, 160, 176], rain: [104, 116, 136], storm: [70, 78, 98], fog: [196, 204, 214], snow: [200, 210, 226], sand: [210, 170, 110] },

  cv(k, w, h) { const c = this[k] || (this[k] = document.createElement('canvas')); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h); return g; },
  open(c, r) { return ADV.isWater(c, r) && ADV.h(c, r) === 0 && ADV.deck(c, r) < 0; },

  // the water colours of a material: every colour of its centre tile across its animation frames, plus the most common one (the tint for reflections and the submerged)
  pal(def) {
    if (def.wpal) return def.wpal;
    const ts = ADV.originOf(def), sh = ADV.sheet(ts); if (!sh) return null;
    const ids = new Set([ADV.pick(def, 'C', 0, 0)]); for (let f = 0; f < (def.frames ? def.frames.length : 1); f++) ids.add(ADV.frameId(def, 0, ADV.pick(def, 'C', 0, 0), f));
    const k = this.cv('pc', 32, 32), n = new Map();
    for (const id of ids) { k.clearRect(0, 0, 32, 32); k.drawImage(sh, (id % ts.cols) * 32, Math.floor(id / ts.cols) * 32, 32, 32, 0, 0, 32, 32); const d = k.getImageData(0, 0, 32, 32).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) { const v = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; n.set(v, (n.get(v) || 0) + 1); } }
    if (!n.size) return null;   // the sheet is still loading: try again next frame
    const cols = [...n.keys()].map(v => [v >> 16, (v >> 8) & 255, v & 255]), top = [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return def.wpal = { cols, rgb: [top >> 16, (top >> 8) & 255, top & 255].join(',') };
  },
  // one tile's water pixels as an opaque white mask (32 x 32 sheet px), cached per tile id
  tmask(def, id) {
    const m = def.wtm || (def.wtm = new Map()), key = id; let c = m.get(key); if (c) return c;
    const ts = ADV.originOf(def), sh = ADV.sheet(ts), P = this.pal(def); if (!sh || !P) return null;
    c = document.createElement('canvas'); c.width = c.height = 32; const k = c.getContext('2d', { willReadFrequently: true });
    k.drawImage(sh, (id % ts.cols) * 32, Math.floor(id / ts.cols) * 32, 32, 32, 0, 0, 32, 32);
    const d = k.getImageData(0, 0, 32, 32), a = d.data;
    for (let i = 0; i < a.length; i += 4) { let ok = false; if (a[i + 3] >= 128) for (const [r, g, b] of P.cols) if ((a[i] - r) ** 2 + (a[i + 1] - g) ** 2 + (a[i + 2] - b) ** 2 <= 576) { ok = true; break; } a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = ok ? 255 : 0; }
    k.putImageData(d, 0, 0); m.set(key, c); return c;
  },

  // find the open water cells round the view; returns whether there are any (and sets on)
  scan(R, ox, oy, vw, vh) {
    // the box snaps to a 128 world px grid, so the mask, depth and foam edge below are rebuilt only when the view crosses a grid line, not every frame of a fast flight
    const T = R.T, A = R.ART, m = this.M * A, G = 128, bx = Math.floor((ox - m) / G) * G, by = Math.floor((oy - m) / G) * G, bw = Math.ceil((ox + vw + m) / G) * G - bx, bh = Math.ceil((oy + vh + m) / G) * G - by;
    const c0 = Math.floor(bx / T), c1 = Math.floor((bx + bw - 1) / T), r0 = Math.floor(by / T), r1 = Math.floor((by + bh - 1) / T), cells = this.cells || (this.cells = []);
    cells.length = 0; this.rp.length = 0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.open(c, r)) cells.push(c, r);
    this.box = [bx, by, bw, bh]; return this.on = cells.length > 0;
  },

  // the world y of the waterline for a sprite drawn at (dx, dy, dw, dh) whose foot (ADVR.rf) is in open water at ground level, else 0. Cut 42% of the way up its opaque body.
  line(im, sx, sy, sw, sh, dx, dy, dw, dh) {
    const rf = ADVR.rf; if (!rf || rf.ring || Math.abs(rf[1]) > 1) return 0;
    const x = dx + dw / 2, T = ADV.Tp(x); if (!this.open(Math.floor(x / T), Math.floor(rf[0] / T))) return 0;
    const hs = ADVR.hard(im, sx, sy, sw, sh); if (hs.bot < 0) return 0;
    const k = dh / sh, top = dy + hs.top * k, bot = dy + (hs.bot + 1) * k; return ADVR.q(bot - (bot - top) * 0.42);
  },
  // the half-width (world px) of a sprite's body on its waterline row, for the ring round it
  waist(im, sx, sy, sw, sh, dy, dh, wl) {
    const hs = ADVR.hard(im, sx, sy, sw, sh), k = dh / sh, row = clamp(Math.floor((wl - dy) / k), 0, sh - 1); let l = sw, r = -1;
    for (let x = 0; x < sw; x++) if (hs.u[row * sw + x]) { if (x < l) l = x; r = x; }
    return r < l ? sw * k / 4 : (r - l + 1) * k / 2;
  },
  // a pixel ellipse outline (art px dots) round (x, y) world px; half: -1 the back (upper) half only, 1 the front, 0 all
  ring(g, x, y, rx, ry, half) {
    const A = ADVR.ART, ax = Math.round(rx / A), ay = Math.max(1, Math.round(ry / A)), seen = new Set(), N = 8 * (ax + ay);
    x = ADVR.q(x); y = ADVR.q(y);
    for (let i = 0; i < N; i++) {
      const a = i / N * 6.2832, px = Math.round(Math.cos(a) * ax), py = Math.round(Math.sin(a) * ay), key = px * 1000 + py;
      if (seen.has(key) || half < 0 && py > 0 || half > 0 && py <= 0) continue; seen.add(key); g.fillRect(x + px * A, y + py * A, A, A);
    }
  },
  // drawFrame for a submerged sprite: the back of the ring, the body above the waterline (draw() = the normal draw, clipped), the part under it faint, the front of the ring
  sub(g, im, sx, sy, sw, sh, dx, dy, dw, dh, wl, draw) {
    const t = ADVR.t, w = this.waist(im, sx, sy, sw, sh, dy, dh, wl) + 4 + (Math.floor(t * 2.5) % 2) * 2, cx = dx + dw / 2, a = g.globalAlpha;
    g.fillStyle = 'rgba(232,246,255,0.7)'; this.ring(g, cx, wl, w, Math.max(4, w * 0.36), -1);
    g.save(); g.beginPath(); g.rect(dx - 4, dy - 4, dw + 8, wl - dy + 4); g.clip(); draw(); g.restore();
    g.save(); g.beginPath(); g.rect(dx - 4, wl, dw + 8, dy + dh - wl + 4); g.clip(); g.globalAlpha = a * 0.3; g.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); g.restore(); g.globalAlpha = a;
    g.fillStyle = 'rgba(232,246,255,0.8)'; this.ring(g, cx, wl, w, Math.max(4, w * 0.36), 1);
  },
  ripple(x, y, rx) { if (ADVR.rec) this.rp.push([x, y, rx]); },   // a raft (or anything not drawn as a sprite) spreads rings this frame

  sky(h) {
    const S = this.SKY; let i = 0; while (i < S.length - 2 && S[i + 1][0] <= h) i++;
    const [h0, a] = S[i], [h1, b] = S[i + 1], f = clamp((h - h0) / (h1 - h0), 0, 1); let c = a.map((v, j) => v + (b[j] - v) * f);
    const W = typeof ADVWX !== 'undefined' ? ADVWX.cur : null, G = W && this.GREY[W.kind];
    if (G) c = c.map((v, j) => v + (G[j] * (c[0] + c[1] + c[2]) / 470 - v) * W.k * 0.8);   // an overcast sky keeps the hour's brightness
    return c.map(Math.round);
  },

  // after the ground pass: depth, reflections, glints, foam and ripples on every open water pixel in view. rec = the recorded sprites [im, sx, sy, sw, sh, dx, dy, dw, dh, foot y, z, waterline]
  under(g, R, rec, t) {
    const A = R.ART, T = R.T, S = R.S, [bx, by, bw, bh] = this.box, W = bw / A, H = bh / A, cells = this.cells, fr = R.frame;
    const set = k => k.setTransform(1 / A, 0, 0, 1 / A, -bx / A, -by / A);
    // mask and depth only change with the box, the water frame or the cells loaded: kept until one does
    const dkey = [bx, by, W, H, cells.length, cells[0], cells[1]].join(), key = dkey + ',' + fr, fresh = key !== this.mkey, dfresh = dkey !== this.dkey; this.mkey = key; this.dkey = dkey;   // depth ignores the water frame
    const M = fresh ? this.cv('mc', W, H) : this.mc.getContext('2d'); let def0 = fresh ? null : this.def0, rmin = fresh ? Infinity : this.rr[0], rmax = fresh ? -Infinity : this.rr[1];
    if (fresh) { set(M);
    for (let i = 0; i < cells.length; i += 2) {
      const c = cells[i], r = cells[i + 1], ch = ADV.chunkAt(c, r), j = (r & 31) * 32 + (c & 31), def = ADV.defOf(ADV.palette[ch.mat[j]]); if (!def) continue;
      const mt = this.tmask(def, ADV.frameId(def, ch.role[j], ch.tile[j], fr)); if (!mt) continue; def0 = def0 || def; if (r < rmin) rmin = r; if (r > rmax) rmax = r;
      const z = 32 * (S === 1 ? 1 : S * (def.density ?? ADV.originOf(def).density ?? 1)), n = Math.max(1, Math.round(T / z));
      for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) M.drawImage(mt, c * T + u * z, r * T + v * z, z, z);
    }
    M.setTransform(1, 0, 0, 1, 0, 0); this.def0 = def0; this.rr = [rmin, rmax]; }
    if (!def0) return;
    if (fresh) for (const k of [1, 2]) {   // the shore band (mask minus the mask eroded k px), kept with the mask
      const X = this.cv('xc', W, H), E = this.cv('fe' + k, W, H);
      X.drawImage(M.canvas, 0, 0); X.globalCompositeOperation = 'destination-in';
      for (const [u, v] of [[k, 0], [-k, 0], [0, k], [0, -k]]) X.drawImage(M.canvas, u, v);
      E.drawImage(M.canvas, 0, 0); E.globalCompositeOperation = 'destination-out'; E.drawImage(X.canvas, 0, 0); E.globalCompositeOperation = 'source-over';
    }
    const lo = R.zmW && R.zmW < R.zm, P = this.pal(def0), lit = lo ? 0 : R.sun ? R.sun.a / 0.34 : 0, hr = ADVW.hour(), night = R.dark ? R.dark.a : 0;
    // depth: the mask on a half-res grid, eroded 1 cell (2 art px) a step; 4 steps = the mid band, 10 = the deep band
    if (dfresh) {
    const w2 = Math.ceil(W / 2), h2 = Math.ceil(H / 2), E = this.cv('ec', w2, h2), Q = this.cv('qc', w2, h2);
    E.drawImage(M.canvas, 0, 0, W, H, 0, 0, w2, h2);
    const D = this.cv('dc', W, H); let Z = null;
    for (let s = 1; s <= 10; s++) {
      Q.clearRect(0, 0, w2, h2); Q.drawImage(E.canvas, 0, 0); E.globalCompositeOperation = 'destination-in';
      for (const [u, v] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) E.drawImage(Q.canvas, u, v);
      E.globalCompositeOperation = 'source-over';
      if (s === 3 || s === 9) { Z = this.cv('zc', w2, h2); Z.drawImage(E.canvas, 0, 0); }
      if (s === 4 || s === 10) {   // the last ring before the band goes in on a checker, so each band edge is dithered
        Z.globalCompositeOperation = 'destination-out'; Z.drawImage(E.canvas, 0, 0); Z.globalCompositeOperation = 'destination-in'; Z.fillStyle = this.checker(); Z.fillRect(0, 0, w2, h2);
        D.globalAlpha = 0.5; D.drawImage(Z.canvas, 0, 0, w2, h2, 0, 0, w2 * 2, h2 * 2); D.drawImage(E.canvas, 0, 0, w2, h2, 0, 0, w2 * 2, h2 * 2);
      }
    }
    D.globalAlpha = 1; D.globalCompositeOperation = 'source-in'; D.fillStyle = 'rgb(8,26,64)'; D.fillRect(0, 0, W, H); D.globalCompositeOperation = 'destination-in'; D.drawImage(M.canvas, 0, 0);
    }
    const sk = this.sky(hr);
    if (lo) {   // the ground zoomed out under a flier: depth, the sky's tint and a still foam line baked into one layer, rebuilt only with the mask or the sky colour
      const lk = key + sk; if (this.lokey !== lk) { this.lokey = lk;
        const O = this.cv('loc', W, H), X = this.cv('xc', W, H), c = sk.map((v, j) => Math.round(v * 0.65 + +P.rgb.split(',')[j] * 0.35));
        O.globalAlpha = 0.24; O.drawImage(this.dc, 0, 0);
        X.drawImage(M.canvas, 0, 0); X.globalCompositeOperation = 'source-in'; X.fillStyle = `rgb(${c})`; X.fillRect(0, 0, W, H); O.globalAlpha = 0.2; O.drawImage(X.canvas, 0, 0);
        const F = this.cv('fc', W, H); F.drawImage(this.fe1 || M.canvas, 0, 0); F.globalCompositeOperation = 'source-in'; F.fillStyle = 'rgba(240,250,255,0.6)'; F.fillRect(0, 0, W, H); O.globalAlpha = 1; O.drawImage(F.canvas, 0, 0);
      }
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); R.di.call(g, this.loc, (bx - R.view.ox) / A, (by - R.view.oy) / A); g.restore(); return;
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.24; R.di.call(g, this.dc, (bx - R.view.ox) / A, (by - R.view.oy) / A); g.restore();   // the bands stack: 0.12 mid, 0.18 deep

    // reflections
    const L = this.cv('rc', W, H);
    L.globalAlpha = 0.45; L.fillStyle = `rgb(${sk})`; L.fillRect(0, 0, W, H); L.globalAlpha = 1;
    const cl = this.clouds(), cs = cl.width, wk = typeof ADVWX !== 'undefined' ? ADVWX.cur : { kind: '', k: 0 }, cov = wk.kind === 'cloudy' || wk.kind === 'rain' || wk.kind === 'storm' ? 0.4 + 0.6 * wk.k : 0.4;
    L.globalAlpha = Math.round(cov * (1 - night) * 8) / 8; const sx0 = Math.floor(t * 3.5), sy0 = Math.floor(t * 0.9), ax = bx / A, ay = by / A;
    for (let j = Math.floor((ay - sy0) / cs); j * cs + sy0 < ay + H; j++) for (let i = Math.floor((ax - sx0) / cs); i * cs + sx0 < ax + W; i++) L.drawImage(cl, i * cs + sx0 - ax, j * cs + sy0 - ay);
    L.globalAlpha = 1;
    const y0 = rmin * T, y1 = (rmax + 1) * T, sh0 = R.shade; R.shade = 0;   // only things whose mirror image can reach the water rows
    if (!lo) for (const ch of ADV.chunks.values()) for (const p of ch.props) {
      const def = ADV.propDef(p.n); if (!def || p.b && p.b.k > 2) continue; const K = ADV.dk(def, p.x), hgt = def.ay * K + p.z;
      if (p.y > y1 || p.y + hgt < y0 || p.x + def.sw * K < bx || p.x - def.sw * K > bx + bw) continue;
      L.setTransform(1 / A, 0, 0, -1 / A, -bx / A, (2 * p.y - by) / A); R.propFn(p, def)(L);
    }
    R.shade = sh0;
    if (!lo) for (const [im, sx, sy, sw, sh, dx, dy, dw, dh, Y, , wl] of rec) {
      const m = wl || Y; if (m > y1 || 2 * m - dy < y0) continue;
      L.save(); L.setTransform(1 / A, 0, 0, -1 / A, -bx / A, (2 * m - by) / A); if (wl) { L.beginPath(); L.rect(dx - 4, dy - 4, dw + 8, wl - dy + 4); L.clip(); }
      L.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); L.restore();
    }
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-atop'; L.globalAlpha = 0.35; L.fillStyle = `rgb(${P.rgb})`; L.fillRect(0, 0, W, H); L.globalAlpha = 1;
    // the wobble: whole art rows shift 0 or 1 px sideways in a slow world-anchored wave, then only the water keeps it
    const V = this.cv('vc', W, H), ry0 = Math.max(0, Math.floor((y0 - by) / A)), ry1 = Math.min(H, Math.ceil((y1 - by) / A));
    if (lo) V.drawImage(L.canvas, 0, 0); else for (let j = ry0; j < ry1; j++) V.drawImage(L.canvas, 0, j, W, 1, Math.round(Math.sin((j + ay) * 0.5 + t * 2.2) * 1.2), j, W, 1);
    V.globalCompositeOperation = 'destination-in'; V.drawImage(M.canvas, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.45; R.di.call(g, V.canvas, (bx - R.view.ox) / A, (by - R.view.oy) / A); g.restore();

    // foam, ripples and glints into one layer, then cut to the water
    const F = this.cv('fc', W, H), thick = 1 + (Math.floor(t * 1.6) & 1);
    F.drawImage(this['fe' + thick], 0, 0); F.globalCompositeOperation = 'destination-in'; F.fillStyle = this.dither(); F.setTransform(1, 0, 0, 1, -((Math.floor(ax) + Math.floor(t * 3)) & 7), -(Math.floor(ay) & 7)); F.fillRect(0, 0, W + 8, H + 8);
    F.setTransform(1, 0, 0, 1, 0, 0); F.globalCompositeOperation = 'source-in'; F.fillStyle = 'rgba(240,250,255,0.8)'; F.fillRect(0, 0, W, H); F.globalCompositeOperation = 'source-over';
    set(F); F.fillStyle = 'rgba(232,246,255,0.75)';
    const src = rec.filter(e => e[11]).map(e => [e[5] + e[7] / 2, e[11], this.waist(e[0], e[1], e[2], e[3], e[4], e[6], e[8], e[11]) + 4]).concat(this.rp);
    if (!lo) for (const [x, y, w] of src) for (let i = 0; i < 2; i++) {
      const f = (t * 0.7 + i / 2) % 1, rx = w + 6 + f * 26; F.globalAlpha = f < 0.5 ? 0.75 : f < 0.8 ? 0.45 : 0.2; this.ring(F, x, y, rx, rx * 0.36, 0);
    }
    F.globalAlpha = 1;
    if (lit > 0.2) {   // sun glints: a world-anchored 6 art px lattice; a few points twinkle (dot, plus, dot) on water away from the shore
      const warm = Math.abs(hr - 12.75) > 4.5, G = 12, gc0 = Math.floor(bx / G), gr0 = Math.floor(by / G);
      F.fillStyle = warm ? 'rgba(255,226,160,0.95)' : 'rgba(255,255,255,0.95)';
      for (let gy = gr0; gy * G < by + bh; gy++) for (let gx = gc0; gx * G < bx + bw; gx++) {
        const h = ADVWX.hs(gx, gy, 5); if (h > 0.035 * Math.min(1, lit)) continue;
        const st = (Math.floor(t * 4 + ADVWX.hs(gx, gy, 9) * 40)) % 10, x = gx * G + 4, y = gy * G + 4, c = Math.floor(x / T), r = Math.floor(y / T);
        if (st > 2 || !this.open(c, r) || !this.open(c - 1, r) || !this.open(c + 1, r) || !this.open(c, r - 1) || !this.open(c, r + 1)) continue;
        F.fillRect(x, y, A, A); if (st === 1) { F.fillRect(x - A, y, A, A); F.fillRect(x + A, y, A, A); F.fillRect(x, y - A, A, A); F.fillRect(x, y + A, A, A); }
      }
    }
    F.setTransform(1, 0, 0, 1, 0, 0); F.globalCompositeOperation = 'destination-in'; F.drawImage(M.canvas, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); R.di.call(g, F.canvas, (bx - R.view.ox) / A, (by - R.view.oy) / A); g.restore();
  },

  // after the dark veil: every warm or coloured light near the water lays a broken vertical streak of its colour on it, centred on its mirror image (lights carry fy, the foot of the prop)
  lamps(g, R, t) {
    const D = R.dark; if (!this.on || !D || D.a < 0.2 || !this.mc) return;
    const A = R.ART, [bx, by] = this.box, W = this.mc.width, H = this.mc.height, K = this.cv('lc', W, H); let any = false;
    K.setTransform(1 / A, 0, 0, 1 / A, -bx / A, -by / A);
    for (const L of D.lights) {
      if (!(L.warm || L.col) || L.fy == null) continue; const my = 2 * L.fy - L.y, len = Math.max(40, L.r * 0.6), col = L.col || '255,170,90';
      for (let j = -len; j <= len; j += A) {
        const f = 1 - Math.abs(j) / len, w = Math.round((3 + 4 * f) * (0.6 + 0.4 * ADVWX.hs(Math.round((my + j) / A), 3, Math.floor(t * 3)))) * A, o = Math.round(Math.sin((my + j) / A * 0.5 + t * 2.2) * 1.2) * A;
        K.fillStyle = `rgba(${col},${Math.round(f * 0.9 * 8) / 8})`; K.fillRect(ADVR.q(L.x) - w / 2 + o, ADVR.q(my + j), w, A);
      }
      any = true;
    }
    if (!any) return;
    K.setTransform(1, 0, 0, 1, 0, 0); K.globalCompositeOperation = 'destination-in'; K.drawImage(this.mc, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; R.di.call(g, K.canvas, (bx - R.view.ox) / A, (by - R.view.oy) / A); g.restore();
  },

  clouds() { return this.cl || (this.cl = ADVWX.band(256, 64, 11, 0.42, 0.3, '255,255,255', [0, 0.35, 0.6, 0.85])); },   // the sky's clouds as seen in the water, white
  checker() {   // 2 x 2: one diagonal on (the box is on an 8 world px grid, so the checker never crawls)
    if (this.ck) return this.ck; const c = document.createElement('canvas'); c.width = c.height = 2; const k = c.getContext('2d'); k.fillStyle = '#fff'; k.fillRect(0, 0, 1, 1); k.fillRect(1, 1, 1, 1);
    return this.ck = k.createPattern(c, 'repeat');
  },
  dither() {   // an 8 x 8 tile with about 60% of its px on, for broken foam
    if (this.dp) return this.dp; const c = document.createElement('canvas'); c.width = c.height = 8; const k = c.getContext('2d'); k.fillStyle = '#fff';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (ADVWX.hs(x, y, 77) < 0.6) k.fillRect(x, y, 1, 1);
    return this.dp = k.createPattern(c, 'repeat');
  },
};
