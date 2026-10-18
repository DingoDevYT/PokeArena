"""Snow helpers on top of kit.py for the snow towns (Sprucevale G2, Frostfall T1): the kit's open-ground test only knows '.' as open ground, a snow town's ground is 'Z',
so SnowTown reads 'Z' as open; plus the snow tree and prop lists, a house row that spaces lots by their real sprite widths, and a snow garden for the left-over lawn."""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit, plan

def tint(fmt, cols, n=(0, 1)): return [fmt.format(c=c, n=i) for c in cols for i in n]
PINE = tint('rg_pine_{c}_snow{n}', ('green', 'teal', 'olive')) + tint('rg_fir_{c}_snow{n}', ('green', 'teal', 'olive'))
TALL = tint('rg_tall_{c}_snow{n}', ('green', 'teal', 'olive'))
ROUND = tint('rg_round_{c}_snow{n}', ('green', 'teal', 'olive'))
YOUNG = tint('rg_young_{c}_snow{n}', ('green', 'teal', 'olive'))
WOOD = PINE * 3 + TALL + ROUND                                   # a spruce forest with the odd broadleaf
BUSH = ['rg_bush_green_snow', 'rg_bush_teal_snow', 'rg_bush_olive_snow', 'rg_bush_red_snow', 'rg_bush_pink_snow']
SMALL = ['rg_snow_lump', 'rg_snow_lump2', 'rg_ice_pebble', 'rg_ice_pebble2', 'rg_ice_stone', 'rg_snowpile', 'rg_ice_spike', 'rg_ice_spike2', 'rg_tiny_white', 'rg_tiny_white2', 'leafPlantFrost']
LUMPS = ['rg_snow_lump', 'rg_snow_lump2', 'rg_ice_pebble', 'rg_ice_pebble2', 'rg_ice_stone', 'rg_tiny_white', 'rg_tiny_white2']
ROCKS = ['rg_ice_boulder', 'rg_ice_boulder2', 'rg_ice_boulder3', 'rg_ice_rock', 'rg_ice_rock2', 'rg_ice_tall', 'rg_snowpile']
TUFT = ['rg_cone_green_snow', 'rg_cone_teal_snow', 'rg_slim_green_snow', 'rg_slim_teal_snow', 'rg_slim_olive_snow', 'rg_stump_green_snow', 'rg_stump2_green_snow', 'rg_stump_teal_snow', 'rg_bush_green_snow', 'rg_bush_teal_snow']
POTS = ['rg_pot_snow', 'rg_planter_snow']
BEDS = ('rg_planter_snow', 'rg_planter_snow')

def level_cells(code, lim):
    """the cells (plan coordinates) of the town box that lie at the town's own height in the generated world: the plateau a house may stand on. The generator leaves the rest
    (hills, cliffs, the rim) as it finds it, so buildings and pens belong on these cells only. Read from snow-levels.py (dumped once from the generated world); None for other towns."""
    import importlib.util
    sp = importlib.util.spec_from_file_location('snow_levels', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'snow-levels.py')); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    rows = m.LEVELS.get(code)
    if not rows: return None
    return {(x, int(y)) for y, runs in rows.items() for x0, x1 in runs for x in range(x0, x1 + 1)}

class SnowTown(kit.Town):
    def __init__(s, N, code, lim=None):
        super().__init__(N, code); s.keep = set(); s.level = level_cells(code, lim or N + 2)
    def lv(s, x, y): return s.level is None or (x, y) in s.level
    def fits(s, name, xd, yd):
        """a building with door walkway (xd, yd) stands on level ground: the three rows of its base across its width, and its walk row"""
        l, r = extent(name, xd); return all(s.lv(x, y) for y in (yd - 2, yd - 1, yd) for x in range(math.floor(l + .3), math.ceil(r - .3)))
    def openmask(s, x0, y0, x1, y1, gap):
        """kit.Town.openmask with snow ('Z') counting as open ground"""
        pav = {(x, y) for y in range(-s.N, s.N + 1) for x in range(-s.N, s.N + 1) if s.get(x, y) not in ('.', 'a', 'Z')}
        for b in s.blds: pav |= set(s.box(b[0], b[1], b[2], bld=True))
        for d in s.deco:
            if d[0] == 'plot': pav |= {(x, y) for y in range(d[2] - 1, d[2] + d[4] + 1) for x in range(d[1] - 1, d[1] + d[3] + 1)}
            if d[0] == 'pond': pav |= {(x, y) for y in range(int(d[2] - d[4]) - 3, int(d[2] + d[4]) + 4) for x in range(int(d[1] - d[3]) - 3, int(d[1] + d[3]) + 4)}
        near = lambda x, y: any((x + i, y + j) in pav for i in range(-gap, gap + 1) for j in range(-gap, gap + 1))
        return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if s.get(x, y) in ('.', 'Z') and (x, y) not in s.occ and not near(x, y)}
    def garden(s, x0, y0, x1, y1, seed=12, every=4, pool=None):
        """snow lawn left near paths: a bush, a young tree, a stump or a drift every `every` tiles, kept off the walking line"""
        r = random.Random(seed); pool = pool or (BUSH + YOUNG[:3] + TUFT + LUMPS + ROCKS[:3])
        for (x, y) in sorted(s.openmask(x0, y0, x1, y1, 1)):
            if r.random() * every < 1:
                n = r.choice(pool); s.prop(n, x, y, walk=n in LUMPS)

def extent(name, x):
    """left and right edge (tiles) of a building sprite whose door walkway is column x"""
    sw, sh, ax, ay = kit.size(name); l = x + .5 - plan.PROPS[name]['door'][0] / kit.T - ax; return l, l + sw

def finish(g, seed=3):
    """what stands beside every lot: a woodpile against a side wall (timber is stacked at every door), on whichever side is free, then now and then a barrel, a stack
    of crates, a snow heap or a mailbox on the other side"""
    r = random.Random(seed)
    for name, x, y, sw in g.lots:
        l, rr = extent(name, x); sides = [int(l) - 1, int(rr) + 1]; r.shuffle(sides)
        placed = [px for px in sides if g.prop(r.choice(['rg_woodpile', 'rg_woodpile', 'rg_logs']), px, y - 1)][:1]
        other = [px for px in sides if px not in placed]
        for px in other:
            if r.random() < .75: g.prop(r.choice(['rg_barrel', 'rg_barrel_water', 'rg_crates', 'rg_crates2', 'rg_snowpile', 'rg_snowpile', 'rg_crate', 'rg_logs']), px, y - 1)
        if r.random() < .5: g.prop('mailbox', x + 3, y, walk=True)

def row(g, door_y, street_y, x0, x1, pool, seed=1, gap=(3, 5), skip=(), beds=BEDS, **kw):
    """houses side by side from x0 to x1 on a lane: each lot's door walkway on row door_y, its walk down to street_y; the sprites keep `gap` tiles (random in the range)
    apart; skip: x ranges (a, b) to leave open. Returns the door columns placed."""
    r = random.Random(seed); cur = x0; out = []
    for _ in range(80):
        name = pool[r.randrange(len(pool))]
        l0, _r0 = extent(name, 0); xd = math.ceil(cur - l0); l, rr = extent(name, xd)
        if rr > x1: break
        hit = [b for a, b in skip if l < b + 1 and rr > a - 1]
        if hit: cur = max(hit) + 2; continue
        if hasattr(g, 'fits') and not g.fits(name, xd, door_y): cur += 1; continue
        g.lot(name, xd, door_y, street_y=street_y, beds=beds, **kw); out.append(xd); cur = rr + r.randint(*gap)
    return out

def pen(g, x0, y0, x1, y1, fence='wLogFence', gate=None, post='wLogPost', floor=None):
    """a fenced yard: rails along the north and south sides, a post at every tile on the west and east sides (a rail sprite is horizontal, so a vertical run of rails reads as
    broken bars); gate = (side, k) leaves one gap on that side ('N' 'S': at x = k, 'W' 'E': at y = k) so a path can enter; floor: ground character laid inside (packed dirt)"""
    gs, gk = gate or (None, None)
    if floor: g.rect(x0, y0, x1, y1, floor)
    for x in range(x0, x1 + 1):
        if not (gs == 'N' and x == gk): g.prop(fence, x, y0, walk=True)
        if not (gs == 'S' and x == gk): g.prop(fence, x, y1, walk=True)
    for y in range(y0 + 1, y1):
        if not (gs == 'W' and y == gk): g.prop(post, x0, y, walk=True)
        if not (gs == 'E' and y == gk): g.prop(post, x1, y, walk=True)

def yard_stacks(g, x0, y0, x1, y1, seed=1, aisle=None):
    """woodpiles in the yard inside a pen (x0..x1, y0..y1 are the pen's rails): one row against the south rail, one against the north rail, an aisle left open at x = aisle"""
    r = random.Random(seed)
    for x in range(x0 + 1, x1, 2):
        if aisle is not None and abs(x - aisle) <= 1: continue
        for y in (y1 - 1, y0 + 2):
            if y0 + 2 <= y <= y1 - 1 and (y1 - y0) >= 3: g.prop(r.choice(['rg_woodpile', 'rg_woodpile', 'rg_logs']), x, y, walk=True)

def skate_pond(g, x, y, w, h):
    """a frozen pool drawn with the lab's small pond sprite (rg_pond, 1.5 tiles): sprites one tile apart (they overlap into one pool), the corners left out so it is round-ish, with ice stones on its bank. (The generator's own pond only cuts into grass or sand, never snow, so a snow town draws its water as props.) Its ground is claimed."""
    for j in range(h):
        for i in range(w):
            if (j == 0 or j == h - 1) and (i == 0 or i == w - 1): continue
            g.prop('rg_pond', x + i, y + j, force=True, walk=True)
    g.claim([(cx, cy) for cy in range(y - 2, y + h + 1) for cx in range(x - 1, x + w + 2)], 'pond')
    for dx, dy in ((0, h), (w, 0), (w // 2, -1)): g.prop('rg_ice_pebble2', x + dx, y + dy, force=True, walk=True)

def cap(g, x, y, dx=1, bench=True):
    """the end of a footpath: a small paved turning space with a lamp and a bench, so no lane just stops (dx: the side the lane comes from, 1 west of it, -1 east of it)"""
    g.rect(x - 1, y - 1, x + 1, y + 1, 'p'); g.prop('rg_lamp', x + dx * 2, y - 1, walk=True)
    if bench: g.prop('rg_bench', x - 1, y + 2, walk=True)

def stacks(g, x0, y0, x1, y1, every=2, kinds=('rg_woodpile', 'rg_logs'), seed=1):
    """rows of timber stacks: woodpiles in rows every `every` tiles across and down"""
    r = random.Random(seed)
    for y in range(y0, y1 + 1, every + 1):
        for x in range(x0, x1 + 1, every): g.prop(r.choice(kinds), x, y, walk=True)

def along(g, pts, pool, seed=1, gap=(2, 3), margin=2, skip=(), tag=0, **kw):
    """houses along a footpath drawn as a polyline (the same points the lane was drawn with): on every east-west leg, a row on its north side facing it,
    kept `margin` tiles off the leg's bends; legs are numbered, `skip` is a list of (leg, a, b) x ranges to leave open"""
    out = []
    for i, ((xa, ya), (xb, yb)) in enumerate(zip(pts, pts[1:])):
        if ya != yb: continue
        x0, x1 = min(xa, xb) + margin, max(xa, xb) - margin
        sk = [(a, b) for (leg, a, b) in skip if leg == i]
        out += row(g, ya - 1, ya, x0, x1, pool, seed=seed * 7 + i, gap=gap, skip=sk, **kw)
    return out

def lamps(g, pts, every=9, side=1, seed=0):
    """a lamp post beside a footpath every `every` tiles along its east-west legs (on its south side, clear of the doors), a bench now and then"""
    r = random.Random(seed)
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya != yb: continue
        for x in range(min(xa, xb) + 3, max(xa, xb) - 2, every + r.randint(0, 3)):
            g.prop('rg_lamp', x, ya + side, walk=True)
            if r.random() < .4: g.prop('rg_bench', x + 3, ya + side, walk=True)

def pond_ring(g, x, y, rx, ry, kinds, seed=5):
    """plant right up to a pond's bank: the kit claims two extra tiles round a pond so nothing is planted in it; release that margin (keeping the water and its bank
    claimed) and plant a belt of trees and rocks in it, so a pond is not left in a wide bare clearing"""
    for cy in range(int(y - ry) - 2, int(y + ry) + 3):
        for cx in range(int(x - rx) - 2, int(x + rx) + 3):
            if abs(cx - x) > rx + 1.5 or abs(cy - y) > ry + 1.5:
                if g.occ.get((cx, cy)) == 'pond': del g.occ[(cx, cy)]
    g.trees(int(x - rx) - 8, int(y - ry) - 6, int(x + rx) + 8, int(y + ry) + 6, kinds, seed=seed)

def col(g, lx, y0, y1, side, pool, seed=1, gap=(1, 2), skip=(), beds=BEDS, **kw):
    """houses down the side of a north-south footpath at x = lx: side -1 on its west (right wall two tiles off the path), +1 on its east; the doors face south as ever, each walk
    drops off the doorstep and runs across to the path; skip: (a, b) y ranges to leave open. Returns the door rows placed."""
    r = random.Random(seed); cur = y0; out = []
    for _ in range(60):
        name = pool[r.randrange(len(pool))]; sw, sh, ax, ay = kit.size(name); l0, r0 = extent(name, 0)
        xd = math.floor(lx - 2 - r0) if side < 0 else math.ceil(lx + 3 - l0)
        yd = math.ceil(cur + ay + .05)
        if yd + 1 > y1: break
        hit = [b for a, b in skip if cur - .5 < b + 1 and yd + 1 > a - 1]
        if hit: cur = max(hit) + 2; continue
        if hasattr(g, 'fits') and not g.fits(name, xd, yd): cur += 1; continue
        g.lot(name, xd, yd, street_x=lx, beds=beds, **kw); out.append(yd); cur = yd + 2 + r.randint(*gap)
    return out

def lane_row(g, y, xj, xf, pool, far_junction=False, seed=1, gap=(2, 3), margin=2, skip=(), extra_end=None, **kw):
    """one straight footpath on row y with houses on its north side facing it. The lane starts at the junction xj and runs towards xf: to xf itself when that end is a
    junction too (far_junction), otherwise only as far as its last house's walk (or `extra_end`, a feature's walk), so no lane ends in nothing. Returns the door columns."""
    d = 1 if xf > xj else -1
    a, b = sorted((xj + d * margin, xf - d * margin if far_junction else xf))
    doors = row(g, y - 1, y, a, b, pool, seed=seed, gap=gap, skip=skip, **kw)
    end = xf if far_junction else (max(doors + [extra_end or xj]) if d > 0 else min(doors + [extra_end or xj]))
    if extra_end is not None and not far_junction: end = max(end, extra_end) if d > 0 else min(end, extra_end)
    if end != xj: g.lane([(xj, y), (end, y)], 1, 'd')
    return doors

def glade(g, cx, cy, r, props=(), seed=1):
    """a clearing in a wood: every tree whose foot lies within r tiles of (cx, cy) is taken out (after the woods are planted) and the given props (name, dx, dy) are set in it, so a
    forest is not one unbroken lattice"""
    names = {g.legend.get(n) for n in WOOD + TALL + ROUND + PINE + YOUNG}
    keep = []
    for ch, x, y in g.pp:
        if ch in names and math.hypot(x - cx, y - cy) <= r:
            for c in [k for k, v in g.occ.items() if v in set(WOOD + YOUNG) and abs(k[0] - x) <= 2 and abs(k[1] - y) <= 2]: del g.occ[c]
        else: keep.append((ch, x, y))
    g.pp[:] = keep
    for n, dx, dy in props: g.prop(n, cx + dx, cy + dy, walk=True)

def trail(g, pts, pool, seed=1, gap=(1, 2), vside=(-1,), vtrim=2, hmargin=2, skip=(), **kw):
    """a footpath drawn as a polyline (with its bends) and its houses: on every east-west leg a row on the north side facing it (kept hmargin off the bends), on every north-south
    leg a column on the sides in vside (-1 west, 1 east; the doors face south and walk across to the lane; vtrim off the ends). skip: (leg, a, b) ranges (x for east-west legs,
    y for north-south legs)."""
    g.lane(pts, 1, 'd')
    for i, ((xa, ya), (xb, yb)) in enumerate(zip(pts, pts[1:])):
        sk = [(a, b) for (lg, a, b) in skip if lg == i]
        if ya == yb:
            row(g, ya - 1, ya, min(xa, xb) + hmargin, max(xa, xb) - hmargin, pool, seed=seed * 7 + i, gap=gap, skip=sk, **kw)
        else:
            for sd in vside: col(g, xa, min(ya, yb) + vtrim, max(ya, yb) - 1, sd, pool, seed=seed * 7 + i + sd * 3, gap=gap, skip=sk, **kw)

def prune(g, chars='d'):
    """trim every lane back to its last door walk: a dead-end path cell ('d', one open neighbour among path cells) that is not at a door (a building's walkway or the rows
    just above it) and not on the town's edge (an exit) is returned to snow, repeatedly, so no lane ends in nothing"""
    doors = {(b[1], b[2] + k) for b in g.blds for k in (-2, -1, 0, 1)}
    P = 'dpct'
    while True:
        cut = []
        for y in range(-g.N + 1, g.N):
            for x in range(-g.N + 1, g.N):
                if g.get(x, y) in chars and (x, y) not in doors and (x, y) not in g.keep:
                    if sum((g.get(x + dx, y + dy) or ' ') in P for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1: cut.append((x, y))
        if not cut: return
        for x, y in cut: g.put(x, y, 'Z')
