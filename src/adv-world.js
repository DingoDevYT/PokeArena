// Adventure world model: chunk store, heights, collision, autotiling, draw-order comparator.
// Pure logic (no DOM except the chunk loader) so tools/adv-check.mjs can run it in node.
'use strict';
const ADV = (() => {
  const T = 32, CH = 32, N = CH * CH;   // T = the art tile; a map draws it S times bigger (S = A.OUT outdoors, 1 in rooms and the cave), see S / Tp / Tc
  const ROLES = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW'];
  const STAIR = [null, [0, -1], [0, 1], [1, 0], [-1, 0]];                 // by kind 1..4: ascent direction
  const LEDGE = [null, null, null, null, null, [0, 1], [1, 0], [-1, 0]];  // by kind 5..7: drop direction
  const SIDES = { N: [[0, -1]], S: [[0, 1]], E: [[1, 0]], W: [[-1, 0]], NE: [[0, -1], [1, 0]], NW: [[0, -1], [-1, 0]], SE: [[0, 1], [1, 0]], SW: [[0, 1], [-1, 0]], iNE: [[1, -1]], iNW: [[-1, -1]], iSE: [[1, 1]], iSW: [[-1, 1]] };   // the neighbours an edge role faces
  const hash = (c, r) => (Math.imul(c, 73856093) ^ Math.imul(r, 19349663)) >>> 0;
  const key = (cx, cy) => (cx + 512) * 1024 + (cy + 512);
  const rle = s => { const o = []; for (const t of s.split(',')) { const i = t.indexOf('x'); if (i < 0) o.push(+t); else for (let k = +t.slice(i + 1), v = +t.slice(0, i); k > 0; k--) o.push(v); } return o; };   // "12x3,5" = 12, 12, 12, 5
  const unrle = a => typeof a === 'string' ? rle(a) : a;
  const stairT = (k, fx, fy) => { const s = STAIR[k]; return s[0] ? (s[0] > 0 ? fx : 1 - fx) : (s[1] > 0 ? fy : 1 - fy); };

  const A = {
    CH, ROLES, STAIR, LEDGE, key, rle: unrle,
    // ---------- map scale ----------
    // The outdoor world is drawn OUT times bigger than its data (exterior art is 1x HD, characters are drawn at 2 world px per art px), rooms and the cave keep scale 1 (interior art is already 2x).
    // Data stays in its authored units (px at scale 1); chunk props and the world's px fields are multiplied on load. Rooms live at x >= EDGE px, outdoors below it, so the scale follows the position.
    OUT: 2, EDGE: 204800,
    get T() { return T * this.OUT; },   // the outdoor tile in world px (64); anything with a position asks Tp(x)
    S(x) { return x < this.EDGE ? this.OUT : 1; },
    Tp(x) { return T * this.S(x); },
    // world px per sheet px for a def at x: density (art px per sheet px, 1 = HD art, 0.5 = clean 2x pixel art, from the def or its sheet) times the map scale outdoors, 1 in rooms (the interior sheet draws 1:1 there)
    dk(def, x) { const s = this.S(x); return s === 1 ? 1 : s * (def.density ?? this.origin.get(def)?.density ?? 1); },
    Tc(c) { return T * (c * T * this.OUT < this.EDGE ? this.OUT : 1); },   // tile size of cell column c
    // world.js px fields (spawn, towns, doors, wild) multiplied once; the generator output stays as it is
    scaleWorld(w = typeof window !== 'undefined' && window.ADV_WORLD) {
      if (!w || w.px) return; const k = this.OUT, s = o => { if (o) { o.x *= k; o.y *= k; } };
      s(w.spawn); (w.wild || []).forEach(s); for (const t of Object.values(w.towns || {})) { s(t); s(t.center); } (w.doors || []).forEach(s); w.px = k;
    },
    chunks: new Map(), pending: {}, missing: {}, world: null, fallback: false, swim: false, live: [], roomK: new Set(), blds: [], bldById: new Map(), bk: new Map(),   // swim: the player is surfing on water right now (the fight box then treats water as floor)
    palette: ['void', 'grass', 'path', 'sand', 'water', 'tallgrass'],
    ts() { const w = typeof window !== 'undefined' ? window : {}; return this.fallback ? w.ADV_TILESET_PLACEHOLDER : (w.ADV_TILESET || w.ADV_TILESET_PLACEHOLDER); },
    sheet(t = this.ts()) { return t && (t.canvas || (typeof img === 'function' ? img(t.file) : null)); },
    // Anything the real tileset lacks (a material, a prop) falls back to the placeholder's; originOf says which sheet an entry's ids point into.
    defOf(name) { return this.lookup('mats', name); },
    propDef(name) { return this.lookup('props', name); },
    lookup(group, name) {   // the exterior sheet first, then the interior one (rooms), then the placeholder
      const w = typeof window !== 'undefined' ? window : {}, ts = this.ts(), it = w.ADV_TILESET_INT, ph = w.ADV_TILESET_PLACEHOLDER, dv = this.fallback ? null : w.ADV_TILESET_DERIVED, rg = this.fallback ? null : w.ADV_TILESET_REGION;   // rg: data/adv/tileset-region.js (tools/adv-region-export.py), the map-lab sheet: baked ground, props, cliffs. dv: data/adv/tileset-derived.js (tools/adv-build-derived.py), its mats and props win over the exterior sheet's
      for (const s of [rg, dv, ts, it, ph]) { const d = s && s[group] && s[group][name]; if (d) { if (!this.origin.has(d)) this.origin.set(d, s); return d; } }
      return null;
    },
    originOf(d) { return this.origin.get(d); },
    origin: new WeakMap(),
    // world.water = names of water materials (default 'water'); world.groups = lists of materials that autotile as one (no seam between them); world.blank = chunk indices (cy * chunksW + cx) that are plain world.fill
    setWorld(w) {
      this.scaleWorld(w); this.world = w; this.grp = null; this.wset = null; this.blank = null; this.mkBlds(w); if (!w) return;
      const it = typeof window !== 'undefined' && window.ADV_TILESET_INT;   // room mats (floors, walls, dark surround) follow the world's; walls and the surround are blocked like water
      if (w.palette) this.palette = [...w.palette, ...(it ? it.order.filter(n => !w.palette.includes(n)) : [])];
      const pal = this.palette;
      if (w.groups) { this.grp = Int16Array.from(pal, (_, i) => i); for (const g of w.groups) for (const n of g) if (pal.indexOf(n) >= 0) this.grp[pal.indexOf(n)] = pal.indexOf(g[0]); }
      if (w.water || it) { this.wset = new Uint8Array(pal.length); for (const n of [...(w.water || ['water']), ...(it ? it.blocked : [])]) if (pal.indexOf(n) >= 0) this.wset[pal.indexOf(n)] = 1; }
      if (w.blank) this.blank = new Set(w.blank);
      const dj = !this.fallback && typeof window !== 'undefined' && window.ADV_TILESET_DERIVED?.joins; this.jn = null;
      if (dj) { this.jn = new Uint8Array(pal.length * pal.length); for (const [a, bs] of Object.entries(dj)) for (const b of bs) if (pal.indexOf(a) >= 0 && pal.indexOf(b) >= 0) this.jn[pal.indexOf(a) * pal.length + pal.indexOf(b)] = 1; }
      this.live = []; this.roomK = new Set();   // live rooms (the Route 4 cave: wild mons live in it and players share it) are loaded with the world and stay loaded
      for (const [id, d] of Object.entries(this.rooms)) if (d.live) { this.loadRoom(d); this.live.push({ id, zone: d.zone, x0: d.cx * T * CH, y0: d.cy * T * CH, x1: (d.cx + (d.cw || 1)) * T * CH, y1: (d.cy + (d.ch || 1)) * T * CH }); }
    },
    reset() { this.chunks.clear(); this.pending = {}; this.missing = {}; this.roomAt = null; this.swim = false; this.live = []; this.roomK = new Set(); },

    // ---------- caves (S1b rooms, S2 left only the cave: every building holds its own interior, see below) ----------
    // data/adv/rooms/<id>.js registers a live room: a map far from the world, flat, mats by name (pal), props, people and the exits.
    rooms: {},
    room(id, d) { this.rooms[id] = d; },
    roomNpcs() { return [...Object.values(this.rooms).flatMap(r => r.npcs || []), ...this.bldNpcs()]; },
    // a room is d.cw x d.ch chunks (default 1 x 1) from chunk (d.cx, d.cy); a big one (the cave) carries d.mats = one mat string per chunk, row by row, and its props are dealt out to the chunk they stand in; setWorld loads every live room once
    loadRoom(d) {
      const pal = d.pal.map(n => this.palette.indexOf(n)), cw = d.cw || 1, ch = d.ch || 1;
      for (let i = 0; i < cw * ch; i++) {
        const cx = d.cx + i % cw, cy = d.cy + Math.floor(i / cw), many = cw * ch > 1;
        this.chunk(cx, cy, { h: d.hh, mat: this.rle(many ? d.mats[i] : d.mat).map(k => pal[k]), over: d.hh, kind: d.hh, props: many ? d.props.filter(p => Math.floor(p[1] / (T * CH)) === cx && Math.floor(p[2] / (T * CH)) === cy) : d.props, bake: many ? d.bakes && d.bakes[i] : d.bake });   // bake: a map-lab room (tools/adv-region-export.py) carries its ground as region sheet tile ids
        this.roomK.add(key(cx, cy));
      }
    },
    openRoom(id) { const d = this.rooms[id]; if (d && !d.live && !this.roomK.has(key(d.cx, d.cy))) this.loadRoom(d); this.roomAt = id; return d; },   // a room that is not live (a map-lab cave, no wild mons) loads on its first visit
    closeRoom() { this.roomAt = null; },
    // the world door a cave exit leads out of (the cave has one at each end: world.doors entries carry end 'w' / 'e')
    doorFor(room, end) { return (this.world?.doors || []).find(d => d.room === room && d.end === end); },
    // the room door whose front step the foot (x, y) pushes against: world.doors = [{ room, x, y }] (y = the door line, the step is just below it)
    doorAt(x, y) { for (const d of this.world?.doors || []) if (Math.abs(x - d.x) <= 14 * this.S(x) && y > d.y + 4 && y < d.y + 20) return d; return null; },

    // ---------- buildings (S2) ----------
    // The interior of an enterable building lives inside its footprint in the open world, at the world's scale (docs/INTERIORS.md). world.buildings = [{ id, town, n (the exterior prop), x, y (its anchor, data px), fx, fy (footprint origin cell), w, d (tiles),
    //   interior: { floor, walls (mat name, theme prefix), props: [[name, dx, dy]], npcs: [{ ..., dx, dy }], exits: [[dx, dy]] } }]; dx, dy are tile offsets from the footprint origin (the foot of a prop or a person).
    // The footprint's perimeter is wall (8 px at the back, BW at the sides and the front) except at the exits, furniture keeps its own solid rects, and the exterior prop's solid rect is off (that prop carries p.b).
    // b.k = 0..3 is how far the exterior has faded: 3 hard steps over FADE seconds, the interior is drawn while k > 0 (adv-render.js).
    BW: 32, FADE: 0.2,
    mkBlds(w) {
      const k = this.OUT, t = T * k; this.blds = []; this.bldById = new Map(); this.bk = new Map();
      for (const b of (w && w.buildings) || []) {
        const I = b.interior, x0 = b.fx * t, y0 = b.fy * t, x1 = x0 + b.w * t, y1 = y0 + b.d * t, W = this.BW, gaps = I.exits.map(([dx]) => [x0 + dx * t, x0 + (dx + 1) * t]).sort((p, q) => p[0] - q[0]);
        const walls = [[x0, y0, x1, y0 + 8], [x0, y0, x0 + W, y1], [x1 - W, y0, x1, y1]]; let c = x0;
        for (const [g0, g1] of gaps) { if (g0 > c) walls.push([c, y1 - W, g0, y1]); c = g1; }
        if (c < x1) walls.push([c, y1 - W, x1, y1]);
        const items = I.props.map(([n, dx, dy]) => ({ n, x: x0 + dx * t, y: y0 + dy * t, z: 0 })), m = items.find(p => p.n === 'healMachine');
        const o = { ...b, t, x0, y0, x1, y1, walls, gaps, items, f: 0, k: 0, mach: m && { x: m.x, y: m.y } };
        this.blds.push(o); this.bldById.set(b.id, o); this.bk.set(b.n + '|' + b.x * k + '|' + b.y * k, o);
      }
    },
    // the building whose footprint (walls included) holds the foot (x, y), or null
    bldAt(x, y) { for (const b of this.blds) if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return b; return null; },
    // furniture solid rects in world px (computed on first use: the tileset is known by then)
    bldItems(b) {
      for (const p of b.items) if (p.s === undefined) { const pd = this.propDef(p.n), s = pd && pd.solid, K = this.dk(pd || {}, p.x); p.s = s ? [p.x + s[0] * K, p.y + s[1] * K, p.x + s[2] * K, p.y + s[3] * K] : null; }
      return b.items;
    },
    bldSolids(b) { return [...b.walls, ...this.bldItems(b).map(p => p.s).filter(Boolean)]; },
    bldHit(x, y, r) {
      const hit = s => { const nx = Math.max(s[0], Math.min(x, s[2])) - x, ny = Math.max(s[1], Math.min(y, s[3])) - y; return nx * nx + ny * ny < r * r; };
      for (const b of this.blds) {
        if (x + r < b.x0 || x - r > b.x1 || y + r < b.y0 || y - r > b.y1) continue;
        if (b.walls.some(hit)) return true;
        if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && this.bldItems(b).some(p => p.s && hit(p.s))) return true;
      }
      return false;
    },
    // one frame of the cutaway: the building the player stands in fades its exterior out in 3 hard steps, every other one fades back in; p = the player's entity (null: nobody is inside anything)
    cutTick(dt, p) {
      const at = p && this.bldAt(p.x, p.y);
      for (const b of this.blds) { b.f = Math.max(0, Math.min(1, b.f + (b === at ? 1 : -1) * dt / this.FADE)); b.k = Math.floor(b.f * 3 + 1e-6); }
    },
    // the people of every building as NPC defs standing at their tile offsets from the footprint origin (their room field is the building id)
    bldNpcs() { return this.blds.flatMap(b => (b.interior.npcs || []).map(({ dx, dy, ...n }) => ({ ...n, x: b.fx + dx - 0.5, y: b.fy + dy - 0.5, room: b.id }))); },

    // ---------- chunks ----------
    chunk(cx, cy, d) {
      d = { ...d, h: unrle(d.h), mat: unrle(d.mat), over: unrle(d.over), kind: unrle(d.kind), deck: d.deck && unrle(d.deck), bake: d.bake && unrle(d.bake), fbake: d.fbake && unrle(d.fbake) };
      const k = key(cx, cy), deck = new Int8Array(N).fill(-1), S = this.Tc(cx * CH) / T;
      for (let i = 0; i < N; i++) if (d.kind[i] === 8) deck[i] = d.deck && d.deck[i] >= 0 ? d.deck[i] : d.h[i] + 1;
      const ch = { cx, cy, h: Int8Array.from(d.h), mat: Uint8Array.from(d.mat), over: Uint8Array.from(d.over), kind: Uint8Array.from(d.kind), deck, bake: d.bake ? Int16Array.from(d.bake) : null, fbake: d.fbake ? Int16Array.from(d.fbake) : null,   // bake: a tile id of the region sheet per cell (-1 = none), the ground of a map-lab zone
        props: (d.props || []).map(p => { const o = { n: p[0], x: p[1] * S, y: p[2] * S, z: p[3] === undefined ? undefined : p[3] * S }, b = this.bk.get(o.n + '|' + o.x + '|' + o.y); if (b) o.b = b; return o; }),
        tile: new Int16Array(N), role: new Uint8Array(N), otile: new Int16Array(N), orole: new Uint8Array(N) };
      this.chunks.set(k, ch); delete this.pending[k];
      for (const p of ch.props) if (p.z === undefined) p.z = this.heightAt(p.x, p.y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nb = this.chunks.get(key(cx + dx, cy + dy)); if (nb) this.autotile(nb); }
    },
    // Keeps chunks within R of (cx, cy) loaded (1, or 2 for a high flier's wide view), drops anything further than R + 1 away.
    // this.more = chunk coords [cx, cy] of other players the host simulates around (adv-net.js); inside a room only those are streamed and the room's own chunk stays
    stream(cx, cy, R = 1) {
      const W = this.world; if (!W) return;
      const cs = [...(this.roomAt ? [] : [[cx, cy]]), ...(this.more || [])];
      if (!cs.length) return;   // inside a room the world stays as it was
      for (const [px, py] of cs) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = px + dx, y = py + dy, k = key(x, y);
        if (x < 0 || y < 0 || x >= W.chunksW || y >= W.chunksH || this.chunks.has(k) || this.pending[k] || this.missing[k]) continue;
        if (this.blank && this.blank.has(y * W.chunksW + x)) this.fillChunk(x, y); else this.load(x, y);
      }
      for (const [k, ch] of this.chunks) if (!this.roomK.has(k) && cs.every(([px, py]) => Math.max(Math.abs(ch.cx - px), Math.abs(ch.cy - py)) > R + 1)) this.chunks.delete(k);
    },
    fillChunk(cx, cy) {
      const m = Math.max(0, this.palette.indexOf(this.world.fill)), z = Array(N).fill(0);
      this.chunk(cx, cy, { h: z, mat: Array(N).fill(m), over: z, kind: z, props: [] });
    },
    load(cx, cy) {
      const k = key(cx, cy), s = document.createElement('script');
      this.pending[k] = 1; s.src = `${this.world.dir || 'data/adv'}/chunks/${cx}_${cy}.js`;
      s.onload = () => s.remove();
      s.onerror = () => { delete this.pending[k]; this.missing[k] = 1; s.remove(); };
      document.head.appendChild(s);
    },
    chunkAt(c, r) { return this.chunks.get(key(c >> 5, r >> 5)); },

    // ---------- cell access, global cell coords (c, r); h -1 = void ----------
    h(c, r) { const ch = this.chunkAt(c, r); return ch ? ch.h[(r & 31) * 32 + (c & 31)] : -1; },
    mat(c, r) { const ch = this.chunkAt(c, r); return ch ? ch.mat[(r & 31) * 32 + (c & 31)] : 0; },
    over(c, r) { const ch = this.chunkAt(c, r); return ch ? ch.over[(r & 31) * 32 + (c & 31)] : 0; },
    kind(c, r) { const ch = this.chunkAt(c, r); return ch ? ch.kind[(r & 31) * 32 + (c & 31)] : 0; },
    deck(c, r) { const ch = this.chunkAt(c, r); return ch ? ch.deck[(r & 31) * 32 + (c & 31)] : -1; },
    isWater(c, r) { const m = this.mat(c, r); return this.wset ? this.wset[m] === 1 : this.palette[m] === 'water'; },
    cellAt(x, y) {
      const t = this.Tp(x), c = Math.floor(x / t), r = Math.floor(y / t), ch = this.chunkAt(c, r); if (!ch) return null;
      const i = (r & 31) * 32 + (c & 31);
      return { c, r, ch, i, h: ch.h[i], mat: ch.mat[i], over: ch.over[i], kind: ch.kind[i], deck: ch.deck[i] };
    },
    // Surface height in px for a foot at (x, y). lv picks the bridge deck over the ground below it.
    heightAt(x, y, lv) {
      const cl = this.cellAt(x, y); if (!cl) return 0; const t = this.Tp(x);
      if (STAIR[cl.kind]) return (cl.h + stairT(cl.kind, x / t - cl.c, y / t - cl.r)) * t;
      if (cl.deck >= 0 && (lv === undefined || lv === cl.deck)) return cl.deck * t;
      return cl.h * t;
    },

    // ---------- autotiling ----------
    pick(def, role, c, r) {
      let id = def[role]; if (id === undefined) id = def.C;
      const b = def.by && this.groundBy(def, role, c, r); if (b) id = b[role] ?? b.C;
      return Array.isArray(id) ? id[hash(c, r) % id.length] : id;
    },
    // derived sets (tileset-derived.js): def.by[ground] = the tiles drawn where the cell meets that ground. mode nb: an edge tile of this def by the neighbour on the edge's side; base: the plain tile an overlay
    // edge is drawn over, by the neighbour its own edge faces; self: an overlay layer tile (tall grass) by the ground under it
    groundBy(def, role, c, r) {
      const K = typeof window !== 'undefined' && window.ADV_TILESET_DERIVED?.keys; if (!K) return null;
      const at = (dc, dr) => K[this.palette[this.mat(c + dc, r + dr)]];
      if (def.mode === 'self') return def.by[at(0, 0)];
      if (def.mode === 'base') { if (this.defOf(this.palette[this.mat(c, r)]) === def) return null; role = this.roleName(c, r, 0); }
      for (const [dc, dr] of SIDES[role] || []) { const b = def.by[at(dc, dr)]; if (b) return b; }
      return null;
    },
    // Same-material test for a layer; unloaded neighbours count as same so borders only show seams once the neighbour is known.
    same(c, r, m, layer) {
      const ch = this.chunkAt(c, r); if (!ch) return true;
      const i = (r & 31) * 32 + (c & 31), g = this.grp; if (layer || !g ? ch[layer ? 'over' : 'mat'][i] === m : g[ch.mat[i]] === g[m]) return true;
      return !layer && !!this.jn && this.jn[m * this.palette.length + ch.mat[i]] === 1;   // jn: a snow cell counts a path beside it as snow (tileset-derived.js joins), the path draws the edge
    },
    roleOf(c, r, m, layer) {
      const s = (dc, dr) => this.same(c + dc, r + dr, m, layer);
      const n = s(0, -1), so = s(0, 1), e = s(1, 0), w = s(-1, 0);
      const v = !n ? 'N' : !so ? 'S' : '', hz = !e ? 'E' : !w ? 'W' : '';
      if (v || hz) return v + hz;
      if (!s(1, -1)) return 'iNE';
      if (!s(-1, -1)) return 'iNW';
      if (!s(1, 1)) return 'iSE';
      if (!s(-1, 1)) return 'iSW';
      return 'C';
    },
    autotile(ch) {
      const ts = this.ts(); if (!ts) return; ch.gv = (ch.gv | 0) + 1;   // gv: the renderer's cached ground for this chunk is stale
      for (let i = 0; i < N; i++) {
        const c = ch.cx * CH + (i & 31), r = ch.cy * CH + (i >> 5);
        for (let layer = 0; layer < 2; layer++) {
          const m = layer ? ch.over[i] : ch.mat[i], def = m && this.defOf(this.palette[m]), tiles = layer ? ch.otile : ch.tile;
          if (!def) { tiles[i] = -1; continue; }
          const role = this.roleOf(c, r, m, layer);
          (layer ? ch.orole : ch.role)[i] = ROLES.indexOf(role);
          tiles[i] = this.pick(def, role, c, r);
          if (ch.bake && ch.bake[i] >= 0) tiles[i] = layer ? -1 : ch.bake[i];   // baked ground draws its own tile; the overlay (tall grass) stays logic only
        }
      }
    },
    roleName(c, r, layer) { const ch = this.chunkAt(c, r); return ch ? ROLES[(layer ? ch.orole : ch.role)[(r & 31) * 32 + (c & 31)]] : null; },
    tileId(c, r, layer) { const ch = this.chunkAt(c, r); return ch ? (layer ? ch.otile : ch.tile)[(r & 31) * 32 + (c & 31)] : -1; },
    // Animated materials (water): frames[f] is an id list in ROLES order, or a role -> id object.
    frameId(def, roleIdx, id, f) {
      if (!def.frames) return id;
      const fr = def.frames[f % def.frames.length], v = Array.isArray(fr) ? fr[roleIdx] : fr[ROLES[roleIdx]];
      return v === undefined ? id : Array.isArray(v) ? v[0] : v;
    },

    // ---------- entities and movement ----------
    entity(x, y, lv) {
      const t = this.Tp(x), c = Math.floor(x / t), r = Math.floor(y / t), L = lv === undefined ? Math.max(0, this.h(c, r)) : lv;
      return { x, y, z: L * t, sz: L * t, lv: L, r: 6, hop: null };
    },
    // Is an entity on level lv allowed to occupy cell B when entering with step direction d, and from which level does it leave A.
    exitLevel(e, ac, ar, dx, dy) {
      const st = STAIR[this.kind(ac, ar)], hA = this.h(ac, ar);
      if (!st) return e.lv;
      if (dx === st[0] && dy === st[1]) return hA + 1;
      if (dx === -st[0] && dy === -st[1]) return hA;
      return null;
    },
    entryOK(bc, br, dx, dy, lvl, sw) {   // sw = the entity can surf: water at ground level is open to it
      const hB = this.h(bc, br), st = STAIR[this.kind(bc, br)];
      if (st) return dx === st[0] && dy === st[1] ? lvl === hB : dx === -st[0] && dy === -st[1] ? lvl === hB + 1 : false;
      return (lvl === hB && (sw || !this.isWater(bc, br))) || this.deck(bc, br) === lvl;
    },
    // 0 blocked, 1 ok, 2 ledge hop
    step(e, ac, ar, bc, br, dx, dy) {
      const hB = this.h(bc, br); if (hB < 0) return 0;
      const kA = this.kind(ac, ar), kB = this.kind(bc, br), sA = STAIR[kA], sB = STAIR[kB];
      if (sA && sB && kA === kB && this.h(ac, ar) === hB) return 1;
      const lvl = this.exitLevel(e, ac, ar, dx, dy); if (lvl === null) return 0;
      if (this.entryOK(bc, br, dx, dy, lvl, e.surf)) return 1;
      const lg = LEDGE[kA];
      if (!sA && !sB && lg && lg[0] === dx && lg[1] === dy && hB < lvl && !this.isWater(bc, br)) return 2;
      return 0;
    },
    propHit(x, y, r, z) {
      const t = this.Tp(x), cx = Math.floor(x / (t * CH)), cy = Math.floor(y / (t * CH));
      if (this.blds.length && this.bldHit(x, y, r)) return true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ch = this.chunks.get(key(cx + dx, cy + dy)); if (!ch) continue;
        for (const p of ch.props) {
          const pd = this.propDef(p.n), s = pd && pd.solid; if (!s || p.b || Math.abs(p.z - z) > t * 0.75) continue;
          const k = this.dk(pd, p.x), nx = Math.max(p.x + s[0] * k, Math.min(x, p.x + s[2] * k)) - x, ny = Math.max(p.y + s[1] * k, Math.min(y, p.y + s[3] * k)) - y;
          if (nx * nx + ny * ny < r * r) return true;
        }
      }
      return false;
    },
    // Static query for later battle use: can a foot circle at (x, y) on height z (px) exist here at all.
    blocked(x, y, z, r) {
      const t = this.Tp(x), lvl = z / t;
      for (let cr = Math.floor((y - r) / t); cr <= Math.floor((y + r - 0.01) / t); cr++) for (let cc = Math.floor((x - r) / t); cc <= Math.floor((x + r - 0.01) / t); cc++) {
        const h = this.h(cc, cr); if (h < 0) return true;
        if (STAIR[this.kind(cc, cr)]) { if (lvl < h - 0.25 || lvl > h + 1.25) return true; continue; }
        const dk = this.deck(cc, cr);
        if (Math.abs(dk - lvl) < 0.25) continue;
        if (Math.abs(h - lvl) >= 0.25 || this.isWater(cc, cr)) return true;
      }
      return this.propHit(x, y, r, z);
    },
    // Moves e by (dx, dy) world px: axis-separated, sub-stepped, wall sliding. A ledge step starts e.hop instead.
    move(e, dx, dy) {
      if (e.hop) return;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4)), sx = dx / n, sy = dy / n;
      for (let i = 0; i < n && !e.hop; i++) { if (sx) this.axis(e, sx, 0); if (sy && !e.hop) this.axis(e, 0, sy); this.settle(e); }
    },
    axis(e, dx, dy) {
      const r = e.r, nx = e.x + dx, ny = e.y + dy, E = 0.01, s = (dx || dy) > 0 ? 1 : -1, T = this.Tp(e.x);
      if (this.propHit(nx, ny, r, e.z)) return;
      let hop = null;
      if (dx) {
        const oc = Math.floor((e.x + s * (r - E)) / T), nc = Math.floor((nx + s * (r - E)) / T);
        if (oc !== nc) for (let j = Math.floor((e.y - r + E) / T); j <= Math.floor((e.y + r - E) / T); j++) { const k = this.step(e, oc, j, nc, j, s, 0); if (!k) return; if (k === 2) hop = [nc, j]; }
      } else {
        const or = Math.floor((e.y + s * (r - E)) / T), nr = Math.floor((ny + s * (r - E)) / T);
        if (or !== nr) for (let i = Math.floor((e.x - r + E) / T); i <= Math.floor((e.x + r - E) / T); i++) { const k = this.step(e, i, or, i, nr, 0, s); if (!k) return; if (k === 2) hop = [i, nr]; }
      }
      if (hop) { this.startHop(e, hop[0], hop[1], dx ? s : 0, dy ? s : 0); return; }
      e.x = nx; e.y = ny;
    },
    startHop(e, bc, br, dx, dy) {
      const T = this.Tp(e.x), hB = this.h(bc, br), x1 = dx ? (bc + 0.5) * T : e.x, y1 = dy ? (br + 0.5) * T : e.y;
      if (this.propHit(x1, y1, e.r, hB * T)) return;
      e.hop = { t: 0, dur: 0.3, x0: e.x, y0: e.y, z0: e.z, x1, y1, z1: hB * T, lv1: hB };
    },
    // Hop playback; z arcs down over 0.3 s.
    update(e, dt) {
      const h = e.hop; if (!h) return;
      h.t += dt; const k = Math.min(1, h.t / h.dur);
      e.x = h.x0 + (h.x1 - h.x0) * k; e.y = h.y0 + (h.y1 - h.y0) * k;
      e.sz = h.z0 + (h.z1 - h.z0) * k; e.z = e.sz + 40 * k * (1 - k);
      if (k >= 1) { e.hop = null; e.x = h.x1; e.y = h.y1; e.lv = h.lv1; this.settle(e); }
    },
    // Snap z / lv to the cell under the foot: stairs interpolate, everything else sits on its level (deck or ground).
    settle(e) {
      const T = this.Tp(e.x), c = Math.floor(e.x / T), r = Math.floor(e.y / T), h = this.h(c, r); if (h < 0) return;
      const k = this.kind(c, r);
      if (STAIR[k]) { e.z = (h + stairT(k, e.x / T - c, e.y / T - r)) * T; e.lv = h; }
      else {
        const d = this.deck(c, r), zl = e.z / T;
        e.lv = d >= 0 && Math.abs(d - zl) < Math.abs(h - zl) ? d : h;
        e.z = e.lv * T;
      }
      e.sz = e.z;
    },

    // ---------- draw order ----------
    // Drawable: { type: 0 strip | 1 bridge deck | 2 entity or prop, key, row, z, x, x0, x1 }.
    // Painter order = ascending key (a strip's key is its row's back edge, an entity's is its foot y, so row = floor(key / T)).
    // Inside a row: strip, ground entities, deck, then entities standing on a deck (entity z >= deck z). depthSort assigns those layers.
    order(a, b) {
      const L = o => o.type === 0 ? 0 : o.type === 1 ? 2 : o.layer || 1;
      return a.row - b.row || L(a) - L(b) || a.key - b.key || a.z - b.z;
    },
    depthSort(list) {
      for (const d of list) if (d.type === 1) for (const e of list) {
        if (e.type !== 2 || e.row !== d.row || e.x + 16 < d.x0 || e.x - 16 > d.x1) continue;
        e.layer = Math.max(e.layer || 1, e.z >= d.z ? 3 : 1);
      }
      return list.sort((a, b) => this.order(a, b));
    },
  };
  return A;
})();
