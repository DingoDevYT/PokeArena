"""Annotated views of the tileset for cataloguing: 16 px tile grid (the sheet's real tile size), tile column/row numbers, on a neutral background.
  py -3.12 -I maplab/gridview.py <x0> <y0> <cols> <rows> <scale> <out.png> [sheet.png]   (x0, y0, cols, rows in 16 px TILES)"""
import sys, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
x0, y0, cols, rows, sc = (int(v) for v in sys.argv[1:6]); out = sys.argv[6]
T = 16
ts = Image.open(sys.argv[7] if len(sys.argv) > 7 else os.path.join(HERE, 'tileset.png')).convert('RGBA')
crop = ts.crop((x0 * T, y0 * T, (x0 + cols) * T, (y0 + rows) * T))
M = 22   # margin for labels (unscaled px)
W, H = cols * T * sc, rows * T * sc
im = Image.new('RGBA', (W + M, H + M), (40, 40, 48, 255))
bg = Image.new('RGBA', (W, H), (96, 110, 120, 255))
for r in range(rows):
    for c in range(cols):
        if (r + c) % 2: ImageDraw.Draw(bg).rectangle([c * T * sc, r * T * sc, (c + 1) * T * sc - 1, (r + 1) * T * sc - 1], fill=(104, 118, 128, 255))
bg.alpha_composite(crop.resize((W, H), Image.NEAREST))
im.paste(bg, (M, M))
d = ImageDraw.Draw(im)
for c in range(cols + 1):
    x = M + c * T * sc; d.line([(x, M), (x, M + H)], fill=(255, 60, 60, 170) if (x0 + c) % 10 == 0 else (255, 255, 255, 55))
    if c < cols and (x0 + c) % 2 == 0: d.text((x + 2, 4), str(x0 + c), fill=(255, 230, 120, 255))
for r in range(rows + 1):
    y = M + r * T * sc; d.line([(M, y), (M + W, y)], fill=(255, 60, 60, 170) if (y0 + r) % 10 == 0 else (255, 255, 255, 55))
    if r < rows and (y0 + r) % 2 == 0: d.text((2, y + 2), str(y0 + r), fill=(255, 230, 120, 255))
im.save(out)
print(out, im.size)
