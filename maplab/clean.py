"""Strip the checkerboard baked into the downloaded tileset (src/tileset-original.png, RGB) back to real transparency.
The checker is 16 px cells, white (255,255,255) where (x//16 + y//16) is even, (229,236,232) where odd. A pixel is background when it
has exactly the colour its cell should have. Art pixels that happen to share that colour are rescued only when the blob is tiny (<= 6 px), walled in by art inside
one checker cell, and that art is light (a glint in snow or glass); the same blob in darker art is a gap the checker showed through.
Flat grey cast shadows become translucent.
  py -3.12 -I maplab/clean.py   ->  maplab/tileset.png (RGBA) + prints what it rescued"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
a = np.array(Image.open(os.path.join(HERE, 'src/tileset-original.png')).convert('RGB')).astype(np.int16)
H, W = a.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
even = ((xx // 16 + yy // 16) % 2) == 0
white = (a == [255, 255, 255]).all(-1)
grey = (a == [229, 236, 232]).all(-1)
bg = (white & even) | (grey & ~even)

# rescue: small background-coloured blobs that sit inside one checker cell and are fully enclosed by non-background pixels
lab, n = ndimage.label(bg)
sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
rescued = 0
for i, (sl, sz) in enumerate(zip(ndimage.find_objects(lab), sizes), start=1):
    if sz > 24: continue
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    if y0 // 16 != (y1 - 1) // 16 or x0 // 16 != (x1 - 1) // 16: continue     # crosses a cell edge: real background
    if y0 % 16 == 0 or x0 % 16 == 0 or y1 % 16 == 0 or x1 % 16 == 0: continue # touches the cell border: could continue as background next door
    m = lab[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1] == i
    ring = ndimage.binary_dilation(m) & ~m
    around = bg[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1][ring]
    if around.any(): continue                                               # touches other background: it is a gap
    ringpx = a[max(0, y0 - 1):y1 + 1, max(0, x0 - 1):x1 + 1][ring]
    if sz > 6 or ringpx.mean() < 170: continue                              # a hole in darker art (gaps between leaves, stems): the checker showed through
    bg[lab == i] = False; rescued += sz                                     # a white glint inside light art (snow, glass): keep it

out = np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
out[bg, :3] = 0

# the sheet draws cast shadows as flat opaque (177,191,195); any blob of that colour touching the background is a shadow,
# so make it a real translucent cool shadow that darkens whatever ground it lands on (enclosed blobs are art and stay)
flat = (a == [177, 191, 195]).all(-1) & ~bg
slab, _ = ndimage.label(flat, structure=np.ones((3, 3)))
ids = np.unique(slab[ndimage.binary_dilation(bg, structure=np.ones((3, 3))) & flat])
shadow = np.isin(slab, ids[ids > 0])
out[shadow] = (24, 40, 64, 72)

Image.fromarray(out, 'RGBA').save(os.path.join(HERE, 'tileset.png'))
left = ((white | grey) & ~bg).sum()
print(f'{W}x{H}: {bg.sum()} px transparent, {int(rescued)} px rescued as art, {left} checker-coloured px kept opaque, {shadow.sum()} shadow px made translucent')
