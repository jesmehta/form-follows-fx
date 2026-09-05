# Backend & Deploy — As-Built Notes

Repo-wide/deploy-pipeline work with no single owning page or tool. This
repo doesn't have its own `DOCUMENTATION-GUIDE.md` (see "No
`FILE-MANIFEST.md`/..." below for why) — the convention this folder
follows is borrowed directly from Cabinet's
`documentation/DOCUMENTATION-GUIDE.md`: repo-wide work with no single
owning page lives in `backend-and-deploy/`, appended to as new sections
rather than split into one-topic files.

## `docs/` and `documentation/` reorganization (2026-09-05)

Two separate moves, run back to back, both modeled directly on Cabinet's
own reorg (`CabinetOfCuriosities` commits `7447a0b`/`cfc2ef8`, documented
in that repo's own `BACKEND-AND-DEPLOY.md`).

### `docs/` content vs. system split

`docs/` mixed hand-authored content (the section `.md` pages) with system
files (the landing page's own CSS/JS, its generated content, MkDocs
Material theme overrides, content images) across flat `assets/` and
`stylesheets/` folders with no naming signal for which was which.
Reorganized around Cabinet's exact convention: a leading underscore marks
"supporting files, not a browsable page."

```text
docs/
  index.html                          -- unchanged (standalone landing page)
  archives/, deep-studies/, ...       -- content page folders, unchanged
  _images/CirclePacking/              -- content images
  _assets/
    backend/{css,js}                  -- the landing page's own machinery:
                                          fffx-tokens.css, fffx-landing.css,
                                          fffx-data.js, fffx-generated-content.js
                                          (TSV-generated), fffx-random.js,
                                          fffx-subdivision.js, fffx-layout.js
    material/css/                     -- fffx-material.css (MkDocs Material
                                          theme override only)
```

Unlike Cabinet's split, FFFX has no separate "hand-edited theme extras"
vs. "three different pipelines' machine output" distinction inside
`backend/` — the whole bucket is one subsystem (the landing page engine),
some of it hand-written (`fffx-data.js`, `fffx-layout.js`, etc.), some
generated (`fffx-generated-content.js`), so it stayed one folder rather
than splitting further. `material/` holds exactly one file
(`fffx-material.css`) — the only thing here that's pure MkDocs theme
chrome, unrelated to the landing page itself.

**Content pages were not relocated**, matching Cabinet's own explicit
call: MkDocs derives a page's URL from its `docs/` path, and grouping
pages into folders is a separate, later decision this pass didn't need to
make (FFFX's content folders were already reasonably organized by
section, unlike Cabinet's flat pre-reorg layout).

**What had to change to match**: `mkdocs.yml` (`extra_css`, favicon path
— the favicon reference was already broken/missing before this reorg,
moved for naming consistency only, not fixed, same as Cabinet's
equivalent note), `docs/index.html`'s `<link>`/`<script src>` tags,
`tools/build-fffx-content.js`'s output path, the Admin Dash's Build-tab
copy (`tools/fffx-editor-ui/index.html`), `circle-packing-library.md`'s
six image links (the pre-existing `../../` vs. `../` depth bug in those
links was left exactly as it was — only the `assets/images` → `_images`
segment was renamed, fixing the unrelated depth bug is out of scope for
this reorg), two JS code comments pointing at
`LANDING-PAGE-NOTES.md` (`fffx-layout.js`, `fffx-subdivision.js`), one
`.github/workflows/deploy.yml` error-message string, and current-state
prose in `README.md`/`DESIGN-SYSTEM.md`/`LANDING-PAGE-NOTES.md` (dated
changelog entries in all three left untouched — they correctly describe
the old paths as of when they were true).

**Verification**: `node tools/build-fffx-content.js` re-run, byte-identical
generated output; `mkdocs build --strict` before and after showed the
exact same 6 pre-existing warnings (13 pages missing from `nav:`, 6 broken
image-link-depth warnings in `circle-packing-library.md` — now correctly
naming `_images/` instead of `assets/images/`), no new ones introduced;
the Admin Dash (`fffx-editor.js`) re-tested live — still serves `/admin/`,
its "Rebuild content" button still regenerates the file at its new path
correctly.

**Cross-repo note, same reasoning as Cabinet's own**: `WORLD-SYSTEMS.md`
documents `docs/assets/js/`/`docs/assets/css/`/`docs/assets/images/` as
this world's convention, and is hand-synced byte-for-byte across
Cabinet/Bookshelf/fffx. This repo's `docs/` no longer follows that
literal path. Rather than edit the shared doc from a single world's
perspective, `WORLD-SYSTEMS.md` was left untouched here — reconciling it
(Cabinet already diverged the same way for its own `docs/`; Bookshelf
hasn't yet) is reserved for a separate, later synchronized pass across
all three repos, not something to do piecemeal mid-reorg.

### `documentation/` reorg into one folder per feature

Every doc that used to sit loose at the repo root moved into its own
feature folder, mirroring Cabinet's `documentation/` structure exactly:

```text
documentation/
├── landing-page-notes/
│   ├── DESIGN-SYSTEM.md
│   └── LANDING-PAGE-NOTES.md
├── fffx-editor/
│   └── FFFX-EDITOR.md
└── backend-and-deploy/
    └── BACKEND-AND-DEPLOY.md        -- this file
```

`README.md` and `WORLD-SYSTEMS.md` stay at repo root — matching Cabinet's
own precedent of keeping exactly those two at the top level and moving
everything else. Every cross-reference to the three moved files was
grepped for repo-wide and fixed (`README.md`'s prose and repository-structure
tree, `.github/workflows/deploy.yml`'s error string, the two JS comments
above) — except references *within* `landing-page-notes/`'s own two
files to each other, which stayed as bare filenames since they're now
co-located in the same folder and the reference is still valid, and bare
references to `WORLD-SYSTEMS.md`/`README.md` from inside the moved docs,
which follow the same repo-wide convention Cabinet's own
`CABINET-EDITOR.md` uses (root-level well-known files are referenced by
name, not by relative path, regardless of the referencing doc's own
location).

**No tier-3 (conversation-log) doc was created for either move.** Cabinet's
`landing-v3-notes/` and `cabinet-editor/` each carry a `conversation-*.md`
alongside their tier-2 doc; FFFX has no such narrative doc for its
landing page's development history, and per Cabinet's own
`documentation/DOCUMENTATION-GUIDE.md` (the convention this repo borrows,
not one it hosts a copy of) one shouldn't be fabricated after the fact.
Left as a known, flagged gap rather than invented.

**No `FILE-MANIFEST.md`/`DOCUMENTATION-GUIDE.md`/`CONTENT-INVENTORY.md`
suite was created.** Cabinet's `documentation/` root also carries those,
plus an AI-dependency audit and a meta-analysis doc — artifacts from a
much larger, longer-running project. At FFFX's current scale (two
feature folders, three doc files total) an index into `documentation/`
buys nothing a directory listing doesn't already show; skipped rather
than building ceremony nobody will maintain. Revisit if `documentation/`
grows enough that navigating it needs an index.

## Changelog

### 2026-09-05 — `docs/` content-vs-system split + `documentation/` per-feature reorg

See "docs/ and documentation/ reorganization" above for the full record.
Two commits: `docs/` reorg first (verified independently — build +
`mkdocs --strict` + live Admin Dash check — before touching
`documentation/`), then the `documentation/` move as a separate commit,
since a file-move-plus-cross-reference-fix is one concern and the asset
reorg is a different one, even though both were requested and executed in
the same session.

### 2026-09-04/05 — FFFX Admin Dash built (context for the above)

Predates and motivated part of this reorg's file list — see
`documentation/fffx-editor/FFFX-EDITOR.md` for the full record. Mentioned
here only because `fffx-editor-ui/index.html`'s Build-tab copy was one of
the files this reorg had to update.

## Todo / watch-out-for

- **WORLD-SYSTEMS.md reconciliation is still open** — its fffx-specific
  path descriptions (`docs/assets/js/...`) are now stale, same as
  Cabinet's own copy already is for Cabinet's paths. A synchronized pass
  across all three repos' copies is the right fix, not a one-repo edit.
- **`build-fffx-content.js` was not refactored to share a TSV module**
  with the Admin Dash's `fffx-tsv.js` — noted already in
  `FFFX-EDITOR.md`'s own Todo, repeated here since it's exactly the kind
  of thing a future `docs/`-adjacent refactor might assume already
  happened.
- **The circle-packing-library.md image-link depth bug is still open** —
  `../../` should be `../` (one level too many) — deliberately not fixed
  in this pass; fixing it is an unrelated content-bug commit, not a reorg
  step.
- **Section-folder content reorg (Cabinet's later, separate move) was not
  attempted here** — Cabinet's `docs/` content-folder reorganization
  (2026-09-03, moving actual `.md` pages into new section groupings) is a
  distinct, later decision that changes live URLs; nothing about it was
  in scope for this pass, and FFFX's content folders weren't judged to
  need it.
