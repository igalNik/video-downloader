// step1_basic_download.js
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

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const YTDLP_OUTPUT_TEMPLATE = "%(title).250s.%(ext)s"; // filename truncated at save-time

// --- NEW: in-memory collection for a final summary JSON ---
const allSummaries = []; // filled from .info.json files we parse

function parseArgs(argv) {
  const args = {
    urls: [],
    file: null,
    outDir: process.cwd(),
    browserExe: null,
    discoverTimeout: 15000,
    noBrowser: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") {
      args.file = argv[++i];
    } else if (a === "--out" || a === "-o") {
      args.outDir = path.resolve(argv[++i]);
    } else if (a === "--browser-exe") {
      args.browserExe = argv[++i];
    } else if (a === "--discover-timeout") {
      args.discoverTimeout = Number(argv[++i]) || args.discoverTimeout;
    } else if (a === "--no-browser") {
      args.noBrowser = true;
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

// Sanitize only (no truncation here). Truncation will happen right before saving.
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

// Helper: detect master URLs
function isMasterUrl(u) {
  // Matches "master.m3u8", "master_1080.m3u8", ".../master?..."
  return /(^|\/)master([_-][^\/?]+)?\.m3u8(\?|$)/i.test(u);
}

// --- Stage 3: discover m3u8 via headless browser network capture ---
// Collect only .m3u8; return masters first, then other m3u8s.
async function findM3u8ViaBrowser(
  originalUrl,
  { browserExe, timeoutMs = 15000 } = {}
) {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.warn("! Puppeteer is not installed. Run: npm install puppeteer");
    return [];
  }

  const launchOpts = {
    headless: "new",
    defaultViewport: { width: 1366, height: 768 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--mute-audio",
    ],
  };
  if (browserExe) launchOpts.executablePath = browserExe;

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );

  const masters = new Set();
  const others = new Set();

  const consider = (u) => {
    if (!/\.m3u8(\?|$)/i.test(u)) return;
    if (isMasterUrl(u)) masters.add(u);
    else others.add(u);
  };

  // Collect from both requests and responses
  page.on("request", (req) => {
    try {
      consider(req.url());
    } catch {}
  });
  page.on("response", (res) => {
    try {
      const u = res.url();
      const s = res.status();
      if (s >= 200 && s < 400) consider(u);
    } catch {}
  });

  try {
    const nav = page.goto(originalUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const timer = new Promise((r) => setTimeout(r, timeoutMs));
    await Promise.race([nav.then(() => timer), timer]);
  } catch (e) {
    console.warn(`! Navigation error: ${e}`);
  } finally {
    await browser.close().catch(() => {});
  }

  // Build final list: masters first; then others
  const list = [...masters, ...others];

  if (list.length) {
    console.log("• Browser discovered .m3u8 candidates (masters first):");
    for (const c of list.slice(0, 8)) console.log("  -", c);
    if (list.length > 8) console.log(`  ...(+${list.length - 8} more)`);
  } else {
    console.log("• Browser discovered no .m3u8 candidates.");
  }

  return list;
}

// --- NEW: summarize *.info.json files in a target directory AND collect to final JSON ---
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function printInfoJsonSummaries(dir, ctx = {}) {
  let files = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".info.json"));
  } catch (e) {
    console.warn(`(warn) Could not list dir for info JSONs: ${e.message}`);
    return;
  }

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

      // --- collect into final summary ---
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

// --- NEW: write the final summary JSON into the root output directory ---
function writeFinalSummary(outDir) {
  const summary = {
    generated_at: new Date().toISOString(),
    count: allSummaries.length,
    items: allSummaries,
  };
  const outPath = path.join(outDir, "download_summary.json");
  try {
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`\n✓ Wrote summary JSON: ${outPath}`);
  } catch (e) {
    console.warn(`(warn) Failed to write summary JSON: ${e.message}`);
  }
}

// Helper: build (and create) a per-URL target directory,
// truncating folder name to 250 ONLY now (save-time).
function prepareTargetDir(rootOutDir, rawUrl) {
  const base = makeSanitizedFolderBase(rawUrl); // no truncation inside
  const subdirName = base.length > 250 ? base.slice(0, 250) : base; // truncation at save-time
  const dir = path.join(rootOutDir, subdirName || "url");
  ensureDir(dir);
  return dir;
}

async function main() {
  const args = parseArgs(process.argv);
  const list = Array.from(iterUrls(args));

  if (list.length === 0) {
    console.log("Usage:");
    console.log("  node src/step1_basic_download.js <url1> <url2> ...");
    console.log("  node src/step1_basic_download.js --file urls.txt");
    console.log(
      "  node src/step1_basic_download.js --out downloads --file urls.txt"
    );
    console.log(
      '  [optional] --browser-exe "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"'
    );
    console.log("  [optional] --discover-timeout 20000");
    console.log("  [optional] --no-browser   # skip stage 3");
    process.exit(2);
  }

  ensureDir(args.outDir);

  for (const url of list) {
    console.log("\n" + "-".repeat(100));
    console.log(`# Processing: ${url}`);

    // Decide and (if needed) truncate the folder name immediately before saving
    let targetDir = prepareTargetDir(args.outDir, url);

    // 1) Original
    let code = await runYtDlp(url, targetDir);
    if (code === 0) {
      console.log(`✓ Success. Saved under: ${targetDir}`);
      printInfoJsonSummaries(targetDir, { originalUrl: url });
      continue;
    }

    // 2) Original with generic extractor
    console.log(
      "✗ Original download failed. Retrying with --use-extractors generic ..."
    );
    code = await runYtDlp(url, targetDir, ["--use-extractors", "generic"]);
    if (code === 0) {
      console.log(
        `✓ Success with generic extractor. Saved under: ${targetDir}`
      );
      printInfoJsonSummaries(targetDir, { originalUrl: url });
      continue;
    }

    // 3) Browser network discovery (NO generic here)
    if (args.noBrowser) {
      console.log("• Skipping browser discovery due to --no-browser flag.");
      console.log("✗ All attempts failed.");
      continue;
    }

    console.log("• Attempting browser-based network discovery for .m3u8 …");
    const m3u8s = await findM3u8ViaBrowser(url, {
      browserExe: args.browserExe,
      timeoutMs: args.discoverTimeout,
    });

    if (m3u8s.length === 0) {
      console.log("✗ Download failed; no .m3u8 discovered via browser.");
      continue;
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
  }

  // --- NEW: write one summary file at the end, in the root output directory ---
  writeFinalSummary(args.outDir);

  console.log(
    "\nStage 1 (per-URL folders, save-time truncation, generic fallback, network-based m3u8 discovery, and final JSON summary) finished."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
