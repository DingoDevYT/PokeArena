// Mega Chesnaught (0652-1) from base Chesnaught: white-furred torso, maroon cloak where the green and red bands
// were, golden claws and a three-pronged gold crown over the face (front-facing views).
// Usage: node tools/mega-custom/0652-1.mjs [Sheet ...] [--final]
const BASE = '0652', KEY = '0652-1', FORM = '0001';
const ONLY = null;
const SPIN = new Set(['Rotate', 'Swing']);
// ---------------------------------------------------------------------------------------------
// Shared pipeline (same in every tools/mega-custom/<key>.mjs written for this batch).
// Pixels are ints 0xRRGGBB, -1 = transparent. Each frame gets a WORK margin while it is edited and
// is then trimmed to the smallest pad that fits every frame of the sheet (x symmetric, multiple of 4).
// ---------------------------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const CACHE = path.join(ROOT, 'tools/.cache/mega-base', BASE);
const OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
const WORK = 24;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const H6 = s => parseInt(s, 16);
const BLACK = 0;
const rgb = c => [c >> 16 & 255, c >> 8 & 255, c & 255];
const mapOf = pairs => new Map(pairs.map(([a, b]) => [H6(a), H6(b)]));
const setOf = list => new Set(list.map(H6));

// Cached, polite download (only when the cache is missing a file).
async function fetchTo(url, file) {
  if (fs.existsSync(file)) return true;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url);
    if (r.status === 404) return false;
    if (r.ok) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; }
    await new Promise(z => setTimeout(z, 2000 * (i + 1)));
  }
  throw new Error('download failed: ' + url);
}
function parseAnims(xml) {
  return [...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map(m => m[1]).filter(b => !/<CopyOf>/.test(b)).map(b => ({
    name: b.match(/<Name>([^<]*)</)[1], fw: +b.match(/<FrameWidth>(\d+)/)[1], fh: +b.match(/<FrameHeight>(\d+)/)[1],
  }));
}
async function loadBase() {
  await fetchTo(`${RAW}sprite/${BASE}/AnimData.xml`, path.join(CACHE, 'AnimData.xml'));
  await fetchTo(`${RAW}portrait/${BASE}/${FORM}/Normal.png`, path.join(CACHE, `portrait-${FORM}.png`));
  const anims = parseAnims(fs.readFileSync(path.join(CACHE, 'AnimData.xml'), 'utf8'));
  for (const a of anims) for (const t of ['Anim', 'Shadow']) await fetchTo(`${RAW}sprite/${BASE}/${a.name}-${t}.png`, path.join(CACHE, `${a.name}-${t}.png`));
  return anims;
}
const readPng = f => PNG.sync.read(fs.readFileSync(f));
// Same rule as tools/fetch-sprites.mjs: mean y of the shadow pixels in the first frame.
function footYOf(shadow, fw, fh) {
  let s = 0, n = 0;
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (shadow.data[(y * shadow.width + x) * 4 + 3]) { s += y; n++; }
  return n ? Math.round(s / n) : Math.round(fh * 0.75);
}
function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2, px = new Int32Array(W * H).fill(-1);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = (png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2];
  }
  return { W, H, px };
}
// Frame toolkit handed to megaFrame.
function kit(W, H, px) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const comps = (test, nb = N4) => {
    const seen = new Uint8Array(W * H), list = [];
    for (let i = 0; i < W * H; i++) {
      if (seen[i] || !test(i)) continue;
      const blob = [], st = [i]; seen[i] = 1;
      while (st.length) {
        const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of nb) { const n = (y + dy) * W + x + dx; if (inside(x + dx, y + dy) && !seen[n] && test(n)) { seen[n] = 1; st.push(n); } }
      }
      list.push(blob);
    }
    return list;
  };
  const xy = i => [i % W, (i / W) | 0];
  const centroid = list => [list.reduce((s, i) => s + i % W, 0) / list.length, list.reduce((s, i) => s + ((i / W) | 0), 0) / list.length];
  const box = list => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const i of list) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
  // Paste a pattern (array of strings) with its top-left at (ox, oy). pal maps letters to colours; '.' = skip.
  // mode 'over' paints everywhere, 'behind' only into empty pixels or the outer black outline.
  const outerBlack = (out, x, y) => out[y * W + x] === BLACK && N4.some(([dx, dy]) => !inside(x + dx, y + dy) || out[(y + dy) * W + x + dx] < 0);
  const stamp = (out, rows, ox, oy, pal, { mirror = false, mode = 'over', mask } = {}) => rows.forEach((row, py) => [...row].forEach((c, pxi) => {
    if (c === '.' || c === ' ') return;
    const x = ox + (mirror ? row.length - 1 - pxi : pxi), y = oy + py; if (!inside(x, y)) return;
    const i = y * W + x;
    if (mode === 'behind' && out[i] >= 0 && !outerBlack(out, x, y)) return;
    if (mode === 'onbody' && px[i] < 0) return;
    if (mask) mask[i] = 1;
    out[i] = pal[c];
  }));
  // Morphology on a Uint8Array mask (4-neighbourhood, r steps).
  const erode = (m, r = 1) => { for (let k = 0; k < r; k++) { const n = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; n[i] = N4.every(([dx, dy]) => inside(x + dx, y + dy) && m[(y + dy) * W + x + dx]) ? 1 : 0; } m = n; } return m; };
  const dilate = (m, r = 1) => { for (let k = 0; k < r; k++) { const n = m.slice(); for (let i = 0; i < W * H; i++) if (m[i]) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) if (inside(x + dx, y + dy)) n[(y + dy) * W + x + dx] = 1; } m = n; } return m; };
  // Tapered stroke from (x0, y0) along (dx, dy): width w0 shrinking to 1 over L steps. col(t, o) picks the colour
  // (t = step 0..L-1, o = offset across 0..w-1). behind: only fills empty pixels / the outer outline.
  const taper = (out, x0, y0, dx, dy, L, w0, col, behind = false, mask) => {
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const nx = -dy, ny = dx;
    for (let t = 0; t < L; t++) {
      const w = Math.max(1, Math.round(w0 * (1 - t / L)));
      for (let o = 0; o < w; o++) {
        const s = o - (w - 1) / 2;
        const x = Math.round(x0 + dx * t + nx * s), y = Math.round(y0 + dy * t + ny * s);
        if (!inside(x, y)) continue; const i = y * W + x;
        if (behind && out[i] >= 0 && !outerBlack(out, x, y)) continue;
        out[i] = col(t, o, w); if (mask) mask[i] = 1;
      }
    }
  };
  // Effect sprites (sweat drops, sparkles, Zs) are separate blobs without any body colour: mask them out.
  const effects = bodySet => {
    const m = new Uint8Array(W * H);
    for (const b of comps(i => px[i] >= 0, N8)) if (!b.some(i => bodySet.has(px[i]))) for (const i of b) m[i] = 1;
    return m;
  };
  return { inside, comps, xy, centroid, box, stamp, outerBlack, erode, dilate, taper, effects };
}
// Close every open edge with a 1px black outline (PMD sprites are fully outlined).
// skip: colours that are drawn without an outline in the base art (flames, glows).
function closeOutline(out, W, H, skip) {
  const fin = out.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y * W + x] >= 0) continue;
    for (const [dx, dy] of N4) {
      const xx = x + dx, yy = y + dy;
      const c = xx >= 0 && yy >= 0 && xx < W && yy < H ? out[yy * W + xx] : -1;
      if (c > 0 && !(skip && skip.has(c))) { fin[y * W + x] = BLACK; break; }
    }
  }
  return fin;
}

// Facing classifier for sheets whose rows do not map to facings (spins, single-row sheets):
// compares per-colour coverage and centroid offsets against Idle frame 0 of each facing.
function descriptor(f) {
  const { W, H, px } = f; let n = 0, sx = 0, sy = 0; const cols = new Map();
  for (let i = 0; i < W * H; i++) { const c = px[i]; if (c <= 0) continue; const x = i % W, y = (i / W) | 0; n++; sx += x; sy += y; const e = cols.get(c) || [0, 0, 0]; e[0]++; e[1] += x; e[2] += y; cols.set(c, e); }
  const cx = sx / n, cy = sy / n, d = new Map();
  for (const [c, [m, x, y]] of cols) d.set(c, [m / n, x / m - cx, y / m - cy]);
  return { d, size: Math.sqrt(n) };
}
function dist(a, b) {
  let s = 0;
  for (const c of new Set([...a.d.keys(), ...b.d.keys()])) {
    const p = a.d.get(c) || [0, 0, 0], q = b.d.get(c) || [0, 0, 0];
    s += Math.abs(p[0] - q[0]) * 4;
    if (p[0] && q[0]) s += Math.min(p[0], q[0]) * (Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])) / Math.max(a.size, b.size) * 6;
  }
  return s;
}

async function build() {
  const anims = await loadBase();
  const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const final = process.argv.includes('--final');
  const idle = anims.find(a => a.name === 'Idle');
  const idlePng = readPng(path.join(CACHE, 'Idle-Anim.png'));
  const refs = [...Array(8)].map((_, r) => descriptor(frameOf(idlePng, 0, r * idle.fh, idle.fw, idle.fh)));
  const classify = f => { const d = descriptor(f); let best = 0, bv = 1e9; refs.forEach((r, i) => { const v = dist(d, r); if (v < bv) { bv = v; best = i; } }); return best; };
  fs.mkdirSync(OUT, { recursive: true });
  const metaFile = path.join(OUT, '_anims.json');
  const meta = {};
  const todo = anims.filter(a => (!ONLY || ONLY.includes(a.name)) && (!want.length || want.includes(a.name)));
  for (const a of todo) {
    const src = readPng(path.join(CACHE, `${a.name}-Anim.png`));
    const cols = src.width / a.fw, rows = src.height / a.fh;
    const footY = footYOf(readPng(path.join(CACHE, `${a.name}-Shadow.png`)), a.fw, a.fh);
    const frames = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const f = frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh);
      const spin = rows < 8 || SPIN.has(a.name);
      const dir = spin ? classify(f) : r;
      const out = megaFrame(f, dir, { sheet: a.name, row: r, col: c, foot: footY + WORK, fw: a.fw, fh: a.fh });
      frames.push(out);
    }
    const WW = a.fw + WORK * 2;
    let px = 0, pt = 0, pb = 0;
    for (const fr of frames) fr.forEach((p, i) => {
      if (p < 0) return; const x = i % WW - WORK, y = ((i / WW) | 0) - WORK;
      px = Math.max(px, -x, x - a.fw + 1); pt = Math.max(pt, -y); pb = Math.max(pb, y - a.fh + 1);
    });
    const PX = Math.ceil(px / 4) * 4, PT = Math.ceil(pt / 4) * 4, PB = Math.ceil(pb / 4) * 4;
    const W = a.fw + PX * 2, H = a.fh + PT + PB;
    const dst = new PNG({ width: cols * W, height: rows * H });
    frames.forEach((fr, n) => {
      const r = (n / cols) | 0, c = n % cols;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = fr[(y - PT + WORK) * WW + x - PX + WORK]; if (p < 0) continue;
        const o = ((r * H + y) * dst.width + c * W + x) * 4;
        dst.data[o] = p >> 16 & 255; dst.data[o + 1] = p >> 8 & 255; dst.data[o + 2] = p & 255; dst.data[o + 3] = 255;
      }
    });
    fs.writeFileSync(path.join(OUT, `${a.name}-Anim.png`), PNG.sync.write(dst));
    meta[a.name] = { fw: W, fh: H, footY: footY + PT, padX: PX, padT: PT };
  }
  const prev = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const tmpMeta = path.join(OUT, '_anims.tmp.json');
  const old = fs.existsSync(tmpMeta) ? JSON.parse(fs.readFileSync(tmpMeta, 'utf8')) : prev;
  const all = { ...old, ...meta };
  for (const n of Object.keys(all)) if (!fs.existsSync(path.join(OUT, `${n}-Anim.png`))) delete all[n];
  // Working metadata (with pads) lives in _anims.tmp.json; _anims.json + _preview.png only on --final.
  fs.writeFileSync(tmpMeta, JSON.stringify(all, null, 1));

  // Preview (4x nearest): portrait, then per sheet a base row over a mega row, frame 0 of every row.
  const S = 4, GAP = 3, PER = 2;
  const portrait = readPng(path.join(CACHE, `portrait-${FORM}.png`));
  const done = anims.filter(a => all[a.name]).map(a => {
    const { fw: W, fh: H, padX, padT } = all[a.name];
    const base = readPng(path.join(CACHE, `${a.name}-Anim.png`)), mega = readPng(path.join(OUT, `${a.name}-Anim.png`));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, padX, padT), get(mega, W, H, r, 0, 0)]);
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
  const pvBuf = PNG.sync.write(pv);
  if (final) {
    fs.writeFileSync(metaFile, JSON.stringify(Object.fromEntries(Object.entries(all).map(([n, m]) => [n, { fw: m.fw, fh: m.fh, footY: m.footY }])), null, 1));
    fs.writeFileSync(path.join(OUT, '_preview.png'), pvBuf);
    fs.rmSync(tmpMeta, { force: true });
  } else fs.writeFileSync(path.join(ROOT, 'tools/.cache/mega-base', `${KEY}-preview.png`), pvBuf);
  console.log(KEY, 'built', Object.entries(meta).map(([n, m]) => `${n} ${m.fw}x${m.fh} foot ${m.footY}`).join(', '));
}
const MAP = mapOf([['e0cc96', 'dcdcdc'], ['fff4d2', 'fcfcfc'], ['b99662', 'a0a0a0'], ['5c9940', '7f4b3a'], ['97c97e', 'cb5042'], ['244216', '572722'],
  ['8b1835', '7f4b3a'], ['df466c', 'cb5042'], ['7e5e46', 'c2a37f'], ['523d2e', '7f4b3a']]);
const GOLD = { l: H6('ebc450'), m: H6('d99236') };
const CROWN = ['G.G.G', 'GGGGG', '#GkG#'];
const FACE = setOf(['fafafa', 'c5c0ba']), CLAW = setOf(['7e5e46', '523d2e']);
function megaFrame(f, dir, info) {
  const { W, H, px } = f, K = kit(W, H, px), out = px.slice();
  const fx = K.effects(setOf(['e0cc96', 'fff4d2', 'b99662', '5c9940']));
  for (let i = 0; i < W * H; i++) if (!fx[i] && MAP.has(px[i])) out[i] = MAP.get(px[i]);
  // Gold claws: the brown pixels in the lowest rows (feet) and at the arm ends are the claws.
  const face = []; for (let i = 0; i < W * H; i++) if (FACE.has(px[i]) && !fx[i]) face.push(i);
  if (face.length >= 6 && ![3, 4, 5].includes(dir)) {
    const [cx] = K.centroid(face), top = K.box(face).y0;
    // Helmet top above the face: find the topmost body pixel in the face column.
    let ty = top; for (let y = top; y > 0 && px[y * W + Math.round(cx)] > 0; y--) ty = y;
    K.stamp(out, CROWN, Math.round(cx) - 2 + (dir === 2 ? -1 : dir === 6 ? 1 : 0), ty - 3, { G: GOLD.l, k: GOLD.m, '#': BLACK });
  }
  return closeOutline(out, W, H);
}

await build();
