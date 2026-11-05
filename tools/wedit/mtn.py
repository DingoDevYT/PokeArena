# Mountain dressing: turn a flat raised blob into terraced, forested rock (levels rise inward), and scatter props by level.
import numpy as np
from scipy import ndimage as ndi
rng = np.random.default_rng(7)

def coarse_noise(shape, cell, amp, seed):
    r = np.random.default_rng(seed); gh, gw = shape[0] // cell + 2, shape[1] // cell + 2
    g = r.uniform(-amp, amp, (gh, gw)); n = np.kron(g, np.ones((cell, cell)))[:shape[0], :shape[1]]
    return n

def clean(mask, it=1):
    st = np.ones((3, 3), bool)
    for _ in range(it): mask = ndi.binary_closing(ndi.binary_opening(mask, st), st)
    # no 1-wide necks or notches: also open/close with 2x2
    s2 = np.ones((2, 2), bool); mask = ndi.binary_closing(ndi.binary_opening(mask, s2), s2)
    return mask

def terraces(foot, base, steps, seed=1, cell=3, amp=2.5):
    """foot: bool mask of the mountain; base: level of the rim. steps: inward distances for each extra level. Returns int heights (0 outside)."""
    d = ndi.distance_transform_edt(foot)
    dn = d + coarse_noise(foot.shape, cell, amp, seed) + coarse_noise(foot.shape, cell * 2 + 1, amp, seed + 1)
    H = np.where(foot, base, 0).astype(int); prev = foot.copy()
    for k, s in enumerate(steps):
        m = clean(dn >= s) & ndi.binary_erosion(prev, np.ones((5, 5), bool))   # each terrace at least 2 tiles inside the one below
        m = clean(m)
        m &= ndi.binary_erosion(prev, np.ones((5, 5), bool))
        if m.sum() < 9: break
        H[m] = base + k + 1; prev = m
    return H

def poisson(mask, rmin, tries=30, seed=3, cap=100000):
    """blue noise points (tile units, float) inside mask with min spacing rmin"""
    r = np.random.default_rng(seed); ys, xs = np.nonzero(mask)
    if not len(ys): return []
    order = r.permutation(len(ys)); pts = []; grid = {}
    cs = rmin / 1.4142
    for i in order[:cap]:
        y, x = ys[i] + r.uniform(0.15, 0.85), xs[i] + r.uniform(0.15, 0.85)
        gx, gy = int(x / cs), int(y / cs); ok = True
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                q = grid.get((gx + dx, gy + dy))
                if q and (q[0] - x) ** 2 + (q[1] - y) ** 2 < rmin * rmin: ok = False; break
            if not ok: break
        if ok: grid[(gx, gy)] = (x, y); pts.append((x, y))
    return pts
