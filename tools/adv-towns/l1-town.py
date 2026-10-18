"""Statue of Umbra, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/l1-town.py
then python3 -I tools/adv-towns/preview.py L1 out.png to see it with the real art. (This replaces the L1 part of landmarks.py, which still holds L2 and L3.)

The story of the place: an old stone tower on the green dunes above the north-west sea, a monument nobody can date, guarded by stone hounds. A round paved court
surrounds it, ringed by eight stone columns and lanterns; a hedge ring with four gates holds blue and white beds; beyond it dark spruce and teal woods close in on every
side, so the court is a clearing and the tower stands in the middle of it. The approach is a paved avenue lined with lanterns, hedges and standing stones running south from
the court gate; at its foot it turns into the sand track that leaves the clearing to the east, towards the end of the route. Nothing is built here but the monument:
no houses, no fence. Landmark with no exits; the plan stays the generator's circle of radius 26."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit
from snowkit import tint

g = kit.Town(24, 'L1')
DARK = ['rg_pine_teal0', 'rg_pine_teal1', 'rg_pine_olive0', 'rg_pine_green0', 'rg_pine_green1', 'rg_tall_teal0', 'rg_tall_teal1', 'rg_round_teal0', 'rg_round_teal1', 'rg_tall_green0', 'rg_round_olive0', 'rg_round_green0', 'rg_pine_teal1']
SLIM = ['rg_slim_teal', 'rg_slim_olive', 'rg_cone_teal', 'rg_cone_olive', 'rg_slim_green']
BLOSSOM = ['rg_round_pink0', 'rg_round_pink1', 'rg_young_pink0']
LOW = ['rg_tiny_blue', 'rg_tiny_blue2', 'rg_tiny_white', 'rg_tiny_white2', 'rg_flower_white', 'rg_clover', 'rg_clover2', 'rg_clump_green', 'flowersBlue', 'flowersWhite']
BUSH = ['rg_bush_teal', 'rg_bush_green', 'rg_bush_olive', 'whiteBlossomBush', 'roseBush']

def disc(r, ch, cx=0, cy=0):
    for y in range(-g.N, g.N + 1):
        for x in range(-g.N, g.N + 1):
            if math.hypot(x - cx, y - cy) <= r: g.put(x, y, ch)
def polar(r, a): return round(r * math.cos(a)), round(r * math.sin(a))
def ring(names, r, n, phase=0.0, skip=None, **kw):
    c = 0
    for i in range(n):
        a = phase + 2 * math.pi * i / n; x, y = polar(r, a)
        if skip and skip(x, y): continue
        c += g.prop(names[i % len(names)] if isinstance(names, (list, tuple)) else names, x, y, **kw)
    return c

# ================================================================ ground and paving
disc(22, 'g')                                                                                   # the clearing's lawn
disc(9.4, 'p'); disc(5.6, 't')                                                                  # the court, and its inner ring of tan stone
g.rect(-1, 9, 1, 16, 'p')                                                                       # the avenue south from the court gate
g.rect(-1, 17, 24, 18, 'p')                                                                     # the sand track east, out of the clearing
g.claim([(x, y) for x in range(9, 25) for y in (17, 18)], 'track')       # the avenue turns east and runs paved to the clearing's edge, where the route takes it on                           # nothing is planted on it
for sx, sy, ex, ey in ((-1, -15, 1, -10), (10, -1, 15, 1), (-15, -1, -10, 1)): g.rect(sx, sy, ex, ey, 'p')   # the three small gates: a paved step to a 3 x 3 pad each (a bench court)

# ================================================================ the monument
g.prop('maTowerOct', 0, -1, walk=True)                                                          # the old stone tower
g.props('statueDog', [(-3, 1), (3, 1), (-4, -3), (4, -3)], walk=True)                          # the stone hounds that guard it
g.props('rg_pillar', [(-5, -1), (5, -1)], walk=True); g.props('vaseGold', [(-2, 0), (2, 0)], walk=True); g.props('crystalDarkB', [(-5, 3), (-6, 3)], walk=True); g.props('crystalDark', [(6, 0), (5, 3), (6, 3)], walk=True)
ring('rg_column', 7.6, 8, phase=math.pi / 8, walk=True, skip=lambda x, y: y > 6 and abs(x) < 3)  # the eight columns round the court
ring(['rg_lantern_grey', 'rg_lantern'], 8.6, 16, phase=0.0, walk=True, skip=lambda x, y: y > 7 and abs(x) < 3)
ring('rg_bench_stone', 4.6, 4, phase=math.pi / 4, walk=True)

# ================================================================ the hedge ring, its gates and beds
gate = lambda x, y: (abs(x) <= 2 and abs(y) > 9) or (abs(y) <= 2 and abs(x) > 9)
ring('hedgeLong', 11.6, 56, skip=gate)
ring(['flowerBedBlue', 'rg_bed_white'], 10.6, 30, phase=0.05, walk=True, skip=gate)
for (x, y, bx, by) in ((0, -14, 0, -15), (14, 0, 15, 0), (-14, 0, -15, 0)):
    g.prop('rg_bench_stone', bx, by, walk=True); g.props('rg_lantern', [(x - 1 if y else x, y - 1 if not y else y), (x + 1 if y else x, y + 1 if not y else y)], walk=True)

# the outer ring of low planting between the hedge and the wood
ring(['roseBush', 'whiteBlossomBush', 'rg_bush_teal', 'roseBush', 'rg_bush_green'], 12.9, 44, phase=0.02, skip=lambda x, y: gate(x, y) or (y > 8 and abs(x) < 6))
# ================================================================ the avenue and the track
for y in range(10, 17, 3): g.props('rg_lantern_grey', [(-2, y), (2, y)], walk=True)
for y in (11, 14): g.props('hedgeLong', [(-4, y), (4, y)])
g.props('standingStoneMintTall', [(-3, 12), (3, 12), (-3, 15), (3, 15)]); g.props('whiteBlossomBush', [(-4, 16), (4, 16), (-3, 10), (3, 10)]); g.props('roseBush', [(-4, 13), (4, 13)])
g.props('flowerBedBlue', [(-5, 17), (5, 15)], walk=True); g.props('rg_bed_white', [(5, 13)], walk=True)
for x in range(3, 21, 3): g.props('rg_lantern_grey' if x % 2 else 'rg_lantern', [(x, 16)], walk=True)
for x in range(4, 21, 3): g.props(['rg_post_stone', 'standingStoneMintTall'][x % 2], [(x, 19)]); g.props(['roseBush', 'whiteBlossomBush', 'rg_bush_teal'][x % 3], [(x + 1, 20)])
for x in range(10, 21, 2): g.props('hedgeLong' if x % 4 else 'rg_bed_white', [(x, 15)], walk=x % 4 == 0)
for x in range(8, 21, 6): g.props('rg_boulder_grey', [(x + 2, 21)])
g.prop('rg_sign_board', 2, 19); g.props('dryTuft', [(8, 19), (14, 20), (18, 19)], walk=True)

# ================================================================ planting: spruce and teal woods close round the clearing, blossom trees by the court
for (x, y) in ((-14, -4), (-14, 4), (14, -5), (14, 5), (-6, -14), (6, -14), (-8, 14), (8, 13)): g.prop(BLOSSOM[(x + y) % 3], x, y)
g.props('stoneRing', [(-12, -9), (12, -9), (-12, 10), (12, 10)])                                # four stone planting rings round the hedge, a blossom tree in each
for (x, y) in ((-12, -9), (12, -9), (-12, 10), (12, 10)): g.prop('rg_round_pink0' if x < 0 else 'rg_round_pink1', x, y - 1, force=True)
g.props('statueDog', [(-3, 9), (3, 9), (-1, 17), (1, 17)], walk=True)
edge = lambda x, y: 14.2 + 1.6 * math.sin(3 * math.atan2(y, x) + 1.0) + 1.0 * math.sin(5 * math.atan2(y, x))      # the wood's inner edge wanders
inner = lambda x, y: math.hypot(x, y) < edge(x, y) or math.hypot(x, y) > 25
g.trees(-24, -24, 24, 24, DARK, dx=2, dy=1, skip=inner, seed=4)
g.trees(-24, -24, 24, 24, SLIM, dx=3, dy=2, skip=lambda x, y: math.hypot(x, y) < 12.8 or math.hypot(x, y) > edge(x, y) + 1.5, seed=9)
for (x, y) in ((-17, -9), (17, -10), (-18, 8), (18, 8), (-10, -18), (10, -18), (-10, 19), (4, 22)): g.prop('rg_boulder_grey', x, y)
for (x, y) in ((-15, -7), (15, -8), (-16, 6), (16, 6), (-12, -16), (12, -16), (-12, 17), (9, 21)): g.prop('rg_rock_grey_tall', x, y)
g.groves(-24, -24, 24, 24, DARK, gap=1, min_area=5, styles=[('woods', DARK), ('meadow', LOW)])
# the open lawns still left: a flower bed with bushes and a small tree in each, so no patch is bare
op = g.openmask(-24, -24, 24, 24, 1); seen = set(); k = 0
for c in sorted(op):
    if c in seen: continue
    comp, st = [], [c]; seen.add(c)
    while st:
        q = st.pop(); comp.append(q)
        for n in ((q[0] + 1, q[1]), (q[0] - 1, q[1]), (q[0], q[1] + 1), (q[0], q[1] - 1)):
            if n in op and n not in seen: seen.add(n); st.append(n)
    if len(comp) < 9: continue
    mx = sorted(comp)[len(comp) // 2]; k += 1
    g.prop(['flowerBedBlue', 'flowerBedPink', 'rg_bed_white'][k % 3], mx[0], mx[1], walk=True); g.prop(BUSH[k % 5], mx[0] + 2, mx[1]); g.prop(BUSH[(k + 2) % 5], mx[0] - 2, mx[1]); g.prop(BLOSSOM[k % 3] if k % 2 else 'rg_young_teal0', mx[0] + 1, mx[1] - 2)
    g.props('rg_rock_grey_small', [(mx[0] - 1, mx[1] + 1)])
g.garden(-24, -24, 24, 24, every=3)
g.drift(-24, -24, 24, 24, LOW, every=4)
g.pp = [q for q in g.pp if math.hypot(q[1], q[2]) <= 25.2]                                       # nothing outside the generator's circle of radius 26
g.done(dict(lim=26, noconnect=True, hide_site_paths=True))
