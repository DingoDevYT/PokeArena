// Parses the bible's "Appendix A - Full Badge-Scaled Teams" (tools/.cache/kenora-bible.txt, gitignored) into data/adv/rosters.js:
//   window.ADV_ROSTERS = { whitney: { b1: [{ species, level, moves, ace? }], ..., b8: [...], true: [...] }, ... ethan also has shadow }
// b1 = arriving with 0 badges ... b8 = arriving with 7; true = the 52 cap rematch team. Every species and move id must resolve in data/dex.js or the build fails.
// Run: node tools/build-adv-rosters.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const L = fs.readFileSync(ROOT + 'tools/.cache/kenora-bible.txt', 'utf8').split('\n');
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(ROOT + 'data/dex.js', 'utf8'));
const toId = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const SIZE = [3, 3, 4, 5, 5, 6, 6, 6, 6], KEYS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'true'], CAP = [15, 19, 24, 29, 34, 38, 42, 46, 52];
const WHO = ['vesper', 'bjorn', 'thorn', 'silas', 'sterling', 'aspen', 'whitney', 'rue', 'chadwick', 'jet', 'inkwell', 'soot', 'wash', 'ethan'];
const TYPES = 'Normal|Fire|Water|Electric|Grass|Ice|Fighting|Poison|Ground|Flying|Psychic|Bug|Rock|Ghost|Dragon|Dark|Steel|Fairy', T1 = `(?:${TYPES})`;
const ROW = new RegExp(`^(?:\\d )?(.+?)( ◆)? (\\d{1,3}) (${T1}(?:/${T1})?) (.*)$`);
const FORM = { Alolan: 'alola', Galarian: 'galar', Hisuian: 'hisui', Paldean: 'paldea' };

// species name as printed ("Alolan Meowth", "Persian (Alolan)") to a dex id
function speciesId(name) {
  let m = name.match(/^(Alolan|Galarian|Hisuian|Paldean) (.+)$/) || name.match(/^(.+) \((Alolan|Galarian|Hisuian|Paldean)\)$/), id;
  if (m) { const [a, b] = FORM[m[1]] ? [m[1], m[2]] : [m[2], m[1]]; id = toId(b) + FORM[a]; } else id = toId(name);
  return id;
}
const moveId = s => toId(s);

const out = {}, bad = [];
let who = null, band = null, cur = null;
const start = L.findIndex((l, i) => i > 2000 && /^Appendix A/.test(l)), end = L.findIndex((l, i) => i > start && /^Appendix B/.test(l));
const done = () => { cur = null; };
const finish = () => {
  if (!cur) return;
  const moves = cur.mv.split(/,\s*/).map(s => s.trim()).filter(Boolean), shadow = band === 'shadow', id = speciesId(shadow ? cur.name.replace(/^Shadow /, '') : cur.name);
  const mon = { species: id, level: cur.level, moves: moves.map(moveId) };
  if (cur.ace) mon.ace = true;
  if (shadow) mon.shadow = true;
  if (!window.DEX.species[id]) bad.push(`${who}/${band}: species ${cur.name} -> ${id}`);
  moves.forEach((m, i) => { if (!window.DEX.moves[mon.moves[i]]) bad.push(`${who}/${band}: move ${m} -> ${mon.moves[i]} (${cur.name})`); });
  (out[who][band] ||= []).push(mon); done();
};
for (let i = start; i < end; i++) {
  const l = L[i].trim(); if (!l) continue;
  const hd = l.match(/^([A-Z]+) [\u2014-] /);
  if (hd && WHO.includes(hd[1].toLowerCase())) { finish(); who = hd[1].toLowerCase(); out[who] = {}; band = null; continue; }
  if (!who) continue;
  let b = l.match(/^Badge (\d) [\u2014-] level cap/), isHead = false;
  if (b) { finish(); band = 'b' + b[1]; isHead = true; } else if (/^True Team [\u2014-] level cap/.test(l)) { finish(); band = 'true'; isHead = true; } else if (/^Seventh card/.test(l)) { finish(); band = 'shadow'; isHead = true; }
  if (isHead || !band) continue;
  if (/^=== PAGE|^# Pok|^Pok.mon Lv Types/.test(l)) { continue; }
  const r = l.match(ROW);
  if (r && (/^\d /.test(l) || band === 'shadow')) { finish(); cur = { name: r[1].trim(), ace: !!r[2], level: +r[3], mv: r[5] }; continue; }
  // wrapped move names: "Will-" + "O-Wisp" joins without a space, otherwise with one; a 4th-move tail is a short fragment, prose is not
  if (cur) {
    const commas = cur.mv.split(',').length - 1;
    if (commas >= 3 && (l.split(' ').length > 3 || /[.!?]/.test(l))) { finish(); continue; }
    cur.mv += (cur.mv.endsWith('-') ? '' : ' ') + l;
  }
}
finish();

// self-check
const err = [...bad];
for (const w of WHO) {
  if (!out[w]) { err.push('missing character ' + w); continue; }
  KEYS.forEach((k, i) => {
    const t = out[w][k];
    if (!t || t.length !== SIZE[i]) err.push(`${w}/${k}: ${t ? t.length : 0} mons, wanted ${SIZE[i]}`);
    else t.forEach(m => { if (m.moves.length < 1 || m.moves.length > 4) err.push(`${w}/${k}: ${m.species} has ${m.moves.length} moves`); if (m.level > CAP[i] || m.level < CAP[i] - 3) err.push(`${w}/${k}: ${m.species} level ${m.level} vs cap ${CAP[i]}`); });
    if (t && !t.some(m => m.ace) && w !== 'chadwick') err.push(`${w}/${k}: no ace marked`);
  });
}
if (!out.ethan?.shadow || out.ethan.shadow.length !== 1) err.push('ethan shadow card missing');
if (err.length) { console.error(err.join('\n')); process.exit(1); }

const body = WHO.map(w => `  ${w}: {\n` + [...KEYS, ...(out[w].shadow ? ['shadow'] : [])].map(k => `    ${k === 'true' ? "'true'" : k}: ${JSON.stringify(out[w][k])},`).join('\n') + '\n  },').join('\n');
fs.writeFileSync(ROOT + 'data/adv/rosters.js', `// Generated by tools/build-adv-rosters.mjs from the bible's Appendix A. b1..b8 = arriving with 0..7 badges, true = the 52 cap team.\nwindow.ADV_ROSTERS = {\n${body}\n};\n`);
const n = WHO.reduce((a, w) => a + Object.values(out[w]).reduce((x, t) => x + t.length, 0), 0);
console.log(`rosters OK: ${WHO.length} characters, ${WHO.length * 9 + 1} rosters, ${n} mons, every species and move id resolves`);
