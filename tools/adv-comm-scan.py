"""Catalogue helper for the community tilesets in tools/.cache/tilesets (never ships).
Finds the sprites of every unique sheet (connected opaque blobs) and writes contact pages with ids, so items can be picked by eye and then
referenced by (sheet, x, y, w, h) in tools/adv-community.py.
Run: py -3.12 -I tools/adv-comm-scan.py [sheet-key ...]     output: tools/.cache/comm/<key>.json and tools/.cache/comm/pages/<key>-NN.png"""
import sys, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/.cache/tilesets'
OUT = ROOT / 'tools/.cache/comm'
# one key per unique sheet (the steam copies are byte-identical pixel dumps of the imgur ones; PixelMister's and Akirazu's 128 px sheets are the same file)
SHEETS = {
    'akirazu': 'Akirazu/gABZK3l.png',
    'akirazu2': 'Akirazu/steam-1723163958327505258.png',
    'chaotic': 'ChaoticCherryCake/grbxzAE.png',
    'jesus1': 'JesusCarrasco/Iq3ve5r.png',
    'jesus2': 'JesusCarrasco/N2tpJgO.png',
    'jesus3': 'JesusCarrasco/sV7nFlm.png',
    'magi': 'Magiscarf/as2jJ0E.png',
    'matara': 'Mataraelfay/5pj8QXY.png',
    'sailor1': 'SailorVicious/IMolfXl.png',
    'sailor2': 'SailorVicious/uGG3eqm.png',
    'wilson1': 'WilsonScarloxy/rrwiIXt.png',
    'wilson2': 'WilsonScarloxy/w4vzAdo.png',
}
BG = (112, 148, 104)


def components(a, merge=2):
    op = a >= 128
    lab, n = ndi.label(ndi.binary_dilation(op, iterations=merge) if merge else op, np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        sub = (a[sl] > 0) & (lab[sl] == i)
        ys, xs = np.nonzero(sub)
        if not len(xs): continue
        x0, y0 = sl[1].start + xs.min(), sl[0].start + ys.min()
        out.append([int(x0), int(y0), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1), int((a[sl][sub] >= 128).sum())])
    out.sort(key=lambda c: (c[1] // 24, c[0]))
    return out


def page(key, im, comps, minsz=10, W=1500, H=1250):
    bg = Image.new('RGBA', im.size, BG + (255,)); bg.alpha_composite(im)
    pages, cur, x, y, rh = [], Image.new('RGB', (W, H), (36, 36, 40)), 4, 4, 0
    d = ImageDraw.Draw(cur); k = 0
    for i, (cx, cy, w, h, n) in enumerate(comps):
        if w < minsz and h < minsz: continue
        sc = 2 if max(w, h) <= 40 else 1
        if w * sc > W - 8 or h * sc > H - 20: sc = 1
        tile = bg.crop((cx, cy, cx + w, cy + h)).convert('RGB')
        if sc > 1: tile = tile.resize((w * sc, h * sc), Image.NEAREST)
        cw = max(tile.width, 54) + 6
        if x + cw > W: x, y, rh = 4, y + rh + 4, 0
        if y + tile.height + 14 > H:
            pages.append(cur); cur = Image.new('RGB', (W, H), (36, 36, 40)); d = ImageDraw.Draw(cur); x, y, rh = 4, 4, 0
        d.text((x, y), f'{i} {cx},{cy} {w}x{h}', fill=(255, 255, 80))
        cur.paste(tile, (x, y + 11)); d.rectangle([x - 1, y + 10, x + tile.width, y + 11 + tile.height], outline=(90, 90, 120))
        x += cw; rh = max(rh, tile.height + 14)
    pages.append(cur)
    (OUT / 'pages').mkdir(parents=True, exist_ok=True)
    for j, p in enumerate(pages): p.save(OUT / 'pages' / f'{key}-{j:02d}.png')
    return len(pages)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    keys = sys.argv[1:] or list(SHEETS)
    for key in keys:
        im = Image.open(SRC / SHEETS[key]).convert('RGBA')
        a = np.array(im)[..., 3]
        comps = components(a)
        (OUT / f'{key}.json').write_text(json.dumps(comps))
        np_ = page(key, im, comps)
        print(key, im.size, len(comps), 'components', np_, 'pages')


if __name__ == '__main__':
    main()
