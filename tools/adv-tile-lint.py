"""Tile and object QA lint (docs/TILE-QA.md section 2). Zero errors is the gate for every tile, prop, building or placement change.
Run: py -3.12 -I tools/adv-tile-lint.py [--all] [--no-world]       (--all prints every item instead of the first 25 per check, --no-world skips the 723 chunk files)

Checks (error = the run may not report done; warn = information, listed but not blocking)
  cutoff    a prop rect whose border pixels touch opaque pixels just outside it in the source sheet (the sprite continues past the rect)
  bleed     a prop rect holding a small separate blob that touches the rect edge (a piece of a neighbouring sprite)
  seam      every 13-role autotile set laid out as a 3x3 plus (and the four inner corners in their L shapes): each edge pair that must join is compared
            (mean colour of the two edge lines and opaque coverage), tiles with themselves too for the variant lists; unused mats only warn
  density   the art pixel size of every prop and mat (2x2 block uniformity at the best offset) must be 1 / density of its def or sheet, so one art pixel
            is the same number of world pixels everywhere (exterior 1x art outdoors = 2 world px, community 2x art at density 0.5 outdoors = 2, interior 2x art in rooms = 2)
  anchor    the anchor sits on the sprite's bottom edge inside its opaque base, the solid rect lies inside the sprite, on the ground row and overlaps the base
            (never the roof), a building's door point is on the sprite
  placement no solid prop on a road mat, stairs, ledge or bridge, none within one tile of a door (its own building excepted), no two solid rects overlap,
            every door front is free ground in the same walkable area as the spawn, room props exist and leave the spawn and the exit mat free
Exit code 1 when any error is found."""
import ast, json, re, runpy, sys, time
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / 'data/adv'
SHOW_ALL = '--all' in sys.argv
NO_WORLD = '--no-world' in sys.argv
ERR, WARN, STAT = [], [], {}
T0 = time.time()


def err(cat, item, msg): ERR.append((cat, item, msg))
def warn(cat, item, msg): WARN.append((cat, item, msg))
def stat(cat, n=1): STAT[cat] = STAT.get(cat, 0) + n


def lj(path):
    s = Path(path).read_text(encoding='utf8')
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


EX, IN = lj(D / 'tileset.js'), lj(D / 'tileset-int.js')
EXI = np.array(Image.open(ROOT / EX['file']).convert('RGBA'))
INI = np.array(Image.open(ROOT / IN['file']).convert('RGBA'))
SHEETS = {'ext': (EX, EXI, 1.0), 'int': (IN, INI, IN.get('density', 1.0))}
DVF = D / 'tileset-derived.js'
if DVF.exists():   # derived tiles (tools/adv-build-derived.py): its own sheet; every ground set is checked as a plain set of its own (the base roles with the by[ground] tiles laid over them)
    DV = lj(DVF); DVI = np.array(Image.open(ROOT / DV['file']).convert('RGBA')); dm = {}
    for n_, m_ in DV['mats'].items():
        own = {k: v for k, v in m_.items() if k not in ('by', 'mode')}
        if len(own) > 3: dm[n_] = own
        for g_, b_ in m_.get('by', {}).items(): dm[f'{n_}+{g_}'] = {**own, **b_}
    SHEETS['der'] = ({**DV, 'mats': dm}, DVI, 1.0)
    # the exterior sheet the derived one was made for must be the one in use
    if -(-EXI.shape[0] // 32) != DV['base']: ERR.append(('derived', 'tileset-derived.js', 'assets/adv/exterior.png changed since tools/adv-build-derived.py ran: rerun it'))
XP = {**EX['props'], **(SHEETS['der'][0]['props'] if 'der' in SHEETS else {})}
WORLD = lj(D / 'world.js')
RGF = D / 'tileset-region.js'
if RGF.exists():   # region pilot (tools/adv-region-export.py): its props are placed by the patched chunks and its baked-ground mats extend the palette at load, after the world's own
    _t = RGF.read_text(encoding='utf8'); RG = json.JSONDecoder().raw_decode(_t, _t.index('{'))[0]
    XP.update(RG['props']); WORLD['palette'] = WORLD['palette'] + [n for n in RG['mats'] if n not in WORLD['palette']]; WORLD['water'] = WORLD['water'] + ['rgWater']
USED_MATS = set(WORLD['palette'])
ROOMS = {}
for f in sorted((D / 'rooms').glob('*.js')):
    t = f.read_text(encoding='utf8'); m = re.search(r'ADV\.room\("([^"]+)",\s*(\{.*\})\);', t, re.S)
    ROOMS[m.group(1)] = json.loads(m.group(2))
for r in ROOMS.values(): USED_MATS |= set(r.get('pal', []))
if 'der' in SHEETS: USED_MATS |= set(SHEETS['der'][0]['mats'])


def tile(ts, img, i):
    r, c = divmod(i, ts['cols']); return img[r * 32:(r + 1) * 32, c * 32:(c + 1) * 32].astype(np.int16)


def first(v): return v[0] if isinstance(v, list) else v


# ---------------------------------------------------------------- art pixel size
def block_stats(a):
    """(best, worst) share of aligned 2x2 blocks that are one flat RGBA colour, over the four offsets; None when too small"""
    r = []
    for oy in (0, 1):
        for ox in (0, 1):
            s = a[oy:, ox:]; h2, w2 = s.shape[0] // 2 * 2, s.shape[1] // 2 * 2
            if h2 < 4 or w2 < 4: return None
            b = s[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 4).transpose(0, 2, 1, 3, 4).reshape(h2 // 2, w2 // 2, 4, 4)
            eq = (b == b[:, :, :1]).all(axis=(2, 3)); has = (b[..., 3] > 0).any(-1)
            r.append(float(eq[has].mean()) if has.any() else 1.0)
    return max(r), min(r)


def art_k(a):
    """art pixel size in sheet px: 2 for 2x art, 1 for 1x, None when the pixels are too flat to tell"""
    st = block_stats(a)
    if st is None or st[1] >= .97: return None
    return 2 if st[0] >= .9 else 1


# ---------------------------------------------------------------- 1. props: anchors, solids, doors, art pixel size
def check_props():
    for tag, (ts, img, sd) in SHEETS.items():
        for name, d in ts['props'].items():
            stat('props')
            it = f'{tag}:{name}'; sx, sy, sw, sh = d['sx'], d['sy'], d['sw'], d['sh']
            if sx < 0 or sy < 0 or sx + sw > img.shape[1] or sy + sh > img.shape[0]: err('anchor', it, 'rect outside the sheet'); continue
            a = img[sy:sy + sh, sx:sx + sw].astype(np.int16); op = a[..., 3] >= 128
            if not op.any(): err('anchor', it, 'rect holds no opaque pixel'); continue
            dens = d.get('density') or sd; k = max(1, int(round(1 / dens)))
            ax, ay = d['ax'], d['ay']
            rows = np.where(op.any(1))[0]; low = int(rows[-1])
            # density: art pixel size against the def (sheet px per art px = 1 / density)
            ak = art_k(a)
            if ak is not None and ak != k: err('density', it, f'art pixel is {ak} sheet px but the def (density {dens}) draws {k}: mixed pixel size')
            stat('density')
            # anchor: on the bottom edge, between the outer pixels of the base (floor mats sort by their top edge and have no anchor rule)
            if d.get('kind') == 'mat': continue
            if not (0 <= ax <= sw and 0 < ay <= sh): err('anchor', it, f'anchor ({ax},{ay}) outside the {sw}x{sh} sprite'); continue
            if abs((ay - 1) - low) > 2 * k: err('anchor', it, f'anchor row {ay - 1} is {abs((ay - 1) - low)} px from the sprite bottom row {low}')
            base = np.where(op[max(0, low - 3 * k + 1):low + 1].any(0))[0]
            if not (base.min() - k <= ax <= base.max() + k): err('anchor', it, f'anchor x {ax} is outside the base span {base.min()}..{base.max()}')
            s = d.get('solid')
            if s:
                x0, y0, x1, y1 = ax + s[0], ay + s[1], ax + s[2], ay + s[3]
                if x0 < -k or x1 > sw + k or y0 < 0 or y1 > sh + 2 * k: err('anchor', it, f'solid rect {s} leaves the {sw}x{sh} sprite')
                if y1 < low - 2 * k or y1 > low + 1 + 3 * k: err('anchor', it, f'solid bottom {y1} is not on the ground row (sprite bottom {low})')
                if tag == 'ext' and sh >= 40 * k and y0 < sh * .4: err('anchor', it, f'solid rect starts at {y0} of {sh}: it covers the roof')
                lo = op[max(0, y0 - 3 * k):min(sh, y1 + 3 * k)]   # the footprint: opaque columns of the sprite's lowest rows (legs and posts leave gaps, the rect between them is still the footprint)
                cols_ = np.where(lo.any(0))[0]
                if not len(cols_) or x1 < cols_.min() + 1 or x0 > cols_.max(): err('anchor', it, f'solid rect {s} does not overlap the sprite footprint')
            if d.get('door'):
                dx, dy = d['door']; px = ax + dx
                if not (0 <= px < sw) or not op[int(sh * .4):, px].any(): err('anchor', it, f'door point x {px} is not on the building (no opaque pixel in the lower part of that column)')


# ---------------------------------------------------------------- 2. cut-off and bleed
def leak(inside_mask, ring_mask):
    """count ring pixels (opaque outside the rect) that touch an opaque pixel on the rect border: the sprite continues outside"""
    h, w = inside_mask.shape
    big = np.zeros((h + 2, w + 2), bool); big[1:-1, 1:-1] = inside_mask
    border = np.zeros_like(big); border[1:-1, 1:-1] = True; border[2:-2, 2:-2] = False
    edge = big & border
    return int((ndi.binary_dilation(edge, ndi.generate_binary_structure(2, 1)) & ring_mask & ~np.pad(np.ones((h, w), bool), 1)).sum())


def strays(op):
    """small blobs touching the rect edge, separate from the main sprite even after a 2 px dilation (pieces of a neighbouring sprite)"""
    if op.sum() < 40: return []
    lab, n = ndi.label(ndi.binary_dilation(op, np.ones((3, 3), bool), iterations=2), np.ones((3, 3)))
    cnt = ndi.sum(op, lab, range(1, n + 1)); main = int(np.argmax(cnt)) + 1; out = []
    for i in range(1, n + 1):
        if i == main: continue
        m = op & (lab == i)
        if m.sum() < 3: continue
        ys, xs = np.nonzero(m)
        if ys.min() == 0 or xs.min() == 0 or ys.max() == op.shape[0] - 1 or xs.max() == op.shape[1] - 1:
            if m.sum() < cnt[main - 1] * .15: out.append((int(xs.min()), int(ys.min()), int(m.sum())))
    return out


def ring_of(img, x, y, w, h):
    """alpha >= 200 mask of the rect plus a 1 px ring (clipped to the sheet)"""
    big = np.zeros((h + 2, w + 2), bool)
    ys, xs, ye, xe = max(0, y - 1), max(0, x - 1), min(img.shape[0], y + h + 1), min(img.shape[1], x + w + 1)
    big[ys - (y - 1):ye - (y - 1), xs - (x - 1):xe - (x - 1)] = img[ys:ye, xs:xe, 3] >= 200
    return big


def main_box(a, gap=2):
    """the same trim adv-build-interior.py applies: the widest opaque column run and inside it the tallest row run (runs split by more than `gap` empty lines)"""
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


def literal(tree, name):
    return next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', '') == name)


# Sprites in these sheets sit flush against their neighbours (fence strips, rows of bushes, houses side by side), so "art continues past the rect edge" cannot always be told
# from "another sprite touches it". These contacts were looked at by eye (4x views with the touching pixels marked) and are neighbours, the sprites are whole. The number is the
# most contact pixels accepted for that sprite (palette variants share the base name); more contact than that, or a name not listed, is an error again.
REVIEWED = {'int:plantB': 13, 'int:plantC': 10, 'int:binTeal': 18, 'int:winWide': 60, 'int:winStained': 16,
            'comm:mBush': 8, 'comm:mFir': 8, 'comm:mHedgeTall': 12, 'comm:mHedgeLong': 30, 'comm:mHedgeRound': 36, 'comm:mRound': 24, 'comm:mFlowerBush': 8, 'comm:mScarecrow': 44,
            'comm:mPicketFence': 40, 'comm:mWoodFence': 48, 'comm:mRoseHall': 56, 'comm:mMintHall': 56, 'comm:wOakLight': 40, 'comm:wOakDark': 4, 'comm:wBushLeaf': 16,
            'comm:wLogFence': 32, 'comm:wLogPost': 8, 'comm:wHouseTeal': 86, 'comm:wHouseGrey': 66, 'comm:jPineA': 12, 'comm:jPineB': 12, 'comm:jRocksMoss': 6, 'comm:maFountain': 92}


# Sprites whose art ends exactly at the right or bottom edge of a 256 px source sheet and are whole there (a dark outline closes them), looked at by eye. Anything else touching that edge may be cut by the sheet itself.
SHEET_EDGE_OK = {'comm:sSilverWarehouse', 'comm:wSignBoard', 'comm:wHouseGrey', 'comm:maSailboat', 'comm:maHayBales', 'comm:maBoulderMoss'}


def contact_ok(item, n):
    base = re.sub(r'(Green|Teal|Stone|Amber|Pink|Rust|Brown|Red|Blue)$', '', item)
    return n <= max(1, REVIEWED.get(item, REVIEWED.get(base, 1)))


def check_cutoff():
    # exterior sheet, original Chaotic sprites: they sit at their real sheet coordinates, so the packed sheet shows what is around them
    for name, d in EX['props'].items():
        stat('cutoff')
        big = ring_of(EXI, d['sx'], d['sy'], d['sw'], d['sh']); ins = big[1:-1, 1:-1]
        n = leak(ins, big)
        if not contact_ok(f'ext:{name}', n): err('cutoff', f'ext:{name}', f'{n} opaque pixels just outside the rect touch the sprite border: the sprite continues past the rect')
        for x, y, c in strays(ins): err('bleed', f'ext:{name}', f'a {c} px blob at ({x},{y}) touches the rect edge: part of a neighbouring sprite')
    # interior sprites: cut from the Silver Gallium interior sheet by rough rects, the builder trims each to its main sprite; check the trimmed box against that source
    src = ast.parse((ROOT / 'tools/adv-build-interior.py').read_text(encoding='utf8')); props, gaps = literal(src, 'PROPS'), literal(src, 'GAPS'); sp = Path(literal(src, 'SRC'))
    if sp.exists():
        sheet = np.array(Image.open(sp).convert('RGBA'))
        for name, kind, rx, ry, rw, rh in props:
            stat('cutoff')
            sub = sheet[ry:ry + rh, rx:rx + rw, 3]
            if not (sub > 0).any(): err('cutoff', f'int:{name}', 'rect holds nothing'); continue
            x0, x1, y0, y1 = main_box(sub, gaps.get(name, 2)); a = sub.copy(); a[:y0] = 0; a[y1:] = 0; a[:, :x0] = 0; a[:, x1:] = 0
            op = a >= 128; lab, nl = ndi.label(ndi.binary_dilation(op, np.ones((3, 3), bool), iterations=2), np.ones((3, 3)))   # the builder also drops the small blobs touching the trim edge
            cnt = ndi.sum(op, lab, range(1, nl + 1)); main = int(np.argmax(cnt)) + 1
            for i in range(1, nl + 1):
                m = op & (lab == i); ys, xs = np.nonzero(m)
                if i != main and (ys.min() == y0 or xs.min() == x0 or ys.max() == y1 - 1 or xs.max() == x1 - 1) and m.sum() < cnt[main - 1] * .15: op &= ~m
            big = ring_of(sheet, rx, ry, rw, rh); n = leak(op, big)   # the rect only cuts the sprite if the cleaned sprite reaches the rect edge and more art continues there
            if not contact_ok(f'int:{name}', n): err('cutoff', f'int:{name}', f'{n} opaque pixels beyond the rect edge continue the sprite: the rect cuts it, grow or move the rect')
    else:
        warn('cutoff', 'interior', f'source sheet {sp} not found, interior cut-off check skipped')
    # community sprites: the catalogue rects on the source sheets, cleaned by the builder's own finish(); the cleaned sprite's tight box in the source must not touch more art
    B = runpy.run_path(str(ROOT / 'tools/adv-build-community.py'))
    cat = runpy.run_path(str(ROOT / 'tools/adv-community-items.py'))['CATALOG']
    for it in cat:
        if 'parts' in it: continue
        stat('cutoff'); key = it['sheet']; x, y, w, h = it['rect']; sheet = B['sheet'](key); r = B['raw'](key, x, y, w, h); sh = it.get('sh')
        if sh == 'auto': sh = B['auto_shadow'](B['finish'](r.copy(), key, [], it.get('clr'), it.get('ex'), (x, y))[0])
        a, (ox, oy) = B['finish'](r.copy(), key, sh, it.get('clr'), it.get('ex'), (x, y)); th, tw = a.shape[:2]
        canvas = np.zeros((h, w), bool); canvas[oy:oy + th, ox:ox + tw] = a[..., 3] >= 200; big = ring_of(sheet, x, y, w, h)
        cols = [tuple(c) for c in (B['SHADOW'].get(key, []) if sh is None else sh)] + [tuple(c) for c in (it.get('clr') or [])]
        kept = np.zeros((h, w), bool); kept[oy:oy + th, ox:ox + tw] = a[..., 3] > 0
        cols += [tuple(c) for c in np.unique(r[(r[..., 3] > 0) & ~kept][:, :3], axis=0)]   # every colour the builder removed from this rect (shadows, ground, neighbours) is not part of the sprite
        ys, xs, ye, xe = max(0, y - 1), max(0, x - 1), min(sheet.shape[0], y + h + 1), min(sheet.shape[1], x + w + 1)
        rgb = sheet[ys:ye, xs:xe, :3].reshape(-1, 3); skip = np.isin(rgb.astype(np.int32) @ np.array([65536, 256, 1]), [int(c[0]) * 65536 + int(c[1]) * 256 + int(c[2]) for c in cols]).reshape(ye - ys, xe - xs)
        hit = np.zeros_like(big); hit[ys - (y - 1):ye - (y - 1), xs - (x - 1):xe - (x - 1)] = skip; big &= ~hit
        n = leak(canvas, big)
        if f"comm:{it['name']}" not in SHEET_EDGE_OK and ((x + w >= sheet.shape[1] and canvas[:, -1].any()) or (y + h >= sheet.shape[0] and canvas[-1].any())): err('cutoff', f"comm:{it['name']}", 'the sprite reaches the right or bottom edge of its source sheet: the art may run off the sheet (clipped), drop it unless it is whole')
        if not contact_ok(f"comm:{it['name']}", n): err('cutoff', f"comm:{it['name']}", f'{n} opaque source pixels beyond the catalogue rect edge continue the sprite: the rect cuts it, grow or move the rect')
        for sx_, sy_, c in strays(a[..., 3] >= 200): err('bleed', f"comm:{it['name']}", f'a {c} px blob at ({sx_},{sy_}) touches the sprite edge: part of a neighbouring sprite')


# Sprites that are deliberately several pieces (pairs, scattered small bits, a stump above a cluster), looked at by eye. Palette variants share the base name.
FRAGMENT_OK = {'ext:sprout', 'ext:stonesPair', 'ext:woodGate', 'ext:grassBlades', 'ext:bubbles', 'ext:pebbles', 'ext:twigs', 'ext:mushroomsOrangeB', 'ext:mushroomsRed',   # scattered small bits and pairs
               'ext:mangroveTree', 'ext:maFountain',                                                   # one or two root tip / leaf pixels inside the art
               'ext:mushroomStump', 'ext:stoneTerraceBlock', 'ext:stoneGateStack', 'ext:fencePenWood',   # original Silver Gallium tiles built from stacked or paired pieces
               'ext:mSunflowers', 'ext:jRocks', 'ext:jRocksMoss', 'ext:wLogFence', 'ext:mPicketFence', 'ext:mWoodFence',                      # clumps and rows of the same object
               'int:armchairBlue', 'int:mapIsland', 'int:pebbles2x', 'int:mushroomsRed2x', 'int:mushroomStump2x'}   # the 2x copies of the above, a pair of chairs, poster plus frame


def fragments(op):
    """detached opaque pieces of a sprite rect (8-connected, alpha >= 128) other than the biggest, that touch the rect edge or hold under 3 percent of the opaque pixels: [(x, y, px, touches_edge)]"""
    lab, n = ndi.label(op, np.ones((3, 3)))
    if n < 2: return []
    cnt = np.bincount(lab.ravel())[1:]; main = int(np.argmax(cnt)) + 1; tot = int(cnt.sum()); h, w = op.shape; out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if i == main: continue
        ys, xs = sl; edge = ys.start == 0 or xs.start == 0 or ys.stop == h or xs.stop == w
        if edge or cnt[i - 1] < .03 * tot: out.append((xs.start, ys.start, int(cnt[i - 1]), edge))
    return out


def check_fragments():
    """every prop of both sheets as it ships: a second piece that touches the rect edge or is tiny is a neighbour's leftovers (a berry beside a log, a roof bar over a house) unless the sprite is listed in FRAGMENT_OK"""
    for tag, (ts, img, sd) in SHEETS.items():
        for name, d in ts['props'].items():
            stat('fragments'); it = f'{tag}:{name}'
            fr = fragments(img[d['sy']:d['sy'] + d['sh'], d['sx']:d['sx'] + d['sw'], 3] >= 128)
            if fr and not (it in FRAGMENT_OK or re.sub(r'(Green|Teal|Stone|Amber|Pink|Rust|Brown|Red|Blue)$', '', it) in FRAGMENT_OK):
                err('bleed', it, f'{len(fr)} detached piece(s), first {fr[0][2]} px at ({fr[0][0]},{fr[0][1]})' + (' touching the rect edge' if fr[0][3] else ' (tiny)') + ': a neighbouring sprite or a speck, tighten the rect or add an ex box')


# ---------------------------------------------------------------- 3. autotile seams and mat pixel size
SIDE = {'l': lambda x: x[:, 0], 'r': lambda x: x[:, -1], 't': lambda x: x[0, :], 'b': lambda x: x[-1, :]}
JOINS = [('NW', 'r', 'N', 'l'), ('N', 'r', 'NE', 'l'), ('W', 'r', 'C', 'l'), ('C', 'r', 'E', 'l'), ('SW', 'r', 'S', 'l'), ('S', 'r', 'SE', 'l'),
         ('NW', 'b', 'W', 't'), ('N', 'b', 'C', 't'), ('NE', 'b', 'E', 't'), ('W', 'b', 'SW', 't'), ('C', 'b', 'S', 't'), ('E', 'b', 'SE', 't'),
         ('E', 'b', 'iNE', 't'), ('iNE', 'r', 'N', 'l'), ('C', 'r', 'iNE', 'l'), ('iNE', 'b', 'C', 't'),
         ('W', 'b', 'iNW', 't'), ('N', 'r', 'iNW', 'l'), ('iNW', 'r', 'C', 'l'), ('iNW', 'b', 'C', 't'),
         ('iSE', 'b', 'E', 't'), ('iSE', 'r', 'S', 'l'), ('C', 'r', 'iSE', 'l'), ('C', 'b', 'iSE', 't'),
         ('iSW', 'b', 'W', 't'), ('S', 'r', 'iSW', 'l'), ('iSW', 'r', 'C', 'l'), ('C', 'b', 'iSW', 't')]
MEAN_MAX, COVER_MAX = 14.0, .25


def join_err(a, b):
    """why two touching edge lines (32 x RGBA) do not join, or None"""
    ao, bo = a[:, 3] >= 128, b[:, 3] >= 128
    cov = abs(float(ao.mean()) - float(bo.mean()))
    if cov > COVER_MAX: return f'opaque coverage differs by {cov:.2f}'
    if ao.any() and bo.any():
        mc = float(np.abs(a[ao, :3].mean(0) - b[bo, :3].mean(0)).mean())
        if mc > MEAN_MAX: return f'mean colour differs by {mc:.1f}'
    return None


def check_mats():
    for tag, (ts, img, sd) in SHEETS.items():
        for name, m in ts['mats'].items():
            stat('mats'); used = name in USED_MATS; rep = err if used else warn; it = f'{tag}:{name}' + ('' if used else ' (unused)')
            ids = {k: v for k, v in m.items() if k != 'overlay' and not isinstance(v, bool)}
            tiles = {k: [tile(ts, img, i) for i in (v if isinstance(v, list) else [v])] for k, v in ids.items()}
            if 'N' in tiles:
                t = {k: v[0] for k, v in tiles.items()}
                for a, sa, b, sb in JOINS:
                    stat('seams'); why = join_err(SIDE[sa](t[a]), SIDE[sb](t[b]))
                    if why: rep('seam', it, f'{a}.{sa} | {b}.{sb}: {why}')
            if 'C' in tiles and not m.get('overlay'):   # variants of the centre tile are picked at random: they must join each other and themselves (overlay sprites like tall grass are not seamless by design)
                cs = tiles['C']; wall = tag == 'int' and name.endswith(('_wallT', '_wallB', '_dark'))   # walls only repeat sideways
                for i, p in enumerate(cs):
                    for j, q in enumerate(cs):
                        if i > j or (len(cs) > 4 and (i > 3 or j > 3)): continue
                        for s1, s2 in ((('r', 'l'),) if wall else (('r', 'l'), ('b', 't'))):
                            stat('seams'); why = join_err(SIDE[s1](p), SIDE[s2](q))
                            if why: rep('seam', it, f'C variant {i} {s1} | variant {j} {s2}: {why}')
            # pixel size of the mat's tiles
            want = max(1, int(round(1 / sd)))
            for k, v in tiles.items():
                for q in v:
                    ak = art_k(q)
                    if ak is not None and ak != want: rep('density', it, f'tile {k}: art pixel is {ak} sheet px but the sheet draws {want}'); break
                else: continue
                break


# ---------------------------------------------------------------- 4. placement
def unrle(s):
    out = []
    for tok in s.split(','):
        if 'x' in tok: v, n = tok.split('x'); out.extend([int(v)] * int(n))
        else: out.append(int(tok))
    return np.array(out, np.int16)


def load_chunks():
    CW, CH_, CH = WORLD['chunksW'], WORLD['chunksH'], 32
    H, W = CH_ * CH, CW * CH; pal = WORLD['palette']
    MAT = np.full((H, W), pal.index(WORLD['fill']), np.int16); KIND = np.zeros((H, W), np.int16); HT = np.zeros((H, W), np.int16); props = []
    for f in (D / 'chunks').glob('*.js'):
        t = f.read_text(encoding='utf8'); m = re.match(r'ADV\.chunk\((\d+),(\d+),\{(.*)\}\);\s*$', t, re.S); cx, cy, body = int(m.group(1)), int(m.group(2)), m.group(3)
        for arr, k in ((MAT, 'mat'), (KIND, 'kind'), (HT, 'h')):
            mm = re.search(k + r':"([^"]*)"', body)
            if mm: arr[cy * CH:(cy + 1) * CH, cx * CH:(cx + 1) * CH] = unrle(mm.group(1)).reshape(CH, CH)
        props.extend(json.loads(body[body.index('props:') + 6:]))
    return MAT, KIND, HT, props


BARRIER = re.compile(r'^(hedge|.*[Ff]ence)')


def solid_rect(p):
    d = XP.get(p[0])
    if not d or not d.get('solid'): return None
    k = d.get('density') or 1; s = d['solid']
    return (p[1] + s[0] * k, p[2] + s[1] * k, p[1] + s[2] * k, p[2] + s[3] * k)


def check_placement():
    pal = WORLD['palette']; MAT, KIND, HT, props = load_chunks(); Hh, Ww = MAT.shape
    road = np.isin(MAT, [pal.index(n) for n in ('path', 'pavingStone', 'boardwalk', 'rgPath') if n in pal])
    water = np.isin(MAT, [pal.index(n) for n in WORLD['water']])
    unknown = sorted({p[0] for p in props if p[0] not in XP})
    for n in unknown: err('placement', n, 'placed in the world but not in the exterior sheet')
    solids = []
    for p in props:
        r = solid_rect(p)
        if r: solids.append((r, p))
    stat('placement', len(props))
    doors = [(d['x'], d['y'], d['room']) for d in WORLD['doors']]   # world.js holds data px, the engine doubles them on load
    doors += [((b['fx'] + dx + .5) * 32, (b['fy'] + b['d']) * 32 - 7, b['id']) for b in WORLD.get('buildings', []) for dx, _ in b['interior']['exits']]   # S2: a building's exit is a door too (the tile in front of it, below the footprint)
    # solid props must not cut a road in two (the road stays open: street furniture and stalls beside it are fine), nor stand on stairs, ledges or bridges
    cnt = np.zeros((Hh, Ww), np.int16)
    def cells(r):
        x0, y0, x1, y1 = r; return int(np.ceil(x0 / 32 - .5)), int(np.floor(x1 / 32 - .5)), int(np.ceil(y0 / 32 - .5)), int(np.floor(y1 / 32 - .5))
    for r, p in solids:
        c0, c1, r0, r1 = cells(r)
        if c0 <= c1 and r0 <= r1: cnt[max(0, r0):r1 + 1, max(0, c0):c1 + 1] += 1
    def pieces(mask):
        lab, n = ndi.label(mask); out = 0
        for i in range(1, n + 1):
            m = lab == i
            if m.sum() >= 4 and (m[0].any() or m[-1].any() or m[:, 0].any() or m[:, -1].any()): out += 1
        return out
    for (x0, y0, x1, y1), p in solids:
        c0, c1, r0, r1 = int(x0 // 32), int((x1 - 1e-6) // 32), int(y0 // 32), int((y1 - 1e-6) // 32)
        if c0 < 0 or r0 < 0 or c1 >= Ww or r1 >= Hh: err('placement', f'{p[0]}@{p[1]},{p[2]}', 'outside the world'); continue
        kd = KIND[r0:r1 + 1, c0:c1 + 1]
        if (kd > 0).any(): err('placement', f'{p[0]}@{p[1]},{p[2]}', 'solid rect stands on stairs, a ledge or a bridge'); continue
        if not road[r0:r1 + 1, c0:c1 + 1].any(): continue
        a0, a1, b0, b1 = max(0, r0 - 12), min(Hh, r1 + 13), max(0, c0 - 12), min(Ww, c1 + 13)
        k0, k1, m0, m1 = cells((x0, y0, x1, y1)); mine = np.zeros((a1 - a0, b1 - b0), np.int16)
        if k0 <= k1 and m0 <= m1: mine[max(0, m0 - a0):m1 - a0 + 1, max(0, k0 - b0):k1 - b0 + 1] = 1
        win = road[a0:a1, b0:b1]; with_ = win & (cnt[a0:a1, b0:b1] == 0); without = win & (cnt[a0:a1, b0:b1] - mine == 0)
        if pieces(with_) > pieces(without): err('placement', f'{p[0]}@{p[1]},{p[2]}', f'solid rect cuts the road in two (tile {c0},{r0})')
    # within one tile of a door (the door's own building excepted)
    dxy = np.array([[d[0], d[1]] for d in doors]) if doors else np.zeros((0, 2))
    owner = set()   # the building (or cave mouth) whose own solid rect holds the door point
    for i, ((x0, y0, x1, y1), p) in enumerate(solids):
        if len(dxy) and ((dxy[:, 0] > x0 - 4) & (dxy[:, 0] < x1 + 4) & (dxy[:, 1] > y0 - 4) & (dxy[:, 1] < y1 + 4)).any(): owner.add(i)
        dd = XP[p[0]]
        if dd.get('door') and len(dxy):
            k = dd.get('density') or 1; px, py = p[1] + dd['door'][0] * k, p[2] + dd['door'][1] * k   # or the building whose own door point is this door
            if ((np.abs(dxy[:, 0] - px) < 10) & (np.abs(dxy[:, 1] - py) < 10)).any(): owner.add(i)
    for i, ((x0, y0, x1, y1), p) in enumerate(solids):
        if i in owner or not len(dxy): continue
        near = (dxy[:, 0] > x0 - 32) & (dxy[:, 0] < x1 + 32) & (dxy[:, 1] > y0 - 32) & (dxy[:, 1] < y1 + 32)
        for j in np.where(near)[0]: err('placement', f'{p[0]}@{p[1]},{p[2]}', f'solid rect within 1 tile of the door of {doors[j][2]}')
    # no two solid rects overlap
    grid = {}
    for i, ((x0, y0, x1, y1), p) in enumerate(solids):
        for gx in range(int(x0 // 128), int(x1 // 128) + 1):
            for gy in range(int(y0 // 128), int(y1 // 128) + 1): grid.setdefault((gx, gy), []).append(i)
    seen = set()
    for lst in grid.values():
        for ii, a in enumerate(lst):
            ra = solids[a][0]
            for b in lst[ii + 1:]:
                if (a, b) in seen: continue
                rb = solids[b][0]; ow = min(ra[2], rb[2]) - max(ra[0], rb[0]); oh = min(ra[3], rb[3]) - max(ra[1], rb[1])
                if ow > 2 and oh > 2:
                    seen.add((a, b)); pa, pb = solids[a][1], solids[b][1]
                    if BARRIER.match(pa[0]) and BARRIER.match(pb[0]): continue   # hedge and fence segments overlap on purpose: nothing slips through
                    err('placement', f'{pa[0]}@{pa[1]},{pa[2]}', f'solid rect overlaps {pb[0]}@{pb[1]},{pb[2]} by {ow:.0f}x{oh:.0f} px')
    # doors reachable: 4-neighbour walkable graph from the spawn (water blocks unless it is a bridge deck, a height step needs stairs)
    blocked = water & (KIND != 8)
    for (x0, y0, x1, y1), p in solids:
        c0, c1, r0, r1 = int(np.ceil(x0 / 32 - .5)), int(np.floor(x1 / 32 - .5)), int(np.ceil(y0 / 32 - .5)), int(np.floor(y1 / 32 - .5))
        if c0 <= c1 and r0 <= r1: blocked[max(0, r0):r1 + 1, max(0, c0):c1 + 1] = True
    walk = ~blocked; idx = np.arange(Hh * Ww).reshape(Hh, Ww)
    def edges(a, b, ka, kb, ha, hb, wa, wb):
        ok = wa & wb & ((ha == hb) | ((np.abs(ha - hb) == 1) & ((ka > 0) | (kb > 0))))
        return a[ok], b[ok]
    ra, rb = edges(idx[:, :-1], idx[:, 1:], KIND[:, :-1], KIND[:, 1:], HT[:, :-1], HT[:, 1:], walk[:, :-1], walk[:, 1:])
    da, db = edges(idx[:-1], idx[1:], KIND[:-1], KIND[1:], HT[:-1], HT[1:], walk[:-1], walk[1:])
    ea, eb = np.concatenate([ra, da]), np.concatenate([rb, db])
    _, lab = connected_components(coo_matrix((np.ones(len(ea), np.int8), (ea, eb)), shape=(Hh * Ww,) * 2), directed=False)
    lab = lab.reshape(Hh, Ww); sp = WORLD['spawn']; sc, sr = int(sp['x'] // 32), int(sp['y'] // 32); home = lab[sr, sc]
    if not walk[sr, sc]: err('placement', 'spawn', 'the spawn tile is blocked')
    for x, y, room in doors:
        c, r = int(x // 32), int((y + 15) // 32)
        stat('doors')
        if not walk[r, c]: err('placement', f'door {room}', f'the tile in front of the door ({c},{r}) is blocked by water or a solid prop')
        elif lab[r, c] != home: err('placement', f'door {room}', f'the door front ({c},{r}) is not connected to the spawn by walkable ground')


def check_rooms():
    for rid, r in ROOMS.items():
        stat('rooms')
        sp, ex_ = r.get('spawn'), r.get('exit')
        rects = []
        for p in r.get('props', []):
            d = XP.get(p[0]) or IN['props'].get(p[0])
            if not d: err('placement', f'room {rid}', f'prop {p[0]} is in no sheet'); continue
            if d.get('solid'): s = d['solid']; rects.append((p[1] + s[0], p[2] + s[1], p[1] + s[2], p[2] + s[3], p[0]))
            sheet_ = 'ext' if p[0] in XP else 'int'
            if sheet_ == 'ext' and (d.get('density') or 1) == 1:
                ak = art_k(EXI[d['sy']:d['sy'] + d['sh'], d['sx']:d['sx'] + d['sw']].astype(np.int16))
                if ak == 1: err('density', f'room {rid}', f'{p[0]} is 1x exterior art in a room: rooms draw the 2x interior sheet 1:1, so its art pixel is half the size of the furniture')
        if sp:
            for x0, y0, x1, y1, n in rects:
                if x0 < sp['x'] < x1 and y0 < sp['y'] < y1: err('placement', f'room {rid}', f'{n} stands on the spawn point')
        if ex_:
            ex0, ex1, ey = ex_['c0'] * 32, (ex_['c1'] + 1) * 32, ex_['r'] * 32
            for x0, y0, x1, y1, n in rects:
                if x0 < ex1 and x1 > ex0 and y0 < ey + 32 and y1 > ey - 8: err('placement', f'room {rid}', f'{n} blocks the exit mat')


# ---------------------------------------------------------------- 5. gyms are the biggest building of their town
def check_gyms():
    for code in ('G6', 'G7', 'G8'):
        j = json.loads((ROOT / f'tools/adv-towns/{code}.json').read_text(encoding='utf8')); area = lambda n: XP[n]['sw'] * XP[n]['sh'] * (XP[n].get('density') or 1) ** 2
        fp = lambda b: b[4]['w'] * b[4]['d'] if len(b) > 4 else area(b[0])   # S2 buildings: the footprint in tiles; the others: the sprite
        gid = code.lower() + '-gym'; g = next(b for b in j['buildings'] if b[3] == gid)
        big = max(fp(b) for b in j['buildings'] if b[3] != gid)
        stat('gyms')
        if fp(g) < big * 1.2: err('placement', f'{code} gym {g[0]}', f'footprint {fp(g):.0f} is not clearly bigger than the largest other building ({big:.0f})')


def main():
    steps = [('props', check_props), ('cut-off and bleed', check_cutoff), ('detached pieces', check_fragments), ('mats and seams', check_mats), ('rooms', check_rooms), ('gyms', check_gyms)]
    if not NO_WORLD: steps.append(('world placement', check_placement))
    for name, fn in steps:
        t = time.time(); n0 = len(ERR); fn(); print(f'[{time.time() - t:5.1f}s] {name}: {len(ERR) - n0} errors')
    cats = {}
    for c, i, m in ERR: cats.setdefault(c, []).append((i, m))
    for c, lst in cats.items():
        print(f'\nERROR {c} ({len(lst)})')
        for i, m in (lst if SHOW_ALL else lst[:25]): print(f'  {i}: {m}')
        if not SHOW_ALL and len(lst) > 25: print(f'  ... {len(lst) - 25} more (run with --all)')
    if WARN:
        wc = {}
        for c, i, m in WARN: wc.setdefault(c, []).append((i, m))
        for c, lst in wc.items():
            print(f'\nWARN {c} ({len(lst)})')
            for i, m in (lst if SHOW_ALL else lst[:8]): print(f'  {i}: {m}')
    print(f'\nchecked {STAT}')
    print(f'{len(ERR)} errors, {len(WARN)} warnings in {time.time() - T0:.1f}s')
    sys.exit(1 if ERR else 0)


main()
