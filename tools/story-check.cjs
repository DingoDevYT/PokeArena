// Checks data/adv/story.js against the writing rules and the repo data (sprites, avatars, rosters, items, places). Run from the repo root: node tools/story-check.cjs
const fs = require('fs');
global.window = {};
require(process.cwd() + '/data/adv/story.js'); require(process.cwd() + '/data/adv/rosters.js'); require(process.cwd() + '/data/trainer-ow-ranger.js'); require(process.cwd() + '/data/trainer-avatars.js'); require(process.cwd() + '/data/dex.js');
const S = window.ADV_STORY, R = window.ADV_ROSTERS, OW = window.TRAINER_OW_RANGER, AV = new Set(window.TRAINER_AVATARS.map(a => a.id));
const src = fs.readFileSync('src/adv-party.js', 'utf8');
const items = new Set([...src.matchAll(/^\s{4}([a-z]+): \{ name:/gm)].map(m => m[1]));
const STONES = ['firestone', 'waterstone', 'thunderstone', 'leafstone', 'moonstone', 'sunstone', 'shinystone', 'duskstone', 'dawnstone', 'icestone', 'ovalstone'];
const world = (() => { const t = fs.readFileSync('data/adv/world.js', 'utf8'); global.window.ADV_WORLD = null; require(process.cwd() + '/data/adv/world.js'); return window.ADV_WORLD; })();
require(process.cwd() + '/data/adv/zones.js'); const zones = new Set(window.ADV_ZONES.ids);
const bad = []; const err = (m) => bad.push(m);
const TOK = { '{player}': 'W'.repeat(12), '{partner}': 'W'.repeat(12), '{home}': 'Aldermere City' };
const expand = s => s.replace(/\{player\}|\{partner\}|\{home\}/g, m => TOK[m]);
const textRule = (s, where, max) => {
  if (typeof s !== 'string') return err(where + ': not a string');
  if (/[–—]/.test(s)) err(where + ': en/em dash: ' + s);
  if (/  /.test(s)) err(where + ': double space: ' + s);
  if (/[^\x20-\x7e]/.test(s)) err(where + ': non-ASCII: ' + s);
  if (/[‘’“”]/.test(s)) err(where + ': curly quote');
  if (/\s-\s/.test(s)) err(where + ': spaced hyphen used as a dash: ' + s);
  if (s !== s.trim()) err(where + ': leading/trailing space');
  const unk = s.match(/\{[a-z]+\}/g)?.filter(t => !TOK[t]); if (unk?.length) err(where + ': unknown token ' + unk);
  if (s.length > max) err(where + `: ${s.length} chars raw: ` + s);
  if (expand(s).length > max) err(where + `: ${expand(s).length} chars with tokens expanded: ` + s);
};
// cast
for (const [id, c] of Object.entries(S.cast)) {
  if (!OW[c.sprite]) err(`cast ${id}: sprite ${c.sprite} not in TRAINER_OW_RANGER`);
  if (!AV.has(c.avatar)) err(`cast ${id}: avatar ${c.avatar} not in TRAINER_AVATARS`);
  if (!c.name || !c.cls) err(`cast ${id}: name/cls missing`);
  textRule(c.name, `cast ${id} name`, 20);
}
const ids = new Set(); const stats = {}; let lines = 0, battles = 0;
const speakers = new Set(['player', ...Object.keys(S.cast)]);
const walk = (steps, where, b) => {
  for (const [i, st] of steps.entries()) {
    const w = `${where}[${i}]`;
    const keys = Object.keys(st);
    if (st.say !== undefined) {
      if (!speakers.has(st.say)) err(w + ': unknown speaker ' + st.say);
      if (!Array.isArray(st.lines) || !st.lines.length) err(w + ': no lines');
      for (const l of st.lines || []) { textRule(l, w, 100); lines++; }
      if (st.say === 'player') for (const l of st.lines) if (l.length > 60) err(w + ': player line long');
    } else if (st.battle !== undefined) {
      battles++;
      if (!R[st.battle] && !Array.isArray(st.team)) err(w + ': battle vs ' + st.battle + ' has no roster');
      if (!S.cast[st.battle]) err(w + ': battle vs ' + st.battle + ' not in cast');
      if (st.team && !Array.isArray(st.team) && !R[st.battle]?.[st.team]) err(w + ': roster band ' + st.team + ' missing');
      const nxt = steps[i + 1]; if (!nxt || (!nxt.win && !nxt.lose)) err(w + ': battle without win/lose branch after it');
      for (const k of keys) if (!['battle', 'hold', 'max', 'team', 'mustWin'].includes(k)) err(w + ': unknown battle key ' + k);
    } else if (st.win || st.lose) {
      walk(st.win || [], w + '.win', b); walk(st.lose || [], w + '.lose', b);
      if (!steps[i - 1] || steps[i - 1].battle === undefined) err(w + ': win/lose not right after a battle');
    } else if (st.give !== undefined) {
      const ok = items.has(st.give) || STONES.includes(st.give) || (st.give.startsWith('tm_') && window.DEX.moves[st.give.slice(3)]);
      if (!ok) err(w + ': unknown item ' + st.give);
      if (!(st.n >= 1)) err(w + ': give n');
    } else if (st.heal !== undefined) { if (st.heal !== true) err(w + ': heal'); }
    else if (st.flag !== undefined) { if (!/^[a-z0-9-]+$/.test(st.flag)) err(w + ': flag id'); }
    else if (st.leave !== undefined) { if (!S.cast[st.leave]) err(w + ': leave unknown ' + st.leave); }
    else err(w + ': unknown step ' + JSON.stringify(st));
  }
};
const flags = new Set();
for (const b of S.beats) {
  const w = 'beat ' + b.id;
  if (ids.has(b.id)) err(w + ': duplicate id'); ids.add(b.id);
  if (!(Number.isInteger(b.stage) && b.stage >= 0 && b.stage <= 8)) err(w + ': stage');
  if (b.maxBadges !== undefined && b.maxBadges < b.stage) err(w + ': maxBadges < stage');
  for (const a of b.after || []) if (!ids.has(a)) err(w + ': after ' + a + ' not defined earlier');
  const wh = b.where || {};
  if (wh.town !== undefined) { if (!['home', 'any', 'away'].includes(wh.town) && !world.towns[wh.town]) err(w + ': unknown town ' + wh.town); }
  else if (wh.zone !== undefined) { if (!zones.has(wh.zone)) err(w + ': unknown zone ' + wh.zone); }
  else err(w + ': where');
  if (!['talk', 'enter'].includes(b.trigger)) err(w + ': trigger');
  if (b.trigger === 'talk') { if (/^L/.test(wh.town || '') || wh.zone) err(w + ': talk needs a town with a Center'); if (!b.who || !S.cast[b.who]) err(w + ': talk beat without a valid who'); if (b.script[0].say !== b.who) err(w + ': first speaker is not who'); }
  if (b.goal !== undefined) { textRule(b.goal, w + ' goal', 60); }
  if (b.title !== undefined) textRule(b.title, w + ' title', 30);
  walk(b.script, w, b);
  for (const st of b.script) if (st.flag) { if (flags.has(st.flag)) err(w + ': flag set twice ' + st.flag); flags.add(st.flag); }
  // every cast member who speaks also leaves by the end (or is left standing on purpose for a following talk beat)
  const spoke = new Set(), left = new Set();
  const scan = ss => ss.forEach(st => { if (st.say && st.say !== 'player') spoke.add(st.say); if (st.leave) left.add(st.leave); if (st.win) scan(st.win); if (st.lose) scan(st.lose); });
  scan(b.script);
  const stays = [...spoke].filter(s => !left.has(s));
  if (stays.length) console.log('  note: ' + b.id + ' leaves standing: ' + stays.join(', '));
  const k = b.id.startsWith('lg-') ? 'League' : b.id.startsWith('pg-') ? 'post' : 'stage ' + b.stage;
  stats[k] = (stats[k] || 0) + 1;
}
// file-wide rule: no en/em dash, no double space inside any string, no curly quotes
const raw = fs.readFileSync('data/adv/story.js', 'utf8');
if (/[–—‘’“”]/.test(raw)) err('file has a dash or curly quote somewhere');
if (/[^\x00-\x7e]/.test(raw)) err('file has non-ASCII characters');
console.log('beats', S.beats.length, 'lines', lines, 'battles', battles, JSON.stringify(stats));
console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : 'all checks pass');
process.exit(bad.length ? 1 : 0);
