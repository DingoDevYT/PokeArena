"""Render a game-native map snippet with the cleaned tileset (maplab/tileset.png), plus NPCs and Pokemon for preview shots.
  py -3.12 -I maplab/render.py <map.json> <out.png> [scale]

Map JSON (the shape the game would load):
  size    [w, h] in 16 px cells
  base    ground every cell starts as: 'grass' | 'autumn'
  ground  rows of chars, one per cell, LEGEND turns them into terrain (paths, water, tall grass)
  ridges  rows, '#' = raised ground; its outline is drawn as a thin rocky ridge (the bottom edge is a jump-down ledge)
  cliffs  rows of height digits ('.' = 0); where ground drops to the south a rock face is drawn, 'S' = stairs cut into a face
  fences  rows, 'f' white picket, 'F' wood; pieces join to their neighbours
  objects [name, x, y]  OBJ stamp with its top-left on cell (x, y)
  actors  ['npc', ranger-slug, x, y, dir] | ['mon', dex, x, y, dir]   preview only; dir like 'down', 'upLeft'

Terrain sets in this sheet come in three layouts:
  DG    6x4 dual-grid sets: edge art sits half a cell off the logic grid, one tile per corner mask.
        'fringe' sets carry their own fill (sand with a grass fringe); 'ring' sets are grass with a hole, any paving shows through.
  RG    3x3 outline + inner corners, edges inside the cell (water shore, ridges): built from 8 px quarters
  tall grass: plain 3x3 from quarters, no inner corners
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
T, M = 16, 64                     # tile size, canvas margin so half-offset tiles and edge trees can hang off the map
SHEET = Image.open(os.path.join(HERE, 'tileset.png')).convert('RGBA')
SHEETS = {'main': SHEET, 'cave': Image.open(os.path.join(HERE, 'src/cave-original.png')).convert('RGBA'),
          'items': Image.open(os.path.join(HERE, 'src/items-original.png')).convert('RGBA'),
          'cherry': Image.open(os.path.join(HERE, 'src/cherry-original.png')).convert('RGBA')}
CUR = [SHEET]                     # the sheet terrain tiles come from while a map renders (cave maps use the cave sheet)
SHADOW = (24, 40, 64, 72)
SHADOWS = False                   # keep the sheets' baked stamp shadows (off: shadows will be done separately)


def tile(c, r, w=1, h=1): return CUR[0].crop((c * T, r * T, (c + w) * T, (r + h) * T))
def quarter(c, r, qx, qy): return CUR[0].crop((c * T + qx * 8, r * T + qy * 8, c * T + qx * 8 + 8, r * T + qy * 8 + 8))
def obj_image(name):
    sx, sy, sw, sh, *sheet = OBJ[name]
    im = SHEETS[sheet[0] if sheet else 'main'].crop((sx, sy, sx + sw, sy + sh))
    if SHADOWS: return im
    a = im.getchannel('A'); im.putalpha(a.point(lambda v: 0 if v < 128 else v))   # baked shadows are the only half-transparent pixels
    return im
def nudge(name):
    """a stamp's pixel offset inside its cell: tileset sprites keep their place on the 16 px grid, item-sheet ones sit flush"""
    sx, sy, sw, sh, *sheet = OBJ[name]
    return (0, 0) if sheet else (sx % T, sy % T)
OUTLINE = (12, 10, 20, 255)       # #0c0a14, the game's sprite outline colour
NOOUTLINE = {'pond', 'puddle', 'quicksand', 'quicksand_mid', 'quicksand_small'}   # flat ground decals, not standing objects (the game's noOutline)
def outlined(im):
    """the game's outline (outlined() in src/render.js): 1 px dark ring on the 4 cardinal neighbours, drawn under the sprite. Returns an image 1 px bigger on every side."""
    a = np.pad(np.array(im)[..., 3] > 0, 1); ring = np.zeros_like(a)
    ring[1:] |= a[:-1]; ring[:-1] |= a[1:]; ring[:, 1:] |= a[:, :-1]; ring[:, :-1] |= a[:, 1:]
    out = Image.fromarray(np.where(ring[..., None], np.array(OUTLINE, np.uint8), 0).astype(np.uint8), 'RGBA')
    out.alpha_composite(im, (1, 1)); return out
def rnd(x, y, salt=0): return ((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) % 1000 / 1000


BASE = {'grass': ([(72, 88), (72, 89)], [(72, 90), (72, 91)]), 'autumn': ([(73, 88), (73, 89)], [(73, 90), (73, 91)])}  # (plain, decorated)
DGPOS = {1: (0, 0), 3: (1, 0), 2: (2, 0), 5: (0, 1), 15: (1, 1), 10: (2, 1), 4: (0, 2), 12: (1, 2), 8: (2, 2),
         7: (3, 0), 11: (5, 0), 13: (3, 2), 14: (5, 2), 6: (0, 3), 9: (1, 3)}   # corner mask TL=8 TR=4 BL=2 BR=1 -> tile in set
FILL = {'cobble': (77, 88), 'grey': (78, 88), 'stone': (79, 88), 'sand': (81, 88), 'gold': (82, 88), 'dirt': (75, 88)}
# char -> terrain. ('dg', set) carries its own fill; ('ring', set, fill) is a grass-with-a-hole set over a paving fill
LEGEND = {'.': None, 's': ('dg', (48, 56)), 'S': ('dg', (48, 56)), 'p': ('dg', (48, 62)), 'd': ('dg', (56, 62)),   # 'S' = open beach sand (props may stand on it)
          'n': ('dg', (0, 97)),   # trodden sand track, no fringe (6x3 patch set)
          'c': ('ring', (56, 50), 'cobble'), 'g': ('ring', (56, 50), 'grey'), 'b': ('ring', (56, 50), 'stone'), 'y': ('ring', (56, 50), 'sand'),
          'C': ('ring', (64, 50), 'cobble'), 'G': ('ring', (64, 50), 'grey'), 'B': ('ring', (64, 50), 'stone'), 'Y': ('ring', (64, 50), 'sand'),
          'w': 'water', 'v': 'pond', 'V': 'deep', 't': ('tall', (8, 50)), 'T': ('tall', (24, 50)), 'u': ('tall', (40, 50)),   # u = dry mountain grass
          # stone paving with a raised kerb (RG; inner corners are the notched tiles beside the 3x3, k=-1)
          'q': ('rg', (112, 56, (116, 57, -1))), 'Q': ('rg', (112, 50, (116, 51, -1))), 'k': ('rg', (112, 62, (116, 63, -1)))}
SAND, BEACH, DEEP = (48, 56), (56, 56), (64, 56)   # ponds: sand ring (DG sand set) + BEACH set (sand island in water, inverted) + DEEP blob
SHORES = {'grass': (7, 104, (11, 105, 1)), 'autumn': (14, 104, (18, 105, 1))}   # RG: grass with a rocky shore, water outside; inner corners round a one-cell hole
RIDGE = {'grass': (22, 121, (23, 122, 2)), 'autumn': (27, 121, (28, 122, 2))}   # thin ridge ring; inner corners are the corner bits
CLIFF = {'grass': (7, 80), 'autumn': (14, 80), 'snow': (21, 76), 'rock': (0, 76)}   # 3x4 plateau: rim row, middle row, face-start row, face row; stairs at c0+3
BASE['rock'] = ([(74, 88), (74, 89)], [(74, 90), (74, 91)])   # dirt valley floor; plateaus are bare brown rock
BASE['highland'] = BASE['grass']; CLIFF['highland'] = CLIFF['rock']   # grass valleys, bare rock plateaus
ROCKTOP = {'rock', 'highland'}
VOID = set()                   # bases whose solid rock is unlit darkness (caves)
VOID_TILE = Image.new('RGBA', (T, T), (12, 10, 14, 255))
NODIAG = {(0, 97), (21, 97)}   # 6x3 patch sets (no diagonal row)

# snow maps: the ground is trodden dirt under a snow blanket; the blanket (a 6x3 DG patch set, no diagonal tiles) leaves
# paths and ice uncovered and its edge art makes the snowbanks
BASE['snow'] = ([(1, 98)], [(4, 98)])
SNOW, SNOW_ALTS, ICE = (21, 97), [(25, 98)], (81, 57)
BASE_LEGEND = {'snow': {'t': ('tall', (8, 56)), 'T': ('tall', (8, 62)), 'd': 'trodden', 'i': 'ice'}}
QUAD = {(0, 0): (8, 4, 2), (1, 0): (4, 8, 1), (0, 1): (2, 1, 8), (1, 1): (1, 2, 4)}   # quadrant -> its own, horizontal, vertical corner bits


def dg_tile(c0, r0, m, diag=True):
    """tile for corner mask m; sets without a diagonal row build masks 6 and 9 from quadrants of tiles that match each quadrant's corners"""
    if diag or m not in (6, 9): return tile(c0 + DGPOS[m][0], r0 + DGPOS[m][1])
    im = Image.new('RGBA', (T, T))
    for (qx, qy), bits in QUAD.items():
        key = [bool(m & b) for b in bits]
        src = next(k for k in (7, 11, 13, 14, 1, 2, 4, 8, 3, 5, 10, 12, 15) if [bool(k & b) for b in bits] == key)
        im.paste(quarter(c0 + DGPOS[src][0], r0 + DGPOS[src][1], qx, qy), (qx * 8, qy * 8))
    return im
FENCE = {  # connect-4 mask N=1 S=2 W=4 E=8 -> tile
    'f': {8: (87, 93), 4: (88, 93), 12: (85, 95), 2: (87, 94), 1: (87, 95), 3: (84, 94), 10: (84, 93), 6: (86, 93), 9: (84, 95), 5: (86, 95), 13: (84, 96), 0: (87, 95)},
    'F': {8: (97, 93), 4: (98, 93), 12: (95, 95), 2: (97, 94), 1: (97, 95), 3: (94, 94), 10: (94, 93), 6: (96, 93), 9: (94, 95), 5: (96, 95), 13: (94, 96), 0: (97, 95)}}
FENCE_FALLBACK = {14: 12, 7: 3, 11: 3, 15: 12}

# stamps: sheet px rect (x, y, w, h); placed so the rect keeps its offset inside its top-left tile
def slot(c, r, w, h): return (c * T, r * T, w * T, h * T)
OBJ = {}
for col, base in dict(olive=0, teal=16, green=32, orange=52, red=72, pink=88).items():
    for sfx, b in (('', base), ('_snow', base + 8)):        # each colour: two plain slots, then the same two under snow
        for v in (0, 1):
            OBJ[f'round_{col}{sfx}{v}'] = slot(b + 4 * v, 13, 4, 4)     # big round tree
            OBJ[f'tall_{col}{sfx}{v}'] = slot(b + 4 * v, 17, 4, 7)      # tall tree with trunk
            OBJ[f'pine_{col}{sfx}{v}'] = slot(b + 4 * v, 0, 4, 4)       # small round conifer
            OBJ[f'young_{col}{sfx}{v}'] = slot(b + 4 * v, 8, 4, 4)      # young tree
            OBJ[f'bare_{col}{sfx}{v}'] = slot(b + 4 * v, 31, 4, 6)      # bare winter tree
        OBJ[f'cone_{col}{sfx}'], OBJ[f'bush_{col}{sfx}'], OBJ[f'slim_{col}{sfx}'] = slot(b, 37, 1, 3), slot(b + 1, 37, 2, 3), slot(b + 3, 37, 1, 3)
        for i, s in enumerate(('stump', 'stump_sprout', 'stump2', 'stump_moss')): OBJ[f'{s}_{col}{sfx}'] = slot(b + 2 * i, 29, 2, 2)
    for v in (0, 1): OBJ[f'fir_{col}_snow{v}'] = slot(base + 8 + 4 * v, 4, 4, 4)   # snow-laden conifer (snowy slots only)
OBJ.update({
    'tall_turning': slot(48, 17, 4, 7), 'tall_turning2': slot(48, 24, 4, 7),
    'house_wood_a': slot(31, 140, 10, 9), 'house_wood_b': slot(41, 140, 8, 9), 'house_wood_c': slot(49, 140, 8, 9), 'house_wood_d': slot(57, 140, 6, 9),
    'house_red_a': slot(31, 186, 10, 9), 'house_red_b': slot(41, 186, 8, 9), 'house_red_c': slot(49, 186, 8, 9), 'house_red_d': slot(57, 186, 6, 9),
    'dome_green': slot(0, 127, 10, 13), 'dome_blue': slot(28, 127, 10, 13), 'greenhouse': slot(16, 140, 6, 9),
    'torii': slot(0, 140, 8, 9), 'torii_small': (137, 2245, 108, 112),
    'route_sign': slot(91, 93, 3, 3),
    'bed_pink': (1698, 1106, 44, 29), 'bed_yellow': (1698, 1138, 44, 29), 'bed_white': (1698, 1170, 44, 29),
    'flower_pink': (1746, 1111, 12, 24), 'flower_yellow': (1746, 1143, 12, 24), 'flower_white': (1746, 1175, 12, 24),
    'tiny_white': (1649, 1330, 14, 9), 'tiny_white2': (1665, 1330, 14, 9), 'tiny_pink': (1649, 1346, 14, 9), 'tiny_blue': (1665, 1346, 14, 9),
    'tiny_pink2': (1649, 1361, 14, 13), 'tiny_blue2': (1665, 1361, 14, 13), 'sprout': (1685, 1333, 9, 8), 'clover': (1699, 1333, 11, 10), 'clover2': (1697, 1345, 14, 14),
    'planter_pink': (1586, 1111, 46, 25), 'planter_orange': (1586, 1143, 46, 25), 'planter_white': (1586, 1175, 46, 25), 'planter_green': (1586, 1207, 46, 25),
    'sign_board': (1730, 1205, 46, 27), 'sign_small': (1698, 1206, 30, 26),
    'lantern': (1824, 1242, 16, 22), 'lantern_grey': (1824, 1274, 16, 22),
    'leaves': (1777, 1281, 30, 30), 'leaves_mixed': (1777, 1313, 30, 30), 'leaves_small': (1810, 1283, 13, 10), 'leaves_tiny': (1809, 1330, 12, 13),
    'pumpkin': (1825, 1328, 14, 16), 'pumpkin_face': (1857, 1328, 14, 16), 'scarecrow': (1872, 1304, 16, 39),
    'barrel': (1767, 1458, 18, 29), 'barrel_water': (1767, 1490, 18, 29), 'crate': (1794, 1444, 30, 28), 'crates': (1792, 1480, 34, 40), 'crate_small': (1792, 1528, 18, 24),
    'logs': (1729, 1472, 30, 31), 'log': (1700, 1482, 9, 21), 'woodpile': (1697, 1515, 30, 36),
    'bench': (1776, 1113, 64, 23), 'table': (1857, 1132, 30, 34),
    'sunflower': (1697, 1248, 14, 32), 'sunflower_small': (1761, 1256, 14, 24), 'sunflowers': (1713, 1240, 46, 40),
    'mushroom_red': (1713, 1330, 14, 13), 'mushroom': (1713, 1346, 14, 13), 'mushroom_white': (1713, 1362, 14, 13),
    'pot_plant': (1841, 1233, 14, 31), 'pot_herb': (1857, 1244, 14, 20), 'pot_fern': (1873, 1240, 14, 24), 'pot_red': (1873, 1272, 14, 24),
    'arch_white': (1606, 1396, 74, 75), 'arch_wood': (1606, 1476, 74, 75), 'oven': (1762, 1355, 52, 75), 'stall': (1697, 1553, 85, 54), 'stall_rug': (1793, 1553, 85, 54),
    'rock_small': (1153, 1137, 14, 14), 'rock_grey_small': (1297, 1137, 14, 14), 'rock': (1169, 1157, 30, 24), 'rock2': (1201, 1155, 30, 28),
    'rock_grey': (1313, 1157, 30, 24), 'rock_grey2': (1345, 1155, 30, 28), 'rock_tall': (1265, 1149, 30, 32), 'rock_grey_tall': (1409, 1149, 30, 32),
    'mound': (1169, 1205, 30, 24), 'mound2': (1201, 1205, 30, 26), 'mound_grass': (1232, 1205, 31, 22), 'mound_grey': (1313, 1205, 30, 24),
    'clump': (1153, 1185, 14, 14), 'clump2': (1169, 1186, 14, 13), 'clump3': (1185, 1185, 14, 14), 'clump4': (1201, 1188, 15, 11),
    'clump_green': (1441, 1185, 14, 14), 'clump_green2': (1457, 1186, 14, 13), 'clump_green3': (1473, 1185, 14, 14), 'clump_green4': (1489, 1188, 15, 11),
    'water_rock': (1249, 1105, 14, 14), 'water_rock2': (1249, 1121, 14, 14), 'water_rock_grey': (1393, 1105, 14, 14),
    'pond': slot(88, 50, 3, 3), 'puddle': slot(88, 53, 1, 1),
    'snowpile': (1777, 1249, 29, 30), 'snow_lump': (1778, 1236, 12, 10), 'snow_lump2': (1793, 1238, 12, 7),
    'ice_boulder': (1298, 1235, 28, 27), 'ice_boulder2': (1330, 1235, 27, 27), 'ice_boulder3': (1362, 1235, 27, 27),
    'ice_stone': (1393, 1233, 14, 15), 'ice_spike': (1409, 1234, 15, 29), 'ice_spike2': (1425, 1238, 15, 25),
    'ice_pebble': (1297, 1297, 14, 14), 'ice_pebble2': (1313, 1298, 14, 13), 'ice_pebble3': (1329, 1297, 14, 14),
    'ice_rock': (1313, 1317, 30, 24), 'ice_rock2': (1345, 1315, 30, 28), 'ice_tall': (1409, 1309, 30, 32),
    'planter_snow': (1586, 1239, 46, 25), 'pot_snow': (1634, 1240, 14, 24),
    'water_boulder': (1153, 1107, 30, 28), 'water_boulder2': (1185, 1107, 29, 28), 'water_boulder3': (1217, 1107, 29, 28), 'water_rocks': (1264, 1106, 32, 29),
    'water_boulder_grey': (1297, 1107, 30, 28), 'water_boulder_grey2': (1329, 1107, 29, 28), 'water_rocks_grey': (1408, 1106, 32, 29),
    'water_raft': (1219, 1568, 39, 15), 'water_raft2': (1219, 1585, 39, 14), 'water_raft3': (1220, 1600, 38, 16),
    'water_pile': (1265, 1581, 14, 26), 'water_pile2': (1281, 1580, 14, 29), 'water_pile3': (1297, 1577, 14, 31),
    'raft': (1315, 1568, 39, 15), 'crates2': (1840, 1480, 34, 40), 'crate_open': (1840, 1528, 27, 24),
    'fountain': (1172, 2752, 72, 64), 'fountain2': (1252, 2752, 72, 64), 'fountain_dry': (1492, 2752, 72, 64), 'fountain_tower': (1176, 2576, 68, 160),
    'basin': (1413, 2723, 22, 28), 'basin_small': (1489, 2699, 14, 20), 'bench_stone': (1584, 2620, 32, 20), 'post_stone': (1632, 2620, 16, 36),
    'lamp': (1777, 1792, 14, 64), 'lamp_mid': (1793, 1808, 14, 48), 'lamp_short': (1809, 1824, 14, 32), 'column': (1840, 2308, 37, 90), 'pillar': (1888, 2320, 20, 96),
    'planter_tall_blue': (1873, 1702, 14, 25), 'planter_tall_pink': (1873, 1734, 14, 25), 'planter_tall_orange': (1873, 1766, 14, 25), 'planter_tall_pink2': (1873, 1798, 14, 25),
    'boulder': (1154, 1075, 28, 27), 'boulder2': (1186, 1075, 27, 27), 'boulder3': (1218, 1075, 27, 27), 'spire': (1265, 1074, 15, 29), 'spire2': (1281, 1078, 15, 25),
    'boulder_grey': (1298, 1075, 28, 27), 'boulder_grey2': (1330, 1075, 27, 27), 'spire_grey': (1409, 1074, 15, 29), 'rock_grassy': (1232, 1157, 31, 22), 'cairn': (1155, 1165, 10, 17),
    # cave mouths cut into a 2-row cliff face (face-start row + face row); place on the face
    'chest_big_red': (80, 463, 32, 32, 'items'), 'chest_big_teal': (129, 463, 32, 32, 'items'),
    'cave_grass': slot(10, 67, 3, 2), 'cave_brown': slot(3, 67, 3, 2), 'cave_autumn': slot(17, 67, 3, 2), 'cave_grey_grass': slot(42, 67, 3, 2),
})

# cave sheet (src/cave-original.png): seven colour bands, 5 rows apart, same layout in each band.
# floor (16,2); raised rock 3x4 at (0,0) like the cliffs; kerbed gravel (34,0) and pools (26,0) are RG 3x3 whose inner corners
# are the 2x2 ring beside them; crystals, ladders, exits and boulders are stamps
def icell(c, r):
    """one 16 px item from the item sheet's 24 px cells, centred and bottom-aligned"""
    x, y = c * 24, r * 24
    b = SHEETS['items'].crop((x, y, x + 24, y + 24)).getchannel('A').getbbox()
    return (x + (b[0] + b[2]) // 2 - 8, y + b[3] - 16, 16, 16, 'items')


OBJ.update({'chest_red': icell(0, 3), 'chest_green': icell(1, 3), 'chest_blue': icell(2, 3),
            'gem_white': icell(0, 10), 'gem_red': icell(1, 10), 'gem_blue': icell(2, 10), 'gem_lime': icell(3, 10), 'gem_yellow': icell(4, 10),
            'gem_orange': icell(6, 10), 'gem_pink': icell(7, 10), 'gem_ice': icell(9, 10), 'gem_gold': icell(0, 11), 'gem_green': icell(1, 11),
            'gem_purple': icell(3, 11), 'gem_navy': icell(4, 11), 'gem_black': icell(5, 11)})

CAVE_BANDS = dict(brown=0, sand=5, red=10, grey=15, blue=20, ice=24, purple=29)
def ring(c0, r0): return {(-1, -1): (c0 + 4, r0 + 2), (1, -1): (c0 + 3, r0 + 2), (-1, 1): (c0 + 4, r0 + 1), (1, 1): (c0 + 3, r0 + 1)}
for b, r in CAVE_BANDS.items():
    BASE[f'cave_{b}'] = ([(16, r + 2), (20, r + 2)], [(20, r + 2)])
    CLIFF[f'cave_{b}'] = (0, r); ROCKTOP.add(f'cave_{b}'); VOID.add(f'cave_{b}')
    BASE_LEGEND[f'cave_{b}'] = {'g': ('rg', (34, r, ring(34, r))), 'w': ('rg', (26, r, ring(26, r)))}   # gravel floor, pool (lava in red)
    cs = lambda c, rr, w, h: (c * T, (r + rr) * T, w * T, h * T, 'cave')
    OBJ.update({f'cv_boulder_{b}': cs(31, 1, 2, 2), f'cv_spike_{b}': cs(33, 1, 1, 2), f'cv_stone_{b}': cs(31, 0, 1, 1), f'cv_pebbles_{b}': cs(32, 0, 1, 1),
                f'cv_pebbles2_{b}': cs(33, 0, 1, 1), f'cv_crystal_{b}': cs(24, 1, 1, 2), f'cv_crystal_small_{b}': cs(25, 2, 1, 1), f'cv_crystals_{b}': cs(24, 3, 2, 2),
                f'cv_stalagmites_{b}': cs(22, 3, 2, 2), f'cv_drip_{b}': cs(22, 1, 2, 2), f'cv_ladder_down_{b}': cs(13, 1, 1, 1), f'cv_ladder_up_{b}': cs(13, 2, 1, 2),
                f'cv_exit_{b}': cs(11, 1, 2, 3), f'cv_hole_{b}': cs(8, 1, 3, 3), f'cv_mound_{b}': cs(39, 0, 3, 3), f'cv_crater_{b}': cs(32, 3, 2, 2),
                f'cv_pool_rock_{b}': cs(27, 3, 2, 2), f'cv_pool_spike_{b}': cs(29, 3, 1, 2), f'cv_pool_stone_{b}': cs(26, 3, 1, 2), f'cv_pool_pebbles_{b}': cs(30, 3, 1, 2),
                f'cv_wall_hole_{b}': cs(47, 0, 3, 2), f'cv_cave_stairs_{b}': cs(19, 0, 2, 1)})
# the blue band is the sea floor with its own 4-row layout: no pools, and corals, seaweed and a wreck where the other bands keep pool props
BASE['cave_blue'] = ([(19, 23), (21, 23), (14, 21)], [(17, 22)])
BASE_LEGEND['cave_blue'] = {'g': ('rg', (34, 20, ring(34, 20)))}   # pale sand patches
ca = lambda c, r, w, h: (c * T, r * T, w * T, h * T, 'cave')
OBJ.update({'cv_crystal_blue': ca(24, 20, 1, 2), 'cv_crystal_small_blue': ca(25, 21, 1, 1), 'cv_crystals_blue': ca(24, 22, 2, 2), 'cv_boulder_blue': ca(30, 22, 2, 2),
            'coral_red': ca(26, 20, 1, 1), 'coral_pink': ca(27, 20, 1, 1), 'weeds': ca(28, 20, 2, 1), 'seaweed': ca(28, 21, 2, 3), 'wreck': ca(26, 21, 2, 2),
            'coins': ca(26, 23, 1, 1), 'shells': ca(27, 23, 1, 1), 'sea_stone': ca(30, 21, 1, 1), 'sea_pebble': ca(31, 21, 1, 1)})


def desert_sheet():
    """KingTapir's desert sheet (transparent version) plus a 6x4 dual-grid oasis set at (0,15) that the sheet stores in pieces:
    its 2x2 pond (26,12) holds the one-water-corner tiles, its 3x3 island ring (23,11) the edges, three-water-corner tiles and open
    water. The sand ramp (14,10..11) is copied into the cliff set's stairs slot (4,8..9)."""
    src = Image.open(os.path.join(HERE, 'src/desert-transparent.png')).convert('RGBA')
    sh = Image.new('RGBA', (src.width, src.height + 4 * T)); sh.paste(src, (0, 0))
    for m, (c, r) in {1: (26, 12), 2: (27, 12), 4: (26, 13), 8: (27, 13), 3: (24, 13), 12: (24, 11), 5: (25, 12), 10: (23, 12), 15: (24, 12),
                      7: (25, 13), 11: (23, 13), 13: (25, 11), 14: (23, 11)}.items():
        sh.paste(src.crop((c * T, r * T, (c + 1) * T, (r + 1) * T)), (DGPOS[m][0] * T, (15 + DGPOS[m][1]) * T))
    for r in (8, 9): sh.paste(src.crop((14 * T, (r + 2) * T, 15 * T, (r + 3) * T)), (4 * T, r * T))
    # light ground sand, a dual-grid set at (6,15) drawn over the deep sand fill except on paths, built one 8 px quadrant at a time so every
    # edge sits on the cell boundary: the sheet's round patch (376,136) is drawn a half cell too big, so its edge and corner quadrants
    # move inward by one quadrant; the ring's quadrants round the hole (416,144) give the concave corners
    blob = {8: (392, 152), 4: (376, 152), 2: (392, 136), 1: (376, 136)}   # patch tile whose ground corner is that bit
    ring = {1: (416, 144), 2: (432, 144), 4: (416, 160), 8: (432, 160)}   # ring tile whose hole is at that bit
    qd = lambda xy, qx, qy: src.crop((xy[0] + qx * 8, xy[1] + qy * 8, xy[0] + qx * 8 + 8, xy[1] + qy * 8 + 8))
    for m in range(1, 16):
        im = Image.new('RGBA', (T, T))
        for (qx, qy), (o, hb, vb) in QUAD.items():
            own, h, v = m & o, m & hb, m & vb
            q = (qd((32, 112), qx, qy) if own and h and v else qd(blob[o], qx, 1 - qy) if own and h else qd(blob[o], 1 - qx, qy) if own and v
                 else qd(blob[o], 1 - qx, 1 - qy) if own else qd(ring[o], qx, qy) if h and v else None)
            if q: im.paste(q, (qx * 8, qy * 8))
        sh.paste(im, ((6 + DGPOS[m][0]) * T, (15 + DGPOS[m][1]) * T))
    return sh


SHEETS['desert'] = desert_sheet()
BASE['desert'] = ([(6, 7)], [(6, 7)])           # deep sand fill: shows only where the light ground is worn away (paths)
CLIFF['desert'] = (1, 6)                         # sandy cliffs; 'S' stairs are the sand ramp
BASE_LEGEND['desert'] = {'w': ('dg', (0, 15)), 'p': 'lane'}   # oasis water; paths are where the light sand set (6,15) is left off
NODIAG.add((0, 15))
ds = lambda x, y, w, h: (x, y, w, h, 'desert')
OBJ.update({'palm': ds(360, 0, 48, 80), 'palm2': ds(408, 48, 48, 80), 'quicksand': ds(272, 32, 80, 64), 'quicksand_mid': ds(200, 32, 64, 64),
            'quicksand_small': ds(208, 96, 48, 48), 'bones': ds(336, 96, 16, 16), 'bones2': ds(352, 112, 16, 16), 'cactus': ds(288, 112, 48, 32),
            'cactus_small': ds(304, 144, 16, 32), 'cacti': ds(328, 144, 32, 32), 'cacti2': ds(328, 176, 32, 32), 'rock_desert': ds(208, 208, 16, 16),
            'spire_desert': ds(224, 192, 16, 32), 'boulder_desert': ds(240, 192, 32, 32), 'cave_desert': ds(280, 192, 32, 32)})
ch = lambda x, y, w, h: (x, y, w, h, 'cherry')   # ChaoticCherryCake's compilation; crops sit flush so each door lands on a tile
OBJ.update({'pc4': ch(560, 1088, 96, 128), 'mart4': ch(656, 1104, 80, 112), 'sandhall': ch(736, 1536, 144, 144), 'straw': ch(544, 1536, 96, 144),
            'straw2': ch(640, 1536, 96, 144), 'hut_round': ch(1248, 1552, 80, 96)})


def quarters(inside, x, y, c0, r0, inner=None):
    """A 16 px cell from four 8 px quarters of a 3x3 outline at (c0, r0). inner = (cx, cy, k): the inner corner for
    quarter direction (dx, dy) is tile (cx - k*dx, cy - k*dy); None uses the plain middle (tall grass)."""
    im = Image.new('RGBA', (T, T))
    for qx, dx in ((0, -1), (1, 1)):
        for qy, dy in ((0, -1), (1, 1)):
            v, h, d = inside(x, y + dy), inside(x + dx, y), inside(x + dx, y + dy)
            if not v and not h: src = (c0 + 2 * qx, r0 + 2 * qy)
            elif not v: src = (c0 + 1, r0 + 2 * qy)
            elif not h: src = (c0 + 2 * qx, r0 + 1)
            elif inner and not d: src = inner[dx, dy] if isinstance(inner, dict) else (inner[0] - inner[2] * dx, inner[1] - inner[2] * dy)
            else: src = (c0 + 1, r0 + 1)
            im.paste(quarter(*src, qx, qy), (qx * 8, qy * 8))
    return im


def npc_frame(slug, d):
    if not hasattr(npc_frame, 'meta'):
        s = open(os.path.join(ROOT, 'data/trainer-ow-ranger.js'), encoding='utf-8').read()
        npc_frame.meta = json.loads(s[s.index('{'):s.rindex('}') + 1])
    m = npc_frame.meta[slug]
    rows = m['rows']; row = rows.index('idle.' + d) if 'idle.' + d in rows else rows.index('walk.' + d)
    im = Image.open(os.path.join(ROOT, m['file'])).convert('RGBA')
    return im.crop((0, row * m['fh'], m['fw'], (row + 1) * m['fh'])), m['footY']


PMD_DIRS = ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft']
def mon_frame(dex, d, anim='Idle'):
    if not hasattr(mon_frame, 'R'):   # data/sprites.js: window.SPRITES = (builder)({key: {a: [[anim, sheet, fw, fh, footY, ...]]}}, aliases)
        s = open(os.path.join(ROOT, 'data/sprites.js'), encoding='utf-8').read()
        mon_frame.R = json.JSONDecoder().raw_decode(s, s.index('})(') + 3)[0]
    k = '%04d' % int(dex)
    n, sheet, fw, fh, foot = next(a for a in mon_frame.R[k]['a'] if a[0] == anim)[:5]
    im = Image.open(os.path.join(ROOT, 'assets/sprite', k, (sheet or n) + '-Anim.png')).convert('RGBA')
    r = PMD_DIRS.index(d) if im.height >= fh * 8 else 0
    return im.crop((0, r * fh, fw, (r + 1) * fh)), foot


def grid(mp, key, W, H):
    rows = mp.get(key, [])
    rows = [r.ljust(W, '.')[:W] for r in rows] + ['.' * W] * (H - len(rows))
    return lambda x, y: rows[min(max(y, 0), H - 1)][min(max(x, 0), W - 1)]   # off-map cells copy the edge


def render(mp):
    W, H = mp['size']
    base = mp.get('base', 'grass')
    CUR[0] = SHEETS['cave' if base.startswith('cave_') else 'desert' if base == 'desert' else 'main']
    try: return _render(mp, W, H, base)
    finally: CUR[0] = SHEET


def terrain_outline(img, lv, cl, art, W, H):
    """the sprite outline for terrain: a 1 px ring of OUTLINE just outside every plateau silhouette wherever the ground drops (the cliff tiles' own jagged edges, not the cell grid),
    one ring per height so stacked plateaus get a line between levels. Not across the stairs' foot (cells marked 'S'). Drawn before props, so they cover it."""
    from scipy.ndimage import binary_fill_holes
    def grow(a):
        r = a.copy(); r[1:] |= a[:-1]; r[:-1] |= a[1:]; r[:, 1:] |= a[:, :-1]; r[:, :-1] |= a[:, 1:]; return r
    levels = sorted({lv(x, y) for x in range(W) for y in range(H)} - {0})
    if not levels: return
    full = np.ones((T, T), bool); ring = np.zeros((H * T + 2 * M, W * T + 2 * M), bool)
    for h in levels:
        m = np.zeros_like(ring); gr = np.zeros_like(ring)
        for y in range(H):
            for x in range(W):
                v = lv(x, y); sl = (slice(M + y * T, M + y * T + T), slice(M + x * T, M + x * T + T))
                if v >= h: m[sl], gr[sl] = art.get((x, y), (full, ~full))
        m = binary_fill_holes(m); near = ~m
        for _ in range(4): near = grow(near)   # the tile's own grass fringe is ground, not cliff: the line hugs the rock and leaves the tufts outside it
        m &= ~(gr & near); ring |= grow(m) & ~m
    for y in range(H):
        for x in range(W):
            if cl(x, y) == 'S' and cl(x, y + 1) != 'S': ring[M + y * T + T - 6:M + y * T + T + 2, M + x * T:M + x * T + T] = False   # the stairs' foot stays open
    layer = np.zeros(ring.shape + (4,), np.uint8); layer[ring] = OUTLINE
    img.alpha_composite(Image.fromarray(layer, 'RGBA'))


def _render(mp, W, H, base):
    legend = {**LEGEND, **BASE_LEGEND.get(base, {})}
    ch = grid(mp, 'ground', W, H); at = lambda x, y: legend.get(ch(x, y))
    img = Image.new('RGBA', (W * T + 2 * M, H * T + 2 * M))
    def put(im, x, y):
        x, y = x + M, y + M
        if x < 0 or y < 0: im = im.crop((max(0, -x), max(0, -y), im.width, im.height)); x, y = max(0, x), max(0, y)
        if im.width > 0 and im.height > 0: img.alpha_composite(im, (x, y))
    def dg(c0, r0, inside, fill=None, inverted=False, full=None, diag=True, alts=None):
        for j in range(H + 1):
            for i in range(W + 1):
                m = 8 * inside(i - 1, j - 1) + 4 * inside(i, j - 1) + 2 * inside(i - 1, j) + inside(i, j)
                if inverted: m = 15 - m
                px, py = i * T - T // 2, j * T - T // 2
                if m == 0 and full: put(tile(*full), px, py)
                if not m or m == 15 and inverted: continue
                if fill: put(tile(*FILL[fill]), px, py)
                if m == 15 and alts and rnd(i, j, 5) < 0.04: put(tile(*alts[int(rnd(i, j, 6) * len(alts))]), px, py)
                else: put(dg_tile(c0, r0, m, diag), px, py)

    cl = grid(mp, 'cliffs', W, H)
    def lv(x, y):
        c = cl(x, y)
        for _ in range(4):
            if c != 'S': break
            y -= 1; c = cl(x, y)
        return int(c) if c.isdigit() else 0

    plain, deco = BASE[base]
    top = (CLIFF[base][0] + 1, CLIFF[base][1] + 1) if base in ROCKTOP else None   # plateau tops are the set's own rock surface
    for y in range(-1, H + 1):
        for x in range(-1, W + 1):
            pick = deco if rnd(x, y, 1) < mp.get('decor', 0.015) else plain
            # edge and face tiles are partly transparent: their cells take the lower ground beside them
            h = lv(x, y); near = (lv(x, y + 1), lv(x, y + 2), lv(x, y - 1), lv(x - 1, y), lv(x + 1, y))
            raised = top and h and (min(near) if min(near) < h else h) > 0
            put((VOID_TILE if base in VOID else tile(*top)) if raised else tile(*pick[int(rnd(x, y, 2) * len(pick))]), x * T, y * T)
    if base == 'snow':
        for y in range(H):
            for x in range(W):
                if at(x, y) == 'ice': put(tile(*ICE), x * T, y * T)
        dg(*SNOW, lambda x, y: at(x, y) not in ('trodden', 'ice'), diag=False, alts=SNOW_ALTS)
    if base == 'desert': dg(6, 15, lambda x, y: at(x, y) != 'lane')   # light sand over everything but the paths, like snow

    SHORE = SHORES.get(base, SHORES['grass'])
    land = lambda x, y: at(x, y) != 'water'
    for y in range(H):
        for x in range(W):
            if not land(x, y): put(tile(SHORE[2][0], SHORE[2][1]), x * T, y * T)
            elif any(not land(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)): put(quarters(land, x, y, *SHORE), x * T, y * T)

    kinds = []
    for k in legend.values():
        if isinstance(k, tuple) and k[0] in ('dg', 'ring') and k not in kinds: kinds.append(k)
    pond = lambda x, y: at(x, y) in ('pond', 'deep')
    beach = lambda x, y: any(pond(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1))   # ponds always get a sand rim
    if SAND not in [k[1] for k in kinds]: kinds.insert(0, ('dg', SAND))
    for k in kinds:
        inside = (lambda x, y, k=k: at(x, y) == k or beach(x, y)) if k[1] == SAND else (lambda x, y, k=k: at(x, y) == k)
        dg(*k[1], inside, fill=k[2] if k[0] == 'ring' else None, diag=k[1] not in NODIAG)
        if k[1] == SAND:
            dg(*BEACH, pond, inverted=True, full=SHORE[2][:2])
            dg(*DEEP, lambda x, y: at(x, y) == 'deep')

    rgs = []
    for v in legend.values():
        if isinstance(v, tuple) and v[0] == 'rg' and v not in rgs: rgs.append(v)
    for k in rgs:
        inside = lambda x, y, k=k: at(x, y) == k
        c0, r0, inner = k[1]
        for y in range(H):
            for x in range(W):
                if not inside(x, y): continue
                solid = all(inside(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)) and not isinstance(inner, dict)
                put(tile(*inner[:2]) if solid and rnd(x, y, 7) < 0.02 else quarters(inside, x, y, c0, r0, inner), x * T, y * T)

    rg = grid(mp, 'ridges', W, H); raised = lambda x, y: rg(x, y) == '#'
    c0, r0, inner = RIDGE.get(base, RIDGE['grass'])
    for y in range(H):
        for x in range(W):
            if raised(x, y) and not all(raised(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)):
                put(quarters(raised, x, y, c0, r0, inner), x * T, y * T)

    c0, r0 = CLIFF[base]
    art = {}   # cell -> (opaque, green) pixels of the cliff tile drawn there (cells with no tile are solid ground), for the terrain outline
    for h in sorted({lv(x, y) for x in range(W) for y in range(H)} - {0}):
        up = lambda a, b: lv(a, b) >= h
        for y in range(H):
            for x in range(W):
                if lv(x, y) != h: continue
                vr = 3 if not up(x, y + 1) else 2 if not up(x, y + 2) else 0 if not up(x, y - 1) else 1
                hr = 0 if not up(x - 1, y) else 2 if not up(x + 1, y) else 1
                if cl(x, y) == 'S': t = tile(c0 + 3, r0 + max(2, vr))
                elif vr != 1 or hr != 1: t = tile(c0 + hr, r0 + vr)
                else: continue
                put(t, x * T, y * T); a = np.array(t); art[x, y] = (a[..., 3] >= 128, (a[..., 1] > a[..., 0]) & (a[..., 1] > a[..., 2]))
    terrain_outline(img, lv, cl, art, W, H)

    grass_im = {}
    for y in range(H):
        for x in range(W):
            k = at(x, y)
            if isinstance(k, tuple) and k[0] == 'tall':
                grass_im[x, y] = quarters(lambda a, b: at(a, b) == k, x, y, *k[1]); put(grass_im[x, y], x * T, y * T)

    # water mirror: stamps and actors reflect on the blue pixels of water cells (w/v/V), flipped about the foot line, 35% opaque,
    # tinted toward the water colour, rows nudged sideways by round(sin(y * 0.7)) px for a wobble. Mirrored into ia, pasted back below.
    ia = np.array(img); wm = np.kron(np.array([[ch(x, y) in 'wvV' for x in range(-M // T, W + M // T)] for y in range(-M // T, H + M // T)]), np.ones((T, T), bool))
    wm &= (ia[..., 3] == 255) & (ia[..., 2] > ia[..., 0] + 10)
    wcol = ia[wm][:, :3].mean(0) if wm.any() else None
    def mirror(im, x, y, line=None):
        """reflect the rows of `im` (top-left x, y) above `line` (default: just under its last solid row) on water"""
        a = np.array(im); solid = a[..., 3] >= 128
        if wcol is None or not solid.any(): return
        line = solid.nonzero()[0].max() + 1 if line is None else line
        for r in range(line):
            ty = y + M + line + (line - 1 - r); cs = solid[r].nonzero()[0]
            if ty >= ia.shape[0] or not len(cs): continue
            tx = cs + x + M + int(round(math.sin(ty * 0.7)))
            ok = (tx >= 0) & (tx < ia.shape[1]); tx, cs = tx[ok], cs[ok]
            ok = wm[ty, tx]; tx, cs = tx[ok], cs[ok]
            ia[ty, tx, :3] = np.rint(ia[ty, tx, :3] * 0.65 + (a[r, cs, :3] * 0.6 + wcol * 0.4) * 0.35)

    draws = []
    fc = grid(mp, 'fences', W, H)
    for y in range(H):
        for x in range(W):
            f = fc(x, y)
            if f not in FENCE: continue
            m = (fc(x, y - 1) == f) + 2 * (fc(x, y + 1) == f) + 4 * (fc(x - 1, y) == f) + 8 * (fc(x + 1, y) == f)
            draws.append(((y + 1) * T, x * T, lambda f=f, m=m, x=x, y=y: put(tile(*FENCE[f][FENCE_FALLBACK.get(m, m)]), x * T, y * T)))
    for name, x, y in mp.get('objects', []):
        sh = OBJ[name][3]; ox, oy = nudge(name)
        dx, dy = x * T + ox, y * T + oy
        draws.append((dy + sh, dx, lambda name=name, dx=dx, dy=dy: put(obj_image(name), dx, dy) if name in NOOUTLINE else put(outlined(obj_image(name)), dx - 1, dy - 1)))
        mirror(obj_image(name), dx, dy)
    for kind, who, x, y, d in mp.get('actors', []):
        f, foot = npc_frame(who, d) if kind == 'npc' else mon_frame(who, d)
        fx, fy = x * T + 8, y * T + 13; px, py = fx - f.width // 2, fy - foot
        wet = None   # foot in water: half submerged, waterline 42% of the opaque height above the lowest opaque row
        if ch(x, y) in 'wvV':
            a = np.array(f)[..., 3] >= 128; rows = a.any(1).nonzero()[0]; top, bot = rows[0], rows[-1]
            wl = int(bot - round((bot - top) * 0.42)); cols = a.any(0).nonzero()[0]
            rx = int(round(a[wl].sum() / 2)) + 2; ry = max(2, int(round(rx * 0.35)))
            ring = Image.new('L', (2 * rx + 1, 2 * ry + 1)); ImageDraw.Draw(ring).ellipse((0, 0, 2 * rx, 2 * ry), outline=255)   # hard 1 px outline
            ring = Image.merge('RGBA', (*[Image.new('L', ring.size, c) for c in (230, 245, 255)], ring.point(lambda v: 190 if v else 0)))
            wet = (ring, (px + (cols[0] + cols[-1] + 1) // 2 - rx, py + wl - ry), wl, ry)
        mirror(f, px, py, wet and wet[2])
        fo = outlined(f)   # sprite + ring, 1 px bigger each side
        def draw(f=fo, x=x, y=y, fx=fx, fy=fy, px=px, py=py, wet=wet):
            if not wet:
                bb = f.getbbox(); sw = max(8, min(16, (bb[2] - bb[0]) * 2 // 3))
                sh = Image.new('RGBA', (sw, 5)); ImageDraw.Draw(sh).ellipse((0, 0, sw - 1, 4), fill=SHADOW); put(sh, fx - sw // 2, fy - 2)
                put(f, px - 1, py - 1)
            else:   # back half of the ring behind, the part above the waterline, the part below at 30%, front half of the ring over
                ring, rpos, wl, ry = wet
                put(ring.crop((0, 0, ring.width, ry)), *rpos)
                hi, lo = f.copy(), f.copy(); hi.paste((0, 0, 0, 0), (0, wl + 1, f.width, f.height)); lo.paste((0, 0, 0, 0), (0, 0, f.width, wl + 1))
                lo.putalpha(lo.getchannel('A').point(lambda v: round(v * 0.3)))
                put(hi, px - 1, py - 1); put(lo, px - 1, py - 1)
                put(ring.crop((0, ry, ring.width, ring.height)), rpos[0], rpos[1] + ry)
            if (x, y) in grass_im: put(grass_im[x, y].crop((0, 9, T, T)), x * T, y * T + 9)   # tall grass hides the feet
        draws.append(((y + 1) * T - 1, x * T, draw))
    img.paste(Image.fromarray(ia))
    for _, _, fn in sorted(draws, key=lambda t: (t[0], t[1])): fn()
    return img.crop((M, M, M + W * T, M + H * T))


if __name__ == '__main__':
    mp = json.load(open(sys.argv[1]))
    sc = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    im = render(mp)
    im.resize((im.width * sc, im.height * sc), Image.NEAREST).save(sys.argv[2])
    print(sys.argv[2], im.size, 'x', sc)
