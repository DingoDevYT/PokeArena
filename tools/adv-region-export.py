"""Region rebuild exporter: map-lab maps (maplab/maps/<name>.json) -> game chunks, in place.   docs/REGION-REBUILD.md
  py -3.12 -I tools/adv-region-export.py            patch data/adv/chunks, zones.js, write assets/adv/region.png + data/adv/tileset-region.js
  py -3.12 -I tools/adv-region-export.py --revert   put the original chunk files and zones.js back (backups: maplab/out/region-pilot/backup)

A game cell is 2 x 2 lab cells (32 art px). The lab renderer paints the ground once; every 32 x 32 px cell of it becomes one baked tile in
assets/adv/region.png and the chunk's `bake` array points at it (adv-world.js autotile honours it). Collision/logic (water, path, tall grass)
comes from the lab ground characters, majority of the 4 sub-cells. Props keep their lab pixel position (lab px == game data px) and use
the lab sheet's own art (cropped, never redrawn). Nothing here draws a pixel: tiles are crops of lab-rendered real art.
Cliffs are REAL heights. The lab composite (with its own jagged terrain outline ring, which hugs the cliff art; ADVR.outline stays for every non-lab cliff) is cut per screen cell:
a plateau top of level h at lab/screen cell (gx, gy) becomes the data cell (gx, gy + h) with H = h, because the engine draws a top at screen row (data row - h);
the face row of a plateau (its bottom game row, where the south neighbour is lower) is not a cell of its own: its slice goes to `fbake` of the top cell above it,
which the engine draws as that cell's face (one tile per level-1 drop); a stairs opening (lab 'S') makes the lowland cell just below the face a stairs cell (kind 1,
H = the lowland level). Data cells nobody claims (hidden behind a plateau) are void (H -1). Props on a plateau move down by 32 * level and carry z = 32 * level.
Rules the maps must follow: drops are exactly one level, a plateau is at least 2 game rows tall (a top row and a face row), game aligned rects."""
import json, os, re, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'maplab'))
import render as R

WINDOWS = [   # one lab map per window; wx, wy = world cell of the window's top-left corner (multiples of 8)
    dict(map='maplab/maps/region_pilot.json', wx=840, wy=464, zone='route22',
         heal=[(x, y) for x in (837, 838, 839) for y in (468, 469, 470)]),   # old road cells left dangling outside the window's west edge
    dict(map='maplab/maps/region_pilot2.json', wx=240, wy=928, zone='route7', heal=[]),
    dict(map='maplab/maps/region_ridge.json', wx=808, wy=416, zone='route21', heal=[]),
]
ROOMS = [   # cave rooms (data/adv/rooms/<id>.js): a lab cave map baked into one chunk far from the world; a window's lab `doors` entry is the way in
    dict(map='maplab/maps/region_cave1.json', id='ridge-cave', cx=326, cy=0, dark=0.5),
]
OUT = os.path.join(ROOT, 'maplab/out/region-pilot'); BK = os.path.join(OUT, 'backup')
COLS = 20
WET, TALL, NONPATH = set('wvV'), set('tTu'), set('.tTuSwvVi')

# ---------- prop collision: solid rect [x0, y0, x1, y1] in art px relative to the anchor (foot centre); None = walk-through
WALK = ('cave_', 'cv_pebbles', 'cv_drip', 'flower', 'tiny', 'clover', 'sprout', 'mushroom', 'leaves', 'bed_', 'sunflower', 'clump', 'pot_', 'mound', 'pumpkin', 'route_sign', 'arch', 'water_', 'raft', 'planter_')
TREES = ('round_', 'tall_', 'pine_', 'young_', 'fir_', 'bare_')
def prop_def(name, rect):
    sx, sy, sw, sh = rect
    d = dict(sw=sw, sh=sh, ax=sw // 2, ay=sh)
    if name.startswith(TREES): d.update(ay=sh - 3, solid=[-5, -5, 5, 1])
    elif name.startswith('house_'): d.update(solid=[-sw // 2 + 3, -56, sw // 2 - 3, 0])
    elif name == 'stall': d.update(solid=[-sw // 2 + 4, -20, sw // 2 - 4, 0])
    elif name.startswith(WALK): d.update(solid=None, noOutline=name.startswith('cave_'))   # a cave stamp is a rectangle of cliff face art: no silhouette outline round it
    elif name in ('bench', 'bench_stone'): d.update(solid=[-sw // 2 + 2, -8, sw // 2 - 2, 0])
    else: d.update(solid=[-(sw // 2 - 2), -min(10, max(4, sh // 3)), sw // 2 - 2, 0])
    return d


def parse_chunk(path):
    s = open(path, encoding='utf-8').read()
    m = re.match(r'ADV\.chunk\((\d+),(\d+),(\{.*\})\);?\s*$', s, re.S)
    return json.loads(re.sub(r'([{,])([A-Za-z_]\w*):', r'\1"\2":', m[3]))
def rle(s):
    if not isinstance(s, str): return list(s)
    o = []
    for t in s.split(','):
        i = t.find('x')
        o += [int(t)] if i < 0 else [int(t[:i])] * int(t[i + 1:])
    return o
def unrle(a):
    out, i = [], 0
    while i < len(a):
        j = i
        while j < len(a) and a[j] == a[i]: j += 1
        out.append(str(a[i]) if j - i == 1 else f'{a[i]}x{j - i}'); i = j
    return ','.join(out)
def write_chunk(path, cx, cy, d):
    parts = [f'{k}:{json.dumps(d[k], separators=(",", ":"))}' for k in ('h', 'mat', 'over', 'kind', 'deck', 'bake', 'fbake', 'smask', 'props') if k in d]
    open(path, 'w', encoding='utf-8').write(f'ADV.chunk({cx},{cy},{{{",".join(parts)}}});\n')


def backup(path):
    os.makedirs(BK, exist_ok=True); b = os.path.join(BK, os.path.basename(path))
    if not os.path.exists(b): shutil.copy2(path, b)


def levels(mp, W, H):
    """lab level per lab cell from the cliffs layer (a digit; 'S' takes the level of the cell above it) and the stairs mask"""
    cl = [r.ljust(W, '.') for r in mp.get('cliffs', [])] + ['.' * W] * (H - len(mp.get('cliffs', [])))
    L = [[0] * W for _ in range(H)]; S = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            c = cl[y][x]; S[y][x] = c == 'S'
            if c.isdigit(): L[y][x] = int(c)
            elif c == 'S':
                yy = y
                while yy > 0 and cl[yy][x] == 'S': yy -= 1
                L[y][x] = int(cl[yy][x]) if cl[yy][x].isdigit() else 0
    return L, S


def main():
    if '--revert' in sys.argv:
        for f in os.listdir(BK):
            if not f.endswith('.js'): continue
            dst = os.path.join(ROOT, 'data/adv', f if f == 'zones.js' else 'chunks/' + f); shutil.copy2(os.path.join(BK, f), dst); print('restored', dst)
        return
    world = open(os.path.join(ROOT, 'data/adv/world.js'), encoding='utf-8').read()
    pal = json.loads(re.search(r'"palette":(\[[^\]]*\])', world)[1]); P = len(pal)
    ID = {'rgGrass': P, 'rgPath': P + 1, 'rgWater': P + 2}; TG = pal.index('tallgrass')
    tiles, tid = [], {}; rects, SL = {}, []; masks, mid = [], {}   # masks: cliff shadow outlines (32 rows of 32 bits, hex), shared by all windows
    for win in WINDOWS:
        mp = json.load(open(os.path.join(ROOT, win['map']))); W, H = mp['size']; gw, gh = W // 2, H // 2; wx, wy = win['wx'], win['wy']
        assert W % 2 == 0 and H % 2 == 0 and wx % 8 == 0 and wy % 8 == 0 and gw % 8 == 0 and gh % 8 == 0
        # ---- ground bake: the lab renderer minus props, fences and actors, cut into 32 px game cells
        img = R.render({**mp, 'objects': [], 'actors': [], 'fences': []}).convert('RGBA'); assert img.size == (W * 16, H * 16)
        ART = dict(R.LAST['art'])   # lab cell -> (opaque, green) of the cliff tile drawn there; a raised lab cell with none is solid top
        bake = []
        for gy in range(gh):
            for gx in range(gw):
                t = img.crop((gx * 32, gy * 32, gx * 32 + 32, gy * 32 + 32)); k = t.tobytes()
                if k not in tid: tid[k] = len(tiles); tiles.append(t)
                bake.append(tid[k])
        # ---- logic per game cell from the lab ground characters and the cliff levels
        gr = [r.ljust(W, '.') for r in mp['ground']] + ['.' * W] * (H - len(mp['ground']))
        LV, ST = levels(mp, W, H)
        lg = [[max(LV[2 * gy + j][2 * gx + i] for j in (0, 1) for i in (0, 1)) for gx in range(gw)] for gy in range(gh)]
        stair = [[sum(ST[2 * gy + j][2 * gx + i] for j in (0, 1) for i in (0, 1)) >= 2 for gx in range(gw)] for gy in range(gh)]
        face = [[gy + 1 < gh and lg[gy + 1][gx] < lg[gy][gx] for gx in range(gw)] for gy in range(gh)]
        smat, sover = {}, {}
        for gy in range(gh):
            for gx in range(gw):
                ch = [gr[2 * gy + j][2 * gx + i] for j in (0, 1) for i in (0, 1)]
                wet, path, tall = sum(c in WET for c in ch), sum(c not in NONPATH for c in ch), sum(c in TALL for c in ch)
                m = 'rgWater' if wet >= 2 else 'rgPath' if path >= 2 else 'rgGrass'
                smat[gx, gy] = ID[m]; sover[gx, gy] = TG if tall >= 2 and m == 'rgGrass' else 0
        N = gw * gh; dh, dmat, dover, dkind, dbake, dfb, dsm = [-1] * N, [ID['rgGrass']] * N, [0] * N, [0] * N, [-1] * N, [-1] * N, [-1] * N
        def cliffmask(gx, gy):
            """the plan outline (32 x 32, True = solid) of the raised data cell seen at screen cell (gx, gy): its own cliff art, and above a face the face's
            rounded ends, so a sun shadow swept from it follows the rock edge and the rounded corners instead of the tile square"""
            m = np.ones((32, 32), bool)
            for j in (0, 1):
                for i in (0, 1):
                    a = ART.get((2 * gx + i, 2 * gy + j))
                    if a is not None: m[j * 16:j * 16 + 16, i * 16:i * 16 + 16] = a[0]
            if gy + 1 < gh and face[gy + 1][gx]:
                for i in (0, 1):
                    a = ART.get((2 * gx + i, 2 * gy + 3))
                    if a is not None: m[:, i * 16:i * 16 + 16] &= a[0].mean(0) >= 0.5   # columns where the face itself is rock
            return m
        for gy in range(gh):
            for gx in range(gw):
                if face[gy][gx]:
                    assert gy > 0 and lg[gy - 1][gx] == lg[gy][gx] and not face[gy - 1][gx], f'{win["map"]}: face row at game cell {gx},{gy} has no plateau top above it (plateaus need a top row and a face row)'
                    t = (gy - 1 + lg[gy][gx]) * gw + gx; assert gy - 1 + lg[gy][gx] < gh, 'face data row outside the window'
                    dfb[t] = bake[gy * gw + gx]; continue
                d = gy + lg[gy][gx]; assert d < gh, f'{win["map"]}: plateau cell {gx},{gy} claims a data row outside the window'
                assert dh[d * gw + gx] < 0, f'{win["map"]}: two visible cells claim data cell {gx},{d} (a drop of more than one level, or a plateau closer than a face row to another)'
                dh[d * gw + gx] = lg[gy][gx]; dmat[d * gw + gx] = smat[gx, gy]; dover[d * gw + gx] = sover[gx, gy]; dbake[d * gw + gx] = bake[gy * gw + gx]
                if lg[gy][gx] > 0:
                    cm = cliffmask(gx, gy)
                    if not cm.all():
                        k = np.packbits(cm, axis=1).tobytes().hex()
                        if k not in mid: mid[k] = len(masks); masks.append(k)
                        dsm[d * gw + gx] = mid[k]
        for gy in range(gh):
            for gx in range(gw):
                if face[gy][gx] and stair[gy][gx]:
                    lo = gy + 1; assert lo < gh and lg[lo][gx] == lg[gy][gx] - 1 and not face[lo][gx], f'{win["map"]}: stairs at {gx},{gy} need lowland one level below'
                    dkind[(lo + lg[lo][gx]) * gw + gx] = 1
        levelAt = lambda px, py: lg[min(gh - 1, max(0, int(py) // 32))][min(gw - 1, max(0, int(px) // 32))]   # level of the screen cell under a lab-art-px point
        # ---- props: lab objects and fence pieces, lab px -> data px
        props, slots = [], dict(npc=[], mon=[], doors=[])
        for name, x, y in mp['objects']:
            sx, sy, sw, sh, *sheet = R.OBJ[name]; src = sheet[0] if sheet else 'main'
            ox, oy = R.nudge(name); d = prop_def(name, (sx, sy, sw, sh)); rects['rg_' + name] = (sx, sy, sw, sh, d, src)
            hl = levelAt(x * 16 + ox + d['ax'], y * 16 + oy + d['ay'])
            props.append(['rg_' + name, wx * 32 + x * 16 + ox + d['ax'], wy * 32 + y * 16 + oy + d['ay'] + 32 * hl] + ([32 * hl] if hl else []))
        for name, x, y in mp.get('game_props', []):
            hl = levelAt(x * 16, y * 16); props.append([name, wx * 32 + x * 16, wy * 32 + y * 16 + 32 * hl] + ([32 * hl] if hl else []))   # the game's own props (animated turbines), lab px anchors
        fc = lambda x, y: mp['fences'][y][x] if 0 <= y < len(mp.get('fences', [])) and 0 <= x < len(mp['fences'][y]) else '.'
        for y in range(H):
            for x in range(W):
                f = fc(x, y)
                if f not in R.FENCE: continue
                m = (fc(x, y - 1) == f) + 2 * (fc(x, y + 1) == f) + 4 * (fc(x - 1, y) == f) + 8 * (fc(x + 1, y) == f)
                c, r = R.FENCE[f][R.FENCE_FALLBACK.get(m, m)]; n = f'rgFence_{f}{c}_{r}'
                rects[n] = (c * 16, r * 16, 16, 16, dict(sw=16, sh=16, ax=8, ay=15, solid=[-8, -4, 8, 1], noOutline=True), 'main')
                hl = levelAt(x * 16 + 8, y * 16 + 8); props.append([n, wx * 32 + x * 16 + 8, wy * 32 + y * 16 + 15 + 32 * hl] + ([32 * hl] if hl else []))
        for kind, who, x, y, d in mp['actors']: slots[kind].append(dict(who=who, d=d, cell=[wx + x // 2, wy + y // 2]))
        dcell = lambda gx, gy: [wx + gx, wy + gy + lg[gy][gx]]   # a screen game cell -> its world data cell
        doors = []
        for dr in mp.get('doors', []):   # a cave stamp on a face: the door line is the top edge of the lowland cell in front of it (the foot stops there), x the stamp centre
            hl = levelAt(dr['x'] * 16 + 24, (dr['y'] + 2) * 16); doors.append(dict(room=dr['room'], x=wx * 32 + dr['x'] * 16 + 24, y=wy * 32 + (dr['y'] + 2) * 16 + 32 * hl))
        pr = {k: dcell(*v) for k, v in mp.get('probes', {}).items()}; sc = [[wx + i % gw, wy + i // gw] for i in range(N) if dkind[i]]
        SL.append(dict(doors=doors, probes=pr, stairs=sc, start=dcell(*mp['start']) if 'start' in mp else None, win=win, gw=gw, gh=gh, bake=dbake, fbake=dfb, smask=dsm, kind=dkind, mat=dmat, over=dover, hh=dh, props=props, slots=slots))

    # ---- cave rooms: the lab cave map at 2x (a room is drawn at scale 1 with 2x art), one chunk grid far from the world, ground baked per lab cell
    RM = []
    for rm in ROOMS:
        mp = json.load(open(os.path.join(ROOT, rm['map']))); W, H = mp['size']; cw, chh = -(-W // 32), -(-H // 32)
        img = R.render({**mp, 'objects': [], 'actors': [], 'fences': []}).convert('RGBA').resize((W * 32, H * 32), Image.NEAREST)
        cl = [r_.ljust(W, '.') for r_ in mp.get('cliffs', [])] + ['.' * W] * (H - len(mp.get('cliffs', []))); gr = [r_.ljust(W, '.') for r_ in mp['ground']] + ['.' * W] * (H - len(mp['ground']))
        mats, bakes = [], []
        for ci in range(cw * chh):
            mm, bb = [], []; v0 = img.crop((0, 0, 32, 32)); tid.setdefault(v0.tobytes(), len(tiles)) == len(tiles) and tiles.append(v0)
            for i in range(1024):
                lx, ly = (ci % cw) * 32 + (i & 31), (ci // cw) * 32 + (i >> 5)
                if lx < W and ly < H:
                    t = img.crop((lx * 32, ly * 32, lx * 32 + 32, ly * 32 + 32)); k = t.tobytes()
                    if k not in tid: tid[k] = len(tiles); tiles.append(t)
                    bb.append(tid[k]); mm.append(0 if cl[ly][lx] != '.' else 2 if gr[ly][lx] in WET else 1)
                else: bb.append(tid[img.crop((0, 0, 32, 32)).tobytes()]); mm.append(0)   # beyond the map: the lab's own void cell
            mats.append(unrle(mm)); bakes.append(unrle(bb))
        rprops = []
        for name, x, y in mp['objects']:
            sx, sy, sw, sh, *sheet = R.OBJ[name]; src = sheet[0] if sheet else 'main'; ox, oy = R.nudge(name); d = prop_def(name, (sx, sy, sw, sh))
            d = dict(d, k=2, ax=d['ax'] * 2, ay=d['ay'] * 2, solid=d['solid'] and [v * 2 for v in d['solid']]); rects['rgc_' + name] = (sx, sy, sw, sh, d, src)
            rprops.append(['rgc_' + name, rm['cx'] * 1024 + x * 32 + ox * 2 + d['ax'], rm['cy'] * 1024 + y * 32 + oy * 2 + d['ay']])
        sp = mp['spawn']; ex = mp['exit']
        rd = {k: v for k, v in dict(cx=rm['cx'], cy=rm['cy'], cw=cw, ch=chh, hh='0x1024', dark=rm['dark'], pal=['i_cave_dark', 'i_cave_floor', 'rgWater'], mats=mats, bakes=bakes, props=rprops,
              exits=[dict(c0=rm['cx'] * 32 + 2 * ex[0], c1=rm['cx'] * 32 + 2 * ex[2] + 1, r0=rm['cy'] * 32 + 2 * ex[1], r1=rm['cy'] * 32 + 2 * ex[3] + 1, end='s')],
              spawn=dict(x=rm['cx'] * 1024 + 2 * sp[0] * 32 + 32, y=rm['cy'] * 1024 + 2 * sp[1] * 32 + 32), box=[rm['cx'] * 1024, rm['cy'] * 1024, (rm['cx'] + 0) * 1024 + W * 32, rm['cy'] * 1024 + H * 32]).items()}
        open(os.path.join(ROOT, f'data/adv/rooms/{rm["id"]}.js'), 'w', encoding='utf-8').write('// Generated by tools/adv-region-export.py from ' + rm['map'] + chr(10) + 'ADV.room(' + json.dumps(rm['id']) + ', ' + json.dumps(rd, separators=(',', ':')) + ');' + chr(10))
        RM.append(rm['id'])

    # ---- region sheet: baked tiles, then the prop crops shelf-packed under them
    trows = -(-len(tiles) // COLS); W_SHEET = COLS * 32; y = trows * 32 + 8; x = 0; shelf = 0; place = {}
    for n, (sx, sy, sw, sh, d, src) in sorted(rects.items(), key=lambda kv: -kv[1][3]):
        k = d.get('k', 1); sw, sh = sw * k, sh * k
        if x + sw + 2 > W_SHEET: x, y, shelf = 0, y + shelf + 2, 0
        place[n] = (x, y); x += sw + 2; shelf = max(shelf, sh)
    sheet = Image.new('RGBA', (W_SHEET, y + shelf + 2))
    for i, t in enumerate(tiles): sheet.paste(t, ((i % COLS) * 32, (i // COLS) * 32))
    for n, (sx, sy, sw, sh, d, src) in rects.items():
        im = R.SHEETS[src].crop((sx, sy, sx + sw, sy + sh)); a = im.getchannel('A'); im.putalpha(a.point(lambda v: 0 if v < 128 else v))   # the lab drops baked half-transparent shadows too
        if d.get('k', 1) > 1: im = im.resize((sw * d['k'], sh * d['k']), Image.NEAREST)   # rooms draw at scale 1 with 2x art
        sheet.paste(im, place[n])
    sheet.save(os.path.join(ROOT, 'assets/adv/region.png'), optimize=True)
    pdefs = {}
    for n, (sx, sy, sw, sh, d, src) in rects.items():
        o = dict(sx=place[n][0], sy=place[n][1], sw=sw * d.get('k', 1), sh=sh * d.get('k', 1), ax=d['ax'], ay=d['ay'], solid=d['solid'])
        if d.get('noOutline'): o['noOutline'] = True
        if d.get('k', 1) > 1: o['density'] = d['k']   # nearest upscaled art for a room (scale 1, 2x art): one art pixel is k sheet px
        pdefs[n] = o
    ts = dict(file='assets/adv/region.png', T=32, cols=COLS, mats={n: {'C': 0} for n in ID}, props=pdefs, doors=[d for S in SL for d in S['doors']], cliffMasks=masks)
    js = 'window.ADV_TILESET_REGION = ' + json.dumps(ts, separators=(',', ':')) + """;
// Generated by tools/adv-region-export.py. adv-world.js reads the sheet itself (lookup, chunk bake, autotile); this file only registers the region materials with the world.
(function () {
  const R = window.ADV_TILESET_REGION, W = window.ADV_WORLD, D = window.ADV_TILESET_DERIVED;
  if (W) { for (const n of Object.keys(R.mats)) if (!W.palette.includes(n)) W.palette.push(n); (W.water = W.water || ['water']).includes('rgWater') || W.water.push('rgWater'); }
  if (D && D.joins) (D.joins.path = D.joins.path || []).includes('rgPath') || D.joins.path.push('rgPath');
  if (W) for (const d of R.doors || []) { (W.doors = W.doors || []).push({ room: d.room, end: 's', x: d.x * (W.px || 1), y: d.y * (W.px || 1) }); }   // cave mouths (data px; world.js px fields are scaled once by ADV.scaleWorld)
  if (typeof img === 'function') img(R.file);
})();
"""
    open(os.path.join(ROOT, 'data/adv/tileset-region.js'), 'w', encoding='utf-8').write(js)

    zp = os.path.join(ROOT, 'data/adv/zones.js'); backup(zp); zs = open(os.path.join(BK, 'zones.js'), encoding='utf-8').read()
    Z = json.loads(zs[zs.index('{'):zs.rindex('}') + 1]); rows = [rle(r) for r in Z['cells']]
    bw = json.loads(re.search(r'"buildings":(\[.*?\]),"supply"', world, re.S)[1]) if '"buildings"' in world else []
    summary = []
    for S in SL:
        win, gw, gh = S['win'], S['gw'], S['gh']; wx, wy = win['wx'], win['wy']
        x0, y0, x1, y1 = wx, wy, wx + gw, wy + gh; heal = set(win['heal'])
        chunks = {(cx, cy) for cx in range(x0 // 32, (x1 - 1) // 32 + 1) for cy in range(y0 // 32, (y1 - 1) // 32 + 1)} | {(x // 32, y // 32) for x, y in heal}
        for cx, cy in sorted(chunks):
            path = os.path.join(ROOT, f'data/adv/chunks/{cx}_{cy}.js'); backup(path)
            d = parse_chunk(os.path.join(BK, f'{cx}_{cy}.js'))   # always rebuild from the original
            h, m, o, k = rle(d['h']), rle(d['mat']), rle(d['over']), rle(d['kind']); dk = rle(d['deck']) if 'deck' in d else [-1] * 1024
            bk = rle(d['bake']) if 'bake' in d else [-1] * 1024; fb = [-1] * 1024; sm = [-1] * 1024
            for i in range(1024):
                wxc, wyc = cx * 32 + (i & 31), cy * 32 + (i >> 5)
                if (wxc, wyc) in heal: m[i] = pal.index('grass')
                if x0 <= wxc < x1 and y0 <= wyc < y1:
                    g = (wyc - y0) * gw + (wxc - x0)
                    h[i], k[i], dk[i], m[i], o[i], bk[i], fb[i], sm[i] = S['hh'][g], S['kind'][g], -1, S['mat'][g], S['over'][g], S['bake'][g], S['fbake'][g], S['smask'][g]
            keep = [p for p in d.get('props', []) if not (x0 * 32 <= p[1] < x1 * 32 and y0 * 32 <= p[2] < y1 * 32) and not p[0].startswith('rg')]   # rg* props are this tool's own: never carried over, so a backup taken after a run cannot double them
            new = [p for p in S['props'] if p[1] // 1024 == cx and p[2] // 1024 == cy]
            out = dict(h=unrle(h), mat=unrle(m), over=unrle(o), kind=unrle(k))
            if 'deck' in d or any(v >= 0 for v in dk): out['deck'] = unrle(dk)
            out['bake'] = unrle(bk)
            if any(v >= 0 for v in fb): out['fbake'] = unrle(fb)
            if any(v >= 0 for v in sm): out['smask'] = unrle(sm)
            out['props'] = keep + new
            write_chunk(path, cx, cy, out); print(f'chunk {cx}_{cy}: {len(new)} new props, {len(d.get("props", [])) - len(keep)} old removed')
        zid = Z['ids'].index(win['zone'])
        was = {Z['ids'][rows[by][bx]] for by in range(wy // 8, (wy + gh) // 8) for bx in range(wx // 8, (wx + gw) // 8)}
        print('zone cells of other zones inside the window are kept as they are:', sorted(i for i in was if not (i == 'wild' or i.startswith('route'))))   # a town's zone label is its own; only wild/route cells are relabelled
        assert not [b for b in bw if x0 - 4 <= b['fx'] < x1 and y0 - 4 <= b['fy'] < y1], 'a town building stands in the window'
        for by in range(wy // 8, (wy + gh) // 8):
            for bx in range(wx // 8, (wx + gw) // 8):
                if Z['ids'][rows[by][bx]] == 'wild' or Z['ids'][rows[by][bx]].startswith('route'): rows[by][bx] = zid
        summary.append(dict(window=dict(x=wx, y=wy, w=gw, h=gh), zone=win['zone'], void=sum(v < 0 for v in S['hh']), stairs=S['stairs'], probes=S['probes'], start=S['start'], slots=S['slots']))
    Z['cells'] = [unrle(r) for r in rows]
    open(zp, 'w', encoding='utf-8').write(zs[:zs.index('{')] + json.dumps(Z, separators=(',', ':')) + ';\n')

    # ---- index.html: load the region sheet after the world
    ip = os.path.join(ROOT, 'index.html'); s = open(ip, encoding='utf-8').read()
    tag, nl = '<script src="data/adv/tileset-region.js"></script>', '\n'
    s = s.replace(tag + nl, '')   # earlier runs put it after zones.js; it has to follow adv-world.js
    s = s.replace('<script src="src/adv-world.js"></script>' + nl, '<script src="src/adv-world.js"></script>' + nl + tag + nl, 1); open(ip, 'w', encoding='utf-8').write(s)
    for rid in RM:
        t2 = f'<script src="data/adv/rooms/{rid}.js"></script>'
        if t2 not in s: s = s.replace('<script src="data/adv/rooms/t4-cave.js"></script>' + nl, '<script src="data/adv/rooms/t4-cave.js"></script>' + nl + t2 + nl, 1)
    open(ip, 'w', encoding='utf-8').write(s)
    json.dump(dict(palette_base=P, baked_tiles=len(tiles), windows=summary), open(os.path.join(OUT, 'slots.json'), 'w'), indent=1)
    print(f'{len(tiles)} baked tiles, {sum(len(S["props"]) for S in SL)} props, sheet {sheet.size}, palette +{list(ID)} from index {P}')


if __name__ == '__main__': main()
