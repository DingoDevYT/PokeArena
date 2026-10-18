"""Fernwell Sanctuary, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/l2-town.py
then python3 -I tools/adv-towns/preview.py L2 out.png to see it with the real art. A landmark, not a town: one building (the golden temple), no Center.

The story of the place: the temple the Fernwell family founded in a walled garden on the meadow, a day's walk up the road from Fernwell Park (the road from the park
arrives from the east). A clipped hedge walls the garden; the road passes between two stone gate towers and a white arch and runs on as a paved approach, lamp
lit and edged with rose beds, to the temple court in front of the golden temple at the garden's north end, where the statue dogs sit either side of its door.
South of the court the garden is laid out in four quarters round a paved cross: a pond with its reeds, a rose garden round a fountain, a blossom walk and a
parterre, the paved axis ending at the tower fountain at the garden's south end. The cloister lawns either side of the temple are blossom groves with benches.
Outside the wall woods and orchards of blossom trees close in, with the beach in the south-west corner. Exit: east (26, -6), the road to Fernwell Park."""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(26, 'L2')
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
BLOSSOM = ['rg_round_pink0', 'rg_round_pink1', 'rg_round_pink0', 'rg_tall_pink0', 'rg_round_pink1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_white', 'rg_bed_yellow']
HEDGE = 'mHedgeLongGreen'; HEDGE_T = 'mHedgeTallGreen'

# ================================================================ roads and paving
g.lane([(26, -6), (21, -6)], 2, 'd')                                                            # the road from Fernwell Park
g.lane([(20, -6), (9, -6)], 2, 'p')                                                             # the paved approach through the gate, into the court
g.rect(-9, -9, 9, -5, 'p'); g.rect(-5, -8, 5, -6, 't'); g.rect(-1, -10, 1, -10, 'p')                                        # the temple court
g.lane([(-1, -4), (-1, 16)], 2, 'p')                                                            # the axis south from the court
g.lane([(-17, 6), (16, 6)], 1, 't')                                                             # the cross walk
g.rect(-19, 5, -17, 7, 't'); g.rect(16, 5, 18, 7, 't')                                          # its two arbours
g.rect(-3, 15, 2, 17, 'p')                                                                      # the plaza round the tower fountain
g.lane([(-9, -7), (-17, -7)], 1, 't'); g.rect(-19, -8, -17, -6, 't')                            # the cloister walk west, ending at its seat
g.exit(26, -6, 'E')

# ================================================================ the temple and its court
g.building('goldTemple', 0, -10, 'house')
g.props('statueDog', [(-3, -9), (3, -9)], walk=True)
g.props('rg_column', [(-6, -10), (6, -10)]); g.props('rg_lantern', [(-2, -10), (2, -10)])
g.props('rg_lamp', [(-8, -9), (8, -9), (-8, -5), (8, -5), (12, -7), (16, -7), (12, -4), (16, -4)], walk=True)
g.props('rg_planter_white', [(-5, -6), (5, -6), (-5, -8), (5, -8)], walk=True); g.props('rg_planter_tall_pink', [(-4, -5), (4, -5)], walk=True)
g.props('rg_bench_stone', [(-7, -7), (7, -7)], walk=True); g.props('rg_pillar', [(-9, -9), (9, -9), (-9, -5), (9, -5)], walk=True); g.props('rg_lantern', [(-9, -7), (9, -7), (-4, -9), (4, -9)], walk=True)

# ================================================================ the walled garden: the hedge, the gate towers, the white arch
g.prop('stoneGateStack', 20, -7, walk=True); g.prop('stoneGateStack', 20, -1, walk=True)
for x in range(-20, 21):
    g.prop(HEDGE, x, -20); g.prop(HEDGE, x, 19)
for y in range(-19, 19):
    if y < -10 or y > -1: g.prop(HEDGE_T, 20, y)
    g.prop(HEDGE_T, -20, y)
g.props('rg_lantern', [(18, -9), (18, -2), (22, -9), (22, -2)]); g.prop('rg_arch_white', 14, -5, walk=True); g.props('rg_cairn', [(23, -9), (23, -2), (24, -8)])
g.props('rg_column', [(-20, -20), (20, -20), (-20, 19), (20, 19)])
for x in range(-18, 19, 2): g.props('rg_bush_green', [(x, -19), (x, 18)])
for y in range(-17, 18, 3): g.props('rg_bush_green', [(-19, y), (19, y)]); g.props('rg_sign_board', [(24, -3)])

# ================================================================ the approach: rose beds and blossom either side
for k, x in enumerate(range(11, 19, 2)):
    g.prop(BEDS[k % 3], x, -8, walk=True); g.prop(BEDS[(k + 1) % 3], x, -3, walk=True)
g.props('rg_round_pink0', [(11, -11), (15, -11), (17, 2)]); g.props('rg_bush_pink', [(13, -9), (17, -9), (13, -2), (17, -2)])

# ================================================================ the cloister lawns either side of the temple: blossom groves, benches, lamps
g.trees(-18, -18, -8, -11, BLOSSOM, dx=3, dy=3); g.trees(8, -18, 18, -11, BLOSSOM, dx=3, dy=3)
g.props('rg_bench', [(-12, -12), (12, -12), (-6, -14), (6, -14)]); g.props('rg_lamp', [(-8, -12), (8, -12), (-18, -9), (18, -12)])
for k, x in enumerate((-17, -15, -13, -11, 11, 13, 15, 17)): g.prop(BEDS[k % 3], x, -18, walk=True)
g.props('rg_bush_pink', [(-4, -14), (4, -14), (-3, -12), (3, -12)]); g.props('roseBush', [(-4, -11), (4, -11), (-5, -12), (5, -12)])

# ================================================================ the pond quarter (north-west), the fountain quarter (north-east)
g.pond(-8, 0.5, 4, 2.5)
for k, y in enumerate((-3, -1, 1, 3)): g.prop(BEDS[k % 3], -18, y, walk=True); g.prop(BEDS[(k + 1) % 3], -16, y, walk=True)
g.props('rg_round_pink0', [(-17, -4), (-17, 5)]); g.props('rg_bush_pink', [(-19, 0), (-19, 3), (-15, -3), (-15, 4)]); g.props('rg_bench', [(-8, -5), (-8, 5)]); g.props('rg_lamp', [(-14, -4), (-3, -4), (-14, 4), (-3, 4)])
g.prop('rg_fountain', 9, 0)
for k, (x, y) in enumerate(((5, -3), (13, -3), (5, 3), (13, 3), (9, -3), (9, 4), (6, 0), (12, 0), (7, -2), (11, -2), (7, 2), (11, 2))): g.prop(BEDS[k % 3], x, y, walk=True)
g.props('rg_bench', [(4, 1), (14, 1)]); g.props('rg_lamp', [(3, -3), (16, -3), (3, 4), (16, 4)]); g.props('rg_young_green0', [(16, -1), (16, 3)]); g.props('roseBush', [(4, -2), (14, -2), (4, 3), (14, 3)])

# ================================================================ the parterre and the blossom walk (south)
for y in (9, 13):
    for k, x in enumerate(range(-16, -3, 2)): g.prop(BEDS[(k + y) % 3], x, y, walk=True)
g.props('roseBush', [(x, 11) for x in range(-16, -3, 2)]); g.props('whiteBlossomBush', [(x, 15) for x in range(-16, -3, 2)])
g.props('rg_bench', [(-10, 7), (-10, 16)]); g.props('rg_lamp', [(-3, 8), (-3, 14), (3, 8), (3, 14)]); g.props('rg_round_pink0', [(-16, 16), (-5, 16), (-16, 8), (-18, 12), (-18, 16), (-7, 10)]); g.props('rg_basin', [(-9, 12), (-13, 12)])
g.trees(3, 8, 18, 17, BLOSSOM, dx=3, dy=3)
g.props('rg_bench', [(5, 7), (9, 7), (13, 7)]); g.props('rg_pot_plant', [(15, 8), (15, 15)])

# ================================================================ the paved axis and the arbours: the tower fountain, seats, lamps
g.prop('rg_fountain_tower', 0, 16, walk=True); g.props('rg_bench_stone', [(-2, 14), (2, 14), (-2, 18), (2, 18)], walk=True); g.props('rg_lamp', [(-3, 15), (3, 15)], walk=True)
g.props('sWoodPagoda', [(-18, 7)], walk=True); g.props('rg_bench', [(17, 7)], walk=True); g.props('rg_lamp', [(18, 5), (16, 5)], walk=True)
g.props('rg_bench_stone', [(-19, -6)], walk=True); g.prop('rg_arch_white', 0, -4, walk=True)
for y in (0, 4, 8, 12): g.props('rg_lantern', [(-2, y), (1, y)]); g.props('rg_lamp', [(-18, -8), (-18, -6)], walk=True)

# ================================================================ outside the wall: blossom orchards, woods, flowers; the beach in the south-west
SAND = [(11, -26), (15, -24), (17, -23), (19, -22), (20, -21), (23, -19), (24, -18), (25, -17), (26, -15)]
def sand_edge(y):
    e = None
    for yy, xx in SAND:
        if y >= yy: e = xx
    return e
def water(x, y): return y >= 20 and x <= (-27 if y <= 22 else -25)
rb = random.Random(7)
for y in range(11, 27):
    e = sand_edge(y)
    if e is None: continue
    for x in range(-26, e + 1):
        if water(x, y) or water(x - 1, y) or (x, y) in g.occ or g.get(x, y) != '.': continue
        r = rb.random()
        if r < .12: g.prop(rb.choice(('rg_shells', 'rg_sea_stone', 'rg_sea_pebble')), x, y, walk=True)
        elif r < .16: g.prop(rb.choice(('rg_rock_small', 'rg_boulder', 'rg_seaweed')), x, y)
for y in range(11, 27):
    e = sand_edge(y)
    for x in range(-26, (e if e is not None else -27) + 1):
        if (x, y) not in g.occ: g.occ[(x, y)] = 'beach'
g.trees(-26, -26, 26, -22, WOOD); g.trees(-26, 22, 26, 26, WOOD); g.trees(-26, -26, -23, 26, WOOD); g.trees(23, -26, 26, 26, WOOD)
g.trees(-22, -22, 22, -21, BLOSSOM, dx=3, dy=3); g.trees(-22, 20, 22, 22, BLOSSOM, dx=3, dy=3); g.trees(-22, -20, -21, 20, BLOSSOM, dx=3, dy=3); g.trees(21, -20, 23, 20, BLOSSOM, dx=3, dy=3)
MEAD = SMALL + ['rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_pink', 'rg_tiny_white']
g.groves(-25, -25, 25, 25, WOOD, gap=1, min_area=8, styles=[('woods', WOOD), ('meadow', MEAD), ('orchard', BLOSSOM), ('meadow', MEAD)])
g.garden(-25, -25, 25, 25, every=3)
g.drift(-26, -26, 26, 26, SMALL, every=6)
g.done(dict(lim=28, hide_site_paths=True))
