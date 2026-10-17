"""Frostfall, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/t1-town.py   (writes T1.json, tools/.cache/plan-T1.png)
The story: a mountain village on the high plateau under the peaks, snowed in half the year. It grew from the miners' camp at the old mine in the east cliff; the
lane from the pass road (Route 17, along the north rim) drops into the village and runs on to the mine. Chalets with steep roofs huddle round a small square with a
well and a notice board; the lodge (the Center) and the store stand on it. Firewood is stacked against every wall, the paths are trodden through the snow, snow pines
shelter the north side. The plateau is level ground at the village's height; the rim falls away to the south. Route: the pass road link arrives at (+4..+6, -36)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(40)
# ---- snow over the plateau (the map has bare rock here), trodden paths through it
for y in range(-34, 34):                                   # the plateau under snow, rounded off at the corners
    w = 40 - max(0, abs(y) - 26) * 3
    g.rect(-w, y, w, y, 'Z')
g.lane([(4, -40), (4, -30), (0, -30), (0, -6)])                 # the lane down from the pass road
g.blob(0, -1, ["..#######..", ".#########.", "###########", "###########", "###########", ".#########.", "..#######.."], 'd')   # the square, trodden flat
g.lane([(5, -1), (14, -1), (14, 4), (24, 4), (24, 10), (30, 10)])                       # on east to the mine
g.lane([(-5, 1), (-14, 1), (-14, 8), (-22, 8)]); g.lane([(-1, 4), (-1, 14), (-8, 14)]); g.lane([(0, -18), (-12, -18), (-12, -22)])
g.lane([(4, -12), (12, -12), (12, -18)], 1, 'd'); g.lane([(-14, 1), (-14, -8), (-22, -8)], 1, 'd')

g.bld('pokeCenterWhite', -4, -4, 'center'); g.bld('martWhite', 6, -4)
H = ['chaletRed', 'cabinGreen', 'chaletRedB', 'chaletPink', 'cabinGreenWide', 'chaletRed', 'cottageGreenWide', 'cabinGreen']
homes = [(-5, -18), (-9, -18), (-4, -26), (8, -12), (11, -18), (9, -1), (12, 4), (18, 4), (22, 10), (-10, 1), (-17, 8), (-21, 8), (-5, 14), (-17, -8), (-21, -8), (-3, -30)]
for k, (x, y) in enumerate(homes): g.bld(H[k % len(H)], x, y)
g.bld('maLogCabin', 28, 10, 'house')                                                     # the mine office

P = {'T': 'snowPine', 'U': 'snowPineLarge', 'V': 'snowPineLargeB', 'D': 'snowDomeTree', 'L': 'logShort', 'F': 'frozenLog', 'K': 'rockSnowCap', 'R': 'rockGrey', 'B': 'boulderGrey',
     'o': 'jWell', 'n': 'noticeBoard', 'N': 'pokeSign', 'l': 'torchPost', 'x': 'crateWide', 'q': 'barrelDark', 'b': 'benchTeal', 'm': 'mailbox', 'C': 'maCaveBrown', 'E': 'wSignBoard'}
g.at('o', (1, 0)); g.at('n', (-4, 2)); g.at('N', (-7, -3)); g.at('b', (3, 2)); g.at('l', (-5, -2), (5, -2), (-5, 3), (5, 3), (3, -14), (15, 2), (-13, 3), (25, 7), (1, 12))
# firewood against the walls, crates outside the store
for (x, y) in homes: g.at('L', (x + 3, y - 1))

# the mine: the mouth in the east cliff, ore crates and timber at the yard
g.at('C', (32, 6)); g.at('x', (29, 11), (31, 12)); g.at('F', (27, 13), (30, 14)); g.at('q', (33, 11)); g.at('E', (29, 9))
# snow pines on the north side (shelter), boulders on the rim, a few trees in the village
for (x, y) in ((-20, -26), (-24, -22), (-16, -28), (-28, -18), (10, -28), (16, -24), (20, -20), (-30, -12), (24, -14), (-32, -2)): g.at('U' if (x + y) % 3 else 'V', (x, y)); g.at('T', (x + 3, y + 1))
g.at('D', (-8, -10), (6, -16), (-18, 4), (10, 8), (-10, 10), (18, 0))
g.at('K', (-34, 10), (30, 20), (-26, 22), (8, 24), (-12, 26)); g.at('B', (-36, 18), (34, 16), (20, 24)); g.at('E', (5, -38))

# the south of the plateau: the frozen tarn where the village skates and fishes through the ice, a lookout over the rim, the old chapel
g.lane([(-1, 14), (-1, 22), (8, 22), (8, 24)]); g.lane([(-8, 14), (-14, 14), (-14, 24)], 1)
for k, (x, y) in enumerate([(4, 22), (-11, 14), (-17, 24), (12, 26)]): g.bld(H[(k + 3) % len(H)], x, y)
g.bld('sWoodPagoda', 11, 22, 'house')
g.at('b', (14, 30), (18, 30)); g.at('l', (10, 25), (-15, 25), (2, 21)); g.at('F', (-24, 22), (-20, 26)); g.at('L', (16, 28))
for (x, y) in ((-26, 14), (-30, 22), (-24, 30), (20, 16), (26, 22), (30, 28), (-6, 30), (6, 32)): g.at('U' if (x + y) % 3 else 'V', (x, y)); g.at('D', (x + 3, y + 1))
plan.build('T1', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=42, deco=[['pond', -16, 28, 4.5, 2.5], ['pond', 20, 24, 3.5, 2]]))
