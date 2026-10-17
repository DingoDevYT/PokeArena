// Adventure save model and .sav files (W1c). Pure logic (plus Web Crypto, or the pure-JS twin ADVC when crypto.subtle is missing) so tools/adv-check.mjs can run it in node.
// File = "KENORA-SAV1" line + base64( salt 16 | iv 12 | AES-GCM( JSON ) ); the key is PBKDF2-SHA256 of a constant game secret and the per-file salt. The GCM tag is the tamper check.
'use strict';
// Pure-JS SHA-256 / PBKDF2 / AES-256-GCM, used only when crypto.subtle is missing (plain http on a phone). Same bytes as Web Crypto, so files cross over both ways.
const ADVC = (() => {
  const rr = (x, n) => x >>> n | x << 32 - n, K = new Uint32Array(64), I0 = new Uint32Array(8), pr = [];
  for (let n = 2; pr.length < 64; n++) if (pr.every(p => n % p)) pr.push(n);
  pr.forEach((p, i) => { K[i] = Math.cbrt(p) % 1 * 4294967296; if (i < 8) I0[i] = Math.sqrt(p) % 1 * 4294967296; });
  const W = new Uint32Array(64);
  function comp(H, m) {   // one SHA-256 block: m = 16 big-endian words
    for (let i = 0; i < 16; i++) W[i] = m[i];
    for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = W[i - 16] + (rr(a, 7) ^ rr(a, 18) ^ a >>> 3) + W[i - 7] + (rr(b, 17) ^ rr(b, 19) ^ b >>> 10) | 0; }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const t1 = h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + (e & f ^ ~e & g) + K[i] + W[i], t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + (a & b ^ a & c ^ b & c);
      h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  // hash bytes from state H0 (a copy is returned); pre = bytes already hashed into H0
  function fin(H0, data, pre) {
    const H = H0.slice(), n = (data.length + 9 + 63 >> 6) << 6, buf = new Uint8Array(n), dv = new DataView(buf.buffer), m = new Uint32Array(16);
    buf.set(data); buf[data.length] = 0x80; dv.setUint32(n - 4, (pre + data.length) * 8 >>> 0); dv.setUint32(n - 8, (pre + data.length) / 536870912 | 0);
    for (let o = 0; o < n; o += 64) { for (let i = 0; i < 16; i++) m[i] = dv.getUint32(o + i * 4); comp(H, m); }
    return H;
  }
  // PBKDF2-HMAC-SHA256, 32 bytes out (one block); the HMAC pad states are computed once so each round is two compressions. pw must be <= 64 bytes.
  function pbkdf2(pw, salt, iter) {
    const k = new Uint8Array(64); k.set(pw);
    const Hi = new Uint32Array(8), Ho = new Uint32Array(8), m = new Uint32Array(16);
    for (const [H, x] of [[Hi, 0x36], [Ho, 0x5c]]) { H.set(I0); const dv = new DataView(k.map(b => b ^ x).buffer); for (let i = 0; i < 16; i++) m[i] = dv.getUint32(i * 4); comp(H, m); }
    const s = new Uint8Array(salt.length + 4); s.set(salt); s[s.length - 1] = 1;
    m.fill(0); m[8] = 0x80000000; m[15] = 768;
    m.set(fin(Hi, s, 64)); let G = Ho.slice(); comp(G, m);
    const U = G.slice(), T = G.slice(), H = new Uint32Array(8);
    for (let n = 1; n < iter; n++) {
      m.set(U); H.set(Hi); comp(H, m); m.set(H); U.set(Ho); comp(U, m);
      for (let i = 0; i < 8; i++) T[i] ^= U[i];
    }
    const out = new Uint8Array(32), dv = new DataView(out.buffer); T.forEach((v, i) => dv.setUint32(i * 4, v)); return out;
  }
  // AES-256 (byte-wise, slow but plenty for a save file)
  const S = new Uint8Array(256), xt = x => (x << 1 ^ (x & 128 ? 0x1b : 0)) & 255;
  for (let p = 1, q = 1; ;) {
    p = p ^ p << 1 ^ (p & 128 ? 0x1b : 0); p &= 255; q ^= q << 1; q &= 255; q ^= q << 2; q &= 255; q ^= q << 4; q &= 255; if (q & 128) q ^= 9;
    const r = (x, n) => (x << n | x >> 8 - n) & 255; S[p] = q ^ r(q, 1) ^ r(q, 2) ^ r(q, 3) ^ r(q, 4) ^ 0x63; if (p === 1) break;
  }
  S[0] = 0x63;
  function expand(key) {
    const w = new Uint32Array(60), dv = new DataView(key.buffer, key.byteOffset, 32), sub = t => (S[t >>> 24] << 24 | S[t >> 16 & 255] << 16 | S[t >> 8 & 255] << 8 | S[t & 255]) >>> 0;
    for (let i = 0; i < 8; i++) w[i] = dv.getUint32(i * 4);
    for (let i = 8, rc = 1; i < 60; i++) {
      let t = w[i - 1];
      if (i % 8 === 0) { t = sub(t << 8 | t >>> 24) ^ rc << 24; rc = xt(rc); } else if (i % 8 === 4) t = sub(t);
      w[i] = w[i - 8] ^ t;
    }
    return w;
  }
  function block(w, inp) {
    const s = Uint8Array.from(inp), t = new Uint8Array(16), key = r => { for (let i = 0; i < 16; i++) s[i] ^= w[r * 4 + (i >> 2)] >>> 24 - 8 * (i & 3) & 255; };
    key(0);
    for (let r = 1; r <= 14; r++) {
      for (let c = 0; c < 4; c++) for (let j = 0; j < 4; j++) t[c * 4 + j] = S[s[(c + j) % 4 * 4 + j]];   // SubBytes + ShiftRows
      if (r < 14) for (let c = 0; c < 4; c++) {
        const a = t.subarray(c * 4, c * 4 + 4), x = [...a].map(xt);
        s[c * 4] = x[0] ^ x[1] ^ a[1] ^ a[2] ^ a[3]; s[c * 4 + 1] = a[0] ^ x[1] ^ x[2] ^ a[2] ^ a[3]; s[c * 4 + 2] = a[0] ^ a[1] ^ x[2] ^ x[3] ^ a[3]; s[c * 4 + 3] = x[0] ^ a[0] ^ a[1] ^ a[2] ^ x[3];
      } else s.set(t);
      key(r);
    }
    return s;
  }
  // GCM with a 12-byte iv and no AAD: data -> data|tag (dec: data|tag -> data, throws on a bad tag)
  function gcm(key, iv, data, dec) {
    const w = expand(key), hb = new DataView(block(w, new Uint8Array(16)).buffer), H = [0, 1, 2, 3].map(i => hb.getUint32(i * 4));
    const ct = dec ? data.subarray(0, data.length - 16) : null, n = dec ? ct.length : data.length, out = new Uint8Array(n + (dec ? 0 : 16)), cb = new Uint8Array(16);
    if (dec && data.length < 16) throw new Error('short');
    cb.set(iv); const cdv = new DataView(cb.buffer);
    for (let o = 0, c = 2; o < n; o += 16, c++) { cdv.setUint32(12, c); const ks = block(w, cb); for (let i = 0; i < 16 && o + i < n; i++) out[o + i] = (dec ? ct : data)[o + i] ^ ks[i]; }
    const C = dec ? ct : out, Y = [0, 0, 0, 0];
    const mul = () => {
      let z0 = 0, z1 = 0, z2 = 0, z3 = 0, v0 = H[0], v1 = H[1], v2 = H[2], v3 = H[3];
      for (let i = 0; i < 128; i++) {
        if (Y[i >> 5] >>> 31 - (i & 31) & 1) { z0 ^= v0; z1 ^= v1; z2 ^= v2; z3 ^= v3; }
        const l = v3 & 1; v3 = v3 >>> 1 | v2 << 31; v2 = v2 >>> 1 | v1 << 31; v1 = v1 >>> 1 | v0 << 31; v0 >>>= 1; if (l) v0 ^= 0xE1000000;
      }
      Y[0] = z0; Y[1] = z1; Y[2] = z2; Y[3] = z3;
    };
    const pad = new Uint8Array(16), pdv = new DataView(pad.buffer);
    for (let o = 0; o < n; o += 16) { pad.fill(0); pad.set(C.subarray(o, o + 16)); for (let i = 0; i < 4; i++) Y[i] ^= pdv.getUint32(i * 4); mul(); }
    Y[2] ^= n * 8 / 4294967296 | 0; Y[3] ^= n * 8 >>> 0; mul();
    cdv.setUint32(12, 1); const e = new DataView(block(w, cb).buffer), tag = new Uint8Array(16), tdv = new DataView(tag.buffer);
    for (let i = 0; i < 4; i++) tdv.setUint32(i * 4, Y[i] ^ e.getUint32(i * 4));
    if (dec) { let bad = 0; for (let i = 0; i < 16; i++) bad |= tag[i] ^ data[n + i]; if (bad) throw new Error('tag'); } else out.set(tag, n);
    return out;
  }
  return { pbkdf2, gcm };
})();

const ADVS = {
  MAGIC: 'KENORA-SAV1', SECRET: 'kenora-sav-v1/6f1c0d7e-3a52-4b9e-a4d1-9b0f58c2e7a3', ITER: 100000,
  // towns with a Pokemon Center (gym cities G*, towns T*); a Center's door stands 51 px above the town centre (data px; the world is ADV.OUT times bigger, as are the 28 px of the spot you wake on and the 28 tile town disc)
  towns() { const t = window.ADV_WORLD?.towns || {}; return Object.keys(t).filter(k => /^[GT]/.test(k)).map(k => ({ id: k, ...t[k] })); },
  town: id => window.ADV_WORLD?.towns?.[id],
  door: t => ({ x: t.center.x, y: t.center.y - 51 * ADV.OUT }),
  // where you stand after a heal or a blackout: just in front of the door
  front: t => ({ x: t.center.x, y: t.center.y - 28 * ADV.OUT }),
  // the Center door whose front step the foot (x, y) is pushing against, or ''; a Center that is a building (S2) has no door to push, you walk into it
  atDoor(x, y) { const k = ADV.OUT; for (const t of this.towns()) { if (ADV.blds.some(b => b.town === t.id && /-center$/.test(b.id))) continue; const d = this.door(t); if (Math.abs(x - d.x) <= 14 * k && y > d.y + 4 && y < d.y + 20) return t.id; } return ''; },
  // town whose disc (radius 28 tiles) holds (x, y), or ''
  inTown(x, y) { for (const t of this.towns()) if (Math.hypot(x - t.center.x, y - t.center.y) < 28 * 32 * ADV.OUT) return t.id; return ''; },

  fresh({ name, avatar, home, starter, outfit }) {
    const t = this.town(home), s = this.front(t);
    return { v: 1, name, avatar, outfit: ADVO.clean(outfit), home, last: home, money: 3000, badges: 0, medals: [], skills: {}, waypoints: [], beat: {}, met: {}, f: { events: [] }, party: [starter], box: [], bag: ADVP.startBag(), pos: { x: s.x, y: s.y }, made: new Date().toISOString().slice(0, 10), sc: ADV.OUT };   // sc: the map scale the px positions are in (an older save has none and scene.go converts its pos)
  },
  // shape check after parsing a file or reading the local slot; throws a plain message
  check(o) {
    const bad = m => { throw new Error('This save file is not valid (' + m + ').'); };
    if (!o || o.v !== 1) bad('version');
    if (typeof o.name !== 'string' || !Array.isArray(o.party) || !o.party.length || o.party.length > 6 || !Array.isArray(o.box)) bad('party');
    if (!o.bag || typeof o.bag !== 'object' || !this.town(o.home) || !(o.money >= 0)) bad('fields');
    for (const m of [...o.party, ...o.box]) if (!window.DEX.species[toId(m.species)] || !(m.level >= 1 && m.level <= 100) || !Array.isArray(m.moves)) bad('mon');
    o.last = this.town(o.last) ? o.last : o.home; o.badges |= 0;
    if (!o.beat || typeof o.beat !== 'object' || Array.isArray(o.beat)) o.beat = {};   // defeated trainers by NPC id (saves from before S1 have none)
    if (!o.met || typeof o.met !== 'object' || Array.isArray(o.met)) o.met = {};   // leaders and trainers already talked to (the planted line is said once)
    o.outfit = ADVO.clean(o.outfit);                                                  // saves from before the customiser get the default outfit
    if (!o.skills || typeof o.skills !== 'object' || Array.isArray(o.skills)) o.skills = {};   // Skills (no HMs): fishing, surf, taught by NPCs; saves from before Salt Bay have none
    o.waypoints = (Array.isArray(o.waypoints) ? o.waypoints : []).filter(w => w && Number.isFinite(w.x) && Number.isFinite(w.y)).slice(0, 5).map(w => ({ x: Math.round(w.x), y: Math.round(w.y), name: String(w.name || 'Waypoint').slice(0, 24) }));   // map waypoints (adv-map.js), world px; saves from before the map have none
    if (!Array.isArray(o.medals)) o.medals = [];                                    // badge names, in the order won
    if (!o.f || typeof o.f !== 'object' || Array.isArray(o.f)) o.f = {};            // the lead mon's mood memory (adv-follower.js); saves from before it have none
    if (!Array.isArray(o.f.events)) o.f.events = [];
    return o;
  },

  // ---------- encryption ----------
  b64: u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); },
  unb64: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
  // soft = the pure-JS path (the default when the page has no crypto.subtle, e.g. plain http); both paths read and write the same files
  async key(salt, soft = !globalThis.crypto?.subtle) {
    const pw = new TextEncoder().encode(this.SECRET);
    if (soft) return ADVC.pbkdf2(pw, salt, this.ITER);
    const sub = crypto.subtle, base = await sub.importKey('raw', pw, 'PBKDF2', false, ['deriveKey']);
    return sub.deriveKey({ name: 'PBKDF2', salt, iterations: this.ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async seal(save, soft = !globalThis.crypto?.subtle) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), pt = new TextEncoder().encode(JSON.stringify(save)), k = await this.key(salt, soft);
    const ct = soft ? ADVC.gcm(k, iv, pt) : new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, pt));
    const all = new Uint8Array(28 + ct.length); all.set(salt); all.set(iv, 16); all.set(ct, 28);
    return this.MAGIC + '\n' + this.b64(all);
  },
  async open(text, soft = !globalThis.crypto?.subtle) {
    const m = String(text).trim().split(/\s+/);
    if (m[0] !== this.MAGIC || !m[1]) throw new Error('That is not a Kenora save file.');
    let raw; try { raw = this.unb64(m[1]); } catch { throw new Error('This save file is damaged and cannot be loaded.'); }
    if (raw.length < 45) throw new Error('This save file is damaged and cannot be loaded.');
    let plain; try { const k = await this.key(raw.slice(0, 16), soft); plain = soft ? ADVC.gcm(k, raw.slice(16, 28), raw.slice(28), true) : await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(16, 28) }, k, raw.slice(28)); }
    catch { throw new Error('This save file was edited or damaged, so it cannot be loaded.'); }
    return this.check(JSON.parse(new TextDecoder().decode(plain)));
  },
  fileName: (s, d = new Date()) => `kenora-${String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '') || 'trainer'}-${d.toISOString().slice(0, 10)}.sav`,
};
ADV.scaleWorld();   // multiplies world.js's px fields once (the old src/adv-scale.js)
