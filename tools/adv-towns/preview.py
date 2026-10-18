"""A town plan drawn with the real art, fast: the site's ground from a generated world (ADV_GEN_OUT, default data/adv), the plan's paving autotiled with the
lab ground and exterior tiles, every building and prop with its real sprite, depth sorted by foot. Heights show as a lighter top with a dark lip.
Run: python3 -I tools/adv-towns/preview.py CODE out.png [x0 y0 x1 y1]   (the window in tiles from the town centre, default the whole plan)
It is a design aid, not the game: no cliffs art, no shadows, ponds and plots drawn simply."""
import json, os, re, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE)); T = 32
D = os.environ.get('ADV_GEN_OUT') or os.path.join(ROOT, 'data', 'adv')
ROLES = ['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'iNE', 'iNW', 'iSE', 'iSW']

def load_js(f):
    s = open(f, encoding='utf8').read(); return json.loads(s[s.index('{'):s.rindex('}') + 1].split('};\n')[0] if '};\n' in s else s[s.index('{'):s.rindex('}') + 1])
ts = json.loads(open(os.path.join(ROOT, 'data/adv/tileset.js')).read().split('=', 1)[1].strip().rstrip(';'))
EX = Image.open(os.path.join(ROOT, ts['file'])).convert('RGBA'); EC = ts.get('cols', 8)
s_ = open(os.path.join(ROOT, 'data/adv/tileset-derived.js')).read(); DV = json.loads(s_[s_.index('{'):s_.index('};') + 1])
DIM = Image.open(os.path.join(ROOT, DV['file'])).convert('RGBA')
LG = json.load(open(os.path.join(ROOT, 'tools/.cache/lab-ground.json'))); LIM = Image.open(os.path.join(ROOT, 'tools/.cache/lab-ground.png')).convert('RGBA')
def etile(i): return EX.crop(((i % EC) * 32, (i // EC) * 32, (i % EC) * 32 + 32, (i // EC) * 32 + 32))
def ltile(i): return LIM.crop(((i % 16) * 32, (i // 16) * 32, (i % 16) * 32 + 32, (i // 16) * 32 + 32))
def dtile(i): return DIM.crop(((i % DV['cols']) * 32, (i // DV['cols']) * 32, (i % DV['cols']) * 32 + 32, (i // DV['cols']) * 32 + 32))
def hsh(c, r):
    h = (c * 73856093 ^ r * 19349663) & 0xffffffff; h = ((h ^ (h >> 16)) * 0x85ebca6b) & 0xffffffff; h = ((h ^ (h >> 13)) * 0xc2b2ae35) & 0xffffffff; return h ^ (h >> 16)
def pick(v, c, r): return v[hsh(c, r) % len(v)] if isinstance(v, list) else v

W_ = json.loads(re.search(r'ADV_WORLD = (\{.*\});', open(D + '/world.js').read(), re.S).group(1)); PAL = W_['palette'] + ['rgGrass', 'rgPath', 'rgWater']
def unrle(s): return [int(v) for t in s.split(',') for v in ([t.split('x')[0]] * int(t.split('x')[1]) if 'x' in t else [t])] if isinstance(s, str) else s
CK = {}
def chunk(a, b):
    if (a, b) not in CK:
        f = f'{D}/chunks/{a}_{b}.js'
        CK[a, b] = None if not os.path.exists(f) else (lambda s: {k: unrle(re.search(k + r':"([^"]*)"', s).group(1)) for k in ('h', 'mat')})(open(f).read())
    return CK[a, b]
def site(X, Y):
    c = chunk(X // 32, Y // 32)
    if not c: return 'waterDeep', 0
    i = (Y % 32) * 32 + X % 32; return PAL[c['mat'][i]], c['h'][i]

GROUPS = [{'water', 'waterDeep', 'sandWater', 'sandWaterDeep', 'ford', 'rgWater'}, {'grass', 'rgGrass', 'wetGrass', 'tallgrass', 'dryGrass'}]
def same(a, b): return a == b or any(a in g and b in g for g in GROUPS)
def role(get, c, r):
    m = get(c, r); s = lambda dc, dr: same(get(c + dc, r + dr), m)
    n, so, e, w = s(0, -1), s(0, 1), s(1, 0), s(-1, 0)
    v = 'N' if not n else 'S' if not so else ''; hz = 'E' if not e else 'W' if not w else ''
    if v or hz: return v + hz
    for k, (a, b) in (('iNE', (1, -1)), ('iNW', (-1, -1)), ('iSE', (1, 1)), ('iSW', (-1, 1))):
        if not s(a, b): return k
    return 'C'
PLANMAT = {'path': 'path', 'cobble': 'soilCobble', 'tan': 'pavingTan', 'soil': 'soilTilled', 'hay': 'hayField', 'grass': 'grass', 'sand': 'sand', 'snow': 'snow'}
def tile_for(m, rl, c, r):
    if m in ('grass', 'rgGrass', 'wetGrass', 'tallgrass', 'dryGrass'): return ltile(pick(LG['mats']['grass']['C'], c, r))
    if m in ('path', 'rgPath', 'pond'): return ltile(pick(LG['mats']['grass']['C'], c, r))     # the ground under the path layer (drawn by quarters in main)
    if m == 'ford': return ltile(pick(LG['mats']['ford'].get(rl, LG['mats']['ford']['C']), c, r))
    d = DV['mats'].get(m) or ts['mats'].get(m)
    src = dtile if m in DV['mats'] else etile
    if not d: return Image.new('RGBA', (32, 32), (255, 0, 255, 255))
    return src(pick(d.get(rl, d['C']), c, r))

PROPS = {}
for n, d in ts['props'].items(): PROPS[n] = (d, EX)
for n, d in DV.get('props', {}).items(): PROPS.setdefault(n, (d, DIM))
sys.path.insert(0, os.path.join(ROOT, 'tools')); import adv_labprops
LAB = adv_labprops.library()
for _n in LAB: PROPS[_n] = (LAB[_n][4], None)
def sprite(n):
    if n in LAB: im, d = adv_labprops.sprite(n); return im, d['ax'], d['ay'], d.get('door', [0, -2])
    d, sh = PROPS[n]; k = d.get('density') or 1
    im = sh.crop((d['sx'], d['sy'], d['sx'] + d['sw'], d['sy'] + d['sh']))
    if k != 1: im = im.resize((max(1, round(d['sw'] * k)), max(1, round(d['sh'] * k))), Image.NEAREST)
    return im, d['ax'] * k, d['ay'] * k, [v * k for v in d.get('door', [0, -2])]

def main():
    code, out = sys.argv[1], sys.argv[2]
    J = json.load(open(os.path.join(HERE, code + '.json'))); t = W_['towns'][code]
    cx, cy = (t['x'] // 64, t['y'] // 64) if W_.get('px') else (t['x'] // 32, t['y'] // 32)
    lim = J.get('lim', 46); x0, y0, x1, y1 = (map(int, sys.argv[3:7]) if len(sys.argv) >= 7 else (-lim, -lim, lim, lim))
    plan = {}
    for e in J.get('paving', []):
        m = PLANMAT.get(e[4] if len(e) > 4 else 'pave', 'pavingStone')
        for y in range(e[1], e[3] + 1):
            for x in range(e[0], e[2] + 1): plan[x, y] = m
    for d in J.get('deco', []):
        if d[0] == 'plot':
            for y in range(d[2], d[2] + d[4]):
                for x in range(d[1], d[1] + d[3]): plan[x, y] = 'soilTilled' if d[5] == 0 else 'hayField'
        if d[0] == 'pond':
            for y in range(int(d[2] - d[4] - 2), int(d[2] + d[4] + 3)):
                for x in range(int(d[1] - d[3] - 2), int(d[1] + d[3] + 3)):
                    q = ((x - d[1]) / d[3]) ** 2 + ((y - d[2]) / d[4]) ** 2
                    if abs(x - d[1]) <= int(d[3]) and abs(y - d[2]) <= int(d[4]) and not (abs(x - d[1]) > int(d[3]) - 2 and abs(y - d[2]) > int(d[4]) - 2): plan[x, y] = 'pond'
    def get(x, y):
        if (x, y) in plan: return plan[x, y]
        m, h = site(cx + x, cy + y); return 'grass' if m in ('path', 'rgPath') and abs(x) <= lim - 2 and abs(y) <= lim - 2 and J.get('hide_site_paths') else m
    Wd, Hd = (x1 - x0 + 1) * T, (y1 - y0 + 1) * T; im = Image.new('RGBA', (Wd, Hd), (0, 0, 0, 255)); dr = ImageDraw.Draw(im)
    h0 = site(cx, cy)[1]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            m = get(x, y); im.alpha_composite(tile_for(m, role(get, x, y), cx + x, cy + y), ((x - x0) * T, (y - y0) * T))
            h = site(cx + x, cy + y)[1] - h0
            if h > 0 and (x, y) not in plan:
                if site(cx + x, cy + y + 1)[1] - h0 < h: dr.rectangle(((x - x0) * T, (y - y0 + 1) * T - 6, (x - x0 + 1) * T - 1, (y - y0 + 1) * T - 1), fill=(90, 60, 30, 255))
    KEYS = DV.get('keys', {})
    for qmat, names in (('pond', ('pond',)), ('path', ('path', 'rgPath'))):
     QS = LG['mats'][qmat]['quad']; BY = LG['mats'][qmat].get('by', {})
     isp = lambda x, y: get(x, y) in names
     for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not any(isp(x + a, y + b) for a in (-1, 0, 1) for b in (-1, 0, 1)): continue
            gm = get(x, y) if not isp(x, y) else next((get(x + a, y + b) for a, b in ((0, -1), (1, 0), (0, 1), (-1, 0)) if not isp(x + a, y + b)), 'grass')
            qs = BY.get(KEYS.get(gm), {}).get('quad') or QS
            for q in range(4):
                hx, vy = (1 if q & 1 else -1), (1 if q & 2 else -1); bits = isp(x, y) | isp(x, y + vy) << 1 | isp(x + hx, y) << 2 | isp(x + hx, y + vy) << 3
                if bits and qs[q * 16 + bits] >= 0: im.alpha_composite(ltile(qs[q * 16 + bits]), ((x - x0) * T, (y - y0) * T))
    items = []
    for b in J.get('buildings', []):
        if b[0] not in PROPS: continue
        sp, ax, ay, door = sprite(b[0]); px = (b[1] + .5) * T - door[0]; py = b[2] * T - 1; items.append((py, sp, px - ax, py - ay))
    for n, x, y in J.get('props', []):
        if n not in PROPS: print('unknown prop', n); continue
        sp, ax, ay, _ = sprite(n); px = (x + .5) * T; py = (y + 1) * T - 1; items.append((py, sp, px - ax, py - ay))
    for py, sp, l, tp in sorted(items, key=lambda v: v[0]):
        im.alpha_composite(sp, (int(l - x0 * T), int(tp - y0 * T))) if l - x0 * T >= 0 and tp - y0 * T >= 0 else im.paste(sp, (int(l - x0 * T), int(tp - y0 * T)), sp)
    for k in range(x0, x1 + 1):
        if k % 10 == 0: dr.text(((k - x0) * T + 2, 2), str(k), fill=(255, 255, 255, 255))
    for k in range(y0, y1 + 1):
        if k % 10 == 0: dr.text((2, (k - y0) * T + 2), str(k), fill=(255, 255, 255, 255))
    im.convert('RGB').save(out); print('preview', out, im.size)

if __name__ == '__main__': main()
