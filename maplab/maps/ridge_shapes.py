"""Organic plateau masks for the Eastern Ridge pilot (maplab/maps/region_ridge.py), on the GAME cell grid (a game cell = 2 x 2 lab cells).
Rules the exporter and the engine need (tools/adv-region-export.py asserts them):
  - every drop is one level, a plateau column is at least 3 cells tall (a face row, a top row above it, and one more),
  - a plateau row run is at least 3 cells wide,
  - an inner plateau keeps one cell of the outer one on its north and sides and two cells south (the stairs foot is a top cell of the outer level)."""
import math, random


def blob(w, h, cx, cy, rx, ry, seed, jag=0.16):
    """a noisy ellipse: radius modulated by three low harmonics, so the outline is an irregular rounded shape rather than a rectangle"""
    rng = random.Random(seed); a1, a2, a3 = [rng.uniform(0, 6.283) for _ in range(3)]
    out = set()
    for y in range(h):
        for x in range(w):
            dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry; r = math.hypot(dx, dy); th = math.atan2(dy, dx)
            if r < 1 + jag * math.sin(2 * th + a1) + .75 * jag * math.sin(3 * th + a2) + .5 * jag * math.sin(5 * th + a3): out.add((x, y))
    return out


def _run(S, x, y, dx, dy):
    n = 1
    for s in (1, -1):
        i = 1
        while (x + s * i * dx, y + s * i * dy) in S: n += 1; i += 1
    return n


def clean(S, hmin=3, vmin=3):
    """drop cells in rows narrower than hmin or columns shorter than vmin until nothing changes"""
    S = set(S)
    while True:
        bad = {c for c in S if _run(S, *c, 1, 0) < hmin or _run(S, *c, 0, 1) < vmin}
        if not bad: return S
        S -= bad


def _median(v, k):
    n = len(v); h = k // 2
    return [sorted(v[max(0, i - h):i + h + 1])[len(v[max(0, i - h):i + h + 1]) // 2] for i in range(n)]


def smooth(S, kv=5, kh=3):
    """median filter the south/north edge per column (window kv) and the west/east edge per row (window kh): long straight runs instead of 1 cell sawtooth, so stairs fit"""
    if not S: return S
    xs = sorted({x for x, _ in S}); cols = {x: sorted(y for a, y in S if a == x) for x in xs}
    x0, x1 = xs[0], xs[-1]
    top = _median([cols[x][0] if x in cols else 0 for x in range(x0, x1 + 1)], kv); bot = _median([cols[x][-1] if x in cols else 0 for x in range(x0, x1 + 1)], kv)
    S2 = {(x, y) for i, x in enumerate(range(x0, x1 + 1)) for y in range(top[i], bot[i] + 1) if x in cols}
    ys = sorted({y for _, y in S2}); rows = {y: sorted(x for x, b in S2 if b == y) for y in ys}
    y0, y1 = ys[0], ys[-1]
    lo = _median([rows[y][0] if y in rows else 0 for y in range(y0, y1 + 1)], kh); hi = _median([rows[y][-1] if y in rows else 0 for y in range(y0, y1 + 1)], kh)
    return {(x, y) for i, y in enumerate(range(y0, y1 + 1)) for x in range(lo[i], hi[i] + 1) if y in rows}


def inside(inner, outer):
    """the part of `inner` that keeps the margin inside `outer`: one cell north and sides (diagonals too), two south"""
    return {(x, y) for x, y in inner if all((x + i, y + j) in outer for i in (-1, 0, 1) for j in (-1, 0, 1, 2))}


def levels(masks):
    """masks = [L1, L2, ...] nested sets -> dict cell -> level"""
    lv = {}
    for k, S in enumerate(masks, 1):
        for c in S: lv[c] = k
    return lv


def show(lv, w, h):
    return '\n'.join(''.join(str(lv.get((x, y), '.')) for x in range(w)) for y in range(h))


def stair_row(lv, x, h, y0, y1):
    """the face row of level h at columns x, x+1 within rows y0..y1 (the lowland below must be level h-1 and a top cell, not a face), or None"""
    g = lambda a, b: lv.get((a, b), 0)
    for y in range(y1, y0 - 1, -1):
        if all(g(x + i, y) == h and g(x + i, y + 1) == h - 1 and g(x + i, y + 2) >= h - 1 and g(x + i, y - 1) == h for i in (0, 1)): return y
    return None
