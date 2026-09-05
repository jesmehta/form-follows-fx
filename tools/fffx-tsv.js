// FFFX -- shared TSV parse/serialize/validate logic for
// content/fffx-sections.tsv and content/fffx-entries.tsv, used by both
// build-fffx-content.js (CLI build) and fffx-editor.js (the local admin
// server), so the two can't quietly diverge. Modeled on
// CabinetOfCuriosities/tools/cabinet-tsv.js, trimmed to FFFX's actual
// (smaller) schema -- no map/geometry columns, no reserved/dead fields.
//
// Plain tab/newline splitter, not a CSV-quote-aware state machine, same
// reasoning as cabinet-tsv.js: build-fffx-content.js has always required
// an exact per-row cell count with no trailing-column padding, and no
// cell has ever contained an embedded tab or newline.

const SECTIONS_COLS = ["id", "title", "order", "status"];
const ENTRIES_COLS = ["id", "title", "subtitle", "href", "section", "kind", "status", "order", "weight", "tags", "location", "thumbnail", "sourceFolder", "relatedLinks", "notes"];

const STATUS_VALUES = ["true", "false", "wip"];

// ---------------------------------------------------------------------------
// parse / serialize

function parseTsv(raw, cols, contextLabel) {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/).filter(line => line.length > 0);
  if (!lines.length) throw new Error(`${contextLabel}: file is empty`);

  const headers = lines[0].split("\t");
  for (const col of cols) {
    if (!headers.includes(col)) throw new Error(`${contextLabel}: missing required column "${col}"`);
  }

  return lines.slice(1).map((line, index) => {
    const context = `${contextLabel} line ${index + 2}`;
    const cells = line.split("\t");
    if (cells.length !== headers.length) {
      throw new Error(`${context}: expected ${headers.length} cells, got ${cells.length}`);
    }
    const raw = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
    // Preserve the schema's own column order regardless of the source
    // file's header order, and guarantee every schema column exists.
    return Object.fromEntries(cols.map(c => [c, raw[c] !== undefined ? raw[c] : ""]));
  });
}

function serializeTsv(rows, cols) {
  const lines = [cols.join("\t")];
  rows.forEach(row => {
    lines.push(cols.map(c => (row[c] ?? "").toString()).join("\t"));
  });
  return lines.join("\n") + "\n";
}

function readSections(raw, contextLabel) {
  return parseTsv(raw, SECTIONS_COLS, contextLabel);
}
function writeSections(rows) {
  return serializeTsv(rows, SECTIONS_COLS);
}
function readEntries(raw, contextLabel) {
  return parseTsv(raw, ENTRIES_COLS, contextLabel);
}
function writeEntries(rows) {
  return serializeTsv(rows, ENTRIES_COLS);
}

// ---------------------------------------------------------------------------
// field-level helpers (shared with build-fffx-content.js's JSON-shape
// transform, so "is this numeric/well-formed" can't drift between the
// build script and the editor's validation)

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function parseStatus(value, context) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "wip") return "wip";
  throw new Error(`${context}: status must be true, wip, or false (case-insensitive)`);
}

function parseList(value, separator = ";") {
  if (!value) return [];
  return value.split(separator).map(item => item.trim()).filter(Boolean);
}

function parseRelatedLinks(value, context) {
  return parseList(value).map((item, index) => {
    const separatorIndex = item.indexOf("|");
    if (separatorIndex === -1) throw new Error(`${context}: relatedLinks item ${index + 1} must use label|href`);
    const label = item.slice(0, separatorIndex).trim();
    const href = item.slice(separatorIndex + 1).trim();
    if (!label || !href) throw new Error(`${context}: relatedLinks item ${index + 1} needs both label and href`);
    return { label, href };
  });
}

// ---------------------------------------------------------------------------
// validation
//
// Two shapes on purpose: find*Problems() collects every problem (for the
// editor UI, which wants to flag every bad row at once, not stop at the
// first); validate*() throws on the first one (for the build script and
// the editor's write path, where "fail loudly and stop" is the right
// behaviour).
//
// The section-reference check on entries (below) is stricter than
// build-fffx-content.js itself -- that script never cross-checks
// entry.section against a real section id, it just passes the string
// through. Flagging a typo'd section here is purely a helpful editor-UX
// addition (same as Cabinet's editor does); it doesn't misrepresent any
// column as required/optional beyond what the build script actually
// enforces.

function findSectionProblems(rows) {
  const problems = [];
  const seenIds = new Map();

  rows.forEach((row, index) => {
    const label = row.id || `(row ${index + 1})`;
    if (isBlank(row.id)) problems.push({ index, id: label, field: "id", message: "id is required" });
    else if (seenIds.has(row.id)) {
      problems.push({ index, id: label, field: "id", message: `duplicate section id "${row.id}" (also row ${seenIds.get(row.id) + 1})` });
    } else seenIds.set(row.id, index);

    if (isBlank(row.title)) problems.push({ index, id: label, field: "title", message: "title is required" });
    if (isBlank(row.order) || !Number.isFinite(Number(row.order))) problems.push({ index, id: label, field: "order", message: "order must be numeric" });
    if (!STATUS_VALUES.includes((row.status || "").trim().toLowerCase())) problems.push({ index, id: label, field: "status", message: "status must be true, wip, or false" });
  });

  return problems;
}

function findEntryProblems(rows, sectionIds) {
  const problems = [];
  const seenIds = new Map();
  const validSectionIds = sectionIds instanceof Set ? sectionIds : new Set(sectionIds);

  rows.forEach((row, index) => {
    const label = row.id || `(row ${index + 1})`;
    if (isBlank(row.id)) problems.push({ index, id: label, field: "id", message: "id is required" });
    else if (seenIds.has(row.id)) {
      problems.push({ index, id: label, field: "id", message: `duplicate entry id "${row.id}" (also row ${seenIds.get(row.id) + 1})` });
    } else seenIds.set(row.id, index);

    if (isBlank(row.section)) problems.push({ index, id: label, field: "section", message: "section is required" });
    else if (!validSectionIds.has(row.section)) problems.push({ index, id: label, field: "section", message: `section "${row.section}" does not match any section id` });

    if (isBlank(row.title)) problems.push({ index, id: label, field: "title", message: "title is required" });
    if (isBlank(row.order) || !Number.isFinite(Number(row.order))) problems.push({ index, id: label, field: "order", message: "order must be numeric" });
    if (isBlank(row.weight) || !Number.isFinite(Number(row.weight))) problems.push({ index, id: label, field: "weight", message: "weight must be numeric" });
    if (!STATUS_VALUES.includes((row.status || "").trim().toLowerCase())) problems.push({ index, id: label, field: "status", message: "status must be true, wip, or false" });

    try { parseRelatedLinks(row.relatedLinks, `entry ${label}`); }
    catch (err) { problems.push({ index, id: label, field: "relatedLinks", message: err.message.replace(/^entry [^:]+: /, "") }); }
  });

  return problems;
}

function validateSections(rows) {
  const problems = findSectionProblems(rows);
  if (problems.length) throw new Error(`section ${problems[0].id}: ${problems[0].message}`);
}

function validateEntries(rows, sectionIds) {
  const problems = findEntryProblems(rows, sectionIds);
  if (problems.length) throw new Error(`entry ${problems[0].id}: ${problems[0].message}`);
}

module.exports = {
  SECTIONS_COLS, ENTRIES_COLS, STATUS_VALUES,
  parseTsv, serializeTsv,
  readSections, writeSections, readEntries, writeEntries,
  parseStatus, parseList, parseRelatedLinks,
  findSectionProblems, findEntryProblems, validateSections, validateEntries,
};
