# FFFX Admin Dash — Design Decisions & As-Built Notes

A local-only Node HTTP admin server for editing `content/fffx-sections.tsv`
and `content/fffx-entries.tsv` through a browser UI instead of hand-editing
either file, plus buttons for the two build/check scripts this repo has.
Modeled on `CabinetOfCuriosities/tools/cabinet-editor.js` +
`cabinet-tsv.js` + `cabinet-editor-ui/` (see that repo's
`documentation/cabinet-editor/CABINET-EDITOR.md`), which was built first
and validated the pattern.

## Initial need

FFFX and Bookshelf both already had a TSV → generated-JS content pipeline
(`tools/build-fffx-content.js` / `build-bookshelf-content.js`), but no
editor — content was hand-edited directly in the TSV files (in a text
editor or Excel) and rebuilt from the CLI. Cabinet had since gained a full
browser-based editor plus an admin-controls dashboard for its build
scripts. This closes that same gap for FFFX (and, in the sibling repo,
Bookshelf).

## Decisions and intent

**Separate, independently-evolvable copy, not a shared engine.** FFFX's,
Bookshelf's, and Cabinet's `entries` schemas converge closely (10 of 15
columns identical across all three), but explicit direction was to let
each repo's editor diverge freely rather than force a shared
engine + per-repo config abstraction. `sections` schemas diverge far more
anyway — Cabinet's carries 18 columns of `squarify()`-computed map
geometry that neither FFFX nor Bookshelf has any analogue for, which would
have made a shared "sections" abstraction serve only one of three repos.

**One page (Sections / Entries / Build tabs), not Cabinet's editor-server +
admin-controls-server split.** Cabinet split those because
`tools/now-editor.js` and `tools/cabinet-editor.js` already existed as
separate servers before `tools/admin-controls.js` was added on top — the
split avoided re-implementing either one's TSV read/write/validate logic a
second time. FFFX has no such pre-existing separate servers, so that
reason doesn't apply; `fffx-editor.js` serves the UI, the TSV CRUD API,
and the two build-script routes from one process on one port.

**No reserved/collapsible-column panel.** Cabinet's editor folds
computed-over/dead-but-kept columns (`mapForm`/`islandId`/`cx`/`cy`/`rx`/`ry`
geometry; `subtitle`/`thumbnail` kept as a "just in case") into a
collapsed per-row panel. FFFX's schema has no such columns — every column
in `fffx-sections.tsv`/`fffx-entries.tsv` is either required or a normal
optional field (`thumbnail`, `sourceFolder`, `relatedLinks`, `notes` — all
just skipped from the generated JSON when blank) — so the whole
reserved-panel/row-expand feature was dropped rather than built with
nothing to put in it.

**Section-reference validation is stricter than `build-fffx-content.js`
itself.** The build script never cross-checks an entry's `section` value
against a real section id — it just passes the string through. The editor
(`fffx-tsv.js`'s `findEntryProblems()`) flags a typo'd section as a
row-level problem anyway, matching Cabinet's editor UX: a typo here
doesn't crash the build, it just silently produces an entry that renders
in no section on the live page, which is worth catching immediately
rather than discovering visually later.

**No `weight` field on sections, unlike Cabinet.** `fffx-sections.tsv` is
just `id, title, order, status` — confirmed directly from the real file
and from `build-fffx-content.js`'s `buildSections()`. FFFX's subdivision
layout (`docs/assets/js/fffx-subdivision.js`) computes tile geometry live
in the browser from each *entry's* `weight`, not anything stored
per-section — there's no cached layout state for the editor to expose or
for a "recompute layout" button to trigger.

**Build tab has exactly two actions**, not Cabinet's four
(`build-static`/`promote`/`sitemap`/`mkdocs-check`). FFFX has no
static-build/promote/sitemap step at all — it deploys straight from
`docs/` via GitHub Actions on push (confirmed: no `build-static.mjs`,
`promote.mjs`, or sitemap generator anywhere in the repo). So the Build
tab is just "Rebuild content" (`node tools/build-fffx-content.js`, after
validating both TSVs) and an `mkdocs build --strict` sanity check against
a throwaway tmp site-dir, mirroring `admin-controls.js`'s `mkdocs-check`
route.

**Location field is a `<select>` with a curated list, not free text** —
matches Cabinet's pattern (a fixed option list plus a graceful
"(custom)" fallback for anything already in the data that isn't in the
list, so nothing gets silently overwritten). Options
(`external`, `internal-md`, `external-repo`, blank) come from the real
data (`external`, `internal-md` both present) plus `WORLD-SYSTEMS.md`'s
documented `external-repo` convention.

## Architecture

```text
content/fffx-sections.tsv       -- source of truth, hand-edited or via the admin server
content/fffx-entries.tsv        -- source of truth, hand-edited or via the admin server
      |
      |  tools/fffx-tsv.js (shared: parse/serialize/validate)
      v
tools/build-fffx-content.js     -- CLI build: TSV -> docs/assets/js/fffx-generated-content.js (untouched by this work)
tools/fffx-editor.js            -- local admin server: TSV CRUD API + the two build routes + static UI serving
tools/fffx-editor-ui/           -- the admin server's browser UI (index.html/editor.css/editor.js)
run-fffx-editor.bat             -- double-click launcher
```

`tools/fffx-tsv.js` is a plain strict tab/newline splitter (not a
CSV-quote-aware state machine) — same reasoning as `cabinet-tsv.js`:
`fffx-entries.tsv`/`fffx-sections.tsv` have never contained an embedded
tab/newline/quote in a cell, and `build-fffx-content.js` has always
required an exact per-row cell count. `build-fffx-content.js` itself was
**not** refactored to import from `fffx-tsv.js` — it keeps its own inline
`readTsv()`/`parseStatus()`/etc. (this is a deliberate scope decision, not
an oversight — see Todo below).

`tools/fffx-editor.js` routes:

```text
GET    /api/state                    -- sections + entries (indexed rows) + validation problems + column lists
POST   /api/sections                 -- create (appended, order renumbered in steps of 10)
PUT    /api/sections/:index          -- partial update (only sent fields change)
DELETE /api/sections/:index          -- blocked (422) if any entry still references this section's id
POST   /api/sections/:index/move     -- swap with adjacent row, renumber order
POST   /api/entries                  -- create (inserted after the last row of the same section)
PUT    /api/entries/:index           -- partial update
DELETE /api/entries/:index           -- unconditional
POST   /api/entries/:index/move      -- swap with nearest same-section neighbour, renumber order within that section
POST   /api/run/rebuild-content      -- validates both TSVs, then shells out to build-fffx-content.js
POST   /api/run/mkdocs-check         -- mkdocs build --strict against a throwaway tmp site-dir, cleaned up after
```

Binds `127.0.0.1` only, no auth, port `6858` by default (configurable via
`FFFX_EDITOR_PORT`; chosen distinct from Cabinet's `5757`/`5858`/`5959`
block so both could run side by side if ever needed, and distinct from
Bookshelf's `7858`).

`tools/fffx-editor-ui/` is `index.html`/`editor.css`/`editor.js`, three
tabs (Sections, Entries, Build). Every mutating action refetches
`/api/state` rather than patching local state (a field edit can change
*other* rows' validity — e.g. renaming a section id invalidates every
entry referencing the old one). Field edits save on the input's `change`
event. Columns are sortable (click header, cycles asc/desc/file-order)
and resizable (drag handle); the ▲▼ reorder buttons operate on real file
order and disable themselves while a column sort is active, so they can't
silently move a row somewhere that doesn't match what's currently
displayed. "⇕ Expand text" grows every wide-field textarea to its content
height; a `ResizeObserver` keeps a row's textareas matched in height.

## Files

```text
content/fffx-sections.tsv    -- source of truth
content/fffx-entries.tsv     -- source of truth

tools/fffx-tsv.js            -- shared TSV parse/serialize/validate
tools/build-fffx-content.js  -- TSV -> docs/assets/js/fffx-generated-content.js (pre-existing, untouched)
tools/fffx-editor.js         -- local admin server
tools/fffx-editor-ui/        -- browser UI (index.html/editor.css/editor.js)
run-fffx-editor.bat          -- double-click launcher
```

## Update workflow

1. `node tools/fffx-editor.js` (or double-click `run-fffx-editor.bat` from
   the repo root). Prints a URL — open `http://127.0.0.1:6858/admin/`
   (port configurable via `FFFX_EDITOR_PORT`). `Ctrl+C` stops it.
2. Add/edit/reorder/delete sections and entries through the UI. Rows in
   red show a validation problem on hover (duplicate id, missing field,
   bad section reference) — every write re-validates and re-renders.
3. Build tab → "Rebuild content" regenerates
   `docs/assets/js/fffx-generated-content.js`; "mkdocs check" runs a
   strict sanity build against a tmp dir outside the repo (nothing
   committed or left behind).
4. Commit the TSVs and the regenerated `fffx-generated-content.js`
   together — the editor never commits anything itself.

Hand-editing the TSVs directly still works exactly as before — both paths
write the same files, no separate state to keep in sync.

## Verified

- `node -e "require('./tools/fffx-tsv.js')"` loads clean.
- Live server exercised against the real content files (not fixtures): a
  section-title `PUT` followed by reverting it back produced a `git diff`
  of exactly one line, then none — confirms the parser/serializer is
  lossless and doesn't reformat the file.
- "Rebuild content" via `/api/run/rebuild-content` produced the same
  output (`Generated docs/assets/js/fffx-generated-content.js`) as running
  `node tools/build-fffx-content.js` directly from the CLI, with zero
  `git diff` on the generated file.
- "mkdocs check" via `/api/run/mkdocs-check` correctly runs
  `mkdocs build --strict` and surfaces its real output — currently fails
  with pre-existing warnings unrelated to this work (see Todo below).
- `/admin/` served the UI (`200`), tabs and both Build buttons wired
  correctly.

## Todo / watch out for

- **`mkdocs --strict` currently fails** on real, pre-existing issues: 13
  doc pages exist under `docs/` but aren't listed in `mkdocs.yml`'s `nav:`
  (mostly the placeholder pages), plus several broken relative image links
  in `tools-and-libraries/circle-packing-library.md`
  (`../../assets/images/CirclePacking/*.jpg` should be
  `../assets/images/CirclePacking/*.jpg`). Neither is caused by this work
  — flagging so "mkdocs check" failing isn't mistaken for an editor bug
  the first time someone clicks it.
- **`build-fffx-content.js` was left as-is**, not refactored to import
  from `fffx-tsv.js` the way Cabinet's `build-cabinet-content.js` was
  refactored onto `cabinet-tsv.js`. Both files' TSV-parsing and
  `parseStatus`/`parseList`/`parseRelatedLinks` logic are near-identical
  today by construction (copied from the same source), but they are two
  independent copies — a future change to one won't automatically apply
  to the other. Worth revisiting if the two ever need to be guaranteed
  in sync, the way Cabinet's build script and editor now are.
- **Windows line-ending noise is expected and harmless.** `git status`
  will show a TSV or the generated JS as modified purely from
  LF→CRLF normalization the first time this tooling touches a file that
  was previously untouched this session — `git diff` on the same file
  shows nothing beyond the "LF will be replaced by CRLF" warning. Not a
  sign of real content drift.
- **No image/thumbnail upload** — `thumbnail` is a plain text field
  (path or URL), matching how the TSV already stores it.
- **Renaming a section id doesn't cascade** — matches Cabinet's stance;
  reassign referencing entries first, or expect them to show a validation
  error until you do.

## Changelog

### v1.0 — initial build (2026-09-04/05)

`tools/fffx-tsv.js`, `tools/fffx-editor.js`, `tools/fffx-editor-ui/`
created; `run-fffx-editor.bat` added. First editor for this repo — no
prior tooling replaced. Built and verified before Bookshelf's copy (see
`TheBookshelfOfCuriosities/BOOKSHELF-EDITOR.md`), per direct instruction
to do FFFX first since its schema is the closer match to Cabinet's (no
TSV-content quirks to work around).
