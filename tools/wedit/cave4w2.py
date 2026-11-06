# One-shot (run once with --save, 2026-11-06), after cave4w.py: the row behind the arch's base (row 616) stayed open beside the doorway,
# so a player could walk in behind the rock. Cols 404, 405 and 407 of that row join the bump (h 3); the doorway (col 406) is a one-tile notch.
# The left torch moves down onto the street in front.
import sys
from wedit import Region
r = Region(396, 600, 420, 628); h, k = r.L['h'], r.L['kind']
for x in (404, 405, 407): h[616 - r.y0, x - r.x0] = 3; k[616 - r.y0, x - r.x0] = 0
for p in r.props:
    if p[0] == 'torchPost' and p[1] == 12944 and p[2] == 19743: p[2] = 19775; print('moved torch')
print('row 616:', ''.join(str(int(v)) for v in h[616 - r.y0, 400 - r.x0:410 - r.x0]))
if '--save' in sys.argv: r.save(); print('saved')
