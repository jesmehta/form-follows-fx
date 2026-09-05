/* FFFX editor -- browser UI. Talks to tools/fffx-editor.js's /api/* routes;
   never touches the TSV files itself. Every mutating action refetches
   /api/state afterward rather than patching local state, so the UI can
   never drift from what's actually on disk (or from validation problems a
   *different* row's edit just introduced -- e.g. renaming a section id
   invalidates every entry that referenced the old id). Modeled on
   CabinetOfCuriosities/tools/cabinet-editor-ui/editor.js, trimmed: no
   reserved/collapsible-panel columns (FFFX's schema has none), plus a
   Build tab replacing Cabinet's single header Rebuild button. */

const STATUS_OPTIONS = ["true", "false", "wip"];
const LOCATION_OPTIONS = ["external", "internal-md", "external-repo", ""];

const NUMERIC_FIELDS = new Set(["order", "weight"]);
const WIDE_FIELDS = new Set(["subtitle", "notes", "tags", "href", "relatedLinks"]);

// Starting column widths (px) -- purely a first-render default; dragging a
// column's resize handle overrides it for the rest of the session (not
// persisted across reloads, this is a view preference, not saved state).
const DEFAULT_COL_WIDTH = {
  id: 120, section: 130, title: 170, subtitle: 220, href: 200, order: 82,
  weight: 90, status: 80, kind: 150, tags: 160, location: 120, notes: 220,
  thumbnail: 160, sourceFolder: 150, relatedLinks: 200,
};

let state = { sections: [], entries: [], sectionProblems: [], entryProblems: [], columns: { sections: [], entries: [] } };
let searchSections = "";
let searchEntries = "";
const colWidths = { sections: {}, entries: {} };
const textExpanded = { sections: false, entries: false };
// col: null means "file order" (the order ▲▼ actually operate on); dir is
// 1 (ascending) or -1 (descending).
const sortState = { sections: { col: null, dir: 1 }, entries: { col: null, dir: 1 } };

/* ---------- server calls ---------- */

async function apiCall(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${method} ${url} failed (${res.status})`);
  return json;
}

async function loadState() {
  state = await apiCall("GET", "/api/state");
  renderSections();
  renderEntries();
}

function showStatus(message, kind) {
  const el = document.getElementById("status-banner");
  el.textContent = message;
  el.className = `status-banner ${kind}`;
  el.hidden = false;
  if (kind === "ok") setTimeout(() => { if (el.textContent === message) el.hidden = true; }, 4000);
}

async function runMutation(fn) {
  try {
    await fn();
    await loadState();
  } catch (err) {
    showStatus(err.message, "error");
    await loadState();
  }
}

/* ---------- helpers ---------- */

function esc(v) {
  return (v === undefined || v === null ? "" : String(v)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function selectHTML(value, options, field) {
  const opts = options.map(o => {
    const label = o === "" ? "—" : o;
    return `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(label)}</option>`;
  }).join("");
  const extra = (!options.includes(value) && value) ? `<option value="${esc(value)}" selected>${esc(value)} (custom)</option>` : "";
  return `<select data-field="${field}">${extra}${opts}</select>`;
}

function inputHTML(value, field, { numeric, wide } = {}) {
  if (wide) return `<textarea data-field="${field}" rows="1">${esc(value)}</textarea>`;
  // direction:rtl alongside text-align:right -- see cabinet-editor-ui's
  // editor.js for why (pins the right/most-significant edge in view when a
  // numeric value is too long for a narrowed column, instead of clipping it).
  const style = numeric ? ' style="text-align:right;direction:rtl;"' : "";
  return `<input type="text" data-field="${field}" value="${esc(value)}"${style}>`;
}

function fieldControl(value, col, selectMap) {
  if (selectMap[col]) return selectHTML(value, selectMap[col], col);
  return inputHTML(value, col, { numeric: NUMERIC_FIELDS.has(col), wide: WIDE_FIELDS.has(col) });
}

function problemsByIndex(problems) {
  const map = new Map();
  problems.forEach(p => { if (!map.has(p.index)) map.set(p.index, []); map.get(p.index).push(p); });
  return map;
}

// `order` renders right after `id` (rather than wherever it happens to sit
// in the TSV's own column order) so it's visually next to the ▲▼ buttons
// that actually move it -- doesn't touch the underlying schema/file column
// order, purely a display-order choice.
function displayCols(kind) {
  const cols = state.columns[kind].slice();
  const i = cols.indexOf("order");
  if (i > 1) { cols.splice(i, 1); cols.splice(1, 0, "order"); }
  return cols;
}

function cycleSort(s, col) {
  if (s.col !== col) { s.col = col; s.dir = 1; return; }
  if (s.dir === 1) { s.dir = -1; return; }
  s.col = null; s.dir = 1;
}

function compareRows(a, b, col) {
  const av = (a.row[col] ?? "").toString();
  const bv = (b.row[col] ?? "").toString();
  const aBlank = av.trim() === "", bBlank = bv.trim() === "";
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1; // blanks sort last regardless of direction
  if (bBlank) return -1;
  if (NUMERIC_FIELDS.has(col)) return Number(av) - Number(bv);
  return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
}

function applySort(visible, kind) {
  const s = sortState[kind];
  if (!s.col) return visible; // file order -- what the ▲▼ buttons operate on
  return visible.slice().sort((a, b) => compareRows(a, b, s.col) * s.dir);
}

function renderColgroup(kind, cols) {
  let html = `<colgroup><col class="narrow">`;
  cols.forEach(c => {
    const w = colWidths[kind][c] || DEFAULT_COL_WIDTH[c] || 140;
    html += `<col style="width:${w}px">`;
  });
  html += `</colgroup>`;
  return html;
}

function renderHeaderRow(kind, cols) {
  const s = sortState[kind];
  let html = `<tr><th></th>`;
  cols.forEach(c => {
    const active = s.col === c;
    const arrow = active ? (s.dir === 1 ? " ▲" : " ▼") : "";
    html += `<th data-col="${c}" class="${active ? "sorted" : ""}" title="Click to sort">${esc(c)}${arrow}<span class="col-resize-handle" data-col="${c}"></span></th>`;
  });
  html += `</tr>`;
  return html;
}

// Wires header-click-to-sort and drag-to-resize for one table. `onRender`
// is the render function to call after a sort change (resize doesn't need
// a re-render -- it mutates the <col> width directly for smoothness while
// dragging).
function wireTableHeader(container, kind, cols, onRender) {
  const table = container.querySelector("table");
  const colEls = Array.from(table.querySelectorAll(":scope > colgroup > col"));

  table.querySelectorAll("thead th[data-col]").forEach(th => {
    th.addEventListener("click", e => {
      if (e.target.classList.contains("col-resize-handle")) return;
      cycleSort(sortState[kind], th.dataset.col);
      onRender();
    });
  });

  table.querySelectorAll(".col-resize-handle").forEach(handle => {
    handle.addEventListener("mousedown", e => {
      e.preventDefault();
      e.stopPropagation();
      const col = handle.dataset.col;
      const colEl = colEls[cols.indexOf(col) + 1]; // +1 skips the leading rowctl <col>
      const startX = e.clientX;
      const startWidth = colEl.offsetWidth;
      handle.classList.add("active");
      function onMove(ev) {
        const width = Math.max(50, startWidth + (ev.clientX - startX));
        colEl.style.width = width + "px";
        colWidths[kind][col] = width;
      }
      function onUp() {
        handle.classList.remove("active");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        // A drag's mouseup almost never lands back on the 7px handle it
        // started on -- the browser then fires a native click targeted at
        // the nearest common ancestor of the mousedown/mouseup targets,
        // which is the <th> itself, indistinguishable from a real
        // click-to-sort unless suppressed here.
        table.addEventListener("click", suppressNextClick, { capture: true, once: true });
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

function suppressNextClick(e) {
  e.stopPropagation();
  e.preventDefault();
}

// A row's textareas (subtitle/notes/tags/href/relatedLinks) each had their
// own independent CSS resize handle, so dragging one taller left its row
// siblings at their old, now-mismatched height. Syncing every textarea in
// a row to whichever one is tallest -- on any of their resizes -- keeps
// the row looking like one row instead of a ransom note.
function wireRowTextareaSync(tr) {
  const areas = Array.from(tr.querySelectorAll("textarea"));
  if (areas.length < 2) return;
  const ro = new ResizeObserver(() => {
    const maxH = Math.max(...areas.map(a => a.offsetHeight));
    areas.forEach(a => { if (Math.abs(a.offsetHeight - maxH) > 1) a.style.height = maxH + "px"; });
  });
  areas.forEach(a => ro.observe(a));
}

function applyExpandState(container, kind) {
  const areas = container.querySelectorAll("textarea");
  if (textExpanded[kind]) {
    areas.forEach(a => { a.style.height = "auto"; a.style.height = a.scrollHeight + "px"; });
  } else {
    areas.forEach(a => { a.style.height = ""; });
  }
}

function updateExpandButton(kind) {
  const btn = document.getElementById(`expand-${kind}`);
  btn.textContent = textExpanded[kind] ? "⇱ Compact text" : "⇕ Expand text";
  btn.classList.toggle("toggled", textExpanded[kind]);
}

/* ---------- sections ---------- */

const SECTION_SELECT_MAP = { status: STATUS_OPTIONS };

function renderSections() {
  const container = document.getElementById("table-sections");
  const q = searchSections.trim().toLowerCase();
  const rows = state.sections;
  let visible = rows.filter(({ row }) => !q || [row.id, row.title].join(" ").toLowerCase().includes(q));
  document.getElementById("count-sections").textContent = `${rows.length} section${rows.length !== 1 ? "s" : ""}`;

  if (!rows.length) { container.innerHTML = `<div class="empty">No sections yet. Add one to get started.</div>`; return; }

  visible = applySort(visible, "sections");
  const sorted = sortState.sections.col !== null;
  const problems = problemsByIndex(state.sectionProblems);
  const cols = displayCols("sections");

  let html = `<table>${renderColgroup("sections", cols)}<thead>${renderHeaderRow("sections", cols)}</thead><tbody>`;

  visible.forEach(({ index, row }) => {
    const rowProblems = problems.get(index) || [];
    const badFields = new Set(rowProblems.map(p => p.field));
    const title = rowProblems.length ? rowProblems.map(p => p.message).join("; ") : "";

    html += `<tr class="${rowProblems.length ? "invalid" : ""}" data-idx="${index}" ${title ? `title="${esc(title)}"` : ""}>`;
    html += `<td class="rowctl">
      <button class="icon" data-act="up" title="${sorted ? "Clear sort to reorder" : "Move up"}" ${sorted ? "disabled" : ""}>▲</button>
      <button class="icon" data-act="down" title="${sorted ? "Clear sort to reorder" : "Move down"}" ${sorted ? "disabled" : ""}>▼</button>
      <button class="icon" data-act="del" title="Delete row">✕</button>
    </td>`;
    cols.forEach(col => {
      const control = fieldControl(row[col], col, SECTION_SELECT_MAP);
      html += `<td>${badFields.has(col) ? control.replace(/(<(?:input|select))/, `$1 class="bad"`) : control}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;

  wireTableHeader(container, "sections", cols, renderSections);

  container.querySelectorAll("tbody tr").forEach(tr => {
    const index = Number(tr.dataset.idx);
    wireRowTextareaSync(tr);
    tr.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("change", () => runMutation(() => apiCall("PUT", `/api/sections/${index}`, { [el.dataset.field]: el.value })));
    });
    tr.querySelector('[data-act="up"]').addEventListener("click", () => runMutation(() => apiCall("POST", `/api/sections/${index}/move`, { direction: "up" })));
    tr.querySelector('[data-act="down"]').addEventListener("click", () => runMutation(() => apiCall("POST", `/api/sections/${index}/move`, { direction: "down" })));
    tr.querySelector('[data-act="del"]').addEventListener("click", async () => {
      const ok = await confirmDialog("Delete section?", `Delete section "${esc(state.sections[index].row.id || "(untitled)")}"? This can't be undone. Entries still referencing it must be reassigned or deleted first.`);
      if (ok) runMutation(() => apiCall("DELETE", `/api/sections/${index}`));
    });
  });

  applyExpandState(container, "sections");
  updateExpandButton("sections");
}

document.getElementById("add-section").addEventListener("click", () => {
  runMutation(() => apiCall("POST", "/api/sections", { status: "wip" }));
  searchSections = ""; document.getElementById("search-sections").value = "";
});

/* ---------- entries ---------- */

const ENTRY_SELECT_MAP = { status: STATUS_OPTIONS, location: LOCATION_OPTIONS };

function renderEntries() {
  const container = document.getElementById("table-entries");
  const q = searchEntries.trim().toLowerCase();
  const rows = state.entries;
  const sectionIds = state.sections.map(s => s.row.id);
  let visible = rows.filter(({ row }) => !q || [row.id, row.title, row.section, row.tags, row.kind].join(" ").toLowerCase().includes(q));
  document.getElementById("count-entries").textContent = `${rows.length} entr${rows.length !== 1 ? "ies" : "y"}`;

  if (!rows.length) { container.innerHTML = `<div class="empty">No entries yet. Add one to get started.</div>`; return; }

  visible = applySort(visible, "entries");
  const sorted = sortState.entries.col !== null;
  const problems = problemsByIndex(state.entryProblems);
  const cols = displayCols("entries");

  let html = `<table>${renderColgroup("entries", cols)}<thead>${renderHeaderRow("entries", cols)}</thead><tbody>`;

  visible.forEach(({ index, row }) => {
    const rowProblems = problems.get(index) || [];
    const badFields = new Set(rowProblems.map(p => p.field));
    const title = rowProblems.length ? rowProblems.map(p => p.message).join("; ") : "";

    html += `<tr class="${rowProblems.length ? "invalid" : ""}" data-idx="${index}" ${title ? `title="${esc(title)}"` : ""}>`;
    html += `<td class="rowctl">
      <button class="icon" data-act="up" title="${sorted ? "Clear sort to reorder" : "Move up within section"}" ${sorted ? "disabled" : ""}>▲</button>
      <button class="icon" data-act="down" title="${sorted ? "Clear sort to reorder" : "Move down within section"}" ${sorted ? "disabled" : ""}>▼</button>
      <button class="icon" data-act="del" title="Delete row">✕</button>
    </td>`;
    cols.forEach(col => {
      if (col === "section") {
        const extra = (!sectionIds.includes(row.section) && row.section) ? `<option value="${esc(row.section)}" selected>${esc(row.section)} ⚠ missing</option>` : "";
        const list = sectionIds.map(id => `<option value="${esc(id)}" ${id === row.section ? "selected" : ""}>${esc(id)}</option>`).join("");
        html += `<td><select data-field="section" class="${badFields.has("section") ? "bad" : ""}">${extra}${list}</select></td>`;
        return;
      }
      const control = fieldControl(row[col], col, ENTRY_SELECT_MAP);
      html += `<td>${badFields.has(col) ? control.replace(/(<(?:input|select))/, `$1 class="bad"`) : control}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;

  wireTableHeader(container, "entries", cols, renderEntries);

  container.querySelectorAll("tbody tr").forEach(tr => {
    const index = Number(tr.dataset.idx);
    wireRowTextareaSync(tr);
    tr.querySelectorAll("[data-field]").forEach(el => {
      el.addEventListener("change", () => runMutation(() => apiCall("PUT", `/api/entries/${index}`, { [el.dataset.field]: el.value })));
    });
    tr.querySelector('[data-act="up"]').addEventListener("click", () => runMutation(() => apiCall("POST", `/api/entries/${index}/move`, { direction: "up" })));
    tr.querySelector('[data-act="down"]').addEventListener("click", () => runMutation(() => apiCall("POST", `/api/entries/${index}/move`, { direction: "down" })));
    tr.querySelector('[data-act="del"]').addEventListener("click", async () => {
      const ok = await confirmDialog("Delete entry?", `Delete entry "${esc(state.entries[index].row.id || "(untitled)")}"? This can't be undone.`);
      if (ok) runMutation(() => apiCall("DELETE", `/api/entries/${index}`));
    });
  });

  applyExpandState(container, "entries");
  updateExpandButton("entries");
}

document.getElementById("add-entry").addEventListener("click", () => {
  const firstSection = state.sections[0] ? state.sections[0].row.id : "";
  runMutation(() => apiCall("POST", "/api/entries", { status: "wip", weight: "2", section: firstSection }));
  searchEntries = ""; document.getElementById("search-entries").value = "";
});

/* ---------- tabs / search ---------- */

document.querySelectorAll("nav.tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav.tabs button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("section.panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
  });
});
document.getElementById("search-sections").addEventListener("input", e => { searchSections = e.target.value; renderSections(); });
document.getElementById("search-entries").addEventListener("input", e => { searchEntries = e.target.value; renderEntries(); });

document.getElementById("expand-sections").addEventListener("click", () => { textExpanded.sections = !textExpanded.sections; renderSections(); });
document.getElementById("expand-entries").addEventListener("click", () => { textExpanded.entries = !textExpanded.entries; renderEntries(); });

/* ---------- confirm dialog ---------- */

function confirmDialog(title, body) {
  const dialog = document.getElementById("confirm-dialog");
  document.getElementById("confirm-dialog-title").textContent = title;
  document.getElementById("confirm-dialog-body").textContent = body;
  dialog.showModal();
  return new Promise(resolve => {
    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");
    function cleanup(result) {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.close();
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

/* ---------- build tab ---------- */

function runBuildAction(button, route, label) {
  button.disabled = true;
  const output = document.getElementById("build-output");
  output.textContent = `Running ${label}…`;
  apiCall("POST", route)
    .then(result => { output.textContent = result.output || "(no output)"; showStatus(`${label} succeeded`, "ok"); })
    .catch(err => { output.textContent = err.message; showStatus(`${label} failed`, "error"); })
    .finally(() => { button.disabled = false; });
}

document.getElementById("run-rebuild-content").addEventListener("click", e => runBuildAction(e.target, "/api/run/rebuild-content", "Rebuild content"));
document.getElementById("run-mkdocs-check").addEventListener("click", e => runBuildAction(e.target, "/api/run/mkdocs-check", "mkdocs check"));

/* ---------- init ---------- */

loadState().catch(err => showStatus(err.message, "error"));
