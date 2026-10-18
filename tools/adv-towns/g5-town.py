"""Aldermere City, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g5-town.py
then python3 -I tools/adv-towns/preview.py G5 out.png to see it with the real art.

The story of the place: the capital of the east coast, and the only place in the world with planned streets. The old town grew where the coast road from the
west met the north-south trade road: its cobbled lanes wander between tall blue-roofed houses west of the crossing, round a little square with a well. When the
city prospered the crossing became the Grand Plaza (the fountain where the roads met, now an island inside a ring road), the trade road became the boulevard
(stone carriageway, tan sidewalks, lamps and a tree every few steps) and the coast road the avenue. The new town was laid out on purpose, east of the old one:
straight streets every seventeen steps, each block two rows of houses and shops back to back across a service lane, lawns, hedges and a tree to every front
garden. The civic quarter lines the avenue and the plaza (the Center, the museum hall, the clock, the market tower and the gym, the tall hall on the plaza's east
side), the city park with its pond fills the north-east corner, and the freight yards and warehouses of the trade quarter lie in the south-east, where the
supply path from Sailsport comes in. Woods wall the city in except where the roads leave.
Exits: north (10, -50) the trade road from the north, south (14, 50) the boulevard south, south-west (-45, 50) the old coast track."""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

LIM = 52
g = kit.Town(LIM - 2, 'G5')
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
BLOSSOM = ['rg_round_pink0', 'rg_round_pink1', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
BEDPAIRS = [('rg_bed_pink', 'rg_bed_yellow'), ('rg_bed_white', 'rg_bed_pink'), ('rg_bed_yellow', 'rg_bed_white'), ('rg_planter_pink', 'rg_planter_orange'), ('rg_bed_pink', 'rg_bed_white'), ('rg_planter_green', 'rg_bed_yellow')]
HEDGES = ['mHedgeLongGreen', 'mHedgeLongTeal', 'mHedgeLongGreen']
SLIM = ['rg_slim_green', 'rg_cone_green', 'rg_slim_teal', 'rg_cone_teal', 'mFirGreen', 'mFirTeal', 'poplarTall']
STREET_TREES = ['rg_young_green0', 'rg_young_teal0', 'rg_young_green1', 'rg_young_teal1']
RES = ['rg_house_red_a', 'rg_house_wood_b', 'rg_house_red_c', 'rg_house_wood_d', 'rg_house_red_b', 'rg_house_wood_a', 'rg_house_red_d', 'rg_house_wood_c']
OLD = ['houseBlueSplit', 'houseBlueGable', 'houseBlueTall', 'houseBlueDome', 'cottageTeal', 'houseBlueRoof', 'houseBlueSplit', 'houseBlueTall', 'houseBlueGable', 'cottageRed']
TOWER = ['hotelGrey', 'mMintTower', 'maShopCyan', 'hotelBlue', 'sMartTower', 'mRoseTower', 'mMintApt', 'mRoseApt', 'mMintStore', 'mRoseStore', 'apartmentGrey', 'apartmentGreyWide', 'sCrossHospital', 'labWhite', 'tavern', 'sGoldInn']
SHOP = ['mMintShop', 'mRoseShop', 'mMintHall', 'mRoseHall', 'wHouseMint', 'mMintGable', 'mRoseGable']
WARE = ['warehouse', 'sSilverWarehouse', 'sTealStore', 'sSilverWarehouse', 'warehouse']
PL = ('rg_planter_tall_pink', 'rg_planter_tall_orange')
RESERVED = {(13, 14), (-2, 3), (13, 15), (-2, 2), (-2, 4)}                       # where the freight handler and the riding mistress stand (data/adv/npcs.js)

g.claim(list(RESERVED), 'npc')
def free_ground(cells): return all(g.get(*c) in ('.', 'g') for c in cells)
BX = []                                                                                    # the sprite boxes of every building placed so far (as the plan's own checks see them)
def sbox(name, cx, y):
    d = kit.plan.PROPS[name]; T = kit.T; px = (cx + .5) * T - d['door'][0]; py = y * T - 1
    return ((px - d['ax']) / T, (py - d['ay']) / T, (px - d['ax'] + d['sw']) / T, (py - d['ay'] + d['sh']) / T)
def plan_ok(name, cx, y, margin=.4):
    """what plan.build will check, plus a margin: no two sprites overlap, and the base of the sprite is not on paving (apart from its own door walk)"""
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
    """a sequence of buildings from the pool that fills a run W wide (each separated by at least gapw): the best of many random tries"""
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
def row(S, x0, x1, pool, dy=2, gap=(0, 1), walk=None, beds=None, tall=99, seed=0, skip=0, role='house', gapw=1, hedge=None):
    """a row of lots along the street whose top row is S: doors at S - dy; the run x0..x1 is filled with buildings from the pool, the slack spread between them"""
    r = random.Random(seed or S * 31 + x0); placed = []
    if walk is None: walk = 't' if S == 3 else 'p'
    seq, slack = plan_row(x1 - x0 + 1, pool, r, tall, gapw)
    gaps = [gapw] * (len(seq) + 1)
    for _ in range(max(0, int(slack))): gaps[r.randrange(len(gaps))] += 1
    cur = x0 + gaps[0] - gapw
    for n, name in enumerate(seq):
        for cx in range(int(cur) - 2, int(cur) + 8):
            cells = g.box(name, cx, S - dy, bld=True); bx = sbox(name, cx, S - dy)
            if not cells or bx[0] < cur - .6 or bx[2] > x1 + 1.3: continue
            if not (g.free(cells) and free_ground(cells)) or any((cx + i, S - dy) in g.occ for i in (-1, 0, 1)): continue
            if any((c[0], c[1]) in RESERVED for c in cells) or not plan_ok(name, cx, S - dy): continue
            kw = dict(street_y=S - 1 if S == 3 else S, walk=walk)                          # the avenue's walks end on its sidewalk
            kw['beds'] = beds if beds is not None else BEDPAIRS[(cx + S + n) % len(BEDPAIRS)]
            lot(name, cx, S - dy, **kw); placed.append((name, cx, bx)); cur = bx[2]
            if hedge and dy == 2 and S not in (3, -4):                                      # a clipped hedge along the front, with a gap for the walk
                for hx in range(int(bx[0] + .9), int(bx[2]), 2):
                    if abs(hx - cx) > 1: g.prop(hedge, hx, S - 1)
            break
        cur += gaps[n + 1]
    for i in range(len(placed) - 1):                                                       # a slim tree in every gap wide enough
        a, b = placed[i][2], placed[i + 1][2]
        if b[0] - a[2] >= 1.0:
            for k in range(4):
                if g.prop(SLIM[(S + i + k) % len(SLIM)], int((a[2] + b[0]) / 2), S - dy - 1): break
    return placed
def st(x0, y0, x1, y1, ch='p'): g.rect(x0, y0, x1, y1, ch)
def scatter(kinds, x0, y0, x1, y1, n, mind=3, seed=1, tries=600, walk=False):
    """n props from kinds scattered over a box, none within mind tiles of another from this call (a loose planting)"""
    r = random.Random(seed); got = []
    for _ in range(tries):
        if len(got) >= n: break
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        if (x, y) in g.occ or any(abs(x - a) < mind and abs(y - b) < mind for a, b in got): continue
        if g.prop(r.choice(kinds), x, y, walk=walk): got.append((x, y))
    return got
def pockets(x0, y0, x1, y1, w, h, n, margin=1, seed=1):
    """up to n free w x h rectangles of open ground inside the box, each kept `margin` clear of paving, buildings and props (the first ones found, scanning in a shuffled order)"""
    r = random.Random(seed); out = []; cands = [(x, y) for y in range(y0, y1 - h + 2) for x in range(x0, x1 - w + 2)]; r.shuffle(cands)
    for x, y in cands:
        if len(out) >= n: break
        if any(x < ox + w + 1 and ox < x + w + 1 and y < oy + h + 1 and oy < y + h + 1 for ox, oy in out): continue
        if any(b[0] < x + w + .6 and x - .6 < b[2] and b[1] < y + h + .6 and y - .6 < b[3] for b in BX): continue
        if all(g.get(i, j) == '.' and (i, j) not in g.occ for j in range(y - margin, y + h + margin) for i in range(x - margin, x + w + margin)): out.append((x, y))
    return out
def near_door(x, y): return any(abs(x - lx) <= 1 and ly - 3 <= y <= ly + 3 for _, lx, ly, _ in g.lots)
OUT = {(2, 'y'): 1, (5, 'y'): 6, (9, 'x'): 8, (12, 'x'): 13, (13, 'x'): 12, (16, 'x'): 17}
def furn(name, pts):
    """street furniture stands on the lawn just outside the sidewalk, so the tan walk stays clear"""
    for x, y in pts:
        if y in (2, 5): y = OUT[(y, 'y')]
        elif x in (9, 12, 13, 16): x = OUT[(x, 'x')]
        if any(abs(x - rx) <= 1 and abs(y - ry) <= 1 for rx, ry in RESERVED) or near_door(x, y): continue
        g.prop(name, x, y, walk=True)

def grove(x0, y0, x1, y1, kinds, dx=3, dy=2, seed=1, prob=1.0, jit=1):
    """trees on a loose staggered lattice (the kit's g.trees wants two clear tiles round every trunk, which a city's lawns rarely have): a trunk needs open ground under it
    and beside it, and open ground under its canopy; nothing stands on a walk"""
    r = random.Random(seed); n = 0
    for j, y in enumerate(range(y0, y1 + 1, dy)):
        for x in range(x0 + (j % 2) * (dx // 2), x1 + 1, dx):
            if r.random() > prob: continue
            x_, y_ = x + r.randint(-jit, jit), y + r.randint(0, 1 if jit else 0)
            if near_door(x_, y_) or (x_, y_) in g.occ: continue
            if any(g.get(x_ + i, y_ + k) not in ('.', 'g') or (x_ + i, y_ + k) in g.occ for i, k in ((0, 1), (-1, 0), (1, 0), (-1, 1), (1, 1))): continue
            if any(g.get(x_ + i, y_ + k) not in ('.', 'g') for i in (-1, 0, 1) for k in (-2, -1)): continue
            nm = r.choice(kinds)
            if any(c in g.occ and g.occ[c] not in g.treeset for c in g.box(nm, x_, y_)): continue
            if any(b[0] - .3 < x_ + .5 < b[2] + .3 and b[1] - 1.5 < y_ + 1 < b[3] + .3 for b in BX): continue          # nowhere near a building's walls and roof
            g.pp.append((g.char(nm), x_, y_)); g.occ[(x_, y_)] = nm; g.treeset.add(nm); n += 1
            for c in g.box(nm, x_, y_): g.occ.setdefault(c, nm)
    return n

# ================================================================ streets
for y in (2, 5): st(-44, y, 46, y, 't')                                                   # the avenue's sidewalks
for x in (9, 12): st(x, -46, x, -4, 't')                                                  # the boulevard north
for x in (13, 16): st(x, 13, x, 46, 't')                                                  # the boulevard south
st(10, -50, 11, -5)                                                                        # the trade road from the north (exit), through the civic quarter
st(14, 11, 15, 50)                                                                         # the boulevard south (exit)
st(-45, 3, 46, 4)                                                                          # the avenue
st(-45, -48, -44, 50)                                                                      # the old west road: the coast track from the south-west (exit) up the old town's edge
st(5, -4, 21, -3); st(5, 11, 21, 12); st(5, -4, 6, 12); st(20, -4, 21, 12)                 # the ring road round the Grand Plaza (centre 13, 4)
for y in (-14, -31, 20, 37): st(-19, y, 45, y + 1)                                         # cross streets, every seventeen steps
st(-45, -48, 32, -47); st(-45, 47, 46, 48)                                                 # the perimeter streets (the north one stops at the park)
for x in (-20, -6, 31): st(x, -48, x + 1, 48)                                              # the avenues between the blocks
st(45, -30, 46, 48)
g.exit(10, -50, 'N'); g.exit(14, 50, 'S'); g.exit(-45, 50, 'S')
# the Grand Plaza island: cobbled edge, tan paths, lawns in the north corners
st(7, -2, 19, 10, 'p'); st(8, -1, 18, 9, 't')
for (a, b, c_, d) in ((8, -1, 11, 2), (15, -1, 18, 2), (8, 6, 10, 9), (16, 6, 18, 9)): st(a, b, c_, d, 'g')
# the old town: the avenue and the two long cross streets run on west as 'the old high street' and 'chandlers row'; between them 1 wide stone lanes, houses back to back
for y in (-14, 20): st(-44, y, -20, y + 1)
OT = (-41, -35, -29, -23, -6, 11, 27, 33, 39, 45)
for y in OT: st(-43, y, -21, y)
CON = [(-38, -41, -35), (-27, -35, -29), (-34, -29, -23), (-24, -29, -23), (-40, -23, -15), (-26, -12, -6), (-30, -22, -15), (-33, -6, 2), (-36, 5, 11), (-29, 12, 19), (-38, 22, 27), (-30, 27, 33), (-36, 33, 39), (-27, 39, 45), (-41, 27, 33), (-40, 39, 45)]
for x, y0, y1 in CON: st(x, y0, x, y1)
st(-38, -12, -33, -8, 'p'); st(-37, -11, -34, -9, 't')                                     # the old square, with its well

# ================================================================ civic buildings (doors face the avenue and the ring road; every walk is paved)
lot('maHallGrey', -12, 1, street_y=2, walk='t', beds=PL)                                  # the museum hall
lot('clockTower', -2, 1, street_y=2, walk='t', beds=PL)                                   # the clock
lot('pokeCenterWave', 3, 1, street_y=2, walk='t', role='center', beds=PL)                 # the Center, by the plaza
lot('gymTealTall', 26, 1, street_y=2, walk='t', beds=PL)                                  # the gym: the tall hall on the plaza's east side
lot('martTower', 16, -6, street_y=-5, walk='t', beds=PL)                                  # the market tower, north of the plaza
lot('domeHall', 6, -6, street_y=-5, walk='t', beds=PL)
lot('hotelBlue', 38, 1, street_y=2, walk='t', beds=PL)

lot('maHallChampion', 22, -16, street_y=-14, walk='t', beds=PL)                              # the Great Hall: the city's hall, on the north cross street
lot('stadium', 39, 19, street_y=19, walk='t', beds=PL)                                    # the arena

# ================================================================ the park (north-east), the market square and the garden square (south), the freight yards (south-east)
st(33, -35, 47, -35, 't'); st(46, -36, 48, -34, 't'); st(38, -34, 38, -32, 't')                  # the park: a path from the avenue along the pond's south bank to a pavilion court, and its gate path to the cross street
g.pond(42, -43, 5, 3)
st(17, 39, 30, 46, 't')                                                                    # the market square
st(-4, 42, 12, 42, 't'); st(4, 39, 4, 46, 't')                                             # the garden square: two crossing paths, each ending in a street

# ================================================================ the blocks: rows of lots along each street; a lane behind with a second row facing it
BLK = {3: [(-18, -7), (-4, 4), (22, 30), (33, 44)], -14: [(-18, -7), (-4, 8), (13, 30), (33, 44)], -31: [(-18, -7), (-4, 8), (13, 30)],
       20: [(-18, -7), (-4, 12), (17, 30), (33, 44)], 37: [(-18, -7), (-4, 12), (17, 30), (33, 44)], 47: [(-18, -7), (33, 44)]}
LANE = {3: [(-18, -7), (-4, 8), (22, 30), (33, 44)], -14: [(-18, -7), (-4, 8), (33, 44)], -31: [(-18, -7), (-4, 8), (13, 30)],
        20: [(-18, -7), (-4, 4), (22, 30), (33, 44)], 37: [(-18, -7), (-4, 12), (17, 30), (33, 44)]}
for S, blocks in LANE.items():
    for (x0, x1) in blocks: st(x0, S - 8, x1, S - 8)
st(22, -5, 22, -4)                                                                         # the east lane joins the ring
for S, blocks in BLK.items():
    for (x0, x1) in blocks:
        if x0 >= 33 and S >= 37: pool = WARE
        else: pool = RES if x0 < 12 else (RES[::-1] if S > 10 else TOWER)
        row(S, x0, x1, pool, tall=5.3, gap=(0, 1), hedge=HEDGES[(x0 + S) % 3] if pool is RES or pool is RES[::-1] or x0 < 12 else None)
for S, blocks in LANE.items():
    for (x0, x1) in blocks:
        if x0 >= 33 and S >= 37: pool = WARE
        else: pool = RES if x0 < 12 else (RES[::-1] if S > 10 else SHOP + TOWER[:3])
        row(S - 8, x0, x1, pool, dy=1, tall=4.6, walk='p', gap=(0, 1))

# ================================================================ the old town: houses on the lanes
row(3, -44, -22, OLD, gapw=0, tall=4.5)
row(-14, -43, -21, OLD, dy=2, gapw=0, walk='p', tall=4.5); row(20, -43, -21, OLD, dy=2, gapw=0, walk='p', tall=4.5)
for y in OT: row(y, -43, -21, OLD, dy=1, gapw=0, walk='p', tall=4.5, beds=())

# ================================================================ the old town's inn and the stalls round its square
for nm, x in (('pxStallBlue', -36), ('rg_stall_rug', -33)): g.prop(nm, x, -4, walk=True)
g.props('crateWide', [(-38, -4), (-31, -4)], walk=True); g.props('barrelOrange', [(-34, -3), (-37, -3)], walk=True)

# ================================================================ the Grand Plaza: fountain, statues, benches, beds
g.prop('maFountain', 13, 5, walk=True)
g.props('rg_bench', [(9, 4), (17, 4), (13, 8)], walk=True); g.props('statueDog', [(12, 0), (14, 0)], walk=True)
g.props('rg_lamp', [(11, 2), (15, 2), (11, 7), (15, 7), (7, -2), (19, -2), (7, 10), (19, 10)], walk=True)
for (x0, y0, x1, y1), tr in (((8, -1, 11, 2), 'rg_young_pink0'), ((15, -1, 18, 2), 'rg_young_pink1'), ((8, 6, 10, 9), 'rg_young_teal0'), ((16, 6, 18, 9), 'rg_young_green0')):
    g.prop(tr, x0 + 1, y0 + 1, walk=True); g.prop(BEDS[(x0 + y0) % 3], x1 - 1, y1 - 1, walk=True); g.prop(BEDS[(x0 + y0 + 1) % 3], x0 + 1, y1, walk=True)
    g.drift(x0, y0, x1, y1, SMALL, every=3)
g.props('rg_planter_tall_pink', [(8, 3), (8, 5), (18, 3), (18, 5)], walk=True); g.props('rg_planter_tall_orange', [(10, -1), (16, -1), (11, 9), (15, 9)], walk=True)
g.props('rg_stall', [(12, 9)], walk=True); g.props('pxStallPink', [(14, 9)], walk=True)

# ================================================================ street furniture: lamps and trees along the avenue and the boulevards
for x in range(-41, 46, 8):
    if not 3 <= x <= 22: furn('rg_lamp', [(x, 2)]); furn(STREET_TREES[(x // 8) % 4], [(x + 4, 5)]); furn(STREET_TREES[(x // 8 + 1) % 4], [(x + 4, 2)]); furn('rg_lamp', [(x, 5)])
for y in range(-45, -5, 8): furn('rg_lamp', [(9, y)]); furn('rg_lamp', [(12, y + 4)]); furn(STREET_TREES[(y // 8) % 4], [(12, y)]); furn(STREET_TREES[(y // 8 + 2) % 4], [(9, y + 4)])
for y in range(15, 46, 8): furn('rg_lamp', [(13, y)]); furn('rg_lamp', [(16, y + 4)]); furn(STREET_TREES[(y // 8) % 4], [(16, y)]); furn(STREET_TREES[(y // 8 + 2) % 4], [(13, y + 4)])

# ================================================================ tree lines along the avenues between the blocks
RT = random.Random(44)
MIXT = SLIM + ['rg_young_green0', 'rg_young_teal0', 'rg_young_pink0', 'rg_bush_green', 'rg_bush_teal', 'rg_bed_pink', 'rg_bed_white']
for x in (-20, -6, 31, 45):
    for xx in (x - 1, x + 2):
        y = -46
        while y < 47:
            if not near_door(xx, y) and g.get(xx, y) == '.': g.prop(RT.choice(MIXT), xx, y, walk=True) if RT.random() < .3 else g.prop(RT.choice(SLIM + SLIM[:2] + ['rg_young_green0']), xx, y)
            y += RT.choice((2, 3, 3, 4, 5))

# ================================================================ the park
g.prop('rg_arch_white', 38, -33, walk=True); g.props('rg_lamp', [(37, -35), (40, -35), (44, -35), (33, -35), (38, -34), (46, -36), (48, -36), (46, -34), (48, -34)], walk=True)
g.props('rg_bench', [(35, -35), (42, -35), (34, -33), (42, -33), (47, -36), (47, -34)], walk=True); g.prop('rg_fountain', 47, -35, walk=True)
for i, (x, y) in enumerate(((34, -34), (45, -34), (34, -32), (45, -32), (36, -34), (40, -34), (49, -34), (49, -36))): g.prop(BEDS[i % 3], x, y, walk=True)
for c in [c for c, n in g.occ.items() if n == 'pond' and (abs(c[0] - 42) > 7 or abs(c[1] + 43) > 5)]: del g.occ[c]     # the pond's claim is a rectangle; the lawn round the water is open again
grove(33, -49, 49, -35, BLOSSOM + WOOD[:4], dx=3, dy=2, seed=4); scatter(BLOSSOM + WOOD[:4], 33, -34, 49, -32, 8, mind=3, seed=4); scatter(SMALL, 33, -49, 49, -32, 40, mind=2, seed=5, walk=True)

scatter(BLOSSOM + WOOD[:3], 33, -37, 49, -36, 4, mind=3, seed=6); scatter(BLOSSOM + WOOD[:3] + BEDS, 33, -49, 35, -37, 5, mind=3, seed=7, walk=False)
for i, (x, y) in enumerate(((34, -38), (34, -42), (36, -37), (48, -37), (49, -41))): g.prop(BEDS[i % 3], x, y, walk=True)

# ================================================================ the market square and the garden square
for i, (nm, x) in enumerate((('pxStallBlue', 19), ('rg_stall_rug', 23), ('pxStallPink', 27))): g.prop(nm, x, 41, walk=True)
g.props('crateWide', [(18, 42), (21, 42), (25, 42), (29, 42)], walk=True); g.props('barrelOrange', [(17, 42), (30, 42)], walk=True); g.props('seedSack', [(21, 43), (25, 43)], walk=True)
g.prop('rg_fountain2', 23, 44, walk=True); g.props('rg_bench', [(19, 45), (27, 45)], walk=True); g.props('rg_lamp', [(17, 39), (30, 39), (17, 46), (30, 46), (23, 40)], walk=True)
g.props('rg_planter_tall_pink', [(20, 44), (26, 44)], walk=True); g.props('rg_planter_tall_orange', [(18, 44), (28, 44)], walk=True)
g.prop('rg_fountain2', 4, 43, walk=True); g.props('rg_lamp', [(-4, 39), (12, 39), (-4, 46), (12, 46), (3, 41), (6, 41), (3, 44), (6, 44)], walk=True)
g.props('rg_bench', [(0, 41), (8, 41), (0, 44), (8, 44)], walk=True)
for i, (x, y) in enumerate(((-2, 40), (-2, 45), (10, 40), (10, 45), (1, 40), (7, 40), (1, 45), (7, 45), (-3, 43), (11, 43))): g.prop(BEDS[i % 3], x, y, walk=True)
scatter(BLOSSOM + WOOD[:4], -4, 39, 12, 46, 8, mind=3, seed=7); scatter(SMALL, -4, 39, 12, 46, 20, mind=2, seed=8, walk=True)

# ================================================================ the old square: a well, benches and a few trees on the cobbles
g.prop('jWell', -36, -9, walk=True); g.props('rg_bench', [(-38, -10), (-34, -10)], walk=True); g.props('rg_lamp', [(-38, -12), (-33, -12)], walk=True)
g.props('rg_young_teal0', [(-38, -8), (-33, -8)], walk=True); g.props('rg_planter_tall_pink', [(-35, -8), (-37, -8)], walk=True)

# ================================================================ the freight yards: concrete between the warehouses, vans and crates
def inb(x, y): return any(b[0] - 1.1 < x + .5 < b[2] + 1.1 and b[1] - 1.0 < y + .5 < b[3] + .3 for b in BX)
for y in range(22, 47):
    for x in range(33, 45):
        if g.get(x, y) == '.' and (x, y) not in g.occ and not inb(x, y): g.put(x, y, 't')
R = random.Random(3)
yard = [(x, y) for y in range(24, 46) for x in range(33, 45) if g.get(x, y) == 't' and (x, y) not in g.occ]
for nm in ('vanGrey', 'truckPink', 'vanGrey', 'crateWide', 'crateBox', 'barrelOrange', 'seedSack', 'crateWide', 'barrelDark', 'rg_crates', 'rg_crates2', 'rg_barrel', 'crateBox', 'rg_crates'):
    for _ in range(12):
        x, y = R.choice(yard)
        if g.prop(nm, x, y, walk=True): break

# ================================================================ kitchen gardens in the old town's back lawns
for i, (x, y) in enumerate(pockets(-43, -46, -21, 46, 4, 2, 12, margin=0, seed=3)):
    g.field(x, y, x + 3, y + 1, ('leafPlantB', 'leafPlant', 'leafPlantC', 'rg_sunflowers')[i % 4], every=1)

# ================================================================ the Great Hall's garden: a fountain court and clipped beds behind the hall
st(21, -29, 21, -27, 't'); st(19, -27, 23, -25, 't'); g.prop('rg_fountain2', 21, -26, walk=True)
g.props('rg_bench', [(19, -26), (23, -26)], walk=True); g.props('rg_lamp', [(19, -27), (23, -27), (19, -25), (23, -25)], walk=True)
for x in range(14, 30, 2):
    for y in (-29,): g.prop('mHedgeRoundGreen', x, y)
scatter(BLOSSOM + WOOD[:3], 14, -29, 29, -22, 10, mind=4, seed=9)
for i, (x, y) in enumerate(((16, -27), (26, -27), (16, -24), (26, -24), (17, -22), (25, -22))): g.prop(BEDS[i % 3], x, y, walk=True)

# ================================================================ tree rows along the south side of the cross streets and the lanes' backs
for S in (-31, -14, 20, 37, 47):
    for (x0, x1) in ((-18, -7), (-4, 8), (13, 30), (33, 44)) if S < 0 else ((-18, -7), (-4, 12), (17, 30), (33, 44)):
        if S == -31 and x0 >= 33: continue
        grove(x0 + 1, S + 4, x1 - 1, S + 4, SLIM[:4] + ['rg_young_green0', 'rg_young_teal0'], dx=3, dy=1, seed=S + x0, jit=0)

# ================================================================ signs and street furniture
for x, y in ((13, -49), (12, 49), (17, 49), (-43, 49), (-47, 3)): g.prop('wSignBoard', x, y)
g.prop('pokeSign', 5, 2, walk=True); g.prop('mNoticeBoard', 1, 2, walk=True); g.prop('mInfoPost', 8, 5, walk=True)
for x in range(-40, 46, 12):
    furn('rg_bench', [(x + 6, 5)]); furn('mailbox', [(x + 2, 5)]); furn('phoneBox', [(x + 9, 5)]); furn('vendingRed', [(x + 10, 2)])

# ================================================================ woods round the city, then the greenery in what is left
g.trees(-50, -50, 50, -49, WOOD); g.trees(-50, 49, 50, 50, WOOD); g.trees(-50, -50, -46, 50, WOOD); g.trees(47, -50, 50, 50, WOOD)
g.dress()
grove(-45, -46, 46, 46, WOOD[:5] + BLOSSOM + ['rg_young_green0', 'rg_young_teal0', 'rg_young_pink0'], dx=3, dy=2, seed=17, prob=.8)       # the lawns' own trees
g.garden(-49, -49, 49, 49, every=3)
g.drift(-50, -50, 50, 50, SMALL, every=5)

# ---- fill what the lawns still lack: beds, bushes and young trees on about every fourth open cell, kept clear of paving and doors
FILL = ['rg_bush_green', 'rg_bush_teal', 'rg_bush_pink', 'rg_young_green0', 'rg_young_teal0', 'rg_clump_green', 'rg_flower_pink', 'rg_flower_yellow', 'rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white', 'rg_tiny_blue2', 'rg_flower_white', 'rg_young_pink0']
R2 = random.Random(31)
for (x, y) in sorted(g.openmask(-49, -49, 49, 49, 1)):
    if R2.random() < .42 and not near_door(x, y) and not any(abs(x - rx) <= 1 and abs(y - ry) <= 1 for rx, ry in RESERVED):
        nm = R2.choice(FILL); g.prop(nm, x, y, walk=nm.startswith(('rg_clump', 'rg_tiny', 'rg_flower', 'rg_bed')))
# ---- clipped hedges along the lawn edge wherever a block meets a real street (2 wide), with gaps; then a second, lighter fill right up to the kerbs
HEDGE = ['mHedgeRoundGreen', 'mHedgeRoundTeal', 'mHedgeRoundGreen', 'mHedgeRoundPink']
R3 = random.Random(9)
for y in range(-48, 49):
    for x in range(-48, 49):
        if g.get(x, y) != '.' or (x, y) in g.occ or near_door(x, y): continue
        for dx_, dy_ in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            if g.get(x + dx_, y + dy_) == 'p' and g.get(x + 2 * dx_, y + 2 * dy_) == 'p' and R3.random() < .55:
                g.prop(HEDGE[(x + y) % 4], x, y); break
for (x, y) in sorted(g.openmask(-49, -49, 49, 49, 0)):
    if R2.random() < .25 and not near_door(x, y) and not any(abs(x - rx) <= 1 and abs(y - ry) <= 1 for rx, ry in RESERVED):
        nm = R2.choice(FILL); g.prop(nm, x, y, walk=nm.startswith(('rg_clump', 'rg_tiny', 'rg_flower', 'rg_bed')))
# ---- no tree stands with its foot against a building's roof line (the canopy would read as touching the roof)
TREEWORDS = ('round', 'tall', 'pine', 'young', 'slim', 'cone', 'mFir', 'poplar', 'mPine')
ch2n = {c: n for n, c in g.legend.items()}
def roofed(nm, x, y):
    for b in BX:
        if b[0] - 1.0 < x + .5 < b[2] + 1.0 and b[1] - 1.3 <= y + 1 <= b[1] + 1.0: return True
    return False
g.pp[:] = [(c, x, y) for c, x, y in g.pp if not (any(w in ch2n[c] for w in TREEWORDS) and roofed(ch2n[c], x, y))]

g.done(dict(lim=LIM, hide_site_paths=True))
