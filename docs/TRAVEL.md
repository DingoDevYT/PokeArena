# Travel (Landon, 2026-10-15)

All travel is manual. Nothing teleports: no warp menus, no fade-and-arrive rides. Surfing, riding, flying and biking are faster or wider ways to cross the map yourself.

## Always on
- Running shoes: from the start (no NPC).
- Bike: bought at any Mart. Mount anywhere outdoors except tall grass and water.

## Riding (lead Pokemon + the ride button)
Riding needs a rideable lead AND the riding skill for that kind of mount. Each skill covers a set of species and what the mount can do:

| Skill | Mounts (examples) | Lets you |
|---|---|---|
| Rough Riding | Tauros, Mudsdale, Rhyhorn, Donphan, Bouffalant | Ride over rough ground (rocky scrub, mud) at speed; heavy mounts push through it |
| Cantering Riding | Rapidash, Ponyta, Zebstrika, Blitzle, Arcanine, Wyrdeer, Stantler | Highest ground speed on paths and open land |
| Bouldering Riding | Gogoat, Skiddo, Rhydon, Golem-line climbers, Sawsbuck | Climb marked rock faces (rock climbing) |
| Snow Riding | Mamoswine, Piloswine, Arcanine (Hisui), Avalugg | Cross deep snow without slowing |
| Dune Riding | Hippowdon, Sandaconda, Camerupt | Cross deep sand without slowing |

A species can belong to more than one skill; the best skill you know applies. Terrain a skill unlocks is gated in the generator only where that terrain exists.
Every mount does every kind of riding that makes sense for it (Landon 2026-10-15): Rapidash canters, rides rough ground and snow; Mamoswine rides snow, rough ground and boulders; Mudsdale rides rough ground, dunes and boulders. The full list is ADVP.RIDERS in src/adv-party.js. Any one of a mount's skills lets you ride it; on land it uses the fastest you know, and it crosses every special terrain any of its known skills covers.
Mount speed varies per Pokemon (ADVP.rideSpeed): the skill's base speed x its real Speed stat against a base-80 mon of the same level (0.88x to 1.12x) x its level (0.94x at level 1 to 1.02x from 50). A young, slow-natured Rapidash runs about 343 px/s, a level 60 Timid one about 397.

## Other skills
- Surf: walk on water riding a lead that can learn Surf (else a raft). Taught at Salt Bay (bible).
- Fishing: Salt Bay (bible).
- Fly: free flight over the map on a lead that can learn Fly: ignores ground collision, fast, casts a shadow, lands on any clear outdoor ground. No town list, no teleport.

## How skills are learned
- Classes: a teacher in a town (see placement below) teaches one skill for money plus an easy lesson (the timing minigame on easy).
- Impromptu teachers: wandering trainers on routes teach the same skills earlier or cheaper, for a harder price: a lot more money, the timing minigame on hard, or a longer task (a timed ride along a marked course).
- Every skill is teachable in at least two places across the region. Bible-stated teachers win (Salt Bay: fishing, surfing); everything else is placed by place identity and listed as a design choice.

## Sailsport and Aldermere
Aldermere is a city. The routes between Sailsport and Aldermere are real routes with a main trodden supply path used by people and Pokemon for supply runs. From the start, a Sailsport (and Aldermere) handler rents out a supply mount as a paid service (a fee per trip); you ride it yourself along that path. It only works on the supply path between Sailsport and Aldermere and returns home when you leave the path or arrive.

## Feel: momentum and the timing meter (2026-10-16, src/adv-mount.js)
Flying and riding are not walking faster. Both use one meter: two bars close in from the sides onto an icon (a Pretty Wing for flight, a Quick Claw for riding); press Space (A on a pad) as they meet. Perfect, good or miss.
- **Flying:** a flap lifts you (perfect more than good, a miss sinks you a little). You always glide forward and slowly sink; height is speed (about 130 px/s low, 570 at the top). Turning eases toward the stick, so turns are wide arcs, wider when fast; pushing against your heading brakes. Touching the ground lands you; over water or blocked ground you skim and are told to flap. G still lands on purpose. A high flier is drawn lower than its real altitude so it stays on screen.
- **Riding:** speed builds up instead of snapping to the top. Without bucking a mount cruises at 65% of its speed; a good buck adds a burst that decays, chained bucks hold a gallop (up to 135%), a miss costs 30% of your pace. Turns ease like flight but tighter. Running into something bleeds speed.
- **Gaps:** a good press at speed in front of a one-tile gap (water, a wall, a drop) with the same level open beyond it hops it.
- **Climbing:** a mount that knows Bouldering Riding, pushed against a rock face 1 to 3 levels high with open ground on top, climbs it after 2 good presses plus 1 per level; a miss slips you back and resets the count. Any rock face counts (no marked spots exist in the maps yet).
- Mounted, Space is the meter press, so E (Y on a pad) talks.
