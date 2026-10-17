"""Catalogue of community pixel-art props (see tools/adv-build-community.py). Rects are source sheet px (x, y, w, h), loose is fine: the builder
tightens them. door = door centre x relative to the building's anchor in sheet px ('auto' finds a dark doorway). Authors: SailorVicious (s),
Magiscarf (m), WilsonScarloxy (w), JesusCarrasco (j), Mataraelfay (ma), PixelMister (px)."""
CATALOG = []


def add(sheet, rect, name, kind, **o):
    CATALOG.append(dict(sheet=sheet, rect=rect, name=name, kind=kind, **o))


# ---------------------------------------------------------------- SailorVicious: buildings (2x art)
# Left out, the wings run off the 256 px source sheet (clipped art): sWhiteHall, sPokeballHall, sStoneCastle
S = 'sailor1'
for rect, name, door in [
    ((2, 3404, 146, 176), 'sBlueRoofHouse', -16), ((0, 3658, 182, 178), 'sBlueRoofHouseWide', 0), ((6, 4604, 244, 398), 'sMartTower', 0), ((6, 5034, 152, 226), 'sThatchHouse', -26), ((16, 5290, 152, 226), 'sThatchHouseB', 27),
    ((14, 5578, 240, 212), 'sGoldInn', 17), ((8, 5824, 148, 178), 'sMartBlue', -26), ((2, 6030, 172, 196), 'sCenterRed', 0),
    ((6, 6294, 166, 202), 'sOrangeHouse', -32), ((8, 6714, 152, 194), 'sRedRoofHouse', -30), 
    ((22, 7476, 166, 200), 'sBlueRoofHouseB', -16), ((10, 7682, 246, 250), 'sTealStore', 0), ((10, 7968, 246, 232), 'sCrossHospital', 0),
    ((0, 8512, 256, 254), 'sSilverWarehouse', -48), ((58, 8794, 194, 250), 'sWoodPagoda', -5), ((26, 9072, 130, 164), 'sDomeHut', -8),
    ((26, 1408, 192, 186), 'sGreenhouse', 0), ((6, 1626, 236, 256), 'sDomeStadium', 0), 
]: add(S, rect, name, 'building', door=door)

# ---------------------------------------------------------------- Magiscarf (2x art)
M = 'magi'
# conifers, hedges and bushes: six palettes at a 384 px pitch (the snow variants beside them are autotile patches and left out)
for pal, y0 in [('Green', 1670), ('Teal', 2054), ('Stone', 2822), ('Amber', 3206), ('Pink', 3590), ('Rust', 3974)]:
    add(M, (24, y0, 84, 124), 'mPine' + pal, 'tree', sh='auto', ex=[(0, y0, 32, 26), (0, y0 + 90, 32, 34), (92, y0, 70, 26)])
    add(M, (0, y0 + 142, 62, 74), 'mBush' + pal, 'bush', sh='auto')
    add(M, (64, y0 + 142, 32, 76), 'mFir' + pal, 'tree', sh='auto')
    add(M, (96, y0 + 122, 32, 96), 'mHedgeTall' + pal, 'bush', sh=[])
    add(M, (0, y0 + 218, 96, 32), 'mHedgeLong' + pal, 'bush', sh=[])
    add(M, (96, y0 + 218, 32, 32), 'mHedgeRound' + pal, 'bush', sh=[])
for nm, (x, y) in [('Green', (84, 4772)), ('Brown', (84, 4932)), ('Red', (84, 5092)), ('Pink', (84, 5252))]:
    add(M, (x, y, 152, 156), 'mRoundBig' + nm, 'tree', sh='auto')
for nm, y in [('Green', 4228), ('Brown', 4356), ('Red', 4484), ('Pink', 4612)]:
    add(M, (8, y, 112, 125), 'mRound' + nm, 'tree', sh='auto')
for rect, name, kind in [
    ((0, 5424, 32, 48), 'mFlowerBushRed', 'bush'), ((32, 5424, 32, 48), 'mFlowerBushBlue', 'bush'),
    ((68, 5424, 92, 48), 'mPlanterEmpty', 'bush'), ((164, 5424, 92, 48), 'mPlanterSprouts', 'bush'), ((4, 5476, 92, 60), 'mPlanterGrass', 'bush'),
    ((100, 5476, 28, 60), 'mPlanterPot', 'bush'), ((132, 5498, 28, 38), 'mPlanterSprout', 'bush'), ((194, 5484, 62, 48), 'mBenchCushion', 'fence'),
    ((4, 5540, 88, 58), 'mFlowersBlue', 'flower'), ((100, 5550, 24, 48), 'mFlowerBlueTall', 'flower'),
    ((132, 5540, 88, 58), 'mFlowersPink', 'flower'), ((228, 5550, 24, 48), 'mFlowerPinkTall', 'flower'),
    ((0, 5598, 128, 100), 'mSunflowers', 'flower'), ((130, 5600, 28, 32), 'mPumpkin', 'deco'), ((194, 5600, 28, 32), 'mPumpkinFace', 'deco'),
    ((68, 5698, 24, 62), 'mInfoPost', 'sign'), ((96, 5712, 32, 48), 'mNoticeBoard', 'sign'),
    ((132, 5708, 60, 52), 'mSignGreen', 'sign'), ((162, 5770, 94, 52), 'mSignGreenWide', 'sign'), ((194, 5696, 60, 52), 'mTableRound', 'rock'),
    ((2, 5718, 62, 38), 'mBenchGreen', 'fence'), ((34, 5762, 94, 26), 'mBenchLong', 'fence'), ((120, 5822, 112, 100), 'mLampDouble', 'lamp'),
    ((18, 5922, 60, 34), 'mPicketFence', 'fence'), ((18, 6018, 60, 34), 'mWoodFence', 'fence'),
]: add(M, rect, name, kind)
add(M, (150, 5616, 52, 78), 'mScarecrow', 'sign', ex=[(150, 5616, 8, 14), (194, 5616, 8, 14)])   # the two pumpkins of the row above clip into the rect corners
# town buildings: a rose set (y) and a mint set (y + 3136) share one layout. Left out, source art is cut: Stairs (its left flight is clipped in the sheet), maGrandHall (flat grey placeholder roof), maColosseum (the ring runs off the 256 px sheet edge)
for pal, dy in [('Rose', 0), ('Mint', 3136)]:
    for rect, name in [((8, 9544, 208, 216), 'Gable'), ((8, 9984, 208, 192), 'Hall'), ((6, 10208, 212, 258), 'Apt'), ((6, 10496, 212, 128), 'Shop'),
                       ((6, 11232, 212, 256), 'Store'), ((6, 11544, 148, 328), 'Tower')]:
        x, y, w, h = rect; add(M, (x, y + dy, w, h), 'm' + pal + name, 'building', door=0)
add(M, (2, 9172, 156, 138), 'mCottageOrange', 'building', door=0)
add(M, (2, 9364, 156, 138), 'mCottageBlue', 'building', door=0)

# ---------------------------------------------------------------- WilsonScarloxy (2x art)
W = 'wilson2'
add(W, (18, 608, 92, 92), 'wOakLight', 'tree', clr=[(164, 216, 105), (154, 201, 99)])
add(W, (150, 606, 84, 98), 'wOakDark', 'tree', clr=[(112, 216, 160)], sh=[(56, 136, 112), (80, 176, 136)])
add(W, (18, 798, 94, 94), 'wOakBig', 'tree', sh=[(56, 136, 112), (80, 176, 136)])
add(W, (0, 896, 34, 64), 'wFirSmall', 'tree', clr=[(128, 198, 168)], sh=[(56, 136, 112), (80, 176, 136)])
add(W, (36, 936, 26, 26), 'wStump', 'rock', clr=[(128, 198, 168)], sh=[(56, 136, 112), (80, 176, 136)])
add(W, (18, 960, 62, 34), 'wLogFence', 'fence')
add(W, (18, 960, 14, 34), 'wLogPost', 'fence')
add(W, (98, 990, 16, 36), 'wBollard', 'sign')
add(W, (196, 972, 24, 52), 'wMailbox', 'sign')
add(W, (224, 980, 32, 46), 'wSignBoard', 'sign')
add(W, (2, 1092, 56, 124), 'wTurbine', 'rock')
add(W, (0, 1214, 126, 132), 'wHouseTeal', 'building', door=0)
add(W, (130, 1198, 126, 152), 'wHouseGrey', 'building', door=0)
add(W, (0, 1360, 160, 208), 'wHouseBig', 'building', door=0)
add(W, (0, 1578, 232, 184), 'wHouseMint', 'building', door=0)

# ---------------------------------------------------------------- JesusCarrasco (2x art)
J = 'jesus1'
for rect, name, kind in [
    ((0, 492, 96, 148), 'jPineA', 'tree'), ((98, 492, 94, 148), 'jPineB', 'tree'), ((0, 666, 96, 166), 'jPineC', 'tree'), ((98, 668, 92, 164), 'jPineD', 'tree'),
    ((24, 860, 110, 164), 'jPineRingA', 'tree'), ((24, 1242, 110, 166), 'jPineRingB', 'tree'), ((14, 1604, 100, 156), 'jWell', 'rock'),
    ((128, 1648, 126, 108), 'jBridge', 'fence'), ((14, 1788, 162, 112), 'jRocks', 'rock'), ((14, 1948, 162, 112), 'jRocksMoss', 'rock'),
]: add(J, rect, name, kind)
for i, y in enumerate([2240, 2432, 2624, 2816]):
    add(J, (0, y, 160, 192), 'jCabin' + 'ABCD'[i], 'building', door=0, sh=[(124, 124, 124)])
CATALOG.append(dict(sheet=J, name='jLodge', kind='building', door=0, rect=None, sh=[(157, 157, 157)], parts=[(18, 3034, 238, 232, 0, 0), (0, 3290, 64, 232, 238, 0)]))

# ---------------------------------------------------------------- Mataraelfay (1x art, density 1)
# Left out, art cannot be isolated: maGrandHall (flat grey placeholder roof), maColosseum (the ring runs off the 256 px sheet), maStallBlue (opaque grey ground slab with a translucent edge baked under the awning)
MA = 'matara'
for rect, name in [
    ((11, 11176, 137, 121), 'maTreeHouse'), ((6, 11321, 214, 175), 'maHallGrey'), ((0, 17794, 164, 145), 'maHallOrange'), ((151, 17952, 105, 144), 'maOctOrange'),
    ((1, 18110, 208, 174), 'maManorOrange'), ((23, 18308, 156, 188), 'maStoneInn'), ((123, 18792, 105, 152), 'maShopCyan'), ((3, 18943, 171, 212), 'maHouseBlueTimber'),
    ((19, 19457, 160, 191), 'maStoneHouse'), ((38, 19683, 144, 215), 'maTowerOct'), ((11, 19905, 155, 204), 'maHousePurple'),
    ((12, 20435, 112, 141), 'maLogCabin'), ((9, 20653, 106, 114), 'maHutRound'), ((8, 21228, 162, 185), 'maHouseOrange'),
    ((25, 21445, 175, 157), 'maBrickShrine'), ((0, 21697, 128, 186), 'maHouseGreen'), ((12, 23584, 137, 293), 'maGymTower'),
    ((8, 24144, 209, 210), 'maTempleGold'), ((18, 24481, 155, 203), 'maHouseRed'), ((20, 24783, 204, 208), 'maMartCombo'), ((0, 26176, 140, 172), 'maCenterBlue'),
    ((0, 26372, 172, 172), 'maCenterRed'), ((6, 26563, 153, 206), 'maHouseBrick'), ((0, 26788, 249, 278), 'maHallChampion'), ((16, 27092, 131, 172), 'maAdobe'),
    ((8, 10223, 214, 287), 'maTemple'), ((27, 11055, 111, 104), 'maHutWood'),
]: add(MA, rect, name, 'building')
for rect, name, kind in [
    ((71, 5519, 82, 82), 'maCaveBrown', 'cave'), ((71, 5775, 82, 81), 'maCaveDark', 'cave'), ((8, 10032, 80, 80), 'maCaveMoss', 'cave'),
    ((13, 12103, 70, 84), 'maUmbrellaPink', 'prop'), ((109, 12103, 70, 84), 'maUmbrellaBlue', 'prop'), ((71, 12047, 48, 50), 'maLounger', 'prop'),
    ((95, 6919, 161, 154), 'maSailboat', 'prop'), ((15, 17707, 154, 72), 'maRowboat', 'prop'),
    ((2, 18530, 208, 222), 'maWindmill', 'prop'), ((195, 14153, 60, 56), 'maHayPile', 'bush'), ((192, 14051, 64, 93), 'maHayBales', 'bush'),
    ((198, 4643, 58, 56), 'maBoulderMoss', 'rock'),
]: add(MA, rect, name, kind)
add(MA, (2, 15264, 128, 124), 'maFountain', 'rock', sh=[(122, 122, 122)])   # row 15260 holds a neighbour's brown bar; the grey diagonal is a baked shadow
add(MA, (1, 22656, 169, 175), 'maHouseBlueGable', 'building', ex=[(1, 22769, 20, 56)])   # a mailbox of the neighbouring sprite stands at the left edge
add(MA, (195, 4768, 61, 58), 'maBoulderGrey', 'rock', sh=[(60, 155, 245), (215, 233, 241), (173, 209, 232)])   # the blue puddle ring baked under the rock

# ---------------------------------------------------------------- PixelMister (1x art)
PX = 'pix'
add(PX, (0, 1318, 91, 52), 'pxStallPink', 'prop')
add(PX, (0, 1382, 91, 52), 'pxStallBlue', 'prop')
add(PX, (0, 965, 90, 79), 'pxYacht', 'prop', ex=[(69, 984, 21, 23)])   # a bush of the next sprite hangs into the top right corner
add(PX, (83, 6791, 45, 73), 'pxTurbine', 'rock')
