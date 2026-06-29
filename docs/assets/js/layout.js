import { landingConfig, entries, sections } from "./data.js";
import { seededRandom, pickFromId } from "./random.js";
import { buildRectTree, getCandidateRects, assignEntries } from "./subdivision.js";

const field = document.querySelector("#subdivision-field");

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

// PLACEHOLDER pending the real per-section colour pass (v2.0 phase 4):
// now that the tree is partitioned by section first (see buildRectTree()
// in subdivision.js), a rect's id no
// longer encodes which section it's in — id segments encode the rect's
// position in the section *chain* and its own internal subdivision, not
// section identity. The old "first segment after 0" trick is therefore
// meaningless now and would silently produce nonsense groupings. Every
// rect carries an explicit `sectionId` already (inherited from its
// section's root, tagged in buildRectTree()), so this hashes that string
// directly to pick warm or cool — still just a placeholder two-tone
// split, not the real per-section-hue structure-layer work, which is
// still pending.
const STRUCT_TINT_WARM = "168, 99, 47";
const STRUCT_TINT_COOL = "74, 90, 122";

function tintForRect(rect) {
  if (!rect.sectionId) return STRUCT_TINT_WARM;
  let hash = 0;
  for (let i = 0; i < rect.sectionId.length; i++) {
    hash = (hash * 31 + rect.sectionId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? STRUCT_TINT_WARM : STRUCT_TINT_COOL;
}

// One div per non-root rect, filled with a low, constant alpha. Rects
// are drawn in the order they appear in allRects — pre-order, parent
// always before its children — so for any point on the field, every
// rect that covers it (its full ancestor chain) paints in shallow-to-
// deep order, accumulating stacked layers and drifting warm or cool
// depending on which branch they're on.
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
  tile.style.setProperty("--thumb", entry.image ? `url("${entry.image}")` : "none");

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
  // own shorter dimension, not a fixed px value — see landing.css.
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
  const fieldHeight = Math.max(
    field.clientHeight,
    isMobile ? entries.length * 230 : field.clientHeight
  );

  document.body.classList.toggle("fffx-is-mobile", isMobile);

  const rng = seededRandom(`${landingConfig.seed}-${loadSeed}-${fieldWidth}-${fieldHeight}`);

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
    .filter(s => s.enabled)
    .map(s => ({
      id: s.id,
      order: s.order,
      weight: visibleEntries
        .filter(entry => entry.section === s.id)
        .reduce((sum, entry) => sum + entry.weight, 0)
    }))
    .filter(s => s.weight > 0)
    .sort((a, b) => a.order - b.order);

  const rootRect = { id: "0", parentId: null, depth: 0, x: 0, y: 0, width: fieldWidth, height: fieldHeight };
  const { allRects, leafRects } = buildRectTree(rootRect, sectionWeights, { ...layoutConfig, ...depthConfig }, rng);

  const minThumbWidth = isMobile
    ? fieldWidth * layoutConfig.mobile.minThumbWidthRatio
    : layoutConfig.desktop.minThumbWidth;

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
}

render();
window.addEventListener("resize", render);
