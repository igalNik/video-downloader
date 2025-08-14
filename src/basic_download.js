// step1_basic_download.js
// Stage 1 with enhancements:
// - --out <DIR> sets a root output directory.
// - Each URL is downloaded into its own subdirectory under <DIR>.
// - Retry with --use-extractors generic if original extraction fails.
// - Folder names: any non-alphanumeric char replaced with "_".

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
    const p = path.resolve(file);
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
    for (const u of urls) {
      if (!u) continue;
      yield u;
    }
  }
}

// Make a safe folder name from a URL: replace non-alphanumerics with "_"
function makeSafeDirName(rawUrl) {
  const s = String(rawUrl);
  let name;
  try {
    const u = new URL(s);
    name = `${u.hostname}${u.pathname}`;
  } catch {
    name = s;
  }
  name = name.replace(/[^a-zA-Z0-9]/g, "_"); // non-alphanumeric → "_"
  name = name.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  if (name.length > 100) name = name.slice(0, 100);
  return name || "url";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runYtDlp(url, cwd, extra = []) {
  const cmd = "python";
  const base = [
    "-m",
    "yt_dlp",
    "--write-info-json",
    "-o",
    YTDLP_OUTPUT_TEMPLATE,
  ];
  const args = [...base, ...extra, url];

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

  ensureDir(args.outDir);

  for (const url of list) {
    console.log("\n" + "-".repeat(100));
    console.log(`# Processing: ${url}`);

    const subdirName = makeSafeDirName(url);
    const targetDir = path.join(args.outDir, subdirName);
    ensureDir(targetDir);

    let code = await runYtDlp(url, targetDir);
    if (code === 0) {
      console.log(`✓ Success. Saved under: ${targetDir}`);
    } else {
      console.log(
        "✗ Original download failed. Retrying with --use-extractors generic ..."
      );
      code = await runYtDlp(url, targetDir, ["--use-extractors", "generic"]);
      if (code === 0) {
        console.log(
          `✓ Success with generic extractor. Saved under: ${targetDir}`
        );
      } else {
        console.log("✗ Download failed even with generic extractor.");
      }
    }
  }

  console.log("\nStage 1 (with per-URL folders and fallback) finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
