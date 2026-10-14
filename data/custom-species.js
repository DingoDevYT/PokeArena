// Flowery (Deltarune), the hidden joke character: unlock by typing "jarona" in the species picker.
// Patches window.DEX / SPRITES / MOVE_BEHAVIOUR / MOVE_SFX after their generated files, so rebuilding the dex never wipes him.
// Sprites: tools/build-flowery.py (strips in assets/sprite-custom/flowery/, native size). Voices: assets/sfx/flowery/.
(() => {
  const { DEX, MOVE_BEHAVIOUR, SPRITES, MOVE_SFX } = window;
  const FX = (extra = {}) => ({ hitbox: 'Attack', range: 3, speed: 0, shape: 'Full', explosionRange: 0, anims: [], columns: [], hitAnim: '', beam: '', sound: '', charAnim: 'Attack', charAnimFallbacks: [], ...extra });
  const mv = (id, name, type, category, basePower, shortDesc, fx) => ({ id, name, type, category, basePower, accuracy: true, pp: 10, priority: 0, target: 'normal', flags: { protect: 1, mirror: 1 }, critRatio: 1, shortDesc, bannedReason: '', banned: false, fx });
  DEX.moves.prismblow = mv('prismblow', 'Prism Blow', 'Grass', 'Special', 80, 'Blows a gust of petals: chip damage over time and shoves the target away.', FX({ range: 4, charAnim: 'Blow' }));
  DEX.moves.mysteriouswind = mv('mysteriouswind', 'Mysterious Wind', 'Flying', 'Physical', 100, 'Rises, flies fast across the whole arena, lands in a gust with knockback.', FX({ charAnim: 'Rise' }));
  DEX.moves.jarona = mv('jarona', 'Jarona', 'Fairy', 'Physical', 80, 'Flies a long way along the aim, leaving blue afterimages. Hits once, stops at walls.', FX({ charAnim: 'Fair' }));
  DEX.moves.jaorange = mv('jaorange', 'Ja-orange!', 'Fighting', 'Physical', 120, 'Hops back out of danger and launches Orange doing his own Jarona.', FX({ range: 9, charAnim: 'Dodge' }));
  DEX.species.flowery = { id: 'flowery', num: 9999, name: 'Flowery', types: ['Grass', 'Fairy'], fixedStats: 999, baseStats: { hp: 999, atk: 999, def: 999, spa: 999, spd: 999, spe: 999 }, abilities: { 0: 'Levitate' }, weightkg: 30,
    learnset: ['prismblow', 'mysteriouswind', 'jarona', 'jaorange'], sprite: 'flowery' };
  Object.assign(MOVE_BEHAVIOUR, {
    prismblow: { arch: 'gust', cdExact: 3.5, len: 250, half: 0.5, dur: 1.3, ticks: 12, push: 230, range: 180, voice: 'assets/sfx/flowery/prism_blow.ogg' },
    mysteriouswind: { arch: 'leap', cdExact: 5, fly: { hide: 1.7, spd: 2.2, push: 700 }, range: 400, voice: 'assets/sfx/flowery/mysterious_wind.ogg' },
    jarona: { arch: 'dash', cdExact: 1, dist: 3.2, spd: 1.5, noHome: 1, wall: 1, afterimage: 1, range: 420, voice: ['assets/sfx/flowery/jarona1.ogg', 'assets/sfx/flowery/jarona2.ogg', 'assets/sfx/flowery/jarona3.ogg', 'assets/sfx/flowery/jarona4.ogg'] },
    jaorange: { arch: 'orange', cdExact: 2.5, spd: 800, range: 520, voice: 'assets/sfx/flowery/jaorange.ogg' },
  });
  if (MOVE_SFX) MOVE_SFX.moves.prismblow = 'assets/sfx/flowery/sfx_prism.ogg';
  if (MOVE_SFX) MOVE_SFX.moves.mysteriouswind = 'assets/sfx/flowery/sfx_prism.ogg';
  if (MOVE_SFX) MOVE_SFX.moves.jarona = 'assets/sfx/flowery/sfx_jarona.ogg';
  if (MOVE_SFX) MOVE_SFX.moves.jaorange = 'assets/sfx/flowery/sfx_jarona.ogg';
  SPRITES.flowery = { portrait: 'assets/sprite-custom/flowery/portrait.png', body: 12, scale: 0.5, anims: {"Idle":{"file":"assets/sprite-custom/flowery/Idle-Anim.png","fw":86,"fh":61,"durations":[10,10,10,10,10],"footY":59,"hit":-1,"ret":-1,"rush":-1},"Walk":{"file":"assets/sprite-custom/flowery/Walk-Anim.png","fw":86,"fh":61,"durations":[6,6,6,6,6],"footY":59,"hit":-1,"ret":-1,"rush":-1},"Sleep":{"file":"assets/sprite-custom/flowery/Sleep-Anim.png","fw":86,"fh":60,"durations":[14,14,14,14,14],"footY":58,"hit":-1,"ret":-1,"rush":-1},"Hurt":{"file":"assets/sprite-custom/flowery/Hurt-Anim.png","fw":48,"fh":53,"durations":[2,8],"footY":51,"hit":-1,"ret":-1,"rush":-1},"Dodge":{"file":"assets/sprite-custom/flowery/Dodge-Anim.png","fw":64,"fh":59,"durations":[9,30],"footY":57,"hit":1,"ret":-1,"rush":-1},"Faint":{"file":"assets/sprite-custom/flowery/Faint-Anim.png","fw":70,"fh":59,"durations":[8,40],"footY":57,"hit":-1,"ret":-1,"rush":-1},"Charge":{"file":"assets/sprite-custom/flowery/Charge-Anim.png","fw":36,"fh":56,"durations":[5,5],"footY":54,"hit":-1,"ret":-1,"rush":-1},"Rise":{"file":"assets/sprite-custom/flowery/Rise-Anim.png","fw":42,"fh":77,"durations":[3,3,3,5,30],"footY":75,"hit":3,"ret":-1,"rush":-1},"Attack":{"file":"assets/sprite-custom/flowery/Attack-Anim.png","fw":96,"fh":63,"durations":[3,3,3,3,3,14],"footY":61,"hit":5,"ret":-1,"rush":-1},"Blow":{"file":"assets/sprite-custom/flowery/Blow-Anim.png","fw":50,"fh":63,"durations":[4,4,4,4,8,18],"footY":61,"hit":4,"ret":-1,"rush":-1},"Fair":{"file":"assets/sprite-custom/flowery/Fair-Anim.png","fw":62,"fh":55,"durations":[30],"footY":53,"hit":-1,"ret":-1,"rush":-1}} };
  window.FLOWERY_HUH = 'assets/sfx/flowery/huh.ogg';
  window.ORANGE_SPRITE = { file: 'assets/sprite-custom/flowery/orange.png', fw: 32, fh: 24, frames: 2 };
})();
