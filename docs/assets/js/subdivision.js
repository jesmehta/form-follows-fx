// Rectangle tree generation, candidate filtering, scoring, and entry
// assignment. No DOM access in this file — layout.js owns rendering.

// Each rect's id encodes its path from the root ("0", "0.0", "0.1",
// "0.0.1", ...). That makes ancestor/descendant checks a string-prefix
// test instead of needing a separate parent-walk.
//
// Inset is baked into the geometry here, not applied later as a
// decorative overlay. Each freshly-split child is shrunk by `d` on
// *every* side (x += d, y += d, width -= 2d, height -= 2d) — and *that*
// adjusted rect, not the raw split, is what gets pushed into allRects
// and recursed into for the next split.
//
// width/height each lose 2d, not d: a single split only creates *one*
// new interior edge per child (e.g. a vertical split gives childA a new
// right edge and childB a new left edge, at the split line) — the
// other three edges of each child are still whatever the parent's own
// edges were. Subtracting only d (x += d, width -= d) insets the side
// that moved, but leaves the *un-split* dimension's far edge exactly on
// the parent's own boundary (e.g. childA's bottom edge, untouched by a
// vertical split, would still equal the parent's bottom edge exactly —
// touching it, not inset from it). Subtracting 2d while only advancing
// x/y by d insets every edge by exactly d from whatever it borders,
// whether that's the parent's own boundary or a fresh interior split
// line — both children's edges end up uniformly inset on all four
// sides, not just the two that happened to move first.
function insetRect(rect, d) {
  return { ...rect, x: rect.x + d, y: rect.y + d, width: rect.width - 2 * d, height: rect.height - 2 * d };
}

// Splits one rect into two by `ratio` (childA's share), along whichever
// axis is currently longer — the same heuristic used for every ordinary
// subdivision pass and reused for the section-chain split below, so both
// kinds of split produce geometrically identical results for a given
// rect/ratio. `depth` is only used to label the children; callers that
// want a different depth numbering (see buildRectTree's section roots)
// override it afterward.
function splitRect(rect, ratio, depth) {
  const splitVertical = rect.width >= rect.height;

  if (splitVertical) {
    const leftWidth = rect.width * ratio;
    const rightWidth = rect.width - leftWidth;
    return {
      childA: { id: `${rect.id}.0`, parentId: rect.id, depth: depth + 1, x: rect.x, y: rect.y, width: leftWidth, height: rect.height },
      childB: { id: `${rect.id}.1`, parentId: rect.id, depth: depth + 1, x: rect.x + leftWidth, y: rect.y, width: rightWidth, height: rect.height }
    };
  }

  const topHeight = rect.height * ratio;
  const bottomHeight = rect.height - topHeight;
  return {
    childA: { id: `${rect.id}.0`, parentId: rect.id, depth: depth + 1, x: rect.x, y: rect.y, width: rect.width, height: topHeight },
    childB: { id: `${rect.id}.1`, parentId: rect.id, depth: depth + 1, x: rect.x, y: rect.y + topHeight, width: rect.width, height: bottomHeight }
  };
}

// v2.0: the root no longer subdivides freely from the start. It first
// partitions into exactly one contiguous region per *enabled, weighted*
// section, in `sections` order, sized by each section's share of the
// total weight — a *linear chain* of (sectionCount - 1) splits (peel one
// section's share off the remainder, recurse into what's left), not a
// balanced binary tree. N sections therefore produce exactly N regions,
// not 2^(N-1). Each resulting region becomes its own subdivision root
// (depth reset to 0, tagged with that section's id, inherited by every
// descendant) and is handed the *same* maxDepth/minRectSize budget as
// every other section regardless of where it falls in the chain — so a
// section's position in the order doesn't make its own interior
// subdivision shallower or coarser than its neighbours'.
//
// `sections` here is the already-filtered, already-weighted list: each
// entry is `{ id, weight }` where weight is the sum of that section's
// own visible entries' weights (computed in layout.js). Sections with
// zero visible entries should already be excluded by the caller — they
// have no weight to claim a region with.
export function buildRectTree(rootRect, sections, depthConfig, rng) {
  const allRects = [];
  const leafRects = [];
  const sectionRoots = [];
  const inset = depthConfig.structInset || 0;

  function subdivide(rect, depth, sectionId) {
    const tagged = { ...rect, depth, sectionId };
    allRects.push(tagged);

    const tooDeep = depth >= depthConfig.maxDepth;
    const tooSmall =
      rect.width < depthConfig.minRectSize || rect.height < depthConfig.minRectSize;

    if (tooDeep || tooSmall) {
      leafRects.push(tagged);
      return;
    }

    const ratio =
      depthConfig.splitRatioMin + rng() * (depthConfig.splitRatioMax - depthConfig.splitRatioMin);
    const { childA, childB } = splitRect(rect, ratio, depth);

    subdivide(insetRect(childA, inset), depth + 1, sectionId);
    subdivide(insetRect(childB, inset), depth + 1, sectionId);
  }

  let remaining = rootRect;
  let remainingWeight = sections.reduce((sum, s) => sum + s.weight, 0);

  sections.forEach((section, index) => {
    const isLast = index === sections.length - 1;

    if (isLast) {
      sectionRoots.push({ ...remaining, depth: 0, sectionId: section.id });
      subdivide(remaining, 0, section.id);
      return;
    }

    const ratio = section.weight / remainingWeight;
    const { childA, childB } = splitRect(remaining, ratio, 0);
    const sectionRect = { ...insetRect(childA, inset), depth: 0 };
    const restRect = insetRect(childB, inset);

    sectionRoots.push({ ...sectionRect, sectionId: section.id });
    subdivide(sectionRect, 0, section.id);

    remainingWeight -= section.weight;
    remaining = restRect;
  });

  return { allRects, leafRects, sectionRoots };
}

export function getCandidateRects(allRects, layoutConfig, depthConfig, fieldWidth, fieldHeight) {
  return allRects.filter(r => {
    if (r.depth < layoutConfig.minCandidateDepth) return false;
    if (r.width < depthConfig.minThumbWidth || r.height < depthConfig.minThumbHeight) return false;

    const aspect = r.width / r.height;
    if (aspect < layoutConfig.minAspect || aspect > layoutConfig.maxAspect) return false;

    // exclude anything that's effectively the whole field
    if (r.width >= fieldWidth * 0.98 && r.height >= fieldHeight * 0.98) return false;

    return true;
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// Same rect, or one is an ancestor/descendant of the other via the
// dotted-path id scheme.
function isRelated(idA, idB) {
  return idA === idB || idA.startsWith(`${idB}.`) || idB.startsWith(`${idA}.`);
}

export function scoreRectForEntry(rect, entry, layoutConfig) {
  const targetArea = layoutConfig.baseTileArea * entry.weight;
  const areaScore = Math.abs(rect.width * rect.height - targetArea);

  const aspect = rect.width / rect.height;
  const aspectScore = Math.abs(aspect - layoutConfig.idealAspect) * layoutConfig.aspectPenaltyWeight;

  const idealDepth = layoutConfig.minCandidateDepth + 1.5;
  const depthScore = Math.abs(rect.depth - idealDepth) * layoutConfig.depthPenaltyWeight;

  return areaScore + aspectScore + depthScore;
}

// Reading-order comparator: top-to-bottom rows, left-to-right within a
// row. Rects don't sit on a grid, so "same row" is approximated as
// "these two rects' vertical spans overlap by at least half the
// shorter one's height" — if so, sort by x; otherwise sort by vertical
// center. This is the classic row-grouping heuristic used for reading
// order over irregular layout blocks (e.g. OCR block ordering).
function compareReadingOrder(a, b) {
  const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const shorterHeight = Math.min(a.height, b.height);

  if (overlap > shorterHeight * 0.5) {
    return a.x - b.x;
  }

  return (a.y + a.height / 2) - (b.y + b.height / 2);
}

// Returns { assignments: [{entry, rect}], blockedIds: Set<string> }.
// blockedIds covers every assigned rect plus all of its ancestors,
// descendants, and anything geometrically overlapping it — so filler
// rendering never double-draws underneath/around a tile.
//
// Placement keeps `order` legible across reloads even though the tree
// reseeds every load: candidates are sorted into reading order (left to
// right, then top to bottom by row) once, and entry N is only allowed to
// pick from a small window of that sorted list centered on N's
// proportional position. So entry 0 always lands near the start of
// reading order, the last entry always lands near the end, and entries
// in between land roughly where you'd expect relative to each other —
// while which *specific* rect (size/aspect) it gets within that window
// still depends on the reseeded tree and `weight`-driven scoring.
export function assignEntries(visibleEntries, candidateRects, allRects, layoutConfig) {
  const blockedIds = new Set();
  const assignments = [];
  const orderedCandidates = [...candidateRects].sort(compareReadingOrder);
  const total = visibleEntries.length;

  visibleEntries.forEach((entry, index) => {
    const available = orderedCandidates.filter(r => !blockedIds.has(r.id));
    if (available.length === 0) return;

    const targetIndex = Math.round((index / Math.max(total - 1, 1)) * (available.length - 1));
    const windowRadius = Math.max(2, Math.ceil(available.length / total));
    const lo = Math.max(0, targetIndex - windowRadius);
    const hi = Math.min(available.length - 1, targetIndex + windowRadius);
    const windowCandidates = available.slice(lo, hi + 1);

    let best = null;
    let bestScore = Infinity;

    windowCandidates.forEach(rect => {
      const score = scoreRectForEntry(rect, entry, layoutConfig);
      if (score < bestScore) {
        bestScore = score;
        best = rect;
      }
    });

    if (!best) return;

    assignments.push({ entry, rect: best });

    allRects.forEach(r => {
      if (isRelated(r.id, best.id) || rectsOverlap(r, best)) {
        blockedIds.add(r.id);
      }
    });
  });

  return { assignments, blockedIds };
}
