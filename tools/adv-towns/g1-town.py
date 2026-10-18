"""Dunereach, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g1-town.py
then python3 -I tools/adv-towns/preview.py G1 out.png to see it with the real art.

The story of the place: a desert trading post that grew round a spring. The oasis, the only green for miles (a lawn of reeds, flowers and date palms inside a
promenade round the sandy-banked pool), is why the town exists. The bazaar square lies on the dry ground east of it where the caravan tracks met: the north road
comes down between the Center and the Mart into the square's top, the coast road from the east gate runs past the gym (the old caravanserai, with its torch-lit
apron and its yard of hay and crates) into the square's east side, the camp track leaves its south side and the south-west track its south-west corner. The old
town is packed tight for shade: small flat-roofed houses, thatched huts and orange-domed houses shoulder to shoulder along narrow sand lanes that kink round one
another and end on the roads or in pocket plazas with a well or a bench; the merchants' blue and green domes stand behind the Mart, the inn by the oasis, and the
lamps along every lane. Between the rows lie walled melon, sunflower and herb plots and date orchards; a camp of the caravan folk (tipis, hay, a well) lies at the
south end of the camp track, with the old pyramid shrine to its west. The green strip in the north-west corner is the date plantation; cactus, rock mounds,
bones and quicksand fill the dry corners, and the black ash mountain closes the south-east (nothing is built on it).
Exits: north (6, -48) the north road, east (48, -14) the coast road, south (-36, 48) the south-west track."""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

LIM = 50
g = kit.Town(LIM - 2, 'G1')
MT = {y: 50 for y in range(11, 14)}; MT.update({y: 47 for y in range(14, 20)}); MT.update({y: 44 for y in range(20, 23)}); MT.update({y: 41 for y in range(23, 29)})
MT.update({y: 38 for y in range(29, 35)}); MT.update({y: 35 for y in range(35, 41)}); MT.update({y: 32 for y in range(41, 44)}); MT.update({y: 29 for y in range(44, 47)}); MT.update({y: 26 for y in range(47, 50)})
def mtn(x, y, m=1): return y >= 11 and x >= MT.get(y, 23) - m                                        # the ash mountain in the south-east corner: nothing is built on it
g.claim([(x, y) for y in range(11, LIM - 1) for x in range(-LIM + 2, LIM - 1) if mtn(x, y, 0)], 'mountain')

PALM = ['rg_palm', 'rg_palm2', 'rg_palm', 'rg_palm2', 'palmTreeBig', 'palmTree']
PALM2 = ['rg_palm', 'rg_palm2']
CACTI = ['rg_cacti', 'rg_cacti2', 'rg_cactus', 'organCactus', 'rg_cactus_small', 'cactusFlowering']
ROCKS = ['rg_boulder_desert', 'rg_rock_desert', 'boulderBrown', 'rockBrown', 'rockBrownB', 'rockBrownC', 'rg_spire_desert', 'rockMoundBrown', 'dirtMound']
SMALL = ['dryTuft', 'grassBlades', 'pebbles', 'rg_weeds', 'rockBrownSmall', 'rg_bones', 'dryTuft', 'rg_rock_desert', 'dryTuft', 'grassBlades']
POTS = ('rg_pot_plant', 'rg_pot_red', 'rg_pot_fern', 'flowerPot', 'rg_planter_tall_orange')
BUSH = ('bush~dune', 'roundBush~dune', 'bushOlive~dune', 'rg_cactus_small', 'cactusFlowering')
BEDS = ('rg_planter_orange', 'rg_planter_orange')
EXTRAS = ['rg_barrel', 'rg_barrel_water', 'rg_crates', 'rg_crates2', 'crateWide', 'seedSack', 'rg_basin', 'gemStand', 'vaseGold', 'bowlOrange', 'rg_pot_herb', 'rg_planter_orange', 'barrelOrange', 'crateBox', 'rg_table']

# the world's natural grass reaches into the box here (the green corner in the north-west is the date plantation, plus two bits in the south): no house is ever built on it
GR = {-48: [(-50, -2)], -47: [(-50, -4)], -46: [(-50, -5)], -45: [(-50, -7)], -44: [(-50, -8)], -43: [(-50, -9)], -42: [(-50, -10)], -41: [(-50, -13)], -40: [(-50, -16)], -39: [(-50, -40)]}
GR.update({y: [(-50, -44 + (y - 42) // 2)] for y in range(42, 49)}); GR[48] = GR[48] + [(20, 25)]
def grass(x, y): return any(a - 1 <= x <= b + 1 for a, b in GR.get(y, ()))
# ================================================================ roads: 2 wide sand dirt; lanes 1 wide
g.lane([(6, -48), (6, -2)], 2, 'd')                                                                # the north road
g.lane([(48, -14), (23, -14), (23, 3), (16, 3)], 2, 'd')                                           # the coast road from the east gate into the square
g.lane([(2, 6), (-12, 6), (-12, 22), (-36, 22), (-36, 48)], 2, 'd')                                # the south-west track
g.lane([(10, 8), (10, 37)], 2, 'd')                                                                # the camp track south of the square
g.exit(6, -48, 'N'); g.exit(48, -14, 'E'); g.exit(-36, 48, 'S')
# the bazaar square: cobbled, irregular, a tan heart
g.blob(9, 3, ["...###########...", ".###############.", "#################", "#################", "#################", "#################",
              "#################", ".###############.", "...###########..."], 't')
g.blob(9, 3, ["..#########..", "#############", "#############", "#############", "..#########.."], 't')

# ================================================================ lanes (1 wide); every one ends on a road, another lane, a plaza or a door
LANES = [
    [(5, -37), (-14, -37), (-14, -34), (-43, -34)],             # Weavers Lane (kinked)
    [(-14, -34), (-14, -28), (-43, -28)],                       # Dyers Lane
    [(5, -21), (-20, -21), (-20, -23), (-43, -23)],             # Spring Lane, along the oasis north bank
    [(-36, -23), (-36, 21)],                                    # West Lane
    [(-35, 13), (-13, 13)],                                     # Well Lane
    [(-35, 30), (9, 30)],                                       # Date Row
    [(-35, 38), (-16, 38)],                                     # Orchard Row
    [(-10, 16), (9, 16)],                                       # Cistern Lane
    [(-10, 23), (9, 23)],                                       # Salt Lane
    [(8, -8), (22, -8)],                                        # Merchants Lane, the north road to the coast road behind the Mart
    [(8, -37), (25, -37), (25, -39), (46, -39)],                # Caravan Row
    [(8, -28), (31, -28), (31, -30), (46, -30)],                # Rug Row
    [(8, -21), (46, -21)],                                      # Gate Row
    [(25, -2), (46, -2)],                                       # the gate houses
    [(12, 9), (46, 9)],                                         # Tent Row
    [(12, 18), (30, 18), (30, 16), (44, 16)],                   # Salt Row
    [(12, 27), (38, 27)],
    [(12, 36), (33, 36)],
]
for pts in LANES: g.lane(pts, 1, 'd')
# the promenade round the oasis and its spurs
g.rect(-32, -18, -4, -18, 'd'); g.rect(-32, 1, -4, 1, 'd'); g.rect(-32, -18, -32, 1, 'd'); g.rect(-4, -18, -4, 1, 'd')
g.rect(-35, -8, -33, -8, 'd'); g.rect(-3, -8, 5, -8, 'd'); g.rect(-20, -20, -20, -19, 'd'); g.rect(-10, 2, -10, 5, 'd')

BASE = set()
def base_cells(name, x, y, wide=0):
    d = kit.plan.PROPS[name]; x0 = ((x + .5) * 32 - d['door'][0] - d['ax']) / 32; x1 = x0 + d['sw'] / 32
    return [(cx, cy) for cy in (y - 2, y - 1) for cx in range(int(x0 + .5) - wide, int(x1 - .5) + 1 + wide)]
def fits(name, x, y):
    cells = g.box(name, x, y, bld=True); base = base_cells(name, x, y, 1)
    if any(grass(cx, cy) for cx, cy in cells + base): return False                # never on the green
    # the base rows, a tile wider each side: a neighbour's walk never brushes the wall
    if (x, y - 1) in BASE or (x, y - 2) in BASE or (x, y) in BASE: return False
    return g.free(cells) and all(g.get(cx, cy) == '.' for cx, cy in cells + base if (cx, cy) != (x, y - 1)) and not any(c in BASE for c in base_cells(name, x, y))
def lot(name, x, y, **k):
    if mtn(x, y - 3, 2) or mtn(x, y, 2) or not fits(name, x, y): return False
    BASE.update(base_cells(name, x, y)); g.lot(name, x, y, beds=k.pop('beds', None), **k)
    r = random.Random(x * 131 + y * 17); w = kit.size(name)[0]
    for side in (-1, 1):                                                       # a barrel, a stack of crates, a sack or a bowl beside the door
        if r.random() < .55: g.prop(r.choice(EXTRAS), x + side * int(w / 2 + 1.2 + r.choice((0, 0, 1))), y - r.choice((0, 0, 1)))
    return True
def hrow(ly, x0, x1, kinds, seed, gap=(0, 1), back=(0, 0, 0, 1), skip=(), miss=0.0):
    """houses on the north side of the horizontal lane y = ly between x0 and x1: random kinds, gaps and setbacks; `miss` leaves a share of the plots empty"""
    r = random.Random(seed); x = x0
    while x < x1:
        name = r.choice(kinds); w = kit.size(name)[0]; cx = int(round(x + w / 2 + .3)); b = r.choice(back)
        if any(a <= cx <= c for a, c in skip) or r.random() < miss: x = cx + w / 2 + 1; continue
        ok = lot(name, cx, ly - 1 - b, street_y=ly)
        x = cx + w / 2 + (r.randint(*gap) if ok else 1)
def vcol(sx, y0, y1, kinds, seed, side='E', off=2, gap=(0, 2), miss=0.0):
    """houses beside the vertical lane x = sx, on its east or west side, door walks across to the lane"""
    r = random.Random(seed); y = y0
    while y < y1:
        name = r.choice(kinds); w, h = kit.size(name)[:2]; dx = int(round(w / 2 + off + r.choice((0, 0, 1))))
        ok = r.random() >= miss and lot(name, sx + dx if side == 'E' else sx - dx, int(y + h), street_x=sx)
        y += h + (r.randint(*gap) if ok else 1)

SM = ['houseOrangeFlat', 'houseOrangeSmall', 'houseOrangeSplit', 'houseOrangeTilt', 'manorOrange', 'manorOrangeB']
BIG = ['rg_straw', 'rg_straw2', 'maOctOrange', 'thatchHouse', 'maHutRound', 'maHutWood', 'rg_hut_round', 'mCottageOrange', 'moundHut', 'strawHut']
LARGE = ['rg_sandhall', 'maHallOrange', 'maHouseOrange']
OLD = SM + BIG + BIG + LARGE

# ================================================================ the Center and the Mart on the square's north side
g.building('pokeCenterOrange', 3, -2, 'center'); g.rect(3, -3, 3, 0, 'd')
g.building('martWave', 11, -2); g.rect(11, -3, 11, 0, 'd')
g.lot('rg_dome_blue', 13, -9, street_y=-8, beds=None); g.lot('rg_dome_green', 19, -9, street_y=-8, beds=None)
g.rect(33, -15, 43, -15, 't'); g.building('gymTeal', 38, -15, 'house'); g.rect(38, -16, 38, -14, 'd')
g.lot('rg_sandhall', -5, 5, street_y=6, beds=BEDS)

# ================================================================ the oasis: the spring, a ring of date palms, reeds, the promenade benches
g.pond(-18, -8, 7, 4)
for k in range(0, 360, 20):
    a = math.radians(k); x = round(-18 + 12.5 * math.cos(a)); y = round(-8 + 8.6 * math.sin(a))
    g.prop(PALM2[k // 20 % 2], x, y)
for k in range(0, 360, 20):
    a = math.radians(k + 10); x = round(-18 + 10.2 * math.cos(a)); y = round(-8 + 6.6 * math.sin(a))
    g.prop('rg_palm' if k % 40 else 'palmTreeBig', x, y)
for x, y in ((-29, -9), (-7, -7), (-14, -1), (-23, -16), (-28, -4), (-8, -13), (-18, 0), (-29, -13)): g.prop('reedsPair', x, y)
for x, y in ((-28, -7), (-7, -10), (-22, 0), (-12, -16), (-30, -2), (-9, -3)): g.prop('reeds', x, y)
g.props('rg_bench', [(-24, -1), (-12, -1), (-18, -16)]); g.props('rg_lamp', [(-31, -17), (-5, -17), (-31, 0), (-5, 0), (-18, -17)])

# ================================================================ the bazaar
g.prop('jWell', 9, 3, walk=True)
for x, n in ((4, 'rg_stall'), (7, 'pxStallBlue'), (14, 'rg_stall_rug'), (17, 'pxStallPink')): g.prop(n, x, 6, walk=True)
g.props('marketAwning', [(3, 2), (16, 1)], walk=True)
g.props('rg_bench', [(7, 3), (13, 3)], walk=True)
g.props('rg_lamp', [(1, -1), (17, -1), (1, 7), (17, 7)], walk=True)
g.props('crateWide', [(6, 7), (12, 7), (2, 4)], walk=True); g.props('barrelOrange', [(2, 6), (13, 7)], walk=True); g.props('seedSack', [(9, 7), (15, 5)], walk=True)
g.props('vaseGold', [(5, 1), (14, 1)], walk=True); g.props('rg_pot_plant', [(1, 3), (1, 5)], walk=True)
g.props('rg_sign_board', [(9, -1)], walk=True); g.prop('pokeSign', 5, -3)
g.props('rg_planter_orange', [(1, -3), (13, -3)]); g.props('rg_lamp', [(5, -3), (9, -3)])

# ================================================================ the gym yard: the caravanserai's hay, crates, barrels, torches at the gate
g.props('torchPost', [(35, -15), (41, -15)], walk=True); g.props('rg_planter_orange', [(34, -16), (42, -16)])
g.props('maHayBales', [(44, -10), (46, -8)]); g.props('maHayPile', [(42, -9)]); g.props('rg_crates', [(33, -18)]); g.props('barrelOrange', [(32, -17), (44, -16)])
g.props('rg_barrel_water', [(31, -16)]); g.props('rg_lamp', [(32, -15), (44, -15)], walk=True)
g.props('palmHammock', [(40, -22)]); g.props('rg_palm', [(31, -19), (47, -19)])

# ================================================================ the camp of the caravan folk and the shrine
g.blob(12, 42, ["...###########...", ".###############.", "#################", "#################", "#################", "#################",
                "#################", ".###############.", "...###########..."], 't')
g.prop('jWell', 12, 42, walk=True); g.props('torchPost', [(5, 39), (19, 39), (5, 45), (19, 45), (12, 38)], walk=True)
g.props('rg_bench', [(9, 40), (15, 44)], walk=True); g.props('rg_barrel', [(7, 43), (17, 43)], walk=True); g.props('rg_crates2', [(16, 40)], walk=True); g.props('seedSack', [(8, 45)], walk=True)
g.props('tipi', [(6, 41), (18, 41), (9, 46)], walk=True); g.props('tentPair', [(15, 46), (6, 45)], walk=True); g.props('rg_stall_rug', [(13, 46)], walk=True)
for x, y in ((2, 41), (22, 41), (2, 46), (23, 46), (12, 48)): g.prop('tipi', x, y)
g.props('tentPair', [(24, 43), (1, 43)]); g.props('palmHammock', [(8, 37), (16, 36)]); g.props('maHayBales', [(26, 45), (28, 41)]); g.props('maHayPile', [(25, 47)])
g.rect(-14, 43, -4, 46, 't'); g.rect(-3, 44, 5, 44, 'd'); g.lot('pyramidTemple', -9, 43, beds=None)
g.props('torchPost', [(-12, 44), (-6, 44), (-13, 46), (-5, 46)], walk=True); g.props('rg_bench_stone', [(-11, 45), (-7, 45)], walk=True)
# the foot of the ash mountain: boulders and mounds along the rim, quicksand where the ground is soft
for y in range(13, 47, 3): g.prop(('rg_boulder_desert', 'rockMoundBrown', 'jRocks', 'boulderBrown')[y // 3 % 4], MT[y] - 3, y)
for x, y in ((30, 41), (21, 33), (40, 15), (36, 29)): g.prop('rg_quicksand_mid' if (x + y) % 2 else 'rg_quicksand', x, y)
for x, y in ((30, 44), (25, 36), (39, 19), (35, 33), (33, 24)): g.prop('rg_spire_desert', x, y)
# signs at the gates
g.props('rg_sign_board', [(4, -46), (46, -16), (-38, 46)])

# ================================================================ pocket plazas where the lanes end, and the north cistern
for x, y, p in ((-44, -34, 'rg_bench_stone'), (-44, -28, 'jWell'), (-44, -23, 'rg_bench_stone'), (45, -39, 'jWell'), (45, -30, 'rg_bench_stone'), (45, -21, 'jWell'), (45, -2, 'rg_bench_stone'),
                (45, 9, 'jWell'), (43, 16, 'rg_bench_stone'), (37, 27, 'jWell'), (32, 36, 'rg_bench_stone'), (-17, 38, 'rg_bench_stone')):
    g.rect(x - 1, y - 1, x + 1, y + 1, 't'); g.prop(p, x, y, walk=True)

# ================================================================ the oasis lawn: irrigated green between the promenade and the sandy bank
for a, b, c, d in ((-31, -17, -5, -15), (-31, -1, -5, 0), (-31, -14, -28, -2), (-8, -14, -5, -2)): g.rect(a, b, c, d, 'g')
g.props('rg_bush_green', [(-30, -16), (-6, -16), (-30, -1), (-6, -1), (-30, -9), (-6, -9), (-18, -16)]); g.props('rg_bush_olive', [(-29, -5), (-7, -13), (-12, -1), (-24, -16)])
g.drift(-31, -17, -5, 1, ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white', 'rg_clump_green', 'rg_clover', 'rg_tiny_pink', 'rg_clump_green2'], every=2, seed=4)


# ================================================================ houses
def hstreet(pts, kinds, seed, miss=0.0, gap=(0, 1), x0=None, x1=None):
    """houses on the north side of every horizontal run of a kinked lane"""
    for k, ((xa, ya), (xb, yb)) in enumerate(zip(pts, pts[1:])):
        if ya == yb: hrow(ya, max(min(xa, xb) + 1, x0 if x0 is not None else -99), min(max(xa, xb) - 1, x1 if x1 is not None else 99), kinds, seed + k, miss=miss, gap=gap)
hstreet(LANES[0], OLD, 1, .06); hrow(-28, -44, -14, OLD, 2, miss=.06); hstreet(LANES[2], OLD, 3, .06)
vcol(-36, -20, 18, OLD, 5, 'W'); vcol(-36, -10, 14, SM, 6, 'E', miss=.5)
hrow(13, -35, -14, OLD, 7, miss=.1); hrow(22, -35, -14, OLD, 8, miss=.15); hrow(30, -35, 9, OLD, 9, miss=.15); hrow(38, -35, -16, OLD, 10, miss=.25)
hrow(16, -9, 9, OLD, 21, miss=.1); hrow(23, -9, 9, OLD, 22, miss=.15)
hstreet(LANES[10], OLD, 23, .1); hstreet(LANES[11], OLD, 24, .12); hrow(-21, 9, 46, OLD, 25, miss=.15)
hrow(-15, 27, 33, SM, 13, skip=[(34, 42)]); hrow(-15, 41, 47, SM, 14)
hrow(-2, 26, 46, OLD, 15, miss=.15); hrow(9, 18, 46, OLD, 16, miss=.15); hstreet(LANES[15], OLD, 30, .15); hrow(27, 12, 38, OLD, 18, miss=.2); hrow(36, 12, 33, OLD, 19, miss=.25)

def infill(pts, kinds, seed, chance=.8):
    """a second pass along every horizontal run of a lane: small houses in the gaps the first pass left, shoulder to shoulder"""
    r = random.Random(seed)
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya != yb: continue
        for x in range(min(xa, xb) + 2, max(xa, xb) - 1):
            if r.random() < chance: lot(r.choice(kinds), x, ya - 1, street_y=ya)
TINY = ['houseOrangeSmall', 'houseOrangeFlat', 'strawHut', 'mCottageOrange', 'houseOrangeSplit', 'moundHut', 'houseOrangeTilt']
for k, pts in enumerate(LANES):
    if k in (3, 9, 12): continue                                 # West Lane (vertical), Merchants Lane (the domes), the gate lane keep their lots
    infill(pts, TINY, 400 + k, .7)

def plot(region, w, h, crop, seed, every=2, tries=80, hedge=True):
    """a worked plot on the first free w x h patch (a tile clear all round) of the region, found from a random start, hedged top and bottom"""
    r = random.Random(seed); x0, y0, x1, y1 = region
    for _ in range(tries):
        x, y = r.randint(x0, x1 - w), r.randint(y0, y1 - h)
        if all(g.get(cx, cy) == '.' and (cx, cy) not in g.occ and not mtn(cx, cy, 3) and not grass(cx, cy) for cx in range(x - 2, x + w + 2) for cy in range(y - 2, y + h + 2)):
            g.field(x, y, x + w - 1, y + h - 1, crop, every)
            if hedge:                                                                   # a hedged compound: rows top and bottom (a gate gap in the middle of the bottom), round shrubs down the sides
                for hx in range(x, x + w, 2):
                    g.prop('mHedgeLongAmber', hx, y - 1)
                    if abs(hx - (x + w // 2)) > 1: g.prop('mHedgeLongAmber', hx, y + h + 1)
                for hy in range(y, y + h + 1): g.prop('mHedgeRoundAmber', x - 1, hy); g.prop('mHedgeRoundAmber', x + w, hy)
            if r.random() < .5: g.prop('rg_scarecrow', x - 1 if r.random() < .5 else x + w, y + h // 2)        # beside the field, never among the crops
            return True
    return False
CROPS = ['rg_pumpkin', 'leafPlantB', 'rg_sunflowers', 'sprout', 'leafPlantC']
for k, (w, h) in enumerate([(8, 3), (7, 3), (9, 4), (6, 3), (8, 4), (7, 4), (9, 3), (6, 4)] * 4):
    plot((-46, -46, 46, 46), w, h, CROPS[k % len(CROPS)], 100 + k)

def lamps(pts, every=9):
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya == yb:
            for x in range(min(xa, xb) + 4, max(xa, xb) - 1, every): g.prop('rg_lamp', x, ya + 2)
        else:
            for y in range(min(ya, yb) + 4, max(ya, yb) - 1, every): g.prop('rg_lamp', xa + 1, y)
for pts in LANES: lamps(pts)
for pts in ([(8, -48), (8, -3)], [(24, -14), (47, -14)], [(25, -12), (25, 3)], [(12, 9), (12, 36)], [(-35, 24), (-13, 24)], [(-34, 23), (-34, 47)], [(-13, 8), (-13, 21)]): lamps(pts, 8)

# ================================================================ the green strip and the desert past the houses
def scatter(x0, y0, x1, y1, kinds, step, seed, skip=.15, jit=1):
    """a loose planting: a jittered lattice with random gaps, so no rigid rows"""
    r = random.Random(seed)
    for y in range(y0, y1 + 1, step):
        for x in range(x0, x1 + 1, step):
            if r.random() < skip: continue
            g.prop(r.choice(kinds), x + r.randint(-jit, jit) + (step // 2 if (y - y0) // step % 2 else 0), y + r.randint(-jit, jit))
scatter(-48, -48, -11, -43, PALM, 3, 1)                                                  # the date plantation on the north-west green
scatter(-48, -22, -44, 47, PALM, 3, 7)                                                   # the palm belt along the west edge
scatter(12, -48, 48, -43, PALM, 3, 8)                                                    # the north gate's palms
scatter(44, -42, 48, 12, ROCKS + CACTI, 4, 9)                                            # rocks and cacti along the east edge
scatter(-34, 46, 30, 48, CACTI + ROCKS + PALM2, 4, 10)                                   # and the south edge

def clumps(x0, y0, x1, y1, step, kinds, seed, n=(2, 5), rad=2, every=1.0):
    """desert scatter in clumps: cluster centres on a jittered grid, 2-5 plants and rocks round each (never on paving, buildings or other props)"""
    r = random.Random(seed)
    for cy in range(y0, y1 + 1, step):
        for cx in range(x0, x1 + 1, step):
            if r.random() > every: continue
            mx, my = cx + r.randint(-2, 2), cy + r.randint(-2, 2)
            for _ in range(r.randint(*n)): g.prop(r.choice(kinds), mx + r.randint(-rad, rad), my + r.randint(-rad, rad))
CLUMP = ['rg_cacti', 'rg_cacti2', 'rg_cactus', 'organCactus', 'cactusFlowering'] + ROCKS + ['rg_boulder_desert', 'rg_cactus']

def dgarden(x0, y0, x1, y1, every=4, seed=12):
    """desert scatter near paths: a cactus, a rock, a tuft or a few bones about every `every` tiles, kept off the walking line"""
    r = random.Random(seed)
    for (x, y) in sorted(g.openmask(x0, y0, x1, y1, 1)):
        if r.random() * every < 1:
            n = r.choice(ROCKS[:4] + SMALL + ['bush~dune', 'roundBush~dune', 'rg_bones2', 'cactusFlowering', 'rockBrownSmall'])
            g.prop(n, x, y, walk=n in SMALL)

# ================================================================ finish
g.dress(trees=PALM2, bushes=BUSH, pots=POTS)
g.groves(-47, -47, 47, 47, PALM, gap=1, min_area=6, styles=[('orchard', PALM2), ('orchard', PALM2), ('orchard', PALM)])
clumps(-47, -47, 47, 47, 8, CLUMP, 21, n=(2, 4), every=.8)
dgarden(-47, -47, 47, 47, every=9)
g.drift(-48, -48, 48, 48, SMALL, every=7)

# ================================================================ no 3 x 3 patch left bare, then the review clean-up (the game draws sprites whole, so nothing may overlap)
def fill_gaps(seed=31):
    r = random.Random(seed)
    for y in range(-47, 48):
        for x in range(-47, 48):
            if g.get(x, y) != '.' or any((x + i, y + j) in g.occ or g.get(x + i, y + j) != '.' for i in (-1, 0, 1) for j in (-1, 0, 1)): continue
            if r.random() < .55: g.prop(r.choice(CLUMP + PALM2 + ROCKS[:3]), x, y)
fill_gaps()
INV = {c: n for n, c in g.legend.items()}
DECAL = ('rg_tiny', 'rg_clump', 'rg_flower', 'rg_clover', 'dryTuft', 'grassBlades', 'pebbles', 'rg_weeds', 'rg_sprout', 'rg_bones', 'rockBrownSmall', 'rg_rock_desert', 'rg_leaves', 'rg_pot', 'flowerPot', 'bowlOrange', 'vaseGold', 'seedSack', 'tentPair', 'rg_basin', 'gemStand', 'sprout', 'leafPlant', 'rg_pumpkin', 'rg_sunflowers', 'rg_planter', 'flowerBowl')
TREE = ('rg_palm', 'palmTree', 'rg_cact', 'cactus', 'organCactus', 'cactusFlowering')
def rect(n, x, y, bld=False):
    d = kit.plan.PROPS[n]; px = (x + .5) * 32 - (d['door'][0] if bld else 0); py = (y if bld else y + 1) * 32 - 1
    return px - d['ax'], py - d['ay'], px - d['ax'] + d['sw'], py - d['ay'] + d['sh']
def hit(a, b, m=0.0):
    return min(a[2], b[2]) - max(a[0], b[0]) > m * 32 and min(a[3], b[3]) - max(a[1], b[1]) > m * 32
BR = [(b[0], rect(b[0], b[1], b[2], True), b[1], b[2]) for b in g.blds]
solid = lambda n: not n.startswith(DECAL)
keep, dropped, GRID = [], 0, {}
for ch, x, y in g.pp:
    n = INV[ch]; rc = rect(n, x, y); bad = False
    if solid(n):
        for bn, br, bx, by in BR:
            if hit(rc, (br[0] - 10, br[1], br[2] + 10, br[3]), .04) or (abs(x - bx) <= 1 and by <= y <= by + 2): bad = True; break   # over or against a wall, or on a doorstep
        if not bad and g.get(x, y) == 'd': bad = True                                                         # standing on a lane
        if not bad and n.startswith(TREE[:2]) and any(g.get(x + i, y + j) in ('c', 't') for i in (-1, 0, 1) for j in (-1, 0, 1)): bad = True   # a palm never leans over paving
    if not bad and solid(n):
        for ch2, x2, y2, n2, rc2 in [k for i in range(x - 4, x + 5) for j in range(y - 4, y + 5) for k in GRID.get((i, j), ())]:
            if solid(n2) and not (n.startswith(TREE) and n2.startswith(TREE)) and hit(rc, rc2, .04): bad = True; break
    if bad: dropped += 1; continue
    keep.append((ch, x, y, n, rc)); GRID.setdefault((x, y), []).append(keep[-1])
g.pp[:] = [(c, x, y) for c, x, y, n, rc in keep]
print('  G1: clean-up dropped', dropped, 'overlapping props')
g.done(dict(lim=LIM, hide_site_paths=True))
