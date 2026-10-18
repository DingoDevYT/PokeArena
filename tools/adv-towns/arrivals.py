"""Where the route roads reach a town's box, as exits for its plan (docs/REGION-REBUILD.md section 17).
Run: ADV_GEN_OUT=<a world dir> python3 -I tools/adv-towns/arrivals.py CODE [lim]
Prints every run of road tiles crossing the square ring 0..3 tiles outside the box, as kit exit arguments (x, y, dir, width), tiles from the town centre."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
D = os.environ.get('ADV_GEN_OUT') or os.path.join(ROOT, 'data', 'adv')
W = json.loads(re.search(r'ADV_WORLD = (\{.*\});', open(D + '/world.js').read(), re.S).group(1)); PAL = W['palette'] + ['rgGrass', 'rgPath', 'rgWater']
ROAD = {'path', 'rgPath', 'pavingStone', 'pavingTan', 'soilCobble', 'boardwalk'}
def unrle(s): return [int(v) for t in s.split(',') for v in ([t.split('x')[0]] * int(t.split('x')[1]) if 'x' in t else [t])]
CK = {}
def mat(x, y):
    k = (x // 32, y // 32)
    if k not in CK:
        f = f'{D}/chunks/{k[0]}_{k[1]}.js'; CK[k] = unrle(re.search(r'mat:"([^"]*)"', open(f).read()).group(1)) if os.path.exists(f) else None
    c = CK[k]; v = c[(y % 32) * 32 + x % 32] if c else 0
    return PAL[v] if v < len(PAL) else '?'
code = sys.argv[1]; t = W['towns'][code]; cx, cy = t['x'] // 32, t['y'] // 32
J = os.path.join(HERE, code + '.json'); lim = int(sys.argv[2]) if len(sys.argv) > 2 else (json.load(open(J)).get('lim') or 46 if os.path.exists(J) else 46)
print(f'{code} {t["name"]}: centre {cx},{cy}, box +-{lim}')
for side, dxy in (('N', (0, -1)), ('S', (0, 1)), ('W', (-1, 0)), ('E', (1, 0))):
    for off in (1, 3):
        d = lim + off; cells = [(i, -d) if side == 'N' else (i, d) if side == 'S' else (-d, i) if side == 'W' else (d, i) for i in range(-lim, lim + 1)]
        run = []
        for c in cells + [None]:
            if c is not None and mat(cx + c[0], cy + c[1]) in ROAD: run.append(c); continue
            if run:
                a = run[0]; e = (a[0], -lim, 'N') if side == 'N' else (a[0], lim, 'S') if side == 'S' else (-lim, a[1], 'W') if side == 'W' else (lim, a[1], 'E')
                print(f'  {side} {off} tiles out: road {len(run)} wide -> g.exit({e[0]}, {e[1]}, {e[2]!r}, {min(2, len(run))})   ({mat(cx + a[0], cy + a[1])})')
            run = []
