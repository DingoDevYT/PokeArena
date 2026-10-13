# Banned moves

PokeArena only runs moves whose effects the real-time engine understands. Everything else is switched off.
Banned moves stay in each Pokemon's learnset in `data/dex.js`; the team builder just hides them.

- Moves any Pokemon in the roster can learn (all generations): **827**
- Allowed: **676**
- Banned: **151**

The rule: attacking moves are allowed unless they are one-hit KOs, bounce damage back, call other moves, or depend on
items, sleep, or the rest of the team. Status moves are allowed only when they raise or lower stats, heal, cause a status
condition or confusion, set weather or terrain, lay a supported hazard or screen, or are one of a short list of
hand-picked moves (Protect and friends, Haze, Defog, Leech Seed, Taunt, Roar, Belly Drum, Pain Split and so on).

"Learned by" counts how many of the 1173 species and forms in the roster can learn the move (megas not counted), so the top rows are the biggest losses.

| Move | Learned by | Why it is banned |
|---|---:|---|
| Sleep Talk | 1151 | Only works while asleep (no sleep-acting) |
| Substitute | 1149 | Needs a decoy HP system |
| Snore | 1015 | Only works while asleep (no sleep-acting) |
| Attract | 840 | Infatuation not supported |
| Helping Hand | 621 | Doubles-only move |
| Natural Gift | 546 | Depends on held Berry |
| Curse | 501 | Does different things for Ghost types (not supported) |
| Fling | 423 | Depends on held item |
| Mimic | 419 | Copies a move (not supported) |
| Psych Up | 362 | Copies stat changes (not supported) |
| Counter | 275 | Reflects damage taken back (needs damage history) |
| Bide | 250 | Stores damage over turns, then releases it |
| Laser Focus | 240 | 'laserfocus' effect not supported |
| Trick | 217 | Swaps held items (not supported) |
| Imprison | 214 | 'imprison' effect not supported |
| Magic Coat | 212 | 'magiccoat' effect not supported |
| Torment | 210 | 'torment' effect not supported |
| Baton Pass | 208 | Passes boosts on switch (not supported) |
| Spite | 208 | Custom effect not supported |
| Encore | 203 | Forces move repeats (not supported) |
| Ally Switch | 202 | Doubles-only move |
| Telekinesis | 188 | 'telekinesis' effect not supported |
| Trick Room | 186 | Field effect 'trickroom' not supported |
| Last Resort | 185 | Needs every other move used first |
| Skill Swap | 171 | Custom effect not supported |
| Snatch | 162 | 'snatch' effect not supported |
| Nature Power | 153 | Calls another move |
| Gravity | 149 | Field effect 'gravity' not supported |
| Metronome | 148 | Calls another move |
| Role Play | 148 | Custom effect not supported |
| Block | 141 | Trapping not supported |
| Recycle | 139 | Restores used items (not supported) |
| Worry Seed | 125 | Custom effect not supported |
| Refresh | 121 | Cures own status (not supported) |
| Disable | 116 | Disables a move (not supported) |
| Wonder Room | 112 | Field effect 'wonderroom' not supported |
| After You | 110 | Doubles-only move |
| Embargo | 104 | 'embargo' effect not supported |
| Magnet Rise | 101 | 'magnetrise' effect not supported |
| Nightmare | 92 | 'nightmare' effect not supported |
| Heal Bell | 83 | Cures the whole team (not supported) |
| Wish | 83 | Delayed heal on a later turn |
| Mud Sport | 82 | Field effect 'mudsport' not supported |
| Foresight | 81 | 'foresight' effect not supported |
| Fissure | 80 | One-hit KO move |
| Wide Guard | 79 | Doubles-only move |
| Quick Guard | 78 | Doubles-only move |
| Destiny Bond | 77 | Faint-linked effect (not supported) |
| Memento | 77 | User faints (sacrifice move) |
| Copycat | 72 | Calls another move |
| Guard Swap | 72 | Custom effect not supported |
| Magic Room | 72 | Field effect 'magicroom' not supported |
| Power Swap | 72 | Custom effect not supported |
| Coaching | 71 | Doubles-only move |
| Water Sport | 71 | Field effect 'watersport' not supported |
| Mirror Coat | 70 | Reflects damage taken back (needs damage history) |
| Stockpile | 69 | Stockpile system not supported |
| Beat Up | 66 | Depends on the whole party |
| Belch | 66 | Needs a Berry eaten first |
| Aromatherapy | 65 | Cures the whole team (not supported) |
| Aqua Ring | 64 | 'aquaring' effect not supported |
| Quash | 64 | Custom effect not supported |
| Swallow | 64 | Needs Stockpile |
| Mean Look | 63 | Trapping not supported |
| Switcheroo | 63 | Swaps held items (not supported) |
| Spit Up | 62 | Needs Stockpile |
| Dragon Cheer | 60 | 'dragoncheer' effect not supported |
| Teleport | 58 | Switch-out move (not supported) |
| Healing Wish | 56 | User faints (sacrifice move) |
| Lucky Chant | 55 | Side effect 'luckychant' not supported |
| Celebrate | 54 | Does nothing |
| Odor Sleuth | 54 | 'foresight' effect not supported |
| Venom Drench | 54 | Custom effect not supported |
| Gastro Acid | 53 | 'gastroacid' effect not supported |
| Perish Song | 53 | Faint countdown (not supported) |
| Ingrain | 51 | 'ingrain' effect not supported |
| Me First | 51 | Calls another move |
| Heal Block | 47 | 'healblock' effect not supported |
| Heal Pulse | 47 | Heals the target (opponent in 1v1) |
| Soak | 47 | Custom effect not supported |
| Splash | 45 | Does nothing |
| Parting Shot | 43 | Switch-out move (not supported) |
| Bestow | 41 | Custom effect not supported |
| Mirror Move | 39 | Calls another move |
| Entrainment | 34 | Custom effect not supported |
| Grudge | 33 | 'grudge' effect not supported |
| Mind Reader | 32 | Sure-hit lock-on not supported |
| Follow Me | 31 | Doubles-only move |
| Camouflage | 30 | Custom effect not supported |
| Guard Split | 29 | Custom effect not supported |
| Power Split | 29 | Custom effect not supported |
| Speed Swap | 28 | Custom effect not supported |
| Acupressure | 27 | Custom effect not supported |
| Metal Burst | 27 | Reflects damage taken back (needs damage history) |
| Rage Powder | 26 | Doubles-only move |
| Horn Drill | 25 | One-hit KO move |
| Lock-On | 25 | Sure-hit lock-on not supported |
| Psycho Shift | 25 | Custom effect not supported |
| Rototiller | 24 | Custom effect not supported |
| Strength Sap | 24 | Custom effect not supported |
| Assist | 23 | Calls another move |
| Sheer Cold | 23 | One-hit KO move |
| Simple Beam | 22 | Custom effect not supported |
| Aromatic Mist | 19 | Doubles-only move |
| Power Trick | 18 | 'powertrick' effect not supported |
| Corrosive Gas | 17 | Custom effect not supported |
| Guillotine | 17 | One-hit KO move |
| Happy Hour | 17 | Custom effect not supported |
| Miracle Eye | 16 | 'miracleeye' effect not supported |
| Reflect Type | 15 | Custom effect not supported |
| Ion Deluge | 9 | Field effect 'iondeluge' not supported |
| Magnetic Flux | 9 | Custom effect not supported |
| Trick-or-Treat | 8 | Changes the target's type (not supported) |
| Crafty Shield | 7 | Side effect 'craftyshield' not supported |
| Spotlight | 7 | Doubles-only move |
| Stuff Cheeks | 7 | Needs a Berry (not supported) |
| Comeuppance | 6 | Reflects damage taken back (needs damage history) |
| Spider Web | 6 | Trapping not supported |
| Flower Shield | 5 | Custom effect not supported |
| Tidy Up | 5 | Clears hazards and boosts in one (not supported) |
| Hold Hands | 4 | Doubles-only move |
| Conversion | 3 | Custom effect not supported |
| Conversion 2 | 3 | Custom effect not supported |
| Electrify | 3 | 'electrify' effect not supported |
| Mat Block | 3 | Side effect 'matblock' not supported |
| Powder | 3 | 'powder' effect not supported |
| Shed Tail | 3 | Switch-out move (not supported) |
| Topsy-Turvy | 3 | Inverts stat changes (not supported) |
| Chilly Reception | 2 | Switch-out move (not supported) |
| Forest's Curse | 2 | Changes the target's type (not supported) |
| Gear Up | 2 | Custom effect not supported |
| Heart Swap | 2 | Swaps stat changes (not supported) |
| Revival Blessing | 2 | Revives a fainted teammate (not supported) |
| Take Heart | 2 | Cures own status (not supported) |
| Clangorous Soul | 1 | Pays HP for its boosts (HP cost not supported) |
| Court Change | 1 | Swaps field effects between sides (not supported) |
| Decorate | 1 | Doubles-only move (would boost the foe in 1v1) |
| Doodle | 1 | Copies an ability (not supported) |
| Fairy Lock | 1 | Field effect 'fairylock' not supported |
| Fillet Away | 1 | Pays HP for its boosts (HP cost not supported) |
| Floral Healing | 1 | Heals the target (opponent in 1v1) |
| Instruct | 1 | Makes the target repeat its move (not supported) |
| Jungle Healing | 1 | Heals the whole team (not supported) |
| Lunar Blessing | 1 | Heals the whole team (not supported) |
| Lunar Dance | 1 | User faints (sacrifice move) |
| Magic Powder | 1 | Changes the target's type (not supported) |
| Octolock | 1 | Trapping not supported |
| Purify | 1 | Heals the target (opponent in 1v1) |
| Shell Trap | 1 | Needs a turn-order trap trigger |
| Sketch | 1 | Copies a move permanently (not supported) |
| Teatime | 1 | Needs Berries (not supported) |
