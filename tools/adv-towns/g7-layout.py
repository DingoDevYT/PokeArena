"""Writes tools/adv-towns/G7.json: the v3 Goldacre, a compact farming village (docs/REGION-REBUILD.md section 14). Run: py -3.12 -I tools/adv-towns/g7-layout.py
Coordinates are tiles from the town centre (y grows south). v2 spread eleven buildings over a 90 tile field; v3 packs them on a grid of lanes round the village green:
Main Street runs east-west through the green (Center and Mart on its north side, the gym and Whitney's house to the east), a back lane north and one south carry the houses,
side lanes close the grid. Every house has a yard (beds by the door, a hedge or picket fence behind, a garden plot or a tree). Barns, a greenhouse and sheds (scenery, no door)
fill the blocks between. Round the village: fenced fields, an orchard, the farmyard with the windmill, a tree belt that frames the edge. The interiors (G7-in.json) and the
footprints are unchanged (same ids, sizes and door columns)."""
import json, os
R = lambda x0, y0, x1, y1: [x0, y0, x1, y1, 'path']
paving = [
    R(-34, -1, 36, 1),                         # Main Street, west and east of the green (Routes 6 / 8 and 5 / 7 join it)
    R(-1, -36, 1, -6), R(-1, 7, 1, 36),        # north and south lanes off the green
    R(-27, -15, 31, -13), R(-27, 10, 31, 12),  # the back lanes
    R(-27, -13, -25, 10), R(29, -13, 31, 10),  # side lanes closing the grid
]
plazas = [[-11, -5, 11, 6, 4], [-7, -2, 7, 5, 4, 'tan']]
B = lambda n, x, y, i, w, d, ex: [n, x, y, i, {"w": w, "d": d, "ex": ex}]
buildings = [
    B("pokeCenterGrand", -6, -5, "g7-center", 5, 3, 2), B("warehouse", 7, -5, "g7-mart", 6, 3, 2),        # north side of the green
    B("chaletRedBig", 16, -1, "g7-whitney", 4, 4, 1), B("inn", 24, -1, "g7-gym", 6, 4, 2),               # Main Street east
    B("hotelBlue", -15, -1, "g7-h4", 4, 4, 1), B("chaletRedBig", -21, -1, "g7-h5", 4, 4, 1),            # Main Street west
    B("chaletRedChimney", -19, -15, "g7-h1", 4, 4, 1), B("inn", -9, -15, "g7-h2", 4, 4, 2), B("hall", 10, -15, "g7-h3", 4, 4, 1), # north back lane
    B("chaletRedChimney", -15, 10, "g7-h6", 4, 4, 1), B("tavern", 15, 10, "g7-h7", 4, 4, 1),           # south back lane
]
props = [
    # the green
    ["maFountain", 0, 3], ["pokeSign", -2, -4], ["noticeBoard", 2, -4], ["benchYellow", -8, 1], ["benchYellow", 8, 1],
    ["flowerBedBlue", -10, -4], ["flowerBedPink", -3, -3], ["flowerBedPink", 4, -3], ["flowerBedBlue", 11, -4],
    ["lampPost", -10, -4], ["lampPost", 10, -4], ["lampPost", -10, 5], ["lampPost", 10, 5], ["roundTree", -9, 3], ["roundTree", 9, 3],
    ["planterGrass", -5, -3], ["planterGrass", 5, -3], ["planterGrass", -5, 5], ["planterGrass", 5, 5],
    # street furniture: lamps on the corners of the grid, signs where the routes come in
    ["lampPost", -24, -16], ["lampPost", 28, -16], ["lampPost", -24, 9], ["lampPost", 28, 9], ["lampPost", -2, -16], ["lampPost", 2, -16], ["lampPost", -2, 9], ["lampPost", 2, 9],
    ["streetSign", -32, -2], ["streetSign", 34, -2], ["streetSign", -2, -34], ["streetSign", 2, 34],
    ["signGreenWide", 21, -2], ["mailbox", 19, -2], ["mailbox", -13, -2], ["mailbox", -18, -2], ["mailbox", -16, -16], ["mailbox", -6, -16], ["mailbox", 13, -16], ["mailbox", -12, 9], ["mailbox", 18, 9],
    # scenery buildings (no door): the dairy barn behind the gym, a feed barn, the greenhouse, sheds
    ["barnRed", 22, -8], ["barnOrange", -21, 6], ["sGreenhouse", 4, -10], ["maLogCabin", 20, 6], ["thatchHouseSmall", -6, 18], ["thatchHouseSmall", 6, -22],
    # the farmyard (east, past the side lane) and the windmill
    ["maWindmill", 38, 6], ["maHayBales", 35, -7], ["maHayPile", 37, -4], ["maHayPile", 40, -8], ["crateWide", 35, 9], ["barrelOrange", 36, 10], ["barrelOrange", 34, 10],
    ["fencePenWood", 35, -11], ["fencePenWood", 38, -11], ["mScarecrow", -36, 18], ["mScarecrow", 12, 26],
    # market on the green's west and east sides
    ["pxStallPink", 12, 3], ["marketAwning", 15, 3], ["crateWide", 13, -3], ["barrelDark", 12, -2],
    # animal pens and hay in the north-east block (behind the barn), a vegetable garden north-west
    ["fencePenWood", 13, -10], ["fencePenWood", 16, -10], ["fencePenMint", 19, -11], ["maHayPile", 26, -11], ["maHayBales", 13, -7],
    ["jWell", -9, 8], ["benchTeal", -6, 8], ["cratePlant", 17, 4], ["barrelOrange", 18, 4], ["seedSack", 19, 4],
]
deco = []
# every house: beds by the door, a picket fence or hedge along the back of its yard, a tree each side
yards = [(16, -1, 1, 4), (24, -1, 2, 6), (-15, -1, 1, 4), (-21, -1, 1, 4), (-19, -15, 1, 4), (-9, -15, 2, 4), (10, -15, 1, 4), (-15, 10, 1, 4), (15, 10, 1, 4)]
for i, (hx, hy, ex, w) in enumerate(yards):
    c0 = hx - ex
    deco += [["row", "flowerBedPink" if i % 2 else "flowerBedBlue", c0 - 1, hy - 1, c0 - 1, hy - 1, 1], ["row", "flowerBedBlue" if i % 2 else "flowerBedPink", c0 + w, hy - 1, c0 + w, hy - 1, 1],
             ["fam", "bushes" if i % 2 else "drift-a", c0 + w // 2, hy - 8]]
# street trees: a line along each lane, one every four tiles, a tile off the paving
for (x0, y0, x1, y1) in ((-24, -17, 28, -17), (-24, 13, 28, 13), (-28, -12, -28, 9), (32, -12, 32, 9), (-3, -34, -3, -18), (3, -34, 3, -18), (-3, 15, -3, 34), (3, 15, 3, 34)):
    deco.append(["row", "roundTree", x0, y0, x1, y1, 4])
deco += [
    # gardens and an orchard in the blocks
    ["plot", -23, -10, 6, 4, 0], ["plot", 16, -10, 5, 4, 1], ["plot", 22, 3, 5, 4, 0], ["plot", -8, 15, 5, 4, 1], ["plot", 7, 15, 5, 4, 0],
    ["row", "bigRoundTree", -22, -21, -6, -21, 4], ["row", "roundTree", 6, -21, 26, -21, 4],
    # fields round the village, edge to edge with their fences (the generator lays its own ring further out)
    ["plot", -34, -32, 10, 6, 1], ["plot", -22, -32, 10, 6, 0], ["plot", 6, -32, 10, 6, 1], ["plot", 18, -32, 10, 6, 0],
    ["plot", -34, 18, 10, 6, 0], ["plot", -22, 18, 10, 6, 1], ["plot", 6, 22, 10, 6, 0], ["plot", 18, 22, 10, 6, 1], ["plot", -34, 26, 10, 6, 1], ["plot", 18, 30, 10, 6, 0],
    ["plot", -10, -10, 5, 3, 0], 
    ["plot", -34, 34, 10, 5, 0], ["plot", -22, 26, 10, 6, 0], ["plot", 6, 30, 10, 5, 1], ["plot", 30, 18, 8, 6, 1], ["plot", -40, -2, 6, 8, 0], ["plot", 30, -30, 8, 6, 1],
    ["pond", -10, 28, 5, 3],
    # the tree belt that frames the village (left open where the four roads come in)
    ["fam", "grove-oak", -40, -12], ["fam", "grove-round", -40, 12], ["fam", "grove-oak", -26, 38], ["fam", "grove-round", 18, 40], ["fam", "grove-oak", 38, 26],
    ["fam", "grove-pine", 40, -20], ["fam", "grove-oak", 30, -38], ["fam", "grove-round", -12, -40], ["fam", "grove-oak", -38, -26], ["fam", "grove-round", 40, 14],
]
out = dict(door=[-6, -5], paving=paving, plazas=plazas, buildings=buildings, props=props, deco=deco)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'G7.json'), 'w', encoding='utf8').write(json.dumps(out, separators=(',', ':')))
print('G7.json written:', len(buildings), 'buildings,', len(props), 'props,', len(deco), 'deco')
