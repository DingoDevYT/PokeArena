"""Writes tools/adv-towns/G7.json: the v2 Goldacre (docs/MAPDESIGN.md "Look and feel v2"). Run: py -3.12 -I tools/adv-towns/g7-layout.py
Coordinates are tiles from the town centre (y grows south). A village green with a fountain between the Pokemon Center and Mart, dirt lanes that bend in long runs (no 1 tile steps), houses with front beds,
back fences and groves, the gym and Whitney's house on the east lane with a dairy yard, a windmill on the skyline. The interiors (G7-in.json) and footprints are unchanged."""
import json, os
R = lambda x0, y0, x1, y1: [x0, y0, x1, y1, 'path']
paving = [
    R(-1, -40, 1, -33), R(-9, -34, 1, -32), R(-9, -34, -7, -18), R(-9, -20, 1, -18), R(-1, -20, 1, -4),        # north street: an S bend round the houses' lane
    R(-27, -26, -8, -24),                                                                                        # north-west lane (houses 1, 2)
    R(11, -3, 33, -1),                                                                                           # east lane: Whitney's house, the gym, the dairy yard
    R(-24, 0, -11, 2), R(-24, 0, -22, 9), R(-33, 7, -22, 9),                                                     # west lane: a long run, a bend south, a long run (houses 4, 5)
    R(-1, 7, 1, 17), R(-1, 16, 8, 18), R(6, 16, 8, 29), R(-1, 28, 8, 30), R(-1, 28, 1, 40),                       # south street: an S bend
    R(8, 23, 29, 25),                                                                                            # south-east lane (houses 6, 7)
]
plazas = [[-11, -5, 11, 6, 4], [-7, -2, 7, 5, 4, 'tan']]
buildings = [
    ["pokeCenterGrand", -6, -5, "g7-center", {"w": 5, "d": 3, "ex": 2}], ["warehouse", 7, -5, "g7-mart", {"w": 6, "d": 3, "ex": 2}],
    ["chaletRedBig", 17, -3, "g7-whitney", {"w": 4, "d": 4, "ex": 1}], ["inn", 26, -3, "g7-gym", {"w": 6, "d": 4, "ex": 2}],
    ["chaletRedChimney", -15, -26, "g7-h1", {"w": 4, "d": 4, "ex": 1}], ["inn", -23, -26, "g7-h2", {"w": 4, "d": 4, "ex": 2}], ["hall", -5, -20, "g7-h3", {"w": 4, "d": 4, "ex": 1}],
    ["hotelBlue", -18, 0, "g7-h4", {"w": 4, "d": 4, "ex": 1}], ["chaletRedBig", -28, 7, "g7-h5", {"w": 4, "d": 4, "ex": 1}],
    ["chaletRedChimney", 14, 23, "g7-h6", {"w": 4, "d": 4, "ex": 1}], ["tavern", 24, 23, "g7-h7", {"w": 4, "d": 4, "ex": 1}],
]
props = [
    ["maFountain", 0, 3],
    ["pokeSign", -2, -4], ["noticeBoard", 2, -4], ["benchYellow", -8, 1], ["benchYellow", 8, 1],
    ["flowerBedBlue", -10, -4], ["flowerBedPink", -3, -3], ["flowerBedPink", 4, -3], ["flowerBedBlue", 11, -4],
    ["lampPost", -10, -4], ["lampPost", 10, -4], ["lampPost", -10, 5], ["lampPost", 10, 5], ["roundTree", -9, 3], ["roundTree", 9, 3], ["planterGrass", -5, -3], ["planterGrass", 5, -3], ["planterGrass", -5, 5], ["planterGrass", 5, 5],
    ["lampPost", -3, -12], ["lampPost", 3, -12], ["lampPost", 3, 12], ["lampPost", -3, 12], ["lampPost", -3, 35], ["lampPost", 3, -36],
    ["streetSign", -3, -38], ["streetSign", 3, 38],
    ["signGreenWide", 22, -4], ["mailbox", 20, -4], ["flowerBedPink", 14, -4],
    ["fencePenWood", 34, -4], ["fencePenWood", 37, -4], ["maHayBales", 36, -9], ["maHayPile", 33, -8], ["maHayPile", 41, -3], ["crateWide", 32, -4], ["barrelOrange", 31, -4],
    ["maWindmill", 35, 12], ["maHayPile", 30, 14], ["crateWide", 40, 14], ["barrelOrange", 41, 14], ["flowerBedBlue", 32, 16], ["flowerBedPink", 38, 16],
    ["mScarecrow", 29, 30], ["maHayPile", 12, 33], ["maHayPile", 25, 31],
]
deco = []
# house decor: a bed each side of the door, a bush pair, a back fence with a grove behind it
for (hx, hy, ex) in ((17, -3, 1), (-15, -26, 1), (-23, -26, 2), (-5, -20, 1), (-18, 0, 1), (-28, 7, 1), (14, 23, 1), (24, 23, 1), (26, -3, 2)):
    c0 = hx - ex; w = 6 if hx == 26 else 4
    deco += [["row", "flowerBedBlue" if hx % 2 else "flowerBedPink", c0 - 2, hy - 1, c0 - 2, hy - 1, 1], ["row", "flowerBedPink" if hx % 2 else "flowerBedBlue", c0 + w + 1, hy - 1, c0 + w + 1, hy - 1, 1],
             ["row", "hedgeLong", c0 - 1, hy - 5, c0 + w, hy - 5, 2.4], ["fam", "grove-oak", c0 + w // 2, hy - 9]]
deco += [
    ["fam", "grove-round", -16, -33], ["fam", "grove-oak", -28, -17], ["fam", "grove-pine", -33, -4], ["fam", "grove-oak", -35, 14], ["fam", "grove-round", -20, 20], ["fam", "grove-oak", -10, 36],
    ["fam", "grove-oak", 14, -22], ["fam", "grove-round", 28, -18], ["fam", "grove-pine", 38, -20], ["fam", "grove-oak", 18, 34], ["fam", "grove-round", 32, 34], ["fam", "grove-oak", 40, 24],
    ["fam", "drift-b", -14, -8], ["fam", "drift-a", 15, 9], ["fam", "drift-c", -12, 12], ["fam", "drift-b", 14, -9], ["fam", "bushes", -26, -10], ["fam", "bushes", 24, 5], ["fam", "drift-a", -28, 24], ["fam", "drift-c", 6, -28],
    ["row", "hedgeLong", -13, -4, -13, -4, 1], ["row", "hedgeLong", -14, 4, -14, 4, 1], ["row", "hedgeLong", 14, 3, 14, 3, 1], ["row", "hedgeLong", 15, -5, 15, -5, 1],
    ["plot", 3, -31, 8, 5, 0], ["plot", -32, -13, 8, 5, 1], ["plot", -31, 15, 8, 5, 0], ["plot", 4, 33, 8, 5, 1], ["plot", 15, -17, 9, 5, 0], ["plot", 28, 4, 8, 5, 1], ["plot", 16, 31, 8, 5, 0],
    ["pond", 24, 9, 5, 3], ["pond", -21, 15, 4, 2.5], ["pond", 10, -30, 4, 2.5],
    ["row", "fenceRail", 9, 19, 30, 19, 2], ["row", "fenceRail", 9, 27, 18, 27, 2],
]
out = dict(door=[-6, -5], paving=paving, plazas=plazas, buildings=buildings, props=props, deco=deco)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'G7.json'), 'w', encoding='utf8').write(json.dumps(out, separators=(',', ':')))
print('G7.json written:', len(buildings), 'buildings,', len(props), 'props,', len(deco), 'deco')
