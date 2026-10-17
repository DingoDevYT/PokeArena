"""The map-lab look for the generated world's ground (docs/REGION-REBUILD.md section 14): grass, dirt paths and tall grass drawn with the lab sheet's art
(maplab/tileset.png, the same tiles the hand-built windows are baked from), so a generated route and a lab window read as one ground.
  tools/adv-region-export.py calls build() and appends the tiles to the region sheet, whose mats win over the exterior sheet's in adv-world.js lookup.
  py -3.12 -I tools/adv_lab_ground.py     writes tools/.cache/lab-ground.png + .json alone, to look at
The engine autotiles a ground by 13 cell roles (C, the 4 sides, 4 outer and 4 inner corners); the lab draws a ground as a dual grid (16 px tiles centred on the lab cell corners).
Each role is rendered by the lab renderer itself on a small lab map whose ground is laid out for that role, and the centre game cell (2 x 2 lab cells, 32 px) is cut out.
The ground of a game cell is eroded by one lab cell along every side (and corner) that faces another ground, so the whole transition sits inside the cell and a neighbour
of the other ground stays plain. Nothing is drawn: every pixel is the lab renderer's composite of real tiles."""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'maplab'))
import render as R

ROLES = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW']
OUT = os.path.join(ROOT, 'tools', '.cache')
G = 5                                                  # game cells per side of a role map; the role cell is the middle one
def role_cells(role):
    """which game cells round the middle one (dx, dy in -1..1) are this ground, for a role; the outer ring copies its nearest inner cell"""
    other = {'N': [(0, -1), (-1, -1), (1, -1)], 'S': [(0, 1), (-1, 1), (1, 1)], 'E': [(1, 0), (1, -1), (1, 1)], 'W': [(-1, 0), (-1, -1), (-1, 1)],
             'iNE': [(1, -1)], 'iNW': [(-1, -1)], 'iSE': [(1, 1)], 'iSW': [(-1, 1)], 'C': []}
    off = set()
    for part in ([role] if role in other else [role[0], role[1]]): off |= set(other[part])
    return lambda dx, dy: (max(-1, min(1, dx)), max(-1, min(1, dy))) not in off
def lab_ground(on, ch):
    """a lab ground layer for G x G game cells: lab cell (lx, ly) is `ch` where its game cell is on and it is not on a side or corner that faces an off cell"""
    rows = []
    for ly in range(2 * G):
        r = ''
        for lx in range(2 * G):
            gx, gy, sx, sy = lx // 2 - G // 2, ly // 2 - G // 2, lx % 2, ly % 2
            ox, oy = (1 if sx else -1), (1 if sy else -1)
            keep = on(gx, gy) and on(gx + ox, gy) and on(gx, gy + oy) and on(gx + ox, gy + oy)
            r += ch if keep else '.'
        rows.append(r)
    return rows
def render(ground, base='grass', seed=0):
    n = 2 * G; blank = ['.' * n] * n
    mp = dict(name=f'lab-ground-{seed}', size=[n, n], base=base, ground=ground, ridges=blank, cliffs=blank, fences=blank, objects=[], actors=[])
    im = R.render(mp); M = (im.width - n * R.T) // 2      # the renderer pads the map by a margin
    return im, M
def cut(im, M, gx=0, gy=0):
    x0 = M + (G // 2 + gx) * 2 * R.T; y0 = M + (G // 2 + gy) * 2 * R.T
    return im.crop((x0, y0, x0 + 2 * R.T, y0 + 2 * R.T))

DIAG = {'NE': ((1, -1), 'N'), 'NW': ((-1, -1), 'N'), 'SE': ((1, 1), 'S'), 'SW': ((-1, 1), 'S')}
def diag_tile(src, fill, ground, n, vs, off, phase, band=7):
    """src: the straight edge tile (32 x 32 RGBA, the other ground on the vs side: 'N' top or 'S' bottom, the edge on row 16); fill / ground: this set's centre
    tile and the plain ground beside it (they paint everything more than `band` px from the line, pixel for pixel, so the texture runs on into the neighbours);
    n: the normal pointing into the other ground; off: where the line sits (+11.31 through the outer cell's lower step, -11.31 through the inner cell's upper
    step); phase: where this cell starts along the edge (the edge art repeats once per cell along the line, so neighbouring diagonal cells join)"""
    import numpy as np
    a, f, gr = (np.array(im.convert('RGBA')) for im in (src, fill, ground)); o = np.zeros_like(a); k = 2 ** -.5; nx, ny = n[0] * k, n[1] * k; tx, ty = -ny, nx
    for y in range(32):
        for x in range(32):
            u, v = x + .5 - 16, y + .5 - 16
            d = u * nx + v * ny + off                                   # distance into the other ground
            if d > band: o[y, x] = gr[y, x]; continue
            if d < -band: o[y, x] = f[y, x]; continue
            row = 16 - d if vs == 'N' else 16 + d
            t = (u * tx + v * ty) * k + 16 + phase                      # along the edge, one art period per cell
            sr, sc = int(min(31, max(0, round(row - .5)))), int(round(t - .5)) % 32
            px = a[sr, sc]
            if (px == gr[sr, sc]).all() and d > 0: o[y, x] = gr[y, x]       # plain ground in the source: keep this cell's own ground (no stretched texture)
            elif (px == f[sr, sc]).all() and d < 0: o[y, x] = f[y, x]        # plain fill in the source: keep this cell's own fill
            else: o[y, x] = px
    return Image.fromarray(o)
def diagonals(tiles, d, add, ground):
    """the eight diagonal roles of one autotile set (role -> tile index into tiles): dXX outer corners, eXX inner corners"""
    out = {}; first = lambda v: v[0] if isinstance(v, list) else v; fill = tiles[first(d['C'])]
    for o, (n, vs) in DIAG.items():
        src = tiles[first(d[vs])]; k = 2 ** -.5; tx, ty = -n[1] * k, n[0] * k; oy = 32 if vs == 'N' else -32
        out['d' + o] = add(diag_tile(src, fill, ground, n, vs, 16 * k, 0)); out['e' + o] = add(diag_tile(src, fill, ground, n, vs, -16 * k, oy * ty * k))
    import numpy as np
    for o, (p_, q_) in {'NE': ('eNE', 'eSW'), 'NW': ('eNW', 'eSE')}.items():          # a 3 wide diagonal: the middle cell is an inner corner of both edges at once
        A, Bq, F = (np.array(tiles[i]) if not isinstance(i, Image.Image) else np.array(i) for i in (out[p_], out[q_], fill))
        m = (Bq != F).any(2); A[m] = Bq[m]; out['x' + o] = add(Image.fromarray(A))
    return out

def build():
    """(tiles, mats): 32 px RGBA tiles and {mat: {role: index or [indices]}} into them"""
    tiles = []; mats = {}
    def add(im): tiles.append(im.convert('RGBA')); return len(tiles) - 1
    # grass: the lab meadow, cut at many cells of a plain map (its scatter of decorated tiles is the renderer's own)
    big = dict(name='lab-grass', size=[64, 64], base='grass', ground=['.' * 64] * 64, ridges=['.' * 64] * 64, cliffs=['.' * 64] * 64, fences=['.' * 64] * 64, objects=[], actors=[])
    gim = R.render(big); gM = (gim.width - 64 * R.T) // 2
    mats['grass'] = {'C': [add(gim.crop((gM + x * 32, gM + y * 32, gM + x * 32 + 32, gM + y * 32 + 32))) for y in range(0, 32, 3) for x in range(0, 32, 5)]}
    # dirt path ('d') and tall grass ('t') by role
    mats['wetGrass'] = {'C': mats['grass']['C'][:]}      # the damp meadow reads as the meadow (its own pale fill broke the ground into blocks)
    for name, ch in (('path', 'd'), ('tallgrass', 't'), ('ford', 'w')):     # ford: puddles and village ponds, the lab's water with its rocky grass shore (drawn per lab cell, so it stays inside the game cell)
        d = {}
        for role in ROLES:
            im, M = render(lab_ground(role_cells(role), ch)); t = cut(im, M)
            if name == 'tallgrass':   # an overlay: keep only the blades (the pixels the bed changed on the meadow under it), so it can stand over the feet too (adv-render.js wade)
                b0, b1 = render(['.' * (2 * G)] * (2 * G)); b = cut(b0, b1).convert('RGBA'); t = t.convert('RGBA'); px, pb = t.load(), b.load()
                for y in range(t.height):
                    for x in range(t.width):
                        if px[x, y][:3] == pb[x, y][:3]: px[x, y] = (0, 0, 0, 0)
            d[role] = add(t)
        mats[name] = d
    # diagonal edges (the owner allowed derived diagonal tiles): a 45 degree road edge runs through the middle of each staircase step, so an outer-corner cell
    # (dNE...) keeps the small triangle of path below the line and the inner-corner cell under it (eNE...) loses the small triangle above it. Each pixel is
    # resampled from the straight edge tile of the same side (N or S) at the same distance across the edge, its along-edge position taken from the line, so
    # the fringe, the outline and the dirt are the original art laid at 45 degrees.
    import numpy as np
    plain = min(mats['grass']['C'], key=lambda i: int((lambda a: (a[..., 0] > a[..., 1] + 20).sum())(np.array(tiles[i]).astype(int))))   # a meadow tile with no tuft or flower in it
    for name in ('path', 'ford'):
        mats[name].update(diagonals(tiles, mats[name], add, tiles[plain]))
    # path and tall grass on the other grounds (snow, ash, swamp, sand, dune): the lab art is drawn on the meadow, so its edges carry grass. For a path the green
    # pixels of each role tile are replaced by that ground's own centre tile (the same edit tools/adv-build-derived.py makes); a tall grass bed on those grounds takes
    # the derived sheet's own tile for that ground (frost leaves, grey tufts...), copied pixel for pixel. adv-world.js picks them by the neighbour's ground (def.by).
    import numpy as np, json as _j
    ts = _j.loads(open(os.path.join(ROOT, 'data/adv/tileset.js')).read().split('=', 1)[1].strip().rstrip(';'))
    ex = Image.open(os.path.join(ROOT, ts['file'])).convert('RGBA'); EC = ts.get('cols', 8)
    etile = lambda i: ex.crop(((i % EC) * 32, (i // EC) * 32, (i % EC) * 32 + 32, (i // EC) * 32 + 32))
    dsrc = open(os.path.join(ROOT, 'data/adv/tileset-derived.js')).read(); dv = _j.loads(dsrc[dsrc.index('{'):dsrc.index('};') + 1])
    dim = Image.open(os.path.join(ROOT, dv['file'])).convert('RGBA'); DC = dv['cols']
    dtile = lambda i: dim.crop(((i % DC) * 32, (i // DC) * 32, (i % DC) * 32 + 32, (i // DC) * 32 + 32))
    GROUNDS = {'snow': 'snow', 'ash': 'ashGround', 'swamp': 'swamp', 'sand': 'sand', 'dune': 'duneSand'}
    by = {}
    for key, mname in GROUNDS.items():
        c = ts['mats'][mname]['C']; base = np.array(etile(c[0] if isinstance(c, list) else c)); d = {}
        for role in [r for r in mats['path'] if r not in ('by', 'mode')]:
            t = np.array(tiles[mats['path'][role]]); r_, g_, b_ = (t[..., k].astype(int) for k in range(3))
            green = (g_ > r_ + 12) & (g_ > b_ + 6)
            t[green] = base[green]; d[role] = add(Image.fromarray(t))
        by[key] = d
    mats['path']['by'] = by
    # cliff rims and face tops on any ground: the exterior sheet's cliff art paints the raised ground as its own light grass, a green block on snow and a paler
    # strip on the lab meadow. Each copy keeps the art's lip, outline and rock and swaps the green pixels for that ground's centre tile (adv-render.js cliff)
    cb = {}
    for key, gt in [('grass', np.array(tiles[plain]))] + [(k, np.array(etile((lambda c: c[0] if isinstance(c, list) else c)(ts['mats'][m]['C'])))) for k, m in GROUNDS.items()]:
        d = {}
        for name, v in ts['cliff'].items():
            if not (name.startswith('rim') or name == 'faceTop'): continue
            def one(i):
                t = np.array(etile(i)); r_, g_, b_ = (t[..., k].astype(int) for k in range(3)); green = (g_ > r_ + 12) & (g_ > b_ + 6) & (t[..., 3] > 0)
                t[green] = gt[green]; return add(Image.fromarray(t))
            d[name] = {r: one(i) for r, i in v.items()} if isinstance(v, dict) else one(v)
        cb[key] = d
    mats['cliffBy'] = cb
    # shoreline diagonals: the exterior sheet's water draws its shore on the cell edge, so a 45 degree coast cuts each outer corner cell from corner to corner.
    # dXX keeps the water half (its rim resampled from the straight N or S edge tile, across the slant) and leaves the land half clear; adv-render.js draws
    # the land neighbour's own ground under it (mode 'under'), and adv-water.js masks and foams the water pixels as on any edge tile.
    seen = {}
    def ecopy(i):
        if i not in seen: seen[i] = add(etile(i))
        return seen[i]
    for m in ('water', 'waterDeep', 'sandWater', 'sandWaterDeep'):
        src = ts['mats']['water' if m == 'waterDeep' else 'sandWater' if m == 'sandWaterDeep' else m]   # deep water draws as the shallow: its darker tile only stepped in square blocks along a slanted shore, and adv-water.js already darkens the water by its distance from the shore
        d = {r: ([ecopy(i) for i in v] if isinstance(v, list) else ecopy(v)) for r, v in src.items() if r in ROLES}
        first = lambda v: v[0] if isinstance(v, list) else v
        C = np.array(etile(first(src['C'])))
        for o, (n, vs) in DIAG.items():
            E = np.array(etile(first(src[vs]))); k = 2 ** -.5; nx, ny = n[0] * k, n[1] * k; tx, ty = -ny, nx; o_ = np.zeros_like(C)
            for y in range(32):
                for x in range(32):
                    u, v = x + .5 - 16, y + .5 - 16; dep = -(u * nx + v * ny)          # px into the water from the corner to corner line
                    if dep < 0: continue
                    if dep > 8: o_[y, x] = C[y, x]; continue
                    row = int(min(31, dep)) if vs == 'N' else 31 - int(min(31, dep)); col = int((u * tx + v * ty) * k + 16) % 32
                    o_[y, x] = E[row, col]
            d['d' + o] = add(Image.fromarray(o_))
        d['mode'] = 'under'; mats[m] = d
    tb = dv['mats']['tallgrass'].get('by', {})
    mats['tallgrass'] = {**mats['tallgrass'], 'mode': 'self', 'by': {k: {'C': add(dtile(v['C'] if not isinstance(v['C'], list) else v['C'][0]))} for k, v in tb.items()}}
    return tiles, mats

def main():
    tiles, mats = build(); cols = 16; rows = -(-len(tiles) // cols)
    sheet = Image.new('RGBA', (cols * 32, rows * 32))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * 32, (i // cols) * 32))
    os.makedirs(OUT, exist_ok=True); sheet.save(os.path.join(OUT, 'lab-ground.png'))
    json.dump(dict(cols=cols, mats=mats), open(os.path.join(OUT, 'lab-ground.json'), 'w'))
    print(len(tiles), 'tiles', {k: (len(v['C']) if isinstance(v.get('C'), list) else len(v)) for k, v in mats.items()}, 'path by', list(mats['path']['by']))

if __name__ == '__main__': main()
