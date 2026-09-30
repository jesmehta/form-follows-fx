# Island Generator — Design Decisions & As-Built Notes

An interactive p5.js page that turns seeded Perlin noise into a contour
map on a printable sheet. One set of sliders moves it between a single
island, an archipelago, a coastline, a mainland and a mountain range. It
exports the sheet as a print-resolution PNG, a 16-bit heightmap, or as
SVG vectors (contour lines, or filled stacked layers). It lives at
`projects/island-generator/` and is served at `/island-generator/` on
`fffx.cabinetofcuriosities.in` once pushed (the deploy loop was added
2026-09-30).

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
fffx's `projects/`. The user asked for it directly (**"create an Island
Generator folder inside fffx projects"**). The docs lived in
`documentation/island-generator/` until 2026-09-30, when they moved into
the project folder, following Bookshelf's pattern (**"just like
Bookshelf stores the individual projects' documentation inside the
project's own folder"**). They now sit in
`projects/island-generator/documentation/`. fffx's deploy loop (added
2026-09-30, a port of Bookshelf's) copies each project folder but drops
its `documentation/` subfolder and any `.md` file, so the docs are not
published (**"update both bookshelf and fffx's copy step to prevent md
files, screenshots, etc in project folders to be copied"**).

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

- **Superseded in v5.5** (see "v5.5: the frame" below). The first model
  tied the landscape to the sheet, 1 sheet width = 1 unit, with zoom and
  pan moving only the screen view. The sheet was A5–A1 or square, then
  in v5.1 A5 / A4 / A3 / Square / Custom mm / None.
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

Panel order and names as of v5.2 (the user's sequence and naming, see
"v5.2" below). The v5.0 name is given where it changed.

| Section | Control | What it does | 2020 ancestor |
|---|---|---|---|
| Presets | Island, Archipelago, Mainland, Coastline, Mountain range, Lake country | Named points in this same space | — |
| Land and sea | **Shape**: Islands / Coast / Spine | What the distance is measured to: the nearest centre, one side of the sheet, or a line through the centres | to-do (d), (e) |
| | **Islands** 1–16 | How many centres are generated from the seed | to-do (e) |
| | **Island factor** (was Island size) | Radius of each centre's pull | v4.2 "Island factor" |
| | **Land weight** (was Land focus) 0–1 | Blend between pure noise (0 = mainland) and noise lifted around centres | v4.0 `(1 + e − d)/2` (always at full weight there) |
| | **Sea level** | Share of the sheet under water | v3 `b/3` oceans |
| Terrain details | **Feature smoothness** (was Feature scale; slider reversed) | Noise cycles across the sheet width; right = fewer, broader landforms | v1.0–v4.3 `t`, "the Perlin increment… very smooth to chaotic" |
| | **Surface roughness** (was Roughness) | Octave gain (0.3 → 0.75) | — |
| | **Ridges** | Blend in ridged noise (sharp crests) | — |
| | **Coast warp** | Domain warp of page coordinates, bending noise *and* mask | — |
| | **Elevation exponent** (was Peakiness) | Exponent on height: plateaus ↔ sharp peaks | v3 `elev`, "exponent for sealevel" |
| Visual controls | **Contour bands** 2–30 | Number of land bands | v2 `b`, "no of bandgaps" |
| | Depth contours | Bands and lines under the sea too | v3's underwater bands |
| | Colours: Grey / Thermal / Topographic / Lines | Render style | v2 grey, v4.3 colour |
| | Contour lines | Draw the contour lines over Grey, Thermal or Topographic; shown on and greyed out in Lines | — |
| | Island centres | Show or hide the markers | — |

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
- **Topographic** (added v5.3 as "Topology", renamed v5.4): realistic map colours.
  These are hypsometric tints running from green lowlands through tan and
  brown hills to grey rock and snow, with a blue sea and lighter
  shallows.
- **Thermal**: v4.3's hue sweep, re-mapped to run cold to hot (270° → 0°)
  instead of 0° → 360°, which wrapped red back to red.
- **Lines**: dark contour lines on paper. The coast is heaviest and every
  5th band is an index contour, with widths in **mm of paper**
  (0.5 / 0.35 / 0.18). The screen previews exactly what the SVG plots.
- **Engraved** (v5.6 as Hachures; renamed in v5.7 and given a Stipple
  mode): pen strokes on paper, weighted by slope and by a light
  direction, with water lines along the coast. See "v5.7: Engraved".

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
work since it was from many years ago"**. Taken up in v5.2.

## v5.2: the user's names and order (2026-09-30)

The response to "I dont relate my work with these controls" was a
comparison table (2020 sketch → control, now folded into the parameter
table above) and four options. The user chose to rename:
**"I'd go with 3 - use my names, then I'll update from there"**, with
refinements **"feature scale = feature smoothness, roughness = surface
roughness, contour bands is ok"**. Elevation exponent and Island factor
come from the 2020 sketches.

**Order.** The user's own sequence, in four collapsible sections:
**"Presets / Land and Sea / Terrain details / Visual controls … I think
this is a more logical flow. Make each section collapsible."** Sections
start open, and each viewer's open/closed state is remembered. The Page
panel got the same treatment.

**Help text.** **"Move large helper text to tooltips/hover etc. As a
possibly public page going forward, I dont need references to "your 2020
tool" "your xyz" etc. … remove helper text where it isnt helping a fresh
viewer, it's not for me."**
- Explanations now sit behind ⓘ icons, which show on hover (desktop) or
  tap (touch).
- Every "your …" and 2020 reference was removed from the interface. The
  explainer's credit line remains.
- The bottom-bar hint (click / drag / scroll) stays, because it tells a
  new visitor how to interact.

**Feature smoothness reversed.** A "smoothness" slider should get smoother
to the right, so the mapping is reversed. The stored value is still noise
cycles per sheet width, so URLs are unaffected.

## How the terrain is computed

Written up in answer to **"what are the island coast spine buttons doing,
mathematically - also visually / how are ridges working, mathematically
?"**. These are the steps of `height(x, y)` in `model.js`, where `(x, y)`
is in sheet widths:

1. **Warp:** `(x, y) += warp · 0.12 · (fbm₂, fbm₃)`, two further noise
   fields at half frequency.
2. **Noise:** `e = 0.5 + 0.5 · fbm(x, y)`, clamped 0–1. fbm is 6 octaves of
   Perlin noise (frequency ×2.03, amplitude × gain per octave), normalised
   by √Σa² so its spread is the same at every roughness.
3. **Ridges:** `e = (1 − ridges) · e + ridges · ridged(x, y)`.
4. **Exponent:** `e = e ^ exponent`.
5. **Mask** (Land focus > 0): `g = 0.7 · (1 − min(d, 1.8))`, then
   `e = (1 − focus) · e + focus · (e + g) / 2`. At focus 1 this is the v4
   formula `(1 + e − d) / 2`, up to the 0.7 scale.
6. **Sea level** is the height below which the chosen share of the sheet
   lies. The coastline is the contour at that height.

Which of these steps come from the 2020 sketches (checked against all
seven commits):

| Step | In the 2020 code? |
|---|---|
| 1. Warp | **No.** New in v5.0. |
| 2. Noise | **Yes.** `noise(x0, y0)` in every version. p5's `noise()` is itself 4 layered octaves, so this was already fBm. v5.0 swaps it for seeded Perlin with 6 octaves and a roughness control. |
| 3. Ridges | **No.** No `abs()` or ridge code in any version. New in v5.0. |
| 4. Exponent | **Yes.** v3 onward: `pow(n0, elev)`. |
| 5. Mask | **Yes, in its original form.** v4.0–v4.3: `(1 + n − d)/2`, with `d` the distance from one fixed point (centre, then w/3, h/3). The blend weight, several centres and the Coast/Spine shapes are new. |
| 6. Sea level | **Partly.** v3 made the bottom third of bands black (`map(f_, b/3, b, …)`); a movable, quantile-based sea level is new. |
| Banding | **Yes.** v2 onward: `int(map(n, 0, 1, 0, b))`. |

**Shapes differ only in `d`** (R = Island factor):

- **Islands:** `d = distance to the nearest centre / R`. Each centre is a
  cone; taking the nearest merges them, so the sheet is split into cells
  around the centres. Visually: blobs around each marker that fade out
  about one R away, with edges roughened by the noise. Many small ones
  make an archipelago; close ones merge.
- **Coast:** `u` is the direction from the sheet's centre to the marker,
  `s` is a point's position along `u`, and
  `d = (half-extent − s) / (3.2 · R)`. This is a tilted plane: 0 at the edge
  the marker points to, growing steadily across the sheet. Visually: land
  on the marker's side, sea opposite, and a coast running across the
  arrow. R sets the slope, so a larger R lets land reach further inland.
- **Spine:** `d = distance to the polyline through the centres, in order,
  / R`, a tent-shaped lift along a line. Visually: one elongated
  landmass along the chain of markers. With a single centre it falls back
  to Islands.

**Ridges** are Musgrave's ridged multifractal on an independent noise
field, over 6 octaves:

```text
r    = 1 − |1.4 · noise(x·f, y·f)|    // fold: zero-crossings become crests
r    = r² · prev                       // sharper crests, flatter lowlands
prev = min(1, 1.6 · r)                 // finer octaves show mostly on high ground
sum += amplitude · r ;  ridged = sum / Σamplitudes
```

- The fold does most of the work. Noise crosses zero along long winding
  lines, and `1 − |n|` turns them into knife-edge crests, giving a
  branching network of ridgelines.
- Squaring narrows the crests and flattens the ground between them.
- The `prev` weighting puts fine detail on the ridges and keeps valleys
  smooth.

Visually, it moves from rounded hills at 0 to long, thin, branching crests
with broad valleys.

Known limits:
- The ridges don't follow Spine, since they're global noise. This is why
  the Mountain range preset reads weakly.
- The ridge field is also one of the two warp fields, at a different
  scale, which is a small correlation to separate (see TODO).

## v5.5: the frame (2026-09-30)

> **Sheet should not be locked in to a pixel:mm ratio, this makes all the
> A4, A3, square a fixed size, no way to zoom in or out to the viewers
> choice proportional to the page - instead have - A-series, square, 4:3,
> 16:9, custom aspect ratio, and zoom+pan controls what sits in that
> boundary**

What changed:

- **The landscape has its own coordinates.** Its unit square holds the
  generated centres and is the sea-level reference, so nothing about the
  landscape depends on the sheet any more.
- **The sheet is a frame of a ratio,** fitted and fixed in the middle of
  the free area. At zoom 100% the unit square just fits inside it.
- **Zoom and pan move the landscape under the frame.** The frame's
  contents are the map: they are exported, described in "This map",
  and stored in the URL (`z`, `x`, `y`).
- **Ratio changes only re-frame.** Changing ratio or orientation never
  rebuilds the landscape.
- **Sheet: None** uses the whole free area as an invisible frame.

> **I am not sure what dpi is adding to here currently, likely just the
> export resolution literally and i guess that can continue for the new
> scheme**

Resolution is now **print size × dpi**, both in the Export section:

- **Print size** is the long edge: 210, 297 or 420 mm. For A-series these
  are labelled A5, A4 and A3, since the short edge then comes out at A
  proportions.
- **dpi** is 150 or 300.
- **Line weights** stay in mm of print, so the screen preview is scaled to
  the print size.
- **SVGs** are in those mm.

> **this map and under the hood texts have very bad contrast against the
> grey panel - make the font much lighter / under the hood text - also
> rewrite where possible in my old notation**

- **Contrast:** lightened, with the labels in the accent colour.
- **Under the hood** now uses the 2020 terms:
  - `seed`
  - `t` (the noise step per pixel if this frame were drawn on the 2020
    400 px canvas)
  - `noiseDetail(octaves, falloff)`
  - `elev`
  - `isleFac`
  - `isl` with its weight
  - `b`
  - sea, step and range
  - ridges and warp, flagged as having no 2020 term

> **a toggle for No Contours beside Depth Contours - or when Contour slider
> moved to 0 (current min is 2) - a smooth unbanded noise of whatever
> resolution - will it be too much processing or too complex a change ?**

Neither. Smooth shading is marginally *cheaper* than banding, because
each pixel maps straight to a colour (through a 256-step table) with no
rounding into a band. The slider option was taken, so Contour bands now
runs 0–30:

- **0 = smooth,** for every colour style and for the sea's depth shading.
- **Contour lines** then draw only the coast, plus depth lines when those
  are on.
- The **SVG exports** follow the same rule.

## v5.6: Hachures (2026-09-30)

*Partly superseded by v5.7:* strokes are now traced on finer rows over
a smoothed terrain, the slope/height switch is gone (slope × sun
instead), and the theme is called Engraved.

> **Colours - How difficult would it be to render each contour band as old
> school hatching - radially outward from higher contour to lower contour,
> density of hatch maps to height, etc ?**

The assessment given: this is *hachures* (Lehmann, 1799; the Swiss
Dufour map). The basic version was judged moderate work, reusing the
existing field and contours. The hard part is even spacing, because
strokes spread apart on convex ground and bunch in hollows. A cheap
"pattern hatching" fallback was offered too. The user's decisions:

> **1 - switch between both until I lock one if the other isnt very
> useful / 2 - sea - water lining / 3 - i am ok with Hachures being a
> colour "theme", will consider overlaying it like lines later / 4 -
> pattern fallback is too basic - basic version yes.**

**How it works** (`hachures()` in `model.js`):

- **One band at a time.** Strokes are seeded every *pitch* along the
  band's lower contour, and rows in neighbouring bands are staggered.
- **Tracing** (as of v5.6.1). Each band gets two passes:
  1. Strokes from the upper contour run downhill to the lower one.
  2. Strokes from the lower contour run uphill into the space still empty.

  A stroke stops at the target contour, on flat ground, or on a cell
  another stroke occupies (a coarse grid, reset per band). v5.6 used only
  the uphill pass plus a 3.5 mm cap, which made terraces; see v5.6.1.
- **Weight** is a switch (`hachBy`, URL `hb`):
  - *By slope*, the classic Lehmann rule "the steeper, the darker": the
    stroke's average gradient over this landscape's 90th-percentile
    gradient. Near-flat ground (below 0.12) is left white, as on engraved
    maps.
  - *By height*, the user's idea: the band's height sets both weight and
    density, with higher bands denser.
- **Water-lining** (`distanceFromLand()`): an exact Euclidean distance
  transform (Felzenszwalb–Huttenlocher) from land, whose isolines are the
  lines along the coast. There are 10 lines, the first 0.6 mm out, each
  gap 30% wider than the last.
- **Coast** is always drawn (0.35 mm). The Contour lines toggle adds the
  contours faintly on top.

**Decisions made while building:**

- **All sizes are in mm of print:** pitch 0.6, stroke width 0.05–0.28,
  length cap 3.5 mm. The screen preview is at print scale, so at the
  fitted zoom the hachures read as tone and turn into strokes as you
  zoom in, like the real thing.
- **The first tuning was too heavy.** It used 0.75 mm pitch and strokes
  up to 0.42 mm, and read as a bold woodcut. Strokes were also uncapped
  and wandered as long thin threads on gentle ground. The length cap also
  made export about 5× faster (A4/300 went from 13.5 s to 2.6 s).
- **On screen, hachures are only computed once the field reaches half
  resolution.** The coarse first passes show paper, so dragging a slider
  stays live.
- **Known limit of the basic version:** small twig-like marks where
  strokes from little knolls converge, and white gaps where they diverge.
  The even-spacing refinement (re-seeding into gaps) would fix both; it
  is in the TODO, to decide after looking at real output.

## v5.7: Engraved: hachures and stipple (2026-09-30)

> **hachures still dont look very good.**

Four likely causes went back to the user: the terrain is too busy, the
strokes curl like hair, the contrast is weak, and the rows still show.

> **hachure - i think its all 4 issues.
>
> I did some reading as well.
> https://warrenrdavison.wixsite.com/maps/post/revisiting-hachure-lines-dynamic-hachure-contours-in-arcgis-pro
> [...]
> I think the hacures should be
> - low slope = short lines
> - high slope = long lines
> - additionally, sun direction - light side - low line weight, shadow
>   side - thicker line weight
> - although line weight could also just be used for slope as well
>   alongwith length**

**What Davison's method showed.** He smooths the DEM first (a 10-cell
mean). He hangs short ticks on contours at a *much finer* interval than
the ones he displays. He weights the ticks by slope plus aspect. On steep
ground his ticks are heavy, close together and *short*. v5.6 traced
between the display bands, so its strokes were long and followed every
ripple of the noise, and each band read as a terrace.

**The length question.** When strokes run contour to contour, the
terrain sets their length: contours crowd on steep ground, so strokes
there are short. "High slope = long lines" means strokes that are no
longer tied to contours. Rather than argue it, both were drawn: a
comparison sheet (review page, not shipped) with four panels on the same
map:

1. current;
2. finer rows + smoothed terrain;
3. 2 plus sun weighting;
4. free strokes whose length grows with slope, plus sun.

The sheet later gained sliders for rows per band, length cap, spacing,
stroke length, sunlit weight and smoothing
(`screenshots/v5.7-hachure-comparison-*.png`).

> **3 : looks like hachures classical
> rows per band is fine at 4
> length cap = 1 is cool, with some whitespace [...] below 1 it becomes
> mini hatches following the contour, which is a distinct look, but i
> dont think i want it
> 4 : looks more like stippling under certain settings
> spacing - 0.15 maybe too much but 0.2 is a good dense stipple, upper
> limit 0.5 [...]
> strokes - keep 1-5 mm range, longer strokes with closer spacing give
> density even though longer strokes with fartehr spacing look like fur
> or stubble
>
> So maybe we have 2 kinds of colour theme added - hachure and
> stippling, as 2 separtae options or a monochrome theme with radio
> buttons between these, and with 1-2 controls as needed**

**Built:** one colour theme, **Engraved** (the v5.6 Hachures button,
renamed), with a **Hachures | Stipple** switch under it. It was chosen
over two separate buttons because the two share almost everything
(paper, coast, water-lining, smoothing, sun weighting, export), and the
Colours row already had five buttons.

- **Hachures** (`hachures()`): v5.6.1's two-pass contour-to-contour
  tracing, now on rows at least 4 per display band and 48 in all
  (`ceil(48 / bands)` per band). The rows stay aligned with the display
  bands, so the Contour lines overlay still sits on a row. With 0 bands
  (smooth), there are 48 rows.
- **Stipple** (`stipple()`): loose strokes down the slope, not tied to
  contours. Seeds are a shuffled jittered grid. Each stroke is centred
  on its seed and runs 0.4 mm on gentle ground up to *Stroke length* on
  the steepest. A stroke stops short within about *Spacing* of another
  and is dropped if that leaves it under 0.2 mm.
- **Both** are traced on the terrain smoothed by 1.6 mm (three box
  blurs, `blurField()`). The coast and the water lines still use the
  unsmoothed field, so they match the other styles.
- **Weight = slope × sun** (Dufour). Slope is the stroke's gradient over
  this landscape's 90th-percentile gradient, and ground below 0.12 is
  left white. Sun is `lit + (1 − lit) · shade`, where shade is 0 facing
  the light and 1 facing away, and `lit` = 0.15. Width runs 0.04–0.34 mm
  in 10 weight buckets (v5.6: 0.05–0.28, 8 buckets). The wider range is
  what fixes the weak contrast.

**Controls** (at most three at a time):

| | Hachures | Stipple |
|---|---|---|
| | Stroke length: 1–2.5 mm, or off at the far right (default 1) | Spacing: 0.2–0.5 mm (default 0.3) |
| | | Stroke length: up to 1–5 mm (default 3) |
| both | Light from: compass 0–360° (default 315°, north-west) | same |

URL keys: `eg` (hachure / stipple), `hc`, `sp`, `sn`, `sun`. The length
cap has no setting below 1 mm, since the user doesn't want the
mini-hatch look.

**Fixed, not controls:** 4 rows per band, 1.6 mm smoothing, sunlit
weight 0.15, and 0.6 mm hachure pitch. Any of these can become a slider
later.

**Removed: the slope/height weight switch** (`hachBy`, URL `hb`).
Sun weighting took its place. Height weighting fights it for the line
weight, and the comparison showed slope + sun working. This settles
v5.6's "switch between both until I lock one" in favour of slope. Old
links with `hb` still open; the key is ignored.

**Decisions made while building:**

- **The light only reweights strokes.** Strokes carry their slope and
  summed gradient, and the weight is worked out at draw time. The
  on-screen strokes are cached against everything that moves them
  (mode, cap, spacing, length, seed, levels, field). Dragging *Light
  from* redraws in about 0.13 s instead of 1.4 s.
- **Export speed** (A4 at 300 dpi, Mountain range): hachures 6.2 s,
  stipple 3.7 s. v5.6.1 took 8.5 s; the smoothed field gives strokes
  fewer twists to trace.
- **Stipple's length is not true to Lehmann**, and doesn't need to be:
  it is its own look. At close spacing, long strokes read as dense
  shading. At wide spacing they read as fur (the user's observation),
  which is why spacing stops at 0.5 mm.

## v5.8: Actual-size preview (2026-09-30)

> **Stipple at 0.2 vs 0.5 - no particular difference
> while everything does read as 3d in engraved, the density and the
> overall look is not a nice as the test page ones.**

**Cause.** Zoom never magnifies the paper; it changes how much
landscape sits in the frame. The frame is always the whole sheet fitted
to the window: an A4 is about 530 px across 210 mm, roughly 2.5 px per
mm. The engraving is cut in fractions of a mm of print: 0.2 mm spacing
is half a pixel, and the tracer's floor of half a sample (about 0.4 mm
on screen) swallowed both 0.2 and 0.5. The test page drew at 4.5–8 px
per mm. Exports were right all along. 70 mm crops of the A4 exports,
shown at the test page's scale, match it, and 0.2 is clearly denser
than 0.5 (`screenshots/v5.8-export-crops-stipple-0.2-0.5-hachures.png`).

Three options went to the user:

- **A.** An actual-size preview, reusing the export (recommended).
- **B.** A second, paper zoom, like a print preview.
- **C.** A coarser engraving on screen only, so the screen no longer
  matches the export.

> **yes lets try that**

**Built (A):** an **Actual size** button above the export buttons, or
the **P** key.

- **Rendering:** `renderPage()`, split out of `exportPNG()`, draws the
  sheet onto a canvas exactly as the PNG export does. `previewPage()`
  runs it at twice CSS actual size (96 px per inch) times the screen's
  pixel ratio, capped at 300 dpi.
- **The overlay:** shows the sheet at **Actual size** (the sheet's mm
  at 96 CSS px per inch, which is about true size on a typical screen)
  or at **2×**. Zooming keeps the centre of the view in place.
- **Navigation:** drag to move around; Esc or ✕ closes it and drops the
  canvas.
- **Cost:** it takes about as long as an export (A4: 2–7 s, depending
  on the mode), since tracing runs at the export's 4 samples per mm
  whatever the pixel size.

The main view stays a tone preview. Engraved detail below a pixel can't
be shown at the fitted size, and the page now says so by offering the
real thing a click away.

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
| `projects/island-generator/documentation/sketch-notes-2020.md` | The 2020 notes, verbatim |
| `projects/island-generator/documentation/screenshots/` | `v5.0-desktop`, `-archipelago`, `-mountain-range`, `-lines`, `-mobile-controls`, `-exports`; later versions by number, e.g. `v5.7-hachure-comparison-range`, `v5.7-hachures-page`, `v5.7-stipple-page`, `v5.7-*-300dpi-crop`, `v5.8-actual-size-*`, `v5.8-export-crops-*` |

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

### v5.8.1: Engraved stays live while zooming and panning (2026-09-30)

**"zooming when engraved takes time to load"**, then **"panning as
well"**. Measured first. Each time the view settled, the whole screen's
engraving was traced in one blocking call: hachures took 1.3 s and
stipple 2.8 s. On top of that, all ~40 000 strokes were re-stroked on
every frame. Four changes:

- **Traced a slice per frame.** `hachuresSteps()` and `stippleSteps()`
  (and the sketch's `buildHachuresSteps()`) are generators that yield
  between rows or every 1024 seeds. The sketch runs them for 12 ms a
  frame. A newer field or setting drops unfinished work, and exports run
  them straight through (`finish()`).
- **The old engraving stays up.** It is placed by the view it was traced
  in, like the field, so zoom and pan move and scale it until the new
  one lands. It is cleared only when the terrain itself changes.
- **Drawn once.** A finished engraving is stroked once into its own
  canvas (`rasterHach()`), and each frame only places that image. It is
  redrawn when the light moves.
- **Stipple seeds one per occupancy cell.** Seeding at spacing ÷ 2
  regardless of the cell size meant about 11 million seeds on screen,
  a 1.7 s freeze before the first yield. Exports are unchanged: at 4
  samples per mm the cell and the old gap are the same.

Also, each hachure row now reuses the previous row's upper contour as
its lower one, halving the marching-squares work. Measured during a
wheel zoom plus a drag-pan: the worst frame is about 80 ms (the one-off
raster), against 1.3–2.8 s before.

### v5.8: Actual-size preview (2026-09-30)

An **Actual size** button (or **P**) renders the sheet as the PNG
export does and shows it at about true size, or at 2×, in an overlay
you drag around. The fitted main view is about 2.5 px per mm for an A4,
too coarse for the engraving: Stipple spacing looked the same at 0.2
and 0.5 on screen, although the exports differ. `renderPage()` is now
shared by the PNG export and the preview. Details are under "v5.8:
Actual-size preview".

### v5.7: Engraved: hachures and stipple (2026-09-30)

The Hachures theme becomes **Engraved**, with a Hachures | Stipple
switch, after a four-way comparison sheet built from the user's reading
of Davison's dynamic hachures.

- **Hachures:** 4 rows per display band (at least 48 in all), traced
  on a 1.6 mm-smoothed terrain, with a stroke-length cap (1–2.5 mm or
  off, default 1 mm).
- **Stipple:** free strokes 0.4 mm up to 1–5 mm long, longer on steeper
  ground, with 0.2–0.5 mm spacing.
- **Both:** weight is slope × sun, with *Light from* (default
  north-west), stroke widths 0.04–0.34 mm, and 10 buckets in the PNG and
  in the SVG layer.
- **Removed:** the slope/height switch.
- **Speed:** moving the light only reweights cached strokes.

Details are under "v5.7: Engraved".

### v5.6.2: no creases in the land mask (2026-09-30)

**"is the spine line cutting them - i see a contour artefact in parallel
but not at the spine line, offset by some distance"**. The mask's
distance was clamped with a hard `min(d, 1.8)`, so the lift's slope
switched off in one step at 1.8 × Island factor. That put a crease in
the terrain along a line parallel to a spine, round each island, and
along a coast. It is now eased with `1.8 · tanh(d / 1.8)`: the same
slope near the focus and the same limit, with no crease.

The same kind of seam occurred where the nearest centre, or nearest
spine segment, switches. Those use a smooth minimum now (log-sum-exp,
width 0.12 R). Maps change slightly as a result, since the lift fades
more gradually.

### v5.6.1: hachures run contour to contour (2026-09-30)

**"the hachures arent going form one contour to the next, they seem to be
stopping after some fixed distnace with a white gap upto the next
contour - it looks like terraced fileds"**. Measured before fixing: only
27% of strokes reached the next contour, and 62% stopped on a neighbour.
The cause was geometric. Strokes were seeded on each band's lower contour
and traced *uphill*, and going up a hill contours shorten, so neighbouring
strokes converge and stop. The 3.5 mm length cap made it worse. Now there
are two passes per band:

1. **Downhill from the upper contour.** Strokes fan out as they descend,
   so they reach the lower contour.
2. **Uphill from the lower contour,** only into empty space. This fills
   the wedges between fanning strokes, and runs to the summit in the top
   band.

The length cap is gone. A stroke now ends early only where the ground
flattens (below 8% of the landscape's steep slope; 4% when weighting by
height), because there the direction of steepest descent is noise. A4 at
300 dpi exports in about 8.5 s.

### v5.6: Hachures (2026-09-30)

A fifth colour theme: engraved-map hachures on paper, weighted by slope
or by height (a switch), with water-lining for the sea and the coast
always drawn. It exports to PNG and to SVG lines, where the hachures and
water lines are their own layers. Details are under "v5.6: Hachures".

### v5.5.2: sea bands follow Contour bands (2026-09-30)

**"contour bands should apply to the sea as well - 10 bands = 10 from
cost to max-height of island and 10 from coast to max-depth of sea"**.
The fixed 6 depth bands (v5.1) are gone. With Depth contours on, the sea
gets the same number of bands as the land. Each side has its own step:
coast → highest point, and coast → deepest point on the landscape.
Contour lines and SVG exports follow, so 10 bands give the coast plus 9
lines on each side.

### v5.5.1: no depth lines when smooth (2026-09-30)

Fix: **"when contour bands = 0 and contour lines is toggled on, the sea
still shows contour lines"**. Those were the depth lines, still traced at
their 6 fixed steps. Smooth now means smooth under the sea too: depth
shading stays, depth lines are dropped. This applies on screen and in PNG
and SVG export, which leaves only the coast.

### v5.5: the frame, print size, smooth shading, readable facts (2026-09-30)

The sheet is now an aspect-ratio frame fixed on screen: A-series, Square,
4:3, 16:9, Custom W:H or None. Zoom and pan choose what sits in it, and
that is what exports. The landscape has its own space (the unit square
anchors centres and sea level), so changing the ratio never rebuilds it.
Export resolution is a print size (long edge 210 / 297 / 420 mm, named
A5 / A4 / A3 for A-series) × dpi. Zoom and pan are in the URL. "This map"
facts describe the frame's contents. Contour bands go down to 0 = smooth,
unbanded shading. Facts and Under the hood text are lighter, and Under
the hood uses the 2020 sketches' notation (`t`, `noiseDetail`, `elev`,
`isleFac`, `isl`, `b`).

### v5.4: Topographic, toggle kept in Lines (2026-09-30)

"Topology" renamed **Topographic** (**"Yes make it topographic"**). The
Contour lines toggle stays visible in Lines style, shown on and greyed
out (**"Keep the contour lines toggle in lines mode as well just greyed
out"**), so the control doesn't jump in and out of the panel. The
viewer's own setting is kept for when they switch back to a filled
style.

### v5.3: Topology, contour overlay, Land weight (2026-09-30)

Colours are now Grey / Thermal / Topology / Lines, with keys 1–4.
Topology is the realistic-colour option. A *Contour lines* toggle draws
the lines over any filled style: ink on land, pale in dark seas, and
traced at half resolution on screen. It also applies to the PNG export.
Land focus is renamed Land weight. The Shape tooltip no longer mentions
it.

### v5.2: the user's names and order (2026-09-30)

Controls regrouped into Presets / Land and sea / Terrain details / Visual
controls, all collapsible and remembered, with the Page panel the same.
Renames: Feature smoothness (reversed), Surface roughness, Elevation
exponent, Island factor. Helper text moved behind ⓘ tooltips (hover or
tap). "Your …" and 2020 references removed from the interface; explainer
rewritten.
