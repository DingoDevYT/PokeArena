"""Sprucevale, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/g2-town.py   (writes G2.json, tools/.cache/plan-G2.png)
The story: a timber town in a snowbound valley ringed by low hills and spruce forest. It grew round the sawmill on the valley floor: the log road comes down from the
northern forest (Route, north) to the mill yard, the finished timber goes out by the south road. The town street runs east-west from the west road to the mill,
with the Center, the Mart and the gym (the old mill hall) on it; log cabins and chalets for the mill crews stand along short lanes off it, with woodpiles at every door.
Timber is stacked everywhere. Routes: north road at x +14..+17, south road at x +12..+17, west road at (-46, -1..+1)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(46)
g.rect(-46, -46, 46, 46, 'Z')                                                    # the valley floor under snow (the map's bare rock reaches in here)
# ---- the town street (trodden, 3 wide) from the west road to the mill yard; the log road north and the timber road south
g.lane([(-46, -1), (-24, -1), (-24, 2), (6, 2), (6, 0), (18, 0)], 3, 'd')
g.lane([(15, -46), (15, -30), (12, -30), (12, -6)], 3, 'd'); g.lane([(14, 6), (14, 30), (13, 30), (13, 46)], 3, 'd')
# ---- the mill yard: packed ground where the roads meet
g.blob(16, 0, ["...############...", ".################.", "##################", "##################", "##################", "##################",
               "##################", ".################.", "...############..."], 'd')
# ---- the crews' lanes
g.lane([(-6, 2), (-6, -12), (-18, -12), (-18, -20)]); g.lane([(-24, 2), (-24, 14), (-34, 14)]); g.lane([(0, 5), (0, 16), (8, 16)]); g.lane([(12, -20), (2, -20), (2, -26)])
g.lane([(-14, 5), (-14, 22), (-20, 22)], 1); g.lane([(25, 4), (32, 4), (32, 14), (38, 14)])

g.bld('pokeCenterWhite', -9, 2, 'center'); g.bld('martWhite', -2, 2); g.bld('gymTealTall', 22, -4)
g.bld('sSilverWarehouse', 30, 4, 'house')                                                      # the sawmill shed
H = ['jCabinA', 'chaletRed', 'jCabinB', 'cabinGreen', 'chaletRedB', 'jCabinC', 'cabinGreenWide', 'chaletPink', 'jCabinD', 'cottageGreenWide']
homes = [(-17, 2), (-21, 2), (-28, -1), (-32, -1), (-37, -1), (-9, -12), (-13, -12), (-16, -20), (-28, 14), (-32, 14), (4, 16), (8, 16), (5, -20), (9, -20),
         (-17, 22), (35, 14), (3, -26), (-22, -20), (-4, 16)]
for k, (x, y) in enumerate(homes): g.bld(H[k % len(H)], x, y)

P = {'T': 'snowPine', 'U': 'snowPineLarge', 'V': 'snowPineLargeB', 'D': 'snowDomeTree', 'L': 'logShort', 'F': 'fallenLog', 'Y': 'frozenLog', 'K': 'rockSnowCap', 'B': 'boulderGrey',
     'n': 'noticeBoard', 'N': 'pokeSign', 'l': 'torchPost', 'x': 'crateWide', 'q': 'barrelDark', 'b': 'benchTeal', 'm': 'mailbox', 'W': 'wSignBoard', 'v': 'vanGrey', 'o': 'jWell'}
# the mill yard: log stacks in rows, a truck, crates
for x in range(9, 25, 3): g.at('F', (x, -3)); g.at('L', (x + 1, 4))
g.at('Y', (8, -2), (24, 3), (26, -2)); g.at('v', (19, 5)); g.at('x', (10, 5), (22, 5)); g.at('q', (11, 6))
# woodpiles at every door, torches along the street, the notice board
for (x, y) in homes: g.at('L', (x + 3, y - 1))
g.at('l', (-12, 1), (-4, 1), (-24, 5), (-30, -2), (3, 1), (13, -10), (13, 10), (-7, -8), (-23, 6), (1, 12)); g.at('N', (-11, 1)); g.at('n', (-6, 1)); g.at('o', (-14, 6)); g.at('b', (-16, 6))
g.at('W', (16, -44), (15, 44), (-44, -2))
# the spruce forest pressing in from the hills, pines in the town, rocks under the snow
for (x, y) in ((-40, -30), (-34, -36), (-26, -40), (-8, -38), (2, -40), (26, -36), (34, -30), (40, -22), (-42, 22), (-36, 30), (-26, 36), (-6, 34), (26, 34), (36, 28), (42, 20), (40, -8), (-42, -14)):
    g.at('U' if (x + y) % 3 else 'V', (x, y)); g.at('T', (x + 3, y + 1), (x - 2, y + 2), (x + 1, y - 3))
g.at('D', (-26, -8), (-2, -8), (20, -16), (-10, 10), (22, 14), (-30, 8), (6, 24)); g.at('K', (-36, 6), (28, 22), (-20, 30)); g.at('B', (40, 6), (-40, 6))

plan.build('G2', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=50))
