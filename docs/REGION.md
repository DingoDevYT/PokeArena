# Kenora region build spec (R1)

Owner: Opus. Source of truth for places and lore: Landon's region bible (69-page PDF; text at tools/.cache/kenora-bible.txt, gitignored, never commit it since the repo is public) and his maps in C:\Users\lando\Desktop\dungeons-pokemon\MAPS (read-only):
`KENORA REGION W- TERRAIN ONLY.png`, `W- ROUTES.png`, `W- LOCATIONS.png` (all 3640 x 4240, same framing).

## Approach
The whole island is generated from his maps by a build tool, then key places get hand-authored detail on top. One seamless world. Sea outside the island = ocean (missing chunks render as deep water, not void).

## Scale
1 tile = 3.5 map px (S = 1 / 3.5 tiles per px). A route like Route 5 comes out about 200 tiles long (about 40 s running). Island about 900 x 1000 tiles.

## Places (coords in map px of the 3640 x 4240 images; derived from a 858 px thumbnail x 4.2424, so accurate to about +/- 10 px; snap to the marker found in LOCATIONS)
| code | name | x | y |
|---|---|---|---|
| G1 | Dunereach | 1175 | 1200 |
| G2 | Sprucevale | 2673 | 1285 |
| G3 | Fernwell Park | 895 | 1803 |
| G4 | Claystone | 1718 | 2024 |
| G5 | Aldermere City | 2991 | 2015 |
| G6 | Pinegrove | 2092 | 3033 |
| G7 | Goldacre | 1048 | 3084 |
| G8 | Sporehaven | 2198 | 3479 |
| T1 | Frostfall | 1947 | 1324 |
| T2 | Sailsport | 3156 | 2473 |
| T3 | Hallowmead | 2388 | 2473 |
| T4 | Tradeway | 1595 | 2694 |
| T5 | Salt Bay | 467 | 2783 |
| T6 | Spindlewood | 2605 | 2906 |
| T7 | Longshore | 395 | 3364 |
| T8 | Duskmoss | 2707 | 3674 |
| L1 | Statue of Umbra | 1010 | 933 |
| L2 | Fernwell Sanctuary | 581 | 1604 |
| L3 | Pokemon League | 2677 | 904 |
| L4 | Quiet Plain | 1701 | 3895 |

Route label positions (map px; the route is the road line nearest the label):
1 (1790,3640) 2 (2036,3279) 3 (2079,2855) 4 (1867,2694) 5 (1251,2919) 6 (594,3373) 7 (959,3258) 8 (967,2893) 9 (662,2783) 10 (882,2622) 11 (967,2316) 12 (895,2011) 13 (895,1680) 14 (755,1604) 15 (1022,1243) 16 (1379,1196) 17 (2087,1188) 18 (2520,1277) 19 (2673,1103) 20 (2698,1510) 21 (2889,1633) 22 (2987,1824) 23 (3008,2198) 24 (3021,2363) 101 (2422,3487) 104 (2244,2630) 105 (2601,2338) 106 (2783,2138) 111 (2329,3038) 121 (1171,1039) 131 (2185,2198) 132 (1939,2083) 133 (1527,2002) 134 (1209,1905).
Route 4 is a cave (the grey rock blob); build its entrance and exit only for now.

## Generator: tools/adv-gen-region.py
Python (PIL + numpy), run `py -3.12 -I tools/adv-gen-region.py [--only G7]`. Deterministic (fixed seed). Writes data/adv/chunks/*.js, data/adv/world.js and data/adv/zones.js, replacing the test world (keep tools/adv-build-testworld.mjs working for tests by writing to a different folder, data/adv-test/).
1. Biomes: classify TERRAIN ONLY pixels into sea, beach, grass, meadow (light green blobs), forest (dark green tree icons/blobs), rock (grey dots), mountain (grey slopes), snow (white), desert (yellow scrub area), water (lakes and rivers), fungal (pink Sporehaven). Sample the exact palette first; print the colour -> class table.
2. Roads: pixels in ROUTES that differ from TERRAIN ONLY and match the dark teal line colour = road centrelines. Rasterize to tiles, dilate to a 4-tile-wide path (material path; in towns pavingStone). Assign each road tile a zone id by flood fill from the nearest route label (above). Non-road land tiles get the zone of the nearest road tile within 60 tiles, else 'wild'.
3. Water: sea, lakes and rivers become water (deep in the middle, shallow at the edges, beach sand ring on the sea coast). Rivers stay at least 4 tiles wide; a road crossing a river gets a bridge deck 2 levels up with ground under it.
4. Heights: mountain tiles get levels 1-6 from distance into the mountain mask (quantized, so cliff bands follow the slopes); the Eastern Ridge, Northern Massif foothills and Route 7 edges ("ground beginning to rise") get scattered 1-level plateaus from a fixed noise field. Roads flatten what they cross; where a road meets a level change put stairs (2 wide) in the road direction. Towns are flat. Never leave a walkable pocket with no stairs out (flood-fill check; fix by adding stairs).
5. Props (names from data/adv/tileset.js): forest = dense trees with small clearings (species by biome: green pines and oaks in the south and west, layered/spruce in the ridge, snow trees on snow, palms on beaches, cacti and dead trees in the desert, mushroom stumps and darkConeTree in fungal); scattered rocks on rock biome; flowers and bushes along road edges; tall grass patches (overlay tallgrass) on route verges and meadows, 15-30 % of verge area in blobs of 20-200 tiles. Never place solid props on roads, doors, stairs or within 1 tile of a door.
6. Towns: each place gets a flat disc (radius 28 tiles towns, 40 gym cities, 18 landmarks) with paving, a Pokemon Center and a Mart (or a building that stands in for it), 4-8 houses, a gym building in gym cities, fences and flowers, all doors facing a road. Hand-authored layouts in tools/adv-towns/<code>.json override the generated one when present.
7. world.js: `{ name: 'Kenora', chunksW, chunksH, fill: 'waterDeep', palette, spawn (Goldacre Center door), towns: { G7: { name, x, y, center: { x, y } }, ... } }`. zones.js: `window.ADV_ZONES = { cells: <per-chunk RLE or a coarse 8x8-tile grid>, ids: ['route5', ...] }`.
Chunk arrays are RLE strings to keep files small (`"12x3,5,0x40"` style; decode in ADV.chunk).

## C1: Goldacre + Routes 5, 7, 8 detail (spec)
Mechanism: per-place and per-zone decorators in the generator (tools/adv-towns/G7.json for the town layout; zone decorator functions route5/route7/route8 in the generator), so re-running the generator keeps the detail. Everything stays reachable (the flood-fill assert still runs).
- Goldacre (bible: open pasture, crop fields, fence lines, barns, silos, "a great deal of sky"; clean and kind, no Umbra): a farm town, not a street grid. A village green around the Pokemon Center and Mart, a few thatch and red houses spread out along dirt lanes, a big red barn as Whitney's gym (barnRed, gym door, sign "GOLDACRE GYM - WHITNEY"), a dairy yard with fencePenWood pens next to the gym, 2-3 silos, crop field plots (soilTilled rows with crop props, hayField), hay bales and crates, a farmhouse for Whitney beside the barn. Signs at each road exit naming the route.
- Route 5 (open fields, safest road): road with hedgerows (hedgeLong) BOTH sides the whole way, crop fields beyond them, no fences, no gates, no signs about ownership. Gaps in the hedge every 30-50 tiles so you can walk into the fields. Wild Miltank graze here (add miltank to the route5 day table as rare alongside bouffalant if not present).
- Route 7 (grazing country): bigger and rougher, open pasture with no hedges, ground rising and breaking up at the edges (1-2 level plateaus with stairs, rocks), and wind turbines along the ridgelines visible from far away (at least 8).
- Route 8 (river bottom): water meadows, willows (use the most willow-like tree, or draw one), wet ground (shallow water patches, swampy grass), the river with BOTH a ford (a band of shallow water you can wade, slower walking) and a bridge 300+ px apart. Bidoof/Bibarel dams: log piles (fallenLog, logShort) across small channels.
- New art (Gen 4 style, same pixel density and outline style as the exterior sheet, drawn as PNG pixel art by script, appended into assets/adv/exterior.png via tools/adv-build-tileset.py so they live in the same sheet): windTurbine (tall white tower about 6 tiles high, 3 blades, 4 animation frames for the spin; the engine needs prop animation: `frames: n, fps` on a prop def, frame k = source rect shifted right by k*sw), silo (round metal grain silo with a dome cap), cropCabbage and cropWheat (1 tile crop props, walk-through), haybale (round, solid), willowTree, scarecrow. Show each on the contact sheet.
- Encounters: wild spawns inside Goldacre itself use the bible's Goldacre "Encounters - proposed" table (pasture / crop / farmyard / night), already in data/adv/encounters.js as the G7 zone. They spawn only in the fields and pastures around the town, never on the paved green or lanes between houses.

### C1 as built
tools/adv-towns/G7.json (paving, buildings, props relative to the town centre) plus decorators in tools/adv-gen-region.py: crop plots (`fields`), Route 5 hedgerows with gaps (`hedges5`), Route 7 ridges with stairs and turbines (`stairs_pass`, `turbines`), the Route 8 river with a bridge, a ford at its 30th tile downstream, backwater channels with log dams, willows. All art is real (Chaotic sheet and the community sheets, see docs/ENGINE.md art policy); tools/adv-build-tileset.py builds the `ford` and `wetGrass` mats as plain recolours. Missing art: silos. A prune pass in the generator drops props whose solid overlaps another or that stand within a tile of a door (hedges and fences excepted). `--nogap` (dev) places hedges without gaps so a sealing check can run. The Goldacre encounter zone covers a 52 tile radius so the fields use its table.

## Hand detail pass (after the generator works)
Goldacre (G7) and Routes 5, 7, 8 get a hand-authored layout pass from the bible: open pasture, crop fields (soilTilled, hayField), fence lines, barns, silos; Route 5 hedgerows both sides, no fences or gates; Route 7 rougher grazing land, rising broken ground at the edges, wind turbines on the skyline (no turbine prop exists: draw one in the Gen 4 style, animated blades). Whitney's gym is a big barn.
