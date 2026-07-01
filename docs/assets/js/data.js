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

    // Scoring weights — see subdivision.js scoreRectForEntry(). Reading-
    // order placement (which entry lands roughly where) is handled
    // separately in assignEntries()'s windowing, not by a scoring term —
    // these three only decide *which rect within that window* wins.
    // (baseTileArea itself is computed per render in layout.js from
    // targetTileAreaFraction below — see there for why.)
    idealAspect: 1.45,
    aspectPenaltyWeight: 7000,
    depthPenaltyWeight: 900,

    // Tiles, in aggregate, should cover roughly this fraction of the
    // field's area — filler/blank texture fills the rest. layout.js
    // derives each render's effective baseTileArea from
    // (fieldWidth × fieldHeight × targetTileAreaFraction) ÷ sum of
    // visible entries' weights, so the ratio holds regardless of
    // viewport size or how many entries are currently live — add more
    // entries and each one's *share* shrinks a bit, but the total tiled
    // area stays targeted at this fraction rather than drifting.
    targetTileAreaFraction: 0.65,

    // Smallest a leaf rect can be and still render as a visible filler
    // cell. Below this it's left as bare background.
    minFillerSize: 22,

    // Structure layer: every rect (depth > 0) is drawn inset by this many
    // px from its own raw bounds, filled with structAlpha of ink. Since a
    // child's inset bounds always sit inside its parent's, the gap left
    // at every split reveals the parent's tint underneath — that gap is
    // the visible subdivision line. Each successive depth stacks another
    // structAlpha on top, so deeper nesting reads as visibly darker.
    structInset: 1.5,
    structAlpha: 0.05,

    // How much headroom a section's guaranteed minimum area gets beyond
    // the bare "one minThumbWidth × minThumbHeight candidate per visible
    // entry" floor — see layout.js's field-height growth calculation.
    // >1 on purpose: subdivision/inset overhead and the section's own
    // filler space both eat into the raw area before a tile candidate
    // ever appears, and excess negative space is explicitly preferred
    // over a section being too cramped to fit its own entries.
    sectionAreaBuffer: 3,

    desktop: {
      // One step deeper and a lower size floor than before — with tiles
      // now claiming ~65% of the field (see targetTileAreaFraction), the
      // remaining filler space needs finer-grained subdivision to read
      // as "many small rects between the large ones" rather than a few
      // big leftover chunks.
      maxDepth: 8,
      minRectSize: 32,
      minThumbWidth: 180,
      minThumbHeight: 130
    },

    mobile: {
      maxDepth: 4,
      minRectSize: 60,
      // mobile tile width floor is a fraction of viewport width, not a
      // fixed px value — see layout.js
      minThumbWidthRatio: 0.78,
      minThumbHeight: 160
    }
  }
};

// One entry per section value used below. This is the single source of
// truth for which sections exist, their reading-order sequence
// (`order`), and whether they're switched on at all (`status`) —
// independent of whether any entries currently happen to populate them.
// `title`/`status` match the shared cross-world schema (WORLD-SYSTEMS.md)
// — were `label`/`enabled` before a 2026-06-30 normalization pass; the
// values/semantics didn't change, just the field names (`status` here
// is boolean only, true|false, same model as entries[].status without
// the "wip" middle state — nothing currently needs a muted-but-visible
// section). v2.0's subdivision tree partitions the root into one
// contiguous region per *enabled* section (sized by that section's
// total visible-entry weight) before any of the normal recursive
// subdivision happens — see buildRectTree() in subdivision.js. A
// section with zero visible entries contributes zero weight and is
// skipped entirely (no empty region reserved for it).
export const sections = [
  { id: "prompt-collections", title: "Prompt Collections", order: 10, status: true },
  { id: "deep-studies", title: "Deep Studies", order: 20, status: true },
  { id: "recreating-the-past", title: "Recreating the Past", order: 30, status: true },
  { id: "tools-and-libraries", title: "Tools & Libraries", order: 40, status: true },
  { id: "generative-projects", title: "Generative Projects", order: 50, status: true },
  { id: "image-experiments", title: "Image Experiments", order: 60, status: true },
  { id: "sketch-families", title: "Sketch Families", order: 70, status: true },
  { id: "plotter-fabrication", title: "Plotter & Fabrication", order: 80, status: true },
  { id: "code-to-objects", title: "Code to Objects", order: 90, status: true },
  { id: "legacy-processing", title: "Legacy Processing", order: 100, status: true },
  { id: "studentWork", title: "Student Work", order: 100, status: true }
];

// Each entry is a *portal*, not a sketch — a collection, study, tool, or
// archive grouping, never one tile per tiny version folder. See
// LANDING-PAGE-NOTES.md for the full field reference.
//
// weight: 1 = small/archive, 2 = regular, 3 = important collection/study,
// 4 = major feature portal. Controls the target rectangle area a tile is
// scored against, not a guaranteed size — the subdivision tree may not
// always offer a perfectly matching rectangle at a given viewport. Also
// feeds the section-level partition: a section's own page area is the
// sum of its visible entries' weights, relative to other sections' sums.
//
// status: true (renders normally) | false (excluded from the field
//   entirely) | "wip" (renders, but muted — quieter line weight, lower
//   opacity, a "wip" tag in the meta line). One field, one job: this is
//   both the visibility switch and the "is this actually finished" flag.
export const entries = [
  {
    id: "genuary",
    title: "Genuary",
    subtitle: "Daily prompt sketches for the January generative-art challenge.",
    href: "prompt-collections/genuary/",
    section: "prompt-collections",
    kind: "prompt-series",
    order: 10,
    weight: 4,
    status: "wip",
    tags: ["p5", "genuary", "daily-prompts"],
    location: "internal",
  },
  {
    id: "100-gradients",
    title: "100 Gradients",
    subtitle: "Generated colour fields.",
    href: "deep-studies/100-gradients/",
    section: "deep-studies",
    kind: "deep-study",
    order: 20,
    weight: 3,
    status: "wip",
    tags: ["gradients", "colour", "generative"],
    location: "internal",
  },
  {
    id: "particle-systems",
    title: "Particle Systems",
    subtitle: "Particles, motion, and emergent behaviour.",
    href: "deep-studies/particle-systems/",
    section: "deep-studies",
    kind: "deep-study",
    order: 30,
    weight: 3,
    status: "wip",
    tags: ["p5", "particles", "motion"],
    location: "internal",
  },
  {
    id: "vera-molnar",
    title: "Vera Molnar",
    subtitle: "A code-driven homage/study.",
    href: "recreating-the-past/vera-molnar/",
    section: "recreating-the-past",
    kind: "artist-study",
    order: 10,
    weight: 4,
    status: true,
    tags: ["artist-study", "geometry"],
    location: "internal"
  },
  {
    id: "circle-packing-library",
    title: "Circle Packing Library",
    subtitle: "From Bookclubs to Libraries — circle packing with code.",
    href: "tools-and-libraries/circle-packing-library/",
    thumbnail: "assets/thumbs/circle-packing.jpg",
    section: "tools-and-libraries",
    kind: "library",
    order: 10,
    weight: 4,
    status: true,
    tags: ["p5", "circle-packing", "library"],
    location: "internal-plus-repo",
    repo: {
      name: "p5-circle-packing",
      url: "https://github.com/jesmehta/p5-circle-packing"
    }
  },
  {
    id: "mandala-generator",
    title: "Mandala Generator",
    subtitle: "A digital tool for dot-mandala patterns.",
    href: "tools-and-libraries/mandala-generator/",
    section: "tools-and-libraries",
    kind: "digital-tool",
    order: 60,
    weight: 4,
    status: "wip",
    tags: ["p5", "mandala", "tool"],
    location: "internal",
  },
  {
    id: "lenticular-image-generator",
    title: "Lenticular Image Generator",
    subtitle: "A digital tool for interleaving images into lenticular composites.",
    href: "tools-and-libraries/lenticular-image-generator/",
    section: "tools-and-libraries",
    kind: "digital-tool",
    order: 70,
    weight: 2,
    status: "wip",
    tags: ["image", "lenticular", "tool"],
    location: "internal",
  },
  {
    id: "harmonics-dance-of-planets",
    title: "Harmonics / Dance of Planets",
    subtitle: "An orbital-harmonics visualization tool.",
    href: "tools-and-libraries/harmonics-dance-of-planets/",
    section: "tools-and-libraries",
    kind: "digital-tool",
    order: 80,
    weight: 2,
    status: "wip",
    tags: ["orbits", "harmonics", "visualization"],
    location: "internal",
  },
  {
    id: "windows-of-berlin",
    title: "Windows of Berlin",
    subtitle: "A generative study of Berlin's windows and facades.",
    href: "generative-projects/windows-of-berlin/",
    section: "generative-projects",
    kind: "generative-project",
    order: 90,
    weight: 3,
    status: "wip",
    tags: ["p5", "generative", "architecture"],
    location: "internal",
  },
  {
    id: "image-filters",
    title: "Image Filters",
    subtitle: "Pixel-level image filter and effect experiments.",
    href: "image-experiments/image-filters/",
    section: "image-experiments",
    kind: "image-filter",
    order: 100,
    weight: 1,
    status: "wip",
    tags: ["image", "filters", "pixels"],
    location: "internal",
  },
  {
    id: "flow-fields",
    title: "Flow Fields",
    subtitle: "A sketch family built on vector/flow fields.",
    href: "sketch-families/flow-fields/",
    section: "sketch-families",
    kind: "sketch-family",
    order: 110,
    weight: 2,
    status: "wip",
    tags: ["p5", "flow-fields", "vectors"],
    location: "internal",
  },
  {
    id: "perlin-noise",
    title: "Perlin Noise",
    subtitle: "A sketch family exploring noise as a generative driver.",
    href: "sketch-families/perlin-noise/",
    section: "sketch-families",
    kind: "sketch-family",
    order: 120,
    weight: 2,
    status: "wip",
    tags: ["p5", "perlin-noise", "texture"],
    location: "internal",
  },
  {
    id: "plotter-work",
    title: "Plotter Work",
    subtitle: "Pen-plotter drawings generated from code.",
    href: "physical-outputs/plotter-work/",
    section: "plotter-fabrication",
    kind: "plotter-work",
    order: 130,
    weight: 3,
    status: "wip",
    tags: ["plotter", "line-art", "fabrication"],
    location: "internal",
  },
  {
    id: "code-to-fabrication",
    title: "Code to Fabrication",
    subtitle: "Code-driven outputs translated into physical fabrication.",
    href: "physical-outputs/code-to-fabrication/",
    section: "code-to-objects",
    kind: "fabricated-output",
    order: 140,
    weight: 2,
    status: "wip",
    tags: ["fabrication", "laser-cut", "3d-print"],
    location: "internal"
  },
  {
    id: "legacy-processing-archive",
    title: "Legacy Processing Archive",
    subtitle: "Older Processing (.pde) sketches, acknowledged but untouched.",
    href: "archives/legacy-processing-archive/",
    section: "legacy-processing",
    kind: "legacy-archive",
    order: 150,
    weight: 1,
    status: "wip",
    tags: ["processing", "archive", "legacy"],
    location: "internal"
  },
  {
    id: "student-work",
    title: "SSD Creative Coding Class highlights",
    subtitle: "Selected student work from the batch of 2025-26",
    href: "https://jesmehta.github.io/SSD_CreativeCodingPage/",
    section: "studentWork",
    kind: "archive",
    order: 150,
    weight: 3,
    status: "live",
    tags: ["p5js", "studentWork", "interactive"],
    location: "external"
  },
  {
    id: "prompt-generator",
    title: "Prompt Generator for SSD students",
    subtitle: "A prompt generator I created to help my students with some inspiration and direction",
    href: "https://jesmehta.github.io/PromptGenerator/",
    section: "tools-and-libraries",
    kind: "digital-tool",
    order: 150,
    weight: 2,
    status: "live",
    tags: ["p5js", "studentWork", "interactive"],
    location: "external"
  },
  {
    id: "oblique-strategies",
    title: "Brian Eno's Oblique Strategy randomizer",
    subtitle: "A random instruction based on Brian Eno's Oblique Strategy cards",
    href: "https://jesmehta.github.io/ObliqueStrategies/",
    section: "tools-and-libraries",
    kind: "digital-tool",
    order: 160,
    weight: 2,
    status: "live",
    tags: ["p5js", "studentWork", "interactive"],
    location: "external"
  }
];
