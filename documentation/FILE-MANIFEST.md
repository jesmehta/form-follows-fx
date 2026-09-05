# File Manifest

Every code/config file in this repo and its role, organized by subsystem.
Content page folders under `docs/` are described as one entry each rather
than file-by-file — see `README.md`'s "Repository structure" for the full
per-page breakdown where it exists. Companion to `README.md`'s own
structure section (the practical guide); this is the exhaustive map, same
relationship Cabinet's `FILE-MANIFEST.md` has to its own `README.md`.
Not auto-built — update by hand alongside structural changes, same as
every other doc here. Generated 2026-09-05, alongside the `docs/`/
`documentation/` reorg (see `backend-and-deploy/BACKEND-AND-DEPLOY.md`).

## Root-level files

Only `README.md` and `WORLD-SYSTEMS.md` are root-required, matching
Cabinet's own convention. `README.md` is a git/GitHub hosting convention
(root is where it's expected to render); `WORLD-SYSTEMS.md` is
hand-synced byte-for-byte across Cabinet/Bookshelf/fffx with its path
assumed identical in all three, so it can't move here without desyncing
the other two repos.

| File | Role |
|---|---|
| `README.md` | Practical guide: structure, running locally, editing content, deploy pipeline, changelog. Start here. |
| `WORLD-SYSTEMS.md` | Conventions shared across Cabinet/Bookshelf/fffx (data schema, status model, homepage rule). Hand-synced identically across all three repos — don't edit without also updating the other two. |
| `FFFX-CLAUDE-CODE-PROMPT.md` | Untracked (never committed) — a grounding-prompt-style spec covering design system, colour palette, typography, and ticker spec, framed as a prompt for an AI session building/editing the landing page. Overlaps in subject with `documentation/landing-page-notes/DESIGN-SYSTEM.md`; not diffed against it or reconciled as part of this manifest's creation — flagged here rather than silently omitted since it's a real file on disk. |
| `mkdocs.yml` | MkDocs site config: nav tree, theme (Space Grotesk/IBM Plex Mono, slate scheme only), plugins, `extra_css`. |
| `requirements.txt` | Python deps for `mkdocs build`/`mkdocs serve`. |
| `.github/workflows/deploy.yml` | CI: `mkdocs build --site-dir public`, official `actions/configure-pages` → `upload-pages-artifact` → `deploy-pages` pipeline, guards against a stray `docs/index.md` colliding with the standalone `docs/index.html` landing page. |
| `run-fffx-editor.bat` | Double-click launcher for `tools/fffx-editor.js` (the Admin Dash). |

## `documentation/` — project documentation, not root-required

Organized 2026-09-05 into one folder per feature, mirroring Cabinet's own
`documentation/` structure. A subsystem with only one doc file stays flat
at `documentation/` root rather than getting a single-file folder of its
own — currently none do, so there are no root-level files here besides
this manifest.

| File | Role |
|---|---|
| `FILE-MANIFEST.md` | This file. |

### `landing-page-notes/` — the landing page's visual + implementation design

| File | Role |
|---|---|
| `DESIGN-SYSTEM.md` | Visual language: typography, colour tokens, structure-layer rendering, per-section accent hues, filler-cell variety. Own changelog, v1.0–v2.0 phases. |
| `LANDING-PAGE-NOTES.md` | Implementation architecture: file responsibilities, data model, rendering pipeline, local preview, deployment, `entries[].href` relative-path rule. Own changelog covering the same version history from the code side. |

No conversation-log companion exists for this pair — flagged as a known
gap in `backend-and-deploy/BACKEND-AND-DEPLOY.md` rather than fabricated,
since no real narrative transcript of the landing page's own development
history is available to this repo.

### `fffx-editor/` — the Admin Dash

| File | Role |
|---|---|
| `FFFX-EDITOR.md` | Design decisions and as-built record for `tools/fffx-editor.js` (mirrors Cabinet's `CABINET-EDITOR.md`) — architecture, routes, files, update workflow, verified checks, todo, changelog. |
| `conversation-fffx-editor.md` | Conversation-log companion — real quotes and the actual back-and-forth behind the one-page-vs-two and shared-engine-vs-copy decisions, plus the two subdivision-rendering questions answered mid-plan. |

### `backend-and-deploy/` — infrastructure with no single feature home

| File | Role |
|---|---|
| `BACKEND-AND-DEPLOY.md` | Technical reference for the `docs/` content-vs-system split and the `documentation/` per-feature reorg (both 2026-09-05) — as-built structure, what had to change, verification, the deliberate choice not to touch `WORLD-SYSTEMS.md` or build a larger meta-doc suite. |
| `conversation-backend-and-deploy.md` | Conversation-log for the same reorg, per the standing rule that backend/deploy/site-wide work with no single page or tool shares one doc, appended as new `# Part N` sections rather than split into new files. Currently one part. |

## `content/` — canonical data sources (hand-edited, or via the Admin Dash)

| File | Role |
|---|---|
| `content/fffx-sections.tsv` | Section registry: `id, title, order, status`. No `weight`/geometry columns — the subdivision layout is computed live in the browser from entries' own `weight`, nothing is cached per-section. |
| `content/fffx-entries.tsv` | Entry/portal registry: `id, title, subtitle, href, section, kind, status, order, weight, tags, location, thumbnail, sourceFolder, relatedLinks, notes`. `thumbnail`/`sourceFolder`/`relatedLinks`/`notes` are optional, skipped from generated output when blank. |

## `tools/` — build and authoring scripts (never shipped to `docs/`)

| File | Role |
|---|---|
| `build-fffx-content.js` | Parses both `fffx-*.tsv` files into `docs/_assets/backend/js/fffx-generated-content.js`. Not refactored onto `fffx-tsv.js`'s shared module (unlike Cabinet's equivalent script, which was) — the two TSV-parsing implementations are independent copies today, flagged in `FFFX-EDITOR.md`'s Todo. |
| `fffx-tsv.js` | Shared TSV parse/serialize/validate logic used by the Admin Dash server. Plain strict tab/newline splitter (not CSV-quote-aware) — neither `fffx-*.tsv` file has ever needed embedded-tab/quote handling. |
| `fffx-editor.js` | Local-only zero-dependency Node HTTP Admin Dash server (`/admin/`, port `6858` by default, `FFFX_EDITOR_PORT` to override) — TSV CRUD/validate API plus two build-script routes (`rebuild-content`, `mkdocs-check`), all in one process (unlike Cabinet's editor-server/admin-controls-server split — see `FFFX-EDITOR.md`'s "Decisions and intent" for why that split doesn't apply here). |
| `fffx-editor-ui/index.html`, `editor.css`, `editor.js` | The Admin Dash's browser UI — Sections/Entries/Build tabs, sortable/resizable columns, "⇕ Expand text" toggle, no reserved-column panel (this schema has none). |

## `docs/` — the live MkDocs site + standalone landing page

Reorganized 2026-09-05 (see `backend-and-deploy/BACKEND-AND-DEPLOY.md`)
around Cabinet's own convention: a leading underscore marks "supporting
files, not a browsable page." Content page folders were **not**
relocated in that pass — matching Cabinet's own "content pages not
relocated" call, since MkDocs derives a page's URL from its `docs/` path.

| Path | Role |
|---|---|
| `docs/index.html` | Standalone Level-1 landing page — the recursive rectangle-subdivision field. Not rendered through Material's theme; MkDocs copies it through byte-for-byte. |
| `docs/archives/legacy-processing-archive.md` | Placeholder, do-not-touch-yet — underlying `.pde` source files explicitly not migrated. |
| `docs/deep-studies/` | `100-gradients.md`, `particle-systems.md` — placeholders. |
| `docs/generative-projects/windows-of-berlin.md` | Placeholder. |
| `docs/image-experiments/image-filters.md` | Placeholder. |
| `docs/physical-outputs/` | `code-to-fabrication.md`, `plotter-work.md` — placeholders. |
| `docs/prompt-collections/genuary.md` | Placeholder. |
| `docs/recreating-the-past/vera-molnar.md` | Real, finished content — one of two pages currently listed in `mkdocs.yml`'s `nav:`. |
| `docs/sketch-families/` | `flow-fields.md`, `perlin-noise.md` — placeholders. |
| `docs/tools-and-libraries/circle-packing-library.md` | Real, finished content — the other page listed in `nav:`, weight-4 feature tile. Its six image links have a known, deliberately-unfixed `../../` vs. `../` depth bug (see Todo in `fffx-editor/FFFX-EDITOR.md`). |
| `docs/tools-and-libraries/` (other files) | `mandala-generator.md`, `lenticular-image-generator.md`, `harmonics-dance-of-planets.md` — placeholders. |
| `docs/_images/CirclePacking/` | Six images for the Circle Packing writeup. |
| `docs/_images/favicon.svg` | Referenced by `mkdocs.yml`'s `favicon:` but does not actually exist on disk — a pre-existing, still-open bug (not fixed by the reorg, only renamed alongside the folder). |

### `docs/_assets/` — CSS/JS shipped to production

Not split into "hand-edited vs. machine-written" subsystems the way
Cabinet's `_assets/backend/` is (three separate pipelines feeding it
there) — FFFX's landing engine is one subsystem, some hand-written, one
file generated, so it stays one folder.

| File | Role |
|---|---|
| `backend/css/fffx-tokens.css` | Single source of truth for colour/font `--fffx-*` custom properties — shared between the landing page and the Material theme mapping below. |
| `backend/css/fffx-landing.css` | All landing-page CSS, scoped under `.fffx-landing`. |
| `backend/js/fffx-data.js` | Hand-edited stable config — `landingConfig` (seed, layout/subdivision/scoring parameters). |
| `backend/js/fffx-generated-content.js` | Auto-generated from `content/fffx-*.tsv` by `tools/build-fffx-content.js` — do not hand-edit. |
| `backend/js/fffx-random.js` | Seeded PRNG + deterministic per-rect-id filler-variant picker. No DOM. |
| `backend/js/fffx-subdivision.js` | Pure logic: rectangle tree generation, candidate filtering, scoring, entry assignment. No DOM access at all. |
| `backend/js/fffx-layout.js` | Orchestration + rendering only — DOM construction, resize handling, imports the above as ES modules. |
| `material/css/fffx-material.css` | Maps `fffx-tokens.css`'s values onto MkDocs Material's own `--md-*` variables, so every non-landing page matches the landing page's palette. The only file in this repo that's pure MkDocs theme chrome, unrelated to the landing page itself. |
