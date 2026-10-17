"""Prototype of sun-cast shadows for the map lab previews (not the game): every stamp and actor casts its own silhouette, projected
from its foot along the sun, and cliffs cast their height onto lower ground. All casters go into ONE mask, so overlaps never darken
twice, and the mask is laid on the terrain before anything stands on it, so a caster always covers its own shadow.
  py -3.12 -I maplab/shadowproto.py <map name> <out.png> <hour> [<hour> ...]     (hours 6..18; one panel per hour, side by side)"""
import json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import render as R

FACE = 32          # world px of height per cliff level (the sets draw a 2-tile face)
ALPHA = 0.34       # one flat pixel-art shadow tone


def sun(hour):
    """sun at `hour` for a sun that crosses the NORTH sky (southern hemisphere): (shadow dx, dy per px of height), elevation in degrees"""
    t = (hour - 6) / 12                                   # 0 sunrise (east) .. 1 sunset (west)
    az = math.radians(90 - 180 * t)                       # compass bearing of the sun measured from north: 90 east -> 0 north -> -90 west
    el = max(8.0, 70 * math.sin(math.pi * t))             # low at the ends, 70 degrees at noon
    k = 1 / math.tan(math.radians(el))
    return (-math.sin(az) * k, math.cos(az) * k), el      # away from the sun; screen y grows south


def cast(mask, sprite, x0, y0, d, hscale=1.0):
    """project the opaque pixels of `sprite` (top-left at x0, y0, foot = its lowest opaque row) along d into mask"""
    a = np.array(sprite)[..., 3] >= 128
    if not a.any(): return
    ys, xs = np.nonzero(a); foot = ys.max()
    h = (foot - ys) * hscale
    n = int(math.ceil(max(abs(d[0]), abs(d[1])) * hscale)) + 1   # sub-steps so tall sprites leave no gaps
    for s in range(n):
        hh = h + s / n * hscale
        px = np.round(x0 + xs + hh * d[0]).astype(int); py = np.round(y0 + foot + hh * d[1]).astype(int)
        ok = (px >= 0) & (py >= 0) & (px < mask.shape[1]) & (py < mask.shape[0])
        mask[py[ok], px[ok]] = True


def cast_box(mask, sprite, x0, y0, d, wall):
    """a building is a box, not a card: its ground footprint is its sprite shifted down by the wall height (the roof sits over it),
    cut off at the foot; sweep that footprint along the sun for the wall height, so the shadow starts flush at the base"""
    a = np.array(sprite)[..., 3] >= 128
    if not a.any(): return
    foot = np.nonzero(a)[0].max()
    fp = np.zeros_like(a); fp[wall:foot + 1] = a[:foot + 1 - wall]; fp[foot - wall + 1:foot + 1] |= a[foot - wall + 1:foot + 1]
    ys, xs = np.nonzero(fp)
    n = int(math.ceil(max(abs(d[0]), abs(d[1])) * wall)) + 1
    for s in range(n + 1):
        px = np.round(x0 + xs + s / n * wall * d[0]).astype(int); py = np.round(y0 + ys + s / n * wall * d[1]).astype(int)
        ok = (px >= 0) & (py >= 0) & (px < mask.shape[1]) & (py < mask.shape[0])
        mask[py[ok], px[ok]] = True


def tint(hour):
    """flat shadow colour by time: cool blue at midday, warm purple near sunrise and sunset"""
    k = min(1.0, abs(hour - 12) / 6) ** 2
    return tuple(int(c0 + (c1 - c0) * k) for c0, c1 in zip((20, 28, 60), (48, 20, 56)))


BUILDINGS = ('pc4', 'mart4', 'sandhall', 'straw', 'straw2', 'hut_round', 'house', 'dome', 'greenhouse')


def shade(name, hours, out):
    mp = json.load(open(os.path.join(HERE, 'maps', name + '.json')))
    W, H = mp['size']; T = R.T
    lv = np.array([[int(c) if c.isdigit() else 0 for c in row] for row in mp['cliffs']])
    panels = []
    for hour in hours:
        d, el = sun(hour)
        base = R.render({**mp, 'objects': [], 'actors': []})              # terrain only
        mask = np.zeros((H * T, W * T), bool); own = np.zeros((H * T, W * T), int)   # own = level a shadow pixel belongs to
        # cliffs: each raised cell is a column FACE * level tall standing on its cell; sweep its footprint along the sun
        for y in range(H):
            for x in range(W):
                L = lv[y, x]
                if not L: continue
                n = int(FACE * L * max(abs(d[0]), abs(d[1]))) + 1
                for s in range(n + 1):
                    ox, oy = round(x * T + s / n * FACE * L * d[0]), round(y * T + s / n * FACE * L * d[1])
                    x0, y0, x1, y1 = max(0, ox), max(0, oy), min(W * T, ox + T), min(H * T, oy + T)
                    if x0 < x1 and y0 < y1: mask[y0:y1, x0:x1] |= True; own[y0:y1, x0:x1] = np.maximum(own[y0:y1, x0:x1], L)
        cellv = np.kron(lv, np.ones((T, T), int))                          # receiver level per px
        mask &= own > cellv                                                # cliff shadow only on lower ground
        obj = np.zeros_like(mask)
        for n_, x, y in mp['objects']:
            ox, oy = R.nudge(n_)
            im = R.obj_image(n_)
            if n_.startswith(BUILDINGS): cast_box(obj, im, x * T + ox, y * T + oy, d, int(im.height * 0.4))   # ponytail: wall = 40% of sprite height, author per building in the game
            else: cast(obj, im, x * T + ox, y * T + oy, d)
        for kind, who, x, y, dd in mp['actors']:
            f, foot = R.npc_frame(who, dd) if kind == 'npc' else R.mon_frame(who, dd)
            cast(obj, f, x * T + 8 - f.width // 2, y * T + 13 - foot, d)
        mask |= obj
        sh = np.zeros((H * T, W * T, 4), np.uint8); sh[mask] = (*tint(hour), int(255 * ALPHA))
        base.alpha_composite(Image.fromarray(sh))
        # then everything that stands, exactly as the normal render draws it
        full = R.render(mp); terrain = R.render({**mp, 'objects': [], 'actors': []})
        diff = np.any(np.array(full) != np.array(terrain), axis=2)        # pixels a stamp or actor painted
        out_im = np.array(base); out_im[diff] = np.array(full)[diff]
        panels.append(Image.fromarray(out_im))
        print(f'{hour:>5}h  elevation {el:4.1f}  shadow per px of height ({d[0]:+.2f}, {d[1]:+.2f})')
    W2 = sum(p.width for p in panels) + 8 * (len(panels) - 1)
    sheet = Image.new('RGBA', (W2, panels[0].height), (0, 0, 0, 255)); x = 0
    for p in panels: sheet.paste(p, (x, 0)); x += p.width + 8
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(out)


if __name__ == '__main__':
    shade(sys.argv[1], [float(h) for h in sys.argv[3:]] or [8, 12, 16.5], sys.argv[2])
