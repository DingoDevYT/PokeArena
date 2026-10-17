"""Cut Pokemon Ranger overworld sheets (Ragey rips, tools/.cache/ranger/*.gif) into 8-direction walk sheets.
Exact source pixels only: no resampling, no filtering, no palette changes.

  py -3.12 -I tools/ranger-cut.py boxes <sheet.gif>
      finds every frame cell, writes tools/.cache/ranger/boxes/<sheet>.png (3x, numbered) + .json
  py -3.12 -I tools/ranger-cut.py build <sheet.gif> <map.json>
      map.json: {"chars": [{"slug": "alia", "name": "Alia", "dirs": {"down": [ids], "downLeft": [ids], "left": [ids], "upLeft": [ids], "up": [ids]}}]}
      each dir lists 4 box ids: stand, stepA, stand, stepB (repeat ids when the sheet has fewer frames).
      Missing right-side dirs are mirrored from the left ones (and vice versa). Writes assets/trainer-ow-ranger/<slug>.png
      (rows: down, downRight, right, upRight, up, upLeft, left, downLeft; cells FW x FH, feet on FOOT) and tools/.cache/ranger/out/<slug>.json
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CACHE = os.path.join(ROOT, 'tools/.cache/ranger')
OUT = os.path.join(ROOT, 'assets/trainer-ow-ranger')
ROWS8 = ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft']
MIRROR = {'downRight': 'downLeft', 'right': 'left', 'upRight': 'upLeft', 'downLeft': 'downRight', 'left': 'right', 'upLeft': 'upRight'}
FW, FH, FOOT = 32, 48, 46


def load(p):
    return np.array(Image.open(p).convert('RGBA'))


def boxes(a):
    """frame cells: connected non-white regions at least 16 px tall (labels and palette swatches are smaller or get filtered by the agent)"""
    h, w = a.shape[:2]
    bg = (a[..., :3] >= 250).all(-1) | (a[..., 3] == 0)
    seen = np.zeros((h, w), bool); out = []
    for y in range(h):
        for x in range(w):
            if bg[y, x] or seen[y, x]: continue
            st = [(y, x)]; seen[y, x] = True; x0 = x1 = x; y0 = y1 = y
            while st:
                cy, cx = st.pop()
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; st.append((ny, nx))
            if y1 - y0 + 1 >= 16 and x1 - x0 + 1 >= 8: out.append([int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)])
    out.sort(key=lambda b: (b[1] // 8, b[0]))
    return out


def key(cell):
    """remove the cell background: every pixel exactly the rip's key colour (the commonest colour on the cell's border), including gaps enclosed by arms and legs"""
    c = cell.copy(); e = np.concatenate([c[0], c[-1], c[:, 0], c[:, -1]])[:, :3]
    cols, n = np.unique(e, axis=0, return_counts=True); col = cols[n.argmax()]
    c[(c[..., :3] == col).all(-1)] = 0
    return c


def place(spr):
    """spr (keyed RGBA) into a FW x FH cell: opaque bbox centred on x, lowest opaque row on FOOT"""
    ys, xs = np.nonzero(spr[..., 3])
    if not len(ys): raise SystemExit('empty frame')
    spr = spr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; h, w = spr.shape[:2]
    if w > FW or h > FOOT + 1: raise SystemExit(f'frame {w}x{h} does not fit {FW}x{FH}')
    cell = np.zeros((FH, FW, 4), np.uint8); x0 = (FW - w) // 2; y0 = FOOT + 1 - h
    cell[y0:y0 + h, x0:x0 + w] = spr
    return cell


def cmd_boxes(sheet):
    a = load(sheet); bx = boxes(a); name = os.path.splitext(os.path.basename(sheet))[0]
    os.makedirs(os.path.join(CACHE, 'boxes'), exist_ok=True)
    im = Image.fromarray(a).resize((a.shape[1] * 3, a.shape[0] * 3), Image.NEAREST); d = ImageDraw.Draw(im)
    for i, (x, y, w, h) in enumerate(bx):
        d.rectangle([x * 3, y * 3, (x + w) * 3 - 1, (y + h) * 3 - 1], outline=(255, 0, 0))
        d.rectangle([x * 3, y * 3, x * 3 + 18, y * 3 + 10], fill=(0, 0, 0)); d.text((x * 3 + 1, y * 3), str(i), fill=(255, 255, 0))
    im.save(os.path.join(CACHE, 'boxes', name + '.png'))
    json.dump(bx, open(os.path.join(CACHE, 'boxes', name + '.json'), 'w'))
    print(len(bx), 'boxes ->', os.path.join(CACHE, 'boxes', name + '.png'))


def cmd_build(sheet, mp):
    a = load(sheet); bx = boxes(a); spec = json.load(open(mp))
    os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.join(CACHE, 'out'), exist_ok=True)
    for ch in spec['chars']:
        frames = {}
        for d, ids in ch['dirs'].items():
            assert d in ROWS8 and len(ids) == 4, (ch['slug'], d)
            frames[d] = [place(key(a[bx[i][1]:bx[i][1] + bx[i][3], bx[i][0]:bx[i][0] + bx[i][2]])) for i in ids]
        for d in ROWS8:
            if d not in frames:
                src = frames.get(MIRROR.get(d))
                if src is None: raise SystemExit(f"{ch['slug']}: no frames for {d} or its mirror")
                frames[d] = [f[:, ::-1] for f in src]
        out = np.vstack([np.hstack(frames[d]) for d in ROWS8])
        Image.fromarray(out, 'RGBA').save(os.path.join(OUT, ch['slug'] + '.png'))
        meta = dict(name=ch.get('name', ch['slug']), file='assets/trainer-ow-ranger/%s.png' % ch['slug'], fw=FW, fh=FH, frames=4, rows=ROWS8, footY=FOOT, real8=True,
                    source=os.path.basename(sheet), credit='Pokemon Ranger, ripped by Ragey (tenchionline.com/ragey)')
        json.dump(meta, open(os.path.join(CACHE, 'out', ch['slug'] + '.json'), 'w'), indent=1)
        print('wrote', meta['file'])


PREFIX = {'_normal_': 'normal', 'Alia': 'alia', 'Billy': 'billy', 'Cameron': 'cameron', 'Clyde': 'clyde', 'Eastern Rangers': 'east', 'Elita': 'elita', 'Enemy Leader 2': 'enemy2',
          'Examiner': 'examiner', 'Garret': 'garret', 'Go-Rock Squad': 'gorock', 'Gordor': 'gordor', 'Joel': 'joel', 'Non-Playable Characters (1 _ 5)': 'npc1',
          'Non-Playable Characters (2 _ 5)': 'npc2', 'Non-Playable Characters (3 _ 5)': 'npc3', 'Non-Playable Characters (4 _ 5)': 'npc4', 'Non-Playable Characters (5 _ 5)': 'npc5',
          'North Rangers': 'north', 'Pxyis': 'pxyis', 'Ringtown Rangers': 'ringtown', 'South Rangers': 'south', 'Spenser': 'spenser', 'Tiffany': 'tiffany', 'Lunick': 'lunick', 'Solana': 'solana'}


def sheet_of(prefix):
    for f in os.listdir(CACHE):
        if f.endswith('.gif') and PREFIX.get(f[:-4].split(' - ')[-1]) == prefix: return os.path.join(CACHE, f)
    raise SystemExit('no sheet for ' + prefix)


def cells_of(a, bx):
    out = []
    for x, y, w, h in bx:
        c = key(a[y:y + h, x:x + w]); ys, xs = np.nonzero(c[..., 3])
        out.append(c[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(ys) else c[:1, :1])
    return out


def strip(cells, ids, S, flip=False, lab=None):
    """frames side by side, feet on one line, S x NEAREST"""
    H = max(cells[i].shape[0] for i in ids) + 2; W = max(cells[i].shape[1] for i in ids) + 4
    im = Image.new('RGBA', (len(ids) * W * S, H * S + 12), (120, 170, 140, 255)); d = ImageDraw.Draw(im)
    for n, i in enumerate(ids):
        c = cells[i][:, ::-1] if flip else cells[i]; h, w = c.shape[:2]
        im.alpha_composite(Image.fromarray(c).resize((w * S, h * S), Image.NEAREST), (n * W * S + (W - w) // 2 * S, 12 + (H - 1 - h) * S))
        d.text((n * W * S + 2, 0), str(i), fill=(0, 0, 0))
    return im


def cmd_cells(prefix):
    """every cell keyed and feet-aligned, 4x, numbered, in sheet order, 12 per row: tools/.cache/ranger/cells/<prefix>-NN.png"""
    a = load(sheet_of(prefix)); bx = boxes(a); cells = cells_of(a, bx); os.makedirs(os.path.join(CACHE, 'cells'), exist_ok=True)
    for p, k in enumerate(range(0, len(bx), 36)):
        rows = [strip(cells, list(range(r, min(r + 12, len(bx)))), 4) for r in range(k, min(k + 36, len(bx)), 12)]
        im = Image.new('RGBA', (max(r.width for r in rows), sum(r.height + 6 for r in rows)), (60, 60, 70, 255)); y = 0
        for r in rows: im.alpha_composite(r, (0, y)); y += r.height + 6
        im.save(os.path.join(CACHE, 'cells', '%s-%02d.png' % (prefix, p)))
    print(len(bx), 'cells ->', os.path.join(CACHE, 'cells', prefix + '-*.png'))


def cmd_review(prefix):
    """render a labels file (tools/.cache/ranger/labels/<prefix>.json, ranger-label.html format): one image per character, one labelled row per animation"""
    a = load(sheet_of(prefix)); bx = boxes(a); cells = cells_of(a, bx); spec = json.load(open(os.path.join(CACHE, 'labels', prefix + '.json')))
    os.makedirs(os.path.join(CACHE, 'review'), exist_ok=True)
    for ch in spec['chars']:
        rows = []
        for an in ch['anims']:
            if not an['frames']: continue
            s = strip(cells, an['frames'], 3, an.get('flip')); lab = Image.new('RGBA', (s.width + 190, s.height), (60, 60, 70, 255))
            ImageDraw.Draw(lab).text((4, s.height // 2), '%s %s%s' % (an['name'], an.get('dir') or '-', ' FLIP' if an.get('flip') else ''), fill=(255, 255, 255)); lab.alpha_composite(s, (190, 0)); rows.append(lab)
        if not rows: continue
        im = Image.new('RGBA', (max(r.width for r in rows), sum(r.height + 4 for r in rows) + 16), (40, 40, 50, 255)); ImageDraw.Draw(im).text((4, 2), ch['slug'] + '  ' + ch.get('name', ''), fill=(255, 255, 0)); y = 16
        for r in rows: im.alpha_composite(r, (0, y)); y += r.height + 4
        im.save(os.path.join(CACHE, 'review', '%s.png' % ch['slug']))
    print('review ->', os.path.join(CACHE, 'review', prefix + '-*.png'))


def cmd_compare(prefix, spec, out):
    """8x comparison: spec '0,5,21/2,7,23' = rows of cell ids -> out png"""
    a = load(sheet_of(prefix)); cells = cells_of(a, boxes(a))
    rows = [strip(cells, [int(i) for i in r.split(',') if i != ''], 8) for r in spec.split('/') if r]
    im = Image.new('RGBA', (max(r.width for r in rows), sum(r.height + 8 for r in rows)), (50, 50, 60, 255)); y = 0
    for r in rows: im.alpha_composite(r, (0, y)); y += r.height + 8
    im.save(out); print(out)


def head_off(ref, s, rows=12):
    """(dx, dy) shift that lines s's head up with ref's head (both feet-aligned and centred like pack places them): walk strides widen the bbox, and
    centring the bbox alone makes the head jitter sideways. The vertical bob stays exactly as drawn."""
    H = max(ref.shape[0], s.shape[0]) + 8; W = max(ref.shape[1], s.shape[1]) + 16; W += W % 2   # even like pack's cell width, so centring rounds the same way

    def put(c):
        o = np.zeros((H, W, 4), np.uint8); h, w = c.shape[:2]; o[H - 4 - h:H - 4, (W - w) // 2:(W - w) // 2 + w] = c; return o
    R, S = put(ref), put(s); y0 = H - 4 - ref.shape[0]; best = None
    for dy in range(-3, 4):
        for dx in range(-5, 6):
            A = R[y0:y0 + rows]; B = np.roll(np.roll(S, dx, 1), dy, 0)[y0:y0 + rows]; a1 = A[..., 3] > 0; a2 = B[..., 3] > 0
            cost = int((a1 != a2).sum() + ((a1 & a2) & (A[..., :3] != B[..., :3]).any(-1)).sum())
            if best is None or (cost, abs(dx) + abs(dy)) < best[:2]: best = (cost, abs(dx) + abs(dy), dx, dy)
    return best[2], best[3]


def cmd_pack():
    """every labels/*.json -> assets/trainer-ow-ranger/<slug>.png + data/trainer-ow-ranger.js
    sheet rows: walk.<dir> x8, idle.<dir> x8, then every other anim (name.dir). Missing walk dirs mirror the opposite side; a diagonal with no
    walk at all borrows the side walk (Ranger NPCs draw no diagonal walk) and keeps its own idle pose for standing. Cells sized per character, feet on one line."""
    data = {}
    for f in os.listdir(OUT) if os.path.isdir(OUT) else []:
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    os.makedirs(OUT, exist_ok=True)
    for lf in sorted(os.listdir(os.path.join(CACHE, 'labels'))):
        if not lf.endswith('.json'): continue
        prefix = lf[:-5]; a = load(sheet_of(prefix)); cells = cells_of(a, boxes(a)); spec = json.load(open(os.path.join(CACHE, 'labels', lf)))
        for ch in spec['chars']:
            lay = layout(ch, cells)
            if not lay: continue
            rows, offs = lay; img = lambda i, fl: cells[i][:, ::-1] if fl else cells[i]; meta_anims = {}
            used = {i for _, (fr, _) in rows for i, _ in fr}; m = max(abs(d) for o in offs for d, _ in o)
            fw = max(cells[i].shape[1] for i in used) + 2 + 2 * m; fw += fw % 2; mh = max(cells[i].shape[0] for i in used); fh = mh + 3; foot = mh + 1
            ncol = max(len(fr) for _, (fr, _) in rows); sheet = np.zeros((fh * len(rows), fw * ncol, 4), np.uint8)
            for r, (name, (fr, fps)) in enumerate(rows):
                for c, (i, fl) in enumerate(fr):
                    s = img(i, fl); h, w = s.shape[:2]; dx, lift = offs[r][c]; x0 = c * fw + (fw - w) // 2 + dx; y0 = r * fh + foot - h - lift
                    sheet[y0:y0 + h, x0:x0 + w] = s
                meta_anims[name] = dict(row=r, n=len(fr), fps=fps)
            Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, ch['slug'] + '.png'))
            data[ch['slug']] = dict(name=ch.get('name', ch['slug']), file='assets/trainer-ow-ranger/%s.png' % ch['slug'], fw=fw, fh=fh, footY=foot - 1, anims=meta_anims,
                                    rows=[n for n, _ in rows], real8=True, source=spec.get('sheet', ''), note=ch.get('note', ''))
    open(os.path.join(ROOT, 'data/trainer-ow-ranger.js'), 'w', encoding='utf8').write(
        '// Pokemon Ranger overworld sprites, ripped by Ragey (tenchionline.com/ragey). Built by tools/ranger-cut.py pack from tools/.cache/ranger/labels.\nwindow.TRAINER_OW_RANGER = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(len(data), 'characters packed')


def layout(ch, cells):
    """one labelled character -> (rows [(name, ([(cell, flip)], fps))], offs [[(dx, lift)] per frame]) as pack places them, or None (no frames)
    (tools/build-outfits.py reuses this so the player's body frames sit exactly like the packed NPC sheets)"""
    an = [x for x in ch['anims'] if x['frames']]
    if not an: return None
    got = {(x['name'], x.get('dir') or ''): x for x in an}
    if not any(k[0] == 'walk' for k in got):   # player sheets (Solana) draw only a run: it doubles as the walk
        got.update({('walk', k[1]): v for k, v in got.items() if k[0] == 'run'})

    def pick(name, d):
        if (name, d) in got: x = got[(name, d)]; return [(i, x.get('flip', False) ^ (n == 3 and x.get('mirror2', False))) for n, i in enumerate(x['frames'])], x.get('fps', 6)
        m = MIRROR.get(d)
        if m and (name, m) in got: x = got[(name, m)]; return [(i, not x.get('flip', False)) for i in x['frames']], x.get('fps', 6)
        return None
    rows = []
    for d in ('down', 'up'):   # Ranger draws one stride for front/back walks and mirrors it for the other step: [a, b, a, b] plays b flipped the second time
        x = got.get(('walk', d))   # [stand, step, stand2, step] too: the repeated step is the same leg, so it mirrors
        if x and len(x['frames']) == 4 and x['frames'][1] == x['frames'][3]: x['mirror2'] = True
    for d in ROWS8:
        w = pick('walk', d) or (pick('walk', {'downRight': 'right', 'upRight': 'right', 'downLeft': 'left', 'upLeft': 'left'}.get(d, '')) if d in MIRROR else None) or pick('walk', 'down')
        if not w and d in ('down', 'up') and any(k[0] == 'walk' for k in got):   # side walk only (npc5 striped boy): the real stand bounces in place
            s = pick('idle', d) or pick('idle', 'down'); w = s and ([s[0][0]] * 4, 6)
        if w: rows.append(('walk.' + d, w))
    walks = dict(rows)
    for d in ROWS8:   # idle: its own pose, else the stand of the walk it plays (borrowed side walk on diagonals), else the front idle
        i = pick('idle', d) or (walks.get('walk.' + d) and ([walks['walk.' + d][0][0]], 2)) or pick('idle', 'down') or pick('idle', 'downLeft')   # harmonica boy's front stand is fused to a prop
        if i: rows.append(('idle.' + d, i))
    for x in an:
        if x['name'] in ('walk', 'idle'): continue
        rows.append(('%s.%s' % (x['name'], x.get('dir') or ''), ([(i, x.get('flip', False)) for i in x['frames']], x.get('fps', 6))))
    if not rows: return None   # characters with no walk are kept: they are standing NPCs (idle rows only)
    # per frame (dx, lift): walk/run/idle frames line their heads up with the row's first frame. Walks whose head never moves
    # (Ranger front/back walks keep both feet on the line) rise 1 px on the step frames, the HGSS bounce (red.png: steps sit 1 px higher)
    img = lambda i, fl: cells[i][:, ::-1] if fl else cells[i]
    offs = []
    for name, (fr, _) in rows:
        if name.split('.')[0] not in ('walk', 'run', 'idle'): offs.append([(0, 0)] * len(fr)); continue
        o = [head_off(img(*fr[0]), img(i, fl)) for i, fl in fr]; dx = [a for a, _ in o]; bob = any(b for _, b in o)
        offs.append([(dx[n], 1 if name.startswith('walk.') and not bob and n % 2 else 0) for n in range(len(fr))])
    return rows, offs


def cmd_index():
    """box json for every sheet + boxes/index.json for tools/ranger-label.html"""
    idx = []
    for f in sorted(os.listdir(CACHE)):
        if not f.endswith('.gif'): continue
        short = f[:-4].split(' - ')[-1]; name = f[:-4]
        bx = boxes(load(os.path.join(CACHE, f))); os.makedirs(os.path.join(CACHE, 'boxes'), exist_ok=True)
        json.dump(bx, open(os.path.join(CACHE, 'boxes', name + '.json'), 'w'))
        idx.append(dict(sheet=f, short=short, prefix=PREFIX.get(short, short.lower().replace(' ', '')), boxes='boxes/' + name + '.json', n=len(bx)))
    json.dump(idx, open(os.path.join(CACHE, 'boxes', 'index.json'), 'w'), indent=1); print(len(idx), 'sheets indexed')


if __name__ == '__main__':
    {'boxes': lambda: cmd_boxes(sys.argv[2]), 'build': lambda: cmd_build(sys.argv[2], sys.argv[3]), 'index': cmd_index,
     'cells': lambda: cmd_cells(sys.argv[2]), 'review': lambda: cmd_review(sys.argv[2]), 'compare': lambda: cmd_compare(sys.argv[2], sys.argv[3], sys.argv[4]), 'pack': cmd_pack}[sys.argv[1]]()
