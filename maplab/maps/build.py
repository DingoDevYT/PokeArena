"""Author the map-lab snippets as game-native map JSON (maplab/maps/<name>.json), lint them, and render a preview of each.
  py -3.12 -I maplab/maps/build.py [name ...]      (no names = all)
The JSON is what the game would load; this script is only the authoring aid that paints it. Lint warnings print per map
and should be zero: doors on centred paths that reach an exit, nothing standing on paths/water/ridge edges, ponds kept off paths."""
import json, os, random, sys
from collections import deque
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); LAB = os.path.dirname(HERE)
sys.path.insert(0, LAB)
import render as R

# door = (column offset, row offset of the cell in front of the door) inside each building stamp; every door is 1 tile wide
DOORS = {**{f'house_{k}_{v}': (4 if v in 'ab' else 2, 8) for k in ('wood', 'red') for v in 'abcd'},
         'dome_green': (4, 11), 'dome_blue': (4, 11), 'greenhouse': (2, 8),
         'pc4': (2, 6), 'mart4': (1, 5), 'sandhall': (4, 6), 'straw': (1, 6), 'straw2': (3, 6), 'hut_round': (2, 5)}
PAVED = set('qQk')                # stone plazas: walkable, and props (benches, lamps, fountains) stand on them
OPEN = set('.tTuS') | PAVED        # ground a tree canopy or prop may stand over ('S' = open beach sand)
FLOOR = set('.S') | PAVED         # ground small props stand on
WET = set('wvVi')                 # water, ponds, ice
TREES = {'round', 'tall', 'pine', 'young', 'fir', 'bare'}
SWIMMERS = {7, 8, 9, 54, 55, 60, 61, 62, 72, 73, 86, 87, 90, 116, 117, 118, 119, 120, 129, 130, 131, 183, 184, 194, 195,
            222, 278, 279, 341, 366, 393, 692, 728, 751, 767}

_cover = {}
def cover(name):
    """cells (relative to the stamp's top-left cell) that the stamp's solid pixels really cover; shadows don't count"""
    if name not in _cover:
        sx, sy, sw, sh = R.OBJ[name][:4]
        a = np.array(R.obj_image(name))[..., 3] >= 200
        (ox, oy), cells = R.nudge(name), set()
        for j in range((oy + sh + 15) // 16):
            for i in range((ox + sw + 15) // 16):
                blk = a[max(0, j * 16 - oy):max(0, (j + 1) * 16 - oy), max(0, i * 16 - ox):max(0, (i + 1) * 16 - ox)]
                if blk.size and blk.sum() >= 24: cells.add((i, j))
        _cover[name] = cells
    return _cover[name]


class Map:
    def __init__(s, name, w, h, base='grass', path='y'):
        s.name, s.w, s.h, s.base, s.path = name, w, h, base, path
        s.L = {k: [['.'] * w for _ in range(h)] for k in ('ground', 'ridges', 'cliffs', 'fences')}
        s.objects, s.actors = [], []
        s.busy = set()            # every covered cell, for scatter spacing
        s.bases = {}              # footprint cell -> object name (the row a thing stands on)
        s.solid = {}              # building cell -> that building's front row
        s.doors = []              # (name, front cell)
        s.actor_cells = set()

    # painting
    def set(s, layer, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.L[layer][y][x] = ch

    def get(s, layer, x, y): return s.L[layer][y][x] if 0 <= x < s.w and 0 <= y < s.h else None

    def rect(s, layer, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.set(layer, x, y, ch)

    def blob(s, layer, cx, cy, rx, ry, ch):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1: s.set(layer, x, y, ch)

    def shape(s, layer, x0, y0, rows, ch):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.set(layer, x0 + i, y0 + j, ch)

    # terrain queries
    def ground(s, x, y): return s.get('ground', x, y) or '.'
    def is_path(s, x, y): return s.ground(x, y) not in OPEN | WET
    def is_water(s, x, y): return s.ground(x, y) in WET
    def walk(s, x, y): return s.is_path(x, y) or s.ground(x, y) in PAVED
    def beach(s, x, y): return any(s.ground(x + i, y + j) in 'vV' for i in (-1, 0, 1) for j in (-1, 0, 1))   # the renderer's sand rim

    def level(s, x, y):
        c = s.get('cliffs', x, y)
        while c == 'S': y -= 1; c = s.get('cliffs', x, y)
        return int(c) if c and c.isdigit() else 0

    def rock(s, x, y): return s.base.startswith('cave_') and s.level(x, y) > 0   # solid cave rock: nothing stands on it

    def edge(s, x, y):
        """a ridge outline cell, cliff face or stairs: nothing should stand on it"""
        raised = lambda a, b: s.get('ridges', min(max(a, 0), s.w - 1), min(max(b, 0), s.h - 1)) == '#'
        if raised(x, y) and not all(raised(x + i, y + j) for i in (-1, 0, 1) for j in (-1, 0, 1)): return True
        h = s.level(x, y)
        clamp = lambda a, b: s.level(min(max(a, 0), s.w - 1), min(max(b, 0), s.h - 1))
        return h > 0 and (clamp(x, y + 1) < h or clamp(x, y + 2) < h or clamp(x - 1, y) < h or clamp(x + 1, y) < h) or s.get('cliffs', x, y) == 'S'

    # placing things
    def _place(s, name, x, y):
        cells = {(x + i, y + j) for i, j in cover(name)}
        bottom = max(j for _, j in cells) if cells else y
        return cells, {c for c in cells if c[1] == bottom}

    def obj(s, name, x, y):
        cells, base = s._place(name, x, y)
        s.objects.append([name, x, y]); s.busy |= cells
        for c in base: s.bases[c] = name
        return cells, base

    def building(s, name, x, y, to=None, wide=1):
        """a building plus a straight path from its door down (or up) to row `to`, centred on the door"""
        cells, _ = s.obj(name, x, y)
        dx, dy = DOORS[name]; front = (x + dx, y + dy)
        for c in cells: s.solid[c] = front[1]
        s.doors.append((name, front))
        if to is not None:
            lo, hi = sorted((front[1], to))
            s.rect('ground', front[0] - wide // 2, lo, front[0] + wide // 2, hi, s.path)
        return front

    def tree(s, name, bx, by, quiet=False):
        """a tree whose trunk base sits on cell (bx, by); refused if it would cover a path or water, stand on a ridge/cliff
        edge or another thing, or hide part of a building it stands in front of"""
        sx, sy, sw, sh = R.OBJ[name][:4]
        x, y = bx - sw // 32, by - sh // 16 + 1
        cells, base = s._place(name, x, y)
        why = (next((f'covers path/water at {c}' for c in cells if s.get('ground', *c) not in OPEN | {None}), None)
               or next((f'trunk on {s.bases[c]} at {c}' for c in base if c in s.bases), None)
               or next((f'trunk on an edge at {c}' for c in base if s.edge(*c) or s.beach(*c)), None)
               or next((f'in front of a building at {c}' for c in cells if c in s.solid and max(b[1] for b in base) >= s.solid[c]), None)
               or next((f'would hide an actor at {c}' for c in cells if c in s.actor_cells), None))
        if why:
            if not quiet: print(f'  [{s.name}] tree {name} at {bx},{by} refused: {why}')
            return False
        s.obj(name, x, y)
        return True

    def forest(s, x0, y0, x1, y1, kinds, seed, dx=3, dy=2):
        """dense wall of overlapping trees with trunk bases inside the rect; spots that break the rules are skipped"""
        rng = random.Random(seed)
        for j, by in enumerate(range(y0, y1 + 1, dy)):
            for bx in range(x0 + (j % 2) * 2 - rng.randint(0, 1), x1 + 1, dx):
                for ox, oy in ((rng.randint(0, 1), 0), (-1, 0), (1, 1), (0, -1)):
                    if s.tree(rng.choice(kinds), bx + ox, by + oy, quiet=True): break

    def free(s, name, x, y, gap=0):
        """the cells a prop would stand on (plus `gap` around them) are plain ground clear of paths, water, sand, edges and other things"""
        _, base = s._place(name, x, y)
        near = {(bx + i, by + j) for bx, by in base for i in range(-gap, gap + 1) for j in range(-gap, gap + 1)}
        return all(s.ground(*c) in FLOOR for c in base) and not any(
            c in s.busy or c in s.solid or s.get('ground', *c) not in OPEN | {None} or s.edge(*c) or s.beach(*c) or s.rock(*c) for c in near)

    def scatter(s, items, n, region, seed, gap=1):
        """n small props on free plain ground inside region, keeping `gap` cells from paths, water, edges and props"""
        rng = random.Random(seed); x0, y0, x1, y1 = region; placed = tries = 0
        while placed < n and tries < n * 80:
            tries += 1; x, y, o = rng.randint(x0, x1), rng.randint(y0, y1), rng.choice(items)
            if s.free(o, x, y, gap): s.obj(o, x, y); placed += 1

    def cluster(s, items, cx, cy, n, seed, r=1):
        """a few props bunched round (cx, cy) on free plain ground"""
        rng = random.Random(seed); placed = 0
        for _ in range(n * 20):
            if placed >= n: break
            x, y, o = cx + rng.randint(-r, r), cy + rng.randint(-r, r), rng.choice(items)
            if s.free(o, x, y): s.obj(o, x, y); placed += 1

    def act(s, *a): s.actors.append(list(a)); s.busy.add((a[2], a[3])); s.actor_cells.add((a[2], a[3]))

    # checks
    def lint(s):
        out = []
        for name, (fx, fy) in s.doors:
            if not s.walk(fx, fy): out.append(f'{name} door at {fx},{fy} has no path'); continue
            l, r = s.walk(fx - 1, fy), s.walk(fx + 1, fy)
            if l != r and not name.startswith('dome'): out.append(f'{name} door at {fx},{fy}: path off-centre')
            seen, q, ok = {(fx, fy)}, deque([(fx, fy)]), False
            while q and not ok:
                x, y = q.popleft()
                ok = x in (0, s.w - 1) or y in (0, s.h - 1)
                for c in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if c not in seen and s.walk(*c) and 0 <= c[0] < s.w and 0 <= c[1] < s.h: seen.add(c); q.append(c)
            if not ok: out.append(f'{name} door at {fx},{fy}: its path never reaches a map exit')
        own = {}
        for name, x, y in s.objects:
            if name.split('_')[0] in TREES or name in DOORS: continue
            cells, base = s._place(name, x, y)
            for c in base:
                if name.startswith(('water_', 'cv_pool_')): continue
                if s.is_path(*c) or s.is_water(*c) or s.beach(*c): out.append(f'{name} at {x},{y} stands on path/water/sand {c}')
                elif s.edge(*c) and not name.startswith(('cave_', 'cv_exit_', 'cv_hole_', 'cv_wall_hole_', 'cv_ladder_')): out.append(f'{name} at {x},{y} stands on a ridge/cliff edge {c}')
                elif c in own: out.append(f'{name} at {x},{y} overlaps {own[c]} at {c}')
                elif c in s.solid: out.append(f'{name} at {x},{y} inside a building at {c}')
                elif s.rock(*c) and not name.startswith(('cv_exit_', 'cv_hole_', 'cv_wall_hole_', 'cv_ladder_')): out.append(f'{name} at {x},{y} stands in solid rock {c}')
                own[c] = name
        trees = [(cells, max(b[1] for b in base), n) for n, x, y in s.objects if n.split('_')[0] in TREES for cells, base in [s._place(n, x, y)]]
        for kind, who, x, y, _ in s.actors:   # trainers may wade in the shallows ('v'), swimmers anywhere
            c = (x, y)
            if s.ground(*c) in 'wvV' and not (kind == 'mon' and int(who) in SWIMMERS or kind == 'npc' and s.ground(*c) == 'v'): out.append(f'{kind} {who} at {c} in water')
            elif any(c in tc and c[1] < tb for tc, tb, _ in trees): out.append(f'{kind} {who} at {c} hidden behind a tree')
            elif c in s.bases or c in s.solid: out.append(f'{kind} {who} at {c} inside {s.bases.get(c, "a building")}')
            elif s.edge(*c): out.append(f'{kind} {who} at {c} on a ridge/cliff edge')
            elif s.rock(*c): out.append(f'{kind} {who} at {c} inside solid rock')
        near_path = {(x + i, y + j) for x in range(s.w) for y in range(s.h) if s.ground(x, y) in 'vV' for i in range(-2, 3) for j in range(-2, 3)}
        bad = sorted(c for c in near_path if 0 <= c[0] < s.w and 0 <= c[1] < s.h and s.is_path(*c))
        if bad: out.append(f'pond within 2 cells of the path at {bad[:4]}')
        legend = {**R.LEGEND, **R.BASE_LEGEND.get(s.base, {})}
        rg = {k for k, v in legend.items() if isinstance(v, tuple) and v[0] == 'rg'}
        same = lambda x, y, ch: not (0 <= x < s.w and 0 <= y < s.h) or s.ground(x, y) == ch
        thin = [(x, y) for y in range(s.h) for x in range(s.w) for ch in [s.ground(x, y)] if ch in rg and not any(
                all(same(x + i + a, y + j + b, ch) for a in (0, 1) for b in (0, 1)) for i in (-1, 0) for j in (-1, 0))]
        if thin: out.append(f'patch cells outside any full 2x2 block (they render as thin arms) at {thin[:4]}')
        return out

    def dump(s):
        d = dict(name=s.name, size=[s.w, s.h], base=s.base)
        for k, g in s.L.items(): d[k] = [''.join(r) for r in g]
        d.update(objects=s.objects, actors=s.actors)
        p = os.path.join(HERE, s.name + '.json')
        with open(p, 'w') as f: json.dump(d, f, indent=1)
        return p


GREEN = ['tall_green0', 'tall_green1', 'round_green0', 'round_green1', 'tall_green0', 'round_teal0', 'pine_green0']
ROUND = ['round_green0', 'round_green1', 'round_teal0', 'round_green0']
FLOWERS = ['flower_pink', 'flower_yellow', 'flower_white', 'tiny_pink2', 'tiny_blue2', 'tiny_white']
SMALL = ['tiny_white', 'tiny_white2', 'tiny_pink', 'tiny_blue', 'tiny_pink2', 'tiny_blue2', 'clover', 'clover2', 'sprout',
         'clump_green', 'clump_green2', 'clump_green3', 'rock_small', 'tiny_white', 'tiny_pink']


def town():
    m = Map('town', 44, 42, path='y')
    # a clearing in raised forest; the forest edge is a thin rocky ridge (a ledge along the north)
    m.rect('ridges', 0, 0, 29, 5, '#'); m.rect('ridges', 32, 0, 43, 5, '#')
    m.rect('ridges', 0, 6, 3, 41, '#'); m.rect('ridges', 40, 6, 43, 15, '#'); m.rect('ridges', 40, 22, 43, 41, '#')
    m.rect('ridges', 0, 36, 43, 41, '#')
    m.rect('ground', 6, 18, 43, 19, 'y')            # main street, out east
    m.rect('ground', 30, 0, 31, 17, 'y')            # north exit through a cut in the ridge
    m.building('house_wood_a', 5, 9, to=17); m.building('dome_green', 19, 6, to=17, wide=3); m.building('house_red_b', 33, 9, to=17)
    m.rect('ground', 13, 20, 14, 34, 'y'); m.rect('ground', 7, 33, 14, 34, 'y')   # west lane past the cottage
    m.rect('ground', 30, 20, 31, 33, 'y'); m.rect('ground', 30, 32, 38, 33, 'y')  # east lane past the greenhouse
    m.rect('ground', 15, 32, 29, 33, 'y')                                          # pond-side walk joins the lanes
    m.building('house_wood_d', 6, 25); m.building('greenhouse', 32, 24)
    m.shape('ground', 16, 22, ["....vvvv....",
                               "..vvvvvvvv..",
                               ".vvvvvvvvvv.",
                               ".vvvvvvvvvv.",
                               "..vvvvvvvv..",
                               "....vvvv...."], 'v')
    m.shape('ground', 19, 24, [".VVVV.", "VVVVVV"], 'V')
    m.forest(-2, -1, 29, 3, GREEN, 1); m.forest(32, -1, 46, 3, GREEN, 2)
    m.forest(-3, 8, 2, 35, GREEN, 4, dx=2, dy=3); m.forest(41, 8, 47, 14, GREEN, 5, dx=2, dy=3); m.forest(41, 24, 47, 35, GREEN, 6, dx=2, dy=3)
    m.forest(-2, 40, 46, 40, ROUND, 7); m.forest(-1, 43, 46, 46, GREEN, 8)
    for o, x, y in [('flower_pink', 6, 16), ('flower_pink', 7, 16), ('flower_yellow', 11, 16), ('flower_yellow', 13, 16), ('sign_small', 15, 16),
                    ('bed_pink', 15, 14), ('flower_yellow', 29, 16), ('flower_white', 34, 16), ('flower_white', 39, 16), ('route_sign', 32, 6),
                    ('sign_board', 26, 20), ('crates', 36, 21), ('barrel', 38, 21), ('barrel_water', 38, 23),
                    ('bench', 18, 34), ('bench', 24, 34), ('bed_white', 15, 28),
                    ('water_rock', 18, 24), ('water_rock2', 25, 26), ('flower_pink', 6, 32), ('flower_yellow', 12, 28), ('pot_fern', 12, 31),
                    ('sunflower', 38, 26), ('sunflower_small', 39, 28), ('sunflower', 38, 29),
                    ('stump_green', 4, 21), ('stump_moss_green', 38, 34), ('rock', 39, 37), ('stump2_green', 9, 37),
                    ('mushroom_red', 5, 37), ('clump_green', 27, 37), ('mound', 33, 37), ('rock_small', 20, 37)]:
        m.obj(o, x, y)
    m.act('npc', 'npc1-ponytail-girl', 22, 20, 'down'); m.act('mon', 25, 23, 20, 'downLeft')
    m.act('npc', 'npc2-old-man', 22, 35, 'left'); m.act('mon', 54, 23, 25, 'left')
    m.act('npc', 'npc1-blue-cap-boy', 27, 30, 'left'); m.act('mon', 133, 26, 31, 'up')
    m.act('npc', 'npc1-explorer', 31, 10, 'down'); m.act('mon', 16, 35, 23, 'left')
    m.act('npc', 'npc3-apron-woman', 35, 33, 'up'); m.act('mon', 1, 33, 34, 'upRight')
    m.act('mon', 58, 40, 19, 'left'); m.act('npc', 'npc1-red-cap-man', 10, 20, 'right'); m.act('mon', 300, 18, 30, 'right')
    for i, (cx, cy) in enumerate([(5, 22), (17, 30), (27, 29), (36, 25), (11, 23), (35, 35), (8, 35), (24, 15), (28, 23)]):
        m.cluster(FLOWERS, cx, cy, 3, 30 + i)
    m.scatter(SMALL, 60, (4, 6, 39, 35), 11)
    return m


def route():
    m = Map('route', 52, 32, path='d')
    # high meadow along the north with an uneven cliff edge and stairs at x 31-32; a lower shelf in the east to jump down from
    for x0, x1, face in [(0, 9, 9), (10, 17, 7), (18, 29, 9), (30, 33, 9), (34, 43, 7), (44, 51, 9)]:
        m.rect('cliffs', x0, 0, x1, face, '2')
    m.rect('cliffs', 31, 8, 32, 9, 'S')
    m.rect('cliffs', 35, 10, 51, 15, '1')
    m.rect('ridges', 0, 27, 51, 31, '#')
    # dirt path: in from the west, a bend round the big grass patch, a fork up the stairs, out east
    for x0, y0, x1, y1 in [(0, 18, 15, 19), (14, 14, 15, 19), (14, 14, 31, 15), (30, 14, 31, 19), (30, 18, 51, 19), (31, 3, 32, 13), (32, 3, 41, 4)]:
        m.rect('ground', x0, y0, x1, y1, 'd')
    m.blob('ground', 31, 16.5, 2.2, 1.6, 'd')
    for x0, y0, rows in [(3, 11, ["..tttttt", ".ttttttt", "tttttttt", "ttttttt.", ".tttt..."]),
                         (17, 17, ["...tttttttt", ".tttttttttt", "tttttttttttt", "tttttttttttt", ".tttttttttt.", "...tttttt..."]),
                         (37, 10, ["..ttttttt...", ".tttttttttt.", "tttttttttttt", ".ttttttttt.."]),
                         (2, 4, ["..ttttt", "ttttttt", ".tttt.."]), (19, 4, [".tttttttt", "ttttttttt", "..ttttt.."])]:
        m.shape('ground', x0, y0, rows, 't')
    m.shape('ground', 39, 22, ["..vvvvv..", ".vvvvvvvv", "vvvvvvvvv", ".vvvvvv.."], 'v')
    m.forest(-2, -1, 54, 2, GREEN, 21)
    m.forest(-2, 31, 54, 31, ROUND, 22); m.forest(-1, 34, 54, 36, GREEN, 23)
    for name, bx, by in [('round_green0', 22, 25), ('round_green1', 3, 25), ('round_green0', 50, 24), ('round_teal0', 26, 11), ('young_green0', 12, 5),
                         ('pine_green0', 12, 23), ('round_green1', 36, 26), ('young_green1', 49, 12), ('tall_teal0', 47, 6), ('pine_green0', 8, 15),
                         ('young_green0', 35, 23)]:
        m.tree(name, bx, by)
    for o, x, y in [('route_sign', 1, 15), ('sign_small', 33, 14), ('rock_grey', 48, 16), ('rock_grey_small', 45, 16), ('rock_tall', 25, 10),
                    ('stump_green', 9, 24), ('stump_moss_green', 28, 25), ('mushroom_red', 11, 25), ('mushroom', 29, 24), ('log', 33, 21),
                    ('mound_grass', 5, 9), ('mound', 19, 10), ('mound_grey', 30, 25), ('water_rock_grey', 42, 23), ('rock_small', 37, 22),
                    ('bed_white', 13, 3), ('bed_yellow', 44, 2), ('sunflower', 26, 5), ('clump_green', 6, 16), ('clump_green2', 27, 17),
                    ('stump2_green', 49, 25), ('rock', 16, 10), ('clump', 36, 8), ('rock_grey_tall', 42, 8)]:
        m.obj(o, x, y)
    for x in range(2, 12): m.set('fences', x, 21, 'F')
    m.act('npc', 'npc1-headband-boy', 12, 18, 'right'); m.act('mon', 19, 11, 18, 'right')
    m.act('npc', 'npc4-ponytail-girl', 36, 3, 'left'); m.act('npc', 'npc1-camo-boy', 46, 12, 'down')
    m.act('npc', 'npc4-sailor', 43, 21, 'down'); m.act('npc', 'lunick-lunick', 24, 15, 'right'); m.act('mon', 133, 23, 15, 'right')
    for dex, x, y, d in [(16, 6, 13, 'right'), (19, 21, 20, 'left'), (10, 25, 21, 'down'), (43, 40, 11, 'down'), (29, 44, 11, 'left'),
                         (161, 4, 5, 'down'), (187, 22, 5, 'left'), (12, 32, 24, 'down'), (60, 44, 23, 'down'), (74, 43, 9, 'left')]:
        m.act('mon', dex, x, y, d)
    for i, (cx, cy) in enumerate([(3, 13), (12, 11), (27, 9), (33, 24), (45, 21), (49, 21), (18, 24), (6, 23), (37, 6), (47, 4), (24, 12)]):
        m.cluster(FLOWERS, cx, cy, 3, 50 + i)
    m.scatter(SMALL, 55, (0, 3, 51, 26), 12)
    return m


AUTUMN = ['round_orange0', 'round_orange1', 'round_red0', 'tall_orange0', 'tall_red0', 'tall_orange1', 'round_red1', 'tall_turning', 'round_pink0']
AUTUMN_ROUND = ['round_orange0', 'round_orange1', 'round_red0', 'round_red1', 'round_pink0', 'young_orange0']
LEAVES = ['leaves_small', 'leaves_tiny', 'leaves_small', 'mushroom', 'rock_small', 'leaves_tiny', 'tiny_white', 'clump3']


def autumn():
    m = Map('autumn', 40, 34, 'autumn', path='B')
    # a shrine hill: stone steps climb from the valley through two torii to a grove on the plateau
    m.rect('cliffs', 0, 0, 39, 10, '1'); m.rect('cliffs', 19, 9, 20, 10, 'S')
    m.rect('cliffs', 0, 0, 7, 12, '1'); m.rect('cliffs', 33, 0, 39, 12, '1')
    m.rect('ground', 19, 11, 20, 33, 'B')                                  # the approach
    m.rect('ground', 19, 1, 20, 8, 'B'); m.blob('ground', 19.5, 4.5, 4.2, 2.6, 'B')   # grove square
    m.rect('ground', 21, 24, 29, 25, 'B')                                  # side path to the tea house
    m.building('house_wood_c', 27, 14, to=24)
    m.shape('ground', 2, 21, ["..wwwww...", ".wwwwwwww.", "wwwwwwwwww", "wwwwwwwww.", ".wwwwww..."], 'w')
    m.shape('ground', 10, 14, ["..TTTT", "TTTTTT", "TTTTT.", ".TTT.."], 'T')
    m.obj('torii', 16, 22); m.obj('torii', 16, 12)
    m.forest(-2, -1, 42, 1, AUTUMN, 31)
    m.forest(-3, 15, 1, 33, AUTUMN, 32, dx=2, dy=3); m.forest(37, 15, 43, 33, AUTUMN, 33, dx=2, dy=3)
    m.forest(-2, 34, 42, 34, AUTUMN_ROUND, 34); m.forest(-1, 37, 42, 39, AUTUMN, 35)
    for name, bx, by in [('round_pink0', 13, 4), ('round_pink1', 26, 4), ('tall_pink0', 9, 8), ('tall_pink1', 30, 8), ('young_pink0', 4, 6),
                         ('young_pink1', 35, 6), ('tall_red1', 12, 20), ('round_orange0', 26, 21), ('young_red0', 13, 28), ('tall_turning2', 34, 30),
                         ('round_red0', 26, 30), ('young_orange0', 6, 30)]:
        m.tree(name, bx, by)
    for x, y in [(16, 19), (23, 19), (16, 29), (23, 29), (15, 3), (24, 3), (16, 7), (23, 7)]:
        m.obj('lantern', x, y)
    for o, x, y in [('leaves', 4, 16), ('leaves_mixed', 34, 18), ('leaves', 24, 28), ('leaves_mixed', 9, 26), ('pumpkin', 33, 23), ('pumpkin_face', 35, 24),
                    ('scarecrow', 34, 21), ('pumpkin', 36, 22), ('bench', 22, 21), ('bed_pink', 12, 2), ('bed_white', 25, 2), ('sign_small', 21, 30),
                    ('water_rock', 5, 23), ('mushroom_red', 14, 31), ('stump_orange', 30, 30), ('rock', 9, 18), ('pot_red', 26, 22), ('barrel', 35, 16),
                    ('bed_pink', 24, 26), ('flower_pink', 31, 22), ('leaves', 29, 27), ('pumpkin', 32, 25), ('leaves_mixed', 12, 23), ('bed_white', 3, 19)]:
        m.obj(o, x, y)
    m.act('npc', 'npc1-robed-woman', 20, 4, 'down'); m.act('mon', 37, 21, 5, 'downLeft')
    m.act('npc', 'npc3-old-woman-cane', 25, 23, 'down'); m.act('mon', 216, 14, 21, 'right')
    m.act('npc', 'npc1-striped-dress-girl', 19, 30, 'up'); m.act('mon', 133, 20, 31, 'upLeft')
    m.act('npc', 'npc3-apron-woman', 30, 23, 'down'); m.act('mon', 710, 30, 27, 'left'); m.act('mon', 162, 9, 13, 'down')
    m.act('npc', 'npc4-harmonica-boy', 7, 20, 'right'); m.act('mon', 194, 6, 24, 'down')
    m.scatter(LEAVES, 60, (2, 1, 37, 32), 13)
    return m


FIRS = ['fir_green_snow0', 'fir_green_snow1', 'pine_green_snow0', 'fir_teal_snow0', 'tall_green_snow0', 'pine_teal_snow1', 'fir_olive_snow0']
SNOW_ROUND = ['round_green_snow0', 'round_teal_snow0', 'round_green_snow1', 'young_green_snow0']
SNOW_BITS = ['snow_lump', 'snow_lump2', 'ice_pebble', 'ice_pebble2', 'ice_pebble3', 'snow_lump', 'ice_stone']


def snow():
    """small: a hamlet under a snowy ridge; a frozen pond, a Pokemon Center stand-in, firewood for winter"""
    m = Map('snow', 32, 31, 'snow', path='d')
    m.rect('cliffs', 0, 0, 31, 4, '1'); m.rect('cliffs', 15, 3, 16, 4, 'S')     # the ridge, stairs in the middle
    m.rect('ground', 15, 0, 16, 30, 'd')                                         # the one road: north over the ridge, south out
    m.rect('ground', 15, 19, 31, 20, 'd')                                        # east exit
    m.building('dome_blue', 18, 6, to=19, wide=3)
    m.building('house_wood_a', 3, 6, to=16); m.rect('ground', 7, 15, 14, 16, 'd')
    m.building('house_red_c', 19, 21); m.rect('ground', 17, 29, 22, 30, 'd')
    m.shape('ground', 2, 19, ["...iiii...",
                              ".iiiiiiii.",
                              "iiiiiiiiii",
                              "iiiiiiiiii",
                              ".iiiiiiii.",
                              "...iiiii.."], 'i')
    m.shape('ground', 26, 22, [".ttttt", "tttttt", "tttttt", ".tttt."], 't')
    m.shape('ground', 2, 27, ["..tttttt...", "ttttttttt.."], 't')
    m.act('npc', 'npc1-blue-jacket-girl', 6, 21, 'right'); m.act('mon', 220, 8, 22, 'left'); m.act('mon', 363, 4, 22, 'right')
    m.act('npc', 'north-hood-ranger', 16, 2, 'down'); m.act('mon', 215, 9, 1, 'down')
    m.act('mon', 361, 18, 19, 'down'); m.act('mon', 471, 13, 22, 'left'); m.act('mon', 613, 12, 17, 'down')
    m.act('mon', 459, 29, 23, 'left'); m.act('npc', 'npc2-red-jacket-woman', 23, 30, 'up'); m.act('mon', 225, 25, 30, 'left')
    m.act('npc', 'npc1-red-jacket-boy', 26, 20, 'left'); m.act('mon', 393, 25, 20, 'right'); m.act('mon', 582, 28, 17, 'down')
    m.forest(-2, -1, 13, 2, FIRS, 41); m.forest(18, -1, 34, 2, FIRS, 42)
    m.forest(-3, 6, 1, 30, FIRS, 43, dx=2, dy=3); m.forest(29, 6, 34, 17, FIRS, 44, dx=2, dy=3); m.forest(28, 27, 34, 31, FIRS, 45, dx=2, dy=2)
    m.forest(-1, 30, 13, 32, SNOW_ROUND, 46)
    for o, x, y in [('woodpile', 13, 8), ('logs', 13, 11), ('planter_snow', 3, 14), ('pot_snow', 10, 13), ('bush_green_snow', 11, 12),
                    ('lantern', 1, 18), ('lantern', 12, 18), ('lantern', 20, 17), ('lantern', 24, 17), ('crates', 28, 14), ('barrel', 27, 26),
                    ('bench', 4, 25), ('snowpile', 28, 8), ('snowpile', 11, 25), ('ice_boulder', 13, 5), ('ice_rock', 26, 1), ('ice_spike', 12, 22),
                    ('sign_small', 17, 21), ('snowpile', 6, 1), ('ice_tall', 21, 0), ('cone_green_snow', 2, 13), ('barrel_water', 27, 24)]:
        m.obj(o, x, y)
    m.scatter(SNOW_BITS, 30, (0, 0, 31, 30), 14)
    return m


COAST_TREES = ['round_green0', 'round_teal0', 'round_teal1', 'tall_teal0', 'round_green1', 'tall_green0']
BEACH_BITS = ['rock_small', 'clump', 'clump2', 'rock_grey_small', 'clump3', 'log']


def coast():
    """medium: a fishing village on a cove; the street runs along the top, a sandy beach, the sea with an old pier, a headland lookout"""
    m = Map('coast', 48, 36, path='s')
    m.rect('ridges', 0, 0, 37, 2, '#')
    m.rect('cliffs', 38, 0, 47, 17, '1'); m.rect('cliffs', 39, 16, 40, 17, 'S')          # the headland, stairs down to the beach
    m.rect('ground', 0, 12, 37, 13, 's')                                                 # the street
    m.rect('ground', 20, 14, 21, 19, 's'); m.rect('ground', 39, 4, 40, 19, 's')         # down to the beach; up to the lookout
    m.building('house_red_a', 2, 3, to=12); m.building('house_wood_b', 15, 3, to=12); m.building('house_red_d', 26, 3, to=12)
    m.shape('ground', 0, 18, ["SSS....SSSSS......SSSSSSSSS.....SSSSSS....SSSSSS",
                              "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS"], 'S')
    m.rect('ground', 0, 20, 47, 27, 'S')
    m.shape('ground', 0, 24, ["....vvvvvvvv......vvvvvvvvvvvv....vvvvvvvv......",
                              "..vvvvvvvvvvvvv..vvvvvvvvvvvvvvvvvvvvvvvvvvvv...",
                              ".vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.",
                              "vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv"], 'v')
    m.rect('ground', 0, 28, 47, 35, 'v')
    m.shape('ground', 0, 29, ["......VVVVVV.....VVVVVVVVVVV.........VVVVVVV....",
                              "...VVVVVVVVVVVVVVVVVVVVVVVVVVVVV..VVVVVVVVVVVVV.",
                              "VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"], 'V')
    m.rect('ground', 0, 32, 47, 35, 'V')
    m.shape('ground', 43, 3, ["..ttt", ".tttt", "ttttt", ".ttt."], 't')
    m.shape('ground', 4, 14, ["..tttt", "tttttt", ".ttt.."], 't')
    for x in list(range(2, 13)) + list(range(25, 36)): m.set('fences', x, 17, 'F')
    m.act('npc', 'npc4-sailor', 10, 23, 'down'); m.act('npc', 'npc4-bikini-girl', 16, 21, 'down'); m.act('mon', 120, 17, 22, 'left')
    m.act('npc', 'npc4-swimsuit-boy-orange', 24, 23, 'right'); m.act('mon', 98, 26, 23, 'left'); m.act('npc', 'npc3-old-man-orange', 31, 23, 'down')
    m.act('mon', 79, 5, 22, 'down'); m.act('mon', 131, 22, 31, 'left'); m.act('mon', 72, 14, 29, 'right'); m.act('mon', 222, 37, 27, 'left')
    m.act('mon', 278, 44, 6, 'left'); m.act('npc', 'npc4-teal-haired-girl', 34, 12, 'up'); m.act('npc', 'npc2-bearded-man', 10, 13, 'right')
    m.act('npc', 'npc4-swimsuit-boy-orange', 25, 26, 'down'); m.act('mon', 54, 27, 26, 'left'); m.act('mon', 393, 39, 24, 'up'); m.act('mon', 90, 45, 22, 'left'); m.act('npc', 'npc1-blue-cap-boy', 43, 13, 'down'); m.act('mon', 279, 9, 27, 'down')
    m.forest(-2, -1, 36, 1, COAST_TREES, 51); m.forest(38, -1, 49, 1, COAST_TREES, 52)
    for o, x, y in [('stall', 32, 4), ('crates', 35, 8), ('barrel', 33, 9), ('barrel_water', 31, 9), ('crate_open', 36, 10),
                    ('water_raft', 7, 26), ('water_raft3', 11, 27), ('water_pile', 30, 25), ('water_pile2', 33, 25), ('water_pile3', 30, 27),
                    ('water_pile', 33, 27), ('water_pile2', 30, 29), ('water_raft2', 31, 30), ('water_boulder', 2, 30), ('water_boulder_grey', 40, 28),
                    ('water_rocks', 26, 33), ('water_boulder2', 44, 32), ('water_rock', 19, 27), ('water_rock_grey', 37, 30),
                    ('logs', 2, 21), ('log', 13, 22), ('raft', 27, 20), ('rock', 35, 21), ('bench', 42, 14),
                    ('lantern_grey', 41, 14), ('lantern_grey', 46, 14), ('sign_small', 41, 7), ('sign_board', 22, 15), ('route_sign', 0, 14), ('planter_pink', 8, 10),
                    ('planter_white', 21, 10), ('bed_yellow', 42, 9), ('bed_pink', 45, 10)]:
        m.obj(o, x, y)
    for i, (cx, cy) in enumerate([(13, 9), (24, 9), (30, 15), (16, 15), (2, 15), (36, 15), (45, 3), (40, 3), (11, 15)]):
        m.cluster(FLOWERS, cx, cy, 3, 60 + i)
    m.scatter(SMALL, 25, (0, 3, 47, 17), 15)
    m.scatter(BEACH_BITS, 14, (0, 18, 47, 24), 16)
    return m


CITY_TREES = ['round_green0', 'round_green1', 'round_teal0', 'tall_green0', 'tall_green1', 'round_teal1']


def city():
    """large: a stone city square; a boulevard of shops and two domes, a fountain, a park with a pond, a market"""
    m = Map('city', 64, 48, path='q')
    m.rect('ground', 0, 16, 63, 19, 'q'); m.rect('ground', 20, 20, 43, 33, 'q')        # boulevard and square
    m.rect('ground', 30, 0, 33, 15, 'q'); m.rect('ground', 30, 34, 33, 47, 'q')        # north and south streets
    m.rect('ground', 0, 31, 19, 32, 'q'); m.rect('ground', 44, 31, 63, 32, 'q')        # side lanes
    m.rect('ground', 34, 36, 55, 44, 'q')                                              # market yard
    m.rect('ground', 27, 23, 36, 29, 'Q')                                              # raised plinth under the fountain
    m.building('house_red_a', 2, 7, to=16, wide=3); m.building('dome_blue', 15, 4, to=16, wide=3); m.building('house_wood_a', 35, 7, to=16, wide=3)
    m.building('dome_green', 46, 4, to=16, wide=3); m.building('house_red_d', 57, 7, to=16, wide=3)
    m.building('house_red_c', 2, 22, to=31, wide=3); m.building('greenhouse', 12, 22, to=31, wide=3)
    m.building('house_wood_b', 46, 22, to=31, wide=3); m.building('house_red_b', 55, 22, to=31, wide=3)
    m.shape('ground', 6, 37, ["...vvvvvv...",
                              ".vvvvvvvvvv.",
                              "vvvvvvvvvvvv",
                              "vvvvvvvvvvvv",
                              ".vvvvvvvvvv.",
                              "...vvvvvv..."], 'v')
    m.shape('ground', 9, 39, [".VVVV.", "VVVVVV"], 'V')
    for x in range(1, 29):
        if x not in (13, 14, 15, 16): m.set('fences', x, 34, 'f')
    m.rect('ground', 13, 33, 16, 34, 'q')                                              # park gate
    for a in [('npc', 'npc2-blue-suit-man', 25, 18, 'right'), ('mon', 52, 27, 18, 'left'), ('npc', 'npc4-bowler-hat-man', 36, 29, 'up'),
              ('mon', 122, 31, 29, 'down'), ('npc', 'npc3-pikachu-kid', 33, 30, 'up'), ('mon', 25, 34, 30, 'up'), ('npc', 'npc2-yellow-jacket-woman', 19, 17, 'down'),
              ('mon', 300, 22, 26, 'right'), ('npc', 'npc3-old-woman-purple', 27, 32, 'up'), ('mon', 133, 40, 24, 'left'), ('npc', 'npc4-vest-boy', 50, 18, 'up'),
              ('mon', 506, 51, 19, 'left'), ('mon', 81, 44, 15, 'down'), ('npc', 'npc2-pink-top-girl', 18, 40, 'left'), ('mon', 54, 11, 40, 'right'),
              ('npc', 'npc3-apron-woman', 38, 40, 'down'), ('mon', 66, 47, 42, 'left'), ('npc', 'npc4-bowler-hat-man-grey', 45, 40, 'down'),
              ('npc', 'npc2-dark-hair-woman', 41, 43, 'up'), ('mon', 58, 32, 44, 'up'), ('npc', 'north-navy-ranger', 31, 2, 'down'),
              ('mon', 16, 25, 22, 'right'), ('mon', 16, 38, 21, 'left'), ('mon', 39, 4, 44, 'right'), ('mon', 427, 21, 40, 'down')]:
        m.act(*a)
    m.forest(-2, -1, 29, 5, CITY_TREES, 61); m.forest(34, -1, 65, 5, CITY_TREES, 62)
    m.forest(-3, 45, 29, 49, CITY_TREES, 63); m.forest(56, 34, 66, 49, CITY_TREES, 64, dx=2, dy=3)
    for name, bx, by in [('round_green0', 1, 36), ('round_teal0', 24, 37), ('tall_green1', 27, 41), ('round_green1', 20, 44), ('round_teal1', 2, 41), ('round_teal0', 27, 10)]:
        m.tree(name, bx, by)
    for o, x, y in [('fountain', 29, 24), ('bed_pink', 23, 22), ('bed_yellow', 38, 22), ('bed_white', 23, 29), ('bed_pink', 38, 29),
                    ('bench_stone', 24, 25), ('bench_stone', 38, 25), ('lamp', 20, 19), ('lamp', 43, 19), ('lamp', 20, 31), ('lamp', 43, 31),
                    ('cone_green', 21, 22), ('cone_green', 42, 22), ('cone_green', 21, 26), ('cone_green', 42, 26),
                    ('planter_tall_pink', 13, 14), ('planter_tall_blue', 26, 14), ('planter_tall_orange', 28, 14), ('planter_tall_pink2', 34, 14),
                    ('planter_tall_blue', 45, 14), ('planter_tall_pink', 56, 14), ('lamp_mid', 12, 13), ('lamp_mid', 29, 13), ('lamp_mid', 56, 12),
                    ('stall', 36, 36), ('stall_rug', 45, 36), ('crates', 42, 38), ('barrel', 52, 37), ('barrel_water', 53, 38), ('crate_small', 35, 41),
                    ('crates2', 50, 41), ('table', 48, 39), ('sign_board', 27, 34), ('bench', 4, 35), ('bench', 20, 36), ('bed_white', 13, 44),
                    ('bed_yellow', 22, 42), ('flower_pink', 5, 20), ('flower_yellow', 7, 20), ('flower_white', 14, 20), ('flower_pink', 16, 20),
                    ('flower_white', 48, 20), ('flower_pink', 52, 20), ('flower_yellow', 58, 20), ('flower_white', 61, 20), ('pot_red', 9, 29),
                    ('pot_fern', 19, 29), ('pot_plant', 54, 29), ('post_stone', 30, 34), ('post_stone', 33, 34),
                    ('bush_green', 25, 11), ('cone_green', 13, 9), ('cone_green', 45, 10), ('cone_green', 56, 9), ('lamp', 29, 37), 
                    ('lamp', 34, 46), ('pumpkin', 37, 41), ('pumpkin_face', 39, 41), ('pumpkin', 38, 42), ('sunflowers', 53, 41),
                    ('woodpile', 54, 36), ('logs', 34, 38), ('basin', 31, 21), ('basin', 31, 31), ('planter_pink', 20, 29), ('planter_orange', 41, 29)]:
        m.obj(o, x, y)
    for i, (cx, cy) in enumerate([(3, 38), (22, 39), (25, 45), (9, 45), (17, 36), (60, 26), (44, 26), (10, 26)]):
        m.cluster(FLOWERS, cx, cy, 3, 70 + i)
    m.scatter(SMALL, 20, (0, 33, 29, 47), 17)
    return m


PINES = ['pine_green0', 'pine_green1', 'pine_teal0', 'pine_olive0', 'tall_olive0', 'pine_teal1']
ROCKS = ['rock_small', 'rock_small', 'clump', 'clump2', 'rock_grey_small', 'clump3', 'tiny_white', 'clump_green']


def mountain():
    """medium: a rocky highland pass; a green valley path climbs onto the massif, a summit block with a cave mouth, side plateaus with outcrops"""
    m = Map('mountain', 40, 30, 'highland', path='d')
    m.rect('cliffs', 0, 0, 39, 11, '1'); m.rect('cliffs', 0, 12, 8, 21, '1'); m.rect('cliffs', 31, 12, 39, 21, '1')   # massif, west and east plateaus
    m.rect('cliffs', 14, 0, 33, 6, '2'); m.rect('cliffs', 0, 0, 5, 15, '2'); m.rect('cliffs', 35, 12, 39, 17, '2')    # summit block and outcrops
    for r in [(20, 10, 21, 11), (26, 5, 27, 6), (6, 20, 7, 21), (32, 20, 33, 21)]: m.rect('cliffs', *r, 'S')           # stairs
    for r in [(15, 22, 16, 29), (6, 22, 33, 23), (20, 12, 21, 23)]:
        m.rect('ground', *r, 'd')
    m.shape('ground', 9, 13, ['.tttt..', 'tttttt.', 'ttttttt', '.tttttt', '..ttt..'], 't')
    m.shape('ground', 23, 15, ['..tttt', '.ttttt', 'tttttt', 'ttttt.', '.ttt..'], 't')
    m.shape('ground', 1, 24, ['.ttttt', 'tttttt', 'ttttt.', '..tt..'], 't')
    m.shape('ground', 23, 25, ['tttttt.', 'ttttttt', '.ttttt.'], 't')
    m.obj('cave_brown', 17, 5)
    for a in [('npc', 'npc5-camo-man', 18, 8, 'up'), ('npc', 'npc2-bearded-man', 31, 9, 'left'), ('npc', 'npc4-blonde-girl', 17, 26, 'up'),
              ('mon', 74, 11, 9, 'right'), ('mon', 66, 3, 19, 'right'), ('mon', 95, 36, 13, 'left'), ('mon', 111, 12, 14, 'down'),
              ('mon', 246, 30, 3, 'down'), ('mon', 27, 25, 17, 'left'), ('mon', 21, 9, 3, 'right'), ('mon', 56, 3, 23, 'right'), ('mon', 104, 36, 19, 'left')]:
        m.act(*a)
    m.forest(-2, 27, 13, 31, PINES, 83); m.forest(19, 28, 42, 31, PINES, 84)
    for name, bx, by in [('pine_green0', 10, 19), ('pine_teal0', 27, 21), ('pine_green1', 13, 20), ('round_olive0', 29, 14),
                         ('pine_teal1', 7, 4), ('bare_olive0', 36, 4), ('pine_olive0', 3, 9), ('pine_green0', 33, 9)]:
        m.tree(name, bx, by)
    for o, x, y in [('boulder', 12, 4), ('boulder_grey', 35, 8), ('spire', 29, 2), ('spire2', 2, 10), ('rock_grassy', 22, 19), ('cairn', 24, 2),
                    ('mound', 37, 18), ('rock', 1, 17), ('rock2', 32, 14), ('sign_small', 17, 20), ('logs', 37, 10), ('boulder2', 24, 7)]:
        m.obj(o, x, y)
    m.scatter(ROCKS, 26, (0, 0, 39, 29), 18)
    return m


def cave():
    """medium: inside the mountain; an entrance chamber, a passage north, a grotto with a pool, a crystal hall with a ladder down"""
    m = Map('cave', 36, 28, 'cave_brown', path='g')
    m.rect('cliffs', 0, 0, 35, 27, '1')
    for r in [(11, 18, 24, 25), (16, 26, 19, 27), (16, 12, 19, 17), (20, 4, 32, 12), (3, 4, 14, 13), (14, 11, 16, 13), (26, 15, 32, 22), (24, 19, 26, 21)]:
        m.rect('cliffs', *r, '.')
    m.rect('cliffs', 7, 6, 8, 7, '1'); m.rect('cliffs', 29, 18, 30, 19, '1')            # rock pillars
    m.rect('ground', 5, 8, 10, 11, 'w')                                                  # grotto pool
    for x0, y0, rows in [(13, 21, ['gggg', 'gggg', 'gggg']), (22, 6, ['gggg', 'gggg']), (27, 20, ['ggg', 'ggg'])]: m.shape('ground', x0, y0, rows, 'g')   # gravel patches
    for a in [('npc', 'npc5-camo-man', 18, 22, 'up'), ('npc', 'npc1-explorer', 27, 7, 'left'), ('mon', 41, 13, 20, 'right'), ('mon', 41, 17, 14, 'left'),
              ('mon', 74, 8, 12, 'up'), ('mon', 95, 28, 17, 'left'), ('mon', 66, 21, 21, 'left'), ('mon', 246, 31, 10, 'down'), ('mon', 42, 9, 5, 'down')]:
        m.act(*a)
    for o, x, y in [('cv_crystals_brown', 21, 4), ('cv_crystal_brown', 23, 4), ('cv_crystal_small_brown', 24, 5), ('cv_crystals_brown', 31, 11), ('cv_crystal_brown', 32, 9),
                    ('cv_stalagmites_brown', 3, 4), ('cv_drip_brown', 12, 5), ('cv_ladder_down_brown', 30, 5), ('cv_boulder_brown', 12, 23), ('cv_boulder_brown', 22, 18),
                    ('cv_spike_brown', 11, 19), ('cv_spike_brown', 24, 23), ('cv_stone_brown', 14, 24), ('cv_pebbles_brown', 20, 24), ('cv_pebbles2_brown', 15, 19),
                    ('cv_pool_rock_brown', 8, 9), ('cv_pool_stone_brown', 6, 8), ('cv_mound_brown', 4, 10), ('cv_stalagmites_brown', 31, 15),
                    ('cv_crystal_small_brown', 27, 16), ('cv_pebbles_brown', 28, 11), ('cv_stone_brown', 3, 7), ('cv_spike_brown', 13, 8), ('cv_exit_brown', 9, 1)]:
        m.obj(o, x, y)
    return m


def lava():
    """small: a magma chamber; a lava river crossed by one rock bridge, a lava pool in the south, a chest room and a ladder down north"""
    m = Map('lava', 30, 22, 'cave_red', path='g')
    m.rect('cliffs', 0, 0, 29, 21, '1')
    for r in [(2, 6, 27, 17), (4, 3, 10, 5), (18, 3, 25, 5), (3, 5, 11, 5), (17, 5, 26, 5), (8, 18, 19, 18), (12, 19, 15, 21)]:
        m.rect('cliffs', *r, '.')
    for x, y in [(2, 6), (27, 6), (2, 17), (3, 17), (26, 17), (27, 17)]: m.set('cliffs', x, y, '1')
    m.shape('ground', 2, 8, ['wwwwwwww...', 'wwwwwwwwwww', 'wwwwwwwwwww', '..wwwwwwwww', '....wwwww..'], 'w')             # lava lake, west
    m.shape('ground', 16, 8, ['...wwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwww...', '.wwwwww.....'], 'w')       # and east; the bridge is x 13..15
    m.shape('ground', 3, 14, ['wwww..', 'wwwww.', '.wwww.'], 'w')                                                       # lava pool
    m.shape('ground', 19, 15, ['ggg..', 'ggggg', '..ggg'], 'g'); m.rect('ground', 8, 6, 10, 7, 'g')                    # cooled crust
    for a in [('npc', 'npc1-camo-boy', 16, 12, 'left'), ('npc', 'npc2-bearded-man', 22, 5, 'left'), ('mon', 126, 6, 5, 'down'),
              ('mon', 218, 17, 7, 'left'), ('mon', 324, 9, 15, 'left'), ('mon', 218, 4, 13, 'down'), ('mon', 322, 19, 13, 'down'),
              ('mon', 240, 24, 12, 'left'), ('mon', 58, 10, 17, 'up')]:
        m.act(*a)
    for o, x, y in [('chest_big_red', 6, 3), ('cv_drip_red', 9, 3), ('cv_crystal_red', 4, 3), ('cv_ladder_down_red', 24, 3), ('cv_crystals_red', 18, 3),
                    ('cv_crystal_small_red', 20, 4), ('cv_boulder_red', 4, 6), ('cv_spike_red', 25, 6), ('gem_orange', 12, 7), ('cv_stone_red', 21, 7),
                    ('cv_pool_rock_red', 6, 9), ('cv_pool_spike_red', 21, 10), ('cv_pool_stone_red', 25, 9), ('cv_boulder_red', 24, 15),
                    ('cv_stalagmites_red', 2, 12), ('cv_crystal_red', 27, 13), ('cv_pebbles_red', 17, 16), ('cv_pebbles2_red', 11, 14),
                    ('cv_stone_red', 11, 16), ('chest_red', 26, 16), ('gem_red', 22, 13)]:
        m.obj(o, x, y)
    m.scatter(['cv_pebbles_red', 'cv_pebbles2_red', 'cv_stone_red'], 7, (2, 3, 27, 18), 91)
    return m


def icecave():
    """small: a frozen grotto; a lake you walk round, pink crystal clusters, a chest across the ice, a ladder up"""
    m = Map('icecave', 24, 18, 'cave_ice', path='g')
    m.rect('cliffs', 0, 0, 23, 17, '1')
    for r in [(2, 5, 21, 14), (4, 3, 11, 4), (15, 3, 20, 4), (0, 9, 1, 11), (6, 15, 12, 15)]:
        m.rect('cliffs', *r, '.')
    for x, y in [(2, 5), (21, 5), (2, 14), (20, 14), (21, 14)]: m.set('cliffs', x, y, '1')
    m.shape('ground', 9, 7, ['..wwwww...', '.wwwwwwww.', 'wwwwwwwwww', 'wwwwwwwwww', '.wwwwwwww.', '...wwww...'], 'w')   # frozen lake
    for a in [('npc', 'north-hood-ranger', 3, 10, 'right'), ('mon', 87, 12, 10, 'left'), ('mon', 215, 16, 4, 'right'), ('mon', 220, 6, 13, 'up'),
              ('mon', 361, 9, 4, 'down'), ('mon', 712, 20, 7, 'left'), ('mon', 471, 13, 14, 'up'), ('mon', 478, 5, 6, 'right'), ('mon', 225, 10, 15, 'up')]:
        m.act(*a)
    for o, x, y in [('cv_ladder_up_ice', 8, 2), ('cv_crystals_ice', 4, 3), ('cv_crystal_ice', 11, 3), ('chest_big_teal', 17, 3), ('cv_crystal_small_ice', 20, 4),
                    ('cv_stalagmites_ice', 2, 6), ('cv_boulder_ice', 19, 12), ('cv_spike_ice', 21, 7), ('cv_stone_ice', 7, 7), ('cv_pebbles_ice', 17, 13),
                    ('cv_pebbles2_ice', 3, 12), ('cv_pool_rock_ice', 14, 9), ('cv_crystals_ice', 20, 9), ('gem_pink', 8, 13)]:
        m.obj(o, x, y)
    m.scatter(['cv_pebbles_ice', 'cv_pebbles2_ice', 'cv_stone_ice'], 6, (2, 3, 21, 15), 92)
    return m


def seafloor():
    """small: a dive spot; a sunken basin with a wreck and its spilled treasure, seaweed beds, coral, a cave hole in the north wall"""
    m = Map('seafloor', 30, 22, 'cave_blue', path='g')
    m.rect('cliffs', 0, 0, 29, 21, '1')
    for r in [(3, 4, 25, 16), (6, 2, 12, 3), (26, 8, 29, 11), (14, 17, 17, 21), (18, 17, 22, 17)]:
        m.rect('cliffs', *r, '.')
    for x, y in [(3, 4), (25, 4), (3, 16), (25, 16)]: m.set('cliffs', x, y, '1')
    m.rect('cliffs', 20, 6, 21, 7, '1')                                                  # rock pillar
    m.shape('ground', 5, 12, ['gggg.', 'ggggg', '.gggg'], 'g'); m.shape('ground', 18, 9, ['.ggg', 'gggg', 'ggg.'], 'g'); m.rect('ground', 9, 5, 11, 6, 'g')
    for a in [('mon', 369, 10, 11, 'left'), ('mon', 170, 6, 6, 'right'), ('mon', 170, 23, 10, 'left'), ('mon', 171, 15, 12, 'down'), ('mon', 366, 8, 13, 'up'),
              ('mon', 222, 6, 9, 'left'), ('mon', 116, 19, 5, 'down'), ('mon', 370, 12, 7, 'left'), ('mon', 226, 16, 8, 'down'), ('mon', 211, 27, 10, 'left'),
              ('mon', 90, 11, 14, 'left')]:
        m.act(*a)
    for o, x, y in [('wreck', 8, 8), ('coins', 10, 9), ('shells', 7, 10), ('chest_big_teal', 9, 2), ('seaweed', 3, 5), ('seaweed', 23, 12), ('seaweed', 16, 4),
                    ('weeds', 6, 15), ('weeds', 21, 4), ('weeds', 12, 12), ('coral_red', 5, 9), ('coral_red', 24, 7), ('coral_pink', 14, 15), ('coral_pink', 22, 15),
                    ('cv_crystals_blue', 24, 5), ('cv_crystal_blue', 3, 13), ('cv_boulder_blue', 17, 13), ('sea_stone', 13, 6), ('sea_pebble', 20, 14),
                    ('cv_wall_hole_blue', 18, 2), ('gem_ice', 7, 3)]:
        m.obj(o, x, y)
    m.scatter(['sea_stone', 'sea_pebble', 'shells', 'coral_pink', 'coral_red'], 6, (3, 3, 25, 17), 93)
    return m


def desert():
    """medium: an oasis town under a sandstone ridge; Pokemon Center and Mart on the main road, straw huts, a lake ringed with palms,
    a ramp up to a cave in the ridge, cactus scrub and quicksand outside town"""
    m = Map('desert', 36, 28, 'desert', path='p')
    m.rect('cliffs', 0, 0, 35, 4, '1'); m.rect('cliffs', 17, 3, 18, 4, 'S')
    m.rect('ground', 0, 14, 35, 15, 'p'); m.rect('ground', 17, 5, 18, 27, 'p'); m.rect('ground', 2, 24, 35, 25, 'p')
    m.building('pc4', 3, 7, to=14); m.building('mart4', 10, 8, to=14); m.building('sandhall', 22, 7, to=14)
    m.building('straw', 2, 17, to=24); m.building('straw2', 9, 17, to=24); m.building('hut_round', 31, 17, to=24)
    m.shape('ground', 21, 17, ['..wwwwww..', '.wwwwwwwww', 'wwwwwwwwww', 'wwwwwwwww.', '.wwwwww...'], 'w')
    m.obj('cave_desert', 8, 3)
    for a in [('npc', 'npc2-bearded-man', 9, 5, 'up'), ('npc', 'npc4-vest-boy', 16, 15, 'right'), ('npc', 'npc3-apron-woman', 6, 14, 'down'),
              ('npc', 'npc4-blonde-girl-brown', 20, 22, 'right'), ('npc', 'npc2-old-man', 13, 24, 'left'), ('mon', 54, 26, 19, 'left'),
              ('mon', 27, 14, 6, 'down'), ('mon', 328, 4, 27, 'up'), ('mon', 331, 31, 11, 'left'), ('mon', 343, 28, 26, 'up'), ('mon', 551, 33, 5, 'down')]:
        m.act(*a)
    for o, x, y in [('palm', 19, 17), ('palm2', 28, 18), ('palm', 31, 8), ('cactus_small', 0, 19), ('cacti', 15, 9), ('cacti2', 34, 11),
                    ('cactus_small', 20, 8), ('boulder_desert', 1, 5), ('spire_desert', 30, 5), ('rock_desert', 25, 5), 
                    ('cacti', 0, 26), ('cactus', 32, 26), ('quicksand_small', 31, 0), ('cacti', 4, 0), ('cactus_small', 12, 0),
                    ('rock_desert', 27, 1), ('spire_desert', 2, 1), ('cactus', 23, 26), ('rock_desert', 9, 27)]:
        m.obj(o, x, y)
    return m


MAPS = {'town': town, 'route': route, 'autumn': autumn, 'snow': snow, 'coast': coast, 'city': city, 'mountain': mountain, 'cave': cave,
        'lava': lava, 'icecave': icecave, 'seafloor': seafloor, 'desert': desert}

if __name__ == '__main__':
    for n in sys.argv[1:] or MAPS:
        m = MAPS[n](); p = m.dump()
        warn = m.lint()
        for w in warn: print(f'  [{n}] {w}')
        im = R.render(json.load(open(p)))
        out = os.path.join(LAB, 'shots', f'{n}.png')
        im.resize((im.width * 2, im.height * 2), R.Image.NEAREST).save(out)
        print(p, '->', out, im.size, f'{len(warn)} lint warnings')
