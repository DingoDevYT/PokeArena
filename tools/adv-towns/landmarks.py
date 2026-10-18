"""The three landmarks without a hand layout yet, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/landmarks.py   (writes L3.json; L1 is drawn by l1-town.py, L2 by l2-town.py)
L1 Statue of Umbra: see l1-town.py.
L2 Fernwell Sanctuary: the temple the Fernwell family founded in a walled garden on the meadow; a paved approach with lamps, rose beds and blossom, a pond, a gate house.
L3 Pokemon League: the castle on the north cape, approached up a grand paved avenue between towers and torches, a courtyard before its gate, the sea behind it."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

P = {'S': 'standingStoneMint', 'Y': 'standingStoneMintTall', 'R': 'rockBrown', 'B': 'bigRockMint', 'M': 'maBoulderMoss', 'y': 'dryTuft', 'T': 'roundTree', 'O': 'canopyTree',
     'u': 'roseBush', 'v': 'whiteBlossomBush', 'l': 'lampPost', 'L': 'torchPost', 'k': 'statueDog', 'b': 'benchYellow', 'e': 'hedgeLong', 'w': 'flowerBedBlue', 'r': 'flowerBedPink',
     'W': 'wSignBoard', 'G': 'stoneGateStack', 'K': 'stoneTower', 'U': 'snowPineLarge', 'D': 'snowDomeTree', 'f': 'flowersWhite'}

# ---- L1 Statue of Umbra: redrawn with the town kit, see l1-town.py (it writes L1.json)

# ---- L2 Fernwell Sanctuary: redrawn with the town kit, see l2-town.py (it writes L2.json)

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
