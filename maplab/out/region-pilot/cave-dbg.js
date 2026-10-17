try {
const S = AdventureScene, sl = ms => new Promise(r => setTimeout(r, ms));
const d = ADV.world.doors.find(x => x.room === 'ridge-cave');
S.warp(d); await sl(800);
const ch = ADV.chunks.get(Object.keys(Object.fromEntries(ADV.chunks)).find(k => true));
const out = { keys: [...ADV.chunks.keys()].filter(k => k.length) };
const c = ADV.chunks.get([...ADV.chunks.keys()].find(k => (typeof k === 'string' ? k : '') .startsWith('326')) );
return JSON.stringify([...ADV.roomK], null, 0) + ' ' + JSON.stringify(Array.from(ADV.chunks.values()).filter(c => c.cx >= 326).map(c => [c.cx, c.cy, c.bake && Array.from(c.bake.slice(0, 5)), Array.from(c.mat.slice(32 * 10 + 8, 32 * 10 + 14)), Array.from(c.h.slice(0, 3))]));
} catch (e) { return String(e.stack ?? e); }
