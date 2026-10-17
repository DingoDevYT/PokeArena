"""Kenora region generator: builds the whole island from Landon's three map PNGs into data/adv/ (chunks, world.js, zones.js).
Run: py -3.12 -I tools/adv-gen-region.py [--only G7] [--nogap]   (--only writes just the chunks around that place and skips world.js / zones.js; --nogap closes the Route 5 hedge gaps, for sealing checks)
Deterministic (fixed seeds). Random props (scatter) use one RNG per chunk and per call, seeded from (call, chunk x, chunk y), and the hand-placed Route decorators use pure hashes, so editing one place only changes that place's chunks. Needs PIL, numpy, scipy; numba is used for the flood fill when installed. See docs/REGION.md."""
import sys, os, re, json, time, collections, zlib, hashlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
try:
    from numba import njit
except Exception:
    njit = lambda f: f
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAPS = 'C:/Users/lando/Desktop/dungeons-pokemon/MAPS/KENORA REGION W- '
OUT = os.environ.get('ADV_GEN_OUT') or os.path.join(ROOT, 'data', 'adv')   # ADV_GEN_OUT: a copy of data/adv to generate into (a trial run never touches the live world)
REPO_MAPS = {'TERRAIN ONLY.png': 'terrain-only.webp', 'LOCATIONS.png': 'locations.webp'}   # tools/kenora-maps: the owner's maps at 1717 x 2000, the same art as the 3640 x 4240 originals
def mapimg(name):
    """one of the owner's maps at the original 3640 x 4240: the PC original when present, else the repo copy scaled up (nearest, so the flat colours stay exact)"""
    if os.path.exists(MAPS + name): return Image.open(MAPS + name)
    return Image.open(os.path.join(ROOT, 'tools', 'kenora-maps', REPO_MAPS[name])).convert('RGB').resize((3640, 4240), Image.NEAREST)
S, T, CH = 3.5, 32, 32
CW, CHN = 33, 38
WP, HP = CW * CH, CHN * CH
T0 = time.time()
ONLY = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
def log(*a): print(f'[{time.time() - T0:5.1f}s]', *a, flush=True)
def disk(r): a = np.arange(-r, r + 1) ** 2; return np.add.outer(a, a) <= r * r
def dil(m, r): return ndi.binary_dilation(m, disk(r))
def ero(m, r): return ndi.binary_erosion(m, disk(r))
def noise(sigma, seed):
    n = ndi.gaussian_filter(np.random.default_rng(seed).standard_normal((HP, WP)).astype(np.float32), sigma)
    return n / n.std()
YY, XX = np.mgrid[0:HP, 0:WP]
def _blocks(m, q): h2, w2 = HP // q * q, WP // q * q; return m[:h2, :w2].reshape(h2 // q, q, w2 // q, q)
def _up(c, q): o = np.zeros((HP, WP), c.dtype); o[:c.shape[0] * q, :c.shape[1] * q] = np.repeat(np.repeat(c, q, 0), q, 1); return o
def blocky(m, q=3, lo=.5):
    """v2 (docs/MAPDESIGN.md): snap a mask onto a global q x q lattice so its edges are straight runs at least q long (the autotile corners round them): no 1 tile sawtooth on diagonals"""
    return _up(_blocks(m, q).mean((1, 3)) >= lo, q)
def snap_levels(a, q=3):
    """blocky() for a level map: each q x q block takes its rounded mean level"""
    o = a.copy(); n, m = HP // q * q, WP // q * q; o[:n, :m] = np.repeat(np.repeat(np.round(_blocks(a, q).mean((1, 3))).astype(a.dtype), q, 0), q, 1); return o
def thin(m):
    """Zhang-Suen thinning: a 1 tile skeleton of a mask that keeps it connected (the road centre lines)"""
    a = np.pad(m.astype(np.uint8), 1); ys_, xs_ = np.nonzero(a); y0, y1, x0, x1 = ys_.min() - 1, ys_.max() + 2, xs_.min() - 1, xs_.max() + 2
    a = a[y0:y1, x0:x1].copy()
    while True:
        ch = 0
        for st in (0, 1):
            p2, p3, p4, p5, p6, p7, p8, p9 = (a[:-2, 1:-1], a[:-2, 2:], a[1:-1, 2:], a[2:, 2:], a[2:, 1:-1], a[2:, :-2], a[1:-1, :-2], a[:-2, :-2])
            B = p2.astype(np.int16) + p3 + p4 + p5 + p6 + p7 + p8 + p9
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]; A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.int16) for i in range(8))
            c = (a[1:-1, 1:-1] == 1) & (B >= 2) & (B <= 6) & (A == 1)
            c &= ((p2 * p4 * p6) == 0) & ((p4 * p6 * p8) == 0) if st == 0 else ((p2 * p4 * p8) == 0) & ((p2 * p6 * p8) == 0)
            if c.any(): a[1:-1, 1:-1][c] = 0; ch = 1
        if not ch: break
    full = np.zeros((HP + 2, WP + 2), np.uint8); full[y0:y1, x0:x1] = a
    return full[1:-1, 1:-1] > 0
def snap_road(ridge, q=3):
    """a thin centreline mask becomes a chain of q x q blocks (4-connected): a q wide road of long straight runs joined at corners, however it wanders on the artwork"""
    b = _blocks(ridge, q); c = b.any((1, 3)); cov = b.sum((1, 3))
    for _ in range(2):
        for i, j in np.argwhere(c[:-1, :-1] & c[1:, 1:] & ~c[:-1, 1:] & ~c[1:, :-1]):
            if cov[i, j + 1] >= cov[i + 1, j]: c[i, j + 1] = True
            else: c[i + 1, j] = True
        for i, j in np.argwhere(c[:-1, 1:] & c[1:, :-1] & ~c[:-1, :-1] & ~c[1:, 1:]):
            if cov[i, j] >= cov[i + 1, j + 1]: c[i, j] = True
            else: c[i + 1, j + 1] = True
    return _up(c, q)
def rcorner(r):
    """a rounded corner as per-row insets (cells left out, top row first): steps of 2 along the edge, never a 1 tile sawtooth; r=4 -> [4, 2, 0]"""
    return [1] if r <= 2 else [3, 1] if r == 3 else [r - 2 * j for j in range(r // 2 + 1) if r - 2 * j > 0]
def rrect_mask(h_, w_, r):
    """h_ x w_ bool rectangle with round corners of radius r (cells); r is capped by a third of the short side"""
    r = int(min(r, min(h_, w_) // 3)); m = np.ones((h_, w_), bool)
    for j, ins in enumerate(rcorner(r)): m[j, :ins] = False; m[j, w_ - ins:] = False; m[h_ - 1 - j, :ins] = False; m[h_ - 1 - j, w_ - ins:] = False
    return m

PAL =['void', 'grass', 'path', 'sand', 'duneSand', 'water', 'waterDeep', 'sandWater', 'sandWaterDeep', 'tallgrass', 'ashGround', 'snow', 'swamp', 'pavingStone', 'dryGrass', 'ford', 'soilTilled', 'hayField', 'wetGrass', 'boardwalk', 'pavingTan', 'soilCobble']
M_ = {n: i for i, n in enumerate(PAL)}
GRASS, PATH, SAND, DUNE, WAT, WATD, SWAT, SWATD, TALL, ASH, SNOW, SWAMP, PAVE, FORD, SOIL, HAYF, WETG, BW, TAN, COBB = (M_[n] for n in ['grass', 'path', 'sand', 'duneSand', 'water', 'waterDeep', 'sandWater', 'sandWaterDeep', 'tallgrass', 'ashGround', 'snow', 'swamp', 'pavingStone', 'ford', 'soilTilled', 'hayField', 'wetGrass', 'boardwalk', 'pavingTan', 'soilCobble'])
MATN = {'path': PATH, 'tan': TAN, 'cobble': COBB}
WATER_NAMES = ['water', 'waterDeep', 'sandWater', 'sandWaterDeep']
GROUPS = [WATER_NAMES + ['ford'], ['sand', 'duneSand', 'path', 'pavingStone'], ['ashGround', 'snow']]
isw = lambda m: (m >= WAT) & (m <= SWATD)

# (code, name, map px x, y, kind) kind G = gym city, T = town, L = landmark
PLACES = [('G1', 'Dunereach', 1175, 1200), ('G2', 'Sprucevale', 2673, 1285), ('G3', 'Fernwell Park', 895, 1803), ('G4', 'Claystone', 1718, 2024), ('G5', 'Aldermere City', 2991, 2015),
  ('G6', 'Pinegrove', 2092, 3033), ('G7', 'Goldacre', 1048, 3084), ('G8', 'Sporehaven', 2198, 3479), ('T1', 'Frostfall', 1947, 1324), ('T2', 'Sailsport', 3156, 2473), ('T3', 'Hallowmead', 2388, 2473),
  ('T4', 'Tradeway', 1595, 2694), ('T5', 'Salt Bay', 467, 2783), ('T6', 'Spindlewood', 2605, 2906), ('T7', 'Longshore', 395, 3364), ('T8', 'Duskmoss', 2707, 3674), ('L1', 'Statue of Umbra', 1010, 933),
  ('L2', 'Fernwell Sanctuary', 581, 1604), ('L3', 'Pokemon League', 2677, 904), ('L4', 'Quiet Plain', 1701, 3895)]
RADIUS = {'G': 40, 'T': 28, 'L': 18}
LABELS = {1: (1790, 3640), 2: (2036, 3279), 3: (2079, 2855), 4: (1867, 2694), 5: (1251, 2919), 6: (594, 3373), 7: (959, 3258), 8: (967, 2893), 9: (662, 2783), 10: (882, 2622), 11: (967, 2316),
  12: (895, 2011), 13: (895, 1680), 14: (755, 1604), 15: (1022, 1243), 16: (1379, 1196), 17: (2087, 1188), 18: (2520, 1277), 19: (2673, 1103), 20: (2698, 1510), 21: (2889, 1633), 22: (2987, 1824),
  23: (3008, 2198), 24: (3021, 2363), 101: (2422, 3487), 104: (2244, 2630), 105: (2601, 2338), 106: (2783, 2138), 111: (2329, 3038), 121: (1171, 1039), 131: (2185, 2198), 132: (1939, 2083),
  133: (1527, 2002), 134: (1209, 1905)}
slug = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

# ---------------------------------------------------------------- tileset facts (sizes, doors, solids)
_ts = open(os.path.join(OUT, 'tileset.js'), encoding='utf8').read()
PROPS = json.loads(_ts[_ts.index('{'):_ts.rindex('}') + 1])['props']
def P(name):
    """the prop's sizes in DATA px: 2x pixel art (def density 0.5) is stored in sheet px, one sheet px is `density` data px"""
    assert name in PROPS, 'unknown prop ' + name
    d = PROPS[name]; k = d.get('density')
    if not k: return d
    f = lambda v: int(round(v * k)); e = dict(d)
    for key in ('sw', 'sh', 'ax', 'ay'): e[key] = f(d[key])
    if d.get('solid'): e['solid'] = [f(v) for v in d['solid']]
    if d.get('door'): e['door'] = [f(v) for v in d['door']]
    return e

# ---------------------------------------------------------------- 1. biomes
terr = np.array(mapimg('TERRAIN ONLY.png').convert('RGB'))
h0, w0 = terr.shape[:2]
ys = np.minimum(((np.arange(HP) + .5) * S).astype(int), h0 - 1); xs = np.minimum(((np.arange(WP) + .5) * S).astype(int), w0 - 1)
tt = terr[ys][:, xs].astype(np.int32)
ANCH = {'grass': [(136, 207, 141), (115, 175, 119), (115, 176, 120)], 'meadow': [(166, 219, 170)], 'forest': [(84, 129, 88), (89, 125, 90), (102, 156, 106), (97, 142, 100), (103, 138, 104)],
  'rock': [(110, 123, 124), (104, 116, 117), (99, 110, 111)], 'cap': [(212, 226, 228), (225, 238, 241), (201, 214, 216)], 'snow': [(216, 234, 231)], 'beach': [(255, 226, 101)],
  'scrub': [(224, 195, 70)], 'fungal': [(197, 169, 184), (180, 178, 169)], 'shroom': [(136, 51, 105)]}
CN = ['water'] + list(ANCH); C = {n: i for i, n in enumerate(CN)}
cols = np.array([c for n in ANCH for c in ANCH[n]]); cidx = np.array([C[n] for n in ANCH for _ in ANCH[n]])
cls = cidx[((tt[:, :, None, :] - cols[None, None]) ** 2).sum(3).argmin(2)].astype(np.uint8)
water0 = (tt[..., 2] >= 240) & (tt[..., 0] <= 190) & (tt[..., 1] >= 205)
water0[:175] = True                                  # the title lettering sits in the ocean
cls[water0] = 0
print('colour -> class table (sampled from TERRAIN ONLY):')
for n in ANCH: print(f'  {n:7s}', ' '.join('#%02x%02x%02x' % c for c in ANCH[n]))
print('  water   b>=240 & r<=190 & g>=205 (sea, lakes, rivers share one colour; sea = opening-connected to the border)')
log('classified', {n: int((cls == i).sum()) for n, i in C.items()})

# ---------------------------------------------------------------- 2. water: sea vs lakes and rivers
lab, _ = ndi.label(ndi.binary_opening(water0, disk(10)))
bl = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
sea = dil(np.isin(lab, list(bl)), 12) & water0
inl = dil(water0 & ~sea, 1)                           # rivers stay at least 4 tiles wide
sea = ndi.gaussian_filter(sea.astype(np.float32), 2.0) > .5; inl = ndi.gaussian_filter(inl.astype(np.float32), 1.4) > .5      # v2: soft curved shores, no 1 tile jags
water = sea | inl
land = ~water
beachc = (cls == C['beach']) & land
log('water', int(sea.sum()), int(inl.sum()))

# ---------------------------------------------------------------- 2b. C1 Route 8 river: one of the massif's rivers, flattened out into the water meadows (carved before the roads so the bridge pass finds it)
def stroke(pts):
    """union of discs along a polyline of (x, y, radius) tile points"""
    m = np.zeros((HP, WP), bool)
    for (x0, y0, r0), (x1, y1, r1) in zip(pts, pts[1:]):
        n = int(np.hypot(x1 - x0, y1 - y0) * 2) + 1
        for k in range(n + 1):
            u = k / n; x, y, r = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, r0 + (r1 - r0) * u + .45 * np.sin(u * 4 + x0)
            ya, yb, xa, xb = int(y - r - 1), int(y + r + 2), int(x - r - 1), int(x + r + 2)
            m[ya:yb, xa:xb] |= (XX[ya:yb, xa:xb] - x) ** 2 + (YY[ya:yb, xa:xb] - y) ** 2 <= r * r
    return m
RIVER = [(305, 770, 2.8), (296, 782, 3.0), (285, 795, 3.2), (276, 806, 3.4), (271, 816, 3.5), (268, 824, 3.5), (263, 836, 3.5), (256, 848, 3.3), (250, 858, 3.9), (243, 868, 4.6)]
CHAN = [[(242, 828, 1.5), (243, 840, 1.5), (240, 853, 1.6), (238, 866, 1.9)], [(296, 809, 1.5), (297, 816, 1.5), (297, 822, 1.5)]]   # small N-S channels (Bidoof dams across them)
riv = stroke(RIVER); chan = [stroke(c) for c in CHAN]
for (px, py, rx, ry) in ((237, 874, 11, 6), (242, 825, 4.5, 4), (296, 806, 4, 3.5), (297, 824, 3.5, 3), (228, 846, 5, 3.5)): riv |= ((XX - px) / rx) ** 2 + ((YY - py) / ry) ** 2 <= 1
for c in chan: riv |= c
riv = blocky(riv, 3, .42)                              # v2: the river bends in straight runs of 3+ with rounded corners, not a 1 tile staircase
FORDC = (255, 848)                                    # ford: a wadeable band across the river, 30 tiles downstream of the bridge
ford = riv & ((XX - FORDC[0]) ** 2 + (YY - FORDC[1]) ** 2 <= 5.2 ** 2)
assert ford.sum() > 30, 'ford centre is not on the river'
water |= riv & ~ford; inl |= riv; land = ~water; beachc &= land

# ---------------------------------------------------------------- 3. markers and roads
loc = np.array(mapimg('LOCATIONS.png').convert('RGB')).astype(np.int16)
terr16 = terr.astype(np.int16)
nearc = lambda c, tol: np.abs(loc - np.array(c, np.int16)).sum(2) <= tol
iconc = nearc((56, 167, 250), 30) | nearc((255, 255, 255), 6) | nearc((122, 122, 122), 10) | nearc((204, 204, 204), 10) | nearc((171, 171, 171), 10)
blue = nearc((56, 167, 250), 30) | nearc((122, 122, 122), 10)
road_px = (np.abs(loc - terr16).sum(2) > 30) & ~iconc
def area(mask, th):
    return np.array(Image.fromarray((mask * 255).astype(np.uint8)).resize((WP, HP), Image.BOX)) > th * 255
roadt = area(road_px, .35)
icont = dil(area(iconc, .3), 3)
TOWN = {}
for code, name, px, py in PLACES:
    w = blue[py - 70:py + 70, px - 70:px + 70]; yy, xx = np.nonzero(w)
    cx, cy = (px - 70 + xx.mean(), py - 70 + yy.mean()) if len(xx) else (px, py)
    TOWN[code] = dict(code=code, name=name, id=slug(name), kind=code[0], R=RADIUS[code[0]], tx=int(cx / S), ty=int(cy / S))
dland = ndi.distance_transform_edt(land)
for t in TOWN.values():                              # a few icons sit on the shoreline: move those inland until the disc centre has solid ground around it
    if dland[t['ty'], t['tx']] < 6:
        w = np.argwhere(dland[t['ty'] - 45:t['ty'] + 45, t['tx'] - 45:t['tx'] + 45] >= 8) + (t['ty'] - 45, t['tx'] - 45)
        k = np.hypot(w[:, 0] - t['ty'], w[:, 1] - t['tx']).argmin(); print(f"  {t['name']}: icon on the shore, centre moved {np.hypot(*(w[k] - (t['ty'], t['tx']))):.0f} tiles inland"); t['ty'], t['tx'] = map(int, w[k])
del loc, terr16, road_px, iconc, blue
roadt &= ~icont
lab, n = ndi.label(roadt, np.ones((3, 3)))
sz = ndi.sum(roadt, lab, range(1, n + 1)); roadt = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= 80])
# Route 16 / 17 pass behind the left and right peaks in the artwork: bridge each hidden stretch with a straight band
gap = np.zeros((HP, WP), np.uint8)
for (ya, yb, xa, xb), (yc, yd, xc, xd) in (((325, 360, 380, 430), (320, 350, 480, 540)), ((325, 352, 585, 632), (318, 348, 636, 690))):
    a = np.argwhere(roadt[ya:yb, xa:xb]); a = a[a[:, 1].argmax()] + (ya, xa)
    b = np.argwhere(roadt[yc:yd, xc:xd]); b = b[b[:, 1].argmin()] + (yc, xc)
    u = (b - a) / np.hypot(*(b - a))
    for k in np.linspace(-12, np.hypot(*(b - a)) + 12, 400): gap[int(a[0] + u[0] * k), int(a[1] + u[1] * k)] = 1
roadt |= dil(gap > 0, 7)
dt = ndi.distance_transform_edt(roadt)
ridge = thin(dt >= 4.5) | (gap > 0)                   # the centre line of the ~15 tile wide drawn road
band = snap_road(ridge, 3) & ~(dil(sea, 1))           # v2: a 3 wide road laid as blocks of 3, long straight runs and proper corners where the artwork's line wanders (no 1 tile sawtooth)
log('road band tiles', int(band.sum()))

# ---------------------------------------------------------------- 4. heights
cave_seed = (int(LABELS[4][0] / S), int(LABELS[4][1] / S))
mt = (cls == C['rock']) | (cls == C['cap'])
lab, n = ndi.label(mt, np.ones((3, 3))); sz = ndi.sum(mt, lab, range(1, n + 1))
mount = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= 6000])
cs = lab[cave_seed[1] - 6:cave_seed[1] + 7, cave_seed[0] - 6:cave_seed[0] + 7]; cs = cs[cs > 0]
cave = lab == np.bincount(cs).argmax() if len(cs) else np.zeros_like(mt)
if cave.sum() > 9000: print('WARN cave blob merged with something big'); cave = np.zeros_like(mt)
mount &= ~cave
mount = ndi.binary_fill_holes(mount | dil(mount, 2)) & land
dist = ndi.distance_transform_edt(mount)
Ht = np.where(mount, np.clip(np.floor((dist + 3 * noise(10, 1)) / 9) + 1, 1, 6), 0).astype(np.int8)
Ht = np.where(land & ~cave, snap_levels(Ht, 3), 0).astype(np.int8)     # v2: cliff bands follow the slopes in straight runs of 3+ (no 1 tile steps)
mount = (Ht > 0) & ~cave
Ht[cave] = 3
log('mountain tiles', int(mount.sum()), 'cave', int(cave.sum()))

# ---------------------------------------------------------------- zones: routes from the road band, split by label (geodesic)
import heapq
from scipy.spatial import cKDTree
disc = np.zeros((HP, WP), bool); tid = np.zeros((HP, WP), np.int16); TL = list(TOWN.values())
for i, t in enumerate(TL, 1):
    m = (XX - t['tx']) ** 2 + (YY - t['ty']) ** 2 <= t['R'] ** 2
    disc |= m; tid[m & (tid == 0)] = i
roadc = band & ~cave & ~disc
r4 = roadc & dil(cave, 28)
lab, n = ndi.label(roadc, np.ones((3, 3)))
rz = np.zeros((HP, WP), np.int16)                    # route number per road tile
pts = np.argwhere(roadc); tree = cKDTree(pts)
seeds = []
for r, (lx, ly) in LABELS.items():
    d, i = tree.query((ly / S, lx / S))
    if d > 45: print(f'WARN route {r} label is {d:.0f} tiles from any road'); continue
    seeds.append((r, tuple(pts[i])))
dist_g = {}; pq = [(0, r, y, x) for r, (y, x) in seeds]; heapq.heapify(pq)
while pq:
    d, r, y, x = heapq.heappop(pq)
    if rz[y, x] or (y, x) in dist_g and dist_g[(y, x)] < d: continue
    rz[y, x] = r; dist_g[(y, x)] = d
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ny, nx = y + dy, x + dx
            if roadc[ny, nx] and not rz[ny, nx]: heapq.heappush(pq, (d + (1.4 if dy and dx else 1), r, ny, nx))
rz[r4] = 4
orphan = roadc & (rz == 0)
if orphan.any():
    l2, n2 = ndi.label(orphan, np.ones((3, 3))); print(f'WARN {n2} road pieces without a route label ({int(orphan.sum())} tiles)')
    for i in range(1, n2 + 1):
        yy, xx = np.nonzero(l2 == i); print('   piece near tile', int(xx.mean()), int(yy.mean()), 'size', len(xx))
roadc = roadc & (rz > 0)

# docs/TRAVEL.md: the supply path between Sailsport (T2) and Aldermere City (G5). Routes 24 and 23 are the trade routes and already carry a 4 tile dirt band (PATH); the supply path is that band traced down its middle
# (shortest path, pulled toward the centre by the distance transform) and stored as tile points in world.supply. It adds no terrain, so reachability cannot change. `py -3.12 -I tools/adv-gen-region.py --supply` writes just this field into world.js.
def supply_path(a, b, routes=(24, 23)):
    ok = roadc & np.isin(rz, routes); ys_, xs_ = np.nonzero(ok)
    near = lambda t: (lambda k: (int(ys_[k]), int(xs_[k])))(((xs_ - t['tx']) ** 2 + (ys_ - t['ty']) ** 2).argmin())
    s, e = near(TOWN[a]), near(TOWN[b]); best = {s: 0.0}; prev = {}; pq = [(0.0, s[0], s[1])]
    while pq:
        d, y, x = heapq.heappop(pq)
        if (y, x) == e: break
        if d > best.get((y, x), 1e18): continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if (dy or dx) and ok[ny, nx]:
                    nd = d + (1.4 if dy and dx else 1) * (1 + 8 / (dt[ny, nx] + 1))
                    if nd < best.get((ny, nx), 1e18): best[(ny, nx)] = nd; prev[(ny, nx)] = (y, x); heapq.heappush(pq, (nd, ny, nx))
    assert e in best, f'no supply path between {a} and {b} along routes {routes}'
    path = [e]
    while path[-1] != s: path.append(prev[path[-1]])
    path.reverse(); keep = path[::4] + ([path[-1]] if (len(path) - 1) % 4 else [])
    return dict(w=2.6, pts=[[int(x), int(y)] for y, x in keep], ends=[dict(id=c, x=TOWN[c]['tx'], y=TOWN[c]['ty'], r=TOWN[c]['R']) for c in (a, b)])
SUPPLY = supply_path('T2', 'G5')
log('supply path', len(SUPPLY['pts']), 'points', int(sum(np.hypot(p[0] - q[0], p[1] - q[1]) for p, q in zip(SUPPLY['pts'], SUPPLY['pts'][1:]))), 'tiles')
if '--supply' in sys.argv:
    wf = os.path.join(OUT, 'world.js'); txt = open(wf, encoding='utf8').read(); i = txt.index('window.ADV_WORLD = ') + len('window.ADV_WORLD = ')
    w = json.loads(txt[i:txt.rindex(';')]); w['supply'] = SUPPLY
    open(wf, 'w', encoding='utf8').write(txt[:i] + json.dumps(w, separators=(',', ':')) + ';\n'); print('patched world.js with the supply path'); sys.exit(0)

# T5: Route 9's tidal inlet, a salt channel that runs inland south of the road (the working shore: nets, boats and racks on its banks); Route 10's lake is left as the map has it
INLET = [(98, 812, 4.2), (112, 812, 3.8), (124, 812, 3.6), (140, 811, 3.4), (156, 810.5, 3.1), (172, 810, 2.9), (190, 810.5, 2.7), (206, 811, 2.5), (222, 811.5, 2.3)]
inlet = stroke(INLET) & ~dil(roadc, 3) & ~mount
water |= inlet; inl |= inlet; land = ~water; beachc &= land
log('T5 inlet', int(inlet.sum()))
# T5 Salt Bay v2 (layout: tools/adv-towns/t5-layout.py -> T5.json): a harbour basin with rounded corners cut into the beach, so the quay has a real shore to stand on and the piers a bay to cross
t5x, t5y = TOWN['T5']['tx'], TOWN['T5']['ty']
def rr_box(x0, y0, x1, y1, r):
    """a rounded-corner box of cells (tile corners, inclusive), for basins and yards: no hard rectangles"""
    m = np.zeros((HP, WP), bool); m[y0:y1 + 1, x0:x1 + 1] = rrect_mask(y1 - y0 + 1, x1 - x0 + 1, r); return m
w5 = (np.abs(YY - (t5y - 17)) <= 23) & (XX <= t5x - 6) & ~dil(roadc, 2) & ~mount         # the sea shore beside the town runs in straight runs of 4+ tiles with rounded jogs, not a 1 tile staircase
sq5 = blocky(sea, 4, .5); sea = np.where(w5, sq5, sea); water = np.where(w5, sq5 | inl, water); land = ~water; beachc &= land
basin5 = rr_box(t5x - 26, t5y - 4, t5x - 4, t5y + 9, 4) & ~dil(roadc, 2) & ~mount
water |= basin5; sea |= basin5; land = ~water; beachc &= land
log('T5 harbour basin', int(basin5.sum()))

# T6 Spindlewood: a sheltered cove cut into the shore south-east of the town centre, open to the sea on its east side (the timber wharf and piers across it are laid out in tools/adv-towns/T6.json)
t6x, t6y = TOWN['T6']['tx'], TOWN['T6']['ty']
cove = (((XX - (t6x + 23)) / 11.5) ** 2 + ((YY - (t6y + 15)) / 7.5) ** 2 <= 1) & ~dil(roadc, 3) & ~mount
water |= cove; inl |= cove; land = ~water; beachc &= land
log('T6 cove', int(cove.sum()))

# T8 Duskmoss: Route 103, the black shore. The map draws no road for it, so it is laid here: a 3 wide dirt track from the end of the town's back lane west and south round the coast (the shortest path
# hugging the line 12 tiles inland of the water, above the dark beach), ending where the coast bends away at the western bay. Its dark sand, sea cliffs and props are in the T8 blocks further down.
T8T = TOWN['T8']; t8x, t8y = T8T['tx'], T8T['ty']
def road103_line():
    x0, x1, y0, y1 = 585, 752, 1040, 1140
    okk = (land & (dland >= 3) & ~mount & ~cave & ~dil(roadc, 2))[y0:y1, x0:x1]; dd = dland[y0:y1, x0:x1]
    sy, sx = t8y + 11 - y0, t8x - 25 - x0; ec = 602 - x0
    cand = np.nonzero(okk[:, ec])[0]; ey = int(cand[np.abs(dd[cand, ec] - 12).argmin()])
    best = {(sy, sx): 0.0}; prev = {}; pq = [(0.0, sy, sx)]
    while pq:
        d, y, x = heapq.heappop(pq)
        if (y, x) == (ey, ec): break
        if d > best.get((y, x), 1e18): continue
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                ny, nx = y + dy, x + dx
                if (dy or dx) and 0 <= ny < y1 - y0 and 0 <= nx < x1 - x0 and okk[ny, nx]:
                    nd = d + (1.4 if dy and dx else 1) * (1 + .5 * abs(dd[ny, nx] - 12))
                    if nd < best.get((ny, nx), 1e18): best[(ny, nx)] = nd; prev[(ny, nx)] = (y, x); heapq.heappush(pq, (nd, ny, nx))
    assert (ey, ec) in best, 'no Route 103 path along the coast'
    path = [(ey, ec)]
    while path[-1] != (sy, sx): path.append(prev[path[-1]])
    path.reverse(); pa = np.array(path, float); k = 7; pad = np.r_[np.repeat(pa[:1], k, 0), pa, np.repeat(pa[-1:], k, 0)]      # a moving average over 15 cells irons the staircase out
    sm = np.array([pad[i:i + 2 * k + 1].mean(0) for i in range(len(pa))]); sm[0], sm[-1] = pa[0], pa[-1]
    return [(x + x0 + .5, y + y0 + .5) for y, x in sm[::4].tolist() + [sm[-1].tolist()]]
def poly_mask(pts):
    m = np.zeros((HP, WP), bool)
    for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
        n = int(max(abs(xb - xa), abs(yb - ya))) * 2 + 1
        for j in range(n + 1): m[int(ya + (yb - ya) * j / n), int(xa + (xb - xa) * j / n)] = True
    return m
ROAD103 = road103_line(); road103 = dil(poly_mask(ROAD103), 1) & land & ~mount & ~cave
rz[road103 & ~roadc] = 103; roadc |= road103; band |= road103; LABELS[103] = (int(ROAD103[0][0] * S), int(ROAD103[0][1] * S))
log('T8 Route 103 road', int(road103.sum()), 'tiles from', ROAD103[0][:2], 'to', ROAD103[-1][:2])

# L4 Quiet Plain + Route 1 (docs/TOWNPASS.md): the drawn road is 6 to 7 tiles wide, so Route 1 is re-laid as a 3 wide old paved road (the bible: paved properly once, cracked end to end) that bends on its way south from the Route 2 road
# and stops inside the memorial's disc where the road runs out. The waypoints are hand-set; a moving average irons the corners. The old band is dropped first so nothing else sees it.
L4T = TOWN['L4']; l4x, l4y = L4T['tx'], L4T['ty']
r1_old = (rz == 1) & roadc
_ys, _xs = np.nonzero(r1_old); _k = (ndi.distance_transform_edt(~((rz == 2) & roadc))[_ys, _xs]).argmin(); R1S = (int(_xs[_k]), int(_ys[_k]))
R1WAY = [R1S, (R1S[0], 1000), (522, 1000), (522, 1022), (538, 1022), (538, 1046), (516, 1046), (516, 1064), (496, 1064), (496, 1086), (l4x, 1086), (l4x, l4y - 6)]      # v2: axis-aligned runs of 10 to 24 joined by right angles (the tile corners round them), no diagonal staircase
def smooth_poly(way, k=6):
    pts_ = [way[0]]
    for (xa, ya), (xb, yb) in zip(way, way[1:]):
        n = max(1, int(np.hypot(xb - xa, yb - ya)))
        pts_ += [(xa + (xb - xa) * j / n, ya + (yb - ya) * j / n) for j in range(1, n + 1)]
    pa = np.array(pts_, float); pad = np.r_[np.repeat(pa[:1], k, 0), pa, np.repeat(pa[-1:], k, 0)]
    sm = np.array([pad[i:i + 2 * k + 1].mean(0) for i in range(len(pa))]); sm[0], sm[-1] = pa[0], pa[-1]
    return [(x + .5, y + .5) for x, y in sm.tolist()]
R1PTS = [(x + .5, y + .5) for x, y in R1WAY]
R1LEN = float(sum(np.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(R1PTS, R1PTS[1:])))
road1_new = dil(poly_mask(R1PTS), 1) & land & ~mount & ~cave & ~((rz == 2) & roadc)
band &= ~r1_old; roadc &= ~r1_old; rz[r1_old] = 0
rz[road1_new] = 1; roadc |= road1_new; band |= road1_new
log('L4 Route 1 road', int(road1_new.sum()), 'tiles, length', int(R1LEN), 'from', R1S, 'to', R1WAY[-1])

# plateaus: scattered 1 level blocks on the Eastern Ridge, the massif foothills and Route 7 edges
snowp = cls == C['snow']
near_r7 = dil(rz == 7, 24)
zone_pl = (dil(mount, 50) & ~mount & (noise(8, 2) > .6)) | (dil(snowp, 30) & (noise(8, 3) > .35)) | (near_r7 & (noise(8, 4) > .45))
zone_pl &= land & ~beachc & ~dil(band, 3) & ~dil(disc, 3) & ~dil(water, 3) & ~mount & ~cave & ~dil(cave, 3)
zone_pl = ndi.binary_fill_holes(ndi.binary_opening(zone_pl, disk(2)))
lab, n = ndi.label(zone_pl); sz = ndi.sum(zone_pl, lab, range(1, n + 1)); zone_pl = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s >= 60])
zone_pl = blocky(zone_pl, 3) & land & ~mount & ~cave & ~dil(band, 2) & ~dil(disc, 2)           # v2: straight runs, no sawtooth
Ht = np.maximum(Ht, zone_pl.astype(np.int8))
# towns: flat discs that blend back into the terrain over 12 tiles
for i, t in enumerate(TL, 1):
    r = np.hypot(XX - t['tx'], YY - t['ty']); lv = int(round(float(Ht[r < t['R']].mean())))
    w = np.clip((r - t['R']) / 12, 0, 1); inr = r < t['R'] + 12
    Ht[inr] = np.round((1 - w[inr]) * lv + w[inr] * Ht[inr]).astype(np.int8)
    t['lv'] = lv
Ht[water | ford] = 0
h = Ht.copy()
log('heights done')

# ---------------------------------------------------------------- materials
mat = np.full((HP, WP), GRASS, np.uint8)
mat[cls == C['beach']] = SAND
des = (ndi.distance_transform_edt(~sea) > 70) & (cls == C['beach'])
mat[des | (cls == C['scrub'])] = DUNE
mat[(cls == C['fungal']) | (cls == C['shroom'])] = SWAMP
mat[cls == C['snow']] = SNOW
mat[mount | cave] = ASH
mat[mount & (cls == C['cap'])] = SNOW
mat[(cls == C['cap']) & ~mount & land] = SNOW
# water: deep in the middle, shallow near shore, sand shores where a beach is near
dl = ndi.distance_transform_edt(water)
sandy = dil(beachc | (mat == DUNE), 3)
mat[water] = np.where(sandy[water], np.where(dl[water] <= 3, SWAT, SWATD), np.where(dl[water] <= 3, WAT, WATD)).astype(np.uint8)
mat[riv & water] = np.where(dl[riv & water] <= 2, WAT, WATD).astype(np.uint8)   # the river has a deep middle and wide shallows
mat[ford] = FORD
kind = np.zeros((HP, WP), np.uint8); deck = np.full((HP, WP), -1, np.int8); over = np.zeros((HP, WP), np.uint8)
roadm = roadc.copy()
mat[roadm & land] = PATH
h[roadm] = Ht[roadm]
mat[disc & land & ~roadm] = np.where(mat[disc & land & ~roadm] == GRASS, GRASS, mat[disc & land & ~roadm])
lakew = water & ~sea & ~riv & ~inlet                       # T5: the Western Woods lake gets a sandy shore by the Route 10 campsite
ring9 = dil(inlet, 2) & ~inlet & land & (mat == GRASS) & ~dil(roadm, 1)
ringL = dil(lakew, 2) & ~lakew & land & (mat == GRASS) & ~dil(roadm, 2) & (XX >= 258) & (XX <= 296) & (YY >= 704) & (YY <= 730)
mat[ring9 | ringL] = SAND
# T7 Longshore: a wide beach, a bay that never gets deep (shallow sand-water all the way out), and Route 6's first stretch dusted with sand carried off the resort
T7 = TOWN['T7']; t7x, t7y = T7['tx'], T7['ty']; rt7 = np.hypot(XX - t7x, YY - t7y)
road6 = (rz == 6) & roadc; d6 = ndi.distance_transform_edt(~road6)
beach7 = land & (kind == 0) & (mat == GRASS) & (dland <= 13 + 3 * noise(6, 81)) & (rt7 <= 100)
spill7 = land & (kind == 0) & (mat == GRASS) & (d6 <= 6 + 2 * noise(5, 82)) & (rt7 <= 56 + 6 * noise(7, 83))
mat[beach7 | spill7] = SAND
sw7 = water & (rt7 <= 100 + 6 * noise(8, 84)); mat[sw7] = np.where(dl[sw7] <= 2, SWAT, np.where((rt7 <= 84 + 5 * noise(8, 85))[sw7], WAT, WATD))
log('T7 beach', int(beach7.sum()), 'route 6 sand', int(spill7.sum()), 'shallows', int(sw7.sum()))
# T5 v2: the beach's inland edge is a long soft curve in 3 tile runs instead of a ruler line (grass reaches in towards the harbour, sand runs out along the lanes)
e5 = 6 + 3 * np.sin((YY - t5y) / 9.0) + 1.5 * np.sin((YY - t5y) / 4.3 + 1)
sand5 = blocky((XX - t5x) <= e5, 3, .5)
z5 = (np.abs(XX - t5x) <= 40) & (YY >= t5y - 40) & (YY <= t5y + 11) & land & (kind == 0) & ((mat == SAND) | (mat == GRASS)) & ~dil(roadm, 1)
mat[z5 & sand5] = SAND; mat[z5 & ~sand5] = GRASS
mat[basin5 & (XX >= t5x - 20)] = SWAT                  # the harbour basin is all shallow: no deep rectangle inside it
# G8 Sporehaven: damp, dark ground (swamp) over the whole town and its wood, and Route 2 is the fungal forest the whole way (a corridor of swamp with standing water between the caps, from where the Pinegrove clearing ends to the town)
G8T = TOWN['G8']; g8x, g8y = G8T['tx'], G8T['ty']; dg8 = np.hypot(XX - g8x, YY - g8y); dg6r = np.hypot(XX - TOWN['G6']['tx'], YY - TOWN['G6']['ty'])
road2 = (rz == 2) & roadc; d2 = ndi.distance_transform_edt(~road2)
fung2 = (d2 <= 15 + 3 * noise(5, 94)) & (dg6r > 41) & land & ~mount & ~cave & ~dil(water, 2) & (kind == 0)
fung8 = ((dg8 <= 52) | fung2) & land & (mat == GRASS) & ~dil(roadm, 0) & (kind == 0)
mat[fung8] = SWAMP
pud2 = fung2 & (noise(2.4, 95) > .9) & (d2 > 4) & ~dil(roadm, 2) & (h == 0) & (mat == SWAMP); pud2 = ndi.binary_opening(pud2, disk(1))
mat[pud2] = FORD; ford |= pud2
log('G8 swamp ground', int(fung8.sum()), 'Route 2 corridor', int(fung2.sum()), 'standing water', int(pud2.sum()))

# ---------------------------------------------------------------- bridges
def runs_inl(line, c):
    """water run [a, b] along a 1D bool line containing or nearest to c"""
    if not line[c]:
        idx = np.nonzero(line)[0]
        if not len(idx): return None
        c = int(idx[np.abs(idx - c).argmin()])
    a = c
    while a > 0 and line[a - 1]: a -= 1
    b = c
    while b < len(line) - 1 and line[b + 1]: b += 1
    return a, b
nbr = 0
lab, n = ndi.label(roadm & water, np.ones((3, 3)))
for i, sl in enumerate(ndi.find_objects(lab), 1):
    yy, xx = np.nonzero(lab[sl] == i); cy, cx = int(yy.mean()) + sl[0].start, int(xx.mean()) + sl[1].start
    rh, rv = runs_inl(water[cy], cx), runs_inl(water[:, cx], cy)
    if not rh or not rv: continue
    ew = rh[1] - rh[0] <= rv[1] - rv[0]
    if ew:
        rows = range(cy - 2, cy + 2); ra = [runs_inl(water[y], cx) for y in rows]; ra = [r for r in ra if r]
        a, b = min(r[0] for r in ra), max(r[1] for r in ra)
        if b - a > 140 or (kind[cy, a:b + 1] == 8).any(): continue
        hb = int(h[cy, a - 1]); sl_ = (slice(cy - 2, cy + 2),)
        for y in rows:
            h[y, a - 9:a] = hb; h[y, b + 1:b + 10] = hb
            kind[y, a:b + 1] = 8; deck[y, a:b + 1] = hb + 1; h[y, a:b + 1] = np.where(water[y, a:b + 1], 0, hb)
            kind[y, a - 1] = 3; kind[y, b + 1] = 4
            for xr in (range(a - 9, a), range(b + 1, b + 10)):
                for x in xr:
                    if land[y, x]: mat[y, x] = PATH; roadm[y, x] = True; roadc[y, x] = True
            roadm[y, a:b + 1] = True
        Ht[cy - 2:cy + 2, a - 1:b + 2] = 0
    else:
        cols_ = range(cx - 2, cx + 2); ca = [runs_inl(water[:, x], cy) for x in cols_]; ca = [r for r in ca if r]
        a, b = min(r[0] for r in ca), max(r[1] for r in ca)
        if b - a > 140 or (kind[a:b + 1, cx] == 8).any(): continue
        hb = int(h[a - 1, cx])
        for x in cols_:
            h[a - 9:a, x] = hb; h[b + 1:b + 10, x] = hb
            kind[a:b + 1, x] = 8; deck[a:b + 1, x] = hb + 1; h[a:b + 1, x] = np.where(water[a:b + 1, x], 0, hb)
            kind[a - 1, x] = 2; kind[b + 1, x] = 1
            for yr in (range(a - 9, a), range(b + 1, b + 10)):
                for y in yr:
                    if land[y, x]: mat[y, x] = PATH; roadm[y, x] = True; roadc[y, x] = True
            roadm[a:b + 1, x] = True
    nbr += 1
gone = roadc & water & ~(kind == 8); roadc &= ~gone; roadm &= ~gone     # road clipped by the coast
log('bridges', nbr, 'road tiles dropped over open water', int(gone.sum()))
brk = kind != 0

# ---------------------------------------------------------------- road stairs where adjacent road cells differ by a level
DXY = [(0, -1), (0, 1), (1, 0), (-1, 0)]       # stairs kind k = ascent DXY[k-1]
def sh(a, d, fill=0):
    dx, dy = DXY[d]; o = np.full_like(a, fill)
    ys_, ye = (max(0, -dy), HP - max(0, dy)); xs_, xe = (max(0, -dx), WP - max(0, dx))
    o[ys_:ye, xs_:xe] = a[ys_ + dy:ye + dy, xs_ + dx:xe + dx]
    return o                                         # o[y, x] = a[y + dy, x + dx]
rk = roadc & ~brk
for d in range(4):
    hn = sh(h, d, 9); rn = sh(roadc, d, False); behind_h = sh(h, d ^ 1, 9)
    cand = rk & rn & (kind == 0) & (hn == h + 1) & (behind_h == h) & sh(roadc, d ^ 1, False)
    kind[cand] = d + 1
log('road stairs', int((kind[rk] > 0).sum()))

# ---------------------------------------------------------------- towns: streets, connectors, buildings
HOUSES = {'temperate': ['houseRedGable', 'houseBlueGable', 'cottageGreen', 'cottageRed', 'houseOrangeSmall', 'houseGreenFlat', 'houseBlueTall', 'cottageTeal'],
  'snow': ['chaletRed', 'chaletRedB', 'cabinGreen', 'chaletPink', 'cottageGreenWide', 'cabinGreenWide', 'chaletRed', 'cabinGreen'],
  'desert': ['houseOrangeFlat', 'houseOrangeSmall', 'thatchHouse', 'strawHut', 'houseOrangeSplit', 'thatchHouseSmall', 'houseOrangeTilt', 'moundHut'],
  'coast': ['houseBlueRoof', 'houseBlueSplit', 'houseBlueGable', 'cottageTeal', 'houseBlueDome', 'houseRedRoof', 'cottageRed', 'houseBlueTall'],
  'farm': ['thatchHouse', 'cottageGreen', 'barnOrange', 'cottageRed', 'thatchHouseSmall', 'houseGreenFlat', 'barnRed', 'cottageGreenWide'],
  'fungal': ['moundHut', 'treeHouse', 'cottageTeal', 'houseGreenSplit', 'strawHut', 'houseBlueDome', 'cabinGreen', 'moundHut']}
CENTERS = {'temperate': ('pokeCenterRed', 'martBlue'), 'snow': ('pokeCenterWhite', 'martWhite'), 'desert': ('pokeCenterOrange', 'martWave'), 'coast': ('pokeCenterWave', 'martWave'), 'farm': ('pokeCenterRed', 'martBlue'), 'fungal': ('pokeCenterWhite', 'martBlue')}
GYMS = {'G1': 'gymTeal', 'G2': 'gymTealTall', 'G3': 'gymRed', 'G4': 'gymRed', 'G5': 'gymTealTall', 'G6': 'gymTeal', 'G7': 'thatchBarn', 'G8': 'gymTeal'}
LAND = {'L1': 'stoneTowerGrass', 'L2': 'goldTemple', 'L3': 'castle', 'L4': 'standingStoneMintTall'}
BIOME = {'G1': 'desert', 'G2': 'snow', 'G3': 'temperate', 'G4': 'temperate', 'G5': 'coast', 'G6': 'temperate', 'G7': 'farm', 'G8': 'fungal', 'T1': 'snow', 'T2': 'coast', 'T3': 'temperate', 'T4': 'temperate',
  'T5': 'coast', 'T6': 'temperate', 'T7': 'coast', 'T8': 'fungal', 'L1': 'temperate', 'L2': 'temperate', 'L3': 'snow', 'L4': 'temperate'}
paved = np.zeros((HP, WP), bool); occ = np.zeros((HP, WP), bool); doorc = np.zeros((HP, WP), bool)
props = []                                           # [name, x px, y px]
def pave(y0, y1, x0, x1, t, lim=-1, m=PAVE, r=None):
    """paint a rectangle of material m; v2: a plaza (both sides 8+) gets rounded corners (radius r, default 4) so no surface is a hard rectangle"""
    ok = np.zeros((HP, WP), bool); hh_, ww_ = y1 - y0 + 1, x1 - x0 + 1
    ok[y0:y1 + 1, x0:x1 + 1] = rrect_mask(hh_, ww_, 4 if r is None else r) if (r or (r is None and min(hh_, ww_) >= 8)) else True
    ok &= land & (np.hypot(XX - t['tx'], YY - t['ty']) < (t['R'] - 1 if lim < 0 else lim)) & (kind == 0)
    paved[ok] = True; mat[ok] = m; h[ok] = t['lv']
def board(y0, y1, x0, x1):
    """boardwalk (a walkable woven-plank mat) over land or water: piers and docks"""
    global land
    m = np.zeros((HP, WP), bool); m[y0:y1 + 1, x0:x1 + 1] = True
    water[m] = False; sea[m] = False; land = ~water; mat[m] = BW; h[m] = 0; kind[m] = 0; paved[m] = True
def bline(p, q):
    n = int(max(abs(q[0] - p[0]), abs(q[1] - p[1]))) * 2 + 1
    return [(int(round(p[0] + (q[0] - p[0]) * k / n)), int(round(p[1] + (q[1] - p[1]) * k / n))) for k in range(n + 1)]
def building(t, name, y, cc0, occ_rows=None):
    """try to put building `name` with its door column cc as near cc0 as possible on street top row y; returns door cell or None"""
    d = P(name); hw = int(np.ceil(d['sw'] / 2 / T)) + 1; rows = min(3 if t['kind'] == 'L' else 5, int(np.ceil(d['ay'] / T)))
    dx = d.get('door', [0, -2])[0]
    for off in sorted(range(-(t['R'] - 6), t['R'] - 5), key=lambda o: (abs(o - cc0), o)):
        cc = t['tx'] + off
        y0, y1, x0, x1 = y - rows, y - 1, cc - hw, cc + hw
        if x0 < 1 or y0 < 1 or abs(off) > t['R'] - 5: continue
        if np.hypot(cc - t['tx'], y - t['ty']) > t['R'] - 4 + (4 if t['kind'] == 'L' else 0): continue
        reg = (slice(y0, y1 + 1), slice(x0, x1 + 1))
        if occ[reg].any() or paved[reg].any() or water[reg].any() or (h[reg] != t['lv']).any() or (kind[reg] != 0).any(): continue
        if not paved[y, cc]: continue
        occ[y0 - 1:y1 + 2, x0 - 1:x1 + 2] = True; doorc[y:y + 3, cc - 1:cc + 2] = True
        props.append([name, int(round((cc + .5) * T - dx)), int((y) * T - 1)])
        return (cc, y)
    return None
def building_at(t, name, fx, fy, fp=None):
    """Hand-placed building: (fx, fy) = the walkway tile (tile coords relative to the town centre) just south of its door; marks the footprint and the door apron.
    fp = { w, d, ex } (S2): the interior lives inside a w x d tile footprint whose bottom row holds the door on column ex; it must stand on level, dry, unpaved ground and is kept clear (the sprite covers it)"""
    d = P(name); cc, y = t['tx'] + fx, t['ty'] + fy; dx = d.get('door', [0, -2])[0]
    hw = int(np.ceil(d['sw'] / 2 / T)) + 1; rows = min(5, int(np.ceil(d['ay'] / T)))
    occ[y - rows - 1:y + 1, cc - hw - 1:cc + hw + 2] = True; doorc[y:y + 3, cc - 1:cc + 2] = True
    props.append([name, int(round((cc + .5) * T - dx)), int(y * T - 1)])
    if fp:
        c0, r0, c1 = cc - fp['ex'], y - fp['d'], cc - fp['ex'] + fp['w']; reg = (slice(r0, y), slice(c0, c1))
        assert not (paved[reg].any() or water[reg].any() or (h[reg] != t['lv']).any() or (kind[reg] != 0).any()), f'{name}: footprint {c0},{r0} {fp["w"]}x{fp["d"]} is not level, dry, unpaved ground'
        occ[r0 - 1:y, c0 - 1:c1 + 1] = True
        px, py = props[-1][1], props[-1][2]   # the sprite must cover the footprint and its upright back wall (a tile of wall height)
        if c0 * T < px - d['ax'] - T // 2 or c1 * T > px - d['ax'] + d['sw'] + T // 2 or r0 * T - T < py - d['ay'] - 20: print(f'WARN {name}: the footprint pokes out of the sprite')
    return (cc, y)
def connect(t, m=PAVE):
    """the drawn roads stop at the town icon: run each one from its end to the nearest street tile"""
    cx, cy, R = t['tx'], t['ty'], t['R']
    inside = roadm & ~brk & (np.hypot(XX - cx, YY - cy) < R + 16)
    lb, nb = ndi.label(inside, np.ones((3, 3))); pv = np.argwhere(paved & (np.hypot(XX - cx, YY - cy) < R)); pt = cKDTree(pv)
    for i in range(1, nb + 1):
        c = np.argwhere(lb == i); tip = c[np.hypot(c[:, 0] - cy, c[:, 1] - cx).argmin()]
        if (paved[tip[0], tip[1]]): continue
        d, k = pt.query(tip); q = pv[k]
        for (py_, px_) in bline(tip, q): pave(py_ - 2, py_ + 1, px_ - 2, px_ + 1, t, R + 16, m)
town_out = {}
DECO = []                                            # [code, centre x, centre y, deco list] from the hand layouts
NPC_SRC = open(os.path.join(OUT, 'npcs.js'), encoding='utf8', newline='').read().split('\n'); NPCS = []       # (id, x, y, face, trainer?, line index)
for _i, _l in enumerate(NPC_SRC):
    _m = re.match(r"\s*\{ id: '([^']+)', x: (\d+), y: (\d+),.*?face: (\d)", _l)
    if _m: NPCS.append((_m.group(1), int(_m.group(2)), int(_m.group(3)), int(_m.group(4)), 'trainer:' in _l or (_i + 1 < len(NPC_SRC) and NPC_SRC[_i + 1].lstrip().startswith('trainer:')), _i))
for _id, _x, _y, _f, _tr, _i in NPCS: occ[_y - 1:_y + 2, _x - 1:_x + 2] = True       # nothing is planted on a person (the fixer at the end moves one only if its spot became unusable)
NPC_AT = {n[0]: n[5] for n in NPCS}
def npc_set(id_, x, y):
    li = NPC_AT[id_]; NPC_SRC[li] = re.sub(r'x: \d+, y: \d+,', f'x: {x}, y: {y},', NPC_SRC[li], 1)
    for k, n in enumerate(NPCS):
        if n[0] == id_: NPCS[k] = (n[0], x, y) + n[3:]
ROOM_DOORS = []
BUILDINGS = []; BLD_DOORS = []                       # S2: buildings whose interior lives inside their footprint (world.buildings); BLD_DOORS keeps loose props off their doors like ROOM_DOORS does
def cave_mouth(end, cc, fy):
    """a Route 4 cave mouth: the rock arch stands on the row above the walkway (door-front tile (cc, fy), like a building); world.doors gets the entry to the one cave room (end = which side of the cave you arrive on)"""
    props.append(['maCaveBrown', int((cc + .5) * T), int(fy * T - 1)]); occ[fy - 4:fy + 1, cc - 3:cc + 4] = True; doorc[fy:fy + 3, cc - 1:cc + 2] = True
    ROOM_DOORS.append(dict(room='t4-cave', town='T4', end=end, x=int((cc + .5) * T), y=int(fy * T - 3)))
FARM_PROPS = []                                      # [name, tile x, tile y, anchor dy px] placed after the generic scatter (crops, bales, scarecrows)
for t in TL:
    cx, cy, R, kd = t['tx'], t['ty'], t['R'], t['kind']; code = t['code']
    if os.path.exists(os.path.join(ROOT, 'tools', 'adv-towns', code + '.json')):
        # hand layout (tools/adv-towns/<code>.json, coordinates in tiles relative to the town centre): paving [[x0, y0, x1, y1, 'path'?]], buildings [[name, door-front x, y]], props [[name, x, y]]; "door" = the Pokemon Center front tile
        j = json.load(open(os.path.join(ROOT, 'tools', 'adv-towns', code + '.json')))
        for x0, y0, x1, y1, *m_ in j.get('paving', []): pave(cy + y0, cy + y1, cx + x0, cx + x1, t, j.get('lim', -1), MATN[m_[0]] if m_ else PAVE)   # lim: paving may reach this far from the centre (T4: the market runs out to the cave mouth)
        for x0, y0, x1, y1, r_, *m_ in j.get('plazas', []): pave(cy + y0, cy + y1, cx + x0, cx + x1, t, j.get('lim', -1), MATN[m_[0]] if m_ else PAVE, r_)      # v2: rounded plazas, [x0, y0, x1, y1, corner radius, 'path'?]
        if j.get('deco'): DECO.append((code, cx, cy, j['deco']))                                  # v2: families and prop rows, placed once the composition helpers exist (see `deco` below)
        IN = json.load(open(os.path.join(ROOT, 'tools', 'adv-towns', code + '-in.json'))) if os.path.exists(os.path.join(ROOT, 'tools', 'adv-towns', code + '-in.json')) else {}   # S2: what is inside each building of the town, by id
        for nm, x, y, *rm in j.get('buildings', []):
            fp = rm[1] if len(rm) > 1 else None
            cc_, y_ = building_at(t, nm, x, y, fp)
            if fp:   # S2: no room map and no door warp: walking into the door gap is walking into the building (docs/INTERIORS.md)
                it = IN[rm[0]]; assert it['C'] == 2 * fp['w'] - 2 and it['R'] == 2 * fp['d'] - 1, f'{rm[0]}: the interior is {it["C"]} x {it["R"]} floor tiles, the footprint needs {2 * fp["w"] - 2} x {2 * fp["d"] - 1}'
                BUILDINGS.append(dict(id=rm[0], town=code, n=nm, x=props[-1][1], y=props[-1][2], fx=cc_ - fp['ex'], fy=y_ - fp['d'], w=fp['w'], d=fp['d'],
                                      interior=dict(floor=it['floor'], walls=it['walls'], props=it['props'], npcs=it['npcs'], exits=[[fp['ex'], fp['d'] - 1]])))
                BLD_DOORS.append(dict(x=int((cc_ + .5) * T), y=int(y_ * T - 3)))
            elif rm: ROOM_DOORS.append(dict(room=rm[0], town=code, x=int((cc_ + .5) * T), y=int(y_ * T - 3)))   # S1b: the door line; walking up into it enters the room, the exit lands 30 px below it
        for nm, x, y in j.get('props', []):
            props.append([nm, int((cx + x + .5) * T), int((cy + y + 1) * T - 1)]); sd = P(nm).get('solid')
            if sd: occ[cy + y - 1:cy + y + 1, cx + x - int(sd[2] // T) - 1:cx + x + int(sd[2] // T) + 2] = True
        for x0, y0, x1, y1 in j.get('boards', []): board(cy + y0, cy + y1, cx + x0, cx + x1)
        if 'mouth' in j: cave_mouth('w', cx + j['mouth'][0], cy + j['mouth'][1])    # T4: the Route 4 cave's west mouth (door-front tile, like a building)
        if not j.get('noconnect'): connect(t, PATH)      # noconnect (L4): the re-laid Route 1 reaches the landmark itself, no dirt connector
        town_out[code] = dict(door=(cx + j['door'][0], cy + j['door'][1]) if 'door' in j else (cx, cy)); continue
    nst = max(1, (2 * R - 16) // 16) if kd != 'L' else 1
    tops = [int(round(cy + 16 * (i - (nst - 1) / 2) - 2)) for i in range(nst)] if kd != 'L' else [cy + 4, cy + 9, cy + 13]
    tops.sort(key=lambda y: abs(y - cy))
    for y in tops: pave(y, y + 3, cx - R, cx + R, t)
    pave(cy - R + 2, cy + R - 2, cx - 2, cx + 1, t)
    connect(t)
    # buildings along the street fronts (doors face south onto the street)
    biome = BIOME[code]; hs = list(HOUSES[biome]); pc, mt_ = CENTERS[biome]
    want = []
    if kd == 'L': want = [(LAND[code], 0)]
    else:
        want = [(pc, -4), (mt_, 4)]
        if kd == 'G': want.append((GYMS[code], 0))
        want += [(hs[i % len(hs)], 0) for i in range(5 if kd == 'T' else 8)]
    doors = {}
    for bi, (nm, pref) in enumerate(want):
        for y in (tops[bi % len(tops):] + tops[:bi % len(tops)] if bi >= 2 else tops[:1]):
            r = building(t, nm, y, cx + pref + ((bi * 7) % 13 - 6 if bi > 2 else 0))
            if r: doors[bi] = r; break
        if bi not in doors:
            for y in tops:
                r = building(t, nm, y, cx + pref + 20)
                if r: doors[bi] = r; break
        if bi not in doors: print(f'WARN {code} {t["name"]}: no room for {nm}')
    town_out[code] = dict(door=doors.get(0, (cx, cy + 4)))
    # decor on the verges: lamps and flowers just south of each street, a sign at the middle crossing
    for y in tops:
        for off in range(-R + 6, R - 5, 8):
            x = cx + off; yy_ = y + 4
            if 0 < yy_ < HP and land[yy_, x] and paved[yy_ - 1, x] and not occ[yy_, x] and not paved[yy_, x] and np.hypot(x - cx, yy_ - cy) < R - 4 and (kind[yy_, x] == 0):
                props.append(['lampPost', int((x + .5) * T), int((yy_ + 1) * T - 4)]); occ[yy_, x] = True
        for off in range(-R + 9, R - 8, 6):
            x = cx + off + (off * 7) % 3; yy_ = y + 4
            if land[yy_, x] and paved[yy_ - 1, x] and not occ[yy_, x] and not paved[yy_, x] and np.hypot(x - cx, yy_ - cy) < R - 4:
                props.append([('flowerBedBlue', 'flowerBedPink')[(off // 6) % 2], int((x + .5) * T), int((yy_ + 1) * T - 4)]); occ[yy_, x] = True
    if kd != 'L': props.append(['pokeSign', int((cx + 3 + .5) * T), int((tops[0] - 1 + 1) * T)]) if not occ[tops[0] - 1, cx + 3] and not paved[tops[0] - 1, cx + 3] else None
log('towns', {c: v['door'] for c, v in town_out.items()})
roadm |= paved
# T4: the east mouth of the Route 4 cave stands where the east road ends, on the road's top edge (the west mouth is laid out in tools/adv-towns/T4.json); a lit torch each side, outcrop rocks, a Route 4 sign
if cave.any():
    cyy, cxx = np.nonzero(cave); ry = int(np.median(np.nonzero(cave[:, cxx.max()])[0]))
    ce = np.argwhere(roadc & (np.abs(YY - ry) < 25) & (XX > cxx.max()) & (XX < cxx.max() + 30)); ex_ = int(ce[:, 1].min()); fy_ = int(ce[ce[:, 1] <= ex_ + 4][:, 0].min())
    cave_mouth('e', ex_ + 2, fy_)
    for nm, dx, dy in (('torchPost', -3, 0), ('torchPost', 3, 0), ('bigRockGrey', -5, -1), ('boulderGrey', -6, 1), ('rockBrown', 5, -2), ('bigRockGrey', 7, -1), ('crystalBlue', -4, -3), ('streetSign', 7, 3)):
        props.append([nm, int((ex_ + 2 + dx + .5) * T), int((fy_ + dy + 1) * T - 4)]); occ[fy_ + dy - 1:fy_ + dy + 1, ex_ + 2 + dx - 1:ex_ + 2 + dx + 2] = True
    log('east cave mouth at', (ex_ + 2, fy_))

# ---------------------------------------------------------------- C1 terrain (docs/REGION.md): Goldacre fields, Route 5 farmland, Route 7 ridges, Route 8 water meadows
G7 = TOWN['G7']; g7x, g7y = G7['tx'], G7['ty']
road5, road7, road8 = ((rz == k) & roadc & ~brk for k in (5, 7, 8))
d5, d7, d8 = (ndi.distance_transform_edt(~m_) for m_ in (road5, road7, road8))
dg = np.hypot(XX - g7x, YY - g7y); dr = ndi.distance_transform_edt(~riv)
bare = (d5 < 34) | (d7 < 36) | (dg < 64)                  # open country: no forest here
flat1 = ndi.maximum_filter(h, 3) == ndi.minimum_filter(h, 3)
PLOTS = []; plotocc = np.zeros((HP, WP), bool)
def fields(region, seed, step=(15, 11)):
    """tilled crop plots and hay fields on a jittered grid; PLOTS gets (x, y, w, h, kind) with kind 0 cabbage soil, 1 hay + wheat, 2 empty pasture"""
    rng = np.random.default_rng(seed)
    bad = ~region | ~land | (mat != GRASS) | ~flat1 | (kind > 0) | occ | doorc | dil(roadm, 4) | dil(paved, 3) | dil(riv | ford, 3) | (h > 0)
    S_ = np.pad(np.cumsum(np.cumsum(bad.astype(np.int32), 0), 1), ((1, 0), (1, 0)))
    ys_, xs_ = np.nonzero(region); n = 0
    for gy in range(int(ys_.min()), int(ys_.max()), step[1]):
        for gx in range(int(xs_.min()), int(xs_.max()), step[0]):
            w, hh = int(rng.choice([10, 12, 14])), int(rng.choice([6, 8, 10])); x, y = gx + int(rng.integers(0, 4)), gy + int(rng.integers(0, 3)); kd_ = rng.random()
            ya, yb, xa, xb = y - 1, y + hh + 1, x - 1, x + w + 1
            if ya < 0 or xa < 0 or yb >= HP or xb >= WP or S_[yb, xb] - S_[ya, xb] - S_[yb, xa] + S_[ya, xa] or plotocc[ya - 1:yb + 1, xa - 1:xb + 1].any(): continue
            kd_ = 0 if kd_ < .42 else 1 if kd_ < .84 else 2
            if kd_ < 2: mat[y:y + hh, x:x + w][rrect_mask(hh, w, 3)] = SOIL if kd_ == 0 else HAYF       # v2: rounded plots, not hard rectangles
            plotocc[ya:yb, xa:xb] = True; occ[ya:yb, xa:xb] = True; PLOTS.append((x, y, w, hh, kd_)); n += 1
    return n
keep_core = (np.abs(XX - g7x) <= 18) & (YY - g7y >= -13) & (YY - g7y <= 11)       # the village green
n1 = fields((dg >= 43) & (dg <= 66) & ~keep_core, 41)           # v2: the hand laid village fills the disc (radius 40), the crop plots start outside it
n2 = fields((d5 >= 5.5) & (d5 <= 40) & (d5 < d8) & (dg > 44), 42)
log('crop plots: Goldacre', n1, 'Route 5', n2)
# Route 7: broken, rising ground on both sides of the road (1-2 level ridges with stairs); the turbines go on the ridge tops
rn1, rn2, rn3 = noise(7, 21), noise(6, 22), noise(5, 23)
xr = (XX >= 222) & (XX <= 298)
rl = (d7 >= 11 + 2 * rn1) & (d7 <= 38 + 4 * rn2) & xr & (rn3 > -1.0)
rl &= land & ~dil(water, 3) & ~dil(roadm, 6) & (dg > 47) & (mat == GRASS) & (kind == 0) & ~dil(brk, 3) & ~dil(occ | plotocc, 3)
rl = ndi.binary_opening(rl, disk(2)); lb_, nb_ = ndi.label(rl); sz_ = ndi.sum(rl, lb_, range(1, nb_ + 1)); rdg7 = np.isin(lb_, [i + 1 for i, v in enumerate(sz_) if v >= 90])
rdg7 = blocky(rdg7, 3) & land & ~dil(water, 2) & ~dil(roadm, 5) & (mat == GRASS) & (kind == 0)        # v2: ridges in straight runs
core = blocky(ndi.binary_opening(rdg7 & ero(rdg7, 3) & (d7 >= 15) & (rn2 > -.2), disk(1)), 3) & rdg7
h[rdg7] = 1; h[core] = 2
def stairs_pass(zone, spacing, seed):
    """2 wide stairs at intervals around the foot of every raised block in `zone`"""
    rng = np.random.default_rng(seed); cand = []
    for d in range(4):
        hn = sh(h, d, 9); hb = sh(h, d ^ 1, 9); kn = sh(kind, d, 0)
        k_ = zone & (kind == 0) & land & ~water & (hn == h + 1) & (hb == h) & (kn == 0) & ~roadm & ~dil(kind > 0, 1) & ~dil(brk, 2)
        k2 = k_ & sh(k_, 2 if d < 2 else 1)
        for y, x in np.argwhere(k2): cand.append((rng.random(), int(y), int(x), d))
    cand.sort(); got = []
    for _, y, x, d in cand:
        if any((y - a) ** 2 + (x - b) ** 2 < spacing ** 2 for a, b in got): continue
        ly, lx = (0, 1) if d < 2 else (1, 0)
        if kind[y, x] or kind[y + ly, x + lx]: continue
        kind[y, x] = d + 1; kind[y + ly, x + lx] = d + 1; got.append((y, x))
    return len(got)
log('Route 7 ridges', int(rdg7.sum()), 'tiles, core', int(core.sum()), 'stairs', stairs_pass(dil(rdg7, 1), 14, 51))
# Route 8: swampy water meadows around the river, wadeable puddles, and the ford's dirt track
wn = noise(3, 31)
wet = (dr < 20) & land & (mat == GRASS) & (kind == 0) & ~dil(roadm, 1) & ~plotocc & (h == 0)
wg = ndi.binary_opening(wet & (noise(6, 33) > -.3 + dr * .05), disk(2))          # damp meadow
swm = wet & (wn > .55 + dr * .05) & (dr < 12)                                    # muddy cores near the water
swm = ndi.binary_opening(swm, disk(1))
pud = swm & (noise(2.2, 32) > .9) & (dr > 3) & ~dil(road8, 2); pud = ndi.binary_opening(pud, disk(1))
mat[wg] = WETG; mat[swm] = SWAMP; mat[pud] = FORD; ford |= pud
trk = np.zeros((HP, WP), bool)
WAY = [(281, 829), (281, 841), (264, 841), (264, 849), (249, 849), (249, 836), (252, 836), (252, 815), (254, 815), (254, 807)]      # v2: long straight runs (no 1 tile staircase)
for a, b in zip(WAY, WAY[1:]):
    for px_, py_ in bline(a, b): trk[py_:py_ + 2, px_:px_ + 2] = True
trk &= land & (kind == 0) & (h == 0)
mat[trk & (mat != FORD)] = PATH; roadm |= trk; paved |= trk & False
log('Route 8 swamp', int(swm.sum()), 'puddles', int(pud.sum()), 'track', int(trk.sum()))

# ---------------------------------------------------------------- T8 Duskmoss (docs/TOWNPASS.md): the treeline north-west of the town, and Route 103's black shore with its sea cliffs
dT8 = np.hypot(XX - t8x, YY - t8y); road103 = (rz == 103) & roadc & ~brk
nw8 = (XX - t8x) + (YY - t8y) < -10
fung8t = land & nw8 & (dT8 >= 28) & (dT8 <= 62 + 3 * noise(6, 103)) & (mat == GRASS) & (kind == 0) & ~roadm & ~dil(water, 1) & ~mount
mat[fung8t] = SWAMP                                    # swamp ground under the wood that stops at the cut line; the town itself stays plain
shore8 = land & (kind == 0) & (h == 0) & (dT8 > 31) & (YY >= t8y + 16) & (XX >= 585) & (XX <= t8x - 12) & ~dil(brk, 1)
black = shore8 & (dland <= 9 + 1.5 * noise(5, 104)) & ~roadm & ((mat == GRASS) | (mat == SAND) | (mat == DUNE))
mat[black] = ASH                                       # the dark sand
lg1, lg2 = noise(7, 105), noise(6, 106)
ledge = shore8 & (dland >= 19 + 2 * lg1) & (dland <= 33 + 3 * lg2) & (YY >= t8y + 24) & (lg2 > -.25) & ~dil(roadm, 5) & ~dil(water, 3) & (mat != FORD)
ledge = ndi.binary_opening(ledge, disk(2)); lb_, nb_ = ndi.label(ledge); sz_ = ndi.sum(ledge, lb_, range(1, nb_ + 1)); ledge = blocky(np.isin(lb_, [i + 1 for i, v in enumerate(sz_) if v >= 90]), 3) & shore8 & ~dil(roadm, 3) & ~dil(water, 2)       # v2: straight runs
h[ledge] = 1                                          # the sea cliffs: 1 level ledges landward of the beach, stairs round their feet
log('T8 treeline swamp', int(fung8t.sum()), 'black sand', int(black.sum()), 'cliff ledges', int(ledge.sum()), 'tiles, stairs', stairs_pass(dil(ledge, 1), 15, 53))

# ---------------------------------------------------------------- L4 Quiet Plain (docs/TOWNPASS.md): open grass round the memorial with no trees, and Route 1 as an old paved road with grass forced up through the seams (more of it nearer the memorial)
dL4 = np.hypot(XX - l4x, YY - l4y); road1 = (rz == 1) & roadc & ~brk; d1r = ndi.distance_transform_edt(~road1)
core4 = (dL4 < 46) & land; bare |= core4 | (d1r <= 16)                  # `bare` = open country: no forest scatter; core4 also loses the open-ground trees and bushes below
mat[road1 & land] = PAVE
crack = (np.random.default_rng(201).random((HP, WP)) < .09 + .12 * np.clip(1 - (dL4 - 10) / 130, 0, 1)) & road1 & ~poly_mask(R1PTS) & ~(np.roll(road1, 1, 1) & np.roll(road1, 1, 0)) & (dL4 > 8) & (np.hypot(XX - R1S[0], YY - R1S[1]) > 7)          # small holes: about a sixth of the cells at the Route 2 end, a third by the memorial; the centre line and the junction stay whole
mat[crack] = GRASS
court4 = paved & (dL4 < 19) & (mat == PAVE) & ~road1; crack4 = (noise(1.3, 207) > 1.2) & court4 & (np.hypot(XX - l4x, YY - (l4y + 8)) > 3.5); mat[crack4] = GRASS      # v2: the memorial court is old paving too: grass through its seams
log('L4 Route 1 paving', int((road1 & ~crack).sum()), 'tiles, cracks', int(crack.sum()))

# ---------------------------------------------------------------- tall grass overlay on verges and meadows
rng = np.random.default_rng(7)
verge = dil(roadm, 9) & ~dil(roadm, 1) & land & (mat == GRASS) & ~disc & (kind == 0)
meadow = (cls == C['meadow']) & land & (mat == GRASS) & ~disc
nz = noise(3.5, 5)
for reg, thr in ((verge, .6), (meadow, .55)):
    sel = reg & (nz > thr)
    sel = ndi.binary_closing(ndi.binary_opening(sel, disk(2)), disk(2))              # v2: rounded blobs, no jagged edges
    lb, nb = ndi.label(sel); sz = ndi.sum(sel, lb, range(1, nb + 1)); keep = np.isin(lb, [i + 1 for i, s in enumerate(sz) if 20 <= s <= 200])
    over[keep & ~dil(brk, 1)] = TALL
log('tallgrass', int((over > 0).sum()))

# ---------------------------------------------------------------- walkability flood fill (same rules as ADV.step)
@njit
def flood(h, kind, deck, wat, blk, sx, sy):
    H_, W_ = h.shape
    seen = np.zeros((H_, W_, 2), np.uint8)
    q = np.empty((H_ * W_ * 2, 3), np.int32); qh = 0; qt = 0
    q[0, 0] = sx; q[0, 1] = sy; q[0, 2] = 0; qt = 1; seen[sy, sx, 0] = 1
    dxs = (0, 0, 1, -1); dys = (-1, 1, 0, 0)
    while qh < qt:
        x = q[qh, 0]; y = q[qh, 1]; k = q[qh, 2]; qh += 1
        for d in range(4):
            nx = x + dxs[d]; ny = y + dys[d]
            if nx < 0 or ny < 0 or nx >= W_ or ny >= H_ or blk[ny, nx]: continue
            kb = kind[ny, nx]; hb = h[ny, nx]
            if k == 1: lvl = deck[y, x]
            else:
                ka = kind[y, x]
                if ka >= 1 and ka <= 4:
                    if d == ka - 1: lvl = h[y, x] + 1
                    elif d == ((ka - 1) ^ 1): lvl = h[y, x]
                    elif kb == ka and hb == h[y, x]:
                        if not seen[ny, nx, 0]: seen[ny, nx, 0] = 1; q[qt, 0] = nx; q[qt, 1] = ny; q[qt, 2] = 0; qt += 1
                        continue
                    else: continue
                else: lvl = h[y, x]
            nk = -1
            if kb >= 1 and kb <= 4:
                a_ = kb - 1
                if d == a_: nk = 0 if lvl == hb else -1
                elif d == (a_ ^ 1): nk = 0 if lvl == hb + 1 else -1
            elif kb == 8:
                if lvl == deck[ny, nx]: nk = 1
                elif lvl == hb and not wat[ny, nx]: nk = 0
            elif lvl == hb and not wat[ny, nx]: nk = 0
            if nk >= 0 and not seen[ny, nx, nk]:
                seen[ny, nx, nk] = 1; q[qt, 0] = nx; q[qt, 1] = ny; q[qt, 2] = nk; qt += 1
    return seen

def spawn_cell():
    dc = town_out['G7']['door']; return dc[0], dc[1] + 1
nowalk = cave
sx, sy = spawn_cell()
def reach(blk, surf=False):
    return flood(h.astype(np.int8), kind, deck, np.zeros_like(water) if surf else water, blk, sx, sy)   # surf: water at ground level is open (the Surf skill)

# ---------------------------------------------------------------- pocket fix: stairs into every walkable pocket
for rnd in range(80):
    seen = reach(nowalk)
    R_ = (seen[..., 0] > 0) | (seen[..., 1] > 0)
    Uc = land & ~nowalk & ~R_ & (kind != 8) & ~(seen[..., 1] > 0)
    lb, nb = ndi.label(Uc)
    if nb == 0: break
    sz = ndi.sum(Uc, lb, range(1, nb + 1))
    # tiny pockets: level them to a reachable neighbour
    for i in np.nonzero(sz < 25)[0] + 1:
        m = lb == i; ring = dil(m, 1) & ~m & R_ & (kind == 0)
        if ring.any(): hv = np.bincount(h[ring].astype(int)).argmax(); h[m & (kind == 0)] = hv; Ht[m] = hv
    cand = []
    for d in range(4):
        hr = sh(h, d, 9); rr = sh(R_ & (kind == 0), d, False); behind = sh(h, d ^ 1, 9)
        wk = land & ~nowalk & (kind == 0)
        # case A: unreachable cell is lower, stairs on it ascending toward the reachable cell
        cA = Uc & (kind == 0) & rr & (hr == h + 1) & (behind == h) & sh(wk, d ^ 1, False)
        # case B: unreachable cell is higher: carve it down to the reachable level, stairs ascending away from the reachable cell
        cB = Uc & (kind == 0) & rr & (hr == h - 1) & (behind == h) & sh(wk, d ^ 1, False)
        for case, cm in ((0, cA), (1, cB)):
            for y, x in np.argwhere(cm): cand.append((lb[y, x], hash((int(y) * 7919 + int(x) * 104729 + rnd)) & 0xffff, int(y), int(x), d, case))
    if not cand: break
    cand.sort(); used = set(); done = 0
    for l, _, y, x, d, case in cand:
        if l in used: continue
        used.add(l); done += 1
        px_, py_ = (-DXY[d][1], DXY[d][0])           # lateral step
        for s in (0, 1):
            yy_, xx_ = y + py_ * s, x + px_ * s
            if s and not (Uc[yy_, xx_] or R_[yy_, xx_]): continue
            if kind[yy_, xx_] != 0 or not land[yy_, xx_] or nowalk[yy_, xx_]: continue
            hr_ = h[yy_ + DXY[d][1], xx_ + DXY[d][0]]
            if case == 0 and hr_ == h[yy_, xx_] + 1: kind[yy_, xx_] = d + 1
            elif case == 1 and hr_ == h[yy_, xx_] - 1: h[yy_, xx_] = hr_; kind[yy_, xx_] = (d ^ 1) + 1
    log(f'pocket fix round {rnd}: {nb} pockets, {done} stairs')

# ---------------------------------------------------------------- props
def solid_rect(name):
    d = P(name); return d.get('solid')
def put(name, x, y): props.append([name, int(round(x)), int(round(y))])

# ---------------------------------------------------------------- C1 props A: hedgerows, crops, turbines, willows and dams (mark `occ` first so the generic scatter keeps clear)
c1n = collections.Counter()
def hedges5():
    ring = (d5 > 2.4) & (d5 <= 3.9) & land & (kind == 0) & (h == 0) & (mat != FORD) & ~occ & ~dil(brk, 1) & ~dil((roadc & (rz != 5)) | paved | doorc, 4)
    ring &= (dg > 44) | ~dil(paved, 6)
    ys_, xs_ = np.nonzero(road5); ga = np.full((HP, WP), -1, np.int32)
    lr, nr_ = ndi.label(road5, np.ones((3, 3)))
    for i in range(1, nr_ + 1):                           # arc length along the road from the end nearest Goldacre
        yy_, xx_ = np.nonzero(lr == i); k = int(np.argmin(dg[yy_, xx_])); st = (int(yy_[k]), int(xx_[k])); ga[st] = 0; q = collections.deque([st])
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if road5[y + dy, x + dx] and ga[y + dy, x + dx] < 0: ga[y + dy, x + dx] = ga[y, x] + 1; q.append((y + dy, x + dx))
    _, ii_ = ndi.distance_transform_edt(~road5, return_indices=True)
    arc = ga[ii_[0], ii_[1]]
    lb, nb = ndi.label(ring, np.ones((3, 3)))
    for l in range(1, nb + 1):
        cells = np.argwhere(lb == l)
        if len(cells) < 6: continue
        r_ = np.random.default_rng(100 + l); cs = []; c = int(r_.integers(10, 30))
        while c < 600: cs.append(c); c += int(r_.integers(30, 51))                    # a gap in the hedge every 30 to 50 tiles
        for y, x in cells:
            if '--nogap' not in sys.argv and min(abs(int(arc[y, x]) - c) for c in cs) <= 2: continue
            nm = ('hedgeLong', 'hedgeLongB', 'hedgeLongC')[(x * 7 + y * 13) % 3]
            props.append([nm, int((x + .5) * T), int((y + 1) * T - 4)]); c1n['hedge'] += 1
            for dx in (-1, 0, 1):                     # a hedge between this cell and each ring cell below it (straight, vertical and diagonal runs): the thin solid rects overlap, nothing slips through
                if ring[y + 1, x + dx]: props.append([nm, int((x + .5 + dx / 2) * T), int((y + 1.5) * T - 4)]); c1n['hedge'] += 1
            occ[y - 1:y + 2, x - 1:x + 2] = True
hedges5()
def plot_crops(x, y, w, hh, kd_, bale=True):
    if kd_ == 0:
        for r in range(y + 1, y + hh - 1, 2):
            for c in range(x + 1, x + w - 1): props.append(['leafPlantB', int((c + .5) * T), int((r + .95) * T)]); c1n['cabbage'] += 1
        if (x * 3 + y) % 4 == 0 and bale: props.append(['mScarecrow', int((x + w // 2 + .5) * T), int((y + 1) * T)]); c1n['scarecrow'] += 1
    elif kd_ == 1:
        for r in range(y + 1, y + hh - 1):
            for c in range(x + 1 + (r & 1), x + w - 1, 2): props.append(['dryTuft', int((c + .5) * T), int((r + .95) * T)]); c1n['wheat'] += 1
        if (x + y) % 2 == 0 and bale: props.append(['maHayPile', int((x + w + .5) * T), int((y + hh + .8) * T)]); c1n['haybale'] += 1
for x, y, w, hh, kd_ in PLOTS: plot_crops(x, y, w, hh, kd_)
for x, y, w, hh, kd_ in PLOTS:                      # Goldacre plots and pastures: fence lines along the north and south edges, a gap in the middle of the south one
    if np.hypot(x - g7x, y - g7y) < 90 and (kd_ == 2 or np.hypot(x - g7x, y - g7y) < 78):
        for k in range(0, w, 2):
            props.append(['fenceRail', int((x + k + 1) * T), int(y * T)])
            if abs(k - w // 2) > 2: props.append(['fenceRail', int((x + k + 1) * T), int((y + hh) * T)])
            c1n['fence'] += 2
flat5 = ndi.maximum_filter(h, 5) == ndi.minimum_filter(h, 5)
def turbines(cands, n, spacing, seed):
    rr = np.random.default_rng(seed); got = []; idx = rr.permutation(len(cands))
    for i in idx:
        y, x = cands[i]
        if any((y - b) ** 2 + (x - a) ** 2 < spacing ** 2 for a, b in got): continue
        got.append((x, y))
        if len(got) >= n: break
    log('turbines at', got)
    for x, y in got: props.append(['pxTurbine', int((x + .5) * T), int((y + 1) * T - 6)]); occ[y - 2:y + 2, x - 2:x + 3] = True; c1n['turbine'] += 1
tc = rdg7 & ero(rdg7, 2) & flat5 & ~dil(kind > 0, 3) & (mat == GRASS)
turbines(np.argwhere(tc & ~occ & ~dil(kind > 0, 3)), 14, 10, 61)
tg = land & flat5 & (mat == GRASS) & ~occ & ~plotocc & ~dil(roadm, 9) & (h == 0) & (dg >= 47) & (dg <= 58) & ~dil(riv, 4)
turbines(np.argwhere(tg), 4, 22, 62)                                 # Goldacre makes its own power: a few on the edge of town
# willows along the river and the ponds, dams of fallen logs across the small channels
wc = (dr >= 3.5) & (dr <= 15) & land & ((mat == GRASS) | (mat == SWAMP) | (mat == WETG)) & flat1 & ~occ & ~dil(roadm, 3) & ~dil(ford, 1) & (h == 0) & ~plotocc
rw = np.random.default_rng(63); wl = []
for y, x in np.argwhere(wc)[np.random.default_rng(64).permutation(int(wc.sum()))]:
    if rw.random() > .06 or any((y - b) ** 2 + (x - a) ** 2 < 36 for a, b in wl): continue
    wl.append((x, y)); props.append(['bigOakVines', int((x + .5) * T), int((y + 1) * T - 2)]); occ[y - 1:y + 2, x - 1:x + 2] = True; c1n['willow'] += 1
for x, y in ((243, 840), (240, 853), (297, 816)):
    for dx, dy, nm in ((-17, -4, 'fallenLog'), (17, -4, 'fallenLog'), (0, 8, 'logShort'), (-15, 12, 'logShort'), (16, 14, 'fallenLog')):
        props.append([nm, int((x + .5) * T + dx), int((y + .5) * T + dy)]); c1n['dam'] += 1
log('C1 props A', dict(c1n))

# ---------------------------------------------------------------- T5 props: Route 9's working shore (racks, nets, boats and pots along the inlet bank), the Route 10 lake campsite with its register and dock, route signs
t5n = collections.Counter(); d_in = ndi.distance_transform_edt(~inlet)
def t5put(nm, x, y, r=2):
    assert land[y, x] and not roadm[y, x], f'T5 prop {nm} at {x},{y} is not on free land'
    props.append([nm, int((x + .5) * T), int((y + 1) * T - 4)]); occ[y - 1:y + 2, x - r:x + r + 1] = True; t5n[nm] += 1
cand9 = land & (kind == 0) & (h == 0) & (mat != FORD) & ~occ & ~dil(roadm, 2) & ~dil(paved, 1) & (d_in >= 1.6) & (d_in <= 5.2) & (XX >= 166) & (XX <= 232)
SHORE9 = [None, 'maRowboat', None, None, 'maRowboat', None, None, None]      # only the boats are real art; the racks, nets and pots are missing art (docs/TILE-QA.md)
for k, x in enumerate(range(172, 232, 7)):
    nm = SHORE9[k % len(SHORE9)]
    if nm is None: continue
    tgt = 2.2
    c = np.argwhere(cand9 & (np.abs(XX - x) <= 2))
    if not len(c): continue
    y0, x0 = c[np.abs(d_in[c[:, 0], c[:, 1]] - tgt).argmin()]
    t5put(nm, int(x0), int(y0), 2); cand9 &= ~occ
board(717, 718, 266, 277)                             # the campsite dock into the lake
for nm, x, y in (('tentPair', 264, 711), ('tentPair', 267, 721), ('tentPair', 262, 724), ('twigs', 265, 715), ('benchTeal', 263, 717), ('benchTeal', 267, 714), ('noticeBoard', 262, 715), ('barrelOrange', 268, 724), ('crateBox', 264, 722), ('lampPost', 263, 719)):
    t5put(nm, x, y, 1)
for nm, x, y in (('streetSign', 249, 791), ('streetSign', 237, 792)): t5put(nm, x, y, 1)
log('T5 props', dict(t5n))

# ---------------------------------------------------------------- T7 props: Route 6 is already the holiday (stalls, hire kiosks, deckchairs on the verge, thinning out with distance from the town); the beach and the town are hand laid in tools/adv-towns/T7.json
t7n = collections.Counter(); hr = lambda *a: (zlib.crc32(repr(a).encode()) & 0xffff) / 65536      # a pure hash, so nothing depends on how many props came before
SPILL = ['marketAwning', 'maLounger', 'maUmbrellaPink', 'maLounger', 'maLounger', 'maUmbrellaBlue', 'benchTeal', 'lampPost', 'maLounger', 'marketAwning', 'maUmbrellaPink', 'maLounger', 'pxStallBlue']
r6 = road6 & ~brk
for side in (0, 1):
    for x in range(t7x + 29, t7x + 110, 2):
        if hr('t7s', x, side) > 1.2 * (1 - (x - t7x - 29) / 81): continue
        col = np.nonzero(r6[:, x])[0]
        if not len(col): continue
        y = int(col.min() - 2 if side == 0 else col.max() + 2); nm = SPILL[int(hr('t7n', x, side) * len(SPILL))]
        if not (land[y, x] and kind[y, x] == 0 and not roadm[y, x] and h[y, x] == 0) or occ[y - 1:y + 2, x - 1:x + 2].any(): continue
        props.append([nm, int((x + .5) * T), int((y + 1) * T - 4)]); occ[y - 2:y + 2, x - 3:x + 4] = True; t7n[nm] += 1
log('T7 Route 6 spill', dict(t7n))

# ---------------------------------------------------------------- G6 Pinegrove props: Route 3 is the working forest (numbered stands: felled, replanted or left standing, timber stacked at intervals), Route 111 is the timber haul (landings with stacks, trucks and a loader), the town sits in a clearing the forest closes round
# All placements are pure hashes of position and the clearings only touch `forest` and `bare` near these roads, so the rest of the island is untouched.
hq = lambda *a: int.from_bytes(hashlib.md5(repr(a).encode()).digest()[:4], 'little') / 4294967296      # a hash with real avalanche (crc32 of near-equal keys is linearly related, hr() above is only fine for single uses)
g6n = collections.Counter(); G6T = TOWN['G6']; g6x, g6y = G6T['tx'], G6T['ty']
road3 = (rz == 3) & roadc & ~brk; road111 = (rz == 111) & roadc & ~brk
d3, d111 = (ndi.distance_transform_edt(~m_) for m_ in (road3, road111)); dg6 = np.hypot(XX - g6x, YY - g6y)
g6clear = np.zeros((HP, WP), bool)
def arc_from(road, ref):
    """arc length along the road from the end of each road piece nearest `ref` (tile x, y), copied to every cell by its nearest road tile"""
    ga = np.full((HP, WP), -1, np.int32); lr, nr_ = ndi.label(road, np.ones((3, 3)))
    for i in range(1, nr_ + 1):
        yy_, xx_ = np.nonzero(lr == i); k = int(np.argmin(np.hypot(xx_ - ref[0], yy_ - ref[1]))); st = (int(yy_[k]), int(xx_[k])); ga[st] = 0; q = collections.deque([st])
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if road[y + dy, x + dx] and ga[y + dy, x + dx] < 0: ga[y + dy, x + dx] = ga[y, x] + 1; q.append((y + dy, x + dx))
    _, ii_ = ndi.distance_transform_edt(~road, return_indices=True)
    return ga[ii_[0], ii_[1]]
arc3, arc111 = arc_from(road3, (g6x, g6y)), arc_from(road111, (g6x, g6y))
if os.environ.get('G6DUMP'):
    json.dump({n: [[int(x), int(y), int(a[y, x])] for y, x in np.argwhere(m_)] for n, m_, a in (('r3', road3, arc3), ('r111', road111, arc111))}, open(os.environ['G6DUMP'], 'w'))
okt = land & (kind == 0) & (h == 0) & ((mat == GRASS) | (mat == WETG)) & ~occ & ~doorc & ~dil(roadm, 1) & ~dil(brk, 2) & ~water
okc = okt & (dg6 > 41)
def g6put(nm, x, y, r=1, ok=None):
    if not (okc if ok is None else ok)[y, x] or occ[y - 1:y + 2, x - r:x + r + 1].any(): return False
    props.append([nm, int((x + .5) * T), int((y + 1) * T - 4)]); occ[y - 1:y + 2, x - r:x + r + 1] = True; g6n[nm] += 1; return True
def g6ring(arc, d, a, lo, hi):
    """free cells at arc length a (+-1) and road distance lo..hi, both sides of the road"""
    c = np.argwhere((np.abs(arc - a) <= 1) & (d >= lo) & (d <= hi) & okc & ~occ)
    return [(int(x), int(y)) for y, x in c]
# Route 3: stands of 9 to 16 tiles, hashed felled (0) / replanted (1) / standing (2); the first one out of town is replanted
STAND = [1, 0, 2, 1, 2, 0, 1, 2, 2, 0, 1, 0, 2, 1, 0, 2]
bnd = [0]
while bnd[-1] < 700: bnd.append(bnd[-1] + 9 + int(hq('g6b', len(bnd)) * 8))
nz6 = noise(4, 93)
reg3 = (arc3 >= 0) & (d3 >= 4.5) & (d3 <= 21 + 3 * nz6) & (dg6 > 41) & land & (cls != C['rock'])
st3 = np.where(reg3, np.array(STAND)[(np.searchsorted(bnd, arc3.clip(0, None), side='right') - 1) % len(STAND)], 2)
g6clear |= reg3 & (st3 < 2)
SAP = ['pineSapling', 'pineSapling', 'saplingTree', 'miniTree', 'poplarSmall', 'poplarMed', 'pineSaplingTeal']; STUMP = ['stumpSmall', 'stumpSmall', 'stumpLarge', 'stumpSmall', 'stumpLarge', 'fallenLog', 'logShort']
for y, x in np.argwhere(reg3 & (st3 < 2) & okc):
    k = hq('g6s', int(x), int(y))
    if st3[y, x] == 0:
        if k < .07: g6put(STUMP[int(hq('g6n', int(x), int(y)) * len(STUMP))], int(x), int(y), 1)
    elif k < .1: g6put(SAP[int(hq('g6n', int(x), int(y)) * len(SAP))], int(x), int(y), 0)
for i, b in enumerate(bnd):                                   # a stack of timber at the middle of every other stand (the numbered stand markers were script art: missing art)
    if b < 8: continue
    if i % 2 == 0 and i + 1 < len(bnd):
        c = g6ring(arc3, d3, (b + bnd[i + 1]) // 2, 5.5, 8)
        if c: p = c[int(hq('g6t', i) * len(c))]; g6put(('logShort', 'fallenLog', 'fallenLog', 'fallenLog')[(i // 2) % 4], p[0], p[1], 2)
# Route 111: a landing every 22 to 32 tiles, on alternating sides: cleared pad, stacks, a parked log truck, now and then the loader
la = 8
for i in range(40):
    la += 15 + int(hq('g6l', i) * 9)         # v2: the road is now a 3 wide band of straight runs (shorter by its old wiggles), so the landings come a little closer
    c = g6ring(arc111, d111, la, 6, 7.5)
    if not c: continue
    c.sort(key=lambda p: hq('g6c', i, p[0], p[1])); x0, y0 = c[0]; sgn = -1 if i % 2 else 1
    pad = (np.abs(XX - x0) <= 8) & (np.abs(YY - y0) <= 6) & (d111 >= 3.5) & land & (dg6 > 41); g6clear |= pad
    g6put('vanGrey' if i % 2 == 0 else 'fallenLog', x0, y0, 3)
    for dx, dy, nm in ((-6, 0, 'logShort'), (5, 1, 'fallenLog'), (-3, 3, 'fallenLog'), (3, -3, 'barrelOrange'), (7, -2, 'crateWide'), (0, -4, 'bulldozer' if i % 3 == 1 else 'logShort')): g6put(nm, x0 + dx, y0 + dy, 2)
# the clearing around the town: felled ground and stumps east and south, seedlings west, the forest standing in a ring where the disc ends
dg6c = (dg6 <= 40) & okt & ~dil(paved, 1) & (dg6 > 7)
for y, x in np.argwhere(dg6c & ~occ):
    k = hq('g6t', int(x), int(y)); east = x > g6x + 12 or y > g6y + 22; r_ = dg6[y, x]
    if r_ >= 34 and k < .55: g6put(('pineTree', 'pineTreeDark', 'spruceTree', 'bushyOak', 'pineTree')[int(hq('g6r', int(x), int(y)) * 5)], int(x), int(y), 1, okt)
    elif r_ < 34 and east and k < .018: g6put(STUMP[int(hq('g6n', int(x), int(y)) * len(STUMP))], int(x), int(y), 1, okt)
    elif r_ < 34 and not east and k < .012: g6put(SAP[int(hq('g6n', int(x), int(y)) * len(SAP))], int(x), int(y), 0, okt)
log('G6 regions: route 3 stands', int(reg3.sum()), 'cells, felled', int((st3 == 0).sum()), 'replanted', int((st3 == 1).sum()), 'route 3 road', int(road3.sum()), 'route 111 road', int(road111.sum()))
log('G6 props', dict(g6n))
flat =(ndi.maximum_filter(h, 3) == ndi.minimum_filter(h, 3)) & ~dil(kind > 0, 2) & ~dil(brk, 2)
free = land & flat & (mat != FORD) & ~dil(roadm, 1) & ~occ & ~doorc & ~dil(doorc, 1) & ~nowalk & ~dil(cave, 1)
free_town = free & (tid > 0); free &= tid == 0
# north / ridge side uses layered spruces, the rest green pines and oaks
ridge = dil(mount, 70) | (XX > 640) & (YY < 560)
forest = ndi.binary_closing(cls == C['forest'], disk(4)) & land & ~bare & ~(dr < 18)
forest &= ~g6clear & ~(fung2 | (dg8 <= 62)); bare = bare | g6clear                   # G6: felled and replanted stands, the landings on Route 111 (no forest, no scatter)
clear = noise(3, 6) > 1.45
def scatter(mask, prob, names, weights=None, step=2, jit=True, ydy=.9):
    """random props over `mask`. Every chunk has its own RNG seeded by (this call's names/prob/step, chunk x, chunk y), so a change to the mask in one place never moves props in any other chunk"""
    sid = zlib.crc32(repr((names, prob, weights, step, ydy)).encode())
    for cy in range(CHN):
        for cx in range(CW):
            sl = (slice(cy * CH, cy * CH + CH), slice(cx * CH, cx * CH + CH))
            if not mask[sl].any(): continue
            rg = np.random.default_rng((11, sid, cx, cy)); m = mask[sl][::step, ::step]; r = rg.random(m.shape); ok = m & (r < prob)
            for y, x in zip(*np.nonzero(ok)):
                cx_ = cx * CH + x * step + (rg.random() * step if jit else 0); cy_ = cy * CH + y * step + (rg.random() * step if jit else 0)
                c, r_ = int(cx_), int(cy_)
                if r_ >= HP or c >= WP or not mask[r_, c]: continue
                nm = names[rg.choice(len(names), p=weights)] if weights else names[rg.integers(len(names))]
                if callable(nm): nm = nm(c, r_)
                put(nm, (cx_) * T, (cy_ + ydy) * T)
lush = ['pineTree', 'pineTree', 'bushyOak', 'roundOak', 'canopyTree', 'pineTreeDark', 'bigRoundTree']
cold = ['spruceTree', 'layerTree', 'spruceTreeDark', 'layerTreeDark', 'pineTreeDark']

# ---------------------------------------------------------------- v2 composition (docs/MAPDESIGN.md "Look and feel v2"): families of props placed with intent instead of single props sprinkled evenly
# clusters(): drops whole families (a grove with undergrowth, a rock outcrop with flowers, a flower drift, a reed clump) at random centres. One RNG per chunk and call, like scatter, so a local change never moves props elsewhere.
KOCC = np.zeros((HP, WP), bool)                          # cells taken by cluster members (cluster against cluster; solids against everything else are pruned later)
def _ring(rg, lo, hi, sx=1.25, sy=.8):
    a = rg.random() * 6.2832; r = lo + (hi - lo) * rg.random(); return np.cos(a) * r * sx, np.sin(a) * r * sy
def fam_grove(trees, under=('bush', 'roundBush', 'fern', 'poplarBush'), flow=('flowersBlue', 'flowersWhite', 'flowersOrange'), n=(3, 6), alt=None):
    def f(rg):
        k = int(rg.integers(n[0], n[1] + 1)); pts = []
        for _ in range(k * 8):
            if len(pts) >= k: break
            p = _ring(rg, 0, 2.3, 1.35, .8)
            if all(np.hypot(p[0] - q[0], p[1] - q[1]) >= 1.8 for q in pts): pts.append(p)
        pts.sort(key=lambda p: p[1]); first = trees[int(rg.integers(len(trees)))]
        out = [((alt if alt and rg.random() < .22 else first) if i else first, p[0], p[1], 1, .95) for i, p in enumerate(pts)]
        for _ in range(int(rg.integers(2, 5))): p = _ring(rg, 2.4, 3.6); out.append((under[int(rg.integers(len(under)))], p[0], p[1], 0, .85))
        for _ in range(int(rg.integers(1, 4))): p = _ring(rg, 2.8, 4.0, 1.3, .9); out.append((flow[int(rg.integers(len(flow)))], p[0], p[1], 0, .8))
        if rg.random() < .25: p = _ring(rg, 2.4, 3.4); out.append(('fallenLog', p[0], p[1], 1, .8))
        return out
    return f
def fam_outcrop(big=('bigRockGrey', 'boulderGrey', 'rockGreyPair'), small=('rockGrey', 'rockGreyB', 'stoneGrey', 'stonesPair'), flow=('flowersWhite', 'flowersBlue', 'grassBlades', 'dryTuft'), mid=None):
    def f(rg):
        out = [(big[int(rg.integers(len(big)))], 0, 0, 1, .95)]
        for _ in range(int(rg.integers(2, 5))): p = _ring(rg, 1.4, 2.6, 1.2, .8); out.append((small[int(rg.integers(len(small)))], p[0], p[1], 0, .9))
        for _ in range(int(rg.integers(2, 5))): p = _ring(rg, 2.2, 3.6, 1.3, .8); out.append((flow[int(rg.integers(len(flow)))], p[0], p[1], 0, .8))
        if mid and rg.random() < .6: p = _ring(rg, 1.6, 3.0); out.append((mid[int(rg.integers(len(mid)))], p[0], p[1], 0, .85))
        return out
    return f
def fam_drift(flow, n=(7, 13), rx=3.2, ry=1.7):
    def f(rg):
        k = int(rg.integers(n[0], n[1] + 1)); a, b = flow[int(rg.integers(len(flow)))], flow[int(rg.integers(len(flow)))]
        out = []
        for i in range(k): p = _ring(rg, 0, 1, rx, ry); out.append((a if i % 3 else b, p[0], p[1], 0, .8))
        return out
    return f
def fam_bushes(names=('bush', 'roundBush', 'poplarBush', 'bush'), extra=('fern', 'flowersWhite', 'leafPlant')):
    def f(rg):
        out = []
        for _ in range(int(rg.integers(3, 6))): p = _ring(rg, 0, 1.5, 1.2, .8); out.append((names[int(rg.integers(len(names)))], p[0], p[1], 0, .85))
        for _ in range(int(rg.integers(1, 4))): p = _ring(rg, 1.2, 2.4); out.append((extra[int(rg.integers(len(extra)))], p[0], p[1], 0, .8))
        return out
    return f
def fam_reeds(names=('reeds', 'reedsPair', 'reedsOlive'), n=(3, 6)):
    def f(rg):
        return [(names[int(rg.integers(len(names)))], *_ring(rg, 0, 1.3, 1.1, .6), 0, .8) for _ in range(int(rg.integers(n[0], n[1] + 1)))]
    return f
def clusters(mask, per1000, fams, tag, weights=None):
    """per1000 = family centres per 1000 mask tiles; a member stands only where `mask` is true and no earlier cluster member took the cell"""
    sid = zlib.crc32(repr((tag, per1000)).encode()); made = 0
    for cy in range(CHN):
        for cx in range(CW):
            sl = (slice(cy * CH, cy * CH + CH), slice(cx * CH, cx * CH + CH)); ys_, xs_ = np.nonzero(mask[sl])
            if not len(ys_): continue
            rg = np.random.default_rng((12, sid, cx, cy)); k = int(rg.poisson(len(ys_) * per1000 / 1000))
            for _ in range(k):
                i = int(rg.integers(len(ys_))); x0, y0 = cx * CH + int(xs_[i]), cy * CH + int(ys_[i])
                f = fams[int(rg.choice(len(fams), p=weights)) if weights else int(rg.integers(len(fams)))]
                mem = [m_ for m_ in f(rg) if (lambda x, y, r: 0 <= y < HP and 0 <= x < WP and mask[y, x] and not KOCC[y, max(0, x - r):x + r + 1].any())(int(np.floor(x0 + m_[1])), int(np.floor(y0 + m_[2])), m_[3])]
                if len(mem) < 2: continue
                for nm, dx, dy, r, ydy in mem:
                    x, y = int(np.floor(x0 + dx)), int(np.floor(y0 + dy)); KOCC[y, max(0, x - r):x + r + 1] = True
                    put(nm, (x0 + dx + .5) * T, (y0 + dy + ydy) * T)
                made += 1
    return made
G_OAK = fam_grove(['bushyOak', 'roundOak'], alt='roundTree'); G_PINE = fam_grove(['pineTree', 'pineTreeDark'], alt='spruceTree', under=('bush', 'fern', 'poplarBush', 'fern'))
G_ROUND = fam_grove(['roundTree', 'roundTreeTall', 'bigRoundTree'], alt='canopyTree'); G_CANOPY = fam_grove(['canopyTree', 'canopyTree', 'roundOak'], n=(2, 4))
G_COLD = fam_grove(['spruceTree', 'layerTree', 'spruceTreeDark', 'layerTreeDark'], alt='pineTreeDark', under=('bushDark', 'fern', 'bushDark', 'rockGrey'), flow=('grassBlades', 'dryTuft', 'flowersWhite'))
OUTCROP = fam_outcrop(mid=('bush', 'roundBush')); OUTCROP_B = fam_outcrop(big=('rockBrown', 'boulderBrown', 'bigRockGrey'), small=('rockBrownB', 'rockBrownC', 'rockBrown', 'stoneGrey'), flow=('dryTuft', 'flowersOrange', 'grassBlades'))
DRIFT_A = fam_drift(['flowersBlue', 'flowersWhite', 'flowersOrange']); DRIFT_B = fam_drift(['flowersPinkTall', 'flowersBlueTall', 'flowersWhite', 'sunflower'], n=(5, 9), rx=2.6, ry=1.5); DRIFT_C = fam_drift(['flowersOrange', 'sunflower', 'flowersWhite'], n=(6, 11))
BUSHES = fam_bushes()
# route framing: every route is a corridor walled in by dense trees (4 tiles thick, 9 to 13 tiles off the road, with gaps), cliffs and water; points of interest sit in side pockets through those gaps (docs/MAPDESIGN.md: a point of interest about every 15 s of running)
dRd = ndi.distance_transform_edt(~(roadc & ~brk & (rz > 0))); n301, n302, n303 = noise(5, 301), noise(5, 302), noise(9, 303)
wall = free & ~bare & (mat == GRASS) & (cls != C['meadow']) & (dRd >= 9 + 1.6 * n301) & (dRd <= 13.5 + 1.6 * n302) & ~(n303 > 1.15) & ~core4 & ~(d1r <= 24)   # n303: the gaps
inner = free & ~bare & (mat == GRASS) & (dRd >= 6.5) & (dRd < 9 + 1.6 * n301) & ~core4 & ~(d1r <= 24)
# points of interest: one site every 60 to 80 tiles along each route (alternate sides), a cleared pocket joined to the road by a 4 wide opening, with a set piece in it
arc_rt = {}; POI = []; poi_open = np.zeros((HP, WP), bool); poi_fix = []
def poi_sites():
    for r in LABELS:
        rm = (rz == r) & roadc & ~brk
        if rm.sum() < 60 or r in (4,): continue
        st_ = np.argwhere(rm); t_ = TOWN['G7'] if r in (5, 7, 8) else None
        ref = (g7x, g7y) if t_ else (st_[:, 1].mean(), st_[:, 0].mean())
        arc = arc_from(rm, ref); mx = int(arc.max()); a = 18 + int(hq('poi0', r) * 14); i = 0
        while a < mx - 12:
            ring = (np.abs(arc - a) <= 2) & (dRd >= 8.5) & (dRd <= 11.5) & free & ~bare & (mat == GRASS) & flat
            if r in (5, 7, 8): ring = (np.abs(arc - a) <= 2) & (dRd >= 8.5) & (dRd <= 11.5) & free & (mat == GRASS) & flat & (dg >= 50)
            c = np.argwhere(ring)
            if len(c):
                c = c[np.lexsort((c[:, 1], c[:, 0]))]; side = i % 2
                k = [j for j in range(len(c)) if True]; j = int(hq('poi1', r, i) * len(c)); y0, x0 = map(int, c[j])
                POI.append((r, i, x0, y0)); i += 1
            a += 34 + int(hq('poi2', r, a) * 16)
POIKINDS = ['pond', 'shrine', 'picnic', 'rockgarden', 'camp', 'meadow']
FARMKINDS = ['orchard', 'pond', 'haystack', 'meadow', 'windmill', 'picnic']
def poi_piece(kind, rg):
    """(name, dx, dy tiles from the site centre, ydy) lists for a point of interest; every one is made from real tileset props"""
    P_ = lambda l: l[int(rg.integers(len(l)))]; out = []
    fl = lambda n, lo, hi: [(P_(['flowersBlue', 'flowersWhite', 'flowersOrange', 'flowersPinkTall']), *_ring(rg, lo, hi, 1.3, .9), .8) for _ in range(n)]
    if kind == 'pond':
        out += [('reedsPair', -3.5, -1.5, .8), ('reeds', 3.6, -1.2, .8), ('reedsOlive', -2.2, 2.2, .8), ('reeds', 2.6, 2.3, .8), ('fallenLog', -4.5, 1.2, .8), ('rockGrey', 4.4, 1.0, .9), ('rockGreyB', -4.2, -2.2, .9), ('stoneGrey', 0.6, 3.6, .9), ('benchTeal', 0.2, -4.2, .9), ('roundOak', -6.2, -2.2, .95), ('bushyOak', 6.4, -2.6, .95)] + fl(5, 4.5, 6)
    elif kind == 'shrine':
        out += [('stoneRing', 0, 1.5, .95), ('standingStoneMint', -3.3, 0, .95), ('standingStoneMintTall', 3.3, 0, .95), ('standingStoneMint', -2.4, 3.2, .95), ('standingStoneMintTall', 2.4, 3.2, .95), ('benchTeal', 0, 5.2, .9), ('flowersWhite', -4.5, 2, .8), ('flowersWhite', 4.5, 2, .8), ('roundTree', -6, -1, .95), ('roundTree', 6, -1, .95)] + fl(4, 4, 5.5)
    elif kind == 'picnic':
        out += [('benchTeal', -1.6, 1, .9), ('benchTeal', 1.6, 1, .9), ('barrelOrange', 0, -.6, .9), ('bushyOak', -4.5, -2, .95), ('roundOak', 4.5, -2.5, .95), ('bushyOak', -5.2, 2.6, .95), ('roundTree', 5.0, 2.8, .95), ('flowerBedBlue', -3, 3.6, .9), ('flowerBedPink', 3, 3.6, .9)] + fl(4, 3.5, 5)
    elif kind == 'rockgarden':
        out += [('jRocks', 0, 0.5, .95), ('boulderGrey', -4, 1, .95), ('bigRockGrey', 4, 0.5, .95), ('rockGreyB', -2.4, 3.4, .9), ('stonesPair', 2.4, 3.2, .9), ('maBoulderGrey', 0, -3.8, .95), ('bush', -5, -1, .85), ('bush', 5.2, -1.4, .85)] + fl(6, 3, 5.5)
    elif kind == 'camp':
        out += [('tentPair', -2.4, 0, .9), ('twigs', 0.4, 1.6, .9), ('fallenLog', 2.6, 1.2, .8), ('logShort', -1, 3.2, .8), ('crateBox', 3, -1.4, .9), ('pineTree', -5.5, -2, .95), ('pineTreeDark', 5.6, -2.6, .95), ('spruceTree', -5.6, 2.8, .95), ('bush', 4.8, 3, .85), ('barrelDark', 1.6, -1.8, .9)]
    elif kind == 'meadow':
        out += [('flowerBedBlue', -3, -1.2, .9), ('flowerBedPink', 3, -1.0, .9), ('sunflowerPatch', 0, 2.6, .9), ('benchYellow', 0.2, -3.6, .9), ('mFlowersBlue', -4.8, 2.4, .9), ('mFlowersPink', 4.8, 2.6, .9), ('bushyOak', -7, 0, .95), ('roundOak', 7, 0, .95)] + fl(8, 3.5, 6.5)
    elif kind == 'orchard':
        out += [(P_(['roundTree', 'bigRoundTree', 'roundTreeTall']), dx, dy, .95) for dx in (-6, -2, 2, 6) for dy in (-3.5, 0.5, 4.5)] + [('flowersWhite', -4, 2.4, .8), ('flowersOrange', 4, 2.5, .8), ('crateBox', -.5, 6.8, .9), ('benchYellow', 4, -6, .9), ('mScarecrow', 0, 2.8, .95)]
    elif kind == 'haystack':
        out += [('maHayBales', -3.4, 0, .95), ('maHayPile', 2.6, 1.8, .95), ('maHayPile', 4.8, -.5, .95), ('crateWide', -.2, 3.5, .9), ('mScarecrow', 0, -3.2, .95), ('barrelOrange', -5.4, 2.4, .9), ('dryTuft', 1, 5, .8), ('dryTuft', -2, 5, .8)] + [('fenceRail', -4 + 2 * k, 6.2, .0) for k in range(5)]
    elif kind == 'windmill':
        out += [('maWindmill', 0, 3, .95), ('maHayPile', -6, 3.4, .95), ('crateWide', 5.6, 3.8, .9), ('barrelOrange', 6.8, 3.5, .9), ('flowerBedBlue', -3, 5.6, .9), ('flowerBedPink', 3.6, 5.6, .9), ('roundOak', -9, 0, .95), ('roundOak', 9, 0, .95)]
    return out
poi_sites()
log('points of interest', len(POI))
for r_, i_, x0, y0 in POI:                              # clear the pocket (a disc and a 4 wide opening to the road) so the frame and the forest leave it open, then set the piece
    rg = np.random.default_rng((13, r_, i_)); kinds = FARMKINDS if r_ in (5, 7, 8) else POIKINDS; pk = kinds[(int(hq('poik', r_, i_) * 997)) % len(kinds)]
    dd = np.argwhere(roadc & ~brk & (rz == r_) & (np.abs(XX - x0) < 14) & (np.abs(YY - y0) < 14)); ty_, tx_ = dd[np.hypot(dd[:, 1] - x0, dd[:, 0] - y0).argmin()] if len(dd) else (y0, x0)
    cm = (np.hypot(XX - x0, YY - y0) <= 8.5) | (poly_mask([(x0 + .5, y0 + .5), (tx_ + .5, ty_ + .5)]) & (np.hypot(XX - x0, YY - y0) < 14))
    cm = cm | dil(poly_mask([(x0 + .5, y0 + .5), (tx_ + .5, ty_ + .5)]), 1)
    poi_open |= cm; poi_fix.append((pk, x0, y0, rg))
wall &= ~poi_open; inner &= ~poi_open; forest &= ~poi_open
props = [p_ for p_ in props if not (p_[0].startswith('hedge') and poi_open[min(HP - 1, int(p_[2] // T)), min(WP - 1, int(p_[1] // T))])]      # a gap in the hedgerow where a pocket opens
arc5 = arc_from(road5, (g7x, g7y)); mid5 = (arc5 >= 48) & (arc5 <= 100) & (d5 >= 6.5) & (d5 <= 13) & free & (mat == GRASS) & ~poi_open & ~dil(plotocc, 1)      # v2: the middle of Route 5 changes: a belt of trees and orchard rows behind the hedges
scatter(mid5, .8, ['roundOak', 'bushyOak', 'canopyTree', 'roundTree', 'bigRoundTree'])
fm = free & forest & ~clear & ~(cls == C['fungal'])
scatter(fm & ~ridge, .8, lush); scatter(fm & ridge, .8, cold)
wn9 = noise(9, 304)
scatter(wall & ~ridge & (wn9 > 0), .72, ['pineTree', 'pineTree', 'pineTreeDark', 'spruceTree', 'bigRoundTree']); scatter(wall & ~ridge & (wn9 <= 0), .72, ['bushyOak', 'roundOak', 'canopyTree', 'bigRoundTree', 'roundTree'])
scatter(wall & ridge, .72, cold)
clusters(inner, 14, [BUSHES, DRIFT_A, DRIFT_C], 'inner')                                       # the inner skirt of the wall: bushes and flowers at its foot
# hand layout `deco` lists: ["fam", name, x, y] drops a family there; ["row", prop, x0, y0, x1, y1, step] lines props up along a segment (fences, hedges, lamps, beds); coordinates in tiles from the town centre
FAMS = {'grove-oak': G_OAK, 'grove-pine': G_PINE, 'grove-round': G_ROUND, 'grove-canopy': G_CANOPY, 'drift-a': DRIFT_A, 'drift-b': DRIFT_B, 'drift-c': DRIFT_C, 'bushes': BUSHES, 'outcrop': OUTCROP, 'outcrop-b': OUTCROP_B, 'outcrop-s': fam_outcrop(), 'reeds': fam_reeds(), 'grove-cold': G_COLD}
# working-shore families for the coast towns (T5 Salt Bay, T7 Longshore): a boat drawn up with its crates, a net-mending corner, driftwood, palms, a rock pile; every member is real tileset art
def fam_shore(items, tufts=('dryTuft', 'shell', 'pebbles', 'grassBlades'), nt=(3, 6), spread=(3.4, 1.8)):
    def f(rg):
        out = [(n, dx, dy, r, ydy) for n, dx, dy, r, ydy in items]
        for _ in range(int(rg.integers(nt[0], nt[1] + 1))): p = _ring(rg, 1.0, 1.0, *spread); out.append((tufts[int(rg.integers(len(tufts)))], p[0], p[1], 0, .8))
        return out
    return f
FAMS.update({'shore-boat': fam_shore([('maRowboat', 0, 0, 2, .95), ('crateWide', 3.4, .1, 0, .9), ('crateBox', 4.3, -.3, 0, .9), ('barrelOrange', 3.8, -1.2, 0, .9)]),
             'shore-boat2': fam_shore([('maRowboat', 0, 0, 2, .95), ('barrelDark', -3.2, .2, 0, .9), ('seedSack', -4.1, -.4, 0, .9), ('fallenLog', 3.6, .6, 1, .8)]),
             'shore-nets': fam_shore([('benchYellow', 0, 0, 1, .95), ('crateWide', -2.4, -.8, 0, .9), ('crateBox', -1.6, -1.1, 0, .9), ('barrelOrange', 2.6, -.8, 0, .9), ('seedSack', 3.4, -.2, 0, .9), ('wSignBoard', 1.2, -1.6, 0, .9)]),
             'shore-drift': fam_shore([('fallenLog', 0, 0, 1, .8), ('logShort', 2.6, .8, 1, .8), ('stoneGrey', -2.2, .6, 0, .9), ('shell', 1.1, 1.4, 0, .8)], nt=(4, 7)),
             'shore-palms': fam_shore([('palmTreeBig', 0, 0, 1, .95), ('palmTree', 2.6, .8, 1, .95), ('palmTree', -2.2, .7, 1, .95), ('rockGrey', 1.2, 2.2, 0, .9)], nt=(3, 5)),
             'shore-rocks': fam_shore([('bigRockGrey', 0, 0, 1, .95), ('boulderGrey', 1.9, .6, 1, .95), ('rockGreyPair', -1.8, .8, 0, .9), ('rockGrey', 3.2, 1.0, 0, .9), ('flowersWhite', -.6, 1.6, 0, .8)], nt=(2, 4))})
for code_, cx_, cy_, dl_ in DECO:
    for d_ in dl_:
        if d_[0] == 'fam':
            rg = np.random.default_rng((14, zlib.crc32((code_ + str(d_[2:4])).encode()))); x0, y0 = cx_ + d_[2], cy_ + d_[3]
            for nm, dx, dy, r, ydy in FAMS[d_[1]](rg):
                x, y = int(np.floor(x0 + dx)), int(np.floor(y0 + dy))
                if 0 < x < WP - 1 and 0 < y < HP - 1 and land[y, x] and not roadm[y, x] and not paved[y, x] and not doorc[y, x] and not KOCC[y, max(0, x - r):x + r + 1].any() and int(h[y, x]) == int(h[y0, x0]) and kind[y, x] == 0 and mat[y, x] != FORD and not occ[y, x]:
                    KOCC[y, max(0, x - r):x + r + 1] = True; put(nm, (x0 + dx + .5) * T, (y0 + dy + ydy) * T)
        elif d_[0] == 'plot':                   # ["plot", x, y, w, h, 0 cabbage | 1 wheat]: a small tilled garden with a rounded outline, crops and a fence on its long sides
            _, px_, py_, w_, hh_, kd2 = d_; x0, y0 = cx_ + px_, cy_ + py_; ok2 = np.zeros((HP, WP), bool); ok2[y0:y0 + hh_, x0:x0 + w_] = rrect_mask(hh_, w_, 3)
            ok2 &= land & (mat == GRASS) & ~roadm & ~occ & (kind == 0) & (h == h[cy_, cx_])
            if ok2.sum() > .8 * hh_ * w_:
                mat[ok2] = SOIL if kd2 == 0 else HAYF; occ[y0 - 1:y0 + hh_ + 1, x0 - 1:x0 + w_ + 1] = True; plot_crops(x0, y0, w_, hh_, kd2, False)
                for k_ in range(0, w_, 2): props.append(['fenceRail', int((x0 + k_ + 1) * T), int(y0 * T)]); props.append(['fenceRail', int((x0 + k_ + 1) * T), int((y0 + hh_) * T)])
        elif d_[0] == 'pond':                   # [pond, x, y, rx, ry]: shallow water (ford) with reeds, a log and rocks on its bank
            _, px_, py_, rx_, ry_ = d_; x0, y0 = cx_ + px_, cy_ + py_; pm = (((XX - x0) / rx_) ** 2 + ((YY - y0) / ry_) ** 2 <= 1) & land & (mat == GRASS) & ~roadm & ~occ & (kind == 0) & (h == h[cy_, cx_])
            pm = blocky(pm, 2, .5) & land & (mat == GRASS) & ~roadm & ~occ
            mat[pm] = FORD; ford[pm] = True; occ[y0 - int(ry_) - 2:y0 + int(ry_) + 3, x0 - int(rx_) - 2:x0 + int(rx_) + 3] = True
            rg = np.random.default_rng((15, x0, y0))
            for nm, dx, dy, ydy in (('reedsPair', -rx_ - .6, -ry_ * .4, .8), ('reeds', rx_ + .4, -ry_ * .3, .8), ('reedsOlive', -rx_ * .4, ry_ + 1.0, .8), ('reeds', rx_ * .5, ry_ + 1.1, .8), ('fallenLog', -rx_ - 1.4, ry_ * .5, .8), ('rockGrey', rx_ + 1.2, ry_ * .7, .9), ('flowersWhite', 0, -ry_ - 1.2, .8), ('stoneGrey', -rx_ * .6, -ry_ - 1.2, .9)):
                xx_, yy_ = int(np.floor(x0 + dx)), int(np.floor(y0 + dy))
                if land[yy_, xx_] and mat[yy_, xx_] != FORD and not roadm[yy_, xx_]: put(nm, (x0 + dx + .5) * T, (y0 + dy + ydy) * T)
        elif d_[0] == 'row':
            nm, xa, ya, xb, yb, st_ = d_[1:7]; n = int(max(abs(xb - xa), abs(yb - ya)) / st_)
            for k in range(n + 1):
                x, y = cx_ + xa + (xb - xa) * k / max(n, 1), cy_ + ya + (yb - ya) * k / max(n, 1); xi, yi = int(np.floor(x)), int(np.floor(y))
                if 0 < xi < WP - 1 and 0 < yi < HP - 1 and land[yi, xi] and not roadm[yi, xi] and not doorc[yi, xi] and mat[yi, xi] != FORD and int(h[yi, xi]) == int(h[cy_, cx_]): put(nm, (x + .5) * T, (y + 1) * T - 1)
log('hand layout deco applied')
for pk, x0, y0, rg in poi_fix:
    ok_ = lambda x, y: 0 <= y < HP and 0 <= x < WP and land[y, x] and not roadm[y, x] and not occ[y, x] and int(h[y, x]) == int(h[y0, x0]) and kind[y, x] == 0
    for nm, dx, dy, ydy in poi_piece(pk, rg):
        if ok_(int(np.floor(x0 + dx)), int(np.floor(y0 + dy))): put(nm, (x0 + dx + .5) * T, (y0 + dy + ydy) * T)
    if pk == 'pond':                                 # shallow water: a wadeable ford patch (the real pond tiles need deep-water edge art the ford mat lacks)
        pm = ((XX - x0) / 3.4) ** 2 + ((YY - y0) / 2.1) ** 2 <= 1
        pm &= land & (h == h[y0, x0]) & (kind == 0) & ~roadm
        mat[pm] = FORD; ford[pm] = True
open_ = free & ~forest & (mat == GRASS) & (cls != C['meadow']) & ~core4 & ~(d1r <= 16) & ~wall & ~poi_open & ~dil(g6clear, 2)       # (the Pinegrove landings and clearings keep their own layout)
clusters(open_ & ~ridge & ~bare, 4.0, [G_OAK, G_PINE, G_ROUND, G_OAK, G_CANOPY], 'grove'); clusters(open_ & ridge & ~bare, 4.0, [G_COLD], 'grovecold'); clusters(open_ & bare, 1.6, [G_OAK, G_ROUND], 'grove-bare')
scatter(open_ & bare, .0025, ['roundOak', 'bushyOak', 'roundTree'])   # open country keeps its sky, with a lone big tree here and there
clusters(open_ & ~poi_open, 9.0, [BUSHES, DRIFT_A, DRIFT_C, OUTCROP, DRIFT_B, BUSHES], 'open-comp')
clusters(free & (cls == C['meadow']) & (mat == GRASS) & ~poi_open, 14.0, [DRIFT_A, DRIFT_B, DRIFT_C, DRIFT_B], 'meadow')
scatter(free & ((mat == SAND) | (mat == DUNE)) & ~(mat == DUNE), .006, ['palmTree', 'palmTreeBig'], step=2)
scatter(free & (mat == SAND), .014, ['shell', 'pebbles', 'grassBlades'], step=1, ydy=.6)
scatter(free & (mat == DUNE), .03, ['cactus', 'cactusFlowering', 'cactus', 'deadTree', 'dryTuft', 'organCactus'], [.3, .15, .2, .08, .2, .07], step=2)
scatter(free & (cls == C['scrub']), .25, ['cactusFlowering', 'dryTuft'], step=1)
scatter(free & (mat == SWAMP) & ~swm, .09, ['mushroomStump', 'darkConeTree', 'mushroomsOrange', 'mushroomsRed', 'mushroomsPale', 'mushroomsOrangeB', 'mushroomStump'], [.18, .12, .2, .15, .12, .1, .13], step=2)
scatter(free & (cls == C['shroom']), .5, ['mushroomStump', 'mushroomStump', 'mushroomsOrange', 'mushroomsPale', 'mushroomsRed', 'mushroomStump', 'frostMushroomTree', 'hollowStump'], [.2, .2, .15, .15, .1, .1, .05, .05], step=1)   # G8: the magenta wash on the map is the fungus itself
scatter(free & (mat == SNOW), .03, ['snowPine', 'snowFir', 'snowDomeTree', 'snowFirB', 'snowCanopy', 'snowBlob'], step=2)
clusters(free & (mat == ASH) & mount, 4.5, [fam_outcrop(flow=('dryTuft', 'grassBlades', 'stoneGrey')), OUTCROP_B], 'mount-rocks')
scatter(free & (mat == ASH) & mount & (Ht <= 2), .01, ['spruceTree', 'rockBrown', 'deadPine'], step=3)
rockc = (cls == C['rock']) & ~mount & ~cave
scatter(free & rockc, .5, ['rockGrey', 'bigRockGrey', 'rockGreyB', 'boulderGrey', 'rockGreyPair', 'stonesPair'], step=2)
# road verges: flowers and bushes
edge = dil(roadm, 5) & ~dil(roadm, 1) & free & (mat == GRASS) & ~(d1r <= 5) & ~poi_open & ~dil(g6clear, 2) & ~core4
clusters(edge, 16, [DRIFT_A, BUSHES, DRIFT_B, fam_drift(['flowersWhite', 'roseBush', 'flowersPinkTall'], n=(3, 5), rx=2.4, ry=1.2)], 'edge')
# reeds on river banks, and a log with its reeds where the bank is open
bank = dil(inl, 3) & ~inl & free & (mat == GRASS)
LOGBANK = lambda rg: [(('fallenLog', 'logShort')[int(rg.integers(2))], 0, 0, 1, .8), ('reeds', -2.2, -.6, 0, .8), ('reedsPair', 2.4, -.4, 0, .8), ('rockGrey', 1.0, 1.4, 0, .9), ('flowersWhite', -1.2, 1.6, 0, .8)]
clusters(bank, 14, [fam_reeds(), fam_reeds(n=(5, 8)), LOGBANK], 'bank')
# town trees: a few between the buildings
tw = free_town & ~dil(paved, 1) & (mat == GRASS) & ~core4
clusters(tw, 9.0, [G_OAK, DRIFT_A, BUSHES, G_ROUND, DRIFT_B, fam_drift(['flowersWhite', 'roseBush', 'flowersBlue'], n=(3, 6), rx=2.2, ry=1.2)], 'town')      # v2: groves, drifts and bush patches between the buildings, not single props
# G8 Sporehaven props (docs/TOWNPASS.md): a dark wood with glowing mushrooms under it (animated caps lit by the renderer in the gloom zones), thick on Route 2 and round the town, thinning along Route 101 where the town's crews cut it back (stakes, stumps, piles of cut caps, treatment barrels)
g8n = collections.Counter(); g8id = [i for i, t in enumerate(TL, 1) if t['code'] == 'G8'][0]
rt101 = (rz == 101) & roadc & ~brk; d101 = ndi.distance_transform_edt(~rt101); arc101 = arc_from(rt101, (g8x, g8y)); uf8 = np.random.default_rng(96).random((HP, WP))
ok8 = land & (kind == 0) & (h == 0) & ((mat == GRASS) | (mat == SWAMP) | (mat == WETG)) & ~doorc & ~dil(roadm, 1) & ~dil(brk, 2) & ~water
GLOWS = ['mushroomsOrange', 'mushroomsPale', 'mushroomsRed', 'mushroomsOrangeB']; DARK = ['darkConeTree', 'pineTreeDark', 'spruceTreeDark', 'canopyTreeDark', 'roundTreeDark', 'darkConeTree', 'layerTreeDark']
wood8 = free & (((dg8 > 40) & (dg8 <= 62)) | fung2) & ~dil(paved, 1) & ~dil(riv, 2)
clr8 = noise(3, 97) > 1.3                                              # a few clearings in the canopy
scatter(wood8 & ~clr8, .62, DARK, step=2)
scatter(wood8, .11, GLOWS, step=1, ydy=.8); scatter(wood8, .035, ['mushroomStump', 'mushroomStump'], step=2); scatter(wood8 & ~clr8, .02, ['frostMushroomTree', 'hollowStump'], step=3)
scatter(wood8, .03, ['mushroomsRed', 'mushroomsOrange', 'mushroomsPale', 'mushroomStump', 'hollowStump'], [.25, .2, .25, .22, .08], step=1, ydy=.7)
t8 = free_town & (tid == g8id) & ~dil(paved, 1)                         # inside the town: the same, a lot sparser, and the lamps stay low
scatter(t8, .05, GLOWS, step=1, ydy=.8); scatter(t8, .018, ['mushroomStump', 'mushroomStump'], step=2); scatter(t8, .06, DARK, step=2); scatter(t8, .03, ['mushroomsRed', 'mushroomsPale', 'mushroomStump'], step=1, ydy=.7)
thin = np.clip(1 - arc101 / 105.0, 0, 1)                                # Route 101: full glow at the town end, nearly none by Duskmoss
f101 = free & (arc101 >= 0) & (d101 <= 17) & (d101 >= 2.5) & (dg8 > 40) & (uf8 < thin ** 1.3)
scatter(f101, .1, GLOWS, step=1, ydy=.8); scatter(f101, .03, ['mushroomStump', 'mushroomStump'], step=2); scatter(f101 & (uf8 < thin ** 1.3 * .8), .45, DARK, step=2); scatter(f101, .02, ['frostMushroomTree', 'hollowStump'], step=3)
cut8 = free & (arc101 >= 0) & (d101 <= 11) & (d101 >= 3) & (dg8 > 40)
scatter(cut8 & (uf8 > thin * .5), .05, ['stumpSmall', 'stumpLarge', 'mushroomStump', 'stumpSmall'], [.3, .2, .3, .2], step=1, ydy=.8)
ymid = {i: np.nonzero(rt101[:, i])[0] for i in range(WP)}
for side in (0, 1):                                                     # boundary stakes either side of the road every 14 tiles, a crew station (barrels, crates, a pile of cut caps) every third one
    for i, a in enumerate(range(20, 400, 14)):
        c = [(int(x), int(y)) for y, x in np.argwhere((np.abs(arc101 - a) <= 1) & (d101 >= 4.5) & (d101 <= 6.5) & ok8 & ~occ) if len(ymid[x]) and (y > ymid[x].mean()) == bool(side)]
        if not c: continue
        x0, y0 = c[int(hq('g8s', i, side) * len(c))]
        props.append(['fencePole', int((x0 + .5) * T), int((y0 + 1) * T - 4)]); occ[y0 - 1:y0 + 2, x0 - 1:x0 + 2] = True; g8n['stake'] += 1
        if i % 3 == side and a > 30:
            for dx, dy, nm in ((2, 0, 'barrelOrange'), (-2, 1, 'crateBox'), (-3, -1, 'crateWide')):
                if ok8[y0 + dy, x0 + dx] and not occ[y0 + dy - 1:y0 + dy + 2, x0 + dx - 1:x0 + dx + 2].any(): props.append([nm, int((x0 + dx + .5) * T), int((y0 + dy + 1) * T - 4)]); occ[y0 + dy - 1:y0 + dy + 2, x0 + dx - 1:x0 + dx + 2] = True; g8n[nm] += 1
if os.environ.get('G8DUMP'):
    json.dump({n: [[int(x), int(y), int(a[y, x])] for y, x in np.argwhere(m_)] for n, m_, a in (('r2', road2 & ~brk, arc_from(road2 & ~brk, (g8x, g8y))), ('r101', rt101, arc101))}, open(os.environ['G8DUMP'], 'w'))
log('G8 props', dict(g8n), 'Route 101 road', int(rt101.sum()), 'Route 2 road', int(road2.sum()))
# T8 Duskmoss props (docs/TOWNPASS.md): the treeline (a dark wood north-west of the town; the wall of soft light the bible describes needs glowing mushroom art, which is missing, docs/ENGINE.md), cut stumps where the crews work the line,
# and Route 103 (black shore: rocks, shells and drift on the dark sand, windswept ledges, a few things left on the beach; nothing out here and nothing comes)
t8n = collections.Counter(); id8t = [i for i, t in enumerate(TL, 1) if t['code'] == 'T8'][0]
wood8t = free & fung8t & ~dil(paved, 1) & (dT8 >= 33)
scatter(wood8t & ~clr8, .5, DARK, step=2); scatter(wood8t, .12, GLOWS, step=1, ydy=.8); scatter(wood8t, .03, ['mushroomStump', 'mushroomStump'], step=2); scatter(wood8t & ~clr8, .015, ['frostMushroomTree', 'hollowStump'], step=3)
for y, x in np.argwhere(free & fung8t & (dT8 >= 29) & (dT8 <= 33) & (XX % 2 == 0) & (YY % 2 == 0) & ~occ):      # the first rank of the treeline: a dark tree every other tile, so the wood reads as a wall from the town
    if hq('t8w', int(x), int(y)) < .85: props.append([DARK[int(hq('t8n', int(x), int(y)) * len(DARK))], int((x + .5) * T), int((y + 1) * T - 4)]); occ[y - 1:y + 2, x - 1:x + 2] = True; t8n['wall'] += 1
scatter(free & fung8t & (dT8 < 33), .06, ['stumpSmall', 'stumpLarge', 'mushroomStump', 'stumpSmall'], [.3, .2, .3, .2], step=1, ydy=.8)       # the cut strip in front of the trees
scatter(free_town & (tid == id8t) & ~dil(paved, 1), .012, GLOWS, step=1, ydy=.8)                                                               # in town: a clump here and there where nothing should be growing
scatter(free & black, .035, ['rockGrey', 'rockGreyB', 'pebbles', 'shell', 'stoneGrey', 'twigs', 'rockGreyPair'], [.2, .12, .22, .12, .12, .12, .1], step=1, ydy=.8)
scatter(free & ledge, .03, ['deadPine', 'rockGrey', 'boulderGrey', 'dryTuft', 'stumpSmall'], [.15, .25, .15, .3, .15], step=2)
arc103 = arc_from(road103, (t8x, t8y)); d103 = ndi.distance_transform_edt(~road103)
def p103(nm, a, lo, hi, side, r=1):
    """one prop near arc length a of Route 103, lo..hi tiles off the road, on the sea side (side 1) or the land side (side -1)"""
    c = [(int(x), int(y)) for y, x in np.argwhere((np.abs(arc103 - a) <= 2) & (d103 >= lo) & (d103 <= hi) & free & ~occ)]
    if not c: return False
    c.sort(key=lambda p: (dland[p[1], p[0]] * side, hq('t8p', nm, a, p[0], p[1])))
    x, y = c[0]; props.append([nm, int((x + .5) * T), int((y + 1) * T - 4)]); occ[y - 1:y + 2, x - r:x + r + 1] = True; t8n[nm] += 1; return True
for a, group in ((38, [('fallenLog', 3.5, 6), ('logShort', 3.5, 6), ('twigs', 3, 5), ('logShort', 4, 7)]), (78, [('maRowboat', 3.5, 6), ('crateWide', 3, 5), ('barrelDark', 3, 5), ('pebbles', 3, 5)]),
                 (118, [('benchTeal', 3, 4.5), ('noticeBoard', 3, 4.5), ('torchPost', 3, 4.5), ('rockGrey', 3, 6)]), (150, [('signGreenWide', 3, 4.5), ('bigRockGrey', 4, 7), ('boulderGrey', 4, 7), ('stoneGrey', 3, 6)])):
    for k, (nm, lo, hi) in enumerate(group): p103(nm, a + k * 2, lo, hi, 1 if nm in ('maRowboat', 'fallenLog', 'logShort', 'bigRockGrey') else -1, 2 if nm == 'maRowboat' else 1)
for a in range(20, 200, 14): p103(('shell', 'pebbles', 'twigs')[(a // 14) % 3], a, 3.5, 7, 1)     # bits of drift on the sand between the landmarks
log('T8 props', dict(t8n), 'Route 103 road', int(road103.sum()))
# L4 Quiet Plain + Route 1 props (docs/TOWNPASS.md): waymarker stones counting down to the memorial (the numerals are in the stones' lines, no art draws them), weeds forced up through the paving, a bench, the junction sign, and wind in the open grass round the markers
# (the markers themselves, the benches by the road end and the people are hand laid in tools/adv-towns/L4.json and data/adv/npcs.js). Side +1 is east of the road when walking south.
l4n = collections.Counter(); R1A = np.r_[0, np.cumsum([np.hypot(a[0] - b[0], a[1] - b[1]) for a, b in zip(R1PTS, R1PTS[1:])])]
def r1cell(a, off):
    i = int(np.clip(np.searchsorted(R1A, a), 1, len(R1PTS) - 1)); (xa, ya), (xb, yb) = R1PTS[i - 1], R1PTS[i]; sl = np.hypot(xb - xa, yb - ya) or 1; u = (a - R1A[i - 1]) / sl
    tx, ty = (xb - xa) / sl, (yb - ya) / sl
    return int(xa + (xb - xa) * u + ty * off), int(ya + (yb - ya) * u - tx * off)
def r1put(nm, a, off, r=1):
    sg = 1 if off > 0 else -1
    for da in (0, 1, -1, 2, -2, 3, -3, 4, -4):
        for k in range(6):
            x, y = r1cell(a + da, off + sg * k)
            if land[y, x] and kind[y, x] == 0 and h[y, x] == 0 and not roadm[y, x] and not water[y, x] and mat[y, x] == GRASS and not occ[y - 1:y + 2, x - r:x + r + 1].any():
                props.append([nm, int((x + .5) * T), int((y + 1) * T - 4)]); occ[y - 1:y + 2, x - r:x + r + 1] = True; l4n[nm] += 1; return (x, y, a + da, off + sg * k)
    return None
for n_ in range(1, 10):                                        # stone 1 is the last before the memorial, stone 9 the first out of the Route 2 junction; every other one on the far side
    a = R1LEN - 14 - (n_ - 1) * 15.5; sd_ = 1 if n_ % 2 else -1; p = r1put('standingStoneMint', a, sd_ * 3)
    st_ = r1cell(p[2], p[3] - sd_) if p else r1cell(a, sd_ * 2); [npc_set(f'r1-stone{n_}', st_[0], st_[1]) for n0 in NPCS if n0[0] == f'r1-stone{n_}' and max(abs(n0[1] - st_[0]), abs(n0[2] - st_[1])) > 3]        # the unseen reader stands beside its stone, on the road side
    print(f'  WAYMARK {n_}: arc {a:.0f} stone {p} stand {st_} (road cell {r1cell(a, 0)}, side {sd_})')
r1put('streetSign', 5, 3); r1put('benchTeal', R1LEN * .5, -3); r1put('stoneGrey', R1LEN * .5 + 3, -4); r1put('flowersWhite', R1LEN * .5 - 2, -4)
for y, x in np.argwhere(road1 & ~crack):                       # weeds in the seams: never solid, so the road stays open
    if hq('r1w', int(x), int(y)) < .24 + .16 * np.clip(1 - (dL4[y, x] - 10) / 130, 0, 1): props.append([('grassBlades', 'dryTuft', 'leafPlantGrey', 'grassBlades')[int(hq('r1n', int(x), int(y)) * 4)], int((x + .5) * T), int((y + 1) * T - 4)]); l4n['weed'] += 1
scatter(free & core4 & (mat == GRASS) & ~dil(roadm, 1), .05, ['grassBlades', 'dryTuft', 'grassBlades', 'flowersWhite', 'leafPlantGrey'], step=1, ydy=.7)
log('L4 props', dict(l4n), 'Route 1 length', int(R1LEN))
# C1 props B: rocks on the Route 7 ridges, bales and stumps in the pasture, reeds in the water meadows
scatter(free & rdg7, .06, ['rockGrey', 'rockBrown', 'boulderGrey', 'stoneGrey', 'rockGreyB', 'stonesPair'], step=1, ydy=.8)
scatter(free & ~rdg7 & (d7 < 30) & (mat == GRASS), .004, ['rockGrey', 'rockBrown', 'stoneGrey', 'boulderGrey'], step=1, ydy=.8)
scatter(free & ((d7 < 34) | (dg < 64)) & (mat == GRASS) & ~plotocc, .0025, ['maHayPile', 'stumpLarge', 'stumpSmall'], step=2)
scatter(free & wg, .015, ['reeds', 'reedsOlive', 'leafPlantB', 'flowersBlue', 'flowersWhite'], step=1, ydy=.8)
scatter(free & swm, .08, ['reeds', 'reedsPair', 'reedsOlive', 'reedsDark', 'reedsOliveWide', 'leafPlantB'], step=1, ydy=.8)
# T4: the hill over the Route 4 cave (nothing walks there): rocks and crystals on its crown; the cave itself is data/adv/rooms/t4-cave.js
scatter(cave & ero(cave, 2), .035, ['rockGrey', 'rockGreyB', 'boulderGrey', 'stoneGrey', 'rockBrown', 'bigRockGrey', 'crystalBlue', 'crystalBlueTall', 'rockGreyPair'], step=2, ydy=.8)
log('props', len(props))

# ---------------------------------------------------------------- final check: flood fill with props as obstacles
# ---------------------------------------------------------------- QA prune (tools/adv-tile-lint.py placement rules): no two solid rects overlap (hedge and fence segments overlap on purpose),
# no loose prop within one tile of a door; buildings win, then the bigger footprint, then the earlier prop
BARRIER = re.compile(r'^(hedge|.*[Ff]ence)')
def prune(props):
    doors = [(r['x'], r['y']) for r in ROOM_DOORS + BLD_DOORS]; sol = []
    for i, (nm, x, y) in enumerate(props):
        s = solid_rect(nm)
        if s: sol.append((i, nm, x + s[0], y + s[1], x + s[2], y + s[3], 'door' in P(nm)))
    drop = set(); grid = {}; pos = {t[0]: q for q, t in enumerate(sol)}
    for i, nm, x0, y0, x1, y1, bld in sorted(sol, key=lambda t: (not t[6], -(t[4] - t[2]) * (t[5] - t[3]), t[0])):
        if not bld and any(x0 - 32 < dx < x1 + 32 and y0 - 32 < dy < y1 + 32 for dx, dy in doors) and not any(x0 - 4 < dx < x1 + 4 and y0 - 4 < dy < y1 + 4 for dx, dy in doors): drop.add(i); continue
        hit = False
        for gx in range(int(x0 // 128), int(x1 // 128) + 1):
            for gy in range(int(y0 // 128), int(y1 // 128) + 1):
                for j in grid.get((gx, gy), []):
                    _, n2, a0, b0, a1, b1, _ = sol[j]
                    if min(x1, a1) - max(x0, a0) > 2 and min(y1, b1) - max(y0, b0) > 2 and not (BARRIER.match(nm) and BARRIER.match(n2)): hit = True
        if hit and not bld: drop.add(i); continue
        for gx in range(int(x0 // 128), int(x1 // 128) + 1):
            for gy in range(int(y0 // 128), int(y1 // 128) + 1): grid.setdefault((gx, gy), []).append(pos[i])
    return [p for i, p in enumerate(props) if i not in drop], len(drop)
props, npr = prune(props); log('prune: dropped', npr, 'props that overlapped a solid or stood next to a door')
blkp = np.zeros((HP, WP), bool)
for nm, x, y in props:
    s = solid_rect(nm)
    if not s: continue
    x0, y0, x1, y1 = x + s[0] - 6, y + s[1] - 6, x + s[2] + 6, y + s[3] + 6
    c0, c1, r0, r1 = int(x0 // T), int(x1 // T), int(y0 // T), int(y1 // T)
    for r in range(max(r0, 0), min(r1, HP - 1) + 1):
        for c in range(max(c0, 0), min(c1, WP - 1) + 1):
            if x0 < (c + .5) * T < x1 and y0 < (r + .5) * T < y1: blkp[r, c] = True
blkp &= ~doorc & ~roadm
seen = reach(nowalk | blkp); R_ = (seen[..., 0] > 0) | (seen[..., 1] > 0)
# repair: open props that wall off walkable ground (clear blocking cells next to a reachable cell and an unreachable one)
for rnd in range(6):
    U = land & ~nowalk & ~blkp & ~R_ & (kind != 8) & ~(seen[..., 1] > 0)
    if not U.sum(): break
    openers = blkp & dil(U, 1) & dil(R_, 1)
    if not openers.any(): break
    blkp &= ~openers
    props = [p for p in props if not (solid_rect(p[0]) and openers[int(p[2] // T), int(p[1] // T)])]
    seen = reach(nowalk | blkp); R_ = (seen[..., 0] > 0) | (seen[..., 1] > 0)
log('flood fill done, props', len(props))
print('---- reachability from the Goldacre spawn ----')
bad = []
walk_all = land & ~nowalk & ~blkp
for t in TL:
    c = town_out[t['code']]['door']; ok = R_[c[1] + 1, c[0]] or R_[c[1], c[0]]
    inside = walk_all & (np.hypot(XX - t['tx'], YY - t['ty']) < t['R']); frac = R_[inside].mean() if inside.any() else 1
    print(f"  {t['code']} {t['name']:18s} door {'ok' if ok else 'UNREACHABLE'}  ground reachable {frac * 100:5.1f}%")
    if not ok: bad.append(t['name'])
rts = sorted(set(rz[roadc].tolist()))
for r in LABELS:
    m = (rz == r) & roadc
    if not m.any(): print(f'  route {r}: MISSING'); bad.append(f'route {r}'); continue
    lb, nb = ndi.label(m, np.ones((3, 3)))
    f = R_[m].mean()
    if f < .99 or nb > 1: print(f'  route {r}: {m.sum()} tiles, {nb} pieces, {f * 100:.1f}% reachable'); 
    if f < .95 and r != 4: bad.append(f'route {r}')
print('  route 4: interior is a sealed cave (entrance and exit only), expected unreachable' if cave.any() else '  route 4: cave not found')
unr = land & ~nowalk & ~blkp & ~R_ & (kind != 8) & ~(seen[..., 1] > 0)
lb, nb = ndi.label(unr)
big = [(int(s), i + 1) for i, s in enumerate(ndi.sum(unr, lb, range(1, nb + 1))) if s >= 200]
print(f'  unreachable land: {int(unr.sum())} tiles in {nb} pieces; pieces >= 200 tiles: {len(big)}')
for s, i in sorted(big, reverse=True)[:12]:
    yy, xx = np.nonzero(lb == i); print(f'    {s} tiles near ({int(xx.mean())}, {int(yy.mean())})')
print('  NOT OK: ' + ', '.join(bad) if bad else '  all towns and routes reachable')
# Skills: places and routes that need a skill to reach (label -> skill). Everything else must be reachable with no skill at all; gated ones must be reachable with it.
GATED = {}                                            # none yet: Salt Bay's Surf opens the sea, which no town or route needs
SKILL_FLOOD = {'surf': reach(nowalk | blkp, True)}
RS = {k: (v[..., 0] > 0) | (v[..., 1] > 0) for k, v in SKILL_FLOOD.items()}
for lab_, sk in GATED.items():
    m_ = (rz == int(lab_[5:])) & roadc if lab_.startswith('route') else None
    if m_ is None or not RS[sk][m_].all(): bad.append(f'{lab_} is not reachable even with {sk}')
for sk, rs in RS.items():
    only = land & ~nowalk & ~blkp & rs & ~R_ & (kind != 8)
    lb_, nb_ = ndi.label(only)
    print(f'  with {sk}: {int(only.sum())} more land tiles in {nb_} pieces; {int((rs & ~R_ & ~land & ~nowalk).sum())} sea tiles open; everything reachable without it stays reachable with it: {bool((R_ & ~rs).sum() == 0)}')
    if (R_ & ~rs).any(): bad.append(f'{sk} closes a place that is reachable without it')
print('  NOT OK (skills): ' + ', '.join(bad) if bad else '  skill-aware reachability OK')

# ---------------------------------------------------------------- zones
ZID = ['wild'] + [f'route{r}' for r in LABELS] + [t['id'] for t in TL]
src = np.zeros((HP, WP), np.int16)
for r in LABELS: src[(rz == r) & roadc] = ZID.index(f'route{r}')
for i, t in enumerate(TL, 1): src[(tid == i)] = ZID.index(t['id'])
src[(dg < 52) & land & (src == 0)] = ZID.index('goldacre')       # fields and pastures around Goldacre use its own encounter table
src[(dg8 < 62) & land & (src == 0)] = ZID.index('sporehaven')       # G8: the whole wood round the town (the glow and the Route 2 table)
src[(dT8 < 42) & land & (src == 0)] = ZID.index('duskmoss')       # T8: the cut strip and the first of the treeline are Duskmoss (Morelull and Shiinotic at the boundary); the road tails keep their own tables
src[(dL4 < 44) & land & (src == 0)] = ZID.index('quietplain')       # L4: the markers fan out past the disc, all of it Quiet Plain (Route 1 keeps its own road tiles)
src[cave] = ZID.index('route4')
src[land & (src == 0) & (YY - t7y >= -62) & (YY - t7y <= -26) & (XX - t7x >= -30) & (XX - t7x <= 24)] = ZID.index('route6')      # T7: the seafront strip north of the town (beach, dock, castles) is Route 6, so the dock fishes the Route 6 table
src[(src == 0) & (XX - t6x >= -30) & (XX - t6x <= 38) & (YY - t6y >= -12) & (YY - t6y <= 32)] = ZID.index('spindlewood')      # T6: the cove, its wharf and the shore round it are Spindlewood (zones are 8 x 8 tile cells, so the piers need their own cells)
dd, ii = ndi.distance_transform_edt(src == 0, return_indices=True)
zone = np.where(dd <= 60, src[ii[0], ii[1]], 0).astype(np.int16); zone[sea] = 0
zone[src > 0] = src[src > 0]
B = 8; ZC = np.zeros((HP // B, WP // B), np.int16)
for by in range(0, HP, B):
    for bx in range(0, WP, B):
        rr = rz[by:by + B, bx:bx + B]
        if (rr > 0).any(): ZC[by // B, bx // B] = int(np.bincount(src[by:by + B, bx:bx + B][rr > 0]).argmax()); continue
        v = int(zone[by + 4, bx + 4])
        if v == 0:                                       # a cell whose centre is open sea but that holds land (a pier, a shore) takes the zone of that land
            lz = zone[by:by + B, bx:bx + B][land[by:by + B, bx:bx + B]]; lz = lz[lz > 0]
            if len(lz): v = int(np.bincount(lz).argmax())
        ZC[by // B, bx // B] = v

# ---------------------------------------------------------------- NPC fixer (tools/adv-check.mjs placement rules): every NPC stands on free ground in its own zone and a trainer sees the road along its face.
# The roads, buildings and props moved with the v2 passes, so any NPC whose spot stopped working is moved to the nearest spot that works (npcs.js is rewritten; rerunning changes nothing).
WHERE = {'r5': 'route5', 'r7': 'route7', 'r8': 'route8', 'r9': 'route9', 'r10': 'route10', 'g7': 'goldacre', 's5': 'saltbay', 'r6': 'route6', 't7': 'longshore', 't4': 'tradeway', 'g6': 'pinegrove', 't6': 'spindlewood', 'g8': 'sporehaven', 't8': 'duskmoss', 'l4': 'quietplain', 'r1': 'route1', 'r103': 'route103', 'r3': 'route3', 'r111': 'route111', 'r2': 'route2', 'r101': 'route101', 't2': 'sailsport', 'g5': 'aldermerecity', 'g4': 'claystone', 'g2': 'sprucevale', 't1': 'frostfall', 'g1': 'dunereach'}
SOLG = {}
for nm, x, y in props:
    s = solid_rect(nm)
    if s:
        r_ = (x + s[0], y + s[1], x + s[2], y + s[3])
        for gx in range(int(r_[0] // 128) - 1, int(r_[2] // 128) + 2):
            for gy in range(int(r_[1] // 128) - 1, int(r_[3] // 128) + 2): SOLG.setdefault((gx, gy), []).append(r_)
def solid_at(px, py, m):
    return any(a - m < px < c + m and b - m < py < d + m for a, b, c, d in SOLG.get((int(px // 128), int(py // 128)), ()))
def npc_good(x, y, face, tr, sight, zname, taken):
    if not (2 < x < WP - 2 and 2 < y < HP - 2) or (x, y) in taken or not land[y, x] or isw(mat[y, x]) or kind[y, x] != 0 or h[y, x] < 0: return False
    if any(b['fx'] - 1 <= x <= b['fx'] + b['w'] and b['fy'] - 1 <= y <= b['fy'] + b['d'] - 1 for b in BUILDINGS) or solid_at((x + .5) * T, (y + .5) * T, 9) or (zname and ZID[ZC[y // B, x // B]] != zname): return False
    if tr:
        v = {0: (0, 1), 2: (1, 0), 4: (0, -1), 6: (-1, 0)}[face]
        for k in range(1, sight + 1):
            cx_, cy_ = x + v[0] * k, y + v[1] * k
            if mat[cy_, cx_] in (PATH, PAVE):
                if h[cy_, cx_] != h[y, x]: return False
                return not any(solid_at((x + .5) * T + v[0] * s, (y + .5) * T + v[1] * s, 2) or h[int(((y + .5) * T + v[1] * s) // T), int(((x + .5) * T + v[0] * s) // T)] != h[y, x] for s in range(8, k * T, 8))
        return False
    return True
moved = []; taken = set()
for id_, x, y, face, tr, li in NPCS:
    txt = NPC_SRC[li] + (NPC_SRC[li + 1] if tr else ''); sm = re.search(r'sight: (\d)', txt); sight = int(sm.group(1)) if sm else 0; zname = WHERE.get(id_.split('-')[0])
    if tr and not sm: continue
    if npc_good(x, y, face, tr, sight, zname, taken): taken.add((x, y)); continue
    for dx, dy in sorted(((a, b) for a in range(-7, 8) for b in range(-7, 8)), key=lambda d: (abs(d[0]) + abs(d[1]), d)):
        if npc_good(x + dx, y + dy, face, tr, sight, zname, taken):
            NPC_SRC[li] = NPC_SRC[li].replace(f'x: {x}, y: {y},', f'x: {x + dx}, y: {y + dy},', 1); taken.add((x + dx, y + dy)); moved.append((id_, (x, y), (x + dx, y + dy))); break
    else: print('WARN NPC', id_, 'at', (x, y), 'has no usable spot within 7 tiles')
if moved:
    open(os.path.join(OUT, 'npcs.js'), 'w', encoding='utf8', newline='').write('\n'.join(NPC_SRC))
log('NPC fixer moved', len(moved), [m[0] for m in moved])

# ---------------------------------------------------------------- output
def rle(a):
    a = a.ravel(); idx = np.flatnonzero(np.r_[True, a[1:] != a[:-1]]); cnt = np.diff(np.r_[idx, a.size])
    return ','.join(f'{v}x{n}' if n > 1 else str(v) for v, n in zip(a[idx].tolist(), cnt.tolist()))
# derived tiles (tools/adv-build-derived.py): bushes and hedges take the colours of the ground they stand on (name~biome); the ground edges themselves are picked by adv-world.js from tileset-derived.js
BIOME_OF = {SNOW: 'snow', ASH: 'ash', SWAMP: 'swamp', DUNE: 'dune', SAND: 'sand'}
BUSH_V = {'bush', 'bushDark', 'bushOlive', 'roundBush', 'poplarBush', 'hedgeLong', 'hedgeLongB', 'hedgeLongC'}
def biome_prop(nm, x, y):
    k = BIOME_OF.get(int(mat[min(HP - 1, max(0, (int(y) - 1) // T)), min(WP - 1, max(0, int(x) // T))])) if nm in BUSH_V else None
    return f'{nm}~{k}' if k else nm
bucket = {}
for nm, x, y in props: bucket.setdefault((int(x // (T * CH)), int(y // (T * CH))), []).append([biome_prop(nm, x, y), int(x), int(y)])
os.makedirs(os.path.join(OUT, 'chunks'), exist_ok=True)
if not ONLY:
    for f in os.listdir(os.path.join(OUT, 'chunks')): os.remove(os.path.join(OUT, 'chunks', f))
blank = []; total = 0; nfiles = 0
o_t = TOWN[ONLY] if ONLY else None
for cy in range(CHN):
    for cx in range(CW):
        sl = (slice(cy * CH, cy * CH + CH), slice(cx * CH, cx * CH + CH))
        ps = bucket.get((cx, cy), [])
        if (mat[sl] == WATD).all() and not h[sl].any() and not kind[sl].any() and not over[sl].any() and not ps: blank.append(cy * CW + cx); continue
        if ONLY and not (abs(cx - o_t['tx'] // CH) <= 1 and abs(cy - o_t['ty'] // CH) <= 1): continue
        d = [f'h:"{rle(h[sl])}"', f'mat:"{rle(mat[sl])}"', f'over:"{rle(over[sl])}"', f'kind:"{rle(kind[sl])}"']
        if (deck[sl] >= 0).any(): d.append(f'deck:"{rle(deck[sl])}"')
        d.append('props:' + json.dumps(ps, separators=(',', ':')))
        txt = f'ADV.chunk({cx},{cy},{{{",".join(d)}}});\n'
        open(os.path.join(OUT, 'chunks', f'{cx}_{cy}.js'), 'w', encoding='utf8').write(txt); total += len(txt); nfiles += 1
sd = town_out['G7']['door']; spawn = dict(x=int((sd[0] + .5) * T), y=int((sd[1] + 1.5) * T))
wild = []
for k in range(6, 20):
    x, y = sd[0] + k, sd[1] + 1
    if R_[y, x] and not blkp[y, x] and paved[y, x]: wild.append(dict(species='wooloo', level=8, x=int((x + .5) * T), y=int((y + .5) * T))); break
towns = {t['code']: dict(name=t['name'], x=int((t['tx'] + .5) * T), y=int((t['ty'] + .5) * T), center=dict(x=int((town_out[t['code']]['door'][0] + .5) * T), y=int((town_out[t['code']]['door'][1] + 1.5) * T))) for t in TL}
if not ONLY:
    world = dict(name='Kenora', chunksW=CW, chunksH=CHN, fill='waterDeep', palette=PAL, water=WATER_NAMES, groups=GROUPS, blank=blank, spawn=spawn, wild=wild, towns=towns, doors=ROOM_DOORS, buildings=BUILDINGS, supply=SUPPLY)
    open(os.path.join(OUT, 'world.js'), 'w', encoding='utf8').write('// Generated by tools/adv-gen-region.py. spawn is in world px; blank = chunk indices (cy * chunksW + cx) that are plain deep sea and have no file.\nwindow.ADV_WORLD = ' + json.dumps(world, separators=(',', ':')) + ';\n')
    zc = [rle(ZC[i]) for i in range(ZC.shape[0])]
    open(os.path.join(OUT, 'zones.js'), 'w', encoding='utf8').write('// Generated by tools/adv-gen-region.py. cells: one RLE string per row of 8 x 8 tile blocks, values index ids.\nwindow.ADV_ZONES = ' + json.dumps(dict(cell=B, ids=ZID, cells=zc), separators=(',', ':')) + ';\n')
print(f'wrote {nfiles} chunk files ({total / 1e6:.2f} MB), {len(blank)} blank chunks, {len(props)} props, generation {time.time() - T0:.0f} s')
if bad: sys.exit('reachability check failed: ' + ', '.join(bad))
