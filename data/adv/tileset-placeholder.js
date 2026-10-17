// Placeholder Adventure tileset, same schema as data/adv/tileset.js. Flat coloured tiles are drawn into an offscreen canvas at startup.
(function () {
  const T = 32, COLS = 8, R = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW'];
  const paint = [];
  const add = fn => paint.push(fn) - 1;
  const sidesOf = role => role[0] === 'i' || role === 'C' ? '' : role;
  const inner = (role, k) => { const s = sidesOf(role); return [s.includes('W') ? k : 0, s.includes('N') ? k : 0, s.includes('E') ? T - k : T, s.includes('S') ? T - k : T]; };
  const rect = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const spots = (g, x, y, seed, col, n, box) => {
    for (let i = 0; i < n; i++) {
      const v = (seed * 31 + i * 977 + i * i * 13) % 900, px = v % 28 + 2, py = (v / 30 | 0) % 28 + 2;
      if (px >= box[0] && px < box[2] - 2 && py >= box[1] && py < box[3] - 2) rect(g, col, x + px, y + py, 2, 2);
    }
  };
  function drawRole(g, x, y, role, ri, o, frame) {
    const box = o.overlay ? inner(role, o.inset || 6) : [0, 0, T, T], [x0, y0, x1, y1] = box, sd = sidesOf(role), b = o.overlay ? 2 : 3;
    rect(g, o.fill, x + x0, y + y0, x1 - x0, y1 - y0);
    if (o.waves) for (let k = 0; k < 4; k++) { const wx = (k * 11 + frame * 7) % 24, wy = 4 + k * 8; if (wy >= y0 && wy < y1 - 2) rect(g, o.dot, x + Math.max(wx, x0), y + wy, Math.min(8, x1 - Math.max(wx, x0)), 2); }
    else spots(g, x, y, o.seed + ri, o.dot, 8, box);
    if (sd.includes('N')) rect(g, o.edge, x + x0, y + y0, x1 - x0, b);
    if (sd.includes('S')) rect(g, o.edge, x + x0, y + y1 - b, x1 - x0, b);
    if (sd.includes('W')) rect(g, o.edge, x + x0, y + y0, b, y1 - y0);
    if (sd.includes('E')) rect(g, o.edge, x + x1 - b, y + y0, b, y1 - y0);
    if (role[0] === 'i') {
      const k = 8, nx = role.includes('E') ? T - k : 0, ny = role.includes('S') ? T - k : 0;
      if (o.overlay) g.clearRect(x + nx, y + ny, k, k); else rect(g, o.edge, x + nx, y + ny, k, k);
    }
  }
  function matSet(o, frame = 0) {
    const s = {};
    R.forEach((role, ri) => { s[role] = add((g, x, y) => drawRole(g, x, y, role, ri, o, frame)); });
    return s;
  }
  function bladeSet() {
    const s = {};
    R.forEach(role => {
      s[role] = add((g, x, y) => {
        const [x0, y0, x1, y1] = inner(role, 4);
        for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 5; gx++) {
          const bx = gx * 7 + (gy % 2) * 3 + 1, by = gy * 8 + 2;
          if (bx < x0 || bx + 4 > x1 || by < y0 || by + 8 > y1) continue;
          rect(g, '#2d6f2a', x + bx, y + by + 3, 4, 5); rect(g, '#3f9a36', x + bx, y + by, 2, 5); rect(g, '#52b848', x + bx + 2, y + by + 1, 2, 4);
        }
        if (role[0] === 'i') { const nx = role.includes('E') ? T - 8 : 0, ny = role.includes('S') ? T - 8 : 0; g.clearRect(x + nx, y + ny, 8, 8); }
      });
    });
    return s;
  }
  const grass = { C: [0, 1, 2].map(v => add((g, x, y) => {
    rect(g, ['#5fa83e', '#5aa23a', '#64ac42'][v], x, y, T, T);
    spots(g, x, y, 11 + v * 5, '#4d9132', 7, [0, 0, T, T]); spots(g, x, y, 40 + v * 9, '#74bd52', 4, [0, 0, T, T]);
  })) };
  const path = { ...matSet({ fill: '#cdb88a', dot: '#b9a273', edge: '#a58f5f', overlay: true, inset: 5, seed: 3 }), overlay: true, base: 'grass' };
  const sand = matSet({ fill: '#e8d9a0', dot: '#d3c283', edge: '#c9b571', seed: 7 });
  const w0 = matSet({ fill: '#3d7fd0', dot: '#7fb2ee', edge: '#2c5fa6', waves: true }, 0), w1 = matSet({ fill: '#3d7fd0', dot: '#7fb2ee', edge: '#2c5fa6', waves: true }, 1);
  const water = { ...w0, frames: [R.map(r => w0[r]), R.map(r => w1[r])] };
  const tallgrass = { ...bladeSet(), overlay: true };

  const rock = '#8a6d4a', rockD = '#5a4530', strat = '#715a3d';
  const face = (top, side) => add((g, x, y) => {
    rect(g, rock, x, y, T, T); rect(g, strat, x, y + 10, T, 2); rect(g, strat, x, y + 21, T, 2);
    spots(g, x, y, 5 + side.length, '#9d7f5a', 6, [0, 0, T, T]);
    if (top) { rect(g, '#4d9132', x, y, T, 4); rect(g, '#3d7a2a', x, y + 4, T, 2); }
    if (side === 'L') rect(g, rockD, x, y, 3, T); if (side === 'R') rect(g, rockD, x + T - 3, y, 3, T);
  });
  const rim = sides => add((g, x, y) => {
    if (sides.includes('N')) { rect(g, '#3a7a2a', x, y, T, 4); rect(g, '#7ccf5a', x, y + 4, T, 1); }
    if (sides.includes('W')) { rect(g, '#3a7a2a', x, y, 4, T); rect(g, '#7ccf5a', x + 4, y, 1, T); }
    if (sides.includes('E')) { rect(g, '#3a7a2a', x + T - 4, y, 4, T); rect(g, '#7ccf5a', x + T - 5, y, 1, T); }
  });
  const stairs = dir => add((g, x, y) => {
    rect(g, '#9d9588', x, y, T, T);
    for (let i = 0; i < 4; i++) {
      const lit = (i + (dir === 'N' || dir === 'W' ? 0 : 1)) % 2 ? '#c7bfae' : '#8c8476';
      if (dir === 'N' || dir === 'S') rect(g, lit, x + 3, y + i * 8, T - 6, 8); else rect(g, lit, x + i * 8, y + 3, 8, T - 6);
    }
    if (dir === 'N' || dir === 'S') { rect(g, '#5d5648', x, y, 3, T); rect(g, '#5d5648', x + T - 3, y, 3, T); } else { rect(g, '#5d5648', x, y, T, 3); rect(g, '#5d5648', x, y + T - 3, T, 3); }
  });
  const ledge = dir => add((g, x, y) => {
    rect(g, rock, x, y, T, T);
    if (dir === 'S') { rect(g, '#5fa83e', x, y, T, 10); rect(g, '#3d7a2a', x, y + 8, T, 3); for (let i = 0; i < 4; i++) rect(g, '#c9a572', x + 4 + i * 8, y + 16, 4, 2); }
    else { const ex = dir === 'E' ? T - 10 : 0; rect(g, '#5fa83e', x + ex, y, 10, T); rect(g, '#3d7a2a', x + (dir === 'E' ? T - 11 : 8), y, 3, T); for (let i = 0; i < 4; i++) rect(g, '#c9a572', x + (dir === 'E' ? 8 : 20), y + 4 + i * 8, 2, 4); }
  });
  const cliff = {
    rimN: rim('N'), rimE: rim('E'), rimW: rim('W'), rimNE: rim('NE'), rimNW: rim('NW'),
    faceTop: { L: face(1, 'L'), M: face(1, 'M'), R: face(1, 'R') }, face: { L: face(0, 'L'), M: face(0, 'M'), R: face(0, 'R') },
    stairsN: stairs('N'), stairsS: stairs('S'), stairsE: stairs('E'), stairsW: stairs('W'),
    ledgeS: ledge('S'), ledgeE: ledge('E'), ledgeW: ledge('W'),
  };

  const y0 = Math.ceil(paint.length / COLS) * T;
  const props = {
    pineTree: { sx: 0, sy: y0, sw: 48, sh: 72, ax: 24, ay: 68, solid: [-8, -6, 8, 2] },
    boulder: { sx: 56, sy: y0, sw: 36, sh: 28, ax: 18, ay: 24, solid: [-14, -8, 14, 2] },
    sign: { sx: 100, sy: y0, sw: 20, sh: 26, ax: 10, ay: 24, solid: [-5, -3, 5, 2] },
    bush: { sx: 128, sy: y0, sw: 30, sh: 22, ax: 15, ay: 20, solid: null },
  };
  const propPaint = {
    pineTree: (g, x, y) => { rect(g, '#5a3a1e', x + 21, y + 56, 6, 14, 1); for (let i = 0; i < 6; i++) { const w = 12 + i * 7; rect(g, i % 2 ? '#2f7a2c' : '#3d9b34', x + 24 - w / 2, y + 6 + i * 9, w, 11); rect(g, '#1f5a20', x + 24 - w / 2, y + 15 + i * 9, w, 2); } },
    boulder: (g, x, y) => { rect(g, '#6d6d76', x + 2, y + 10, 32, 14); rect(g, '#8a8a92', x + 6, y + 4, 24, 10); rect(g, '#a8a8b0', x + 10, y, 16, 6); rect(g, '#55555c', x + 2, y + 22, 32, 2); },
    sign: (g, x, y) => { rect(g, '#6b4a2a', x + 8, y + 10, 4, 14); rect(g, '#c8a064', x + 1, y + 2, 18, 10); rect(g, '#8a6a3a', x + 1, y + 10, 18, 2); },
    bush: (g, x, y) => { rect(g, '#2f7a2c', x + 2, y + 8, 26, 12); rect(g, '#3d9b34', x + 6, y + 2, 18, 12); rect(g, '#52b848', x + 10, y + 4, 6, 4); },
  };

  const ts = window.ADV_TILESET_PLACEHOLDER = { file: '', canvas: null, T, cols: COLS, mats: { grass, path, sand, water, tallgrass }, cliff, props };
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = COLS * T; cv.height = y0 + 80;
    const g = cv.getContext('2d');
    paint.forEach((fn, id) => fn(g, (id % COLS) * T, (id / COLS | 0) * T));
    for (const n in props) propPaint[n](g, props[n].sx, props[n].sy);
    ts.canvas = cv;
  }
})();
