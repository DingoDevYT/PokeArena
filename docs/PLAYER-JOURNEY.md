# A player's first hours in Adventure

Mapped on 2026-11-05 from two full playtests (phone and desktop, about 95 minutes and 2 hours, by agents playing as a new player through the real menus), a level-design tour of every town and route, and an automated run of the whole main story. What went wrong is listed with what changed; the times are what the testers measured.

## The path

| Step | Time | Before the overnight fixes | Now |
|---|---|---|---|
| Title to the world | 2 to 3 min | Smooth. Battle was the default mode, Online the default way to play, 6 of 16 hometowns hidden on a phone, a tip that called a gym city "the easiest place to start". | Adventure and Offline are the defaults, all 16 towns on one screen, the tip says any town works because everything matches your badges. |
| Opening scene | 3 to 5 min | Warm and short (Linden, Mum, Ethan, the rival battle). A wrong pronoun, a page holding only "over his head.", speakers off screen after the fight, once a player left wedged inside the Pokemon Center. | Fixed: pronoun, sentence paging, speakers step up beside you, a fight outside a door stays outside. |
| First goal | 1 min | NEXT GOAL pointed at the gym but never said what level you needed (a bug hid the line), so new players walked into a Lv12 trainer at Lv5 and lost in 15 seconds. | "Train your team to about Lv 12 (best: Lv 5)" shows until you are ready; the pin follows Linden herself. |
| Training to the first gym | was 40 to 90 min, 4 blackouts | Wild packs of 2 to 5 joined each fight; a Lv3 Bounsweet came with Solar Beam; a pack charged the moment a level-up panel closed; skittish herds outran a walking player forever; Longshore had nothing a Normal starter could hurt. | One wild mon per fight before the first badge (two before the second); weak first moves for every wild mon; 3 to 6 s of calm after any menu or fight; skittish mons tire and rest where a walker can reach them, with a one-time tip to run; Krabby, Wooloo and Mareep are passive. EXP before the first badge is x1.1. About 10 wild fights from Lv5 to Lv12. |
| First gym | was 3 to 5 min fights, many losses | Trainers Lv12 to 14, Whitney 14/14/15, Miltank's Rollout through the barn wall, a 280 second fight that went nowhere. Forfeit said "your team fainted". | Trainers Lv9 to 11, leaders 11/11/12; Rollout stays inside; forfeit says you gave up; prizes in their own box with a little badge fanfare; gym signs name the ace's type. |
| After the badge | | NEXT GOAL names the next gym and its bearing (from Goldacre the next is 249 tiles east). Story beats wait in the next towns (survey, Soot, Ethan, Chad). | Same; the story line now leads the goal panel with the next gym under it ("Also: Pinegrove Gym, E 249 tiles"). |

## The middle (two badges to four)

Mapped from the fourth playtest (phone, 76 minutes, a fight bot that plays below a good human) and its fixes.

| Step | Before | Now |
|---|---|---|
| Leaving Tradeway after badge 2 | Linden points you at Spindlewood (E 238 tiles). Packs of three Lv18-20 Zubat (Supersonic, both Grass moves resisted) beat a Lv23 Ivysaur twice. | Packs stay at two mons until the fourth badge. |
| Route 111 to Spindlewood | Teamster Dale (Lv19-20, three mons) beat a team 8 to 12 levels higher; fights ran 90 to 215 s and the camera let them drift under the phone's buttons. | Route trainers use a gentler CPU before the third badge; the fight camera follows the fighters past the fight box; a hit's stat drop stops at -2. |
| The docks (Jet) | Four mons at the next gym's levels straight after a grunt; three losses at Lv32-37; after each blackout nothing said what to do, the goal pointed where you stood, and winning a gym in between grew her team. | Three mons two levels down; the wake-up text and NEXT GOAL say she is still there and to step out of town and come back; her team stays at the stage the scene opened. No money lost for a must-win story fight. |
| Gym 3 (Sporehaven) | Won at Lv32-37 (Orrin 132 s, Fern 63 s, Rue 138 s). Inside, the goal panel kept the story line and covered Rue on a phone. | Inside a gym, NEXT GOAL shows the gym's steps in a short panel. |
| Money | Eight blackouts cost about $6400 of $8000. | A blackout costs a tenth, at most $1000. |

Still open from it: gym 4 (Claystone) is 336 tiles north of gym 3; the docks scene starts on Spindlewood's west road rather than at the docks; trainers standing in a gym hall can cover a fight.

## The late game (badge five to the Champion)

Mapped from the fifth playtest (phone, 104 minutes from badge 5 through the Champion and the post-game, levels set by eval at each stage) and its fixes.

| Step | Before | Now |
|---|---|---|
| Gyms 6 and 7 | Six-mon leaders at 36-38 and 40-42; fights ran 200 to 500 s. Thorn's Gogoat reached Attack +5 with Bulk Up and swept five mons; his Leafeon fought from outside the hall walls for minutes. | Indoor fights have no floor outside the hall; CPU boosts stop at +2; a CPU mon heals at most twice; HP eases to 80% by Lv50 (late fights about a fifth shorter). |
| Jet at Dunereach, Soot and Inkwell at the Statue | Each brought a full six-mon team a band above the gyms; no level hint; the tower climax fired 24 tiles out, in Dunereach's fields, with no tower or grey sky. | Boss teams of 5 (stage 6) and 6 (stage 7); NEXT GOAL names the boss's level; the Statue scenes fire within 12 tiles and the Statue lies under a grey gloom while the door is open. |
| Losing a boss | Woke at the last Center; at a landmark the goal said "still in Statue of Umbra, step out of town" 84 tiles away. | The goal reads right everywhere; a story fight lost at a landmark wakes you there. |
| Ethan's Pebble (Shadow Tyranitar) | Showed as a plain Tyranitar; a prize-money line followed the scene. | Plate says SHADOW TYRANITAR with a dark outline; no prize line. |
| The League | Two outdoor fights; losing to the Champion sent you 341 tiles back; the win was a prize line, four lines and a Master Ball. | Ethan at the foot of the plaza, then the Elite Four up the plaza (Fenn, Bram, Odile, Hale; no healing between but the bag, a loss starts them over), then the Champion at the hall door. You wake at the foot of the plaza after a loss; becoming Champion opens a Hall of Fame (your team, then the credits). |

A desktop keyboard pass (sixth playtest, 79 minutes) confirmed the night's changes: one wild mon before the first badge, the gentler route trainers, the fight camera, corner correction at doors (4 of 4), the stat caps, gym fights staying in the hall, and every must-win story fix. Early fights take 5 to 35 s and feel good; at three badges 50 to 130 s, decided mostly by status moves. It found the blackout save and the one-Enter forget bug (both fixed), and the missing Controls page in Adventure (added).

Still open from it: the post-game beats point at Shadow Pokemon and a tower dungeon that do not exist yet; gym 8 (Bjorn) was not played; three sign pairs still disagree; money has nothing to buy in the late game.

## What players liked

- Character creation and the opening scene: about five minutes from title to the first battle, and the writing gives a reason to set out.
- NEXT GOAL and the minimap: always clear where to go. Signs at every exit say which route starts there and where it leads.
- Indoor gym fights with the roof off, trees and buildings going see-through in fights, the item wheel that slows time, Run away and Forfeit from the battle menu.

## Still open

- The second gym is far from some starts (249 tiles from Goldacre); the map is fixed by the region's layout.
- Phone fights still sit partly under the right-hand buttons in large rooms.
- The desktop camera is about 10 tiles wide at Normal (the default Landon picked); one wheel notch out shows 13.
- Story bosses after a badge (Soot, then Jet with four mons at the next gym's levels) are a real step up; a must-win loss now restarts at that battle, not the whole scene.

## Fixed after the third playtest

- Status after a fight is named once the text boxes close, with the cure. Signs at both ends of a road agree on its routes. Lakes and the sea no longer show a grid of deep and shallow squares; snowfield grey patches and Route 103's shore look finished; the Route 4 west cave opens out of a cliff.
- After a blackout the fainting lines come before the EXP pages, and the game saves at once. A tap on a forget-move row asks for a second tap. Wild mons outside your fight are faint.

Reports in full: the session scratchpad's reports/playtest.md and reports/playtest2.md (not in the repo).

## The first hour on a phone, again (seventh playtest)

A new player on a phone (Aldermere City, Pikachu, 60 minutes, touch only) reached Lv10 with 7 blackouts and never met the first leader. What changed:

| Problem | Now |
|---|---|
| The pre-selected hometown, Aldermere City, is 46 tiles from the nearest wild Pokemon; every blackout walked you back. | New games highlight Goldacre (grass at the gate); the four cities far from wild Pokemon are tagged "GYM *". |
| Ten levels to the first gym at about one level per 2 to 3 minutes; wild starters two levels over your own. | EXP before the first badge is 1.5x; before it, no wild Pokemon tops your best. |
| Fighters 15 to 25 px tall, lost under forest canopies and hit sparks. | A faint copy of each fighter is drawn over trees, roofs and effects; more of each tree fades. |
| Smokescreen and Sweet Scent stacked to -3 and -6. | Status-move drops stop at -2 like hits. |
| Every Save was a .sav download on Android. | Save saves on the device; Save files exports or loads a .sav. |
| Tiny menus: pause rows 22 px, move chips with 4 px type text. | Two columns of 40 px rows on the phone's pause menu; bigger move names only. |

Checked by the eighth playtest (Goldacre, Charmander, touch only): the first leader fight began 52 minutes after the title screen and the badge came at 57, with 2 blackouts, both in the first 12 minutes (a Growth-boosted Oddish and a charging Miltank, since softened). Lv5 to Lv13 took about 30 minutes and 18 wild wins; the tester beat Whitney at Lv14. Fighters stayed visible in town, in the gym and in a dense wood.

## The second hour (ninth playtest)

From a save just after the first badge in Goldacre (Charmeleon Lv17, Hoppip Lv12), touch only: the second badge came 67 minutes later (about 45 to 50 for a person; the rest was the tester's scripts), with 2 blackouts and one story loss.

| Step | What happened | Now |
|---|---|---|
| Goldacre Mart | One tap on the first row bought the $4000 Bike. | A tap picks a row, a second tap buys; - and + set the amount on a phone. |
| To Pinegrove (274 tiles east) | 3 to 5 minutes on the Bike; no fights or scenes on the way. | Same. |
| Pinegrove: Surveyor, Soot, Ethan | Good writing; three bad matchups in a row for a Fire starter. After losing to Soot he vanished from NEXT GOAL and the town. | Soot's first fight brings two mons; a lost talk scene stays on screen and in NEXT GOAL. |
| Training | About 15 wild fights a level at 0.71x EXP; trainers gave 300 to 400 EXP. | 0.92x EXP at one badge. |
| The Mart's lower rows | Super Potion and Full Heal could not be reached by touch. | Long lists scroll with a finger. |
| Aspen | Won at Lv20 after NEXT GOAL said "Challenge Aspen!". | Gym hints are one level lower; one short says "Close enough to try". |

