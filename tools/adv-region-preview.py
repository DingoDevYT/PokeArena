"""Reads the generated world (data/adv/world.js + chunks) and draws two previews:
tools/.cache/region-preview.png  the whole island, 1 px per tile (colour per material, darker per height level, props as dots, towns labelled)
tools/.cache/goldacre-preview.png  a 120 x 80 tile window around the place (G7: 226 x 192 tiles covering Goldacre and Routes 5, 7, 8) drawn 1:1 with the real tileset (same autotile and cliff rules as src/adv-world.js and src/adv-render.js)
Run: py -3.12 -I tools/adv-region-preview.py [CODE]   (CODE = another place to put in the 1:1 window, e.g. T1)"""
import os, re, sys, json
import numpy as np
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); D = os.environ.get('ADV_GEN_OUT') or os.path.join(ROOT, 'data', 'adv');   # ADV_GEN_OUT: preview a trial run's copy
CACHE = os.path.join(ROOT, 'tools', '.cache')
T, CH = 32, 32
W = json.loads(re.search(r'ADV_WORLD = (\{.*\});', open(os.path.join(D, 'world.js'), encoding='utf8').read(), re.S).group(1))
PAL = W['palette'] + [n for n in ('rgGrass', 'rgPath', 'rgWater') if n not in W['palette']];   # data/adv/tileset-region.js appends the map-lab mats at load, in this order
CW, CHN = W['chunksW'], W['chunksH']; WP, HP = CW * CH, CHN * CH
tsrc = open(os.path.join(D, 'tileset.js'), encoding='utf8').read(); TS = json.loads(tsrc[tsrc.index('{'):tsrc.rindex('}') + 1])

def unrle(s):
    v, n = zip(*[((t.split('x')[0], t.split('x')[1]) if 'x' in t else (t, '1')) for t in s.split(',')])
    return np.repeat(np.array(v, np.int16), np.array(n, int))
A = {k: np.zeros((HP, WP), np.int16) for k in ('h', 'mat', 'over', 'kind')}; A['deck'] = np.full((HP, WP), -1, np.int16); A['mat'][:] = PAL.index(W['fill'])
props = []
for f in os.listdir(os.path.join(D, 'chunks')):
    cx, cy = map(int, f[:-3].split('_')); s = open(os.path.join(D, 'chunks', f), encoding='utf8').read()
    for k in ('h', 'mat', 'over', 'kind', 'deck'):
        m = re.search(k + r':"([^"]*)"', s)
        if m: A[k][cy * CH:cy * CH + CH, cx * CH:cx * CH + CH] = unrle(m.group(1)).reshape(CH, CH)
    props += json.loads(re.search(r'props:(\[.*\])\}\);', s, re.S).group(1))
h, mat, over, kind, deck = A['h'], A['mat'], A['over'], A['kind'], A['deck']

# ---------------------------------------------------------------- overview
COL = {'rgGrass': (136, 207, 141), 'rgPath': (150, 120, 85), 'rgWater': (120, 190, 235), 'grass': (136, 207, 141), 'path': (150, 120, 85), 'sand': (240, 220, 140), 'duneSand': (225, 190, 90), 'water': (120, 190, 235), 'waterDeep': (60, 120, 190), 'sandWater': (140, 205, 235), 'sandWaterDeep': (80, 150, 205),
  'tallgrass': (60, 150, 70), 'ashGround': (115, 120, 125), 'snow': (235, 242, 248), 'swamp': (150, 110, 140), 'pavingStone': (190, 185, 175), 'dryGrass': (200, 190, 90), 'ford': (170, 215, 235), 'soilTilled': (120, 85, 55), 'hayField': (215, 190, 90), 'wetGrass': (110, 190, 130), 'boardwalk': (176, 126, 74), 'pavingTan': (205, 180, 140), 'soilCobble': (150, 140, 130), 'void': (0, 0, 0)}
lut = np.array([COL[n] for n in PAL], np.float32)
img = lut[mat]
img = np.where((over == PAL.index('tallgrass'))[..., None], lut[PAL.index('tallgrass')], img)
img *= (0.86 ** h)[..., None]
img = np.where((kind > 0)[..., None] & (kind < 8)[..., None], np.array([255, 120, 0], np.float32), img)
img = np.where((kind == 8)[..., None], np.array([120, 70, 30], np.float32), img)
img = img.clip(0, 255).astype(np.uint8)
def pcol(n):
    if re.search(r'Tree|tree|pine|Pine|Oak|oak|palm|Fir|fir|cactus|Cactus|mushroomStump|snow', n): return (20, 80, 30)
    if re.search(r'rock|Rock|boulder|Boulder|stone|Stone|crystal', n): return (70, 70, 75)
    if P := TS['props'].get(n): return (230, 40, 40) if P['sw'] >= 60 else (250, 230, 60)
    return (255, 0, 255)
for n, x, y, *_ in props:   # props may carry z (map-lab plateaus)
    c, r = int(x // T), int(y // T)
    if 0 <= r < HP and 0 <= c < WP: img[r, c] = pcol(n)
big = Image.fromarray(img); d = ImageDraw.Draw(big)
for code, t in W['towns'].items():
    cx, cy = int(t['x'] // T), int(t['y'] // T); d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), outline=(255, 0, 0)); d.text((cx + 5, cy - 5), t['name'], fill=(0, 0, 0)); d.text((cx + 4, cy - 6), t['name'], fill=(255, 255, 255))
big.save(os.path.join(CACHE, 'region-preview.png')); print('region-preview.png', big.size)

# ---------------------------------------------------------------- 1:1 window with the real tileset
sheet = Image.open(os.path.join(ROOT, TS['file'])).convert('RGBA'); COLS = TS['cols']
ROLES = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW']
grp = list(range(len(PAL)))
for g in W.get('groups', []):
    for n in g: grp[PAL.index(n)] = PAL.index(g[0])
def tile(i):
    return sheet.crop(((i % COLS) * T, (i // COLS) * T, (i % COLS) * T + T, (i // COLS) * T + T))
def hsh(c, r): return ((c * 73856093) & 0xffffffff) ^ ((r * 19349663) & 0xffffffff)
def pick(defn, role, c, r):
    i = defn.get(role, defn['C']); return i[hsh(c, r) % len(i)] if isinstance(i, list) else i
def role(c, r, m, layer):
    def same(dc, dr):
        cc, rr = c + dc, r + dr
        if not (0 <= cc < WP and 0 <= rr < HP): return True
        return over[rr, cc] == m if layer else grp[mat[rr, cc]] == grp[m]
    n, so, e, w = same(0, -1), same(0, 1), same(1, 0), same(-1, 0)
    v = 'N' if not n else 'S' if not so else ''; hz = 'E' if not e else 'W' if not w else ''
    if v or hz: return v + hz
    for nm, dc, dr in (('iNE', 1, -1), ('iNW', -1, -1), ('iSE', 1, 1), ('iSW', -1, 1)):
        if not same(dc, dr): return nm
    return 'C'
cache = {}
def T_(i):
    if i not in cache: cache[i] = tile(i)
    return cache[i]
code = sys.argv[1] if len(sys.argv) > 1 else 'G7'
WIN = [int(a) for a in sys.argv[2:6]] if len(sys.argv) > 5 else None; OUTN = sys.argv[6] if len(sys.argv) > 6 else 'goldacre-preview.png'; SC = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0
tw = W['towns'][code]; c0 = int(tw['x'] // T) - 60; r0 = int(tw['y'] // T) - 40; NC, NR = 120, 80
if code == 'G7': c0, r0, NC, NR = c0 + 60 - 85, r0 + 40 - 105, 226, 192      # Goldacre plus the first ~100 tiles of Routes 5, 7 and 8
if WIN: c0, r0, NC, NR = WIN     # v2: any window, in tile coords (x y w h), written to tools/.cache/<out>, scaled by <scale>
PADR = 10
out = Image.new('RGBA', (NC * T, (NR + PADR) * T), (0, 0, 0, 255))
def ground(c, r, x, y):
    m = mat[r, c]; df = TS['mats'].get(PAL[m])
    if df:
        ov = df.get('overlay')
        if ov: out.alpha_composite(T_(pick(TS['mats']['grass'], 'C', c, r)), (x, y))
        out.alpha_composite(T_(pick(df, role(c, r, m, 0), c, r)), (x, y))
    o = over[r, c]
    if o and TS['mats'].get(PAL[o]): out.alpha_composite(T_(pick(TS['mats'][PAL[o]], role(c, r, o, 1), c, r)), (x, y))
def cliff(name, rl, x, y):
    v = TS['cliff'].get(name)
    if isinstance(v, dict): v = v.get(rl)
    if v is None:
        dr = ImageDraw.Draw(out); col = (140, 100, 60, 255) if name.startswith('stairs') else (160, 130, 90, 255)
        dr.rectangle((x, y, x + T - 1, y + T - 1), fill=col); [dr.line((x, y + k, x + T, y + k), fill=(90, 60, 30, 255)) for k in range(0, T, 6)]; return
    out.alpha_composite(T_(v), (x, y))
def hh(c, r): return int(h[r, c]) if 0 <= c < WP and 0 <= r < HP else 0
def hd(c, r): return max(hh(c, r), int(deck[r, c]) if 0 <= c < WP and 0 <= r < HP else -1)
STAIR = [None, (0, -1), (0, 1), (1, 0), (-1, 0)]
def lower(c, r, hv, dc, dr):
    nh = hd(c + dc, r + dr)
    if nh >= hv: return False
    k = int(kind[r + dr, c + dc]); st = STAIR[k] if k < 5 else None
    return not (st and st == (-dc, -dr) and nh + 1 == hv)
def hasface(c, r): return hh(c, r) > 0 and hh(c, r) > max(0, hd(c, r + 1))
rows = {}
for r in range(r0, r0 + NR + PADR):
    for c in range(c0, c0 + NC):
        if not (0 <= r < HP and 0 <= c < WP): continue
        x, y = (c - c0) * T, (r - r0) * T
        if h[r, c] == 0:
            ground(c, r, x, y)
            k = int(kind[r, c])
            if 0 < k < 5: cliff('stairs' + 'NSEW'[k - 1], None, x, y)
            if deck[r, c] >= 0:
                out.alpha_composite(Image.new('RGBA', (T, T), (0, 0, 0, 72)), (x, y))
items = []
for r in range(r0, r0 + NR + PADR):
    if not any(h[r, c0:c0 + NC] > 0) and not any(deck[r, c0:c0 + NC] >= 0): continue
    def strip(r=r):
        for c in range(c0, c0 + NC):
            hv = int(h[r, c])
            if hv <= 0: continue
            x, y = (c - c0) * T, (r - r0) * T - hv * T
            ground(c, r, x, y); k = int(kind[r, c])
            if 0 < k < 5: cliff('stairs' + 'NSEW'[k - 1], None, x, y)
            n, e, w = lower(c, r, hv, 0, -1), lower(c, r, hv, 1, 0), lower(c, r, hv, -1, 0)
            if n or e or w: cliff(('rimNE' if e else 'rimNW' if w else 'rimN') if n else 'rimE' if e else 'rimW', None, x, y)
        for c in range(c0, c0 + NC):
            hv = int(h[r, c])
            if hv <= 0: continue
            hf = max(0, hd(c, r + 1)); nn = hv - hf
            if nn <= 0: continue
            rl = 'L' if not hasface(c - 1, r) else 'R' if not hasface(c + 1, r) else 'M'
            k = int(kind[r + 1, c]); st = STAIR[k] if k < 5 else None
            sp = 'stairsN' if st and st[1] == -1 and hh(c, r + 1) + 1 == hv else ''
            for j in range(nn): cliff(sp or ('faceTop' if j == 0 else 'face'), None if sp else rl, (c - c0) * T, (r + 1 - r0) * T - hv * T + j * T)
    items.append((r, 0, r * T, strip))
    dk = {}
    for c in range(c0, c0 + NC):
        if deck[r, c] >= 0: dk.setdefault(int(deck[r, c]), []).append(c)
    for dv, cs in dk.items():
        def dfn(r=r, dv=dv, cs=cs):
            dr = ImageDraw.Draw(out)
            for c in cs:
                x, y = (c - c0) * T, (r - r0) * T - dv * T; dr.rectangle((x, y, x + T - 1, y + T - 1), fill=(162, 113, 63, 255))
                for k in range(0, T, 8): dr.line((x + k, y, x + k, y + T), fill=(124, 82, 40, 255))
        items.append((r, 2, r * T, dfn))
for n, x, y, *_ in props:   # props may carry z (map-lab plateaus)
    d_ = TS['props'].get(n)
    if not d_ or not (c0 * T - 120 < x < (c0 + NC) * T + 120 and r0 * T - 40 < y < (r0 + NR + PADR) * T + 220): continue
    r = int(y // T); z = hh(int(x // T), r) * T
    def pf(n=n, x=x, y=y, d_=d_, z=z):
        sp = sheet.crop((d_['sx'], d_['sy'], d_['sx'] + d_['sw'], d_['sy'] + d_['sh'])); out.paste(sp, (int(round(x - c0 * T - d_['ax'])), int(round(y - z - r0 * T - d_['ay']))), sp)
    items.append((r, 1, y, pf))
items.sort(key=lambda t: (t[0], t[1], t[2]))
for _, _, _, f in items:
    f()
fin = out.crop((0, 0, NC * T, NR * T)).convert('RGB')
if SC != 1: fin = fin.resize((int(NC * T * SC), int(NR * T * SC)), Image.LANCZOS)
fin.save(os.path.join(CACHE, OUTN)); print(OUTN, fin.size)
