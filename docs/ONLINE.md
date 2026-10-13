# Online play

Static site (GitHub Pages friendly). No server of ours.

- **Match**: WebRTC peer to peer through PeerJS cloud (`peerjs@1.5.4`, loaded from unpkg only when you open Online). Join code = 5 character peer id (`pokearena-XXXXX`).
- **Lobby browser**: retained MQTT messages on the public EMQX broker (`mqtt@5.10.1`), topic `pokearena/v1/lobby/<code>`. Hosts clear it on start or leave (last-will covers crashes). Entries older than 2 minutes are hidden.
- **Authority**: the host runs the real sim. The guest sends its input every frame and renders 20 snapshots a second (about 100 KB/s) with local smoothing. Particles, decals and sounds the sim makes are replayed on the guest.
- **Trust**: everything from the other peer is re-validated (species must exist, level/move counts clamped, trainer sprite must be in the known list, names stripped).
- **Known limits**: strict NATs (some mobile/corporate networks) cannot connect without a TURN server. Both public services can go down. Guest controls feel the round trip (about 2x ping). Keep both tabs in the foreground, a frozen background tab drops the connection.

Files: `src/netsync.js` (snapshots, input, no DOM), `src/online.js` (PeerJS, MQTT, scenes), hooks in `src/ui.js` BattleScene. Headless check: `node tools/net-check.mjs`.
