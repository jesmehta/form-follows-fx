import { landingConfig, entries } from "./data.js";
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

// Warm/cool split, keyed off which side of the *root's* split a rect
// descends from (the first segment after "0" in its id), not which side
// of its immediate parent's split it's on. Keying off the immediate
// parent meant every single level alternated warm/cool independently of
// the levels above it, so by 5–7 levels deep a typical rect's ancestor
// chain was a roughly random mix of both — averaging out to a flat,
// cancelled-out neutral grey-brown almost everywhere. Keying off the
// top-level branch instead means an entire half of the field commits to
// one tint and compounds it consistently all the way down, the other
// half the other tint — two legible colour zones instead of one
// homogenized one.
const STRUCT_TINT_WARM = "168, 99, 47";
const STRUCT_TINT_COOL = "74, 90, 122";

function tintForRect(rect) {
  const topLevelSegment = rect.id.split(".")[1];
  return topLevelSegment === "0" ? STRUCT_TINT_WARM : STRUCT_TINT_COOL;
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
    <span class="fffx-tile-split fffx-tile-split-h" aria-hidden="true"></span>
    <span class="fffx-tile-split fffx-tile-split-v" aria-hidden="true"></span>
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

  const rootRect = { id: "0", parentId: null, depth: 0, x: 0, y: 0, width: fieldWidth, height: fieldHeight };
  const { allRects, leafRects } = buildRectTree(rootRect, { ...layoutConfig, ...depthConfig }, rng);

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

  const visibleEntries = [...entries]
    .filter(entry => entry.status !== false)
    .sort((a, b) => a.order - b.order);

  // Tiles should cover ~targetTileAreaFraction of the field in aggregate,
  // at this viewport, with however many entries are currently live —
  // not a fixed px² constant that happens to land wherever it lands.
  // Each entry's own target area is still its share of that total,
  // weighted by `weight` (see scoreRectForEntry).
  const sumWeights = visibleEntries.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const baseTileArea = (fieldWidth * fieldHeight * layoutConfig.targetTileAreaFraction) / sumWeights;
  const scoringConfig = { ...layoutConfig, baseTileArea };

  const { assignments, blockedIds } = assignEntries(
    visibleEntries,
    candidateRects,
    allRects,
    scoringConfig
  );

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
