"""Duskmoss, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t8-town.py
then python3 -I tools/adv-towns/preview.py T8 out.png to see it with the real art.

The story of the place: the quiet end of the road. Route 101, the quarantine line, comes down from Sporehaven through the dark wood and runs along the treeline
before it turns south into the town; the wardens' crews cut that treeline back every week, so a line of stakes with barrels and cut stumps follows the
edge of the swamp on the north-west and a crew station of barrels and crates stands at the end of each lane that reaches it. At night the forest edge glows and the town is the
dark part. Quay Street runs east along the beach between the Center, the store and the watch house on the north side and the net racks, boats and the
jetty on the south; the little square by the shore has the mushroom nobody planted, ringed by four stakes. The fish market sets up at the east end.
North of the street two lanes of cottages, plots and paddocks fill the lawn behind the beach, and the back lane west of the square leads past the
hall and the hotel to the shore, with Route 103 (the black shore) starting where the street turns south. Olive and teal trees, moss stumps and the
glow caps wall the town in on the swamp side; the sea does the rest. Exits: west (-44, -30) Route 101, south (-27, 44) Route 103."""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(44, 'T8')
FP = lambda w, d, ex: {'w': w, 'd': d, 'ex': ex}
OLIVE = ['rg_round_olive0', 'rg_round_olive1', 'rg_tall_olive0', 'rg_tall_olive1', 'rg_pine_olive0', 'rg_pine_olive1']
TEAL = ['rg_round_teal0', 'rg_round_teal1', 'rg_tall_teal0', 'rg_tall_teal1', 'rg_pine_teal0', 'rg_pine_teal1']
BARE = ['rg_bare_olive0', 'rg_bare_olive1', 'rg_bare_teal0', 'rg_bare_teal1']
DARK = ['darkConeTree', 'pineTreeDark', 'spruceTreeDark', 'canopyTreeDark', 'roundTreeDark', 'layerTreeDark']
WOOD = OLIVE + TEAL + DARK + DARK + BARE
MIX = OLIVE + TEAL + BARE
YOUNG = ['rg_young_olive0', 'rg_young_olive1', 'rg_young_teal0', 'rg_young_teal1', 'rg_bush_olive', 'rg_bush_teal', 'rg_bush_olive', 'rg_bush_teal']
MOSS = ['rg_stump_moss_olive', 'rg_stump_moss_teal', 'rg_stump_moss_green', 'rg_stump_sprout_olive', 'rg_stump_sprout_teal', 'rg_stump_olive', 'rg_stump_teal']
CAPS = ['mushroomsPale', 'mushroomsRed', 'mushroomsOrange', 'mushroomsOrangeB']
SMALL = ['rg_weeds', 'rg_clump_green', 'rg_clump_green2', 'rg_sprout', 'rg_leaves_small', 'rg_leaves_tiny', 'leafPlantDark', 'fern', 'rg_mushroom', 'rg_mushroom_white', 'rg_mushroom_red',
         'mushroomsPale', 'mushroomsOrange', 'twigs', 'rg_weeds', 'rg_tiny_white', 'rg_tiny_blue']
BEACH = ['shell', 'pebbles', 'rg_shells', 'rg_sea_pebble', 'rg_sea_stone', 'twigs', 'rockGrey', 'stoneGrey', 'rg_rock_grey_small']
BEDS = [('rg_planter_green', 'rg_planter_white'), ('rg_pot_fern', 'rg_planter_green'), ('planterGrass', 'rg_planter_white'), ('mPlanterPot', 'rg_pot_fern')]
F = dict(walk=True)

# the ground the world lays under the town (swamp on the north and west, grass, sand along the beach, black sand in the south-west, the sea in the south-east), one run-length row per tile row
# from y -46 to 46, x -46 to 46: s swamp . grass , sand a black sand ~ sea = the jetty. It only keeps props off the water and the trees off the sand.
GROUND = '''
.26s44.23
.24s47.22
.22s51.20
.20s54.19
.19s56.18
.18s58.17
.17s59.17
.16s59.18
.15s59.19
.5s7.3s58.20
.4s68.21
.2s69.22
.1s69.23
s69.24
s68.25
s67.26
.1s65.27
.1s64.28
s45.1s18.29
s39.15s9.30
s36.21s5.31
s34.25s2.32
s32.61
s31.62
s29.64
s28.65
s27.66
s26.67
s25.68
s24.69
s24.68,1
s23.70
s22.70,1
s22.69,2
s21.70,2
s21.69,3
s20.69,4
s20.68,5
s20.67,6
s19.20,4.41,9
s19.19,10.33,12
s19.19,55
s19.19,55
s19.18,56
s19.18,56
s19.18,56
s19.18,56
s19.14,59.1
s19.14,58.2
s19.14,55~5
s19.15,54~5
s19.15,22=2,26~9
s19.14,23=2,26~9
s19.14,17~6=2,26~9
s20.12,16~8=2~5,18~12
s20.12,16~8=2~9,14~12
s20.11,17~8=2~12,10~13
s22.9,17~8=2~35
s22.8,17~9=2~35
s22.8,16~10=2~35
s22.7,16~11=2~35
s22.6,16~12=2~35
s20.8,15~13=2~35
s19.8,15~51
s18.8,15~52
s17.9,14~53
s16.9,14~54
s15.9,14~55
s14.8a3,12~56
s13.9a4,10~57
s12.10a5,8~58
s11.9a8,7~58
s10.9a11,4~59
s9.9a13,2~60
s8.9a15~61
s7.8a16~62
s6.8a13~1a2~63
s5.8a14~66
s4.7a16~66
.1s2.7a14~69
.1s1.8a14~69
.9a13~1a1~69
.9a12~72
.9a12~72
.9a12~72
.9a9~75
.9a9~75
.9a9~75
.9a9~75
.9a9~75
.9a9~75
.9a9~75
.9a9~75
'''.strip().split('\n')
def _row(r):
    out = []; k = ''; n = ''
    for ch in r + ' ':
        if ch.isdigit(): n += ch; continue
        if k: out.append(k * int(n))
        k = ch; n = ''
    return ''.join(out)
ROWS = [_row(r) for r in GROUND]
def ground(x, y): return ROWS[y + 46][x + 46] if -46 <= x <= 46 and -46 <= y <= 46 else '.'

# the people who stand outdoors (data/adv/npcs.js): their tiles stay open
NPC = [(-3, -14), (1, -4), (-4, -18), (-13, 0), (-22, 1), (16, 3), (14, 1), (-6, 4), (-16, 2), (20, 1), (-10, 11), (9, 2)]
for x, y in NPC: g.claim([(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)] if y not in (1, 2) else [(x, y)], 'npc')

def room(name, x, y):
    """the cells a building's sprite covers: a person's tile under its porch does not stop it (the solid part is the base row only); those tiles are claimed again afterwards"""
    cells = g.box(name, x, y, bld=True); back = [c for c in cells if g.occ.get(c) == 'npc']
    for c in back: del g.occ[c]
    return cells, back
def home(name, x, y, lane_y=None, lane_x=None, role='house', beds=None, **k):
    """a house lot if its ground is free, else skipped (and said so)"""
    cells, back = room(name, x, y)
    if not g.free(cells):
        g.claim(back, 'npc')
        if role != 'house': print('  T8: could not place', name, x, y, [(c, g.occ.get(c)) for c in cells if c in g.occ][:4])      # a scenery house that does not fit is simply left out
        return False
    g.lot(name, x, y, street_y=lane_y, street_x=lane_x, role=role, beds=beds if beds is not None else BEDS[x % 4], **k); g.claim(back, 'npc'); return True
def big(name, x, y, role):
    cells, back = room(name, x, y); g.building(name, x, y, role); g.claim(back, 'npc')
def scatter(kinds, every, gap=1, seed=1, walk=False, box=(-43, -43, 43, 43), only=None):
    r = random.Random(seed)
    for (x, y) in sorted(g.openmask(*box, gap)):
        if (only is None or ground(x, y) in only) and r.random() * every < 1: g.prop(r.choice(kinds), x, y, walk=walk)

# ================================================================ roads: 2 wide dirt; footpaths 1 wide
g.lane([(-44, -30), (-2, -30), (-2, 2)], 2, 'd'); g.exit(-44, -30, 'W')                            # Route 101 along the treeline, turning south into the town
g.lane([(-27, 1), (37, 1)], 2, 'd')                                                                 # Quay Street
g.lane([(-27, 1), (-27, 13)], 2, 'd')                                                               # down to where Route 103 begins (the generator lays it from the end of the back lane)
g.lane([(-25, 12), (-9, 12), (-9, 18), (-18, 18)], 1, 'd')                                         # the back lane to the shore, and the beach row of shacks
g.lane([(0, -9), (38, -9)], 1, 'd'); g.lane([(0, -20), (38, -20), (38, 2)], 1, 'd')                # the two lanes of cottages, joined by the east footpath
g.lane([(-3, -9), (-15, -9)], 1, 'd'); g.lane([(-3, -18), (-12, -18)], 1, 'd')                     # the lanes west of the road: out to the crew station on the cut line, and a short one for the houses by the wood

# ================================================================ Quay Street: the Center, the store, the watch house and the houses along it
big('pokeCenterGrand', -18, 1, ['t8-center', FP(5, 3, 2)]); g.rect(-18, 0, -18, 1, 'd')
home('chaletRedBig', -25, 1, 2, role=['t8-h1', FP(4, 4, 1)])
home('chaletRedChimney', -6, 1, 2, role=['t8-h2', FP(4, 4, 1)])
big('warehouse', 6, 1, ['t8-mart', FP(6, 3, 2)]); g.rect(6, 0, 6, 1, 'd')
home('tavern', 15, 1, 2, role=['t8-h3', FP(4, 4, 1)])
home('inn', 22, 1, 2, role=['t8-lodge', FP(5, 4, 2)], beds=('mPlanterPot', 'mPlanterPot'))
for x, n in ((-12, 'cottageTeal'), (1, 'cabinGreen'), (18, 'maHouseGreen'), (28, 'thatchHouse'), (33, 'cottageGreen')): home(n, x, 1, 2)

# ================================================================ the houses by the wood: lane D and the road
home('rg_house_red_a', -7, -19, -18); home('rg_house_wood_d', -12, -19, -18); home('cottageGreenWide', -8, -26, lane_x=-2); home('rg_house_wood_c', 4, -27, lane_x=-1)

# ================================================================ the cut line, the crew stations and the lanes to them
STAKES = [(-26, -4), (-26, -7), (-25, -10), (-24, -12), (-22, -14), (-21, -16), (-17, -21), (-15, -22), (-13, -24), (-11, -26), (-8, -27), (-5, -28), (-26, -1)]
g.props('fencePole', STAKES)
for x, y in ((-20, -9), (-16, -17)):                                                                # a crew station at the end of each lane to the cut line: barrels, crates, cut logs and a lamp (no paving: the lanes end at the last door)
    g.props('torchPost', [(x - 2, y - 1)]); g.props('barrelOrange', [(x - 1, y - 2), (x, y - 2)]); g.props('crateBox', [(x + 1, y - 2)]); g.props('crateWide', [(x + 2, y)]); g.props('rg_logs', [(x - 2, y + 1)]); g.props('mushroomStump', [(x - 3, y)])
for x, y in STAKES[1::2]: g.props('stumpSmall', [(x + 2, y + 1)]); g.props('mushroomStump', [(x - 2, y)])
for x in (-38, -20, -8): g.props('fencePole', [(x, -32), (x + 2, -32)]); g.props('barrelOrange', [(x + 1, -32)]); g.props('crateWide', [(x + 3, -32)])     # crew stations along the road in the wood
g.prop('streetSign', -42, -28); g.prop('signGreenWide', 2, -27)

# ================================================================ the north lanes
for x, n in ((-8, 'rg_house_wood_d'), (-15, 'cottageGreenWide')): home(n, x, -10, -9)
for x, n in ((4, 'rg_house_wood_c'), (11, 'cottageTeal'), (18, 'rg_house_red_d'), (25, 'thatchHouse'), (32, 'rg_house_wood_b')): home(n, x, -10, -9)
for x, n in ((5, 'rg_house_red_c'), (12, 'cabinGreenWide'), (20, 'rg_house_wood_a'), (28, 'moundHut'), (34, 'rg_house_red_b')): home(n, x, -21, -20)

# ================================================================ the back lane, the shore huts
home('hall', -21, 11, 12, role=['t8-h4', FP(4, 4, 1)]); home('hotelBlue', -12, 11, 12, role=['t8-h5', FP(4, 4, 1)])
home('rg_hut_round', -16, 11, 12); home('strawHut', -25, 11, 12)
for x, n in ((-12, 'strawHut'), (-15, 'hutStraw'), (-18, 'rg_hut_round')): home(n, x, 17, 18, beds=None)
g.props('rg_stall', [(-14, 20), (-18, 20)]); g.props('maRowboat', [(-11, 22)]); g.props('barrelOrange', [(-13, 19), (-19, 19)]); g.props('crateBox', [(-10, 20)]); g.props('rg_logs', [(-20, 21)])

# ================================================================ the square by the shore: the mushroom nobody planted, ringed by four stakes
g.rect(-6, 5, 1, 9, 't'); g.rect(-3, 3, -2, 4, 't')
g.props('frostMushroomTree', [(-2, 7)], **F); g.props('fencePole', [(-5, 5), (0, 5), (-5, 9), (0, 9)], **F)
g.props('benchTeal', [(-4, 8), (-1, 8)], **F); g.props('torchPost', [(-6, 5), (1, 9)], **F)
g.props('frostMushroomTree', [(-10, -3), (-9, -6)]); g.props('mushroomsPale', [(-11, -4), (-10, -6), (-9, -2)]); g.props('mushroomsRed', [(-8, -4), (-11, -1)])

# ================================================================ the quay: jetty landing, net racks, boats, the fish market, the drying yard
g.rect(8, 3, 13, 4, 't'); g.props('torchPost', [(8, 3), (13, 3)], **F); g.props('barrelDark', [(9, 4), (12, 4)], **F); g.props('crateBox', [(8, 4)], **F)
g.props('maRowboat', [(15, 7), (22, 8)]); g.props('boatWhite', [(14, 15)]); g.props('maRowboat', [(7, 14)]); g.props('maSailboat', [(22, 15)]); g.props('pxYacht', [(30, 12)]); g.props('rg_raft', [(3, 12), (17, 17)])
g.rect(24, 3, 33, 6, 't')
for k, x in enumerate((25, 28, 31)): g.prop(('pxStallBlue', 'pxStallPink', 'rg_stall_rug')[k], x, 4, **F)
g.props('rg_table', [(26, 6), (30, 6)], **F); g.props('crateWide', [(24, 6), (33, 6)], **F); g.props('barrelDark', [(32, 6)], **F); g.props('benchTeal', [(28, 6)], **F); g.props('torchPost', [(24, 3), (33, 3)], **F)
g.props('rg_stall', [(16, 5), (18, 5), (20, 5)]); g.props('rg_woodpile', [(35, 4)]); g.props('rg_logs', [(36, 6)])
for x in (3, 8, 13, 18, 23, 28, 33): g.prop('rg_stall', x, -6)                                      # net racks along the yard behind the street
g.props('barrelOrange', [(5, -7), (15, -7), (26, -7)]); g.props('crateWide', [(6, -7), (21, -7), (31, -7)]); g.props('rg_woodpile', [(10, -7), (36, -7)]); g.props('rg_logs', [(1, -5), (29, -7)])
g.props('rg_raft', [(40, -4), (42, -2)]); g.props('rg_scarecrow', [(11, -5)])

for x in range(-22, 36, 8): g.prop('torchPost', x, 0 if x < -10 or x > 8 else -1, **F)
for x in range(-20, -6, 4): g.props('hedgeLong~swamp', [(x, 3)])                                      # the garden strip south of the street, west of the square
g.props('mPlanterPot', [(-24, 3), (-14, 3), (-8, 3)], **F); g.props('benchTeal', [(-18, 4), (-10, 4)], **F); g.props('rg_pot_fern', [(-22, 4), (-12, 4)], **F)

# ================================================================ plots and the paddock behind the lanes
g.plot(8, -18, 10, 3, 1); g.plot(24, -18, 8, 3, 0)
g.props('rg_scarecrow', [(22, -17)])

g.rect(36, -16, 40, -12, 'p'); g.props('jWell', [(38, -14)], **F); g.props('benchTeal', [(36, -12), (40, -12)], **F); g.props('torchPost', [(36, -16), (40, -16)], **F); g.props('mPlanterPot', [(37, -16), (39, -16)], **F)     # the well at the corner of the east footpath
g.props('rg_wreck', [(-8, 24), (-30, 31)]); g.props('rg_raft', [(-6, 19), (-24, 24)]); g.props('barrelDark', [(-8, 26), (-26, 28)]); g.props('crateWide', [(-7, 22), (-27, 30)]); g.props('rg_logs', [(-21, 26), (-31, 34)]); g.props('maRowboat', [(30, 9)])
for x, y in ((-22, 17), (-18, 20), (-26, 27), (-31, 33), (-27, 38)): g.props('fencePole', [(x, y), (x + 1, y + 1)]); g.props('stumpSmall', [(x + 2, y)])     # more of the crews' stakes down the shore
for x, y in ((12, 10), (18, 11), (27, 11), (34, 12), (9, 19), (22, 21), (33, 19), (4, 24), (14, 26), (28, 25), (-4, 21), (0, 30), (20, 31), (38, 22), (40, 30), (-10, 27), (6, 36), (30, 38)): g.props(('rg_water_rocks_grey', 'rg_water_rock_grey', 'rg_water_rock', 'rg_water_pile', 'rg_water_rocks_grey')[(x + y) % 5], [(x, y)])
g.props('maRowboat', [(42, -2)]); g.props('rg_stall', [(38, 0), (40, -5)]); g.props('rg_logs', [(37, -4), (44, -6)]); g.props('rg_woodpile', [(42, 2)]); g.props('barrelOrange', [(39, -2), (44, -4)]); g.props('crateBox', [(41, -4)])
g.props('rg_stall', [(-6, 12), (-4, 15)]); g.props('barrelDark', [(-7, 14), (-3, 13)]); g.props('rg_logs', [(-8, 16)]); g.props('crateWide', [(-5, 17)]); g.props('benchTeal', [(-9, -4), (-8, -8)]); g.props('torchPost', [(-11, -8)])
g.props('rg_hut_round', [(-17, 24)]); g.props('rg_stall', [(-14, 25)]); g.props('barrelOrange', [(-19, 25)]); g.props('rg_woodpile', [(-12, 24)])
g.trees(14, -31, 38, -27, MIX, dx=3, dy=3, skip=lambda x, y: ground(x, y) in ',a~')                 # the olive orchard north of the lanes
g.trees(-36, 34, -33, 44, MIX)
# ================================================================ the sea keeps its props off the water; the sand keeps its trees off
sea = [(x, y) for y in range(-46, 47) for x in range(-46, 47) if ground(x, y) == '~']
g.claim(sea, 'sea'); sand = [c for c in ((x, y) for y in range(-46, 47) for x in range(-46, 47) if ground(x, y) in ',a') if c not in g.occ]; g.claim(sand, 'beach')

# ================================================================ woods: the dark treeline on the swamp side
g.trees(-44, -44, 44, -33, WOOD, skip=lambda x, y: ground(x, y) in ',a~')
g.trees(-44, -33, -30, 44, WOOD)
g.trees(40, -44, 44, -9, MIX)
g.trees(-44, 30, -33, 44, MIX)
g.dress(trees=MIX, bushes=['rg_bush_olive', 'rg_bush_teal'], pots=['rg_pot_fern', 'rg_planter_green'])
g.groves(-43, -43, 43, 43, WOOD, gap=1, min_area=25, styles=[('woods', WOOD), ('meadow', SMALL), ('woods', MIX), ('meadow', SMALL + CAPS)])
scatter(YOUNG, 7, seed=2); scatter(MOSS, 10, seed=3); scatter(CAPS, 7, seed=4, walk=True)
for c in sand: del g.occ[c]
scatter(BEACH, 4, seed=5, walk=True, gap=1, only=',a'); scatter(['rockGrey', 'rockGreyB', 'stoneGrey', 'boulderGrey', 'rg_rock_grey_tall', 'rg_boulder_grey', 'logShort', 'fallenLog', 'rg_bones', 'rg_cairn', 'rg_mound_grey'], 28, seed=6, gap=2, only=',a')
scatter(['deadTree', 'deadPine', 'rg_bare_olive0', 'rg_spire_grey', 'rockDark', 'bigRockGrey', 'rg_boulder_grey2'], 30, seed=7, gap=2, only='a')
g.drift(-44, -44, 44, 44, SMALL, every=4)
g.done(dict(lim=46, hide_site_paths=True, boards=[[10, 5, 11, 16]]))
