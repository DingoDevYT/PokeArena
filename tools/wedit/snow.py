# Northern snowfields (Routes 15-21, the massif round Frostfall): groves of snowy conifers, boulder fields on the bare grey rock, ice rocks along cliff tops.
# Props only go where the ground is wide open (2.5+ tiles from any cliff, water, road, stair, other ground), so no pass or road gets blocked.
import os, sys, json, re; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, wedit, mtn
from scipy import ndimage as ndi
X0, Y0, X1, Y1 = 290, 150, 740, 425
R = wedit.Region(X0, Y0, X1, Y1); m, h, kind = R.mat, R.h, R.kind
H, Wd = m.shape; ys, xs = np.mgrid[0:H, 0:Wd]; TX, TY = xs + R.x0, ys + R.y0
s = open(wedit.ROOT + 'data/adv/world.js', encoding='utf8').read(); W = json.loads(s[s.index('{'):s.rindex('}') + 1])
SNOW, ASH = 11, 10
ROADS = (2, 13, 15, 19, 20, 21)
road = np.isin(m, ROADS) | (kind > 0)
water = np.isin(m, (5, 6, 7, 8, 22))
town = np.zeros_like(road)
for code, t in W['towns'].items():
    cx, cy = (t.get('center') or t)['x'] / 32, (t.get('center') or t)['y'] / 32
    town |= np.hypot(TX - cx, TY - cy) < (34 if code[0] in 'GTL' else 26)
for b in W['buildings']:
    town[max(0, b['fy'] - R.y0 - 2):b['fy'] + b['d'] - R.y0 + 2, max(0, b['fx'] - R.x0 - 2):b['fx'] + b['w'] - R.x0 + 2] = True
ground = np.isin(m, (SNOW, ASH))
# boundary: any change of height or ground kind with a 4-neighbour, plus roads, water and the region edge
chg = np.zeros_like(road)
for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    hs, ms = np.roll(np.roll(h, dy, 0), dx, 1), np.roll(np.roll(m, dy, 0), dx, 1)
    chg |= (hs != h) | ((ms == SNOW) != (m == SNOW)) & ~((ms == ASH) & (m == SNOW) | (ms == SNOW) & (m == ASH))
chg |= road | water | ~ground
chg[0, :] = chg[-1, :] = chg[:, 0] = chg[:, -1] = True
dist = ndi.distance_transform_edt(~chg)
hidden = np.zeros_like(road)
for k in (1, 2, 3, 4, 5): hidden |= np.roll(h, -k, 0) > h + k - 1
# existing props: keep 1.5 tiles clear of them
occ = np.zeros_like(road)
for p in R.props:
    iy, ix = p[2] // 32 - R.y0, p[1] // 32 - R.x0
    if 0 <= iy < H and 0 <= ix < Wd: occ[max(0, iy - 1):iy + 2, max(0, ix - 1):ix + 2] = True
# keep clear of roads, stairs and bridges (3 tiles) and of the people who stand out here (2 tiles)
keepout = road.copy()
import subprocess; NPCPOS = json.loads(subprocess.check_output(['node', '-e', "globalThis.window=globalThis; require('vm').runInThisContext(require('fs').readFileSync(process.argv[1],'utf8')); console.log(JSON.stringify(window.ADV_NPCS.map(n => [n.x, n.y])))", wedit.ROOT + 'data/adv/npcs.js']))
for nx, ny in NPCPOS:
    iy, ix = int(ny) - R.y0, int(nx) - R.x0
    if 0 <= iy < H and 0 <= ix < Wd: keepout[max(0, iy - 1):iy + 2, max(0, ix - 1):ix + 2] = True
dr = ndi.distance_transform_edt(~keepout)
free = ground & ~town & ~hidden & ~occ & (dr >= 3)
open_ = free & (dist >= 2.5)
edge_top = free & (dist >= 1) & (dist < 2.5)
n = mtn_noise = None
def smooth_noise(sigma, seed):
    r = np.random.default_rng(seed); z = ndi.gaussian_filter(r.standard_normal((H, Wd)), sigma); return z / (z.std() + 1e-9)
n = smooth_noise(7, 21); n2 = smooth_noise(3, 22)
rng = np.random.default_rng(5); added = []
add = lambda nm, x, y: added.append([nm, int((x + R.x0) * 32), int((y + R.y0) * 32)])
TREES = ['rg_pine_teal_snow0', 'rg_pine_teal_snow1', 'rg_fir_green_snow0', 'rg_fir_green_snow1', 'rg_pine_green_snow0', 'rg_pine_green_snow1', 'rg_fir_teal_snow0', 'rg_fir_teal_snow1', 'rg_fir_olive_snow0', 'rg_pine_olive_snow1']
SMALL = ['rg_snow_lump', 'rg_snow_lump2', 'rg_snowpile', 'rg_ice_pebble', 'rg_ice_pebble2', 'rg_bush_teal_snow', 'rg_bush_green_snow', 'rg_stump_teal_snow', 'frozenLog']
ROCK = ['rg_ice_boulder', 'rg_ice_boulder2', 'rg_ice_boulder3', 'rockSnowCap', 'rg_ice_rock', 'rg_ice_stone']
GREY = ['bigRockGrey', 'boulderGrey', 'rockGrey', 'rockGreyB', 'rockGreyPair', 'stonesPair', 'rg_rock_grey', 'rg_boulder_grey', 'pebbles']
snow_open, ash_open = open_ & (m == SNOW), open_ & (m == ASH)
for x, y in mtn.poisson(snow_open & (n > 0.85), 1.8, seed=1):
    if rng.random() < 0.85: add(rng.choice(TREES), x, y)
for x, y in mtn.poisson(snow_open & (n > 0.25) & (n <= 0.85), 3.6, seed=2):
    r = rng.random(); add(rng.choice(TREES) if r < 0.55 else rng.choice(SMALL), x, y) if r < 0.75 else None
for x, y in mtn.poisson(snow_open & (n <= 0.25), 7.5, seed=3):
    r = rng.random(); add(rng.choice(SMALL + ROCK) if r < 0.6 else rng.choice(TREES), x, y) if r < 0.5 else None
for x, y in mtn.poisson(ash_open, 2.6, seed=4):
    if rng.random() < 0.6: add(rng.choice(GREY), x, y)
for x, y in mtn.poisson(edge_top, 2.3, seed=6):
    r = rng.random(); sn = m[int(y), int(x)] == SNOW
    if (n2[int(y), int(x)] > -0.2 and r < 0.7) or r < 0.25: add((rng.choice(TREES) if rng.random() < 0.6 else rng.choice(ROCK + SMALL[:4])) if sn else rng.choice(GREY), x, y)
print('props before', len(R.props), 'added', len(added), 'open tiles', int(open_.sum()))
R.props.extend(added)
if '--save' in sys.argv: R.save()
