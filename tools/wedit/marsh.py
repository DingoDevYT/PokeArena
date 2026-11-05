# Route 8 wet meadow: the stream that stopped dead in the grass now ends in a reedy pond, and the mud around it is a soft-edged marsh with reeds and willows.
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, wedit, mtn
from scipy import ndimage as ndi
GRASS, WATER, DEEP, SWAMP, WET, PATH = 1, 5, 6, 12, 18, 2
def smooth_noise(shape, sigma, seed):
    r = np.random.default_rng(seed); n = ndi.gaussian_filter(r.standard_normal(shape), sigma); return n / (n.std() + 1e-9)
def marsh(R, box, pond=None, seed=1, band=2.2, roadmats=(2, 13, 19, 20, 21)):
    """box: tile rect (x0, y0, x1, y1) to rework. pond: (cx, cy, rx, ry) tiles: an oval of water added there."""
    m, h, kind = R.mat, R.h, R.kind
    ys, xs = np.mgrid[0:m.shape[0], 0:m.shape[1]]; TX, TY = xs + R.x0, ys + R.y0
    B = (TX >= box[0]) & (TX < box[2]) & (TY >= box[1]) & (TY < box[3]) & (h == 0) & (kind == 0)
    m[B & (m == SWAMP)] = GRASS
    if pond:
        cx, cy, rx, ry = pond; e = ((TX + 0.5 - cx) / rx) ** 2 + ((TY + 0.5 - cy) / ry) ** 2 + 0.25 * smooth_noise(m.shape, 1.5, seed + 9)
        road = np.isin(m, roadmats); near_road = ndi.binary_dilation(road, np.ones((3, 3), bool)); m[B & (e <= 1) & ~near_road] = WATER; m[B & (e <= 0.35) & ~near_road] = DEEP
    water = np.isin(m, (WATER, DEEP))
    d = ndi.distance_transform_edt(~water)
    sw = B & ~water & ~np.isin(m, roadmats) & (d <= band + 1.0 * smooth_noise(m.shape, 2.0, seed))
    sw = ndi.binary_opening(sw, np.ones((2, 2), bool)) & B
    m[sw] = SWAMP
    # props: clear the swamp and pond tiles of trees, then reeds on the waterline, willows and logs in the marsh
    def tile(p): return int(p[2] // 32) - R.y0, int(p[1] // 32) - R.x0
    keep = []
    for p in R.props:
        iy, ix = tile(p)
        if 0 <= iy < m.shape[0] and 0 <= ix < m.shape[1] and B[iy, ix] and (water[iy, ix] or (sw[iy, ix] and p[0] not in ('reeds', 'reedsPair', 'reedsOlive'))): continue
        keep.append(p)
    R.props[:] = keep
    rng = np.random.default_rng(seed); add = lambda n, x, y: R.props.append([n, int((x + R.x0) * 32), int((y + R.y0) * 32)])
    shore = B & ~water & (d <= 1.0)
    for x, y in mtn.poisson(shore, 1.4, seed=seed + 1):
        if rng.random() < 0.55: add(rng.choice(['reeds', 'reedsPair', 'reedsOlive', 'reedsPair']), x, y)
    inner = sw & (d >= 1.5)
    for x, y in mtn.poisson(inner, 3.0, seed=seed + 2):
        r = rng.random(); add('bigOakVines' if r < 0.22 else 'fallenLog' if r < 0.32 else 'mushroomStump' if r < 0.4 else rng.choice(['reedsOlive', 'leafPlantDark', 'fern', 'reeds']), x, y)
    return sw.sum(), water[B].sum()
if __name__ == '__main__':
    R = wedit.Region(225, 630, 290, 680)
    print(marsh(R, (225, 634, 250, 660), pond=(237.0, 650.2, 5.0, 3.0), seed=5, band=1.5))
    m = R.mat
    for y in range(630 - R.y0, 662 - R.y0): print('%3d ' % (y + R.y0) + ''.join({1: '.', 2: '=', 5: '~', 6: 'W', 12: 'm', 18: ','}.get(int(m[y, x]), '?') for x in range(225 - R.x0, 260 - R.x0)))
    if '--save' in sys.argv: R.save()
