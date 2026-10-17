"""Builds assets/adv/exterior.png and data/adv/tileset.js from the Silver Gallium exterior sheet.
Run: py -3.12 -I tools/adv-build-tileset.py
The sheet is not tile aligned (ground sets are 64x64 patches at 16px offsets, props are free sprites), so
ground roles are cut as 32x32 windows and appended as extra rows below the original sheet. Original
pixels stay at the same coordinates, so prop rects are plain sheet coordinates."""
import json, runpy
from pathlib import Path
import numpy as np
from PIL import Image

SRC = r'C:\Users\lando\Desktop\Pokemon Silver Gallium\assets\tile sheets\exterior_tileset.png'
ROOT = Path(__file__).resolve().parent.parent
T, COLS = 32, 8
ROLES = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW']

# Baked opaque grey cast-shadow colours to turn into translucent black. Sampled: none left, the sheet already
# stores its shadows as (0,0,0,89) / (0,0,0,77) black. Add exact RGB triples here if a future sheet has flat ones.
SHADOW_RGB = []
SHADOW_ALPHA = 89

sheet = np.array(Image.open(SRC).convert('RGBA'))
for rgb in SHADOW_RGB:
    m = (sheet[..., 3] == 255) & (sheet[..., :3] == rgb).all(-1)
    sheet[m] = (0, 0, 0, SHADOW_ALPHA)
H0 = sheet.shape[0]
BASE_ROWS = -(-H0 // T)
extra = []
_seen = {}


def add(tile):
    k = tile.tobytes()
    if k not in _seen:
        _seen[k] = BASE_ROWS * COLS + len(extra)
        extra.append(tile.copy())
    return _seen[k]


def cut(x, y, w=T, h=T):
    out = np.zeros((h, w, 4), np.uint8)
    ys, xs = max(0, y), max(0, x)
    ye, xe = min(H0, y + h), min(256, x + w)
    out[ys - y:ye - y, xs - x:xe - x] = sheet[ys:ye, xs:xe]
    return out


def tid(c, r):
    return r * COLS + c


def notch(C, edge, cx, cy, flip):
    """Inner corner: copy of C with a quarter disc (radius 16) of the edge fringe around corner (cx,cy)."""
    out = C.copy()
    for y in range(16):
        for x in range(16):
            px, py = (cx - x if cx else x), (cy - y if cy else y)
            d = int(((x + .5) ** 2 + (y + .5) ** 2) ** .5)
            if d >= 16: continue
            row = (31 - d) if flip else d
            out[py, px] = edge[row, (x + y + 8) % 32]
    return out


def patch_set(ox, oy, pw=64, ph=64):
    ex, ey = pw - 32, ph - 32
    pos = dict(C=(ex // 2, ey // 2), N=(ex // 2, 0), S=(ex // 2, ey), E=(ex, ey // 2), W=(0, ey // 2), NE=(ex, 0), NW=(0, 0), SE=(ex, ey), SW=(0, ey))
    w = {k: cut(ox + dx, oy + dy) for k, (dx, dy) in pos.items()}
    C = w['C']
    w['iNW'] = notch(C, w['N'], 0, 0, False)
    w['iNE'] = notch(C, w['N'], 31, 0, False)
    w['iSW'] = notch(C, w['S'], 0, 31, True)
    w['iSE'] = notch(C, w['S'], 31, 31, True)
    m = {k: add(w[k]) for k in ROLES}
    m['overlay'] = any((w[k][..., 3] < 255).any() for k in ROLES[:9])
    return m


def plant_tile(rect):
    x, y, w, h = rect
    s = cut(x, y, w, h)
    t = np.zeros((T, T, 4), np.uint8)
    for i in range(2):
        for j in range(2):
            t[j * 16:j * 16 + h, i * 16:i * 16 + w] = s[:16, :16]
    return add(t)


# ground sets: name -> patch origin (64x64 patch on the sheet; roles are windows of it)
PATCH = [
    ('sand', 16, 2000), ('duneSand', 16, 2192), ('hayField', 16, 2448), ('path', 16, 2544), ('soilTilled', 112, 2512),
    ('soilCobble', 112, 2608), ('snow', 19, 2640, 58, 63), ('snowFluffy', 19, 2742, 58, 55), ('pavingGrey', 16, 2960), ('pavingStone', 111, 2959),
    ('pavingTan', 15, 3056), ('redDirt', 16, 3152), ('ashGround', 115, 3156, 58, 55), ('boardwalk', 112, 3344), ('redCarpet', 16, 3440),
    ('sandWaterDeep', 16, 3568), ('sandWater', 112, 3568), ('waterDeep', 16, 3663), ('water', 112, 3663),
    ('darkSandWaterDeep', 16, 3760), ('darkSandWater', 112, 3760), ('waterDeepB', 16, 3856), ('poolTeal', 112, 3856),
    ('waterGrey', 16, 4017), ('pondBright', 17, 4113, 62, 62), ('pondBrightDeep', 112, 4112), ('caveWater', 16, 4208), ('caveWaterB', 115, 4208, 57, 63),
    ('pondBlue', 17, 4369, 62, 62), ('pondTeal', 113, 4369, 62, 52), ('lava', 17, 4561, 62, 62), ('swamp', 112, 4560, 64, 63), ('icePond', 17, 4689, 62, 62),
]
PLANTS = [('tallgrass', 'leafPlant'), ('tallgrassDark', 'leafPlantDark'), ('tallgrassGrey', 'leafPlantGrey'), ('tallgrassFrost', 'leafPlantFrost')]

PROPS = [
    ('roundTreeLime', 'tree', 14, 19, 36, 45),
    ('roundTree', 'tree', 78, 19, 36, 45),
    ('roundTreeTeal', 'tree', 142, 19, 36, 45),
    ('roundTreeDark', 'tree', 206, 19, 36, 45),
    ('roundTreeTallLime', 'tree', 12, 83, 40, 45),
    ('roundTreeTall', 'tree', 76, 83, 40, 45),
    ('roundTreeTallTeal', 'tree', 140, 83, 40, 45),
    ('roundTreeTallDark', 'tree', 204, 83, 40, 45),
    ('layerTreeLime', 'tree', 12, 144, 40, 48),
    ('layerTree', 'tree', 76, 144, 40, 48),
    ('layerTreeTeal', 'tree', 140, 144, 40, 48),
    ('layerTreeDark', 'tree', 204, 144, 40, 48),
    ('bigRoundTreeLime', 'tree', 9, 205, 46, 51),
    ('bigRoundTree', 'tree', 73, 205, 46, 51),
    ('bigRoundTreeTeal', 'tree', 137, 205, 46, 51),
    ('bigRoundTreeDark', 'tree', 201, 205, 46, 51),
    ('canopyTreeLime', 'tree', 8, 264, 47, 56),
    ('canopyTree', 'tree', 72, 264, 47, 56),
    ('canopyTreeTeal', 'tree', 136, 264, 47, 56),
    ('canopyTreeDark', 'tree', 200, 264, 47, 56),
    ('canopyTreeRed', 'tree', 8, 319, 47, 65),
    ('canopyTreeOrange', 'tree', 72, 319, 47, 65),
    ('canopyTreeOlive', 'tree', 136, 319, 47, 65),
    ('pineTreeLime', 'tree', 5, 411, 53, 69),
    ('pineTree', 'tree', 69, 411, 53, 69),
    ('pineTreeTeal', 'tree', 133, 411, 53, 69),
    ('pineTreeDark', 'tree', 197, 411, 53, 69),
    ('spruceTreeLime', 'tree', 5, 506, 54, 70),
    ('spruceTree', 'tree', 69, 506, 54, 70),
    ('spruceTreeTeal', 'tree', 133, 506, 54, 70),
    ('spruceTreeDark', 'tree', 197, 506, 54, 70),
    ('bushyOakLime', 'tree', 4, 601, 57, 71),
    ('bushyOak', 'tree', 68, 601, 57, 71),
    ('bushyOakTeal', 'tree', 132, 601, 57, 71),
    ('bushyOakDark', 'tree', 196, 601, 57, 71),
    ('roundOakLime', 'tree', 3, 702, 56, 65),
    ('roundOak', 'tree', 67, 702, 56, 65),
    ('roundOakTeal', 'tree', 131, 702, 56, 65),
    ('roundOakDark', 'tree', 195, 702, 56, 65),
    ('coneTreeOlive', 'tree', 8, 786, 48, 46),
    ('coneTreeBrown', 'tree', 72, 786, 48, 46),
    ('coneTreeMoss', 'tree', 136, 786, 48, 46),
    ('coneTreeGrey', 'tree', 199, 786, 48, 46),
    ('snowPine', 'tree', 13, 850, 39, 40),
    ('snowFir', 'tree', 78, 851, 36, 36),
    ('snowDomeTree', 'tree', 142, 851, 36, 37),
    ('snowFirB', 'tree', 204, 851, 40, 35),
    ('snowCanopy', 'tree', 202, 909, 44, 43),
    ('snowDomeTreeB', 'tree', 12, 915, 40, 37),
    ('snowFirC', 'tree', 80, 912, 36, 35),
    ('snowDomeTreeC', 'tree', 140, 912, 40, 41),
    ('snowBlob', 'tree', 9, 973, 46, 43),
    ('snowDomeTreeD', 'tree', 136, 968, 47, 40),
    ('snowPineLarge', 'tree', 69, 1051, 53, 55),
    ('snowPineLargeB', 'tree', 197, 1050, 54, 51),
    ('snowBigDome', 'tree', 196, 1150, 56, 53),
    ('oliveRoundTree', 'tree', 12, 1234, 40, 46),
    ('mangroveTree', 'tree', 78, 1235, 36, 45),
    ('oliveRoundTreeB', 'tree', 139, 1235, 42, 45),
    ('bushCluster', 'tree', 200, 1232, 48, 48),
    ('baobabTree', 'tree', 74, 1293, 44, 51),
    ('pineSapling', 'tree', 3, 1301, 26, 43),
    ('pineSaplingTeal', 'tree', 35, 1302, 26, 42),
    ('trunkOak', 'tree', 140, 1297, 40, 47),
    ('organCactus', 'tree', 208, 1297, 32, 47),
    ('palmTreeBig', 'tree', 133, 1342, 53, 63),
    ('frostMushroomTree', 'tree', 200, 1350, 48, 58),
    ('palmTree', 'tree', 14, 1354, 36, 54),
    ('darkConeTree', 'tree', 74, 1359, 42, 49),
    ('hollowStump', 'tree', 200, 1414, 48, 58),
    ('palmHammock', 'tree', 13, 1432, 100, 40),
    ('ashTree', 'tree', 11, 1490, 41, 46),
    ('deadTree', 'tree', 78, 1489, 38, 47),
    ('brightRoundTree', 'tree', 205, 1488, 38, 48),
    ('oliveConeTree', 'tree', 109, 1556, 38, 44),
    ('brightPine', 'tree', 72, 1564, 16, 36),
    ('hollowTrunkTall', 'tree', 135, 1404, 49, 68),
    ('deadPine', 'tree', 135, 1472, 49, 64),
    ('bigOakVinesLime', 'tree', 8, 1602, 82, 128),
    ('bigOakVines', 'tree', 8, 1730, 82, 128),
    ('bigOakVinesDark', 'tree', 8, 1858, 82, 125),
    ('bigOakLime', 'tree', 102, 1602, 83, 128),
    ('bigOak', 'tree', 102, 1730, 83, 128),
    ('bigOakDark', 'tree', 102, 1858, 83, 125),
    ('fallenLog', 'prop', 192, 1551, 30, 14),
    ('frozenLog', 'prop', 192, 1582, 30, 15),
    ('logShort', 'prop', 192, 1615, 31, 17),
    ('stumpSmall', 'prop', 232, 1618, 16, 14),
    ('stumpLarge', 'prop', 192, 1759, 32, 33),
    ('mushroomStump', 'prop', 232, 1554, 16, 46),
    ('miniTree', 'tree', 233, 1644, 16, 20),
    ('poplarBush', 'bush', 176, 1695, 39, 33),
    ('fern', 'tuft', 232, 1674, 16, 22),
    ('roundBush', 'bush', 192, 1736, 32, 24),
    ('whiteBlossomBush', 'bush', 233, 1766, 16, 26),
    ('saplingTree', 'tree', 200, 1644, 16, 20),
    ('poplarSmall', 'tree', 200, 1665, 16, 31),
    ('poplarMed', 'tree', 233, 1695, 16, 34),
    ('poplarTall', 'tree', 233, 1729, 16, 31),
    ('cactus', 'bush', 184, 1791, 40, 45),
    ('cactusFlowering', 'bush', 225, 1795, 30, 29),
    ('leafPlant', 'tuft', 232, 2183, 16, 16),
    ('leafPlantB', 'tuft', 200, 2247, 16, 16),
    ('leafPlantDark', 'tuft', 136, 2279, 15, 16),
    ('leafPlantC', 'tuft', 200, 2377, 16, 16),
    ('leafPlantGrey', 'tuft', 200, 2409, 16, 16),
    ('leafPlantFrost', 'tuft', 199, 2729, 16, 16),
    ('grassBlades', 'tuft', 200, 2279, 15, 14),
    ('dryTuft', 'tuft', 200, 2311, 16, 16),
    ('mushroomsOrange', 'tuft', 41, 2312, 14, 15),
    ('mushroomsPale', 'tuft', 40, 2343, 13, 15),
    ('mushroomsOrangeB', 'tuft', 10, 2344, 14, 15),
    ('boneSkull', 'tuft', 9, 2376, 14, 15),
    ('shell', 'tuft', 41, 2377, 13, 13),
    ('seedSack', 'tuft', 8, 2409, 14, 15),
    ('flowersBlue', 'tuft', 106, 2473, 15, 15),
    ('flowersOrange', 'tuft', 136, 2472, 16, 15),
    ('flowersWhite', 'tuft', 168, 2474, 16, 15),
    ('reeds', 'tuft', 168, 2755, 16, 29),
    ('reedsPair', 'tuft', 160, 2787, 32, 29),
    ('reedsOlive', 'tuft', 200, 2789, 16, 23),
    ('reedsOliveWide', 'tuft', 224, 2793, 32, 23),
    ('reedsDark', 'tuft', 136, 2819, 16, 29),
    ('mushroomsRed', 'tuft', 105, 2825, 14, 15),
    ('sprout', 'tuft', 105, 2858, 14, 12),
    ('sproutB', 'tuft', 137, 2858, 14, 12),
    ('bubbles', 'tuft', 167, 2856, 18, 24),
    ('leafBushPale', 'tuft', 200, 2857, 15, 16),
    ('sproutPot', 'tuft', 106, 2890, 13, 10),
    ('sproutLeaf', 'tuft', 138, 2892, 13, 8),
    ('coralPink', 'tuft', 171, 2891, 11, 13),
    ('seedPile', 'tuft', 200, 2891, 14, 8),
    ('coralRed', 'tuft', 170, 2919, 10, 14),
    ('pebbles', 'tuft', 202, 2921, 12, 12),
    ('itemBall', 'tuft', 10, 2315, 10, 10),
    ('stoneGrey', 'rock', 234, 2890, 14, 14),
    ('stonesPair', 'rock', 225, 2919, 29, 15),
    ('bigRockPinkWater', 'rock', 129, 6179, 29, 28),
    ('bigRockGreyWater', 'rock', 161, 6179, 29, 28),
    ('bigRockMintWater', 'rock', 193, 6179, 29, 28),
    ('rockPink', 'rock', 233, 6184, 15, 14),
    ('bigRockPink', 'rock', 130, 6211, 28, 28),
    ('bigRockGrey', 'rock', 162, 6211, 28, 28),
    ('bigRockMint', 'rock', 194, 6211, 28, 28),
    ('rockPinkB', 'rock', 232, 6216, 15, 14),
    ('rockMintB', 'rock', 9, 6250, 14, 15),
    ('rockGrey', 'rock', 40, 6248, 15, 14),
    ('rockGreyB', 'rock', 73, 6248, 15, 14),
    ('rockGreyPair', 'rock', 105, 6249, 15, 13),
    ('rockMint', 'rock', 137, 6248, 15, 14),
    ('rockMintC', 'rock', 169, 6249, 15, 14),
    ('rockMintPair', 'rock', 201, 6249, 15, 13),
    ('rockPinkPair', 'rock', 233, 6250, 15, 13),
    ('boulderMint', 'rock', 2, 6275, 27, 27),
    ('boulderMintB', 'rock', 34, 6275, 27, 27),
    ('standingStoneMint', 'rock', 104, 6274, 15, 29),
    ('standingStoneMintTall', 'rock', 137, 6276, 15, 25),
    ('crystalBlueTall', 'rock', 232, 6276, 16, 25),
    ('rockMintD', 'rock', 72, 6281, 14, 15),
    ('rockDark', 'rock', 167, 6281, 17, 16),
    ('crystalBlue', 'rock', 201, 6282, 15, 15),
    ('boulderGrey', 'rock', 100, 6307, 24, 27),
    ('rockLavaBig', 'rock', 160, 6304, 32, 32),
    ('rockLava', 'rock', 136, 6313, 16, 16),
    ('twigs', 'rock', 201, 6316, 14, 11),
    ('rockBrown', 'rock', 232, 6313, 16, 16),
    ('rockBrownB', 'rock', 200, 6346, 15, 15),
    ('rockBrownC', 'rock', 234, 6346, 15, 15),
    ('rockSnowCap', 'rock', 8, 6377, 15, 15),
    ('snowBall', 'rock', 42, 6378, 15, 15),
    ('rockWater', 'rock', 71, 6378, 16, 16),
    ('crystalDark', 'rock', 106, 6378, 13, 14),
    ('crystalBlueFlat', 'rock', 138, 6379, 13, 12),
    ('crystalDarkB', 'rock', 169, 6377, 15, 16),
    ('rockBlue', 'rock', 201, 6378, 15, 15),
    ('rockBrownSmall', 'rock', 169, 8523, 14, 11),
    ('rockBlueSmall', 'rock', 136, 8554, 14, 11),
    ('rockDarkSmall', 'rock', 169, 8554, 14, 11),
    ('rockMoundBrown', 'rock', 202, 8303, 46, 32),
    ('rockMoundBlue', 'rock', 202, 8367, 46, 32),
    ('dirtMound', 'rock', 202, 8239, 46, 32),
    ('boulderBrown', 'rock', 233, 9259, 16, 15),
    ('caveHole', 'deco', 168, 6345, 16, 21),
    ('caveRock', 'cave', 140, 6440, 40, 40),
    ('caveRockB', 'cave', 205, 6440, 40, 40),
    ('caveRockC', 'cave', 12, 6504, 40, 40),
    ('caveRockD', 'cave', 76, 6504, 40, 40),
    ('caveRockMoss', 'cave', 141, 6504, 40, 40),
    ('caveRockIce', 'cave', 205, 6504, 40, 40),
    ('caveRockWater', 'cave', 12, 6568, 40, 40),
    ('caveRockWaterB', 'cave', 76, 6568, 40, 40),
    ('caveRockLit', 'cave', 140, 6568, 40, 40),
    ('stoneTerraceBlock', 'wall', 16, 6898, 68, 90),
    ('stoneRing', 'wall', 8, 7008, 84, 94),
    ('stoneTowerGrass', 'wall', 115, 7029, 60, 73),
    ('stoneStaircase', 'wall', 64, 7150, 48, 48),
    ('stoneStaircaseTall', 'wall', 64, 7311, 48, 47),
    ('stoneTerraceLow', 'wall', 64, 7105, 48, 30),
    ('stoneStairsWide', 'wall', 144, 7761, 48, 45),
    ('stoneGateStack', 'wall', 144, 6624, 96, 127),
    ('bigGreenTree', 'tree', 9, 7757, 76, 78),
    ('stoneTower', 'wall', 179, 7221, 60, 73),
    ('stoneCourt', 'wall', 175, 7630, 68, 78),
    ('roseBush', 'bush', 7, 8040, 17, 24),
    ('planterGrass', 'prop', 18, 8066, 60, 28),
    ('pottedPlantTall', 'prop', 104, 8066, 14, 30),
    ('cratePlant', 'prop', 136, 8077, 14, 19),
    ('crateBox', 'prop', 169, 8078, 14, 18),
    ('streetSign', 'sign', 202, 8097, 12, 31),
    ('noticeBoard', 'sign', 233, 8102, 16, 24),
    ('planterBoxBrown', 'prop', 18, 8105, 62, 23),
    ('planterBoxGreen', 'prop', 114, 8105, 62, 23),
    ('signGreen', 'sign', 2, 8132, 30, 26),
    ('signGreenWide', 'sign', 42, 8131, 46, 27),
    ('flowerBedBlue', 'flower', 107, 8129, 44, 29),
    ('flowersBlueTall', 'flower', 170, 8132, 12, 24),
    ('flowerBedPink', 'flower', 202, 8130, 44, 29),
    ('flowersPinkTall', 'flower', 202, 8164, 12, 24),
    ('sunflower', 'flower', 7, 8174, 14, 32),
    ('sunflowerPatch', 'flower', 41, 8168, 46, 48),
    ('ladder', 'prop', 232, 8174, 16, 50),
    ('benchYellow', 'prop', 138, 8178, 47, 13),
    ('hedgeLong', 'bush', 199, 8430, 46, 32),
    ('hedgeLongB', 'bush', 199, 8494, 46, 32),
    ('hedgeLongC', 'bush', 199, 8558, 46, 32),
    ('bushOlive', 'bush', 71, 8521, 16, 13),
    ('bush', 'bush', 105, 8521, 16, 13),
    ('bushDark', 'bush', 137, 8521, 16, 13),
    ('palisadeGate', 'fence', 120, 8966, 48, 46),
    ('picketFenceLong', 'fence', 17, 9031, 62, 48),
    ('fenceLattice', 'fence', 168, 9029, 80, 59),
    ('stairsWood', 'prop', 107, 9047, 48, 48),
    ('marketAwning', 'prop', 0, 9088, 64, 64),
    ('lampPost', 'lamp', 73, 9101, 14, 47),
    ('lampPostDouble', 'lamp', 160, 9097, 32, 47),
    ('lampPostLeft', 'lamp', 199, 9097, 21, 47),
    ('lampPostRight', 'lamp', 229, 9097, 22, 47),
    ('vaseGold', 'prop', 104, 9127, 14, 16),
    ('vaseBlue', 'prop', 137, 9127, 14, 16),
    ('gemStand', 'prop', 8, 9146, 22, 31),
    ('drawers', 'prop', 30, 9144, 24, 37),
    ('bookshelf', 'prop', 106, 9155, 12, 27),
    ('cabinetSmall', 'prop', 74, 9162, 12, 15),
    ('cabinetDoor', 'prop', 138, 9163, 12, 15),
    ('bowlOrange', 'prop', 168, 9161, 16, 15),
    ('bowlGreen', 'prop', 201, 9162, 14, 13),
    ('flowerPot', 'prop', 168, 9190, 16, 23),
    ('balloonPot', 'prop', 200, 9185, 16, 28),
    ('stoneBridgeGate', 'wall', 8, 9194, 112, 115),
    ('vendingRed', 'prop', 233, 9192, 16, 16),
    ('totemStump', 'prop', 226, 9296, 30, 48),
    ('torchPost', 'lamp', 73, 9320, 14, 48),
    ('fencePenMint', 'fence', 37, 9457, 72, 79),
    ('fencePenWood', 'fence', 137, 9456, 71, 77),
    ('fencePole', 'fence', 5, 9513, 7, 47),
    ('tentPair', 'prop', 208, 9543, 32, 25),
    ('benchTeal', 'prop', 53, 9553, 24, 15),
    ('fenceRail', 'fence', 0, 9567, 65, 29),
    ('waterTank', 'prop', 233, 9572, 14, 24),
    ('crateWide', 'prop', 72, 9576, 15, 16),
    ('crateWideB', 'prop', 201, 9576, 15, 16),
    ('mailbox', 'prop', 75, 9605, 10, 21),
    ('barrelOrange', 'prop', 168, 9606, 15, 24),
    ('barrelDark', 'prop', 201, 9606, 15, 24),
    ('barrelOrangeB', 'prop', 233, 9606, 15, 24),
    ('stoolGrey', 'prop', 9, 9608, 14, 16),
    ('stoolGreyB', 'prop', 41, 9608, 14, 16),
    ('pokeSign', 'sign', 39, 9634, 16, 30),
    ('oven', 'prop', 72, 9636, 16, 25),
    ('trafficCone', 'prop', 9, 9640, 14, 15),
    ('ventPipe', 'prop', 104, 9641, 14, 16),
    ('tripodLamp', 'lamp', 137, 9641, 14, 14),
    ('standRed', 'prop', 168, 9645, 16, 36),
    ('standOrange', 'prop', 201, 9644, 16, 36),
    ('standLilac', 'prop', 233, 9644, 16, 36),
    ('phoneBox', 'prop', 7, 9665, 15, 29),
    ('machineBlue', 'prop', 34, 9666, 29, 29),
    ('machineWhite', 'prop', 65, 9666, 29, 29),
    ('pokeBallBox', 'prop', 137, 9676, 15, 13),
    ('curtainTan', 'prop', 8, 9697, 14, 30),
    ('woodGate', 'fence', 80, 9698, 32, 28),
    ('globeTeal', 'prop', 136, 9700, 16, 24),
    ('orbGold', 'prop', 168, 9700, 16, 24),
    ('statueDog', 'prop', 229, 9706, 23, 41),
    ('blueDoor', 'prop', 8, 9743, 16, 35),
    ('flowerBowl', 'prop', 41, 9737, 15, 15),
    ('truckPink', 'prop', 105, 10053, 87, 59),
    ('boatWhite', 'prop', 204, 10060, 41, 106),
    ('vanGrey', 'prop', 105, 10126, 38, 49),
    ('speedboat', 'prop', 0, 10189, 120, 43),
    ('trainEngine', 'prop', 3, 10252, 60, 130),
    ('bulldozer', 'prop', 7, 10429, 77, 66),
    ('airplane', 'prop', 106, 10434, 138, 123),
    ('pokeCenterRed', 'building', 8, 11521, 88, 112),
    ('martBlue', 'building', 89, 11535, 95, 97),
    ('pokeCenterWhite', 'building', 0, 11630, 96, 133),
    ('martWhite', 'building', 89, 11663, 95, 97),
    ('pokeCenterWave', 'building', 7, 11759, 88, 110),
    ('martWave', 'building', 89, 11759, 87, 110),
    ('pokeCenterOrange', 'building', 6, 11980, 88, 125),
    ('labGrey', 'building', 91, 12019, 81, 86),
    ('labWhite', 'building', 6, 12103, 88, 139),
    ('houseRedGable', 'building', 11, 12239, 82, 137),
    ('houseRedRoof', 'building', 106, 12263, 106, 98),
    ('houseBlueGable', 'building', 11, 12373, 82, 131),
    ('houseBlueRoof', 'building', 106, 12391, 106, 98),
    ('cottageGreen', 'building', 5, 12719, 79, 105),
    ('cottageGreenWide', 'building', 101, 12719, 97, 105),
    ('cottageRed', 'building', 5, 12822, 79, 129),
    ('cottageRedWide', 'building', 101, 12822, 97, 129),
    ('cabinGreen', 'building', 25, 13237, 70, 97),
    ('cabinGreenWide', 'building', 104, 13237, 89, 97),
    ('houseOrangeTilt', 'building', 9, 13536, 72, 119),
    ('houseOrangeSplit', 'building', 108, 13546, 73, 107),
    ('houseBlueSplit', 'building', 10, 13648, 72, 134),
    ('houseGreenSplit', 'building', 108, 13652, 73, 130),
    ('houseOrangeFlat', 'building', 8, 13780, 73, 132),
    ('houseGreenFlat', 'building', 104, 13780, 77, 132),
    ('houseOrangeSmall', 'building', 115, 14030, 73, 103),
    ('apartmentGrey', 'building', 117, 14128, 88, 158),
    ('apartmentGreyWide', 'building', 35, 14158, 88, 136),
    ('houseBlueTall', 'building', 19, 14286, 81, 137),
    ('apartmentGreyLong', 'building', 100, 14283, 121, 140),
    ('chaletRed', 'building', 14, 14916, 94, 128),
    ('chaletRedB', 'building', 142, 14916, 93, 128),
    ('chaletPink', 'building', 14, 15044, 97, 170),
    ('chaletRedChimney', 'building', 135, 15043, 111, 176),
    ('chaletRedBig', 'building', 8, 15210, 119, 183),
    ('manorPink', 'building', 159, 15211, 78, 136),
    ('manorPinkB', 'building', 167, 15344, 73, 128),
    ('manorOrange', 'building', 44, 15400, 75, 147),
    ('manorOrangeB', 'building', 167, 15469, 74, 134),
    ('barnOrange', 'building', 8, 15541, 85, 129),
    ('thatchHouse', 'building', 27, 15662, 93, 149),
    ('thatchHouseSmall', 'building', 142, 15686, 78, 129),
    ('thatchBarn', 'building', 2, 15809, 125, 158),
    ('houseBlueDome', 'building', 158, 15811, 92, 156),
    ('houseRedCross', 'building', 38, 15956, 78, 129),
    ('treeHouse', 'building', 166, 15965, 83, 107),
    ('strawHut', 'building', 48, 16083, 66, 105),
    ('cottageTeal', 'building', 175, 16099, 72, 113),
    ('lodgeOrange', 'building', 2, 16199, 153, 129),
    ('moundHut', 'building', 151, 16210, 92, 111),
    ('gymTealTall', 'building', 4, 16322, 102, 197),
    ('gymTeal', 'building', 137, 16364, 118, 137),
    ('inn', 'building', 49, 16511, 161, 174),
    ('domeHall', 'building', 135, 16673, 118, 175),
    ('tavern', 'building', 8, 16681, 112, 178),
    ('pokeCenterGrand', 'building', 34, 16842, 164, 166),
    ('gymRed', 'building', 6, 17005, 114, 176),
    ('hotelBlue', 'building', 131, 17007, 125, 170),
    ('warehouse', 'building', 37, 17168, 187, 170),
    ('museum', 'building', 47, 17324, 177, 204),
    ('pagodaDark', 'building', 127, 17502, 119, 296),
    ('dojoDark', 'building', 17, 17527, 109, 130),
    ('barnRed', 'building', 15, 17678, 106, 107),
    ('hutStraw', 'building', 7, 17780, 56, 102),
    ('tipi', 'building', 62, 17777, 98, 110),
    ('pyramidTemple', 'building', 117, 17872, 130, 214),
    ('pagodaBlue', 'building', 3, 17880, 92, 206),
    ('goldTemple', 'building', 108, 18085, 138, 227),
    ('roundTower', 'building', 13, 18156, 68, 148),
    ('stadium', 'building', 15, 18367, 218, 213),
    ('hall', 'building', 6, 18599, 116, 118),
    ('hotelGrey', 'building', 130, 18607, 94, 144),
    ('castle', 'building', 27, 18786, 205, 262),
    ('martTower', 'building', 11, 19150, 116, 218),
    ('clockTower', 'building', 147, 19145, 102, 223),
]

# door x offset from the anchor (px); buildings not listed use 0 (centre entrance or no visible door)
DOORS = {k: (v, -2) for k, v in dict(
    pokeCenterWhite=3,
    martBlue=-10,
    martWhite=-10,
    martWave=-5,
    labGrey=-24,
    houseRedGable=-18,
    houseRedRoof=-50,
    houseBlueGable=-15,
    houseBlueRoof=-45,
    cottageGreen=-9,
    cottageRed=-9,
    cabinGreen=-3,
    houseOrangeTilt=-9,
    houseOrangeSplit=-9,
    houseBlueSplit=-9,
    houseGreenSplit=-8,
    houseOrangeFlat=-8,
    houseGreenFlat=-8,
    houseOrangeSmall=-8,
    houseBlueTall=-8,
    chaletRed=-7,
    chaletPink=-14,
    chaletRedChimney=-27,
    chaletRedBig=-15,
    manorPink=-7,
    manorPinkB=9,
    manorOrange=19,
    barnOrange=-20,
    thatchHouse=-14,
    thatchHouseSmall=12,
    thatchBarn=9,
    houseBlueDome=-9,
    houseRedCross=-9,
    treeHouse=1,
    cottageTeal=-8,
    lodgeOrange=-36,
    moundHut=-3,
    inn=1,
    domeHall=-3,
    warehouse=-22,
).items()}

ANCH = {}


def trim(x, y, w, h):
    return cut(x, y, w, h)[..., 3]


def build_props():
    out = {}
    for n, kind, x, y, w, h in PROPS:
        a = trim(x, y, w, h)
        op = a >= 128
        if not op.any(): op = a > 0
        cnt = op.sum(1)
        top = next((r for r in range(h) if (cnt[r:r + 8] > 0).all()), 0)
        if top:  # drop stray pixels and translucent shadow tails of the sprite above (nothing casts upwards)
            y, h, a, op = y + top, h - top, a[top:], op[top:]
        rows = np.where(op.any(1))[0]
        ym = int(rows[-1])
        band = np.where(op[max(0, ym - 2):ym + 1].any(0))[0]
        ax, ay = (int(band.min()) + int(band.max())) // 2, ym + 1
        if n in ANCH: ax, ay = ANCH[n]
        ob = np.where(op[max(0, ym - 7):ym + 1].any(0))[0]
        wo = int(ob.max() - ob.min() + 1)
        wb = int(band.max() - band.min() + 1)
        cl = lambda v, a_, b_: max(a_, min(b_, v))
        hw = None
        if kind == 'tree':
            hw = cl(round(wb * .35), 3, 10); s = [-hw, -5, hw, 1]
        elif kind in ('bush', 'rock'):
            hw = cl(round(wo * .42), 3, 40); s = [-hw, -min(8, h // 2), hw, 1]
        elif kind == 'sign': s = [-5, -4, 5, 1]
        elif kind == 'lamp': s = [-3, -3, 3, 1]
        elif kind == 'fence': s = [-(wo // 2), -3, wo // 2, 1]
        elif kind in ('flower', 'tuft', 'deco'): s = None
        elif kind == 'cave': hw = round(wo * .4); s = [-hw, -8, hw, 1]
        elif kind == 'wall': hw = max(3, wo // 2 - 2); s = [-hw, -min(16, h // 3), hw, 1]
        elif kind == 'building':
            wb6 = np.where(op[max(0, ym - 5):ym + 1].any(0))[0]
            hw = int((wb6.max() - wb6.min()) // 2 - 1); s = [-hw, -min(28, max(12, h // 4)), hw, 1]
        else: hw = max(3, round(wo * .45)); s = [-hw, -min(10, max(3, h // 2)), hw, 1]
        if s: s = [max(s[0], -ax), s[1], min(s[2], w - ax), s[3]]   # the blocked rect never reaches past the drawn sprite
        e = dict(sx=x, sy=y, sw=w, sh=h, ax=ax, ay=ay, solid=s)
        if kind == 'building':
            dx, dy = DOORS.get(n, (0, -2))
            e['door'] = [dx, dy]
        out[n] = e
    return out


def ford_set(w):
    """walkable shallow water: the water tiles palette-swapped lighter (a recolour of the real tiles)"""
    swap = lambda t: np.concatenate([np.clip(t[..., :3].astype(int) + ((255 - t[..., :3].astype(int)) * .42).astype(int), 0, 255), t[..., 3:]], -1).astype(np.uint8)
    return {k: add(swap(extra[w[k] - BASE_ROWS * COLS])) for k in ROLES}


def wet_grass():
    """damp meadow: the plain grass tile pushed a step darker and bluer (a recolour of the real tile)"""
    g = sheet[70 * T:71 * T, 3 * T:4 * T].copy()
    g[..., 0] = (g[..., 0] * .84).astype(np.uint8); g[..., 1] = (g[..., 1] * .94).astype(np.uint8); g[..., 2] = np.minimum(255, g[..., 2] * 1.06).astype(np.uint8)
    return {'C': [add(g)]}


PACK_W = 320                                     # the sheet is 320 wide below the tile rows so the widest community buildings fit (mats only use the first 8 columns)
COMM = runpy.run_path(str(ROOT / 'tools/adv-build-community.py'))['collect']()


def main():
    mats = {'grass': {'C': [tid(3, 70)] * 47 + [tid(0, 88)]}}  # tufty variant rare, or it reads as a checkerboard
    for n, *a in PATCH: mats[n] = patch_set(*a)
    pr = {p[0]: p for p in PROPS}
    for n, src in PLANTS:
        _, _, x, y, w, h = pr[src]
        mats[n] = {'C': plant_tile((x, y, w, h)), 'overlay': True}
    # the sandWater* patches are sand islands ringed by water (sand C tile, water outside): used as water mats they drew cream, so the sandy-coast water uses the real water sets
    # (the shore itself is the sand mat's own edge tile)
    mats['sandWater'], mats['sandWaterDeep'] = dict(mats['water']), dict(mats['waterDeep'])
    mats['ford'] = ford_set(mats['water'])
    mats['wetGrass'] = wet_grass()
    mats['dryGrass'] = {'C': [tid(5, 73)]}
    mats['snowPlain'] = {'C': [tid(7, 84), tid(5, 85)]}
    for m in mats.values():
        if not m.get('overlay'): m.pop('overlay', None)
    # cliff: rim and face from the grass plateau patch at (16,5875), lower rock face from rows 44..76
    cx, cy = 16, 5875
    face = lambda y0, dx: cut(cx + dx, cy + y0)
    mid = lambda dx: np.concatenate([cut(cx + dx, cy + 54, 32, 16)] * 2)
    cliff = dict(
        rimN=add(cut(cx + 16, cy)), rimE=add(cut(cx + 32, cy + 16)), rimW=add(cut(cx, cy + 16)),
        rimNE=add(cut(cx + 32, cy)), rimNW=add(cut(cx, cy)),
        faceTop=dict(L=add(face(44, 0)), M=add(face(44, 16)), R=add(face(44, 32))),
        face=dict(L=add(mid(0)), M=add(mid(16)), R=add(mid(32))),
        stairsS=add(cut(208, 5872 + 16)),
    )
    props = build_props()
    # output image
    nrows = -(-len(extra) // COLS)
    y0 = (BASE_ROWS + nrows) * T + 2                    # the community sprites (tools/adv-build-community.py, real art only) are shelf-packed below the generated tiles
    art, x, y, rh = [], 0, y0, 0
    for sp in COMM:
        a = sp['img']; h_, w_ = a.shape[:2]
        if x + w_ > PACK_W: x, y, rh = 0, y + rh + 2, 0
        art.append((x, y, a)); e = dict(sx=x, sy=y, sw=w_, sh=h_, ax=sp['ax'], ay=sp['ay'], solid=sp['solid'], by=sp['author'])
        if sp['density'] is not None: e['density'] = sp['density']
        if sp['door'] is not None: e['door'] = sp['door']
        props[sp['name']] = e; x += w_ + 2; rh = max(rh, h_)
    img = np.zeros((y + rh, PACK_W, 4), np.uint8)
    img[:H0, :256] = sheet
    for ax_, ay_, a in art: img[ay_:ay_ + a.shape[0], ax_:ax_ + a.shape[1]] = a
    for i, t in enumerate(extra):
        r, c = divmod(i, COLS)
        img[(BASE_ROWS + r) * T:(BASE_ROWS + r + 1) * T, c * T:(c + 1) * T] = t
    (ROOT / 'assets/adv').mkdir(parents=True, exist_ok=True)
    (ROOT / 'data/adv').mkdir(parents=True, exist_ok=True)
    img[(img[..., 3] < 200) & (img[..., :3].max(-1) <= 48)] = 0   # no baked drop shadows (owner 2026-10-15); a shadow system comes later
    for n_ in ('standingStoneMint', 'standingStoneMintTall'):      # the markers bake a flat opaque light grey (195,195,195) cast shadow under them: gone too (no pixel of that colour is part of the stone)
        p_ = props[n_]; r_ = img[p_['sy']:p_['sy'] + p_['sh'], p_['sx']:p_['sx'] + p_['sw']]; r_[(r_[..., 3] == 255) & (r_[..., :3] == 195).all(-1)] = 0
    Image.fromarray(img, 'RGBA').save(ROOT / 'assets/adv/exterior.png', optimize=True)
    ts = dict(file='assets/adv/exterior.png', T=T, cols=COLS, mats=mats, cliff=cliff, props=props)
    (ROOT / 'data/adv/tileset.js').write_text('window.ADV_TILESET = ' + json.dumps(ts, separators=(',', ':')) + ';\n')
    print(len(mats), 'mats', len(props), 'props', sum('door' in p for p in props.values()), 'buildings', len(extra), 'generated tiles')


main()
