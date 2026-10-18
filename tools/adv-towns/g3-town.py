"""Fernwell Park, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g3-town.py
then python3 -I tools/adv-towns/preview.py G3 out.png to see it with the real art.

The story of the place: a garden town that grew round the great park the Fernwell family laid out on the meadow beside the old north-south road (the Sanctuary
they founded lies to the north-west, and its road comes down the west side). The park is the town: a mown lawn with two ponds, a tan gravel walk round it inside
a clipped hedge, a bandstand in the middle, parterres of flower beds. The old road became the avenue down its east side; where the avenue meets Fernwell Square
the Center and the Mart stand either side of it, facing the fountain, and the Saturday flower market spreads east of the square. The best houses stand in a
crescent along the lane that bends round the park's north side, each behind its parterre, and along Sanctuary Road above it. The gym is the old hall at the
park's south gate, on the south lane. East of the market the glasshouse garden and the nursery fields lie behind the north-east row; below the square the
south-east rows look over kitchen gardens, an east green with its pond and the manor, and the orchard and its barn fill the north. The fishermen's cottages and
boat yard stand on the beach to the south-west. Woods wall the town in except where the roads leave.
Exits: north (4, -46) the old road, north-west (-42, -46) the Sanctuary road, south (3, 46), east (46, 25) the south-east road."""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(46, 'G3')
HW = {'rg_house_red_a': 5, 'rg_house_wood_a': 5, 'rg_house_red_b': 4, 'rg_house_red_c': 4, 'rg_house_wood_b': 4, 'rg_house_wood_c': 4, 'rg_house_red_d': 3, 'rg_house_wood_d': 3,
      'houseRedGable': 3, 'houseBlueGable': 3, 'cottageGreen': 3, 'cottageRed': 3, 'houseOrangeSmall': 3, 'cottageTeal': 3, 'houseBlueTall': 3, 'houseGreenFlat': 3,
      'maHouseBlueTimber': 5, 'maStoneHouse': 5, 'maHouseOrange': 5, 'inn': 5, 'maManorOrange': 6, 'tavern': 4, 'hall': 4}
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
HEDGE = 'mHedgeLongGreen'

def hrow(door_y, street_y, x, kinds, gap=3, beds=True):
    """a row of lots from x eastward: each house's door walkway on door_y, its walk down to the lane at street_y"""
    for k, n in enumerate(kinds):
        w = HW[n]; cx = x + (w + 1) // 2
        g.lot(n, cx, door_y, street_y=street_y, beds=(BEDS[(cx + k) % 3], BEDS[(cx + k + 1) % 3]) if beds else None)
        x += w + gap
    return x

# ================================================================ roads
g.lane([(4, -46), (4, -25)], 2, 'd'); g.lane([(4, -24), (4, -7)], 2, 'p')                       # the old road, down to the square
g.rect(-4, -6, 14, 3, 'p'); g.rect(0, -4, 8, 1, 't')                                            # Fernwell Square
g.lane([(3, 4), (3, 26)], 2, 'p'); g.lane([(3, 27), (3, 46)], 2, 'd')                           # the avenue south
g.lane([(46, 25), (5, 25)], 2, 'd')                                                             # the south-east road
g.lane([(-42, -46), (-42, -30), (2, -30)], 2, 'd')                                              # Sanctuary Road
g.lane([(3, -16), (-14, -16), (-14, -20), (-40, -20), (-40, -29)], 1, 'd'); g.lane([(-14, -29), (-14, -20)], 1, 'd')   # the crescent, and the lane up to Sanctuary Road
g.lane([(2, 19), (-36, 19)], 1, 'd')                                                            # south lane
g.lane([(-43, 14), (-36, 14), (-36, 27)], 1, 'd'); g.lane([(-43, 27), (-24, 27), (-24, 41)], 1, 'd')      # the beach lanes, and the lane down the west side of the south rows
g.lane([(2, 30), (-24, 30)], 1, 'd'); g.lane([(2, 41), (-31, 41)], 1, 'd')
g.lane([(6, -21), (24, -21), (24, -25), (40, -25)], 1, 'd'); g.rect(41, -26, 43, -24, 't'); g.lane([(24, -26), (24, -38)], 1, 'd')     # north-east row, the orchard lane
g.lane([(5, 13), (33, 13)], 1, 'd'); g.rect(34, 12, 36, 14, 't')                                      # south-east row, ending at the east green
g.lane([(41, 27), (41, 37), (5, 37)], 1, 'd')
g.rect(15, -6, 32, 2, 't'); g.lane([(22, -10), (22, -5)], 1, 'd'); g.lane([(31, -24), (31, -5)], 1, 'd')     # the market, the conservatory walk, the nursery walk
g.lane([(33, -2), (43, -2)], 1, 'd'); g.rect(43, -3, 44, -1, 't')
g.exit(4, -46, 'N'); g.exit(-42, -46, 'N'); g.exit(3, 46, 'S'); g.exit(46, 25, 'E')

# ================================================================ the park
for x0, y0, x1, y1 in ((-35, -11, -7, -11), (-35, 11, -7, 11), (-35, -11, -35, 11), (-7, -11, -7, 11), (-35, 0, -7, 0), (-21, -11, -21, 11)): g.rect(x0, y0, x1, y1, 't')
g.rect(-6, 0, -4, 0, 't'); g.rect(-22, -1, -20, 2, 'p'); g.rect(-21, 12, -21, 18, 't')
g.pond(-29, -6, 3.5, 2.5); g.pond(-14, 6, 3.5, 2.5)
g.prop('sWoodPagoda', -21, 1, walk=True); g.props('statueDog', [(-23, 1), (-19, -1)])
for x in range(-36, -5, 1):                                                                       # the clipped hedge round the lawn, open at the gates
    if abs(x + 21) > 1: g.prop(HEDGE, x, -12); g.prop(HEDGE, x, 12)
for y in range(-11, 12):
    if abs(y) > 1: g.prop('mHedgeTallGreen', -36, y); g.prop('mHedgeTallGreen', -6, y)

# ================================================================ buildings
g.building('pokeCenterGrand', -1, -6, 'center'); g.building('martTower', 10, -6)
g.lot('gymRed', -26, 18, street_y=19, beds=None)
g.lot('rg_dome_green', 22, -10, beds=None)
g.lot('barnRed', 24, -38, beds=None)
g.lot('maManorOrange', 38, 24, street_y=25, beds=None)
g.lot('maLogCabin', -31, 40, street_y=41, beds=None)

hrow(-31, -30, -38, ['rg_house_red_a', 'maHouseOrange', 'rg_house_red_c', 'rg_house_wood_d', 'rg_house_wood_a'])
hrow(-21, -20, -37, ['maHouseBlueTimber', 'rg_house_red_d', 'maStoneHouse'], gap=2)
hrow(-17, -16, -12, ['rg_house_red_b', 'rg_house_wood_b'])
hrow(-22, -21, 8, ['rg_house_wood_a', 'rg_house_red_c'])
hrow(-26, -25, 27, ['rg_house_red_a', 'rg_house_wood_d', 'rg_house_red_b'], gap=2)
hrow(12, 13, 8, ['rg_house_red_b', 'rg_house_wood_d', 'inn', 'rg_house_wood_c'], gap=3)
hrow(24, 25, 9, ['rg_house_wood_b', 'tavern', 'rg_house_red_a'], gap=3); g.lot('rg_house_wood_c', 31, 24, street_y=25)
hrow(36, 37, 9, ['rg_house_red_a', 'rg_house_red_d', 'hall', 'rg_house_wood_a'], gap=4)
g.lot('rg_house_red_b', 35, -3, street_y=-2); g.lot('rg_house_wood_d', 41, -3, street_y=-2)
hrow(18, 19, -34, ['rg_house_wood_d'], gap=3)
hrow(18, 19, -19, ['rg_house_red_c', 'rg_house_wood_b'], gap=2)
hrow(29, 30, -22, ['rg_house_wood_c', 'rg_house_red_a', 'rg_house_red_d'])
hrow(40, 41, -22, ['rg_house_wood_a', 'rg_house_red_c', 'rg_house_wood_d'], gap=2)
g.lot('cottageRed', -43, 13, street_y=14); g.lot('houseBlueGable', -39, 13, street_y=14)
for x, n in ((-43, 'houseRedGable'), (-39, 'cottageGreen'), (-29, 'houseOrangeSmall')): g.lot(n, x, 26, street_y=27)

# ================================================================ Fernwell Square: the fountain, beds and benches, the Center and the Mart facing it
g.prop('rg_fountain', 4, -1, walk=True)
for x, y in ((1, -4), (7, -4), (1, 1), (7, 1)): g.prop('rg_planter_pink' if x < 4 else 'rg_planter_orange', x, y, walk=True)
g.props('rg_bench', [(2, -2), (6, -2), (2, 0), (6, 0)], walk=True)
g.props('rg_lamp', [(-4, -5), (14, -5), (-4, 3), (14, 3), (9, -5), (9, 3)], walk=True); g.props('rg_lamp', [(-3, 3), (13, 3)], walk=True)
g.props('rg_planter_tall_pink', [(-3, -6), (3, -6), (6, -6), (12, -6)], walk=True); g.props('rg_planter_tall_orange', [(-2, 3), (12, 3)], walk=True)
g.props('rg_young_green0', [(-5, 4), (-5, -5)]); g.props('rg_sign_board', [(2, -9)])
g.props('rg_lamp', [(3, -9), (6, -9), (3, -15), (6, -15), (3, -21), (6, -21)])
g.props('rg_bush_green', [(2, -12), (2, -11), (6, -11), (6, -12), (7, -10), (7, -9)])
g.props('rg_lamp', [(6, 6), (6, 12), (2, 6), (2, 12), (2, 18), (6, 18), (2, 24), (6, 24)])
for k, x in enumerate((5, 7, 9, 11, 13)): g.prop(BEDS[k % 3], x, 5, walk=True)
g.props('rg_bench', [(8, 7), (12, 7)]); g.props('rg_young_teal0', [(6, 8), (10, 8), (14, 8)]); g.props('rg_planter_pink', [(7, 9), (11, 9)])
g.props('rg_round_pink0', [(-3, 7), (0, 9)]); g.props('rg_bench', [(-1, 6)]); g.props('rg_planter_orange', [(-4, 5), (0, 5)])

# ================================================================ the park: lawn furniture, parterres, the pond sides
g.prop('rg_fountain2', -14, -5)
for k, (x, y) in enumerate(((-17, -6), (-17, -4), (-11, -6), (-11, -4), (-15, -9), (-13, -9), (-15, -2), (-13, -2), (-18, -8), (-10, -8), (-18, -2), (-10, -2))): g.prop(BEDS[k % 3], x, y, walk=True)
for y in (3, 9):
    for k, x in enumerate(range(-33, -23, 2)): g.prop(BEDS[(k + y) % 3], x, y, walk=True)
g.prop('rg_round_pink0', -28, 6); g.props('rg_bench', [(-31, 6), (-25, 6)])
g.props('rg_bench', [(-33, 1), (-29, 1), (-26, 1), (-17, 1), (-11, 1)]); g.props('rg_bench', [(-12, -1), (-16, -1), (-27, -11)])
g.props('rg_lamp', [(-34, -10), (-8, -10), (-34, 10), (-8, 10), (-22, -10), (-20, -10), (-22, 10), (-20, 10), (-34, -1), (-34, 1), (-8, -1), (-8, 1), (-28, 0), (-14, 0)], walk=True)
g.props('rg_tall_green0', [(-33, -9), (-9, 9), (-33, -3), (-9, 3)]); g.props('rg_round_pink0', [(-9, -9), (-33, 9), (-25, -3), (-9, -3), (-25, 9)])
g.props('rg_young_teal0', [(-24, -9), (-18, 9), (-24, 9), (-18, -9), (-33, 4), (-9, 7)])
g.props('rg_bush_pink', [(-23, -3), (-19, -3), (-19, 3), (-23, 3), (-33, -6), (-25, -6), (-18, 5), (-10, 8), (-10, 4)])
for x in (-33, -31, -27, -25): g.prop(BEDS[x % 3], x, -2, walk=True)
for y in (-10, -8, -6, -4): g.prop(BEDS[y % 3], -22, y, walk=True); g.prop(BEDS[(y + 1) % 3], -20, y, walk=True)
for y in (4, 6, 8, 10): g.prop(BEDS[y % 3], -22, y, walk=True)
g.props('rg_young_green0', [(-22, -9), (-20, -9), (-20, 9)]); g.props('rg_planter_tall_pink', [(-22, -3), (-20, -3), (-22, 3)], walk=True)
for x in (-18, -16, -12, -10): g.prop(BEDS[x % 3], x, 3, walk=True)

# ================================================================ the parterre along the park's north side and the lawns by the lanes
for y in (-18, -15):
    for k, x in enumerate(range(-35, -15, 2)): g.prop(BEDS[(k + y) % 3], x, y, walk=True)
g.props('rg_lamp', [(-36, -17), (-26, -17), (-16, -17), (-8, -13), (-2, -13), (-36, -13), (-26, -13)])
g.props('rg_bench', [(-30, -16), (-22, -16), (-6, -13)])
g.props('rg_planter_pink', [(-10, -14), (-4, -14), (0, -14)]); g.props('rg_planter_orange', [(-8, -15), (-2, -15), (2, -15)])

# ================================================================ the market east of the square, the conservatory and the nursery
for k, x in enumerate((17, 20, 25, 28, 31)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, -3, walk=True)
for k, x in enumerate((17, 20, 24, 27, 30)): g.prop('rg_stall' if k % 2 else 'rg_stall_rug', x, 1, walk=True)
g.props('rg_crates', [(18, -1), (29, -1), (23, 0)], walk=True); g.props('rg_barrel', [(19, -1), (26, -1), (31, 0)], walk=True); g.props('rg_pot_plant', [(16, -5), (32, -5), (22, 0), (22, -2)], walk=True)
g.props('rg_planter_tall_pink', [(20, -5), (26, -5), (29, -5), (24, -5)], walk=True); g.props('rg_pumpkin', [(24, -1), (28, 0)], walk=True)
g.props('rg_lamp', [(15, -5), (15, 3), (23, -6), (21, -6), (32, -5)], walk=True); g.props('rg_bench', [(22, 2)], walk=True); g.props('rg_bench_stone', [(44, -4), (44, 0)], walk=True)
g.props('rg_lamp', [(43, -4)], walk=True)
for x in range(15, 30):                                                                           # the conservatory's hedged garden
    if abs(x - 22) > 1: g.prop(HEDGE, x, -8)
    g.prop(HEDGE, x, -18)
for y in range(-17, -8): g.prop('mHedgeTallGreen', 15, y); g.prop('mHedgeTallGreen', 29, y)
for k, (x, y) in enumerate(((17, -16), (17, -13), (17, -10), (27, -16), (27, -13), (27, -10), (19, -9), (25, -9))): g.prop(BEDS[k % 3], x, y, walk=True)
g.props('rg_young_green0', [(17, -15), (27, -15), (17, -11), (27, -11)]); g.props('rg_bench', [(18, -12), (26, -12)]); g.props('rg_lamp', [(20, -9), (24, -9)]); g.props('rg_round_pink0', [(19, -16), (25, -16)])
for y in (-14, -12): g.prop(BEDS[y % 3], 19, y, walk=True); g.prop(BEDS[(y + 1) % 3], 25, y, walk=True)
g.props('rg_pot_plant', [(21, -9), (23, -9), (20, -10), (24, -10)], walk=True)
for x0, x1 in ((33, 37), (39, 43)):
    g.field(x0, -17, x1, -15, 'rg_flower_pink' if x0 < 38 else 'rg_flower_yellow'); g.field(x0, -11, x1, -9, 'rg_flower_white' if x0 < 38 else 'rg_flower_pink')
g.lane([(38, -18), (38, -3)], 1, 'd'); g.lane([(32, -13), (42, -13)], 1, 'd'); g.rect(43, -14, 44, -12, 't')
g.props('rg_hut_round', [(38, -19)]); g.props('rg_barrel_water', [(33, -14), (36, -19), (40, -19)]); g.props('rg_bench_stone', [(44, -15)], walk=True); g.props('rg_lamp', [(43, -15)], walk=True)

# ================================================================ the east green with its pond, and the pocket square at the end of the south-east row
g.pond(39, 6, 4, 2.5)
g.props('rg_bench', [(39, 0), (39, 11)]); g.props('rg_lamp', [(33, 0), (45, 0), (33, 11), (45, 11)]); g.props('rg_round_pink0', [(35, 0), (43, 0), (35, 12), (44, 12)]); g.props('rg_tall_green0', [(32, 5), (46, 5)]); g.props('rg_bush_pink', [(32, 3), (32, 8), (46, 3), (46, 8)])
for k, x in enumerate((37, 38, 40, 41)): g.prop(BEDS[k % 3], x, 11, walk=True)
g.props('rg_bench', [(35, 12)], walk=True); g.props('rg_lamp', [(34, 14), (36, 12)], walk=True); g.props('rg_planter_pink', [(36, 14)], walk=True)
g.props('rg_bush_pink', [(37, 12), (37, 11), (41, 11)]); g.props('rg_bed_pink', [(38, 11)], walk=True)

# ================================================================ the barn at the head of the orchard lane
g.props('maHayBales', [(21, -39), (27, -39)]); g.props('maHayPile', [(21, -41)]); g.props('rg_barrel_water', [(27, -41)])

# ================================================================ kitchen gardens and allotments behind the rows
g.field(8, 15, 15, 17, 'leafPlantB'); g.field(18, 15, 23, 17, 'rg_sunflowers', every=2); g.field(27, 16, 31, 17, 'rg_pumpkin', every=2); g.trees(25, 15, 26, 18, FRUIT, dx=3, dy=3)
g.field(8, 28, 15, 29, 'rg_sunflowers', every=2); g.field(18, 28, 22, 30, 'leafPlantB'); g.field(26, 28, 38, 29, 'rg_pumpkin', every=2)
g.field(-20, 21, -13, 23, 'leafPlantB'); g.field(-10, 21, -3, 23, 'rg_sunflowers', every=2)
g.field(-20, 32, -12, 34, 'leafPlantB'); g.field(-8, 32, 0, 34, 'rg_pumpkin', every=2)
g.field(8, 40, 14, 42, 'leafPlantB'); g.field(17, 40, 21, 42, 'rg_pumpkin', every=2); g.field(24, 40, 33, 42, 'rg_sunflowers', every=2); g.field(36, 40, 39, 42, 'leafPlantB')
for x in (11, 19, 29, 37): g.props('rg_hut_round', [(x, 44)])
g.props('rg_scarecrow', [(16, 16), (-11, 22), (27, 20)])

# ================================================================ the beach: the fishermen's landing
SAND = [(-8, -50), (-4, -47), (0, -44), (4, -40), (8, -36), (10, -35), (20, -34), (24, -33), (26, -32), (28, -30), (30, -29), (32, -26), (36, -27), (38, -28), (40, -29)]
def sand_edge(y):
    e = None
    for yy, xx in SAND:
        if y >= yy: e = xx
    return e
def water(x, y): return (y >= 31 and x <= (-44 if y <= 33 else -42 if y <= 39 else -39 if y <= 42 else -37)) or (y >= 4 and x <= -50)
g.props('maRowboat', [(-42, 30), (-35, 43)]); g.props('boatWhite', [(-42, 36), (-38, 40)]); g.props('speedboat', [(-33, 44)])
g.props('rg_crates', [(-42, 17), (-38, 24), (-39, 31)]); g.props('rg_barrel', [(-41, 17), (-37, 24), (-38, 31)]); g.props('rg_logs', [(-39, 19), (-34, 30)])
g.rect(-35, 20, -31, 24, 't')
g.props('rg_stall', [(-34, 22), (-32, 22), (-33, 24)], walk=True); g.props('rg_table', [(-35, 24)], walk=True); g.props('rg_crates2', [(-31, 24)], walk=True); g.props('rg_barrel', [(-35, 21), (-31, 21)], walk=True)
g.props('rg_palm', [(-45, -2), (-42, 3), (-44, 8), (-45, 20), (-45, 23), (-37, 29)])
g.props('rg_boulder', [(-37, 41), (-38, 37), (-30, 29), (-35, 43), (-45, -6), (-43, 0)]); g.props('rg_rock', [(-28, 29), (-36, 38), (-37, 33), (-31, 36), (-33, 42)]); g.props('rg_logs', [(-39, 30), (-33, 39), (-44, 4)]); g.props('rg_barrel', [(-30, 41), (-33, 41)]); g.props('rg_crates', [(-29, 41)])
g.props('rg_wreck', [(-44, 33)]); g.props('rg_raft', [(-45, 24), (-42, 34)], walk=True)
rb = random.Random(31)
for y in range(-8, 46):
    for x in range(-46, sand_edge(y) + 1):
        if water(x, y) or water(x - 1, y) or (x, y) in g.occ or g.get(x, y) != '.': continue
        r = rb.random()
        if r < .11: g.prop(rb.choice(('rg_shells', 'rg_sea_stone', 'rg_sea_pebble', 'rg_shells')), x, y, walk=True)
        elif r < .135: g.prop(rb.choice(('rg_seaweed', 'rg_rock_small', 'rg_boulder')), x, y)
for y in range(-8, 46):                                                                           # nothing else is planted on the beach
    for x in range(-46, sand_edge(y) + 1):
        if (x, y) not in g.occ: g.occ[(x, y)] = 'beach'

for y in range(31, 47):                                                                           # the sea in the south-west corner, and the rise at the north-east edge, take no planting
    for x in range(-46, -35):
        if water(x, y) or water(x - 1, y) or water(x - 2, y): g.occ.setdefault((x, y), 'sea')
for y in range(-27, -21):
    for x in range(42, 47): g.occ.setdefault((x, y), 'rise')

for k, y in enumerate(range(-23, -8, 3)): g.prop(('rg_slim_green', 'rg_slim_teal')[k % 2], 2, y + 1); g.prop(('rg_slim_teal', 'rg_slim_green')[k % 2], 7, y + 1)
for k, y in enumerate(range(6, 25, 3)): g.prop(('rg_slim_green', 'rg_slim_teal')[k % 2], 1, y + 1); g.prop(('rg_slim_teal', 'rg_slim_green')[k % 2], 6, y + 1)

g.props('rg_round_green0', [(-6, 15)]); g.props('rg_young_green0', [(-28, 22)]); g.props('rg_young_teal0', [(-9, 13)]); g.props('rg_bush_pink', [(-4, 14), (-7, 17)]); g.props('rg_palm', [(-29, 31)]); g.props('rg_rock', [(-26, 33), (-31, 30)])
for fx, fy in ((-14, -5), (4, -1), (0, 16)):                                                      # no stray rock or tuft on a fountain's rim
    for yy in range(fy - 3, fy + 2):
        for xx in range(fx - 2, fx + 3): g.occ.setdefault((xx, yy), 'clear')
g.props('rg_bench', [(-2, -5), (11, -5), (11, 3), (-2, 3)], walk=True); g.props('rg_planter_tall_pink', [(-3, -4), (12, -4), (-3, 1), (12, 1)], walk=True)
g.props('rg_planter_tall_orange', [(10, -5), (10, 3), (-1, -5), (-1, 3)], walk=True); g.props('rg_lamp', [(13, -1), (-3, -1)], walk=True)
g.props('rg_bush_pink', [(13, 4), (-4, 4)]); g.props('rg_bush_green', [(14, -7), (-5, -7)])
# ================================================================ lamps, benches and signs along the lanes
g.props('rg_lamp', [(-40, -22), (-30, -22), (-20, -22), (-8, -18), (-30, -28), (-20, -28), (-8, -28), (-2, -28), (-12, -23)])
g.props('rg_lamp', [(12, -19), (20, -19), (28, -23), (36, -23), (8, 11), (16, 11), (24, 11), (30, 11), (-30, 21), (-22, 21), (-12, 21), (-4, 21), (-18, 31), (-8, 31), (-18, 42), (-8, 42)])
g.props('rg_bench', [(-4, -28), (-33, -28), (14, -23), (-16, 20), (-6, 29), (12, 26), (28, 26)]); g.props('rg_bench', [(42, -26)], walk=True); g.props('rg_lamp', [(43, -26), (41, -24)], walk=True)
g.props('rg_sign_board', [(8, -43), (8, 43), (44, 28), (-38, -43), (-12, -27), (43, 29)])

# ================================================================ woods, orchards and flowers to fill what is left
g.trees(-46, -46, 46, -43, WOOD)
g.trees(40, -46, 46, 46, WOOD)
g.trees(-46, -46, -44, 12, WOOD)
g.trees(-30, 44, 46, 46, WOOD)
g.trees(8, -45, 22, -28, FRUIT, dx=3, dy=3); g.trees(26, -45, 42, -28, FRUIT, dx=3, dy=3); g.trees(-40, -45, -8, -37, FRUIT, dx=3, dy=3)
g.dress()
MEAD = SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_pink', 'rg_tiny_white']
g.groves(-45, -45, 45, 45, WOOD, gap=1, min_area=5, styles=[('woods', WOOD), ('meadow', MEAD), ('woods', WOOD), ('orchard', FRUIT), ('meadow', MEAD)])
g.garden(-45, -45, 45, 45, every=2)
g.drift(-46, -46, 46, 45, SMALL, every=4)
g.done(dict(lim=48, hide_site_paths=True))
