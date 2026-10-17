"""Builds assets/adv/interior.png and data/adv/tileset-int.js from the Silver Gallium interior sheet (read only, art only).
Run: py -3.12 -I tools/adv-build-interior.py
The sheet is 2x pixel art (256 x 17056): floors are 128 px blocks whose top-left 32 px window is the plain floor tile, wall sets are 160 px blocks from y 4448
(a frame template, then a 64 px tall wall face below it, tile 1 of the face is the repeating one), furniture and wall decor are free sprites.
Mats are cut into 32 px tiles, props are copied by rect (trimmed to their pixels) and shelf-packed, so the output is a small sheet instead of the whole 17k px one.
Walls and the dark surround are `blocked` mats: the engine treats them like water (nothing walks on them)."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = r'C:\Users\lando\Desktop\Pokemon Silver Gallium\assets\tile sheets\interior_tileset.png'
ROOT = Path(__file__).resolve().parent.parent
T, COLS = 32, 8
sheet = np.array(Image.open(SRC).convert('RGBA'))

# theme -> (floor block index, wall set index)
THEMES = dict(center=(5, 12), mart=(25, 8), home1=(24, 16), home2=(0, 13), home3=(19, 14), barn=(20, 4), farm=(26, 27))

# name, kind, approximate rect (x, y, w, h) on the sheet; the builder trims it to the sprite's pixels
PROPS = [
    ('healMachine', 'machine', 146, 13632, 100, 112), ('pcBlue', 'pc', 64, 13656, 68, 96), ('pcWhite', 'pc', 0, 13656, 62, 96),
    ('counterCurve', 'counter', 126, 13340, 130, 72), ('counterRed', 'counter', 126, 15446, 98, 44), ('stoveRed', 'counter', 4, 15446, 92, 44),
    ('tableBrownLong', 'table', 158, 12658, 98, 46), ('tableRedLong', 'table', 158, 12274, 98, 48), ('tableBrownBig', 'table', 2, 16770, 98, 94), ('tableBrownSmall', 'table', 2, 16884, 98, 46),
    ('shelfPotion', 'shelf', 34, 14366, 62, 66), ('shelfGreen', 'shelf', 34, 14460, 62, 66), ('shelfBooks', 'shelf', 28, 14556, 70, 72),
    ('shelfBooksTall', 'shelf', 156, 14536, 70, 86), ('shelfPotionTall', 'shelf', 160, 14326, 66, 110), ('shelfGreenTall', 'shelf', 160, 14430, 66, 98),
    ('bedPink', 'bed', 22, 15596, 62, 84), ('bedBlue', 'bed', 116, 15596, 62, 84), ('bedPlain', 'bed', 24, 15790, 60, 84),
    ('plantA', 'plant', 0, 15496, 32, 90), ('plantB', 'plant', 31, 15516, 34, 66), ('plantC', 'plant', 62, 15494, 38, 90), ('binTeal', 'plant', 96, 15540, 28, 42),
    ('sofaBlue', 'sofa', 96, 16224, 98, 64), ('armchairBlue', 'sofa', 192, 16188, 64, 100), ('fridge', 'shelf', 224, 15430, 32, 60),
    ('tvBlue', 'table', 178, 13474, 62, 62), ('statueBird', 'statue', 20, 15900, 56, 92), ('statueBeast', 'statue', 156, 15916, 44, 76), ('plinth', 'statue', 94, 15932, 36, 64),
    ('ropeRed', 'rope', 6, 11920, 118, 46), ('ropeGrey', 'rope', 134, 11920, 118, 46),
    ('winSmall', 'deco', 38, 9894, 22, 26), ('winWide', 'deco', 62, 9918, 68, 38), ('winArch', 'deco', 118, 9974, 54, 46), ('winStained', 'deco', 22, 9952, 58, 64),
    ('boardGreen', 'deco', 0, 10054, 128, 48), ('boardGreenB', 'deco', 128, 10054, 128, 48), ('paintingSea', 'deco', 2, 10180, 60, 28), ('mapIsland', 'deco', 64, 10178, 64, 30), ('mapWorld', 'deco', 132, 10176, 58, 30),
    ('matRed', 'mat', 196, 10304, 58, 30), ('matRedTall', 'mat', 224, 10242, 30, 58),
]

tiles = []
def add(t):
    for i, u in enumerate(tiles):
        if np.array_equal(u, t): return i
    tiles.append(t.copy()); return len(tiles) - 1

def cut(x, y, w=T, h=T): return sheet[y:y + h, x:x + w].copy()

mats, order, blocked = {}, [], []
for name, (fi, wi) in THEMES.items():
    y0 = 4448 + 160 * wi + 96
    dark = cut(2, y0 - 30, 1, 1)[0, 0, :3].astype(float)
    flat = np.zeros((T, T, 4), np.uint8); flat[..., :3] = (dark * .36).astype(np.uint8); flat[..., 3] = 255
    flat[T - 2:, :, :3] = np.minimum(255, flat[T - 2:, :, :3].astype(int) + 14).astype(np.uint8)   # a faint lit lip so the surround reads as wall tops
    parts = dict(floor=cut(0, 128 * fi), wallT=cut(32, y0), wallB=cut(32, y0 + 32), dark=flat)
    for k, t in parts.items():
        n = f'i_{name}_{k}'; mats[n] = {'C': add(t)}; order.append(n)
        if k != 'floor': blocked.append(n)

# T4 Tradeway: the Route 4 cave is a sixth kind of interior. The interior sheet has no cave, so its tiles are real Mataraelfay art (1x pixel art, tools/.cache/tilesets/Mataraelfay):
# 16 x 16 art px windows of her cave floor (chosen so each tiles with itself and with the others, tools/adv-tile-lint.py seam check), rock wall and cobble paving, enlarged 2x (nearest) so one art pixel is 2 sheet px like the rest of this 2x sheet. Lists are variants picked by a hash of the cell
MATARA = np.array(Image.open(ROOT / 'tools/.cache/tilesets/Mataraelfay/5pj8QXY.png').convert('RGBA'))
up2 = lambda x, y: np.kron(MATARA[y:y + 16, x:x + 16], np.ones((2, 2, 1), np.uint8))
wall_mean = up2(132, 3026)[..., :3].reshape(-1, 3).mean(0)
cave_dark = np.zeros((T, T, 4), np.uint8); cave_dark[..., :3] = (wall_mean * .36).astype(np.uint8); cave_dark[..., 3] = 255
cave_dark[T - 2:, :, :3] = np.minimum(255, cave_dark[T - 2:, :, :3].astype(int) + 14).astype(np.uint8)
CAVE = dict(dark=[cave_dark], floor=[up2(118, 3082), up2(133, 3087), up2(101, 3087)], wallT=[up2(132, 3012)], wallB=[up2(132, 3026)], road=[up2(28, 3384)])
for k, vs in CAVE.items():
    n = f'i_cave_{k}'; ids = [add(v) for v in vs]; mats[n] = {'C': ids if len(ids) > 1 else ids[0]}; order.append(n)
    if k in ('wallT', 'wallB', 'dark'): blocked.append(n)


def stray_mask(a):
    """pieces of neighbouring sprites inside a trimmed rect: separate blobs (after a 2 px dilation) that touch its edge and are under 15 percent of the main sprite"""
    op = a >= 128; out = np.zeros(a.shape, bool)
    if op.sum() < 40: return out
    lab, n = ndi.label(ndi.binary_dilation(op, np.ones((3, 3), bool), iterations=2), np.ones((3, 3)))
    cnt = ndi.sum(op, lab, range(1, n + 1)); main = int(np.argmax(cnt)) + 1; h, w = op.shape
    for i in range(1, n + 1):
        if i == main: continue
        m = op & (lab == i); ys, xs = np.nonzero(m)
        if len(ys) and (ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1) and m.sum() < cnt[main - 1] * .15: out |= m
    return out



# Exterior (1x art) props that rooms use: rooms draw the interior sheet 1:1 and that sheet is 2x art, so a 1x sprite would have half-size pixels next to the furniture.
# Each is copied from the exterior sheet with every pixel doubled (nearest, no new art) as `<name>2x`; adv-build-rooms.mjs uses the 2x name whenever one exists.
EXT2X = ['pebbles', 'torchPost', 'maHayPile', 'crystalBlueTall', 'crystalBlue', 'mushroomsPale', 'mushroomsOrange', 'mushroomsRed', 'mushroomStump', 'fallenLog', 'logShort',
         'barrelOrange', 'crateWide', 'caveRock', 'dirtMound', 'rockBrownB', 'rockBrownSmall', 'rockDarkSmall', 'pxStallPink', 'pxStallBlue']

GAPS = {'mapIsland': 6, 'armchairBlue': 6}   # props that are a pair of pieces (poster + frame, two chairs): the gap between the pieces is wider than 2 px


def main_box(a, gap=2):
    """(x0, x1, y0, y1) of the main sprite inside a rough rect: the widest opaque column run and, inside it, the tallest row run (runs are split by more than `gap` empty lines)"""
    def best(v, w):
        idx = np.where(v)[0]; out, s0, p0 = [], idx[0], idx[0]
        for i in idx[1:]:
            if i - p0 > gap: out.append((s0, p0)); s0 = i
            p0 = i
        out.append((s0, p0)); return max(out, key=lambda r: w[r[0]:r[1] + 1].sum())
    op = a >= 128
    if not op.any(): op = a > 0
    c0, c1 = best(op.any(0), op.sum(0)); r0, r1 = best(op[:, c0:c1 + 1].any(1), op[:, c0:c1 + 1].sum(1))
    return int(c0), int(c1) + 1, int(r0), int(r1) + 1

nt = -(-len(tiles) // COLS)
props, packed, x, y, rh = {}, [], 0, nt * T + 4, 0
for n, kind, rx, ry, rw, rhh in PROPS:
    sub = sheet[ry:ry + rhh, rx:rx + rw]; a = sub[..., 3]
    assert (a > 0).any(), n
    x0, x1, y0_, y1 = main_box(a, GAPS.get(n, 2))   # the sprite itself: slivers of the neighbouring sprites inside the rough rect are left out
    a = a.copy(); a[:y0_] = 0; a[y1:] = 0; a[:, :x0] = 0; a[:, x1:] = 0
    cut = stray_mask(a[y0_:y1, x0:x1]); a[y0_:y1, x0:x1][cut] = 0
    ys_, xs_ = np.nonzero(a >= 128); x0, x1, y0_, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
    a[:y0_] = 0; a[y1:] = 0; a[:, :x0] = 0; a[:, x1:] = 0
    sub = np.where((a > 0)[..., None], sub, 0)
    op = a >= 160; oy, ox = np.nonzero(op)
    ax, ay = (ox.min() + ox.max() + 1) // 2 - x0, oy.max() + 1 - y0_
    ow, oh = int(ox.max() - ox.min() + 1), int(oy.max() - oy.min() + 1)
    w, h = int(x1 - x0), int(y1 - y0_)
    if x + w > COLS * T: x, y, rh = 0, y + rh + 2, 0
    packed.append((x, y, sub[y0_:y1, x0:x1])); hw = max(3, ow // 2 - 1)
    solid = dict(machine=[-hw, -14, hw, 1], pc=[-hw, -12, hw, 1], counter=[-hw, -min(oh - 6, 30), hw, 1], table=[-hw, -min(oh - 8, 34), hw, 1], shelf=[-hw, -min(oh - 4, 22), hw, 1], bed=[-hw, -min(oh - 8, 52), hw, 1],
                 plant=[-hw // 2 - 2, -7, hw // 2 + 2, 1], sofa=[-hw, -min(oh - 6, 28), hw, 1], statue=[-hw, -9, hw, 1], rope=[-hw, -3, hw, 1]).get(kind)
    if kind == 'mat': ay = 0   # floor mats sort by their top edge so anything standing on them draws over them
    props[n] = dict(sx=x, sy=y, sw=w, sh=h, ax=int(ax), ay=int(ay), solid=solid, kind=kind)
    print(f'{n:16s} {w:3d}x{h:3d} opaque {ow}x{oh}')
    x += w + 2; rh = max(rh, h)
_ex = json.loads((ROOT / 'data/adv/tileset.js').read_text(encoding='utf8').split('=', 1)[1].rsplit(';', 1)[0]); _exi = np.array(Image.open(ROOT / _ex['file']).convert('RGBA'))
for n in EXT2X:
    d = _ex['props'][n]; a = np.kron(_exi[d['sy']:d['sy'] + d['sh'], d['sx']:d['sx'] + d['sw']], np.ones((2, 2, 1), np.uint8)); h, w = a.shape[:2]
    if x + w > COLS * T: x, y, rh = 0, y + rh + 2, 0
    packed.append((x, y, a)); sd = d.get('solid')
    props[n + '2x'] = dict(sx=x, sy=y, sw=w, sh=h, ax=d['ax'] * 2, ay=d['ay'] * 2, solid=[v * 2 for v in sd] if sd else None, kind='ext2x')
    print(f'{n + "2x":16s} {w:3d}x{h:3d} (2x of the exterior sprite)')
    x += w + 2; rh = max(rh, h)
img = np.zeros((y + rh + 2, COLS * T, 4), np.uint8)
for i, t in enumerate(tiles): r, c = divmod(i, COLS); img[r * T:(r + 1) * T, c * T:(c + 1) * T] = t
for px, py, a in packed: img[py:py + a.shape[0], px:px + a.shape[1]] = a
(ROOT / 'assets/adv').mkdir(parents=True, exist_ok=True)
img[(img[..., 3] < 200) & (img[..., :3].max(-1) <= 48)] = 0   # no baked drop shadows (owner 2026-10-15); a shadow system comes later
Image.fromarray(img, 'RGBA').save(ROOT / 'assets/adv/interior.png', optimize=True)
ts = dict(file='assets/adv/interior.png', T=T, cols=COLS, density=0.5, mats=mats, order=order, blocked=blocked, themes=list(THEMES) + ['cave'], props=props)
(ROOT / 'data/adv/tileset-int.js').write_text('window.ADV_TILESET_INT = ' + json.dumps(ts, separators=(',', ':')) + ';\n')
print(len(mats), 'mats', len(props), 'props', len(tiles), 'tiles', img.shape)
