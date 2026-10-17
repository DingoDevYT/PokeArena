"""Claystone, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/g4-town.py   (writes G4.json, tools/.cache/plan-G4.png)
The story: a brick town on the clay banks between two lakes. The clay pits by the west shore made the town; the brickworks yard and its kilns stand there still.
The main street (cobbled, the old cart road from the west ford to the east road) climbs gently through the middle with terraces of red-roofed brick houses either side,
and widens into the market square where the Center, the Mart and the clock tower stand. The gym is the old kiln hall at the east end. North of the street the older
cottages face a lane along the lake shore; south of it a second street of newer terraces faces the meadows, with allotments behind.
Routes: west road at (-44, -10..-7) by the lake, east road at (+44, -1..+1). Water: the lake to the north-west and west, another to the south-west."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(46)
# ---- main street (cobbles, 3 wide) from the west ford to the east road, with the market square bulging off it
g.lane([(-46, -9), (-30, -9), (-30, -6), (-8, -6), (-8, -3), (18, -3), (18, -1), (46, -1)], 3, 'p')
g.blob(2, -9, [".################.", "##################", "##################", "##################", "##################", ".################."], 'p')
# ---- the shore lane (north) and the south street, the lanes linking them
g.lane([(-26, -20), (-14, -20), (-14, -24), (6, -24), (6, -20), (24, -20), (24, -16)])
g.lane([(-26, -20), (-26, -10)]); g.lane([(10, -20), (10, -11)]); g.lane([(24, -16), (32, -16), (32, -2)])
g.lane([(-24, 10), (-6, 10), (-6, 12), (14, 12), (14, 8), (30, 8), (30, 2)])
g.lane([(-6, -2), (-6, 10)]); g.lane([(14, 0), (14, 8)])
g.lane([(-24, 10), (-24, 22), (-10, 22)], 1, 'd')
# ---- the brickworks by the west shore: a packed dirt yard with clay pits (soil)
g.rect(-40, -2, -28, 8, 'd'); g.rect(-38, 10, -30, 15, 's'); g.rect(-44, 2, -41, 9, 's')
# ---- buildings: door walkway tiles on the street / lane top rows
g.bld('pokeCenterRed', -4, -12, 'center'); g.bld('martBlue', 8, -12); g.bld('gymRed', 36, -2)
g.bld('clockTower', 2, -12, 'house')
T = ['cottageRedWide', 'houseRedGable', 'cottageRed', 'houseOrangeSmall', 'cottageRedWide', 'houseRedGable', 'cottageRed', 'houseGreenFlat']
terr = [(-26, -6), (-22, -6), (-18, -6), (-14, -6), (-11, -6),                     # main street, north side west of the square
        (17, -3), (22, -1), (26, -1), (30, -1),                                    # east of the square
        (-22, -20), (-18, -20), (-11, -24), (-7, -24), (-3, -24), (1, -24), (14, -20), (17, -20), (21, -20),   # the shore lane
        (-21, 10), (-17, 10), (-13, 10), (-2, 12), (2, 12), (6, 12), (18, 8), (22, 8), (26, 8)]   # the south street
for k, (x, y) in enumerate(terr): g.bld(T[k % len(T)], x, y)
# the brickworks: kiln hall and sheds (scenery)
g.bld('maHallOrange', -34, -2, 'house'); pass

P = {'K': 'stoneTower', 'T': 'roundTree', 'B': 'bigRoundTree', 'w': 'flowerBedBlue', 'r': 'flowerBedPink', 'e': 'hedgeLong', 'b': 'benchYellow', 'l': 'lampPost',
     'n': 'noticeBoard', 'N': 'pokeSign', 'x': 'crateWide', 'X': 'crateWideB', 'q': 'barrelOrange', 'Q': 'barrelDark', 'z': 'seedSack', 'v': 'pxStallBlue', 'S': 'pxStallPink',
     'A': 'marketAwning', 'L': 'logShort', 'F': 'fallenLog', 'R': 'rockBrown', 'o': 'jWell', 'M': 'mailbox', 'i': 'mPicketFence', 'W': 'wSignBoard', 'f': 'flowersWhite', 'm': 'mScarecrow', 'k': 'reeds'}
# the brickworks: kiln chimneys, stacks of bricks (crates), clay pits, barrows
g.at('K', (-38, -3), (-30, -3), (-42, 0)); g.at('x', (-36, 4), (-33, 4), (-30, 4), (-36, 7)); g.at('X', (-33, 7), (-30, 7)); g.at('q', (-39, 6), (-28, 2)); g.at('L', (-40, 1), (-40, 4))
g.at('R', (-37, 13), (-31, 12), (-43, 5))
# the market square: stalls, the well, benches, lamps
g.at('v', (-4, -8)), g.at('S', (8, -8)), g.at('A', (12, -12)), g.at('o', (-6, -12)), g.at('b', (-2, -8), (6, -8)), g.at('z', (10, -8)), g.at('Q', (-6, -8))
g.at('l', (-8, -13), (12, -13), (-8, -6), (12, -6), (-26, -10), (-18, -10), (24, -4), (34, -5), (-24, 9), (10, 11), (24, 6))
g.at('N', (-6, -11)); g.at('n', (5, -14)); g.at('W', (-44, -11), (44, -2))
# terrace fronts: a bed and a mailbox, hedges at the back
for (x, y) in terr: g.at('e', (x, y - 6))
for (x, y) in terr[::2]: g.at('M', (x - 3, y - 1))
# allotments south of the south street, a few trees in the gaps, reeds on the shores
for (x0, y0) in ((-20, 16), (-12, 16), (2, 18), (16, 14)): g.rect(x0, y0, x0 + 5, y0 + 3, 's'); g.at('i', *[(x, y0 - 1) for x in range(x0, x0 + 6)])
g.at('m', (-17, 18), (5, 20))
g.at('T', (-30, -14), (-20, -14), (0, -18), (16, -14), (28, -12), (-30, 4), (34, 4), (38, -6), (-12, 4), (8, 4), (26, 4))
g.at('B', (-10, -16), (20, -26), (36, -14), (-4, 20), (24, 18), (38, 14), (-28, 26), (12, 30))
g.at('k', (-30, -28), (-36, -22), (-44, -14), (-40, 18), (-34, 24)); g.at('f', (34, -24), (40, 24), (-16, 30), (28, 30))

plan.build('G4', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=50, deco=[]))
