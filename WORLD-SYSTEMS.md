# World systems: the shared Level 1 pattern

This file documents the conventions shared across Level 1 worlds in the
Cabinet of Curiosities ecosystem — currently **fffx** (this repo) and
**The Bookshelf of Curiosities**. It exists so the two repos' development
approach, data schema, and naming stay normalized even though their
*visual* identity is deliberately distinct (this file does not touch
either site's design system — see this repo's `DESIGN-SYSTEM.md` /
Bookshelf's `DESIGN-SYSTEM.md` for that).

A duplicate of this file lives in both repos. It's intentionally
duplicated, not symlinked or submoduled — these are separate
repos/deployments, and a shared file living in only one of them would be
easy to forget to check. Keep both copies in sync by hand when this
pattern changes; if they drift, treat whichever was edited more recently
as correct and backport.

## Conceptual levels

- **Level 1** — a world/domain. The Cabinet of Curiosities itself,
  Bookshelf, fffx. Each is its own repo, its own MkDocs site, its own
  GitHub Pages deployment.
- **Level 2** — a section/room/region within a Level 1 world. fffx's
  `sections[]` registry (`prompt-collections`, `tools-and-libraries`,
  etc.); Bookshelf's `bookshelfSections[]` (`Author Explorations`,
  `Book Data & Visualisation`, etc.).
- **Level 3** — an actual object/page/tool/project. fffx's `entries[]`
  portals; Bookshelf's section `cards[]`.

## The common Level 1 world pattern

Every Level 1 world in this ecosystem:

- Uses **MkDocs Material** for normal (non-landing) pages.
- Has a **custom landing page** for its own homepage — not a generic
  Material content page. fffx's is a standalone `docs/index.html`
  (bypasses Material entirely); Bookshelf's is `docs/index.md` (rendered
  through Material with the header/nav hidden). See "Homepage rule"
  below for which pattern new worlds should use.
- Is driven by **one data file** as the editable IA/content source — no
  content strings or card data live in the renderer. fffx:
  `docs/assets/js/data.js`. Bookshelf: `docs/js/bookshelf-data.js`.
- Maps **CSS tokens into MkDocs Material pages** — a `*-tokens.css` file
  (raw colour/font values, `:root`-scoped, single source of truth) feeds
  both the landing page's own stylesheet and a `*-material.css` file
  that overrides Material's `--md-*` variables, so Material-rendered
  content pages match the landing page's palette instead of defaulting
  to Material's own light theme. See "Asset naming" below.
- Deploys via **GitHub Pages**, built by a `.github/workflows/deploy.yml`
  GitHub Action (`mkdocs build` → copy any standalone static
  sub-projects → `actions/deploy-pages`). Both repos' workflows are
  currently identical in structure.

### Local world data vs. Cabinet data

A Level 1 world's own data file controls what appears on **that world's
own landing page**. It does not control whether that world (or an item
within it) appears on the **Cabinet's** own map/index of worlds — that's
a separate concern, governed by whatever data file the Cabinet repo
itself uses to list its Level 1 worlds. A portal can exist in fffx's
`entries[]` (so it renders on fffx's own landing page) without
necessarily being surfaced on the Cabinet's map, and vice versa.

### Cross-listed projects

A project can legitimately belong to more than one Level 1 world's data
file (e.g. a project that's both a Bookshelf "data visualisation" and an
fffx "tool"). When that happens, **each world's data file gets its own
entry**, but both entries should link to the **same canonical URL**
rather than each world hosting its own copy of the content. Don't fork
the content; do duplicate the listing.

## Standard shared data fields

Every Level 1 world's entries (Level 3 objects) should carry these
fields where applicable. World-specific fields beyond this list are
allowed and expected — every world has its own texture — but must be
documented in that world's own notes file (`LANDING-PAGE-NOTES.md` for
fffx, `README.md` for Bookshelf).

```js
id              // stable, unique within the world
title
subtitle
href            // relative, never root-absolute (breaks under a GitHub
                // Pages project subpath — see each world's notes for
                // the incident that taught this)
section         // OR primarySection — see below
sections        // optional, for genuinely cross-listed-within-one-world entries
primarySection
kind
order           // placement priority — see "order-based rendering" below
weight          // editorial/visual importance — see below
status          // see "Standard status model" below
tags
location
repo            // { name, url } — if the entry has its own source repo
```

`section` (singular) is what both worlds currently use for an entry's
one home section. `primarySection`/`sections` (plural) are the
forward-looking fields for an entry that's genuinely cross-listed across
multiple sections *within the same world's data file* — neither world
needs this yet (no entry currently lives in more than one section), so
neither has added it mechanically. Adopt `primarySection`/`sections`
instead of `section` when that need actually arises, rather than
bolting on unused fields now.

Section objects (Level 2) should carry:

```js
{
  id,       // stable, kebab-case, never just the display title
  title,
  order,
  status    // true | "wip" | false — same model as entries, see below
}
```

## Standard status model

One field, doing both visibility and "is this finished" duty:

```js
status: true      // visible, normal
status: "wip"     // visible but muted/dormant/work-in-progress
status: false     // hidden/not rendered
```

fffx's `entries[]` already use this exactly. Bookshelf's cards currently
use a different boolean, `live` (`true` = clickable/full-colour,
`false` = dormant placeholder — visually equivalent to `status: "wip"`,
not `status: false`, since dormant cards still render). Bookshelf now
also carries a `status` field on every card, computed from `live`
(`live: true` → `status: true`, `live: false` → `status: "wip"`) — added
*alongside* `live`, not replacing it, since the renderer still reads
`live` directly. Bookshelf's per-section `enabled` boolean has been
replaced outright with `status` (`enabled: true/false` mapped 1:1 to
`status: true/false`), since no section currently needs the "wip" middle
state and the renderer was already trivial to update for that one.

## `weight` vs. world-specific layout fields

`weight` is the shared editorial/visual-importance signal — how much
visual presence an entry deserves, independent of how each world's
renderer turns that into actual pixels:

- **fffx** uses `weight` directly as the subdivision tile-area scoring
  multiplier (`scoreRectForEntry` in `subdivision.js`) — higher weight
  targets a larger rectangle.
- **Bookshelf does not have a `weight` field yet** — card size is set
  directly via its own `span` field (`c4`/`c5`/`c6`/`c7`/`c8`/`c12`, a
  12-column grid width), with no editorial-importance signal behind it.
  Adding `weight` and deriving `span` from it is deferred — see TODOs
  below. (Corrected 2026-06-30: this section previously claimed
  Bookshelf already carried `weight` as a normalized signal alongside
  `span` — checked the actual data file, it doesn't exist there.)

## Homepage rule

New Level 1 worlds should default to a **standalone `docs/index.html`**
for a fully custom landing page (fffx's pattern), not `docs/index.md`
rendered through Material with the header hidden (Bookshelf's pattern).
The standalone-HTML approach needs no header-hiding CSS/JS workaround,
no Markdown-pipeline risk for inline logic, and no `:has()`/sibling-walk
fragility — see fffx's `LANDING-PAGE-NOTES.md` for the full comparison.

**Do not create `docs/index.md` in a repo that uses `docs/index.html`** —
MkDocs will happily build both, but only one can actually serve as `/`,
and the collision is a confusing, easy-to-reintroduce mistake (see the
guard described in fffx's `README.md`/`LANDING-PAGE-NOTES.md`).

Bookshelf still uses `docs/index.md` today. Migrating it to a standalone
`docs/index.html` is a real, deferred piece of work — see TODOs below —
not something to attempt incidentally while doing this normalization
pass.

## Asset naming

Preferred convention for new or reorganized worlds:

```text
docs/assets/js/
docs/assets/css/
docs/assets/images/
docs/assets/thumbs/
docs/stylesheets/        # Material-facing CSS only (tokens + material override)
```

World-prefixed CSS filenames, so it's unambiguous which world a
stylesheet belongs to even out of context:

```text
fffx-tokens.css
fffx-landing.css
fffx-material.css

bookshelf-tokens.css
bookshelf-landing.css
bookshelf-material.css
```

Both worlds' `*-tokens.css` and `*-material.css` files already follow
this. Both worlds' landing stylesheet has been renamed to
`*-landing.css` to match (was `landing.css` in fffx, `bookshelf.css` in
Bookshelf). Both worlds have now moved JS/images under `docs/assets/`:
fffx has `docs/assets/js/`/`docs/assets/css/`/`docs/assets/images/`;
Bookshelf has `docs/assets/js/`/`docs/assets/images/`. Both keep
`docs/stylesheets/` as a sibling of `docs/assets/`, not nested inside
it — that split is intentional (see asset folder list above), not a
leftover.

## Order-based rendering

Preferred model, applied wherever safe to do so without rewriting a
renderer's core logic:

- Every section has `order`.
- Every entry/card has `order`.
- The renderer sorts by `order` rather than relying on array position or
  string-matching against a display title.

Bookshelf's sections previously had no `order` field at all (array
position was the only ordering signal) and its `beforeSection` pinning
mechanism (for the text-band/quote-break inserts) matched against each
section's *display name* — fragile, since renaming a section in the UI
silently broke the pin. Both fixed: sections now carry `id`/`order`,
cards within a section now carry `order`, and `beforeSection` matches
against the stable `id` instead of the display title. See Bookshelf's
`README.md` changelog for the specific commit.

fffx's `entries[]`/`sections[]` already used explicit `order` from the
start; no change needed there.

## TODOs (deferred, not done in this pass)

- **Bookshelf: migrate `docs/index.md` → standalone `docs/index.html`.**
  Real architectural change (drop the header-hiding CSS/JS, restructure
  how the page mounts), not attempted here.
- ~~Review fffx's extra attributes~~ — done 2026-06-30: removed `era`
  (unused in render, redundant with `kind`/`tags`) and `sourceFolder`
  (a working/migration note, not real IA) from all entries; renamed
  `image` → `thumbnail` (consumed by `layout.js`'s `--thumb` property —
  the only one of the four that's actually rendered). Removed
  `relatedLinks`/`notes` outright — confirmed with the repo owner these
  were leftover auto-populated content from an earlier AI-assisted pass,
  not deliberately curated IA, so the one real value each (a related-link
  pointer on `code-to-fabrication`, a note on `legacy-processing-archive`)
  was dropped along with the fields. `location` and `repo` reviewed and
  kept: `repo` is genuine data (an actual GitHub repo pointer, used once);
  `location` has no immediate use but costs nothing idle and is the
  strongest shared-fields candidate of the unused ones (the "does this
  entry link outside its own repo" question applies to all three worlds,
  not just fffx).
- **Review Bookshelf's extra attributes** — `cat`/`ghost`/`titleVariant`
  and similar still unreviewed; some may be worth promoting to shared
  fields, some may be dead. Not started.
- **Bookshelf: rename `cards` → `entries`** to match fffx's terminology
  — cross-world vocabulary alignment, touches the renderer's `.cards`
  references and prose throughout Bookshelf's docs. Not started.
- **Bookshelf: replace `live` with `status` in active use, drop `live`**
  — `live`/`status` currently duplicate each other (`live` is what the
  renderer reads, `status` is hand-maintained alongside it per the
  documented `live:true`→`status:true`, `live:false`→`status:"wip"`
  mapping). Needs a decision on what `status: false` should mean for a
  card before the renderer can switch to reading `status` directly —
  today every card always renders (live or dormant placeholder), there's
  no "card hidden entirely" state. Not started.
- **Bookshelf: split `sections[]`/`cards[]` into two flat top-level
  arrays** (section metadata only vs. entries referencing their section
  by id), matching fffx's actual shape (`sections[]` + `entries[]`,
  joined by `entry.section`/`primarySection`) instead of nesting cards
  inside each section object. The most invasive of the open Bookshelf
  items — touches `bookshelf-gallery.js`'s core render loop, not just
  field names. Natural to pair with the `cards`→`entries` rename rather
  than do as two separate passes. Not started.
- **Bookshelf: derive `span` from `weight`** instead of maintaining both
  independently, if/when Bookshelf's card grid is revisited — note
  Bookshelf doesn't actually have a `weight` field yet (despite the
  "`weight` vs. world-specific layout fields" section above implying it
  does); this would need to be added first.
- ~~Bookshelf: move `docs/js/`, `docs/images/` under `docs/assets/`~~ —
  done 2026-06-30: `docs/assets/js/`, `docs/assets/images/`, all
  references updated.
- ~~fffx: move `docs/images/` under `docs/assets/images/`~~ — done
  2026-06-30: `docs/assets/images/CirclePacking/`, all references
  updated (`mkdocs.yml`'s `favicon`, `circle-packing-library.md`'s
  6 image refs, README.md's structure tree, `LANDING-PAGE-NOTES.md`'s
  MkDocs-integration notes).
- **Cross-world `primarySection`/`sections[]` fields** — add only when
  an actual cross-listed-within-one-world entry exists; not bolted on
  speculatively.
- **Stricter CI checks** — e.g. a lint step that fails the build if a
  `section`/`primarySection` value doesn't match any registered section
  `id`. Not added this pass.
- **Bookshelf card component unification** — fffx's tiles and
  Bookshelf's cards remain two separate, world-specific render
  functions. Not merged into one shared component; the two sites'
  visual identities are deliberately distinct enough that a shared
  component would likely fight both designs.
