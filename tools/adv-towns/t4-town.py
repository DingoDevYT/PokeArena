"""Tradeway, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t4-town.py
then python3 -I tools/adv-towns/preview.py T4 out.png to see it with the real art.

The story of the place: a trading town where every road in Kenora meets. The Timber Road from Pinegrove comes in over the south-west and bends into Tradeway, the
paved main street that runs east through the town to the Route 4 cave mouth under the basin's rim (the plateau closes the east side). The freight road crosses it
at the crossroads: north it runs up to the carters' yard where the Aldermere run loads, south it runs down the spoil road to the yard where Claystone's finds are
tipped. The Center stands at the west end of the crossroads square, the Market Hall at the east; east of the Hall the market spreads along both sides of the street
to the cave mouth, stalls and crates and barrels, and the first stalls still stand in the mouth. North of the street two rows of merchants' houses and the inns look
along their lanes; an orchard behind the market, with its barn at the end of the orchard cut, is where the growers' crates come in. South of the street the carters'
and drovers' cottages run along their lanes down to the spoil yard. Woods and the plateau wall the town in. The west cave mouth key is kept at (41, 1).
Exit: west (-48, 41), the Timber Road."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit, plan

g = kit.Town(48, 'T4')
FP4 = lambda ex: {'w': 4, 'd': 4, 'ex': ex}
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']

def hrow(door_y, street_y, x, kinds, gap=2, beds=True):
    """a row of lots from x (the left edge of the first sprite) eastward: each door walkway on door_y, its walk down to the lane at street_y; returns the right edge"""
    for k, n in enumerate(kinds):
        d = plan.PROPS[n]; ax, dx, sw = d['ax'] / 32, d['door'][0] / 32, d['sw'] / 32
        cx = int(round(x - .5 + dx + ax))
        g.lot(n, cx, door_y, street_y=street_y, beds=(BEDS[(cx + k) % 3], BEDS[(cx + k + 1) % 3]) if beds else None)
        x += math.ceil(sw) + gap
    return x

# ================================================================ roads
g.lane([(-48, 41), (-30, 41), (-30, 3)], 2, 'd')                                                 # the Timber Road, in from the south-west
g.lane([(-30, 1), (42, 1)], 2, 'p')                                                              # Tradeway, the main street, to the cave mouth
g.rect(-4, -2, 5, 5, 'p'); g.rect(-2, 0, 3, 3, 't')                                              # the crossroads square
g.lane([(0, -3), (0, -30)], 2, 'd'); g.lane([(0, 6), (0, 39)], 2, 'd')                           # the freight road north, the spoil road south
g.lane([(-41, -9), (-1, -9)], 1, 'd'); g.lane([(2, -14), (19, -14)], 1, 'd')                     # the two north lanes, one either side of the freight road
g.lane([(-41, -21), (-1, -21)], 1, 'd'); g.lane([(2, -26), (12, -26), (12, -29), (36, -29)], 1, 'd')
g.lane([(-29, 12), (-1, 12)], 1, 'd'); g.lane([(2, 19), (40, 19)], 1, 'd')                       # the south lanes
g.lane([(-29, 24), (-14, 24), (-14, 28), (-1, 28)], 1, 'd'); g.lane([(2, 30), (40, 30)], 1, 'd')
g.lane([(-28, 36), (-8, 36)], 1, 'd'); g.lane([(-42, 27), (-31, 27)], 1, 'd'); g.lane([(-42, 36), (-31, 36)], 1, 'd')   # the west lanes, below the depot
g.lane([(36, 0), (36, -30)], 1, 'd'); g.lane([(-41, -21), (-41, -3)], 1, 'd'); g.lane([(40, 13), (40, 30)], 1, 'd')                                                             # the orchard cut
g.rect(-7, -35, 6, -31, 't'); g.rect(-7, 34, 8, 40, 't')                                         # the carters' yard and the spoil yard
g.rect(15, 3, 40, 12, 't'); g.rect(16, -12, 34, 0, 't')                                          # the market ground, south of the street and north of it
g.rect(-45, -3, -31, 6, 't'); g.rect(-45, 8, -31, 18, 'd')                                                                     # the timber yard, where the Timber Road meets the street
g.exit(-48, 41, 'W')

# ================================================================ the seven buildings with rooms (ids and footprints as built)
g.building('pokeCenterGrand', -12, 1, ['t4-center', {'w': 5, 'd': 3, 'ex': 2}])
g.building('warehouse', 12, 1, ['t4-market', {'w': 6, 'd': 4, 'ex': 2}])
g.lot('chaletRedChimney', -18, -10, street_y=-9, role=['t4-h1', FP4(1)])
g.lot('tavern', -6, -10, street_y=-9, role=['t4-h2', FP4(1)])
g.lot('hall', 6, -15, street_y=-14, role=['t4-h3', FP4(1)])
g.lot('hotelBlue', 17, -15, street_y=-14, role=['t4-h4', FP4(1)])
g.lot('maHallGrey', 26, -12, beds=None)
for x, n in ((-27, 'mRoseStore'), (-22, 'maShopCyan'), (-7, 'mRoseApt')): g.lot(n, x, 1, beds=None)
g.lot('chaletRedBig', -14, 11, street_y=12, role=['t4-h5', FP4(1)])

# ================================================================ the cave mouth (drawn by the generator) and the people who stand in town: keep their tiles open
g.claim([(x, y) for y in range(-4, 2) for x in range(38, 45)], 'mouth')
for x, y in ((22, 1), (26, 1), (23, 6), (-10, 2), (3, 1), (-21, 2), (9, 2), (28, 1), (-15, 2), (15, 12), (-6, -9)):
    g.claim([(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1) if (x + i, y + j) not in g.occ], 'npc')

# ================================================================ houses: each row by the door tiles, clear of the freight road and the seven fixed lots
def row(door_y, street_y, items):
    for k, (n, x) in enumerate(items): g.lot(n, x, door_y, street_y=street_y, beds=(BEDS[(x + k) % 3], BEDS[(x + k + 1) % 3]))
row(-10, -9, [('rg_house_wood_b', -38), ('rg_house_red_d', -32), ('rg_house_wood_c', -25), ('rg_house_red_b', -12)])                                              # west north lane (with the Hall's neighbours h1 and the tavern)
row(-22, -21, [('rg_house_wood_a', -38), ('rg_house_red_b', -32), ('rg_house_red_a', -25), ('rg_house_wood_b', -18), ('rg_house_red_d', -12), ('maStoneHouse', -6)])
row(-15, -14, [('rg_house_wood_d', 11)])                                               # east north lane (with the Hall and the hotel)
row(-27, -26, [('rg_house_wood_a', 9)]); row(-30, -29, [('rg_house_red_a', 16), ('rg_house_wood_b', 23), ('rg_house_red_d', 29)])
row(11, 12, [('chaletRedB', -27), ('chaletRed', -22), ('chaletPink', -7)])                                      # west first south lane (with h5)
row(18, 19, [('rg_house_wood_b', 5), ('rg_house_red_d', 10), ('inn', 16), ('rg_house_wood_c', 22), ('rg_house_red_b', 28), ('rg_house_wood_a', 35)])
row(23, 24, [('rg_house_red_c', -26), ('rg_house_wood_d', -20)]); row(27, 28, [('chaletPink', -11), ('chaletRed', -7), ('cabinGreenWide', -3)])
row(29, 30, [('rg_house_red_a', 5), ('rg_house_wood_d', 12), ('rg_house_wood_a', 18), ('rg_house_red_c', 25), ('rg_house_wood_b', 31), ('rg_house_red_d', 37)])
row(35, 36, [('chaletRedB', -24), ('cabinGreenWide', -19), ('chaletPink', -14)])
g.lot('thatchBarn', 36, -30, beds=None)


# ================================================================ the crossroads square: fountain, monument, benches, lamps
g.prop('rg_fountain', -2, 4, walk=True); g.prop('rg_fountain_tower', 4, -1, walk=True)
g.props('rg_bench', [(-3, 0), (-3, 2), (5, 4), (1, 5)], walk=True); g.props('rg_lamp', [(-4, -2), (5, -2), (-4, 5), (5, 5), (-4, 1), (5, 2)], walk=True)
g.props('rg_planter_pink', [(-3, -2), (2, -2), (-1, 5), (3, 5)], walk=True); g.props('rg_planter_tall_orange', [(-4, 3), (5, 0)], walk=True)
g.props('rg_sign_board', [(2, -4), (-2, -4)]); g.props('rg_bush_green', [(-5, -3), (6, -3), (-5, 6), (6, 6)])
g.props('rg_lamp', [(-8, 0), (-16, 0), (-24, 0), (-28, 0), (8, 0), (-8, 3), (-16, 3), (-24, 3), (8, 3)])

for k, x in enumerate(range(-28, -6, 3)): g.prop('rg_planter_pink' if k % 2 else 'rg_planter_orange', x, 3); g.prop(('rg_young_green0', 'rg_young_teal0')[k % 2], x + 1, 6)
g.props('rg_bench', [(-26, 4), (-20, 4), (-14, 4), (-8, 4)]); g.props('rg_lamp', [(-26, 5), (-14, 5)])
for x in range(-27, -3): g.prop('mHedgeLongGreen', x, -8)
for k, x in enumerate(range(-28, -6, 2)): g.prop(BEDS[k % 3], x, -5, walk=True)
g.props('rg_round_pink0', [(-25, -6), (-17, -6), (-9, -6)]); g.props('rg_tall_green0', [(-29, -6), (-3, -6)]); g.props('rg_bench', [(-20, -6), (-13, -6)])

# ================================================================ the market: stalls north of the street and on the market ground south of it, the fair ground behind
for k, x in enumerate((18, 21, 24, 27, 30, 33)): g.prop('rg_stall_rug' if k % 2 else 'pxStallPink' if k % 3 == 0 else 'rg_stall', x, -1, walk=True)
for k, x in enumerate((18, 21, 24, 27, 30, 33)): g.prop('pxStallBlue' if k % 2 else 'rg_stall_rug', x, -8, walk=True)
for k, x in enumerate((17, 20, 26, 29, 32, 35, 38)): g.prop('pxStallBlue' if k % 2 else 'rg_stall', x, 5, walk=True)
for k, x in enumerate((17, 20, 23, 26, 29, 32, 35, 38)): g.prop('rg_stall_rug' if k % 2 else 'pxStallPink', x, 9, walk=True)
g.props('rg_crates', [(19, -3), (23, -3), (28, -3), (32, -3), (19, -10), (27, -10), (33, -10), (18, 7), (31, 7), (36, 7), (22, 11), (28, 11), (34, 11)], walk=True)
g.props('rg_barrel', [(20, -3), (25, -3), (30, -3), (34, -3), (21, -10), (30, -10), (17, -6), (21, 7), (33, 7), (39, 7), (19, 11), (31, 11), (37, 11)], walk=True)
g.props('rg_pumpkin', [(22, -3), (27, -3), (24, 7), (29, 7), (25, 11), (35, 11), (24, -10), (31, -6)], walk=True); g.props('rg_pot_plant', [(16, -3), (34, -3), (16, 7), (40, 7), (16, -10), (34, -10)], walk=True)
g.props('rg_crates2', [(24, -3), (36, 11), (28, -6)], walk=True); g.props('tentPair', [(38, 11), (16, 11), (22, -6), (33, -6)], walk=True); g.props('rg_table', [(30, 11), (27, 7), (26, -6)], walk=True)
g.props('rg_lamp', [(15, 4), (40, 4), (15, 11), (40, 11), (21, 8), (33, 8), (16, -4), (34, -4), (24, 4), (30, 4), (16, -12), (34, -12), (25, -5), (20, -5)], walk=True)
g.props('rg_bench', [(20, 3), (28, 3), (36, 3), (25, -4), (30, -5), (19, -5)], walk=True); g.props('fenceRail', [(23, -6), (29, -6)], walk=True)
g.props('torchPost', [(39, -1), (39, 4)], force=True); g.props('crystalBlue', [(38, -2), (34, -4)], force=True); g.props('rockGrey', [(37, -4), (37, -5)], force=True); g.props('boulderGrey', [(34, -6)])
g.props('rg_round_pink0', [(14, -6), (14, -9)]); g.props('rg_rock_grey', [(40, -8), (42, -10), (37, -5), (41, -12), (43, -11), (39, -10)], force=True); g.props('rg_boulder_grey', [(41, -8), (38, -7)], force=True); g.props('rg_tall_green0', [(38, -9), (40, -11)]); g.props('rg_young_green0', [(34, -7), (34, -10)])

# ================================================================ the timber yard at the Timber Road's corner, and the depot down the road
g.lot('maLogCabin', -38, -3, beds=None)
for k, x in enumerate((-43, -41, -39, -37, -35, -33)): g.prop('rg_woodpile', x, -1, walk=True); g.prop('rg_logs', x, 3, walk=True)
g.props('rg_crates', [(-44, 5), (-33, 5)], walk=True); g.props('rg_logs', [(-43, 1), (-39, 1), (-35, 1)], walk=True); g.props('rg_stall', [(-44, -3)], walk=True); g.props('rg_barrel_water', [(-35, 5), (-40, 5)], walk=True); g.props('rg_log', [(-36, 1), (-40, 1), (-34, 1)], walk=True)
g.props('rg_lamp', [(-45, -3), (-32, -3), (-45, 5), (-32, 5)], walk=True)
g.props('rg_crates', [(-41, 1), (-37, 1), (-33, 1)], walk=True); g.props('rg_barrel', [(-42, 1), (-36, 1), (-32, 5)], walk=True); g.props('rg_stall', [(-40, 5), (-36, 5)], walk=True); g.props('rg_crates2', [(-43, 5), (-34, 3)], walk=True); g.props('maHayBales', [(-33, -3)])
for y0 in (9, 11, 15, 17):
    for k, x in enumerate(list(range(-44, -39, 2)) + list(range(-36, -31, 2))):
        g.prop('rg_woodpile' if (k + y0) % 3 else 'rg_logs', x, y0, walk=True)
g.props('rg_mound', [(-43, 13), (-39, 13), (-35, 14)], walk=True); g.props('rg_boulder', [(-41, 14), (-37, 13), (-33, 14)], walk=True); g.props('bigRockGrey', [(-45, 14), (-38, 14)], walk=True)
g.props('rg_stall', [(-41, 13), (-33, 12)], walk=True); g.props('rg_crates', [(-45, 12), (-31, 12), (-31, 16), (-40, 10)], walk=True); g.props('rg_barrel_water', [(-33, 9), (-45, 9)], walk=True)
g.props('rg_hut_round', [(-45, 19)]); g.props('rg_crates2', [(-38, 10), (-38, 16)], walk=True); g.props('rg_log', [(-37, 12), (-42, 12), (-35, 12)], walk=True)
g.props('rg_lamp', [(-45, 8), (-31, 8), (-45, 18), (-31, 18)], walk=True)
for x in range(-46, -31): g.prop('mWoodFence', x, 7); g.prop('mWoodFence', x, 19)
for y in range(8, 19): g.prop('mWoodFence', -46, y)
# the cottages and gardens the old yard gave back
for k, (n, x) in enumerate((('rg_house_wood_b', -42), ('rg_house_red_d', -36))): g.lot(n, x, 26, street_y=27, beds=(BEDS[k % 3], BEDS[(k + 1) % 3]))
for k, (n, x) in enumerate((('chaletRedB', -43), ('cabinGreenWide', -39), ('chaletPink', -34))): g.lot(n, x, 35, street_y=36, beds=(BEDS[k % 3], BEDS[(k + 2) % 3]))
g.field(-44, 29, -38, 31, 'leafPlantB'); g.field(-36, 29, -33, 31, 'rg_sunflowers', every=2); g.props('rg_scarecrow', [(-40, 32)])
g.props('rg_round_pink0', [(-44, 21), (-40, 21), (-36, 21), (-32, 21), (-45, 24)]); g.props('rg_young_green0', [(-34, 23), (-38, 23)]); g.props('rg_bush_pink', [(-33, 25), (-44, 25)])
g.props('rg_lamp', [(-43, 26), (-32, 26), (-43, 35), (-32, 35)]); g.props('rg_bench', [(-43, 28), (-43, 37)])

# ================================================================ the carters' yard (freight north): rows of crates, hay and barrels under a stall roof, inside a rail
g.props('rg_crates', [(-6, -34), (-4, -34), (-2, -34), (3, -34), (5, -34), (-6, -32), (-3, -32), (4, -32), (6, -32)], walk=True)
g.props('rg_barrel', [(-5, -34), (-3, -34), (6, -34), (-5, -32), (5, -32), (-1, -32), (2, -32)], walk=True)
g.props('rg_stall', [(-3, -35), (4, -35)], walk=True); g.props('rg_woodpile', [(-6, -33), (6, -33), (-1, -34), (1, -34)], walk=True); g.props('rg_crates2', [(-4, -33), (5, -33)], walk=True)
g.props('maHayBales', [(-9, -34), (9, -34), (-9, -31)]); g.props('rg_barrel_water', [(5, -35), (-7, -32)], walk=True); g.props('rg_table', [(1, -32)], walk=True)
g.props('rg_lamp', [(-7, -31), (7, -31), (-7, -35), (7, -35)], walk=True)
for x in range(-8, 8, 2):
    if abs(x - 0.5) > 1.6: g.prop('fenceRail', x, -36)
# the spoil yard (south): heaps in two clusters, a loading rail, crates and carts' stalls in the middle, a plank fence
g.props('rg_mound', [(-5, 36), (-3, 36), (-4, 38)], walk=True); g.props('rg_boulder', [(-6, 37), (-2, 37), (-5, 39), (-3, 39)], walk=True); g.props('bigRockGrey', [(-4, 40)], walk=True)
g.props('rg_mound', [(5, 36), (7, 36), (6, 38)], walk=True); g.props('rg_boulder', [(4, 37), (7, 39), (5, 39)], walk=True); g.props('bigRockGrey', [(6, 40)], walk=True)
g.props('rg_stall', [(-1, 36), (3, 36)], walk=True); g.props('rg_crates', [(-1, 38), (1, 38), (3, 38), (-1, 40), (3, 40)], walk=True); g.props('rg_barrel', [(0, 38), (2, 38)], walk=True)
g.props('rg_woodpile', [(-7, 35), (8, 35)], walk=True); g.props('rg_table', [(1, 36)], walk=True)
g.props('rg_lamp', [(-7, 34), (8, 34), (-7, 40), (8, 40)], walk=True)
for x in range(-8, 10):
    if abs(x - 0.5) > 1.6: g.prop('mWoodFence', x, 41)
for y in range(35, 41): g.prop('mWoodFence', -8, y); g.prop('mWoodFence', 9, y)
g.props('rg_hut_round', [(-3, 31), (14, 34)])

# ================================================================ the horse pond and the orchards
g.pond(-38, -37, 5, 3)
g.props('rg_bench', [(-38, -31)]); g.props('rg_lamp', [(-33, -31), (-43, -31)]); g.props('rg_round_pink0', [(-31, -33), (-45, -33)]); g.props('rg_tall_green0', [(-31, -39), (-45, -39)])
g.trees(-46, -46, -8, -37, FRUIT, dx=3, dy=3); g.trees(8, -46, 34, -33, FRUIT, dx=3, dy=3); g.trees(38, -46, 46, -16, FRUIT, dx=3, dy=3)
g.props('maHayBales', [(33, -31), (39, -31)]); g.props('maHayPile', [(33, -33)]); g.props('rg_barrel_water', [(39, -33)])

# ================================================================ kitchen gardens, allotments and the lane ends
g.field(-26, 14, -19, 16, 'leafPlantB'); g.field(-12, 14, -4, 16, 'rg_sunflowers', every=2); g.field(5, 21, 12, 23, 'leafPlantB'); g.field(16, 21, 22, 23, 'rg_pumpkin', every=2); g.field(25, 21, 30, 23, 'leafPlantB')
g.field(-10, 30, -5, 32, 'leafPlantB'); g.field(5, 32, 12, 34, 'rg_sunflowers', every=2); g.field(16, 32, 29, 34, 'leafPlantB')
g.props('rg_scarecrow', [(14, 21), (-16, 16), (-8, 31)]); g.props('rg_round_green0', [(-14, 17), (-17, 17), (-13, 20), (-10, 18)]); g.props('rg_bush_pink', [(-12, 16), (-15, 15)])
for x, y in ((19, -14),):                                                                         # the lane ends in a small sitting place
    g.rect(x + 1, y - 1, x + 3, y + 1, 't'); g.props('rg_bench', [(x + 2, y)], walk=True); g.props('rg_lamp', [(x + 3, y - 1)], walk=True); g.props('rg_planter_pink', [(x + 1, y + 1)], walk=True)
for x, y in ((-41, -9), (-41, -21), (40, 19), (40, 30)): g.props('rg_lamp', [(x + (1 if x < 0 else -1), y - 1)])

# ================================================================ the plateau on the east side and the woods round the town
PLAT = {-14: 49, -13: 46, -12: 45, -11: 44, -10: 44, -9: 44, 3: 44, 4: 44, 5: 44, 6: 44, 7: 44, 8: 44, 9: 44, 10: 45, 11: 45, 12: 47, 13: 49, 14: 50}
for y in range(-8, 3): PLAT[y] = 43
for y, x0 in PLAT.items():
    for x in range(x0 - 1, 49): g.occ.setdefault((x, y), 'rise')
g.trees(-48, -48, 46, -44, WOOD); g.trees(-48, 44, 46, 48, WOOD); g.trees(-48, -48, -46, 38, WOOD); g.trees(41, -48, 47, 48, WOOD)
g.dress()
MEAD = SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_pink', 'rg_tiny_white']
g.groves(-47, -47, 47, 47, WOOD, gap=1, min_area=8, styles=[('woods', WOOD)])
g.garden(-47, -47, 47, 47, every=3)
g.drift(-48, -48, 48, 48, SMALL, every=6)
g.done(dict(lim=50, hide_site_paths=True, mouth=[41, 1]))
