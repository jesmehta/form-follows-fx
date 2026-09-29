# Conversation log: Dance of Planets

Companion to [`DANCE-OF-PLANETS.md`](DANCE-OF-PLANETS.md) (what was
decided and built) — this is the reasoning and the actual exchange behind
it. The user's inputs are quoted verbatim in bold; typos kept. No code
here — that's in git history and the changelog.

## Part 1 — "I dont like the page still. Ask me questions." (2026-09-29)

The session opened on the v2.2 folder:

> **F:\__SnowCrash\__WebPages\DanceOfPlanets\dopv2.2
>
> I am ok woth the colours and controls per se, but I dont like the page
> still. Ask me questions.
>
> I also think the controls arent very self explanatory - I have come back
> to this proj after a while and even I am a little plussed, and I know
> what maps to what under the hood. A fresh viewer would be lost.
>
> I dont mind a complete rework of the page either. Is it git-tracked ? Is
> it part of a repo ?**

It was not git-tracked — no repo anywhere above `DanceOfPlanets/`. The
reply read the v2.2 code and listed concrete places a fresh viewer gets
lost (captured in `DANCE-OF-PLANETS.md`'s "What was wrong with v2.2"), then
asked eleven questions across purpose/audience, look and feel, controls,
and info/extras.

It also flagged a bug found while reading: planet angles computed as
`cos(ov * deg)` with `ov` the orbital *period*, so outer planets move
faster — backwards from real orbits.

## Part 2 — the brief

> **Ok, let's do this !
>
> This page - or the sketch behind it, without the html based dom, panels,
> etc - was made to visualise the Dance of Venus.
> Then I extended it to do all the planets, any 2 planets in combination.
>
> The page was initially meant as a tool to explore those realtionships,
> but also to appreciate the beauty of the resulting outcomes - the
> trails, the shapes, the harmonic spirographic art.
>
> At present, this will be a 2 page set - a page of captured visuals and
> some writing about the Dance of Venus + the coding, etc and this
> interactive page to play around for viewers.
>
> So the first question is - should this be a standalone repo, or should I
> put it inside fffx ?
>
> I agree with your "Where the fresh viewer gets lost" bit**

Answers to the questions, verbatim:

> **1. visitors to FFFX, and the rest of the site complex. Visuals may go
> out on social media, linking back to the page, etc
> 2. Not just ooh pretty though thats a good hook, but yes to the orbital
> ratios and make my own.
> 3. FFFX as described above**

> **4. 3 cols is fine - controls - canvas - data is ok. Density may be the
> symptom, the problem/my issue is exactly what we discussed above - the
> controls and info are not immediatly obvious, useful, etc. Hence it
> seems strange and dense.
> 5. Why not, it's a spacey page, an overlay over a full bleed canvas feels
> very HUD/spaceship window so works. Don't make it a cliched CRT Matrix
> Green etc though.**

> **6. I think plain language controls are necessary. Raw numbers can be
> part of the info display on the RHS but less prominent than say,
> planetary/orbital info, etc
> 7. No, maybe the settings are being set so continuously restarting will
> get annoying - at the same time, I would like things to be more
> responsive and not have to go to reset every time I make a change. Let's
> Discuss ?
> 8. Presets absolutely**

> **9. Yes, those work. What else is there though ?
> 10. Yes.
> - explainer text somewhere
> - shareable urls with encoded settings yes
> - colour, worth a try
> - svg export alongside PNG export
> - higher res - maybe, what is it currently and is it bad ?
> - a toggle for earth and venus, and the rest of the planets + sun,
> whatver the combination is active - showing visual representations
> instead of just the dots where they are - but this image/symbol/etc does
> not leave any trails
> 11. yes, again, maybe a toggle - this fulfills the same need as my planet
> visuals above**

And the documentation standard for the work:

> **Like other projects, keep the documentation updated, include all design
> decisions and design intent apart from just the technical changelog, and
> preserve parts of the conversation and my actual inputs (made bold)
> wherever relevant. Keep a todo list as well, and keep adding and checking
> off items as they get added/done**

### What was proposed back

- **Repo:** initially "inside fffx" — fffx already had a placeholder entry
  (`harmonics-dance-of-planets`) and page, and the decisive factor was that
  social links should land on the fffx domain rather than `github.io`.
- **Point 7 — the key idea:** the drawing is a pure function of its
  settings and progress, so a change can recompute the picture *up to the
  current progress* instantly, instead of either restarting or making the
  user press Reset. Settings split into three tiers (doesn't touch the
  drawing / changes the look → redraw at same progress / new pair → start
  over). Also: split the conflated "step size" into Speed and Detail.
- **Point 9, what else:** petal count from the ratio (13 − 8 = 5), synodic
  period, how exactly the cycle closes, live orbit counts, closest/farthest
  distance, raw numbers demoted.
- **Resolution:** the canvas is a fixed 800×800 — weak for print. Recompute
  off-screen at 2048/4096 and export SVG from the segment list; cap
  enormous cycles.
- **The bug:** explained — outer planets moving faster changes the shape
  (not the symmetry); already-posted images were made with swapped speeds.
- Seven decisions put to the user.

## Part 3 — decisions, and "look at Cabinet and Bookshelf"

> **Repo - I agree to putting it inside fffx, but do look at Cabinet and
> Bookshelf for how they handle internal and external content, and
> Cabinet's documentation for SOPs on this kind of decision.**

> **GIT - I would actually want v2, v2.1 to be present in the git and
> overwritten in the folder as the next version came in, preserves the
> versions I got directly from Claude AI etc. After that I agree with
> committing 2.2 and then updating that as we go.**

> **No other sessions in fffx, those are older WIP files. You deal only
> with Dance of Planets.**

> **7 - love it - recomputing for the new settings but at the current
> progress point is a great way to reconcile this.**

> **9 - ok yes**

> **resolution - agreed on the need, delivery and capping**

> **bug - interesting. I'd love a discussion on my code and this bug
> later. For now, implement your update, add the discussion into a todo
> for later.**

> **Decisions -
> 1. repo - discussed above in my reply, look at other repos, etc. Dont
> bother the other uncommitted bits.
> 2. keep toggle for now, will help me understand the difference
> 3. ok, c + orbit toggles
> 4. colour per planet pair will have 9x8 = 63 colours which i dont think
> is useful. single colour and time-gradient are useful. Default to single
> colour.
> 5. presets, ok.
> 6. keep current look for now.
> 7. p5 - what was your question ?**

(On 7: there was no real question — only the stated intent to keep p5 and
use its off-screen buffers for layers.)

### The SOP check changed the recommendation

Reading the sibling repos turned up Cabinet's written SOP
(`cabinet-multi-repo-assembly-concept-note-short.md` §7): *substantial
projects remain independent repositories and are assembled into the site at
deploy time*, reaching a proper local URL without living in the site repo —
eight projects already work this way in Cabinet. By its own criteria (own
source, history, docs, workflow) Dance of Planets is substantial, and the
domain argument that had favoured "inside fffx" is equally met by assembly.
Bookshelf, meanwhile, has a lighter in-repo pattern: `projects/<name>/`
copied into the site by a `deploy.yml` loop. fffx had neither mechanism.

The recommendation was revised to *own repo + assembly*, laid out against
*Bookshelf-style `projects/` in fffx*, and put to the user as a direct
choice. **Answer: `projects/` folder in fffx.**

Also verified before committing: version order by content rather than file
timestamps (the v2.2 zip's entries are dated before v2.1, but v2.2 is the
refinement).
