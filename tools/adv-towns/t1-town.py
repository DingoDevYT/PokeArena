"""Frostfall, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t1-town.py
then python3 -I tools/adv-towns/preview.py T1 out.png to see it with the real art.

The story of the place: a mountain village on the high plateau under the peaks, snowed in half the year. It grew from the miners' camp at the old mine in the east cliff.
The pass road (Route 17) runs along the north rim, west to east; the village street drops from it into the village and ends in the small square, where the lodge (the
Center) and the store stand and the well and the notice board are. Chalets with steep roofs huddle round the square and along trodden lanes, firewood stacked against
every wall; west of the square lies the Flight Hub with its landing pad; the mine road runs east from the square to the mine yard under the cliff, with the mine office,
ore stacks and the cave mouth. The plateau is a rounded blob of level ground inside the hills, and the village keeps to it: the street drops from the rim down the narrow level corridor at x 4..5, the rim falls away to the south, where the frozen tarn, the old chapel and a lookout terrace sit on the plateau's last level ground. Wind turbines turn on the open snow,
snow pines shelter the north side. Exits: west (-40, -36) and east (40, -36), the pass road."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit, snowkit as sk
from snowkit import *

g = sk.SnowTown(40, 'T1', 42)                                                                   # reads the plateau's level ground: houses and yards stand only on it, the hills stay forest
g.rect(-40, -40, 40, 40, 'Z')                                                                    # the plateau under snow

# ================================================================ roads
g.lane([(-40, -36), (40, -36)], 2, 'd')                                                          # the pass road along the north rim
g.lane([(4, -34), (4, -7)], 2, 'd')                                                              # the village street, down the level corridor into the village
g.rect(-11, -6, 11, 2, 'p')                                                                      # the square
g.rect(-21, -4, -12, 3, 'p')                                                                     # the Flight Hub landing pad
g.lane([(12, -1), (20, -1), (20, 7)], 2, 'd')                                                    # the mine road
g.rect(20, 6, 35, 12, 'd')                                                                       # the mine yard
for x, y in ((20, 6), (35, 6), (35, 12), (20, 12)): g.put(x, y, 'Z')
g.exit(-40, -36, 'W'); g.exit(40, -36, 'E')

# ================================================================ the lodge (Center) and the store on the square
g.building('pokeCenterWhite', -5, -7, 'center'); g.rect(-5, -8, -5, -6, 'd')
g.building('martWhite', 9, -7); g.rect(9, -8, 9, -6, 'd')
g.lot('maLogCabin', 30, 5, street_y=6, beds=None)                                                # the mine office
g.lot('sWoodPagoda', 9, 27, street_y=28, beds=None)                                              # the old chapel

# ================================================================ houses on trails of different shapes: bends, loops, short spurs, columns
CH = ['chaletRed', 'chaletRedB', 'chaletPink', 'cabinGreen', 'cabinGreenWide', 'cottageGreenWide', 'cottageGreen', 'cottageRed', 'jCabinA', 'jCabinB', 'jCabinC', 'jCabinD', 'chaletRedBig', 'chaletRedChimney']
BIGH = ['rg_house_wood_b', 'rg_house_wood_c', 'rg_house_wood_d', 'rg_house_red_d', 'maLogCabin', 'jLodge']
MIX = CH * 2 + BIGH
H = dict(gap=(1, 2))
trail(g, [(6, -27), (14, -27), (14, -16), (24, -16)], MIX, seed=1, vside=(-1,), **H)                       # the orchard bend, north-east
trail(g, [(3, -27), (-12, -27), (-12, -21), (-24, -21)], MIX, seed=2, vside=(1,), **H)                      # the north-west bend
trail(g, [(3, -15), (-38, -15)], MIX, seed=3, **H)                                                           # Kettle Row, the long lane west
g.lane([(-34, -15), (-34, -11)], 1, 'd'); g.lane([(-38, -11), (-30, -11), (-30, -3), (-38, -3), (-38, -11)], 1, 'd')   # the west green: a loop lane, a link up to Kettle Row
g.props('jWell', [(-34, -7)], walk=True); g.props('rg_bench', [(-37, -9), (-31, -9), (-37, -5), (-31, -5)], walk=True); g.props('torchPost', [(-37, -10), (-31, -10), (-37, -4), (-31, -4)], walk=True)
g.props('rg_planter_snow', [(-36, -7), (-32, -7)], walk=True); g.props('rg_young_green_snow0', [(-35, -9), (-33, -5)], walk=True); g.props('rg_snowpile', [(-34, -9), (-35, -5)], walk=True)
trail(g, [(3, 9), (-26, 9), (-26, 20), (-12, 20)], MIX, seed=4, vside=(-1,), skip=[(1, 10, 14)], **H)         # the south-west bend, down the strip to the tarn
g.lane([(-26, 12), (-33, 12)], 1, 'd'); g.rect(-38, 10, -34, 14, 'p')                                      # the lookout terrace
lane_row(g, 9, 5, 19, MIX, False, seed=6, skip=[(15, 21)], **H)                                              # under the square, east
trail(g, [(5, 17), (22, 17), (22, 24), (10, 24)], MIX, seed=7, vside=(-1,), skip=[(2, 10, 15)], **H)        # the south-east bend
trail(g, [(22, 17), (38, 17)], MIX, seed=8, **H)
g.lane([(4, 3), (4, 28)], 1, 'd'); g.lane([(4, 28), (9, 28)], 1, 'd')
row(g, -12, -11, -37, -30, MIX, seed=31, skip=[(-35, -33)], **H)                                                               # north side of the west green
trail(g, [(12, -3), (12, -9), (27, -9)], MIX, seed=32, vside=(1,), **H)                                       # the east lane off the store, houses facing it
trail(g, [(3, 25), (-14, 25)], MIX, seed=33, **H)                                                           # a short lane under the south-west bend                                       # the village street goes on south to the chapel

g.claim([(19, 6), (19, 7), (19, 8), (-11, 0), (-11, 1), (-11, 2)], 'npc')                          # the snow guide and the Flight Hub instructor stand here: kept clear
g.props('rg_sign_board', [(18, 5)]); g.props('rg_bench', [(17, 8)]); g.props('torchPost', [(18, 7)], walk=True)
# the pass road: torches and rocks along its south verge
for x in range(-36, 40, 9): g.prop('torchPost', x, -34, walk=True)
g.props('rg_ice_boulder', [(-30, -38), (-18, -38), (-6, -38), (10, -38), (22, -38), (34, -38)]); g.props('rg_ice_boulder2', [(-24, -38), (16, -38), (28, -38)])

# ================================================================ the square
g.prop('jWell', 0, -1, walk=True); g.prop('noticeBoard', 7, -4, walk=True); g.prop('rg_sign_board', -8, -4, walk=True)
for k, x in enumerate((-8, -4, 0, 8)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, 1, walk=True)
g.props('torchPost', [(-10, -4), (11, -4), (-2, -4), (3, 0), (-3, 0), (-10, 0), (11, 0)], walk=True); g.props('rg_bench', [(-6, -2), (7, -2), (-6, 0), (9, -2)], walk=True)
g.props('rg_woodpile', [(-10, -2), (11, -2), (-1, 1), (3, 1)], walk=True); g.props('rg_barrel', [(-6, 1), (6, 1)], walk=True); g.props('rg_crates', [(-9, 1), (10, 1)], walk=True)
g.props('rg_planter_snow', [(-8, -6), (-2, -6), (2, -6), (11, -6)], walk=True)
g.props('rg_young_green_snow0', [(-9, -4)], walk=True); g.props('rg_young_teal_snow0', [(10, -4)], walk=True)

# ================================================================ the Flight Hub
g.prop('airplane', -16, 1, walk=True); g.prop('vanGrey', -19, 2, walk=True); g.props('barrelDark', [(-14, 3), (-13, 3), (-19, -3)], walk=True); g.props('rg_crates', [(-13, -3), (-20, 3)], walk=True)
g.props('rg_lamp', [(-20, -4), (-12, -4), (-12, 3)], walk=True); g.prop('rg_sign_board', -13, -2, walk=True); g.prop('machineWhite', -18, -3, walk=True)

# ================================================================ the mine: the cave in the cliff, ore stacks, the engine
g.prop('maCaveBrown', 36, 5, force=True); g.props('caveRockIce', [(33, 4), (39, 5)]); g.props('bigRockGrey', [(34, 4), (38, 4)]); g.props('rockSnowCap', [(32, 3), (35, 3), (37, 3)]); g.props('rg_ice_boulder', [(30, 3), (39, 3)])
g.prop('trainEngine', 31, 11, walk=True); g.props('rg_crates', [(22, 9), (23, 11), (26, 8), (28, 9), (29, 9), (24, 10), (33, 11)], walk=True); g.props('crateWide', [(33, 8), (28, 11), (22, 11)], walk=True); g.props('rg_logs', [(34, 9), (34, 11), (26, 11)], walk=True)
g.props('machineBlue', [(26, 10), (29, 7)], walk=True); g.prop('waterTank', 24, 8, walk=True); g.props('rg_barrel', [(23, 10), (33, 7)], walk=True)
g.props('rg_mound_grey', [(28, 10), (32, 9), (25, 11)], walk=True); g.props('torchPost', [(22, 7), (34, 7), (22, 12), (34, 12)], walk=True)
g.props('rg_sign_board', [(26, 5)]); g.props('rg_spire_grey', [(28, 4), (36, 3), (38, 3)]); g.props('rg_snowpile', [(32, 12), (27, 9)], walk=True)

# ================================================================ the tarn (frozen pool, props), the chapel, the lookout terrace, the wind turbines
skate_pond(g, -12, 31, 5, 3); g.props('rg_bench', [(-13, 30), (-6, 30)], walk=True); g.props('rg_lamp', [(-8, 29), (-12, 29)], walk=True)
g.prop('rg_fountain_tower', -37, 13, walk=True); g.props('rg_bench_stone', [(-35, 11), (-35, 14)], walk=True); g.props('rg_lamp', [(-38, 10), (-34, 10), (-38, 14)], walk=True)
g.props('rg_lamp', [(7, 28), (11, 28)], walk=True); g.props('rg_bench', [(6, 25), (12, 25)], walk=True); g.props('rg_cairn', [(7, 25), (11, 25)], walk=True)
g.props('pxTurbine', [(-37, -29), (24, -29), (36, 22), (-30, 26)])

prune(g)
pond_ring(g, -10, 32, 3, 2, WOOD)
g.dress(trees=PINE, bushes=BUSH, pots=POTS); finish(g)
g.trees(-40, -40, 40, -37, WOOD); g.trees(-40, 36, 40, 40, WOOD); g.trees(-40, -40, -37, 40, WOOD); g.trees(37, -40, 40, 40, WOOD)
g.groves(-39, -39, 39, 39, WOOD, gap=1, min_area=6, styles=[('woods', WOOD), ('woods', PINE), ('woods', TALL + ROUND)])
glade(g, 28, -6, 3, [('rg_stump_green_snow', 0, 0), ('rg_logs', -2, 1), ('rg_bench', 2, 1), ('torchPost', 1, -1), ('rg_snowpile', -1, -2)])
glade(g, -34, 4, 3, [('tentPair', 0, 0), ('rg_logs', 2, 1), ('rg_stump_teal_snow', -2, 1)])
g.garden(-39, -39, 39, 39, every=2)
g.drift(-40, -40, 40, 40, LUMPS, every=6)
g.done(dict(lim=42, hide_site_paths=True))
