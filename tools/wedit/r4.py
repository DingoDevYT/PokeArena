# Route 4 mountain: the flat grey blob over the Tradeway cave becomes a terraced, wooded mountain with a rocky crown; a spur reaches the east cave mouth.
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, wedit, mtn
from scipy import ndimage as ndi
R = wedit.Region(396, 572, 484, 648); h, mat, over, kind = R.h, R.mat, R.over, R.kind
Y, X = np.mgrid[0:h.shape[0], 0:h.shape[1]]; TX, TY = X + R.x0, Y + R.y0
lab, n = ndi.label(h >= 3); foot = lab == lab[R.t(430, 610)]
# east spur to the east cave mouth (door at tile 471.5, 608.9): the cliff foot runs along row 607 there, so the mouth stands against the face
spur = np.zeros_like(foot)
spur |= (TX >= 452) & (TX <= 466) & (TY >= 597) & (TY <= 611)
spur |= (TX >= 462) & (TX <= 476) & (TY >= 600) & (TY <= 607)
spur |= (TX >= 466) & (TX <= 474) & (TY >= 598) & (TY <= 600)
spur &= ~((TX >= 469) & (TX <= 475) & (TY >= 607))   # keep the mouth and its step clear
foot = mtn.clean(foot | spur)
foot &= ~((TX >= 468) & (TX <= 475) & (TY >= 608))
H = mtn.terraces(foot, 3, [5, 10, 16], seed=11)
h[foot] = H[foot]; kind[foot] = 0; over[foot] = 0
GRASS, DRY, ASH = 1, 14, 10
lv = np.where(foot, H - 3, -1)
mat[lv == 0] = GRASS; mat[lv == 1] = GRASS
mat[lv == 2] = GRASS
crown = ndi.binary_dilation(lv >= 3, np.ones((3, 3), bool)) & (lv >= 2)
mat[crown] = ASH
# props: clear the old ones inside the footprint (keep the cave mouth and torches), then scatter by level
def tile_of(p): return int(p[2] // 32), int(p[1] // 32)
keep = []
for p in R.props:
    ty, tx = tile_of(p)
    iy, ix = ty - R.y0, tx - R.x0
    if 0 <= iy < h.shape[0] and 0 <= ix < h.shape[1] and foot[iy, ix] and p[0] not in ('maCaveBrown', 'torchPost'): continue
    keep.append(p)
R.props[:] = keep
# where a prop may stand: not on a terrace edge (a lower neighbour) and not in the strip a higher terrace to the south hides
lower = np.zeros_like(foot)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1): lower |= np.roll(np.roll(h, dy, 0), dx, 1) < h
hidden = np.zeros_like(foot)
for k in (1, 2, 3, 4): hidden |= np.roll(h, -k, 0) > h + k - 1
okp = foot & ~lower & ~hidden
nearedge = foot & ~hidden & ndi.binary_dilation(lower, np.ones((5, 5), bool)) & ~lower
rng = np.random.default_rng(42)
TREES_LO = ['rg_pine_green0', 'rg_pine_teal0', 'rg_pine_green1', 'rg_tall_green0', 'rg_tall_teal0', 'pineTreeDark', 'rg_round_green0', 'rg_pine_teal1']
TREES_HI = ['rg_pine_green0', 'rg_pine_teal0', 'pineTreeDark', 'rg_pine_olive0', 'spruceTreeDark']
ROCKS = ['rockGrey', 'rockGreyB', 'stonesPair', 'rockGreyPair', 'boulderGrey', 'rg_rock_small', 'rg_rock_grey', 'pebbles']
BIG = ['bigRockGrey', 'boulderGrey', 'rg_boulder', 'rg_rock_tall', 'rg_rock_grassy', 'jRocks']
add = lambda name, x, y: R.props.append([name, int((x + R.x0) * 32), int((y + R.y0) * 32)])
for x, y in mtn.poisson(okp & (lv <= 1), 1.9, seed=1):
    if rng.random() < 0.82: add(rng.choice(TREES_LO), x, y)
for x, y in mtn.poisson(okp & (lv == 2), 2.8, seed=2):
    r = rng.random(); add(rng.choice(TREES_HI) if r < 0.5 else rng.choice(ROCKS + BIG) if r < 0.85 else 'dryTuft', x, y)
for x, y in mtn.poisson(okp & (lv >= 3), 2.4, seed=3):
    r = rng.random(); add(rng.choice(BIG) if r < 0.4 else rng.choice(ROCKS) if r < 0.85 else 'crystalBlueTall', x, y)
for x, y in mtn.poisson(nearedge & (lv <= 1), 4.5, seed=4):
    if rng.random() < 0.5: add(rng.choice(ROCKS + ['bush', 'fern']), x, y)
# a cairn on the crown
top = np.argwhere(lv == lv.max()); cy, cx = top.mean(0); add('rg_cairn', cx + 0.5, cy + 0.5)
print('levels', [(k, int((lv == k).sum())) for k in range(4)], 'props', len(R.props))
for y in range(0, h.shape[0], 1):
    row = ''.join('.' if not foot[y, x] else str(h[y, x]) for x in range(8, 100))
    if foot[y].any(): print('%3d %s' % (y + R.y0, row))
if '--save' in sys.argv: R.save()
