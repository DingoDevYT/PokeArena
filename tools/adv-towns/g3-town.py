"""Fernwell Park, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/g3-town.py   (writes G3.json, tools/.cache/plan-G3.png)
The story: the town grew round the great park that the Fernwell family laid out on the meadow beside the old north-south road (the Sanctuary they founded lies to the
north-west). The park is the town: a lawn with two ponds, a gravel walk round it, a bandstand in the middle. The old road became the avenue down the park's east side.
The best houses stand in a crescent along the lane that bends round the park's north side; the Center and the Mart face the avenue; the gym is the old glasshouse hall at
the park's south gate. Behind them the town filled in lane by lane: a row off the avenue to the north-east, the south-east road with its houses, a south lane of
cottages, a few fishermen's cottages on the beach to the west. Every house fronts a lane (doors face south). Routes: north and south road at x +2..+5, south-east (+40, +14)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(44)
# ---- the park (x -27..+1, y -8..+8): a gravel walk round a lawn, cross walks to the bandstand, two ponds in the quadrants
g.blob(-13, 0, ["....#########################....",
                "..#############################..",
                ".###############################.",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                "#################################",
                ".###############################.",
                "..#############################..",
                "....#########################...."], 'p')
g.blob(-13, 0, ["....#######################....",
                "..###########################..",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                ".#############################.",
                "..###########################..",
                "....#######################...."], 'g')
g.lane([(-26, 0), (0, 0)], 1, 'p'); g.lane([(-13, -7), (-13, 7)], 1, 'p')
g.blob(-13, 0, ["..###..", "#######", "#######", "#######", "..###.."], 'p')
# ---- the avenue (stone, 3 wide) and the lanes (dirt, 2 wide), each bent where the town grew round something
g.lane([(3, -44), (3, 44)], 3, 'p')
g.lane([(2, -12), (-8, -12), (-8, -14), (-24, -14), (-24, -12), (-31, -12), (-31, 6), (-35, 6)])       # the crescent round the park's north side, down to the beach
g.lane([(6, -4), (19, -4), (19, -1), (30, -1)])                                                         # the Center and Mart lane, on east past the green
g.lane([(6, -21), (14, -21), (14, -25), (28, -25)])                                                     # north-east row
g.lane([(6, 10), (22, 10), (22, 14), (44, 14)])                                                         # the south-east road (route)
g.lane([(2, 16), (-6, 16), (-6, 15), (-20, 15), (-20, 17), (-28, 17)])                                  # south lane past the gym
g.lane([(2, 27), (-4, 27), (-4, 29), (-16, 29)])                                                        # cottages further south
g.lane([(6, 26), (18, 26), (18, 30)])
# ---- buildings: door walkway tile on the lane's top row, so each house stands on the lane's north edge
g.bld('pokeCenterRed', 9, -4, 'center'); g.bld('martBlue', 15, -4); g.bld('gymRed', -13, 15)
H = ['houseRedGable', 'houseBlueGable', 'cottageGreen', 'cottageRed', 'houseGreenFlat', 'houseBlueTall', 'cottageTeal', 'houseOrangeSmall']
homes = [(-2, -12), (-5, -12),                                       # the crescent: east end
         (-11, -14), (-15, -14), (-19, -14), (-22, -14),             # the crescent's middle (two lots back from the park)
         (-28, -12),                                                 # its west end
         (23, -1), (27, -1),                                         # past the green
         (9, -21), (12, -21), (17, -25), (21, -25), (25, -25),       # north-east row
         (9, 10), (13, 10), (17, 10), (26, 14), (30, 14), (34, 14),  # south-east road
         (-3, 16), (-8, 15), (-18, 15), (-23, 17), (-26, 17),        # south lane either side of the gym
         (-1, 27), (-7, 29), (-11, 29), (-14, 29), (9, 26), (13, 26), (17, 26),   # further south
         (-38, 10)]                                         # the beach cottages
for k, (x, y) in enumerate(homes): g.bld(H[k % len(H)], x, y)
g.lane([(-38, 11), (-34, 11), (-34, 8)], 1, 'd')

P = {'T': 'roundTree', 'B': 'bigRoundTree', 'O': 'canopyTree', 'w': 'flowerBedBlue', 'r': 'flowerBedPink', 'e': 'hedgeLong', 'b': 'benchYellow', 'l': 'lampPost', 'n': 'noticeBoard',
     'N': 'pokeSign', 'V': 'sWoodPagoda', 'u': 'roseBush', 'v': 'whiteBlossomBush', 'm': 'mFlowerBushRed', 'i': 'mPicketFence', 'x': 'crateWide', 'q': 'barrelOrange',
     'R': 'maRowboat', 'f': 'flowersWhite', 'F': 'flowersBlue', 'k': 'statueDog', 'W': 'wSignBoard', 'M': 'mailbox'}
g.at('V', (-13, 1)); g.at('k', (-16, 1), (-10, 1))
g.at('T', *[(1, y) for y in range(-40, 42, 4) if not -9 < y < 9])                         # avenue trees on the west kerb
g.at('O', (-20, -4), (-6, 4), (-21, 5), (-5, -5)); g.at('B', (-25, -6), (-25, 6), (-1, -6), (-1, 6))
for x in range(-23, 0, 3): g.at('r' if x % 2 else 'w', (x, -7)); g.at('w' if x % 2 else 'r', (x, 7))     # borders along the north and south walks
g.at('b', (-17, -1), (-9, -1), (-13, -4), (-13, 5), (-23, -1), (-3, 1))
g.at('l', (-27, -1), (1, -2), (-13, -8), (-13, 9), (-27, 9), (1, 9), (4, -30), (4, 30), (4, -40), (4, 40), (6, -6), (6, 12), (6, -19), (6, 24))
g.at('u', (-26, -4), (-26, 4), (0, -4), (0, 4)); g.at('v', (-29, -1), (2, -9)); g.at('m', (-11, -5), (-15, 5))
g.at('N', (7, -5)); g.at('n', (12, -5)); g.at('W', (42, 13), (5, -42), (5, 42))
for (x, y) in homes:                                                                         # each house: a bed by the door, a mailbox, a hedge at the back
    g.at('r' if x % 2 else 'w', (x + 2, y - 1)); g.at('M', (x - 3, y - 1)); g.at('e', (x, y - 6))
# a small green between the north-east row and the Center lane, with a tree and benches
g.at('B', (12, -12), (20, -10)); g.at('b', (15, -12)); g.at('f', (17, -13), (10, -13))
# the beach: boats drawn up, crates
g.at('R', (-41, 15), (-36, 17)); g.at('x', (-39, 14)); g.at('q', (-38, 15))
# copses and wild flowers round the town
for (x, y) in ((-32, -30), (24, -36), (30, 34), (-24, 36), (36, -12), (-40, -22), (34, 4), (-32, 24), (16, 38), (-8, 38)): g.at('B', (x, y)); g.at('T', (x + 3, y + 1), (x - 2, y + 2))
g.at('f', (-34, -24), (26, -18), (32, 24), (-20, 38), (38, -2)); g.at('F', (-30, -26), (20, -38), (36, 30), (-14, 34))

plan.build('G3', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=48, deco=[["pond", -20, -3, 4.5, 2.6], ["pond", -6, 3.4, 4.5, 2.6]]))
