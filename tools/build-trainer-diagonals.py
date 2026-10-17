"""Builds 8-direction trainer sheets from the 4-direction HGSS sheets.
Rows out: down, downRight, right, upRight, up, upLeft, left, downLeft (same frame count).
Diagonals are generated per frame with pure pixel moves (column drops, row/column shifts, composites):
no resampling, no new colours. Left diagonals are made on mirrored inputs, so asymmetric sprites keep their own left side.
Run: py -3.12 -I tools/build-trainer-diagonals.py   (METHOD env var picks the generator; --compare writes the comparison PNGs)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC, OUT = os.path.join(ROOT, 'assets/trainer-ow'), os.path.join(ROOT, 'assets/trainer-ow8')
CACHE = os.path.join(ROOT, 'tools/.cache')
ROWS8 = ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft']
FW = FH = 32
TESTS = ['ethan', 'lorelei', 'lyra', 'giovanni', 'bruno', 'lance']


def span(a):
    xs = np.where(a[..., 3].any(0))[0]
    return (xs.min(), xs.max()) if len(xs) else (0, -1)


def rows_of(a):
    ys = np.where(a[..., 3].any(1))[0]
    return ys.min(), ys.max()


def shift(a, dx, dy=0):
    o = np.zeros_like(a)
    h, w = a.shape[:2]
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    o[yd, xd] = a[ys, xs]
    return o


def squeeze(a, n, lo=0.15, hi=0.5):
    """drop n interior columns of the opaque span (evenly spread in [lo,hi] of it), close the gap, keep right edge anchored"""
    x0, x1 = span(a)
    if x1 < 0 or n <= 0: return a
    w = x1 - x0 + 1
    drop = {x0 + int(round(w * (lo + (hi - lo) * (k + .5) / n))) for k in range(n)}
    keep = [x for x in range(x0, x1 + 1) if x not in drop]
    o = np.zeros_like(a)
    o[:, x1 + 1 - len(keep):x1 + 1] = a[:, keep]
    return o


def over(*layers):
    o = np.zeros_like(layers[0])
    for l in layers:
        m = l[..., 3] > 0
        o[m] = l[m]
    return o


def split(a, ratio=0.5):
    y0, y1 = rows_of(a)
    return y0 + int(round((y1 - y0 + 1) * ratio))


def recenter(o, refs):
    """put the output's bbox centre on the mean centre of the reference frames"""
    c = np.mean([sum(span(r)) / 2 for r in refs])
    x0, x1 = span(o)
    return shift(o, int(round(c - (x0 + x1) / 2)))


# ---- generators: take front (D or U), side (right-facing) and return a right-facing diagonal ----
def m_shear(F, S, ph):
    ys = split(S, .33)
    top, mid, bot = S.copy(), S.copy(), S.copy()
    top[ys:] = 0; mid[:ys] = 0; mid[split(S, .66):] = 0; bot[:split(S, .66)] = 0
    return over(shift(top, 1), shift(mid, 0), bot)


def m_squeeze(F, S, ph, legs='front'):
    ys = split(F, .5)
    head, body = F.copy(), F.copy()
    head[ys:] = 0; body[:ys] = 0
    wb = span(body); wh = span(head)
    head = shift(squeeze(head, max(1, (wh[1] - wh[0] + 1) // 6)), 1)
    if legs == 'side':
        yl = split(F, .78)
        body[yl:] = 0
        legs_ = S.copy(); legs_[:yl] = 0
        body = squeeze(body, max(1, (wb[1] - wb[0] + 1) // 6))
        return over(head, body, legs_)
    body = squeeze(body, max(1, (wb[1] - wb[0] + 1) // 6))
    return over(head, body)


def m_composite(F, S, ph, cuts=((0, .5), (.5, 1)), back=3):
    """per region: back part of the output from the side view, the rest from the front view"""
    out = []
    for lo, hi in cuts:
        ya, yb = split(F, lo), split(F, hi) if hi < 1 else FH + 9
        f, s = F.copy(), S.copy()
        f[:ya] = 0; f[yb:] = 0; s[:ya] = 0; s[yb:] = 0
        (fa, fb), (sa, sb) = span(f), span(s)
        if fb < 0 or sb < 0: out.append(f); continue
        w = (fb - fa + 1 + sb - sa + 1) // 2
        nb = max(1, w // back)
        o = np.zeros_like(f)
        o[:, 0:nb] = s[:, sa:sa + nb]
        o[:, nb:w] = f[:, fb + 1 - (w - nb):fb + 1]
        # keep the outer-right edge where the side view has it
        out.append(shift(o, sb + 1 - w))
    return over(*out)


def m_comp_sl(F, S, p):
    y = split(F, .78)
    legs = S.copy(); legs[:y] = 0
    return over(m_composite(F, S, p, ((0, .5), (.5, .78))), legs)


def m_hybrid(F, S, p):
    ys = split(F, .5)
    head = m_composite(F, S, p, ((0, .5),))
    body = F.copy(); body[:ys] = 0
    a, b = span(body)
    body = squeeze(body, max(1, (b - a + 1) // 5), .2, .45)
    ha, hb = span(head); a, b = span(body)
    body = shift(body, int(round((ha + hb) / 2 - (a + b) / 2)) + 1)
    return over(head, body)


METHODS = {'shear': m_shear, 'squeeze': m_squeeze, 'squeeze_sidelegs': lambda F, S, p: m_squeeze(F, S, p, 'side'), 'composite': m_composite,
           'hybrid': m_hybrid, 'comp_sl': lambda F, S, p: m_comp_sl(F, S, p)}
DEFAULT = 'hybrid'


def gen_diag(F, S, method):
    o = METHODS[method](F, S, None)
    return recenter(o, [F, S])


def load(name):
    a = np.array(Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'))
    return {r: [a[i * FH:(i + 1) * FH, c * FW:(c + 1) * FW] for c in range(a.shape[1] // FW)] for i, r in enumerate(['down', 'up', 'left', 'right'])}


def build(name, method):
    s = load(name)
    n = len(s['down'])
    fl = lambda a: a[:, ::-1]
    rows = {r: s[r] for r in ('down', 'up', 'left', 'right')}
    rows['downRight'] = [gen_diag(s['down'][i], s['right'][i], method) for i in range(n)]
    rows['upRight'] = [gen_diag(s['up'][i], s['right'][i], method) for i in range(n)]
    rows['downLeft'] = [fl(gen_diag(fl(s['down'][i]), fl(s['left'][i]), method)) for i in range(n)]
    rows['upLeft'] = [fl(gen_diag(fl(s['up'][i]), fl(s['left'][i]), method)) for i in range(n)]
    return rows, n


def sheet(rows, n):
    return Image.fromarray(np.vstack([np.hstack(rows[r]) for r in ROWS8]))


def label(img, txt):
    d = ImageDraw.Draw(img); d.rectangle((0, 0, len(txt) * 6 + 2, 9), fill=(0, 0, 0, 255)); d.text((1, -1), txt, fill=(255, 255, 255, 255))


def tile(a, t, bg=(200, 200, 200, 255)):
    im = Image.new('RGBA', (FW, FH), bg); im.alpha_composite(Image.fromarray(a)); return im.resize((FW * 6, FH * 6), Image.NEAREST)


def compare(methods, path, frames=(0,)):
    cols = ['down', 'right', 'up']
    W = (3 + 2 * len(methods) * len(frames)) * FW * 6 + 8 * (3 + 2 * len(methods) * len(frames))
    H = len(TESTS) * (FH * 6 + 6) + 14
    im = Image.new('RGBA', (W, H), (60, 60, 60, 255))
    d = ImageDraw.Draw(im)
    for r, name in enumerate(TESTS):
        s = load(name); y = 14 + r * (FH * 6 + 6); x = 0
        for c in cols:
            im.paste(tile(s[c][0], 0), (x, y)); x += FW * 6 + 8
        for m in methods:
            rows, n = build(name, m)
            for f in frames:
                for dn in ('downRight', 'upRight'):
                    im.paste(tile(rows[dn][f], 0), (x, y)); x += FW * 6 + 8
        d.text((2, y + 2), name, fill=(0, 0, 0, 255))
    x = 0
    for c in cols: d.text((x + 2, 1), 'src ' + c, fill=(255, 255, 255, 255)); x += FW * 6 + 8
    for m in methods:
        for f in frames:
            for dn in ('downRight', 'upRight'): d.text((x + 2, 1), f'{m[:9]} {dn[:2]} f{f}', fill=(255, 255, 255, 255)); x += FW * 6 + 8
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


def main():
    method = os.environ.get('METHOD', DEFAULT)
    if '--methods' in sys.argv: compare(list(METHODS), os.path.join(CACHE, 'diag-methods.png')); return
    if '--compare' in sys.argv: compare([method], os.path.join(CACHE, 'diag-compare.png'), (0, 1)); return
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for f in sorted(os.listdir(SRC)):
        name, ext = os.path.splitext(f)
        if ext != '.png' or name.startswith('_'): continue
        rows, n = build(name, method)
        sheet(rows, n).save(os.path.join(OUT, f))
        meta[name] = dict(file=f'assets/trainer-ow8/{f}', fw=FW, fh=FH, frames=n, rows=ROWS8, footY=29)
    with open(os.path.join(ROOT, 'data/trainer-ow8.js'), 'w') as fh:
        fh.write('// Generated by tools/build-trainer-diagonals.py\nwindow.TRAINER_OW8 = ' + json.dumps(meta, indent=1) + ';\n')
    print(len(meta), 'sheets')


if __name__ == '__main__':
    main()
