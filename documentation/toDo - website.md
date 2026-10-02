# ToDo — Website

FFFX's technical, structural and visual work: the landing page, deployment,
and cross-world wiring. Created 2026-10-02, taking over the detailed "FFFX —
structure and deployment" section that used to live in Cabinet's
`toDo - website.md` (Cabinet keeps a one-line summary per item). Content
tracking is in `toDo - content.md`.

## Look and feel

- [ ] **Clean up FFFX's look and feel.** Your own note (Cabinet
  `scratchNotes.md`, "Next up"). Scope not yet defined — start with a review
  of the live landing page and one content page.
- [ ] **Deliberate phone version.** Part of Cabinet's three-world cellphone
  pass: audit the subdivision field and content pages at phone widths and
  design for them, rather than relying on shrinkage.
- [ ] **Re-check the layout after the WIP rebalance** (content todo): fewer
  cards and sections means a sparser subdivision field.
- [x] **WIP cards stay clickable** (decided 2026-10-02): muted cards still
  link to their placeholder pages. Bookshelf's alternative (unlinked
  dormant cards) was considered and not adopted for now.

## Cross-world and navigation

- [ ] **Add explicit return links to Cabinet and Bookshelf.** No cross-world
  destination in FFFX's `docs/` or content data (zero links to
  `cabinetofcuriosities.in`, confirmed 2026-09-16). Make sibling-world
  navigation visible on the landing page, and add FFFX-home links to
  standalone projects that don't inherit MkDocs navigation (once they are
  linked at all — see the `#147` gate in the content todo).
- [ ] **Decide whether `mkdocs-section-index` is needed yet.** Installed and
  pinned, but no nav section has an index page that uses it. Keep it only if
  near-term section hubs justify it.
- [ ] **Reconcile `WORLD-SYSTEMS.md` across all three repos** — one later
  pass, tracked in Cabinet's website todo. FFFX's copy still describes old
  asset paths and says Bookshelf uses `docs/index.md`.

## Tooling

- [ ] **Unify TSV parsing when next touching the editor.** The CLI generator
  (`build-fffx-content.js`) and the Admin Dash (`fffx-tsv.js`) parse
  separately; share validation so editor acceptance and production
  generation can't drift.

## Hygiene

- [ ] **Missing favicon.** `mkdocs.yml` points at `_images/favicon.svg`,
  which doesn't exist (noted in `FILE-MANIFEST.md`, still true 2026-10-02).
- [ ] **LF/CRLF warnings** on TSVs and generated JS at every commit; also
  `content/fffx-sections.tsv` shows as modified with no content change.
  Consider a `.gitattributes`.

## Done

- [x] **Strict build passes** — Circle Packing paths and YouTube link fixed
  (`351fb1f`), reverified 2026-09-16.
- [x] **Inherited `scifi asimov` deploy loop removed** (`d723f74`).
- [x] **Generic `projects/*/` copy step** (`e0226a8`, 2026-09-30), excluding
  each project's `documentation/` and `.md` files.
- [x] **Placeholder pages tracked** (`4ae8755`, 2026-10-02) — a clean clone
  now builds every route the landing page advertises.
- [x] **Deployment checks at Cabinet parity** (`2a16cb7`, 2026-10-02):
  generated-content drift check, strict build, `projects/*/` entry-point and
  collision checks, `tools/validate-deployment.js`. To run it locally,
  assemble `public/` the way `deploy.yml` does (into a temp dir, not the
  repo) first — on a bare checkout it reports every href as missing.
- [x] **`projects/` documented** in README and FILE-MANIFEST (`5f27d3d`).
