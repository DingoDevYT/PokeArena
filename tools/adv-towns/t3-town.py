"""Hallowmead, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/t3-town.py   (writes T3.json, tools/.cache/plan-T3.png)
The story: an old meadow village that grew round a ring of standing stones nobody remembers raising. The stones stand on the common at the heart of the village and
nothing is built on the common; the lanes go round it. The chapel hall faces the common from the north, the Center and the shop from the east. Thatched cottages
line the three old lanes: north to the hills (Route), north-east to the coast road, south-west down to the mill on the lake shore. Orchards and hay meadows fill
the land between the lanes. Routes: north road at x +10..+12, north-east road at (+40, -13), south-west road at (-23, +30) to the lake."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(44)
# ---- the common: open grass ringed by a dirt lane (the lanes all come to it)
g.blob(0, 0, ["......##########......",
              "...################...",
              ".####################.",
              "######################",
              "######################",
              "######################",
              "######################",
              "######################",
              "######################",
              "######################",
              ".####################.",
              "...################...",
              "......##########......"], 'd')
g.blob(0, 0, ["....############....",
              "..################..",
              ".##################.",
              ".##################.",
              ".##################.",
              ".##################.",
              ".##################.",
              "..################..",
              "....############...."], 'g')
# ---- the three old lanes, each bending where it went round a field or a stream
g.lane([(6, -6), (10, -6), (10, -18), (11, -18), (11, -44)])                       # north lane to the hills road
g.lane([(11, -6), (22, -6), (22, -10), (34, -10), (34, -13), (44, -13)])          # north-east lane to the coast road
g.lane([(-8, 5), (-14, 5), (-14, 14), (-20, 14), (-20, 24), (-23, 24), (-23, 34)]) # south-west lane to the mill and the lake
g.lane([(-10, -4), (-24, -4), (-24, -14)]); g.lane([(4, 7), (4, 18), (14, 18)]); g.lane([(-8, -6), (-8, -16), (-4, -16)])
g.lane([(-20, 24), (-32, 24)], 1); g.lane([(22, -10), (22, -22)], 1)

g.bld('pokeCenterRed', 14, -6, 'center'); g.bld('martBlue', 19, -6); g.bld('domeHall', -1, -7, 'house')
H = ['thatchHouse', 'cottageGreen', 'thatchHouseSmall', 'cottageRed', 'cottageTeal', 'thatchHouse', 'houseGreenFlat', 'cottageGreen']
homes = [(-12, -4), (-17, -4), (-21, -4), (-24, -14), (-4, -16), (14, -18), (14, -26), (14, -34), (26, -10), (30, -10), (37, -13), (22, -22),
         (-17, 14), (-24, 24), (7, 18), (11, 18), (-11, -16), (-7, -16), (-20, 14), (14, 18), (25, -22)]
for y in (-18, -26, -34): g.lane([(13, y), (14, y)], 1)
for k, (x, y) in enumerate(homes): g.bld(H[k % len(H)], x, y)
g.bld('maLogCabin', -30, 24, 'house')                                   # the mill on the lake shore

P = {'O': 'stoneRing', 'S': 'standingStoneMint', 'Y': 'standingStoneMintTall', 'T': 'roundTree', 'B': 'bigRoundTree', 'k': 'bushyOak', 'e': 'hedgeLong', 'w': 'flowerBedBlue',
     'r': 'flowerBedPink', 'b': 'benchYellow', 'l': 'lampPost', 'n': 'noticeBoard', 'N': 'pokeSign', 'm': 'mailbox', 'x': 'maHayPile', 'X': 'maHayBales', 'j': 'mScarecrow',
     'f': 'flowersWhite', 'F': 'flowersBlue', 'q': 'barrelOrange', 'z': 'seedSack', 'L': 'logShort', 'W': 'wSignBoard', 'i': 'mPicketFence', 'u': 'whiteBlossomBush'}
# the stones on the common, a bench or two, wild flowers round the stones
g.at('O', (0, 1)); g.at('S', (-6, -1), (6, -1), (-5, 4), (5, 4)); g.at('Y', (0, -3)); g.at('b', (-7, 2), (7, 2)); g.at('f', (-3, -2), (3, 3), (-2, 4)); g.at('F', (2, -2), (-4, 3))
g.at('l', (-9, -6), (9, -6), (-9, 6), (9, 6), (12, -15), (21, -8), (-15, 7), (-21, 16), (5, 12)); g.at('N', (12, -7)); g.at('n', (8, -7)); g.at('W', (12, -42), (42, -14), (-24, 32))
# cottage gardens: picket fences, beds, a tree behind
for (x, y) in homes: g.at('r' if x % 2 else 'w', (x + 2, y - 1))
for (x, y) in homes[::2]: g.at('T', (x, y - 6))
# orchards between the lanes (fruit trees in rows), hay meadows with stacks
for y in (-28, -24, -20):
    for x in range(-22, -8, 3): g.at('u' if (x + y) % 2 else 'T', (x + (y % 2), y))
for y in (24, 28):
    for x in range(6, 22, 3): g.at('T', (x, y))
g.at('x', (30, 10), (16, 10), (-34, 8)); g.at('X', (30, 0)); g.at('j', (32, 2), (-30, 6)); g.at('e', *[(x, 0) for x in range(20, 36, 2)]); g.at('e', *[(x, 12) for x in range(-36, -26, 2)])
# the mill yard: sacks, barrels, logs
g.at('z', (-27, 25), (-26, 25)); g.at('q', (-33, 25)); g.at('L', (-34, 26), (-32, 27))
# old trees on the edges of the village
g.at('B', (-30, -20), (-34, -6), (24, -30), (32, -20), (30, 20), (-8, 28), (-36, 18), (18, 32), (36, 4))
g.at('k', (-28, -28), (28, -28), (36, 12), (-12, 34))

plan.build('T3', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=48, deco=[["plot", 18, 2, 10, 6, 1], ["plot", -38, -2, 8, 6, 1], ["plot", 24, 22, 8, 5, 0], ["plot", -14, 22, 6, 4, 0]]))
