// Character creator (docs/OUTFITS.md P2): the model (pure) and the sheet composer. save.outfit = { body, hair, hairC, hat, hatC, top, topC, bot, botC, bag, bagC, skin }, small ints; hat and bag 0 = none.
// Parts are Pokemon Ranger NPC pixels (data/adv/outfits.js, built by tools/build-outfits.py), stored per frame in slot space: a strip of nf frame boxes (sw x sh) per plane.
// Recolourable planes are white and filled with source-in on a scratch canvas (no getImageData, file:// safe). Draw order: the body's own template pixels (only show where
// no part draws, under them the hair and cap donors' own pixels round their part 'r', for gaps), bottom, top, the hair donor's face, the body's face, hair (cut by
// the hat's cover), hat, bag. Head parts follow the body's face (d offsets per frame); a rigid donor (stands only) maps each frame to its stand (src).
// The composed strip is then laid out like a Ranger NPC sheet (anims 'walk.<dir>' / 'idle.<dir>': {row, n, fps}), so drawOW walks and breathes it like the NPCs. Cached per outfit.
'use strict';
const ADVO = {
  KEYS: ['body', 'hair', 'hairC', 'hat', 'hatC', 'top', 'topC', 'bot', 'botC', 'bag', 'bagC', 'skin'],
  ROWS: ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft'],
  cache: new Map(),
  D: () => window.ADV_OUTFIT,
  // how many values each key takes
  n() { const D = this.D(), r = D.ramps.length; return { body: D.body.length, hair: D.hair.length, hairC: r, hat: D.hat.length + 1, hatC: r, top: D.top.length, topC: r, bot: D.bot.length, botC: r, bag: D.bag.length + 1, bagC: r, skin: D.skins.length }; },
  def() { return { ...this.D().defaults }; },
  // anything (an old save, a wire array's object, a hostile peer) -> a valid outfit; missing or out of range keys take the default
  clean(o) { const d = this.def(), n = this.n(), r = {}; for (const k of this.KEYS) { const v = o && o[k]; r[k] = Number.isInteger(v) && v >= 0 && v < n[k] ? v : d[k]; } return r; },
  rand(rnd = Math.random) { const n = this.n(), r = {}; for (const k of this.KEYS) r[k] = Math.floor(rnd() * n[k]); if (rnd() < 0.5) r.hat = 0; if (rnd() < 0.5) r.bag = 0; return r; },
  arr(o) { return this.KEYS.map(k => o[k]); },
  obj(a) { const o = {}; this.KEYS.forEach((k, i) => o[k] = Array.isArray(a) ? a[i] : undefined); return this.clean(o); },
  key: o => ADVO.KEYS.map(k => o[k]).join('.'),
  // the name shown for a key's value in the creator ('' for colours)
  label(k, o) { const D = this.D(), v = o[k]; if (/C$|skin/.test(k)) return ''; if (k === 'hat' || k === 'bag') return v ? D[k][v - 1].n : 'None'; return D[k][v].n; },
  files() { return Object.values(this.D().files); },
  ready() { return this.files().every(f => img(f)); },
  // the composed sheet as an overworld sheet object (drawOW reads .cv and .anims), or null while the atlases load
  sheet(o) {
    const D = this.D(); o = this.clean(o); const k = this.key(o); let c = this.cache.get(k); if (c) return c;
    const A = {}; for (const f in D.files) if (!(A[f] = img(D.files[f]))) return null;
    const { nf, sw, sh } = D, W = nf * sw, B = D.body[o.body];
    const mk = (w, h) => { const v = document.createElement('canvas'); v.width = w; v.height = h; return v; };
    const strip = mk(W, sh), head = mk(W, sh), tmp = mk(W, sh), g = strip.getContext('2d'), hg = head.getContext('2d'), tg = tmp.getContext('2d');
    const colour = (key, step) => '#' + (key === 's' ? D.skins[o.skin][step] : D.ramps[o[key + 'C']][step]);
    // one field of a part record (its planes) onto dst: frame k comes from source frame src[k] (rigid parts reuse their stand), moved by off[k], clipped to its box
    const layer = (cat, rec, field, dst, off, mode) => {
      const pl = typeof rec[field] === 'number' ? [['m', 0, rec[field]]] : rec[field];
      for (const [key, step, row] of pl) {
        tg.clearRect(0, 0, W, sh);
        for (let f = 0; f < nf; f++) {
          const s = rec.src ? rec.src[f] : f, [dx, dy] = off ? off[f] : [0, 0];
          tg.save(); tg.beginPath(); tg.rect(f * sw, 0, sw, sh); tg.clip(); tg.drawImage(A[cat], s * sw, row * sh, sw, sh, f * sw + dx, dy, sw, sh); tg.restore();
        }
        if (key !== 'x' && key !== 'm') { tg.globalCompositeOperation = 'source-in'; tg.fillStyle = colour(key, step); tg.fillRect(0, 0, W, sh); tg.globalCompositeOperation = 'source-over'; }
        dst.globalCompositeOperation = mode || 'source-over'; dst.drawImage(tmp, 0, 0); dst.globalCompositeOperation = 'source-over';
      }
    };
    const follow = (rec, anchor) => B[anchor].map((d, f) => [d[0] - rec[anchor][f][0], d[1] - rec[anchor][f][1]]);   // a donor's frame moved so it lands where the body's face (or torso) is
    const H = D.hair[o.hair], off = follow(H, 'd'), T = o.hat ? D.hat[o.hat - 1] : null, toff = T && follow(T, 'd');
    layer('hair', H, 'r', g, off); if (T) layer('hat', T, 'r', g, toff);   // the donors' own pixels round hair and cap: they only show in gaps
    layer('body', B, 'b', g);
    layer('bot', D.bot[o.bot], 'p', g); layer('top', D.top[o.top], 'p', g);
    layer('hair', H, 'u', g, off); layer('body', B, 'p', g); layer('hair', H, 'p', hg, off);
    if (T) { layer('hat', T, 'cv', hg, toff, 'destination-out'); layer('hat', T, 'p', hg, toff); }
    g.drawImage(head, 0, 0);
    if (o.bag) { const G = D.bag[o.bag - 1]; layer('bag', G, 'p', g, follow(G, 't')); }
    // lay the frames out like a Ranger NPC sheet: each frame box where ranger-cut.py pack puts the body's own frame (mirrored rows flip the box)
    const out = mk(B.fw * Math.max(...B.cells.map(r => r.length)), B.fh * B.cells.length), og = out.getContext('2d');
    B.cells.forEach((row, r) => row.forEach(([f, fl, bx, by], cc) => {
      og.save(); og.beginPath(); og.rect(cc * B.fw, r * B.fh, B.fw, B.fh); og.clip();
      if (fl) { og.translate(cc * B.fw + bx + sw, r * B.fh + by); og.scale(-1, 1); og.drawImage(strip, f * sw, 0, sw, sh, 0, 0, sw, sh); }
      else og.drawImage(strip, f * sw, 0, sw, sh, cc * B.fw + bx, r * B.fh + by, sw, sh);
      og.restore();
    }));
    c = { file: 'outfit:' + k, cv: out, fw: B.fw, fh: B.fh, footY: B.footY, anims: B.anims, rows: Object.keys(B.anims) }; out.src = c.file;
    this.cache.set(k, c); return c;
  },
};
