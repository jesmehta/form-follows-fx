// Rectangle tree generation, candidate filtering, scoring, and entry
// assignment. No DOM access in this file — layout.js owns rendering.

// Each rect's id encodes its path from the root ("0", "0.0", "0.1",
// "0.0.1", ...). That makes ancestor/descendant checks a string-prefix
// test instead of needing a separate parent-walk.
//
// Inset is baked into the geometry here, not applied later as a
// decorative overlay. Each freshly-split child is nudged in from its
// own top-left corner by `inset` and shrunk by `inset` (x += d, y += d,
// width -= d, height -= d — NOT width -= 2*d; the bottom/right edge
// stays exactly on the split line, only the top-left corner moves) —
// and *that* adjusted rect, not the raw split, is what gets pushed into
// allRects and recursed into for the next split. Doing it this way
// means each generation is inset relative to its own immediate parent's
// actual edges, compounding consistently with depth. An earlier attempt
// computed inset as `depth * structInset` against each rect's *raw*,
// never-inset bounds as a separate rendering-only pass — since raw
// sibling/parent bounds always touch exactly with zero gap to begin
// with, that produced an inconsistent, "haywire" result with no
// reliable relationship to where the parent was actually drawn.
function insetRect(rect, d) {
  return { ...rect, x: rect.x + d, y: rect.y + d, width: rect.width - d, height: rect.height - d };
}

export function buildRectTree(rootRect, depthConfig, rng) {
  const allRects = [];
  const leafRects = [];
  const inset = depthConfig.structInset || 0;

  function subdivide(rect, depth) {
    allRects.push(rect);

    const tooDeep = depth >= depthConfig.maxDepth;
    const tooSmall =
      rect.width < depthConfig.minRectSize || rect.height < depthConfig.minRectSize;

    if (tooDeep || tooSmall) {
      leafRects.push(rect);
      return;
    }

    const splitVertical = rect.width >= rect.height;
    const ratio =
      depthConfig.splitRatioMin + rng() * (depthConfig.splitRatioMax - depthConfig.splitRatioMin);

    let childA;
    let childB;

    if (splitVertical) {
      const leftWidth = rect.width * ratio;
      const rightWidth = rect.width - leftWidth;

      childA = {
        id: `${rect.id}.0`, parentId: rect.id, depth: depth + 1,
        x: rect.x, y: rect.y, width: leftWidth, height: rect.height
      };
      childB = {
        id: `${rect.id}.1`, parentId: rect.id, depth: depth + 1,
        x: rect.x + leftWidth, y: rect.y, width: rightWidth, height: rect.height
      };
    } else {
      const topHeight = rect.height * ratio;
      const bottomHeight = rect.height - topHeight;

      childA = {
        id: `${rect.id}.0`, parentId: rect.id, depth: depth + 1,
        x: rect.x, y: rect.y, width: rect.width, height: topHeight
      };
      childB = {
        id: `${rect.id}.1`, parentId: rect.id, depth: depth + 1,
        x: rect.x, y: rect.y + topHeight, width: rect.width, height: bottomHeight
      };
    }

    subdivide(insetRect(childA, inset), depth + 1);
    subdivide(insetRect(childB, inset), depth + 1);
  }

  subdivide(rootRect, 0);
  return { allRects, leafRects };
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
