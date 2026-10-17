"""Pixel-run check: every horizontal run of identical pixels in a screenshot of the world must be a multiple of the zoom
(device px per art px). Reports the runs that are not (a missing or doubled pixel, or a half-art-px layer offset).
  py -3.12 tools/pixel-runs.py shot.png 3 [--crop x0,y0,x1,y1] [--show 10]
The first and last run of each row are skipped (the screen edge cuts them). Exit 1 if any bad run."""
import argparse, sys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('png'); ap.add_argument('zoom', type=int)
ap.add_argument('--crop', help='x0,y0,x1,y1: the world area (default: the whole image)')
ap.add_argument('--vertical', action='store_true', help='check the vertical runs instead')
ap.add_argument('--show', type=int, default=8, help='how many bad runs to list')
a = ap.parse_args()

im = np.asarray(Image.open(a.png).convert('RGB')).astype(np.int32)
x0, y0, x1, y1 = map(int, a.crop.split(',')) if a.crop else (0, 0, im.shape[1], im.shape[0])
im = im[y0:y1, x0:x1]
packed = (im[..., 0] << 16) | (im[..., 1] << 8) | im[..., 2]
if a.vertical: packed = packed.T; x0, y0 = y0, x0   # then x / y below read as y / x
total = bad = 0; shown = []
for y, row in enumerate(packed):
    cut = np.flatnonzero(np.diff(row)) + 1                 # where a run ends
    starts = np.concatenate(([0], cut)); lens = np.diff(np.concatenate((starts, [len(row)])))
    for s, n in zip(starts[1:-1], lens[1:-1]):             # skip the runs clipped by the screen edge
        total += 1
        if n % a.zoom:
            bad += 1
            if len(shown) < a.show: shown.append((x0 + int(s), y0 + y, int(n)))
print(f'{a.png}: zoom {a.zoom}{" (vertical)" if a.vertical else ""}: {bad} bad runs of {total} ({100 * bad / max(1, total):.2f}%)')
for x, y, n in shown: print(f'  x={x} y={y} run={n}')
sys.exit(1 if bad else 0)
