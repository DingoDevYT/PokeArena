// Builds a custom PMD-style Mega Metagross (0376-1) from the base Metagross sheets (SpriteCollab sprite/0376).
// Output: assets/sprite-custom/0376-1/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0376-1.mjs [Walk Idle ...]   (no args = every sheet; DEV=1 keeps meta/preview in scratch)
// ==== shared mega-builder plumbing (same in every tools/mega-custom/<key>.mjs of this batch) ====
// Base sheets come from SpriteCollab, cached in tools/.cache/mega-base/<dex4>/. Each frame gets a
// WORK px margin, megaFrame() edits it, then the sheet is trimmed to the smallest pad that fits
// (x symmetric so the centre holds, multiples of 4); footY moves down by the top pad.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..'); // from tools/mega-custom/
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base');
const WORK = 16;

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const key = (r, g, b) => ((r << 16) | (g << 8) | b);
const K = s => key(...hex(s));
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BLACK = 0;

// Cached GET of a SpriteCollab file; returns a local path or null on 404 (remembered).
async function cached(rel, local) {
  const file = path.join(CACHE, local), miss = file + '.404';
  if (fs.existsSync(file) && fs.statSync(file).size) return file;
  if (fs.existsSync(miss)) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(RAW + rel);
      if (res.status === 404) { fs.writeFileSync(miss, ''); return null; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      await new Promise(r => setTimeout(r, 150)); // polite
      return file;
    } catch (e) {
      if (i >= 3) throw new Error(rel + ': ' + e.message);
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
}
const tag = (xml, n) => xml.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1];
// Unique sheets of a SpriteCollab folder: [{ name, fw, fh, footY, png }] (CopyOf entries resolved away).
async function sheetsOf(dir, local) {
  const xmlFile = await cached(`sprite/${dir}/AnimData.xml`, `${local}/AnimData.xml`);
  if (!xmlFile) return [];
  const xml = fs.readFileSync(xmlFile, 'utf8'), out = [];
  for (const [, body] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    if (tag(body, 'CopyOf')) continue;
    const name = tag(body, 'Name'), fw = +tag(body, 'FrameWidth'), fh = +tag(body, 'FrameHeight');
    const f = await cached(`sprite/${dir}/${name}-Anim.png`, `${local}/${name}-Anim.png`);
    if (!f) continue;
    const sh = await cached(`sprite/${dir}/${name}-Shadow.png`, `${local}/${name}-Shadow.png`);
    let footY = Math.round(fh * 0.75);
    if (sh) { // same rule as tools/fetch-sprites.mjs: mean shadow row of the first frame
      const s = PNG.sync.read(fs.readFileSync(sh)); let sum = 0, n = 0;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (s.data[(y * s.width + x) * 4 + 3]) { sum += y; n++; }
      if (n) footY = Math.round(sum / n);
    }
    out.push({ name, fw, fh, footY, file: f, png: PNG.sync.read(fs.readFileSync(f)) });
  }
  return out;
}

function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2;
  const px = new Array(W * H).fill(null); // null = transparent, else [r,g,b]
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px };
}

// Pixel-editing helpers bound to one working frame.
function canvas(W, H, out) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const k = p => (p ? key(...p) : -1);
  const get = (x, y) => (inside(x, y) ? out[y * W + x] : null);
  const set = (x, y, c) => { if (inside(x, y)) out[y * W + x] = c; };
  const comps = (test, src = out) => {
    const seen = new Uint8Array(W * H), list = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || !test(src[i], i)) continue;
      const blob = [], st = [i]; seen[i] = 1;
      while (st.length) {
        const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of N4) {
          const n = (y + dy) * W + x + dx;
          if (inside(x + dx, y + dy) && !seen[n] && test(src[n], n)) { seen[n] = 1; st.push(n); }
        }
      }
      list.push(blob);
    }
    return list;
  };
  // Stamp rows of chars; pal maps char -> colour, '.' keeps. mode 'behind' only paints empty / outer-outline pixels.
  const stamp = (rows, ox, oy, pal, { mirror = false, mode = 'front' } = {}) => rows.forEach((row, py) => [...row].forEach((c, pxi) => {
    if (c === '.' || c === ' ') return;
    const x = ox + (mirror ? row.length - 1 - pxi : pxi), y = oy + py;
    if (!inside(x, y)) return;
    if (mode === 'behind' && out[y * W + x] && !(k(out[y * W + x]) === BLACK && N4.some(([dx, dy]) => !get(x + dx, y + dy)))) return;
    if (mode === 'on' && !out[y * W + x]) return;
    out[y * W + x] = pal[c];
  }));
  // Close every open edge with a black outline.
  const outline = () => {
    const src = out.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (src[y * W + x]) continue;
      if (N4.some(([dx, dy]) => { const p = inside(x + dx, y + dy) ? src[(y + dy) * W + x + dx] : null; return p && k(p) !== BLACK; })) out[y * W + x] = [0, 0, 0];
    }
  };
  const bbox = blob => {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const i of blob) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  // Tapered spike from base point (x0, y0) along e, length L, base width w. cols = [lit, mid, shade]
  // across its width (lit side = the side facing up-left). mode 'behind' only fills empty / outer-outline
  // pixels; 'front' paints over and rings the patch with a black seam.
  const spike = (x0, y0, e, L, w, cols, mode = 'front') => {
    const m = Math.hypot(e[0], e[1]), ex = e[0] / m, ey = e[1] / m;
    let px_ = -ey, py_ = ex; if (px_ + py_ > 0) { px_ = -px_; py_ = -py_; } // perp pointing up-left
    const patch = new Map();
    for (let t = 0; t <= L; t += 0.25) {
      const hw = (w / 2) * (1 - t / (L + 0.5));
      for (let s = -hw; s <= hw; s += 0.25) {
        const x = Math.round(x0 + ex * t + px_ * s), y = Math.round(y0 + ey * t + py_ * s);
        const col = s > hw / 3 ? 0 : s < -hw / 3 ? 2 : 1;
        if (!patch.has(y * W + x) || col === 1) patch.set(y * W + x, col);
      }
    }
    for (const [i, col] of patch) {
      const x = i % W, y = (i / W) | 0; if (!inside(x, y)) continue;
      if (mode === 'behind' && out[i] && !(k(out[i]) === BLACK && N4.some(([dx, dy]) => !get(x + dx, y + dy)))) continue;
      out[i] = cols[col];
    }
    if (mode === 'front') for (const [i] of patch) for (const [dx, dy] of N4) {
      const x = i % W + dx, y = ((i / W) | 0) + dy, n = y * W + x;
      if (inside(x, y) && !patch.has(n) && out[n]) out[n] = [0, 0, 0];
    }
    return patch;
  };
  // Topmost filled row per column (H if empty).
  // Mask of the creature itself: 4-connected blobs at least 20% the size of the biggest (drops effect
  // sprites such as sweat lines, sparkles and Zs, which are separate small blobs).
  const bodyMask = () => {
    const bl = comps(p => !!p), big = Math.max(0, ...bl.map(b => b.length)), m = new Uint8Array(W * H);
    for (const b of bl) if (b.length >= big * 0.2) for (const i of b) m[i] = 1;
    return m;
  };
  const topProfile = (m = null) => [...Array(W)].map((_, x) => { let y = 0; while (y < H && !(out[y * W + x] && (!m || m[y * W + x]))) y++; return y; });
  return { inside, k, get, set, comps, stamp, outline, bbox, spike, topProfile, bodyMask };
}

// spec: { key, dex, form, megaFrame(f, facing, ctx) -> px[], facing?(name, row, col) }
async function run(spec) {
  const OUT = path.join(ROOT, 'assets/sprite-custom', spec.key);
  const base = await sheetsOf(spec.dex, spec.dex);
  const official = new Set((await sheetsOf(`${spec.dex}/${spec.form}`, `${spec.dex}-${spec.form}`)).map(s => s.name));
  const portraitFile = await cached(`portrait/${spec.dex}/${spec.form}/Normal.png`, `${spec.dex}-${spec.form}/portrait.png`);
  const want = process.argv.slice(2);
  const todo = base.filter(s => !official.has(s.name));
  if (official.size) console.log('official mega sheets kept as-is:', [...official].join(' '));
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  // Spinning sheets (Rotate, Swing...) turn through every facing inside a row: the facing of each frame
  // is the Idle direction whose frame-0 pixels it matches best (bottom-centre aligned, +-2 px).
  const sig = (png, fx, fy, fw, fh) => {
    const pts = []; let x0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const i = ((fy + y) * png.width + fx + x) * 4; if (!png.data[i + 3]) continue;
      pts.push([x, y, key(png.data[i], png.data[i + 1], png.data[i + 2])]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const cx = Math.round((x0 + x1) / 2), m = new Map(pts.map(([x, y, c]) => [(y - y1) * 1000 + (x - cx), c]));
    return m;
  };
  const idle = base.find(b => b.name === 'Idle');
  const refs = idle ? [...Array(Math.min(8, idle.png.height / idle.fh))].map((_, r) => sig(idle.png, 0, r * idle.fh, idle.fw, idle.fh)) : [];
  const SPIN = new Set(spec.spin || ['Rotate', 'Swing', 'Twirl', 'Ricochet', 'Spin']);
  const detect = m => {
    let best = 0, bd = 0;
    refs.forEach((ref, d) => {
      for (let sy = -2; sy <= 2; sy++) for (let sx = -2; sx <= 2; sx++) {
        let hit = 0; for (const [o, c] of m) if (ref.get(o + sy * 1000 + sx) === c) hit++;
        const sc = hit / Math.max(m.size, ref.size); if (sc > best) { best = sc; bd = d; }
      }
    });
    return bd;
  };
  for (const s of todo) {
    if (want.length && !want.includes(s.name)) continue;
    const cols = s.png.width / s.fw, rows = s.png.height / s.fh;
    const frames = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let facing = r;
      if (spec.facing) facing = spec.facing(s.name, r, c, rows);
      else if (SPIN.has(s.name) && refs.length === 8) facing = detect(sig(s.png, c * s.fw, r * s.fh, s.fw, s.fh));
      const f = frameOf(s.png, c * s.fw, r * s.fh, s.fw, s.fh);
      frames.push(f.px.some(Boolean) ? spec.megaFrame(f, facing, { name: s.name, row: r, col: c }) : f.px);
    }
    const WW = s.fw + WORK * 2;
    let px = 0, pt = 0, pb = 0;
    for (const fr of frames) fr.forEach((p, i) => {
      if (!p) return; const x = i % WW - WORK, y = ((i / WW) | 0) - WORK;
      px = Math.max(px, -x, x - s.fw + 1); pt = Math.max(pt, -y); pb = Math.max(pb, y - s.fh + 1);
    });
    const PX = Math.ceil(px / 4) * 4, PT = Math.ceil(pt / 4) * 4, PB = Math.ceil(pb / 4) * 4;
    const W = s.fw + PX * 2, H = s.fh + PT + PB;
    const dst = new PNG({ width: cols * W, height: rows * H });
    frames.forEach((fr, n) => {
      const r = (n / cols) | 0, c = n % cols;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = fr[(y - PT + WORK) * WW + x - PX + WORK]; if (!p) continue;
        const o = ((r * H + y) * dst.width + c * W + x) * 4;
        dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
      }
    });
    fs.writeFileSync(path.join(OUT, s.name + '-Anim.png'), PNG.sync.write(dst));
    meta[s.name] = { fw: W, fh: H, footY: s.footY + PT, padX: PX, padT: PT };
  }
  // DEV=1 keeps _anims.json / _preview.png in the scratch folder so a half-done set never looks finished.
  const FIN = process.env.DEV ? path.join(ROOT, 'tools/.cache/0306-1/dev', spec.key) : OUT;
  fs.mkdirSync(FIN, { recursive: true });
  const metaFile = path.join(OUT, '_anims.json');
  const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  for (const [n, m] of Object.entries(old)) if (!meta[n] && fs.existsSync(path.join(OUT, n + '-Anim.png'))) {
    const s = base.find(b => b.name === n); if (s) meta[n] = { ...m, padX: (m.fw - s.fw) / 2, padT: m.footY - s.footY };
  }
  const order = todo.map(s => s.name).filter(n => meta[n]);
  // Preview (4x nearest): portrait top left, then per sheet a base row over a mega row, frame 0 of every direction.
  {
    const S = 4, GAP = 3, PER = 2;
    const portrait = portraitFile ? PNG.sync.read(fs.readFileSync(portraitFile)) : new PNG({ width: 40, height: 40 });
    const done = order.map(n => {
      const s = base.find(b => b.name === n), { fw: W, fh: H, padX, padT } = meta[n];
      const mega = PNG.sync.read(fs.readFileSync(path.join(OUT, n + '-Anim.png')));
      const rows = Math.round(s.png.height / s.fh);
      const get = (img, fw, fh, r, ox, oy) => (x, y) => {
        x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
        const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
      };
      const cells = [...Array(rows)].map((_, r) => [get(s.png, s.fw, s.fh, r, padX, padT), get(mega, W, H, r, 0, 0)]);
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (const pair of cells) for (const g of pair) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
        if (g(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return { cells, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    });
    const bandW = d => d.cells.length * (d.w + GAP);
    const bands = [];
    for (let i = 0; i < done.length; i += PER) bands.push(done.slice(i, i + PER));
    const width = Math.max(portrait.width, ...bands.map(b => b.reduce((s, d) => s + bandW(d) + GAP * 3, 0))) + GAP;
    const height = portrait.height + GAP + bands.reduce((s, b) => s + Math.max(...b.map(d => d.h * 2 + GAP * 2)) + GAP * 2, 0);
    const pv = new PNG({ width: width * S, height: height * S });
    for (let i = 0; i < pv.data.length; i += 4) { pv.data[i] = pv.data[i + 1] = pv.data[i + 2] = 48; pv.data[i + 3] = 255; }
    const put = (x, y, p) => { for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const o = ((y * S + yy) * pv.width + x * S + xx) * 4; pv.data[o] = p[0]; pv.data[o + 1] = p[1]; pv.data[o + 2] = p[2]; } };
    const tile = (dx, dy, w, h, g, ox, oy) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = g(x + ox, y + oy) || (((x >> 2) + (y >> 2)) & 1 ? [62, 62, 62] : [56, 56, 56]); put(dx + x, dy + y, p); }
    };
    for (let y = 0; y < portrait.height; y++) for (let x = 0; x < portrait.width; x++) { const i = (y * portrait.width + x) * 4; put(x, y, [portrait.data[i], portrait.data[i + 1], portrait.data[i + 2]]); }
    let by = portrait.height + GAP;
    for (const b of bands) {
      let bx = GAP;
      for (const d of b) {
        d.cells.forEach(([gb, gm], r) => {
          tile(bx + r * (d.w + GAP), by, d.w, d.h, gb, d.x0, d.y0);
          tile(bx + r * (d.w + GAP), by + d.h + GAP, d.w, d.h, gm, d.x0, d.y0);
        });
        bx += bandW(d) + GAP * 3;
      }
      by += Math.max(...b.map(d => d.h * 2 + GAP * 2)) + GAP * 2;
    }
    // _anims.json and _preview.png last: the wiring script treats a folder with both as finished.
    fs.writeFileSync(path.join(FIN, '_anims.json'), JSON.stringify(Object.fromEntries(order.map(n => [n, { fw: meta[n].fw, fh: meta[n].fh, footY: meta[n].footY }])), null, 1));
    fs.writeFileSync(path.join(FIN, '_preview.png'), PNG.sync.write(pv));
  }
  console.log('built', Object.entries(meta).map(([n, m]) => `${n} ${m.fw}x${m.fh}`).join(', '));
}
// ==== end shared plumbing ====


// Base: blue body (373f8f / 4f5f97 / 6787af), silver X + claws (ffffff / d7dfdf / afb7bf / 7f8f97).
// Mega (portrait 0376/0001): deeper steel blue, the X turns gold, the knee joints grow silver spikes.
const BLUE = new Map([['6787af', '6f8fb7'], ['4f5f97', '4f6797'], ['373f8f', '373f6f']].map(([a, b]) => [K(a), hex(b)]));
const GOLD = new Map([['ffffff', 'f7de75'], ['d7dfdf', 'f7de75'], ['afb7bf', 'c2ae72'], ['7f8f97', '8a7a4a']].map(([a, b]) => [K(a), hex(b)]));
const CLAW = new Map([['ffffff', 'e7e7e7'], ['d7dfdf', 'c7c7c7'], ['afb7bf', 'a7a7a7'], ['7f8f97', '7f8f97']].map(([a, b]) => [K(a), hex(b)]));
const SILVER = new Set([...GOLD.keys()]);
const XARM = 2;
const SPK = [hex('e7e7e7'), hex('c7c7c7'), hex('a7a7a7')];

function megaFrame(f, dir) {
  const { W, H, px } = f, out = px.slice();
  const c = canvas(W, H, out);
  const body = c.bodyMask();
  // The X is the big silver blob(s); claws and glints are small.
  const xs = [];
  for (const b of c.comps(p => p && SILVER.has(c.k(p)), px)) {
    const map = b.length >= 10 ? GOLD : CLAW;
    for (const i of b) out[i] = map.get(c.k(px[i]));
    if (map === GOLD) xs.push(...b);
  }
  // The mega X is bigger: push each of its four arms XARM px further out along its diagonal.
  if (xs.length >= 10) {
    const added = new Set();
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      let tip = xs[0]; for (const i of xs) if ((i % W) * dx + ((i / W) | 0) * dy > (tip % W) * dx + ((tip / W) | 0) * dy) tip = i;
      const tx = tip % W, ty = (tip / W) | 0;
      for (let t = 1; t <= XARM; t++) { added.add((ty + dy * t) * W + tx + dx * t); added.add((ty + dy * t) * W + tx + dx * t - dx); }
    }
    for (const i of added) out[i] = (i % W + ((i / W) | 0)) % 2 ? GOLD.get(K('ffffff')) : GOLD.get(K('afb7bf'));
    for (const i of added) for (const [dx, dy] of N4) { const n = i + dy * W + dx; if (!added.has(n) && !xs.includes(n) && out[n]) out[n] = [0, 0, 0]; }
  }
  for (let i = 0; i < W * H; i++) if (out[i] && BLUE.has(c.k(out[i]))) out[i] = BLUE.get(c.k(out[i]));
  // Knee spikes: the highest silhouette point on each side of the body centre.
  const bb = c.bbox([...body.keys()].filter(i => body[i]));
  const prof = c.topProfile(body), cx = Math.round(bb.cx);
  for (const side of [-1, 1]) {
    let best = null;
    for (let d = 5; d <= 18; d++) { const x = cx + side * d; if (x < 0 || x >= W || prof[x] >= H) continue; if (!best || prof[x] < best.y || (prof[x] === best.y && d > best.d)) best = { x, y: prof[x], d }; }
    if (best && best.y < bb.cy) c.spike(best.x, best.y + 2, [side * 0.35, -1], 5, 4, SPK, 'behind');
  }
  c.outline();
  return out;
}

await run({ key: '0376-1', dex: '0376', form: '0001', megaFrame });
