try {
const S = AdventureScene, sl = ms => new Promise(r => setTimeout(r, ms));
const d = ADV.world.doors.find(x => x.room === 'ridge-cave');
S.warp(d); await sl(800);
const out = { in: [Math.round(S.p.x), Math.round(S.p.y), S.room && S.room.id] };
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown' }));
for (let i = 0; i < 60 && S.room; i++) await sl(100);
window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown', key: 'ArrowDown' }));
await sl(1200);
out.out = [Math.round(S.p.x), Math.round(S.p.y), S.p.lv, S.room ? S.room.id : null, 'door', d.x, d.y];
return JSON.stringify(out);
} catch (e) { return String(e.stack ?? e); }
