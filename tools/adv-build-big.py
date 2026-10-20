"""Big buildings: larger versions of the real building props, made from the real art (docs/TILE-QA.md: edits of real tiles, no new style).
Run: python3 -I tools/adv-build-big.py     (writes assets/adv/big.png, data/adv/tileset-big.js, tools/.cache/big-contact.png)

How a building grows: its art is cut into horizontal zones (roof, wall, base) and each zone gets the same extra width by repeating columns at its own
pattern period (the hall roof tiles repeat every 22 px, its window stripes every 8, the inn clapboards every 7 rows), so no seam shows; rows of the roof are
repeated the same way for depth. Where a source is not symmetric enough or has something in the way (the inn's chimney), the left half is grown and mirrored.
A gym also gets a proper entrance made from the building's own window pieces. adv-world.js looks these props up before the exterior sheet."""
import colorsys, json
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
def hall_gym(): return hall(4, 4, wins=2)                 # 88 px each side: the old hand-made gym, now the general hall

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
def inn_gym(): return inn('EggCGGe', 9)

def seamless(a, bands, axis):
    """every repeated band must join itself without a seam: the column (row) after it matches its first, the one before it its last"""
    b = a if axis == 'x' else a.transpose(1, 0, 2)
    for x, e, _ in bands:
        err = np.abs(b[:, e].astype(int) - b[:, x]).mean() + np.abs(b[:, e - 1].astype(int) - b[:, x - 1]).mean()
        assert err < 1, (x, e, err)

def stripes(st, w):
    """w px of the hall's window stripes (8 px each; a few 6 px ones, two px narrower, so any even width the roof tiles ask for fits)"""
    s8, s6 = st[:, 24:32], hcat(st[:, 24:27], st[:, 28:31]); b = next(b for b in range(5) if (w - 6 * b) % 8 == 0 and w >= 6 * b)
    return hcat(*[s8] * ((w - 6 * b) // 8), *[s6] * b) if w else st[:, :0]

def hall(k, j, wins=None):
    """the hall k roof tiles (22 px) wider each side and j tiles deeper: stripes either side of the window to match, the ledge stretched, a glass door
    through the middle pane; wins: put a two pane window into the stripes either side, this many stripes in from the end"""
    a, p = src('hall'); a = keep_main(a); W = 22 * k
    roof = widen(a[:61], [(0, 61, [(24, 46, k), (62, 84, k)])])
    st = a[61:77]; L = stripes(st, W)
    band = hcat(st[:, :32], L, st[:, 32:75], L[:, ::-1], st[:, 75:])
    lg = a[77:]; lw = hcat(*[lg[:, 38:46]] * (W // 8), lg[:, 38:38 + W % 8]) if W else lg[:, :0]
    rw = hcat(*[lg[:, 62:70]] * (W // 8), lg[:, 62:62 + W % 8]) if W else lg[:, :0]
    base = hcat(lg[:, :46], lw, lg[:, 46:70], rw, lg[:, 70:])
    a = vcat(roof, band, base); a = deepen(a, [(26, 48, j)]); dy = 22 * j; cx = 54 + W
    if wins is not None:
        w2 = hcat(a[:, 35 + W:49 + W], a[:, 37 + W:47 + W], a[:, 71 + W:73 + W])[61 + dy:77 + dy]
        for x in (24 + 8 * wins, 2 * cx - 24 - 8 * wins - w2.shape[1]): a[61 + dy:77 + dy, x:x + w2.shape[1]] = w2
    door(a, 46 + W, 62 + dy, 95 + dy)
    return a, cx, p['ay'] + dy

def inn(layout, n):
    """the inn from its parts, left to right: E the end wall, g a gable wing (G mirrored), C the gabled entrance (double door under the canopy),
    P the old porch made symmetric (canopy, double door); e the end wall mirrored. n more clapboard periods of roof"""
    a, p = src('inn'); a = keep_main(a); a[121:] = 0
    P = hcat(a[:, 51:64], a[:, 51:64][:, ::-1])
    parts = {'E': a[:, :3], 'e': a[:, :3][:, ::-1], 'g': a[:, 3:51], 'G': a[:, 3:51][:, ::-1], 'C': inn_entrance(a), 'P': P}
    x = 0
    for ch in layout:
        if ch in 'CP': cx = x + parts[ch].shape[1] // 2
        x += parts[ch].shape[1]
    return inn_roof(hcat(*[parts[ch] for ch in layout]), n), cx, p['ay'] + 7 * n

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

# ---------------------------------------------------------------- colourways: the same art with its roof, walls or trim moved to another hue (value and contrast kept)
def recolor(a, sel, to, keep=None):
    """pixels whose (hue deg, sat, val) pass sel get to(h, s, v) -> (h, s, v); keep(x, y) protects a spot (a door)"""
    a = a.copy(); f = a[..., :3].reshape(-1, 3) / 255.0; out = f.copy(); H, W = a.shape[:2]
    for i, (r, g, b) in enumerate(f):
        if a.reshape(-1, 4)[i, 3] == 0 or (keep and keep(i % W, i // W)): continue
        h, sa, v = colorsys.rgb_to_hsv(r, g, b)
        if sel(h * 360, sa, v): h2, s2, v2 = to(h * 360, sa, v); out[i] = colorsys.hsv_to_rgb((h2 % 360) / 360, min(1, s2), min(1, v2))
    a[..., :3] = (out.reshape(H, W, 3) * 255).round().astype(np.uint8); return a
ROOF = lambda h, s, v: (h <= 24 or h >= 350) and s >= 0.45 and v >= 0.42          # the inn's red clapboard
SIDING = lambda h, s, v: 228 <= h <= 252 and 0.18 <= s <= 0.36                    # the inn's lilac siding
BLUE = lambda h, s, v: 180 <= h <= 215 and s >= 0.25                              # the hotel's blue (roof, pillars, trim)
GLASS = lambda h, s, v: 185 <= h <= 205 and s >= 0.5 and v < 0.8                  # the hall's teal window stripes
ROOFS = {'red': None, 'green': lambda h, s, v: (112, s * 0.62, v * 0.9), 'blue': lambda h, s, v: (212, s * 0.7, v), 'brown': lambda h, s, v: (26, s * 0.6, v * 0.78),
         'slate': lambda h, s, v: (218, s * 0.2, v * 0.85), 'plum': lambda h, s, v: (318, s * 0.45, v * 0.8)}
WALLS = {'lilac': None, 'mint': lambda h, s, v: (150, s * 0.9, v * 1.02), 'cream': lambda h, s, v: (42, s * 0.9, v * 1.15), 'rose': lambda h, s, v: (345, s * 0.9, v * 1.08),
         'white': lambda h, s, v: (220, s * 0.15, v * 1.2), 'sky': lambda h, s, v: (200, s * 1.1, v * 1.05)}
HUES = {'blue': None, 'teal': lambda h, s, v: (h - 22, s, v * 0.95), 'red': lambda h, s, v: (h + 160, s * 0.85, v * 0.9), 'violet': lambda h, s, v: (h + 70, s * 0.7, v * 0.9),
        'green': lambda h, s, v: (h - 70, s * 0.75, v * 0.85)}
GLASSES = {'teal': None, 'green': lambda h, s, v: (h - 55, s, v), 'amber': lambda h, s, v: (h - 160, s * 0.9, v * 1.1), 'blue': lambda h, s, v: (h + 18, s, v)}

def inn_c(layout, n, roof, wall):
    def f():
        a, cx, ay = inn(layout, n); door = lambda x, y: abs(x - cx) < 9 and y > a.shape[0] - 14   # the door leaves keep their wood
        if ROOFS[roof]: a = recolor(a, ROOF, ROOFS[roof], door)
        if WALLS[wall]: a = recolor(a, SIDING, WALLS[wall])
        return a, cx, ay
    return f
def hotel_c(k, n, e, hue):
    def f():
        a, cx, ay = hotel(k, n, e)
        return (recolor(a, BLUE, HUES[hue]) if HUES[hue] else a), cx, ay
    return f
def hall_c(k, j, wins, glass):
    def f():
        a, cx, ay = hall(k, j, wins)
        return (recolor(a, GLASS, GLASSES[glass]) if GLASSES[glass] else a), cx, ay
    return f

# the catalog: name -> (builder, source prop). Gyms first, then the town buildings: every family in several sizes and colourways
BIG = {'hallGym': (hall_gym, 'hall'), 'innGym': (inn_gym, 'inn'), 'hotelGym': (lambda: hotel(3, 3, 2), 'hotelBlue'),
       'hallBig': (lambda: hall(1, 1), 'hall'), 'innBig': (lambda: inn('EgCGe', 3), 'inn'), 'hotelBlueBig': (lambda: hotel(1, 1), 'hotelBlue'), 'martBig': (lambda: mart(2, 2), 'warehouse')}
for lay, n, tag in (('EgPGe', 2, 'inn4'), ('EgCGe', 3, 'inn5'), ('EggCGe', 3, 'inn6')):
    for roof, wall in (('red', 'lilac'), ('green', 'cream'), ('blue', 'white'), ('brown', 'rose'), ('slate', 'mint'), ('plum', 'sky')):
        BIG[f'{tag}-{roof}-{wall}'] = (inn_c(lay, n, roof, wall), 'inn')
for k, j, wins, tag in ((0, 1, None, 'hall4'), (1, 1, None, 'hall5'), (2, 2, 0, 'hall6')):
    for glass in GLASSES: BIG[f'{tag}-{glass}'] = (hall_c(k, j, wins, glass), 'hall')
for k, n, e, tag in ((0, 1, 0, 'hotel4'), (1, 1, 0, 'hotel5'), (2, 1, 1, 'hotel6')):
    for hue in HUES: BIG[f'{tag}-{hue}'] = (hotel_c(k, n, e, hue), 'hotelBlue')
for k, n, tag in ((1, 1, 'mart6'), (2, 2, 'mart7'), (3, 2, 'mart8')): BIG[tag] = (lambda k=k, n=n: mart(k, n), 'warehouse')

props, PACK, x, y, rh, ROW = {}, [], 0, 0, 0, 1400      # shelf packing, ROW px wide
for name, (fn, s) in BIG.items():
    img, dx, ay = fn(); img, off = trim(keep_main(img)); ax = int(dx - off)
    if x + img.shape[1] > ROW: x, y, rh = 0, y + rh + 2, 0
    p = EXT['props'][s]; d = {k: v for k, v in p.items() if k not in ('by', 'door', 'solid')}
    hw = img.shape[1] // 2 - 4
    d.update(sx=x, sy=y, sw=img.shape[1], sh=img.shape[0], ax=ax, ay=ay, door=[0, -2], solid=[-hw, -28, hw, 1], of=s)
    props[name] = d; PACK.append((x, y, img)); x += img.shape[1] + 2; rh = max(rh, img.shape[0])
W, H = max(px + i.shape[1] for px, _, i in PACK), y + rh
sheet = np.zeros((H, W, 4), np.uint8)
for px, py, i in PACK: sheet[py:py + i.shape[0], px:px + i.shape[1]] = i
Image.fromarray(sheet).save(ROOT / 'assets/adv/big.png')
(ROOT / 'data/adv/tileset-big.js').write_text('// made by tools/adv-build-big.py: bigger buildings grown from the real art\nwindow.ADV_TILESET_BIG = ' + json.dumps({'file': 'assets/adv/big.png', 'props': props}) + ';\n', encoding='utf8')
(ROOT / 'tools/.cache').mkdir(exist_ok=True)
bg = Image.new('RGBA', (W, H), (96, 160, 80, 255)); bg.alpha_composite(Image.fromarray(sheet))
bg.resize((W * 2, H * 2), Image.NEAREST).save(ROOT / 'tools/.cache/big-contact.png')
for n, d in props.items(): print(n, d['sw'], 'x', d['sh'], ' about', round(d['sw'] / 32, 1), 'x', round(d['sh'] / 32, 1), 'tiles')
