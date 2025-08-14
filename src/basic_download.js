// Stage 1 + output control:
// - --out <DIR> sets a root output directory.
// - Each URL is downloaded into its own subdirectory under <DIR>.
// Usage:
//   node src/basic_download.js <url1> <url2> ...
//   node src/basic_download.js --file urls.txt
//   node src/basic_download.js --out downloads --file urls.txt

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const YTDLP_OUTPUT_TEMPLATE = "%(title)s.%(ext)s";

function parseArgs(argv) {
  const args = { urls: [], file: null, outDir: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") {
      args.file = argv[++i];
    } else if (a === "--out" || a === "-o") {
      args.outDir = path.resolve(argv[++i]);
    } else {
      args.urls.push(a);
    }
  }
  return args;
}

function* iterUrls({ urls, file }) {
  if (file) {
    const p = path.resolve(file); // cwd implied
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

// Make a safe folder name from a URL.
// Example: https://edition.cnn.com/2025/07/16/world/video/...  ->
//          edition.cnn.com_2025_07_16_world_video
function makeSafeDirName(rawUrl) {
  let name = "url";
  try {
    const u = new URL(rawUrl);
    // Join hostname + pathname; replace separators; collapse repeats
    name = (u.hostname + u.pathname)
      .replace(/[/\\]+/g, "_")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "");
  } catch {
    // Fallback: sanitize raw string
    name = String(rawUrl)
      .replace(/^https?:\/\//i, "")
      .replace(/[/\\]+/g, "_")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "");
  }
  // Limit length to avoid OS limits
  if (name.length > 100) name = name.slice(0, 100);
  return name || "url";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runYtDlp(url, cwd) {
  const cmd = "python";
  const args = [
    "-m",
    "yt_dlp",
    "--write-info-json",
    "-o",
    YTDLP_OUTPUT_TEMPLATE,
    url,
  ];

  console.log(`\n$ (cwd=${cwd}) ${cmd} ${args.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd });
    child.on("close", (code) => resolve(code));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const list = Array.from(iterUrls(args));

  if (list.length === 0) {
    console.log("Usage:");
    console.log("  node src/basic_download.js <url1> <url2> ...");
    console.log("  node src/basic_download.js --file urls.txt");
    console.log("  node src/basic_download.js --out downloads --file urls.txt");
    process.exit(2);
  }

  // Prepare root output directory
  ensureDir(args.outDir);

  for (const url of list) {
    console.log("\n" + "-".repeat(100));
    console.log(`# Processing: ${url}`);

    // Per-URL subdirectory
    const subdirName = makeSafeDirName(url);
    const targetDir = path.join(args.outDir, subdirName);
    ensureDir(targetDir);

    const code = await runYtDlp(url, targetDir);
    if (code === 0) {
      console.log(`✓ Success. Saved under: ${targetDir}`);
    } else {
      console.log(
        "✗ Download from original URL failed. (Fallback coming in Stage 2.)"
      );
    }
  }

  console.log("\nStage 1 (with per-URL folders) finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
