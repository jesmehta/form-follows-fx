# Form follows f(x) — Design System

**This file defines the target visual system for the landing page.** When
anything else in the repo conflicts with it, this file wins. Do not import
Bookshelf's serif/sepia/gallery-card system here — fffx has its own
metaphor and it must stay self-consistent.

---

## Core metaphor

The page is a single rectangle, recursively subdivided. There are no
cards, no grid tracks, no masonry. Every visual element — project tile or
filler cell — is one rectangle from that subdivision, absolutely
positioned by pixel coordinates the layout engine computed. The aesthetic
goal is "code visibly generating form": clean, computational, a little
strange, never decorative for its own sake.

Explicitly **not** this site: generic portfolio cards, glassmorphism,
neon/cyberpunk dashboards, drop shadows as depth cues, rounded "friendly"
corners, gradient-mesh hero backgrounds.

---

## Site architecture (context, not owned by this file)

MkDocs Material site. The landing page is `docs/index.html`, a standalone
HTML document copied through by MkDocs untouched — it does not go through
Material's theme, so there is no header/sidebar to hide and no
`.fffx-landing`-vs-`.md-header` specificity fight to manage. All other
pages (`docs/PackingShapes.md`, `docs/VeraMolnarRetrospective.md`, etc.)
get the normal Material theme/sidebar. See `LANDING-PAGE-NOTES.md` for the
full rendering pipeline.

All landing-page CSS still lives under one selector root —
`.fffx-landing` on `<body>` — even though there's currently no Material
CSS on the page to clash with. This is a defensive convention carried over
from the Bookshelf project, kept in case this page is ever mounted inside
a templated shell instead of served standalone.

---

## Typography

No custom font loading currently. System font stack only:

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Monospace (`"Courier New", monospace`) is used narrowly, as a deliberate
register-shift, for anything that reads as machine output rather than
authored copy:

| Element | Font | Role |
| --- | --- | --- |
| `.eyebrow` | monospace | "Cabinet of Curiosities / Level 1 World" kicker |
| `.fffx-tile-coord` | monospace | Per-tile `x,y` coordinate, top-right of each tile |
| `.fffx-tile-tags li` | monospace | Tag chips, revealed on tile hover/focus |
| `.fffx-cell-mark` | monospace | Filler-cell glyph / code-fragment / coordinate-label content |
| `h1`, body text | sans (system) | Everything else — title, intro, tile titles/body |

If a display font is ever introduced, it should differentiate fffx further
from Bookshelf's Libre Baskerville/Instrument Serif pairing — favor
something geometric/grotesk over serif.

---

## Colour tokens

Defined as CSS custom properties on `.fffx-landing`. Never hardcode hex
values elsewhere — extend this table first. **v2.0**: dark + single-accent
palette, replacing v1.0's light paper-and-ink theme. Token *names* are
unchanged (so existing references elsewhere in this repo still resolve) —
only the values flipped.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#0a0d13` | Page background — dark slate, not pure black |
| `--ink` | `#e7e9f0` | Primary text, tile borders — light-on-dark now, was dark-on-light in v1.0 |
| `--muted` | `#7f879c` | Secondary text — eyebrow, subtitle, tile body copy, coordinate labels |
| `--line` | `rgba(255,255,255,0.14)` | Tile-split hairlines, filler borders at full strength |
| `--line-soft` | `rgba(255,255,255,0.06)` | Structure-layer border, filler hatch/dots/gradient — quieter than `--line` |
| `--tile` | `#12161f` | Project tile background — a touch lighter than `--bg`, not near-white |
| `--tile-hover` | `#1b212c` | Tile hover/focus background — was a hardcoded `white` in v1.0, which would flash jarringly bright on a dark page |
| `--accent` | `#00d4ff` (cyan) | The **one** saturated colour on the page — focus outline, tile hover border, fallback tile accent for any unrecognised section. Never a section's own colour (see below) |
| `--filler-mark` | `rgba(255,255,255,0.22)` | Glyph / code-fragment / coordinate text inside filler cells |

Dark, low-saturation-except-one-accent palette — the "dark + cyan,
computational" register the v2.0 prompt asked for, adapted (not applied
verbatim — see the v2.0 changelog entries for what was kept vs. changed):
section identity still gets its own hue each (the prompt's spec was
fully achromatic except cyan), since per-section colour is load-bearing
here for telling sections apart visually, not just decorative.

### Per-section accent hues

A second colour layer sits on top of the base dark/cyan palette: each
`section` value from `data.js` gets its own hue, set as a `--tile-accent`
custom property via a `data-section` attribute selector on `.fffx-tile`
(no JS colour logic for *tiles* — that mapping lives entirely in
`landing.css`). `--tile-accent` drives the `.fffx-tile-meta` text colour
and the `.fffx-tile-tab` corner mark. The **structure layer** also tints
by section now (`tintForRect()` in `layout.js`) — see "Structure layer"
below — using the same ten hues, duplicated there as plain RGB triples
since inline `rgba()` strings need actual numbers, not a CSS var lookup;
if a hue changes here, the matching triple in `layout.js` needs updating
to stay in sync (no shared source of truth between the two files for
this conversion, by design — same as v1.0's warm/cool constants before
it).

| Token | Value | Section |
| --- | --- | --- |
| `--accent-prompt-collections` | `hsl(30, 58%, 62%)` | prompt-collections |
| `--accent-deep-studies` | `hsl(66, 58%, 62%)` | deep-studies |
| `--accent-recreating-the-past` | `hsl(102, 58%, 62%)` | recreating-the-past |
| `--accent-tools-and-libraries` | `hsl(138, 58%, 62%)` | tools-and-libraries |
| `--accent-generative-projects` | `hsl(174, 58%, 62%)` | generative-projects |
| `--accent-image-experiments` | `hsl(210, 58%, 62%)` | image-experiments |
| `--accent-sketch-families` | `hsl(246, 58%, 62%)` | sketch-families |
| `--accent-plotter-fabrication` | `hsl(282, 58%, 62%)` | plotter-fabrication |
| `--accent-code-to-objects` | `hsl(318, 58%, 62%)` | code-to-objects |
| `--accent-legacy-processing` | `hsl(354, 58%, 62%)` | legacy-processing |

All ten share the same saturation/lightness (58%/62%) — only hue differs
— so no section reads as more or less important than another by colour
alone, per the user's explicit request. Spaced 36° apart around the
wheel, offset so none lands in the ~175–205° band where `--accent`'s
cyan sits, keeping every section hue visually distinct from the one
cross-cutting accent. v1.0 special-cased `tools-and-libraries` to reuse
`--accent` directly (so the flagship Circle Packing Library tile kept
the page's one "brand" colour); that's gone in v2.0, since `--accent`'s
role narrowed to strictly "the one interactive accent," not any
section's colour. The **focus outline and hover border stay on the
global `--accent`** regardless of section — deliberately: a focus ring
that changed colour per tile would read as inconsistent state rather
than "you are here," so accessibility signalling and content-category
colour are kept as two separate channels.

---

## The subdivision field

`#subdivision-field` is the canvas: `position: relative`, bordered, plain
`--bg` background — there is no decorative grid pattern. Every rectangle
the layout engine produces is `position: absolute` inside it, placed by
pixel `left/top/width/height` — never flexbox/grid track layout. The
*only* visible "grid" on the field is the structure layer below, drawn
directly from the same rect data the tiles use — see "Structure layer."

### Structure layer (`.fffx-struct`)

- One div per non-root rect in the tree (every depth, not just
  leaves/tiles), painted in `allRects`' natural parent-before-child
  order. The inset itself is **not** computed here, or anywhere in
  `layout.js` — it's baked into the rect geometry at split time, in
  `subdivision.js`'s `buildRectTree()`. Each freshly-split child is
  shrunk by `d` on every side (`x += d, y += d, width -= 2d, height -= 2d`,
  `d = structInset` ≈ 1.5px). That inset rect, not the raw split, is what
  gets pushed into the tree and recursed into for the *next* split — so
  each generation is inset relative to where its own immediate parent was
  actually drawn, and the effect compounds consistently with depth.
  `renderStruct()` just draws `rect.x/y/width/height` as given, with zero
  inset math of its own.

  An earlier version computed inset as `rect.depth × structInset` against
  each rect's *raw*, never-inset bounds, as a rendering-only pass layered
  on top of an otherwise-untouched tree. That failed: a child shares 3 of
  its 4 edges exactly with its parent's raw bounds (only the newest split
  line is a new boundary), and since raw sibling/parent edges always
  touch with zero gap to begin with, an inset computed independently
  per-node against those raw bounds has no reliable relationship to
  where the parent is actually drawn — the result was inconsistent,
  "haywire" gaps rather than a clean nested-frame look. Baking the inset
  into the recursion itself is what fixes that — there's no separate
  stroke/border system drawing the structure — the structure draws
  itself, correctly, because the geometry *is* correct.

  A second correction followed: the first baked-in version only
  subtracted a single `d` from width/height (only the top-left corner
  moving in), on the theory that the bottom/right edge should stay
  exactly on the split line. True for the *interior* edge a split just
  created — but each child also has two edges inherited directly from
  the parent's own boundary (whichever dimension that split didn't
  touch), and those were never inset at all under the single-`d`
  formula, leaving a child's far corner sitting exactly on its parent's
  boundary rather than nested inside it. Subtracting `2d` instead of `d`
  (while `x`/`y` still only advance by `d`) insets every edge uniformly,
  whatever it borders.
- Each rect is filled with a low-alpha tint of its own section's hue
  (`tintForRect()` in `layout.js`, looked up by `rect.sectionId` — every
  rect carries one, inherited from its section's root). This replaced an
  interim two-tone warm/cool placeholder, which itself replaced v1.0's
  "key off the root split side" mechanism — that trick stopped meaning
  anything once v2.0's tree started partitioning by section first (see
  `LANDING-PAGE-NOTES.md`), since a rect's id no longer encodes which
  top-level branch it descends from. Colour now reads as "which
  section," and the existing alpha-stacking-by-depth still reads as "how
  nested" — two separate signals, not one warm/cool duality. The ten
  hues are the same `--accent-<section>` values from the table above,
  duplicated in `layout.js` as RGB triples (`SECTION_TINTS`) since the
  inline `rgba()` string this feeds needs actual numbers. Generated
  entirely by ordinary CSS alpha compositing of stacked elements, not by
  any hand-authored gradient.
- `pointer-events: none` — purely visual, never intercepts clicks meant
  for a tile or filler cell sitting on top of it.

### Project tiles (`.fffx-tile`)

- Real `<a>` elements, one per placed entry — always navigable, never a
  div-with-onclick.
- Title and subtitle font sizes are computed per-tile in `renderTile()`
  from that tile's own `rect.width`/`rect.height` (clamped to a sane
  min/max), set as `--tile-title-size`/`--tile-body-size` custom
  properties. **Not** a viewport-relative `clamp(…vw…)` — that was tried
  first and gave a 180px tile and a 600px tile the same font size, since
  `vw` only knows about the viewport, not the tile. As a safety net (the
  size estimate is a heuristic, not exact text-measurement), `h2` and `p`
  both clamp to 2 lines (`-webkit-line-clamp: 2; overflow: hidden`) so an
  unusually long title/subtitle truncates instead of silently overflowing
  past the tile's `overflow: hidden`. The tags row only renders at all
  for tiles `≥200×150px` — below that there's no room for a third text
  row regardless of sizing.
- 1.5px `--ink` border, `--tile` background, content bottom-anchored
  (`justify-content: flex-end`) so titles sit just above the tile's lower
  edge regardless of tile size.
- `.fffx-tile-tab`: a small 28×4px coloured bar at the top-left corner,
  filled with `--tile-accent` (the entry's section colour). The one
  deliberately "graphic" mark on an otherwise dark-slate tile — reads
  like an index-card or file-tab flag, reinforcing the categorical
  colour without turning the whole tile into a colour block.
- A `::before` pseudo-element carries the entry's thumbnail image at low
  opacity (0.22, rising to 0.34 on hover) and full grayscale — a ghost of
  the artwork behind the type, not a photo treatment. Never raise opacity
  much further or remove grayscale; that would turn this into a generic
  image card.
- Hover/focus-visible: `scale(1.015)`, background brightens to pure white,
  border thickens to 2.5px, `z-index: 20`. Subtle — this is not a card
  lift-and-shadow interaction.
- **Live re-subdivision hint**: four 1px hairlines
  (`.fffx-tile-split-v1`/`-v2`/`-h1`/`-h2`), scaled to zero and invisible
  by default, growing to full length/opacity on hover or focus. Two
  verticals sit at `k` and `2k` in from the tile's *right* edge; two
  horizontals sit at `k` and `2k` down from the tile's *top* edge — not a
  cross through the center (an earlier version did that and read as a
  generic 2×2 grid rather than a re-subdivision cue). `k` = 10% of the
  tile's shorter dimension, computed per-tile in `renderTile()` and set
  as `--split-k`, so the offsets scale with the tile rather than landing
  right on one tile size and wrong on another. The effect reads as "the
  algorithm just re-split this rectangle in front of you" — the one
  place the metaphor becomes an explicit interaction rather than a
  static fact about the layout.
- **Tag reveal**: `.fffx-tile-tags` sits at `max-height: 0; opacity: 0` by
  default and expands on hover/focus-visible. Keeps tiles visually quiet
  at rest while still surfacing tags to anyone who pauses on a tile —
  balances "usability over visual cleverness" against not cluttering
  every tile with chips all the time.
- `.fffx-tile-coord` (top-right, monospace, 0.45 opacity) shows the tile's
  `x,y` origin in the subdivision, always visible (not hover-gated) — the
  "slightly strange but usable" detail that confirms placement is
  algorithmic, not designed by hand.
- `.fffx-tile-meta` line (section / kind) is the only `--accent` colour use
  on a tile at rest — keep it that way, don't spread the accent colour
  elsewhere except the focus outline.
- `:focus-visible` gets an explicit `2px solid var(--accent)` outline with
  `3px` offset, on top of the hover treatment — never rely on hover styles
  alone to signal interactivity for keyboard users.

### Muted tiles (`.fffx-tile--muted`)

- Applied whenever an entry's `status` is `"wip"` — i.e. the portal is
  real and linkable but its actual content isn't written yet. (`status`
  is also what decides whether a tile renders at all: `false` excludes it
  entirely, `true` renders it normally. One field, three states, no
  separate "is this finished" field alongside it.)
- Signalled by **line weight, not dashing** — a live tile's border is
  `1.5px` at rest, `2.5px` on hover/focus; a muted tile's is thinner at
  rest (`1px`) and gets a smaller hover/focus jump (`2px`), always solid.
  Background drops to `--bg` (the page's own dark ground, not the tile
  colour) at rest, `opacity: 0.72`. On hover/focus it snaps back to a
  normal solid `--tile`
  background at full opacity — the muting is a resting-state signal, not
  a permanent disability; it should never read as broken or unclickable.
- The `.fffx-tile-meta` line gains the literal text `wip` appended after a
  `·` separator, and switches from `--accent` to `--muted` colour — both
  the colour change and the literal text are intentional, redundant
  signals (don't rely on one alone, colour-blind and skim-reading users
  need the text).
- Still a real `<a>` with the live-resubdivision hairlines, tag reveal,
  and coordinate label intact — muted is a styling state, not a different
  component.

### Filler cells (`.fffx-cell`)

- Drawn only from **leaf** rectangles (the subdivision tree's terminal
  rects) that survived assignment — i.e. weren't blocked as an
  ancestor/descendant/overlap of an assigned tile. Leaves tile the canvas
  with no gaps and no overlap by construction, so filler never double-draws
  underneath a tile or against another filler cell.
- Below `landingConfig.layout.minFillerSize` (22px either dimension) a
  leaf renders no filler div at all — the structure layer underneath
  still shows through. Most of the finest subdivision detail gets no
  pattern/glyph on top of it; only cells large enough to carry a
  treatment legibly get one.
- Ten treatment variants, picked deterministically per-cell from the
  cell's own rect id (not from draw order, so a given id always maps to
  the same treatment — though the tree reseeds every page load, so which
  ids exist at all changes from load to load; see `LANDING-PAGE-NOTES.md`):
  `plain` (×3 weight — most filler should be quiet ground), `hatch` (×2,
  45° diagonal lines), `dots` (radial-dot grid), `gradient` (soft diagonal
  wash), `glyph` (one of `+ * × ∘ ~ f(x) sin noise p5 Σ`), `code` (a short
  fragment like `noise(x, y)` or `lerp(a, b, t)`), `coord` (the cell's
  `x,y` origin, same convention as tile coordinates).
- All treatment ink uses `--line-soft` or `--filler-mark` — always quieter
  than a tile's `--ink` border and `--accent` meta line. Filler is texture,
  never competes with a tile for attention.
- Filler cells are inert — no `<a>`, no focus state. A cell's pattern
  nudges its `background-position` a few pixels on `:hover` as a faint
  acknowledgement of the cursor, nothing more.
- On mobile (`body.fffx-is-mobile`), all filler cells drop to `opacity:
  0.6` — quieter decoration so the page reads cleanly on a narrow,
  scrolling viewport where every tile needs to dominate its row.

---

## Tile/filler area balance

Tiles, in aggregate, target ~65% of the field's area
(`landingConfig.layout.targetTileAreaFraction`); filler/blank texture
fills the rest. This is computed fresh per render in `layout.js` from the
*current* field area and the *current* sum of visible entries' weights —
not a fixed px² constant — so the ratio holds at any viewport size and
adjusts automatically as entries are added or removed. It's a target for
the scoring system to aim at, not a hard constraint a layout engine
enforces exactly; actual coverage can drift somewhat depending on which
candidate rects the reseeded tree happens to offer. See
`LANDING-PAGE-NOTES.md` for the formula.

### Section minimum-area guarantee

A section's share of the field is weight-proportional
(`weight_i / totalWeight`), which means a low-weight section can end up
with very little area — and if that area is too small, that section's
entries simply never get a candidate rect to render in (this happened in
practice: a single weight-4 entry in an otherwise-light section landed
in a region narrower than `minThumbWidth`, see
`LANDING-PAGE-NOTES.md`'s bug writeup). Rather than guess at a bigger
field and hope, `layout.js` computes the minimum field area that
guarantees *every* enabled section's proportional share clears its own
hard floor — one `minThumbWidth × minThumbHeight` candidate per visible
entry it has, times `sectionAreaBuffer` (3×) headroom — and grows the
field (vertically only; width stays viewport-locked to avoid horizontal
scroll) to that minimum if the actual viewport is smaller. This is a
guarantee, not a target: excess negative space if a section needed more
room than its neighbours is the explicitly preferred failure mode over
ever silently dropping an entry. See `LANDING-PAGE-NOTES.md` for the
formula and why `#subdivision-field`'s height has to be set explicitly
in JS for this to actually be visible (it doesn't grow on its own —
`overflow: hidden` plus every child being `position: absolute` means the
element never expands to fit taller content by itself).

## Spacing & structure

- `.site-header` padding `2rem` desktop / `1.25rem` mobile — no card, no
  border, just the hero block sitting on `--bg`.
- `#subdivision-field` margin `1rem` desktop / `0.75rem` mobile, min-height
  `72vh` desktop / `120vh` mobile (mobile needs more vertical room because
  tiles stack rather than spread).
- Tile internal padding `0.85rem` — tight enough that text sits close to
  the tile's own edges, reinforcing "this rectangle is exactly the unit of
  content," not a card with generous internal whitespace.

---

## Motion

Minimal and functional, three sources total:

1. **Tile hover/focus** — `transform 180ms ease, background 180ms ease,
   border-width 120ms ease`, plus the split-hairline and tag-reveal
   transitions (also ~180–220ms ease). The full interactive motion budget
   for a tile.
2. **Filler hover** — `background-position` shifts by a few px over 600ms;
   the only filler-cell motion, and only on direct hover.
3. **`@media (prefers-reduced-motion: reduce)`** — removes all transitions
   listed above. Every future motion addition must be added inside this
   block from the start, not bolted on after.

The structure layer and per-section accent colours are both static —
colour/depth here comes from CSS alpha compositing of stacked elements,
not from any animation.

No entrance animations, no scroll-triggered reveals, no parallax. The
layout is the spectacle; it doesn't need additional motion dressing.

---

## Responsive behaviour

Single breakpoint at `700px`. Below it, `isMobile` in `layout.js` switches
`landingConfig.layout.desktop` for `landingConfig.layout.mobile`: shallower
`maxDepth`, a larger `minRectSize`, and `minThumbWidth` computed as a
*ratio of the live viewport width* (`minThumbWidthRatio: 0.78`, i.e.
roughly 78% of viewport width) rather than a fixed px floor — this is what
guarantees mobile tiles read as near-full-width rows instead of shrinking
to fit a desktop-shaped rectangle. Canvas height (mobile *and* desktop)
grows beyond the CSS `min-height` whenever needed to guarantee every
section can fit its own visible entries above `minThumbWidth ×
minThumbHeight` — see "Tile/filler area balance" below; this replaced an
earlier mobile-only flat heuristic (`entries.length * 230`) that had no
desktop equivalent and no actual relationship to thumb-size thresholds.
Filler cells also
drop to `opacity: 0.6` on mobile (`body.fffx-is-mobile`) — quieter
decoration, more attention on tiles. There is no separate mobile layout
file or markup — the same subdivision algorithm (`subdivision.js`) runs at
different parameters, orchestrated entirely from `layout.js`.

---

## Changelog

- **2026-06-29** — Rewrote this file for the v2 layout engine: renamed
  classes from `.tile`/`.cell.filler`/`.tile-coord`/`.cell-tag` to
  `.fffx-tile`/`.fffx-cell`/`.fffx-tile-coord`/`.fffx-cell-mark` to match
  the actual `layout.js` output. Added the live re-subdivision hover hint,
  tag-reveal-on-hover, explicit `:focus-visible` outline, background-grid
  shimmer (+ `prefers-reduced-motion` handling), the ten-treatment filler
  system (was a single hatch treatment), the `--line`/`--line-soft` split,
  and the mobile filler-opacity rule. Documented `minThumbWidthRatio` as
  the actual mobile sizing mechanism (a viewport-width ratio, not a fixed
  px floor).
- **2026-06-29** — Replaced the generic background grid-paper pattern with
  a real structure layer (`.fffx-struct`, no border/no fixed pattern —
  every visual line is now an actual rect from the subdivision tree,
  inset and tinted per `structInset`/`structAlpha`). Added the
  `.fffx-tile--muted` treatment for portals whose content isn't migrated
  yet, now that `data.js` carries fifteen real portal entries spanning
  live, to-migrate, and do-not-touch-yet content.
- **2026-06-29** — Added the colour system: ten per-section accent hues
  (`--accent-<section>`, table above) wired to `--tile-accent` via
  `data-section` attribute selectors, used by `.fffx-tile-meta` and the
  new `.fffx-tile-tab` corner mark. Gave the structure layer a warm/cool
  tint split by which side of each parent's split a rect fell on, instead
  of flat monochrome ink — see "Structure layer" above. This pass also
  caught and fixed stale prose left over from the previous grid-removal
  edit: "The subdivision field," the filler-cell section, and "Motion"
  were still describing the removed `fffx-grid-shimmer` background
  pattern as if it were current.
- **2026-06-29** — Fixed the structure-layer tint cancelling out to
  neutral grey-brown across most of the field (reported after the
  previous entry shipped): rekeyed `tintForRect()` off the top-level
  split branch instead of each rect's immediate parent, so warm/cool no
  longer alternates every single level — see "Structure layer" above for
  why that was cancelling out. Added the "Tile/filler area balance"
  section and `targetTileAreaFraction` (~65% tiles / ~35% filler,
  computed per render rather than a fixed px² constant) after noticing
  actual tile coverage was far lower than intended on typical desktop
  viewports. Desktop subdivision also goes one level deeper
  (`maxDepth: 7 → 8`) with a lower size floor (`minRectSize: 40 → 32`) so
  the now-smaller leftover filler space still reads as busy, fine-grained
  texture rather than a few large leftover chunks.
- **2026-06-29** — `.fffx-tile--muted` now keys off `status === "wip"`
  instead of `migrationStatus`, and its meta-line suffix is the literal
  text `wip` instead of whatever `migrationStatus` value an entry had.
  `migrationStatus` and `mutedMigrationStatuses` are gone — see
  `LANDING-PAGE-NOTES.md` for the full field-collapse rationale.
- **2026-06-29** — Removed the dashed border on muted tiles per user
  feedback ("no dashed lines, play with line weights") — muted is now
  signalled by thinner borders (`1px`/`2px` vs a live tile's
  `1.5px`/`2.5px`), never dash style. Separately, fixed the structure
  layer's inset to be cumulative by depth instead of flat — see
  "Structure layer" above for why a flat inset never produced a visible
  nested-frame effect (a child and parent share 3 of 4 edges, so a flat
  inset from each rect's own bounds left them coinciding along those
  shared edges). Also fixed tile title/subtitle font sizing — it was a
  viewport-relative `clamp(…vw…)`, so it didn't account for the tile's
  own size at all; see "Project tiles" above for the per-rect sizing fix
  and the 2-line-clamp safety net.
- **2026-06-29** — The "cumulative by depth" inset fix above turned out
  still wrong — it computed inset against each rect's raw, never-inset
  bounds as a separate rendering-only pass, which has no reliable
  relationship to where the parent is actually drawn (raw sibling/parent
  bounds always touch exactly to begin with). Properly fixed by baking
  the inset into `buildRectTree()`'s recursion itself — see "Structure
  layer" above, fully rewritten to describe the corrected mechanism.
  `renderStruct()` no longer computes any inset at all.
- **2026-06-29** — v2.0 work started (new local `v2-dark-theme` branch,
  v1.0 held as-is on `main`). Phase 1–3 landed: the subdivision tree now
  partitions by section first (one contiguous region per enabled section,
  sized by weight, via a linear chain of splits — see
  `LANDING-PAGE-NOTES.md`), so every rect carries a `sectionId` and a
  section's tiles now occupy one stable, contiguous area instead of being
  scattered wherever a good-fitting rect happened to exist. This breaks
  the structure layer's old warm/cool mechanism (a rect's id no longer
  encodes top-level branch identity) — patched to a `sectionId`-hash
  placeholder for now; see "Structure layer" above. Colour
  (per-section-hue structure layer + dark palette), the section-jump menu
  row, and the display/mono font swap are still pending — this file's
  palette/typography tables above still describe v1.0's light paper
  theme until that phase happens.
- **2026-06-29** — Two fixes from user inspection of the v2.0 branch.
  Structure-layer inset corrected again: subtracting only `d` from
  width/height (the first baked-in fix) insets the interior edge a
  split just created, but leaves each child's other two edges —
  inherited straight from the parent's own boundary — untouched, so a
  child's far corner still landed exactly on its parent's edge. Now
  subtracts `2d` so every edge is inset by `d` uniformly; see
  "Structure layer" above. Also replaced the tile hover "live
  re-subdivision hint": was two hairlines crossing at the tile's center
  (read as a generic 2×2 grid), now four hairlines offset from the
  tile's own right/top edges at `k`/`2k`, `k` = 10% of the tile's
  shorter dimension — see "Live re-subdivision hint" above.
- **2026-06-29** — v2.0 phase 4: full dark + cyan colour pass. Rewrote
  every colour token — `--bg`, `--ink`, `--muted`, `--line`/`--line-soft`,
  `--tile`, `--accent` — from v1.0's light paper-and-ink palette to a
  dark slate ground with `--accent` narrowed to the single saturated
  colour on the page (cyan). Added `--tile-hover` (was a hardcoded
  `white` background-on-hover, which would have flashed jarringly bright
  against the new dark ground). Redid all ten `--accent-<section>` hues
  as `hsl(H, 58%, 62%)` at matched saturation/lightness, spaced 36°
  apart, offset to avoid `--accent`'s cyan band — dropped the v1.0
  special-case where `tools-and-libraries` reused `--accent` directly,
  since `--accent` is no longer any section's colour. The structure
  layer's interim `sectionId`-hash warm/cool placeholder (phase 1–3) is
  replaced with the real mechanism: `tintForRect()` now looks up each
  rect's actual section hue (`SECTION_TINTS` in `layout.js`, the same ten
  hues as plain RGB triples, since the inline `rgba()` it builds needs
  numbers, not a CSS var). Also fixed two now-stale dark-on-light
  artifacts the colour pass exposed: `.fffx-struct`'s border was a
  hardcoded dark-ink rgba (invisible-to-wrong against the new dark
  background) — switched to `var(--line-soft)`; several places in this
  file's live prose ("ink/paper tile," "background drops to paper") still
  described the removed light theme and were updated to match.
- **2026-06-29** — Fixed a real bug: `vera-molnar` (the only entry in
  `recreating-the-past`) never rendered, because the section-chain
  partition could slice a low-weight section into a sliver narrower than
  `minThumbWidth` despite its area *share* being perfectly reasonable —
  not a weight/order problem. Added "Section minimum-area guarantee"
  above: the field now grows (height only) whenever needed so every
  section's proportional share clears a hard per-entry minimum, and the
  section-chain split now picks whichever axis keeps each peeled section
  closer to square instead of always "whichever's longer." Full
  before/after geometry in `LANDING-PAGE-NOTES.md`'s bug writeup.
- **2026-06-29** — v2.0 phases 5–6: added `.fffx-section-menu` (mono, uppercase, cyan hover/focus, matches the per-section tab/meta treatment) and swapped base typography to Space Grotesk (display) + IBM Plex Mono (the existing mono-accent role, was "Courier New"). See `LANDING-PAGE-NOTES.md` for the anchor/scroll mechanism.
