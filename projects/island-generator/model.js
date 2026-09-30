// Island Generator v5.0 — the model
// © Jesal Mehta, @cabofcuriosity
// Based on Perlin Contour v1.0–v4.3 (2020)
//
// Pure maths, no DOM, no p5. Everything about the terrain lives here:
//   noise      — seeded 2D Perlin noise, fBm, ridged fBm
//   centres    — island centres generated from the seed (+ user-placed ones)
//   elevation  — height(x, y) in page units, the one terrain function
//   field      — a sampled grid of heights over any rectangle
//   levels     — sea level (as a share of the page under water) and bands
//   contours   — marching squares → chained polylines / closed rings
//
// Page units: the page is 1 wide and `aspect` tall (A-series portrait
// is 1 × √2). Everything — centres, sizes, feature scale — is measured
// against the page width, so a map looks the same at any export size.

window.IG = window.IG || {};

(function () {

  // ── Seeded random (mulberry32) ──
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ── 2D Perlin (gradient) noise, seeded permutation ──
  // Returns roughly -1..1.
  function makeNoise(seed) {
    const r = rng(seed * 7919 + 1);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    // 8 gradient directions
    const GX = new Float32Array([1, -1, 1, -1, 1.4142, -1.4142, 0, 0]);
    const GY = new Float32Array([1, 1, -1, -1, 0, 0, 1.4142, -1.4142]);

    return function noise(x, y) {
      const xf = Math.floor(x), yf = Math.floor(y);
      const X = xf & 255, Y = yf & 255;
      x -= xf; y -= yf;
      const u = x * x * x * (x * (x * 6 - 15) + 10);
      const v = y * y * y * (y * (y * 6 - 15) + 10);
      const aa = perm[perm[X] + Y] & 7, ab = perm[perm[X] + Y + 1] & 7;
      const ba = perm[perm[X + 1] + Y] & 7, bb = perm[perm[X + 1] + Y + 1] & 7;
      const n00 = GX[aa] * x + GY[aa] * y;
      const n10 = GX[ba] * (x - 1) + GY[ba] * y;
      const n01 = GX[ab] * x + GY[ab] * (y - 1);
      const n11 = GX[bb] * (x - 1) + GY[bb] * (y - 1);
      const nx0 = n00 + u * (n10 - n00), nx1 = n01 + u * (n11 - n01);
      return (nx0 + v * (nx1 - nx0)) * 0.7071;
    };
  }

  const OCTAVES = 6;

  // Smooth minimum of distances (log-sum-exp, width 0.12 R). A hard
  // min() creases the mask where the nearest centre or spine segment
  // switches; this rounds those seams off.
  function smin(ds) {
    if (ds.length === 1) return ds[0];
    const k = 0.12;
    let m = Infinity; for (const d of ds) if (d < m) m = d;
    let sum = 0; for (const d of ds) sum += Math.exp(-(d - m) / k);
    return m - k * Math.log(sum);
  }

  // ── Parameters → a terrain object with height(x, y) ──
  //
  // P (all from settings):
  //   seed, scale (features across the page width), rough (0..1, octave
  //   gain), ridges (0..1), warp (0..1), peak (exponent), focus (0..1),
  //   shape ('points' | 'edge' | 'line'), count, size, extra (user centres
  //   [{x,y}]), removed (indices of generated centres the user deleted),
  //   moved ({index: {x,y}}), aspect
  function makeTerrain(P) {
    const n1 = makeNoise(P.seed), n2 = makeNoise(P.seed + 101), n3 = makeNoise(P.seed + 202);
    const freq = P.scale;                       // noise cycles per page width
    const gain = 0.3 + 0.45 * P.rough;          // 0.3 smooth … 0.75 chaotic
    // Normalise fBm by its spread, not its peak: summed octaves partly
    // cancel, and dividing by the amplitude sum left heights bunched in a
    // narrow band (sd ≈ 0.06) that any island mask swamped into circles.
    // Dividing by √Σa² keeps sd ≈ 0.16 in e at every roughness.
    let ampSq = 0, ampSum = 0;
    for (let o = 0, a = 1; o < OCTAVES; o++, a *= gain) { ampSq += a * a; ampSum += a; }
    const norm = 1.4 / Math.sqrt(ampSq), rnorm = 1 / ampSum;
    const warpAmt = P.warp * 0.12;                 // page units, per unit of warp noise
    const ridges = P.ridges, peak = P.peak, focus = P.focus;
    const ox = 37.1, oy = 11.7;                 // keep off the lattice origin

    const centres = makeCentres(P);
    const R = P.size;                           // island radius, page units
    const A = P.aspect;

    // distance field for the mask, 0 at the focus → 1 at radius R
    let maskDist;
    if (P.shape === 'edge') {
      // Land rises away from one page edge; `angle` of the first centre's
      // position picks the edge: the coast runs across the page and land
      // lies towards the first centre.
      const c = centres[0] || { x: 0.5, y: A * 0.5 };
      // direction from page centre to the centre point (default: down)
      let dx = c.x - 0.5, dy = c.y - A * 0.5;
      const L = Math.hypot(dx, dy);
      if (L < 1e-3) { dx = 0; dy = 1; } else { dx /= L; dy /= L; }
      // project; 0 at the land-side, growing towards the sea side
      const ext = Math.abs(dx) * 0.5 + Math.abs(dy) * A * 0.5;   // half-extent along dir
      maskDist = (x, y) => {
        const s = (x - 0.5) * dx + (y - A * 0.5) * dy;        // -ext … +ext
        return (ext - s) / (2 * R * 1.6);
      };
    } else if (P.shape === 'line' && centres.length >= 2) {
      // A spine through the centres in order: distance to the polyline.
      maskDist = (x, y) => {
        const ds = [];
        for (let i = 0; i < centres.length - 1; i++) {
          const a = centres[i], b = centres[i + 1];
          const vx = b.x - a.x, vy = b.y - a.y, wx = x - a.x, wy = y - a.y;
          const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
          ds.push(Math.hypot(wx - vx * t, wy - vy * t) / R);
        }
        return smin(ds);
      };
    } else {
      // Points (and 'line' with a single centre): nearest centre — to-do (e).
      maskDist = (x, y) => {
        const ds = [];
        for (let i = 0; i < centres.length; i++) ds.push(Math.hypot(x - centres[i].x, y - centres[i].y) / R);
        return smin(ds);
      };
    }
    const noCentres = centres.length === 0 && P.shape !== 'edge';

    function fbm(noise, x, y) {
      let s = 0, a = 1, f = 1;
      for (let o = 0; o < OCTAVES; o++) { s += a * noise(x * f, y * f); a *= gain; f *= 2.03; }
      return s * norm;
    }
    function ridged(noise, x, y) {
      let s = 0, a = 1, f = 1, prev = 1;
      for (let o = 0; o < OCTAVES; o++) {
        let r = 1 - Math.abs(noise(x * f, y * f) * 1.4);
        r = r * r * prev;                    // sharper crests, detail rides on ridges
        prev = Math.min(1, r * 1.6);
        s += a * r; a *= gain; f *= 2.03;
      }
      return s * rnorm;                        // ~0..1
    }

    // The one terrain function. x, y in page units. Returns ~0..1.
    function height(x, y) {
      // Coast warp bends the page itself — noise *and* mask — so coastlines
      // wander instead of tracing circles round the centres.
      if (warpAmt > 0) {
        const bx = x * freq + ox, by = y * freq + oy;
        x += fbm(n2, bx * 0.5, by * 0.5) * warpAmt;
        y += fbm(n3, bx * 0.5 + 5.2, by * 0.5 + 1.3) * warpAmt;
      }
      const nx = x * freq + ox, ny = y * freq + oy;
      let e = fbm(n1, nx, ny) * 0.5 + 0.5;                                 // 0..1
      if (ridges > 0) e = e * (1 - ridges) + ridged(n2, nx * 0.7 + 9.1, ny * 0.7 + 3.3) * ridges;
      e = Math.max(0, Math.min(1, e));
      e = Math.pow(e, peak);                                              // v3's exponent
      if (focus > 0 && !noCentres) {
        const d = maskDist(x, y);
        // 0.7 at the focus, 0 one Island factor out, easing towards −0.56.
        // v5.0–v5.6 clamped d at 1.8 with a hard min(): the lift's slope
        // switched off in one step, creasing the terrain along a line at
        // 1.8 R (parallel to a spine, round an island, along a coast).
        // tanh eases into the same limit with no crease.
        const g = 0.7 * (1 - 1.8 * Math.tanh(d / 1.8));
        e = e * (1 - focus) + ((e + g) / 2) * focus;                      // v4's (1 + e − d) / 2
      }
      return e;
    }

    return { height, centres };
  }

  // ── Island centres from the seed ──
  // Generated with a simple dart-throw so they spread out, then user edits
  // (moves, removals, additions) are applied on top.
  function generatedCentres(P) {
    const r = rng(P.seed * 31 + 7);
    const A = P.aspect, out = [];
    const n = P.count;
    if (n === 1) return [{ x: 0.5, y: A * 0.5, gen: 0 }];
    const margin = Math.min(0.3, P.size * 0.6);
    const minD = Math.sqrt((1 * A) / n) * 0.55;
    for (let i = 0; i < n; i++) {
      let best = null, bestD = -1;
      for (let t = 0; t < 30; t++) {
        const c = { x: margin + r() * (1 - 2 * margin), y: margin + r() * (A - 2 * margin) };
        let d = Infinity;
        for (const o of out) d = Math.min(d, Math.hypot(o.x - c.x, o.y - c.y));
        if (d >= minD) { best = c; break; }
        if (d > bestD) { bestD = d; best = c; }
      }
      best.gen = i;
      out.push(best);
    }
    // For a spine ('line'), order them along the long axis of the page.
    if (P.shape === 'line') out.sort((a, b) => (A >= 1 ? a.y - b.y : a.x - b.x));
    return out;
  }
  function makeCentres(P) {
    const gen = generatedCentres(P).filter(c => !(P.removed || []).includes(c.gen));
    for (const c of gen) {
      const m = P.moved && P.moved[c.gen];
      if (m) { c.x = m.x; c.y = m.y; }
    }
    const extra = (P.extra || []).map((c, i) => ({ x: c.x, y: c.y, extra: i }));
    return gen.concat(extra);
  }

  // ── Sample the field over a page-unit rectangle ──
  // Returns { w, h, data: Float32Array, x0, y0, dx, dy }.
  // Chunked: `sampleField(...).run(budgetMs)` returns true when finished,
  // so large grids can be spread across frames without freezing the page.
  function sampleField(terrain, rect, w, h) {
    const data = new Float32Array(w * h);
    const dx = rect.w / w, dy = rect.h / h;
    let row = 0;
    const job = {
      w, h, data, x0: rect.x + dx / 2, y0: rect.y + dy / 2, dx, dy, done: false,
      rowsDone: () => row,
      run(budgetMs) {
        const t0 = performance.now();
        const H = terrain.height;
        while (row < h) {
          const y = job.y0 + row * dy, o = row * w;
          for (let i = 0; i < w; i++) data[o + i] = H(job.x0 + i * dx, y);
          row++;
          if (budgetMs != null && performance.now() - t0 > budgetMs) break;
        }
        job.done = row >= h;
        return job.done;
      },
    };
    return job;
  }

  // ── Levels ──
  // Sea level is given as the share of the page under water (0..1). It is
  // resolved against a reference sample of the page itself, so panning or
  // zooming the view never moves the coastline, and peakiness (a monotonic
  // curve) reshapes the relief without moving the coast.
  function pageReference(terrain, aspect) {
    const w = 96, h = Math.max(8, Math.round(96 * aspect));
    const job = sampleField(terrain, { x: 0, y: 0, w: 1, h: aspect }, w, h);
    job.run();
    const sorted = Float32Array.from(job.data).sort();
    return { sorted, min: sorted[0], max: sorted[sorted.length - 1], grid: job };
  }
  function levels(ref, sea, bands) {
    const s = ref.sorted, n = s.length;
    const i = Math.max(0, Math.min(n - 1, Math.round(sea * (n - 1))));
    const seaE = sea <= 0 ? ref.min - 1e-6 : sea >= 1 ? ref.max + 1e-6 : s[i];
    const top = Math.max(seaE + 1e-6, ref.max);
    // bands = 0 is smooth, unbanded shading; the coast is still a contour.
    const step = (top - seaE) / Math.max(1, bands);
    const list = [seaE];                               // contour elevations, coast first
    for (let b = 1; b < bands; b++) list.push(seaE + b * step);
    // The same number of bands below the sea as above it: land is cut from
    // the coast up to the highest point, the sea from the coast down to the
    // deepest. Each side gets its own step, since the sea floor is often
    // much deeper than any hill is high.
    const depthStep = Math.max(1e-6, (seaE - ref.min) / Math.max(1, bands));
    return { sea: seaE, top, step, bands, list, min: ref.min, depthStep };
  }

  // ── Marching squares ──
  // Isoline at `level` over a field grid. Returns an array of polylines
  // (arrays of [x, y] in grid-sample coordinates). Segments are chained by
  // shared cell edges; closed rings repeat their first point at the end.
  // pad: treat everything outside the grid as -Infinity, so every region
  // above the level closes along the grid border (used for filled layers).
  function isolines(field, level, pad) {
    const { w, h, data } = field;
    const W = pad ? w + 2 : w, H = pad ? h + 2 : h;
    const v = pad
      ? (i, j) => (i <= 0 || j <= 0 || i >= W - 1 || j >= H - 1) ? -Infinity : data[(j - 1) * w + (i - 1)]
      : (i, j) => data[j * w + i];
    const off = pad ? -1 : 0;

    // Edge ids: horizontal edge (i,j)-(i+1,j) → 2*(j*W+i); vertical (i,j)-(i,j+1) → 2*(j*W+i)+1
    const pt = new Map();                   // edge id → [x, y]
    const link = new Map();                 // edge id → [edge ids…] (≤ 2)
    function point(id, x, y) { if (!pt.has(id)) pt.set(id, [x + off, y + off]); }
    function interp(a, b) {
      if (a === -Infinity) return 1; if (b === -Infinity) return 0;
      const t = (level - a) / (b - a); return t < 0 ? 0 : t > 1 ? 1 : t;
    }
    function hEdge(i, j, a, b) { const id = 2 * (j * W + i); point(id, i + interp(a, b), j); return id; }
    function vEdge(i, j, a, b) { const id = 2 * (j * W + i) + 1; point(id, i, j + interp(a, b)); return id; }
    function seg(e1, e2) {
      (link.get(e1) || link.set(e1, []).get(e1)).push(e2);
      (link.get(e2) || link.set(e2, []).get(e2)).push(e1);
    }

    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        const code = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (d >= level ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const top = () => hEdge(i, j, a, b), right = () => vEdge(i + 1, j, b, c);
        const bottom = () => hEdge(i, j + 1, d, c), left = () => vEdge(i, j, a, d);
        switch (code) {
          case 1: case 14: seg(left(), bottom()); break;
          case 2: case 13: seg(bottom(), right()); break;
          case 3: case 12: seg(left(), right()); break;
          case 4: case 11: seg(top(), right()); break;
          case 6: case 9: seg(top(), bottom()); break;
          case 7: case 8: seg(left(), top()); break;
          case 5: case 10: {
            const centre = (a + b + c + d) / 4 >= level;
            if ((code === 5) === centre) { seg(left(), top()); seg(bottom(), right()); }
            else { seg(left(), bottom()); seg(top(), right()); }
            break;
          }
        }
      }
    }

    // Chain: start from open ends (degree 1) first, then remaining rings.
    const used = new Set(), lines = [];
    function walk(start) {
      const line = [pt.get(start)]; used.add(start);
      let prev = -1, cur = start;
      for (;;) {
        const nb = link.get(cur); let next = -1;
        for (const e of nb) if (e !== prev && !used.has(e)) { next = e; break; }
        if (next === -1) {
          // closed ring: back to start
          if (nb.includes(start) && line.length > 2) line.push(line[0]);
          break;
        }
        line.push(pt.get(next)); used.add(next); prev = cur; cur = next;
      }
      return line;
    }
    for (const [id, nb] of link) if (nb.length === 1 && !used.has(id)) lines.push(walk(id));
    for (const id of link.keys()) if (!used.has(id)) lines.push(walk(id));
    return lines;
  }

  // Ramer–Douglas–Peucker, keeps first/last (and closure).
  function simplify(line, tol) {
    if (line.length < 4 || tol <= 0) return line;
    const keep = new Uint8Array(line.length); keep[0] = keep[line.length - 1] = 1;
    const stack = [[0, line.length - 1]], t2 = tol * tol;
    while (stack.length) {
      const [s, e] = stack.pop();
      const [ax, ay] = line[s], [bx, by] = line[e];
      const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
      let best = -1, bi = -1;
      for (let i = s + 1; i < e; i++) {
        const wx = line[i][0] - ax, wy = line[i][1] - ay;
        let d;
        if (L === 0) d = wx * wx + wy * wy;
        else { const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / L)); const px = wx - vx * t, py = wy - vy * t; d = px * px + py * py; }
        if (d > best) { best = d; bi = i; }
      }
      if (best > t2) { keep[bi] = 1; stack.push([s, bi], [bi, e]); }
    }
    return line.filter((_, i) => keep[i]);
  }

  // ── Engraved relief: shared pieces (v5.7) ──
  // Bilinear height lookup, clamped to the grid.
  function sampler(field) {
    const { w, h, data } = field;
    return (x, y) => {
      x = x < 0 ? 0 : x > w - 1.001 ? w - 1.001 : x; y = y < 0 ? 0 : y > h - 1.001 ? h - 1.001 : y;
      const i = x | 0, j = y | 0, u = x - i, v = y - j, o = j * w + i;
      const a = data[o], b = data[o + 1], c = data[o + w], d = data[o + w + 1];
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    };
  }
  // Slope scale: the 90th percentile of gradient on land, so "steep" is
  // relative to this landscape, whatever the sampling.
  function steepSlope(field, sea) {
    const { w, h, data } = field, mags = [];
    for (let j = 1; j < h - 1; j += 3) for (let i = 1; i < w - 1; i += 3) {
      const o = j * w + i;
      if (data[o] < sea) continue;
      mags.push(Math.hypot(data[o + 1] - data[o - 1], data[o + w] - data[o - w]) / 2);
    }
    mags.sort((a, b) => a - b);
    return (mags.length && mags[Math.floor(mags.length * 0.9)]) || 1e-6;
  }
  // Sun weighting (Dufour): 0 for a slope facing the light, 1 facing away.
  // light is a unit vector pointing towards the sun, in grid axes (y down);
  // a slope faces its downhill direction, minus the gradient.
  function shade(gx, gy, light) {
    const m = Math.hypot(gx, gy) || 1;
    return (1 + (gx * light[0] + gy * light[1]) / m) / 2;
  }
  // Smoothed copy of a field: three box blurs, close to a Gaussian. Relief
  // strokes are traced on this, so they follow the landform, not every
  // ripple of the noise (Davison smooths his DEM the same way first).
  function blurField(field, r) {
    const { w, h } = field;
    if (r < 1) return field;
    let a = Float32Array.from(field.data), b = new Float32Array(w * h);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {
        let sum = 0, n = 0;
        for (let x = -r; x < w + r; x++) {
          if (x + r < w) { sum += a[y * w + x + r]; n++; }
          if (x - r - 1 >= 0) { sum -= a[y * w + x - r - 1]; n--; }
          if (x >= 0 && x < w) b[y * w + x] = sum / n;
        }
      }
      [a, b] = [b, a];
      for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let y = -r; y < h + r; y++) {
          if (y + r < h) { sum += a[(y + r) * w + x]; n++; }
          if (y - r - 1 >= 0) { sum -= a[(y - r - 1) * w + x]; n--; }
          if (y >= 0 && y < h) b[y * w + x] = sum / n;
        }
      }
      [a, b] = [b, a];
    }
    return { w, h, data: a };
  }

  // ── Hachures (v5.6, reworked v5.7) ──
  // Engraved-map relief (Lehmann, 1799): strokes that run down the slope,
  // one row at a time, from each contour to the next. Two passes per row
  // (v5.6.1): strokes seeded every `pitch` along the upper contour run
  // downhill to the lower one, then strokes seeded along the lower contour
  // run uphill into whatever space is still empty. A coarse occupancy grid
  // stops a stroke that meets another. Neighbouring rows are staggered.
  //
  // `list` holds the rows' contour heights: since v5.7 several rows per
  // display band (finer, as in Davison's dynamic hachures), so strokes are
  // short and near-straight and the rows stop reading as terraces.
  //
  // opts: pitch, step (grid units), maxSteps (the length cap), flat (slope
  // weight below which ground is left white), stopFlat (a stroke ends where
  // the ground flattens below this share of the landscape's steep slope:
  // there the uphill direction is noise, and strokes wander).
  // Returns [{ pts: [[x, y]…], t, gx, gy }]: t = slope 0…1, (gx, gy) the
  // stroke's summed gradient. Sun weighting is left to the caller
  // (shade()), so moving the light never retraces a stroke.
  //
  // A generator (v5.8.1): it yields after each pass of each row, so the
  // screen can trace a little per frame and drop the work when the view
  // moves. hachures() runs it to the end in one go (exports).
  function* hachuresSteps(field, list, opts) {
    const { w, h } = field;
    const at = sampler(field), g90 = steepSlope(field, list[0]);
    const strokes = [], nB = list.length, st = opts.stats;

    // Trace from (x, y) along the gradient: dir +1 uphill until `stop` is
    // reached from below, -1 downhill until it's reached from above.
    // Ends early on flat ground, at the edge, or on meeting another stroke.
    function trace(x, y, dir, stop, occ, cellOf) {
      const pts = [[x, y]]; let slopeSum = 0, n = 0, sx = 0, sy = 0;
      for (let it = 0; it < opts.maxSteps; it++) {
        const gx = at(x + 0.5, y) - at(x - 0.5, y), gy = at(x, y + 0.5) - at(x, y - 0.5);
        const m = Math.hypot(gx, gy);
        if (m < 1e-7 || m < opts.stopFlat * g90) { if (st) st.flat++; break; }
        const nx = x + dir * gx / m * opts.step, ny = y + dir * gy / m * opts.step;
        if (nx < 0 || ny < 0 || nx > w - 1 || ny > h - 1) { if (st) st.edge++; break; }
        const e = at(nx, ny);
        if (dir > 0 ? e >= stop : e <= stop) { pts.push([nx, ny]); if (st) st.contour++; break; }
        const c = cellOf(nx, ny);
        if (occ[c] && c !== cellOf(x, y)) { if (st) st.occupied++; break; }
        x = nx; y = ny; pts.push([x, y]); slopeSum += m; n++; sx += gx; sy += gy;
      }
      return { pts, slope: n ? slopeSum / n : 0, gx: sx, gy: sy };
    }
    // Walk a contour, calling fn(x, y) every `pitch` along it.
    function along(poly, pitch, start, fn) {
      let need = start;
      for (let k = 1; k < poly.length; k++) {
        const [x0, y0] = poly[k - 1], [x1, y1] = poly[k];
        const L = Math.hypot(x1 - x0, y1 - y0);
        let pos = 0;
        while (need <= L - pos) { pos += need; need = pitch; fn(x0 + (x1 - x0) * pos / L, y0 + (y1 - y0) * pos / L); }
        need -= L - pos;
      }
    }

    let loRings = null;                          // this row's lower contour: last row's upper one
    for (let b = 0; b < nB; b++) {
      const lo = list[b], hi = b + 1 < nB ? list[b + 1] : Infinity;
      const pitch = opts.pitch;
      const hiRings = hi !== Infinity ? isolines(field, hi, false) : [];
      if (!loRings) loRings = isolines(field, lo, false);
      const cell = Math.max(0.5, pitch * 0.55), cw = Math.ceil(w / cell) + 1;
      const occ = new Uint8Array(cw * (Math.ceil(h / cell) + 1));
      const cellOf = (x, y) => ((y / cell) | 0) * cw + ((x / cell) | 0);
      const stagger = (b % 2) ? pitch * 0.5 : pitch * 0.25;
      const keep = (r) => {
        if (r.pts.length < 2) return;
        for (const [px, py] of r.pts) occ[cellOf(px, py)] = 1;
        const t = Math.min(1, r.slope / g90);
        if (t < opts.flat) return;                         // near-flat ground stays white
        strokes.push({ pts: r.pts, t, gx: r.gx, gy: r.gy });
      };
      // Pass 1: from the upper contour, downhill. Strokes fan out going
      // down a hill, so nearly all of them reach the lower contour. (The
      // first build traced uphill from the lower contour; going up a hill
      // strokes converge, and ~60% stopped early on a neighbour, which
      // read as terraces.)
      for (const poly of hiRings) along(poly, pitch, stagger, (x, y) => {
        if (!occ[cellOf(x, y)]) keep(trace(x, y, -1, lo, occ, cellOf));
      });
      yield;
      // Pass 2: from the lower contour, uphill, only into space still
      // empty. This fills the wedges that open between fanning strokes,
      // and is the only pass for the top band (it runs to the summit).
      for (const poly of loRings) along(poly, pitch, stagger, (x, y) => {
        if (!occ[cellOf(x, y)]) keep(trace(x, y, +1, hi, occ, cellOf));
      });
      loRings = hiRings;
      yield;
    }
    return strokes;
  }
  // Run a step generator to its end and return its result.
  function finish(gen) { let r; while (!(r = gen.next()).done); return r.value; }
  const hachures = (...a) => finish(hachuresSteps(...a));

  // ── Stipple (v5.7) ──
  // Short strokes down the slope, not tied to contours: each is centred on
  // a seed and grows longer as the ground gets steeper (lenMin…lenMax), so
  // steep ground fills with long dark strokes and gentle ground thins to
  // flecks. Seeds are a jittered grid, shuffled; a stroke stops short when
  // it comes within about `spacing` of one already drawn, and is dropped if
  // that leaves it under half of lenMin.
  // opts: spacing, lenMin, lenMax, step (grid units), flat, seed.
  // Returns [{ pts, t, gx, gy }], as hachures(). A generator like
  // hachuresSteps(), yielding every 1024 seeds.
  function* stippleSteps(field, sea, opts) {
    const { w, h } = field, at = sampler(field), g90 = steepSlope(field, sea);
    const grad = (x, y) => [at(x + 0.5, y) - at(x - 0.5, y), at(x, y + 0.5) - at(x, y - 0.5)];
    const cell = Math.max(0.5, opts.spacing * 0.5), cw = Math.ceil(w / cell) + 2;
    const occ = new Uint8Array(cw * (Math.ceil(h / cell) + 2));
    const cellOf = (x, y) => ((y / cell) | 0) * cw + ((x / cell) | 0);
    // free: no other stroke within one cell of (x, y)
    const free = (x, y, own) => {
      const ci = (x / cell) | 0, cj = (y / cell) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const c = (cj + dj) * cw + ci + di;
        if (c >= 0 && occ[c] && c !== own) return false;
      }
      return true;
    };
    // One seed per occupancy cell: finer seeding can't place more strokes.
    // (Seeding at spacing / 2 regardless meant ~11 M seeds on screen, where
    // the cell floor of half a sample is coarser than the spacing.)
    const r = rng(opts.seed || 1), seeds = [], gap = cell;
    for (let y = 0; y < h; y += gap) for (let x = 0; x < w; x += gap) seeds.push([x + r() * gap, y + r() * gap]);
    yield;
    for (let i = seeds.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [seeds[i], seeds[j]] = [seeds[j], seeds[i]]; }
    yield;
    const out = [], step = opts.step;
    let n = 0;
    for (const [sx, sy] of seeds) {
      if ((++n & 1023) === 0) yield;
      if (sx > w - 1 || sy > h - 1 || at(sx, sy) < sea || !free(sx, sy, -1)) continue;
      const g0 = grad(sx, sy), t = Math.min(1, Math.hypot(g0[0], g0[1]) / g90);
      if (t < opts.flat) continue;
      const half = (opts.lenMin + (opts.lenMax - opts.lenMin) * t) / 2;
      const run = (dir) => {
        const pts = []; let x = sx, y = sy, len = 0;
        while (len < half) {
          const g = grad(x, y), m = Math.hypot(g[0], g[1]); if (m < 1e-7) break;
          const nx = x + dir * g[0] / m * step, ny = y + dir * g[1] / m * step;
          if (nx < 0 || ny < 0 || nx > w - 1 || ny > h - 1 || at(nx, ny) < sea || !free(nx, ny, cellOf(x, y))) break;
          x = nx; y = ny; len += step; pts.push([x, y]);
        }
        return pts;
      };
      const up = run(1), down = run(-1);
      if ((up.length + down.length) * step < opts.lenMin * 0.5) continue;
      const pts = up.reverse().concat([[sx, sy]], down);
      for (const [px, py] of pts) occ[cellOf(px, py)] = 1;
      out.push({ pts, t, gx: g0[0], gy: g0[1] });
    }
    return out;
  }
  const stipple = (...a) => finish(stippleSteps(...a));

  // ── Distance from land (v5.6), for water-lining ──
  // Exact Euclidean distance transform (Felzenszwalb & Huttenlocher) of the
  // cells below `level`, in grid units; 0 on land. Isolines of it are the
  // lines that follow the coast out to sea.
  function distanceFromLand(field, level) {
    const { w, h, data } = field, BIG = 1e20;
    const g = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = data[i] >= level ? 0 : BIG;
    const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n);
    const v = new Int32Array(n), z = new Float64Array(n + 1);
    function pass(len) {
      let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
      for (let q = 1; q < len; q++) {
        let s;
        for (;;) {
          const p = v[k];
          s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
          if (s <= z[k] && k > 0) k--; else break;
        }
        if (s <= z[k]) { v[0] = q; z[0] = -Infinity; z[1] = Infinity; k = 0; continue; }
        k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = g[y * w + x];
      pass(h);
      for (let y = 0; y < h; y++) g[y * w + x] = d[y];
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[x] = g[y * w + x];
      pass(w);
      for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(Math.min(d[x], 1e12));
    }
    return { w, h, data: out };
  }

  // ── Page sizes (mm, portrait). 'custom' reads its size from settings. ──
  const PAGES = {
    A5: [148, 210], A4: [210, 297], A3: [297, 420], SQ: [300, 300],
  };
  const PX_CAP = 60e6;   // largest export raster, pixels

  // ── Presets: named points in the same parameter space ──
  // Only the terrain keys; look (style, bands) is left as the user has it.
  const PRESETS = [
    { id: 'island',  title: 'Island',        note: 'one central landmass',
      p: { count: 1, size: 0.55, focus: 0.9, shape: 'points', sea: 0.62, scale: 3, rough: 0.5, ridges: 0.15, warp: 0.3, peak: 1.3 } },
    { id: 'archi',   title: 'Archipelago',   note: 'a scatter of islands',
      p: { count: 9, size: 0.2, focus: 0.95, shape: 'points', sea: 0.72, scale: 5, rough: 0.55, ridges: 0.1, warp: 0.4, peak: 1.2 } },
    { id: 'main',    title: 'Mainland',      note: 'land to every edge',
      p: { count: 1, size: 0.5, focus: 0, shape: 'points', sea: 0.18, scale: 2.5, rough: 0.5, ridges: 0.25, warp: 0.35, peak: 1.1 } },
    { id: 'coast',   title: 'Coastline',     note: 'land meets the sea',
      p: { count: 1, size: 0.45, focus: 0.85, shape: 'edge', sea: 0.45, scale: 3, rough: 0.55, ridges: 0.2, warp: 0.6, peak: 1.2 } },
    { id: 'range',   title: 'Mountain range', note: 'a ridged spine',
      p: { count: 4, size: 0.28, focus: 0.8, shape: 'line', sea: 0.35, scale: 3.5, rough: 0.6, ridges: 0.85, warp: 0.25, peak: 1.6 } },
    { id: 'lakes',   title: 'Lake country',  note: 'low, wet, many pools',
      p: { count: 1, size: 0.5, focus: 0, shape: 'points', sea: 0.3, scale: 7, rough: 0.35, ridges: 0, warp: 0.5, peak: 0.7 } },
  ];

  IG.model = { rng, makeNoise, makeTerrain, sampleField, pageReference, levels, isolines, simplify, blurField, hachures, hachuresSteps, stipple, stippleSteps, finish, shade, distanceFromLand, PAGES, PX_CAP, PRESETS };

})();
