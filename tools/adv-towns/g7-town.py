"""Goldacre, drawn by hand (docs/REGION-REBUILD.md section 15). Run: py -3.12 -I tools/adv-towns/g7-town.py   (writes G7.json, tools/.cache/plan-G7.png, tools/.cache/plan-G7.txt)
The story of the place: a farming village that grew where the river mills' cart track (Route 8, from the north-west) meets the market road to Tradeway (Route 5, north-east)
and the old drove road south (Route 7). The green with its fountain is the crossroads; the Center and the Mart were built facing it. The oldest cottages crowd the north lane
up to the mills; the newer houses spread along the market road. The gym is the dairy hall on the market road, Whitney's family farm beside it. South of the green the drove
road bends past the tavern and down between the fields; a track runs east to the farmyard and the windmill on its rise, another west to the duck pond and the allotments.
Every coordinate here was placed by hand; tools/adv-towns/plan.py turns the drawing into the generator's layout."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

N = 44; W = 2 * N + 1
g = [['.'] * W for _ in range(W)]
def put(x, y, ch):
    if -N <= x <= N and -N <= y <= N: g[y + N][x + N] = ch
def rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): put(x, y, ch)
def lane(pts, w=2, ch='d'):
    """a lane through hand-set bends: straight legs between the points, w cells wide (the legs are axis-aligned; the bends are where I put them)"""
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        if xa == xb: rect(xa, min(ya, yb), xa + w - 1, max(ya, yb), ch)
        else: rect(min(xa, xb), ya, max(xa, xb) + w - 1, ya + w - 1, ch)

# ---- the green at the crossroads: tan paving with a stone rim, rounded off by hand
for y, (a, b) in zip(range(-5, 9), [(-6, 9), (-8, 11), (-9, 12), (-10, 12), (-10, 12), (-10, 12), (-10, 12), (-10, 12), (-10, 12), (-9, 11), (-8, 10), (-6, 8), (-3, 5), (-1, 3)]):
    rect(a, y, b, y, 'p')
for y, (a, b) in zip(range(-3, 7), [(-6, 8), (-7, 9), (-8, 10), (-8, 10), (-8, 10), (-8, 10), (-8, 10), (-7, 9), (-5, 7), (-2, 4)]):
    rect(a, y, b, y, 't')
# ---- lanes (dirt). North lane: the mills track, winding up between the old cottages to Route 8
lane([(-10, -4), (-10, -11), (-12, -11), (-12, -19), (-10, -19), (-10, -27), (-14, -27), (-14, -36), (-17, -36), (-17, -44)])
# market road: from the green's east side, round the dairy, then north-east to Route 5
lane([(12, 0), (19, 0), (19, -9), (24, -9), (24, -20), (21, -20), (21, -33), (23, -33), (23, -44)])
# drove road south to Route 7, bending past the tavern
lane([(1, 9), (1, 15), (-2, 15), (-2, 27), (0, 27), (0, 44)])
# farm track east to the windmill yard, the west track to the pond
lane([(3, 20), (17, 20), (17, 16), (29, 16)])
lane([(-10, 2), (-24, 2), (-24, 9), (-30, 9)])
# footpaths, one cell: house doors to their lanes, the orchard gate, the windmill
for pts in ([(-15, -9), (-11, -9)], [(-5, -15), (-10, -15)], [(-17, -19), (-13, -19)], [(-6, -26), (-8, -26)],
            [(11, -8), (11, -6), (12, -6)], [(17, -9), (18, -9)], [(28, -12), (26, -12)], [(-7, 13), (0, 13)],
            [(29, 17), (29, 11), (33, 11)], [(-30, 10), (-30, 14)], [(-14, -36), (-22, -36)]):
    lane(pts, 1)

# ---- buildings (the char marks the walkway tile in front of the door): all of them within about 30 tiles of the green
B = {'C': ["pokeCenterGrand", "g7-center", {"w": 5, "d": 3, "ex": 2}], 'M': ["warehouse", "g7-mart", {"w": 6, "d": 3, "ex": 2}],
     'W': ["chaletRedBig", "g7-whitney", {"w": 4, "d": 4, "ex": 1}], 'G': ["inn", "g7-gym", {"w": 6, "d": 4, "ex": 2}],
     '1': ["chaletRedChimney", "g7-h1", {"w": 4, "d": 4, "ex": 1}], '2': ["inn", "g7-h2", {"w": 4, "d": 4, "ex": 2}], '3': ["hall", "g7-h3", {"w": 4, "d": 4, "ex": 1}],
     '4': ["hotelBlue", "g7-h4", {"w": 4, "d": 4, "ex": 1}], '5': ["chaletRedBig", "g7-h5", {"w": 4, "d": 4, "ex": 1}],
     '6': ["chaletRedChimney", "g7-h6", {"w": 4, "d": 4, "ex": 1}], '7': ["tavern", "g7-h7", {"w": 4, "d": 4, "ex": 1}]}
for ch, (x, y) in {'C': (-4, -5), 'M': (5, -5), 'W': (11, -8), 'G': (17, -9), '3': (28, -12),
                   '4': (-15, -9), '1': (-5, -15), '5': (-17, -19), '2': (-6, -26), '6': (-7, 13), '7': (8, 12)}.items():
    put(x, y, ch)
# outbuildings (no door): the dairy barn behind the gym, the farmyard barn and cart shed, the greenhouse behind the Mart, the mill cottage, the allotment shed
for ch, (x, y) in {'K': (25, 21), 'O': (33, 22), 'V': (5, -12), 'L': (-34, -2), 'm': (-31, 15), 'Q': (22, -15)}.items(): put(x, y, ch)

def at(ch, *pts):
    for x, y in pts: put(x, y, ch)
at('F', (1, 4)); at('l', (-11, -3), (11, -4), (-9, 7), (11, 7), (-13, -12), (20, -10), (-3, 16), (25, -21), (-11, -28))
at('b', (-5, 1), (7, 1), (-1, 8)); at('g', (-1, -4)); at('n', (3, -4))
at('w', (-6, -6), (-2, -6), (3, -6), (10, -9), (13, -9), (-16, -10), (-6, -16), (-18, -20), (-8, -27), (27, -13), (-8, 12), (6, 11), (15, -10))
at('r', (-1, -6), (9, -6), (14, -9), (-13, -10), (-3, -16), (-14, -20), (-4, -27), (30, -13), (-4, 12), (11, 11), (21, -10))
# trees: the old trees round the green, a few in the yards
at('T', (-12, 0), (13, -2), (-11, 8), (13, 8), (-7, -10), (-15, -24), (-4, -21), (-13, -32), (26, -24), (20, -30), (26, -5), (4, 14), (-5, 22), (3, 30), (-1, 36), (9, -14), (-20, -12))
at('B', (-15, -4), (16, -15), (-8, 9), (15, 23), (-20, -27), (31, -8), (-25, 0))
# kitchen gardens: a small fenced bed beside some of the cottages
GARDENS = [(-27, -12, 5, 4, 0), (-29, -23, 4, 4, 1), (34, -9, 5, 4, 0), (-20, 15, 5, 4, 0), (9, 15, 6, 4, 1)]     # kitchen gardens beside the cottages (planted by the generator's plot)
for (x0, y0, *_) in GARDENS: at('U', (x0 - 2, y0 + 2))
# the village common west of the green: the old oak with benches round it, a picnic spot; a paddock east of the green
at('D', (-22, -2)); at('b', (-25, 1), (-19, 1)); at('%', (-26, -4), (-18, -4)); at('*', (-20, 4), (-24, 5))
for x in range(22, 36, 2): put(x, 2, 'f'); put(x, 12, 'f')
for y in range(4, 12, 2): put(22, y, 'e'); put(36, y, 'e')
at('y', (26, 6)); at('x', (32, 8)); at('j', (29, 5))
# front gardens: a low picket fence each side of the walk, a bush at the corner; flowers along the lanes
# each cottage's yard: a woodpile or a cart shed corner on one side, a barrel and a crate on the other, a bush at the lane
for k, (fx, fy) in enumerate(((-15, -9), (-5, -15), (-17, -19), (-6, -26), (11, -8), (28, -12), (-7, 13), (8, 12))):
    side = 1 if k % 2 else -1
    at('~', (fx + 4 * side, fy - 1)); at('_', (fx + 4 * side + side, fy - 1)); at('q', (fx - 4 * side, fy - 1)); at('z', (fx - 5 * side, fy - 2)); at('%', (fx - 3 * side, fy + 1))
at('%', (-13, -5), (-13, -13), (-8, -22), (-16, -30), (22, -5), (27, -18), (22, -26), (4, 17), (-5, 18), (-4, 25), (3, 25))
at('*', (-12, -7), (-9, -17), (-13, -26), (21, -13), (23, -27), (-4, 20), (3, 22), (15, 18), (-18, 4), (-28, 4))
# the orchard north-west: two rows of fruit trees inside a picket fence, between the mills track and the north lane (the river and Route 8's cart track take the land further west)
for k, y in enumerate((-32, -29)):
    for x in range(-30, -19, 3): put(x + (k % 2), y, 'k')
for x in range(-31, -18): put(x, -34, 'i'); put(x, -27, 'i')
# pasture east of the market road: pens and a field shelter; the windmill farmyard south-east
at('u', (30, -30), (33, -30), (36, -30), (30, -26), (36, -26)); at('y', (33, -26)); at('x', (40, -27))
at('X', (36, 6)); at('u', (24, 12), (27, 12), (30, 12)); at('x', (31, 19), (36, 25), (22, 24)); at('y', (28, 24)); at('z', (20, 22)); at('q', (21, 22), (35, 18)); at('j', (16, 33), (-30, 28))
# market corner on the green, the well by the south lane
at('v', (9, 5)); at('a', (-8, 4)); at('o', (4, 10)); at('z', (10, 3))
# hedgerows between the fields
for x in range(-41, -26, 2): put(x, 19, 'e')
for x in range(-21, -8, 2): put(x, 20, 'e')
for y in range(22, 41, 2): put(-13, y, 'e')
for y in range(22, 41, 2): put(16, y, 'e')
for x in range(18, 41, 2): put(x, -36, 'e')
# willows round the pond (the pond is a deco entry)
at('Y', (-44, 10), (-32, 19), (-40, 4))

L = {**B, '~': 'logShort', '_': 'fallenLog', 'D': 'bigOak', 'f': 'fenceRail', 'U': 'wSignBoard', '%': 'roundBush', '*': 'flowersWhite', 'F': 'maFountain', 'l': 'lampPost', 'b': 'benchYellow', 'g': 'pokeSign', 'n': 'noticeBoard', 'w': 'flowerBedBlue', 'r': 'flowerBedPink',
     'T': 'roundTree', 'B': 'bigRoundTree', 'k': 'roundTree', 'i': 'mPicketFence', 'e': 'hedgeLong', 'X': 'maWindmill', 'u': 'fencePenWood', 'x': 'maHayPile', 'y': 'maHayBales',
     'z': 'crateWide', 'q': 'barrelOrange', 'j': 'mScarecrow', 'v': 'pxStallPink', 'a': 'marketAwning', 'o': 'jWell', 'Y': 'bigOakVines',
     'K': ['barnRed'], 'O': ['barnOrange'], 'V': ['sGreenhouse'], 'L': ['maLogCabin'], 'm': ['thatchHouseSmall'], 'Q': ['barnOrange']}
# the fields: planted plots (crops and fence rails, the generator's own plot), a patchwork filling the land between the village and the edge
FIELDS = [(-41, 22, 10, 6, 1), (-27, 22, 10, 6, 0), (-11, 31, 8, 6, 0), (-11, 40, 8, 3, 1),
          (5, 24, 9, 5, 1), (5, 33, 9, 5, 0), (18, 26, 10, 6, 0), (31, 28, 8, 5, 1), (18, 35, 11, 5, 1), (32, 36, 8, 5, 0),
          (-43, -22, 10, 5, 0), (-43, -13, 10, 5, 1), (29, -24, 10, 4, 1), (-6, -40, 8, 4, 0)]
put(0, 0, '@')

plan_txt = '\n'.join(''.join(r) for r in g)
open(os.path.join(plan.ROOT, 'tools', '.cache', 'plan-G7.txt'), 'w').write(plan_txt)
plan.build('G7', plan_txt, L, dict(lim=46, deco=[["plot", *f] for f in FIELDS + GARDENS] + [["pond", -38, 14, 3.5, 2.5], ["fam", "grove-oak", -42, -2], ["fam", "grove-round", 38, -38], ["fam", "grove-oak", 40, 36],
                                                  ["fam", "grove-round", -40, 40], ["fam", "drift-a", -18, 6], ["fam", "drift-b", 14, 6], ["fam", "bushes", -20, -22], ["fam", "drift-c", 6, -30]]))
