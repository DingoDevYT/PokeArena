// Sounds for flying and riding. Real game rips only: assets/sfx (Pokemon Mystery Dungeon) and assets/sfx-move via AUDIO.gen.
// Everything goes through AUDIO.play / AUDIO.gen, so AUDIO.vol.sfx (the SFX Volume setting) scales it and ?mute (vol 0) silences it.
const ADVMTS = {
  // kind -> [file, volume, rate]; a list means one is picked at random
  K: {
    flap: ['assets/sfx/DUN_Wing_Attack.ogg', 0.55, 1],
    flapPerfect: ['assets/sfx/DUN_Wing_Attack_2.ogg', 0.8, 1.05],
    glide: ['assets/sfx/DUN_Wing_Attack.ogg', 0.2, 0.85],
    gallop: ['assets/sfx/DUN_Pound.ogg', 0.3, 1],
    buck: ['assets/sfx/DUN_Stomp.ogg', 0.7, 0.9],
    climb: ['assets/sfx/DUN_Rock_Climb.ogg', 0.5, 1.5],
    top: ['assets/sfx/DUN_Rock_Smash.ogg', 0.7, 0.9],
    leap: ['assets/sfx/_UNK_DUN_Heave_Up.ogg', 0.6, 1],
    takeoff: ['assets/sfx/DUN_Tailwind_2.ogg', 0.6, 1.1],
    land: ['assets/sfx/DUN_Stomp.ogg', 0.65, 0.75],
    perfect: ['assets/sfx/_UNK_DUN_Twinkle.ogg', 0.5, 1],
  },
  t: 0, g: 0, last: null,
  play(kind, opts) {
    try {
      if (typeof AUDIO === 'undefined' || !(AUDIO.vol && AUDIO.vol.sfx > 0)) return;
      if (kind === 'good') return void AUDIO.gen('uiBlip', 0.5);   // same real rip uiBlip(880) uses
      if (kind === 'miss') return void AUDIO.gen('hitWeak', 0.45);  // same real rip uiBlip(300) uses
      const k = kind === 'flap' && opts && opts.perfect ? 'flapPerfect' : kind, e = this.K[k];
      if (!e) return;
      const j = k === 'glide' || k === 'gallop' ? 0.12 : 0.05;
      AUDIO.play(e[0], e[1], e[2] * (1 + (Math.random() * 2 - 1) * j));
    } catch (err) { /* a missing sound must never break the game */ }
  },
  // Called every frame while mounted: soft wing beats while gliding, hoof beats that follow speed.
  step(scene, dt) {
    try {
      if (!scene || !scene.mount || !(dt > 0)) { this.t = this.g = 0; this.last = null; return; }
      if (scene.mount !== this.last) { this.last = scene.mount; this.t = this.g = 0; }
      if (scene.mount === 'fly' && scene.fly && !scene.landing) {
        const maxA = (typeof ADVMT !== 'undefined' && ADVMT.MAXA) || 100, low = 1 - Math.min(1, Math.max(0, (scene.alt || 0) / maxA));
        this.t += dt;
        if (this.t >= 2.5 - low) { this.t = 0; this.play('glide'); }   // 2.5 s high up, 1.5 s near the ground
      } else if (scene.mount === 'ride' && scene.ride) {
        const v = scene.ride.v || 0;
        if (v <= 20 || scene.ride.climb || scene.ride.wall) { this.g = 0; return; }   // stopped or climbing: silent
        this.g += dt;
        const gap = Math.min(0.45, Math.max(0.17, 40 / v));
        if (this.g >= gap) { this.g = 0; this.play('gallop'); }
      }
    } catch (err) { /* never throw from the frame loop */ }
  },
};
