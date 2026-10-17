"""Sailsport, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/t2-town.py   (writes T2.json, tools/.cache/plan-T2.png)
The story: a sailing port on the cape south-east of Aldermere. The harbour made it: a stone quay along the south beach with three piers out into the bay, the fish
market on the quay, the shipyard on the sand west of it, the lighthouse on the east point. The town climbs the slope north of the harbour: the high street comes down
from the Aldermere road in long bends, the Center and the Mart stand where it levels out, sailors' cottages crowd the lanes either side, and a chandler's warehouse
stands at the head of the quay. Routes: the road from Aldermere arrives from the north-west at (-20, -22). The sea is south (from y ~+33) and east (from x ~+40)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(46)
# ---- the high street (stone, 3 wide), bending down the slope to the quay; lanes off it
g.lane([(-20, -24), (-20, -12), (-8, -12), (-8, 4), (1, 4), (1, 31)], 3, 'p')
g.lane([(-20, -6), (-30, -6), (-30, 8)]); g.lane([(-8, -2), (-22, -2), (-22, 14), (-14, 14)]); g.lane([(4, 8), (18, 8), (18, 2), (28, 2)])
g.lane([(4, 16), (24, 16), (24, 31)]); g.lane([(-14, 14), (-14, 22), (-30, 22), (-30, 31)]); g.lane([(-4, -12), (8, -12), (8, -20), (18, -20)])
g.lane([(4, 24), (16, 24)]); g.lane([(-8, 24), (-2, 24)]); g.lane([(-30, 8), (-38, 8)]); g.lane([(18, 8), (18, 12), (30, 12)])
# ---- the quay: stone along the top of the beach, widening into the market square at the high street's foot
g.rect(-30, 32, 30, 35, 'p'); g.blob(4, 37, ["############", "############", "..########.."], 'p')
# ---- the shipyard (packed sand yard) west, the lighthouse point east
g.rect(-44, 25, -33, 31, 'd'); g.lane([(26, 32), (32, 32), (32, 24)], 2, 'd')

# ---- buildings
g.bld('pokeCenterWave', -4, 4, 'center'); g.bld('martWave', 6, 4)
g.bld('sSilverWarehouse', 14, 32, 'house'); g.bld('roundTower', 33, 24, 'house')
H = ['cottageRed', 'houseBlueSplit', 'houseBlueGable', 'cottageTeal', 'houseBlueDome', 'cottageRed', 'houseBlueTall', 'houseBlueSplit']
homes = [(-16, -12), (-12, -12), (-25, -6), (-28, -6), (-33, -6), (-12, -2), (-16, -2), (-19, -2), (8, 8), (12, 8), (21, 2), (25, 2), (6, 16), (10, 16), (14, 16), (19, 16),
         (-18, 14), (-11, 14), (-26, 32), (-21, 32), (-7, 32), (-11, 32), (2, -12), (5, -12), (-27, 8), (11, -20), (15, -20), (-34, 8), (-37, 8),
         (7, 24), (11, 24), (-6, 24), (-18, 22), (-22, 22), (-26, 22), (22, 12), (26, 12), (-16, 32), (28, 32)]
for k, (x, y) in enumerate(homes): g.bld(H[k % len(H)], x, y)

P = {'T': 'roundTree', 'Y': 'palmTree', 'B': 'bigRoundTree', 'l': 'lampPost', 'L': 'lampPostDouble', 'b': 'benchTeal', 'n': 'noticeBoard', 'N': 'pokeSign', 'v': 'pxStallBlue', 'S': 'pxStallPink',
     'A': 'marketAwning', 'x': 'crateWide', 'X': 'crateBox', 'q': 'barrelOrange', 'Q': 'barrelDark', 'z': 'seedSack', 'o': 'wBollard', 'R': 'maRowboat', 'V': 'maSailboat', 'W': 'boatWhite',
     'F': 'fallenLog', 'G': 'logShort', 'w': 'flowerBedBlue', 'r': 'flowerBedPink', 'm': 'mailbox', 'k': 'shell', 'K': 'rockGrey', 'E': 'wSignBoard', 'f': 'flowersWhite', 'u': 'flowerBowl'}
# the fish market on the quay square, bollards along the quay edge, crates and barrels
g.at('v', (0, 37)); g.at('S', (8, 37)); g.at('A', (4, 38)); g.at('x', (-2, 37), (10, 36)); g.at('q', (-3, 38), (11, 38)); g.at('z', (2, 39)); g.at('Q', (6, 39))
g.at('o', *[(x, 36) for x in range(-28, 30, 4) if not -3 <= x <= 11]); g.at('b', (-18, 34), (20, 34)); g.at('L', (-1, 35), (10, 35)); g.at('l', (-24, 33), (-4, 33), (18, 33), (26, 33))
# the shipyard: hulls on the sand, timber, a rowboat
g.at('V', (-40, 29)); g.at('W', (-36, 30)); g.at('F', (-43, 26), (-38, 26)); g.at('G', (-35, 27)); g.at('x', (-44, 31)); g.at('R', (-44, 34))
# boats moored off the piers (on the water), rowboats drawn up on the beach
g.at('V', (9, 45), (-6, 45)); g.at('W', (17, 44)); g.at('R', (-14, 40), (22, 39), (-22, 41))
# the high street: lamps, signs, planters; cottages' window boxes
g.at('l', (-21, -18), (-17, -13), (-9, -6), (-9, 2), (0, 10), (0, 18), (-23, -3), (3, 9)); g.at('N', (-6, 3)); g.at('n', (3, 3)); g.at('E', (-21, -26), (31, 31))
for (x, y) in homes[::2]: g.at('u', (x + 2, y - 1))
g.at('m', (-14, -13), (-10, -3), (10, 7), (8, 15), (-24, 23))
# trees and palms up the slope; shells and rocks on the beach
g.at('T', (-26, -14), (-12, -20), (14, -6), (22, -8), (-30, 2), (16, 12), (-4, 14), (28, 10), (-26, 18), (12, -24))
g.at('Y', (-26, 38), (-18, 38), (18, 38), (26, 38), (34, 16), (36, 30), (-10, 39)); g.at('k', (-12, 39), (14, 41), (28, 40), (-28, 41)); g.at('K', (36, 22), (38, 28), (-42, 36))
g.at('f', (-34, -16), (20, -18), (30, -4), (-36, 14)); g.at('B', (-34, -24), (24, -26), (34, -10), (-38, 4))

plan.build('T2', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=50, boards=[[3, 40, 4, 46], [-3, 40, -2, 46], [11, 40, 12, 46], [-5, 45, 0, 46]]))
