# Conversation log: FFFX Admin Dash

Companion to [`FFFX-EDITOR.md`](FFFX-EDITOR.md) (mechanism, routes, files,
update workflow) in the same relationship `conversation-cabinet-editor.md`
has to `CABINET-EDITOR.md` in the Cabinet repo — that's the reference,
this is the reasoning behind it.

Recorded from a live transcript — direct quotes are verbatim, not
reconstructed. No code, commands, or diffs here — those are in git
history and in `FFFX-EDITOR.md`'s own changelog.

## "give me a status summary of fffx and bookshelf"

The thread opened with a status check, not a build request:

> **It has been a while since I touched FFFX and Bookshelf. Cabinet
> itself has moved ahead by leaps and bounds in the meantime.
> - give me a status summary of fffx and bookshelf
> - a plan for both - although they are already live and kicking quite
> well
> - I believe i need TSV editors for both
> - similar to cabinet, but not as much complexity - can the rebuild
> scripts etc be tied to buttons on an admin page that is part of the tsv
> editor or a separate admin page if needed
>
> But firt just the status**

The status pass read both repos' git logs, their `tools/build-*-content.js`
scripts, and their actual `content/*.tsv` headers directly rather than
trusting an old memory of the schemas — confirming both repos already had
a working TSV → generated-JS pipeline but no editor UI at all, unlike
Cabinet's `cabinet-tsv.js`/`cabinet-editor.js`/`cabinet-editor-ui/` +
`admin-controls.js` pair.

## "can there be a single admin page"

The status reply repeated back Cabinet's own reason for splitting its
editor server from its admin-controls dashboard (avoiding re-implementing
two already-existing servers' TSV logic a second time). That got
questioned directly:

> **But can there be a single admin page that doe the build-rebuild as
> well as have the TSV section and entries editor on separate tabes etc
> ?**

Checked against the actual reason for Cabinet's split, not just its
existence: Cabinet split because `now-editor.js` and `cabinet-editor.js`
already existed as separate legacy servers before `admin-controls.js` was
added on top. FFFX and Bookshelf have no such pre-existing servers to
avoid duplicating, so the reason for the split doesn't transfer — a
single unified server with tabs was recommended instead.

## "Tell me about this as well" — the shared-engine-vs-copy tradeoff

A prior turn had flagged, but not resolved, a real open question: given
how closely Cabinet/Bookshelf/fffx's `entries` schemas converge, was a
shared editor engine with per-repo config more justified than three
separate copies? Asked directly to expand on it rather than just decide:

> **Tell me about this as well**

Answered by actually re-deriving the schema overlap from each repo's real
TSV headers, not from memory: 10 of 15 entry columns identical across all
three (`id, title, subtitle, href, section, kind, status, order, tags,
location`), Cabinet and fffx near-twins beyond that, Bookshelf diverging
further with presentation-specific fields. Sections schemas diverge much
more — Cabinet's carries 18 columns of `squarify()`-computed geometry
neither other world has an analogue for. Recommendation: a shared
*entries* engine might be justified, but *sections* shouldn't be forced
into one shape just because one of three repos needs geometry.

## "each repo... its own separate TSV editors"

> **i think i want each repo to have its own separate TSV editors. They
> can be based off one another, but I dont need to hold them identical.
> Also, since its 3 different repo folders on my local, managing thier
> local paths will be another issue, i guess ?**

This settled the shared-engine question in favor of three independent,
freely-diverging copies. The local-paths concern turned out to be a
non-issue once traced through: Cabinet's own editor already resolves its
root via `path.resolve(__dirname, "..")`, relative to the script's own
location, not a hardcoded absolute path — copying that pattern means
FFFX's and Bookshelf's editors are self-contained regardless of where on
disk each repo folder sits. The one real cross-repo consideration flagged
back: distinct default ports, so more than one editor could run at once
without colliding.

## "final call" — one page or two

> **final call on - one page with admin + editro pages ? Pros and cons
> ?**

A fuller pros/cons table was given for both shapes, landing on a
recommendation for one page specifically because FFFX/Bookshelf lack the
legacy-server reason Cabinet's split was actually built to solve.

> **Yes, go with one page**

Locked in the architecture: one server per repo, three tabs (Sections /
Entries / Build), distinct ports, no shared engine.

## Plan-mode: two questions about the subdivision itself

Once in plan mode — after reading Cabinet's actual `cabinet-tsv.js`,
`cabinet-editor.js`, and `cabinet-editor-ui/` source in full, and both
`build-fffx-content.js`/`build-bookshelf-content.js` in full — a draft
plan was interrupted twice with questions about FFFX's rendering, not the
editor:

> **does fffx need it's rectangular subdivision revisited every time new
> entries and sections are added or is that built in already?**

Answered by reading `fffx-subdivision.js`/`fffx-layout.js` directly:
the subdivision is computed live in the browser from current
entries/sections/`weight` on every page load, with no stored geometry —
confirmed by the schema itself (`fffx-sections.tsv` has no
`cx`/`cy`/`rx`/`ry` columns the way Cabinet's does). Nothing for the
editor to expose or recompute.

> **so how does the on the go subdivision affect user page load ?
> considering the layout changes only when new entries are added, isnt
> it redundant to layout the page everytime afresh ? what are the
> advantages to this ?**

Answered with real numbers, not a general argument: 18 entries, 11
sections at the time — sub-millisecond arithmetic, even re-run on every
`resize` event. Three concrete reasons live computation beats caching
were given (responsive-by-necessity, since a cached layout would still
need one version per breakpoint; no invalidation bugs, the exact failure
mode Cabinet's own cached `map` geometry can hit; and a deliberate `rng`
parameter meaning the split is meant to vary per load, which a fixed
cache would remove). One honest cost flagged: the resize listener isn't
debounced, fine at today's scale, worth watching if the entry count grows
into the hundreds.

Neither question changed the plan — both confirmed the Sections/Entries
tabs needed no geometry-editing feature, which the plan already didn't
include.

## Build and verify, then naming and commit

Once the plan was approved, FFFX's copy was built first (closer to
Cabinet's schema, no TSV-content quirks), verified end-to-end against the
real content files — a section-title edit and revert produced a
one-line-then-zero `git diff`, "Rebuild content" matched the CLI build
byte-for-byte, "mkdocs check" correctly surfaced 6 real, pre-existing
`--strict` warnings unrelated to this work. Bookshelf's copy followed,
adapted for its `span`/`kicker`/`displayTag`/`ghost`/`titleVariant` fields
and — the one schema-specific risk worth a dedicated check — its literal
`<br>` and quote characters as real cell content, verified by round-
tripping the `scifi` row's actual data (which contains both) and
confirming a zero `git diff` afterward.

The close of this thread:

> **Call the the xyz - Admin Dash, not Ledger. And yes, please, document
> and commit.**

*(the message repeated the naming instruction a second time in the same
turn, quoted here once; both repos' UI titles were renamed from "Ledger"
to "Admin Dash," `FFFX-EDITOR.md` and `BOOKSHELF-EDITOR.md` were written
per the four-tier documentation standard, and each repo's work was
committed separately, since they're independent git repos.)*
