"""Region rebuild pilot 2: Route 7 'the grazing country', a hill pasture with two terraces, stairs, a shepherd's hut (docs/REGION-REBUILD.md).
  py -3.12 -I maplab/maps/region_pilot2.py        writes maplab/maps/region_pilot2.json, lints it, renders maplab/out/region-pilot/maplab2.png
64 x 48 game cells = 128 x 96 lab cells, window origin world (240, 928). Everything on EVEN lab coordinates (G() below turns game cells into lab rects).
Cliff rules the exporter relies on: every drop to the south is exactly one level, a face is the bottom 2 lab rows (1 game cell) of its plateau rect,
stairs ('S') are 2 x 2 lab cells (1 game cell) or a multiple wide, cut into a face. Exits (game cells of the window): west rows 5..7 at x 0 (world y 933..935),
north x 51..56 at y 0 (world x 290..295)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B
from ridge_shapes import blob, clean, inside, levels
R = B.R
GREEN, ROUND, FLOWERS, SMALL = B.GREEN, B.ROUND, B.FLOWERS, B.SMALL
OAKS = ['round_green0', 'round_green1', 'round_teal0', 'young_green0']


def G(x0, y0, x1, y1): return 2 * x0, 2 * y0, 2 * x1 + 1, 2 * y1 + 1     # game cells -> lab rect


def cols(x0, tops, bots):
    """a plateau from a column profile: column x0 + i spans game rows tops[i]..bots[i]"""
    return {(x0 + i, y) for i, (t, b) in enumerate(zip(tops, bots)) for y in range(t, b + 1)}


def runs(*spans):
    """expand (count, value) pairs into a per-column list: long flat runs with real corners, not a one-cell staircase"""
    return [v for n, v in spans for _ in range(n)]


def shapes():
    """grass hills (game cells): the big terrace, the knoll on it, the east ridge. Outlines step where the design wants them; the renderer composes the inner corners."""
    t1 = cols(11, runs((3, 18), (4, 15), (5, 13), (5, 14), (6, 16), (7, 15), (6, 17)), runs((3, 27), (6, 30), (8, 31), (5, 29), (5, 28), (5, 27), (4, 28)))   # x 11..46
    kn = cols(25, runs((3, 20), (4, 18), (6, 17), (4, 19)), runs((3, 25), (3, 26), (4, 25), (4, 24), (3, 23)))
    rg = cols(50, runs((2, 15), (3, 14)), runs((1, 21), (3, 22), (1, 21)))   # x 50..54, a lowland gap (x 47..49) between it and the terrace
    L1, L2 = t1 | rg, kn
    bad = L2 - inside(L2, L1); assert not bad, f'knoll margin broken at {sorted(bad)[:6]}'
    for S in (L1, L2):
        bad = S - clean(S); assert not bad, f'run under 3 cells at {sorted(bad)[:6]}'
    return L1, L2


def pilot():
    m = B.Map('region_pilot2', 128, 96, path='d')
    L1, L2 = shapes(); lv = levels([L1, L2])
    for k, S in enumerate((L1, L2), 1):
        for x, y in S: m.rect('cliffs', *G(x, y, x, y), str(k))
    stairs = {'terrace': (24, 31), 'knoll': (31, 25), 'ridge': (51, 22)}   # the knoll stairs straight under the hut door
    for name, (x, y) in stairs.items():
        assert lv[(x, y)] >= 1 and lv.get((x, y + 1), 0) == lv[(x, y)] - 1 == lv.get((x, y + 2), 0), (name, x, y)
        m.rect('cliffs', 2 * x, 2 * y, 2 * x + 1, 2 * y + 1, 'S')   # one game cell wide
    P = lambda x0, y0, x1, y1: m.rect('ground', *G(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), 'd')
    # ---- roads: 2 game cells wide, 3 at the gateways; the loop runs round the hill
    for g in [(51, 0, 56, 1), (53, 2, 54, 9), (36, 8, 57, 9), (36, 6, 37, 9), (6, 6, 37, 7), (0, 5, 5, 7),     # north gateway, trunk, west gateway
              (6, 8, 7, 35), (6, 34, 57, 35), (56, 10, 57, 35), (53, 8, 57, 9)]:                                 # west lane, south lane, east lane back up to the trunk
        P(*g)
    # ---- footpaths (one cell, like the stairs): south lane -> terrace stairs -> across the terrace -> knoll stairs -> hut; east lane -> ridge stairs -> lookout
    for x, y in stairs.values(): P(x, y, x, y)
    P(24, 32, 24, 33); P(24, 27, 24, 30); P(24, 27, 31, 27); P(31, 26, 31, 26)
    P(51, 23, 51, 24); P(51, 24, 55, 24); P(51, 17, 51, 21)
    for i, (x, y) in enumerate([(80, 67), (81, 66), (81, 64), (82, 63), (82, 61), (80, 60), (81, 58), (83, 57), (84, 55), (84, 53), (86, 52), (88, 51), (88, 49)]): m.set('ground', x, y, 'd'); m.set('ground', x + (i % 2), y, 'd')
    # ---- tall grass beds (wild areas): organic, on whole top cells only (never a rim, a face or a path)
    def inner(x, y):
        h = lv.get((x, y), 0)
        return all(lv.get((x + i, y + j), 0) == h for i in (-1, 0, 1) for j in (-1, 0, 1, 2))
    def bedblob(cx, cy, rx, ry, seed=0):
        h = lv.get((round(cx), round(cy)), 0)
        for x, y in blob(64, 48, cx, cy, rx, ry, 700 + seed, .3):
            if lv.get((x, y), 0) == h and inner(x, y) and m.get('ground', 2 * x, 2 * y) == '.' and m.get('ground', 2 * x + 1, 2 * y + 1) == '.': m.rect('ground', *G(x, y, x, y), 't')
    for i, b_ in enumerate([(18, 11.5, 7, 1.6), (50.5, 28, 3.5, 3.5), (20, 40, 9, 2.5), (19, 18, 3.5, 2.5), (41, 21, 3.5, 2.5), (15, 28, 2.5, 1.3), (36, 30, 3, 1.3)]): bedblob(*b_, seed=i)
    # ---- a pond on the first terrace
    m.shape('ground', 26, 40, ["....vvvv....", "..vvvvvvvv..", ".vvvvvvvvvv.", ".vvvvvvvvvv.", "..vvvvvvvv..", "....vvvv...."], 'v')
    m.shape('ground', 29, 43, [".VVVV.", "VVVVVV"], 'V')
    # ---- the shepherd's hut on the knoll, its door path one cell wide down to the knoll stairs
    m.building('house_wood_c', 60, 36, to=48)   # door path straight down to the knoll stairs top (game cell 31, 24)
    P(31, 24, 31, 24)
    for o, x, y in [('route_sign', 100, 12), ('route_sign', 4, 18)]: m.obj(o, x, y)
    def place(o, x, y, r=5):
        """put prop o at lab (x, y) or the nearest free spot within r cells on the same level"""
        h = m.level(x, y)
        for d in range(r + 1):
            for j in range(-d, d + 1):
                for i in range(-d, d + 1):
                    if max(abs(i), abs(j)) == d and m.level(x + i, y + j) == h and m.free(o, x + i, y + j): m.obj(o, x + i, y + j); return True
        print('  [region_pilot2] no room for', o, x, y); return False
    for o, x, y in [('bench', 74, 38), ('sign_small', 70, 40), ('lantern', 79, 36),                                  # the lookout on the knoll
                    ('woodpile', 70, 44), ('barrel_water', 56, 44), ('crates', 54, 38), ('bed_yellow', 58, 46), ('bed_white', 68, 38),   # hut yard
                    ('spire', 40, 44), ('boulder', 44, 50), ('spire2', 48, 46), ('cairn', 46, 54), ('boulder2', 36, 52),          # stone circle on the first terrace
                    ('bench', 104, 30), ('lantern', 106, 29), ('sign_small', 100, 30),                                 # the ridge lookout at the end of its path
                    ('bench', 98, 66), ('lantern', 108, 66), ('sign_board', 90, 64), ('barrel', 108, 60), ('crates2', 104, 60),    # rest spot at the lane's east end
                    ('boulder_grey', 118, 84), ('rock_tall', 20, 62), ('rock_grassy', 94, 22), ('logs', 18, 20), ('mound_grass', 90, 36)]:
        place(o, x, y)
    for i in range(32, 60): m.set('fences', i, 4, 'F')                                                               # a stock fence along the north verge of the trunk
    for y, r in enumerate(m.L['fences']):
        for x, c in enumerate(r):
            if c != '.':
                for i in (-1, 0, 1):
                    for j in (-1, 0, 1): m.busy.add((x + i, y + j)); m.bases[(x + i, y + j)] = 'fence'
    # ---- trees: a frame at the window edge, open pasture with oaks, a grove and a spinney; trunks clear of rims and other props
    m.forest(-2, -1, 98, 1, GREEN, 301); m.forest(112, -1, 130, 4, GREEN, 302); m.forest(-3, 17, 3, 95, GREEN, 303, dx=2, dy=3)
    m.forest(118, 5, 130, 95, GREEN, 304, dx=2, dy=3); m.forest(-2, 88, 130, 94, GREEN, 305)
    m.forest(4, 78, 40, 90, ROUND + ['pine_green0'], 306, dx=3, dy=2); m.forest(84, 76, 117, 87, GREEN, 307, dx=3, dy=2)
    m.forest(98, 56, 114, 64, GREEN, 308, dx=3, dy=2); m.forest(62, 64, 74, 67, ROUND, 309, dx=3, dy=3)
    m.forest(14, 2, 34, 4, GREEN, 310)
    for name, bx, by in [('round_green0', 90, 8), ('round_teal0', 68, 62), ('pine_green1', 84, 26), ('round_green0', 18, 52), ('young_green0', 36, 30),
                         ('round_green1', 30, 34), ('round_teal0', 86, 40), ('young_green0', 60, 56)]:
        m.tree(name, bx, by, quiet=True)
    trees = [(cells, max(b[1] for b in base)) for n, x, y in m.objects if n.split('_')[0] in B.TREES for cells, base in [m._place(n, x, y)]]
    stair_cells = {(2 * x + i, 2 * y + j) for x, y in stairs.values() for i in (-1, 0, 1, 2) for j in range(-3, 5)}
    for a_ in [('npc', 'npc2-old-man', 64, 47, 'down'), ('mon', 161, 66, 49, 'left'), ('mon', 162, 70, 48, 'right'), ('npc', 'npc1-explorer', 76, 40, 'left'),
               ('npc', 'npc4-vest-boy', 22, 20, 'right'), ('mon', 399, 20, 24, 'down'), ('mon', 400, 42, 46, 'left'), ('npc', 'npc4-blonde-girl', 52, 22, 'down'),
               ('mon', 399, 100, 30, 'left'), ('mon', 19, 96, 72, 'up'), ('npc', 'npc3-apron-woman', 100, 68, 'right'), ('mon', 161, 60, 72, 'down')]:
        k, who, x, y, f = a_   # nearest cell nobody stands on: plain ground, off every edge, clear of the stairs and their approach
        ok = lambda c: m.ground(*c) in '.t' and not any(m.edge(c[0] + i, c[1] + j) for i in (-1, 0, 1) for j in (-1, 0, 1)) and c not in m.bases and c not in m.solid and c not in stair_cells and not any(c in tc and c[1] < tb for tc, tb in trees)
        x, y = min(((x + i, y + j) for i in range(-8, 9) for j in range(-8, 9) if ok((x + i, y + j))), key=lambda c: abs(c[0] - x) + abs(c[1] - y))
        m.act(k, who, x, y, f)
    for i, (cx, cy) in enumerate([(14, 28), (28, 12), (44, 20), (86, 26), (18, 66), (56, 70), (96, 58), (40, 76), (112, 40), (8, 52), (84, 12)]):
        m.cluster(FLOWERS, cx, cy, 3, 400 + i, r=2)
    m.scatter(SMALL, 50, (0, 2, 127, 90), 405)
    return m


if __name__ == '__main__':
    m = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_pilot2]', w)
    mp = json.load(open(p))
    mp['start'] = [0, 6]   # probe start: the west gateway (game cell, level 0)
    mp['probes'] = {'north gateway': [53, 0], 'hut door front': [31, 23], 'knoll top': [33, 19], 'terrace interior': [18, 22], 'ridge top': [51, 18], 'ridge stair foot': [51, 23], 'terrace stair foot': [24, 32], 'pond shore': [14, 23], 'south lane': [30, 34], 'east shelf': [44, 22], 'outside west': [-1, 6]}
    mp['game_props'] = [['pxTurbine', 24, 10], ['pxTurbine', 76, 11]]   # lab px anchors are exported as the game's own animated turbine (not drawn in the lab render)
    json.dump(mp, open(p, 'w'), indent=1)
    im = R.render(mp)
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im.save(os.path.join(out, 'maplab2-1x.png')); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab2.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
