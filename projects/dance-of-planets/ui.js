// Dance of Planets v3.0 — interface
// © Jesal Mehta, @cabofcuriosity
// Owns DOP.settings, wires the controls, fills the info panel, keeps the
// URL in sync. Talks to the sketch only through DOP.sketch (see
// dance_of_planets.js); the sketch calls back DOP.ui.onPicture / onFrame.
//
// Every setting falls into one of three tiers (DANCE-OF-PLANETS.md):
//   nothing   — speed, overlay toggles: no redraw
//   redraw    — look: trail recomputed at the current progress
//   picture   — pair / cycle: start again from zero

(function () {

  const M = DOP.model;
  const $ = id => document.getElementById(id);

  const DEFAULTS = {
    a: 'earth', b: 'venus', cycle: 'auto',
    style: 'lines', detail: 120, speed: 0.5,
    colorMode: 'single', color: '#ffffff', grad1: '#c8a96e', grad2: '#6e8ec8',
    opacity: 60, weight: 1,
    loop: 'once', fade: 1.5, zoom: 100,
    planets: true, orbits: true, classic: false,
  };
  const S = DOP.settings = Object.assign({}, DEFAULTS);

  // ── URL state: short keys, only non-default values written ──
  const URL_KEYS = {
    a: 'a', b: 'b', cycle: 'cy', style: 'st', detail: 'd', speed: 'sp',
    colorMode: 'cm', color: 'c', grad1: 'g1', grad2: 'g2', opacity: 'op', weight: 'w',
    loop: 'm', fade: 'f', zoom: 'z', planets: 'pl', orbits: 'or', classic: 'cl',
  };
  const isHex = v => /^#[0-9a-f]{6}$/i.test(v);
  const VALID = {
    a: v => !!M.byId[v], b: v => !!M.byId[v], cycle: v => v === 'auto' || /^\d+:\d+$/.test(v),
    style: v => v === 'lines' || v === 'trail',
    colorMode: v => v === 'single' || v === 'gradient',
    loop: v => v === 'once' || v === 'cont',
    color: isHex, grad1: isHex, grad2: isHex,
  };
  const NUM = { detail: [4, 5000], speed: [0.01, 50], opacity: [5, 100], weight: [0.1, 8], fade: [0.05, 50], zoom: [5, 2000] };

  function readURL() {
    const q = new URLSearchParams(location.search);
    for (const [key, short] of Object.entries(URL_KEYS)) {
      if (!q.has(short)) continue;
      let v = q.get(short);
      if (typeof DEFAULTS[key] === 'boolean') { S[key] = v === '1'; continue; }
      if (NUM[key]) {
        v = parseFloat(v);
        if (isFinite(v)) S[key] = Math.min(NUM[key][1], Math.max(NUM[key][0], v));
        continue;
      }
      if (key === 'color' || key === 'grad1' || key === 'grad2') v = '#' + v.replace(/^#/, '');
      if (VALID[key] && VALID[key](v)) S[key] = v;
    }
    if (S.a === S.b) S.b = S.a === 'venus' ? 'earth' : 'venus';
  }

  let urlTimer = 0;
  function writeURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const q = new URLSearchParams();
      for (const [key, short] of Object.entries(URL_KEYS)) {
        if (S[key] === DEFAULTS[key]) continue;
        let v = S[key];
        if (typeof v === 'boolean') v = v ? '1' : '0';
        else if (typeof v === 'string' && v[0] === '#') v = v.slice(1);
        else if (typeof v === 'number') v = +v.toFixed(3);
        q.set(short, v);
      }
      const qs = q.toString();
      try { history.replaceState(null, '', qs ? '?' + qs : location.pathname); } catch (e) { /* file:// in some browsers */ }
    }, 250);
  }

  // ── Formatting ──
  const fmt = (n, d) => n.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
  function fmtYears(y) {
    if (y < 1) return fmt(y * 12, 1) + ' months';
    if (y < 10) return fmt(y, 1) + ' years';
    return fmt(Math.round(y), 0) + ' years';
  }
  function fmtDays(d) {
    if (d < 1) return fmt(d * 24, 1) + ' hours';
    if (d < 10) return fmt(d, 1) + ' days';
    return fmt(Math.round(d), 0) + ' days';
  }
  function closeness(miss) {
    const m = Math.abs(miss);
    if (m < 0.05) return 'exactly';
    if (m < 1) return 'within ' + fmt(m, 2) + '°';
    return 'within ' + fmt(m, 1) + '°';
  }

  // ── Log-scale slider mapping (slider 0..1000) ──
  function logMap(min, max) {
    const a = Math.log(min), b = Math.log(max);
    return {
      toVal: p => Math.exp(a + (b - a) * p / 1000),
      toPos: v => Math.round((Math.log(v) - a) / (b - a) * 1000),
    };
  }
  const MAPS = {
    detail: logMap(24, 2880),
    speed:  logMap(0.02, 20),     // orbits of the faster planet per second
    weight: logMap(0.25, 4),
    fade:   logMap(0.1, 10),
    zoom:   logMap(25, 800),
  };

  // ── Current pair (from the sketch) ──
  let pair = null;

  // ── Build static controls ──
  function buildPlanetSelects() {
    for (const id of ['sel-a', 'sel-b']) {
      $(id).innerHTML = M.PLANETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  }
  function buildPresets() {
    $('presets').innerHTML = M.PRESETS.map(p =>
      `<button class="preset" type="button" data-preset="${p.id}"><b>${p.title}</b><small>${p.note}</small></button>`
    ).join('');
    $('presets').addEventListener('click', e => {
      const btn = e.target.closest('[data-preset]'); if (!btn) return;
      const p = M.PRESETS.find(x => x.id === btn.dataset.preset);
      S.a = p.a; S.b = p.b; S.cycle = p.cycle || 'auto';
      syncControls();
      changed('picture');
    });
  }

  // ── The one place settings changes are dispatched ──
  function changed(tier) {
    if (tier === 'picture') DOP.sketch.newPicture();
    else if (tier === 'regrid') DOP.sketch.regrid();
    else if (tier === 'redraw') DOP.sketch.redraw();
    else if (tier === 'loop') DOP.sketch.loopChanged();
    updateReadouts();
    writeURL();
  }

  // ── Wiring ──
  function wire() {
    $('sel-a').addEventListener('change', e => pickPlanet('a', e.target.value));
    $('sel-b').addEventListener('change', e => pickPlanet('b', e.target.value));
    $('btn-swap').addEventListener('click', () => {
      [S.a, S.b] = [S.b, S.a]; syncControls(); changed('picture');
    });
    $('sel-cycle').addEventListener('change', e => {
      S.cycle = pair && e.target.value === pair.autoKey ? 'auto' : e.target.value;
      changed('picture');
    });

    document.querySelectorAll('.seg').forEach(seg => {
      seg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const key = seg.dataset.key;
        S[key] = b.dataset.value;
        syncControls();
        changed(key === 'loop' ? 'loop' : 'redraw');
      });
    });

    slider('sl-detail', 'detail', 'regrid', v => Math.round(v));
    slider('sl-speed', 'speed', null, v => v < 1 ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10);
    slider('sl-weight', 'weight', 'redraw', v => Math.round(v * 100) / 100);
    slider('sl-fade', 'fade', null, v => Math.round(v * 100) / 100);
    slider('sl-zoom', 'zoom', 'redraw', v => Math.round(v));
    $('sl-opacity').addEventListener('input', e => { S.opacity = +e.target.value; changed('redraw'); });

    colour('col-single', 'color'); colour('col-g1', 'grad1'); colour('col-g2', 'grad2');

    $('chk-planets').addEventListener('change', e => { S.planets = e.target.checked; changed(null); });
    $('chk-orbits').addEventListener('change', e => { S.orbits = e.target.checked; changed(null); });
    $('chk-classic').addEventListener('change', e => { S.classic = e.target.checked; changed('regrid'); });
    $('btn-fit').addEventListener('click', () => { S.zoom = 100; syncControls(); changed('redraw'); });

    $('canvas-container').addEventListener('wheel', e => {
      e.preventDefault();
      S.zoom = Math.min(800, Math.max(25, S.zoom * Math.exp(-e.deltaY * 0.0012)));
      syncControls(); changed('redraw');
    }, { passive: false });

    // transport
    $('btn-play').addEventListener('click', () => DOP.sketch.togglePlay());
    $('btn-restart').addEventListener('click', () => DOP.sketch.restart());
    const scrub = $('scrub');
    scrub.addEventListener('pointerdown', () => { scrubbing = true; });
    scrub.addEventListener('input', () => { scrubbing = true; DOP.sketch.seek(scrub.value / 1000); });
    scrub.addEventListener('change', () => { scrubbing = false; });
    window.addEventListener('pointerup', () => { scrubbing = false; });

    // export
    $('btn-png').addEventListener('click', e => { e.stopPropagation(); $('menu-png').hidden = !$('menu-png').hidden; });
    $('menu-png').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $('menu-png').hidden = true;
      if (b.dataset.action === 'svg') return saveSVG();
      if (b.dataset.action === 'link') return copyLink();
      const size = b.dataset.size === 'screen' ? 'screen' : +b.dataset.size;
      toast('Rendering…');
      setTimeout(() => { const n = DOP.sketch.exportPNG(size); toast('Saved ' + n); }, 30);
    });
    document.addEventListener('click', () => { $('menu-png').hidden = true; });
    $('btn-svg').addEventListener('click', saveSVG);
    $('btn-link').addEventListener('click', copyLink);

    // panels
    document.querySelectorAll('[data-collapse]').forEach(b =>
      b.addEventListener('click', () => setCollapsed(b.dataset.collapse, true)));
    $('tab-controls').addEventListener('click', () => setCollapsed('controls', false));
    $('tab-info').addEventListener('click', () => setCollapsed('info', false));
    $('m-controls').addEventListener('click', () => toggleSheet('panel-controls'));
    $('m-info').addEventListener('click', () => toggleSheet('panel-info'));

    // explainer
    $('btn-about').addEventListener('click', () => { $('about').hidden = false; });
    $('about').addEventListener('click', e => {
      if (e.target === $('about') || e.target.closest('[data-close]')) $('about').hidden = true;
    });

    $('hud-restore').addEventListener('click', () => setHud(true));
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => DOP.sketch && DOP.sketch.redraw());
  }

  let scrubbing = false;

  function pickPlanet(which, id) {
    const other = which === 'a' ? 'b' : 'a';
    if (S[other] === id) S[other] = S[which];     // picking the other one swaps
    S[which] = id;
    S.cycle = 'auto';
    syncControls();
    changed('picture');
  }

  function slider(elId, key, tier, round) {
    const el = $(elId), map = MAPS[key];
    el.addEventListener('input', () => { S[key] = round(map.toVal(+el.value)); changed(tier); });
  }
  function colour(elId, key) {
    $(elId).addEventListener('input', e => { S[key] = e.target.value; changed('redraw'); });
  }

  function saveSVG() {
    const n = DOP.sketch.exportSVG();
    if (n) toast('Saved ' + n);
  }
  function copyLink() {
    writeURL();
    setTimeout(() => {
      const url = location.href;
      const ok = () => toast('Link copied — it opens exactly this drawing');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok, () => prompt('Copy this link:', url));
      } else prompt('Copy this link:', url);
    }, 300);
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ── Panels, sheets, HUD ──
  const store = {
    get(k) { try { return localStorage.getItem('dop.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('dop.' + k, v); } catch (e) { /* private mode */ } },
  };
  function setCollapsed(which, on) {
    if (window.innerWidth <= 900) {          // narrow: panels are sheets
      $('panel-' + which).classList.remove('sheet-open');
      return;
    }
    $('panel-' + which).classList.toggle('collapsed', on);
    $('tab-' + which).hidden = !on;
    store.set('collapsed.' + which, on ? '1' : '');
    DOP.sketch.redraw();
  }
  function toggleSheet(id) {
    const el = $(id), open = !el.classList.contains('sheet-open');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('sheet-open'));
    el.classList.toggle('sheet-open', open);
  }
  let hudOn = true;
  function setHud(on) {
    hudOn = on;
    $('hud').classList.toggle('hidden', !on);
    $('hud-restore').hidden = on;
    DOP.sketch.redraw();
  }

  function onKey(e) {
    if (e.target.closest && e.target.closest('input, select, textarea')) {
      if (e.key !== 'Escape') return;
    }
    if (e.key === 'Escape') { $('about').hidden = true; $('menu-png').hidden = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); DOP.sketch.togglePlay(); }
    else if (e.key === 'r' || e.key === 'R') DOP.sketch.restart();
    else if (e.key === 'h' || e.key === 'H') setHud(!hudOn);
  }

  // Free area of the window the drawing is centred in: between the panels
  // and above the transport bar on wide screens; under the title on narrow.
  function viewport() {
    const W = window.innerWidth, H = window.innerHeight;
    if (!hudOn) return { x: 0, y: 0, w: W, h: H };
    const cs = getComputedStyle(document.documentElement);
    const gap = parseFloat(cs.getPropertyValue('--gap')) || 16;
    const bar = parseFloat(cs.getPropertyValue('--bar-h')) || 52;
    const bottom = bar + gap * 2;
    if (W <= 900) {
      const top = $('btn-about').getBoundingClientRect().bottom + gap;
      return { x: 0, y: top, w: W, h: Math.max(100, H - top - bottom) };
    }
    const l = $('panel-controls').classList.contains('collapsed') ? 0 : $('panel-controls').offsetWidth + gap * 2;
    const r = $('panel-info').classList.contains('collapsed') ? 0 : $('panel-info').offsetWidth + gap * 2;
    return { x: l, y: 0, w: Math.max(100, W - l - r), h: Math.max(100, H - bottom) };
  }

  // ── Keep every control showing the current settings ──
  function syncControls() {
    $('sel-a').value = S.a; $('sel-b').value = S.b;
    document.querySelectorAll('.seg').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === S[seg.dataset.key]));
    });
    for (const key of Object.keys(MAPS)) $('sl-' + key).value = MAPS[key].toPos(S[key]);
    $('sl-opacity').value = S.opacity;
    $('col-single').value = S.color; $('col-g1').value = S.grad1; $('col-g2').value = S.grad2;
    $('chk-planets').checked = S.planets; $('chk-orbits').checked = S.orbits; $('chk-classic').checked = S.classic;
    if (S.classic) document.querySelector('.advanced').open = true;
    document.body.dataset.colorMode = S.colorMode;
    document.body.dataset.loop = S.loop;
    document.querySelectorAll('.preset').forEach(b => {
      const p = M.PRESETS.find(x => x.id === b.dataset.preset);
      b.classList.toggle('active', p.a === S.a && p.b === S.b && (p.cycle || 'auto') === S.cycle);
    });
  }

  // Readouts that depend on settings + pair (not on progress).
  function updateReadouts() {
    if (!pair) return;
    const fast = pair.fast.name;
    $('out-detail').textContent = pair.detailClamped
      ? `${pair.detail} / ${fast} orbit (max here)`
      : `${pair.detail} / ${fast} orbit`;
    const yrPerSec = S.speed * pair.cycle.years / pair.cycle.p;
    $('out-speed').textContent = yrPerSec < 0.1 ? `≈ ${fmt(yrPerSec * 365.25, 1)} days / s`
      : `≈ ${fmt(yrPerSec, yrPerSec < 10 ? 2 : 0)} years / s`;
    $('out-opacity').textContent = S.opacity + '%';
    $('out-weight').textContent = fmt(S.weight, 2) + ' px';
    const fadeSecs = Math.log(0.01) / Math.log(1 - S.fade / 255) / 60;
    $('out-fade').textContent = `over ~${fadeSecs < 10 ? fmt(fadeSecs, 1) : Math.round(fadeSecs)} s`;
    $('out-zoom').textContent = Math.round(S.zoom) + '%';
    $('hint-style').textContent = S.style === 'lines'
      ? 'A straight line between the two planets.'
      : 'The path of the point halfway between them.';

    const every = pair.daysPerLine != null ? fmtDays(pair.daysPerLine) : fmtDays(pair.yearsPerStep * 365.25);
    const what = S.style === 'lines'
      ? `A line between ${pair.A.name} and ${pair.B.name} every ${every}`
      : `The midpoint of ${pair.A.name} and ${pair.B.name}, traced every ${every}`;
    $('caption').textContent = `${what}, for ${fmtYears(pair.cycle.years)}${S.classic ? ' — classic v2 speeds' : ''}.`;
    document.title = `${pair.A.name} & ${pair.B.name} — Dance of Planets`;
    $('classic-badge').hidden = !S.classic;
    updateRaw();
  }

  function updateRaw(st) {
    if (!pair) return;
    st = st || DOP.sketch.status();
    const v = st ? `${fmt(Math.min(st.k, pair.N), 0)} / ${fmt(pair.N, 0)}` : '—';
    const rows = [
      ['Lines drawn', v],
      ['Detail', `${pair.detail} per ${pair.fast.name} orbit`],
      ['One step', pair.classic ? `${fmt(pair.dParam, 4)} (classic units)` : `${fmt(pair.dParam * 365.25, 3)} days`],
      ['Lines / frame', fmt(S.speed * pair.detail / 60, 2)],
      ['Fade alpha', `${fmt(S.fade, 2)} / 255 per frame`],
      ['Cycle', `${pair.cycle.p}/${pair.cycle.q} ≈ ${fmt(pair.R, 5)}`],
      ['Speeds', pair.classic ? 'classic: rate ∝ period' : 'correct: rate ∝ 1 / period'],
    ];
    $('raw').innerHTML = rows.map(([k, x]) => `<dt>${k}</dt><dd>${x}</dd>`).join('');
  }

  // ── Called by the sketch ──
  function onPicture(p) {
    pair = p;
    // cycle options
    $('sel-cycle').innerHTML = p.cycles.map(c => {
      const tag = c.key === p.autoKey ? ' ★' : '';
      const off = Math.abs(c.miss) < 0.05 ? 'exact' : `${fmt(Math.abs(c.miss), Math.abs(c.miss) < 1 ? 2 : 1)}° off`;
      return `<option value="${c.key}">${fmtYears(c.years)} · ${c.p} : ${c.q} · ${off}${tag}</option>`;
    }).join('');
    $('sel-cycle').value = p.cycle.key;

    // planets
    const cards = [p.A, p.B].map((P, i) => `
      <div class="planet-card">
        <span class="dot" style="background:${P.color}"></span>
        <span class="name">${P.name}<span class="glyph">${P.glyph}</span></span>
        <span class="meta">${P.period < 1 ? fmt(P.period * 365.25, 0) + ' days' : fmt(P.period, P.period < 10 ? 2 : 1) + ' years'} around · ${fmt(P.au, 2)} AU out</span>
        <span class="orbit-bar"><i id="obar-${i}"></i></span>
        <span class="count" id="ocount-${i}"></span>
      </div>`).join('');
    $('planets-info').innerHTML = cards;

    // rhythm
    const c = p.cycle;
    const fastN = Math.round(c.p), slowN = Math.round(c.q);
    $('ratio').innerHTML = `${fastN} : ${slowN}<small>${p.fast.name.toUpperCase()} : ${p.slow.name.toUpperCase()} ${p.classic ? '(CLASSIC)' : ''}</small>`;
    // Always tell the real-orbit story: inner planet makes p orbits.
    const inner = p.A.period <= p.B.period ? p.A : p.B, outer = inner === p.A ? p.B : p.A;
    const m = Math.abs(c.miss);
    const nearly = m < 0.05 ? 'exactly' : m < 3 ? 'almost exactly' : m < 12 ? 'very nearly' : 'roughly';
    $('rhythm-text').textContent = c.symmetry === 0
      ? `${p.A.name} and ${p.B.name} take the same time to go around, so the pattern is a single band.`
      : `In ${fmtYears(c.years)}, ${inner.name} goes around the Sun ${fastN} times while ${outer.name} goes around ${slowN} times — ${nearly}.`;
    const facts = [
      ['Symmetry', c.symmetry ? `${c.symmetry}-fold<em>${fastN} − ${slowN}</em>` : '—'],
      ['They line up', isFinite(p.synodic) ? `every ${fmtYears(p.synodic)}<em>synodic period</em>` : '—'],
      ['Cycle closes', `${closeness(c.miss)}<em>${Math.abs(c.miss) < 0.05 ? 'the pattern repeats' : 'so the pattern slowly turns'}</em>`],
      ['Closest · farthest', `${fmt(p.closest, 2)} · ${fmt(p.farthest, 2)} AU`],
    ];
    $('facts').innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    syncControls();
    updateReadouts();
  }

  let frame = 0;
  function onFrame(st) {
    if (!st) return;
    $('btn-play').textContent = st.done ? '↺' : st.playing ? '❚❚' : '▶';
    $('btn-play').title = st.done ? 'Draw again (space)' : st.playing ? 'Pause (space)' : 'Play (space)';
    if (frame++ % 4) return;
    if (!scrubbing) $('scrub').value = Math.round(st.frac * 1000);
    const Y = pair.cycle.years;
    const y = S.loop === 'cont' ? st.year : st.done ? Y : st.year;
    const yTxt = Y < 1 ? `${fmt(y * 12, 1)} of ${fmt(Y * 12, 1)} months` : `year ${fmt(y, Y < 10 ? 1 : 0)} of ${fmt(Y, Y < 10 ? 1 : 0)}`;
    $('time').textContent = S.loop === 'cont' ? `cycle ${st.cycleNo} · ${yTxt}` : st.done ? `done · ${fmtYears(Y)}` : yTxt;
    const totals = pair.cycleOrbits;
    st.orbits.forEach((o, i) => {
      const inCycle = S.loop === 'cont' ? o % totals[i] : Math.min(o, totals[i]);
      const bar = $('obar-' + i), cnt = $('ocount-' + i);
      if (bar) bar.style.width = (inCycle / totals[i] * 100) + '%';
      if (cnt) cnt.textContent = `${fmt(inCycle, 1)} of ${totals[i]} orbits`;
    });
    if (frame % 16 === 1) updateRaw(st);
  }

  DOP.ui = { viewport, onPicture, onFrame };

  // ── Boot ──
  readURL();
  buildPlanetSelects();
  buildPresets();
  wire();
  for (const w of ['controls', 'info']) {
    if (store.get('collapsed.' + w) === '1') {
      $('panel-' + w).classList.add('collapsed'); $('tab-' + w).hidden = false;
    }
  }
  syncControls();

})();
