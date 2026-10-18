"""Longshore, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t7-town.py
then python3 -I tools/adv-towns/preview.py T7 out.png to see it with the real art.

The story of the place: a beach resort. The generator lays the wide sand beach and the bay that never gets deep (shallow water all the way out) on the west side,
and the four boardwalks this plan keeps where the world checks walk them: the seafront spine (x 7..9, from the resort square up to the dock), the dock at the north
(Route 6's fishing spot), the swim pier and the hire pier. The beach is the show: umbrellas and loungers in rows, beach bars, cabanas and palms, boats and rafts out in
the shallows, lamps and benches along the boards. East of the spine a shore garden (palms, beds, benches) screens the resort: Main Street runs east to Route 6 with the
Center, the beach store and the hall on its north side, and south of it the resort square, a cobbled plaza round a fountain with stalls and benches. Hotels, apartments
and chalets stand along kinked lanes that run back from the shore garden to Back Road, with cross lanes between them, the Seaside Gardens (a tan-pathed park with a
pond and a fountain) behind the Center, and cabanas and huts on the sand at the south end. Palms fill every gap and ring the east edge.
Exits: east (44, 6) Main Street to Route 6."""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

LIM = 46
g = kit.Town(LIM - 2, 'T7')
# The sea, its sand and the ford puddle are the generator's; these are the water runs and sand runs per row (x ranges from the town centre) so that
# loungers, umbrellas and houses only stand on dry ground.
WATER = {-44: [(-44, -5)], -43: [(-44, -5)], -42: [(-44, -5)], -41: [(-44, -5)], -40: [(-44, -6)], -39: [(-44, -6)], -38: [(-44, -7)], -37: [(-44, -7)], -36: [(-44, -7)], -35: [(-44, -6)], -34: [(-44, -6)], -33: [(-44, -6)], -32: [(-44, -6)], -31: [(-44, -6)], -30: [(-44, -6)], -29: [(-44, -6)], -28: [(-44, -6)], -27: [(-44, -6)], -26: [(-44, -6)], -25: [(-44, -6)], -24: [(-44, -6)], -23: [(-44, -6)], -22: [(-44, -6)], -21: [(-44, -6)], -20: [(-44, -6)], -19: [(-44, -6)], -18: [(-44, -6)], -17: [(-44, -6)], -16: [(-44, -6)], -15: [(-44, -6)], -14: [(-44, -6)], -13: [(-44, -6)], -12: [(-44, -6)], -11: [(-44, -6)], -10: [(-44, -6)], -9: [(-44, -6)], -8: [(-44, -6)], -7: [(-44, -6)], -6: [(-44, -4), (35, 37)], -5: [(-44, -4), (34, 38)], -4: [(-44, -6), (33, 39)], -3: [(-44, -6), (34, 38)], -2: [(-44, -6), (35, 37)], -1: [(-44, -6)], 0: [(-44, -6)], 1: [(-44, -6)], 2: [(-44, -6)], 3: [(-44, -6)], 4: [(-44, -6)], 5: [(-44, -6)], 6: [(-44, -5)], 7: [(-44, -2)], 8: [(-44, -2)], 9: [(-44, -5)], 10: [(-44, -4)], 11: [(-44, -4)], 12: [(-44, -3)], 13: [(-44, -2)], 14: [(-44, -1)], 15: [(-44, 0)], 16: [(-44, 0)], 17: [(-44, 1)], 18: [(-44, 2)], 19: [(-44, 3)], 20: [(-44, 3)], 21: [(-44, 4)], 22: [(-44, 4)], 23: [(-44, 4)], 24: [(-44, 5)], 25: [(-44, 5)], 26: [(-44, 6)], 27: [(-44, 6)], 28: [(-44, 7)], 29: [(-44, 7)], 30: [(-44, 8)], 31: [(-44, 8)], 32: [(-44, 8)], 33: [(-44, 9)], 34: [(-44, 9)], 35: [(-44, 9)], 36: [(-44, 9)], 37: [(-44, 9)], 38: [(-44, 9)], 39: [(-44, 9)], 40: [(-44, 9)], 41: [(-44, 9)], 42: [(-44, 9)], 43: [(-44, 9)], 44: [(-44, 9)]}
SAND = {-44: [(-4, 5)], -43: [(-4, 5)], -42: [(-4, 5)], -41: [(-4, 5)], -40: [(-5, 5)], -39: [(-5, 5)], -38: [], -37: [], -36: [], -35: [(-5, 4)], -34: [(-5, 4)], -33: [(-5, 4)], -32: [(-5, 4)], -31: [(-5, 5)], -30: [(-5, 5)], -29: [(-5, 8)], -28: [(-5, 8)], -27: [(-5, 8)], -26: [(-5, 8)], -25: [(-5, 8)], -24: [(-5, 8)], -23: [(-5, 5)], -22: [(-5, 5)], -21: [(-5, 5)], -20: [(-5, 5)], -19: [(-5, 5)], -18: [(-5, 8)], -17: [(-5, 8)], -16: [(-5, 8)], -15: [(-5, 8)], -14: [(-5, 8)], -13: [(-5, 15)], -12: [(-5, 15)], -11: [(-5, 8)], -10: [(-5, 8)], -9: [(-5, 8)], -8: [(-5, 8)], -7: [(-5, 8)], -6: [], -5: [(-3, 10)], -4: [(-5, 10)], -3: [(-5, 8)], -2: [(-5, 8)], -1: [(-5, 8), (35, 43)], 0: [(-5, 8), (32, 44)], 1: [(-5, 8), (30, 44)], 2: [(-5, 8), (28, 44)], 3: [(-5, 44)], 4: [(-5, 44)], 5: [(-5, 8), (26, 44)], 6: [(-4, 8), (26, 44)], 7: [(26, 44)], 8: [(26, 44)], 9: [(-4, 10), (26, 44)], 10: [(-3, 10), (26, 44)], 11: [(-3, 10), (26, 44)], 12: [(-2, 11), (27, 43)], 13: [(-1, 12), (27, 41)], 14: [(0, 15), (28, 40)], 15: [(1, 14), (29, 38)], 16: [(1, 15), (31, 35)], 17: [(2, 16)], 18: [(3, 16)], 19: [(4, 17)], 20: [(4, 18)], 21: [(5, 19)], 22: [(5, 20)], 23: [(5, 20)], 24: [(6, 20)], 25: [(6, 20)], 26: [(7, 21)], 27: [(7, 20)], 28: [(8, 20)], 29: [(8, 20)], 30: [(9, 20)], 31: [(9, 20)], 32: [(9, 20)], 33: [(10, 20)], 34: [(10, 20)], 35: [(10, 19)], 36: [(10, 19)], 37: [(10, 19)], 38: [(10, 19)], 39: [(10, 19)], 40: [(10, 19)], 41: [(10, 19)], 42: [(10, 19)], 43: [(10, 19)], 44: [(10, 20)]}

def wet(x, y): return any(a <= x <= b for a, b in WATER.get(y, ()))
def sandy(x, y): return any(a <= x <= b for a, b in SAND.get(y, ()))
g.claim([(x, y) for y in range(-44, 45) for a, b in WATER.get(y, ()) for x in range(a, b + 1)], 'water')

BOARDS = [[7, -44, 9, 17], [-17, -6, 6, -5], [-12, 7, 6, 8], [-22, -38, 6, -36]]      # the seafront boardwalk spine, the swim pier, the hire pier and the dock (world checks walk all four)
g.claim([(x, y) for x0, y0, x1, y1 in BOARDS for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)], 'boards')
PALM = ['rg_palm', 'rg_palm2', 'palmTree', 'palmTreeBig', 'rg_palm', 'rg_palm2']
PALM2 = ['rg_palm', 'rg_palm2']
BEDS = ('rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white')
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEACH = ['rg_shells', 'rg_sea_stone', 'rg_sea_pebble', 'shell', 'pebbles', 'rg_rock_small', 'dryTuft', 'rg_shells', 'grassBlades']

# ================================================================ roads
g.lane([(44, 6), (10, 6)], 2, 'd')                                                                         # Main Street to Route 6
g.lane([(40, -44), (40, -28), (36, -28), (36, -9), (40, -9), (40, 23), (38, 23), (38, 44)], 2, 'd')          # Back Road, up the east side
g.exit(44, 6, 'E')
LANES = [
    [(10, -37), (22, -37), (22, -35), (39, -35)],                  # 0 Garden Row
    [(10, -29), (28, -29), (28, -27), (35, -27)],                  # 1 Shop Row
    [(10, -21), (20, -21), (20, -19), (35, -19)],                  # 2 Hotel Row
    [(10, -13), (35, -13)],                                        # 3 Park Row
    [(12, 23), (24, 23), (24, 25), (37, 25)],                      # 4 Chalet Row
    [(12, 32), (18, 32), (18, 30), (37, 30)],                      # 5 Palm Row
    [(12, 40), (28, 40), (28, 38), (37, 38)],                      # 6 Camp Row
]
for pts in LANES: g.lane(pts, 1, 'd')
CROSS = [[(30, -35), (30, -27)], [(15, -29), (15, -21)], [(26, -19), (26, -13)], [(16, 24), (16, 32)], [(30, 25), (30, 30)], [(32, 30), (32, 38)], [(12, 22), (12, 40)]]
# the resort square between Main Street and Chalet Row: cobbled, a fountain at its heart
g.blob(22, 12, ["...###########...", ".###############.", "#################", "#################", "#################", "#################", "#################", ".###############.", "...###########..."], 'c')
g.blob(22, 12, ["..#########..", "#############", "#############", "#############", "..#########.."], 't')
g.rect(22, 8, 22, 7, 'd')
g.lane([(12, 8), (12, 22)], 1, 'd')                         # the lane from the hire pier down the shore garden to Chalet Row
g.rect(10, 17, 12, 17, 'd')                                 # and its spur to the boardwalk's foot (the sand path x=10 runs on south to the camp)

BASE = set()
def base_cells(name, x, y, wide=0):
    d = kit.plan.PROPS[name]; x0 = ((x + .5) * 32 - d['door'][0] - d['ax']) / 32; x1 = x0 + d['sw'] / 32
    return [(cx, cy) for cy in (y - 2, y - 1) for cx in range(int(x0 + .5) - wide, int(x1 - .5) + 1 + wide)]
def fits(name, x, y):
    cells = g.box(name, x, y, bld=True); base = base_cells(name, x, y, 1)
    if (x, y - 1) in BASE or (x, y - 2) in BASE or (x, y) in BASE: return False
    return g.free(cells) and all(g.get(cx, cy) == '.' for cx, cy in cells + base if (cx, cy) != (x, y - 1)) and not any(c in BASE for c in base_cells(name, x, y, 1))
def lot(name, x, y, **k):
    if not fits(name, x, y): print('  T7: no room for', name, x, y); return False
    BASE.update(base_cells(name, x, y)); g.lot(name, x, y, **k)
    r = random.Random(x * 131 + y * 17); w = kit.size(name)[0]
    for side in (-1, 1):                                                       # a planter, bowl, barrel or bench beside the door
        if r.random() < .6: g.prop(r.choice(EXTRAS), x + side * int(w / 2 + 1.2 + r.choice((0, 0, 1))), y - r.choice((0, 0, 1)), walk=r.random() < .3)
    return True
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
def hstreet(pts, kinds, seed, miss=0.0, gap=(0, 2), x0=-99, x1=99):
    for k, ((xa, ya), (xb, yb)) in enumerate(zip(pts, pts[1:])):
        if ya == yb: hrow(ya, max(min(xa, xb) + 1, x0), min(max(xa, xb) - 1, x1), kinds, seed + k, miss=miss, gap=gap)
def vcol(sx, y0, y1, kinds, seed, side='E', off=2, gap=(0, 2), miss=0.0):
    r = random.Random(seed); y = y0
    while y < y1:
        name = r.choice(kinds); w, h = kit.size(name)[:2]; dx = int(round(w / 2 + off + r.choice((0, 0, 1))))
        ok = r.random() >= miss and fits(name, sx + dx if side == 'E' else sx - dx, int(y + h)) and lot(name, sx + dx if side == 'E' else sx - dx, int(y + h), street_x=sx, beds=None)
        y += h + (r.randint(*gap) if ok else 1)
def infill(pts, kinds, seed, chance=.8, x0=-99, x1=99):
    r = random.Random(seed)
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya != yb: continue
        for x in range(max(min(xa, xb) + 2, x0), min(max(xa, xb) - 1, x1)):
            name = r.choice(kinds)
            if r.random() < chance and fits(name, x, ya - 1): lot(name, x, ya - 1, street_y=ya, beds=None)
for pts in CROSS: g.lane(pts, 1, 'd')

EXTRAS = ['rg_barrel', 'rg_planter_white', 'rg_planter_pink', 'flowerBowl', 'balloonPot', 'rg_pot_plant', 'rg_pot_red', 'rg_pot_fern', 'rg_basin', 'rg_crates', 'rg_bush_pink', 'roseBush', 'whiteBlossomBush', 'rg_planter_tall_blue']
RES = ['mMintApt', 'mMintHall', 'mMintGable', 'mMintStore', 'hotelGrey', 'apartmentGrey', 'apartmentGreyLong', 'hotelBlue', 'sGoldInn', 'rg_sandhall', 'maShopCyan', 'sTealStore', 'mMintShop']
CHAL = ['chaletRed', 'chaletRedB', 'chaletPink', 'chaletRedChimney', 'chaletRedBig', 'wHouseMint', 'cottageTeal', 'houseBlueGable', 'houseBlueRoof', 'sBlueRoofHouseB', 'mCottageBlue', 'rg_house_red_d', 'rg_house_wood_d', 'rg_house_red_c', 'rg_house_wood_c']
SMH = ['sBlueRoofHouse', 'sBlueRoofHouseWide', 'houseBlueSplit', 'houseBlueTall', 'houseBlueDome', 'cottageTeal', 'wHouseGrey', 'wHouseTeal', 'sDomeHut', 'rg_hut_round', 'strawHut']

# ================================================================ the interiors (same ids, footprints and sprites as before)
FP = lambda ex: {'w': 4, 'd': 4, 'ex': ex}
g.building('pokeCenterGrand', 15, 5, ['t7-center', {'w': 5, 'd': 3, 'ex': 2}]); g.rect(15, 4, 15, 5, 'd')
g.building('warehouse', 25, 5, ['t7-mart', {'w': 6, 'd': 3, 'ex': 2}]); g.rect(25, 4, 25, 5, 'd')
lot('hall', 34, 5, street_y=6, role=['t7-h5', FP(1)], beds=None)
lot('hotelBlue', 16, -14, street_y=-13, role=['t7-h1', FP(1)], beds=None)
lot('chaletRedBig', 30, -14, street_y=-13, role=['t7-h2', FP(1)], beds=None)
lot('chaletRedChimney', 15, 22, street_y=23, role=['t7-h3', FP(1)], beds=None)
lot('tavern', 21, 22, street_y=23, role=['t7-h4', FP(1)], beds=None)

# ================================================================ houses
hstreet(LANES[0], RES + CHAL, 1, .0, (0, 0)); hstreet(LANES[1], RES + CHAL + SMH, 2, .0, (0, 0)); hstreet(LANES[2], RES + CHAL, 3, .0, (0, 0)); hstreet(LANES[3], CHAL + SMH, 8, .0, (0, 0), 14)
hrow(6, 11, 44, RES + CHAL, 4, gap=(0, 1))
hstreet(LANES[4], CHAL + SMH, 5, .0, (0, 0)); hstreet(LANES[5], CHAL + SMH, 6, .0, (0, 0)); hstreet(LANES[6], SMH + CHAL, 7, .0, (0, 0))
for k, ch in ((0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1)): infill(LANES[k], SMH, 50 + k, ch)
vcol(30, -34, -28, SMH + CHAL, 70, 'E', gap=(0, 1)); vcol(30, -34, -28, SMH + CHAL, 72, 'W', gap=(0, 1)); vcol(15, -28, -22, SMH, 71, 'W'); vcol(15, -28, -22, SMH, 73, 'E')
vcol(26, -18, -14, SMH, 74, 'E'); vcol(26, -18, -14, SMH, 75, 'W')
vcol(35, -26, -10, SMH + CHAL, 76, 'W', gap=(0, 1)); vcol(35, -43, -29, SMH + CHAL, 77, 'W', gap=(0, 1))
vcol(16, 24, 32, SMH, 78, 'E'); vcol(16, 24, 32, SMH, 79, 'W'); vcol(32, 31, 38, SMH + CHAL, 80, 'E'); vcol(32, 31, 38, SMH + CHAL, 81, 'W'); vcol(30, 26, 30, SMH, 82, 'W')
vcol(12, 24, 42, SMH, 83, 'E', off=1)

# ================================================================ the shore garden between the boardwalk and the first houses: lamps, benches, palms, beds
for y in range(-42, 17, 7): g.prop('lampPost', 10, y, walk=True)
for y in range(-40, 17, 14): g.prop('benchTeal', 11, y + 3, walk=True)
for y in range(-44, 17, 5):
    if (y + 44) % 10 == 0: g.prop('rg_palm' if y % 20 else 'rg_palm2', 12, y)
    else: g.prop('flowerBedBlue' if y % 3 else 'flowerBedPink', 12, y, walk=True)
# the boardwalk itself: lamps on its east edge, bollards and lamps on the piers
for y in range(-40, 16, 8): g.prop('lampPost', 9, y, walk=True, force=True)
for x, y in ((-17, -6), (-17, -5), (-12, 7), (-12, 8), (-22, -38), (-22, -36)): g.prop('wBollard', x, y, force=True, walk=True)
for x in (-14, -8, -2): g.prop('lampPost', x, -6, force=True, walk=True)
for x in (-9, -3): g.prop('lampPost', x, 7, force=True, walk=True)
for x in (-18, -12, -6): g.prop('lampPost', x, -37, force=True, walk=True)
g.props('benchTeal', [(-8, -6), (-5, 8), (-14, -37)], force=True, walk=True)

# ================================================================ the beach: umbrellas with their loungers, beach bars, cabanas, palms
def group(x, y, pink):
    cells = [(x + i, y + j) for i in (-1, 0, 1) for j in (-2, -1, 0, 1, 2)]
    if not all(sandy(cx, cy) and (cx, cy) not in g.occ for cx, cy in cells): return False
    if not g.prop('maUmbrellaPink' if pink else 'maUmbrellaBlue', x, y, walk=True): return False
    for dx, dy in ((-1, 1), (1, 1)): g.prop('maLounger', x + dx, y + dy, force=True, walk=True)       # a lounger each side under the canopy, as in the mockups (a third below would wall the middle cell in, and the generator's reach repair removes them)
    return True
k = 0; rr = random.Random(77)
for y in range(-41, 43, 5):
    for x in (-3, 1, 5, 9):
        for dy in (0, 1, -1, 2, -2):
            for dx in (0, 1, -1):
                if rr.random() < .22: continue                                    # a gap now and then: towels, a sandcastle's worth of shells
                if group(x + dx, y + dy, (k % 2 == 0)): k += 1; break
            else: continue
            break
print('  T7: beach groups', k)
for x, y in ((-3, -34), (1, -14), (5, -9), (-3, 20), (1, 36), (-1, -42)): g.prop(('rg_shells', 'rg_sea_stone', 'coralPink', 'shell')[(x + y) % 4], x, y, walk=True)
g.props('pxStallBlue', [(0, 11), (3, -31)]); g.props('marketAwning', [(3, 11), (-1, -31)]); g.props('vendingRed', [(5, 11), (5, -30)]); g.props('rg_barrel', [(-2, 11), (6, -31)])
g.props('phoneBox', [(5, -10)]); g.props('rg_sign_board', [(1, -4), (1, 9), (1, -35)], walk=True)
g.props('palmHammock', [(-2, -22), (0, 26)]); g.props('rg_palm', [(5, -43), (-3, -35), (5, -26), (-4, -15), (5, -14), (-3, 3), (5, 3), (5, 14), (3, 17), (-3, 26)]); g.props('rg_palm2', [(-3, -40), (5, -32), (-3, -9), (6, 1), (-3, 12), (6, 22)])
for x, y in ((-1, 28), (2, 34), (4, 24)): g.prop(('sDomeHut', 'rg_hut_round', 'strawHut')[x % 3], x, y)
for n, x, y in (('maSailboat', -22, -22), ('speedboat', -14, 2), ('speedboat', -28, 12), ('maRowboat', -10, -20), ('maRowboat', -8, 14), ('speedboat', -20, -46), ('boatWhite', -12, -10), ('maRowboat', -16, 22), ('rg_water_raft', -9, 0), ('rg_water_raft2', -12, -25), ('rg_water_raft', -8, 30), ('rg_water_raft', -14, -32), ('maSailboat', -30, -12), ('rg_raft', -7, 17),
                ('maSailboat', -34, 30), ('maRowboat', -26, -30), ('speedboat', -30, -40), ('boatWhite', -24, 6), ('rg_water_raft3', -36, 0), ('maRowboat', -18, 36), ('boatWhite', -38, -20), ('rg_water_raft2', -20, 40), ('maRowboat', -30, 42), ('rg_water_raft', -26, -9), ('boatWhite', -40, 8)):
    g.prop(n, x, y, force=True)
for x, y in ((-6, 3), (-8, -12), (-7, 24), (-5, -26), (-7, 40), (-20, 15), (-32, -4), (-26, 26), (-16, -26), (-34, -34), (-18, 3)): g.prop('rg_water_rocks', x, y, force=True)

# ================================================================ the resort square: the fountain, stalls, benches, lamps
g.prop('maFountain', 22, 12, walk=True)
g.props('benchTeal', [(18, 9), (26, 9), (18, 15), (26, 15)], walk=True); g.props('lampPost', [(14, 8), (30, 8), (14, 16), (30, 16)], walk=True)
g.props('pxStallBlue', [(16, 17)], walk=True); g.props('pxStallPink', [(28, 17)], walk=True); g.props('marketAwning', [(22, 17)], walk=True)
g.props('flowerBowl', [(19, 12), (25, 12), (22, 9)], walk=True); g.props('vendingRed', [(31, 12)], walk=True); g.props('noticeBoard', [(13, 12)], walk=True); g.props('streetSign', [(43, 5)], walk=True)
g.props('rg_planter_white', [(15, 10), (29, 10), (15, 14), (29, 14)]); g.props('crateWide', [(15, 17)], walk=True); g.props('barrelOrange', [(29, 17)], walk=True)
for x in range(12, 44, 6): g.prop('lampPost', x, 8, walk=True)
for pts in LANES:
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if ya == yb:
            for x in range(min(xa, xb) + 5, max(xa, xb), 9): g.prop('lampPost', x, ya + 1, walk=True)
# the cafe terrace on the sand east of the square: tables under umbrellas
g.rect(31, 9, 39, 16, 't')
for x, y in ((33, 11), (37, 11), (33, 15), (37, 15)): g.prop('mTableRound', x, y, walk=True); g.prop('maUmbrellaBlue' if (x + y) % 2 else 'maUmbrellaPink', x + 1, y - 1, walk=True)
g.props('rg_bench', [(35, 13)], walk=True); g.props('flowerBowl', [(31, 9), (39, 9), (31, 16), (39, 16)], walk=True); g.props('lampPost', [(35, 9), (35, 16)], walk=True); g.props('pxStallBlue', [(35, 17)], walk=True)
g.props('rg_planter_pink', [(12, 3), (18, 3), (22, 3), (28, 3)]); g.props('rg_planter_white', [(20, 3)])

# ================================================================ the Seaside Gardens behind the Center: a tan path round a lawn, a fountain, beds and benches
g.rect(16, -11, 34, -2, 'g')
for x in range(17, 34, 4):
    for y in (-10, -3): g.prop('mHedgeRoundGreen', x, y)
g.rect(15, -12, 35, -12, 't'); g.rect(15, -1, 35, -1, 't'); g.rect(15, -12, 15, -1, 't'); g.rect(35, -12, 35, -1, 't')
g.rect(25, -12, 25, -13, 't'); g.rect(25, -2, 25, -1, 't'); g.rect(15, -7, 35, -7, 't'); g.rect(25, -12, 25, -1, 't')
g.prop('rg_fountain', 25, -6, walk=True)
for x, y in ((19, -9), (21, -9), (29, -9), (31, -9), (19, -4), (21, -4), (29, -4), (31, -4)): g.prop(BEDS[(x + y) % 3], x, y, walk=True)
g.props('benchTeal', [(18, -12), (32, -12), (18, -1), (32, -1), (22, -7), (28, -7)], walk=True); g.props('lampPost', [(14, -12), (36, -12), (14, -1), (36, -1), (25, -11), (25, -2)], walk=True)
g.props('rg_young_green0', [(17, -9), (33, -9), (17, -4), (33, -4)]); g.props('rg_palm', [(23, -10), (27, -10), (23, -3), (27, -3), (17, -6), (33, -6)])

# ================================================================ palms and gardens everywhere else
g.claim([(x, y) for y in range(-44, 45) for a, b in SAND.get(y, ()) for x in range(a, b + 1) if x < 10], 'beach')
g.trees(41, -44, 44, 44, PALM + WOOD[:3], dx=2, dy=2, seed=9)
g.trees(10, 42, 40, 44, PALM, dx=3, dy=2, seed=10)
g.dress(trees=PALM, bushes=('bush~sand', 'roundBush~sand', 'rg_bush_green', 'rg_bush_olive', 'rg_bush_pink'), pots=('rg_pot_plant', 'rg_pot_red', 'rg_pot_fern', 'flowerPot', 'rg_planter_tall_pink'))
MEAD = SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_pink', 'rg_tiny_white']
g.groves(10, -44, 44, 44, PALM, gap=1, min_area=8, styles=[('orchard', PALM2), ('meadow', MEAD), ('woods', PALM), ('orchard', PALM2)])
g.garden(10, -44, 44, 44, every=2)
g.drift(10, -44, 44, 44, SMALL + BEACH, every=3)
g.done(dict(lim=LIM, hide_site_paths=True, boards=BOARDS))
