const fs = require("fs");
const path = require("path");
const { formatDuration } = require("../utils/formatUtils");
const { getInfoJsonFiles, writeSummaryFile } = require("../utils/fileUtils");

// Global collection for final summary
const allSummaries = [];

function printInfoJsonSummaries(dir, ctx = {}) {
  const files = getInfoJsonFiles(dir);

  if (files.length === 0) {
    console.log("  (no .info.json found in this folder)");
    return;
  }

  console.log("  ─ Info from .info.json ─");
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const raw = fs.readFileSync(full, "utf8");
      const j = JSON.parse(raw);

      const title = j.title || j.fulltitle || "(no title)";
      const durSec = Number.isFinite(j.duration)
        ? j.duration
        : Number(j.duration);
      const durationHms =
        Number.isFinite(durSec) && durSec >= 0
          ? formatDuration(durSec)
          : "unknown";
      const extractor = j.extractor || j.extractor_key || "unknown";
      const webpage = j.webpage_url || j.original_url || "(n/a)";
      const uploader =
        j.uploader || j.channel || j.uploader_id || j.channel_id || "(n/a)";
      const id = j.id || "(n/a)";
      const ext = j.ext || "(n/a)";
      const originalRequestUrl = ctx.originalUrl || "(n/a)";

      console.log(`  • File: ${f}`);
      console.log(`    Title    : ${title}`);
      console.log(
        `    Duration : ${durationHms}${
          Number.isFinite(durSec) ? ` (${durSec}s)` : ""
        }`
      );
      console.log(`    Extractor: ${extractor}`);
      console.log(`    Uploader : ${uploader}`);
      console.log(`    ID / Ext : ${id} / ${ext}`);
      console.log(`    Source   : ${webpage}`);

      // Collect into final summary
      allSummaries.push({
        dir,
        infoFile: f,
        title,
        durationSeconds: Number.isFinite(durSec) ? durSec : null,
        duration: durationHms,
        extractor,
        uploader,
        id,
        ext,
        source: webpage,
        originalRequestUrl,
      });
    } catch (e) {
      console.warn(`  (warn) Failed to parse ${f}: ${e.message}`);
    }
  }
}

function writeFinalSummary(outDir) {
  const summary = {
    generated_at: new Date().toISOString(),
    count: allSummaries.length,
    items: allSummaries,
  };
  writeSummaryFile(outDir, summary);
}

module.exports = {
  printInfoJsonSummaries,
  writeFinalSummary,
};
