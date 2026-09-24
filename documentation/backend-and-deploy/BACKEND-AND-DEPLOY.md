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

**Update, 2026-09-05, later the same day**: both open points below were
revisited and reversed on direct instruction — see the conversation log's
Part 1 for the actual exchange.

**Tier-3 (conversation-log) docs were written after all** —
`conversation-fffx-editor.md` and this file's own
`conversation-backend-and-deploy.md`, both from this session's real
transcript (real quotes, not reconstructed), not backfilled for older
work that has no available transcript.

**Update, same day, later still**: the `landing-page-notes/` gap noted
just above closed on its own — two saved chat exports predating this
repo's git history (`FFFX_PageDesign_2_Claude.html`, a ChatGPT export)
turned out to be sitting in `documentation/` already, found when
the user pointed at them directly. Both are static "complete webpage"
saves with their DOM
already rendered, so their real conversation text was recoverable
directly (unlike two live `claude.ai/share/...` links tried earlier in
this same session, which render client-side and came back empty).
`landing-page-notes/conversation-landing-page-notes.md` was written from
that recovered text — real quotes, two parts (the original ChatGPT brief,
then the Claude build session that actually produced the shipped
design), same as the other two conversation logs, just recovered rather
than recorded live.

**`FILE-MANIFEST.md` was created, scoped like Cabinet's own** — not just
an index of `documentation/`'s own contents, but every code/config file
across the repo (`tools/`, `content/`, `docs/`, root-level files),
organized by subsystem, so someone hunting for a specific file's role has
one place to check. `DOCUMENTATION-GUIDE.md`/`CONTENT-INVENTORY.md`/an
AI-dependency audit/a meta-analysis doc were still not built — those
remain judged as scale-driven artifacts from Cabinet's much larger,
longer-running project, not something FFFX's current four-doc
`documentation/` tree needs yet.

## `mkdocs-section-index` plugin (2026-09-08)

Added to `plugins:` in `mkdocs.yml` and to `requirements.txt`, ported
over (alongside the same change in Cabinet) from Bookshelf's own fix
(commit `7e5c1f3`, 2026-09-06): a plain MkDocs nav section can't be both
a page and a section, so a section whose first child is its own
unlabeled index page shows that page's title duplicated in the sidebar
-- once as the (non-clickable) section header, once as a normal,
separately-clickable child directly beneath it. The plugin merges that
first child into the section header itself instead.

No fffx section currently has an `index.md` child to merge, though --
`mkdocs.yml`'s own comment block explains why: unfinished sections
(Prompt Collections, Deep Studies, Generative Projects, Image
Experiments, Sketch Families, Physical Outputs, Archives) are
deliberately commented out of the nav entirely rather than linked via a
hub page, until each has real content. So this is installed ahead of
need, not fixing a live duplicate-row problem the way Cabinet's three
sections had -- revisit once any fffx section actually grows a real
`index.md` hub page wired into the nav. See Cabinet's own
`documentation/backend-and-deploy/BACKEND-AND-DEPLOY.md` ("Sidebar
section headers become clickable") for the fuller writeup, since that
repo's three affected sections make the mechanism concrete in a way
fffx's own config doesn't yet.

## Cloudflare Web Analytics (2026-09-24)

Rollout of Cabinet's own beacon (`CabinetOfCuriosities/documentation/backend-and-deploy/cloudflare-web-analytics-setup.md`, `#135`) to this sibling world, same two-part pattern: `mkdocs.yml` gained `theme.custom_dir: overrides`, and a new `overrides/main.html` extends Material's `base.html`, injecting the beacon into the `extrahead` block so every MkDocs-generated page gets it from one place; the standalone `docs/index.html` landing page (not MkDocs-templated, so the override doesn't reach it) got the same script tag added directly, before `</body>`.

**Token decision**: reuses Cabinet's own token (`16664b6ab6d449a799db2dbcfb97c6ce`) rather than registering fffx.cabinetofcuriosities.in as a separate Cloudflare Web Analytics property — direct decision, 2026-09-24: this is a personal site, one combined dashboard across Cabinet/Bookshelf/fffx (and the externally-assembled repos, `#136`) was judged simpler than juggling eight separate properties. The beacon still had to be added by hand to this repo either way — Cloudflare doesn't auto-inject across subdomains just because they share a zone/proxy.

**Verification**: local `mkdocs build` — clean, same 6 pre-existing warnings as before (unrelated to this change), beacon present in 17 of the built output's HTML files including `index.html` and every content page. Live-site confirmation (beacon firing, data reaching the Cloudflare dashboard) not yet done from this session.

**Known limitation, surfaced by direct question 2026-09-24**: Cloudflare's "Top Paths" dashboard table should still separate this site's traffic from Cabinet's/Bookshelf's in practice, since almost every page here has a distinct path (`/recreating-the-past/vera-molnar/`, etc.). The one soft spot is the homepage itself — Cabinet's, Bookshelf's, and this site's root all report as `/`, and whether the dashboard distinguishes them by hostname when one token spans multiple hostnames (vs. collapsing all three into one `/` row) hasn't been confirmed. See Cabinet's own `cloudflare-web-analytics-setup.md` for the full writeup.

## Changelog

### 2026-09-24 — Cloudflare Web Analytics beacon added

See "Cloudflare Web Analytics" above.

### 2026-09-08 — `mkdocs-section-index` plugin added

See "`mkdocs-section-index` plugin" above.

### 2026-09-05 — saved chat export files renamed again, one real content gap found

The first rename (below) broke the Claude file's own rendering: Windows
Explorer's paired rename moved its `_files` folder to match the new
name, but the HTML's internal `<script src=...>` references still
pointed at the literal old folder name, so every asset 404'd. Rather
than hand-edit a 200KB+ single-line generated file, both pages were
re-saved fresh from the browser as `FFFX_PageDesign_2_Claude.html` and
`FFFX_PageDesign_1_ChatGPT.html` (plus matching `_files` folders, no
spaces or special characters, folder name matching file name in both
cases). The first fresh ChatGPT resave was missing its opening exchange
in the rendered page — a real gap this time (unlike the false alarm
below), traced to the page not having been scrolled to the top before
saving; the user rescrolled and re-saved, and the result is now the most
complete of all three ChatGPT exports found across this repo's history,
including one short closing offer from ChatGPT that neither earlier
export had. All superseded files (`Claude.html`,
`Claude - FFFX page design 2.html`, `Claude_files/`,
`WebTech Projects - FFFX Page Design.htm`,
`ChatGPT - FFFX Page Design 1.html`, and an orphaned
`FFFX Page Design_files/`) were deleted by the user once the final two
were verified. `conversation-landing-page-notes.md` and this file
updated to the final names.

### 2026-09-05 — saved chat export files renamed/swapped

`Claude.html` → `Claude - FFFX page design 2.html` (renamed only); the
ChatGPT export was swapped for a cleaner shared-link version of the same
conversation, `WebTech Projects - FFFX Page Design.htm` →
`ChatGPT - FFFX Page Design 1.html`. Re-verified by extraction that the
new ChatGPT export contains the same full conversation (including the
opening exchange) before treating the old file as safe to retire — a
first extraction pass had appeared to show that exchange missing, traced
to a transient read glitch rather than real content loss.
`conversation-landing-page-notes.md` and this file updated to the new
names; the dated entry below is left with the original names, since
that's what the files were called at the time it describes.

### 2026-09-05 — `landing-page-notes/` conversation log recovered

Two saved chat exports (`Claude.html`, a ChatGPT `.htm` export) already
sitting in `documentation/`, predating this repo's own git history, were
found and read at the user's prompting. Both are static "complete
webpage" saves with their DOM already rendered — unlike two
`claude.ai/share/...` links tried earlier the same session, which render
client-side and returned empty pages, these were recoverable directly by
stripping `<script>`/`<style>` and remaining tags. Wrote
`landing-page-notes/conversation-landing-page-notes.md` from the
recovered text: Part 1 (ChatGPT, the original brief — including a
white/graph-paper visual direction that was tried and abandoned), Part 2
(Claude, the next day — where the recursive-subdivision engine that
actually shipped was designed and debugged through five rounds of
iteration). Closes the gap this file itself flagged as open in the entry
below.

### 2026-09-05 — conversation-log docs + `FILE-MANIFEST.md` added

Reversed both of the reorg's own "deliberately not built" calls, on
direct instruction (see the conversation log's Part 1): wrote
`conversation-fffx-editor.md` and this file's own conversation-log from
this session's real transcript; wrote `documentation/FILE-MANIFEST.md`
covering the whole repo's code/config files, not just `documentation/`
itself, matching Cabinet's actual scope once checked directly against it.
`README.md`'s repository-structure tree and Changelog updated to point at
both.

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

- ~~`landing-page-notes/` still has no conversation-log companion~~ —
  resolved 2026-09-05: two saved chat exports predating this repo were
  found in `documentation/` and used to write
  `conversation-landing-page-notes.md`. See the Changelog and this file's
  "Update, same day, later still" note above.
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
- **`mkdocs-section-index` is installed but nothing uses it yet** (see
  "`mkdocs-section-index` plugin" above) — revisit once any fffx section
  gets a real `index.md` hub page wired into the nav.
- **Section-folder content reorg (Cabinet's later, separate move) was not
  attempted here** — Cabinet's `docs/` content-folder reorganization
  (2026-09-03, moving actual `.md` pages into new section groupings) is a
  distinct, later decision that changes live URLs; nothing about it was
  in scope for this pass, and FFFX's content folders weren't judged to
  need it.
