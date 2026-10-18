"""Sprucevale, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g2-town.py
then python3 -I tools/adv-towns/preview.py G2 out.png to see it with the real art.

The story of the place: a timber town in a snowbound valley ringed by low hills and spruce forest. It grew round the sawmill on the valley floor: the log road comes down
from the northern forest (Route, north) to the mill yard, the finished timber goes out by the south road, the west road brings the town street in. The town street ends in
Mill Square, a market with a well and timber stalls, the Center and the Mart on its north side; east of it the packed mill yard holds the sawmill, the log decks
and the gym (the old mill hall). Log cabins and chalets for the mill crews stand in rows along footpaths off the street, kitchen yards and woodpiles behind them, and
timber is stacked everywhere. A frozen mill pond lies south-east, a spruce nursery north-east, a frozen lake north-west, the forest presses in all round.
Exits: north (15, -48), south (14, 48), west (-48, 0)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit, snowkit as sk
from snowkit import *

g = sk.SnowTown(48, 'G2')
g.rect(-48, -48, 48, 48, 'Z')                                                                    # the valley floor under snow

# ================================================================ roads: 2 wide trodden dirt; footpaths 1 wide
g.lane([(-48, 0), (-18, 0)], 2, 'd')                                                             # the west road, the town street
g.lane([(15, -48), (15, -5)], 2, 'd')                                                            # the log road down from the forest
g.lane([(14, 11), (14, 48)], 2, 'd')                                                             # the timber road south
g.rect(-16, 0, 0, 11, 'p')                                                                       # Mill Square
for x, y in ((-16, 11), (-15, 11), (-16, 10), (0, 11), (-1, 11), (0, 10)): g.put(x, y, 'Z')       # rounded foot of the square
g.rect(1, 4, 8, 5, 'd')                                                                          # the street on to the yard
g.rect(8, -4, 27, 10, 'd')                                                                       # the mill yard, packed flat
g.rect(3, -42, 5, -40, 'd')                                                                      # the loggers' camp ground
g.lane([(4, -35), (4, -40)], 1, 'd')
g.exit(15, -48, 'N'); g.exit(14, 48, 'S'); g.exit(-48, 0, 'W')

# ================================================================ the west lanes: each a different shape, none ribbing off a common spine
# Church Lane: north up from the town street, bends west at the top; south down, bends west at the foot (the chapel); two bends, one long straight between
# the green loop south-west of the street; the pond lane wraps the pond; Mill Lane and the north lanes grow off the log road
CHURCH_N, CHURCH_S = -20, 28
g.building('pokeCenterWhite', -12, -1, 'center'); g.rect(-12, -2, -12, 0, 'd')
g.building('martWhite', -5, -1); g.rect(-5, -2, -5, 0, 'd')
g.lot('gymTealTall', 26, -5, street_y=-4, beds=None)
g.lot('sSilverWarehouse', 20, -5, street_y=-4, beds=None)
g.lot('tavern', -29, -1, street_y=0, beds=None); g.lot('inn', -38, -1, street_y=0, beds=None); g.lot('cabinGreenWide', -20, -1, street_y=0)
g.lot('sWoodPagoda', -31, 27, street_y=28, beds=None); g.lot('warehouse', 20, 28, street_y=29, beds=None); g.lot('rg_greenhouse', 36, 3, street_y=4, beds=None)
g.lot('rg_greenhouse', -42, 7, street_y=8, beds=None); g.lot('hall', -8, 28, street_y=29, beds=None)

BIG = ['rg_house_wood_a', 'rg_house_wood_b', 'rg_house_wood_c', 'rg_house_red_a', 'rg_house_red_b', 'rg_house_red_c', 'maLogCabin', 'jLodge', 'chaletRedBig', 'chaletRedChimney', 'rg_house_wood_d', 'rg_house_red_d']
SML = ['jCabinA', 'jCabinB', 'jCabinC', 'jCabinD', 'cabinGreen', 'cabinGreenWide', 'cottageGreen', 'cottageRed', 'chaletRed', 'chaletRedB', 'chaletPink', 'cottageGreenWide', 'cottageTeal']
MIX = BIG * 3 + SML * 2
G = dict(gap=(2, 3))
row(g, -1, 0, -46, -19, MIX, seed=1, skip=[(-41, -35), (-32, -26), (-23, -17)], **G)               # on the town street

# Church Lane
d_top = row(g, -21, -20, -36, -27, MIX, seed=21, **G)                                              # its north foot, facing it
d_bot = row(g, 27, 28, -38, -27, MIX, seed=22, skip=[(-34, -28)], **G)
g.lane([(min(d_top + [-24]), -20), (-24, -20), (-24, 28), (min(d_bot + [-31]), 28)], 1, 'd')
col(g, -24, -18, -9, -1, MIX, seed=23, **G); col(g, -24, -18, -7, 1, MIX, seed=24, **G)             # houses down both sides of its north run, doors turned to it
col(g, -24, 4, 20, -1, MIX, seed=25, **G)                                                           # and down its west side to the south
g.lane([(-31, 28), (-31, 30)], 1, 'd')                                                               # to the graveyard gate

pen(g, -37, -7, -27, -3, 'wLogFence', gate=('E', -5)); stacks(g, -36, -6, -28, -4, every=2, seed=8); g.lane([(-27, -5), (-24, -5)], 1, 'd')   # the town woodyard off Church Lane
# the north-west lane: a short run up from the town street and east, round a bend
d_nw = row(g, -15, -14, -42, -33, MIX, seed=26, **G)
g.lane([(-44, -1), (-44, -14), (max(d_nw + [-44]), -14)], 1, 'd')

# the green loop: a small green with a well, a few houses on its north side, and a short link to the street
g.lane([(-37, 2), (-37, 8)], 1, 'd'); g.lane([(-45, 8), (-33, 8), (-33, 18), (-45, 18), (-45, 8)], 1, 'd')
g.props('jWell', [(-39, 13)], walk=True); g.props('rg_bench', [(-42, 11), (-36, 11), (-42, 16), (-36, 16)], walk=True); g.props('rg_lamp', [(-44, 10), (-34, 10), (-44, 17), (-34, 17)], walk=True)
g.props('rg_planter_snow', [(-41, 13), (-37, 13)], walk=True); g.props('rg_young_green_snow0', [(-43, 13), (-35, 13)], walk=True); g.props('rg_snowpile', [(-39, 16), (-40, 10)], walk=True)
row(g, 7, 8, -40, -34, MIX, seed=27, skip=[(-38, -36)], **G)

# the pond lane: down the west of the pond, bends east under it to the timber road
d_pond = row(g, 28, 29, -14, 12, MIX, seed=28, skip=[(-12, -3)], **G)
g.lane([(-17, 6), (-17, 29), (13, 29)], 1, 'd')
col(g, -17, 8, 24, -1, MIX, seed=29, **G)

# Mill Lane east-west off the log road, ending at its last house; a second lane bends north round the camp's neighbour; the long north lane
d_ml = row(g, -12, -11, -14, 12, MIX, seed=30, **G); g.lane([(14, -11), (min(d_ml + [14]), -11)], 1, 'd')
d_t6 = row(g, -25, -24, -4, 12, MIX, seed=31, **G); g.lane([(14, -24), (-8, -24), (-8, -34)], 1, 'd')
col(g, -8, -33, -26, -1, MIX, seed=32, **G)
d_lc = row(g, -36, -35, -38, -10, MIX, seed=34, **G); row(g, -36, -35, 12, 13, MIX, seed=35, **G)
g.lane([(14, -35), (min(d_lc + [-8]), -35)], 1, 'd')
for x, y0, y1 in ((-24, -20, 28),): pass

# ---- east of the log road (rows trimmed to their last walk)
lane_row(g, -13, 17, 44, MIX, False, seed=9, **G)
lane_row(g, -26, 17, 44, MIX, False, seed=7, skip=[(29, 31)], **G); g.lane([(30, -26), (30, -35)], 1, 'd')
lane_row(g, 4, 28, 44, MIX, False, seed=8, skip=[(33, 39)], extra_end=36, **G)
lane_row(g, 19, 16, 44, MIX, False, seed=10, extra_end=30, **G); g.lane([(30, 19), (30, 21)], 1, 'd')
lane_row(g, 29, 16, 44, MIX, False, seed=12, skip=[(17, 24)], extra_end=20, **G)
g.lane([(2, -24), (2, -21)], 1, 'd')                                                                # to the woodyard gate
lamps(g, [(-24, -20), (-24, 28)], seed=3)

# ================================================================ Mill Square
g.prop('rg_fountain_dry', -8, 6, walk=True); g.prop('jWell', -14, 6, walk=True); g.props('rg_young_teal_snow0', [(-1, 6)], walk=True); g.props('rg_young_green_snow0', [(-15, 3)], walk=True)
for k, x in enumerate((-14, -10, -4, 0)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, 10, walk=True)
g.props('rg_lamp', [(-15, 2), (-1, 2), (-15, 8), (-1, 8), (-8, 2)], walk=True)
g.props('rg_bench', [(-12, 4), (-4, 4), (-11, 8), (-5, 8)], walk=True)
g.props('rg_planter_snow', [(-14, 0), (-10, 0), (-7, 0), (-3, 0)], walk=True)
g.props('rg_crates', [(-16, 9), (1, 9)], walk=True); g.props('rg_barrel', [(-12, 10), (-2, 10)], walk=True); g.props('rg_woodpile', [(-15, 5), (-1, 5)], walk=True)
g.props('rg_snowpile', [(-6, 2), (-14, 2)], walk=True); g.props('rg_planter_tall_blue', [(-10, 4), (-6, 4), (-10, 8), (-6, 9)], walk=True); g.props('rg_pot_snow', [(-13, 7), (-2, 4)], walk=True); g.prop('noticeBoard', -9, 2, walk=True)

# ================================================================ the mill yard: log decks, the dozer, trucks, stacks
for y in (-2, 0, 2):
    for x in range(10, 27): g.prop('fallenLog' if (x + y) % 3 else 'logShort', x, y, walk=True)
stacks(g, 9, 3, 12, 9, every=2, seed=2); stacks(g, 20, 3, 26, 9, every=2, seed=3)
g.prop('bulldozer', 15, 7, walk=True); g.prop('vanGrey', 18, 9, walk=True); g.prop('truckPink', 11, 10, walk=True); g.prop('vanGrey', 17, 5, walk=True); g.prop('rg_crates2', 19, 6, walk=True); g.props('rg_barrel_water', [(13, 4), (19, 9)], walk=True); g.props('rg_snowpile', [(21, 10), (13, 9), (16, 3)], walk=True)
g.props('rg_crates', [(26, 9), (9, 2)], walk=True); g.props('rg_barrel', [(27, 8), (17, 3)], walk=True); g.prop('waterTank', 27, 5, walk=True)
g.props('torchPost', [(8, -3), (27, -3), (8, 9), (27, 10)], walk=True)
g.props('rg_planter_snow', [(18, -4), (22, -4), (24, -4), (28, -4)], walk=True); g.props('rg_lamp', [(23, -4), (29, -4)], walk=True)
g.props('rg_sign_board', [(-45, 3), (17, -46), (12, 45)]); g.props('wSignBoard', [(-45, -1), (14, -46)])

# ================================================================ yards, the nursery, the camp, the graveyard
pen(g, -6, -21, 10, -17, 'wLogFence', gate=('N', 2)); stacks(g, -5, -20, 9, -18, every=2, seed=4)               # the woodyard between the lanes
pen(g, 28, 21, 42, 24, 'wLogFence', gate=('N', 30)); stacks(g, 29, 22, 41, 23, every=2, seed=5)
pen(g, 18, -44, 41, -35, 'mPicketFence', gate=('S', 30)); g.trees(19, -43, 40, -36, YOUNG, dx=2, dy=3); g.prop('rg_hut_round', 22, -37, walk=True)        # the spruce nursery
g.props('tipi', [(-1, -43), (8, -43), (-5, -41)]); g.props('tentPair', [(0, -39), (8, -39), (-3, -38)], walk=True); g.props('rg_hut_round', [(10, -41)], walk=True)
g.props('rg_logs', [(2, -38), (6, -38), (-1, -40)], walk=True); g.props('rg_crates', [(1, -37), (7, -37), (9, -45)], walk=True); g.props('rg_barrel', [(-2, -40), (10, -38)], walk=True)
g.props('frozenLog', [(3, -45), (5, -45), (-4, -44)], walk=True); g.props('torchPost', [(2, -41), (6, -41)], walk=True); g.props('rg_bench', [(4, -38)], walk=True); g.props('rg_snowpile', [(10, -44), (-6, -44)], walk=True)
pen(g, -42, 30, -27, 36, 'mPicketFence', gate=('N', -31)); g.props('rg_post_stone', [(x, y) for x in range(-41, -28, 2) for y in (32, 35)], walk=True)   # the graveyard behind the chapel
g.props('rg_cairn', [(-35, 33), (-33, 34)], walk=True)

# ================================================================ ponds
g.pond(36, 38, 5, 2); g.pond(-9, 17, 4, 2)
g.props('rg_bench', [(30, 34), (41, 34)], walk=True); g.props('rg_lamp', [(35, 33), (28, 36)], walk=True)
for (x, y) in ((28, 38), (44, 37), (36, 33), (36, 43)): g.prop('frozenLog', x, y, walk=True)

pond_ring(g, 36, 38, 5, 2, WOOD); pond_ring(g, -9, 17, 4, 2, WOOD)
g.dress(trees=PINE, bushes=BUSH, pots=POTS); finish(g)
g.trees(-48, -48, 48, -41, WOOD); g.trees(-48, 42, 48, 48, WOOD); g.trees(-48, -48, -45, 48, WOOD); g.trees(45, -48, 48, 48, WOOD)
g.groves(-47, -47, 47, 47, WOOD, gap=1, min_area=6, styles=[('woods', WOOD), ('woods', PINE), ('woods', TALL + ROUND), ('woods', WOOD), ('woods', PINE + YOUNG)])
g.garden(-47, -47, 47, 47, every=2)
g.drift(-48, -48, 48, 48, LUMPS, every=6); g.drift(-48, -48, 48, 48, ROCKS, every=45, seed=4); g.drift(-48, -48, 48, 48, ['rg_stump_green_snow', 'rg_stump_teal_snow', 'rg_stump2_green_snow', 'frozenLog', 'fallenLog'], every=60, seed=6)
g.done(dict(lim=50, hide_site_paths=True))
