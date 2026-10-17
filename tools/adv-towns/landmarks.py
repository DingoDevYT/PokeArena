"""The three landmarks without a hand layout yet, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/landmarks.py   (writes L1.json, L2.json, L3.json)
L1 Statue of Umbra: an old stone tower on the dunes above the north-west sea, reached by a sand track; a ring of standing stones and wind-worn rocks round it, nothing else.
L2 Fernwell Sanctuary: the temple the Fernwell family founded in a walled garden on the meadow; a paved approach with lamps, rose beds and blossom, a pond, a gate house.
L3 Pokemon League: the castle on the north cape, approached up a grand paved avenue between towers and torches, a courtyard before its gate, the sea behind it."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

P = {'S': 'standingStoneMint', 'Y': 'standingStoneMintTall', 'R': 'rockBrown', 'B': 'bigRockMint', 'M': 'maBoulderMoss', 'y': 'dryTuft', 'T': 'roundTree', 'O': 'canopyTree',
     'u': 'roseBush', 'v': 'whiteBlossomBush', 'l': 'lampPost', 'L': 'torchPost', 'k': 'statueDog', 'b': 'benchYellow', 'e': 'hedgeLong', 'w': 'flowerBedBlue', 'r': 'flowerBedPink',
     'W': 'wSignBoard', 'G': 'stoneGateStack', 'K': 'stoneTower', 'U': 'snowPineLarge', 'D': 'snowDomeTree', 'f': 'flowersWhite'}

# ---- L1 Statue of Umbra
g = plan.Grid(24)
g.lane([(1, 24), (1, 14), (-2, 14), (-2, 6)], 2, 'a')                                  # the sand track up from the road
g.blob(0, 0, ["....#######....", "..###########..", ".#############.", "###############", "###############", "###############", "###############",
              "###############", ".#############.", "..###########..", "....#######...."], 'p')   # the worn stone floor round the tower
g.blob(0, 0, ["..#####..", ".#######.", "#########", "#########", "#########", ".#######.", "..#####.."], 't')
g.at('K', (0, -1))
g.at('Y', (-6, -4), (6, -4), (-7, 3), (7, 3), (0, -7), (0, 7)); g.at('S', (-4, -6), (4, -6), (-4, 6), (4, 6))
g.at('B', (-12, -8), (11, -10), (-14, 6), (13, 8), (-8, 12), (9, 14)); g.at('R', (-16, -2), (15, 0), (-10, -14), (6, -16), (16, 14), (-18, 10))
g.at('y', (-9, -2), (9, 1), (-3, 10), (5, -11), (-11, 8), (12, -5), (-6, 16), (7, 18), (-14, -12)); g.at('W', (3, 20))
plan.build('L1', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=26, noconnect=True))

# ---- L2 Fernwell Sanctuary
g = plan.Grid(26)
g.rect(-14, -16, 14, 10, 'g')                                                           # the garden inside the wall
g.lane([(-1, -26), (-1, -14), (9, -14), (9, 1), (4, 1)], 3, 'p')                       # the approach from the north road, round the temple to its front
g.blob(0, 2, ["..###########..", ".#############.", "###############", "###############", ".#############.", "..###########.."], 'p')   # the temple court
g.lane([(-12, 7), (12, 7)], 1, 'p')
g.bld('goldTemple', 0, -1, 'house')
for x in range(-14, 15, 2): g.at('e', (x, -17)); g.at('e', (x, 11))                  # the garden wall (hedge)
for y in range(-15, 11, 2): g.at('e', (-15, y)); g.at('e', (15, y))
g.at('G', (0, -18))                                                                     # the gate house over the approach
g.at('l', (-3, -20), (3, -20), (7, -12), (11, -6), (7, 0), (-7, 0)); g.at('k', (-4, 1), (4, 1))
for x in (-11, -8, -5, 5, 8, 11): g.at('u', (x, 9)); g.at('r' if x % 2 else 'w', (x, 5))
for y in (-12, -9, -6): g.at('v', (-12, y)); g.at('v', (13, y))
g.at('O', (-11, -13), (11, -13), (-12, 7), (12, 7)); g.at('T', (-7, -14), (7, -14)); g.at('b', (-6, 4), (6, 4), (-10, 7), (10, 7))
g.at('T', (-20, -10), (20, -6), (-22, 8), (18, 16), (-10, 18), (8, 20)); g.at('f', (-18, 2), (19, -16), (-6, 16), (10, 14)); g.at('W', (2, -24))
plan.build('L2', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=28, deco=[["pond", -9, -9, 3, 1.6]]))

# ---- L3 Pokemon League
g = plan.Grid(26)
g.lane([(-1, 26), (-1, 4)], 3, 'p')                                                     # the grand avenue up the cape
g.blob(0, 0, ["....###########....", "..###############..", ".#################.", "###################", "###################", "###################",
              "###################", ".#################.", "..###############..", "....###########...."], 'p')   # the courtyard before the gate
g.blob(0, 0, ["..#########..", ".###########.", "#############", "#############", "#############", ".###########.", "..#########.."], 't')
g.bld('castle', 0, -5, 'house')
g.at('K', (-10, -2), (10, -2)); g.at('K', (-8, 10), (8, 10))                           # gate towers and the towers at the avenue foot
for y in range(6, 25, 3): g.at('L', (-4, y)); g.at('L', (4, y))
g.at('k', (-3, 1), (3, 1)); g.at('L', (-7, -3), (7, -3), (-7, 4), (7, 4))
g.at('U', (-16, -8), (16, -6), (-18, 6), (18, 8), (-14, 16), (14, 18), (-20, -2), (20, 2)); g.at('D', (-12, 14), (12, 12), (-16, 22), (17, 22))
g.at('B', (-22, 12), (22, 14), (-10, 22)); g.at('W', (2, 24))
plan.build('L3', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=28))
