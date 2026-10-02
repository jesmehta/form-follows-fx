# ToDo — Content

FFFX's content and project tracking: what is on the landing page, what is
hidden, what every section and card means, where it came from, and what
happens next. Created 2026-10-02, taking over the detailed "FFFX — verified
content audit" that used to live in Cabinet's `toDo - content.md`. Same
structure as Bookshelf's `documentation/toDo - content.md`.

**How the three levels fit together**

- **Cabinet's `toDo - content.md` / `toDo - website.md`** — the single
  scannable point of contact across all worlds. FFFX gets one short cluster
  there, each line pointing back here.
- **This file + `toDo - website.md`** — the detail for FFFX.
- **Each project's own docs** (`projects/*/documentation/`) — fine-tuning and
  future work that does not block launch. Not duplicated here; the registry
  just points at them.

**Registry rule:** every section and card on the landing page has a row below
saying what it means and where it came from. Anything whose origin or meaning
is unknown is marked **Unexplained** — confirm or remove it rather than
leaving it to cause confusion later. Every current section and card traces
back to the original FFFX brief (2026-06-29, recorded in
`landing-page-notes/conversation-landing-page-notes.md`): your sketch-folder
names (`__Genuary`, `__100 Gradients`, `__Recreating the past`, `_Circle
Packing`, `_Image Filters`, `_Flow Fields`, `_Perlin Noise`, `_Harmonics`,
`_Combinatorics`, `_Particle Systems`, `__Windows of Berlin`), the content
inventory in the brief ("plotter work, digital fabrication, and more"), and
"my older Processing pde files… that I am not touching yet". The three
external entries are your own SSD teaching tools/galleries.

**Status vocabulary:** live (`true`, clickable) · WIP (`wip`, visible and
still clickable, muted, opens the placeholder page) · hidden (`false`, kept as
a roadmap row) · idea (no TSV row yet). WIP cards are meant for things close to
done — a reminder and a promise, not padding. Bookshelf's working rule: well
under a quarter of the page as WIP, relaxed while there are only a few live
cards (it settled at 4 live / 3 WIP). **FFFX is at 5 live / 13 WIP (72%), and
only 2 of the 5 live cards are FFFX's own pages** — see *Content order*.

**Gate — protect code (`#147`):** some tools are finished but their source
should not be published openly until the private-source architecture is
decided (GitHub Pro / Cloudflare Workers; Cabinet's `toDo - immediate.md`,
`#147`). Gated work gets no new landing/TSV/nav wiring until then. Repos are
public today, so the gate limits promotion, not visibility of existing code.
Gated: Mandala Generator (incl. Cabinet's Dot Mandala Tool), Lenticular,
Dance of Planets, Island Generator, Live Webcam Filters.

## Sections

Source: `content/fffx-sections.tsv`. All eleven are on (`true`).

| Section | Status | Cards | Notes |
|---|---|---|---|
| Prompt Collections | live | Genuary (WIP) | Only-WIP section. Pages live under `docs/prompt-collections/`. |
| Deep Studies | live | 100 Gradients, Particle Systems (both WIP) | Only-WIP section; both cards marked *Later*. |
| Recreating the Past | live | Vera Molnar (live) | |
| Tools & Libraries | live | Circle Packing Library, Prompt Generator, Oblique Strategies (live) · Mandala Generator, Lenticular, Dance of Planets (WIP) | All three WIP cards here are behind the code gate. |
| Generative Projects | live | Windows of Berlin (WIP) | Only-WIP section. |
| Image Experiments | live | Image Filters (WIP) | Only-WIP section. |
| Sketch Families | live | Flow Fields, Perlin Noise (both WIP) | Only-WIP section. |
| Plotter & Fabrication | live | Plotter Work (WIP) | Only-WIP section. Its page folder is `docs/physical-outputs/`, not a folder matching the section id. |
| Code to Objects | live | Code to Fabrication (WIP) | Only-WIP section. Same `docs/physical-outputs/` folder as above. |
| Legacy Processing | live | Legacy Processing Archive (WIP) | Only-WIP section. Same `order` (100) as Student Work. |
| Student Work | live | SSD Creative Coding 2025–26 (live, external) | |

Eight of the eleven sections hold only WIP cards.

## Cards

Source: `content/fffx-entries.tsv`. "Your call" is from 2026-10-02.

| Card | Section | Status | What it is | What exists | Your call | Next |
|---|---|---|---|---|---|---|
| Vera Molnar | Recreating the Past | live | Code-driven homage/study of Vera Molnar's work | `docs/recreating-the-past/vera-molnar.md`, ~322 words, in nav | — | **Add the images** — only the writeup is up so far (2026-10-02). Cabinet's duplicate retired with a redirect. |
| Circle Packing Library | Tools & Libraries | live | Circle packing with code, "from Bookclubs to Libraries" | `docs/tools-and-libraries/circle-packing-library.md`, ~940 words, in nav | — | Done. Sole maintained copy (Cabinet's duplicate redirected, `b667bc2`); Cabinet WebTech cross-links here. |
| Prompt Generator | Tools & Libraries | live (external) | Prompt generator for SSD students | `jesmehta.github.io/PromptGenerator/` | — | Content maturity not re-audited. |
| Oblique Strategies | Tools & Libraries | live (external) | Brian Eno's Oblique Strategies randomiser | `jesmehta.github.io/ObliqueStrategies/` | — | Content maturity not re-audited. |
| SSD Creative Coding 2025–26 | Student Work | live (external) | Selected student work from the 2025–26 batch | `jesmehta.github.io/SSD_Student_Work/…2025-26/` | — | Current year's gallery; update the href each new batch. |
| Genuary | Prompt Collections | WIP | Daily prompt sketches for the January challenge; a growing collection | Placeholder page (~60 words). Lots of work and generated images exist. | **Next up** | Review the work, then a gallery + writeup: a curated initial selection, designed for later additions without implying it will ever be closed. |
| 100 Gradients | Deep Studies | WIP | Generated colour fields; a growing study | Placeholder page. Roughly twelve gradients exist. | **Later** — can be published as ongoing | Review, then gallery + writeup of the existing works as a first tranche; don't wait for all 100. |
| Particle Systems | Deep Studies | WIP | Particles, motion, emergent behaviour | Placeholder page (~42 words). No real work yet. | **Later** | Parked. |
| Mandala Generator | Tools & Libraries | WIP | Dot-mandala pattern tool | Placeholder page. The same project as Cabinet's live Dot Mandala Tool (WebTech). | **Done but protect code** — gated (`#147`) | The gate covers Cabinet's live Dot Mandala Tool too (2026-10-02): it may stay on Cabinet's page, but goes behind the gate once the gate exists. Earlier call (Cabinet audit): Cabinet/WebTech is canonical, so this FFFX portal becomes a cross-link or goes, not a second write-up. |
| Lenticular Image Generator | Tools & Libraries | WIP | Tool interleaving 2–4 images into lenticular composites (or a mouse-driven demo) | Placeholder page (~38 words). Code nearly done; DOM controls remaining. | **Next up, protect code** — gated (`#147`). A project *tool*, not a gallery. | Finish the tool and its controls; the page (embed, examples, copy) is part of finishing it. Publication waits on `#147`. |
| The Dance of Planets | Tools & Libraries | WIP | Orbital-harmonics drawing tool (formerly Dance of Venus) | v3.0 at `projects/dance-of-planets/`, deployed at `/dance-of-planets/` but unlinked. Placeholder page (~48 words) predates the tool and doesn't link to it. | **Done but protect code** — gated (`#147`) | Writeup + wiring after `#147`. Project todos: `projects/dance-of-planets/documentation/TODO.md`. |
| Windows of Berlin | Generative Projects | WIP | Generative study of Berlin's windows/facades from your photographs | Placeholder page. Substantial work exists; needs sketching before more coding. | **Next up** — gallery, needs some work | Better exports and animated GIFs, a selected sequence, explanatory text around the existing work. |
| Image Filters | Image Experiments | WIP | Pixel-level filter experiments; a growing project (static gallery, live upload, webcam) | Placeholder page. Substantial work exists. The live-webcam version is a separate, gated project (see Ideas). | **Next up (mid)** — gallery, needs fresh exports + writeup | Fresh exports, curated into an initial gallery with a writeup of the approaches; publish as an extensible collection. |
| Flow Fields | Sketch Families | WIP | Sketch family built on vector/flow fields | Placeholder page (~50 words). Existing experiments, not collected. | *(no call)* | Locate and curate the experiments; articulate what connects the family. |
| Perlin Noise | Sketch Families | WIP | Sketch family using noise as a generative driver | Placeholder page (~53 words). Existing experiments, not collected. | *(no call)* | As Flow Fields. Island Generator grew out of 2020 Perlin contour sketches — a possible link. |
| Plotter Work | Plotter & Fabrication | WIP | Pen-plotter drawings generated from code | Placeholder page (~42 words). Outputs not collected; plotter unused for a while. | *(no call)* | Collect outputs, choose examples, explain code → process → result. |
| Code to Fabrication | Code to Objects | WIP | Code-driven outputs made physical (laser-cut, 3D print) | Placeholder page (~52 words). Outputs not collected. | *(no call)* | As Plotter Work. |
| Legacy Processing Archive | Legacy Processing | WIP | Older Processing (`.pde`) sketches, acknowledged but untouched | Placeholder page (~64 words). | **A clean-up project more than a showcase** | Not landing-page material as a showcase; candidate to hide (`false`) and track as clean-up work. |

**Not on the landing page (gated):**

| Project | What exists | Your call | Next |
|---|---|---|---|
| Island Generator | v5.8.1 at `projects/island-generator/`, deployed at `/island-generator/` but unlinked. No TSV row or page. | Not on the website for now — gated (`#147`) | After `#147`: TSV row, decide on a narrative page, examples, live/device/export checks. Project todos: `projects/island-generator/documentation/TODO.md`. |

**Removed cards:** none yet. Record any removal here (with its commit) so it
doesn't come back by accident.

**Other landing-page text:** the hero ("Creative coding, generative systems,
algorithmic studies, and interactive sketches.") and the decorative filler
cells (glyphs like `f(x)`, `Σ`, and code fragments like `noise(x, y)` in
`fffx-layout.js`) are generic and refer to no specific work, so they need no
registry rows.

## Ideas (no card yet)

*Ideas below with a stated form (gallery / writeup / tool) were confirmed by you on 2026-10-02.*

| Idea | What it is | Notes |
|---|---|---|
| Combinatorics | The whole umbrella of your combinatorics visuals (`_Combinatorics` sketch folder) — "lots of outputs" | Confirmed 2026-10-02. In your 2026-06-29 inventory under "Other stuff I can't classify as such because it was all exploratory, but lots of outputs". A candidate for the Math Art section below. Not tracked anywhere else. |
| Noise fields | Exploratory noise-field sketches | From the same 2026-06-29 exploratory list. Overlaps the Perlin Noise card — decide whether it folds in there. Not tracked anywhere else. |
| Games | "Some games" made in code | From the same exploratory list. Not tracked anywhere else; what they are is not yet written down. |
| **Math Art** (section idea) | A section extracted from the exploratory work | Your 2026-06-29 note: "MathArt and Patterns in Nature can be two more sections extracted from these". Patterns in Nature is now covered by BioMimicry × Code. Candidates: Combinatorics, Harmonics/Dance of Planets, Truchet Tiles, Menger cube. Not tracked anywhere else. |
| WrongWays / Wronglines | Named in the brief's content inventory | Never got a card. |
| BioMimicry × Code | Code imitating nature: flocking, Brownian deposition, differential growth, reaction–diffusion, phyllotaxis (also physarum, L-systems, cellular automata, agent-based growth, Voronoi) | From Cabinet's `scratchNotes.md` ("Add BioMimicry x Code to FFFX"). Also tied to the possible Biomimicry elective in Cabinet's content todo. |
| Crystal Deposition Variations | Code mimicking crystalline mineral forms | Part of BioMimicry × Code (nature × code). Needs fresh exports. |
| Live Webcam Filters | Real-time webcam version of the image filters | **Gated (`#147`)** — code to be protected. Ready, but currently inside Student Work; needs pulling out of there. |
| 4-Bar Fringe | Interference-fringe / stop-motion effect | Gallery + writeup. |
| Photopixels | Portraits made from scanned physical objects (beans, bottle caps, fabric, fingertips…) | Gallery; needs some exports. |
| Type Transitions | Letter-pair transitions (HI, NZ, WM, AV…) | Gallery; needs some review. |
| Truchet Tiles — Super-Ellipse | Truchet tiling with super-ellipse tiles | Gallery + writeup. |
| Circle packing plays | Circle packing as buttons (Coraline-style), with typographic letters, etc. | Needs work. Could sit alongside the live Circle Packing Library card. |

## Content order

- [x] Circle Packing repaired, strict build verified (`351fb1f`); sole copy
  (`b667bc2`).
- [x] Placeholder pages tracked, so WIP cards no longer 404 (`4ae8755`).
- [ ] **Rebalance the WIP share.** 13 WIP to 5 live is far past Bookshelf's
  rule. Keep WIP only for the *Next up* cards (Genuary, Windows of Berlin,
  Image Filters) plus anything you'll pick up in days; set the rest to
  `false`, with these rows kept as the roadmap. The gated cards (Mandala,
  Lenticular, Dance of Planets) are candidates for `false` until `#147`
  anyway. Turning cards off empties whole sections, so hide the emptied
  sections too, then check the subdivision layout still looks full.
- [ ] Genuary: curated initial collection, designed to grow.
- [ ] Windows of Berlin: exports, GIFs, sequence, text.
- [ ] Image Filters: initial curated page, extensible.
- [ ] Lenticular: finish code and controls (publication gated).
- [ ] Mandala Generator: cross-link or remove this card (Cabinet canonical);
  put the Cabinet tool behind the gate once `#147` lands.
- [ ] Vera Molnar: add the images to the live writeup.
- [ ] Live Webcam Filters: pull the ready code out of Student Work into its
  own (gated) project.
- [ ] Legacy Processing Archive: move out of the showcase; track as clean-up.
- [ ] Inventory Flow Fields, Perlin Noise, Plotter Work, Code to Fabrication
  — the work exists but isn't collected or explained.
- [ ] Confirm or remove any **Unexplained** idea rows above (none as of
  2026-10-02).
- [ ] Add a section hub only where it helps orientation; don't activate thin
  categories just because TSV rows exist.
- [ ] Add thumbnails/stills to entries as part of publication, not as a later
  clean-up wave.
- [ ] After `#147`: Dance of Planets and Island Generator wiring, pages,
  examples, live/device checks.
