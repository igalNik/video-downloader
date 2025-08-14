const { runYtDlp } = require("./ytDlpService");
const { findM3u8ViaBrowser } = require("./browserService");
const { printInfoJsonSummaries } = require("./infoService");
const { prepareTargetDir } = require("../utils/fileUtils");

async function downloadUrl(url, args) {
  console.log("\n" + "-".repeat(100));
  console.log(`# Processing: ${url}`);

  // Decide and (if needed) truncate the folder name immediately before saving
  let targetDir = prepareTargetDir(args.outDir, url);

  // Stage 1: Original URL with yt-dlp
  let code = await runYtDlp(url, targetDir);
  if (code === 0) {
    console.log(`✓ Success. Saved under: ${targetDir}`);
    printInfoJsonSummaries(targetDir, { originalUrl: url });
    return true;
  }

  // Stage 2: Original with generic extractor
  console.log(
    "✗ Original download failed. Retrying with --use-extractors generic ..."
  );
  code = await runYtDlp(url, targetDir, ["--use-extractors", "generic"]);
  if (code === 0) {
    console.log(
      `✓ Success with generic extractor. Saved under: ${targetDir}`
    );
    printInfoJsonSummaries(targetDir, { originalUrl: url });
    return true;
  }

  // Stage 3: Browser network discovery (NO generic here)
  if (args.noBrowser) {
    console.log("• Skipping browser discovery due to --no-browser flag.");
    console.log("✗ All attempts failed.");
    return false;
  }

  console.log("• Attempting browser-based network discovery for .m3u8 …");
  const m3u8s = await findM3u8ViaBrowser(url, {
    browserExe: args.browserExe,
    timeoutMs: args.discoverTimeout,
  });

  if (m3u8s.length === 0) {
    console.log("✗ Download failed; no .m3u8 discovered via browser.");
    return false;
  }

  let success = false;
  for (const m3u8 of m3u8s) {
    // (re)prepare dir at save-time (same rule, trunc to 250)
    targetDir = prepareTargetDir(args.outDir, url);

    console.log(`→ Trying discovered media URL (no generic): ${m3u8}`);
    const c = await runYtDlp(m3u8, targetDir, ["--referer", url]);
    if (c === 0) {
      console.log(
        `✓ Success from discovered .m3u8. Saved under: ${targetDir}`
      );
      printInfoJsonSummaries(targetDir, { originalUrl: url });
      success = true;
      break;
    } else {
      console.log("  … failed, trying next candidate …");
    }
  }

  if (!success) {
    console.log("✗ All discovered .m3u8 candidates failed.");
  }

  return success;
}

module.exports = {
  downloadUrl,
};
