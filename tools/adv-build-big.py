"""Big buildings: larger versions of the real building props, made from the real art (docs/TILE-QA.md: edits of real tiles, no new style).
Run: python3 -I tools/adv-build-big.py     (writes assets/adv/big.png, data/adv/tileset-big.js, tools/.cache/big-contact.png)

How a building grows: its art is cut into horizontal zones (roof, wall, base) and each zone gets the same extra width by repeating columns at its own
pattern period (the hall roof tiles repeat every 22 px, its window stripes every 8, the inn clapboards every 7 rows), so no seam shows; rows of the roof are
repeated the same way for depth. Where a source is not symmetric enough or has something in the way (the inn's chimney), the left half is grown and mirrored.
A gym also gets a proper entrance made from the building's own window pieces. adv-world.js looks these props up before the exterior sheet."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
def load(p):
    s = (ROOT / p).read_text(encoding='utf8'); return json.JSONDecoder().raw_decode(s, s.index('{'))[0]
EXT = load('data/adv/tileset.js'); EXI = np.array(Image.open(ROOT / EXT['file']).convert('RGBA'))
def src(name):
    p = EXT['props'][name]; return EXI[p['sy']:p['sy'] + p['sh'], p['sx']:p['sx'] + p['sw']].copy(), p

def hcat(*a): return np.concatenate(a, axis=1)
def vcat(*a): return np.concatenate(a, axis=0)
def widen(a, zones):
    """zones = [(y0, y1, [(x0, x1, n), ...])]: in rows y0..y1 the columns x0..x1 are repeated n more times; every zone must add the same width"""
    adds = {sum((b - x) * n for x, b, n in bands) for _, _, bands in zones}; assert len(adds) == 1, adds
    out = []
    for y0, y1, bands in zones:
        part, cols, c = a[y0:y1], [], 0
        for x, b, n in sorted(bands): cols += [part[:, c:b]] + [part[:, x:b]] * n; c = b
        out.append(hcat(*cols, part[:, c:]))
    return vcat(*out)
def deepen(a, bands):
    """bands = [(y0, y1, n)]: rows y0..y1 repeated n more times"""
    parts, c = [], 0
    for y, b, n in sorted(bands): parts += [a[c:b]] + [a[y:b]] * n; c = b
    return vcat(*parts, a[c:])
def keep_main(a):
    """the building only: a source rect can carry slivers of its neighbours on the sheet"""
    a[a[..., 3] < 128] = 0
    lab, n = ndimage.label(a[..., 3] > 0, np.ones((3, 3)))
    if n > 1: a[lab != 1 + np.argmax(ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1)))] = 0
    return a
def trim(a):
    al = a[..., 3] > 0; ys, xs = np.where(al.any(1))[0], np.where(al.any(0))[0]
    return a[:ys[-1] + 1, xs[0]:xs[-1] + 1], xs[0]
def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)] + [255], np.uint8)

# ---------------------------------------------------------------- the hall: flat tiled roof, a band of window stripes, a porch ledge
def hall_gym():
    a, p = src('hall'); a = keep_main(a)
    R, S = 4, 11                                          # roof tiles (22 px) per side, window stripes (8 px) per side: the same 88 px
    a = widen(a, [(0, 61, [(24, 46, R), (62, 84, R)]),     # the roof: tiles either side of the middle
                  (61, 77, [(24, 32, S), (75, 83, S)]),    # the window band: stripes either side of the window (clear of the porch pillar heads)
                  (77, a.shape[0], [(38, 46, S), (62, 70, S)])])   # the ledge: its plain stretch either side of the step
    a = deepen(a, [(26, 48, 4)]); dy = 22 * 4             # a deeper roof (the side pillars are plain there)
    w2 = hcat(a[:, 35 + 8 * S:49 + 8 * S], a[:, 37 + 8 * S:47 + 8 * S], a[:, 71 + 8 * S:73 + 8 * S])[61 + dy:77 + dy]   # a two pane window from the big one
    for x in (16 + 8 * 3, 2 * (54 + 8 * S) - 16 - 8 * 3 - w2.shape[1]): a[61 + dy:77 + dy, x:x + w2.shape[1]] = w2
    door(a, 46 + 8 * S, 62 + dy, 95 + dy)                 # down to the ground, over the old entrance step
    return a, 54 + 8 * S, p['ay'] + dy

def door(a, x0, y0, y1):
    """a glass double door cut through the hall's middle window pane and its ledge, down to the ground: x0..x0+15, rows y0..y1"""
    K, F, E, D = rgb('000000'), rgb('e0e0f2'), rgb('387baf'), rgb('584f45')
    pane = a[y0 + 5:y0 + 12, x0 - 8:x0 - 2].copy()       # the lower pane's glass beside the door, without its sill (rows 67..73 of the source)
    for y in range(y0, y1):
        a[y, x0] = a[y, x0 + 15] = K
        a[y, x0 + 1] = a[y, x0 + 14] = F
        g = pane[(y - y0) % pane.shape[0]]
        a[y, x0 + 2:x0 + 8] = g; a[y, x0 + 8:x0 + 14] = g[::-1]
        a[y, x0 + 7] = a[y, x0 + 8] = E                   # the meeting stiles
    a[y0, x0 + 1:x0 + 15] = F; a[y0 + 4, x0 + 2:x0 + 14] = F   # the header and the transom bar, level with the window's
    a[y1 - 4:y1 - 1, x0 + 2:x0 + 14] = F; a[y1 - 1, x0 + 1:x0 + 15] = D   # kick plates and the sill
    a[y0 + 9:y0 + 11, x0 + 6] = a[y0 + 9:y0 + 11, x0 + 9] = D            # the handles

# ---------------------------------------------------------------- the inn: two gables and a porch door; grown as a left half, mirrored for the right
def inn_gym():
    a, p = src('inn'); a = keep_main(a); a[121:] = 0         # below the base: a neighbour's sliver
    g = a[:, 3:51]                                         # one gable wing with the end wall on its left
    C = inn_entrance(a); c = C.shape[1] // 2               # the middle wing made symmetric: a double door under the porch canopy
    full = hcat(a[:, :3], g, g, C, g[:, ::-1], g[:, ::-1], a[:, :3][:, ::-1])
    return inn_roof(full, 9), 3 + 96 + c, p['ay'] + 63

def seamless(a, bands, axis):
    """every repeated band must join itself without a seam: the column (row) after it matches its first, the one before it its last"""
    b = a if axis == 'x' else a.transpose(1, 0, 2)
    for x, e, _ in bands:
        err = np.abs(b[:, e].astype(int) - b[:, x]).mean() + np.abs(b[:, e - 1].astype(int) - b[:, x - 1]).mean()
        assert err < 1, (x, e, err)

def hall_house():
    """the hall a size up: a roof tile and two stripes more each side (the last stripe two px narrower so the window band keeps step with the roof)"""
    a, p = src('hall'); a = keep_main(a)
    roof = widen(a[:61], [(0, 61, [(24, 46, 1), (62, 84, 1)])])
    st = a[61:77]; s6 = hcat(st[:, 24:27], st[:, 28:31])
    band = hcat(st[:, :32], st[:, 24:32], st[:, 24:32], s6, st[:, 32:75], s6[:, ::-1], st[:, 75:83], st[:, 75:83], st[:, 75:])
    base = widen(a[77:], [(0, a.shape[0] - 77, [(38, 46, 2), (38, 44, 1), (62, 70, 2), (62, 68, 1)])])
    a = vcat(roof, band, base)
    a = deepen(a, [(26, 48, 1)]); dy = 22
    door(a, 46 + 22, 62 + dy, 95 + dy)
    return a, 54 + 22, p['ay'] + dy

def inn_house():
    """the inn with three gables: its own left wing, the gabled entrance of the gym, the left wing mirrored"""
    a, p = src('inn'); a = keep_main(a); a[121:] = 0
    g = a[:, 3:51]; C = inn_entrance(a); c = C.shape[1] // 2
    full = hcat(a[:, :3], g, C, g[:, ::-1], a[:, :3][:, ::-1])
    return inn_roof(full, 3), 3 + 48 + c, p['ay'] + 21

def inn_entrance(a):
    """the inn's gable wing made symmetric, its lower window replaced by the porch door and its mirror (a double door) under the porch canopy, widened the same way"""
    C = hcat(a[:, 3:30], a[:, 3:30][:, ::-1]); c = C.shape[1] // 2
    D = a[99:112, 55:64]; C[99:112, c - 9:c + 9] = hcat(D, D[:, ::-1])
    P = a[86:100, 52:66]; P = hcat(P, P[:, ::-1]); m = P[..., 3] > 0
    C[86:100, c - 14:c + 14][m] = P[m]
    C[83:86, c - 11:c + 11] = C[82:83, c - 11:c + 11]
    return C

def inn_roof(full, n):
    """n more 7 row periods of clapboard roof under the eave; the gable tips that reach into the copied rows become plain roof"""
    plain = full[:, 6:7]; band = full[44:51].copy(); flat = np.repeat(plain[44:51], full.shape[1], 1)
    m = (band != flat).any((0, 2)); m[:3] = m[-3:] = False
    band[:, m] = flat[:, m]
    return vcat(full[:44], *[band] * n, full[44:])

# ---------------------------------------------------------------- hotelBlue: a flat blue roof with vents over pillars, bays of window between them, a stair entrance
def hotel(k, n, e=0):
    """k more bays each side (a bay: window, pillar and the roof vents over it, 19 px), n more 19 row periods of roof (the middle vents with them),
    e more 12 px of entrance (the stairs and doorway; the plain roof strip between the middle vents above it)"""
    a, p = src('hotelBlue'); a = keep_main(a)
    seamless(a, [(13, 32, k), (85, 104, k)], 'x'); seamless(a, [(20, 39, n)], 'y'); seamless(a[:70], [(57, 61, e)], 'x'); seamless(a[70:], [(46, 58, e)], 'x')
    a = widen(a, [(0, 70, [(13, 32, k), (57, 61, 3 * e), (85, 104, k)]), (70, a.shape[0], [(13, 32, k), (46, 58, e), (85, 104, k)])])
    return deepen(a, [(20, 39, n)]), p['ax'] + 19 * k + 6 * e, p['ay'] + 19 * n

# ---------------------------------------------------------------- the mart: a ribbed metal roof over a shuttered front
def mart(k, n):
    """k more shutter bays (20 px; the roof gets the same plain ribbed width), n more roof rows of 12"""
    a, p = src('warehouse'); a = keep_main(a)
    seamless(a[:76], [(57, 77, k)], 'x'); seamless(a[76:], [(93, 113, k)], 'x'); seamless(a, [(44, 56, n)], 'y')
    a = widen(a, [(0, 76, [(57, 77, k)]), (76, a.shape[0], [(93, 113, k)])]); a = deepen(a, [(44, 56, n)])
    return a, p['ax'], p['ay'] + 12 * n

BIG = {'hallGym': (hall_gym, 'hall'), 'innGym': (inn_gym, 'inn'), 'hotelGym': (lambda: hotel(3, 3, 2), 'hotelBlue'),
       'hallBig': (hall_house, 'hall'), 'innBig': (inn_house, 'inn'), 'hotelBlueBig': (lambda: hotel(1, 1), 'hotelBlue'), 'martBig': (lambda: mart(2, 2), 'warehouse')}

props, PACK, x = {}, [], 0
for name, (fn, s) in BIG.items():
    img, dx, ay = fn(); img, off = trim(keep_main(img)); ax = int(dx - off)
    p = EXT['props'][s]; d = {k: v for k, v in p.items() if k not in ('by', 'door', 'solid')}
    hw = img.shape[1] // 2 - 4
    d.update(sx=x, sy=0, sw=img.shape[1], sh=img.shape[0], ax=ax, ay=ay, door=[0, -2], solid=[-hw, -28, hw, 1], of=s)
    props[name] = d; PACK.append((x, img)); x += img.shape[1] + 2
W, H = x, max(i.shape[0] for _, i in PACK)
sheet = np.zeros((H, W, 4), np.uint8)
for px, i in PACK: sheet[:i.shape[0], px:px + i.shape[1]] = i
Image.fromarray(sheet).save(ROOT / 'assets/adv/big.png')
(ROOT / 'data/adv/tileset-big.js').write_text('// made by tools/adv-build-big.py: bigger buildings grown from the real art\nwindow.ADV_TILESET_BIG = ' + json.dumps({'file': 'assets/adv/big.png', 'props': props}) + ';\n', encoding='utf8')
(ROOT / 'tools/.cache').mkdir(exist_ok=True)
bg = Image.new('RGBA', (W, H), (96, 160, 80, 255)); bg.alpha_composite(Image.fromarray(sheet))
bg.resize((W * 3, H * 3), Image.NEAREST).save(ROOT / 'tools/.cache/big-contact.png')
for n, d in props.items(): print(n, d['sw'], 'x', d['sh'], ' about', round(d['sw'] / 32, 1), 'x', round(d['sh'] / 32, 1), 'tiles')
