// Dance of Planets v3.0 — model
// © Jesal Mehta, @cabofcuriosity
// Pure orbital maths: planet data, cycle (resonance) options, positions.
// No DOM, no p5 — the sketch and the UI both read from this.
//
// Data sources (unchanged from v2):
//   http://hyperphysics.phy-astr.gsu.edu/hbase/kepler.html
//   https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf
// Orbits are simplified to circles in one plane, all starting aligned.

window.DOP = window.DOP || {};

DOP.model = (function () {

  // ︎ asks for the text (not emoji) form of the glyph.
  const T = '︎';
  const PLANETS = [
    { id: 'mercury', name: 'Mercury', glyph: '☿' + T, period: 0.241,  au: 0.39,  color: '#a19d97', r: 3.2 },
    { id: 'venus',   name: 'Venus',   glyph: '♀' + T, period: 0.615,  au: 0.72,  color: '#e8d6a4', r: 4.6 },
    { id: 'earth',   name: 'Earth',   glyph: '⊕' + T, period: 1.000,  au: 1.00,  color: '#5b90d8', r: 4.8 },
    { id: 'mars',    name: 'Mars',    glyph: '♂' + T, period: 1.880,  au: 1.52,  color: '#c9663f', r: 3.8 },
    { id: 'jupiter', name: 'Jupiter', glyph: '♃' + T, period: 11.900, au: 5.20,  color: '#d8b68e', r: 8.0, bands: true },
    { id: 'saturn',  name: 'Saturn',  glyph: '♄' + T, period: 29.500, au: 9.54,  color: '#e3d09a', r: 6.8, ring: true },
    { id: 'uranus',  name: 'Uranus',  glyph: '♅' + T, period: 84.000, au: 19.20, color: '#a3d8df', r: 5.8 },
    { id: 'neptune', name: 'Neptune', glyph: '♆' + T, period: 165.00, au: 30.06, color: '#5679d8', r: 5.6 },
    { id: 'pluto',   name: 'Pluto',   glyph: '♇' + T, period: 248.00, au: 40.00, color: '#bba993', r: 2.8 },
  ];
  const SUN = { name: 'Sun', glyph: '☉' + T, color: '#f3c655' };

  const byId = Object.fromEntries(PLANETS.map(p => [p.id, p]));

  // Upper bound on lines in one cycle — keeps redraws and SVG export sane
  // for pairs with enormous cycles (Mercury–Pluto is ~1029 : 1).
  const LINE_BUDGET = 150000;
  // A cycle counts as "closing" when the slower planet ends within this
  // many degrees of where it started. Used to pick the default cycle.
  const CLOSE_ENOUGH_DEG = 10;

  // Continued-fraction convergents p/q of x (x >= 1): the best rational
  // approximations, in order of increasing size.
  function convergents(x, maxQ) {
    const out = [];
    let h0 = 1, h1 = Math.floor(x), k0 = 0, k1 = 1;
    let frac = x - Math.floor(x);
    out.push([h1, k1]);
    for (let i = 0; i < 16 && frac > 1e-9; i++) {
      const inv = 1 / frac;
      const a = Math.floor(inv);
      frac = inv - a;
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxQ) break;
      out.push([h2, k2]);
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    }
    return out;
  }

  // Angular rate in degrees per unit of the time parameter.
  //   Correct: parameter is years, rate = 360 / period.
  //   Classic (v2.x): rate = period — longer periods move FASTER. Kept on
  //   purpose so v2 images stay reproducible; see DANCE-OF-PLANETS.md.
  function rate(planet, classic) {
    return classic ? planet.period : 360 / planet.period;
  }

  function wrap180(d) {
    d = ((d % 360) + 540) % 360 - 180;
    return d;
  }

  // Everything about one planet pair that doesn't depend on the look.
  //   cycleKey: 'auto' or 'p:q' (fast orbits : slow orbits)
  //   detail:   lines per orbit of the faster planet
  function makePair(idA, idB, opts) {
    const classic = !!opts.classic;
    const A = byId[idA], B = byId[idB];
    const wA = rate(A, classic), wB = rate(B, classic);
    const aFast = wA >= wB;
    const fast = aFast ? A : B, slow = aFast ? B : A;
    const wFast = Math.max(wA, wB), wSlow = Math.min(wA, wB);
    const R = wFast / wSlow;

    const cycles = convergents(R, 5000).map(([p, q]) => {
      const L = p * 360 / wFast;                    // parameter length
      const miss = wrap180(wSlow * L - q * 360);    // slow planet's shortfall
      return {
        key: p + ':' + q, p, q, L, miss,
        // Real cycle length: p orbits of the inner (truly faster) planet.
        // Under classic the parameter isn't time, so this is the real
        // cycle the same ratio stands for.
        years: p * Math.min(A.period, B.period),
        symmetry: Math.abs(p - q),
        lines: p,                                   // x detail = total lines
      };
    }).filter(c => c.p >= 1 && c.q >= 1 && c.p * 8 <= LINE_BUDGET);
    if (!cycles.length) cycles.push({ key: '1:1', p: 1, q: 1, L: 360 / wFast,
      miss: 0, years: Math.min(A.period, B.period), symmetry: 0, lines: 1 });

    // Default: first cycle that closes to within CLOSE_ENOUGH_DEG and fits
    // the budget at a modest detail; otherwise the tightest one that fits.
    const fits = c => c.p * 90 <= LINE_BUDGET;
    let auto = cycles.find(c => Math.abs(c.miss) <= CLOSE_ENOUGH_DEG && fits(c))
            || cycles.filter(fits).pop() || cycles[0];
    let cycle = cycles.find(c => c.key === opts.cycleKey) || auto;

    const maxDetail = Math.floor(LINE_BUDGET / cycle.p);
    const detail = Math.max(4, Math.min(opts.detail, maxDetail));
    const N = cycle.p * detail;                     // steps in one cycle
    const dParam = cycle.L / N;
    const yearsPerStep = cycle.years / N;
    // Correct orbits run counter-clockwise seen from above the Sun's north
    // pole (screen y points down, so flip). Classic keeps v2's direction.
    const ySign = classic ? 1 : -1;
    const DEG = Math.PI / 180;

    function positions(k) {
      const t = k * dParam;
      const aA = wA * t * DEG, aB = wB * t * DEG;
      return [
        A.au * Math.cos(aA), ySign * A.au * Math.sin(aA),
        B.au * Math.cos(aB), ySign * B.au * Math.sin(aB),
      ];
    }

    // Real-orbit facts — always from true periods, even under classic.
    const synodic = A.period === B.period ? Infinity
      : 1 / Math.abs(1 / A.period - 1 / B.period);

    return {
      A, B, classic, fast, slow, wA, wB, R,
      cycles, cycle, autoKey: auto.key, isAuto: cycle === auto,
      detail, detailClamped: detail < opts.detail, maxDetail,
      N, dParam, yearsPerStep,
      daysPerLine: classic ? null : dParam * 365.25,
      positions,
      orbitsAt: k => [wA * k * dParam / 360, wB * k * dParam / 360],
      cycleOrbits: [wA * cycle.L / 360, wB * cycle.L / 360].map(Math.round),
      synodic,
      closest: Math.abs(A.au - B.au),
      farthest: A.au + B.au,
      maxAU: Math.max(A.au, B.au),
    };
  }

  const PRESETS = [
    { id: 'venus-rose',        a: 'earth',   b: 'venus',   title: 'Earth & Venus',   note: 'the 8-year rose' },
    { id: 'earth-mars',        a: 'earth',   b: 'mars',    title: 'Earth & Mars',    note: '15 years' },
    { id: 'mercury-venus',     a: 'mercury', b: 'venus',   title: 'Mercury & Venus', note: 'the inner lace' },
    { id: 'venus-mars',        a: 'venus',   b: 'mars',    title: 'Venus & Mars',    note: 'nearly 3 : 1' },
    { id: 'great-conjunction', a: 'jupiter', b: 'saturn',  title: 'Jupiter & Saturn', note: 'the 60-year triangle', cycle: '5:2' },
    { id: 'ice-giants',        a: 'uranus',  b: 'neptune', title: 'Uranus & Neptune', note: 'nearly 2 : 1' },
    { id: 'pluto-lock',        a: 'neptune', b: 'pluto',   title: 'Neptune & Pluto', note: 'a true 3 : 2 lock', cycle: '3:2' },
  ];

  return { PLANETS, SUN, byId, PRESETS, LINE_BUDGET, makePair, convergents };
})();
