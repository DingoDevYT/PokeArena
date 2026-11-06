// The Elite Four's teams. They are not in the bible's Appendix A, so tools/build-adv-rosters.mjs does not write them: this file adds them to
// window.ADV_ROSTERS after data/adv/rosters.js. Only the 'true' band: the four take challengers with all eight badges. Five each, the ace last.
Object.assign(window.ADV_ROSTERS, {
  fenn: { true: [
    {"species":"froslass","level":47,"moves":["icebeam","shadowball","willowisp","icywind"]},
    {"species":"cloyster","level":47,"moves":["iciclespear","rockblast","aurorabeam","protect"]},
    {"species":"mamoswine","level":48,"moves":["earthquake","iciclecrash","ancientpower","icefang"]},
    {"species":"walrein","level":48,"moves":["surf","blizzard","bodyslam","icefang"]},
    {"species":"lapras","level":49,"moves":["icebeam","hydropump","thunderbolt","sing"],"ace":true}
  ] },
  bram: { true: [
    {"species":"hitmontop","level":48,"moves":["closecombat","triplekick","suckerpunch","rapidspin"]},
    {"species":"hariyama","level":48,"moves":["closecombat","knockoff","heavyslam","fakeout"]},
    {"species":"lucario","level":49,"moves":["aurasphere","flashcannon","dragonpulse","extremespeed"]},
    {"species":"machamp","level":49,"moves":["dynamicpunch","knockoff","stoneedge","bulletpunch"]},
    {"species":"conkeldurr","level":50,"moves":["hammerarm","stoneedge","machpunch","knockoff"],"ace":true}
  ] },
  odile: { true: [
    {"species":"xatu","level":49,"moves":["psychic","airslash","shadowball","confuseray"]},
    {"species":"slowking","level":49,"moves":["psychic","scald","flamethrower","icebeam"]},
    {"species":"hatterene","level":50,"moves":["psychic","dazzlinggleam","mysticalfire","shadowball"]},
    {"species":"espeon","level":50,"moves":["psychic","shadowball","dazzlinggleam","swift"]},
    {"species":"alakazam","level":51,"moves":["psychic","shadowball","focusblast","energyball"],"ace":true}
  ] },
  hale: { true: [
    {"species":"flygon","level":50,"moves":["earthquake","dragonclaw","crunch","firepunch"]},
    {"species":"kingdra","level":50,"moves":["dragonpulse","hydropump","icebeam","flashcannon"]},
    {"species":"goodra","level":51,"moves":["dragonpulse","sludgebomb","thunderbolt","fireblast"]},
    {"species":"haxorus","level":51,"moves":["dragonclaw","earthquake","poisonjab","xscissor"]},
    {"species":"dragonite","level":52,"moves":["outrage","extremespeed","earthquake","firepunch"],"ace":true}
  ] },
});
