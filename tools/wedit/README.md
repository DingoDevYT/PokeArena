# tools/wedit: direct world chunk edits

The region generator no longer reproduces the committed world, so later world fixes edit `data/adv/chunks/*.js` in place.

- `wedit.py`: `Region(x0, y0, x1, y1)` loads a rectangle of data tiles (32 px) into numpy layers `h`, `mat`, `over`, `kind` plus the chunk props (data px), and `save()` writes back only the chunks that changed, in the same format.
- `mtn.py`: helpers: terraces that rise inward from a footprint, blue-noise scatter, cleanup of 1-tile spurs.
- One-shot scripts (each was run once with `--save`; running one again on the edited world would stack props): `r4.py` (Route 4 mountain), `marsh.py` (Route 8 wet meadow), `snow.py` (northern snowfields). Without `--save` they print what they would do.

Check a change with the view tool idea used overnight: teleport the play server's camera over a grid, shoot at zoom tier 1 or 2 and stitch.
