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


def cols(x0, tops, bots):
    """a plateau from a column profile: column x0 + i spans rows tops[i]..bots[i] (hand-drawn, so the outline steps where the design wants it)"""
    return {(x0 + i, y) for i, (t, b) in enumerate(zip(tops, bots)) for y in range(t, b + 1)}


def shapes():
    """the two massifs, drawn by hand as column profiles: uneven runs and real corners, a rock core offset from a grass foothill shelf;
    south faces stacked one ledge apart where the summit side should read as one tall stepped cliff. Inner corners are composed by the renderer."""
    a1 = cols(2, [13, 13, 13, 13, 8, 8, 8, 8, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 7, 7, 7, 7],
                 [24, 25, 25, 28, 28, 28, 28, 28, 26, 26, 27, 27, 27, 27, 27, 27, 25, 25, 25, 22, 22, 22])
    a2 = cols(9, [9, 9, 7, 7, 7, 6, 6, 6, 6, 6, 7, 7], [23, 23, 25, 25, 25, 25, 25, 25, 23, 23, 23, 20])
    a3 = cols(12, [8, 8, 8, 8, 9, 9], [21, 21, 23, 23, 23, 19])
    b1 = cols(33, [17, 17, 17, 13, 13, 13, 13, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 10, 10, 10],
                  [24, 25, 25, 25, 26, 26, 26, 27, 27, 27, 28, 28, 28, 28, 28, 28, 29, 29, 29, 29, 29, 29, 27, 27, 25, 25])
    b2 = cols(36, [18, 18, 14, 14, 14, 11, 8, 8, 7, 7, 7, 7, 7, 7, 9, 9, 12, 12], [22, 23, 23, 23, 23, 23, 23, 25, 26, 26, 26, 26, 25, 25, 24, 24, 22, 22])   # x 37..42: one straight face for the cave mouth and the shelf stair
    b3 = cols(42, [11, 11, 9, 9, 9, 9, 10, 10], [18, 20, 21, 24, 24, 24, 21, 21])
    trim = lambda S, O: clean(inside(clean(S), O))     # the hand profile, cut back wherever it breaks the one cell / two row margin
    a2 = trim(a2, a1); a3 = trim(a3, a2); b2 = trim(b2, b1); b3 = trim(b3, b2)
    for S in (a1 | b1, a2 | b2, a3 | b3):
        bad = S - clean(S); assert not bad, f'run under 3 cells at {sorted(bad)[:6]}'
    return a1 | b1, a2 | b2, a3 | b3


def pilot():
    m = B.Map('region_ridge', 2 * W, 2 * H, 'ridge', path='d')
    L1, L2, L3 = shapes(); lv = levels([L1, L2, L3])
    for k, S in enumerate((L1, L2, L3), 1):
        for x, y in S: m.rect('cliffs', *G(x, y, x, y), str(k))
    stairs = {'M1 foot': stairs_at(lv, 1, [6, 7, 5, 8], 18, 30), 'M1 summit': stairs_at(lv, 2, [9, 10, 18, 17], 8, 26), 'M1 cap': stairs_at(lv, 3, [12, 13, 16], 8, 26),
              'M2 foot': stairs_at(lv, 1, [34, 35, 36], 14, 30), 'M2 shelf': stairs_at(lv, 2, [41, 42, 50, 51], 8, 28), 'M2 cap': stairs_at(lv, 3, [47, 48, 42, 43], 4, 26),
              'mouth': next(m_ for m_ in (stairs_at(lv, 2, [x], 8, 26) for x in range(37, 45)) if m_ and all(lv.get((m_[0] + i, m_[1])) == 2 and lv.get((m_[0] + i, m_[1] + 1), 0) < 2 for i in (-1, 0, 1, 2)))}   # the hole needs face on both sides of it
    assert all(stairs.values()), stairs
    for name, (x, y) in stairs.items():
        if name != 'mouth': m.rect('cliffs', 2 * x, 2 * y, 2 * x + 1, 2 * y + 1, 'S')   # one game cell wide: one stair (the grass set's left and right halves)
    P = lambda x0, y0, x1, y1: m.rect('ground', *G(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)), 'd')
    grass = lambda x, y: lv.get((x, y), 0) <= 1          # level 0 valleys and the level 1 foothill shelves are meadow; level 2 and 3 are bare rock
    # ---- roads: west gateway, the trunk (3 wide), a junction, the south gateway funnel; trunk east (2 wide); the pass road (3 wide) north to the ranger hut
    P(0, 31, 3, 36); P(4, 33, 22, 35); P(20, 36, 22, 41); P(19, 42, 23, 43); P(17, 44, 25, 47)
    P(23, 33, 38, 34); P(26, 8, 28, 32); P(26, 8, 34, 9)
    # ---- footpaths, one cell wide like the stairs they lead to: trunk -> each foot stair, then along the grass shelves to the next stair.
    #      Rock tiers carry no drawn path (the dirt set on rock is only an outline round the same rock).
    fx, fy = stairs['M1 foot']; ux, uy = stairs['M1 summit']; sx, sy = stairs['M2 foot']; mx, my = stairs['mouth']; hx, hy = stairs['M2 shelf']
    P(fx, fy, fx, 32); P(fx, uy + 2, fx, fy - 1); P(fx, uy + 2, ux, uy + 2); P(ux, uy, ux, uy + 2)       # west: trunk -> foot stair -> shelf -> summit stair
    P(sx, sy, sx, 32); P(sx, my + 1, sx, sy - 1); P(sx, my + 1, hx - 1, my + 1); P(hx - 1, my + 1, hx - 1, hy + 1); P(hx - 1, hy + 1, hx, hy + 1); P(hx, hy, hx, hy)   # east: foot -> cave -> round to the foot of the shelf stair
    for name, (x, y) in stairs.items():
        if name not in ('mouth',) and not grass(x, y + 1): print('  [region_ridge] stair foot on rock:', name)
    print('stairs', stairs)
    # ---- tall grass beds, only on whole meadow top cells (never a rim, a face, a path or rock)
    def inner(x, y):
        h = lv.get((x, y), 0)
        return all(lv.get((x + i, y + j), 0) == h for i in (-1, 0, 1) for j in (-1, 0, 1, 2))
    def bedblob(cx, cy, rx, ry, seed=0):
        h = lv.get((round(cx), round(cy)), 0)
        for x, y in blob(W, H, cx, cy, rx, ry, 900 + seed, .3):
            if h <= 1 and lv.get((x, y), 0) == h and inner(x, y) and m.get('ground', 2 * x, 2 * y) == '.' and m.get('ground', 2 * x + 1, 2 * y + 1) == '.': m.rect('ground', *G(x, y, x, y), 't')
    for i, b_ in enumerate([(33, 40.5, 5.5, 3), (50, 42, 6, 2.5), (7, 38, 4.5, 2.5),                  # valleys
                            (4.5, 18, 2, 4.5), (21, 13, 1.6, 5), (57.5, 17, 1.6, 4), (47, 5, 3, 1.2), (5, 26, 2.5, 1.2), (55, 27, 3, 1.3)]): bedblob(*b_, seed=i)   # foothill shelves
    # ---- a pond in the east lowland and a patchy nature trail (single dabs with gaps) to it
    m.shape('ground', 94, 66, ["....vvvv....", "..vvvvvvvv..", ".vvvvvvvvvv.", ".vvvvvvvvvv.", "..vvvvvvvv..", "....vvvv...."], 'v')
    m.shape('ground', 97, 69, [".VVVV.", "VVVVVV"], 'V')
    for i, (x, y) in enumerate([(78, 68), (80, 67), (81, 65), (83, 66), (85, 64), (87, 65), (89, 63), (90, 61), (92, 62)]): m.set('ground', x, y, 'd'); m.set('ground', x + 1 - i % 2, y, 'd')
    # ---- ranger hut in the north meadow, its door on the pass road
    m.building('house_wood_c', 62, 4, to=17, wide=1)
    for o, x, y in [('route_sign', 54, 84), ('route_sign', 6, 58)]: m.obj(o, x, y)
    def place(o, x, y, r=5):
        """put prop o at lab (x, y) or the nearest free spot within r cells on the same level, so a reshaped plateau never silently drops a landmark"""
        h = m.level(x, y)
        for d in range(r + 1):
            for j in range(-d, d + 1):
                for i in range(-d, d + 1):
                    if max(abs(i), abs(j)) == d and m.level(x + i, y + j) == h and m.free(o, x + i, y + j): m.obj(o, x + i, y + j); return True
        print('  [region_ridge] no room for', o, x, y); return False
    for o, x, y in [('woodpile', 76, 8), ('logs', 70, 10), ('crates', 66, 12),
                    ('cairn', 28, 24), ('spire', 30, 32), ('bench', 14, 30), ('lantern', 18, 30),      # west summit (rock, level 3) and its lookout on level 2
                    ('cairn', 94, 20), ('spire', 88, 26), ('spire2', 98, 30), ('boulder_grey', 92, 34), ('spire_grey', 86, 18),   # east summit
                    ('boulder', 106, 30), ('rock2', 104, 40), ('boulder2', 74, 30), ('spire', 32, 20), ('boulder3', 34, 40),   # rock tiers
                    ('bench', 106, 54), ('lantern', 110, 53),                                            # rest spot on the east foothill shelf
                    ('boulder', 16, 56), ('rock_tall', 34, 60), ('rock_grassy', 108, 64), ('boulder2', 64, 40), ('mound2', 84, 74),
                    ('rock2', 118, 48), ('boulder', 10, 48), ('rock_grassy', 46, 52), ('stump_green', 6, 36), ('boulder', 84, 60)]:
        place(o, x, y)
    # ---- trees: only on meadow (the pine sprites carry a grass base), trunks clear of every rim and of other props' footprints
    ring = set()
    lvl = lambda x, y: lv.get((x // 2, y // 2), 0)
    for y in range(2 * H):
        for x in range(2 * W):
            if any(lvl(x + i, y + j) != lvl(x, y) for i in (-3, 0, 3) for j in (-3, 0, 3, 5)): ring.add((x, y))
    near_prop = lambda bx, by: any((bx + i, by + j) in m.bases for i in range(-3, 4) for j in range(-2, 3))
    def grove(x0, y0, x1, y1, seed, n):
        rng = __import__('random').Random(seed); k = 0
        for _ in range(n * 40):
            if k >= n: break
            bx, by = rng.randint(x0, x1), rng.randint(y0, y1)
            if lvl(bx, by) > 1 or (bx, by) in ring or near_prop(bx, by): continue
            if m.tree(rng.choice(PINES), bx, by, quiet=True): k += 1
    m.forest(-2, -1, 98, 1, PINES, 301); m.forest(120, -1, 130, 40, PINES, 302, dx=2, dy=3); m.forest(118, 40, 130, 95, PINES, 303, dx=2, dy=3)
    m.forest(-3, 0, 3, 56, PINES, 304, dx=2, dy=3); m.forest(-3, 76, 3, 95, PINES, 305, dx=2, dy=3); m.forest(-2, 88, 32, 94, PINES, 306); m.forest(52, 88, 130, 94, PINES, 307)
    m.forest(6, 74, 30, 86, PINES, 308, dx=3, dy=2); m.forest(60, 72, 112, 84, PINES, 309, dx=3, dy=2)
    for i, r_ in enumerate([(6, 26, 12, 50), (40, 10, 46, 44), (66, 30, 72, 46), (110, 20, 118, 50), (60, 14, 66, 40), (84, 6, 104, 10), (20, 6, 40, 10), (84, 54, 100, 58)]): grove(*r_, 500 + i, 4)
    for name, bx, by in [('round_olive0', 66, 62), ('pine_teal0', 8, 64), ('bare_olive0', 52, 8), ('young_olive0', 34, 64), ('round_green0', 108, 70)]: m.tree(name, bx, by, quiet=True)
    trees = [(cells, max(b[1] for b in base)) for n, x, y in m.objects if n.split('_')[0] in B.TREES for cells, base in [m._place(n, x, y)]]
    stair_cells = {(2 * x + i, 2 * y + j) for x, y in stairs.values() for i in (-1, 0, 1, 2) for j in range(-3, 5)}
    for a_ in [('npc', 'npc5-camo-man', 62, 18, 'down'), ('mon', 41, 10, 12, 'right'), ('npc', 'npc1-explorer', 30, 50, 'left'), ('mon', 66, 90, 42, 'left'), ('mon', 74, 36, 52, 'right'),
               ('mon', 111, 98, 58, 'down'), ('mon', 246, 92, 24, 'down'), ('npc', 'north-headband-brawler', 80, 48, 'down'), ('mon', 304, 24, 66, 'left'), ('mon', 27, 54, 70, 'left')]:
        k, who, x, y, f = a_   # nearest cell nobody stands on: plain ground, off every edge, clear of the stairs and their approach
        ok = lambda c: m.ground(*c) in '.t' and not m.edge(*c) and not any(m.edge(c[0] + i, c[1] + j) for i in (-1, 0, 1) for j in (-1, 0, 1)) and c not in m.bases and c not in m.solid and c not in stair_cells and not any(c in tc and c[1] < tb for tc, tb in trees)
        x, y = min(((x + i, y + j) for i in range(-8, 9) for j in range(-8, 9) if ok((x + i, y + j))), key=lambda c: abs(c[0] - x) + abs(c[1] - y))
        m.act(k, who, x, y, f)
    for i, (cx, cy) in enumerate([(14, 62), (40, 60), (54, 46), (110, 62), (74, 74), (18, 80), (8, 34), (42, 30), (112, 30), (100, 10), (70, 52), (60, 40)]): m.cluster(FLOWERS, cx, cy, 3, 400 + i, r=2)
    m.scatter(ROCKS, 40, (0, 0, 2 * W - 1, 2 * H - 1), 18)
    TOPS = ['clump_green', 'clump_green2', 'clump_green3', 'rock_small', 'rock_grey_small', 'tiny_white', 'clump', 'clump2', 'tiny_white2', 'sprout']
    rng = __import__('random').Random(61); k = 0                 # tufts, pebbles and flowers on the rock tiers only, like the highland mockup
    for _ in range(4000):
        if k >= 70: break
        x, y, o = rng.randrange(2 * W), rng.randrange(2 * H), rng.choice(TOPS)
        if lvl(x, y) >= 2 and m.free(o, x, y, 1): m.obj(o, x, y); k += 1
    return m, lv, stairs


if __name__ == '__main__':
    m, lv, stairs = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_ridge]', w)
    mp = json.load(open(p)); mx, my = stairs['mouth']
    mp['holes'] = [[2 * mx, 2 * my]]   # the cave mouth, painted into the face (render.HOLE): a hole in the cliff, not a stamp on it
    mp['levelsets'] = {'1': 'grass', '2': 'rock', '3': 'rock'}   # foothill shelves are grassy hills, the tiers above are bare rock
    mp['doors'] = [{'room': 'ridge-cave', 'x': 2 * mx, 'y': 2 * my}]    # the lab anchor of the cave stamp; the exporter derives the door line and its level
    mp['start'] = [0, 33]
    mp['probes'] = {'outside west': [-1, 33], 'south gate': [21, 47], 'hut front': [32, 8], 'mouth front': [mx, my + 1], 'pond side': [44, 36],
                    **{n + ' top': [x, y - 1] for n, (x, y) in stairs.items() if n != 'mouth'}}
    json.dump(mp, open(p, 'w'), indent=1)
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im = R.render(mp)
    im.save(os.path.join(out, 'maplab3-1x.png')); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab3.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
