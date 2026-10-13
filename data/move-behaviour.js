// How every move a Gen 1 species can learn plays in real time, decided from what the move IS (its in-game
// description and how the games/anime show it), not from the PMDO grid hitbox. src/battle.js archetype() reads
// this first; the PMDO mapping is only a fallback for moves missing here.
//
// arch: self | hazard | projectile | beam | laser | area | melee | dash | lunge | lob | strike | leap | trap | wave | sweep
//   projectile  n = shots fanned out (one hit per volley), spread = rad between shots, r = hitbox scale,
//               spd = speed scale, home = gentle homing turn rate (rad/s, sure-hit moves only)
//   beam        instant line; w = width px
//   laser       channelled stream, numbers in LASERS (src/battle.js)
//   area        burst around the user; r = radius px
//   melee       swing in front; reach = extra px
//   dash        full-length charge usable as movement; dist = distance scale; roll = steerable Rollout roll
//   lunge       fast short rush that cuts whatever it reaches (movement-tech melee); dist = distance scale
//   lob/strike  aimed drop (lob arcs a thrown thing, strike is the tracking reticle); n = scattered drops,
//               r = radius px, delay/track = seconds before landing / chasing
//   leap        user vanishes (fly, dig, ...) then lands
//   trap        lingering patch placed at the aim: r = radius px, dur = seconds, every = seconds between
//               applying the effect to a foe standing inside, mul = damage per application (damaging moves),
//               pull = px/s toward the centre, slow = foe move speed x while inside, fx = particle sheets looped
//               inside, big = one big looping sheet in the centre
//   wave        wide front that travels forward and hits once; w = width px, len = travel px, spd = px/s,
//               push = knockback px/s, pushOnly = status move that only shoves
//   sweep       whole-arena front from beyond the edge behind the aim (4-axis snapped), after a warning band:
//               kind = water|mud|sludge|quake|heat (look + field combos), gaps = safe openings, gapW = their width px,
//               spd = px/s, thick = hit depth px, depth = drawn depth px, push = shove px/s, warn = telegraph s, cd = cooldown floor s
window.MOVE_BEHAVIOUR = {
  absorb: { arch: 'beam' }, // drains nutrients: a short draining tether
  acid: { arch: 'projectile', n: 3, spread: 0.2 }, // sprays acid droplets that hit everything in front
  acidarmor: { arch: 'self' }, // liquefies itself, no target
  acidspray: { arch: 'lob' }, // spits a ball of acid that splashes where it lands
  acrobatics: { arch: 'lunge' }, // nimble aerial strike: quick rush in
  aerialace: { arch: 'lunge' }, // confounds the foe with speed, then slashes: fast rush and cut
  agility: { arch: 'self' }, // relaxes and lightens its body
  aircutter: { arch: 'projectile', n: 3, spread: 0.22 }, // launches razor-like wind blades in a fan
  airslash: { arch: 'lunge' }, // a blade of air that slices: quick movement-tech slash, not a homing reticle
  alluringvoice: { arch: 'wave', w: 90 }, // an angelic voice rolls out in front
  amnesia: { arch: 'self' }, // empties its mind
  ancientpower: { arch: 'projectile', n: 3, spread: 0.25 }, // hurls prehistoric rocks
  aquajet: { arch: 'dash' }, // lunges at the foe at blinding speed wrapped in water
  aquatail: { arch: 'melee' }, // swings its tail like a vicious wave
  assurance: { arch: 'melee' }, // a plain close hit
  astonish: { arch: 'melee' }, // jumps out with a shout at close range
  aurasphere: { arch: 'projectile', r: 1.3, home: 1.5 }, // sure-hit ball of aura that bends toward the foe
  aurorabeam: { arch: 'laser' }, // fires a rainbow-coloured beam
  auroraveil: { arch: 'self' }, // side screen
  autotomize: { arch: 'self' }, // sheds part of its body
  avalanche: { arch: 'strike' }, // snow crashes down onto the target
  axekick: { arch: 'lunge' }, // leaps in and drops a heel on the foe
  babydolleyes: { arch: 'beam', w: 30 }, // stares with crying eyes: a quick gaze line
  barrage: { arch: 'projectile' }, // hurls round objects several times
  barrier: { arch: 'self' }, // raises a wall
  bellydrum: { arch: 'self' }, // drums its belly
  bind: { arch: 'melee' }, // wraps the foe up close
  bite: { arch: 'melee' }, // bites with sharp fangs
  blastburn: { arch: 'laser' }, // a huge torrent of fire
  blazekick: { arch: 'lunge' }, // rushes in with a fiery kick
  blizzard: { arch: 'trap', r: 100, dur: 3, every: 0.5, mul: 0.3, fx: ['Snow', 'Ice_Pieces'] }, // a howling blizzard rages over an area
  bodypress: { arch: 'dash' }, // slams its whole body into the foe
  bodyslam: { arch: 'dash' }, // drops onto the foe with its full body
  boneclub: { arch: 'melee' }, // clubs with a bone
  bonemerang: { arch: 'projectile' }, // throws a bone like a boomerang
  bonerush: { arch: 'melee' }, // strikes with a bone 2-5 times
  bounce: { arch: 'leap' }, // springs up, then drops on the foe
  bravebird: { arch: 'dash' }, // tucks its wings and charges from low altitude
  breakingswipe: { arch: 'area', r: 80 }, // swings its tail wildly, hitting all around
  brickbreak: { arch: 'melee' }, // a karate chop
  brine: { arch: 'projectile' }, // a burst of brine
  brutalswing: { arch: 'area', r: 80 }, // swings its body violently, hitting all around
  bubble: { arch: 'projectile', n: 3, spread: 0.3, spd: 0.6 }, // a slow spray of bubbles
  bubblebeam: { arch: 'laser' }, // a stream of bubbles
  bugbite: { arch: 'melee' }, // bites
  bugbuzz: { arch: 'wave', w: 100 }, // a damaging sound wave from vibrating wings
  bulkup: { arch: 'self' }, // tenses its muscles
  bulldoze: { arch: 'sweep', kind: 'quake', gaps: 2, gapW: 110, spd: 340, depth: 64, cd: 9 }, // stomps hard enough to send a shockwave across the whole arena (two gaps; floating mons ignore it)
  bulletpunch: { arch: 'lunge' }, // punches as fast as a bullet
  bulletseed: { arch: 'projectile' }, // shoots a rapid string of seeds
  burningjealousy: { arch: 'area', r: 100 }, // envy flares out as fire all around
  burnup: { arch: 'area', r: 110 }, // burns itself out in a huge blast of fire
  calmmind: { arch: 'self' }, // focuses its mind
  captivate: { arch: 'area', r: 120 }, // a charming wave spreads around the user
  charge: { arch: 'self' }, // charges power
  chargebeam: { arch: 'laser' }, // a beam of electricity
  charm: { arch: 'area', r: 100 }, // gazes charmingly at everyone near
  chillingwater: { arch: 'projectile' }, // showers the foe with icy water
  chipaway: { arch: 'melee' }, // strikes through an opening
  circlethrow: { arch: 'melee' }, // throws the foe, dragging out another
  clamp: { arch: 'melee' }, // clamps the foe in its shell
  clearsmog: { arch: 'projectile' }, // hurls a lump of special mud
  closecombat: { arch: 'melee' }, // a flurry at point-blank range
  coaching: { arch: 'self' }, // pep talk, no foe target
  coil: { arch: 'self' }, // coils up
  cometpunch: { arch: 'melee' }, // a barrage of punches
  confide: { arch: 'area', r: 90 }, // whispers a secret to anyone close
  confuseray: { arch: 'projectile', r: 1.4 }, // a sinister ray of light
  confusion: { arch: 'strike' }, // telekinetic force on the target (locked reticle rule)
  constrict: { arch: 'melee' }, // squeezes with tentacles
  cosmicpower: { arch: 'self' }, // absorbs mystic power
  covet: { arch: 'lunge' }, // approaches endearingly, then steals
  crabhammer: { arch: 'melee' }, // hammers with a big pincer
  crosschop: { arch: 'melee' }, // double chop
  crosspoison: { arch: 'lunge' }, // rushes in with a poisonous cross slash
  crunch: { arch: 'melee' }, // crunches with fangs
  crushclaw: { arch: 'lunge' }, // rushes in and slashes with hard claws
  cut: { arch: 'lunge' }, // rushes in and cuts
  darkestlariat: { arch: 'area', r: 75 }, // spins with both arms out, hitting all around
  darkpulse: { arch: 'wave', w: 110 }, // releases a horrible aura that rolls outward
  dazzlinggleam: { arch: 'area', r: 120 }, // a powerful flash all around
  defensecurl: { arch: 'self' }, // curls up
  defog: { arch: 'area', r: 150 }, // a strong wind blows away the field
  detect: { arch: 'self' }, // protection
  dig: { arch: 'leap' }, // burrows, then strikes from below
  disarmingvoice: { arch: 'wave', w: 110 }, // a charming cry that can't be dodged by stepping aside
  discharge: { arch: 'area', r: 130 }, // a flare of electricity strikes everything around (not a stream)
  dive: { arch: 'leap' }, // dives, then rises under the foe
  dizzypunch: { arch: 'melee' }, // rhythmic punches
  doubleedge: { arch: 'dash' }, // a reckless life-risking tackle
  doublehit: { arch: 'melee' }, // slams twice with its tail
  doublekick: { arch: 'melee' }, // two quick kicks
  doubleslap: { arch: 'melee' }, // slaps back and forth
  doubleteam: { arch: 'self' }, // creates illusory copies
  dracometeor: { arch: 'lob', n: 4, r: 52 }, // comets rain down around the aimed spot
  dragonbreath: { arch: 'laser' }, // exhales a stream of breath
  dragonclaw: { arch: 'lunge' }, // rushes in and slashes with sharp claws
  dragondance: { arch: 'self' }, // a mystic dance
  dragonpulse: { arch: 'projectile', r: 1.3 }, // a shock wave from its mouth
  dragonrage: { arch: 'projectile' }, // a shock wave of rage
  dragonrush: { arch: 'dash' }, // tackles with overwhelming menace
  dragontail: { arch: 'melee' }, // knocks the foe away with its tail
  drainingkiss: { arch: 'lunge' }, // darts in for a draining kiss
  drainpunch: { arch: 'melee' }, // an energy-draining punch
  dreameater: { arch: 'strike' }, // eats the dreams of a sleeping foe (psychic placed move)
  drillpeck: { arch: 'dash' }, // a corkscrewing beak charge
  drillrun: { arch: 'dash' }, // rotates like a drill and rams
  dualchop: { arch: 'melee' }, // two quick chops
  dualwingbeat: { arch: 'lunge' }, // rushes in, slamming with both wings
  dynamicpunch: { arch: 'melee' }, // a full-power punch
  earthpower: { arch: 'strike' }, // the ground under the target erupts
  earthquake: { arch: 'sweep', kind: 'quake', gaps: 0, spd: 420, thick: 26, depth: 64, cd: 12 }, // a quake that rolls across the entire arena: solid, so roll through it, float over it or Protect
  echoedvoice: { arch: 'wave', w: 90 }, // an echoing voice rolls out
  eerieimpulse: { arch: 'wave', w: 90 }, // eerie electric waves
  eggbomb: { arch: 'lob' }, // hurls a large egg
  electricterrain: { arch: 'self' }, // field state
  electroball: { arch: 'projectile' }, // hurls an electric orb
  electroweb: { arch: 'trap', r: 66, dur: 4, every: 99, mul: 1, slow: 0.5, fx: ['String_Shot_Web', 'Circle_Tiny_Yellow'] }, // an electric net catches whoever walks in
  ember: { arch: 'projectile' }, // small flames shot at the foe
  endeavor: { arch: 'melee' }, // a desperate close attack
  endure: { arch: 'self' }, // braces itself
  energyball: { arch: 'projectile', r: 1.2 }, // a ball of nature's energy
  expandingforce: { arch: 'strike' }, // psychic power on the target
  explosion: { arch: 'area', r: 150 }, // a massive explosion around the user
  extrasensory: { arch: 'strike' }, // odd unseen power (locked reticle rule)
  extremespeed: { arch: 'dash' }, // an extremely fast charge
  facade: { arch: 'melee' }, // a plain close hit
  fakeout: { arch: 'lunge' }, // darts in and claps to make the foe flinch
  faketears: { arch: 'area', r: 100 }, // fake crying unsettles anyone close
  falseswipe: { arch: 'lunge' }, // a restrained rushing slash
  featherdance: { arch: 'trap', r: 72, dur: 5, fx: ['Feather'] }, // a flurry of down feathers settles over an area
  feint: { arch: 'lunge' }, // a quick fake-out strike
  feintattack: { arch: 'lunge' }, // approaches innocently, then strikes
  fellstinger: { arch: 'lunge' }, // rushes in with a stinger stab
  finalgambit: { arch: 'dash' }, // throws everything into one charge
  fireblast: { arch: 'projectile', r: 1.5, spd: 0.8 }, // a big, slow blast of fire
  firefang: { arch: 'melee' }, // bites with flaming fangs
  firepledge: { arch: 'strike' }, // a column of fire on the target
  firepunch: { arch: 'melee' }, // a fiery punch
  firespin: { arch: 'trap', r: 62, dur: 4, every: 0.5, mul: 0.3, pull: 70, big: 'Fire_Spin_Front', fx: ['Fire_Spin_Fireball'] }, // a fire vortex that holds and burns
  firstimpression: { arch: 'dash' }, // a fast first strike
  flail: { arch: 'melee' }, // flails about
  flameburst: { arch: 'projectile' }, // a bursting flame
  flamecharge: { arch: 'dash' }, // cloaks itself in flame and charges
  flamethrower: { arch: 'laser' }, // a stream of fire
  flamewheel: { arch: 'dash' }, // a fiery rolling charge
  flareblitz: { arch: 'dash' }, // cloaks itself in fire and charges
  flash: { arch: 'area', r: 130 }, // a bright flash all around
  flashcannon: { arch: 'laser' }, // fires a beam of light
  flatter: { arch: 'wave', w: 90 }, // flattering words roll out
  flipturn: { arch: 'lunge' }, // a quick flip into the foe, then swaps out
  fly: { arch: 'leap' }, // flies up, then strikes
  focusblast: { arch: 'projectile', r: 1.4, spd: 0.8 }, // a big ball of focused energy
  focusenergy: { arch: 'self' }, // gets pumped
  focuspunch: { arch: 'dash', spd: 3.2, dist: 3.4, mul: 1.5, cd: 12, reach: 14 }, // long interruptible charge (aim while it winds up), then a blindingly fast dash punch
  foulplay: { arch: 'melee' }, // turns the foe's power on itself
  freezedry: { arch: 'strike' }, // rapidly freezes the target where it stands
  frenzyplant: { arch: 'laser' }, // giant roots rip forward
  frostbreath: { arch: 'wave', w: 70, len: 200, spd: 520 }, // a short blast of icy breath
  frustration: { arch: 'melee' }, // a plain close hit
  furyattack: { arch: 'melee' }, // jabs with a horn repeatedly
  furycutter: { arch: 'lunge' }, // rushes in slashing with scythes
  furyswipes: { arch: 'melee' }, // scratches repeatedly
  futuresight: { arch: 'strike', delay: 2.4, track: 1.6 }, // psychic energy lands on the target much later
  gigadrain: { arch: 'beam' }, // a nutrient-draining tether
  gigaimpact: { arch: 'dash' }, // charges with everything it has
  glare: { arch: 'beam', w: 30 }, // a terrifying glare
  grassknot: { arch: 'trap', r: 50, dur: 5, every: 99, mul: 1, fx: ['Grass_Knot_Front'] }, // a grass snare that trips whoever steps in
  grasspledge: { arch: 'strike' }, // a column of grass on the target
  grasswhistle: { arch: 'wave', w: 100 }, // a pleasant melody rolls out
  grassyglide: { arch: 'dash' }, // glides along the ground
  grassyterrain: { arch: 'self' }, // field state
  growl: { arch: 'area', r: 130 }, // growls at everything around
  growth: { arch: 'self' }, // grows
  gunkshot: { arch: 'projectile', r: 1.3 }, // shoots filthy garbage
  gust: { arch: 'wave', w: 100, push: 420 }, // a gust of wind whipped up by wings shoves the foe
  gyroball: { arch: 'dash' }, // a high-speed spinning tackle
  hail: { arch: 'self' }, // weather
  hammerarm: { arch: 'melee' }, // swings a heavy fist
  hardpress: { arch: 'melee' }, // presses down with arms
  harden: { arch: 'self' }, // stiffens
  haze: { arch: 'self' }, // a haze that resets everyone
  headbutt: { arch: 'dash' }, // sticks out its head and rams
  headsmash: { arch: 'dash' }, // a life-risking headbutt charge
  heartstamp: { arch: 'melee' }, // a sudden blow after a cute act
  heatcrash: { arch: 'dash' }, // slams its flaming body into the foe
  heatwave: { arch: 'sweep', kind: 'heat', gaps: 2, gapW: 90, depth: 120, spd: 320, cd: 10 }, // a wall of scorching air crosses the whole arena (two gaps), burning tall grass and drying the floor
  heavyslam: { arch: 'dash' }, // slams into the foe with its heavy body
  hex: { arch: 'strike' }, // a ghostly curse on the target
  hiddenpower: { arch: 'projectile' }, // an orb of hidden power
  highhorsepower: { arch: 'dash' }, // rams with its whole body
  highjumpkick: { arch: 'dash' }, // a long jumping knee strike
  holdback: { arch: 'melee' }, // a restrained hit
  honeclaws: { arch: 'self' }, // sharpens claws
  hornattack: { arch: 'dash' }, // charges horn first
  howl: { arch: 'self' }, // howls to raise its spirit
  hurricane: { arch: 'trap', r: 80, dur: 2.5, every: 0.5, mul: 0.35, pull: 40, big: 'Gust', fx: ['Gust_Wind'] }, // wraps the foe in a fierce tornado
  hydrocannon: { arch: 'laser' }, // a huge water blast
  hydropump: { arch: 'laser' }, // a huge volume of water
  hyperbeam: { arch: 'laser' }, // a huge beam
  hyperfang: { arch: 'melee' }, // bites with sharp fangs
  hypervoice: { arch: 'wave', w: 130 }, // a loud shout wave
  hypnosis: { arch: 'projectile', r: 1.7, spd: 0.7 }, // slow, wide hypnotic rings
  iceball: { arch: 'dash', roll: 1 }, // a steerable icy roll
  icebeam: { arch: 'laser' }, // an icy beam
  icefang: { arch: 'melee' }, // bites with icy fangs
  icepunch: { arch: 'melee' }, // an icy punch
  iceshard: { arch: 'projectile', spd: 1.3 }, // flash-freezes chunks and hurls them first
  icespinner: { arch: 'dash' }, // twirls in on iced feet
  iciclecrash: { arch: 'strike' }, // large icicles drop on the target
  iciclespear: { arch: 'projectile' }, // fires sharp icicles
  icywind: { arch: 'wave', w: 120 }, // a chilling wind across a wide front
  incinerate: { arch: 'wave', w: 100, len: 200 }, // fire burns everything in front
  inferno: { arch: 'trap', r: 60, dur: 3, every: 0.5, mul: 0.3, big: 'Fire_Spin_Back', fx: ['Lava_Plume_Fire'] }, // engulfs the spot in intense fire
  infestation: { arch: 'trap', r: 62, dur: 4, every: 0.5, mul: 0.25, pull: 40, fx: ['Attack_Order_Dust', 'Puff_Green'] }, // a swarm of pests that clings
  irondefense: { arch: 'self' }, // hardens like iron
  ironhead: { arch: 'dash' }, // slams with a steel-hard head
  irontail: { arch: 'melee' }, // slams with a steel tail
  jumpkick: { arch: 'dash' }, // a jumping kick
  karatechop: { arch: 'melee' }, // a chop
  kinesis: { arch: 'strike' }, // bends a spoon at the target
  knockoff: { arch: 'melee' }, // slaps the item away
  lashout: { arch: 'melee' }, // lashes out
  lavaplume: { arch: 'area', r: 120 }, // scarlet flames torch everything around
  leafblade: { arch: 'lunge' }, // rushes in, slashing with a leaf blade
  leafstorm: { arch: 'projectile', n: 5, spread: 0.14 }, // a storm of sharp leaves
  leaftornado: { arch: 'trap', r: 62, dur: 2, every: 0.5, mul: 0.4, big: 'Gust_Green', fx: ['Razor_Leaf'] }, // a tornado of leaves at the spot
  leechlife: { arch: 'melee' }, // a draining bite
  leechseed: { arch: 'trap', r: 58, dur: 6, fx: ['Leech_Seed_Sprout', 'Seed_RSE'] }, // planted seeds sprout on whoever steps in
  leer: { arch: 'beam', w: 30 }, // an intimidating gaze
  lick: { arch: 'melee' }, // licks
  lifedew: { arch: 'self' }, // heals
  lightscreen: { arch: 'self' }, // screen
  liquidation: { arch: 'dash' }, // slams into the foe with the full force of water
  lovelykiss: { arch: 'lunge' }, // darts in for a sleep-inducing kiss
  lowkick: { arch: 'melee' }, // a low kick
  lowsweep: { arch: 'lunge' }, // a swift rush at the legs
  lunge: { arch: 'lunge' }, // lunges at the foe
  machpunch: { arch: 'lunge' }, // a punch at blinding speed
  magicalleaf: { arch: 'projectile', n: 3, spread: 0.25, home: 2 }, // curious leaves that chase the foe (sure hit)
  magnetbomb: { arch: 'projectile', home: 2 }, // steel bombs that stick to the foe (sure hit)
  magnitude: { arch: 'sweep', kind: 'quake', gaps: 1, gapW: 90, spd: 380, depth: 64, cd: 9 }, // a quake of random strength sweeps the arena (one gap)
  meditate: { arch: 'self' }, // meditates
  megadrain: { arch: 'beam' }, // a draining tether
  megahorn: { arch: 'dash' }, // a brutal horn charge
  megakick: { arch: 'melee' }, // an extremely powerful kick
  megapunch: { arch: 'melee' }, // a powerful punch
  metalclaw: { arch: 'lunge' }, // rushes in raking with steel claws
  metalsound: { arch: 'wave', w: 90 }, // a horrible metal screech
  meteorbeam: { arch: 'laser' }, // gathers space power, then fires a beam
  meteormash: { arch: 'dash' }, // a comet-like punch charge
  minimize: { arch: 'self' }, // shrinks
  mirrorshot: { arch: 'beam' }, // a flash of energy from its polished body
  mist: { arch: 'self' }, // white mist over its side
  mistyexplosion: { arch: 'area', r: 140 }, // explodes in misty power
  mistyterrain: { arch: 'self' }, // field state
  moonblast: { arch: 'projectile', r: 1.3 }, // borrows the moon's power
  moonlight: { arch: 'self' }, // heals
  morningsun: { arch: 'self' }, // heals
  mudbomb: { arch: 'lob' }, // a hard-packed mud bomb
  muddywater: { arch: 'sweep', kind: 'mud', gaps: 2, gapW: 80, depth: 130, spd: 270, push: 450, cd: 10 }, // a flood of muddy water crashes across the arena (two gaps), soaking the floor
  mudshot: { arch: 'projectile' }, // hurls a blob of mud
  mudslap: { arch: 'projectile', n: 3, spread: 0.2 }, // hurls mud in the foe's face
  mysticalfire: { arch: 'projectile' }, // breathes a mystical fire
  nastyplot: { arch: 'self' }, // thinks bad thoughts
  nightshade: { arch: 'strike' }, // a frightening mirage on the target
  nightslash: { arch: 'lunge' }, // slashes the instant an opening appears
  nuzzle: { arch: 'lunge' }, // darts in and rubs electrified cheeks
  octazooka: { arch: 'projectile' }, // sprays ink
  ominouswind: { arch: 'wave', w: 110 }, // a repulsive wind
  outrage: { arch: 'dash', dist: 1.4 }, // a long rampage
  overheat: { arch: 'area', r: 200, mul: 1.5, huge: true, cd: 10 }, // full-power fire bursts out
  painsplit: { arch: 'beam' }, // shares HP with the foe
  payback: { arch: 'melee' }, // a close retaliating hit
  payday: { arch: 'projectile', n: 3, spread: 0.25 }, // scatters coins
  peck: { arch: 'melee' }, // pecks
  petalblizzard: { arch: 'area', r: 130 }, // a violent petal blizzard all around
  petaldance: { arch: 'area', r: 110 }, // rampages scattering petals all around
  phantomforce: { arch: 'leap' }, // vanishes, then strikes
  pinmissile: { arch: 'projectile' }, // sharp spikes fired in a row
  playnice: { arch: 'area', r: 100 }, // befriends anyone close
  playrough: { arch: 'melee' }, // plays rough
  pluck: { arch: 'melee' }, // pecks
  poisonfang: { arch: 'melee' }, // bites with toxic fangs
  poisongas: { arch: 'trap', r: 82, dur: 5, fx: ['Smoke_Purple', 'Puff_Purple'] }, // a cloud of poison gas
  poisonjab: { arch: 'lunge' }, // rushes in with a poison stab
  poisonpowder: { arch: 'trap', r: 74, dur: 5, fx: ['Spores_RSE_Purple', 'Bubbles_Purple'] }, // a cloud of poisonous dust
  poisonsting: { arch: 'projectile' }, // a toxic barb
  poisontail: { arch: 'melee' }, // a poisonous tail
  pollenpuff: { arch: 'lob' }, // an exploding pollen puff
  poltergeist: { arch: 'strike' }, // the foe's own item attacks it (ghost placed move)
  pounce: { arch: 'lunge' }, // pounces on the foe
  pound: { arch: 'melee' }, // pounds
  powdersnow: { arch: 'wave', w: 110, len: 200 }, // blows powdery snow across the front
  powergem: { arch: 'beam' }, // a gem-like ray of light
  powertrip: { arch: 'melee' }, // a close hit
  poweruppunch: { arch: 'melee' }, // a punch
  powerwhip: { arch: 'melee', reach: 40 }, // a long whip of vines
  present: { arch: 'lob' }, // a gift bomb
  protect: { arch: 'self' }, // protection
  psybeam: { arch: 'laser' }, // a peculiar ray
  psychic: { arch: 'strike' }, // strong telekinesis on the target (locked reticle rule)
  psychicfangs: { arch: 'melee' }, // psychic bite
  psychicnoise: { arch: 'wave', w: 100 }, // unpleasant sound waves
  psychicterrain: { arch: 'self' }, // field state
  psychocut: { arch: 'projectile', spd: 1.2 }, // a psychic blade is fired
  psyshock: { arch: 'strike' }, // a psychic wave on the target
  psystrike: { arch: 'strike' }, // an odd psychic wave on the target
  psywave: { arch: 'wave', w: 100 }, // an odd psychic wave rolls out
  punishment: { arch: 'melee' }, // a close hit
  pursuit: { arch: 'lunge' }, // chases the foe down
  quickattack: { arch: 'dash' }, // lunges at blinding speed
  quiverdance: { arch: 'self' }, // a mystic dance
  rage: { arch: 'melee' }, // an angry hit
  ragefist: { arch: 'melee' }, // a punch of stored rage
  ragingbull: { arch: 'dash' }, // a raging bull tackle
  ragingfury: { arch: 'area', r: 110 }, // rampages spouting flames all around
  raindance: { arch: 'self' }, // weather
  rapidspin: { arch: 'area', r: 75 }, // spins, hitting all around and clearing hazards
  razorleaf: { arch: 'projectile', n: 3, spread: 0.2 }, // sharp leaves fly in a fan
  razorshell: { arch: 'lunge' }, // rushes in, cutting with sharp shells
  razorwind: { arch: 'wave', w: 120 }, // blades of wind after a charge
  recover: { arch: 'self' }, // heals
  reflect: { arch: 'self' }, // screen
  rest: { arch: 'self' }, // sleeps
  retaliate: { arch: 'melee' }, // a close hit
  return: { arch: 'melee' }, // a close hit
  revenge: { arch: 'melee' }, // a close hit
  reversal: { arch: 'melee' }, // a desperate close hit
  risingvoltage: { arch: 'strike' }, // voltage rises from the ground under the target
  roar: { arch: 'wave', w: 110 }, // a roar that scares the foe out
  rockblast: { arch: 'projectile' }, // hurls hard rocks
  rockclimb: { arch: 'dash' }, // a full-body charge
  rockpolish: { arch: 'self' }, // polishes its body
  rockslide: { arch: 'lob', n: 3, r: 46 }, // large boulders crash down around the aimed spot
  rocksmash: { arch: 'melee' }, // a rock-smashing punch
  rockthrow: { arch: 'lob' }, // throws a rock
  rocktomb: { arch: 'strike' }, // boulders drop around the target
  rollingkick: { arch: 'area', r: 70 }, // a spinning kick
  rollout: { arch: 'dash', roll: 1 }, // a steerable roll
  roost: { arch: 'self' }, // heals
  round: { arch: 'wave', w: 90 }, // a song rolls out
  safeguard: { arch: 'self' }, // side screen
  sandattack: { arch: 'trap', r: 62, dur: 4, fx: ['Sand_Tomb_Sand', 'Puff_Brown'] }, // a cloud of sand thrown in the foe's face
  sandstorm: { arch: 'self' }, // weather
  sandtomb: { arch: 'trap', r: 64, dur: 4, every: 0.5, mul: 0.3, pull: 70, big: 'Sand_Tomb_Front', fx: ['Sand_Tomb_Sand'] }, // a raging sand vortex
  scald: { arch: 'projectile' }, // shoots boiling water
  scaleshot: { arch: 'projectile' }, // shoots scales repeatedly
  scaryface: { arch: 'beam', w: 30 }, // a scary face
  scorchingsands: { arch: 'projectile', n: 3, spread: 0.2 }, // throws scorching sand
  scratch: { arch: 'melee' }, // scratches
  screech: { arch: 'wave', w: 90 }, // an earsplitting screech
  secretpower: { arch: 'melee' }, // a close hit
  seedbomb: { arch: 'lob' }, // a barrage of hard seeds
  seismictoss: { arch: 'melee' }, // a throw
  selfdestruct: { arch: 'area', r: 130 }, // explodes around the user
  shadowball: { arch: 'projectile', r: 1.2 }, // a shadowy blob
  shadowclaw: { arch: 'lunge' }, // rushes in with a sharp shadow claw
  shadowpunch: { arch: 'melee', reach: 50 }, // a punch from the shadows that reaches far
  shadowsneak: { arch: 'dash' }, // slips along its shadow and strikes first
  sharpen: { arch: 'self' }, // sharpens edges
  shellsmash: { arch: 'self' }, // breaks its shell
  shockwave: { arch: 'projectile', home: 3 }, // a sure-hit electric shock that bends toward the foe
  signalbeam: { arch: 'laser' }, // a sinister beam of light
  silverwind: { arch: 'wave', w: 110 }, // powdery scales on the wind
  sing: { arch: 'wave', w: 110 }, // a gentle lullaby rolls out
  skittersmack: { arch: 'lunge' }, // skitters in behind the foe
  skullbash: { arch: 'dash' }, // tucks its head and charges
  skyattack: { arch: 'dash', dist: 1.4 }, // a long diving charge after a build-up
  skydrop: { arch: 'leap' }, // swoops up and drops down
  skyuppercut: { arch: 'melee' }, // an uppercut
  slackoff: { arch: 'self' }, // heals
  slam: { arch: 'melee', reach: 24 }, // slams with a long tail or vine
  slash: { arch: 'lunge' }, // rushes in, slashing with claws
  sleeppowder: { arch: 'trap', r: 76, dur: 5, fx: ['Spores_RSE_Green', 'Sleep_Z'] }, // a cloud of sleep-inducing dust
  sludge: { arch: 'lob' }, // hurls sludge
  sludgebomb: { arch: 'lob' }, // a sludge bomb
  sludgewave: { arch: 'sweep', kind: 'sludge', gaps: 1, gapW: 100, depth: 130, spd: 280, push: 300, cd: 10 }, // a giant wave of sludge swamps the whole arena (one gap)
  smackdown: { arch: 'projectile' }, // throws a stone
  smartstrike: { arch: 'lunge' }, // stabs with a sharp horn
  smellingsalts: { arch: 'melee' }, // a close hit
  smog: { arch: 'trap', r: 72, dur: 4, every: 1, mul: 0.35, fx: ['Smoke_Brown', 'Puff_Brown'] }, // a cloud of filthy smog
  smokescreen: { arch: 'trap', r: 92, dur: 6, fx: ['Smoke_Black', 'Puff_Black'] }, // a big cloud of ink-black smoke
  snarl: { arch: 'wave', w: 110 }, // yells and rants
  snowscape: { arch: 'self' }, // weather
  softboiled: { arch: 'self' }, // heals
  solarbeam: { arch: 'laser' }, // a beam of light
  solarblade: { arch: 'lunge', dist: 1.3 }, // fills a blade with light, then rushes in
  sonicboom: { arch: 'projectile' }, // a shock wave
  spark: { arch: 'dash' }, // an electrified tackle
  sparklingaria: { arch: 'wave', w: 120 }, // a song of bubbles
  spikecannon: { arch: 'projectile' }, // fires sharp spikes
  spikes: { arch: 'hazard' }, // field hazard
  spore: { arch: 'trap', r: 84, dur: 5, fx: ['Spore', 'Sleep_Z'] }, // a cloud of sleep spores
  stealthrock: { arch: 'hazard' }, // field hazard
  steamroller: { arch: 'dash' }, // rolls over the foe
  steelbeam: { arch: 'laser' }, // fires a beam of steel from its whole body
  steelroller: { arch: 'dash' }, // rolls in on steel
  steelwing: { arch: 'lunge' }, // rushes in with steel-hard wings
  stomp: { arch: 'melee' }, // stomps
  stompingtantrum: { arch: 'area', r: 100 }, // stomps around in a tantrum
  stoneedge: { arch: 'strike' }, // sharp stones stab up under the target
  storedpower: { arch: 'strike' }, // stored psychic power on the target
  stormthrow: { arch: 'melee' }, // a fierce throw
  strength: { arch: 'melee' }, // a strong punch
  stringshot: { arch: 'trap', r: 72, dur: 5, slow: 0.5, fx: ['String_Shot_Web', 'String_Shot_Ball'] }, // sticky silk that bogs the foe down
  strugglebug: { arch: 'area', r: 90 }, // struggles, hitting everything around
  stunspore: { arch: 'trap', r: 74, dur: 5, fx: ['Spores_RSE_Yellow', 'Circle_Tiny_Yellow'] }, // a cloud of paralysing powder
  submission: { arch: 'melee' }, // grabs and slams
  suckerpunch: { arch: 'lunge' }, // a sudden strike first
  sunnyday: { arch: 'self' }, // weather
  supercellslam: { arch: 'dash' }, // electrifies its body and slams down
  superfang: { arch: 'melee' }, // sharp fangs
  superpower: { arch: 'melee' }, // a tremendous close attack
  supersonic: { arch: 'wave', w: 90 }, // odd sound waves
  surf: { arch: 'sweep', kind: 'water', gaps: 1, gapW: 90, depth: 150, spd: 300, push: 700, cd: 11 }, // a massive wave crashes across the whole arena from behind the user (one gap), shoving the foe and soaking the floor
  swagger: { arch: 'wave', w: 90 }, // swaggering taunts
  sweetkiss: { arch: 'lunge' }, // darts in for a confusing kiss
  sweetscent: { arch: 'trap', r: 92, dur: 5, fx: ['Puff_Pink', 'Sparkle_RSE'] }, // a sweet scent lingers over an area
  swift: { arch: 'projectile', n: 5, spread: 0.16, home: 1.5 }, // star-shaped rays that never miss
  swordsdance: { arch: 'self' }, // a war dance
  synchronoise: { arch: 'area', r: 130 }, // an odd shock wave all around
  synthesis: { arch: 'self' }, // heals
  tackle: { arch: 'dash' }, // charges into the foe
  tailslap: { arch: 'melee' }, // tail slaps
  tailwhip: { arch: 'area', r: 100 }, // wags its tail at everyone near
  tailwind: { arch: 'self' }, // side wind
  takedown: { arch: 'dash' }, // a reckless charge
  taunt: { arch: 'beam', w: 30 }, // taunts the foe
  teeterdance: { arch: 'area', r: 110 }, // a wobbly dance that confuses everyone near
  temperflare: { arch: 'dash' }, // a desperate fiery charge
  terablast: { arch: 'projectile' }, // a burst of energy
  terrainpulse: { arch: 'projectile' }, // a pulse of terrain power
  thief: { arch: 'lunge' }, // darts in and steals
  thrash: { arch: 'dash', dist: 1.4 }, // a long rampage
  throatchop: { arch: 'melee' }, // a chop to the throat
  thunder: { arch: 'strike' }, // a lightning bolt drops on the target
  thunderbolt: { arch: 'laser' }, // a strong electric blast
  thunderfang: { arch: 'melee' }, // bites with electric fangs
  thunderpunch: { arch: 'melee' }, // an electric punch
  thundershock: { arch: 'projectile', spd: 1.2 }, // a quick jolt
  thunderwave: { arch: 'trap', r: 70, dur: 4, fx: ['Circle_Tiny_Yellow', 'Wave_Circle_Yellow'] }, // a field of weak static that paralyses
  tickle: { arch: 'melee' }, // tickles
  toxic: { arch: 'trap', r: 70, dur: 5, fx: ['Bubbles_Purple', 'Smoke_Purple'] }, // a pool of bad poison
  toxicspikes: { arch: 'hazard' }, // field hazard
  transform: { arch: 'self' }, // melts into a copy of the foe
  trailblaze: { arch: 'dash' }, // leaps out from tall grass
  triattack: { arch: 'projectile', n: 3, spread: 0.15 }, // three simultaneous beams
  tripleaxel: { arch: 'melee' }, // three spinning kicks
  trumpcard: { arch: 'projectile' }, // a card shot
  twineedle: { arch: 'projectile' }, // fires two stingers
  twister: { arch: 'trap', r: 62, dur: 2, every: 0.4, mul: 0.3, pull: 30, big: 'Gust_Blue', fx: ['Gust_Wind'] }, // a vicious twister at the spot
  upperhand: { arch: 'lunge' }, // darts in first to strike
  uproar: { arch: 'wave', w: 130 }, // an uproar of noise
  uturn: { arch: 'lunge' }, // rushes in, hits, then swaps out
  vacuumwave: { arch: 'projectile', spd: 1.3 }, // a vacuum wave from whirling fists, first
  venoshock: { arch: 'lob' }, // drenches the spot in poisonous liquid
  vinewhip: { arch: 'melee', reach: 40 }, // whips with long vines
  visegrip: { arch: 'melee' }, // grips with pincers
  vitalthrow: { arch: 'melee' }, // a throw
  voltswitch: { arch: 'projectile' }, // an electric pulse, then swaps out
  volttackle: { arch: 'dash' }, // an electrified charge
  wakeupslap: { arch: 'melee' }, // a slap
  waterfall: { arch: 'dash' }, // charges at the foe at tremendous speed
  watergun: { arch: 'laser' }, // a stream of water
  waterpledge: { arch: 'strike' }, // a column of water on the target
  waterpulse: { arch: 'projectile', r: 1.2 }, // a pulsing blast of water
  waterspout: { arch: 'lob', n: 4, r: 50 }, // spouts water that rains down around the aimed spot
  wavecrash: { arch: 'dash' }, // shrouds itself in water and slams in
  weatherball: { arch: 'lob' }, // a weather-powered ball
  whirlpool: { arch: 'trap', r: 64, dur: 4, every: 0.5, mul: 0.3, pull: 80, big: 'Gust_Blue', fx: ['Bubbles_Blue'] }, // a whirlpool that drags the foe in
  whirlwind: { arch: 'wave', w: 130, push: 950 }, // a huge gust that blows the foe away and, like the games, forces a switch (owner confirmed 2026-10-14)
  wildcharge: { arch: 'dash' }, // an electric charge
  willowisp: { arch: 'trap', r: 64, dur: 5, fx: ['Grudge_Lights', 'Will_O_Wisp'] }, // sinister floating flames that burn
  wingattack: { arch: 'lunge' }, // rushes in, striking with wings spread
  withdraw: { arch: 'self' }, // withdraws into its shell
  woodhammer: { arch: 'dash' }, // slams its rugged body in
  workup: { arch: 'self' }, // revs up
  wrap: { arch: 'melee' }, // wraps the foe
  wringout: { arch: 'melee' }, // wrings the foe
  xscissor: { arch: 'lunge' }, // rushes in with crossed scythes
  yawn: { arch: 'projectile', r: 1.6, spd: 0.6 }, // a slow, drowsy yawn bubble
  zapcannon: { arch: 'laser' }, // an electric cannon
  zenheadbutt: { arch: 'dash' }, // a psychic headbutt charge
  aeroblast: { arch: 'beam', w: 40 }, // a whirlwind fired as a piercing line
  armthrust: { arch: 'melee' }, // rapid open-palm thrusts
  barbbarrage: { arch: 'projectile', n: 3, spread: 0.2 }, // volley of poison barbs
  cottonguard: { arch: 'self' }, // wraps itself in cotton
  cottonspore: { arch: 'trap', r: 80, dur: 5, slow: 0.6, fx: ['Puff_Pink', 'Sparkle_RSE'] }, // drifting cotton spores slow the foe
  eeriespell: { arch: 'projectile', r: 1.1 }, // an eerie psychic orb
  eruption: { arch: 'lob', n: 5, r: 60 }, // lava erupts and rains down around the aimed spot
  fairywind: { arch: 'wave', w: 90, push: 200 }, // a gentle gust of fairy wind
  hyperdrill: { arch: 'dash' }, // drills in at the foe
  infernalparade: { arch: 'projectile', n: 3, spread: 0.3 }, // ghostly flames fan out
  milkdrink: { arch: 'self' }, // drinks milk to heal
  psychoboost: { arch: 'strike' }, // huge psychic blast on the target (locked reticle rule)
  psyshieldbash: { arch: 'dash' }, // shield-first psychic ram
  sacredfire: { arch: 'projectile', r: 1.3, spd: 0.9 }, // a mystical fire ball
  stickyweb: { arch: 'hazard' }, // field hazard
  tearfullook: { arch: 'area', r: 130 }, // teary eyes weaken everything nearby
  toxicthread: { arch: 'trap', r: 72, dur: 5, slow: 0.5, fx: ['String_Shot_Web', 'Bubbles_Purple'] }, // poisonous thread bogs the foe
  triplekick: { arch: 'melee' }, // three rising kicks
  twinbeam: { arch: 'beam', w: 30 }, // two psychic beams as one line
};
