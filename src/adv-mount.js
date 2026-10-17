// Flight and riding feel (docs/TRAVEL.md): momentum, wide turns and a timing meter instead of walking faster.
// The meter: two bars close in from both sides onto an icon; Space (A on a pad) as they meet. Flying, a good flap lifts you, and height is speed (you glide down,
// trading it away; touching the ground lands you). Riding, a good buck adds a burst that decays, chained hits keep a gallop up, a miss loses pace; the same press
// hops a one-tile gap at speed, and against a rock face up to 3 levels high a mount that knows Bouldering Riding climbs it (2 good presses plus 1 per level).
'use strict';
const ADVMT = {
  PERIOD: 1.05, WIN: 0.2, PERF: 0.07,   // s for the bars to meet; the press window either side of the meeting, and the perfect part of it
  MAXA: 220, SINK: 9,   // flight: highest altitude (world px), glide sink px/s
  ICON: { fly: 'assets/items/prettywing.png', ride: 'assets/items/quickclaw.png' },

  snd(k, o) { if (typeof ADVMTS !== 'undefined') ADVMTS.play(k, o); },   // real ripped SFX only, picked in src/adv-mount-sfx.js
  wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; },
  // how high a flier is drawn for altitude a: it rises less than it climbs, so a high flier stays on screen
  // the world's zoom tier at altitude a for the player's pick zm: one tier further out every 60 px of height, never below 1 (whole tiers only, so pixels stay square)
  zoomFor(a, zm) { return Math.max(1, zm - Math.floor(a / 60)); },
  vis(a) { return Math.round(Math.min(a, 30) + Math.max(0, a - 30) * 0.1); },   // the ground zooming out (zoomFor) shows the rest of the height
  // one meter tick: '' (nothing), 'perfect', 'good' or 'miss'. A press restarts the bars; letting them pass restarts them too.
  meter(s, dt, hit) {
    const m = s.mt || (s.mt = { t: 0, res: '', rt: 9 }); m.t += dt; m.rt += dt;
    if (hit) { const d = Math.abs(m.t - this.PERIOD); m.res = d <= this.PERF ? 'perfect' : d <= this.WIN ? 'good' : 'miss'; m.rt = 0; m.t = 0; this.snd(m.res); return m.res; }
    if (m.t > this.PERIOD + this.WIN) m.t = 0;
    return '';
  },
  start(s, kind) {   // called on mounting
    const v = DIR_VEC[s.p.face] || [0, 1], hd = Math.atan2(v[1], v[0]); s.mt = null;
    if (kind === 'fly') { s.fly = { hd, v: 150, vz: 110, held: 0 }; this.snd('takeoff'); }
    else s.ride = { hd, v: 0, boost: 0, climb: 0 };
  },
  steer(o, mx, my, ml, w, dt) {   // turn heading o.hd toward the stick at w rad/s; returns the angle still to turn
    if (ml < 0.2) return 0;
    const d = this.wrap(Math.atan2(my, mx) - o.hd); o.hd += clamp(d, -w * dt, w * dt); return d;
  },

  // ---------- flight ----------
  flyStep(s, dt, mx, my, ml, hit) {
    const p = s.p, F = s.fly || (this.start(s, 'fly'), s.fly); if (typeof ADVMTS !== 'undefined') ADVMTS.step(s, dt);
    if (!s.landing) {
      const r = this.meter(s, dt, hit);
      if (r === 'perfect') F.vz += 120; else if (r === 'good') F.vz += 70; else if (r === 'miss') F.vz -= 25;
      if (r === 'perfect' || r === 'good') this.snd('flap', { perfect: r === 'perfect' });
      F.vz *= Math.exp(-3 * dt); s.alt = clamp(s.alt + (F.vz - this.SINK) * dt, 0, this.MAXA);
    } else s.alt = Math.max(0, s.alt - 140 * dt);
    const d = this.steer(F, mx, my, ml, 3.2 - 1.9 * clamp((F.v - 130) / 440, 0, 1), dt), brake = ml >= 0.2 && Math.abs(d) > 2.2;
    const vt = s.landing ? 80 : (130 + s.alt * 2) * (brake ? 0.55 : 1);
    F.v += (vt - F.v) * Math.min(1, dt * 0.8);
    const x0 = p.x, y0 = p.y; s.flyMove(Math.cos(F.hd) * F.v * dt, Math.sin(F.hd) * F.v * dt);
    const m = Math.hypot(p.x - x0, p.y - y0); if (m < F.v * dt * 0.5) F.v *= 0.5;   // the edge of the world
    p.face = dirFromVec(Math.cos(F.hd), Math.sin(F.hd)); p.moving = true; p.walkD += m;
    if (s.alt > 8) F.up = true;   // a fresh take-off cannot land on its first frame
    if (s.alt <= 0 && F.up) {
      if (s.landOK()) { s.alt = 2; F.vz = Math.max(F.vz, 40); s.landing = false; if (!s.msg) s.msg = { s: 'No clear ground below. Flap!', t: 1.5 }; }
      else { this.snd('land'); s.dismount('You landed.'); }
    }
  },

  // ---------- riding ----------
  rideStep(s, dt, mx, my, ml, hit, base) {
    const p = s.p, R = s.ride || (this.start(s, 'ride'), s.ride), T = ADV.Tp(p.x); if (typeof ADVMTS !== 'undefined') ADVMTS.step(s, dt);
    if (p.hop) { R.climb = 0; return; }
    const moving = ml >= 0.2 || R.v > 20, r = moving ? this.meter(s, dt, hit) : '';
    const ahead = this.ahead(s, R), want = ml >= 0.2 ? Math.atan2(my, mx) : R.hd;
    if (r && r !== 'miss' && ahead.gap && R.v > base * 0.75) { this.snd('leap'); this.leap(p, ahead.gap, T); R.boost = Math.max(R.boost, 0.2); return; }
    R.wall = !!(ahead.wall && s.canClimb());
    if (R.wall) {   // pushing into a rock face: good presses climb it, a miss slips you back to the start
      R.need = 2 + ahead.wall[2] - p.lv;
      if (r === 'miss') { R.climb = 0; ADV.move(p, -Math.cos(R.hd) * 10, -Math.sin(R.hd) * 10); }
      else if (r) { R.climb++; this.snd('climb'); if (R.climb >= R.need) { R.climb = 0; this.snd('top'); this.leap(p, ahead.wall, T, 0.4 + 0.15 * (R.need - 2)); return; } }
    } else R.climb = 0;
    if (r && r !== 'miss' && !R.wall) this.snd('buck');
    if (r === 'perfect') R.boost = Math.min(0.7, R.boost + 0.35); else if (r === 'good') R.boost = Math.min(0.7, R.boost + 0.2); else if (r === 'miss') { R.v *= 0.7; R.boost = 0; }
    R.boost = Math.max(0, R.boost - 0.22 * dt);
    if (ml >= 0.2 && R.v < 30) R.hd = want;   // from a standstill it simply faces the way you push
    const d = this.steer(R, mx, my, ml, 5 - 2.8 * clamp(R.v / (base * 1.4), 0, 1), dt);
    const vt = ml < 0.2 ? 0 : base * (0.65 + R.boost) * ml * (Math.abs(d) > 2.2 ? 0.4 : 1);
    R.v += (vt - R.v) * Math.min(1, dt * (vt > R.v ? 1.6 : 3.2));
    const x0 = p.x, y0 = p.y; ADV.move(p, Math.cos(R.hd) * R.v * dt, Math.sin(R.hd) * R.v * dt);
    const m = Math.hypot(p.x - x0, p.y - y0); if (!p.hop && R.v * dt > 0.5 && m < R.v * dt * 0.5) R.v = Math.max(0, m / dt);   // ran into something
    if (m > 0.01) { p.face = dirFromVec(Math.cos(R.hd), Math.sin(R.hd)); p.moving = true; p.walkD += m; }
  },
  // the cell straight ahead along the heading's main axis: wall = a rock face 1 to 3 levels up (with ground to stand on); gap = a cell you cannot enter with the same level open beyond it
  ahead(s, R) {
    const p = s.p, T = ADV.Tp(p.x), c = Math.floor(p.x / T), r = Math.floor(p.y / T), cx = Math.cos(R.hd), cy = Math.sin(R.hd);
    const [dx, dy] = Math.abs(cx) > Math.abs(cy) ? [Math.sign(cx), 0] : [0, Math.sign(cy)], near = (dx ? (dx > 0 ? (c + 1) * T - p.x : p.x - c * T) : (dy > 0 ? (r + 1) * T - p.y : p.y - r * T)) < p.r + 10;
    if (!near) return {};
    const c1 = c + dx, r1 = r + dy, c2 = c + 2 * dx, r2 = r + 2 * dy, h0 = ADV.h(c, r), h1 = ADV.h(c1, r1), lv = p.lv;
    const open = (cc, rr, l) => ADV.h(cc, rr) === l && !ADV.isWater(cc, rr) && !ADV.STAIR[ADV.kind(cc, rr)] && !ADV.blocked((cc + 0.5) * T, (rr + 0.5) * T, l * T, 9);
    if (h0 === lv && h1 > lv && h1 - lv <= 3 && !ADV.STAIR[ADV.kind(c1, r1)] && open(c1, r1, h1)) return { wall: [c1, r1, h1] };
    if (!ADV.entryOK(c1, r1, dx, dy, lv, false) && h1 <= lv && open(c2, r2, lv)) return { gap: [c2, r2, lv] };
    return {};
  },
  leap(p, [c, r, lv], T, dur = 0.55) { p.hop = { t: 0, dur, x0: p.x, y0: p.y, z0: p.z, x1: (c + 0.5) * T, y1: (r + 0.5) * T, z1: lv * T, lv1: lv }; },

  // ---------- the meter on screen ----------
  // It floats just above the rider so you never look away from the flight: the icon in a ring, a marker sliding in from each side that meets the ring when the press is due.
  // Clean like the menus (smooth shapes, the menu font); only the item icon is pixel art.
  hud(s) {
    const k = s.mount === 'fly' ? 'fly' : s.mount === 'ride' || s.mount === 'lent' ? 'ride' : ''; if (!k || s.inB || s.uis.length || s.dlg || s.mode !== 'walk') return;
    if (k === 'ride' && !(s.ride && (s.ride.v > 20 || s.ride.wall))) return;
    const p = s.p, z = ADVR.sc() / DPR, lift = s.seatH ? s.seatH : k === 'fly' ? this.vis(s.alt) + 16 : 16,   // seatH: the rider's seat as drawn (adv-scene.js drawPlayer)
      m = s.mt || { t: 0, rt: 9, res: '' }, R = 18, D = 70;
    const cx = Math.round(VW / 2 + (p.x - s.cam.x) * z), cy = Math.round(VH / 2 + (p.y - p.z - lift - s.cam.y) * z - 52 * z - R - 8), near = Math.abs(m.t - this.PERIOD) <= this.WIN;   // over the rider's head
    const flash = m.rt < 0.25 && m.res !== 'miss' && m.res, ring = flash ? '#ffffff' : near ? '#7be07b' : '#ffde3b', f = m.t / this.PERIOD;
    ctx.save(); ctx.globalAlpha = 0.92;
    rrect(cx - R - D - 8, cy - 3, 2 * (R + D + 8), 6, 3, '#0b1020aa', null, 0);   // the track
    ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, 6.2832); ctx.fillStyle = ring; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fillStyle = near ? '#22344f' : '#0b1020'; ctx.fill();
    const pos = f <= 1 ? R + 3 + D * (1 - f) : R + 3 - (m.t - this.PERIOD) / this.WIN * R * 0.6, col = near ? '#ffffff' : '#ffde3b';
    for (const sx of [-1, 1]) rrect(cx + sx * pos - (sx < 0 ? 5 : 0), cy - 8, 5, 16, 2.5, col, '#0b1020', 1.5);
    ctx.restore();
    const im = img(this.ICON[k]); if (im) { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 8, 8, 16, 16, cx - 16, cy - 16, 32, 32); ctx.imageSmoothingEnabled = sm; }   // the middle of the 32 px icon
    if (m.rt < 0.6 && m.res) text(m.res === 'perfect' ? 'Perfect!' : m.res === 'good' ? 'Good' : 'Miss', cx, cy - R - 12, 13, m.res === 'miss' ? '#ff6b6b' : m.res === 'perfect' ? '#ffffff' : '#7be07b', 'center');
    else if (k === 'ride' && s.ride.climb) text(`Climb ${s.ride.climb} / ${s.ride.need}`, cx, cy - R - 12, 12, '#ffffff', 'center');
  },
};
