// Adventure music: Gen 4 HeartGold/SoulSilver and Diamond/Pearl rips (archive.org), the owner's Silver Gallium tracks and three Gen 4 battle tracks. 96 kbps mp3 in assets/music/adv.
window.ADV_MUSIC = {
  tracks: {
    'newbark-farm': 'assets/music/adv/newbark-farm.mp3', 'ruins': 'assets/music/adv/ruins.mp3', 'park': 'assets/music/adv/park.mp3',
    'chateau': 'assets/music/adv/chateau.mp3', 'jubilife': 'assets/music/adv/jubilife.mp3', 'canalave': 'assets/music/adv/canalave.mp3',
    'cianwood': 'assets/music/adv/cianwood.mp3', 'lilycove': 'assets/music/adv/lilycove.mp3', 'snowpoint': 'assets/music/adv/snowpoint.mp3',
    'mine': 'assets/music/adv/mine.mp3', 'route29': 'assets/music/adv/route29.mp3', 'eterna': 'assets/music/adv/eterna.mp3',
    'route228': 'assets/music/adv/route228.mp3', 'route225': 'assets/music/adv/route225.mp3', 'route201-night': 'assets/music/adv/route201-night.mp3',
    'center': 'assets/music/adv/center.mp3', 'mart': 'assets/music/adv/mart.mp3', 'gym': 'assets/music/adv/gym.mp3',
    'victory-wild': 'assets/music/adv/victory-wild.mp3', 'victory-trainer': 'assets/music/adv/victory-trainer.mp3',
    'wild-battle': 'assets/music/adv/wild-battle.mp3', 'trainer-battle': 'assets/music/adv/trainer-battle.mp3', 'gym-battle': 'assets/music/adv/gym-battle.mp3',
    'legendary-battle': 'assets/music/adv/legendary-battle.mp3',
    'town': 'assets/music/adv/town.mp3', 'route': 'assets/music/adv/route.mp3',
    'gen4-hgss-johto': 'assets/music/adv/gen4-hgss-johto.mp3', 'gen4-hgss-kanto': 'assets/music/adv/gen4-hgss-kanto.mp3', 'gen4-dpp': 'assets/music/adv/gen4-dpp.mp3'
  },
  // every zone id (data/adv/zones.js) and town code (data/adv/world.js) -> track name
  zones: {
    G1: 'ruins', dunereach: 'ruins',
    G2: 'gen4-hgss-johto', sprucevale: 'gen4-hgss-johto',
    G3: 'park', fernwellpark: 'park',
    G4: 'mine', claystone: 'mine',
    G5: 'jubilife', aldermerecity: 'jubilife',
    G6: 'eterna', pinegrove: 'eterna',
    G7: 'newbark-farm', goldacre: 'newbark-farm',
    G8: 'chateau', sporehaven: 'chateau',
    T1: 'snowpoint', frostfall: 'snowpoint',
    T2: 'canalave', sailsport: 'canalave',
    T3: 'town', hallowmead: 'town',
    T4: 'gen4-hgss-kanto', tradeway: 'gen4-hgss-kanto',
    T5: 'cianwood', saltbay: 'cianwood',
    T6: 'canalave', spindlewood: 'canalave',
    T7: 'lilycove', longshore: 'lilycove',
    T8: 'chateau', duskmoss: 'chateau',
    L1: 'chateau', statueofumbra: 'chateau',
    L2: 'park', fernwellsanctuary: 'park',
    L3: 'gen4-dpp', pokemonleague: 'gen4-dpp',
    L4: 'ruins', quietplain: 'ruins',
    wild: 'route29',
    route1: 'route29', route2: 'chateau', route3: 'route', route4: 'mine', route5: 'route29', route6: 'lilycove',
    route7: 'route29', route8: 'route', route9: 'cianwood', route10: 'route', route11: 'eterna', route12: 'eterna',
    route13: 'eterna', route14: 'route228', route15: 'route228', route16: 'route225', route17: 'route225', route18: 'snowpoint',
    route19: 'route225', route20: 'snowpoint', route21: 'mine', route22: 'route29', route23: 'route29', route24: 'route29',
    route101: 'eterna', route103: 'route228', route104: 'route29', route105: 'mine', route106: 'route29', route111: 'route', route121: 'route29',
    route131: 'eterna', route132: 'mine', route133: 'mine', route134: 'route29'
  },
  // used instead of zones at night (ADVW.night(): 20:00 to 06:00)
  night: { route1: 'route201-night', route5: 'route201-night', route7: 'route201-night' },
  // indoors: the room's kind (room id ends in -center, -mart or -gym); other rooms keep the town's track
  rooms: { center: 'center', mart: 'mart', gym: 'gym', cave: 'mine' },   // the Route 4 cave plays the mine track (it is route4's own zone track too)
  battle: { wild: 'wild-battle', trainer: 'trainer-battle', leader: 'gym-battle', winWild: 'victory-wild', winTrainer: 'victory-trainer', legendary: 'legendary-battle' }
};
