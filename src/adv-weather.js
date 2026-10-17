// Adventure overworld weather (outdoors only; caves and rooms are always clear). adv-scene.js calls update() once a frame and adv-render.js calls drawShade / drawFx at the marked points of its pass.
// Weather is deterministic: one roll per quarter of the world per 20 game hour slot (20 real minutes), so a front covers many zones and every player sees the same sky without a network message;
// each zone turns that shared roll into a kind through its own table (coast rainier, desert sandy). Kinds ease out and in over about 3 real seconds.
// All of it is pure pixel art: stepped alpha bands with a 1 art px checker dither (the house technique, see ADVR.steps), sprites and rects snapped to whole art px (1 art px = 2 world px), no gradients, no blur.
'use strict';
const ADVWX = {
  KINDS: ['', 'cloudy', 'rain', 'storm', 'fog', 'snow', 'sand'],
  SLOT: 20, FADE: 1.5,   // game hours (real minutes) per weather slot; seconds to fade the old kind out, and again to fade the new one in
  cur: { kind: '', k: 0 },   // the blended weather now: k is 0..1 strength
  DEF: [46, 26, 16, 5, 7, 0, 0],   // weights in KINDS order: clear cloudy rain storm fog snow sand (routes and towns)
  // per zone weights. Fog is tripled in a slot that starts between 4:00 and 10:00 and 1.5x one starting between 0:00 and 4:00 (mornings). Snow zones never rain, desert zones never rain.
  TABLE: (() => {
    const T = {}, put = (w, ...ids) => ids.forEach(id => { T[id] = w; });
    put([32, 22, 22, 7, 17, 0, 0], 'saltbay', 'longshore', 'sailsport', 'route6', 'route9', 'route24', 'route133', 'route104', 'statueofumbra', 'fernwellsanctuary', 'quietplain', 'spindlewood');   // coast: rainier, foggier
    put([26, 18, 18, 5, 33, 0, 0], 'sporehaven', 'route2', 'route101', 'duskmoss');   // glowing fungal zones and marsh: fog is common
    put([34, 18, 0, 0, 12, 36, 0], 'sprucevale', 'route16', 'route17', 'route18', 'route19', 'route20', 'route21', 'pokemonleague');   // snowfield
    put([26, 14, 0, 0, 10, 50, 0], 'frostfall');
    put([60, 12, 0, 0, 0, 0, 28], 'dunereach', 'route15');   // desert
    put([50, 20, 6, 0, 3, 0, 21], 'route121');   // desert fringe
    return T;
  })(),
  // how each kind changes the light (light()): sun = multiplier on the sun-shadow alpha, veil = extra darkness alpha, tint = its colour, lamps = how strongly lamps should glow from weather alone
  LIGHT: {
    cloudy: { sun: 0.55, veil: 0.03, tint: '20,26,50', lamps: 0.1 }, rain: { sun: 0.25, veil: 0.16, tint: '12,22,50', lamps: 0.55 }, storm: { sun: 0.1, veil: 0.3, tint: '8,12,34', lamps: 0.85 },
    fog: { sun: 0.55, veil: 0.03, tint: '172,182,198', lamps: 0.2 }, snow: { sun: 0.4, veil: 0.05, tint: '70,90,130', lamps: 0.25 }, sand: { sun: 0.3, veil: 0.12, tint: '112,78,32', lamps: 0.25 },
  },
  BAYER: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],

  // state
  t0: 0, pt: 0, lin: 0, ready: false, key: '', auto: '', zone: '', tx: {}, fl: -1, nf: 0, bolt: null, sacc: 0,

  // ---------- picking the weather ----------
  rand(zone, slot) {   // a stable number in 0..1 from (zone, slot)
    let h = 2166136261; for (let i = 0; i < zone.length; i++) h = Math.imul(h ^ zone.charCodeAt(i), 16777619);
    h = Math.imul(h ^ (slot | 0), 2246822519); h ^= h >>> 15; h = Math.imul(h, 3266489917); h ^= h >>> 13; return (h >>> 0) / 4294967296;
  },
  kindFor(zone, slot, reg) {
    const w = this.TABLE[zone] || this.DEF, h = ((slot * this.SLOT) % 24 + 24) % 24, f = h >= 4 && h < 10 ? 3 : h < 4 ? 1.5 : 1;
    let tot = 0; for (let i = 0; i < 7; i++) tot += i === 4 ? w[i] * f : w[i];
    let r = this.rand(reg, slot) * tot;
    for (let i = 0; i < 7; i++) { r -= i === 4 ? w[i] * f : w[i]; if (r < 0) return this.KINDS[i]; }
    return '';
  },
  // t = scene seconds, (x, y) = the player's world px: pick the kind at the player's zone and ease toward it (the old kind fades out, then the new one in)
  update(t, x, y) {
    const dt = Math.min(0.1, Math.max(0, t - this.t0)), c = this.cur; this.t0 = t;
    let want = ''; const z = this.zone = ADVW.zone(x, y) || '';
    if (ADV.S(x) === ADV.OUT) {
      const pin = ADVW.weather;   // the test panel pins a kind; null or undefined = automatic
      if (pin != null) want = this.KINDS.includes(pin) ? pin : '';
      else {
        const slot = Math.floor((ADVW.totalHours ? ADVW.totalHours() : ADVW.hour()) / this.SLOT), W = ADV.world, span = W ? ADV.Tp(x) * ADV.CH : 1;
        const reg = W ? 'q' + Math.floor(x / span / (W.chunksW / 2)) + Math.floor(y / span / (W.chunksH / 2)) : z, key = z + '|' + reg + '|' + slot;   // reg: the quarter of the world the player is in
        if (key !== this.key) { this.key = key; this.auto = this.kindFor(z, slot, reg); }
        want = this.auto;
      }
    }
    if (!this.ready) { this.ready = true; c.kind = want; this.lin = want ? 1 : 0; }
    else if (c.kind !== want) { this.lin -= dt / this.FADE; if (this.lin <= 0) { this.lin = 0; c.kind = want; } }
    else if (want) this.lin = Math.min(1, this.lin + dt / this.FADE);
    c.k = c.kind ? this.lin * this.lin * (3 - 2 * this.lin) : 0;
  },
  light() {   // one shared object, refreshed on every call
    const c = this.cur, L = this.LIGHT[c.kind], o = this.lt || (this.lt = { sun: 1, veil: 0, tint: '14,6,34', lamps: 0 });
    if (!L || c.k <= 0) { o.sun = 1; o.veil = 0; o.tint = '14,6,34'; o.lamps = 0; return o; }
    o.sun = 1 + (L.sun - 1) * c.k; o.veil = L.veil * c.k; o.tint = L.tint; o.lamps = L.lamps * c.k; return o;
  },

  // ---------- helpers ----------
  cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  hs(a, b, s = 0) { let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(s + 1, 83492791); h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; },
  q(a, n = 8) { return Math.ceil(a * n - 1e-6) / n; },   // alpha in steps of 1/n (never a smooth fade)
  // periodic value noise (size x size, lattice cell px): two octaves, tileable
  noise(size, cell, seed) {
    const out = new Float32Array(size * size);
    for (let o = 0; o < 2; o++) {
      const cs = cell >> o, n = size / cs, L = new Float32Array(n * n); let s = (seed + o * 7919) | 0;
      for (let i = 0; i < L.length; i++) { s = Math.imul(s ^ (s >>> 15), 2246822519) + 374761393 | 0; L[i] = ((s >>> 0) % 10007) / 10007; }
      const w = o ? 0.35 : 0.65;
      for (let y = 0; y < size; y++) {
        const gy = y / cs, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy), r0 = (y0 % n) * n, r1 = ((y0 + 1) % n) * n;
        for (let x = 0; x < size; x++) {
          const gx = x / cs, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx), xa = x0 % n, xb = (x0 + 1) % n;
          const a = L[r0 + xa] + (L[r0 + xb] - L[r0 + xa]) * sx, b = L[r1 + xa] + (L[r1 + xb] - L[r1 + xa]) * sx;
          out[y * size + x] += (a + (b - a) * sy) * w;
        }
      }
    }
    return out;
  },
  // a tileable cloud-like texture of 3 stepped alpha levels; the upper half of each band dithers into the next on a 1 art px checker. Returns the canvas; lv = the level map (0 = open gap)
  band(size, cell, seed, lo, span, rgb, al) {
    const v = this.noise(size, cell, seed), c = this.cv(size, size), k = c.getContext('2d'), id = k.createImageData(size, size), u = new Uint32Array(id.data.buffer), lv = new Uint8Array(size * size);
    const [r, g, b] = rgb.split(',').map(Number), px = al.map(a => ((Math.round(a * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const s = Math.min(1, Math.max(0, (v[y * size + x] - lo) / span)) * 3; let l = Math.floor(s);
      if (l < 3 && s - l > 0.5 && ((x + y) & 1) === 0) l++;
      lv[y * size + x] = l; u[y * size + x] = l ? px[l] : 0;
    }
    k.putImageData(id, 0, 0); c.lv = lv; return c;
  },
  tex(name) {
    const T = this.tx; if (T[name]) return T[name];
    if (name === 'cloud') {
      return T.cloud = this.band(384, 96, 11, 0.4, 0.3, '14,20,46', [0, 0.12, 0.22, 0.32]);
    }
    if (name === 'fog') return T.fog = this.band(256, 64, 23, 0.3, 0.3, '218,226,236', [0, 0.14, 0.24, 0.34]);
    if (name === 'haze') return T.haze = this.band(256, 64, 37, 0.26, 0.28, '214,170,100', [0, 0.2, 0.34, 0.48]);
    if (name === 'gust') {   // one dithered gust streak, dense in the middle and scattered at both ends (the battle sandstorm's)
      const W = 120, H = 8, c = this.cv(W, H), k = c.getContext('2d'), id = k.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = Math.sin(x / W * Math.PI) * (1 - Math.abs(y - (H - 1) / 2) / (H / 2)), l = Math.floor(v * 3 + (this.BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16);
        if (l > 0) { const i = (y * W + x) * 4; id.data[i] = 214; id.data[i + 1] = 178; id.data[i + 2] = 110; id.data[i + 3] = l >= 3 ? 210 : l === 2 ? 150 : 90; }
      }
      k.putImageData(id, 0, 0); return T.gust = c;
    }
    // small sprites: [width, height, [[x, y, w, h, colour]...]]
    const S = {
      rainN: this.streak(10, 2, 'rgba(225,238,255,0.9)', '#fff'), rainF: this.streak(5, 1, 'rgba(170,200,245,0.55)', null),
      stormN: this.streak(12, 4, 'rgba(200,218,250,0.9)', '#fff'), stormF: this.streak(6, 2, 'rgba(150,180,235,0.55)', null),
    }, px = (w, h, a) => { const c = this.cv(w, h), k = c.getContext('2d'); for (const [x, y, col] of a) { k.fillStyle = col; k.fillRect(x, y, 1, 1); } return c; };
    const sp = 'rgba(220,235,255,0.85)', sq = 'rgba(190,215,250,0.55)', rp = 'rgba(205,228,255,0.9)', rq = 'rgba(160,195,245,0.6)';
    S.sp0 = px(3, 2, [[1, 0, sp], [0, 1, sp], [1, 1, sp], [2, 1, sp]]); S.sp1 = px(5, 2, [[0, 1, sp], [4, 1, sp], [1, 0, sp], [3, 0, sp]]); S.sp2 = px(7, 2, [[0, 1, sq], [6, 1, sq], [1, 0, sq], [5, 0, sq]]);
    S.rp0 = px(3, 1, [[0, 0, rp], [1, 0, rp], [2, 0, rp]]);
    S.rp1 = px(5, 3, [[1, 0, rp], [2, 0, rp], [3, 0, rp], [0, 1, rp], [4, 1, rp], [1, 2, rp], [2, 2, rp], [3, 2, rp]]);
    S.rp2 = px(9, 5, [[2, 0, rq], [3, 0, rq], [4, 0, rq], [5, 0, rq], [6, 0, rq], [1, 1, rq], [7, 1, rq], [0, 2, rq], [8, 2, rq], [1, 3, rq], [7, 3, rq], [2, 4, rq], [3, 4, rq], [4, 4, rq], [5, 4, rq], [6, 4, rq]]);
    return Object.assign(T, S)[name];
  },
  streak(len, slant, col, head) {   // a raindrop: a pixel line slanting left going down, with a white head pixel pair at the leading end
    const c = this.cv(slant + 1, len), k = c.getContext('2d');
    for (let j = 0; j < len; j++) { k.fillStyle = head && j >= len - 2 ? head : col; k.fillRect(Math.round(slant * (len - 1 - j) / (len - 1)), j, 1, 1); }
    return c;
  },

  // ---------- cloud shadows ----------
  // big stepped shadows drifting over the ground and everything on it (drawn after the sorted world pass); ox, oy = view origin in art px
  drawShade(g, view, t) {
    const c = this.cur; if (c.kind !== 'cloudy' || c.k < 0.04 || ADV.S(view.ox + view.vw / 2) !== ADV.OUT) return;
    const tx = this.tex('cloud'), S = tx.width, DI = CanvasRenderingContext2D.prototype.drawImage, sx = Math.floor(t * 3.5), sy = Math.floor(t * 0.9), oxa = view.ox / 2, oya = view.oy / 2;
    g.globalAlpha = this.q(c.k);
    for (let j = Math.floor((oya - sy) / S); j * S + sy < oya + view.vh / 2; j++) for (let i = Math.floor((oxa - sx) / S); i * S + sx < oxa + view.vw / 2; i++) DI.call(g, tx, 0, 0, S, S, (i * S + sx) * 2, (j * S + sy) * 2, S * 2, S * 2);
    g.globalAlpha = 1;
  },

  // ---------- rain, snow, sand, fog, lightning ----------
  pool() {
    if (this.px) return; const N = 900; this.px = new Float32Array(N); this.py = new Float32Array(N); this.ps = new Float32Array(N); this.pc = new Uint8Array(N);
    for (let i = 0; i < N; i++) { this.px[i] = Math.random() * 1920; this.py[i] = Math.random() * 1080; this.ps[i] = 0.8 + Math.random() * 0.4; const m = i % 10; this.pc[i] = m < 4 ? 0 : m < 7 ? 1 : 2; }
    this.sx = new Float32Array(96); this.sy = new Float32Array(96); this.sa = new Float32Array(96); this.sk = new Uint8Array(96); this.sn = 0;
  },
  // two scrolling cloud-like layers of fog (or haze), world-fixed so they slide with the ground
  layers(g, DI, view, t, name, vx, vy, a) {
    const tx = this.tex(name), S = tx.width, oxa = view.ox / 2, oya = view.oy / 2; g.globalAlpha = this.q(a);
    for (let L = 0; L < 2; L++) {
      const sx = Math.floor(t * vx * (L ? -0.6 : 1)) + (L ? 97 : 0), sy = Math.floor(t * vy * (L ? 1.4 : 1)) + (L ? 61 : 0);
      for (let j = Math.floor((oya - sy) / S); j * S + sy < oya + view.vh / 2; j++) for (let i = Math.floor((oxa - sx) / S); i * S + sx < oxa + view.vw / 2; i++) DI.call(g, tx, 0, 0, S, S, (i * S + sx) * 2, (j * S + sy) * 2, S * 2, S * 2);
    }
    g.globalAlpha = 1;
  },
  drawFx(g, view, t) {
    const c = this.cur, dt = Math.min(0.1, Math.max(0, t - this.pt)); this.pt = t;
    if (c.kind !== 'storm') this.fl = -1;
    if (c.k < 0.02 || ADV.S(view.ox + view.vw / 2) !== ADV.OUT) return;
    this.pool();
    const P = CanvasRenderingContext2D.prototype, DI = P.drawImage, FR = P.fillRect, ox = view.ox, oy = view.oy, vwa = view.vw / 2, vha = view.vh / 2, area = vwa * vha, px = this.px, py = this.py, ps = this.ps, pc = this.pc, k = c.k;
    const wet = c.kind === 'rain' || c.kind === 'storm';
    if (c.kind === 'fog') this.layers(g, DI, view, t, 'fog', 1.6, 0.4, k * 0.45);   // a light haze: two layers at full strength buried the ground
    else if (c.kind === 'sand') {
      this.layers(g, DI, view, t, 'haze', 16, 1.5, k * 0.9);
      const gust = 0.5 + 0.5 * Math.sin(t * 0.5) * Math.sin(t * 0.23 + 1), gt = this.tex('gust'), nb = Math.max(4, Math.min(12, Math.round(vha / 45)));
      g.globalAlpha = this.q(k * (0.6 + 0.4 * gust));
      for (let i = 0; i < nb; i++) {
        const spd = 60 + i * 26 + gust * 90, x = Math.round(((t * spd + i * 211) % (vwa + 240)) - 120), y = Math.round(((i * 0.21 + 0.07 + Math.sin(t * 0.2 + i) * 0.03) % 1) * vha), m = 1 + i % 2;
        DI.call(g, gt, 0, 0, gt.width, gt.height, ox + x * 2, oy + y * 2, gt.width * m * 2, gt.height * (1 + (i >> 1) % 2) * 2);
      }
      g.globalAlpha = 1;
      const n = (Math.min(700, area / 200) * k) | 0, ww = vwa + 8, hh = vha + 8;
      for (let cl = 0; cl < 2; cl++) {
        g.fillStyle = cl ? 'rgba(232,200,130,0.85)' : 'rgba(205,168,100,0.65)';
        for (let i = 0; i < n; i++) {
          const s = ps[i]; if ((s > 1) !== (cl === 1)) continue;
          let x = px[i] + (110 + 120 * s + 160 * gust) * dt, y = py[i] + Math.sin(t * 2 + s * 20) * 6 * dt + 4 * s * dt;
          if (x > ww) { x -= ww + 8; y = Math.random() * hh; } if (y > hh) y -= hh; if (y < 0) y += hh;
          px[i] = x; py[i] = y; FR.call(g, ox + Math.round(x) * 2, oy + Math.round(y) * 2, s > 1 ? 10 : 6, 2);
        }
      }
    } else if (c.kind === 'snow') {
      const n = (Math.min(560, area / 520) * k) | 0, ww = vwa + 8, hh = vha + 8, wind = Math.sin(t * 0.3) * 6;
      for (let cl = 0; cl < 3; cl++) {
        g.fillStyle = cl === 0 ? 'rgba(222,234,255,0.75)' : '#fff';
        for (let i = 0; i < n; i++) {
          if (pc[i] !== cl) continue;
          let x = px[i] + (wind + Math.sin(t * 0.7 + i) * 8 - 4) * dt * (0.5 + cl * 0.4), y = py[i] + (12 + cl * 12) * ps[i] * dt;
          if (y > hh) { y -= hh; x = Math.random() * ww; } if (x < 0) x += ww; if (x > ww) x -= ww;
          px[i] = x; py[i] = y; const X = ox + Math.round(x) * 2, Y = oy + Math.round(y) * 2;
          if (cl === 0) FR.call(g, X, Y, 2, 2); else if (cl === 1) FR.call(g, X, Y, 4, 4); else { FR.call(g, X + 2, Y, 2, 6); FR.call(g, X, Y + 2, 6, 2); }
        }
      }
    } else if (wet) {
      const st = c.kind === 'storm', n = (Math.min(st ? 680 : 480, area / (st ? 250 : 420)) * k) | 0, near = this.tex(st ? 'stormN' : 'rainN'), far = this.tex(st ? 'stormF' : 'rainF');
      const rN = st ? 4 / 11 : 2 / 9, rF = st ? 2 / 5 : 1 / 4, vN = st ? 440 : 330, vF = st ? 330 : 250, ww = vwa + 24, hh = vha + 24;
      // ground first: splashes on dry ground, ripples on water cells, then the drops over them
      this.sacc += dt * k * area / (st ? 2600 : 4200);
      while (this.sacc >= 1 && this.sn < 96) {
        this.sacc -= 1; let ax = 0, ay = 0, w = 0;
        for (let tr = 0; tr < 3 && !w; tr++) { ax = Math.random() * vwa; ay = vha * (0.08 + Math.random() * 0.92); const wx = ox + ax * 2, T = ADV.Tp(wx); w = ADV.isWater(Math.floor(wx / T), Math.floor((oy + ay * 2) / T)) ? 1 : 0; }
        const i = this.sn++; this.sx[i] = ax; this.sy[i] = ay; this.sa[i] = 0; this.sk[i] = w;
      }
      this.sacc = Math.min(this.sacc, 3);
      for (let i = this.sn - 1; i >= 0; i--) {
        const life = this.sk[i] ? 0.9 : 0.3, a = this.sa[i] += dt;
        if (a >= life) { const l = --this.sn; this.sx[i] = this.sx[l]; this.sy[i] = this.sy[l]; this.sa[i] = this.sa[l]; this.sk[i] = this.sk[l]; continue; }
        const f = Math.floor(a / (life / 3)), im = this.tex((this.sk[i] ? 'rp' : 'sp') + f), cx = Math.round(this.sx[i]), cy = Math.round(this.sy[i]);
        DI.call(g, im, 0, 0, im.width, im.height, ox + (cx - (im.width >> 1)) * 2, oy + (cy - (im.height >> 1)) * 2, im.width * 2, im.height * 2);
      }
      for (let i = 0; i < n; i++) {
        const nr = i % 3 === 0, vy = (nr ? vN : vF) * ps[i];
        let x = px[i] - vy * (nr ? rN : rF) * dt, y = py[i] + vy * dt;
        if (y > hh) { y -= hh; x = Math.random() * ww; } if (x < -12) x += ww; if (x > ww) x -= ww;
        px[i] = x; py[i] = y; const im = nr ? near : far;
        DI.call(g, im, 0, 0, im.width, im.height, ox + (Math.round(x) - 12) * 2, oy + (Math.round(y) - 12) * 2, im.width * 2, im.height * 2);
      }
      if (st && k > 0.6) {   // lightning: a bolt and a stepped white flash, every 5 to 15 s
        if (this.fl < 0 && t >= this.nf) {
          if (this.nf === 0) this.nf = t + 2 + Math.random() * 4;
          else {
            this.fl = t; this.nf = t + 5 + Math.random() * 10; const rows = Math.floor(vha * (0.45 + Math.random() * 0.25)); let bx = vwa * (0.15 + Math.random() * 0.7);
            this.bolt = new Int16Array(rows); for (let j = 0; j < rows; j++) { this.bolt[j] = Math.round(bx); const r = Math.random(); bx += r < 0.25 ? -1 - (r < 0.06) * 2 : r < 0.5 ? 1 + (r > 0.44) * 2 : 0; }
          }
        }
        if (this.fl >= 0) {
          const e = t - this.fl, a = e < 0.07 ? 0.5 : e < 0.13 ? 0 : e < 0.22 ? 0.35 : e < 0.34 ? 0.14 : -1;
          if (a < 0) this.fl = -1;
          else {
            if (a > 0) { g.fillStyle = a >= 0.5 ? 'rgba(232,238,255,0.5)' : a >= 0.35 ? 'rgba(232,238,255,0.35)' : 'rgba(232,238,255,0.14)'; FR.call(g, ox, oy, view.vw, view.vh); }
            if (e < 0.22 && a > 0) { const b = this.bolt; g.fillStyle = 'rgba(190,200,255,0.5)'; for (let j = 0; j < b.length; j++) FR.call(g, ox + (b[j] - 1) * 2, oy + j * 2, 6, 2); g.fillStyle = '#fff'; for (let j = 0; j < b.length; j++) FR.call(g, ox + b[j] * 2, oy + j * 2, 2, 2); }
          }
        }
      }
    }
  },
};
