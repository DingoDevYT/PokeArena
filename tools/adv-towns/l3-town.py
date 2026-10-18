"""Pokemon League, drawn by hand with the town kit (docs/REGION-REBUILD.md sections 15 and 17). Run: python3 -I tools/adv-towns/l3-town.py
then python3 -I tools/adv-towns/preview.py L3 out.png to see it with the real art. (tools/adv-towns/landmarks.py still holds the old plan and would overwrite L3.json if run.)

The story of the place: the castle on the north cape, where every trainer who has won eight badges ends the road. Snow lies on the whole cape. The castle (its one
building, the gate hall; the sea is behind it) stands at the head of a long grand approach: the road from Route 18 comes in from the south-east, turns at the gate
forecourt, where two towers stand guard, and the grand avenue runs straight north between double rows of torch posts, clipped hedges and sleeping snow gardens to the
League Plaza, a cobbled round with a fountain, stone dogs and four corner towers, and on past it into the castle's own courtyard before the gate. Footpaths wander out
of the plaza's sides: west through the snow-pine wood to a frozen pond and the standing stones on the north-west beach, east along the cape to the lantern terrace that
looks out over the sea. Snow pines wall the cape in except where the road leaves.
Exit: south (18, 26) the road from Route 18."""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kit

LIM = 28
g = kit.Town(LIM - 2, 'L3')
N = LIM - 2
MASK = [
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -26
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -25
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -24
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -23
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -22
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -21
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -20
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -19
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -18
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -17
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -16
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -15
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -14
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -13
    'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -12
    'wwwwwwaaaaaaaaaa..wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -11
    'wwwwwwaaaaaaaaaa....wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -10
    'wwwwwwaaaaaaa.........wwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -9
    'wwwwwwaaaaa..............wwwwwwwwwwwwwwwwwwwwwwwwwwww',  # -8
    'aaaaaaa.......................wwwwwwwwwwwwwwwwwwwwwww',  # -7
    'aaaaa.............................wwwwwwwwwwwwwwwwwww',  # -6
    'aaaa.................................wwwwwwwwwwwwwwww',  # -5
    'aaa....................................wwwwwwwwwwwwww',  # -4
    'aa.......................................wwwwwwwwwwww',  # -3
    'aa........................................wwwwwwwwwww',  # -2
    'a...........................................wwwwwwwww',  # -1
    'a............................................wwwwwwww',  # 0
    '...............................................w...ww',  # 1
    '...................................................ww',  # 2
    '...................................................ww',  # 3
    '...................................................ww',  # 4
    '...................................................ww',  # 5
    '.....................................................',  # 6
    '.....................................................',  # 7
    'Z....................................................',  # 8
    'ZZZ..................................................',  # 9
    'ZZZZ.................................................',  # 10
    'ZZZZZ................................................',  # 11
    'ZZZZZZ...............................................',  # 12
    'ZZZZZZZ..............................................',  # 13
    'ZZZZZZZZ.............................................',  # 14
    'ZZZZZZZZZ............................................',  # 15
    'ZZZZZZZZZ............................................',  # 16
    'ZZZZZZZZZZ...........................................',  # 17
    'ZZZZZZZZZZZ..........................................',  # 18
    'ZZZZZZZZZZZ..........................................',  # 19
    'ZZZZZZZZZZZZ.........................................',  # 20
    'ZZZZZZZZZZZZZ........................................',  # 21
    'ZZZZZZZZZZZZZZ.......................................',  # 22
    'ZZZZZZZZZZZZZZ.......................................',  # 23
    'ZZZZZZZZZZZZZZZ......................................',  # 24
    'ZZZZZZZZZZZZZZZZ.....................................',  # 25
    'ZZZZZZZZZZZZZZZZZZ...................................',  # 26
]

def land(x, y): return -N <= x <= N and -N <= y <= N and MASK[y + N][x + N] != 'w'
def beach(x, y): return -N <= x <= N and -N <= y <= N and MASK[y + N][x + N] == 'a'
def wet(x, y, m=1): return any(not land(x + i, y + j) for i in range(-m, m + 1) for j in range(-m, m + 1))
CASTLE = set(g.box('castle', 0, -2, bld=True))                                              # the castle's sprite reaches a little over the sea behind it
g.claim([(x, y) for y in range(-N, N + 1) for x in range(-N, N + 1) if not land(x, y) and (x, y) not in CASTLE], 'sea')

SNOWT = ['rg_pine_green_snow0', 'rg_tall_green_snow0', 'rg_round_teal_snow0', 'rg_pine_teal_snow1', 'rg_tall_teal_snow0', 'rg_round_green_snow1', 'rg_fir_green_snow0', 'rg_fir_teal_snow1', 'snowPineLarge', 'snowDomeTree', 'rg_pine_green_snow1', 'rg_tall_olive_snow0']
SLIM = ['rg_slim_green_snow', 'rg_slim_teal_snow', 'rg_cone_green_snow', 'rg_cone_teal_snow', 'rg_young_green_snow0', 'rg_young_teal_snow0']
SMALL = ['rg_snow_lump', 'rg_snow_lump2', 'rg_snowpile', 'rg_ice_pebble', 'rg_ice_pebble2', 'rg_ice_pebble3', 'snowBall', 'rg_bush_green_snow', 'rg_bush_teal_snow', 'rg_ice_stone', 'rg_leaves_tiny']
ROCKS = ['rg_ice_boulder', 'rg_ice_boulder2', 'rg_ice_rock', 'rg_ice_rock2', 'rg_boulder_grey', 'rg_rock_grey', 'rockSnowCap']
def st(x0, y0, x1, y1, ch='p'): g.rect(x0, y0, x1, y1, ch)
def scatter(kinds, x0, y0, x1, y1, n, mind=3, seed=1, tries=800, walk=False):
    r = random.Random(seed); got = []
    for _ in range(tries):
        if len(got) >= n: break
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        if (x, y) in g.occ or not land(x, y) or wet(x, y, 1) or any(abs(x - a) < mind and abs(y - b) < mind for a, b in got): continue
        if g.prop(r.choice(kinds), x, y, walk=walk): got.append((x, y))
    return got
def blob(cx, cy, rx, ry, ch):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1 and land(x, y): g.put(x, y, ch)

# ================================================================ the road, the grand avenue, the plaza and the castle court
g.lane([(18, 26), (18, 24), (5, 24)], 2, 'p')                                              # the road from Route 18 (exit)
g.exit(18, 26, 'S')
blob(0, 2, 10, 4, 'p'); blob(0, 2, 8, 3, 't')                                               # the castle's courtyard before the gate
blob(0, 12, 10, 5, 'p'); blob(0, 12, 8, 3, 't')                                             # the League Plaza: a stone round with a tan heart
st(-2, 5, 2, 8, 't')                                                                        # the court and the plaza meet
st(-1, 17, 1, 22, 'p'); st(-3, 17, -2, 22, 't'); st(2, 17, 3, 22, 't')                      # the grand avenue, 3 wide, with a tan walk each side
st(-5, 23, 4, 25, 't')                                                                      # the gate forecourt, where the road comes in
g.building('castle', 0, -2, 'house')

# ================================================================ the castle court: guard dogs, torches, banners of snow beds
g.props('statueDog', [(-3, -1), (3, -1)], walk=True)
g.props('torchPost', [(-5, 0), (5, 0), (-8, 2), (8, 2), (-6, 5), (6, 5), (-2, 6), (2, 6)], walk=True)
g.props('rg_planter_snow', [(-7, -1), (7, -1), (-9, 3), (9, 3), (-4, 3), (4, 3)], walk=True); g.props('rg_pot_snow', [(-1, -1), (1, -1), (-5, 1), (5, 1)], walk=True)
g.props('rg_column', [(-12, 0), (12, 1), (-10, -1), (10, -1)])
g.props('rg_bench', [(-6, 3), (6, 3)], walk=True)

# ================================================================ the League Plaza
g.prop('maFountain', 0, 13, walk=True)
g.props('statueDog', [(-4, 9), (4, 9), (-4, 16), (4, 16)], walk=True)
g.props('torchPost', [(-8, 10), (8, 10), (-8, 15), (8, 15), (-2, 8), (2, 8), (-3, 17), (3, 17), (-6, 12), (6, 12)], walk=True)
g.props('rg_bench', [(-7, 13), (7, 13), (-5, 17), (5, 17)], walk=True); g.props('rg_planter_snow', [(-6, 9), (6, 9), (-6, 16), (6, 16), (-9, 12), (9, 12)], walk=True)
g.props('rg_column', [(-11, 8), (11, 8), (-11, 17), (11, 17)])

# ================================================================ the grand avenue: torches, snow beds, hedges, guard towers at the foot
g.props('torchPost', [(-4, y) for y in range(18, 23, 2)] + [(4, y) for y in range(18, 23, 2)], walk=True)
g.props('statueDog', [(-3, 19), (3, 19)], walk=True)
g.props('rg_column', [(-2, 23), (2, 23)], walk=True)
g.props('rg_planter_snow', [(-5, y) for y in (19, 21)] + [(5, y) for y in (19, 21)], walk=True)
g.props('torchPost', [(-5, 24), (4, 24)], walk=True); g.prop('rg_sign_board', 3, 23, walk=True)

# ================================================================ formal snow gardens on both sides of the avenue: stone hedges, topiary, beds, bare young trees
for sx in (-1, 1):
    for y in range(18, 23, 1): g.prop('mHedgeTallStone', 7 * sx, y)
    for x in (6, 7, 8, 9, 10): g.prop('mHedgeLongStone', sx * x if sx > 0 else -x, 17) if False else None
    for i, y in enumerate((19, 21)): g.prop(('mPineStone', 'mFirStone', 'mBushStone')[i % 3], 6 * sx, y)
    g.props('rg_pot_snow', [(5 * sx, 20), (5 * sx, 22)], walk=True)
    scatter(['rg_bare_green_snow0', 'rg_bare_teal_snow1', 'rg_young_green_snow0', 'rg_young_teal_snow0'], 8 * sx - 2, 18, 8 * sx + 3, 23, 3, mind=2, seed=5 + sx)

# ================================================================ the west: snow pines, the frozen pond, a path out to the standing stones on the beach
st(-14, 12, -11, 12, 't') if False else None
g.lane([(-11, 12), (-15, 12), (-15, -8)], 1, 't')                                           # out of the plaza's west side and north to the beach
blob(-17, -9, 3, 1, 'a')                                                                    # a sand court at the path's end
for x, y in ((-19, -9), (-15, -11), (-17, -11), (-13, -9), (-19, -7)): g.prop('standingStoneMintTall' if (x + y) % 2 else 'standingStoneMint', x, y)
g.props('rg_lantern', [(-16, -8), (-14, -8)], walk=True); g.prop('rg_arch_white', -15, -6, walk=True)
g.pond(-24, 20, 3, 2)                                                                       # the frozen pond lies where the site is snow already, so its ground is left as it is
POND = (-29, 16, -19, 24)
g.props('rg_bench', [(-20, 18), (-26, 18)], walk=True)
g.lane([(-15, 12), (-15, 24), (-6, 24)], 1, 't'); g.lane([(-15, 18), (-18, 18)], 1, 't'); g.props('rg_lantern', [(-14, 16), (-16, 17), (-14, 21), (-12, 23)], walk=True); g.prop('rg_arch_white', -15, 14, walk=True)

# ================================================================ the east: the lantern terrace over the sea, a path along the cape
g.lane([(11, 12), (15, 12), (15, 1)], 1, 't'); g.lane([(15, 12), (15, 23)], 1, 't'); g.props('rg_lantern', [(14, 7), (16, 5), (14, 17), (16, 20)], walk=True); g.prop('rg_arch_white', 15, 14, walk=True)
st(10, -1, 18, 1, 't') if False else None
blob(14, 0, 3, 2, 't'); g.props('rg_lantern', [(11, 0), (17, 1), (13, 2)], walk=True); g.props('rg_bench', [(13, -1), (16, 0)], walk=True); g.prop('rg_arch_white', 15, 3, walk=True)
g.props('rg_bench', [(17, 17), (22, 17)], walk=True); g.prop('rg_fountain2', 19, 14, walk=True); g.props('rg_planter_snow', [(17, 14), (21, 14), (19, 12)], walk=True)

# ================================================================ parterres by the castle court: stone hedge borders round snow beds, a pot or a spire in the middle
def parterre(x0, y0, x1, y1, centre='rg_basin', gap=None):
    """a clipped garden: a ring of low stone hedges (a gap on the south side), snow beds inside, a basin in the middle"""
    for x in range(x0, x1, 2):
        g.prop('mHedgeLongStone', x + 1, y0)
        if not (gap and gap[0] <= x <= gap[1]): g.prop('mHedgeLongStone', x + 1, y1)
    for y in range(y0 + 1, y1, 2):
        g.prop('mHedgeTallStone', x0, y + 1); g.prop('mHedgeTallStone', x1, y + 1)
    cx_, cy_ = (x0 + x1) // 2, (y0 + y1) // 2
    g.prop(centre, cx_, cy_, walk=True)
    for x in range(x0 + 2, x1 - 1, 2):
        for y in range(y0 + 2, y1 - 1, 2):
            if (x, y) != (cx_, cy_) and abs(x - cx_) + abs(y - cy_) > 1: g.prop(('rg_pot_snow', 'rg_bush_green_snow', 'rg_planter_snow', 'rg_bush_teal_snow')[(x + y) % 4], x, y, walk=True)
parterre(-12, -7, -6, -2, gap=(-9, -8)); parterre(6, -7, 12, -3, gap=(9, 10))
g.props('rg_planter_snow', [(-9, -1), (9, -1)], walk=True)
for sx in (-1, 1): g.props('rg_ice_spike', [(sx * 5, -3)], walk=True)

# ================================================================ the north-west beach: shells, sea stones, driftwood
scatter(['rg_shells', 'rg_sea_stone', 'rg_sea_pebble', 'shell', 'rg_seaweed', 'frozenLog'], -26, -11, -9, -3, 14, mind=2, seed=3)

# ================================================================ the east field: an ice garden of boulders and spikes, a bench by the path
g.props('rg_ice_boulder', [(18, 6), (21, 9)]); g.props('rg_ice_boulder2', [(20, 4)]); g.props('rg_ice_tall', [(17, 8), (22, 7), (19, 10)]); g.props('rg_ice_spike', [(16, 4), (23, 10), (18, 12)])
g.props('rg_bench', [(17, 2)], walk=True); g.props('rg_lantern', [(16, 8)], walk=True)

# ================================================================ snow pines in masses (the cape is wooded round the roads), the clearings kept for beds and rocks
g.trees(-26, -9, -17, 26, SNOWT, seed=1); g.trees(18, 1, 26, 26, SNOWT, seed=3); g.trees(-26, 22, 26, 26, SNOWT, seed=4)       # the belts: canopies overlapping, as in the mockups
g.trees(-26, -9, 26, 26, SNOWT, dx=2, dy=2, seed=2); g.trees(-25, -8, 25, 26, SNOWT, dx=2, dy=2, seed=9)
scatter(ROCKS, -26, -9, 26, 26, 22, mind=4, seed=7); scatter(['rg_snowpile', 'rg_snow_lump', 'rg_ice_tall', 'rg_ice_spike'], -26, -9, 26, 26, 20, mind=3, seed=8)
scatter(['mPineStone', 'mFirStone', 'mBushStone', 'mFirStone'], -14, 5, 14, 11, 8, mind=3, seed=11)                        # clipped topiary round the plaza's waist
scatter(['rg_bare_green_snow0', 'rg_bare_teal_snow1', 'rg_bare_olive_snow0', 'rg_bare_orange_snow1'], -26, -9, 26, 26, 18, mind=4, seed=12)
scatter(SLIM + SNOWT[:6], -26, -9, 26, 26, 90, mind=2, seed=13, tries=2000)
g.trees(-26, 22, -17, 26, SNOWT, seed=6)
g.dress(trees=SLIM, bushes=['rg_bush_green_snow', 'rg_bush_teal_snow'], pots=['rg_pot_snow'])
g.groves(-26, -26, 26, 26, SNOWT, gap=1, min_area=4, styles=[('woods', SNOWT), ('orchard', SNOWT), ('woods', SNOWT)])
g.drift(-26, -26, 26, 26, SMALL, every=4)

# ---- snow lies on the whole cape (laid last so the planting helpers, which work on open ground, have seen it all); the beach stays sand, the pond keeps the site's own snow
for y in range(-N, N + 1):
    for x in range(-N, N + 1):
        if land(x, y) and not beach(x, y) and g.get(x, y) == '.' and not (POND[0] <= x <= POND[2] and POND[1] <= y <= POND[3]): g.put(x, y, 'Z')

g.done(dict(lim=LIM, hide_site_paths=True))
