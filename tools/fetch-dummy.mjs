// Fetches the official PMDCollab Substitute doll (0000 form 1) into assets/sprite/dummy/ and writes its SPRITES entry
// to assets/sprite/dummy/entry.json (read by tools/build-sprites-custom.mjs). Downloads are only read as XML/PNG.
import fs from 'node:fs';
import { PNG } from 'pngjs';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/', SRC = 'sprite/0000/0001/', OUT = 'assets/sprite/dummy/';
const get = async u => { const r = await fetch(RAW + u); return r.ok ? Buffer.from(await r.arrayBuffer()) : null; };
const tag = (x, n) => x.match(new RegExp(`<${n}>([^<]*)</${n}>`))?.[1];
const num = (b, n) => (tag(b, n) === undefined ? -1 : +tag(b, n));

fs.mkdirSync(OUT, { recursive: true });
const xml = (await get(SRC + 'AnimData.xml')).toString('utf8'), anims = {}, data = {};
for (const [, b] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g))
  data[tag(b, 'Name')] = { copyOf: tag(b, 'CopyOf'), fw: num(b, 'FrameWidth'), fh: num(b, 'FrameHeight'), durations: [...b.matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m => +m[1]), hit: num(b, 'HitFrame'), ret: num(b, 'ReturnFrame'), rush: num(b, 'RushFrame') };
for (const name of Object.keys(data)) {
  let src = name; while (data[src]?.copyOf) src = data[src].copyOf;
  const s = data[src], png = await get(SRC + `${src}-Anim.png`);
  if (!s || !png) continue;
  fs.writeFileSync(`${OUT}${src}-Anim.png`, png);
  let footY = Math.round(s.fh * 0.75); // same as tools/fetch-sprites.mjs: mean row of the shadow sheet
  const sh = await get(SRC + `${src}-Shadow.png`);
  if (sh) { const p = PNG.sync.read(sh); let sum = 0, n = 0; for (let y = 0; y < s.fh && y < p.height; y++) for (let x = 0; x < s.fw && x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] > 0) { sum += y; n++; } if (n) footY = Math.round(sum / n); }
  anims[name] = { file: `${OUT}${src}-Anim.png`, fw: s.fw, fh: s.fh, durations: s.durations, footY, hit: s.hit, ret: s.ret, rush: s.rush };
}
const portrait = await get('portrait/0000/0001/Normal.png');
if (portrait) fs.writeFileSync(OUT + 'portrait.png', portrait);
fs.writeFileSync(OUT + 'entry.json', JSON.stringify({ portrait: portrait ? OUT + 'portrait.png' : anims.Idle?.file, anims }));
console.log(Object.keys(anims).join(' '), portrait ? '+portrait' : '');
