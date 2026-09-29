// Dance of Planets v3.0 — the sketch
// © Jesal Mehta, @cabofcuriosity
// Based on Dance of Venus v1.45
//
// Two layers:
//   trail   — an off-screen p5.Graphics that accumulates the drawing
//   overlay — drawn straight onto the main canvas each frame on top of the
//             trail (Sun, orbits, planets, the current line); never leaves
//             a trace.
//
// The drawing is a pure function of (pair, cycle, style, detail, look,
// progress k), so any look change is handled by redrawing the trail from
// scratch up to the current k — no Reset button. See DANCE-OF-PLANETS.md.

new p5(function (s) {

  const M = DOP.model;
  const S = DOP.settings;           // owned by ui.js

  let pair = null;                  // DOP.model.makePair(...) result
  let trail = null;                 // p5.Graphics
  let k = 0;                        // steps drawn so far (grows past N in 'cont')
  let acc = 0;                      // fractional-step accumulator for speed
  let playing = true;
  let done = false;
  let needPicture = true, needRedraw = false;

  // ── View: centre and scale (px per AU), in CSS pixels ──
  function view() {
    const vp = DOP.ui.viewport();
    const fit = 0.45 * Math.min(vp.w, vp.h) / pair.maxAU;
    return { cx: vp.x + vp.w / 2, cy: vp.y + vp.h / 2,
             scale: fit * S.zoom / 100, ref: Math.min(vp.w, vp.h) };
  }

  // ── Colour ──
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // Returns f(k, alphaMul) -> css colour for step k.
  function colourFn() {
    const op = S.opacity / 100;
    if (S.colorMode === 'gradient') {
      const c1 = hexRgb(S.grad1), c2 = hexRgb(S.grad2), N = pair.N;
      return (kk, alphaMul = 1) => {
        const t = (kk % N) / N;
        const r = c1[0] + (c2[0] - c1[0]) * t | 0;
        const g = c1[1] + (c2[1] - c1[1]) * t | 0;
        const b = c1[2] + (c2[2] - c1[2]) * t | 0;
        return `rgba(${r},${g},${b},${op * alphaMul})`;
      };
    }
    const [r, g, b] = hexRgb(S.color);
    return (kk, alphaMul = 1) => `rgba(${r},${g},${b},${op * alphaMul})`;
  }

  // Segment for step kk, in AU. Lines: planet to planet. Trail: previous
  // midpoint to this midpoint (null at the very first step).
  function segment(kk) {
    const p = pair.positions(kk);
    if (S.style === 'lines') return p;
    if (kk === 0) return null;
    const q = pair.positions(kk - 1);
    return [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2, (p[0] + p[2]) / 2, (p[1] + p[3]) / 2];
  }

  // Draw steps [k0, k1) onto a 2D context. alphaAt(kk) optional (fade tails).
  function drawRange(ctx, v, k0, k1, lineWidth, alphaAt) {
    const col = colourFn();
    const { cx, cy, scale } = v;
    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    // Batch into one path when every segment has the same colour and full
    // opacity — overlaps can't compound at alpha 1, so the result is identical.
    const batch = S.colorMode === 'single' && S.opacity >= 100 && !alphaAt;
    if (batch) {
      ctx.strokeStyle = col(0);
      ctx.beginPath();
      for (let kk = k0; kk < k1; kk++) {
        const sg = segment(kk); if (!sg) continue;
        ctx.moveTo(cx + sg[0] * scale, cy + sg[1] * scale);
        ctx.lineTo(cx + sg[2] * scale, cy + sg[3] * scale);
        if ((kk & 2047) === 2047) { ctx.stroke(); ctx.beginPath(); }
      }
      ctx.stroke();
    } else {
      for (let kk = k0; kk < k1; kk++) {
        const sg = segment(kk); if (!sg) continue;
        const a = alphaAt ? alphaAt(kk) : 1;
        if (a < 0.004) continue;
        ctx.strokeStyle = col(kk, a);
        ctx.beginPath();
        ctx.moveTo(cx + sg[0] * scale, cy + sg[1] * scale);
        ctx.lineTo(cx + sg[2] * scale, cy + sg[3] * scale);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // The range of steps a full redraw needs, plus a per-step alpha for the
  // fade approximation in 'cont' mode. Live fading is a translucent black
  // rect every frame; after f frames a line keeps (1 - fade/255)^f of its
  // brightness, and one frame is `speed` steps.
  function redrawPlan() {
    if (S.loop !== 'cont') return { k0: 0, k1: Math.min(k, pair.N + 1), alphaAt: null };
    const keep = 1 - S.fade / 255;
    const stepsPerFrame = Math.max(linesPerFrame(), 0.01);
    const tail = Math.min(M.LINE_BUDGET,
      Math.ceil(Math.log(0.01) / Math.log(keep) * stepsPerFrame));
    const k0 = Math.max(0, k - tail);
    return { k0, k1: k, alphaAt: kk => Math.pow(keep, (k - kk) / stepsPerFrame) };
  }

  function rebuildTrail() {
    trail.background(0);
    const plan = redrawPlan();
    drawRange(trail.drawingContext, view(), plan.k0, plan.k1, S.weight, plan.alphaAt);
  }

  function makeTrail() {
    if (trail) trail.remove();
    trail = s.createGraphics(s.width, s.height);
    trail.background(0);
  }

  // Speed is in orbits of the faster planet per second, so changing Detail
  // doesn't change how long a cycle takes to draw. Assumes ~60 fps.
  function linesPerFrame() { return S.speed * pair.detail / 60; }

  function makePair() {
    return M.makePair(S.a, S.b, { classic: S.classic, detail: S.detail, cycleKey: S.cycle });
  }

  function status() {
    if (!pair) return null;
    const N = pair.N;
    const inCycle = S.loop === 'cont' ? k % N : Math.min(k, N);
    return {
      pair, k, N, playing, done,
      frac: inCycle / N,
      cycleNo: Math.floor(k / N) + 1,
      year: inCycle * pair.yearsPerStep,
      orbits: pair.orbitsAt(S.loop === 'cont' ? k : Math.min(k, N)),
    };
  }

  // ── Public API for ui.js ──
  DOP.sketch = {
    newPicture() { needPicture = true; },
    redraw() { needRedraw = true; },
    // Detail / classic change the step grid: keep the same fraction of the
    // cycle rather than the same step index.
    regrid() {
      if (!pair) return;
      const frac = Math.min(k, pair.N) / pair.N;
      pair = makePair();
      k = Math.round(frac * pair.N);
      if (S.loop === 'once') done = k > pair.N;
      needRedraw = true;
      DOP.ui.onPicture(pair);
    },
    // Switching once <-> keep drawing: 'once' can't be past the end.
    loopChanged() {
      if (!pair) return;
      if (S.loop === 'once' && k > pair.N) { k = k % pair.N; }
      if (done) playing = true;        // a finished drawing carries on
      done = false;
      needRedraw = true;
    },
    play() { if (done) this.restart(); playing = true; },
    pause() { playing = false; },
    togglePlay() { playing ? this.pause() : this.play(); },
    restart() { k = 0; acc = 0; done = false; playing = true; needRedraw = true; },
    seek(frac) {
      const base = S.loop === 'cont' ? Math.floor(k / pair.N) * pair.N : 0;
      k = base + Math.round(Math.max(0, Math.min(1, frac)) * pair.N);
      done = false;
      needRedraw = true;
    },
    exportPNG: size => exportPNG(size),
    exportSVG: () => exportSVG(),
    status: () => status(),
  };

  // ── p5 lifecycle ──
  s.setup = function () {
    const c = s.createCanvas(window.innerWidth, window.innerHeight);
    c.parent('canvas-container');
    makeTrail();
  };

  s.windowResized = function () {
    s.resizeCanvas(window.innerWidth, window.innerHeight);
    makeTrail();
    needRedraw = true;
  };

  s.draw = function () {
    if (needPicture) {
      pair = makePair();
      k = 0; acc = 0; done = false; playing = true;
      needPicture = false; needRedraw = true;
      DOP.ui.onPicture(pair);
    }
    if (needRedraw) { rebuildTrail(); needRedraw = false; }

    if (playing && !done) {
      if (S.loop === 'cont') {
        trail.push(); trail.noStroke(); trail.fill(0, S.fade);
        trail.rect(0, 0, trail.width, trail.height); trail.pop();
      }
      acc += linesPerFrame();
      let n = Math.floor(acc); acc -= n;
      if (S.loop === 'once') n = Math.min(n, pair.N + 1 - k);
      if (n > 0) { drawRange(trail.drawingContext, view(), k, k + n, S.weight); k += n; }
      if (S.loop === 'once' && k > pair.N) { done = true; playing = false; }
    }

    s.background(0);
    s.image(trail, 0, 0);
    drawOverlay();
    DOP.ui.onFrame(status());
  };

  // ── Overlay: Sun, orbits, planets, the current line. Never trails. ──
  function drawOverlay() {
    if (!S.orbits && !S.planets) return;
    const ctx = s.drawingContext;
    const v = view();
    ctx.save();
    if (S.orbits) {
      ctx.strokeStyle = 'rgba(110,142,200,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      for (const P of [pair.A, pair.B]) {
        ctx.beginPath();
        ctx.arc(v.cx, v.cy, P.au * v.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (S.planets) {
      const kk = S.loop === 'once' ? Math.min(k, pair.N) : k;
      const p = pair.positions(kk);
      const ax = v.cx + p[0] * v.scale, ay = v.cy + p[1] * v.scale;
      const bx = v.cx + p[2] * v.scale, by = v.cy + p[3] * v.scale;
      // The drawing arm: what is being drawn right now.
      ctx.strokeStyle = 'rgba(200,169,110,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      if (S.style === 'trail') {
        ctx.fillStyle = '#c8a96e';
        ctx.beginPath(); ctx.arc((ax + bx) / 2, (ay + by) / 2, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      drawSun(ctx, v.cx, v.cy);
      drawPlanet(ctx, pair.A, ax, ay);
      drawPlanet(ctx, pair.B, bx, by);
    }
    ctx.restore();
  }

  function drawSun(ctx, x, y) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
    g.addColorStop(0, 'rgba(243,198,85,0.9)');
    g.addColorStop(0.35, 'rgba(243,198,85,0.3)');
    g.addColorStop(1, 'rgba(243,198,85,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = M.SUN.color;
    ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawPlanet(ctx, P, x, y) {
    const r = P.r * 1.25;
    if (P.ring) {               // back half of Saturn's ring
      ctx.strokeStyle = 'rgba(227,208,154,0.75)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 2, r * 0.6, -0.35, Math.PI, Math.PI * 2); ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, lighten(P.color, 0.4));
    g.addColorStop(1, P.color);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (P.bands) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(140,95,60,0.55)';
      ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.18);
      ctx.fillRect(x - r, y + r * 0.2, r * 2, r * 0.14);
      ctx.restore();
    }
    if (P.ring) {               // front half
      ctx.strokeStyle = 'rgba(227,208,154,0.95)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 2, r * 0.6, -0.35, 0, Math.PI); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(212,208,200,0.8)';
    ctx.font = '13px "Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(P.glyph, x + r + (P.ring ? r + 4 : 5), y - r - 3);
  }

  function lighten(hex, t) {
    const [r, g, b] = hexRgb(hex);
    const f = c => Math.round(c + (255 - c) * t);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  // ── Export: recomputed off-screen, square, independent of window size ──
  function exportView(size) {
    const v = view();
    const f = size / v.ref;         // export size relative to on-screen view
    return { cx: size / 2, cy: size / 2, scale: v.scale * f, f };
  }

  function fileBase() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}_${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
               `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const c = pair.cycle;
    return `${ts}_${pair.A.name}_${pair.B.name}_${c.p}-${c.q}_${S.style}${S.classic ? '_classic' : ''}`;
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportPNG(size) {
    if (size === 'screen') size = Math.round(view().ref * s.pixelDensity());
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = size;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    const v = exportView(size);
    const plan = redrawPlan();
    drawRange(ctx, v, plan.k0, plan.k1, Math.max(0.5, S.weight * v.f), plan.alphaAt);
    cnv.toBlob(b => download(b, fileBase() + `_${size}px.png`), 'image/png');
    return fileBase() + `_${size}px.png`;
  }

  // Built straight from the segment list — no library. Each segment is its
  // own <path> so translucent lines compound exactly as on screen.
  function exportSVG() {
    const plan = redrawPlan();
    const count = plan.k1 - plan.k0;
    const SIZE = 1000;
    if (count > 60000 && !confirm(`This drawing has ${count.toLocaleString()} lines; ` +
        `the SVG will be roughly ${Math.round(count * 110 / 1e6)} MB. Export anyway?`)) return null;
    const v = exportView(SIZE);
    const col = colourFn();
    const r2 = n => Math.round(n * 100) / 100;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">`);
    out.push(`<!-- Dance of Planets v3.0 · ${pair.A.name} & ${pair.B.name} · ${pair.cycle.p}:${pair.cycle.q} · © Jesal Mehta, @cabofcuriosity -->`);
    out.push(`<rect width="100%" height="100%" fill="#000"/>`);
    out.push(`<g fill="none" stroke-linecap="round" stroke-width="${r2(Math.max(0.1, S.weight * v.f))}">`);
    for (let kk = plan.k0; kk < plan.k1; kk++) {
      const sg = segment(kk); if (!sg) continue;
      const a = plan.alphaAt ? plan.alphaAt(kk) : 1;
      if (a < 0.004) continue;
      const m = /rgba\((\d+),(\d+),(\d+),([\d.e-]+)\)/.exec(col(kk, a));
      out.push(`<path d="M${r2(v.cx + sg[0] * v.scale)} ${r2(v.cy + sg[1] * v.scale)}L${r2(v.cx + sg[2] * v.scale)} ${r2(v.cy + sg[3] * v.scale)}" ` +
               `stroke="rgb(${m[1]},${m[2]},${m[3]})"${+m[4] < 1 ? ` stroke-opacity="${r2(+m[4])}"` : ''}/>`);
    }
    out.push('</g></svg>');
    const name = fileBase() + '.svg';
    download(new Blob([out.join('\n')], { type: 'image/svg+xml' }), name);
    return name;
  }

}, document.body);
