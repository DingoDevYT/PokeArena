// Custom Mega Tatsugiri Droopy (0978-5). Same method as 0978-4.mjs. Usage: node tools/mega-custom/0978-5.mjs
import { run } from './0801-2.mjs';
import { tatsu } from './0978-4.mjs';
await run({ key: '0978-5', base: '0978/0003', portrait: '0978/0005', mega: tatsu('droopy') });
