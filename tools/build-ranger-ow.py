"""Rebuild every Ranger map and write data/trainer-ow-ranger.js (window.TRAINER_OW_RANGER = {slug: meta}).
Wipes assets/trainer-ow-ranger and tools/.cache/ranger/out first so nothing stale survives.
  py -3.12 -I tools/build-ranger-ow.py"""
import glob, importlib.util, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
spec = importlib.util.spec_from_file_location('rc', os.path.join(ROOT, 'tools/ranger-cut.py')); rc = importlib.util.module_from_spec(spec); spec.loader.exec_module(rc)
C = rc.CACHE; P = 'DS _ DSi - Pokemon Ranger - '; N = P + 'Non-Playable Characters - '
SHEETS = {k: N + v + '.gif' for k, v in dict(alia='Alia', billy='Billy', cameron='Cameron', clyde='Clyde', east='Eastern Rangers', elita='Elita', enemy2='Enemy Leader 2',
    examiner='Examiner', garret='Garret', gordor='Gordor', gorock='Go-Rock Squad', joel='Joel', normal='_normal_', north='North Rangers', pxyis='Pxyis',
    ringtown='Ringtown Rangers', south='South Rangers', spenser='Spenser', tiffany='Tiffany').items()}
SHEETS.update({'npc%d' % i: N + 'Non-Playable Characters (%d _ 5).gif' % i for i in range(1, 6)})
SHEETS.update(lunick=P + 'Playable Characters - Lunick.gif', solana=P + 'Playable Characters - Solana.gif')
for d in (rc.OUT, os.path.join(C, 'out')):
    for f in glob.glob(os.path.join(d, '*.png')) + glob.glob(os.path.join(d, '*.json')): os.remove(f)
for mp in sorted(glob.glob(os.path.join(C, 'maps/*.json'))):
    rc.cmd_build(os.path.join(C, SHEETS[os.path.splitext(os.path.basename(mp))[0]]), mp)
data = {os.path.splitext(os.path.basename(f))[0]: json.load(open(f)) for f in sorted(glob.glob(os.path.join(C, 'out/*.json')))}
for m in data.values(): m.pop('source', None)
open(os.path.join(ROOT, 'data/trainer-ow-ranger.js'), 'w').write('window.TRAINER_OW_RANGER = ' + json.dumps(data, indent=1) + ';\n')
print(len(data), 'characters')
