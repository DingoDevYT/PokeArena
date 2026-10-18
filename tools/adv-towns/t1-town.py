"""Frostfall, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t1-town.py
then python3 -I tools/adv-towns/preview.py T1 out.png to see it with the real art.

The story of the place: a mountain village on the high plateau under the peaks, snowed in half the year. It grew from the miners' camp at the old mine in the east cliff.
The pass road (Route 17) runs along the north rim, west to east; the village street drops from it into the village and ends in the small square, where the lodge (the
Center) and the store stand and the well and the notice board are. Chalets with steep roofs huddle round the square and along trodden lanes, firewood stacked against
every wall; west of the square lies the Flight Hub with its landing pad; the mine road runs east from the square to the mine yard under the cliff, with the mine office,
ore stacks and the cave mouth. The plateau's rim falls away to the south: there the frozen tarn, the old chapel and a lookout. Wind turbines turn on the open snow,
snow pines shelter the north side. Exits: west (-40, -36) and east (40, -36), the pass road."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit, snowkit as sk
from snowkit import *

g = sk.SnowTown(40, 'T1')
g.rect(-40, -40, 40, 40, 'Z')                                                                    # the plateau under snow

# ================================================================ roads
g.lane([(-40, -36), (40, -36)], 2, 'd')                                                          # the pass road along the north rim
g.lane([(0, -34), (0, -7)], 2, 'd')                                          # the village street dropping from the rim
g.rect(-11, -6, 10, 2, 'p')                                                                      # the square
for x, y in ((-11, -6), (-10, -6), (-11, -5), (10, -6), (9, -6), (10, -5), (10, 2), (9, 2), (10, 1)): g.put(x, y, 'Z')
g.rect(-20, -4, -12, 3, 'p')                                                                     # the Flight Hub landing pad
g.lane([(10, -1), (20, -1), (20, 7)], 2, 'd')                                                    # the mine road
g.rect(20, 6, 38, 16, 'd')                                                                       # the mine yard
g.lane([(-36, -27), (-36, -14)], 1, 'd'); g.lane([(36, -24), (36, -13)], 1, 'd'); g.lane([(-36, 14), (-36, 26)], 1, 'd')   # the hooks joining the lanes' far ends
g.lane([(-6, 3), (-6, 8)], 1, 'd'); g.lane([(-14, 8), (-14, 26)], 1, 'd'); g.lane([(4, 3), (4, 34)], 1, 'd')
g.lane([(-21, -1), (-24, -1)], 1, 'd'); g.lane([(-24, -14), (-24, 14), (-36, 14)], 1, 'd')
g.lane([(5, 26), (30, 26), (30, 31)], 1, 'd')
g.rect(25, 32, 30, 37, 'p')                                                                      # the lookout over the rim
g.exit(-40, -36, 'W'); g.exit(40, -36, 'E')

# ================================================================ the lodge (Center) and the store on the square
g.building('pokeCenterWhite', -5, -7, 'center'); g.rect(-5, -8, -5, -6, 'd')
g.building('martWhite', 6, -7); g.rect(6, -8, 6, -6, 'd')
g.lot('maLogCabin', 30, 5, street_y=6, beds=None)                                                # the mine office
g.lot('sWoodPagoda', 14, 33, street_y=34, beds=None)                                             # the old chapel
g.lot('rg_hut_round', -1, 33, street_y=34, beds=None)                                              # the ice-fishers' hut by the tarn

# ================================================================ houses
CH = ['chaletRed', 'chaletRedB', 'chaletPink', 'cabinGreen', 'cabinGreenWide', 'cottageGreenWide', 'cottageGreen', 'cottageRed', 'jCabinA', 'jCabinB', 'jCabinC', 'jCabinD', 'chaletRedBig', 'chaletRedChimney']
BIGH = ['rg_house_wood_b', 'rg_house_wood_c', 'rg_house_wood_d', 'rg_house_red_d', 'maLogCabin', 'jLodge']
MIX = CH * 2 + BIGH
H = dict(gap=(1, 2))
lane_row(g, -27, -1, -36, MIX, True, seed=1, **H); lane_row(g, -14, -1, -36, MIX, True, seed=3, **H)               # straight lanes from the village street to the west hooks
lane_row(g, -24, 2, 36, MIX, True, seed=2, skip=[(2, 7)], **H); lane_row(g, -13, 2, 36, MIX, True, seed=4, **H)
lane_row(g, 8, -13, 19, MIX, True, seed=5, skip=[(-8, -4), (2, 6)], **H)                                           # under the square
lane_row(g, 26, 4, -36, MIX, True, seed=6, skip=[(-17, -12)], **H)
row(g, 25, 26, 7, 28, MIX, seed=7, **H)
doors = row(g, 33, 34, -4 + 1, 24, MIX, seed=8, skip=[(-4, 5), (10, 18)], **H); g.lane([(-1, 34), (24, 34)], 1, 'd')
ed = row(g, -4, -3, 24, 35, MIX, seed=9, **H); g.lane([(22, -1), (22, -3), (max(ed + [22]), -3)], 1, 'd')
row(g, -2, -1, 12, 19, MIX, seed=15, **H)
col(g, -24, -11, 12, -1, MIX, seed=10, **H); col(g, -24, -11, 12, 1, MIX, seed=11, skip=[(-6, 4), (-16, -9)], **H)
col(g, 4, 10, 19, -1, MIX, seed=12, **H); col(g, 4, 10, 19, 1, MIX, seed=13, **H); col(g, -14, 10, 19, 1, MIX, seed=14, **H)

g.claim([(19, 6), (19, 7), (19, 8), (-11, 0), (-11, 1), (-11, 2)], 'npc')                          # the snow guide and the Flight Hub instructor stand here: kept clear
g.props('rg_sign_board', [(18, 5)]); g.props('rg_bench', [(17, 8)]); g.props('torchPost', [(18, 7)], walk=True)
# the pass road: torches and rocks along its south verge
for x in range(-36, 40, 9): g.prop('torchPost', x, -34, walk=True)
g.props('rg_ice_boulder', [(-30, -38), (-18, -38), (-6, -38), (10, -38), (22, -38), (34, -38)]); g.props('rg_ice_boulder2', [(-24, -38), (16, -38), (28, -38)])

# ================================================================ the square
g.prop('jWell', 0, -1, walk=True); g.prop('noticeBoard', 3, -4, walk=True); g.prop('rg_sign_board', -8, -4, walk=True)
for k, x in enumerate((-8, -4, 4, 8)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, 1, walk=True)
g.props('torchPost', [(-10, -4), (9, -4), (-2, -4), (3, 0), (-3, 0), (-10, 0), (9, 0)], walk=True); g.props('rg_bench', [(-6, -2), (5, -2), (-6, 0), (7, -2)], walk=True)
g.props('rg_woodpile', [(-10, -2), (9, -2), (-1, 1), (2, 1)], walk=True); g.props('rg_barrel', [(-6, 1), (6, 1)], walk=True); g.props('rg_crates', [(-9, 1), (10, 1)], walk=True)
g.props('rg_planter_snow', [(-8, -6), (-2, -6), (2, -6), (9, -6)], walk=True); g.props('rg_snowpile', [(-4, -4), (7, -4), (-2, 0)], walk=True)
g.props('rg_young_green_snow0', [(-9, -4)], walk=True); g.props('rg_young_teal_snow0', [(8, -4)], walk=True)

# ================================================================ the Flight Hub
g.prop('airplane', -16, 1, walk=True); g.prop('vanGrey', -19, 2, walk=True); g.props('barrelDark', [(-14, 3), (-13, 3), (-19, -3)], walk=True); g.props('rg_crates', [(-13, -3), (-20, 3)], walk=True)
g.props('rg_lamp', [(-20, -4), (-12, -4), (-12, 3)], walk=True); g.prop('rg_sign_board', -13, -2, walk=True); g.prop('machineWhite', -18, -3, walk=True)
g.props('rg_snowpile', [(-14, -3), (-20, 0)], walk=True)

# ================================================================ the mine: the cave in the cliff, ore stacks, the engine
g.prop('maCaveBrown', 36, 5); g.props('caveRockIce', [(33, 5), (39, 5)]); g.props('bigRockGrey', [(31, 5), (34, 4), (38, 4)]); g.props('rockSnowCap', [(32, 3), (35, 3), (37, 3)]); g.props('rg_ice_boulder', [(30, 3), (33, 3), (39, 3)])
g.prop('trainEngine', 34, 13, walk=True); g.props('rg_crates', [(23, 9), (24, 12), (26, 8), (29, 9), (30, 9), (29, 11), (38, 15), (33, 15), (30, 12)], walk=True); g.props('crateWide', [(36, 10), (35, 15), (29, 13)], walk=True); g.props('rg_logs', [(22, 14), (25, 15), (38, 9), (38, 11), (38, 13), (28, 15)], walk=True)
g.props('machineBlue', [(31, 13), (31, 8)], walk=True); g.prop('waterTank', 28, 13, walk=True); g.props('rg_barrel', [(37, 15), (30, 15), (28, 8)], walk=True)
g.props('rg_mound_grey', [(33, 8), (36, 8), (37, 10), (32, 11), (36, 12), (31, 15)], walk=True); g.props('torchPost', [(28, 7), (38, 7), (28, 16), (38, 16)], walk=True)
g.props('rg_sign_board', [(26, 5)]); g.props('rg_spire_grey', [(28, 4), (29, 3), (32, 4), (36, 3), (38, 3)]); g.props('rg_boulder_grey', [(27, 4), (35, 4)]); g.props('rg_snowpile', [(35, 15), (29, 14)], walk=True)

# ================================================================ the tarn, the chapel, the lookout, the wind turbines
g.pond(-10, 32, 6, 2.5); g.props('rg_bench', [(-17, 33), (-3, 29)], walk=True); g.props('rg_lamp', [(-4, 32)], walk=True)
g.prop('rg_fountain_tower', 27, 35, walk=True); g.props('rg_bench_stone', [(26, 33), (29, 33), (26, 36), (29, 36)], walk=True); g.props('rg_lamp', [(25, 32), (30, 32), (25, 37), (30, 37)], walk=True)
g.props('rg_planter_snow', [(27, 32), (28, 37)], walk=True)
g.props('rg_lamp', [(11, 34), (17, 34)], walk=True); g.props('rg_bench', [(12, 31), (16, 31)], walk=True); g.props('rg_cairn', [(11, 31), (17, 31)], walk=True)
g.props('pxTurbine', [(-37, -29), (31, -30), (36, 24), (-30, 30)])

pond_ring(g, -10, 32, 6, 2.5, WOOD)
g.dress(trees=PINE, bushes=BUSH, pots=POTS); finish(g)
g.trees(-40, -40, 40, -37, WOOD); g.trees(-40, 36, 40, 40, WOOD); g.trees(-40, -40, -37, 40, WOOD); g.trees(37, -40, 40, 40, WOOD)
g.groves(-39, -39, 39, 39, WOOD, gap=1, min_area=6, styles=[('woods', WOOD), ('woods', PINE), ('woods', TALL + ROUND)])
g.garden(-39, -39, 39, 39, every=2)
g.drift(-40, -40, 40, 40, LUMPS, every=6)
g.done(dict(lim=42, hide_site_paths=True))
