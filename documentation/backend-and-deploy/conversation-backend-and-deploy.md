# Conversation log: Backend & Deploy

Companion to [`BACKEND-AND-DEPLOY.md`](BACKEND-AND-DEPLOY.md), same
relationship every other conversation-log doc in this repo has to its
tier-2 pair. Per the standing rule this repo borrows from Cabinet's
`DOCUMENTATION-GUIDE.md` — "if it doesn't have a place to live, it lives
in this doc" — new backend/deploy/site-wide topics with no single owning
page become a new `# Part N` here, not a new file.

Recorded from a live transcript — direct quotes are verbatim, not
reconstructed. No code, commands, or diffs here — those are in git
history and in `BACKEND-AND-DEPLOY.md`'s own changelog.

# Part 1 — the `docs/` + `documentation/` reorg

## "in the same manner as we reorganized the cabinet folder"

Opened as a direct request to replicate a known pattern, not to design a
new one:

> **give me a step by step plan of reorganizing the form-follows-fx
> folder and its doc subfolder in the same manner as we reorganized the
> cabinet folder and its doc subfolder**

Answered by actually reading what Cabinet's reorg *was*, not assuming
from the commit titles — `git show --stat` on both `7447a0b` (the
`docs/` content-vs-system split) and `cfc2ef8` (the `documentation/`
per-feature reorg) to see the real before/after file moves, plus
`DOCUMENTATION-GUIDE.md` itself for the convention behind the second one.
Cabinet's own `docs/` tree, FFFX's own `docs/` tree, and FFFX's
`mkdocs.yml` `extra_css`/`extra_javascript` block were all checked
directly against the real files rather than assumed from memory, since
the two repos' actual asset layouts turned out to matter for how closely
the mapping could follow Cabinet's shape (FFFX has no separate
"hand-edited theme extras vs. three pipelines' machine output" split
the way Cabinet's `backend/` bucket does — everything here is one
subsystem, the landing engine).

The resulting plan named two decisions as open rather than assumed: a
tier-3 conversation-log doc (Cabinet has one per feature; FFFX has none,
and shouldn't get one fabricated after the fact), and Cabinet's larger
meta-doc suite (`FILE-MANIFEST.md`/`DOCUMENTATION-GUIDE.md`/
`CONTENT-INVENTORY.md`/`AI-DEPENDENCY-AUDIT.md`) — recommended skipping
both for now, flagged for later.

## "go ahead with phases 1-3"

> **go ahead with phases 1-3
> we can discuss the 2 open points later, as well as the state of the
> current documentation present in the folder**

Executed in the order the plan proposed, verified at each boundary rather
than only at the end. Phase 1: a `pre-reorg-fffx` tag (matching Cabinet's
own `pre-file-reorg` naming), plus a baseline `mkdocs build --strict` run
specifically to capture the repo's *pre-existing* failures (13
nav-missing pages, 6 broken image-link-depth warnings in
`circle-packing-library.md`) so the reorg's own verification couldn't
later be confused by problems that predated it. Phase 2 (`docs/` split)
was committed and independently verified — byte-identical rebuild,
identical warning count, a live Admin Dash check — before Phase 3
(`documentation/` reorg) started, so a problem in either move couldn't be
mistaken for the other's.

One real mistake happened during Phase 2's reference-fixing pass: an
`Edit` meant to leave a line alone instead inserted a stray, nonsensical
`# placeholder` fragment into `LANDING-PAGE-NOTES.md`. Caught immediately
on the next read and reverted in the following action, before it was ever
staged or committed.

`WORLD-SYSTEMS.md` was deliberately left untouched through both phases,
even though its fffx-specific path descriptions became stale the moment
`docs/assets/` stopped existing — it's hand-synced byte-for-byte across
Cabinet/Bookshelf/fffx, and Cabinet's own `BACKEND-AND-DEPLOY.md` records
the identical reasoning for its own repo's divergence: editing the shared
doc from one repo's perspective mid-reorg risks treating "most recently
edited" as "correct" instead of an actual three-way reconciliation
decision.

## "tell me about the two deferred points"

Once both phases landed:

> **tell me about the two deferred points**

Answered by re-explaining each decision's actual reasoning rather than
just restating the earlier recommendation — the tier-3 doc's real
constraint (don't fabricate a narrative that doesn't exist, but a real
one *can* be written from an actually-available transcript, which this
session's own conversation is), and the meta-doc suite's real threshold
(FILE-MANIFEST.md earns its keep once a `documentation/` tree gets large
enough that a listing alone stops being enough — not yet, at four files
across two folders).

## "do write the conversation... do make one"

> **yes, do write the conversation for the editor and reorg
> file manifest is always useful since it also describes not just the
> documentation but other code files and their functions, allowing
> someone to know where to look when they're hunting for something or
> needing an overview. do make one.**

Settled both deferred points at once, in the opposite direction from the
default recommendation on `FILE-MANIFEST.md` specifically — the
description of what it should cover ("not just the documentation but
other code files and their functions") matched Cabinet's actual
`FILE-MANIFEST.md` precisely once checked against it directly (it already
covers `tools/`, `content/`, `docs/`, every subsystem's code, not just
`documentation/`'s own contents) — this file, this repo's own
`FILE-MANIFEST.md`, and the sibling `conversation-fffx-editor.md` are the
direct result.
