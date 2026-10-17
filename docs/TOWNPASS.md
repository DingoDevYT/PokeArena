# Town pass (repeatable, one place + its routes per run)

Goldacre (G7) + Routes 5/7/8 is the reference: tools/adv-towns/G7.json, data/adv/npcs.js, data/adv/rooms/, docs/REGION.md "C1", docs/ENGINE.md "S1a/S1b as built". Every other place gets the same treatment, one place per run, in this order:
T5 Salt Bay (+ Routes 9, 10), T7 Longshore (+ Route 6), T4 Tradeway (+ Route 4 cave), G6 Pinegrove (+ Routes 3, 111), T6 Spindlewood, G8 Sporehaven (+ Routes 2, 101), T8 Duskmoss, L4 Quiet Plain (+ Route 1), G4 Claystone (+ Routes 132, 133, 104), T3 Hallowmead (+ Routes 105, 131), G5 Aldermere (+ Routes 22, 23, 106), T2 Sailsport (+ Route 24), G3 Fernwell Park (+ Routes 11, 12, 13, 134), L2 Fernwell Sanctuary (+ Route 14), G1 Dunereach (+ Routes 15, 16, 121), L1 Statue of Umbra, T1 Frostfall (+ Route 17), G2 Sprucevale (+ Routes 18, 20, 21), L3 Pokemon League (+ Route 19 Victory Road).

## Per run
1. Read the place's location file and its routes' files in tools/.cache/kenora-bible.txt (identity, gym category, leader, NPC hooks, encounters, open threads). Build ONLY what the bible states; flavour lines are fine, invented lore is not. Bible "OPEN" items stay open: do not resolve them, leave neutral placeholders and list them in the report.
2. Layout: tools/adv-towns/<code>.json hand layout (not a grid), themed props, signs at road exits; props only from real tilesets (docs/TILE-QA.md; never script-drawn). Route decorators in tools/adv-gen-region.py for the place's routes so their terrain matches the bible's description.
3. Buildings: Center, Mart or its local equivalent (bible: "a general store, a specialist trader, a single stubborn shopkeeper"), 2-6 houses, any special building the bible names, and the gym for gym cities. All walk-in true-size interiors with the roof cutaway (docs/INTERIORS.md S2, as built for Goldacre/Salt Bay/Pinegrove etc.), never separate room maps.
4. NPCs: 8-14 per town with bible-grounded lines; sprites from the Ranger set (data/trainer-ow-ranger.js; generic npc1-5 townsfolk with walk anims; story characters and Ranger uniforms only when the bible calls for them), HGSS sprites only for jobs Ranger has no match for (fisher with rod, clerk, nurse, delivery); 3-5 trainers per route themed to the route; gym: 2-4 gym trainers themed to the gym category, the leader with the exact Appendix A roster per band from data/adv/rosters.js and lines that follow the bible's character notes. Badge name: "<Town> Badge" placeholder.
5. Skills (no HMs, bible region rule): if the bible says this place teaches a Skill (Salt Bay: fishing and surfing; others as stated), add the teacher NPC and the skill: `save.skills`. Surfing lets the player walk on water (riding their lead if it can learn Surf, else a generic raft look), fishing = face water + use the rod key item to start a fight from the zone's fishing table. Other skills (rock climbing etc.) follow the same pattern: a key-item-free ability that unlocks a terrain kind; add the terrain gate in the generator for places the bible gates with it.
6. Music: map the place and its routes in data/adv/music.js to the closest existing track.
7. Checks: generator deterministic + reachability assert (skill-gated areas may be unreachable without the skill; the assert takes skills into account), adv-check door round trips for the new rooms, leader roster by band, any skill logic. Screenshots docs/shots/<code>-*.jpg (town centre, gym exterior, gym interior, each route) and look at each.

Map design rules (mandatory, docs/MAPDESIGN.md): long routes Gen 4 style with a point of interest every ~15 s, 2-3 tile paths, no grid towns, cliffs by biome.
QA gate (mandatory, docs/TILE-QA.md): no script-drawn art, tile lint passes, Haiku visual review of every new item batch.

Generator note: random props are seeded per chunk, so regenerate freely; to prove a place edit stays local, regenerate before and after and diff data/adv/chunks.
Also list every new room file in index.html (adv-check fails otherwise).

## Report (under 150 words)
What was built, bible OPEN items left open, new art, checks, screenshots, rough edges.
