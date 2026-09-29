// Dance of Planets v2.0
// © Jesal Mehta, @cabofcuriosity
// Based on Dance of Venus v1.45
// Data sources:
//   http://hyperphysics.phy-astr.gsu.edu/hbase/kepler.html
//   https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf

new p5(function(s) {

  // ── Solar system data (indices 1–9, matching original variable style) ──
  const solar = [
    null,
    { name:'Mercury', ov:0.241,  au:0.39   },
    { name:'Venus',   ov:0.615,  au:0.72   },
    { name:'Earth',   ov:1.000,  au:1.00   },
    { name:'Mars',    ov:1.880,  au:1.52   },
    { name:'Jupiter', ov:11.900, au:5.20   },
    { name:'Saturn',  ov:29.500, au:9.54   },
    { name:'Uranus',  ov:84.000, au:19.20  },
    { name:'Neptune', ov:165.00, au:30.06  },
    { name:'Pluto',   ov:248.00, au:40.00  },
  ];

  // ── Active drawing state (frozen at each reset) ──
  let rEarth, rVenus, avEarth, avVenus, scl;
  let wEarth, wVenus; // angular rate per unit of `deg` -- see doReset()
  let classic;        // true = v2.x behaviour (angle = period * deg)
  let deg, step;
  let px, py, xEarth, yEarth, xVenus, yVenus;
  let p1, p2;
  let cycleTarget;  // in deg-driver units — see comment in doReset()
  let loopMode;     // 'once' | 'cont'
  let drawMode;     // 1=line | 2=midpoint trail
  let fadeAlpha;    // direct p5 alpha value (0.1–10), used as-is

  // ── DOM refs ──
  const selP1    = document.getElementById('sel-p1');
  const selP2    = document.getElementById('sel-p2');
  const slScl    = document.getElementById('sl-scl');
  const txScl    = document.getElementById('tx-scl');
  const slStp    = document.getElementById('sl-stp');
  const txStp    = document.getElementById('tx-stp');
  const slFade   = document.getElementById('sl-fade');
  const txFade   = document.getElementById('tx-fade');
  const btnReset = document.getElementById('btn-reset');
  const btnPP    = document.getElementById('btn-playpause');
  const btnSave  = document.getElementById('btn-save');
  const btnClear = document.getElementById('btn-clear');
  const pendNote = document.getElementById('pending-note');

  // ── Sync slider <-> number input pairs ──
  // onLive callback fires immediately (for controls that apply without reset)
  function syncPair(sl, tx, onLive) {
    sl.addEventListener('input', () => {
      tx.value = sl.value;
      markDirty();
      if (onLive) onLive(parseFloat(sl.value));
    });
    tx.addEventListener('change', () => {
      let v = parseFloat(tx.value);
      v = Math.max(parseFloat(tx.min), Math.min(parseFloat(tx.max), isNaN(v) ? parseFloat(tx.min) : v));
      tx.value = v;
      sl.value = v;
      markDirty();
      if (onLive) onLive(v);
    });
  }

  // Scale applies live (no reset needed) — all others wait for reset
  syncPair(slScl, txScl, (v) => {
    scl = s.width / 2 * (v / 100);
    // Rebase px/py so midpoint trail doesn't jump on zoom change
    xEarth = rEarth * scl * s.cos(wEarth * deg);
    yEarth = rEarth * scl * s.sin(wEarth * deg);
    xVenus = rVenus * scl * s.cos(wVenus * deg);
    yVenus = rVenus * scl * s.sin(wVenus * deg);
    px = (xEarth + xVenus) / 2;
    py = (yEarth + yVenus) / 2;
  });
  syncPair(slStp,  txStp);
  syncPair(slFade, txFade);

  function markDirty() {
    pendNote.classList.add('show');
  }
  document.querySelectorAll('.setting').forEach(el => {
    el.addEventListener('change', markDirty);
  });

  // ── Resonance: find smallest integers n1, n2 where n1*T1 ≈ n2*T2 ──
  // Uses rational approximation of the ratio T2/T1.
  // Result: n1 orbits of Planet1, n2 orbits of Planet2 close the pattern.
  function findResonance(T1, T2) {
    if (T1 === T2) return { n1:1, n2:1, cycleYears: T1 };
    const ratio = T2 / T1;
    const tol = 0.004;
    let bestP = 1, bestQ = 1, bestErr = Infinity;
    for (let q = 1; q <= 1000; q++) {
      const p = Math.round(ratio * q);
      if (p < 1) continue;
      const err = Math.abs(p / q - ratio);
      if (err < bestErr) { bestErr = err; bestP = p; bestQ = q; }
      if (err < tol) break;
    }
    return { n1: bestQ, n2: bestP, cycleYears: bestQ * T1 };
  }

  function updateInfoPanel(a_p1, a_p2, cyc) {
    document.getElementById('p1-name').textContent = solar[a_p1].name;
    document.getElementById('p1-ov').textContent   = solar[a_p1].ov + ' yr';
    document.getElementById('p1-au').textContent   = solar[a_p1].au + ' AU';
    document.getElementById('p2-name').textContent = solar[a_p2].name;
    document.getElementById('p2-ov').textContent   = solar[a_p2].ov + ' yr';
    document.getElementById('p2-au').textContent   = solar[a_p2].au + ' AU';
    document.getElementById('res-ratio').textContent = cyc.o1 + ' : ' + cyc.o2;
    document.getElementById('res-lcm').textContent   = cyc.cycleYears.toFixed(2) + ' yr';
    document.getElementById('info-o1').textContent   = cyc.o1 + ' orbits of ' + solar[a_p1].name;
    document.getElementById('info-o2').textContent   = cyc.o2 + ' orbits of ' + solar[a_p2].name;
    document.getElementById('info-target').textContent = cyc.cycleTarget.toFixed(1) + '°';
    updateFilename(a_p1, a_p2);
  }

  function updateFilename(a_p1, a_p2) {
    const n1  = solar[a_p1].name;
    const n2  = solar[a_p2].name;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ts  = `${now.getFullYear()}_${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const stp = parseFloat(txStp.value).toFixed(1).replace('.', 'p');
    document.getElementById('info-filename').textContent = `${ts}_${n1}_${n2}_${stp}.png`;
  }

  function setStatus(state) {
    document.getElementById('status-dot').className = 'status-dot ' + state;
    document.getElementById('status-text').textContent =
      state === 'running' ? 'Running' : state === 'paused' ? 'Paused' : 'Complete';
    btnPP.textContent = (state === 'paused') ? '▶ Resume' : '⏸ Pause';
  }

  // ── RESET: freeze all UI settings into active drawing state, restart ──
  function doReset() {
    p1       = parseInt(selP1.value);
    p2       = parseInt(selP2.value);
    loopMode = document.querySelector('input[name="loop"]:checked').value;
    drawMode = parseInt(document.querySelector('input[name="mode"]:checked').value);
    classic  = document.getElementById('chk-classic').checked;

    // fadeAlpha used directly as p5 alpha (0.1–10, on 0–255 scale)
    // This gives very gentle, slow fades — exactly as intended
    fadeAlpha = parseFloat(txFade.value);

    step = parseFloat(txStp.value);

    // Scale: slider value is % of canvas radius (e.g. 8 → 8% → scl = width/2 * 0.08)
    const sclPct = parseFloat(txScl.value);
    scl = s.width / 2 * (sclPct / 100);

    rEarth  = solar[p1].au;
    rVenus  = solar[p2].au;
    avEarth = solar[p1].ov;
    avVenus = solar[p2].ov;

    // ── Angular rates ──
    // A planet's angle must grow in proportion to time / period: a planet
    // with twice the period moves half as fast. `deg` is the time driver,
    // measured in degrees of one Earth year (deg = 360 -> 1 year), so
    //   angle = deg / period.
    // v2.x used angle = period * deg, which makes outer planets move
    // FASTER (Pluto 248x Earth). The symmetry survives (it depends only on
    // the ratio) but the shape is different. Kept behind the Classic toggle.
    wEarth = classic ? avEarth : 1 / avEarth;
    wVenus = classic ? avVenus : 1 / avVenus;

    const res = findResonance(avEarth, avVenus);
    // findResonance gives T2/T1 ~= n2/n1, so n2 orbits of P1 and n1 orbits
    // of P2 take the same number of years (Earth-Venus: 8 and 13).
    // Under classic (swapped) speeds the counts swap too.
    const o1 = classic ? res.n1 : res.n2;
    const o2 = classic ? res.n2 : res.n1;

    // ── Cycle target in deg-driver space ──
    // Planet 1 completes one full orbit when wEarth * deg = 360 → deg = 360 / wEarth
    // Full resonance cycle = o1 complete orbits of Planet 1:
    cycleTarget = o1 * (360 / wEarth);
    const cycleYears = classic ? res.cycleYears : o1 * avEarth;

    deg = 0;
    xEarth = rEarth * scl * s.cos(wEarth * deg);
    yEarth = rEarth * scl * s.sin(wEarth * deg);
    xVenus = rVenus * scl * s.cos(wVenus * deg);
    yVenus = rVenus * scl * s.sin(wVenus * deg);
    px = (xEarth + xVenus) / 2;
    py = (yEarth + yVenus) / 2;

    s.background(0);
    pendNote.classList.remove('show');
    setStatus('running');
    if (!s.isLooping()) s.loop();

    updateInfoPanel(p1, p2, { o1, o2, cycleYears, cycleTarget });
  }

  // ── p5 setup ──
  s.setup = function() {
    const cnv = s.createCanvas(800, 800);
    cnv.parent('canvas-container');
    s.angleMode(s.DEGREES);
    s.background(0);
    s.stroke(255);
    s.noFill();
    doReset();

    // Scroll wheel zoom — applies live, no reset needed
    document.getElementById('canvas-container').addEventListener('wheel', (e) => {
      e.preventDefault();
      let v = parseFloat(slScl.value);
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      v = Math.round(Math.max(0.5, Math.min(100, v + delta)) * 10) / 10;
      slScl.value = v;
      txScl.value = v;
      scl = s.width / 2 * (v / 100);
      // Rebase midpoint so trail doesn't jump on zoom
      xEarth = rEarth * scl * s.cos(wEarth * deg);
      yEarth = rEarth * scl * s.sin(wEarth * deg);
      xVenus = rVenus * scl * s.cos(wVenus * deg);
      yVenus = rVenus * scl * s.sin(wVenus * deg);
      px = (xEarth + xVenus) / 2;
      py = (yEarth + yVenus) / 2;
    }, { passive: false });
  };

  // ── p5 draw ──
  s.draw = function() {

    // Continuous fade: full-canvas semi-transparent black overlay.
    // Drawn in SCREEN space before any translate — covers the entire canvas correctly.
    // fadeAlpha is used directly as the p5 alpha value (0.1–10).
    if (loopMode === 'cont') {
      s.push();
      s.noStroke();
      s.fill(0, fadeAlpha);
      s.rect(0, 0, s.width, s.height);
      s.pop();
    }

    // All orbital drawing in centred coordinate space
    s.push();
    s.translate(s.width / 2, s.height / 2);
    s.stroke(255);
    s.noFill();

    xEarth = rEarth * scl * s.cos(wEarth * deg);
    yEarth = rEarth * scl * s.sin(wEarth * deg);
    xVenus = rVenus * scl * s.cos(wVenus * deg);
    yVenus = rVenus * scl * s.sin(wVenus * deg);

    const mx = (xEarth + xVenus) / 2;
    const my = (yEarth + yVenus) / 2;

    if (drawMode === 1) {
      s.line(xEarth, yEarth, xVenus, yVenus);
    } else {
      s.line(px, py, mx, my);
    }

    deg += step;
    px   = mx;
    py   = my;

    s.pop();

    // Progress display
    const pct = cycleTarget > 0 ? Math.min(100, (deg / cycleTarget) * 100) : 0;
    document.getElementById('progress-fill').style.width = pct.toFixed(1) + '%';
    document.getElementById('info-pct').textContent = pct.toFixed(1) + '%';
    document.getElementById('info-deg').textContent = deg.toFixed(1) + '°';

    // Cycle end handling
    if (deg >= cycleTarget + step) {
      if (loopMode === 'once') {
        s.noLoop();
        setStatus('done');
      } else {
        // Continuous: reset deg and rebase start position, keep drawing
        deg = 0;
        xEarth = rEarth * scl * s.cos(wEarth * deg);
        yEarth = rEarth * scl * s.sin(wEarth * deg);
        xVenus = rVenus * scl * s.cos(wVenus * deg);
        yVenus = rVenus * scl * s.sin(wVenus * deg);
        px = (xEarth + xVenus) / 2;
        py = (yEarth + yVenus) / 2;
      }
    }
  };

  // ── Button event handlers ──
  btnReset.addEventListener('click', doReset);

  btnClear.addEventListener('click', () => { s.background(0); });

  btnPP.addEventListener('click', () => {
    if (s.isLooping()) { s.noLoop(); setStatus('paused'); }
    else               { s.loop();   setStatus('running'); }
  });

  btnSave.addEventListener('click', () => {
    updateFilename(p1, p2);
    const fname = document.getElementById('info-filename').textContent.replace('.png', '');
    s.saveCanvas(fname, 'png');
  });

}, document.body);
