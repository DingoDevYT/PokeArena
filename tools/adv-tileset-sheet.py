"""Contact sheet for data/adv/tileset.js. Run: py -3.12 -I tools/adv-tileset-sheet.py
Mats as 6x5 shapes with a hole (shows outer and inner corners), cliff mock-up, props on grass with anchor (red), solid rect (blue), door (yellow)."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'tools/.cache/adv-tileset-contact.png'
TS = json.loads((ROOT / 'data/adv/tileset.js').read_text().split('=', 1)[1].strip().rstrip(';'))
IMG = Image.open(ROOT / TS['file']).convert('RGBA')
T, COLS = TS['T'], TS['cols']
MASK = ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', '.XXXX.']
W = 1600


def tile(i):
    i = i[0] if isinstance(i, list) else i
    r, c = divmod(i, COLS)
    return IMG.crop((c * T, r * T, c * T + T, r * T + T))


def role(m, mask, c, r):
    g = lambda x, y: 0 <= y < len(mask) and 0 <= x < len(mask[0]) and mask[y][x] == 'X'
    n, s, e, w = g(c, r - 1), g(c, r + 1), g(c + 1, r), g(c - 1, r)
    if n and s and e and w:
        for k, (dx, dy) in (('iNE', (1, -1)), ('iNW', (-1, -1)), ('iSE', (1, 1)), ('iSW', (-1, 1))):
            if not g(c + dx, r + dy): return k
        return 'C'
    if not n and not w: return 'NW'
    if not n and not e: return 'NE'
    if not s and not w: return 'SW'
    if not s and not e: return 'SE'
    return 'N' if not n else 'S' if not s else 'W' if not w else 'E' if not e else 'C'


def grass_bg(w, h):
    g = tile(TS['mats']['grass']['C'][0])
    b = Image.new('RGBA', (w, h))
    for y in range(0, h, T):
        for x in range(0, w, T): b.paste(g, (x, y))
    return b


def shape(m, mask=MASK):
    mw, mh = len(mask[0]) * T, len(mask) * T
    b = grass_bg(mw, mh)
    for r, row in enumerate(mask):
        for c, ch in enumerate(row):
            if ch != 'X': continue
            k = role(m, mask, c, r)
            b.alpha_composite(tile(m.get(k, m['C'])), (c * T, r * T))
    return b


def font():
    from PIL import ImageFont
    return ImageFont.load_default()


def main():
    items = []  # (label, image)
    for n, m in TS['mats'].items():
        b = shape(m)
        if m.get('overlay'):
            ImageDraw.Draw(b).rectangle([0, 0, 3, 3], fill=(255, 0, 255, 255))
        items.append((n + (' (overlay)' if m.get('overlay') else ''), b))
    # cliff mock-up: 5 wide plateau 3x2 with face below and a stair
    cl = TS['cliff']
    cw, ch = 5 * T, 5 * T
    b = grass_bg(cw, ch)
    plat = [[1, 1, 1], [1, 1, 1]]
    for r in range(2):
        for c in range(3):
            x, y = (c + 1) * T, (r + 1) * T
            if r == 0: k = ['rimNW', 'rimN', 'rimNE'][c]
            else: k = [None, None, None][c]
            if c == 0 and r == 1: k = 'rimW'
            if c == 2 and r == 1: k = 'rimE'
            if k and cl.get(k) is not None: b.alpha_composite(tile(cl[k]), (x, y))
    for lvl, key in enumerate(('faceTop', 'face')):
        for c, e in enumerate('LMR'):
            if cl.get(key, {}).get(e) is not None: b.alpha_composite(tile(cl[key][e]), ((c + 1) * T, (3 + lvl) * T))
    items.append(('cliff: rims, faceTop, face', b))
    stairs = [(k, tile(v)) for k, v in cl.items() if k.startswith(('stairs', 'ledge')) and isinstance(v, int)]
    if stairs:
        b = grass_bg(len(stairs) * T, T)
        for i, (k, t) in enumerate(stairs): b.alpha_composite(t, (i * T, 0))
        items.append(('cliff ' + ','.join(k for k, _ in stairs), b))
    # layout
    pos, x, y, rh = [], 4, 4, 0
    fnt = font()
    cells = []
    for lab, b in items:
        cells.append((lab, b, False))
    for n, p in TS['props'].items():
        w, h = p['sw'], p['sh']
        b = grass_bg(w + 8, h + 8)
        b.alpha_composite(IMG.crop((p['sx'], p['sy'], p['sx'] + w, p['sy'] + h)), (4, 4))
        d = ImageDraw.Draw(b)
        ax, ay = p['ax'] + 4, p['ay'] + 4
        if p['solid']:
            s = p['solid']
            d.rectangle([ax + s[0], ay + s[1], ax + s[2], ay + s[3]], outline=(0, 60, 255, 255))
        d.rectangle([ax - 1, ay - 1, ax + 1, ay + 1], fill=(255, 0, 0, 255))
        if 'door' in p:
            d.rectangle([ax + p['door'][0] - 1, ay + p['door'][1] - 1, ax + p['door'][0] + 1, ay + p['door'][1] + 1], fill=(255, 230, 0, 255))
        cells.append((n, b, True))
    # shelf pack
    placed = []
    for lab, b, _ in cells:
        w = max(b.width, len(lab) * 6) + 6
        if x + w > W: x, y, rh = 4, y + rh, 0
        placed.append((lab, b, x, y))
        x += w
        rh = max(rh, b.height + 14)
    H = y + rh + 4
    sheet = Image.new('RGBA', (W, H), (40, 40, 48, 255))
    d = ImageDraw.Draw(sheet)
    for lab, b, px, py in placed:
        sheet.alpha_composite(b, (px, py + 12))
        d.text((px, py), lab, fill=(255, 255, 255, 255), font=fnt)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert('RGB').save(OUT)
    print(OUT, sheet.size)


main()
