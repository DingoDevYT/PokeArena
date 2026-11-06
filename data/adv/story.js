// Written for tools: the story beats the engine runs (src/adv-story.js). See docs/STORY.md.
// Beats are phased by badge count, never by place order: a beat opens when badges >= stage and every beat in `after` is done.
// The main line is one chain (each beat lists the one before it); beats marked optional: true are side scenes that never block it.
// Fields the base schema does not name (where.town 'any' / 'away', who, optional, title, battle hold / max / team / mustWin,
// the {player} {partner} {home} text tokens) are explained in docs/STORY.md, section "What the engine needs".
window.ADV_STORY = {
  cast: {
    ethan: { name: 'Ethan', sprite: 'normal-normal', avatar: 'ethan', cls: 'Rival' },
    linden: { name: 'Prof. Linden', sprite: 'pxyis-pxyis', avatar: 'juniper', cls: 'Professor' },
    mum: { name: 'Mum', sprite: 'npc3-blue-haired-woman', avatar: 'lady', cls: 'Mum' },
    chad: { name: 'Chad', sprite: 'clyde-clyde', avatar: 'steven', cls: 'Traveller' },
    chadwick: { name: 'Chadwick', sprite: 'clyde-clyde', avatar: 'steven', cls: 'Champion' },
    inkwell: { name: 'Inkwell', sprite: 'enemy2-enemy-leader-2', avatar: 'giovanni', cls: 'Umbra Leader' },
    wash: { name: 'Wash', sprite: 'elita-elita', avatar: 'iono', cls: 'Lieutenant' },
    surveyor: { name: 'Surveyor', sprite: 'npc4-blonde-girl-brown', avatar: 'shauna', cls: 'Surveyor' },
    soot: { name: 'Soot', sprite: 'south-headband', avatar: 'bruno', cls: 'Trainer' },   // no rank on his name plate: the story reveals who he works for
    jet: { name: 'Jet', sprite: 'solana-solana', avatar: 'skyla', cls: 'Lieutenant' },
    grunt: { name: 'Umbra Grunt', sprite: 'gorock-grunt-male', avatar: 'magmagrunt', cls: 'Grunt' },
    vesper: { name: 'Vesper', sprite: 'alia-alia', avatar: 'fantina', cls: 'Gym Leader' },
    rue: { name: 'Rue', sprite: 'npc2-red-jacket-woman', avatar: 'erika', cls: 'Gym Leader' },
    whitney: { name: 'Whitney', sprite: 'npc4-ponytail-girl-pink', avatar: 'whitney', cls: 'Gym Leader' },
    kid: { name: 'Kid', sprite: 'npc1-camo-boy', avatar: 'youngster', cls: 'Kid' },
    cutter: { name: 'Stone-cutter', sprite: 'npc3-white-haired-man', avatar: 'hiker', cls: 'Stone-cutter' }
  },

  beats: [
    // ================= 0 badges: setting out =================
    {
      id: 's0-hello', title: 'A League Pass', stage: 0,
      where: { town: 'home' }, trigger: 'talk', who: 'linden', spot: { dx: 2, dy: 2 },
      goal: 'Talk to Professor Linden outside the Pokemon Center.',
      script: [
        { say: 'linden', lines: ["Ah, there you are! You must be {player}. And this must be {partner}. Splendid, splendid.",
          "I'm Professor Linden. I study Kenora: its people, its Pokemon and its very old stories.",
          "Every spring I hand a League Pass to each new trainer. Here is yours. Try not to lose it.",
          "I lose mine weekly, and I don't even need one."] },
        { say: 'linden', lines: ["Eight Gym Leaders, in any order you like. Beat them all and the League on the north cape opens.",
          "And write down what you see! Old Kenora is full of things nobody remembers the reason for."] },
        { say: 'mum', lines: ["Go on, then. Win something nice, and come home sometimes so I can hear all about it.",
          "Here, Potions. For emergencies, and for the emergencies you won't tell me about."] },
        { give: 'potion', n: 5 },
        { say: 'ethan', lines: ["Whoa whoa whoa, wait up! Is this where they hand out the League Passes?",
          "I'm Ethan! From New Bark Town, in Johto! I came over on the ferry last week!"] },
        { say: 'linden', lines: ["Ah. The boy who slept in the Center lobby for three nights. Here is your pass, Ethan.",
          "Please sleep in a bed."] },
        { say: 'ethan', lines: ["Thanks, Professor! Hey, you're new too, right? Same day, same pass. That makes us rivals!",
          "C'mon, {player}, one quick battle! Me and Quilava will go easy on you. Probably!"] },
        { battle: 'ethan', hold: true, max: 1 },
        { win: [{ say: 'ethan', lines: ["Ha! Okay, okay, you're good. That's annoying! I love it!",
            "Next time I won't go easy. I mean it. I'll go medium!"] }],
          lose: [{ say: 'ethan', lines: ["Yes! Hey, don't look like that. I've been training for years. You'll catch up fast.",
            "Probably faster than I'd like, honestly."] }] },
        { heal: true },
        { say: 'linden', lines: ["There, everyone patched up. Now off you go, both of you. Shoo.",
          "Oh, and if you see anything odd on your travels, do tell me. I adore odd."] },
        { say: 'ethan', lines: ["Last one to a gym is a Slowpoke tail! That's a Johto thing. It's a good thing to say!"] },
        { leave: 'ethan' }, { leave: 'linden' }, { leave: 'mum' },
        { flag: 'met-ethan' }
      ]
    },
    {
      id: 's0-survey', title: 'A Happiness Survey', stage: 0, after: ['s0-hello'],
      where: { town: 'away' }, trigger: 'talk', who: 'surveyor', spot: { dx: -2, dy: 2 },
      script: [
        { say: 'surveyor', lines: ["Hello, hello! Have you got a minute for the Kenora Pokemon Happiness Survey? It's ever so short!",
          "Question one. Does your Pokemon ever get scared? Of storms, or the dark, or losing?",
          "Question two. If you could make it never feel scared again, ever, would you?"] },
        { say: 'player', lines: ["Isn't being scared part of being brave?"] },
        { say: 'surveyor', lines: ["Oh! What a sweet answer. Wrong, but sweet.",
          "Here's a Potion for your time. Do smile, sweetie! Smiling is free. Everything else costs extra."] },
        { give: 'potion', n: 1 },
        { leave: 'surveyor' },
        { flag: 'survey' }
      ]
    },

    // ================= 1 badge: Team Umbra shows its face =================
    {
      id: 's1-soot', title: 'Not For Sale', stage: 1, after: ['s0-survey'],
      where: { town: 'any' }, trigger: 'talk', who: 'soot', spot: { dx: 3, dy: 2 },
      script: [
        { say: 'soot', lines: ["Good coin. Real coin. For a pup that shakes at thunder.",
          "Team pays you, pup gets fixed. No more shaking. Everybody wins."] },
        { say: 'kid', lines: ["No! I said no! Pip isn't for sale! Pip doesn't need fixing! Pip is just little!"] },
        { say: 'soot', lines: ["Hm. You. The one staring. You want to argue? Where I come from, we argue with Pokemon."] },
        { battle: 'soot', mustWin: true, minus: 2 },   // the first time, straight after a first badge: two under the band (playtest 3 needed Lv30 to win at Lv18)
        { win: [{ say: 'soot', lines: ["Hah. Good arm. Good team.", "Fine. Keep the pup. Team Umbra pays fair, ask anyone.",
            "...Don't ask anyone. I wasn't here."] }],
          lose: [{ say: 'soot', lines: ["Hah. Not much of an argument. Go rest up. I'll be around."] }] },
        { leave: 'soot' },
        { say: 'kid', lines: ["You saved Pip! Thank you thank you thank you!",
          "Mum says these are for heroes. And for scraped knees. Mostly scraped knees."] },
        { give: 'superpotion', n: 2 },
        { leave: 'kid' },
        { flag: 'umbra-known' }
      ]
    },
    {
      id: 's1-ethan', title: 'Another Badge', stage: 1, after: ['s1-soot'],
      where: { town: 'any' }, trigger: 'talk', who: 'ethan', spot: { dx: -3, dy: 2 },
      goal: 'Ethan is waiting outside the next Pokemon Center.',
      script: [
        { say: 'ethan', lines: ["{player}! Over here! Guess who just won another badge? Me! I'm on a roll!",
          "Listen. A big guy with a headband tried to buy my Eevee. Said he'd make it 'brave'.",
          "Eevee bit him. Pretty brave already, I thought.",
          "He said he was with Team Umbra. You've met him too? Huh. Anyway! Battle! Now!"] },
        { battle: 'ethan' },
        { win: [{ say: 'ethan', lines: ["Aw, man! You're catching up way too fast. Okay. Okay okay okay. I'll train harder."] }],
          lose: [{ say: 'ethan', lines: ["Another badge and a win! Today is a good day. Keep at it, you're close!"] }] },
        { say: 'ethan', lines: ["Oh! Important tip. Life or death. Never let a Miltank start rolling. Ask me how I know.",
          "In Johto a Miltank rolled over me for a whole afternoon. I still hear it in my dreams. Rolling."] },
        { leave: 'ethan' }
      ]
    },
    {
      id: 's1-chad', title: 'Just Chad', stage: 1, after: ['s1-ethan'],
      where: { town: 'any' }, trigger: 'talk', who: 'chad', spot: { dx: 4, dy: 3 },
      script: [
        { say: 'chad', lines: ["Mm? Oh. Sorry, friend. Meowth and I were napping on your bench. Were we napping on your bench?",
          "I'm Chad. Just Chad. I travel. Slowly, mostly. It's the only speed I own."] },
        { say: 'chad', lines: ["That Pokemon of yours looks at you before it looks at anything else. Did you know that?",
          "That's worth more than any badge. Keep it that way."] },
        { say: 'chad', lines: ["Not a battler today, friend. I don't battle on holiday, I nap on holiday. Here, take these."] },
        { give: 'greatball', n: 5 },
        { say: 'chad', lines: ["Never rush a nap, a cup of tea or a battle, friend. All three go cold."] },
        { leave: 'chad' },
        { flag: 'met-chad' }
      ]
    },
    {
      id: 's1-whitney', title: 'The Miltank Remembers', stage: 1, maxBadges: 4, after: ['s1-ethan'], optional: true,
      where: { town: 'G7' }, trigger: 'talk', who: 'ethan', spot: { dx: -2, dy: 3 },
      script: [
        { say: 'ethan', lines: ["{player}! Shh! Get down! Is she looking? She's not looking. Good.",
          "I need Goldacre's badge. Which means beating Whitney. Which means... the Miltank."] },
        { say: 'whitney', lines: ["Ethan? Oh, how lovely! I thought that was you. Haven't you grown!"] },
        { say: 'ethan', lines: ["Miss Whitney! Hi! Hello! I'm fine. I'm totally fine. How's, um. Everyone?"] },
        { say: 'whitney', lines: ["Miltank is wonderful, thank you. She remembers you too, you know.",
          "She gets ever so excited whenever I say your name. Shall I fetch her?"] },
        { say: 'ethan', lines: ["No! I mean, no thank you! Busy! Very busy! Got to go! Bye!"] },
        { leave: 'ethan' },
        { say: 'whitney', lines: ["Oh dear. He ran off before I could tell him. Miltank only wanted to say sorry.",
          "Do pass it on, won't you? She never did learn to be gentle."] },
        { leave: 'whitney' }
      ]
    },

    // ================= 2 badges: the boats at Spindlewood =================
    {
      id: 's2-tip', title: 'Crates at Night', stage: 2, after: ['s1-chad'],
      where: { town: 'any' }, trigger: 'talk', who: 'linden', spot: { dx: 2, dy: 3 },
      goal: 'Professor Linden is at the next Pokemon Center.',
      script: [
        { say: 'linden', lines: ["{player}! Oh, good, I hoped I'd catch you. I've been collecting odd things, as promised.",
          "Wild Pokemon are going missing along the coast. And the dockhands at Spindlewood talk of a boat.",
          "It leaves the cove at night, full of crates, and sails out to a ship that never comes to port."] },
        { say: 'linden', lines: ["I told your friend Ethan. He ran off toward Spindlewood before I'd finished my sentence.",
          "Could you go after him? Gently. Spindlewood is the timber dock town in the south-east."] },
        { leave: 'linden' }
      ]
    },
    {
      id: 's2-docks', title: 'The Tender', stage: 2, after: ['s2-tip'],
      where: { town: 'T6', r: 16 }, trigger: 'enter',
      goal: 'Go to Spindlewood, the timber dock town in the south-east.',
      script: [
        { say: 'ethan', lines: ["{player}! Perfect timing! Okay, not perfect, my team's worn out. They just keep coming!"] },
        { say: 'grunt', lines: ["Crates on the tender! Move it! The lieutenant hates waiting!"] },
        { say: 'grunt', lines: ["Hey! No kids on the docks! Clear off, or I clear you off!"] },
        { battle: 'grunt', team: [['zubat', 0], ['koffing', 0], ['purrloin', 1], ['houndour', 1], ['trubbish', 2]] },
        { win: [{ say: 'grunt', lines: ["Lieutenant! Lieutenant, the kid is winning!"] }], lose: [{ say: 'grunt', lines: ["Ha! Now scram, before the lieutenant sees you."] }] },
        { say: 'jet', lines: ["Waiting, waiting, always waiting! I hate it! Waiting is just losing, slowly!",
          "Who's this? Another one? No time! Battle in ten seconds. Nine. Eight. Oh, forget it, go!"] },
        { battle: 'jet', mustWin: true, max: 3, minus: 2 },   // three mons, two levels down: Jet came straight after a grunt with four mons at the next gym's levels (two playtests lost to her at Lv30+)
        { win: [{ say: 'jet', lines: ["Late! I'm never late! You made me late!",
            "Forget the crates! Cast off, cast off! The ship won't wait, and neither will I!"] }],
          lose: [{ say: 'jet', lines: ["Ha! Signed, sealed, gone! Better luck next delivery!"] }] },
        { leave: 'jet' }, { leave: 'grunt' },
        { say: 'ethan', lines: ["She left the crates! Quick, help me get these open!",
          "Wingull, Wimpod, a Pineco... they're all wild ones. Go on, you're free! Go home!",
          "Hey. This one's empty. There's black stuff all over the inside, like ink. It's freezing cold."] },
        { flag: 'docks' }
      ]
    },
    {
      id: 's2-ethan', title: 'The Ship That Waits', stage: 2, after: ['s2-docks'],
      where: { town: 'T6' }, trigger: 'talk', who: 'ethan', spot: { dx: 3, dy: 2 },
      goal: 'Talk to Ethan outside the Spindlewood Pokemon Center.',
      script: [
        { say: 'ethan', lines: ["The dockhands say there's a ship way out past the cove. It hasn't moved all day. Just waiting.",
          "Can I tell you something? Back in Johto, I made it all the way to the League. The very end."] },
        { say: 'ethan', lines: ["And I froze. Couldn't pick a move. Couldn't even call my partner's name. I just stood there.",
          "So I came here to start over. I'm not freezing again. Ever. I'm going to get strong enough."] },
        { say: 'ethan', lines: ["Anyway! That's enough feelings for one day. Here, I bought too many of these. Next time, we battle!"] },
        { give: 'superpotion', n: 3 },
        { leave: 'ethan' }
      ]
    },

    // ================= 3 badges: the glow climbs =================
    {
      id: 's3-word', title: 'Word Up the Road', stage: 3, after: ['s2-ethan'],
      where: { town: 'any' }, trigger: 'talk', who: 'linden', spot: { dx: -2, dy: 3 },
      goal: 'Professor Linden is at the next Pokemon Center.',
      script: [
        { say: 'linden', lines: ["{player}! Word came up the road from Sporehaven, and the word was 'glow'.",
          "The wardens keep the glowing fungus cut back along the line to Duskmoss. It has climbed past it."] },
        { say: 'linden', lines: ["There's an old warden saying. 'When the glow climbs, the dark is near.' I thought it was poetry.",
          "Rue, the gym leader, wants any trainer who can battle. I think she means you. Go to Duskmoss."] },
        { leave: 'linden' }
      ]
    },
    {
      id: 's3-duskmoss', title: 'The Glowing Fence', stage: 3, after: ['s3-word'],
      where: { town: 'T8' }, trigger: 'enter',
      goal: 'Go to Duskmoss, at the end of the road on the south coast.',
      script: [
        { say: 'rue', lines: ["You came. Good. Look at the fence. It glows when it likes, but never like this."] },
        { say: 'grunt', lines: ["Readings are off the scale! The whole line is lit up like a festival!"] },
        { say: 'grunt', lines: ["Wait, who let a trainer in here? Nobody touches the instruments!"] },
        { battle: 'grunt', team: [['stunky', 0], ['grimer', 0], ['murkrow', 1], ['koffing', 1], ['gastly', 2]] },
        { win: [{ say: 'grunt', lines: ["My readings! You knocked them right off the scale."] }], lose: [{ say: 'grunt', lines: ["And stay down. These readings are important."] }] },
        { say: 'wash', lines: ["Of course it is, darling. It's doing what it was planted to do. Isn't it clever?",
          "Oh! It's you! My favourite survey answer. 'Isn't being scared part of being brave?' Adorable.",
          "I'm Wash, sweetie. Team Umbra's face, voice and wardrobe. I'm sure you have questions.",
          "Ask my Pokemon. They love an audience."] },
        { battle: 'wash', mustWin: true },
        { win: [{ say: 'wash', lines: ["Ugh! Upstaged! On the south coast! In front of a fungus!"] }],
          lose: [{ say: 'wash', lines: ["And scene! Thank you, thank you. No autographs."] }] },
        { say: 'inkwell', lines: ["That will do, Wash. We have our reading. The old warning still works. How quaint.",
          "How do you do. I am Inkwell. Forgive the intrusion, warden. We were only taking a measurement."] },
        { say: 'rue', lines: ["Of what?"] },
        { say: 'inkwell', lines: ["Of the dark, warden. It lies closer to the surface than your grandmothers hoped.",
          "A Pokemon touched by it feels no fear. None at all. Tell me, child. Is that not a kindness?"] },
        { leave: 'inkwell' }, { leave: 'wash' }, { leave: 'grunt' },
        { say: 'rue', lines: ["My crews have cut this line for two hundred years. I thought we were holding back fungus.",
          "Seems the fungus was holding back something else. Or warning us about it."] },
        { say: 'rue', lines: ["Walk Route 1 down to the Quiet Plain. The old ones built it after the last dark. Ask there.",
          "Take these. Spores, poison, worse. Mind the floor."] },
        { give: 'fullheal', n: 3 },
        { leave: 'rue' },
        { flag: 'met-inkwell' }
      ]
    },
    {
      id: 's3-plain', title: 'What the Plain Remembers', stage: 3, after: ['s3-duskmoss'],
      where: { town: 'L4' }, trigger: 'enter',
      goal: 'Walk Route 1 south to the Quiet Plain.',
      script: [
        { say: 'linden', lines: ["{player}! I came the moment I heard about Duskmoss. Of course the answers would be down here.",
          "Everyone visits this plain, and nobody remembers why. I've spent years asking why."] },
        { say: 'linden', lines: ["Long ago a darkness came out of the north-west. People called it the Curse. It closed hearts.",
          "Pokemon it touched stopped hearing their trainers. They still fought, but they felt nothing at all.",
          "People ran south, down that old road, until there was no more road. They ran to right here."] },
        { say: 'linden', lines: ["And here they stopped running. They called their Pokemon by name, and they stayed beside them.",
          "The ones who were called came back, and the dark broke. The stones on Route 1 count their road.",
          "After, a tower was raised over the place the dark came from. We call it the Statue of Umbra."] },
        { say: 'linden', lines: ["Team Umbra. The Statue of Umbra. That is not a coincidence, is it?",
          "The ghost-speaker here can teach you to sense a Pokemon with a closed heart. Do ask her.",
          "And if Umbra is making these Pokemon, someone is selling them. Everything gets sold in Tradeway."] },
        { leave: 'linden' },
        { flag: 'curse-known' }
      ]
    },

    // ================= 4 badges: the market, the temptation, the theft =================
    {
      id: 's4-market', title: 'Fearless, For Sale', stage: 4, after: ['s3-plain'],
      where: { town: 'T4' }, trigger: 'enter',
      goal: 'Go to the Tradeway market. Umbra is selling something.',
      script: [
        { say: 'soot', lines: ["Fearless Pokemon! Never flinch! Never cry! Never quit! Best deal in Tradeway!",
          "Oh. You again. The one with the good arm.",
          "Look at this Houndour. Never barks. Never shakes. Boss says that's a kindness."] },
        { say: 'player', lines: ["Then why does it look so sad?"] },
        { say: 'soot', lines: ["It don't look sad. It don't look anything. That's the point.",
          "Bah. You want to talk, talk with your team."] },
        { battle: 'soot', mustWin: true },
        { win: [{ say: 'soot', lines: ["Hah. You hit like a boiler."] }],
          lose: [{ say: 'soot', lines: ["Come back when you hit harder."] }] },
        { say: 'soot', lines: ["My Houndoom used to hide under my bunk on the ship. Every storm. Shaking like a leaf.",
          "I'd sit with him till it passed. Best nights I ever had. Funny, that.",
          "I'm taking a break. A long one. The cage is open. I didn't see nothing."] },
        { leave: 'soot' },
        { flag: 'soot-doubts' }
      ]
    },
    {
      id: 's4-ethan', title: 'Seven Cards', stage: 4, after: ['s4-market'],
      where: { town: 'any' }, trigger: 'talk', who: 'ethan', spot: { dx: 3, dy: 3 },
      goal: 'Ethan is waiting outside the next Pokemon Center.',
      script: [
        { say: 'ethan', lines: ["{player}. Hey. I've been training every day. Every single day. Let's go. Right now."] },
        { battle: 'ethan' },
        { win: [{ say: 'ethan', lines: ["Again? AGAIN? I train harder than anyone! What am I doing wrong?",
            "...Sorry. That's not your fault. Good battle. Really."] }],
          lose: [{ say: 'ethan', lines: ["I won. So why does it feel like this? My team looked scared out there. Scared of me pushing."] }] },
        { say: 'ethan', lines: ["I just need an edge. One thing nobody else has. Then I'd never freeze again."] },
        { say: 'wash', lines: ["Oh, what a strong boy. And what a shame about all that losing. I could fix that, you know."] },
        { say: 'player', lines: ["Ethan, wait! That's Wash, from Team Umbra!"] },
        { say: 'ethan', lines: ["I know who she is. I said I'd only talk."] },
        { say: 'wash', lines: ["A friend with a card up her sleeve, sweetie. Seven cards, actually. Walk with me?"] },
        { leave: 'ethan' }, { leave: 'wash' },
        { flag: 'ethan-tempted' }
      ]
    },
    {
      id: 's4-account', title: 'The Missing Page', stage: 4, after: ['s4-ethan'],
      where: { town: 'any' }, trigger: 'talk', who: 'linden', spot: { dx: -3, dy: 2 },
      goal: 'Professor Linden is at the next Pokemon Center.',
      script: [
        { say: 'linden', lines: ["{player}, terrible news. The museum in Aldermere City was robbed last night. One page was taken.",
          "The Wardens' Account. The oldest record in Kenora. It tells how the tower was sealed.",
          "The thief paid for it, if you can believe that. Left a gold coin on the empty case. A fake one."] },
        { say: 'linden', lines: ["A man called Inkwell was at Duskmoss, you said? Our archivist is called Inkwell. He's gone.",
          "Gentle man. Ink everywhere. He catalogued that very page himself."] },
        { say: 'linden', lines: ["I copied one line of it years ago. 'The tower holds the dark. The Keeper holds the door.'",
          "I don't know who the Keeper is yet. I mean to find out. Here, for the road."] },
        { give: 'hyperpotion', n: 2 },
        { leave: 'linden' }
      ]
    },

    // ================= 5 badges: the seventh card, and Umbra comes home =================
    {
      id: 's5-seventh', title: 'The Seventh Card', stage: 5, after: ['s4-account'],
      where: { town: 'any' }, trigger: 'talk', who: 'ethan', spot: { dx: 2, dy: 2 },
      goal: 'Ethan is waiting outside the next Pokemon Center.',
      script: [
        { say: 'ethan', lines: ["Hey, {player}. I got my edge. Want to see? Course you do.",
          "Six Pokemon in a team. That's the rule. Nobody said anything about a seventh card.",
          "It's a Tyranitar. It doesn't flinch. It doesn't get tired. It doesn't get scared. Ever.",
          "But I'll battle you with my real team. Fair's fair. C'mon."] },
        { battle: 'ethan' },
        { win: [{ say: 'ethan', lines: ["...Okay. You're still better. Fine. But watch this."] }],
          lose: [{ say: 'ethan', lines: ["See? I'm getting there. And I've still got my seventh card."] }] },
        { say: 'ethan', lines: ["Tyranitar, come out and show them what fearless looks like. Tyranitar? Hey! Not Typhlosion!",
          "Stop! Get back in your ball! Please! ...There. It's back. It didn't look at me once.",
          "Typhlosion's okay. It's okay. I'm okay. I have to go."] },
        { leave: 'ethan' },
        { say: 'grunt', lines: ["Move it! The big show in {home} starts at noon, and Wash wants a full crowd!"] },
        { leave: 'grunt' },
        { flag: 'ethan-shadow' }
      ]
    },
    {
      id: 's5-home', title: 'Fearless Kenora', stage: 5, after: ['s5-seventh'],
      where: { town: 'home' }, trigger: 'enter',
      goal: 'Get back to {home}. Something is happening there.',
      script: [
        { say: 'wash', lines: ["Good people of {home}! Behold the Pokemon of tomorrow! Fearless! Flawless! Obedient!",
          "Our fearless friends do whatever they're told, and they never, ever flinch. Isn't it marvellous?"] },
        { say: 'mum', lines: ["{player}! Thank goodness. They've been at it all morning. Those poor Pokemon look so empty."] },
        { say: 'wash', lines: ["And now, through the ring of fire! Go on! ...Go on? Hello?",
          "Why are they looking at me like that? Stop! Sit! I said sit! Somebody do something!"] },
        { say: 'grunt', lines: ["Oi! The show is not over! Back behind the rope!"] },
        { battle: 'grunt', team: [['poochyena', 0], ['zubat', 0], ['koffing', 1], ['houndour', 1], ['murkrow', 2]] },
        { win: [{ say: 'grunt', lines: ["Boo. Worst show ever. I want my money back."] }], lose: [{ say: 'grunt', lines: ["Back behind the rope, like I said."] }] },
        { say: 'chad', lines: ["Friend. I think that means us. I'll keep the crowd back. You keep Wash busy."] },
        { battle: 'wash', mustWin: true },
        { win: [{ say: 'wash', lines: ["Fine! FINE! The show is cancelled! There will be no refunds!"] }],
          lose: [{ say: 'wash', lines: ["Ha! And that, darlings, is showbiz!"] }] },
        { leave: 'wash' },
        { say: 'chad', lines: ["There. The poor things have wandered off into the grass. They didn't run. They just went."] },
        { say: 'mum', lines: ["Is everyone alright? Is YOUR everyone alright? Come here. You did so well."] },
        { heal: true },
        { leave: 'mum' },
        { flag: 'show-stopped' }
      ]
    },
    {
      id: 's5-chad', title: 'Brave Is Staying', stage: 5, after: ['s5-home'],
      where: { town: 'home' }, trigger: 'talk', who: 'chad', spot: { dx: 4, dy: 2 },
      goal: 'Talk to Chad outside the {home} Pokemon Center.',
      script: [
        { say: 'chad', lines: ["Wash called them fearless. She's half right. A Pokemon that can't be afraid can't be brave either.",
          "Brave is being scared and staying anyway. Those poor things can't stay. They can't do anything."] },
        { say: 'chad', lines: ["Your friend Ethan has one of them now, doesn't he? I saw it on your face.",
          "He'll need you, sooner or later. Be there when he does. Here, for the hard days ahead."] },
        { give: 'ultraball', n: 5 },
        { leave: 'chad' }
      ]
    },

    // ================= 6 badges: the Keeper =================
    {
      id: 's6-keeper', title: 'The Keeper', stage: 6, after: ['s5-chad'],
      where: { town: 'any' }, trigger: 'talk', who: 'linden', spot: { dx: 2, dy: 3 },
      goal: 'Professor Linden is at the next Pokemon Center.',
      script: [
        { say: 'linden', lines: ["{player}! I've found the Keeper. Or at least where the Keeper lives.",
          "Dunereach, the desert town in the north. Its people have looked after the old tower forever.",
          "Its gym leader, Vesper, comes from a long line of keepers. If anyone holds the door, she does."] },
        { say: 'linden', lines: ["And if I could work that out from library books, Inkwell certainly has. Please hurry."] },
        { leave: 'linden' }
      ]
    },
    {
      id: 's6-dunereach', title: 'Very Old Pots', stage: 6, after: ['s6-keeper'],
      where: { town: 'G1' }, trigger: 'enter',
      goal: 'Go to Dunereach, the desert town in the north.',
      script: [
        { say: 'jet', lines: ["Come on, come on! Search faster! The boss wanted that key yesterday!"] },
        { say: 'soot', lines: ["Searched twice. No key. Just a lot of very old pots."] },
        { say: 'vesper', lines: ["Those pots are older than your grandmother, young man. Do put them down."] },
        { say: 'soot', lines: ["...Sorry, ma'am."] },
        { say: 'jet', lines: ["You again?! I don't have time for you! I don't have time for anything! Out of my way!"] },
        { battle: 'jet', mustWin: true },
        { win: [{ say: 'jet', lines: ["Slow! You made me slow! Nobody makes me slow!",
            "Forget the key, Soot! Wash says she's got it covered. We're leaving. Now. Faster than now!"] }],
          lose: [{ say: 'jet', lines: ["Out of my way, out of my way! Gone!"] }] },
        { leave: 'jet' },
        { say: 'soot', lines: ["Ma'am. Sorry about the pots."] },
        { leave: 'soot' },
        { say: 'vesper', lines: ["Thank you, child. Out here I am simply Vesper, keeper of the door. And of the pots, it seems.",
          "They were too late, and so was I. A charming young lady came by last night with a survey.",
          "She asked if my Yamask ever felt afraid. I said it used to be a person, dear. It is past all that.",
          "When she left, the key went with her. The tower door can be opened now."] },
        { say: 'vesper', lines: ["The tower holds the dark. I hold the door. Held. I will go north and do what I can.",
          "Take this. Keep calm, child. Ghosts are only frightening until you learn their names."] },
        { give: 'tm_calmmind', n: 1 },
        { leave: 'vesper' },
        { flag: 'key-stolen' }
      ]
    },
    {
      id: 's6-ethan', title: 'A Name', stage: 6, after: ['s6-dunereach'],
      where: { town: 'any' }, trigger: 'talk', who: 'ethan', spot: { dx: -2, dy: 2 },
      goal: 'Ethan is waiting outside the next Pokemon Center.',
      script: [
        { say: 'ethan', lines: ["Hey. Don't worry, I'm not here to battle. Tyranitar stays in its ball now. I don't let it out.",
          "Wash said it'd be my strongest Pokemon. It is. It's also nobody's. It won't even look at me."] },
        { say: 'ethan', lines: ["The professor told me about the Quiet Plain. About calling them back.",
          "How do you get through to a Pokemon that won't listen? I've tried everything."] },
        { say: 'player', lines: ["You call it by name. And you don't leave."] },
        { say: 'ethan', lines: ["...I never gave it a name. I never even asked if it wanted one.",
          "Umbra's going to the tower, aren't they? I'm going too. I've got something to give back."] },
        { leave: 'ethan' }
      ]
    },

    // ================= 7 badges: the Statue of Umbra =================
    {
      id: 's7-call', title: 'Grey Sky', stage: 7, after: ['s6-ethan'],
      where: { town: 'any' }, trigger: 'talk', who: 'chad', spot: { dx: 3, dy: 2 },
      goal: 'Chad is waiting outside the next Pokemon Center.',
      script: [
        { say: 'chad', lines: ["Friend. Look to the north-west. See how grey the sky's gone up there, in the middle of the day?",
          "That's the tower. Umbra has opened the door. Vesper is holding the road with what she has."] },
        { say: 'chad', lines: ["I'm going too. I'm a sort of caretaker for this region. Unofficially. Mostly unofficially.",
          "Meet me at the Statue of Umbra. Bring everything you've got. Your friend is headed there too."] },
        { give: 'fullrestore', n: 3 },
        { leave: 'chad' }
      ]
    },
    {
      id: 's7-gate', title: 'The Gate', stage: 7, after: ['s7-call'],
      where: { town: 'L1', r: 12 }, trigger: 'enter',
      goal: 'Go to the Statue of Umbra in the far north-west.',
      script: [
        { say: 'vesper', lines: ["You came. Good. Inkwell's people went in through the court. The dark is rising from the door."] },
        { say: 'chad', lines: ["Vesper and I will hold the avenue. Somebody has to walk up it, and I think that's you."] },
        { say: 'grunt', lines: ["Nobody gets past the courtyard. Orders from the top!"] },
        { battle: 'grunt', team: [['houndour', 0], ['gastly', 0], ['grimer', 1], ['murkrow', 1], ['stunky', 2]] },
        { win: [{ say: 'grunt', lines: ["The top can deal with you, then. I am going home."] }], lose: [{ say: 'grunt', lines: ["Orders are orders. Turn around."] }] },
        { say: 'soot', lines: ["Stop there.",
          "Boss told me to hold the gate. I've held a lot of things for the boss. Crates. Cages. My tongue.",
          "I seen what's in that tower. That ain't kindness. That's just quiet. A horrible quiet.",
          "But I ain't letting you near him unless you can beat me. He's stronger than me. Lots."] },
        { battle: 'soot', mustWin: true },
        { win: [{ say: 'soot', lines: ["Hah. Yeah. You're ready."] }],
          lose: [{ say: 'soot', lines: ["Not ready. Rest. Come back. I'll still be here."] }] },
        { say: 'soot', lines: ["I quit. There. Said it. Felt good. Houndoom, we're done with this.",
          "A kid with wild hair ran straight past me a minute ago. Brave or daft. Both, probably. Go on."] },
        { leave: 'soot' },
        { say: 'vesper', lines: ["Stand still a moment, child. Bronzong will hum, and you will feel rested."] },
        { heal: true },
        { leave: 'vesper' }, { leave: 'chad' },
        { flag: 'soot-quit' }
      ]
    },
    {
      id: 's7-pebble', title: 'Pebble', stage: 7, after: ['s7-gate'],
      where: { town: 'L1', r: 12 }, trigger: 'enter',
      goal: 'Find Ethan at the Statue of Umbra.',
      script: [
        { say: 'ethan', lines: ["{player}! It got out! I didn't let it, it just got out! It won't stop!",
          "It's not angry. It's not anything. It's like there's nobody in there. Please. Help me!",
          "Battle it! Wear it down! I just need it to stop long enough to hear me!"] },
        { battle: 'ethan', team: 'shadow', hold: true, mustWin: true },
        { win: [{ say: 'ethan', lines: ["It's slowing down. Okay. Okay. My turn."] }],
          lose: [{ say: 'ethan', lines: ["It's too strong! Pull back! We'll try again. I'm not leaving it!"] }] },
        { say: 'ethan', lines: ["Hey. Hey, big guy. I'm sorry. They put you in a ball and handed you to me.",
          "And I never asked you a single thing. Not even your name.",
          "So here's a name. Pebble. Because you were a little Larvitar once. I bet you were. Pebble.",
          "Pebble. I'm right here. I'm scared too. I'm not leaving. Come back, Pebble."] },
        { say: 'ethan', lines: ["...It looked at me. {player}, it looked at me! Its eyes are clear! Pebble, you're back!",
          "Here, let me patch your team up. I've been saving potions for a disaster. This counts."] },
        { heal: true },
        { say: 'ethan', lines: ["Inkwell's up at the tower door. Let's finish this. Together this time."] },
        { flag: 'pebble-saved' }
      ]
    },
    {
      id: 's7-tower', title: 'The Door', stage: 7, after: ['s7-pebble'],
      where: { town: 'L1', r: 12 }, trigger: 'enter',
      goal: 'Stop Inkwell at the tower door.',
      script: [
        { say: 'inkwell', lines: ["Ah. The child with the sweet survey answer. And Ethan. I see the Tyranitar has... woken up.",
          "Look at the door. Can you feel it? Old, cold quiet. Within the hour it will cover all of Kenora."] },
        { say: 'inkwell', lines: ["No more fear. Not in any Pokemon. Not ever. My Koffing was afraid of everything, you know.",
          "Thunder. Crowds. Me. I only wanted it to stop hurting. Fear is a splinter in the heart."] },
        { say: 'ethan', lines: ["Pebble wasn't happy! It was all alone in there! That's not kind. That's just lonely!"] },
        { say: 'inkwell', lines: ["Then we will settle it the old way. Show me what a frightened Pokemon can do."] },
        { battle: 'inkwell', mustWin: true },
        { win: [{ say: 'inkwell', lines: ["They were afraid. I could see it. And they stood their ground anyway. Every one of them."] }],
          lose: [{ say: 'inkwell', lines: ["You see? Fear loses. Rest, child. Then come back and lose again."] }] },
        { say: 'inkwell', lines: ["The door! The dark is pushing back out. It will not stop now. Weezing, get behind me!",
          "Weezing? You're shaking. You're terrified. And you are standing in front of me anyway."] },
        { say: 'soot', lines: ["Ma'am! Got something of yours. Lifted it from Wash's bag the day I quit. She'll be livid."] },
        { say: 'vesper', lines: ["My key. Thank you, Soot. Stand back, all of you. A Keeper's work is not complicated.",
          "There. The door is shut, and the tower holds the dark again. Look up. The sky is clearing."] },
        { say: 'chad', lines: ["Nicely done, all of you. Wash and Jet took a boat out to that ship of theirs. They'll keep.",
          "Inkwell. Come along. We'll talk somewhere with better light."] },
        { say: 'inkwell', lines: ["Yes. I think I would like that. I was wrong about the dark.",
          "I wonder what else I was wrong about."] },
        { leave: 'inkwell' }, { leave: 'chad' }, { leave: 'soot' }, { leave: 'vesper' },
        { say: 'ethan', lines: ["We did it. We actually did it! And Pebble's smiling. Look! Do Tyranitar smile?",
          "I'll see you at the League. And this time I won't freeze. I promise."] },
        { leave: 'ethan' },
        { flag: 'tower-sealed' }
      ]
    },

    // ================= 8 badges: the road north =================
    {
      id: 's8-dawn', title: 'Clear Sky', stage: 8, after: ['s7-tower'],
      where: { town: 'any' }, trigger: 'talk', who: 'linden', spot: { dx: 2, dy: 2 },
      goal: 'Professor Linden is at the next Pokemon Center.',
      script: [
        { say: 'linden', lines: ["{player}! Eight badges, and the tower shut! I'm writing it all down. My hand hurts. I love it.",
          "Some of Umbra's Shadow Pokemon are still out there. If you ever meet one, call it by name.",
          "But that can wait a little while. The League gate on the north cape is open to you now. Go on!"] },
        { say: 'linden', lines: ["Oh! Inkwell is helping me put the Account back together. He has lovely handwriting. Who knew?"] },
        { give: 'maxrevive', n: 2 },
        { leave: 'linden' }
      ]
    },
    {
      id: 's8-ethan', title: 'Allowed to Be Scared', stage: 8, after: ['s8-dawn'],
      where: { town: 'any' }, trigger: 'talk', who: 'ethan', spot: { dx: -3, dy: 2 },
      goal: 'Ethan is waiting outside the next Pokemon Center.',
      script: [
        { say: 'ethan', lines: ["Eight badges. Both of us! Pebble's training with the rest of the team now. It's the best.",
          "I used to think strong meant never being scared. Never losing. Never freezing up.",
          "But Pebble was strongest the moment it was scared and stayed anyway.",
          "So I guess I'm allowed to be scared too."] },
        { say: 'ethan', lines: ["I'll be waiting at the League gate. Don't you dare go easy on me. Also, medium was a lie."] },
        { leave: 'ethan' }
      ]
    },

    // ================= the League =================
    {
      id: 'lg-gate', title: 'The Last Rival Battle', stage: 8, after: ['s8-ethan'],
      where: { town: 'L3', r: 12 }, trigger: 'enter',
      goal: 'Go to the Pokemon League on the north cape.',
      script: [
        { say: 'ethan', lines: ["There you are! I've been warming up for an hour. Pebble warmed up too. The ground's cracked.",
          "This is it. Last battle before the Champion. Whoever wins walks through that gate.",
          "Pebble's sitting this one out. My six and your six. Everything we've got. C'mon!"] },
        { battle: 'ethan', mustWin: true },
        { win: [{ say: 'ethan', lines: ["Yeah. Yeah! That's how it should feel! I lost, and I didn't freeze once!",
            "Go on. Walk through that gate and win it. I'll be right behind you. Like, next year."] }],
          lose: [{ say: 'ethan', lines: ["Ha! Not today! Heal up and come back. The gate's not going anywhere, and neither am I."] }] },
        { heal: true },
        { leave: 'ethan' }
      ]
    },
    {
      id: 'lg-champion', title: 'Holiday Is Over', stage: 8, after: ['lg-gate'],
      where: { town: 'L3', r: 12 }, trigger: 'enter',
      goal: 'Face the Champion at the Pokemon League.',
      script: [
        { say: 'chadwick', lines: ["Hello, friend. Fancy meeting you here. Have a seat? No? Straight to it, then.",
          "Chadwick, Champion of Kenora. Chad to anyone who's watched me nap on a bench.",
          "I never lied, you know. I was on holiday. A long, busy holiday. Holiday's over.",
          "I've watched you all the way here. You fought for your Pokemon and for your friend. Now, me."] },
        { battle: 'chadwick', mustWin: true },
        { win: [{ say: 'chadwick', lines: ["Splendid. Absolutely splendid. I knew it from the very first nap.",
            "Kenora has a new Champion. Take a bow. Persian, stop sulking, it's undignified."] }],
          lose: [{ say: 'chadwick', lines: ["Not quite, friend. Rest, think, come back. Never rush a battle. It goes cold."] }] },
        { say: 'ethan', lines: ["{player}! Did you...? You did! I knew it! I told everyone! I told a Wingull!"] },
        { say: 'linden', lines: ["Champion {player}! Oh, I'm going to need a much bigger notebook."] },
        { say: 'chadwick', lines: ["Every Champion is given one of these. I never used mine. I suspect you'll find a use for it."] },
        { give: 'masterball', n: 1 },
        { leave: 'ethan' }, { leave: 'linden' }, { leave: 'chadwick' },
        { flag: 'champion' }
      ]
    },

    // ================= after the League =================
    {
      id: 'pg-home', title: 'Champions Eat Dinner', stage: 8, after: ['lg-champion'],
      where: { town: 'home' }, trigger: 'enter',
      goal: 'Go home to {home}. Someone wants to see you.',
      script: [
        { say: 'mum', lines: ["{player}! The Champion! My Champion! The whole town ran to the Center the minute they heard.",
          "Ethan came by. He ate everything in the kitchen and told me you were brilliant. Twice.",
          "Professor Linden left a note, too. Something about the old tower humming. She said to see Vesper.",
          "After dinner. Champions still eat dinner. Oh, and your gran sent sweets for your Pokemon."] },
        { give: 'rarecandy', n: 3 },
        { leave: 'mum' }
      ]
    },
    {
      id: 'pg-vesper', title: 'Stairs Going Down', stage: 8, after: ['pg-home'],
      where: { town: 'L1', r: 12 }, trigger: 'enter',
      goal: 'Visit Vesper at the Statue of Umbra.',
      script: [
        { say: 'vesper', lines: ["Ah, the Champion. Come here, child. Put your ear to the door. Do you hear it?",
          "Since the door was shut, the tower has hummed. My Bronzong hums back. They are having a chat.",
          "There are stairs under this tower. They go further down than the tower goes up.",
          "Something down there is awake now. Not angry. Not yet. Only awake. Come back when you are ready."] },
        { say: 'soot', lines: ["I haul stones for Ms. Vesper now. Honest work. Houndoom likes it. Lots of warm rocks to lie on."] },
        { leave: 'soot' }, { leave: 'vesper' },
        { flag: 'deep-hint' }
      ]
    },
    {
      id: 'pg-cutter', title: 'Nine Stones', stage: 8, after: ['lg-champion'], optional: true,
      where: { zone: 'route1' }, trigger: 'enter',
      script: [
        { say: 'cutter', lines: ["Oh. Someone walking this road on purpose. That's rare. Mind the chips, they're sharp.",
          "I cut the numbers fresh every year. Nine stones for the nine days the old ones walked south.",
          "My family has done it since the dark broke. So the road stays ready, if anyone needs it again.",
          "The Champion, eh? Then maybe this year I'll let the moss have a stone or two. Maybe."] },
        { leave: 'cutter' }
      ]
    }
  ]
};
