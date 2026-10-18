"""Spindlewood, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t6-town.py
then python3 -I tools/adv-towns/preview.py T6 out.png to see it with the real art.

The story of the place: the timber dock of the island's east coast. Route 111's logs come down the west road and end on the quay, where the dock
store, the Center and the Landing market stand round the head of the quay; a long wharf and two piers run out across the cove (the sea cuts the cove
east of the quay, the generator's, and the three boardwalks over it are laid here), with the cargo boats and yachts moored in the slips between them and
a log boom floating at the north end. The Dock Road runs west along the foot of the beach from the quay, past the Center and the old houses, and the
Mill Road drops south from it to the Route 111 road, so the quayside yards (log decks, the loader, the vans) sit between the roads and the water. Net
Lane and the cottage rows hold the dockers' families west of the Mill Road; north of the Dock Road the beach runs up the coast, with pulled up boats,
drying racks, driftwood and a little market, and a narrow strip of pines and cottages follows the shore north-west. Exits: west (-29, 25) Route 111;
the long wharf (to x 34) is the sea side, not a route."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(29, 'T6')
FP4 = lambda ex: {'w': 4, 'd': 4, 'ex': ex}
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0', 'rg_pine_green1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
W = dict(walk=True)
# the shore the generator cuts (read off the generated site): the last grass column and the last sand column of each row north of the Dock Road
GM = {-29: -26, -28: -25, -27: -25, -26: -25, -25: -24, -24: -24, -23: -24, -22: -23, -21: -23, -20: -23, -19: -22, -18: -22, -17: -22, -16: -21, -15: -21, -14: -20, -13: -20, -12: -19, -11: -19,
      -10: -20, -9: -20, -8: -20, -7: -19, -6: -15, -5: -10, -4: -6, -3: -2, -2: 1, -1: 3, 0: 3, 1: 5, 2: 6, 3: 6, 4: 8, 5: 8, 6: 9}
SM = {-11: -7, -10: -5, -9: -2, -8: 1, -7: 4, -6: 5, -5: 7, -4: 8, -3: 9, -2: 11, -1: 13, 0: 14, 1: 15, 2: 16, 3: 17, 4: 18, 5: 19, 6: 20}
def grass(x, y):
    if y <= 6: return x <= GM[y]
    if y <= 20: return x <= 8
    if y <= 26: return x <= 8 or (x >= 12 and (y == 21 and x <= 16 or y == 22 and x <= 18 or y >= 23 and x <= 26))
    return x <= 26
def sand(x, y):
    if y <= 6: return y in SM and GM[y] < x <= SM[y]
    if y <= 8: return 12 <= x <= 22 - 4 * (y - 7)
    if y >= 23: return x >= 27 or (x >= 12 and y <= 22 and False)
    return False

# ================================================================ the boardwalks over the cove (the generator lays them over the water) and the roads
BOARDS = [[9, 7, 11, 26], [12, 10, 27, 11], [12, 14, 34, 16], [12, 19, 25, 20]]                  # the quay, the north pier, the long wharf, the south pier
g.lane([(-27, 6), (7, 6)], 2, 'd')                                                               # the Dock Road, out to the quay
g.lane([(-1, 8), (-1, 24)], 2, 'd')                                                              # the Mill Road
g.lane([(-29, 25), (7, 25)], 2, 'd'); g.exit(-29, 25, 'W')                                       # the Route 111 road in from the west, to the foot of the quay
g.lane([(-28, -19), (-28, 24)], 1, 'd')                                                          # the west footpath joins the rows
g.lane([(-27, -3), (-4, -3), (-4, 0)], 1, 'd')                                                   # Beach Lane, round to the Landing market
g.lane([(-27, -12), (-22, -12)], 1, 'd')                                                         # the upper cottages
g.lane([(-27, 16), (8, 16)], 1, 'd')                                                             # Net Lane, across the Mill Road to the quay
g.rect(2, 9, 8, 14, 'd'); g.rect(1, 17, 8, 19, 'd')                                              # the quayside log yards
g.rect(-4, 1, 2, 5, 't')                                                                         # the Landing market between the Center and the dock store
g.lane([(12, 25), (27, 25)], 1, 'd')                                                             # the lane east of the quay to the south yard
g.rect(13, 26, 25, 28, 'd')                                                                      # the south log yard

# ================================================================ the Dock Road: Center, dock store, the old houses
g.lot('hall', -25, 6, role=['t6-h1', FP4(1)], beds=None)
g.lot('hotelBlue', -18, 6, role=['t6-h2', FP4(1)], beds=None)
g.lot('rg_house_wood_d', -13, 6, beds=None)
g.lot('pokeCenterGrand', -8, 6, role=['t6-center', {'w': 5, 'd': 3, 'ex': 2}], beds=None)
g.lot('warehouse', 5, 6, role=['t6-mart', {'w': 6, 'd': 3, 'ex': 2}], beds=None)
g.props('rg_planter_tall_pink', [(-10, 7), (-5, 7)], **W); g.props('rg_planter_tall_orange', [(3, 5), (-21, 7)], **W)
g.props('rg_lamp', [(-26, 8), (-19, 8), (-12, 8), (-6, 8), (0, 8)], **W)
g.props('rg_bench', [(-15, 8), (-9, 8)], **W)
# the Landing market: stalls and benches on the tan paving
g.props('pxStallBlue', [(-3, 4)], **W); g.props('marketAwning', [(0, 4)], **W); g.props('rg_bench', [(-3, 2), (0, 2)], **W); g.props('rg_barrel', [(-4, 5), (2, 5)], **W); g.props('rg_lamp', [(-4, 1), (2, 1)], **W); g.props('rg_pot_plant', [(-1, 1), (1, 1)], **W)

# ================================================================ Net Lane and the cottage rows
for x, n, role in ((-26, 'chaletRedBig', ['t6-h3', FP4(1)]), (-21, 'houseBlueTall', 'house'), (-16, 'chaletRedChimney', ['t6-h4', FP4(1)]), (-11, 'cottageGreen', 'house'), (-7, 'tavern', ['t6-h5', FP4(1)])):
    g.lot(n, x, 15, street_y=16, role=role, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]) if role == 'house' else None, extras=[('rg_barrel_water', 3, 0)] if x == -16 else [])
for x, n in ((-26, 'rg_house_red_d'), (-21, 'cottageRedWide'), (-16, 'houseBlueDome'), (-11, 'thatchHouse'), (-6, 'rg_house_wood_b')):
    g.lot(n, x, 24, street_y=25, beds=(BEDS[x % 3], BEDS[(x + 2) % 3]))
g.props('rg_bench', [(-18, 17)]); g.props('rg_barrel_water', [(-13, 18)]); g.props('rg_woodpile', [(-23, 19), (-9, 20)]); g.props('rg_pumpkin', [(-14, 20), (-20, 20)])
# kitchen plots behind the south cottages
g.field(-25, 18, -22, 20, 'leafPlantB'); g.field(-19, 18, -17, 19, 'rg_pumpkin', every=2)

for x in range(-27, -2, 2):
    if not (-6 <= x <= -4 or -16 <= x <= -14): g.prop('mHedgeLongGreen', x, 9)
for x in range(-27, -2, 2): g.prop('mHedgeLongGreen', x, 17)

# ================================================================ Beach Lane and the shore cottages
for x, n in ((-26, 'jCabinA'), (-21, 'cottageTeal'), (-17, 'rg_house_red_d')): g.lot(n, x, -4, street_y=-3, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
g.lot('thatchHouseSmall', -25, -13, street_y=-12, beds=None); g.lot('jCabinD', -26, -18, street_x=-28)
for x0, y0, x1, y1, c in ((-27, -10, -23, -7, 'leafPlantB'), ): g.field(x0, y0, x1, y1, c)
g.props('rg_bench', [(-15, -1)]); g.props('rg_woodpile', [(-18, -1)]); g.props('rg_barrel_water', [(-23, -1)])

# ================================================================ the beach: boats pulled up, nets drying, driftwood, a little market
def bprops(name, pts, **k): return g.props(name, [(x, y) for x, y in pts if all(grass(x + i, y) or sand(x + i, y) for i in (-1, 0, 1))], **k)
bprops('maRowboat', [(5, -1)]); bprops('rg_raft', [(-1, -5), (10, 1)]); bprops('rg_wreck', [(-3, -9)])
bprops('rg_stall', [(-12, -1), (-8, 0)]); bprops('rg_stall_rug', [(1, -2)])
bprops('fallenLog', [(-6, -7), (2, -6), (8, -3), (13, 6)]); bprops('rg_log', [(-12, -9), (4, -4)]); bprops('rg_logs', [(-8, -6)])
bprops('rg_rock_grey', [(-13, -8), (-2, -8), (9, -5), (17, 2)]); bprops('rg_rock_grey_small', [(-9, -9), (6, -3), (18, 5)])
bprops('rg_shells', [(-4, -4), (11, -1), (12, 5)]); bprops('shell', [(-1, -6), (3, -3), (17, 4)]); bprops('rg_seaweed', [(-10, -10), (-4, -10)]); bprops('pebbles', [(1, -4), (7, 0), (15, 6)])
bprops('hutStraw', [(-6, -8), (-2, -8)]); bprops('strawHut', [(5, -4)]); bprops('tentPair', [(-14, -7), (8, 4)]); bprops('rg_raft', [(0, -8), (13, 0)]); bprops('maUmbrellaBlue', [(12, 3)]); any(bprops('maUmbrellaPink', [pt]) for pt in ((16, 6), (15, 6), (14, 6), (16, 4), (13, 7))); bprops('maLounger', [(12, 5)]); bprops('rg_crates', [(8, 2)]); bprops('rg_barrel', [(10, 4), (9, 4)])
bprops('rg_young_green0', [(-13, 0), (-8, -1)])

# ================================================================ the quayside: log decks, the loader, vans, the dock store's yard
for x in range(3, 8): g.prop('rg_logs', x, 10, **W)
for x in range(3, 8): g.prop('rg_woodpile', x, 11, **W) if x not in (4,) else None
g.props('fallenLog', [(7, 13), (2, 13)], **W); g.props('logShort', [(7, 9), (2, 10)], **W)
g.props('bulldozer', [(6, 18)], **W); g.props('vanGrey', [(3, 18)], **W); g.props('barrelOrange', [(8, 17), (8, 9)], **W); g.props('crateWide', [(2, 17)], **W)
g.props('stumpLarge', [(7, 14)], **W); g.props('fallenLog', [(5, 19), (2, 19)], **W)
g.lot('barnRed', 3, 24, street_y=25, beds=None)
g.lot('sSilverWarehouse', -18, 24, street_y=25, beds=None) if False else None
g.props('rg_woodpile', [(7, 21), (8, 22)]); g.props('rg_logs', [(6, 23), (8, 23)]); g.props('rg_lamp', [(1, 16), (8, 16)], **W)
g.props('mNoticeBoard', [(1, 9)], **W); g.props('rg_bench', [(7, 7)], **W)

# ================================================================ the quay, the piers and the wharf
Q = dict(walk=True)
g.props('wBollard', [(9, 9), (9, 17), (9, 24), (11, 22), (11, 11), (11, 18)], **Q)
g.props('wBollard', [(14, 10), (18, 10), (22, 10), (26, 10), (14, 14), (18, 14), (24, 14), (14, 16), (16, 16), (25, 16), (29, 16), (15, 20), (18, 20), (22, 20), (25, 20)], **Q)
g.props('crateWide', [(20, 10), (24, 10), (16, 14), (22, 14), (17, 20)], **Q); g.props('crateBox', [(12, 10), (20, 14), (20, 20)], **Q)
g.props('crateWideB', [(26, 14), (23, 20)], **Q); g.props('barrelOrange', [(16, 10), (12, 14), (24, 20)], **Q); g.props('barrelDark', [(28, 14)], **Q)
g.props('lampPost', [(11, 9), (11, 13), (11, 20), (11, 25), (19, 10), (27, 10), (20, 16), (28, 16), (13, 20)], **Q)
g.props('logShort', [(26, 11), (13, 11), (21, 16)], **Q); g.props('fallenLog', [(19, 20), (13, 16)], **Q)
g.props('benchYellow', [(22, 16)], **Q); g.props('noticeBoard', [(12, 16)], **Q); g.props('rg_woodpile', [(11, 7)], **Q)
# the shipping: cargo boats and yachts in the slips, rafts of logs in the boom, a yacht beyond the south pier
g.props('maRowboat', [(16, 13), (24, 13), (29, 18)], force=True); g.props('pxYacht', [(20, 18)], force=True); g.props('speedboat', [(24, 18)], force=True); g.props('boatWhite', [(14, 18)], force=True)
g.props('rg_water_raft', [(21, 8), (25, 9), (19, 9)], force=True); g.props('rg_water_raft2', [(23, 8), (27, 9)], force=True); g.props('pxYacht', [(25, 22)], force=True)

# ================================================================ the south yard, east of the quay
g.lot('jCabinA', 14, 24, street_y=25, beds=None); g.lot('jCabinC', 19, 24, street_y=25, beds=None)
g.props('rg_logs', [(15, 27), (17, 27), (19, 27), (21, 27)], **W); g.props('fallenLog', [(23, 27), (16, 28), (22, 28)], **W); g.props('logShort', [(14, 27), (24, 27)], **W)
g.props('vanGrey', [(20, 28)], **W); g.props('barrelOrange', [(13, 26), (25, 26)], **W); g.props('crateWide', [(18, 28)], **W)

# ================================================================ the sea, the sand and the boards are claimed (no trees or flowers there); the sand gets its own scatter
import random
rs = random.Random(4)
for y in range(-29, 30):
    for x in range(-29, 30):
        if (x, y) in g.occ or grass(x, y): continue
        if any(b[0] <= x <= b[2] and b[1] <= y <= b[3] for b in BOARDS): g.occ[(x, y)] = 'board'; continue
        if sand(x, y) and g.get(x, y) == '.' and rs.random() < .16: g.prop(rs.choice(['rg_shells', 'shell', 'pebbles', 'rg_sea_pebble', 'rg_rock_grey_small', 'rg_log', 'rg_seaweed', 'rg_rock_grey', 'coralPink', 'fallenLog', 'rg_boulder_grey']), x, y)
        g.occ.setdefault((x, y), 'sand' if sand(x, y) else 'sea')

# ================================================================ woods and flowers on what is left
def skip(x, y): return not all(grass(x + i, y + k) for i in (-1, 0, 1) for k in (0, 1))
g.trees(-29, -29, -14, 2, WOOD, skip=skip)
g.trees(-29, 27, 26, 29, WOOD, skip=skip)
for x in range(-28, 26, 2): g.prop('rg_bush_green' if x % 4 else 'rg_bush_teal', x, 28)
g.dress()
g.groves(-29, -29, 26, 29, WOOD, gap=0, min_area=6, styles=[('woods', WOOD), ('meadow', SMALL + ['rg_flower_pink', 'rg_flower_yellow'])])
g.garden(-29, -29, 26, 29, every=3)
g.drift(-29, -29, 26, 29, SMALL, every=6)
g.done(dict(lim=31, hide_site_paths=True, boards=BOARDS))
