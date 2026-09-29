// Island Generator v5.0 — interface
// © Jesal Mehta, @cabofcuriosity
// Owns IG.settings, wires the controls, fills the map facts and caption,
// keeps the URL in sync. Talks to the sketch only through IG.sketch; the
// sketch calls back IG.ui.onTerrain / onLevels and the marker edits.
//
// Every setting falls into one tier (ISLAND-GENERATOR.md, "Tiers"):
//   terrain — the height function changes: resample everything
//   levels  — sea level, bands: recolour the field already sampled
//   look    — style, depth: recolour (lines ↔ fill resamples)
//   view    — zoom, pan: resample for the window, map unchanged
//   none    — sheet on/off, resolution: only affects the frame and export

(function () {

  const M = IG.model;
  const $ = id => document.getElementById(id);

  const DEFAULTS = {
    seed: 2020,
    scale: 3, rough: 0.5, ridges: 0.15, warp: 0.3, peak: 1.3,
    focus: 0.9, shape: 'points', count: 1, size: 0.55,
    sea: 0.62, bands: 12, depth: false,
    style: 'grey', contours: false, markers: true,
    page: 'A4', orient: 'portrait', dpi: 300, sheet: true, cw: 300, ch: 200,
    extra: [], removed: [], moved: {},
  };
  const S = IG.settings = JSON.parse(JSON.stringify(DEFAULTS));
  S.zoom = 100; S.panX = null; S.panY = null;          // view: not in the URL

  // ── URL state: short keys, non-defaults only ──
  const URL_KEYS = {
    seed: 's', scale: 'fs', rough: 'r', ridges: 'rg', warp: 'w', peak: 'pk',
    focus: 'f', shape: 'sh', count: 'n', size: 'sz', sea: 'sl', bands: 'b', depth: 'dp',
    style: 'st', contours: 'ln', page: 'pg', orient: 'o', dpi: 'dpi', sheet: 'sf', cw: 'cw', ch: 'ch',
  };
  const NUM = { seed: [0, 999999], scale: [0.5, 16], rough: [0, 1], ridges: [0, 1], warp: [0, 1],
    peak: [0.3, 4], focus: [0, 1], count: [1, 16], size: [0.05, 1.5], sea: [0, 1], bands: [2, 30], dpi: [72, 600],
    cw: [20, 2000], ch: [20, 2000] };
  const ENUM = { shape: ['points', 'edge', 'line'], style: ['grey', 'thermal', 'topo', 'lines'],
    page: Object.keys(M.PAGES).concat('custom'), orient: ['portrait', 'landscape'] };
  const INT = new Set(['seed', 'count', 'bands', 'dpi', 'cw', 'ch']);

  function readURL() {
    const q = new URLSearchParams(location.search);
    for (const [key, short] of Object.entries(URL_KEYS)) {
      if (!q.has(short)) continue;
      const v = q.get(short);
      if (typeof DEFAULTS[key] === 'boolean') S[key] = v === '1';
      else if (NUM[key]) { let n = parseFloat(v); if (isFinite(n)) { if (INT.has(key)) n = Math.round(n); S[key] = clamp(n, ...NUM[key]); } }
      else if (ENUM[key] && ENUM[key].includes(v)) S[key] = v;
    }
    // marker edits: ex=x,y;x,y  rm=0.3  mv=0:x,y;2:x,y
    const pts = str => (str || '').split(';').map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(isFinite));
    if (q.has('ex')) S.extra = pts(q.get('ex')).map(([x, y]) => ({ x, y }));
    if (q.has('rm')) S.removed = q.get('rm').split('.').map(Number).filter(isFinite);
    if (q.has('mv')) for (const part of q.get('mv').split(';')) {
      const [i, xy] = part.split(':'); const p = pts(xy)[0];
      if (p && isFinite(+i)) S.moved[+i] = { x: p[0], y: p[1] };
    }
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
        else if (typeof v === 'number') v = +v.toFixed(3);
        q.set(short, v);
      }
      const r3 = n => +n.toFixed(3);
      if (S.extra.length) q.set('ex', S.extra.map(c => `${r3(c.x)},${r3(c.y)}`).join(';'));
      if (S.removed.length) q.set('rm', S.removed.join('.'));
      const mv = Object.entries(S.moved);
      if (mv.length) q.set('mv', mv.map(([i, c]) => `${i}:${r3(c.x)},${r3(c.y)}`).join(';'));
      const qs = q.toString().replace(/%2C/g, ',').replace(/%3B/g, ';').replace(/%3A/g, ':');
      try { history.replaceState(null, '', qs ? '?' + qs : location.pathname); } catch (e) { /* file:// */ }
    }, 250);
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n, d) => n.toLocaleString('en', { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = x => Math.round(x * 100) + '%';

  // ── Sliders: key → [element id, min, max, step, scale, tier, readout] ──
  const log = (min, max) => ({ toVal: p => min * Math.pow(max / min, p / 1000), toPos: v => Math.round(Math.log(v / min) / Math.log(max / min) * 1000) });
  const lin = (min, max) => ({ toVal: p => min + (max - min) * p / 1000, toPos: v => Math.round((v - min) / (max - min) * 1000) });
  const rev = m => ({ toVal: p => m.toVal(1000 - p), toPos: v => 1000 - m.toPos(v) });
  const SLIDERS = {
    focus:  { map: lin(0, 1), round: 2, tier: 'terrain', out: v => v === 0 ? 'off · mainland' : pct(v) },
    count:  { map: lin(1, 16), round: 0, tier: 'terrain', out: v => v + (v === 1 ? ' island' : ' islands') },
    size:   { map: log(0.08, 1.2), round: 3, tier: 'terrain', out: v => pct(v) + ' of sheet' },
    scale:  { map: rev(log(0.8, 12)), round: 2, tier: 'terrain', out: v => v < 2 ? 'very smooth' : v < 5 ? 'smooth' : v < 8 ? 'busy' : 'chaotic' },
    rough:  { map: lin(0, 1), round: 2, tier: 'terrain', out: v => v < 0.25 ? 'smooth' : v < 0.6 ? 'natural' : v < 0.85 ? 'rugged' : 'jagged' },
    ridges: { map: lin(0, 1), round: 2, tier: 'terrain', out: v => v === 0 ? 'none' : pct(v) },
    warp:   { map: lin(0, 1), round: 2, tier: 'terrain', out: v => v === 0 ? 'none' : pct(v) },
    peak:   { map: log(0.4, 3), round: 2, tier: 'terrain', out: v => v < 0.85 ? 'plateaus' : v < 1.2 ? 'even' : v < 2 ? 'peaks' : 'spires' },
    sea:    { map: lin(0, 0.98), round: 3, tier: 'levels', out: v => pct(v) + ' under water' },
    bands:  { map: lin(2, 30), round: 0, tier: 'levels', out: v => v + ' bands' },
    zoom:   { map: log(25, 1600), round: 0, tier: 'view', out: v => Math.round(v) + '%' },
  };
  const roundTo = (v, d) => { const k = Math.pow(10, d); return Math.round(v * k) / k; };

  function changed(tier) {
    if (tier === 'terrain') IG.sketch.terrainChanged();
    else if (tier === 'levels') IG.sketch.levelsChanged();
    else if (tier === 'look') IG.sketch.lookChanged(false);
    else if (tier === 'resample') IG.sketch.lookChanged(true);
    else if (tier === 'view') IG.sketch.viewChanged();
    updateReadouts();
    writeURL();
  }
  // Generated centres are numbered by the seed/count/shape; if those
  // change, per-index moves and removals no longer mean anything.
  function forgetGeneratedEdits() { S.removed = []; S.moved = {}; }

  // ── Build ──
  function buildPresets() {
    $('presets').innerHTML = M.PRESETS.map(p =>
      `<button class="preset" type="button" data-preset="${p.id}"><b>${p.title}</b><small>${p.note}</small></button>`).join('');
    $('presets').addEventListener('click', e => {
      const b = e.target.closest('[data-preset]'); if (!b) return;
      const p = M.PRESETS.find(x => x.id === b.dataset.preset);
      Object.assign(S, p.p);
      S.extra = []; forgetGeneratedEdits();
      syncControls();
      changed('terrain');
    });
  }
  function buildPages() {
    const label = { SQ: 'Square', custom: 'Custom', none: 'None' };
    $('seg-page').innerHTML = ['A5', 'A4', 'A3', 'SQ', 'custom', 'none'].map(k =>
      `<button type="button" data-value="${k}">${label[k] || k}</button>`).join('');
  }
  // Sheet changes: only a change of shape rebuilds the map (A5/A4/A3 share
  // one shape; None hides the frame and keeps the sheet underneath).
  function sheetChanged(apply) {
    const before = IG.sketch.aspect();
    apply();
    syncControls();
    if (Math.abs(IG.sketch.aspect() - before) > 1e-9) { S.panX = S.panY = null; changed('terrain'); }
    else changed(null);
  }

  // ── Wiring ──
  function wire() {
    for (const [key, cfg] of Object.entries(SLIDERS)) {
      const el = $('sl-' + key);
      el.addEventListener('input', () => {
        const v = roundTo(cfg.map.toVal(+el.value), cfg.round);
        if (key === 'count' && v !== S.count) forgetGeneratedEdits();
        S[key] = v;
        if (key === 'zoom') { if (v <= 100.5) { S.panX = S.panY = null; } }
        changed(cfg.tier);
      });
    }
    document.querySelectorAll('.seg[data-key]').forEach(seg => {
      seg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const key = seg.dataset.key;
        let v = b.dataset.value; if (key === 'dpi') v = +v;
        if (key === 'shape' && S.focus <= 0) {
          // shapes only act through land weight; picking one turns it on
          S.focus = 0.85; toast('Land weight turned on so the shape shows');
        } else if (S[key] === v) return;
        const wasLines = S.style === 'lines';
        if (key === 'orient') return sheetChanged(() => { S.orient = v; });
        S[key] = v;
        syncControls();
        if (key === 'shape') { forgetGeneratedEdits(); changed('terrain'); }
        else if (key === 'style') changed((wasLines || v === 'lines') ? 'resample' : 'look');
        else changed(null);
      });
    });
    $('seg-page').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const v = b.dataset.value;
      sheetChanged(() => { if (v === 'none') S.sheet = false; else { S.sheet = true; S.page = v; } });
    });
    for (const k of ['cw', 'ch']) $('inp-' + k).addEventListener('change', e => {
      const v = clamp(Math.round(+e.target.value) || S[k], ...NUM[k]);
      sheetChanged(() => { S[k] = v; });
    });
    $('chk-depth').addEventListener('change', e => { S.depth = e.target.checked; changed('look'); });
    $('chk-lines').addEventListener('change', e => { S.contours = e.target.checked; changed('look'); });
    $('chk-markers').addEventListener('change', e => { S.markers = e.target.checked; changed(null); });
    $('btn-reset-markers').addEventListener('click', () => {
      S.extra = []; forgetGeneratedEdits(); changed('terrain'); toast('Island centres back to the generated ones');
    });
    $('btn-fit').addEventListener('click', fit);

    $('btn-new').addEventListener('click', newLandscape);
    $('inp-seed').addEventListener('change', e => {
      const v = clamp(Math.round(+e.target.value) || 0, 0, 999999);
      S.seed = v; S.extra = []; forgetGeneratedEdits(); syncControls(); changed('terrain');
    });

    // export
    const busy = { on: false };
    async function run(label, fn) {
      if (busy.on) return; busy.on = true;
      toast(label + '…', true);
      await new Promise(r => setTimeout(r, 30));
      try {
        const r = await fn(p => toast(`${label} · ${Math.round(p * 100)}%`, true));
        toast('Saved ' + r.name + (r.capped ? ' (size capped)' : ''));
      } catch (err) {
        console.error(err); toast('Export failed: ' + err.message);
      }
      busy.on = false;
    }
    $('btn-png').addEventListener('click', () => run('Rendering PNG', IG.sketch.exportPNG));
    $('btn-height').addEventListener('click', () => run('Rendering heightmap', IG.sketch.exportHeightmap));
    $('btn-svg-lines').addEventListener('click', () => run('Tracing contours', p => IG.sketch.exportSVG('lines', p)));
    $('btn-svg-layers').addEventListener('click', () => run('Tracing layers', p => IG.sketch.exportSVG('layers', p)));
    $('btn-link').addEventListener('click', copyLink);

    // panels
    document.querySelectorAll('[data-collapse]').forEach(b =>
      b.addEventListener('click', () => setCollapsed(b.dataset.collapse, true)));
    $('tab-controls').addEventListener('click', () => setCollapsed('controls', false));
    $('tab-page').addEventListener('click', () => setCollapsed('page', false));
    $('m-controls').addEventListener('click', () => toggleSheet('panel-controls'));
    $('m-page').addEventListener('click', () => toggleSheet('panel-page'));

    $('btn-about').addEventListener('click', () => { $('about').hidden = false; });
    $('about').addEventListener('click', e => {
      if (e.target === $('about') || e.target.closest('[data-close]')) $('about').hidden = true;
    });
    $('hud-restore').addEventListener('click', () => setHud(true));
    window.addEventListener('keydown', onKey);

    // Collapsible sections: open by default, each viewer's choice remembered
    document.querySelectorAll('details.sec').forEach(d => {
      const v = store.get('sec.' + d.dataset.sec);
      if (v === '0') d.open = false;
      d.addEventListener('toggle', () => store.set('sec.' + d.dataset.sec, d.open ? '1' : '0'));
    });

    // ⓘ help: hover on desktop, tap on touch; one floating tip
    const tip = $('tip');
    let pinned = null;
    function showTip(btn) {
      tip.textContent = btn.dataset.tip; tip.hidden = false;
      const r = btn.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 20);
      tip.style.width = w + 'px';
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
      tip.style.left = x + 'px';
      const below = r.bottom + 8, h = tip.offsetHeight;
      tip.style.top = (below + h < window.innerHeight - 10 ? below : r.top - h - 8) + 'px';
    }
    function hideTip() { tip.hidden = true; pinned = null; }
    document.querySelectorAll('.info').forEach(b => {
      b.setAttribute('aria-label', b.dataset.tip);
      b.addEventListener('mouseenter', () => { if (!pinned) showTip(b); });
      b.addEventListener('mouseleave', () => { if (!pinned) tip.hidden = true; });
      b.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();          // don't toggle the section
        if (pinned === b) return hideTip();
        pinned = b; showTip(b);
      });
    });
    document.addEventListener('click', e => { if (pinned && !e.target.closest('.info')) hideTip(); });
    document.querySelectorAll('.panel-body').forEach(b => b.addEventListener('scroll', hideTip, { passive: true }));

    // "more below" fade on panels that scroll
    document.querySelectorAll('.panel-body').forEach(b => b.addEventListener('scroll', updateMore, { passive: true }));
    document.querySelectorAll('.panel details').forEach(d => d.addEventListener('toggle', updateMore));
    window.addEventListener('resize', updateMore);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(updateMore);
      document.querySelectorAll('.panel-body').forEach(b => { ro.observe(b); for (const c of b.children) ro.observe(c); });
    }
  }

  function updateMore() {
    document.querySelectorAll('.panel').forEach(p => {
      const b = p.querySelector('.panel-body');
      p.classList.toggle('has-more', b.scrollHeight - b.scrollTop - b.clientHeight > 6);
    });
  }

  function newLandscape() {
    S.seed = Math.floor(Math.random() * 1e6);
    S.extra = []; forgetGeneratedEdits();
    syncControls(); changed('terrain');
  }
  function fit() { S.zoom = 100; S.panX = S.panY = null; syncControls(); changed('view'); }

  function copyLink() {
    writeURL();
    setTimeout(() => {
      const url = location.href;
      const ok = () => toast('Link copied — it opens exactly this map');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, () => prompt('Copy this link:', url));
      else prompt('Copy this link:', url);
    }, 300);
  }

  let toastTimer = 0;
  function toast(msg, sticky) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ── Marker edits (called by the sketch) ──
  function moveCentre(c, x, y) {
    if (c.extra != null) S.extra[c.extra] = { x, y };
    else S.moved[c.gen] = { x, y };
    changed('terrain');
  }
  function addCentre(x, y) {
    if (!S.markers) return;
    if (S.focus <= 0) { S.focus = 0.85; syncControls(); toast('Land weight turned on so the new island shows'); }
    if (S.shape === 'edge') {
      const c = IG.sketch.centres()[0];
      if (c) moveCentre(c, x, y); else { S.extra = [{ x, y }]; changed('terrain'); }
      return;
    }
    S.extra.push({ x, y });
    changed('terrain');
  }
  function removeCentre(c) {
    if (c.extra != null) S.extra.splice(c.extra, 1);
    else S.removed.push(c.gen);
    changed('terrain');
  }
  function zoomChanged() { syncControls(); changed('view'); }

  // ── Panels, sheets, HUD ──
  const store = {
    get(k) { try { return localStorage.getItem('ig.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('ig.' + k, v); } catch (e) { /* private mode */ } },
  };
  function setCollapsed(which, on) {
    if (window.innerWidth <= 900) { $('panel-' + which).classList.remove('sheet-open'); return; }
    $('panel-' + which).classList.toggle('collapsed', on);
    $('tab-' + which).hidden = !on;
    store.set('collapsed.' + which, on ? '1' : '');
    changed('view');
  }
  function toggleSheet(id) {
    const el = $(id), open = !el.classList.contains('sheet-open');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('sheet-open'));
    el.classList.toggle('sheet-open', open);
    updateMore();
  }
  let hud = true;
  function setHud(on) {
    hud = on;
    $('hud').classList.toggle('hidden', !on);
    $('hud-restore').hidden = on;
    changed('view');
  }

  function onKey(e) {
    if (e.target.closest && e.target.closest('input, select, textarea')) { if (e.key !== 'Escape') return; }
    if (e.key === 'Escape') { $('about').hidden = true; $('tip').hidden = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'n') newLandscape();
    else if (k === 'h') setHud(!hud);
    else if (k === 'f') fit();
    else if (k === '1' || k === '2' || k === '3' || k === '4') {
      const v = ['grey', 'thermal', 'topo', 'lines'][+k - 1];
      if (v !== S.style) { const was = S.style; S.style = v; syncControls(); changed(was === 'lines' || v === 'lines' ? 'resample' : 'look'); }
    }
  }

  // Free area the page is fitted into: between the panels and above the bar.
  function viewport() {
    const W = window.innerWidth, H = window.innerHeight;
    if (!hud) return { x: 0, y: 0, w: W, h: H };
    const cs = getComputedStyle(document.documentElement);
    const gap = parseFloat(cs.getPropertyValue('--gap')) || 16;
    const bar = parseFloat(cs.getPropertyValue('--bar-h')) || 52;
    const bottom = bar + gap * 2;
    const top = $('caption').getBoundingClientRect().bottom + gap;
    if (W <= 900) return { x: 0, y: top, w: W, h: Math.max(100, H - top - bottom) };
    const l = $('panel-controls').classList.contains('collapsed') ? 0 : $('panel-controls').offsetWidth + gap * 2;
    const r = $('panel-page').classList.contains('collapsed') ? 0 : $('panel-page').offsetWidth + gap * 2;
    return { x: l, y: top, w: Math.max(100, W - l - r), h: Math.max(100, H - top - bottom) };
  }

  // ── Keep controls showing the settings ──
  function syncControls() {
    for (const [key, cfg] of Object.entries(SLIDERS)) $('sl-' + key).value = cfg.map.toPos(S[key]);
    document.querySelectorAll('.seg[data-key]').forEach(seg => {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(S[seg.dataset.key]) === b.dataset.value));
    });
    const pageOn = S.sheet ? S.page : 'none';
    $('seg-page').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.value === pageOn));
    $('inp-cw').value = S.cw; $('inp-ch').value = S.ch;
    document.body.dataset.page = pageOn;
    $('chk-depth').checked = S.depth; $('chk-markers').checked = S.markers; $('chk-lines').checked = S.contours || S.style === 'lines'; $('chk-lines').disabled = S.style === 'lines';
    $('inp-seed').value = S.seed;
    document.body.dataset.shape = S.shape;
    document.body.dataset.style = S.style;
    document.body.dataset.focus = S.focus > 0 ? 'on' : 'off';
    document.querySelectorAll('.preset').forEach(b => {
      const p = M.PRESETS.find(x => x.id === b.dataset.preset);
      b.classList.toggle('active', Object.entries(p.p).every(([k, v]) => S[k] === v));
    });
  }

  function updateReadouts() {
    if (!IG.sketch) return;
    for (const [key, cfg] of Object.entries(SLIDERS)) $('out-' + key).textContent = cfg.out(S[key]);
    const P = IG.sketch.pagePixels(S.dpi);
    $('out-page').textContent = P.window
      ? `No sheet · exports the window as shown, ${fmt(P.w, 0)} × ${fmt(P.h, 0)} px`
      : `${P.wmm} × ${P.hmm} mm · ${fmt(P.w, 0)} × ${fmt(P.h, 0)} px${P.capped ? ` (capped to ${P.dpi} dpi)` : ''}`;
  }

  let lastStats = null, lastLevels = null;
  function onTerrain(st) { lastStats = st; describe(); }
  function onLevels(lv, st) { lastLevels = lv; lastStats = st; describe(); }

  function describe() {
    const st = lastStats; if (!st) return;
    let what;
    if (st.pieces === 0) what = 'Open sea';
    else if (st.landShare > 0.5 && st.piecesTouchingEdge > 0) what = st.lakes > 2 ? `Mainland with ${st.lakes} lakes` : 'Mainland running off the page';
    else if (st.pieces === 1) what = st.piecesTouchingEdge ? 'A coast' : 'A single island';
    else if (st.largestShare > 0.7) what = `An island with ${st.pieces - 1} islet${st.pieces > 2 ? 's' : ''}`;
    else what = `An archipelago of ${st.pieces} islands`;
    $('caption').textContent = `${what} · ${pct(st.landShare)} land · ${st.bands} contour bands`;
    document.title = `${what} — Island Generator`;

    const rows = [
      ['Land', `${pct(st.landShare)}<em>of the page</em>`],
      ['Pieces of land', st.pieces ? `${st.pieces}<em>largest is ${pct(st.largestShare)} of the land</em>` : '—'],
      ['Reaching the edge', st.piecesTouchingEdge ? `${st.piecesTouchingEdge}<em>land continues off the page</em>` : 'none<em>every island is whole</em>'],
      ['Lakes', st.lakes || '—'],
      ['Island centres', S.focus > 0 ? `${st.centres}<em>${S.shape === 'edge' ? 'one sets which side is land' : S.shape === 'line' ? 'joined into a spine' : 'land gathers round them'}</em>` : 'off<em>land weight is 0</em>'],
    ];
    $('facts').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const L = lastLevels;
    if (L) {
      const raw = [
        ['Seed', S.seed],
        ['Sea level', `${fmt(L.sea, 3)} (quantile ${fmt(S.sea, 2)})`],
        ['Contour step', fmt(L.step, 4)],
        ['Height range', `${fmt(L.min, 3)} – ${fmt(L.top, 3)}`],
        ['Noise', `${fmt(S.scale, 2)} cycles/page · gain ${fmt(0.3 + 0.45 * S.rough, 2)} · 6 octaves`],
        ['Exponent', fmt(S.peak, 2)],
      ];
      $('raw').innerHTML = raw.map(([k, x]) => `<dt>${k}</dt><dd>${x}</dd>`).join('');
    }
  }

  IG.ui = { viewport, onTerrain, onLevels, moveCentre, addCentre, removeCentre, zoomChanged, refresh: updateReadouts, hudOn: () => hud };

  // ── Boot ──
  readURL();
  buildPresets();
  buildPages();
  wire();
  for (const w of ['controls', 'page']) {
    if (store.get('collapsed.' + w) === '1') { $('panel-' + w).classList.add('collapsed'); $('tab-' + w).hidden = false; }
  }
  syncControls();
  // readouts need the sketch (page pixels): it calls IG.ui.refresh() from setup

})();
