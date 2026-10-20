"""Sporehaven, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g8-town.py
then python3 -I tools/adv-towns/preview.py G8 out.png to see it with the real art.

The story of the place: a fungal swamp village that grew along a causeway. Main Street is the old causeway through the wood, from the east road (Route 101, to
Duskmoss) and bending north at the west end into the west road (Route 2); the north road (Route 2, the mushroom road) wanders in from the north and turns
east above the village to come down the green way into the cap green. The Center and the store face the green, where the big glowing caps stand round
the fountain. Everything else grew off those two roads where the ground was dry enough: Rue's cap hall and the tavern on two short lanes off the green way,
cottages strung along the north road, a lane of timber houses at the west end, and four lanes that drop off Main Street and the green into the damp ground,
each ending at a door, with spore beds (mushroom plots), standing pools and the wardens' yard in between. The wood closes in everywhere else: moss stumps,
olive and teal trees and bare snags. Exits: north (-15, -44) Route 2, west (-44, -15) Route 2, east (44, 3) Route 101."""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(44, 'G8')
FP = lambda w, d, ex: {'w': w, 'd': d, 'ex': ex}
OLIVE = ['rg_round_olive0', 'rg_round_olive1', 'rg_tall_olive0', 'rg_tall_olive1', 'rg_pine_olive0', 'rg_pine_olive1']
TEAL = ['rg_round_teal0', 'rg_round_teal1', 'rg_tall_teal0', 'rg_tall_teal1', 'rg_pine_teal0', 'rg_pine_teal1']
BARE = ['rg_bare_olive0', 'rg_bare_olive1', 'rg_bare_teal0', 'rg_bare_teal1']
DARK = ['darkConeTree', 'pineTreeDark', 'spruceTreeDark', 'canopyTreeDark', 'roundTreeDark', 'layerTreeDark']
WOOD = OLIVE + TEAL + OLIVE + TEAL + BARE + DARK
MIX = OLIVE + TEAL + BARE
YOUNG = ['rg_young_olive0', 'rg_young_olive1', 'rg_young_teal0', 'rg_young_teal1', 'rg_bush_olive', 'rg_bush_teal', 'rg_bush_olive', 'rg_bush_teal']
MOSS = ['rg_stump_moss_olive', 'rg_stump_moss_teal', 'rg_stump_moss_green', 'rg_stump_sprout_olive', 'rg_stump_sprout_teal', 'rg_stump_olive', 'rg_stump_teal', 'rg_stump_moss_olive', 'rg_stump_moss_teal']
CAPS = ['mushroomsPale', 'mushroomsRed', 'mushroomsOrange', 'mushroomsOrangeB']
SMALL = ['rg_weeds', 'rg_clump_green', 'rg_clump_green2', 'rg_sprout', 'rg_leaves_small', 'rg_leaves_tiny', 'leafPlantDark', 'fern', 'rg_mushroom', 'rg_mushroom_white',
         'rg_mushroom_red', 'mushroomsPale', 'mushroomsOrange', 'twigs', 'rg_weeds', 'fern']
BEDS = [('rg_planter_green', 'rg_planter_white'), ('rg_pot_fern', 'rg_planter_green'), ('planterGrass', 'rg_planter_white'), ('mPlanterPot', 'rg_pot_fern')]
F = dict(walk=True)

# the people who stand outdoors (data/adv/npcs.js): their tiles stay open
NPC = [(-1, 5), (7, 3), (-5, 3), (15, -12), (-16, -12), (1, -7), (-19, 8), (21, 8), (23, 3), (-29, 3), (31, 3), (-8, -12)]
for x, y in NPC: g.claim([(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)] if (x, y) != (-1, 5) else [(x, y), (x, y + 1)], 'npc')

# the standing water the generator leaves in the swamp (fords): nothing is built or planted on it
for x0, y0, x1, y1 in ((-38, -24, -35, -21), (-31, -3, -29, 0), (-25, -42, -15, -34), (-7, -46, 0, -45)): g.claim([(x, y) for y in range(y0 - 1, y1 + 2) for x in range(x0 - 1, x1 + 2)], 'ford')

def pools(pts):
    for x, y in pts: g.prop('rg_pond', x, y)

def home(name, x, y, lane_y=None, lane_x=None, role='house', beds=None, **k):
    """a house lot if its ground is free, else left out; a person's tile under the porch does not stop it (the solid part is the base row), and is claimed again after"""
    cells = g.box(name, x, y, bld=True); back = [c for c in cells if g.occ.get(c) == 'npc']
    for c in back: del g.occ[c]
    if not g.free(cells):
        g.claim(back, 'npc')
        if role != 'house': print('  G8: could not place', name, x, y, [(c, g.occ.get(c)) for c in cells if c in g.occ][:3])         # a scenery house that does not fit is simply left out
        return False
    g.lot(name, x, y, street_y=lane_y, street_x=lane_x, role=role, beds=beds if beds is not None else BEDS[x % 4], **k); g.claim(back, 'npc'); return True
def scatter(kinds, every, gap=1, seed=1, walk=False, box=(-43, -43, 43, 43)):
    r = random.Random(seed)
    for (x, y) in sorted(g.openmask(*box, gap)):
        if r.random() * every < 1: g.prop(r.choice(kinds), x, y, walk=walk)

# ================================================================ roads: 2 wide dirt; footpaths 1 wide, every one ending at a door, a junction or the green
g.lane([(44, 3), (-34, 3), (-34, -15), (-44, -15)], 2, 'd')                                        # Main Street, the old causeway, bending north into the west road
g.lane([(-15, -44), (-15, -22), (0, -22), (0, -2)], 2, 'd')                                         # the north road: down the wood, east above the village, down the green way
g.exit(-15, -44, 'N'); g.exit(-44, -15, 'W'); g.exit(44, 3, 'E')
g.lane([(2, -12), (15, -12)], 1, 'd')                                                               # the gym lane, ending at the last cottage door
g.lane([(-1, -12), (-8, -12)], 1, 'd')                                                              # the tavern lane
g.lane([(2, -22), (18, -22)], 1, 'd')                                                               # the lane east along the top of the green way
g.lane([(-16, -22), (-27, -22)], 1, 'd'); g.lane([(-13, -30), (-9, -30)], 1, 'd')   # the lanes off the north road
g.lane([(-32, -8), (-25, -8)], 1, 'd')                                                              # the lane off the west road
g.lane([(-19, 5), (-19, 16), (-29, 16), (-29, 28), (-20, 28)], 1, 'd')                              # the west drop, stepping down the damp ground
g.lane([(0, 8), (0, 15)], 1, 'd'); g.lane([(-10, 15), (14, 15)], 1, 'd'); g.lane([(-10, 15), (-10, 26), (-6, 26)], 1, 'd')   # south of the green
g.lane([(21, 5), (21, 12), (32, 12)], 1, 'd'); g.lane([(38, 5), (38, 18), (34, 18)], 1, 'd')       # the two east drops
g.lane([(29, 2), (29, -8), (40, -8)], 1, 'd')                                                        # the east lane

# ================================================================ the cap green: a stone plaza in the middle
g.rect(-5, -1, 5, 7, 'p'); g.lane([(0, -12), (0, -2)], 2, 'p')
g.prop('maFountain', 0, 2, **F); g.props('frostMushroomTree', [(-4, 0), (4, 0)], **F)
g.props('benchTeal', [(0, 7), (-5, 3), (5, 3)], **F)
g.props('torchPost', [(-5, -1), (5, -1), (-5, 7), (5, 7), (-5, 5), (5, 5)], **F)
g.props('mPlanterPot', [(-3, -1), (3, -1)], **F)
for k, x in enumerate((-3, 2)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, 7, **F)
g.props('crateWide', [(-5, 6), (5, 6)], **F)
g.props('torchPost', [(-1, -12), (2, -9), (-1, -5), (2, -5)], **F); g.props('mPlanterEmpty', [(-1, -9), (-1, -15)], **F)     # the green way

# ================================================================ the Center and the store
g.building('pokeCenterGrand', -10, 1, ['g8-center', FP(5, 3, 2)]); g.rect(-10, 0, -10, 2, 'd')
g.building('warehouse', 10, 1, ['g8-mart', FP(6, 3, 2)]); g.rect(10, 0, 10, 2, 'd')
g.props('mPlanterPot', [(-13, 1), (-7, 1)]); g.props('mPlanterEmpty', [(7, 1), (14, 1)]); g.prop('signGreenWide', -12, 2); g.prop('streetSign', 15, 2)

# ================================================================ the cap hall and the tavern, off the green way
home('hotelGym', 8, -13, -12, role=['g8-gym', FP(8, 5, 3)], beds=('mPlanterPot', 'mPlanterPot'))
home('houseGreenFlat', 15, -13, -12)
home('tavern', -8, -13, -12, role=['g8-h1', FP(4, 4, 1)]); home('cabinGreen', -3, -13, -12)

# ================================================================ the north road: cottages strung along it, and the lanes off it
for x, n in ((-11, 'rg_house_wood_b'), (-5, 'cottageGreenWide')): home(n, x, -23, -22)
for x, n in ((6, 'rg_house_wood_c'), (12, 'thatchHouse')): home(n, x, -23, -22)
home('moundHut', 18, -23, -22)
home('hall', -21, -23, -22, role=['g8-h2', FP(4, 4, 1)]); home('cottageTeal', -27, -23, -22, beds=None)
home('cottageGreen', -9, -31, -30)

# ================================================================ the west road: a short lane
home('rg_house_wood_a', -29, -9, -8); home('cottageGreen', -25, -9, -8, beds=None)

# ================================================================ Main Street, north side east of the store, and the east lane
for x, n in ((17, 'rg_house_wood_c'), (25, 'cottageTeal'), (34, 'houseGreenSplit'), (40, 'cabinGreen')): home(n, x, 2, 3)
home('hotelBlue', 24, -6, lane_x=29, role=['g8-h3', FP(4, 4, 1)]); home('cabinGreenWide', 33, -9, -8); home('moundHut', 39, -9, -8)

for x, n in ((-18, 'cottageGreenWide'), (-23, 'rg_house_wood_d')): home(n, x, 2, 3)
g.props('rg_pond', [(-22, -6), (-20, -5), (-18, -6), (-24, -5)]); g.props('frostMushroomTree', [(-23, -8), (-17, -8), (-21, -3), (-26, -6)]); g.props('benchTeal', [(-21, -7), (-19, -4)]); g.props('torchPost', [(-24, -3), (-16, -3)]); g.props('reedsPair', [(-23, -4), (-19, -7)])

# ================================================================ south of Main Street: the west drop, the green's south lane, the two east drops
home('hotelBlue', -14, 11, lane_x=-19, role=['g8-lodge', FP(5, 4, 2)], beds=('mPlanterPot', 'mPlanterEmpty'))
home('chaletRedBig', -24, 15, 16, role=['g8-h4', FP(4, 4, 1)]); home('cottageTeal', -29, 15, 16, beds=None)
home('thatchHouse', -25, 27, 28); home('cabinGreen', -20, 27, 28, beds=None)
home('chaletRedChimney', 6, 14, 15, role=['g8-h5', FP(4, 4, 1)])
for x, n in ((-6, 'cottageGreen'), (-10, 'maHouseGreen'), (11, 'moundHut'), (14, 'cabinGreen')): home(n, x, 14, 15)
home('rg_house_wood_b', -6, 25, 26); home('rg_hut_round', -3, 25, 26, beds=None)
home('rg_house_wood_a', 26, 11, 12); home('cabinGreen', 32, 11, 12)
home('rg_house_wood_d', 34, 17, 18); home('thatchHouse', 30, 17, 18)

# ================================================================ spore beds, standing pools, the wardens' yard
g.field(-31, -19, -19, -16, 'mushroomsPale', every=2); g.field(-31, -13, -26, -12, 'mushroomsRed', every=1)
g.field(-8, 18, 8, 21, 'mushroomsRed', every=2); g.field(-27, 19, -22, 24, 'mushroomsOrange', every=2)
g.field(16, -19, 27, -17, 'mushroomsPale', every=2)
pools([(-6, 29), (-4, 31), (-2, 29), (0, 31), (2, 29), (4, 31), (6, 29), (-8, 33), (-5, 34), (-1, 34), (3, 34), (7, 33), (10, 31), (12, 29), (14, 31)])
pools([(8, -17), (10, -16), (12, -17), (-7, -17), (-5, -16), (-3, -17)])
pools([(24, 22), (26, 24), (28, 22), (30, 24), (32, 22), (36, 26), (34, 28)])
g.props('reedsPair', [(9, -18), (13, -16), (-6, -18), (-2, -16), (25, 23), (31, 23), (35, 27), (-3, 30), (5, 30), (11, 32)]); g.props('reedsOlive', [(7, -16), (11, -18), (-4, -18), (27, 23), (33, 25), (1, 30), (-7, 32), (9, 32), (13, 30)])
g.props('frostMushroomTree', [(-10, -17), (-9, -8), (4, -17), (16, -9), (4, -7), (-6, -8), (20, -8)])
g.fence('fencePole', 28, -24, 40, -24, step=2); g.fence('fencePole', 28, -13, 38, -13, step=2)
g.props('crateWide', [(30, -21), (31, -21), (36, -18)]); g.props('crateBox', [(32, -20), (35, -22)]); g.props('barrelOrange', [(34, -22), (35, -21), (39, -19)]); g.props('barrelDark', [(33, -18), (40, -16)])
g.props('rg_logs', [(36, -15), (39, -22)]); g.props('rg_woodpile', [(30, -15), (37, -20)]); g.props('rg_hut_round', [(31, -17), (38, -17)])
g.props('rg_quicksand_small', [(-12, 31), (17, 33)]); g.props('rg_quicksand_mid', [(21, 30)])
# the market yard east of the green way, between the gym lane and the store
for k, x in enumerate((5, 9, 13)): g.prop('rg_stall_rug' if k % 2 else 'rg_stall', x, -8)
g.props('rg_table', [(6, -5), (11, -5)]); g.props('rg_barrel', [(3, -10), (15, -10), (16, -7)]); g.props('rg_crates', [(8, -10), (13, -10)]); g.props('rg_barrel_water', [(15, -5)]); g.props('rg_woodpile', [(4, -6)])
g.props('benchTeal', [(7, -3)]); g.props('mPlanterPot', [(5, -2), (7, -2)])
g.props('rg_scarecrow', [(9, 24), (-25, 25)])

# ================================================================ lamps low along the streets, signs and the crew stations at the three roads out, wells and hedges
for x in range(-30, 44, 8): g.prop('torchPost', x, 2); g.prop('torchPost', x + 4, 5)
for y in range(-40, -22, 8): g.prop('torchPost', -16, y); g.prop('torchPost', -13, y + 4)
for x in range(-12, 18, 8): g.prop('torchPost', x, -21)
for y in range(-18, -3, 6): g.prop('torchPost', 3, y)
g.prop('streetSign', -13, -41); g.prop('streetSign', -42, -12); g.prop('signGreenWide', 41, 1); g.prop('streetSign', 3, 9); g.prop('signGreenWide', -36, 1)
for x, y in ((-12, -39), (-40, -12), (41, 6)):                                                      # a crew station at each road out: stakes, barrels, crates, a pile of cut caps
    g.props('fencePole', [(x, y), (x + 3, y + 1), (x - 2, y + 2)]); g.props('barrelOrange', [(x + 1, y + 2)]); g.props('crateBox', [(x - 1, y)]); g.props('crateWide', [(x + 2, y - 1)]); g.props('mushroomStump', [(x + 4, y + 2)])
g.props('jWell', [(-16, -17), (22, -9), (-12, 17), (16, 19)])
for x0, y0, x1 in ((-31, -20, -19), (-8, 17, 8)): g.fence('hedgeLong~swamp', x0, y0, x1, y0, step=2)

# ================================================================ woods walling the town in; moss, caps and puddles in the open ground
g.trees(-44, -44, 44, -33, WOOD); g.trees(-12, -33, 44, -26, WOOD)
g.trees(-44, 38, 44, 44, WOOD)
g.trees(40, -44, 44, 44, WOOD)
g.trees(-44, -44, -40, 44, WOOD); g.trees(-44, -33, -34, -17, WOOD)
g.dress(trees=MIX, bushes=['rg_bush_olive', 'rg_bush_teal'], pots=['rg_pot_fern', 'rg_planter_green'])
g.groves(-43, -43, 43, 43, WOOD, gap=1, min_area=25, styles=[('woods', WOOD), ('meadow', SMALL), ('woods', MIX), ('meadow', SMALL + CAPS)])
scatter(YOUNG, 6, seed=2); scatter(MOSS, 9, seed=3); scatter(CAPS, 5, seed=4, walk=True); scatter(['mushroomStump', 'hollowStump', 'rg_rock_grey', 'rg_mound_grass'], 40, seed=5, gap=2)
g.drift(-44, -44, 44, 44, SMALL, every=3)
g.done(dict(lim=46, hide_site_paths=True))
