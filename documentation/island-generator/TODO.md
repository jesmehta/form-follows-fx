# Island Generator — TODO

This is the running list. Items are checked off (with a date) as they
land and are never deleted. The design intent behind each item is in
[`ISLAND-GENERATOR.md`](ISLAND-GENERATOR.md).

## Setup

- [x] Home: `projects/island-generator/` inside fffx, like Dance of
      Planets (2026-09-29)
- [x] Commit v1.0 → v4.3 in order, runnable (`index.html`, `sketch.js`,
      `libraries/`), author dates from the sketch timestamps (2026-09-29)
- [x] Extract the 2020 notes and to-dos into `sketch-notes-2020.md` (2026-09-29)
- [x] Docs: design doc, conversation log, this TODO (2026-09-29)

## v5.0 build

- [x] Model split from rendering: noise, terrain, sampling, levels,
      marching squares, with no DOM or p5 (2020 to-do (a)) (2026-09-29)
- [x] Redraw only on change, tiered, with progressive sampling (2020 to-do
      (b), (b2)) (2026-09-29)
- [x] Seeded Perlin fBm, ridges, domain warp (also warping the mask) (2026-09-29)
- [x] Land focus with Islands / Coast / Spine masks (2020 to-do (d)) (2026-09-29)
- [x] Generated centres + click to add / drag / double-click to remove
      (2020 to-do (c), (e)) (2026-09-29)
- [x] Sea level as a share of the sheet; contour bands; depth contours (2026-09-29)
- [x] Grey / Thermal / Lines styles; 2020 colours toggle (the thermal look
      from v4.3's notes, now switchable) (2026-09-29)
- [x] Presets: Island, Archipelago, Mainland, Coastline, Mountain range,
      Lake country, 2020 · v4.3 (2026-09-29)
- [x] Page frame: A5–A1 and square, portrait/landscape, 150/300 dpi, zoom
      and pan (2026-09-29)
- [x] Export: PNG at print res, 16-bit heightmap PNG, SVG contour lines,
      SVG filled layers (2026-09-29)
- [x] Shareable URL (including centre edits), live caption, map facts,
      explainer, keys, mobile sheets (2026-09-29)
- [x] Headless check (desktop + mobile, all exports) (2026-09-29)

## v5.1: first review round

- [x] Drop the 2020 · v4.3 preset and the 2020 colours toggle (2026-09-29)
- [x] Shape buttons always visible; picking one turns Land focus on (2026-09-29)
- [x] Sheet: A5, A4, A3, Square, Custom (mm), None; None exports the window (2026-09-29)
- [x] Panels full height, "more below" scroll hint (2026-09-29)
- [x] Fix depth contours: own step, visible sea shades (2026-09-29)
- [x] **"I dont relate my work with these controls"**: comparison table,
      then the user's names and section order (v5.2) (2026-09-30)

## v5.2: the user's names and order

- [x] Sections Presets / Land and sea / Terrain details / Visual controls,
      collapsible, state remembered; Page panel too (2026-09-30)
- [x] Renames: Feature smoothness (reversed), Surface roughness,
      Elevation exponent, Island factor (2026-09-30)
- [x] Helper text behind ⓘ (hover or tap); no "your …" or 2020
      references in the interface (2026-09-30)
- [ ] User's further naming pass ("then I'll update from there")

- [ ] **User review of v5.0 look and feel**, and of the build-time
      decisions listed in `ISLAND-GENERATOR.md`
- [ ] Real-device check: phone (sheets, touch drag of markers), HiDPI
      desktop (full-res pass cost)
- [ ] Try the SVG layers in the real toolchain (Inkscape / laser software)
      and the SVG lines on a plotter

## Launch (fffx-side)

- [ ] `projects/*/` copy loop in fffx's `deploy.yml`. The same item is open
      in Dance of Planets' TODO; one loop serves both.
- [ ] fffx entry for the tool (`content/fffx-entries.tsv`) + README /
      `FILE-MANIFEST.md` wiring. `FILE-MANIFEST.md` has older uncommitted
      edits that aren't ours; don't commit them along with it.
- [ ] Writeup page (the 2020 sketches → v5.0, captured visuals)?
      Discuss with the user whether this project gets one like DoP's.

## Later / discussion

- [ ] The Mountain range preset reads as ridged hills around a spine
      rather than a clear range. Tune the ridge/spine interplay, or add a
      ridge direction?
- [ ] Hillshade (light from the NW) as a fourth style? It's cheap from
      the same field.
- [ ] Make Ridges follow the Spine (ridge direction along the spine line)
- [ ] Give ridges their own noise field; it currently shares one with a
      warp axis
- [ ] The 2020 bugs (HSB clipping, `TRUE`, `key == s`) could be talked
      through alongside the DoP code discussion.

## Watch out for

- The full-resolution screen pass is about 1.4 M samples × ~24 noise
  evaluations at 1600×900. It's spread across frames, but big or HiDPI
  windows take a second or so to settle.
- The heightmap export needs `CompressionStream` (Chrome 80+, Firefox
  113+, Safari 16.4+).
- A very large Custom sheet at 300 dpi can exceed the 60 Mpx cap. The
  readout says "capped".
- Sheet: None exports the window, so the export's framing depends on the
  window size and zoom at that moment.
- Sea level is a quantile. On a map with huge flat areas (very low
  peakiness), small slider moves can jump the coast a lot.
