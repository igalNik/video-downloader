// Main entry point for the video downloader application
// Progressive fallbacks:
// 1) Try original URL with yt-dlp
// 2) Retry with --use-extractors generic
// 3) Open the page in a headless browser (Puppeteer), listen to network,
//    collect *.m3u8 (masters first), then run yt-dlp on the chosen URL
//    (NO generic here; we pass --referer <originalUrl>).
//
// Also:
// - --out <DIR> sets a root output directory
// - Per-URL subdirectory (folder name sanitized; truncation to 250 happens ONLY at save-time)
// - Optional flags:
//    --browser-exe "<path>"  Use a specific Chrome/Chromium executable
//    --discover-timeout <ms> Network capture timeout (default 15000)
//    --no-browser            Skip stage 3 (useful for debugging)

const { parseArgs, iterUrls, printUsage } = require("./services/argumentParser");
const { downloadUrl } = require("./services/downloadService");
const { writeFinalSummary } = require("./services/infoService");
const { ensureDir } = require("./utils/fileUtils");

async function main() {
  const args = parseArgs(process.argv);
  const list = Array.from(iterUrls(args));

  if (list.length === 0) {
    printUsage();
    process.exit(2);
  }

  ensureDir(args.outDir);

  for (const url of list) {
    await downloadUrl(url, args);
  }

  // Write one summary file at the end, in the root output directory
  writeFinalSummary(args.outDir);

  console.log(
    "\nStage 1 (per-URL folders, save-time truncation, generic fallback, network-based m3u8 discovery, and final JSON summary) finished."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
