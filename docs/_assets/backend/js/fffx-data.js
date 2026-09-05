export const landingConfig = {
  id: "fffx",
  title: "Form follows f(x)",
  subtitle: "Creative coding, generative systems, algorithmic studies, and interactive sketches.",
  seed: "fffx-v1",
  theme: "subdivision",

  layout: {
    // How unevenly a rect gets split each pass. Kept away from 0.5 (too
    // regular) and away from the extremes (too degenerate/sliver-prone).
    splitRatioMin: 0.25,
    splitRatioMax: 0.75,

    // depth 0 = whole field. Rects below minCandidateDepth are too coarse
    // to read as a single tile and are never offered to entries.
    minCandidateDepth: 1,

    // Aspect ratios outside this range are excluded from tile candidacy
    // entirely (too sliver-like to hold text/image legibly).
    minAspect: 0.25,
    maxAspect: 4,

    // Scoring weights; see fffx-subdivision.js scoreRectForEntry(). Reading
    // order placement is handled separately in assignEntries().
    idealAspect: 1.45,
    aspectPenaltyWeight: 7000,
    depthPenaltyWeight: 900,

    // Tiles, in aggregate, should cover roughly this fraction of the
    // field area. fffx-layout.js derives each render's baseTileArea from this
    // value, the live field size, and the visible entries' total weight.
    targetTileAreaFraction: 0.65,

    // Smallest a leaf rect can be and still render as a visible filler
    // cell. Below this it is left as bare background.
    minFillerSize: 22,

    // Structure-layer inset/fill. Inset is baked into buildRectTree()
    // itself; fffx-layout.js draws the resulting rect geometry directly.
    structInset: 1.5,
    structAlpha: 0.05,

    // Headroom above the hard one-candidate-per-entry section-area floor.
    // See fffx-layout.js's field-height growth calculation.
    sectionAreaBuffer: 3,

    desktop: {
      maxDepth: 8,
      minRectSize: 32,
      minThumbWidth: 180,
      minThumbHeight: 130
    },

    mobile: {
      maxDepth: 4,
      minRectSize: 60,
      // Fraction of viewport width, not a fixed px value; see fffx-layout.js.
      minThumbWidthRatio: 0.78,
      minThumbHeight: 160
    }
  }
};
