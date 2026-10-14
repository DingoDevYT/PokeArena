# Builds the Flowery sprite strips from the local source rips (tools/flowery-src, gitignored).
# Usage: ffmpeg -y -i tools/flowery-src/flowery-sheet.webp tools/.cache/flowery/sheet.png ; py -3.12 tools/build-flowery.py
# Writes assets/sprite-custom/flowery/*.png, portrait.png, orange.png and prints the anim table pasted into data/custom-species.js.
import json, os
from PIL import Image
import numpy as np
from scipy import ndimage as ndi

SCALE = 1
OUT = 'assets/sprite-custom/flowery'
os.makedirs(OUT, exist_ok=True)
A = np.array(Image.open('tools/.cache/flowery/sheet.png').convert('RGB')).astype(int)
PAGE = np.array([17, 138, 202]); BOX = np.array([104, 210, 243])
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
def keymask(px):
    d1 = np.abs(px-BOX).sum(-1); d2 = np.abs(px-PAGE).sum(-1)
    return ~((d1 < 120) | (d2 < 120) | ((px[...,2]-px[...,0]) > 30))
def clean(sub):  # key out the sheet background, drop specks, snap to the Flowery palette, majority-filter the compression noise
    m = keymask(sub)
    m = ndi.binary_opening(m, structure=np.ones((2,2)))
    lab, n = ndi.label(m, structure=np.ones((3,3)))
    for i in range(1, n+1):
        if (lab == i).sum() < 6: m[lab == i] = False
    idx = ((sub[:,:,None,:]-PAL[None,None,:,:])**2).sum(-1).argmin(-1); idx[~m] = -1
    H, W = idx.shape
    for _ in range(3):
        out = idx.copy()
        for y in range(H):
            for x in range(W):
                if idx[y,x] < 0: continue
                nb = idx[max(0,y-1):y+2, max(0,x-1):x+2].ravel(); nb = nb[nb >= 0]
                cnt = np.bincount(nb, minlength=len(PAL))
                if cnt[idx[y,x]] <= 3: out[y,x] = cnt.argmax()
        idx = out
    rgba = np.zeros((H, W, 4), np.uint8); ok = idx >= 0
    rgba[ok,:3] = PAL[idx[ok]]; rgba[ok,3] = 255
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
 'Idle': (SRC['idle'], [10]*5, True, False), 'Walk': (SRC['idle'], [6]*5, True, False), 'Sleep': (SRC['sweat'], [14]*5, True, False),
 'Hurt': ([SRC['hurt'][0]]*2, [2, 8], True, False), 'Dodge': ([SRC['deflect'][0]]*2, [9, 30], True, False),
 'Faint': (SRC['blown'], [8, 40], True, False), 'Charge': (SRC['pwr'], [5, 5], True, False),
 'Rise': (SRC['pwrfin'], [3, 3, 3, 5, 30], True, False),
 'Attack': (SRC['windup'] + [SRC['punch'][1]], [3,3,3,3,3,14], True, True),
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
    right = [cell(f) for f in frames]
    left = [cell(f, True) for f in frames] if dirs else None
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
# portrait: head and shoulders of the first idle frame, 40x40
f = SRC['idle'][0]; yy, xx = np.where(f[...,3] > 0)
y0 = yy.min(); x0 = xx.min()
crop = f[y0:y0+18, x0:x0+18]
p = np.zeros((20, 20, 4), np.uint8); p[:crop.shape[0], :crop.shape[1]] = crop
Image.fromarray(p, 'RGBA').resize((40, 40), Image.NEAREST).save(f'{OUT}/portrait.png')
# Orange's flying frames (JA-ORANGE column, first two), fist on the left, trail on the right, 1:1
O = np.array(Image.open('tools/flowery-src/orange-sheet.png').convert('RGBA'))
fr = [O[y:y+24, 2:62].copy() for y in (187, 213)]
for g in fr: g[(np.abs(g.astype(int)-np.array([195,134,255,255])).sum(-1) == 0)] = 0
strip = np.concatenate([g[:, 29:61] for g in fr], 1)
Image.fromarray(strip, 'RGBA').save(f'{OUT}/orange.png')
json.dump(meta, open(f'{OUT}/_anims.json', 'w'))
print(json.dumps(meta))
