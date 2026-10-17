# Sun shadows (Adventure overworld)

Decided with Landon on 2026-10-15/16. Code: the "sun shadows" section of `src/adv-render.js`.

## Decisions
- The sun crosses the north sky (southern hemisphere): shadows point west in the morning, south at noon and east in the afternoon. It is up from 6:00 to 19:30.
- The game clock runs 1 day in 24 real minutes (1 game hour = 1 real minute), on the local clock or the server clock online. The sun angle steps every 10 game minutes, so shadow pixels never crawl.
- Shadows are one flat pixel-art tone with hard edges. Their colour shifts with the time of day: cool blue at midday, warm purple near sunrise and sunset. They fade out when the sun is low (below 20 degrees) and under a dark veil.
- Face shading only. Cliff faces and building fronts face south, away from a north sun, so they go one step darker at midday. There are no normal maps.
- Night darkens every outdoor area (the existing stepped light-ring veil). Your light radius and glowing props light it.

## How it works
- **Casters**
  - Cliffs: every run of raised cells is a block (h - L) tiles tall over each lower level L.
  - Buildings (props with `door`, or a `CAST` entry): boxes. The footprint is the sprite moved down by the wall height, swept along the sun, so the shadow starts flush at the base.
  - Squat solid props (rocks, bushes, barrels, crates: their collision rect is at least half their width): volumes, cast the same way as boxes. Their wall is half their drawn height.
  - Everything else with a solid rect, or taller than 24 px (trees, posts, signs): its sprite silhouette, sheared from its lowest opaque pixel, so a trunk's shadow starts where the trunk meets the ground. Its trunk (the columns reaching the bottom 8 rows) also casts as a short 8-row volume, so the shadow hugs the roots on every side.
  - Characters and mons: their current frame. `drawFrame` records it during a pre-pass.
- **Masks**
  - There is one mask per receiving level, held in screen space for that level.
  - Level 0 is laid after the ground pass. Higher levels are laid run by run inside each row strip, before the faces.
  - Something standing on level Lp also casts into every lower mask, with the extra height added. Where that lands on higher ground it is hidden. The gap it skips always lies inside the cliff's own shadow, so the union is right without ray tests.
- **Cost**
  - Static masks (cliffs, props) are cached for a region around the view. They are rebuilt when the sun steps or the view leaves the region: about 2 ms of JavaScript.
  - Entities are redrawn every frame: about +1 to 2 ms a frame in total.
- **Standing in shade:** `shaded(X, Y, L, self, hh)` follows the ray from a point toward the sun. It reports shade when that ray passes under a raised cell, through a box, or behind a cut caster's opaque pixel standing higher than the point (the exact inverse of the shear that drew that shadow).
  - Props are dimmed as a whole, tested at their foot, and never shade themselves.
  - People and mons are dimmed per 2 x 2 art px block, each block tested at its own height (`shadeSprite`). A body half in a shadow's edge is half dark, and a short thing south of you never darkens your head.
  - Other entities' shadows do not dim anyone.

- **Weather and lamps:**
  - `src/adv-weather.js` (ADVWX) scales the sun shadows (`light().sun`) and adds dimming (`light().veil`).
  - Lamps glow whenever it's dim: night, or rain and storms. A faint glow pool stays on bright days. The tileset's lamp posts carry no glow data, so `ADVR.GLOW` gives them one.
  - Godrays were tried and removed (2026-10-16, his call).

## Water (`src/adv-water.js`, ADVWA)
Decided 2026-10-16: wobbly pixel mirror; reflects people and mons, props, sky and clouds, lamps at night; sun glints, shore foam, depth shading, ripples round swimmers; anyone standing in water is half submerged (game and map lab).
- Only open water: level 0, not under a bridge deck, outdoors. The mask is the water pixels of each tile (colours matched against the material's centre tile), so shore art inside an edge tile is never painted over.
- Order: ground, then depth, reflections, foam/ripples/glints, then the level-0 sun shadows. Lamp streaks go on after the dark veil, added light.
- Reflections: the sky colour for the hour and weather plus drifting white clouds, props mirrored about their foot, sprites from the record pre-pass mirrored about their foot (or their waterline). Tinted to the water's main colour, rows shifted 0 or 1 art px in a slow wave, 45% over the water.
- Depth: the mask eroded on a half-res grid; bands at 8 and 20 art px from the shore, each edge dithered on a checker.
- Submerged: `drawFrame` asks `ADVWA.line()`; a sprite whose foot is in open water at ground height is cut 42% up its body, the rest drawn at 30%, with a pixel ring at the waterline. Blob shadows are skipped on water.
- Cost: about 1.5 ms a frame in headless Chrome without a GPU. The mask and depth are cached until the box, the water frame or the loaded cells change.

## Known limits
- Bridge decks receive no shadows. The shadow lands on the ground under the deck.
- Wall heights are guessed as 45% of the sprite's anchor height. Add `ADVR.CAST[name] = ['box', wall]` where a prop reads wrong (the fountain and the well already have entries).
- Shadows have no sun in caves or interiors. In fights, only the static shadows show; fighters keep their own shadows.
