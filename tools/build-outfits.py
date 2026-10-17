"""Builds the player character creator (docs/OUTFITS.md, P2) from the Pokemon Ranger rips (tools/.cache/ranger, cut by tools/ranger-cut.py).

Every Ranger NPC frame sits in a native 16x32 (step frames 24x32) slot on the rip, drawn on one shared template: heads, torsos, arms and legs land on the
same pixels in every character's slot for the same frame. So parts are lifted and composed in slot space, pixel exact, then each composed slot is placed
in the player's sheet exactly where ranger-cut.py pack places the body's own frame (head alignment, 1 px step lift, mirror2 front/back steps).

Parts: body = the face (skin, eyes, face lines) of a family character (the five npc1 walkers share one frame table); hair = another character's hair
over the body's face, with the donor's own face filling only where the body's old hair is gone; top = torso + arms + hands; bot = legs + shoes (+ skirt);
hat = a cap over the hair (the hair above its brim is cut by its cover plane). Hair and hat donors outside the family are rigid: only their five stand
frames exist, moved with the body's face. Each hair and hat also carries a ring (the donor's own pixels round the part) drawn under everything, which
only shows in gaps. No bags: no walker wears one, and a stand-only bag would cover the swinging near arm.
Colours: each part's ramp colours become white planes per ramp step (filled with source-in at runtime); outline, eyes, shoes and trims keep their
source colours. Exact source pixels only: nothing is resampled, filtered, palette-snapped or redrawn.
Labels are rule based (tools/outfit_specs.py cand/ramp) plus hand fixes looked at 8x; a walk frame's head takes its stand's labels where the pixels match.

Run: py -3.12 -I tools/build-outfits.py [--check] [--contact] [--labels slug...]
  --check: every body x hair x hat x top (and x bottom) through the composer: no holes, no stray pixels. --contact also writes the 4x contact sheet
  (tools/.cache/outfits-contact.png) and 12 random outfits walking (tools/.cache/outfits-random.gif).
"""
import importlib.util, json, os, random, sys
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT, CACHE = os.path.join(ROOT, 'assets/outfits'), os.path.join(ROOT, 'tools/.cache')
_s = importlib.util.spec_from_file_location('ranger_cut', os.path.join(HERE, 'ranger-cut.py')); rc = importlib.util.module_from_spec(_s); _s.loader.exec_module(rc)
sys.path.insert(0, HERE)
from outfit_specs import C, FAMILY, KW, BODIES, HAIRS, HATS, TOPS, BOTS, BAGS, DEF

Hx = lambda s: tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
hexof = lambda p: '%02x%02x%02x' % tuple(int(v) for v in p[:3])
lum = lambda h: 0.3 * int(h[:2], 16) + 0.59 * int(h[2:4], 16) + 0.11 * int(h[4:], 16)
STEP = {1: [2], 2: [1, 3], 3: [0, 2, 3], 4: [0, 1, 2, 3]}   # n shades of a ramped region -> steps of a 4-step ramp (dark to light)
SW, SH, MX, MY = 32, 40, 4, 4   # strip frame box (slot 24x32 max, plus room for head shifts) and where the slot's origin sits inside it
SSTEP = {1: [2], 2: [1, 3], 3: [1, 2, 3], 4: [0, 1, 2, 3]}   # n skin shades -> steps of a 4-step skin ramp (deep shadow, shadow, base, light)
ROWS8 = rc.ROWS8
# riding (Lunick's rideDoduo frames, one per facing, cells of the lunick sheet; right-facing rows mirror the left ones): (facing, ride cell, head dx, cut row).
# The rider's body below row `cut` is Lunick's own pixels (recoloured to the outfit's ramps, RIDE_ROLE); rows above it are the player's own head, the
# family stand frame of that facing moved dx px sideways (the ride frames are in a wider slot, so the head shifts)
RIDE = [('down', 7, 3, 11), ('downLeft', 10, 5, 11), ('left', 13, -1, 11), ('upLeft', 16, 6, 10), ('up', 18, 3, 10)]
RIDE_OF = {'down': (0, 0), 'downRight': (1, 1), 'right': (2, 1), 'upRight': (3, 1), 'up': (4, 0), 'upLeft': (3, 0), 'left': (2, 0), 'downLeft': (1, 0)}   # facing -> (RIDE index, mirrored)
# Lunick's clothes colours -> (key, step) of the player's ramps: jacket red = top, suit greys = bottom, yellow trim and its brown shade = bag, skin = skin;
# outline, gloves and boots keep their source colour. Hair blue only survives as strays below the cut row (hair ramp)
RIDE_ROLE = {'300018': ('x', 0), 'c0d8e0': ('x', 0), 'f0f0f0': ('x', 0), '004058': ('hair', 1), '006888': ('hair', 3), '404830': ('bot', 1), '505858': ('bot', 3),
             'c03848': ('top', 1), 'e82840': ('top', 3), '805820': ('bag', 0), 'c0a000': ('bag', 2), 'f8d000': ('bag', 3), 'b09058': ('s', 1), 'e0a888': ('s', 2), 'f0d0c0': ('s', 3)}
# biking: Pokemon Platinum's player_m_bike overworld sprite (pret/pokeplatinum, res/graphics/field_sprites/player/player_m_bike.png, 24 frames of 32x32: 0-3 back
# pedal, 4-7 front pedal, 8-11 left pedal, 20 back / 21 front / 22 left stopped). Only three facings are drawn; the right ones mirror the left and the diagonals use
# the side view (like the HGSS rows). Per facing: (head facing, [stopped, 4 pedal frames], their Platinum cut rows, slot row the cut lands on, row from which the
# jacket blue is the rider's and not the wheels'). Rows from the cut down are Platinum's own pixels (jacket blues -> top ramp, skin -> skin ramp); above it the player's head
PT_SHA, PT_FILE = '1dc13dcea40c04ab53f1f607de46023dc409ef20', 'player_m_bike.png'
BIKE = [('down', [21, 4, 5, 6, 7], [21] * 5, 11, 25), ('left', [22, 8, 9, 10, 11], [22, 21, 21, 21, 21], 11, 24), ('up', [20, 0, 1, 2, 3], [18] * 5, 10, 26)]
BIKE_OF = {'down': (0, 0), 'downRight': (1, 1), 'right': (1, 1), 'upRight': (1, 1), 'up': (2, 0), 'upLeft': (1, 0), 'left': (1, 0), 'downLeft': (1, 0)}   # facing -> (BIKE index, mirrored)
BIKE_DX = [None, None, None]   # head dx per BIKE entry; None = centre the head over the rider's torso
BIKE_OX = -4   # Platinum column -> slot column
BIKE_ROLE = {'dea57b': ('s', 2), 'ffd6bd': ('s', 3), '5a84e7': ('top', 3), '6373bd': ('top', 2)}   # 39638c is top below the thr row only (it is also the tyres)
BIKEF = [(j, p) for j in range(len(BIKE)) for p in range(5)]   # one strip frame per (BIKE entry, frame)

# ---------- sources ----------
_sheets = {}
def sheet(prefix):
    if prefix not in _sheets:
        a = rc.load(rc.sheet_of(prefix)); bx = rc.boxes(a)
        _sheets[prefix] = (a, bx, rc.cells_of(a, bx), json.load(open(os.path.join(rc.CACHE, 'labels', prefix + '.json'))))
    return _sheets[prefix]


def slot(prefix, i):
    a, bx, _, _ = sheet(prefix); x, y, w, h = bx[i]; return rc.key(a[y:y + h, x:x + w])


def char(slug):
    sp = sheet(slug.split('-')[0])[3]
    return next(c for c in sp['chars'] if c['slug'] == slug)


def frames(slug):
    """walk.<dir> and idle.<dir> rows as pack lays them out: [(name, [(cell, flip, dx, lift)], fps)]"""
    prefix = slug.split('-')[0]; rows, offs = rc.layout(json.loads(json.dumps(char(slug))), sheet(prefix)[2])
    return [(n, [(i, fl, *offs[r][k]) for k, (i, fl) in enumerate(fr)], fps) for r, (n, (fr, fps)) in enumerate(rows) if n.split('.')[0] in ('walk', 'idle')]


def facing_of(slug, cell):
    """the drawn facing of a cell: the labelled walk/idle dir it comes from (a borrowed diagonal walk plays side cells, so its head is a side head)"""
    for an in char(slug)['anims']:
        if an['name'] in ('walk', 'idle') and cell in an['frames']: return an['dir']
    raise KeyError((slug, cell))


# ---------- the family frame table: every family member's walk/idle rows have the same shape, so frame k of one is frame k of all ----------
def family_table():
    ref = frames(FAMILY[0]); fids = {}; table = []
    for name, fr, fps in ref:
        row = []
        for i, fl, dx, lift in fr:
            if i not in fids: fids[i] = len(fids)
            row.append(fids[i])
        table.append((name, row, fps))
    cellmap = {}
    for slug in FAMILY:
        fr = frames(slug); assert [(n, len(f)) for n, f, _ in fr] == [(n, len(f)) for n, f, _ in ref], slug
        m = {}
        for (n, f, _), (_, rf, _) in zip(fr, ref):
            for (i, *_), (ri, *_) in zip(f, rf):
                assert m.setdefault(fids[ri], i) == i, (slug, n, 'frame shapes differ')
        cellmap[slug] = [m[k] for k in range(len(fids))]
        for k, i in enumerate(cellmap[slug]): assert slot(slug.split('-')[0], i).shape == slot(FAMILY[0].split('-')[0], cellmap[FAMILY[0]][k]).shape, (slug, k)
    # zones per frame, one for the whole family (a pixel is head, torso or legs in every member alike, so swapped parts meet without gaps):
    # S = the row most members' clothing starts at, W = the row most undressed members' bottoms start at (dresses split there)
    zone = []
    for k in range(len(fids)):
        Ss = []; Ws = []
        for slug in FAMILY:
            sl = slot(slug.split('-')[0], cellmap[slug][k]); cand = C[slug]['cand']; dress = any('D' in v for v in cand.values()); s0 = w0 = 99
            for y, x in zip(*np.nonzero(sl[..., 3])):
                c = cand[hexof(sl[y, x])]
                if c != 'o' and set(c) <= set('TBDG') and y > 6: s0 = min(s0, y)
                if not dress and c != 'o' and set(c) - {'f'} <= {'B'} and y > 14: w0 = min(w0, y)
            Ss.append(s0)
            if not dress and w0 < 99: Ws.append(w0)
        zone.append((int(sorted(Ss)[len(Ss) // 2]), int(sorted(Ws)[(len(Ws) - 1) // 2])))
    return table, cellmap, len(fids), zone


# ---------- labelling: which part owns each pixel ----------
# classes: f face (skin, eyes, face lines), h hair, t hat, T top, B bottom, G bag, k skin below the head (arms -> T, legs -> B by connectivity), o outline
def resolve(L, amb):
    """shared colours: each round, every undecided pixel takes the candidate most of its 8 neighbours already have (ties: candidate order)"""
    h, w = L.shape
    for (y, x) in amb: L[y, x] = '?'
    while amb:
        dec = {}
        for (y, x), ok in amb.items():
            cnt = {k: 0 for k in ok}
            for yy in range(max(0, y - 1), min(h, y + 2)):
                for xx in range(max(0, x - 1), min(w, x + 2)):
                    if L[yy, xx] in cnt: cnt[L[yy, xx]] += 1
            if max(cnt.values()): dec[(y, x)] = max(ok, key=lambda k: (cnt[k], -ok.index(k)))
        if not dec: dec = {p: ok[0] for p, ok in amb.items()}
        for p, k in dec.items(): L[p] = k; del amb[p]
    return amb


def blobs(L, k):
    h, w = L.shape; seen = np.zeros((h, w), bool); out = []
    for y, x in zip(*np.nonzero(L == k)):
        if seen[y, x]: continue
        st = [(y, x)]; seen[y, x] = True; b = []
        while st:
            cy, cx = st.pop(); b.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and L[ny, nx] == k and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
        out.append(b)
    return out


def label(slug, sl, S, W, cell=None):
    """-> per pixel part letter. S, W: the frame's zones (first torso row, first leg row)"""
    sp = C[slug]; h, w = sl.shape[:2]
    cand = sp['cand']; L = np.full((h, w), '.', dtype='<U1'); amb = {}
    for y, x in zip(*np.nonzero(sl[..., 3])):
        c = cand.get(hexof(sl[y, x]))
        if c is None: raise SystemExit('%s cell %s: colour %s not in its spec' % (slug, cell, hexof(sl[y, x])))
        band = 0 if y < S else 1 if y < W else 2
        if c == 'o': L[y, x] = 'o'; continue
        if band == 0: ok = [k for k in c if k in 'hft'] or [k for k in c if k in 'TD']   # the head band: clothes colours only when nothing else fits
        else: ok = [k for k in c if k in ('hkTGBD' if sp.get('long') else 'kTGBD')]   # hair below the head band only for long-haired characters
        ok = [('T' if band < 2 else 'B') if k == 'D' else k for k in ok]   # D: a dress colour, top above the waist, bottom below
        ok = list(dict.fromkeys(ok)) or ([k for k in c if k != 'D'] if band == 0 else [k for k in c if k == 'h'] or ['T' if band < 2 else 'B'])   # face-only colours on the body: clothes by band
        if len(ok) == 1: L[y, x] = ok[0]
        else: amb[(y, x)] = ok
    # hair or face (a hair shade that is also a skin shade): face only beside at least FACE_N pixels of plain face colours, else hair
    seed = L == 'f'; pad = np.pad(seed, 1)
    nf = sum(pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w].astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    for p, ok in list(amb.items()):
        if 'h' in ok and 'f' in ok: L[p] = 'f' if nf[p] >= sp.get('face_n', 3) else 'h'; del amb[p]
    amb = resolve(L, amb)
    # hair below the head band only when it hangs from the head (long hair): any other hair-coloured blob there takes its next candidate
    hb = blobs(L, 'h'); again = {}
    for blob in hb:
        if min(y for y, _ in blob) >= S:
            for y, x in blob:
                c = [k for k in cand[hexof(sl[y, x])] if k not in 'hof'] or ['T' if y < W else 'B']; c = [('T' if y < W else 'B') if k == 'D' else k for k in c]
                L[y, x] = '?'; again[(y, x)] = list(dict.fromkeys(c)) or ['T']
    resolve(L, again)
    # edge colours (a dark shade the cap shares with the hair under it): hat only when touching the cap's own colours, else the next candidate
    edge = set(sp.get('edge', '').split())
    if edge:
        own = (L == 't') & ~np.array([[hexof(sl[y, x]) in edge for x in range(w)] for y in range(h)]); pad = np.pad(own, 1)
        near = np.logical_or.reduce([pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
        for y, x in zip(*np.nonzero((L == 't') & ~own & ~near)):
            L[y, x] = next((k for k in cand[hexof(sl[y, x])] if k not in 'tD'), 'T')
    L[:sp.get('capped', {}).get(cell, 0)][L[:sp.get('capped', {}).get(cell, 0)] == 'f'] = 't'   # a cap's rows: what shows through its strap hole goes with it
    for (y, x, k) in sp.get('fix', {}).get(cell, []): L[y, x] = k   # hand decisions (looked at 8x)
    # skin below the head: arms and hands above the family's skin line, legs below it. One line for the whole family, so a hand pixel belongs
    # to the same part in every character and a top from one never leaves a hole on another's bottom
    for y, x in zip(*np.nonzero(L == 'k')): L[y, x] = 'T' if y < KW else 'B'
    return L


def owners(L):
    """outline pixels belong to every part they touch (8 neighbours): each part keeps its own outline"""
    h, w = L.shape; O = {k: (L == k) for k in 'fhtTBG'}
    o = L == 'o'; pad = np.pad(L, 1, constant_values='.')
    for k in 'fhtTBG':
        nb = np.zeros((h, w), bool)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if (dy or dx) and not (k == 'f' and dy and dx): nb |= pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] == k
        O[k] = O[k] | (o & nb)   # the face owns only outline it touches side-on: a hair outline pixel touching the face at a corner stays hair
    for _ in range(4):   # outline two pixels thick (feet, hair tips): the outer pixel takes the parts of the outline it touches
        free = o & ~np.logical_or.reduce([O[k] for k in 'fhtTBG'])
        if not free.any(): break
        grow = {}
        for k in 'fhtTBG':
            pk = np.pad(O[k] & o, 1); nb = np.zeros((h, w), bool)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy or dx: nb |= pk[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
            grow[k] = free & nb
        for k in grow: O[k] |= grow[k]
    return O


# ---------- debug: labels overlay ----------
COL = {'f': (255, 210, 170), 'h': (220, 50, 50), 't': (60, 90, 240), 'T': (60, 200, 90), 'B': (40, 190, 230), 'G': (240, 220, 40), 'o': (0, 0, 0), 'k': (255, 0, 255), '.': (0, 0, 0)}


def debug_labels(slugs):
    S = 6; table, cellmap, n, zone = FT()
    for slug in slugs:
        prefix = slug.split('-')[0]; cols = []
        for k in kframes(slug):
            sl, _, L = parts(slug, k); i = k; h, w = L.shape
            lab = np.zeros((h, w, 4), np.uint8)
            for c, col in COL.items():
                if c not in 'o.': lab[L == c] = (*col, 255)
            lab[L == 'o'] = (30, 30, 30, 255)
            col = Image.new('RGBA', (w * S, (h * 2 + 2) * S + 10), (90, 90, 100, 255))
            col.alpha_composite(Image.fromarray(sl).resize((w * S, h * S), Image.NEAREST), (0, 10)); col.alpha_composite(Image.fromarray(lab).resize((w * S, h * S), Image.NEAREST), (0, 10 + (h + 2) * S))
            d = ImageDraw.Draw(col); d.text((1, 0), '%d:%d' % (k, i), fill=(255, 255, 0))
            for z in (*zone[k], KW): d.line([(0, 10 + (h + 2) * S + z * S), (w * S, 10 + (h + 2) * S + z * S)], fill=(255, 255, 255))
            cols.append(col)
        im = Image.new('RGBA', (sum(c.width + 4 for c in cols), max(c.height for c in cols) + 14), (50, 50, 60, 255)); ImageDraw.Draw(im).text((2, 0), slug, fill=(255, 255, 255)); x = 0
        for c in cols: im.alpha_composite(c, (x, 14)); x += c.width + 4
        p = os.path.join(CACHE, 'outfit-labels-%s.png' % slug); im.save(p); print(p)


# ---------- family parts in slot space ----------
_parts = {}
def parts(slug, k):
    """frame k of a family member -> (slot RGBA, {part letter: mask}, labels) (outline pixels in every part they touch).
    Any other character (a rigid donor) only has the family's stand frames: its idle stand of that facing, on the same template"""
    if (slug, k) not in _parts:
        table, cellmap, n, zone = FT()
        if slug in FAMILY: i = cellmap[slug][k]
        else:
            assert k in stands(), (slug, k); f = facing_of(FAMILY[0], cellmap[FAMILY[0]][k])
            i = next(an['frames'][0] for an in char(slug)['anims'] if an['name'] == 'idle' and an['dir'] == f)
        sl = slot(slug.split('-')[0], i); L = label(slug, sl, *zone[k], i)
        k0 = stand_of(k)
        if slug in FAMILY and k != k0:   # the head is the stand's head moved by disp: identical pixels take the stand's (hand checked) labels
            dx, dy = disp(slug, k); a0, _, L0 = parts(slug, k0); S, S0 = zone[k][0], zone[k0][0]
            for y, x in zip(*np.nonzero(sl[:S, :, 3])):
                y0, x0 = y - dy, x - dx
                if 0 <= y0 < S0 and 0 <= x0 < a0.shape[1] and a0[y0, x0, 3] and (a0[y0, x0, :3] == sl[y, x, :3]).all(): L[y, x] = L0[y0, x0]
            for (y, x, c) in C[slug].get('fix', {}).get(i, []): L[y, x] = c   # this frame's own hand decisions win
        _parts[(slug, k)] = (sl, owners(L), L)
    return _parts[(slug, k)]


def stands():
    return sorted({stand_of(k) for k in range(FT()[2])})


def rigid(slug):
    return slug not in FAMILY


def kframes(slug):
    """the frames a part stores: every family frame, or a rigid donor's stands (the composer reuses them, moved with the body)"""
    return stands() if rigid(slug) else range(FT()[2])


_ft = []
def FT():
    if not _ft: _ft.append(family_table())
    return _ft[0]


def NF():
    """frames per strip: the family's frames, then one ride frame per RIDE facing, then the bike frames"""
    return FT()[2] + len(RIDE) + len(BIKEF)


_core = {}
def core(k):
    """the template body of frame k: pixels every family member draws"""
    if k not in _core: _core[k] = np.logical_and.reduce([parts(s, k)[0][..., 3] > 0 for s in FAMILY])
    return _core[k]


def shift(a, dx, dy):
    """a moved by (dx, dy), emptied where it came from"""
    o = np.zeros_like(a); h, w = a.shape[:2]
    o[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return o


def stand_of(k):
    """the family stand frame of frame k's facing (idle.<dir> frame 0)"""
    table, cellmap, n, zone = FT(); f = facing_of(FAMILY[0], cellmap[FAMILY[0]][k])
    return next(row[0] for name, row, _ in table if name == 'idle.' + f)


_disp = {}
def disp(s, k):
    """where s's face sits in frame k relative to its stand frame (step frames lean the head forward, by a different amount per character)"""
    if (s, k) not in _disp:
        k0 = stand_of(k); a0, _, L0 = parts(s, k0); a1 = slot(s.split('-')[0], FT()[1][s][k]); S0 = FT()[3][k0][0]
        ys, xs = np.nonzero(L0[:S0] == 'f'); best = None
        for dy in range(-3, 4):
            for dx in range(-6, 7):
                yy, xx = ys + dy, xs + dx; ok = (yy >= 0) & (yy < a1.shape[0]) & (xx >= 0) & (xx < a1.shape[1])
                cost = 2 * int((~ok).sum()); yy, xx, y0, x0 = yy[ok], xx[ok], ys[ok], xs[ok]
                cost += 2 * int((a1[yy, xx, 3] == 0).sum()) + int((a1[yy, xx, :3] != a0[y0, x0, :3]).any(-1).sum())
                if best is None or (cost, abs(dx) + abs(dy)) < best[:2]: best = (cost, abs(dx) + abs(dy), dx, dy)
        _disp[(s, k)] = (best[2], best[3])
    return _disp[(s, k)]


def cover(m, reach=3):
    """a hat's cover (the hair it cuts): in every column the hat touches, everything from the top down to the end of the hat's top run of pixels
    there (a stray low hat pixel, at the ear, cuts nothing: the hair between would leave a gap); in the `reach` columns beyond each side, down to
    the row the hat's edge column ends at (a spike of hair sticking out beside the cap would float)"""
    cv = np.zeros_like(m); ends = {}
    for x in range(m.shape[1]):
        ys = np.nonzero(m[:, x])[0]
        if len(ys):
            e = ys[0]
            while e + 1 < m.shape[0] and m[e + 1, x]: e += 1
            cv[:e + 1, x] = True; ends[x] = e
    if ends:
        x0, x1 = min(ends), max(ends)
        for d in range(1, reach + 1):
            if x0 - d >= 0: cv[:ends[x0] + 1, x0 - d] = True
            if x1 + d < m.shape[1]: cv[:ends[x1] + 1, x1 + d] = True
    return cv


# ---------- planes: a part's pixels per colour role, as strips of every family frame ----------
CAT = {'h': 'hair', 't': 'hat', 'T': 'top', 'B': 'bot', 'G': 'bag'}


def role(slug, cls, hx, outline):
    """(key, step): key 'x' keeps the source colour, 's' takes the skin ramp, a category name takes that category's chosen ramp"""
    if outline: return ('x', 0)
    r = {k: v.split() for k, v in C[slug]['ramp'].items()}
    if cls != 'f' and hx in r.get(cls, []): return (CAT[cls], C[slug].get('steps', {}).get(cls, STEP[len(r[cls])])[r[cls].index(hx)])
    if hx in r.get('s', []) and cls in 'fTBh': return ('s', SSTEP[len(r['s'])][r['s'].index(hx)])
    return ('x', 0)


def planes(frames):
    """frames: [(k, slot RGBA, L labels, mask, dx, dy)] -> {(key, step): strip RGBA (white planes, or source colours for 'x')}"""
    out = {}
    for k, sl, L, m, dx, dy, slug in frames:
        for y, x in zip(*np.nonzero(m)):
            key = role(slug, L[y, x], hexof(sl[y, x]), L[y, x] == 'o'); Y, X = MY + y + dy, k * SW + MX + x + dx
            st = out.setdefault(key, np.zeros((SH, NF() * SW, 4), np.uint8))
            st[Y, X] = sl[y, x] if key[0] == 'x' else (255, 255, 255, 255)
    return out


def family_part(slug, letter):
    return planes([(k, parts(slug, k)[0], parts(slug, k)[2], parts(slug, k)[1][letter], 0, 0, slug) for k in kframes(slug)])


def cross(k):
    """where a family member's top reaches into the legs zone (a hand over the thigh) or its bottom into the torso zone: a top or bottom from
    another member leaves those pixels empty, so the body's own pixels there join its base"""
    W = FT()[3][k][1]; y = np.arange(core(k).shape[0])[:, None]
    return np.logical_or.reduce([((parts(s, k)[2] == 'T') & (y >= W)) | ((parts(s, k)[2] == 'B') & (y < W)) for s in FAMILY])


def cross1(L, k):
    W = FT()[3][k][1]; y = np.arange(L.shape[0])[:, None]; return ((L == 'T') & (y >= W)) | ((L == 'B') & (y < W))   # the body's own hand over its thigh is no base


def ramped(slug, sl, cls):
    r = set(C[slug]['ramp'].get(cls, '').split()); return np.array([[hexof(p) in r for p in row] for row in sl])


def neck(k):
    """the neck and collar rows: necklines differ between tops, so the body's own neck and collar there join its base (a top is wider than a neck,
    so they never stick out)"""
    y = np.arange(core(k).shape[0])[:, None]; S = FT()[3][k][0]; return (y >= S - 2) & (y < S + 2) & np.ones_like(core(k))


def base_mask(slug, k):
    sl, O, L = parts(slug, k); top = np.arange(L.shape[0])[:, None] < FT()[3][k][0] - 2   # the top of the head: the body's own hair there would stick out past a smaller haircut
    return (core(k) | (cross(k) & ~cross1(L, k)) | neck(k)) & (sl[..., 3] > 0) & (L != 't') & ~O['t'] & ~((L == 'h') & (top | ~ramped(slug, sl, 'h')))   # nor a hair tie (a hair colour off the ramp)


_pt = []
def pt_frame(i):
    """frame i (32x32 RGBA) of Platinum's bike sprite, fetched once from the pinned pret/pokeplatinum commit"""
    if not _pt:
        p = os.path.join(CACHE, 'pt', PT_FILE)
        if not os.path.exists(p):
            import urllib.request; os.makedirs(os.path.dirname(p), exist_ok=True)
            urllib.request.urlretrieve('https://raw.githubusercontent.com/pret/pokeplatinum/%s/res/graphics/field_sprites/player/%s' % (PT_SHA, PT_FILE), p)
        _pt.append(np.array(Image.open(p).convert('RGBA')))
    return _pt[0][i * 32:(i + 1) * 32]


def bike_px(m):
    """bike frame m's pixels below its cut row, in slot space -> [(y, x, rgba, platinum y)]"""
    j, p = BIKEF[m]; f, ids, cuts, sc, thr = BIKE[j]; P = pt_frame(ids[p]); out = []
    for y, x in zip(*np.nonzero(P[..., 3])):
        if y >= cuts[p]: out.append((int(y) - cuts[p] + sc, int(x) + BIKE_OX, P[y, x], int(y)))
    return out


def bike_dx(j):
    """the head's sideways shift on BIKE entry j: its stand head centred over the rider's torso (the rows under the cut, scarf and outline left out)"""
    if BIKE_DX[j] is not None: return BIKE_DX[j]
    f, ids, cuts, sc, thr = BIKE[j]; k0 = next(row[0] for name, row, _ in FT()[0] if name == 'idle.' + f)
    S = slot(FAMILY[0].split('-')[0], FT()[1][FAMILY[0]][k0]); ys, xs = np.nonzero(S[:sc, :, 3]); hc = (xs.min() + xs.max()) / 2
    tx = [x for y, x, c, py in bike_px(j * 5 + 1) if y < sc + 4 and hexof(c) not in ('ada5ce', 'cecede', 'efefff', '000000')]
    return int(round((min(tx) + max(tx)) / 2 - hc))


_heads = []
def HEADS():
    """[(facing, dx, cut)] of every head-bearing frame after the family's: the ride frames, then the bike frames"""
    if not _heads:
        _heads.extend((f, dx, cut) for f, _, dx, cut in RIDE); _heads.extend((BIKE[j][0], bike_dx(j), BIKE[j][3]) for j, p in BIKEF)
    return _heads


def ride_head(slug, j):
    """the player's head on ride frame j: the facing's stand frame, rows above the cut, moved dx sideways -> (stand frame, k0, dx)"""
    f, dx, cut = HEADS()[j]; k0 = next(row[0] for name, row, _ in FT()[0] if name == 'idle.' + f); return k0, dx, cut


def ride_planes():
    """Lunick's body below each ride frame's cut row, as planes of the player's ramps (RIDE_ROLE)"""
    out = {}; n = FT()[2]
    for j, (f, cell, dx, cut) in enumerate(RIDE):
        R = slot('lunick', cell)
        for y, x in zip(*np.nonzero(R[..., 3])):
            if y < cut: continue
            key = RIDE_ROLE[hexof(R[y, x])]; st = out.setdefault(key, np.zeros((SH, NF() * SW, 4), np.uint8)); st[MY + y, (n + j) * SW + MX + x] = R[y, x] if key[0] == 'x' else (255, 255, 255, 255)
    return out


def bike_planes():
    """Platinum's rider and bike below each bike frame's cut row, as planes of the player's ramps (BIKE_ROLE)"""
    out = {}; n = FT()[2] + len(RIDE)
    for m in range(len(BIKEF)):
        thr = BIKE[BIKEF[m][0]][4]
        for y, x, c, py in bike_px(m):
            h = hexof(c); key = BIKE_ROLE.get(h) or (('top', 1) if h == '39638c' and py < thr else ('x', 0))
            st = out.setdefault(key, np.zeros((SH, NF() * SW, 4), np.uint8)); st[MY + y, (n + m) * SW + MX + x] = c if key[0] == 'x' else (255, 255, 255, 255)
    return out


def merge(out, add):
    for key, st in add.items():
        if key in out: m = st[..., 3] > 0; out[key][m] = st[m]
        else: out[key] = st
    return out


def head_frames(slug, letter, base=False):
    """ride frames' head planes: the body's base pixels (base) or its owned `letter` pixels, from the facing's stand frame, above the cut, moved dx"""
    fr = []
    for j in range(len(HEADS())):
        k0, dx, cut = ride_head(slug, j); sl, O, L = parts(slug, k0); m = (base_mask(slug, k0) if base else O[letter]).copy(); m[cut:] = False
        fr.append((FT()[2] + j, sl, L, m, dx, 0, slug))
    return fr


def base_part(slug):
    """the body's own template pixels (everything but its hat and hair), drawn first: they only show where no chosen part draws; on ride frames also the rider's body"""
    fr = [(k, parts(slug, k)[0], parts(slug, k)[2], base_mask(slug, k), 0, 0, slug) for k in range(FT()[2])]
    return merge(merge(planes(fr + head_frames(slug, None, True)), ride_planes()), bike_planes())


def body_face(slug):
    return planes([(k, parts(slug, k)[0], parts(slug, k)[2], parts(slug, k)[1]['f'], 0, 0, slug) for k in kframes(slug)] + head_frames(slug, 'f'))


def ring_part(slug, letter):
    """the donor's own pixels in a 1 px ring round its part, inside the template body: drawn first, under everything, so they only show
    where nothing else draws (the neck under a short haircut, the gap under a cap's rim)"""
    fr = []
    for k in kframes(slug):
        sl, O, L = parts(slug, k); m = O[letter]; p = np.pad(m, 1); h, w = m.shape
        dil = np.logical_or.reduce([p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
        # only below the crown: above it a cap cuts the hair and a ring pixel left there would float
        low = ~cover(m) if letter == 't' else np.arange(h)[:, None] >= FT()[3][k][0] - 3
        fr.append((k, sl, L, core(k) & (sl[..., 3] > 0) & dil & ~m & low, 0, 0, slug))
    return planes(fr)


def cover_strip(slug):
    st = np.zeros((SH, NF() * SW, 4), np.uint8)
    for k in kframes(slug):
        cv = cover(parts(slug, k)[1]['t'])
        for y, x in zip(*np.nonzero(cv)): st[MY + y, k * SW + MX + x] = 255
    return st


# ---------- the player's sheet layout: pack's placement of the body's own frames, with each composed frame box placed where pack puts the slot ----------
def sheet_layout(slug):
    table, cellmap, n, zone = FT(); fr = frames(slug); prefix = slug.split('-')[0]; cells = sheet(prefix)[2]
    fid = {i: k for k, i in enumerate(cellmap[slug])}
    used = {i for _, f, _ in fr for i, *_ in f}; m = max(abs(dx) for _, f, _ in fr for _, _, dx, _ in f)
    fw = max(cells[i].shape[1] for i in used) + 2 + 2 * m; fw += fw % 2; mh = max(cells[i].shape[0] for i in used); fh = mh + 3; foot = mh + 1   # pack's cell
    rows = []
    for name, f, fps in fr:
        row = []
        for c, (i, fl, dx, lift) in enumerate(f):
            sl = slot(prefix, i); sl = sl[:, ::-1] if fl else sl; ys, xs = np.nonzero(sl[..., 3]); h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
            x0 = (fw - w) // 2 + dx; y0 = foot - h - lift                      # pack's crop position inside the cell
            ox, oy = x0 - xs.min(), y0 - ys.min()                              # where the (flipped) slot's origin lands
            bx = ox - MX if not fl else ox + sl.shape[1] - SW + MX            # the frame box, mirrored with the slot when flipped
            row.append([fid[i], 1 if fl else 0, int(bx), int(oy - MY)])
        rows.append((name, row, fps))
    for d in ROWS8:   # ride rows: Lunick's seated frame (mirrored for the right-facing ones), bbox centred like the walk frames, lowest pixel on the feet line
        j, fl = RIDE_OF[d]; R = slot('lunick', RIDE[j][1]); ys, xs = np.nonzero(R[..., 3]); w = xs.max() - xs.min() + 1; x0 = (fw - w) // 2
        a, b = MX + xs.min(), MX + xs.max()
        rows.append(('ride.' + d, [[FT()[2] + j, fl, int(x0 - SW + 1 + b if fl else x0 - a), int(foot - 1 - (MY + ys.max()))]], 1))
    for d in ROWS8:   # bike rows: [stopped, 4 pedal frames], the facing's frames centred on their joint bbox (so the pedal cycle keeps its place), lowest pixel on the feet line
        j, fl = BIKE_OF[d]; ms = [j * 5 + p for p in range(5)]; px = [bike_px(m) for m in ms]
        a = MX + min(x for q in px for _, x, _, _ in q); b = MX + max(x for q in px for _, x, _, _ in q); x0 = (fw - (b - a + 1)) // 2
        rows.append(('bike.' + d, [[FT()[2] + len(RIDE) + m, fl, int(x0 - SW + 1 + b if fl else x0 - a), int(foot - 1 - (MY + max(y for y, _, _, _ in q)))] for m, q in zip(ms, px)], 6))
    xs = [b for _, r, _ in rows for _, _, b, _ in r]; ys = [b for _, r, _ in rows for _, _, _, b in r]
    pad = max(0, -min(xs), max(xs) + SW - fw); pad += pad % 2; top = max(0, -min(ys)); bot = max(0, max(ys) + SH - fh)
    FW, FH = fw + 2 * pad, fh + top + bot
    out = dict(fw=FW, fh=FH, footY=foot - 1 + top, anims={}, cells=[])
    for r, (name, row, fps) in enumerate(rows):
        out['anims'][name] = dict(row=r, n=len(row), fps=fps); out['cells'].append([[k, fl, bx + pad, by + top] for k, fl, bx, by in row])
    return out


# ---------- build ----------
def pack_atlas(recs):
    """recs: [(name, {field: {(key, step): strip}}, extra)] -> atlas image, records with plane lists [[key, step, row]]"""
    strips = []; out = []
    for name, fields, extra in recs:
        rec = dict(n=name, **extra)
        for fname, pl in fields.items():
            if isinstance(pl, np.ndarray): rec[fname] = len(strips); strips.append(pl); continue
            rec[fname] = []
            for (key, step), st in sorted(pl.items(), key=lambda kv: (kv[0][0] != 'x', kv[0])):
                rec[fname].append([key, step, len(strips)]); strips.append(st)
        out.append(rec)
    return Image.fromarray(np.vstack(strips) if strips else np.zeros((SH, NF() * SW, 4), np.uint8)), out


def make():
    table, cellmap, n, zone = FT(); D = dict(sw=SW, sh=SH, nf=NF(), files={}, ramps=DEF['ramps'], skins=DEF['skins'], defaults=DEF['outfit'])
    ims = {}
    stand = [stand_of(k) for k in range(n)]
    recs = []
    for slug, name in BODIES:
        lay = sheet_layout(slug)
        recs.append((name, dict(b=base_part(slug), p=body_face(slug)), dict(d=[list(disp(slug, k)) for k in range(n)] + [[dx, 0] for _, dx, _ in HEADS()], **lay)))
    ims['body'], D['body'] = pack_atlas(recs)
    rstand = [ride_head(None, j)[0] for j in range(len(HEADS()))]   # ride frames show the head of the facing's stand frame, placed by the body's d
    head = lambda slug: dict(d=[[0, 0]] * NF(), src=stand + rstand) if rigid(slug) else dict(d=[list(disp(slug, k)) for k in range(n)] + [[0, 0]] * len(HEADS()), src=list(range(n)) + rstand)
    recs = [(name, dict(p=family_part(slug, 'h'), u=family_part(slug, 'f'), r=ring_part(slug, 'h')), head(slug)) for slug, name in HAIRS]
    ims['hair'], D['hair'] = pack_atlas(recs)
    recs = [(name, dict(p=family_part(slug, 't'), cv=cover_strip(slug), r=ring_part(slug, 't')), head(slug)) for slug, name in HATS]
    ims['hat'], D['hat'] = pack_atlas(recs)
    for cat, lst, letter in (('top', TOPS, 'T'), ('bot', BOTS, 'B')):
        ims[cat], D[cat] = pack_atlas([(name, dict(p=family_part(slug, letter)), {}) for slug, name in lst])
    ims['bag'], D['bag'] = pack_atlas([])
    return D, ims


def write(D, ims):
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    for cat, im in ims.items():
        im.save(os.path.join(OUT, cat + '.png'), optimize=True); D['files'][cat] = 'assets/outfits/%s.png' % cat
    with open(os.path.join(ROOT, 'data/adv/outfits.js'), 'w') as fh:
        fh.write('// Generated by tools/build-outfits.py (docs/OUTFITS.md P2): Pokemon Ranger parts, ripped by Ragey (tenchionline.com/ragey)\nwindow.ADV_OUTFIT = ' + json.dumps(D, separators=(',', ':')) + ';\n')


# ---------- reference composer: the same steps as src/adv-outfit.js, so the contact sheet shows exactly what the game draws ----------
KEYS = ['body', 'hair', 'hairC', 'hat', 'hatC', 'top', 'topC', 'bot', 'botC', 'bag', 'bagC', 'skin']


def compose(D, A, o, strip_only=False):
    """o: the 12 save ints -> the player's sheet (RGBA array, D['body'][o.body] layout), or the composed frame strip"""
    n, sw, sh = D['nf'], D['sw'], D['sh']; B = D['body'][o['body']]
    col = lambda key, step: Hx(D['skins'][o['skin']][step]) if key == 's' else Hx(D['ramps'][o[key + 'C']][step])
    def layer(cat, rec, field, dst, off=None, src=None, mode='over'):
        for key, step, row in rec[field] if not isinstance(rec[field], int) else [['m', 0, rec[field]]]:
            st = A[cat][row * sh:(row + 1) * sh]; tmp = np.zeros((sh, n * sw, 4), np.uint8)
            for k in range(n):
                s = (src or list(range(n)))[k]; dx, dy = off[k] if off else (0, 0); fr = shift(st[:, s * sw:(s + 1) * sw], dx, dy)
                m = fr[..., 3] > 0; t = tmp[:, k * sw:(k + 1) * sw]; t[m] = fr[m]
            if key not in ('x', 'm'): tmp[tmp[..., 3] > 0, :3] = col(key, step)
            m = tmp[..., 3] > 0
            if mode == 'out': dst[m] = 0
            else: dst[m] = tmp[m]
    strip = np.zeros((sh, n * sw, 4), np.uint8)
    H = D['hair'][o['hair']]; off = [(B['d'][k][0] - H['d'][k][0], B['d'][k][1] - H['d'][k][1]) for k in range(n)]
    if o['hat']: T = D['hat'][o['hat'] - 1]; toff = [(B['d'][k][0] - T['d'][k][0], B['d'][k][1] - T['d'][k][1]) for k in range(n)]
    layer('hair', H, 'r', strip, off, H.get('src'))
    if o['hat']: layer('hat', T, 'r', strip, toff, T.get('src'))
    layer('body', B, 'b', strip)
    if D['bot']: layer('bot', D['bot'][o['bot']], 'p', strip)
    if D['top']: layer('top', D['top'][o['top']], 'p', strip)
    layer('hair', H, 'u', strip, off, H.get('src'))
    layer('body', B, 'p', strip)
    head = np.zeros_like(strip); layer('hair', H, 'p', head, off, H.get('src'))
    if o['hat']: layer('hat', T, 'cv', head, toff, T.get('src'), 'out'); layer('hat', T, 'p', head, toff, T.get('src'))
    m = head[..., 3] > 0; strip[m] = head[m]
    if strip_only: return strip
    out = np.zeros((B['fh'] * len(B['cells']), B['fw'] * max(len(r) for r in B['cells']), 4), np.uint8)
    for r, row in enumerate(B['cells']):
        for c, (k, fl, bx, by) in enumerate(row):
            fr = strip[:, k * sw:(k + 1) * sw]; fr = fr[:, ::-1] if fl else fr
            x0, y0 = c * B['fw'] + bx, r * B['fh'] + by
            dst = out[max(y0, r * B['fh']):y0 + sh, max(x0, c * B['fw']):x0 + sw]   # clipped to the cell
            src = fr[max(y0, r * B['fh']) - y0:, max(x0, c * B['fw']) - x0:][:dst.shape[0], :dst.shape[1]]; m = src[..., 3] > 0; dst[m] = src[m]
    return out


def load_built():
    D = json.loads(open(os.path.join(ROOT, 'data/adv/outfits.js')).read().split('=', 1)[1].strip().rstrip(';'))
    A = {cat: np.array(Image.open(os.path.join(ROOT, f)).convert('RGBA')) for cat, f in D['files'].items()}
    return D, A


def counts(D):
    r = len(D['ramps'])
    return dict(body=len(D['body']), hair=len(D['hair']), hairC=r, hat=len(D['hat']) + 1, hatC=r, top=len(D['top']), topC=r, bot=len(D['bot']), botC=r, bag=len(D['bag']) + 1, bagC=r, skin=len(D['skins']))


def rand_outfit(rnd, D):
    n = counts(D); o = {k: rnd.randrange(n[k]) for k in KEYS}
    if rnd.random() < 0.5: o['hat'] = 0
    if rnd.random() < 0.5: o['bag'] = 0
    return o



# ---------- contact sheet + random outfit GIF ----------
DIRS = ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft']


def cells_of_sheet(B, sheet):
    """{(anim name, frame): cell RGBA}"""
    return {(name, f): sheet[a['row'] * B['fh']:(a['row'] + 1) * B['fh'], f * B['fw']:(f + 1) * B['fw']] for name, a in B['anims'].items() for f in range(a['n'])}


def block(D, sh_, B):
    """one outfit: 8 rows (directions) x [walk 4 frames | idle frames], each cell cropped to the sprite area (the union over every frame)"""
    cs = cells_of_sheet(B, sh_); fw, fh = B['fw'], B['fh']
    al = np.logical_or.reduce([c[..., 3] > 0 for c in cs.values()]); ys, xs = np.nonzero(al)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1; cw, chh = x1 - x0 + 1, y1 - y0 + 1
    out = np.zeros((8 * chh, 8 * cw + 3, 4), np.uint8); out[..., :3] = (122, 168, 132); out[..., 3] = 255; out[:, 4 * cw:4 * cw + 3, :3] = (90, 120, 100)
    for r, d in enumerate(DIRS):
        for f in range(4):
            for col, name in ((f, 'walk.' + d), (4 + f, 'idle.' + d)):
                c = cs.get((name, f))
                if c is None: continue
                c = c[y0:y1, x0:x1]; X = col * cw + (3 if col >= 4 else 0); t = out[r * chh:r * chh + c.shape[0], X:X + c.shape[1]]; m = c[..., 3] > 0; t[m] = c[m]
    return out


def contact(D, A, S=4):
    """every body x every part (each body in its own Ranger skin), all 8 directions, walk | idle, then 12 random outfits; S x scale"""
    n = counts(D); base = dict(D['defaults']); rows = []
    for b in range(n['body']):
        own = dict(base, body=b, skin=b % n['skin'])
        for cat, cnt in (('hair', n['hair']), ('hat', n['hat']), ('top', n['top']), ('bot', n['bot']), ('bag', n['bag'])):
            for i in range(cnt):
                o = dict(own, **{cat: i})
                if cat in ('hat', 'bag') and i == 0: continue
                o[cat + 'C'] = (D['defaults'][cat + 'C'] + 5 * i) % n[cat + 'C']
                rows.append(('%s / %s %s' % (D['body'][b]['n'], cat, (D[cat][i - 1] if cat in ('hat', 'bag') else D[cat][i])['n']), block(D, compose(D, A, o), D['body'][b])))
    rnd = random.Random(7)
    for i in range(12):
        o = rand_outfit(rnd, D); rows.append(('random %d %s' % (i, ADVKEY(o)), block(D, compose(D, A, o), D['body'][o['body']])))
    per = 8; bw = max(r[1].shape[1] for r in rows) * S + 12; bh = max(r[1].shape[0] for r in rows) * S + 18
    im = Image.new('RGB', (per * bw, ((len(rows) + per - 1) // per) * bh), (60, 60, 70)); d = ImageDraw.Draw(im)
    for i, (title, b) in enumerate(rows):
        x, y = (i % per) * bw, (i // per) * bh
        d.text((x + 2, y + 2), title, fill=(255, 255, 255)); im.paste(Image.fromarray(b[..., :3]).resize((b.shape[1] * S, b.shape[0] * S), Image.NEAREST), (x, y + 16))
    p = os.path.join(CACHE, 'outfits-contact.png'); im.save(p, compress_level=6); print(p, im.size)
    return rows


ADVKEY = lambda o: '.'.join(str(o[k]) for k in KEYS)


def enclosed(a):
    """empty pixels of a frame the outside can't reach (4-connected): holes in the sprite"""
    e = a[..., 3] == 0; r = np.zeros_like(e); r[0, :], r[-1, :], r[:, 0], r[:, -1] = e[0, :], e[-1, :], e[:, 0], e[:, -1]
    while True:
        p = np.pad(r, 1); g = e & (r | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:])
        if (g == r).all(): return e & ~r
        r = g


def strays(a):
    """drawn pixels not 8-connected to the frame's biggest piece (a hair spike or ring pixel left floating)"""
    m = a[..., 3] > 0; seen = np.zeros_like(m); comps = []
    for y, x in zip(*np.nonzero(m)):
        if seen[y, x]: continue
        st = [(y, x)]; seen[y, x] = True; c = []
        while st:
            cy, cx = st.pop(); c.append((cy, cx))
            for ny in (cy - 1, cy, cy + 1):
                for nx in (cx - 1, cx, cx + 1):
                    if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
        comps.append(c)
    comps.sort(key=len)
    return [p for c in comps[:-1] for p in c]


def check(D, A):
    """every body x hair x hat x top, and every body x bottom / bag, through the game's composer: no hole (an enclosed empty pixel that is not
    enclosed in the body's, top's or bottom's own frame too, like a gap between the legs) and no stray (a piece not joined to the sprite)"""
    n = counts(D); bad = []; sw = D['sw']; outs = []; src_gaps = {}
    for b in range(n['body']):
        outs += [dict(D['defaults'], body=b, hair=h, hat=t, top=u) for h in range(n['hair']) for t in range(n['hat']) for u in range(n['top'])]
        outs += [dict(D['defaults'], body=b, **{cat: i}) for cat in ('bot', 'bag') for i in range(n[cat])]
    def gaps(s, k):
        if (s, k) not in src_gaps:
            sl = parts(s, k)[0]; a = np.zeros((D['sh'], sw, 4), np.uint8); a[MY:MY + sl.shape[0], MX:MX + sl.shape[1]] = sl; src_gaps[(s, k)] = enclosed(a)
        return src_gaps[(s, k)]
    for o in outs:
        strip = compose(D, A, o, True); srcs = {BODIES[o['body']][0], TOPS[o['top']][0], BOTS[o['bot']][0]}
        for k in range(D['nf']):
            if k >= FT()[2]:   # ride frames: Lunick's seated body has its own gaps, so only strays are checked
                s = strays(strip[:, k * sw:(k + 1) * sw])
                if s: bad.append(('STRAY', ADVKEY(o), k, [(int(y) - MY, int(x) - MX) for y, x in s]))
                continue
            miss = enclosed(strip[:, k * sw:(k + 1) * sw]) & ~np.logical_or.reduce([gaps(s, k) for s in srcs])
            # a donor's hand or shirt hem over its own legs, where neither the body nor the chosen top draws: no exact pixel exists, the gap stays
            bs, _, bL = parts(BODIES[o['body']][0], k); c = cross(k) & ((bs[..., 3] == 0) | cross1(bL, k)); miss[MY:MY + c.shape[0], MX:MX + c.shape[1]] &= ~c
            if miss.any(): bad.append(('HOLE', ADVKEY(o), k, [(int(y) - MY, int(x) - MX) for y, x in zip(*np.nonzero(miss))]))
            s = strays(strip[:, k * sw:(k + 1) * sw])
            if s: bad.append(('STRAY', ADVKEY(o), k, [(int(y) - MY, int(x) - MX) for y, x in s]))
    for row in bad: print(*row)
    print('holes and strays check (%d outfits x %d frames):' % (len(outs), D['nf']), 'OK' if not bad else '%d problems' % len(bad))
    return not bad


def ride_contact(D, A, S=6, pre='ride', fr=0):
    """tools/.cache/outfits-<pre>.png: <pre>.<dir> frame fr of 8 outfits (every body, then random ones), the 8 facings side by side, S x"""
    rnd = random.Random(5); outs = [dict(D['defaults'], body=b) for b in range(len(D['body']))] + [rand_outfit(rnd, D) for _ in range(4)]
    cells = []
    for o in outs:
        B = D['body'][o['body']]; sh_ = compose(D, A, o)
        cells.append([sh_[B['anims'][pre + '.' + d]['row'] * B['fh']:(B['anims'][pre + '.' + d]['row'] + 1) * B['fh'], fr * B['fw']:(fr + 1) * B['fw']] for d in DIRS])
    al = np.logical_or.reduce([c[..., 3] > 0 for r in cells for c in r]); ys, xs = np.nonzero(al); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    im = Image.new('RGB', (8 * (x1 - x0 + 2) * S, len(outs) * (y1 - y0 + 2) * S), (122, 168, 132))
    for r, row in enumerate(cells):
        for c, cell in enumerate(row):
            t = Image.fromarray(cell[y0:y1, x0:x1]); im.paste(t.resize((t.width * S, t.height * S), Image.NEAREST), (c * (x1 - x0 + 2) * S, r * (y1 - y0 + 2) * S), t.resize((t.width * S, t.height * S), Image.NEAREST))
    p = os.path.join(CACHE, 'outfits-%s%s.png' % (pre, fr or '')); im.save(p); print(p, im.size)


def gif(D, A, S=4):
    """12 random outfits walking a loop of all 8 directions, 3 x 4 grid"""
    rnd = random.Random(11); outs = [rand_outfit(rnd, D) for _ in range(12)]; sheets = [(o, compose(D, A, o)) for o in outs]
    fw = max(D['body'][o['body']]['fw'] for o in outs); fh = max(D['body'][o['body']]['fh'] for o in outs); frames = []
    for d in DIRS:
        for f in range(8):
            im = np.zeros((3 * fh, 4 * fw, 4), np.uint8); im[..., :3] = (122, 168, 132); im[..., 3] = 255
            for i, (o, sh_) in enumerate(sheets):
                B = D['body'][o['body']]; walk = f < 6; a = B['anims'][('walk.' if walk else 'idle.') + d]; k = f % a['n'] if walk else (f // 1) % a['n']
                c = sh_[a['row'] * B['fh']:(a['row'] + 1) * B['fh'], k * B['fw']:(k + 1) * B['fw']]
                x0, y0 = (i % 4) * fw + (fw - B['fw']) // 2, (i // 4) * fh + (fh - B['fh'])
                t = im[y0:y0 + B['fh'], x0:x0 + B['fw']]; m = c[..., 3] > 0; t[m] = c[m]
            frames.append(Image.fromarray(im[..., :3]).resize((im.shape[1] * S, im.shape[0] * S), Image.NEAREST))
    p = os.path.join(CACHE, 'outfits-random.gif'); frames[0].save(p, save_all=True, append_images=frames[1:], duration=160, loop=0); print(p)


if __name__ == '__main__':
    if '--labels' in sys.argv: debug_labels([a for a in sys.argv[1:] if not a.startswith('--')])
    else:
        D, ims = make(); write(D, ims); D, A = load_built()
        print({k: v for k, v in counts(D).items() if not k.endswith('C')})
        if '--check' in sys.argv or '--contact' in sys.argv: check(D, A)
        if '--contact' in sys.argv: contact(D, A); gif(D, A)
        if '--ride' in sys.argv: ride_contact(D, A)
        if '--bike' in sys.argv: ride_contact(D, A, 6, 'bike', 0); ride_contact(D, A, 6, 'bike', 2)
