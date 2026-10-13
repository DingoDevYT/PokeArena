# PokeArena design decisions (locked 2026-10-14)

Private fan game for Landon and friends. Real-time 2.5D Pokemon battles in PMD pixel art.

## Scope now
- Full roster (2026-10-14): every species 1-1025, their battle-relevant forms, and every mega/primal (Legends Z-A megas included). See docs/SCHEMA.md for what counts as a form. Trainer teams are still the Kanto ones.
- Battle game only: menus, team builder, arena fights against CPU trainers. No overworld.
- Browser, plain JS + canvas, runs from `index.html` on file://. Data baked by `tools/*.mjs`.

## Format
- 1v1, each side has a 6-mon team. KO all 6 to win. No timer.
- Vs CPU only for now, difficulty tiers easy / normal / hard / champion (same brain, different knobs).
- CPU opponents are canon Kanto trainers with Gen-1-only teams (Gold, Cynthia, Steven come with the bigger roster).

## Controls (standard gamepad)
- Left stick: move. Right stick: aim (360). Aim is remembered ~1 s after the stick is released, then follows movement.
- A / B / X / Y: the 4 moves, each on its own cooldown.
- LB: dodge roll (i-frames, own cooldown, Speed scales it). RB: hold for swap wheel, release to swap (cooldown, brief i-frames for the incoming mon).
- LT + RT together: Mega Evolve (once per match, needs the mon's Mega Stone).
- PC (locked 2026-10-14): WASD move, mouse always aims, LMB / RMB / Q / E = moves 1-4, Space or Shift dodge, 1-6 swap straight to that party slot, F Mega, Esc pause. Every menu is mouse-clickable (right-click = back, wheel scrolls/changes values).
- Holding a move button fires it the moment its cooldown ends; a press up to 0.3 s early is buffered.

## Rules translation
- Real stat formula with levels (set per mon, 1-100), natures, abilities, held items. No EVs/IVs (IVs fixed 31).
- Real damage formula, STAB, type chart, crits, weather, terrain. HP shown x7 (HP_MULT) times a level curve (hpScale: lv5-20 about x1.6, lv50 x1.07, lv100 x0.82) so low levels last longer and lv100 fights do not drag. All healing (moves, Leftovers, drain, abilities) is scaled by TUNE.HEAL_MULT 0.5, recovery moves have a 12 s cooldown floor, Rest heals 50% not full, Regenerator 20%. Damage scaled by FIGHT_SCALE so an even KO takes ~45-60 s.
- No accuracy dice. Moves are skillshots; low accuracy = smaller hitbox.
- No PP. Cooldown comes from PP (5 PP = long, 40 PP = short).
- Move behaviour table (locked 2026-10-14, round 4): every move a Gen 1 species can learn has an explicit entry in data/move-behaviour.js, decided from what the move IS (its description, how the games/anime show it), with a one-line reason each. Archetypes: projectile (optionally a fanned volley, gentle homing only for sure-hit moves like Swift), beam, laser, area, melee, dash, lunge, lob, strike, leap, trap, wave, hazard, self. The PMDO hitbox mapping is only a fallback; PMDO still gives each move its particle VFX, sound and PMD body animation. tools/sim-check.mjs fails if a learnable move has no entry.
- Lunges (Air Slash, Aerial Ace, Slash, Night Slash, X-Scissor, Leaf Blade, Wing Attack, ...) are short, very fast movement-tech rushes that cut anything within reach in front of the user. Not homing.
- Waves (Icy Wind, Hyper Voice, Sing, Supersonic, Powder Snow, ...) are wide fronts that roll forward from the user and hit once. Gust shoves; Whirlwind shoves hard and still drags the foe out (owner confirmed).
- Arena sweeps (locked 2026-10-14, round 5; arch 'sweep'): Surf, Muddy Water, Sludge Wave, Heat Wave, Earthquake, Magnitude, Bulldoze send a front across the WHOLE arena from beyond the edge behind the aim (snapped to the 4 axes), after a ~0.8 s flashing warning band with chevrons on the entry edge (pulled on camera if that edge is off screen). Each move sets its gaps (Surf 1, Muddy Water / Heat Wave / Bulldoze 2, Earthquake none: roll through on i-frames, Protect, or float over quakes), speed and push; they hit once, never the caster, and have 9-12 s cooldown floors. Combos: water/mud douses Fire traps and soaks the floor for 7 s (Electric hits harder, as in a puddle), quakes shatter rocks and leave cracks, heat burns tall grass and dries the floor, and the shove carries the foe into traps or hazards ahead.
- Field traps (locked 2026-10-14, round 4): status powders and clouds (Sleep Powder, Stun Spore, Poison Powder, Spore, Poison Gas, Toxic, Smokescreen, Sand Attack, Sweet Scent, Feather Dance, String Shot, Thunder Wave, Will-O-Wisp, Leech Seed) and lingering damage zones (Fire Spin, Whirlpool, Sand Tomb, Infestation, Twister, Leaf Tornado, Inferno, Blizzard, Hurricane, Smog, Electroweb, Grass Knot) are thrown to the aimed spot and stay there for a few seconds. The effect lands the moment the foe steps in and again every few seconds (damage zones tick faster) while it stays; normal immunities apply. A status cloud collapses once its status lands. Vortexes pull toward the middle, webs slow. Ground traps pass under hovering mons. One live trap per move per side. Drawn by src/fieldfx.js: dithered tint, pulsing hard-edged ring in the status colour, the move's PMDO sheets looping inside.
- Status moves are easier to land: 1.4x hitboxes, bigger areas, generous trap radii.
- Transform (Ditto/Mew, 'self' arch) shares `transformInto()` with Imposter: copies the foe's sprite, types, non-HP stats, ability, stages and moves (minus Transform, fresh cooldowns) until the user swaps out; HUD shows "DITTO (Charizard)".
- Moves the arena can't express yet (Metronome, Counter, OHKO, Perish Song, Baton Pass, ...) are banned and hidden until each gets a bespoke design. List: docs/BANNED_MOVES.md.
- Status in seconds: burn/poison/toxic damage over time, paralysis slows movement + longer cooldowns, sleep/freeze are short stuns that break on hit, confusion swerves movement. Flinch cancels a windup.
- Stat stages are real (+/-6) and last until the mon swaps out.
- Flying types and Levitate hover: ground AoE and ground hazards pass under them.
- Hazards are aimed field objects (Stealth Rock, Spikes, Toxic Spikes, Sticky Web) that only hurt the other side; Rapid Spin / Defog clear them; Heavy-Duty Boots ignore them.
- Weather and terrain are real field states with visuals. A battle can start with weather passed in (future overworld hook).
- Arenas have obstacles: rocks (block, breakable), puddles (Electric hits harder on a soaked target, Water user boosted), tall grass (hides, Fire burns it).
- Mons and their VFX are drawn 2x (TUNE.SPRITE_SCALE) on the 1x arena; arena art is dimmed + desaturated, mons get a 1px dark outline and a strong shadow so they pop.
- All VFX are pixel art: PMDO particle sheets for every effect (hits, rings, dust, hazards, stat changes), and the arena renders on a low-res world canvas scaled up nearest-neighbour so any drawn shape is hard-edged on the same pixel grid.
- Lasers (locked 2026-10-14, round 3): beam and stream moves (Solar Beam, Hyper Beam, Hydro Pump, Flamethrower, Ice Beam, Thunderbolt, ... see LASERS in src/battle.js) are channelled, aimed streams that tick damage. Each has its own duration, turn rate, width, length and how much the user can move. Solar Beam: long tell, stiff turning, rooted, huge damage if it stays on target. Hydro Pump: quick to turn, short, roots the user. Two lasers that meet clash: the contact point is pushed toward the weaker beam (move type vs move type, power, attacking stat, STAB), and the loser's beam collapses.
- Psychic-style placed moves (Psychic, Confusion, Extrasensory, Hex, Night Shade, plus eruptions and drops like Earth Power, Thunder, Stone Edge) use a tracking reticle (strike in the behaviour table); Future Sight lands much later: it starts on the target if in range, chases at a fixed speed, then locks and blinks before landing. Fast mons can outrun it, anyone can roll out after the lock.
- Charge and tackle moves (Tackle, Quick Attack, Take Down, Flame Wheel, Volt Tackle, ...) are full-length dashes usable as movement. Speed sets distance and pace. Priority dashes give i-frames. On pad with the aim stick idle they go where you're walking. Rollout / Ice Ball are a steerable roll that hits harder on each pass. Rock Slide, Draco Meteor and Water Spout drop several scattered blasts around the aimed spot, each dealing a share of the damage.
- Movement is ~1.5x the old pace and scales linearly with Speed (slow ~120 px/s, fast ~260). Dodge distance scales with Speed too.
- Audio: attack SFX come from the BellBlitzKing game-rip pack (tools/build-sfx.mjs, Gen 5 recordings first), plus game hit / faint / recall / stat / status sounds. Cries are Showdown's.
- Megas without official PMDCollab body art (Venusaur, Charizard Y, Blastoise, Beedrill, Pidgeot, Pinsir, Gyarados, Mewtwo X) use custom sheets in assets/sprite-custom/<key>/, generated from the base sheets by tools/build-mega-custom.mjs (Venusaur) and tools/mega-custom/<key>.mjs, then wired in by `node tools/build-sprites-custom.mjs` (writes data/sprites-custom.js). Every Gen 1 mega now has body art.
- Sideline trainers are HGSS overworld sprites (tools/build-trainer-ow.mjs). UI button prompts are Kenney Input Prompts Pixel icons.
- Sprites keep PMD proportions. Camera frames both mons dynamically, pushes in on big hits.
- Charge shots (locked 2026-10-14, round 5): single damaging projectiles (Shadow Ball, Sludge Bomb, Energy Ball, ...) fire almost at once on a tap. Holding the button keeps charging after the short windup: an orb grows at the mouth, type-colour aura rises, a ring pops at full (1.2 s). Full charge = +80% damage, +120% hitbox, impact frame on hit. Holding 0.6 s past full fires it anyway. The cost is the telegraph, so charging pays off from range. CPU charges sometimes when far away. Knobs: TUNE.CHARGE_MAX / CHARGE_DMG / CHARGE_SIZE.
- Outline tells: the runtime 1px outline turns the move's type colour while a mon winds up, charges or channels (white flicker so it reads), white when hit, red blink under 25% HP, rainbow while mega evolving.
- Big moments go loud: moves with 100+ power flash the screen in their type colour on release with shake and camera punch. Strong hits (22%+ of max HP, KOs, big crits, strong super-effective hits, full charge shots, beam clash wins, Mega Evolution) trigger impact frames: the world freezes on a black frame with white speed lines and white mon silhouettes, strobing to its negative. Every hit throws pixel shards along the hit direction; solid hits add a shockwave ring and an impact star.
- Mega Evolution is a 1.1 s cinematic: time freezes, the arena darkens, rainbow motes pull into the mon under a light pillar with a rainbow outline, then impact frames and a flash reveal the mega with a starburst, rainbow shockwaves and shards.
- The HUD shows each mon's level next to its name.

## Team builder (src/teambuilder.js, 2026-10-14)
- Set editor: party on the left (portrait, level, move type bars, held item icon, X to remove), the mon or a live move preview in the middle, fields on the right. Every control is clickable, rows highlight on hover, scroll or click either half to change level / ability / nature, right-click goes back. Pad: d-pad/stick, A/B, X remove, Y rename, LB/RB level -10/+10.
- Move order: each move row shows its pad and PC button (A/B/X/Y, LMB/RMB/Q/E). Reorder with the arrow buttons, Q/E, or LB/RB on pad.
- Move picker: type to search (name, type, category or style), sort by type, name, category, power, cooldown or style (click a header twice to reverse; pad X sorts, Y reverses), type filter (pad LT/RT), scrollbar you can drag.
- Attack preview: a real mini battle (startBattle / updateBattle / drawWorld) of the set's mon using the move on a Wobbuffet dummy, looping, drawn into a panel. It uses the real engine, so it always matches the arena. Sound is muted while it runs. The only engine hook is `side.script` in updateBattle.
- Item icons: PokeSprite inventory sprites baked by `node tools/build-item-icons.mjs` into assets/ui/items.png + data/item-icons.js. Newer mega stones PokeSprite lacks fall back to a generic stone icon.

## Later (not now)
- Online multiplayer (couch first via Parsec/Remote Play is free).
- More trainers (Gold, Cynthia, Steven), EVs/IVs, Z-moves/Tera/Dynamax, overworld.
