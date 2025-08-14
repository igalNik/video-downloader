const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeSanitizedFolderBase(rawUrl) {
  const s = String(rawUrl);
  let name;
  try {
    const u = new URL(s);
    name = `${u.hostname}${u.pathname}`;
  } catch {
    name = s;
  }
  // Replace any non-alphanumeric with "_"
  name = name
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return name || "url";
}

function prepareTargetDir(rootOutDir, rawUrl) {
  const base = makeSanitizedFolderBase(rawUrl); // no truncation inside
  const subdirName = base.length > 250 ? base.slice(0, 250) : base; // truncation at save-time
  const dir = path.join(rootOutDir, subdirName || "url");
  ensureDir(dir);
  return dir;
}

function readUrlsFromFile(filePath) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) {
    throw new Error(`File not found: ${p}`);
  }
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  return lines
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
}

function getInfoJsonFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".info.json"));
  } catch (e) {
    console.warn(`(warn) Could not list dir for info JSONs: ${e.message}`);
    return [];
  }
}

function writeSummaryFile(outDir, summary) {
  const outPath = path.join(outDir, "download_summary.json");
  try {
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`\n✓ Wrote summary JSON: ${outPath}`);
  } catch (e) {
    console.warn(`(warn) Failed to write summary JSON: ${e.message}`);
  }
}

module.exports = {
  ensureDir,
  makeSanitizedFolderBase,
  prepareTargetDir,
  readUrlsFromFile,
  getInfoJsonFiles,
  writeSummaryFile,
};
