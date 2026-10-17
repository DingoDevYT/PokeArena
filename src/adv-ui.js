// Adventure screens (W1c): start / new game, pause menu, party, bag, PC box, level-up pages, battle item wheel.
// A screen is { update(dt), draw(), enter?(), exit?() } on AdventureScene's stack (sc.open / sc.close); the world is frozen while one is open.
// Design space is 1320 x 800 through layout() (X, Y, L), like the profile and lobby screens.
'use strict';
const ADVUI = {
  // ---------- pieces ----------
  hpCol: f => f > 0.5 ? '#4cd964' : f > 0.2 ? '#ffcc00' : '#ff3b30',
  STCOL: { par: '#d4b020', psn: '#a33ea1', brn: '#ee8130', slp: '#7d8794', frz: '#5fb8d6' },
  bar(x, y, w, h, f, col) { rrect(x, y, w, h, h / 2, '#00000099'); if (f > 0) rrect(x + 1, y + 1, Math.max(h - 2, (w - 2) * clamp(f, 0, 1)), h - 2, (h - 2) / 2, col); },
  chip(label, x, y, h, col) { return hudChip(x, y, label, col, h); },
  // keeps the highlighted row inside the window of rows
  scroll(st, n, rows) { st.sel = clamp(st.sel, 0, Math.max(0, n - 1)); st.off = clamp(st.off | 0, 0, Math.max(0, n - rows)); if (st.sel < st.off) st.off = st.sel; if (st.sel >= st.off + rows) st.off = st.sel - rows + 1; },
  nav(st, n, dir = INPUT.menu) { if (dir === 'up' || dir === 'down') { st.sel = clamp(st.sel + (dir === 'down' ? 1 : -1), 0, Math.max(0, n - 1)); uiBlip(600, 0.03); } },
  // ---------- dialogue chrome: the talk box, question box and notices share one set of house panels ----------
  // sizes follow the window height and margins follow the font, so a small window gets a smaller (never cramped) box
  dlg() {
    const fs = clamp(Math.round(VH / 28), 15, 34), g = Math.round(fs * 0.7), padX = Math.round(fs * 1.05), padY = Math.round(fs * 0.7), pitch = Math.round(fs * 1.5);
    const w = Math.min(VW - 2 * g, Math.max(480, Math.round(fs * 46))), h = 2 * pitch + 2 * padY;
    return { fs, g, padX, padY, pitch, w, h, x: Math.round((VW - w) / 2), y: VH - g - h, tw: w - 2 * padX - Math.round(fs * 0.9), r: Math.round(fs * 0.7) };
  },
  font: fs => fs + 'px Bungee, "Arial Black", sans-serif',
  // text -> boxes of two lines that fit the talk box
  pages(s) {
    const d = this.dlg(), lines = []; ctx.font = this.font(d.fs);
    let cur = ''; for (const wd of String(s).split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > d.tw && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    const out = []; for (let i = 0; i < lines.length; i += 2) { const pg = lines.slice(i, i + 2); pg.chars = pg.join('').length; out.push(pg); }
    return out.length ? out : [Object.assign([''], { chars: 0 })];
  },
  // one box of text, typed out to vis characters; who = the speaker's name tab; next = the bouncing arrow
  say(lines, vis, who, next) {
    const d = this.dlg(), { fs, x, y, w, h, padX, padY, pitch, r } = d, fill = '#0b1020ee', edge = '#ffffff40';
    if (who) {
      const tf = Math.round(fs * 0.62); ctx.font = this.font(tf);
      const tw = Math.round(ctx.measureText(who.toUpperCase()).width + padX * 1.4), vh = Math.round(tf * 2.1), tx = x + Math.round(padX * 0.55);
      rrect(tx, y - vh, tw, vh + r * 2, Math.round(r * 0.8), fill, edge, 2); text(who.toUpperCase(), tx + tw / 2, y - Math.round(vh / 2) + 1, tf, '#ffde3b', 'center', null);
    }
    rrect(x, y, w, h, r, fill, edge, 2);
    let k = vis; lines.forEach((ln, i) => { text(ln.slice(0, Math.max(0, k)), x + padX, y + padY + pitch * (i + 0.5), fs, '#fff', 'left', null); k -= ln.length; });
    if (next) { const a = Math.round(fs * 0.34), bob = Math.round(Math.abs(Math.sin(performance.now() / 260)) * fs * 0.18), ax = x + w - padX, ay = y + h - padY - a * 0.4 + bob; ctx.beginPath(); ctx.moveTo(ax - a, ay - a * 0.8); ctx.lineTo(ax + a, ay - a * 0.8); ctx.lineTo(ax, ay + a * 0.6); ctx.closePath(); ctx.fillStyle = '#ffde3b'; ctx.fill(); }
  },
  // a question in the talk box with its answers in a panel above the box's right end; items = [{ label, act }], st = { sel }
  choice(line, items, st) {
    const d = this.dlg(), { fs, x, y, w, g, padX, r } = d; this.say(this.pages(line)[0], 1e4);
    ctx.font = this.font(fs);
    const rowH = Math.round(fs * 1.9), inner = Math.round(fs * 0.45), pw = Math.round(Math.max(fs * 7, ...items.map(i => ctx.measureText(i.label).width + padX * 2)) + inner * 2), ph = items.length * rowH + inner * 2 - 4;
    const px = x + w - pw, py = y - ph - Math.round(g * 0.6);
    rrect(px, py, pw, ph, r, '#0b1020ee', '#ffffff40', 2);
    items.forEach((it, i) => {
      const ry = py + inner + i * rowH, on = i === st.sel;
      hot(px + inner, ry, pw - inner * 2, rowH - 4, { hover: () => st.sel = i, click: () => { st.sel = i; uiBlip(880, 0.05); it.act(); } });
      rrect(px + inner, ry, pw - inner * 2, rowH - 4, Math.round(r * 0.7), on ? '#ffde3bee' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
      text(it.label, px + inner + padX, ry + (rowH - 4) / 2, fs, on ? '#1a1a2a' : '#fff', 'left', null);
    });
  },
  // a short notice at the top of the screen; slot stacks several
  notice(s, slot = 0) {
    const fs = clamp(Math.round(VH / 36), 13, 24), g = Math.round(fs * 0.9), padX = Math.round(fs * 1.1), padY = Math.round(fs * 0.7), maxW = Math.min(VW - 2 * g, fs * 36);
    ctx.font = this.font(fs); const lines = []; let cur = '';
    for (const wd of String(s).split(' ')) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW - 2 * padX && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    const w = Math.round(Math.max(...lines.map(l => ctx.measureText(l).width)) + 2 * padX), pitch = Math.round(fs * 1.35), h = lines.length * pitch + 2 * padY - Math.round(fs * 0.35), x = Math.round((VW - w) / 2), y = g + slot * (Math.round(fs * 2.6) + Math.round(g * 0.5));
    rrect(x, y, w, h, Math.round(fs * 0.6), '#0b1020ee', '#ffffff40', 2); lines.forEach((l, i) => text(l, VW / 2, y + padY + pitch * (i + 0.5) - Math.round(fs * 0.17), fs, '#fff', 'center', null));
  },
  // bag item icons: the PokeSprite item sprites (data/adv/item-sprites.js, 32 x 32) at a whole-number scale; r is the icon's radius in px.
  // Tiny world-space icons (r < 8: the heal machine's balls; a thrown ball and item use are ADVUI.thing) keep the drawn shapes below, since a 32 px sprite would dwarf them.
  sprite(id) {
    const S_ = window.ADV_ITEM_SPRITES; if (!S_) return null;
    const it = ADVP.item(id), file = it.tm ? S_.tm[DEX.moves[it.tm]?.type?.toLowerCase()] : S_.files[id];
    return img(file || S_.unknown);
  },
  icon(id, x, y, r) {
    const it = ADVP.item(id), g = ctx, im = r >= 8 && this.sprite(id);
    // the art fills about half of the 32 px cell, so r is measured against 16
    if (im) { const k = Math.max(1, Math.floor(r * 2 / 16 + 0.35)), w = 32 * k; g.imageSmoothingEnabled = false; g.drawImage(im, Math.round(x - w / 2), Math.round(y - w / 2), w, w); return; }
    if (r >= 8 && window.ADV_ITEM_SPRITES) return;   // sprite still loading: draw nothing for a frame instead of flashing the old shape
    if (it.cat === 'ball') {
      const top = { pokeball: '#e8342c', greatball: '#2f6fe0', ultraball: '#f2c200', masterball: '#8a3fc9' }[id] || '#e8342c';
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = '#fff'; g.fill(); g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.fillStyle = top; g.fill();
      g.lineWidth = Math.max(1.5, r / 7); g.strokeStyle = '#111'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.moveTo(x - r, y); g.lineTo(x + r, y); g.stroke();
      g.beginPath(); g.arc(x, y, r * 0.3, 0, 6.283); g.fillStyle = '#fff'; g.fill(); g.stroke();
    } else if (it.heal) {
      const col = { potion: '#4cc0ff', superpotion: '#ff8a3c', hyperpotion: '#ffe040', maxpotion: '#b66bff', fullrestore: '#ff70c0' }[id] || '#4cc0ff';
      rrect(x - r * 0.65, y - r * 0.2, r * 1.3, r * 1.2, r * 0.3, col, '#111', 2); rrect(x - r * 0.25, y - r * 0.95, r * 0.5, r * 0.8, 2, '#dfe6ee', '#111', 2);
    } else if (it.cure) {
      const col = { antidote: '#a33ea1', paralyzeheal: '#e8c630', awakening: '#5aa8ff', burnheal: '#ee5a30', iceheal: '#7fe0f0', fullheal: '#ff9ecb' }[id] || '#fff';
      g.save(); g.translate(x, y); g.rotate(-0.6); rrect(-r, -r * 0.4, r, r * 0.8, r * 0.4, col, '#111', 2); rrect(0, -r * 0.4, r, r * 0.8, r * 0.4, '#f4f4f4', '#111', 2); g.restore();
    } else {
      const col = it.revive ? (it.revive === 1 ? '#ffd23c' : '#ffe98a') : it.candy ? '#4f9bff' : it.tm ? '#8c8ca0' : '#' + ((id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) & 0xffffff) | 0x404040).toString(16).slice(-6).padStart(6, '4');
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke();
      if (it.tm) text('TM', x, y + 1, r * 0.7, '#fff', 'center', null);
    }
  },
  // a bag item lying or flying in the world: the real PokeSprite icon on the world's art grid (ADVR.ART world px per art px), nearest-neighbour, with the house outline (outlined() in render.js).
  // It only ever turns in whole quarter turns (turns), so no pixel gets resampled. (x, y) is where the icon's centre goes; false while the sprite is still loading.
  thing(id, x, y, turns = 0) {
    const im = this.sprite(id); if (!im) return false;
    const g = ctx, k = ADVR.ART, w = 32 * k; g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(x), Math.round(y)); g.rotate((turns & 3) * Math.PI / 2);
    g.drawImage(outlined(im, 32, 32), -w / 2, -w / 2, w, w); g.restore(); return true;
  },
  // the starter pool: one base-stage, non-legendary species per dex number that the engine can draw
  starters() {
    if (this._st) return this._st;
    const best = {};
    for (const id in ADV_DEX) { const d = ADV_DEX[id], sp = DEX.species[id]; if (d.baseStage && !d.legendary && sp && sp.num > 0 && SPRITES[sp.sprite] && (!best[sp.num] || id.length < best[sp.num].length)) best[sp.num] = id; }
    return this._st = Object.values(best).sort((a, b) => DEX.species[a].num - DEX.species[b].num);
  },
  moveRow(id, x, y, w, h) {
    const mv = DEX.moves[id]; if (!mv) return;
    rrect(x, y, w, h, h / 4, '#ffffff10', '#ffffff22', 1);
    const cw = hudChip(x + 6, y + (h - h * 0.7) / 2, mv.type.toUpperCase(), TYPE_COLOR[mv.type], h * 0.7);
    text(mv.name, x + 12 + cw, y + h / 2 + 1, h * 0.46, '#fff', 'left', null);
    text(mv.category === 'Status' ? 'STATUS' : 'POW ' + (mv.basePower || '-'), x + w - 10, y + h / 2 + 1, h * 0.36, '#9aa6c0', 'right', null, 'Silkscreen');
  },

  // one mon in full: portrait, level, HP, EXP, nature, ability, stats and moves
  summary(s, x, y, w, h) {
    const { L } = layout(), sp = DEX.species[toId(s.species)], mx = ADVP.maxes(s), rate = ADVP.rate(s.species), lo = ADVP.expFor(rate, s.level), hi = ADVP.expFor(rate, Math.min(100, s.level + 1));
    panel(x, y, w, h, ADVP.name(s).toUpperCase(), 'Lv ' + s.level);
    const im = portrait(sp.id); rrect(x + L(20), y + L(50), L(150), L(150), L(12), '#00000066', '#ffffff44', 2); if (im) ctx.drawImage(im, x + L(22), y + L(52), L(146), L(146));
    let cx = x + L(190); for (const t of sp.types) cx += hudChip(cx, y + L(52), t.toUpperCase(), TYPE_COLOR[t], L(26));
    text(s.nickname ? sp.name : '', x + L(190), y + L(100), L(14), '#9aa6c0', 'left', null);
    const f = s.hp / mx.max;
    text('HP', x + L(190), y + L(128), L(14), '#ffde3b', 'left', null); this.bar(x + L(226), y + L(118), L(250), L(18), f, this.hpCol(f));
    text(`${Math.max(0, Math.ceil(s.hp))} / ${mx.max}`, x + w - L(24), y + L(128), L(14), '#fff', 'right', null);
    if (s.status) this.chip(STATUS_LABEL[s.status] || s.status, x + L(190), y + L(146), L(22), this.STCOL[s.status] || '#888');
    text('EXP', x + L(190), y + L(186), L(14), '#ffde3b', 'left', null); this.bar(x + L(236), y + L(176), L(240), L(14), s.level >= 100 ? 1 : (s.exp - lo) / Math.max(1, hi - lo), '#5aa8ff');
    text(s.level >= 100 ? 'MAX' : `${hi - s.exp} to next`, x + w - L(24), y + L(186), L(13), '#9aa6c0', 'right', null);
    const nat = DEX.natures[toId(s.nature)] || {}, ab = DEX.abilities?.[toId(s.ability)]?.name || s.ability;
    text(`${s.nature || 'Hardy'}${nat.plus && nat.plus !== nat.minus ? '  +' + nat.plus.toUpperCase() + ' -' + nat.minus.toUpperCase() : ''}`, x + L(24), y + L(232), L(15), '#dde', 'left', null);
    text(ab, x + w - L(24), y + L(232), L(15), '#7fd0e8', 'right', null);
    const st = ADVP.stats(s), names = [['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['spa', 'SPA'], ['spd', 'SPD'], ['spe', 'SPE']], cw = (w - L(48)) / 6;
    names.forEach(([k, n], i) => {
      const col = nat.plus === k && nat.plus !== nat.minus ? '#7be07b' : nat.minus === k && nat.plus !== nat.minus ? '#ff8a8a' : '#fff';
      text(n, x + L(24) + cw * (i + 0.5), y + L(268), L(12), '#9aa6c0', 'center', null, 'Silkscreen'); text(String(st[k]), x + L(24) + cw * (i + 0.5), y + L(294), L(20), col, 'center', null);
    });
    for (let i = 0; i < 4; i++) { if (s.moves[i]) this.moveRow(s.moves[i], x + L(24), y + L(320) + i * L(46), w - L(48), L(40)); else rrect(x + L(24), y + L(320) + i * L(46), w - L(48), L(40), L(10), '#ffffff08', '#ffffff18', 1); }
    ADVUI.icon(s.ball || 'pokeball', x + L(40), y + h - L(28), L(12)); text(`OT ${s.ot || '?'}   ${ADVP.item(s.ball || 'pokeball').name}   Friendship ${s.friend | 0}`, x + L(72), y + h - L(26), L(13), '#9aa6c0', 'left', null);
  },

  // ---------- start ----------
  start(sc) {
    const st = { sel: 0 }, note = { s: '', bad: false }, slot = sc.slot();
    const items = () => [
      ...(slot ? [{ label: 'Continue', value: slot.name, act: () => sc.begin(slot) }] : []),
      { label: 'New Game', act: () => sc.open(ADVUI.newGame(sc)) },
      { label: 'Load Save File', act: () => sc.loadFile(m => { note.s = m; note.bad = true; }) },
      { label: 'Back', act: () => setScene(MenuScene) },
    ];
    return {
      update(dt) { runMenu(st, items(), dt); if (backHit()) setScene(MenuScene); },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), s = S();
        text('ADVENTURE', VW / 2, 90 * s, 54 * s, '#ffde3b', 'center', '#1a2a6c'); text('KENORA', VW / 2, 140 * s, 22 * s, '#9aa6c0', 'center', null);
        drawMenu(items(), st, VW / 2, 190 * s, 520 * s, 64);
        if (slot && st.sel === 0) {   // the save in brief, same width as the menu above it
          const w = 520 * s, h = 116 * s, x = VW / 2 - w / 2, y = 190 * s + items().length * 64 * s + 14 * s, p = 14 * s, av = h - 2 * p, tx = x + p + av + 16 * s;
          rrect(x, y, w, h, 14 * s, '#0b1020cc', '#ffffff26', 2); avatarTile(slot.avatar, x + p, y + p, av);
          text(slot.name, tx, y + p + 14 * s, 20 * s, '#fff', 'left', null); text(`${ADVUI.money(slot.money)}   ${slot.badges} ${slot.badges === 1 ? 'badge' : 'badges'}`, x + w - p, y + p + 14 * s, 15 * s, '#ffde3b', 'right', null);
          text('Home ' + (ADVS.town(slot.home)?.name || ''), tx, y + p + 42 * s, 14 * s, '#9aa6c0', 'left', null);
          const ps = Math.min(34 * s, (w - (tx - x) - p - 5 * 5 * s) / 6); slot.party.forEach((m, i) => { const im = portrait(toId(m.species)); if (im) ctx.drawImage(im, tx + i * (ps + 5 * s), y + h - p - ps, ps, ps); });
        }
        if (note.s) text(note.s, VW / 2, VH - 70 * s, 16 * s, note.bad ? '#ff9a9a' : '#9f9', 'center', null);
        hint(INPUT.usingPad ? 'A select   B back' : 'Click to select   Esc back'); backButton(() => setScene(MenuScene));
      },
    };
  },
  money: n => '$' + n,

  // ---------- new game: trainer, hometown, starter ----------
  newGame(sc) {
    const st = { stage: 0, sel: 0, off: 0, q: '', ate: false, town: 0, home: '', pick: 0, list: ADVUI.starters(), tab: 0, outfit: ADVO.def() }, towns = ADVS.towns().sort((a, b) => a.name.localeCompare(b.name));
    const refilter = () => { const q = toId(st.q); st.list = q === 'jarona' && DEX.species.flowery ? ['flowery'] : ADVUI.starters().filter(id => toId(DEX.species[id].name).includes(q)); st.sel = 0; st.off = 0; };   // "jarona": the hidden Flowery starter, same unlock as the battle picker
    const keys = searchKeys(st, refilter);
    const stage = n => { st.stage = n; st.sel = 0; st.off = 0; uiBlip(880, 0.05); };
    const go = () => {
      const id = st.list[st.sel]; if (!id) return;
      sc.begin(ADVS.fresh({ name: profileName(), avatar: profileAvatar(), outfit: st.outfit, home: st.home, starter: ADVP.mon(id, 5, { ot: profileName() }) }));
    };
    const cols = () => Math.max(4, Math.floor((VW - 80) / (84 * S()))), rows = () => Math.max(1, Math.floor((VH - 250 * S()) / (84 * S())));
    const back = () => st.stage ? stage(st.stage - 1) : sc.close();
    const dlgItems = () => [
      { label: 'Edit name and portrait', act: () => { ProfileScene.back = AdventureScene; sc.resume = ui; setScene(ProfileScene); } },
      { label: 'Next: design your trainer', act: () => sc.open(ADVUI.outfit(sc, st.outfit, o => { st.outfit = o; stage(1); })) },
      { label: 'Back', act: () => sc.close() },
    ];
    const ui = {
      enter() { window.addEventListener('keydown', keys); }, exit() { window.removeEventListener('keydown', keys); },
      update(dt) {
        if (st.stage === 0) { runMenu(st, dlgItems(), dt); if (backHit()) sc.close(); return; }
        if (st.stage === 1) {
          ADVUI.nav(st, towns.length); if (okHit()) { st.home = towns[st.sel].id; stage(2); st.list = ADVUI.starters(); st.q = ''; return; } if (backHit()) back(); return;
        }
        if (st.stage === 2) {
          const n = st.list.length, c = cols(), dir = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(k => KEYS[k]) ? '' : INPUT.menu;
          if (dir === 'left') st.sel = Math.max(0, st.sel - 1); if (dir === 'right') st.sel = Math.min(n - 1, st.sel + 1);
          if (dir === 'up') st.sel = Math.max(0, st.sel - c); if (dir === 'down') st.sel = Math.min(n - 1, st.sel + c);
          st.sel = clamp(st.sel, 0, Math.max(0, n - 1));
          if (okHit() && !st.ate && n) stage3(); else if (backHit() && !st.ate) back();
          st.ate = false; return;
        }
        if (INPUT.menu === 'left' || INPUT.menu === 'right') st.pick ^= 1;
        if (okHit()) { if (st.pick === 0) go(); else { st.stage = 2; st.pick = 0; } } else if (backHit()) { st.stage = 2; st.pick = 0; }
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), s = S();
        if (st.stage === 0) {
          text('NEW GAME', X(660), Y(60), L(44), '#ffde3b', 'center', '#1a2a6c');
          panel(X(380), Y(110), L(560), L(300), 'YOUR TRAINER'); avatarTile(profileAvatar(), X(410), Y(160), L(200), '#ffde3b');
          text(profileName(), X(640), Y(220), L(30), '#fff', 'left', null); text((avatarById(profileAvatar())?.name || '').toUpperCase(), X(640), Y(262), L(15), '#9aa6c0', 'left', null);
          text('Your name and portrait come from the Profile.', X(410), Y(380), L(13), '#9aa6c0', 'left', null);
          drawMenu(dlgItems(), st, X(660), Y(450), L(560), 62);
          hint(INPUT.usingPad ? 'A select   B back' : 'Click to select   Esc back'); backButton(() => sc.close());
        } else if (st.stage === 1) {
          text('CHOOSE YOUR HOMETOWN', X(660), Y(50), L(36), '#ffde3b', 'center', '#1a2a6c');
          const rows = 10, per = L(54); ADVUI.scroll(st, towns.length, rows);
          towns.slice(st.off, st.off + rows).forEach((t, j) => {
            const i = j + st.off, y = Y(110) + j * per, on = i === st.sel;
            hot(X(380), y, L(560), per - 6, { hover: () => st.sel = i, click: () => { st.sel = i; st.home = t.id; stage(2); }, wheel: d => st.sel = clamp(st.sel + d, 0, towns.length - 1) });
            rrect(X(380), y, L(560), per - 6, L(12), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
            text(t.name, X(404), y + (per - 6) / 2, L(22), on ? '#1a1a2a' : '#fff', 'left', null);
            text(t.id[0] === 'G' ? 'GYM CITY' : 'TOWN', X(916), y + (per - 6) / 2, L(13), on ? '#1a1a2a' : '#9aa6c0', 'right', null, 'Silkscreen');
          });
          text('You wake at its Pokemon Center after a blackout.', X(660), Y(700), L(14), '#9aa6c0', 'center', null);
          hint(INPUT.usingPad ? 'A pick   B back' : 'Click a town   Esc back'); backButton(back);
        } else if (st.stage === 2) {
          const sz = 84 * s, ids = st.list, c = cols(), r = rows(), y0 = 150 * s;
          text('CHOOSE YOUR STARTER', VW / 2, 34 * s, 30 * s, '#ffde3b', 'center');
          text(`Hometown: ${ADVS.town(st.home).name}   Level 5`, VW / 2, 70 * s, 14 * s, '#9aa6c0', 'center', null);
          searchBox(VW / 2 - 300 * s, 92 * s, 600 * s, 36 * s, st.q, 'Type a name to search'); text(`${ids.length} shown`, VW / 2 + 286 * s, 110 * s, 12 * s, '#9ab', 'right', null);
          const row = Math.floor(st.sel / c); st.off = clamp(row < (st.off | 0) ? row : row >= (st.off | 0) + r ? row - r + 1 : (st.off | 0), 0, Math.max(0, Math.ceil(ids.length / c) - r));
          hot(40, y0, c * sz, r * sz, { wheel: d => st.off = clamp(st.off + d, 0, Math.max(0, Math.ceil(ids.length / c) - r)) });
          for (let i = st.off * c; i < Math.min(ids.length, (st.off + r) * c); i++) {
            const x = 40 + (i % c) * sz, y = y0 + (Math.floor(i / c) - st.off) * sz, on = i === st.sel, sp = DEX.species[ids[i]];
            hot(x, y, sz - 6, sz - 6, { hover: () => st.sel = i, click: () => { st.sel = i; stage3(); } });
            rrect(x, y, sz - 6, sz - 6, 10 * s, on ? '#ffde3b' : '#ffffff12');
            const im = portrait(ids[i]); if (im) ctx.drawImage(im, x + 12 * s, y + 2 * s, sz - 30 * s, sz - 30 * s);
            text(sp.name.length > 11 ? sp.name.slice(0, 10) + '.' : sp.name, x + (sz - 6) / 2, y + sz - 17 * s, 10 * s, on ? '#111' : '#dde', 'center', null, 'Silkscreen');
          }
          const id = ids[st.sel];
          if (id) {
            const sp = DEX.species[id], mv = ADVP.moves(id, 5), y = y0 + r * sz + 8 * s;
            text(`#${sp.num} ${sp.name.toUpperCase()}`, 40, y + 12 * s, 20 * s, '#fff', 'left'); let cx = 60 + 12 * 20 * s * 0.9; for (const t of sp.types) cx += hudChip(cx, y, t.toUpperCase(), TYPE_COLOR[t], 22 * s);
            text(mv.map(m => DEX.moves[m].name).join('   ') || 'default moves', 40, y + 40 * s, 14 * s, '#9aa6c0', 'left', null);
          } else text('No Pokemon match', VW / 2, y0 + 60 * s, 20 * s, '#ccc', 'center');
          hint(INPUT.usingPad ? 'A pick   B back' : 'Type to search   arrows or scroll browse   Enter pick   Esc back'); backButton(back);
        } else {
          const id = st.list[st.sel], sp = DEX.species[id];
          panel(X(380), Y(180), L(560), L(300), 'START YOUR ADVENTURE?');
          const im = portrait(id); if (im) ctx.drawImage(im, X(410), Y(240), L(150), L(150));
          text(sp.name.toUpperCase(), X(590), Y(280), L(28), '#fff', 'left', null); text('Level 5', X(590), Y(318), L(16), '#ffde3b', 'left', null);
          text('Home: ' + ADVS.town(st.home).name, X(590), Y(350), L(15), '#9aa6c0', 'left', null);
          [['START', 0], ['CHOOSE AGAIN', 1]].forEach(([l, i]) => { const x = X(410) + i * L(250), on = st.pick === i; hot(x, Y(420), L(230), L(44), { hover: () => st.pick = i, click: () => { st.pick = i; if (i) { st.stage = 2; st.pick = 0; } else go(); } }); rrect(x, Y(420), L(230), L(44), L(10), on ? '#ffde3b' : '#ffffff18', '#fff', 2); text(l, x + L(115), Y(443), L(17), on ? '#111' : '#fff', 'center', null); });
        }
      },
    };
    const stage3 = () => { st.stage = 3; st.pick = 0; uiBlip(880, 0.05); };
    return ui;
  },

  // ---------- outfit customiser (docs/OUTFITS.md) ----------
  // o = the outfit to start from; done(outfit) runs after the screen closes with Done (Esc / B cancels)
  outfit(sc, start, done) {
    const st = { sel: 0, t0: performance.now() }, o = ADVO.clean(start), n = ADVO.n(), D = window.ADV_OUTFIT, K = ADVO.KEYS.filter(k => D.bag.length || !/^bag/.test(k));   // no bag rows while there are no bags
    const names = { body: 'Body', hair: 'Hair', hairC: 'Hair colour', hat: 'Hat', hatC: 'Hat colour', top: 'Top', topC: 'Top colour', bot: 'Bottom', botC: 'Bottom colour', bag: 'Bag', bagC: 'Bag colour', skin: 'Skin' };
    const val = k => ADVO.label(k, o);
    const items = () => [
      ...K.map(k => ({ label: names[k], value: val(k), cycle: d => o[k] = (o[k] + d + n[k]) % n[k] })),
      { label: 'Randomise', act: () => Object.assign(o, ADVO.rand()) },
      { label: 'Done', act: () => { sc.close(); done(ADVO.clean(o)); } },
    ];
    return {
      st, o,   // st.t0 / o are exposed for the screenshot harness
      update(dt) { runMenu(st, items(), dt); if (backHit()) sc.close(); },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), s = S(), rowH = 44, y0 = Y(86), x = X(930), w = L(560), it = items();
        text('YOUR LOOK', X(660), Y(40), L(40), '#ffde3b', 'center', '#1a2a6c');
        panel(X(40), Y(86), L(520), L(640), 'PREVIEW');
        // the preview walks each of the 8 directions for a while, then stands (breathing) a moment, rotating
        const sh = ADVO.sheet(o), t = (performance.now() - st.t0) / 1000, face = Math.floor(t / 1.6) % 8, walking = t % 1.6 < 1.1, sc10 = L(12), cx = X(300), by = Y(580);
        if (sh) {
          const a = sh.anims[(walking ? 'walk.' : 'idle.') + ADVO.ROWS[face]] || sh.anims['idle.down'], f = Math.floor(t * (walking ? 6 : a.fps)) % a.n;
          ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.ellipse(cx, by + L(4), L(110), L(28), 0, 0, 6.283); ctx.fill();
          ctx.drawImage(outlined(sh.cv, sh.fw, sh.fh), f * sh.fw, a.row * sh.fh, sh.fw, sh.fh, Math.round(cx - sh.fw / 2 * sc10), Math.round(by - sh.footY * sc10), sh.fw * sc10, sh.fh * sc10);
        } else text('Loading...', cx, Y(400), L(20), '#9aa6c0', 'center', null);
        for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(cx + (i - 3.5) * L(26), Y(680), L(5), 0, 6.283); ctx.fillStyle = i === face ? '#ffde3b' : '#ffffff40'; ctx.fill(); }
        drawMenu(it, st, x, y0, w, rowH);
        K.forEach((k, i) => {   // colour rows show their ramp
          if (!/C$|skin/.test(k)) return;
          const cols = k === 'skin' ? D.skins[o.skin] : D.ramps[o[k]], on = i === st.sel, yy = y0 + i * rowH * s, sw = 22 * s;
          cols.forEach((c, j) => { const xx = x + w / 2 - 70 * s - (cols.length - j) * (sw + 2 * s); rrect(xx, yy + (rowH - 8) * s / 2 - sw / 2, sw, sw, 4 * s, '#' + c, on ? '#1a1a2a' : '#ffffff55', 2); });
        });
        hint(INPUT.usingPad ? 'A change   B cancel   left/right change' : 'Up/down pick a row   left/right change   Enter confirm   Esc cancel'); backButton(() => sc.close());
      },
    };
  },

  // ---------- settings (from the pause menu): the same rows as the main menu's Settings screen, over the paused world ----------
  settings(sc) {
    const st = { sel: 0 };
    return {
      update(dt) { runMenu(st, settingsItems(), dt); if (backHit() || INPUT.hit('START')) sc.close(); },
      draw() {
        ctx.fillStyle = '#000c'; ctx.fillRect(0, 0, VW, VH); const { X, Y, L } = layout();
        text('SETTINGS', X(660), Y(50), L(40), '#ffde3b', 'center', '#1a2a6c'); drawMenu(settingsItems(), st, X(660), Y(130), L(560), 62);
        hint(INPUT.usingPad ? 'B back   left/right change' : 'Left/right or scroll to change   Esc back'); backButton(() => sc.close());
      },
    };
  },

  // ---------- pause menu ----------
  pause(sc) {
    const st = { sel: 0 }, note = { s: '', bad: false }, say = (s, bad) => { note.s = s; note.bad = !!bad; };
    const items = () => [
      { label: 'Resume', act: () => sc.close() },
      { label: 'Party', act: () => sc.open(ADVUI.party(sc)) },
      { label: 'Bag', act: () => sc.open(ADVUI.bag(sc)) },
      { label: 'Map', act: () => sc.open(ADVMAP.ui(sc)) },
      { label: `PC Box (${sc.save.box.length})`, act: () => sc.open(ADVUI.box(sc)) },
      { label: 'Change outfit', act: () => sc.open(ADVUI.outfit(sc, sc.save.outfit, o => sc.save.outfit = o)) },
      { label: 'Settings', act: () => sc.open(ADVUI.settings(sc)) },
      { label: 'Save', act: () => sc.saveFile(say) },
      { label: 'Load', act: () => sc.loadFile(m => say(m, true)) },
      { label: 'Test', act: () => sc.open(ADVDBG.panel(sc)) },
      { label: 'Quit to menu', act: () => { sc.persist(); setScene(MenuScene); } },
    ];
    return {
      update(dt) { runMenu(st, items(), dt); if (backHit() || INPUT.hit('START')) sc.close(); },
      draw() {
        ctx.fillStyle = '#000c'; ctx.fillRect(0, 0, VW, VH); const { X, Y, L } = layout(), sv = sc.save, its = items(), rowH = 54, top = 110, H = its.length * rowH - 8;
        text('PAUSED', X(660), Y(50), L(40), '#ffde3b', 'center', '#1a2a6c');
        const cx = X(190), cw = L(370), pad = L(22), kv = (k, v, y, col = '#fff') => { text(k, cx + pad, Y(y), L(13), '#9aa6c0', 'left', null, 'Silkscreen'); text(v, cx + cw - pad, Y(y), L(17), col, 'right', null); };
        panel(cx, Y(top), cw, L(H)); avatarTile(sv.avatar, cx + pad, Y(top + 22), L(96));
        text(sv.name, cx + pad + L(114), Y(top + 52), L(26), '#fff', 'left', null); text(ADVUI.money(sv.money), cx + pad + L(114), Y(top + 92), L(20), '#ffde3b', 'left', null);
        kv('BADGES', String(sv.badges), top + 160); kv('HOME', ADVS.town(sv.home).name, top + 194); kv('LAST', ADVS.town(sv.last).name, top + 228);
        text('SKILLS', cx + pad, Y(top + 266), L(13), '#9aa6c0', 'left', null, 'Silkscreen'); wrapText(Object.keys(sv.skills || {}).map(k => ADVP.SKILLS[k]?.name || k).join(', ') || 'None yet', cx + pad, Y(top + 292), cw - 2 * pad, L(15), '#7fd0e8');
        if (sc.chatOn()) text(`${sc.net.N.role === 'host' ? 'Hosting' : 'On'} ${sc.net.N.name}  ${sc.net.N.count()}/16`, cx + pad, Y(top + 352), L(13), '#7be07b', 'left', null);
        const ps = L(48), gap = (cw - 2 * pad - 6 * ps) / 5; sv.party.forEach((m, i) => { const im = portrait(toId(m.species)), x = cx + pad + i * (ps + gap), y = Y(top + H - 72); rrect(x, y, ps, ps, L(8), '#00000066', '#ffffff33', 1); if (im) { ctx.globalAlpha = ADVP.fainted(m) ? 0.35 : 1; ctx.drawImage(im, x, y, ps, ps); ctx.globalAlpha = 1; } });
        drawMenu(its, st, X(870), Y(top), L(500), rowH);
        if (note.s) text(note.s, X(870), Y(top + H + 24), L(15), note.bad ? '#ff9a9a' : '#9f9', 'center', null);
        hint(INPUT.usingPad ? 'A select   B resume' : 'Click to select   Esc resume');
      },
    };
  },

  // ---------- lessons (docs/TRAVEL.md): a bar with a moving marker; stop it inside the zone to score. easy = wide zone, 3 hits; hard = narrow zone, 6 hits; 3 misses end it ----------
  lesson(sc, level, name, done) {
    const L = ADVP.LESSON[level], st = { s: ADVP.lesson(level), t0: performance.now(), flash: 0, last: '' }, now = () => (performance.now() - st.t0) / 1000;
    const stop = () => {
      if (st.s.done) { sc.close(); return done(st.s.done === 'won'); }
      st.last = st.s.press(ADVP.marker(now(), L.speed)); st.flash = 0.3; uiBlip(st.last === 'miss' || st.last === 'lost' ? 300 : 880, 0.05);
    };
    return {
      st,
      update(dt) { st.flash -= dt; if (okHit() || (MOUSE.hit && now() > 0.3)) stop(); else if (backHit() && !st.s.done) { sc.close(); done(false); } },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L: l } = layout(), S_ = st.s, bx = X(260), by = Y(330), bw = l(800), bh = l(70), m = ADVP.marker(now(), L.speed);
        text(name.toUpperCase() + ' LESSON', X(660), Y(110), l(38), '#ffde3b', 'center', '#1a2a6c'); text(level === 'easy' ? 'Easy: a wide zone, ' + S_.need + ' hits' : 'Hard: a narrow zone, ' + S_.need + ' hits', X(660), Y(160), l(18), '#9aa6c0', 'center', null);
        rrect(bx, by, bw, bh, l(14), '#0b1020', '#ffffff55', 3);
        rrect(bx + (S_.c - S_.zone / 2) * bw, by + l(4), S_.zone * bw, bh - l(8), l(8), st.flash > 0 && st.last === 'hit' ? '#b8ff9a' : '#4cd964');
        ctx.fillStyle = st.flash > 0 && (st.last === 'miss' || st.last === 'lost') ? '#ff5a4a' : '#fff'; ctx.fillRect(Math.round(bx + m * bw - l(4)), by - l(10), l(8), bh + l(20));
        for (let i = 0; i < S_.need; i++) { ctx.beginPath(); ctx.arc(X(660) + (i - (S_.need - 1) / 2) * l(40), Y(470), l(13), 0, 6.283); ctx.fillStyle = i < S_.hits ? '#4cd964' : '#ffffff30'; ctx.fill(); }
        text('Misses: ' + S_.miss + ' / ' + ADVP.MISSES, X(660), Y(530), l(18), S_.miss ? '#ff9a9a' : '#9aa6c0', 'center', null);
        text(S_.done === 'won' ? 'You passed!' : S_.done === 'lost' ? 'Too many misses.' : 'Stop the marker inside the green.', X(660), Y(590), l(26), S_.done === 'won' ? '#9f9' : S_.done === 'lost' ? '#ff9a9a' : '#fff', 'center', null);
        hint(S_.done ? (INPUT.usingPad ? 'A continue' : 'Enter or click to continue') : INPUT.usingPad ? 'A stop the marker   B give up' : 'Enter, Space or click to stop the marker   Esc give up');
      },
    };
  },
  // a question with several answers; the screen closes first, then runs the chosen act
  choose(sc, line, opts) {
    const st = { sel: 0 }, items = () => opts.map(o => ({ label: o.label, act: () => { sc.close(); o.act(); } }));
    return {
      update(dt) { runMenu(st, items(), dt); if (backHit()) sc.close(); },
      draw() {
        ADVUI.choice(line, items(), st);
      },
    };
  },

  // ---------- party ----------
  // pick(i) given: choosing a mon hands its index back (item targets); otherwise A opens the actions
  party(sc, pick, title = 'PARTY') {
    const st = { sel: 0, off: 0, act: null, mv: -1, note: '' }, P = () => sc.save.party;
    const swap = (a, b) => { const p = P(); [p[a], p[b]] = [p[b], p[a]]; sc.refreshLead(); };
    const actions = () => {
      const i = st.sel, p = P();
      return [
        ...(i ? [{ label: 'Make lead', act: () => { swap(i, 0); st.sel = 0; st.act = null; st.note = ADVP.name(p[0]) + ' leads the way.'; } }] : []),
        ...(p.length > 1 ? [{ label: 'Move to...', act: () => { st.mv = i; st.act = null; } }] : []),
        ...(p.length > 1 ? [{ label: 'Send to PC box', act: () => { const [m] = p.splice(i, 1); sc.save.box.push(m); st.sel = Math.min(i, p.length - 1); st.act = null; st.note = ADVP.name(m) + ' was sent to the PC box.'; sc.refreshLead(); } }] : []),
        { label: 'Cancel', act: () => st.act = null },
      ];
    };
    const choose = i => {
      st.sel = i; uiBlip(880, 0.05);
      if (pick) return pick(i);
      if (st.mv >= 0) { if (i !== st.mv) { swap(st.mv, i); st.note = 'Moved.'; } st.mv = -1; return; }
      st.act = { sel: 0 };
    };
    return {
      update(dt) {
        const p = P();
        if (st.act) { runMenu(st.act, actions(), dt); if (backHit()) st.act = null; return; }
        ADVUI.nav(st, p.length);
        if (okHit()) choose(st.sel);
        else if (backHit()) { if (st.mv >= 0) st.mv = -1; else sc.close(); }
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), p = P();
        text(title, X(660), Y(46), L(36), '#ffde3b', 'center', '#1a2a6c');
        p.forEach((m, i) => {
          const y = Y(80) + i * L(106), on = i === st.sel, sp = DEX.species[toId(m.species)], f = m.hp / ADVP.max(m), dead = ADVP.fainted(m);
          hot(X(30), y, L(520), L(98), { hover: () => { if (!st.act) st.sel = i; }, click: () => { if (!st.act) choose(i); } });   // with the actions menu open the rows under it keep still
          rrect(X(30), y, L(520), L(98), L(14), st.mv === i ? '#7fd0e866' : on ? '#ffde3b33' : '#0b1020cc', on ? '#ffde3b' : '#ffffff26', on ? 3 : 2);
          const im = portrait(sp.id); if (im) { ctx.globalAlpha = dead ? 0.4 : 1; ctx.drawImage(im, X(40), y + L(8), L(82), L(82)); ctx.globalAlpha = 1; }
          text(ADVP.name(m), X(136), y + L(26), L(22), dead ? '#999' : '#fff', 'left', null); text('Lv ' + m.level, X(536), y + L(26), L(18), '#ffde3b', 'right', null);
          ADVUI.bar(X(136), y + L(46), L(280), L(14), dead ? 0 : f, ADVUI.hpCol(f)); text(`${Math.max(0, Math.ceil(m.hp))} / ${ADVP.max(m)}`, X(536), y + L(53), L(14), '#fff', 'right', null);
          if (dead) ADVUI.chip('FNT', X(136), y + L(66), L(22), '#666'); else if (m.status) ADVUI.chip(STATUS_LABEL[m.status] || m.status, X(136), y + L(66), L(22), ADVUI.STCOL[m.status] || '#888');
          if (!i) text('LEAD', X(536), y + L(80), L(13), '#7be07b', 'right', null, 'Silkscreen');
        });
        if (p[st.sel]) ADVUI.summary(p[st.sel], X(580), Y(80), L(710), L(640));
        if (st.act) {
          const its = actions(); ctx.fillStyle = '#0008'; ctx.fillRect(0, 0, VW, VH);
          panel(X(300), Y(220), L(420), L(60 + its.length * 62), ADVP.name(p[st.sel]).toUpperCase()); drawMenu(its, st.act, X(510), Y(270), L(360), 58);
        }
        if (st.note) text(st.note, X(300), Y(748), L(15), '#9f9', 'center', null);
        hint(pick ? 'A use on this one   B back' : INPUT.usingPad ? 'A actions   B back' : st.mv >= 0 ? 'Pick where to move it   Esc cancel' : 'Click or Enter for actions   Esc back');
        backButton(() => { if (pick || st.mv < 0) sc.close(); else st.mv = -1; });
      },
    };
  },

  // ---------- bag ----------
  bag(sc) {
    const st = { cat: 0, sel: 0, off: 0, note: '', bad: false }, B_ = () => sc.save.bag;
    const list = () => Object.keys(B_()).filter(id => ADVP.item(id).cat === ADVP.CATS[st.cat][0]).sort();
    const say = (s, bad) => { st.note = s; st.bad = !!bad; };
    const tab = d => { st.cat = (st.cat + d + ADVP.CATS.length) % ADVP.CATS.length; st.sel = 0; st.off = 0; uiBlip(700, 0.03); };
    const use = id => {
      const it = ADVP.item(id);
      if (it.ball) return say('Balls are thrown in a wild battle (press C or Y).', true);
      if (id === 'bike') { const no = sc.mountKey('bike'); if (no) return say(no, true); while (sc.uis.length) sc.close(); return; }
      if (id === 'fishingrod') return say(sc.save.skills.fishing ? 'Face water outside and press F to cast.' : 'You need to learn Fishing first.', !sc.save.skills.fishing);
      if (it.cat === 'key') return say('Nothing to do with that here.', true);
      sc.open(ADVUI.party(sc, i => { const r = sc.useBag(id, i); say(r.s, !r.ok); if (r.ok) { sc.close(); if (r.ev?.length) sc.open(ADVUI.grow(sc, r.ev)); } }, 'USE ' + it.name.toUpperCase() + ' ON...'));
    };
    return {
      update(dt) {
        const l = list(); if (INPUT.hit('TABL')) tab(-1); if (INPUT.hit('TABR')) tab(1);
        ADVUI.nav(st, l.length); if (okHit() && l[st.sel]) use(l[st.sel]); else if (backHit()) sc.close();
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), l = list(), rows = 9;
        text('BAG', X(660), Y(46), L(36), '#ffde3b', 'center', '#1a2a6c'); text(ADVUI.money(sc.save.money), X(1280), Y(46), L(22), '#ffde3b', 'right', null);
        ADVP.CATS.forEach(([k, n], i) => { const w = L(200), x = X(40) + i * (w + L(8)), on = i === st.cat; hot(x, Y(80), w, L(40), { click: () => { st.cat = i; st.sel = 0; st.off = 0; } }); rrect(x, Y(80), w, L(40), L(10), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2); text(n, x + w / 2, Y(101), L(16), on ? '#111' : '#fff', 'center', null); });
        ADVUI.scroll(st, l.length, rows);
        l.slice(st.off, st.off + rows).forEach((id, j) => {
          const i = j + st.off, y = Y(140) + j * L(64), on = i === st.sel, it = ADVP.item(id);
          hot(X(40), y, L(600), L(58), { hover: () => st.sel = i, click: () => { st.sel = i; use(id); }, wheel: d => st.sel = clamp(st.sel + d, 0, l.length - 1) });
          rrect(X(40), y, L(600), L(58), L(12), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
          ADVUI.icon(id, X(74), y + L(29), L(20)); text(it.name, X(112), y + L(29), L(20), on ? '#1a1a2a' : '#fff', 'left', null); text('x' + B_()[id], X(620), y + L(29), L(20), on ? '#1a1a2a' : '#ffde3b', 'right', null);
        });
        if (!l.length) { panel(X(40), Y(140), L(600), L(90)); text('Nothing here.', X(340), Y(185), L(20), '#9aa6c0', 'center', null); }
        panel(X(670), Y(140), L(610), L(300));
        const id = l[st.sel]; if (id) { const it = ADVP.item(id); ADVUI.icon(id, X(740), Y(230), L(44)); text(it.name, X(810), Y(206), L(26), '#fff', 'left', null); text('Owned: ' + B_()[id], X(810), Y(244), L(15), '#ffde3b', 'left', null); wrapText(it.info, X(700), Y(310), L(550), L(17), '#dde'); }
        if (st.note) text(st.note, X(975), Y(480), L(16), st.bad ? '#ff9a9a' : '#9f9', 'center', null);
        hint(INPUT.usingPad ? 'A use   LB/RB tab   B back' : 'Click or Enter to use   Q / E tab   Esc back'); backButton(() => sc.close());
      },
    };
  },

  // ---------- PC box ----------
  box(sc) {
    const st = { sel: 0, off: 0, note: '' }, bx = () => sc.save.box;
    const take = i => {
      if (sc.save.party.length >= 6) { st.note = 'Your party is full.'; return; }
      const [m] = bx().splice(i, 1); sc.save.party.push(m); st.note = ADVP.name(m) + ' joined your party.'; sc.refreshLead();
    };
    return {
      update() { ADVUI.nav(st, bx().length); if (okHit() && bx().length) take(st.sel); else if (backHit()) sc.close(); },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), b = bx(), rows = 8;
        text('PC BOX', X(660), Y(46), L(36), '#ffde3b', 'center', '#1a2a6c'); text(`${b.length} stored   party ${sc.save.party.length} / 6`, X(1280), Y(46), L(16), '#9aa6c0', 'right', null);
        ADVUI.scroll(st, b.length, rows);
        b.slice(st.off, st.off + rows).forEach((m, j) => {
          const i = j + st.off, y = Y(90) + j * L(78), on = i === st.sel, sp = DEX.species[toId(m.species)];
          hot(X(30), y, L(520), L(72), { hover: () => st.sel = i, click: () => { st.sel = i; take(i); }, wheel: d => st.sel = clamp(st.sel + d, 0, b.length - 1) });
          rrect(X(30), y, L(520), L(72), L(12), on ? '#ffde3b33' : '#0b1020cc', on ? '#ffde3b' : '#ffffff26', on ? 3 : 2);
          const im = portrait(sp.id); if (im) ctx.drawImage(im, X(38), y + L(4), L(64), L(64));
          text(ADVP.name(m), X(116), y + L(26), L(20), '#fff', 'left', null); text('Lv ' + m.level, X(536), y + L(26), L(17), '#ffde3b', 'right', null);
          const f = m.hp / ADVP.max(m); ADVUI.bar(X(116), y + L(44), L(200), L(12), f, ADVUI.hpCol(f));
        });
        if (!b.length) { panel(X(30), Y(90), L(520), L(150)); wrapText('The box is empty. Caught Pokemon go here when your party is full.', X(54), Y(150), L(472), L(17), '#9aa6c0'); }
        else ADVUI.summary(b[st.sel], X(580), Y(90), L(710), L(640));
        if (st.note) text(st.note, X(300), Y(740), L(15), '#9f9', 'center', null);
        hint(INPUT.usingPad ? 'A take into party   B back' : 'Click or Enter to take into the party   Esc back'); backButton(() => sc.close());
      },
    };
  },

  // ---------- level-up pages after a fight ----------
  // events: { t: 'msg', s } | { t: 'lv', s, from, to, before, after } | { t: 'learn', s, mv } | { t: 'forget', s, mv } | { t: 'evo', s, to }; done() runs when the last page closes
  grow(sc, events, done) {
    const ev = events.slice(), st = { e: null, t: 0, sel: 0, txt: '', fin: false };
    const next = () => {
      st.t = 0; st.sel = 0; st.e = ev.shift();
      if (!st.e) { sc.close(); if (done) done(); return; }
      const e = st.e, n = e.s && ADVP.name(e.s);
      st.txt = e.t === 'msg' ? e.s : e.t === 'lv' ? `${n} grew to Lv ${e.to}!` : e.t === 'learn' ? `${n} learned ${DEX.moves[e.mv].name}!`
        : e.t === 'forget' ? `${n} wants to learn ${DEX.moves[e.mv].name}, but already knows four moves. Forget one?` : `What? ${n} is evolving!`;
    };
    const finish = e => {
      if (e.t === 'evo') { const old = ADVP.name(e.s); ADVP.evolve(e.s, e.to); sc.refreshLead(); sc.warm(); ev.unshift({ t: 'msg', s: `Congratulations! ${old} evolved into ${DEX.species[e.to].name}!` }); }
    };
    next();
    return {
      update(dt) {
        const e = st.e; if (!e) return; st.t += dt;
        if (e.t === 'forget') {
          const n = 5; ADVUI.nav(st, n);
          if (okHit() || st.go) { st.go = false; if (st.sel < 4) { const old = DEX.moves[e.s.moves[st.sel]].name; ADVP.replace(e.s, st.sel, e.mv); ev.unshift({ t: 'msg', s: `${ADVP.name(e.s)} forgot ${old} and learned ${DEX.moves[e.mv].name}!` }); } else ev.unshift({ t: 'msg', s: `${ADVP.name(e.s)} did not learn ${DEX.moves[e.mv].name}.` }); next(); }
          return;
        }
        if (e.t === 'evo') {
          if (st.t > 0.3 && st.t < 3 && backHit()) { ev.unshift({ t: 'msg', s: `${ADVP.name(e.s)} stopped evolving.` }); return next(); }
          if (st.t > 3.4) { finish(e); next(); } return;
        }
        if (st.t > 0.25 && (okHit() || MOUSE.hit)) next();
      },
      draw() {
        const e = st.e; if (!e) return; const { X, Y, L } = layout();
        ctx.fillStyle = e.t === 'evo' ? '#000d' : '#0006'; ctx.fillRect(0, 0, VW, VH);
        if (e.t === 'evo') {
          const o = toId(e.s.species), a = portrait(o), b = portrait(e.to), k = st.t, fl = k > 0.8 && k < 3 ? Math.floor(k * (4 + k * 3)) % 2 : 0, sz = L(300);
          const im = k >= 3 ? b : fl ? b : a;
          if (im) { if (k > 0.8 && k < 3.1) { ctx.filter = 'brightness(8)'; } ctx.drawImage(im, VW / 2 - sz / 2, Y(160), sz, sz); ctx.filter = 'none'; }
          if (k > 2.9 && k < 3.4) { ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(k - 3.1) / 0.3})`; ctx.fillRect(0, 0, VW, VH); }
        } else if (e.t === 'lv') {
          const w = L(420), x = VW / 2 - w / 2; panel(x, Y(120), w, L(330), ADVP.name(e.s).toUpperCase(), `Lv ${e.from} to ${e.to}`);
          [['hp', 'HP'], ['atk', 'ATK'], ['def', 'DEF'], ['spa', 'SPA'], ['spd', 'SPD'], ['spe', 'SPE']].forEach(([k, n], i) => {
            text(n, x + L(40), Y(190) + i * L(40), L(20), '#fff', 'left', null); text(`${e.before[k]}  >  ${e.after[k]}`, x + L(250), Y(190) + i * L(40), L(20), '#9aa6c0', 'center', null); text('+' + (e.after[k] - e.before[k]), x + w - L(30), Y(190) + i * L(40), L(20), '#7be07b', 'right', null);
          });
        } else if (e.t === 'forget') {
          const w = L(520), x = VW / 2 - w / 2; panel(x, Y(120), w, L(380), 'FORGET WHICH MOVE?');
          for (let i = 0; i < 5; i++) {
            const y = Y(170) + i * L(58), on = st.sel === i; hot(x + L(20), y, w - L(40), L(50), { hover: () => st.sel = i, click: () => { st.sel = i; st.go = true; } });
            if (i < 4) { rrect(x + L(20), y, w - L(40), L(50), L(10), on ? '#ffde3b' : '#ffffff12', on ? '#fff' : '#ffffff22', 2); const mv = DEX.moves[e.s.moves[i]]; text(mv.name, x + L(40), y + L(25), L(19), on ? '#111' : '#fff', 'left', null); text(mv.type.toUpperCase(), x + w - L(40), y + L(25), L(12), on ? '#111' : TYPE_COLOR[mv.type], 'right', null, 'Silkscreen'); }
            else { rrect(x + L(20), y, w - L(40), L(50), L(10), on ? '#ffde3b' : '#ffffff12', on ? '#fff' : '#ffffff22', 2); text(`Do not learn ${DEX.moves[e.mv].name}`, x + w / 2, y + L(25), L(17), on ? '#111' : '#9aa6c0', 'center', null); }
          }
        }
        if (e.t !== 'forget' && e.t !== 'lv') {
          ADVUI.say(ADVUI.pages(st.txt)[0], 1e4, null, e.t !== 'evo');
          if (e.t === 'evo' && st.t < 3) ADVUI.notice(INPUT.usingPad ? 'B stops it' : 'Esc stops it');
        } else if (e.t === 'forget') ADVUI.say(ADVUI.pages(st.txt)[0], 1e4);
        else if (Math.floor(performance.now() / 400) % 2) text('>', X(1010), Y(420), L(22), '#ffde3b', 'center', null);
      },
    };
  },

  // ---------- the Mart ----------
  // Buy: the stock for your badge count; Sell: half the price of what you carry. Left / right sets the amount, A does it.
  shop(sc, mk) {   // mk = the Tradeway market (rare stock by the day, wild prices) instead of a Cherimart Mart
    const st = { mode: 0, sel: 0, off: 0, qty: 1, note: '', bad: false }, sv = () => sc.save, day = mk ? ADVP.day() : undefined;
    const list = () => st.mode === 1 ? (mk ? ADVP.marketList(day) : ADVP.stock(sv().badges)) : Object.keys(sv().bag).filter(id => ADVP.sellPrice(id) > 0).sort();
    const price = id => st.mode === 1 ? (mk ? ADVP.marketPrice(id, day) : ADVP.PRICE[id]) : ADVP.sellPrice(id);
    const maxQ = id => Math.max(1, Math.min(99, st.mode === 1 ? Math.floor(sv().money / price(id)) : sv().bag[id] | 0));
    const pick = m => { st.mode = m; st.sel = 0; st.off = 0; st.qty = 1; st.note = ''; };
    const go = () => { const id = list()[st.sel]; if (!id) return; const r = st.mode === 1 ? ADVP.buy(sv(), id, st.qty, day) : ADVP.sell(sv(), id, st.qty); st.note = r.s; st.bad = !r.ok; uiBlip(r.ok ? 880 : 300, 0.05); if (r.ok) sc.persist(); st.sel = clamp(st.sel, 0, Math.max(0, list().length - 1)); st.qty = 1; };
    const top = [{ label: 'Buy', act: () => pick(1) }, { label: 'Sell', act: () => pick(2) }, { label: 'Leave', act: () => sc.close() }];
    const q = d => { const id = list()[st.sel]; if (id) { st.qty = clamp(st.qty + d, 1, maxQ(id)); uiBlip(700, 0.03); } };
    return {
      update(dt) {
        if (!st.mode) { runMenu(st, top, dt); if (backHit()) sc.close(); return; }
        const l = list(); ADVUI.nav(st, l.length);
        if (INPUT.menu === 'left') q(-1); if (INPUT.menu === 'right') q(1);
        if (okHit() && l.length) go(); else if (backHit()) pick(0);
        if (l[st.sel]) st.qty = clamp(st.qty, 1, maxQ(l[st.sel]));
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout();
        text(mk ? 'TRADEWAY MARKET' : 'POKEMON MART', X(660), Y(46), L(36), '#ffde3b', 'center', mk ? '#5a2a10' : '#1a2a6c'); text(ADVUI.money(sv().money), X(1280), Y(46), L(24), '#ffde3b', 'right', null);
        if (!st.mode) { panel(X(380), Y(110), L(560), L(104)); wrapText(mk ? 'What are you after today? Mind, it will not be here next week.' : 'Welcome! What can I do for you?', X(410), mk ? Y(148) : Y(162), L(500), L(20), '#fff'); drawMenu(top, st, X(660), Y(250), L(560), 62); hint(INPUT.usingPad ? 'A select   B leave' : 'Click to select   Esc leave'); backButton(() => sc.close()); return; }
        const l = list(), rows = 9; ADVUI.scroll(st, l.length, rows);
        text(st.mode === 1 ? 'BUY' : 'SELL', X(40), Y(100), L(22), '#9aa6c0', 'left', null);
        l.slice(st.off, st.off + rows).forEach((id, j) => {
          const i = j + st.off, y = Y(120) + j * L(64), on = i === st.sel, it = ADVP.item(id);
          hot(X(40), y, L(600), L(58), { hover: () => st.sel = i, click: () => { st.sel = i; go(); }, wheel: d => st.sel = clamp(st.sel + d, 0, l.length - 1) });
          rrect(X(40), y, L(600), L(58), L(12), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
          ADVUI.icon(id, X(74), y + L(29), L(20)); text(it.name, X(112), y + L(29), L(20), on ? '#1a1a2a' : '#fff', 'left', null);
          text(ADVUI.money(price(id)), X(620), y + L(29), L(20), on ? '#1a1a2a' : '#ffde3b', 'right', null);
        });
        if (!l.length) text('Nothing to sell.', X(340), Y(220), L(20), '#9aa6c0', 'center', null);
        panel(X(670), Y(120), L(610), L(300)); const id = l[st.sel];
        if (id) {
          const it = ADVP.item(id); ADVUI.icon(id, X(740), Y(210), L(44)); text(it.name, X(810), Y(186), L(26), '#fff', 'left', null); text('Owned: ' + (sv().bag[id] | 0), X(810), Y(224), L(15), '#ffde3b', 'left', null);
          wrapText(it.info, X(700), Y(290), L(550), L(17), '#dde');
          text(`< ${st.qty} >   ${ADVUI.money(price(id) * st.qty)}`, X(975), Y(390), L(26), '#fff', 'center', null);
        }
        if (st.mode === 1 && mk) text('Stock and prices change every day.', X(975), Y(450), L(13), '#9aa6c0', 'center', null);
        else if (st.mode === 1 && sv().badges < 7) text(`Better stock arrives with more badges (you have ${sv().badges}).`, X(975), Y(450), L(13), '#9aa6c0', 'center', null);
        if (st.note) text(st.note, X(975), Y(490), L(16), st.bad ? '#ff9a9a' : '#9f9', 'center', null);
        hint(INPUT.usingPad ? 'A do it   left / right amount   B back' : 'Enter or click to do it   left / right amount   Esc back'); backButton(() => pick(0));
      },
    };
  },

  // ---------- Tradeway barter: three swaps a day, goods for goods; A does the one under the cursor ----------
  barter(sc) {
    const st = { sel: 0, off: 0, note: '', bad: false }, sv = () => sc.save, day = ADVP.day(), offers = () => ADVP.barterOffers(day);
    const go = () => { const r = ADVP.swap(sv(), st.sel, day); st.note = r.s; st.bad = !r.ok; uiBlip(r.ok ? 880 : 300, 0.05); if (r.ok) sc.persist(); };
    return {
      update() { ADVUI.nav(st, offers().length); if (okHit()) go(); else if (backHit()) sc.close(); },
      draw() {
        bgFill('#2a1c12', '#3a2a18'); const { X, Y, L } = layout();
        text('TRADEWAY BARTER', X(660), Y(46), L(36), '#ffde3b', 'center', '#5a2a10'); text('Goods for goods. Three swaps today, a different three tomorrow.', X(660), Y(104), L(17), '#dde', 'center', null);
        offers().forEach((o, i) => {
          const y = Y(160) + i * L(110), on = i === st.sel, [g, gn] = o.give, [t, tn] = o.get, have = sv().bag[g] | 0, fg = on ? '#1a1a2a' : '#fff';
          hot(X(120), y, L(1080), L(96), { hover: () => st.sel = i, click: () => { st.sel = i; go(); } });
          rrect(X(120), y, L(1080), L(96), L(14), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
          ADVUI.icon(g, X(190), y + L(48), L(24)); text(`${ADVP.item(g).name} x${gn}`, X(235), y + L(34), L(22), fg, 'left', null); text(`You have ${have}`, X(235), y + L(68), L(14), have >= gn ? (on ? '#1a5a2a' : '#9f9') : (on ? '#8a1a1a' : '#ff9a9a'), 'left', null);
          text('>', X(660), y + L(48), L(34), fg, 'center', null);
          ADVUI.icon(t, X(760), y + L(48), L(24)); text(`${ADVP.item(t).name} x${tn}`, X(805), y + L(48), L(22), fg, 'left', null);
        });
        if (st.note) text(st.note, X(660), Y(520), L(18), st.bad ? '#ff9a9a' : '#9f9', 'center', null);
        hint(INPUT.usingPad ? 'A swap   B leave' : 'Enter or click to swap   Esc leave'); backButton(() => sc.close());
      },
    };
  },

  // ---------- trainer name card ----------
  // before a trainer or leader fight: the two portraits slide in over speed lines, VS, the class and the name; A skips after a moment
  card(sc, n, done) {
    const t = n.def.trainer, st = { t: 0 }, who = t.name.toUpperCase();
    return {
      update(dt) { st.t += dt; if (st.t > 2.6 || (st.t > 0.8 && (okHit() || MOUSE.hit))) { sc.close(); done(); } },
      draw() {
        const { X, Y, L } = layout(), k = Math.min(1, st.t / 0.5), e = 1 - (1 - k) * (1 - k), f = Math.min(1, st.t / 0.2), lead = !!t.leader;
        ctx.fillStyle = `rgba(8,12,28,${0.86 * f})`; ctx.fillRect(0, 0, VW, VH);
        ctx.save(); ctx.globalAlpha = 0.2 * f; ctx.fillStyle = lead ? '#ffde3b' : '#9ab';
        for (let i = 0; i < 22; i++) ctx.fillRect(X(((st.t * 1100 + i * 223) % 1800) - 400), Y((i * 83) % 800), L(240 + (i % 3) * 80), L(3));
        ctx.restore();
        ctx.fillStyle = lead ? '#c8921a' : '#2a4a8a'; ctx.fillRect(0, Y(300) + L(40) * (1 - e), VW * e, L(200));
        avatarTile(sc.save.avatar, X(260 - (1 - e) * 800), Y(235), L(260), '#7be07b'); avatarTile(t.avatar || ADVN.avatar(t), X(800 + (1 - e) * 800), Y(235), L(260), '#ff7b7b');
        text('VS', X(660), Y(365), L(76 + (1 - e) * 40), '#fff', 'center', '#1a2a6c');
        text(sc.save.name.toUpperCase(), X(390 - (1 - e) * 800), Y(530), L(24), '#fff', 'center', null);
        ctx.globalAlpha = e; text(t.cls.toUpperCase(), X(930), Y(530), L(18), lead ? '#ffde3b' : '#9aa6c0', 'center', null); text(who, X(930), Y(566), L(34), '#fff', 'center', '#1a2a6c'); ctx.globalAlpha = 1;
        if (st.t > 0.8) hint(INPUT.usingPad ? 'A skip' : 'Enter or click to skip');
      },
    };
  },

  // ---------- battle item wheel ----------
  // sc.wh = { sel }; the sim runs in slow motion while it is open (adv-scene.js), and side.itemWheel makes playerIntent stand still (battle.js hook)
  wheelItems(sc) { return Object.keys(sc.save.bag).filter(id => { const it = ADVP.item(id); return it.ball || it.heal || it.cure || it.revive; }).sort((a, b) => ADVP.item(a).cat.localeCompare(ADVP.item(b).cat)); },
  wheelUpdate(sc, dt) {
    const w = sc.wh, its = this.wheelItems(sc), n = its.length;
    if (!n) { sc.wh = null; return; }
    w.sel = clamp(w.sel, 0, n - 1);
    if (INPUT.menu === 'left' || INPUT.menu === 'up') { w.sel = (w.sel + n - 1) % n; uiBlip(600, 0.03); }
    if (INPUT.menu === 'right' || INPUT.menu === 'down') { w.sel = (w.sel + 1) % n; uiBlip(600, 0.03); }
    for (let k = 1; k <= Math.min(6, n); k++) if (INPUT.hit('S' + k)) { w.sel = k - 1; return sc.useItem(its[w.sel]); }
    if (okHit()) sc.useItem(its[w.sel]);
    if (INPUT.hit('BACKK') || sc.cHit || INPUT.hit('Y')) sc.wh = null;
  },
  wheelDraw(sc) {
    const its = this.wheelItems(sc), n = its.length, w = sc.wh; if (!n || !w) return;
    const { L } = layout(), cx = VW / 2, cy = VH / 2 + L(10), R = L(190), cd = sc.itemCd > 0;
    ctx.fillStyle = '#0006'; ctx.fillRect(0, 0, VW, VH);
    ctx.beginPath(); ctx.arc(cx, cy, R + L(80), 0, 6.283); ctx.fillStyle = '#0b1020cc'; ctx.fill();
    its.forEach((id, k) => {
      const a = -Math.PI / 2 + k * Math.PI * 2 / n, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, on = k === w.sel, r = L(40);
      hot(x - r - 6, y - r - 6, (r + 6) * 2, (r + 6) * 2, { hover: () => w.sel = k, click: () => { w.sel = k; sc.useItem(id); } });
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = on ? '#ffde3b' : '#ffffff22'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = on ? '#fff' : '#ffffff55'; ctx.stroke();
      ctx.globalAlpha = cd ? 0.45 : 1; this.icon(id, x, y - L(4), L(24)); ctx.globalAlpha = 1;
      text('x' + sc.save.bag[id], x, y + r - L(6), L(14), on ? '#111' : '#ffde3b', 'center', null);
      if (k < 6) text(String(k + 1), x - r + L(8), y - r + L(8), L(11), on ? '#111' : '#9aa6c0', 'center', null, 'Silkscreen');
    });
    const sel = its[w.sel]; if (sel) {
      const it = ADVP.item(sel); text(it.name, cx, cy - L(18), L(24), '#fff', 'center'); text(cd ? `Ready in ${Math.ceil(sc.itemCd)}` : it.info, cx, cy + L(16), L(13), cd ? '#ff9a9a' : '#9aa6c0', 'center', null);
    }
    hint(INPUT.usingPad ? 'D-pad pick   A use   B close' : 'Click or 1-6 to use   C or Esc close');
  },
};
