const path = require("path");
const { DEFAULT_CONFIG } = require("../config/constants");

function parseArgs(argv) {
  const args = {
    urls: [],
    file: null,
    outDir: DEFAULT_CONFIG.outDir,
    browserExe: DEFAULT_CONFIG.browserExe,
    discoverTimeout: DEFAULT_CONFIG.discoverTimeout,
    noBrowser: DEFAULT_CONFIG.noBrowser,
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
    const { readUrlsFromFile } = require("../utils/fileUtils");
    try {
      const lines = readUrlsFromFile(file);
      for (const line of lines) {
        yield line;
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  } else {
    for (const u of urls) {
      if (!u) continue;
      yield u;
    }
  }
}

function printUsage() {
  console.log("Usage:");
  console.log("  node src/index.js <url1> <url2> ...");
  console.log("  node src/index.js --file urls.txt");
  console.log("  node src/index.js --out downloads --file urls.txt");
  console.log(
    '  [optional] --browser-exe "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"'
  );
  console.log("  [optional] --discover-timeout 20000");
  console.log("  [optional] --no-browser   # skip stage 3");
}

module.exports = {
  parseArgs,
  iterUrls,
  printUsage,
};
