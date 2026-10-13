// Builds a custom PMD-style Mega Garchomp (0445-1) from the base Garchomp sheets.
// Also hosts the shared framework (base download + cache, frame loop, auto padding, _anims.json,
// _preview.png) that 0445-2, 0448-2, 0460-1, 0478-1, 0485-1, 0500-1 and 0531-1 import.
// Output: assets/sprite-custom/<key>/*.png, _anims.json (fw/fh/footY to use), _preview.png
// Usage: node tools/mega-custom/0445-1.mjs [Walk Idle ...]   (no args = every sheet)
// Same approach as tools/build-mega-custom.mjs (Mega Venusaur): recolour by pixel role, then
// hand-tuned pixel patches anchored to points tracked by colour in every frame.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const CACHE = path.join(ROOT, 'tools/.cache/mega-base');
const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const WORK = 24; // working margin around each frame; trimmed back to the smallest pad that fits

// ---------- shared helpers ----------
export const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
export const key = (r, g, b) => ((r << 16) | (g << 8) | b);
export const K = s => key(...hex(s));
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const BLACK = 0;
export const remap = pairs => new Map(pairs.map(([a, b]) => [K(a), hex(b)]));

// Frame toolkit: px is an array of [r,g,b] or null, W x H.
export function tools(f) {
  const { W, H } = f;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const k = p => (p ? key(...p) : -1);
  const get = (px, x, y) => (inside(x, y) ? px[y * W + x] : null);
  // 4-connected components of pixels where test(i) is true.
  const comps = test => {
    const id = new Int32Array(W * H).fill(-1), list = [];
    for (let i = 0; i < W * H; i++) {
      if (id[i] >= 0 || !test(i)) continue;
      const blob = [], st = [i]; id[i] = list.length;
      while (st.length) {
        const j = st.pop(); blob.push(j); const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of N4) {
          const n = (y + dy) * W + x + dx;
          if (inside(x + dx, y + dy) && id[n] < 0 && test(n)) { id[n] = list.length; st.push(n); }
        }
      }
      list.push(blob);
    }
    return list;
  };
  const bbox = blob => {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const j of blob) { const x = j % W, y = (j / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1, cx: Math.round((x0 + x1) / 2), cy: Math.round((y0 + y1) / 2) };
  };
  const centroid = blob => [Math.round(blob.reduce((s, j) => s + j % W, 0) / blob.length), Math.round(blob.reduce((s, j) => s + ((j / W) | 0), 0) / blob.length)];
  // Pixel of blob furthest along vector v.
  const extreme = (blob, v) => { let b = -1e9, bi = -1; for (const j of blob) { const s = (j % W) * v[0] + ((j / W) | 0) * v[1]; if (s > b) { b = s; bi = j; } } return [bi % W, (bi / W) | 0]; };
  // Is pixel i part of the outer silhouette outline (black touching empty space)?
  const isOuter = (px, x, y) => { const p = get(px, x, y); return !!p && k(p) === BLACK && N4.some(([dx, dy]) => inside(x + dx, y + dy) && !px[(y + dy) * W + x + dx]); };
  // Stamp a pixel patch: rows of chars, legend maps char -> colour; '.' = keep.
  // mode 'front' overwrites, 'behind' only fills empty or outer outline, 'on' only paints over existing pixels.
  const patch = (px, rows, legend, ax, ay, mode = 'front', flip = false) => {
    rows.forEach((row, yy) => [...row].forEach((c, xx0) => {
      if (c === '.' || c === ' ') return;
      const xx = flip ? row.length - 1 - xx0 : xx0;
      const x = ax + xx, y = ay + yy; if (!inside(x, y)) return;
      const i = y * W + x;
      if (mode === 'behind' && px[i] && !isOuter(px, x, y)) return;
      if (mode === 'on' && !px[i]) return;
      px[i] = legend[c];
    }));
  };
  // Close every open edge with a black outline.
  const outline = (px, col = [0, 0, 0]) => {
    const fin = px.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (px[y * W + x]) continue;
      for (const [dx, dy] of N4) { const p = get(px, x + dx, y + dy); if (p && k(p) !== BLACK) { fin[y * W + x] = col; break; } }
    }
    return fin;
  };
  // Tapered stroke from (x0,y0) along e: width w shrinking to 1 over L px. cols = [edge, fill].
  // mode as in patch(). Returns the painted indices.
  const stroke = (px, x0, y0, e, L, w, cols, mode = 'behind', taper = true) => {
    const m = Math.max(Math.abs(e[0]), Math.abs(e[1])), ex = e[0] / m, ey = e[1] / m;
    const perp = Math.abs(ey) >= Math.abs(ex) ? [Math.sign(ex) || 1, 0] : [0, Math.sign(ey) || 1];
    const done = [];
    for (let t = 0; t < L; t++) {
      const cx = Math.round(x0 + ex * t), cy = Math.round(y0 + ey * t);
      const ww = taper ? Math.max(1, Math.round(w * (1 - t / L))) : w;
      for (let o = 0; o < ww; o++) {
        const x = cx - perp[0] * o, y = cy - perp[1] * o, i = y * W + x;
        if (!inside(x, y)) continue;
        if (mode === 'behind' && px[i] && !isOuter(px, x, y)) continue;
        if (mode === 'on' && !px[i]) continue;
        px[i] = typeof cols === 'function' ? cols(t, o, ww) : o === 0 || o === ww - 1 && ww > 2 ? cols[0] : cols[1]; done.push(i);
      }
    }
    return done;
  };
  // Pixels outside `set` (indices) that 4-touch it and pass test(i).
  const ring = (set, test = () => true) => {
    const s = new Set(set), r = new Set();
    for (const i of s) for (const [dx, dy] of N4) { const x = i % W + dx, y = ((i / W) | 0) + dy, n = y * W + x; if (inside(x, y) && !s.has(n) && test(n)) r.add(n); }
    return [...r];
  };
  // Filled polygon (pts = [[x,y],...], pixel centres). colour(x, y, edge) picks the colour; edge = on the polygon border.
  const poly = (px, pts, colour, mode = 'behind') => {
    const inPoly = (x, y) => { let c = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), done = [];
    const set = new Set();
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
      if (inside(x, y) && inPoly(x + 0.5, y + 0.5)) set.add(y * W + x);
    for (const i of set) {
      const x = i % W, y = (i / W) | 0;
      if (mode === 'behind' && px[i] && !isOuter(px, x, y)) continue;
      if (mode === 'on' && !px[i]) continue;
      const edge = N4.some(([dx, dy]) => !set.has((y + dy) * W + x + dx));
      const c = colour(x, y, edge); if (c) { px[i] = c; done.push(i); }
    }
    return done;
  };
  // Group blobs whose centroids are within d px of each other.
  const cluster = (blobs, d) => {
    const groups = [];
    for (const b of blobs) {
      const c = centroid(b), g = groups.find(g => g.some(o => Math.hypot(o.c[0] - c[0], o.c[1] - c[1]) <= d));
      g ? g.push({ b, c }) : groups.push([{ b, c }]);
    }
    return groups.map(g => g.flatMap(o => o.b));
  };
  return { W, H, inside, k, get, comps, bbox, centroid, extreme, isOuter, patch, outline, stroke, ring, poly, cluster };
}
export const mirrorRows = rows => rows.map(r => [...r].reverse().join(''));

// ---------- base download (cached, polite) ----------
async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return file;
    } catch (e) {
      if (i >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
}
const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
function footYFromShadow(png, fw, fh) {
  let sum = 0, n = 0;
  for (let y = 0; y < fh && y < png.height; y++) for (let x = 0; x < fw && x < png.width; x++)
    if (png.data[(y * png.width + x) * 4 + 3] > 0) { sum += y; n++; }
  return n ? Math.round(sum / n) : Math.round(fh * 0.75);
}
// Returns [{ name, file, fw, fh, footY }] for every distinct sheet in the base AnimData (CopyOf resolved).
export async function loadBase(dir, portraitForm) {
  const dst = path.join(CACHE, dir.replace('/', '-'));
  const xml = fs.readFileSync(await download(`${RAW}sprite/${dir}/AnimData.xml`, path.join(dst, 'AnimData.xml')), 'utf8');
  const data = {};
  for (const [, b] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) data[tag(b, 'Name')] = { copyOf: tag(b, 'CopyOf'), fw: +tag(b, 'FrameWidth'), fh: +tag(b, 'FrameHeight') };
  const srcs = [...new Set(Object.keys(data).map(n => { let s = n, g = 0; while (data[s].copyOf && g++ < 10) s = data[s].copyOf; return s; }))];
  const out = [];
  for (const s of srcs) { // sequential: be polite to GitHub
    const file = await download(`${RAW}sprite/${dir}/${s}-Anim.png`, path.join(dst, `${s}-Anim.png`));
    const sh = await download(`${RAW}sprite/${dir}/${s}-Shadow.png`, path.join(dst, `${s}-Shadow.png`));
    if (!file) { console.warn('missing', dir, s); continue; }
    const { fw, fh } = data[s];
    out.push({ name: s, file, fw, fh, footY: sh ? footYFromShadow(PNG.sync.read(fs.readFileSync(sh)), fw, fh) : Math.round(fh * 0.75) });
  }
  if (portraitForm) await download(`${RAW}portrait/${dir.split('/')[0]}/${portraitForm}/Normal.png`, path.join(dst, `portrait-${portraitForm}.png`));
  return { sheets: out, portrait: portraitForm && path.join(dst, `portrait-${portraitForm}.png`) };
}

// ---------- build ----------
function frameOf(png, fx, fy, fw, fh) {
  const W = fw + WORK * 2, H = fh + WORK * 2;
  const px = new Array(W * H).fill(null);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = ((fy + y) * png.width + fx + x) * 4;
    if (png.data[i + 3]) px[(y + WORK) * W + x + WORK] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  }
  return { W, H, px, fw, fh, work: WORK };
}

// megaFrame(frame, dir, info) -> new px array (same W x H). dir: 0 Down, 1 DR, 2 R, 3 UR, 4 Up, 5 UL, 6 L, 7 DL.
export async function buildMega({ key: KEY, dex, form, megaFrame }) {
  const OUT = path.join(ROOT, 'assets/sprite-custom', KEY);
  const { sheets, portrait } = await loadBase(dex, form);
  const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const meta = {};
  fs.mkdirSync(OUT, { recursive: true });
  for (const a of sheets) {
    if (want.length && !want.includes(a.name)) continue;
    const src = PNG.sync.read(fs.readFileSync(a.file));
    const cols = src.width / a.fw, rows = src.height / a.fh;
    const frames = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      frames.push(megaFrame(frameOf(src, c * a.fw, r * a.fh, a.fw, a.fh), r, { sheet: a.name, col: c, cols, rows }));
    // Smallest pad (multiple of 4, symmetric in x so the centre holds, top-only in y) that fits every frame.
    const WW = a.fw + WORK * 2;
    let px = 0, pt = 0, pb = 0;
    for (const fr of frames) fr.forEach((p, i) => {
      if (!p) return; const x = i % WW - WORK, y = ((i / WW) | 0) - WORK;
      px = Math.max(px, -x, x - a.fw + 1); pt = Math.max(pt, -y); pb = Math.max(pb, y - a.fh + 1);
    });
    if (pb > 0) console.warn(a.name, 'spills', pb, 'px below the frame (clipped)');
    const PX = Math.ceil(px / 4) * 4, PT = Math.ceil(pt / 4) * 4;
    const W = a.fw + PX * 2, H = a.fh + PT;
    const dst = new PNG({ width: cols * W, height: rows * H });
    frames.forEach((fr, n) => {
      const r = (n / cols) | 0, c = n % cols;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = fr[(y - PT + WORK) * WW + x - PX + WORK]; if (!p) continue;
        const o = ((r * H + y) * dst.width + c * W + x) * 4;
        dst.data[o] = p[0]; dst.data[o + 1] = p[1]; dst.data[o + 2] = p[2]; dst.data[o + 3] = 255;
      }
    });
    fs.writeFileSync(path.join(OUT, `${a.name}-Anim.png`), PNG.sync.write(dst));
    meta[a.name] = { fw: W, fh: H, footY: a.footY + PT };
  }
  // _anims.json and _preview.png last: a folder with both counts as finished.
  const metaFile = path.join(OUT, '_anims.json');
  const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const all = { ...old, ...meta };
  fs.writeFileSync(metaFile, JSON.stringify(all, null, 1));
  preview(OUT, sheets, all, portrait);
  console.log(KEY, 'built', Object.entries(meta).map(([n, m]) => `${n} ${m.fw}x${m.fh}`).join(', '));
}

// Preview (4x nearest): the portrait, then per sheet a base row over a mega row, frame 0 of every
// direction, cropped to the content. Two sheets per band, in AnimData order.
function preview(OUT, sheets, all, portraitFile) {
  const S = 4, GAP = 3, PER = 2;
  const read = p => PNG.sync.read(fs.readFileSync(p));
  const portrait = portraitFile && fs.existsSync(portraitFile) ? read(portraitFile) : new PNG({ width: 40, height: 40 });
  const done = sheets.filter(a => all[a.name] && fs.existsSync(path.join(OUT, `${a.name}-Anim.png`))).map(a => {
    const { fw: W, fh: H } = all[a.name];
    const padX = (W - a.fw) / 2, padT = H - a.fh;
    const base = read(a.file), mega = read(path.join(OUT, `${a.name}-Anim.png`));
    const rows = Math.round(base.height / a.fh);
    const get = (img, fw, fh, r, ox, oy) => (x, y) => {
      x -= ox; y -= oy; if (x < 0 || y < 0 || x >= fw || y >= fh) return null;
      const i = ((r * fh + y) * img.width + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null;
    };
    const cells = [...Array(rows)].map((_, r) => [get(base, a.fw, a.fh, r, padX, padT), get(mega, W, H, r, 0, 0)]);
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const pair of cells) for (const g of pair) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (g(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { cells, x0, y0, w: Math.max(1, x1 - x0 + 1), h: Math.max(1, y1 - y0 + 1) };
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
  for (let y = 0; y < portrait.height; y++) for (let x = 0; x < portrait.width; x++) { const i = (y * portrait.width + x) * 4; if (portrait.data[i + 3]) put(x, y, [portrait.data[i], portrait.data[i + 1], portrait.data[i + 2]]); }
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
  fs.writeFileSync(path.join(OUT, '_preview.png'), PNG.sync.write(pv));
}

// ---------- Mega Garchomp ----------
// Base palette roles.
export const GAR = {
  blue: ['37478f', '4f6fb7', '6f9fe7'].map(K), white: ['ffffff', 'd7d7d7', 'a7afa7'].map(K),
  red: ['9f172f', 'cf473f', 'ff6f57'].map(K), yellow: ['af7f17', 'cfa72f', 'ffd700'].map(K),
};
// Shared Garchomp analysis: body blob, arm claws (white blobs off the feet and away from the mouth), head star.
export function garchompParts(f) {
  const T = tools(f), { W } = T;
  const kk = f.px.map(T.k);
  const all = T.comps(i => kk[i] >= 0);
  const body = all.filter(b => b.some(j => GAR.blue.includes(kk[j]))).flat();
  const bb = T.bbox(body), hgt = bb.y1 - bb.y0;
  const near = (j, set, d) => { const x = j % W, y = (j / W) | 0; for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const p = T.get(f.px, x + dx, y + dy); if (p && set.includes(T.k(p))) return true; } return false; };
  const claws = T.cluster(T.comps(i => GAR.white.includes(kk[i]))
    .filter(b => { const c = T.bbox(b); return c.y1 < bb.y0 + hgt * 0.78 && c.y0 > bb.y0 + hgt * 0.2 && !b.some(j => near(j, GAR.red, 1)); }), 5)
    .map(b => ({ blob: b, c: T.centroid(b), box: T.bbox(b) }));
  // Head: topmost body pixel; the head side lobes are the left/right extremes of the top 8 rows within 9px of it.
  const top = T.extreme(body, [0, -1]);
  const band = body.filter(j => { const x = j % W, y = (j / W) | 0; return y <= top[1] + 8 && Math.abs(x - top[0]) <= 9 && f.px[j] && kk[j] !== BLACK; });
  const lobes = band.length ? [T.extreme(band, [-1, 0.2]), T.extreme(band, [1, 0.2])] : [];
  return { T, kk, body, bb, claws, top, lobes };
}

const MG = { // Mega Garchomp portrait colours
  b0: hex('2b2e53'), b1: hex('3f5998'), b2: hex('5674ac'), b3: hex('6d81cd'),
  r1: hex('ab4129'), r2: hex('db5437'), r3: hex('f26442'), rd: hex('71443f'),
  y1: hex('bd9f48'), y2: hex('e5dd29'), y3: hex('f7f767'), w: hex('ffffff'),
};
const MG_MAP = new Map([
  [K('37478f'), MG.b1], [K('4f6fb7'), MG.b2], [K('6f9fe7'), MG.b3],
  [K('9f172f'), MG.r1], [K('cf473f'), MG.r2], [K('ff6f57'), MG.r3],
  [K('af7f17'), MG.y1], [K('cfa72f'), MG.y2], [K('ffd700'), MG.y3],
]);

function garchompMega(f, dir) {
  const { T, kk, bb, claws, star } = garchompParts(f);
  const out = f.px.map((p, i) => (p && MG_MAP.get(kk[i])) || p);
  const midX = (bb.x0 + bb.x1) / 2;
  // Arm fins become big scythe blades: red underside, blue back, hanging out and down from each claw.
  const face = [0, 1, 1, 1, 0, -1, -1, -1][dir];
  const lead = face ? Math.max(...claws.map(c => c.c[0] * face)) : null;
  for (const { c: [cx, cy] } of claws) {
    const s = face || (cx < midX ? -1 : 1);
    const mode = face && cx * face === lead ? 'front' : 'behind'; // near arm overlaps the body in side views
    // Sickle: top edge from the claw outward, long point hanging down and out, inner edge back to the arm.
    const pts = [[cx, cy - 1], [cx + s * 3, cy], [cx + s * 5, cy + 6], [cx + s * 4, cy + 9], [cx + s * 2, cy + 5], [cx - s, cy + 3]];
    if (s < 0) pts.forEach(p => (p[0] += 1));
    const bl = T.poly(out, pts, (x, y, edge) => (y >= cy + 8 ? MG.w : edge && (x - cx) * s >= 3 ? MG.b2 : y - cy > 2 ? MG.r2 : MG.r1), mode);
    if (mode === 'front') for (const i of T.ring(bl, n => !!out[n])) out[i] = MG.b0; // edge it where it overlaps the body
  }
  return T.outline(out);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  await buildMega({ key: '0445-1', dex: '0445', form: '0001', megaFrame: garchompMega });
}
