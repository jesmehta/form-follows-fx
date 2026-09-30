// Island Generator v5.8 — the sketch
// © Jesal Mehta, @cabofcuriosity
// Based on Perlin Contour v1.0–v4.3 (2020)
//
// Draws only when something changed (the 2020 to-do (b)). Work is split
// by what a change touches (see ISLAND-GENERATOR.md, "Tiers"):
//   terrain — rebuild the height function, the page reference, the field
//   view    — resample the field for the new window/zoom/pan
//   levels  — recolour / re-contour the field already sampled
//   overlay — page frame and island markers only
//
// The screen field is sampled progressively: a coarse pass first (sized so
// it takes ~25 ms), then finer passes spread across frames, so sliders stay
// live and the full-resolution picture settles in behind them.

new p5(function (s) {

  const M = IG.model;
  const S = IG.settings;              // owned by ui.js

  let terrain = null, ref = null, lv = null;
  let field = null, fieldStep = 0, job = null, jobStep = 0, steps = [];
  let img = null, imgCtx = null;      // field-sized canvas holding the coloured raster
  let lines = null;                   // [{level, index, kind, polys}] in grid coords
  let hach = null;                    // hachures, coast and water lines, in grid coords
  let msPerSample = 0.00002;          // learnt, for choosing the first pass
  let dirty = { terrain: true, view: true, levels: true };
  let W = 0, H = 0, statsDue = 0;

  // ── View (v5.5) ──
  // The landscape lives in its own space. Its unit square holds the
  // generated centres and the sea-level reference, so the landscape never
  // depends on the sheet. The sheet is a frame of some aspect ratio, fixed
  // on screen; zoom and pan choose which part of the landscape sits in it,
  // and that is what exports. At zoom 100% the unit square just fits the
  // frame. Sheet: None uses the whole free area as an invisible frame.
  const RATIOS = { A: [1, Math.SQRT2], SQ: [1, 1], '43': [3, 4], '169': [9, 16] };
  function ratio() {                       // sheet [w, h], after orientation
    if (!S.sheet) { const vp = IG.ui.viewport(); return [vp.w, vp.h]; }
    if (S.page === 'custom') return [S.ca, S.cb];
    const r = RATIOS[S.page];
    return S.orient === 'landscape' && S.page !== 'SQ' ? [r[1], r[0]] : r;
  }
  function aspect() { const [w, h] = ratio(); return h / w; }
  function frameScreen() {
    const vp = IG.ui.viewport();
    if (!S.sheet) return { x: vp.x, y: vp.y, w: vp.w, h: vp.h };
    const A = aspect(), w = 0.92 * Math.min(vp.w, vp.h / A), h = w * A;
    return { x: vp.x + (vp.w - w) / 2, y: vp.y + (vp.h - h) / 2, w, h };
  }
  function view() {
    const fr = frameScreen(), A = fr.h / fr.w;
    const home = Math.max(1, 1 / A) / (S.sheet ? 1 : 0.92);   // landscape widths across the frame at 100%
    const ppu = fr.w / home * S.zoom / 100;
    const cx = S.panX != null ? S.panX : 0.5, cy = S.panY != null ? S.panY : 0.5;
    const ox = fr.x + fr.w / 2 - cx * ppu, oy = fr.y + fr.h / 2 - cy * ppu;
    return { ppu, ox, oy, fr,
      toScreen: (x, y) => [ox + x * ppu, oy + y * ppu],
      toPage: (X, Y) => [(X - ox) / ppu, (Y - oy) / ppu] };
  }
  // The landscape rectangle under the frame.
  function frameRect(v) {
    v = v || view();
    const fr = v.fr, [x0, y0] = v.toPage(fr.x, fr.y), [x1, y1] = v.toPage(fr.x + fr.w, fr.y + fr.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // Print size in mm: the long edge is the chosen print size, the short
  // edge follows the ratio. A-series at 210/297/420 is A5/A4/A3.
  function printMM() {
    const [w, h] = ratio(), L = S.print, k = L / Math.max(w, h);
    return [Math.round(w * k), Math.round(h * k)];
  }
  function sheetName() {
    if (!S.sheet) return 'No frame';
    const o = S.page === 'SQ' || S.page === 'custom' ? '' : ' ' + S.orient;
    if (S.page === 'A') return ({ 210: 'A5', 297: 'A4', 420: 'A3' }[S.print] || 'A-series') + o;
    if (S.page === 'custom') return `${S.ca} : ${S.cb}`;
    return ({ SQ: 'Square', '43': '4 : 3', '169': '16 : 9' }[S.page]) + o;
  }
  function terrainParams() {
    return { seed: S.seed, scale: S.scale, rough: S.rough, ridges: S.ridges, warp: S.warp,
      peak: S.peak, focus: S.focus, shape: S.shape, count: S.count, size: S.size,
      extra: S.extra, removed: S.removed, moved: S.moved, aspect: 1 };
  }

  // ── Colour ──
  function hsv(h, sat, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * sat * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5) * 255 | 0, f(3) * 255 | 0, f(1) * 255 | 0];
  }
  // Returns (e) → [r, g, b] for the current style and levels.
  function palette(L) {
    const smooth = L.bands === 0;
    const B = smooth ? 256 : L.bands, style = S.style;   // smooth: a fine table, looked up continuously
    const land = [], sea = [];
    for (let b = 0; b < B; b++) {
      const t = B > 1 ? b / (B - 1) : 1;
      if (style === 'thermal') land.push(hsv(270 * (1 - t), 0.92, 0.35 + 0.65 * Math.min(1, t * 1.6 + 0.2)));
      else if (style === 'topo') land.push(ramp(TOPO_LAND, t));
      else { const g = 96 + t * 150 | 0; land.push([g, g, g]); }
    }
    // Sea: flat near-black, or with depth on, shallow → deep in visibly
    // different steps (the first build's were all within a few levels of
    // black, which is why depth "didn't work").
    const SEA = {
      grey:    { flat: [12, 12, 14], shallow: [50, 52, 60], deep: [6, 6, 8] },
      thermal: { flat: [14, 8, 40], shallow: [52, 40, 150], deep: [8, 4, 26] },
      topo:    { flat: [96, 146, 188], shallow: [150, 198, 222], deep: [28, 64, 116] },
    }[style] || { flat: [12, 12, 14], shallow: [50, 52, 60], deep: [6, 6, 8] };
    const seaFlat = SEA.flat, shallow = SEA.shallow, deep = SEA.deep;
    const DN = smooth ? 256 : L.bands;
    for (let d = 0; d < DN; d++) {
      const t = DN > 1 ? d / (DN - 1) : 0;
      sea.push(shallow.map((c, i) => c + (deep[i] - c) * t | 0));
    }
    return e => {
      if (e < L.sea) {
        if (!S.depth) return seaFlat;
        if (smooth) return sea[Math.min(DN - 1, (L.sea - e) / (L.sea - L.min || 1) * (DN - 1) | 0)];
        return sea[Math.min(DN - 1, Math.floor((L.sea - e) / L.depthStep))];
      }
      if (smooth) return land[Math.min(B - 1, (e - L.sea) / (L.top - L.sea) * (B - 1) | 0)];
      return land[Math.min(B - 1, Math.floor((e - L.sea) / L.step))];
    };
  }
  const PAPER = [244, 241, 234], INK = '#2a2622', DEPTH_INK = '#6f8aa6';
  // Topographic: hypsometric tints, low green → tan → brown → rock → snow.
  const TOPO_LAND = [
    [0.00, [88, 142, 86]], [0.22, [148, 172, 98]], [0.42, [212, 196, 128]],
    [0.62, [176, 128, 82]], [0.80, [140, 124, 114]], [1.00, [246, 246, 244]],
  ];
  function ramp(stops, t) {
    for (let i = 1; i < stops.length; i++) {
      const [t1, c1] = stops[i];
      if (t <= t1) {
        const [t0, c0] = stops[i - 1], k = (t - t0) / (t1 - t0 || 1);
        return c0.map((c, j) => c + (c1[j] - c) * k | 0);
      }
    }
    return stops[stops.length - 1][1];
  }
  // Line colour: ink on paper for the Lines style; over colour, a
  // translucent dark line on land and a pale one in dark seas.
  function inkFor(kind) {
    if (S.style === 'lines') return kind === 'depth' ? DEPTH_INK : INK;
    if (S.style === 'hachure') return kind === 'depth' ? DEPTH_INK : 'rgba(42,38,34,0.45)';
    if (kind === 'depth') return S.style === 'topo' ? 'rgba(20,45,90,0.45)' : 'rgba(255,255,255,0.22)';
    return S.style === 'topo' ? 'rgba(45,32,20,0.6)' : 'rgba(0,0,0,0.55)';
  }
  const withLines = () => S.style === 'lines' || S.contours;
  const onPaper = () => S.style === 'lines' || S.style === 'hachure';

  // Engraved relief (hachures or stipple) + coast + water-lining for a
  // field sampled at `spmm` samples per mm of print. Every length here is
  // in mm of print, so the screen shows what prints.
  //   rows    hachure rows: at least 4 per display band and 48 in all, so
  //           strokes stay short whatever the band count (v5.7)
  //   smooth  strokes are traced on the terrain smoothed by this (mm)
  //   lit     weight a fully sunlit slope keeps (0…1)
  const HACH = { pitch: 0.6, step: 0.2, rows: 48, smooth: 1.6, lit: 0.15, flat: 0.12, stopFlat: 0.08,
    stipMin: 0.4, coast: 0.35, water: 0.1, wMin: 0.04, wMax: 0.34, NB: 10 };
  const engraving = () => S.engrave === 'stipple' ? 'stipple' : 'hachures';
  // Everything that moves a stroke; the light only reweights them.
  const hachKey = () => [S.engrave, S.hcap, S.sspace, S.slen, S.seed, lv.sea, lv.top, lv.bands].join();
  function buildHachures(src, spmm) {
    const step = Math.max(0.3, HACH.step * spmm);
    const smooth = M.blurField(src, Math.round(HACH.smooth * spmm));
    let strokes;
    if (S.engrave === 'stipple') {
      strokes = M.stipple(smooth, lv.sea, { spacing: S.sspace * spmm, lenMin: HACH.stipMin * spmm, lenMax: S.slen * spmm,
        step, flat: HACH.flat, seed: S.seed });
    } else {
      const bands = Math.max(1, lv.bands), sub = Math.max(4, Math.ceil(HACH.rows / bands));
      const rows = [], dz = (lv.top - lv.sea) / (bands * sub);
      for (let i = 0; i < bands * sub; i++) rows.push(lv.sea + i * dz);
      strokes = M.hachures(smooth, rows, { pitch: HACH.pitch * spmm, step, flat: HACH.flat, stopFlat: HACH.stopFlat,
        maxSteps: S.hcap > 0 ? Math.max(1, Math.round(S.hcap * spmm / step)) : 1e5 });
    }
    const coast = M.isolines(src, lv.sea, false);
    // water lines: first 0.6 mm off the coast, gaps widening by 30% each
    const dist = M.distanceFromLand(src, lv.sea), water = [];
    for (let d = 0.6, gap = 0.5, n = 0; n < 10; n++, d += gap, gap *= 1.3) water.push(M.isolines(dist, d * spmm, false));
    return { strokes, coast, water, key: hachKey() };
  }
  // Strokes sorted into NB weight buckets: slope × sun (Dufour), with the
  // light at S.sun compass degrees, turned into grid axes (y down).
  function hachBuckets(strokes, fn) {
    const a = S.sun * Math.PI / 180, light = [Math.sin(a), -Math.cos(a)], lit = HACH.lit;
    const NB = HACH.NB, buckets = Array.from({ length: NB }, () => []);
    for (const s of strokes) {
      const t = s.t * (lit + (1 - lit) * M.shade(s.gx, s.gy, light));
      buckets[Math.min(NB - 1, t * NB | 0)].push(fn(s.pts));
    }
    return buckets;
  }
  function drawHachures(ctx, H, map, pxPerMM) {
    ctx.lineJoin = 'round';
    // water lines, then hachures bucketed by weight (one path per bucket), then the coast
    ctx.lineCap = 'round'; ctx.strokeStyle = '#3d4b5c';
    ctx.lineWidth = Math.max(0.4, HACH.water * pxPerMM);
    ctx.beginPath();
    for (const ring of H.water) for (const poly of ring) poly.forEach((p, i) => { const [x, y] = map(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.lineCap = 'butt'; ctx.strokeStyle = INK;
    const NB = HACH.NB, buckets = hachBuckets(H.strokes, pts => pts);
    buckets.forEach((list, b) => {
      if (!list.length) return;
      ctx.lineWidth = Math.max(0.3, (HACH.wMin + (HACH.wMax - HACH.wMin) * (b + 0.5) / NB) * pxPerMM);
      ctx.beginPath();
      for (const pts of list) pts.forEach((p, i) => { const [x, y] = map(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    });
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.6, HACH.coast * pxPerMM);
    ctx.beginPath();
    for (const poly of H.coast) poly.forEach((p, i) => { const [x, y] = map(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }

  // Contour levels to trace: coast, land bands, and depth lines if shown.
  function traceLevels(L) {
    const out = [];
    L.list.forEach((e, b) => out.push({ e, index: b, kind: b === 0 ? 'coast' : 'land' }));
    // Smooth (0 bands) means smooth under the sea too: depth shading, no depth lines.
    if (S.depth && L.bands > 0) for (let d = 1; d < L.bands; d++) {
      out.push({ e: L.sea - d * L.depthStep, index: -d, kind: 'depth' });
    }
    return out;
  }

  // ── Build steps ──
  function rebuildTerrain() {
    terrain = M.makeTerrain(terrainParams());
    ref = M.pageReference(terrain, 1);
    IG.ui.onTerrain(stats());
  }
  function rebuildLevels() {
    lv = M.levels(ref, S.sea, S.bands);
  }
  function startSampling() {
    const n = W * H;
    // First pass: coarsest step that fits ~25 ms, then halve down to 1
    // (2 for line drawings: finer adds nothing once the lines are smooth).
    let first = 1;
    for (const st of [1, 2, 3, 4, 6, 8, 12]) { first = st; if (n / (st * st) * msPerSample < 25) break; }
    const floor = onPaper() ? 2 : 1;
    steps = [];
    for (let st = first; st > floor; st = Math.max(floor, Math.floor(st / 2))) steps.push(st);
    steps.push(Math.max(floor, Math.min(first, floor)));
    if (steps.length > 1 && steps[steps.length - 1] === steps[steps.length - 2]) steps.pop();
    nextJob();
  }
  function nextJob() {
    if (!steps.length) { job = null; return; }
    jobStep = steps.shift();
    const v = view();
    const w = Math.ceil(W / jobStep), h = Math.ceil(H / jobStep);
    const [x0, y0] = v.toPage(0, 0);
    job = M.sampleField(terrain, { x: x0, y: y0, w: w * jobStep / v.ppu, h: h * jobStep / v.ppu }, w, h);
    job.t0 = performance.now(); job.cpu = 0;
  }

  // Colour the current field into `img` and trace contours if needed.
  function paint() {
    if (!field) return;
    const { w, h, data } = field;
    if (!img || img.width !== w || img.height !== h) {
      img = document.createElement('canvas'); img.width = w; img.height = h;
      imgCtx = img.getContext('2d');
    }
    const id = imgCtx.createImageData(w, h), px = id.data;
    if (onPaper()) {
      for (let i = 0, j = 0; i < w * h; i++, j += 4) { px[j] = PAPER[0]; px[j + 1] = PAPER[1]; px[j + 2] = PAPER[2]; px[j + 3] = 255; }
    } else {
      const col = palette(lv);
      for (let i = 0, j = 0; i < w * h; i++, j += 4) {
        const c = col(data[i]); px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; px[j + 3] = 255;
      }
    }
    lines = null;
    if (withLines()) {
      // Lines are traced at no finer than half resolution: finer adds cost,
      // not smoothness. k = samples of the field per traced sample.
      const k = fieldStep === 1 ? 2 : 1, src = k === 1 ? field : decimate(field, k);
      lines = { k, sets: traceLevels(lv).map(t => ({ ...t, polys: M.isolines(src, t.e, false) })) };
    }
    if (S.style === 'hachure' && fieldStep <= 2) {
      // coarse first passes skip it: hachures only settle in with the field.
      // Kept while only the light changes (it reweights at draw time).
      if (!(hach && hach.field === field && hach.key === hachKey())) {
        const k = fieldStep === 1 ? 2 : 1, src = k === 1 ? field : decimate(field, k);
        const spmm = view().fr.w / printMM()[0] / (fieldStep * k);
        hach = Object.assign(buildHachures(src, spmm), { k, field });
      }
    } else hach = null;
    imgCtx.putImageData(id, 0, 0);
  }

  function decimate(f, k) {
    const w = Math.ceil(f.w / k), h = Math.ceil(f.h / k), data = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) data[j * w + i] = f.data[(j * k) * f.w + i * k];
    return { w, h, data };
  }

  // ── p5 ──
  s.setup = function () {
    const c = s.createCanvas(window.innerWidth, window.innerHeight);
    c.parent('canvas-container');
    W = window.innerWidth; H = window.innerHeight;
    s.frameRate(60);
    IG.ui.refresh();
  };
  s.windowResized = function () {
    W = window.innerWidth; H = window.innerHeight;
    s.resizeCanvas(W, H);
    dirty.view = true;
  };

  s.draw = function () {
    if (dirty.terrain) { rebuildTerrain(); dirty.levels = true; dirty.view = true; }
    if (dirty.levels) { rebuildLevels(); IG.ui.onLevels(lv, stats()); }
    if (dirty.view && !dirty.terrain && !dirty.levels) statsDue = performance.now() + 150;
    if (dirty.terrain || dirty.view) startSampling();
    else if (dirty.levels && field) paint();
    dirty.terrain = dirty.view = dirty.levels = false;
    if (statsDue && performance.now() > statsDue) { statsDue = 0; IG.ui.onTerrain(stats()); }

    if (job) {
      const t = performance.now();
      const finished = job.run(10);
      job.cpu += performance.now() - t;
      if (finished) {
        msPerSample = msPerSample * 0.5 + (job.cpu / (job.w * job.h)) * 0.5;
        field = job; fieldStep = jobStep; field.view = view();
        paint();
        nextJob();
      }
    }
    render(s.drawingContext);
  };

  function render(ctx) {
    const dpr = s.pixelDensity();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = onPaper() ? '#d9d5cc' : '#050508';
    ctx.fillRect(0, 0, W, H);
    const v = view();
    if (img && field) {
      // The field may be from a slightly older view (mid-pan): place it by
      // its own page coordinates so it lines up until the new one lands.
      const fv = field.view;
      const sc = v.ppu / fv.ppu;
      const X = v.ox + (0 - fv.ox) / fv.ppu * v.ppu, Y = v.oy + (0 - fv.oy) / fv.ppu * v.ppu;
      ctx.imageSmoothingEnabled = fieldStep > 1;
      ctx.drawImage(img, X, Y, img.width * fieldStep * sc, img.height * fieldStep * sc);
      const pxPerMM = v.fr.w / printMM()[0];
      if (hach) {
        const k = hach.k, u = fieldStep * sc;
        drawHachures(ctx, hach, (gx, gy) => [X + (gx * k + 0.5) * u, Y + (gy * k + 0.5) * u], pxPerMM);
      }
      if (lines) {
        const k = lines.k, u = fieldStep * sc;
        drawLines(ctx, lines.sets, (gx, gy) => [X + (gx * k + 0.5) * u, Y + (gy * k + 0.5) * u], pxPerMM);
      }
    }
    drawOverlay(ctx, v);
  }

  // Line weights in mm of paper, so the screen shows what prints.
  const MM = { coast: 0.5, index: 0.35, land: 0.18, depth: 0.15 };
  function drawLines(ctx, sets, map, pxPerMM) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const set of sets) {
      const kind = set.kind === 'land' && set.index % 5 === 0 ? 'index' : set.kind;
      ctx.strokeStyle = inkFor(set.kind);
      ctx.lineWidth = Math.max(0.6, MM[kind] * pxPerMM);
      ctx.beginPath();
      for (const poly of set.polys) {
        for (let i = 0; i < poly.length; i++) {
          const [x, y] = map(poly[i][0], poly[i][1]);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function drawOverlay(ctx, v) {
    if (!IG.ui.hudOn()) return;
    if (S.sheet) {
      const x0 = v.fr.x, y0 = v.fr.y, x1 = x0 + v.fr.w, y1 = y0 + v.fr.h;
      // dim outside the page
      ctx.fillStyle = onPaper() ? 'rgba(217,213,204,0.72)' : 'rgba(5,5,8,0.62)';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(200,169,110,0.8)'; ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      const [w, h] = printMM();
      ctx.font = '10px "Space Mono", monospace'; ctx.fillStyle = 'rgba(200,169,110,0.9)';
      ctx.fillText(`${sheetName()} · ${w} × ${h} mm`, x0, y0 - 6);
    }

    if (!S.markers || S.focus <= 0) return;
    const cs = terrain ? terrain.centres : [];
    ctx.lineWidth = 1.5;
    if (S.shape === 'line' && cs.length > 1) {
      ctx.strokeStyle = 'rgba(200,169,110,0.55)'; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      cs.forEach((c, i) => { const [X, Y] = v.toScreen(c.x, c.y); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.stroke(); ctx.setLineDash([]);
    }
    const list = S.shape === 'edge' ? cs.slice(0, 1) : cs;
    for (const c of list) {
      const [X, Y] = v.toScreen(c.x, c.y);
      const hot = hover && hover.c === c;
      ctx.fillStyle = hot ? 'rgba(200,169,110,0.95)' : 'rgba(5,5,8,0.55)';
      ctx.strokeStyle = 'rgba(200,169,110,0.95)';
      ctx.beginPath(); ctx.arc(X, Y, hot ? 7 : 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (S.shape === 'edge') {           // arrow: land lies this way
        const [cx, cy] = v.toScreen(0.5, 0.5);
        const a = Math.atan2(Y - cy, X - cx), L = Math.hypot(X - cx, Y - cy);
        if (L > 12) {
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X - Math.cos(a) * 8, Y - Math.sin(a) * 8); ctx.stroke();
        }
      }
    }
  }

  // ── Stats for the info panel: what's inside the frame ──
  function stats() {
    if (!ref || !terrain) return null;
    const L = M.levels(ref, S.sea, S.bands);
    const r = frameRect(), w = 96, h = Math.max(8, Math.round(96 * r.h / r.w));
    const grid = M.sampleField(terrain, r, w, h); grid.run();
    const d = grid.data, land = new Uint8Array(w * h);
    let nLand = 0;
    for (let i = 0; i < d.length; i++) if (d[i] >= L.sea) { land[i] = 1; nLand++; }
    // connected pieces of land (4-neighbour), ignoring specks; lakes = water
    // pieces that don't touch the page edge
    const comp = (want) => {
      const seen = new Uint8Array(w * h), sizes = []; let touchEdge = [];
      for (let i = 0; i < w * h; i++) {
        if (seen[i] || land[i] !== want) continue;
        let n = 0, edge = false; const st = [i]; seen[i] = 1;
        while (st.length) {
          const k = st.pop(); n++;
          const x = k % w, y = (k / w) | 0;
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
          if (x > 0 && !seen[k - 1] && land[k - 1] === want) { seen[k - 1] = 1; st.push(k - 1); }
          if (x < w - 1 && !seen[k + 1] && land[k + 1] === want) { seen[k + 1] = 1; st.push(k + 1); }
          if (y > 0 && !seen[k - w] && land[k - w] === want) { seen[k - w] = 1; st.push(k - w); }
          if (y < h - 1 && !seen[k + w] && land[k + w] === want) { seen[k + w] = 1; st.push(k + w); }
        }
        if (n >= 3) { sizes.push(n); touchEdge.push(edge); }
      }
      return { sizes, touchEdge };
    };
    const L1 = comp(1), W0 = comp(0);
    const bigLand = Math.max(0, ...L1.sizes);
    return {
      landShare: nLand / (w * h),
      pieces: L1.sizes.length,
      piecesTouchingEdge: L1.touchEdge.filter(Boolean).length,
      largestShare: nLand ? bigLand / nLand : 0,
      lakes: W0.sizes.filter((_, i) => !W0.touchEdge[i]).length,
      bands: L.bands,
      centres: terrain.centres.length,
    };
  }

  // ── Pointer: markers, pan, click-to-add ──
  let hover = null, drag = null;
  const cont = document.getElementById('canvas-container');
  function hit(X, Y) {
    if (!terrain || !S.markers || S.focus <= 0) return null;
    const v = view();
    const list = S.shape === 'edge' ? terrain.centres.slice(0, 1) : terrain.centres;
    for (const c of list) {
      const [x, y] = v.toScreen(c.x, c.y);
      if (Math.hypot(x - X, y - Y) < 11) return { c };
    }
    return null;
  }
  cont.addEventListener('pointermove', e => {
    if (drag) return onDrag(e);
    const h = hit(e.clientX, e.clientY);
    if ((h && h.c) !== (hover && hover.c)) hover = h;
    cont.style.cursor = h ? 'grab' : 'crosshair';
  });
  cont.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cont.setPointerCapture(e.pointerId);
    const h = hit(e.clientX, e.clientY);
    const v = view();
    drag = { x: e.clientX, y: e.clientY, moved: false, marker: h && h.c,
      panX: S.panX != null ? S.panX : 0.5, panY: S.panY != null ? S.panY : 0.5, ppu: v.ppu };
    if (h) cont.style.cursor = 'grabbing';
  });
  function onDrag(e) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    if (drag.marker) {
      const [x, y] = view().toPage(e.clientX, e.clientY);
      IG.ui.moveCentre(drag.marker, x, y);
    } else {
      S.panX = drag.panX - dx / drag.ppu; S.panY = drag.panY - dy / drag.ppu;
      cont.style.cursor = 'move';
      IG.ui.viewMoved();
    }
  }
  cont.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    cont.style.cursor = 'crosshair';
    if (!d.moved && !d.marker) {
      const [x, y] = view().toPage(e.clientX, e.clientY);
      IG.ui.addCentre(x, y);
    }
  });
  cont.addEventListener('dblclick', e => {
    const h = hit(e.clientX, e.clientY);
    if (h) IG.ui.removeCentre(h.c);
  });
  cont.addEventListener('wheel', e => {
    e.preventDefault();
    const v = view();
    const [px, py] = v.toPage(e.clientX, e.clientY);
    const z = Math.min(1600, Math.max(25, S.zoom * Math.exp(-e.deltaY * 0.0012)));
    // keep the point under the cursor fixed
    const cx = S.panX != null ? S.panX : 0.5, cy = S.panY != null ? S.panY : 0.5;
    const k = S.zoom / z;
    S.panX = px - (px - cx) * k; S.panY = py - (py - cy) * k;
    S.zoom = z;
    IG.ui.zoomChanged();
  }, { passive: false });

  // ── Export ──
  // What an export covers: the landscape inside the frame (or the whole
  // free area with Sheet: None), at the print size and dpi.
  function pagePixels(dpi) {
    const rect = frameRect(), [wmm, hmm] = printMM();
    const w = Math.round(wmm / 25.4 * dpi), h = Math.round(hmm / 25.4 * dpi);
    const k = Math.min(1, Math.sqrt(M.PX_CAP / (w * h)));
    return { rect, w: Math.round(w * k), h: Math.round(h * k), wmm, hmm, capped: k < 1, dpi: Math.round(dpi * k) };
  }
  const tick = () => new Promise(r => setTimeout(r, 0));

  // Sample the export area into a grid of (w × h), chunked, reporting progress.
  async function samplePage(rect, w, h, onProgress) {
    const job = M.sampleField(terrain, rect, w, h);
    while (!job.run(40)) { onProgress && onProgress(job.rowsDone() / h); await tick(); }
    return job;
  }
  // Bilinear lookup into a field at fractional sample coords.
  function bilerp(f, x, y) {
    x = Math.max(0, Math.min(f.w - 1.001, x)); y = Math.max(0, Math.min(f.h - 1.001, y));
    const i = x | 0, j = y | 0, u = x - i, t = y - j, d = f.data, o = j * f.w + i;
    const a = d[o], b = d[o + 1], c = d[o + f.w], e = d[o + f.w + 1];
    return (a + (b - a) * u) * (1 - t) + (c + (e - c) * u) * t;
  }
  // The noise's finest octave is far coarser than a print pixel, so the
  // export samples at most ~5 M points and interpolates up; bands are cut
  // from the interpolated heights, so edges stay clean at any size.
  function sampleSize(w, h) {
    const k = Math.min(1, Math.sqrt(5e6 / (w * h)));
    return { sw: Math.max(2, Math.round(w * k)), sh: Math.max(2, Math.round(h * k)) };
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function baseName() {
    const [w, h] = printMM();
    return `island-${S.seed}-${w}x${h}mm`;
  }

  // The sheet as the PNG export draws it, at P's size, onto a new canvas.
  async function renderPage(P, progress) {
    const cv = document.createElement('canvas'); cv.width = P.w; cv.height = P.h;
    const ctx = cv.getContext('2d');
    if (onPaper()) {
      ctx.fillStyle = `rgb(${PAPER})`; ctx.fillRect(0, 0, P.w, P.h);
    } else {
      const { sw, sh } = sampleSize(P.w, P.h);
      const f = await samplePage(P.rect, sw, sh, p => progress(p * (withLines() ? 0.5 : 0.7)));
      const col = palette(lv);
      const band = 256;                         // rows per putImageData
      for (let y0 = 0; y0 < P.h; y0 += band) {
        const rows = Math.min(band, P.h - y0);
        const id = ctx.createImageData(P.w, rows), px = id.data;
        for (let r = 0; r < rows; r++) {
          const fy = (y0 + r + 0.5) * sh / P.h - 0.5;
          for (let x = 0; x < P.w; x++) {
            const c = col(bilerp(f, (x + 0.5) * sw / P.w - 0.5, fy));
            const j = (r * P.w + x) * 4; px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; px[j + 3] = 255;
          }
        }
        ctx.putImageData(id, 0, y0);
        progress((withLines() ? 0.5 : 0.7) + 0.2 * (y0 + rows) / P.h); await tick();
      }
    }
    if (withLines() || S.style === 'hachure') {
      const res = Math.min(4, Math.sqrt(2.5e6 / (P.wmm * P.hmm)));    // samples per mm
      const f = await samplePage(P.rect, Math.round(P.wmm * res), Math.round(P.hmm * res), p => progress(0.7 + p * 0.15));
      const sx = P.w / f.w, sy = P.h / f.h, map = (gx, gy) => [(gx + 0.5) * sx, (gy + 0.5) * sy];
      progress(0.88); await tick();
      if (S.style === 'hachure') drawHachures(ctx, buildHachures(f, res), map, P.w / P.wmm);
      if (withLines()) drawLines(ctx, traceLevels(lv).map(t => ({ ...t, polys: M.isolines(f, t.e, false) })), map, P.w / P.wmm);
    }
    return cv;
  }
  async function exportPNG(progress) {
    const P = pagePixels(S.dpi);
    const cv = await renderPage(P, progress);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const look = (S.style === 'hachure' ? engraving() : S.style) + (S.contours && S.style !== 'lines' ? '+lines' : '');
    const name = `${baseName()}-${look}-${P.dpi}dpi.png`;
    download(blob, name);
    return { name, capped: P.capped };
  }

  // Actual-size preview (v5.8). The main view fits the whole sheet in the
  // window, about 2.5 px per mm for an A4, too coarse for detail cut in
  // fractions of a mm (engraving above all). This renders the sheet
  // exactly as the PNG export does, at twice CSS actual size (96 px per
  // inch) times the screen's pixel ratio, so the preview can show it at
  // actual size and at 2× and stay sharp. Capped at 300 dpi.
  async function previewPage(progress) {
    const dpr = window.devicePixelRatio || 1;
    const P = pagePixels(Math.min(300, 96 * 2 * dpr));
    const canvas = await renderPage(P, progress);
    return { canvas, wmm: P.wmm, hmm: P.hmm, name: sheetName() };
  }

  // 16-bit greyscale PNG of raw elevation (page min → 0, page max → 65535).
  async function exportHeightmap(progress) {
    const P = pagePixels(Math.min(S.dpi, 300));
    const { sw, sh } = sampleSize(P.w, P.h);
    const f = await samplePage(P.rect, sw, sh, p => progress(p * 0.6));
    let lo = Infinity, hi = -Infinity;
    for (const v of f.data) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const span = (hi - lo) || 1;
    const raw = new Uint8Array((P.w * 2 + 1) * P.h);
    for (let y = 0; y < P.h; y++) {
      const o = y * (P.w * 2 + 1); raw[o] = 0;           // filter: none
      const fy = (y + 0.5) * sh / P.h - 0.5;
      for (let x = 0; x < P.w; x++) {
        const v = Math.round((bilerp(f, (x + 0.5) * sw / P.w - 0.5, fy) - lo) / span * 65535);
        raw[o + 1 + x * 2] = v >> 8; raw[o + 2 + x * 2] = v & 255;
      }
      if (y % 256 === 0) { progress(0.6 + 0.3 * y / P.h); await tick(); }
    }
    const blob = await png16(P.w, P.h, raw);
    const name = `${baseName()}-heightmap-16bit.png`;
    download(blob, name);
    return { name, capped: P.capped };
  }
  // Minimal PNG writer: IHDR (16-bit grey) + one zlib IDAT + IEND.
  async function png16(w, h, raw) {
    const crcT = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
    const crc = (bytes) => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = crcT[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (type, data) => {
      const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
      dv.setUint32(0, data.length);
      for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
      out.set(data, 8);
      dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
      return out;
    };
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 16; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    return new Blob([sig, chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))], { type: 'image/png' });
  }

  // SVG in millimetres. mode 'lines': one open/closed stroke per contour,
  // a layer per level (plotter / laser engraving). mode 'layers': the
  // region above each level as one filled path (even-odd), a layer per
  // level, stacked bottom to top (stacked cut models; each layer is the
  // full outline of that slice, not just the ring).
  async function exportSVG(mode, progress) {
    const P = pagePixels(300);
    const res = Math.min(4, Math.sqrt(1.5e6 / (P.wmm * P.hmm)));       // samples per mm
    const f = await samplePage(P.rect, Math.round(P.wmm * res), Math.round(P.hmm * res), p => progress(p * 0.6));
    const sx = P.wmm / f.w, sy = P.hmm / f.h;
    const tol = 0.08 / sx;                                               // 0.08 mm in grid units
    const fmt = v => +v.toFixed(2);
    const toPath = (polys, close) => polys.map(pl => {
      const q = M.simplify(pl, tol);
      if (q.length < 2) return '';
      const closed = close || (q.length > 3 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]);
      const pts = (closed ? q.slice(0, -1) : q).map(([x, y]) => `${fmt((x + 0.5) * sx)},${fmt((y + 0.5) * sy)}`);
      return 'M' + pts.join('L') + (closed ? 'Z' : '');
    }).join('');

    const levelsToDo = traceLevels(lv);
    const layers = [];
    const grey = palette(lv);
    for (let n = 0; n < levelsToDo.length; n++) {
      const t = levelsToDo[n];
      const polys = M.isolines(f, t.e, mode === 'layers');
      const d = toPath(polys, mode === 'layers');
      const label = t.kind === 'coast' ? 'coast (sea level)' : t.kind === 'depth' ? `depth ${-t.index}` : `level ${t.index}`;
      const id = t.kind === 'depth' ? `depth-${-t.index}` : `level-${String(t.index).padStart(2, '0')}`;
      if (d) {
        if (mode === 'lines') {
          const kind = t.kind === 'land' && t.index % 5 === 0 ? 'index' : t.kind;
          layers.push({ order: t.index, xml: `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}" fill="none" stroke="${t.kind === 'depth' ? DEPTH_INK : INK}" stroke-width="${MM[kind]}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>` });
        } else {
          const c = onPaper() ? null : grey(t.e + lv.step * 0.01);
          const fill = c ? `rgb(${c})` : `hsl(35 20% ${Math.round(88 - Math.max(0, t.index) / lv.bands * 55)}%)`;
          layers.push({ order: t.index, xml: `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}"><path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="#000" stroke-width="0.1"/></g>` });
        }
      }
      progress(0.6 + 0.4 * (n + 1) / levelsToDo.length); await tick();
    }
    layers.sort((a, b) => a.order - b.order);           // deepest first, peaks on top
    if (mode === 'lines' && S.style === 'hachure') {
      // Hachures or stipple, and water lines, as their own layers; strokes grouped by weight
      const H = buildHachures(f, 1 / sx);
      const pl = poly => 'M' + poly.map(([x, y]) => `${fmt((x + 0.5) * sx)},${fmt((y + 0.5) * sy)}`).join('L');
      const water = H.water.map(ring => ring.map(p => pl(M.simplify(p, tol))).join('')).join('');
      layers.unshift({ order: -999, xml: `<g id="water-lines" inkscape:groupmode="layer" inkscape:label="water lines" fill="none" stroke="#3d4b5c" stroke-width="${HACH.water}" stroke-linecap="round"><path d="${water}"/></g>` });
      const NB = HACH.NB, buckets = hachBuckets(H.strokes, pts => pl(M.simplify(pts, tol)));
      const groups = buckets.map((b, i) => b.length ? `<path d="${b.join('')}" stroke-width="${fmt(HACH.wMin + (HACH.wMax - HACH.wMin) * (i + 0.5) / NB)}"/>` : '').join('');
      layers.push({ order: 999, xml: `<g id="${engraving()}" inkscape:groupmode="layer" inkscape:label="${engraving()}" fill="none" stroke="${INK}" stroke-linecap="butt">${groups}</g>` });
    }
    const seaFill = onPaper() ? `rgb(${PAPER})` : `rgb(${palette(lv)(lv.min - 1)})`;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${P.wmm}mm" height="${P.hmm}mm" viewBox="0 0 ${P.wmm} ${P.hmm}">
<!-- Island Generator v5.8 · seed ${S.seed} · ${location.href.replace(/--/g, '%2D%2D')} -->
<g id="page" inkscape:groupmode="layer" inkscape:label="page">${mode === 'layers' ? `<rect width="${P.wmm}" height="${P.hmm}" fill="${seaFill}"/>` : ''}<rect width="${P.wmm}" height="${P.hmm}" fill="none" stroke="#999" stroke-width="0.1"/></g>
${layers.map(l => l.xml).join('\n')}
</svg>`;
    const name = `${baseName()}-${mode === 'lines' ? 'contours' : 'layers'}.svg`;
    download(new Blob([svg], { type: 'image/svg+xml' }), name);
    return { name, layers: layers.length };
  }

  // ── API for ui.js ──
  const api = IG.sketch = {
    terrainChanged() { dirty.terrain = true; },
    levelsChanged() { dirty.levels = true; },
    lookChanged(resample) { if (resample) dirty.view = true; else dirty.levels = true; },
    viewChanged() { dirty.view = true; },
    exportPNG, exportHeightmap, previewPage, exportSVG, pagePixels, stats, printMM, sheetName, frameRect: () => frameRect(),
    centres: () => (terrain ? terrain.centres : []),
    aspect,
  };

}, document.getElementById('canvas-container'));
