# fffx — Claude Code Prompt
## Design system, colour palette, typography, and ticker spec

Use this as the grounding prompt when building or editing the fffx landing page in Claude Code.
Do not blend any of this with the Bookshelf of Curiosities design system — fffx is a separate visual world.

---

## Context

`fffx` (form follows f(x)) is a Level 1 hub in the Cabinet of Curiosities ecosystem.
It hosts creative coding, generative art, p5.js experiments, algorithmic sketches,
plotter work, digital fabrication, and interactive web pieces.

The landing page lives at the root of the fffx repo as `index.html`.
Content data lives in `data.js` — the only file that should be edited to add, remove,
or reorder projects. The render engine (`render.js`) reads from `data.js` and builds the page.

---

## Colour palette

All values are CSS custom properties on `:root`. Never hardcode hex values in CSS rules.

```css
:root {
  /* Page and cell grounds */
  --bg:          #070708;   /* page background */
  --cell-base:   #0f0f11;   /* shallowest subdivision cell */

  /* Borders and structural lines */
  --border:      rgba(255, 255, 255, 0.06);   /* default cell border */
  --border-card: rgba(255, 255, 255, 0.12);   /* project tile border */
  --border-hover: #00d4ff;                    /* tile hover border */

  /* Text scale */
  --slate:  #52525c;   /* tertiary text, filler labels, inactive chips */
  --mid:    #6e6e7a;   /* secondary text, descriptions */
  --text:   #a0a0ae;   /* default body text */
  --bright: #ccccda;   /* section names, labels */
  --white:  #eeeef4;   /* tile titles, hero title */

  /* Accent */
  --cyan:   #00d4ff;   /* the single accent colour —
                          used for: hover borders, top-bar reveal,
                          chip-live text, ticker highlights,
                          section numbers, arrows, kicker text */

  /* Depth darkening — applied as rgba black overlays, not solid fills */
  /* Each subdivision child receives:
     background: rgba(0, 0, 0, 0.04 + depth * 0.045)
     This compounds through the DOM so deeper generations read darker.
     Do not use solid background colours per depth level.
     Do not use a lookup table of hex values.
     The formula is the only source of truth. */
}
```

**Palette rules:**
- `--cyan` is the only saturated colour on the page. Use it sparingly and consistently.
- All other UI is achromatic — grays, near-blacks, and white.
- No gradients. No glows. No box shadows except a 1px focus ring.
- Borders are always `rgba(255,255,255, low-alpha)` — never opaque dark lines.
  This keeps the borders readable against the dark ground at every depth level.

---

## Typography

Load via Google Fonts. Exactly these two families, no substitutions.

```html
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400&family=Space+Grotesk:wght@300;400;500;700&display=swap" rel="stylesheet">
```

| CSS variable | Family          | Role                                                                 |
|--------------|-----------------|----------------------------------------------------------------------|
| `--mono`     | IBM Plex Mono   | Everything by default — labels, tags, kicker, ticker, code fillers, metadata |
| `--sans`     | Space Grotesk   | Display only — hero title, tile titles, section name in header bar  |

```css
:root {
  --mono: 'IBM Plex Mono', monospace;
  --sans: 'Space Grotesk', sans-serif;
}
```

**Type rules:**
- Default `font-family` on `body` is `var(--mono)`. Everything is monospace unless explicitly overridden.
- `var(--sans)` is used in exactly three places: the hero `<h1>`, tile `<h2>` titles, and section name labels.
- The hero `f(x)` portion within the title uses `var(--mono)` italic — it is visually distinct from the Space Grotesk surroundings.
- No serifs anywhere. No Libre Baskerville, no Instrument Serif, no Fraunces.
- All uppercase labels use `letter-spacing: 0.28em` to `0.38em` depending on size.
- Minimum font size on the page: 5.5px (filler cell labels only). UI minimum: 6.5px.

### Type scale

| Element               | Family   | Size                        | Weight | Colour       | Other                        |
|-----------------------|----------|-----------------------------|--------|--------------|------------------------------|
| Kicker (header)       | mono     | 7.5px                       | 400    | `--cyan` @55%| `letter-spacing: .38em`, uppercase |
| Hero title            | sans     | `clamp(32px, 6vw, 84px)`   | 300    | `--white`    | `letter-spacing: -.025em`    |
| Hero title `.fx`      | mono     | same, italic                | 400    | `--cyan`     | italic within sans heading   |
| Hero subtitle         | mono     | 9px                         | 400    | `--slate`    | `letter-spacing: .07em`, `line-height: 1.95` |
| Ticker items          | mono     | 7px                         | 400    | `--slate`    | `letter-spacing: .28em`, uppercase |
| Ticker items (accent) | mono     | 7px                         | 400    | `--cyan` @38%| same, slightly dimmed cyan   |
| Section number        | mono     | 6.5px                       | 400    | `--cyan` @45%| `letter-spacing: .25em`      |
| Section name          | sans     | 7px                         | 500    | `--bright`   | `letter-spacing: .30em`, uppercase |
| Section desc          | mono     | 6.5px                       | 400    | `--slate`    | `letter-spacing: .10em`      |
| Filler cell label     | mono     | 5.5–6px                     | 400    | rgba(255,255,255, 0.08) | `// comment` format |
| Chip (category pill)  | mono     | 6.5px                       | 400    | `--slate`    | `border: 1px solid --border`, padding 3px 7px |
| Tile chip (live)      | mono     | 5.5px                       | 400    | `--cyan`     | `border: 1px solid rgba(0,212,255,.22)` |
| Tile chip (dormant)   | mono     | 5.5px                       | 400    | `--slate`    | `border: 1px solid --border` |
| Tile category         | mono     | 6px                         | 400    | `--slate`    | `letter-spacing: .20em`, uppercase |
| Tile title (s1)       | sans     | 12px                        | 500    | `--white`    |                              |
| Tile title (s2)       | sans     | 15px                        | 500    | `--white`    |                              |
| Tile title (s3)       | sans     | `clamp(16px, 1.8vw, 22px)` | 500    | `--white`    |                              |
| Tile description      | mono     | 8.5px                       | 400    | `--mid`      | `line-height: 1.5`           |
| Tile tag              | mono     | 5.5px                       | 400    | `--slate`    | `letter-spacing: .15em`, uppercase |
| Footer sig            | mono     | 7.5px                       | 400    | `--slate`    | `letter-spacing: .25em`, uppercase |

---

## Ticker / marquee band

The ticker is a full-width horizontal band between the header and the content field.
It scrolls all project names and topic terms in a seamless loop.

### HTML structure

```html
<div class="fffx-ticker">
  <div class="ticker-track" id="ticker"></div>
</div>
```

### CSS

```css
.fffx-ticker {
  overflow: hidden;
  border-bottom: 1px solid var(--border);
  padding: 8px 0;
  background: #080809;   /* slightly lighter than --bg */
}

.ticker-track {
  display: flex;
  white-space: nowrap;
  animation: tick 80s linear infinite;
}

.ti {
  font-size: 7px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--slate);
  padding: 0 1.5rem;
}

.ti.hi {
  color: var(--cyan);
  opacity: 0.38;
}

.ti-sep {
  font-size: 5px;
  color: rgba(40, 40, 48, 1);
  padding: 0 0.2rem;
}

@keyframes tick {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
```

### JS — how the ticker is built

Content is doubled so the loop is seamless (`translateX(-50%)` brings it back to start):

```js
const TICKER_TERMS = [
  'genuary 2026', 'vera molnár', '100 gradients', 'particle systems',
  'circle packing', 'flow fields', 'plotter work', 'combinatorics',
  'lissajous', 'noise fields', 'mandala', 'wrongways', 'windows of berlin',
  'digital fabrication', 'harmonics', '3d print', 'lasercut',
  'type transitions', 'inktober', '36 days of type', 'dance of the planets',
  'island generator', 'lenticular', 'p5.js', 'axidraw',
];

const doubled = [...TICKER_TERMS, ...TICKER_TERMS];
track.innerHTML = doubled.map(t => {
  const hi = t.includes('genuary') || t.includes('vera') || t.includes('p5');
  return `<span class="ti${hi ? ' hi' : ''}">${t}</span><span class="ti-sep">✦</span>`;
}).join('');
```

Accent terms (`hi` class) are those with particular significance — the ✦ separator
is always in `rgba(40,40,48,1)`, dim enough to read as punctuation not decoration.

---

## Grid background treatment (header only)

The header has a subtle grid overlay — this is the only place it appears.

```css
.fffx-header::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(90deg,
      transparent 0, transparent 47px,
      rgba(0, 212, 255, 0.016) 47px, rgba(0, 212, 255, 0.016) 48px),
    repeating-linear-gradient(0deg,
      transparent 0, transparent 47px,
      rgba(0, 212, 255, 0.016) 47px, rgba(0, 212, 255, 0.016) 48px);
}
```

Very low alpha (0.016). The grid should be barely perceptible — atmospheric, not decorative.
Do not apply this treatment to section fields or tile backgrounds.

---

## What not to do

- Do not use `Libre Baskerville`, `Instrument Serif`, `Fraunces`, `Playfair`, or any serif face
- Do not use the Bookshelf colour tokens (`--ink`, `--gold`, `--amber`, `--paper`, `--ivory`, etc.)
- Do not use ghost letter technique from the Bookshelf (`-webkit-text-stroke`, outlined letterforms)
- Do not use the Bookshelf card system (`.card`, `.card-ghost`, `.card-dormant`, `frameMood`, etc.)
- Do not use solid opaque borders — all borders are `rgba(255,255,255, low-alpha)`
- Do not use hardcoded hex values in CSS rules — always reference `var(--*)` tokens
- Do not use gradients, drop shadows, glows, or blur effects
- Do not add `cursor: none` unconditionally
- Do not put rendering logic in `index.html` or content data in `render.js`
- Do not create a `public/` folder — CI only
