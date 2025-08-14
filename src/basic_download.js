// Stage 1: basic download from the original URL using yt-dlp.
// Usage:
//   node src/step1_basic_download.js <url1> <url2> ...
//   node src/step1_basic_download.js --file urls.txt
//
// Behavior:
// - Tries to download from each original URL via yt-dlp.
// - Writes video file + *.info.json (same as: python -m yt_dlp --write-info-json -o "%(title)s.%(ext)s" <url>)
// - No fallback to HLS/MP4 yet (we'll add that in Stage 2).

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const YTDLP_OUTPUT_TEMPLATE = "%(title)s.%(ext)s";

function parseArgs(argv) {
  const args = { urls: [], file: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") {
      args.file = argv[++i];
    } else {
      args.urls.push(a);
    }
  }
  return args;
}

function* iterUrls({ urls, file }) {
  if (file) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) {
      console.error(`Error: file not found: ${p}`);
      process.exit(1);
    }
    const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      yield t;
    }
  } else {
    for (const u of urls) yield u;
  }
}

function runYtDlp(url) {
  // Equivalent to: python -m yt_dlp --write-info-json -o "%(title)s.%(ext)s" <url>
  // We call the current Python via `process.execPath`? No—use "python" assuming it's on PATH.
  const cmd = "python";
  const args = [
    "-m",
    "yt_dlp",
    "--write-info-json",
    "-o",
    YTDLP_OUTPUT_TEMPLATE,
    url,
  ];

  console.log(`\n$ ${cmd} ${args.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const list = Array.from(iterUrls(args));
  if (list.length === 0) {
    console.log("Usage:");
    console.log("  node src/step1_basic_download.js <url1> <url2> ...");
    console.log("  node src/step1_basic_download.js --file urls.txt");
    process.exit(2);
  }

  for (const url of list) {
    console.log("\n" + "-".repeat(100));
    console.log(`# Processing: ${url}`);
    const code = await runYtDlp(url);
    if (code === 0) {
      console.log("✓ Download from original URL succeeded.");
    } else {
      console.log(
        "✗ Download from original URL failed. (Fallback will be added in Stage 2.)"
      );
    }
  }

  console.log("\nStage 1 finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
