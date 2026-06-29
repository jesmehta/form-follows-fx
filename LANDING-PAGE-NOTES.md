# Notes: the fffx landing page implementation

Implementation architecture, rendering pipeline, data model, MkDocs
integration, and deployment notes for `docs/index.html`. Visual/design
decisions live in `DESIGN-SYSTEM.md`; project overview and repo structure
live in `README.md`. This file is the "how it actually works" reference —
keep it current as the layout engine evolves.

## Why this page doesn't follow the Bookshelf mount-shell pattern

The Bookshelf project's landing page is `docs/index.md` — a Markdown
front-matter shell (`hide: [toc, navigation]`) containing a wrapper div
and mount points, rendered through Material's theme, with JS that hides
Material's header/sidebar on that one page via a DOM-walk-up routine.

fffx's `docs/index.html` instead is a **complete standalone HTML
document** — its own `<html>`, `<head>`, `<body>`. There is no
`docs/index.md`. MkDocs treats any non-Markdown file under `docs_dir` as a
static asset and copies it through to the built site unchanged; since
nothing else claims the `index.html` output path (no `index.md` exists to
generate one), this file becomes the site's homepage directly, with zero
Material theme involvement on that route.

Trade-off: simpler (no header-hiding CSS/JS needed, no front-matter
quirks, no MkDocs Markdown-pipeline risk for inline scripts), but this
page can never have an MkDocs nav entry pointing at it as a Markdown page,
and it can't use Material components (admonitions, tabs, etc.) since it
never enters the Markdown pipeline. For a project whose entire landing
page is a generated rectangle field, that trade-off is the right one — see
`README.md` and `DESIGN-SYSTEM.md` for why the metaphor wants a from-scratch
canvas rather than content embedded in Material's content column.

Consequence for `mkdocs.yml`: there is intentionally **no** `Home:
index.md` entry under `nav:`. Adding one would point at a file that
doesn't exist and break the build. The homepage doesn't need a nav entry —
`index.html` is served at `/` regardless of what's in `nav:`.

## File responsibilities

| File | Responsibility |
| --- | --- |
| `docs/index.html` | Static shell: `<head>`, hero header markup, one `<main id="subdivision-field">` mount point, `<script type="module" src="assets/js/layout.js">`. No content data, no logic. |
| `docs/assets/css/landing.css` | All landing CSS, every rule scoped under `.fffx-landing` on `<body>`. |
| `docs/assets/js/data.js` | Source of truth — `landingConfig` (seed, layout tuning) + `entries[]` (project content). Pure data, no DOM/logic. |
| `docs/assets/js/random.js` | Seeded PRNG (`seededRandom`) + `pickFromId`, a deterministic per-rect-id picker used for filler-cell variety. No DOM, no knowledge of rects or entries — purely a randomness utility. |
| `docs/assets/js/subdivision.js` | Pure logic: `buildRectTree` (recursive split), `getCandidateRects` (size/aspect/depth filtering), `scoreRectForEntry` + `assignEntries` (entry-to-rectangle matching and blocking). No DOM access at all — this file could run in a non-browser JS environment unchanged. |
| `docs/assets/js/layout.js` | Orchestration + rendering only: calls into `data.js`/`random.js`/`subdivision.js`, builds the actual `<a>`/`<div>` DOM nodes, owns the resize listener. Imports the others as ES modules (`<script type="module">`, so this requires being served over HTTP — `file://` will block the module import in most browsers; use `mkdocs serve` or any static server for local preview, not double-clicking the HTML file). |

`docs/assets/` exists specifically so the landing page's own CSS/JS never
collides with the per-section content folders (`prompt-collections/`,
`deep-studies/`, etc.) sitting alongside it at `docs/` root.

The three-way split between `data.js` (content) / `random.js` +
`subdivision.js` (pure layout logic) / `layout.js` (DOM) means the
subdivision algorithm itself has zero dependency on the browser — useful
if it's ever worth unit-testing the scoring/assignment logic directly, or
reusing it for a different rendering target (e.g. an SVG export of the
field) without touching DOM-construction code.

## Data model (`docs/assets/js/data.js`)

```js
landingConfig = {
  id, title, subtitle, seed, theme,
  layout: {
    splitRatioMin, splitRatioMax,   // how unevenly a rect is split (0.35–0.65 = never near-50/50, never near-degenerate)
    minCandidateDepth,              // depth 0 is the whole field; rects shallower than this never become tile candidates
    minAspect, maxAspect,           // aspect-ratio bounds a rect must fall within to be tile-eligible at all
    targetTileAreaFraction,         // ~fraction of total field area tiles should cover in aggregate (0.65 = 65%)
                                      // — NOT baseTileArea itself; layout.js derives the actual per-render
                                      // baseTileArea from this fraction, fieldWidth×fieldHeight, and the sum
                                      // of visible entries' weights. See "Tile/filler area balance" below.
    idealAspect,                    // the aspect ratio scoring treats as "best" (slightly landscape)
    aspectPenaltyWeight,
    depthPenaltyWeight,              // scoring weights — see scoreRectForEntry below.
                                      // Reading-order placement is handled separately
                                      // by assignEntries()'s windowing, not a scoring term.
    minFillerSize,                  // leaf rects smaller than this in either dimension render no filler cell at all
    desktop: { maxDepth, minRectSize, minThumbWidth, minThumbHeight },
    mobile:  { maxDepth, minRectSize, minThumbWidthRatio, minThumbHeight },
    // minThumbWidthRatio (mobile only) is a fraction of live viewport
    // width, not a fixed px value — computed in layout.js, not stored
    structInset,                     // px each freshly-split child is nudged in by, baked into buildRectTree()
                                      // itself (x+=d, y+=d, width-=d, height-=d) — not a rendering-time inset
    structAlpha                      // structure-layer fill alpha — see "Structure layer" further down
  }
}

// Each entry is a *portal*: a collection, study, tool, project, or
// archive grouping — never one entry per tiny sketch version. Required
// fields first, optional fields after.
entries = [{
  // required
  id, title, subtitle, href,
  section,                  // prompt-collections | deep-studies | recreating-the-past |
                             // tools-and-libraries | generative-projects | image-experiments |
                             // plotter-fabrication | code-to-objects | other-code-environments |
                             // sketch-families | legacy-processing
  kind,                     // event-collection | prompt-series | deep-study | artist-study |
                             // library | digital-tool | generative-project | image-filter |
                             // plotter-work | fabricated-output | object | sketch-family |
                             // game | archive | legacy-archive
  order,                     // placement priority, ascending — earlier entries get first pick of best-fitting rects
  weight,                    // 1 = small/archive, 2 = regular, 3 = important collection/study, 4 = major feature — target-area multiplier for rect scoring
  status,                    // true | false | "wip" — see "status" below; one field, both visibility and "is this finished"
  tags: [...],               // rendered as chips, revealed on tile hover/focus
  era,                       // current-web | p5-archive | processing-legacy | other-code — where the source actually lives
  location,                  // internal | internal-plus-repo | external — how this portal is hosted

  // optional
  image, years, repo: { name, url },
  relatedLinks: [{ label, href }],
  sourceFolder,               // free-text note on where the original sketch/material lives, if known
  notes,
  children, themeTags          // reserved — not yet read by layout.js
}]
```

To add a portal: append to `entries` with all twelve required fields
filled in, pick `order` relative to existing entries, pick `weight` 1–4
per the rule above (`circle-packing-library` is currently the only
weight-4 feature entry). `href` must be **relative, no leading slash**
(`tools-and-libraries/mandala-generator/`, not
`/tools-and-libraries/mandala-generator/`) — see "Deployment" further
down for why a leading slash breaks the link as soon as the site is
served from anywhere other than a domain root. If the portal has its own
write-up page, add the `.md` file under the matching
`docs/<section-folder>/` — but only add a `mkdocs.yml` `nav:` entry once
that page has real content; otherwise leave the page in place and the
nav line commented out (see "MkDocs integration" below).

### `status`

One field, three values, doing what used to be two fields' jobs (an
earlier version of this schema had a separate `migrationStatus` for
content-state bookkeeping alongside `status` as the pure visibility
switch — collapsed after it turned out nothing actually needed both axes
independently):

- **`true`** — renders normally.
- **`false`** — excluded from the field entirely. `layout.js`'s
  `visibleEntries` filter is `entry.status !== false`, so this is the
  only value that can make a portal disappear. Nothing currently uses it
  — every existing portal is real and linkable, just not always finished.
- **`"wip"`** — renders, but `renderTile()` adds the `.fffx-tile--muted`
  class: dashed border, reduced opacity, and the literal text `wip`
  appended to the tile's meta line. The portal is real, present, and
  clickable; it just doesn't pretend to be finished. `circle-packing-library`
  and `vera-molnar` are the only two entries currently `status: true` —
  they're the two pages with actual written content (819 and 311 words
  respectively, versus 38–66 words for every placeholder stub). All
  thirteen placeholders are `status: "wip"`.

## Rendering pipeline

Split across `subdivision.js` (pure) and `layout.js` (orchestration + DOM):

1. **Seed** (`layout.js`). `seededRandom(`${seed}-${loadSeed}-${fieldWidth}-${fieldHeight}`)`
   — a mulberry32-style PRNG (in `random.js`) keyed on the configured seed
   string, a `loadSeed` (`Math.random().toString(36).slice(2)`, computed
   once at module scope — i.e. once per page load, not once per `render()`
   call), and the current field's pixel dimensions. Net effect: **every
   full page load gets a genuinely new subdivision tree** (different split
   ratios throughout), but a single load stays internally consistent — a
   resize or a breakpoint switch re-derives the same load's layout at the
   new dimensions rather than re-rolling it, because `loadSeed` doesn't
   change until the script re-executes from a fresh page load. `order` and
   `weight` are untouched by any of this — they still drive which entry
   gets first pick of which size of rectangle, every load, identically.

2. **Subdivide** (`subdivision.js` → `buildRectTree`). Recursive: pushes
   the *current* rect into `allRects` first (so every depth survives, not
   just leaves), then — unless `depth >= maxDepth` or either dimension is
   below `minRectSize` (both terminate the branch into `leafRects`) —
   splits along whichever axis is currently longer (`width >= height` →
   vertical split), at a ratio drawn from `[splitRatioMin, splitRatioMax]`.
   Each child's `id` is its parent's `id` plus `.0` or `.1` (root is
   `"0"`) — this path encoding is what makes ancestor/descendant blocking
   in step 4 a string check instead of a tree walk.

   Before recursing, each freshly-split child is run through
   `insetRect(child, d)` (`d = structInset`, ≈1.5px): `x += d, y += d,
   width -= d, height -= d` — **not** `width -= 2d` centred on all sides.
   The bottom/right edge stays exactly on the split line; only the
   top-left corner moves in. It's this *inset* rect — not the raw split —
   that gets pushed into `allRects` and recursed into for the next split,
   so every generation is inset relative to where its own immediate
   parent actually sits, and the effect compounds correctly with depth.
   This applies uniformly to every consumer of the tree (tiles, filler,
   structure layer all read the same already-inset `allRects`) — there is
   no separate inset calculation anywhere else. See "Known bug fixed
   (2026-06-29, inset)" below for why an earlier, rendering-only version
   of this didn't work.

3. **Filter candidates** (`subdivision.js` → `getCandidateRects`). From
   the full `allRects` set, keep only rects that pass `minCandidateDepth`,
   the current breakpoint's `minThumbWidth`/`minThumbHeight` floor (mobile's
   `minThumbWidth` is computed in `layout.js` as `fieldWidth ×
   minThumbWidthRatio` before being passed in — `subdivision.js` itself
   has no notion of "mobile"), an aspect-ratio band (`minAspect`/
   `maxAspect`), and excludes anything covering ~the entire field.

4. **Assign entries to rects** (`subdivision.js` → `assignEntries`). Live
   entries (status ≠ "draft"), sorted by `order` ascending. This step has
   two layers, deliberately separated:

   - **Where, roughly** (reading-order windowing). `candidateRects` is
     sorted once by `compareReadingOrder` — a row-grouping heuristic: two
     rects count as "the same row" if their vertical spans overlap by
     more than half the shorter one's height, in which case they sort by
     `x` (left to right); otherwise they sort by vertical center (top to
     bottom). For entry `i` of `total`, its target position in that
     sorted list is `round((i / (total − 1)) × (available.length − 1))`,
     and it may only be assigned a rect within a small window around that
     index (`windowRadius = max(2, ceil(available.length / total))`).
     This is what keeps a given entry landing in roughly the same part of
     the field across reloads — entry 0 always near the start of reading
     order, the last entry always near the end — even though the tree
     itself reseeds every load (see "Seed" above).
   - **Which rect, exactly** (size/shape fit). Within that window,
     `scoreRectForEntry` = `|actual_area − weight × baseTileArea|` (size
     fit) `+ |aspect − idealAspect| × aspectPenaltyWeight` (aspect fit,
     biased landscape) `+ |depth − idealDepth| × depthPenaltyWeight`
     (prefers a middling depth — `minCandidateDepth + 1.5` — over both
     very shallow and very deep rects). Lowest score in the window wins.
     `baseTileArea` here is **not** a config constant — `render()` computes
     it fresh every call as `(fieldWidth × fieldHeight ×
     targetTileAreaFraction) ÷ sumOfVisibleEntryWeights`, then passes a
     `{ ...layoutConfig, baseTileArea }` clone (`scoringConfig`) into
     `assignEntries` instead of the raw config. See "Tile/filler area
     balance" below for why.

   `order` therefore does two jobs at once: it's the windowing position
   *and* the assignment sequence (earlier entries claim/block their pick
   before later ones see the remaining pool) — both reinforce the same
   "entry 0 reads first" intent rather than competing.

   After each assignment, **every** rect in `allRects` is checked against
   the chosen rect and added to `blockedIds` if it's related by id-prefix
   (ancestor or descendant — same partition-tree branch) *or* if its
   bounding box geometrically overlaps the chosen rect (`rectsOverlap`,
   a plain AABB test). The id-prefix check alone is sufficient for a
   well-formed partition tree (siblings never overlap by construction),
   but the AABB check is kept as a second, independent guarantee — cheap
   insurance against the rare edge case rather than something currently
   load-bearing.

5. **Render structure layer** (`layout.js` → `renderStruct`). Before any
   tile or filler renders, every rect in `allRects` with `depth > 0` gets
   an `.fffx-struct` div, appended in `allRects`' own order (which is
   pre-order — parent always before children). `renderStruct()` does
   **no inset math at all** — `rect.x/y/width/height` are drawn exactly
   as given, because the inset is already baked into the geometry by
   `buildRectTree()` (see step 2 above). `tintForRect()` reads the
   *top-level* segment of the rect's id (not the immediate parent's, for
   the cancellation reason covered in the 2026-06-29 colour fix below) to
   pick a warm or cool base colour, filled at `structAlpha`. This has to
   happen before step 6 and 7 in DOM order so tiles/filler paint on top
   of it, not under it — see `DESIGN-SYSTEM.md`'s "Structure layer"
   section for why the paint-order requirement is load-bearing for the
   colour-depth effect.

6. **Render tiles** (`layout.js` → `renderTile`). Each assigned
   `{entry, rect}` becomes one `<a class="fffx-tile">`, absolutely
   positioned from the rect's `x/y/width/height`, with the entry's
   thumbnail set as a CSS custom property (`--thumb`) consumed by the
   `::before` ghost-image layer in `landing.css`. Title/body font sizes
   are computed here too, from that same rect's width/height, and set as
   `--tile-title-size`/`--tile-body-size` — see `DESIGN-SYSTEM.md`'s
   "Project tiles" section for why this is JS-computed rather than a CSS
   `clamp(…vw…)`. The tags row is only included in the markup at all for
   tiles `≥200×150px` (`showTags` in `renderTile()`); smaller tiles get
   no tags row, not a cramped one. Markup also includes the coloured
   corner tab, the two hover-revealed split hairlines, and the coordinate
   label — see `DESIGN-SYSTEM.md` for what each one does visually.
   `tile.dataset.section` (already set for data purposes) is what
   `landing.css`'s `data-section` attribute selectors key off of to set
   `--tile-accent` — no colour logic lives in JS.

7. **Render filler** (`layout.js` → `renderFiller`). Only **leaf** rects
   (`leafRects`, not all of `allRects`) that aren't in `blockedIds` and
   meet `minFillerSize` in both dimensions get a `.fffx-cell` div. Using
   leaves only (rather than "any unblocked rect at any depth") matters:
   leaves partition the canvas with zero gaps and zero overlap, so filler
   never double-draws a coarser rect underneath a finer one. Each cell's
   treatment (`plain`/`hatch`/`dots`/`gradient`/`glyph`/`code`/`coord`) is
   picked by `pickFromId` (`random.js`) keyed on the rect's own `id` —
   deterministic for a given id within a given load, though which ids
   exist at all now changes from load to load along with everything else
   `loadSeed` touches (see step 1).

8. **Re-render on resize.** `window.addEventListener("resize", render)` —
   the entire field clears (`field.innerHTML = ""`) and steps 1–7 rerun
   from scratch. Intentionally a full rebuild, not an incremental reflow;
   the subdivision is cheap enough (a few hundred rects at typical depth
   ceilings) that this isn't a performance concern. `render()` also
   toggles `document.body.classList.toggle("fffx-is-mobile", isMobile)`,
   which is what drives the mobile filler-opacity rule in `landing.css`.
   Because `loadSeed` is fixed at module scope, a resize re-derives the
   *same* load's tree at new dimensions rather than rolling a new one.

### Tile/filler area balance

`baseTileArea` was originally a fixed constant (`26000`px²) in `data.js`.
On a typical desktop viewport with 15 entries averaging weight ~2,
`26000 × 2 = 52000`px² per tile × 15 ≈ 780,000px² total — against a
field of, say, 1800×2400 = 4,320,000px², that's only ~18% tile coverage,
nowhere near the ~65% the design actually wants. The constant had no
relationship to the field's actual size or how many entries existed, so
the achieved ratio was whatever it happened to be.

Fixed by computing `baseTileArea` fresh every `render()` call instead:

```js
const sumWeights = visibleEntries.reduce((sum, e) => sum + e.weight, 0) || 1;
const baseTileArea = (fieldWidth * fieldHeight * layoutConfig.targetTileAreaFraction) / sumWeights;
```

This holds the *aggregate* target area (tiles, in total, aiming for
`targetTileAreaFraction` ≈ 65% of the field) constant relative to the
field size, then splits it across entries proportional to `weight` — add
a 16th entry and everyone's individual share shrinks slightly so the
total stays on target, rather than the total drifting upward unbounded.
`scoreRectForEntry` itself didn't change; it still just reads
`layoutConfig.baseTileArea` — `render()` passes it a `scoringConfig`
clone with the computed value instead of the raw `landingConfig.layout`.

This is a target the scoring system aims for, not a hard constraint —
actual achieved coverage depends on what the reseeded tree happens to
offer as candidates near each entry's reading-order window, so don't
expect it to land on exactly 65% every load.

### Known bug fixed (2026-06-28)

The mobile branch of the candidate filter originally referenced
`landingConfig.layout.minThumbWidthMobileRatio`, a key that was never
defined anywhere in `data.js`. `r.w >= undefined` is always `false` in JS,
so every candidate was silently rejected on any viewport under 700px —
zero tiles would ever render on mobile, with no console error. Fixed at
the time by adding a real `minThumbWidthMobile` value; in the v2 rewrite
this became `landingConfig.layout.mobile.minThumbWidthRatio`, with
`layout.js` computing the actual px floor from the live viewport width
before handing it to `getCandidateRects`. Worth remembering if a similar
"renders fine on desktop, blank on mobile, no errors" symptom shows up
again — check for silent `undefined` comparisons in the candidate filter
first.

### Known bug fixed (2026-06-29, inset)

An earlier attempt at the structure-layer inset computed
`inset = rect.depth * structInset` in `renderStruct()` against each
rect's **raw** bounds — i.e. the same untouched geometry
`buildRectTree()` always produced, where a child's bounds always touch
its parent's and siblings' exactly with zero gap. Computing an inset
independently per node against bounds that were never inset to begin
with has no reliable relationship to where the parent is actually
*drawn* — depth-proportional inset against a flat, never-shrunk tree
produces inconsistent, overlapping-looking gaps ("haywire"), not a clean
nested-frame effect.

The fix: bake the inset into the recursion itself, in
`subdivision.js`'s `buildRectTree()`. After computing a raw split
(`childA`/`childB`, exactly as before), each child is passed through
`insetRect(child, d)` — `x += d, y += d, width -= d, height -= d`
(`d = structInset`, **not** `width -= 2d` centred on every side; only
the top-left corner moves in, the bottom/right edge stays exactly on the
split line) — and it's *that* inset rect, not the raw one, that gets
pushed into `allRects` and passed to the next recursive `subdivide()`
call. Because every level's split now operates on its parent's
already-inset rect rather than raw mathematical bounds, the inset
compounds correctly and consistently with depth, anchored to where each
ancestor is actually drawn. This change is in the tree-building function
itself, so it applies uniformly to every consumer — tiles, filler, and
the structure layer all read from the same corrected `allRects`; there
is no separate inset calculation left anywhere in `layout.js`.
`renderStruct()` was simplified accordingly to draw `rect.x/y/width/
height` with no inset math of its own.

## CSS scoping

Every selector in `landing.css` is prefixed `.fffx-landing` (set as a
class on `<body>`). Not strictly required today since `index.html` never
shares a page with Material's own CSS (see architecture note above), but
kept as a defensive convention — if this page is ever re-mounted inside a
templated shell (mirroring how Bookshelf does it), the scoping is already
in place and nothing needs retrofitting.

## MkDocs integration

- `mkdocs.yml` has no `nav:` entry for the homepage — see architecture
  note above for why that's intentional, not an oversight.
- `nav:` is intentionally a curated subset of the pages that exist under
  `docs/`. Section/page lines for every placeholder portal (everything
  with `status: "wip"`) are commented out with `#`, not deleted — the
  `.md` files are real, get built by
  `mkdocs build` regardless of nav membership, and are still reachable
  directly via the URL the landing page links to. Only pages with actual
  written content get an active nav line: currently `Recreating the
  Past → Vera Molnar` and `Tools & Libraries → Circle Packing Library`.
  Rationale: with fifteen portals and only two real write-ups, an
  uncommented nav listing every placeholder buries the two pages worth
  reading in a sidebar mostly full of stubs. Uncomment a page's nav line
  exactly when it stops being a stub.
- `extra_css` is intentionally absent. An earlier version of this file
  pointed at `stylesheets/bookshelf.css`, copied over from the Bookshelf
  repo's `mkdocs.yml` template but never relevant here (that file never
  existed in this repo, and `docs/index.html` doesn't even load through
  Material's `extra_css` pipeline since it's not Markdown-rendered).
  Removed rather than fixed, since nothing currently needs it.
- `requirements.txt` mirrors the Bookshelf/Cabinet-of-Curiosities Python
  dependency set (`mkdocs-material`, `mkdocs-video`,
  `mkdocs-git-revision-date-localized-plugin`, etc.) for consistency
  across the network's repos, even though fffx doesn't yet use all of
  them (e.g. no video embeds yet).

## Local preview

`docs/assets/js/layout.js` is loaded as `<script type="module">`, which means
`fetch`/import resolution is subject to CORS restrictions under the
`file://` protocol in most browsers — opening `docs/index.html` directly
by double-clicking it will likely fail to load `data.js` silently or with
a console CORS error. Preview locally either via `mkdocs serve` (serves
the whole site, including this page, over `http://`) or any plain static
server pointed at `docs/` (e.g. `python -m http.server` from inside
`docs/`).

## Deployment

`.github/workflows/deploy.yml` exists and follows the Bookshelf pattern:
`mkdocs build --site-dir public` in CI, official `actions/configure-pages`
→ `actions/upload-pages-artifact` → `actions/deploy-pages` (not the
`peaceiris` gh-pages-branch approach — defaults to a read-only
`GITHUB_TOKEN` on new repos and fails silently). Pre-lists `scifi`/`asimov`
in the "copy static interactive projects" step even though neither exists
in this repo yet (the `if [ -d "$proj" ]` guard makes that harmless) —
add a project there if/when one shows up at the repo root.

### `entries[].href` must be relative, not root-absolute

`mkdocs.yml` declares `site_url: https://fffx.cabinetofcuriosities.in/`,
implying the site is meant to live at a custom domain's root. In
practice, until that domain is actually wired up (CNAME file + DNS),
GitHub Pages serves the build from its default project URL instead —
`https://jesmehta.github.io/form-follows-fx/`, one path segment deeper
than the domain root the `entries[]` hrefs were originally written
assuming.

Every `href` in `data.js` is root-relative — `recreating-the-past/
vera-molnar/`, no leading slash — specifically so this doesn't matter.
`index.html` always sits at whatever the actual site root is, custom
domain or GitHub Pages subpath, so a relative href resolves correctly
either way: append it to the current document's directory. **Never**
write a leading-slash href like `/recreating-the-past/vera-molnar/` — sed
hint at the time this was caught (it's an easy regression to reintroduce
one entry at a time): `grep -n 'href: "/' docs/assets/js/data.js` should
always return nothing.

## Changelog

- **2026-06-28** — Initial implementation notes written alongside the
  first working version of the recursive-subdivision landing page. Fixed
  the mobile candidate-filter bug (see above). Moved `style.css`,
  `data.js`, `layout.js` from a flat `docs/` into `docs/css/` and
  `docs/js/`. Settled on `index.html` (not `index.md`) as the homepage
  approach and removed the dead `Home: index.md` nav entry and the
  inherited-but-unused `extra_css: stylesheets/bookshelf.css` reference.
  Nav/data hrefs settled on `PackingShapes.md` / `VeraMolnarRetrospective.md`
  slugs.
- **2026-06-29** — Rebuilt the layout engine to a more detailed spec.
  Split the old monolithic `layout.js` into `random.js` (seeded PRNG,
  `pickFromId`) and `subdivision.js` (pure tree-build/score/assign, zero
  DOM access), leaving `layout.js` as orchestration + rendering only.
  `css/style.css` renamed to `css/landing.css`. Rect ids now encode their
  root-to-node path (`"0"`, `"0.0"`, `"0.1"`, ...) so ancestor/descendant
  blocking is a string-prefix check; added a real AABB overlap check
  alongside it. `weight` moved from an ad hoc 2/3 scale to 1–4
  (small/medium/large/feature); entries rebalanced across all four tiers.
  Added a position-based scoring term (earlier-ordered entries drift
  toward the upper-left). Filler now draws from `leafRects` only (a clean,
  gap-free, overlap-free tiling) instead of any unblocked rect at any
  depth, and gained seven additional treatments beyond the original single
  hatch pattern (`plain` ×3 weight, `hatch` ×2, `dots`, `gradient`,
  `glyph`, `code`, `coord`), picked deterministically per-cell via
  `pickFromId`. Mobile's tile-width floor changed from a fixed px value to
  `minThumbWidthRatio` (a fraction of live viewport width), computed in
  `layout.js` rather than stored as a constant. Added the hover-only
  live-resubdivision hairlines, tag-reveal-on-hover, `:focus-visible`
  outline, background-grid shimmer animation (with
  `prefers-reduced-motion` handling), and the `fffx-is-mobile` body-class
  toggle that quiets filler opacity on narrow viewports.
- **2026-06-29** — Removed the generic background grid-paper pattern from
  `#subdivision-field` entirely (it had no relationship to the actual
  rect tree, which is why tiles never looked aligned to it) and added a
  real structure layer in its place: `renderStruct()` in `layout.js` draws
  one inset, low-alpha div per rect in `allRects` (depth > 0), appended in
  `allRects`' natural pre-order (parent always before children). Because
  a child's inset bounds always sit inside its parent's, the gap left at
  every split shows the parent's tint underneath — that gap *is* the
  subdivision line, generated from the same data the tiles use, not a
  decorative overlay. Points nested deeper accumulate more stacked
  translucent layers and read as visibly darker, via ordinary CSS alpha
  compositing rather than any manual depth-to-colour mapping. New config:
  `landingConfig.layout.structInset` (1.5px) and `structAlpha` (0.05).
- **2026-06-29** — Expanded `entries[]` from 4 ad hoc items to the full
  15-portal information architecture (see `README.md` for the page-level
  changes). Every entry now carries the complete required schema —
  `era`, `migrationStatus`, `location` added; `sourceFolder`,
  `relatedLinks`, `notes` used where applicable. Added
  `landingConfig.layout.mutedMigrationStatuses` and the
  `status`-vs-`migrationStatus` distinction documented above: `status`
  remains the hard visibility switch `layout.js` already read;
  `migrationStatus` is new and drives `renderTile()`'s `.fffx-tile--muted`
  class (dashed border, reduced opacity, status tag appended to the meta
  line) instead of hiding anything. `renderTile()` also now guards against
  entries with no `image` field (most placeholders have none) — previously
  this produced an invalid `url("undefined")` background; now it sets
  `--thumb: none` when `entry.image` is absent.
- **2026-06-29** — Two changes, prompted by the user noticing the layout
  never changed between reloads and asking whether `weight` actually
  affected size (it does — see `scoreRectForEntry` above):
  1. Added `loadSeed` (`Math.random()`, module-scope in `layout.js`, so
     computed once per page load). The PRNG seed is now
     `` `${seed}-${loadSeed}-${fieldWidth}-${fieldHeight}` `` — every full
     reload gets a genuinely new split-ratio tree, while a resize within
     one load still re-derives that same load's layout rather than
     re-rolling it. `order`/`weight`-driven assignment is completely
     unaffected — only the tree shape `assignEntries` scores candidates
     from changes.
  2. Added per-section accent colours and a warm/cool tint split on the
     structure layer — see `DESIGN-SYSTEM.md`'s "Per-section accent hues"
     and "Structure layer" sections for the colour table and the
     `tintForRect()` mechanism. No new fields in `data.js`; the colour
     mapping is keyed off the existing `section` field via CSS
     `data-section` attribute selectors, not JS.
  While here, also fixed several places in this file and
  `DESIGN-SYSTEM.md` that still described the `fffx-grid-shimmer`
  background pattern as current — it was removed when the structure layer
  was added (see the entry above this one) but the prose describing
  "the subdivision field," filler-cell behaviour, and "Motion" hadn't
  been updated to match at the time.
- **2026-06-29** — Reworked `assignEntries` so `order` controls reading
  position, not just assignment sequence. Previously placement was pure
  best-fit scoring across *all* candidates, with a soft position term
  nudging early entries toward the upper-left — too weak a pull to
  survive a fully reseeded tree, so a tile could legitimately land
  anywhere a `weight`-sized rect happened to exist. Replaced with
  `compareReadingOrder` (row-grouping by vertical-span overlap, then
  left-to-right/top-to-bottom) sorting candidates once, plus a per-entry
  window (`assignEntries`) restricting entry `i` to a slice of that
  sorted list near its proportional position. `scoreRectForEntry` lost
  its `index`/`totalEntries`/`fieldWidth`/`fieldHeight` params and the
  position term entirely — it now only decides *which* rect wins within
  the window, not *where* that window is. Removed
  `landingConfig.layout.positionPenaltyWeight` (superseded, no longer
  read by anything).
- **2026-06-29** — Two follow-up fixes from user feedback on the colour
  pass above. (1) Structure-layer tint was cancelling out to neutral
  grey-brown across most of the field — `tintForRect()` now keys off the
  top-level split branch instead of each rect's immediate parent; see
  "Structure layer" in `DESIGN-SYSTEM.md` for the mechanism. (2) Tiles
  were covering far less of the field than intended (~18% on a typical
  desktop viewport, against a target of ~65%) because `baseTileArea` was
  a fixed px² constant unrelated to field size or entry count. Replaced
  with `targetTileAreaFraction` (0.65) plus a per-render computed
  `baseTileArea` — see "Tile/filler area balance" above. Desktop
  subdivision also went one level deeper (`maxDepth: 7 → 8`,
  `minRectSize: 40 → 32`) so the now-smaller leftover filler space still
  reads as fine-grained texture rather than a few large leftover chunks.
- **2026-06-29** — User-initiated move: `docs/css/` and `docs/js/` moved
  to `docs/assets/css/` and `docs/assets/js/`, to keep the landing page's
  own implementation files out of the way of the per-section content
  folders (`prompt-collections/`, `deep-studies/`, etc.) living alongside
  them at `docs/` root. Updated `index.html`'s `<link>`/`<script src>` to
  `assets/css/landing.css`/`assets/js/layout.js`. No change needed inside
  the JS files themselves — their relative imports (`./data.js`,
  `./random.js`, `./subdivision.js`) all still resolve correctly since
  every file moved together. Updated the "File responsibilities" table,
  the "Data model" heading, and the "Local preview" section above to
  match; left historical changelog entries describing the old `docs/css/`
  /`docs/js/` paths as accurate records of what was true at the time,
  not live documentation.
- **2026-06-29** — User-initiated schema simplification, prompted by a
  question about what `status` and `migrationStatus` actually did
  differently. Collapsed both into one `status` field with three values
  (`true`/`false`/`"wip"`) — see the "status" subsection above for the
  full rationale. Code changes: `layout.js`'s `visibleEntries` filter is
  now `entry.status !== false` (was `!== "draft"`); `renderTile()`'s
  `isMuted` check is now `entry.status === "wip"` (was checking
  `migrationStatus` against `mutedMigrationStatuses`) and no longer needs
  a `layoutConfig` argument; the meta-line muted suffix is now the
  literal text `wip` (was the entry's `migrationStatus` value, which is
  gone). `data.js`: removed `migrationStatus` from all fifteen entries
  and `landingConfig.layout.mutedMigrationStatuses` entirely;
  `circle-packing-library` and `vera-molnar` are `status: true`, the
  other thirteen `status: "wip"`. Nothing currently uses `status: false`.
- **2026-06-29** — Three fixes from user inspection of the rendered page.
  (1) `.fffx-tile--muted`'s dashed border replaced with thinner solid
  borders (`border-width: 1px`/`2px` vs the live tile's `1.5px`/`2.5px`)
  — explicit feedback: no dashed lines, vary line weight instead.
  (2) `renderStruct()`'s inset changed from a flat `layoutConfig.structInset`
  applied to every rect's own bounds to `rect.depth * layoutConfig.structInset`
  — cumulative by depth. The bug: a child rect shares 3 of its 4 edges
  exactly with its parent (only the newest split line is new), so
  insetting both by the same flat amount from those *same* shared edges
  left the inset rectangles coinciding there — no visible gap except at
  the newest seam, which is why the structure read as "borders in touch"
  rather than nested frames. (3) Tile `h2`/`p` font sizes were
  `clamp(1rem, 2vw, 1.6rem)`/fixed `0.82rem` — `vw` is viewport width, so
  every tile got roughly the same font size regardless of its own
  rect dimensions, and small tiles silently overflowed past
  `overflow: hidden`. Replaced with per-tile computed sizes
  (`--tile-title-size`/`--tile-body-size`, derived from `rect.width`/
  `rect.height` in `renderTile()`) plus a 2-line `-webkit-line-clamp`
  safety net on both, `text-overflow: ellipsis` on the meta line, and
  the tags row now only renders in the markup at all for tiles
  `≥200×150px` (`showTags` in `renderTile()`).
- **2026-06-29** — The "cumulative by depth" inset fix immediately above
  was itself wrong — `renderStruct()` was computing inset against each
  rect's raw, never-shrunk bounds, which has no reliable relationship to
  where the parent is actually drawn. Properly fixed by baking the inset
  into `buildRectTree()`'s recursion itself, per an algorithm the user
  spelled out explicitly. See "Known bug fixed (2026-06-29, inset)" in
  the "Rendering pipeline" section above for the full mechanism.
- **2026-06-29** — Fixed all sixteen `href` values in `data.js` (fifteen
  entries plus one `relatedLinks` href) — they were root-absolute
  (`/recreating-the-past/vera-molnar/`), which only resolves correctly
  when the site is served from a domain root. The live GitHub Pages
  deployment currently serves from its default project URL,
  `jesmehta.github.io/form-follows-fx/`, one path segment deeper than the
  domain root those hrefs assumed — so every link 404'd in production
  while working fine under `mkdocs serve` (which happened to also serve
  from `/`). Stripped the leading slash from every href so they're
  relative to wherever `index.html` actually sits, correctly resolving
  under both a future custom-domain deploy and the current GitHub Pages
  subpath. Also discovered `.github/workflows/deploy.yml` already
  exists (added outside this conversation) — updated the "Deployment"
  section above, which still said "not yet wired up."
