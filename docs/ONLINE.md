# Online play

Static site (GitHub Pages friendly). No server of ours.

- **Match**: WebRTC peer to peer through PeerJS cloud (`peerjs@1.5.4`, loaded from unpkg only when you open Online). Join code = 5 character peer id (`pokearena-XXXXX`). Invite links: `?join=XXXXX`.
- **Lobby browser**: retained MQTT messages on the public EMQX broker (`mqtt@5.10.1`), topic `pokearena/v1/lobby/<code>`. Hosts clear it on start or leave (last-will covers crashes). Entries older than 2 minutes are hidden.
- **Two channels**: `ctl` (reliable, ordered) carries hello/start/ready/load progress, button presses, pause, picks, team data (2/s) and one-off effects/sounds. `fast` (unordered) carries snapshots (25/s) and analog input (every frame). Stale fast messages are dropped by sequence number.
- **Size limit**: PeerJS JSON channels refuse messages of 16300 bytes or more. Numbers are rounded to 3 decimals and teams travel separately, so snapshots average about 4 KB; anything over 15000 characters is split into parts over `ctl`.
- **Prediction**: the guest moves its own mon from its own input at once and reconciles with the host's position using acked input sequence numbers. The host's mon is dead-reckoned from its last velocity and knockback.
- **Authority**: the host runs the real sim. Pausing, replacement picks, impact frames and the mega cinematic freeze both screens because they freeze the host sim.
- **Trust**: everything from the other peer is re-validated (species must exist, level/move counts clamped, trainer sprite must be in the known list, names stripped).
- **Known limits**: strict NATs (some mobile/corporate networks) cannot connect without a TURN server. Both public services can go down. Attacks and dodges still take one round trip to start on the guest's screen. A browser tab in the background gets throttled and can stall the match.

Files: `src/netsync.js` (snapshots, input, prediction; no DOM), `src/online.js` (PeerJS, MQTT, lobby UI), hooks in `src/ui.js` (LoadingScene, BattleScene). Headless check: `node tools/net-check.mjs`.
