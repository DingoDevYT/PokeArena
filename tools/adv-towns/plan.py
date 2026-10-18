"""Hand-drawn town plans (docs/REGION-REBUILD.md section 15). A town is drawn as a character map, one character per tile, the centre marked '@' (it is a plain cell
of whatever ground surrounds it once read). plan.build() turns the map plus a legend into tools/adv-towns/<code>.json (the generator's hand layout format) and draws
tools/.cache/plan-<code>.png, a quick look at the plan with every sprite's real size, so a town can be drawn and redrawn without running the generator.
Ground characters (paving runs): d dirt lane, p stone paving, c cobbles, t tan paving (plazas), s tilled soil, h hay field. Anything else is a prop or building from
the town's legend: {char: prop name} for props (the char stands where the prop's foot is), {char: [name, id, footprint]} for an enterable building (the char is the
walkway tile in front of its door). '.' and ' ' are open ground."""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); T = 32
GROUND = {'d': 'path', 'p': None, 'c': 'cobble', 't': 'tan', 's': 'soil', 'h': 'hay', 'g': 'grass', 'a': 'sand', 'Z': 'snow'}
COL = {'Z': (235, 240, 250), 'g': (90, 190, 90), 'a': (235, 215, 150), 'd': (196, 160, 110), 'p': (170, 170, 175), 'c': (150, 140, 130), 't': (215, 190, 140), 's': (120, 90, 60), 'h': (220, 200, 90)}

def _props():
    out = {}
    for f, key in (('tileset.js', None), ('tileset-derived.js', None)):
        s = open(os.path.join(ROOT, 'data', 'adv', f), encoding='utf8').read(); j = json.loads(s[s.index('{'):s.index('};') + 1] if f.endswith('derived.js') else s[s.index('{'):s.rindex('}') + 1])
        for n, d in j.get('props', {}).items():
            k = d.get('density') or 1; out.setdefault(n, {key_: d[key_] * k for key_ in ('sw', 'sh', 'ax', 'ay')} | {'door': [v * k for v in d.get('door', [0, -2])]})
    return out
PROPS = _props()
sys.path.insert(0, os.path.join(ROOT, 'tools')); import adv_labprops      # the map-lab object library (rg_<name>), the mockups' houses, trees and props
for _n, _v in adv_labprops.library().items(): _d = _v[4]; PROPS[_n] = {k_: _d[k_] for k_ in ('sw', 'sh', 'ax', 'ay')} | {'door': _d.get('door', [0, -2])}

def build(code, plan, legend, extra=None, blds=(), pp=()):
    """plan: the map as a string; legend: {char: prop name | [name, id, {w, d, ex}] | [name] (a building with no interior)}; extra: more JSON keys (deco, lim, noconnect...)"""
    rows = [r for r in plan.strip('\n').split('\n')]
    W = max(len(r) for r in rows); rows = [r.ljust(W) for r in rows]
    cy = next(i for i, r in enumerate(rows) if '@' in r); cx = rows[cy].index('@')
    rows[cy] = rows[cy][:cx] + rows[cy][cx - 1] + rows[cy][cx + 1:]   # the centre mark takes the ground beside it
    paving, props, buildings, door = [], [], [], None
    for y, r in enumerate(rows):                                      # paving: runs of one ground character on a row
        x = 0
        while x < W:
            ch = r[x]
            if ch in GROUND:
                x1 = x
                while x1 + 1 < W and r[x1 + 1] == ch: x1 += 1
                e = [x - cx, y - cy, x1 - cx, y - cy]; m = GROUND[ch]
                paving.append(e + [m] if m else e); x = x1 + 1
            else: x += 1
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in GROUND or ch in '. @' or ch not in legend: continue
            v = legend[ch]
            if isinstance(v, str): props.append([v, x - cx, y - cy])
            elif len(v) == 1: props.append([v[0], x - cx, y - cy - 1])            # scenery building: its foot on the row above the marked walkway
            elif v[1] in ('center', 'house'):                                      # a building with no interior (towns not fitted out yet): the generator's building_at, no room
                buildings.append([v[0], x - cx, y - cy])
                if v[1] == 'center': door = [x - cx, y - cy]
            else:
                b = [v[0], x - cx, y - cy, v[1], v[2]]; buildings.append(b)
                if v[1].endswith('-center'): door = [x - cx, y - cy]
    for b in buildings:                                               # a footprint must be open ground (the generator refuses paving under a building)
        if len(b) < 5: continue
        fp = b[4]; c0, r0 = b[1] - fp['ex'], b[2] - fp['d']
        bad = [(x, y) for y in range(r0, b[2]) for x in range(c0, c0 + fp['w']) if rows[y + cy][x + cx] in GROUND]
        if bad: print(f'  {code}: {b[3]} footprint lies on paving at {bad[:4]}')
    # plots and ponds (deco) must sit on open ground: no paving, no prop foot, clear of a building's ground (door row up 5, door column +-4) and one cell clear of everything
    taken = {(x - cx, y - cy) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch not in '. '}
    taken |= {(x, y) for ch, x, y in pp}
    for b in buildings:
        for y in range(b[2] - 6, b[2] + 1):
            for x in range(b[1] - 5, b[1] + 6): taken.add((x, y))
    for d in (extra or {}).get('deco', []):
        if d[0] not in ('plot', 'pond'): continue
        if d[0] == 'plot': x0, y0, w_, h_ = d[1] - 1, d[2] - 1, d[3] + 2, d[4] + 2
        else: x0, y0, w_, h_ = int(d[1] - d[3]) - 2, int(d[2] - d[4]) - 2, int(2 * d[3]) + 5, int(2 * d[4]) + 5
        hit = [(x, y) for y in range(y0, y0 + h_) for x in range(x0, x0 + w_) if (x, y) in taken]
        if hit: print(f'  {code}: {d[0]} at {d[1]},{d[2]} overlaps {len(hit)} taken cells, e.g. {hit[:3]}')
        for y in range(y0, y0 + h_):
            for x in range(x0, x0 + w_): taken.add((x, y))
    for ch, x, y in pp: props.append([legend[ch], x, y])               # Grid.at props
    for nm, x, y, role in blds:                                      # buildings placed by Grid.bld (no character needed): role 'center', 'house' or [id, footprint]
        if isinstance(role, list): buildings.append([nm, x, y, role[0], role[1]]); door = [x, y] if role[0].endswith('-center') else door
        else:
            buildings.append([nm, x, y])
            if role == 'center': door = [x, y]
    bx = []                                                           # sprite boxes of the buildings (tiles): two must not overlap, a prop foot must not stand in one
    for b in buildings:
        d = PROPS.get(b[0]); px = (b[1] + .5) * T - d['door'][0]; py = b[2] * T - 1
        bx.append((b[3] if len(b) > 3 else b[0], (px - d['ax']) / T, (py - d['ay']) / T, (px - d['ax'] + d['sw']) / T, (py - d['ay'] + d['sh']) / T, b[1], b[2]))
    for i, a_ in enumerate(bx):
        for b_ in bx[i + 1:]:
            if a_[1] < b_[3] - .3 and b_[1] < a_[3] - .3 and a_[2] < b_[4] - .3 and b_[2] < a_[4] - .3: print(f'  {code}: buildings overlap: {a_[0]} at {a_[5:]} and {b_[0]} at {b_[5:]}')
    for a_ in bx:                                                     # the building's base (its two bottom rows) must stand on open ground, not on a street
        hit = [(x, y) for y in (a_[6] - 2, a_[6] - 1) for x in range(int(a_[1] + .5), int(a_[3] - .5) + 1) if 0 <= y + cy < len(rows) and 0 <= x + cx < W and rows[y + cy][x + cx] in GROUND and rows[y + cy][x + cx] not in 'gaZ']
        if hit: print(f'  {code}: {a_[0]} at {a_[5:]} stands on paving at {hit[:3]}')
    for pr in props:
        for a_ in bx:
            if a_[1] + .5 < pr[1] + .5 < a_[3] - .5 and a_[2] + .5 < pr[2] + 1 < a_[4] - 1.2: print(f'  {code}: prop {pr[0]} at {pr[1:3]} stands inside {a_[0]}'); break
    unknown = sorted({ch for r in rows for ch in r if ch not in GROUND and ch not in '. @' and ch not in legend})
    assert not unknown, f'{code}: characters with no legend entry: {unknown}'
    out = dict(door=door, paving=paving, buildings=buildings, props=props, **(extra or {}))
    open(os.path.join(HERE, code + '.json'), 'w', encoding='utf8').write(json.dumps(out, separators=(',', ':')))
    # the look-at picture: 8 px a tile, ground colours, every sprite's box at its real size (buildings red, props blue), building footprints filled
    S = 12; im = Image.new('RGB', (W * S, len(rows) * S), (110, 170, 100)); dr = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in COL: dr.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=COL[ch])
    def box(n, fx, fy, col, door_x=None):
        d = PROPS.get(n)
        if not d: print(f'  {code}: unknown prop {n}'); return
        px = (fx + .5) * T - (d['door'][0] if door_x else 0); py = fy * T + (T - 1 if door_x is None else -1)
        x0, y0 = (px - d['ax']) / T, (py - d['ay']) / T
        dr.rectangle([(x0 + cx) * S, (y0 + cy) * S, (x0 + cx + d['sw'] / T) * S, (y0 + cy + d['sh'] / T) * S], outline=col)
    for b in buildings:
        box(b[0], b[1], b[2], (230, 40, 40), True)
        if len(b) < 5: continue
        fp = b[4]
        c0, r0 = b[1] - fp['ex'], b[2] - fp['d']; dr.rectangle([(c0 + cx) * S, (r0 + cy) * S, (c0 + fp['w'] + cx) * S - 1, (b[2] + cy) * S - 1], fill=(200, 80, 80))
    for p in props: box(p[0], p[1], p[2], (40, 60, 220))
    for d in (extra or {}).get('deco', []):
        if d[0] == 'plot': dr.rectangle([(d[1] + cx) * S, (d[2] + cy) * S, (d[1] + d[3] + cx) * S - 1, (d[2] + d[4] + cy) * S - 1], fill=COL['s' if d[5] == 0 else 'h'], outline=(90, 60, 30))
        if d[0] == 'pond': dr.ellipse([(d[1] - d[3] + cx) * S, (d[2] - d[4] + cy) * S, (d[1] + d[3] + cx) * S, (d[2] + d[4] + cy) * S], fill=(80, 150, 220))
    dr.rectangle([cx * S, cy * S, cx * S + S - 1, cy * S + S - 1], outline=(255, 255, 0))
    for k in range(-60, 61, 5):                                       # a grid every 5 tiles, labelled every 10, so the drawing can be read in plan coordinates
        if 0 <= k + cx < W: dr.line([((k + cx) * S, 0), ((k + cx) * S, len(rows) * S)], fill=(80, 130, 80) if k % 10 else (40, 90, 40))
        if 0 <= k + cy < len(rows): dr.line([(0, (k + cy) * S), (W * S, (k + cy) * S)], fill=(80, 130, 80) if k % 10 else (40, 90, 40))
        if k % 10 == 0:
            if 0 <= k + cx < W: dr.text(((k + cx) * S + 1, 1), str(k), fill=(255, 255, 255))
            if 0 <= k + cy < len(rows): dr.text((1, (k + cy) * S + 1), str(k), fill=(255, 255, 255))
    os.makedirs(os.path.join(ROOT, 'tools', '.cache'), exist_ok=True); im.save(os.path.join(ROOT, 'tools', '.cache', f'plan-{code}.png'))
    print(f'{code}.json written: {len(buildings)} buildings, {len(props)} props, {len(paving)} paving runs; centre at plan ({cx}, {cy}), plan {W} x {len(rows)}')
    return out


class Grid:
    """a town drawn on a (2N+1)^2 character grid, coordinates from the centre: rect / lane / at / blob, then build()"""
    def __init__(s, N): s.N = N; s.g = [['.'] * (2 * N + 1) for _ in range(2 * N + 1)]; s.blds = []; s.pp = []
    def bld(s, name, x, y, role='house'):
        """a building whose door walkway tile is (x, y): role 'center' (the town's Center, no interior), 'house', or [id, {w, d, ex}] for one with an interior"""
        s.blds.append((name, x, y, role))
    def put(s, x, y, ch):
        if -s.N <= x <= s.N and -s.N <= y <= s.N: s.g[y + s.N][x + s.N] = ch
    def get(s, x, y): return s.g[y + s.N][x + s.N] if -s.N <= x <= s.N and -s.N <= y <= s.N else None
    def rect(s, x0, y0, x1, y1, ch):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1): s.put(x, y, ch)
    def lane(s, pts, w=2, ch='d'):
        """straight legs between hand-set bend points, w cells wide (axis-aligned legs; the bends are where the points are)"""
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            if xa == xb: s.rect(xa, min(ya, yb), xa + w - 1, max(ya, yb) + (w - 1 if (xb, yb) == pts[-1] else 0), ch)
            else: s.rect(min(xa, xb), ya, max(xa, xb) + w - 1, ya + w - 1, ch)
    def at(s, ch, *pts):
        """props: kept apart from the ground grid, so a prop on a street or a plaza leaves the paving under it"""
        assert ch not in GROUND, f'{ch!r} is a ground character, not a prop'
        for x, y in pts:
            if -s.N <= x <= s.N and -s.N <= y <= s.N: s.pp.append((ch, x, y))
    def blob(s, cx, cy, rows, ch):
        """a hand-drawn shape: rows of characters, '#' cells get ch, centred on (cx, cy)"""
        h, w = len(rows), max(len(r) for r in rows)
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c == '#': s.put(cx - w // 2 + i, cy - h // 2 + j, ch)
    def row(s, ch, x0, y0, x1, y1, step=1):
        n = max(abs(x1 - x0), abs(y1 - y0)) // step
        for k in range(n + 1): s.put(x0 + (x1 - x0) * k // max(n, 1), y0 + (y1 - y0) * k // max(n, 1), ch)
    def text(s):
        g = [r[:] for r in s.g]; g[s.N][s.N] = '@'; return '\n'.join(''.join(r) for r in g)
