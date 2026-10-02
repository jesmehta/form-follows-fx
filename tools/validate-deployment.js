// FFFX -- post-build deployment validation. Run after `mkdocs build
// --strict` and the projects/*/ copy step have produced public/, so this
// checks the actually-assembled output, not just the source TSVs/config.
//
// Ported from Cabinet's tools/validate-deployment.js (#84) for sibling
// parity; Bookshelf carries the same port. Three route sources are
// checked, all against the same site-root-relative existence test
// (checkRoute below):
//
//   1. content/fffx-entries.tsv -- every row with status true OR wip (not
//      false) and a local href. "wip" is included because the landing page
//      still links wip portals (muted), so a missing wip page is a live 404.
//      Unlike Cabinet's copy, an absolute href on this site's own domain
//      (site_url in mkdocs.yml) is checked as local, not skipped.
//   2. mkdocs.yml's nav: tree -- only its absolute-URL leaves that point
//      at this site's own domain; a leaf naming a source .md file is left
//      alone, since `mkdocs build --strict` already fails on it.
//   3. Doc-body links inside docs/**/*.md -- sourced from `mkdocs build`'s
//      own "unrecognized relative link" INFO-level log lines (see Cabinet's
//      copy for why). Needs deploy.yml to tee that build's output to a log
//      file; if the log is missing, this check is skipped, not failed.
//
// External links (http(s) to a different domain, mailto:, tel:) and pure
// same-page anchors are skipped by all three.
//
// Missing projects/*/index.html entry points and project/MkDocs
// destination collisions are rejected earlier, in deploy.yml's copy step --
// not repeated here.
//
// Usage: node tools/validate-deployment.js [--public-dir public] [--build-log mkdocs-build.log]

const fs = require("fs");
const path = require("path");
const { readEntries, validateEntries, readSections, validateSections } = require("./fffx-tsv");

const root = path.resolve(__dirname, "..");
const entriesPath = path.join(root, "content", "fffx-entries.tsv");
const sectionsPath = path.join(root, "content", "fffx-sections.tsv");
const mkdocsConfigPath = path.join(root, "mkdocs.yml");

function parseArgs(argv) {
  const args = { publicDir: "public", buildLog: "mkdocs-build.log" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--public-dir" && argv[i + 1]) { args.publicDir = argv[++i]; }
    if (argv[i] === "--build-log" && argv[i + 1]) { args.buildLog = argv[++i]; }
  }
  return args;
}

function readSiteBase(raw) {
  const m = /^site_url:\s*(\S+)\s*$/m.exec(raw);
  if (!m) throw new Error("mkdocs.yml has no site_url -- needed to tell self-domain links from external ones");
  return m[1].endsWith("/") ? m[1] : `${m[1]}/`;
}

// ---------------------------------------------------------------------------
// Shared route existence check.

// Resolve a root-relative href to the on-disk file that should exist once
// MkDocs (clean URLs, directory + index.html) or the projects/*/ copy step
// has produced it.
function resolveRoutePath(publicDir, rootRelativeHref) {
  const withoutFragment = rootRelativeHref.split("#")[0];
  if (!withoutFragment) return null; // pure same-page anchor, e.g. "#foo"
  const clean = withoutFragment.replace(/^\/+/, "");
  if (!clean) return null;

  if (clean.endsWith("/")) return path.join(publicDir, clean, "index.html");
  if (path.extname(clean)) return path.join(publicDir, clean);
  return path.join(publicDir, clean, "index.html");
}

function checkRoute(publicDir, rootRelativeHref) {
  const routePath = resolveRoutePath(publicDir, rootRelativeHref);
  if (!routePath) return { skipped: true };
  return { skipped: false, ok: fs.existsSync(routePath), path: routePath };
}

// ---------------------------------------------------------------------------
// 1. content/fffx-entries.tsv

function checkTsvRows(rows, kindLabel, publicDir, siteBase, errors) {
  let checked = 0;
  for (const row of rows) {
    const status = String(row.status).trim().toLowerCase();
    if (status === "false") continue; // never linked anywhere
    let href = (row.href || "").trim();
    if (!href) continue;
    if (/^https?:\/\//i.test(href)) {
      if (!href.startsWith(siteBase)) continue; // genuinely external (a sibling world, GitHub Pages, ...)
      href = href.slice(siteBase.length - 1); // keep the leading "/"
    }

    const result = checkRoute(publicDir, href);
    if (result.skipped) continue;
    checked++;
    if (!result.ok) {
      errors.push(`${kindLabel} "${row.id}": href "${row.href}" -> expected ${path.relative(root, result.path)}, not found`);
    }
  }
  return checked;
}

// ---------------------------------------------------------------------------
// 2. mkdocs.yml nav: tree

const NAV_LEAF_RE = /^\s*-\s+(.+?)\s*:\s*(\S+)\s*$/;
const NAV_GROUP_RE = /^\s*-\s+(.+?)\s*:\s*$/;
const NAV_BARE_RE = /^\s*-\s+(\S+)\s*$/;

function parseMkdocsNavLeaves(raw) {
  const leaves = [];
  let inNav = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!inNav) {
      if (line.startsWith("nav:")) inNav = true;
      continue;
    }
    const stripped = line.trim();
    if (!stripped) continue;
    if (!/^[ \t-]/.test(line)) break; // back to column 0 -- nav block is over
    if (stripped.startsWith("#")) continue; // commented-out leaf (FFFX's placeholder pages)

    let m = NAV_LEAF_RE.exec(line);
    if (m) { leaves.push({ label: m[1].trim(), target: m[2].trim() }); continue; }
    if (NAV_GROUP_RE.test(line)) continue;
    m = NAV_BARE_RE.exec(line);
    if (m) leaves.push({ label: m[1].trim(), target: m[1].trim() });
  }
  return leaves;
}

function checkNavTargets(mkdocsRaw, publicDir, siteBase, errors) {
  let checked = 0;
  for (const { label, target } of parseMkdocsNavLeaves(mkdocsRaw)) {
    if (!/^https?:\/\//i.test(target)) continue; // a source .md path -- mkdocs --strict already validated it
    if (!target.startsWith(siteBase)) continue; // genuinely external

    const result = checkRoute(publicDir, target.slice(siteBase.length - 1));
    if (result.skipped) continue;
    checked++;
    if (!result.ok) {
      errors.push(`mkdocs.yml nav "${label}": target "${target}" -> expected ${path.relative(root, result.path)}, not found`);
    }
  }
  return checked;
}

// ---------------------------------------------------------------------------
// 3. docs/**/*.md body links, via mkdocs build's own "unrecognized relative
// link" log lines.

const UNRECOGNIZED_LINK_RE = /Doc file '([^']+)' contains an unrecognized relative link '([^']+)'/;

// docs/x/y.md -> built directory "x/y"; docs/x/index.md -> "x".
function builtDirForDoc(docRelPath) {
  const posixRel = docRelPath.replace(/\\/g, "/").replace(/\.md$/i, "");
  const base = path.posix.basename(posixRel);
  const dir = path.posix.dirname(posixRel);
  if (base.toLowerCase() === "index") return dir === "." ? "" : dir;
  return dir === "." ? base : `${dir}/${base}`;
}

// Resolves a link target as a browser would, against the directory the
// linking page builds into.
function resolveDocLink(builtDir, target) {
  const base = `https://internal.invalid/${builtDir ? builtDir + "/" : ""}`;
  const resolved = new URL(target, base);
  if (resolved.hostname !== "internal.invalid") return null; // protocol-relative or other scheme -- external
  return resolved.pathname;
}

function checkDocLinks(publicDir, siteBase, buildLogPath, errors) {
  if (!fs.existsSync(buildLogPath)) {
    console.log(`No build log at ${path.relative(root, buildLogPath)} -- skipping doc-body link checks.`);
    return 0;
  }

  let checked = 0;
  for (const line of fs.readFileSync(buildLogPath, "utf8").split(/\r?\n/)) {
    const m = UNRECOGNIZED_LINK_RE.exec(line);
    if (!m) continue;
    const [, docFile, rawTarget] = m;

    if (/^(mailto:|tel:)/i.test(rawTarget)) continue;
    if (rawTarget.startsWith("#")) continue;

    let rootRelative;
    if (/^https?:\/\//i.test(rawTarget)) {
      if (!rawTarget.startsWith(siteBase)) continue;
      rootRelative = rawTarget.slice(siteBase.length - 1);
    } else {
      rootRelative = resolveDocLink(builtDirForDoc(docFile), rawTarget);
      if (rootRelative === null) continue;
    }

    const result = checkRoute(publicDir, rootRelative);
    if (result.skipped) continue;
    checked++;
    if (!result.ok) {
      errors.push(`${docFile}: link "${rawTarget}" -> expected ${path.relative(root, result.path)}, not found`);
    }
  }
  return checked;
}

// ---------------------------------------------------------------------------

function main() {
  const { publicDir: publicDirArg, buildLog: buildLogArg } = parseArgs(process.argv.slice(2));
  const publicDir = path.resolve(root, publicDirArg);
  const buildLogPath = path.resolve(root, buildLogArg);

  const mkdocsRaw = fs.readFileSync(mkdocsConfigPath, "utf8");
  const siteBase = readSiteBase(mkdocsRaw);

  const sections = readSections(fs.readFileSync(sectionsPath, "utf8"), path.relative(root, sectionsPath));
  const entries = readEntries(fs.readFileSync(entriesPath, "utf8"), path.relative(root, entriesPath));
  validateSections(sections);
  validateEntries(entries, new Set(sections.map(s => s.id)));

  const errors = [];
  const counts = {
    entries: checkTsvRows(entries, "entry", publicDir, siteBase, errors),
    nav: checkNavTargets(mkdocsRaw, publicDir, siteBase, errors),
    docLinks: checkDocLinks(publicDir, siteBase, buildLogPath, errors),
  };

  console.log(
    `Checked ${counts.entries} entr(ies), ${counts.nav} nav target(s), ` +
    `and ${counts.docLinks} doc-body link(s) against ${path.relative(root, publicDir)}/`
  );

  if (errors.length) {
    console.error("\nRoute validation failed:");
    errors.forEach(line => console.error(`  ERROR: ${line}`));
    process.exit(1);
  }
}

main();
