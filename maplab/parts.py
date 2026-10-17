"""Find every separate piece of art in maplab/tileset.png (8-connected opaque blobs, tiny specks merged into their nearest blob)
and write maplab/parts.json: [[x, y, w, h], ...] in sheet px, sorted top-to-bottom, left-to-right, plus labelled overview images for
cataloguing: py -3.12 -I maplab/parts.py <x0> <y0> <w> <h> <scale> <out.png> (px)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ts = Image.open(os.path.join(HERE, 'tileset.png'))
A = np.array(ts)[..., 3] > 0
P = os.path.join(HERE, 'parts.json')
if not os.path.exists(P):
    lab, n = ndimage.label(A, structure=np.ones((3, 3)))
    objs = ndimage.find_objects(lab)
    boxes = [[s[1].start, s[0].start, s[1].stop - s[1].start, s[0].stop - s[0].start] for s in objs]
    big = [b for b in boxes if b[2] * b[3] >= 16]
    small = [b for b in boxes if b[2] * b[3] < 16]
    for b in small:   # specks join the nearest big box within 4 px, else are dropped
        cx, cy = b[0] + b[2] / 2, b[1] + b[3] / 2
        best = min(big, key=lambda o: max(0, o[0] - cx, cx - o[0] - o[2]) + max(0, o[1] - cy, cy - o[1] - o[3]))
        if max(0, best[0] - cx, cx - best[0] - best[2]) + max(0, best[1] - cy, cy - best[1] - best[3]) <= 4:
            x0, y0 = min(best[0], b[0]), min(best[1], b[1]); x1, y1 = max(best[0] + best[2], b[0] + b[2]), max(best[1] + best[3], b[1] + b[3])
            best[:] = [x0, y0, x1 - x0, y1 - y0]
    big.sort(key=lambda b: (b[1] // 16, b[0]))
    json.dump(big, open(P, 'w'))
    print(len(big), 'parts ->', P)
boxes = json.load(open(P))
if len(sys.argv) > 6:
    x0, y0, w, h, sc = (int(v) for v in sys.argv[1:6]); out = sys.argv[6]
    im = Image.new('RGBA', (w * sc, h * sc), (96, 110, 120, 255))
    im.alpha_composite(ts.crop((x0, y0, x0 + w, y0 + h)).resize((w * sc, h * sc), Image.NEAREST))
    d = ImageDraw.Draw(im)
    for i, (bx, by, bw, bh) in enumerate(boxes):
        if bx + bw < x0 or bx > x0 + w or by + bh < y0 or by > y0 + h: continue
        X, Y = (bx - x0) * sc, (by - y0) * sc
        d.rectangle([X, Y, X + bw * sc - 1, Y + bh * sc - 1], outline=(255, 40, 200, 255))
        d.rectangle([X, Y, X + 6 * len(str(i)) + 2, Y + 10], fill=(0, 0, 0, 200)); d.text((X + 1, Y - 1), str(i), fill=(255, 255, 0, 255))
    im.save(out); print(out, im.size)
