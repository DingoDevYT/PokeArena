# PokeArena data contract

Everything the game reads is a plain `<script>` file that assigns a global, so the game runs from `file://` with no server.
All asset paths are relative to `index.html` (project root). Build scripts live in `tools/` and are run with `node tools/<script>.mjs` from the project root.

## data/dex.js  ->  `window.DEX`  (tools/build-dex.mjs)

Roster: every species 1-1025, plus forms that change stats, types or abilities (regional forms, Rotom appliances, Therian,
Origin, Lycanroc, Urshifu, Zacian/Zamazenta Crowned, ...), plus every mega and primal @pkmn/dex has (Legends Z-A megas
included). Skipped: cosmetic forms, Gmax, Totem, LGPE starters, CAP, Pikachu cosplay, battle-only forms (Zen, Blade,
School, Busted, Tera, ...). Ids keep @pkmn's (`raichualola`, `rotomwash`).
On disk the file is compacted for file:// load: each learnset is a string of 2-char base-36 indexes into
`Object.keys(DEX.moves)`, megas store none, and fx fields the game never reads are dropped. A few lines at the end of the
file expand it back into the shape below when the script runs, so game code and tools never see the compact form.

```js
DEX = {
  species: {
    charizard: {
      id: 'charizard', num: 6, name: 'Charizard',
      types: ['Fire', 'Flying'],
      baseStats: { hp, atk, def, spa, spd, spe },
      abilities: { 0: 'Blaze', H: 'Solar Power' },   // ability NAMES as in @pkmn
      weightkg,
      learnset: ['flamethrower', ...],               // move ids, all gens, banned moves INCLUDED (game filters); own + prevo chain, plus the base's for appliance/Therian-style forms
      megas: ['charizardmegax', 'charizardmegay'],   // ids of mega forms, if any
      sprite: '0006',                                // key into SPRITES
      // mega / primal forms only (learnset is the base's array):
      isMega: true, baseSpecies: 'charizard', requiredItem: 'Charizardite X',  // or requiredMove: 'Dragon Ascent' (Rayquaza)
    },
  },
  moves: {
    flamethrower: {
      id, name, type, category: 'Physical'|'Special'|'Status',
      basePower, accuracy /* number or true */, pp, priority, target,
      flags: { contact: 1, ... },
      // copied straight from @pkmn when present:
      secondary, secondaries, self, boosts, status, volatileStatus, drain, recoil,
      heal, multihit, critRatio, weather, terrain, sideCondition, selfSwitch, ohko,
      shortDesc,
      banned: false, bannedReason: '',               // see docs/BANNED_MOVES.md
      fx: {                                          // from PMDO DumpAsset/Data/Skill/<id>.json, null if no PMDO file
        hitbox: 'Projectile'|'Area'|'Attack'|'Dash'|'Self'|'Wave'|'Throw'|'Offset'|... ,  // PMDO HitboxAction $type minus "Action"
        range, speed,                                // PMDO tiles (1 tile = 24px)
        explosionRange,                              // PMDO Explosion.Range (0 = none)
        anims: ['Flamethrower_2'],                   // particle names used by the hitbox (stream/emitter/anim)
        hitAnim: 'Flamethrower',                     // particle at target on hit (HitFX), '' if none
        beam: '',                                    // Beam folder name for Wave hitboxes, '' if none
        sound: 'DUN_Flamethrower_2',                 // ActionFX.Sound, '' if none
        charAnim: 'Shoot',                           // PMD body anim NAME (GFXParams action list), fallbacks resolved
      },
    },
  },
  abilities: { blaze: { name: 'Blaze', shortDesc } },     // only abilities roster species (and megas) can have
  items: { leftovers: { name, shortDesc, megaStone?: 'charizardmegax' } }, // curated competitive held items + every mega stone / primal orb
  natures: { adamant: { name: 'Adamant', plus: 'atk', minus: 'spa' } },
  typeChart: { Fire: { Grass: 2, Water: 0.5, ... }, ... },   // attacker -> defender -> multiplier (only non-1 entries needed)
}
```

## data/sprites.js  ->  `window.SPRITES`  (tools/fetch-sprites.mjs, run after build-dex)

One entry per `sprite` key used in DEX.species. Keys with no SpriteCollab body art (some forms, female forms, ~45 species
SpriteCollab hasn't drawn yet) get a copy of the closest key's anims: base form, then the evolution family, then the
`0000` placeholder. The file is stored as compact tuples and expanded on load, like dex.js.

```js
SPRITES = {
  '0006': {
    portrait: 'assets/sprite/0006/portrait.png',      // SpriteCollab portrait Normal.png
    anims: {
      Walk: { file: 'assets/sprite/0006/Walk-Anim.png', fw, fh, durations: [8,10,...] /* PMD ticks, 1 tick = 1/60 s */,
              footY /* px from top of frame to the ground point, from the Shadow sheet */,
              hit /* HitFrame index or -1 */, ret /* ReturnFrame or -1 */, rush /* RushFrame or -1 */ },
      ...                                              // every anim in AnimData.xml; CopyOf resolved to the real sheet
    },
  },
  '0006-1': { ... },                                  // forms and megas keyed '<dex>-<SpriteCollab form number>'
}
```
Sheet rows are the 8 directions in PMD order: 0 Down, 1 DownRight, 2 Right, 3 UpRight, 4 Up, 5 UpLeft, 6 Left, 7 DownLeft. Single-row sheets are non-directional.

## data/vfx.js  ->  `window.VFX`  (tools/build-dex.mjs)

```js
VFX = {
  particles: { Flamethrower_2: { file: 'assets/particle/Flamethrower_2.png', fw: 32, fh: 32, frames: 6, dirs: 1 /* or 8 */ } },
  beams: { Beam: { head: 'assets/beam/Beam/Head.png', body: '...Body.png', tail: '...Tail.png', frames: 2 } },
  sounds: { DUN_Flamethrower_2: 'assets/sfx/DUN_Flamethrower_2.ogg' },
}
```

## data/world.js  ->  `window.ARENAS`, `window.TRAINERS`, `window.MUSIC`  (tools/build-world.mjs)

```js
ARENAS = [{
  id: 'cave', name: 'Granite Cave',
  bg: 'assets/arena/cave.png',             // full pre-rendered floor+walls image, 1 px = 1 world unit
  w, h,                                    // world size = bg size
  wall: 48,                                // playable area is inset by this many px on every side
  spawns: [[x, y], [x, y]],                // player, cpu
  obstacles: [{ kind: 'rock'|'puddle'|'grass', x, y, r }],
  props: { rock: 'assets/arena/rock.png', puddle: '...', grass: '...' },
  weather: '' , music: 'assets/music/....mp3'
}]
TRAINERS = [{
  id: 'red', name: 'Red', title: 'Pokemon Trainer',
  sprite: 'assets/trainer/red.png',        // Showdown trainer sprite
  music: 'assets/music/....mp3',
  difficulty: 'hard',                      // easy|normal|hard|champion
  team: [{ species: 'pikachu', level: 88, moves: ['thunderbolt', ...4], ability: 'Static', item: 'Light Ball', nature: 'Timid' }],
}]
MUSIC = { menu: 'assets/music/...', builder: '...' }
```
Cries: `assets/cry/<speciesid>.mp3` (Showdown cry names, megas use `<base>-mega`, `-megax`, `-megay` where Showdown has them, else base).
