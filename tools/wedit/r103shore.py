# One-shot (run once with --save, 2026-11-06): Route 103's shore south of Duskmoss was a flat grey ash strip 9-13 tiles wide with trees
# standing in it. The stony band now keeps to about 3 tiles along the water (a ragged inner edge) and the inland part is grass again.
import sys
import numpy as np
from scipy import ndimage as ndi
from wedit import Region
R = Region(560, 860, 620, 920); m = R.L['mat']
x0, x1, y0, y1 = 562 - R.x0, 612 - R.x0, 864 - R.y0, 910 - R.y0
box = np.zeros_like(m, bool); box[y0:y1, x0:x1] = True
ash = (m == 10)
shore = ~np.isin(m, [10, 1, 2, 9, 14])   # water, wet sand, jetty boards: the sea side
d = ndi.distance_transform_edt(~shore)
rng = np.random.default_rng(103); Y, X = np.mgrid[0:m.shape[0], 0:m.shape[1]]
lim = 3.0 + 1.2 * np.sin(Y * 0.7 + X * 0.3) + rng.uniform(-0.6, 0.6, m.shape)
to = box & ash & (d > lim)
print('ash cells in box', int((box & ash).sum()), 'to grass', int(to.sum()))
m[to] = 1
a2 = box & (m == 10); nb = sum(np.roll(np.roll(a2, dy, 0), dx, 1) for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)])
lone = a2 & (nb <= 1); m[lone] = 1; print('lone ash cells to grass', int(lone.sum()))   # no single grey specks in the grass
if '--save' in sys.argv: R.save(); print('saved')
