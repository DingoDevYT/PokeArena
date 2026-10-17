"""Region rebuild pilot 3: the Eastern Ridge (docs/REGION-REBUILD.md section 11).
  py -3.12 -I maplab/maps/region_ridge.py     writes maplab/maps/region_ridge.json, lints it, renders maplab/out/region-pilot/maplab3.png
64 x 48 game cells = 128 x 96 lab cells, window origin world (808, 416). Two massifs with organic plateaus (levels 1, 2, 3), a pass between them,
switchback stairs up the east massif, a cave mouth with a real room (maplab/maps/region_cave1.py), a lookout, a ranger hut in the north meadow.
Exits (game cells of the window): west x 0 rows 31..36 (world y 447..452), south y 47 cols 17..25 (world x 825..833)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B
from ridge_shapes import blob, clean, smooth, inside, levels, stair_row, show
R = B.R
W, H = 64, 48
PINES = ['pine_green0', 'pine_green1', 'pine_teal0', 'pine_olive0', 'tall_olive0', 'pine_teal1']
ROCKS = ['rock_small', 'rock_small', 'clump', 'clump2', 'rock_grey_small', 'clump3', 'tiny_white', 'clump_green']
FLOWERS = B.FLOWERS


def G(x0, y0, x1, y1): return 2 * x0, 2 * y0, 2 * x1 + 1, 2 * y1 + 1     # game cells -> lab rect


def shapes():
    m1a = clean(smooth(blob(W, H, 13, 15, 10.5, 12, 11, .17)))
    m1b = clean(inside(clean(smooth(blob(W, H, 12.5, 14, 6.2, 7.5, 12, .15))), m1a))
    m2a = clean(smooth(blob(W, H, 47.5, 15, 12.5, 12, 21, .17)))
    m2b = clean(inside(clean(smooth(blob(W, H, 46.5, 12.5, 9, 7.5, 22, .15))), m2a))
    m2c = clean(inside(clean(smooth(blob(W, H, 46.5, 9.5, 4.6, 3.6, 23, .12))), m2b))
    return m1a | m2a, m1b | m2b, m2c


def pilot():
    m = B.Map('region_ridge', 2 * W, 2 * H, 'highland', path='d')
    L1, L2, L3 = shapes(); lv = levels([L1, L2, L3]); g = lambda x, y: lv.get((x, y), 0)
    for k, S in enumerate((L1, L2, L3), 1):
        for x, y in S: m.rect('cliffs', *G(x, y, x, y), str(k))
    face = lambda x, h, y0, y1: stair_row(lv, x, h, y0, y1)
    stairs = {'M1 foot': (11, face(11, 1, 20, 30)), 'M1 summit': (6, face(6, 2, 8, 22)), 'M2 foot': (36, face(36, 1, 14, 30)),
              'M2 shelf': (52, face(52, 2, 10, 26)), 'M2 cap': (46, face(46, 3, 4, 14)), 'mouth': (45, face(45, 2, 10, 26))}
    assert all(y is not None for _, y in stairs.values()), stairs
    for name, (x, y) in stairs.items():
        if name != 'mouth': m.rect('cliffs', *G(x, y, x + 1, y), 'S')
    P = lambda x0, y0, x1, y1: m.rect('ground', *G(x0, y0, x1, y1), 'd')
    # ---- roads: west gateway, the trunk (3 wide), a junction, the south gateway funnel
    P(0, 31, 3, 36); P(4, 33, 22, 35); P(20, 36, 22, 41); P(19, 42, 23, 43); P(17, 44, 25, 47)
    # ---- trunk east (2 wide) to the trail up the east massif; the pass road (3 wide) north to the ranger meadow
    P(23, 33, 38, 34); P(26, 8, 28, 32); P(26, 8, 34, 9)
    # ---- the switchback: east massif foot stairs -> shelf -> shelf stairs -> top -> cap stairs; the cave mouth is on the shelf (rock tops carry no drawn path)
    sx, sy = stairs['M2 foot']; P(sx, sy + 1, sx + 1, 32)   # trails on rock tops are not drawn: the dirt set there is only a green outline round the same rock
    fx, fy = stairs['M1 foot']; P(fx, fy + 1, fx + 1, 32)
    for name, (x, y) in stairs.items():
        if name != 'mouth': P(x, y, x + 1, y)    # the path under the stairs
    print('stairs', stairs)
    # ---- the cave mouth: a stamp on the shelf face (lab cells, 3 wide x 2 tall), a short path in front of it
    mx, my = stairs['mouth']; m.obj('cave_brown', 2 * mx, 2 * my)
    # ---- tall grass beds: valleys, the shelf, the summits (all real levels, so wild mons live up there too)
    for r_ in [(28, 38, 38, 43), (44, 40, 56, 44), (45, 23, 56, 25), (8, 10, 15, 13), (40, 14, 44, 16), (47, 27, 50, 29), (3, 36, 12, 40)]: m.rect('ground', *G(*r_), 't')
    # ---- a pond in the east lowland and a patchy nature trail (single dabs with gaps) to it
    m.shape('ground', 94, 66, ["....vvvv....", "..vvvvvvvv..", ".vvvvvvvvvv.", ".vvvvvvvvvv.", "..vvvvvvvv..", "....vvvv...."], 'v')
    m.shape('ground', 97, 69, [".VVVV.", "VVVVVV"], 'V')
    for i, (x, y) in enumerate([(78, 68), (80, 67), (81, 65), (83, 66), (85, 64), (87, 65), (89, 63), (90, 61), (92, 62)]): m.set('ground', x, y, 'd'); m.set('ground', x + 1 - i % 2, y, 'd')
    # ---- ranger hut in the north meadow, its door on the pass road
    m.building('house_wood_c', 62, 4, to=17, wide=1)
    # ---- props that must claim their ground before the trees go in
    for o, x, y in [('route_sign', 54, 84), ('route_sign', 6, 58), ('bench', 26, 24), ('lantern', 32, 22), ('cairn', 92, 16), ('spire', 84, 26), ('spire2', 98, 22),
                    ('boulder', 16, 40), ('spire', 30, 36), ('rock_tall', 34, 54), ('rock_grassy', 108, 58), ('boulder3', 70, 44), ('spire_grey', 90, 28),
                    ('bench', 100, 52), ('lantern', 104, 48), ('woodpile', 76, 8), ('logs', 70, 10), ('crates', 66, 12), 
                    ('boulder2', 66, 36), ('mound2', 84, 74), ('boulder', 6, 74), ('rock2', 104, 40), ('boulder_grey', 96, 26)]:
        m.obj(o, x, y)
    # ---- keep trees off the plateau rims and faces (3 lab cells around every level change)
    lvl = lambda x, y: lv.get((x // 2, y // 2), 0)
    for y in range(2 * H):
        for x in range(2 * W):
            if any(lvl(x + i, y + j) != lvl(x, y) for i in (-3, 0, 3) for j in (-3, 0, 3)): m.busy.add((x, y))
    m.forest(-2, -1, 98, 1, PINES, 301); m.forest(120, -1, 130, 40, PINES, 302, dx=2, dy=3); m.forest(118, 40, 130, 95, PINES, 303, dx=2, dy=3)
    m.forest(-3, 0, 3, 56, PINES, 304, dx=2, dy=3); m.forest(-3, 76, 3, 95, PINES, 305, dx=2, dy=3); m.forest(-2, 88, 32, 94, PINES, 306); m.forest(52, 88, 130, 94, PINES, 307)
    m.forest(6, 74, 30, 86, PINES, 308, dx=3, dy=2); m.forest(60, 72, 112, 84, PINES, 309, dx=3, dy=2); m.forest(66, 46, 76, 60, PINES, 310, dx=3, dy=3)
    for name, bx, by in [('round_olive0', 66, 62), ('pine_teal0', 8, 44), ('bare_olive0', 52, 8), ('pine_teal1', 100, 36),
                         ('young_olive0', 34, 64), ('round_green0', 108, 70)]: m.tree(name, bx, by)
    for a_ in [('npc', 'npc5-camo-man', 62, 18, 'down'), ('mon', 41, 10, 12, 'right'), ('npc', 'npc1-explorer', 28, 26, 'left'), ('mon', 66, 90, 42, 'left'), ('mon', 74, 36, 52, 'right'),
               ('mon', 111, 100, 54, 'down'), ('mon', 246, 96, 22, 'down'), ('npc', 'north-headband-brawler', 94, 30, 'down'), ('mon', 304, 24, 66, 'left'), ('mon', 27, 54, 70, 'left')]: m.act(*a_)
    for i, (cx, cy) in enumerate([(14, 62), (40, 60), (54, 46), (110, 62), (74, 74), (18, 80)]): m.cluster(FLOWERS, cx, cy, 3, 400 + i, r=2)
    m.scatter(ROCKS, 70, (0, 0, 2 * W - 1, 2 * H - 1), 18)
    return m, lv, stairs


if __name__ == '__main__':
    m, lv, stairs = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_ridge]', w)
    mp = json.load(open(p)); mx, my = stairs['mouth']
    mp['doors'] = [{'room': 'ridge-cave', 'x': 2 * mx, 'y': 2 * my}]    # the lab anchor of the cave stamp; the exporter derives the door line and its level
    mp['start'] = [0, 33]
    mp['probes'] = {'outside west': [-1, 33], 'south gate': [21, 47], 'pass north': [27, 9], 'hut front': [32, 8], 'M2 foot top': [36, 18], 'shelf': [48, 21], 'mouth front': [mx, my + 1],
                    'M2 top': [48, 16], 'summit': [46, 9], 'M1 shelf': [9, 23], 'M1 summit': [7, 14], 'pond side': [44, 36], 'M2 shelf stair foot': [52, 18]}
    json.dump(mp, open(p, 'w'), indent=1)
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im = R.render(mp)
    im.save(os.path.join(out, 'maplab3-1x.png')); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab3.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
