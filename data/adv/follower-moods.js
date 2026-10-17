// The lead Pokemon's mood lines (src/adv-follower.js picks one when you talk to it). Edit freely: plain short sentences, no em dashes.
// Placeholders: {n} nickname or species name, {sp} species name, {lv} level, {foe} beaten trainer or wild species, {town} town, {mv} move, {to} evolved species, {who} a party mon, {nm} the caught species.
// tones[x].emo is the portrait fallback list (the first emotion the species has wins, else Normal). Pools are picked by the biggest thing driving the mood.
window.ADV_FOLLOWER = {
  half: 600,   // seconds for an event's pull on the mood to halve; an event is forgotten after 3 half-lives
  tones: {
    joy: { emo: ['Joyous', 'Happy', 'Inspired'], lines: ['{n} is bouncing on the spot.', '{n} cannot stop grinning.', 'It is a very good day for {n}.', '{n} looks like it could run all the way to the coast.'] },
    proud: { emo: ['Inspired', 'Determined', 'Happy'], lines: ['{n} puffs up its chest.', '{n} stands tall at level {lv}.', '{n} looks ready for whatever comes next.', '{n} gives you a confident nod.'] },
    happy: { emo: ['Happy', 'Joyous', 'Normal'], lines: ['{n} is in a good mood.', '{n} looks happy to be out walking with you.', '{n} hums quietly to itself.', '{n} seems content.'] },
    calm: { emo: ['Normal'], lines: ['{n} is calmly keeping pace with you.', '{n} looks around, relaxed.', '{n} is just enjoying the walk.', '{n} gives you a patient look.'] },
    sleepy: { emo: ['Sigh', 'Normal'], lines: ['{n} stifles a yawn.', '{n} keeps blinking slowly.', '{n} looks ready to curl up somewhere.', '{n} is trying hard to stay awake.'] },
    worried: { emo: ['Worried', 'Sad'], lines: ['{n} keeps glancing around.', '{n} stays close to you.', '{n} looks a little nervous.', '{n} does not seem sure about this place.'] },
    uneasy: { emo: ['Worried', 'Sigh', 'Surprised'], lines: ['{n} looks uncomfortable.', '{n} would rather be somewhere else right now.', '{n} gives a small, unhappy huff.', '{n} fidgets and sighs.'] },
    sad: { emo: ['Teary-Eyed', 'Sad', 'Crying'], lines: ['{n} is quiet and a bit teary.', '{n} leans against your leg.', '{n} has not quite shaken off the bad news.', '{n} looks down at the ground.'] },
    hurt: { emo: ['Pain', 'Teary-Eyed', 'Worried'], lines: ['{n} is hurting and trying not to show it.', '{n} winces with every step.', '{n} needs a rest and a Potion.', '{n} looks tired and sore.'] },
    curious: { emo: ['Surprised', 'Inspired', 'Normal'], lines: ['{n} cannot stop looking around.', '{n} is sniffing at everything.', '{n} perks up at all the new sights.', '{n} tilts its head at the scenery.'] },
    playful: { emo: ['Inspired', 'Happy', 'Joyous'], lines: ['{n} is full of mischief.', '{n} looks like it wants to play.', '{n} nudges you, daring you to chase it.', '{n} has a spring in its step.'] },
  },
  // things that happened lately; the line names the event
  events: {
    win: ['{n} is still buzzing from beating {foe}.', '{n} keeps replaying the fight with {foe}.', 'That win over {foe} has {n} walking tall.'],
    lose: ['{n} is still shaken from the blackout.', '{n} did not like losing that fight one bit.', '{n} wants to get stronger after that defeat.'],
    faint: ['{n} is worried about {who} after that fight.', '{n} keeps looking back, thinking about {who} going down.', '{n} hopes {who} is all right.'],
    level: ['{n} just grew to level {lv} and feels stronger.', 'Level {lv}! {n} keeps flexing.', '{n} cannot get over reaching level {lv}.'],
    evolve: ['{n} still cannot believe it became {to}.', 'Being {to} feels strange and wonderful to {n}.', '{n} keeps checking out its new look.'],
    move: ['{n} is practising {mv} when it thinks you are not looking.', '{n} is proud of learning {mv}.', '{n} keeps trying out {mv}.'],
    catch: ['{n} is curious about the new {nm} in your bag.', '{n} wonders if {nm} will get along with everyone.', '{n} is excited to have a new friend, {nm}.'],
    heal: ['{n} feels all patched up after the Center.', 'The Center left {n} feeling fresh.', '{n} says the nurse has gentle hands.'],
    town: ['{n} is taking in the sights of {town}.', '{n} is excited to be in {town}.', '{n} sniffs the air of {town}.'],
  },
  // the place and the weather, by the kind of Pokemon it is
  env: {
    rain_fire: ['{n} hates the rain and keeps its head down.', 'The rain makes {n} sulk.', '{n} flinches at every drop.'],
    rain_water: ['{n} loves the rain.', '{n} splashes about happily in the rain.', 'The rain has {n} in great spirits.'],
    rain: ['{n} watches the rain fall.', '{n} shakes the water off now and then.'],
    snow_ice: ['{n} is delighted by the snow.', '{n} is right at home in the snow.', '{n} rolls around in the snow.'],
    snow_fire: ['{n} shivers in the snow.', '{n} keeps huddling close to you for warmth.'],
    snow: ['{n} blinks at all the snow.', '{n} leaves tiny tracks in the snow.'],
    sun_fire: ['{n} is soaking up the sun.', '{n} loves the warm sunshine.'],
    sun_ice: ['{n} is wilting in the heat.', '{n} keeps looking for some shade.'],
    water_near: ['{n} is happy to be near the water.', '{n} keeps eyeing the water.', '{n} feels right at home by the water.'],
    night_ghost: ['{n} perks up now that it is dark.', '{n} is wide awake and playing with the shadows.', 'Night is {n}\'s time to shine.'],
    night: ['{n} is getting sleepy in the dark.', '{n} yawns under the night sky.'],
    cave_bad: ['{n} does not like how dark it is in here.', '{n} stays glued to your side in the dark.', '{n} flinches at every echo.'],
    cave_ok: ['{n} seems at ease in the cave.', '{n} likes the cool, quiet rock.'],
    grass: ['{n} is having fun in the tall grass.', '{n} rustles through the grass happily.'],
    indoors: ['{n} looks around the room.', '{n} is happy to be out of the wind.'],
    town: ['{n} watches the townsfolk go by.', '{n} likes the busy streets.'],
  },
  state: {
    hp_low: ['{n} is very low on health.', '{n} is barely holding on.', '{n} badly needs healing.'],
    hp_mid: ['{n} is a little banged up.', '{n} could do with some healing soon.'],
    status: ['{n} is not feeling well.', '{n} looks off colour.'],
  },
  // what it is doing right now (the talk box can say so)
  doing: {
    sleep: ['{n} is fast asleep. Zzz.', '{n} opens one eye, then drifts back to sleep.', '{n} is dreaming and twitching its paws.'],
    eat: ['{n} is nibbling on something it found.', '{n} munches happily on the wild plants.'],
    water: ['{n} is gazing at the water.', '{n} is watching the ripples.'],
    sign: ['{n} is trying to read the sign.', '{n} is staring at the sign as if it could read.'],
    npc: ['{n} is watching the people nearby.', '{n} wants to say hello to someone.'],
    look: ['{n} is looking around.', '{n} is keeping an eye out for you.'],
    wander: ['{n} is exploring around here.', '{n} just came back from sniffing around.'],
    hop: ['{n} is hopping about.', '{n} cannot keep still.'],
  },
  // friendship colours the voice: low = shy, high = affectionate (one of these is added to the pool)
  bond: {
    low: ['{n} keeps a little distance but stays near.', '{n} is still getting used to you.'],
    high: ['{n} nuzzles your hand.', '{n} looks at you with complete trust.', '{n} loves walking with you.'],
  },
};
