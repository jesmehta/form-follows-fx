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

- [x] Fix orbital speeds (angle ∝ time ÷ period) as an isolated commit on
      the v2.2 code, with a Classic (v2) toggle (2026-09-29)
- [x] Model split out from rendering (data, convergents, positions — no DOM) (2026-09-29)
- [x] Recompute-at-current-progress redraw on any look change (2026-09-29)
- [x] Speed and Detail as separate controls (2026-09-29)
- [x] Cycle choice from continued-fraction convergents; line budget cap (2026-09-29)
- [x] Full-bleed canvas + HUD overlay panels, collapsible, hide-HUD key (2026-09-29)
- [x] Plain-language controls (2026-09-29)
- [x] Info panel: pair, rhythm (ratio, petals, synodic, closure), live orbit
      counts, distances; raw numbers muted at the bottom (2026-09-29)
- [x] Presets (2026-09-29)
- [x] Colour: single (default) / time gradient (2026-09-29)
- [x] Planets overlay (discs + glyphs, no trail) and orbits + Sun toggle (2026-09-29)
- [x] Transport bar: play/pause, restart, scrubber in years (2026-09-29)
- [x] Shareable URL state + copy-link (2026-09-29)
- [x] Export: PNG at screen / 2048 / 4096, SVG; capped (2026-09-29)
- [x] Explainer ("What am I looking at?") (2026-09-29)
- [x] Mobile layout (2026-09-29)
- [x] Version strings → v3.0 (2026-09-29)

- [ ] **User review of v3.0 look and feel**, on the real page (not
      screenshots)
- [ ] Real-device check: phone (sheets, touch scrub), HiDPI desktop
      (trail blit cost at full-window size)
- [ ] Speed assumes ~60 fps; on 120 Hz displays it runs twice as fast.
      Switch to time-based stepping if that matters.

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
- [ ] Planet data: v2's table is kept unchanged (Venus 0.615 yr, Jupiter
      11.9, …). Refining it changes every pattern slightly; discuss before
      touching.
- [ ] Writeup material: Trail mode = Venus's geocentric path (retrograde
      loops); corrected vs classic comparison image already in
      `screenshots/speed-bug-comparison.png`.

## Watch out for

- The Keep-drawing redraw is an approximation: the tail is rebuilt with an
  alpha ramp, not by replaying frames, so right after a change the image
  is slightly cleaner than a long-running one (no 8-bit ghosting).
- The `.panel`/`.menu` CSS sets `display`, which would override the HTML
  `hidden` attribute. A global `[hidden] { display: none !important }`
  handles this; keep it if restyling.
- Scripts are plain (not modules) on purpose, so the page works from
  `file://`. Load order matters: model → ui → sketch.

- The v2 fade uses a low-alpha black rect every frame. On 8-bit canvases,
  alphas this small never fully reach black — faint grey ghosts remain.
  This may be part of the intended look; don't "fix" it without asking.
