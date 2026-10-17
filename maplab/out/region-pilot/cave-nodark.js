try {
const S = AdventureScene, sl = ms => new Promise(r => setTimeout(r, ms));
const d = ADV.world.doors.find(x => x.room === 'ridge-cave');
const out = { door: [d.x, d.y], h: ADV.h(Math.floor(d.x / 64), Math.floor(d.y / 64)) };
S.put(d.x, d.y + 70, 4); await sl(800);
out.start = [Math.round(S.p.x), Math.round(S.p.y), S.p.lv, ADV.doorAt(S.p.x, S.p.y) ? 'door' : 'nodoor'];
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', key: 'ArrowUp' }));
for (let i = 0; i < 40 && !S.room; i++) await sl(100);
window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', key: 'ArrowUp' }));
out.after = [Math.round(S.p.x), Math.round(S.p.y), S.p.lv, S.room ? S.room.id : null];
S.room.d.dark = 0; await sl(1500);
return JSON.stringify(out);
} catch (e) { return String(e.stack ?? e); }
