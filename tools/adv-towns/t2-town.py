"""Sailsport, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t2-town.py
then python3 -I tools/adv-towns/preview.py T2 out.png to see it with the real art.

The story of the place: a sailing port on the cape south-east of Aldermere. The harbour made it: a stone quay along the south beach with three piers out into the bay,
the fish market on the quay, the shipyard on the sand west of it, the lighthouse on the east point. The town climbs the slope north of the harbour: the high street comes
down from the Aldermere road (Route 24, north-west) in long bends to the market square where it levels out, with the Center and the Mart facing the square, and goes on
south to the quay. Sailors' cottages crowd the sand lanes on either side, terrace above terrace, each row with its net racks, boats on blocks and kitchen gardens behind;
the chandler's warehouse stands at the head of the quay. North of the cottages the land is the harbour's farm: market gardens and the orchard round the pond, hay and the
windmill on the hill; woods close in along the north and west edges. The sea is south (from y ~+31 to +41) and east (from x ~+36). Exits: north (-24, -48) the road
from Aldermere."""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

LIM = 50
g = kit.Town(LIM - 2, 'T2')
N = LIM - 2
# ---- the shore, as the world has it (first water row per column, first water column per row): nothing is built or planted in the sea
SW = [31, 33, 33, 33, 34, 34, 34, 35, 35, 35, 35, 36, 36, 36, 36, 37, 37, 37, 37, 38, 38, 38, 38, 39, 39, 39, 39, 40, 40, 40, 40, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 40, 40, 41, 41, 40, 40, 40, 40, 37, 37, 38, 39, 38, 38, 38, 38, 37, 37, 37, 37, 34, 34, 34, 34, 34, 33, 33, 33, 32, 33, 33, 33, 31, 31, 31, 31, 31, 31, 27, 27, 27, 24, 24, 24, 21, 21, 99, 99, 99, 99, 99, 99]
EW = [44, 44, 44, 44, 44, 44, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 43, 46, 46, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 46, 46, 46, 46, 43, 43, 43, 41, 41, 41, 38, 38, 38, 35, 35, 35, 35, 29, 25, 22, 17, 17, 17, 5, 5, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0]
SS = [21, 22, 23, 25, 26, 27, 28, 29, 30, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 33, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 37, 37, 37, 34, 34, 34, 34, 34, 35, 35, 35, 35, 36, 35, 35, 35, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 34, 31, 30, 32, 32, 29, 28, 27, 26, 25, 25, 31, 31, 23, 23, -27, -34, -42, -46, -48, -48, -48, -48, -48, -48, -48, -48, -48]
ES = [40, 40, 39, 39, 39, 39, 38, 38, 38, 38, 38, 38, 38, 38, 37, 37, 37, 37, 37, 37, 37, 36, 36, 36, 36, 36, 36, 36, 36, 37, 37, 39, 41, 41, 42, 44, 44, 45, 46, 46, 47, 47, 48, 48, 48, 48, 48, 48, 48, 99, 48, 48, 48, 48, 48, 48, 47, 47, 47, 46, 46, 45, 44, 44, 44, 42, 41, 39, 39, 37, 36, 34, 34, 30, 29, 28, 27, 26, 23, 22, 22, 22, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
def water(x, y):
    if not (-N <= x <= N and -N <= y <= N): return False
    return y >= SW[x + N] or x >= EW[y + N]
def wet(x, y, m=1): return any(water(x + i, y + j) for i in range(-m, m + 1) for j in range(-m, m + 1))
g.claim([(x, y) for y in range(-N, N + 1) for x in range(-N, N + 1) if water(x, y)], 'sea')

WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
BEDPAIRS = [('rg_bed_pink', 'rg_bed_yellow'), ('rg_bed_white', 'rg_bed_pink'), ('rg_bed_yellow', 'rg_bed_white'), ('rg_planter_pink', 'rg_planter_orange'), ('rg_bed_pink', 'rg_bed_white'), ('rg_planter_green', 'rg_bed_yellow')]
SLIM = ['rg_slim_green', 'rg_cone_green', 'rg_slim_teal', 'rg_cone_teal', 'mFirGreen', 'mFirTeal']
COT = ['houseBlueRoof', 'houseBlueSplit', 'houseBlueGable', 'cottageTeal', 'houseBlueDome', 'houseRedRoof', 'cottageRed', 'houseBlueTall']
BIG = ['rg_house_red_a', 'rg_house_wood_b', 'rg_house_red_c', 'rg_house_wood_d', 'rg_house_red_b', 'rg_house_wood_a', 'rg_house_red_d', 'rg_house_wood_c']
MIX = COT + COT + BIG
RESERVED = {(-9, -9), (-10, 11), (2, 8)}                                     # where the freight crew, the Horseshoe hand and the coast guide stand (data/adv/npcs.js)
g.claim(list(RESERVED), 'npc')                                                  # the people who stand here keep their tile clear
def free_ground(cells): return all(g.get(*c) in ('.', 'g', 'a') for c in cells)
BX = []
def sbox(name, cx, y):
    d = kit.plan.PROPS[name]; T = kit.T; px = (cx + .5) * T - d['door'][0]; py = y * T - 1
    return ((px - d['ax']) / T, (py - d['ay']) / T, (px - d['ax'] + d['sw']) / T, (py - d['ay'] + d['sh']) / T)
def plan_ok(name, cx, y, margin=.4):
    x0, y0, x1, y1 = sbox(name, cx, y)
    for b in BX:
        if x0 < b[2] + margin and b[0] < x1 + margin and y0 < b[3] - .3 and b[1] < y1 - .3: return False
    for yy in (y - 2, y - 1):
        for xx in range(int(x0 + .5), int(x1 - .5) + 1):
            if g.get(xx, yy) not in ('.', 'g', 'a', 'Z') and (xx, yy) != (cx, y - 1): return False
    return True
def lot(name, cx, y, **k):
    g.lot(name, cx, y, **k); BX.append(sbox(name, cx, y))
def plan_row(W, pool, r, tall, gapw=1):
    best = None
    for _ in range(250):
        seq, used = [], 0
        while True:
            c = [n for n in pool if kit.size(n)[1] <= tall and used + kit.size(n)[0] <= W + 1e-9]
            if not c: break
            n = r.choice(c); seq.append(n); used += kit.size(n)[0] + gapw
        left = W - used + gapw
        if best is None or (left, -len(seq)) < best[0]: best = ((left, -len(seq)), seq, left)
    return best[1], best[2]
def row(S, x0, x1, pool, dy=1, walk='d', beds=None, tall=99, seed=0, gapw=1, extra_gap=0, hedge=None):
    """a row of lots along the lane whose row is S: doors at S - dy, the run x0..x1 filled with buildings from the pool, the slack spread between them"""
    r = random.Random(seed or S * 37 + x0); placed = []
    seq, slack = plan_row(x1 - x0 + 1, pool, r, tall, gapw)
    gaps = [gapw] * (len(seq) + 1)
    for _ in range(max(0, int(slack))): gaps[r.randrange(len(gaps))] += 1
    cur = x0 + gaps[0] - gapw
    for n, name in enumerate(seq):
        for cx in range(int(cur) - 2, int(cur) + 8):
            cells = g.box(name, cx, S - dy, bld=True); bx = sbox(name, cx, S - dy)
            if not cells or bx[0] < cur - .6 or bx[2] > x1 + 1.3: continue
            if not (g.free(cells) and free_ground(cells)) or any((cx + i, S - dy) in g.occ for i in (-1, 0, 1)): continue
            if any(abs(c[0] - a) <= 1 and abs(c[1] - b) <= 1 for c in cells for a, b in RESERVED) or not plan_ok(name, cx, S - dy): continue
            if any(water(xx, yy) for xx in range(int(bx[0]), int(bx[2]) + 1) for yy in range(int(bx[1]), int(bx[3]) + 2)): continue
            kw = dict(street_y=S, walk=walk); kw['beds'] = beds if beds is not None else BEDPAIRS[(cx + S + n) % len(BEDPAIRS)]
            lot(name, cx, S - dy, **kw); placed.append((name, cx, bx)); cur = bx[2]; break
        cur += gaps[n + 1]
    for i in range(len(placed) - 1):
        a, b = placed[i][2], placed[i + 1][2]
        if b[0] - a[2] >= 1.0:
            for k in range(4):
                if g.prop(SLIM[(S + i + k) % len(SLIM)], int((a[2] + b[0]) / 2), S - dy - 1): break
    return placed
def st(x0, y0, x1, y1, ch='p'): g.rect(x0, y0, x1, y1, ch)
def scatter(kinds, x0, y0, x1, y1, n, mind=3, seed=1, tries=600, walk=False, dry=True):
    r = random.Random(seed); got = []
    for _ in range(tries):
        if len(got) >= n: break
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        if (x, y) in g.occ or (dry and wet(x, y, 1)) or any(abs(x - a) < mind and abs(y - b) < mind for a, b in got): continue
        if g.prop(r.choice(kinds), x, y, walk=walk): got.append((x, y))
    return got
def pockets(x0, y0, x1, y1, w, h, n, margin=1, seed=1):
    r = random.Random(seed); out = []; cands = [(x, y) for y in range(y0, y1 - h + 2) for x in range(x0, x1 - w + 2)]; r.shuffle(cands)
    for x, y in cands:
        if len(out) >= n: break
        if any(x < ox + w + 1 and ox < x + w + 1 and y < oy + h + 1 and oy < y + h + 1 for ox, oy in out): continue
        if any(b[0] < x + w + .6 and x - .6 < b[2] and b[1] < y + h + .6 and y - .6 < b[3] for b in BX): continue
        if all(g.get(i, j) == '.' and (i, j) not in g.occ and not water(i, j) for j in range(y - margin, y + h + margin) for i in range(x - margin, x + w + margin)): out.append((x, y))
    return out

# ================================================================ streets
st(-24, -48, -23, -23); st(-24, -24, -2, -23); st(-3, -24, -2, -4)                              # the high street from the Aldermere road (exit): a long straight run down, one long run across the slope, one down to the square (two bends)
g.exit(-24, -48, 'N')
st(-10, -3, 8, 5, 't')                                                                        # the market square, where the slope levels out
for a_, b_, c_, d_ in ((-9, -2, -5, 0), (4, -2, 7, 0)): st(a_, b_, c_, d_, 'g')
g.lane([(1, 6), (1, 18), (7, 18), (7, 32)], 2, 'p')                                            # the high street goes on south to the quay
st(-28, 32, 20, 33, 'p')                                                                      # the quay along the head of the beach
st(-5, 34, 13, 37, 't')                                                                       # the fish market, widening the quay at the high street's foot
FENCES = []; TERR = []
def lane(x0, y0, x1, y1, pool, seed, rows=True):
    """a straight sand lane (1 wide); with rows, cottages along its north side are laid once all the paving is down"""
    g.rect(x0, y0, x1, y1, 'd')
    if rows and y0 == y1: TERR.append((y0, x0, x1, pool, seed))
def ex(y): return 34                                                       # the last dry column of a terrace on the east cape
st(-46, -42, -46, 31, 'd')                                                                       # the west spine joins the terraces' western ends

# ================================================================ the Center and the Mart on the square's north side; the chandler at the head of the quay; the lighthouse
lot('pokeCenterWave', -7, -4, street_y=-3, walk='t', role='center', beds=('rg_planter_pink', 'rg_planter_orange'))
lot('martWave', 3, -4, street_y=-3, walk='t', beds=('rg_planter_orange', 'rg_planter_pink'))
lot('sSilverWarehouse', 15, 31, street_y=33, walk='p', beds=())                                  # the chandler's, at the head of the quay
lot('roundTower', 33, 27, walk='d', beds=())                                                    # the lighthouse on the east point

# ================================================================ cottages on straight terraces along the slope, linked here and there by short straight steps lanes
g.claim([(x, y) for y in range(-50, -44) for x in range(-40, -30)], 'pond')                      # the little pond in the north-west corner stays clear
WEST = [(-42, -45, -25, COT), (-34, -45, -25, MIX), (-26, -40, -25, MIX), (-17, -45, -4, MIX), (-9, -44, -12, MIX), (-1, -45, -11, MIX), (8, -41, 0, MIX), (17, -45, 0, COT), (25, -33, 6, COT)]
EAST = [(-24, -1, 30, MIX), (-15, -1, 34, MIX), (-7, -1, 28, MIX), (-1, 9, 34, MIX), (9, 3, 30, MIX), (17, 3, 34, COT), (25, 9, 30, COT)]
for y, x0, x1, pool in WEST + EAST: lane(x0, y, x1, y, pool, y)
STEPS = [(-38, -42, -34), (-31, -34, -26), (-36, -26, -17), (-29, -17, -9), (-39, -9, -1), (-22, -1, 8), (-33, 8, 17), (-27, 17, 25), (-42, 17, 25), (-12, 8, 17), (-33, 25, 27),
         (12, -24, -15), (28, -15, -7), (20, -7, -1), (29, -1, 9), (14, 9, 17), (24, 17, 25), (10, 17, 25), (34, -30, -15), (30, -30, -24), (22, 25, 28), (-3, -30, -24)]
for x, y0, y1 in STEPS: lane(x, y0, x, y1, None, 0, rows=False)
st(-11, 10, -10, 12, 'd')                                                                        # a small yard where the rough rider's teacher stands
lane(-22, -30, 34, -30, None, 0, rows=False)                                                    # the farm track, from the high street across to the east cape
lane(22, 28, 33, 28, None, 0, rows=False)                                                       # the lighthouse path
for y, x0, x1, pool, seed in TERR:                                                               # the cottages, once the paving is down
    row(y, x0 + 1, x1 - 1, pool, tall=4.6, gapw=1, seed=seed * 17 + 3); FENCES.append((x0 + 1, x1 - 1, y))
row(33, -27, -6, COT, dy=2, walk='p'); row(33, 15, 17, COT, dy=2, walk='p'); row(33, 20, 33, COT, dy=2, walk='p', beds=('rg_planter_pink', 'rg_planter_orange'))     # the sea front: cottages facing the quay
# a bench, a lamp and a bed where a terrace runs out
for y, x0, x1, pool in WEST + EAST:
    for ex_, dx_ in ((x0, -1), (x1, 1)):
        nb = sum(g.get(ex_ + a_, y + b_) in ('d', 'p', 't') for a_, b_ in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if nb <= 1:
            g.prop('rg_bench', ex_ + dx_, y, walk=True); g.prop('rg_lamp', ex_ + dx_, y - 1, walk=True); g.prop(BEDS[(ex_ + y) % 3], ex_ + dx_, y + 1, walk=True)

# ================================================================ the market square: fountain, stalls, benches, beds
g.prop('maFountain', -1, 3, walk=True)
g.props('rg_bench', [(-7, 2), (5, 2), (-4, 4), (3, 4)], walk=True); g.props('rg_lamp', [(-10, -3), (8, -3), (-10, 5), (8, 5), (-4, -3), (3, -3), (-5, 1), (4, 1)], walk=True)
for i, (x, y) in enumerate(((-8, -1), (6, -1), (-6, -2), (5, -2), (-9, 1), (7, 1))): g.prop(BEDS[i % 3], x, y, walk=True)
g.props('rg_young_pink0', [(-7, -1)], walk=True); g.props('rg_young_teal0', [(5, -1)], walk=True)
g.props('rg_planter_tall_pink', [(-10, 0), (8, 0), (-10, 3), (8, 3)], walk=True); g.props('rg_planter_tall_orange', [(-4, -2), (3, -2), (-6, 5), (4, 5)], walk=True)
g.prop('pxStallBlue', -8, 4, walk=True); g.prop('rg_stall_rug', 6, 4, walk=True)
g.props('crateWide', [(-9, 5), (7, 5)], walk=True); g.props('barrelOrange', [(-6, 4), (8, 4)], walk=True)
g.prop('pokeSign', -5, -4, walk=True); g.prop('mNoticeBoard', 1, -4, walk=True); g.drift(-9, -2, 7, 0, SMALL, every=2)
st(-11, -12, -4, -8, 't')                                                                          # Sailors' Green: a small paved court off the high street (the freight crew stands here)
g.props('rg_bench', [(-9, -11), (-6, -11)], walk=True); g.props('rg_lamp', [(-11, -12), (-4, -12)], walk=True)
for i, (x, y) in enumerate(((-10, -9), (-5, -9), (-8, -12), (-7, -12))): g.prop(BEDS[i % 3], x, y, walk=True)
g.props('rg_planter_tall_pink', [(-11, -8), (-4, -8)], walk=True); g.prop('rg_fountain2', -7, -9, walk=True)

# ================================================================ the quay: the fish market, boats and piers
g.props('pxStallBlue', [(-1, 36)], walk=True); g.props('pxStallPink', [(8, 36)], walk=True); g.props('marketAwning', [(3, 36)], walk=True)
g.props('crateWide', [(-4, 35), (5, 35), (11, 36), (12, 35)], walk=True); g.props('crateBox', [(-3, 37), (10, 37)], walk=True); g.props('barrelOrange', [(-5, 36), (12, 37), (6, 37)], walk=True)
g.props('barrelDark', [(0, 37), (7, 35)], walk=True); g.props('seedSack', [(1, 35), (9, 37)], walk=True)
g.props('rg_lamp', [(-5, 34), (13, 34), (-5, 37), (13, 37), (4, 34)], walk=True); g.props('rg_bench', [(-20, 34), (18, 34)], walk=True)
g.props('wBollard', [(x, 33) for x in range(-26, 20, 4) if not -6 <= x <= 14], walk=True)
g.props('rg_lamp', [(-26, 32), (-14, 32), (-2, 32), (-8, 32), (14, 32), (20, 32)], walk=True)
for nm, x, y in (('maSailboat', -8, 45), ('boatWhite', 0, 44), ('maRowboat', 8, 44), ('maSailboat', 17, 43), ('speedboat', 7, 40), ('maRowboat', -17, 42), ('boatWhite', -12, 41), ('rg_water_raft', 15, 40)): g.prop(nm, x, y, force=True)
g.props('rg_lantern', [(-3, 47), (4, 47), (12, 47), (-6, 47)], force=True); g.props('wBollard', [(-3, 41), (-2, 41), (3, 41), (4, 41), (11, 41), (12, 41), (-3, 44), (-2, 44), (3, 44), (4, 44), (11, 44), (12, 44)], force=True)

# ================================================================ the shipyard, on the sand west of the quay
st(-45, 26, -34, 31, 'd')
lot('warehouse', -40, 26, street_y=27, walk='d', beds=())
for nm, x, y in (('maSailboat', -37, 31), ('maRowboat', -43, 30), ('boatWhite', -35, 29), ('rg_logs', -44, 28), ('rg_woodpile', -45, 29), ('fallenLog', -36, 27), ('rg_crates', -42, 31), ('rg_barrel', -38, 29), ('ladder', -34, 28), ('logShort', -35, 31)): g.prop(nm, x, y, walk=True)

# ================================================================ the north: market gardens, the orchard, hay and the windmill, a farmstead on a track
lot('barnRed', 2, -31, street_y=-30, walk='d', beds=()); lot('cottageGreen', 12, -31, street_y=-30, walk='d')
g.prop('maWindmill', 24, -37)
g.trees(-12, -47, 6, -37, FRUIT, dx=3, dy=3, seed=2)
g.plot(8, -46, 12, 6, 1); g.plot(20, -35, 10, 4, 0)


# ================================================================ the paddock between the lanes: a fenced pasture with a trough, hay and a shed
def pen(x0, y0, x1, y1, fence='wLogFence', gate=None):
    if not all(g.get(x, y) == '.' and (x, y) not in g.occ for x in range(x0 - 1, x1 + 2) for y in range(y0 - 1, y1 + 2)): print('  T2: pen at', x0, y0, 'skipped'); return
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if gate is None or not (gate[0] <= x <= gate[1] and y == gate[2]): g.prop(fence, x, y)
    for y in range(y0 + 1, y1):
        for x in (x0, x1): g.prop(fence, x, y)
# ================================================================ allotments in two blocks, a pasture and sheds on the east cape, nets and boats by the shore
CROPS = ('leafPlantB', 'leafPlant', 'leafPlantC', 'rg_sunflowers')
def pen(x0, y0, x1, y1, fence='wLogFence', gate=None):
    if not all(g.get(x, y) == '.' and (x, y) not in g.occ for x in range(x0 - 1, x1 + 2) for y in range(y0 - 1, y1 + 2)): print('  T2: pen at', x0, y0, 'skipped'); return
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if gate is None or not (gate[0] <= x <= gate[1] and y == gate[2]): g.prop(fence, x, y)
    for y in range(y0 + 1, y1):
        for x in (x0, x1): g.prop(fence, x, y)
def allot(x, y, cols, rows, crops):
    """a block of kitchen gardens, each 6 x 3 with a lane of lawn between; only the plots that fit open ground are laid"""
    n = 0
    for j in range(rows):
        for i in range(cols):
            x0, y0 = x + i * 7, y + j * 5
            if all(g.get(a, b) == '.' and (a, b) not in g.occ and not wet(a, b, 0) for b in range(y0 - 1, y0 + 4) for a in range(x0 - 1, x0 + 7)) and not any(b_[0] < x0 + 7 and x0 - 1 < b_[2] and b_[1] < y0 + 4 and y0 - 1 < b_[3] for b_ in BX):
                g.field(x0, y0, x0 + 5, y0 + 2, crops[(i + j) % len(crops)], every=1); n += 1
    return n
allot(-46, -19, 3, 2, CROPS); g.prop('rg_hut_round', -25, -13); g.props('rg_barrel_water', [(-27, -16), (-27, -12)]); g.prop('rg_scarecrow', -33, -13)
allot(-46, 10, 3, 2, CROPS[::-1]); g.prop('rg_hut_round', -23, 12); g.props('rg_barrel_water', [(-26, 15)])
for nm, x, y in (('maRowboat', -22, 37), ('boatWhite', -16, 38), ('maRowboat', -10, 38), ('boatWhite', 18, 35), ('maRowboat', 24, 33), ('maRowboat', -30, 36), ('rg_raft', -26, 37), ('rg_raft', 21, 34)): g.prop(nm, x, y, walk=True)    # boats drawn up on the beach
for (x, y) in pockets(-46, 16, 40, 30, 3, 2, 8, seed=5): g.prop('fenceLattice', x + 1, y + 1)                              # nets hung out to dry
for (x, y) in pockets(-30, 18, 34, 31, 2, 2, 10, seed=7): g.prop(('rg_barrel', 'rg_crates', 'rg_woodpile', 'rg_logs')[(x + y) % 4], x, y)

# ================================================================ picket fences along the south side of the lanes, with a gap now and then for a path
for k, (x0, x1, y) in enumerate(FENCES):
    for x in range(x0, x1 + 1):
        if (x + k) % 7 == 0: continue
        if g.get(x, y + 1) == '.' and not wet(x, y + 1, 0): g.prop('mPicketFence', x, y + 1)

# ================================================================ the shore: sand tables, palms, shells, driftwood and rocks
def sand(x, y): return -N <= x <= N and -N <= y <= N and not water(x, y) and (y >= SS[x + N] or x >= ES[y + N])
beach = [(x, y) for y in range(-N, N + 1) for x in range(-N, N + 1) if sand(x, y)]
R = random.Random(8)
for nm, k in (('rg_shells', 60), ('rg_sea_stone', 30), ('rg_sea_pebble', 40), ('shell', 30), ('rg_seaweed', 14), ('rg_rock_grey_small', 14), ('rg_boulder_grey', 6), ('rg_log', 10), ('fallenLog', 10), ('rg_rock', 6)):
    for _ in range(k):
        x, y = R.choice(beach)
        if (x, y) not in g.occ and not (-46 <= x <= -33 and 25 <= y <= 32): g.prop(nm, x, y, walk=nm in ('rg_shells', 'shell', 'rg_sea_pebble'))
for _ in range(36):
    x, y = R.choice(beach)
    if (x, y) not in g.occ and (y > 33 or x > 36 or x < -44) and not wet(x, y, 1): g.prop(R.choice(('rg_palm', 'rg_palm2', 'palmTree', 'palmTreeBig')), x, y)

g.trees(36, -22, 44, 24, WOOD[:4] + ['rg_palm', 'rg_palm2'], dx=3, dy=3, seed=21, skip=lambda x, y: sand(x, y) or wet(x, y, 1) or x > ES[y + N] - 4)      # a tree belt on the cape's lawn
g.claim([c for c in beach if c not in g.occ], 'sand')                                           # the beach stays open sand
# ================================================================ woods round the edges, then the greenery in what is left
g.trees(-48, -48, 40, -44, WOOD); g.trees(-48, -48, -45, 24, WOOD)
g.dress()
g.groves(-48, -48, 48, 48, WOOD, gap=1, min_area=5, styles=[('woods', WOOD), ('orchard', FRUIT), ('woods', WOOD), ('orchard', FRUIT), ('woods', WOOD)])
g.garden(-48, -48, 48, 48, every=3)
g.drift(-48, -48, 48, 48, SMALL, every=5)

g.done(dict(lim=LIM, hide_site_paths=True, boards=[[-3, 38, -2, 47], [3, 38, 4, 47], [11, 38, 12, 47], [-6, 46, 12, 47]]))
