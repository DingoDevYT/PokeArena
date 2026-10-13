// Custom Mega Tatsugiri Stretchy (0978-4) and Droopy (0978-5, see 0978-5.mjs) from the OFFICIAL Mega Tatsugiri
// (curly) body sheets in SpriteCollab (0978/0003). The official mega is three Tatsugiri on a dish; the centre
// one is the form that evolved. So the official frames are re-coloured: the centre body takes the new form's
// colours (Stretchy yellow, Droopy pink) and the copy that had that colour becomes the Curly orange one.
// The roe crown (top rows of the orange) stays orange. No pixels are moved, only palette-swapped.
// Usage: node tools/mega-custom/0978-4.mjs
import { run, keepEffects, hex, key, K, closeOutline, isMain } from './0801-2.mjs';

const ORANGE = ['f37432', 'bf3d06', 'ffc0a2', 'dc8173'].map(K);
const YEL = ['fff700', 'cc9f00'].map(K), PINK = ['ff0664', 'a50c5e'].map(K);
const m = (from, to) => new Map(from.map((k, i) => [k, hex(to[i])]));
export const TO = {
  stretchy: { centre: m(ORANGE, ['fff700', 'cc9f00', 'ffff8f', 'dfb700']), copy: m(YEL, ['f37432', 'bf3d06']), from: YEL },
  droopy: { centre: m(ORANGE, ['ff0664', 'a50c5e', 'f66592', 'd90059']), copy: m(PINK, ['f37432', 'bf3d06']), from: PINK },
};
export const tatsu = kind => keepEffects(f => {
  const { W, H, px } = f, kk = px.map(key), out = px.slice(), t = TO[kind];
  let top = 1e9; for (let i = 0; i < W * H; i++) if (ORANGE.includes(kk[i])) top = Math.min(top, (i / W) | 0);
  for (let i = 0; i < W * H; i++) {
    if (ORANGE.includes(kk[i])) { if (((i / W) | 0) > top + 3) out[i] = t.centre.get(kk[i]); }
    else if (t.copy.has(kk[i])) out[i] = t.copy.get(kk[i]);
  }
  return out;
});
if (isMain(import.meta.url)) await run({ key: '0978-4', base: '0978/0003', portrait: '0978/0004', mega: tatsu('stretchy') });
