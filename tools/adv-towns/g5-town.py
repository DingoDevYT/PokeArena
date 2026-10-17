"""Aldermere City, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/g5-town.py   (writes G5.json, tools/.cache/plan-G5.png)
The story: the capital of the east coast. The old town grew where the coast road from the west met the north-south trade road: its cobbled lanes wind between tall
blue-roofed houses west of the crossing. When the city prospered the crossing became the Grand Plaza (the fountain where the two roads met), the trade road became the
boulevard (stone carriageway, tan sidewalks, a tree every few steps) and the coast road the avenue. The new town east of the boulevard was laid out on purpose: straight
streets, hotels, shops and warehouses in blocks. The civic quarter stands north of the plaza (the Center, the Mart in the market tower, the museum hall, the clock), the gym
is the tall hall on the plaza's east side, and the city park fills the north-east corner. Routes: north road at x +12..+14, south road at x +12..+14, west road at (-46, +7)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

g = plan.Grid(48)
def road(x0, y0, x1, y1, side=True):
    """a city street: stone carriageway with a tan sidewalk each side (horizontal if the box is wider than tall)"""
    g.rect(x0, y0, x1, y1, 'p')
    if side:
        if x1 - x0 >= y1 - y0: g.rect(x0, y0 - 1, x1, y0 - 1, 't'); g.rect(x0, y1 + 1, x1, y1 + 1, 't')
        else: g.rect(x0 - 1, y0, x0 - 1, y1, 't'); g.rect(x1 + 1, y0, x1 + 1, y1, 't')
# ---- the boulevard (north-south) and the avenue (east-west), the Grand Plaza at their crossing
road(11, -48, 15, 48); road(-48, 5, 48, 7)
g.blob(13, 7, ["......##############......",
               "...####################...",
               ".########################.",
               "##########################",
               "##########################",
               "##########################",
               "##########################",
               "##########################",
               "##########################",
               "##########################",
               "##########################",
               "##########################",
               ".########################.",
               "...####################...",
               "......##############......"], 'c')
g.blob(13, 7, ["....############....", "..################..", "####################", "####################", "####################",
               "####################", "####################", "####################", "####################", "..################..", "....############...."], 't')
# ---- the new town: straight streets east of the boulevard
road(17, -30, 48, -29); road(17, 22, 48, 23); road(17, 36, 48, 37); road(33, -28, 34, 35)
road(-6, -30, 9, -29)                                                         # the civic street north of the plaza, west of the boulevard
road(17, -16, 31, -15)
# ---- the old town: cobbled lanes, 2 wide, winding west of the boulevard
for pts in ([(-4, 4), (-4, -8), (-14, -8), (-14, -18), (-24, -18), (-24, -30)], [(-30, 4), (-30, -6), (-40, -6), (-40, -18)], [(-14, -18), (-14, -30), (-6, -30)],
            [(-10, 9), (-10, 20), (-24, 20), (-24, 30)], [(-36, 9), (-36, 18), (-46, 18)], [(-24, 20), (-24, 14), (-36, 14)], [(-10, 20), (2, 20), (2, 30), (9, 30)],
            [(-24, 30), (-12, 30), (-12, 40)], [(-40, -18), (-30, -18), (-30, -24)]):
    g.lane(pts, 2, 'p')
# ---- the new town's block interiors: concrete courts (service yards, parking) behind the buildings
for (x0, y0, x1, y1) in ((18, -27, 31, -21), (35, -27, 47, -3), (18, 12, 31, 17), (35, 10, 47, 17), (18, 25, 31, 31), (35, 25, 47, 31), (18, 39, 47, 47)):
    g.rect(x0, y0, x1, y1, 't')
# ---- the civic forecourt in front of the Center and the clock, north of the plaza
g.rect(-1, -2, 8, -1, 't')
# ---- more old-town lanes, cut through the big blocks as the old town filled in
for pts in ([(-25, -6), (-25, -12), (-20, -12)], [(-1, -10), (-1, -20), (4, -20)], [(-24, 20), (-30, 20), (-30, 26), (-40, 26)], [(-10, 20), (-10, 26), (-4, 26)],
            [(-40, -18), (-40, -28), (-34, -28)], [(-14, -30), (-14, -38), (-30, -38)]):
    g.lane(pts, 2, 'p')
# ---- the city park (north-east): lawn, walks, a pond
g.rect(18, -47, 46, -33, 'g'); g.lane([(18, -40), (46, -40)], 1, 't'); g.lane([(32, -47), (32, -33)], 1, 't')

# ---- buildings (door walkway tiles on the street side; every building faces south onto a street)
g.bld('pokeCenterWave', 4, -2, 'center'); g.bld('martTower', 22, -2); g.bld('gymTealTall', 27, 11)
g.bld('maHallGrey', 0, -31, 'house'); g.bld('clockTower', -4, -9, 'house'); g.bld('domeHall', 22, -31, 'house')
tall = ['hotelGrey', 'mMintTower', 'maShopCyan', 'hotelBlue', 'sMartTower', 'mRoseTower', 'hotelGrey', 'maShopCyan']
new_rows = [(20, 21), (25, 21), (30, 21), (38, 21), (43, 21), (20, 35), (25, 35), (30, 35), (38, 35), (43, 35), (38, -31), (43, -31), (20, -17), (26, -17), (38, 4), (43, 4)]
for k, (x, y) in enumerate(new_rows): g.bld(tall[k % len(tall)], x, y)
old = ['houseBlueSplit', 'houseBlueGable', 'houseBlueTall', 'houseBlueDome', 'cottageTeal', 'houseBlueSplit', 'houseBlueTall', 'houseBlueGable']
old_rows = [(-8, -8), (-11, -8), (-18, -18), (-21, -18), (-34, -6), (-37, -6), (-44, -6), (-27, -24), (-33, -18), (-36, -18), (-18, -30), (-10, -30),
            (-14, 20), (-18, 20), (-21, 20), (-28, 14), (-32, 14), (-40, 18), (-44, 18), (-16, 30), (-20, 30), (-3, 30), (6, 30), (-3, 20),
            (-8, 4), (-16, 4), (-21, 4), (-26, 4), (-34, 4), (-40, 4), (-45, 4), (-8, 40), (-16, 40),
            (-27, -18), (-44, -18), (-7, 20), (-27, 30), (-31, 30), (-35, 30), (-44, 14), (-12, -18), (-28, -6), (-31, -6), (-22, -30), (-3, 40), (-20, 40), (-24, 40)]
for k, (x, y) in enumerate(old_rows): g.bld(old[k % len(old)], x, y)
g.bld('wHouseMint', 27, -31, 'house')
for k, (x, y) in enumerate([(-24, -12), (-27, -12), (2, -20), (6, -20), (-33, 20), (-36, 26), (-40, 26), (-7, 26), (-38, -28), (-34, -28), (-18, -38), (-22, -38), (-26, -38), (-29, -38)]):
    g.bld(old[(k + 3) % len(old)], x, y)

P = {'T': 'roundTree', 'B': 'bigRoundTree', 'O': 'canopyTree', 'F': 'maFountain', 'l': 'lampPostDouble', 'L': 'lampPost', 'b': 'mBenchLong', 'k': 'statueDog', 'n': 'mNoticeBoard',
     'N': 'pokeSign', 'i': 'mInfoPost', 'v': 'pxStallBlue', 'S': 'pxStallPink', 'A': 'marketAwning', 'u': 'planterBoxGreen', 'U': 'mPlanterGrass', 'w': 'flowerBedBlue', 'r': 'flowerBedPink',
     'm': 'mailbox', 'V': 'vanGrey', 'x': 'crateWide', 'q': 'barrelOrange', 'W': 'wSignBoard', 'f': 'flowersWhite'}
# the plaza: fountain where the roads met, statues, benches, planters, lamps, a few market stalls on its south side
g.at('F', (13, 8)); g.at('k', (9, 5), (17, 5)); g.at('b', (8, 10), (18, 10), (13, 3)); g.at('U', (5, 4), (21, 4), (5, 12), (21, 12))
g.at('l', (3, 1), (23, 1), (3, 13), (23, 13)); g.at('v', (6, 15), (20, 14)); g.at('S', (13, 18)); g.at('N', (2, -3)); g.at('n', (7, -3)); g.at('i', (9, 2), (17, 12))
# boulevard and avenue: a tree and a lamp every few steps along the sidewalks
for y in range(-46, 47, 4):
    if not -8 < y < 22: g.at('T', (9, y)); g.at('T', (17, y + 2))
for y in range(-44, 47, 8):
    if not -8 < y < 22: g.at('L', (9, y + 2)); g.at('L', (17, y))
for x in range(-46, 47, 5):
    if not -2 < x < 28: g.at('T', (x, 9)); g.at('L', (x + 2, 9))
# street furniture in the new town: planters and benches on the sidewalks, a delivery van
for x in (22, 28, 36, 41): g.at('u', (x, 25)); g.at('u', (x, 39)); g.at('b', (x + 2, -27))
g.at('V', (40, 27), (28, -25), (22, 14), (40, 14), (24, 27), (44, 42)); g.at('x', (24, -25), (42, -20), (19, 13), (44, 27)); g.at('q', (25, -25), (43, -21), (20, 13)); g.at('b', (24, 44), (34, 44)); g.at('x', (46, 24)); g.at('q', (45, 25))
# the park: trees, a pond (deco), benches, flowers
for (x, y) in ((20, -45), (24, -46), (29, -44), (36, -46), (41, -45), (45, -43), (21, -36), (26, -35)): g.at('B' if (x + y) % 2 else 'O', (x, y))
g.at('b', (30, -41), (34, -39)); g.at('w', (23, -41), (40, -39)); g.at('r', (27, -39), (44, -41)); g.at('f', (19, -38), (46, -38))
# the old town: window boxes and planters by the doors, a little square with a well at the lane crossing
g.at('o' if False else 'U', (-12, -10)); g.at('L', (-15, -19), (-11, 21), (-25, 15), (-25, 31))
for (x, y) in old_rows[::3]: g.at('r' if x % 2 else 'w', (x + 2, y - 1))
g.at('W', (13, -47), (13, 46), (-46, 4))
g.at('B', (-36, -12), (-20, -24), (-8, -14), (-18, 26), (-36, 34), (-6, 34), (-44, -24), (-28, -32), (-10, 12), (-30, 10)); g.at('T', (-33, -10), (-24, -26), (-12, 14), (-40, 22), (2, 24))
g.at('f', (-34, -14), (-16, -24), (-22, 24), (-2, 14)); g.at('r', (-26, -11), (0, -19)); g.at('w', (-23, 21), (-9, 27))

plan.build('G5', g.text(), P, blds=g.blds, pp=g.pp, extra=dict(lim=52, deco=[["pond", 39, -42, 3.5, 2]]))
