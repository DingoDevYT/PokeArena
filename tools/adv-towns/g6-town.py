"""Pinegrove, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g6-town.py
then python3 -I tools/adv-towns/preview.py G6 out.png to see it with the real art.

The story of the place: a forestry town in a clearing of the pine woods, where Route 3's haul road comes down from the north stands and meets the timber
road east (Route 111). The haul road is the spine: the Landing, a tan plaza with the Center, the Outfitters and the totem stump, sits on its crossing with
the timber road, and the foresters' cabins run off it along dirt lanes (the forestry office at the top of the cabin rows). East of the Landing the sawmill
hall (the gym) stands over its log yard, with vans and a loader parked in the yard and stacks of felled timber; the second landing south of the road holds
the trucks. South-west lie the sapling nursery (fenced beds of pines and seedlings round the keepers' houses), and south-east a replanted stand among the
stumps. A glade of wild meadow lies north-east of the Landing, kept for the animals, with the ranger's lodge on its far side. Pine woods wall the clearing in
except where the roads leave. Exits: north (9, -44) Route 3, east (44, 5) Route 111, south (10, 44) the way down."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(44, 'G6')
FP4 = lambda ex: {'w': 4, 'd': 4, 'ex': ex}
PINES = ['rg_pine_green0', 'rg_pine_green1', 'rg_pine_teal0', 'rg_pine_teal1', 'rg_pine_olive0', 'rg_pine_olive1']
WOOD = PINES * 3 + ['rg_tall_green0', 'rg_tall_green1', 'rg_tall_teal0', 'rg_round_green0']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
CAB = ['jCabinA', 'jCabinB', 'jCabinC', 'jCabinD']

# ================================================================ roads: 2 wide dirt for the haul road and the timber road; lanes and footpaths 1 wide
g.rect(0, 1, 18, 13, 't')                                                                        # the Landing, under the roads
g.lane([(9, -44), (9, 30), (10, 30), (10, 44)], 2, 'd')                                          # the haul road: Route 3 from the north, the way down south
g.lane([(11, 5), (44, 5)], 2, 'd')                                                               # the timber road east to Route 111
g.exit(9, -44, 'N'); g.exit(44, 5, 'E'); g.exit(10, 44, 'S')
g.lane([(8, -12), (-14, -12), (-14, -9), (-36, -9)], 1, 'd')                                     # Cabin Row (the dirt street the world checks look for is its first tile at (8, -12))
g.lane([(8, -26), (-10, -26), (-10, -29), (-36, -29)], 1, 'd')                                   # Upper Row
g.lane([(1, -11), (1, 1)], 1, 'd')                                                               # the footpath from Cabin Row down to the Landing
g.lane([(-25, -28), (-25, -10)], 1, 'd')                                                         # the allotment path between the rows
g.lane([(0, 3), (-36, 3)], 1, 'd')                                                               # Landing Lane
g.lane([(8, 18), (-36, 18)], 1, 'd')                                                             # Nursery Lane
g.lane([(-36, -29), (-36, 28)], 1, 'd')                                                          # the west footpath joins the rows
g.lane([(8, 28), (-36, 28)], 1, 'd')                                                             # the cross path through the nursery
g.lane([(-15, 19), (-15, 34)], 1, 'd')                                                           # the nursery walk, down to the keepers' shed
g.lane([(11, -26), (30, -26)], 1, 'd')                                                           # the glade path, out to the ranger's lodge
g.lane([(11, 24), (36, 24)], 1, 'd')                                                             # Stand Lane
g.lane([(25, 25), (25, 37)], 1, 'd')                                                             # the footpath down the replanted stand
g.lane([(21, 24), (21, 16)], 1, 'd')                                                             # the footpath from Stand Lane up to the second landing
g.rect(22, -5, 37, 4, 'd'); g.rect(20, 7, 37, 15, 'd')                                           # the sawmill yard and the second landing
g.rect(30, -7, 30, -6, 'd'); g.rect(23, -6, 23, -6, 'd'); g.rect(36, -6, 36, -6, 'd')

# ================================================================ the Landing: plaza, Center, Outfitters
W = dict(walk=True)
g.building('pokeCenterGrand', 5, 1, ['g6-center', {'w': 5, 'd': 3, 'ex': 2}])
g.building('warehouse', 14, 1, ['g6-mart', {'w': 6, 'd': 3, 'ex': 2}])
g.prop('totemStump', 4, 6, **W)
for x, y in ((2, 5), (6, 5), (2, 8), (6, 8)): g.prop(BEDS[(x + y) % 3], x, y, **W)
g.props('rg_bench', [(7, 3), (4, 9), (13, 3), (16, 3), (4, 12)], **W)
g.props('rg_lamp', [(0, 2), (8, 2), (11, 2), (18, 2), (1, 10), (8, 10), (11, 10), (18, 10), (1, 13), (6, 13), (11, 13), (18, 13)], **W)
g.props('rg_planter_tall_pink', [(2, 2), (7, 2), (0, 6)], **W); g.props('rg_planter_tall_orange', [(12, 2), (17, 2), (18, 7)], **W)
g.props('rg_stall', [(13, 10), (16, 10), (3, 12), (6, 12)], **W); g.props('rg_stall_rug', [(14, 13)], **W)
g.props('rg_woodpile', [(18, 9), (1, 12)], **W); g.props('rg_crates', [(11, 9), (12, 12)], **W); g.props('rg_crates2', [(17, 13)], **W); g.props('rg_barrel', [(17, 4), (7, 13)], **W)
g.props('noticeBoard', [(12, 4)], **W); g.props('rg_sign_board', [(7, 10)], **W); g.props('rg_pumpkin', [(2, 10), (8, 11)], **W)
g.prop('vanGrey', 15, 8, **W)
g.props('rg_young_green0', [(0, 4), (0, 9)]); g.props('rg_young_teal0', [(0, 1)])

# ================================================================ Cabin Row (y -12): the forestry office at its head, the older cabins west
g.building('hotelBlue', 3, -12, ['g6-office', {'w': 5, 'd': 4, 'ex': 2}])
g.props('rg_planter_tall_orange', [(0, -12), (6, -12)])
g.lot('rg_house_wood_d', -5, -13, street_y=-12, beds=None, extras=[('rg_woodpile', 3, 0)])
g.lot('chaletRedChimney', -11, -13, street_y=-12, role=['g6-h2', FP4(1)])
for x, n in ((-17, 'jCabinA'), (-21, 'rg_house_wood_d'), (-29, 'rg_house_wood_b'), (-34, 'jCabinD')):
    g.lot(n, x, -10, street_y=-9, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]) if n[0] == 'j' else None, extras=[('rg_woodpile', 3, 0)] if n[0] == 'j' else [])
g.props('rg_logs', [(6, -15), (7, -6)]); g.props('rg_woodpile', [(-13, -8)])
for x0 in (-10, -5): g.field(x0, -8, x0 + 3, -5, 'pineSapling', every=2)                                  # the office's demonstration beds
g.props('mNoticeBoard', [(2, -10)]); g.props('rg_barrel_water', [(-1, -10)]); g.props('rg_bench', [(5, -10)])
g.props('stumpLarge', [(-16, -6)])
for x in range(-12, -1, 2):
    if g.prop('mHedgeLongGreen', x, -4): g.claim([(x, -4), (x + 1, -4), (x, -5)], 'hedge')
g.props('rg_scarecrow', [(-20, -5)])

# ================================================================ Upper Row (y -26, then -29)
for x, n in ((5, 'rg_house_wood_c'), (-1, 'jCabinB'), (-6, 'rg_house_red_d')): g.lot(n, x, -27, street_y=-26, beds=(BEDS[x % 3], BEDS[(x + 2) % 3]) if n[0] == 'j' else None)
for x, n in ((-15, 'cabinGreen'), (-20, 'rg_house_wood_b'), (-26, 'barnOrange'), (-31, 'rg_house_red_a')):
    g.lot(n, x, -30, street_y=-29, beds=(BEDS[x % 3], BEDS[(x + 2) % 3]) if n[0] in 'jc' else None)
for x0 in (-34, -29): g.field(x0, -25, x0 + 3, -21, 'leafPlantB')                                         # kitchen gardens between the rows
for x0 in (-22, -18): g.field(x0, -25, x0 + 3, -21, 'rg_pumpkin', every=2)
g.rect(-14, -26, -12, -26, 's'); g.field(-14, -25, -12, -21, 'rg_sunflowers', every=2)
g.props('rg_woodpile', [(-1, -22), (-27, -16)]); g.props('rg_barrel_water', [(-13, -19), (-26, -17)]); g.props('rg_scarecrow', [(-8, -17), (-32, -17), (-17, -18)])

# ================================================================ Landing Lane (y 3): the old houses west of the Landing, the mill pond behind
for x, n in ((-5, 'rg_house_wood_c'), (-11, 'jCabinC'), (-16, 'rg_house_red_b'), (-22, 'jCabinA'), (-27, 'cabinGreen'), (-32, 'rg_house_wood_d')):
    g.lot(n, x, 2, street_y=3, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]) if n[0] in 'jc' else None, extras=[('rg_woodpile', 3, 0)] if n.startswith('jCab') else ())
g.pond(-18, 8, 5, 2); g.claim([(x, y) for y in range(3, 12) for x in range(-26, -9) if (x, y) not in g.occ], 'pondbank')
g.props('rg_bench', [(-9, 7), (-27, 7)]); g.props('rg_logs', [(-8, 6)]); g.props('rg_woodpile', [(-6, 9)]); g.props('rg_barrel_water', [(-25, 10)])

# ================================================================ Nursery Lane (y 18): the boarding houses and the keepers' houses; the nursery beds south
g.lot('tavern', -3, 17, street_y=18, role=['g6-h3', FP4(1)], beds=None, extras=[('rg_barrel', 3, -1), ('rg_table', -3, 0)])
g.lot('hall', -10, 17, street_y=18, role=['g6-h4', FP4(1)])
g.lot('hotelBlue', -21, 17, street_y=18, role=['g6-h5', FP4(1)])
g.lot('jCabinD', -27, 17, street_y=18); g.lot('rg_house_red_d', -32, 17, street_y=18)
for x0, x1, crop in ((-34, -30, 'pineSapling'), (-21, -17, 'pineSaplingTeal'), (-12, -8, 'pineSapling'), (-6, -2, 'saplingTree'), (0, 5, 'pineSaplingTeal')): g.field(x0, 22, x1, 26, crop, every=2)
g.lot('rg_greenhouse', -26, 27, street_y=28, beds=None)                                                     # the seedling house, facing the cross path
g.props('planterBoxBrown', [(-29, 27), (-23, 27)])
for x0, x1, crop in ((-34, -29, 'miniTree'), (-27, -21, 'pineSapling'), (-12, -9, 'pineSaplingTeal'), (-7, -2, 'pineSapling'), (1, 5, 'saplingTree')): g.field(x0, 30, x1, 35, crop, every=2)
g.field(-20, 30, -17, 35, 'pineSaplingTeal', every=2)
g.props('rg_bench', [(-17, 35), (-13, 35)]); g.props('mNoticeBoard', [(-15, 36)]); g.props('waterTank', [(-19, 35)]); g.props('rg_barrel_water', [(-11, 35)])
g.props('waterTank', [(-16, 23), (-8, 27)]); g.props('rg_barrel_water', [(-13, 27), (-20, 27), (-31, 27)]); g.props('rg_bench', [(-18, 25), (-13, 25)])
g.props('rg_woodpile', [(-31, 28), (3, 28)]); g.props('rg_barrel', [(-10, 37)])
for x in range(-34, 6, 2):
    if abs(x + 15) > 1 and g.prop('mHedgeLongGreen', x, 20): g.claim([(x, 20), (x + 1, 20), (x, 19)], 'hedge')
for x in range(-34, 6): g.prop(SMALL[x % len(SMALL)], x, 19, walk=True) if x % 2 == 0 and abs(x + 15) > 0 else None

# ================================================================ the sawmill: the gym hall at the head of its yard, sheds either side, vans, stacks and the loader
Y = dict(walk=True)
g.building('inn', 30, -6, ['g6-gym', {'w': 6, 'd': 4, 'ex': 2}])
g.building('thatchBarn', 23, -6); g.building('barnRed', 36, -6)
g.props('rg_planter_tall_pink', [(27, -6), (33, -6)]); g.props('rg_lamp', [(26, -6), (34, -6)])
g.props('vanGrey', [(35, 2), (24, 3)], **Y); g.props('stumpLarge', [(26, -5), (33, -1)], **Y)
for x in range(24, 32): g.prop('rg_logs', x, -3, **Y); g.prop('rg_woodpile', x, 0, **Y)                    # the log decks
for x in range(33, 37): g.prop('rg_woodpile', x, -3, **Y)
g.props('fallenLog', [(36, -1), (37, 3), (29, 3), (26, 2)], **Y); g.props('barrelOrange', [(32, 2), (22, -4)], **Y); g.props('crateWide', [(37, -2)], **Y); g.props('rg_crates', [(22, 1)], **Y); g.props('logShort', [(33, 1), (36, 1), (28, 2)], **Y)

# ================================================================ the second landing south of the timber road
g.props('truckPink', [(28, 12)], **Y); g.props('vanGrey', [(23, 14), (34, 14)], **Y); g.props('bulldozer', [(35, 11)], **Y)
g.props('stumpSmall', [(32, 13)], **Y)
for x in range(22, 31): g.prop('fallenLog', x, 10, **Y)
for x in range(31, 36): g.prop('logShort', x, 12, **Y)
g.props('fallenLog', [(25, 14), (30, 14)], **Y); g.props('logShort', [(37, 14)], **Y); g.props('stumpSmall', [(21, 9), (27, 14)], **Y)
g.props('barrelOrange', [(21, 14), (33, 9)], **Y); g.props('crateWide', [(22, 12)], **Y); g.props('crateBox', [(37, 9)], **Y); g.props('rg_woodpile', [(28, 14), (21, 12)], **Y); g.props('rg_logs', [(26, 12)], **Y)
for x in range(20, 38): g.prop('wLogFence', x, 17)

# ================================================================ Stand Lane (y 24)
g.lot('inn', 17, 23, street_y=24, role=['g6-h1', {'w': 4, 'd': 4, 'ex': 2}], beds=None)
for x, n in ((25, 'jCabinB'), (30, 'rg_house_red_c'), (36, 'cabinGreenWide')): g.lot(n, x, 23, street_y=24, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]) if n[0] in 'jc' else None)
g.trees(13, 27, 23, 35, ['rg_young_green0', 'rg_young_teal0', 'rg_young_olive0', 'rg_young_green1'], dx=2, dy=2)             # the second growth
for k, y in enumerate(range(27, 36, 2)):
    for x in range(27, 37):
        if (x * 7 + y * 13) % 11 != 0: g.prop(('pineSapling', 'pineSaplingTeal')[(x // 2 + k) % 2], x, y, walk=True)           # this year's planting
g.props('stumpLarge', [(14, 36), (20, 36), (30, 36), (34, 36), (27, 36)]); g.props('stumpSmall', [(22, 36)]); g.props('fallenLog', [(18, 36), (32, 36)])
g.prop('maHutWood', 25, 38) if False else None
g.props('rg_woodpile', [(26, 26), (24, 26)]); g.props('noticeBoard', [(26, 37)])

# ================================================================ the glade and the ranger's lodge
g.lot('jLodge', 30, -27, street_y=-26)
for x, n in ((15, 'jCabinA'), (21, 'maLogCabin'), (26, 'cabinGreen')): g.lot(n, x, -27, street_y=-26)
g.claim([(x, y) for y in range(-27, -22) for x in range(11, 17)], 'glade')
g.pond(21, -19, 3, 2); g.claim([(x, y) for y in range(-24, -14) for x in range(15, 28) if (x, y) not in g.occ], 'pondbank')
import random
rr = random.Random(21)
for y in range(-25, -14):
    for x in range(11, 25):
        if (x, y) in g.occ or (11 <= x <= 16 and -27 <= y <= -23) or rr.random() > .62: continue
        g.prop(rr.choice(SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_flower_white', 'rg_clump_green2', 'rg_clump_green3']), x, y, walk=True)
g.props('rg_stump_green', [(19, -24), (24, -17)]); g.props('rg_log', [(18, -16)]); g.props('rg_rock_small', [(24, -23), (17, -15)]); g.props('rg_mushroom_red', [(20, -15), (23, -21)]); g.props('rg_bench', [(21, -16)])
g.props('rg_young_green0', [(18, -22), (25, -19)]); g.props('rg_bush_green', [(18, -17), (24, -24)])
g.trees(25, -24, 37, -14, WOOD)

g.props('noticeBoard', [(6, -37), (36, 3)]); g.props('signGreenWide', [(14, -37), (7, 38)]); g.props('streetSign', [(8, -37), (12, 38)])
for y in (-34, -20, -4): g.prop('rg_lamp', 8, y)
for y in (-34, -20): g.prop('rg_lamp', 11, y) if y != -20 else None
g.props('rg_logs', [(8, -31), (11, -37)]); g.props('rg_woodpile', [(8, -16)]); g.props('wMailbox', [(8, -23), (8, -9)])

# ================================================================ woods walling the clearing in; flowers in the grass
def ragged(x, y): return ((x * 73856093) ^ (y * 19349663)) % 100 < 24                              # the rim is thinned at random, then refilled on a second lattice, so no row reads as stamped
for bb in ((-44, -44, 44, -38), (-44, 38, 44, 44), (38, -44, 44, 44), (-44, -44, -38, 44)): g.trees(*bb, WOOD, skip=ragged, seed=3)
for bb in ((-44, -44, 44, -38), (-44, 38, 44, 44), (38, -44, 44, 44), (-44, -44, -38, 44)): g.trees(*bb, WOOD[::-1], dx=3, dy=2, seed=8)
import random
for nm, bx, by, _r in g.blds:                                                                  # nothing is planted on a roof: every building's whole sprite, and the row above it, is claimed
    for c in g.box(nm, bx, by, bld=True): g.occ.setdefault(c, 'roof'); g.occ.setdefault((c[0], c[1] - 1), 'roof')
rd = random.Random(7)
for nm, x, y, sw in g.lots:                                                                    # the garden of each lot: trees two tiles clear of the walls, bushes at the front corners, a pot by the door
    hw = int(sw / 2 + .5)
    for dx in (-hw - 2, hw + 2):
        g.prop(rd.choice(('rg_round_green1', 'rg_young_green0', 'rg_round_teal1', 'rg_young_teal0', 'rg_tall_green1')), x + dx, y - 3) or g.prop(rd.choice(('rg_bush_green', 'rg_bush_teal', 'rg_bush_olive', 'rg_bush_pink')), x + dx, y - 2)
        g.prop(rd.choice(('rg_bush_green', 'rg_bush_teal', 'rg_bush_olive', 'rg_bush_pink')), x + dx + (1 if dx < 0 else -1), y)
    if g.get(x + 1, y) in ('.', 'g', 'a', 'Z'): g.prop(rd.choice(('rg_pot_plant', 'rg_pot_red', 'rg_pot_fern', 'rg_planter_tall_pink')), x + 1, y, walk=True)
g.groves(-43, -43, 43, 43, WOOD, gap=1, min_area=8, styles=[('woods', WOOD)])
g.garden(-43, -43, 43, 43, every=2)
g.drift(-44, -44, 44, 44, SMALL, every=6)
g.done(dict(lim=46, hide_site_paths=True))
