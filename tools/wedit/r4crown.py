# One-shot (run once with --save, 2026-11-06): Route 4's summit read as flat grey boxes (narrow h 6 blocks in L shapes on ash ground with pale rims).
# The h 6 blocks settle into the h 5 plateau and the ash crown becomes grass like the terraces below; its rocks stay.
import sys
import numpy as np
from wedit import Region
R = Region(396, 572, 484, 648); m, h, k = R.L['mat'], R.L['h'], R.L['kind']
sel = np.zeros_like(m, bool); sel[584 - R.y0:637 - R.y0, 414 - R.x0:439 - R.x0] = True
ash = sel & (m == 10); top = sel & (h == 6)
print('ash to grass', int(ash.sum()), 'h6 to h5', int(top.sum()), 'stairs on h6', int((top & (k > 0)).sum()))
m[ash] = 1; h[top] = 5; k[top & (k >= 1) & (k <= 4)] = 0
# stairs on h5 that climbed onto the old h6 blocks lead nowhere now
for y, x in zip(*np.nonzero(sel & (k >= 1) & (k <= 4))):
    d = {1: (0, -1), 2: (0, 1), 3: (1, 0), 4: (-1, 0)}[int(k[y, x])]
    if h[y + d[1], x + d[0]] != h[y, x] + 1: k[y, x] = 0; print('dropped stair at', x + R.x0, y + R.y0)
if '--save' in sys.argv: R.save(); print('saved')
