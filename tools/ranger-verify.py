"""Checks the packed Ranger sheets (assets/trainer-ow-ranger + data/trainer-ow-ranger.js):
every character has idle in all 8 directions and walk in all 8 (or none: standing NPCs), walk heads never jitter sideways, every walk bounces.
  py -3.12 -I tools/ranger-verify.py"""
import importlib.util, json, os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sp = importlib.util.spec_from_file_location('rc', os.path.join(ROOT, 'tools/ranger-cut.py')); rc = importlib.util.module_from_spec(sp); sp.loader.exec_module(rc)
src = open(os.path.join(ROOT, 'data/trainer-ow-ranger.js'), encoding='utf8').read()
data = json.loads(src[src.index('=') + 1:].strip().rstrip(';'))
bad = []; standing = []
for slug, m in data.items():
    a = np.array(Image.open(os.path.join(ROOT, m['file'])).convert('RGBA')); fw, fh = m['fw'], m['fh']
    has = lambda k: all(k + '.' + d in m['anims'] for d in rc.ROWS8)
    if not has('idle'): bad.append((slug, 'idle missing ' + ','.join(d for d in rc.ROWS8 if 'idle.' + d not in m['anims'])))
    if not any(k.startswith('walk.') for k in m['anims']): standing.append(slug); continue
    if not has('walk'): bad.append((slug, 'walk missing ' + ','.join(d for d in rc.ROWS8 if 'walk.' + d not in m['anims'])))
    for d in rc.ROWS8:
        an = m['anims'].get('walk.' + d)
        if not an: continue
        fr = []
        for c in range(an['n']):
            cell = a[an['row'] * fh:(an['row'] + 1) * fh, c * fw:(c + 1) * fw]; ys, xs = np.nonzero(cell[..., 3])
            assert len(ys), (slug, d, c, 'empty frame')
            assert ys.max() <= m['footY'] + 1, (slug, d, c, 'below the foot line')
            fr.append(cell)
        # heads compared in place (no recentring): same x everywhere, some frame higher or lower
        top = lambda c: np.nonzero(c[..., 3])[0].min()
        offs = []
        for c in fr:
            best = None
            for dy in range(-3, 4):
                for dx in range(-4, 5):
                    A = fr[0][top(fr[0]):top(fr[0]) + 12]; B = np.roll(np.roll(c, dx, 1), dy, 0)[top(fr[0]):top(fr[0]) + 12]; a1 = A[..., 3] > 0; a2 = B[..., 3] > 0
                    cost = int((a1 != a2).sum() + ((a1 & a2) & (A[..., :3] != B[..., :3]).any(-1)).sum())
                    if best is None or (cost, abs(dx) + abs(dy)) < best[:2]: best = (cost, abs(dx) + abs(dy), dx, dy)
            offs.append(best[2:])
        if any(dx for dx, _ in offs): bad.append((slug, 'walk.%s head jitters %s' % (d, [dx for dx, _ in offs])))
        if an['n'] > 1 and not any(dy for _, dy in offs): bad.append((slug, 'walk.%s has no bounce' % d))
print(len(data), 'characters,', len(data) - len(standing), 'walkers,', len(standing), 'standing NPCs (idle only):', ', '.join(standing))
for b in bad: print('BAD', *b)
print('OK' if not bad else '%d problems' % len(bad))
