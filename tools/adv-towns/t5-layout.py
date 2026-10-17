"""Writes tools/adv-towns/T5.json: the v2 Salt Bay (docs/MAPDESIGN.md "Look and feel v2"). Run: py -3.12 -I tools/adv-towns/t5-layout.py
Coordinates are tiles from the town centre (y grows south). The generator (tools/adv-gen-region.py, "T5 Salt Bay v2") straightens the sea shore beside the town into long runs and cuts a rounded harbour basin
(x -26..-4, y -4..9) into the beach: a cobbled quay with a well in a ring of tan paving, fish stalls and bollards on it; two piers (Surf teacher, Fishing teacher) and a net landing to the north;
the boatyard on the south headland. Main Street runs east to Route 9 with the Center and Mart on its north side; a lane loops north through a commons to the beach lane, where two houses face the lane;
three houses face the inlet and have their own boats. The interiors (T5-in.json) and footprints are unchanged: same ids, same door columns."""
import json, os, random
P = lambda x0, y0, x1, y1: [x0, y0, x1, y1, 'path']
paving = [
    P(9, 1, 44, 3),                    # Main Street: east to Route 9 (3 wide, one long run)
    P(11, 0, 15, 0), P(21, 0, 26, 0),  # forecourts of the Center and the Mart
    P(0, -18, 2, -4),                  # north lane from the quay
    P(-6, -18, 19, -16),               # beach lane: a long run east from the net landing
    P(17, -16, 19, 0),                 # lane between the Center and the Mart
    P(0, 7, 2, 12),                    # quay lane south to the boatyard
    P(18, 4, 20, 13),                  # slip lane A to the inlet
    P(31, 4, 33, 13),                  # slip lane B
    P(8, -20, 9, -19), P(24, -20, 25, -19),   # front paths, the two houses on the beach lane
    P(32, -1, 33, 0),                  # front path, house on Main Street
    P(12, 11, 13, 12), P(24, 11, 25, 12), P(37, 11, 38, 12),   # front paths, the houses facing the inlet
]
plazas = [[-3, -3, 9, 7, 4], [-1, -1, 7, 5, 3, 'tan'], [1, 1, 5, 3, 2]]
boards = [
    [-26, 2, -4, 3], [-31, 0, -27, 5],           # pier A: the main pier across the basin, short T head (Surf teacher)
    [-24, 10, -12, 11], [-29, 9, -25, 12],       # pier B: along the south headland (Fishing teacher)
    [-24, -18, -7, -17],                         # net landing jetty north
    [18, 13, 19, 17], [32, 13, 33, 16],          # slip landings on the inlet
]
buildings = [
    ["tavern", 8, -20, "t5-h1", {"w": 4, "d": 4, "ex": 1}], ["pokeCenterGrand", 13, 0, "t5-center", {"w": 5, "d": 3, "ex": 2}],
    ["warehouse", 23, 0, "t5-mart", {"w": 6, "d": 3, "ex": 2}], ["inn", 33, -1, "t5-h2", {"w": 4, "d": 4, "ex": 2}],
    ["hotelBlue", 24, -20, "t5-h3", {"w": 4, "d": 4, "ex": 1}], ["chaletRedBig", 13, 11, "t5-h4", {"w": 4, "d": 4, "ex": 1}],
    ["chaletRedChimney", 25, 11, "t5-h5", {"w": 4, "d": 4, "ex": 1}], ["tavern", 38, 11, "t5-h6", {"w": 4, "d": 4, "ex": 1}],
]
props = [
    # the quay: well in the ring, stalls on the north rim, benches on the south rim, lamps at the corners, bollards along the water
    ["jWell", 3, 3], ["benchYellow", 3, 6], ["benchYellow", -1, 7], ["benchYellow", 7, 7],
    ["pxStallBlue", 1, -2], ["marketAwning", 6, -2], ["crateWide", 3, -2], ["barrelOrange", 4, -2], ["barrelDark", 8, -2], ["seedSack", 8, 0],
    ["lampPost", -2, -2], ["lampPost", 8, -2], ["lampPost", -2, 6], ["lampPost", 8, 6],
    ["flowerBowl", 0, 6], ["flowerBowl", 6, 6], ["noticeBoard", 10, 4], ["pokeSign", 10, 0],
    ["wBollard", -3, -1], ["wBollard", -3, 0], ["wBollard", -3, 4], ["wBollard", -3, 5], ["wBollard", -5, -3], ["wBollard", -5, 8],
    # boats in the basin and off the piers
    ["maSailboat", -13, 1], ["maRowboat", -13, 8], ["speedboat", -21, 5], ["boatWhite", -9, 6],
    ["wBollard", -27, 1], ["wBollard", -27, 4], ["wBollard", -31, -1], ["wBollard", -26, 9], ["wBollard", -13, 10], ["wBollard", -13, 12], ["wBollard", -7, -17], ["wBollard", -7, -18],
    ["bigRockGreyWater", -20, -3], ["rockWater", -22, -2], ["bigRockGreyWater", -17, 11], ["rockWater", -19, 13], ["caveRockWater", -30, 15], ["rockWater", -22, -20], ["bigRockGreyWater", -25, -14],
    ["maRowboat", -20, -15], ["maRowboat", -15, -20],
    # the boatyard on the south headland
    ["maRowboat", -6, 13], ["maRowboat", 5, 12], ["crateWide", -1, 10], ["crateBox", -2, 10], ["barrelOrange", 3, 9], ["seedSack", -4, 12], ["tripodLamp", 3, 11], ["twigs", 8, 11], ["fallenLog", -9, 8], ["barrelDark", -8, 9],
    # the north beach: boats drawn up, a net-mending corner, driftwood, rocks
    ["maRowboat", -9, -11], ["maRowboat", -7, -25], ["crateWide", -4, -12], ["barrelDark", -3, -12], ["crateBox", -2, -11], ["benchYellow", -5, -9], ["fallenLog", -2, -6], ["logShort", -12, -7],
    ["bigRockGrey", -15, -24], ["rockGrey", -14, -23], ["rockGreyB", -16, -22], ["barrelOrange", -11, -14], ["seedSack", -10, -13], ["wSignBoard", -4, -15],
    # lamps at an even spacing, signs, mailboxes
    ["lampPost", 4, -17], ["lampPost", 12, -15], ["lampPost", 16, -2], ["lampPost", 20, -2], ["lampPost", 11, 4], ["lampPost", 23, 4], ["lampPost", 29, 4], ["lampPost", 36, 4], ["lampPost", 41, 0],
    ["streetSign", 43, 0], ["signGreenWide", 3, -19], ["noticeBoard", 17, 5], ["wMailbox", 14, -19], ["wMailbox", 28, -19], ["wMailbox", 31, 0],
    ["crateWide", 21, 13], ["barrelOrange", 22, 13], ["maRowboat", 22, 17], ["crateBox", 34, 13], ["maRowboat", 36, 16], ["barrelDark", 30, 13], ["maRowboat", 12, 16], ["crateBox", 16, 13],
]
# sprinkled shore detail in clusters: dry tufts, shells and pebbles round the boats and rocks
rng = random.Random(55)
for cx, cy in ((-10, -12), (-8, -24), (-5, -8), (-14, -4), (2, -14), (-6, 12), (4, 11), (-12, 11)):
    for _ in range(4):
        props.append([rng.choice(['dryTuft', 'shell', 'pebbles', 'grassBlades', 'dryTuft']), cx + rng.randint(-3, 3), cy + rng.randint(-2, 2)])
deco = []
# yards: a picket fence along the front, round bushes up the sides, a hedge behind, a flower bed each side of the house
yards = [(8, 4, 1, -20), (24, 4, 1, -20), (33, 4, 2, -1), (13, 4, 1, 11), (25, 4, 1, 11), (38, 4, 1, 11)]
for fx, w, ex, fy in yards:
    c0 = fx - ex
    deco += [["row", "mPicketFence", c0 - 2, fy + 1, c0 + w + 1, fy + 1, .9],
             ["row", "roundBush", c0 - 2, fy - 4, c0 - 2, fy, 1.3], ["row", "roundBush", c0 + w + 1, fy - 4, c0 + w + 1, fy, 1.3],
             ["row", "hedgeLong", c0 - 2, fy - 5, c0 + w + 1, fy - 5, 1.4],
             ["row", "flowerBedBlue" if fx % 2 else "flowerBedPink", c0 - 1, fy - 1, c0 - 1, fy - 1, 1], ["row", "flowerBedPink" if fx % 2 else "flowerBedBlue", c0 + w, fy - 1, c0 + w, fy - 1, 1]]
deco += [
    ["fam", "grove-round", 36, -12], ["fam", "grove-oak", 44, -18], ["fam", "grove-pine", 48, -6], ["fam", "grove-oak", 46, 7], ["fam", "grove-round", 52, 12],
    ["fam", "grove-oak", 12, -27], ["fam", "grove-pine", 34, -30], ["fam", "grove-round", 46, -28], ["fam", "grove-oak", 2, -30],
    ["fam", "bushes", 6, -12], ["fam", "drift-a", 10, -6], ["fam", "drift-b", 14, -12], ["fam", "outcrop-s", -12, -3], ["fam", "outcrop-s", -16, 12], ["fam", "outcrop-s", -14, -16], ["fam", "reeds", 14, 14], ["fam", "reeds", 28, 14],
    ["plot", 8, -13, 8, 5, 0], ["plot", 30, -16, 8, 5, 1], ["pond", 12, -6, 3, 2],
]
out = dict(door=[13, 0], lim=48, paving=paving, plazas=plazas, boards=boards, buildings=buildings, props=props, deco=deco)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'T5.json'), 'w', encoding='utf8').write(json.dumps(out, separators=(',', ':')))
print('T5.json written:', len(buildings), 'buildings,', len(props), 'props,', len(deco), 'deco')
