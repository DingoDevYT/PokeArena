"""Plan B (docs/REGION-REBUILD.md): the island at K = 0.6 of its old size with every town kept at its true size.
G maps a new tile position to the old one it shows (the generator samples the owner's maps through it); F is the inverse, for hand-set points.
Inside a town's rigid disc G is a pure shift, so a town and its hand layout move as one block; between towns G is p / K plus a smooth harmonic
correction, so the routes shrink (most right beside a town, where the ring has to make room for it)."""
import numpy as np
from scipy import ndimage as ndi
from scipy.sparse import coo_matrix, diags
from scipy.sparse.linalg import spsolve
from scipy.spatial import cKDTree

class Warp:
    def __init__(self, anchors, W0, H0, K=.6, gap=18, step=4, pad=4, cap=4.0, relax=0, mode='harmonic', ring=1.2):
        """anchors: [(code, old x, old y, radius)] in old tiles; the rigid disc is radius + pad; neighbouring discs keep `gap` tiles of route between them"""
        self.K, self.step = K, step
        c = np.array([(x, y) for _, x, y, _ in anchors], float); r = np.array([R + pad for *_, R in anchors], float)
        t = K * c
        for _ in range(400):                                  # push discs apart until every pair has its gap (symmetric, small steps)
            moved = 0
            for i in range(len(c)):
                for j in range(i + 1, len(c)):
                    d = t[j] - t[i]; n = np.hypot(*d); need = r[i] + r[j] + gap
                    if n < need: s = (need - n) / 2 * 1.02 * d / n; t[i] -= s; t[j] += s; moved = 1
            if not moved: break
        t = c + np.round(t - c)                               # whole-tile shifts: a town's tiles land on tiles
        self.codes = [a[0] for a in anchors]; self.c, self.t, self.r = c, t, r
        self.W1, self.H1 = int(np.ceil(W0 * K)), int(np.ceil(H0 * K))
        self.mode = mode
        if mode == 'radial':
            # G(q) = q / K + sum_i w_i(q) * d_i(q): d_i makes G a pure shift onto the old town inside disc i, w_i is 1 there and falls linearly to 0 across a ring of
            # width M_i (ring x the radius, cut short where a neighbour's disc begins), so the squeeze outside a town is spread evenly over the ring instead of piling up at its edge
            n = len(c); self.M = np.zeros(n)
            for i in range(n):
                lim = min([np.hypot(*(t[j] - t[i])) - r[i] - r[j] for j in range(n) if j != i] or [1e9])
                self.M[i] = max(4.0, min(ring * r[i], lim))
            self.W1, self.H1 = int(np.ceil(W0 * K)), int(np.ceil(H0 * K))
            Y, X = np.mgrid[0:self.H1, 0:self.W1] + .5; gx_, gy_ = self.G(X, Y)
            self.sv = self._svdense(gx_, gy_); self.minsv, self.maxsv = float(self.sv[0].min()), float(self.sv[1].max())
            self._tree = cKDTree(np.c_[gx_.ravel(), gy_.ravel()]); self._q = np.c_[X.ravel(), Y.ravel()]
            return
        # u = G(q) - q / K on a coarse grid over the NEW map: harmonic between the discs, fixed inside them (natural boundary at the map edge)
        gw, gh = self.W1 // step + 2, self.H1 // step + 2; self.gw, self.gh = gw, gh
        gy, gx = np.mgrid[0:gh, 0:gw] * step
        fix = np.full((gh, gw), -1); ux = np.zeros((gh, gw)); uy = np.zeros((gh, gw))
        for i in range(len(c)):
            m = np.hypot(gx - t[i, 0], gy - t[i, 1]) <= r[i] + step; fix[m] = i
            ux[m] = gx[m] - t[i, 0] + c[i, 0] - gx[m] / K; uy[m] = gy[m] - t[i, 1] + c[i, 1] - gy[m] / K
        self.fix, self.bx, self.by = fix, ux, uy; self.wx = np.ones((gh, gw - 1)); self.wy = np.ones((gh - 1, gw))
        self._solve(); self.sv = self._sv()
        for it in range(relax):                               # where the ring next to a town is squeezed hardest (dG stretches most), stiffen it so the squeeze spreads further out
            bad = np.pad(self.sv[1] > cap, ((0, 1), (0, 1)), mode="edge")
            if not bad.any(): break
            g = 1 + ndi.binary_dilation(bad, iterations=1) * .5
            self.wx *= np.maximum(g[:, 1:], g[:, :-1]); self.wy *= np.maximum(g[1:], g[:-1]); self._solve(); self.sv = self._sv()
        self.minsv, self.maxsv = float(self.sv[0].min()), float(self.sv[1].max())
        Y, X = np.mgrid[0:self.H1, 0:self.W1] + .5; gx_, gy_ = self.G(X, Y)
        self._tree = cKDTree(np.c_[gx_.ravel(), gy_.ravel()]); self._q = np.c_[X.ravel(), Y.ravel()]
    def _solve(self):
        gh, gw = self.gh, self.gw; N = gw * gh; idx = np.arange(N).reshape(gh, gw); free = (self.fix < 0).ravel()
        r_, c_, w_ = [], [], []
        for (a, b, w) in ((idx[:, :-1], idx[:, 1:], self.wx), (idx[:-1], idx[1:], self.wy)):
            a, b, w = a.ravel(), b.ravel(), w.ravel()
            r_ += [a, b, a, b]; c_ += [a, b, b, a]; w_ += [w, w, -w, -w]
        r_, c_, w_ = np.concatenate(r_), np.concatenate(c_), np.concatenate(w_)
        keep = free[r_]; A = coo_matrix((w_[keep], (r_[keep], c_[keep])), (N, N)).tocsr() + diags((~free).astype(float))
        bx = np.where(free, 0, self.bx.ravel()); by = np.where(free, 0, self.by.ravel())
        self.ux = spsolve(A, bx).reshape(gh, gw); self.uy = spsolve(A, by).reshape(gh, gw)
    def _sv(self):
        """(smallest, largest) singular value of dG on each coarse cell; the smallest above 0 means no fold"""
        s, k = self.step, 1 / self.K; ux, uy = self.ux, self.uy
        a = k + (ux[:-1, 1:] - ux[:-1, :-1] + ux[1:, 1:] - ux[1:, :-1]) / (2 * s); b = (ux[1:, :-1] - ux[:-1, :-1] + ux[1:, 1:] - ux[:-1, 1:]) / (2 * s)
        c = (uy[:-1, 1:] - uy[:-1, :-1] + uy[1:, 1:] - uy[1:, :-1]) / (2 * s); d = k + (uy[1:, :-1] - uy[:-1, :-1] + uy[1:, 1:] - uy[:-1, 1:]) / (2 * s)
        tr = a * a + b * b + c * c + d * d; det = a * d - b * c; q = np.sqrt(np.maximum(tr * tr / 4 - det * det, 0))
        return np.sqrt(np.maximum(tr / 2 - q, 0)) * np.sign(det), np.sqrt(tr / 2 + q)
    def _svdense(self, gx, gy):
        a, b = np.gradient(gx, axis=1), np.gradient(gx, axis=0); c, d = np.gradient(gy, axis=1), np.gradient(gy, axis=0)
        tr = a * a + b * b + c * c + d * d; det = a * d - b * c; q = np.sqrt(np.maximum(tr * tr / 4 - det * det, 0))
        return np.sqrt(np.maximum(tr / 2 - q, 0)) * np.sign(det), np.sqrt(tr / 2 + q)
    def G(self, X, Y):
        """new tile position(s) -> old (floats; arrays welcome)"""
        X = np.asarray(X, float); Y = np.asarray(Y, float)
        if self.mode == 'radial':
            K = self.K; ox, oy = X / K, Y / K; ws = np.zeros(X.shape); acc = []
            for i in range(len(self.c)):
                dx, dy = X - self.t[i, 0], Y - self.t[i, 1]; w = np.clip(1 - (np.hypot(dx, dy) - self.r[i]) / self.M[i], 0, 1)
                if not w.any(): continue
                ws = ws + w; acc.append((w, self.c[i, 0] - self.t[i, 0] / K + dx * (1 - 1 / K), self.c[i, 1] - self.t[i, 1] / K + dy * (1 - 1 / K)))
            nrm = np.maximum(ws, 1)
            for w, ex, ey in acc: ox = ox + w / nrm * ex; oy = oy + w / nrm * ey
            return ox, oy
        cx, cy = np.ravel(X) / self.step, np.ravel(Y) / self.step
        ux = ndi.map_coordinates(self.ux, [cy, cx], order=1, mode='nearest').reshape(X.shape)
        uy = ndi.map_coordinates(self.uy, [cy, cx], order=1, mode='nearest').reshape(X.shape)
        return X / self.K + ux, Y / self.K + uy
    def F(self, x, y):
        """old position -> new: the nearest new tile centre whose G lands there, then Newton on G"""
        _, k = self._tree.query((float(x), float(y))); X, Y = self._q[k]
        for _ in range(8):
            gx, gy = self.G(X, Y); e = 1e-3
            ax, ay = self.G(X + e, Y); bx, by = self.G(X, Y + e)
            J = np.array([[(ax - gx) / e, (bx - gx) / e], [(ay - gy) / e, (by - gy) / e]])
            dX = np.linalg.solve(J, [x - gx, y - gy]); X, Y = X + dX[0], Y + dX[1]
        return float(X), float(Y)
    def grids(self, W, H):
        """old position of every new tile (cell-corner convention, like XX / YY): inside a town it is exactly XX - shift"""
        Y, X = np.mgrid[0:H, 0:W] + .5; ox, oy = self.G(X, Y); return ox - .5, oy - .5
    def tiles(self, x, y):
        """old positions (cell-corner arrays) -> the nearest new tiles (int arrays; vectorised, tile precision)"""
        _, k = self._tree.query(np.c_[np.ravel(x) + .5, np.ravel(y) + .5]); q = np.floor(self._q[k]).astype(int); return q[:, 0], q[:, 1]
    def pf(self, x, y):
        """an old position in tile units (cell-corner convention, like XX / YY) -> new, as floats: inside a town exactly x + shift"""
        a, b = self.F(x + .5, y + .5); return round(a - .5, 6), round(b - .5, 6)      # rounded, so a point the warp leaves alone comes back exact (no 1e-12 under a tile edge)
    def pt(self, x, y):
        """an old tile -> the new tile"""
        a, b = self.pf(x, y); return int(round(a)), int(round(b))
