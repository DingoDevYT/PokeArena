"""Derived tiles (docs/TILE-QA.md "Derived tiles"): new tiles made ONLY by editing existing real tiles of assets/adv/exterior.png. No pixel is drawn.
Run: py -3.12 -I tools/adv-build-derived.py     (after tools/adv-build-tileset.py; writes assets/adv/derived.png, data/adv/tileset-derived.js, tools/.cache/derived-contact.png)

What it makes (every derived tile is named <source>+<change>:<role> in the data file's `names`):
  1. Ground edge sets with the grass taken out. path, sand and duneSand carry a bright grass fringe baked into their edge and corner tiles, which shows as green corners on snow,
     ash, swamp ground. For each of those grounds the green pixels of the 13 role tiles are replaced by the pixels of that ground's own C tile at the same spot (`by`).
  2. Bases. The overlay sets (snow, ashGround, swamp, ...) draw their ragged edge over a grass tile; the grass def gets a copy of every ground's C tile so the base can be the
     neighbouring ground (`mode: base`). Tall grass gets a tile per ground (`mode: self`): the real frost / grey / dark leaf tiles, and a recolour of the leaf tile for sand and dune.
  3. Biome recolours of bushes, hedges and the cliff tops: green pixels remapped, rank for rank, onto the colours of that biome's own plant and ground tiles.
  4. joins: which neighbours an overlay ground counts as itself (so a snow cell next to a path has no second ragged edge).
adv-world.js merges the file (lookup, pick, same); the existing tileset.js is not touched."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
T, COLS, PACK_W = 32, 8, 320
ROLES = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW']
_s = (ROOT / 'data/adv/tileset.js').read_text(encoding='utf8')
TS = json.loads(_s[_s.index('{'):_s.rindex('}') + 1])
EXI = np.array(Image.open(ROOT / TS['file']).convert('RGBA'))
BASE_ROW = -(-EXI.shape[0] // T)        # recorded in the data file: the derived sheet is its own image, this only lets the lint check the exterior did not change under it


def first(v): return v[0] if isinstance(v, list) else v
def tile(i): r, c = divmod(i, COLS); return EXI[r * T:(r + 1) * T, c * T:(c + 1) * T].copy()
def rect(p): return EXI[p['sy']:p['sy'] + p['sh'], p['sx']:p['sx'] + p['sw']].copy()
def lum(a): return a[..., 0] * .299 + a[..., 1] * .587 + a[..., 2] * .114
def green(a):
    r, g, b = (a[..., k].astype(int) for k in range(3))
    return (a[..., 3] > 0) & (g > r + 4) & (g >= b)


tiles, seen, names = [], {}, {}
def add(t, name):
    k = t.tobytes()
    if k not in seen:
        seen[k] = len(tiles); tiles.append(t); names[len(tiles) - 1] = name
    return seen[k]


def ramp(*arrs, keep_green=False):
    """the biome's own colours: unique opaque colours of the given real pieces, darkest first"""
    px = np.concatenate([a[a[..., 3] == 255][:, :3] for a in arrs])
    u = np.unique(px, axis=0)
    if not keep_green: u = u[~green(np.c_[u, np.full(len(u), 255)][None])[0]]
    return u[np.argsort(lum(u), kind='stable')]


def remap(a, rp):
    """green pixels of a become the ramp colours rank for rank (the n distinct greens, darkest first, spread over the ramp); every other pixel stays"""
    out, m = a.copy(), green(a)
    if not m.any(): return out
    gu = np.unique(a[m][:, :3], axis=0); gu = gu[np.argsort(lum(gu), kind='stable')]
    pick = np.round(np.linspace(0, len(rp) - 1, len(gu))).astype(int) if len(gu) > 1 else [len(rp) // 2]
    lut = {tuple(g): rp[p] for g, p in zip(gu.tolist(), pick)}
    for y, x in zip(*np.nonzero(m)): out[y, x, :3] = lut[tuple(a[y, x, :3].tolist())]
    return out


def ungrass(t, ground, extra=()):
    """grass pixels of an edge tile (green ones, plus the set's own fringe colours in `extra`) replaced by the ground tile's own pixels at the same spot"""
    out = t.copy(); m = green(t)
    for c in extra: m |= (t[..., :3] == c).all(-1) & (t[..., 3] > 0)
    out[m] = ground[m]; return out


M = TS['mats']; P = TS['props']
GC = {k: tile(first(M[n]['C'])) for k, n in dict(snow='snow', ash='ashGround', swamp='swamp', dune='duneSand', sand='sand', path='path', pave='pavingStone', water='water').items()}
KEYS = {'snow': 'snow', 'ashGround': 'ash', 'swamp': 'swamp', 'duneSand': 'dune', 'sand': 'sand', 'path': 'path', 'pavingStone': 'pave', 'water': 'water', 'waterDeep': 'water', 'sandWater': 'water', 'sandWaterDeep': 'water'}
LEAF = {'snow': rect(P['leafPlantFrost']), 'ash': rect(P['leafPlantGrey']), 'swamp': rect(P['leafPlantDark']), 'dune': rect(P['dryTuft']), 'sand': rect(P['dryTuft'])}
DRY = tile(first(M['dryGrass']['C']))
RAMP = {k: ramp(GC[k], LEAF[k], keep_green=k == 'swamp') for k in ('snow', 'ash', 'swamp', 'dune', 'sand')}
RAMP['dune'] = ramp(GC['dune'], LEAF['dune'], DRY); RAMP['sand'] = ramp(GC['sand'], LEAF['sand'], DRY)
GROUND = {'path': ('snow', 'ash', 'swamp', 'water'), 'sand': ('snow', 'ash', 'swamp'), 'duneSand': ('snow', 'ash', 'swamp'), 'boardwalk': ('water', 'sand', 'dune', 'snow', 'ash', 'swamp')}   # grounds an opaque set meets with an edge (sand, dune and path are one group: no edge between them)
pairs = []                                   # contact sheet rows: (label, [(src, dst), ...])
out_mats, out_props, out_cliff = {}, {}, {}

# ---- 1. opaque edge sets over each ground
FRINGE = {'duneSand': [(207, 204, 108), (189, 207, 106)]}         # the dune edge's grass is olive yellow, not green: the two colours only its edge tiles have
for nm, src in (('path', 'path'), ('sand', 'sand'), ('duneSand', 'duneSand'), ('boardwalk', 'boardwalk')):
    d = M[src]; own = {r: add(tile(first(d[r])), f'{src}:{r}') for r in ROLES}
    by = {}
    for g in GROUND[src]:
        by[g] = {r: add(ungrass(tile(first(d[r])), GC[g], FRINGE.get(src, ())), f'{src}+{g}Ground:{r}') for r in ROLES if r != 'C'}
        pairs.append((f'{src} -> {g} ground', [(tile(first(d[r])), tiles[by[g][r]]) for r in ROLES if r != 'C']))
    out_mats[nm] = dict(own, by=by, mode='nb')

# ---- 2a. grass def: the plain grass plus a base per ground (what an overlay edge is drawn over)
gl = M['grass']['C']
gby = {k: {'C': add(GC[k], f'{n}+base:C')} for k, n in dict(snow='snow', ash='ashGround', swamp='swamp', dune='duneSand', sand='sand', path='path', pave='pavingStone', water='water').items()}
out_mats['grass'] = dict(C=[add(tile(i), 'grass:C') for i in gl], by=gby, mode='base')
# ---- 2b. tall grass per ground: real frost, grey and dark leaf tiles; the leaf tile recoloured for sand and dune
tg = {k: tile(first(M[n]['C'])) for k, n in dict(snow='tallgrassFrost', ash='tallgrassGrey', swamp='tallgrassDark').items()}
tg0 = tile(first(M['tallgrass']['C'])); tgv = dict(snow='tallgrassFrost', ash='tallgrassGrey', swamp='tallgrassDark')
for k in ('sand', 'dune'): tg[k] = remap(tg0, RAMP[k]); tgv[k] = f'tallgrass+{k}Recolour'
out_mats['tallgrass'] = dict(C=add(tg0, 'tallgrass:C'), overlay=True, mode='self', by={k: {'C': add(t, tgv[k] + ':C')} for k, t in tg.items()})
pairs.append(('tallgrass -> ground', [(tg0, t) for t in tg.values()]))

# ---- 3. bushes and hedges
BUSH = ['bush', 'bushDark', 'bushOlive', 'roundBush', 'poplarBush', 'hedgeLong', 'hedgeLongB', 'hedgeLongC']
BIOMES = ('snow', 'sand', 'dune', 'ash', 'swamp')
art = []
for n in BUSH:
    row = []
    for k in BIOMES:
        a = remap(rect(P[n]), RAMP[k]); art.append((f'{n}~{k}', n, a)); row.append((rect(P[n]), a))
    pairs.append((n, row))
# ---- 4. cliff tops (rim pieces carry the grass of the plateau top)
CL = TS['cliff']; CLN = {'rimN': CL['rimN'], 'rimE': CL['rimE'], 'rimW': CL['rimW'], 'rimNE': CL['rimNE'], 'rimNW': CL['rimNW'], 'faceTopL': CL['faceTop']['L'], 'faceTopM': CL['faceTop']['M'], 'faceTopR': CL['faceTop']['R']}
for k in ('snow', 'sand', 'dune', 'ash', 'swamp'):
    out_cliff[k] = {n: add(remap(tile(i), RAMP[k]), f'{n}+{k}Recolour') for n, i in CLN.items()}
    pairs.append((f'cliff top -> {k}', [(tile(i), tiles[out_cliff[k][n]]) for n, i in CLN.items()]))

# ---- output sheet: tiles in 8 columns, props shelf-packed below
nrows = -(-len(tiles) // COLS); y, x, rh = nrows * T + 2, 0, 0
pl = []
for nm_, src_, a in art:
    h_, w_ = a.shape[:2]
    if x + w_ > PACK_W: x, y, rh = 0, y + rh + 2, 0
    pl.append((x, y, a)); p = dict(P[src_]); p.update(sx=x, sy=y); out_props[nm_] = {k: v for k, v in p.items() if k not in ('by',)}; x += w_ + 2; rh = max(rh, h_)
img = np.zeros((y + rh, PACK_W, 4), np.uint8)
for i, t in enumerate(tiles): r, c = divmod(i, COLS); img[r * T:(r + 1) * T, c * T:(c + 1) * T] = t
for px_, py_, a in pl: img[py_:py_ + a.shape[0], px_:px_ + a.shape[1]] = a
Image.fromarray(img, 'RGBA').save(ROOT / 'assets/adv/derived.png', optimize=True)
JOINS = {o: ['sand', 'duneSand', 'path', 'pavingStone', 'boardwalk'] for o in ('snow', 'ashGround', 'swamp')}
data = dict(file='assets/adv/derived.png', T=T, cols=COLS, base=BASE_ROW, keys=KEYS, mats=out_mats, props=out_props, cliff=out_cliff, joins=JOINS, names={str(k): v for k, v in names.items()})
(ROOT / 'data/adv').mkdir(exist_ok=True)
(ROOT / 'data/adv/tileset-derived.js').write_text('window.ADV_TILESET_DERIVED = ' + json.dumps(data, separators=(',', ':')) + ";\nif (typeof img === 'function') img(window.ADV_TILESET_DERIVED.file);   // start loading the sheet with the page (the scene preloads only the exterior one)\n")

# ---- contact sheet: source tile next to each derived tile, 4x
Z, G = 4, 6
rows = []
for label, prs in pairs:
    per = max(1, (2400 // ((max(s.shape[1] for s, _ in prs) + max(d_.shape[1] for _, d_ in prs)) * Z + G * 2)))
    for i in range(0, len(prs), per): rows.append((label if i == 0 else '', prs[i:i + per]))
W = 2440; ys_ = 18; layout = []
for label, prs in rows:
    rhh = max(max(s.shape[0], d_.shape[0]) for s, d_ in prs) * Z + 20; layout.append((ys_, rhh)); ys_ += rhh
sheet = Image.new('RGBA', (W, ys_ + 4), (70, 74, 86, 255)); dr = ImageDraw.Draw(sheet)
for (label, prs), (y0, rhh) in zip(rows, layout):
    dr.text((4, y0 + 2), label, fill=(255, 255, 255, 255)); x0 = 4
    for s, d_ in prs:
        for a in (s, d_):
            im = Image.fromarray(a, 'RGBA').resize((a.shape[1] * Z, a.shape[0] * Z), Image.NEAREST)
            bg = Image.new('RGBA', im.size, (200, 60, 200, 255)); bg.alpha_composite(im); sheet.paste(bg, (x0, y0 + 16)); x0 += im.size[0] + 2
        x0 += G
(ROOT / 'tools/.cache').mkdir(exist_ok=True)
sheet.convert('RGB').save(ROOT / 'tools/.cache/derived-contact.png')
print(len(tiles), 'derived tiles,', len(out_props), 'derived props, sheet', img.shape[1], 'x', img.shape[0], ', contact', sheet.size)
