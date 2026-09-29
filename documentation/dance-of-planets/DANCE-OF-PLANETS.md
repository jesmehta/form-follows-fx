# Dance of Planets — Design Decisions & As-Built Notes

An interactive p5.js page that draws the geometric pattern two planets
trace as they orbit the Sun: every few days a line is drawn between them
(or their midpoint is traced), and over one full shared cycle the ratio of
their orbital periods resolves into a rose, a trefoil, a lace ring. Lives
at `projects/dance-of-planets/`, served at `/dance-of-planets/` on
`fffx.cabinetofcuriosities.in`.

Companion docs in this folder:

- [`conversation-dance-of-planets.md`](conversation-dance-of-planets.md) —
  the real conversation behind these decisions, user inputs verbatim in bold.
- [`TODO.md`](TODO.md) — the running todo list, checked off as items land.

## Initial need

The sketch started as a visualisation of the **Dance of Venus** — the
five-petalled rose Earth and Venus draw over 8 years (13 Venus orbits ≈ 8
Earth orbits). It was then generalised to any two of the nine planets, and
wrapped in an HTML control panel (v2.0 → v2.2, generated with Claude.ai in
May 2026).

Coming back to it months later, in the user's words: **"I also think the
controls arent very self explanatory - I have come back to this proj after
a while and even I am a little plussed, and I know what maps to what under
the hood. A fresh viewer would be lost."**

The page has two jobs at once: **a tool to explore the orbital
relationships**, and **a way to appreciate the beauty of what comes out** —
"the trails, the shapes, the harmonic spirographic art". It is one half of
a two-page set: a writeup page (captured visuals + writing on the Dance of
Venus and the code, to replace the placeholder
`docs/tools-and-libraries/harmonics-dance-of-planets.md`) and this
interactive page. Audience: fffx and wider Cabinet visitors; images will
also go out on social media, linking back.

## What was wrong with v2.2 (diagnosis, agreed with the user)

- Nothing on the page says what is being drawn.
- Labels are implementation terms: "Inter-planet line / Midpoint trail",
  "Loop mode", "Step size (°/frame)", "Fade alpha 0.1–10 (direct p5 alpha)".
- Two application models side by side: zoom applies live, everything else
  waits for **Reset**, and the "⚠ reset to apply" note appears after the
  confusion, not before it.
- Controls visible when inert (fade only matters in continuous mode).
- Button overlap: *Reset & Draw* vs *Clear Canvas* (Clear doesn't stop
  drawing).
- The right panel shows debug values ("Deg", "Cycle end 2920.0°") while the
  interesting fact — 13 : 8, a line of Venus's life in 8 years — is buried.
- Fixed 800×800 canvas; title and footer still say v2.0.
- **The orbital-speed bug** (below).

The user's framing: **"Density may be the symptom, the problem/my issue is
exactly what we discussed above - the controls and info are not immediatly
obvious, useful, etc. Hence it seems strange and dense."**

## Decisions and intent

### Where it lives: `projects/` inside fffx (Bookshelf's pattern)

Three models exist across the sibling repos:

1. **Cabinet's SOP** (`CabinetOfCuriosities/documentation/backend-and-deploy/cabinet-multi-repo-assembly-concept-note-short.md` §7):
   ordinary pages live in the world's repo; *substantial* projects keep
   their own repos and are assembled into the site at deploy time
   (`content/external-repos.tsv` + `tools/assemble-external.js`); worlds get
   subdomains.
2. **Bookshelf's `projects/<name>/`**: self-contained static interactive
   pages (scifi, asimov, christie) committed inside the world's repo and
   copied into the built site by a loop in `deploy.yml`.
3. A plain `github.io` repo linked as `external` (Prompt Generator etc.,
   before Cabinet's assembly).

By the SOP's own test Dance of Planets qualifies as "substantial", and that
was the recommendation. **The user chose Bookshelf's `projects/` pattern
instead**, inside fffx. The reason the domain mattered at all: shared links
and social posts should land on `fffx.cabinetofcuriosities.in`, not
`github.io` — both 1 and 2 satisfy that; 2 is the lighter mechanism and keeps
the tool beside the writeup.

The writeup page is an ordinary MkDocs page either way and stays in
`docs/tools-and-libraries/`.

### History: every received version committed in order

**"I would actually want v2, v2.1 to be present in the git and overwritten
in the folder as the next version came in, preserves the versions I got
directly from Claude AI etc. After that I agree with committing 2.2 and then
updating that as we go."**

Done as three commits (`8f993b0` v2.0, `f5a66da` v2.1, `e56623a` v2.2), each
byte-identical to its source in `__WebPages/DanceOfPlanets/`, author date set
to the source file's timestamp. Order was confirmed by content, not
timestamps: `files.zip`/`dopv2.2/`'s entry dates (18:58) predate v2.1
(23:51), but v2.2 is clearly the refinement (`parseInt` → `parseFloat` fade).
The entry file is `index.html` from v2.0 onward so the folder serves at
`/dance-of-planets/`; the originals' filenames are in each commit message.
`__WebPages/DanceOfPlanets/` itself is left untouched.

### Settings apply without restarting — recompute at the current progress

The resolution of the user's point 7 (**"maybe the settings are being set
so continuously restarting will get annoying - at the same time, I would
like things to be more responsive and not have to go to reset every time I
make a change"**).

The drawing is a pure function of (pair, cycle, style, detail, look,
progress). Nothing needs to be kept as pixels, so any change can redraw the
whole picture up to the current point in one pass. Three tiers:

| Tier | Settings | Effect |
|---|---|---|
| Doesn't touch the drawing | speed, planets/orbits overlay, pause | instant |
| Changes how it looks | zoom, colour, opacity, line weight, detail, style, classic toggle | redrawn at the same progress |
| A new picture | planet pair, preset, cycle | starts from zero |

No Reset button; a transport bar (play/pause, restart, scrubber labelled in
years) replaces it. User: **"love it - recomputing for the new settings but
at the current progress point is a great way to reconcile this."**

Known approximation: in *Keep drawing* (fade) mode the exact image depends
on frame history, so a redraw reconstructs the tail with an alpha ramp
instead of replaying every frame.

### Speed and detail split apart

v2.2's "Step size (°/frame)" meant two things: how fast it animates *and*
how dense the lines are. v3 separates them: **Speed** (lines per frame —
changes nothing in the result) and **Detail** (lines per orbit of the faster
planet — changes the picture). Detail is expressed per orbit of the faster
planet so the visual density is consistent across pairs; the equivalent
"a line every N days" is shown alongside.

### Plain-language controls, raw numbers demoted

**"I think plain language controls are necessary. Raw numbers can be part
of the info display on the RHS but less prominent than say,
planetary/orbital info, etc"**

### Info panel: the rhythm, not the machinery

Kept: names, periods, distances, ratio, cycle length. Added (agreed): petal
/ symmetry count (13 − 8 = 5), synodic period, how exactly the cycle closes
(the angle it misses by — why the rose slowly turns), live orbit counts,
closest/farthest distance. Raw numbers in a muted section at the bottom.

### Cycle choice from the ratio's convergents

v2.2 searched for the smallest integer ratio within an *absolute* tolerance
of 0.004, which behaves very differently for a ratio near 1.6 than one near
1000 (Mercury–Pluto). v3 uses the continued-fraction convergents of the
period ratio — the natural "best approximations" ladder — and offers them
as a **Cycle** choice (e.g. Jupiter–Saturn: 60 yr at 5 : 2, or 678 yr at
57 : 23). Default is the first one that closes to within a few degrees and
fits the line budget; presets can pin a specific one.

### Resolution and export: recompute, don't screenshot

v2.2 exported the 800×800 canvas as-is (800 px, or 1600 px on a HiDPI
screen) — fine for a phone, poor for prints. Because the drawing can be
recomputed, export renders off-screen at 2048 or 4096 px, plus **SVG**
(built directly from the segment list, no library). Very long cycles are
capped (line budget) for redraw time and SVG size. **"agreed on the need,
delivery and capping"**

### Full-bleed canvas with a HUD overlay

**"an overlay over a full bleed canvas feels very HUD/spaceship window so
works. Don't make it a cliched CRT Matrix Green etc though."** Structure
stays three-part (controls — canvas — info: **"3 cols is fine"**), as
translucent panels over a full-window canvas, collapsible, with a key to
hide the HUD entirely for clean captures. Look: **"keep current look for
now"** — v2.2's palette (gold `#c8a96e`, blue `#6e8ec8`, near-black) and
fonts (Space Mono + Rajdhani), not fffx's `--fffx-*` tokens.

### Presets

Agreed (**"Presets absolutely"**): Earth–Venus (the 8-year rose),
Earth–Mars, Mercury–Venus, Venus–Mars, Jupiter–Saturn (the 60-year
great-conjunction triangle), Uranus–Neptune, Neptune–Pluto (a real 3 : 2
lock).

### Colour: single colour (default) or time gradient

Colour-per-pair was dropped by the user: **"colour per planet pair will
have 9x8 = 63 colours which i dont think is useful. single colour and
time-gradient are useful. Default to single colour."**

### Planets and orbits overlay

Option (c): small drawn discs with distinguishing features (Saturn's ring,
Jupiter's bands) plus the astronomical glyph as a label, on a separate
layer that **never leaves a trail**, and orbit circles + Sun on a toggle.
User's own framing of the need: **"showing visual representations instead
of just the dots where they are - but this image/symbol/etc does not leave
any trails"**.

### Shareable URLs

All settings encode into the query string (updated live with
`history.replaceState`), with a copy-link button — so a shared image can
link back to exactly the configuration that made it.

### Keep p5

The writeup is about the coding; the page should stay recognisably the same
p5 sketch. Layers use p5's own off-screen `createGraphics`.

### The orbital-speed bug — fixed, with a Classic toggle

v2.x computes each planet's angle as `cos(ov * deg)` where `ov` is the
orbital **period**, so outer planets move *faster* (Pluto 248× Earth) —
backwards from real orbits. The figure keeps the same symmetry (13 − 8 = 5
for Earth–Venus) but its shape differs from the real Dance of Venus. Fixed
to angle ∝ time ÷ period. User: **"interesting. I'd love a discussion on
my code and this bug later. For now, implement your update, add the
discussion into a todo for later."** and **"keep toggle for now, will help
me understand the difference"** — so a **Classic (v2) speeds** toggle
reproduces the old behaviour, and images already posted stay reproducible.

## Architecture

*(filled in as v3.0 is built)*

## Files

| File | Role |
|---|---|
| `projects/dance-of-planets/index.html` | The page |
| `projects/dance-of-planets/dance_of_planets.css` | Styles |
| `projects/dance-of-planets/dance_of_planets.js` | The p5 sketch |

## Todo / watch out for

See [`TODO.md`](TODO.md).

## Changelog

### v2.0 — original single-file page (2026-05-02, Claude.ai)

Two-planet generalisation of the Dance of Venus sketch with a left control
panel and right info panel. Commit `8f993b0`.

### v2.1 — live zoom (2026-05-02, Claude.ai)

Zoom applies live without reset, scroll-wheel zoom on the canvas, midpoint
trail rebased on zoom so it doesn't jump. Commit `f5a66da`.

### v2.2 — split files, fractional fade (2026-05-03, Claude.ai)

Split into `.html`/`.css`/`.js`; fade alpha read as a float (0.1–10 direct
p5 alpha) instead of an integer. Commit `e56623a`.
