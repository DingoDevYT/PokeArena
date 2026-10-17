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


def lobes(w, h, parts, seed, jag=.15):
    """union of noisy ellipses [(cx, cy, rx, ry), ...]: a massif with spurs and bays instead of one round blob"""
    out = set()
    for i, (cx, cy, rx, ry) in enumerate(parts): out |= blob(w, h, cx, cy, rx, ry, seed * 10 + i, jag)
    return out


def _segs(n, rng, lo, hi):
    """split range(n) into consecutive runs of random length lo..hi"""
    out, i = [], 0
    while i < n:
        k = min(n - i, rng.randint(lo, hi))
        if n - i - k and n - i - k < lo: k = n - i
        out.append((i, i + k)); i += k
    return out


def terrace(S, seed, hrun=(4, 8), vrun=(3, 6)):
    """organic but blocky outlines: the north/south edge is held flat over runs of 4..8 columns and the west/east edge over runs of 3..6 rows
    (median of the run, jittered by one), so a slope reads as a few long cliff stretches with real corners, not a one-cell staircase"""
    if not S: return S
    rng = random.Random(seed)
    def flat(vals, lo, hi):
        out = list(vals)
        for a, b in _segs(len(vals), rng, lo, hi):
            v = sorted(vals[a:b])[(b - a) // 2] + rng.choice((0, 0, 0, -1, 1)); out[a:b] = [v] * (b - a)
        return out
    xs = sorted({x for x, _ in S}); cols = {x: sorted(y for a, y in S if a == x) for x in xs}
    x0, x1 = xs[0], xs[-1]; rngx = [x for x in range(x0, x1 + 1)]
    top = flat([cols[x][0] if x in cols else cols[min(xs, key=lambda c: abs(c - x))][0] for x in rngx], *hrun)
    bot = flat([cols[x][-1] if x in cols else cols[min(xs, key=lambda c: abs(c - x))][-1] for x in rngx], *hrun)
    S2 = {(x, y) for i, x in enumerate(rngx) for y in range(top[i], bot[i] + 1)}
    ys = sorted({y for _, y in S2}); rows = {y: sorted(x for x, b in S2 if b == y) for y in ys}
    lo = flat([rows[y][0] for y in ys], *vrun); hi = flat([rows[y][-1] for y in ys], *vrun)
    return {(x, y) for i, y in enumerate(ys) for x in range(max(lo[i], rows[y][0] - 1), min(hi[i], rows[y][-1] + 1) + 1) if (x, y) in S2 or x in cols and cols[x][0] <= y <= cols[x][-1]}


def stack(inner, outer, x0, x1):
    """drop the south edge of `inner` to the lowest row it may take inside `outer` (two rows above outer's own face) over columns x0..x1,
    so the two faces stand one ledge apart and read as one tall stepped cliff"""
    S = set(inner)
    for x in range(x0, x1 + 1):
        ys = [y for a, y in inner if a == x]; oys = [y for a, y in outer if a == x]
        if not ys or not oys: continue
        for y in range(max(ys) + 1, max(oys) - 1): S.add((x, y))
    return S


def stairs_at(lv, h, xs, y0, y1, avoid=()):
    """first x in xs (and x+1) where a stairs pair fits on level h's face with a real landing below (two rows of level h-1, not a one-row ledge)"""
    g = lambda a, b: lv.get((a, b), 0)
    for x in xs:
        if x in avoid or x + 1 in avoid: continue
        y = stair_row(lv, x, h, y0, y1)
        if y is not None and all(g(x + i, y + 3) >= h - 1 for i in (0, 1)) and all(g(x + i, y + 1) == g(x + i, y + 2) == h - 1 for i in (0, 1)): return x, y
    return None
