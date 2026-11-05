# Direct chunk editing: load a tile rectangle of the world into numpy layers, change it, write back only the chunks that changed (same file format).
import json, os, re
import numpy as np
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..') + '/'
CD = ROOT + 'data/adv/chunks/'
LAYERS = ('h', 'mat', 'over', 'kind')

def parse(p):
    s = open(p, encoding='utf8').read(); m = re.match(r'ADV\.chunk\((-?\d+),(-?\d+),(.*)\);\s*$', s, re.S)
    body = re.sub(r'([{,])([A-Za-z_]\w*):', r'\1"\2":', m.group(3))
    return int(m.group(1)), int(m.group(2)), json.loads(body), s.endswith('\n')
def unrle(s):
    out = []
    for t in s.split(','):
        if 'x' in t: v, n = t.split('x'); out += [int(v)] * int(n)
        else: out.append(int(t))
    return out
def rle(a):
    a = [int(x) for x in a]; out, i = [], 0
    while i < len(a):
        j = i
        while j < len(a) and a[j] == a[i]: j += 1
        out.append(str(a[i]) if j - i == 1 else f'{a[i]}x{j - i}'); i = j
    return ','.join(out)
def dump(cx, cy, d):
    parts = []
    for k, v in d.items(): parts.append(f'{k}:' + (json.dumps(v) if isinstance(v, str) else json.dumps(v, separators=(',', ':'))))
    return f'ADV.chunk({cx},{cy},{{' + ','.join(parts) + '});'

def palette():
    s = open(ROOT + 'data/adv/world.js', encoding='utf8').read()
    m = re.search(r'"palette":(\[[^\]]*\])', s) or re.search(r'palette:(\[[^\]]*\])', s)
    return json.loads(m.group(1))

class Region:
    """Tiles [x0, x1) x [y0, y1) in data tiles (32 px). Layers as int arrays [y, x]; props as a list of [name, px, py, ...] in data px."""
    def __init__(self, x0, y0, x1, y1):
        self.cx0, self.cy0, self.cx1, self.cy1 = x0 // 32, y0 // 32, (x1 - 1) // 32 + 1, (y1 - 1) // 32 + 1
        self.x0, self.y0 = self.cx0 * 32, self.cy0 * 32
        W, H = (self.cx1 - self.cx0) * 32, (self.cy1 - self.cy0) * 32
        self.L = {k: np.zeros((H, W), dtype=np.int16) for k in LAYERS}
        self.chunks = {}; self.props = []
        for cy in range(self.cy0, self.cy1):
            for cx in range(self.cx0, self.cx1):
                p = CD + f'{cx}_{cy}.js'
                if not os.path.exists(p): continue
                _, _, d, nl = parse(p); self.chunks[(cx, cy)] = (d, nl)
                ox, oy = (cx - self.cx0) * 32, (cy - self.cy0) * 32
                for k in LAYERS: self.L[k][oy:oy + 32, ox:ox + 32] = np.array(unrle(d[k])).reshape(32, 32)
                for pr in d.get('props', []): self.props.append(list(pr))
        self.orig = {k: v.copy() for k, v in self.L.items()}
        self.orig_props = json.dumps(sorted(json.dumps(p) for p in self.props))
    def __getattr__(self, k):
        if k in LAYERS: return self.L[k]
        raise AttributeError(k)
    def t(self, x, y): return (y - self.y0, x - self.x0)   # world tile -> array index
    def save(self):
        n = 0
        for (cx, cy), (d, nl) in self.chunks.items():
            ox, oy = (cx - self.cx0) * 32, (cy - self.cy0) * 32
            out = dict(d)
            for k in LAYERS: out[k] = rle(self.L[k][oy:oy + 32, ox:ox + 32].reshape(-1))
            out['props'] = [p for p in self.props if p[1] // 1024 == cx and p[2] // 1024 == cy]
            if all(out[k] == d[k] for k in LAYERS) and json.dumps(out['props']) == json.dumps(d.get('props', [])): continue
            open(CD + f'{cx}_{cy}.js', 'w', encoding='utf8').write(dump(cx, cy, out) + ('\n' if nl else '')); n += 1
        print('wrote', n, 'chunks')
