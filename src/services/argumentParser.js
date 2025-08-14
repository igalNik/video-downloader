const fs = require("fs");
const path = require("path");

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

module.exports = {
  parseArgs,
  iterUrls,
};
