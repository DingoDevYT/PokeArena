// Fetches a curated set of Pokemon Showdown trainer sprites (80x80 PNG) into assets/trainers/ and writes data/trainer-avatars.js.
// Authoritative id list: Showdown's own sprite directory (https://play.pokemonshowdown.com/sprites/trainers/) and its avatar chooser table
// (BattleAvatarNumbers in js/battledata.js). Ids below that are not in the directory are skipped, so a rename upstream cannot break the build.
// Polite: sequential, 150 ms between requests, existing files are never re-fetched. Files are only ever saved as PNG data, never executed.
// Each entry gets crop:[x, y, size], the square head-and-shoulders window found from the sprite's own pixels (pngjs).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const BASE = 'https://play.pokemonshowdown.com/sprites/trainers/';
const OUT = 'assets/trainers';
const CROP = 36; // head and shoulders window, in sprite pixels
const DELAY = 150;

// [file id, display name]; the file id is Showdown's own
const PICKS = [
  // protagonists and rivals
  ['red', 'Red'], ['blue', 'Blue'], ['green', 'Green'], ['yellow', 'Yellow'], ['ethan', 'Ethan'], ['lyra', 'Lyra'], ['kris', 'Kris'], ['silver', 'Silver'],
  ['brendan', 'Brendan'], ['may', 'May'], ['wally', 'Wally'], ['lucas', 'Lucas'], ['dawn', 'Dawn'], ['barry', 'Barry'],
  ['hilbert', 'Hilbert'], ['hilda', 'Hilda'], ['nate', 'Nate'], ['rosa', 'Rosa'], ['cheren', 'Cheren'], ['bianca', 'Bianca'], ['n', 'N'],
  ['calem', 'Calem'], ['serena', 'Serena'], ['shauna', 'Shauna'], ['elio', 'Elio'], ['selene', 'Selene'], ['hau', 'Hau'], ['gladion', 'Gladion'], ['lillie', 'Lillie'],
  ['victor', 'Victor'], ['gloria', 'Gloria'], ['hop', 'Hop'], ['florian', 'Florian'], ['juliana', 'Juliana'], ['nemona', 'Nemona-V'], ['arven-v', 'Arven'], ['penny', 'Penny'],
  ['akari', 'Akari'], ['rei', 'Rei'], ['ash', 'Ash'], ['oak', 'Prof. Oak'], ['elm', 'Prof. Elm'], ['birch', 'Prof. Birch'], ['rowan', 'Prof. Rowan'], ['juniper', 'Prof. Juniper'], ['sycamore', 'Prof. Sycamore'],
  // Kanto
  ['brock', 'Brock'], ['misty', 'Misty'], ['ltsurge', 'Lt. Surge'], ['erika', 'Erika'], ['koga', 'Koga'], ['sabrina', 'Sabrina'], ['blaine', 'Blaine'], ['giovanni', 'Giovanni'], ['janine', 'Janine'],
  ['lorelei-lgpe', 'Lorelei'], ['bruno', 'Bruno'], ['agatha-lgpe', 'Agatha'], ['lance', 'Lance'],
  // Johto
  ['falkner', 'Falkner'], ['bugsy', 'Bugsy'], ['whitney', 'Whitney'], ['morty', 'Morty'], ['chuck', 'Chuck'], ['jasmine', 'Jasmine'], ['pryce', 'Pryce'], ['clair', 'Clair'], ['will', 'Will'], ['karen', 'Karen'],
  // Hoenn
  ['roxanne', 'Roxanne'], ['brawly', 'Brawly'], ['wattson', 'Wattson'], ['flannery', 'Flannery'], ['norman', 'Norman'], ['winona', 'Winona'], ['tate', 'Tate'], ['liza', 'Liza'], ['juan', 'Juan'], ['steven', 'Steven'], ['wallace', 'Wallace'],
  // Sinnoh
  ['roark', 'Roark'], ['gardenia', 'Gardenia'], ['maylene', 'Maylene'], ['crasherwake', 'Crasher Wake'], ['fantina', 'Fantina'], ['byron', 'Byron'], ['candice', 'Candice'], ['volkner', 'Volkner'], ['cynthia', 'Cynthia'],
  // Unova
  ['cilan', 'Cilan'], ['lenora', 'Lenora'], ['burgh', 'Burgh'], ['elesa', 'Elesa'], ['clay', 'Clay'], ['skyla', 'Skyla'], ['brycen', 'Brycen'], ['drayden', 'Drayden'], ['iris', 'Iris'], ['alder', 'Alder'],
  // Kalos, Alola, Galar, Paldea
  ['viola', 'Viola'], ['korrina', 'Korrina'], ['clemont', 'Clemont'], ['olympia', 'Olympia'], ['wulfric', 'Wulfric'], ['diantha', 'Diantha'],
  ['hala', 'Hala'], ['olivia', 'Olivia'], ['nanu', 'Nanu'], ['kukui', 'Kukui'], ['leon', 'Leon'], ['raihan', 'Raihan'], ['nessa', 'Nessa'], ['bea', 'Bea'], ['piers', 'Piers'], ['marnie', 'Marnie'],
  ['geeta', 'Geeta'], ['iono', 'Iono'], ['nemona-s', 'Nemona'],
  // everyday trainer classes
  ['youngster', 'Youngster'], ['lass', 'Lass'], ['bugcatcher', 'Bug Catcher'], ['camper', 'Camper'], ['picnicker', 'Picnicker'], ['hiker', 'Hiker'], ['fisherman', 'Fisherman'],
  ['blackbelt', 'Black Belt'], ['scientist', 'Scientist'], ['psychic', 'Psychic'], ['gentleman', 'Gentleman'], ['lady', 'Lady'], ['sailor', 'Sailor'], ['pokemaniac', 'Pokemaniac'],
  ['dragontamer', 'Dragon Tamer'], ['ninjaboy', 'Ninja Boy'], ['kimonogirl', 'Kimono Girl'], ['cowgirl', 'Cowgirl'], ['backpacker', 'Backpacker'], ['pokemonranger', 'Ranger'], ['nurse', 'Nurse'], ['doctor', 'Doctor'],
  ['rocketgrunt', 'Rocket Grunt'], ['rocketgruntf', 'Rocket Grunt F'], ['aquagrunt', 'Aqua Grunt'], ['magmagrunt', 'Magma Grunt'], ['galacticgrunt', 'Galactic Grunt'],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (i >= tries) throw new Error(url + ': ' + e.message);
      await sleep(1000 * 2 ** i);
    }
  }
}

// the square CROP window over the head: centred on the opaque pixels of the top rows, top edge just above the hair/hat
function headCrop(buf) {
  const png = PNG.sync.read(buf), { width: W, height: H, data } = png;
  const op = (x, y) => data[(y * W + x) * 4 + 3] > 40;
  let top = -1;
  for (let y = 0; y < H && top < 0; y++) for (let x = 0; x < W; x++) if (op(x, y)) { top = y; break; }
  if (top < 0) return [(W - CROP) >> 1, 0, CROP];
  let lo = W, hi = -1;
  for (let y = top; y < Math.min(H, top + 18); y++) for (let x = 0; x < W; x++) if (op(x, y)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const cx = Math.round((lo + hi) / 2);
  return [Math.max(0, Math.min(W - CROP, cx - CROP / 2)), Math.max(0, Math.min(H - CROP, top - 3)), CROP];
}

fs.mkdirSync(OUT, { recursive: true });
const listing = await (await fetch(BASE)).text();
const have = new Set([...listing.matchAll(/href="([^"]+)\.png"/g)].map(m => m[1]));
const entries = [];
for (const [id, name] of PICKS) {
  if (!have.has(id)) { console.log('not in the Showdown directory, skipped:', id); continue; }
  const file = path.join(OUT, id + '.png');
  let buf;
  if (fs.existsSync(file) && fs.statSync(file).size > 0) buf = fs.readFileSync(file);
  else {
    await sleep(DELAY);
    buf = await get(BASE + id + '.png');
    if (!buf || buf.subarray(1, 4).toString() !== 'PNG') { console.log('bad download, skipped:', id); continue; }
    fs.writeFileSync(file, buf);
    console.log('fetched', id);
  }
  entries.push({ id, name, file: 'assets/trainers/' + id + '.png', crop: headCrop(buf) });
}
const js = '// Generated by tools/fetch-trainer-avatars.mjs. Pokemon Showdown trainer sprites; crop = [x, y, size] head-and-shoulders window in the 80x80 PNG.\nwindow.TRAINER_AVATARS = [\n' +
  entries.map(e => ' ' + JSON.stringify(e)).join(',\n') + '\n];\n';
fs.writeFileSync('data/trainer-avatars.js', js);
console.log(entries.length, 'avatars written to data/trainer-avatars.js');
