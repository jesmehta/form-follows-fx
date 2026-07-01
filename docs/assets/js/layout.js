import { landingConfig, entries, sections } from "./data.js";
import { seededRandom, pickFromId } from "./random.js";
import { buildRectTree, getCandidateRects, assignEntries } from "./subdivision.js";

const field = document.querySelector("#subdivision-field");
const sectionMenu = document.querySelector("#section-menu");

// Built once, not per render(): the set of sections that ever appear
// (enabled + at least one visible entry) doesn't change without a code
// edit, only their on-page *position* does. Each button looks up its
// anchor by id at click time (not at attach time), so it always finds
// whichever anchor the current render() pass created.
function buildSectionMenu() {
  const visibleSectionIds = new Set(entries.filter(e => e.status !== false).map(e => e.section));
  const menuSections = sections.filter(s => s.status !== false && visibleSectionIds.has(s.id)).sort((a, b) => a.order - b.order);

  sectionMenu.innerHTML = menuSections.map(s =>
    `<button type="button" data-section-id="${s.id}">${s.title}</button>`
  ).join("");

  sectionMenu.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const anchor = document.getElementById(`section-anchor-${button.dataset.sectionId}`);
      if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// One fresh random component per page load (module scope = evaluated
// once when the script first runs), not per render() call. That keeps
// resize/breakpoint changes stable *within* a load — the tree only
// reshapes because of the new loadSeed, not because resizing itself
// re-rolls anything — while every full reload gets a genuinely new
// subdivision. entry.order/weight still drive assignment exactly as
// before; only the split-ratio randomness changes per load.
const loadSeed = Math.random().toString(36).slice(2);

const GLYPHS = ["+", "*", "×", "∘", "~", "f(x)", "sin", "noise", "p5", "Σ"];
const CODE_FRAGMENTS = [
  "noise(x, y)", "sin(t * 0.02)", "for (let i = 0...)",
  "lerp(a, b, t)", "x += dx", "map(v, 0, 1)", "depth++"
];

const FILLER_TREATMENTS = [
  "plain", "plain", "plain",
  "hatch", "hatch",
  "dots",
  "glyph",
  "code",
  "coord",
  "gradient"
];

function fillerContent(treatment, rect, rng) {
  switch (treatment) {
    case "glyph":
      return `<span class="fffx-cell-mark fffx-cell-glyph">${pickFromId(rect.id, GLYPHS)}</span>`;
    case "code":
      return `<span class="fffx-cell-mark fffx-cell-code">${pickFromId(rect.id, CODE_FRAGMENTS)}</span>`;
    case "coord":
      return `<span class="fffx-cell-mark fffx-cell-coord">${Math.round(rect.x)},${Math.round(rect.y)}</span>`;
    default:
      return "";
  }
}

// v2.0 phase 4: every rect carries a `sectionId` (inherited from its
// section's root — see buildRectTree() in subdivision.js), so the
// structure layer now tints by section instead of the old warm/cool
// placeholder. These are the same ten hues as fffx-landing.css's
// `--accent-<section>` custom properties (hsl(H, 58%, 62%) each,
// 36° apart) — duplicated here as plain RGB triples because the inline
// `rgba()` string this feeds (see renderStruct() below) needs actual
// numbers, not a CSS var lookup. If a section's hue in fffx-landing.css ever
// changes, recompute its RGB triple here to match (HSL→RGB by hand;
// there's no shared single source of truth between the two files for
// this, same as the original STRUCT_TINT_WARM/COOL constants before it).
const SECTION_TINTS = {
  "prompt-collections": "214, 158, 102",
  "deep-studies": "203, 214, 102",
  "recreating-the-past": "136, 214, 102",
  "tools-and-libraries": "102, 214, 136",
  "generative-projects": "102, 214, 203",
  "image-experiments": "102, 158, 214",
  "sketch-families": "113, 102, 214",
  "plotter-fabrication": "181, 102, 214",
  "code-to-objects": "214, 102, 181",
  "legacy-processing": "214, 102, 113"
};
const STRUCT_TINT_FALLBACK = "127, 135, 150";

function tintForRect(rect) {
  return SECTION_TINTS[rect.sectionId] || STRUCT_TINT_FALLBACK;
}

// One div per non-root rect, filled with a low, constant alpha. Rects
// are drawn in the order they appear in allRects — pre-order, parent
// always before its children — so for any point on the field, every
// rect that covers it (its full ancestor chain) paints in shallow-to-
// deep order, accumulating stacked layers of that point's own section's
// hue. Colour reads as "which section," alpha-stacking reads as "how
// nested" — two separate signals, not one warm/cool duality (the v1.0
// approach, since superseded — see tintForRect() above).
//
// No inset math here — rect.x/y/width/height are already the inset
// geometry, baked in by buildRectTree() at split time (see insetRect()
// in subdivision.js). This is what makes the gaps land correctly: each
// rect is inset relative to where its own parent was actually drawn,
// not recomputed independently against raw, never-inset bounds.
function renderStruct(rect, layoutConfig) {
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return null;

  const div = document.createElement("div");
  div.className = "fffx-struct";
  div.dataset.depth = rect.depth;
  div.style.left = `${rect.x}px`;
  div.style.top = `${rect.y}px`;
  div.style.width = `${width}px`;
  div.style.height = `${height}px`;
  div.style.background = `rgba(${tintForRect(rect)}, ${layoutConfig.structAlpha})`;
  return div;
}

function renderTile(entry, rect) {
  const isMuted = entry.status === "wip";

  const tile = document.createElement("a");
  tile.className = isMuted ? "fffx-tile fffx-tile--muted" : "fffx-tile";
  tile.href = entry.href;
  tile.dataset.id = entry.id;
  tile.dataset.section = entry.section || "";
  tile.dataset.kind = entry.kind || "";
  tile.dataset.depth = rect.depth;
  tile.style.left = `${rect.x}px`;
  tile.style.top = `${rect.y}px`;
  tile.style.width = `${rect.width}px`;
  tile.style.height = `${rect.height}px`;
  tile.style.setProperty("--thumb", entry.thumbnail ? `url("${entry.thumbnail}")` : "none");

  // Font sizes scaled to *this tile's own* rect, not the viewport — a
  // fixed clamp(…vw…) gives a 180px tile and a 600px tile the same
  // font size, since vw only knows about the viewport. Title and body
  // are independently bounded by both width and height, since a short-
  // but-narrow tile and a wide-but-short tile fail in different axes.
  const titleSize = Math.max(12, Math.min(26, rect.width * 0.08, rect.height * 0.2));
  const bodySize = Math.max(9.5, Math.min(13, rect.width * 0.045, rect.height * 0.11));
  tile.style.setProperty("--tile-title-size", `${titleSize.toFixed(1)}px`);
  tile.style.setProperty("--tile-body-size", `${bodySize.toFixed(1)}px`);

  // Live-resubdivision hairline offsets (k, 2k) scale with the tile's
  // own shorter dimension, not a fixed px value — see fffx-landing.css.
  const splitK = Math.max(1, Math.round(Math.min(rect.width, rect.height) * 0.1));
  tile.style.setProperty("--split-k", `${splitK}px`);

  // Tags add another text row on top of title/subtitle/meta — only
  // offer them room to reveal on hover if the tile is actually big
  // enough to have spare room; otherwise they'd just overflow further.
  const showTags = rect.width >= 200 && rect.height >= 150;
  const tags = showTags
    ? (entry.tags || []).map(tag => `<li>${tag}</li>`).join("")
    : "";

  const metaLine = isMuted
    ? `${entry.section || ""} / ${entry.kind || ""} · wip`
    : `${entry.section || ""} / ${entry.kind || ""}`;

  tile.innerHTML = `
    <span class="fffx-tile-tab" aria-hidden="true"></span>
    <span class="fffx-tile-split fffx-tile-split-v1" aria-hidden="true"></span>
    <span class="fffx-tile-split fffx-tile-split-v2" aria-hidden="true"></span>
    <span class="fffx-tile-split fffx-tile-split-h1" aria-hidden="true"></span>
    <span class="fffx-tile-split fffx-tile-split-h2" aria-hidden="true"></span>
    <div class="fffx-tile-content">
      <h2>${entry.title}</h2>
      <p>${entry.subtitle || ""}</p>
      <div class="fffx-tile-meta">${metaLine}</div>
      ${tags ? `<ul class="fffx-tile-tags">${tags}</ul>` : ""}
    </div>
    <span class="fffx-tile-coord" aria-hidden="true">${Math.round(rect.x)},${Math.round(rect.y)}</span>
  `;

  return tile;
}

function renderFiller(rect, rng, index) {
  const cell = document.createElement("div");
  const treatment = pickFromId(`${rect.id}-treatment`, FILLER_TREATMENTS);
  cell.className = `fffx-cell fffx-cell--${treatment}`;
  cell.dataset.depth = rect.depth;
  cell.style.left = `${rect.x}px`;
  cell.style.top = `${rect.y}px`;
  cell.style.width = `${rect.width}px`;
  cell.style.height = `${rect.height}px`;
  cell.style.setProperty("--variant", index % 5);
  cell.innerHTML = fillerContent(treatment, rect, rng);
  return cell;
}

function render() {
  field.innerHTML = "";

  const isMobile = window.innerWidth < 700;
  const layoutConfig = landingConfig.layout;
  const depthConfig = isMobile ? layoutConfig.mobile : layoutConfig.desktop;

  const fieldWidth = field.clientWidth;

  const visibleEntries = [...entries]
    .filter(entry => entry.status !== false)
    .sort((a, b) => a.order - b.order);

  // The root partitions into one region per enabled section before any
  // ordinary subdivision happens (see buildRectTree() in
  // subdivision.js) — so section weight has to be known up front. A
  // section's weight is the sum of its own visible entries' weights;
  // sections with none get zero weight and are dropped entirely (no
  // region reserved for a section with nothing to show).
  const sectionWeights = sections
    .filter(s => s.status !== false)
    .map(s => ({
      id: s.id,
      order: s.order,
      weight: visibleEntries
        .filter(entry => entry.section === s.id)
        .reduce((sum, entry) => sum + entry.weight, 0),
      entryCount: visibleEntries.filter(entry => entry.section === s.id).length
    }))
    .filter(s => s.weight > 0)
    .sort((a, b) => a.order - b.order);

  const minThumbWidth = isMobile
    ? fieldWidth * layoutConfig.mobile.minThumbWidthRatio
    : layoutConfig.desktop.minThumbWidth;
  const minThumbHeight = depthConfig.minThumbHeight;

  // A section's area share of the field is (weight_i / totalWeight) ×
  // fieldArea — so for every section's share to clear its own hard
  // floor (one minThumbWidth × minThumbHeight candidate per visible
  // entry it has, times sectionAreaBuffer headroom) *simultaneously*,
  // the field needs to be at least as large as whichever section's
  // (floor ÷ its own weight) ratio is most demanding, scaled by the
  // total weight. This is what replaces the old mobile-only
  // `entries.length * 230` heuristic — that was a flat guess unrelated
  // to actual thumb-size thresholds or section weight, and had no
  // desktop equivalent at all, which is exactly how a low-weight
  // section (e.g. one with a single entry) could end up narrower than
  // minThumbWidth without anything ever growing the field to compensate
  // — see the bug writeup in LANDING-PAGE-NOTES.md.
  const totalSectionWeight = sectionWeights.reduce((sum, s) => sum + s.weight, 0) || 1;
  const requiredFieldArea = sectionWeights.reduce((max, s) => {
    const minSectionArea = s.entryCount * minThumbWidth * minThumbHeight * layoutConfig.sectionAreaBuffer;
    return Math.max(max, (minSectionArea / s.weight) * totalSectionWeight);
  }, 0);
  const requiredFieldHeight = fieldWidth > 0 ? requiredFieldArea / fieldWidth : 0;

  const fieldHeight = Math.max(field.clientHeight, requiredFieldHeight);

  // #subdivision-field has `overflow: hidden` and every child is
  // `position: absolute`, so the element never grows to fit its content
  // on its own — without this, any fieldHeight taller than the CSS
  // min-height would silently clip whatever got placed below it. This
  // is what actually makes the grown height visible/scrollable, not
  // just a number used for layout math.
  field.style.height = `${fieldHeight}px`;

  document.body.classList.toggle("fffx-is-mobile", isMobile);

  const rng = seededRandom(`${landingConfig.seed}-${loadSeed}-${fieldWidth}-${fieldHeight}`);

  const rootRect = { id: "0", parentId: null, depth: 0, x: 0, y: 0, width: fieldWidth, height: fieldHeight };
  const { allRects, leafRects, sectionRoots } = buildRectTree(rootRect, sectionWeights, { ...layoutConfig, ...depthConfig }, rng);

  const candidateRects = getCandidateRects(
    allRects,
    layoutConfig,
    { ...depthConfig, minThumbWidth },
    fieldWidth,
    fieldHeight
  );

  // Tiles should cover ~targetTileAreaFraction of the field in aggregate,
  // at this viewport, with however many entries are currently live —
  // not a fixed px² constant that happens to land wherever it lands.
  // Each entry's own target area is still its share of that total,
  // weighted by `weight` (see scoreRectForEntry).
  const sumWeights = visibleEntries.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const baseTileArea = (fieldWidth * fieldHeight * layoutConfig.targetTileAreaFraction) / sumWeights;
  const scoringConfig = { ...layoutConfig, baseTileArea };

  // Assignment runs once per section, each scoped to only that
  // section's own rects and own entries — entries can no longer drift
  // into another section's region just because a candidate rect there
  // happened to score well. Each section's rects already form one
  // contiguous area (see buildRectTree()), so this is also what makes a
  // "jump to section" menu meaningful later: the assigned tiles for a
  // section and the section's own area are the same region.
  const assignments = [];
  const blockedIds = new Set();

  sectionWeights.forEach(section => {
    const sectionEntries = visibleEntries.filter(entry => entry.section === section.id);
    const sectionCandidates = candidateRects.filter(r => r.sectionId === section.id);
    const sectionAllRects = allRects.filter(r => r.sectionId === section.id);

    const result = assignEntries(sectionEntries, sectionCandidates, sectionAllRects, scoringConfig);
    assignments.push(...result.assignments);
    result.blockedIds.forEach(id => blockedIds.add(id));
  });

  allRects
    .filter(r => r.depth > 0)
    .forEach(rect => {
      const struct = renderStruct(rect, layoutConfig);
      if (struct) field.appendChild(struct);
    });

  assignments.forEach(({ entry, rect }) => {
    field.appendChild(renderTile(entry, rect));
  });

  leafRects
    .filter(r => !blockedIds.has(r.id) && r.width >= layoutConfig.minFillerSize && r.height >= layoutConfig.minFillerSize)
    .forEach((rect, index) => {
      field.appendChild(renderFiller(rect, rng, index));
    });

  // Invisible, zero-size scroll targets — one per section root. Each
  // section's tiles already live inside this exact rect (see the
  // assignment-scoping comment above), so this is what the section menu
  // scrolls to: a real, stable region, not a guess. Recreated every
  // render() since field.innerHTML is cleared each time; the menu's
  // click handlers look these up by id at click time, so they always
  // find whichever pass most recently created them.
  sectionRoots.forEach(rect => {
    const anchor = document.createElement("div");
    anchor.id = `section-anchor-${rect.sectionId}`;
    anchor.style.position = "absolute";
    anchor.style.left = `${rect.x}px`;
    anchor.style.top = `${rect.y}px`;
    anchor.style.width = "1px";
    anchor.style.height = "1px";
    field.appendChild(anchor);
  });
}

render();
window.addEventListener("resize", render);
buildSectionMenu();
