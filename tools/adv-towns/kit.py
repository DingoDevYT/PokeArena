"""Town design kit on top of plan.Grid (docs/REGION-REBUILD.md section 17): every prop and building claims the cells its sprite covers, so nothing is drawn
on top of anything else; helpers lay the mockup furniture (a house lot with its walk and beds, tree belts, flower drifts, market rows, fences).
Props are named directly (rg_<lab name> for the map-lab library, or any game prop); the legend is made here. Coordinates are tiles from the town centre."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import plan

T = 32
def size(name):
    d = plan.PROPS[name]; return d['sw'] / T, d['sh'] / T, d['ax'] / T, d['ay'] / T

class Town(plan.Grid):
    def __init__(s, N, code):
        super().__init__(N); s.code = code; s.occ = {}; s.legend = {}; s.chars = iter(chr(c) for c in range(0x100, 0x2000)); s.exits = []; s.deco = []; s.warn = []; s.treeset = set(); s.lots = []
    # ---- occupancy: the cells a sprite covers (its box, rounded inward a little), a footprint for buildings
    def box(s, name, x, y, bld=False):
        sw, sh, ax, ay = size(name); px = x + .5 - (plan.PROPS[name]['door'][0] / T if bld else 0); py = (y if bld else y + 1) - (1 / T)
        x0, y0, x1, y1 = px - ax, py - ay, px - ax + sw, py - ay + sh
        return [(cx, cy) for cy in range(math.floor(y0 + .35), math.ceil(y1 - .35)) for cx in range(math.floor(x0 + .3), math.ceil(x1 - .3))]
    def free(s, cells, ground_ok=True):
        for c in cells:
            if c in s.occ: return False
            if not (-s.N <= c[0] <= s.N and -s.N <= c[1] <= s.N): return False
            if not ground_ok and s.get(*c) not in ('.', 'g', 'a', 'Z'): return False
        return True
    def claim(s, cells, who):
        for c in cells: s.occ[c] = who
    def char(s, name):
        if name not in s.legend: s.legend[name] = next(s.chars)
        return s.legend[name]
    def prop(s, name, x, y, force=False, walk=False):
        """one prop with its foot on tile (x, y); refused (and remembered) if its sprite would cover another; walk: flat decals that may lie on paving"""
        cells = s.box(name, x, y)
        if not force and not s.free(cells, ground_ok=True): return False
        if not walk and not force:                                   # a solid prop never stands on paving: its whole foot row is open ground
            foot = max(c[1] for c in cells) if cells else y
            if any(s.get(cx, cy) not in ('.', 'g', 'a', 'Z') for cx, cy in cells if cy == foot) or s.get(x, y) not in ('.', 'g', 'a', 'Z'): return False
        s.claim(cells, name); s.pp.append((s.char(name), x, y)); return True
    def props(s, name, pts, **k): return sum(s.prop(name, x, y, **k) for x, y in pts)
    def building(s, name, x, y, role='house'):
        """a building whose door walkway tile is (x, y); role 'center', 'house' or [id, {w, d, ex}] (an interior)"""
        cells = s.box(name, x, y, bld=True)
        if not s.free(cells): s.warn.append(f'building {name} at {x},{y} overlaps {[s.occ[c] for c in cells if c in s.occ][:3]}')
        s.claim(cells, name); s.bld(name, x, y, role)
        return cells
    # ---- composites
    def lot(s, name, x, y, street_y=None, street_x=None, role='house', beds=('rg_bed_pink', 'rg_bed_yellow'), extras=(), walk='d'):
        """a house lot: the building (door walkway (x, y)), a one tile walk from its door down (or across) to the street, a flower bed each side of the door"""
        s.building(name, x, y, role); s.rect(x, y - 1, x, y, walk)        # the walk starts under the door row (hidden by the wall), so it meets the door flush
        if street_y is not None: s.rect(x, y, x, street_y, walk)
        if street_x is not None: s.rect(x, y, x, y + 1, walk); s.rect(min(x, street_x), y + 1, max(x, street_x), y + 1, walk)   # down off the doorstep, then along to the street
        sw = size(name)[0]; half = int(sw / 2)
        if beds:                                                     # beds and pots are walk-through, but they never lie on a lane
            for b_, bx in ((beds[0], x - 2), (beds[-1], x + 2)):
                if s.get(bx, y) in ('.', 'g', 'a', 'Z'): s.prop(b_, bx, y, walk=True)
        for nm, dx, dy in extras: s.prop(nm, x + dx, y + dy)
        s.lots.append((name, x, y, sw))
    def dress(s, seed=7, trees=('rg_round_green1', 'rg_young_green0', 'rg_round_teal1', 'rg_young_teal0', 'rg_tall_green1'),
              bushes=('rg_bush_green', 'rg_bush_teal', 'rg_bush_olive', 'rg_bush_pink'), pots=('rg_pot_plant', 'rg_pot_red', 'rg_pot_fern', 'rg_planter_tall_pink')):
        """every house lot gets the mockups' garden: a tree at each back corner, a bush at each front corner, a pot by the door, if there is room"""
        import random; r = random.Random(seed)
        for name, x, y, sw in s.lots:
            hw = int(sw / 2 + .5)
            for dx in (-hw - 1, hw + 1):
                s.prop(r.choice(trees), x + dx, y - 3) or s.prop(r.choice(bushes), x + dx, y - 2)
                s.prop(r.choice(bushes), x + dx, y)
            if s.get(x + 1, y) in ('.', 'g', 'a', 'Z'): s.prop(r.choice(pots), x + 1, y, walk=True)
    def openmask(s, x0, y0, x1, y1, gap):
        """open grass in the box: nothing claimed, not a lawn ('g'), at least `gap` tiles from paving, buildings and deco"""
        pav = {(x, y) for y in range(-s.N, s.N + 1) for x in range(-s.N, s.N + 1) if s.get(x, y) not in ('.', 'a', 'Z')}
        for b in s.blds: pav |= set(s.box(b[0], b[1], b[2], bld=True))
        for d in s.deco:
            if d[0] == 'plot': pav |= {(x, y) for y in range(d[2] - 1, d[2] + d[4] + 1) for x in range(d[1] - 1, d[1] + d[3] + 1)}
            if d[0] == 'pond': pav |= {(x, y) for y in range(int(d[2] - d[4]) - 3, int(d[2] + d[4]) + 4) for x in range(int(d[1] - d[3]) - 3, int(d[1] + d[3]) + 4)}
        near = lambda x, y: any((x + i, y + j) in pav for i in range(-gap, gap + 1) for j in range(-gap, gap + 1))
        return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if s.get(x, y) == '.' and (x, y) not in s.occ and not near(x, y)}
    def meadow(s, cells, kinds, seed=5):
        """a flower meadow: flowers and tufts on about every other tile of the area, a bush now and then (walk-through, so it never blocks)"""
        import random; r = random.Random(seed)
        for (x, y) in sorted(cells):
            if r.random() < .42: s.prop(r.choice(kinds), x, y, walk=True)           # loose, not a lattice
            elif r.random() < .06: s.prop(r.choice(('rg_bush_green', 'rg_bush_teal', 'rg_bush_pink', 'rg_rock_small')), x, y)
    def groves(s, x0, y0, x1, y1, kinds, gap=2, min_area=20, seed=11, styles=None):
        """woods in every open area big enough to read as one (min_area tiles once `gap` is kept from everything): a dense staggered mass, like the mockups"""
        op = s.openmask(x0, y0, x1, y1, gap); seen = set(); n = 0
        for c in sorted(op):
            if c in seen: continue
            comp, st = [], [c]; seen.add(c)
            while st:
                p = st.pop(); comp.append(p)
                for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)):
                    if q in op and q not in seen: seen.add(q); st.append(q)
            if len(comp) < min_area: continue
            cs = set(comp); n += 1; bb = (min(x for x, _ in comp), min(y for _, y in comp), max(x for x, _ in comp), max(y for _, y in comp))
            st, ks = (styles[(n * 7 + len(comp)) % len(styles)] if styles else ('woods', kinds))
            if st == 'meadow': s.meadow(cs, ks, seed=seed + n)
            elif st == 'orchard': s.trees(*bb, ks, dx=3, dy=3, skip=lambda x, y: (x, y) not in cs, seed=seed + n)
            else: s.trees(*bb, ks, skip=lambda x, y: (x, y) not in cs, seed=seed + n)
    def garden(s, x0, y0, x1, y1, seed=12, every=4):
        """lawn left near paths: a bush, a young tree or a flower clump about every `every` tiles, kept off the walking line"""
        import random; r = random.Random(seed)
        pool = ['rg_bush_green', 'rg_bush_teal', 'rg_young_green0', 'rg_clump_green', 'rg_clump_green2', 'rg_tiny_pink', 'rg_tiny_white', 'rg_flower_pink', 'rg_flower_yellow', 'rg_rock_small', 'rg_bush_olive', 'rg_young_teal0']
        for (x, y) in sorted(s.openmask(x0, y0, x1, y1, 1)):
            if r.random() * every < 1:
                n = r.choice(pool); s.prop(n, x, y, walk=n.startswith(('rg_clump', 'rg_tiny', 'rg_flower')))
    def trees(s, x0, y0, x1, y1, kinds, dx=2, dy=1, skip=None, seed=3):
        """a mass of trees like the mockups' borders and woods: a staggered lattice (dx apart in a row, rows dy apart, every other row shifted by dx/2),
        canopies overlapping as in the mockups; a tree is planted only where its foot cell and the cell under it are open ground nothing else has claimed"""
        import random; r = random.Random(seed)
        for j, y in enumerate(range(y0, y1 + 1, dy)):
            for x in range(x0 + (j % 2) * (dx // 2), x1 + 1, dx):
                if skip and skip(x, y): continue
                if any(s.get(x, y + k) not in ('.', 'g', 'a', 'Z', None) or (x, y + k) in s.occ and s.occ[(x, y + k)] not in s.treeset for k in (0, 1)): continue
                if (x, y) in s.occ: continue
                n = r.choice(kinds)
                if any(c in s.occ and s.occ[c] not in s.treeset for c in s.box(n, x, y)): continue      # its canopy never covers a prop or a building
                if any(s.get(x + i, y + k) not in ('.', 'g', 'a', 'Z', None) for i in (-2, -1, 1, 2) for k in (0, 1)): continue   # a trunk keeps two tiles clear of a path beside it (its canopy stays off the path)
                if any(s.get(x + i, y + k) not in ('.', 'g', 'a', 'Z', None) for i in (-1, 0, 1) for k in (-2, -1)): continue        # nor a path just above it (the canopy would cover it)
                s.pp.append((s.char(n), x, y)); s.occ[(x, y)] = n; s.treeset.add(n)
                for c in s.box(n, x, y): s.occ.setdefault(c, n)
    def field(s, x0, y0, x1, y1, crop, every=2, soil='s'):
        """a worked field: tilled soil with a crop in rows every `every` tiles"""
        s.rect(x0, y0, x1, y1, soil)
        for y in range(y0, y1 + 1, every):
            for x in range(x0, x1 + 1, 1 if crop != 'rg_sunflowers' else 2): s.prop(crop, x, y, walk=True)
    def drift(s, x0, y0, x1, y1, kinds, every=5, seed=1):
        """a scatter of small flowers and tufts over open grass (walk-through decals), about one every `every` tiles"""
        import random; r = random.Random(seed)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if r.random() * every < 1 and s.get(x, y) in ('.', 'g') and (x, y) not in s.occ: s.prop(r.choice(kinds), x, y, walk=True)
    def pond(s, x, y, rx, ry):
        """a village pond (the generator's pond: shallow water with reeds and a sandy bank); its ground is claimed so nothing is planted in it"""
        s.deco.append(['pond', x, y, rx, ry])
        s.claim([(cx, cy) for cy in range(int(y - ry) - 2, int(y + ry) + 3) for cx in range(int(x - rx) - 2, int(x + rx) + 3)], 'pond')
    def plot(s, x, y, w, h, kind=0):
        """a tilled plot (0 cabbages) or a hay field (1) laid by the generator, claimed"""
        s.deco.append(['plot', x, y, w, h, kind]); s.claim([(cx, cy) for cy in range(y - 1, y + h + 1) for cx in range(x - 1, x + w + 1)], 'plot')
    def fence(s, name, x0, y0, x1, y1, step=1):
        for x in range(x0, x1 + 1, step):
            for y in range(y0, y1 + 1, step): s.prop(name, x, y)
    def exit(s, x, y, d, w=2):
        """a road leaving the town: (x, y) is its first cell (left or top of the w wide road) on the plan's edge, d the way out (N S E W); the generator joins the route road to it"""
        s.exits.append([x, y, d, w])
    def done(s, extra=None):
        for w in s.warn: print('  ' + s.code + ': ' + w)
        legend = {c: n for n, c in s.legend.items()}
        ex = dict(extra or {}); ex['exits'] = s.exits
        if s.deco: ex['deco'] = ex.get('deco', []) + s.deco
        return plan.build(s.code, s.text(), legend, extra=ex, blds=s.blds, pp=s.pp)
