// Island Generator v5.0 — the sketch
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
  let msPerSample = 0.00002;          // learnt, for choosing the first pass
  let dirty = { terrain: true, view: true, levels: true };
  let W = 0, H = 0;

  // ── View ──
  function view() {
    const vp = IG.ui.viewport(), A = aspect();
    const fit = 0.9 * Math.min(vp.w / 1, vp.h / A);
    const ppu = fit * S.zoom / 100;
    const cx = S.panX != null ? S.panX : 0.5, cy = S.panY != null ? S.panY : A / 2;
    const ox = vp.x + vp.w / 2 - cx * ppu, oy = vp.y + vp.h / 2 - cy * ppu;
    return { ppu, ox, oy, A,
      toScreen: (x, y) => [ox + x * ppu, oy + y * ppu],
      toPage: (X, Y) => [(X - ox) / ppu, (Y - oy) / ppu] };
  }
  // Sheet size in mm, after orientation. The map is always measured
  // against a sheet, even when the frame is hidden (Sheet: None), so
  // hiding it never changes the map.
  function dims() {
    if (S.page === 'custom') return [S.cw, S.ch];
    const [a, b] = M.PAGES[S.page];
    return S.orient === 'landscape' && S.page !== 'SQ' ? [b, a] : [a, b];
  }
  function aspect() { const [w, h] = dims(); return h / w; }
  function terrainParams() {
    return { seed: S.seed, scale: S.scale, rough: S.rough, ridges: S.ridges, warp: S.warp,
      peak: S.peak, focus: S.focus, shape: S.shape, count: S.count, size: S.size,
      extra: S.extra, removed: S.removed, moved: S.moved, aspect: aspect() };
  }

  // ── Colour ──
  function hsv(h, sat, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * sat * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5) * 255 | 0, f(3) * 255 | 0, f(1) * 255 | 0];
  }
  // Returns (e) → [r, g, b] for the current style and levels.
  function palette(L) {
    const B = L.bands, style = S.style;
    const land = [], sea = [];
    for (let b = 0; b < B; b++) {
      const t = B > 1 ? b / (B - 1) : 1;
      if (style === 'thermal') land.push(hsv(270 * (1 - t), 0.92, 0.35 + 0.65 * Math.min(1, t * 1.6 + 0.2)));
      else { const g = 96 + t * 150 | 0; land.push([g, g, g]); }
    }
    // Sea: flat near-black, or with depth on, shallow → deep in visibly
    // different steps (the first build's were all within a few levels of
    // black, which is why depth "didn't work").
    const seaFlat = style === 'thermal' ? [14, 8, 40] : [12, 12, 14];
    const shallow = style === 'thermal' ? [52, 40, 150] : [50, 52, 60];
    const deep = style === 'thermal' ? [8, 4, 26] : [6, 6, 8];
    const DN = M.DEPTH_BANDS;
    for (let d = 0; d < DN; d++) {
      const t = d / (DN - 1);
      sea.push(shallow.map((c, i) => c + (deep[i] - c) * t | 0));
    }
    return e => {
      if (e < L.sea) {
        if (!S.depth) return seaFlat;
        return sea[Math.min(DN - 1, Math.floor((L.sea - e) / L.depthStep))];
      }
      return land[Math.min(B - 1, Math.floor((e - L.sea) / L.step))];
    };
  }
  const PAPER = [244, 241, 234], INK = '#2a2622', DEPTH_INK = '#6f8aa6';

  // Contour levels to trace: coast, land bands, and depth lines if shown.
  function traceLevels(L) {
    const out = [];
    for (let b = 0; b < L.bands; b++) out.push({ e: L.list[b], index: b, kind: b === 0 ? 'coast' : 'land' });
    if (S.depth) for (let d = 1; d < M.DEPTH_BANDS; d++) {
      out.push({ e: L.sea - d * L.depthStep, index: -d, kind: 'depth' });
    }
    return out;
  }

  // ── Build steps ──
  function rebuildTerrain() {
    terrain = M.makeTerrain(terrainParams());
    ref = M.pageReference(terrain, aspect());
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
    const floor = S.style === 'lines' ? 2 : 1;
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
    if (S.style === 'lines') {
      for (let i = 0, j = 0; i < w * h; i++, j += 4) { px[j] = PAPER[0]; px[j + 1] = PAPER[1]; px[j + 2] = PAPER[2]; px[j + 3] = 255; }
      lines = traceLevels(lv).map(t => ({ ...t, polys: M.isolines(field, t.e, false) }));
    } else {
      const col = palette(lv);
      for (let i = 0, j = 0; i < w * h; i++, j += 4) {
        const c = col(data[i]); px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; px[j + 3] = 255;
      }
      lines = null;
    }
    imgCtx.putImageData(id, 0, 0);
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
    if (dirty.terrain || dirty.view) startSampling();
    else if (dirty.levels && field) paint();
    dirty.terrain = dirty.view = dirty.levels = false;

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
    ctx.fillStyle = S.style === 'lines' ? '#d9d5cc' : '#050508';
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
      if (lines) drawLines(ctx, lines, (gx, gy) => [X + (gx + 0.5) * fieldStep * sc, Y + (gy + 0.5) * fieldStep * sc], v.ppu);
    }
    drawOverlay(ctx, v);
  }

  // Line weights in mm of paper, so the screen shows what prints.
  const MM = { coast: 0.5, index: 0.35, land: 0.18, depth: 0.15 };
  function pageMM() { return dims()[0]; }
  function drawLines(ctx, sets, map, ppu) {
    const pxPerMM = ppu / pageMM();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const set of sets) {
      const kind = set.kind === 'land' && set.index % 5 === 0 ? 'index' : set.kind;
      ctx.strokeStyle = set.kind === 'depth' ? DEPTH_INK : INK;
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
      const [x0, y0] = v.toScreen(0, 0), [x1, y1] = v.toScreen(1, v.A);
      // dim outside the page
      ctx.fillStyle = S.style === 'lines' ? 'rgba(217,213,204,0.72)' : 'rgba(5,5,8,0.62)';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(200,169,110,0.8)'; ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      const [w, h] = dims();
      const name = S.page === 'SQ' ? 'Square' : S.page === 'custom' ? 'Custom' : `${S.page} ${S.orient}`;
      ctx.font = '10px "Space Mono", monospace'; ctx.fillStyle = 'rgba(200,169,110,0.9)';
      ctx.fillText(`${name} · ${w} × ${h} mm`, x0, y0 - 6);
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
        const [cx, cy] = v.toScreen(0.5, v.A / 2);
        const a = Math.atan2(Y - cy, X - cx), L = Math.hypot(X - cx, Y - cy);
        if (L > 12) {
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X - Math.cos(a) * 8, Y - Math.sin(a) * 8); ctx.stroke();
        }
      }
    }
  }

  // ── Stats for the info panel (from the page reference grid) ──
  function stats() {
    if (!ref || !terrain) return null;
    const L = M.levels(ref, S.sea, S.bands);
    const { w, h, data: d } = ref.grid, land = new Uint8Array(w * h);
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
      panX: S.panX != null ? S.panX : 0.5, panY: S.panY != null ? S.panY : v.A / 2, ppu: v.ppu };
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
      api.viewChanged();
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
    const cx = S.panX != null ? S.panX : 0.5, cy = S.panY != null ? S.panY : v.A / 2;
    const k = S.zoom / z;
    S.panX = px - (px - cx) * k; S.panY = py - (py - cy) * k;
    S.zoom = z;
    IG.ui.zoomChanged();
  }, { passive: false });

  // ── Export ──
  // What an export covers. With a sheet: the sheet, at `dpi`. With Sheet:
  // None: the window as it is now, at twice screen resolution, measured in
  // the sheet's mm so line weights match what's on screen.
  function pagePixels(dpi) {
    if (!S.sheet) {
      const v = view();
      const [x0, y0] = v.toPage(0, 0), [x1, y1] = v.toPage(W, H);
      const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      const k = Math.min(1, Math.sqrt(M.PX_CAP / (W * H * 4)));
      return { rect, window: true, w: Math.round(W * 2 * k), h: Math.round(H * 2 * k),
        wmm: Math.round(rect.w * pageMM()), hmm: Math.round(rect.h * pageMM()), capped: false, dpi: 0 };
    }
    const [wmm, hmm] = dims();
    const w = Math.round(wmm / 25.4 * dpi), h = Math.round(hmm / 25.4 * dpi);
    const k = Math.min(1, Math.sqrt(M.PX_CAP / (w * h)));
    return { rect: { x: 0, y: 0, w: 1, h: aspect() }, w: Math.round(w * k), h: Math.round(h * k),
      wmm, hmm, capped: k < 1, dpi: Math.round(dpi * k) };
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
    if (!S.sheet) return `island-${S.seed}-view`;
    const [w, h] = dims();
    return `island-${S.seed}-${S.page === 'custom' ? `${w}x${h}mm` : S.page + (S.page === 'SQ' ? '' : S.orient === 'landscape' ? 'L' : 'P')}`;
  }

  async function exportPNG(progress) {
    const P = pagePixels(S.dpi);
    const cv = document.createElement('canvas'); cv.width = P.w; cv.height = P.h;
    const ctx = cv.getContext('2d');
    if (S.style === 'lines') {
      ctx.fillStyle = `rgb(${PAPER})`; ctx.fillRect(0, 0, P.w, P.h);
      const res = Math.min(4, Math.sqrt(2.5e6 / (P.wmm * P.hmm)));    // samples per mm
      const f = await samplePage(P.rect, Math.round(P.wmm * res), Math.round(P.hmm * res), p => progress(p * 0.7));
      const sets = traceLevels(lv).map(t => ({ ...t, polys: M.isolines(f, t.e, false) }));
      progress(0.85); await tick();
      const sx = P.w / f.w, sy = P.h / f.h;
      drawLines(ctx, sets, (gx, gy) => [(gx + 0.5) * sx, (gy + 0.5) * sy], P.w / P.rect.w);
    } else {
      const { sw, sh } = sampleSize(P.w, P.h);
      const f = await samplePage(P.rect, sw, sh, p => progress(p * 0.7));
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
        progress(0.7 + 0.25 * (y0 + rows) / P.h); await tick();
      }
    }
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const name = `${baseName()}-${S.style}-${P.window ? '2x' : P.dpi + 'dpi'}.png`;
    download(blob, name);
    return { name, capped: P.capped };
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
          const c = S.style === 'lines' ? null : grey(t.e + lv.step * 0.01);
          const fill = c ? `rgb(${c})` : `hsl(35 20% ${Math.round(88 - Math.max(0, t.index) / lv.bands * 55)}%)`;
          layers.push({ order: t.index, xml: `<g id="${id}" inkscape:groupmode="layer" inkscape:label="${label}"><path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="#000" stroke-width="0.1"/></g>` });
        }
      }
      progress(0.6 + 0.4 * (n + 1) / levelsToDo.length); await tick();
    }
    layers.sort((a, b) => a.order - b.order);           // deepest first, peaks on top
    const seaFill = S.style === 'lines' ? `rgb(${PAPER})` : `rgb(${palette(lv)(lv.min - 1)})`;
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${P.wmm}mm" height="${P.hmm}mm" viewBox="0 0 ${P.wmm} ${P.hmm}">
<!-- Island Generator v5.0 · seed ${S.seed} · ${location.href.replace(/--/g, '%2D%2D')} -->
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
    exportPNG, exportHeightmap, exportSVG, pagePixels, stats,
    centres: () => (terrain ? terrain.centres : []),
    aspect,
  };

}, document.getElementById('canvas-container'));
