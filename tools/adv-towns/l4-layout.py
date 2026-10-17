"""Writes tools/adv-towns/L4.json: the v2 Quiet Plain (docs/MAPDESIGN.md "Look and feel v2"). Run: py -3.12 -I tools/adv-towns/l4-layout.py
Coordinates are tiles from the memorial centre (y grows south). Route 1's paving ends at (0, -6) and runs on down an avenue of paired stones into a worn clover of bare earth: a raised stone wreath bed
(stoneRing, real art) at the centre with a ring of stones round it, a stone circle in each of three lobes, rows of stones that frame the road end, and rock outcrops with flowers at the rim.
Nothing is on a regular grid; the stones come in circles, rows and an avenue. People (data/adv/npcs.js) stand at (2,-5) (-5,-7) (9,3) (-5,6) (0,4)."""
import json, math, os

def circle(cx, cy, rx, ry, n, off=0.0, skip=lambda x, y: False, names=('standingStoneMint', 'standingStoneMintTall')):
    out = []
    for k in range(n):
        a = off + 2 * math.pi * k / n; x, y = round(cx + rx * math.cos(a)), round(cy + ry * math.sin(a))
        if not skip(x, y): out.append([names[k % 2], x, y])
    return out

def row(x0, y0, x1, y1, step, names=('standingStoneMintTall', 'standingStoneMint')):
    n = int(max(abs(x1 - x0), abs(y1 - y0)) // step); return [[names[k % 2], round(x0 + (x1 - x0) * k / max(n, 1)), round(y0 + (y1 - y0) * k / max(n, 1))] for k in range(n + 1)]

av = lambda x, y: abs(x) <= 2 and y <= 3                       # keep the avenue clear
props = []
props += [['stoneRing', 0, 9]]                                  # the focal point: a raised stone wreath bed
props += [['flowersWhite', -1, 7], ['flowersWhite', 1, 7], ['flowersWhite', 0, 8], ['flowersWhite', -1, 8], ['flowersWhite', 1, 8]]
props += circle(0, 7.5, 7, 5, 12, -math.pi / 2 + .26, skip=lambda x, y: av(x, y) or (abs(x - 0) <= 3 and 5 <= y <= 10))      # the ring round it (the gaps are the lobes' paths)
props += row(-3, -4, -3, 3, 2) + row(3, -4, 3, 3, 2)           # the avenue: paired stones leading in from the road end
props += circle(-14, 4, 5.5, 4, 10) + [['stoneRing', -14, 6], ['flowersWhite', -15, 5], ['flowersWhite', -13, 5], ['flowersWhite', -14, 4]]     # west circle round its own wreath bed
props += circle(14, 4, 5.5, 4, 10, .3) + [['stoneRing', 14, 6], ['flowersWhite', 13, 5], ['flowersWhite', 15, 5], ['flowersWhite', 14, 4]]     # east circle (the visitor with flowers stands at 9, 3)
props += circle(0, 16, 4, 2, 7, .2) + [['flowersWhite', -1, 16], ['flowersWhite', 1, 17], ['rockGreyB', 0, 15]]    # south circle
props += row(-17, -9, -6, -9, 2.2) + row(6, -9, 17, -9, 2.2)    # two long rows that frame the road end
props += row(-19, -5, -19, 4, 2.4, ('standingStoneMint', 'standingStoneMintTall')) + row(19, -5, 19, 4, 2.4, ('standingStoneMint', 'standingStoneMintTall'))   # the side rows at the rim
props += [['benchTeal', -4, -6], ['benchTeal', 4, -6]]
# the paving: the road's avenue, the worn clover of bare earth (a central lobe and three circle lobes, all rounded)
paving = [[-1, -6, 1, 2], [-11, 3, -8, 4, 'path'], [8, 3, 11, 4, 'path']]
plazas = [[-8, 2, 8, 13, 5], [-17, 0, -11, 8, 3, 'path'], [11, 0, 17, 8, 3, 'path'], [-4, 14, 4, 19, 3, 'path']]
deco = [
    ['fam', 'outcrop-s', -17, -13], ['fam', 'outcrop-s', 17, -13], ['fam', 'outcrop-b', -18, 12], ['fam', 'outcrop-s', 18, 12], ['fam', 'outcrop-s', -9, 20], ['fam', 'outcrop-b', 9, 20], ['fam', 'outcrop-s', -22, -2], ['fam', 'outcrop-s', 22, -2],
    ['fam', 'drift-a', -8, -12], ['fam', 'drift-b', 8, -12], ['fam', 'drift-a', -13, 12], ['fam', 'drift-c', 13, 12], ['fam', 'drift-b', -20, 8], ['fam', 'drift-a', 20, 8],
    ['row', 'stoneGrey', -20, -11, -9, -14, 3], ['row', 'stoneGrey', 20, -11, 9, -14, 3], ['row', 'rockGreyB', -21, 14, -10, 21, 3.5], ['row', 'rockGreyB', 21, 14, 10, 21, 3.5],
]
out = dict(door=[0, -6], noconnect=True, lim=24, paving=paving, plazas=plazas, props=props, deco=deco)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'L4.json'), 'w', encoding='utf8').write(json.dumps(out, separators=(',', ':')))
print('L4.json written:', len(props), 'props,', sum(1 for p in props if p[0].startswith('standingStone')), 'stones')
