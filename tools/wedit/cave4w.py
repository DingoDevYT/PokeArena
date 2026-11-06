# One-shot (run once with --save, 2026-11-06): the Route 4 west cave arch (maCaveBrown at data tile 406.5, 617) stood on open grass
# a tile and a half in front of the cliff. A bump of the terrace (h 3, cols 404-407, rows 610-615) now stands behind it, so the arch
# opens out of a cliff face; the door cell (row 616) stays on the ground. The left torch moves down beside the arch.
import sys
from wedit import Region
r = Region(396, 600, 420, 628)
h, k = r.L['h'], r.L['kind']
n = 0
for y in range(610, 616):
    for x in range(404, 408):
        if h[y - r.y0, x - r.x0] != 3: h[y - r.y0, x - r.x0] = 3; k[y - r.y0, x - r.x0] = 0; n += 1
for p in r.props:
    if p[0] == 'torchPost' and p[1] == 12944 and p[2] == 19711: p[2] = 19743; print('moved torch')
print('raised', n)
if '--save' in sys.argv: r.save(); print('saved')
