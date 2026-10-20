// Builds data/adv/rooms/t4-cave.js (the Route 4 cave, the one room map left) and tools/adv-towns/<code>-in.json for Goldacre, Salt Bay, Longshore, Tradeway, Pinegrove, Spindlewood and Sporehaven (the interiors that live inside their buildings, S2). Run: node tools/adv-build-rooms.mjs
// SPECS are the S1b room specs, kept as the source of every person, line, script and trainer; their old floor plans (W, H, items, exit) are unused now: each town's rooms are dealt a furnished interior below (templates TPL, HALL, MARKET, GYM6, GYM8).
// Every line is bible grounded (Goldacre, Whitney, Appendix A) or plain flavour, short, no dashes.
import fs from 'node:fs';
const T = 32;
const out = new URL('../data/adv/rooms/', import.meta.url);
const INTP = {}; new Function('window', fs.readFileSync(new URL('../data/adv/tileset-int.js', import.meta.url), 'utf8'))(INTP);
const x2 = n => (INTP.ADV_TILESET_INT.props[n + '2x'] ? n + '2x' : n);   // exterior art in a room: the doubled copy in the interior sheet (see adv-build-interior.py EXT2X)
fs.mkdirSync(out, { recursive: true });

const npc = (id, x, y, sprite, face, lines, o = {}) => ({ id, x, y, sprite, face, move: o.move || 'still', ...(o.r ? { r: o.r } : {}), ...(lines ? { lines } : {}), ...o.extra });
const farm = (n, cls, name, sprite, face, sight, money, team, say, lose, x, y) => npc(n, x, y, sprite, face, [lose], { extra: { trainer: { cls, name, ...(cls === 'Rancher' ? { avatar: 'hiker' } : {}), gym: true, sight, money, team, say, lose } } });

const SPECS = [
  // ---------- T5 Salt Bay: a Center, the family general store and six houses; every line from the bible's Salt Bay file or plain flavour ----------
  { id: 't5-center', theme: 'center', W: 14, H: 8, exit: [6, 7],
    items: [['winWide', 3, -0.45], ['winWide', 11, -0.45], ['paintingSea', 7, -0.6], ['counterCurve', 7, 3], ['healMachine', 11.4, 3.2], ['pcBlue', 1.6, 3], ['plantC', 1, 8], ['plantC', 13, 8], ['sofaBlue', 4, 6.9], ['plantA', 12.4, 6.8]],
    mach: [11.4, 3.2],
    npcs: [npc('t5-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('t5-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('t5-c-fisher', 10, 5, 'fishing', 6, ['We do not get many visitors. The road ends at the water, so you came on purpose.'], { move: 'wander', r: 2 }),
      npc('t5-c-boy', 2, 5, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 't5-mart', theme: 'mart', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 6, -0.5], ['shelfPotion', 1.5, 2.3], ['shelfGreen', 3.5, 2.3], ['counterRed', 9, 3], ['tableBrownSmall', 3, 5.2], ['plantA', 0.8, 7], ['plantA', 11.2, 7]],
    npcs: [npc('t5-clerk', 9, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('t5-m-mama', 3, 4, 'gsmama', 0, ['The shop has been in the family a long time. Cherimart never thought the trip worth it.'], { move: 'wander', r: 1 }),
      npc('t5-m-fisher', 8, 5, 'fishing2', 6, ['Deep cold water holds little. That is why the catch is so thin out here.'])] },
  { id: 't5-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 1.6, 2.8], ['shelfBooks', 6.2, 2.3], ['tableBrownSmall', 6, 4.8], ['plantB', 0.8, 6]],
    npcs: [npc('t5-h1-old', 4, 3, 'gsoldman', 0, ['Four generations of my family have done nothing but fish. We teach anyone who asks nicely.'], { move: 'wander', r: 1 }), npc('t5-h1-girl', 7, 4, 'gsgirl2', 6, ['Someone tried to measure the bay once. Everyone tells the story, and nobody tells it the same.'])] },
  { id: 't5-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 6, -0.45], ['bedPlain', 1.5, 2.8], ['sofaBlue', 6.6, 5.3], ['plantA', 8.2, 2.7], ['plantB', 0.8, 6]],
    npcs: [npc('t5-h2-woman', 3, 4, 'woman3', 2, ['Twenty metres from shore the ground is just gone. Nets come up from depths that make no sense.'])] },
  { id: 't5-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4],
    items: [['winSmall', 2, -0.5], ['shelfGreen', 5.8, 2.3], ['tableBrownSmall', 3.2, 4.8], ['plantC', 0.8, 6]],
    npcs: [npc('t5-h3-boy', 5, 4, 'boy1', 6, ['Lapras are bred at Sailsport, not here. The bay is too deep, Grandad says.'])] },
  { id: 't5-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedPink', 1.6, 2.8], ['shelfBooks', 7, 2.3], ['plantB', 0.8, 6], ['plantA', 8.3, 6]],
    npcs: [npc('t5-h4-nan', 3, 4, 'oldwoman', 0, ['Feebas is our white whale. Every fisherman here has an opinion about where it bites.'], { move: 'wander', r: 1 }), npc('t5-h4-man', 6, 4, 'gsman1', 6, ['Some of us have been after a Feebas for most of our lives.'])] },
  { id: 't5-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 7.4, 2.8], ['stoveRed', 3, 2.3], ['tableBrownSmall', 4.5, 4.9], ['plantA', 0.8, 6]],
    npcs: [npc('t5-h5-man', 6, 4, 'gsmiddleman', 6, ['We are not struggling and we are not hiding anything. We just like it quiet.'])] },
  { id: 't5-h6', theme: 'home3', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedPlain', 1.5, 2.8], ['shelfBooks', 6.6, 2.3], ['plantB', 8.2, 6]],
    npcs: [npc('t5-h6-sailor', 6, 4, 'seaman', 6, ['You do not learn to surf casually on water like this. Learn properly, or do not go out.']), npc('t5-h6-woman', 3, 3, 'gswoman1', 0, ['The Longshore lot surf for fun, in rented gear. Mostly shouting. We are not impressed.'], { move: 'wander', r: 1 })] },
  // ---------- T7 Longshore: a Center, the beach store and five holiday houses; every line from the bible's Longshore and Route 6 files or plain flavour ----------
  { id: 't7-center', theme: 'center', W: 14, H: 8, exit: [6, 7],
    items: [['winWide', 3, -0.45], ['winWide', 11, -0.45], ['paintingSea', 7, -0.6], ['counterCurve', 7, 3], ['healMachine', 11.4, 3.2], ['pcBlue', 1.6, 3], ['plantC', 1, 8], ['plantC', 13, 8], ['sofaBlue', 4, 6.9], ['plantA', 12.4, 6.8]],
    mach: [11.4, 3.2],
    npcs: [npc('t7-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('t7-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('t7-c-tourist', 10, 5, 'gswoman1', 6, ['Wide beach, boardwalk, swimming, ice cream, sunburn. I come every summer.'], { move: 'wander', r: 2 }),
      npc('t7-c-boy', 2, 5, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 't7-mart', theme: 'mart', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 6, -0.5], ['shelfPotion', 1.5, 2.3], ['shelfGreen', 3.5, 2.3], ['counterRed', 9, 3], ['tableBrownSmall', 3, 5.2], ['plantA', 0.8, 7], ['plantA', 11.2, 7]],
    npcs: [npc('t7-clerk', 9, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('t7-m-mama', 3, 4, 'gsmama', 0, ['Everything on these shelves came down Route 6 from the Goldacre farms.'], { move: 'wander', r: 1 }),
      npc('t7-m-kid', 8, 5, 'boy3', 6, ['Sunscreen sells out first. Ice cream sells out second.'])] },
  { id: 't7-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 1.6, 2.8], ['shelfBooks', 6.2, 2.3], ['tableBrownSmall', 6, 4.8], ['plantB', 0.8, 6]],
    npcs: [npc('t7-h1-host', 4, 3, 'woman3', 0, ['We let rooms in summer. In winter half this street is shuttered.'], { move: 'wander', r: 1 }), npc('t7-h1-kid', 7, 4, 'boy1', 6, ['I swam out so far and the water was still only up to my chest!'])] },
  { id: 't7-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 6, -0.45], ['bedPlain', 1.5, 2.8], ['sofaBlue', 6.6, 5.3], ['plantA', 8.2, 2.7], ['plantB', 0.8, 6]],
    npcs: [npc('t7-h2-old', 3, 4, 'gsoldman', 2, ['The sea here has never been over anyone\'s head. That is why the families come.']), npc('t7-h2-girl', 6, 3, 'gsgirl2', 0, ['The Sharpedo signs are real. Nobody minds them, because nothing has ever happened.'])] },
  { id: 't7-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4],
    items: [['winSmall', 2, -0.5], ['shelfGreen', 5.8, 2.3], ['tableBrownSmall', 3.2, 4.8], ['plantC', 0.8, 6]],
    npcs: [npc('t7-h3-van', 5, 4, 'delivery', 6, ['The vans come down Route 6 from Goldacre every morning. The boardwalk eats it all.'])] },
  { id: 't7-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedPink', 1.6, 2.8], ['shelfBooks', 7, 2.3], ['plantB', 0.8, 6], ['plantA', 8.3, 6]],
    npcs: [npc('t7-h4-nan', 3, 4, 'oldwoman', 0, ['Sandygast are castles some child left behind. They drag things down into the sand.'], { move: 'wander', r: 1 }), npc('t7-h4-man', 6, 4, 'seaman', 6, ['We set the deckchairs out well away from the castles. Every morning, all season.'])] },
  { id: 't7-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 7.4, 2.8], ['stoveRed', 3, 2.3], ['tableBrownSmall', 4.5, 4.9], ['plantA', 0.8, 6]],
    npcs: [npc('t7-h5-woman', 6, 4, 'gswoman1', 6, ['We surf for fun, in rented gear, with a lot of shouting. Salt Bay thinks we do it wrong.']), npc('t7-h5-man', 2, 4, 'gsmiddleman', 2, ['Sprucevale is busiest in winter, we are busiest in summer. We each fill the other\'s quiet months.'])] },
];

// ---------- T4 Tradeway: a Center, the Market Hall (the independent trade: rare stock by the day, wild prices, barter) and five houses; every line from the bible's Tradeway and Route 4 files or plain flavour ----------
SPECS.push(
  { id: 't4-center', theme: 'center', W: 14, H: 8, exit: [6, 7],
    items: [['winWide', 3, -0.45], ['winWide', 11, -0.45], ['paintingSea', 7, -0.6], ['counterCurve', 7, 3], ['healMachine', 11.4, 3.2], ['pcBlue', 1.6, 3], ['plantC', 1, 8], ['plantC', 13, 8], ['sofaBlue', 4, 6.9], ['plantA', 12.4, 6.8]],
    mach: [11.4, 3.2],
    npcs: [npc('t4-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('t4-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('t4-c-trader', 10, 5, 'gsmiddleman', 6, ['Cherimart owns every Mart in Kenora, but not this town. I like it that way.'], { move: 'wander', r: 2 }),
      npc('t4-c-boy', 2, 5, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 't4-market', theme: 'barn', W: 16, H: 10, exit: [7, 9],
    items: [['winArch', 3.5, -0.4], ['winArch', 12.5, -0.4], ['boardGreen', 8, -0.6], ['counterRed', 4, 3], ['counterRed', 12, 3], ['shelfGreen', 1, 2.3], ['shelfPotion', 7.5, 2.3], ['shelfBooks', 15, 2.3],
      ['tableBrownLong', 4.5, 7], ['tableBrownLong', 11.5, 7], ['crateWide', 1.4, 9.4], ['barrelOrange', 14.6, 9.6], ['plantA', 0.8, 5.5], ['plantC', 15.2, 5.6]],
    npcs: [npc('t4-clerk', 4, 1, 'shopm', 0, ['Cherimart owns every Mart in Kenora. It does not own this counter.', 'What I have today is not what I will have next week. Take it or leave it.'], { extra: { name: 'Trader', script: 'clerk', market: true, reach: 66 } }),
      npc('t4-barter', 12, 1, 'gsman2', 0, ['Many of us deal goods for goods. Show me something I want and we can talk.'], { extra: { name: 'Barterer', script: 'barter', reach: 66 } }),
      npc('t4-m-buyer', 8, 5, 'gswoman1', 2, ['The best prices in the region are here. The stock is a gamble, though.'], { move: 'wander', r: 2 }),
      npc('t4-m-grower', 13, 6, 'farmer', 6, ['I carry my own crates in. Tradeway pays cash and asks nothing.']),
      npc('t4-m-nick', 2, 6, 'boy3', 0, ['Nickit and Purrloin work the stalls. Every trader here complains about them constantly.'], { move: 'wander', r: 1 })] },
  { id: 't4-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 1.6, 2.8], ['shelfBooks', 6.2, 2.3], ['tableBrownSmall', 6, 4.8], ['plantB', 0.8, 6]],
    npcs: [npc('t4-h1-woman', 4, 3, 'woman3', 0, ['Dead centre of Kenora. Every road meets here, so everyone comes through.'], { move: 'wander', r: 1 }), npc('t4-h1-kid', 7, 4, 'boy1', 6, ['I sold my first box of Poke Balls at the cave mouth. Mum made me give half back.'])] },
  { id: 't4-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 6, -0.45], ['bedPlain', 1.5, 2.8], ['sofaBlue', 6.6, 5.3], ['plantA', 8.2, 2.7], ['plantB', 0.8, 6]],
    npcs: [npc('t4-h2-old', 3, 4, 'gsoldman', 2, ['The market started in the cave mouth, in the shade. Now the stalls go a long way in.']), npc('t4-h2-man', 6, 3, 'gsman1', 0, ['Hallowmead growers use the orchard cut to reach us. They keep an independent price that way.'])] },
  { id: 't4-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4],
    items: [['winSmall', 2, -0.5], ['shelfGreen', 5.8, 2.3], ['tableBrownSmall', 3.2, 4.8], ['plantC', 0.8, 6]],
    npcs: [npc('t4-h3-van', 5, 4, 'delivery', 6, ['Goldacre sends its crates up the market road. We pay cash and ask nothing.'])] },
  { id: 't4-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedPink', 1.6, 2.8], ['shelfBooks', 7, 2.3], ['plantB', 0.8, 6], ['plantA', 8.3, 6]],
    npcs: [npc('t4-h4-nan', 3, 4, 'oldwoman', 0, ['Timber comes up from Pinegrove, and tools and supplies go back down.'], { move: 'wander', r: 1 }), npc('t4-h4-man', 6, 4, 'workman', 6, ['Claystone\'s finds come down the spoil road. Claystone\'s fortunes went with them.'])] },
  { id: 't4-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 7.4, 2.8], ['stoveRed', 3, 2.3], ['tableBrownSmall', 4.5, 4.9], ['plantA', 0.8, 6]],
    npcs: [npc('t4-h5-driver', 6, 4, 'workman', 6, ['Everything on a Cherimart shelf has been down the freight run from here to Aldermere.']), npc('t4-h5-woman', 2, 4, 'gswoman1', 2, ['Past the last stall the road gets dark. I never ask what is further in.'])] },
);

// ---------- G6 Pinegrove: a Center, the Outfitters (the local general store), the forestry office, five houses and Aspen's sawmill; every line from the bible's Pinegrove, Route 3 and Route 111 files or plain flavour ----------
const lj = (id, cls, name, sprite, face, av, money, team, say, lose, x, y) => npc(id, x, y, sprite, face, [lose], { extra: { trainer: { cls, name, avatar: av, gym: true, sight: 5, money, team, say, lose } } });
SPECS.push(
  { id: 'g6-center', theme: 'center', W: 14, H: 8, exit: [6, 7],
    items: [['winWide', 3, -0.45], ['winWide', 11, -0.45], ['paintingSea', 7, -0.6], ['counterCurve', 7, 3], ['healMachine', 11.4, 3.2], ['pcBlue', 1.6, 3], ['plantC', 1, 8], ['plantC', 13, 8], ['sofaBlue', 4, 6.9], ['plantA', 12.4, 6.8]],
    mach: [11.4, 3.2],
    npcs: [npc('g6-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('g6-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('g6-c-feller', 10, 5, 'workman', 6, ['A good day of felling ends here. The Nurse has seen every kind of splinter.'], { move: 'wander', r: 2 }),
      npc('g6-c-boy', 2, 5, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 'g6-mart', theme: 'mart', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 6, -0.5], ['shelfPotion', 1.5, 2.3], ['shelfGreen', 3.5, 2.3], ['counterRed', 9, 3], ['tableBrownSmall', 3, 5.2], ['plantA', 0.8, 7], ['plantA', 11.2, 7]],
    npcs: [npc('g6-clerk', 9, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('g6-m-mama', 4, 4, 'gsmama', 0, ['Axes, rope and Poke Balls on one shelf. We are the Outfitters, not a chain.'], { move: 'wander', r: 1 }),
      npc('g6-m-hauler', 8, 5, 'workman', 6, ['The sawmill road runs to Tradeway. Timber goes one way, tools and supplies come back.'])] },
  { id: 'g6-office', theme: 'home1', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 2.5, -0.5], ['winSmall', 9.5, -0.5], ['boardGreen', 6, -0.6], ['shelfBooks', 1.6, 2.3], ['shelfBooksTall', 10.6, 2.4], ['tableBrownLong', 6, 4.2], ['mapIsland', 3.2, 6.4], ['plantA', 0.8, 7], ['plantB', 11.2, 7]],
    npcs: [npc('g6-o-forester', 5, 2, 'gsoldman', 0, ['Every stand has a number and a date. Felled, replanted, or left alone. It is all written down here.'], { move: 'wander', r: 1 }),
      npc('g6-o-clerk', 8, 5, 'gsman3', 6, ['We plan in decades. A tree planted today is not cut in my lifetime. That is the whole idea.']),
      npc('g6-o-girl', 3, 4, 'gsgirl3', 2, ['Some of the old stumps seem to look back at you. We do not discuss that in here.'])] },
  { id: 'g6-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedPink', 1.6, 2.8], ['shelfBooks', 6.2, 2.3], ['tableBrownSmall', 6, 4.8], ['plantB', 0.8, 6]],
    npcs: [npc('g6-h1-mom', 4, 3, 'woman3', 0, ['My husband fells and my daughter replants. Between them the forest stays the same size.'], { move: 'wander', r: 1 }), npc('g6-h1-kid', 7, 4, 'boy1', 6, ['Aspen has a Kleavor! Nobody else in Kenora has one.'])] },
  { id: 'g6-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 6, -0.45], ['bedPlain', 1.5, 2.8], ['sofaBlue', 6.6, 5.3], ['plantA', 8.2, 2.7], ['plantB', 0.8, 6]],
    npcs: [npc('g6-h2-old', 3, 4, 'gsoldman', 2, ['Claystone? We do not deal with Claystone. No trade, no word. That is how it has always been.']), npc('g6-h2-woman', 6, 3, 'gswoman1', 0, ['Ask Aspen why and she says it is family. Then she changes the subject, very nicely.'])] },
  { id: 'g6-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4],
    items: [['winSmall', 2, -0.5], ['shelfGreen', 5.8, 2.3], ['tableBrownSmall', 3.2, 4.8], ['plantC', 0.8, 6]],
    npcs: [npc('g6-h3-driver', 5, 4, 'workman', 6, ['I drive the haul down Route 111 every morning. Spindlewood, then the sea.'])] },
  { id: 'g6-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedBlue', 1.6, 2.8], ['shelfBooks', 7, 2.3], ['plantB', 0.8, 6], ['plantA', 8.3, 6]],
    npcs: [npc('g6-h4-nan', 3, 4, 'oldwoman', 0, ['Read the stand numbers on Route 3 and you know the whole rotation. Fresh cut, replanted, left alone.'], { move: 'wander', r: 1 }), npc('g6-h4-man', 6, 4, 'gsman1', 6, ['Timber from here goes all the way to Sprucevale. Every carved gable up there is ours.'])] },
  { id: 'g6-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 7.4, 2.8], ['stoveRed', 3, 2.3], ['tableBrownSmall', 4.5, 4.9], ['plantA', 0.8, 6]],
    npcs: [npc('g6-h5-mama', 6, 4, 'gsmama', 6, ['Bonsly stand among the saplings. You cannot tell them from the trees.']), npc('g6-h5-man', 2, 4, 'gsmiddleman', 2, ['Route 3 is quiet at night. We do not stare at the stumps.'])] },
  { id: 'g6-gym', theme: 'barn', W: 18, H: 13, exit: [8, 9],
    items: [['winSmall', 3, -0.5], ['winSmall', 15, -0.5], ['boardGreen', 9, -0.6],
      ['fallenLog', 2.4, 12.6], ['logShort', 16, 12.6], ['fallenLog', 16.4, 9.6], ['fallenLog', 1.6, 6.2], ['barrelOrange', 12.6, 12.4], ['crateWide', 5.4, 12.4], ['logShort', 12.4, 7.6]],
    npcs: [
      npc('g6-aspen', 9, 1, 'middlewoman', 0, ['The mill never stops, and neither does this town.', 'Come back whenever you like. Mind the saws.'], { extra: { name: 'Aspen', trainer: {
        cls: 'Gym Leader', name: 'Aspen', leader: 'aspen', avatar: 'gardenia', gym: true, sight: 0, money: 80, tm: 'tm_bulkup', badge: 'Pinegrove Badge', after: ['g6-gym-hewitt', 'g6-gym-cord', 'g6-gym-tilly'],
        wait: ['Welcome to the mill! My crew will want a word with you first.', 'See all three, and then come and find me.'],
        say: ['Welcome to Pinegrove! Every board in town passes through this mill.', 'We cut, we haul, and we plant it all back. Now let me see what you have grown.', 'Mind the saws. They do not care who is winning.'],
        say2: ['Back for another go? Good. Mind the saws.'],
        lose: ['Well felled! I am proud of you, and I mean that.', 'You earned that the long way, same as everything worth having in Pinegrove.'] } } }),
      lj('g6-gym-hewitt', 'Lumberjack', 'Hewitt', 'workman', 2, 'hiker', 30, [['axew', 0], ['pawniard', 0], ['bonsly', 1], ['scyther', 1], ['heracross', 2], ['pinsir', 2]], 'Every board starts as a tree I put down myself. Show me you can handle an axe!', 'Clean cut. You fight as well as you fell.', 4, 9),
      lj('g6-gym-cord', 'Lumberjack', 'Cord', 'bigman', 2, 'hiker', 30, [['timburr', 0], ['machop', 0], ['timburr', 1], ['machop', 1], ['sawk', 2], ['throh', 2]], 'I carry logs all day long. A battle is light work next to that!', 'Dropped it. That was a heavy one.', 4, 6),
      lj('g6-gym-tilly', 'Teamster', 'Tilly', 'gswoman1', 6, 'cowgirl', 30, [['cufant', 0], ['mudbray', 0], ['rhyhorn', 1], ['tauros', 1], ['bouffalant', 2], ['gogoat', 2]], 'My team hauls what the others cut. They never tire, and neither do I.', 'Ha! You are stronger than a full load.', 12, 4),
      npc('g6-gym-guide', 5, 11, 'gsman2', 0, ['Aspen runs this mill herself, and the whole town loves her for it.', 'Do not ask her about Claystone. She says it is family, and then she says nothing more.'])] },
);

// ---------- T6 Spindlewood: a Center, the dock store (rope, tackle and Poke Balls; a single stubborn shopkeeper) and five dockers' houses; every line from the bible's Spindlewood, Route 102 and Route 111 files or plain flavour. Nothing about the boats' real business: that is the story pass ----------
SPECS.push(
  { id: 't6-center', theme: 'center', W: 14, H: 8, exit: [6, 7],
    items: [['winWide', 3, -0.45], ['winWide', 11, -0.45], ['paintingSea', 7, -0.6], ['counterCurve', 7, 3], ['healMachine', 11.4, 3.2], ['pcBlue', 1.6, 3], ['plantC', 1, 8], ['plantC', 13, 8], ['sofaBlue', 4, 6.9], ['plantA', 12.4, 6.8]],
    mach: [11.4, 3.2],
    npcs: [npc('t6-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('t6-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('t6-c-hand', 10, 5, 'workman', 6, ['Crushed fingers, splinters, the odd rope burn. The Nurse has seen every one.'], { move: 'wander', r: 2 }),
      npc('t6-c-boy', 2, 5, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 't6-mart', theme: 'mart', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 6, -0.5], ['shelfPotion', 1.5, 2.3], ['shelfGreen', 3.5, 2.3], ['counterRed', 9, 3], ['mapIsland', 7, 0.1], ['tableBrownSmall', 3, 5.2], ['plantA', 0.8, 7], ['plantA', 11.2, 7]],
    npcs: [npc('t6-clerk', 9, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('t6-m-keeper', 4, 4, 'gsmiddleman', 0, ['Rope, tackle, tar and Poke Balls. If a sailor asks for it I stock it. If not, I do not.'], { move: 'wander', r: 1 }),
      npc('t6-m-deck', 8, 5, 'seaman', 6, ['The cove is calm, but the lines still chafe. I buy new rope every month.'])] },
  { id: 't6-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 1.6, 2.8], ['shelfBooks', 6.2, 2.3], ['tableBrownSmall', 6, 4.8], ['plantB', 0.8, 6]],
    npcs: [npc('t6-h1-mom', 4, 3, 'woman3', 0, ['My husband loads and my daughter ties up. We all go to bed smelling of pine and salt.'], { move: 'wander', r: 1 }), npc('t6-h1-kid', 7, 4, 'boy1', 6, ['I can name every engine in the cove by its sound. Mum says that is not a talent.'])] },
  { id: 't6-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 6, -0.45], ['bedPlain', 1.5, 2.8], ['sofaBlue', 6.6, 5.3], ['plantA', 8.2, 2.7], ['plantB', 0.8, 6]],
    npcs: [npc('t6-h2-old', 3, 4, 'gsoldman', 2, ['Forty years on this quay. It has been busy every day of them, and I like it that way.']), npc('t6-h2-girl', 6, 3, 'gsgirl2', 0, ['Wimpod live under the boards. When it goes quiet you can hear them scuttling.'])] },
  { id: 't6-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4],
    items: [['winSmall', 2, -0.5], ['shelfGreen', 5.8, 2.3], ['tableBrownSmall', 3.2, 4.8], ['plantC', 0.8, 6]],
    npcs: [npc('t6-h3-crane', 5, 4, 'workman', 6, ['I drive the quay crane. Pinegrove sends the logs and I send them on.'])] },
  { id: 't6-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedPink', 1.6, 2.8], ['shelfBooks', 7, 2.3], ['plantB', 0.8, 6], ['plantA', 8.3, 6]],
    npcs: [npc('t6-h4-nan', 3, 4, 'oldwoman', 0, ['We are not the fungus town. Duskmoss, on the south coast, is the one that lives close to it.'], { move: 'wander', r: 1 }), npc('t6-h4-man', 6, 4, 'gsman1', 6, ['Rot is the enemy. A log with rot in it goes straight back up the road.'])] },
  { id: 't6-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 7.4, 2.8], ['stoveRed', 3, 2.3], ['tableBrownSmall', 4.5, 4.9], ['plantA', 0.8, 6]],
    npcs: [npc('t6-h5-woman', 6, 4, 'gswoman1', 6, ['All our trouble comes off the water. Tides, storms, tangled lines. The land is easy.']), npc('t6-h5-man', 2, 4, 'seaman', 2, ['Nights on the wharf have their own crowd. Zubat, Murkrow, and a big Golisopod.'])] },
);

// ---------- G8 Sporehaven: a Center, the general store, the wardens' lodge, five houses and Rue's gym under the great cap; every line from the bible's Sporehaven, Route 2 and Route 101 files or plain flavour. Nothing story-gated ----------
const sr = (id, cls, name, sprite, face, av, money, team, say, lose, x, y) => npc(id, x, y, sprite, face, [lose], { extra: { trainer: { cls, name, avatar: av, gym: true, sight: 5, money, team, say, lose } } });
SPECS.push(
  { id: 'g8-center', theme: 'center', W: 14, H: 8, exit: [6, 7],
    items: [['winWide', 3, -0.45], ['winWide', 11, -0.45], ['paintingSea', 7, -0.6], ['counterCurve', 7, 3], ['healMachine', 11.4, 3.2], ['pcBlue', 1.6, 3], ['plantC', 1, 8], ['plantC', 13, 8], ['sofaBlue', 4, 6.9], ['plantA', 12.4, 6.8]],
    mach: [11.4, 3.2],
    npcs: [npc('g8-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('g8-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('g8-c-warden', 10, 5, 'workman', 6, ['Spores in the eyes are the usual complaint. The Nurse keeps drops by the dozen.'], { move: 'wander', r: 2 }),
      npc('g8-c-boy', 2, 5, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 'g8-mart', theme: 'mart', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 6, -0.5], ['shelfPotion', 1.5, 2.3], ['shelfGreen', 3.5, 2.3], ['counterRed', 9, 3], ['tableBrownSmall', 3, 5.2], ['plantA', 0.8, 7], ['plantA', 11.2, 7]],
    npcs: [npc('g8-clerk', 9, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('g8-m-keeper', 4, 4, 'gsmama', 0, ['Lamps? Only low ones. Nobody in Sporehaven wants a bright one.'], { move: 'wander', r: 1 }),
      npc('g8-m-warden', 8, 5, 'workman', 6, ['Gloves, masks and shears go out by the crate. The crews wear them out.'])] },
  { id: 'g8-lodge', theme: 'home1', W: 12, H: 7, exit: [5, 6],
    items: [['winSmall', 2.5, -0.5], ['winSmall', 9.5, -0.5], ['boardGreen', 6, -0.6], ['shelfBooks', 1.6, 2.3], ['shelfGreenTall', 10.6, 2.4], ['tableBrownLong', 6, 4.2], ['mapIsland', 3.2, 6.4], ['plantA', 0.8, 7], ['plantB', 11.2, 7]],
    npcs: [npc('g8-l-chief', 5, 2, 'gsoldman', 0, ['Clearing, treating, patrolling. Three jobs, every day, and the forest never runs out of work for us.'], { move: 'wander', r: 1 }),
      npc('g8-l-crew', 8, 5, 'workman', 6, ['We go down to Duskmoss by the east road to hold the line. They are glad to see us.']),
      npc('g8-l-rest', 3, 4, 'gsman3', 2, ['Off shift. I will be asleep in a moment, and you will not see me yawn.'])] },
  { id: 'g8-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedPink', 1.6, 2.8], ['shelfBooks', 6.2, 2.3], ['tableBrownSmall', 6, 4.8], ['plantB', 0.8, 6]],
    npcs: [npc('g8-h1-mom', 4, 3, 'woman3', 0, ['We keep one lamp on, turned low. The window glows blue the rest of the time anyway.'], { move: 'wander', r: 1 }), npc('g8-h1-kid', 7, 4, 'boy1', 6, ['I can read by the window at night. The caps outside are that bright.'])] },
  { id: 'g8-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 6, -0.45], ['bedPlain', 1.5, 2.8], ['sofaBlue', 6.6, 5.3], ['plantA', 8.2, 2.7], ['plantB', 0.8, 6]],
    npcs: [npc('g8-h2-old', 3, 4, 'gsoldman', 2, ['I was born here. The forest outside is the only neighbour I have ever needed.']), npc('g8-h2-woman', 6, 3, 'gswoman1', 0, ['Eerie? I think it is pretty. It is only eerie if you do not live here.'])] },
  { id: 'g8-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4],
    items: [['winSmall', 2, -0.5], ['shelfGreen', 5.8, 2.3], ['tableBrownSmall', 3.2, 4.8], ['plantC', 0.8, 6]],
    npcs: [npc('g8-h3-warden', 5, 4, 'workman', 6, ['Six days on the line, one at home. Nobody thanks a warden, and I still like the job.'])] },
  { id: 'g8-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4],
    items: [['winWide', 4.5, -0.45], ['bedPink', 1.6, 2.8], ['shelfBooks', 7, 2.3], ['plantB', 0.8, 6], ['plantA', 8.3, 6]],
    npcs: [npc('g8-h4-nan', 3, 4, 'oldwoman', 0, ['By day the wood is dim and so is the town. At night they swap, and the wood is the bright one.'], { move: 'wander', r: 1 }), npc('g8-h4-man', 6, 4, 'gsman1', 6, ['A Foongus pretending to be a Poke Ball is the oldest joke in Sporehaven. It still catches visitors.'])] },
  { id: 'g8-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4],
    items: [['winSmall', 2.5, -0.5], ['bedBlue', 7.4, 2.8], ['stoveRed', 3, 2.3], ['tableBrownSmall', 4.5, 4.9], ['plantA', 0.8, 6]],
    npcs: [npc('g8-h5-mama', 6, 4, 'gsmama', 6, ['Shroomish come right up to the doors when it rains. We step round them.']), npc('g8-h5-man', 2, 4, 'gsmiddleman', 2, ['Duskmoss is quiet and kind to our crews. In a job like theirs that is not nothing.'])] },
  { id: 'g8-gym', theme: 'farm', W: 18, H: 13, exit: [8, 9],
    items: [['winArch', 3.5, -0.4], ['winArch', 14.5, -0.4], ['boardGreen', 9, -0.6],
      ['mushroomStump', 2.2, 3.4], ['mushroomStump', 15.8, 3.4], ['mushroomsOrange', 6.4, 3.2], ['mushroomsPale', 11.6, 3], ['mushroomsPale', 1, 6.4], ['mushroomsOrange', 17, 6.2], ['mushroomsRed', 6.2, 7], ['mushroomsPale', 12, 7.4], ['mushroomsPale', 7.4, 11.6], ['mushroomsRed', 10.8, 11.8],
      ['mPlanterEmpty', 2.8, 12.6], ['mPlanterEmpty', 15.2, 12.6], ['mPlanterPot', 2.6, 8.6]],
    npcs: [
      npc('g8-rue', 9, 1, 'lady', 0, ['The forest does the shining. We just keep it where it belongs.', 'Come back whenever you like. Mind the floor.'], { extra: { name: 'Rue', trainer: {
        cls: 'Gym Leader', name: 'Rue', leader: 'rue', avatar: 'erika', gym: true, sight: 0, money: 80, tm: 'tm_gigadrain', badge: 'Sporehaven Badge', after: ['g8-gym-hazel', 'g8-gym-orrin', 'g8-gym-fern'],
        wait: ['My crew keep the front of the hall. Speak to them first.', 'All three, and then come to me.'],
        say: ['A challenger. Good. Mind the floor, it glows when it likes.', 'You have come braced for spores and stall, I would guess. Most do.', 'Most of my team plays the way you expect. Shall we see?'],
        say2: ['Back again. The forest was not finished with you.'],
        lose: ['Well fought. You did not take the easy read of this place.', 'The badge is yours. Go carefully on Route 101. Someone has to keep that line, and it is us.'] } } }),
      sr('g8-gym-hazel', 'Forager', 'Hazel', 'picnicgirl', 6, 'picnicker', 30, [['foongus', 0], ['shroomish', 0], ['morelull', 1], ['paras', 1], ['toedscool', 2], ['foongus', 2]], 'I gather what the forest lets me have. Let us see what you gather!', 'You picked the better basket. On you go.', 13, 9),
      sr('g8-gym-orrin', 'Cultivator', 'Orrin', 'gsoldman', 2, 'scientist', 30, [['oddish', 0], ['bellsprout', 0], ['gloom', 1], ['tangela', 1], ['weepinbell', 2], ['amoonguss', 2]], 'I grow these beds from spore to cap. Do you know how long that takes?', 'Slow work, and you beat it anyway.', 4, 6),
      sr('g8-gym-fern', 'Warden', 'Fern', 'gswoman1', 6, 'backpacker', 30, [['stunky', 0], ['croagunk', 0], ['shroomish', 1], ['stunky', 1], ['toedscool', 2], ['croagunk', 2]], 'I patrol the boundary, and I do not let things cross. Not even you!', 'Nothing crosses my line. Except you, just now.', 13, 4),
      npc('g8-gym-guide', 5, 11, 'gsman2', 0, ['Rue is a warden first and a gym leader second, and she does both without complaint.', 'Her Breloom is the one everybody remembers. I will not say why.'])] },
);

// ---------- T8 Duskmoss: a Center, the general store (one stubborn shopkeeper), the watch house (where anything glowing that should not be gets written down and word goes up the road) and five houses; every line from the bible's Duskmoss, Route 101 and Route 103 files or plain flavour. No gym, nothing story-gated ----------
SPECS.push(
  { id: 't8-center', theme: 'center', W: 14, H: 8, exit: [6, 7], items: [], mach: [11.4, 3.2],
    npcs: [npc('t8-nurse', 6, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('t8-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('t8-c-warden', 10, 5, 'npc1-green-shirt-man', 6, ['I came down from Sporehaven with the crew. The Nurse always has drops ready for our eyes.'], { move: 'wander', r: 2 }),
      npc('t8-c-boy', 2, 5, 'npc2-blue-shirt-boy', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 't8-mart', theme: 'mart', W: 12, H: 7, exit: [5, 6], items: [],
    npcs: [npc('t8-clerk', 9, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('t8-m-keeper', 4, 4, 'npc3-apron-woman', 0, ['I stock what I stock. Poke Balls, rope, rain gear. Ask for something else and I will say no.'], { move: 'wander', r: 1 }),
      npc('t8-m-crew', 8, 5, 'npc2-jumpsuit-man', 6, ['Gloves and masks go out by the crate for the crews. They wear them thin.'])] },
  { id: 't8-lodge', theme: 'home1', W: 12, H: 7, exit: [5, 6], items: [],
    npcs: [npc('t8-l-clerk', 5, 2, 'npc3-white-haired-man', 0, ['Anything glowing that should not be gets written down here. Then word goes up the road.'], { move: 'wander', r: 1 }),
      npc('t8-l-crew', 8, 5, 'npc2-jumpsuit-man', 6, ['The crews sit at this table when they come down. They are welcome here, as always.']),
      npc('t8-l-local', 3, 4, 'npc2-dark-hair-woman', 2, ['We would not be here without them. They know it, we know it, and nobody makes a speech.'])] },
  { id: 't8-h1', theme: 'home1', W: 9, H: 6, exit: [4, 4], items: [],
    npcs: [npc('t8-h1-mom', 4, 3, 'npc3-apron-woman', 0, ['Half this town looks at the glow and half looks at the sea. I married into the sea half.'], { move: 'wander', r: 1 }), npc('t8-h1-kid', 7, 4, 'npc4-vest-boy', 6, ['At night I count the caps I can see from my window. Mum says that is not a game.'])] },
  { id: 't8-h2', theme: 'home2', W: 9, H: 6, exit: [4, 4], items: [],
    npcs: [npc('t8-h2-old', 3, 4, 'npc2-old-man', 2, ['I grew up watching that wall of light. Now I only notice it when a visitor points.']), npc('t8-h2-woman', 6, 3, 'npc2-purple-top-woman', 0, ['A mushroom on the windowsill is nothing. A mushroom on the stove is a letter up the road.'])] },
  { id: 't8-h3', theme: 'home3', W: 8, H: 6, exit: [3, 4], items: [],
    npcs: [npc('t8-h3-fisher', 5, 4, 'fishing2', 6, ['Out on the water it is just the sea. Gulls, crabs, nothing strange. I like that.'])] },
  { id: 't8-h4', theme: 'home1', W: 9, H: 6, exit: [4, 4], items: [],
    npcs: [npc('t8-h4-nan', 3, 4, 'npc3-old-woman-purple', 0, ['The crews came down before my grandmother was born. We owe them more than we ever say.'], { move: 'wander', r: 1 }), npc('t8-h4-man', 6, 4, 'npc1-yellow-shirt-man', 6, ['Things grow where they should not. A patch came up in the flowerpot yesterday. I sent word.'])] },
  { id: 't8-h5', theme: 'home2', W: 9, H: 6, exit: [4, 4], items: [],
    npcs: [npc('t8-h5-mama', 6, 4, 'npc3-apron-woman-blue', 6, ['Litwick come out at night and Duskull drift in. They keep to themselves, and so do we.']), npc('t8-h5-man', 2, 4, 'npc2-orange-striped-man', 2, ['Dark sand and sea cliffs run west from here. Nobody goes. Nothing comes.'])] },
);

const MIGR = ['t5', 't7', 't4', 'g6', 't6', 'g8', 't8'];   // the towns whose old room specs (SPECS above: the people, lines, scripts and trainers) now fill interiors inside their buildings, see the end of this file

// ---------- T4 Route 4: the cave under the basin (one live room, 5 x 2 chunks at chunk (320, 0)) ----------
// Tiles are cave grid x (0..159) and y (0..63); absolute column = 10240 + x. A west mouth (Tradeway) and an east mouth; a wide passage with stalls creeping in from the west and thinning out, the road carrying on, then a plain narrower passage. Seeded, so it is byte-identical every run.
{
  const CWT = 160, CHT = 64, CXC = 320, OXT = CXC * 32, ID = 't4-cave';
  let sd = 0x7a4c; const rnd = () => { sd = sd + 0x6d2b79f5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rle = a => { const o = []; for (let i = 0; i < a.length;) { let j = i; while (j < a.length && a[j] === a[i]) j++; o.push(j - i > 1 ? `${a[i]}x${j - i}` : String(a[i])); i = j; } return o.join(','); };
  const cl = x => 32 + (5 * Math.sin(x / 19) + 2.5 * Math.sin(x / 8.3 + 1)) * Math.min(1, x / 12, (CWT - 1 - x) / 12);
  const hw = x => (x < 64 ? 6 : x < 78 ? 6 - (x - 64) / 7 : x > 146 ? 4 : 3.5 + 0.8 * Math.sin(x / 11)) + (x >= 116 && x <= 138 ? 3.5 * Math.sin(Math.PI * (x - 116) / 22) : 0);
  const jit = []; for (let x = 0; x < CWT; x += 3) { const a = Math.floor(rnd() * 3) - 1, b = Math.floor(rnd() * 3) - 1; for (let k = 0; k < 3; k++) jit[x + k] = x < 9 || x > 150 ? [0, 0] : [a, b]; }
  const top = [], bot = [], fl = new Uint8Array(CWT * CHT);
  for (let x = 0; x < CWT; x++) { top[x] = Math.round(cl(x) - hw(x)) + jit[x][0]; bot[x] = Math.round(cl(x) + hw(x)) + jit[x][1]; }
  for (let x = 1; x < CWT - 1; x++) for (let y = top[x]; y <= bot[x]; y++) fl[y * CWT + x] = 1;
  const BX = 83, bb = Math.min(...[BX - 1, BX, BX + 1, BX + 2, BX + 3].map(x => bot[x]));   // the side passage: three wide, going south; boulders shut it a few tiles in
  for (let x = BX; x <= BX + 2; x++) for (let y = bb - 1; y <= bb + 8; y++) fl[y * CWT + x] = 1;
  for (const x of [15, 27, 40]) { const b = Math.min(bot[x], bot[x + 1]); for (let cx = x - 2; cx <= x + 3; cx++) for (let y = b - 2; y <= b; y++) fl[y * CWT + cx] = 1; }   // a notch behind each south stall for its vendor
  const F = (x, y) => x >= 0 && y >= 0 && x < CWT && y < CHT && fl[y * CWT + x] === 1;
  const g = new Uint8Array(CWT * CHT);   // 0 dark, 1 floor, 2 wallT, 3 wallB, 4 road
  for (let y = 0; y < CHT; y++) for (let x = 0; x < CWT; x++) {
    if (F(x, y)) { g[y * CWT + x] = 1; continue; }
    let d = 9; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (F(x + dx, y + dy)) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
    g[y * CWT + x] = d > 2 ? 0 : F(x, y + 1) ? 3 : 2;
  }
  for (let x = 1; x < CWT - 1; x++) { const c = Math.round(cl(x)); for (let y = c - 1; y <= c + 1; y++) if (g[y * CWT + x] === 1 && (x <= 64 ? 1 : x <= 90 ? y === c : y === c && rnd() < 0.7 && x < 152)) g[y * CWT + x] = 4; }
  const ER = (a, b) => [Math.max(top[a], top[b]), Math.min(bot[a], bot[b])], ew = ER(1, 2), ee = ER(157, 158);   // each mouth is as tall as the passage there, so walking straight on always leaves
  for (const [x, r] of [[1, ew], [2, ew], [157, ee], [158, ee]]) for (let y = r[0]; y <= r[1]; y++) g[y * CWT + x] = 4;
  const props = [], npcs = [], lamps = [], taken = [];
  const P = (n, x, y) => { props.push([x2(n), Math.round((OXT + x) * 32), Math.round(y * 32 - 2)]); taken.push([x, y]); };
  const N = (id, x, y, sprite, face, lines, o = {}) => { npcs.push({ ...npc(id, OXT + x, y, sprite, face, lines, o), room: ID }); taken.push([x, y]); };
  // torches along the market half, thinning with the stalls; the east half has only crystal light
  for (const x of [5, 13, 24, 36, 48, 58, 70, 81]) { const y = top[x] + 0.95; P('torchPost', x + 0.5, y); lamps.push([Math.round((OXT + x + 0.5) * 32), Math.round(y * 32 - 30), x < 60 ? 210 : 130, 1]); }
  // stalls: north side (vendor in front) and south side (vendor behind), 4 + 3, with the gaps growing; the last one stands at x 47
  const stall = (kind, x, side, who) => {
    const t = Math.max(top[x], top[x + 1]), b = Math.min(bot[x], bot[x + 1]), ly = side === 'n' ? t + 2 : b - 1;
    P(kind, x + 1, ly + 1); who && N(who[0], x, ly + 1, who[1], side === 'n' ? 0 : 4, who[2], { extra: who[3] });
  };
  stall('pxStallPink', 11, 'n', ['t4-cv-fruit', 'shopm', ['Rare stock, wild prices. What is on my stall today will not be here next week.'], { name: 'Trader', script: 'clerk', market: true, reach: 66 }]);
  stall('pxStallBlue', 15, 's', ['t4-cv-cloth', 'oldwoman', ['The stalls began at the mouth and crept in. I am further in than most.'], { reach: 66 }]);
  stall('pxStallBlue', 20, 'n', ['t4-cv-curios', 'gsman2', ['Goods for goods, down here. Show me something I want and we can talk.'], { name: 'Barterer', script: 'barter', reach: 66 }]);
  stall('pxStallBlue', 27, 's', ['t4-cv-curios2', 'gsmiddleman', ['There are fewer stalls every few steps, and fewer customers with them.'], { reach: 66 }]);
  stall('pxStallBlue', 32, 'n', ['t4-cv-cloth2', 'woman3', ['Cave air keeps cloth dry. It does not keep it warm.'], { reach: 66 }]);
  stall('pxStallPink', 40, 's', ['t4-cv-fruit2', 'farmer', ['Nobody sets up past the bend. The road goes on without us.'], { reach: 66 }]);
  stall('pxStallBlue', 47, 'n', ['t4-cv-last', 'gsoldman', ['Last stall on the road. Past here it is just the road.'], { reach: 66 }]);
  // people: two shoppers and a porter in the market, a trainer every so often along the quiet part
  N('t4-cv-shopper', 22, Math.round(cl(22)), 'gswoman1', 2, ['Bats and rocks, mostly. Nothing in this half bites hard.'], { move: 'wander', r: 2 });
  N('t4-cv-porter', 36, Math.round(cl(36)), 'workman', 6, ['Crates go up to the mouth by hand. Look up: only Zubat and Noibat ever hang from that ceiling.'], { move: 'wander', r: 2 });
  N('t4-cv-kid', 9, Math.round(cl(9)) + 2, 'boy1', 0, ['Mind the Geodude. They look like rocks until they are not.'], { move: 'wander', r: 1 });
  const tr = (id, x, y, sprite, face, cls, name, av, money, team, say, lose, line) => N(id, x, y, sprite, face, [line], { extra: { trainer: { cls, name, ...(av ? { avatar: av } : {}), sight: 5, money, team, say, lose } } });
  tr('r4-rolf', 62, top[62] + 1, 'mount', 0, 'Hiker', 'Rolf', 'hiker', 24, [['geodude', 0], ['roggenrola', 1], ['geodude', 1], ['rockruff', 2], ['roggenrola', 2], ['geodude', 3]], 'Rock all the way down here. Care to test your Pokemon against it?', 'Solid, but you cracked it.', 'The rock holds up well. Better than my team did.');
  tr('r4-marta', 74, bot[74] - 1, 'mount2', 4, 'Hiker', 'Marta', 'hiker', 24, [['roggenrola', 0], ['geodude', 1], ['joltik', 1], ['rockruff', 2], ['geodude', 2], ['roggenrola', 3]], 'The rock is good for the legs. Let us see how yours hold up!', 'You are tougher than the rock.', 'The floor is loose in places. Watch where you step.');
  tr('r4-wil', 93, top[93] + 1, 'campboy', 0, 'Youngster', 'Wil', null, 16, [['zubat', 0], ['noibat', 1], ['zubat', 1], ['noibat', 2], ['zubat', 2], ['noibat', 3]], 'The bats do not mind the dark, and neither do I. Battle?', 'Back to the ceiling for me.', 'Bats hang up there all day. They are quiet company.');
  tr('r4-dara', 108, bot[108] - 1, 'explore', 4, 'Backpacker', 'Dara', 'hiker', 24, [['rockruff', 0], ['zubat', 1], ['geodude', 1], ['joltik', 2], ['noibat', 2], ['rockruff', 3]], 'I mapped as much as the lamps allow. Let us see you map my team!', 'Fair. Mark that one on the chart.', 'The map ends where the lamps do.');
  // the shut side passage: three boulders across it, nothing more said
  for (let x = BX; x <= BX + 2; x++) P('caveRock', x + 0.5, bb + 3 + 0.95);
  // crystal light in the wide chamber and past it
  for (const x of [112, 119, 125, 131, 137, 143]) { P('crystalBlueTall', x + 0.5, top[x] + 1); lamps.push([Math.round((OXT + x + 0.5) * 32), Math.round((top[x] + 0.4) * 32), 90, 0]); }
  for (const x of [115, 122, 128, 134, 140]) { P('crystalBlue', x + 0.5, bot[x]); lamps.push([Math.round((OXT + x + 0.5) * 32), Math.round((bot[x] - 0.4) * 32), 80, 0]); }
  for (const [x, s] of [[66, 's'], [97, 'n'], [126, 's']]) P('dirtMound', x + 0.5, s === 'n' ? top[x] + 1 : bot[x]);
  // rocks along the walls, pebbles on the floor
  for (let y = 0; y < CHT; y++) for (let x = 10; x < 150; x++) {
    if (g[y * CWT + x] !== 1 && g[y * CWT + x] !== 4) continue;
    const edge = !F(x, y - 1) || !F(x, y + 1) || !F(x - 1, y) || !F(x + 1, y), r = rnd(), which = ['rockBrownSmall', 'rockDarkSmall', 'rockBrownB'][Math.floor(rnd() * 3)];
    if (taken.some(([a, b]) => Math.abs(a - x) < 2.5 && Math.abs(b - y) < 2.5) || (x >= BX - 2 && x <= BX + 4 && y >= bb - 2)) continue;
    if (edge && r < 0.09) P(which, x + 0.5, y + 0.9); else if (!edge && r > 0.975) props.push([x2('pebbles'), Math.round((OXT + x + 0.5) * 32), Math.round((y + 0.6) * 32)]);
  }
  // reachability: every person, both mouths and the east spawn must connect to the west spawn (8 px cells, props padded by 6 px)
  const ts = {}; for (const f of ['tileset.js', 'tileset-int.js']) new Function('window', fs.readFileSync(new URL(`../data/adv/${f}`, import.meta.url), 'utf8'))(ts);
  const defs = { ...ts.ADV_TILESET.props, ...ts.ADV_TILESET_INT.props };
  const R = 8, GW = CWT * 4, GH = CHT * 4, blk = new Uint8Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const m = g[(y >> 2) * CWT + (x >> 2)]; if (m !== 1 && m !== 4) blk[y * GW + x] = 1; }
  for (const [n, ax, ay] of props) { const s = defs[n]?.solid; if (!s) continue; const lx = ax - OXT * 32, x0 = lx + s[0] - 6, x1 = lx + s[2] + 6, y0 = ay + s[1] - 6, y1 = ay + s[3] + 6; for (let y = Math.floor(y0 / R); y <= Math.floor(y1 / R); y++) for (let x = Math.floor(x0 / R); x <= Math.floor(x1 / R); x++) if (x >= 0 && y >= 0 && x < GW && y < GH) blk[y * GW + x] = 1; }
  const sp = { w: { x: (OXT + 7.5) * 32, y: (Math.round(cl(7)) + 0.5) * 32 }, e: { x: (OXT + 152.5) * 32, y: (Math.round(cl(152)) + 0.5) * 32 } };
  const seen = new Uint8Array(GW * GH), q = [[Math.floor((sp.w.x - OXT * 32) / R), Math.floor(sp.w.y / R)]]; seen[q[0][1] * GW + q[0][0]] = 1;
  for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = q[i][0] + dx, y = q[i][1] + dy; if (x >= 0 && y >= 0 && x < GW && y < GH && !blk[y * GW + x] && !seen[y * GW + x]) { seen[y * GW + x] = 1; q.push([x, y]); } }
  const ok = (px, py) => { for (let y = Math.floor(py / R) - 1; y <= Math.floor(py / R) + 1; y++) for (let x = Math.floor(px / R) - 1; x <= Math.floor(px / R) + 1; x++) if (seen[y * GW + x]) return true; return false; };
  const chk = (what, px, py) => { if (!ok(px - OXT * 32, py)) throw new Error(`${ID}: ${what} unreachable`); };
  chk('east spawn', sp.e.x, sp.e.y); chk('west exit', (OXT + 1.5) * 32, (ew[0] + 1) * 32); chk('east exit', (OXT + 157.5) * 32, (ee[0] + 1) * 32);
  for (const n of npcs) chk(n.id, (n.x + 0.5) * 32, (n.y + 0.5) * 32);
  const mats = []; for (let i = 0; i < 10; i++) { const a = [], c0 = (i % 5) * 32, r0 = (i / 5 | 0) * 32; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) a.push(g[(r0 + y) * CWT + c0 + x]); mats.push(rle(a)); }
  const cr = y => Math.round(cl(y)), d = {
    cx: CXC, cy: 0, cw: 5, ch: 2, hh: '0x1024', live: true, zone: 'route4', dark: 0.82, pal: ['i_cave_dark', 'i_cave_floor', 'i_cave_wallT', 'i_cave_wallB', 'i_cave_road'],
    mats, props, npcs, lamps,
    exits: [{ c0: OXT + 1, c1: OXT + 2, r0: ew[0], r1: ew[1], end: 'w' }, { c0: OXT + 157, c1: OXT + 158, r0: ee[0], r1: ee[1], end: 'e' }],
    spawns: { w: { x: Math.round(sp.w.x), y: Math.round(sp.w.y) }, e: { x: Math.round(sp.e.x), y: Math.round(sp.e.y) } },
    box: [OXT * 32, 0, (OXT + CWT) * 32, CHT * 32],
  };
  d.spawn = d.spawns.w;
  fs.writeFileSync(new URL(`${ID}.js`, out), `// Generated by tools/adv-build-rooms.mjs\nADV.room(${JSON.stringify(ID)}, ${JSON.stringify(d)});\n`);
  console.log(ID, 'written:', props.length, 'props,', npcs.length, 'people');
}

// ---------- S2 Goldacre: the interiors live inside their buildings (docs/INTERIORS.md) ----------
// Spec coordinates are floor sub-tiles (32 world px, half an outdoor tile) from the floor's top left; the floor is (2w - 2) x (2d - 1) of them for a w x d footprint (a wall column each side, the front wall a row), the upright back wall stands above its top row.
// Props: [name, centre x, bottom y]; people: floor cell x, y. Written as tile offsets from the footprint origin to tools/adv-towns/G7-in.json (keyed by building id); tools/adv-gen-region.py adds the footprint, the exits and the sprite.
// The people, their lines, trainers and rosters are the ones the old rooms had. Every line is bible grounded (Goldacre, Whitney, Appendix A) or plain flavour, short, no dashes.
const IN7 = [
  { id: 'g7-center', theme: 'center', C: 8, R: 5,
    items: [['winWide', 2, -0.45], ['winWide', 6, -0.45], ['paintingSea', 4, -0.6], ['pcBlue', 1, 1.7], ['counterRed', 3.9, 3], ['healMachine', 6.65, 2.6], ['sofaBlue', 1.5, 4.9], ['plantC', 7.4, 5]],
    npcs: [npc('g7-nurse', 3, 1, 'nurse', 0, null, { extra: { name: 'Nurse', script: 'nurse', reach: 66 } }), npc('g7-pc', 1, 2, null, 0, null, { extra: { script: 'pc', reach: 56 } }),
      npc('g7-c-hallowmead', 6, 3, 'gswoman1', 6, ['Hallowmead is only a few roads from here, and Aldermere keeps swallowing it up.', 'Miss Whitney has opinions about that. Ask her, if you dare.'], { move: 'wander', r: 2 }),
      npc('g7-c-boy', 2, 3, 'gsboy2', 0, ['The PC on the wall holds any Pokemon you cannot carry. Take them back out when you like.'], { move: 'wander', r: 1 })] },
  { id: 'g7-mart', theme: 'mart', C: 10, R: 5,
    items: [['winSmall', 2, -0.5], ['winSmall', 7.5, -0.5], ['shelfPotion', 1, 2.3], ['shelfGreen', 2.9, 2.3], ['counterRed', 7.6, 3], ['tableBrownSmall', 1.6, 4.9], ['plantA', 9.4, 5]],
    npcs: [npc('g7-clerk', 7, 1, 'shopm', 0, null, { extra: { name: 'Clerk', script: 'clerk', reach: 66 } }),
      npc('g7-m-farmer', 5, 3, 'farmer', 0, ['The clerk keeps the better stock for trainers who have proven themselves. Earn a badge or two.'], { move: 'wander', r: 2 })] },
  { id: 'g7-whitney', theme: 'farm', C: 6, R: 7,
    items: [['winSmall', 1.5, -0.5], ['winSmall', 4.5, -0.5], ['stoveRed', 1, 2.3], ['shelfBooks', 3, 2.3], ['bedBlue', 5, 2.8], ['tableBrownSmall', 4.4, 5.2], ['plantB', 5.4, 7]],
    npcs: [npc('g7-w-hand', 2, 4, 'cowgirl', 0, ['Miss Whitney left Johto to start over here. Goldenrod had grown too big for her.', 'She wanted land of her own, and out here there is nothing but.'], { move: 'wander', r: 1 }),
      npc('g7-w-aunt', 5, 3, 'gsoldwoman', 6, ['Her Clefable came with her from Johto. Everything else on this farm is a working animal.', 'Even Miltank is a working dairy cow now. It is no gentler for it.'])] },
  { id: 'g7-h1', theme: 'home1', C: 6, R: 7,
    items: [['winSmall', 1.6, -0.5], ['shelfBooks', 2.9, 2.3], ['bedPink', 4.9, 2.7], ['tableBrownSmall', 4.4, 5], ['plantB', 0.6, 6.9]],
    npcs: [npc('g7-h1-mom', 3, 3, 'woman3', 0, ['Goldacre feeds Kenora. Every van that leaves here is full.'], { move: 'wander', r: 1 }), npc('g7-h1-kid', 0, 5, 'boy1', 6, ['Mum says Goldacre feeds the whole region. That is a lot of dinners!'])] },
  { id: 'g7-h2', theme: 'home2', C: 6, R: 7,
    items: [['winWide', 3, -0.45], ['bedPlain', 1, 2.8], ['sofaBlue', 1.5, 5.3], ['plantA', 5.4, 2.6]],
    npcs: [npc('g7-h2-farmer', 5, 5, 'farmer', 2, ['I am up with the sun out here. There is a great deal of sky to get up under.']), npc('g7-h2-oldman', 2, 3, 'gsoldman', 0, ['Miss Whitney named this town after her old one. Goldenrod to Goldacre. I like the sound of it.'])] },
  { id: 'g7-h3', theme: 'home3', C: 6, R: 7,
    items: [['winSmall', 2, -0.5], ['shelfGreen', 4.8, 2.3], ['tableBrownSmall', 4.4, 5], ['plantC', 0.6, 6.9]],
    npcs: [npc('g7-h3-turbine', 3, 3, 'workman', 6, ['I keep the Route 7 turbines turning. Goldacre makes its own power and sells the rest.'])] },
  { id: 'g7-h4', theme: 'home1', C: 6, R: 7,
    items: [['winWide', 3, -0.45], ['shelfBooks', 1.1, 2.3], ['bedBlue', 5, 2.8], ['plantB', 5.4, 6.9]],
    npcs: [npc('g7-h4-cow', 3, 3, 'cowgirl', 0, ['Miltank run free on Route 5. Miss Whitney knows every one of them by face.'], { move: 'wander', r: 1 }), npc('g7-h4-girl', 5, 5, 'gsgirl2', 6, ['Her ace was never bought. She picked it out of a field on that road.'])] },
  { id: 'g7-h5', theme: 'home2', C: 6, R: 7,
    items: [['winSmall', 2.5, -0.5], ['stoveRed', 1, 2.3], ['bedPink', 5, 2.8], ['tableBrownSmall', 4.4, 5], ['plantA', 0.5, 6.9]],
    npcs: [npc('g7-h5-van', 5, 6, 'delivery', 6, ['In season the vans run down to Longshore every day. They eat everything we send.']), npc('g7-h5-man', 3, 3, 'gsman1', 2, ['Tradeway pays cash and asks nothing. So most of our crates go there.'])] },
  { id: 'g7-h6', theme: 'home3', C: 6, R: 7,
    items: [['winWide', 3, -0.45], ['bedPlain', 1, 2.8], ['shelfBooks', 4.5, 2.3], ['plantB', 5.4, 6.9]],
    npcs: [npc('g7-h6-oldwoman', 5, 4, 'oldwoman', 6, ['The Bidoof dam the river up Route 8, and the water table wanders. A bridge was the only answer.']), npc('g7-h6-man', 3, 3, 'gsman3', 0, ['The ford is not reliable. I would stay on the bridge.'], { move: 'wander', r: 1 })] },
  { id: 'g7-h7', theme: 'home1', C: 6, R: 7,
    items: [['winSmall', 2, -0.5], ['shelfGreen', 2.8, 2.3], ['bedBlue', 5, 2.8], ['plantC', 5.4, 6.9]],
    npcs: [npc('g7-h7-man', 5, 4, 'gsmiddleman', 6, ['Wooloo, Mareep and Tauros all graze our pasture. There is wool in every direction.']), npc('g7-h7-boy', 0, 5, 'boy3', 2, ['Cherubi like our crop fields. Cherimart put one on its logo, you know.'], { move: 'wander', r: 1 })] },
  { id: 'g7-gym', theme: 'barn', C: 10, R: 7,
    items: [['winArch', 2, -0.4], ['winArch', 8, -0.4], ['maHayPile', 1.8, 2], ['maHayPile', 8.2, 2], ['crateWide', 0.8, 3.4], ['barrelOrange', 9.3, 3.6], ['statueBeast', 1, 6.6], ['statueBeast', 9, 6.6]],
    npcs: [
      npc('g7-whitney', 4, 1, 'whitney', 0, ['Goldenrod got too big for me, so I came here for the space.', 'Goldacre feeds Kenora now, and I could not be prouder of it.'], { extra: { name: 'Whitney', trainer: {
        cls: 'Gym Leader', name: 'Whitney', leader: 'whitney', avatar: 'whitney', gym: true, sight: 0, money: 80, tm: 'tm_attract', badge: 'Goldacre Badge', after: ['g7-gym-hank', 'g7-gym-mabel'],
        wait: ['Oh, my ranch hands would love a word with you first, dear.', 'Do see them, and then come to me.'],
        say: ['Oh, how lovely, a challenger! Welcome to my barn.', 'You remind me of a boy who came through my gym once.', 'Now then, shall we? Do mind the hay.'],
        say2: ['Back again! Wonderful. Shall we?'],
        lose: ['Oh, you did it! Congratulations, truly. That was a lovely battle.', 'I do hope Miltank was not too much trouble. She never did learn to be gentle.'],
        sorry: ['Oh, I do apologise, dear. Miltank gets so carried away.', 'Sorry again! She really does not know her own strength.'] } } }),
      farm('g7-gym-hank', 'Rancher', 'Hank', 'farmer', 2, 5, 30, [['mareep', 0], ['wooloo', 0], ['ponyta', 1], ['tauros', 1], ['girafarig', 2], ['miltank', 2]], 'Miss Whitney trusts me with the stock. Let us see you handle it!', 'Fair enough. On you go.', 1, 4),
      farm('g7-gym-mabel', 'Farmer', 'Mabel', 'cowgirl', 6, 5, 30, [['oddish', 0], ['hoppip', 0], ['sunkern', 1], ['cherubi', 1], ['bounsweet', 2], ['lechonk', 2]], 'The crops do not grow themselves, and neither do trainers. Come on!', 'Well, there goes my harvest.', 8, 2),
      npc('g7-gym-guide', 6, 5, 'gsman2', 0, ['Whitney came all the way from Johto. Her Miltank knows Rollout, so watch for it to build speed.', 'Her ranch hands are in your way. Beat them first.'])] },
];
// Buildings that grew (tools/adv-build-big.py): the town plan (tools/adv-towns/<code>.json, written by its town script) holds each building's footprint, and the floor
// is (2w - 2) x (2d - 1) of it; furniture and people keep their places in proportion
const FOOT = code => { const f = new URL(`../tools/adv-towns/${code}.json`, import.meta.url); return fs.existsSync(f) ? Object.fromEntries(JSON.parse(fs.readFileSync(f, 'utf8')).buildings.filter(b => b[4]).map(b => [b[3], b[4]])) : {}; };
let SIZE = {};
const grow = s => {
  const fp = SIZE[s.id], z = fp && [2 * fp.w - 2, 2 * fp.d - 1]; if (!z || (z[0] === s.C && z[1] === s.R)) return s;
  const [C, R] = z, kx = C / s.C, ky = R / s.R, cx = (C - 1) / (s.C - 1), cy = (R - 1) / (s.R - 1);
  return { ...s, C, R, items: s.items.map(([n, x, y]) => [n, +(x * kx).toFixed(2), y < 0 ? y : +(y * ky).toFixed(2)]), npcs: s.npcs.map(n => ({ ...n, x: Math.round(n.x * cx), y: Math.round(n.y * cy) })) };
};
const emit = (code, list) => {
  const o = {}; SIZE = FOOT(code);
  for (const s0 of list) {
    const s = grow(s0);
    const f = s.items.filter(([n]) => !INTP.ADV_TILESET_INT.props[x2(n)]); if (f.length) throw new Error(s.id + ': no interior art for ' + f.map(i => i[0]));
    o[s.id] = {
      floor: `i_${s.theme}_floor`, walls: `i_${s.theme}`, C: s.C, R: s.R,
      props: s.items.map(([n, x, y]) => [x2(n), +((x + 1) / 2).toFixed(4), +((y * 32 - 2) / 64).toFixed(4)]),   // tile offsets of the foot (centre, bottom) from the footprint origin; the 2 px lift keeps a prop off a tile edge
      npcs: s.npcs.map(({ x, y, ...n }) => ({ ...n, dx: +((x + 1.5) / 2).toFixed(4), dy: +((y + 0.5) / 2).toFixed(4) })),
    };
  }
  fs.writeFileSync(new URL(`../tools/adv-towns/${code}-in.json`, import.meta.url), JSON.stringify(o, null, 1) + '\n');
  console.log(list.length, code, 'interiors written to tools/adv-towns/' + code + '-in.json');
};
emit('G7', IN7);

// ---------- S2 the other towns: every old room's people, lines, scripts and trainers move into one of a few furnished interiors that fit a real building footprint (the footprint and sprite are in tools/adv-towns/<code>.json) ----------
const TPL = Object.fromEntries(IN7.map(s => [s.id.slice(3), { ...s, slots: s.npcs.map(n => [n.x, n.y]) }]));
TPL.mart.slots = [[7, 1], [5, 3], [3, 3]];
TPL.h3.slots = [[3, 3], [1, 5]];
const HT = ['h1', 'h2', 'h4', 'h5', 'h6', 'h7', 'h3'];   // the house interiors, dealt out in turn so a town's houses differ
const HALL = { C: 8, R: 7, slots: [[3, 2], [6, 5], [1, 4]],
  items: [['winSmall', 1.5, -0.5], ['winSmall', 6.5, -0.5], ['boardGreen', 4, -0.6], ['shelfBooks', 1, 2.3], ['shelfBooksTall', 7, 2.4], ['tableBrownLong', 4, 4.4], ['mapIsland', 1.6, 6.6], ['plantA', 7.4, 7]] };
const MARKET = { C: 10, R: 7, slots: [[2, 1], [7, 1], [5, 4], [8, 5], [1, 5]],
  items: [['winArch', 2, -0.4], ['winArch', 8, -0.4], ['boardGreen', 5, -0.6], ['counterRed', 2.6, 3], ['counterRed', 7.4, 3], ['crateWide', 0.9, 6.8], ['barrelOrange', 9.3, 6.9], ['plantA', 0.5, 4.6]] };
const GYM6 = { C: 10, R: 7, slots: [[5, 1], [1, 4, 2], [8, 5, 6], [8, 2, 6], [5, 6]],
  items: [['winSmall', 2, -0.5], ['winSmall', 8, -0.5], ['boardGreen', 5, -0.6], ['fallenLog', 1.6, 2.6], ['barrelOrange', 9.3, 4.6], ['crateWide', 1.2, 6.8], ['fallenLog', 8.2, 6.8]] };
const GYM8 = { C: 10, R: 7, slots: [[5, 1], [8, 4, 6], [1, 3, 2], [7, 2, 6], [5, 6]],
  items: [['winArch', 2, -0.4], ['winArch', 8, -0.4], ['boardGreen', 5, -0.6], ['mushroomStump', 1.2, 2.2], ['mushroomStump', 8.8, 2.4], ['mushroomsOrange', 3.2, 2.2], ['mushroomsPale', 6.6, 2.4], ['mushroomsPale', 0.6, 4.8], ['mushroomsOrange', 9.4, 4.4], ['mushroomsRed', 3.4, 5.2], ['mushroomsPale', 6.4, 5.6], ['plantB', 0.8, 6.9], ['plantB', 9.2, 6.9]] };
const CUSTOM = { 't4-market': MARKET, 'g6-office': HALL, 'g8-lodge': HALL, 't8-lodge': HALL, 'g6-gym': GYM6, 'g8-gym': GYM8 };
const OFF = { t5: 0, t7: 2, t4: 4, g6: 1, t6: 3, g8: 5, t8: 6 };
for (const pre of MIGR) {
  let hi = OFF[pre];
  emit(pre.toUpperCase(), SPECS.filter(s => s.id.startsWith(pre + '-')).map(s => {
    const t = /-center$/.test(s.id) ? TPL.center : /-mart$/.test(s.id) ? TPL.mart : CUSTOM[s.id] || TPL[HT[hi++ % 7]];
    if (s.npcs.length > t.slots.length) throw new Error(s.id + ': more people than the interior has places');
    return { id: s.id, theme: s.theme, C: t.C, R: t.R, items: t.items, npcs: s.npcs.map((n, i) => ({ ...n, x: t.slots[i][0], y: t.slots[i][1], ...(t.slots[i][2] === undefined ? {} : { face: t.slots[i][2] }) })) };
  }));
}
