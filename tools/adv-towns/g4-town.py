"""Claystone, drawn by hand with the map-lab furniture (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/g4-town.py
then python3 -I tools/adv-towns/preview.py G4 out.png to see it with the real art.

The story of the place: a brick town on the clay banks between two lakes. The clay pits on the west shore made the town and the brickworks yard, its kilns and its
chimneys stand there still, just south of the main street where it comes in over the plank causeway from the west ford (Route, west). The cobbled main street runs
east into the market square, where the Center, the clock tower and the Mart face the square and the Saturday stalls stand; from its south-east corner the cobbled
street goes on past the newer houses to the kiln hall (the gym) and the east road. North of the main street the oldest cottages stand in rows facing the shore lane
that follows the north-west lake, kitchen gardens behind them; Brick Lane climbs north out of the square past terraces of red-roofed brick houses to the upper lane,
the orchards and the hay meadows on the bank between the lakes. South of the square a second street of terraces faces the meadows, with the allotments behind it
and a track down to the fishing pier on the south-west lake. Woods and reeds wall the town in. Exits: west (-48, -11) over a plank causeway on the lake, east (48, 0)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

g = kit.Town(48, 'G4')
FP = {}
# the lakes: runs of water per row (the site's ground), so nothing is planted or laid in them
WATER = ('-48:-29..2,15..48;-47:-29..-1,15..48;-46:-29..-4,18..48;-45:-29..-7,21..48;-44:-29..-7,21..48;-43:-45..-7,21..48;-42:-45..-11,21..48;-41:-45..-11,25..42;'
         '-40:-45..-11,29..35;-39:-45..-15;-38:-45..-15;-37:-48..-26;-36:-48..-26;-35:-48..-26;-34:-48..-26;-33:-48..-26;-32:-48..-26;-31:-48..-26;-30:-48..-43;-29:-48..-43;'
         '-28:-48..-43;-27:-48..-44;-26:-48..-44;-25:-48..-44;-24:-48..-48;-23:-48..-48;-22:-48..-48;-21:-48..-48;-20:-48..-48;-19:-48..-48;-18:-48..-47;-17:-48..-47;'
         '-16:-48..-47;-15:-48..-47;-14:-48..-46;-13:-48..-46;-12:-48..-46;-11:-48..-46;-10:-48..-45,48..48;-9:-48..-45,47..48;-8:-48..-45,48..48;-7:-48..-45;-6:-48..-38;'
         '-5:-48..-38;-4:-48..-38;-3:-48..-38;-2:-48..-37;-1:-48..-37;0:-48..-37;1:-48..-37;2:-48..-37;3:-48..-37;4:-48..-37;5:-48..-37;6:-48..-38;7:-48..-38;8:-48..-38;'
         '9:-48..-38;10:-48..-38;11:-48..-38;12:-48..-38;13:-48..-38;14:-48..-38;15:-46..-43;37:-48..-45;38:-48..-42;39:-48..-39;40:-48..-35;41:-48..-32;42:-48..-29;'
         '43:-46..-25,9..35;44:-46..-22,-18..35;45:-42..35;46:-42..41;47:-42..41;48:-42..41')
WET = set()
for part in WATER.split(';'):
    y, runs = part.split(':')
    for r in runs.split(','):
        a, b = r.split('..')
        for x in range(int(a), int(b) + 1): WET.add((x, int(y)))
g.claim(WET, 'water')
def pp(name, x, y):
    """a prop standing on paving or a yard (the plaza's stalls and benches, the brickworks' kilns), still never on another prop or on water"""
    cells = g.box(name, x, y)
    if not g.free(cells): return False
    g.claim(cells, name); g.pp.append((g.char(name), x, y)); return True
def pps(name, pts): return sum(pp(name, x, y) for x, y in pts)
def rr(x0, y0, x1, y1, ch, r=2):
    """a rectangle with rounded corners"""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx, dy = min(x - x0, x1 - x), min(y - y0, y1 - y)
            if dx + dy < r - 1: continue
            g.put(x, y, ch)
def field(x0, y0, x1, y1, crop, every=2):
    """a worked field; sunflowers are two tiles tall, so their rows start one row inside the soil and never hang over its edge"""
    if crop == 'rg_sunflowers':
        g.rect(x0, y0, x1, y1, 's')
        for y in range(y0 + 1, y1 + 1, 2):
            for x in range(x0, x1 + 1, 2): g.prop(crop, x, y, walk=True)
    else: g.field(x0, y0, x1, y1, crop, every=every)
RED = ['rg_house_red_a', 'rg_house_red_b', 'rg_house_red_c', 'rg_house_red_d']
BEDS = ['rg_bed_pink', 'rg_bed_yellow', 'rg_bed_white']
WOOD = ['rg_round_green0', 'rg_tall_green0', 'rg_round_teal0', 'rg_round_green1', 'rg_pine_green0', 'rg_tall_green1', 'rg_round_teal1', 'rg_tall_teal0', 'rg_pine_teal0']
ORCH = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_green1', 'rg_young_green0', 'rg_round_orange1', 'rg_young_teal0', 'rg_round_pink1']
FRUIT = ['rg_round_pink0', 'rg_round_orange0', 'rg_round_red0', 'rg_round_pink1', 'rg_round_orange1']
SMALL = ['rg_tiny_white', 'rg_tiny_pink', 'rg_tiny_blue2', 'rg_clover', 'rg_flower_pink', 'rg_flower_yellow', 'rg_tiny_white2', 'rg_clump_green', 'rg_flower_white', 'rg_clover2']

# ================================================================ roads: 2 wide paving for the main street and the east street, 1 wide dirt lanes
g.lane([(-48, -11), (-32, -11), (-32, -8), (-14, -8)], 2, 'p')                                      # the main street: from the causeway, a jog south past the brickworks gate, to the square
g.lane([(13, -5), (20, -5), (20, 0), (48, 0)], 2, 'p')                                              # the east street, to the kiln hall and the east road
g.exit(-48, -11, 'W'); g.exit(48, 0, 'E')
rr(-14, -12, 14, -4, 'p', 3); rr(-12, -11, 12, -5, 't', 2)                                          # the market square: stone kerb, tan paving
L = lambda pts: g.lane(pts, 1, 'd')
L([(-45, -22), (-33, -22), (-33, -24), (-16, -24)]); L([(-45, -22), (-45, -12)]); L([(-30, -24), (-30, -9)]); L([(-16, -24), (-16, -9)])   # the shore lane, stepping up the shore, and its cross lanes
L([(-24, -24), (-24, -31), (-5, -31), (-5, -33), (44, -33)])                                       # the upper lane, stepping up and right across to the east ring
L([(3, -33), (3, -13)])                                                                            # Brick Lane, up from the square
L([(3, -20), (44, -20)]); L([(21, -20), (21, -6)]); L([(-16, -17), (3, -17)])                                                 # Kiln Row, with a cut down to the east street
L([(30, -12), (44, -12)]); L([(30, -33), (30, -1)]); L([(44, -33), (44, -1)]); L([(44, 2), (44, 41), (40, 41)])   # Kiln Road, the east ring road
L([(12, -33), (12, -44), (19, -44)])                                                               # the bank road to the boat pier
L([(-15, -6), (-15, 30)])                                                                          # Clay Lane, along the east side of the brickworks, down to the allotments
L([(-15, 12), (44, 12)]); L([(14, -3), (14, 30)]); L([(34, 2), (34, 22)]); L([(-15, 22), (14, 22)]); L([(34, 22), (44, 22)]); L([(-26, 30), (14, 30)])
L([(-26, 9), (-26, 40)]); L([(-42, 24), (-26, 24)])                                                # the clay track down to the fishing pier, the shore lane
# ================================================================ the square: the Center, the clock tower and the Mart face it
g.building('pokeCenterRed', -7, -12, 'center'); g.rect(-7, -13, -7, -12, 'p')
g.building('clockTower', 0, -12); g.rect(0, -13, 0, -12, 'p')
g.building('martBlue', 7, -12); g.rect(7, -13, 7, -12, 'p')
pp('rg_fountain', -1, -7); pps('rg_bench', [(-5, -6), (3, -6)]); pps('rg_lamp', [(-13, -11), (13, -11), (-13, -5), (13, -6), (-4, -11), (4, -11)])
pps('rg_stall', [(-10, -5), (-6, -5), (6, -5), (10, -5)]); pp('marketAwning', 10, -9); pp('jWell', -11, -10)
pps('rg_crates', [(-12, -6), (12, -7)]); pps('rg_barrel', [(-8, -5), (8, -5)])
g.props('rg_planter_pink', [(-10, -12), (-4, -12)]); g.props('rg_planter_orange', [(4, -12), (10, -12)]); g.prop('rg_sign_board', -3, -9)
# ================================================================ north-west: the old cottages stepping up the shore, kitchen gardens
for x, n in ((-42, 'rg_house_red_a'), (-36, 'rg_house_red_b')):
    g.lot(n, x, -12, street_y=-12, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
for x, n in ((-26, 'rg_house_red_c'), (-21, 'rg_house_red_d')):
    g.lot(n, x, -9, street_y=-9, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
for x0 in (-43, -38): field(x0, -20, x0 + 3, -18, 'leafPlantB')
for x, n in ((-40, 'rg_house_wood_a'), (-36, 'rg_house_red_d')):
    g.lot(n, x, -23, street_y=-22, beds=(BEDS[x % 3], BEDS[(x + 2) % 3]))
for x, n in ((-28, 'rg_house_wood_b'), (-20, 'rg_house_red_a')):
    g.lot(n, x, -25, street_y=-24, beds=(BEDS[x % 3], BEDS[(x + 2) % 3]))
for x, y, n in ((-20, -32, 'rg_house_wood_d'), (-14, -32, 'rg_house_red_b'), (-9, -32, 'rg_house_red_c')):
    g.lot(n, x, y, street_y=-31, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
for x, y, n in ((0, -34, 'maHouseBrick'), (9, -35, 'rg_house_red_d'), (17, -34, 'rg_house_wood_b'), (27, -34, 'rg_house_red_a'), (36, -34, 'rg_house_wood_c')):
    g.lot(n, x, y, street_y=-33, beds=(BEDS[x % 3], BEDS[(x + 1) % 3]))
g.lot('rg_house_red_b', 41, -34, street_y=-33)
# Kiln Row: a terrace of red houses, the orchard behind the Mart
g.lot('rg_house_red_d', 7, -21, street_y=-20, beds=None); g.lot('rg_house_wood_d', 10, -21, street_y=-20, beds=None); g.lot('rg_house_red_b', 17, -22, street_y=-20)
g.props('rg_young_teal0', [(12, -23), (13, -21)]); g.props('rg_bush_olive', [(13, -22)]); g.props('rg_bed_white', [(12, -19)], walk=True)
g.lot('maHouseBrick', 27, -21, street_y=-20, beds=None); g.lot('rg_house_wood_b', 35, -21, street_y=-20); g.lot('rg_house_red_c', 40, -21, street_y=-20)
for k, y in enumerate(range(-18, -10, 3)):
    for x in range(10 + (k % 2), 19, 3): g.prop(FRUIT[(x + y) % 5], x, y)
for x0 in (6, 11, 16, 24, 33, 38): field(x0, -31, x0 + 3, -29, 'rg_sunflowers' if x0 in (11, 33) else 'leafPlantB')
# the east street: the inn, the gym
g.lot('inn', 17, -6, street_y=-6, beds=None)
g.lot('rg_house_wood_c', 27, -12, street_x=30); g.lot('rg_house_red_b', 35, -13, street_y=-12); g.lot('rg_house_wood_a', 40, -13, street_y=-12)
g.building('gymRed', 36, -2, 'house'); g.rect(36, -3, 36, 0, 'p'); g.props('rg_lamp', [(33, -1), (39, -1)]); g.props('rg_planter_pink', [(34, -2), (38, -2)])
# ================================================================ the brickworks
g.rect(-35, -5, -17, 9, 'd'); g.rect(-30, -5, -23, -2, '.')
g.building('maHallOrange', -27, -1)
pps('roundTower', [(-33, 0), (-20, 0)]); pps('rg_oven', [(-31, 3), (-24, 1), (-19, 6)]); pps('rg_crates', [(-22, -1), (-34, 4), (-33, 5)]); pps('rg_woodpile', [(-33, 7), (-31, 7)])
g.rect(-36, 11, -29, 16, 's')
# ================================================================ the south: terraces, the pond park, allotments
g.pond(0, 1, 4, 2)
for x, y, n in ((-12, 11, 'rg_house_red_b'), (-6, 11, 'rg_house_wood_d'), (1, 11, 'rg_house_red_a'), (8, 11, 'rg_house_wood_c')):
    g.lot(n, x, y, street_y=12, beds=None if n.endswith('d') else (BEDS[x % 3], BEDS[(x + 1) % 3]))
for x, y, n in ((19, 11, 'rg_house_red_a'), (27, 10, 'rg_house_wood_b'), (38, 11, 'rg_house_red_a'), (42, 11, 'rg_house_wood_d')):
    g.lot(n, x, y, street_y=12)
g.props('rg_young_green0', [(-9, 10), (5, 9)]); g.props('rg_bush_pink', [(-3, 11), (5, 11), (23, 11)]); g.props('rg_bench', [(-4, 10)]); g.props('rg_young_teal0', [(13, 10), (31, 10)]); g.props('rg_bed_yellow', [(-9, 13), (-3, 13)], walk=True)
for x, n in ((-12, 'rg_house_red_b'), (-5, 'rg_house_wood_c'), (2, 'rg_house_red_d'), (5, 'rg_house_wood_d'), (10, 'rg_house_red_a')):
    g.lot(n, x, 21, street_y=22, beds=None if n.endswith('d') else (BEDS[x % 3], BEDS[(x + 1) % 3]))
g.props('rg_young_green0', [(-9, 20), (-1, 19)]); g.props('rg_bush_green', [(0, 21), (7, 21)]); g.props('rg_bed_pink', [(-9, 23), (0, 23)], walk=True); g.props('rg_bench', [(-1, 20)])
g.lot('rg_house_red_b', 38, 21, street_y=22); g.lot('rg_house_wood_d', 42, 21, street_y=22)
for x0 in (-11, -3, 6): field(x0, 14, x0 + 3, 15, 'leafPlantB')
g.props('rg_young_green0', [(-6, 15), (2, 15), (11, 15)]); g.props('rg_bush_green', [(-7, 14), (1, 14), (10, 14)]); g.props('rg_scarecrow', [(-1, 15)])
g.lot('rg_house_red_b', -42, 23, street_y=24); g.lot('rg_house_wood_c', -36, 23, street_y=24); g.lot('rg_house_red_d', -31, 23, street_y=24)
# ---- the back lane behind the Center: the assembly hall and two houses, a pond green in the old gardens
g.lot('rg_dome_blue', -12, -18, street_y=-17, beds=None); g.lot('rg_house_red_b', -4, -18, street_y=-17); g.props('rg_young_green0', [(1, -19)]); g.props('rg_bush_pink', [(2, -18)])
g.pond(-22, -19, 3, 2); g.props('rg_bench', [(-26, -15), (-18, -15)]); g.props('rg_bed_pink', [(-24, -14), (-20, -14)], walk=True)
# ---- the plaza in more detail: a cobbled medallion round the fountain, beds and trees on the paving, a row of cones along the kerb
rr(-5, -10, 3, -5, 'p', 3)
pps('rg_cone_green', [(-12, -10), (12, -10), (-12, -6), (12, -5), (-9, -11), (9, -11)]); pps('rg_planter_white', [(-9, -4), (9, -4), (-2, -11), (2, -11)])
pps('rg_bed_pink', [(-8, -9), (6, -9)]); pps('rg_bed_yellow', [(-8, -7), (6, -7)]); pps('rg_bed_white', [(-8, -8), (6, -8)]); pp('rg_sign_small', 5, -10)
# ---- the south: allotments, orchard, hay, the windmill
for x0 in (-13, -8, -3, 2, 7): field(x0, 23, x0 + 3, 25, 'leafPlantB' if x0 % 2 else 'rg_sunflowers')
g.props('rg_hut_round', [(-10, 28), (3, 28)]); g.props('rg_scarecrow', [(-5, 28), (11, 28)]); g.props('rg_barrel_water', [(-1, 28), (8, 28)])
g.trees(-14, 33, 13, 41, ORCH, dx=3, dy=3, seed=21)
for x0, y0 in ((16, 13), (22, 13), (28, 13), (16, 19), (28, 19), (16, 24), (22, 24), (28, 24)): field(x0, y0, x0 + 4, y0 + 2, 'rg_sunflowers' if (x0 + y0) % 3 == 0 else 'leafPlantB')
pp('jWell', 24, 22); g.props('rg_hut_round', [(21, 18), (27, 18)]); g.props('rg_scarecrow', [(24, 17), (26, 28)])
field(17, 32, 31, 39, 'rg_pumpkin', every=2); g.props('rg_scarecrow', [(24, 41)]); g.props('maHayBales', [(15, 41), (32, 41)])
field(36, 14, 38, 15, 'leafPlantB'); field(41, 14, 43, 15, 'rg_sunflowers')
g.plot(36, 24, 7, 6, 1); g.prop('maWindmill', 40, 40); g.props('maHayBales', [(37, 31), (44, 34)]); g.props('rg_scarecrow', [(36, 32)])
# ---- the south-west shore: fishermen's cottages and net racks, allotments behind, the clay pits
for x0 in (-44, -38, -32): field(x0, 26, x0 + 4, 28, 'leafPlantB' if x0 % 2 else 'rg_sunflowers')
for x0 in (-44, -38, -32): field(x0, 32, x0 + 4, 34, 'leafPlantB')
g.props('rg_hut_round', [(-41, 31), (-35, 31), (-29, 31)]); g.props('rg_crates', [(-31, 37), (-29, 37)]); g.props('rg_barrel', [(-33, 37), (-28, 38)]); g.props('rg_woodpile', [(-35, 37)])
for x0, y0 in ((-24, 10), (-24, 14), (-24, 26)): field(x0, y0, x0 + 4, y0 + 2, 'leafPlantB')
g.lot('rg_house_red_b', -21, 24, street_x=-26); g.props('rg_hut_round', [(-19, 19), (-17, 29)])
g.props('maHayPile', [(-33, 18)]); g.props('rg_woodpile', [(-28, 12), (-28, 14)])
# ---- the bank between the lakes: orchard rows either side of the bank road, hay, the boathouse and the pier
g.lot('maLogCabin', 9, -42, street_x=12, beds=None); 
g.trees(-4, -47, 10, -38, FRUIT, dx=3, dy=3, seed=31); g.trees(14, -47, 20, -38, FRUIT, dx=3, dy=3, seed=32)
g.props('maHayBales', [(15, -37)]); g.props('rg_woodpile', [(6, -38)]); g.props('rg_barrel', [(11, -45), (13, -45)])
rr(17, -45, 20, -42, 't', 1); pps('rg_crates', [(17, -46), (20, -43)]); pps('rg_barrel_water', [(20, -46)]); pps('rg_bench', [(19, -42)]); pps('rg_lamp', [(16, -45)])      # the boat landing at the end of the bank road
rr(-28, 40, -24, 42, 't', 1); pps('rg_bench', [(-27, 42)]); pps('rg_barrel', [(-24, 41)]); pps('rg_crates', [(-28, 41)]); pps('rg_lamp', [(-25, 40)])   # the fishing landing at the end of the clay track
# ---- the brickworks yard: stacks of bricks in rows, kilns and their fuel, the digger, a fence round it
pps('rg_crates', [(-34, 6), (-32, 6), (-30, 6), (-34, 8), (-32, 8), (-30, 8), (-25, 7), (-23, 7), (-21, 8)]); pps('rg_crates2', [(-28, 7), (-19, 3)]); pps('crateWide', [(-34, 3), (-18, 1)])
pps('bulldozer', [(-22, 5)]); pps('dirtMound', [(-35, 2), (-18, 8), (-25, 4)]); pps('rg_barrel_water', [(-28, 3), (-18, 6)]); pps('rg_logs', [(-33, -2), (-20, 3)])
pps('stoneTower', [(-30, 2), (-26, 3)]); pps('rg_lamp', [(-29, -6), (-21, -6), (-36, 3)])
for x in range(-35, -16): pp('mPicketFence', x, -6)
for y in range(-5, 10, 1): pp('mPicketFence', -36, y)
for y in range(-5, 10): pp('mPicketFence', -16, y) if y not in (-1, 0, 1, 2) else None
for x in range(-35, -26): pp('mPicketFence', x, 10)
# ---- the pond park: benches and flowers round the pond, trees and lamps
g.props('rg_bench', [(-9, 1), (9, 1), (-9, -1), (9, -1)]); g.props('rg_young_green0', [(-12, 0), (12, 0)]); g.props('rg_young_teal0', [(-12, 4), (12, 4)])
g.props('rg_bed_pink', [(-9, 3), (9, 3)], walk=True); g.props('rg_bed_yellow', [(-7, 4), (7, 4)], walk=True); g.props('rg_lamp', [(-8, -2), (8, -2), (-8, 5), (8, 5)])
g.props('rg_bush_green', [(-4, 6), (4, 6), (0, 6)]); g.props('rg_sign_small', [(0, -2)])
# ---- lamps along the streets
g.props('rg_lamp', [(-36, -9), (26, 2), (32, 2), (40, 2), (46, 2), (24, -1), (28, -1), (-36, -13)])
for x in range(-44, -34): g.prop('mPicketFence', x, -21)
# ---- the clay pits: puddles and spoil heaps, the digger's tracks; the corner market and the kiln gardens
g.props('rg_puddle', [(-34, 12), (-32, 14), (-30, 12), (-35, 15)], walk=True); g.props('dirtMound', [(-33, 13), (-30, 15)]); g.props('rg_boulder', [(-36, 16)]); g.props('rg_logs', [(-29, 10)])
rr(15, -2, 19, 1, 't', 1); pps('rg_bench', [(17, -1)]); pps('jWell', [(15, -1)]); pps('rg_lamp', [(19, -2)]); g.props('rg_bed_pink', [(16, 1), (18, 1)], walk=True)
g.trees(32, -11, 43, -8, FRUIT, dx=3, dy=3, seed=51); g.trees(23, -19, 29, -10, ORCH, dx=3, dy=3, seed=52); g.trees(-46, 16, -28, 18, WOOD, seed=53)
g.props('wSignBoard', [(-43, -9), (46, 2)]); g.props('rg_planter_pink', [(-43, -13)])
# ---- small yards in the corners that were left bare: a young tree, a bush, a bed, now and then a bench
def nook(x, y, bench=False):
    g.prop('rg_young_teal0' if (x + y) % 2 else 'rg_young_green0', x, y); g.prop('rg_bush_pink' if x % 2 else 'rg_bush_olive', x + 2, y + 1); g.prop(BEDS[(x + y) % 3], x - 2, y + 2, walk=True)
    if bench: g.prop('rg_bench', x + 1, y + 3)
for x, y, b in ((-32, -19, False), (-3, -15, False), (37, 3, True), (-17, 26, False), (-39, 36, False), (-45, 46, False)): nook(x, y, b)
# ---- tree belts and woods round the edge
WOODS = ('woods', WOOD)
g.trees(-48, -48, -30, -42, WOOD, seed=41); g.trees(-6, -48, 22, -45, WOOD, seed=42); g.trees(45, -47, 48, 43, WOOD, seed=43)
g.trees(36, 42, 48, 48, WOOD, seed=44); g.trees(-28, 41, 8, 44, WOOD, seed=45); g.trees(-48, 36, -44, 42, WOOD, seed=46)
# ---- the shore: reeds and stones on the banks of the lakes
import random as _r; _rs = _r.Random(77)
for (x, y) in sorted(WET):
    if -48 <= x <= 48 and -48 <= y <= 48 and _rs.random() < .12:
        for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0)):
            q = (x + 2 * dx, y + 2 * dy)          # two tiles inland: the generator re-traces the shores, so nothing stands right on the edge
            if q not in WET and (x + dx, y + dy) not in WET and q not in g.occ and g.get(*q) == '.':
                pp(_rs.choice(['rg_weeds', 'rg_rock_grey_small', 'rg_clump_green', 'rg_tiny_blue2']), *q); break
# ================================================================ woods round the edge, then fill
g.dress()
g.groves(-48, -48, 48, 48, WOOD, gap=1, min_area=8, styles=[('woods', WOOD), ('woods', WOOD), ('meadow', SMALL), ('orchard', FRUIT), ('woods', WOOD)])
g.garden(-48, -48, 48, 48, every=3)
g.drift(-48, -48, 48, 48, SMALL, every=6)
g.done(dict(lim=50, hide_site_paths=True, boards=[[-48, -11, -45, -10]]))
