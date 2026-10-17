"""Cuts the community sprites (RPG Maker XP style sheets in tools/.cache/tilesets, credits in tools/.cache/tilesets/CREDITS.md) for the exterior
sheet. tools/adv-build-tileset.py calls collect() and appends every sprite below the original sheet, so there is ONE exterior sheet and no engine
change: 2x pixel art (SailorVicious, Magiscarf, WilsonScarloxy, JesusCarrasco) gets density 0.5 on its prop def (drawn 1:1 outdoors, one art pixel
per world pixel), the 1x authors (Mataraelfay, PixelMister) get none.
No baked drop shadows (owner rule 2026-10-15): flat baked shadow colours (flood from the rect border) and baked ground squares become transparent,
as does every pixel with alpha < 200 (tools/adv-build-tileset.py strips the dark translucent ones from the whole sheet again before saving).
Rects are tightened to the sprite, anchors and solid rects are derived like adv-build-tileset.py does. No art is drawn here, every pixel comes from
a source sheet; composite buildings only place real source pieces side by side.
Run: py -3.12 -I tools/adv-build-community.py      (writes the contact sheets tools/.cache/comm/verify-*.png, door yellow, anchor red, solid blue)
Catalogue data: tools/adv-community-items.py (CATALOG)."""
import runpy
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/.cache/tilesets'

SHEETS = {
    'jesus1': 'JesusCarrasco/Iq3ve5r.png', 'jesus2': 'JesusCarrasco/N2tpJgO.png', 'jesus3': 'JesusCarrasco/sV7nFlm.png',
    'magi': 'Magiscarf/as2jJ0E.png', 'sailor1': 'SailorVicious/IMolfXl.png', 'sailor2': 'SailorVicious/uGG3eqm.png',
    'wilson1': 'WilsonScarloxy/rrwiIXt.png', 'wilson2': 'WilsonScarloxy/w4vzAdo.png',
    'matara': 'Mataraelfay/5pj8QXY.png', 'pix': 'PixelMister/CHrIcsm.png',
}
AUTHOR = {'jesus1': 'JesusCarrasco', 'jesus2': 'JesusCarrasco', 'jesus3': 'JesusCarrasco', 'magi': 'Magiscarf', 'sailor1': 'SailorVicious', 'sailor2': 'SailorVicious',
          'wilson1': 'WilsonScarloxy', 'wilson2': 'WilsonScarloxy', 'matara': 'Mataraelfay', 'pix': 'PixelMister'}
SOURCE = {'JesusCarrasco': 'https://imgur.com/a/w9fsmCQ', 'Magiscarf': 'https://imgur.com/a/KzqY9J3', 'SailorVicious': 'https://imgur.com/a/rO7WwAr',
          'WilsonScarloxy': 'https://imgur.com/a/XwzHyLb', 'Mataraelfay': 'https://imgur.com/a/A2vNQlT', 'PixelMister': 'https://imgur.com/a/A5Ed9fd'}
DENSITY = {'matara': 1.0, 'pix': 1.0}               # art px per sheet px; the 2x authors are 0.5
# flat colours these sheets bake in for cast shadows (sampled from the sheets); an item may name its own list with sh=[...]
SHADOW = {
    'sailor1': [(80, 45, 87)], 'sailor2': [(80, 45, 87)],
    'jesus1': [(143, 112, 112), (197, 180, 180), (167, 143, 143)], 'jesus2': [(143, 112, 112), (197, 180, 180), (167, 143, 143)],
    'magi': [(177, 191, 195)], 'wilson2': [(128, 128, 128)], 'wilson1': [], 'jesus3': [], 'matara': [], 'pix': [],
}
_cache = {}


def dens(key): return DENSITY.get(key, 0.5)


def sheet(key):
    if key not in _cache: _cache[key] = np.array(Image.open(SRC / SHEETS[key]).convert('RGBA'))
    return _cache[key]


def _flood_edge(a, cols):
    m = np.zeros(a.shape[:2], bool)
    for c in cols: m |= (a[..., :3] == np.array(c, np.uint8)).all(-1) & (a[..., 3] == 255)
    lab, _ = ndi.label(m | (a[..., 3] == 0))
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    return m & np.isin(lab, list(edge))


def clear_flat(a, cols):
    """flat baked shadow or ground colours connected to the rect border (through those colours or transparency) become transparent"""
    if not cols: return a
    hit = _flood_edge(a, cols); a = a.copy(); a[hit] = 0
    return a


def raw(key, x, y, w, h):
    s = sheet(key)
    out = np.zeros((h, w, 4), np.uint8)
    ys, xs, ye, xe = max(0, y), max(0, x), min(s.shape[0], y + h), min(s.shape[1], x + w)
    out[ys - y:ye - y, xs - x:xe - x] = s[ys:ye, xs:xe]
    return out


def drop_strays(a):
    """pieces of the neighbouring sprites inside a loose rect: separate blobs (even after a 2 px dilation) that touch the rect edge and are under 15 percent of the main sprite"""
    op = a[..., 3] > 0
    if op.sum() < 40: return a
    lab, n = ndi.label(ndi.binary_dilation(op, np.ones((3, 3), bool), iterations=2), np.ones((3, 3)))
    cnt = ndi.sum(op, lab, range(1, n + 1)); main = int(np.argmax(cnt)) + 1; out = a.copy(); h, w = op.shape
    for i in range(1, n + 1):
        if i == main: continue
        m = op & (lab == i); ys, xs = np.nonzero(m)
        if len(ys) and (ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1) and m.sum() < cnt[main - 1] * .15: out[m] = 0
    return out


def finish(out, key, sh=None, clr=None, ex=None, org=(0, 0)):
    for (ex_, ey_, ew_, eh_) in (ex or []): out[max(0, ey_ - org[1]):max(0, ey_ - org[1] + eh_), max(0, ex_ - org[0]):max(0, ex_ - org[0] + ew_)] = 0   # boxes may start left of or above the rect: clip, never wrap
    out = clear_flat(out, clr)
    out = clear_flat(out, SHADOW.get(key, []) if sh is None else sh)
    out = out.copy(); out[out[..., 3] < 200] = 0
    out = drop_strays(out)
    nz = np.argwhere(out[..., 3] > 0)
    if not len(nz): raise SystemExit('empty rect')
    y0, x0 = nz.min(0); y1, x1 = nz.max(0) + 1
    return out[y0:y1, x0:x1], (int(x0), int(y0))


def auto_shadow(a):
    """the two flat colours of a baked ground ellipse: the most frequent opaque colours of the sprite's bottom 10 rows (the tree art never repeats them in bulk there)"""
    from collections import Counter
    nz = np.argwhere(a[..., 3] >= 200); y1 = nz[:, 0].max() + 1
    sub = a[max(0, y1 - 10):y1].reshape(-1, 4); sub = sub[sub[:, 3] >= 200]
    return [c for c, n in Counter(tuple(int(v) for v in r[:3]) for r in sub).most_common(2) if n >= 40]


def compose(key, parts):
    """parts = [(x, y, w, h, dx, dy)]: source pieces of one sheet placed side by side (dx, dy may be negative, the canvas grows)"""
    x0 = min(p[4] for p in parts); y0 = min(p[5] for p in parts)
    W = max(p[4] + p[2] for p in parts) - x0; H = max(p[5] + p[3] for p in parts) - y0
    cv = np.zeros((H, W, 4), np.uint8)
    for (x, y, w, h, dx, dy) in parts:
        r = raw(key, x, y, w, h); sub = cv[dy - y0:dy - y0 + h, dx - x0:dx - x0 + w]
        sub[:] = np.where((r[..., 3:] > 0), r, sub)
    return cv


def auto_door(a, d):
    """door x (sheet px, absolute column) of a building: the widest near-black or very dark opaque blob in its lower 45%, else None"""
    h, w = a.shape[:2]; lo = int(h * .55)
    dark = (a[..., 3] >= 200) & (a[..., :3].max(-1) < 46)
    dark[:lo] = False
    lab, n = ndi.label(dark)
    best = None
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        ys, xs = sl; area = int((lab[sl] == i).sum()); bw = xs.stop - xs.start; bh = ys.stop - ys.start
        if area < 30 or bw < 6 or bh < 8 or bw > bh * 3: continue
        score = area + 2 * ys.stop
        if best is None or score > best[0]: best = (score, (xs.start + xs.stop) // 2)
    return best[1] if best else None


def foot(kind, op, h, w, d):
    """anchor (ax, ay) and solid rect for a sprite (op = alpha >= 128 mask) in sheet px. Rules follow tools/adv-build-tileset.py, which sizes in exterior (1x art) px: lengths there are x/d here."""
    rows = np.where(op.any(1))[0]; ym = int(rows[-1])
    u = lambda v: int(round(v / d))                         # 1x art px -> sheet px
    hd = lambda v: v * d                                    # sheet px -> 1x art px
    band = np.where(op[max(0, ym - u(2)):ym + 1].any(0))[0]   # the lowest 2 art px of the sprite
    ax, ay = (int(band.min()) + int(band.max())) // 2, ym + 1
    ob = np.where(op[max(0, ym - u(7)):ym + 1].any(0))[0]
    wo = int(ob.max() - ob.min() + 1); wb = int(band.max() - band.min() + 1)
    cl = lambda v, a_, b_: max(a_, min(b_, v))
    if kind == 'tree': hw = u(cl(round(hd(wb) * .35), 3, 10)); s = [-hw, -u(5), hw, u(1)]
    elif kind in ('bush', 'rock'): hw = u(cl(round(hd(wo) * .42), 3, 40)); s = [-hw, -u(min(8, int(hd(h)) // 2)), hw, u(1)]
    elif kind == 'sign': s = [-u(5), -u(4), u(5), u(1)]
    elif kind == 'lamp': s = [-u(3), -u(3), u(3), u(1)]
    elif kind == 'fence': s = [-(wo // 2), -u(3), wo // 2, u(1)]
    elif kind in ('flower', 'tuft', 'deco'): s = None
    elif kind == 'cave': hw = int(round(wo * .4)); s = [-hw, -u(8), hw, u(1)]
    elif kind == 'wall': hw = max(u(3), wo // 2 - u(2)); s = [-hw, -u(min(16, int(hd(h)) // 3)), hw, u(1)]
    elif kind == 'building':
        wb6 = np.where(op[max(0, ym - u(5)):ym + 1].any(0))[0]
        hw = int((wb6.max() - wb6.min()) // 2 - u(1)); s = [-hw, -u(min(28, max(12, int(hd(h)) // 4))), hw, u(1)]
    else: hw = max(u(3), int(round(wo * .45))); s = [-hw, -u(min(10, max(3, int(hd(h)) // 2))), hw, u(1)]
    if s: s = [max(s[0], -ax), s[1], min(s[2], w - ax), s[3]]   # the blocked rect never reaches past the drawn sprite (anchors of lopsided sprites are off-centre)
    return ax, ay, s


def is_2x(a):
    """true when the sprite is 2x pixel art (every aligned 2x2 block of art is one flat colour at some offset): a sheet nominally 1x can hold 2x sprites, their def needs density 0.5"""
    best = 0.0
    for oy in (0, 1):
        for ox in (0, 1):
            s = a[oy:, ox:]; h2, w2 = s.shape[0] // 2 * 2, s.shape[1] // 2 * 2
            if h2 < 4 or w2 < 4: return False
            b = s[:h2, :w2].reshape(h2 // 2, 2, w2 // 2, 2, 4).transpose(0, 2, 1, 3, 4).reshape(h2 // 2, w2 // 2, 4, 4)
            eq = (b == b[:, :, :1]).all(axis=(2, 3)); has = (b[..., 3] > 0).any(-1)
            if has.any(): best = max(best, float(eq[has].mean()))
    return best >= .9


def build(catalog):
    sprites, seen = [], set()
    for it in catalog:
        name, key = it['name'], it['sheet']; assert name not in seen, 'duplicate ' + name; seen.add(name)
        d = dens(key)
        sh = it.get('sh')
        if 'parts' in it:
            a = compose(key, it['parts']); x0y0 = (it['parts'][0][0], it['parts'][0][1])
            if sh == 'auto': sh = auto_shadow(finish(a.copy(), key, [], it.get('clr'), None)[0])
            a, _ = finish(a, key, sh, it.get('clr'), None)
        else:
            x, y, w, h = it['rect']; r = raw(key, x, y, w, h)
            if sh == 'auto': sh = auto_shadow(finish(r.copy(), key, [], it.get('clr'), it.get('ex'), (x, y))[0])
            a, (ox, oy) = finish(r, key, sh, it.get('clr'), it.get('ex'), (x, y)); x0y0 = (x + ox, y + oy)
        if d == 1 and is_2x(a): d = .5
        op = a[..., 3] >= 128
        ax, ay, s = foot(it['kind'], op, a.shape[0], a.shape[1], d)
        if 'anchor' in it: ax, ay = it['anchor']
        if 'solid' in it: s = it['solid']
        door = None
        if it['kind'] == 'building':
            dx = it.get('door', 'auto')
            if dx == 'auto': dx = auto_door(a, d); dx = 0 if dx is None else dx - ax
            door = [int(dx), -int(round(2 / d))]
        sprites.append(dict(name=name, kind=it['kind'], img=a, ax=int(ax), ay=int(ay), solid=s, door=door, density=None if d == 1 else d,
                            author=AUTHOR[key], src=(SHEETS[key], x0y0[0], x0y0[1])))
    return sprites


def collect():
    cat = runpy.run_path(str(ROOT / 'tools/adv-community-items.py'))['CATALOG']
    return build(cat)


def verify(sprites, out=ROOT / 'tools/.cache/comm'):
    """contact sheets: each sprite at 2x (1x when big) on grass, anchor red, solid blue, door yellow, a ruler under buildings"""
    out.mkdir(parents=True, exist_ok=True)
    bg = (112, 148, 104)
    pages, W, Hmax = [], 1500, 1250
    cur = Image.new('RGB', (W, Hmax), (36, 36, 40)); d = ImageDraw.Draw(cur); x, y, rh = 4, 4, 0
    for sp in sprites:
        h, w = sp['img'].shape[:2]; sc = 2 if max(w, h) <= 90 else 1
        t = Image.new('RGBA', (w + 8, h + 8), bg + (255,)); t.alpha_composite(Image.fromarray(sp['img'], 'RGBA'), (4, 4))
        t = t.convert('RGB').resize(((w + 8) * sc, (h + 8) * sc), Image.NEAREST); dd = ImageDraw.Draw(t)
        ax, ay = (sp['ax'] + 4) * sc, (sp['ay'] + 4) * sc
        if sp['solid']:
            s = sp['solid']; dd.rectangle([ax + s[0] * sc, ay + s[1] * sc, ax + s[2] * sc, ay + s[3] * sc], outline=(0, 80, 255))
        if sp['kind'] == 'building':   # ruler in sheet px from the anchor, a tick every 10, a label every 30
            for k in range(-int(sp['ax']) // 10 * 10, w - sp['ax'] + 1, 10):
                px = ax + k * sc; dd.line([px, ay + 2, px, ay + (8 if k % 30 else 12)], fill=(255, 255, 255))
                if k % 30 == 0: dd.text((px - 8, ay + 12), str(k), fill=(255, 255, 255))
        dd.rectangle([ax - 2, ay - 2, ax + 2, ay + 2], fill=(255, 0, 0))
        if sp['door']: dd.rectangle([ax + sp['door'][0] * sc - 2, ay + sp['door'][1] * sc - 2, ax + sp['door'][0] * sc + 2, ay + sp['door'][1] * sc + 2], fill=(255, 230, 0))
        cw = max(t.width, 90) + 6
        if x + cw > W: x, y, rh = 4, y + rh + 4, 0
        if y + t.height + 14 > Hmax: pages.append(cur); cur = Image.new('RGB', (W, Hmax), (36, 36, 40)); d = ImageDraw.Draw(cur); x, y, rh = 4, 4, 0
        d.text((x, y), f"{sp['name']} {w}x{h}", fill=(255, 255, 80)); cur.paste(t, (x, y + 11)); x += cw; rh = max(rh, t.height + 14)
    pages.append(cur)
    for f in out.glob('verify-*.png'): f.unlink()
    for i, p in enumerate(pages): p.save(out / f'verify-{i:02d}.png')
    return len(pages)


def main():
    sprites = collect()
    n = verify(sprites)
    per = {}
    for s in sprites: per[s['author']] = per.get(s['author'], 0) + 1
    print(len(sprites), 'community sprites', per, n, 'verify pages')


if __name__ == '__main__':
    main()
