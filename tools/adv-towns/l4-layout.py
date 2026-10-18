"""Writes tools/adv-towns/L4.json: the Quiet Plain (docs/MAPDESIGN.md "Look and feel v2", redrawn in the same pass as the towns). Run: python3 -I tools/adv-towns/l4-layout.py
Coordinates are tiles from the memorial centre (y grows south). A landmark, not a town: no building, no fence, no gate, no wall, no tree and no bush within 40 tiles (adv-check), so everything here
is stone, earth, paving and flowers, and the plain stays open.
Route 1's old paving ends at (0, -6) and runs on down an avenue of paired stones into the Court of Wreaths: old grey paving with grass in its seams, a tan band and a tan medallion inlaid, the raised
stone wreath bed (stoneRing, real art) at its heart ringed by stones, lanterns, offerings and white flower beds, pillars at its corners. Two visitors' paths leave the road end, one each way, and run round to the
west and east lobes of worn bare earth, each with its own wreath bed and circle of stones; the court's south edge opens onto a smaller southern lobe. A ring of stones stands round the whole memorial, a stone every few tiles,
rows and a fan of loose arcs of stones frame the road end, and beyond them stand cairns, rock outcrops and drifts of white and blue flowers.
People (data/adv/npcs.js) stand at (2,-5) (-5,-7) (8,3) (-5,6) (0,4); the walk from the road end to every one of them, and down to (0, 18), stays open (tools/adv-check.mjs walks it)."""
import json, math, os, random

MINT, TALL = 'standingStoneMint', 'standingStoneMintTall'
props, paving, plazas = [], [], []
def P(name, x, y): props.append([name, int(round(x)), int(round(y))])
def circle(cx, cy, rx, ry, n, off=0.0, skip=lambda x, y: False, names=(TALL, MINT)):
    for k in range(n):
        a = off + 2 * math.pi * k / n; x, y = round(cx + rx * math.cos(a)), round(cy + ry * math.sin(a))
        if not skip(x, y): P(names[k % 2], x, y)
def row(x0, y0, x1, y1, step, names=(TALL, MINT), skip=lambda x, y: False):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) // step)
    for k in range(n + 1):
        x, y = round(x0 + (x1 - x0) * k / max(n, 1)), round(y0 + (y1 - y0) * k / max(n, 1))
        if not skip(x, y): P(names[k % 2], x, y)
def arc(cx, cy, rx, ry, a0, a1, n, names=(TALL, MINT)):
    for k in range(n):
        a = math.radians(a0 + (a1 - a0) * k / max(n - 1, 1)); P(names[k % 2], round(cx + rx * math.cos(a)), round(cy + ry * math.sin(a)))
def runs(cells, mat):
    """a set of cells as row runs for the layout's paving list"""
    for y in sorted({c[1] for c in cells}):
        xs = sorted(x for x, yy in cells if yy == y); a = b = xs[0]
        for x in xs[1:] + [None]:
            if x is not None and x == b + 1: b = x; continue
            paving.append([a, y, b, y, mat]); a = b = x
rnd = random.Random(404)

# ---- the ground: the road's last stretch, the court with its inlaid bands, two worn lobes with the visitors' paths, a south lobe, the processional path
paving += [[0, -6, 2, 2], [-1, 1, 3, 2]]                                                    # Route 1's avenue runs into the court (the re-laid road is 3 wide and anchored left of the memorial centre: it covers x 0..2, so the avenue is x 0..2 and runs straight on)
plazas += [[-10, 2, 10, 14, 5], [-9, 3, 9, 13, 4, 'tan'], [-8, 4, 8, 12, 3], [-5, 5, 5, 11, 3, 'tan']]    # the court: old grey paving, a tan band, grey again, a tan medallion
plazas += [[-18, 0, -10, 9, 2, 'path'], [10, 0, 18, 9, 2, 'path'], [-5, 15, 5, 21, 3, 'path']]            # the worn lobes of bare earth
paving += [[-11, 3, -9, 4, 'path'], [9, 3, 11, 4, 'path']]                                  # the lobes open onto the court
for x0, x1 in ((-14, -1), (3, 14)): paving.append([x0, -7, x1, -7, 'path'])                  # the visitors' paths from the road end,
for x in (-14, 14): paving.append([x, -6, x, -1, 'path'])                                    # round and down to the lobes
RING_C, RING_RX, RING_RY = (0, 4), 20.0, 18.6                                                # the outer ring of stones: an ellipse round the whole memorial
# ---- the heart: the central wreath bed, ringed by stones, lanterns and offerings
P('stoneRing', 0, 9)
for dx, dy in ((-1, 7), (1, 7), (0, 8), (-1, 8), (1, 8)): P('flowersWhite', dx, dy)
circle(0, 8.6, 4.4, 3.2, 8, math.pi / 8)
for dx, dy in ((-3, 5), (3, 5), (-3, 12), (3, 12)): P('rg_lantern_grey', dx, dy)
for nm, dx, dy in (('vaseGold', -2, 10), ('vaseBlue', 2, 10), ('bowlOrange', 0, 11)): P(nm, dx, dy)
for dx, dy in ((-5, 8), (5, 8), (0, 13)): P('rg_bed_white', dx, dy)
# ---- the court's rim: a ring of stones, pillars at its corners
circle(0, 8.4, 8.8, 5.6, 18, .18, skip=lambda x, y: (-3 <= x <= 5 and y <= 3) or (abs(x) >= 7 and 1 <= y <= 14))      # the sides are the pillars' and the lobes' business
for dx, dy in ((-9, 5), (9, 5), (-9, 13), (9, 13)): P('rg_pillar', dx, dy)
# ---- the avenue: paired stones leading in from the road, flowers at their feet, a bench each side at the road end
row(-2, -4, -2, 3, 2); row(4, -4, 4, 3, 2, names=(MINT, TALL))                               # centred on the avenue (x 1)
for y in (-5, -2, 1): P('rg_flower_white', -3, y); P('rg_flower_white', 5, y)
P('benchTeal', -3, -6); P('benchTeal', 5, -6)
# ---- the west and east lobes: a wreath bed each, a circle of stones, white beds, offerings, lanterns
for sx in (-1, 1):
    cx = 14 * sx; P('stoneRing', cx, 6)
    for dx, dy in ((-1, 5), (1, 5), (0, 4)): P('flowersWhite', cx + dx, dy)
    circle(cx, 4.4, 5.6, 4.1, 10, .3 if sx > 0 else 0, skip=lambda x, y, sx=sx: abs(x - 10 * sx) <= 1 and 3 <= y <= 4)
    P('rg_bed_white', cx - 3, 8); P('rg_bed_white', cx + 3, 8); P('vaseGold' if sx < 0 else 'vaseBlue', cx - 2, 8); P('bowlOrange', cx + 2, 8); P('rg_lantern_grey', cx - 4, 2); P('rg_lantern_grey', cx + 4, 2)
    P('benchTeal', 8 * sx, -6)
# ---- the south lobe
circle(0, 16.2, 4, 2, 7, .2, skip=lambda x, y: abs(x) <= 1 and y >= 17)
for dx, dy in ((-1, 16), (1, 17)): P('flowersWhite', dx, dy)
P('rockGreyB', 0, 15); P('rg_basin_small', -2, 20); P('rg_cairn', 2, 20)
# ---- the outer ring: a stone every two or three tiles round the whole memorial (an ellipse), a pair at each quarter, left out where the road crosses
pts = []; k = 0
for i in range(720):
    a = 2 * math.pi * i / 720; pts.append((RING_C[0] + RING_RX * math.cos(a), RING_C[1] + RING_RY * math.sin(a)))
step = 2.7; acc = 0.0; n = 0; prev = pts[0]; placed = []
for q in pts[1:] + [pts[0]]:
    acc += math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q
    if acc >= step:
        acc = 0.0; x, y = round(q[0]), round(q[1])
        if (-3 <= x <= 5 and y < -4) or math.hypot(x, y) >= 24 or (x, y) in placed: continue
        placed.append((x, y)); P((TALL, MINT)[n % 2], x, y); n += 1
# ---- rows and arcs framing the road end, the fan of loose arcs
def loose_row(x0, y0, x1, y1, names=(TALL, MINT)):
    """stones in twos and threes with gaps between and a one tile wobble, not a ruled line"""
    n = max(abs(x1 - x0), abs(y1 - y0)); t = 0; k = 0
    while t <= n:
        for g_ in range(rnd.choice((1, 2, 2, 3))):
            u = (t + g_ * 2) / n
            if u > 1: break
            P(names[k % 2], round(x0 + (x1 - x0) * u), round(y0 + (y1 - y0) * u) + rnd.choice((0, 0, 1, -1))); k += 1
        t += rnd.choice((6, 7, 9))
loose_row(-18, -9, -5, -9); loose_row(5, -9, 18, -9, names=(MINT, TALL))
for r_, n_ in ((11, 7), (15, 9)):
    for k in range(n_):
        a = math.radians(205 + 130 * k / (n_ - 1)); x, y = round(r_ * 1.3 * math.cos(a)), round(-6 + r_ * math.sin(a) * .85)
        if abs(x) >= 4 and y <= -10 and math.hypot(x, y) < 22: P((TALL, MINT)[k % 2], x, y)
arc(0, 12, 14.5, 10, 20, 70, 4); arc(0, 12, 14.5, 10, 110, 160, 4, names=(MINT, TALL))
# ---- the outer ring of rocks, cairns and mounds
def clump(x, y, kind):
    """a small deliberate group instead of lone pebbles: a cairn or rock with a mound and a few stones and flowers at its feet"""
    P(kind, x, y); P(rnd.choice(('rg_mound_grass', 'rg_mound_grey')), x + 2, y)
    for dx, dy in ((-2, 1), (1, 2)): P(rnd.choice(('rockGreyB', 'stoneGrey', 'rg_rock_grey_small')), x + dx, y + dy)
    for dx, dy in ((0, 2), (3, 1)): P(rnd.choice(('flowersWhite', 'rg_tiny_white', 'flowersBlue')), x + dx, y + dy)
for x, y, k_ in ((-23, 7, 'rg_cairn'), (23, 7, 'rg_cairn'), (-8, 22, 'rg_cairn'), (9, 22, 'rg_cairn'), (-17, -12, 'rg_cairn'), (17, -12, 'rg_cairn'), (-23, -9, 'rg_cairn'), (23, -9, 'rg_cairn'), (-21, 16, 'rg_boulder_grey'), (21, 16, 'rg_boulder_grey')): clump(x, y, k_)
# ---- low clusters beside the visitors' paths, big mossy rocks at the north rim
for sx in (-1, 1):
    for dx, dy, nm in ((9, -2, 'stonesPair'), (11, -3, 'rg_mound_grey'), (10, -1, TALL), (12, -1, MINT)): P(nm, sx * dx, dy)
    P('jRocks', sx * 21, -17); P('jRocksMoss', sx * 12, -20)
# ---- seats and planters in the lobes and the court's sand, added only where nothing stands
def free_(x, y, r=1): return not any(abs(p[1] - x) <= r and abs(p[2] - y) <= r for p in props if SOLID_(p[0]))
SOLID_ = lambda nm: not nm.startswith(('flowers', 'rg_flower', 'rg_tiny', 'rg_clump', 'rg_bed', 'rg_mound', 'rg_puddle', 'rg_leaves'))
for sx in (-1, 1):
    for x, y in ((14 * sx - 5, 8), (14 * sx + 5, 8), (14 * sx, 1), (14 * sx - 5, 1), (14 * sx + 5, 1)):
        if free_(x, y): P('rg_bench_stone' if y == 8 else 'rg_planter_white', x, y)
for x, y, nm in ((-3, 19, 'rg_bench_stone'), (3, 19, 'rg_bench_stone'), (-4, 17, 'rg_lantern_grey'), (4, 17, 'rg_lantern_grey'), (-4, 21, 'rg_planter_white'), (4, 21, 'rg_planter_white')):
    if free_(x, y, 0): P(nm, x, y)
# ---- rock outcrops with flowers, then flower drifts: white and blue, thickest by the beds and the paths
for (x, y, big) in ((-21, -13, 'bigRockGrey'), (21, -13, 'boulderGrey'), (-22, 12, 'boulderGrey'), (22, 12, 'bigRockGrey'), (-11, 21, 'rockGreyPair'), (11, 21, 'rockGreyPair'), (-23, -2, 'rockGreyPair'), (23, -2, 'rockGreyPair')):
    P(big, x, y)
    for k in range(3): P(rnd.choice(('rg_rock_grey_small', 'stoneGrey', 'rockGreyB')), x + rnd.randint(-2, 2), y + rnd.randint(1, 2))
    for k in range(3): P(rnd.choice(('flowersWhite', 'rg_flower_white', 'flowersBlue', 'rg_tiny_white')), x + rnd.randint(-3, 3), y + rnd.randint(-2, 3))
for cx, cy, n in ((-8, 17, 7), (8, 17, 7), (-8, -4, 6), (8, -4, 6), (-16, -4, 5), (16, -4, 5), (-16, 13, 6), (16, 13, 6), (0, -12, 6), (-12, -11, 5), (12, -11, 5), (-4, 22, 4), (4, 22, 4), (-19, 5, 4), (19, 5, 4)):
    for k in range(n): P(rnd.choice(('flowersWhite', 'rg_flower_white', 'rg_tiny_white', 'flowersBlue', 'rg_tiny_blue2', 'rg_clump')), cx + rnd.randint(-3, 3), cy + rnd.randint(-2, 2))
# ---- clean up: no two things on one tile, no flowers drawn over a stone's foot, no small rock hard against a marker
DECAL = ('flowers', 'rg_flower', 'rg_tiny', 'rg_clump', 'rg_bed', 'rg_mound')
STRUCT = ('stoneRing', 'rg_pillar', 'rg_lantern', 'vase', 'bowl', 'benchTeal', 'rg_bench', 'rg_planter', 'rg_basin', 'jRocks')
order = sorted(range(len(props)), key=lambda i: (0 if props[i][0].startswith(STRUCT) else 1 if props[i][0].startswith('standingStone') else 2 if SOLID_(props[i][0]) else 3, i))
kept = []; cells = {}
for i in order:
    nm, x, y = props[i]
    near = [cells[(x + a, y + b)] for a in (-1, 0, 1) for b in (-1, 0, 1) if (x + a, y + b) in cells]
    same = cells.get((x, y))
    if nm.startswith(DECAL):
        if same and SOLID_(same): continue
        if any(SOLID_(n_) and not n_.startswith('standingStone') for n_ in near if False): continue
    elif same: continue
    elif not nm.startswith(('standingStone', 'rg_pillar', 'stoneRing')) and any(n_.startswith(('standingStone', 'rg_pillar')) for n_ in near) and nm.startswith(('rockGrey', 'stoneGrey', 'rg_rock', 'rg_boulder', 'stonesPair', 'rg_cairn')): continue
    kept.append(props[i]); cells.setdefault((x, y), nm)
props[:] = kept
deco = [
    ['fam', 'outcrop-s', -17, -18], ['fam', 'outcrop-s', 17, -18], ['fam', 'outcrop-b', -23, 20], ['fam', 'outcrop-s', 23, 20], ['fam', 'drift-a', -9, -15], ['fam', 'drift-b', 9, -15], ['fam', 'drift-a', -21, 8], ['fam', 'drift-c', 21, 8],
]
out = dict(door=[0, -6], noconnect=True, lim=24, paving=paving, plazas=plazas, props=props, deco=deco)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'L4.json'), 'w', encoding='utf8').write(json.dumps(out, separators=(',', ':')))
print('L4.json written:', len(props), 'props,', sum(1 for p in props if p[0].startswith('standingStone')), 'stones,', sum(1 for p in props if p[0] == TALL), 'tall,', sum(1 for p in props if p[0] == 'rockGreyB'), 'rockGreyB,', len(paving), 'paving runs')
