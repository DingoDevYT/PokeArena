// Dev static server for the game: node tools/serve.mjs [port]. Keep-alive (python -m http.server closes every connection,
// which piles up thousands of TIME_WAIT sockets and drops script loads when several headless test browsers run at once).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), '..'), port = +(process.argv[2] || 8642);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const srv = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end(); }
    const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (r) {   // audio seeks
      const a = r[1] ? +r[1] : 0, b = r[2] ? +r[2] : st.size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(f, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
});
srv.keepAliveTimeout = 30000; srv.listen(port, () => console.log('serving', root, 'on', port));
