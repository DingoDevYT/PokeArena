// Adventure world map: the baked image (tools/adv-worldmap.mjs, 1 px per cell) with pan, integer zoom, town names, you, other players and up to 5 waypoints (save.waypoints = [{ x, y, name }], world px).
// Also the overworld HUD it feeds, drawn in screen space from one hook in AdventureScene.draw: waypoint pins and edge arrows, the clock / weather / place box (top right) and the party column (left edge).
// The screen is { update, draw } on AdventureScene's stack like the ones in adv-ui.js; the M key is ADVMAP.hit(sc) in the scene's walk input, the pause menu has a Map row.
'use strict';
const ADVMAP = {
  FILE: 'assets/adv/worldmap.png', MAX: 5, ZS: [1, 2, 3, 4, 6, 8], _k: false,   // ZS: device px per cell
  DAYS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  WX: { '': 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', fog: 'Fog', snow: 'Snow', sand: 'Sandstorm' },
  // M in the walk input: opens the map on the key's rising edge (the map's own update keeps _k, so a held M never reopens it)
  hit(sc) { const k = !!KEYS.KeyM, h = k && !this._k; this._k = k; if (h) sc.open(this.ui(sc)); return h; },

  // ---------- pieces ----------
  T: () => ADV.T,   // world px per cell outdoors
  wps: sc => sc.save.waypoints || (sc.save.waypoints = []),
  // smooth shapes in the menus' look: a teardrop pin whose tip stands on (x, y), k = its size unit (the pin is 12 k tall), and an arrow
  pin(x, y, k) {
    const R = 4.5 * k, cy = y - 8 * k, a = Math.acos(R / (8 * k)), lw = Math.max(1.5, k * 0.7);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, cy, R, Math.PI / 2 - a, Math.PI / 2 + a, true); ctx.closePath();
    ctx.fillStyle = '#ff3b30'; ctx.fill(); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.strokeStyle = '#101428'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, cy, R * 0.42, 0, 6.2832); ctx.fillStyle = '#fff4c8'; ctx.fill();
  },
  sq(x, y, n, c, edge = '#101428') { ctx.fillStyle = edge; ctx.fillRect(Math.round(x - n / 2 - 1), Math.round(y - n / 2 - 1), n + 2, n + 2); ctx.fillStyle = c; ctx.fillRect(Math.round(x - n / 2), Math.round(y - n / 2), n, n); },
  // a filled triangle, tip at (x, y), pointing along (ux, uy), u = its size unit
  arrow(x, y, ux, uy, u, col) {
    const L = 7 * u, hw = 4 * u, bx = x - ux * L, by = y - uy * L;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx - uy * hw, by + ux * hw); ctx.lineTo(bx + uy * hw, by - ux * hw); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(2, u * 0.7); ctx.lineJoin = 'round'; ctx.strokeStyle = '#101428'; ctx.stroke();
  },
  // a small label panel centred on (x, y)
  tag(s, x, y, col = '#fff') { const f = this.fs(), w = Math.round(this.tw(s, f) + f * 1.4), h = Math.round(f * 2); this.panel(Math.round(x - w / 2), Math.round(y - h / 2), w, h, Math.round(f * 0.6)); text(s, x, y, f, col, 'center', null); return w; },
  // "Route 4", "Dunereach": the zone ids are lower case with no spaces, so a town zone takes its town's name
  zoneName(id) {
    if (!id) return ''; if (id === 'wild') return 'Wild lands';
    const m = /^route(\d+)$/.exec(id); if (m) return 'Route ' + m[1];
    const t = Object.values(window.ADV_WORLD?.towns || {}).find(t => t.name.toLowerCase().replace(/[^a-z]/g, '') === id);
    return t ? t.name : id[0].toUpperCase() + id.slice(1);
  },
  placeAt(x, y) { const t = ADVS.inTown(x, y); return t ? ADVS.town(t).name : this.zoneName(ADVW.zone(x, y)); },
  // where the map puts you: a cave leaves you at its mouth in the world, like the save does
  here(sc) { const r = sc.room && !sc.room.d.bld ? sc.room : null; return r ? { x: r.door.x, y: r.door.y + 30 } : sc.p; },
  tiles: (sc, x, y) => { const p = ADVMAP.here(sc); return Math.round(Math.hypot(x - p.x, y - p.y) / ADV.T); },
  addWp(sc, x, y) {
    const w = this.wps(sc); if (w.length >= this.MAX) return false;
    w.push({ x: Math.round(x), y: Math.round(y), name: this.placeAt(x, y) || 'Waypoint' }); sc.persist(); return true;
  },
  // is the cell deep sea (the corner colour of the baked image)? read once from the image's pixels
  sea(im, c, r) {
    if (!this.px) { const k = document.createElement('canvas'); k.width = im.naturalWidth; k.height = im.naturalHeight; const g = k.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); this.px = g.getImageData(0, 0, k.width, k.height); }
    const d = this.px.data, w = this.px.width; if (c < 0 || r < 0 || c >= w || r >= this.px.height) return true;
    const i = (r * w + c) * 4; return d[i] === d[0] && d[i + 1] === d[1] && d[i + 2] === d[2];
  },
  nearest(sc, x, y) { let b = -1, bd = 1e18; this.wps(sc).forEach((w, i) => { const d = Math.hypot(w.x - x, w.y - y); if (d < bd) { bd = d; b = i; } }); return b; },

  // ---------- the screen ----------
  ui(sc) {
    const A = this, st = { zi: 2, cx: 0, cy: 0, ms: false, mm: MOUSE.moved, drag: null, kx: false, note: '', nt: 0 }, me = A.here(sc);
    st.cx = me.x / A.T(); st.cy = me.y / A.T();
    const sz = () => { const im = img(A.FILE); return im ? [im.naturalWidth, im.naturalHeight] : [1, 1]; };
    const z = () => A.ZS[st.zi] / DPR, snap = v => Math.round(v * DPR) / DPR;
    const scr = (c, r) => [snap(VW / 2 + (c - st.cx) * z()), snap(VH / 2 + (r - st.cy) * z())];
    const cellAt = (x, y) => [st.cx + (x - VW / 2) / z(), st.cy + (y - VH / 2) / z()];
    const cur = () => (st.ms ? cellAt(MOUSE.x, MOUSE.y) : [st.cx, st.cy]).map(Math.floor);   // the cell under the mouse, else the screen centre
    const say = s => { st.note = s; st.nt = 3; };
    const zoom = d => {
      const zi = clamp(st.zi + d, 0, A.ZS.length - 1); if (zi === st.zi) return;
      const [c, r] = st.ms ? cellAt(MOUSE.x, MOUSE.y) : [st.cx, st.cy]; st.zi = zi;
      if (st.ms) { st.cx = c - (MOUSE.x - VW / 2) / z(); st.cy = r - (MOUSE.y - VH / 2) / z(); }
      uiBlip(700, 0.03);
    };
    const toggle = (c, r) => {
      const T = A.T(), x = (c + 0.5) * T, y = (r + 0.5) * T, w = A.wps(sc), i = A.nearest(sc, x, y);
      if (i >= 0 && Math.hypot(w[i].x - x, w[i].y - y) < 10 / z() * T) { w.splice(i, 1); sc.persist(); uiBlip(500, 0.04); return say('Waypoint removed.'); }
      if (A.addWp(sc, x, y)) { uiBlip(880, 0.05); say('Waypoint set.'); } else say('Only ' + A.MAX + ' waypoints. Remove one with X.');
    };
    const drop = () => { const [c, r] = cur(), T = A.T(), i = A.nearest(sc, (c + 0.5) * T, (r + 0.5) * T); if (i < 0) return say('No waypoints to remove.'); A.wps(sc).splice(i, 1); sc.persist(); uiBlip(500, 0.04); say('Waypoint removed.'); };
    return {
      st,
      update(dt) {
        const [W, H] = sz(), mk = !!KEYS.KeyM, xk = !!KEYS.KeyX, xh = xk && !st.kx; st.kx = xk; const mh = mk && !A._k; A._k = mk;
        if (MOUSE.moved !== st.mm) { st.mm = MOUSE.moved; st.ms = true; }
        if (st.nt > 0) st.nt -= dt;
        let mx = (INPUT.held('RIGHT') ? 1 : 0) - (INPUT.held('LEFT') ? 1 : 0), my = (INPUT.held('DOWN') ? 1 : 0) - (INPUT.held('UP') ? 1 : 0);
        if (!mx) mx = INPUT.mx; if (!my) my = INPUT.my;
        if (mx || my) { st.ms = false; st.cx += mx * 420 / z() * dt; st.cy += my * 420 / z() * dt; }
        if (INPUT.hit('TABR')) zoom(1); if (INPUT.hit('TABL')) zoom(-1);
        if (MOUSE.hit) { st.ms = true; st.drag = { x: MOUSE.x, y: MOUSE.y, cx: st.cx, cy: st.cy, mv: false }; }
        if (st.drag) {
          const d = st.drag;
          if (MOUSE.down) { const dx = MOUSE.x - d.x, dy = MOUSE.y - d.y; if (d.mv || Math.hypot(dx, dy) > 5) { d.mv = true; st.cx = d.cx - dx / z(); st.cy = d.cy - dy / z(); } }
          else { st.drag = null; if (!d.mv) toggle(...cur()); }
        }
        st.cx = clamp(st.cx, 0, W); st.cy = clamp(st.cy, 0, H);
        if (MOUSE.hitR) { st.ms = true; drop(); } else if (xh || INPUT.hit('X')) drop();
        else if (okHit()) toggle(...cur());
        else if (mh || INPUT.hit('START') || (backHit() && !MOUSE.downR)) sc.close();
      },
      draw() {
        const s = S(), { X, Y, L } = layout(), k = z(), im = img(A.FILE), T = A.T(), me = A.here(sc), w = A.wps(sc), N = sc.net && sc.net.N;
        ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, VW, VH);
        hot(0, 0, VW, VH, { wheel: d => zoom(d < 0 ? 1 : -1) });
        if (!im) text('LOADING', VW / 2, VH / 2, 28, '#fff', 'center');
        else { const [x0, y0] = scr(0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, x0, y0, im.naturalWidth * k, im.naturalHeight * k); }
        const on = (x, y, m = 40) => x > -m && y > -m && x < VW + m && y < VH + m, pk = Math.max(2, Math.round(VH / 300));
        for (const [id, t] of Object.entries(window.ADV_WORLD?.towns || {})) {
          const [x, y] = scr(t.center.x / T, t.center.y / T); if (!on(x, y, 80)) continue;
          const g = id[0] === 'G', l = id[0] === 'L';
          A.sq(x, y, g ? 9 : 7, g ? '#ffde3b' : l ? '#7fd0e8' : '#fff'); text(t.name, x, y - 13, 11, g ? '#ffde3b' : l ? '#7fd0e8' : '#fff', 'center', '#101428', 'Silkscreen');
        }
        if (N && !sc.room) for (const v of N.vis.values()) { const [x, y] = scr(v.x / T, v.y / T); if (!on(x, y)) continue; A.sq(x, y, 5, '#7be07b'); if (st.zi >= 2) text(N.roster.get(v.pid)?.name || '', x, y - 9, 11, '#7be07b', 'center', '#101428', 'Silkscreen'); }
        for (const p of w) { const [x, y] = scr(p.x / T, p.y / T); if (on(x, y)) { A.pin(x, y, pk); text(p.name, x, y - 12 * pk - 7, 11, '#fff', 'center', '#101428', 'Silkscreen'); } }
        { const [x, y] = scr(me.x / T, me.y / T), q = Math.floor(performance.now() / 350) % 2, v = DIR_VEC[sc.p.face] || [0, 1], n = Math.hypot(v[0], v[1]) || 1;
          if (on(x, y)) { for (let i = 1; i <= 3; i++) A.sq(x + v[0] / n * (6 + i * 4), y + v[1] / n * (6 + i * 4), 6 - i, '#fff'); A.sq(x, y, 7, q ? '#ffde3b' : '#fff'); } }
        { const [c, r] = cur(), [x, y] = scr(c + 0.5, r + 0.5), a = (o, ww, hh) => { ctx.fillStyle = '#101428'; ctx.fillRect(Math.round(x + o[0] - 1), Math.round(y + o[1] - 1), ww + 2, hh + 2); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x + o[0]), Math.round(y + o[1]), ww, hh); };
          a([-12, -1], 7, 2); a([5, -1], 7, 2); a([-1, -12], 2, 7); a([-1, 5], 2, 7); }
        // the title, the place under the cursor, the waypoint list, the hint
        ctx.fillStyle = '#0b1020'; ctx.fillRect(0, VH - 44, VW, 44);
        text('WORLD MAP', X(660), Y(40), L(36), '#ffde3b', 'center', '#1a2a6c');
        const [cc, cr] = cur(), sea = !!im && A.sea(im, cc, cr), zn = sea ? '' : (A.placeAt((cc + 0.5) * T, (cr + 0.5) * T) || '');
        const sub = `${sea ? '' : A.tiles(sc, (cc + 0.5) * T, (cr + 0.5) * T) + ' tiles from you   '}Zoom x${A.ZS[st.zi]}   Waypoints ${w.length}/${A.MAX}`; ctx.font = '11px Silkscreen';
        const bw = Math.round(Math.max(210, L(250), ctx.measureText(sub).width + 28)), bh = Math.round(Math.max(54, L(70))), bx = Math.round(12 * Math.max(s, 0.7)), by = VH - bh - Math.round(Math.max(52, 60 * s));
        rrect(bx, by, bw, bh, 10, '#0b1020ee', '#ffffff40', 2);
        text(zn || 'Open sea', bx + 14, by + bh * 0.36, Math.max(14, L(21)), '#fff', 'left', null);
        text(sub, bx + 14, by + bh * 0.74, 11, '#9aa6c0', 'left', null, 'Silkscreen');
        if (w.length) {
          const rw = Math.round(Math.max(220, L(260))), rh = Math.round(Math.max(26, L(34))), rx = VW - rw - Math.round(12 * Math.max(s, 0.7)), ry = Math.round(Y(78)), ph = rh * w.length + 12;
          rrect(rx, ry, rw, ph, 10, '#0b1020ee', '#ffffff40', 2);
          w.forEach((p, i) => {
            const yy = ry + 6 + i * rh; hot(rx + 4, yy, rw - 8, rh - 2, { click: () => { st.cx = p.x / T; st.cy = p.y / T; st.ms = false; } });
            A.pin(rx + 18, yy + rh - 4, 2); text(p.name, rx + 34, yy + rh / 2, 13, '#fff', 'left', null); text(A.tiles(sc, p.x, p.y) + ' tiles', rx + rw - 12, yy + rh / 2, 11, '#ffde3b', 'right', null, 'Silkscreen');
          });
        }
        if (st.nt > 0) text(st.note, VW / 2, by - 14, Math.max(14, L(17)), '#9f9', 'center', '#101428');
        hint(INPUT.usingPad ? 'stick pan   LB/RB zoom   A waypoint   X remove   B back' : 'WASD or drag pan   wheel zoom   Enter or click waypoint   X remove   M or Esc back');
        backButton(() => sc.close());
      },
    };
  },

  // ---------- the overworld HUD ----------
  // drawn in the menus' own look: ADVUI panels (#0b1020ee fill, #ffffff40 edge, rounded), the default menu font through text(), ADVUI.bar / hudChip; only the portraits are pixel art
  hud(sc) {
    img(this.FILE);   // starts the load, so the map opens ready
    if (!sc.ready || sc.uis.length || sc.dlg || (sc.mode !== 'walk' && sc.mode !== 'fish')) return;
    this.pins(sc); this.info(sc); this.party(sc);
  },
  fs: () => clamp(Math.round(VH / 40), 11, 18),   // the HUD's font size
  panel(x, y, w, h, r) { rrect(x, y, w, h, r, '#0b1020ee', '#ffffff40', 2); },
  tw(s, fs) { ctx.font = ADVUI.font(fs); return ctx.measureText(s).width; },
  // a pin where a waypoint stands on screen, else an arrow on the screen edge toward it with the distance in tiles
  pins(sc) {
    const w = this.wps(sc); if (!w.length || sc.room || !ADVR.view) return;
    const z = ADVR.zoom, V = ADVR.view, k = clamp(Math.round(VH / 280), 2, 4), u = clamp(Math.round(VH / 150), 3, 6), mL = 60, m = 28, fs = this.fs();
    for (const p of w) {
      const sx = Math.round((p.x - V.ox) * z), sy = Math.round((p.y - ADV.heightAt(p.x, p.y) - V.oy) * z), n = this.tiles(sc, p.x, p.y), lab = n + (n === 1 ? ' tile' : ' tiles');
      if (sx > mL && sx < VW - m && sy > 14 * k + m && sy < VH - m) { this.pin(sx, sy, k); if (sy < VH - 90) this.tag(lab, sx, sy + fs + 6); continue; }
      const tx = clamp(sx, mL + m, VW - m), ty = clamp(sy, m + 16, Math.abs(sx - VW / 2) < 240 ? VH - 100 : VH - m - 20), tyy = tx > VW - 280 ? Math.max(ty, 100) : ty, l = Math.hypot(sx - tx, sy - ty) || 1, ux = (sx - tx) / l, uy = (sy - ty) / l;
      this.arrow(tx, tyy, ux, uy, u, '#ff3b30');
      const w2 = this.tw(lab, fs) + fs * 1.4, off = 8 * u + Math.abs(ux) * w2 / 2 + Math.abs(uy) * fs + 4;
      this.tag(lab, clamp(tx - ux * off, w2 / 2 + 4, VW - w2 / 2 - 4), clamp(tyy - uy * off, fs, VH - fs));
    }
  },
  // clock and date, weather and place, then the server line: three rows in one panel hugging the top right corner
  info(sc) {
    const p = sc.p, h = ADVW.hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60), pad = v => String(v).padStart(2, '0'), N = sc.net && sc.net.N;
    let date = '';
    if (ADVW.totalHours) {
      const t = ADVW.totalHours(), online = ADVW.clock && ADVW.clockTotal, made = Date.parse((sc.save.made || '') + 'T00:00:00Z'), base = online ? 0 : Number.isFinite(made) ? Math.floor(made / 60000 / 24) : NaN;
      const day = Math.floor(t / 24) - (Number.isFinite(base) ? base : Math.floor(t / 24)) + 1;
      date = Number.isFinite(base) ? this.DAYS[(day - 1) % 7] + ', Day ' + day : this.DAYS[Math.floor(t / 24) % 7];
    }
    const wx = sc.room ? 'Indoors' : this.WX[typeof ADVWX !== 'undefined' ? ADVWX.cur.kind : ''] || 'Clear', place = this.placeAt(p.x, p.y), srv = N && N.online ? `${N.name}  ${N.count()} online` : 'Offline';
    const fs = this.fs(), g = Math.round(fs * 0.6), padX = Math.round(fs * 0.9), padY = Math.round(fs * 0.7), pitch = Math.round(fs * 1.5), gap = Math.round(fs * 1.2), mw = s => this.tw(s, fs), clk = pad(hh) + ':' + pad(mm);
    const w = Math.round(Math.max(mw(clk) + (date ? gap + mw(date) : 0), mw(wx) + (place ? gap + mw(place) : 0), mw(srv)) + 2 * padX), h2 = 3 * pitch + 2 * padY - Math.round(fs * 0.35);
    const x = VW - g - w, y = window.TOUCH?.on ? 70 : g;
    this.panel(x, y, w, h2, Math.round(fs * 0.7));
    const y1 = y + padY + pitch * 0.5 - Math.round(fs * 0.17), y2 = y1 + pitch, y3 = y2 + pitch, t = (s, X, Y, c, al = 'left') => text(s, X, Y, fs, c, al, null);
    t(clk, x + padX, y1, '#ffde3b'); if (date) t(date, x + w - padX, y1, '#fff', 'right');
    t(wx, x + padX, y2, '#7fd0e8'); if (place) t(place, x + w - padX, y2, '#fff', 'right');
    t(srv, x + padX, y3, '#9aa6c0');
  },
  // portrait emotion by state: fainted, a status, low HP, then (the lead) the follower's mood, else Normal
  emo(sc, m, i) {
    const st = m.status, hp = m.hp / ADVP.max(m);
    const list = ADVP.fainted(m) ? ['Pain', 'Teary-Eyed'] : st === 'slp' ? ['Sigh', 'Normal'] : st === 'par' ? ['Dizzy', 'Worried'] : st === 'frz' ? ['Worried', 'Dizzy'] : st ? ['Pain', 'Worried'] : hp < 0.25 ? ['Worried', 'Pain'] : i === sc.leadIdx() ? (sc.f.beh === 'sleep' ? ['Sigh', 'Normal'] : sc.folMood().emo) : ['Normal'];
    const key = DEX.species[toId(m.species)].sprite, P = window.PORTRAITS?.[key], e = ADVF.emotion(list, P);
    return img(P && P[e]) || img(spriteOf(key)?.portrait);
  },
  // click a party slot: that mon takes slot 0 exactly like the party screen's Make lead (a fainted one cannot lead, and a ridden or flown lead is the mount)
  makeLead(sc, i) {
    const P = sc.save.party, m = P[i], say = (s, f) => { sc.msg = { s, t: 2 }; uiBlip(f, 0.05); };
    if (!m || sc.mode !== 'walk' || sc.uis.length || sc.dlg || sc.typing || i === 0) return;
    if (sc.riding()) return say('Get off first.', 300);
    if (ADVP.fainted(m)) return say(ADVP.name(m) + ' has fainted and cannot lead.', 300);
    [P[i], P[0]] = [P[0], P[i]]; sc.refreshLead(); sc.persist(); say(ADVP.name(P[0]) + ' leads the way.', 880);
  },
  // six portraits with a thin HP bar down the left edge (empty slots are dim frames); the lead has a yellow frame, a status is a coloured corner dot; hover shows a slot's name, level and HP in a small panel, click makes it the lead
  party(sc) {
    const sv = sc.save, lead = sc.leadIdx(), fs = this.fs(), nat = sv.party.map((m, i) => this.emo(sc, m, i)).find(Boolean)?.naturalWidth || 40;
    const pz = Math.round(nat * (VH >= 1500 ? 2 : VH >= 800 ? 1 : 0.5)), bh = Math.max(4, Math.round(pz / 7)), gap = Math.max(4, Math.round(pz / 6)), r = Math.max(4, Math.round(pz / 5)), x = Math.round(fs * 0.6);
    const slot = pz + bh + 3 + gap, y0 = Math.round((VH - (6 * slot - gap)) / 2), ph = pz + bh + 3;
    let tip = -1;
    for (let i = 0; i < 6; i++) {
      const y = y0 + i * slot, m = sv.party[i];
      if (!m) { rrect(x, y, pz, ph, r, '#0b102066', '#ffffff18', 1); continue; }
      const dead = ADVP.fainted(m), f = dead ? 0 : m.hp / ADVP.max(m), im = this.emo(sc, m, i), on = i === lead;
      if (sc.mode === 'walk') hot(x, y, pz, ph, { click: () => this.makeLead(sc, i) });
      if (!INPUT.usingPad && MOUSE.x >= x && MOUSE.x <= x + pz && MOUSE.y >= y && MOUSE.y <= y + ph) tip = i;
      rrect(x, y, pz, pz, r, '#0b1020dd');
      if (im) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, pz, pz, r); ctx.clip(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = dead ? 0.35 : 1; ctx.drawImage(im, x, y, pz, pz); ctx.restore(); }
      rrect(x, y, pz, pz, r, on ? '#ffde3b22' : null, on ? '#ffde3b' : '#ffffff26', on ? 3 : 2);
      ADVUI.bar(x, y + pz + 3, pz, bh, f, ADVUI.hpCol(f));
      const dot = dead ? '#666' : m.status && ADVUI.STCOL[m.status] || (m.status ? '#888' : '');
      if (dot) { const dr = Math.max(3, Math.round(pz / 8)); ctx.beginPath(); ctx.arc(x + pz - dr - 2, y + dr + 2, dr, 0, 6.2832); ctx.fillStyle = dot; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#0b1020'; ctx.stroke(); }
    }
    if (tip >= 0) this.tip(sv.party[tip], x + pz + 6, y0 + tip * slot + pz / 2, fs);
  },
  // the hover panel: name, level, HP bar and numbers, a status chip when it has one
  tip(m, x, cy, fs) {
    const dead = ADVP.fainted(m), f = dead ? 0 : m.hp / ADVP.max(m), name = ADVP.name(m), lv = 'Lv ' + m.level, hp = `${Math.max(0, Math.ceil(m.hp))} / ${ADVP.max(m)}`, st = dead ? ['FNT', '#666'] : m.status ? [STATUS_LABEL[m.status] || m.status, ADVUI.STCOL[m.status] || '#888'] : null;
    const padX = Math.round(fs * 0.9), padY = Math.round(fs * 0.7), pitch = Math.round(fs * 1.5), bw = Math.round(fs * 7), gap = Math.round(fs * 1.2), ch = Math.round(fs * 1.5);
    const w = Math.round(Math.max(this.tw(name, fs) + gap + this.tw(lv, fs), bw + gap * 0.6 + this.tw(hp, fs)) + 2 * padX), h = 2 * pitch + 2 * padY - Math.round(fs * 0.35) + (st ? ch + Math.round(fs * 0.3) : 0);
    const y = clamp(Math.round(cy - h / 2), 4, VH - h - 4);
    this.panel(x, y, w, h, Math.round(fs * 0.7));
    const y1 = y + padY + pitch * 0.5 - Math.round(fs * 0.17), y2 = y1 + pitch;
    text(name, x + padX, y1, fs, dead ? '#999' : '#fff', 'left', null); text(lv, x + w - padX, y1, fs, '#ffde3b', 'right', null);
    ADVUI.bar(x + padX, y2 - Math.round(fs * 0.4), bw, Math.round(fs * 0.8), f, ADVUI.hpCol(f)); text(hp, x + w - padX, y2, fs, '#fff', 'right', null);
    if (st) ADVUI.chip(st[0], x + padX, y2 + Math.round(pitch * 0.5), ch, st[1]);
  },
};
