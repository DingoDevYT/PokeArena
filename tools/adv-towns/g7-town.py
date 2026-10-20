"""Goldacre, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g7-town.py
then python3 -I tools/adv-towns/preview.py G7 out.png to see it with the real art.

The story of the place: a farming village that grew where the river mills' cart track (Route 8, north) meets the market road to Tradeway (Route 5, east)
and the old drove road south (Route 7). The green with its fountain is the crossroads; the Center and the co-op store were built facing it, and the
Saturday market sets up on its south side. The oldest cottages crowd the rows off Mill Lane, which wanders north past them to the river mill; each row
backs onto the next across kitchen gardens. The orchard and Whitney's farm lie along the market road, where the dairy hall (the gym) and the newer, bigger
houses stand. South of the green the drove road passes the tavern and runs down between worked fields to the windmill track; a lane goes west to the duck
pond. Woods wall the village in except where the roads leave. Exits: north (-10, -44) Route 8, east (44, -36) Route 5, south (0, 44) Route 7."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(44, 'G7')
FP4 = lambda ex: {'w': 4, 'd': 4, 'ex': ex}
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']

# ================================================================ roads: 2 wide dirt; footpaths 1 wide
g.lane([(-11, -3), (13, -3), (13, 9), (-11, 9), (-11, -3)], 2, 'd')                                # the lane round the green
g.rect(-9, -1, 11, 8, 'g')
g.lane([(-10, -3), (-10, -12), (-14, -12), (-14, -26), (-10, -26), (-10, -44)], 2, 'd')            # Mill Lane
g.lane([(14, 3), (32, 3), (32, -36), (44, -36)], 2, 'd')                                          # the market road
g.lane([(-8, 11), (-8, 22), (-3, 22), (-3, 33), (0, 33), (0, 44)], 2, 'd')                         # the drove road (leaves where Route 7's lab-drawn road comes in)
g.lane([(-12, 4), (-29, 4)], 2, 'd')                                                                # Pond Lane
g.lane([(-11, -8), (-36, -8)], 1, 'd'); g.lane([(-15, -20), (-32, -20)], 1, 'd')                   # Weavers Row, Chapel Row
g.lane([(-11, -33), (-27, -33), (-27, -40)], 1, 'd')                                                # the track to the mill
g.lane([(31, -20), (4, -20), (4, -10)], 1, 'd')                                                     # Dairy Row, round behind the store
g.lane([(-7, 16), (36, 16), (36, 32)], 1, 'd')                                                      # the windmill track
g.lane([(-4, 28), (-36, 28)], 1, 'd')                                                              # the allotment track
g.exit(-10, -44, 'N'); g.exit(44, -36, 'E'); g.exit(0, 44, 'S')

# ================================================================ the green and the market
g.prop('rg_fountain', 1, 4)
for x, y in ((-4, 2), (6, 2), (-4, 6), (6, 6)): g.prop(BEDS[(x + y) % 3], x, y, walk=True)
for x, y in ((-7, 3), (-7, 5), (9, 3), (9, 5)): g.prop('rg_planter_tall_pink' if x < 0 else 'rg_planter_tall_orange', x, y)
g.props('rg_bench', [(1, 0), (1, 8), (-3, 4)]); g.props('rg_bench_stone', [(5, 4)])
g.props('rg_lamp', [(-9, -1), (11, -1), (-9, 8), (11, 8)])
g.props('rg_young_green0', [(-6, 0), (8, 0)]); g.props('rg_young_teal0', [(-6, 8), (8, 8)])
for k, x in enumerate((-5, -1, 3, 7, 11)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, 15)      # the Saturday market faces the windmill track
g.props('rg_crates', [(-9, 12), (12, 12)]); g.props('rg_crates2', [(-8, 14)]); g.props('rg_barrel', [(11, 14), (13, 13)]); g.props('rg_pumpkin', [(0, 14), (4, 14), (8, 14)])
g.props('rg_pumpkin_face', [(-4, 14)]); g.props('rg_table', [(14, 12)]); g.props('rg_woodpile', [(-11, 13)])

# ================================================================ the Center and the co-op store
g.building('pokeCenterGrand', -4, -5, ['g7-center', {'w': 5, 'd': 3, 'ex': 2}]); g.rect(-4, -6, -4, -4, 'd')
g.building('warehouse', 7, -5, ['g7-mart', {'w': 6, 'd': 3, 'ex': 2}]); g.rect(7, -6, 7, -4, 'd')
g.props('rg_planter_pink', [(-8, -5), (0, -5)]); g.props('rg_planter_orange', [(2, -5), (11, -5)]); g.prop('rg_sign_board', 1, -7); g.props('rg_lamp_mid', [(1, -5)])
g.props('rg_bush_green', [(-7, -11), (-5, -11), (-3, -11), (-1, -11)]); g.props('rg_crates', [(10, -10)]); g.props('rg_barrel', [(12, -10), (12, -8)])

# ================================================================ Mill Lane: the old cottage rows
# Weavers Row (y -8): cottages on its north side, kitchen gardens behind; Pond Lane cottages to the south
for x, n, role in ((-18, 'rg_house_wood_b', ['g7-h4', FP4(1)]), (-24, 'rg_house_red_d', 'house'), (-30, 'rg_house_wood_c', 'house'), (-36, 'rg_house_red_b', 'house')):
    g.lot(n, x, -9, street_y=-8, role=role, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
for x, n in ((-17, 'rg_house_red_c'), (-23, 'rg_house_wood_d')):
    g.lot(n, x, 3, street_y=3, beds=(BEDS[x % 3], BEDS[(x + 2) % 3]))
# Chapel Row (y -20): cottages north, the backs of Weavers Row's kitchen gardens south
for x, n, role in ((-19, 'rg_house_red_c', ['g7-h5', FP4(1)]), (-25, 'rg_house_wood_a', 'house'), (-32, 'rg_house_red_d', 'house')):
    g.lot(n, x, -21, street_y=-20, role=role, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
for x0 in (-36, -30, -24, -19): g.field(x0, -18, x0 + 3, -16, 'leafPlantB')                     # kitchen gardens between the rows
g.props('rg_hut_round', [(-38, -16)]); g.props('rg_woodpile', [(-15, -16), (-27, -15)]); g.props('rg_barrel_water', [(-21, -15)])
# east of Mill Lane: the old houses facing the lane
g.lot('rg_house_wood_a', -4, -15, street_x=-12, role=['g7-h1', FP4(1)])
g.lot('rg_house_wood_c', -4, -27, street_x=-9, role=['g7-h2', FP4(2)])
g.lot('rg_house_red_a', -4, -38, street_x=-9)
g.field(-2, -24, 2, -22, 'leafPlantB'); g.props('rg_woodpile', [(0, -14)]); g.props('rg_hut_round', [(1, -34)])
# the mill on the river, its yard
g.building('maLogCabin', -27, -40); g.props('rg_woodpile', [(-23, -41), (-31, -40)]); g.props('rg_logs', [(-30, -38), (-24, -38)]); g.props('rg_crates', [(-22, -39)])
g.lot('rg_house_wood_d', -19, -34, street_y=-33)

# ================================================================ the orchard and Whitney's farm along the market road
for k, y in enumerate(range(-40, -27, 3)):
    for x in range(6 + (k % 2), 23, 3): g.prop(FRUIT[(x + y) % len(FRUIT)], x, y)
g.lot('rg_house_red_a', 16, -21, street_y=-20, role=['g7-whitney', FP4(1)])
g.lot('barnRed', 9, -21, street_y=-20, beds=None); g.props('maHayBales', [(6, -22), (12, -24)]); g.props('maHayPile', [(3, -27)]); g.props('rg_barrel_water', [(21, -21)])
g.building('hallGym', 24, -1, ['g7-gym', {'w': 9, 'd': 5, 'ex': 4}]); g.rect(24, -2, 24, 2, 'd'); g.props('rg_lamp', [(20, 1), (28, 1)])
g.props('rg_planter_pink', [(21, -1), (27, -1)])
# the pasture between Dairy Row and the market road: the herd's shelter, troughs, hay
g.lot('thatchBarn', 22, -10, street_x=4, beds=None); g.props('rg_barrel_water', [(17, -11), (27, -9)]); g.props('maHayBales', [(12, -14), (28, -15)]); g.props('maHayPile', [(15, -8)])
# the newer houses along the market road
for y, n, role in ((-13, 'rg_house_wood_b', 'house'), (-21, 'rg_house_wood_a', ['g7-h3', FP4(1)]), (-29, 'rg_house_red_b', 'house')):
    g.lot(n, 39, y, street_x=34, role=role, beds=(BEDS[y % 3], BEDS[(y + 1) % 3]))
g.lot('rg_greenhouse', 39, -4, street_x=34, beds=None)
g.lot('rg_house_wood_d', 26, -30, street_x=31)
g.props('rg_sunflowers', [(37, -7), (35, -7)])

# ================================================================ south of the green: the tavern, the drove road cottages, fields, the windmill
g.lot('tavern', -14, 15, street_x=-9, role=['g7-h7', FP4(1)], beds=None, extras=[('rg_barrel', 3, -1), ('rg_crates', -3, -1), ('rg_table', 3, 2)])
g.lot('rg_house_wood_c', 2, 21, street_x=-2, role=['g7-h6', FP4(1)])
g.lot('rg_house_red_d', -15, 27, street_y=28)
g.lot('rg_house_wood_d', 4, 32, street_x=-2)
g.lot('rg_house_red_b', 22, 15, street_y=16)
g.lot('rg_house_wood_b', 30, 15, street_y=16)
g.field(4, 36, 15, 41, 'leafPlantB'); g.field(8, 18, 18, 26, 'rg_sunflowers', every=2)
g.field(20, 19, 33, 26, 'leafPlantB'); g.field(12, 29, 33, 33, 'rg_pumpkin', every=2)
g.prop('maWindmill', 38, 33); g.props('maHayBales', [(35, 30), (40, 30)]); g.prop('rg_scarecrow', 26, 22); g.prop('rg_scarecrow', 9, 38)
# the allotments west of the drove road
for x0 in (-36, -30, -24, -18):
    g.field(x0, 30, x0 + 4, 33, 'leafPlantB'); g.prop('rg_hut_round', x0 + 2, 36)
g.field(-38, 18, -26, 25, 'rg_sunflowers', every=2)

# ================================================================ the duck pond
g.pond(-34, 5, 4, 3)
g.props('rg_bench', [(-29, 9), (-38, 9)]); g.props('rg_bush_green', [(-28, 0), (-40, 1)])

# ================================================================ woods walling the village in; flowers in the grass
g.trees(-44, -44, 44, -42, WOOD)
g.trees(-44, 41, 44, 44, WOOD)
g.trees(40, -44, 44, 44, WOOD)
g.trees(-44, -26, -40, 44, WOOD)
g.trees(-12, -44, 4, -40, WOOD); g.trees(-44, -12, -40, 0, WOOD)
g.dress()
MEAD = SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_pink', 'rg_tiny_white']
g.groves(-43, -43, 43, 43, WOOD, gap=1, min_area=8, styles=[('woods', WOOD), ('meadow', MEAD), ('woods', WOOD), ('orchard', FRUIT), ('meadow', MEAD)])
g.garden(-43, -43, 43, 43, every=3)
g.drift(-44, -44, 44, 44, SMALL, every=6)
g.done(dict(lim=46))
