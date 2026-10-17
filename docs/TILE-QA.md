# Tile and object QA gate (mandatory)

Landon's rule: tilemap work keeps shipping small mistakes. Every new or changed tile, material, prop, building or placement goes through this gate before a run may report done.

## 1. No made-up art
Never draw tiles, props or buildings by script. Use art from the tilesets only: assets/adv/exterior.png, interior.png, and the community sets in tools/.cache/tilesets/ (credits in tools/.cache/tilesets/CREDITS.md). If nothing fits, leave it out and list it as "missing art" in the report. Recolours and crops of real art are fine; new shapes are not.

## 2. Automated lint: `py -3.12 -I tools/adv-tile-lint.py`
Must pass with zero errors:
- Cut-off: a prop rect whose border touches opaque pixels outside it in the sheet (the sprite continues past the rect: missing tree top, building edge).
- Bleed: a prop rect that includes opaque pixels of a neighbouring sprite (stray bits inside the rect corners).
- Autotile seams: every 13-role set rendered as a plus shape; each edge pair that should join is compared pixel row by row; mismatched joins are errors.
- Pixel density: art pixel size of each prop and material (2x2 block uniformity) must match the world scale (one art pixel = one sprite pixel after the 2x world scale). Mixed density is an error.
- Anchors and collision: anchor inside the opaque base; solid rect inside the sprite's footprint and on the ground row, not the roof.
- Placement: no solid prop on road, door, stairs, or within 1 tile of a door; no prop overlapping another prop's solid rect; doors reachable.

## 3. Visual review by a Haiku agent (low effort, one per new item batch)
For each new item: render (a) the item alone at 4x on grass with its anchor dot and solid rect, (b) the item in context in game (screenshot crop around it at native zoom). Send both images to a Haiku subagent with this checklist and nothing else: "Answer per image, yes/no plus one line: 1 cut off or missing pieces? 2 stray pixels from other sprites? 3 seams or wrong edge/corner tiles? 4 floating, sunk, or wrong depth order vs the player? 5 pixel size different from the surroundings? 6 looks out of place for a Gen 4/5 Pokemon game?" Any yes = fix and re-run the gate. Keep the Haiku replies in the run's report as one line per item.

## Derived tiles (Landon 2026-10-15)
Allowed: new tiles made ONLY by editing existing real tiles. Recolour fully or partly (sand, snow, ash, autumn variants of grass/path/cliff sets), cut a tile's grass edge away so the path sits on a transparent overlay layer over any ground (fixes green corners on snowy or sandy paths, e.g. Frostfall), mirror/rotate, recombine pieces of real tiles. Never freehand pixels. Every derived tile is built by a script from its source rects (tools/adv-build-tileset.py style), named after its source + change, listed in the contact sheet, and goes through the tile lint + Haiku review like any other.
