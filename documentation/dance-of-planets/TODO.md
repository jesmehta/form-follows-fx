# Dance of Planets — TODO

Running list; items are checked off (with date) as they land, never
deleted. Design intent behind each item is in
[`DANCE-OF-PLANETS.md`](DANCE-OF-PLANETS.md).

## Setup

- [x] Decide home: `projects/dance-of-planets/` inside fffx (Bookshelf
      pattern), over own-repo + assembly (2026-09-29)
- [x] Commit v2.0, v2.1, v2.2 in order, byte-identical (2026-09-29)
- [x] Docs: design doc, conversation log, this TODO (2026-09-29)

## v3.0 rework

- [ ] Fix orbital speeds (angle ∝ time ÷ period) as an isolated commit on
      the v2.2 code, with a Classic (v2) toggle
- [ ] Model split out from rendering (data, convergents, positions — no DOM)
- [ ] Recompute-at-current-progress redraw on any look change
- [ ] Speed and Detail as separate controls
- [ ] Cycle choice from continued-fraction convergents; line budget cap
- [ ] Full-bleed canvas + HUD overlay panels, collapsible, hide-HUD key
- [ ] Plain-language controls
- [ ] Info panel: pair, rhythm (ratio, petals, synodic, closure), live orbit
      counts, distances; raw numbers muted at the bottom
- [ ] Presets
- [ ] Colour: single (default) / time gradient
- [ ] Planets overlay (discs + glyphs, no trail) and orbits + Sun toggle
- [ ] Transport bar: play/pause, restart, scrubber in years
- [ ] Shareable URL state + copy-link
- [ ] Export: PNG at screen / 2048 / 4096, SVG; capped
- [ ] Explainer ("What am I looking at?")
- [ ] Mobile layout
- [ ] Version strings → v3.0

## Launch (fffx-side)

- [ ] Add a `projects/*/` copy loop to fffx's `deploy.yml` (port of
      Bookshelf's "Copy static interactive projects" step)
- [ ] Point `harmonics-dance-of-planets` entry / writeup page at the tool;
      `location` values per fffx's vocabulary
- [ ] Wire `README.md` + `documentation/FILE-MANIFEST.md` to this folder
      (FILE-MANIFEST currently has someone's older uncommitted edits —
      don't commit those along with it)
- [ ] Writeup page: Dance of Venus + the code + captured visuals (replaces
      the placeholder `.md`)

## Later / discussion

- [ ] **Discussion with the user about their original code and the
      orbital-speed bug** — requested explicitly ("I'd love a discussion on
      my code and this bug later"). Compare Classic vs corrected output
      side by side.
- [ ] Revisit whether Classic toggle stays once that discussion is done.
- [ ] Revisit the look (fffx tokens vs own palette) — "keep current look
      for now".

## Watch out for

- The v2 fade uses a low-alpha black rect every frame. On 8-bit canvases,
  alphas this small never fully reach black — faint grey ghosts remain.
  This may be part of the intended look; don't "fix" it without asking.
