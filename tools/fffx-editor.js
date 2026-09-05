// FFFX -- local admin server for content/fffx-sections.tsv and
// content/fffx-entries.tsv. Zero dependencies, localhost-only, no auth --
// nothing here is meant to be reachable off the machine it runs on.
// One page (Sections / Entries / Build tabs) rather than Cabinet's split
// editor-server + admin-controls-server -- FFFX has no pre-existing
// separate servers to avoid duplicating, so there's no reason to split.
// Modeled on CabinetOfCuriosities/tools/cabinet-editor.js (TSV CRUD) and
// its tools/admin-controls.js (the runScript/apiRun build-button pattern).

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const {
  SECTIONS_COLS, ENTRIES_COLS,
  readSections, writeSections, readEntries, writeEntries,
  findSectionProblems, findEntryProblems, validateSections, validateEntries,
} = require("./fffx-tsv");

const ROOT = path.resolve(__dirname, "..");
const SECTIONS_TSV_PATH = path.join(ROOT, "content", "fffx-sections.tsv");
const ENTRIES_TSV_PATH = path.join(ROOT, "content", "fffx-entries.tsv");
const DOCS_ROOT = path.join(ROOT, "docs");
const UI_ROOT = path.join(__dirname, "fffx-editor-ui");
const PORT = Number(process.env.FFFX_EDITOR_PORT) || 6858;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// ---------------------------------------------------------------------------
// small helpers

function sendJson(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (err) { reject(new Error("invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

// Resolves a URL path against a root directory and refuses anything that
// escapes it (blocks ../ path traversal from a crafted request path).
function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const resolved = path.resolve(root, "." + decoded);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}

function readAllSections() {
  return readSections(fs.readFileSync(SECTIONS_TSV_PATH, "utf8"), "content/fffx-sections.tsv");
}
function writeAllSections(rows) {
  fs.writeFileSync(SECTIONS_TSV_PATH, writeSections(rows), "utf8");
}
function readAllEntries() {
  return readEntries(fs.readFileSync(ENTRIES_TSV_PATH, "utf8"), "content/fffx-entries.tsv");
}
function writeAllEntries(rows) {
  fs.writeFileSync(ENTRIES_TSV_PATH, writeEntries(rows), "utf8");
}

function blankRow(cols) {
  return Object.fromEntries(cols.map(c => [c, ""]));
}

// Only accept known schema columns from a request body, so nothing
// outside the schema can ever land in the TSV.
function applyFields(row, cols, body) {
  const next = { ...row };
  cols.forEach(c => { if (Object.prototype.hasOwnProperty.call(body, c)) next[c] = body[c] === undefined || body[c] === null ? "" : String(body[c]); });
  return next;
}

function renumber(rows, field, step) {
  rows.forEach((r, i) => { r[field] = String((i + 1) * step); });
}
function renumberWithinGroups(rows, groupField, orderField, step) {
  const groups = {};
  rows.forEach(r => { (groups[r[groupField]] = groups[r[groupField]] || []).push(r); });
  Object.values(groups).forEach(group => group.forEach((r, i) => { r[orderField] = String((i + 1) * step); }));
}

// ---------------------------------------------------------------------------
// state

function apiState(res) {
  const sections = readAllSections();
  const entries = readAllEntries();
  const sectionIds = new Set(sections.map(s => s.id));
  sendJson(res, 200, {
    sections: sections.map((row, index) => ({ index, row })),
    entries: entries.map((row, index) => ({ index, row })),
    sectionProblems: findSectionProblems(sections),
    entryProblems: findEntryProblems(entries, sectionIds),
    columns: { sections: SECTIONS_COLS, entries: ENTRIES_COLS },
  });
}

// ---------------------------------------------------------------------------
// sections API

async function apiCreateSection(req, res) {
  try {
    const body = await readJsonBody(req);
    const rows = readAllSections();
    const row = applyFields(blankRow(SECTIONS_COLS), SECTIONS_COLS, body);
    rows.push(row);
    renumber(rows, "order", 10);
    writeAllSections(rows);
    sendJson(res, 200, { ok: true, index: rows.length - 1 });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

async function apiUpdateSection(req, res, index) {
  try {
    const body = await readJsonBody(req);
    const rows = readAllSections();
    if (index < 0 || index >= rows.length) throw new Error(`no section at index ${index}`);
    rows[index] = applyFields(rows[index], SECTIONS_COLS, body);
    writeAllSections(rows);
    sendJson(res, 200, { ok: true });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

function apiDeleteSection(res, index) {
  try {
    const rows = readAllSections();
    if (index < 0 || index >= rows.length) throw new Error(`no section at index ${index}`);
    const id = rows[index].id;
    const entries = readAllEntries();
    const count = entries.filter(e => e.section === id).length;
    if (count > 0) throw new Error(`"${id}" is still referenced by ${count} entr${count === 1 ? "y" : "ies"} -- reassign or delete them first`);
    rows.splice(index, 1);
    writeAllSections(rows);
    sendJson(res, 200, { ok: true });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

async function apiMoveSection(req, res, index) {
  try {
    const body = await readJsonBody(req);
    const direction = body.direction;
    if (direction !== "up" && direction !== "down") throw new Error('direction must be "up" or "down"');
    const rows = readAllSections();
    if (index < 0 || index >= rows.length) throw new Error(`no section at index ${index}`);
    const target = index + (direction === "up" ? -1 : 1);
    if (target < 0 || target >= rows.length) { sendJson(res, 200, { ok: true, moved: false }); return; }
    [rows[index], rows[target]] = [rows[target], rows[index]];
    renumber(rows, "order", 10);
    writeAllSections(rows);
    sendJson(res, 200, { ok: true, moved: true });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

// ---------------------------------------------------------------------------
// entries API

async function apiCreateEntry(req, res) {
  try {
    const body = await readJsonBody(req);
    const rows = readAllEntries();
    const row = applyFields(blankRow(ENTRIES_COLS), ENTRIES_COLS, body);

    // Insert after the last existing row of the same section, so entries
    // stay grouped by section in the file.
    let insertAt = rows.length;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].section === row.section) { insertAt = i + 1; break; }
    }
    rows.splice(insertAt, 0, row);
    renumberWithinGroups(rows, "section", "order", 10);
    writeAllEntries(rows);
    sendJson(res, 200, { ok: true, index: insertAt });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

async function apiUpdateEntry(req, res, index) {
  try {
    const body = await readJsonBody(req);
    const rows = readAllEntries();
    if (index < 0 || index >= rows.length) throw new Error(`no entry at index ${index}`);
    rows[index] = applyFields(rows[index], ENTRIES_COLS, body);
    writeAllEntries(rows);
    sendJson(res, 200, { ok: true });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

function apiDeleteEntry(res, index) {
  try {
    const rows = readAllEntries();
    if (index < 0 || index >= rows.length) throw new Error(`no entry at index ${index}`);
    rows.splice(index, 1);
    writeAllEntries(rows);
    sendJson(res, 200, { ok: true });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

async function apiMoveEntry(req, res, index) {
  try {
    const body = await readJsonBody(req);
    const direction = body.direction;
    if (direction !== "up" && direction !== "down") throw new Error('direction must be "up" or "down"');
    const rows = readAllEntries();
    if (index < 0 || index >= rows.length) throw new Error(`no entry at index ${index}`);
    const section = rows[index].section;

    let swapWith = -1;
    if (direction === "up") { for (let i = index - 1; i >= 0; i--) if (rows[i].section === section) { swapWith = i; break; } }
    else { for (let i = index + 1; i < rows.length; i++) if (rows[i].section === section) { swapWith = i; break; } }
    if (swapWith === -1) { sendJson(res, 200, { ok: true, moved: false }); return; }

    [rows[index], rows[swapWith]] = [rows[swapWith], rows[index]];
    renumberWithinGroups(rows, "section", "order", 10);
    writeAllEntries(rows);
    sendJson(res, 200, { ok: true, moved: true });
  } catch (err) { sendJson(res, 422, { error: err.message }); }
}

// ---------------------------------------------------------------------------
// build tab -- two actions, matching what the repo actually has: no
// static-build/promote/sitemap step exists here (FFFX deploys straight
// from docs/ via GitHub Actions on push), so this is just "rebuild
// content" and an mkdocs strict sanity check.

function runScript(command, args, cwd) {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
  } catch (err) {
    const stdout = (err.stdout || "").toString().trim();
    const stderr = (err.stderr || "").toString().trim();
    throw new Error([stdout, stderr].filter(Boolean).join("\n") || err.message || String(err));
  }
}

function apiRun(res, label, fn) {
  try {
    const output = fn();
    sendJson(res, 200, { ok: true, label, output: output || "(no output)" });
  } catch (err) {
    sendJson(res, 422, { ok: false, label, error: err.message });
  }
}

function apiRebuildContent(res) {
  apiRun(res, "rebuild-content", () => {
    const sections = readAllSections();
    validateSections(sections);
    const entries = readAllEntries();
    validateEntries(entries, new Set(sections.map(s => s.id)));
    return runScript(process.execPath, [path.join(__dirname, "build-fffx-content.js")], ROOT);
  });
}

function apiMkdocsCheck(res) {
  const tmpSiteDir = path.join(os.tmpdir(), `fffx-mkdocs-check-${Date.now()}`);
  apiRun(res, "mkdocs-check", () => {
    try {
      return runScript("mkdocs", ["build", "--strict", "--site-dir", tmpSiteDir], ROOT);
    } finally {
      fs.rmSync(tmpSiteDir, { recursive: true, force: true });
    }
  });
}

// ---------------------------------------------------------------------------
// routing

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/") { res.writeHead(302, { Location: "/admin/" }); res.end(); return; }

    if (pathname.startsWith("/api/")) {
      const parts = pathname.slice(5).split("/").filter(Boolean);

      if (parts[0] === "state" && req.method === "GET") return apiState(res);

      if (parts[0] === "sections" && parts.length === 1 && req.method === "POST") return await apiCreateSection(req, res);
      if (parts[0] === "sections" && parts.length === 2 && req.method === "PUT") return await apiUpdateSection(req, res, Number(parts[1]));
      if (parts[0] === "sections" && parts.length === 2 && req.method === "DELETE") return apiDeleteSection(res, Number(parts[1]));
      if (parts[0] === "sections" && parts.length === 3 && parts[2] === "move" && req.method === "POST") return await apiMoveSection(req, res, Number(parts[1]));

      if (parts[0] === "entries" && parts.length === 1 && req.method === "POST") return await apiCreateEntry(req, res);
      if (parts[0] === "entries" && parts.length === 2 && req.method === "PUT") return await apiUpdateEntry(req, res, Number(parts[1]));
      if (parts[0] === "entries" && parts.length === 2 && req.method === "DELETE") return apiDeleteEntry(res, Number(parts[1]));
      if (parts[0] === "entries" && parts.length === 3 && parts[2] === "move" && req.method === "POST") return await apiMoveEntry(req, res, Number(parts[1]));

      if (parts[0] === "run" && parts.length === 2 && req.method === "POST") {
        if (parts[1] === "rebuild-content") return apiRebuildContent(res);
        if (parts[1] === "mkdocs-check") return apiMkdocsCheck(res);
        return sendJson(res, 404, { error: `unknown script "${parts[1]}"` });
      }

      sendJson(res, 404, { error: `no API route for ${req.method} ${pathname}` });
      return;
    }

    if (pathname.startsWith("/admin/")) {
      const rest = pathname.slice(6) || "/";
      const target = rest === "/" ? path.join(UI_ROOT, "index.html") : safeJoin(UI_ROOT, rest);
      if (!target) { res.writeHead(400); res.end("Bad path"); return; }
      serveStaticFile(res, target);
      return;
    }

    // Everything else falls through to docs/ as the static site root.
    const target = safeJoin(DOCS_ROOT, pathname);
    if (!target) { res.writeHead(400); res.end("Bad path"); return; }
    serveStaticFile(res, target);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FFFX editor running at http://127.0.0.1:${PORT}/admin/`);
  console.log(`(localhost only, Ctrl+C to stop)`);
});
