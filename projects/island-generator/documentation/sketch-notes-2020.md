# Island Generator — original sketch notes (2020)

Everything the user wrote in the seven original p5.js sketches (Feb–Mar
2020), pulled out of the code so it can be read without the code. The
sketches themselves are in git history under `projects/island-generator/`
(commits `b1ce876` v1.0 → `80fa45d` v4.3); sources were
`_temp/Perlin Contour v*/sketch.js`.

Notes are quoted verbatim, typos kept. Annotations in *italics* are
added in 2026 and are not part of the original.

## The v4.3 header block (7 Mar 2020)

The only long-form note. Quoted in full:

> Notes :
> - Isle factor eliminated and brought back.
> Initially used to focus landmass as an island,
> now with changed "point of origin" that the distances are measured from,
> i.e island high points are at 1/3 width and height instead of centre
>
> - When unused, was used to map 0-255 of thre max height, usually 150 was good, so hardcoded
>
> - value of t, the Perlin increment, gives interesting variations
> ranging from very smooth to chaotic
>
> - colour version was attempted, and works,
> switching between colour and BW did not work
> Col version looks like thermal imaging.
>
> - To Do - Update the draw loop to
> a. Make as many functions as possible
> b. Only re-Draw canvas when updates are needed else it's wasteful on processing power
> b2. Some things can be computed in setup and maintained
> (all things can be, but then no live updates)
>
> c. Mouse-click to Island focus ?
> d. Islanding was interesting when using distance from an edge as well, instead of points
> e. Multiple islands when clicked, and distance from the nearest is used in IsleElev

*Two of these findings have a cause that was found in 2026:*

- *"usually 150 was good": the sketch runs in `colorMode(HSB)`, where
  `color(f)` with one argument treats `f` as brightness out of **100**,
  not 255. So a maximum of 150 turns roughly the top third of elevations
  pure white. The "good" look included flat white summits.*
- *"switching between colour and BW did not work": the toggle set
  `fillFlag = TRUE`. `TRUE` is not defined in JavaScript (it should be
  `true`), so the sketch threw an error there.*

## To-do list, extracted

| # | Item (original wording) | Status in the new page |
|---|---|---|
| a | Make as many functions as possible | *Done in v5.0: `model.js`* |
| b | Only re-Draw canvas when updates are needed | *Done: tiered redraw on change* |
| b2 | Some things can be computed in setup and maintained | *Done: field cached; sea level and bands recolour it* |
| c | Mouse-click to Island focus ? | *Done: click, drag, double-click* |
| d | Islanding … using distance from an edge as well, instead of points | *Done: Coast shape (land rises towards one side)* |
| e | Multiple islands when clicked, distance from the nearest used in IsleElev | *Done: generated + clicked centres, nearest counts* |
| — | Colour/BW switch (from the notes) | *Done: Thermal style + 2020 colours toggle* |

*Progress on these is tracked in [`TODO.md`](TODO.md).*

## Inline comments, by version

Only comments that carry intent are listed. Commented-out code is noted
where it shows an experiment.

**v1.0 (12 Feb 2020)**
- `// y0 = 0;     //comment this out to allow change`: leaving it out
  lets the field drift frame to frame.

**v2.0 banding (21 Feb 2020)**
- `let b;                    //no of bandgaps`
- `// let pd;                   //pixel Density`: never used.

**v2.2 banding mouseX (22 Feb 2020)**
- `y0 = 0;` is now active, so the map holds still and mouseX changes only
  the band count.

**v3 sealevel (22 Feb 2020)**
- `let elev;                 //exponent for sealevel`
- On `map(f_, b/3, b, 0, 255)`:
  > //mapping 2-b instead of 0-b as source domain also creates easy oceans
  > //advanced version - b/3 - b - 1/3 of full elevation is underwater

**v4.0 islands (22 Feb 2020)**
- `// e = (1 + e - d) / 2`: the island formula (as in Red Blob Games'
  "Making maps with noise").
- `// elev = 1.7;` and `// b = 12;`: hardcoded values the user liked,
  kept as comments.

**v4.2 islands cleaned (22 Feb 2020)**
- Per-step labels: `//generate noise`, `//exponent to elevate`,
  `//island-ification`, `//banding`, `//map fill`, `//set fill`.
- Sliders: Bands 2–20 (default 15), Elevation exponent 0.1–5,
  Island factor 0.1–3.

**v4.3 nonIsland cleaned (7 Mar 2020)**
- Canvas `420 × 594`: A-series proportion (1 : √2).
- `// let maxElev = slIsle.value();` → `let maxElev = 150;` and
  `// slIsle = createSlider(0,255,150,1);`: the slider was repurposed
  from max elevation back to island factor. The label still reads
  "Max Elevation (255)" until the first frame overwrites it.
- `// isl = n;`: the non-island variant, one line away.
- Colour branch (commented out): `map(fb,0,b,0,360)` → `color(f,100,100)`,
  i.e. band → hue at full saturation. This is the "thermal" look.
- `newRandom()`: New Scape moves the noise origin to `random(0,20)`
  rather than reseeding.
- `createP("key s to save file")`: *the key handler compares against an
  undefined `s`, so any keypress throws.*
