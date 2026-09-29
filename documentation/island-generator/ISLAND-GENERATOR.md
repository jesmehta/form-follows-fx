# Island Generator — Design Decisions & As-Built Notes

An interactive p5.js page that turns seeded Perlin noise into a contour
map on a printable sheet. One set of sliders moves it between a single
island, an archipelago, a coastline, a mainland and a mountain range. It
exports the sheet as a print-resolution PNG, a 16-bit heightmap, or as
SVG vectors (contour lines, or filled stacked layers). It lives at
`projects/island-generator/` and is served at `/island-generator/` on
`fffx.cabinetofcuriosities.in` once the deploy loop exists (see TODO).

Companion docs in this folder:

- [`conversation-island-generator.md`](conversation-island-generator.md):
  the conversation behind these decisions, with the user's inputs verbatim
  in bold.
- [`sketch-notes-2020.md`](sketch-notes-2020.md): every note and to-do
  from the original 2020 sketches, extracted verbatim.
- [`TODO.md`](TODO.md): the running todo list, checked off as items land.

## Initial need

Seven p5.js sketches from February–March 2020, "Perlin Contour v1.0" to
"v4.3", in the user's words: **"a series of sketches that uses Perlin Noise
to create a countour map, initially with a mouse variable, but later with
sliders and inputs."** The progression was noise → bands → band count on
the mouse → sea level via an exponent → an island mask → sliders → an
off-centre focus on an A-format canvas. The v4.3 header ends with a to-do
list: redraw only when needed, click to place islands, islanding from an
edge, and several islands measured to the nearest.

The brief for the new page:

> **a page that provides the controls to manipulate noise based islands
> - exports the islands as vectors or images
> - controls allow to go from island to mainland landscape, variable
> sealevel, central large island to archipelagos, mountain ranges etc,
> using just the same set of parameters and slider inputs**

The phrase that shaped the design is *"using just the same set of
parameters"*. Presets are named points in one parameter space, not
separate modes with their own controls.

## What was wrong with the 2020 sketches (found on reading, 2026)

Kept as-is in the history commits. The fixes live only in v5.0.

- `colorMode(HSB)` with `color(f)`: a single argument is brightness out of
  **100**, so every value above 100 is pure white. v4.3's hardcoded
  maximum of 150 ("usually 150 was good") clips the top third to white.
- The colour/BW toggle used `fillFlag = TRUE`. `TRUE` is undefined in JS,
  which explains the note "switching between colour and BW did not work".
- `key == s` compares against an undefined variable, so any keypress in
  v4.2/v4.3 throws.
- v4.3's slider label "Max Elevation (255)" is overwritten each frame with
  "Island factor"; the console gets a `print` every frame.
- The full canvas is recomputed with `img.set()` 30 times a second even
  when nothing changes (the user's own to-do (b)).
- v1.0 writes its image with alpha 1 of 255, so what shows is the ~160k
  ellipses, not the image.
- Every folder carries an unused 4.3 MB `p5.js` (v0.10.2) beside the
  `libraries/p5.js` (v0.5.8, 2017) that `index.html` actually loads.

## Decisions and intent

### Where it lives: `projects/island-generator/` in fffx

The same pattern as Dance of Planets: a self-contained static page in
fffx's `projects/`, docs in `documentation/island-generator/`. The user
asked for it directly (**"create an Island Generator folder inside fffx
projects"**).

### History: every 2020 version committed in order

**"add erach of the versions to the folder, and commit each version with
appropriate messages - your table is correct as far as my intentions
went, then overwrite with the next"**

Seven commits, `b1ce876` (v1.0) → `80fa45d` (v4.3). Each commit's author
date is its `sketch.js` timestamp. Contents per the user's pick
**"Runnable: + libraries/"**: `index.html`, `sketch.js` and `libraries/`
(p5 0.5.8, byte-identical across all seven, so git stores it once, about
1.4 MB). Only the unused root-level `p5.js`/`p5.sound.js` were left out.
`_temp/` itself is untouched. v5.0 replaces the folder
contents; the old files stay in history.

### Layout: full-bleed canvas, floating panels, and a page frame

The user picked "Different layout" and then described it: **"full bleed
canvas, controls float above, like DoP, but controls for export for page
dimensions and zoom"**. So this is the Dance of Planets shell with the
right-hand panel reassigned to the **page**:

- The terrain is infinite. The sheet (A5, A4, A3, Square, Custom in mm,
  or None; portrait or landscape; 150/300 dpi) is a gold frame over it,
  and everything outside is dimmed. What's inside the frame is what every
  export produces.
- **None** hides the frame to look at the whole landscape (v5.1, see
  below). The map stays laid out on the last sheet, so nothing moves.
  Exports then capture the window as shown, at 2× screen resolution.
- Zoom and pan (scroll, drag) move only the view. They never change the
  map, the coastline or the export.
- Changing A4 → A3 changes only export size, because the map is measured
  in page widths. Orientation or square changes the page's shape, so the
  map is rebuilt for it.
- The left panel is *Landscape* (all terrain controls), the right panel is
  *Page* (sheet, zoom, export, map facts), and the bottom bar holds
  New landscape and seed.

### One parameter space

| Group | Control | What it does | 2020 ancestor |
|---|---|---|---|
| Where the land gathers | **Land focus** 0–1 | Blend between pure noise (0 = mainland) and noise lifted around centres | v4.0 `(1 + e − d)/2`, v4.2 "Island factor" |
| | **Shape**: Islands / Coast / Spine | What the distance is measured to: the nearest centre, one side of the page, or a line through the centres | to-do (d), (e) |
| | **Islands** 1–16 | How many centres are generated from the seed | to-do (e) |
| | **Island size** | Radius of each centre's pull | v4.2 island factor |
| Terrain | **Feature scale** | Noise cycles across the page width | v4.3's `t` "smooth to chaotic" |
| | **Roughness** | Octave gain (0.3 → 0.75) | — |
| | **Ridges** | Blend in ridged noise (sharp crests) | — |
| | **Coast warp** | Domain warp of page coordinates, bending noise *and* mask | — |
| | **Peakiness** | Exponent on height: plateaus ↔ spires | v3 "exponent for sealevel" |
| Sea & contours | **Sea level** | Share of the sheet under water | v3 `b/3` oceans |
| | **Contour bands** 2–30 | Number of land bands | v2 banding |
| | Depth contours | Bands and lines under the sea too | v3's underwater bands |
| Drawing | Grey / Thermal / Lines | Render style | v2 grey, v4.3 colour |

Presets set only terrain keys (plus sea level) and leave the look alone.
They are Island, Archipelago, Mainland, Coastline, Mountain range and Lake
country. (A "2020 · v4.3" preset was removed in v5.1.)

### Island centres: generated *and* clickable

User's pick: **"Both"**. Centres are generated from the seed (count and
size sliders) so presets and links reproduce, and the user can edit them:
click to add, drag a marker to move, double-click to remove, and "Reset
centres" to go back. Edits are stored against the generated index, and
added centres are stored separately. In Coast mode the single marker sets
which side of the page is land. In Spine mode the markers are joined, in
order, along the page's long axis.

### Render styles

User's picks: **Grey bands (original), Thermal, Contour lines only**.
Hypsometric (atlas) colour was offered and not chosen.

- **Grey**: land bands from dark grey to near-white, sea near-black (v3's
  "black oceans"). The HSB clipping is fixed.
- **Thermal**: v4.3's hue sweep, re-mapped to run cold to hot (270° → 0°)
  instead of 0° → 360°, which wrapped red back to red.
- **Lines**: dark contour lines on paper. The coast is heaviest and every
  5th band is an index contour, with widths in **mm of paper**
  (0.5 / 0.35 / 0.18). The screen previews exactly what the SVG plots.

### Export

User's picks: **Contour lines (SVG), Filled band layers (SVG)**; images
as **PNG at A-series print res** and **Heightmap PNG**. DXF was offered
and not chosen.

- **PNG**: the sheet at the chosen dpi, as drawn (A4 @ 300 = 2480 × 3508).
  It is capped at 60 Mpx, which no current sheet reaches at 300 dpi
  except a large Custom size; the readout says when it's capped.
- **Heightmap**: a real 16-bit greyscale PNG of raw elevation, with the
  page minimum at 0 and the maximum at 65535. The sea is *not* flattened.
  It's written by a small in-page PNG encoder, because canvas can only
  make 8-bit (it uses `CompressionStream`).
- **SVG lines**: sized in mm, with one Inkscape layer per contour level
  (coast, level 1…n, depth n). Lines stay open where they leave the page,
  so a plotter doesn't trace the border, and are simplified to 0.08 mm.
- **SVG layers**: for each level, the *whole region above it* as one
  filled even-odd path, stacked bottom to top. For stacked cut models,
  each layer is the full slice outline, not just the ring. A sea-coloured
  page rect sits underneath.

### Keep p5

As with Dance of Planets, the page stays a p5 sketch (p5 1.9 from cdnjs;
the old `libraries/` aren't carried forward). p5 hosts the canvas, the
draw loop and the overlay. The terrain itself is in plain JS in
`model.js`, so export and stats use the same function as the screen.

## Decisions made during the v5.0 build

These weren't put to the user in advance. They're listed here so they can
be revisited.

- **Own seeded Perlin noise, not p5's `noise()`.** Seeds must reproduce
  exactly, from shared links and at any export size, and the model has
  no p5 dependency. It is classic gradient noise with a seeded
  permutation, in 6-octave fBm, so it's still Perlin but won't match the
  2020 pixels exactly.
- **fBm normalised by spread, not by peak.** The first build divided by the
  amplitude sum, which left heights bunched with a standard deviation of
  about 0.06. The island mask (range 1.5) swamped that, so every island
  came out as a circle. Dividing by √Σa² gives a standard deviation of
  about 0.16 at every roughness, and the mask was softened to
  `0.7·(1 − d)`.
- **Coast warp moves the page, not just the noise.** Warping only the
  noise left the mask's circles intact. Warping the coordinates both are
  read at makes coastlines wander.
- **Sea level is a share of the sheet under water** (a quantile of a
  96-wide reference sample of the page), not an absolute height. That way
  it means the same thing whatever the other sliders do, panning or
  zooming can't move the coast, and peakiness, being monotonic, reshapes
  the relief without moving the coastline. The absolute value is in
  "Under the hood".
- **Bands span sea level → highest point on the page.** Terrain outside
  the page can exceed that and clamps to the top band.
- **Redraw only on change, in tiers.** This is the 2020 to-do (b):

  | Tier | What reruns | Settings |
  |---|---|---|
  | terrain | height function, page reference, field | seed, all terrain and land-focus sliders, centres, orientation |
  | view | field resampled for the window | zoom, pan, resize, panel collapse |
  | levels | recolour or re-contour the existing field | sea level, bands |
  | look | recolour (Lines ↔ fill resamples) | style, depth |
  | none | readouts only | page size, dpi, markers |

- **Progressive sampling.** The first pass uses the coarsest step that fits
  about 25 ms (learnt from previous passes), then halves each frame down
  to full resolution in 10 ms slices, so sliders stay live. Lines style
  stops at half resolution, since finer passes don't change smooth lines.
- **Export samples at most ~5 M points and interpolates.** The finest
  octave is ~30 print pixels wide at A3/300, so bilinear upsampling loses
  nothing visible and a PNG takes seconds, not minutes. Bands are cut from
  the interpolated heights, so edges stay crisp.
- **Centre edits are forgotten when the generated set changes** (seed,
  island count, shape), because index 3 of a new set is a different
  island. New landscape and a typed seed also clear added centres.
- **Clicking the map with Land focus at 0 turns focus on (0.85)**, with a
  toast, so the click visibly does something.
- **The view (zoom, pan) is not in the URL.** A link opens the map fitted.
- **Look: Dance of Planets' tokens and fonts**, so the two fffx tools
  read as a pair. Over the paper of Lines style the panels stay dark.
- **The caption describes the map live**, e.g. "An archipelago of 13
  islands · 28% land · 12 contour bands". It counts connected land (and
  lakes: water not touching the edge) on the reference grid.

## v5.1: first review round (2026-09-29)

The user's feedback on v5.0, verbatim, and what changed:

- **"presets - dont need the 2020 version"**: removed.
- **"Dont need 2020 colours"**: the toggle and its code are removed. The
  2020 look survives only as history (the v1.0–v4.3 commits).
- **"why does the land focus slider sometimes ahve and sometimes
  disappear the islands-coast-spine buttons ?"**: v5.0 hid the shape
  controls whenever Land focus was 0, because at 0 no centres are used.
  Hiding them read as a glitch. Now they always show; the count and size
  sliders dim at 0, a hint says why, and picking a shape turns focus back
  on (0.85).
- **"Sheet should also have None as an option, if I want to admire the
  whole thing without the boundary / Have A3, A4, A5, square, and custom
  dimension, and none"**: the sheet options are now A5, A4, A3, Square,
  Custom (W × H in mm) and None. A2/A1 are gone. Only a change of the
  sheet's *shape* rebuilds the map.
- **"LHS + RHS panel - let it extend the full height of the page, and
  indicate there is further to scroll if needed"**: on desktop the panels
  run top to bottom and the bottom bar sits between them. A fade with
  "▾ more below" shows while a panel has more content under the fold.
- **"Depth contours undersea dont work"**: they were drawn, just
  invisibly. The sea shades all sat within a few levels of black, and the
  depth lines used the land's contour step, which crammed them against
  the coast. Depth now has its own step (sea level → deepest point, 6
  bands), the sea runs from a visible shallow grey/blue to near-black,
  and the lowest land band was lifted so the coast stays legible.

Still open from this round: **"The biggest issues is that I dont relate
my work with these controls, and I have tragically forgotten a lot of my
work since it was from many years ago"**. This is under discussion; see
the conversation log, Part 4.

## Architecture

```text
index.html
  p5 (cdnjs 1.9.0) -> model.js -> ui.js -> island_generator.js
```

These are plain scripts sharing `window.IG`, not modules, so the page
works from `file://` (as DoP does).

- **`model.js` → `IG.model`**: pure maths, no DOM, no p5.
  `makeTerrain(P)` returns `{ height(x, y), centres }` in page units.
  `sampleField` is a chunked grid sampler (`run(budgetMs)`),
  `pageReference` and `levels` resolve sea level and bands, `isolines` is
  marching squares with segment chaining (open lines, or closed rings with
  `pad`), and `simplify` is RDP. It also holds `PAGES`, `PX_CAP` and
  `PRESETS`.
- **`ui.js` → `IG.settings`, `IG.ui`**: settings, slider mappings (log for
  scale, size, peak and zoom), URL sync (short keys, non-defaults only,
  plus `ex`/`rm`/`mv` for centre edits), panels and mobile sheets, keys,
  the caption and facts. Every change goes through `changed(tier)`.
- **`island_generator.js` → `IG.sketch`**: the p5 instance. It holds the
  dirty flags, the progressive field job, `paint()` (palette to
  ImageData, or isolines for Lines), `render()` (places the field by its
  own page coordinates, so it lines up mid-pan), the overlay (dim, frame,
  markers, spine, coast arrow), pointer handling, and the four exports.

## Files

| File | Role |
|---|---|
| `projects/island-generator/index.html` | HUD markup, explainer, script order |
| `projects/island-generator/island_generator.css` | DoP v3.0 shell + island additions; ≤900 px bottom sheets |
| `projects/island-generator/model.js` | Noise, terrain, sampling, levels, marching squares, presets |
| `projects/island-generator/ui.js` | Settings, controls, URL, facts, keys |
| `projects/island-generator/island_generator.js` | The p5 sketch: progressive render, overlay, pointer, export |
| `documentation/island-generator/sketch-notes-2020.md` | The 2020 notes, verbatim |
| `documentation/island-generator/screenshots/` | `v5.0-desktop`, `-archipelago`, `-mountain-range`, `-lines`, `-mobile-controls`, `-exports` |

## Verified

v5.0 was checked headlessly (Playwright/Chromium, from `file://`) at
1600×900 and 390×844:

- no page or console errors;
- all seven presets, style keys 1–3, and click-to-add;
- scroll zoom and fit;
- URL round-trip: a copied link reopens the same map and centres;
- mobile sheets.

All four exports downloaded and were checked:

- A4/300 thermal PNG in about 6 s;
- heightmap 2480×3508 in about 5 s, header 16-bit greyscale, data
  inflates to the right size;
- SVG lines and SVG layers in under 2 s each, with the expected Inkscape
  layers.

Rendered side by side, the SVG lines, SVG layers and PNG agree
(`screenshots/v5.0-exports.png`).

**The look and feel has not yet been reviewed by the user.**

## Todo / watch out for

See [`TODO.md`](TODO.md).

## Changelog

### v1.0: Perlin noise field (2020-02-12)

Greyscale `noise(x, y)` per pixel; the field drifts as `y0` accumulates.
Commit `b1ce876`.

### v2.0: banding (2020-02-21)

Noise floored into `b` bands gives the contour look; still scrolling.
Commit `a882b23`.

### v2.2: band count on mouseX (2020-02-22)

mouseX sets bands 2–30, the map holds still, and a click saves a
timestamped JPG. Commit `2162671`.

### v3: sea level (2020-02-22)

mouseY sets the `pow(n, elev)` exponent, and mapping from `b/3` makes
black oceans. Commit `9bb1642`.

### v4.0: islands (2020-02-22)

Radial `(1 + e − d)/2` mask. Commit `6c0f2a8`.

### v4.2: sliders (2020-02-22)

Bands, exponent and island factor sliders; 's' save key (broken).
Commit `f540bb7`.

### v4.3: off-centre, A-format, New Scape (2020-03-07)

Focus at (w/3, h/3), 420×594 canvas, Save/New Scape buttons, the notes
header and to-do list. Commit `80fa45d`.

### v5.0: Island Generator page (2026-09-29)

Rewritten as model / UI / sketch, with a full-bleed canvas, HUD panels
and a page frame. It has:

- own seeded Perlin fBm, ridges and domain warp;
- land focus with Islands / Coast / Spine masks and generated plus
  clickable centres;
- sea level as a share of the sheet, with bands and depth contours;
- Grey / Thermal / Lines styles, plus a 2020 colours toggle;
- seven presets;
- A5–A1 and square sheets, portrait or landscape, 150/300 dpi, and zoom
  and pan;
- exports: PNG, 16-bit heightmap, SVG contour lines, SVG filled layers;
- shareable URLs, a live caption and map facts, an explainer, keys, and
  mobile sheets.

Redraws happen only on change, in tiers, and progressively.

### v5.1: first review round (2026-09-29)

Removed the 2020 · v4.3 preset and the 2020 colours toggle. Sheets are
now A5 / A4 / A3 / Square / Custom (mm) / None, where None exports the
window at 2×. Shape buttons always show, and picking one turns Land
focus on. Panels run full height with a "more below" hint. Depth
contours fixed: own step, visible sea shades. Details under "v5.1: first
review round".
