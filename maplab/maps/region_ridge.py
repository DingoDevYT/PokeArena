"""Region rebuild pilot 3: the Eastern Ridge (docs/REGION-REBUILD.md section 11).
  py -3.12 -I maplab/maps/region_ridge.py     writes maplab/maps/region_ridge.json, lints it, renders maplab/out/region-pilot/maplab3.png
64 x 48 game cells = 128 x 96 lab cells, window origin world (808, 416). Two massifs with organic plateaus (levels 1, 2, 3), a pass between them,
switchback stairs up the east massif, a cave mouth with a real room (maplab/maps/region_cave1.py), a lookout, a ranger hut in the north meadow.
Exits (game cells of the window): west x 0 rows 31..36 (world y 447..452), south y 47 cols 17..25 (world x 825..833)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B
from ridge_shapes import blob, clean, smooth, inside, levels, stair_row, show, lobes, terrace, stack, stairs_at
R = B.R
W, H = 64, 48
PINES = ['pine_green0', 'pine_green1', 'pine_teal0', 'pine_olive0', 'tall_olive0', 'pine_teal1']
ROCKS = ['rock_small', 'rock_small', 'clump', 'clump2', 'rock_grey_small', 'clump3', 'tiny_white', 'clump_green']
FLOWERS = B.FLOWERS


def G(x0, y0, x1, y1): return 2 * x0, 2 * y0, 2 * x1 + 1, 2 * y1 + 1     # game cells -> lab rect


def rects(*rs):
    """a plateau as one or more separate rectangles (x0, y0, x1, y1), game cells. Every plateau is convex: the lab cliff sets have outer corners
    only, so a concave corner (a face that steps back) has no real art. Shapes read organic through layering, trees on the rims and the forest frame,
    the way the HGSS routes do it."""
    return {(x, y) for x0, y0, x1, y1 in rs for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


# terraces stepping up north into the forest (game cells): only south faces show, the sides and north rims sit under the forest frame
L1R = [(0, 0, 29, 27), (33, 0, 63, 23)]                       # two level 1 terraces either side of a ravine (x 30..32), running off the window's north and sides
L2R = [(1, 1, 14, 24), (18, 1, 28, 19), (34, 1, 48, 20), (52, 1, 62, 16)]
L3R = [(2, 2, 13, 21), (36, 2, 45, 16)]


def shapes():
    L = [rects(*r) for r in (L1R, L2R, L3R)]
    for k in (1, 2):
        bad = L[k] - inside(L[k], L[k - 1]); assert not bad, f'level {k + 1} margin broken at {sorted(bad)[:6]}'
    return L


def pilot():
    m = B.Map('region_ridge', 2 * W, 2 * H, 'ridge', path='d')
    L1, L2, L3 = shapes(); lv = levels([L1, L2, L3])
    for k, S in enumerate((L1, L2, L3), 1):
        for x, y in S: m.rect('cliffs', *G(x, y, x, y), str(k))
    face = lambda x, h: max(y for (a, y), v in lv.items() if a == x and v >= h)   # the south face row of level h in column x
    stairs = {'W foot': (20, 27), 'W hut': (23, 19), 'W mid': (12, 24), 'W summit': (8, 21),
              'E foot': (36, 23), 'E mid': (46, 20), 'E summit': (40, 16), 'E spur': (55, 16)}
    for name, (x, y) in stairs.items():
        assert lv[(x, y)] >= 1 and lv.get((x, y + 1), 0) == lv[(x, y)] - 1 == lv.get((x, y + 2), 0), (name, x, y)
        m.rect('cliffs', 2 * x, 2 * y, 2 * x + 1, 2 * y + 1, 'S')   # one game cell wide: the set's two tile stair pair
    mx, my = 38, 20; stairs['mouth'] = (mx, my)                    # the cave: a hole in the east level 2 face
    P = lambda x0, y0, x1, y1: m.rect('ground', *G(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), 'd')
    # ---- roads: west gateway, the trunk (3 wide), the south gateway funnel; trunk east (2 wide)
    P(0, 31, 3, 36); P(4, 33, 22, 35); P(20, 36, 22, 41); P(19, 42, 23, 43); P(17, 44, 25, 47); P(23, 33, 38, 34)
    # ---- footpaths (one cell): each stair on its path, then along the ledges to the next stair
    for name, (x, y) in stairs.items():
        if name != 'mouth': P(x, y, x, y)
    P(20, 28, 20, 32); P(20, 24, 20, 26); P(20, 24, 23, 24); P(23, 20, 23, 24); P(12, 25, 20, 25); P(8, 22, 12, 22); P(12, 22, 12, 23)   # west
    P(36, 24, 36, 32); P(36, 21, 55, 21); P(36, 21, 36, 22); P(46, 18, 46, 19); P(40, 18, 46, 18); P(40, 17, 40, 18); P(55, 17, 55, 21)   # east
    print('stairs', stairs)
    # ---- tall grass beds, only on whole top cells (never a rim or a face, never a path)
    def inner(x, y):
        h = lv.get((x, y), 0)
        return all(lv.get((x + i, y + j), 0) == h for i in (-1, 0, 1) for j in (-1, 0, 1, 2))
    def bedblob(cx, cy, rx, ry, seed=0):
        h = lv.get((round(cx), round(cy)), 0)
        for x, y in blob(W, H, cx, cy, rx, ry, 900 + seed, .3):
            if lv.get((x, y), 0) == h and inner(x, y) and m.get('ground', 2 * x, 2 * y) == '.' and m.get('ground', 2 * x + 1, 2 * y + 1) == '.': m.rect('ground', *G(x, y, x, y), 't')
    for i, b_ in enumerate([(33, 40.5, 5.5, 3), (50, 42, 6, 2.5), (7, 38, 4.5, 2.5),                 # valleys
                            (25, 22, 3, 1.5), (16, 14, 1.2, 6), (57, 19, 3, 1.5), (51, 9, 1.2, 4),     # level 1 ledges and the corridor
                            (40, 9, 4, 2.5), (9, 12, 3, 3), (56, 10, 2.5, 2.5)]): bedblob(*b_, seed=i)  # upper tiers
    # ---- a pond in the east lowland and a patchy nature trail (single dabs with gaps) to it
    m.shape('ground', 94, 66, ["....vvvv....", "..vvvvvvvv..", ".vvvvvvvvvv.", ".vvvvvvvvvv.", "..vvvvvvvv..", "....vvvv...."], 'v')
    m.shape('ground', 97, 69, [".VVVV.", "VVVVVV"], 'V')
    for i, (x, y) in enumerate([(78, 68), (80, 67), (81, 65), (83, 66), (85, 64), (87, 65), (89, 63), (90, 61), (92, 62)]): m.set('ground', x, y, 'd'); m.set('ground', x + 1 - i % 2, y, 'd')
    # ---- ranger hut at the head of the pass, its door on the pass road
    m.building('house_wood_c', 40, 8, to=36, wide=1)   # on the west level 2 terrace, its path down to the hut stairs
    P(21, 18, 23, 18)
    for o, x, y in [('route_sign', 54, 84), ('route_sign', 6, 58)]: m.obj(o, x, y)
    def place(o, x, y, r=5):
        """put prop o at lab (x, y) or the nearest free spot within r cells on the same level"""
        h = m.level(x, y)
        for d in range(r + 1):
            for j in range(-d, d + 1):
                for i in range(-d, d + 1):
                    if max(abs(i), abs(j)) == d and m.level(x + i, y + j) == h and m.free(o, x + i, y + j): m.obj(o, x + i, y + j); return True
        print('  [region_ridge] no room for', o, x, y); return False
    for o, x, y in [('woodpile', 52, 14), ('logs', 52, 20), ('crates', 36, 20),
                    ('cairn', 18, 16), ('bench', 20, 36), ('lantern', 24, 35), ('sign_small', 14, 38),        # west summit lookout over the stacked cliff
                    ('cairn', 80, 14), ('bench', 84, 26), ('lantern', 88, 25), ('spire', 76, 20),            # east summit
                    ('bench', 112, 40), ('lantern', 116, 39),                                                 # rest spot on the east ledge
                    ('boulder', 16, 58), ('rock_tall', 34, 60), ('rock_grassy', 108, 64), ('boulder2', 64, 40), ('mound2', 84, 74),
                    ('rock2', 118, 60), ('boulder', 10, 62), ('rock_grassy', 46, 62), ('boulder', 84, 60), ('boulder3', 60, 58)]:
        place(o, x, y)
    # ---- trees: the forest frame, then pines along the terrace tops (grass tops, so the sprites' grass bases sit on grass), trunks clear of rims
    ring = set()
    lvl = lambda x, y: lv.get((x // 2, y // 2), 0)
    for y in range(2 * H):
        for x in range(2 * W):
            if any(lvl(x + i, y + j) != lvl(x, y) for i in (-2, 0, 2) for j in (-2, 0, 2, 4)): ring.add((x, y))
    near_prop = lambda bx, by: any((bx + i, by + j) in m.bases for i in range(-2, 3) for j in range(-1, 2))
    def grove(x0, y0, x1, y1, seed, n):
        rng = __import__('random').Random(seed); k = 0
        for _ in range(n * 40):
            if k >= n: break
            bx, by = rng.randint(x0, x1), rng.randint(y0, y1)
            if (bx, by) in ring or near_prop(bx, by): continue
            if m.tree(rng.choice(PINES), bx, by, quiet=True): k += 1
    m.forest(-2, -1, 130, 1, PINES, 301); m.forest(122, -1, 130, 40, PINES, 302, dx=2, dy=3); m.forest(118, 40, 130, 95, PINES, 303, dx=2, dy=3)
    m.forest(-3, 0, 4, 56, PINES, 304, dx=2, dy=3); m.forest(-3, 76, 3, 95, PINES, 305, dx=2, dy=3); m.forest(-2, 88, 32, 94, PINES, 306); m.forest(52, 88, 130, 94, PINES, 307)
    m.forest(6, 74, 30, 86, PINES, 308, dx=3, dy=2); m.forest(60, 72, 112, 84, PINES, 309, dx=3, dy=2)
    # the north band: a forest on the top tiers hides the inner rims along the window's north edge; the sides sit under the forest frame
    for i, (x0, x1) in enumerate([(0, 30), (34, 60), (64, 98), (102, 127)]): m.forest(x0, 6, x1, 12, PINES, 520 + i, dx=3, dy=3)
    # a tree line along the top of every face (the HGSS look), with gaps at stairs and paths
    for x0, y0, x1, y1 in L1R + L2R + L3R:
        for bx in range(2 * x0 + 3, 2 * x1, 4):
            by = 2 * y1 - 1
            if any(m.get('ground', bx + i, by + j) not in ('.', 't') for i in range(-3, 4) for j in range(-6, 3)) or any(m.get('cliffs', bx + i, 2 * y1) == 'S' for i in range(-4, 5)): continue
            m.tree(PINES[(bx * 7 + by) % len(PINES)], bx, by, quiet=True)
    for i, r_ in enumerate([(30, 14, 34, 50), (60, 8, 66, 40), (100, 14, 120, 30), (110, 34, 124, 44), (10, 20, 22, 36), (74, 18, 88, 26)]): grove(*r_, 500 + i, 5)
    for name, bx, by in [('round_olive0', 66, 62), ('pine_teal0', 8, 64), ('bare_olive0', 60, 6), ('young_olive0', 34, 64), ('round_green0', 108, 70)]: m.tree(name, bx, by, quiet=True)
    trees = [(cells, max(b[1] for b in base)) for n, x, y in m.objects if n.split('_')[0] in B.TREES for cells, base in [m._place(n, x, y)]]
    stair_cells = {(2 * x + i, 2 * y + j) for x, y in stairs.values() for i in (-1, 0, 1, 2) for j in range(-2, 5)}
    for a_ in [('npc', 'npc5-camo-man', 44, 30, 'down'), ('mon', 41, 18, 12, 'right'), ('npc', 'npc1-explorer', 30, 50, 'left'), ('mon', 66, 90, 42, 'left'), ('mon', 74, 36, 52, 'right'),
               ('mon', 111, 98, 58, 'down'), ('mon', 246, 92, 26, 'down'), ('npc', 'north-headband-brawler', 90, 50, 'down'), ('mon', 304, 24, 66, 'left'), ('mon', 27, 54, 70, 'left')]:
        k, who, x, y, f = a_   # nearest cell nobody stands on, off every edge and stairs approach, on plain ground
        ok = lambda c: m.ground(*c) in '.t' and not m.edge(*c) and c not in m.bases and c not in m.solid and c not in stair_cells and not any(c in tc and c[1] < tb for tc, tb in trees)
        x, y = min(((x + i, y + j) for i in range(-6, 7) for j in range(-6, 7) if ok((x + i, y + j))), key=lambda c: abs(c[0] - x) + abs(c[1] - y))
        m.act(k, who, x, y, f)
    for i, (cx, cy) in enumerate([(14, 62), (40, 60), (54, 46), (110, 62), (74, 74), (18, 80), (26, 36), (90, 40), (112, 30), (60, 50)]): m.cluster(FLOWERS, cx, cy, 3, 400 + i, r=2)
    m.scatter(ROCKS, 70, (0, 0, 2 * W - 1, 2 * H - 1), 18)
    return m, lv, stairs


if __name__ == '__main__':
    m, lv, stairs = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_ridge]', w)
    mp = json.load(open(p)); mx, my = stairs['mouth']
    mp['holes'] = [[2 * mx, 2 * my]]   # the cave mouth, painted into the face (render.HOLE)
    mp['doors'] = [{'room': 'ridge-cave', 'x': 2 * mx, 'y': 2 * my}]    # the lab anchor of the cave stamp; the exporter derives the door line and its level
    mp['start'] = [0, 33]
    mp['probes'] = {'outside west': [-1, 33], 'south gate': [21, 47], 'hut front': [21, 9], 'mouth front': [mx, my + 1], 'pond side': [44, 36],
                    **{n + ' top': [x, y - 1] for n, (x, y) in stairs.items() if n != 'mouth'}}
    json.dump(mp, open(p, 'w'), indent=1)
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im = R.render(mp)
    im.save(os.path.join(out, 'maplab3-1x.png')); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab3.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
