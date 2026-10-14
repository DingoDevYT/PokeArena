# Online play

Static site (GitHub Pages friendly). No server of ours.

- **Match**: WebRTC peer to peer through PeerJS cloud (`peerjs@1.5.4`, loaded from unpkg only when you open Online). Join code = 5 character peer id (`pokearena-XXXXX`). Invite links: `?join=XXXXX`.
- **Lobby browser**: retained MQTT messages on the public EMQX broker (`mqtt@5.10.1`), topic `pokearena/v1/lobby/<code>`. Hosts clear it on start or leave (last-will covers crashes). Entries older than 2 minutes are hidden.
- **Two channels**: `ctl` (reliable, ordered) carries hello/start/ready/load progress, button presses, pause, picks, team changes and one-off effects/sounds. `fast` (unordered) carries snapshots (20/s) and analog input (30/s, at once when movement starts/stops or a button is pressed, 10/s when idle). Stale fast messages are dropped by sequence number.
- **Wire format (version 3)**: messages are plain objects, PeerJS stringifies them once (no string-in-JSON escaping). Old clients get "different game version" from `hello`.
  - `{t:'s', q, b, a, d}` snapshot: `q` seq, `b` base seq (0 = full state), `a` last guest input applied, `d` full state or a diff against snapshot `b`. The guest sends `sa` (newest snapshot it applied) in every input, the host diffs against that one (kept for 30 snapshots, else sends a full one). A lost snapshot costs nothing: the next diff is still against the last acked one.
  - Diff: an object patches an object (or an array by index), anything else replaces; `$del` lists removed keys, `$r` wraps an object replacing an array. Numbers: ints from 100 up, hundredths below (time: thousandths). Countdown timers clamp at 0 so idle values never change. Moves/species/lasers go as ids.
  - `{t:'teams', k?, d}` team data, diffed against the previous send (reliable, so exact), only when it changed; the active mon is left out (it rides in snapshots).
  - `{t:'fx', e, c, s}` effects: `e` = `[name,x,y,opts?]` or spark objects, `c` decals `[kind,x,y,r,seed]`, `s` sounds `[src,vol?,rate?,x?]`. Dropped, not queued, if `ctl` has more than 24 KB buffered.
  - `{t:'in', q, sa, mx, my, ax, ay, hold}` analog input; presses stay `{t:'act', ...}` on `ctl`, sent at once.
  - Not streamed, rebuilt on the guest: floats and callouts (age tracked locally), quake debris, beam trails (sent thinned), dodge trails.
- **Congestion**: before each snapshot the host reads `dataChannel.bufferedAmount` on `fast`; above 6000 bytes it skips that snapshot (the next one is newer anyway). Snapshots are built to stay under 12000 bytes (cosmetic lists dropped if needed) and are never split; only rare `ctl` messages over 15000 characters still use `part`.
- **Measured** (`node tools/net-check.mjs`, 4 battles, host upload cap 1 Mbit/s, 80 ms one way, 5% loss on `fast`): snapshot avg 4674 B / max 13560 B, 85 KB/s, host upload 101 KB/s, send-buffer wait up to 384 ms, snapshot arrival avg 200 ms (p95 533), opponent error avg 24.8 px before; after avg 573 B / max 2617 B, 11 KB/s, host upload 12 KB/s, wait up to 8 ms, arrival avg 100 ms (p95 100), opponent error avg 13.6 px (own mon 26.0 to 17.0 px).
- **Prediction**: the guest moves its own mon from its own input at once and reconciles with the host's position using acked input sequence numbers. The host's mon is dead-reckoned from its last velocity and knockback.
- **Authority**: the host runs the real sim. Pausing, replacement picks, impact frames and the mega cinematic freeze both screens because they freeze the host sim.
- **Trust**: everything from the other peer is re-validated (species must exist, level/move counts clamped, trainer sprite must be in the known list, names stripped).
- **Known limits**: strict NATs (some mobile/corporate networks) cannot connect without a TURN server. Both public services can go down. Attacks and dodges still take one round trip to start on the guest's screen. A browser tab in the background gets throttled and can stall the match.

Files: `src/netsync.js` (snapshots, input, prediction; no DOM), `src/online.js` (PeerJS, MQTT, lobby UI), hooks in `src/ui.js` (LoadingScene, BattleScene). Headless check: `node tools/net-check.mjs` (simulated link, three profiles, asserts both sides rebuild identical snapshots and end in sync).
