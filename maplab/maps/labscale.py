"""Plan B (docs/REGION-REBUILD.md section 13): the island was redrawn at 0.8x with towns at true size, so a hand-built lab window covers less land
than it was drawn for. Sc carries a map's hand-set numbers onto the smaller window: positions scale, while anything narrow (a road, a gateway,
a stair, a path one cell wide) keeps its width, so roads stay 2 game cells wide and features stay on even lab cells.
Game cells: x / y / pt / gbox / profile. Lab cells: lx / ly / lpt / lbox. Scaled(m, sc) is a build.Map whose drawing calls take the OLD lab numbers."""


class Sc:
    def __init__(s, sx, sy): s.sx, s.sy = sx, sy
    # ---- game cells
    def x(s, v): return int(round(v * s.sx))
    def y(s, v): return int(round(v * s.sy))
    def pt(s, x, y): return s.x(x), s.y(y)
    @staticmethod
    def _span(a, b, k, keep):
        a2 = int(round(a * k))
        return (a2, a2 + (b - a)) if b - a + 1 <= keep else (a2, max(a2, int(round((b + 1) * k)) - 1))
    def gbox(s, x0, y0, x1, y1, keep=3):
        """a game cell rect: a side of `keep` cells or less keeps its length, a longer one scales with both ends"""
        X0, X1 = s._span(x0, x1, s.sx, keep); Y0, Y1 = s._span(y0, y1, s.sy, keep); return X0, Y0, X1, Y1
    def profile(s, x0, tops, bots):
        """a plateau column profile (game cells) resampled: new column j takes old column j / sx; rows scale"""
        n = len(tops); n2 = max(1, int(round(n * s.sx))); X0 = s.x(x0)
        idx = [min(n - 1, int((j + .5) / s.sx)) for j in range(n2)]
        return X0, [s.y(tops[i]) for i in idx], [max(s.y(tops[i]), int(round((bots[i] + 1) * s.sy)) - 1) for i in idx]
    # ---- lab cells (2 x 2 per game cell)
    def lx(s, v): return int(round(v * s.sx))
    def ly(s, v): return int(round(v * s.sy))
    def lpt(s, x, y): return s.lx(x), s.ly(y)
    def lbox(s, x0, y0, x1, y1, keep=6):
        """a lab rect on whole game cells (even start, odd end) scaled like gbox"""
        X0, Y0, X1, Y1 = s.gbox(x0 // 2, y0 // 2, x1 // 2, y1 // 2, keep // 2); return 2 * X0, 2 * Y0, 2 * X1 + 1, 2 * Y1 + 1
    def rows(s, rows):
        """a drawn shape (rows of characters) resampled to the new scale"""
        h, w = len(rows), max(len(r) for r in rows); h2, w2 = max(1, int(round(h * s.sy))), max(1, int(round(w * s.sx)))
        return [''.join((rows[min(h - 1, int((j + .5) / s.sy))] + '.' * w)[min(w - 1, int((i + .5) / s.sx))] for i in range(w2)) for j in range(h2)]


class Scaled:
    """a build.Map seen through Sc: the drawing calls take the map's original lab numbers; everything else passes straight through"""
    def __init__(s, m, sc): s.m, s.sc = m, sc
    def __getattr__(s, k): return getattr(s.m, k)
    def set(s, layer, x, y, ch): s.m.set(layer, *s.sc.lpt(x, y), ch)
    def rect(s, layer, x0, y0, x1, y1, ch):
        if layer == 'ground' and x0 % 2 == 0 and y0 % 2 == 0 and x1 % 2 == 1 and y1 % 2 == 1: s.m.rect(layer, *s.sc.lbox(x0, y0, x1, y1), ch)
        else: X0, Y0 = s.sc.lpt(x0, y0); s.m.rect(layer, X0, Y0, max(X0, s.sc.lx(x1 + 1) - 1), max(Y0, s.sc.ly(y1 + 1) - 1), ch)
    def shape(s, layer, x0, y0, rows, ch): X0, Y0 = s.sc.lpt(x0, y0); s.m.shape(layer, X0 - X0 % 2, Y0 - Y0 % 2, s.sc.rows(rows), ch)
    def blob(s, layer, cx, cy, rx, ry, ch): s.m.blob(layer, cx * s.sc.sx, cy * s.sc.sy, rx * s.sc.sx, ry * s.sc.sy, ch)
    def near(s, x, y, ok, r=4):
        """the drawing's spot, scaled, or the nearest one within r cells that passes ok (scaling can push a prop onto a path or under a tree)"""
        X, Y = s.sc.lpt(x, y)
        c = [(X + i, Y + j) for d in range(r + 1) for i in range(-d, d + 1) for j in range(-d, d + 1) if max(abs(i), abs(j)) == d and ok(X + i, Y + j)]
        return c[0] if c else (X, Y)
    def obj(s, name, x, y): return s.m.obj(name, *s.near(x, y, lambda a, b: s.m.free(name, a, b)))
    def building(s, name, x, y, to=None, wide=1):
        X, Y = s.sc.lpt(x, y); return s.m.building(name, X - X % 2, Y - Y % 2, None if to is None else s.sc.ly(to), wide)
    def tree(s, name, bx, by, quiet=False): return s.m.tree(name, *s.sc.lpt(bx, by), quiet)
    def forest(s, x0, y0, x1, y1, kinds, seed, dx=3, dy=2): s.m.forest(*s.sc.lpt(x0, y0), *s.sc.lpt(x1, y1), kinds, seed, dx, dy)
    def act(s, k, who, x, y, *rest): s.m.act(k, who, *s.near(x, y, lambda a, b: s.m.ground(a, b) in '.t' and (a, b) not in s.m.busy and (a, b - 1) not in s.m.busy and not s.m.edge(a, b)), *rest)
    def cluster(s, items, cx, cy, n, seed, r=1): s.m.cluster(items, *s.sc.lpt(cx, cy), n, seed, r)
    def scatter(s, items, n, region, seed, gap=1):
        x0, y0, x1, y1 = region; s.m.scatter(items, max(1, int(round(n * s.sc.sx * s.sc.sy))), (*s.sc.lpt(x0, y0), *s.sc.lpt(x1, y1)), seed, gap)
