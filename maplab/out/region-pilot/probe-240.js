const CFG = {"x0": 240, "y0": 928, "gw": 64, "gh": 48, "start": [240, 934], "stairs": [[291, 951], [292, 951], [272, 955], [273, 955], [264, 959], [265, 959]], "probes": {"north gateway": [293, 928], "hut door front": [271, 953], "knoll top": [268, 949], "terrace interior": [258, 951], "ridge top": [291, 947], "ridge stair foot": [291, 951], "terrace stair foot": [264, 960], "pond shore": [254, 952], "south lane": [270, 962], "east shelf": [284, 951], "outside west": [239, 934]}};
const T = ADV.Tp(0), cfg = CFG, X0 = cfg.x0, Y0 = cfg.y0, GW = cfg.gw, GH = cfg.gh, start = cfg.start;
const stairs = new Set(cfg.stairs.map(s => s.join()));
const ent = ADV.entity(0, 0, 0);
function bfs(maskStairs) {
  const key = (c, r, l) => c + ',' + r + ',' + l;
  const seen = new Set([key(start[0], start[1], 0)]), q = [[start[0], start[1], 0]], cells = new Map();
  cells.set(start[0] + ',' + start[1], 0);
  while (q.length) {
    const [c, r, lv] = q.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dx, nr = r + dy;
      if (nc < X0 - 6 | nr < Y0 - 6 | nc >= X0 + GW + 6 | nr >= Y0 + GH + 6) continue;
      if (maskStairs && stairs.has(nc + ',' + nr)) continue;
      ent.x = (c + 0.5) * T; ent.y = (r + 0.5) * T; ent.lv = lv; ent.z = lv * T;
      const lvl = ADV.exitLevel(ent, c, r, dx, dy); if (lvl === null) continue;
      if (!ADV.step(ent, c, r, nc, nr, dx, dy)) continue;
      if (ADV.propHit((nc + 0.5) * T, (nr + 0.5) * T, 9, lvl * T)) continue;
      const k = key(nc, nr, lvl); if (seen.has(k)) continue;
      seen.add(k); q.push([nc, nr, lvl]); const ck = nc + ',' + nr; if (!cells.has(ck) | cells.get(ck) < lvl) cells.set(ck, lvl);
    }
  }
  return cells;
}
const A = bfs(false), B = bfs(true), out = { probes: {} };
for (const k in cfg.probes) { const [c, r] = cfg.probes[k]; out.probes[k] = { all: A.has(c + ',' + r), noStairs: B.has(c + ',' + r), lvl: A.get(c + ',' + r), h: ADV.h(c, r) }; }
let v = 0; const hs = [0, 0, 0, 0, 0];
for (let r = Y0; r < Y0 + GH; r++) for (let c = X0; c < X0 + GW; c++) { const h = ADV.h(c, r); if (h < 0) v++; else hs[Math.min(4, h)]++; }
out.void = v; out.cellsByLevel = hs; out.reachAll = A.size; out.reachNoStairs = B.size;
const ra = [0, 0, 0, 0, 0], rb = [0, 0, 0, 0, 0];
const inW = k => { const [c, r] = k.split(',').map(Number); return c >= X0 & c < X0 + GW & r >= Y0 & r < Y0 + GH; };   // only the window's own cells: the old terrain around it has stairs of its own
for (const [k, l] of A) if (inW(k)) ra[Math.min(4, l)]++; for (const [k, l] of B) if (inW(k)) rb[Math.min(4, l)]++;
out.reachByLevel = ra; out.reachNoStairsByLevel = rb;
return JSON.stringify(out);
