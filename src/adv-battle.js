// Battles in the world (W1a): the fight box cut out of the loaded chunks and its terrain mask. Pure logic over ADV so tools/adv-check.mjs can run it in node.
// Battle coordinates are LOCAL to the box (world - (ox, oy)); mask cell: 0 open, 1 solid (wrong height, water, void, deck, stairs), 2 solid AND shots die (terrain above the fight level).
'use strict';
const ADVB = {
  COLS: 40, ROWS: 30,   // the box in scale-1 tiles: 1280 x 960 world px, so 20 x 15 tiles outdoors (ar.T = the map's tile)
  // a = {x, y}, b = {x, y} world px of the two mons, lv = fight level. Box is centred between them and kept inside the loaded chunks.
  box(a, b, lv, at) {   // at = [col, row] fixes the box origin (a PvP fight: both screens must cut the same box)
    const T = ADV.Tp(a.x), CH = ADV.CH, C = this.COLS * 32 / T, R = this.ROWS * 32 / T;
    let c0 = 1e9, c1 = -1e9, r0 = 1e9, r1 = -1e9;
    for (const ch of ADV.chunks.values()) { c0 = Math.min(c0, ch.cx * CH); c1 = Math.max(c1, ch.cx * CH + CH); r0 = Math.min(r0, ch.cy * CH); r1 = Math.max(r1, ch.cy * CH + CH); }
    const col = at ? at[0] : Math.max(c0, Math.min(c1 - C, Math.round((a.x + b.x) / 2 / T - C / 2))), row = at ? at[1] : Math.max(r0, Math.min(r1 - R, Math.round((a.y + b.y) / 2 / T - R / 2)));
    const mask = new Uint8Array(C * R), obstacles = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const wc = col + c, wr = row + r, h = ADV.h(wc, wr), dk = ADV.deck(wc, wr);
      mask[r * C + c] = Math.max(h, dk) > lv ? 2 : h !== lv || dk >= 0 || (ADV.isWater(wc, wr) && !ADV.swim) || ADV.STAIR[ADV.kind(wc, wr)] ? 1 : 0;
    }
    const ox = col * T, oy = row * T;
    for (const ch of ADV.chunks.values()) for (const p of ch.props) {
      const pd = ADV.propDef(p.n), s = pd?.solid; if (!s || p.b || Math.abs(p.z - lv * T) > T * 0.75) continue;
      const S = ADV.dk(pd, p.x), x = p.x + (s[0] + s[2]) / 2 * S - ox, y = p.y + (s[1] + s[3]) / 2 * S - oy;
      if (x > 0 && y > 0 && x < C * T && y < R * T) obstacles.push({ kind: 'rock', x, y, r: Math.max(s[2] - s[0], s[3] - s[1]) / 2 * S, hp: Infinity, world: true });
    }
    for (const b of ADV.blds) {   // S2: a building's walls and furniture are rows of rocks as wide as the wall, so a fight inside keeps to the floor and may run out through the door
      if (b.x1 < ox || b.x0 > ox + C * T || b.y1 < oy || b.y0 > oy + R * T) continue;
      for (const [x0, y0, x1, y1] of ADV.bldSolids(b)) {
        const w = x1 - x0, h = y1 - y0, r = Math.max(4, Math.min(w, h) / 2), hz = w >= h, L = hz ? w : h, n = L > 2 * r ? Math.ceil((L - 2 * r) / (r * 1.5)) + 1 : 1;
        for (let i = 0; i < n; i++) { const u = n === 1 ? L / 2 : r + (L - 2 * r) * i / (n - 1), x = (hz ? x0 + u : (x0 + x1) / 2) - ox, y = (hz ? (y0 + y1) / 2 : y0 + u) - oy; if (x > 0 && y > 0 && x < C * T && y < R * T) obstacles.push({ kind: 'rock', x, y, r, hp: Infinity, world: true }); }
      }
    }
    const ar = { world: true, T, col, row, ox, oy, w: C * T, h: R * T, cols: C, rows: R, wall: 0, lv, mask, obstacles, props: {}, t: 0 };
    ar.spawns = [a, b].map(q => { const [x, y] = this.clamp(ar, q.x - ox, q.y - oy, 14); return [x, y]; });
    return ar;
  },
  // does a square of half-size p at local (x, y) touch a solid cell or leave the box
  solidAt(ar, x, y, p = 0) {
    const T = ar.T;
    if (x - p < 0 || y - p < 0 || x + p > ar.w || y + p > ar.h) return true;
    for (let r = Math.floor((y - p) / T); r <= Math.floor((y + p - 0.01) / T); r++) for (let c = Math.floor((x - p) / T); c <= Math.floor((x + p - 0.01) / T); c++) if (ar.mask[r * ar.cols + c]) return true;
    return false;
  },
  // clampToArena for the world: an entity (e.px, e.py = where it was) slides along solid cells axis by axis; a bare point goes to the nearest open cell centre
  clamp(ar, x, y, pad, e) {
    if (!this.solidAt(ar, x, y, pad)) return [x, y];
    if (e && e.px !== undefined) {
      let nx = x, ny = y;
      if (this.solidAt(ar, nx, e.py, pad)) nx = e.px;
      if (this.solidAt(ar, nx, ny, pad)) ny = e.py;
      if (!this.solidAt(ar, nx, ny, pad)) return [nx, ny];
    }
    const T = ar.T, p = Math.min(pad, 15);
    let best = [x, y], bd = 1e18;
    for (let r = 0; r < ar.rows; r++) for (let c = 0; c < ar.cols; c++) {
      const cx = (c + 0.5) * T, cy = (r + 0.5) * T, d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bd && !this.solidAt(ar, cx, cy, p)) { bd = d; best = [cx, cy]; }
    }
    return best;
  },
  // a shot at local (x, y) dies at the box edge and on terrain above the fight level; it crosses water and lower ground
  shotHit(ar, x, y) {
    const c = Math.floor(x / ar.T), r = Math.floor(y / ar.T);
    return c < 0 || r < 0 || c >= ar.cols || r >= ar.rows || ar.mask[r * ar.cols + c] === 2;
  },
};
