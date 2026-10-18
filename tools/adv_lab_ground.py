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
    # paths as the lab draws them (docs/REGION-REBUILD.md section 17): a layer of quarter tiles over the ground, one game cell = 2 x 2 lab cells with nothing
    # carved off, so a 1 tile path is the mockups' path and its edge art falls half on the path, half on the grass beside it. Quarter q of a cell (0 NW,
    # 1 NE, 2 SW, 3 SE) depends on 4 cells: the cell itself, its two edge neighbours on that side and the diagonal one; bits self | vertical << 1 |
    # horizontal << 2 | diagonal << 3. quad[q * 16 + bits] is a 32 px tile clear but for that quarter (the plain ground pixels clear too).
    import numpy as np
    QD = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    def quads(ch, base='grass'):
        p0, m0 = render(['.' * (2 * G)] * (2 * G), base); plain = np.array(cut(p0, m0).convert('RGBA'))
        out = []
        for q, (hx, vy) in enumerate(QD):
            for bits in range(16):
                on = {(0, 0): bits & 1, (0, vy): bits >> 1 & 1, (hx, 0): bits >> 2 & 1, (hx, vy): bits >> 3 & 1}
                rows = [''.join(ch if on.get((lx // 2 - G // 2, ly // 2 - G // 2), 0) else '.' for lx in range(2 * G)) for ly in range(2 * G)]
                im, M = render(rows, base); t = np.array(cut(im, M).convert('RGBA'))
                keep = np.zeros(t.shape[:2], bool); qx, qy = (16 if hx > 0 else 0), (16 if vy > 0 else 0); keep[qy:qy + 16, qx:qx + 16] = True
                t[~keep | (t == plain).all(2)] = 0
                out.append(t)
        return out
    QPATH = quads('d')
    mats['pond'] = {'C': mats['grass']['C'][0], 'quad': [add(Image.fromarray(t)) if t[..., 3].any() else -1 for t in quads('v')]}   # village ponds: the mockups' sand ringed pool
    mats['path']['quad'] = [add(Image.fromarray(t)) if t[..., 3].any() else -1 for t in QPATH]
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
    LABBASE = {'snow': ('snow', 'd'), 'dune': ('desert', 'p')}   # grounds the lab draws paths on itself: the snow blanket's banks, the desert's worn lanes
    for key, mname in GROUNDS.items():
        c = ts['mats'][mname]['C']; base = np.array(etile(c[0] if isinstance(c, list) else c)); d = {}
        if key in LABBASE:   # the lab's own path on that ground: quarter tiles rendered on that base, its plain ground left clear (the game's own tile shows)
            d['quad'] = [add(Image.fromarray(t)) if t[..., 3].any() else -1 for t in quads(LABBASE[key][1], LABBASE[key][0])]
        else:                # the meadow quarter tiles with their green pixels cleared, so that ground shows through the fringe
            qs = []
            for t in QPATH:
                t = t.copy(); r_, g_, b_ = (t[..., k].astype(int) for k in range(3)); t[(g_ > r_ + 12) & (g_ > b_ + 6)] = 0
                qs.append(add(Image.fromarray(t)) if t[..., 3].any() else -1)
            d['quad'] = qs
        if key in LABBASE:   # the lab's own path on that ground; its plain ground pixels (equal to the same spot rendered with no path) become the game's tile
            lb, lc = LABBASE[key]; p0, m0 = render(['.' * (2 * G)] * (2 * G), lb); plain0 = np.array(cut(p0, m0).convert('RGBA'))
            for role in ROLES:
                im, M = render(lab_ground(role_cells(role), lc), lb); t = np.array(cut(im, M).convert('RGBA'))
                same = (t == plain0).all(2); t[same] = base[same]; d[role] = add(Image.fromarray(t))
            by[key] = d; continue
        for role in [r for r in mats['path'] if r not in ('by', 'mode', 'quad')]:
            t = np.array(tiles[mats['path'][role]]); r_, g_, b_ = (t[..., k].astype(int) for k in range(3))
            green = (g_ > r_ + 12) & (g_ > b_ + 6)
            t[green] = base[green]; d[role] = add(Image.fromarray(t))
        by[key] = d
    mats['path']['by'] = by
    # cliff rims and face tops on any ground: the exterior sheet's cliff art paints the raised ground as its own light grass, a green block on snow and a paler
    # strip on the lab meadow. Each copy keeps the art's lip, outline and rock and swaps the green pixels for that ground's centre tile (adv-render.js cliff)
    plain = min(mats['grass']['C'], key=lambda i: int((lambda a: (a[..., 0] > a[..., 1] + 20).sum())(np.array(tiles[i]).astype(int))))   # a meadow tile with no tuft or flower in it
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
