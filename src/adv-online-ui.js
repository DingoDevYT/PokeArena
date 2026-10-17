// Adventure online screens: how to play (online / server list / friend / offline), the server list, player menu, profile card, trade, yes-no prompts.
// Same screen contract as adv-ui.js: { update(dt), draw(), enter?(), exit?() } on AdventureScene's stack.
'use strict';
Object.assign(ADVUI, {
  // after a save is chosen: how do you want to play it
  mode(sc, save) {
    const st = { sel: 0 }, items = () => [
      { label: 'Play Online', act: () => sc.go(save, { kind: 'auto' }) },
      { label: 'Server List', act: () => sc.open(ADVUI.servers(sc, save)) },
      { label: 'Join Friend', act: () => sc.open(ADVUI.friend(sc, save)) },
      { label: 'Offline', act: () => sc.go(save, { kind: 'off' }) },
      { label: 'Back', act: () => sc.close() },
    ];
    return {
      update(dt) { runMenu(st, items(), dt); if (backHit()) sc.close(); },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), s = S();
        text('HOW TO PLAY', VW / 2, 90 * s, 50 * s, '#ffde3b', 'center', '#1a2a6c');
        text(`${save.name}   ${save.party.length} Pokemon   ${save.badges} badges`, VW / 2, 140 * s, 18 * s, '#9aa6c0', 'center', null);
        drawMenu(items(), st, VW / 2, 190 * s, 520 * s, 64);
        const hintS = ['Joins the fullest server with room, or starts one', 'Pick a server and see who is on it', 'Type a friend\'s trainer name to find their server', 'No network, just you'][st.sel];
        if (hintS) text(hintS, VW / 2, 190 * s + 5 * 64 * s + 20 * s, 15 * s, '#9aa6c0', 'center', null);
        hint(INPUT.usingPad ? 'A select   B back' : 'Click to select   Esc back'); backButton(() => sc.close());
      },
    };
  },
  servers(sc, save) {
    const st = { sel: 0, off: 0, tick: 0 }, sv = ADVPEER.servers(() => {}), rows = 7;
    return {
      exit() { sv.close(); },
      update(dt) {
        const l = sv.list(); ADVUI.scroll(st, l.length, rows); ADVUI.nav(st, l.length);
        if (okHit() && l[st.sel]) { sv.close(); sc.go(save, { kind: 'server', entry: l[st.sel] }); }
        else if (backHit()) sc.close();
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), l = sv.list();
        text('SERVER LIST', X(660), Y(50), L(40), '#ffde3b', 'center', '#1a2a6c');
        panel(X(160), Y(100), L(1000), L(620), 'SERVERS', sv.status ? '' : l.length + ' OPEN');
        if (!l.length) text(sv.status || 'No servers right now. Pick Play Online to start one.', X(660), Y(400), L(18), '#aab4c8', 'center', null);
        l.slice(st.off, st.off + rows).forEach((e, j) => {
          const i = j + st.off, y = Y(140) + j * L(78), on = i === st.sel;
          hot(X(180), y, L(960), L(70), { hover: () => st.sel = i, click: () => { st.sel = i; sv.close(); sc.go(save, { kind: 'server', entry: e }); }, wheel: d => st.sel = clamp(st.sel + d, 0, l.length - 1) });
          rrect(X(180), y, L(960), L(70), L(12), on ? '#ffde3b' : '#ffffff12', on ? '#fff' : '#ffffff33', 2);
          text(e.name, X(204), y + L(26), L(22), on ? '#1a1a2a' : '#fff', 'left', null);
          text(e.players.slice(0, 5).join(', ') + (e.players.length > 5 ? '...' : ''), X(204), y + L(53), L(12), on ? '#333' : '#9aa6c0', 'left', null, 'Silkscreen');
          text(`${e.n} / ${e.max}`, X(1116), y + L(35), L(24), e.n >= e.max ? '#ff8a8a' : on ? '#1a1a2a' : '#7be07b', 'right', null);
        });
        hint(INPUT.usingPad ? 'A join   B back' : 'Click a server   Esc back'); backButton(() => sc.close());
      },
    };
  },
  // type a trainer name, find the server that lists them
  friend(sc, save) {
    const st = { q: '', ate: false }, sv = ADVPEER.servers(() => {}), note = { s: '' };
    const keys = searchKeys(st, () => { note.s = ''; });
    const go = () => {
      const n = st.q.trim().toLowerCase(), e = sv.list().find(x => x.players.some(p => p.toLowerCase() === n));
      if (e) { sv.close(); sc.go(save, { kind: 'server', entry: e }); } else note.s = n ? 'No server lists ' + st.q.trim() + (sv.status ? '. ' + sv.status : '.') : 'Type a name first.';
    };
    const onKey = e => { if (e.key === 'Enter') go(); };
    return {
      enter() { window.addEventListener('keydown', keys); window.addEventListener('keydown', onKey); },
      exit() { window.removeEventListener('keydown', keys); window.removeEventListener('keydown', onKey); sv.close(); },
      update() { if (okHit() && !st.ate && INPUT.usingPad) go(); else if (backHit() && !st.ate) sc.close(); st.ate = false; },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout();
        text('JOIN FRIEND', X(660), Y(80), L(44), '#ffde3b', 'center', '#1a2a6c');
        text('Type their trainer name and press Enter', X(660), Y(150), L(18), '#9aa6c0', 'center', null);
        searchBox(X(410), Y(190), L(500), L(54), st.q, 'Trainer name');
        text(sv.status || `${sv.list().length} servers listed`, X(660), Y(290), L(14), '#9aa6c0', 'center', null, 'Silkscreen');
        if (note.s) text(note.s, X(660), Y(340), L(18), '#ff9a9a', 'center', null);
        hint(INPUT.usingPad ? 'A find   B back' : 'Type a name   Enter find   Esc back'); backButton(() => sc.close());
      },
    };
  },
  // a yes / no question; the screen closes first, then runs the answer
  ask(sc, line, yes, no) {
    const st = { sel: 0 }, items = () => [{ label: 'Accept', act: () => { sc.close(); yes(); } }, { label: 'Decline', act: () => { sc.close(); no(); } }];
    return {
      update(dt) { runMenu(st, items(), dt); if (backHit()) { sc.close(); no(); } },
      draw() {
        ADVUI.choice(line, items(), st);
      },
    };
  },
  // walk up to a player, A / E
  player(sc, v) {
    const st = { sel: 0 }, N = () => sc.net.N, r = () => N().roster.get(v.pid);
    const items = () => [
      { label: 'Challenge', act: () => { sc.close(); sc.pvpAsk(v); } },
      { label: 'Trade', act: () => { sc.close(); sc.tradeAsk(v); } },
      { label: 'Profile', act: () => sc.open(ADVUI.profile(sc, v)) },
      { label: 'Back', act: () => sc.close() },
    ];
    return {
      update(dt) { if (!r()) return sc.close(); runMenu(st, items(), dt); if (backHit()) sc.close(); },
      draw() {
        ctx.fillStyle = '#000b'; ctx.fillRect(0, 0, VW, VH); const { X, Y, L } = layout(), p = r() || {};
        text((p.name || '').toUpperCase(), VW / 2, Y(90), L(40), '#ffde3b', 'center', '#1a2a6c');
        drawMenu(items(), st, VW / 2, Y(150), L(460), 62);
        hint(INPUT.usingPad ? 'A select   B back' : 'Click to select   Esc back');
      },
    };
  },
  profile(sc, v) {
    const N = () => sc.net.N;
    return {
      update() { if (okHit() || backHit()) sc.close(); },
      draw() {
        ctx.fillStyle = '#000b'; ctx.fillRect(0, 0, VW, VH); const { X, Y, L } = layout(), p = N().roster.get(v.pid) || {};
        panel(X(380), Y(160), L(560), L(340), 'TRAINER');
        avatarTile(cleanAvatar(p.av) || AVATAR_DEFAULT, X(410), Y(210), L(150), '#ffde3b');
        text(p.name || '?', X(590), Y(250), L(30), '#fff', 'left', null);
        text(`${p.b | 0} badges`, X(590), Y(292), L(18), '#ffde3b', 'left', null);
        const sp = DEX.species[p.lead]; if (sp) { text('Leads with ' + sp.name, X(590), Y(330), L(15), '#9aa6c0', 'left', null); const im = portrait(sp.id); if (im) ctx.drawImage(im, X(590), Y(350), L(100), L(100)); }
        hint(INPUT.usingPad ? 'A / B back' : 'Enter / Esc back');
      },
    };
  },
  // both pick a mon, both confirm, both confirm again; adv-net.js holds the state (sc.net.N.tr)
  trade(sc) {
    const st = { sel: 0, off: 0 }, N = () => sc.net.N, P = () => sc.save.party, T = () => N().tr;
    const offer = i => { const m = P()[i]; return { species: m.species, level: m.level, moves: m.moves, ability: m.ability, item: m.item, nature: m.nature, status: m.status || '', exp: m.exp | 0, friend: m.friend | 0, ball: m.ball, nickname: m.nickname || '', ot: m.ot || '', hp: Math.max(0, Math.round(m.hp)) }; };
    const rows = () => P().length + 2;   // the party, then CONFIRM and CANCEL
    const act = () => {
      const n = P().length, tr = T(); if (!tr) return;
      if (st.sel < n) N().trade.pick(st.sel, offer(st.sel));
      else if (st.sel === n) N().trade.confirm();
      else { N().trade.cancel(); sc.close(); }
    };
    return {
      isTrade: true,
      update() {
        if (!T()) return sc.close();
        ADVUI.nav(st, rows()); if (okHit()) act(); else if (backHit()) { N().trade.cancel(); sc.close(); }
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), tr = T(); if (!tr) return;
        const other = [...N().roster.values()].find(r => r.peer === tr.peer) || {};
        text('TRADE WITH ' + String(other.name || '?').toUpperCase(), X(660), Y(46), L(34), '#ffde3b', 'center', '#1a2a6c');
        panel(X(30), Y(90), L(600), L(640), 'YOUR POKEMON', tr.mine ? 'OFFERING SLOT ' + (tr.mine.i + 1) : 'PICK ONE');
        P().forEach((m, i) => {
          const y = Y(130) + i * L(84), on = i === st.sel, off = tr.mine && tr.mine.i === i;
          hot(X(50), y, L(560), L(76), { hover: () => st.sel = i, click: () => { st.sel = i; act(); } });
          rrect(X(50), y, L(560), L(76), L(12), off ? '#7fd0e866' : on ? '#ffde3b33' : '#ffffff10', on ? '#ffde3b' : '#ffffff33', on ? 3 : 2);
          const im = portrait(toId(m.species)); if (im) ctx.drawImage(im, X(56), y + L(6), L(64), L(64));
          text(ADVP.name(m), X(132), y + L(28), L(20), '#fff', 'left', null); text('Lv ' + m.level, X(600), y + L(28), L(16), '#ffde3b', 'right', null);
          text(off ? 'OFFERED' : '', X(600), y + L(54), L(12), '#7fd0e8', 'right', null, 'Silkscreen');
        });
        const n = P().length;
        [['CONFIRM', n], ['CANCEL', n + 1]].forEach(([l, i], k) => {
          const x = X(50 + k * 290), y = Y(130) + 6 * L(84) + L(4), on = st.sel === i;
          hot(x, y, L(270), L(44), { hover: () => st.sel = i, click: () => { st.sel = i; act(); } });
          rrect(x, y, L(270), L(44), L(10), on ? '#ffde3b' : '#ffffff18', '#fff', 2); text(l, x + L(135), y + L(23), L(17), on ? '#111' : '#fff', 'center', null);
        });
        panel(X(660), Y(90), L(630), L(450), (String(other.name || 'THEY').toUpperCase()) + ' OFFERS');
        const t = tr.theirs;
        if (t) {
          const sp = DEX.species[t.species], im = portrait(t.species);
          if (im) ctx.drawImage(im, X(690), Y(140), L(170), L(170));
          text(sp ? sp.name : t.species, X(880), Y(180), L(30), '#fff', 'left', null); text('Lv ' + t.level, X(880), Y(220), L(20), '#ffde3b', 'left', null);
          text('OT ' + (t.ot || '?'), X(880), Y(254), L(14), '#9aa6c0', 'left', null);
          t.moves.forEach((mv, i) => ADVUI.moveRow(mv, X(690), Y(330) + i * L(46), L(570), L(40)));
        } else text('Waiting for their offer...', X(975), Y(300), L(20), '#aab4c8', 'center', null);
        const line = tr.st === 'final' ? (tr.c2[0] ? 'Waiting for them to confirm the trade...' : 'FINAL CHECK. Confirm again to trade.')
          : !tr.mine ? 'Pick a Pokemon to offer.' : !t ? 'Waiting for their offer...' : tr.c1[0] ? 'Waiting for them to confirm...' : tr.c1[1] ? 'They confirmed. Your turn.' : 'Both offers are in. Press CONFIRM.';
        panel(X(660), Y(556), L(630), L(174));
        text(line, X(975), Y(620), L(20), '#fff', 'center', null);
        text(tr.mine && t ? `${ADVP.name(P()[tr.mine.i])}  for  ${DEX.species[t.species]?.name || t.species}` : '', X(975), Y(670), L(16), '#ffde3b', 'center', null);
        text('Changing an offer cancels both confirmations.', X(975), Y(705), L(12), '#9aa6c0', 'center', null, 'Silkscreen');
        hint(INPUT.usingPad ? 'A pick / confirm   B cancel' : 'Click or Enter   Esc cancel');
      },
    };
  },
});
