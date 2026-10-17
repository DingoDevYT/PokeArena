"""Region rebuild pilot: Route 22 'the orchard road' (docs/REGION-REBUILD.md). A 96 x 96 map-lab cell map = 48 x 48 game cells.
  py -3.12 -I maplab/maps/region_pilot.py            writes maplab/maps/region_pilot.json, lints it, renders maplab/out/region-pilot/maplab.png
Every ground feature sits on EVEN lab coordinates (a game cell is 2 x 2 lab cells), so the exporter's 2 x 2 downsample for collision never splits a feature.
Exits (lab cells): west gateway x0, rows 2..7 (game rows 1..3 of the window = world y 465..467); south gateway rows 95, x48..53 (game x 24..26 = world x 864..866)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B
R = B.R
PINK = ['round_pink0', 'round_pink1', 'round_orange0', 'round_pink0', 'round_red0', 'round_pink1']
GREEN, ROUND, FLOWERS, SMALL = B.GREEN, B.ROUND, B.FLOWERS, B.SMALL


def pilot():
    m = B.Map('region_pilot', 96, 96, path='d')
    # roads: 4 lab cells (2 game cells) wide, 6 at the two gateways so they meet the 3 cell wide neighbours
    for r in [(0, 2, 7, 7), (8, 4, 33, 7), (30, 4, 33, 23), (30, 22, 37, 25), (34, 22, 37, 43), (34, 40, 53, 43), (50, 40, 53, 71), (50, 68, 57, 71), (54, 68, 57, 79), (50, 76, 57, 79), (50, 76, 53, 87), (48, 88, 53, 95),
              (54, 56, 73, 59),                    # lane east to the cottage and the produce stall
              (14, 20, 29, 21),                    # the campsite trail
              (38, 28, 45, 29)]:                   # the orchard gate lane
        m.rect('ground', r[0], r[1], r[2], r[3], 'd')
    m.rect('ground', 4, 20, 13, 21, 'd')    # the trail runs on across the campsite clearing
    # orchard: fenced, tall grass under the trees on both sides of the lane
    for x in range(38, 92): m.set('fences', x, 10, 'F'); m.set('fences', x, 37, 'F')
    for y in range(10, 38):
        if y not in (28, 29): m.set('fences', 38, y, 'F')
        m.set('fences', 91, y, 'F')
    for y, r in enumerate(m.L['fences']):   # fences count as things for the scatter and the tree frame, with a one cell margin, so no trunk or rock ends up inside a fence piece
        for x, c in enumerate(r):
            if c != '.':
                for i in (-1, 0, 1):
                    for j in (-1, 0, 1): m.busy.add((x + i, y + j)); m.bases[(x + i, y + j)] = 'fence'
    for x0, y0, rows in [(42, 24, ["tttttttttttt", "tttttttttttt", "tttttttttttt"]), (58, 24, ["tttttttttt", "tttttttttt", "tttttttttt"]), (76, 24, ["tttttttttt", "tttttttttt", "tttttttttt"]),
                         (44, 31, ["tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt"]), (66, 31, ["tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt"])]:
        m.shape('ground', x0, y0, rows, 't')
    # meadow, west: three wild grass beds
    m.shape('ground', 6, 34, ["..ttttttt...", ".ttttttttt..", "tttttttttttt", "tttttttttttt", ".ttttttttt..", "...ttttt...."], 't')
    m.shape('ground', 14, 46, ["tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt", "tttttttttttt"], 't')
    m.shape('ground', 4, 62, ["..tttttttt", ".tttttttttt", "tttttttttttt", "tttttttttttt", ".tttttttttt", "..ttttttt."], 't')
    m.shape('ground', 22, 70, ["tttttttt", "tttttttt", "tttttttt", "tttttttt"], 't')
    m.shape('ground', 60, 86, ["tttttttttt", "tttttttttt", "tttttttttt"], 't')
    # pond for the fisher, east of the south road
    m.shape('ground', 62, 66, ["....vvvvvv....", "..vvvvvvvvvv..", ".vvvvvvvvvvvv.", "vvvvvvvvvvvvvv", "vvvvvvvvvvvvvv", ".vvvvvvvvvvvv.", "..vvvvvvvvvv..", "....vvvvvv...."], 'v')
    m.shape('ground', 66, 69, [".VVVV.", "VVVVVV", ".VVVV."], 'V')
    # buildings
    m.building('house_red_c', 60, 47, to=56)                              # the orchard keeper's cottage, door onto the lane
    # ---- trees: frame, orchard, groves
    # ---- props first, so the tree frame grows around them
    for o, x, y in [('route_sign', 2, 9), ('route_sign', 55, 89), ('sign_small', 32, 26), ('sign_board', 45, 44),                                   # signs
                    ('stall', 56, 62), ('crates', 63, 61), ('barrel', 61, 62), ('crate_small', 66, 62), ('sunflowers', 70, 62), ('pumpkin', 67, 64),     # produce stall
                    ('bench', 44, 46), ('lantern', 47, 47), ('bed_pink', 40, 48),                                                                    # rest spot
                    ('bed_pink', 56, 53), ('flower_yellow', 59, 54), ('bed_white', 68, 53), ('woodpile', 70, 49), ('barrel_water', 72, 52),          # the cottage yard
                    ('scarecrow', 24, 44), ('sunflower', 13, 40), ('sunflower_small', 28, 37), ('arch_wood', 17, 55),                                 # the meadow and its old gate
                    ('bench', 5, 23), ('logs', 9, 15), ('woodpile', 11, 25), ('cairn', 5, 17), ('bed_white', 10, 12), ('bed_yellow', 4, 26), ('stump_green', 11, 23), ('mushroom_red', 7, 27),  # the campsite nook
                    ('water_rock', 66, 70), ('water_rock2', 72, 72), ('log', 59, 70), ('raft', 74, 75), ('rock_grey', 83, 66), ('mound', 60, 65), ('stump_moss_green', 79, 70),   # the pond
                    ('bench', 40, 30), ('basin', 41, 33), ('crates', 85, 31), ('barrel', 88, 30), ('bed_pink', 42, 7), ('bed_white', 48, 7),     # orchard yard
                    ('rock', 88, 62), ('rock_small', 59, 76), ('mound_grass', 40, 52), ('stump2_green', 48, 38), ('mushroom', 37, 56)]:
        m.obj(o, x, y)
    m.forest(-2, -1, 98, 4, GREEN, 101); m.forest(34, 5, 98, 9, GREEN, 102); m.forest(-2, 12, 34, 12, GREEN, 103)
    m.forest(14, 12, 29, 18, GREEN, 104, dx=3, dy=2); m.forest(14, 23, 29, 30, GREEN, 105, dx=3, dy=2)
    m.forest(-3, 12, 2, 95, GREEN, 106, dx=2, dy=3); m.forest(92, 11, 99, 95, GREEN, 107, dx=2, dy=3)
    m.forest(-2, 93, 47, 99, GREEN, 108); m.forest(54, 93, 98, 99, GREEN, 109)
    m.forest(34, 48, 46, 66, GREEN, 110, dx=3, dy=2); m.forest(32, 70, 47, 92, ROUND + ['pine_green0'], 111, dx=3, dy=2)
    m.forest(4, 78, 27, 92, GREEN, 112, dx=3, dy=2); m.forest(76, 46, 90, 58, GREEN, 113, dx=3, dy=2)
    m.forest(56, 76, 90, 92, ROUND, 114, dx=3, dy=2)
    for j, by in enumerate((17, 22, 27, 34)):                              # the orchard rows
        for i, bx in enumerate(range(41 + (j % 2) * 3, 89, 6)):
            if by == 27 and 56 < bx < 80 and False: continue
            m.tree(PINK[(i + j) % len(PINK)], bx, by)
    for name, bx, by in [('round_green0', 22, 40), ('pine_green0', 10, 42), ('round_teal0', 27, 56), ('young_green0', 8, 56), 
                         ('round_green1', 28, 66), ('young_green1', 12, 72), ('pine_green0', 84, 62), ('round_green0', 86, 72),
                         ('young_pink0', 60, 81), ('round_green0', 40, 46), ('tall_green0', 71, 42), ('young_pink1', 78, 44)]:
        m.tree(name, bx, by)
    # ---- props: the points of interest
    m.act('npc', 'npc3-apron-woman', 62, 57, 'up'); m.act('npc', 'npc2-old-man', 59, 66, 'right'); m.act('mon', 415, 52, 20, 'down'); m.act('mon', 414, 52, 29, 'left')
    m.act('npc', 'npc1-explorer', 10, 24, 'left'); m.act('npc', 'npc4-vest-boy', 26, 30, 'down'); m.act('mon', 313, 20, 42, 'right'); m.act('mon', 314, 28, 50, 'left')
    m.act('npc', 'npc1-red-cap-man', 69, 66, 'down'); m.act('mon', 195, 69, 71, 'down'); m.act('mon', 420, 74, 28, 'down'); m.act('mon', 415, 78, 30, 'left')
    m.act('npc', 'npc4-ponytail-girl', 32, 16, 'down'); m.act('mon', 16, 24, 8, 'left')
    for i, (cx, cy) in enumerate([(16, 14), (26, 14), (30, 46), (22, 52), (44, 40), (56, 52), (58, 70), (80, 60), (42, 82), (8, 70), (36, 7), (88, 14)]):
        m.cluster(FLOWERS, cx, cy, 3, 200 + i, r=2)
    m.scatter(SMALL, 110, (0, 6, 95, 92), 205)
    return m


if __name__ == '__main__':
    m = pilot(); p = m.dump(); warn = m.lint()
    for w in warn: print('  [region_pilot]', w)
    im = R.render(json.load(open(p)))
    out = os.path.join(os.path.dirname(HERE), 'out', 'region-pilot'); os.makedirs(out, exist_ok=True)
    im.save(os.path.join(out, 'maplab-1x.png')); im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(os.path.join(out, 'maplab.png'))
    print(p, im.size, f'{len(warn)} lint warnings')
