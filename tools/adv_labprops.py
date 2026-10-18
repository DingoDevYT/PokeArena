"""The map-lab object library as game props (docs/REGION-REBUILD.md section 17): every lab object, cut from the lab sheets at its own size (one lab art px is
one data px, so a lab house is the size it is in the mockups), named rg_<lab name>. tools/adv-region-export.py puts them all in the region sheet; the
generator and tools/adv-towns/preview.py read their sizes and collision here, so a town plan can use the mockups' houses, trees, beds and stalls.
A lab building (house_*, dome_*, greenhouse, ...) has its door at the middle of its bottom edge and a solid base, like the game's own buildings."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'maplab')); import render as R

WALK = ('cave_', 'cv_pebbles', 'cv_drip', 'flower', 'tiny', 'clover', 'sprout', 'mushroom', 'leaves', 'bed_', 'sunflower', 'clump', 'pot_', 'mound', 'pumpkin', 'route_sign', 'arch', 'water_', 'raft', 'planter_', 'weeds', 'shells', 'puddle', 'pond')
TREES = ('round_', 'tall_', 'pine_', 'young_', 'fir_', 'bare_', 'slim_', 'cone_', 'palm')
BUILDINGS = ('house_', 'dome_', 'greenhouse', 'pc4', 'mart4', 'sandhall', 'straw', 'hut_round')
SKIP = ('cv_', 'gem_', 'chest_', 'coins', 'cave_')            # cave furniture and loot stay with the cave rooms

def prop_def(name, rect):
    """collision (solid [x0, y0, x1, y1] in data px round the foot anchor, None = walk through) and anchor for one lab object"""
    sx, sy, sw, sh = rect
    d = dict(sw=sw, sh=sh, ax=sw // 2, ay=sh)
    if name.startswith(BUILDINGS): d.update(solid=[-sw // 2 + 3, -56, sw // 2 - 3, 0], door=[0, -2])
    elif name.startswith(TREES): d.update(ay=sh - 3, solid=[-5, -5, 5, 1])
    elif name == 'stall' or name == 'stall_rug': d.update(solid=[-sw // 2 + 4, -20, sw // 2 - 4, 0])
    elif name.startswith(WALK): d.update(solid=None, noOutline=name.startswith('cave_'))
    elif name in ('bench', 'bench_stone'): d.update(solid=[-sw // 2 + 2, -8, sw // 2 - 2, 0])
    else: d.update(solid=[-(sw // 2 - 2), -min(10, max(4, sh // 3)), sw // 2 - 2, 0])
    return d

def library():
    """{rg_name: (sx, sy, sw, sh, def, sheet)} for every lab object a town or route can use"""
    out = {}
    for n, v in R.OBJ.items():
        if n.startswith(SKIP): continue
        sx, sy, sw, sh, *sheet = v; out['rg_' + n] = (sx, sy, sw, sh, prop_def(n, (sx, sy, sw, sh)), sheet[0] if sheet else 'main')
    return out

def sprite(name):
    """the lab object's image (RGBA) and its def"""
    sx, sy, sw, sh, d, src = library()[name]
    return R.SHEETS[src].crop((sx, sy, sx + sw, sy + sh)).convert('RGBA'), d
