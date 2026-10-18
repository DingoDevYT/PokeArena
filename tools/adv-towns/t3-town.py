"""Hallowmead, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/t3-town.py
then python3 -I tools/adv-towns/preview.py T3 out.png to see it with the real art.

The story of the place: an old meadow village that grew round a ring of standing stones nobody remembers raising. The stones stand on the common at the heart of the
village and nothing is built on the common; a lane goes round it and the houses stand back along the lane. The chapel hall faces the common from the north, the Center and
the shop from the east, along the coast lane. Thatched cottages line the three old lanes: north to the hills (Route, north), north-east and then north to the coast road, and
south-west down past the mill on the lake shore to the plank bridge over the river, where the south road and the west road come in. Orchards, hay meadows and kitchen gardens fill
the land between the lanes; the headland to the south runs down to the beach. Exits: north (11, -46), east (46, -42), south (-22, 46) and west (-46, 44),
the last two beyond the river, which the south-west lane crosses on a plank bridge."""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(46, 'T3')
# the river, the lake and the sea (runs of water per row of the site's ground), and the beach: nothing is planted or laid in them
WATER = ('-25:46..46;-24:45..46;-23:46..46;20:-46..-44;21:-46..-40;22:-46..-36;23:-46..-33;24:-46..-29;25:-46..-26;26:-46..-26;27:-46..-26;28:-40..-22,46..46;29:-37..-22,39..46;'
         '30:-34..-22,36..46;31:-31..-22,36..46;32:-28..-19,33..46;33:-25..-16,33..46;34:-25..-16,29..46;35:-25..-16,29..46;36:-22..-16,29..46;37:-19..-13,26..46;38:-19..-10,26..46;'
         '39:-19..-10,23..46;40:-19..-10,23..46;41:-16..-6,19..46;42:-16..-3,19..46;43:-16..0,19..46;44:-13..3,6..46;45:-10..46;46:-10..46')
SAND = ('22:42..46;23:40..46;24:39..46;25:38..46;26:36..46;27:35..46;28:34..45;29:33..38;30:31..35;31:30..35;32:30..32;33:28..32;34:27..28;35:26..28;36:25..28;37:23..25;38:22..25;'
        '39:20..22;40:18..22;41:15..18;42:12..18;43:8..18')
def runs(text):
    out = set()
    for part in text.split(';'):
        y, rs = part.split(':')
        for r in rs.split(','):
            a, b = r.split('..')
            for x in range(int(a), int(b) + 1): out.add((x, int(y)))
    return out
WET = runs(WATER); BEACH = runs(SAND) - WET
g.claim(WET, 'water'); g.claim(BEACH, 'beach')
def pp(name, x, y):
    """a prop standing where the kit would refuse it (on paving, a yard): still never on another prop or on water"""
    cells = g.box(name, x, y)
    if not g.free(cells): return False
    g.claim(cells, name); g.pp.append((g.char(name), x, y)); return True
def pps(name, pts): return sum(pp(name, x, y) for x, y in pts)
def bp(name, x, y):
    """a prop on the beach"""
    cells = g.box(name, x, y)
    if any(c in g.occ and g.occ[c] != 'beach' for c in cells): return False
    for c in cells: g.occ[c] = name
    g.pp.append((g.char(name), x, y)); return True
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
THATCH = ['rg_straw', 'thatchHouse', 'rg_straw2', 'sThatchHouse', 'thatchHouseSmall', 'sThatchHouseB']
GREEN = ['cottageGreen', 'cottageTeal', 'cottageGreenWide', 'houseGreenFlat', 'cottageRed']
TIMBER = ['rg_house_wood_d', 'rg_house_wood_c', 'rg_house_wood_b']
def home(k, x, y, **kw):
    kw.setdefault('beds', (BEDS[k % 3], BEDS[(k + 1) % 3]))
    g.lot(THATCH[k % len(THATCH)] if k % 3 != 2 else (GREEN[(k // 3) % len(GREEN)] if k % 6 != 5 else TIMBER[(k // 6) % 3]), x, y, **kw)
def rr(x0, y0, x1, y1, ch, r=2):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if min(x - x0, x1 - x) + min(y - y0, y1 - y) < r - 1: continue
            g.put(x, y, ch)
def paddock(x0, y0, x1, y1, gate):
    for x in range(x0 + 1, x1, 2):
        pp('fenceRail', x, y0)
        if abs(x - gate) > 1: pp('fenceRail', x, y1)
    for y in range(y0 + 1, y1): pp('wLogFence', x0, y); pp('wLogFence', x1, y)
L = lambda pts: g.lane(pts, 1, 'd')

# ================================================================ roads: 2 wide dirt for the three old lanes, 1 wide lanes
g.lane([(11, -46), (11, -32), (15, -32), (15, -6), (26, -6), (26, -20), (36, -20), (36, -42), (46, -42)], 2, 'd')   # the north road, then the coast lane (north-east, then north again)
g.lane([(-11, 6), (-14, 6), (-14, 14), (-21, 14), (-21, 38), (-22, 38), (-22, 46)], 2, 'd')                         # the south-west lane: past the mill to the bridge, on to the south road
g.lane([(-46, 44), (-22, 44)], 2, 'd')                                                                              # the west road, beyond the river
g.exit(11, -46, 'N'); g.exit(46, -42, 'E'); g.exit(-22, 46, 'S'); g.exit(-46, 44, 'W')
L([(-10, -6), (10, -6), (10, 6), (-10, 6), (-10, -6)]); L([(10, -6), (14, -6)])                                       # the lane round the common
L([(7, -6), (7, -30)]); L([(7, -26), (14, -26)])                                                                    # Chapel Lane, up to the north road
L([(-10, 0), (-24, 0), (-24, -30), (7, -30)])                                                                       # the west lane, round the old gardens
L([(10, 3), (40, 3)]); L([(27, 3), (27, -4)])                                                                       # the east lane, out to the hay barn
L([(0, 6), (0, 26), (17, 26)]); L([(0, 26), (0, 40)])                                                               # the south lane, down the headland to the shore
L([(37, 3), (37, 22), (30, 22)])                                                                                   # the fold lane, south from the east lane
L([(-21, 23), (-27, 23)])                                                                                           # the mill lane
L([(-24, -12), (-38, -12), (-38, -3)]); L([(-24, -30), (-24, -44), (-12, -44)])                                     # the farm lane, the hill track
# ================================================================ the common: the ring of stones, the wild meadow, nothing built
g.prop('stoneRing', 0, 1)
import math
for k in range(16):                                                                                                  # the outer ring of standing stones
    a = 2 * math.pi * k / 16 + .2; g.prop('standingStoneMintTall' if k % 2 else 'standingStoneMint', round(7.4 * math.cos(a)), round(.6 + 4 * math.sin(a)))
for k in range(8):                                                                                                   # the inner ring, round the stone bed
    a = 2 * math.pi * k / 8 + .5; g.prop('standingStoneMintTall' if k % 2 else 'standingStoneMint', round(3.6 * math.cos(a)), round(1 + 2.2 * math.sin(a)))
g.props('rg_post_stone', [(-5, -3), (5, -3), (0, 5)]); g.props('rg_cairn', [(-8, 3), (8, 3)]); g.props('rg_rock_grassy', [(-3, -4), (4, 5), (-7, -1)]); g.props('rg_mound_grass', [(7, -1), (-6, 4)])
g.props('rg_bench_stone', [(-8, -4), (8, -4), (-8, 5), (8, 5)])
g.drift(-9, -5, 9, 5, SMALL, every=2, seed=5)
g.claim([(x, y) for x in range(-9, 10) for y in range(-5, 6) if (x, y) not in g.occ], 'common')
g.props('rg_lamp', [(-11, -7), (11, -7), (-11, 7), (11, 7)])
# ================================================================ round the common: the chapel hall, cottages, the tavern
g.lot('domeHall', -3, -7, street_y=-6, beds=None); g.props('rg_planter_pink', [(-6, -7)]); g.props('rg_planter_orange', [(0, -7)])
home(0, -9, -7, street_y=-6); home(1, 3, -7, street_y=-6)
g.lot('tavern', 18, 2, street_y=3, beds=None, extras=[('rg_barrel', 3, -1), ('rg_crates', -3, -1), ('rg_table', 3, 1)])
# ================================================================ the coast lane: the Center and the shop
g.building('pokeCenterRed', 19, -7, 'center'); g.rect(19, -8, 19, -7, 'd'); g.building('martBlue', 23, -7); g.rect(23, -8, 23, -7, 'd')
g.props('rg_lamp', [(17, -7), (21, -7), (25, -7)]); g.props('rg_planter_pink', [(17, -8), (21, -8)]); g.prop('rg_sign_board', 21, -4)
for k, x in enumerate((13, 24, 31, 35)): home(k + 4, x, 2, street_y=3)
g.lot('thatchBarn', 40, 2, street_y=3, beds=None, extras=[('maHayBales', -5, 0), ('maHayPile', 5, 0)])
# ================================================================ the west lane and the old gardens
for k, x in enumerate((-14, -19)): home(k + 8, x, -1, street_y=0)
for k, y in enumerate((-9, -17, -25)): home(k + 10, -21, y, street_x=-24)
for k, x in enumerate((-15, -9, -3, 3)): home(k + 13, x, -31, street_y=-30)
for k, y in enumerate((-9, -19, -27)): home(k + 17, -27, y, street_x=-24)
g.lot('thatchBarn', -33, -13, street_y=-12, beds=None, extras=[('maHayBales', 5, -1), ('rg_barrel_water', -3, 0)])
home(20, -35, -4, street_x=-38); home(21, -41, -4, street_x=-38)
home(22, -21, -39, street_x=-24); home(23, -27, -36, street_x=-24); home(24, -27, -41, street_x=-24)
# ================================================================ the north road, Chapel Lane
for k, y in enumerate((-40, -33)): home(k + 25, 8, y, street_x=11)
for k, y in enumerate((-41, -35)): home(k + 27, 15, y, street_x=12)
for k, y in enumerate((-16, -23)): home(k + 29, 4, y, street_x=7); home(k + 31, 10, y + 2, street_x=7)
for k, y in enumerate((-27, -19)): home(k + 33, 19, y, street_x=16)
# ================================================================ the coast lane, north-east
home(36, 23, -16, street_x=26); home(36, 30, -14, street_x=27); home(37, 30, -8, street_x=27); home(38, 30, -21, street_y=-20)
for k, y in enumerate((-26, -33, -38)): home(k + 39, 33, y, street_x=36)
for k, y in enumerate((-26, -33)): home(k + 42, 40, y, street_x=37)
# ================================================================ the south lane and the headland
for k, y in enumerate((11, 18, 25)): home(k + 44, -3, y, street_x=0)
for k, y in enumerate((13, 20)): home(k + 47, 3, y, street_x=0)
g.lot('thatchBarn', 17, 26, street_y=26, beds=None, extras=[('maHayBales', 5, 0), ('maHayPile', -4, 0)])
for k, y in enumerate((31, 37)): home(k + 55, -3, y, street_x=0)
home(57, 3, 32, street_x=0); g.lot('rg_hut_round', 4, 40, street_x=0, beds=None)
for k, y in enumerate((10, 17)): home(k + 58, 34, y, street_x=37)
for k, y in enumerate((9, 16)): home(k + 60, 40, y, street_x=37)
g.lot('thatchBarn', 30, 22, street_y=22, beds=None, extras=[('maHayBales', -5, 0)])
# ================================================================ the mill and the bridge
g.building('maLogCabin', -27, 23, 'house'); g.props('rg_woodpile', [(-23, 21), (-31, 22)]); g.props('rg_barrel', [(-24, 22)]); g.props('rg_crates', [(-23, 24)]); g.props('rg_logs', [(-30, 22)])
for k, x in enumerate((-40, -33, -27)): home(k + 49, x, 43, street_y=44)
home(52, -24, 19, street_x=-21); home(53, -17, 21, street_x=-20); home(54, -17, 28, street_x=-20)
# ================================================================ hay meadows, cabbage plots, orchards between the lanes
g.plot(-25, 4, 4, 4, 0); g.plot(28, 24, 4, 3, 1); g.plot(-39, -29, 8, 5, 1); g.plot(-45, -22, 7, 5, 1); g.plot(21, -45, 9, 5, 1); g.plot(22, -35, 8, 4, 1); g.plot(38, -17, 8, 6, 1); g.plot(18, 12, 9, 6, 1); g.plot(27, 6, 4, 4, 0); g.plot(-44, 0, 7, 3, 0); g.plot(30, -3, 8, 3, 0) if False else None
g.trees(-3, -27, 1, -13, FRUIT, dx=3, dy=3, seed=3); g.trees(-20, -45, -9, -34, FRUIT, dx=3, dy=3, seed=9); g.trees(-8, -46, 4, -34, FRUIT, dx=3, dy=3, seed=10)
g.trees(-44, 4, -28, 16, FRUIT, dx=3, dy=3, seed=7); g.trees(22, -40, 30, -37, FRUIT, dx=3, dy=3, seed=11); g.trees(-8, 29, 12, 38, FRUIT, dx=3, dy=3, seed=12); g.trees(25, -30, 34, -23, FRUIT, dx=3, dy=3, seed=13); g.trees(20, 28, 27, 36, FRUIT, dx=3, dy=3, seed=16); g.trees(-34, -3, -29, 2, FRUIT, dx=3, dy=3, seed=17); g.trees(34, -11, 40, -6, FRUIT, dx=3, dy=3, seed=18); g.props('standingStoneMint', [(19, 33), (21, 35)]); g.props('standingStoneMintTall', [(20, 37), (23, 39)]); g.trees(-36, -20, -28, -14, FRUIT, dx=3, dy=3, seed=14); g.trees(-46, -12, -40, -3, FRUIT, dx=3, dy=3, seed=15)
g.pond(-11, -21, 4, 3); g.props('rg_bench', [(-15, -17), (-7, -17)])
# ---- the market green by the Center and the wash green on the south-west lane
rr(8, -12, 14, -7, 't', 2); pps('rg_stall', [(10, -9), (13, -9)]); pps('rg_crates', [(9, -11)]); pps('rg_barrel', [(14, -11)]); pps('rg_pumpkin', [(11, -8), (12, -8)]); pps('rg_bench', [(11, -11)]); pps('rg_lamp', [(8, -12)])
rr(-19, 8, -15, 12, 't', 2); pps('jWell', [(-17, 10)]); pps('rg_bench', [(-18, 12)]); pps('rg_lamp', [(-19, 8)]); g.props('rg_planter_pink', [(-16, 8)])
# ---- paddocks, wells, scarecrows, hay by the plots
paddock(38, -3, 45, 0, 41); g.props('maHayBales', [(40, -2)]); paddock(21, 22, 26, 25, 23); g.props('maHayPile', [(23, 24)])
g.props('jWell', [(12, 8), (-23, 12)]); g.props('rg_scarecrow', [(-36, -22), (-41, -29), (24, -42), (24, -36), (42, -11), (33, 12), (22, 18), (-41, 4)])
g.props('maHayBales', [(-39, -30), (-31, -27), (20, -44), (46, -16), (21, 11), (37, 11)]); g.props('rg_sunflowers', [(-8, 30), (-6, 30), (-4, 30), (16, 33), (18, 33)])
g.props('rg_barrel_water', [(-24, 12), (-9, -8), (13, -3)]); g.props('rg_lamp', [(-8, -8), (5, -8), (-12, 0), (14, 4), (-1, 8), (36, 4), (-22, 15)])
# ---- the lake shore by the mill: a jetty, rafts, reeds; the beach: shells and stones
for x, y in ((-31, 26), (-34, 24)): g.pp.append((g.char('rg_raft'), x, y))
g.pond(-38, -37, 5, 3); g.props('rg_bench', [(-43, -35), (-33, -35)]); g.props('standingStoneMintTall', [(-45, -32), (-30, -41)])
import random as _r; _rs = _r.Random(66)
for (x, y) in sorted(BEACH):
    if _rs.random() < .08: bp(_rs.choice(['rg_shells', 'rg_sea_stone', 'rg_sea_pebble', 'shell', 'rg_shells']), x, y)
for (x, y) in sorted(WET):
    if -46 <= x <= 46 and -46 <= y <= 46 and _rs.random() < .1:
        for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0)):
            q = (x + dx, y + dy)
            if q not in WET and q not in g.occ and g.get(*q) == '.': pp(_rs.choice(['reeds', 'reedsOlive', 'reedsPair', 'rg_weeds']), *q); break
# ---- tree belts
g.trees(-46, -46, 46, -44, WOOD, seed=41); g.trees(-46, -46, -42, 20, WOOD, seed=42); g.trees(43, -46, 46, 20, WOOD, seed=43); g.trees(-46, 36, -40, 42, WOOD, seed=44)
# ---- the arch on the hill track, standing stones on the pastures
pp('rg_arch_wood', -12, -43); g.props('standingStoneMint', [(-20, -46), (-8, -40), (-31, -43)]); g.props('standingStoneMintTall', [(-34, -40)])
g.dress()
g.groves(-46, -46, 46, 46, WOOD, gap=1, min_area=8, styles=[('woods', WOOD), ('meadow', SMALL), ('woods', WOOD), ('meadow', SMALL), ('woods', WOOD)])
g.garden(-46, -46, 46, 46, every=3)
g.drift(-46, -46, 46, 46, SMALL, every=6)
g.done(dict(lim=48, hide_site_paths=True, boards=[[-21, 32, -20, 36], [-29, 24, -27, 25]]))
