const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sectionsPath = path.join(root, "content", "fffx-sections.tsv");
const entriesPath = path.join(root, "content", "fffx-entries.tsv");
const outputPath = path.join(root, "docs", "assets", "js", "fffx-generated-content.js");

function readTsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter(line => line.length > 0);
  if (!lines.length) return [];

  const headers = lines[0].split("\t");
  return lines.slice(1).map((line, index) => {
    const cells = line.split("\t");
    if (cells.length !== headers.length) {
      throw new Error(
        `${path.relative(root, filePath)} line ${index + 2}: expected ${headers.length} cells, got ${cells.length}`
      );
    }

    return Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]]));
  });
}

function parseStatus(value, context) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  if (normalized === "wip") return "wip";
  throw new Error(`${context}: status must be true, wip, or false (case-insensitive)`);
}

function parseNumber(value, field, context) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${context}: ${field} must be numeric`);
  }
  return parsed;
}

function parseList(value, separator = ";") {
  if (!value) return [];
  return value.split(separator).map(item => item.trim()).filter(Boolean);
}

function prettifyDisplayText(value) {
  return value
    .replace(/\s\/\s/g, " \u00b7 ")
    .replace(/\.{3}/g, "\u2026");
}

function parseRelatedLinks(value, context) {
  return parseList(value).map((item, index) => {
    const separatorIndex = item.indexOf("|");
    if (separatorIndex === -1) {
      throw new Error(`${context}: relatedLinks item ${index + 1} must use label|href`);
    }

    const label = item.slice(0, separatorIndex).trim();
    const href = item.slice(separatorIndex + 1).trim();
    if (!label || !href) {
      throw new Error(`${context}: relatedLinks item ${index + 1} needs both label and href`);
    }

    return { label: prettifyDisplayText(label), href };
  });
}

function buildSections() {
  return readTsv(sectionsPath).map(row => ({
    id: row.id,
    title: prettifyDisplayText(row.title),
    order: parseNumber(row.order, "order", `section ${row.id}`),
    status: parseStatus(row.status, `section ${row.id}`)
  }));
}

function buildEntries() {
  return readTsv(entriesPath).map(row => {
    const entry = {
      id: row.id,
      title: prettifyDisplayText(row.title),
      subtitle: prettifyDisplayText(row.subtitle),
      href: row.href,
      section: row.section,
      kind: row.kind,
      order: parseNumber(row.order, "order", `entry ${row.id}`),
      weight: parseNumber(row.weight, "weight", `entry ${row.id}`),
      status: parseStatus(row.status, `entry ${row.id}`),
      tags: parseList(row.tags),
      location: row.location
    };

    if (row.thumbnail) entry.thumbnail = row.thumbnail;
    if (row.sourceFolder) entry.sourceFolder = row.sourceFolder;

    const relatedLinks = parseRelatedLinks(row.relatedLinks, `entry ${row.id}`);
    if (relatedLinks.length) entry.relatedLinks = relatedLinks;

    if (row.notes) entry.notes = prettifyDisplayText(row.notes);
    return entry;
  });
}

function serializeExport(name, value) {
  return `export const ${name} = ${JSON.stringify(value, null, 2)};\n`;
}

const sections = buildSections();
const entries = buildEntries();

const output = `// AUTO-GENERATED FILE.
// Do not edit.
// Edit content/fffx-sections.tsv and content/fffx-entries.tsv,
// then run:
//
// node tools/build-fffx-content.js

${serializeExport("sections", sections)}
${serializeExport("entries", entries)}`;

fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${path.relative(root, outputPath)}`);
