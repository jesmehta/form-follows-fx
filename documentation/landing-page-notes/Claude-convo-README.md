# fffx — form follows f(x)

A Level 1 hub in the Cabinet of Curiosities ecosystem, hosting creative coding,
generative art, p5.js experiments, algorithmic sketches, plotter work, digital
fabrication, and interactive web pieces.

---

## Position in the ecosystem

```
Cabinet of Curiosities (root hub)
└── fffx — form follows f(x)          ← this repo (Level 1)
    ├── Genuary                        (Level 3 — event pages)
    ├── Vera Molnár retrospective      (Level 3)
    ├── 100 Gradients                  (Level 3)
    ├── Windows of Berlin              (Level 3)
    ├── Circle Packing library         (Level 3 → external npm)
    ├── Mandala Generator              (Level 3 — tool)
    └── … etc
```

Level 3 objects may live as internal pages in this repo, link to separate
GitHub Pages repos, or link to external tools. The landing page is the
curated front door — not an exhaustive index.

---

## Repository structure

```
/
├── index.html          Landing page shell — mount points only, no content
├── data.js             Single source of truth for all content — edit this only
├── render.js           Render engine — reads data.js, writes DOM
├── fffx.css            All styles — scoped, no inline styles in HTML
├── DESIGN-SYSTEM.md    Visual system spec (fonts, colours, tokens, rules)
├── README.md           This file
└── [project-slug]/     Each internal project as a standalone directory
    └── index.html
```

The MkDocs deployment notes from `TheBookshelfOfCuriosities/MKDOCS-LANDING-PAGE-NOTES.md`
apply here too — consult that file for: header-hide DOM walk, CSS specificity rules,
deploy pipeline setup, and the static subproject copy loop in CI.

---

## Design concept — the recursive rectangular subdivision field

The landing page is itself generative. The visual metaphor is a recursive
rectangular subdivision field — the same algorithmic logic that drives
much of the work hosted here.

### What this means in practice

The content area of each section is not a hand-laid grid. It is produced by:

1. Starting with one rectangle (the section's full width and height)
2. Picking the longer axis and splitting it at a semi-random ratio (28%–72%)
3. Recursing into each child rectangle until a minimum size or maximum depth is reached
4. Rendering **every rectangle at every depth** as a visible DOM node
5. Matching project entries to appropriately sized leaf rectangles
6. Rendering unmatched leaf rectangles as decorative filler cells

The result looks like a computational map, a circuit board, or an architectural
floor plan — an algorithmic field that contains the content rather than merely listing it.

### Why HTML elements, not canvas

Tile/link rectangles are real `<a>` elements, not canvas drawings. This ensures:
- Links are keyboard-focusable and screen-reader accessible
- Right-click → open in new tab works
- SEO sees the content
- Hover and focus states are CSS, not redrawn frames

The subdivision grid itself is also HTML `div` elements, nested in the DOM tree
to match the subdivision tree. This is deliberate — see Depth and transparency below.

---

## Depth and transparency

Every subdivision rectangle is a DOM node. Children are `position: absolute`
inside their parent `position: relative` container, so they span exactly their
share of the parent's space.

Each node's background is:

```
background: rgba(0, 0, 0,  0.04 + depth × 0.045)
```

Because children are physically nested inside parents in the DOM, the browser
composites them naturally — each generation paints semi-transparent black over
its parent's colour. The effect compounds: deeper generations appear progressively
darker than their parents, without any lookup table or hardcoded colour per level.

This means depth is visually readable: the eye can trace the subdivision tree
just by following the darkening of the cells.

### Sibling separation

Each child rect is inset by `GAP/2` on all four sides (currently `GAP = 2px`).
Siblings therefore share a `GAP`-wide gutter filled by the parent's colour.
The gutter colour itself is a slightly lighter shade than the children (it is
the parent's composited colour), which visually confirms the tree structure.

Do not apply compounding insets — each child's inset is always relative to its
own origin, never accumulated from ancestors.

---

## Seeded randomness and layout jitter

The subdivision geometry is driven by a splitmix32 PRNG seeded at page load:

```js
const pageSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
```

This means the layout is **different on every page load** — the field breathes
and regenerates each time the visitor arrives.

Each section gets its own derived seed:

```js
// stable hash of section id XORed with page seed
let h = 0;
for (let i = 0; i < sec.id.length; i++)
  h = (Math.imul(h, 31) + sec.id.charCodeAt(i)) >>> 0;
const secSeed = (pageSeed ^ h) >>> 0;
```

### Card order stability

Although the geometry changes on every reload, **card positions are stable
relative to each other**. The entry-to-leaf matching loop runs after all
randomness is exhausted:

1. Leaves (final cells) are sorted by area descending — largest first
2. Entries are sorted by `weight` descending, then `order` ascending — a
   purely deterministic sort with no RNG involvement
3. Each entry claims the first leaf that meets its minimum area and dimension
   thresholds

Because both sorts are deterministic, a weight-3 entry always claims a larger
cell than a weight-2 entry, and within the same weight, `order: 1` always
appears before `order: 2`. The geometry around them varies; their relative
prominence does not.

---

## Section structure

Sections are the first-generation children of the page layout. Each section
is a full-width pane containing:

- A header bar with: section number, section name, a ruled line, and a short descriptor
- A subdivision field below the bar — independently seeded, independently sized

This means sections do not compete with each other for space in a shared field.
Each section's field is its own contained generative zone.

---

## Tile states

### Live tile (`<a class="tile">`)

- Full hover: top-edge cyan reveal (1px line scales from `scaleX(0)` to `scaleX(1)`)
- Border shifts from `--border-card` to `--cyan`
- Arrow `→` fades in at bottom right
- Description text (`.t-desc`) reveals on hover
- Size class `s3` shows description always (large tiles)

### Dormant tile (`<div class="tile dormant">`)

- `pointer-events: none` — not interactive
- Diagonal hatch overlay via `::after` repeating-linear-gradient
- Title colour is `--slate` (dimmed)
- Chip reads "in preparation" instead of "live ↗"
- No hover effects

### Tile size classes

Determined by the matched leaf's area:

| Class | Minimum area | Title size             | Description    |
|-------|-------------|------------------------|----------------|
| `s1`  | any         | 12px                   | hover only     |
| `s2`  | > 10 000px² | 15px                   | hover only     |
| `s3`  | > 25 000px² | clamp(16px,1.8vw,22px) | always visible |

---

## Filler cells

Unmatched leaf rectangles are filler cells. They:

- Carry the depth-darkening background like all other cells
- Have a subtle scanline texture via `repeating-linear-gradient`
- Display a `// comment`-style label in the bottom-left corner, drawn from a
  rotating list of code and math fragments:
  `// noise.eval(x,y)`, `// sin(t·π)`, `// θ=atan2(y,x)`, `// ∇·F=0`, etc.

Filler cells are not interactive. They are decorative infrastructure —
the field should read as dense and alive even where no project card is placed.

Future options for filler cells (not yet implemented):
- Tiny animated SVG motifs (a rotating attractor, a noise plot)
- Local re-subdivision on hover
- Particles moving inside the cell boundaries

---

## Data model — `data.js`

All content lives in `data.js`. Two arrays:

### `SECTIONS`

Controls which sections appear, in what order, and whether they are visible.

```js
const SECTIONS = [
  {
    id:      'events',       // stable identifier — used as seed input
    label:   'Events',       // displayed in section header bar
    desc:    'Annual events & prompt series',  // short descriptor, right of rule
    enabled: true,           // false = section hidden entirely
    order:   1,              // display order — change to resequence
  },
  // …
];
```

### `ENTRIES`

Each entry is one project tile.

```js
const ENTRIES = [
  {
    id:      'genuary',          // stable slug
    section: 'events',           // must match a SECTIONS id
    enabled: true,               // false = hidden from output
    live:    true,               // true = <a> with "live ↗"; false = <div> with "in preparation"
    weight:  3,                  // 1 | 2 | 3 — controls minimum cell size for matching
    order:   1,                  // display order within section — lower = matched first
    cat:     'Annual Event · p5.js',
    title:   'Genuary',
    desc:    'Monthly generative coding challenge — 2021 2022 2023 2025 2026.',
    tag:     'genuary · code art',
    href:    '#',                // '' or absent = treated as dormant regardless of live flag
  },
  // …
];
```

### Weight guidance

| Weight | Minimum tile area | Use for                                      |
|--------|------------------|----------------------------------------------|
| 3      | ~12 000px²       | Feature entries — major series, key projects |
| 2      | ~5 500px²        | Standard entries — individual projects       |
| 1      | ~2 000px²        | Minor entries — small tools, sub-items       |

### To add a project

Copy an existing entry block. Set `live: false` and `href: ''` until the
page is ready. Set `enabled: false` if it should not appear yet.
That is the only required step — no HTML editing needed.

### To activate a project

Set `live: true` and `href` to the real URL.

### To move a project between sections

Change the `section` field to the target section's `id`.

### To reorder within a section

Change the `order` values. Lower order = matched to a larger cell first.

### To hide a whole section

Set `enabled: false` on the section definition. Its entries are unaffected
and will reappear when re-enabled.

---

## Ticker terms — `TICKER_TERMS`

Also in `data.js`. A flat array of strings that scroll in the ticker band.
Content is doubled in the render engine so the CSS animation loops seamlessly.

Terms containing `'genuary'`, `'vera'`, or `'p5'` receive the `.hi` class
and are rendered in a dimmed cyan accent. Adjust the highlight condition in
`render.js` as the content grows.

---

## Section content categories (current)

| Section id    | Label              | Notes                                           |
|---------------|--------------------|-------------------------------------------------|
| events        | Events             | Genuary, Inktober, 36 Days of Type              |
| recreating    | Recreating the Past| Vera Molnár; future: Sol LeWitt, etc.           |
| deep-studies  | Deep Studies       | 100 Gradients, WrongWays, Particle Systems      |
| projects      | Projects           | Windows of Berlin; future multi-sketch series   |
| libraries     | Libraries          | Circle Packing (npm); future releases           |
| tools         | Digital Tools      | Mandala, Planets, Lenticular, Island Generator  |
| plotter       | Plotter Work       | Axidraw experiments; marker/brush/pen variants  |
| fabrication   | Digital Fabrication| Menger Sponge (3D print), Paper Stacker (laser) |
| explorations  | Explorations       | Flow Fields, Combinatorics, Harmonics, noise    |
| math-art      | Math Art           | disabled by default — activate when ready       |

Two additional categories to extract from explorations when content grows:
- **Patterns in Nature** — deposition, diffusion, growth models
- **Particle Systems** — could be promoted from deep-studies to its own section

---

## Deployment

Follows the same pattern as TheBookshelfOfCuriosities. Key notes:

- MkDocs Material site if hosted under that umbrella, or standalone GitHub Pages
- If standalone: no MkDocs header-hide needed, but keep all CSS scoped under
  `.fffx` wrapper class in case it is ever embedded
- Internal project subdirectories (`/genuary/`, `/vera-molnar/`, etc.) are copied
  into `public/` by CI — MkDocs never touches them
- Use `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages`
  (not `peaceiris/actions-gh-pages`) — see MKDOCS-LANDING-PAGE-NOTES.md for detail
- Never commit a `public/` folder — CI only

---

## Design constraints — what not to do

- Do not copy or blend the Bookshelf of Curiosities visual design
- Do not use serif fonts (Libre Baskerville, Instrument Serif, Fraunces, Playfair)
- Do not use the Bookshelf colour tokens (--ink, --gold, --amber, --paper, --ivory)
- Do not use ghost letters, outlined letterforms, or `-webkit-text-stroke`
- Do not use the Bookshelf card system or frame system
- Do not hardcode hex values in CSS — always reference `var(--*)` tokens
- Do not use gradients, drop shadows, glows, or blur effects
- Do not put content data in `render.js` or rendering logic in `data.js`
- Do not put logic-bearing scripts inline in `index.html`
- Do not commit a `public/` folder
