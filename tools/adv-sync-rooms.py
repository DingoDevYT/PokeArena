"""Copy interiors (furniture and people) from tools/adv-towns/<code>-in.json into data/adv/world.js without regenerating the world.
Run after tools/adv-build-rooms.mjs when only what is inside buildings changed (lines, people, furniture); a changed footprint still needs tools/adv-gen-region.py."""
import glob, json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
p = os.path.join(ROOT, 'data', 'adv', 'world.js'); s = open(p, encoding='utf8').read(); i = s.index('{'); j = s.rindex('}') + 1
w = json.loads(s[i:j]); IN = {}
for f in glob.glob(os.path.join(ROOT, 'tools', 'adv-towns', '*-in.json')): IN.update(json.load(open(f, encoding='utf8')))
n = 0
for b in w['buildings']:
    it = IN.get(b['id'])
    if not it: continue
    assert it['C'] == 2 * b['w'] - 2 and it['R'] == 2 * b['d'] - 1, f"{b['id']}: the interior is {it['C']} x {it['R']}, the footprint {b['w']} x {b['d']} needs a regenerate"
    new = dict(b['interior'], floor=it['floor'], walls=it['walls'], props=it['props'], npcs=it['npcs'])
    if new != b['interior']: b['interior'] = new; n += 1
open(p, 'w', encoding='utf8').write(s[:i] + json.dumps(w, separators=(',', ':'), ensure_ascii=False) + s[j:])
print(n, 'interiors updated')
