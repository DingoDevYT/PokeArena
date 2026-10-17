"""Region rebuild: the Eastern Ridge cave room (docs/REGION-REBUILD.md section 11), in the map-lab cave style (maplab cave sheet, base cave_brown).
  py -3.12 -I maplab/maps/region_cave1.py     writes maplab/maps/region_cave1.json, lints it, renders maplab/out/region-pilot/maplab-cave1.png
28 x 20 game cells = 56 x 40 lab cells. Rock is the cliffs layer ('1', solid, dark); floor is level 0. The exporter turns it into a room (data/adv/rooms/ridge-cave.js):
rock is blocked, the floor is walkable, props keep their lab pixel positions. Entry is at the south edge (floor cells of the last game row are the exit)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B
R = B.R
W, H = 28, 20


def G(x0, y0, x1, y1): return 2 * x0, 2 * y0, 2 * x1 + 1, 2 * y1 + 1


def pilot():
    m = B.Map('region_cave1', 2 * W, 2 * H, 'cave_brown', path='d')
    m.rect('cliffs', 0, 0, 2 * W - 1, 2 * H - 1, '1')
    floor = [(4, 3, 23, 9), (11, 10, 15, 19), (3, 12, 10, 17), (16, 11, 24, 16), (12, 18, 14, 19)]
    for r_ in floor: m.rect('cliffs', *G(*r_), '.')
    for r_ in [(10, 5, 12, 6), (18, 4, 19, 5), (6, 14, 7, 15)]: m.rect('cliffs', *G(*r_), '1')     # rock islands with their own faces
    m.rect('ground', *G(20, 12, 23, 14), 'w')                                                      # a pool
    for name, x, y in [('cv_crystals_brown', 40, 10), ('cv_crystal_brown', 46, 12), ('cv_crystal_small_brown', 44, 14), ('cv_stalagmites_brown', 14, 10), ('cv_drip_brown', 28, 16),
                       ('cv_boulder_brown', 10, 26), ('cv_spike_brown', 30, 26), ('cv_boulder_brown', 38, 22), ('cv_spike_brown', 44, 26), ('cv_crystals_brown', 10, 8), ('cv_stalagmites_brown', 20, 28)]:
        m.obj(name, x, y)
    m.scatter(['cv_pebbles_brown', 'cv_pebbles2_brown', 'cv_stone_brown'], 14, (6, 6, 48, 38), 7)
    return m


if __name__ == '__main__':
    m = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_cave1]', w)
    mp = json.load(open(p))
    mp['spawn'] = [13, 17]        # game cell of the arrival
    mp['exit'] = [12, 19, 14, 19]  # game cells (x0, y0, x1, y1) that lead out
    json.dump(mp, open(p, 'w'), indent=1)
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im = R.render(mp); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab-cave1.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
