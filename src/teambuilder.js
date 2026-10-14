// Team builder: set editor, move picker (search, sort, live attack preview), item picker (Showdown item icons).
// Mouse, keyboard and pad all work everywhere. Loaded before src/ui.js; uses its helpers at run time.
'use strict';

const overRect = (x, y, w, h) => !INPUT.usingPad && MOUSE.x >= x && MOUSE.x <= x + w && MOUSE.y >= y && MOUSE.y <= y + h;
function button(x, y, w, h, label, fn, o = {}) {
  const hov = overRect(x, y, w, h), on = o.on;
  rrect(x, y, w, h, Math.min(10, h / 3), on ? '#ffde3b' : hov ? '#ffffff40' : '#ffffff1a', on ? '#fff' : hov ? '#ffffffbb' : '#ffffff40', 2);
  text(label, x + w / 2, y + h / 2 + 1, o.size || Math.max(10, h * 0.42), on ? '#111' : '#fff', 'center', null);
  hot(x, y, w, h, { click: fn, wheel: o.wheel });
}
// Held-item icon from data/item-icons.js, centred on x,y, whole-number scale.
function itemIcon(name, x, y, h = 24) {
  const I = window.ITEM_ICONS, id = toId(name), c = I && (I.cells[id] ?? (DEX.items[id]?.megaStone ? I.cells[Object.keys(I.cells).find(k => DEX.items[k]?.megaStone)] : undefined)), im = c !== undefined && img(I.file);
  if (!im) return 0;
  const k = Math.max(1, Math.round(h / I.size)), w = I.size * k;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, (c % I.cols) * I.size, Math.floor(c / I.cols) * I.size, I.size, I.size, Math.round(x - w / 2), Math.round(y - w / 2), w, w);
  return w;
}
const CAT = { Physical: ['PHYSICAL', '#e2603a'], Special: ['SPECIAL', '#4f7ce8'], Status: ['STATUS', '#8c8ca0'] };
const ARCH_INFO = {
  projectile: ['Projectile', 'Fires a shot along your aim. Single shots can be held to charge a bigger, stronger shot.'],
  beam: ['Beam', 'An instant line from you along your aim.'],
  laser: ['Laser', 'A channelled stream you steer while it fires. Damage ticks while it stays on the target.'],
  area: ['Burst', 'Erupts in a ring around you and hits anything close.'],
  melee: ['Close hit', 'A short-range hit in front of you. Get close first.'],
  dash: ['Charge', 'You rush along your aim and hit what you run into. Doubles as movement.'],
  lunge: ['Lunge', 'A short, very fast rush that cuts anything within reach in front of you.'],
  lob: ['Lob', 'Thrown to the aimed spot, lands after a short delay and blasts the area.'],
  strike: ['Tracking strike', 'A reticle follows the target, locks, then lands. Roll out after the lock.'],
  leap: ['Leap', 'You vanish, steer while hidden, then come down with a hit.'],
  trap: ['Field trap', 'Thrown to the aimed spot and stays a few seconds. Triggers when the foe steps in.'],
  wave: ['Wave', 'A wide front that rolls forward along your aim and hits once.'],
  sweep: ['Arena sweep', 'A front that crosses the whole arena. Dodge through it or stand in a gap.'],
  hazard: ['Hazard', 'Placed on the field and stays. Only hurts the other side.'],
  self: ['Self', 'Used on yourself: boosts, healing, protection or field effects.'],
  gust: ['Gust', 'A cone of wind in front of you: small hits over time that shove the target back.'],
  orange: ['Orange', 'Hop back out of danger and launch a fast projectile along your aim.'],
};
const archWord = m => (ARCH_INFO[archetype(m)] || [archetype(m)])[0];
const moveCd = m => cooldownFor(m, { status: '' });
const slotIcons = k => [PAD_ICONS[k], PC_ICONS[k]];
// Typing into a search box. Letters stop acting as menu keys while it's used (st.ate eats that frame's OK/back).
function searchKeys(st, refilter) {
  return e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace' && st.q) { st.q = st.q.slice(0, -1); refilter(); st.ate = true; }
    else if (e.key === 'Escape' && st.q) { st.q = ''; refilter(); st.ate = true; }
    else if (e.key.length === 1 && /[a-z0-9.' :-]/i.test(e.key) && (e.key !== ' ' || st.q) && st.q.length < 20) { st.q += e.key; refilter(); st.ate = true; }
  };
}
const navDir = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(k => KEYS[k]) ? '' : INPUT.menu;
function searchBox(x, y, w, h, q, placeholder) {
  const s = S();
  rrect(x, y, w, h, 8 * s, '#00000055', q ? '#ffde3b' : '#ffffff44', 2);
  const caret = Math.floor(performance.now() / 500) % 2 ? '_' : ' ';
  text(q ? q + caret : placeholder, x + 12 * s, y + h / 2 + 1, 15 * s, q ? '#fff' : '#889', 'left', null);
}

// ---------- live attack preview ----------
// Stages a real mini battle (startBattle / updateBattle / drawWorld) with the set's mon using the move on a Substitute doll
// dummy, loops it, and draws it into a sub-rect. B / ctx / view are swapped in and restored around every step.
const PV_W = 400, PV_H = 224, pvCv = document.createElement('canvas'), pvCtx = pvCv.getContext('2d');
pvCv.width = PV_W; pvCv.height = PV_H;
const PV = { key: '', B: null, t: 0, used: false, done: 0, last: 0, cx: 0, cy: 0, err: '' };
function pvMuted(fn) {
  const p = AUDIO.play, u = window.uiBlip, pad = INPUT.usingPad;
  AUDIO.play = () => {}; window.uiBlip = () => {}; INPUT.usingPad = false;
  try { return fn(); } finally { AUDIO.play = p; window.uiBlip = u; INPUT.usingPad = pad; }
}
function pvStart(set, move) {
  const ar0 = ARENAS.find(a => !a.weather) || ARENAS[0], a = archetype(move);
  const uKey = DEX.species[toId(set.species)].sprite, dKey = DEX.species.substitutedoll.sprite;
  const d = a === 'melee' ? bodyRadius(uKey) + bodyRadius(dKey) + 6 : a === 'lunge' ? 120 : a === 'dash' ? 170 : 220;
  PV.cx = ar0.w / 2; PV.cy = ar0.h / 2;
  const arena = { ...ar0, obstacles: [], weather: '', spawns: [[PV.cx - d / 2, PV.cy], [PV.cx + d / 2, PV.cy]] };
  pvMuted(() => startBattle({ arena, player: { name: '', team: [{ ...set, moves: [move.id] }] },
    cpu: { name: '', cpu: true, team: [{ species: 'substitutedoll', level: set.level || 50, moves: [], ability: 'Telepathy', nature: 'Hardy' }] } }));
  PV.B = B; PV.t = 0; PV.used = false; PV.done = 0;
  const [me, foe] = B.sides, fm = activeMon(foe);
  fm.maxHp = fm.hp = 1e7;
  for (const s of B.sides) Object.assign(s.ent, { enterT: 0, iframes: 0 });
  foe.script = side => Object.assign(side.intent, { mx: 0, my: 0, use: -1, hold: -1, dodge: false, mega: false });
  me.script = (side, dt) => {
    const e = side.ent, fe = foe.ent, I = side.intent, m = activeMon(side);
    const dx = fe.x - e.x, dy = fe.y - e.y, l = Math.hypot(dx, dy) || 1;
    if (!e.dash) { e.aimX = dx / l; e.aimY = dy / l; } e.aimIdle = 0;
    Object.assign(I, { mx: 0, my: 0, use: -1, hold: -1, dodge: false, mega: false });
    if (e.hidden > 0 && l > 14) { I.mx = dx / l; I.my = dy / l; }
    if (m.cds[0] > 0 || e.act) PV.used = true;
    if (!PV.used && PV.t > 0.45) I.use = 0;
  };
}
function pvStep(dt) {
  PV.t += dt;
  pvMuted(() => updateBattle(dt));
  B.cam.shake = Math.max(0, B.cam.shake - dt * 30);
  const e = B.sides[0].ent;
  const busy = e.act || e.dash || e.hidden > 0 || e.laser || B.proj.length || B.gusts.length || B.beams.length || B.marks.length || B.waves.length || B.sweeps.length || B.timers.length || B.areas.length;
  if (PV.used && !busy) PV.done += dt;
  return PV.done > 1.1 || PV.t > 8;
}
function drawMovePreview(set, moveId, x, y, w, h) {
  const s = S(), now = performance.now(), dt = clamp((now - PV.last) / 1000, 0, 0.05); PV.last = now;
  rrect(x - 3, y - 3, w + 6, h + 6, 8 * s, '#000', '#ffffff55', 2);
  const move = DEX.moves[moveId];
  if (!move) { text('No move', x + w / 2, y + h / 2, 16 * s, '#889', 'center', null); return; }
  const key = [set.species, moveId, set.level, set.ability, set.item, set.nature].join('|');
  if (PV.err === key) { text('Preview unavailable', x + w / 2, y + h / 2, 16 * s, '#889', 'center', null); return; }
  const saved = B, savedCtx = ctx, savedView = view;
  let vx = 0, vy = 0;
  try {
    if (key !== PV.key || !PV.B) { PV.key = key; pvStart(set, move); }
    B = PV.B;
    if (pvStep(dt)) { pvStart(set, move); B = PV.B; }
    const sh = B.cam.shake;
    vx = Math.round(PV.cx - PV_W / 2 + (Math.random() - 0.5) * sh * 0.5); vy = Math.round(PV.cy - PV_H / 2 - 12 * SS + (Math.random() - 0.5) * sh * 0.5);
    ctx = pvCtx; ctx.setTransform(1, 0, 0, 1, -vx, -vy); ctx.imageSmoothingEnabled = false;
    view = { x: vx, y: vy, w: PV_W, h: PV_H };
    ctx.fillStyle = '#111'; ctx.fillRect(vx, vy, PV_W, PV_H);
    drawWorld(dt);
  } catch (err) { console.error('move preview', err); PV.err = key; PV.B = null; }
  finally { ctx = savedCtx; view = savedView; }
  try {
    if (!PV.B) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pvCv, x, y, w, h);
    const k = w / PV_W;
    if (B.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, B.flashT * 3)})`; ctx.fillRect(x, y, w, h); }
    for (const f of B.floats) {
      const q = f.t / 0.9;
      ctx.globalAlpha = q < 0.65 ? 1 : 1 - (q - 0.65) / 0.35;
      text(f.s, x + (f.x - vx) * k, y + (f.y - vy) * k - q * 30 * s, (f.num ? 18 : 12) * s, f.color, 'center', '#000', f.num ? 'Bungee' : 'Silkscreen');
      ctx.globalAlpha = 1;
    }
  } finally { B = saved; }
}

// ---------- team editor ----------
const FIELDS = ['species', 'level', 'ability', 'item', 'nature', 'move0', 'move1', 'move2', 'move3'];
function EditScene(ti) {
  const teams = savedTeams(), team = teams[ti];
  const save = () => { teams[ti] = team; saveTeams(teams); };
  const st = { slot: 0, f: 0, col: 0 };
  const scene = {
    setSpecies(slot, id) { const old = team.mons[slot]; team.mons[slot] = { ...blankSet(id), level: old?.level || 50, nature: old?.nature || 'Hardy', item: old?.item || '' }; save(); },
    set() { return team.mons[st.slot]; },
    rename() { const name = window.prompt('Team name', team.name); if (name) { team.name = name.slice(0, 24); save(); } },
    addMon() { team.mons.push(blankSet()); save(); st.slot = team.mons.length - 1; setScene(SpeciesPicker(scene, st.slot)); },
    // reorder the party: slot i swaps with i+d (the first mon is the default lead)
    partySwap(i, d) { const j = i + d, mv = team.mons; if (j < 0 || j >= mv.length || !mv[i]) return; [mv[i], mv[j]] = [mv[j], mv[i]]; st.slot = j; save(); },
    removeMon(i) { if (team.mons.length > 1) { team.mons.splice(i, 1); st.slot = Math.min(st.slot, team.mons.length - 1); save(); } },
    level(d) { const set = scene.set(); set.level = clamp((set.level || 50) + d, 1, 100); save(); },
    cycleAbility(d) { const set = scene.set(), ab = Object.values(DEX.species[toId(set.species)].abilities), i = ab.indexOf(set.ability); set.ability = ab[(i + d + ab.length) % ab.length]; save(); },
    cycleNature(d) { const set = scene.set(), ns = Object.values(DEX.natures).map(n => n.name), i = ns.indexOf(set.nature); set.nature = ns[(i + d + ns.length) % ns.length]; save(); },
    // reorder moves: slot k swaps with k+d (slot 1-4 = A/B/X/Y on pad, LMB/RMB/Q/E on PC)
    moveSwap(k, d) {
      const mv = scene.set().moves, j = k + d;
      if (j < 0 || j >= mv.length || !mv[k]) return;
      [mv[k], mv[j]] = [mv[j], mv[k]]; st.f = FIELDS.indexOf('move' + j); save();
    },
    open(f) {
      const set = scene.set();
      if (f === 'species') setScene(SpeciesPicker(scene, st.slot));
      if (f === 'item') setScene(ItemPicker(set, v => { set.item = v; save(); }, scene));
      if (f.startsWith('move')) setScene(MovePicker(set, Math.min(+f[4], set.moves.length), v => {
        const k = Math.min(+f[4], set.moves.length);
        set.moves[k] = v; set.moves = set.moves.filter(Boolean); save();
      }, scene));
    },
    update() {
      const set = scene.set();
      if (st.col === 0) {
        const n = team.mons.length + (team.mons.length < 6 ? 1 : 0);
        if (INPUT.menu === 'up') st.slot = (st.slot - 1 + n) % n;
        if (INPUT.menu === 'down') st.slot = (st.slot + 1) % n;
        if (INPUT.menu === 'right' && set) st.col = 1;
        if (okHit()) { if (!set) scene.addMon(); else st.col = 1; }
        if (INPUT.hit('TABL') && set) scene.partySwap(st.slot, -1);
        if (INPUT.hit('TABR') && set) scene.partySwap(st.slot, 1);
        if ((INPUT.hit('X') || INPUT.hit('DEL')) && set) scene.removeMon(st.slot);
        if (INPUT.hit('Y') || INPUT.hit('REN')) scene.rename();
        if (backHit()) { save(); setScene(TeamsScene); }
        return;
      }
      if (!set) { st.col = 0; return; }
      if (INPUT.menu === 'up') st.f = (st.f + FIELDS.length - 1) % FIELDS.length;
      if (INPUT.menu === 'down') st.f = (st.f + 1) % FIELDS.length;
      const f = FIELDS[st.f], lr = INPUT.menu === 'left' ? -1 : INPUT.menu === 'right' ? 1 : 0;
      if (f === 'level' && lr) scene.level(lr);
      if (f === 'level' && (INPUT.hit('TABL') || INPUT.hit('TABR'))) scene.level(INPUT.hit('TABL') ? -10 : 10);
      if (f === 'ability' && lr) scene.cycleAbility(lr);
      if (f === 'nature' && lr) scene.cycleNature(lr);
      if (f.startsWith('move') && INPUT.hit('TABL')) scene.moveSwap(+f[4], -1);
      if (f.startsWith('move') && INPUT.hit('TABR')) scene.moveSwap(+f[4], 1);
      if (okHit()) scene.open(f);
      if (backHit() || (lr < 0 && !['level', 'ability', 'nature'].includes(f))) st.col = 0;
    },
    draw() {
      bgFill('#14283a', '#1b3a2f'); const s = S(), pad = INPUT.usingPad;
      // header: team name (click to rename)
      ctx.font = `${26 * s}px Bungee, "Arial Black", sans-serif`;
      const nw = ctx.measureText(team.name.toUpperCase()).width;
      text(team.name.toUpperCase(), 150 * s, 34 * s, 26 * s, '#ffde3b', 'left');
      button(160 * s + nw, 20 * s, 110 * s, 28 * s, 'RENAME', scene.rename, { size: 12 * s });
      iconRow([pad ? 'xbox_y' : 'key_f2'], 278 * s + nw, 34 * s, 32, 12 * s, '#ccd');
      // party
      const n = team.mons.length + (team.mons.length < 6 ? 1 : 0), PX = 24 * s, PW = 300 * s, RH = 84 * s;
      for (let i = 0; i < n; i++) {
        const m = team.mons[i], y = 66 * s + i * RH, h = RH - 8 * s, on = i === st.slot, hov = overRect(PX, y, PW, h);
        hot(PX, y, PW, h, { click: () => { st.slot = i; st.col = 0; if (!m) scene.addMon(); } });
        rrect(PX, y, PW, h, 12 * s, on ? (st.col === 0 ? '#ffde3b' : '#ffde3bbb') : hov ? '#ffffff30' : '#ffffff18', hov ? '#ffffffbb' : '#ffffff55', 2);
        if (!m) { text('+ ADD POKEMON', PX + PW / 2, y + h / 2, 17 * s, on ? '#111' : '#fff', 'center', null); continue; }
        const sp = DEX.species[toId(m.species)], im = portrait(sp.id), dark = on;
        if (im) ctx.drawImage(im, PX + 8 * s, y + 8 * s, 60 * s, 60 * s);
        text(sp.name, PX + 78 * s, y + 20 * s, 16 * s, dark ? '#111' : '#fff', 'left', null);
        text('Lv ' + m.level, PX + 78 * s, y + 42 * s, 12 * s, dark ? '#333' : '#bcd', 'left', null);
        (m.moves || []).forEach((id, k) => { const mv = DEX.moves[id]; if (mv) { ctx.fillStyle = TYPE_COLOR[mv.type]; ctx.fillRect(PX + 78 * s + k * 34 * s, y + 56 * s, 30 * s, 6 * s); } });
        if (m.item) itemIcon(m.item, PX + PW - 58 * s, y + h / 2, 24 * s);
        if ((on || hov) && team.mons.length > 1 && !pad) {
          button(PX + PW - 30 * s, y + 6 * s, 24 * s, 24 * s, 'X', () => scene.removeMon(i), { size: 11 * s });
          if (i > 0) button(PX + PW - 30 * s, y + 34 * s, 24 * s, 18 * s, '^', () => scene.partySwap(i, -1), { size: 11 * s });
          if (i < team.mons.length - 1) button(PX + PW - 30 * s, y + 54 * s, 24 * s, 18 * s, 'v', () => scene.partySwap(i, 1), { size: 11 * s });
        }
        if (i === 0 && team.mons.length > 1) text('LEAD', PX + 78 * s, y + 8 * s, 9 * s, dark ? '#a60' : '#ffde3b', 'left', null);
      }
      const set = scene.set();
      if (set) {
        const sp = DEX.species[toId(set.species)], MX = 344 * s, MW = 330 * s, f = FIELDS[st.f];
        // middle: live preview of the focused move, else the mon
        const focusMove = st.col === 1 && f.startsWith('move') && set.moves[+f[4]];
        if (focusMove) { text('PREVIEW', MX, 76 * s, 13 * s, '#9ab', 'left', null); drawMovePreview(set, focusMove, MX, 90 * s, MW, MW * PV_H / PV_W); }
        else { ctx.save(); ctx.translate(MX + MW / 2, 230 * s); ctx.scale(3 * s, 3 * s); drawMonSprite(sp.sprite, 'Idle', performance.now() / 1000, 0, 0, 0, { scale: 1 }); ctx.restore(); }
        let cx = MX; for (const t of sp.types) cx += hudChip(cx, 290 * s, t.toUpperCase(), TYPE_COLOR[t], 24 * s);
        const stats = calcStats(sp, set.level || 50, toId(set.nature)), nm = DEX.natures[toId(set.nature)];
        ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].forEach((k, i) => {
          const y = 340 * s + i * 26 * s;
          const c = nm && nm.plus === k && nm.minus !== k ? '#ff9a7a' : nm && nm.minus === k && nm.plus !== k ? '#7ab8ff' : '#fff';
          text(k.toUpperCase(), MX, y, 13 * s, c, 'left', null); text(String(k === 'hp' ? Math.round(stats.hp * hpScale(set.level || 50)) : stats[k]), MX + 50 * s, y, 13 * s, c, 'left', null);
          ctx.fillStyle = c; ctx.fillRect(MX + 110 * s, y - 5 * s, Math.min(200, sp.baseStats[k]) * s, 10 * s);
        });
        // description of the focused field
        let desc = '';
        if (f === 'ability') desc = (DEX.abilities[toId(set.ability)]?.shortDesc || '') + (ABILITY_WORKS(toId(set.ability)) ? '' : '  (does nothing in PokeArena yet)');
        if (f === 'item' && set.item) desc = (DEX.items[toId(set.item)]?.shortDesc || '') + (ITEM_WORKS(toId(set.item)) ? '' : '  (does nothing in PokeArena yet)');
        if (f === 'nature') desc = nm && nm.plus && nm.plus !== nm.minus ? `Raises ${nm.plus.toUpperCase()}, lowers ${nm.minus.toUpperCase()}` : 'Neutral nature';
        if (focusMove) { const mv = DEX.moves[focusMove]; desc = `${archWord(mv)}: ${ARCH_INFO[archetype(mv)]?.[1] || ''} ${mv.shortDesc || ''}`; }
        if (desc && st.col === 1) wrapText(desc, MX, 520 * s, MW, 13 * s, '#dde');
        // fields
        const FX = 694 * s, FW = Math.min(VW - FX - 24 * s, 680 * s), FH = 50 * s, gap = 58 * s;
        const focus = i => { st.col = 1; st.f = i; };
        FIELDS.forEach((f, i) => {
          const y = 66 * s + i * gap + (i >= 5 ? 30 * s : 0), on = st.col === 1 && i === st.f, hov = overRect(FX, y, FW, FH);
          const mid = y + FH / 2, dk = on ? '#111' : '#fff', sub = on ? '#333' : '#9ab';
          const lrRow = ['level', 'ability', 'nature'].includes(f);
          hot(FX, y, FW, FH, { hover: () => focus(i), click: px => { focus(i); if (lrRow) (f === 'level' ? scene.level : f === 'ability' ? scene.cycleAbility : scene.cycleNature)(px < 0.5 ? -1 : 1); else scene.open(f); }, wheel: d => { focus(i); if (lrRow) (f === 'level' ? scene.level : f === 'ability' ? scene.cycleAbility : scene.cycleNature)(-d); } });
          rrect(FX, y, FW, FH, 10 * s, on ? '#ffde3b' : hov ? '#ffffff2a' : '#ffffff14', hov && !on ? '#ffffff88' : null, 2);
          if (f.startsWith('move')) {
            const k = +f[4], mv = DEX.moves[set.moves[k]];
            const [pi, ci] = slotIcons(k); icon(pi, FX + 22 * s, mid, 32); icon(ci, FX + 52 * s, mid, 32);
            if (!mv) { text(k <= set.moves.length ? '+ add move' : '(empty)', FX + 80 * s, mid, 15 * s, on ? '#333' : '#889', 'left', null); return; }
            const tw = hudChip(FX + 76 * s, mid - 11 * s, mv.type.toUpperCase(), TYPE_COLOR[mv.type], 22 * s);
            // name + style on the left; category pill, power and cooldown in fixed columns on the right
            const R = FX + FW - 80 * s, nx = FX + 80 * s + Math.max(tw, 90 * s), room = R - 266 * s - nx;
            ctx.font = `${16 * s}px Bungee, "Arial Black", sans-serif`;
            text(mv.name, nx, mid - 7 * s, 16 * s * Math.min(1, room / Math.max(1, ctx.measureText(mv.name).width)), dk, 'left', null);
            text(archWord(mv).toUpperCase(), nx, mid + 11 * s, 10 * s, sub, 'left', null);
            const [cl, cc] = CAT[mv.category], pw = 68 * s;
            rrect(R - 266 * s, mid - 10 * s, pw, 20 * s, 10 * s, cc); text(cl, R - 266 * s + pw / 2, mid + 1, 9 * s, '#fff', 'center', null);
            text(mv.basePower ? 'POW ' + mv.basePower : 'POW -', R - 108 * s, mid, 13 * s, dk, 'right', null);
            text(`CD ${moveCd(mv).toFixed(1)}s`, R, mid, 13 * s, dk, 'right', null);
            if (k > 0) button(FX + FW - 68 * s, y + 9 * s, 30 * s, 32 * s, '^', () => scene.moveSwap(k, -1), { size: 14 * s });
            if (k < set.moves.length - 1) button(FX + FW - 34 * s, y + 9 * s, 30 * s, 32 * s, 'v', () => scene.moveSwap(k, 1), { size: 14 * s });
            return;
          }
          const label = { species: 'Species', level: 'Level', ability: 'Ability', item: 'Item', nature: 'Nature' }[f];
          text(label, FX + 16 * s, mid, 13 * s, sub, 'left', null);
          let vx = FX + 120 * s;
          if (f === 'item' && set.item) vx += itemIcon(set.item, vx + 12 * s, mid, 24 * s) + 8 * s;
          const val = { species: sp.name, level: String(set.level), ability: set.ability, item: set.item || '(none)', nature: set.nature }[f];
          text(lrRow ? `<  ${val}  >` : val, vx, mid, 16 * s, dk, 'left', null);
          if (f === 'species' || f === 'item') text(pad ? 'A to change' : 'CLICK TO CHANGE >', FX + FW - 16 * s, mid, 11 * s, sub, 'right', null);
          if (f === 'nature' && nm?.plus && nm.plus !== nm.minus) text(`+${nm.plus.toUpperCase()} -${nm.minus.toUpperCase()}`, FX + FW - 16 * s, mid, 12 * s, sub, 'right', null);
          if (f === 'level') { button(FX + FW - 140 * s, y + 9 * s, 62 * s, 32 * s, '-10', () => scene.level(-10), { size: 12 * s }); button(FX + FW - 72 * s, y + 9 * s, 62 * s, 32 * s, '+10', () => scene.level(10), { size: 12 * s }); }
        });
        text('MOVES', FX, 66 * s + 5 * gap + 12 * s, 14 * s, '#ffde3b', 'left', null);
        text(pad ? 'LB/RB move a move up/down' : 'arrows or Q/E reorder', FX + FW, 66 * s + 5 * gap + 12 * s, 11 * s, '#9ab', 'right', null);
      }
      hint(pad ? (st.col === 0 ? 'A edit   X remove   Y rename   B back (saves)' : 'A choose   left/right change   LB/RB level -10/+10 or reorder moves   B back')
        : 'Click a field to edit   click either half or scroll to change a value   right-click back');
      backButton(() => { save(); setScene(TeamsScene); });
    },
  };
  return scene;
}

// ---------- shared searchable list ----------
// o: { title, all, match(it, q), sorts: [[label, cmp]], filters: [label, test(it, v), values], rowH, drawRow(it, x, y, w, h, on),
//      drawSide(it, x, y, w), cur, onPick(it), back }
function SearchList(o) {
  const st = { q: '', sel: 0, off: 0, sort: 0, rev: false, filt: 0, ate: false, list: [] };
  const refilter = () => {
    const q = toId(st.q), F = o.filters;
    let L = o.all.filter(it => (!q || o.match(it, q)) && (!F || !st.filt || F[1](it, F[2][st.filt])));
    if (o.sorts) { const c = o.sorts[st.sort][1]; L.sort((a, b) => (st.rev ? -1 : 1) * c(a, b)); }
    st.list = o.pinned && !q && !st.filt ? [...o.pinned, ...L] : L;
    st.sel = clamp(st.sel, 0, Math.max(0, st.list.length - 1));
  };
  refilter();
  st.sel = Math.max(0, st.list.indexOf(o.cur)); st.off = st.sel - 3;
  const setSort = i => { if (i === st.sort) st.rev = !st.rev; else { st.sort = i; st.rev = false; } refilter(); };
  const setFilt = d => { const n = o.filters[2].length; st.filt = (st.filt + d + n) % n; st.sel = 0; refilter(); };
  const onKey = searchKeys(st, () => { st.sel = 0; refilter(); });
  const pick = it => { if (it) { o.onPick(it); setScene(o.back); } };
  let per = 10;
  const show = () => { if (st.sel < st.off) st.off = st.sel; if (st.sel >= st.off + per) st.off = st.sel - per + 1; };
  return {
    enter() { window.addEventListener('keydown', onKey); },
    exit() { window.removeEventListener('keydown', onKey); },
    update() {
      const n = st.list.length, dir = navDir(), before = st.sel;
      if (dir === 'up') st.sel = Math.max(0, st.sel - 1);
      if (dir === 'down') st.sel = Math.min(n - 1, st.sel + 1);
      if (INPUT.hit('TABL') && !KEYS.KeyQ) st.sel = Math.max(0, st.sel - per);
      if (INPUT.hit('TABR') && !KEYS.KeyE) st.sel = Math.min(n - 1, st.sel + per);
      if (o.sorts && INPUT.hit('X')) setSort((st.sort + 1) % o.sorts.length);
      if (o.sorts && INPUT.hit('Y')) setSort(st.sort);
      if (o.filters && INPUT.hit('LT')) setFilt(-1);
      if (o.filters && INPUT.hit('RT')) setFilt(1);
      if (st.sel !== before) show();
      if (okHit() && !st.ate) pick(st.list[st.sel]);
      else if (backHit() && !st.ate) setScene(o.back);
      st.ate = false;
    },
    draw() {
      bgFill('#14283a', '#1b3a2f'); const s = S(), pad = INPUT.usingPad;
      const LX = 24 * s, LW = Math.round((VW - 48 * s) * 0.6), SX = LX + LW + 20 * s, SW = VW - SX - 24 * s;
      text(o.title, VW / 2, 32 * s, 26 * s, '#ffde3b', 'center');
      // search + filter
      const by = 60 * s, bh = 34 * s;
      searchBox(LX, by, LW * 0.6, bh, st.q, pad ? 'Search needs a keyboard' : 'Type to search');
      text(`${st.list.length} shown`, LX + LW * 0.6 - 10 * s, by + bh / 2 + 1, 11 * s, '#9ab', 'right', null);
      if (o.filters) {
        const v = o.filters[2][st.filt];
        button(LX + LW * 0.6 + 10 * s, by, LW * 0.4 - 10 * s, bh, `${o.filters[0]}: ${v || 'ALL'}`, () => setFilt(1), { size: 13 * s, wheel: d => setFilt(d) });
        if (pad) iconRow(['xbox_lt', 'xbox_rt'], LX + LW, by - 10 * s, 24, 10 * s, '#ccd', 'right');
      }
      // sort header
      let y0 = by + bh + 10 * s;
      if (o.sorts) {
        const hh = 28 * s;
        o.sorts.forEach(([label, , x], i) => {
          const hx = LX + x * LW, w = ((o.sorts[i + 1]?.[2] ?? 1) - x) * LW - 4 * s;
          button(hx, y0, w, hh, label + (i === st.sort ? (st.rev ? ' ^' : ' v') : ''), () => setSort(i), { on: i === st.sort, size: 11 * s });
        });
        y0 += hh + 6 * s;
      }
      // rows
      const rh = (o.rowH || 40) * s, listH = VH - y0 - 60 * s;
      per = Math.max(3, Math.floor(listH / rh));
      st.off = clamp(st.off, 0, Math.max(0, st.list.length - per));
      const scroll = d => { st.off = clamp(st.off + d * 3, 0, Math.max(0, st.list.length - per)); };
      for (let j = 0; j < per && st.off + j < st.list.length; j++) {
        const i = st.off + j, it = st.list[i], y = y0 + j * rh, on = i === st.sel;
        hot(LX, y, LW - 14 * s, rh - 4 * s, { hover: () => st.sel = i, click: () => pick(it), wheel: scroll });
        rrect(LX, y, LW - 14 * s, rh - 4 * s, 8 * s, on ? '#ffde3b' : overRect(LX, y, LW - 14 * s, rh - 4 * s) ? '#ffffff30' : j % 2 ? '#ffffff0c' : '#ffffff16');
        o.drawRow(it, LX, y, LW - 14 * s, rh - 4 * s, on);
      }
      if (!st.list.length) text('Nothing matches', LX + LW / 2, y0 + 40 * s, 18 * s, '#ccc', 'center', null);
      // scrollbar (click or drag the track)
      const tx = LX + LW - 8 * s, n = st.list.length;
      ctx.fillStyle = '#ffffff18'; ctx.fillRect(tx, y0, 6 * s, per * rh);
      if (n > per) {
        ctx.fillStyle = '#ffde3b'; ctx.fillRect(tx, y0 + st.off / n * per * rh, 6 * s, Math.max(10 * s, per / n * per * rh));
        const jump = () => { st.off = clamp(Math.round((MOUSE.y - y0) / (per * rh) * n - per / 2), 0, n - per); };
        hot(tx - 6 * s, y0, 18 * s, per * rh, { click: () => { st.drag = true; jump(); }, wheel: scroll });
        if (st.drag) { if (MOUSE.down) jump(); else st.drag = false; }
      }
      const it = st.list[st.sel];
      if (it) o.drawSide(it, SX, by, SW);
      hint(pad ? `A pick   B back   LB/RB page${o.sorts ? '   X sort   Y reverse' : ''}${o.filters ? '   LT/RT type' : ''}`
        : 'Type to search   click to pick   scroll to browse   right-click back');
      backButton(() => setScene(o.back));
    },
  };
}

function MovePicker(set, k, onPick, back) {
  const sp = DEX.species[toId(set.species)], taken = new Set(set.moves.filter((_, i) => i !== k));
  const all = legalMoves(sp).filter(id => !taken.has(id)).map(id => DEX.moves[id]);
  const CLEAR = { id: '', name: '- Remove this move -' };
  const byName = (a, b) => a.name.localeCompare(b.name);
  const types = ['', ...Object.keys(TYPE_COLOR)];
  const [pi, ci] = slotIcons(k);
  return SearchList({
    title: `MOVE ${k + 1} FOR ${sp.name.toUpperCase()}`, all, cur: DEX.moves[set.moves[k]] || all[0], rowH: 40,
    pinned: set.moves[k] && set.moves.length > 1 ? [CLEAR] : null,
    match: (m, q) => toId(m.name).includes(q) || toId(m.type).startsWith(q) || toId(archWord(m)).includes(q) || toId(m.category).startsWith(q),
    filters: ['TYPE', (m, v) => m.type === v, types],
    sorts: [
      ['TYPE', (a, b) => a.type.localeCompare(b.type) || byName(a, b), 0],
      ['NAME', byName, 0.16],
      ['CATEGORY', (a, b) => a.category.localeCompare(b.category) || byName(a, b), 0.47],
      ['POWER', (a, b) => (b.basePower || 0) - (a.basePower || 0) || byName(a, b), 0.6],
      ['COOLDOWN', (a, b) => moveCd(a) - moveCd(b) || byName(a, b), 0.71],
      ['STYLE', (a, b) => archWord(a).localeCompare(archWord(b)) || byName(a, b), 0.84],
    ].map(([l, c, x], i) => [l, c, x]).sort((a, b) => a[2] - b[2]),
    drawRow(m, x, y, w, h, on) {
      const s = S(), mid = y + h / 2, dk = on ? '#111' : '#fff', sub = on ? '#333' : '#bcd';
      if (!m.id) { text(m.name, x + w / 2, mid, 14 * s, on ? '#111' : '#f99', 'center', null); return; }
      hudChip(x + 6 * s, mid - 10 * s, m.type.toUpperCase(), TYPE_COLOR[m.type], 20 * s);
      text(m.name, x + w * 0.16 + 4 * s, mid, 14 * s, dk, 'left', null);
      const [cl, cc] = CAT[m.category]; rrect(x + w * 0.47, mid - 9 * s, w * 0.12, 18 * s, 9 * s, cc); text(cl, x + w * 0.53, mid + 1, 9 * s, '#fff', 'center', null);
      text(m.basePower ? String(m.basePower) : '-', x + w * 0.655, mid, 13 * s, dk, 'center', null);
      text(moveCd(m).toFixed(1) + 's', x + w * 0.775, mid, 13 * s, dk, 'center', null);
      text(archWord(m), x + w * 0.85, mid, 12 * s, sub, 'left', null);
    },
    drawSide(m, x, y, w) {
      const s = S();
      iconRow(['Slot ' + (k + 1) + '  ', pi, ci], x, y + 10 * s, 32, 13 * s, '#9ab');
      if (!m.id) { text('Leaves this slot empty', x, y + 60 * s, 16 * s, '#ccc', 'left', null); return; }
      const ph = w * PV_H / PV_W;
      drawMovePreview(set, m.id, x, y + 30 * s, w, ph);
      let yy = y + 30 * s + ph + 26 * s;
      text(m.name, x, yy, 22 * s, '#fff', 'left'); yy += 30 * s;
      let cx = x + hudChip(x, yy - 11 * s, m.type.toUpperCase(), TYPE_COLOR[m.type], 22 * s);
      cx += hudChip(cx, yy - 11 * s, CAT[m.category][0], CAT[m.category][1], 22 * s);
      const acc = m.accuracy === true ? 'sure hit' : `hitbox ${m.accuracy}%`;
      text(`${m.basePower ? 'POW ' + m.basePower + '   ' : ''}CD ${moveCd(m).toFixed(1)}s   ${acc}`, cx + 6 * s, yy, 12 * s, '#dde', 'left', null); yy += 28 * s;
      const [aw, ad] = ARCH_INFO[archetype(m)] || [archetype(m), ''];
      text(aw.toUpperCase(), x, yy, 14 * s, '#ffde3b', 'left', null); yy += 20 * s;
      wrapText(ad, x, yy, w, 12 * s, '#cde'); yy += 40 * s;
      if (m.shortDesc) wrapText(m.shortDesc, x, yy, w, 12 * s, '#ffe7a8');
    },
    onPick: m => onPick(m.id), back,
  });
}

function ItemPicker(set, onPick, back) {
  const sp = DEX.species[toId(set.species)], NONE = { id: '', name: '(none)', shortDesc: 'No held item.' };
  const mine = it => it.megaStone && DEX.species[it.megaStone]?.baseSpecies === sp.id;
  const all = Object.entries(DEX.items).map(([id, it]) => ({ id, ...it }))
    .sort((a, b) => (mine(b) - mine(a)) || (!!a.megaStone - !!b.megaStone) || a.name.localeCompare(b.name));
  return SearchList({
    title: 'HELD ITEM', all, pinned: [NONE], cur: all.find(it => it.name === set.item) || NONE, rowH: 40,
    match: (it, q) => toId(it.name).includes(q) || (it.megaStone && 'megastone'.startsWith(q)),
    drawRow(it, x, y, w, h, on) {
      const s = S(), mid = y + h / 2;
      itemIcon(it.name, x + 22 * s, mid, 24 * s);
      text(it.name, x + 46 * s, mid, 15 * s, on ? '#111' : '#fff', 'left', null);
      if (it.id && !ITEM_WORKS(it.id)) text('does nothing yet', x + w - 10 * s, mid, 11 * s, on ? '#333' : '#889', 'right', null);
      else if (mine(it)) text('MEGA STONE', x + w - 10 * s, mid, 11 * s, on ? '#333' : '#ffde3b', 'right', null);
    },
    drawSide(it, x, y, w) {
      const s = S();
      rrect(x, y + 30 * s, 96 * s, 96 * s, 12 * s, '#00000055', '#ffffff44', 2);
      itemIcon(it.name, x + 48 * s, y + 78 * s, 72 * s);
      text(it.name, x + 112 * s, y + 60 * s, 22 * s, '#fff', 'left');
      if (it.id) text(ITEM_WORKS(it.id) ? 'Works in PokeArena' : 'Does nothing in PokeArena yet', x + 112 * s, y + 92 * s, 13 * s, ITEM_WORKS(it.id) ? '#7be07b' : '#f99', 'left', null);
      wrapText(it.shortDesc || '', x, y + 150 * s, w, 14 * s, '#ffe7a8');
    },
    onPick: it => onPick(it.id ? it.name : ''), back,
  });
}
