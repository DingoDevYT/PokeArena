// Adventure test panel (F9, or Test in the pause menu): money, Pokemon, items, heal, levels, skills, badges, time, weather, no wild fights, warp to a town.
// A playtest tool only: the game's own rule is no teleporting (docs/TRAVEL.md), so the warp lives here and nowhere else. Every change goes through the normal functions (ADVP.mon, ADVP.add, ADVP.heal, ADVP.teach)
// and is saved at once. The actions below are pure over a save so tools/adv-check.mjs runs them; the screens are at the bottom.
'use strict';
const ADVDBG = {
  lv: 30, count: 1, noWild: false, note: { s: '', bad: false }, _k: false,
  COUNTS: [1, 5, 10, 25, 50, 99],
  TIMES: [['Real clock', null], ['Dawn 6:00', 6], ['Noon 12:00', 12], ['Dusk 19:00', 19], ['Night 23:00', 23]],
  WEATHER: [['Auto', null], ['Clear', ''], ['Cloudy', 'cloudy'], ['Rain', 'rain'], ['Storm', 'storm'], ['Fog', 'fog'], ['Snow', 'snow'], ['Sand', 'sand']],   // ADVW.weather pins ADVWX (src/adv-weather.js); null = each zone rolls its own
  // F9 edge, called once a frame by the scene
  hit() { const k = !!KEYS.F9, h = k && !this._k; this._k = k; return h; },
  // a guest plays in the host's world: the host decides what exists, so nothing here may change a guest's save
  guest: sc => !!(sc.net && sc.net.N && sc.net.N.role === 'guest'),

  // ---------- actions (save in, text out) ----------
  money(sv, n) { sv.money = Math.max(0, Math.min(9999999, Math.round(+n || 0))); return 'Money is $' + sv.money + '.'; },
  giveMon(sv, id, lv) {
    const m = ADVP.mon(id, Math.max(1, Math.min(100, lv | 0)), { ot: sv.name }), toBox = sv.party.length >= 6;
    (toBox ? sv.box : sv.party).push(m);
    return (toBox ? 'Party full: ' : 'Added ') + ADVP.name(m) + ' Lv ' + m.level + (toBox ? ' went to the PC box.' : ' to the party.');
  },
  giveItem(sv, id, n) { sv.bag[id] = Math.min(999, (sv.bag[id] | 0) + n); return 'Gave ' + n + ' ' + ADVP.item(id).name + '.'; },
  healAll(sv) { sv.party.forEach(m => ADVP.heal(m)); return 'The party is fully healed.'; },
  // sets m to level lv (keeps the HP fraction, learns free-slot level moves on the way up)
  setLevel(m, lv) {
    lv = Math.max(1, Math.min(100, lv | 0)); const from = m.level, old = ADVP.max(m);
    m.level = lv; m.exp = ADVP.expFor(ADVP.rate(m.species), lv); ADVP.rescale(m, old);
    for (let l = from + 1; l <= lv; l++) for (const mv of ADVP.learnAt(m, l)) if (m.moves.length < 4) ADVP.learn(m, mv);
    return ADVP.name(m) + ' is Lv ' + lv + '.';
  },
  friendship(sv) { sv.party.forEach(m => m.friend = 255); return 'Everyone in the party loves you (255).'; },
  skill(sv, id, on) {
    if (on) { ADVP.teach(sv, id); return 'Learned ' + ADVP.SKILLS[id].name + '.'; }
    delete sv.skills[id]; return 'Forgot ' + ADVP.SKILLS[id].name + '.';
  },
  allSkills(sv, on) { for (const id of Object.keys(ADVP.SKILLS)) if (on) ADVP.teach(sv, id); else delete sv.skills[id]; return on ? 'Learned every skill.' : 'Forgot every skill.'; },
  badges(sv, n) { n = Math.max(0, Math.min(8, n | 0)); sv.badges = n; sv.medals = (sv.medals || []).slice(0, n); while (sv.medals.length < n) sv.medals.push('Test badge ' + (sv.medals.length + 1)); return n + ' badges.'; },
  setNoWild(on) {
    const W = ADVW;
    if (on) { this._g ||= W.grass; this._c ||= W.CAP; W.CAP = 0; W.grass = () => null; W.groups = []; }
    else if (this._g) { W.grass = this._g; W.CAP = this._c; this._g = this._c = 0; }
    this.noWild = !!on;
  },
  hour: () => ADVW.hourSet,
  timeIdx() { return this.TIMES.findIndex(t => t[1] === ADVW.hourSet); },
  wxIdx() { return Math.max(0, this.WEATHER.findIndex(w => w[1] === (ADVW.weather ?? null))); },
  // every item id: the bag table, the evolution stones, then a TM for each move
  items(cat) {
    if (cat === 'tm') return Object.keys(DEX.moves).filter(id => DEX.moves[id].name && !DEX.moves[id].banned).sort((a, b) => DEX.moves[a].name.localeCompare(DEX.moves[b].name)).map(id => 'tm_' + id);
    return [...Object.keys(ADVP.ITEMS), ...ADVP.STONES].filter(id => ADVP.item(id).cat === cat);
  },
  // the species the picker offers: one per dex number, plus the form the team builder lists
  species() {
    if (this._sp) return this._sp;
    const base = {}; for (const id in DEX.species) { const n = DEX.species[id].num; if (n > 0 && id !== 'flowery' && (!base[n] || id.length < base[n].length)) base[n] = id; }
    return this._sp = [...Object.values(base), 'toxtricitylowkey'].filter(id => DEX.species[id] && SPRITES[DEX.species[id].sprite]).sort((a, b) => DEX.species[a].num - DEX.species[b].num);
  },

  // ---------- screens ----------
  say(s, bad) { this.note = { s, bad: !!bad }; },
  // runs an action on the save, then saves (a lead change refreshes the follower)
  run(sc, f) { const s = f(sc.save); sc.refreshLead(); sc.persist(); this.say(s); },

  // the grid of species with a name search, generation tabs (Tab / LT / RT) and the hidden "jarona" Flowery unlock
  speciesPicker(sc) {
    const all = ADVDBG.species(), st = { sel: 0, off: 0, tab: 0, q: '', ate: false, list: all };
    const refilter = () => {
      const q = toId(st.q), hit = all.filter(id => (!st.tab || GEN_OF(DEX.species[id].num) === st.tab) && toId(DEX.species[id].name).includes(q));
      if (q === 'jarona' && DEX.species.flowery) { st.list = ['flowery']; st.sel = 0; return; }
      st.list = q ? [...hit.filter(id => toId(DEX.species[id].name).startsWith(q)), ...hit.filter(id => !toId(DEX.species[id].name).startsWith(q))] : hit; st.sel = 0;
    };
    const tab = t => { st.tab = (t + 10) % 10; refilter(); uiBlip(700, 0.03); };
    const type = searchKeys(st, refilter), keys = e => { if (e.key === 'Tab') { tab(st.tab + (e.shiftKey ? -1 : 1)); st.ate = true; } else type(e); };
    const cols = () => Math.max(4, Math.floor((VW - 80) / (84 * S()))), rows = () => Math.max(1, Math.floor((VH - 250 * S()) / (84 * S())));
    const pick = id => { if (!id) return; ADVDBG.run(sc, sv => ADVDBG.giveMon(sv, id, ADVDBG.lv)); sc.close(); };
    return {
      st,
      enter() { window.addEventListener('keydown', keys); }, exit() { window.removeEventListener('keydown', keys); },
      update() {
        const n = st.list.length, c = cols(), last = Math.max(0, n - 1), dir = navDir();
        if (dir === 'left') st.sel = Math.max(0, st.sel - 1); if (dir === 'right') st.sel = Math.min(last, st.sel + 1);
        if (dir === 'up') st.sel = Math.max(0, st.sel - c); if (dir === 'down') st.sel = Math.min(last, st.sel + c);
        if (INPUT.hit('TABL') && !KEYS.KeyQ) st.sel = Math.max(0, st.sel - c * rows()); if (INPUT.hit('TABR') && !KEYS.KeyE) st.sel = Math.min(last, st.sel + c * rows());
        if (INPUT.hit('LT')) tab(st.tab - 1); if (INPUT.hit('RT')) tab(st.tab + 1);
        st.sel = clamp(st.sel, 0, last);
        if (okHit() && !st.ate) pick(st.list[st.sel]); else if (backHit() && !st.ate) sc.close();
        st.ate = false;
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const s = S(), sz = 84 * s, ids = st.list, c = cols(), r = rows(), y0 = 150 * s;
        text('GIVE A POKEMON', VW / 2, 30 * s, 30 * s, '#ffde3b', 'center', '#1a2a6c');
        const tw = 86 * s, tx0 = VW / 2 - tw * 5;
        for (let t = 0; t < 10; t++) { const x = tx0 + t * tw, on = t === st.tab; hot(x, 52 * s, tw - 6 * s, 28 * s, { click: () => tab(t) }); rrect(x, 52 * s, tw - 6 * s, 28 * s, 8 * s, on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2); text(t ? 'GEN ' + t : 'ALL', x + (tw - 6 * s) / 2, 67 * s, 12 * s, on ? '#111' : '#fff', 'center', null); }
        text(`Level ${ADVDBG.lv}   goes to the ${sc.save.party.length >= 6 ? 'PC box (party full)' : 'party'}`, VW / 2, 98 * s, 14 * s, '#9aa6c0', 'center', null);
        searchBox(VW / 2 - 300 * s, 110 * s, 600 * s, 34 * s, st.q, 'Type a name to search'); text(`${ids.length} shown`, VW / 2 + 286 * s, 127 * s, 12 * s, '#9ab', 'right', null);
        const row = Math.floor(st.sel / c), mo = Math.max(0, Math.ceil(ids.length / c) - r); st.off = clamp(row < (st.off | 0) ? row : row >= (st.off | 0) + r ? row - r + 1 : (st.off | 0), 0, mo);
        hot(40, y0, c * sz, r * sz, { wheel: d => st.off = clamp(st.off + d, 0, mo) });
        for (let i = st.off * c; i < Math.min(ids.length, (st.off + r) * c); i++) {
          const x = 40 + (i % c) * sz, y = y0 + (Math.floor(i / c) - st.off) * sz, on = i === st.sel, sp = DEX.species[ids[i]];
          hot(x, y, sz - 6, sz - 6, { hover: () => st.sel = i, click: () => { st.sel = i; pick(ids[i]); } });
          rrect(x, y, sz - 6, sz - 6, 10 * s, on ? '#ffde3b' : '#ffffff12');
          const im = portrait(ids[i]); if (im) ctx.drawImage(im, x + 12 * s, y + 2 * s, sz - 30 * s, sz - 30 * s);
          text(sp.name.length > 11 ? sp.name.slice(0, 10) + '.' : sp.name, x + (sz - 6) / 2, y + sz - 17 * s, 10 * s, on ? '#111' : '#dde', 'center', null, 'Silkscreen');
        }
        const id = ids[st.sel];
        if (id) { const sp = DEX.species[id], y = y0 + r * sz + 8 * s; text(`#${sp.num} ${sp.name.toUpperCase()}`, 40, y + 12 * s, 20 * s, '#fff', 'left'); let cx = 60 + 12 * 20 * s * 0.9; for (const t of sp.types) cx += hudChip(cx, y, t.toUpperCase(), TYPE_COLOR[t], 22 * s); }
        else text('No Pokemon match', VW / 2, y0 + 60 * s, 20 * s, '#ccc', 'center');
        hint(padUI() ? 'A give   B back   LT/RT generation' : 'Type to search   Tab generation   arrows or scroll browse   Enter give   Esc back'); backButton(() => sc.close());
      },
    };
  },

  // every item with its PokeSprite icon: category tabs (Tab / LB / RB), name search, left / right = how many
  itemPicker(sc) {
    const cats = ADVP.CATS, st = { cat: 0, sel: 0, off: 0, q: '', ate: false, list: [] }, B_ = () => sc.save.bag;
    const refilter = () => { const q = toId(st.q); st.list = ADVDBG.items(cats[st.cat][0]).filter(id => !q || toId(ADVP.item(id).name).includes(q)); st.sel = 0; st.off = 0; };
    const tab = d => { st.cat = (st.cat + d + cats.length) % cats.length; refilter(); uiBlip(700, 0.03); };
    const cnt = d => { const C = ADVDBG.COUNTS; ADVDBG.count = C[clamp(C.indexOf(ADVDBG.count) + d, 0, C.length - 1)]; uiBlip(700, 0.03); };
    const type = searchKeys(st, refilter), keys = e => { if (e.key === 'Tab') { tab(e.shiftKey ? -1 : 1); st.ate = true; } else type(e); };
    const give = id => { if (id) ADVDBG.run(sc, sv => ADVDBG.giveItem(sv, id, ADVDBG.count)); };
    refilter();
    return {
      st,
      enter() { window.addEventListener('keydown', keys); }, exit() { window.removeEventListener('keydown', keys); },
      update() {
        if (INPUT.hit('LB')) tab(-1); if (INPUT.hit('RB')) tab(1);
        const dir = navDir(); if (dir === 'left') cnt(-1); if (dir === 'right') cnt(1);
        if (dir === 'up' || dir === 'down') ADVUI.nav(st, st.list.length, dir);
        if (okHit() && !st.ate) give(st.list[st.sel]); else if (backHit() && !st.ate) sc.close();
        st.ate = false;
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), l = st.list, rows = 8;
        text('GIVE AN ITEM', X(660), Y(40), L(36), '#ffde3b', 'center', '#1a2a6c');
        cats.forEach(([k, n], i) => { const w = L(200), x = X(40) + i * (w + L(8)), on = i === st.cat; hot(x, Y(70), w, L(38), { click: () => { st.cat = i; refilter(); } }); rrect(x, Y(70), w, L(38), L(10), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2); text(n, x + w / 2, Y(89), L(16), on ? '#111' : '#fff', 'center', null); });
        searchBox(X(40), Y(120), L(600), L(38), st.q, 'Type a name to search'); text(`${l.length} shown`, X(630), Y(139), L(13), '#9ab', 'right', null);
        ADVUI.scroll(st, l.length, rows);
        l.slice(st.off, st.off + rows).forEach((id, j) => {
          const i = j + st.off, y = Y(170) + j * L(66), on = i === st.sel, it = ADVP.item(id);
          hot(X(40), y, L(600), L(60), { hover: () => st.sel = i, click: () => { st.sel = i; give(id); }, wheel: d => st.sel = clamp(st.sel + d, 0, l.length - 1) });
          rrect(X(40), y, L(600), L(60), L(12), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
          ADVUI.icon(id, X(74), y + L(30), L(20)); text(it.name, X(112), y + L(30), L(20), on ? '#1a1a2a' : '#fff', 'left', null); text('x' + (B_()[id] | 0), X(620), y + L(30), L(20), on ? '#1a1a2a' : '#ffde3b', 'right', null);
        });
        if (!l.length) { panel(X(40), Y(170), L(600), L(90)); text('Nothing matches.', X(340), Y(215), L(20), '#9aa6c0', 'center', null); }
        panel(X(670), Y(170), L(610), L(330));
        const id = l[st.sel];
        if (id) { const it = ADVP.item(id); ADVUI.icon(id, X(740), Y(260), L(44)); text(it.name, X(810), Y(236), L(26), '#fff', 'left', null); text('Owned: ' + (B_()[id] | 0), X(810), Y(274), L(15), '#ffde3b', 'left', null); wrapText(it.info, X(700), Y(340), L(550), L(17), '#dde'); }
        const bx = X(700), by = Y(430);
        text('HOW MANY', bx, by, L(13), '#9aa6c0', 'left', null, 'Silkscreen');
        ADVDBG.COUNTS.forEach((c, i) => { const w = L(62), x = bx + L(140) + i * (w + L(6)), on = c === ADVDBG.count; hot(x, by - L(20), w, L(40), { click: () => { ADVDBG.count = c; uiBlip(700, 0.03); } }); rrect(x, by - L(20), w, L(40), L(10), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2); text('x' + c, x + w / 2, by + 1, L(16), on ? '#111' : '#fff', 'center', null); });
        if (ADVDBG.note.s) text(ADVDBG.note.s, X(975), Y(540), L(16), ADVDBG.note.bad ? '#ff9a9a' : '#9f9', 'center', null);
        hint(padUI() ? 'A give   left/right how many   LB/RB category   B back' : 'Type to search   Tab category   left/right how many   Enter or click gives   Esc back'); backButton(() => sc.close());
      },
    };
  },

  townPicker(sc) {
    const towns = ADVS.towns().sort((a, b) => a.name.localeCompare(b.name)), st = { sel: Math.max(0, ADVS.towns().sort((a, b) => a.name.localeCompare(b.name)).findIndex(t => t.id === sc.save.last)), off: 0 };
    const go = t => { const f = ADVS.front(t); while (sc.uis.length) sc.close(); ADVDBG.say('Warped to ' + t.name + '.'); sc.warp({ x: f.x, y: f.y }); };
    return {
      st,
      update() { ADVUI.nav(st, towns.length); if (okHit()) go(towns[st.sel]); else if (backHit()) sc.close(); },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), rows = 10, per = L(54);
        text('WARP TO A TOWN', X(660), Y(50), L(36), '#ffde3b', 'center', '#1a2a6c');
        ADVUI.scroll(st, towns.length, rows);
        towns.slice(st.off, st.off + rows).forEach((t, j) => {
          const i = j + st.off, y = Y(110) + j * per, on = i === st.sel;
          hot(X(380), y, L(560), per - 6, { hover: () => st.sel = i, click: () => { st.sel = i; go(t); }, wheel: d => st.sel = clamp(st.sel + d, 0, towns.length - 1) });
          rrect(X(380), y, L(560), per - 6, L(12), on ? '#ffde3b' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
          text(t.name, X(404), y + (per - 6) / 2, L(22), on ? '#1a1a2a' : '#fff', 'left', null);
          text(t.id[0] === 'G' ? 'GYM CITY' : 'TOWN', X(916), y + (per - 6) / 2, L(13), on ? '#1a1a2a' : '#9aa6c0', 'right', null, 'Silkscreen');
        });
        text('Test tool only: the game itself never teleports.', X(660), Y(700), L(14), '#9aa6c0', 'center', null);
        hint(padUI() ? 'A warp   B back' : 'Click a town to warp   Esc back'); backButton(() => sc.close());
      },
    };
  },

  panel(sc) {
    const D = ADVDBG, st = { sel: 0, off: 0, input: null }, sv = () => sc.save, lead = () => sv().party[sc.leadIdx()], off = () => D.guest(sc);
    const ch = f => () => off() || D.run(sc, f);
    const num = (label, max, f) => { st.input = { label, s: '', max, f }; };
    const skills = Object.keys(ADVP.SKILLS);
    const rows = () => [
      { label: 'Money +1000', value: ADVUI.money(sv().money), act: ch(s => D.money(s, s.money + 1000)), info: 'Adds $1000.' },
      { label: 'Money +10000', act: ch(s => D.money(s, s.money + 10000)), info: 'Adds $10000.' },
      { label: 'Set money', value: ADVUI.money(sv().money), cycle: d => off() || D.run(sc, s => D.money(s, s.money + d * 500)), act: () => off() || num('MONEY', 7, n => D.run(sc, s => D.money(s, n))), info: 'Click or Enter to type an exact amount. Left / right changes it by $500.' },
      { label: 'Give Pokemon', value: 'Lv ' + D.lv, cycle: d => D.lv = clamp(D.lv + d, 1, 100), act: () => off() || sc.open(D.speciesPicker(sc)), info: 'Opens the species list (search, "jarona" for Flowery). Left / right sets the level 1-100. Goes to the party, or the PC box when the party is full.' },
      { label: 'Give item', value: 'x' + D.count, cycle: d => { const C = D.COUNTS; D.count = C[clamp(C.indexOf(D.count) + d, 0, C.length - 1)]; }, act: () => off() || sc.open(D.itemPicker(sc)), info: 'Opens the item list: balls, medicine, stones, TMs and key items. Left / right sets how many.' },
      { label: 'Heal party', act: ch(s => D.healAll(s)), info: 'Full HP and no status for the whole party.' },
      { label: 'Lead level', value: 'Lv ' + lead().level, cycle: d => off() || D.run(sc, s => D.setLevel(lead(), lead().level + d)), act: () => off() || num('LEAD LEVEL', 3, n => D.run(sc, () => D.setLevel(lead(), n))), info: ADVP.name(lead()) + ' is the lead. Left / right is one level, Enter types an exact one. Level moves fill free slots.' },
      { label: 'Max friendship', act: ch(s => D.friendship(s)), info: 'Sets every party member to 255.' },
      { label: 'Badges', value: String(sv().badges | 0), cycle: d => off() || D.run(sc, s => D.badges(s, s.badges + d)), info: 'Sets the badge count 0-8 (it also sets the wild and trainer level band).' },
      { label: 'Time of day', value: (D.TIMES[D.timeIdx()] || ['Hour ' + ADVW.hourSet])[0], cycle: d => { ADVW.hourSet = D.TIMES[(D.timeIdx() + d + D.TIMES.length) % D.TIMES.length][1]; }, info: 'Pins the clock. Night is 20:00 to 6:00. Not saved.' },
      { label: 'Weather', value: D.WEATHER[D.wxIdx()][0], cycle: d => { ADVW.weather = D.WEATHER[(D.wxIdx() + d + D.WEATHER.length) % D.WEATHER.length][1]; }, info: 'Auto lets every zone roll its own weather (it changes every 6 game hours). Anything else pins that weather everywhere outdoors: clear, cloudy, rain, storm, fog, snow or a sandstorm. Not saved.' },
      { label: 'No wild encounters', value: D.noWild ? 'On' : 'Off', cycle: () => off() || D.setNoWild(!D.noWild), act: () => off() || D.setNoWild(!D.noWild), info: 'Wild Pokemon stop spawning and the tall grass stays quiet. Trainers still fight. Not saved.' },
      { label: 'Warp to a town', act: () => off() || sc.open(D.townPicker(sc)), info: 'Moves you to the front of a town. A test tool: the game itself has no teleporting.' },
      { label: 'All skills', value: skills.every(k => sv().skills[k]) ? 'All known' : 'Learn all', cycle: () => off() || D.run(sc, s => D.allSkills(s, !skills.every(k => s.skills[k]))), act: () => off() || D.run(sc, s => D.allSkills(s, !skills.every(k => s.skills[k]))), info: 'Learns every skill at once, or forgets them all when you already know every one. Each skill below toggles on its own.' },
      ...skills.map(k => ({ id: k, label: ADVP.SKILLS[k].name, value: sv().skills[k] ? 'Known' : 'Not learned', cycle: () => off() || D.run(sc, s => D.skill(s, k, !s.skills[k])), act: () => off() || D.run(sc, s => D.skill(s, k, !s.skills[k])), skill: true, info: ADVP.SKILLS[k].info })),
    ];
    const typed = e => {
      const i = st.input; if (!i || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key) && i.s.length < i.max) i.s += e.key; else if (e.key === 'Backspace') i.s = i.s.slice(0, -1); else return;
      e.preventDefault();
    };
    return {
      st,
      enter() { window.addEventListener('keydown', typed); D.say(''); }, exit() { window.removeEventListener('keydown', typed); },
      update(dt) {
        const its = rows();
        if (st.input) { if (okHit()) { const i = st.input; st.input = null; if (i.s) i.f(+i.s); } else if (backHit()) st.input = null; return; }
        ADVUI.nav(st, its.length); const it = its[st.sel];
        if (INPUT.menu === 'left' && it.cycle) { it.cycle(-1); uiBlip(700, 0.03); } if (INPUT.menu === 'right' && it.cycle) { it.cycle(1); uiBlip(700, 0.03); }
        if (okHit() && (it.act || it.cycle)) { uiBlip(880, 0.05); (it.act || it.cycle)(1); }
        else if (backHit() || INPUT.hit('START') || sc.dbgHit) sc.close();
      },
      draw() {
        bgFill('#14283a', '#1b3a2f'); const { X, Y, L } = layout(), its = rows(), n = 10, dead = off(), sel = its[st.sel];
        text('TEST TOOLS', X(660), Y(46), L(40), '#ffde3b', 'center', '#1a2a6c');
        ADVUI.scroll(st, its.length, n);
        ctx.globalAlpha = dead ? 0.4 : 1;
        its.slice(st.off, st.off + n).forEach((it, j) => {
          const i = j + st.off, y = Y(96) + j * L(64), on = i === st.sel, h = L(56);
          hot(X(40), y, L(620), h, { hover: () => st.sel = i, click: fx => { st.sel = i; if (it.act) { uiBlip(880, 0.05); it.act(); } else if (it.cycle) { it.cycle(fx < 0.5 ? -1 : 1); uiBlip(700, 0.03); } }, wheel: d => it.cycle && it.cycle(d) });
          rrect(X(40), y, L(620), h, L(12), on ? '#ffde3bee' : '#ffffff18', on ? '#fff' : '#ffffff33', 2);
          text(it.label, X(66), y + h / 2, L(20), on ? '#1a1a2a' : '#fff', 'left', null);
          if (it.value !== undefined) text(`${it.cycle ? '< ' : ''}${it.value}${it.cycle ? ' >' : ''}`, X(640), y + h / 2, L(19), on ? '#1a1a2a' : it.skill && sv().skills[it.id] ? '#7be07b' : '#ffde3b', 'right', null);
        });
        ctx.globalAlpha = 1;
        if (its.length > n) { const th = L(n * 64 - 8), kh = Math.max(L(24), th * n / its.length); ctx.fillStyle = '#ffffff18'; ctx.fillRect(X(668), Y(96), L(8), th); ctx.fillStyle = '#ffde3b'; ctx.fillRect(X(668), Y(96) + (th - kh) * st.off / (its.length - n), L(8), kh); }
        // the save in brief
        const s = sv(), px = X(700);
        panel(px, Y(96), L(580), L(344), 'SAVE', s.name.toUpperCase());
        const kv = (k, v, y, col = '#fff') => { text(k, px + L(24), Y(y), L(13), '#9aa6c0', 'left', null, 'Silkscreen'); text(v, px + L(556), Y(y), L(18), col, 'right', null); };
        kv('MONEY', ADVUI.money(s.money), 150, '#ffde3b'); kv('BADGES', String(s.badges | 0), 184); kv('BOX', s.box.length + ' stored', 218);
        kv('TIME', (D.TIMES[D.timeIdx()] || ['Hour ' + ADVW.hourSet])[0], 252); kv('WEATHER', D.WEATHER[D.wxIdx()][0], 286); kv('WILD ENCOUNTERS', D.noWild ? 'Off' : 'On', 320);
        const ps = L(70), gap = (L(532) - 6 * ps) / 5; s.party.forEach((m, i) => { const x = px + L(24) + i * (ps + gap), y = Y(352); rrect(x, y, ps, ps, L(8), '#00000066', i === sc.leadIdx() ? '#ffde3b' : '#ffffff33', 2); const im = portrait(toId(m.species)); if (im) ctx.drawImage(im, x, y, ps, ps); text('Lv ' + m.level, x + ps / 2, y + ps - L(8), L(11), '#fff', 'center', '#000'); });
        panel(px, Y(456), L(580), L(220), (sel.label || '').toUpperCase());
        wrapText(dead ? 'Test tools are off while you are connected as a guest: the host runs the world and your save is not changed from here.' : sel.info || '', px + L(24), Y(506), L(532), L(17), dead ? '#ff9a9a' : '#dde');
        if (D.note.s) text(D.note.s, X(660), Y(738), L(16), D.note.bad ? '#ff9a9a' : '#9f9', 'center', null);
        if (st.input) {
          ctx.fillStyle = '#000a'; ctx.fillRect(0, 0, VW, VH);
          panel(X(380), Y(260), L(560), L(220), 'SET ' + st.input.label);
          text((st.input.label === 'MONEY' ? '$' : '') + (st.input.s || '') + (Math.floor(performance.now() / 500) % 2 ? '_' : ' '), X(660), Y(360), L(46), '#fff', 'center', null);
          text(padUI() ? 'Use left / right on the row instead' : 'Type digits   Backspace erases', X(660), Y(430), L(15), '#9aa6c0', 'center', null);
          hint('Enter confirm   Esc cancel');
        } else hint(padUI() ? 'A change   left/right adjust   B back' : 'Click or Enter to use   left/right adjust   F9 or Esc back');
        backButton(() => sc.close());
      },
    };
  },
};
