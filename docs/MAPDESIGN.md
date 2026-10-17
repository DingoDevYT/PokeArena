# Map design rules (Landon, 2026-10-15)

- Routes: long and open in length (2+ minutes running), but laid out Gen 4 style, bigger: clear paths framed by tree walls, cliffs and water, with side pockets, loops and optional areas. No wandering off anywhere.
- Paths 2-3 tiles wide on routes; towns get wider paved streets. No 4+ tile roads.
- Points of interest about every 15 s of running: a clearing, a bushwalk trail, a specific pond / river bend / grove with its own spawns, a sign, an item ball, a trainer, a landmark, a rest spot. Size is fine; emptiness is not. Design and content fill it.
- Special spawn spots: a pond, tree, nook or patch can hold its own species. Extra species beyond the route's bible table are allowed if they fit the zone (open 931 dex), but the route table stays the main spawn source.
- Towns: never a street grid. Lived-in layouts: lanes that bend, buildings at varied spacing and facing, yards, fences, gardens, a centrepiece, landmarks the bible names.
- Cliffs by biome: real-tileset rock cliffs (multi-tile faces, ledges, rounded corners, no thin rim lines) in mountains and on the coast; low grass-topped ledges in farmland and plains. No mesa blocks.
- Edges and corners must join correctly (paths, water, tall grass, cliffs). The tile lint seam check enforces this (docs/TILE-QA.md).
- Travel: all manual, nothing teleports. Full rules in docs/TRAVEL.md (shoes from the start, bike at any Mart, riding skills per mount kind, free-flight Fly, classes and impromptu teachers, the Sailsport-Aldermere supply path).

## Look and feel v2 (Landon 2026-10-15: "do a better job than how they look and feel currently")
What the current maps get wrong, seen in docs/shots (t8-*, s2-*, r103-*), and the rule that replaces it. Every pass is judged against this list.
- Staircase diagonals: roads, cliffs and shorelines that run diagonally are drawn as 1-tile square steps (t8-r103-c). Diagonal runs must use the tileset's diagonal/curve edge tiles, or bend in long straight segments joined by proper rounded corners. No sawtooth edges anywhere.
- Rectangle patches: paving, sand and grass areas are hard rectangles dropped on the ground (t8-centre, t8-west). Plazas and yards get shaped outlines: rounded corners, inset steps, borders (kerb, flower bed, fence, hedge) so every surface change has a reason and an edge.
- Empty ground: large flat stretches with a few random props (t8-centre sand, r103 grass). Fill by composition, not scatter: clusters (tree groups with undergrowth, rock outcrops with flowers, fenced gardens), paths of props that lead the eye, and dense framing walls of trees/cliffs at the edges of the playable area. Rule of thumb: every screen at the default camera has at least one focal point and its edges are framed.
- Prop scatter: single flowers, rocks and bushes sprinkled evenly read as noise. Props come in families placed with intent (a flower bed along a house front, rocks at a cliff foot, logs by a river, lamps along a street at even spacing).
- Towns: buildings must face streets with yards, fences, gardens and a front path from the door to the street; streets bend; the centrepiece sits where the main streets meet. No building floating on bare ground.
- Water: shores use the real water edge tiles with sand or grass, curved; docks, rocks and reeds at the edge. No square water chunks.
- Variety along a route: the route's middle must look different from its ends (biome shift, a landmark, a change of framing). Two screens in a row must never look the same.
- Camera: the default camera is pulled far back (owner's ask), so layouts must read at that distance: bigger shapes, clear paths, landmarks visible from afar.
