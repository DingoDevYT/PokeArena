"""Salt Bay, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t5-town.py
then python3 -I tools/adv-towns/preview.py T5 out.png to see it with the real art. (It replaces t5-layout.py, which wrote the old v2 T5.json.)

The story of the place: a fishing harbour on the open sea. The generator cuts the harbour basin into the beach (x -26..-4, y -4..9) and a tidal inlet runs inland
south of the town (the working shore of Route 9); this plan keeps its piers (boards) exactly where the world checks walk them: pier A out across the basin to its head
(Surf teacher), pier B on the south headland (Fishing teacher), the net landing jetty to the north, two slips on the inlet. The quay, a cobbled square with the well in
a tan ring, fish stalls on its rim and the boats of the basin beyond, is the heart; the Blue Hotel and the first tavern face it. Main Street runs east to Route 9 with
the Center, the store and the inn on its north side and the wharf houses on its south, facing the inlet and its slips; Shore Road climbs north along the edge of the
beach and Orchard Road closes the ring on the east, with kinked lanes between them: fishers' houses and chalets with gardens, the village green with its pond and
orchard, melon and cabbage plots, woods round the edge. Strand Lane runs down the north beach past the boat sheds, boats drawn up on the sand, nets, driftwood and rocks;
the south boatyard sits on the headland by pier B. Across the inlet (reached only by Surf) lie a driftwood beach and a wood.
Exits: east (46, 3) Main Street to Route 9."""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

LIM = 48
g = kit.Town(LIM - 2, 'T5')
# The sea, the harbour basin and the inlet are the generator's (tools/adv-gen-region.py "T5 Salt Bay v2"); these are its water runs and sand runs per row
# (x ranges from the town centre), so nothing but boats, boards and shore rocks is ever put on water.
WATER = {-46: [(-46, -23)], -45: [(-46, -23)], -44: [(-46, -23)], -43: [(-46, -23)], -42: [(-46, -24)], -41: [(-46, -24)], -40: [(-46, -24)], -39: [(-46, -24)], -38: [(-46, -24)], -37: [(-46, -24)], -36: [(-46, -24)], -35: [(-46, -24)], -34: [(-46, -24)], -33: [(-46, -24)], -32: [(-46, -24)], -31: [(-46, -24)], -30: [(-46, -24)], -29: [(-46, -24)], -28: [(-46, -20)], -27: [(-46, -20)], -26: [(-46, -20)], -25: [(-46, -20)], -24: [(-46, -20)], -23: [(-46, -20)], -22: [(-46, -20)], -21: [(-46, -20)], -20: [(-46, -20)], -19: [(-46, -20)], -18: [(-46, -7)], -17: [(-46, -7)], -16: [(-46, -16)], -15: [(-46, -16)], -14: [(-46, -16)], -13: [(-46, -16)], -12: [(-46, -16)], -11: [(-46, -16)], -10: [(-46, -16)], -9: [(-46, -16)], -8: [(-46, -16)], -7: [(-46, -16)], -6: [(-46, -16)], -5: [(-46, -16)], -4: [(-46, -8)], -3: [(-46, -6)], -2: [(-46, -4)], -1: [(-46, -4)], 0: [(-46, -4)], 1: [(-46, -4)], 2: [(-46, -4)], 3: [(-46, -4)], 4: [(-46, -4)], 5: [(-46, -4)], 6: [(-46, -4)], 7: [(-46, -4)], 8: [(-46, -6)], 9: [(-46, -8)], 10: [(-46, -21)], 11: [(-46, -21)], 12: [(-46, -15)], 13: [(-46, -15), (33, 43)], 14: [(-46, -15), (-12, -9), (1, 46)], 15: [(-46, 46)], 16: [(-46, 46)], 17: [(-46, 46)], 18: [(-46, 46)], 19: [(-46, 46)], 20: [(-46, 15)], 21: [(-46, -7)], 22: [(-46, -17), (-12, -9)], 23: [(-46, -18)], 24: [(-46, -18)], 25: [(-46, -19)], 26: [(-46, -19)], 27: [(-46, -20)], 28: [(-46, -21)], 29: [(-46, -21)], 30: [(-46, -22)], 31: [(-46, -22)], 32: [(-46, -23)], 33: [(-46, -23)], 34: [(-46, -23)], 35: [(-46, -23)], 36: [(-46, -24)], 37: [(-46, -24)], 38: [(-46, -25)], 39: [(-46, -25)], 40: [(-46, -26)], 41: [(-46, -26)], 42: [(-46, -26)], 43: [(-46, -26)], 44: [(-46, -27)], 45: [(-46, -27)], 46: [(-46, -27)]}
SAND = {-46: [(-22, 2)], -45: [(-22, 2)], -44: [(-22, 2)], -43: [(-22, 1)], -42: [(-23, 1)], -41: [(-23, 1)], -40: [(-23, 6)], -39: [(-23, 6)], -38: [(-23, 6)], -37: [(-23, 6)], -36: [(-23, 6)], -35: [(-23, 6)], -34: [(-23, 6)], -33: [(-23, 6)], -32: [(-23, 6)], -31: [(-23, 6)], -30: [(-23, 6)], -29: [(-23, 6)], -28: [(-19, 6)], -27: [(-19, 6)], -26: [(-19, 6)], -25: [(-19, 6)], -24: [(-19, 6)], -23: [(-19, 6)], -22: [(-19, 6)], -21: [(-19, 6)], -20: [(-19, 3)], -19: [(-19, 3)], -18: [], -17: [], -16: [(-15, 6)], -15: [(-15, 3)], -14: [(-15, 1)], -13: [(-15, 1)], -12: [(-15, 1)], -11: [(-15, 1)], -10: [(-15, 1)], -9: [(-15, 1)], -8: [(-15, 3)], -7: [(-15, 3)], -6: [(-15, 3)], -5: [(-15, 3)], -4: [(-7, 3)], -3: [(-5, 3)], -2: [(-3, 3)], -1: [], 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [(-3, 9)], 7: [(-3, 9)], 8: [(-5, 9)], 9: [(-7, 9)], 10: [(-20, 9)], 11: [(-20, 9), (41, 43)], 12: [(-14, 46)], 13: [(-14, 32), (44, 46)], 14: [(-14, -13), (-8, 0)], 15: [], 16: [], 17: [], 18: [], 19: [], 20: [(16, 46)], 21: [(-6, 46)], 22: [(-16, -13), (-8, 15)], 23: [(-17, 2)], 24: [(-17, 1)], 25: [(-18, 1)], 26: [(-18, 1)], 27: [(-19, 1)], 28: [(-20, 1)], 29: [(-20, 0)], 30: [(-21, 0)], 31: [(-21, 0)], 32: [(-22, -1)], 33: [(-22, -1)], 34: [(-22, -1)], 35: [(-22, -1)], 36: [(-23, -1)], 37: [(-23, -2)], 38: [(-24, -2)], 39: [(-24, -2)], 40: [(-25, -2)], 41: [(-25, -2)], 42: [(-25, -3)], 43: [(-25, -3)], 44: [(-26, -3)], 45: [(-26, -4)], 46: [(-26, -4)]}

def wet(x, y): return any(a <= x <= b for a, b in WATER.get(y, ()))
def sandy(x, y): return any(a <= x <= b for a, b in SAND.get(y, ()))
g.claim([(x, y) for y in range(-46, 47) for a, b in WATER.get(y, ()) for x in range(a, b + 1)], 'water')

BOARDS = [[-26, 2, -4, 3], [-31, 0, -27, 5], [-24, 10, -12, 11], [-29, 9, -25, 12], [-24, -18, -7, -17], [18, 13, 19, 17], [32, 13, 33, 16]]      # piers and slips: the generator's boardwalk over water (world check: Lane A runs out along pier A)
BEDS = ('rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white')
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEACH = ['rg_shells', 'rg_sea_stone', 'rg_sea_pebble', 'shell', 'pebbles', 'rg_rock_small', 'dryTuft', 'rg_shells', 'grassBlades']

# ================================================================ roads: 2 wide dirt; lanes 1 wide
g.lane([(46, 3), (10, 3)], 2, 'd')                                                               # Main Street to Route 9
g.lane([(3, -3), (3, -16), (7, -16), (7, -31), (4, -31), (4, -45)], 2, 'd')                        # Shore Road, north from the quay along the edge of the beach
g.lane([(42, 2), (42, -13), (38, -13), (38, -27), (42, -27), (42, -42)], 2, 'd')                   # Orchard Road: up the east side, closing the ring
g.exit(46, 3, 'E')
g.rect(-6, -18, 6, -17, 'd')                                                                      # Beach Lane to the net landing jetty
g.lane([(3, 8), (3, 12)], 2, 'd')                                                                 # the quay lane south to the wharf
# the quay: a rounded cobbled square on the harbour's east shore, a tan ring round the well
g.blob(3, 2, ["...#######...", ".###########.", "#############", "#############", "#############", "#############", "#############", "#############", "#############", ".###########.", "...#######..."], 'c')
g.blob(3, 2, ["..#####..", "#########", "#########", "#########", "#########", "#########", "..#####.."], 't')

# ================================================================ lanes (1 wide); every one ends on a road, another lane, a plaza or a door
LANES = [
    [(-11, 10), (-11, 12), (45, 12)],                    # Wharf Lane along the inlet
    [(45, 5), (45, 12)],
    [(5, -9), (24, -9), (24, -11), (37, -11), (37, -12)],           # Net Row
    [(9, -23), (22, -23), (22, -25), (37, -25)],         # Chandlers Row
    [(6, -34), (20, -34), (20, -37), (41, -37)],         # Orchard Row
    [(-9, -44), (-9, -19)],                              # Strand Lane, down the north beach
    [(-8, -30), (3, -30)],                               # Rope Walk
]
for pts in LANES: g.lane(pts, 1, 'd')

BASE = set()
def base_cells(name, x, y, wide=0):
    d = kit.plan.PROPS[name]; x0 = ((x + .5) * 32 - d['door'][0] - d['ax']) / 32; x1 = x0 + d['sw'] / 32
    return [(cx, cy) for cy in (y - 2, y - 1) for cx in range(int(x0 + .5) - wide, int(x1 - .5) + 1 + wide)]
def fits(name, x, y):
    cells = g.box(name, x, y, bld=True); base = base_cells(name, x, y, 1)
    if (x, y - 1) in BASE or (x, y - 2) in BASE or (x, y) in BASE: return False
    return g.free(cells) and all(g.get(cx, cy) == '.' for cx, cy in cells + base if (cx, cy) != (x, y - 1)) and not any(c in BASE for c in base_cells(name, x, y, 1))
def lot(name, x, y, **k):
    if not fits(name, x, y): print('  T5: no room for', name, x, y); return False
    BASE.update(base_cells(name, x, y)); g.lot(name, x, y, **k); return True
def hrow(ly, x0, x1, kinds, seed, gap=(0, 2), back=(0, 0, 0, 1), miss=0.0, beds=BEDS):
    """houses on the north side of the horizontal lane y = ly between x0 and x1: at each position the first of the shuffled kinds that fits is built"""
    r = random.Random(seed); x = x0
    while x < x1:
        if r.random() < miss: x += 3; continue
        ks = kinds[:]; r.shuffle(ks); done = False
        for name in ks:
            w = kit.size(name)[0]; cx = int(round(x + w / 2 + .3)); b = r.choice(back)
            if cx + w / 2 > x1 + 1.5: continue
            for bb in (b, 0, 1):
                if fits(name, cx, ly - 1 - bb) and lot(name, cx, ly - 1 - bb, street_y=ly, beds=beds if w >= 3.3 else None): x = cx + w / 2 + r.randint(*gap); done = True; break
            if done: break
        if not done: x += 1
def vcol(sx, y0, y1, kinds, seed, side='E', off=2, gap=(0, 2), miss=0.0):
    """houses beside the vertical lane x = sx, on its east or west side, the door walk crosses to the lane"""
    r = random.Random(seed); y = y0
    while y < y1:
        name = r.choice(kinds); w, h = kit.size(name)[:2]; dx = int(round(w / 2 + off + r.choice((0, 0, 1))))
        ok = r.random() >= miss and fits(name, sx + dx if side == 'E' else sx - dx, int(y + h)) and lot(name, sx + dx if side == 'E' else sx - dx, int(y + h), street_x=sx, beds=None)
        y += h + (r.randint(*gap) if ok else 1)
BIG = ['rg_house_red_a', 'rg_house_red_b', 'rg_house_red_c', 'rg_house_wood_a', 'rg_house_wood_b', 'rg_house_wood_c']
MID = ['rg_house_red_d', 'rg_house_wood_d', 'sBlueRoofHouseB', 'houseBlueGable', 'houseBlueRoof', 'chaletRed', 'chaletRedB', 'chaletPink', 'cottageRed', 'mCottageBlue']
SMH = ['sBlueRoofHouse', 'sBlueRoofHouseWide', 'houseBlueSplit', 'houseBlueTall', 'houseBlueDome', 'cottageTeal', 'wHouseGrey', 'wHouseTeal']
SHED = ['jCabinA', 'jCabinB', 'maHutWood', 'sThatchHouse', 'wHouseBig', 'maLogCabin']

# ================================================================ the interiors: the Center, the store and six houses (same ids, footprints and sprites as before)
FP = lambda ex: {'w': 4, 'd': 4, 'ex': ex}
g.building('pokeCenterGrand', 14, 2, ['t5-center', {'w': 5, 'd': 3, 'ex': 2}]); g.rect(14, 1, 14, 2, 'd')
g.building('warehouse', 24, 2, ['t5-mart', {'w': 6, 'd': 3, 'ex': 2}]); g.rect(24, 1, 24, 2, 'd')
lot('inn', 34, 2, role=['t5-h2', FP(2)], beds=None)
lot('tavern', 8, -4, street_y=-2, role=['t5-h1', FP(1)], beds=None)
lot('hotelBlue', -2, -4, street_y=-2, role=['t5-h3', FP(1)], beds=None)
lot('chaletRedBig', 14, 11, street_y=12, role=['t5-h4', FP(1)], beds=None)
lot('chaletRedChimney', 26, 11, street_y=12, role=['t5-h5', FP(1)], beds=None)
lot('tavern', 39, 11, street_y=12, role=['t5-h6', FP(1)], beds=None)

lot('jCabinA', -3, 11, street_y=12, beds=None)                              # the boatyard shed
# ================================================================ houses
def hstreet(pts, kinds, seed, miss=0.0, gap=(1, 3), x0=None, x1=None):
    for k, ((xa, ya), (xb, yb)) in enumerate(zip(pts, pts[1:])):
        if ya == yb: hrow(ya, max(min(xa, xb) + 1, x0 if x0 is not None else -99), min(max(xa, xb) - 1, x1 if x1 is not None else 99), kinds, seed + k, miss=miss, gap=gap)
hrow(3, 10, 41, MID + SMH, 1, gap=(1, 2))                                   # Main Street, north side, between the Center, the store and the inn
hrow(12, 6, 44, SMH + MID, 2, gap=(1, 3))                                   # the wharf houses
hstreet(LANES[2], BIG + MID, 3, .0, (0, 2)); hstreet(LANES[3], BIG + MID + SMH, 4, .0, (0, 2)); hstreet(LANES[4], BIG + MID + SMH, 5, .0, (0, 2))
def infill(pts, kinds, seed, chance=.8):
    """a second pass: small houses in the gaps the first pass left along the horizontal runs of a lane"""
    r = random.Random(seed)
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya != yb: continue
        for x in range(min(xa, xb) + 2, max(xa, xb) - 1):
            name = r.choice(kinds)
            if r.random() < chance and fits(name, x, ya - 1): lot(name, x, ya - 1, street_y=ya, beds=None)
TINY = ['sBlueRoofHouse', 'houseBlueSplit', 'houseBlueTall', 'cottageTeal', 'wHouseGrey', 'wHouseTeal', 'cottageRed', 'sBlueRoofHouseB', 'mCottageBlue', 'chaletRed']
for k in (2, 3, 4): infill(LANES[k], TINY, 50 + k, .8)
infill([(10, 3), (41, 3)], TINY, 60, .8); infill(LANES[0][1:], TINY, 61, .6)
vcol(-9, -43, -21, SHED, 6, 'W', gap=(0, 1)); vcol(-9, -43, -21, SHED, 7, 'E', gap=(0, 1)); vcol(-9, -43, -21, SHED, 8, 'W', gap=(0, 1))

# ================================================================ the quay: the well, fish stalls on the rim, benches, lamps, bollards along the water
g.prop('jWell', 3, 2, walk=True)
g.props('benchYellow', [(0, 5), (6, 5)], walk=True); g.props('flowerBowl', [(-1, 5), (7, 5), (-1, -1), (8, 1)], walk=True)
g.props('pxStallBlue', [(1, -2)], walk=True); g.props('marketAwning', [(4, 7)], walk=True); g.props('pxStallPink', [(7, 7)], walk=True)
g.props('crateWide', [(3, -2), (-2, 1)], walk=True); g.props('barrelOrange', [(4, -2), (8, 5)], walk=True); g.props('barrelDark', [(8, -1)], walk=True); g.props('seedSack', [(9, 3), (-2, 6)], walk=True)
g.props('lampPost', [(-2, -2), (8, -2), (-2, 7), (8, 7)], walk=True); g.props('noticeBoard', [(10, 5)], walk=True); g.props('pokeSign', [(10, 1)], walk=True)
g.props('wBollard', [(-3, 0), (-3, 1), (-3, 4), (-3, 5), (-3, -1)], walk=True, force=True)
# the harbour: boats in the basin and off the piers, bollards on the boards, rocks in the shallows (the generator's boats are kept where they were)
for n, x, y in (('maSailboat', -13, 1), ('maRowboat', -13, 8), ('speedboat', -21, 5), ('boatWhite', -9, 6), ('maRowboat', -20, -15), ('maRowboat', -15, -20),
                ('bigRockGreyWater', -20, -3), ('rockWater', -22, -2), ('bigRockGreyWater', -17, 11), ('rockWater', -19, 13), ('caveRockWater', -30, 15), ('rockWater', -22, -20), ('bigRockGreyWater', -25, -14)):
    g.prop(n, x, y, force=True)
for x, y in ((-27, 1), (-27, 4), (-26, 9), (-13, 10), (-7, -17), (-7, -18), (-31, 0), (-31, 5)): g.prop('wBollard', x, y, force=True, walk=True)
g.props('lampPost', [(-8, 9), (-1, 9)], walk=True)
g.props('crateWide', [(-31, 4), (-29, 12)], force=True, walk=True); g.props('barrelOrange', [(-31, 1), (-27, 12)], force=True, walk=True)


# ================================================================ Main Street furniture, the Beach Lane and the jetty
for x in range(12, 45, 8): g.prop('lampPost', x, 5, walk=True)
g.props('streetSign', [(45, 2)])
g.props('lampPost', [(-4, -16), (2, -16), (-12, -16), (-6, -19)], walk=True); g.props('benchYellow', [(-1, -15)], walk=True)
g.props('crateWide', [(-4, -19), (-3, -19)], walk=True); g.props('barrelDark', [(-2, -19)], walk=True)

# ================================================================ the north beach: the working shore (boats drawn up, nets, driftwood, rocks) and the huts on Strand Lane
for n, x, y in (('maRowboat', -15, -24), ('maRowboat', -17, -35), ('maRowboat', -14, -41), ('maRowboat', -4, -26), ('maRowboat', -2, -38), ('maRowboat', -11, -14), ('maRowboat', -5, -12)):
    g.prop(n, x, y)
g.props('crateWide', [(-6, -22), (-5, -21), (-13, -29), (-12, -28), (-3, -31)]); g.props('barrelOrange', [(-7, -23), (-14, -28)]); g.props('barrelDark', [(-4, -21), (-6, -30)]); g.props('crateBox', [(-5, -22), (-12, -30)])
g.props('benchYellow', [(-7, -26), (-12, -33)]); g.props('fallenLog', [(-5, -15), (-18, -30), (-3, -42)]); g.props('logShort', [(-17, -26), (-6, -35), (-15, -38)]); g.props('rg_logs', [(-1, -44), (-20, -22)])
g.props('bigRockGrey', [(-18, -27), (-1, -35)]); g.props('rockGrey', [(-17, -27), (-2, -36), (-19, -40)]); g.props('rockGreyB', [(-18, -28), (-2, -29)])
g.props('wSignBoard', [(-8, -19), (-9, -45)]); g.props('lampPost', [(-8, -24), (-8, -33), (-8, -41), (-8, -28)], walk=True)
g.props('rg_wreck', [(-21, -34), (-3, -44)]); g.props('maRowboat', [(-4, -33), (-17, -29), (-3, -20), (-16, -44)]); g.props('tentPair', [(-2, -25), (-1, -40), (-14, -20)]); g.props('rg_raft', [(-20, -31)], force=True)
g.rect(-10, -46, -8, -44, 't'); g.prop('rg_bench_stone', -9, -45, walk=True)
g.props('fenceRail', [(-14, -23), (-12, -23), (-14, -32), (-12, -32)]); g.props('fencePole', [(-15, -22), (-11, -22), (-15, -31), (-11, -31)])
# the south boatyard on the headland: boats on blocks, crates, a shed, the lamp at the pier foot
for n, x, y in (('maRowboat', -6, 12), ('maRowboat', -17, 12), ('maRowboat', 0, 10), ('maRowboat', -10, 8)): g.prop(n, x, y)
g.props('crateWide', [(-3, 11), (-14, 11)]); g.props('crateBox', [(-2, 11), (-13, 11)]); g.props('barrelOrange', [(-8, 11), (1, 9)]); g.props('seedSack', [(-4, 12)]); g.props('tripodLamp', [(-9, 11)]); g.props('twigs', [(-7, 9)]); g.props('fallenLog', [(-15, 10)]); g.props('barrelDark', [(-16, 11)])
# the wharf: crates and boats at the two slips, a boat for each house facing the inlet
g.props('crateWide', [(21, 13), (34, 13), (16, 13)]); g.props('barrelOrange', [(22, 13), (30, 13), (35, 13)]); g.props('crateBox', [(17, 13)])
for n, x, y in (('maRowboat', 22, 17), ('maRowboat', 36, 16), ('maRowboat', 12, 16), ('maRowboat', 4, 17), ('maRowboat', 42, 16)): g.prop(n, x, y, force=True)
g.props('reedsPair', [(8, 13), (28, 13), (40, 13)]); g.props('reeds', [(10, 13), (26, 13), (44, 13)])
g.props('lampPost', [(9, 13), (24, 13), (30, 13), (40, 13)], walk=True); g.props('noticeBoard', [(17, 13)], walk=True)


# ================================================================ the green with its pond, plots and the orchard between the rows
g.pond(25, -18, 4, 1.5)
g.trees(9, -22, 20, -14, FRUIT, dx=4, dy=3, seed=41); g.trees(30, -22, 37, -14, FRUIT, dx=4, dy=3, seed=42)
g.props('flowerBedPink', [(21, -19), (29, -19)]); g.props('flowerBedBlue', [(21, -17), (29, -17), (25, -15)])
g.props('rg_bench', [(17, -19), (31, -19), (24, -15)]); g.props('rg_lamp', [(16, -16), (32, -16), (16, -22), (32, -22)]); g.props('rg_sign_board', [(21, -15)])
def plot(region, w, h, crop, seed, every=2, tries=80):
    """a worked plot on the first free w x h patch (a tile clear all round) of the region, found from a random start"""
    r = random.Random(seed); x0, y0, x1, y1 = region
    for _ in range(tries):
        x, y = r.randint(x0, x1 - w), r.randint(y0, y1 - h)
        if all(g.get(cx, cy) == '.' and (cx, cy) not in g.occ and not sandy(cx, cy) for cx in range(x - 1, x + w + 1) for cy in range(y - 1, y + h + 1)):
            g.field(x, y, x + w - 1, y + h - 1, crop, every); return True
    return False
CROPS = ['leafPlantB', 'rg_pumpkin', 'rg_sunflowers', 'leafPlantC', 'sprout']
for k, (w, h) in enumerate([(8, 4), (7, 3), (9, 4), (6, 3), (8, 3), (7, 4)] * 2): plot((8, -44, 41, 6), w, h, CROPS[k % 5], 200 + k)

def beach(x0, y0, x1, y1, every=5, seed=3):
    """shells, pebbles and dry tufts on the sand (never on water, paving or other props)"""
    r = random.Random(seed)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if sandy(x, y) and r.random() * every < 1: g.prop(r.choice(BEACH), x, y, walk=True)
def cluster(cx, cy, n=7, rad=3, seed=1):
    r = random.Random(seed)
    for _ in range(n):
        x, y = cx + r.randint(-rad, rad), cy + r.randint(-rad // 2, rad // 2)
        if sandy(x, y): g.prop(r.choice(['rg_shells', 'rg_sea_stone', 'rg_sea_pebble', 'shell', 'rg_rock_small', 'rg_weeds', 'pebbles', 'rg_shells']), x, y, walk=True)
for k, (x, y) in enumerate(((-15, -24), (-17, -35), (-14, -41), (-4, -26), (-2, -38), (-11, -14), (-5, -12), (-6, 12), (-17, 12), (-8, 30), (-14, 38), (-13, -19), (-18, -44), (-5, -45), (-20, -16))): cluster(x, y + 1, 8, 4, k)
def bigbeach(x0, y0, x1, y1, every, seed, kinds):
    r = random.Random(seed)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if sandy(x, y) and r.random() * every < 1 and not any(not sandy(x + i, y + j) for i in (-2, 2) for j in (-1, 1)): g.prop(r.choice(kinds), x, y)
BIGB = ['rg_mound', 'rg_mound2', 'rockMoundBrown', 'jRocks', 'rg_boulder', 'rg_boulder2', 'bigRockGrey', 'rg_logs', 'rg_woodpile', 'fallenLog', 'rg_wreck', 'maRowboat', 'rg_rock_tall', 'rg_rock_grey2', 'rg_mound_grey']
bigbeach(-23, -46, 5, -5, 14, 31, BIGB); bigbeach(-26, 21, 6, 46, 16, 32, BIGB)
g.props('rg_palm', [(-12, -9), (-2, -9), (-8, -45), (-4, -22)])
beach(-23, -46, 6, -5, 9); beach(-20, 8, 9, 13, 7, 4); beach(-26, 21, 8, 46, 9, 5)

# ================================================================ the far bank across the inlet (Surf lands there): woods on the grass, a driftwood beach on the sand
g.trees(5, 24, 46, 46, WOOD, seed=21, skip=lambda x, y: math.sin(x / 4.5) + math.sin(y / 3.5) + math.sin((x + y) / 6.0) > .9)
for n, x, y in (('maRowboat', -8, 30), ('maRowboat', -14, 38), ('rg_wreck', -16, 28), ('bigRockGrey', -4, 25), ('rockGrey', -3, 26), ('bigRockGrey', -12, 44), ('fallenLog', -6, 34), ('logShort', -10, 40), ('rg_logs', -2, 36), ('bigRockGrey', 2, 22)): g.prop(n, x, y)
g.props('rg_palm', [(-5, 23), (-1, 28), (-12, 33), (-6, 41), (-14, 45)]); g.props('maRowboat', [(-1, 22), (-14, 32), (-20, 37), (-8, 39)]); g.props('rg_wreck', [(-11, 25), (-22, 42)]); g.props('rg_logs', [(-18, 33), (-6, 30)]); g.props('bigRockGrey', [(-24, 38), (-3, 34)])

# ================================================================ woods round the edge, then the finishing scatter
g.trees(44, -46, 46, 12, WOOD, seed=22); g.trees(5, -46, 41, -41, WOOD, seed=23); g.trees(44, -46, 46, -40, WOOD, seed=24)
g.claim([(x, y) for y in range(-46, 47) for a, c in SAND.get(y, ()) for x in range(a, c + 1)], 'sand')                  # the finishing planting stays off the beach
g.dress()
MEAD = SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_pink', 'rg_tiny_white']
g.groves(-22, -46, 46, 46, WOOD, gap=1, min_area=8, styles=[('orchard', FRUIT), ('woods', WOOD), ('orchard', FRUIT), ('woods', WOOD), ('meadow', MEAD)])
g.garden(5, -46, 46, 46, every=3)
g.drift(5, -46, 46, 46, SMALL, every=6)

g.done(dict(lim=LIM, hide_site_paths=True, boards=BOARDS))
