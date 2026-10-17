"""Hand decisions for tools/build-outfits.py (docs/OUTFITS.md P2), made by looking at every cell at 8x.
C[slug]: cand = every colour of the character -> the parts it can belong to (f face, h hair, t hat, T top, B bottom, G bag, k skin below the head,
D a dress colour: top above the waist row, bottom below, o outline); several letters = the colour is shared and each pixel takes the part most of its
neighbours have. ramp = the colours of each part that recolour (dark to light, s = skin); a part's other colours keep their source colour.
fix = {cell: [(y, x, part)]} single pixels set by hand; capped = {cell: row} a cap's rows (face pixels above go with the cap);
edge = colours that are hat only beside the cap's own colours; steps = {part: ramp steps} when the default spread is wrong; long = hair may hang below the head.
"""
FAMILY = ['npc1-blue-haired-boy', 'npc1-ponytail-girl', 'npc1-striped-dress-girl', 'npc1-backwards-cap-boy', 'npc1-red-cap-man']
KW = 22   # the family's skin line: arm and hand skin above it, leg skin from it down

C = {
    'npc1-ponytail-girl': dict(
        cand={'300018': 'o', '581818': 'hfTB', '980010': 'hT', '803030': 'hfkB', '386890': 'Bf', '6898c0': 'Bf', '8080a8': 'B', 'c8c8e8': 'fB', 'f0f0f0': 'fB',
              'c04858': 'Th', 'e06888': 'T', 'f08098': 'T', 'b06860': 'hfkB', 'd89878': 'fk', 'f0c8a0': 'fk'},
        ramp={'h': '581818 803030 b06860', 's': '803030 b06860 d89878 f0c8a0', 'T': '980010 c04858 e06888 f08098', 'B': '386890 6898c0'},
        fix={89: [(4, 7, 'h'), (4, 9, 'h'), (5, 7, 'h'), (5, 9, 'h'), (6, 5, 'h'), (6, 11, 'h'), (7, 4, 'h'), (7, 12, 'h'), (11, 7, 'f'), (11, 8, 'f'), (11, 9, 'f')],
             90: [(4, 4, 'h'), (4, 6, 'h'), (4, 8, 'h'), (5, 3, 'h'), (5, 6, 'h'), (7, 3, 'h'), (7, 9, 'h')], 91: [(4, 6, 'h'), (4, 8, 'h'), (5, 4, 'h'), (6, 4, 'h')], 92: [(11, 8, 'T')]}),
    'npc1-blue-haired-boy': dict(
        cand={'281800': 'o', '202868': 'h', '603828': 'fkB', '484880': 'h', 'a05020': 'fkB', '307888': 'T', 'c85028': 'B', '4098a8': 'T', '887898': 'hB',
              'd88000': 'B', 'd09078': 'fk', '70b8d8': 'T', 'c8c8e8': 'fTB', 'f0c0a8': 'fk', 'f8f8f8': 'fTB'},
        ramp={'h': '202868 484880 887898', 's': 'a05020 d09078 f0c0a8', 'T': '307888 4098a8 70b8d8', 'B': 'c85028'}),
    'npc1-backwards-cap-boy': dict(
        cand={'281000': 'o', '382058': 'tB', '504818': 'BT', '604020': 'tfkT', '584070': 'tB', 'c84010': 'T', '787818': 'BT', 'a87060': 'fk', 'f86028': 'T',
              'e0b080': 'fk', 'c0b0d8': 'fTB', 'e0c850': 't', 'f8d8a8': 'fk', 'f8f0a0': 't', 'f8f8f8': 'fTB'},
        ramp={'t': 'e0c850 f8f0a0', 's': 'a87060 e0b080 f8d8a8', 'T': 'c84010 f86028', 'B': '504818 787818'},
        capped={17: 4, 18: 4, 19: 4},   # his hair is the cap's brown (604020): fringe and side hair under the cap set by hand, eyes are face, collar is top
        fix={17: [(4, 5, 'h'), (4, 6, 'h'), (4, 10, 'h'), (4, 11, 'h'), (5, 4, 'h'), (5, 12, 'h'), (6, 4, 'h'), (6, 5, 'h'), (6, 11, 'h'), (6, 12, 'h'), (8, 6, 'f'), (8, 10, 'f'), (11, 5, 'T'), (11, 11, 'T')],
             18: [(4, 3, 'h'), (4, 7, 'h'), (4, 8, 'h'), (5, 9, 'h'), (5, 10, 'h'), (6, 4, 'f'), (8, 7, 'f')], 19: [(4, 7, 'h'), (4, 8, 'h'), (5, 9, 'h'), (6, 10, 'h'), (8, 6, 'f')],
             20: [(7, 3, 'h'), (7, 5, 'h'), (9, 7, 'h'), (10, 8, 'h'), (11, 6, 'T')]}),
    'npc1-red-cap-man': dict(
        cand={'181028': 'o', '282890': 'D', '404848': 'tBT', '703830': 'hkT', 'b82828': 'tT', '5048a8': 'D', '507888': 'tBT', '4878f0': 'D', 'f85050': 'tT',
              'b87850': 'fk', '68a8f8': 'D', 'a8b8c8': 't', 'e0a888': 'fk', 'f0d0c0': 'fk', 'f0f0f0': 'tf'},
        ramp={'t': '507888 a8b8c8 f0f0f0', 'h': '703830', 's': 'b87850 e0a888 f0d0c0', 'T': '282890 5048a8 4878f0 68a8f8', 'B': '282890 5048a8 4878f0 68a8f8'},
        fix={81: [(10, 4, 'T')], 83: [(12, 9, 'T'), (12, 10, 'T')], 85: [(12, 9, 'T'), (12, 10, 'T')], 73: [(6, 4, 'h'), (6, 12, 'h'), (7, 4, 'h'), (7, 12, 'h'), (7, 5, 'f'), (7, 11, 'f')], 74: [(8, 11, 'h')], 75: [(8, 9, 'h')], 76: [(9, 5, 'h'), (9, 7, 'h')]},   # ear-level greys are hair, eye whites are face
    ),
    'npc1-striped-dress-girl': dict(
        cand={'300018': 'o', '185048': 'Tf', '683030': 'hfD', '407870': 'Tf', '905858': 'hD', '8080a8': 'B', '989828': 'D', '60a0a0': 'T', 'c87868': 'hfkD',
              'f09888': 'hD', 'd8b088': 'fkD', 'c8c8e8': 'fB', 'e0e058': 'D', 'f8d0d0': 'fk', 'f0f0f0': 'fB'},
        ramp={'h': '683030 905858 c87868 f09888', 's': 'c87868 d8b088 f8d0d0', 'T': '185048 407870 60a0a0', 'B': '989828 e0e058'}, face_n=2,
        fix={105: [(3, 10, 'h'), (4, 11, 'h'), (5, 7, 'h'), (6, 5, 'h'), (6, 11, 'h'), (6, 12, 'h'), (11, 5, 'T'), (11, 7, 'f'), (11, 9, 'f'), (11, 11, 'T')],
             106: [(3, 6, 'h'), (3, 7, 'h'), (4, 5, 'h'), (4, 8, 'h'), (5, 4, 'h'), (7, 3, 'h'), (8, 12, 'h'), (9, 11, 'h')],
             107: [(4, 5, 'h'), (4, 6, 'h'), (4, 8, 'h'), (5, 4, 'h'), (5, 9, 'h'), (6, 4, 'h'), (6, 9, 'h'), (10, 10, 'h')], 108: [(11, 6, 'T'), (11, 7, 'T'), (11, 8, 'T'), (11, 9, 'T')]},   # side hair and fringe strands are hair, the shadow under the chin is face, the collar is top
    ),
    # rigid donors: only their stand frames are used (hair or hat, moved with the body's face); clothes colours only need to stay out of h/f/t
    'npc4-brown-haired-boy': dict(
        cand={'300018': 'o', '502818': 'hf', '702028': 'T', '684828': 'h', '3070b0': 'T', '985860': 'T', 'b08848': 'hf', '6098e0': 'T', 'a8a8c0': 'T',
              'd8b088': 'fk', 'b8b8d0': 'fT', 'd0d0e8': 'T', 'f0d0c0': 'fk', 'f8f8f8': 'fT'},
        ramp={'h': '502818 684828 b08848', 's': 'b08848 d8b088 f0d0c0'}, face_n=4,
        fix={85: [(11, 7, 'T'), (11, 8, 'T'), (11, 9, 'T')], 87: [(11, 6, 'T'), (11, 7, 'T')]}),   # neck shadow under the chin, not hair
    'npc4-vest-boy': dict(
        cand={'300000': 'o', '282818': 'h', '303820': 'f', '881010': 'T', '005870': 'T', '505038': 'hf', '506018': 'T', '207890': 'T', 'b04040': 'T',
              '809840': 'T', 'c07868': 'fk', 'b0c8d0': 'fT', 'e8b8a8': 'fk', 'f8f8f8': 'fT'},
        ramp={'h': '282818 505038', 's': 'c07868 e8b8a8'}),
    'npc4-blonde-girl': dict(
        cand={'201000': 'o', '802820': 'hT', '603850': 'fB', '784808': 'hT', '784878': 'B', '608048': 'T', 'c05068': 'hT', 'a87828': 'hTB', 'd87878': 'T',
              '80b878': 'T', 'd0b058': 'hB', 'e0a888': 'fk', 'f0d080': 'hB', 'f0d0c0': 'fk', 'f8f8f8': 'f'},
        ramp={'h': '784808 a87828 d0b058 f0d080', 's': 'e0a888 f0d0c0'}, long=True,
        fix={147: [(13, 14, 'T')]}),   # the back's outline beside a strand belongs to the top: as hair it closes a gap on a narrower top
    'npc3-blue-haired-woman': dict(
        cand={'300018': 'o', '182050': 'h', '284078': 'h', '504030': 'TB', '704810': 'fT', '5080b8': 'h', 'c07000': 'fT', 'b09038': 'TB', '78a090': 'T',
              'b09058': 'fk', 'e0b078': 'fk', 'd8c870': 'TB', 'b0f0d8': 'T', 'f8d8b8': 'fk', 'f8f8f8': 'fT'},
        ramp={'h': '182050 284078 5080b8', 's': 'b09058 e0b078 f8d8b8'}, long=True),
    'npc5-red': dict(
        cand={'401818': 'o', '684840': 'thT', '405878': 'B', 'c04040': 'tT', '508098': 'tB', 'f86058': 'tT', 'a8a828': 'T', 'c09080': 'fk', '80b8d0': 'B',
              'd8a090': 'ft', 'a8c0c0': 'tfT', 'f0d0b8': 'fk', 'e8e860': 'T', 'd8e0e0': 'tfT', 'f8f8f8': 'tfT'},
        ramp={'t': 'c04040 f86058', 's': 'c09080 d8a090 f0d0b8'}, edge='684840',
        fix={1: [(6, 12, 'h'), (6, 13, 'h'), (6, 14, 'h'), (7, 9, 'f'), (7, 10, 'h'), (7, 11, 'h')], 2: [(7, 3, 'h'), (7, 6, 'f'), (7, 8, 'h'), (7, 9, 'h'), (7, 10, 'h'), (7, 11, 'h'), (8, 5, 'f')],
             3: [(7, 5, 'h'), (7, 6, 'h'), (7, 7, 'h'), (7, 12, 'h'), (7, 13, 'h'), (8, 8, 'h'), (8, 9, 'h'), (8, 10, 'h'), (8, 11, 'h')],
             4: [(8, x, 'h') for x in range(4, 13)] + [(9, 5, 'h'), (9, 11, 'h'), (10, 5, 'T'), (10, 6, 'h'), (10, 10, 'h'), (10, 11, 'T')]}),   # his dark hair under the cap's rim is hair
    'npc3-cap-girl': dict(
        cand={'301800': 'o', '781810': 'tB', '583818': 'tfB', '483070': 'hT', '406830': 'T', 'a85008': 'fB', 'a84848': 'tB', '9070c0': 'hT', '70a060': 'T',
              'd08058': 'fk', 'd88080': 't', 'c0c098': 'fT', 'e8b088': 'fk', 'f8d8b8': 'fk', 'f8f8e8': 'fT'},
        ramp={'t': '781810 a84848 d88080', 's': 'd08058 e8b088 f8d8b8'}, edge='583818', steps={'t': [1, 2, 3]}),   # the crown is its darkest red: a mid step, not near black
}

# (slug, name) per part list; the order is the save's index
BODIES = [('npc1-blue-haired-boy', 'Boy'), ('npc1-ponytail-girl', 'Girl'), ('npc1-striped-dress-girl', 'Girl 2'), ('npc1-backwards-cap-boy', 'Boy 2')]
HAIRS = [('npc1-blue-haired-boy', 'Spiky'), ('npc1-ponytail-girl', 'Ponytail'), ('npc1-striped-dress-girl', 'Buns'), ('npc4-brown-haired-boy', 'Messy'),
         ('npc4-vest-boy', 'Short'), ('npc4-blonde-girl', 'Ribbon'), ('npc3-blue-haired-woman', 'Long')]
HATS = [('npc1-red-cap-man', 'Cap'), ('npc1-backwards-cap-boy', 'Backwards cap'), ('npc5-red', 'Trainer cap'), ('npc3-cap-girl', 'Round cap')]
TOPS = [('npc1-blue-haired-boy', 'Polo'), ('npc1-ponytail-girl', 'Tank top'), ('npc1-striped-dress-girl', 'Jacket'), ('npc1-backwards-cap-boy', 'Tee'), ('npc1-red-cap-man', 'Overall bib')]
BOTS = [('npc1-blue-haired-boy', 'Shorts'), ('npc1-ponytail-girl', 'Jeans'), ('npc1-striped-dress-girl', 'Skirt'), ('npc1-backwards-cap-boy', 'Cargo shorts'), ('npc1-red-cap-man', 'Trousers')]
BAGS = []

DEF = dict(
    ramps=[['181818', '393131', '525252', '7b736a'], ['313131', '4a5a62', '6a8b83', '8b9c9c'], ['413120', '6a4a39', 'a4624a', 'c58b52'], ['413129', '735241', 'b47b52', 'e6ac52'],
           ['5a4a20', '8b7339', 'b49452', 'e6bd52'], ['9c8352', 'e6bd52', 'e6d573', 'ffeeb4'], ['623908', 'cd6a08', 'ff9c29', 'ffb420'], ['6a0000', 'ac2029', 'de4a52', 'f66a4a'],
           ['733141', 'cd4a5a', 'f6838b', 'ffb4bd'], ['4a184a', '73398b', 'a462cd', 'ded5ee'], ['292939', '39416a', '4a5a83', '6a8ba4'], ['39416a', '4a62ac', '5a7bee', '83a4f6'],
           ['294a4a', '41735a', '52a483', '62bdb4'], ['294131', '39735a', '52a47b', '6a9441'], ['525262', '83839c', 'acacb4', 'eeeeff'], ['944100', 'cd6200', 'e69429', 'ffb420']],
    # skins: 4 steps (deep shadow, shadow, base, light). The first five are Ranger NPCs' own skins (exact colours), the last three come from the
    # HGSS skins P1 used, for darker tones (no Ranger NPC has one). A 3-shade face takes steps 1-3, so it keeps its own contrast
    skins=[['603828', 'a05020', 'd09078', 'f0c0a8'], ['803030', 'b06860', 'd89878', 'f0c8a0'], ['683030', 'c87868', 'd8b088', 'f8d0d0'], ['604020', 'a87060', 'e0b080', 'f8d8a8'],
           ['703830', 'b87850', 'e0a888', 'f0d0c0'], ['5a2920', '7b4129', 'cd9473', 'eebd9c'], ['41201a', '5a2920', 'a45a41', 'd58b62'], ['41201a', '41201a', '7b4129', 'a4624a']],
    outfit=dict(body=0, hair=0, hairC=10, hat=0, hatC=7, top=0, topC=12, bot=0, botC=6, bag=0, bagC=15, skin=0))