"""Dunereach, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/g1-town.py   (writes G1.json, tools/.cache/plan-G1.png)
The story: a desert trading post that grew round a spring. The oasis pool, with the only green ground for miles, is why the town exists. The bazaar square sits on the
dry ground east of it where the caravan tracks met: the north road, the coast road from the east gate, the south-west track. The Center and the Mart face the square; the
gym is the old caravanserai by the east gate. The old town is packed tight for shade: small flat-roofed houses shoulder to shoulder along narrow sand lanes, with the
lanes opening into the square. Newer houses straggle out along the roads. Date palms ring the pool; cactus gardens and rocks fill the corners.
Routes: the north road arrives at x +0..+5, the east road at y -1..+1, the south-west track at x -40..-38."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(46)
# ---- the oasis: green ground round the pool (the pool itself is a deco pond)
g.blob(-15, -8, ["......#########.......",
                 "...################....",
                 ".#####################.",
                 "#######################",
                 "#######################",
                 "#######################",
                 "#######################",
                 ".#####################.",
                 "..###################..",
                 "....##############.....",
                 ".......#######........."], 'g')
# ---- dry ground everywhere else in the old town (the map's grass reaches in south of the square; this is desert)
g.rect(-12, 4, 4, 22, 'a'); g.rect(-6, -3, -3, 3, 'a')
# ---- the bazaar square: cobbled, irregular (it grew stall by stall), a tan centre
g.blob(6, 2, ["...###########...",
              ".###############.",
              "#################",
              "#################",
              "#################",
              "#################",
              "#################",
              ".###############.",
              "...###########..."], 'c')
g.blob(6, 2, ["..#########..", "#############", "#############", "#############", "..#########.."], 't')
# ---- the roads in (sand dirt, 2 wide), bent where the caravan tracks bent
g.lane([(2, -3), (2, -15), (4, -15), (4, -30), (2, -30), (2, -46)])                  # north road
g.lane([(15, 0), (26, 0), (26, -2), (46, -2)])                                        # east gate road
g.lane([(-3, 4), (-6, 4), (-6, 12), (-24, 12), (-24, 16), (-38, 16), (-38, 19)])      # south-west track
# the old town's lanes (one cell): a tangle between the house rows
for pts in ([(-3, -1), (-8, -1), (-8, -16)], [(-8, -16), (-3, -16), (-3, -24)], [(5, -9), (15, -9), (15, -18)], [(10, -9), (10, -4)],
            [(15, -18), (22, -18)], [(-3, -8), (1, -8)], [(16, 3), (22, 3), (22, 10)], [(7, 7), (7, 14), (16, 14)], [(-1, 7), (-1, 11)],
            [(16, 14), (16, 22)], [(-12, 12), (-12, 22), (-20, 22)], [(27, 0), (27, 8), (34, 8)]):
    g.lane(pts, 1, 'd')

# ---- buildings (no interiors yet): the char marks the walkway tile in front of the door
g.bld('pokeCenterOrange', 0, -4, 'center'); g.bld('martWave', 10, -5); g.bld('gymTeal', 35, -3)
H = ['houseOrangeFlat', 'houseOrangeSmall', 'houseOrangeSplit', 'houseOrangeTilt', 'houseOrangeFlat', 'moundHut', 'houseOrangeSmall', 'strawHut']
# the house rows: each list is a row of doors along a lane, 3 cells apart (the sprites are 2.3 tiles wide), so the houses stand shoulder to shoulder
rows = [[(-12, -1), (-15, -1)],                                   # facing the square's west lane, by the pool
        [(-11, -16), (-14, -16)], [(-6, -24), (-9, -24)],      # north-west quarter
        [(-3, -9), (0, -16)],                                    # off the north road
        [(7, -15), (12, -15)], [(13, -9), (18, -18), (21, -18)], # north-east quarter
        [(7, -30), (10, -30), (-1, -30), (-4, -30)],             # the north road's last houses, near the edge of town
        [(19, -1), (22, -1)], [(30, -3), (40, -3)],              # the east gate road
        [(19, 3), (22, 10), (25, 10)], [(30, 8), (33, 8)],       # east quarter
        [(4, 7), (10, 14), (13, 14)], [(19, 22), (13, 22)],      # south quarter
        [(-4, 11), (-10, 12), (-15, 12), (-18, 12)], [(-15, 22), (-18, 22)],   # along the south-west track
        [(-28, 16), (-31, 16)]]
homes = [p for r in rows for p in r]
for k, (x, y) in enumerate(homes): g.bld(H[k % len(H)], x, y)

# ---- props, placed one by one
P = {'Y': 'palmTree', 'P': 'palmTreeBig', 'k': 'cactus', 'K': 'organCactus', 'f': 'cactusFlowering', 'y': 'dryTuft', 'v': 'pxStallBlue', 'S': 'pxStallPink', 'A': 'marketAwning',
     'x': 'crateWide', 'q': 'barrelOrange', 'Q': 'barrelDark', 'z': 'seedSack', 'o': 'jWell', 'b': 'benchYellow', 'l': 'lampPost', 'n': 'noticeBoard', 'N': 'pokeSign',
     'r': 'rockBrown', 'R': 'boulderBrown', 'u': 'flowerPot', 'U': 'pottedPlantTall', 'j': 'jRocks', 'm': 'maHayPile', 'w': 'wSignBoard', 'e': 'reeds', 'E': 'reedsPair'}
# palms round the oasis, reeds at the water
g.at('P', (-24, -12), (-7, -12), (-23, -3), (-9, -4), (-15, -14)); g.at('Y', (-19, -14), (-11, -14), (-26, -8), (-5, -8), (-19, -2), (-12, -3), (-21, -12))
g.at('e', (-20, -10), (-10, -10), (-14, -5)); g.at('E', (-18, -6), (-12, -11))
g.at('b', (-17, -3), (-8, -13))
# the bazaar: stalls round the square, goods stacked beside them, the well in the middle
g.at('v', (0, -1), (12, -1)); g.at('S', (0, 6), (13, 6)); g.at('A', (5, -2), (16, 3), (-2, 2)); g.at('o', (6, 2))
g.at('x', (2, -1), (14, -1), (15, 6)); g.at('q', (3, -2), (17, 5), (-1, 7)); g.at('z', (8, -2), (14, 7), (1, 7)); g.at('Q', (-3, 3)); g.at('b', (3, 5), (9, 5))
g.at('l', (-2, -3), (14, -3), (-2, 8), (14, 8), (3, -14), (5, -28), (24, -3), (-7, 9))
g.at('N', (-2, -5)); g.at('n', (6, -5)); g.at('w', (42, -3), (3, -44), (-37, 18))
# pots and shade at the doors
for (x, y) in homes: g.at('u', (x - 2, y - 1))
for (x, y) in homes[::3]: g.at('U', (x + 2, y - 1))
# cactus gardens in the corners between the house rows, palms in the yards
g.at('k', (-16, -22), (18, -24), (26, 15), (-22, 19), (24, 20), (-4, 17), (13, -27), (-21, 8))
g.at('K', (-18, -23), (20, -22), (28, 16), (-26, 21), (36, 12), (14, -33), (38, 4))
g.at('f', (-14, -21), (17, -22), (25, 17), (-24, 20), (-2, 18), (11, -26), (36, 10))
g.at('P', (24, 6), (-26, 9), (9, 18), (-18, 18)); g.at('Y', (31, 4), (-30, 10), (20, 7), (-8, 18), (19, -12), (-6, -27))
# the caravan yard behind the gym: hay, crates, a rock outcrop beyond
g.at('m', (39, -9), (42, -7)); g.at('x', (37, -10)); g.at('q', (40, -11)); g.at('R', (44, -13), (41, 6), (-42, -2)); g.at('j', (44, 9), (-40, 30), (30, -30))
g.at('r', (-30, -20), (24, -32), (38, 16))
# the desert past the edge: scattered rocks and cactus
g.at('k', (-40, -30), (-26, -38), (34, -38), (42, -24), (-44, 6), (26, 34), (-6, 40), (40, 28), (-14, 32), (10, 30))
g.at('K', (-36, -34), (38, -34), (-42, 36), (8, 42), (-30, 30)); g.at('R', (-34, -40), (30, 40), (-20, 38)); g.at('y', (-38, -24), (28, -42), (44, 20), (-10, 36), (16, 38), (-30, -10), (30, -14))

plan.build('G1', g.text(), P, blds=g.blds, extra=dict(lim=50, deco=[["pond", -15, -8, 5.5, 3.5]]))
