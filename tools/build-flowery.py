# Builds the Flowery sprite strips from the local source rips (tools/flowery-src, gitignored).
# Usage: py -3.12 tools/build-flowery.py  (needs tools/flowery-src/flowery-sheet.png, the original 2532px sheet)
# Writes assets/sprite-custom/flowery/*.png, portrait.png, orange.png and prints the anim table pasted into data/custom-species.js.
import json, os
from PIL import Image
import numpy as np
from scipy import ndimage as ndi

SCALE = 1
OUT = 'assets/sprite-custom/flowery'
os.makedirs(OUT, exist_ok=True)
A = np.array(Image.open('tools/flowery-src/flowery-sheet.png').convert('RGB')).astype(int)  # the original sheet (Downloads/569577.png), 2532x2573
PAGE = np.array([18, 139, 203]); BOX = np.array([106, 212, 245])
K = A.shape[1] / 1476  # CELLS below were measured on a 1476px-wide downscaled copy; each is snapped to the real sheet's box it falls in
PAL = np.array([(10,8,10),(48,36,28),(104,78,50),(240,216,20),(168,140,24),(236,220,140),(244,242,236),(216,120,44),(92,140,36)])
def row(x0, pitch, n, w, y0, y1): return [(x0+i*pitch, y0, x0+i*pitch+w, y1) for i in range(n)]
CELLS = {
 'idle': row(889,32,5,31,22,57), 'sweat': row(889,32,5,31,110,145),
 'blown': [(1054,21,1090,57),(1094,21,1131,57)],
 'windup': [(1135,22,1154,57),(1154,22,1173,57),(1173,22,1191,57),(1191,22,1210,57),(1210,22,1229,57)],
 'punch': [(1233,28,1268,57),(1268,28,1304,57)], 'fair': [(1308,28,1337,57),(1337,28,1366,57)],
 'hurt': [(1233,68,1262,105)], 'deflect': [(1265,70,1289,105)],
 'pwr': [(1058,154,1077,188),(1077,154,1096,188)], 'pwrfin': row(1106,20,5,20,140,188),
}
_lab, _ = ndi.label(~(A == PAGE).all(-1))  # a box plus the sprite in it is one region, bounded by the page-colour gutters
_boxes = ndi.find_objects(_lab)
def snap(c):  # the real sheet box with the most area inside the scaled rect
    x0, y0, x1, y1 = (int(round(v * K)) for v in c)
    ids, cnt = np.unique(_lab[y0:y1, x0:x1], return_counts=True)
    ids, cnt = ids[ids > 0], cnt[ids > 0]
    sl = _boxes[ids[cnt.argmax()] - 1]
    return (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)
CELLS = {k: [snap(c) for c in v] for k, v in CELLS.items()}
def keymask(px):  # exact: only the box and page colours are background
    return ~((px == BOX).all(-1) | (px == PAGE).all(-1))
def clean(sub):  # the sheet's own pixels, 1:1: only the background box colour is keyed out (hard alpha), nothing is recoloured or resampled
    m = keymask(sub)
    H, W = m.shape
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[m, :3] = sub[m]; rgba[m, 3] = 255
    return rgba
SRC = {k: [clean(A[c[1]:c[3], c[0]:c[2]]) for c in v] for k, v in CELLS.items()}
mirror = lambda f: f[:, ::-1]
def anchor(f, upright):
    ys, xs = np.where(f[...,3] > 0)
    if upright:
        low = ys >= ys.max()-7
        return xs[low].mean()
    return xs.mean()
# anim table: name -> (frames, durations, upright, dirs, hit, ret)  dirs: frames are the right-facing set, left rows are mirrored
ANIMS = {
 'Idle': (SRC['idle'], [10]*5, True, True), 'Walk': (SRC['idle'], [6]*5, True, True), 'Sleep': (SRC['sweat'], [14]*5, True, True),
 'Hurt': ([SRC['hurt'][0]]*2, [2, 8], True, True), 'Dodge': ([SRC['deflect'][0]]*2, [9, 30], True, True),
 'Faint': (SRC['blown'], [8, 40], True, True), 'Charge': (SRC['pwr'], [5, 5], True, True),
 'Rise': (SRC['pwrfin'], [3, 3, 3, 5, 30], True, True),
 'Attack': (SRC['windup'] + [SRC['punch'][0]], [3,3,3,3,3,14], True, True),
 'Blow': (SRC['windup'] + [SRC['windup'][4]], [4,4,4,4,8,18], True, True),
 'Fair': ([SRC['fair'][1]], [30], False, True),
}
HIT = {'Attack': 5, 'Blow': 4, 'Dodge': 1, 'Rise': 3}
idle_f = SRC['idle'][0]; ys, xs = np.where(idle_f[...,3] > 0)
FOOT_COM = ys.max() + 1 - ys.mean()
meta = {}
for name, (frames, dur, upright, dirs) in ANIMS.items():
    ax = np.mean([anchor(f, upright) for f in frames])
    # common vertical frame: each source frame keeps its own y within the cell
    tops = []; bots = []; coms = []
    for f in frames:
        yy, xx = np.where(f[...,3] > 0); tops.append(yy.min()); bots.append(yy.max()+1); coms.append(yy.mean())
    foot = max(bots) if upright else np.mean(coms) + FOOT_COM
    ext = max(max(np.where(f[...,3] > 0)[1].max()+1-ax, ax-np.where(f[...,3] > 0)[1].min()) for f in frames)
    hw = int(np.ceil(ext)) + 2; fw = hw*2
    top = min(tops) - 2; bot = int(max(max(bots), foot)) + 2; fh = bot - top
    def cell(f, flip=False):
        c = np.zeros((fh, fw, 4), np.uint8)
        g = mirror(f) if flip else f
        gax = (f.shape[1]-ax) if flip else ax
        ox = int(round(hw - gax))
        for y in range(f.shape[0]):
            yy = y - top
            if not (0 <= yy < fh): continue
            for x in range(f.shape[1]):
                if g[y,x,3] and 0 <= x+ox < fw: c[yy, x+ox] = g[y,x]
        return c
    # every battle frame on the sheet faces LEFT (he is the enemy on the right in his fight): left rows are the source, right rows mirror it
    left = [cell(f) for f in frames]
    right = [cell(f, True) for f in frames]
    rows = [right if not dirs else None]*1
    if dirs:
        order = [right, right, right, right, right, left, left, left]  # PMD rows: 0 Down 1 DR 2 R 3 UR 4 Up 5 UL 6 L 7 DL
        rowlist = [order[0]] + [right, right, right] + [right] + [left, left, left]
        rowlist = [right, right, right, right, right, left, left, left]
    else: rowlist = [right]
    sheet = np.zeros((fh*len(rowlist), fw*len(frames), 4), np.uint8)
    for r, fr in enumerate(rowlist):
        for i, c in enumerate(fr): sheet[r*fh:(r+1)*fh, i*fw:(i+1)*fw] = c
    im = Image.fromarray(sheet, 'RGBA').resize((sheet.shape[1]*SCALE, sheet.shape[0]*SCALE), Image.NEAREST)
    im.save(f'{OUT}/{name}-Anim.png')
    meta[name] = {'file': f'assets/sprite-custom/flowery/{name}-Anim.png', 'fw': int(fw*SCALE), 'fh': int(fh*SCALE), 'durations': dur,
                  'footY': int((foot-top)*SCALE), 'hit': HIT.get(name, -1), 'ret': -1, 'rush': -1}
# portrait: the sheet's first PROFILE SPRITES face (17x28 box at 4,394), 1:1 on a black 28x28 square
fx0, fy0, fx1, fy1 = (int(round(v * K)) for v in (4, 394, 21, 422))
face = A[fy0:fy1, fx0:fx1]; S = max(face.shape[:2])
p = np.zeros((S, S, 4), np.uint8); p[..., 3] = 255
ox = (S - face.shape[1]) // 2; p[:face.shape[0], ox:ox + face.shape[1], :3] = face
Image.fromarray(p, 'RGBA').save(f'{OUT}/portrait.png')
# Orange's flying frames (JA-ORANGE column, first two), fist on the left, trail on the right, 1:1
O = np.array(Image.open('tools/flowery-src/orange-sheet.png').convert('RGBA'))
fr = [O[y:y+24, 2:62].copy() for y in (187, 213)]
for g in fr: g[(np.abs(g.astype(int)-np.array([195,134,255,255])).sum(-1) == 0)] = 0
strip = np.concatenate([g[:, 29:61] for g in fr], 1)
Image.fromarray(strip, 'RGBA').save(f'{OUT}/orange.png')
json.dump(meta, open(f'{OUT}/_anims.json', 'w'))
print(json.dumps(meta))
