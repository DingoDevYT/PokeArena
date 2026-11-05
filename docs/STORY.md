# Kenora: the story of Adventure mode

Written 2026-11-05 under the overnight brief (story and characters may be rewritten). The script the game runs is `data/adv/story.js`; the engine that runs it is `src/adv-story.js` (built separately). This doc is the readable version: premise, cast, lore, the arc by badge count, every beat, what the engine needs beyond the schema, and suggested rewrites of lines already in the game.

## Premise

You set out from your hometown, wherever it is, with a League Pass from Professor Linden and a loud new rival from Johto called Ethan. Team Umbra is buying, stealing and shipping Pokemon to close their hearts with an old darkness that once nearly swallowed Kenora; their leader, a gentle museum archivist named Inkwell, believes a Pokemon that can never feel fear is a Pokemon that can never be hurt. Ethan, desperate never to freeze in a big battle again, takes a fearless Shadow Tyranitar from Umbra, and the story becomes a race to the Statue of Umbra in the far north-west, to shut the door on the dark and to help Ethan call his Pokemon back, before the League on the north cape.

## The throughline

Three threads run the whole way and meet at the end:

1. **The League.** The reason you travel. Eight badges in any order, then the League on the north cape. Linden hands you the pass at 0 badges; Ethan and the Champion wait at the end.
2. **Team Umbra.** A mystery that escalates by badge count: a creepy survey, a man buying scared Pokemon, crates on a night boat, a glowing warning line, a market selling fearless Pokemon, a stolen page, a show in your hometown, a stolen key, the open door.
3. **Ethan.** The rival who is always one step ahead and always hungry. He froze in the Johto League final and swore it would never happen again. He reaches for strength that cannot fail, gets it from Umbra, sees what it costs, and learns the game's one idea from you and from his own Tyranitar.

**The idea:** being brave is being scared and staying anyway. Every thread says it in its own way: your survey answer at 0 badges, Chad's remark about your partner, the old story on the Quiet Plain, Soot's Houndoom shaking in storms, Chad again after the hometown show, Ethan naming Pebble, Inkwell's own Weezing standing in front of him, and Ethan's last talk before the League.

Tone: classic Pokemon. Warm, funny in places (Ethan and the Miltank, Jet counting seconds, Wash being upstaged by a fungus, Chad napping on benches), earnest where it counts (Ethan at Spindlewood, Pebble, Inkwell's Koffing). Nobody is hurt on screen; the villain is wrong, not evil, and gets a quiet way back.

## How the story runs

- **Phased by badge count, never by place.** A beat opens when you have at least `stage` badges and every beat in its `after` list is done. The player picks any hometown and any gym order, so the script never assumes where you have been.
- **One main chain.** Each main-line beat waits for the one before it, so the story always plays in order and catches up if you rush badges. Battles in a late beat simply use the stronger roster band. Two side scenes (`optional: true`) never block the chain.
- **Where a beat happens.** About half the beats come to you: a cast member is standing near the Pokemon Center of the next town you visit (`town: 'any'`), or of any town but home (`'away'`). The set pieces are fixed: Spindlewood (2), Duskmoss and the Quiet Plain (3), Tradeway (4), your hometown (5), Dunereach (6), the Statue of Umbra (7), the League (8). Your hometown is the stage for the opening, the Umbra show and the homecoming.
- **Short.** 32 beats, 273 lines, 15 battles. Most beats are one short scene of 4 to 10 lines.

## The old story (lore)

What the game reveals, in the order the player learns it:

- **The Curse.** Long ago a darkness came up out of the ground in the far north-west. Pokemon it touched closed their hearts: they still fought, but they felt nothing and heard nobody. People call them Shadow Pokemon now.
- **The flight south.** People fled down the old road, all the way to the southern tip of Kenora, until there was no more road. The nine waymarker stones on Route 1 count down those nine days (the stone-cutter, post-game). The strays that walk south with you on Route 1 are an echo nobody explains.
- **The stand on the Quiet Plain.** At the end of the road the people turned round. They called their Pokemon by name and stayed beside them, and the ones who were called came back. The dark broke there. The plain is the memorial; the ghost-speaker still teaches how to sense a closed heart (the existing Sensing Shadow Pokemon skill at L4).
- **The tower and the Keeper.** A tower, the Statue of Umbra, was raised over the place the dark came up, and a door in it was locked. A Dunereach family kept the key: Vesper is the last Keeper. Her gym hall keeps "what the desert would rather forget" (her gym lines already say so).
- **The glowing line.** The old wardens planted the glowing fungus between Sporehaven and Duskmoss as a warning: it climbs toward the dark. Sporehaven's crews kept cutting it back for two hundred years and forgot why. Their saying, "When the glow climbs, the dark is near", is the alarm that goes off at 3 badges.
- **The Wardens' Account.** The oldest record in Kenora, kept in the Aldermere museum: how the tower was sealed. "The tower holds the dark. The Keeper holds the door."
- **Shade.** Cold black stuff like ink that seeps from cracks in the tower. Inkwell bottles it on Umbra's ship, out past the Spindlewood cove, and uses it to close Pokemon's hearts. Ethan finds it smeared inside an empty crate at 2 badges.

Everything above fits what the world already says: the Quiet Plain people ("The Curse has come before. This plain is what the region built after"), the waymarkers and the stone-cutter nobody sees, the Sporehaven and Duskmoss lines about the glow and "word goes up the road", the glowing fence in Duskmoss, Tradeway's "past the last stall the road gets dark", Spindlewood's busy night wharf, Vesper's hall, and Whitney's "you remind me of a boy who came through my gym once".

## Team Umbra

**What they want.** To open the tower door and let the old dark out over all of Kenora at once, so that every Pokemon becomes a Shadow Pokemon: no fear, no pain, perfectly obedient. Inkwell's reasoning: one Pokemon can be called back; a whole region at once cannot. He truly thinks it is mercy.

**How, stage by stage.**
1. Gather Pokemon: buy them from frightened owners (Soot, 1), catch and crate wild ones (Jet, 2).
2. Close their hearts on the ship with shade (seen as the ink stain, 2; the results sold at 4 and shown off at 5).
3. Measure how close the dark is to the surface, using the old warning line (Duskmoss, 3).
4. Learn how the tower was sealed: steal the Wardens' Account (4).
5. Pay for it all and win people over: the market (4) and the Fearless Kenora show (5).
6. Take the Keeper's key (Wash in her surveyor disguise, 6).
7. Open the door (7).

**Look.** Grunts wear white and red with tinted glasses (the Ranger Go-Rock grunt sprites).

**After the climax.** Inkwell goes quietly with Chadwick and later helps Linden rebuild the Account. Soot quits and works for Vesper. Wash and Jet escape on the ship, which is still out at sea: a ready hook for later content.

## Cast

| id | Name | Role | Sprite (TRAINER_OW_RANGER) | Avatar | Roster |
|---|---|---|---|---|---|
| ethan | Ethan | Rival | normal-normal | ethan | ethan b1..b8, true, shadow |
| linden | Prof. Linden | Mentor, historian | pxyis-pxyis | juniper | none |
| mum | Mum | Your mum, in your hometown | npc3-blue-haired-woman | lady | none |
| chad | Chad | The Champion, travelling incognito | clyde-clyde | steven | none (never battles as Chad) |
| chadwick | Chadwick | Champion of Kenora | clyde-clyde | steven | chadwick |
| inkwell | Inkwell | Leader of Team Umbra | enemy2-enemy-leader-2 | giovanni | inkwell |
| wash | Wash | Umbra lieutenant: the face | elita-elita | iono | wash |
| surveyor | Surveyor | Wash in disguise | npc4-blonde-girl-brown | shauna | none |
| soot | Soot | Umbra lieutenant: the muscle | south-headband | bruno | soot |
| jet | Jet | Umbra lieutenant: supply | solana-solana | skyla | jet |
| grunt | Umbra Grunt | Grunt (talk only) | gorock-grunt-male | magmagrunt | none |
| vesper | Vesper | Dunereach gym leader, Keeper of the door | npc1-robed-woman | fantina | vesper (not battled in the story) |
| rue | Rue | Sporehaven gym leader, warden | npc2-red-jacket-woman | erika | rue (not battled) |
| whitney | Whitney | Goldacre gym leader | npc4-ponytail-girl-pink | whitney | whitney (not battled) |
| kid | Kid | A kid with a Lillipup called Pip | npc1-camo-boy | youngster | none |
| cutter | Stone-cutter | Keeps the Route 1 waymarkers (post-game) | npc3-white-haired-man | hiker | none |

Vesper, Rue and Whitney use the same sprite and avatar as their gym NPCs in `tools/adv-build-rooms.mjs`. `chad`/`chadwick` and `surveyor`/`wash` are two cast ids for one person each, so the name plate and the class never spoil a reveal.

### Ethan, the rival
From New Bark Town in Johto; came over on the ferry the week you set out and slept in a Center lobby for three nights. Loud, generous, funny, competitive, talks fast, uses contractions and exclamation marks, says "C'mon!" and "Okay okay okay". Has been training for years, so he is always a badge ahead. A Miltank rolled over him for a whole afternoon in Goldenrod and he has never got over it. His secret: he made it to the Johto League final and froze, unable to pick a move or say his partner's name. **Arc:** wants never to freeze again, so he wants strength that cannot fail (4); takes the "seventh card", a Shadow Tyranitar, from Wash (5); it turns on his Typhlosion and will not look at him (5); he asks you how to reach a Pokemon that will not listen and realises he never gave it a name (6); at the tower he names it Pebble, admits he is scared too, stays, and it comes back (7); at the League gate he loses to you without freezing once, and is glad (League).
> "Last one to a gym is a Slowpoke tail! That's a Johto thing. It's a good thing to say!"

### Professor Linden, the mentor
Historian and field researcher at Aldermere, who hands a League Pass to each new trainer every spring and collects old customs nobody remembers the reason for. Warm, curious, a little scatterbrained ("I lose mine weekly, and I don't even need one"). She is the one who pieces the old story together and sends you where the trouble is. Inkwell was the archivist at her museum.
> "Oh, and if you see anything odd on your travels, do tell me. I adore odd."

### Mum
Lives in your hometown, whichever town you chose. Warm, teasing, practical. Sees you off (0), is in the crowd when Umbra comes to town (5), feeds Ethan everything in the kitchen (post-game).
> "Here, Potions. For emergencies, and for the emergencies you won't tell me about."

### Chad, who is Chadwick, the Champion
Languid, kind, amused; never hurries; naps on benches with his Alolan Meowth (an Alolan Persian by the League). Calls everyone "friend". Appears three times as a traveller who does not battle on holiday, says the game's idea out loud after the hometown show, admits he is "a sort of caretaker for this region, unofficially", and holds the avenue at the tower. At the League: "Holiday's over."
> "Never rush a nap, a cup of tea or a battle, friend. All three go cold."

### Inkwell, leader of Team Umbra
The Aldermere museum's archivist: soft-spoken, precise, polite, ink on every finger, never uses a contraction. His Koffing was afraid of everything (thunder, crowds, him), and he only ever wanted it to stop hurting. He believes fear is pain and the old dark is mercy. He is beaten when his own Weezing, terrified, stands in front of him anyway. He goes quietly: "I was wrong about the dark. I wonder what else I was wrong about."
> "Fear is a splinter in the heart."

### Wash, the face
Spy, show-woman and mistress of disguise; Umbra's "face, voice and wardrobe". Sugary and theatrical ("sweetie", "darling"); wants an audience more than anything and hates being upstaged. She is the Surveyor at 0 badges and again the night the key goes missing. Escapes to the ship.
> "Ugh! Upstaged! On the south coast! In front of a fungus!"

### Soot, the muscle
A former stoker on Umbra's ship. Huge, few words, honest, has a code, drops a few words ("It don't look sad"). Joined because the boss said scared Pokemon would be made happy. His Houndoom used to hide under his bunk in storms and he would sit with it till it passed. Doubts at 4, quits at 7 and brings back the key, hauls stones for Vesper after.
> "I seen what's in that tower. That ain't kindness. That's just quiet."

### Jet, supply
Runs the tenders between Spindlewood and the ship. Always late in her own head, counts seconds, talks like a courier ("Signed, sealed, gone!"). Pure comic villain. Escapes to the ship.
> "Waiting is just losing, slowly!"

### Vesper, the Keeper
Dunereach gym leader and the last Keeper of the tower door. Old, hooded, gentle, deadpan; ghosts are her neighbours. Her hall is the old caravanserai where "every lamp was left burning for someone".
> "Ghosts are only frightening until you learn their names."

### Rue and Whitney
Rue keeps her gym voice: terse, practical, "Mind the floor." She calls the alarm at 3 and sends you to the Quiet Plain. Whitney keeps hers: gracious and sweet. In the optional Goldacre scene she recognises Ethan from Goldenrod, and her Miltank only wanted to say sorry.

## The arc by stage

**0 badges: setting out.** Outside your hometown's Center, Linden gives you a League Pass and the one rule (eight leaders, any order, then the north cape). Mum sees you off. Ethan bursts in from Johto, declares you rivals and battles you with his Quilava alone (held to your level; losing is fine). In the first other town, a cheerful surveyor asks whether your Pokemon ever gets scared and whether you would take its fear away. Your answer, "Isn't being scared part of being brave?", is the game's idea, and it will be quoted back to you.

**1 badge: Umbra shows its face.** A big man with a headband, Soot, is trying to buy a kid's scared Lillipup so the "team" can fix it. You battle him; he lets slip "Team Umbra". Ethan turns up a badge ahead: Umbra tried to buy his Eevee too. Rival battle, and a life-or-death warning about Goldacre's Miltank. A sleepy traveller, Chad, notices that your partner looks at you before anything else and gives you Great Balls. (Optional: in Goldacre, Ethan hides from Whitney.)

**2 badges: the boats.** Linden: wild Pokemon are vanishing and a Spindlewood boat takes crates out at night to a ship that never comes to port; Ethan has already run off there. On the quay you battle Jet, who flees on the tender. The crates hold stolen wild Pokemon; one empty crate is smeared with cold black ink. That evening Ethan tells you he froze in the Johto final, and swears never to freeze again.

**3 badges: the glow.** Word comes up the road: the Sporehaven glow has climbed past the warden line. At Duskmoss, by a fence glowing brighter than anyone has seen, the surveyor turns out to be Wash. You battle her. Inkwell steps out, polite and calm: they were only taking a reading of the dark. "A Pokemon touched by it feels no fear. Is that not a kindness?" Rue realises the fungus was a warning all along and sends you down Route 1. On the Quiet Plain, Linden tells the old story and points you to the ghost-speaker (the Sensing skill) and to Tradeway.

**4 badges: fearless, for sale.** In the Tradeway market Soot is selling Shadow Pokemon. You battle; he remembers sitting with his Houndoom through storms, opens the cage and walks off. Ethan battles you with something to prove, then walks off with Wash, knowing exactly who she is. Linden: the Wardens' Account has been stolen from the museum (the thief left a fake gold coin), the archivist Inkwell is gone, and the Account's last line is "The Keeper holds the door."

**5 badges: the seventh card.** Ethan shows you his edge: a Tyranitar that never flinches. After your battle it comes out on its own and turns on his Typhlosion; he gets it back in its ball and leaves shaken. A grunt hurries past toward a show in your hometown. At home, Wash's Fearless Kenora show has drawn a crowd, Mum among them. The Shadow Pokemon stop obeying even Wash; Chad holds the crowd back while you battle her. Afterwards Chad says it plainly: a Pokemon that cannot be afraid cannot be brave either, and your friend will need you.

**6 badges: the Keeper.** Linden has worked out that the Keeper is Vesper of Dunereach. In Vesper's hall Jet and Soot are turning over very old pots; you battle Jet. Too late: a charming young lady with a survey called last night, and the key left with her. Vesper goes north. Ethan finds you, not to battle: his Tyranitar is nobody's and will not look at him. You tell him what the Plain taught you: call it by name, and do not leave. He never gave it a name.

**7 badges: the Statue of Umbra.** Chad: the sky has gone grey over the north-west at midday; the door is open. At the Statue, Vesper and Chad hold the avenue. Soot blocks the gate, battles you to make sure you are ready, then quits. Further in, Ethan's Tyranitar is rampaging; you battle it (his shadow card) until it slows, and Ethan names it Pebble, tells it he is scared too, stays, and it comes back. At the door Inkwell makes his case; you battle him. As the dark pushes out, his own Weezing, shaking, shields him. Soot returns the key he took off Wash, Vesper shuts the door, the sky clears. Chad takes Inkwell away; Wash and Jet escape to the ship.

**8 badges: the road north.** Linden: the sky is clear, some Shadow Pokemon are still loose and will need finding, and the League is open to you. Ethan, with Pebble: strong is being scared and staying, so he is allowed to be scared too. "Medium was a lie."

**The League.** Ethan waits at the gate for the last rival battle, his true team; he loses without freezing and sends you in. The Champion is Chad: Chadwick, whose holiday is over. After the Champion battle, Ethan and Linden burst in, and Chadwick gives you the Master Ball he never used.

**After the League.** Homecoming: Mum, the town at the Center, a note from Linden. At the Statue, Vesper has her ear to the door: since it was shut the tower hums, there are stairs under it that go further down than the tower goes up, and something down there is awake. Soot hauls stones for her now. Optional: the stone-cutter on Route 1 explains the nine stones. **Hooks:** the deep under the tower (a post-game dungeon), the ship at sea with Wash and Jet, Shadow Pokemon still loose (a use for the Sensing skill), rematches with the leaders' and Ethan's true teams and with Chadwick.

## Every beat

Beats in story order. Each main-line beat waits for the one above it; the two optional beats wait for s1-ethan and lg-champion. Stage = badges needed; "1 to 4" means it stops being offered after 4 badges.

| id | stage | where | trigger (who) | battle | summary |
|---|---|---|---|---|---|
| s0-hello | 0 | your hometown | talk (linden) | ethan | Prof. Linden gives the League Pass; Mum sees you off; Ethan arrives from Johto and battles you (his Quilava only, held to your level). |
| s0-survey | 0 | any town but home | talk (surveyor) | none | A cheerful surveyor asks whether your Pokemon gets scared and if you would take its fear away. You say being scared is part of being brave. (Wash in disguise.) |
| s1-soot | 1 | any town (next Center) | talk (soot) | soot | Soot tries to buy a kid's Lillipup to "fix" its fear. You battle him. He lets slip the name Team Umbra. |
| s1-ethan | 1 | any town (next Center) | talk (ethan) | ethan | Ethan is a badge ahead; Umbra tried to buy his Eevee too. Rival battle. He warns you about Whitney's Miltank. |
| s1-chad | 1 | any town (next Center) | talk (chad) | none | Chad, a sleepy traveller with an Alolan Meowth, notices how your partner watches you. Gives Great Balls. (The Champion, incognito.) |
| s1-whitney (opt) | 1 to 4 | G7 Goldacre | talk (ethan) | none | Optional. Ethan hides from Whitney in Goldacre; she remembers him from Johto, and so does her Miltank. He flees. |
| s2-tip | 2 | any town (next Center) | talk (linden) | none | Linden: wild Pokemon are vanishing; a Spindlewood boat takes crates out to a ship at night. Ethan has run off there. |
| s2-docks | 2 | T6 Spindlewood | enter | jet | Ethan is fighting grunts on the quay. You battle Jet, who flees on the tender. The crates hold stolen wild Pokemon; one is stained with cold black ink. |
| s2-ethan | 2 | T6 Spindlewood | talk (ethan) | none | Ethan confides that he froze in the Johto League final. He swears never to freeze again. |
| s3-word | 3 | any town (next Center) | talk (linden) | none | Linden: the Sporehaven glow has climbed past the warden line toward Duskmoss. Rue asks for trainers. |
| s3-duskmoss | 3 | T8 Duskmoss | enter | wash | At the glowing fence Wash reveals she was the surveyor. You battle her. Inkwell appears, calm and polite: a Pokemon with no fear, is that not a kindness? Rue sends you to the Quiet Plain. |
| s3-plain | 3 | L4 Quiet Plain | enter | none | Linden tells the old story: the Curse, the flight south, the stand on the plain, the tower raised over the source. Points you to the ghost-speaker (Sensing skill) and to Tradeway. |
| s4-market | 4 | T4 Tradeway | enter | soot | Soot sells Shadow Pokemon at the Tradeway market. You battle. He remembers his Houndoom shaking in storms, opens the cage and walks off. |
| s4-ethan | 4 | any town (next Center) | talk (ethan) | ethan | Ethan, desperate for an edge, battles you. Wash offers him a seventh card; he knows who she is and goes with her anyway. |
| s4-account | 4 | any town (next Center) | talk (linden) | none | Linden: the Wardens' Account was stolen from the Aldermere museum (paid with a fake coin). The archivist, Inkwell, is gone. The Keeper holds the door. |
| s5-seventh | 5 | any town (next Center) | talk (ethan) | ethan | Ethan shows his Shadow Tyranitar. Rival battle. The Tyranitar turns on his Typhlosion and ignores him. A grunt mentions a show in your hometown. |
| s5-home | 5 | your hometown | enter | wash | Wash puts on a Fearless Kenora show in your hometown; Mum is in the crowd. The Shadow Pokemon stop obeying. Chad holds the crowd while you battle Wash. |
| s5-chad | 5 | your hometown | talk (chad) | none | Chad: a Pokemon that cannot be afraid cannot be brave either. Your friend will need you. Gives Ultra Balls. |
| s6-keeper | 6 | any town (next Center) | talk (linden) | none | Linden has found the Keeper: Vesper, the Dunereach gym leader. Inkwell will know too. |
| s6-dunereach | 6 | G1 Dunereach | enter | jet | Jet and Soot are searching Vesper's hall. You battle Jet. The key is already gone: the "surveyor" took it last night. Vesper goes north. Gives TM Calm Mind. |
| s6-ethan | 6 | any town (next Center) | talk (ethan) | none | No battle. Ethan cannot reach his Tyranitar. You tell him: call it by name and do not leave. He never gave it a name. |
| s7-call | 7 | any town (next Center) | talk (chad) | none | Chad: the sky over the north-west has gone grey; the door is open. He is a caretaker of the region, unofficially. Gives Full Restores. |
| s7-gate | 7 | L1 Statue of Umbra | enter | soot | Vesper and Chad hold the avenue. Soot blocks the gate, battles you to be sure you are ready, then quits Umbra. Vesper heals you. |
| s7-pebble | 7 | L1 Statue of Umbra | enter | ethan (shadow) | Ethan's Tyranitar is rampaging. You battle it (Ethan's shadow card, held to your level). Ethan names it Pebble, stays, and it comes back. |
| s7-tower | 7 | L1 Statue of Umbra | enter | inkwell | Inkwell at the open door explains his mercy. You battle him. His own Weezing, terrified, shields him. Soot returns the key; Vesper shuts the door. Chad takes Inkwell; Wash and Jet escape to the ship. |
| s8-dawn | 8 | any town (next Center) | talk (linden) | none | Linden: the sky is clear, some Shadow Pokemon are still loose, the League is open to you. Inkwell is helping rebuild the Account. |
| s8-ethan | 8 | any town (next Center) | talk (ethan) | none | Ethan with Pebble: strong is being scared and staying. See you at the gate. Medium was a lie. |
| lg-gate | League (8) | L3 Pokemon League | enter | ethan | Final rival battle at the League gate, Ethan's true team. He loses without freezing. |
| lg-champion | League (8) | L3 Pokemon League | enter | chadwick | The Champion is Chad: Chadwick. Holiday is over. Champion battle. Ethan and Linden celebrate. Gives the Master Ball. |
| pg-home | Post (8) | your hometown | enter | none | Homecoming. Mum; Ethan ate everything; a note from Linden: the tower is humming, see Vesper. |
| pg-vesper | Post (8) | L1 Statue of Umbra | enter | none | Vesper at the shut door: the tower hums, stairs under it go further down than it goes up, something below is awake. Soot works for her now. |
| pg-cutter (opt) | Post (8) | Route 1 (zone route1) | enter | none | Optional. The stone-cutter on Route 1 keeps the nine waymarkers fresh, one for each day the old ones walked south. |

Beats per stage: 0: 2, 1: 4 (one optional), 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 4, 8: 2, League: 2, post-game: 3 (one optional).

Battles (15): Ethan 5 (0, 1, 4, 5, League gate) plus his shadow Tyranitar at 7; Soot 3 (1, 4, 7); Jet 2 (2, 6); Wash 2 (3, 5); Inkwell 1 (7); Chadwick 1 (League). Every battle has a win and a lose branch.

Gifts: Potion x5 (Mum) and x1, Super Potion x2 and x3, Great Ball x5, Full Heal x3, Hyper Potion x2, Ultra Ball x5, TM Calm Mind, Full Restore x3, Max Revive x2, Master Ball, Rare Candy x3. All are real ids in `ADVP.ITEMS` or `tm_<move>`; none repeats a gym TM.

## Story flags

Set by `{ flag }` steps, for other systems to read: `met-ethan`, `survey`, `umbra-known`, `met-chad`, `docks`, `met-inkwell`, `curse-known` (the ghost-speaker could change her greeting), `soot-doubts`, `ethan-tempted`, `ethan-shadow`, `show-stopped`, `key-stolen`, `pebble-saved`, `soot-quit`, `tower-sealed` (wild Shadow Pokemon could start appearing for the Sensing skill), `champion` (title, credits, rematches), `deep-hint` (the post-game dungeon under the tower).

## What the engine needs (beyond the schema)

The data follows the schema in the brief. These extra fields are used, and each has a safe fallback:

1. **`where.town: 'any'` and `'away'`.** `'any'`: the town (G or T code) the player is in now, or the next one they reach; the cast stands near that town's Center. `'away'`: the same, but never the hometown (used once, for the survey). `'home'`, place codes and `{ zone }` work as in the schema.
2. **`who`** on every `talk` beat: the cast member who stands at `spot` and starts the beat when talked to. It is always the first speaker, so an engine that ignores `who` still works. Other speakers in the beat can stand a tile or two away, or appear when they first speak.
3. **`optional: true`**: a side scene (s1-whitney, pg-cutter). It never blocks the main chain and never takes over the NEXT GOAL panel.
4. **`title`**: a short name for a quest log or the debug menu.
5. **Battle step options**, one per bullet below.

- `hold: true`: hold the team near the player's party like a route trainer (levels capped at the strongest party member + `ADVW.UP`, as in `ADVN.team`). Used for the first battle (b1 is level 15 against a level 5 starter) and for the shadow Tyranitar (level 60 on the roster).
- `minus: n`: the team n levels lower (Soot's first fight, straight after a first badge, uses 2).
- `max: n`: send only the last n mons of the ordered team (`ADVN.leaderTeam` puts the ace last). s0 uses `max: 1` so Ethan sends Quilava alone.
- `team: 'shadow'`: use that roster list (`ADV_ROSTERS.ethan.shadow`) instead of the badge band. The mon has `shadow: true`: draw it dark if possible, and it can never be caught.
- `mustWin: true`: a loss plays the lose lines, then the normal blackout; the beat stays open, and the retry starts at the line just before the battle (not the whole scene again). Without `mustWin` (Ethan's battles before the gate), a loss is not a blackout: heal the party, take no money, play the lose lines and carry on; the beat completes either way.
- Otherwise a story battle is a leader-style battle: the cast id's roster for the band `ADVN.bandKey(badges)` (8 badges = `true`), no fleeing, normal prize money. The battle title is the cast `cls` plus `name`: "Rival Ethan", "Lieutenant Soot", "Umbra Leader Inkwell", "Champion Chadwick".

6. **Text tokens** in lines and goals: `{player}` (save name), `{partner}` (the lead's name, `ADVP.name`), `{home}` (the hometown's name). Every line stays within 100 characters even with a 12 character name and "Aldermere City", and every goal within 60.
7. **`enter` timing.** An `enter` beat should also run when it opens while the player is already in that place (a badge won in the hometown, say), and after any beat finishes the engine should check again, so chains of `enter` beats in one place run back to back: s7-gate, s7-pebble, s7-tower at the Statue, and lg-gate, lg-champion at the League. After a blackout, coming back runs the open beat again.
8. **Landmarks have no Center.** Only `enter` beats are used at L1, L3 and L4. If a `talk` beat is ever wanted there, measure `spot` from the place's centre in `ADV_WORLD.towns`.
9. **Carry-over.** A cast member who speaks but does not `leave` stays for the next beat in the same place: Ethan from s2-docks into s2-ethan and from s7-pebble into s7-tower, Chad from s5-home into s5-chad. The engine can keep them standing or let them reappear at the next beat's spot.
10. **Spots** should be nudged to the nearest free walkable tile.
11. **Per player.** Story cast are seen only by the player whose beat it is (ADVENTURE.md: story state is per player), and show a "!" bubble while their beat is ready.
12. **NEXT GOAL.** A beat's `goal` shows while it is the next open main-line beat; a beat with no goal leaves the gym goal in place (the surprise scenes have none on purpose). Goals for `'any'` beats say "at the next Pokemon Center".
13. **The League.** No Elite Four rosters exist, so the League is two beats: Ethan at the gate, then Chadwick. If the engine builds a League interior, lg-champion should run inside it, in front of the Champion's seat.

## Rosters

Every character the story battles already has a roster (`ethan` with `shadow`, `soot`, `jet`, `wash`, `inkwell`, `chadwick`). Two things would make it richer, neither required:

- **Grunt battles.** Grunts are talk-only now because there is no grunt roster. If the engine accepts an inline route-trainer team on a battle step, for example `{ battle: 'grunt', team: [['zubat', 0], ['koffing', 1], ['houndour', 1], ['purrloin', 2], ['trubbish', 2]] }` scaled by `ADVN.team` like any route trainer, a grunt fight could open s2-docks (before Jet), s3-duskmoss (before Wash), s5-home (before Wash) and s7-gate (on the avenue).
- **An Elite Four.** Four rosters would be needed; the leaders' true teams could stand in until then.

## Suggested rewrites

Existing lines that contradict the story or read badly, with replacements (all within the writing rules; none adds a story word to an area that `tools/adv-check.mjs` keeps story-free):

| file | id | current | replacement | why |
|---|---|---|---|---|
| data/adv/npcs.js | l4-speaker, lines[0] | Nobody sent you and nothing stopped you. Walking all the way down is all this place asks. | You walked all the way down. That is all this place has ever asked of anyone. | Rue sends the player here at 3 badges (s3-duskmoss), so "nobody sent you" is false. |
| data/adv/npcs.js | r6-brine, trainer.lose | Back to the ship for me. | Back to my boat for me. | "The ship" is Umbra's ship in the story; a sailor heading back to one reads like a clue. |
| tools/adv-build-rooms.mjs | g7-c-hallowmead, lines[0] | Hallowmead is only a few roads from here, and Aldermere keeps swallowing it up. | Hallowmead is a meadow village out east, and Aldermere keeps swallowing it up. | Hallowmead is on the far side of the island from Goldacre, not a few roads away. |
| src/adv-scene.js | intro(), new page after the first | (none) | Professor Linden is waiting outside the Pokemon Center with your League Pass. Go and say hello! | Points a new player at the first beat. |

Also worth a look:
- **Vesper and the ghost-speaker share a sprite** (`npc1-robed-woman`: `g1-vesper` in `tools/adv-build-rooms.mjs`, `l4-speaker` in `data/adv/npcs.js`). Now that Vesper is a main story character, players will read them as one person. `adv-check` locks the speaker's sprite, so if anything changes it should be Vesper's (and her cast entry in `data/adv/story.js` to match).
- **Whitney's planted line** ("You remind me of a boy who came through my gym once.") is kept: s1-whitney pays it off.

## Open questions for Landon

- Ethan is Johto's Ethan, a few years on, starting over in Kenora after freezing in his League final. Happy with that, or should the rival be an original character with Ethan's rosters?
- Mum appears in three beats. Some players like a family at home and some do not; she can be cut to one line.
- The four Umbra lieutenants of the old bible are now three lieutenants (Wash, Soot, Jet) and a leader (Inkwell), with Chadwick as the Champion.
- Badge names are still placeholders ("Goldacre Badge" and so on), and the game still has no title.
