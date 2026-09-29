# Conversation log: Island Generator

This is the companion to [`ISLAND-GENERATOR.md`](ISLAND-GENERATOR.md),
which records what was decided and built. This file records the reasoning
and the actual exchange behind it. The user's inputs are quoted verbatim
in bold, typos kept. There's no code here; that's in git history and the
changelog.

## Part 1: "Have a look." (2026-09-29)

> **F:\__SnowCrash\__WebPages\form-follows-fx\_temp
>
> The temp folder contains a series of sketches that uses Perlin Noise to
> create a countour map, initially with a mouse variable, but later with
> sliders and inputs.
>
> Have a look.**

All seven `sketch.js` files were read, and the reply described each
version in a table:

| Version | What changes |
|---|---|
| v1.0 | Plain noise field; ellipses per pixel plus a near-transparent image |
| v2.0 banding | Floor into `b` bands, which gives the contour look; the terrain scrolls |
| v2.2 mouseX | mouseX → band count; `y0 = 0` stops the drift; click saves a JPG |
| v3 sealevel | mouseY → exponent; mapping from `b/3` gives black oceans |
| v4.0 islands | The `(1 + e − d)/2` island formula |
| v4.2 cleaned | Sliders for bands, exponent, island factor |
| v4.3 nonIsland | Focus at (w/3, h/3), A-series canvas, Save / New Scape, the notes and to-do |

The reply also listed the bugs found while reading (these are now in the
design doc):

- The HSB brightness clipping, which explains "usually 150 was good".
- `TRUE` is undefined, which explains "switching between colour and BW
  did not work".
- `key == s` throws on any keypress.
- The stale slider label.
- Full redraws every frame.
- About 40 MB of unused duplicated p5 across the folders.

Two ways forward were offered: revive the sketch under `projects/` the
way Dance of Planets was done, or archive the history as a record.

## Part 2: the brief

> **great, can you now do the following - along the lines of teh Dance of
> Planets page, do :
>
> - create an Island Generator folder inside fffx projects
> - add erach of the versions to the folder, and commit each version with
> appropriate messages - your table is correct as far as my intentions
> went, then overwrite with the next
> - extract the todos and other comments into an md file
> once past the already done data, I want this :
> - a page that provides the controls to manipulate noise based islands
> - exports the islands as vectors or images
> - controls allow to go from island to mainland landscape, variable
> sealevel, central large island to archipelagos,  mountain ranges etc,
> using just the same set of parameters and slider inputs
>
> Ask me any questions for clarity
> Document the project along similar lines as Dance of Planets as well -
> design decisions, technical changelog, and conversational discussion
> with QnA between both of us.**

Before asking, a check showed that all seven folders load the same
`libraries/` (p5 v0.5.8). The 4.3 MB root `p5.js` (v0.10.2) is loaded by
none of them, so committing `libraries/` costs about 1.4 MB once. A
parameter set was proposed: seed, feature scale, roughness, sea level,
peakiness, land focus (with mask shape point/edge), ridges, coast warp
and contour bands, with presets as named points in that space.

### First round of questions

| Question | Options offered | Answer |
|---|---|---|
| What each history commit contains | Runnable (+ `libraries/`, recommended) · Byte-identical, everything · Code only | **Runnable: + libraries/** |
| Vector export (plotter / laser via FabSite?) | Contour lines SVG · Filled band layers SVG · DXF too | **Contour lines (SVG), Filled band layers (SVG)** |
| Look | Same HUD shell, map feel · Your call after a draft · Different layout | **Different layout** |
| Render styles | Grey bands (original) · Hypsometric colour · Thermal · Contour lines only | **Grey bands (original), Thermal, Contour lines only** |

The history commits were settled, so they were made at this point. There
were seven commits, `b1ce876` → `80fa45d`, each touching only
`projects/island-generator/`, with each author date set to that
version's `sketch.js` timestamp. The 2020 notes were then extracted to
`sketch-notes-2020.md`.

### Second round

"Different layout" had come back with no description, so it was asked
again, alongside the remaining open points:

| Question | Options offered | Answer |
|---|---|---|
| The layout you had in mind | Map sheet / print layout · Classic panel + canvas · Canvas on top, controls below | **"full bleed canvas, controls float above, like DoP, but controls for export for page dimensions and zoom"** |
| How island centres are set | Both (recommended) · Generated only · Click only | **Both** |
| The proposed parameter set | Yes, go with it · Fewer · Let me adjust | **Yes, go with it** |
| Image export | PNG at A-series print res · PNG at screen / 2048 / 4096 · Heightmap PNG (16-bit-ish grey) | **PNG at A-series print res, Heightmap PNG** |

So the answer to "different layout" was the DoP shell after all, but with
the page as a first-class object. The right-hand panel became the sheet
(size, orientation, resolution, zoom) and export, and the map got a frame
showing exactly what exports.

## Part 3: building v5.0 (same session)

There was no new user input during the build. It followed the answers
above. What came up along the way, in order:

1. **The folder was replaced, not added to.** v4.3's `index.html`,
   `sketch.js` and `libraries/` were removed in the v5.0 working tree and
   stay in history. p5 now comes from cdnjs 1.9, as in DoP.
2. **Own seeded noise.** Shared links and exports at any size have to
   reproduce the same map, and the model shouldn't need p5, so the page
   uses its own Perlin noise instead of p5's `noise()`. The trade-off is
   that the 2020 · v4.3 preset matches the old look in spirit, not pixel
   for pixel.
3. **Sea level became "share of the sheet under water"**, so it keeps its
   meaning as the other sliders move, and so panning and zooming can't
   move the coast.
4. **The first render made circles.** The first headless screenshots
   showed near-perfect round islands and a grid of fuzzy discs for the
   archipelago. Measuring the noise explained it: normalising fBm by the
   sum of its amplitudes left heights with a standard deviation of only
   about 0.06, and the island mask's range of 1.5 decided every
   coastline. Normalising by spread (standard deviation ≈ 0.16), softening
   the mask, and letting Coast warp bend the mask's coordinates as well as
   the noise's made coastlines wander. The "after" images are the ones in
   `screenshots/`.
5. **An id clash**: the page-size readout and the Island size slider both
   used `out-size`, so the page dimensions appeared inside the slider
   label. It was renamed.
6. **The v4.3 preset got the original's (w/3, h/3) focus** via a moved
   centre, so it lands where the 2020 sketch put the island.
7. **Exports were checked against each other.** SVG lines, SVG layers and
   the 300 dpi PNG were rendered side by side from the same state and
   agree. The heightmap header reads 16-bit greyscale, and its data
   inflates to exactly width × height × 2 plus filter bytes.

The build stopped before the fffx launch steps (deploy loop, entry
wiring) and before any look-and-feel review. Those are the user's next
calls, listed in `TODO.md`.

## Part 4: first review (2026-09-29)

> **Ok, feedback :
>
> presets - dont need the 2020 version
>
> why does the land focus slider sometimes ahve and sometimes disappear
> the islands-coast-spine buttons ?
>
> RHS bar :
> Sheet should also have None as an option, if I want to admire the whole
> thing without the boundary
> Have A3, A4, A5, square, and custom dimension, and none
>
> LHS + RHS panel - let it extend the full height of the page, and
> indicate there is further to scroll if needed
>
> Dont need 2020 colours
>
> Depth contours undersea dont work
>
> The biggest issues is that I dont relate my work with these controls,
> and I have tragically forgotten a lot of my work since it was from many
> years ago**

On the disappearing buttons: v5.0 hid the Islands / Coast / Spine
controls whenever Land focus was 0, because at 0 no centres are used and
the controls do nothing. That was a reasonable rule that read as a
glitch. They now stay visible, and picking one turns focus back on.

On depth: the contours were being drawn, just invisibly. The sea shades
were all near-black, and the depth lines used the land's step, so they
bunched at the coast.

The concrete items were fixed as v5.1 (listed in `ISLAND-GENERATOR.md`).
The last point is not a bug to fix but a design question: the page was
built as a *general* island tool, and its vocabulary (land focus, coast
warp, peakiness) is new. The user's own 2020 vocabulary (bands,
elevation exponent, island factor, the Perlin increment `t`) and the
order in which the ideas arrived (noise → bands → exponent and sea →
island mask → off-centre focus) aren't visible anywhere on the page.
Ways to reconnect them were put to the user as a discussion before
building anything.
