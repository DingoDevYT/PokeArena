# Region rebuild: map-lab quality across the whole island

Owner ask (2026-10-16): make the full region as detailed and beautiful as the map-lab mockups. Owner direction the same day: "a somewhat redesign of the region, we don't need to have it be one to one with everything, use my drawn map as a rough outline, take genuinely good design over region image accuracy any day of the week." So his drawing fixes where towns, routes and biomes sit and in what order they connect; zone shapes, sizes, road routing and landmarks are ours to improve.

Status: survey done, pipeline written, two pilots running in the game (Route 22 flat, section 8; Route 7 terraces and stairs, section 10). Nothing else converted.

Owner decisions (2026-10-16, after the first report):
- **Scale: plan B.** The island shrinks about 2x linear (his drawn map is a rough outline only). Every connection stays, hero routes get longer.
- **Roads: mockup width by default, varied by context.** Trunk roads and gateways 2 game cells (6 at a gateway meeting an old road), bigger trails where a route is busy, small 1 cell trails, and spotty broken patchy nature paths (single dabs of path with gaps, pilot 2). Never one width for everything.
- **Next pilot: cliffs and stairs** (done, section 10). Mountains are 2 to 4 level plateaus with switchbacks, a pass and cave mouths as in section 5.
- **Engine edits approved and applied**: the `src/adv-world.js` edits and the region cliff change in `src/adv-render.js` (section 3, "Engine changes"). The runtime shim is gone.
- **Deferred**: cottage stays exterior only, and the visible seam around converted windows is accepted for now.

## 1. How the world is produced today

| Thing | Where it lives |
|---|---|
| Generator | `tools/adv-gen-region.py` (127 KB, PIL + numpy, deterministic). Reads his three 3640 x 4240 maps (terrain, routes, locations), classifies biomes, rasterises roads, adds props and decorators per place (`tools/adv-towns/<code>.json` for hand-laid towns). Spec: `docs/REGION.md`. |
| World | 33 x 38 chunks of 32 x 32 cells = 1056 x 1216 cells. `data/adv/world.js`: palette (22 mats), water list, groups, `blank` (531 sea chunks drawn as deep water), spawn, `towns`, `doors`, `buildings` (66, with interiors), `supply`. |
| Chunks | `data/adv/chunks/<cx>_<cy>.js`, 723 files, each `ADV.chunk(cx, cy, { h, mat, over, kind, deck, props })`. h = level 0..7, mat = palette index, over = overlay (tall grass), kind = stairs/ledge/deck, props = `[name, x, y]` in data px (cell = 32 px, doubled on load). Arrays are RLE strings. |
| Zones | `data/adv/zones.js`: an 8 x 8 cell block grid of ids (`route1` .. `route134`, 20 place ids, `wild`). Wild spawns, music, weather and the HUD name read it. Encounter tables: `data/adv/encounters.js` (generated from the bible by `tools/build-adv-encounters.mjs`), keyed by zone id. |
| Art | `assets/adv/exterior.png` (tiles and 546 props, built by `tools/adv-build-tileset.py`), `derived.png` (recolours and joins, `tools/adv-build-derived.py`), `interior.png`. Defs in `data/adv/tileset*.js`. Autotiling is by material: 13 roles (C N S E W NE NW SE SW iNE iNW iSE iSW) picked from the 8 neighbours ("same material"), `ADV.pick`, `ADV.autotile` in `src/adv-world.js`. Ground is drawn per cell by `ADVR.ground` (`src/adv-render.js`), cliffs by height from `ts.cliff`. |
| Buildings | `world.buildings`: exterior prop + footprint + interior (walk-in, roof cutaway, `docs/INTERIORS.md`). Town data, another agent's ground right now. |
| NPCs, trainers | `data/adv/npcs.js` (tile coords, scripts, trainer teams scale with badges). Wild mons: spawned by `src/adv-wild.js` from the zone table, tall grass is the `over` layer. |
| Warps | Only the Route 4 cave doors (`world.doors`) and building exits. Everything else is one seamless world. |

### The scale fact that decides everything
The lab and the game use different grids.
- Game cell = 32 art px (64 world px). Characters are about 25 art px tall.
- Lab cell = 16 art px. A lab person is about 1.6 cells tall.
- So **one game cell = 2 x 2 lab cells.** Tile pixels are already identical (both 1 art px per sheet px, `density` 1), so nothing needs rescaling. What differs is the grid: every lab map is drawn at twice the grid resolution of the game.
- Today's roads are 3 game cells wide (96 art px) and hedges, trees and rocks are sparse in 32 px cells. A lab road (2 lab cells, 32 px) is one person wide. The lab screenshots the owner loved are dense because the same screen holds twice as many cells in each direction.
- The lab tile set is 16 px dual-grid and 8 px quarter-composited (`maplab/render.py`). It cannot be expressed as the game's per-material 13-role autotile at 32 px. Baking is the only faithful route (section 3).

## 2. What the pilot proved
A 48 x 48 cell window of Route 22 (2304 game cells, 9216 lab cells) was rebuilt in the lab, exported to chunks, and runs in the game: baked ground, 1233 props with real outlines, working collision, tall grass encounters, a pond, a fence line, a cottage. Whole-window flood fill from the west gateway reaches the south gateway, the orchard, the campsite, the pond shore and the cottage front. Old vs new: `maplab/out/region-pilot/contact.png`.

## 3. Pipeline: lab map to game chunks, zone by zone

```
 design (maplab/maps/<zone>.py, Map API)  ->  lab lint (0 warnings)  ->  lab render (preview)
        -> tools/adv-region-export.py  ->  chunks + zones + region sheet  ->  tile lint  ->  reachability  ->  in-game shots
```

1. **Author** a zone as one or more lab maps (`maplab/maps/region_<zone>.py`, class `Map` from `build.py`; the pilot is the template). Rules on top of the v1 lint: every ground rect on even lab coordinates (a game cell is 2 x 2), roads 4 lab cells wide (6 at a gateway that meets an old 3 cell road), no ridges, fences count as things (a one cell margin so trunks and rocks never overlap a fence piece).
2. **Ground** is baked. The exporter renders the lab map with props, fences and actors removed (`R.render`), cuts it into 32 x 32 px game cells, de-duplicates (pilot: 298 unique tiles in 2304 cells), appends them to `assets/adv/region.png`, and writes a per-cell tile id into the chunk's new `bake` array. The renderer then draws exactly the lab pixels. Nothing is redrawn by script: tiles are crops of the real lab sheet render.
3. **Logic** per game cell comes from the 4 lab cells under it by majority: `rgWater` (blocks, animated water effects apply), `rgPath`, `rgGrass`; tall grass stays the real `over` layer (so wild spawns, ambushes and mount logic keep working) with the game's own tall-grass tile switched off because the lab grass is already in the bake.
4. **Heights and cliffs** (real heights, owner decision 2026-10-16; the flat bake plus blocked ring of the first Route 7 pass is retired). A plateau is a true raised level (`ch.h` > 0). The lab composite still supplies every pixel, but the exporter cuts it per screen cell and stores it the way the engine draws elevation: a plateau top of level h at lab/screen cell (gx, gy) becomes the data cell (gx, gy + h) with `h` = that level (the engine draws a top at screen row = data row - h); the face row (the plateau's bottom game row, whose south neighbour is lower) claims no data cell, its slice goes to the new `fbake` array of the top cell above it and `face()` draws it; a stairs opening (lab `S` on the face row) makes the lowland cell right below the face a stairs cell (`kind` 1, `h` = the lowland level); data cells nobody claims are void (`h` -1). Props on a plateau move down by 32 x level and carry `z` = 32 x level. Result: the player walks behind faces, the sun shadow falls off cliffs, `ADV.exitLevel` and `ADV.step` see the drop, flight and landing see the height, and stairs are the only way up (BFS verified). Map rules the exporter asserts: every drop is exactly one level; a plateau column is at least 3 game cells tall (top row, face row, and one more) and a row run at least 3 wide; an inner plateau keeps a 1 cell margin north and sides and 2 cells south (a top cell of the outer level below its face); game aligned rects/cells.
   Outline decision: the lab's terrain outline ring hugs the jagged cliff art and is part of the bake; the engine's rectangular `ADVR.outline` floated away from it, so it is skipped for baked cells and still draws for every non-lab cliff. Prop and water outlines are unchanged.
5. **Props**: each lab object keeps its pixel position (lab px = game data px), its art is cropped from the lab sheet into the region sheet with 2 px gutters, and gets a def: anchor at foot centre, `solid` by class (trunk box for trees, bottom 56 px for houses, small boxes for rocks, benches, barrels; walk-through for flowers, beds, mushrooms). Fence pieces are one prop per lab cell by connectivity (`R.FENCE`), no outline like in the lab.
6. **Buildings and doors**: a lab stamp (`house_red_c` ...) maps to a game `world.buildings` entry: footprint from `cover()`, the door cell from `build.DOORS` (front cell, lab px / 2), interior from a template per stamp family, exit at the door. Pilot cottage is exterior only (door sealed, nobody can enter): needs a template interior and a world.js entry, which is town data and was out of bounds this run.
7. **Wild areas**: zone ids stay; the window's zone blocks are re-pointed to the route. Tall grass beds are the encounter areas. Special spots (a pond with its own species, a nook) need sub-zone areas: `world.wild` exists (1 entry) but the spawner does not read per-spot tables yet.
8. **NPC and trainer slots**: lab `actors` (npc, mon, tile) are exported to `maplab/out/region-pilot/slots.json` in world cells. Wiring them into `npcs.js` (sprites from the Ranger set, rosters by badge band) is a second step per zone; not done for the pilot.
9. **Exits and neighbours**: the lab map declares gateways (cell, width); the exporter keeps the old road cells outside the window and heals dangling stubs (`PILOT['heal']`). Neighbour edge changes are listed per zone in the zone's report.
10. **Gates in the loop** (every zone, before it counts as done): lab lint 0 warnings; `py -3.12 -I tools/adv-tile-lint.py` (extended this run so region props and mats count: placement errors 0 for the pilot; one older rockGreyB error elsewhere is not from this work); the BFS reachability probe (section 8); `docs/TILE-QA.md` visual review (one Haiku pass per batch, results below); in-game shots at zoom 1 and 2.
11. **Re-runs**: the exporter always rebuilds from `maplab/out/region-pilot/backup/` (the generator output as it was on first run) and is idempotent. It drops every `rg*` prop it finds in a backup, so a backup taken after a run cannot double props. If the generator is re-run, delete the backup first or the exporter will resurrect old data (only delete it while the chunks are unpatched: deleting it after a run makes the next backup a patched copy; the Route 22 originals had to be restored from a clean snapshot once for that reason). `--revert` restores the original chunks and zones. The exporter takes a list of windows (`WINDOWS`), one lab map and one world origin each, sharing one region sheet. A zone block that belongs to a town (Goldacre, east strip of the Route 7 window) keeps its label; only wild and route blocks are re-pointed.

### Engine changes (applied 2026-10-16, owner approved)
`src/adv-world.js` (all additive, `node --check` clean):
1. `ADV.lookup` searches `window.ADV_TILESET_REGION` first (a sheet whose ids point into `assets/adv/region.png`).
2. `ADV.chunk` accepts `d.bake` (RLE) and stores `ch.bake = Int16Array` (two places: the load path and the object path).
3. `ADV.autotile`: `if (ch.bake && ch.bake[i] >= 0) tiles[i] = layer ? -1 : ch.bake[i]`; the existing `ch.gv` bump still invalidates the per-chunk ground bake.

`src/adv-render.js` (the region cliff change, two one-line conditions): the per-chunk ground bake loop in `gchunk` and the per-tile fallback in the base pass draw a cell when `h === 0` or when it is a void cell with a baked tile (`h < 0 && ch.bake && ch.bake[i] >= 0`). Nothing else changed: `ADVR.gchunk`, `groundCell`, the old cliff renderer (`top`, `face`) and `ADVR.outline` (the rectangular terrain outline for `h > 0` cells) are untouched and still draw every non-region cliff in the world. The lab's own contour outline is part of the bake.

`data/adv/tileset-region.js` (generated) now only registers the region mats with the world at load: append `rgGrass`, `rgPath`, `rgWater` to the palette, `rgWater` to `world.water`, `rgPath` to the derived `joins.path`, and start the sheet load.

Renderer changes still missing (not needed for the two pilots):
- Real engine heights (stairs `kind`, `fbake` face tiles, level shifted props) are only needed for zones that want occlusion by height (walking behind a face). The flat ring approach covers every mockup-style plateau, so this is deferred unless the owner wants parallax.
- `ADVR.wade`: lab tall grass is baked, so the "grass over the feet" redraw is gone; either bake a wade strip per tall-grass cell or draw it from the region sheet.
- Lab water is a static baked tile; the game's water mats animate. Either bake the frames (`def.frames`) or keep game water for open water and bake shores only.
- A few scripts compare material names (`'path'` in adv-scene.js, adv-wild.js); give region mats an `as: 'path'` alias or accept the difference.
- Side sheets: the exporter asserts main-sheet props only. Cave, desert, items and cherry sheets (stall variants, cave mouths, chests, desert set) need adding to the sheet packer.
- Lint: cut-off, bleed and density checks run on the three known sheets; they need the region sheet registered (placement already is).

## 4. Redesign principles (owner's "genuinely good design" rule)
- Keep: where every town and route sits, the connection order, biome identity (his terrain map). Change freely: zone footprints, road paths, where a route bends, loops, shortcuts, sizes.
- Routes stop being straight corridors. Each gets: two or three bends, a distinct middle (biome or landmark shift), a loop or side pocket, a framing (tree wall, cliff, water) so the camera always sees a boundary, at least one view point that reads from afar.
- One point of interest about every 15 s of walking (about 75 game cells at run speed): see section 6.
- Wild land between zones becomes forest, mountain or shore, never open plain. The bake of tree walls at a window edge doubles as the zone border, so every route is a framed corridor.
- Road width varies by context (owner decision): 2 game cells (4 lab) for ordinary trunk roads, 3 at gateways and town streets (6 lab cells where a gateway meets an old 3 cell road), bigger 3 to 4 cell trails on busy routes, 1 cell trails to secrets, and spotty broken nature paths (single path dabs with gaps, skipping cells, as in the pilot 2 trail). Never one width everywhere.

## 5. Mountains (the owner noticed they look "really funny")
Today they are a grey blob with banded heights (visible in the region preview): no readable silhouette, no path up, cliffs that do not match the lab art. The quality bar is `maplab/maps/mountain.json` (the highland pass, `maplab/shots/mountain.png`).
- **Layered plateaus**: massif at level 1, summit block and outcrops at level 2, up to 4 in the big ranges. Outlines are irregular (faces of unequal height, notches), never rectangles; every plateau has a rim row, a top, and a 2 row face (that is one game level).
- **Real cliff tileset only**: the lab rock set (3 x 4 plateau: rim, middle, face start, face), grass or snow variants (`CLIFF['highland']`, `['snow']`, `['rock']`), the terrain outline ring. No thin rim lines, no mesa blocks.
- **A way up, always**: valley path to the foot, switchbacks along the face (path, stair pair 2 lab cells wide, path, stair pair), stairs cut into the face (`S`), a ramp where the biome wants one. Every walkable pocket has a way out (flood fill, as the generator already asserts).
- **Passes and valleys**: two massifs with a green valley between them carry the route; the pass narrows to a 2 to 3 cell gate with boulders and a sign.
- **Cave mouths** are stamps on a face (`cave_brown`, `cave_grass`, `cave_desert`) leading into the existing cave rooms; the Route 4 cave and the Frostfall climb reuse this.
- **Readable from above**: pines and spires on the rim, boulder clusters at the foot, snow caps on the top level, one landmark peak per range. Highest level darkest, lowest lightest; no more than 2 levels visible on one screen above the player.
- **Neighbours**: foothills ramp (level 1 shelves with grass) into the forest instead of a hard blob edge.
Mountain and cliff zones depend on the renderer cliff change above, so they come after the first flat zones.

## 6. Points of interest on routes
A catalogue the zone painters pick from (all real lab stamps and props; cave and desert items need the side-sheet packer):
- **Lone buildings**: berry farmer or orchard keeper cottage (pilot), ranger station, rest house with a bench and a lantern, fisher hut with a dock, sawmill shed on Route 3, beekeeper hut on Route 22/Combee country, signal hut on the highway. Doors always on a path, interior template per stamp, one NPC with a bible-grounded line.
- **Small landmarks**: ruined arch or gate (pilot: `arch_wood`), shrine and torii (`torii` stamp), campsite (logs, bench, woodpile), lookout bench on a ledge, signpost tree, standing stone cairn, produce stall (pilot), drinking basin, boat on a shore.
- **Secrets**: a clearing behind a tree wall reached by a 1 cell trail (pilot campsite), an item ball or chest (chests from the items sheet), a flower ring, a hidden ledge with a bush gate once the skill exists.
- **Trainer spots**: a sight line down a straight, a bridge, a gate. 3 to 5 per route, themed (docs/TOWNPASS.md).
- **Pacing rule**: never two of the same kind in a row, one rest spot (bench plus lantern) per route, one view per route.
Pilot Route 22 holds six: cottage + stall at the junction, orchard (fenced, pink and orange trees, tall grass under them, a fenced gate lane), pond for a fisher, campsite nook, ruined gate in the meadow, a rest bench.

## 7. Order, effort, risks

### Scale of the job
Roads, towns and landmarks: 540 000 cells (4028 + 4420 zone blocks of 64), plus about 110 000 cells of wild land, so roughly 650 000 land cells = 2.6 million lab cells = about 1500 lab route screens (52 x 32). The pilot window was 5.5 lab screens.

### Order
1. Flat, building-free routes first, one per biome, to harden the exporter: Route 22 (done, orchard), Route 13 (trails), Route 12, Route 10 (lakeside), Route 9 (road to Salt Bay), Route 1.
2. Water routes after the water decision (Routes 6, 8, 14, 24).
3. Towns last per place with the building agent's work merged, in the existing `docs/TOWNPASS.md` order, each with its routes: Salt Bay, Longshore, Tradeway, Pinegrove, Spindlewood, Sporehaven, Duskmoss, Quiet Plain, Claystone, Hallowmead, Aldermere, Sailsport, Fernwell Park, Sanctuary, Dunereach, Statue of Umbra, Frostfall, Sprucevale, League.
4. Mountains and cliffs (Routes 4, 16, 17, 19, 21, Frostfall, the ranges) once the cliff renderer change lands.
5. Goldacre and Routes 5, 7, 8 (already hand-decorated) last, redone for consistency.

### Honest effort (my estimates; the pilot itself took one long session including the exporter)
- Pipeline hardening (cliffs, water frames, buildings and doors export, side sheets, tall grass wading, NPC wiring, lint): about 6 to 8 focused sessions.
- One pilot-sized unit (48 x 48 cells, hand-authored with a template library) is about a half to one session. Keeping today's area needs about 280 such units. That is not realistic by hand.
- Realistic plan A (keep size): build a macro painter so filler (forest walls, meadows, road splines, orchard-type fields, shores) is generated from templates and only landmarks and POIs are hand-placed: about 60 to 80 sessions all in.
- Realistic plan B (CHOSEN by the owner 2026-10-16): shrink the island about 2x linear (4x area, 160 000 land cells, about 70 units), keep every connection, and lengthen only the hero routes. Then about 25 to 35 sessions. This also answers "huge, empty": a Gen 4 route at game density is about 60 to 100 cells, not 200.

### Risks
- The generator rewrites chunks. Anything patched must be re-applied by the exporter after a generator run (or the generator skips pilot windows). Backups are first-run only.
- Seam against old terrain: old tiles are a different texture (hazy 32 px grass, wide roads). The framing forest hides most of it, and the full conversion removes it. Until then every converted window has a visible border.
- Town agents edit `world.js` and town chunks; the exporter asserts the window touches no town zone block and no building footprint, but it rewrites whole chunk files, so run it only when no one else is mid-edit on those chunks.
- Palette is 8 bit (max 255 mats). Baking stays inside it because ground uses 3 region mats and the per-cell id lives in `bake` (Int16); do not go back to one mat per baked tile.
- Sheet size: 298 tiles for 2304 cells (13 percent); the whole island would be about 90 000 unique tiles at that ratio, too big for one sheet. Needs tile reuse by design (fewer ground variants, fewer random decor tiles) or per-region sheets streamed with the chunks. Decision needed before the second batch.
- Performance of 1200+ props per 48 x 48 window (dense forest). The island at this density would be about 600 000 props; chunk streaming handles it, but draw cost near forests needs a check on a weak machine.
- Collision resolution: logic is per game cell (majority of 4 lab cells), so a pond edge can differ from its drawn shore by half a game cell.
- Multiplayer: props, mats and zones are data, so peers need the same chunk files (host-owned world), nothing in the net protocol changes.

## 8. Pilot as built: Route 22, "the orchard road"
- Window: world cells x 840 to 887, y 464 to 511 (chunks 26_14, 27_14, 26_15, 27_15; zone blocks aligned to 8). Zone `route22` across the window.
- Gateways: west, world rows 465 to 467 (matches the old 3 cell road end); south, world x 864 to 866 at y 511 (matches the old road). Three dangling old road cells (837 to 839, 468 to 470) are healed to grass. Both neighbours checked in game (`new-gateway-west.png`, `new-gateway-south.png`).
- Shape and size changed on purpose: the old route was a 9 cell wide diagonal staircase through bare grass; the new one is an S-shaped road with a jog at the orchard, a second jog south of the cottage lane, and side lanes. Size kept at 48 x 48.
- Points of interest: orchard keeper cottage (door onto a lane, real `house_red_c` outlined stamp, sealed door for now), produce stall with crates and sunflowers, fenced orchard (about 35 fruit trees, tall grass beds under them, gate lane, rest bench and basin at the gate), pond with rocks for a fisher, campsite nook off a 1 cell trail (logs, bench, woodpile, cairn), ruined arch in the west meadow, signs at both gateways.
- Files: `maplab/maps/region_pilot.py` (design, lint 0 warnings), `tools/adv-region-export.py` (exporter, `--revert`), `data/adv/tileset-region.js` (generated, shim and defs), `assets/adv/region.png` (generated), `index.html` (one script tag after adv-world.js), `tools/adv-tile-lint.py` (region sheet registered for placement checks, backup of the original in `maplab/out/region-pilot/backup-adv-tile-lint.py`), `tools/.cache/cdp-shot-pilot.mjs` (big-viewport shot tool using the current zoom key).
- Checks: lab lint 0 warnings; tile lint placement 0 errors for region content; reachability BFS over the window at 32 world px steps with the real `ADV.blocked` (south gate, orchard, gate lane, campsite, pond shore, cottage front, east meadow all reachable; stall and house footprints correctly solid).
- Haiku review (TILE-QA gate 3), three in-game shots: no stray pixels, no scale mismatch, no depth faults, nothing out of place for a Gen 4/5 game. It flagged "dirt patch with hard edges" under the cottage and at the orchard lane: those are the game's sun-cast building and tree shadows on the road, not tile seams. Cut-off notes were the screenshot frame only.
- Shots: `maplab/out/region-pilot/` (`maplab.png` lab render, `old-window.png`, `new-window.png`, details, `contact.png` 1600 wide, `slots.json`).
- Not in the pilot, on purpose: cliffs and height changes, enterable interior, NPCs and trainers (slots exported), per-spot wild tables, water animation.

## 9. Open questions
Answered by the owner: size (plan B), road widths (varied), second pilot (cliffs and stairs), engine edits (approved), cottage (exterior only for now), seam (accepted), mountains (2 to 4 level plateaus with switchbacks, pass, cave mouths).
Still open:
1. Do you want real vertical depth (walking behind a cliff face, props and trees drawn by height) or is the mockup look with flat collision (section 3, point 4) right? Depth needs `fbake` face tiles and level shifted data per zone; flat is what pilot 2 ships.
2. Cave mouths: the lab stamps (`cave_grass`, `cave_brown`) are art only. Give each a real warp into a cave room (the Route 4 doors exist) or keep them as sealed scenery until an interior exists? Pilot 2 has none, to avoid a fake door.
3. Route 7 as built is a gentle terrace pasture, not a mountain. Which route is the first real mountain (Eastern Ridge or Northern Massif) now that the cliff pipeline exists?
4. NPC and trainer slots (both pilots export them to `slots.json`) are not wired into `data/adv/npcs.js` yet: wire them next, or keep adding zones first?

## 10. Pilot 2 as built: Route 7, "the grazing country"
- Window: world cells x 240 to 303, y 928 to 975 (64 x 48 cells, chunks 7 to 9 by 29 to 30, zone `route7`; the east strip x 296 to 303 below y 936 is a Goldacre zone block and keeps that label, no town building is inside).
- Gateways: west, world rows 933 to 935 at x 240 (matches the old 3 cell road); north, world x 291 to 296 at y 928 (6 wide, matches the old road, which bends north east beyond). Both connect to the old road in game (BFS probe).
- Terrain: a level 1 terrace (19 x 17 cells) with a pond, a stone circle and tall grass; a second level 1 shelf east of it; a level 2 knoll on top with the shepherd's hut; a small ridge plateau in the east with a footpath. Three stairs cells (game cells, lab `S`): terrace south face to the first terrace, a switchback path along the terrace to the knoll stairs on the knoll face, and the ridge stairs. Every face drops exactly one level, rects are game aligned.
- Roads and trails: a 2 cell trunk loop round the hill with 6 cell gateways, a 2 cell climb on the terrace, a 1 cell footpath on the ridge, and a patchy nature trail of single path dabs with gaps (south lane towards the east tall grass).
- Points of interest: shepherd's hut on the knoll (real `house_wood_c` outlined stamp, door on the path to the knoll stairs, exterior only), lookout with bench, lantern and sign beside the hut, the stone circle on the terrace (spires, boulders, cairn), a pond, a rest spot at the east end of the south lane (bench, lantern, barrel, crates, sign), two wind turbines on the north meadow (the game's own animated `pxTurbine`, kept because the old Route 7 was turbine country), a stock fence along the trunk, ridge footpath.
- Engine: REAL HEIGHTS since 2026-10-16 (section 3, point 4): the first pass of this pilot used a flat bake with a blocked ring, it was converted and re-verified (BFS with the stairs masked reaches no cell above level 0: 0 of 405 level 1 and 0 of 112 level 2 cells). Shots of the conversion: `new2h-window.png`, `new2h-corner.png`, `new2h-stairs.png`, `new2h-knoll.png`.
- Files: `maplab/maps/region_pilot2.py` (design, lab lint 0 warnings), `tools/adv-region-export.py` (now multi window), `maplab/out/region-pilot/probe2.js` (the reachability probe, run with `cdp-shot-pilot.mjs jsfile=`).
- Checks: lab lint 0 warnings; `tools/adv-tile-lint.py` 1 error, the old `rockGreyB` one elsewhere (region content is clean); in-game BFS with the real `ADV.step` and `ADV.blocked` from the west gateway: reaches both gateways and the outside road beyond each, the hut door front, the knoll top, the ridge top and the pond shore; masking the three stairs cells the knoll, the hut front, the ridge top and the terrace interior are unreachable (so the stairs are the only way up, and they work); 164 ring cells are blocked.
- Haiku review (TILE-QA gate 3): first pass found no seams, black or wrong-colour squares, broken cliff edges, or stair gaps that fail to connect, and the hut door faces its path. It flagged trees overlapping the cliff face at the terrace south east corner and the ridge face (real: two forest blocks straddled the faces, moved below them and re-exported) and a ridge footpath that "ends at a tile" (it ends at the ridge stairs, reachable in the probe). A small sprite on the hut path is the player follower. The fix was checked by eye in the new shots, not by a second Haiku pass.
- Shots in `maplab/out/region-pilot/`: `maplab2.png` and `maplab2-1x.png` (lab render), `old2-window.png`, `new2-window.png` (2112 x 1600), details `new2-stairs.png`, `new2-knoll.png`, `new2-ridge.png`, `new2-pond.png`, `new2-gateway-north.png`, and `contact2.png` (old vs new plus two details, 1600 wide). `contact.png` is still pilot 1.
- Not in pilot 2, on purpose: cave mouths, a real mountain, NPC wiring, interior for the hut, vertical depth.

## 11. Pilot 3 as built: the Eastern Ridge (first real mountain) and its cave
- Window: world cells x 808 to 871, y 416 to 463 (64 x 48 cells, chunks 25 to 27 by 13 to 14, zone `route21`; no town building, no old NPC inside). Lab map `maplab/maps/region_ridge.py`, plateau masks `maplab/maps/ridge_shapes.py`.
- Shape: two massifs from noisy-ellipse masks (median filtered so stairs fit, cleaned so no column is under 3 cells tall or row under 3 wide), nested for levels 1 to 3: the west massif reaches level 2, the east massif level 3. Outlines are jagged on the 32 px grid, so the hills read as stepped terraces rather than smooth curves; a smoother look needs half-cell cliff art that the lab sheet does not have.
- Switchbacks and pass: a trail from the south road to the east massif foot stairs, onto the level 1 shelf, shelf stairs (east end) to level 2, a cap stair to the level 3 summit; the west massif has foot and summit stairs. A 3 wide pass road runs between the massifs from the trunk north to the ranger hut meadow; west gateway (world rows 447 to 452 at x 808) and south gateway (world x 825 to 833 at y 463) meet the old roads.
- Points of interest: ranger hut (`house_wood_c`, exterior only) with a woodpile, logs and crates, a lookout on the west plateau (bench, lantern, sign), cairn and spires on the east summit, a pond with a patchy nature trail, camp bench and lantern on the east shelf, five tall grass beds on real levels (valleys, shelf, summit).
- Cave: stamp `cave_brown` on the level 2 shelf face (no silhouette outline), a door in the generated `data/adv/tileset-region.js` (the lab map's `doors` entry; the exporter derives the door line and its level, `end` 's'). Room `data/adv/rooms/ridge-cave.js` from `maplab/maps/region_cave1.py` (28 x 20 game cells, lab cave sheet `cave_brown` art, a pool, crystals, stalagmites, rock islands): drawn at 2x (nearest upscale of the lab render, props doubled) so it matches the 2x interior art at room scale 1; 2 x 2 chunks at chunk (326, 0); mats `i_cave_dark` (blocked), `i_cave_floor`, `rgWater`; one exit at the south edge, `dark` 0.5. It uses the existing room system: `ADV.room`, `world.doors`, `doorAt` (push north into the stamp), exit cells and `doorFor`. Not a live room (no wild mons in it): `tools/adv-check.mjs` asserts exactly one live room (the Route 4 cave), so `ADV.openRoom` now loads a non-live room lazily on its first visit.
- Engine edits this pass (approved files only, `node --check` ok): `adv-world.js` (`loadRoom` passes `bake`/`bakes`; lazy `openRoom`), `adv-render.js` (a baked cell draws its region sheet tile whatever its mat, so a cave room's interior mats do not pick the wrong sheet; `face()` draws `fbake`; baked cells skip the generic rim, stairs overlay and engine outline).
- Checks: lab lint 0 warnings for both maps; `adv-tile-lint.py` 1 error, the old `rockGreyB` one (region content clean); in-game BFS from the west gateway (real `ADV.step`, `ADV.exitLevel`, `ADV.propHit`): both gateways, the hut front, the pass, the pond reachable at level 0; shelf, mouth front, both level 2 tops, the summit and the west summit reachable; masking the 10 stairs cells leaves 0 reachable cells above level 0 (all 1893 level 0 cells stay). Cave: pushing north at the mouth front enters the room (spawn inside), walking south onto the exit cells returns the player just below the mouth at level 1, both verified in the browser. Void (hidden data cells) 96.
- `tools/adv-check.mjs`: the trainer "sees the road" check now accepts `rgPath` as a road. It still stops at `r7-gus`, because Route 7's three trainers (gus, dolly, ike in `data/adv/npcs.js`) stand where the old road was; moving them is part of NPC wiring (not done).
- Haiku review (TILE-QA gate 3): flagged stepped terraces (accepted, see Shape), shadow boxes under cliffs (the engine sun shadow, intended), a crate stack overlapping a cliff corner (real: moved), the black rock tops and rectangular pool in the cave (the lab cave style, kept), and HUD overlays and snow at the neighbouring map edge (not defects). Not re-reviewed after the crate move.
- Shots in `maplab/out/region-pilot/`: `maplab3.png` and `maplab3-1x.png` (lab render), `maplab-cave1.png`, `old3-window.png`, `new3-window.png` (2112 x 1600), `new3-mouth.png`, `new3-summit.png`, `new3-m1.png`, `new3-pass.png`, `new3-cave.png`, `cave-in.png`, `cave-out.png`, `contact3.png` (1600 wide).
- Remaining owner questions: wild Pokemon inside the ridge cave (needs a live room, which changes `adv-check` and shares the cave with other players)? A smoother plateau outline (needs new cliff art)? NPC and trainer wiring for Routes 7, 21 and 22 is the next step; the ridge has lab actor slots in `slots.json`.
