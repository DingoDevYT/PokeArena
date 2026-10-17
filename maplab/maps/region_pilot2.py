"""Region rebuild pilot 2: Route 7 'the grazing country', a hill pasture with two terraces, stairs, a shepherd's hut (docs/REGION-REBUILD.md).
  py -3.12 -I maplab/maps/region_pilot2.py        writes maplab/maps/region_pilot2.json, lints it, renders maplab/out/region-pilot/maplab2.png
64 x 48 game cells = 128 x 96 lab cells, window origin world (240, 928). Everything on EVEN lab coordinates (G() below turns game cells into lab rects).
Cliff rules the exporter relies on: every drop to the south is exactly one level, a face is the bottom 2 lab rows (1 game cell) of its plateau rect,
stairs ('S') are 2 x 2 lab cells (1 game cell) or a multiple wide, cut into a face. Exits (game cells of the window): west rows 5..7 at x 0 (world y 933..935),
north x 51..56 at y 0 (world x 290..295)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B
R = B.R
GREEN, ROUND, FLOWERS, SMALL = B.GREEN, B.ROUND, B.FLOWERS, B.SMALL
OAKS = ['round_green0', 'round_green1', 'round_teal0', 'young_green0']


def G(x0, y0, x1, y1): return 2 * x0, 2 * y0, 2 * x1 + 1, 2 * y1 + 1     # game cells -> lab rect


def pilot():
    m = B.Map('region_pilot2', 128, 96, path='d')
    # ---- terraces (level 1), a knoll (level 2), a ridge plateau in the east; every face drops one level
    for g in [(12, 14, 30, 30), (28, 16, 46, 28), (48, 14, 54, 22)]: m.rect('cliffs', *G(*g), '1')
    m.rect('cliffs', *G(26, 17, 40, 25), '2')
    for g in [(24, 30, 25, 30), (32, 25, 33, 25), (51, 22, 52, 22)]: m.rect('cliffs', *G(*g), 'S')     # stairs cut into the three faces
    # ---- roads: 2 game cells wide, 3 at the gateways; the loop runs round the hill
    for g in [(51, 0, 56, 1), (53, 2, 54, 9), (36, 8, 57, 9), (36, 6, 37, 9), (6, 6, 37, 7), (0, 5, 5, 7),     # north gateway, trunk, west gateway
              (6, 8, 7, 35), (6, 34, 57, 35), (56, 10, 57, 35), (53, 8, 57, 9),                                  # west lane, south lane, east lane back up to the trunk
              (24, 26, 25, 29), (24, 26, 33, 27), (24, 30, 25, 33), (32, 25, 33, 25), (51, 22, 52, 22), (51, 16, 52, 21)]:                                                                # the climb on the first terrace to the knoll stairs
        m.rect('ground', *G(*g), 'd')
    for i, (x, y) in enumerate([(80, 67), (81, 66), (81, 64), (82, 63), (82, 61), (80, 60), (81, 58), (83, 57), (84, 55), (84, 53), (86, 52), (88, 51), (88, 49)]): m.set('ground', x, y, 'd'); m.set('ground', x + (i % 2), y, 'd')
    # ---- tall grass beds (wild areas): lowland and terrace tops
    for g in [(10, 11, 26, 12), (47, 25, 54, 31), (10, 38, 30, 42), (16, 17, 23, 21), (36, 19, 44, 24), (14, 40, 22, 44)]:
        x0, y0, x1, y1 = G(*g); m.rect('ground', x0, y0, x1, y1, 't')
    # ---- a pond on the first terrace
    m.shape('ground', 26, 40, ["....vvvv....", "..vvvvvvvv..", ".vvvvvvvvvv.", ".vvvvvvvvvv.", "..vvvvvvvv..", "....vvvv...."], 'v')
    m.shape('ground', 29, 43, [".VVVV.", "VVVVVV"], 'V')
    # ---- the shepherd's hut on the knoll, door onto a path that reaches the knoll stairs
    m.building('house_wood_c', 60, 36, to=46)
    m.rect('ground', 62, 46, 67, 49, 'd')
    # ---- props that must claim their ground before the trees go in
    for o, x, y in [('route_sign', 100, 12), ('route_sign', 4, 18),                                                  # gateway signs
                    ('bench', 74, 38), ('sign_small', 70, 40), ('lantern', 79, 36),                                  # the lookout on the knoll
                    ('woodpile', 70, 44), ('barrel_water', 56, 44), ('crates', 54, 38), ('bed_yellow', 59, 46), ('bed_white', 68, 38),   # hut yard
                    ('spire', 40, 44), ('boulder', 44, 50), ('spire2', 48, 46), ('cairn', 46, 54), ('boulder2', 36, 52),          # stone circle on the first terrace
                    ('bench', 98, 66), ('lantern', 108, 66), ('sign_board', 90, 64), ('barrel', 108, 60), ('crates2', 104, 60),    # rest spot at the lane's east end
                    ('boulder_grey', 118, 84), ('rock_tall', 20, 62), ('rock_grassy', 94, 22), ('logs', 18, 20), ('mound_grass', 90, 36)]:
        m.obj(o, x, y)
    for i in range(32, 60): m.set('fences', i, 4, 'F')                                                               # a stock fence along the north verge of the trunk
    for y, r in enumerate(m.L['fences']):
        for x, c in enumerate(r):
            if c != '.':
                for i in (-1, 0, 1):
                    for j in (-1, 0, 1): m.busy.add((x + i, y + j)); m.bases[(x + i, y + j)] = 'fence'
    # ---- trees: a frame at the window edge, open pasture with oaks, a grove and a spinney
    m.forest(-2, -1, 98, 1, GREEN, 301); m.forest(112, -1, 130, 4, GREEN, 302); m.forest(-3, 17, 3, 95, GREEN, 303, dx=2, dy=3)
    m.forest(118, 5, 130, 95, GREEN, 304, dx=2, dy=3); m.forest(-2, 88, 130, 94, GREEN, 305)
    m.forest(4, 78, 40, 90, ROUND + ['pine_green0'], 306, dx=3, dy=2); m.forest(84, 76, 117, 87, GREEN, 307, dx=3, dy=2)
    m.forest(98, 56, 114, 64, GREEN, 308, dx=3, dy=2); m.forest(62, 64, 74, 67, ROUND, 309, dx=3, dy=3)
    m.forest(14, 2, 34, 4, GREEN, 310)
    for name, bx, by in [('round_green0', 90, 8), ('round_teal0', 68, 62), ('pine_green1', 84, 26),
                         ('round_green0', 18, 52), ('young_green0', 36, 30), ]:
        m.tree(name, bx, by)
    for a in [('npc', 'npc2-old-man', 64, 47, 'down'), ('mon', 161, 66, 49, 'left'), ('mon', 162, 70, 48, 'right'), ('npc', 'npc1-explorer', 76, 40, 'left'),
              ('npc', 'npc4-vest-boy', 22, 20, 'right'), ('mon', 399, 20, 24, 'down'), ('mon', 400, 42, 46, 'left'), ('npc', 'npc4-blonde-girl', 52, 22, 'down'),
              ('mon', 399, 100, 30, 'left'), ('mon', 19, 96, 72, 'up'), ('npc', 'npc3-apron-woman', 100, 68, 'right'), ('mon', 161, 60, 72, 'down')]:
        m.act(*a)
    for i, (cx, cy) in enumerate([(14, 28), (28, 12), (44, 20), (86, 26), (18, 66), (56, 70), (96, 58), (40, 76), (112, 40), (8, 52), (84, 12)]):
        m.cluster(FLOWERS, cx, cy, 3, 400 + i, r=2)
    m.scatter(SMALL, 70, (0, 2, 127, 90), 405)
    return m


if __name__ == '__main__':
    m = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_pilot2]', w)
    mp = json.load(open(p))
    mp['start'] = [0, 6]   # probe start: the west gateway (game cell, level 0)
    mp['probes'] = {'north gateway': [53, 0], 'hut door front': [31, 23], 'knoll top': [28, 19], 'terrace interior': [18, 22], 'ridge top': [51, 18], 'ridge stair foot': [51, 23], 'terrace stair foot': [24, 32], 'pond shore': [14, 23], 'south lane': [30, 34], 'east shelf': [44, 22], 'outside west': [-1, 6]}
    mp['game_props'] = [['pxTurbine', 24, 10], ['pxTurbine', 76, 11]]   # lab px anchors are exported as the game's own animated turbine (not drawn in the lab render)
    json.dump(mp, open(p, 'w'), indent=1)
    im = R.render(mp)
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im.save(os.path.join(out, 'maplab2-1x.png')); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab2.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
