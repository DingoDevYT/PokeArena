# P1: Outfit customiser

Decision (Landon): recolour + swap parts, true Gen 4 style, built from existing HGSS overworld sheets (assets/trainer-ow, 8-dir versions in assets/trainer-ow8 from tools/build-trainer-diagonals.py).

## Bodies and parts
- 4 base bodies from protagonist-style sheets (boy and girl, two builds each; e.g. ethan, lyra and two others with clean silhouettes). Each body's 8-dir walk sheet is split into layers by palette region: skin, hair, hat, top, bottom, shoes, bag, outline/eyes (fixed). The diagonal rows of the 4 base bodies get a hand-tuned pass (fix the generator's messy step frames frame by frame) since every player wears them.
- Part library: hairstyles, hats (cap, beanie, sun hat, none...), tops, bottoms, bags taken from other HGSS trainer sheets whose head/body sit on the same 32 x 32 template; each part stored per body with an offset so it lines up on all 8 directions and 4 frames. Parts that do not fit cleanly are dropped, not forced. Target at least 6 hairstyles, 5 hats (incl. none), 5 tops, 4 bottoms, 3 bags per body.
- Recolour: each layer is stored as one PNG per shade step (2-4 shades, white on transparent). At draw time each shade image is filled with the chosen ramp colour via `source-in` on a small offscreen canvas and composited in layer order. No getImageData anywhere (file:// safe). Cache composed sheets per outfit.
- Colour choices: per layer a ramp picker of about 16 Gen 4 style ramps (dark to light, picked from HGSS palettes), skin has 6 ramps.

## UI
New game step after naming (replaces the avatar picker for the overworld body; the battle portrait stays the Profile avatar): left = live preview walking in all 8 directions (rotating), right = rows Body / Hair / Hair colour / Hat / Hat colour / Top / Top colour / Bottom / Bottom colour / Bag / Skin, with randomise and confirm. Also reachable later from a mirror in the player's house in their hometown (any house room works for now via a "Change outfit" option in the pause menu until hometown houses exist).

## Data
`save.outfit = { body, hair, hairC, hat, hatC, top, topC, bot, botC, bag, bagC, skin }` (small ints). Online: sent once in the hello/player state so others see the same outfit. Built by tools/build-outfits.py into assets/outfits/ + data/adv/outfits.js.

## Checks
A contact sheet tools/.cache/outfits-contact.png: every body x every part in all 8 directions, plus 12 random outfits walking. Look at it at 4x and drop or fix parts that float, clip or misalign.

# P2: Ranger parts creator (decision 2026-10-15, replaces P1's HGSS sources)
Landon chose a full parts creator built from the Pokemon Ranger rips (tools/.cache/ranger/*.gif, labels in tools/.cache/ranger/labels/, cut and packed by tools/ranger-cut.py). The HGSS bodies and their generated diagonals are retired: he called the generated diagonals awful. Same model as P1 (save.outfit small ints, white shade planes filled with source-in, composed sheet cached per outfit, no getImageData), new art.

## Bodies
- Base bodies are Ranger characters with REAL walk frames in down, a down diagonal, side, an up diagonal and up (mirrored for the other side). Candidates: Lunick (lunick-lunick), npc1 townsfolk (downLeft walks drawn), Fall City rangers (downLeft/upLeft walks). Solana has only a run. At least one boy and one girl body; more if they fit.
- Every body frame comes from the labelled cells exactly as tools/ranger-cut.py pack places them (head-aligned, the 1 px step bounce, mirror2 front/back steps). Reuse its functions; do not re-derive placement.
- Cell size follows the art (Ranger frames are about 35 px tall), not P1's 32 x 32. ADVO must take fw/fh from data/adv/outfits.js instead of hard-coded 128 x 256 and 32 px rows.
- Idle: each body also gets idle.<dir> rows (stand + breathing frame where drawn) so the player breathes when standing, as NPCs do.

## Layers and parts
- Split each body by its exact palette into layers: outline/eyes (fixed), skin, hair, top, bottom, shoes, plus hat/bag where drawn. Each shade of a layer becomes one white plane. A colour belongs to one layer per body; decide by looking at 8x, never by guessing from hue alone.
- Parts library: hair, hats, tops, bottoms, bags lifted from other Ranger characters drawn on the same template as the body (same sheet family, same height and head position: check frame by frame at 8x). A part must line up in every direction and every walk and idle frame; one that floats, clips or misses frames is dropped, not forced. Target at least 5 hairstyles, 3 hats + none, 4 tops, 3 bottoms, 2 bags per body, fewer if the art doesn't fit.
- Pixels stay exact: no resampling, no filtering, no redrawn pixels except removing the old layer under a swapped part (the base body's hair is cut out where a new hairstyle covers it, as P1 does with the hat's cover plane).

## Checks
tools/.cache/outfits-contact.png: every body x every part, all 8 directions, walk and idle frames, at 4x; plus 12 random outfits walking as a GIF. Look at both and fix or drop what is wrong. adv-check and adv-net-check pass (old saves with P1 outfit ints must still load: clean() maps out of range values to defaults).
