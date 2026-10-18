// Touch controls for phones and tablets. Appears on the first touchstart; core.js reads TOUCH.h (pad-style buttons) and TOUCH.sx/sy (left stick) inside INPUT.poll.
// A floating stick under the left thumb (world and battle only), round A B X Y / dodge / menu buttons on the right (same names the pad uses), taps become mouse clicks
// (run straight from the touch handler so file pickers and the keyboard may open), swipes scroll lists, and a hidden <input> brings up the phone keyboard for text fields.
'use strict';
const TOUCH = window.TOUCH = (() => {
  const T = { on: false, h: {}, p: {}, sx: 0, sy: 0 }, R = 52, SENT = String.fromCharCode(0x200b), tps = new Map(), down = {};
  // key (INPUT name), label, size, centre from right (or from left when negative), centre from bottom (0 = top row), when shown, colour, label in menus
  // when: all | play (walking or fighting) | fight | chat | ride | bag (an Adventure fight with items to use) | menu (a screen, not the world: the d-pad)
  const BTN = [
    ['A', 'A', 64, 92, 56, 'all', '#5ad26b'], ['B', 'B', 56, 32, 118, 'all', '#e8554e'], ['X', 'X', 56, 152, 118, 'play', '#4aa3ff'], ['Y', 'Y', 56, 92, 180, 'play', '#ffde3b'],
    ['LB', 'DODGE', 54, 214, 100, 'fight', '#c58bff', 'LB'], ['RB', 'SWAP', 50, 214, 166, 'fight', '#ff9f43', 'RB'], ['LTRT', 'MEGA', 46, 276, 134, 'fight', '#ff5fd2'],   // clear of the move bar along the bottom
    ['START', 'MENU', 46, 36, 0, 'play', '#ffffff'], ['CHAT', 'CHAT', 46, 90, 0, 'chat', '#ffffff'], ['BACK', 'RIDE', 46, 144, 0, 'ride', '#ffffff'], ['ITEM', 'BAG', 46, 90, 0, 'bag', '#ffffff'],
    ['UP', '\u25B2', 46, -78, 140, 'menu', '#cfd8ff'], ['DOWN', '\u25BC', 46, -78, 44, 'menu', '#cfd8ff'], ['LEFT', '\u25C0', 46, -30, 92, 'menu', '#cfd8ff'], ['RIGHT', '\u25B6', 46, -126, 92, 'menu', '#cfd8ff'],
  ];
  const css = document.createElement('style');
  css.textContent = `html,body{touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
#touch{position:fixed;inset:0;z-index:5;pointer-events:none;display:none}
#touch .tb{position:absolute;box-sizing:border-box;border-radius:50%;background:rgba(18,26,56,.5);border:3px solid;color:#fff;font:700 18px Bungee,"Arial Black",sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:auto;box-shadow:inset 0 -5px 0 rgba(0,0,0,.35),0 2px 0 rgba(0,0,0,.5);text-shadow:2px 2px 0 #000;opacity:.8;touch-action:none}
#touch .tb.sm{font-size:10px;font-family:Silkscreen,"Arial Black",sans-serif}
#touch .tb.dn{background:rgba(255,222,59,.65);color:#111;text-shadow:none}
#touch .st{position:absolute;border-radius:50%;box-sizing:border-box;pointer-events:none;border:3px solid rgba(255,255,255,.55);background:rgba(18,26,56,.3);opacity:.25}
#touch .st.on{opacity:.8}
#touch .kn{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.7);border:3px solid #fff;box-sizing:border-box}
#trot{position:fixed;inset:0;z-index:9;display:none;align-items:center;justify-content:center;text-align:center;padding:24px;background:#101830;color:#ffde3b;font:700 20px Bungee,\"Arial Black\",sans-serif}
#touch.menu .tb{opacity:.6}
#touch.fight .tb.top{top:calc(env(safe-area-inset-top,0px) + 64px)!important}
#tkbd{position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;z-index:-1}`;
  document.head.appendChild(css);
  const root = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'touch' }));
  const base = root.appendChild(Object.assign(document.createElement('div'), { className: 'st' })), knob = base.appendChild(Object.assign(document.createElement('div'), { className: 'kn' }));
  base.style.cssText = 'width:' + R * 2 + 'px;height:' + R * 2 + 'px;display:none';
  const els = {};
  for (const [k, label, sz, r, b, when, col, ml] of BTN) {
    const e = els[k] = root.appendChild(Object.assign(document.createElement('div'), { className: 'tb' + (label.length > 1 ? ' sm' : ''), textContent: label }));
    const side = r < 0 ? `left:calc(env(safe-area-inset-left,0px) + ${-r - sz / 2}px);` : `right:calc(env(safe-area-inset-right,0px) + ${r - sz / 2}px);`;
    e.dataset.k = k; e.dataset.when = when; e.dataset.l = label; e.dataset.ml = ml || label; if (!b) e.classList.add('top');
    e.style.cssText = `width:${sz}px;height:${sz}px;border-color:${col};` + side + (b ? `bottom:calc(env(safe-area-inset-bottom,0px) + ${b - sz / 2}px)` : 'top:calc(env(safe-area-inset-top,0px) + 10px)');
  }
  // turn the phone: every screen is laid out for landscape
  const rot = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'trot', textContent: 'Turn your phone sideways to play' }));
  // ---------- phone keyboard: a hidden input whose edits are replayed as keydown events, so every existing text field just works ----------
  const inp = document.body.appendChild(Object.assign(document.createElement('input'), { id: 'tkbd', type: 'text', value: SENT }));
  for (const [a, v] of [['autocomplete', 'off'], ['autocapitalize', 'off'], ['autocorrect', 'off'], ['spellcheck', 'false'], ['enterkeyhint', 'done'], ['aria-hidden', 'true']]) inp.setAttribute(a, v);
  const send = k => { const o = { key: k, code: k === 'Enter' || k === 'Backspace' ? k : '', bubbles: true, cancelable: true }; window.dispatchEvent(new KeyboardEvent('keydown', o)); window.dispatchEvent(new KeyboardEvent('keyup', o)); };
  let shown = '', comp = false, enter = false;
  const sync = () => {   // replay what changed since last time: a diff, so predictive-text composing works too
    const v = inp.value, ok = v.startsWith(SENT), t = ok ? v.slice(1) : v;
    if (!ok && !t && !shown) send('Backspace');
    else { let i = 0; while (i < shown.length && i < t.length && shown[i] === t[i]) i++; for (let j = shown.length; j > i; j--) send('Backspace'); for (const c of t.slice(i)) send(c); }
    if (comp) shown = t; else { shown = ''; inp.value = SENT; }
  };
  inp.addEventListener('input', sync);
  inp.addEventListener('compositionstart', () => comp = true);
  inp.addEventListener('compositionend', () => { comp = false; sync(); });
  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); enter = true; send('Enter'); inp.blur(); enter = false; }
    else if (e.key === 'Backspace' && !comp) { e.preventDefault(); send('Backspace'); }
  });
  inp.addEventListener('blur', () => { if (!enter && typeof AdventureScene !== 'undefined' && AdventureScene.typing) send('Enter'); });   // a closed keyboard sends the chat line
  T.kbd = () => { shown = ''; comp = false; inp.value = SENT; inp.blur(); inp.focus(); };
  // ---------- where the thumbs may steer ----------
  const adv = () => typeof AdventureScene !== 'undefined' && SCENE === AdventureScene;
  const arena = () => !!(SCENE && SCENE.battle && typeof B !== 'undefined' && B && !B.paused && !B.over && !B.choose);   // the Battle / Online fight, while it is being fought
  const play = () => adv() ? !!(SCENE.save && SCENE.ready && !SCENE.uis.length) : arena();
  const fight = () => adv() ? SCENE.mode === 'battle' || SCENE.mode === 'pvp' : arena();
  const stickOK = () => play() && (!adv() || (!SCENE.wh && (SCENE.mode === 'walk' || SCENE.mode === 'battle' || SCENE.mode === 'pvp')));
  setInterval(() => {
    if (!T.on) return;
    const p = play(), f = fight(), c = adv() && SCENE.mode === 'walk' && !SCENE.uis.length && !SCENE.typing && SCENE.chatOn && SCENE.chatOn();
    const r = adv() && SCENE.mode === 'walk' && !SCENE.uis.length && !SCENE.typing && !!SCENE.save && (!!SCENE.mount || !!ADVP.mountKind(SCENE.save, SCENE.save.party[SCENE.leadIdx()]));   // the mount button: anything to get on, or off
    const bag = adv() && SCENE.mode === 'battle' && !SCENE.wh && !!B && !B.over && typeof ADVUI !== 'undefined' && ADVUI.wheelItems(SCENE).length > 0;   // the item wheel (C on a keyboard)
    const m = !stickOK() && !(typeof TitleScene !== 'undefined' && SCENE === TitleScene);   // a screen, not the world: the d-pad, A and B (the other buttons are the icons in its hint, ui.js)
    root.classList.toggle('menu', m); root.classList.toggle('fight', f);
    rot.style.display = innerHeight > innerWidth * 1.1 ? 'flex' : 'none';
    for (const k in els) {
      const e = els[k], w = e.dataset.when, on = (w === 'bag' && bag) || w === 'all' || (w === 'play' && p) || (w === 'fight' && p && f && !m) || (w === 'chat' && c) || (w === 'ride' && r) || (w === 'menu' && m);
      e.style.display = on ? 'flex' : 'none';
      const l = m ? e.dataset.ml : e.dataset.l; if (e.textContent !== l) { e.textContent = l; e.classList.toggle('sm', l.length > 1); }
    }
    base.classList.toggle('on', sid !== null); if (sid === null) { const ok = stickOK(); base.style.display = ok ? 'block' : 'none'; base.style.left = '28px'; base.style.top = innerHeight - 64 - R * 2 + 'px'; }
  }, 120);
  // ---------- touches ----------
  let sid = null, ox = 0, oy = 0;
  const setStick = (x, y) => {
    let dx = x - ox, dy = y - oy; const l = Math.hypot(dx, dy), m = Math.min(1, l / R);
    if (l < 8) T.sx = T.sy = 0; else { T.sx = dx / l * m; T.sy = dy / l * m; }
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  function tap(x, y) {
    MOUSE.x = x; MOUSE.y = y; MOUSE.moved = performance.now();
    let onField = false;
    for (let i = HOT.length - 1; i >= 0; i--) {
      const h = HOT[i]; if (x < h.x || x > h.x + h.w || y < h.y || y > h.y + h.h) continue;
      if (h.field) { onField = true; T.kbd(); }
      if (h.click) { h.click((x - h.x) / h.w); if (h.hover) h.hover(); MOUSE.hit = false; if (!onField && document.activeElement === inp) inp.blur(); return; }   // hover after the click: a tap is not a hover first (a menu row's first tap only selects it)
      if (h.hover) h.hover();
      break;
    }
    if (!onField && document.activeElement === inp) inp.blur();
    MOUSE.hit = true;
  }
  const hold = (k, d) => { down[k] = (down[k] | 0) + d; T.h[k] = down[k] > 0; if (d > 0) T.p[k] = true; els[k] && els[k].classList.toggle('dn', down[k] > 0); };
  const opt = { passive: false, capture: true };
  document.addEventListener('touchstart', e => {
    if (!T.on) { T.on = true; root.style.display = 'block'; const d = document.documentElement; try { (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d, { navigationUI: 'hide' })?.catch?.(() => {}); } catch {} }
    e.preventDefault(); unlockAudio(); INPUT.usingPad = false;
    for (const t of e.changedTouches) {
      const b = t.target.closest && t.target.closest('[data-k]'), o = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, t0: performance.now(), acc: 0, swipe: false };
      MOUSE.x = t.clientX; MOUSE.y = t.clientY; MOUSE.moved = performance.now();
      if (b) { o.k = b.dataset.k; if (o.k !== 'CHAT') hold(o.k, 1); }
      else if (sid === null && stickOK() && t.clientX < innerWidth * 0.55) { sid = t.identifier; o.stick = true; ox = t.clientX; oy = t.clientY; base.style.display = 'block'; base.style.left = ox - R + 'px'; base.style.top = oy - R + 'px'; setStick(ox, oy); }
      tps.set(t.identifier, o);
    }
  }, opt);
  document.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const o = tps.get(t.identifier); if (!o) continue;
      if (o.stick) setStick(t.clientX, t.clientY);
      else if (!o.k) {   // a swipe scrolls whatever list is under the finger
        MOUSE.x = t.clientX; MOUSE.y = t.clientY; o.acc += o.y - t.clientY;
        while (Math.abs(o.acc) >= 38) { const s = Math.sign(o.acc); MOUSE.wheel += s; o.acc -= s * 38; o.swipe = true; }
      }
      o.x = t.clientX; o.y = t.clientY;
    }
  }, opt);
  const end = (e, cancel) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const o = tps.get(t.identifier); if (!o) continue; tps.delete(t.identifier);
      if (o.k) { if (o.k === 'CHAT') { if (!cancel) { KEYS.Enter = true; setTimeout(() => KEYS.Enter = false, 140); T.kbd(); } } else hold(o.k, -1); continue; }
      if (o.stick) { sid = null; T.sx = T.sy = 0; knob.style.transform = ''; }
      if (!cancel && !o.swipe && performance.now() - o.t0 < 380 && Math.hypot(t.clientX - o.x0, t.clientY - o.y0) < 16) tap(t.clientX, t.clientY);
    }
  };
  document.addEventListener('touchend', end, opt);
  document.addEventListener('touchcancel', e => end(e, true), opt);
  return T;
})();
